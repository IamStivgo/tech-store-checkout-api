import { HttpException } from '@nestjs/common';

import type { DomainError } from '../../domain/domain-error';

import { HTTP_STATUS_BY_ERROR_CODE } from './error-http-status';

export class DomainHttpException extends HttpException {
  constructor(readonly error: DomainError) {
    super(error.detail, HTTP_STATUS_BY_ERROR_CODE[error.code], { cause: error });
  }
}
