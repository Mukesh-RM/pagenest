import { describe, expect, it } from 'vitest';
import { shouldCheckForUpdate, updateUi, UPDATE_CHECK_GAP_MS } from './update-flow';

describe('updateUi', () => {
  it('shows nothing when no new version is waiting', () => {
    expect(updateUi({ needRefresh: false, isPlaying: false })).toEqual({ kind: 'none' });
    expect(updateUi({ needRefresh: false, isPlaying: true })).toEqual({ kind: 'none' });
  });
  it('offers Refresh when a new version waits and nothing is playing', () => {
    expect(updateUi({ needRefresh: true, isPlaying: false })).toEqual({ kind: 'refresh' });
  });
  it('never offers Refresh while audio plays: the update waits for the next launch', () => {
    expect(updateUi({ needRefresh: true, isPlaying: true })).toEqual({ kind: 'next-launch' });
  });
  it('stays quiet after the user dismissed the notice', () => {
    expect(updateUi({ needRefresh: true, isPlaying: false, dismissed: true })).toEqual({ kind: 'none' });
  });
});

describe('shouldCheckForUpdate', () => {
  it('waits six hours between checks', () => {
    expect(shouldCheckForUpdate(1000, 1000)).toBe(false);
    expect(shouldCheckForUpdate(UPDATE_CHECK_GAP_MS - 1, 0)).toBe(false);
    expect(shouldCheckForUpdate(UPDATE_CHECK_GAP_MS, 0)).toBe(true);
  });
});
