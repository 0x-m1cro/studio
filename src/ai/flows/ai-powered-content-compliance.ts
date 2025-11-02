'use server';

/**
 * @fileOverview An AI-powered content compliance flow that analyzes website content against brand guidelines.
 *
 * - analyzeContentCompliance - A function that analyzes website content for compliance.
 * - AnalyzeContentComplianceInput - The input type for the analyzeContentCompliance function.
 * - AnalyzeContentComplianceOutput - The return type for the analyzeContentCompliance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeContentComplianceInputSchema = z.object({
  brandGuidelines: z
    .string()
    .describe('The brand guidelines to check the website content against.'),
  websiteContent: z.string().describe('The content of the website to analyze.'),
  url: z.string().describe('The URL of the website being analyzed.'),
});
export type AnalyzeContentComplianceInput = z.infer<
  typeof AnalyzeContentComplianceInputSchema
>;

const AnalyzeContentComplianceOutputSchema = z.object({
  complianceScore: z
    .number()
    .describe(
      'A score indicating the compliance of the website content with the brand guidelines.'
    ),
  flaggedIssues: z
    .array(z.string())
    .describe('A list of issues found in the website content.'),
  suggestedRewrites: z
    .array(z.string())
    .describe('A list of suggested rewrites for the website content.'),
});
export type AnalyzeContentComplianceOutput = z.infer<
  typeof AnalyzeContentComplianceOutputSchema
>;

export async function analyzeContentCompliance(
  input: AnalyzeContentComplianceInput
): Promise<AnalyzeContentComplianceOutput> {
  return analyzeContentComplianceFlow(input);
}

const analyzeContentCompliancePrompt = ai.definePrompt({
  name: 'analyzeContentCompliancePrompt',
  input: {schema: AnalyzeContentComplianceInputSchema},
  output: {schema: AnalyzeContentComplianceOutputSchema},
  prompt: `You are an AI content compliance auditor. Analyze the provided website content against the following brand guidelines. Provide a compliance score, flag any issues, and suggest rewrites to ensure brand consistency and accuracy.

Brand Guidelines:
{{brandGuidelines}}

Website Content:
{{websiteContent}}

URL:
{{url}}`,
});

const analyzeContentComplianceFlow = ai.defineFlow(
  {
    name: 'analyzeContentComplianceFlow',
    inputSchema: AnalyzeContentComplianceInputSchema,
    outputSchema: AnalyzeContentComplianceOutputSchema,
  },
  async input => {
    const {output} = await analyzeContentCompliancePrompt(input);
    return output!;
  }
);
