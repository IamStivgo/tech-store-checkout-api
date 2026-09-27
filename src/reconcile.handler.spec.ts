import { NestFactory } from '@nestjs/core';

import { TEST_ENV } from '../test/builders/app-config.builder';

import { createReconcileHandler } from './reconcile.handler';

describe('Reconciliation Lambda handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ...TEST_ENV };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns an empty summary while reconciliation has no work to do', async () => {
    const handler = createReconcileHandler();

    await expect(handler()).resolves.toEqual({ expired: 0, synced: 0, failed: 0 });
  });

  it('creates the application context once per container', async () => {
    const createContext = jest.spyOn(NestFactory, 'createApplicationContext');
    const handler = createReconcileHandler();

    await handler();
    await handler();

    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it('retries the bootstrap after a failed cold start', async () => {
    const handler = createReconcileHandler();
    delete process.env.APP_ENV;

    await expect(handler()).rejects.toThrow(/APP_ENV/);

    process.env.APP_ENV = 'test';
    await expect(handler()).resolves.toEqual({ expired: 0, synced: 0, failed: 0 });
  });
});
