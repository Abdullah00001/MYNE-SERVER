import { Request, Response, NextFunction, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseMiddleware } from '@/core/base_classes/base.middleware';
import UserCollection from '@/modules/userBag/userBag.model';

@injectable()
export class AdminBagMiddleware extends BaseMiddleware {
  public findAdminBagById: RequestHandler;

  constructor() {
    super();
    this.findAdminBagById = this.wrap(this._findAdminBagById);
  }

  private async _findAdminBagById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    const bag = await UserCollection.findById(id);
    if (!bag) {
      res.status(404).json({
        success: false,
        status: 404,
        message: 'Admin Bag Not Found',
      });
      return;
    }
    req.adminBag = bag;
    next();
  }
}
