import type { INestApplication, InjectionToken, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';

import { AppModule } from '../../src/app.module';
import { APP_CONFIG } from '../../src/config/app-config.token';
import type { Clock } from '../../src/shared/domain/clock.port';
import { configureApp } from '../../src/shared/infrastructure/http/configure-app';
import { CLOCK } from '../../src/shared/infrastructure/system/clock.token';
import { aConfig } from '../builders/app-config.builder';
import { FakeClock } from '../fakes/fake-clock';

export interface ProviderOverride {
  readonly provide: InjectionToken;
  readonly useValue: unknown;
}

interface TestAppOptions {
  readonly env?: Readonly<Record<string, string>>;
  readonly clock?: Clock;
  readonly controllers?: Type[];
  /** Replaces providers of the real app, e.g. a repository with an in-memory fake. */
  readonly providers?: readonly ProviderOverride[];
}

export const createTestApp = async ({
  env = {},
  clock = new FakeClock(new Date('2026-09-24T20:15:00.000Z')),
  controllers = [],
  providers = [],
}: TestAppOptions = {}): Promise<INestApplication<App>> => {
  const config = aConfig(env);
  const overrides: ProviderOverride[] = [
    { provide: APP_CONFIG, useValue: config },
    { provide: CLOCK, useValue: clock },
    ...providers,
  ];

  const builder = overrides.reduce(
    (testingModule, { provide, useValue }) =>
      testingModule.overrideProvider(provide).useValue(useValue),
    Test.createTestingModule({ imports: [AppModule], controllers }),
  );
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app, config);
  await app.init();
  return app;
};
