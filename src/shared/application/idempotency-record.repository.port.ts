import type { IdempotencyRecord, StoredResponse } from '../domain/idempotency';
import type { PersistenceError } from '../domain/persistence-error';
import type { ResultAsync } from '../domain/result';

export interface IdempotencyRecordRepository {
  /**
   * Stores the record only if its scope is free or holds an expired record (the storage TTL
   * may delete expired items hours late). Returns false when a live record already exists.
   */
  create(record: IdempotencyRecord, now: Date): ResultAsync<boolean, PersistenceError>;
  find(scope: string): ResultAsync<IdempotencyRecord | null, PersistenceError>;
  complete(scope: string, response: StoredResponse): ResultAsync<void, PersistenceError>;
  delete(scope: string): ResultAsync<void, PersistenceError>;
}
