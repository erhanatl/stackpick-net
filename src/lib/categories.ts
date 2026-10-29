/**
 * Single source of truth for category presentation.
 *
 * Replaces the per-page `categoryConfig` maps that had drifted across
 * index.astro, best/index.astro, tools/index.astro and compare/index.astro,
 * each carrying its own copy of the emoji and a different colour for the same
 * category.
 *
 * Two deliberate changes from what those maps held:
 *
 * 1. Icons are stroke SVG paths, not emoji. Emoji render as a different
 *    typeface on every platform and read as informal — the opposite of the
 *    signal a reference directory wants.
 *
 * 2. There is no per-category colour. Eight categories previously carried eight
 *    hues, which spent the palette on a distinction that does not need colour:
 *    the label already says which category it is. Colour is reserved for state
 *    (pricing model), where it actually encodes something.
 */

export type CategoryName =
  | 'CI/CD'
  | 'Code Assistant'
  | 'Monitoring'
  | 'Testing'
  | 'Security'
  | 'IaC'
  | 'AI Code Review'
  | 'AIOps';

export interface CategoryMeta {
  /** URL segment under /category/ */
  slug: string;
  /** Inner markup for a 24x24 SVG with stroke="currentColor" */
  icon: string;
  /** One line used as the category card's supporting text */
  blurb: string;
}

const s = (d: string) => `<path d="${d}" />`;

export const CATEGORIES: Record<CategoryName, CategoryMeta> = {
  'CI/CD': {
    slug: 'ci-cd',
    // circular arrows — a pipeline that runs repeatedly
    icon: s('M21 2v6h-6') + s('M3 12a9 9 0 0 1 15-6.7L21 8') + s('M3 22v-6h6') + s('M21 12a9 9 0 0 1-15 6.7L3 16'),
    blurb: 'Build, test and deploy pipelines',
  },
  'Code Assistant': {
    slug: 'code-assistant',
    // angle brackets with a caret
    icon: s('m18 16 4-4-4-4') + s('m6 8-4 4 4 4') + s('m14.5 4-5 16'),
    blurb: 'Completion, generation and pair programming',
  },
  Monitoring: {
    slug: 'monitoring',
    // waveform on a baseline
    icon: s('M3 12h4l3-9 4 18 3-9h4'),
    blurb: 'Metrics, logs, traces and alerting',
  },
  Testing: {
    slug: 'testing',
    // flask
    icon: s('M9 2v6.5L3.8 17A2 2 0 0 0 5.5 20h13a2 2 0 0 0 1.7-3L15 8.5V2') + s('M8 2h8') + s('M6.5 15h11'),
    blurb: 'Automated, visual and end-to-end testing',
  },
  Security: {
    slug: 'security',
    // shield
    icon: s('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'),
    blurb: 'Scanning, secrets and supply chain',
  },
  IaC: {
    slug: 'iac',
    // stacked layers
    icon: s('m12 2 9 5-9 5-9-5 9-5z') + s('m3 12 9 5 9-5') + s('m3 17 9 5 9-5'),
    blurb: 'Provisioning and infrastructure as code',
  },
  'AI Code Review': {
    slug: 'ai-code-review',
    // document with a check
    icon: s('M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z') + s('M14 2v5h6') + s('m9 14 2 2 4-4'),
    blurb: 'Automated pull request review',
  },
  AIOps: {
    slug: 'aiops',
    // bolt
    icon: s('M13 2 4 14h7l-1 8 9-12h-7l1-8z'),
    blurb: 'Incident response and operational AI',
  },
};

/**
 * Use cases are a separate taxonomy from tool categories, and carried their own
 * emoji in use-cases.json. Keyed by slug so the data file holds content and
 * this file holds presentation.
 */
const USE_CASE_ICONS: Record<string, string> = {
  // downward trend — recovery time falling
  'reduce-mttr': s('M3 6l6 6 4-4 8 8') + s('M21 16v-6h-6'),
  // shield with a check
  'shift-left-security': s('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z') + s('m9 11 2 2 4-4'),
  // two overlapping carets — a pair at the keyboard
  'ai-pair-programming': s('m7 8-4 4 4 4') + s('m14 8 4 4-4 4') + s('M21 4v16'),
  // helm wheel
  'kubernetes-management': s('M12 2v4') + s('m12 18 0 4') + s('M2 12h4') + s('M18 12h4') + s('m4.9 4.9 2.9 2.9') + s('m16.2 16.2 2.9 2.9') + s('m19.1 4.9-2.9 2.9') + s('m7.8 16.2-2.9 2.9'),
  // coin with a downward arrow
  'cloud-cost-optimization': s('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z') + s('M12 7v10') + s('m9 14 3 3 3-3'),
};

export function useCaseIcon(slug: string): string {
  const path = USE_CASE_ICONS[slug];
  if (!path) return '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function categoryMeta(name: string): CategoryMeta | undefined {
  return CATEGORIES[name as CategoryName];
}

export function categorySlug(name: string): string {
  return categoryMeta(name)?.slug ?? '';
}

/** 24x24 stroke icon markup for a category, or an empty string if unknown. */
export function categoryIcon(name: string): string {
  const meta = categoryMeta(name);
  if (!meta) return '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${meta.icon}</svg>`;
}
