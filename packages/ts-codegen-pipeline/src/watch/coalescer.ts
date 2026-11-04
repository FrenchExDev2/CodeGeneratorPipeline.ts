export interface CoalescerOptions {
  /** Debounce window in ms. Multiple events within this window collapse to one run. */
  readonly debounceMs: number;
  /** Async function to run when the debounce window elapses. */
  readonly run: (reason: string) => Promise<void>;
  /** Optional injection point for tests — defaults to global setTimeout/clearTimeout. */
  readonly schedule?: {
    setTimeout(fn: () => void, ms: number): { unref?(): void } | number;
    clearTimeout(id: any): void;
  };
}

/**
 * Coalesces a stream of `notify(reason)` calls into at-most-one
 * concurrent invocation of `run(reason)`, with debounce + queue:
 *
 *   - Multiple `notify()` calls within `debounceMs` collapse to a
 *     single trigger of `run`.
 *   - If `notify()` is called WHILE `run()` is in progress, exactly
 *     one additional run is queued (subsequent notifies during the
 *     same in-progress run all collapse into that single queued run).
 *   - The reason captured for the run is the LAST notify's reason
 *     in the debounce window (or `'queued change'` if it was queued).
 */
export class Coalescer {
  private pending: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private queued = false;
  private latestReason = '';
  private closed = false;
  private activeRun: Promise<void> | null = null;

  constructor(private readonly opts: CoalescerOptions) {}

  notify(reason: string): void {
    if (this.closed) return;
    this.latestReason = reason;
    const sched = this.opts.schedule ?? globalThis;
    if (this.pending) sched.clearTimeout(this.pending as never);
    this.pending = sched.setTimeout(() => {
      this.pending = null;
      void this.fire(this.latestReason);
    }, this.opts.debounceMs) as ReturnType<typeof setTimeout>;
  }

  private async fire(reason: string): Promise<void> {
    if (this.closed) return;
    if (this.running) {
      this.queued = true;
      return;
    }
    this.running = true;
    try {
      this.activeRun = this.opts.run(reason);
      await this.activeRun;
    } finally {
      this.running = false;
      this.activeRun = null;
      if (this.queued && !this.closed) {
        this.queued = false;
        await this.fire('queued change');
      }
    }
  }

  /** Trigger a run immediately (used for the initial run on watch start). */
  async runNow(reason: string): Promise<void> {
    await this.fire(reason);
  }

  /** Cancel pending/queued work and await the active run before releasing the watcher. */
  async close(): Promise<void> {
    this.closed = true;
    this.queued = false;
    if (this.pending) {
      (this.opts.schedule ?? globalThis).clearTimeout(this.pending as never);
      this.pending = null;
    }
    await this.activeRun;
  }

  /** True iff a run is currently in progress. */
  get isRunning(): boolean {
    return this.running;
  }
}
