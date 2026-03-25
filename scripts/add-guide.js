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

// --- Ask user for title ---
function askQuestion(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// --- Generate slug ---
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// --- Detect guide type from title ---
function detectType(title) {
  const lower = title.toLowerCase();
  if (lower.includes('best') || lower.includes('top')) return 'best-tools';
  if (lower.includes('how to') || lower.includes('choose') || lower.includes('guide to choosing')) return 'how-to-choose';
  // Default to best-tools
  return 'best-tools';
}

// --- Detect category from title ---
function detectCategory(title) {
  const lower = title.toLowerCase();
  const categoryMap = {
    'ci/cd': 'CI/CD',
    'ci cd': 'CI/CD',
    'cicd': 'CI/CD',
    'continuous integration': 'CI/CD',
    'continuous delivery': 'CI/CD',
    'code assistant': 'Code Assistant',
    'code completion': 'Code Assistant',
    'copilot': 'Code Assistant',
    'monitoring': 'Monitoring',
    'observability': 'Monitoring',
    'testing': 'Testing',
    'test automation': 'Testing',
    'security': 'Security',
    'vulnerability': 'Security',
    'iac': 'IaC',
    'infrastructure as code': 'IaC',
    'infrastructure': 'IaC',
    'terraform': 'IaC',
    'code review': 'AI Code Review',
    'aiops': 'AIOps',
    'incident': 'AIOps',
  };

  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (lower.includes(keyword)) return category;
  }

  return 'DevOps';
}

// --- Generate guide with Claude ---
async function generateGuide(title) {
  console.log(`\nGenerating guide: "${title}"...\n`);

  // Load tools data for context
  const toolsPath = path.join(ROOT, 'src', 'data', 'tools.json');
  const tools = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));
  const publishedTools = tools.filter(t => t.status === 'Published');

  const category = detectCategory(title);
  const type = detectType(title);

  // Get relevant tools for this guide
  const relevantTools = publishedTools.filter(t => t.category === category);
  const toolsList = relevantTools.length > 0
    ? relevantTools.map(t => `- ${t.tool_name}: ${t.short_description} (Rating: ${t.rating}/5, Pricing: ${t.pricing_model})`).join('\n')
    : publishedTools.slice(0, 10).map(t => `- ${t.tool_name} (${t.category}): ${t.short_description}`).join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: `You are an expert DevOps tools analyst writing for Stackpick.net, an independent AI tools comparison site for DevOps teams.

Write a comprehensive, SEO-optimized guide titled: "${title}"

Here are some relevant tools from our database that you should reference and link to:
${toolsList}

Requirements:
- Write 2000-3000 words
- Use markdown format
- Do NOT include the title as an h1 heading (it's rendered separately)
- Start with an engaging introduction paragraph
- Use h2 (##) and h3 (###) headings for structure
- Include practical, actionable advice
- Reference tools from the list above naturally, using their names
- When mentioning a tool from our site, note that readers can find the full review on Stackpick
- Use '- ' for bullet lists (never use bullet characters)
- Include a clear conclusion/summary section
- Write professionally but accessibly
- Focus on helping DevOps teams make informed decisions
- Include relevant keywords naturally for SEO
- Add comparison tables where appropriate using markdown tables

Also generate a concise meta description (150-160 characters) for SEO.

Return a JSON object (and NOTHING else, no markdown code fences) with these fields:
{
  "description": "SEO meta description, 150-160 characters",
  "content": "The full markdown guide content (2000-3000 words)"
}`,
      },
    ],
  });

  const responseText = message.content[0].text;

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (e) {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Could not parse Claude response as JSON');
    }
  }

  return {
    title,
    slug: slugify(title),
    category,
    type,
    description: parsed.description,
    content: parsed.content,
    date: new Date().toISOString().split('T')[0],
  };
}

// --- Add to guides.json ---
function addToGuidesJson(guide) {
  const guidesPath = path.join(ROOT, 'src', 'data', 'guides.json');
  const guides = JSON.parse(fs.readFileSync(guidesPath, 'utf-8'));

  // Check duplicate
  const existing = guides.findIndex(g => g.slug === guide.slug);
  if (existing >= 0) {
    if (!process.argv.includes('--force')) {
      console.log(`\nGuide "${guide.title}" already exists. Use --force to overwrite.`);
      return false;
    }
    guides[existing] = guide;
    console.log(`Updated existing guide: ${guide.title}`);
  } else {
    guides.push(guide);
    console.log(`Added new guide: ${guide.title}`);
  }

  fs.writeFileSync(guidesPath, JSON.stringify(guides, null, 2));
  return true;
}

// --- Git push ---
function gitPush(title) {
  try {
    execSync('git add src/data/guides.json', { cwd: ROOT });
    execSync(`git commit -m "Add guide: ${title}"`, { cwd: ROOT });
    execSync('git push origin main', { cwd: ROOT });
    console.log('\nGit push successful! Cloudflare will auto-deploy.');
  } catch (err) {
    console.error('Git push failed:', err.message);
  }
}

// --- Main ---
async function main() {
  let title = process.argv[2];

  if (!title) {
    title = await askQuestion('Enter guide title: ');
  }

  if (!title) {
    console.error('No title provided.');
    process.exit(1);
  }

  // Generate
  const guide = await generateGuide(title);

  // Show summary
  console.log('\n--- Generated Guide ---');
  console.log(`Title: ${guide.title}`);
  console.log(`Slug: ${guide.slug}`);
  console.log(`Category: ${guide.category}`);
  console.log(`Type: ${guide.type}`);
  console.log(`Description: ${guide.description}`);
  console.log(`Content length: ${guide.content.length} chars`);
  console.log(`Date: ${guide.date}`);
  console.log('------------------------\n');

  // Add to guides.json
  const added = addToGuidesJson(guide);

  if (!added) {
    console.log('No changes made.');
    return;
  }

  // Git push
  console.log('Pushing to GitHub...');
  gitPush(guide.title);

  console.log(`\nDone! "${guide.title}" will be live at https://stackpick.net/blog/${guide.slug}/`);
}

main().catch(console.error);
