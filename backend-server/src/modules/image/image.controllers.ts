import { Request, Response, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseController } from '@/core/base_classes/base.controller';
import { ImageService } from '@/modules/image/image.services';

@injectable()
export class ImageController extends BaseController {
  public uploadImage: RequestHandler;
  public deleteImage: RequestHandler;

  constructor(private readonly imageService: ImageService) {
    super();
    this.uploadImage = this.wrap(this._uploadImage);
    this.deleteImage = this.wrap(this._deleteImage);
  }

  private async _uploadImage(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        status: 400,
        message: 'Image not found',
      });
      return;
    }
    const result = await this.imageService.uploadImage({ image: file });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Image upload successful',
      data: result,
    });
    return;
  }

  private async _deleteImage(req: Request, res: Response): Promise<void> {
    const { url } = req.query;
    if (!url) {
      res.status(404).json({
        success: false,
        status: 404,
        message: 'Image not found on params',
      });
      return;
    }
    await this.imageService.deleteImage({ imageUrl: url as string });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Image delete successful',
    });
    return;
  }
}
