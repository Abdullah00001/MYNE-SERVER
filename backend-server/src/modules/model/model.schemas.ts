import { z } from 'zod';

const mongoObjectIdRegex = /^[a-fA-F0-9]{24}$/;
const modelNameRegex = /^[a-zA-Z0-9\s\-_.]+$/;

const modelNameSchema = z
  .string({
    message: 'Model name is required and must be a string',
  })
  .trim()
  .min(3, {
    message: 'Model name must be at least 3 characters long',
  })
  .max(100, {
    message: 'Model name must not exceed 100 characters',
  })
  .refine((val) => val.length > 0, {
    message: 'Model name cannot be empty or just whitespace',
  })
  .refine((val) => !/^\s|\s$/.test(val), {
    message: 'Model name cannot start or end with whitespace',
  })
  .refine((val) => modelNameRegex.test(val), {
    message:
      'Model name contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, and dots are allowed',
  })
  .refine((val) => !mongoObjectIdRegex.test(val), {
    message: 'Model name cannot be a MongoDB ObjectId',
  });

export const CreateModelSchema = z.object({
  modelName: modelNameSchema,

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
  modelName: modelNameSchema,
});
