'use client';

import * as React from 'react';
import type { AuditResult, Screenshot } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle, Download, FileQuestion, Eye, Copy, Check, FileJson, FileText, Star, Image as ImageIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function PageDetailModal({ result, isOpen, onOpenChange }: { result: AuditResult | null; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const [copiedStates, setCopiedStates] = React.useState<{ [key: string]: boolean[] }>({ rewrites: [], recommendations: [] });

  const getScreenshotForSelector = (selector: string | undefined): string | undefined => {
    if (!selector || !result?.screenshots) return undefined;
    const found = result.screenshots.find(s => s.selector === selector);
    return found ? `data:image/png;base64,${found.screenshot}` : undefined;
  }

  React.useEffect(() => {
    if (result?.data) {
      setCopiedStates({
        rewrites: new Array(result.data.suggestedRewrites?.length || 0).fill(false),
        recommendations: new Array(result.data.recommendations?.length || 0).fill(false),
      });
    }
  }, [result]);

  const handleCopy = (text: string, type: 'rewrites' | 'recommendations', index: number) => {
    navigator.clipboard.writeText(text);
    const newCopiedStates = { ...copiedStates };
    newCopiedStates[type][index] = true;
    setCopiedStates(newCopiedStates);
    setTimeout(() => {
      const resetCopiedStates = { ...copiedStates };
      resetCopiedStates[type][index] = false;
      setCopiedStates(resetCopiedStates);
    }, 2000);
  };
  
  if (!result) return null;

  const renderAuditItem = (item: { text: string; selector?: string | undefined; }, type: 'rewrites' | 'recommendations', index: number) => {
    const screenshot = getScreenshotForSelector(item.selector);
    return (
        <div key={index} className="p-4 border rounded-lg bg-muted/50 relative group flex items-start gap-4">
            <div className="flex-1">
                <p className={type === 'rewrites' ? "font-code text-sm" : "text-sm"}>{item.text}</p>
            </div>
            <div className="flex items-center gap-1">
                {screenshot && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-50 group-hover:opacity-100 transition-opacity">
                                <ImageIcon className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto">
                            <Image src={screenshot} alt={`Screenshot for selector: ${item.selector}`} width={600} height={400} className="rounded-md" />
                        </PopoverContent>
                    </Popover>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-50 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleCopy(item.text, type, index)}
                >
                    {copiedStates[type]?.[index] ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
              <DialogTitle className="text-2xl">Audit Details: {result.url}</DialogTitle>
              <DialogDescription>A detailed compliance report for the specified URL.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-6">
              <div className="grid gap-6 py-4">
                  {result.status === 'success' && result.data ? (
                      <>
                          <Card>
                              <CardHeader>
                                  <CardTitle>Compliance Score</CardTitle>
                              </CardHeader>
                              <CardContent>
                                  <div className="flex items-center gap-4">
                                      <span className="text-4xl font-bold text-primary">{result.data.complianceScore}%</span>
                                      <Progress value={result.data.complianceScore} className="w-full" />
                                  </div>
                              </CardContent>
                          </Card>
                          <Card>
                              <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <Star className="text-yellow-500"/>
                                    Strategic Recommendations ({result.data.recommendations?.length || 0})
                                  </CardTitle>
                              </CardHeader>
                              <CardContent>
                                  <div className="space-y-4">
                                      {result.data.recommendations?.map((rec, index) => renderAuditItem(rec, 'recommendations', index))}
                                  </div>
                              </CardContent>
                          </Card>
                          <Card>
                              <CardHeader>
                                  <CardTitle>Flagged Issues ({result.data.flaggedIssues.length})</CardTitle>
                              </CardHeader>
                              <CardContent>
                                  <div className="space-y-4">
                                      {result.data.flaggedIssues.map((issue, index) => {
                                           const screenshot = getScreenshotForSelector(issue.selector);
                                           return (
                                               <div key={index} className="flex items-start gap-4 p-4 border rounded-lg bg-muted/50 group">
                                                    <div className="flex-1 text-sm text-muted-foreground list-disc list-inside"><li>{issue.text}</li></div>
                                                    {screenshot && (
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-50 group-hover:opacity-100 transition-opacity">
                                                                    <ImageIcon className="h-4 w-4" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto">
                                                                <Image src={screenshot} alt={`Screenshot for selector: ${issue.selector}`} width={600} height={400} className="rounded-md" />
                                                            </PopoverContent>
                                                        </Popover>
                                                    )}
                                               </div>
                                           )
                                      })}
                                  </div>
                              </CardContent>
                          </Card>
                          <Card>
                              <CardHeader>
                                  <CardTitle>Suggested Rewrites ({result.data.suggestedRewrites.length})</CardTitle>
                              </CardHeader>
                              <CardContent>
                                  <div className="space-y-4">
                                      {result.data.suggestedRewrites.map((rewrite, index) => renderAuditItem(rewrite, 'rewrites', index))}
                                  </div>
                              </CardContent>
                          </Card>
                      </>
                  ) : (
                      <Alert variant="destructive">
                          <AlertCircle className="w-4 h-4" />
                          <AlertTitle>Audit Failed</AlertTitle>
                          <AlertDescription>{result.error}</AlertDescription>
                      </Alert>
                  )}
              </div>
          </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}


export function AuditResults({ results, isLoading, error }: { results: AuditResult[], isLoading: boolean, error: string | null }) {
    const [selectedResult, setSelectedResult] = React.useState<AuditResult | null>(null);
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    const handleViewDetails = (result: AuditResult) => {
        if(result.status === 'pending' || result.status === 'error') return;
        setSelectedResult(result);
        setIsModalOpen(true);
    };

    const downloadFile = (content: string, fileName: string, contentType: string) => {
      const blob = new Blob([content], { type: contentType });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    const handleExportJson = () => {
      const resultsToExport = results.filter(r => r.status === 'success');
      const jsonContent = JSON.stringify(resultsToExport, null, 2);
      downloadFile(jsonContent, 'content-audit-results.json', 'application/json');
    };

    const handleExportMd = () => {
      let mdContent = '# Content Audit Results\n\n';
      results.forEach(res => {
        if (res.status !== 'success') return;
        mdContent += `## [${res.url}](${res.url})\n\n`;
        mdContent += `**Status:** ${res.status}\n\n`;
        if (res.data) {
          mdContent += `**Compliance Score:** ${res.data.complianceScore}%\n\n`;
          mdContent += `### Strategic Recommendations (${res.data.recommendations?.length || 0})\n`;
          res.data.recommendations?.forEach(rec => (mdContent += `- ${rec.text}\n`));
          mdContent += `\n### Flagged Issues (${res.data.flaggedIssues.length})\n`;
          res.data.flaggedIssues.forEach(issue => (mdContent += `- ${issue.text}\n`));
          mdContent += `\n### Suggested Rewrites (${res.data.suggestedRewrites.length})\n`;
          res.data.suggestedRewrites.forEach(rewrite => (mdContent += `\`\`\`\n${rewrite.text}\n\`\`\`\n`));
        }
        mdContent += '\n---\n\n';
      });
      downloadFile(mdContent, 'content-audit-results.md', 'text/markdown');
    }

    const handleExportCsv = () => {
        const headers = ['URL', 'Status', 'Compliance Score', 'Recommendations', 'Flagged Issues', 'Suggested Rewrites'];
        const rows = results.map(res => {
            if (res.status !== 'success') return null;

            const score = res.data?.complianceScore ?? 'N/A';
            const recommendations = res.data?.recommendations?.map(r => r.text).join('; ') ?? 'N/A';
            const issues = res.data?.flaggedIssues.map(i => i.text).join('; ') ?? 'N/A';
            const rewrites = res.data?.suggestedRewrites.map(r => r.text).join('; ') ?? 'N/A';
            
            const escapeCsv = (str: string | undefined | null) => str ? `"${String(str).replace(/"/g, '""')}"` : '""';

            return [res.url, res.status, score, escapeCsv(recommendations), escapeCsv(issues), escapeCsv(rewrites)].join(',');
        }).filter(Boolean);
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        downloadFile(csvContent, 'content-audit-results.csv', 'text/csv;charset=utf-8;');
    };

    if (isLoading && results.length === 0) {
        return (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Audit in Progress</CardTitle>
                    <CardDescription>The AI is analyzing the provided URLs. Please wait.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-20">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    if (error && !isLoading) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }
    
    if (results.length === 0 && !isLoading) {
       return (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Audit Results</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                    <FileQuestion className="w-16 h-16 mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold">No results yet</h3>
                    <p className="text-muted-foreground">Run an audit to see the results here.</p>
                </CardContent>
            </Card>
       )
    }

    const successfulAudits = results.filter(r => r.status === 'success').length > 0;

    return (
        <>
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Audit Results</CardTitle>
                        <CardDescription>Found {results.length} result(s). Review the compliance of each page.</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" disabled={!successfulAudits}>
                            <Download className="w-4 h-4 mr-2" />
                            Export Results
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleExportCsv}>
                            <Download className="w-4 h-4 mr-2" />
                            Export as CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportJson}>
                            <FileJson className="w-4 h-4 mr-2" />
                            Export as JSON
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={handleExportMd}>
                            <FileText className="w-4 h-4 mr-2" />
                            Export as Markdown
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">URL</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results.map((result) => (
                                <TableRow key={result.url}>
                                    <TableCell className="font-medium truncate max-w-xs">{result.url}</TableCell>
                                    <TableCell>
                                        <Badge variant={result.status === 'success' ? 'default' : (result.status === 'error' ? 'destructive' : 'secondary')} className={result.status === 'success' ? 'bg-green-600' : ''}>
                                            {result.status === 'pending' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                            {result.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {result.status === 'success' && result.data ? (
                                            <div className="flex items-center gap-2">
                                                <span>{result.data.complianceScore}%</span>
                                                <Progress value={result.data.complianceScore} className="w-24" />
                                            </div>
                                        ) : (
                                            'N/A'
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(result)} disabled={result.status !== 'success'}>
                                            <Eye className="w-4 h-4 mr-2" />
                                            View Details
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <PageDetailModal result={selectedResult} isOpen={isModalOpen} onOpenChange={setIsModalOpen} />
        </>
    );
}
