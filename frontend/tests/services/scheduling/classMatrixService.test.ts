import { describe, expect, it } from 'vitest';
import {
  buildAllTimeslotsSorted,
  buildBucketRows,
  buildTimeslotsByDay,
  resolveEntryBucket,
  resolveEntryDay,
  resolveTimeslotIdByDayBucket,
} from '../../../src/services/scheduling/classMatrixService';

type Slot = { id: string; day: string; label: string };

describe('Class Matrix Service - Schedule Grid Derivation and Slot Resolution', () => {
  /**
   * Suite description:
   * Validates matrix-oriented transformation logic that powers class scheduling boards,
   * including day normalization, bucket grouping, sorting, and entry resolution.
   */

  it('should normalize day aliases and group slots by canonical weekdays', () => {
    // Arrange
    const slots: Slot[] = [
      { id: 'slot-1', day: 'mon', label: 'Morning 09:00 - 12:00' },
      { id: 'slot-2', day: 'Monday', label: 'Afternoon 13:30 - 16:30' },
      { id: 'slot-3', day: 'Tuesday', label: 'Evening 17:00 - 20:00' },
    ];

    // Act
    const grouped = buildTimeslotsByDay(slots);

    // Assert
    expect(grouped.get('Monday')?.map((slot) => slot.id)).toEqual(['slot-1', 'slot-2']);
    expect(grouped.get('Tuesday')?.map((slot) => slot.id)).toEqual(['slot-3']);
  });

  it('should sort all timeslots by weekday rank and then by slot label', () => {
    // Arrange
    const slots: Slot[] = [
      { id: 'slot-c', day: 'Wednesday', label: 'Afternoon 13:30 - 16:30' },
      { id: 'slot-a', day: 'Monday', label: 'Morning 09:00 - 12:00' },
      { id: 'slot-b', day: 'Monday', label: 'Afternoon 13:30 - 16:30' },
    ];

    // Act
    const sorted = buildAllTimeslotsSorted(slots);

    // Assert
    expect(sorted.map((slot) => slot.id)).toEqual(['slot-b', 'slot-a', 'slot-c']);
  });

  it('should derive one display row label per matrix bucket and format 24-hour labels', () => {
    // Arrange
    const slots: Slot[] = [
      { id: 'morning', day: 'Monday', label: '09:00 - 12:00' },
      { id: 'afternoon', day: 'Monday', label: '13:30 - 16:30' },
      { id: 'evening', day: 'Monday', label: '17:00 - 20:00' },
    ];

    // Act
    const rows = buildBucketRows(slots);

    // Assert
    expect(rows).toEqual([
      { key: 'morning', label: '9:00 AM - 12:00 PM' },
      { key: 'afternoon', label: '1:30 PM - 4:30 PM' },
      { key: 'evening', label: '5:00 PM - 8:00 PM' },
    ]);
  });

  it('should resolve slot id for a given day and bucket when a matching slot exists', () => {
    // Arrange
    const grouped = buildTimeslotsByDay([
      { id: 'slot-morning', day: 'Monday', label: 'Morning 09:00 - 12:00' },
      { id: 'slot-afternoon', day: 'Monday', label: 'Afternoon 13:30 - 16:30' },
    ]);

    // Act
    const resolved = resolveTimeslotIdByDayBucket(grouped, 'Monday', 'afternoon');

    // Assert
    expect(resolved).toBe('slot-afternoon');
  });

  it('should return null for day-bucket resolution when no matching slot exists', () => {
    // Arrange
    const grouped = buildTimeslotsByDay([{ id: 'slot-morning', day: 'Monday', label: 'Morning 09:00 - 12:00' }]);

    // Act
    const resolved = resolveTimeslotIdByDayBucket(grouped, 'Monday', 'evening');

    // Assert
    expect(resolved).toBeNull();
  });

  it('should resolve entry day using slot metadata before fallback to entry day field', () => {
    // Arrange
    const entry = { id: 'entry-1', day: 'Sunday', timeslot_id: 'slot-1', timeslot_label: null };
    const timeslotById = new Map<string, Slot>([[
      'slot-1',
      { id: 'slot-1', day: 'Tuesday', label: 'Morning 09:00 - 12:00' },
    ]]);

    // Act
    const resolvedDay = resolveEntryDay(entry, timeslotById);

    // Assert
    expect(resolvedDay).toBe('Tuesday');
  });

  it('should resolve entry bucket directly from timeslot label when label contains bucket keyword', () => {
    // Arrange
    const entry = { id: 'entry-2', day: 'Monday', timeslot_id: 'slot-2', timeslot_label: 'Evening 17:00 - 20:00' };
    const timeslotById = new Map<string, Slot>([['slot-2', { id: 'slot-2', day: 'Monday', label: '09:00 - 12:00' }]]);
    const timeslotsByDay = buildTimeslotsByDay([{ id: 'slot-2', day: 'Monday', label: '09:00 - 12:00' }]);

    // Act
    const bucket = resolveEntryBucket(entry, timeslotById, timeslotsByDay);

    // Assert
    expect(bucket).toBe('evening');
  });

  it('should resolve entry bucket by fallback index when label has no bucket keyword', () => {
    // Arrange
    const daySlots: Slot[] = [
      { id: 'slot-1', day: 'Monday', label: 'Slot A' },
      { id: 'slot-2', day: 'Monday', label: 'Slot B' },
      { id: 'slot-3', day: 'Monday', label: 'Slot C' },
    ];
    const entry = { id: 'entry-3', day: 'Monday', timeslot_id: 'slot-2', timeslot_label: null };
    const timeslotById = new Map<string, Slot>(daySlots.map((slot) => [slot.id, slot]));
    const timeslotsByDay = new Map<any, any>([['Monday', daySlots]]);

    // Act
    const bucket = resolveEntryBucket(entry, timeslotById, timeslotsByDay);

    // Assert
    expect(bucket).toBe('afternoon');
  });
});
