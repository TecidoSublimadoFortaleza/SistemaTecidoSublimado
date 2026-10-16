import { Request, Response, NextFunction } from 'express';
import { Database } from '../db/database';
import { AuditRepository } from '../repositories/AuditRepository';
import { initializeDatabaseSeed } from '../db/seed';

const auditRepo = new AuditRepository();

export class DeveloperController {
  /**
   * System Backup Trigger (Developer Only)
   */
  public static async triggerBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = Database.getInstance();
      const backupData = {
        timestamp: new Date().toISOString(),
        branches: Array.from(db.branches.values()),
        sectors: Array.from(db.sectors.values()),
        roles: Array.from(db.roles.values()),
        usersCount: db.users.size,
        auditLogsCount: db.auditTrails.length,
        version: '1.0.0-ENTERPRISE',
      };

      await auditRepo.logAuthEvent({
        userId: req.user?.sub,
        username: req.user?.username || '@Marcelo-dev',
        event: 'BACKUP_CREATED',
        ip: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Developer Console',
        details: 'Backup completo do sistema executado com sucesso.',
      });

      res.status(200).json({
        success: true,
        message: 'Backup corporativo do sistema ERP gerado com sucesso.',
        data: backupData,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * System Reset / New Start (Developer Only)
   */
  public static async resetSystem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = Database.getInstance();

      // Clear non-system collections
      db.users.clear();
      db.refreshTokens.clear();
      db.authLogs.length = 0;
      db.auditTrails.length = 0;

      // Re-seed system defaults (@Marcelo-dev, sectors, roles, branch)
      initializeDatabaseSeed();

      await auditRepo.logAuthEvent({
        userId: req.user?.sub,
        username: req.user?.username || '@Marcelo-dev',
        event: 'SYSTEM_RESET',
        ip: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Developer Console',
        details: 'Sistema reinicializado para estado original de fábrica.',
      });

      res.status(200).json({
        success: true,
        message: 'ERP reinicializado com sucesso. Todos os dados foram redefinidos para o padrão de fábrica.',
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Developer Diagnostics & Tech Dashboard Metrics (Developer Only)
   */
  public static async getSystemDiagnostics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = Database.getInstance();
      const { getDatabaseDiagnostics, checkDatabaseConnection } = await import('../db/postgres');
      await checkDatabaseConnection().catch(() => {});
      const dbDiagnostics = getDatabaseDiagnostics();

      const stats = {
        serverUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        databaseMetrics: {
          branchesCount: db.branches.size,
          sectorsCount: db.sectors.size,
          rolesCount: db.roles.size,
          usersCount: db.users.size,
          authLogsCount: db.authLogs.length,
          auditTrailsCount: db.auditTrails.length,
        },
        databaseStatus: dbDiagnostics,
        securityMetrics: {
          activeSessionsCount: db.refreshTokens.size,
          recentAuthEvents: db.authLogs.slice(-10),
        },
      };

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Test Supabase / PostgreSQL Connection (Developer Only)
   */
  public static async testDatabaseConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { forceTestConnection } = await import('../db/postgres');
      const result = await forceTestConnection();
      res.status(200).json({
        success: result.connected,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Update Supabase Connection String (Developer Only)
   */
  public static async updateDatabaseUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { databaseUrl } = req.body;
      if (!databaseUrl || typeof databaseUrl !== 'string') {
        res.status(400).json({
          success: false,
          error: 'A URL do banco de dados (databaseUrl) é obrigatória.',
        });
        return;
      }

      const { updateDatabaseUrl } = await import('../db/postgres');
      const result = await updateDatabaseUrl(databaseUrl);

      res.status(200).json({
        success: result.success,
        message: result.message,
        data: result.diagnostics,
      });
    } catch (error: any) {
      next(error);
    }
  }
}
