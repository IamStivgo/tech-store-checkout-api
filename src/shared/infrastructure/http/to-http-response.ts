import type { HttpStatus } from '@nestjs/common';

import type { DomainError } from '../../domain/domain-error';
import type { ErrorCode } from '../../domain/error-code';
import type { Result, ResultAsync } from '../../domain/result';

import { DomainHttpException } from './domain-http.exception';

/**
 * Bridges ROP use cases and Nest controllers: returns the success value, or throws
 * the domain error as an exception that the Problem Details filter renders.
 */
export const toHttpResponse = async <T, E extends DomainError>(
  result: Result<T, E> | ResultAsync<T, E>,
  statusOverrides: Readonly<Partial<Record<ErrorCode, HttpStatus>>> = {},
): Promise<T> => {
  const settled = await result;

  if (settled.isErr) {
    throw new DomainHttpException(settled.error, statusOverrides[settled.error.code]);
  }
  return settled.value;
};
