import { Request, Response, NextFunction, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import User from '../auth/auth.model';

import { BaseMiddleware } from '@/core/base_classes/base.middleware';

@injectable()
export class UserMiddleware extends BaseMiddleware {
  public findUserById: RequestHandler;

  constructor() {
    super();
    this.findUserById = this.wrap(this._findUserById);
  }

  private async _findUserById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({
        success: false,
        status: 404,
        message: `User with this id ${id} not found`,
      });
      return;
    }
    req.getUser = user;
    next();
  }
}
