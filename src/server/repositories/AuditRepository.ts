import { Database } from '../db/database';
import { AuthLog, AuditTrail } from '../types';

export class AuditRepository {
  private db = Database.getInstance();

  public async logAuthEvent(log: Omit<AuthLog, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'status' | 'createdBy' | 'updatedBy'>): Promise<void> {
    const now = Database.nowISO();
    const entity: AuthLog = {
      ...log,
      id: Database.generateId('AUTHLOG'),
      status: 'ACTIVE',
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: log.userId || 'SYSTEM_AUTH',
      updatedBy: log.userId || 'SYSTEM_AUTH',
    };
    this.db.authLogs.push(entity);
  }

  public async getAuthLogs(limit: number = 100): Promise<AuthLog[]> {
    return [...this.db.authLogs].reverse().slice(0, limit);
  }

  public async getAuditTrails(limit: number = 100): Promise<AuditTrail[]> {
    return [...this.db.auditTrails].reverse().slice(0, limit);
  }
}
