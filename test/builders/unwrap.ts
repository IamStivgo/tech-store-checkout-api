import type { Result } from '../../src/shared/domain/result';

/** Returns the value of an ok result; fails the test with the error otherwise. */
export const unwrap = <T, E>(result: Result<T, E>): T =>
  result.match({
    ok: (value) => value,
    err: (error) => {
      throw new Error(`Expected an ok result but got: ${JSON.stringify(error)}`);
    },
  });
