import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async Express handler so a rejected promise reaches Express's
 * error-handling middleware via `next(err)` instead of becoming an
 * unhandled promise rejection. Express 4 doesn't do this automatically for
 * async handlers — found the hard way: a single failed embeddings/summary
 * API call (a normal, expected failure mode — see
 * `knowledge-store/004-vault-folders-and-llm-summaries`'s fail-open
 * `generateSummary`, and `EmbeddingsProvider` which isn't fail-open) inside
 * a route handler crashed the *entire* Node process instead of returning a
 * 500, taking down every other in-flight request with it. Confirmed live
 * 2026-09-17.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
