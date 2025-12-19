import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Query,
  Sse,
} from '@nestjs/common';
import { from, interval, merge, Observable } from 'rxjs';
import { map, finalize } from 'rxjs/operators';
import {
  SSE_HEARTBEAT_INTERNBAL,
  SSE_RETRY_SECONDS,
} from 'src/common/constants';
import { ChatService } from './chat.service';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/v1/chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Get('stream/:sessionId')
  @Sse('stream/:sessionId')
  @Header('X-Accel-Buffering', 'no')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  stream(
    @Param('sessionId') sessionId: string,
    @Query('uuid') earlyUUID?: string,
  ): Observable<MessageEvent<any>> {
    if (!this.chatService.isOkayToConnect()) {
      this.logger.warn(`Connection Limit reached`);
      throw new HttpException(
        {
          success: false,
          message: 'Server is currently at full capacity',
          retryAfter: SSE_RETRY_SECONDS,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const targetUuid = earlyUUID || uuidv4();

    const userStreamSubject = this.chatService.addClient(targetUuid, sessionId);
    if (!userStreamSubject) {
      throw new HttpException(
        {
          success: false,
          message: 'Server is currently at full capacity',
          retryAfter: SSE_RETRY_SECONDS,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.logger.log(
      `🟢 SSE Connected. User: ${targetUuid}, Active: ${this.chatService.getActiveConnections()}`,
    );

    const messageStream = userStreamSubject.asObservable().pipe(
      map(
        (payload) =>
          ({
            data: payload,
          }) as MessageEvent,
      ),
    );

    const initEvent = from([
      {
        data: {
          type: 'init',
          uuid: targetUuid,
          sessionId: sessionId,
          message: 'Connection established',
        },
      } as MessageEvent,
    ]);

    const heartbeatEvent = interval(SSE_HEARTBEAT_INTERNBAL).pipe(
      map(
        () =>
          ({
            data: {
              type: 'heartbeat',
              uuid: targetUuid,
              sessionId: sessionId,
              message: 'Heartbeat',
              timestamp: new Date().toISOString(),
            },
          }) as MessageEvent,
      ),
    );

    return merge(initEvent, heartbeatEvent, messageStream).pipe(
      finalize(() => {
        this.chatService.removeClient(targetUuid, sessionId);
        this.logger.log(
          `🔴 SSE Disconnected. User: ${targetUuid}, Active: ${this.chatService.getActiveConnections()}`,
        );

        //TODO: Implement Redis Unsubscribe Logic
      }),
    );
  }
}
