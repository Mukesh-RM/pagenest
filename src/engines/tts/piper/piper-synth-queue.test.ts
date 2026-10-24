// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PiperSynthQueue } from './piper-synth-queue';

describe('PiperSynthQueue', () => {
  it('runs jobs in order', async () => {
    const queue = new PiperSynthQueue();
    const order: string[] = [];
    queue.enqueue({ jobId: 'a', phonemeIds: Int32Array.from([1]) });
    queue.enqueue({ jobId: 'b', phonemeIds: Int32Array.from([2]) });
    await queue.drain(async (job) => {
      order.push(job.jobId);
    });
    expect(order).toEqual(['a', 'b']);
  });

  it('skips cancelled jobs', async () => {
    const queue = new PiperSynthQueue();
    queue.enqueue({ jobId: 'a', phonemeIds: Int32Array.from([1]) });
    queue.enqueue({ jobId: 'b', phonemeIds: Int32Array.from([2]) });
    queue.cancel('a');
    const ran: string[] = [];
    await queue.drain(async (job) => {
      ran.push(job.jobId);
    });
    expect(ran).toEqual(['b']);
  });
});
