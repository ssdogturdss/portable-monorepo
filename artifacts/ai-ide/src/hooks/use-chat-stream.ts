import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetSessionMessagesQueryKey, useSendChat } from '@workspace/api-client-react';
import type { Message } from '@workspace/api-client-react';

interface UseChatStreamOptions {
  sessionId: number;
}

export function useChatStream({ sessionId }: UseChatStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const queryClient = useQueryClient();
  const sendChat = useSendChat();
  
  const mutateRef = useRef(sendChat.mutate);
  mutateRef.current = sendChat.mutate;

  const streamChat = useCallback(
    async (message: string, model: string = 'grok-beta', webSearch: boolean = false) => {
      setIsStreaming(true);

      const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
      const url = `${BASE}/api/ai/stream`;

      try {
        // Optimistically add user message
        const userMsg: Message = {
          id: Date.now(),
          sessionId,
          role: 'user',
          content: message,
          createdAt: new Date().toISOString(),
        };

        const assistantMsgId = Date.now() + 1;
        const assistantMsg: Message = {
          id: assistantMsgId,
          sessionId,
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
        };

        queryClient.setQueryData<Message[]>(getGetSessionMessagesQueryKey(sessionId), (old) => {
          return [...(old || []), userMsg, assistantMsg];
        });

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message, model, webSearch }),
        });

        if (!res.ok) {
          // Fallback to non-streaming mutation if stream endpoint fails
          mutateRef.current({
            data: { sessionId, message, model, webSearch }
          }, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getGetSessionMessagesQueryKey(sessionId) });
            }
          });
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let accumulatedContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (!dataStr) continue;

                try {
                  const data = JSON.parse(dataStr);

                  if (data.delta) {
                    accumulatedContent += data.delta;
                    queryClient.setQueryData<Message[]>(
                      getGetSessionMessagesQueryKey(sessionId),
                      (old) => {
                        if (!old) return old;
                        return old.map((m) =>
                          m.id === assistantMsgId ? { ...m, content: accumulatedContent } : m
                        );
                      }
                    );
                  } else if (data.done && data.fullContent) {
                    queryClient.setQueryData<Message[]>(
                      getGetSessionMessagesQueryKey(sessionId),
                      (old) => {
                        if (!old) return old;
                        return old.map((m) =>
                          m.id === assistantMsgId ? { ...m, content: data.fullContent } : m
                        );
                      }
                    );
                  }
                } catch (e) {
                  // JSON parse error on incomplete chunks, safe to ignore
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Streaming error:', err);
      } finally {
        setIsStreaming(false);
        // Refresh the query to ensure we have the authoritative state from backend
        queryClient.invalidateQueries({ queryKey: getGetSessionMessagesQueryKey(sessionId) });
      }
    },
    [sessionId, queryClient]
  );

  return { streamChat, isStreaming };
}
