// OG image generator using satori + resvg.
// Renders 1200x630 PNG branded for Stackpick.

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';

// Load Inter fonts shipped via @fontsource/inter (WOFF, supported by satori).
const fontsDir = path.resolve(process.cwd(), 'node_modules/@fontsource/inter/files');

// Load fonts once and cache
let fontsCache: { name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[] | null = null;
function loadFonts() {
  if (fontsCache) return fontsCache;
  fontsCache = [
    {
      name: 'Inter',
      data: fs.readFileSync(path.join(fontsDir, 'inter-latin-400-normal.woff')),
      weight: 400 as const,
      style: 'normal' as const,
    },
    {
      name: 'Inter',
      data: fs.readFileSync(path.join(fontsDir, 'inter-latin-700-normal.woff')),
      weight: 700 as const,
      style: 'normal' as const,
    },
  ];
  return fontsCache;
}

export interface OgParams {
  /** Big headline text — page title */
  title: string;
  /** Small label above headline — e.g., "Comparison", "Tool Review", "Best Tools" */
  eyebrow?: string;
  /** Tagline below headline */
  subtitle?: string;
  /** Optional category label shown as a pill */
  category?: string;
  /** Accent color for the eyebrow/badge — defaults to brand violet */
  accent?: string;
}

const BRAND_VIOLET = '#7c3aed';
const BRAND_CYAN = '#06b6d4';
const DARK_BG = '#0f172a';
const DARK_INDIGO = '#1e1b4b';

// Build a satori-compatible element tree (no JSX).
// Satori requires every <div> with more than one child to declare
// display: flex (or contents/none). We default to flex unless overridden.
function el(type: string, props: Record<string, unknown>, ...children: unknown[]) {
  const propsAny = props as { style?: Record<string, unknown> };
  let style = propsAny.style || {};
  if (type === 'div' && !style.display) {
    style = { display: 'flex', ...style };
  }
  return {
    type,
    props: {
      ...props,
      style,
      children: children.length === 1 ? children[0] : children,
    },
  };
}

export async function generateOg(params: OgParams): Promise<Buffer> {
  const accent = params.accent || BRAND_VIOLET;

  // Truncate title to avoid layout breaking
  const title = params.title.length > 90 ? params.title.slice(0, 87) + '…' : params.title;
  const subtitle = params.subtitle && params.subtitle.length > 140
    ? params.subtitle.slice(0, 137) + '…'
    : params.subtitle;

  // Build secondary rows
  const eyebrowAndCategory = [];
  if (params.eyebrow) {
    eyebrowAndCategory.push(
      el(
        'div',
        {
          style: {
            display: 'flex',
            fontSize: '20px',
            fontWeight: 700,
            color: accent,
            textTransform: 'uppercase',
            letterSpacing: '2px',
          },
        },
        params.eyebrow
      )
    );
  }
  if (params.category) {
    eyebrowAndCategory.push(
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            padding: '6px 16px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            fontSize: '18px',
            color: '#cbd5e1',
          },
        },
        params.category
      )
    );
  }

  const middleChildren = [];
  if (eyebrowAndCategory.length > 0) {
    middleChildren.push(
      el(
        'div',
        {
          style: { display: 'flex', alignItems: 'center', gap: '16px' },
        },
        ...eyebrowAndCategory
      )
    );
  }
  middleChildren.push(
    el(
      'div',
      {
        style: {
          display: 'flex',
          fontSize: title.length > 60 ? '56px' : '72px',
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        },
      },
      title
    )
  );
  if (subtitle) {
    middleChildren.push(
      el(
        'div',
        {
          style: {
            display: 'flex',
            fontSize: '24px',
            color: '#94a3b8',
            lineHeight: 1.4,
          },
        },
        subtitle
      )
    );
  }

  const tree = el(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        background: `linear-gradient(135deg, ${DARK_BG} 0%, ${DARK_INDIGO} 50%, ${DARK_BG} 100%)`,
        fontFamily: 'Inter',
        color: 'white',
      },
    },
    // Top: brand row
    el(
      'div',
      {
        style: { display: 'flex', alignItems: 'center', gap: '16px' },
      },
      el(
        'div',
        {
          style: {
            display: 'flex',
            fontSize: '36px',
            fontWeight: 700,
            color: '#ffffff',
          },
        },
        'Stackpick'
      ),
      el('div', {
        style: {
          width: '10px',
          height: '10px',
          borderRadius: '5px',
          background: BRAND_CYAN,
        },
      })
    ),
    // Middle: content stack
    el(
      'div',
      {
        style: { display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1056px' },
      },
      ...middleChildren
    ),
    // Bottom: tagline + URL
    el(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '20px',
          color: '#64748b',
        },
      },
      el('div', { style: { display: 'flex' } }, 'Independent. Unbiased. Unsponsored.'),
      el('div', { style: { display: 'flex', color: '#94a3b8' } }, 'stackpick.net')
    )
  );

  const svg = await satori(tree as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: loadFonts(),
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  return resvg.render().asPng();
}
