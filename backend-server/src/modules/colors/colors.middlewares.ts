import { Request, Response, NextFunction, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseMiddleware } from '@/core/base_classes/base.middleware';
import Color from '@/modules/colors/colors.model';

@injectable()
export class ColorsMiddleware extends BaseMiddleware {
  public checkColorByName: RequestHandler;

  constructor() {
    super();
    this.checkColorByName = this.wrap(this._checkColorByName);
  }

  private async _checkColorByName(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { colorName } = req.body;

    const color = await Color.findOne({
      colorName: { $regex: new RegExp(`^${colorName}$`, 'i') },
    });

    if (color) {
      res.status(409).json({
        success: false,
        status: 409,
        message: `Color with name "${colorName}" already exists`,
      });
      return;
    }

    next();
  }
}
