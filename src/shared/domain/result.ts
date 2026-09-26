export type Result<T, E> = Ok<T, E> | Err<T, E>;

interface Matcher<T, E, R> {
  readonly ok: (value: T) => R;
  readonly err: (error: E) => R;
}

export class Ok<T, E> {
  readonly isOk = true as const;
  readonly isErr = false as const;

  constructor(readonly value: T) {}

  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Ok(fn(this.value));
  }

  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return new Ok(this.value);
  }

  andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return fn(this.value);
  }

  asyncAndThen<U, F>(fn: (value: T) => ResultAsync<U, F>): ResultAsync<U, E | F> {
    return fn(this.value);
  }

  match<R>(on: Matcher<T, E, R>): R {
    return on.ok(this.value);
  }
}

export class Err<T, E> {
  readonly isOk = false as const;
  readonly isErr = true as const;

  constructor(readonly error: E) {}

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new Err(this.error);
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return new Err(fn(this.error));
  }

  andThen<U, F>(_fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return new Err(this.error);
  }

  asyncAndThen<U, F>(_fn: (value: T) => ResultAsync<U, F>): ResultAsync<U, E | F> {
    return errAsync(this.error);
  }

  match<R>(on: Matcher<T, E, R>): R {
    return on.err(this.error);
  }
}

export const ok = <T, E = never>(value: T): Result<T, E> => new Ok(value);

export const err = <E, T = never>(error: E): Result<T, E> => new Err(error);

export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
  constructor(private readonly inner: Promise<Result<T, E>>) {}

  static fromPromise<T, E>(
    promise: PromiseLike<T>,
    toError: (cause: unknown) => E,
  ): ResultAsync<T, E> {
    return new ResultAsync(
      Promise.resolve(promise).then(
        (value) => ok<T, E>(value),
        (cause: unknown) => err<E, T>(toError(cause)),
      ),
    );
  }

  map<U>(fn: (value: T) => U | Promise<U>): ResultAsync<U, E> {
    return new ResultAsync(
      this.inner.then(async (result) =>
        result.isOk ? ok<U, E>(await fn(result.value)) : err<E, U>(result.error),
      ),
    );
  }

  mapErr<F>(fn: (error: E) => F | Promise<F>): ResultAsync<T, F> {
    return new ResultAsync(
      this.inner.then(async (result) =>
        result.isOk ? ok<T, F>(result.value) : err<F, T>(await fn(result.error)),
      ),
    );
  }

  andThen<U, F>(fn: (value: T) => Result<U, F> | ResultAsync<U, F>): ResultAsync<U, E | F> {
    return new ResultAsync(
      this.inner.then<Result<U, E | F>>((result) =>
        result.isOk ? fn(result.value) : err<E | F, U>(result.error),
      ),
    );
  }

  match<R>(on: Matcher<T, E, R>): Promise<R> {
    return this.inner.then((result) => result.match(on));
  }

  then<A = Result<T, E>, B = never>(
    onFulfilled?: ((result: Result<T, E>) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.inner.then(onFulfilled, onRejected);
  }
}

export const okAsync = <T, E = never>(value: T): ResultAsync<T, E> =>
  new ResultAsync(Promise.resolve(ok<T, E>(value)));

export const errAsync = <E, T = never>(error: E): ResultAsync<T, E> =>
  new ResultAsync(Promise.resolve(err<E, T>(error)));

export const combine = <T, E>(results: readonly Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];

  for (const result of results) {
    if (result.isErr) {
      return err(result.error);
    }
    values.push(result.value);
  }

  return ok(values);
};
