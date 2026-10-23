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

# A failure here is silent by nature — nobody is watching at 09:30. The first
# outage ran for 11 days before anyone noticed, so surface it instead.
STREAK_FILE="$LOG_DIR/.fail-streak"
notify() {
  osascript -e "display notification \"$1\" with title \"Stackpick daily update\"" >/dev/null 2>&1 || true
}

if [ $STATUS -ne 0 ] || [ "$BEFORE" = "$AFTER" ]; then
  STREAK=$(( $(cat "$STREAK_FILE" 2>/dev/null || echo 0) + 1 ))
  echo "$STREAK" >"$STREAK_FILE"
else
  STREAK=0
  rm -f "$STREAK_FILE"
fi

if [ $STATUS -ne 0 ]; then
  say "FAILED: update-check.sh exited $STATUS (consecutive: $STREAK)"
  notify "Failed $STREAK day(s) in a row — see logs/daily-update.log"
elif [ "$BEFORE" = "$AFTER" ]; then
  say "no commit created — nothing changed, or the run stopped early (consecutive: $STREAK)"
  # One quiet day is normal; several in a row means it is not really working.
  [ "$STREAK" -ge 3 ] && notify "No update committed for $STREAK days — see logs/daily-update.log"
else
  say "finished — committed $(git log --oneline -1 --format='%h %s')"
fi

# Keep the log from growing without bound.
if [ "$(wc -l <"$LOG")" -gt 2000 ]; then
  tail -2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

say "=== run end ==="
exit 0
