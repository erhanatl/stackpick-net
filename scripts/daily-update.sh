#!/bin/bash
# Stackpick — daily wrapper around update-check.sh
#
# Runs unattended from launchd, so it logs everything and refuses to start when
# the repo is in a state where an automated commit would be unsafe.
# Logs: logs/daily-update.log (kept to the last 2000 lines)

set -uo pipefail
cd "$(dirname "$0")/.."

LOG_DIR="logs"
LOG="$LOG_DIR/daily-update.log"
mkdir -p "$LOG_DIR"

say() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >>"$LOG"; }

say "=== run start ==="

# The Mac may be asleep or off the network when launchd fires.
if ! curl -sf --max-time 10 -o /dev/null https://stackpick.net; then
  say "ABORT: no network (stackpick.net unreachable)"
  exit 0
fi

# update-check.sh only commits src/data/tools.json, but a mid-edit tools.json
# from a human session would get picked up. Leave it alone in that case.
if ! git diff --quiet -- src/data/tools.json; then
  say "ABORT: src/data/tools.json has uncommitted changes — skipping to avoid committing someone else's edit"
  exit 0
fi

BEFORE=$(git rev-parse HEAD)

say "running update-check.sh"
./scripts/update-check.sh >>"$LOG" 2>&1
STATUS=$?

AFTER=$(git rev-parse HEAD)

if [ $STATUS -ne 0 ]; then
  say "update-check.sh exited $STATUS"
elif [ "$BEFORE" = "$AFTER" ]; then
  say "finished — no commit created (nothing changed, or the run stopped early)"
else
  say "finished — committed $(git log --oneline -1 --format='%h %s')"
fi

# Keep the log from growing without bound.
if [ "$(wc -l <"$LOG")" -gt 2000 ]; then
  tail -2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

say "=== run end ==="
exit 0
