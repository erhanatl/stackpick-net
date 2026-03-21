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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function askQuestion(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function generateComparison(toolNames, toolsData) {
  console.log(`\nGenerating comparison: ${toolNames.join(' vs ')}...\n`);

  const toolDetails = toolNames.map(name => {
    const t = toolsData.find(x => x.tool_name.toLowerCase() === name.toLowerCase());
    if (t) return `- ${t.tool_name}: ${t.short_description}. Pricing: ${t.pricing_model} - ${t.starting_price}. Rating: ${t.rating}/5. Pros: ${t.pros}. Cons: ${t.cons}.`;
    return `- ${name}: (no existing data)`;
  }).join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 6000,
    messages: [{
      role: 'user',
      content: `Write a detailed comparison article for these DevOps AI tools:

${toolDetails}

Write in markdown format with these sections:
## Overview
(Brief intro comparing the tools)

## Feature Comparison
(Detailed feature-by-feature comparison)

## Pricing Comparison
(Compare pricing plans)

## Use Cases
(When to choose each tool)

## Verdict
(Clear recommendation for different scenarios - e.g. "Choose X if..., Choose Y if...")

Write 800-1200 words. Be objective and professional. Do NOT add the title as h1.`
    }],
  });

  return message.content[0].text;
}

async function main() {
  const toolsPath = path.join(ROOT, 'src', 'data', 'tools.json');
  const comparisonsPath = path.join(ROOT, 'src', 'data', 'comparisons.json');
  const tools = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));
  const comparisons = JSON.parse(fs.readFileSync(comparisonsPath, 'utf-8'));

  // Get tool names
  let input = process.argv.slice(2).join(' ');

  if (!input) {
    console.log('Available tools:');
    tools.forEach(t => console.log(`  - ${t.tool_name}`));
    console.log('');
    input = await askQuestion('Enter tools to compare (e.g. "Snyk vs Wiz AI"): ');
  }

  // Parse tool names
  const toolNames = input.split(/\s+vs\s+/i).map(n => n.trim());

  if (toolNames.length < 2) {
    console.error('Need at least 2 tools to compare. Use "Tool A vs Tool B" format.');
    process.exit(1);
  }

  // Find matching tools
  const matchedSlugs = [];
  for (const name of toolNames) {
    const found = tools.find(t => t.tool_name.toLowerCase() === name.toLowerCase());
    if (!found) {
      console.error(`Tool "${name}" not found. Add it first with: npm run add -- "${name}"`);
      process.exit(1);
    }
    matchedSlugs.push(found.slug);
  }

  // Generate slug
  const slug = matchedSlugs.join('-vs-');

  // Check duplicate
  const existing = comparisons.findIndex(c => c.slug === slug);
  if (existing >= 0 && !process.argv.includes('--force')) {
    console.log(`\nComparison "${toolNames.join(' vs ')}" already exists. Use --force to overwrite.`);
    return;
  }

  // Generate content
  const content = await generateComparison(toolNames, tools);

  const comparison = {
    title: toolNames.map(n => tools.find(t => t.tool_name.toLowerCase() === n.toLowerCase())?.tool_name || n).join(' vs '),
    slug,
    description: `Detailed comparison of ${toolNames.join(' and ')} — which one is the better choice for your DevOps team?`,
    tools: matchedSlugs,
    content
  };

  // Save
  if (existing >= 0) {
    comparisons[existing] = comparison;
    console.log(`Updated comparison: ${comparison.title}`);
  } else {
    comparisons.push(comparison);
    console.log(`Added comparison: ${comparison.title}`);
  }

  fs.writeFileSync(comparisonsPath, JSON.stringify(comparisons, null, 2));

  // Git push
  console.log('\nPushing to GitHub...');
  try {
    execSync('git add src/data/comparisons.json', { cwd: ROOT });
    execSync(`git commit -m "Add comparison: ${comparison.title}"`, { cwd: ROOT });
    execSync('git push origin main', { cwd: ROOT });
    console.log('Git push successful! Cloudflare will auto-deploy.');
    console.log(`\nLive at: https://stackpick.net/compare/${slug}/`);
  } catch (err) {
    console.error('Git push failed:', err.message);
  }
}

main().catch(console.error);
