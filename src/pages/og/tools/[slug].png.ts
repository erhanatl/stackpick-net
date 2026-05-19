import type { APIRoute, GetStaticPaths } from 'astro';
import { generateOg } from '../../../lib/og';
import tools from '../../../data/tools.json';

export const getStaticPaths: GetStaticPaths = () =>
  tools
    .filter((t) => t.status === 'Published')
    .map((tool) => ({
      params: { slug: tool.slug },
      props: { tool },
    }));

export const GET: APIRoute = async ({ props }) => {
  const { tool } = props as { tool: (typeof tools)[number] };
  const png = await generateOg({
    eyebrow: 'Tool Review',
    title: tool.tool_name,
    subtitle: tool.short_description,
    category: tool.category,
  });
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
