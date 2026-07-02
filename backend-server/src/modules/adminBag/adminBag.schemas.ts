import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

export const createAdminBagSchema = z.object({
  brandId: z
    .string({
      error: 'Brand ID is required',
    })
    .refine((val) => isValidObjectId(val), {
      message: 'Invalid Brand ID format',
    }),

  modelId: z
    .string({
      error: 'Model ID is required',
    })
    .refine((val) => isValidObjectId(val), {
      message: 'Invalid Model ID format',
    }),

  // Bag properties
  bagColor: z.array(
    z
      .string({
        error: 'Bag color is required',
      })
      .min(1, {
        error: 'Bag color cannot be empty',
      })
  ),
  hardwareColor: z
    .string({
      error: 'Bag hardware color is required',
    })
    .min(1, {
      error: 'Bag hardware color cannot be empty',
    }),
  wearChecklist: z
    .array(
      z
        .string({
          error: 'Each wear checklist item must be a string',
        })
        .min(1, {
          error: 'Wear checklist items cannot be empty',
        })
    )
    .optional(),
  size: z
    .string({
      error: 'Size is required',
    })
    .min(1, {
      error: 'Size cannot be empty',
    }),
  yearsOfBag: z.string().nullable(),

  material: z
    .string({
      error: 'Leather type is required',
    })
    .min(1, {
      error: 'Leather type cannot be empty',
    }),
  variant: z
    .string({
      error: 'Variant is required',
    })
    .min(1, {
      error: 'Variant cannot be empty',
    }),
  // Condition of the bag
  condition: z
    .string({
      error: 'Condition is required',
    })
    .min(1, {
      error: 'Condition cannot be empty',
    }),
  specialVariant: z.string().nullable(),
});

export type TCreateAdminBag = z.infer<typeof createAdminBagSchema>;
