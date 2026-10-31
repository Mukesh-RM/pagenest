import { describe, expect, it } from 'vitest';
import { parseCustomSleepMinutes, SLEEP_PRESET_MINUTES } from './sleep-timer-presets';

describe('sleep-timer-presets', () => {
  it('lists all required preset durations', () => {
    expect([...SLEEP_PRESET_MINUTES]).toEqual([5, 10, 15, 30, 45, 60]);
  });

  it('validates custom minute input', () => {
    expect(parseCustomSleepMinutes('12')).toBe(12);
    expect(parseCustomSleepMinutes('0')).toBeUndefined();
    expect(parseCustomSleepMinutes('999')).toBeUndefined();
    expect(parseCustomSleepMinutes('')).toBeUndefined();
  });
});
