#!/bin/bash
# Stackpick — confirm a pushed commit actually reached the live site.
#
# Deploys have twice silently stopped: three hours on a lockfile out of sync
# with package.json, then sixteen days on a _redirects file Cloudflare rejected.
# Both times the repo was healthy, the build passed locally, and the only
# symptom was that the site quietly stopped changing. Nothing was watching.
#
# Usage: ./scripts/check-deploy.sh <sha> [timeout-seconds]
#
# Compares /build-info.json against the SHA given. Exit 0 if it lands, 1 if it
# does not — the caller decides whether that is worth a notification.

set -uo pipefail
cd "$(dirname "$0")/.."

SHA="${1:-}"
TIMEOUT="${2:-600}"
URL="https://stackpick.net/build-info.json"
LOG="logs/deploy-check.log"
mkdir -p logs

say() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >>"$LOG"; }

if [ -z "$SHA" ]; then
  echo "usage: $0 <sha> [timeout-seconds]" >&2
  exit 2
fi

say "waiting for ${SHA:0:8} (timeout ${TIMEOUT}s)"

DEADLINE=$(( $(date +%s) + TIMEOUT ))
LIVE=""
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  # Cache-bust: a stale edge copy would otherwise look like a stalled deploy.
  LIVE=$(curl -sf --max-time 15 "${URL}?t=$(date +%s)$RANDOM" 2>/dev/null \
         | sed -n 's/.*"commit"[[:space:]]*:[[:space:]]*"\([a-f0-9]*\)".*/\1/p')
  if [ "$LIVE" = "$SHA" ]; then
    say "OK — ${SHA:0:8} is live"
    exit 0
  fi
  sleep 20
done

if [ -z "$LIVE" ]; then
  say "FAILED — ${URL} unreachable or has no commit field after ${TIMEOUT}s"
else
  say "FAILED — still serving ${LIVE:0:8}, expected ${SHA:0:8} after ${TIMEOUT}s"
fi
exit 1
