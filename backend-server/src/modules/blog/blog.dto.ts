import { BaseDTO } from '@/core/base_classes/dto.base';
import { IBlog } from '@/modules/blog/blog.types';

export class GetBlogDTO extends BaseDTO<IBlog> {
  public _id: string;
  public blogTitle: string;
  public blogImage: string;
  public blogDescription: string;
  public createdAt: Date;
  public updatedAt: Date;
  constructor(blog: IBlog) {
    super(blog);

    this._id = String(blog._id);
    this.blogDescription = blog.blogDescription;
    this.blogImage = blog.blogImage;
    this.blogTitle = blog.blogTitle;
    this.createdAt = blog.createdAt as Date;
    this.updatedAt = blog.updatedAt as Date;
  }
}
