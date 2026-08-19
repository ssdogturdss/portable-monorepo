import React, { Suspense, useState } from 'react';
import { Github } from 'lucide-react';
import { useIde } from '@/hooks/use-ide-store';
import { GitHubPushDialog } from './github-push-dialog';
import { Button } from '@/components/ui/button';

const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

export function CodeEditor() {
  const { editorContent, setEditorContent, editorLanguage } = useIde();
  const [ghOpen, setGhOpen] = useState(false);

  return (
    <div className="h-full w-full bg-[#0C0C0E] flex flex-col relative group">
      <div className="h-9 border-b border-border bg-card flex items-center px-4 justify-between select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground uppercase">{editorLanguage}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground"
          onClick={() => setGhOpen(true)}
        >
          <Github className="h-3.5 w-3.5" />
          Push to GitHub
        </Button>
      </div>
      <GitHubPushDialog
        open={ghOpen}
        onOpenChange={setGhOpen}
        editorContent={editorContent}
        editorLanguage={editorLanguage}
      />
      <div className="flex-1 relative">
        <Suspense fallback={
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-mono text-sm">
            Loading Editor...
          </div>
        }>
          <MonacoEditor
            height="100%"
            language={editorLanguage}
            theme="vs-dark"
            value={editorContent}
            onChange={(val) => setEditorContent(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              padding: { top: 16, bottom: 16 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              formatOnPaste: true,
            }}
            loading={
              <div className="flex h-full items-center justify-center text-muted-foreground font-mono text-sm">
                Initializing...
              </div>
            }
          />
        </Suspense>
      </div>
    </div>
  );
}
