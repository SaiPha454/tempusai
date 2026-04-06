import { Check, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Card } from '../../components/Card';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';

type SelectOption = { value: string; label: string };

type StudentResource = {
  id: string;
  studentId: string;
  name: string;
  studyProgram: string;
  year: string;
};

type ProgramResource = {
  value: string;
  label: string;
};

type StudentsSectionProps = {
  studentIdInput: string;
  setStudentIdInput: React.Dispatch<React.SetStateAction<string>>;
  studentNameInput: string;
  setStudentNameInput: React.Dispatch<React.SetStateAction<string>>;
  studentYearInput: string;
  setStudentYearInput: React.Dispatch<React.SetStateAction<string>>;
  studentProgramInput: string;
  setStudentProgramInput: React.Dispatch<React.SetStateAction<string>>;
  yearOptions: SelectOption[];
  programOptions: SelectOption[];
  canAddStudent: boolean;
  addStudent: () => void;
  studentFilterProgram: string;
  setStudentFilterProgram: React.Dispatch<React.SetStateAction<string>>;
  studentFilterYear: string;
  setStudentFilterYear: React.Dispatch<React.SetStateAction<string>>;
  filteredStudents: StudentResource[];
  editingStudentIds: Record<string, boolean>;
  toggleStudentEditing: (id: string) => void;
  updateStudentId: (id: string, value: string) => void;
  updateStudentName: (id: string, value: string) => void;
  updateStudentYear: (id: string, value: string) => void;
  updateStudentProgram: (id: string, value: string) => void;
  removeStudent: (id: string) => void;
  programs: ProgramResource[];
};

export function StudentsSection({
  studentIdInput,
  setStudentIdInput,
  studentNameInput,
  setStudentNameInput,
  studentYearInput,
  setStudentYearInput,
  studentProgramInput,
  setStudentProgramInput,
  yearOptions,
  programOptions,
  canAddStudent,
  addStudent,
  studentFilterProgram,
  setStudentFilterProgram,
  studentFilterYear,
  setStudentFilterYear,
  filteredStudents,
  editingStudentIds,
  toggleStudentEditing,
  updateStudentId,
  updateStudentName,
  updateStudentYear,
  updateStudentProgram,
  removeStudent,
  programs,
}: StudentsSectionProps) {
  return (
    <div className="space-y-6">
      <Card title="Students" icon={Users}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <InputField value={studentIdInput} onChange={setStudentIdInput} placeholder="Student ID" />
          <InputField value={studentNameInput} onChange={setStudentNameInput} placeholder="Student name" />
          <SelectField value={studentYearInput} onChange={setStudentYearInput} options={yearOptions} />
          <SelectField value={studentProgramInput} onChange={setStudentProgramInput} options={programOptions} />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={addStudent}
            disabled={!canAddStudent}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus size={16} /> Add Student
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SelectField
          value={studentFilterProgram}
          onChange={setStudentFilterProgram}
          options={[{ value: '', label: 'Filter by study program' }, ...programOptions.filter((option) => option.value)]}
        />
        <SelectField
          value={studentFilterYear}
          onChange={setStudentFilterYear}
          options={[{ value: '', label: 'Filter by year' }, ...yearOptions.filter((option) => option.value)]}
        />
      </div>

      <div className="divide-y divide-slate-200 border-t border-slate-200">
        {filteredStudents.map((student) => (
          <div key={student.id} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[160px_1fr_130px_200px_auto]">
            {editingStudentIds[student.id] ? (
              <input
                value={student.studentId}
                onChange={(event) => updateStudentId(student.id, event.target.value)}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]"
              />
            ) : (
              <p className="px-1 text-sm text-slate-800">{student.studentId || '—'}</p>
            )}
            {editingStudentIds[student.id] ? (
              <input
                value={student.name}
                onChange={(event) => updateStudentName(student.id, event.target.value)}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]"
              />
            ) : (
              <p className="px-1 text-sm text-slate-700">{student.name || '—'}</p>
            )}
            {editingStudentIds[student.id] ? (
              <SelectField
                value={student.year}
                onChange={(value) => updateStudentYear(student.id, value)}
                options={yearOptions}
              />
            ) : (
              <p className="px-1 text-sm text-slate-600">Year {student.year || '—'}</p>
            )}
            {editingStudentIds[student.id] ? (
              <SelectField
                value={student.studyProgram}
                onChange={(value) => updateStudentProgram(student.id, value)}
                options={programOptions}
              />
            ) : (
              <p className="px-1 text-sm text-slate-600">
                {programs.find((item) => item.value === student.studyProgram)?.label ??
                  student.studyProgram ??
                  '—'}
              </p>
            )}
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => toggleStudentEditing(student.id)}
                className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                aria-label={editingStudentIds[student.id] ? 'Done editing student' : 'Edit student'}
              >
                {editingStudentIds[student.id] ? <Check size={14} /> : <Pencil size={14} />}
              </button>
              <button
                type="button"
                onClick={() => removeStudent(student.id)}
                className="inline-flex items-center justify-center rounded p-1.5 text-rose-700 transition hover:bg-rose-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
