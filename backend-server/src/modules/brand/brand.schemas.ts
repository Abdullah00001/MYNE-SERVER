import { z } from 'zod';

const mongoObjectIdRegex = /^[a-fA-F0-9]{24}$/;
const brandNameRegex = /^[a-zA-Z0-9\s\-_.&']+$/;

const brandNameSchema = z
  .string({
    message: 'Brand name is required and must be a string',
  })
  .trim()
  .min(3, {
    message: 'Brand name must be at least 3 characters long',
  })
  .max(100, {
    message: 'Brand name must not exceed 100 characters',
  })
  .refine((val) => val.length > 0, {
    message: 'Brand name cannot be empty or just whitespace',
  })
  .refine((val) => !/^\s|\s$/.test(val), {
    message: 'Brand name cannot start or end with whitespace',
  })
  .refine((val) => brandNameRegex.test(val), {
    message:
      'Brand name contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, dots, ampersands, and apostrophes are allowed',
  })
  .refine((val) => !mongoObjectIdRegex.test(val), {
    message: 'Brand name cannot be a MongoDB ObjectId',
  });

export const CreateBrandSchema = z.object({
  brandName: brandNameSchema,
});

export const UpdateBrandSchema = z.object({
  brandName: brandNameSchema,
});

export const UpdateBrandInfoSchema = z.object({
  brandName: brandNameSchema.optional(),
});
