import { applyDecorators, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

import { IDEMPOTENCY_KEY_HEADER, IdempotencyInterceptor } from './idempotency.interceptor';
import { ApiProblemResponses } from './openapi/problem-details.openapi';

/** Requires an Idempotency-Key on the endpoint and documents it in OpenAPI. */
export const Idempotent = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    UseInterceptors(IdempotencyInterceptor),
    ApiHeader({
      name: IDEMPOTENCY_KEY_HEADER,
      required: true,
      description:
        'Client-generated UUID. Repeating it with the same body returns the stored response with `Idempotent-Replayed: true`; with another body, 409 IDEMPOTENCY_KEY_CONFLICT.',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT),
  );
