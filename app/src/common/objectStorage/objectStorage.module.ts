import { Global, Module } from '@nestjs/common';
import { ObjectStorageService } from './objectStorage.service';

@Global()
@Module({
  providers: [ObjectStorageService],
  exports: [ObjectStorageService],
})
export class ObjectStorageModule {}
