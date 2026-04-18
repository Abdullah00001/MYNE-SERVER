import { Request, Response, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseController } from '@/core/base_classes/base.controller';
import { IUser } from '@/modules/auth/auth.types';
import { GetBlogDTO } from '@/modules/blog/blog.dto';
import { BlogService } from '@/modules/blog/blog.services';

@injectable()
export class BlogController extends BaseController {
  public createBlog: RequestHandler;
  public updateBlogInfoWithImage: RequestHandler;
  public updateBlogInfo: RequestHandler;
  public deleteBlog: RequestHandler;
  public retrieveBlogs: RequestHandler;
  public retrieveSingleBlog: RequestHandler;

  constructor(private readonly blogService: BlogService) {
    super();
    this.createBlog = this.wrap(this._createBlog);
    this.updateBlogInfoWithImage = this.wrap(this._updateBlogInfoWithImage);
    this.updateBlogInfo = this.wrap(this._updateBlogInfo);
    this.deleteBlog = this.wrap(this._deleteBlog);
    this.retrieveBlogs = this.wrap(this._retrieveBlogs);
    this.retrieveSingleBlog = this.wrap(this._retrieveSingleBlog);
  }

  private async _createBlog(req: Request, res: Response): Promise<void> {
    const fileName = req?.file?.filename as string;
    const mimeType = req?.file?.mimetype as string;
    const user = req.user as IUser;
    const { blogDescription, blogTitle } = req.body;
    const data = await this.blogService.createBlog({
      blogDescription,
      blogTitle,
      fileName,
      user,
      mimeType,
    });
    res.status(201).json({
      success: true,
      status: 201,
      message: 'Blog create successful',
      data,
    });
    return;
  }

  private async _updateBlogInfoWithImage(
    req: Request,
    res: Response
  ): Promise<void> {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const file = files?.blogImage?.[0];
    const fileName = file?.filename;
    const mimeType = file?.mimetype;
    const blog = req.blog;
    const { blogDescription, blogTitle } = req.body;
    const data = await this.blogService.updateBlogWithImage({
      blogDescription,
      blogTitle,
      fileName,
      mimeType,
      blog,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Blog update successful',
      data,
    });
    return;
  }

  private async _updateBlogInfo(req: Request, res: Response): Promise<void> {
    const blog = req.blog;
    const { blogDescription, blogTitle } = req.body;
    const data = await this.blogService.updateBlogInfo({
      blogDescription,
      blogTitle,
      blog,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Blog update successful',
      data,
    });
    return;
  }

  private async _deleteBlog(req: Request, res: Response): Promise<void> {
    const blog = req.blog;
    await this.blogService.deleteBlog({ blog });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Blog delete successful',
    });
    return;
  }

  private async _retrieveBlogs(req: Request, res: Response): Promise<void> {
    const params = req.params as { page: string | null; limit: string | null };
    const user = req.user;
    const data = await this.blogService.retrieveBlogs({ params, user });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Blogs retrieved successful',
      ...data,
    });
    return;
  }

  private async _retrieveSingleBlog(
    req: Request,
    res: Response
  ): Promise<void> {
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Blog retrieved successful',
      data: GetBlogDTO.fromEntity(req.blog),
    });
    return;
  }
}
