import { ERROR_CODES } from '../../domain/error-code';

import { HTTP_STATUS_BY_ERROR_CODE } from './error-http-status';

describe('HTTP_STATUS_BY_ERROR_CODE', () => {
  it.each([
    ['VALIDATION_ERROR', 400],
    ['PRODUCT_NOT_FOUND', 404],
    ['QUANTITY_LIMIT_EXCEEDED', 422],
    ['CITY_NOT_SUPPORTED', 422],
    ['DEPARTMENT_NOT_FOUND', 404],
    ['CUSTOMER_NOT_FOUND', 404],
    ['TRANSACTION_NOT_FOUND', 404],
    ['INSUFFICIENT_STOCK', 409],
    ['TRANSACTION_NOT_PAYABLE', 409],
    ['PAYMENT_ALREADY_SUBMITTED', 409],
    ['TRANSACTION_NOT_CANCELLABLE', 409],
    ['PAYMENT_REJECTED_BY_PROVIDER', 422],
    ['PAYMENT_PROVIDER_UNAVAILABLE', 502],
    ['PAYMENT_PROVIDER_TIMEOUT', 504],
    ['INVALID_EVENT_SIGNATURE', 401],
    ['DELIVERY_NOT_FOUND', 404],
    ['IDEMPOTENCY_KEY_REQUIRED', 400],
    ['IDEMPOTENCY_KEY_CONFLICT', 409],
    ['IDEMPOTENCY_REQUEST_IN_PROGRESS', 409],
    ['INTERNAL_ERROR', 500],
  ] as const)('maps %s to HTTP %i', (code, status) => {
    expect(HTTP_STATUS_BY_ERROR_CODE[code]).toBe(status);
  });

  it('maps every error code of the catalog', () => {
    expect(Object.keys(HTTP_STATUS_BY_ERROR_CODE).sort()).toEqual([...ERROR_CODES].sort());
  });
});
