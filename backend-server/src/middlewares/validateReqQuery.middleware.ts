import type { Request, Response, NextFunction } from 'express';
import { type ZodType } from 'zod';

import { logger } from '@/configs';

const ALLOWED_METHODS = ['GET'] as const;

export const validateReqQuery =
  <T>(schema: ZodType<T>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (
        !ALLOWED_METHODS.includes(
          req.method as (typeof ALLOWED_METHODS)[number]
        )
      ) {
        return next();
      }

      // Convert null prototype object to regular object
      const queryObj = { ...req.query };
      const result = schema.safeParse(queryObj);

      if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'query',
          message: issue.message,
        }));
        res.status(422).json({
          success: false,
          message: 'Request query validation failed',
          errors,
        });
        return;
      }
      // Assign validated data to req.query
      req.validatedQuery = result.data 
      next();
    } catch (error) {
      logger.error('CAUGHT ERROR in validateReqQuery middleware:', error);
      logger.error(
        'Error stack:',
        error instanceof Error ? error.stack : 'No stack'
      );
      next(error);
    }
  };
