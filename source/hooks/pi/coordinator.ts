import type { HookResult } from "./runtime.ts";
import type { HookPolicy } from "./settings.ts";

export class HookCoordinator {
  private generation = 0;
  private readonly jobs = new Map<string, { controller: AbortController; promise: Promise<HookResult | undefined> }>();
  private backgroundTail: Promise<unknown> = Promise.resolve();
  readonly recent: { key: string; outcome: string }[] = [];
  get pending(): readonly string[] { return [...this.jobs.keys()]; }
  async submit(key: string, policy: HookPolicy, run: (signal: AbortSignal) => Promise<HookResult>,
    deliver: (result: HookResult) => void, valid: () => boolean): Promise<HookResult | undefined> {
    const existing = this.jobs.get(key);
    if (existing) return policy.execution === "foreground" ? existing.promise : undefined;
    if (this.jobs.size >= 32) {
      const result: HookResult = { type: "rejected", code: "QUEUE_FULL" };
      if (valid()) deliver(result);
      return result;
    }
    const generation = this.generation;
    const controller = new AbortController();
    const current = () => generation === this.generation && !controller.signal.aborted && valid();
    const work = async (): Promise<HookResult | undefined> => {
      if (!current()) return undefined;
      let result: HookResult;
      try { result = await run(controller.signal); }
      catch { result = { type: "rejected", code: "ADAPTER_FAILED" }; }
      if (!current()) return undefined;
      this.recent.push({ key, outcome: result.type === "rejected" ? result.code : "COMPLETED" });
      if (this.recent.length > 32) this.recent.shift();
      if (this.jobs.get(key)?.controller === controller) this.jobs.delete(key);
      deliver(result);
      return result;
    };
    // Start on a microtask so the job exists before its completion or callback.
    const pending = (policy.execution === "background" ? this.backgroundTail : Promise.resolve()).then(work);
    const promise = pending.finally(() => { if (this.jobs.get(key)?.controller === controller) this.jobs.delete(key); });
    this.jobs.set(key, { controller, promise });
    if (policy.execution === "background") {
      this.backgroundTail = promise;
      // Unexpected adapter defects remain distinct from domain failures. Keep the queue usable.
      void promise.catch(() => { if (generation === this.generation && !controller.signal.aborted) this.recent.push({ key, outcome: "ADAPTER_DEFECT" }); });
      this.backgroundTail = promise.catch(() => undefined);
      return undefined;
    }
    return promise;
  }
  cancel(key: string): void {
    const job = this.jobs.get(key);
    if (job) { job.controller.abort(); this.jobs.delete(key); this.recent.push({ key, outcome: "CANCELLATION_REQUESTED" }); if (this.recent.length > 32) this.recent.shift(); }
  }
  invalidate(): void {
    this.generation++;
    for (const job of this.jobs.values()) job.controller.abort();
    this.jobs.clear();
    this.backgroundTail = Promise.resolve();
  }
}
