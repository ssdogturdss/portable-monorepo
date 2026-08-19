import { useState, useRef, useEffect } from 'react';
import { useIde } from '@/hooks/use-ide-store';
import { useGetSessionMessages, getGetSessionMessagesQueryKey, useListModels, useGetSession, getGetSessionQueryKey } from '@workspace/api-client-react';
import { useChatStream } from '@/hooks/use-chat-stream';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Bot, User, Zap, Sparkles, Globe } from 'lucide-react';

export function ChatPanel() {
  const { activeSessionId, selectedModel, setSelectedModel } = useIde();
  const [input, setInput] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: sessionData } = useGetSession(activeSessionId || 0, {
    query: { enabled: !!activeSessionId, queryKey: getGetSessionQueryKey(activeSessionId || 0) }
  });

  const { data: messages, isLoading: messagesLoading } = useGetSessionMessages(
    activeSessionId || 0,
    { query: { enabled: !!activeSessionId, queryKey: getGetSessionMessagesQueryKey(activeSessionId || 0) } }
  );

  const { data: models } = useListModels();

  const { streamChat, isStreaming } = useChatStream({ sessionId: activeSessionId || 0 });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isStreaming]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeSessionId || isStreaming) return;
    const msg = input;
    setInput('');
    await streamChat(msg, selectedModel, webSearch);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!activeSessionId) {
    return (
      <div className="h-full w-full bg-card border-l border-border flex flex-col items-center justify-center p-6 text-center">
        <Bot className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
        <h3 className="text-lg font-mono text-muted-foreground mb-2">No Active Session</h3>
        <p className="text-sm text-muted-foreground max-w-[200px]">
          Create a new session or select one from the sidebar to start chatting.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-card border-l border-border flex flex-col">
      <div className="h-12 border-b border-border flex items-center px-4 justify-between bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-semibold truncate max-w-[150px]">
            {sessionData?.title || 'Grok Chat'}
          </span>
        </div>
        
        {models && models.length > 0 && (
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[140px] h-7 text-xs font-mono bg-background border-border">
              <Sparkles className="h-3 w-3 mr-2 text-primary" />
              <SelectValue placeholder="Select Model" />
            </SelectTrigger>
            <SelectContent>
              {models.map(model => (
                <SelectItem key={model.id} value={model.id} className="font-mono text-xs">
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-6 pb-4">
          {messagesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono p-4">
              Loading messages...
            </div>
          ) : messages?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 pt-20">
              <p className="text-muted-foreground font-mono text-sm">Empty session.</p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button 
                  variant="outline" 
                  className="font-mono text-xs text-left h-auto py-3 justify-start"
                  onClick={() => streamChat("Generate a nginx config for my Express app")}
                >
                  Generate a nginx config for my Express app
                </Button>
                <Button 
                  variant="outline" 
                  className="font-mono text-xs text-left h-auto py-3 justify-start"
                  onClick={() => streamChat("Write a systemd unit for a Node.js server")}
                >
                  Write a systemd unit for a Node.js server
                </Button>
              </div>
            </div>
          ) : (
            messages?.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'bg-muted/50 border border-border text-foreground font-mono leading-relaxed'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-4 bg-card border-t border-border shrink-0">
        <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell Grok what to build..."
            className="min-h-[60px] max-h-[200px] w-full resize-none bg-background pr-12 font-mono text-sm border-border focus-visible:ring-primary"
            disabled={isStreaming}
          />
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setWebSearch(!webSearch)}
              className={`h-8 px-2 text-xs font-mono transition-colors ${webSearch ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
            >
              <Globe className={`h-3 w-3 mr-1.5 ${webSearch ? 'text-primary' : ''}`} />
              Web Search {webSearch ? 'ON' : 'OFF'}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isStreaming}
              className="h-8 font-mono text-xs"
            >
              <Send className="h-3 w-3 mr-1.5" />
              Send
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
