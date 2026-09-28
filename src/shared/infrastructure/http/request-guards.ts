import { createHash, timingSafeEqual } from 'node:crypto';

import { ForbiddenException, UnsupportedMediaTypeException } from '@nestjs/common';
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

/** Header CloudFront adds to every request it sends to the API (T-086). */
export const ORIGIN_VERIFY_HEADER = 'x-origin-verify';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * Only requests that came through CloudFront carry the shared secret: calling API Gateway
 * directly would skip the edge's headers and protections. Compared in constant time.
 */
export const requireOriginSecret =
  (secret: string) => (request: Request, _response: Response, next: NextFunction) => {
    const received = request.headers[ORIGIN_VERIFY_HEADER];
    if (typeof received !== 'string' || !timingSafeEqual(digest(received), digest(secret))) {
      next(new ForbiddenException());
      return;
    }
    next();
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
