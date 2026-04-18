import { Request, Response, NextFunction, RequestHandler } from 'express';
import { injectable } from 'tsyringe';
import fs from 'fs/promises';

import { BaseMiddleware } from '@/core/base_classes/base.middleware';
import Brand from '@/modules/brand/brand.model';

@injectable()
export class BrandMiddleware extends BaseMiddleware {
  public findBrandById: RequestHandler;
  public checkBrandByName: RequestHandler;

  constructor() {
    super();
    this.findBrandById = this.wrap(this._findBrandById);
    this.checkBrandByName = this.wrap(this._checkBrandByName);
  }

  private async _findBrandById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    const brand = await Brand.findById(id);
    if (!brand) {
      res.status(404).json({
        success: false,
        status: 404,
        message: `Brand with this id ${id} not found`,
      });
      return;
    }
    req.brand = brand;
    next();
  }

  private async _checkBrandByName(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { brandName } = req.body;

    if (!brandName) {
      res.status(400).json({
        success: false,
        status: 400,
        message: 'brandName is required',
      });
      return;
    }

    const brand = await Brand.findOne({
      brandName: { $regex: new RegExp(`^${brandName}$`, 'i') },
    });

    if (brand) {
      if (req.file?.path) {
        await fs.unlink(req.file.path);
      }

      res.status(409).json({
        success: false,
        status: 409,
        message: `Brand with name "${brandName}" already exists`,
      });
      return;
    }

    next();
  }
}
