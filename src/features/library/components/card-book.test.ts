import { describe, expect, it } from 'vitest';
import { bookRecord } from '@/data/test-fixtures';
import { toCardBook } from './card-book';

describe('toCardBook', () => {
  it('includes the uppercase format label for cards', () => {
    const card = toCardBook({ ...bookRecord('1'), percent: 12 }, undefined);
    expect(card.format).toBe('EPUB');
  });
});
