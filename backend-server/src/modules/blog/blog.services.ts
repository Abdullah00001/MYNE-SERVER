import { join, extname } from 'path';

import { JwtPayload } from 'jsonwebtoken';
import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

import { IUser } from '@/modules/auth/auth.types';
import { GetBlogDTO } from '@/modules/blog/blog.dto';
import Blog from '@/modules/blog/blog.model';
import {
  IBlog,
  TBlogActions,
  TGetBlogResponse,
} from '@/modules/blog/blog.types';
import { Role } from '@/types/jwt.types';
import { S3Utils } from '@/utils/s3.utils';
import { SystemUtils } from '@/utils/system.utils';

@injectable()
export class BlogService {
  constructor(
    private readonly s3Utils: S3Utils,
    private readonly systemUtils: SystemUtils
  ) {}

  async createBlog({
    blogDescription,
    blogTitle,
    fileName,
    user,
    mimeType,
  }: {
    blogTitle: string;
    blogDescription: string;
    fileName: string;
    user: IUser;
    mimeType: string;
  }): Promise<GetBlogDTO> {
    try {
      const filePath = join(__dirname, '../../../public/temp', fileName);
      const fileExtension = extname(filePath);
      const s3Key = `blogs/${uuidv4()}/${Date.now()}${fileExtension}`;
      const url = await this.s3Utils.singleUpload({
        filePath,
        key: s3Key,
        mimeType,
      });
      const newBlog = new Blog({
        blogDescription,
        blogImage: url,
        blogTitle,
        createdBy: user?._id,
      });
      await newBlog.save();
      return GetBlogDTO.fromEntity(newBlog);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in create blog service');
    }
  }

  async updateBlogWithImage({
    blogDescription,
    blogTitle,
    fileName,
    mimeType,
    blog,
  }: {
    blogTitle?: string;
    blogDescription?: string;
    fileName?: string;
    mimeType?: string;
    blog: IBlog;
  }): Promise<GetBlogDTO> {
    try {
      let blogImage = blog.blogImage;
      if (fileName && mimeType) {
        if (blogImage) {
          const key = this.systemUtils.extractS3KeyFromUrl(blogImage);
          if (key) await this.s3Utils.singleDelete({ key });
        }
        const filePath = join(__dirname, '../../../public/temp', fileName);
        const fileExtension = extname(filePath);
        const s3Key = `blogs/${uuidv4()}/${Date.now()}${fileExtension}`;
        blogImage = await this.s3Utils.singleUpload({
          filePath,
          key: s3Key,
          mimeType,
        });
      }
      const data = await Blog.findByIdAndUpdate(
        blog?._id,
        { blogDescription, blogImage, blogTitle },
        { new: true }
      );
      if (!data)
        throw new Error('Unknown error occurred in update blog service');
      return GetBlogDTO.fromEntity(data);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in update blog service');
    }
  }

  async updateBlogInfo({
    blog,
    blogDescription,
    blogTitle,
  }: {
    blogTitle?: string;
    blogDescription?: string;
    blog: IBlog;
  }): Promise<GetBlogDTO> {
    try {
      const data = await Blog.findByIdAndUpdate(
        blog?._id,
        { blogDescription, blogTitle },
        { new: true }
      );
      if (!data)
        throw new Error('Unknown error occurred in update blog service');
      return GetBlogDTO.fromEntity(data);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in update blog service');
    }
  }

  async deleteBlog({ blog }: { blog: IBlog }): Promise<void> {
    try {
      const existingImageUrl = blog.blogImage;
      const existingImageKey =
        this.systemUtils.extractS3KeyFromUrl(existingImageUrl);
      Promise.all([
        await this.s3Utils.singleDelete({ key: existingImageKey }),
        await Blog.deleteOne({ _id: blog._id }),
      ]);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in update blog service');
    }
  }

  async retrieveBlogs({
    params,
    user,
  }: {
    params: { page: string | null; limit: string | null };
    user: IUser | JwtPayload;
  }): Promise<TGetBlogResponse> {
    try {
      const page = parseInt(params.page || '1', 10);
      const limit = parseInt(params.limit || '10', 10);
      const skip = (page - 1) * limit;
      const isAdmin = user.role === Role.ADMIN;
      const [result] = await Blog.aggregate([
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            total: [{ $count: 'count' }],
          },
        },
      ]);
      const data: GetBlogDTO[] =
        result.data.map((item: IBlog) => GetBlogDTO.fromEntity(item)) || [];
      const total = result.total[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);
      // Calculate showing range
      const from = total === 0 ? 0 : skip + 1;
      const to = Math.min(skip + limit, total);
      const showing = `Showing ${from} to ${to} of ${total} results`;

      // Determine base path based on user role
      const basePath = user.role === 'admin' ? '/admin/blogs' : '/blogs';

      const actions: TBlogActions = {
        create: isAdmin
          ? {
              href: `${basePath}`,
              method: 'POST',
            }
          : undefined,
        update_with_image:
          isAdmin && data.length > 0
            ? {
                href: `${basePath}/:id`,
                method: 'PUT',
              }
            : undefined,
        update_without_image:
          isAdmin && data.length > 0
            ? {
                href: `${basePath}/:id`,
                method: 'PATCH',
              }
            : undefined,
        delete:
          isAdmin && data.length > 0
            ? {
                href: `${basePath}/:id`,
                method: 'DELETE',
              }
            : undefined,
      };

      // If no data, return null for links
      if (data.length === 0) {
        return {
          data,
          meta: {
            total,
            page,
            limit,
            totalPages,
            links: null,
            actions,
            showing,
          },
        };
      }

      // Helper function to build links
      const buildLink = (pageNum: number): string => {
        const query = new URLSearchParams();
        query.set('page', pageNum.toString());
        query.set('limit', limit.toString());
        return `${basePath}?${query.toString()}`;
      };

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages,
          links: {
            first: buildLink(1),
            last: buildLink(totalPages),
            previous: page > 1 ? buildLink(page - 1) : null,
            next: page < totalPages ? buildLink(page + 1) : null,
            current: buildLink(page),
          },
          actions,
          showing,
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in update blog service');
    }
  }
}
