import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { Coalescer } from '../../src/watch/coalescer.js';
import { WatchModeFeature } from '../../requirements/features/watch-mode.js';

/**
 * Fake scheduler — gives tests deterministic control over when timers
 * fire. tick(n) runs all timers whose `due` is ≤ now+n; multiple
 * advance steps allow simulating debounce expirations precisely.
 */
class FakeScheduler {
  private now = 0;
  private nextId = 1;
  private readonly timers = new Map<number, { due: number; fn: () => void }>();

  setTimeout(fn: () => void, ms: number): number {
    const id = this.nextId++;
    this.timers.set(id, { due: this.now + ms, fn });
    return id;
  }
  clearTimeout(id: any): void {
    this.timers.delete(id as number);
  }
  /** Advance virtual time and fire all due timers in order. */
  async tick(ms: number): Promise<void> {
    this.now += ms;
    const due = [...this.timers.entries()]
      .filter(([, t]) => t.due <= this.now)
      .sort(([, a], [, b]) => a.due - b.due);
    for (const [id, t] of due) {
      this.timers.delete(id);
      t.fn();
      // Yield microtasks so any awaited fire() can progress.
      await Promise.resolve();
      await Promise.resolve();
    }
  }
}

@FeatureTest(WatchModeFeature)
class WatchCoalescerTests {
  @Verifies<WatchModeFeature>('closeCancelsPendingWorkAndWaitsForActiveRun')
  async closeCancelsPendingWorkAndWaitsForActiveRun() {
    const schedule = new FakeScheduler(), reasons: string[] = [];
    let release!: () => void;
    const active = new Promise<void>(resolve => { release = resolve; });
    const coalescer = new Coalescer({ debounceMs: 1, schedule, run: async reason => { reasons.push(reason); await active; } });
    const running = coalescer.runNow('active');
    coalescer.notify('queued'); await schedule.tick(1);
    coalescer.notify('pending');
    let closed = false;
    const closing = coalescer.close().then(() => { closed = true; });
    await Promise.resolve(); expect(closed).toBe(false);
    coalescer.notify('after-close'); await schedule.tick(2);
    release(); await running; await closing;
    expect(closed).toBe(true); expect(coalescer.isRunning).toBe(false);
    await coalescer.runNow('after-close'); await coalescer.close();
    expect(reasons).toEqual(['active']);
    const idle = new Coalescer({ debounceMs: 1, run: async reason => { reasons.push(reason); } });
    idle.notify('cancelled'); await idle.close();
    expect(reasons).toEqual(['active']);
  }

  @Verifies<WatchModeFeature>('debounceCollapsesBurstToSingleRun')
  async defaultSchedulerExecutesTheLastNotification() {
    const reasons:string[]=[];
    let done!:()=>void;
    const completion=new Promise<void>(resolve=>{done=resolve;});
    const c=new Coalescer({debounceMs:1,run:async reason=>{reasons.push(reason);done();}});
    c.notify('first');c.notify('last');
    await completion;
    expect(reasons).toEqual(['last']);
  }
  @Verifies<WatchModeFeature>('debounceCollapsesBurstToSingleRun')
  async burstCollapsesToOne() {
    const sched = new FakeScheduler();
    const reasons: string[] = [];
    const c = new Coalescer({
      debounceMs: 100,
      run: async (r) => { reasons.push(r); },
      schedule: sched,
    });
    c.notify('a');
    c.notify('b');
    c.notify('c');
    expect(reasons).toEqual([]);
    await sched.tick(50);
    expect(reasons).toEqual([]);
    await sched.tick(60);   // total 110 ms — past debounce window
    expect(reasons).toEqual(['c']);  // last reason wins
  }

  @Verifies<WatchModeFeature>('concurrentNotifyQueuesExactlyOneAdditionalRun')
  async concurrentNotifyQueuesOne() {
    const sched = new FakeScheduler();
    const reasons: string[] = [];
    let runResolve!: () => void;
    const runPromise = new Promise<void>(r => { runResolve = r; });
    const c = new Coalescer({
      debounceMs: 50,
      run: async (r) => {
        reasons.push(r);
        if (reasons.length === 1) await runPromise;  // first run blocks until released
      },
      schedule: sched,
    });

    c.notify('first');
    await sched.tick(60);   // first run starts and blocks
    expect(reasons).toEqual(['first']);
    expect(c.isRunning).toBe(true);

    // 5 notifies during the in-progress run — should collapse to 1 queued
    c.notify('mid-1');
    c.notify('mid-2');
    c.notify('mid-3');
    await sched.tick(60);
    c.notify('mid-4');
    c.notify('mid-5');
    await sched.tick(60);

    runResolve();
    await new Promise(r => setTimeout(r, 0));   // let queued run drain
    await new Promise(r => setTimeout(r, 0));

    expect(reasons.length).toBe(2);
    expect(reasons[0]).toBe('first');
    expect(reasons[1]).toBe('queued change');
  }

  @Verifies<WatchModeFeature>('runNowTriggersImmediateInitialRun')
  async runNowFiresImmediately() {
    const sched = new FakeScheduler();
    const reasons: string[] = [];
    const c = new Coalescer({
      debounceMs: 999_999,   // very long — proves runNow bypasses debounce
      run: async (r) => { reasons.push(r); },
      schedule: sched,
    });
    await c.runNow('initial');
    expect(reasons).toEqual(['initial']);
  }
}

export { WatchCoalescerTests };
