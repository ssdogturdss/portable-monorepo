import { useState, useEffect, useCallback } from 'react';
import { Github, Upload, GitBranch, FileCode, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Repo {
  fullName: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
}

interface PushResult {
  fileUrl: string;
  commitUrl: string;
  commitSha: string;
  path: string;
}

interface GitHubPushDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorContent: string;
  editorLanguage: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

function languageToExtension(lang: string): string {
  const map: Record<string, string> = {
    javascript: 'js', typescript: 'ts', python: 'py', bash: 'sh',
    shell: 'sh', yaml: 'yml', json: 'json', nginx: 'conf', ini: 'ini',
    dockerfile: 'dockerfile', markdown: 'md', sql: 'sql', css: 'css',
    html: 'html', go: 'go', rust: 'rs', java: 'java', c: 'c', cpp: 'cpp',
  };
  return map[lang.toLowerCase()] ?? 'txt';
}

export function GitHubPushDialog({ open, onOpenChange, editorContent, editorLanguage }: GitHubPushDialogProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [filePath, setFilePath] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);
  const [error, setError] = useState('');

  // Load repos when dialog opens
  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError('');
    setLoadingRepos(true);
    fetch(`${BASE}/api/github/repos`)
      .then((r) => r.json())
      .then((data: Repo[]) => {
        setRepos(data);
        setLoadingRepos(false);
      })
      .catch(() => {
        setError('Failed to load repositories');
        setLoadingRepos(false);
      });
  }, [open]);

  // Auto-set default file path from language
  useEffect(() => {
    if (!filePath) {
      setFilePath(`deploy/config.${languageToExtension(editorLanguage)}`);
    }
  }, [editorLanguage, filePath]);

  // Load branches when repo changes
  const handleRepoChange = useCallback(async (fullName: string) => {
    setSelectedRepo(fullName);
    setSelectedBranch('');
    setBranches([]);
    setError('');

    const repo = repos.find((r) => r.fullName === fullName);
    if (!repo) return;

    setLoadingBranches(true);
    const [owner, repoName] = fullName.split('/');
    try {
      const res = await fetch(`${BASE}/api/github/repos/${owner}/${repoName}/branches`);
      const data: string[] = await res.json();
      setBranches(data);
      setSelectedBranch(repo.defaultBranch);
    } catch {
      setError('Failed to load branches');
    } finally {
      setLoadingBranches(false);
    }
  }, [repos]);

  const handlePush = async () => {
    if (!selectedRepo || !selectedBranch || !filePath.trim() || !commitMessage.trim()) return;
    const [owner, repo] = selectedRepo.split('/');
    setPushing(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/github/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          repo,
          branch: selectedBranch,
          path: filePath.trim(),
          message: commitMessage.trim(),
          content: editorContent,
        }),
      });
      const data = await res.json() as PushResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Push failed');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error — push failed');
    } finally {
      setPushing(false);
    }
  };

  const handleClose = () => {
    if (pushing) return;
    onOpenChange(false);
    setTimeout(() => {
      setResult(null);
      setError('');
      setSelectedRepo('');
      setSelectedBranch('');
      setBranches([]);
      setFilePath('');
      setCommitMessage('');
    }, 200);
  };

  const canPush = selectedRepo && selectedBranch && filePath.trim() && commitMessage.trim() && !pushing;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-sm">
            <Github className="h-4 w-4 text-primary" />
            Push to GitHub
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 text-green-400">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-mono text-sm font-medium">Pushed successfully</p>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{result.path}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <a
                href={result.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline font-mono"
              >
                <FileCode className="h-3.5 w-3.5" />
                View file on GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={result.commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:underline font-mono"
              >
                <GitBranch className="h-3.5 w-3.5" />
                Commit {result.commitSha.slice(0, 7)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Repository */}
            <div className="space-y-1.5">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Repository</Label>
              {loadingRepos ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading repos...
                </div>
              ) : (
                <Select value={selectedRepo} onValueChange={handleRepoChange}>
                  <SelectTrigger className="font-mono text-xs h-9 bg-background border-border">
                    <SelectValue placeholder="Select a repository" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {repos.map((repo) => (
                      <SelectItem key={repo.fullName} value={repo.fullName} className="font-mono text-xs">
                        {repo.fullName}
                        {repo.private && (
                          <span className="ml-2 text-[10px] text-muted-foreground uppercase">private</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Branch */}
            <div className="space-y-1.5">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Branch</Label>
              {loadingBranches ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading branches...
                </div>
              ) : (
                <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!branches.length}>
                  <SelectTrigger className="font-mono text-xs h-9 bg-background border-border">
                    <SelectValue placeholder={selectedRepo ? 'Select branch' : 'Choose a repo first'} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {branches.map((b) => (
                      <SelectItem key={b} value={b} className="font-mono text-xs">
                        <span className="flex items-center gap-1.5">
                          <GitBranch className="h-3 w-3 text-muted-foreground" />
                          {b}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* File path */}
            <div className="space-y-1.5">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">File path in repo</Label>
              <Input
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="deploy/nginx.conf"
                className="font-mono text-xs h-9 bg-background border-border"
              />
            </div>

            {/* Commit message */}
            <div className="space-y-1.5">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Commit message</Label>
              <Input
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Add deployment config"
                className="font-mono text-xs h-9 bg-background border-border"
                onKeyDown={(e) => { if (e.key === 'Enter' && canPush) handlePush(); }}
              />
            </div>

            {error && (
              <p className={cn('text-xs font-mono text-destructive bg-destructive/10 px-3 py-2 rounded-md')}>{error}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={handleClose} className="font-mono text-xs" disabled={pushing}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              size="sm"
              onClick={handlePush}
              disabled={!canPush}
              className="font-mono text-xs gap-1.5"
            >
              {pushing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Push to GitHub
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
