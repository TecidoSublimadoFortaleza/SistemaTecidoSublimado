import { Database } from '../db/database';
import { User, AuditTrail } from '../types';
import { pgPool, isPostgresActive } from '../db/postgres';

/**
 * Enterprise User Repository
 * Enforces invisible developer security rules & audit record requirements.
 */
export class UserRepository {
  private db = Database.getInstance();

  /**
   * Finds user by username (case insensitive, supporting with or without @ prefix).
   * @param username e.g. @Marcelo-dev, JULIA, @JULIA, isa, etc.
   */
  /**
   * Finds user by username requiring STRICT EXACT MATCH:
   * Must be typed exactly as saved in the system, following the presence/absence of '@'
   * and exact uppercase and lowercase letters (case-sensitive).
   * @param username Exact login typed by user
   */
  public async findByUsername(username: string): Promise<User | null> {
    const raw = (username || '').trim();
    if (!raw) return null;

    // 1. Strict exact match on users collection (exact case & exact @ presence)
    for (const user of this.db.users.values()) {
      if (user.deletedAt == null && user.username === raw) {
        return user;
      }
    }

    // 2. Strict exact match on employees collection (exact loginUsuario match)
    for (const emp of this.db.employees.values()) {
      if (emp.temLogin && emp.loginUsuario && emp.status !== 'INACTIVE') {
        if (emp.loginUsuario.trim() === raw) {
          const userId = `USR-EMP-${emp.id}`;
          let existingUser = this.db.users.get(userId);
          if (!existingUser) {
            let roleId = 'ROLE-VENDEDOR_A_';
            if (emp.cargo) {
              const cargoUpper = emp.cargo.toUpperCase();
              for (const [id, r] of this.db.roles.entries()) {
                if (r.name.toUpperCase() === cargoUpper) {
                  roleId = id;
                  break;
                }
              }
            }
            let sectorId = 'SEC-COMERCIAL';
            if (emp.setor) {
              const setorUpper = emp.setor.toUpperCase();
              for (const [id, s] of this.db.sectors.entries()) {
                if (s.name.toUpperCase() === setorUpper) {
                  sectorId = id;
                  break;
                }
              }
            }

            const passwordHash = emp.loginSenha
              ? (emp.loginSenha.startsWith('$2') ? emp.loginSenha : (await import('../security/crypto')).CryptoSecurity.hashPasswordSync(emp.loginSenha.trim()))
              : (await import('../security/crypto')).CryptoSecurity.hashPasswordSync('123456');

            existingUser = {
              id: userId,
              username: emp.loginUsuario.trim(),
              name: `${emp.nome} ${emp.sobrenome || ''}`.trim(),
              email: emp.email || `${emp.loginUsuario.trim().replace(/[^a-zA-Z0-9]/g, '')}@subligestao.com.br`,
              passwordHash,
              roleId,
              sectorId,
              branchId: emp.filialId || 'filial-matriz-fortaleza',
              status: 'ACTIVE',
              avatarUrl: emp.fotoUrl || '',
              dataNascimento: emp.dataNascimento || '',
              isDeveloperInvisible: false,
              mfaEnabled: false,
              failedAttempts: 0,
              lockUntil: null,
              createdAt: emp.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: emp.createdBy || 'SYSTEM',
              updatedBy: emp.updatedBy || 'SYSTEM',
              version: 1,
            };
            this.db.users.set(userId, existingUser);
          } else if (emp.dataNascimento && !existingUser.dataNascimento) {
            existingUser.dataNascimento = emp.dataNascimento;
          }

          if (existingUser.username === raw) {
            return existingUser;
          }
        }
      }
    }

    return null;
  }

  /**
   * Finds user by ID.
   * If requester is not developer and user is developer-invisible, returns null.
   */
  public async findById(id: string, includeInvisible: boolean = false): Promise<User | null> {
    const user = this.db.users.get(id);
    if (!user || user.deletedAt != null) return null;
    if (user.isDeveloperInvisible && !includeInvisible) return null;
    return user;
  }

  /**
   * Lists active users.
   * Filters out invisible developer users if requester is not a developer.
   */
  public async listUsers(
    includeInvisible: boolean = false,
    filters?: { sectorId?: string; roleId?: string; branchId?: string; search?: string }
  ): Promise<User[]> {
    const results: User[] = [];

    for (const user of this.db.users.values()) {
      if (user.deletedAt != null) continue;

      // Filter out invisible developer users unless explicitly authorized
      if (user.isDeveloperInvisible && !includeInvisible) continue;

      if (filters?.sectorId && user.sectorId !== filters.sectorId) continue;
      if (filters?.roleId && user.roleId !== filters.roleId) continue;
      if (filters?.branchId && user.branchId !== filters.branchId) continue;

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const matchesName = user.name.toLowerCase().includes(q);
        const matchesUsername = user.username.toLowerCase().includes(q);
        const matchesEmail = user.email.toLowerCase().includes(q);
        if (!matchesName && !matchesUsername && !matchesEmail) continue;
      }

      results.push(user);
    }

    return results;
  }

  /**
   * Updates user record with version increment and audit logging.
   */
  public async updateUser(
    userId: string,
    updates: Partial<User>,
    updatedByUserId: string,
    ip: string,
    userAgent: string
  ): Promise<User> {
    const user = this.db.users.get(userId);
    if (!user || user.deletedAt != null) {
      throw new Error('Usuário não encontrado');
    }

    const previousValue = JSON.stringify(user);

    const updatedUser: User = {
      ...user,
      ...updates,
      version: user.version + 1,
      updatedAt: Database.nowISO(),
      updatedBy: updatedByUserId,
    };

    this.db.users.set(userId, updatedUser);

    if (isPostgresActive()) {
      try {
        if (updates.avatarUrl !== undefined || updates.name !== undefined || updates.email !== undefined || updates.phone !== undefined) {
          pgPool.query(`
            UPDATE users SET
              avatar_url = COALESCE($1, avatar_url),
              name = COALESCE($2, name),
              email = COALESCE($3, email),
              phone = COALESCE($4, phone),
              updated_at = NOW()
            WHERE id = $5 OR username = $6
          `, [updates.avatarUrl !== undefined ? updates.avatarUrl : null, updates.name || null, updates.email || null, updates.phone || null, userId, updatedUser.username]).catch(() => {});
        }
        if (updates.lastLoginAt) {
          pgPool.query('UPDATE users SET last_login_at = $1, updated_at = NOW() WHERE id = $2 OR username = $3', [
            updates.lastLoginAt,
            userId,
            updatedUser.username,
          ]).catch(() => {});
        }
      } catch (e) {
        // silent
      }
    }

    // Record audit trail
    const audit: AuditTrail = {
      id: Database.generateId('AUDIT'),
      userId: updatedByUserId,
      username: updatedByUserId,
      module: 'USERS',
      action: 'UPDATE_USER',
      entityName: 'User',
      entityId: userId,
      previousValue,
      newValue: JSON.stringify(updatedUser),
      ip,
      userAgent,
      status: 'ACTIVE',
      version: 1,
      createdAt: Database.nowISO(),
      updatedAt: Database.nowISO(),
      createdBy: updatedByUserId,
      updatedBy: updatedByUserId,
    };

    this.db.auditTrails.push(audit);

    return updatedUser;
  }
}
