type ChatComposerProps = {
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  onSend: () => void;
};

export function ChatComposer({ value, disabled = false, onChange, onSend }: ChatComposerProps) {
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="rounded-2xl border border-slate-300 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          rows={1}
          placeholder="Ask scheduling questions from your PostgreSQL data"
          className="min-h-[2.25rem] flex-1 resize-none border-none bg-transparent px-1 py-1 text-sm leading-6 text-slate-800 outline-none"
          disabled={disabled}
        />

        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#0A64BC] text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
          aria-label="Send message"
        >
          {'>'}
        </button>
      </div>
    </div>
  );
}
