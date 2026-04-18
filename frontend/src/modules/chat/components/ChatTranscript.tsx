import type { ChatMessage } from '../types';
import { DynamicChatResponse } from './DynamicChatResponse';

type ChatTranscriptProps = {
  messages: ChatMessage[];
  isThinking: boolean;
};

export function ChatTranscript({ messages, isThinking }: ChatTranscriptProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Ask Scheduling Data Questions</h1>
          <p className="mt-3 text-sm text-slate-500">
            Try: "How many Year 3 students are there across all programs?"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-4">
      {messages.map((message) => (
        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {message.role === 'user' ? (
            <div className="flex max-w-[72%] items-start gap-2 rounded-2xl bg-[#0A64BC] px-4 py-3 text-sm text-white">
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            </div>
          ) : (
            <div className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-800 shadow-sm">
              <DynamicChatResponse answer={message.content} />
              {message.meta?.rowCount != null && (
                <p className="mt-2 text-xs text-slate-500">Rows scanned: {message.meta.rowCount}</p>
              )}
            </div>
          )}
        </div>
      ))}

      {isThinking && (
        <div className="flex justify-start">
          <div className="inline-flex items-center gap-2 px-1 py-1 text-sm text-slate-500">Thinking...</div>
        </div>
      )}
    </div>
  );
}
