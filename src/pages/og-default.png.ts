import type { APIRoute } from 'astro';
import { generateOg } from '../lib/og';

// Static default OG image for homepage and any page without a specific OG PNG.
// Replaces the old og-default.svg so og:image:type=image/png is always accurate.
export const GET: APIRoute = async () => {
  const png = await generateOg({
    eyebrow: 'AI Tools for DevOps',
    title: 'Find the Best AI Tools for Your Stack',
    subtitle: 'Compare, review, and pick the right tools — independent, unbiased, unsponsored.',
  });
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
