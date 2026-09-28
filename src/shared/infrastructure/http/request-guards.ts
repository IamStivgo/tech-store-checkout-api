import { UnsupportedMediaTypeException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { runWithRequestId } from '../context/request-context';
import { resolveRequestId } from '../logging/logger-params';

/** JSON, and JSON Merge Patch (RFC 7396) for partial updates such as cancelling a transaction. */
export const JSON_CONTENT_TYPES = ['application/json', 'application/merge-patch+json'];

/**
 * Gives the request its id before anything can fail (e.g. the body parser), so every
 * response and Problem Details carries it. The logger reuses the same id.
 */
export const assignRequestId = (request: Request, response: Response, next: NextFunction) => {
  request.id = resolveRequestId(request, response);
  // The rest of the request runs with its id at hand (audit trail, ADR-012).
  runWithRequestId(request.id, next);
};

// An empty body (Content-Length: 0) needs no Content-Type.
const hasContent = (request: Request): boolean =>
  request.headers['transfer-encoding'] !== undefined ||
  Number(request.headers['content-length'] ?? 0) > 0;

/** Requests with a body must send JSON: anything else is answered 415 before parsing it. */
export const rejectNonJsonBody = (request: Request, _response: Response, next: NextFunction) => {
  if (hasContent(request) && !request.is(JSON_CONTENT_TYPES)) {
    next(new UnsupportedMediaTypeException());
    return;
  }
  next();
};
