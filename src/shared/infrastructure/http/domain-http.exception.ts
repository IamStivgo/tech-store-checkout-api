import { HttpException, type HttpStatus } from '@nestjs/common';

import type { DomainError } from '../../domain/domain-error';

import { HTTP_STATUS_BY_ERROR_CODE } from './error-http-status';

export class DomainHttpException extends HttpException {
  /** @param status Overrides the default status of the code, e.g. 422 for a referenced resource. */
  constructor(
    readonly error: DomainError,
    status: HttpStatus = HTTP_STATUS_BY_ERROR_CODE[error.code],
  ) {
    super(error.detail, status, { cause: error });
  }
}
