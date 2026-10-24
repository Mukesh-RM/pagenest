import { describe, expect, it } from 'vitest';
import { compareText, indexBook, normalizeText, scoreBook, searchTerms } from './library-index';
import { bookRecord } from './test-fixtures';

describe('normalizeText', () => {
  it('lowercases, drops accents and punctuation', () => {
    expect(normalizeText('  Éloïse: The   Café-Owner! ')).toBe('eloise the cafe owner');
    expect(normalizeText('Crème brûlée')).toBe('creme brulee');
  });

  it('keeps letters and digits from any script', () => {
    // Accent folding also folds й to и; the same folding is applied to the search text, so both still match.
    expect(normalizeText('Война и мир 2')).toBe(normalizeText('война и мир 2'));
    expect(normalizeText('Война и мир 2')).toContain('мир 2');
    expect(normalizeText('三体')).toBe('三体');
  });

  it('gives no terms for blank input', () => {
    expect(searchTerms('   ')).toEqual([]);
    expect(searchTerms('!!')).toEqual([]);
    expect(searchTerms('Jane  Austen')).toEqual(['jane', 'austen']);
  });
});

describe('scoreBook', () => {
  const doc = indexBook(bookRecord('1', { title: 'Pride and Prejudice', author: 'Jane Austen', narrator: 'Rosamund Pike', series: 'Classics' }));

  it('ranks title start above title word above author above inside a word above narrator', () => {
    const score = (t: string): number => scoreBook(doc, [t]);
    expect(score('pride')).toBe(6);
    expect(score('prej')).toBe(5);
    expect(score('austen')).toBe(4);
    expect(score('ejud')).toBe(3);
    expect(score('usten')).toBe(2);
    expect(score('rosamund')).toBe(1);
    expect(score('classics')).toBe(1);
    expect(score('zzz')).toBe(0);
  });

  it('needs every term to match', () => {
    expect(scoreBook(doc, ['pride', 'austen'])).toBe(10);
    expect(scoreBook(doc, ['pride', 'dickens'])).toBe(0);
  });

  it('handles books with only a title', () => {
    expect(scoreBook(indexBook(bookRecord('2', { title: 'Solo' })), ['sol'])).toBe(6);
  });
});

describe('compareText', () => {
  it('ignores case and accents and orders numbers naturally', () => {
    expect(compareText('book 2', 'Book 10')).toBeLessThan(0);
    expect(compareText('Éclair', 'eclair')).toBe(0);
    expect(compareText('apple', 'Banana')).toBeLessThan(0);
  });
});
