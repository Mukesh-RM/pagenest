import '../test/setup';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { parseCssTime, prefersReducedMotion, readDurationMs, useReducedMotion } from './motion';

describe('motion helpers', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-reduce-motion');
    document.documentElement.style.removeProperty('--pn-duration-slow');
  });

  it('parses CSS times', () => {
    expect(parseCssTime('250ms')).toBe(250);
    expect(parseCssTime(' 0.2s ')).toBe(200);
    expect(parseCssTime('0')).toBe(0);
    expect(parseCssTime('')).toBeNaN();
  });

  it('reads a duration token and falls back when styles are missing', () => {
    expect(readDurationMs('--pn-duration-slow', 250)).toBe(250);
    document.documentElement.style.setProperty('--pn-duration-slow', '0ms');
    expect(readDurationMs('--pn-duration-slow', 250)).toBe(0);
  });

  it('data-reduce-motion overrides the system setting in both directions', () => {
    document.documentElement.setAttribute('data-reduce-motion', 'true');
    expect(prefersReducedMotion()).toBe(true);
    document.documentElement.setAttribute('data-reduce-motion', 'false');
    expect(prefersReducedMotion()).toBe(false);
  });

  it('useReducedMotion follows the attribute', async () => {
    function Probe() {
      return <p>{String(useReducedMotion())}</p>;
    }
    render(<Probe />);
    expect(screen.getByText('false')).toBeInTheDocument();
    await act(async () => {
      document.documentElement.setAttribute('data-reduce-motion', 'true');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByText('true')).toBeInTheDocument();
  });
});
