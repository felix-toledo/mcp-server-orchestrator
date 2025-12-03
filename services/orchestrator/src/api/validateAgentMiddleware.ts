import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para validar que el agente que hace la petición está autorizado
 * Verifica que el header KAA (Key Allowed Agents) coincida con la variable de entorno KEY_ALLOWED_AGENTS
 */
export const validateAgentMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const kaaHeader = req.headers['kaa'] as string | undefined;
  const keyAllowedAgents = process.env.KEY_ALLOWED_AGENTS;

  // Verificar que existe la variable de entorno
  if (!keyAllowedAgents) {
    res.status(500).json({
      error: 'Server configuration error',
      message: 'KEY_ALLOWED_AGENTS not configured',
    });
    return;
  }

  // Verificar que el header existe
  if (!kaaHeader) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing KAA header',
    });
    return;
  }

  // Verificar que el header coincide con la clave configurada
  if (kaaHeader !== keyAllowedAgents) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid KAA header',
    });
    return;
  }

  // Si todo está correcto, continuar con la siguiente función
  next();
};
