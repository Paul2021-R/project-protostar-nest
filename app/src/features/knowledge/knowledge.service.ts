import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { $Enums, DocStatus, User } from '@prisma/client';
import { ObjectStorageService } from 'src/common/objectStorage/objectStorage.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { QueueService } from 'src/common/queue/queue.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as crypto from 'crypto';
import * as CONSTANTS from 'src/common/constants';
import { RagWebhookDto } from './dto/rag-webhook.dto';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly bucketName: string;
  private readonly personalMaxUploads: number;

  constructor(
    private readonly objectStorageService: ObjectStorageService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
  ) {
    this.bucketName =
      this.configService.get<string>('MINIO_BUCKET_NAME') || 'protostar';
    this.personalMaxUploads = CONSTANTS.PERSONAL_MAX_UPLOADS;
  }

  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private generateMinioKey(filename: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    return `${year}/${month}/${uuidv4()}_${name}${ext}`;
  }

  private async formatResponse(docs: any[], userId: string) {
    const currentCount = await this.prisma.knowledgeDoc.count({
      where: {
        uploaderId: userId,
      },
    });

    return {
      uploadedData: docs.map((d) => ({
        id: d.id,
        title: d.title,
        originalFilename: d.originalFilename,
        fileSize: d.fileSize,
        status: d.status,
        version: d.version,
        createdAt: d.createdAt,
      })),
      meta: {
        total: currentCount,
        canUpload: Math.max(0, this.personalMaxUploads - currentCount),
      },
    };
  }

  private async processSingleFileUpload(user: User, file: Express.Multer.File) {
    const hash = this.calculateHash(file.buffer);
    const minioKey = this.generateMinioKey(file.originalname);
    await this.objectStorageService.uploadFile(
      file.buffer,
      minioKey,
      file.mimetype,
    );

    return this.prisma.knowledgeDoc.create({
      data: {
        title: file.originalname,
        originalFilename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        minioKey: minioKey,
        minioBucket: this.bucketName,
        status: DocStatus.UPLOADED,
        version: 1,
        contentHash: hash,
        uploaderId: user.id,
      },
    });
  }

  public async uploadFiles(user: User, files: Express.Multer.File[]) {
    const currentCount = await this.prisma.knowledgeDoc.count({
      where: {
        uploaderId: user.id,
      },
    });

    if (currentCount + files.length > this.personalMaxUploads) {
      this.logger.warn(
        `Upload blocked for user ${user.id}: Limit reached (${currentCount}/${this.personalMaxUploads})`,
      );
      throw new ForbiddenException(
        `Upload limit reached. You can only store up to ${this.personalMaxUploads} documents. Current: ${currentCount}`,
      );
    }

    const result = await Promise.all(
      files.map((file) =>
        this.queueService
          .add(async () => this.processSingleFileUpload(user, file))
          .catch((error) => {
            this.logger.error(
              `Upload failed for ${file.originalname}: ${error.message}`,
            );
            return null;
          }),
      ),
    );
    return this.formatResponse(
      result.filter((r) => r !== null),
      user.id,
    );
  }

  public async replaceFile(
    user: User,
    id: string,
    title: string,
    file: Express.Multer.File,
  ) {
    return this.queueService.add(async () => {
      const existingDoc = await this.prisma.knowledgeDoc.findUnique({
        where: { id },
      });

      if (!existingDoc) throw new NotFoundException('Document not found');

      if (existingDoc.uploaderId !== user.id)
        throw new ForbiddenException('Unauthorized');

      const hash = this.calculateHash(file.buffer);
      const minioKey = this.generateMinioKey(file.originalname);
      await this.objectStorageService.uploadFile(
        file.buffer,
        minioKey,
        file.mimetype,
      );

      try {
        await this.objectStorageService.deleteFile(existingDoc.minioKey);
      } catch (e) {
        this.logger.warn(
          `Failed to delete old file during replace: ${e.message}`,
        );
      }

      await this.prisma.knowledgeDoc.update({
        where: { id },
        data: {
          title,
          originalFilename: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          minioKey,
          minioBucket: this.bucketName,
          status: DocStatus.UPLOADED,
          version: { increment: 1 },
          contentHash: hash,
          updatedAt: new Date(),
        },
      });

      return this.findAll(user);
    });
  }

  public async findAll(user: User) {
    const docs = await this.prisma.knowledgeDoc.findMany({
      where: { uploaderId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return this.formatResponse(docs, user.id);
  }

  public async deleteFile(user: User, id: string) {
    const doc = await this.prisma.knowledgeDoc.findUnique({
      where: { id },
    });

    if (!doc) throw new NotFoundException('Document not found');

    if (doc.uploaderId !== user.id)
      throw new BadRequestException('Unauthorized');

    try {
      await this.objectStorageService.deleteFile(doc.minioKey);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`);
    }

    await this.prisma.knowledgeDoc.delete({
      where: { id },
    });
    return this.findAll(user);
  }

  /**
   * 웹 훅을 통한 상태 업데이트.
   * @param dto 
   */
  public async updateDocStatusViaWebhook(dto: RagWebhookDto) {
    const { docId, status, errorMessage, resultMeta } = dto;

    this.logger.log(`Webhook Received: Doc[${docId}] -> ${status}`);

    try {

      let metaDataToUpdate = {};

      if (status === DocStatus.COMPLETED && resultMeta !== undefined) {
        metaDataToUpdate = {
          chunkCount: resultMeta.chunkCount,
          embeddingModel: resultMeta.embeddingModel,
          vectorStoreKey: resultMeta.vectorStoreKey,
          completedAt: new Date(),
        }
      }

      await this.prisma.knowledgeDoc.update({
        where: { id: docId },
        data: {
          status, // TODO: 실패시 재 요청 해야 하지 않을까?
          errorMessage: status === DocStatus.FAILED ? errorMessage : undefined,
          metaData: metaDataToUpdate,
          updatedAt: new Date(),
        }
      })

      return {
        success: true,
      }

    } catch (error) {
      this.logger.error(`❌ Webhook transaction failed for ${docId}: ${error.message}`);
      // 처리 실패 핸들링을 위한 error 핸들링
      // TODO: 구체적인 로직 정책이 추가 필요
      throw new BadRequestException('Failed to process webhook');
    }
  }
}
