import { ChevronRight, GraduationCap, Plus } from 'lucide-react';
import { Card } from '../../components/Card';

type ProgramResource = {
  id: string;
  value: string;
  label: string;
};

type ProgramsSectionProps = {
  programNameInput: string;
  setProgramNameInput: React.Dispatch<React.SetStateAction<string>>;
  canAddProgram: boolean;
  programs: ProgramResource[];
  setPrograms: React.Dispatch<React.SetStateAction<ProgramResource[]>>;
  generateId: () => string;
  toTitleCase: (value: string) => string;
  toProgramValue: (label: string) => string;
  showProgramSuggestions: boolean;
  programSuggestions: string[];
  setIsProgramNameFocused: React.Dispatch<React.SetStateAction<boolean>>;
  isProgramAlreadyExists: boolean;
  onOpenProgramDetail: (program: ProgramResource) => void;
};

export function ProgramsSection({
  programNameInput,
  setProgramNameInput,
  canAddProgram,
  programs,
  setPrograms,
  generateId,
  toTitleCase,
  toProgramValue,
  showProgramSuggestions,
  programSuggestions,
  setIsProgramNameFocused,
  isProgramAlreadyExists,
  onOpenProgramDetail,
}: ProgramsSectionProps) {
  return (
    <Card title="Programs" icon={GraduationCap}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <input
            value={programNameInput}
            onChange={(event) => setProgramNameInput(toTitleCase(event.target.value))}
            onFocus={() => setIsProgramNameFocused(true)}
            onBlur={() => {
              setTimeout(() => setIsProgramNameFocused(false), 120);
            }}
            placeholder="Program name"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
          />

          {showProgramSuggestions && (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {programSuggestions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-500">No matching programs found.</p>
              ) : (
                programSuggestions.map((programLabel) => (
                  <button
                    key={programLabel}
                    type="button"
                    onMouseDown={() => {
                      setProgramNameInput(toTitleCase(programLabel));
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-[#0A64BC]/10 hover:text-[#0A64BC]"
                  >
                    {programLabel}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (!canAddProgram) return;
            const normalizedLabel = toTitleCase(programNameInput.trim());
            const value = toProgramValue(normalizedLabel);
            if (programs.some((item) => item.value === value)) return;
            setPrograms((prev) => [...prev, { id: generateId(), value, label: normalizedLabel }]);
            setProgramNameInput('');
          }}
          disabled={!canAddProgram}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus size={16} /> Add Program
        </button>
      </div>

      {isProgramAlreadyExists && (
        <p className="mt-2 text-xs text-amber-700">This program already exists in your current list.</p>
      )}

      <div className="mt-5 divide-y divide-slate-200 border-t border-slate-200">
        {programs.map((program) => (
          <button
            key={program.id}
            type="button"
            onClick={() => onOpenProgramDetail(program)}
            className="grid w-full grid-cols-[1fr_auto] items-center gap-3 py-3 text-left transition hover:bg-slate-50"
          >
            <div>
              <p className="px-1 text-sm font-medium text-slate-800">{program.label || '—'}</p>
              <p className="px-1 text-xs text-slate-500">Click to manage yearly study plan</p>
            </div>
            <span className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition">
              <ChevronRight size={16} />
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
