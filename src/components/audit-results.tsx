'use client';

import * as React from 'react';
import type { AuditResult } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle, Download, FileQuestion, Eye, Copy, Check } from 'lucide-react';

function PageDetailModal({ result, isOpen, onOpenChange }: { result: AuditResult | null; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const [copiedStates, setCopiedStates] = React.useState<boolean[]>([]);

  React.useEffect(() => {
    if(result?.data?.suggestedRewrites) {
        setCopiedStates(new Array(result.data.suggestedRewrites.length).fill(false));
    }
  }, [result]);


  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    const newCopiedStates = [...copiedStates];
    newCopiedStates[index] = true;
    setCopiedStates(newCopiedStates);
    setTimeout(() => {
        const resetCopiedStates = [...copiedStates];
        resetCopiedStates[index] = false;
        setCopiedStates(resetCopiedStates);
    }, 2000);
  };
  
  if (!result) return null;

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
                                  <CardTitle>Flagged Issues ({result.data.flaggedIssues.length})</CardTitle>
                              </CardHeader>
                              <CardContent>
                                  <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                                      {result.data.flaggedIssues.map((issue, index) => (
                                          <li key={index}>{issue}</li>
                                      ))}
                                  </ul>
                              </CardContent>
                          </Card>
                          <Card>
                              <CardHeader>
                                  <CardTitle>Suggested Rewrites ({result.data.suggestedRewrites.length})</CardTitle>
                              </CardHeader>
                              <CardContent>
                                  <div className="space-y-4">
                                      {result.data.suggestedRewrites.map((rewrite, index) => (
                                          <div key={index} className="p-4 border rounded-lg bg-muted/50 relative group">
                                              <p className="font-code text-sm">{rewrite}</p>
                                               <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleCopy(rewrite, index)}
                                                >
                                                    {copiedStates[index] ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                </Button>
                                          </div>
                                      ))}
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
        setSelectedResult(result);
        setIsModalOpen(true);
    };

    const handleExportCsv = () => {
        const headers = ['URL', 'Status', 'Compliance Score', 'Flagged Issues', 'Suggested Rewrites'];
        const rows = results.map(res => {
            const score = res.status === 'success' ? res.data?.complianceScore : 'N/A';
            const issues = res.status === 'success' ? res.data?.flaggedIssues.join('; ') : res.error;
            const rewrites = res.status === 'success' ? res.data?.suggestedRewrites.join('; ') : 'N/A';
            return [res.url, res.status, score, `"${issues?.replace(/"/g, '""')}"`, `"${rewrites?.replace(/"/g, '""')}"`].join(',');
        });
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'content-audit-results.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) {
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

    if (error) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }
    
    if (results.length === 0) {
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

    return (
        <>
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Audit Results</CardTitle>
                        <CardDescription>Found {results.length} result(s). Review the compliance of each page.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={handleExportCsv} disabled={results.length === 0}>
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
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
                                        <Badge variant={result.status === 'success' ? 'default' : 'destructive'} className={result.status === 'success' ? 'bg-green-600' : ''}>
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
                                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(result)}>
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
