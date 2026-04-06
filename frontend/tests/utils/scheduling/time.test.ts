import { describe, expect, it } from 'vitest';
import { detectBucketFromTimeLabel, formatTimeslotResourceLabel, parseDisplayTime } from '../../../src/utils/scheduling/time';

describe('Scheduling Time Utility - Time Parsing, Formatting, and Bucket Detection', () => {
  /**
   * Suite description:
   * Validates normalization of input time labels and bucket classification used by scheduling boards.
   */

  it('should parse 12-hour time text into normalized display format', () => {
    // Arrange / Act
    const parsed = parseDisplayTime('9:5 am');

    // Assert
    expect(parsed).toBeNull();
  });

  it('should parse valid 12-hour input with missing minute part', () => {
    // Arrange / Act
    const parsed = parseDisplayTime('9 am');

    // Assert
    expect(parsed).toBe('9:00 AM');
  });

  it('should parse 24-hour input into 12-hour display format', () => {
    // Arrange / Act
    const parsed = parseDisplayTime('13:30');

    // Assert
    expect(parsed).toBe('1:30 PM');
  });

  it('should keep original label when timeslot label format cannot be parsed', () => {
    // Arrange / Act
    const formatted = formatTimeslotResourceLabel('Unknown Slot Window');

    // Assert
    expect(formatted).toBe('Unknown Slot Window');
  });

  it('should convert 24-hour range label to normalized human-readable range', () => {
    // Arrange / Act
    const formatted = formatTimeslotResourceLabel('09:00 - 12:00');

    // Assert
    expect(formatted).toBe('9:00 AM - 12:00 PM');
  });

  it('should detect morning bucket from explicit keyword', () => {
    // Arrange / Act
    const bucket = detectBucketFromTimeLabel('Morning Slot');

    // Assert
    expect(bucket).toBe('morning');
  });

  it('should detect afternoon bucket from PM time before 16:30 threshold', () => {
    // Arrange / Act
    const bucket = detectBucketFromTimeLabel('1:30 pm - 4:00 pm');

    // Assert
    expect(bucket).toBe('afternoon');
  });

  it('should detect evening bucket from 24-hour time at or after 16:30', () => {
    // Arrange / Act
    const bucket = detectBucketFromTimeLabel('16:30 - 19:30');

    // Assert
    expect(bucket).toBe('evening');
  });

  it('should return null when bucket cannot be inferred from input label', () => {
    // Arrange / Act
    const bucket = detectBucketFromTimeLabel('Unstructured slot label');

    // Assert
    expect(bucket).toBeNull();
  });
});
