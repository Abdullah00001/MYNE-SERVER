import { z } from 'zod';

export const CreateDashboardSchema = z.object({});

export const DashboardStatsQueryParamsSchema = z.object({
  userActivityByYear: z
    .string()
    .transform((val) => (val ? parseInt(val, 10) : new Date().getFullYear()))
    .pipe(z.number().int().min(2000).max(new Date().getFullYear()))
    .optional(),
});

export type TDashboardStatsQueryParamsSchema = z.infer<
  typeof DashboardStatsQueryParamsSchema
>;
