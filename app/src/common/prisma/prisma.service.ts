import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    // 생성 기능에 충실하게
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not defined');
    }

    const pool = new Pool({ connectionString: databaseUrl });

    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    // 연결 성공 여부 확인 및 DB URL 보안 마스킹 추가
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not defined');
    }

    const parsedUrl = new URL(databaseUrl);
    parsedUrl.password = '****';
    const maskedUrl = parsedUrl.toString();

    try {
      await this.$connect();
      await this.$queryRaw`SELECT 1`;
      this.logger.log(`Database connected: ${maskedUrl}`);
    } catch (e) {
      this.logger.error(`Database connection failed. Check Database URL`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
