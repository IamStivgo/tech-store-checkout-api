import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';

import { aConfig } from '../../../../test/builders/app-config.builder';

import { FakePaymentGateway } from './fake/fake-payment-gateway';
import { createPaymentGateway } from './payment-gateway.factory';
import { HttpPaymentGateway } from './provider/http-payment-gateway';

const HTTP_ENV = {
  PAYMENT_PROVIDER: 'http',
  PAYMENT_API_BASE_URL: 'https://provider.test/v1/',
  PAYMENT_PUBLIC_KEY: 'pub_test_key',
  PAYMENT_PRIVATE_KEY_PARAM: '/checkout-app/test/payment/private-key',
  PAYMENT_INTEGRITY_SECRET: 'integrity_secret_for_tests',
};

describe('createPaymentGateway', () => {
  const ssm = new SSMClient({ region: 'us-east-1' });
  const ssmMock = mockClient(ssm);

  beforeEach(() => {
    ssmMock.reset();
  });

  it('uses the fake provider when configured', async () => {
    expect(await createPaymentGateway(aConfig(), ssm)).toBeInstanceOf(FakePaymentGateway);
    expect(ssmMock.commandCalls(GetParametersCommand)).toHaveLength(0);
  });

  it('builds the HTTP provider with the secrets read from SSM', async () => {
    ssmMock.on(GetParametersCommand).resolves({
      Parameters: [{ Name: '/checkout-app/test/payment/private-key', Value: 'prv_test_key' }],
    });
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));

    const gateway = await createPaymentGateway(aConfig(HTTP_ENV), ssm);
    await gateway.findPaymentByReference('CKT-1');

    expect(gateway).toBeInstanceOf(HttpPaymentGateway);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://provider.test/v1/transactions?reference=CKT-1');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer prv_test_key');
    fetchMock.mockRestore();
  });

  it('creates its own SSM client from the configured region by default', async () => {
    expect(await createPaymentGateway(aConfig())).toBeInstanceOf(FakePaymentGateway);
  });
});
