import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

import { aConfig } from '../../../../test/builders/app-config.builder';

import { configureApp } from './configure-app';
import { ProblemDetailsFilter } from './problem-details.filter';

const pinoLogger = { log: jest.fn() };

const createAppMock = () => ({
  get: jest.fn().mockReturnValue(pinoLogger),
  useLogger: jest.fn(),
  useGlobalFilters: jest.fn(),
  setGlobalPrefix: jest.fn(),
  enableVersioning: jest.fn(),
  enableCors: jest.fn(),
  use: jest.fn(),
  useBodyParser: jest.fn(),
});

describe('configureApp', () => {
  it('uses the pino logger for the application logs', () => {
    const app = createAppMock();

    configureApp(app as unknown as NestExpressApplication, aConfig());

    expect(app.get).toHaveBeenCalledWith(Logger);
    expect(app.useLogger).toHaveBeenCalledWith(pinoLogger);
  });

  it('exposes routes under /api with URI versioning defaulting to v1', () => {
    const app = createAppMock();

    configureApp(app as unknown as NestExpressApplication, aConfig());

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.enableVersioning).toHaveBeenCalledWith({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
  });

  it('assigns the request id, adds security headers and rejects non-JSON bodies before parsing', () => {
    const app = createAppMock();

    configureApp(app as unknown as NestExpressApplication, aConfig());

    const middlewares = app.use.mock.calls.map(
      ([middleware]: [{ name: string }]) => middleware.name,
    );
    expect(middlewares).toEqual(['assignRequestId', 'helmetMiddleware', 'rejectNonJsonBody']);
    expect(app.useBodyParser).toHaveBeenCalledWith('json', { limit: '16kb' });
  });

  it('answers every error with Problem Details', () => {
    const app = createAppMock();

    configureApp(app as unknown as NestExpressApplication, aConfig());

    expect(app.useGlobalFilters).toHaveBeenCalledWith(expect.any(ProblemDetailsFilter));
  });

  it('keeps CORS disabled when no origins are configured', () => {
    const app = createAppMock();

    configureApp(app as unknown as NestExpressApplication, aConfig());

    expect(app.enableCors).not.toHaveBeenCalled();
  });

  it('enables CORS only for the configured origins', () => {
    const app = createAppMock();
    const config = aConfig({ APP_ENV: 'local', CORS_ALLOWED_ORIGINS: 'http://localhost:5173' });

    configureApp(app as unknown as NestExpressApplication, config);

    expect(app.enableCors).toHaveBeenCalledWith({ origin: ['http://localhost:5173'] });
  });
});
