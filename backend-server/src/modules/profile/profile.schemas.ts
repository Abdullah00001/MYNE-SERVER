import { z } from 'zod';

export const CreateProfileSchema = z.object({});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  newPassword: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

export const updateUserProfileInfoSchema = z
  .object({
    displayName: z
      .string()
      .min(3, 'Display name must be at least 3 characters long')
      .optional()
      .or(z.literal(null)),

    name: z.string().min(3, 'Name must be at least 3 characters long'),

    phone: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
      .optional()
      .or(z.literal(null)),

    location: z
      .string()
      .optional()
      .or(z.literal(null)),

    // This will catch if email is present in the request
    email: z.string().optional(),
  })
  .strict() // Reject unknown keys
  .refine((data) => !data.email, {
    message:
      'Email cannot be changed. Please contact support if you need to update your email address.',
    path: ['email'], // This will attach the error to the email field
  });

export type TUpdateUserProfileInfo = z.infer<typeof updateUserProfileInfoSchema>;