import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './common/prisma/prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    this.logger.log('Called Root TEST API');
    return 'Hello World!';
  }
}
