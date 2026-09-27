import { DomainError } from './domain-error';

export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';

  constructor(readonly fieldErrors: readonly FieldError[]) {
    super('The request contains invalid fields.');
  }

  static forField(field: string, message: string): ValidationError {
    return new ValidationError([{ field, message }]);
  }
}
