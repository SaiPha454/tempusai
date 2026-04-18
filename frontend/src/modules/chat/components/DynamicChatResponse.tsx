import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type DynamicChatResponseProps = {
  answer: string;
};
export function DynamicChatResponse({ answer }: DynamicChatResponseProps) {
  const markdown = answer.trim() || 'No response text was generated.';

  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="leading-7 text-slate-800">{children}</p>,
          h1: ({ children }) => <h1 className="text-xl font-semibold text-slate-900">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold text-slate-900">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-slate-900">{children}</h3>,
          ul: ({ children }) => <ul className="ml-5 list-disc space-y-1 text-slate-800">{children}</ul>,
          ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1 text-slate-800">{children}</ol>,
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>,
          th: ({ children }) => <th className="px-3 py-2 font-medium text-slate-700">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 text-slate-700">{children}</td>,
          code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-800">{children}</code>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-slate-300 pl-3 text-slate-700">{children}</blockquote>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
