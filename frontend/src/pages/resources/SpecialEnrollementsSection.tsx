import { BookOpen, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card } from '../../components/Card';
import { SelectField } from '../../components/SelectField';
import { MultiSelectDropdown } from '../../components/MultiSelectDropdown';

type SelectOption = { value: string; label: string };

type EnrollmentResource = {
  id: string;
  studentId: string;
  courseCodes: string[];
};

type StudentResource = {
  studentId: string;
  name: string;
};

type CourseResource = {
  code: string;
  name: string;
  studyProgram?: string;
};

type SpecialEnrollementsSectionProps = {
  enrollmentStudentIdInput: string;
  onEnrollmentStudentIdInputChange: (value: string) => void;
  enrollmentCourseCodesInput: string[];
  onEnrollmentCourseCodesInputChange: (next: string[]) => void;
  studentOptions: SelectOption[];
  getCourseOptionItemsForStudent: (studentId: string) => SelectOption[];
  canAddEnrollment: boolean;
  onAddEnrollment: () => void;
  enrollmentFilterProgram: string;
  onEnrollmentFilterProgramChange: (value: string) => void;
  enrollmentFilterCourseCode: string;
  onEnrollmentFilterCourseCodeChange: (value: string) => void;
  programFilterOptions: SelectOption[];
  enrollmentFilterCourseOptions: SelectOption[];
  filteredEnrollments: EnrollmentResource[];
  editingEnrollmentIds: Record<string, boolean>;
  onToggleEnrollmentEditing: (id: string) => void;
  onEnrollmentStudentChange: (id: string, studentId: string) => void;
  onEnrollmentCourseCodesChange: (id: string, courseCodes: string[]) => void;
  onRemoveEnrollment: (id: string) => void;
  students: StudentResource[];
  courses: CourseResource[];
};

export function SpecialEnrollementsSection({
  enrollmentStudentIdInput,
  onEnrollmentStudentIdInputChange,
  enrollmentCourseCodesInput,
  onEnrollmentCourseCodesInputChange,
  studentOptions,
  getCourseOptionItemsForStudent,
  canAddEnrollment,
  onAddEnrollment,
  enrollmentFilterProgram,
  onEnrollmentFilterProgramChange,
  enrollmentFilterCourseCode,
  onEnrollmentFilterCourseCodeChange,
  programFilterOptions,
  enrollmentFilterCourseOptions,
  filteredEnrollments,
  editingEnrollmentIds,
  onToggleEnrollmentEditing,
  onEnrollmentStudentChange,
  onEnrollmentCourseCodesChange,
  onRemoveEnrollment,
  students,
  courses,
}: SpecialEnrollementsSectionProps) {
  return (
    <div className="space-y-6">
      <Card title="Special Enrollements" icon={BookOpen}>
        <p className="mb-3 text-xs text-slate-600">
          Students are normally auto-enrolled by year and study program. Use this tab only for
          special enrollements such as retaking courses from prior years after withdraw/skip.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SelectField
            value={enrollmentStudentIdInput}
            onChange={onEnrollmentStudentIdInputChange}
            options={studentOptions}
          />
          <MultiSelectDropdown
            value={enrollmentCourseCodesInput}
            onChange={onEnrollmentCourseCodesInputChange}
            options={getCourseOptionItemsForStudent(enrollmentStudentIdInput)}
            placeholder={enrollmentStudentIdInput ? 'Select courses' : 'Select student first'}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {enrollmentCourseCodesInput.length > 0 ? (
            enrollmentCourseCodesInput.map((courseCode) => {
              const label = courses.find((course) => course.code === courseCode)
                ? `${courseCode} · ${courses.find((course) => course.code === courseCode)?.name}`
                : courseCode;
              return (
                <span
                  key={courseCode}
                  className="inline-flex items-center gap-1 rounded-full bg-[#0A64BC]/10 px-2.5 py-1 text-xs font-medium text-[#0A64BC]"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() =>
                      onEnrollmentCourseCodesInputChange(
                        enrollmentCourseCodesInput.filter((item) => item !== courseCode),
                      )
                    }
                    className="rounded p-0.5 text-[#0A64BC] transition hover:bg-[#0A64BC]/20"
                    aria-label={`Remove ${label}`}
                  >
                    ×
                  </button>
                </span>
              );
            })
          ) : (
            <p className="text-xs text-slate-500">No courses selected yet.</p>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onAddEnrollment}
            disabled={!canAddEnrollment}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus size={16} /> Add Special Enrollement
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SelectField
          value={enrollmentFilterProgram}
          onChange={onEnrollmentFilterProgramChange}
          options={programFilterOptions}
        />
        <SelectField
          value={enrollmentFilterCourseCode}
          onChange={onEnrollmentFilterCourseCodeChange}
          options={enrollmentFilterCourseOptions}
        />
      </div>

      <div className="divide-y divide-slate-200 border-t border-slate-200">
        {filteredEnrollments.map((enrollment) => (
          <div key={enrollment.id} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[1fr_1fr_auto]">
            {editingEnrollmentIds[enrollment.id] ? (
              <SelectField
                value={enrollment.studentId}
                onChange={(value) => onEnrollmentStudentChange(enrollment.id, value)}
                options={studentOptions}
              />
            ) : (
              <p className="px-1 text-sm text-slate-800">
                {students.find((student) => student.studentId === enrollment.studentId)?.name ??
                  enrollment.studentId ??
                  '—'}
              </p>
            )}
            {editingEnrollmentIds[enrollment.id] ? (
              <MultiSelectDropdown
                value={enrollment.courseCodes}
                onChange={(nextCourseCodes) =>
                  onEnrollmentCourseCodesChange(enrollment.id, nextCourseCodes)
                }
                options={getCourseOptionItemsForStudent(enrollment.studentId)}
                placeholder="Select enrolled courses"
              />
            ) : (
              <div className="flex flex-wrap gap-2 px-1">
                {enrollment.courseCodes.length > 0 ? (
                  enrollment.courseCodes.map((courseCode) => {
                    const course = courses.find((item) => item.code === courseCode);
                    return (
                      <span
                        key={`${enrollment.id}-${courseCode}`}
                        className="inline-flex items-center rounded-full bg-[#0A64BC]/10 px-2.5 py-1 text-xs font-medium text-[#0A64BC]"
                      >
                        {course ? `${course.code} · ${course.name}` : courseCode}
                      </span>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-600">No courses selected</p>
                )}
              </div>
            )}
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => onToggleEnrollmentEditing(enrollment.id)}
                className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                aria-label={
                  editingEnrollmentIds[enrollment.id]
                    ? 'Done editing enrollment'
                    : 'Edit enrollment'
                }
              >
                {editingEnrollmentIds[enrollment.id] ? <Check size={14} /> : <Pencil size={14} />}
              </button>
              <button
                type="button"
                onClick={() => onRemoveEnrollment(enrollment.id)}
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
