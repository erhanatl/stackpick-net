/**
 * Vendor logo URLs.
 *
 * Previously every logo on the site pointed at Google's favicon service
 * (`google.com/s2/favicons`). That endpoint now answers with a 330-byte
 * text/html document rather than an image for every domain tested, so the
 * `<img>` loaded "successfully" and rendered as an empty box — on all 300+ tool
 * pages, not just the ones anyone happened to notice.
 *
 * DuckDuckGo's icon service returns real image bytes for the same domains, so
 * that is what these build. It takes no size parameter; display size is a CSS
 * concern.
 *
 * A remote icon service can always fail, so callers should pair this with a
 * monogram underneath the image rather than trusting it to load.
 */

export function logoDomain(websiteUrl: string | undefined): string | null {
  if (!websiteUrl) return null;
  try {
    return new URL(websiteUrl).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function logoUrl(websiteUrl: string | undefined): string | null {
  const domain = logoDomain(websiteUrl);
  return domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null;
}

/** First character for the monogram shown when no logo is available. */
export function monogram(name: string | undefined): string {
  return (name || '?').trim().charAt(0).toUpperCase();
}
