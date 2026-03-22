import { type ChangeEvent } from 'react';
import { Check, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Card } from '../../components/Card';
import { InputField } from '../../components/InputField';
import { MultiSelectDropdown } from '../../components/MultiSelectDropdown';
import { UploadPanel } from '../../components/UploadPanel';

type SelectOption = { value: string; label: string };

type ProfessorResource = {
  id: string;
  name: string;
  availableSlotIds: string[];
};

type ProfessorsSectionProps = {
  professorUploadName: string;
  onProfessorUploadNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  professorNameInput: string;
  setProfessorNameInput: React.Dispatch<React.SetStateAction<string>>;
  professorAvailabilityInput: string[];
  setProfessorAvailabilityInput: React.Dispatch<React.SetStateAction<string[]>>;
  professorSlotOptions: SelectOption[];
  anyTimeOptionValue: string;
  canAddProfessor: boolean;
  addProfessor: () => void;
  professorSearchInput: string;
  setProfessorSearchInput: React.Dispatch<React.SetStateAction<string>>;
  filteredProfessors: ProfessorResource[];
  editingProfessorIds: Record<string, boolean>;
  toggleProfessorEditing: (id: string) => void;
  updateProfessorName: (id: string, name: string) => void;
  updateProfessorSlots: (id: string, slotIds: string[]) => void;
  removeProfessor: (id: string) => void;
};

export function ProfessorsSection({
  professorUploadName,
  onProfessorUploadNameChange,
  professorNameInput,
  setProfessorNameInput,
  professorAvailabilityInput,
  setProfessorAvailabilityInput,
  professorSlotOptions,
  anyTimeOptionValue,
  canAddProfessor,
  addProfessor,
  professorSearchInput,
  setProfessorSearchInput,
  filteredProfessors,
  editingProfessorIds,
  toggleProfessorEditing,
  updateProfessorName,
  updateProfessorSlots,
  removeProfessor,
}: ProfessorsSectionProps) {
  return (
    <div className="space-y-6">
      <UploadPanel
        title="Professor bulk import"
        description="Upload an Excel file to import professors and availability data."
        fileName={professorUploadName}
        onFileChange={onProfessorUploadNameChange}
      />

      <Card title="Professors" icon={Users}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <InputField
            value={professorNameInput}
            onChange={setProfessorNameInput}
            placeholder="Professor name"
          />
          <MultiSelectDropdown
            value={professorAvailabilityInput}
            onChange={setProfessorAvailabilityInput}
            options={professorSlotOptions}
            exclusiveOptionValue={anyTimeOptionValue}
            placeholder="Select available times"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={addProfessor}
            disabled={!canAddProfessor}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus size={16} /> Add Professor
          </button>
        </div>
      </Card>

      <InputField
        value={professorSearchInput}
        onChange={setProfessorSearchInput}
        placeholder="Search professors"
      />

      <div className="divide-y divide-slate-200 border-t border-slate-200">
        {filteredProfessors.map((professor) => (
          <div key={professor.id} className="py-3">
            <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[1fr_auto]">
              {editingProfessorIds[professor.id] ? (
                <input
                  value={professor.name}
                  onChange={(event) => updateProfessorName(professor.id, event.target.value)}
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]"
                />
              ) : (
                <p className="px-1 text-sm text-slate-800">{professor.name || '—'}</p>
              )}
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => toggleProfessorEditing(professor.id)}
                  className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                  aria-label={editingProfessorIds[professor.id] ? 'Done editing professor' : 'Edit professor'}
                >
                  {editingProfessorIds[professor.id] ? <Check size={14} /> : <Pencil size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => removeProfessor(professor.id)}
                  className="inline-flex items-center justify-center rounded p-1.5 text-rose-700 transition hover:bg-rose-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Available times</label>
              {editingProfessorIds[professor.id] ? (
                <MultiSelectDropdown
                  value={professor.availableSlotIds}
                  onChange={(nextSlotIds) => updateProfessorSlots(professor.id, nextSlotIds)}
                  options={professorSlotOptions}
                  exclusiveOptionValue={anyTimeOptionValue}
                  placeholder="Select available times"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {professor.availableSlotIds.length === 0 ||
                  professor.availableSlotIds.includes(anyTimeOptionValue) ? (
                    <span className="inline-flex items-center rounded-full bg-[#0A64BC]/10 px-2.5 py-1 text-xs font-medium text-[#0A64BC]">
                      Any time
                    </span>
                  ) : professor.availableSlotIds.length > 0 ? (
                    professor.availableSlotIds.map((slotId) => {
                      const label =
                        professorSlotOptions.find((option) => option.value === slotId)?.label ?? slotId;
                      return (
                        <span
                          key={slotId}
                          className="inline-flex items-center rounded-full bg-[#0A64BC]/10 px-2.5 py-1 text-xs font-medium text-[#0A64BC]"
                        >
                          {label}
                        </span>
                      );
                    })
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
