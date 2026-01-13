import { Injectable, InternalServerErrorException, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { CreateBucketCommand, DeleteObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

@Injectable()
export class ObjectStorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObjectStorageService.name);
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.MINIO_REGION || 'us-east-1',
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!,
        secretAccessKey: process.env.MINIO_SECRET_KEY!,
      },
    });
    this.bucketName = process.env.MINIO_BUCKET_NAME!;
  }

  onModuleDestroy() {
    this.s3Client.destroy();
  }

  async onModuleInit() {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.bucketName }),
      )
      this.logger.log('✅ MinIO Connected & Bucket Found');
    } catch (error) {
      if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
        // buket 존재 여부 확인 및 버킷 생성
        this.logger.warn(`⚠️ Bucket not found. Creating bucket: ${this.bucketName}`);
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
      )
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
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimeType,
      });
      await this.s3Client.send(command);
      return fileName;
    }
    catch (error) {
      throw new InternalServerErrorException(`File Upload Failed: ${error}`);
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });
      await this.s3Client.send(command);
    }
    catch (error) {
      throw new InternalServerErrorException(`File Delete Failed: ${error}`)
    }
  }

}