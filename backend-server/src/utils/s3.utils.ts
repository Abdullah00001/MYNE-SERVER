import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';

import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import mime from 'mime-types';
import { injectable } from 'tsyringe';

import s3Client from '@/configs/s3Client.config';
import { env } from '@/env';
import { SystemUtils } from '@/utils/system.utils';

@injectable()
export class S3Utils {
  private bucketName = env.S3_BUCKET_NAME;
  private regionName = env.S3_REGION;
  constructor(private readonly systemUtils: SystemUtils) {}
  public async singleUpload({
    filePath,
    key,
    mimeType,
  }: {
    filePath: string;
    mimeType: string;
    key: string;
  }): Promise<string> {
    try {
      const contentType = mime.lookup(filePath);
      const stream = createReadStream(filePath);
      const command = new PutObjectCommand({
        Key: key,
        Bucket: this.bucketName,
        ContentType: contentType || `image/${mimeType.replace(/^\./, '')}`,
        Body: stream,
      });
      await s3Client.send(command);
      await unlink(filePath);
      return `https://${this.bucketName}.s3.${this.regionName}.amazonaws.com/${key}`;
    } catch (error) {
      await this.systemUtils.unlinkFile({ filePath });
      if (error instanceof Error) throw error;
      throw new Error(
        'Unknown Error Occurred In S3 Single File Upload Utility'
      );
    }
  }

  public async singleDelete({ key }: { key: string }): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await s3Client.send(command);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'Unknown Error Occurred In S3 Single File Delete Utility'
      );
    }
  }

  public async multipleUpload(): Promise<void> {}

  public async multipleDelete(): Promise<void> {}
}
