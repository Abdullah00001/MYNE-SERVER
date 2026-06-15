import { Request, Response, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseController } from '@/core/base_classes/base.controller';
import { ColorsService } from '@/modules/colors/colors.services';

@injectable()
export class ColorsController extends BaseController {
  public getColors: RequestHandler;
  public addColor: RequestHandler;

  constructor(private readonly colorsService: ColorsService) {
    super();
    this.getColors = this.wrap(this._getColors);
    this.addColor = this.wrap(this._addColor);
  }

  private async _getColors(req: Request, res: Response): Promise<void> {
    const params = req.query as {
      search?: string;
      page?: string;
      limit?: string;
    };
    const data = await this.colorsService.getColors({ params });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Retrieve all colors successful',
      ...data,
    });
    return;
  }

  private async _addColor(req: Request, res: Response): Promise<void> {
    const { colorName } = req.body;
    const data = await this.colorsService.addColor({ colorName });
    res.status(201).json({
      success: true,
      status: 201,
      message: 'Color create successful',
      data,
    });
    return;
  }
}
