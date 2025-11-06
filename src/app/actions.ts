'use server';

import { analyzeContentCompliance, type AnalyzeContentComplianceOutput } from '@/ai/flows/ai-powered-content-compliance';
import { z } from 'zod';

const AuditInputSchema = z.object({
  brandGuidelines: z.string().min(1, 'Brand guidelines are required.'),
  urls: z.string().min(1, 'At least one URL is required.'),
  apiKey: z.string().optional(),
  autoDiscover: z.boolean().optional(),
});

export type AuditResult = {
  url: string;
  status: 'success' | 'error';
  data?: AnalyzeContentComplianceOutput;
  error?: string;
};

// A simple regex to find links in HTML
const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/g;

async function crawlLinks(url: string, baseUrl: string, logs: string[]): Promise<string[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const html = await response.text();
    const links = new Set<string>();
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const foundUrl = new URL(match[1], baseUrl).href;
      if (foundUrl.startsWith(baseUrl)) {
        links.add(foundUrl.split('#')[0].split('?')[0]);
      }
    }
    return Array.from(links);
  } catch (error) {
    logs.push(`[${url}]: Failed to crawl for links: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

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
    // A very basic way to extract text. This will not work well for complex sites.
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
  } catch (error) {
    console.error(`Error fetching or processing ${url}:`, error);
    if (error instanceof Error) {
        throw new Error(`Could not retrieve content from ${url}: ${error.message}`);
    }
    throw new Error(`An unknown error occurred while fetching ${url}`);
  }
}

export async function runAudits(
  values: z.infer<typeof AuditInputSchema>
): Promise<{ success: boolean; results?: AuditResult[]; error?: string; logs: string[] }> {
  const logs: string[] = [];
  const validation = AuditInputSchema.safeParse(values);

  if (!validation.success) {
    const error = validation.error.errors.map(e => e.message).join(', ');
    logs.push(`Validation error: ${error}`);
    return { success: false, error, logs };
  }

  const { brandGuidelines, urls, apiKey, autoDiscover } = validation.data;

  if (apiKey) {
    process.env.GEMINI_API_KEY = apiKey;
  }
  
  if (!process.env.GEMINI_API_KEY) {
     const error = "Gemini API key is not set. Please provide it.";
     logs.push(`API Key error: ${error}`);
     return { success: false, error, logs };
  }

  let urlList = urls.split(/[\s,]+/).filter(Boolean).map(url => {
    try {
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        return new URL(fullUrl).toString();
    } catch {
        return null;
    }
  }).filter(Boolean) as string[];

  if (urlList.length === 0) {
    const error = "Please provide at least one valid URL.";
    logs.push(`URL error: ${error}`);
    return { success: false, error, logs };
  }
  
  if (autoDiscover) {
    const firstUrl = new URL(urlList[0]);
    const baseUrl = `${firstUrl.protocol}//${firstUrl.hostname}`;
    logs.push(`Auto-discovery enabled. Crawling from ${baseUrl}...`);
    const discoveredLinks = await crawlLinks(urlList[0], baseUrl, logs);
    const allLinks = new Set([...urlList, ...discoveredLinks]);
    urlList = Array.from(allLinks);
    logs.push(`Discovered ${discoveredLinks.length} new links. Total URLs to audit: ${urlList.length}.`);
  }

  logs.push(`Starting audit for ${urlList.length} URL(s)...`);

  const results: AuditResult[] = [];
  for (const url of urlList) {
    try {
      logs.push(`[${url}]: Fetching content...`);
      const websiteContent = await fetchWebsiteContent(url);
      if (!websiteContent) {
        throw new Error('Could not extract meaningful content from URL.');
      }
      logs.push(`[${url}]: Content fetched successfully. Analyzing...`);

      const analysis = await analyzeContentCompliance({
        brandGuidelines,
        websiteContent,
        url,
      });
      logs.push(`[${url}]: Analysis complete. Score: ${analysis.complianceScore}%`);
      results.push({ url, status: 'success' as const, data: analysis });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logs.push(`[${url}]: Error - ${errorMessage}`);
      results.push({ url, status: 'error' as const, error: errorMessage });
    }
  }

  return { success: true, results, logs };
}
