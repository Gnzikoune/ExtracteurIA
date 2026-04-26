import * as cheerio from 'cheerio';

export const config = {
  maxDuration: 60, // seconds (requires Vercel Pro for > 10s, but declare it anyway)
};

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, deepScan } = req.body;
    if (!url) {
      return res.status(400).json({ error: "L'URL est requise" });
    }

    let targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'http://' + targetUrl;
    }

    const baseUrl = new URL(targetUrl);
    const links: { text: string; href: string; isExternal: boolean }[] = [];
    const visited = new Set<string>();
    const queue = [targetUrl];
    const maxPages = deepScan ? 15 : 1;
    let pagesCrawled = 0;
    let pageTitle = '';
    let pageDescription = '';

    while (queue.length > 0 && pagesCrawled < maxPages) {
      const currentUrl = queue.shift()!;

      const normalizedUrl = new URL(currentUrl);
      normalizedUrl.hash = '';
      const urlStr = normalizedUrl.href.replace(/\/$/, '');

      if (visited.has(urlStr)) continue;
      visited.add(urlStr);
      pagesCrawled++;

      try {
        // Handle XML sitemaps
        if (currentUrl.toLowerCase().endsWith('.xml')) {
          const response = await fetch(currentUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ExtracteurIA/1.0)' },
            signal: AbortSignal.timeout(10000),
          });

          if (response.ok) {
            const xmlText = await response.text();
            const $ = cheerio.load(xmlText, { xmlMode: true });

            if (pagesCrawled === 1) {
              pageTitle = 'Sitemap XML';
              pageDescription = `Extraction des liens depuis le sitemap: ${currentUrl}`;
            }

            $('loc').each((_, element) => {
              const href = $(element).text().trim();
              if (href) {
                try {
                  const resolvedUrlObj = new URL(href, currentUrl);
                  resolvedUrlObj.hash = '';
                  const resolvedUrl = resolvedUrlObj.href;
                  const isExternal = resolvedUrlObj.hostname !== baseUrl.hostname;

                  if (!links.some(l => l.href === resolvedUrl)) {
                    links.push({ text: resolvedUrl, href: resolvedUrl, isExternal });

                    if (deepScan && resolvedUrl.toLowerCase().endsWith('.xml') && !isExternal) {
                      const nextUrlStr = resolvedUrl.replace(/\/$/, '');
                      if (!visited.has(nextUrlStr) && !queue.some(q => q.replace(/\/$/, '') === nextUrlStr)) {
                        queue.push(resolvedUrl);
                      }
                    }
                  }
                } catch (e) { /* ignore invalid URLs */ }
              }
            });
          }
          continue;
        }

        // Fetch HTML page
        const response = await fetch(currentUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          if (pagesCrawled === 1) {
            return res.status(response.status).json({
              error: `Échec de la récupération de l'URL: ${response.statusText}`,
            });
          }
          continue;
        }

        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('text/html')) {
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        if (pagesCrawled === 1) {
          pageTitle = $('title').text() || targetUrl;
          pageDescription = $('meta[name="description"]').attr('content') || '';
        }

        $('a').each((_, element) => {
          const href = $(element).attr('href');
          let text = $(element).text().trim().replace(/\s+/g, ' ');

          if (!text) {
            text = $(element).find('img').attr('alt') || 'Lien sans texte';
          }

          if (
            href &&
            !href.startsWith('javascript:') &&
            !href.startsWith('mailto:') &&
            !href.startsWith('tel:') &&
            !href.startsWith('#')
          ) {
            try {
              const resolvedUrlObj = new URL(href, currentUrl);
              resolvedUrlObj.hash = '';
              const resolvedUrl = resolvedUrlObj.href;
              const isExternal = resolvedUrlObj.hostname !== baseUrl.hostname;

              if (!links.some(l => l.href === resolvedUrl)) {
                links.push({ text, href: resolvedUrl, isExternal });

                if (deepScan && !isExternal) {
                  const nextUrlStr = resolvedUrl.replace(/\/$/, '');
                  if (
                    !visited.has(nextUrlStr) &&
                    !queue.some(q => q.replace(/\/$/, '') === nextUrlStr)
                  ) {
                    if (!resolvedUrl.match(/\.(jpg|jpeg|png|gif|pdf|css|js|zip|mp4|svg|ico)$/i)) {
                      queue.push(resolvedUrl);
                    }
                  }
                }
              }
            } catch (e) { /* ignore invalid URLs */ }
          }
        });
      } catch (error) {
        console.error(`Error fetching ${currentUrl}:`, error);
        if (pagesCrawled === 1) throw error;
      }
    }

    return res.json({ title: pageTitle, description: pageDescription, links, pagesCrawled });
  } catch (error: any) {
    console.error('Extraction error:', error);
    return res.status(500).json({ error: error.message || "Échec de l'extraction des liens" });
  }
}
