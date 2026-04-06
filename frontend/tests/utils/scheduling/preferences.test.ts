import { beforeEach, describe, expect, it } from 'vitest';
import { readPreferredTimeslotsBySnapshot } from '../../../src/utils/scheduling/preferences';

describe('Scheduling Preference Utility - Session Preference Normalization', () => {
  /**
   * Suite description:
   * Verifies safe reading and normalization of preferred timeslot mappings from browser session storage.
   */

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should return empty mapping when snapshot id is null', () => {
    // Arrange / Act
    const result = readPreferredTimeslotsBySnapshot(null);

    // Assert
    expect(result).toEqual({});
  });

  it('should return empty mapping when no sessionStorage entry exists', () => {
    // Arrange / Act
    const result = readPreferredTimeslotsBySnapshot('snapshot-1');

    // Assert
    expect(result).toEqual({});
  });

  it('should keep only string arrays and remove invalid entries during normalization', () => {
    // Arrange
    sessionStorage.setItem(
      'classPreferredSlotsBySnapshot:snapshot-2',
      JSON.stringify({
        'course-1': ['slot-1', 'slot-2'],
        'course-2': [123, 'slot-3', false],
        'course-3': 'invalid',
      }),
    );

    // Act
    const result = readPreferredTimeslotsBySnapshot('snapshot-2');

    // Assert
    expect(result).toEqual({
      'course-1': ['slot-1', 'slot-2'],
      'course-2': ['slot-3'],
    });
  });

  it('should return empty mapping when session storage contains invalid JSON', () => {
    // Arrange
    sessionStorage.setItem('classPreferredSlotsBySnapshot:snapshot-3', '{bad json');

    // Act
    const result = readPreferredTimeslotsBySnapshot('snapshot-3');

    // Assert
    expect(result).toEqual({});
  });
});
