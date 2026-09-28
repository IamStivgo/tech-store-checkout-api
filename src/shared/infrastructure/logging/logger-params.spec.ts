import type { IncomingMessage, ServerResponse } from 'node:http';

import pino from 'pino';
import type { Options } from 'pino-http';

import { aConfig } from '../../../../test/builders/app-config.builder';

import { buildLoggerParams, REDACTION_CENSOR, resolveRequestId } from './logger-params';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const pinoHttpOptions = (logLevel = 'info'): Options =>
  buildLoggerParams(aConfig({ LOG_LEVEL: logLevel })).pinoHttp as Options;

const requestWith = (headers: IncomingMessage['headers']): IncomingMessage =>
  ({ headers }) as IncomingMessage;

const responseMock = () => ({ setHeader: jest.fn() });

describe('resolveRequestId', () => {
  it('reuses a safe incoming X-Request-Id and returns it in the response', () => {
    const response = responseMock();

    const requestId = resolveRequestId(
      requestWith({ 'x-request-id': 'abc-123_DEF.9' }),
      response as unknown as ServerResponse,
    );

    expect(requestId).toBe('abc-123_DEF.9');
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'abc-123_DEF.9');
  });

  it('reuses the id the app already assigned to the request', () => {
    const response = responseMock();
    const request = Object.assign(requestWith({ 'x-request-id': 'from-client' }), {
      id: 'assigned-id',
    });

    expect(resolveRequestId(request, response as unknown as ServerResponse)).toBe('assigned-id');
    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', {}],
    ['with unsafe characters', { 'x-request-id': 'id\n{"level":60}' }],
    ['too long', { 'x-request-id': 'a'.repeat(129) }],
  ])('generates a UUID when the incoming id is %s', (_case, headers) => {
    const response = responseMock();

    const requestId = resolveRequestId(requestWith(headers), response as unknown as ServerResponse);

    expect(requestId).toMatch(UUID_PATTERN);
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', requestId);
  });
});

describe('buildLoggerParams', () => {
  it('uses the configured log level', () => {
    expect(pinoHttpOptions('warn').level).toBe('warn');
  });

  it('adds the request id as a top-level requestId field', () => {
    const customProps = pinoHttpOptions().customProps as (request: object) => object;

    expect(customProps({ id: 'req-1' })).toEqual({ requestId: 'req-1' });
  });

  it('serializes only the request method and url, and the response status', () => {
    const { serializers } = pinoHttpOptions();
    const serializeRequest = serializers?.req as (value: object) => object;
    const serializeResponse = serializers?.res as (value: object) => object;

    expect(
      serializeRequest({
        id: 'req-1',
        method: 'POST',
        url: '/api/v1/customers',
        headers: { authorization: 'Bearer secret' },
      }),
    ).toEqual({ method: 'POST', url: '/api/v1/customers' });
    expect(serializeResponse({ statusCode: 201, headers: { 'set-cookie': 'x' } })).toEqual({
      statusCode: 201,
    });
  });

  it('never writes sensitive values to the logs', () => {
    const lines: string[] = [];
    const logger = pino(
      { redact: pinoHttpOptions().redact },
      { write: (line: string) => lines.push(line) },
    );
    const sensitiveValues = {
      authorization: 'Bearer top-secret',
      cardToken: 'tok_test_123',
      token: 'raw-token',
      acceptanceToken: 'acceptance-token',
      personalDataAuthToken: 'personal-token',
      signature: 'signature-value',
      secret: 'secret-value',
      privateKey: 'prv_test_key',
      legalId: '1020304050',
      phone: '3001234567',
      email: 'ana@example.com',
      addressLine1: 'Calle 100 # 10-20',
    };

    logger.info(sensitiveValues, 'top level');
    logger.info({ payment: sensitiveValues }, 'nested');

    const output = lines.join('');
    for (const value of Object.values(sensitiveValues)) {
      expect(output).not.toContain(value);
    }
    expect(output).toContain(REDACTION_CENSOR);
  });
});
