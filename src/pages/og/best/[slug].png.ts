import type { APIRoute, GetStaticPaths } from 'astro';
import { generateOg } from '../../../lib/og';
import hubPages from '../../../data/hub-pages.json';

export const getStaticPaths: GetStaticPaths = () =>
  hubPages.map((hub) => ({
    params: { slug: hub.slug },
    props: { hub },
  }));

export const GET: APIRoute = async ({ props }) => {
  const { hub } = props as { hub: (typeof hubPages)[number] };
  const png = await generateOg({
    eyebrow: 'Best Tools',
    title: hub.title,
    subtitle: hub.description,
    category: hub.category,
  });
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
