import {
  BadRequestException,
  HttpException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

import {
  FakeInsufficientStockError,
  FakeProductNotFoundError,
  FakeProviderUnavailableError,
} from '../../../../test/fakes/fake-domain-errors';
import { PersistenceError } from '../../domain/persistence-error';
import { ValidationError } from '../../domain/validation-error';

import { DomainHttpException } from './domain-http.exception';
import { toProblemDetails } from './problem-details';

const context = { instance: '/api/v1/products', traceId: 'trace-1' };

describe('toProblemDetails with domain errors', () => {
  it('uses the domain code, curated detail and non-sensitive context', () => {
    const problem = toProblemDetails(
      new DomainHttpException(new FakeInsufficientStockError(2)),
      context,
    );

    expect(problem).toEqual({
      type: '/problems/insufficient-stock',
      title: 'Conflict',
      status: 409,
      detail: 'Only 2 units are available for this product.',
      instance: '/api/v1/products',
      code: 'INSUFFICIENT_STOCK',
      traceId: 'trace-1',
      context: { availableUnits: 2 },
    });
  });

  it('omits the context when the error has none', () => {
    const problem = toProblemDetails(
      new DomainHttpException(new FakeProductNotFoundError()),
      context,
    );

    expect(problem).not.toHaveProperty('context');
    expect(problem).toMatchObject({ status: 404, code: 'PRODUCT_NOT_FOUND' });
  });

  it('lists the invalid fields of validation errors', () => {
    const problem = toProblemDetails(
      new DomainHttpException(ValidationError.forField('email', 'email must be valid')),
      context,
    );

    expect(problem).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'email', message: 'email must be valid' }],
    });
  });

  it('keeps expected provider failures with their gateway status and detail', () => {
    const problem = toProblemDetails(
      new DomainHttpException(new FakeProviderUnavailableError()),
      context,
    );

    expect(problem).toMatchObject({
      status: 502,
      code: 'PAYMENT_PROVIDER_UNAVAILABLE',
      detail: 'The payment provider is not available. Try again in a few minutes.',
    });
  });

  it('hides persistence failures behind a generic 500 problem', () => {
    const problem = toProblemDetails(
      new DomainHttpException(
        new PersistenceError('products.findById', new Error('table checkout-app-prod-products')),
      ),
      context,
    );

    expect(problem).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred.',
    });
    expect(JSON.stringify(problem)).not.toContain('products.findById');
  });
});

describe('toProblemDetails', () => {
  it('maps an HTTP exception to a problem with a stable code and type', () => {
    const problem = toProblemDetails(new NotFoundException(), context);

    expect(problem).toEqual({
      type: '/problems/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'The requested resource does not exist.',
      instance: '/api/v1/products',
      code: 'NOT_FOUND',
      traceId: 'trace-1',
    });
  });

  it.each([
    [new BadRequestException(), 400, 'BAD_REQUEST'],
    [new PayloadTooLargeException(), 413, 'PAYLOAD_TOO_LARGE'],
    [new UnsupportedMediaTypeException(), 415, 'UNSUPPORTED_MEDIA_TYPE'],
  ])('keeps the status of client errors (%#)', (exception, status, code) => {
    const problem = toProblemDetails(exception, context);

    expect(problem).toMatchObject({
      status,
      code,
      detail: 'The request could not be processed.',
    });
  });

  it('never echoes framework messages, which may contain request data', () => {
    const problem = toProblemDetails(
      new NotFoundException('Cannot GET /api/v1/x?email=ana@example.com'),
      context,
    );

    expect(problem.detail).not.toContain('ana@example.com');
  });

  it('uses a generic title and code for non-standard statuses', () => {
    const problem = toProblemDetails(new HttpException('Client closed', 499), context);

    expect(problem).toMatchObject({ status: 499, title: 'Error', code: 'ERROR' });
  });

  it.each([
    ['an unexpected error', new Error('db-password=hunter2')],
    ['a thrown non-error value', 'boom'],
    ['a server HTTP exception', new ServiceUnavailableException('internal host 10.0.0.5 is down')],
  ])('hides %s behind a generic 500 problem', (_case, exception) => {
    const problem = toProblemDetails(exception, context);

    expect(problem).toEqual({
      type: '/problems/internal-error',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
      instance: '/api/v1/products',
      code: 'INTERNAL_ERROR',
      traceId: 'trace-1',
    });
  });
});
