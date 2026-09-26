import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';

import { AppModule } from '../../src/app.module';
import { APP_CONFIG } from '../../src/config/app-config.token';
import type { Clock } from '../../src/shared/domain/clock.port';
import { configureApp } from '../../src/shared/infrastructure/http/configure-app';
import { CLOCK } from '../../src/shared/infrastructure/system/clock.token';
import { aConfig } from '../builders/app-config.builder';
import { FakeClock } from '../fakes/fake-clock';

interface TestAppOptions {
  readonly env?: Readonly<Record<string, string>>;
  readonly clock?: Clock;
  readonly controllers?: Type[];
}

export const createTestApp = async ({
  env = {},
  clock = new FakeClock(new Date('2026-09-24T20:15:00.000Z')),
  controllers = [],
}: TestAppOptions = {}): Promise<INestApplication<App>> => {
  const config = aConfig(env);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app, config);
  await app.init();
  return app;
};
