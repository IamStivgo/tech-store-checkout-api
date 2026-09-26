import { DomainError } from './domain-error';

/** Technical storage failure. Answered as a generic 500; `cause` is only logged. */
export class PersistenceError extends DomainError {
  readonly code = 'INTERNAL_ERROR';

  constructor(
    readonly operation: string,
    readonly cause: unknown,
  ) {
    super(`Persistence operation failed: ${operation}`);
  }
}
