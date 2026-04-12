import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../../utils/dateUtils';

describe('formatRelativeTime', () => {
  it('returns empty string for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('');
  });

  it('returns "now" for less than 1 minute', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('now');
  });

  it('returns "Yesterday" for 1 day ago', () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    expect(formatRelativeTime(date)).toBe('Yesterday');
  });
});
