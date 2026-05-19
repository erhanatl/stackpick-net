import type { APIRoute, GetStaticPaths } from 'astro';
import { generateOg } from '../../../lib/og';
import comparisons from '../../../data/comparisons.json';

export const getStaticPaths: GetStaticPaths = () =>
  comparisons.map((c) => ({
    params: { slug: c.slug },
    props: { comp: c },
  }));

export const GET: APIRoute = async ({ props }) => {
  const { comp } = props as { comp: (typeof comparisons)[number] };
  const isThreeWay = comp.tools.length === 3;
  const png = await generateOg({
    eyebrow: isThreeWay ? '3-Way Comparison' : 'Head-to-Head',
    title: comp.title,
    subtitle: comp.description,
  });
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
