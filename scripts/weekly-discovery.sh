#!/bin/bash
# Stackpick — weekly wrapper around discovery.sh
#
# Runs unattended from launchd. Weekly rather than daily on purpose: three tools
# a day is ~1,095 a year, which is well past the number of AI DevOps tools worth
# listing, and a site recovering from a thin-content deindexing does not need to
# add 270 pages a month. Weekly is roughly the rate at which genuinely notable
# tools appear.
#
# Logs: logs/weekly-discovery.log (kept to the last 2000 lines)

set -uo pipefail
cd "$(dirname "$0")/.."

LOG_DIR="logs"
LOG="$LOG_DIR/weekly-discovery.log"
STREAK_FILE="$LOG_DIR/.discovery-fail-streak"
mkdir -p "$LOG_DIR"

say() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >>"$LOG"; }
notify() {
  osascript -e "display notification \"$1\" with title \"Stackpick discovery\"" >/dev/null 2>&1 || true
}

say "=== run start ==="

CRED_FILE="$HOME/.config/stackpick/credentials"
if [ -r "$CRED_FILE" ]; then
  # shellcheck source=/dev/null
  . "$CRED_FILE"
fi
if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  export CLAUDE_CODE_OAUTH_TOKEN
else
  unset CLAUDE_CODE_OAUTH_TOKEN 2>/dev/null || true
fi

if ! curl -sf --max-time 10 -o /dev/null https://stackpick.net; then
  say "ABORT: no network (stackpick.net unreachable)"
  exit 0
fi

# discovery.sh refuses a dirty tools.json itself, but catching it here keeps the
# reason in this log rather than only in the subprocess output.
if ! git diff --quiet -- src/data/tools.json; then
  say "ABORT: src/data/tools.json has uncommitted changes — skipping"
  exit 0
fi

BEFORE=$(git rev-parse HEAD)

say "running discovery.sh"
./scripts/discovery.sh >>"$LOG" 2>&1
STATUS=$?

AFTER=$(git rev-parse HEAD)

if [ $STATUS -ne 0 ] || [ "$BEFORE" = "$AFTER" ]; then
  STREAK=$(( $(cat "$STREAK_FILE" 2>/dev/null || echo 0) + 1 ))
  echo "$STREAK" >"$STREAK_FILE"
else
  STREAK=0
  rm -f "$STREAK_FILE"
fi

if [ $STATUS -ne 0 ]; then
  # discovery.sh reverts its own changes on a quality or schema failure, so a
  # non-zero exit means nothing shipped — worth knowing, not an emergency.
  say "FAILED: discovery.sh exited $STATUS (consecutive: $STREAK)"
  notify "Discovery failed $STREAK week(s) running — see logs/weekly-discovery.log"
elif [ "$BEFORE" = "$AFTER" ]; then
  say "no commit created — no new tools added (consecutive: $STREAK)"
  # Two quiet weeks in a row is the signal that the candidate pool is thinning,
  # which is a judgement call for a human rather than something to retry at.
  [ "$STREAK" -ge 2 ] && notify "No new tools for $STREAK weeks — candidate pool may be exhausted"
else
  say "finished — committed $(git log --oneline -1 --format='%h %s')"
fi

if [ "$(wc -l <"$LOG")" -gt 2000 ]; then
  tail -2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

say "=== run end ==="
exit 0
