export function toPrettyDateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function normalizeWeekdayToMondayBasedIndex(rawDay: string | null): number | null {
  if (!rawDay) {
    return null;
  }

  const value = rawDay.trim().toLowerCase();
  const dayMap: Record<string, number> = {
    monday: 0,
    mon: 0,
    tuesday: 1,
    tue: 1,
    tues: 1,
    wednesday: 2,
    wed: 2,
    thursday: 3,
    thu: 3,
    thur: 3,
    thurs: 3,
    friday: 4,
    fri: 4,
    saturday: 5,
    sat: 5,
    sunday: 6,
    sun: 6,
  };

  return dayMap[value] ?? null;
}

export function toMondayBasedWeekdayIndexFromIsoDate(isoDate: string | null): number | null {
  if (!isoDate) {
    return null;
  }

  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const sundayBased = parsed.getDay();
  return (sundayBased + 6) % 7;
}

export function buildProgramYearCourseKey(programValue: string, programYearCourseId: string | null): string | null {
  if (!programYearCourseId) {
    return null;
  }
  return `${programValue}:${programYearCourseId}`;
}

export function buildCourseYearKey(programValue: string, courseId: string, year: number): string {
  return `${programValue}:${courseId}:${year}`;
}
