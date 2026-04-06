import { useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { askSchedulingChat } from './api';
import { ChatComposer } from './components/ChatComposer';
import { ChatTranscript } from './components/ChatTranscript';
import type { ChatMessage } from './types';

const generateId = () => crypto.randomUUID();
const newConversationEvent = 'tempusai:new-conversation';

function toReadableErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const payload = error.response?.data as
      | { detail?: string | Array<{ msg?: string }> }
      | undefined;

    if (typeof payload?.detail === 'string' && payload.detail.trim()) {
      return payload.detail;
    }

    if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
      const firstMessage = payload.detail[0]?.msg;
      if (firstMessage && firstMessage.trim()) {
        return firstMessage;
      }
    }

    if (error.response?.status === 422) {
      return 'Invalid question format. Please try sending your question again.';
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Unable to get a response from scheduling chat. Please try again.';
}

export function SchedulingChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);

  const emptyState = useMemo(() => messages.length === 0, [messages.length]);

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
    const handleNewConversation = () => {
      setMessages([]);
      setInput('');
      setSessionId(null);
      setIsThinking(false);
      setErrorMessage(null);
    };

    window.addEventListener(newConversationEvent, handleNewConversation);
    return () => {
      window.removeEventListener(newConversationEvent, handleNewConversation);
    };
  }, []);

  const sendMessage = async () => {
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
    setErrorMessage(null);

    try {
      const response = await askSchedulingChat({
        question: nextText,
        session_id: sessionId ?? undefined,
      });
      setSessionId(response.session_id);

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: response.answer,
        meta: {
          status: response.status,
          rowCount: response.row_count ?? null,
          sqlQuery: response.sql_query ?? null,
        },
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setErrorMessage(toReadableErrorMessage(error));
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mx-auto min-h-0 flex w-full max-w-[980px] flex-1 flex-col">
        <div
          ref={messagesViewportRef}
          className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2 sm:px-8"
        >
          <ChatTranscript messages={messages} isThinking={isThinking} />
        </div>

        <div className="bg-[#F9FAFB] px-3 pb-0 pt-3 sm:px-6 sm:pb-1">
          <ChatComposer value={input} onChange={setInput} onSend={sendMessage} disabled={isThinking} />
          {errorMessage && <p className="mt-2 text-center text-xs text-red-600">{errorMessage}</p>}
          {!emptyState && (
            <p className="mt-1 text-center text-xs text-slate-500">
              This chat answers only scheduling-related questions from your PostgreSQL data.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
