import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  errorMessage,
  errorStack,
  logExecutionError,
  sqlErrorNumber,
} from './execution-error-log';

const LOG_STATUSES = new Set([400, 404, 409, 422]);

function shouldLogStatus(status: number): boolean {
  if (status === 401 || status === 403) return false;
  return LOG_STATUSES.has(status) || status >= 500;
}

@Catch()
export class ExecutionErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? httpExceptionMessage(exception)
        : errorMessage(exception);

    if (shouldLogStatus(status)) {
      logExecutionError({
        method: req.method,
        url: req.originalUrl ?? req.url,
        status,
        message,
        sqlNumber: sqlErrorNumber(exception),
        stack: errorStack(exception),
      });
    }

    if (res.headersSent) return;

    if (exception instanceof HttpException) {
      res.status(status).json(exception.getResponse());
      return;
    }

    res.status(status).json({
      statusCode: status,
      message: 'Error interno del servidor',
    });
  }
}

function httpExceptionMessage(ex: HttpException): string {
  const body = ex.getResponse();
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && 'message' in body) {
    const m = body.message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.map(String).join('; ');
  }
  return ex.message;
}
