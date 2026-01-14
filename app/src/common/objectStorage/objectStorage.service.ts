import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ObjectStorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObjectStorageService.name);
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('MINIO_REGION') || 'us-east-1',
      endpoint:
        this.configService.get<string>('MINIO_ENDPOINT') ||
        'http://localhost:9000',
      forcePathStyle: true,
      credentials: {
        accessKeyId:
          this.configService.get<string>('MINIO_ACCESS_KEY') || 'admin',
        secretAccessKey:
          this.configService.get<string>('MINIO_SECRET_KEY') || 'admin',
      },
    });
    this.bucketName =
      this.configService.get<string>('MINIO_BUCKET_NAME') || 'protostar';
  }

  onModuleDestroy() {
    this.s3Client.destroy();
  }

  async onModuleInit() {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.bucketName }),
      );
      this.logger.log('✅ MinIO Connected & Bucket Found');
    } catch (error) {
      if (
        error?.name === 'NotFound' ||
        error?.$metadata?.httpStatusCode === 404
      ) {
        // buket 존재 여부 확인 및 버킷 생성
        this.logger.warn(
          `⚠️ Bucket not found. Creating bucket: ${this.bucketName}`,
        );
        await this.createBucket();
      } else {
        // 에러 발생
        this.logger.error(`❌ MinIO Connection Failed! ${error}`);
        throw error;
      }
    }
  }

  private async createBucket() {
    try {
      await this.s3Client.send(
        new CreateBucketCommand({ Bucket: this.bucketName }),
      );
      this.logger.log('✅ Bucket Created Successfully');
    } catch (error) {
      this.logger.error(`❌ Failed to create bucket: ${error}`);
      throw new InternalServerErrorException('Storage Init Failed');
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    specificBucketName?: string | null,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: (specificBucketName ? specificBucketName : this.bucketName),
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimeType,
        ACL: 'public-read',
      });
      await this.s3Client.send(command);
      return fileName;
    } catch (error) {
      throw new InternalServerErrorException(`File Upload Failed: ${error}`);
    }
  }

  async deleteFile(
    fileName: string,
    specificBucketName?: string | null,
  ): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: (specificBucketName ? specificBucketName : this.bucketName),
        Key: fileName,
      });
      await this.s3Client.send(command);
    } catch (error) {
      throw new InternalServerErrorException(`File Delete Failed: ${error}`);
    }
  }
}
