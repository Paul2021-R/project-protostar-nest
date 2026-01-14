import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { REDIS_CLIENT, RedisModule } from './common/redis/redis.module';
import { ChatModule } from './features/chat/chat.module';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Redis } from 'ioredis';
import { APP_GUARD } from '@nestjs/core';
import { ObjectStorageModule } from './common/objectStorage/objectStorage.module';
import { AuthModule } from './features/auth/auth.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { QueueService } from './common/queue/queue.service';
import { KnowledgeModule } from './features/knowledge/knowledge.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RedisModule,
    ChatModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [
          {
            name: 'burst',
            ttl: seconds(1),
            limit: 2000,
          },
          {
            name: 'sustained',
            ttl: seconds(60),
            limit: 60000,
          },
        ],
        errorMessage: 'System is busy. Please try again later.',
        storage: new ThrottlerStorageRedisService(redis.duplicate()),
      }),
    }),
    ObjectStorageModule,
    AuthModule,
    PrismaModule,
    KnowledgeModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    QueueService,
  ],
})
export class AppModule { }
