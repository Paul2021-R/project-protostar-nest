import { Body, Controller, Delete, Get, Logger, Param, Post, Put, UploadedFile, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { KnowledgeService } from "./knowledge.service";
import { KnowledgeUploadBusyCheckInterceptor } from "src/common/interceptors/knowledge-upload-busy-check.interceptor";
import { ValidateUser } from "src/common/decorators/validate-user.decorator";
import { User } from "@prisma/client";
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';

@Controller('api/v1/upload/knowledge-docs')
export class KnowledgeController {
  private readonly logger = new Logger(KnowledgeController.name);

  constructor(private readonly knowledgeService: KnowledgeService) { }

  @Post()
  @UseInterceptors(KnowledgeUploadBusyCheckInterceptor)
  @UseInterceptors(FilesInterceptor('files'))
  async uploadDocs(
    @ValidateUser() user: User,
    @UploadedFiles() files: Array<Express.Multer.File>
  ) {
    return this.knowledgeService.uploadFiles(user, files);
  }

  @Get()
  async getKnowledgeDocs(@ValidateUser() user: User) {
    return this.knowledgeService.findAll(user);
  }

  @Put()
  @UseInterceptors(KnowledgeUploadBusyCheckInterceptor)
  @UseInterceptors(FileInterceptor('file'))
  async replaceDocs(
    @ValidateUser() user: User,
    @Body() body: { id: string, title: string },
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.knowledgeService.replaceFile(user, body.id, body.title, file);
  }

  @Delete(':id')
  async deleteDoc(@ValidateUser() user: User, @Param('id') id: string) {
    return this.knowledgeService.deleteFile(user, id);
  }

}