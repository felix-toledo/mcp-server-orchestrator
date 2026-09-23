import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Same fix knowledge-store's `core/asyncHandler.ts` applied after a real
 * crash there (Express 4 doesn't catch a rejected async handler on its
 * own) — carried over here proactively, before it has its own incident.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
