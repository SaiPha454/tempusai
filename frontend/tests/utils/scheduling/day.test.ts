import { describe, expect, it } from 'vitest';
import { getDayRank, normalizeDayValue } from '../../../src/utils/scheduling/day';

describe('Scheduling Day Utility - Day Normalization and Ranking', () => {
  /**
   * Suite description:
   * Verifies canonical day normalization from user/resource inputs and deterministic weekday ranking.
   */

  it('should normalize abbreviated day names to canonical weekday values', () => {
    // Arrange / Act
    const normalized = normalizeDayValue('thu');

    // Assert
    expect(normalized).toBe('Thursday');
  });

  it('should normalize mixed-case and whitespace-padded day values', () => {
    // Arrange / Act
    const normalized = normalizeDayValue('   FrIdAy   ');

    // Assert
    expect(normalized).toBe('Friday');
  });

  it('should return null for invalid day value', () => {
    // Arrange / Act
    const normalized = normalizeDayValue('holiday');

    // Assert
    expect(normalized).toBeNull();
  });

  it('should return Monday rank as 0 and Sunday rank as 6', () => {
    // Arrange / Act
    const mondayRank = getDayRank('Monday');
    const sundayRank = getDayRank('Sunday');

    // Assert
    expect(mondayRank).toBe(0);
    expect(sundayRank).toBe(6);
  });

  it('should return fallback rank 99 when day cannot be normalized', () => {
    // Arrange / Act
    const rank = getDayRank('invalid-day');

    // Assert
    expect(rank).toBe(99);
  });
});
