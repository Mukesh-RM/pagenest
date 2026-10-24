import { describe, expect, it } from 'vitest';
import { listenPath, LISTEN_ROUTE, pathForBook, readPath, READ_ROUTE } from './route-paths';

describe('route paths', () => {
  it('builds the read and listen paths', () => {
    expect(readPath('abc')).toBe('/read/abc');
    expect(listenPath('abc')).toBe('/listen/abc');
    expect(READ_ROUTE).toBe('/read/:id');
    expect(LISTEN_ROUTE).toBe('/listen/:id');
  });

  it('escapes ids so they stay one path segment', () => {
    expect(readPath('a/b?c#d')).toBe('/read/a%2Fb%3Fc%23d');
  });

  it('opens audiobooks in the player and everything else in the reader', () => {
    expect(pathForBook({ id: '1', kind: 'audio' })).toBe('/listen/1');
    for (const kind of ['ebook', 'pdf', 'doc'] as const) expect(pathForBook({ id: '1', kind })).toBe('/read/1');
  });
});
