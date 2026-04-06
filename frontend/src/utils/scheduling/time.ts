import type { MatrixBucket } from '../../types/scheduling';

export function parseDisplayTime(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  const twelveHour = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (twelveHour) {
    const hour = Number(twelveHour[1]);
    const minute = twelveHour[2] ? Number(twelveHour[2]) : 0;
    const meridiem = twelveHour[3].toUpperCase();
    return `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`;
  }

  const twentyFourHour = trimmed.match(/^(\d{1,2})(?::(\d{2}))$/);
  if (twentyFourHour) {
    const hour24 = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    const isPm = hour24 >= 12;
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
  }

  return null;
}

export function formatTimeslotResourceLabel(label: string): string {
  const parts = label
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 2) {
    return label;
  }

  const start = parseDisplayTime(parts[0]);
  const end = parseDisplayTime(parts[1]);
  if (!start || !end) {
    return label;
  }

  return `${start} - ${end}`;
}

export function detectBucketFromTimeLabel(label: string | null | undefined): MatrixBucket | null {
  if (!label) {
    return null;
  }

  const normalized = label.toLowerCase();
  if (normalized.includes('morning')) {
    return 'morning';
  }
  if (normalized.includes('afternoon')) {
    return 'afternoon';
  }
  if (normalized.includes('evening')) {
    return 'evening';
  }

  const ampmMatch = normalized.match(/(\d{1,2})(?::\d{2})?\s*(am|pm)/);
  if (ampmMatch) {
    const hour = Number(ampmMatch[1]);
    const minutePart = normalized.match(/\d{1,2}:(\d{2})\s*(am|pm)/);
    const minute = minutePart ? Number(minutePart[1]) : 0;
    const meridiem = ampmMatch[2];
    if (meridiem === 'am') {
      return 'morning';
    }

    const hour24 = hour % 12 + 12;
    const totalMinutes = hour24 * 60 + minute;
    if (totalMinutes < 16 * 60 + 30) {
      return 'afternoon';
    }
    return 'evening';
  }

  const twentyFourMatch = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourMatch) {
    const hour = Number(twentyFourMatch[1]);
    const minute = Number(twentyFourMatch[2]);
    const totalMinutes = hour * 60 + minute;
    if (totalMinutes < 12 * 60) {
      return 'morning';
    }
    if (totalMinutes < 16 * 60 + 30) {
      return 'afternoon';
    }
    return 'evening';
  }

  return null;
}
