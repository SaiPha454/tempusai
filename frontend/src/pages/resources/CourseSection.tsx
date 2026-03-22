import { type ChangeEvent } from 'react';
import { BookOpen, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card } from '../../components/Card';
import { SelectField } from '../../components/SelectField';
import { UploadPanel } from '../../components/UploadPanel';

type SelectOption = { value: string; label: string };

type CourseResource = {
  id: string;
  code: string;
  name: string;
  studyProgram: string;
};

type CourseSuggestion = {
  id: string;
  code: string;
  name: string;
  studyProgram?: string;
};

type CourseSectionProps = {
  courseUploadName: string;
  onCourseUploadNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  courseCodeInput: string;
  setCourseCodeInput: React.Dispatch<React.SetStateAction<string>>;
  courseNameInput: string;
  setCourseNameInput: React.Dispatch<React.SetStateAction<string>>;
  courseProgramInput: string;
  setCourseProgramInput: React.Dispatch<React.SetStateAction<string>>;
  courseSuggestionAnchor: 'code' | 'name' | null;
  setCourseSuggestionAnchor: React.Dispatch<React.SetStateAction<'code' | 'name' | null>>;
  showCourseSuggestions: boolean;
  courseSuggestions: CourseSuggestion[];
  courseProgramOptions: SelectOption[];
  isCourseCodeAlreadyExists: boolean;
  canAddCourse: boolean;
  addCourse: () => void;
  courseFilterProgram: string;
  setCourseFilterProgram: React.Dispatch<React.SetStateAction<string>>;
  courseFilterProgramOptions: SelectOption[];
  courseSearchInput: string;
  setCourseSearchInput: React.Dispatch<React.SetStateAction<string>>;
  filteredCourses: CourseResource[];
  editingCourseIds: Record<string, boolean>;
  toggleCourseEditing: (id: string) => void;
  updateCourseCode: (id: string, value: string) => void;
  updateCourseName: (id: string, value: string) => void;
  updateCourseProgram: (id: string, value: string) => void;
  removeCourse: (id: string) => void;
  applyCourseSuggestion: (course: CourseSuggestion) => void;
};

export function CourseSection({
  courseUploadName,
  onCourseUploadNameChange,
  courseCodeInput,
  setCourseCodeInput,
  courseNameInput,
  setCourseNameInput,
  courseProgramInput,
  setCourseProgramInput,
  setCourseSuggestionAnchor,
  showCourseSuggestions,
  courseSuggestions,
  courseProgramOptions,
  isCourseCodeAlreadyExists,
  canAddCourse,
  addCourse,
  courseFilterProgram,
  setCourseFilterProgram,
  courseFilterProgramOptions,
  courseSearchInput,
  setCourseSearchInput,
  filteredCourses,
  editingCourseIds,
  toggleCourseEditing,
  updateCourseCode,
  updateCourseName,
  updateCourseProgram,
  removeCourse,
  applyCourseSuggestion,
}: CourseSectionProps) {
  return (
    <div className="space-y-6">
      <UploadPanel
        title="Course bulk import"
        description="Upload an Excel file to import courses and subject metadata."
        fileName={courseUploadName}
        onFileChange={onCourseUploadNameChange}
      />

      <Card title="Course (Subject)" icon={BookOpen}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="relative">
            <input
              value={courseCodeInput}
              onChange={(event) => setCourseCodeInput(event.target.value)}
              onFocus={() => setCourseSuggestionAnchor('code')}
              onBlur={() => {
                setTimeout(() => setCourseSuggestionAnchor(null), 120);
              }}
              placeholder="Course code (required, e.g. 01286232)"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
            />

            {showCourseSuggestions && (
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {courseSuggestions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500">No matching existing courses.</p>
                ) : (
                  courseSuggestions.map((course) => (
                    <button
                      key={course.id}
                      type="button"
                      onMouseDown={() => applyCourseSuggestion(course)}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-[#0A64BC]/10 hover:text-[#0A64BC]"
                    >
                      {course.code} · {course.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <input
              value={courseNameInput}
              onChange={(event) => setCourseNameInput(event.target.value)}
              placeholder="Course name"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
            />
          </div>

          <SelectField
            value={courseProgramInput}
            onChange={setCourseProgramInput}
            options={courseProgramOptions}
          />
        </div>

        {isCourseCodeAlreadyExists && (
          <p className="mt-2 text-xs text-amber-700">A course with this code already exists in your current list.</p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={addCourse}
            disabled={!canAddCourse}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus size={16} /> Add Course
          </button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full md:w-64">
          <SelectField
            value={courseFilterProgram}
            onChange={setCourseFilterProgram}
            options={courseFilterProgramOptions}
          />
        </div>
        <input
          value={courseSearchInput}
          onChange={(event) => setCourseSearchInput(event.target.value)}
          placeholder="Search by course name or code"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20 md:w-80"
        />
      </div>

      <div className="divide-y divide-slate-200 border-t border-slate-200">
        {filteredCourses.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">No courses found.</p>
        ) : (
          filteredCourses.map((course) => (
            <div key={course.id} className="grid grid-cols-1 items-center gap-2 py-3 md:grid-cols-[1fr_1fr_220px_auto]">
              {editingCourseIds[course.id] ? (
                <input
                  value={course.code}
                  onChange={(event) => updateCourseCode(course.id, event.target.value)}
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]"
                  placeholder="Course code"
                />
              ) : (
                <p className="px-1 text-sm text-slate-800">{course.code || '—'}</p>
              )}

              {editingCourseIds[course.id] ? (
                <input
                  value={course.name}
                  onChange={(event) => updateCourseName(course.id, event.target.value)}
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]"
                  placeholder="Course name"
                />
              ) : (
                <p className="px-1 text-sm text-slate-700">{course.name || '—'}</p>
              )}

              {editingCourseIds[course.id] ? (
                <SelectField
                  value={course.studyProgram}
                  onChange={(value) => updateCourseProgram(course.id, value)}
                  options={courseProgramOptions}
                />
              ) : (
                <p className="px-1 text-sm text-slate-600">
                  {courseProgramOptions.find((option) => option.value === course.studyProgram)?.label ||
                    course.studyProgram ||
                    '—'}
                </p>
              )}

              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => toggleCourseEditing(course.id)}
                  className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                  aria-label={editingCourseIds[course.id] ? 'Done editing course' : 'Edit course'}
                >
                  {editingCourseIds[course.id] ? <Check size={14} /> : <Pencil size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => removeCourse(course.id)}
                  className="inline-flex items-center justify-center rounded p-1.5 text-rose-700 transition hover:bg-rose-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
