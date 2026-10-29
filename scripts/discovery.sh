#!/bin/bash
CLAUDE=/Users/erhan/.local/bin/claude
# Stackpick — Tool Discovery
# Researches 3 new AI DevOps tools and adds them to tools.json.
# Usage: ./scripts/discovery.sh
#
# The model edits tools.json and nothing else. This script decides whether the
# result ships, because the earlier version let the model commit and push its
# own work: it asked for a "3-4 paragraph overview", which produced ~1,700
# characters per tool, and 82 entries of that shape are sitting in Google's
# "crawled, currently not indexed" bucket. Content that fails the gate is
# reverted rather than published.

set -uo pipefail
cd "$(dirname "$0")/.."

fail() { echo "discovery: $*" >&2; }

echo "Pulling latest changes..."
git pull origin main || { fail "git pull failed"; exit 1; }

if ! git diff --quiet -- src/data/tools.json; then
  fail "src/data/tools.json has uncommitted changes — refusing to run on top of them"
  exit 1
fi

# No git tools in the allowlist: committing is this script's decision, not the
# model's. The prompt arrives on stdin because --allowedTools is variadic and
# would otherwise swallow a positional prompt as another tool name.
$CLAUDE -p \
  --permission-mode acceptEdits \
  --allowedTools "Edit Read WebSearch WebFetch" <<'PROMPT'
You are maintaining Stackpick, a directory of DevOps and AI engineering tools.

Read src/data/tools.json. It lists every tool already covered — check slugs
before you research anything, so you do not propose duplicates.

Find 3 tools that are NOT already listed, and add a JSON entry for each.

SELECTION
- Real products with real users, not launch pages or abandoned repos.
- Active in 2025-2026.
- Prefer the thinner categories. Count the existing entries per category and
  favour the ones with fewest; do not add a fourth AI code assistant when IaC
  or CI/CD is underfilled.
- Verify each tool exists by visiting its site. Do not write from memory.

PRICING — this is the part that is most often wrong
- Open the vendor's own pricing page and take the figures from it.
- Record the conditions attached to free tiers, not just the word "free".
  Real examples from this catalogue: Netdata's free tier is personal
  non-commercial use only; Chainguard's free images sit outside its CVE
  remediation SLA; Cypress Team and Business have identical usage allowances
  and differ only in features.
- If pricing genuinely is not published, write "Contact for pricing" rather
  than guessing a number.

WRITING THE content FIELD
This site was removed from Google's index for thin, uniformly structured pages.
Entries that repeat that pattern will be rejected by scripts/check-new-content.js
and reverted, so the run will have been wasted.

- At least 2,200 characters. Aim for 2,500-3,500.
- Give each tool its own heading structure. Do NOT use
  Overview / Key Features / Pricing Details / Pros and Cons /
  Who Should Use This Tool? / Final Verdict — 203 existing pages already share
  exactly that skeleton. Choose headings that suit the specific tool.
- Write concretely. Name the actual constraint, the actual price, the actual
  trade-off. "It is fast" is filler; "roughly 30-40% faster on warm-cache
  matching, though the gap closes on cold scans" is information.
- Include at least one thing that is genuinely awkward about the tool. Every
  product has one, and a page without it reads as marketing.
- Avoid this phrasing entirely: "represents a paradigm shift", "stands as",
  "What sets X apart", "is ideal for", "particularly valuable for",
  "comprehensive solution", "seamless", "robust", "cutting-edge", "compelling".

FIELDS — all 16, exactly these names
tool_name, slug, category, short_description, vendor, pricing_model,
starting_price, website_url, affiliate_url, pros, cons, status, content,
known_issues, avoid_if, last_updated

- slug: lowercase with hyphens, and unique across the file.
- category: exactly one of Code Assistant, Security, AIOps, Monitoring,
  Testing, CI/CD, IaC, AI Code Review. These are load-bearing — a value outside
  this set renders unstyled and breaks category links.
- pricing_model: exactly one of Free, Freemium, Paid, Enterprise, Open Source.
- short_description: 155 characters maximum. It becomes the meta description
  and is truncated past that.
- pros: comma-separated string of 4-5 items. Not an array.
- cons: comma-separated string of 3-4 items. Not an array.
- status: Published
- affiliate_url: empty string
- known_issues: a real limitation someone hit in production. Required.
- avoid_if: who should pick something else, and why. Required.
- last_updated: today's date, YYYY-MM-DD.

Edit src/data/tools.json only. Do not run git commands — the surrounding script
validates your work and commits it if it passes. Finish by reporting which
three tools you added and why you picked those categories.
PROMPT

CLAUDE_STATUS=$?
if [ $CLAUDE_STATUS -ne 0 ]; then
  fail "claude exited $CLAUDE_STATUS"
  git checkout -- src/data/tools.json 2>/dev/null
  exit 1
fi

if git diff --quiet -- src/data/tools.json; then
  fail "no changes were written — nothing to commit"
  exit 1
fi

echo
echo "Validating..."
if ! node scripts/validate-data.js; then
  fail "schema validation failed — reverting"
  git checkout -- src/data/tools.json
  exit 1
fi

if ! node scripts/check-new-content.js; then
  fail "content quality gate failed — reverting"
  git checkout -- src/data/tools.json
  exit 1
fi

echo
echo "Committing..."
git add src/data/tools.json
git commit -m 'Add 3 new tools - automated discovery' || { fail "commit failed"; exit 1; }
git push origin main || { fail "push failed — commit is local"; exit 1; }

echo "discovery: done — $(git log --oneline -1)"
