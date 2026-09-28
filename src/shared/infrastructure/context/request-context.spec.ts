import { currentRequestId, runWithRequestId } from './request-context';

describe('request context', () => {
  it('gives the request id to everything that runs within it, even after awaiting', async () => {
    const seen = await runWithRequestId('req-1', async () => {
      await Promise.resolve();
      return currentRequestId();
    });

    expect(seen).toBe('req-1');
    expect(currentRequestId()).toBe('unknown');
  });
});
