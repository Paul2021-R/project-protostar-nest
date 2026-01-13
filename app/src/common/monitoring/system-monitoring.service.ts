import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

@Injectable()
export class SystemMonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemMonitoringService.name);
  private interval: NodeJS.Timeout;

  onModuleInit() {
    if (process.env.NODE_ENV === 'production') {
      this.interval = setInterval(() => {
        this.logSystemMetrics();
      }, 5000);
    }
  }

  onModuleDestroy() {
    clearInterval(this.interval);
  }

  private logSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const metrics = {
      type: 'system-metrics-protostar',
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(metrics);
  }
}
