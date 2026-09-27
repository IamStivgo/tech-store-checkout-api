import { DomainError } from './domain-error';

export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED';

/** Response kept to be repeated, with the body as serialized JSON. */
export interface StoredResponse {
  readonly statusCode: number;
  readonly body: string;
}

export interface IdempotencyRecord {
  /** `<METHOD> <path>#<Idempotency-Key>`: the same key on another endpoint is a different request. */
  readonly scope: string;
  /** SHA-256 of the canonical request body. */
  readonly requestHash: string;
  readonly status: IdempotencyStatus;
  readonly response?: StoredResponse;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export class IdempotencyKeyRequiredError extends DomainError {
  readonly code = 'IDEMPOTENCY_KEY_REQUIRED';

  constructor() {
    super('This request needs an Idempotency-Key header with a UUID.');
  }
}

export class IdempotencyKeyConflictError extends DomainError {
  readonly code = 'IDEMPOTENCY_KEY_CONFLICT';

  constructor() {
    super('This Idempotency-Key was already used with a different request.');
  }
}

export class IdempotencyRequestInProgressError extends DomainError {
  readonly code = 'IDEMPOTENCY_REQUEST_IN_PROGRESS';

  constructor(readonly retryAfterSeconds: number) {
    super('The original request with this Idempotency-Key is still being processed.', {
      retryAfterSeconds,
    });
  }
}
