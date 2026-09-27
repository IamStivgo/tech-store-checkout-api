import type { IdempotencyRecordRepository } from '../../src/shared/application/idempotency-record.repository.port';
import type { IdempotencyRecord, StoredResponse } from '../../src/shared/domain/idempotency';
import type { PersistenceError } from '../../src/shared/domain/persistence-error';
import { errAsync, okAsync, type ResultAsync } from '../../src/shared/domain/result';

/** Same conditional semantics as the DynamoDB adapter, kept in a map. */
export class InMemoryIdempotencyRepository implements IdempotencyRecordRepository {
  readonly records = new Map<string, IdempotencyRecord>();
  private failure: PersistenceError | undefined;

  failWith(error: PersistenceError): this {
    this.failure = error;
    return this;
  }

  create(record: IdempotencyRecord, now: Date): ResultAsync<boolean, PersistenceError> {
    if (this.failure) {
      return errAsync(this.failure);
    }
    const existing = this.records.get(record.scope);
    if (existing && existing.expiresAt > now) {
      return okAsync(false);
    }
    this.records.set(record.scope, record);
    return okAsync(true);
  }

  find(scope: string): ResultAsync<IdempotencyRecord | null, PersistenceError> {
    return this.failure ? errAsync(this.failure) : okAsync(this.records.get(scope) ?? null);
  }

  complete(scope: string, response: StoredResponse): ResultAsync<void, PersistenceError> {
    const record = this.records.get(scope);
    if (record) {
      this.records.set(scope, { ...record, status: 'COMPLETED', response });
    }
    return okAsync(undefined);
  }

  delete(scope: string): ResultAsync<void, PersistenceError> {
    this.records.delete(scope);
    return okAsync(undefined);
  }
}
