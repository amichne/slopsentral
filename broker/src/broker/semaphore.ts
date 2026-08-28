export class BoundedSemaphore {
  readonly #capacity: number;
  #inUse = 0;

  constructor(capacity: number) {
    this.#capacity = capacity;
  }

  tryAcquire(): (() => void) | undefined {
    if (this.#inUse >= this.#capacity) {
      return undefined;
    }
    this.#inUse += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#inUse -= 1;
    };
  }
}
