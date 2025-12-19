import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { Subject } from 'rxjs';
import { CHAT_MAX_CONNECTIONS } from 'src/common/constants';
import { REDIS_CLIENT } from 'src/common/redis/redis.module';
import { ChatMessage } from './interface/ChatMessage';

@Injectable()
export class ChatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatService.name);
  private readonly streamMap = new Map<string, Subject<ChatMessage>>();
  private static activeConnections = 0;

  private readonly redisSubscriber: Redis;

  constructor(@Inject(REDIS_CLIENT) private readonly redisPublisher: Redis) {
    this.logger.log('ChatService initialized');
    this.redisSubscriber = redisPublisher.duplicate();
  }

  async onModuleInit() {
    await this.redisSubscriber.psubscribe('chat:stream:*');

    this.redisSubscriber.on('pmessage', (pattern, channel, message) => {
      this.logger.log(`Received message on channel ${channel}: ${message}`);
      this.routeMessageToUser(channel, message);
    });

    this.logger.log(
      '📡 Redis Subscriber Connected & Listening to chat:stream:*',
    );
  }

  onModuleDestroy() {
    this.redisSubscriber.quit();
  }

  private routeMessageToUser(channel: string, messageString: string) {
    try {
      // channel 예: "chat:stream:{UUID}-{sessionId}"
      const sessionId = channel.split(':').pop();

      if (!sessionId || !this.streamMap.has(sessionId)) {
        // 받는 사람이 없으면 무시 (이미 나간 유저 등)
        return;
      }

      const userStream = this.streamMap.get(sessionId);
      if (!userStream) {
        this.logger.warn(`No user stream found for sessionId: ${sessionId}`);
        return;
      }

      // JSON 파싱 후 사용자 스트림에 쏘기 (.next)
      // Worker에서 보낸 데이터가 단순 string이면 { content: ... } 로 감쌈
      const payload = JSON.parse(messageString);

      userStream.next({
        type: 'message',
        content: payload.content || payload, // 구조에 따라 조정
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      this.logger.error(`Message Routing Failed: ${e.message}`);
    }
  }

  public addClient(
    uuid: string,
    sessionId: string,
  ): Subject<ChatMessage> | null {
    if (!this.incrementActiveConnections()) return null;

    const subject = new Subject<ChatMessage>();
    this.streamMap.set(`${uuid}-${sessionId}`, subject);

    return subject;
  }

  public removeClient(uuid: string, sessionId: string) {
    if (this.streamMap.has(`${uuid}-${sessionId}`)) {
      const subject = this.streamMap.get(`${uuid}-${sessionId}`);
      if (!subject) {
        this.logger.warn(
          `No user stream found for sessionId: ${uuid} - ${sessionId}`,
        );
        return;
      }
      subject.complete();
      this.streamMap.delete(`${uuid}-${sessionId}`);
      this.decrementActiveConnections();
    }
  }

  public isOkayToConnect() {
    return ChatService.activeConnections < CHAT_MAX_CONNECTIONS;
  }

  public incrementActiveConnections(): boolean {
    if (ChatService.activeConnections >= CHAT_MAX_CONNECTIONS) {
      return false;
    }

    ChatService.activeConnections++;
    return true;
  }

  public decrementActiveConnections(): void {
    if (ChatService.activeConnections <= 0) {
      ChatService.activeConnections = 0;
      return;
    }

    ChatService.activeConnections--;
  }

  public getActiveConnections(): number {
    return ChatService.activeConnections;
  }
}
