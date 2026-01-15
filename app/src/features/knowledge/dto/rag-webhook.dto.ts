import { DocStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";

export class RagResultMeataDto {
  @IsNumber()
  @IsNotEmpty()
  chunkCount: number; // 청크 갯수

  @IsString()
  @IsNotEmpty()
  embeddingModel: string; // 사용 모델 기록

  @IsString()
  @IsOptional()
  vectorStoreKey?: string; // vector store key

}

export class RagWebhookDto {
  @IsUUID()
  @IsNotEmpty()
  docId: string;

  @IsEnum(['COMPLETED', 'FAILED'])
  @IsNotEmpty()
  status: DocStatus;

  @IsString()
  @IsOptional()
  errorMessage?: string;

  @IsOptional()
  @ValidateNested() // 하부 객체 validation
  @Type(() => RagResultMeataDto) // 형변환
  resultMeta?: RagResultMeataDto;
}