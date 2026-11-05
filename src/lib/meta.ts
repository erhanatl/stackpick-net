/**
 * Meta description composition.
 *
 * Tool pages averaged 274 characters and reached 463, because the template
 * interpolated `starting_price` straight in — and that field is sometimes a
 * full tier breakdown ("Free tier; Pro $10/month (incl. $15 AI credits), ...").
 * Google shows roughly 155-160, so the useful half of those descriptions was
 * being cut off in results.
 *
 * Segments are added in priority order and only while they fit, so the sentence
 * that survives is a whole one rather than a truncation. Nothing is padded to
 * reach the limit: a short description that reads well is better than a long
 * one that trails off.
 */

const LIMIT = 155;

/** Collapse whitespace and drop a trailing separator. */
function clean(part: string): string {
  return part.replace(/\s+/g, ' ').trim().replace(/[—–-]\s*$/, '').trim();
}

/**
 * Join segments while they fit in LIMIT. Later segments are dropped rather
 * than cut, so the result never ends mid-thought.
 */
export function composeDescription(segments: (string | undefined | false)[]): string {
  let out = '';
  for (const raw of segments) {
    if (!raw) continue;
    const part = clean(String(raw));
    if (!part) continue;
    const candidate = out ? `${out} ${part}` : part;
    if (candidate.length <= LIMIT) {
      out = candidate;
      continue;
    }
    // First segment alone is already too long — clip it at a word boundary
    // rather than returning nothing.
    if (!out) {
      const cut = part.slice(0, LIMIT);
      const lastSpace = cut.lastIndexOf(' ');
      out = (lastSpace > LIMIT * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:]$/, '');
    }
    break;
  }
  return out;
}

/**
 * A price phrase short enough to belong in a meta description, or undefined.
 *
 * `starting_price` is free text and frequently a whole tier list. Rather than
 * dropping those entirely — which left pricing descriptions averaging half the
 * available length with no figure in them — fall back to the first tier, which
 * is the one a searcher wants anyway.
 */
export function shortPrice(startingPrice: string | undefined): string | undefined {
  const price = clean(startingPrice || '');
  if (!price) return undefined;
  if (price.length <= 40) return price;

  // Too long to use whole: take the leading fragment, which is where the entry
  // price sits in this data ("Free tier; Pro $10/month, ..." → "Free tier").
  const first = clean(price.split(/[;,]/)[0] || '');
  if (first && first.length <= 40) return first;

  // No usable fragment — a bare figure is still better than nothing.
  const figure = price.match(/\$\s?[\d.,]+(?:\s*\/\s*\w+)?/);
  return figure ? clean(figure[0]) : undefined;
}

/**
 * One sentence describing what a tool costs.
 *
 * Built rather than templated because gluing "From ${starting_price}" onto a
 * model label produces nonsense on this data — "enterprise. From Contact for
 * pricing." for quote-only tools, and "free tier available. From Free tier."
 * for the freemium ones. What a searcher wants is the entry figure when one
 * exists, and an honest "quote-based" when it does not.
 */
export function pricingSentence(
  model: string | undefined,
  startingPrice: string | undefined
): string {
  const price = clean(startingPrice || '');
  const figure = price.match(/\$\s?[\d.,]+(?:\s*\/\s*[\w/]+)?/);
  const hasFreeEntry = /\bfree\b/i.test(price) || model === 'Free' || model === 'Open Source';

  if (model === 'Open Source') {
    return figure ? `Open source, with paid plans from ${clean(figure[0])}.` : 'Free and open source.';
  }
  if (model === 'Free') return 'Free to use.';
  if (figure && hasFreeEntry) return `Free tier, paid plans from ${clean(figure[0])}.`;
  if (figure) return `Plans from ${clean(figure[0])}.`;
  if (hasFreeEntry) return 'Free tier available.';
  return 'Quote-based pricing.';
}
