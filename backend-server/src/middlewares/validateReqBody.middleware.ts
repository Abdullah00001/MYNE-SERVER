import { join } from 'path';

import type { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { type ZodType } from 'zod';

import { SystemUtils } from '@/utils/system.utils';

const ALLOWED_METHODS = ['POST', 'PUT', 'PATCH'] as const;

export const validateReqBody =
  <T>(schema: ZodType<T>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (!ALLOWED_METHODS.includes(req.method as any)) {
      return next();
    }
    const files = req.files as Express.Multer.File[];

    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));
      if (files && files.length > 0) {
        const systemUtils = container.resolve(SystemUtils);
        const fileNames = files.map((file) => file.filename);
        const fileCleanupPromises = fileNames.map(async (file) => {
          const filePath = join(__dirname, '../../public/temp', file);
          return systemUtils.unlinkFile({ filePath }).catch((error) => {
            console.error(`Failed to delete file ${filePath}:`, error);
            // Continue even if file deletion fails
          });
        });

        await Promise.all(fileCleanupPromises);
      }
      res.status(422).json({
        success: false,
        message: 'Request body validation failed',
        errors,
      });
      return;
    }

    /**
     * Replace body with parsed data
     * (coercions, trims, defaults applied)
     */
    req.body = result.data;

    next();
  };

export const createCollectionRequestBodyValidationMiddleware = <T>(
  schema: ZodType<T>
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!ALLOWED_METHODS.includes(req.method as any)) {
      return next();
    }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const primaryImage = files?.primaryImage?.[0];
    const receiptImage = files?.receiptImage?.[0];
    const additionalImages = files?.images || [];
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));
      if (files && Object.keys(files).length > 0) {
        const systemUtils = container.resolve(SystemUtils);
        const fileNames = [
          ...(primaryImage ? [primaryImage.filename] : []),
          ...(receiptImage ? [receiptImage.filename] : []),
          ...additionalImages.map((image) => image.filename),
        ];
        const fileCleanupPromises = fileNames.map(async (file) => {
          const filePath = join(__dirname, '../../public/temp', file);
          return systemUtils.unlinkFile({ filePath }).catch((error) => {
            console.error(`Failed to delete file ${filePath}:`, error);
            // Continue even if file deletion fails
          });
        });

        await Promise.all(fileCleanupPromises);
      }
      res.status(422).json({
        success: false,
        message: 'Request body validation failed',
        errors,
      });
      return;
    }

    /**
     * Replace body with parsed data
     * (coercions, trims, defaults applied)
     */
    req.body = result.data;

    next();
  };
};
