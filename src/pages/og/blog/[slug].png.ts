import type { APIRoute, GetStaticPaths } from 'astro';
import { generateOg } from '../../../lib/og';
import guides from '../../../data/guides.json';

export const getStaticPaths: GetStaticPaths = () =>
  guides.map((g) => ({
    params: { slug: g.slug },
    props: { guide: g },
  }));

export const GET: APIRoute = async ({ props }) => {
  const { guide } = props as { guide: (typeof guides)[number] };
  const png = await generateOg({
    eyebrow: guide.type === 'best-tools' ? 'Best Tools Guide' : 'Buyer\'s Guide',
    title: guide.title,
    subtitle: guide.description,
    category: guide.category,
  });
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
