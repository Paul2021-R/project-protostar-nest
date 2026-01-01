import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { MonitoringModule } from 'src/common/monitoring/monitoring.module';

@Module({
  imports: [MonitoringModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [],
})
export class ChatModule {}
