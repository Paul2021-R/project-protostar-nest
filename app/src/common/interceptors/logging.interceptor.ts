import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP-Traffic');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const method = request.method;
    const url = request.url;
    const ip = request.ip;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - now;
        const statusCode = response.statusCode;

        const logData = {
          type: 'http_traffic_protostar',
          method: method,
          path: url,
          status: statusCode,
          duration_ms: responseTime,
          ip: ip,
          timestamp: new Date().toISOString(),
        };

        if (statusCode < 400) {
          this.logger.log(logData); // 400 미만 성공 케이스만 일단 수집
        }
      }),
    );
  }
}
