import {
  IdempotencyKeyConflictError,
  IdempotencyKeyRequiredError,
  IdempotencyRequestInProgressError,
} from './idempotency';

describe('idempotency errors', () => {
  it.each([
    [new IdempotencyKeyRequiredError(), 'IDEMPOTENCY_KEY_REQUIRED', {}],
    [new IdempotencyKeyConflictError(), 'IDEMPOTENCY_KEY_CONFLICT', {}],
    [
      new IdempotencyRequestInProgressError(1),
      'IDEMPOTENCY_REQUEST_IN_PROGRESS',
      { retryAfterSeconds: 1 },
    ],
  ])('%p has code %s and a client-safe context', (error, code, context) => {
    expect(error.code).toBe(code);
    expect(error.detail).toMatch(/Idempotency-Key/);
    expect(error.context).toEqual(context);
  });
});
