import { Types } from 'mongoose';
import { z } from 'zod';

// Reusable ObjectId validator
export const objectIdSchema = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  })
  .transform((val) => new Types.ObjectId(val));

export const CreateWishSchema = z.object({
  brandId: objectIdSchema.refine((val) => val, {
    message: 'Invalid brand ID',
  }),
  modelId: objectIdSchema.refine((val) => val, {
    message: 'Invalid model ID',
  }),
  priority: z.enum(['low', 'medium', 'high']),
  color: z.string().min(1, 'Color is required'),
  material: z.string().min(1, 'Leather type is required'),
  note: z.string().optional(),
  currency: z.string().min(1, 'Currency is required'),
  targetPrice: z.string().min(1, 'Target price is required'),
});
