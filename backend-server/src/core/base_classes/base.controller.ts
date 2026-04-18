import type { RequestHandler } from 'express';

import asyncHandler from '@/utils/asyncHandler';

/**
 * Base class for all controllers.
 *
 * - Automatically binds `this`
 * - Automatically wraps async handlers
 * - Prevents unhandled promise rejections
 */
export abstract class BaseController {
  protected wrap(handler: RequestHandler): RequestHandler {
    return asyncHandler(handler.bind(this));
  }
}
