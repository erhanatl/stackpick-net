/**
 * Turns the free-text `starting_price` field into displayable lines.
 *
 * `starting_price` is a single string, so a real tier table would need a
 * structured `pricing_tiers` field added to the schema and backfilled across
 * 300+ tools. This is the interim step: the same data, broken into lines
 * instead of rendered as one run-on sentence crammed into a narrow column.
 *
 * Deliberately conservative. Where a fragment splits cleanly into a plan name
 * and a figure it is shown as a two-column row; where it does not, the fragment
 * is kept whole rather than guessed at. Mangling a price is worse than leaving
 * it as prose.
 */

export interface PriceLine {
  /** Plan name, when the fragment had one. */
  label?: string;
  /** The figure, or the whole fragment when it could not be split. */
  value: string;
}

/** Matches a leading plan name followed by a price or "from"/"starts at". */
const NAMED_TIER =
  /^(.{2,28}?)\s+(?:plan\s+)?(?:from\s+|starting\s+at\s+|starts\s+at\s+|at\s+)?(\$\s?[\d.,]+.*)$/i;

/** A fragment worth splitting on a comma only if what follows looks like a tier. */
const LOOKS_LIKE_TIER = /^[A-Z][\w+ ]{1,24}\s+(?:from\s+)?\$\s?[\d.,]/;

function tidy(fragment: string): string {
  return fragment.trim().replace(/^[,;]\s*/, '').replace(/[.;,]\s*$/, '');
}

export function parsePriceLines(raw: string | undefined): PriceLine[] {
  const text = (raw || '').trim();
  if (!text) return [];

  // Semicolons are the author-intended separator in this data; commas are
  // ambiguous because they also appear inside parenthesised notes.
  let fragments = text.split(';').map(tidy).filter(Boolean);

  fragments = fragments.flatMap((fragment) => {
    // Never split inside brackets — "Pro $10/month (incl. $15 AI credits)"
    // must survive intact.
    if (/[()]/.test(fragment)) {
      const parts = fragment.split(/,\s*(?![^(]*\))/).map(tidy).filter(Boolean);
      return parts.length > 1 && parts.slice(1).every((p) => LOOKS_LIKE_TIER.test(p))
        ? parts
        : [fragment];
    }
    const parts = fragment.split(',').map(tidy).filter(Boolean);
    return parts.length > 1 && parts.slice(1).every((p) => LOOKS_LIKE_TIER.test(p))
      ? parts
      : [fragment];
  });

  return fragments.map((fragment) => {
    // "1 credit = $0.01" is a unit note, not a plan, and reads badly as a
    // labelled row ending in "=".
    if (fragment.includes('=')) return { value: fragment };

    const named = fragment.match(NAMED_TIER);
    if (named) {
      const [, label, value] = named;
      // A label is only useful if it reads as a plan name rather than the tail
      // of a sentence.
      if (!/\s(?:and|or|with|includes?|per|for|of|to)\s/i.test(label)) {
        return { label: tidy(label), value: tidy(value) };
      }
    }
    return { value: fragment };
  });
}

/** True when the price field answers "what does this cost?" at all. */
export function hasStatedPrice(raw: string | undefined): boolean {
  return /\$\s?\d|\bfree\b|open source/i.test(raw || '');
}

/**
 * Badge styling per pricing model.
 *
 * Previously five hues across three files, with green for Free and emerald for
 * Open Source — two colours a reader cannot tell apart for a distinction that
 * does not change what they pay. Collapsed to three, each marking a genuinely
 * different buying situation, plus neutral for quote-based.
 */
export interface PricingBadge {
  bg: string;
  border: string;
  text: string;
  label: string;
}

const NEUTRAL: Omit<PricingBadge, 'label'> = {
  bg: 'bg-gray-50',
  border: 'border-gray-200',
  text: 'text-gray-700',
};

const BADGES: Record<string, PricingBadge> = {
  // Costs nothing to run — whether that is a free product or an OSS licence.
  Free: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', label: 'Free' },
  'Open Source': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', label: 'Open Source' },
  // Usable at zero cost, but the paid tier is the real product.
  Freemium: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', label: 'Free Tier Available' },
  // Published price, no free path in.
  Paid: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', label: 'Paid Only' },
  // Quote-based: there is no number to show, so no colour is warranted either.
  Enterprise: { ...NEUTRAL, label: 'Enterprise' },
};

export function pricingBadge(model: string | undefined): PricingBadge {
  return BADGES[model || ''] ?? { ...NEUTRAL, label: model || 'Pricing' };
}
