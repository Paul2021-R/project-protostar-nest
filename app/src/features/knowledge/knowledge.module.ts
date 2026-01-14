import { Module } from "@nestjs/common";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeService } from "./knowledge.service";
import { QueueService } from "src/common/queue/queue.service";
import { MulterModule } from "@nestjs/platform-express";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        limits: {
          fileSize: 50 * 1024 * 1024 //50MB
        },
        fileFilter: (req, file, callback) => {
          if (!file.originalname.match(/\.(md)$/)) {
            return callback(new Error('Only Markdown files are allowed!'), false);
          }
          callback(null, true);
        }
      }),
      inject: [ConfigService]
    })
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, QueueService],
})
export class KnowledgeModule { }