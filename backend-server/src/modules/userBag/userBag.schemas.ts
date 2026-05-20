import { isValidObjectId } from 'mongoose';
import { string, z } from 'zod';

import { PublishStatus } from './userBag.types';

export const CreateCollectionSchema = z.object({
  // MongoDB ObjectId references - using string validation
  brandId: z
    .string({
      error: 'Brand ID is required',
    })
    .refine((val) => isValidObjectId(val), {
      message: 'Invalid Brand ID format',
    }),
  yearsOfBag: z.string().nullable(),
  modelId: z
    .string({
      error: 'Model ID is required',
    })
    .refine((val) => isValidObjectId(val), {
      message: 'Invalid Model ID format',
    }),

  // Bag properties
  bagColor: z
    .string({
      error: 'Bag color is required',
    })
    .min(1, {
      error: 'Bag color cannot be empty',
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

  // Condition of the bag
  condition: z
    .string({
      error: 'Condition is required',
    })
    .min(1, {
      error: 'Condition cannot be empty',
    }),

  // Purchase price - COERCED from string to number for form-data
  purchasePrice: z.coerce
    .number({
      error: 'Purchase price must be a number',
    })
    .min(0, {
      error: 'Purchase price cannot be negative',
    })
    .optional(),

  currency: z
    .string({
      error: 'Currency is required',
    })
    .min(1, {
      error: 'Currency cannot be empty',
    })
    .max(3, {
      error: 'Currency code should be 3 characters or less (e.g., USD, EUR)',
    })
    .optional(),

  purchaseLocation: z
    .string({
      error: 'Purchase location is required',
    })
    .min(1, {
      error: 'Purchase location cannot be empty',
    })
    .optional(),

  sellerName: z
    .string({
      error: 'Seller name is required',
    })
    .optional(),

  // Purchase date - accepts dd/mm/yy format and converts to Date
  purchaseDate: z
    .string()
    .regex(
      /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{2}$/,
      'Purchase date must be in dd/mm/yy format (e.g., 28/02/26)'
    )
    .transform((val) => {
      const [day, month, year] = val.split('/');
      const fullYear = `20${year}`;
      return new Date(`${fullYear}-${month}-${day}T00:00:00.000Z`);
    })
    .nullable()
    .optional(),
  variant: z
    .string({
      error: 'Variant is required',
    })
    .min(1, {
      error: 'Variant cannot be empty',
    }),
  purchaseType: z
    .string({
      error: 'Purchase type is required',
    })
    .min(1, {
      error: 'Purchase type cannot be empty',
    })
    .optional(),

  // Optional fields - also coerced if provided
  waitingTime: z.string().optional(),

  notes: z.string().optional(),
  publishStatus: z.enum(PublishStatus),
});

export type TCreateUserCollection = z.infer<typeof CreateCollectionSchema>;

export const baseUpdateSchema = z.object({
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
  yearsOfBag: z.string().nullable(),
  // Bag properties
  bagColor: z
    .string({
      error: 'Bag color is required',
    })
    .min(1, {
      error: 'Bag color cannot be empty',
    }),
  hardwareColor: z
    .string({
      error: 'Bag hardware color is required',
    })
    .min(1, {
      error: 'Bag hardware color cannot be empty',
    }),
  size: z
    .string({
      error: 'Size is required',
    })
    .min(1, {
      error: 'Size cannot be empty',
    }),

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
  // Archived status - with coercion for form-data
  isArchived: z.coerce.boolean({
    error: 'isArchived must be a boolean',
  }),

  purchasePrice: z.coerce.number().nullish(), // nullish() = optional + nullable

  currency: z.string().nullable().optional(),

  purchaseLocation: z.string().nullable().optional(),
  wearChecklist: z
    .array(
      z.string({
        error: 'Each wear checklist item must be a string',
      })
    )
    .nullable()
    .optional(),
  sellerName: z
    .string({
      error: 'Seller name is required',
    })
    .nullable()
    .optional(),

  purchaseDate: z
    .string()
    .regex(
      /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{2}$/,
      'Purchase date must be in dd/mm/yy format (e.g., 12/11/25)'
    )
    .transform((val) => {
      const [day, month, year] = val.split('/');
      const fullYear = `20${year}`;
      return new Date(`${fullYear}-${month}-${day}`);
    })
    .nullable()
    .optional(),

  purchaseType: z.string().nullable().optional(),
  waitingTime: z.string().optional(),

  notes: z.union([z.string(), z.null()]).optional(),
  primaryImage: z.url('Primary image must be a valid URL').optional(),
  images: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z
      .array(z.url('Each image must be a valid URL'))
      .max(9, 'You can upload a maximum of 9 images')
      .optional()
  ),
  publishStatus: z.enum(PublishStatus),
});

export const DeletedImageFieldSchema = z.object({
  deletedImagesUrls: z
    .array(
      z.string().refine(
        (val) => {
          try {
            new URL(val);
            return true;
          } catch {
            return false;
          }
        },
        {
          message: 'Each deleted image URL must be a valid URL',
        }
      )
    )
    .optional()
    .default([]),
});

export const PutCollectionSchema = z.object({
  updatedData: z
    .string({
      error: 'updatedData must be a JSON string',
    })
    .transform((val, ctx) => {
      try {
        const parsed = JSON.parse(val);
        return PatchCollectionSchema.parse(parsed);
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid updatedData JSON format',
        });
        return z.NEVER;
      }
    }),

  deletedImages: z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (!val) return { deletedImagesUrls: [] };

      try {
        const parsed = JSON.parse(val);
        return DeletedImageFieldSchema.parse(parsed);
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid deletedImages JSON format',
        });
        return z.NEVER;
      }
    }),
});

export type TDeletedImageField = z.infer<typeof DeletedImageFieldSchema>;

export const PatchCollectionSchema = baseUpdateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const PatchUserCollectionSchema = z.object({
  updatedData: PatchCollectionSchema,
  isEdit: z.coerce
    .boolean({
      error: 'isEdit must be a boolean',
    })
    .optional(),
  deletedImages: DeletedImageFieldSchema,
});

export type TPatchUserCollection = z.infer<typeof PatchUserCollectionSchema>;

export type TPutUserCollection = z.infer<typeof PutCollectionSchema>;

export const CollectionQuerySchema = z.object({
  // Brand filter - MongoDB ObjectId
  brand: z
    .string()
    .refine((val) => isValidObjectId(val), {
      message: 'Invalid Brand ID format',
    })
    .optional(),

  // Production year filter
  // productionYear: z.coerce.number().int().min(1900).optional(),

  // Purchase year filter
  purchaseYear: z.coerce.number().int().min(1900).optional(),

  // Value range filters
  valueRangeMin: z.coerce.number().min(0).optional(),
  valueRangeMax: z.coerce.number().min(0).optional(),

  // Leather type filter
  material: z.string().optional(),

  // Sort by created date (1 for ascending, -1 for descending)
  sortByCreatedAt: z
    .union([z.literal('1'), z.literal('-1'), z.coerce.number()])
    .transform((val) => {
      if (typeof val === 'string') {
        return parseInt(val);
      }
      return val;
    })
    .optional(),
  sortByValue: z
    .union([z.literal('1'), z.literal('-1'), z.coerce.number()])
    .transform((val) => {
      if (typeof val === 'string') {
        return parseInt(val);
      }
      return val;
    })
    .optional(),

  // Sort by trending (up/down)
  sortByTrending: z.enum(['up', 'down']).optional(),

  // Pagination
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  isArchived: z
    .union([
      z.boolean(),
      z.literal('true'),
      z.literal('false'),
      z.literal('1'),
      z.literal('0'),
    ])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (val === 'true' || val === '1') return true;
      if (val === 'false' || val === '0') return false;
      return false; // default fallback
    })
    .optional(),
});

export type TCollectionQuery = z.infer<typeof CollectionQuerySchema>;

export const createBagStepOneSchema = z.object({
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
  imageSearchQuery: string().nullable(),
});

export type TCreateBagStepOne = z.infer<typeof createBagStepOneSchema>;

export const createBagStepTwoSchema = z.object({
  purchasePrice: z.coerce.number().nullish(), // nullish() = optional + nullable

  currency: z.string().nullable().optional(),

  purchaseLocation: z.string().nullable().optional(),
  wearChecklist: z
    .array(
      z.string({
        error: 'Each wear checklist item must be a string',
      })
    )
    .nullable()
    .optional(),
  sellerName: z
    .string({
      error: 'Seller name is required',
    })
    .nullable()
    .optional(),

  purchaseDate: z
    .string()
    .regex(
      /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{2}$/,
      'Purchase date must be in dd/mm/yy format (e.g., 12/11/25)'
    )
    .transform((val) => {
      const [day, month, year] = val.split('/');
      const fullYear = `20${year}`;
      return new Date(`${fullYear}-${month}-${day}`);
    })
    .nullable()
    .optional(),

  purchaseType: z.string().nullable().optional(),
});

export type TCreateBagStepTwo = z.infer<typeof createBagStepTwoSchema>;

export const createBagStepThreeSchema = z.object({
  primaryImage: z.url('Primary image must be a valid URL'),
  images: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z
      .array(z.url('Each image must be a valid URL'))
      .max(9, 'You can upload a maximum of 9 images')
      .optional()
  ),
});

export type TCreateBagStepThree = z.infer<typeof createBagStepThreeSchema>;

export const createBagStepFourSchema = z.object({
  waitingTime: z.string().optional(),

  notes: z.union([z.string(), z.null()]).optional(),
});

export type TCreateBagStepFour = z.infer<typeof createBagStepFourSchema>;
