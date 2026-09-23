import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async Express handler so a rejected promise reaches Express's
 * error-handling middleware via `next(err)` instead of becoming an
 * unhandled promise rejection. Express 4 doesn't do this automatically for
 * async handlers — same fix knowledge-store's `core/asyncHandler.ts`
 * applied after a real crash there; carried over here proactively since
 * this service also crashing would take pg-boss's in-process worker down
 * with it, not just the HTTP server.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
