import { STATUS_CODES } from 'node:http';

import { HttpException, HttpStatus } from '@nestjs/common';

import type { ErrorContext } from '../../domain/domain-error';
import { ValidationError, type FieldError } from '../../domain/validation-error';

import { DomainHttpException } from './domain-http.exception';

export const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';

const PROBLEM_TYPE_BASE_PATH = '/problems';
export const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
const INTERNAL_ERROR_DETAIL = 'An unexpected error occurred.';
const FALLBACK_TITLE = 'Error';

// Framework messages may echo request data (URL query, body fragments), so they are never exposed.
const CLIENT_ERROR_DETAILS: Readonly<Partial<Record<number, string>>> = {
  [HttpStatus.NOT_FOUND]: 'The requested resource does not exist.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'The request body is too large.',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'The request body must be JSON (application/json).',
};
const FALLBACK_CLIENT_ERROR_DETAIL = 'The request could not be processed.';

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string;
  readonly code: string;
  readonly traceId: string;
  readonly context?: ErrorContext;
  readonly errors?: readonly FieldError[];
}

export interface ProblemContext {
  readonly instance: string;
  readonly traceId: string;
}

const titleFor = (status: number): string => STATUS_CODES[status] ?? FALLBACK_TITLE;

const codeFor = (status: number): string =>
  titleFor(status)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');

const typeFor = (code: string): string =>
  `${PROBLEM_TYPE_BASE_PATH}/${code.toLowerCase().replaceAll('_', '-')}`;

const isServerError = (status: number): boolean => status >= 500;

/**
 * Status of a client error thrown before Nest routes the request: an HttpException, or an
 * `http-errors` error of the body parser (e.g. 413) that is safe to expose.
 */
const clientErrorStatus = (exception: unknown): number | undefined => {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return isServerError(status) ? undefined : status;
  }
  if (typeof exception !== 'object' || exception === null) {
    return undefined;
  }
  const { status, expose } = exception as { status?: unknown; expose?: unknown };
  return typeof status === 'number' && expose === true && !isServerError(status)
    ? status
    : undefined;
};

const internalError = (context: ProblemContext): ProblemDetails => ({
  type: typeFor(INTERNAL_ERROR_CODE),
  title: titleFor(HttpStatus.INTERNAL_SERVER_ERROR),
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  detail: INTERNAL_ERROR_DETAIL,
  instance: context.instance,
  code: INTERNAL_ERROR_CODE,
  traceId: context.traceId,
});

const fromDomainError = (
  exception: DomainHttpException,
  context: ProblemContext,
): ProblemDetails => {
  const { error } = exception;

  if (error.code === INTERNAL_ERROR_CODE) {
    return internalError(context);
  }

  const status = exception.getStatus();
  const hasContext = Object.keys(error.context).length > 0;

  return {
    type: typeFor(error.code),
    title: titleFor(status),
    status,
    detail: error.detail,
    instance: context.instance,
    code: error.code,
    traceId: context.traceId,
    ...(hasContext ? { context: error.context } : {}),
    ...(error instanceof ValidationError ? { errors: error.fieldErrors } : {}),
  };
};

export const toProblemDetails = (exception: unknown, context: ProblemContext): ProblemDetails => {
  if (exception instanceof DomainHttpException) {
    return fromDomainError(exception, context);
  }

  const status = clientErrorStatus(exception);
  if (status === undefined) {
    return internalError(context);
  }

  const code = codeFor(status);

  return {
    type: typeFor(code),
    title: titleFor(status),
    status,
    detail: CLIENT_ERROR_DETAILS[status] ?? FALLBACK_CLIENT_ERROR_DETAIL,
    instance: context.instance,
    code,
    traceId: context.traceId,
  };
};
