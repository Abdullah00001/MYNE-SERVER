import { z } from 'zod';

export const CreateBlogSchema = z.object({
  blogTitle: z
    .string({
      message: 'Blog title is required and must be a string',
    })
    .min(10, {
      message: 'Blog title must be at least 10 characters long',
    }),

  blogDescription: z
    .string({
      message: 'Blog description is required and must be a string',
    })
    .min(100, {
      message: 'Blog description must be at least 100 characters long',
    }),
});

export const UpdateBlogSchema = z.object({
  blogTitle: z
    .string({
      message: 'Blog title must be a string',
    })
    .min(10, {
      message: 'Blog title must be at least 10 characters long',
    })
    .optional(),

  blogDescription: z
    .string({
      message: 'Blog description must be a string',
    })
    .min(100, {
      message: 'Blog description must be at least 100 characters long',
    })
    .optional(),
});
