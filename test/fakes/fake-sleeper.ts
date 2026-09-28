import type { Sleeper } from '../../src/shared/domain/sleeper.port';

/** Records the waits and returns at once. */
export class FakeSleeper implements Sleeper {
  readonly waits: number[] = [];

  sleep(milliseconds: number): Promise<void> {
    this.waits.push(milliseconds);
    return Promise.resolve();
  }
}
