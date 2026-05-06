import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

// Custom ObjectId validator
const objectIdSchema = z.string().refine((val) => isValidObjectId(val), {
  message: 'Invalid ObjectId format',
});

// Create schema
export const CreateAdminBagSchema = z.object({
  brandId: objectIdSchema,
  modelId: objectIdSchema,
  bagColor: z
    .array(
      z
        .string({
          error: 'Each color must be a string',
        })
        .min(1, {
          message: 'Color name cannot be empty',
        })
    )
    .min(1, {
      message: 'Bag color is required and needs at least one selection',
    }),
  variant: z
    .string({
      error: 'Variant is required',
    })
    .min(1, {
      error: 'Variant cannot be empty',
    }),
  material: z
    .string({
      error: 'Leather type is required',
    })
    .min(1, {
      error: 'Leather type cannot be empty',
    }),

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
  specialVariant: z.string().nullable(),
});

export type TCreateAdminBagPayload = z.infer<typeof CreateAdminBagSchema>;

export const UpdateAdminBagSchema = z.object({
  bagColor: z
    .array(
      z
        .string({
          error: 'Each color must be a string',
        })
        .min(1, {
          message: 'Color name cannot be empty',
        })
    )
    .min(1, {
      message: 'Bag color is required and needs at least one selection',
    }),
  variant: z
    .string({
      error: 'Variant is required',
    })
    .min(1, {
      error: 'Variant cannot be empty',
    }),
  material: z
    .string({
      error: 'Leather type is required',
    })
    .min(1, {
      error: 'Leather type cannot be empty',
    }),

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
  specialVariant: z.string().nullable(),
});

export type TUpdateAdminBagPayload = z.infer<typeof UpdateAdminBagSchema>;
