import type { APIRoute, GetStaticPaths } from 'astro';
import { generateOg } from '../../../lib/og';
import useCases from '../../../data/use-cases.json';

const accentMap: Record<string, string> = {
  amber: '#f59e0b',
  red: '#ef4444',
  violet: '#7c3aed',
  blue: '#3b82f6',
  emerald: '#10b981',
};

export const getStaticPaths: GetStaticPaths = () =>
  useCases.map((uc) => ({
    params: { slug: uc.slug },
    props: { uc },
  }));

export const GET: APIRoute = async ({ props }) => {
  const { uc } = props as { uc: (typeof useCases)[number] };
  const png = await generateOg({
    eyebrow: 'Use Case',
    title: uc.title,
    subtitle: uc.headline,
    accent: accentMap[uc.accentColor] || '#7c3aed',
  });
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
