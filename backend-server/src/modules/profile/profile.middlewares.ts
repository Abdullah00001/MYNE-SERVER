import { Request, Response, NextFunction, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseMiddleware } from '@/core/base_classes/base.middleware';
import { IUser } from '@/modules/auth/auth.types';
import { PasswordUtils } from '@/utils/password.utils';

@injectable()
export class ProfileMiddleware extends BaseMiddleware {
  public checkCurrentPassword: RequestHandler;

  constructor(private readonly passwordUtils: PasswordUtils) {
    super();
    this.checkCurrentPassword = this.wrap(this._checkCurrentPassword);
  }

  private async _checkCurrentPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { currentPassword } = req.body;
    const { password } = req.user as IUser;
    const isMatched = await this.passwordUtils.comparePassword(
      currentPassword,
      password
    );
    if (!isMatched) {
      res
        .status(403)
        .json({ success: false, message: 'Current password not matched' });
      return;
    }
    next();
  }
}
