import { describe, expect, it } from 'vitest';
import {
  buildCourseYearKey,
  buildProgramYearCourseKey,
  normalizeWeekdayToMondayBasedIndex,
  toMondayBasedWeekdayIndexFromIsoDate,
  toPrettyDateLabel,
} from '../../../src/utils/scheduling/examDate';

describe('Exam Date Utility - Date Formatting and Weekday Keying', () => {
  /**
   * Suite description:
   * Validates ISO date conversion, weekday indexing rules, and deterministic composite key builders.
   */

  it('should generate stable human-readable label for valid ISO date', () => {
    // Arrange / Act
    const label = toPrettyDateLabel('2026-06-01');

    // Assert
    expect(label).toContain('Mon');
    expect(label).toContain('Jun');
  });

  it('should return original input when ISO date is invalid', () => {
    // Arrange / Act
    const label = toPrettyDateLabel('not-a-date');

    // Assert
    expect(label).toBe('not-a-date');
  });

  it('should normalize weekday aliases to Monday-based index', () => {
    // Arrange / Act
    const mon = normalizeWeekdayToMondayBasedIndex('mon');
    const fri = normalizeWeekdayToMondayBasedIndex('Friday');

    // Assert
    expect(mon).toBe(0);
    expect(fri).toBe(4);
  });

  it('should return null when weekday input is unknown', () => {
    // Arrange / Act
    const index = normalizeWeekdayToMondayBasedIndex('weekday-x');

    // Assert
    expect(index).toBeNull();
  });

  it('should convert ISO date into Monday-based weekday index', () => {
    // Arrange / Act
    const monday = toMondayBasedWeekdayIndexFromIsoDate('2026-06-01');
    const sunday = toMondayBasedWeekdayIndexFromIsoDate('2026-06-07');

    // Assert
    expect(monday).toBe(0);
    expect(sunday).toBe(6);
  });

  it('should return null for malformed ISO date format when computing weekday index', () => {
    // Arrange / Act
    const index = toMondayBasedWeekdayIndexFromIsoDate('2026-aa-01');

    // Assert
    expect(index).toBeNull();
  });

  it('should build program-year-course key when programYearCourseId is provided', () => {
    // Arrange / Act
    const key = buildProgramYearCourseKey('software-engineering', 'pyc-44');

    // Assert
    expect(key).toBe('software-engineering:pyc-44');
  });

  it('should return null program-year-course key when id is missing', () => {
    // Arrange / Act
    const key = buildProgramYearCourseKey('software-engineering', null);

    // Assert
    expect(key).toBeNull();
  });

  it('should build course-year fallback key for preference lookup', () => {
    // Arrange / Act
    const key = buildCourseYearKey('software-engineering', 'course-22', 3);

    // Assert
    expect(key).toBe('software-engineering:course-22:3');
  });
});
