import { GetParametersCommand, type SSMClient } from '@aws-sdk/client-ssm';

import type { SecretSource } from '../../../config/app-config';

/**
 * Resolves secrets once, at startup (a cold start in Lambda): SSM SecureString parameters are
 * read in a single call and decrypted; local values are used as they are. Fails fast when a
 * parameter is missing, so a misconfigured function never serves requests.
 */
export const readSecrets = async <K extends string>(
  ssm: SSMClient,
  sources: Readonly<Record<K, SecretSource>>,
): Promise<Record<K, string>> => {
  const entries = Object.entries<SecretSource>(sources) as [K, SecretSource][];
  const parameterNames = entries.flatMap(([, source]) =>
    'parameterName' in source ? [source.parameterName] : [],
  );

  const values = new Map<string, string>();
  if (parameterNames.length > 0) {
    const { Parameters = [], InvalidParameters = [] } = await ssm.send(
      new GetParametersCommand({ Names: parameterNames, WithDecryption: true }),
    );
    if (InvalidParameters.length > 0) {
      throw new Error(`Missing SSM parameters: ${InvalidParameters.join(', ')}`);
    }
    Parameters.forEach(({ Name, Value }) => {
      if (Name && Value) {
        values.set(Name, Value);
      }
    });
  }

  return Object.fromEntries(
    entries.map(([key, source]) => {
      const value = 'parameterName' in source ? values.get(source.parameterName) : source.value;
      if (!value) {
        throw new Error(`Secret ${key} is empty`);
      }
      return [key, value];
    }),
  ) as Record<K, string>;
};
