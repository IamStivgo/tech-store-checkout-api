import type { Sleeper } from '../../domain/sleeper.port';

export class SystemSleeper implements Sleeper {
  sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
