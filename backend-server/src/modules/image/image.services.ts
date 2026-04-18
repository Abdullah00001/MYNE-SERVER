import { extname, join } from 'path';

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

import { TFileInfo } from '@/modules/userBag/userBag.types';
import { S3Utils } from '@/utils/s3.utils';
import { SystemUtils } from '@/utils/system.utils';

@injectable()
export class ImageService {
  constructor(
    private readonly s3Utils: S3Utils,
    private readonly systemUtils: SystemUtils
  ) {}

  async uploadImage({
    image,
  }: {
    image: Express.Multer.File;
  }): Promise<string> {
    const imageFileInfo: TFileInfo = {
      filePath: join(__dirname, '../../../public/temp', image.filename),
      mimeType: extname(image.originalname),
      key: `user-collections/bag-image/${uuidv4()}/${Date.now()}${extname(image.originalname)}`,
    };
    try {
      const url = await this.s3Utils.singleUpload(imageFileInfo);
      return url;
    } catch (error) {
      await this.s3Utils.singleDelete({ key: imageFileInfo.key });
      if (error instanceof Error) throw error;
      throw new Error('An Unexpected Error Occurred In Upload Image Service');
    }
  }

  async deleteImage({ imageUrl }: { imageUrl: string }): Promise<void> {
    const key = this.systemUtils.extractS3KeyFromUrl(imageUrl);
    try {
      await this.s3Utils.singleDelete({key });
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('An Unexpected Error Occurred In Delete Image Service');
    }
  }
}
