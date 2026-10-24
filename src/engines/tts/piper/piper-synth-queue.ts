export interface PiperQueueJob {
  readonly jobId: string;
  readonly phonemeIds: Int32Array;
  readonly speakerId?: number;
  readonly signal?: AbortSignal;
}

/**
 * Single-thread sentence synth queue with cancellation. One job runs at a time.
 */
export class PiperSynthQueue {
  private readonly pending: PiperQueueJob[] = [];
  private active: PiperQueueJob | undefined;
  private cancelled = new Set<string>();
  private running = false;

  enqueue(job: PiperQueueJob): void {
    if (this.cancelled.has(job.jobId)) {
      return;
    }
    this.pending.push(job);
  }

  cancel(jobId?: string): void {
    if (jobId === undefined) {
      for (const job of this.pending) {
        this.cancelled.add(job.jobId);
      }
      this.pending.length = 0;
      if (this.active) {
        this.cancelled.add(this.active.jobId);
      }
      return;
    }
    this.cancelled.add(jobId);
    const idx = this.pending.findIndex((j) => j.jobId === jobId);
    if (idx >= 0) {
      this.pending.splice(idx, 1);
    }
  }

  depth(): number {
    return this.pending.length + (this.active ? 1 : 0);
  }

  activeJobId(): string | undefined {
    return this.active?.jobId;
  }

  async drain(
    runner: (job: PiperQueueJob) => Promise<void>,
    onIdle?: () => void,
  ): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      while (this.pending.length > 0) {
        const job = this.pending.shift();
        if (!job || this.cancelled.has(job.jobId)) {
          continue;
        }
        this.active = job;
        if (job.signal?.aborted || this.cancelled.has(job.jobId)) {
          this.active = undefined;
          continue;
        }
        try {
          await runner(job);
        } finally {
          this.active = undefined;
        }
      }
    } finally {
      this.running = false;
      onIdle?.();
    }
  }

  isCancelled(jobId: string): boolean {
    return this.cancelled.has(jobId);
  }
}
