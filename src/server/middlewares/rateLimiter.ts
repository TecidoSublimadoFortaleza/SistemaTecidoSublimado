import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const ipLimits = new Map<string, RateLimitStore>();
const WINDOW_MS = 1 * 60 * 1000; // 1 minute
const MAX_REQUESTS = 100000; // Generous ceiling so legitimate operations are never blocked

/**
 * Enterprise Rate Limiting Middleware
 * Protects auth login routes from brute force while ensuring operational ERP endpoints are never blocked.
 */
export function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Never rate limit internal operational endpoints (OS updates, delivery confirmations, queries)
  const isAuthLogin = req.path.includes('/auth/login');
  
  // If request is authenticated with Bearer token, bypass rate limiting
  if (req.headers.authorization) {
    return next();
  }

  // If request is not a login attempt, bypass rate limiting
  if (!isAuthLogin) {
    return next();
  }

  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip;
  const ip = rawIp || req.socket.remoteAddress || 'unknown-ip';
  const now = Date.now();

  const record = ipLimits.get(ip);

  if (!record || now > record.resetTime) {
    ipLimits.set(ip, {
      count: 1,
      resetTime: now + WINDOW_MS,
    });
    return next();
  }

  if (record.count >= 60) { // Up to 60 login attempts per minute
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de login originadas deste IP. Por favor, aguarde um momento.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
    return;
  }

  record.count += 1;
  next();
}

