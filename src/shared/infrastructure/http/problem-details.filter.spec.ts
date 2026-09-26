import { Logger, NotFoundException, type ArgumentsHost } from '@nestjs/common';

import { ProblemDetailsFilter } from './problem-details.filter';

const createHost = (request: { path: string; id?: unknown }) => {
  const response = {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
};

describe('ProblemDetailsFilter', () => {
  let logError: jest.SpyInstance;

  beforeEach(() => {
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    logError.mockRestore();
  });

  it('writes the problem as application/problem+json with the request path and id', () => {
    const { host, response } = createHost({ path: '/api/v1/products/42', id: 'req-1' });

    new ProblemDetailsFilter().catch(new NotFoundException('Product not found'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ instance: '/api/v1/products/42', traceId: 'req-1' }),
    );
  });

  it('uses an unknown trace id when the request has no id', () => {
    const { host, response } = createHost({ path: '/api/v1/products' });

    new ProblemDetailsFilter().catch(new NotFoundException(), host);

    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ traceId: 'unknown' }));
  });

  it('logs unexpected errors', () => {
    const { host } = createHost({ path: '/api/v1/products', id: 'req-1' });
    const error = new Error('boom');

    new ProblemDetailsFilter().catch(error, host);

    expect(logError).toHaveBeenCalledWith(error);
  });

  it('does not log client errors', () => {
    const { host } = createHost({ path: '/api/v1/products', id: 'req-1' });

    new ProblemDetailsFilter().catch(new NotFoundException(), host);

    expect(logError).not.toHaveBeenCalled();
  });
});
