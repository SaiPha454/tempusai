export type MatrixBucket = 'morning' | 'afternoon' | 'evening';

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type WeekDay = (typeof DAYS_OF_WEEK)[number];

export const MATRIX_BUCKET_ORDER: MatrixBucket[] = ['morning', 'afternoon', 'evening'];

export type RoomAvailabilityStatus = 'available' | 'used_draft' | 'used_confirmed';
