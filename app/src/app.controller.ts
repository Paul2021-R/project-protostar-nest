import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { REDIS_CLIENT } from './common/redis/redis.module';
import Redis from 'ioredis';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test-db') // http://localhost:3000/test-db
  async testDb() {
    return this.appService.testDbConnection();
  }

  @Get('health/redis')
  async checkRedis() {
    const ping = await this.redis.ping();

    await this.redis.set('toss-test', 'success', 'EX', 60);

    const value = await this.redis.get('toss-test');

    return {
      status: 'ok',
      redisPing: ping,
      testValue: value,
    };
  }
}
