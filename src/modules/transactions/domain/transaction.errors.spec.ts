import {
  InsufficientStockError,
  PaymentAlreadySubmittedError,
  TransactionNotPayableError,
  TransactionNotCancellableError,
  TransactionNotFoundError,
} from './transaction.errors';

describe('transaction errors', () => {
  it('uses the stable API codes and a safe context', () => {
    expect(new TransactionNotFoundError().code).toBe('TRANSACTION_NOT_FOUND');
    expect(new TransactionNotCancellableError('APPROVED').context).toEqual({ status: 'APPROVED' });
    expect(new InsufficientStockError(2)).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      detail: 'Only 2 units are available for this product.',
      context: { availableUnits: 2 },
    });
    expect(new TransactionNotPayableError('FINAL', 'APPROVED').code).toBe(
      'TRANSACTION_NOT_PAYABLE',
    );
    expect(new PaymentAlreadySubmittedError().code).toBe('PAYMENT_ALREADY_SUBMITTED');
  });
});
