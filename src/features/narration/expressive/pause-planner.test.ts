// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { appendSilencePcm, planPauseAfterSentence } from './pause-planner';

describe('planPauseAfterSentence', () => {
  it('uses longer pause for periods', () => {
    expect(planPauseAfterSentence('Hello.').pauseAfterMs).toBeGreaterThan(
      planPauseAfterSentence('Hello,').pauseAfterMs,
    );
  });
});

describe('appendSilencePcm', () => {
  it('extends buffer', () => {
    const base = new Float32Array([0.1, 0.2]);
    const out = appendSilencePcm(base, 22050, 100);
    expect(out.length).toBeGreaterThan(base.length);
  });
});
