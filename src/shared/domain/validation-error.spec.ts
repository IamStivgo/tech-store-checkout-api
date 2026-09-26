import { ValidationError } from './validation-error';

describe('ValidationError', () => {
  it('carries every invalid field with the VALIDATION_ERROR code', () => {
    const error = new ValidationError([
      { field: 'email', message: 'email must be a valid email address' },
      { field: 'phone', message: 'phone must be a Colombian number' },
    ]);

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.detail).toBe('The request contains invalid fields.');
    expect(error.fieldErrors).toHaveLength(2);
  });

  it('builds a single field error', () => {
    expect(ValidationError.forField('quantity', 'quantity must be positive').fieldErrors).toEqual([
      { field: 'quantity', message: 'quantity must be positive' },
    ]);
  });
});
