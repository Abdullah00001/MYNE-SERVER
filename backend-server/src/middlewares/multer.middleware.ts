import path from 'path';

import { NextFunction, Request, Response } from 'express';
import multer, { diskStorage, FileFilterCallback, MulterError } from 'multer';

const storage = diskStorage({
  destination: (_req: Request, _file, cb) => {
    cb(null, './public/temp');
  },
  filename: (_req: Request, file, cb) => {
    const name = path.parse(file.originalname).name;
    const ext = path.extname(file.originalname);
    cb(null, name + '-' + Date.now() + '-' + ext);
  },
});

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/webp' ||
    file.mimetype === 'image/svg+xml'
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Only .jpeg and .png and .webp and .svg files are allowed!'
      ) as any,
      false
    );
  }
};

export const docsUpload = multer({
  storage: storage,
});

// Base upload configuration
const baseUpload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // Global max limit
  fileFilter: imageFileFilter,
});

// ============================================================================
// UPLOAD FIELDS MIDDLEWARE
// ============================================================================
export interface MulterFiles {
  [fieldname: string]: Express.Multer.File[];
}

export interface FieldConfig {
  name: string;
  maxCount: number;
  optional?: boolean;
}
/**
 * Reusable middleware for multiple file fields in ONE request
 * @param fieldsConfig - Array of {name, maxCount, optional} configurations
 * @param allOptional - If true, all fields are optional and at least one file is required
 *                      If false (default), all fields are required unless marked optional: true
 * @example
 * // POST: All fields REQUIRED (default behavior)
 * const productFields = [
 *   { name: 'thumbnail', maxCount: 1 },
 *   { name: 'coverImages', maxCount: 5 },
 *   { name: 'receiptImage', maxCount: 1, optional: true } // Only this is optional
 * ];
 * router.post('/products', uploadFields(productFields), handleMulterError, controller);
 *
 * @example
 * // PUT: All fields OPTIONAL but at least one required
 * const productUpdateFields = [
 *   { name: 'thumbnail', maxCount: 1, optional: true },
 *   { name: 'coverImages', maxCount: 5, optional: true },
 *   { name: 'galleryImages', maxCount: 10, optional: true }
 * ];
 * router.put('/products/:id', uploadFields(productUpdateFields, true), handleMulterError, controller);
 */
export const uploadFields = (
  fieldsConfig: FieldConfig[],
  allOptional: boolean = false // If true, validates "at least one file"
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store config for error handler
    req.fieldConfig = fieldsConfig;
    req.allOptional = allOptional;

    const multerFields = fieldsConfig.map((field) => ({
      name: field.name,
      maxCount: field.maxCount,
    }));

    baseUpload.fields(multerFields)(req, res, (err: any) => {
      if (err) {
        return next(err);
      }

      const files = req.files as MulterFiles;

      // MODE 1: All optional (PUT request) - require at least one file
      if (allOptional) {
        const hasAnyFile = files && Object.keys(files).length > 0;

        if (!hasAnyFile) {
          return res.status(400).json({
            success: false,
            status: 400,
            message: 'At least one file must be uploaded.',
          });
        }
      }
      // MODE 2: Default (POST request) - check required fields
      else {
        const requiredFields = fieldsConfig.filter((field) => !field.optional);

        for (const field of requiredFields) {
          if (!files?.[field.name] || files[field.name].length === 0) {
            return res.status(400).json({
              success: false,
              status: 400,
              message: `Field '${field.name}' is required.`,
            });
          }
        }
      }

      next();
    });
  };
};

// Wrapper to set the limit in the request
export const uploadArray = (fieldName: string, maxCount: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.fileLimit = maxCount; // Store the route-specific limit
    req.fieldName = fieldName; // Store the field name
    baseUpload.array(fieldName, maxCount)(req, res, next);
  };
};

// Wrapper for single file
export const uploadSingle = (fieldName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.fileLimit = 1;
    req.fieldName = fieldName;
    baseUpload.single(fieldName)(req, res, next);
  };
};

// Multer error handler middleware - reads from req.fileLimit
export const handleMulterError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof MulterError) {
    const fileLimit = req.fileLimit || 10; // Use route limit or default to 10
    const fieldName = req.fieldName || 'file';

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'File size too large. Maximum allowed size is 5MB per file.',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        status: 400,
        message: `Too many files. Maximum allowed is ${fileLimit} files.`,
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const allowedFields =
        req.fieldConfig?.map((f) => f.name).join(', ') || fieldName;
      return res.status(400).json({
        success: false,
        status: 400,
        message: `Unexpected field '${err.field}'. Expected fields: ${allowedFields}.`,
      });
    }
    return res.status(400).json({
      success: false,
      status: 400,
      message: err.message || 'File upload error.',
    });
  }

  if (err && err.message && err.message.includes('Only .jpeg')) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: err.message,
    });
  }

  next(err);
};
