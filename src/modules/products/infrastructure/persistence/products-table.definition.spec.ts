import { productsTableDefinition } from './products-table.definition';

describe('productsTableDefinition', () => {
  it('matches the products table of the infrastructure: productId as hash key, on demand', () => {
    expect(productsTableDefinition('checkout-app-local-products')).toEqual({
      TableName: 'checkout-app-local-products',
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [{ AttributeName: 'productId', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'productId', KeyType: 'HASH' }],
    });
  });
});
