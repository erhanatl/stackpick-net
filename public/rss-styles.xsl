<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="/rss/channel/title"/> — RSS</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 768px;
            margin: 0 auto;
            padding: 2rem 1.5rem;
            color: #1e293b;
            background: #ffffff;
            line-height: 1.6;
          }
          .banner {
            background: linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%);
            color: white;
            padding: 1rem 1.25rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            font-size: 0.875rem;
          }
          .banner strong { display: block; margin-bottom: 0.25rem; }
          .banner a { color: #fef9c3; text-decoration: underline; }
          h1 { font-size: 1.875rem; margin: 0 0 0.5rem; color: #0f172a; }
          .description { color: #64748b; margin-bottom: 2rem; }
          .item {
            border-top: 1px solid #e2e8f0;
            padding: 1.5rem 0;
          }
          .item h2 { font-size: 1.25rem; margin: 0 0 0.5rem; }
          .item h2 a { color: #7c3aed; text-decoration: none; }
          .item h2 a:hover { text-decoration: underline; }
          .meta { color: #64748b; font-size: 0.875rem; margin-bottom: 0.5rem; }
          .meta .cat {
            display: inline-block;
            background: #f1f5f9;
            color: #475569;
            padding: 0.125rem 0.5rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            margin-right: 0.25rem;
          }
          .item p { margin: 0; color: #334155; }
        </style>
      </head>
      <body>
        <div class="banner">
          <strong>📡 This is an RSS feed.</strong>
          Subscribe in your favorite reader to get new Stackpick guides automatically.
          Visit <a href="https://stackpick.net/blog/">stackpick.net/blog/</a> to read in the browser.
        </div>
        <h1><xsl:value-of select="/rss/channel/title"/></h1>
        <p class="description"><xsl:value-of select="/rss/channel/description"/></p>
        <xsl:for-each select="/rss/channel/item">
          <div class="item">
            <h2>
              <a hreflang="en" target="_blank">
                <xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute>
                <xsl:value-of select="title"/>
              </a>
            </h2>
            <div class="meta">
              <xsl:for-each select="category">
                <span class="cat"><xsl:value-of select="."/></span>
              </xsl:for-each>
              <xsl:value-of select="substring(pubDate, 1, 16)"/>
            </div>
            <p><xsl:value-of select="description"/></p>
          </div>
        </xsl:for-each>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
