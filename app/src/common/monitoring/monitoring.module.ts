import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { AiStatusMonitoringService } from './ai-status-monitoring.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AiCircuitGuard } from '../guards/ai-circuit.guard';
import { SystemMonitoringService } from './system-monitoring.service';

@Module({
  imports: [ScheduleModule.forRoot(), RedisModule],
  providers: [
    AiStatusMonitoringService,
    SystemMonitoringService,
    AiCircuitGuard,
  ],
  exports: [AiStatusMonitoringService, SystemMonitoringService, AiCircuitGuard],
})
export class MonitoringModule {}
