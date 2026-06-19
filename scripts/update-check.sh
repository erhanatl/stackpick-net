#!/bin/bash
# Stackpick — Tool Update Checker
# Checks 15 oldest tools for pricing/status changes and updates tools.json
# Usage: ./scripts/update-check.sh

set -e
cd "$(dirname "$0")/.."

echo "Pulling latest changes..."
git pull origin main

claude "You are maintaining a DevOps AI tools directory called Stackpick.

Read the file src/data/tools.json.

Your task: Find the 15 tools where the last_updated field is oldest (or missing). Sort by last_updated ascending, take the first 15.

For each of those 15 tools:
1. Visit their website to check current pricing and status
2. Search the web for '[tool name] pricing 2026' if needed
3. Check for any of these changes:
   - Pricing model change (e.g. free tier removed, price increase/decrease)
   - Tool acquired, rebranded, or shut down
   - Major new features that affect the category or description
4. Update any fields that have changed (pricing_model, starting_price, short_description, known_issues, avoid_if)
5. If the tool has been shut down or acquired with a replacement, update known_issues to reflect this
6. Always set last_updated to today's date in YYYY-MM-DD format, even if nothing changed

After updating all 15 tools, run:
git add src/data/tools.json
git commit -m 'Update tool data - weekly check'
git push origin main

Report a brief summary of what changed and what stayed the same."
