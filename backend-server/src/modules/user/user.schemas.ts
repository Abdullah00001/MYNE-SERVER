import { z } from 'zod';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_REGEX = /^[\p{L}\p{M}'\- ]{2,50}$/u;

export const CreateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .min(4, 'Name must be at least 4 characters long'),

  email: z
    .string()
    .min(1, 'Email is required')
    .pipe(z.email('Please provide a valid email address')),
});


export const getUsersRequestQueryParamsSchema = z.object({
  page: z
    .string()
    .nullable()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(
      z
        .number()
        .int('Page must be an integer')
        .min(1, 'Page must be at least 1')
    )
    .optional(),

  limit: z
    .string()
    .nullable()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(
      z
        .number()
        .int('Limit must be an integer')
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit cannot exceed 100')
    )
    .optional(),

  sortBy: z.enum(['1', '-1']).default('1').optional(),

  search: z
    .string()
    .min(2, 'Search must be at least 2 characters')
    .max(100, 'Search is too long')
    .transform((val) => val.trim())
    .refine((val) => NAME_REGEX.test(val) || EMAIL_REGEX.test(val), {
      message: 'Must be a valid name or email address',
    })
    .optional(),
});

export type GetUsersQueryParams = z.infer<typeof getUsersRequestQueryParamsSchema>;

export type TCreateUser = z.infer<typeof CreateUserSchema>;
