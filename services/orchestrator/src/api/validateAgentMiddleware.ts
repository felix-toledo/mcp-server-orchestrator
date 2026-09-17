import { Request, Response, NextFunction } from 'express';

/**
 * Authenticates the calling agent/channel (not the end user — see
 * docs/context.md for the target per-user identity design). Checks the
 * `KAA` header against the KEY_ALLOWED_AGENTS env var.
 */
export const validateAgentMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const kaaHeader = req.headers['kaa'] as string | undefined;
  const keyAllowedAgents = process.env.KEY_ALLOWED_AGENTS;

  if (!keyAllowedAgents) {
    res.status(500).json({
      error: 'Server configuration error',
      message: 'KEY_ALLOWED_AGENTS not configured',
    });
    return;
  }

  if (!kaaHeader) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing KAA header',
    });
    return;
  }

  if (kaaHeader !== keyAllowedAgents) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid KAA header',
    });
    return;
  }

  next();
};
