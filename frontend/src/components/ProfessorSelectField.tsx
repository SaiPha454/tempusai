import { Search, X } from 'lucide-react';

type ProfessorSelectFieldProps = {
  selectedProfessors: string[];
  query: string;
  onQueryChange: (value: string) => void;
  suggestions: string[];
  onSelect: (professor: string) => void;
  onRemove: (professor: string) => void;
  placeholder?: string;
};

export function ProfessorSelectField({
  selectedProfessors,
  query,
  onQueryChange,
  suggestions,
  onSelect,
  onRemove,
  placeholder = 'Professor name',
}: ProfessorSelectFieldProps) {
  const showSuggestions = query.trim().length > 0;

  return (
    <div className="relative space-y-2">
      <div className="flex min-h-10 w-full flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none transition focus-within:border-[#0A64BC] focus-within:ring-2 focus-within:ring-[#0A64BC]/20">
        <Search size={14} className="text-slate-400" />

        {selectedProfessors.map((professor) => (
          <span
            key={professor}
            className="inline-flex items-center gap-1 rounded-full border border-[#0A64BC]/25 bg-[#0A64BC]/10 px-3 py-1 text-sm text-[#0A64BC]"
          >
            {professor}
            <button
              type="button"
              onClick={() => onRemove(professor)}
              className="rounded-full p-0.5 text-[#0A64BC]/80 transition hover:bg-[#0A64BC]/15 hover:text-[#0A64BC]"
              aria-label={`Remove ${professor}`}
            >
              <X size={14} />
            </button>
          </span>
        ))}

        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={selectedProfessors.length === 0 ? placeholder : 'Add another professor'}
          className="h-8 min-w-[160px] flex-1 border-none bg-transparent p-0 outline-none"
        />
      </div>

      {showSuggestions && (
        <div className="absolute z-20 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          {suggestions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No matching professors found.</p>
          ) : (
            suggestions.map((professor) => (
              <button
                key={professor}
                type="button"
                onClick={() => onSelect(professor)}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition last:border-b-0 hover:bg-slate-50"
              >
                {professor}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
