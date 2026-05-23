import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

// Custom ObjectId validator
const objectIdSchema = z.string().refine((val) => isValidObjectId(val), {
  message: 'Invalid ObjectId format',
});

// Create schema
export const CreateAdminBagSchema = z.object({
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
  // Production year - COERCED from string to number for form-data
  // productionYear: z.coerce
  //   .number({
  //     error: 'Production year must be a number',
  //   })
  //   .int({
  //     error: 'Production year must be an integer',
  //   })
  //   .min(1900, {
  //     error: 'Production year must be 1900 or later',
  //   })
  //   .max(new Date().getFullYear() + 1, {
  //     error: `Production year cannot exceed ${new Date().getFullYear() + 1}`,
  //   }),

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
