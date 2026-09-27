import { FakeInsufficientStockError } from '../../../../test/fakes/fake-domain-errors';
import { err, errAsync, ok, okAsync } from '../../domain/result';

import { DomainHttpException } from './domain-http.exception';
import { toHttpResponse } from './to-http-response';

describe('toHttpResponse', () => {
  it('returns the value of a successful result', async () => {
    await expect(toHttpResponse(ok({ id: 'product-1' }))).resolves.toEqual({ id: 'product-1' });
    await expect(toHttpResponse(okAsync(42))).resolves.toBe(42);
  });

  it('throws the domain error as an HTTP exception with its catalog status', async () => {
    const error = new FakeInsufficientStockError(2);

    const failure = toHttpResponse(err(error));

    await expect(failure).rejects.toBeInstanceOf(DomainHttpException);
    await expect(failure).rejects.toMatchObject({ error, status: 409 });
  });

  it('unwraps async failures too', async () => {
    await expect(
      toHttpResponse(errAsync(new FakeInsufficientStockError(0))),
    ).rejects.toBeInstanceOf(DomainHttpException);
  });
});
