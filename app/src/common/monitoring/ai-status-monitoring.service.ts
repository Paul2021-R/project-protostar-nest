import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Cron } from '@nestjs/schedule';
import Redis from 'ioredis';

@Injectable()
export class AiStatusMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(AiStatusMonitoringService.name);
  private isAiAvailable: boolean = false;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) { }

  async onModuleInit() {
    try {
      await this.syncStatus();
    } catch (e) {
      this.logger.error(`📊 AI Status Sync Error: ${e.message}`);
    }
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

      /**
       * ioredis 의 기본 설정 -> 명령어 타임 아웃이 undefined 임
       * Redis 가 갑자기 죽음 -> NestJS 는 await 이하에서 계속 멈춰 있을 수 있음. 
       * 하물며 크론 작업이다보니 Redis 응답을 매 초 기다리고 멈춤. 메모리 누수, 이벤트 루프 고갈 발생 가능 
       * * 무엇이 쌓이는가? 단일 스레드에 뭐가 쌓일까? 
       * * Promise, Context : Heap 메모리, 변수, 실행문맥이 통째로 메모리 상에 올라간다. 
       * * 이때, GC 는 메모리를 해결하려고 하는데, 문제는 'await'으로 pending 상태이면 GC 는 못 치움
       * 해결 방법: Redis 연결 설정 Timeout 을 설정하여 개선 redis.module.ts 참고
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
