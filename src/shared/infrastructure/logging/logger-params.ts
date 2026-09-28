import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Params } from 'nestjs-pino';
import { stdTimeFunctions } from 'pino';

import type { AppConfig } from '../../../config/app-config';

export const REQUEST_ID_HEADER = 'x-request-id';
export const REDACTION_CENSOR = '[Redacted]';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'cardToken',
  'token',
  'acceptanceToken',
  'personalDataAuthToken',
  'signature',
  'secret',
  'privateKey',
  'integritySecret',
  'eventsSecret',
  'legalId',
  'phone',
  'email',
  'addressLine1',
] as const;

export const REDACTED_PATHS: readonly string[] = SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`]);

interface SerializedRequest {
  readonly method: string;
  readonly url: string;
}

interface SerializedResponse {
  readonly statusCode: number;
}

export const resolveRequestId = (request: IncomingMessage, response: ServerResponse): string => {
  // Already assigned by the first middleware of the app: the logger reuses it.
  const assigned = (request as IncomingMessage & { id?: unknown }).id;
  if (typeof assigned === 'string') {
    return assigned;
  }

  const incoming = request.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  response.setHeader(REQUEST_ID_HEADER, requestId);
  return requestId;
};

export const buildLoggerParams = (config: AppConfig): Params => ({
  pinoHttp: {
    level: config.logLevel,
    base: null,
    timestamp: stdTimeFunctions.isoTime,
    genReqId: resolveRequestId,
    customProps: (request) => ({ requestId: request.id }),
    customAttributeKeys: { responseTime: 'durationMs' },
    redact: { paths: [...REDACTED_PATHS], censor: REDACTION_CENSOR },
    serializers: {
      req: ({ method, url }: SerializedRequest) => ({ method, url }),
      res: ({ statusCode }: SerializedResponse) => ({ statusCode }),
    },
  },
});
