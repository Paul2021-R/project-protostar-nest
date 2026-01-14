import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { REDIS_CLIENT } from './common/redis/redis.module';
import Redis from 'ioredis';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) { }

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @SkipThrottle()
  @Get('health')
  getHealth(): string {
    return 'OK';
  }

  @SkipThrottle()
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
