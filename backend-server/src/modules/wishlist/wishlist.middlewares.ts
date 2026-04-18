import { Request, Response, NextFunction, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseMiddleware } from '@/core/base_classes/base.middleware';
import Wishlist from '@/modules/wishlist/wishlist.model';

@injectable()
export class WishlistMiddleware extends BaseMiddleware {
  public findWishById: RequestHandler;

  constructor() {
    super();
    this.findWishById = this.wrap(this._findWishById);
  }

  private async _findWishById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    const wish = await Wishlist.findById(id);
    if (!wish) {
      res.status(404).json({
        success: false,
        message: 'Wish not found',
      });
      return;
    }
    req.wish = wish;
    next();
  }
}
