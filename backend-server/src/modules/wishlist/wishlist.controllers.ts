import { Request, Response, RequestHandler } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { injectable } from 'tsyringe';

import { BaseController } from '@/core/base_classes/base.controller';
import { WishlistService } from '@/modules/wishlist/wishlist.services';
import { TUpdateWishPayload } from '@/modules/wishlist/wishlist.schemas';

@injectable()
export class WishlistController extends BaseController {
  public createWish: RequestHandler;
  public deleteWish: RequestHandler;
  public getWishes: RequestHandler;
  public changeWishStatus: RequestHandler;
  public getOneWish: RequestHandler;
  constructor(private readonly wishlistService: WishlistService) {
    super();
    this.createWish = this.wrap(this._createWish);
    this.deleteWish = this.wrap(this._deleteWish);
    this.getWishes = this.wrap(this._getWishes);
    this.changeWishStatus = this.wrap(this._changeWishStatus);
    this.getOneWish = this.wrap(this._getOneWish);
  }

  private async _createWish(req: Request, res: Response): Promise<void> {
    const user = req.user as JwtPayload;
    const payload = req.body;
    const data = await this.wishlistService.createWish({
      user,
      payload,
    });

    res.status(201).json({
      success: true,
      status: 201,
      message: 'Wish created successfully',
      data,
    });
    return;
  }

  private async _deleteWish(req: Request, res: Response): Promise<void> {
    const wish = req.wish;
    await this.wishlistService.deleteWish({ wish });
    res.status(200).json({
      success: true,
      message: 'Wish deleted successfully',
    });
  }

  private async _getWishes(req: Request, res: Response): Promise<void> {
    const user = req.user as JwtPayload;
    const { page, limit, priority } = req.query as {
      page?: string;
      limit?: string;
      priority?: string;
    };
    const data = await this.wishlistService.getWishes({
      page,
      limit,
      priority,
      user,
    });
    res.status(200).json({
      success: true,
      message: 'Wishes retrieved successfully',
      ...data,
    });
  }

  private async _changeWishStatus(req: Request, res: Response): Promise<void> {
    const wish = req.wish;
    const payload = req.body as TUpdateWishPayload;
    const data = await this.wishlistService.changeWishStatus({ wish, payload });
    res.status(200).json({
      success: true,
      message: 'Wish status updated successfully',
      data,
    });
  }

  private async _getOneWish(req: Request, res: Response): Promise<void> {
    const wish = req.wish;
    res.status(200).json({
      status: 200,
      success: true,
      message: 'Wish status updated successfully',
      data: wish,
    });
    return;
  }
}
