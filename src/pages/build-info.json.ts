import type { APIRoute } from 'astro';
import { execSync } from 'node:child_process';

/**
 * Reports which commit produced the deployed site.
 *
 * Deploys have twice stopped reaching the live site without anyone noticing —
 * once for three hours on a lockfile that did not match package.json, once for
 * sixteen days on a _redirects file Cloudflare rejected. Both times the repo
 * looked healthy and the build passed locally, so there was nothing to see from
 * the developer's side.
 *
 * scripts/check-deploy.sh reads this after a push and compares it with the SHA
 * it just pushed, which turns "is it live yet?" into a definite answer instead
 * of grepping the HTML for whatever happened to change.
 */

function commitSha(): string {
  // Cloudflare Pages sets this during its own build; it is the authoritative
  // value, because it describes what Cloudflare actually checked out.
  const fromCI = process.env.CF_PAGES_COMMIT_SHA;
  if (fromCI) return fromCI;

  // Local builds: fall back to git so `npm run build` is still meaningful.
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({ commit: commitSha(), builtAt: new Date().toISOString() }, null, 2),
    {
      headers: {
        'content-type': 'application/json',
        // The whole point is to read the newest value, so it must not be served
        // from an edge cache after the next deploy.
        'cache-control': 'no-store',
      },
    }
  );
