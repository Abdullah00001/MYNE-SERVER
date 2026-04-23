import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

// Custom ObjectId validator
const objectIdSchema = z.string().refine((val) => isValidObjectId(val), {
  message: 'Invalid ObjectId format',
});

// Create schema
export const CreateAdminBagSchema = z.object({
  bagBrand: objectIdSchema,
  bagModel: objectIdSchema,
  bagColor: z
    .string({
      error: 'Bag color is required',
    })
    .min(1, {
      error: 'Bag color cannot be empty',
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
});

export type TCreateAdminBagPayload = z.infer<typeof CreateAdminBagSchema>;

export const UpdateAdminBagSchema = z.object({
  bagColor: z
    .string({
      error: 'Bag color is required',
    })
    .min(1, {
      error: 'Bag color cannot be empty',
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
});

export type TUpdateAdminBagPayload = z.infer<typeof UpdateAdminBagSchema>;
