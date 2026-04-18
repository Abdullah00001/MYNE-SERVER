import type { RequestHandler } from 'express';

import asyncHandler from '@/utils/asyncHandler';

/**
 * Base class for all middlewares.
 *
 * Same behavior as BaseController but semantically separate
 * for clarity and future extensions.
 */
export abstract class BaseMiddleware {
  protected wrap(handler: RequestHandler): RequestHandler {
    return asyncHandler(handler.bind(this));
  }
}
