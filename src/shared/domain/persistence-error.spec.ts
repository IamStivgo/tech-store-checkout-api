import { PersistenceError } from './persistence-error';

describe('PersistenceError', () => {
  it('is an internal error that keeps the technical cause for logging', () => {
    const cause = new Error('ProvisionedThroughputExceededException');

    const error = new PersistenceError('products.findById', cause);

    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.operation).toBe('products.findById');
    expect(error.cause).toBe(cause);
  });
});
