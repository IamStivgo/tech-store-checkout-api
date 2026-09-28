import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';

import { readSecrets } from './secret-reader';

describe('readSecrets', () => {
  const ssm = new SSMClient({ region: 'us-east-1' });
  const ssmMock = mockClient(ssm);

  beforeEach(() => {
    ssmMock.reset();
  });

  it('reads every SSM parameter in one decrypted call and keeps local values', async () => {
    ssmMock.on(GetParametersCommand).resolves({
      Parameters: [
        { Name: '/app/payment/private-key', Value: 'private' },
        { Name: '/app/payment/integrity-secret', Value: 'integrity' },
      ],
      InvalidParameters: [],
    });

    const secrets = await readSecrets(ssm, {
      privateKey: { parameterName: '/app/payment/private-key' },
      integritySecret: { parameterName: '/app/payment/integrity-secret' },
      localKey: { value: 'local' },
    });

    expect(secrets).toEqual({
      privateKey: 'private',
      integritySecret: 'integrity',
      localKey: 'local',
    });
    expect(ssmMock.commandCalls(GetParametersCommand)[0]?.args[0].input).toEqual({
      Names: ['/app/payment/private-key', '/app/payment/integrity-secret'],
      WithDecryption: true,
    });
  });

  it('does not call SSM when every secret is a local value', async () => {
    expect(await readSecrets(ssm, { privateKey: { value: 'local' } })).toEqual({
      privateKey: 'local',
    });
    expect(ssmMock.commandCalls(GetParametersCommand)).toHaveLength(0);
  });

  it('fails when a parameter does not exist', async () => {
    ssmMock.on(GetParametersCommand).resolves({ Parameters: [], InvalidParameters: ['/app/x'] });

    await expect(readSecrets(ssm, { privateKey: { parameterName: '/app/x' } })).rejects.toThrow(
      'Missing SSM parameters: /app/x',
    );
  });

  it('fails when a secret is empty', async () => {
    ssmMock.on(GetParametersCommand).resolves({ Parameters: [{ Name: '/app/x' }] });

    await expect(readSecrets(ssm, { privateKey: { parameterName: '/app/x' } })).rejects.toThrow(
      'Secret privateKey is empty',
    );
  });
});
