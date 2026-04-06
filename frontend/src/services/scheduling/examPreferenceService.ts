import type { ScheduleExamEntryDto } from '../../api/scheduling';
import { buildCourseYearKey, buildProgramYearCourseKey, toMondayBasedWeekdayIndexFromIsoDate } from '../../utils/scheduling/examDate';

export type PreferredWeekdayStatus = {
  label: string;
  className: string;
  title: string;
};

export function buildPreferredWeekdayStatusByEntryId(input: {
  entries: ScheduleExamEntryDto[];
  preferredWeekdaysByProgramYearCourseKey: Record<string, number[]>;
  preferredWeekdaysByCourseYearKey: Record<string, number[]>;
}): Map<string, PreferredWeekdayStatus> {
  const { entries, preferredWeekdaysByProgramYearCourseKey, preferredWeekdaysByCourseYearKey } = input;
  const result = new Map<string, PreferredWeekdayStatus>();

  for (const entry of entries) {
    const pycKey = buildProgramYearCourseKey(entry.program_value, entry.program_year_course_id);
    const preferredByPyc = pycKey ? preferredWeekdaysByProgramYearCourseKey[pycKey] ?? [] : [];
    const fallbackKey = buildCourseYearKey(entry.program_value, entry.course_id, entry.year);
    const preferredWeekdays = preferredByPyc.length > 0 ? preferredByPyc : preferredWeekdaysByCourseYearKey[fallbackKey] ?? [];

    if (!entry.exam_date) {
      result.set(entry.id, {
        label: 'Preferred weekday: pending',
        className: 'bg-slate-100 text-slate-700',
        title: 'Exam date is not assigned yet.',
      });
      continue;
    }

    if (preferredWeekdays.length === 0) {
      result.set(entry.id, {
        label: 'Preferred weekday: no data',
        className: 'bg-slate-100 text-slate-700',
        title: 'No class weekday preference data was found for this subject.',
      });
      continue;
    }

    const assignedWeekday = toMondayBasedWeekdayIndexFromIsoDate(entry.exam_date);
    if (assignedWeekday !== null && preferredWeekdays.includes(assignedWeekday)) {
      result.set(entry.id, {
        label: 'Preferred weekday: matched',
        className: 'bg-emerald-100 text-emerald-800',
        title: "Assigned exam date matches this subject's preferred weekday.",
      });
    } else {
      result.set(entry.id, {
        label: 'Preferred weekday: not matched',
        className: 'bg-amber-100 text-amber-800',
        title: "Assigned exam date does not match this subject's preferred weekday.",
      });
    }
  }

  return result;
}
