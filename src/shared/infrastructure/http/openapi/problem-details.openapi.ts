import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  getSchemaPath,
  ApiSchema,
} from '@nestjs/swagger';

import type { ErrorContext } from '../../../domain/domain-error';
import type { FieldError } from '../../../domain/validation-error';
import { PROBLEM_JSON_CONTENT_TYPE, type ProblemDetails } from '../problem-details';

@ApiSchema({ name: 'FieldError' })
export class FieldErrorSchema implements FieldError {
  @ApiProperty({ example: 'productId' })
  readonly field!: string;

  @ApiProperty({ example: 'Must be a valid UUID.' })
  readonly message!: string;
}

@ApiSchema({ name: 'ProblemDetails' })
export class ProblemDetailsSchema implements ProblemDetails {
  @ApiProperty({ example: '/problems/product-not-found' })
  readonly type!: string;

  @ApiProperty({ example: 'Not Found' })
  readonly title!: string;

  @ApiProperty({ example: HttpStatus.NOT_FOUND })
  readonly status!: number;

  @ApiProperty({ example: 'The product does not exist.' })
  readonly detail!: string;

  @ApiProperty({ example: '/api/v1/products/7d094266-0b4e-4789-9522-96e1cd7ffa61' })
  readonly instance!: string;

  @ApiProperty({
    description: 'Stable, machine-readable error code.',
    example: 'PRODUCT_NOT_FOUND',
  })
  readonly code!: string;

  @ApiProperty({ description: 'Request id, also returned in the X-Request-Id header.' })
  readonly traceId!: string;

  @ApiPropertyOptional({
    description: 'Extra data about the error.',
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
  })
  readonly context?: ErrorContext;

  @ApiPropertyOptional({ type: [FieldErrorSchema], description: 'Invalid fields (400 only).' })
  readonly errors?: readonly FieldError[];
}

const PROBLEM_DESCRIPTIONS: Readonly<Partial<Record<HttpStatus, string>>> = {
  [HttpStatus.BAD_REQUEST]: 'Invalid request parameters.',
  [HttpStatus.NOT_FOUND]: 'The resource does not exist.',
  [HttpStatus.CONFLICT]: 'The request conflicts with the current state or a previous request.',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'The request breaks a business rule.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Unexpected error.',
};

/** Documents error responses as RFC 9457 Problem Details (`application/problem+json`). */
export const ApiProblemResponses = (...statuses: HttpStatus[]): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiExtraModels(ProblemDetailsSchema),
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: PROBLEM_DESCRIPTIONS[status],
        content: {
          [PROBLEM_JSON_CONTENT_TYPE]: { schema: { $ref: getSchemaPath(ProblemDetailsSchema) } },
        },
      }),
    ),
  );
