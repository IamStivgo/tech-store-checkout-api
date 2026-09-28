import { SSMClient } from '@aws-sdk/client-ssm';

import type { AppConfig } from '../../../config/app-config';
import { readSecrets } from '../../../shared/infrastructure/secrets/secret-reader';
import type { PaymentGateway } from '../domain/payment-gateway.port';

import { FakePaymentGateway } from './fake/fake-payment-gateway';
import { HttpPaymentGateway } from './provider/http-payment-gateway';

/** Chooses the adapter from the configuration; the secrets are read once per cold start. */
export const createPaymentGateway = async (
  config: AppConfig,
  ssm: SSMClient = new SSMClient({ region: config.awsRegion }),
): Promise<PaymentGateway> => {
  const { payments } = config;
  if (payments.provider === 'fake') {
    return new FakePaymentGateway();
  }

  const secrets = await readSecrets(ssm, {
    privateKey: payments.privateKey,
    integritySecret: payments.integritySecret,
    eventsSecret: payments.eventsSecret,
  });
  return new HttpPaymentGateway({
    baseUrl: payments.apiBaseUrl.replace(/\/$/, ''),
    publicKey: payments.publicKey,
    privateKey: secrets.privateKey,
    integritySecret: secrets.integritySecret,
    timeoutMs: payments.timeoutMs,
    events: { secret: secrets.eventsSecret, environment: payments.eventsEnvironment },
  });
};
