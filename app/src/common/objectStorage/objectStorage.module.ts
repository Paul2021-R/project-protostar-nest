import { Module } from "@nestjs/common";
import { ObjectStorageService } from "./objectStorage.service";

@Module({
  providers: [ObjectStorageService],
  exports: [ObjectStorageService],
})
export class ObjectStorageModule { }