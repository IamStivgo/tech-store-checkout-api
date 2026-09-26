import {
  BadRequestException,
  HttpException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

import { toProblemDetails } from './problem-details';

const context = { instance: '/api/v1/products', traceId: 'trace-1' };

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
