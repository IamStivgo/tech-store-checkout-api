import { configure as serverlessExpress } from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';

import { AppModule } from './app.module';
import type { AppConfig } from './config/app-config';
import { APP_CONFIG } from './config/app-config.token';
import { configureApp } from './shared/infrastructure/http/configure-app';
import { REQUEST_ID_HEADER } from './shared/infrastructure/logging/logger-params';

export type ApiGatewayHandler = (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyStructuredResultV2>;

const bootstrap = async (): Promise<ApiGatewayHandler> => {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    abortOnError: false,
  });
  configureApp(app, app.get<AppConfig>(APP_CONFIG));
  await app.init();

  const proxy = serverlessExpress<APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2>({
    app: app.getHttpAdapter().getInstance(),
  });
  return async (event, context) =>
    (await proxy(event, context, () => undefined)) as APIGatewayProxyStructuredResultV2;
};

const withGatewayRequestId = (event: APIGatewayProxyEventV2): APIGatewayProxyEventV2 => ({
  ...event,
  headers: { ...event.headers, [REQUEST_ID_HEADER]: event.requestContext.requestId },
});

export const createApiHandler = (): ApiGatewayHandler => {
  let cachedProxy: Promise<ApiGatewayHandler> | undefined;

  const getProxy = (): Promise<ApiGatewayHandler> => {
    cachedProxy ??= bootstrap().catch((error: unknown) => {
      cachedProxy = undefined;
      throw error;
    });
    return cachedProxy;
  };

  return async (event, context) => {
    const proxy = await getProxy();
    return proxy(withGatewayRequestId(event), context);
  };
};

export const handler = createApiHandler();
