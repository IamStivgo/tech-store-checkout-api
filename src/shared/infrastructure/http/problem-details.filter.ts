import { Catch, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  INTERNAL_ERROR_CODE,
  PROBLEM_JSON_CONTENT_TYPE,
  toProblemDetails,
} from './problem-details';

const UNKNOWN_TRACE_ID = 'unknown';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const problem = toProblemDetails(exception, {
      instance: request.path,
      traceId: typeof request.id === 'string' ? request.id : UNKNOWN_TRACE_ID,
    });

    if (problem.code === INTERNAL_ERROR_CODE) {
      this.logger.error(exception);
    }

    response.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
  }
}
