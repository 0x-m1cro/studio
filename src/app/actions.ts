'use server';

import { analyzeContentCompliance, type AnalyzeContentComplianceOutput } from '@/ai/flows/ai-powered-content-compliance';
import { z } from 'zod';

const AuditInputSchema = z.object({
  brandGuidelines: z.string().min(1, 'Brand guidelines are required.'),
  urls: z.string().min(1, 'At least one URL is required.'),
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
    const text = html
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

export async function runAudits(values: z.infer<typeof AuditInputSchema>): Promise<{ success: boolean; results?: AuditResult[]; error?: string }> {
  const validation = AuditInputSchema.safeParse(values);

  if (!validation.success) {
    return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
  }

  const { brandGuidelines, urls } = validation.data;
  const urlList = urls.split(/[\s,]+/).filter(Boolean).map(url => {
    try {
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        return new URL(fullUrl).toString();
    } catch {
        return null;
    }
  }).filter(Boolean) as string[];

  if (urlList.length === 0) {
    return { success: false, error: "Please provide at least one valid URL." };
  }

  const auditPromises = urlList.map(async (url): Promise<AuditResult> => {
    try {
      const websiteContent = await fetchWebsiteContent(url);
      if (!websiteContent) {
        throw new Error('Could not extract meaningful content from URL.');
      }

      const analysis = await analyzeContentCompliance({
        brandGuidelines,
        websiteContent,
        url,
      });

      return { url, status: 'success' as const, data: analysis };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return { url, status: 'error' as const, error: errorMessage };
    }
  });

  const results = await Promise.all(auditPromises);

  return { success: true, results };
}
