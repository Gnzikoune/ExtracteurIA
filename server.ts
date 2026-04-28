import express from "express";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import path from "path";
import puppeteer from "puppeteer";
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/extract", async (req, res) => {
    try {
      const { url, deepScan } = req.body;
      if (!url) {
        return res.status(400).json({ error: "L'URL est requise" });
      }

      // Ensure URL has protocol
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
          // Check if it's an XML sitemap
          if (currentUrl.toLowerCase().endsWith('.xml')) {
            const response = await fetch(currentUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
              }
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
                      
                      // If it's a sitemap index and deepScan is on, queue the sub-sitemaps
                      if (deepScan && resolvedUrl.toLowerCase().endsWith('.xml') && !isExternal) {
                        const nextUrlStr = resolvedUrl.replace(/\/$/, '');
                        if (!visited.has(nextUrlStr) && !queue.some(q => q.replace(/\/$/, '') === nextUrlStr)) {
                          queue.push(resolvedUrl);
                        }
                      }
                    }
                  } catch (e) {
                    // Ignore invalid URLs
                  }
                }
              });
            }
            continue; // Skip HTML processing for XML files
          }

          let html = '';
          
          try {
            // 1. Tentative d'extraction avec Puppeteer (Headless Browser)
            // Permet d'exécuter le JavaScript (React, Vue, etc.) et de contourner certaines protections
            const browser = await puppeteer.launch({
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            
            // Optimisation : bloquer les ressources inutiles pour accélérer le chargement
            await page.setRequestInterception(true);
            page.on('request', (req) => {
              if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
              } else {
                req.continue();
              }
            });

            await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 15000 });
            html = await page.content();
            await browser.close();
          } catch (puppeteerError) {
            console.warn(`Puppeteer a échoué pour ${currentUrl}, utilisation de fetch en secours:`, puppeteerError);
            
            // 2. Fallback sur fetch classique si Puppeteer échoue (ex: dépendances manquantes)
            const response = await fetch(currentUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
              }
            });

            if (!response.ok) {
              if (pagesCrawled === 1) {
                return res.status(response.status).json({ error: `Échec de la récupération de l'URL: ${response.statusText}` });
              }
              continue;
            }

            const contentType = response.headers.get('content-type');
            if (contentType && !contentType.includes('text/html')) {
              continue;
            }

            html = await response.text();
          }

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

            if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('#')) {
              try {
                const resolvedUrlObj = new URL(href, currentUrl);
                resolvedUrlObj.hash = '';
                const resolvedUrl = resolvedUrlObj.href;
                const isExternal = resolvedUrlObj.hostname !== baseUrl.hostname;
                
                if (!links.some(l => l.href === resolvedUrl)) {
                  links.push({ text, href: resolvedUrl, isExternal });
                  
                  if (deepScan && !isExternal) {
                    const nextUrlStr = resolvedUrl.replace(/\/$/, '');
                    if (!visited.has(nextUrlStr) && !queue.some(q => q.replace(/\/$/, '') === nextUrlStr)) {
                      if (!resolvedUrl.match(/\.(jpg|jpeg|png|gif|pdf|css|js|zip|mp4|svg|ico)$/i)) {
                        queue.push(resolvedUrl);
                      }
                    }
                  }
                }
              } catch (e) {
                // Ignore invalid URLs
              }
            }
          });
        } catch (error) {
          console.error(`Error fetching ${currentUrl}:`, error);
          if (pagesCrawled === 1) {
            throw error;
          }
        }
      }

      res.json({ title: pageTitle, description: pageDescription, links, pagesCrawled });
    } catch (error: any) {
      console.error("Extraction error:", error);
      
      let friendlyMessage = "Échec de l'extraction des liens";
      const errorStr = error.toString();
      const code = error.code || (error.cause && error.cause.code);

      if (errorStr.includes('Timeout') || code === 'UND_ERR_CONNECT_TIMEOUT') {
        friendlyMessage = "Le site met trop de temps à répondre ou est inaccessible (Timeout).";
      } else if (code === 'ENOTFOUND') {
        friendlyMessage = "L'adresse du site est introuvable. Vérifiez l'orthographe de l'URL.";
      } else if (code === 'ECONNREFUSED') {
        friendlyMessage = "La connexion a été refusée par le site. Il bloque peut-être les robots.";
      } else if (errorStr.includes('fetch failed')) {
        friendlyMessage = "Impossible de se connecter au site. Il est peut-être hors-ligne ou protégé.";
      } else {
        friendlyMessage = error.message || friendlyMessage;
      }

      res.status(500).json({ error: friendlyMessage });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { url, pageData, geminiApiKey } = req.body;
      if (!pageData || !pageData.links) {
        return res.status(400).json({ error: "Les données de la page sont requises" });
      }

      // Utilise la clé API définie dans le serveur, ou celle fournie par la config Firebase du frontend
      const apiKey = process.env.GEMINI_API_KEY || geminiApiKey;
      if (!apiKey) {
        return res.status(500).json({ error: "La clé API Gemini n'est pas configurée" });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        Analyze the following webpage and its extracted links to provide a business conversion diagnostic.
        URL: ${url}
        Title: ${pageData.title}
        Description: ${pageData.description}
        
        Total Links: ${pageData.links.length}
        Links Data:
        ${JSON.stringify(pageData.links.slice(0, 800).map((l: any, index: number) => ({ id: index, text: l.text, href: l.href })))}
        
        Please provide a comprehensive business diagnostic of this webpage based on its metadata and links:
        
        1. "score_global": A score out of 100 representing the overall conversion potential.
        2. "main_message": A single, impactful sentence summarizing the main issue or opportunity (e.g., "⚠️ Votre site présente plusieurs points qui peuvent vous faire perdre des clients"). (IN FRENCH)
        3. "scores": Provide sub-scores out of 100 for "structure", "conversion", and "presence" (digital presence).
        4. "problems": Identify 3 to 5 main business weaknesses based on the links (e.g., missing booking page, confusing navigation). For each, provide a "title" (the problem) and "impact" (the business consequence, e.g., "Vous perdez des clients prêts à passer à l'action"). (IN FRENCH)
        5. "opportunities": Provide 2 to 4 concrete, actionable improvements. (IN FRENCH)
        6. "business_type": Guess the type of business (e.g., "restaurant", "e-commerce", "blog", "agence", "inconnu"). (IN FRENCH)
        7. "categories": Categorize ALL the provided links into meaningful groups (e.g., "Navigation du site", "Réseaux Sociaux", "Articles", "Ressources Externes", etc.). 
           IMPORTANT: To save space, return the "id" of each link in the corresponding category array. EVERY single link id from 0 to ${Math.min(pageData.links.length, 800) - 1} MUST be placed in exactly one category. (IN FRENCH)
        
        Return the response strictly as a JSON object with this structure:
        {
          "score_global": 62,
          "main_message": "...",
          "scores": { "structure": 70, "conversion": 40, "presence": 75 },
          "problems": [ { "title": "...", "impact": "..." } ],
          "opportunities": [ "..." ],
          "business_type": "restaurant",
          "categories": { "Navigation": [0, 1], "Réseaux": [2] }
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        res.json(JSON.parse(response.text));
      } else {
        throw new Error('Aucune réponse de Gemini');
      }
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de l'analyse IA" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
