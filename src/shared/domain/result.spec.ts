import { combine, err, errAsync, ok, okAsync, ResultAsync, type Result } from './result';

const double = (value: number): number => value * 2;
const toMessage = (error: string): string => `failed: ${error}`;
const unexpected = (): never => {
  throw new Error('This callback must not run');
};

const matchToText = <T, E>(result: Result<T, E>): string =>
  result.match({ ok: (value) => `ok:${String(value)}`, err: (error) => `err:${String(error)}` });

describe('Result', () => {
  describe('ok', () => {
    it('exposes the value and its state', () => {
      const result = ok(21);

      expect(result.isOk).toBe(true);
      expect(result.isErr).toBe(false);
      expect(result.isOk && result.value).toBe(21);
    });

    it('maps the value and leaves errors untouched', () => {
      expect(matchToText(ok(21).map(double))).toBe('ok:42');
      expect(matchToText(ok<number, string>(21).mapErr(unexpected))).toBe('ok:21');
    });

    it('chains the next step with andThen', () => {
      expect(matchToText(ok(21).andThen((value) => ok(double(value))))).toBe('ok:42');
      expect(matchToText(ok(21).andThen(() => err('rejected')))).toBe('err:rejected');
    });

    it('chains an async step with asyncAndThen', async () => {
      const result = await ok(21).asyncAndThen((value) => okAsync(double(value)));

      expect(matchToText(result)).toBe('ok:42');
    });
  });

  describe('err', () => {
    it('exposes the error and its state', () => {
      const result = err('boom');

      expect(result.isOk).toBe(false);
      expect(result.isErr).toBe(true);
      expect(result.isErr && result.error).toBe('boom');
    });

    it('skips map, andThen and asyncAndThen', async () => {
      const failure = err<string, number>('boom');

      expect(matchToText(failure.map(unexpected))).toBe('err:boom');
      expect(matchToText(failure.andThen(unexpected))).toBe('err:boom');
      expect(matchToText(await failure.asyncAndThen(unexpected))).toBe('err:boom');
    });

    it('maps the error with mapErr', () => {
      expect(matchToText(err('boom').mapErr(toMessage))).toBe('err:failed: boom');
    });
  });
});

describe('ResultAsync', () => {
  it('wraps a resolved promise as ok', async () => {
    const result = await ResultAsync.fromPromise(Promise.resolve(21), () => 'never');

    expect(matchToText(result)).toBe('ok:21');
  });

  it('converts a rejected promise into a typed error instead of rejecting', async () => {
    const result = await ResultAsync.fromPromise(
      Promise.reject(new Error('socket hang up')),
      (cause) => `persistence: ${(cause as Error).message}`,
    );

    expect(matchToText(result)).toBe('err:persistence: socket hang up');
  });

  it('maps values with sync and async functions', async () => {
    const result = await okAsync(20)
      .map((value) => value + 1)
      .map(async (value) => Promise.resolve(double(value)));

    expect(matchToText(result)).toBe('ok:42');
  });

  it('maps errors with sync and async functions', async () => {
    const result = await errAsync('boom')
      .mapErr(toMessage)
      .mapErr(async (error) => Promise.resolve(error.toUpperCase()));

    expect(matchToText(result)).toBe('err:FAILED: BOOM');
  });

  it('leaves the other track untouched', async () => {
    expect(matchToText(await okAsync<number, string>(21).mapErr(unexpected))).toBe('ok:21');
    expect(matchToText(await errAsync<string, number>('boom').map(unexpected))).toBe('err:boom');
  });

  it('chains sync and async results with andThen', async () => {
    const result = await okAsync(10)
      .andThen((value) => ok(value + 11))
      .andThen((value) => okAsync(double(value)));

    expect(matchToText(result)).toBe('ok:42');
  });

  it('stops the pipeline at the first error', async () => {
    const result = await okAsync(10)
      .andThen(() => errAsync('insufficient stock'))
      .andThen(unexpected);

    expect(matchToText(result)).toBe('err:insufficient stock');
  });

  it('matches both tracks into a single value', async () => {
    await expect(okAsync(21).match({ ok: double, err: unexpected })).resolves.toBe(42);
    await expect(errAsync('boom').match({ ok: unexpected, err: toMessage })).resolves.toBe(
      'failed: boom',
    );
  });

  it('can be awaited and supports rejection handlers for unexpected failures', async () => {
    const failing = new ResultAsync<number, string>(Promise.reject(new Error('bug')));

    await expect(
      failing.then(undefined, (reason: unknown) => (reason as Error).message),
    ).resolves.toBe('bug');
  });
});

describe('combine', () => {
  it('collects every value when all results are ok', () => {
    expect(matchToText(combine([ok(1), ok(2), ok(3)]))).toBe('ok:1,2,3');
  });

  it('returns the first error', () => {
    expect(matchToText(combine([ok(1), err('first'), err('second')]))).toBe('err:first');
  });

  it('returns an empty list for no results', () => {
    expect(matchToText(combine([]))).toBe('ok:');
  });
});
