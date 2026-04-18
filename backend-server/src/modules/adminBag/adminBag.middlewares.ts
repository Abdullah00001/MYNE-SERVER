import { Request, Response, NextFunction, RequestHandler } from 'express'
import { injectable } from 'tsyringe'

import { BaseMiddleware } from '@/core/base_classes/base.middleware'
import AdminBag from '@/modules/adminBag/adminBag.model'

@injectable()
export class AdminBagMiddleware extends BaseMiddleware {
  public findAdminBagById: RequestHandler

  constructor() {
    super()
    this.findAdminBagById = this.wrap(this._findAdminBagById)
  }

  private async _findAdminBagById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    const bag=await AdminBag.findById(id);
    if(!bag){
      res.status(404).json({
        success: false,
        status: 404,
        message: 'Admin Bag Not Found',
      });
      return;
    }
    req.adminBag=bag;
    next()
  }
}