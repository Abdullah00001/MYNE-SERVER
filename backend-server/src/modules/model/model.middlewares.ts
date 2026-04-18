import fs from 'fs/promises';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseMiddleware } from '@/core/base_classes/base.middleware';
import ModelModel from '@/modules/model/model.model';

@injectable()
export class ModelMiddleware extends BaseMiddleware {
  public findModelById: RequestHandler;
  public checkModelByName: RequestHandler;

  constructor() {
    super();
    this.findModelById = this.wrap(this._findModelById);
    this.checkModelByName = this.wrap(this._checkModelByName);
  }

  private async _findModelById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    const model = await ModelModel.findById(id);
    if (!model) {
      res.status(404).json({
        success: false,
        status: 404,
        message: `Model with this id ${id} not found`,
      });
      return;
    }
    req.model = model;
    next();
  }

  private async _checkModelByName(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { modelName } = req.body;

    if (!modelName) {
      res.status(400).json({
        success: false,
        status: 400,
        message: 'modelName is required',
      });
      return;
    }

    const model = await ModelModel.findOne({
      modelName: { $regex: new RegExp(`^${modelName}$`, 'i') },
    });

    if (model) {
      // Delete the uploaded file if it exists
      if (req.file?.path) {
        await fs.unlink(req.file.path);
      }

      res.status(409).json({
        success: false,
        status: 409,
        message: `Model with name "${modelName}" already exists`,
      });
      return;
    }

    next();
  }
}
