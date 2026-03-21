import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateContent(tool) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Write a detailed review page for the DevOps AI tool '${tool.tool_name}'.
Category: ${tool.category}.
Description: ${tool.short_description}.
Vendor: ${tool.vendor}.
Pricing: ${tool.pricing_model} - ${tool.starting_price}.
Pros: ${tool.pros}.
Cons: ${tool.cons}.
Rating: ${tool.rating}/5.

Write in markdown format with these sections:
1. Overview (2-3 paragraphs)
2. Key Features (bullet points)
3. Pricing Details
4. Pros and Cons
5. Who Should Use This Tool?
6. Final Verdict

Write professionally, be objective. Include the rating. Do NOT add the title as h1 - start directly with the overview.`
    }],
  });
  return message.content[0].text;
}

async function main() {
  const toolsPath = path.join(ROOT, 'src', 'data', 'tools.json');
  const tools = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));

  const missing = tools.filter(t => !t.content);
  console.log(`Found ${missing.length} tools without content.\n`);

  if (missing.length === 0) {
    console.log('All tools have content!');
    return;
  }

  for (const tool of missing) {
    console.log(`Processing: ${tool.tool_name}`);
    console.log('  Generating content...');
    const content = await generateContent(tool);
    tool.content = content;
    console.log('  Done.\n');
  }

  fs.writeFileSync(toolsPath, JSON.stringify(tools, null, 2));
  console.log('tools.json updated.\n');

  console.log('Pushing to GitHub...');
  try {
    execSync('git add src/data/tools.json', { cwd: ROOT });
    execSync(`git commit -m "Add content for ${missing.length} tools"`, { cwd: ROOT });
    execSync('git push origin main', { cwd: ROOT });
    console.log('Git push successful! Cloudflare will auto-deploy.');
  } catch (err) {
    console.error('Git push failed:', err.message);
  }
}

main().catch(console.error);
