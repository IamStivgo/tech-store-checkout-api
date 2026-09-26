import { loadAppConfig } from './app-config';
import { InvalidConfigError } from './invalid-config.error';

describe('loadAppConfig', () => {
  it('applies defaults when only APP_ENV is set', () => {
    const config = loadAppConfig({ APP_ENV: 'local' });

    expect(config).toEqual({
      appEnv: 'local',
      appVersion: '0.0.0-local',
      logLevel: 'info',
      port: 3000,
      corsAllowedOrigins: [],
    });
  });

  it('parses every provided variable', () => {
    const config = loadAppConfig({
      APP_ENV: 'prod',
      APP_VERSION: '1.0.0+abc123',
      LOG_LEVEL: 'warn',
      PORT: '8080',
      CORS_ALLOWED_ORIGINS: ' http://localhost:5173 , ,http://localhost:8080',
    });

    expect(config).toEqual({
      appEnv: 'prod',
      appVersion: '1.0.0+abc123',
      logLevel: 'warn',
      port: 8080,
      corsAllowedOrigins: ['http://localhost:5173', 'http://localhost:8080'],
    });
  });

  it('fails fast when APP_ENV is missing', () => {
    expect(() => loadAppConfig({})).toThrow(InvalidConfigError);
    expect(() => loadAppConfig({})).toThrow(/APP_ENV/);
  });

  it.each([
    ['APP_ENV', { APP_ENV: 'staging' }],
    ['LOG_LEVEL', { APP_ENV: 'local', LOG_LEVEL: 'verbose' }],
    ['PORT', { APP_ENV: 'local', PORT: 'not-a-number' }],
    ['PORT', { APP_ENV: 'local', PORT: '70000' }],
    ['APP_VERSION', { APP_ENV: 'local', APP_VERSION: '   ' }],
  ])('rejects an invalid %s', (variable, env) => {
    expect(() => loadAppConfig(env)).toThrow(new RegExp(variable));
  });

  it('reports every invalid variable at once', () => {
    const error = captureConfigError({ LOG_LEVEL: 'verbose', PORT: '0' });

    expect(error.issues).toHaveLength(3);
  });

  it('does not echo invalid values in the error message', () => {
    const error = captureConfigError({ APP_ENV: 'super-secret-value' });

    expect(error.message).not.toContain('super-secret-value');
  });
});

function captureConfigError(env: Record<string, string>): InvalidConfigError {
  try {
    loadAppConfig(env);
  } catch (error) {
    if (error instanceof InvalidConfigError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected loadAppConfig to throw');
}
