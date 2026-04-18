import { z } from 'zod';

export const CreateModelSchema = z.object({
  modelName: z
    .string({
      message: 'Model name is required and must be a string',
    })
    .min(3, {
      message: 'Model name must be at least 3 characters long',
    })
    .max(100, {
      message: 'Model name must not exceed 100 characters',
    })
    .trim()
    .refine((val) => val.length > 0, {
      message: 'Model name cannot be empty or just whitespace',
    })
    .refine((val) => !/^\s|\s$/.test(val), {
      message: 'Model name cannot start or end with whitespace',
    })
    .refine((val) => /^[a-zA-Z0-9\s\-_.]+$/.test(val), {
      message:
        'Model name contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, and dots are allowed',
    }),

  brandId: z
    .string({
      message: 'Brand ID is required and must be a string',
    })
    .trim()
    .refine((val) => val.length > 0, {
      message: 'Brand ID cannot be empty',
    })
    .refine((val) => /^[a-fA-F0-9]{24}$/.test(val), {
      message: 'Brand ID must be a valid MongoDB ObjectId',
    }),
});

export const UpdateModelSchema = z.object({
  modelName: z
    .string({
      message: 'Model name is required and must be a string',
    })
    .min(3, {
      message: 'Model name must be at least 3 characters long',
    })
    .max(100, {
      message: 'Model name must not exceed 100 characters',
    })
    .trim()
    .refine((val) => val.length > 0, {
      message: 'Model name cannot be empty or just whitespace',
    })
    .refine((val) => !/^\s|\s$/.test(val), {
      message: 'Model name cannot start or end with whitespace',
    })
    .refine((val) => /^[a-zA-Z0-9\s\-_.]+$/.test(val), {
      message:
        'Model name contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, and dots are allowed',
    }),
});
