import type { MatrixBucket, WeekDay } from '../../types/scheduling';
import { DAYS_OF_WEEK, MATRIX_BUCKET_ORDER } from '../../types/scheduling';
import { detectBucketFromTimeLabel, formatTimeslotResourceLabel, normalizeDayValue } from '../../utils/scheduling';

type TimeslotLike = {
  id: string;
  day: string;
  label: string;
};

type EntryLike = {
  id: string;
  day: string | null;
  timeslot_id: string | null;
  timeslot_label: string | null;
};

export function buildTimeslotsByDay(timeslots: TimeslotLike[]): Map<WeekDay, TimeslotLike[]> {
  const map = new Map<WeekDay, TimeslotLike[]>();
  for (const day of DAYS_OF_WEEK) {
    map.set(day, []);
  }

  for (const slot of timeslots) {
    const normalizedDay = normalizeDayValue(slot.day);
    if (!normalizedDay) {
      continue;
    }

    const daySlots = map.get(normalizedDay) ?? [];
    daySlots.push(slot);
    map.set(normalizedDay, daySlots);
  }

  for (const day of DAYS_OF_WEEK) {
    const sorted = [...(map.get(day) ?? [])].sort((left, right) => {
      const rankDiff = bucketRank(left.label) - bucketRank(right.label);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return left.label.localeCompare(right.label);
    });
    map.set(day, sorted);
  }

  return map;
}

export function buildAllTimeslotsSorted(timeslots: TimeslotLike[]): TimeslotLike[] {
  const dayOrder = new Map(DAYS_OF_WEEK.map((day, index) => [day, index]));
  return [...timeslots].sort((left, right) => {
    const leftDay = normalizeDayValue(left.day);
    const rightDay = normalizeDayValue(right.day);
    const leftRank = leftDay ? (dayOrder.get(leftDay) ?? 99) : 99;
    const rightRank = rightDay ? (dayOrder.get(rightDay) ?? 99) : 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.label.localeCompare(right.label);
  });
}

export function buildBucketRows(timeslots: TimeslotLike[]): Array<{ key: MatrixBucket; label: string }> {
  const firstByBucket = new Map<MatrixBucket, string>();
  for (const slot of timeslots) {
    const bucket = detectBucketFromTimeLabel(slot.label);
    if (!bucket || firstByBucket.has(bucket)) {
      continue;
    }
    firstByBucket.set(bucket, formatTimeslotResourceLabel(slot.label));
  }

  return MATRIX_BUCKET_ORDER.map((bucket) => ({
    key: bucket,
    label: firstByBucket.get(bucket) ?? 'Not configured',
  }));
}

export function resolveTimeslotIdByDayBucket(
  timeslotsByDay: Map<WeekDay, TimeslotLike[]>,
  day: WeekDay,
  bucket: MatrixBucket,
): string | null {
  const daySlots = timeslotsByDay.get(day) ?? [];
  const preferredByLabel = daySlots.find((slot) => detectBucketFromTimeLabel(slot.label) === bucket);
  return preferredByLabel?.id ?? null;
}

export function resolveEntryDay(
  entry: EntryLike,
  timeslotById: Map<string, TimeslotLike>,
): WeekDay | null {
  const slotById = entry.timeslot_id ? timeslotById.get(entry.timeslot_id) : undefined;
  return normalizeDayValue(slotById?.day ?? entry.day);
}

export function resolveEntryBucket(
  entry: EntryLike,
  timeslotById: Map<string, TimeslotLike>,
  timeslotsByDay: Map<WeekDay, TimeslotLike[]>,
): MatrixBucket | null {
  const byLabel = detectBucketFromTimeLabel(entry.timeslot_label);
  if (byLabel) {
    return byLabel;
  }

  const slotById = entry.timeslot_id ? timeslotById.get(entry.timeslot_id) : undefined;
  const byLookupLabel = detectBucketFromTimeLabel(slotById?.label ?? null);
  if (byLookupLabel) {
    return byLookupLabel;
  }

  if (!entry.day || !entry.timeslot_id) {
    return null;
  }

  const resolvedDay = normalizeDayValue(slotById?.day ?? entry.day);
  if (!resolvedDay) {
    return null;
  }

  const daySlots = timeslotsByDay.get(resolvedDay) ?? [];
  const index = daySlots.findIndex((slot) => slot.id === entry.timeslot_id);
  if (index <= 0) {
    return 'morning';
  }
  if (index === 1) {
    return 'afternoon';
  }
  return 'evening';
}

function bucketRank(slotLabel: string): number {
  const bucket = detectBucketFromTimeLabel(slotLabel);
  if (bucket === 'morning') {
    return 0;
  }
  if (bucket === 'afternoon') {
    return 1;
  }
  if (bucket === 'evening') {
    return 2;
  }
  return 9;
}
