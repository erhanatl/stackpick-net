#!/bin/bash
# Stackpick — Tool Discovery
# Finds 3 new AI DevOps tools and adds them to tools.json
# Usage: ./scripts/discovery.sh

set -e
cd "$(dirname "$0")/.."

echo "Pulling latest changes..."
git pull origin main

claude "You are maintaining a DevOps AI tools directory called Stackpick.

Read the file src/data/tools.json. It contains all currently listed tools.

Your task: Find 3 new AI DevOps tools that are NOT already in this file.

Criteria:
- Real products with actual users (not just landing pages)
- Launched or significantly updated in 2025-2026
- Must fit one of these categories: Code Assistant, Security, AIOps, Monitoring, Testing, CI/CD, IaC, AI Code Review
- Search the web to verify they exist and get accurate information

For each new tool, add a complete JSON entry to tools.json with these exact fields:
- tool_name: string
- slug: url-friendly string (lowercase, hyphens)
- category: one of the 8 categories above
- short_description: 1-2 sentence description
- vendor: company name
- pricing_model: one of: Free, Freemium, Paid, Enterprise, Open Source
- starting_price: specific price string (e.g. 'Free tier available', '\$19/user/month')
- website_url: official URL
- affiliate_url: empty string
- pros: comma-separated string of 4-5 advantages
- cons: comma-separated string of 3-4 limitations
- status: 'Published'
- content: 3-4 paragraph markdown overview (use ## headings)
- known_issues: string describing real user complaints or limitations
- avoid_if: string describing who should NOT use this tool
- last_updated: today's date in YYYY-MM-DD format

After adding all 3 tools, run these commands:
git add src/data/tools.json
git commit -m 'Add 3 new tools - automated discovery'
git push origin main"
