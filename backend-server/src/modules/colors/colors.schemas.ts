import { z } from 'zod';

const mongoObjectIdRegex = /^[a-fA-F0-9]{24}$/;

export const colorNameSchema = z
  .string({
    message: 'Color name is required and must be a string',
  })
  .trim()
  .min(2, {
    message: 'Color name must be at least 2 characters long',
  })
  .max(50, {
    message: 'Color name must not exceed 50 characters',
  })
  .refine((value) => value.length > 0, {
    message: 'Color name cannot be empty or just whitespace',
  })
  .refine((value) => !mongoObjectIdRegex.test(value), {
    message: 'Color name cannot be a MongoDB ObjectId',
  });

export const CreateColorsSchema = z.object({
  colorName: colorNameSchema,
});
