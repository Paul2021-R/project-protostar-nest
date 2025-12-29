import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { Subject, timestamp } from 'rxjs';
import { CHAT_MAX_CONNECTIONS } from 'src/common/constants';
import { REDIS_CLIENT } from 'src/common/redis/redis.module';
import { ChatMessage } from './interface/ChatMessage';
import { CreateChatDto } from './dto/create-chat.dto';
import * as sanitize from 'sanitize-html';
import { v4 as uuidv4 } from 'uuid';

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

  public async dispatchJob(dto: CreateChatDto) {
    // 1. 검증 (Validation)
    if (!this.hasActiveStream(dto.uuid, dto.sessionId)) {
      this.logger.warn(`Unauthorized access attempt from UUID: ${dto.uuid}`);
      throw new Error('Unauthorized');
    }

    // 2. 세탁 (Sanitization) 위협적인 태그의 스크립트를 제거
    let cleanContext: string | null = null;

    if (dto.mode === 'page_context' && dto.context) {
      // sanitize HTML 진행
      cleanContext = sanitize(dto.context, {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: 'discard',
      });

      // 앞뒤 공백 제거
      cleanContext = cleanContext.trim();
    } else if (dto.mode === 'page_context' && !dto.context) {
      throw new Error('Bad Request');
    }

    // 3. 저장 및 큐 적재 (Redis)
    const jobId = uuidv4();
    const taskKey = `chat:task:${jobId}`;
    const taskPayload = JSON.stringify({
      jobId: jobId,
      uuid: dto.uuid,
      sessionId: dto.sessionId,
      mode: dto.mode,
      content: dto.content,
      context: cleanContext,
      timestamp: new Date().toISOString(),
    });

    const pipeline = this.redisPublisher.pipeline();
    pipeline.set(taskKey, taskPayload, 'EX', 300);
    pipeline.rpush('chat:job:queue', jobId);
    await pipeline.exec();

    this.logger.log(`Job ${jobId} dispatched successfully`);

    return jobId;
  }

  public hasActiveStream(uuid: string, sessionId: string): boolean {
    return this.streamMap.has(`${uuid}-${sessionId}`);
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

      userStream.next(payload);
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

  public getActiveConnections() {
    return ChatService.activeConnections;
  }
}
