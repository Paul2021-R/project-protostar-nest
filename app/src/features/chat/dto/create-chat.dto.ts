import { IsEnum, IsNotEmpty, IsString, MaxLength, ValidateIf } from "@nestjs/class-validator";

export class CreateChatDto {

    @IsString()
    @IsNotEmpty()
    sessionId: string;

    @IsString()
    @IsNotEmpty()
    uuid: string;

    @IsEnum(['general', 'page_context'])
    @IsNotEmpty()
    mode: 'general' | 'page_context';

    @IsString()
    @IsNotEmpty()
    @MaxLength(50000)
    content: string;

    @ValidateIf(o => o.mode === 'page_context')
    @IsString()
    @IsNotEmpty()
    context?: string | null;
}