import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { catchError, mergeMap, of, type Observable } from 'rxjs';
import { z } from 'zod';

import { IdempotencyService } from '../../application/idempotency.service';
import {
  IdempotencyKeyRequiredError,
  IdempotencyRequestInProgressError,
  type StoredResponse,
} from '../../domain/idempotency';
import type { PersistenceError } from '../../domain/persistence-error';
import type { ResultAsync } from '../../domain/result';

import { DomainHttpException } from './domain-http.exception';
import { PROBLEM_JSON_CONTENT_TYPE, toProblemDetails } from './problem-details';
import { problemContextOf } from './problem-details.filter';
import { hashRequestBody } from './request-hash';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IDEMPOTENT_REPLAYED_HEADER = 'Idempotent-Replayed';

// Response headers that are part of the result and must be repeated by a replay.
const REPLAYED_RESPONSE_HEADERS = ['Location'] as const;

const MIN_ERROR_STATUS = 400;
const MIN_SERVER_ERROR_STATUS = 500;

const idempotencyKeySchema = z.uuid();

// UUIDs are case-insensitive: the same key in upper case is the same request.
const parseIdempotencyKey = (header: string | undefined): string | undefined => {
  const parsed = idempotencyKeySchema.safeParse(header);
  return parsed.success ? parsed.data.toLowerCase() : undefined;
};

const serialize = (body: unknown): string => JSON.stringify(body ?? null);

const replayedHeadersOf = (response: Response): Record<string, string> =>
  Object.fromEntries(
    REPLAYED_RESPONSE_HEADERS.flatMap((name) => {
      const value = response.getHeader(name);
      return typeof value === 'string' ? [[name, value]] : [];
    }),
  );

/**
 * Runs a request once per Idempotency-Key (api-contract §3): repeats are answered with the
 * stored response, 2xx and business 4xx responses are kept, and 5xx release the key.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly idempotency: IdempotencyService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const key = parseIdempotencyKey(request.header(IDEMPOTENCY_KEY_HEADER));
    if (key === undefined) {
      throw new DomainHttpException(new IdempotencyKeyRequiredError());
    }

    // The same key on another endpoint is a different request.
    const scope = `${request.method} ${request.path}#${key}`;
    const start = await this.idempotency.begin(scope, hashRequestBody(request.body));

    if (start.isErr) {
      if (start.error instanceof IdempotencyRequestInProgressError) {
        response.setHeader('Retry-After', String(start.error.retryAfterSeconds));
      }
      throw new DomainHttpException(start.error);
    }
    if (start.value.kind === 'REPLAY') {
      return of(replay(start.value.response, response));
    }

    return next.handle().pipe(
      catchError(async (error: unknown) => {
        await this.settleFailure(scope, error, request);
        throw error;
      }),
      mergeMap(async (body: unknown) => {
        await this.logFailure(
          this.idempotency.complete(scope, {
            statusCode: response.statusCode,
            body: serialize(body),
            headers: replayedHeadersOf(response),
          }),
        );
        return body;
      }),
    );
  }

  private async settleFailure(scope: string, error: unknown, request: Request): Promise<void> {
    const problem = toProblemDetails(error, problemContextOf(request));

    await this.logFailure(
      problem.status < MIN_SERVER_ERROR_STATUS
        ? this.idempotency.complete(scope, {
            statusCode: problem.status,
            body: serialize(problem),
            headers: {},
          })
        : this.idempotency.release(scope),
    );
  }

  // The response is already decided: a storage failure is logged, never sent to the client.
  private async logFailure(result: ResultAsync<void, PersistenceError>): Promise<void> {
    await result.match({
      ok: () => undefined,
      err: (failure) => {
        this.logger.error(failure);
      },
    });
  }
}

const replay = (stored: StoredResponse, response: Response): unknown => {
  response.status(stored.statusCode).setHeader(IDEMPOTENT_REPLAYED_HEADER, 'true');
  for (const [name, value] of Object.entries(stored.headers)) {
    response.setHeader(name, value);
  }
  if (stored.statusCode >= MIN_ERROR_STATUS) {
    response.setHeader('Cache-Control', 'no-store').type(PROBLEM_JSON_CONTENT_TYPE);
  }
  return JSON.parse(stored.body) as unknown;
};
