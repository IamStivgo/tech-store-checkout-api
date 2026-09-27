import { Catch, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  INTERNAL_ERROR_CODE,
  PROBLEM_JSON_CONTENT_TYPE,
  toProblemDetails,
  type ProblemContext,
} from './problem-details';

const UNKNOWN_TRACE_ID = 'unknown';

export const problemContextOf = (request: Request): ProblemContext => ({
  instance: request.path,
  traceId: typeof request.id === 'string' ? request.id : UNKNOWN_TRACE_ID,
});

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const problem = toProblemDetails(exception, problemContextOf(request));

    if (problem.code === INTERNAL_ERROR_CODE) {
      this.logger.error(exception);
    }

    // Route-level @Header values are set before the handler runs, so errors could inherit a
    // cacheable Cache-Control (e.g. a 404 cached for a day). Errors are never cacheable.
    response
      .status(problem.status)
      .setHeader('Cache-Control', 'no-store')
      .type(PROBLEM_JSON_CONTENT_TYPE)
      .json(problem);
  }
}
