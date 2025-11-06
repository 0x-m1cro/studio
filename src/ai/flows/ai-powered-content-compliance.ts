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

const AuditItemSchema = z.object({
  text: z.string().describe('The text of the flagged issue, suggestion, or recommendation.'),
  selector: z.string().optional().describe('A CSS selector for the HTML element related to this item. This selector should be as specific and stable as possible.'),
});


const AnalyzeContentComplianceOutputSchema = z.object({
  complianceScore: z
    .number()
    .describe(
      'A score from 0-100 indicating the compliance of the website content with the brand guidelines.'
    ),
  flaggedIssues: z
    .array(AuditItemSchema)
    .describe('A list of specific snippets or phrases that violate the brand guidelines. For each, provide a CSS selector if a specific element is associated with it.'),
  suggestedRewrites: z
    .array(AuditItemSchema)
    .describe('A list of suggested rewrites for the flagged issues. For each, provide a CSS selector if a specific element is associated with it.'),
  recommendations: z
    .array(AuditItemSchema)
    .describe(
      'A list of high-level strategic recommendations to improve overall brand alignment, tailored to the specific content and purpose of the page. For each, provide a CSS selector if a specific element is associated with it.'
    ),
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
  prompt: `You are an expert brand strategist and copywriter. Your task is to analyze the provided website content against a brand's guidelines and provide a detailed, page-specific audit. For each issue, suggestion, or recommendation, you MUST provide a precise CSS selector for the most relevant HTML element if one can be identified.

You must perform the following actions:
1.  **Score Compliance:** Provide a compliance score from 0 to 100. A score of 100 means perfect compliance. A score of 0 means total non-compliance.
2.  **Flag Issues:** Identify and list specific phrases, sentences, or sections from the website content that directly violate the brand guidelines. For each, provide a specific CSS selector for the element containing the violation.
3.  **Suggest Rewrites:** For each flagged issue, provide a concrete, rewritten alternative that aligns with the guidelines. Include the same CSS selector as the original issue.
4.  **Give Strategic Recommendations:** Provide a list of 2-3 high-level, strategic recommendations for improving the content's alignment with the brand. These recommendations must be page-specific and contextual. For each, identify the most relevant element on the page and provide its CSS selector. For example, instead of a generic suggestion like "use the brand name more," offer a recommendation like, "On this 'Offers' page, weave in the brand's ethos of 'affordable luxury' into the promotion descriptions to better attract the target audience," and provide the selector for the main promotions container.

Here is the data for your analysis:

Brand Guidelines:
'''
{{brandGuidelines}}
'''

Website Content to Analyze (from {{url}}):
'''
{{websiteContent}}
'''`,
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
