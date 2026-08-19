import { useListTemplates, useGetTemplate, getGetTemplateQueryKey } from '@workspace/api-client-react';
import { useIde } from '@/hooks/use-ide-store';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileCode, Server, Play, Box } from 'lucide-react';
import { useState, useEffect } from 'react';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  nginx: <Server className="h-5 w-5 text-primary" />,
  systemd: <Play className="h-5 w-5 text-primary" />,
  docker: <Box className="h-5 w-5 text-primary" />,
  deploy: <FileCode className="h-5 w-5 text-primary" />,
};

export default function TemplatesPage() {
  const [, setLocation] = useLocation();
  const { setEditorContent, setEditorLanguage } = useIde();
  const { data: templates, isLoading } = useListTemplates();
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  
  const { data: templateData, isFetching: templateLoading } = useGetTemplate(
    activeTemplateId || '', 
    { query: { enabled: !!activeTemplateId, queryKey: getGetTemplateQueryKey(activeTemplateId || '') } }
  );

  useEffect(() => {
    if (templateData && activeTemplateId) {
      setEditorContent(templateData.content);
      setEditorLanguage(templateData.language);
      setLocation('/');
      setActiveTemplateId(null);
    }
  }, [templateData, activeTemplateId, setEditorContent, setEditorLanguage, setLocation]);

  const handleLoadTemplate = (templateId: string) => {
    setActiveTemplateId(templateId);
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      <div className="h-16 border-b border-border flex items-center px-6 gap-4 bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-mono font-bold tracking-tight">Templates Browser</h1>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Start with a solid foundation</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-48 bg-muted/20 rounded-lg border border-border" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates?.map((template) => (
                <Card key={template.id} className="bg-card border-border hover:border-primary/50 transition-colors flex flex-col group">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded bg-primary/10 border border-primary/20">
                        {CATEGORY_ICONS[template.category] || <FileCode className="h-5 w-5 text-primary" />}
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase border-primary/20 text-primary">
                        {template.category}
                      </Badge>
                    </div>
                    <CardTitle className="font-mono text-base">{template.name}</CardTitle>
                    <CardDescription className="text-sm line-clamp-2 mt-1">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      {template.language}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button 
                      className="w-full font-mono bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => handleLoadTemplate(template.id)}
                      disabled={templateLoading && activeTemplateId === template.id}
                    >
                      {templateLoading && activeTemplateId === template.id ? 'Loading...' : 'Load Template'}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
