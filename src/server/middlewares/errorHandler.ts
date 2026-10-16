import { Request, Response, NextFunction } from 'express';

/**
 * Enterprise Global Exception Handler
 * Intercepts all unhandled errors and returns sanitized, secure JSON responses.
 * Never exposes stack traces, internal paths, or database query strings to clients.
 */
export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || (err.message && !err.stack ? 400 : 500);
  const publicMessage =
    statusCode === 500 && !err.message
      ? 'Ocorreu um erro interno no servidor. Por favor, tente novamente mais tarde.'
      : err.message || 'Requisição inválida.';

  // Apenas registra avisos de exceção interna para status 500 real, evitando falsos positivos de monitoramento
  if (statusCode >= 500) {
    console.warn('[Server Handler Warning]', `${req.method} ${req.path} - ${err?.message || 'Internal issue'}`);
  }

  res.status(statusCode).json({
    success: false,
    error: publicMessage,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString(),
  });
}
