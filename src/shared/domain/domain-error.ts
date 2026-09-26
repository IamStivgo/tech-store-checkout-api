import type { ErrorCode } from './error-code';

export type ErrorContext = Readonly<Record<string, string | number | boolean>>;

/**
 * Business error returned inside a Result, never thrown. `detail` and `context`
 * reach API clients, so they must not contain personal data or secrets.
 */
export abstract class DomainError {
  abstract readonly code: ErrorCode;

  protected constructor(
    readonly detail: string,
    readonly context: ErrorContext = {},
  ) {}
}
