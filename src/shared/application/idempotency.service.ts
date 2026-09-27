import type { Clock } from '../domain/clock.port';
import {
  IdempotencyKeyConflictError,
  IdempotencyRequestInProgressError,
  type IdempotencyRecord,
  type StoredResponse,
} from '../domain/idempotency';
import type { PersistenceError } from '../domain/persistence-error';
import { err, ok, type Result, type ResultAsync } from '../domain/result';

import type { IdempotencyRecordRepository } from './idempotency-record.repository.port';

const SECONDS_PER_DAY = 24 * 60 * 60;
const MS_PER_SECOND = 1000;
/** Clients retry a request that is still running after this many seconds (Retry-After). */
export const IN_PROGRESS_RETRY_AFTER_SECONDS = 1;

export type IdempotencyStart =
  { readonly kind: 'STARTED' } | { readonly kind: 'REPLAY'; readonly response: StoredResponse };

export type IdempotencyBeginError =
  IdempotencyKeyConflictError | IdempotencyRequestInProgressError | PersistenceError;

/**
 * Idempotency-Key semantics (IETF draft): the first request runs and its response is kept for
 * 24 h; a repeat with the same body gets the same response, a different body is a conflict and
 * a repeat while the first one runs is told to retry.
 */
export class IdempotencyService {
  constructor(
    private readonly records: IdempotencyRecordRepository,
    private readonly clock: Clock,
    private readonly ttlSeconds = SECONDS_PER_DAY,
  ) {}

  begin(scope: string, requestHash: string): ResultAsync<IdempotencyStart, IdempotencyBeginError> {
    const now = this.clock.now();
    const record: IdempotencyRecord = {
      scope,
      requestHash,
      status: 'IN_PROGRESS',
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.ttlSeconds * MS_PER_SECOND),
    };

    return this.records
      .create(record, now)
      .andThen((created) =>
        created
          ? ok<IdempotencyStart, IdempotencyBeginError>({ kind: 'STARTED' })
          : this.records
              .find(scope)
              .andThen((existing) => this.resolveExisting(existing, requestHash)),
      );
  }

  /** Keeps the response to repeat it (2xx and business 4xx). */
  complete(scope: string, response: StoredResponse): ResultAsync<void, PersistenceError> {
    return this.records.complete(scope, response);
  }

  /** Forgets the request so the client can retry it (unexpected 5xx). */
  release(scope: string): ResultAsync<void, PersistenceError> {
    return this.records.delete(scope);
  }

  private resolveExisting(
    existing: IdempotencyRecord | null,
    requestHash: string,
  ): Result<IdempotencyStart, IdempotencyBeginError> {
    // Released between our write and our read: the other request failed, the client may retry.
    if (!existing) {
      return err(new IdempotencyRequestInProgressError(IN_PROGRESS_RETRY_AFTER_SECONDS));
    }
    if (existing.requestHash !== requestHash) {
      return err(new IdempotencyKeyConflictError());
    }
    if (existing.status === 'IN_PROGRESS' || !existing.response) {
      return err(new IdempotencyRequestInProgressError(IN_PROGRESS_RETRY_AFTER_SECONDS));
    }
    return ok({ kind: 'REPLAY', response: existing.response });
  }
}
