import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, FileText, ChevronLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LegalDocument {
  id: string;
  type: string;
  title: string;
  content: string;
  version: string;
  is_published: boolean;
  target_audience: string;
  published_at?: string;
  updated_at?: string;
}

const Legal = () => {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<LegalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLegalDocuments();
  }, []);

  const fetchLegalDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await (supabase as any)
        .from('legal_documents')
        .select('id, type, title, content, version, is_published, published_at, target_audience, updated_at')
        .eq('is_published', true)
        .in('target_audience', ['both'])
        .order('type', { ascending: true });

      if (error) throw error;

      setDocuments(data || []);
    } catch (err) {
      console.error('Error fetching legal documents:', err);
      setError('Failed to load legal documents. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDocumentTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      terms_of_service: 'Terms of Service',
      privacy_policy: 'Privacy Policy',
      refund_policy: 'Refund Policy',
      cancellation_policy: 'Cancellation Policy',
      user_agreement: 'User Agreement',
      driver_agreement: 'Driver Agreement',
      acceptable_use: 'Acceptable Use Policy',
      cookie_policy: 'Cookie Policy',
      data_protection: 'Data Protection Policy',
    };
    return typeLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--subtle-gradient)]">
        <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-[var(--shadow-sm)]">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-foreground">Cart-R</h1>
            </div>
          </div>
        </header>

        <div className="pt-32 pb-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="h-12 w-64 mb-8" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--subtle-gradient)]">
        <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-[var(--shadow-sm)]">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-foreground">Cart-R</h1>
            </div>
          </div>
        </header>

        <div className="pt-32 pb-20 px-4">
          <div className="container mx-auto max-w-4xl">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="mt-6 text-center">
              <Button onClick={fetchLegalDocuments} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedDocument) {
    return (
      <div className="min-h-screen bg-[var(--subtle-gradient)]">
        <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-[var(--shadow-sm)]">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-foreground">Cart-R</h1>
            </div>
          </div>
        </header>

        <div className="pt-32 pb-20 px-4">
          <div className="container mx-auto max-w-4xl">
            <Button
              variant="ghost"
              onClick={() => setSelectedDocument(null)}
              className="mb-6"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Legal Documents
            </Button>

            <Card className="shadow-[var(--shadow-lg)]">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-3xl">{selectedDocument.title}</CardTitle>
                <CardDescription className="flex flex-col gap-2 mt-2">
                  <span className="text-sm">
                    <strong>Type:</strong> {getDocumentTypeLabel(selectedDocument.type)}
                  </span>
                  <span className="text-sm">
                    <strong>Version:</strong> {selectedDocument.version}
                  </span>
                  <span className="text-sm">
                    <strong>Last Updated:</strong> {formatDate(selectedDocument.updated_at)}
                  </span>
                  {selectedDocument.published_at && (
                    <span className="text-sm">
                      <strong>Published:</strong> {formatDate(selectedDocument.published_at)}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div
                  className="prose prose-slate max-w-none dark:prose-invert
                    prose-headings:text-foreground prose-p:text-muted-foreground
                    prose-strong:text-foreground prose-li:text-muted-foreground
                    prose-a:text-primary hover:prose-a:text-primary/80"
                  dangerouslySetInnerHTML={{ __html: selectedDocument.content }}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <footer className="py-12 px-4 border-t border-border">
          <div className="container mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <span className="font-bold text-lg text-foreground">Cart-R</span>
              <p className="text-muted-foreground text-center">
                © 2025 Cart-R. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--subtle-gradient)]">
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-[var(--shadow-sm)]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Cart-R</h1>
          </div>
        </div>
      </header>

      <div className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Legal Documents
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Review our terms, policies, and legal agreements
            </p>
          </div>

          {documents.length === 0 ? (
            <Card className="max-w-2xl mx-auto">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No legal documents are currently available.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <Card
                  key={doc.id}
                  className="cursor-pointer hover:shadow-[var(--shadow-lg)] transition-all hover:-translate-y-1"
                  onClick={() => setSelectedDocument(doc)}
                >
                  <CardHeader>
                    <div className="w-12 h-12 mb-4 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{doc.title}</CardTitle>
                    <CardDescription className="mt-2">
                      {getDocumentTypeLabel(doc.type)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        <strong>Version:</strong> {doc.version}
                      </p>
                      <p>
                        <strong>Updated:</strong> {formatDate(doc.updated_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full mt-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDocument(doc);
                      }}
                    >
                      Read Document
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <span className="font-bold text-lg text-foreground">Cart-R</span>
            <p className="text-muted-foreground text-center">
              © 2025 Cart-R. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Legal;