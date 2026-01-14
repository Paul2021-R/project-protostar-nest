import { CallHandler, ExecutionContext, Injectable, NestInterceptor, ServiceUnavailableException } from "@nestjs/common";
import { QueueService } from "../queue/queue.service";
import { Observable } from "rxjs";

@Injectable()
export class KnowledgeUploadBusyCheckInterceptor implements NestInterceptor {
  constructor(private readonly queueService: QueueService) {

  }
  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    if (this.queueService.isBusy()) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        message: 'System is currently busy processing documents. Please try again later.',
        error: 'Service Uavailable',
        data: this.queueService.getStatus()
      })
    }

    return next.handle();
  }
}