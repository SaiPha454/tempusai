import { X } from 'lucide-react';

type SelectedChipSummaryProps = {
  title: string;
  items: string[];
  emptyMessage: string;
  onRemove: (item: string) => void;
  formatItemLabel?: (item: string) => string;
  emptyMessageClassName?: string;
  removeAriaLabel?: (item: string) => string;
};

export function SelectedChipSummary({
  title,
  items,
  emptyMessage,
  onRemove,
  formatItemLabel,
  emptyMessageClassName = 'text-slate-500',
  removeAriaLabel,
}: SelectedChipSummaryProps) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>

      {items.length === 0 ? (
        <p className={`text-sm ${emptyMessageClassName}`}>{emptyMessage}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full border border-[#0A64BC]/25 bg-[#0A64BC]/10 px-3 py-1 text-sm text-[#0A64BC]"
            >
              {formatItemLabel ? formatItemLabel(item) : item}
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="rounded-full p-0.5 text-[#0A64BC]/80 transition hover:bg-[#0A64BC]/15 hover:text-[#0A64BC]"
                aria-label={removeAriaLabel ? removeAriaLabel(item) : `Remove ${item}`}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
