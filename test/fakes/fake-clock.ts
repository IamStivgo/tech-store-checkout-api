import type { Clock } from '../../src/shared/domain/clock.port';

export class FakeClock implements Clock {
  constructor(private readonly current: Date) {}

  now(): Date {
    return new Date(this.current);
  }
}
