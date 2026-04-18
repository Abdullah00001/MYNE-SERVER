import { NextFunction, Request, Response } from 'express';

export const globalErrorMiddleware = (
  _err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    errors: [
      'The server failed to respond. Please try again later.',
      'The server may be experiencing temporary issues or may have become unresponsive.',
      'If the problem persists, it could indicate a more serious backend issue that requires attention.',
    ],
  });
  return;
};
