import { Request, Response, NextFunction, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseMiddleware } from '@/core/base_classes/base.middleware';
import UserCollection from '@/modules/userBag/userBag.model';

@injectable()
export class UserBagMiddleware extends BaseMiddleware {
  public findBagCollectionById: RequestHandler;

  constructor() {
    super();
    this.findBagCollectionById = this.wrap(this._findBagCollectionById);
  }

  private async _findBagCollectionById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    const collection =
      await UserCollection.findById(id).lean().populate('brandId modelId');
    if (!collection) {
      res.status(404).json({
        success: false,
        message: 'Collection not found',
      });
      return;
    }
    req.userBagCollection = collection;
    next();
  }
}
