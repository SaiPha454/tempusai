import { CalendarDays, Clock3, GraduationCap, Trash2, UserRound, Users } from 'lucide-react';

type CourseItemProps = {
  order: number;
  courseCode: string;
  courseName: string;
  year: string;
  semester: string;
  studentCapacity: string;
  professorNames: string[];
  preferredDays: string[];
  preferredTime: string;
  onRemove: () => void;
};

export function CourseItem({
  order,
  courseCode,
  courseName,
  year,
  semester,
  studentCapacity,
  professorNames,
  preferredDays,
  preferredTime,
  onRemove,
}: CourseItemProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0A64BC]">Course {order}</p>
            <h3 className="text-base font-semibold text-slate-900">
              {courseCode} · {courseName}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
            <p className="inline-flex items-center gap-1.5">
              <GraduationCap size={14} className="text-slate-500" />
              {year && semester ? `Year ${year}, Semester ${semester}` : 'Year/Semester N/A'}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <Users size={14} className="text-slate-500" />
              {studentCapacity ? `${studentCapacity} students` : 'Students N/A'}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <UserRound size={14} className="text-slate-500" />
              {professorNames.length > 0 ? professorNames.join(', ') : 'Professor N/A'}
            </p>
            <p className="inline-flex items-center gap-1.5 sm:col-span-2 lg:col-span-1">
              <CalendarDays size={14} className="text-slate-500" />
              {preferredDays.length > 0 ? preferredDays.join(', ') : 'Any day'}
            </p>
            <p className="inline-flex items-center gap-1.5 sm:col-span-2 lg:col-span-2">
              <Clock3 size={14} className="text-slate-500" />
              {preferredTime}
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="mt-4 inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
      >
        <Trash2 size={14} />
        Remove
      </button>
    </article>
  );
}
