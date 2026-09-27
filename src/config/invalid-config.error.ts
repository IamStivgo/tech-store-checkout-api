export class InvalidConfigError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid configuration: ${issues.join('; ')}`);
    this.name = 'InvalidConfigError';
  }
}
