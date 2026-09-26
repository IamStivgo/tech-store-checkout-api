import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { ReconcileModule } from './reconcile.module';

export interface ReconciliationSummary {
  readonly expired: number;
  readonly synced: number;
  readonly failed: number;
}

export type ReconcileHandler = () => Promise<ReconciliationSummary>;

const bootstrap = async (): Promise<INestApplicationContext> => {
  const context = await NestFactory.createApplicationContext(ReconcileModule, {
    bufferLogs: true,
    abortOnError: false,
  });
  context.useLogger(context.get(Logger));
  return context;
};

export const createReconcileHandler = (): ReconcileHandler => {
  let cachedContext: Promise<INestApplicationContext> | undefined;

  const getContext = (): Promise<INestApplicationContext> => {
    cachedContext ??= bootstrap().catch((error: unknown) => {
      cachedContext = undefined;
      throw error;
    });
    return cachedContext;
  };

  return async () => {
    const context = await getContext();
    const summary: ReconciliationSummary = { expired: 0, synced: 0, failed: 0 };

    context.get(Logger).log(summary, 'Reconciliation run finished');
    return summary;
  };
};

export const handler = createReconcileHandler();
