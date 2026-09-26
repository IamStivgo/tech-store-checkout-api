import { SystemClock } from './system-clock';

describe('SystemClock', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the current system time', () => {
    jest.useFakeTimers({ now: new Date('2026-09-24T20:15:00.000Z') });

    expect(new SystemClock().now()).toEqual(new Date('2026-09-24T20:15:00.000Z'));
  });
});
