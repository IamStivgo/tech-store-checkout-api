import { ProductNotFoundError } from './product.errors';

describe('ProductNotFoundError', () => {
  it('uses the PRODUCT_NOT_FOUND code with a client-safe detail', () => {
    const error = new ProductNotFoundError();

    expect(error.code).toBe('PRODUCT_NOT_FOUND');
    expect(error.detail).toBe('The product does not exist or is no longer available.');
    expect(error.context).toEqual({});
  });
});
