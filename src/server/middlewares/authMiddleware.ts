import { Request, Response, NextFunction } from 'express';
import { JWTManager } from '../security/jwt';
import { UserJWTPayload, RoleTitle } from '../types';
import { Database } from '../db/database';

declare global {
  namespace Express {
    interface Request {
      user?: UserJWTPayload;
    }
  }
}

/**
 * Universal Developer Detection Helper
 */
export function isUserDeveloper(user?: any): boolean {
  if (!user) return false;
  if (user.isDeveloper === true || user.isDeveloperInvisible === true) return true;
  
  const username = (user.username || '').toString().toLowerCase().trim();
  if (
    username === '@marcelo-dev' ||
    username === 'marcelo-dev' ||
    username === '@developer' ||
    username === 'developer' ||
    username.includes('marcelo-dev')
  ) {
    return true;
  }

  const role = (user.role || user.roleName || user.perfil || user.cargo || '').toString().toLowerCase().trim();
  if (
    role === 'developer' ||
    role.includes('developer') ||
    role.includes('desenvolvedor') ||
    role.includes('engenharia')
  ) {
    return true;
  }

  return false;
}

/**
  * Universal Master Administrator or Developer Detection Helper
  */
export function isUserMasterOrDeveloper(user?: any): boolean {
  if (!user) return false;
  if (isUserDeveloper(user)) return true;
  const username = (user.username || '').toString().toLowerCase().trim();
  if (username === 'admin' || username.includes('adminmaster')) return true;
  const role = (user.role || user.roleName || user.perfil || user.cargo || '').toString().toLowerCase().trim();
  if (
    role === 'adm' ||
    role === 'adm master' ||
    role.includes('admin master') ||
    role.includes('administrador master') ||
    role === 'master'
  ) {
    return true;
  }
  const name = (user.name || '').toString().toLowerCase().trim();
  if (name.includes('master')) return true;
  return false;
}

/**
 * Authentication & RBAC Guard Middleware
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Acesso não autorizado. Token JWT não fornecido.',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = JWTManager.verifyAccessToken(token);

    if (payload.type !== 'access') {
      res.status(401).json({
        success: false,
        error: 'Token inválido para esta operação.',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    // Ensure isDeveloper flag is correctly set on payload
    if (isUserDeveloper(payload)) {
      payload.isDeveloper = true;
    }

    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Sessão expirada ou token de acesso inválido.',
      code: 'TOKEN_EXPIRED',
    });
  }
}

/**
 * Role-Based Access Control Guard
 */
export function requireRole(allowedRoles: RoleTitle[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Acesso negado. Usuário não autenticado.',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    // Developer always has full unrestricted access
    if (isUserDeveloper(req.user)) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Acesso negado. O cargo ${req.user.role} não possui permissão para este recurso.`,
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}

/**
 * Developer Only Guard
 * Restricts access exclusively to Developer (@Marcelo-dev)
 */
export function requireDeveloper(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Acesso não autorizado. Usuário não autenticado.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  if (isUserDeveloper(req.user)) {
    return next();
  }

  // Cross-check with DB user record
  if (req.user.sub) {
    const db = Database.getInstance();
    const dbUser = db.users.get(req.user.sub);
    if (dbUser && (dbUser.isDeveloperInvisible || isUserDeveloper(dbUser))) {
      req.user.isDeveloper = true;
      return next();
    }
  }

  res.status(403).json({
    success: false,
    error: 'Acesso negado. Recurso restrito exclusivamente ao perfil Developer.',
    code: 'DEVELOPER_ONLY',
  });
}

/**
 * Optional Auth Middleware
 * Populates req.user if a valid token is present, but does not reject request if absent.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = JWTManager.verifyAccessToken(token);
      if (payload && payload.type === 'access') {
        if (isUserDeveloper(payload)) {
          payload.isDeveloper = true;
        }
        req.user = payload;
      }
    }
  } catch {
    // Ignore invalid token and continue
  }
  next();
}
