import Airtable from 'airtable';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// --- Load .env manually ---
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

// --- Config ---
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !ANTHROPIC_API_KEY) {
  console.error('Missing environment variables. Copy .env.example to .env and fill in your keys.');
  process.exit(1);
}

// --- Init clients ---
const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// --- Fetch Draft tools from Airtable ---
async function fetchDraftTools() {
  const records = [];
  await new Promise((resolve, reject) => {
    base('Tools')
      .select({
        filterByFormula: "{status} = 'Draft'",
        maxRecords: 10,
      })
      .eachPage(
        (pageRecords, fetchNextPage) => {
          records.push(...pageRecords);
          fetchNextPage();
        },
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
  });
  return records;
}

// --- Generate content with Claude ---
async function generateContent(tool) {
  const prompt = `Write a detailed review page for the DevOps AI tool '${tool.tool_name}'.
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

Write professionally, be objective. Include the rating. Do NOT add the title as h1 - start directly with the overview.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}

// --- Update tools.json ---
function updateToolsJson(tool, content) {
  const toolsPath = path.join(ROOT, 'src', 'data', 'tools.json');
  const tools = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));

  // Check if tool already exists
  const existingIndex = tools.findIndex((t) => t.slug === tool.slug);

  const toolData = {
    tool_name: tool.tool_name,
    slug: tool.slug,
    category: tool.category,
    short_description: tool.short_description,
    vendor: tool.vendor,
    pricing_model: tool.pricing_model,
    starting_price: tool.starting_price,
    website_url: tool.website_url,
    affiliate_url: tool.affiliate_url || '',
    rating: tool.rating,
    pros: tool.pros,
    cons: tool.cons,
    content: content,
    status: 'Published',
  };

  if (existingIndex >= 0) {
    tools[existingIndex] = toolData;
    console.log(`  Updated existing tool: ${tool.tool_name}`);
  } else {
    tools.push(toolData);
    console.log(`  Added new tool: ${tool.tool_name}`);
  }

  fs.writeFileSync(toolsPath, JSON.stringify(tools, null, 2));
}

// --- Update Airtable status to Published ---
async function markAsPublished(recordId) {
  await base('Tools').update(recordId, { status: 'Published' });
}

// --- Git commit and push ---
function gitPush(toolNames) {
  try {
    execSync('git add src/data/tools.json', { cwd: ROOT });
    execSync(
      `git commit -m "Add tools: ${toolNames.join(', ')}"`,
      { cwd: ROOT }
    );
    execSync('git push origin main', { cwd: ROOT });
    console.log('\nGit push successful! Cloudflare will auto-deploy.');
  } catch (err) {
    console.error('Git push failed:', err.message);
  }
}

// --- Main ---
async function main() {
  console.log('Fetching Draft tools from Airtable...\n');
  const records = await fetchDraftTools();

  if (records.length === 0) {
    console.log('No Draft tools found. Nothing to do.');
    return;
  }

  console.log(`Found ${records.length} Draft tool(s).\n`);
  const processedNames = [];

  for (const record of records) {
    const tool = record.fields;
    console.log(`Processing: ${tool.tool_name}`);

    // Generate content
    console.log('  Generating content with Claude...');
    const content = await generateContent(tool);
    console.log('  Content generated.');

    // Update tools.json
    updateToolsJson(tool, content);

    // Mark as Published in Airtable
    console.log('  Updating Airtable status...');
    await markAsPublished(record.id);
    console.log('  Marked as Published.\n');

    processedNames.push(tool.tool_name);
  }

  // Git push
  console.log('Pushing to GitHub...');
  gitPush(processedNames);

  console.log(`\nDone! ${processedNames.length} tool(s) processed.`);
}

main().catch(console.error);
