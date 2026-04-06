import { DAYS_OF_WEEK, type WeekDay } from '../../types/scheduling';

const DAY_ALIASES: Record<string, WeekDay> = {
  mon: 'Monday',
  monday: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  tuesday: 'Tuesday',
  wed: 'Wednesday',
  weds: 'Wednesday',
  wednesday: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  thursday: 'Thursday',
  fri: 'Friday',
  friday: 'Friday',
  sat: 'Saturday',
  saturday: 'Saturday',
  sun: 'Sunday',
  sunday: 'Sunday',
};

export function normalizeDayValue(dayValue: string | null | undefined): WeekDay | null {
  if (!dayValue) {
    return null;
  }
  const key = dayValue.trim().toLowerCase();
  return DAY_ALIASES[key] ?? null;
}

export function getDayRank(day: string | null | undefined): number {
  const normalized = normalizeDayValue(day);
  if (!normalized) {
    return 99;
  }
  return DAYS_OF_WEEK.indexOf(normalized);
}
