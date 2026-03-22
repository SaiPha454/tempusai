import { Bot, SendHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const generateId = () => crypto.randomUUID();
const newConversationEvent = 'tempusai:new-conversation';

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const responseTimeoutRef = useRef<number | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const lastAnimatedMessageIdRef = useRef<string | null>(null);

  const canSend = input.trim().length > 0 && !isThinking;

  const emptyState = useMemo(() => messages.length === 0, [messages.length]);

  const resizeInput = () => {
    const textarea = inputRef.current;
    if (!textarea) {
      return;
    }

    const maxHeight = 24 * 6;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useEffect(() => {
    resizeInput();
  }, [input]);

  useEffect(() => {
    return () => {
      if (responseTimeoutRef.current) {
        window.clearTimeout(responseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isThinking]);

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || latestMessage.id === lastAnimatedMessageIdRef.current) {
      return;
    }

    const viewport = messagesViewportRef.current;
    if (!viewport) {
      return;
    }

    const latestElement = viewport.querySelector<HTMLElement>(`[data-message-id="${latestMessage.id}"]`);
    latestElement?.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      {
        duration: 180,
        easing: 'ease-out',
      },
    );

    lastAnimatedMessageIdRef.current = latestMessage.id;
  }, [messages]);

  const buildAssistantReply = (query: string) => {
    return `I can help answer schedule and internal knowledge questions. You asked: "${query.trim()}"\n\nWhen your RAG API is connected, I will return grounded answers from your scheduling data and internal resources.`;
  };

  const sendMessage = () => {
    const nextText = input.trim();
    if (!nextText || isThinking) {
      return;
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: nextText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

    responseTimeoutRef.current = window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: buildAssistantReply(nextText),
        },
      ]);
      setIsThinking(false);
      responseTimeoutRef.current = null;
      inputRef.current?.focus();
    }, 550);
  };

  const startNewConversation = () => {
    if (responseTimeoutRef.current) {
      window.clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }

    setMessages([]);
    setInput('');
    setIsThinking(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleNewConversation = () => {
      startNewConversation();
    };

    window.addEventListener(newConversationEvent, handleNewConversation);
    return () => {
      window.removeEventListener(newConversationEvent, handleNewConversation);
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mx-auto min-h-0 flex w-full max-w-[880px] flex-1 flex-col">
        <div ref={messagesViewportRef} className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2 sm:px-8">
        {emptyState ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-2xl text-center">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">What are you working on?</h1>
              <p className="mt-3 text-sm text-slate-500">Ask about schedules, programs, courses, rooms, or internal planning knowledge.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-7 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                data-message-id={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'user' ? (
                  <div className="flex max-w-[72%] items-start gap-2 rounded-2xl bg-[#0A64BC] px-4 py-3 text-sm text-white">
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </div>
                ) : (
                  <div className="flex w-full items-start gap-3 py-1 text-[15px] text-slate-800">
                    <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0A64BC]/10 text-[#0A64BC]">
                      <Bot size={14} />
                    </span>
                    <p className="whitespace-pre-wrap leading-8">{message.content}</p>
                  </div>
                )}
              </div>
            ))}

            {isThinking && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 px-1 py-1 text-sm text-slate-500">
                  <Bot size={14} /> Thinking...
                </div>
              </div>
            )}
          </div>
        )}
        </div>

        <div className="bg-[#F9FAFB] px-3 pb-0 pt-3 sm:px-6 sm:pb-1">
          <div className="rounded-2xl border border-slate-300 bg-white px-3 py-2 shadow-sm">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                placeholder="Ask anything about schedules and internal knowledge"
                className="min-h-[2.25rem] flex-1 resize-none border-none bg-transparent px-1 py-1 text-sm leading-6 text-slate-800 outline-none"
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={!canSend}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#0A64BC] text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label="Send message"
              >
                <SendHorizontal size={15} />
              </button>
            </div>
          </div>
          <p className="mt-1 text-center text-xs text-slate-500">This chat is session-only. Conversation history is not saved.</p>
        </div>
      </div>
    </div>
  );
}
