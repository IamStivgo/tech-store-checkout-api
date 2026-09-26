import { VersioningType, type INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { loadAppConfig } from '../../../config/app-config';

import { configureApp } from './configure-app';

const pinoLogger = { log: jest.fn() };

const createAppMock = () => ({
  get: jest.fn().mockReturnValue(pinoLogger),
  useLogger: jest.fn(),
  setGlobalPrefix: jest.fn(),
  enableVersioning: jest.fn(),
  enableCors: jest.fn(),
});

describe('configureApp', () => {
  it('uses the pino logger for the application logs', () => {
    const app = createAppMock();

    configureApp(app as unknown as INestApplication, loadAppConfig({ APP_ENV: 'test' }));

    expect(app.get).toHaveBeenCalledWith(Logger);
    expect(app.useLogger).toHaveBeenCalledWith(pinoLogger);
  });

  it('exposes routes under /api with URI versioning defaulting to v1', () => {
    const app = createAppMock();

    configureApp(app as unknown as INestApplication, loadAppConfig({ APP_ENV: 'test' }));

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.enableVersioning).toHaveBeenCalledWith({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
  });

  it('keeps CORS disabled when no origins are configured', () => {
    const app = createAppMock();

    configureApp(app as unknown as INestApplication, loadAppConfig({ APP_ENV: 'prod' }));

    expect(app.enableCors).not.toHaveBeenCalled();
  });

  it('enables CORS only for the configured origins', () => {
    const app = createAppMock();
    const config = loadAppConfig({
      APP_ENV: 'local',
      CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
    });

    configureApp(app as unknown as INestApplication, config);

    expect(app.enableCors).toHaveBeenCalledWith({ origin: ['http://localhost:5173'] });
  });
});
