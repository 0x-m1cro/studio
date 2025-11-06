'use server';

import { analyzeContentCompliance, type AnalyzeContentComplianceOutput } from '@/ai/flows/ai-powered-content-compliance';
import { z } from 'zod';

const AuditInputSchema = z.object({
  brandGuidelines: z.string().min(1, 'Brand guidelines are required.'),
  urls: z.string().min(1, 'At least one URL is required.'),
  apiKey: z.string().optional(),
});

export type AuditResult = {
  url: string;
  status: 'success' | 'error';
  data?: AnalyzeContentComplianceOutput;
  error?: string;
};

// In a real-world application, this would be a sophisticated crawler
// that can handle SPAs, extract meaningful content, and be more robust.
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
  values: z.infer<typeof AuditInputSchema>,
  logCallback: (log: string) => void
): Promise<{ success: boolean; results?: AuditResult[]; error?: string }> {
  const validation = AuditInputSchema.safeParse(values);

  if (!validation.success) {
    const error = validation.error.errors.map(e => e.message).join(', ');
    logCallback(`Validation error: ${error}`);
    return { success: false, error };
  }

  const { brandGuidelines, urls, apiKey } = validation.data;

  if (apiKey) {
    process.env.GEMINI_API_KEY = apiKey;
  }
  
  if (!process.env.GEMINI_API_KEY) {
     const error = "Gemini API key is not set. Please provide it.";
     logCallback(`API Key error: ${error}`);
     return { success: false, error };
  }

  const urlList = urls.split(/[\s,]+/).filter(Boolean).map(url => {
    try {
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        return new URL(fullUrl).toString();
    } catch {
        return null;
    }
  }).filter(Boolean) as string[];

  if (urlList.length === 0) {
    const error = "Please provide at least one valid URL.";
    logCallback(`URL error: ${error}`);
    return { success: false, error };
  }
  
  logCallback(`Starting audit for ${urlList.length} URL(s)...`);

  const results: AuditResult[] = [];
  for (const url of urlList) {
    try {
      logCallback(`[${url}]: Fetching content...`);
      const websiteContent = await fetchWebsiteContent(url);
      if (!websiteContent) {
        throw new Error('Could not extract meaningful content from URL.');
      }
      logCallback(`[${url}]: Content fetched successfully. Analyzing...`);

      const analysis = await analyzeContentCompliance({
        brandGuidelines,
        websiteContent,
        url,
      });
      logCallback(`[${url}]: Analysis complete. Score: ${analysis.complianceScore}%`);
      results.push({ url, status: 'success' as const, data: analysis });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logCallback(`[${url}]: Error - ${errorMessage}`);
      results.push({ url, status: 'error' as const, error: errorMessage });
    }
  }

  return { success: true, results };
}
