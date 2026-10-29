#!/usr/bin/env node
/**
 * Quality gate for newly added tools.
 *
 * The site lost ~780 pages to Google in June 2026 for thin, uniformly
 * structured content. 82 of the existing entries average 1,722 characters and
 * 203 share one six-heading template — the profile scripts/discovery.sh was
 * producing when it asked for a "3-4 paragraph overview".
 *
 * This checks only entries that are NEW relative to git HEAD. The legacy
 * catalogue does not pass these thresholds and is not meant to: the point is to
 * stop the problem growing, not to fail every run over history.
 *
 * Exit 0 = safe to commit. Exit 1 = caller should revert.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const FILE = 'src/data/tools.json';

const MIN_CONTENT = 2200;          // thin bucket averages 1,722
const MAX_SHORT_DESC = 155;        // meta description truncates past this
const MAX_PATTERN_SCORE = 8;       // legacy catalogue averages 13.3, peaks at 38

// Weighted AI writing tells, from the audit of the existing 288 entries.
const TELLS = [
  [3, ['represents a paradigm', 'paradigm shift', 'stands as', 'represents a significant',
       'significant leap', 'has established itself', 'represents a new generation',
       'marks a pivotal', 'testament to']],
  [2, ['compelling', 'robust', 'seamless', 'cutting-edge', 'comprehensive solution',
       'game-chang', 'revolutioniz', 'best-in-class']],
  [2, ['What sets', 'stands out', 'positions itself', 'in the crowded', 'Overall,']],
  [2, ['is ideal for', 'particularly valuable for', 'is well-suited', 'might be better served']],
  [3, ['## Final Verdict', '## Who Should Use This Tool?', '## Pros and Cons']],
];

// The skeleton 203 existing pages share. A new entry reproducing it adds to the
// duplication Google already judged the site on.
const OVERUSED_SKELETON = [
  'Overview', 'Key Features', 'Pricing Details',
  'Pros and Cons', 'Who Should Use This Tool?', 'Final Verdict',
].join('|');

function patternScore(text = '') {
  let score = 0;
  for (const [weight, phrases] of TELLS) {
    for (const phrase of phrases) {
      score += weight * (text.split(phrase).length - 1);
    }
  }
  return score;
}

function headings(md = '') {
  return [...md.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim()).join('|');
}

function loadPrevious() {
  let raw;
  try {
    raw = execSync(`git show HEAD:${FILE}`, {
      cwd: ROOT,
      encoding: 'utf8',
      // tools.json is well past execSync's 1 MB default; without this the call
      // fails with ENOBUFS and every tool looks new.
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const msg = String(err.stderr || err.message || '');
    // A genuinely absent file at HEAD is the only case where "everything is
    // new" is the right answer. Anything else is a broken check, and a broken
    // check must not quietly wave content through.
    if (/exists on disk, but not in|does not exist|unknown revision|bad object/i.test(msg)) {
      return [];
    }
    console.error(`Could not read ${FILE} at HEAD, so new entries cannot be identified.`);
    console.error(`  ${msg.split('\n')[0]}`);
    process.exit(1);
  }
  return JSON.parse(raw);
}

const current = JSON.parse(fs.readFileSync(path.join(ROOT, FILE), 'utf8'));
const previousSlugs = new Set(loadPrevious().map((t) => t.slug));
const added = current.filter((t) => !previousSlugs.has(t.slug));

if (added.length === 0) {
  console.log('No new tools in this change — nothing to check.');
  process.exit(0);
}

const failures = [];
const seenSkeletons = new Map();

for (const tool of added) {
  const at = tool.slug || tool.tool_name || '(unnamed)';
  const content = tool.content || '';
  const len = content.length;
  const score = patternScore(content);
  const skeleton = headings(content);

  if (len < MIN_CONTENT) {
    failures.push(`${at}: content is ${len} chars, below the ${MIN_CONTENT} floor — this is the thin-page profile that got deindexed`);
  }
  if ((tool.short_description || '').length > MAX_SHORT_DESC) {
    failures.push(`${at}: short_description is ${tool.short_description.length} chars, over ${MAX_SHORT_DESC} — it will be truncated in search results`);
  }
  if (score > MAX_PATTERN_SCORE) {
    failures.push(`${at}: AI-pattern score ${score} exceeds ${MAX_PATTERN_SCORE} — rewrite the flagged phrasing`);
  }
  if (skeleton === OVERUSED_SKELETON) {
    failures.push(`${at}: uses the six-heading template already shared by 203 pages — give it its own structure`);
  }
  if (!(tool.known_issues || '').trim()) {
    failures.push(`${at}: known_issues is empty — a real limitation is required`);
  }
  if (!(tool.avoid_if || '').trim()) {
    failures.push(`${at}: avoid_if is empty — state who should not use this`);
  }

  // Two tools added in the same run should not be each other's copy either.
  if (skeleton && seenSkeletons.has(skeleton)) {
    failures.push(`${at}: identical heading structure to ${seenSkeletons.get(skeleton)} in this same batch`);
  } else if (skeleton) {
    seenSkeletons.set(skeleton, at);
  }
}

console.log(`Checked ${added.length} new tool(s):`);
for (const tool of added) {
  const len = (tool.content || '').length;
  const score = patternScore(tool.content || '');
  console.log(`  ${tool.slug} — ${len} chars, pattern score ${score}`);
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s); these changes should not ship:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nAll new entries pass.');
