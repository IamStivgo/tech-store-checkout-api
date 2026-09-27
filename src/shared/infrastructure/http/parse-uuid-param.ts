import { ParseUUIDPipe } from '@nestjs/common';

import { ValidationError } from '../../domain/validation-error';

import { DomainHttpException } from './domain-http.exception';

/** Validates a UUID v4 path parameter and answers 400 VALIDATION_ERROR (not Nest's generic 400). */
export const parseUuidParam = (field: string): ParseUUIDPipe =>
  new ParseUUIDPipe({
    version: '4',
    exceptionFactory: () =>
      new DomainHttpException(ValidationError.forField(field, `${field} must be a UUID v4`)),
  });
