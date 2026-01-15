import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DocStatus } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { REDIS_CLIENT } from 'src/common/redis/redis.module';

/**
 * TODO: 현재 상태는 데이터의 상태에 따라 race condition 발새 여지가 있음.
 * 동시성을 고려한 설계로 개선 될 필요 있음.
 * 데모로는 충분히 사용 가능한 상태라 향후 개선 예정
 */

@Injectable()
export class AiTaskService {
  private readonly logger = new Logger(AiTaskService.name);
  private readonly redisSubscriber: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisPublisher: Redis,
    private readonly prisma: PrismaService,
  ) {
    this.redisSubscriber = redisPublisher.duplicate();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchPendingTasks() {
    const targets = await this.prisma.knowledgeDoc.findMany({
      where: {
        status: DocStatus.UPLOADED,
      },
      take: 10,
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (targets.length === 0) return;

    this.logger.log(
      `Found ${targets.length} docs. Dispatching to Redis Queue...`,
    );

    for (const doc of targets) {
      try {
        const payload = JSON.stringify({
          docId: doc.id,
          minioKey: doc.minioKey,
          mimeType: doc.mimeType,
          minioBucket: doc.minioBucket,
        });

        await this.redisSubscriber.rpush('ai:job:queue', payload);

        await this.prisma.knowledgeDoc.update({
          where: {
            id: doc.id,
          },
          data: {
            status: DocStatus.PROCESSING,
          },
        });
        this.logger.log(`✅ [RPUSH] Job dispatched: ${doc.id}`);
      } catch (error) {
        this.logger.error(`❌ Dispatch Failed for ${doc.id}: ${error.message}`);
      }
    }
  }
}
