import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Cron } from '@nestjs/schedule';
import Redis from 'ioredis';

@Injectable()
export class AiStatusMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(AiStatusMonitoringService.name);
  private isAiAvailable: boolean = false;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleInit() {
    await this.syncStatus();
  }

  @Cron('*/1 * * * * *')
  async syncStatus() {
    try {
      const now = Date.now() / 1000;
      const threshold = now - 5;

      /**
       * 로직
       * 0. 1초마다 동기화 되어야하며(polling)
       * 1. 좀비 서버 청소 -> 옛날 정보들
       * 2. 생존 서버 갯수 확인
       * 3. 상태 업데이트
       */

      await this.redis.zremrangebyscore(
        'cluster:heartbeats',
        '-inf',
        threshold,
      );
      const count = await this.redis.zcard('cluster:heartbeats');
      const newState = count > 0;

      if (this.isAiAvailable !== newState) {
        this.isAiAvailable = newState;
        this.logger.warn(
          `📊 AI Status Changed: ${this.isAiAvailable ? '🟢 ONLINE' : '🔴 OFFLINE'}`,
        );
      }
    } catch (e) {
      this.logger.error(`📊 AI Status Sync Error: ${e.message}`);
      this.isAiAvailable = false;
    }
  }

  public isAvailable(): boolean {
    return this.isAiAvailable;
  }
}
