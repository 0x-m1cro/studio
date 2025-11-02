'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { FileText, Rocket, Upload } from 'lucide-react';
import { Logo } from '@/components/logo';
import { AuditResults } from '@/components/audit-results';
import { runAudits, type AuditResult } from './actions';
import * as pdfjs from 'pdfjs-dist';

// Required for pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type AuditState = {
  isLoading: boolean;
  results: AuditResult[];
  error: string | null;
};

export default function ContentQaPage() {
  const [brandGuidelines, setBrandGuidelines] = React.useState('');
  const [tempGuidelines, setTempGuidelines] = React.useState('');
  const [urls, setUrls] = React.useState('');
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [auditState, setAuditState] = React.useState<AuditState>({
    isLoading: false,
    results: [],
    error: null,
  });
  const { toast } = useToast();

  React.useEffect(() => {
    setTempGuidelines(brandGuidelines);
  }, [brandGuidelines, isDrawerOpen]);

  const handleRunAudit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!brandGuidelines) {
      toast({
        variant: 'destructive',
        title: 'Missing Brand Guidelines',
        description: 'Please define your brand guidelines before running an audit.',
      });
      setIsDrawerOpen(true);
      return;
    }
    if (!urls.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing URLs',
        description: 'Please enter at least one URL to audit.',
      });
      return;
    }

    setAuditState({ isLoading: true, results: [], error: null });

    const response = await runAudits({ brandGuidelines, urls });

    if (response.success && response.results) {
      setAuditState({ isLoading: false, results: response.results, error: null });
      toast({
        title: 'Audit Complete',
        description: `Analyzed ${response.results.length} URLs.`,
      });
    } else {
      setAuditState({ isLoading: false, results: [], error: response.error || 'An unexpected error occurred.' });
      toast({
        variant: 'destructive',
        title: 'Audit Failed',
        description: response.error || 'An unexpected error occurred.',
      });
    }
  };
  
  const handleSaveGuidelines = () => {
    setBrandGuidelines(tempGuidelines);
    setIsDrawerOpen(false);
    toast({
      title: 'Guidelines Saved',
      description: 'Your brand guidelines have been updated.',
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type === 'text/plain') {
      const text = await file.text();
      setTempGuidelines(text);
      toast({
        title: 'File Content Loaded',
        description: 'The content of the .txt file has been loaded into the guidelines.',
      });
    } else if (file.type === 'application/pdf') {
       try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument(arrayBuffer).promise;
        const numPages = pdf.numPages;
        let pdfText = '';

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          pdfText += textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
        }
        
        setTempGuidelines(pdfText);
        toast({
          title: 'PDF Content Extracted',
          description: 'The text content of the PDF has been loaded into the guidelines.',
        });
      } catch (error) {
        console.error('Error parsing PDF:', error);
        toast({
          variant: 'destructive',
          title: 'PDF Parsing Failed',
          description: error instanceof Error ? error.message : 'Could not parse the PDF file.',
        });
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Unsupported File Type',
        description: 'Please upload a .txt or .pdf file.',
      });
    }
     // Reset file input
    event.target.value = '';
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-card">
        <div className="container flex items-center justify-between h-16 px-4 mx-auto sm:px-6 lg:px-8">
          <Logo />
          <Button variant="outline" onClick={() => setIsDrawerOpen(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Brand Guidelines
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <div className="container py-8 mx-auto">
          <div className="grid gap-8">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">Start a New Audit</CardTitle>
                <CardDescription>Enter the URLs you want to audit against your brand guidelines.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRunAudit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="urls">URLs to Audit</Label>
                    <Textarea
                      id="urls"
                      placeholder="https://example.com&#10;https://another-example.com/about&#10;..."
                      className="min-h-[120px] font-code"
                      value={urls}
                      onChange={(e) => setUrls(e.target.value)}
                      disabled={auditState.isLoading}
                    />
                    <p className="text-sm text-muted-foreground">Enter one URL per line or separate them with commas.</p>
                  </div>
                  <Button type="submit" disabled={auditState.isLoading}>
                    <Rocket className="w-4 h-4 mr-2" />
                    {auditState.isLoading ? 'Auditing...' : 'Run Audit'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <AuditResults
              isLoading={auditState.isLoading}
              results={auditState.results}
              error={auditState.error}
            />
          </div>
        </div>
      </main>

      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-2xl w-full">
          <SheetHeader>
            <SheetTitle className="text-2xl">Brand Guidelines</SheetTitle>
            <SheetDescription>
              Provide your brand guidelines here. You can either type them in, or upload a .txt or .pdf file. The AI will use this as a source of truth for its content audit. Be as detailed as possible.
            </SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-4">
             <div>
                <Label htmlFor="guideline-file" className="mb-2 block">Upload File (TXT, PDF)</Label>
                <div className="relative">
                    <Input
                        id="guideline-file"
                        type="file"
                        accept=".txt,.pdf"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleFileChange}
                    />
                    <Button variant="outline" asChild className="cursor-pointer w-full">
                        <div>
                            <Upload className="mr-2" />
                            <span>Click to upload a file</span>
                        </div>
                    </Button>
                </div>
            </div>
            <Textarea
              placeholder="e.g., Tone of voice should be professional yet approachable. Avoid using jargon. Our company name is 'Example Inc.', not 'example inc'..."
              className="min-h-[calc(100vh-20rem)]"
              value={tempGuidelines}
              onChange={(e) => setTempGuidelines(e.target.value)}
            />
          </div>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
            <Button onClick={handleSaveGuidelines}>Save Guidelines</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
