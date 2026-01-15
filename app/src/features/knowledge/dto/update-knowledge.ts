import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  title?: string;
}
