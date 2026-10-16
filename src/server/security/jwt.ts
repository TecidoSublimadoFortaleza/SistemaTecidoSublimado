import jwt from 'jsonwebtoken';
import { UserJWTPayload, RoleTitle, SectorType } from '../types';

/**
 * Enterprise JWT Token Management
 */
const JWT_SECRET = process.env.JWT_SECRET || 'subligestao-enterprise-jwt-super-secret-key-2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'subligestao-refresh-secret-key-2026';

export class JWTManager {
  public static ACCESS_TOKEN_EXPIRATION = '1h';
  public static REFRESH_TOKEN_EXPIRATION = '7d';

  public static generateAccessToken(payload: {
    userId: string;
    username: string;
    role: RoleTitle;
    sector: SectorType;
    branchId: string;
    isDeveloper: boolean;
  }): string {
    const tokenPayload: UserJWTPayload = {
      sub: payload.userId,
      username: payload.username,
      role: payload.role,
      sector: payload.sector,
      branchId: payload.branchId,
      isDeveloper: payload.isDeveloper,
      type: 'access',
    };

    return jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: 3600, // 1 hour in seconds
      issuer: 'SubliGestao-ERP',
    });
  }

  public static generateRefreshToken(userId: string): string {
    return jwt.sign({ sub: userId, type: 'refresh' }, JWT_REFRESH_SECRET, {
      expiresIn: 604800, // 7 days in seconds
      issuer: 'SubliGestao-ERP',
    });
  }

  public static verifyAccessToken(token: string): UserJWTPayload {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'SubliGestao-ERP',
    }) as UserJWTPayload;
  }

  public static verifyRefreshToken(token: string): { sub: string; type: string } {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'SubliGestao-ERP',
    }) as { sub: string; type: string };
  }
}
