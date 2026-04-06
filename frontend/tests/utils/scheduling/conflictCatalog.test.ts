import { describe, expect, it } from 'vitest';
import {
  hasConflictCode,
  resolveClassConflictMessage,
  resolveExamConflictMessage,
} from '../../../src/utils/scheduling/conflictCatalog';

describe('Conflict Catalog Utility - Conflict Message and Lookup Behavior', () => {
  /**
   * Suite description:
   * Validates conflict-code message resolution and conflict presence lookup used across scheduling services.
   */

  it('should return mapped class conflict message for known class conflict code', () => {
    // Arrange / Act
    const message = resolveClassConflictMessage('room_overlap');

    // Assert
    expect(message).toBe('Room has another class at this timeslot.');
  });

  it('should return default class conflict message for unknown class conflict code', () => {
    // Arrange / Act
    const message = resolveClassConflictMessage('unknown_class_conflict');

    // Assert
    expect(message).toBe('Conflict detected.');
  });

  it('should return mapped exam conflict message for known exam conflict code', () => {
    // Arrange / Act
    const message = resolveExamConflictMessage('program_year_overlap');

    // Assert
    expect(message).toBe('Same program and year already has an exam at this date and slot.');
  });

  it('should return default exam conflict message for unknown exam conflict code', () => {
    // Arrange / Act
    const message = resolveExamConflictMessage('unknown_exam_conflict');

    // Assert
    expect(message).toBe('Conflict detected.');
  });

  it('should detect whether a specific conflict code exists in conflict list', () => {
    // Arrange
    const conflicts = [
      { code: 'unassigned', message: 'Missing assignment.' },
      { code: 'room_overlap', message: 'Room overlap.' },
    ];

    // Act / Assert
    expect(hasConflictCode(conflicts, 'room_overlap')).toBe(true);
    expect(hasConflictCode(conflicts, 'year_overlap')).toBe(false);
  });
});
