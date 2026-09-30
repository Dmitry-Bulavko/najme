import { Module } from '@nestjs/common';
import { ObjectStorage } from './object-storage.js';
import { S3ObjectStorage } from './s3-object-storage.js';

/** Provides the ObjectStorage seam only (no HTTP). Safe to import from BusinessesModule. */
@Module({
  providers: [{ provide: ObjectStorage, useClass: S3ObjectStorage }],
  exports: [ObjectStorage],
})
export class StorageModule {}
