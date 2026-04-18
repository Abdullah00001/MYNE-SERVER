import { Request, Response, NextFunction, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseMiddleware } from '@/core/base_classes/base.middleware';
import Blog from '@/modules/blog/blog.model';

@injectable()
export class BlogMiddleware extends BaseMiddleware {
  public findBlogById: RequestHandler;

  constructor() {
    super();
    this.findBlogById = this.wrap(this._findBlogById);
  }

  private async _findBlogById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    const blog = await Blog.findById(id);
    if (!blog) {
      res
        .status(404)
        .json({
          success: false,
          status: 404,
          message: `Blog with this id ${id} not found`,
        });
      return;
    }
    req.blog = blog;
    next();
  }
}
