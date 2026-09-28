import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import {
  ReconcileTransactions,
  type ReconciliationSummary,
} from './modules/transactions/application/reconcile-transactions.use-case';
import { ReconcileModule } from './reconcile.module';

export type { ReconciliationSummary };

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
    const logger = context.get(Logger);
    // Only reading the pending transactions can fail the run; the scheduler tries again later.
    const summary = await context
      .get(ReconcileTransactions)
      .execute()
      .match({
        ok: (value) => value,
        err: (error) => {
          throw new Error(`Reconciliation failed: ${error.code}`, { cause: error });
        },
      });

    logger.log(summary, 'Reconciliation run finished');
    return summary;
  };
};

export const handler = createReconcileHandler();
