'use server';

import { analyzeContentCompliance, type AnalyzeContentComplianceOutput } from '@/ai/flows/ai-powered-content-compliance';
import { z } from 'zod';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';


const SingleAuditInputSchema = z.object({
  brandGuidelines: z.string().min(1, 'Brand guidelines are required.'),
  url: z.string().url('A valid URL is required.'),
  apiKey: z.string().optional(),
});

const CrawlInputSchema = z.object({
  startUrl: z.string().url('A valid starting URL is required.'),
});

const ScreenshotInputSchema = z.object({
  url: z.string().url(),
  selectors: z.array(z.string()),
});

export type Screenshot = {
    selector: string;
    screenshot: string; // base64
};

export type AuditResult = {
  url: string;
  status: 'success' | 'error' | 'pending';
  data?: AnalyzeContentComplianceOutput;
  screenshots?: Screenshot[];
  error?: string;
};

// A simple regex to find links in HTML
const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/g;

async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    // Return the full HTML to be used for screenshots, text extraction will happen later
    return html;
  } catch (error) {
    console.error(`Error fetching or processing ${url}:`, error);
    if (error instanceof Error) {
        throw new Error(`Could not retrieve content from ${url}: ${error.message}`);
    }
    throw new Error(`An unknown error occurred while fetching ${url}`);
  }
}

function extractTextFromHtml(html: string): string {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
    if (!bodyMatch) {
       return '';
    }

    const text = bodyMatch[1]
      .replace(/<style[^>]*>.*<\/style>/gis, '')
      .replace(/<script[^>]*>.*<\/script>/gis, '')
      .replace(/<nav[^>]*>.*<\/nav>/gis, '')
      .replace(/<footer[^>]*>.*<\/footer>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s\s+/g, ' ')
      .trim();
    
    // Limit content size to avoid hitting model context limits
    return text.substring(0, 15000);
}


export async function crawlLinksForAudit(
  values: z.infer<typeof CrawlInputSchema>
): Promise<{ success: boolean; links?: string[]; error?: string }> {
  const validation = CrawlInputSchema.safeParse(values);
  if (!validation.success) {
    const error = validation.error.errors.map(e => e.message).join(', ');
    return { success: false, error };
  }
  const { startUrl } = validation.data;
  const baseUrl = `${new URL(startUrl).protocol}//${new URL(startUrl).hostname}`;

  try {
    const response = await fetch(startUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch start URL: ${response.statusText}`);
    };
    const html = await response.text();
    const links = new Set<string>();
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const foundUrl = new URL(match[1], baseUrl).href;
      // Only include links from the same domain
      if (foundUrl.startsWith(baseUrl)) {
        // Normalize URL by removing hash and query params
        links.add(foundUrl.split('#')[0].split('?')[0]);
      }
    }
    return { success: true, links: Array.from(links) };
  } catch (error) {
     return { success: false, error: error instanceof Error ? error.message : 'Unknown error during crawling' };
  }
}

export async function runSingleAudit(
  values: z.infer<typeof SingleAuditInputSchema>
): Promise<{ success: boolean; result?: AuditResult; error?: string }> {
  const validation = SingleAuditInputSchema.safeParse(values);

  if (!validation.success) {
    const error = validation.error.errors.map(e => e.message).join(', ');
    return { success: false, error };
  }

  const { brandGuidelines, url, apiKey } = validation.data;

  if (apiKey) {
    process.env.GEMINI_API_KEY = apiKey;
  }
  
  if (!process.env.GEMINI_API_KEY) {
     const error = "Gemini API key is not set. Please provide it.";
     return { success: false, error };
  }

  try {
    const websiteHtml = await fetchWebsiteContent(url);
    if (!websiteHtml) {
      throw new Error('Could not extract meaningful content from URL.');
    }
    
    const websiteContent = extractTextFromHtml(websiteHtml);

    const analysis = await analyzeContentCompliance({
      brandGuidelines,
      websiteContent,
      url,
    });
    
    return { success: true, result: { url, status: 'success', data: analysis } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return { success: false, error: errorMessage, result: { url, status: 'error', error: errorMessage } };
  }
}

export async function takeScreenshots(
    values: z.infer<typeof ScreenshotInputSchema>
): Promise<{ success: boolean, screenshots?: Screenshot[], error?: string }> {
    const validation = ScreenshotInputSchema.safeParse(values);
    if (!validation.success) {
        return { success: false, error: "Invalid input for screenshot action." };
    }

    const { url, selectors } = validation.data;
    if (selectors.length === 0) {
        return { success: true, screenshots: [] };
    }

    let browser = null;
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
        await page.goto(url, { waitUntil: 'networkidle0' });

        const screenshots: Screenshot[] = [];

        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const buffer = await element.screenshot();
                    screenshots.push({
                        selector,
                        screenshot: buffer.toString('base64'),
                    });
                } else {
                    console.warn(`Could not find element for selector "${selector}" on ${url}`);
                }
            } catch (e) {
                console.warn(`Could not take screenshot for selector "${selector}" on ${url}:`, e);
            }
        }
        
        return { success: true, screenshots };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during screenshot capture.';
        console.error("Puppeteer error:", errorMessage);
        return { success: false, error: errorMessage };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
