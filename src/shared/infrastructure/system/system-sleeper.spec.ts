import { SystemSleeper } from './system-sleeper';

describe('SystemSleeper', () => {
  it('resolves after the given time', async () => {
    jest.useFakeTimers();
    const sleeping = new SystemSleeper().sleep(1000);

    jest.advanceTimersByTime(1000);

    await expect(sleeping).resolves.toBeUndefined();
    jest.useRealTimers();
  });
});
