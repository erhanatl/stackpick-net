import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// --- Load .env ---
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        process.env[key] = value;
      }
    }
  }
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// --- Ask user for tool name ---
function askQuestion(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// --- Generate everything with Claude ---
async function generateTool(toolName) {
  console.log(`\nGenerating full profile for "${toolName}"...\n`);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 6000,
    messages: [
      {
        role: 'user',
        content: `You are an expert DevOps tools analyst. Research and generate a complete profile for the DevOps/AI tool "${toolName}".

Return a JSON object (and NOTHING else, no markdown code fences) with exactly these fields:

{
  "tool_name": "Official tool name",
  "slug": "url-friendly-slug",
  "category": "One of: CI/CD, Code Assistant, Monitoring, Testing, Security, IaC",
  "short_description": "2-3 sentence description of what the tool does",
  "vendor": "Company that makes it",
  "pricing_model": "One of: Free, Freemium, Paid, Enterprise",
  "starting_price": "e.g. $10/month or Free tier available",
  "website_url": "Official website URL",
  "rating": 4.5,
  "pros": "Comma-separated list of 4-5 pros",
  "cons": "Comma-separated list of 3-4 cons",
  "content": "A detailed markdown review (800-1200 words) with these sections:\\n## Overview\\n(2-3 paragraphs)\\n## Key Features\\n(use markdown dash lists with '- ' prefix, NOT bullet characters)\\n## Pricing Details\\n## Pros and Cons\\n(use markdown dash lists with '- ' prefix)\\n## Who Should Use This Tool?\\n## Final Verdict\\n\\nWrite professionally, be objective. IMPORTANT: Always use '- ' for lists, never use '•' bullet character."
}

Important:
- The rating should be realistic (between 3.0 and 5.0)
- The content field should contain actual markdown with proper formatting
- All information should be accurate and up-to-date
- Return ONLY the JSON object, no other text`,
      },
    ],
  });

  const responseText = message.content[0].text;

  try {
    return JSON.parse(responseText);
  } catch (e) {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse Claude response as JSON');
  }
}

// --- Add to tools.json ---
function addToToolsJson(tool) {
  const toolsPath = path.join(ROOT, 'src', 'data', 'tools.json');
  const tools = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));

  // Check duplicate
  const existing = tools.findIndex((t) => t.slug === tool.slug);
  if (existing >= 0) {
    console.log(`\n⚠ "${tool.tool_name}" already exists. Skipping.`);
    console.log(`  Use "npm run add -- "${tool.tool_name}" --force" to overwrite.\n`);
    if (!process.argv.includes('--force')) {
      return false;
    }
    tools[existing] = { ...tool, affiliate_url: tools[existing].affiliate_url || '', status: 'Published' };
    console.log(`Updated existing tool: ${tool.tool_name}`);
  } else {
    tools.push({ ...tool, affiliate_url: '', status: 'Published' });
    console.log(`Added new tool: ${tool.tool_name}`);
  }

  fs.writeFileSync(toolsPath, JSON.stringify(tools, null, 2));
}

// --- Git push ---
function gitPush(toolName) {
  try {
    execSync('git add src/data/tools.json', { cwd: ROOT });
    execSync(`git commit -m "Add tool: ${toolName}"`, { cwd: ROOT });
    execSync('git push origin main', { cwd: ROOT });
    console.log('\nGit push successful! Cloudflare will auto-deploy.');
  } catch (err) {
    console.error('Git push failed:', err.message);
  }
}

// --- Main ---
async function main() {
  // Get tool name from command line args or ask
  let toolName = process.argv[2];

  if (!toolName) {
    toolName = await askQuestion('Enter tool name: ');
  }

  if (!toolName) {
    console.error('No tool name provided.');
    process.exit(1);
  }

  // Generate
  const tool = await generateTool(toolName);

  // Show summary
  console.log('\n--- Generated Profile ---');
  console.log(`Name: ${tool.tool_name}`);
  console.log(`Category: ${tool.category}`);
  console.log(`Vendor: ${tool.vendor}`);
  console.log(`Pricing: ${tool.pricing_model} - ${tool.starting_price}`);
  console.log(`Rating: ${tool.rating}/5`);
  console.log(`Description: ${tool.short_description}`);
  console.log(`Content length: ${tool.content.length} chars`);
  console.log('-------------------------\n');

  // Add to tools.json
  const added = addToToolsJson(tool);

  if (added === false) {
    console.log('No changes made.');
    return;
  }

  // Git push
  console.log('Pushing to GitHub...');
  gitPush(tool.tool_name);

  console.log(`\nDone! "${tool.tool_name}" is live on stackpick.net`);
}

main().catch(console.error);
