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
  color: z.array(z.string().min(1, 'Color is required')),
  material: z.string().min(1, 'Leather type is required'),
  hardwareColor: z
    .string({
      error: 'Hardware color is required',
    })
    .min(1, {
      error: 'Hardware color cannot be empty',
    }),

  size: z
    .string({
      error: 'Size is required',
    })
    .min(1, {
      error: 'Size cannot be empty',
    }),
  condition: z
    .string({
      error: 'Condition is required',
    })
    .min(1, {
      error: 'Condition cannot be empty',
    }),
  variant: z
    .string({
      error: 'Variant is required',
    })
    .min(1, {
      error: 'Variant cannot be empty',
    }),
  specialVariant: z
    .string({
      error: 'Special Variant is required',
    })
    .min(1, {
      error: 'Special Variant cannot be empty',
    }),
  priority: z.enum(['low', 'medium', 'high']),
  note: z.string().optional(),
  currency: z.string().min(1, 'Currency is required'),
  targetPrice: z.number(),
  image: z
    .string({
      error: 'Variant is required',
    })
    .min(1, {
      error: 'Variant cannot be empty',
    }),
});

export const UpdateWishSchema = z.object({
  priority: z.string().optional(),
  note: z.string().optional(),
  currency: z.string().optional(),
  targetPrice: z.string().optional(),
  image: z.string().optional(),
  status: z.string().optional(),
});

export type TCreateWishPayload = z.infer<typeof CreateWishSchema>;

export type TUpdateWishPayload = z.infer<typeof UpdateWishSchema>;
