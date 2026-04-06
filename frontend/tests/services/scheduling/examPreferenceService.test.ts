import { describe, expect, it } from 'vitest';
import type { ScheduleExamEntryDto } from '../../../src/api/scheduling';
import { buildPreferredWeekdayStatusByEntryId } from '../../../src/services/scheduling/examPreferenceService';

function makeExamEntry(overrides: Partial<ScheduleExamEntryDto> = {}): ScheduleExamEntryDto {
  return {
    id: 'exam-pref-1',
    program_id: 'program-1',
    program_value: 'software-engineering',
    program_label: 'Software Engineering',
    program_year_course_id: 'pyc-1',
    course_id: 'course-1',
    course_code: 'CS401',
    course_name: 'Advanced Testing',
    year: 4,
    semester: '2',
    exam_type: 'final',
    exam_date: '2026-06-01',
    timeslot_code: 'morning-exam',
    room_id: 'room-1',
    room_name: 'A101',
    manually_adjusted: false,
    conflicts: [],
    ...overrides,
  };
}

describe('Exam Preference Service - Preferred Weekday Decision Logic', () => {
  /**
   * Suite description:
   * Validates the status decision logic used to classify whether assigned exam weekdays
   * match historical class-day preferences at program-year-course and fallback levels.
   */

  it('should mark status as pending when exam date is not assigned', () => {
    // Arrange
    const entry = makeExamEntry({ id: 'pending', exam_date: null });

    // Act
    const result = buildPreferredWeekdayStatusByEntryId({
      entries: [entry],
      preferredWeekdaysByProgramYearCourseKey: {},
      preferredWeekdaysByCourseYearKey: {},
    });

    // Assert
    expect(result.get(entry.id)?.label).toBe('Preferred weekday: pending');
  });

  it('should mark status as no data when no preference exists for entry', () => {
    // Arrange
    const entry = makeExamEntry({ id: 'no-data' });

    // Act
    const result = buildPreferredWeekdayStatusByEntryId({
      entries: [entry],
      preferredWeekdaysByProgramYearCourseKey: {},
      preferredWeekdaysByCourseYearKey: {},
    });

    // Assert
    expect(result.get(entry.id)?.label).toBe('Preferred weekday: no data');
  });

  it('should mark status as matched when assigned weekday is in program-year-course preferences', () => {
    // Arrange
    const entry = makeExamEntry({ id: 'matched', exam_date: '2026-06-01' }); // Monday -> 0

    // Act
    const result = buildPreferredWeekdayStatusByEntryId({
      entries: [entry],
      preferredWeekdaysByProgramYearCourseKey: {
        'software-engineering:pyc-1': [0, 2],
      },
      preferredWeekdaysByCourseYearKey: {
        'software-engineering:course-1:4': [4],
      },
    });

    // Assert
    expect(result.get(entry.id)?.label).toBe('Preferred weekday: matched');
    expect(result.get(entry.id)?.className).toContain('emerald');
  });

  it('should mark status as not matched when assigned weekday is outside preferred set', () => {
    // Arrange
    const entry = makeExamEntry({ id: 'not-matched', exam_date: '2026-06-02' }); // Tuesday -> 1

    // Act
    const result = buildPreferredWeekdayStatusByEntryId({
      entries: [entry],
      preferredWeekdaysByProgramYearCourseKey: {
        'software-engineering:pyc-1': [0, 4],
      },
      preferredWeekdaysByCourseYearKey: {},
    });

    // Assert
    expect(result.get(entry.id)?.label).toBe('Preferred weekday: not matched');
    expect(result.get(entry.id)?.className).toContain('amber');
  });

  it('should use fallback course-year preferences when program-year-course preferences are unavailable', () => {
    // Arrange
    const entry = makeExamEntry({ id: 'fallback-used', exam_date: '2026-06-05' }); // Friday -> 4

    // Act
    const result = buildPreferredWeekdayStatusByEntryId({
      entries: [entry],
      preferredWeekdaysByProgramYearCourseKey: {},
      preferredWeekdaysByCourseYearKey: {
        'software-engineering:course-1:4': [4],
      },
    });

    // Assert
    expect(result.get(entry.id)?.label).toBe('Preferred weekday: matched');
  });
});
