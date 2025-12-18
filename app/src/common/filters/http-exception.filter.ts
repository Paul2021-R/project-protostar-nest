import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. 상태 코드 판별
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 2. 에러 메시지 추출
    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal Server Error';

    // 3. 에러 상세 스택 추출
    const stack = exception instanceof Error ? exception.stack : '';

    // 4. Promtail 용 파싱
    const logData = {
      timestamp: new Date().toISOString(),
      level: status >= 500 ? 'error' : 'warn',
      path: request.url,
      method: request.method,
      ip: request.ip,
      status: status,
      message: message,
      stack: status >= 500 ? stack : undefined,
    };

    // 5. loki 용 출력
    if (status >= 500) {
      this.logger.error(JSON.stringify(logData));
    } else {
      this.logger.warn(JSON.stringify(logData));
    }

    // 6. 일괄 답변 형태
    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message:
        typeof message === 'object' && message !== null
          ? (message as any)['message'] || message
          : message,
    });
  }
}
