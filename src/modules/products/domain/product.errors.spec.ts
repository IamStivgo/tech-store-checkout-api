import { ProductNotFoundError, QuantityLimitExceededError } from './product.errors';

describe('ProductNotFoundError', () => {
  it('uses the PRODUCT_NOT_FOUND code with a client-safe detail', () => {
    const error = new ProductNotFoundError();

    expect(error.code).toBe('PRODUCT_NOT_FOUND');
    expect(error.detail).toBe('The product does not exist or is no longer available.');
    expect(error.context).toEqual({});
  });
});

describe('QuantityLimitExceededError', () => {
  it('tells the client how many units it can buy', () => {
    const error = new QuantityLimitExceededError(3);

    expect(error.code).toBe('QUANTITY_LIMIT_EXCEEDED');
    expect(error.detail).toBe('You can buy up to 3 units of this product.');
    expect(error.context).toEqual({ maxUnitsPerOrder: 3 });
  });
});
