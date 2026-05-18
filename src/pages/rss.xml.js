import rss from '@astrojs/rss';
import guides from '../data/guides.json';

const SITE_URL = 'https://stackpick.net';

export async function GET(context) {
  // Sort newest first
  const sortedGuides = [...guides].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return rss({
    title: 'Stackpick — AI DevOps Tools Blog & Guides',
    description:
      'In-depth guides, comparisons, and buyer\'s lists for the best AI-powered DevOps tools. Independent, unbiased, unsponsored.',
    site: context.site || SITE_URL,
    items: sortedGuides.map((guide) => ({
      title: guide.title,
      description: guide.description,
      pubDate: new Date(guide.date),
      link: `/blog/${guide.slug}/`,
      categories: [guide.category, guide.type].filter(Boolean),
    })),
    customData: `<language>en-us</language><copyright>© ${new Date().getFullYear()} Stackpick</copyright>`,
    stylesheet: '/rss-styles.xsl',
  });
}
