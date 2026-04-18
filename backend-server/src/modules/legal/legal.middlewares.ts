import { Request, Response, NextFunction, RequestHandler } from 'express'
import { injectable } from 'tsyringe'

import { BaseMiddleware } from '@/core/base_classes/base.middleware'

@injectable()
export class LegalMiddleware extends BaseMiddleware {
  public handle: RequestHandler

  constructor() {
    super()
    this.handle = this.wrap(this._handle)
  }

  private async _handle(
    _req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    next()
  }
}