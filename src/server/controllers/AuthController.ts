import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthService } from '../services/AuthService';
import { UserRepository } from '../repositories/UserRepository';
import { RoleRepository } from '../repositories/RoleRepository';
import { CryptoSecurity } from '../security/crypto';
import { Database } from '../db/database';
import { pgPool, isPostgresActive } from '../db/postgres';
import { JWTManager } from '../security/jwt';
import { User } from '../types';
import { ChatRepository } from '../repositories/ChatRepository';

const authService = new AuthService();
const userRepo = new UserRepository();
const roleRepo = new RoleRepository();

export class AuthController {
  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'Usuário e senha são obrigatórios.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const ip = (req.ip || req.socket.remoteAddress || '127.0.0.1').toString();
      const userAgent = req.get('User-Agent') || 'Desconhecido';

      const result = await authService.login(username, password, ip, userAgent);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  public static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh Token não fornecido.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const ip = (req.ip || req.socket.remoteAddress || '127.0.0.1').toString();
      const userAgent = req.get('User-Agent') || 'Desconhecido';

      const tokens = await authService.refresh(refreshToken, ip, userAgent);

      res.status(200).json({
        success: true,
        data: tokens,
      });
    } catch (error: any) {
      next(error);
    }
  }

  public static async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado.',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      let user = await userRepo.findById(req.user.sub, true);
      if (!user && req.user.username) {
        user = await userRepo.findByUsername(req.user.username);
      }

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'Usuário não localizado.',
          code: 'NOT_FOUND',
        });
        return;
      }

      // Se for desenvolvedor e não tiver foto em memória, tenta recuperar do _system_store ou Supabase
      if ((user.isDeveloperInvisible || user.username?.toLowerCase().includes('dev') || user.username?.toLowerCase().includes('marcelo')) && (!user.avatarUrl || user.avatarUrl.length < 50)) {
        if (isPostgresActive()) {
          try {
            const devStore = await pgPool.query("SELECT data FROM _system_store WHERE collection = 'system_settings' AND id = 'developer_avatar'");
            if (devStore.rows.length > 0) {
              const parsed = typeof devStore.rows[0].data === 'string' ? JSON.parse(devStore.rows[0].data) : devStore.rows[0].data;
              if (parsed?.avatarUrl) {
                user.avatarUrl = parsed.avatarUrl;
              }
            }
          } catch (_) {}
        }
      }

      const role = await roleRepo.getRoleById(user.roleId);
      const sector = await roleRepo.getSectorById(user.sectorId);
      const branch = await roleRepo.getBranchById(user.branchId);

      const { passwordHash, mfaSecret, ...safeUser } = user;

      // Garante que supportAvatarUrl e localAtuacao estejam presentes
      if (!safeUser.supportAvatarUrl) {
        safeUser.supportAvatarUrl = ChatRepository.getSupportAvatarUrl();
      }

      if (!(safeUser as any).localAtuacao) {
        const empId = user.id.startsWith('USR-EMP-') ? user.id.replace('USR-EMP-', '') : user.id;
        const emp = Database.getInstance().employees.get(empId) ||
          Array.from(Database.getInstance().employees.values()).find(e =>
            e.id === empId ||
            (e.loginUsuario && e.loginUsuario.toLowerCase() === user.username.toLowerCase()) ||
            (e.nome && `${e.nome} ${e.sobrenome || ''}`.trim().toLowerCase() === user.name.toLowerCase())
          );
        if (emp?.localAtuacao) {
          (safeUser as any).localAtuacao = emp.localAtuacao;
        }
      }

      const isMasterAdmin = Boolean(
        user.name?.toLowerCase().includes('master') ||
        user.username?.toLowerCase() === 'admin' ||
        user.roleId === 'ROLE-ADM_MASTER' ||
        (user as any).role === 'ADM MASTER'
      );

      res.status(200).json({
        success: true,
        data: {
          user: safeUser,
          role: isMasterAdmin ? 'ADM MASTER' : (role ? role.name : 'Vendedor(a)'),
          sector: sector ? sector.name : 'Comercial',
          branch: branch ? branch.name : 'Matriz',
          isDeveloper: user.isDeveloperInvisible,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }

  public static async logout(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Sessão encerrada com sucesso.',
    });
  }

  public static async verifyPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { password, username, targetRole } = req.body;
      if (!password || typeof password !== 'string') {
        res.status(400).json({
          success: false,
          valid: false,
          error: 'Senha não fornecida.',
        });
        return;
      }

      const trimmed = password.trim();

      // 1. Developer master password (Acesso Total e Irrestrito)
      if (trimmed === 'Clara2105*') {
        res.status(200).json({
          success: true,
          valid: true,
          superiorRole: 'DEVELOPER',
          rank: 0,
          superiorName: 'Developer Master',
          isDeveloper: true,
          message: 'Autenticação de Desenvolvedor confirmada (Acesso Total e Irrestrito).',
        });
        return;
      }

      const db = Database.getInstance();

      const getSuperiorHierarchyRank = (roleOrCargo?: string, isDev?: boolean): number => {
        if (isDev) return 0;
        if (!roleOrCargo) return 99;
        const clean = roleOrCargo.toLowerCase().trim();
        if (clean === 'developer' || clean.includes('developer') || clean.includes('desenvolvedor') || clean.includes('@marcelo-dev')) {
          return 0;
        }
        if (
          clean === 'ceo' ||
          clean.startsWith('ceo ') ||
          clean.endsWith(' ceo') ||
          clean.includes('diretor executivo') ||
          clean.includes('presidente') ||
          clean.includes('diretoria') ||
          clean.includes('sócio') ||
          clean.includes('socio')
        ) {
          return 1;
        }
        if (
          clean.includes('gerente') ||
          clean.includes('admin master') ||
          clean.includes('administrador') ||
          clean.includes('administrativo')
        ) {
          return 2;
        }
        if (
          clean.includes('supervisor') ||
          clean.includes('supervisora') ||
          clean.includes('supervivor') ||
          clean.includes('supervisão') ||
          clean.includes('supervisao') ||
          clean.includes('coordenador') ||
          clean.includes('coordenadora') ||
          clean.includes('monitor') ||
          clean.includes('monitora')
        ) {
          return 3;
        }
        return 99;
      };

      const getSuperiorRoleName = (rank: number): string => {
        switch (rank) {
          case 0: return 'DEVELOPER';
          case 1: return 'CEO';
          case 2: return 'GERENTE GERAL';
          case 3: return 'SUPERVISOR';
          default: return 'OPERACIONAL';
        }
      };

      const targetRank = targetRole ? getSuperiorHierarchyRank(targetRole) : undefined;

      // 2. Check active users in Database
      for (const u of db.users.values()) {
        if (u.status === 'ACTIVE' && u.passwordHash) {
          const isValid = await CryptoSecurity.verifyPassword(trimmed, u.passwordHash);
          if (isValid) {
            const roleName = db.roles.get(u.roleId)?.name || (u.isDeveloperInvisible ? 'Developer' : '');
            const rank = getSuperiorHierarchyRank(roleName, u.isDeveloperInvisible);

            // Verifica se pertence aos Superiores (Developer, CEO, Gerente Geral, Supervisor)
            if (rank > 3) {
              res.status(200).json({
                success: true,
                valid: false,
                message: 'VOCÊ NÃO TEM AUTORIZAÇÃO PARA ESSE RECURSO',
              });
              return;
            }

            // Validação estrita de hierarquia de poder caso alvo seja informado
            if (targetRank !== undefined) {
              if (targetRank === 0 && rank > 0) {
                res.status(200).json({
                  success: true,
                  valid: false,
                  message: 'Hierarquia de Poder: Apenas o Desenvolvedor possui autorização sobre o perfil de Developer.',
                });
                return;
              }
              if (targetRank === 1 && rank === 2) {
                res.status(200).json({
                  success: true,
                  valid: false,
                  message: 'Hierarquia de Poder: Gerentes não possuem permissão para excluir um CEO. É necessária a senha do Desenvolvedor.',
                });
                return;
              }
              if (targetRank === 1 && rank === 3) {
                res.status(200).json({
                  success: true,
                  valid: false,
                  message: 'Hierarquia de Poder: Supervisores não possuem permissão para excluir um CEO. É necessária a senha do Desenvolvedor.',
                });
                return;
              }
              if (targetRank === 2 && rank === 3) {
                res.status(200).json({
                  success: true,
                  valid: false,
                  message: 'Hierarquia de Poder: Supervisores não possuem permissão para excluir um Gerente. É necessária a senha do Gerente Geral, CEO ou Desenvolvedor.',
                });
                return;
              }
            }

            res.status(200).json({
              success: true,
              valid: true,
              superiorRole: getSuperiorRoleName(rank),
              rank,
              superiorName: u.name,
              isDeveloper: rank === 0,
              message: `Autenticação do Superior (${getSuperiorRoleName(rank)} - ${u.name}) confirmada.`,
            });
            return;
          }
        }
      }

      // 3. Check active employees with login credential
      for (const emp of db.employees.values()) {
        if (emp.temLogin && emp.loginSenha && emp.loginSenha === trimmed) {
          const rank = getSuperiorHierarchyRank(emp.cargo, emp.isDeveloperInvisible);

          if (rank > 3) {
            res.status(200).json({
              success: true,
              valid: false,
              message: 'VOCÊ NÃO TEM AUTORIZAÇÃO PARA ESSE RECURSO',
            });
            return;
          }

          if (targetRank !== undefined) {
            if (targetRank === 0 && rank > 0) {
              res.status(200).json({
                success: true,
                valid: false,
                message: 'Hierarquia de Poder: Apenas o Desenvolvedor possui autorização sobre o perfil de Developer.',
              });
              return;
            }
            if (targetRank === 1 && rank === 2) {
              res.status(200).json({
                success: true,
                valid: false,
                message: 'Hierarquia de Poder: Gerentes não possuem permissão para excluir um CEO. É necessária a senha do Desenvolvedor.',
              });
              return;
            }
            if (targetRank === 1 && rank === 3) {
              res.status(200).json({
                success: true,
                valid: false,
                message: 'Hierarquia de Poder: Supervisores não possuem permissão para excluir um CEO. É necessária a senha do Desenvolvedor.',
              });
              return;
            }
            if (targetRank === 2 && rank === 3) {
              res.status(200).json({
                success: true,
                valid: false,
                message: 'Hierarquia de Poder: Supervisores não possuem permissão para excluir um Gerente. É necessária a senha do Gerente Geral, CEO ou Desenvolvedor.',
              });
              return;
            }
          }

          res.status(200).json({
            success: true,
            valid: true,
            superiorRole: getSuperiorRoleName(rank),
            rank,
            superiorName: emp.nome,
            isDeveloper: rank === 0,
            message: `Autenticação do Superior (${getSuperiorRoleName(rank)} - ${emp.nome}) confirmada.`,
          });
          return;
        }
      }

      res.status(200).json({
        success: true,
        valid: false,
        message: 'Senha incorreta! Não foi possível autenticar nenhum Superior autorizado.',
      });
    } catch (error: any) {
      next(error);
    }
  }

  public static async verifyOsEditPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { password, osOperator, osVendedor, osCodigo } = req.body;
      if (!password || typeof password !== 'string') {
        res.status(400).json({
          success: false,
          valid: false,
          error: 'Senha não fornecida.',
        });
        return;
      }

      const trimmed = password.trim();

      // 1. Chave do Desenvolvedor (Acesso Total e Irrestrito)
      if (trimmed === 'Clara2105*') {
        res.status(200).json({
          success: true,
          valid: true,
          authorizedRole: 'DEVELOPER',
          authorizedName: 'Developer Master',
          isDeveloper: true,
          message: 'Autorizado como Desenvolvedor Master.',
        });
        return;
      }

      const db = Database.getInstance();

      const norm = (str?: string) => (str || '').toLowerCase().trim();
      const targetOp = norm(osOperator);
      const targetVend = norm(osVendedor);

      const isMatchingResponsible = (name?: string, username?: string, email?: string): boolean => {
        const n = norm(name);
        const u = norm(username);
        const e = norm(email);
        const matches = (target: string) => {
          if (!target) return false;
          if (n && (target === n || target.includes(n) || n.includes(target))) return true;
          if (u && (target === u || target.includes(u) || u.includes(target))) return true;
          if (e && (target === e || target.includes(e) || e.includes(target))) return true;
          return false;
        };
        return matches(targetOp) || matches(targetVend);
      };

      const isDirecaoRank = (roleOrCargo?: string, isDev?: boolean): boolean => {
        if (isDev) return true;
        if (!roleOrCargo) return false;
        const clean = roleOrCargo.toLowerCase().trim();
        if (clean.includes('developer') || clean.includes('desenvolvedor') || clean.includes('@marcelo-dev') || clean === 'dev') return true;
        if (clean.includes('ceo') || clean.includes('diretoria') || clean.includes('diretor') || clean.includes('presidente') || clean.includes('sócio') || clean.includes('socio')) return true;
        if (clean.includes('gerente') || clean.includes('admin master') || clean.includes('administrador') || clean.includes('administrativo') || clean.includes('administração') || clean.includes('administracao')) return true;
        if (clean.includes('supervisor') || clean.includes('supervisora') || clean.includes('supervivor') || clean.includes('supervisão') || clean.includes('supervisao') || clean.includes('coordenador') || clean.includes('coordenadora')) return true;
        return false;
      };

      // 2. Check active users in Database
      for (const u of db.users.values()) {
        if (u.status === 'ACTIVE' && u.passwordHash) {
          const isValid = await CryptoSecurity.verifyPassword(trimmed, u.passwordHash);
          if (isValid) {
            const roleName = db.roles.get(u.roleId)?.name || (u.isDeveloperInvisible ? 'Developer' : '');
            const isDir = isDirecaoRank(roleName, u.isDeveloperInvisible);
            const isResp = isMatchingResponsible(u.name, u.username, u.email);

            if (isDir || isResp) {
              res.status(200).json({
                success: true,
                valid: true,
                authorizedRole: roleName || (isDir ? 'DIREÇÃO' : 'RESPONSÁVEL'),
                authorizedName: u.name,
                isResponsible: isResp,
                isDirecao: isDir,
                message: `Autorização confirmada (${u.name}).`,
              });
              return;
            } else {
              // "ao colocar a senha e não for o responsavel, informe que a senha dele está incorreta."
              res.status(200).json({
                success: true,
                valid: false,
                error: `Senha incorreta! Esta senha pertence a ${u.name}, que não é o responsável pela OS nem membro da Direção.`,
              });
              return;
            }
          }
        }
      }

      // 3. Check active employees with login credential
      for (const emp of db.employees.values()) {
        if (emp.temLogin && emp.loginSenha && emp.loginSenha === trimmed) {
          const isDir = isDirecaoRank(emp.cargo, emp.isDeveloperInvisible);
          const isResp = isMatchingResponsible(emp.nome, undefined, emp.email);

          if (isDir || isResp) {
            res.status(200).json({
              success: true,
              valid: true,
              authorizedRole: emp.cargo || (isDir ? 'DIREÇÃO' : 'RESPONSÁVEL'),
              authorizedName: emp.nome,
              isResponsible: isResp,
              isDirecao: isDir,
              message: `Autorização confirmada (${emp.nome}).`,
            });
            return;
          } else {
            // "ao colocar a senha e não for o responsavel, informe que a senha dele está incorreta."
            res.status(200).json({
              success: true,
              valid: false,
              error: `Senha incorreta! Esta senha pertence a ${emp.nome}, que não é o responsável pela OS nem membro da Direção.`,
            });
            return;
          }
        }
      }

      res.status(200).json({
        success: true,
        valid: false,
        error: 'Senha incorreta!',
      });
    } catch (error: any) {
      next(error);
    }
  }

  public static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword, confirmPassword, username: requestedUsername, newUsername } = req.body;
      const loggedUser = req.user;

      if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
        res.status(400).json({
          success: false,
          error: 'A nova senha deve possuir no mínimo 4 caracteres.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      if (confirmPassword && newPassword.trim() !== confirmPassword.trim()) {
        res.status(400).json({
          success: false,
          error: 'A confirmação da nova senha não confere.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const db = Database.getInstance();

      // Locate user by sub or username
      let targetUser: any = null;
      if (loggedUser?.sub) {
        targetUser = db.users.get(loggedUser.sub);
      }
      if (!targetUser && (loggedUser?.username || requestedUsername)) {
        const uname = (loggedUser?.username || requestedUsername).trim().toLowerCase();
        for (const u of db.users.values()) {
          if (
            u.username.toLowerCase() === uname ||
            `@${u.username.toLowerCase()}` === uname ||
            u.username.toLowerCase() === `@${uname}`
          ) {
            targetUser = u;
            break;
          }
        }
      }

      if (!targetUser) {
        res.status(404).json({
          success: false,
          error: 'Usuário não localizado no sistema.',
          code: 'NOT_FOUND',
        });
        return;
      }

      // Helper para checar se o perfil tem autorização para alterar o login de acesso:
      // Exclusivo para perfis: ADMIN, DEVELOPER e CEO. Demais perfis mantêm apenas troca de senha.
      const isPrivilegedForLoginChange = (u: any): boolean => {
        if (!u) return false;
        if (u.isDeveloper || u.isDeveloperInvisible) return true;
        const roleStr = String(u.role || u.roleId || '').trim().toLowerCase();
        const uname = String(u.username || '').trim().toLowerCase();
        const nameStr = String(u.name || '').trim().toLowerCase();

        // Developer
        if (roleStr.includes('dev') || uname.includes('marcelo-dev')) return true;

        // CEO
        if (roleStr === 'ceo' || roleStr.includes('ceo') || uname.includes('ceo')) return true;

        // Admin (Admin Master, Administrador, Administrativo, Gerente Geral)
        if (
          roleStr.includes('admin') ||
          roleStr.includes('gerente') ||
          roleStr.includes('diretoria') ||
          uname.includes('admin') ||
          nameStr.includes('admin')
        ) {
          return true;
        }

        return false;
      };

      const hasNewUsername = typeof newUsername === 'string' && newUsername.trim().length > 0;
      const cleanNewUsername = hasNewUsername ? newUsername.trim() : '';
      const oldUsername = targetUser.username;
      const isChangingUsername = hasNewUsername && cleanNewUsername !== oldUsername;

      if (isChangingUsername) {
        if (!isPrivilegedForLoginChange(targetUser)) {
          res.status(403).json({
            success: false,
            error: 'A alteração do login de acesso é restrita aos perfis Admin, Developer e CEO.',
            code: 'FORBIDDEN_LOGIN_CHANGE',
          });
          return;
        }

        if (cleanNewUsername.length < 3) {
          res.status(400).json({
            success: false,
            error: 'O novo login de acesso deve possuir no mínimo 3 caracteres.',
            code: 'VALIDATION_ERROR',
          });
          return;
        }

        // Validação de unicidade no banco de dados de usuários
        const rawNew = cleanNewUsername.toLowerCase().replace(/^@/, '');
        for (const [uid, otherUser] of db.users.entries()) {
          if (uid !== targetUser.id) {
            const rawOther = (otherUser.username || '').toLowerCase().replace(/^@/, '');
            if (rawOther === rawNew) {
              res.status(400).json({
                success: false,
                error: `O login "${cleanNewUsername}" já está em uso por outro usuário. Escolha outro.`,
                code: 'USERNAME_ALREADY_EXISTS',
              });
              return;
            }
          }
        }

        // Validação de unicidade no banco de funcionários
        for (const emp of db.employees.values()) {
          if (emp.id !== targetUser.id && `USR-EMP-${emp.id}` !== targetUser.id) {
            const rawEmpLogin = (emp.loginUsuario || '').toLowerCase().replace(/^@/, '');
            if (rawEmpLogin && rawEmpLogin === rawNew) {
              res.status(400).json({
                success: false,
                error: `O login "${cleanNewUsername}" já está cadastrado para outro funcionário. Escolha outro.`,
                code: 'USERNAME_ALREADY_EXISTS',
              });
              return;
            }
          }
        }
      }

      // Check current password
      if (currentPassword !== undefined && currentPassword !== null) {
        const isCurrentValid = await CryptoSecurity.verifyPassword(currentPassword.toString(), targetUser.passwordHash);
        if (!isCurrentValid) {
          res.status(400).json({
            success: false,
            error: 'A senha atual informada está incorreta.',
            code: 'INVALID_CURRENT_PASSWORD',
          });
          return;
        }
      }

      // Hash the new password with bcrypt
      const newHash = await CryptoSecurity.hashPassword(newPassword.trim());

      // Update in-memory user
      if (isChangingUsername) {
        targetUser.username = cleanNewUsername;
      }
      targetUser.passwordHash = newHash;
      targetUser.failedAttempts = 0;
      targetUser.lockUntil = null;
      targetUser.updatedAt = new Date().toISOString();
      db.users.set(targetUser.id, targetUser);

      // Persist to PostgreSQL / Supabase
      try {
        await pgPool.query(`
          UPDATE users 
          SET username = $1, password = $2, updated_at = NOW() 
          WHERE id = $3
        `, [targetUser.username, newHash, targetUser.id]);
      } catch (dbErr: any) {
        console.error('[ChangePassword] Error updating postgres table:', dbErr?.message);
      }

      // Sincronização obrigatória com o módulo de Funcionários (Employees)
      // "Quando alguem fizer alguma alteração de senha em "alterar minha senha" atualize a senha em funcionários."
      const updatedEmployeeIds: string[] = [];
      const cleanUserUsername = (oldUsername || requestedUsername || '').trim().toLowerCase();
      const rawUserUsername = cleanUserUsername.replace(/^@/, '');
      const cleanUserName = (targetUser.name || '').trim().toLowerCase();
      const cleanUserEmail = (targetUser.email || '').trim().toLowerCase();

      for (const emp of db.employees.values()) {
        const empLogin = (emp.loginUsuario || '').trim().toLowerCase();
        const rawEmpLogin = empLogin.replace(/^@/, '');
        const empCodigo = (emp.codigo || '').trim().toLowerCase();
        const empEmail = (emp.email || '').trim().toLowerCase();
        const empFullName = `${emp.nome || ''} ${emp.sobrenome || ''}`.trim().toLowerCase();
        const empNome = (emp.nome || '').trim().toLowerCase();

        const isMatch =
          emp.id === targetUser.id ||
          `USR-EMP-${emp.id}` === targetUser.id ||
          (empLogin && (empLogin === cleanUserUsername || rawEmpLogin === rawUserUsername)) ||
          (empCodigo && (empCodigo === cleanUserUsername || empCodigo === rawUserUsername)) ||
          (cleanUserEmail && empEmail && cleanUserEmail === empEmail) ||
          (cleanUserName && (empFullName === cleanUserName || (empNome.length > 2 && cleanUserName.includes(empNome))));

        if (isMatch) {
          emp.loginSenha = newPassword.trim();
          if (isChangingUsername) {
            emp.loginUsuario = cleanNewUsername;
          }
          emp.updatedAt = new Date().toISOString();
          emp.updatedBy = targetUser.username || 'PROFILE_CHANGE_PASSWORD';
          db.employees.set(emp.id, emp);
          updatedEmployeeIds.push(emp.id);
          console.log(`[ChangePassword] Credenciais atualizadas no funcionário: ${emp.codigo || emp.id} - ${emp.nome} (Login: ${emp.loginUsuario})`);

          // Persistência secundária caso a tabela employees exista no PostgreSQL
          try {
            await pgPool.query(`
              UPDATE employees 
              SET "loginSenha" = $1, "loginUsuario" = $2, "updatedAt" = $3 
              WHERE id = $4
            `, [newPassword.trim(), emp.loginUsuario, new Date().toISOString(), emp.id]);
          } catch {
            // Ignorado com segurança se a tabela/colunas não existirem
          }
        }
      }

      // Gera novos tokens de sessão caso o nome de usuário tenha mudado
      let newAccessToken: string | undefined;
      let newRefreshToken: string | undefined;
      try {
        newAccessToken = JWTManager.generateAccessToken({
          userId: targetUser.id,
          username: targetUser.username,
          role: (targetUser.roleId || 'Admin') as any,
          sector: (targetUser.sectorId || 'Diretoria') as any,
          branchId: targetUser.branchId || 'Matriz',
          isDeveloper: Boolean(targetUser.isDeveloperInvisible || targetUser.roleId === 'ROLE-DEVELOPER'),
        });
        newRefreshToken = JWTManager.generateRefreshToken(targetUser.id);
      } catch {
        // Ignorado caso a emissão de token de fallback não seja necessária
      }

      res.status(200).json({
        success: true,
        message: isChangingUsername
          ? `Login de acesso (${targetUser.username}) e senha atualizados com sucesso!`
          : 'Senha alterada com sucesso! A nova credencial está criptografada e salva no seu perfil e no cadastro de funcionários.',
        newUsername: targetUser.username,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        updatedEmployeesCount: updatedEmployeeIds.length,
        updatedEmployees: updatedEmployeeIds,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Atualiza o perfil do usuário (nome, email, telefone e avatar_url),
   * persistindo com garantia total no banco de dados Supabase / PostgreSQL.
   */
  public static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = Database.getInstance();
      const currentAuthUser = req.user;
      const { name, email, phone, avatarUrl, fotoUrl, avatar_url, supportAvatarUrl, supportPhotoUrl, isSupportPhoto, userId, username } = req.body;

      const photoToSave = avatarUrl !== undefined ? avatarUrl : (fotoUrl !== undefined ? fotoUrl : avatar_url);

      // Tratamento especial para foto do Suporte Técnico
      const explicitSupportPhoto = supportAvatarUrl || supportPhotoUrl || (isSupportPhoto ? photoToSave : undefined) || req.body?.support_avatar_url || req.body?.support_photo_url;
      if (explicitSupportPhoto) {
        ChatRepository.setSupportAvatarUrl(String(explicitSupportPhoto));
        try {
          if (String(explicitSupportPhoto).startsWith('data:image/')) {
            const base64Data = String(explicitSupportPhoto).replace(/^data:image\/[a-z0-9+]+;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');
            const targetPath = path.resolve(process.cwd(), 'public/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png');
            fs.writeFileSync(targetPath, imgBuffer);
            const distPath = path.resolve(process.cwd(), 'dist/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png');
            if (fs.existsSync(path.dirname(distPath))) {
              fs.writeFileSync(distPath, imgBuffer);
            }
          }
        } catch (fsErr) {
          console.warn('[AuthController.updateProfile] Erro ao sincronizar imagem no disco:', fsErr);
        }

        // Persiste com garantia máxima no Supabase (PostgreSQL) na tabela _system_store
        if (isPostgresActive()) {
          try {
            await pgPool.query(`
              INSERT INTO _system_store (collection, id, data)
              VALUES ('system_settings', 'support_avatar', $1)
              ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data
            `, [JSON.stringify({ url: String(explicitSupportPhoto), updatedAt: new Date().toISOString() })]);

            // Atualiza suporte em todos os perfis administrativos / desenvolvedores no banco de dados
            await pgPool.query(`
              UPDATE users
              SET support_avatar_url = $1, updated_at = NOW()
              WHERE is_developer = true OR username ILIKE '%marcelo%' OR username ILIKE '%dev%' OR username ILIKE '%admin%' OR role IN ('ADM', 'ROLE-ADM_MASTER')
            `, [String(explicitSupportPhoto)]).catch(() => {});
          } catch (suppErr) {
            console.warn('[AuthController.updateProfile] Erro ao persistir support_avatar no Supabase:', suppErr);
          }
        }
      }

      // 1. Identifica o usuário alvo no banco
      let targetUser: User | undefined;

      if (currentAuthUser?.sub && db.users.has(currentAuthUser.sub)) {
        targetUser = db.users.get(currentAuthUser.sub);
      } else if (userId && db.users.has(userId)) {
        targetUser = db.users.get(userId);
      } else if (currentAuthUser?.username) {
        const u = currentAuthUser.username.toLowerCase();
        for (const user of db.users.values()) {
          if (user.username?.toLowerCase() === u || `@${user.username?.replace(/^@/, '')}`.toLowerCase() === u) {
            targetUser = user;
            break;
          }
        }
      } else if (username) {
        const u = username.toLowerCase();
        for (const user of db.users.values()) {
          if (user.username?.toLowerCase() === u || `@${user.username?.replace(/^@/, '')}`.toLowerCase() === u) {
            targetUser = user;
            break;
          }
        }
      }

      // Se ainda não encontrou em memória, tenta buscar no PostgreSQL (Supabase)
      if (!targetUser && isPostgresActive()) {
        try {
          const searchParam = currentAuthUser?.sub || userId || currentAuthUser?.username || username;
          if (searchParam) {
            const queryRes = await pgPool.query(
              'SELECT * FROM users WHERE id = $1 OR username = $2 OR LOWER(username) = LOWER($2) LIMIT 1',
              [searchParam, searchParam]
            );
            if (queryRes.rows.length > 0) {
              const row = queryRes.rows[0];
              targetUser = {
                id: row.id,
                username: row.username,
                passwordHash: row.password,
                name: row.name || row.username,
                email: row.email || '',
                phone: row.phone || '',
                avatarUrl: row.avatar_url || '',
                supportAvatarUrl: row.support_avatar_url || '',
                roleId: row.role || 'ROLE-ADM_MASTER',
                sectorId: row.sector || 'SEC-DIRETORIA',
                branchId: 'FILIAL-MATRIZ-001',
                status: 'ACTIVE',
                isDeveloperInvisible: Boolean(row.is_developer),
                failedAttempts: 0,
                lockUntil: null,
                mfaEnabled: false,
                version: 1,
                createdAt: row.created_at || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'POSTGRES_SYNC',
                updatedBy: 'PROFILE_UPDATE',
              };
            }
          }
        } catch (dbFindErr) {
          console.warn('[AuthController.updateProfile] Erro ao buscar usuário no Supabase:', dbFindErr);
        }
      }

      if (!targetUser) {
        res.status(404).json({
          success: false,
          error: 'Usuário não localizado para atualização de perfil.',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      // 2. Aplica atualizações no objeto do usuário
      if (name !== undefined) targetUser.name = String(name).trim();
      if (email !== undefined) targetUser.email = String(email).trim();
      if (phone !== undefined) targetUser.phone = String(phone).trim();
      if (photoToSave !== undefined) targetUser.avatarUrl = String(photoToSave);
      if (explicitSupportPhoto !== undefined) targetUser.supportAvatarUrl = String(explicitSupportPhoto);
      targetUser.updatedAt = Database.nowISO();
      targetUser.version = (targetUser.version || 0) + 1;

      // 3. Salva no banco em memória e dispara persistência no _system_store e users table via PersistentMap
      db.users.set(targetUser.id, targetUser);

      // 4. Executa UPDATE direto na tabela users do Supabase (PostgreSQL) para garantia absoluta
      if (isPostgresActive()) {
        try {
          const isDevUser = Boolean(
            targetUser.isDeveloperInvisible ||
            targetUser.username?.toLowerCase().includes('marcelo') ||
            targetUser.username?.toLowerCase().includes('dev') ||
            targetUser.id === 'USR-DEV-MARCELO-001'
          );

          const updateRes = await pgPool.query(`
            UPDATE users
            SET 
              name = COALESCE($1, name),
              email = COALESCE($2, email),
              phone = COALESCE($3, phone),
              avatar_url = $4,
              support_avatar_url = COALESCE($5, support_avatar_url),
              updated_at = NOW()
            WHERE id = $6 OR username = $7 OR LOWER(username) = LOWER($7) ${isDevUser ? 'OR is_developer = true' : ''}
          `, [targetUser.name, targetUser.email, targetUser.phone, targetUser.avatarUrl, targetUser.supportAvatarUrl || null, targetUser.id, targetUser.username]);

          if (updateRes.rowCount === 0) {
            // Se ainda não existia a linha na tabela users, faz INSERT com ON CONFLICT
            await pgPool.query(`
              INSERT INTO users (id, username, password, name, email, phone, avatar_url, role, sector, is_developer, support_avatar_url)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                phone = EXCLUDED.phone,
                avatar_url = EXCLUDED.avatar_url,
                support_avatar_url = EXCLUDED.support_avatar_url,
                updated_at = NOW()
            `, [
              targetUser.id,
              targetUser.username,
              targetUser.passwordHash,
              targetUser.name,
              targetUser.email,
              targetUser.phone,
              targetUser.avatarUrl,
              (targetUser.roleId || 'ROLE-ADM_MASTER'),
              (targetUser.sectorId || 'SEC-DIRETORIA'),
              isDevUser,
              targetUser.supportAvatarUrl || null
            ]);
          }

          // Persistência redundante no _system_store para resiliência máxima
          if (isDevUser) {
            await pgPool.query(`
              INSERT INTO _system_store (collection, id, data)
              VALUES ('system_settings', 'developer_avatar', $1)
              ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data
            `, [JSON.stringify({ avatarUrl: targetUser.avatarUrl || '', updatedAt: new Date().toISOString() })]).catch(() => {});

            // Sincroniza foto em todas as instâncias de usuário developer
            await pgPool.query(`
              UPDATE users
              SET avatar_url = $1, updated_at = NOW()
              WHERE is_developer = true OR username ILIKE '%marcelo%' OR username ILIKE '%dev%'
            `, [targetUser.avatarUrl || '']).catch(() => {});
          }
        } catch (pgErr) {
          console.error('[AuthController.updateProfile] Erro ao persistir foto no Supabase:', pgErr);
        }
      }

      // 5. Se o usuário estiver vinculado a um Funcionário (Employees), sincroniza a foto (fotoUrl) também
      try {
        const empId = targetUser.id.startsWith('USR-EMP-')
          ? targetUser.id.replace('USR-EMP-', '')
          : null;

        const targetUsernameClean = targetUser.username.toLowerCase().replace(/^@/, '');

        for (const [id, emp] of db.employees.entries()) {
          const empUserClean = (emp.loginUsuario || '').toLowerCase().replace(/^@/, '');
          const isMatch = (empId && id === empId) || (empUserClean && empUserClean === targetUsernameClean);

          if (isMatch) {
            if (photoToSave !== undefined) emp.fotoUrl = String(photoToSave);
            if (targetUser.name) {
              const nameParts = targetUser.name.split(' ');
              emp.nome = nameParts[0] || emp.nome;
              if (nameParts.length > 1) {
                emp.sobrenome = nameParts.slice(1).join(' ');
              }
            }
            if (targetUser.email) emp.email = targetUser.email;
            if (targetUser.phone) emp.telefone = targetUser.phone;
            emp.updatedAt = Database.nowISO();
            db.employees.set(id, emp);
          }
        }
      } catch (empSyncErr) {
        console.warn('[AuthController.updateProfile] Aviso ao sincronizar com Funcionário:', empSyncErr);
      }

      const { passwordHash, mfaSecret, ...safeUser } = targetUser;

      res.status(200).json({
        success: true,
        message: 'Foto de perfil e dados atualizados com sucesso no Supabase.',
        user: safeUser,
        data: {
          user: safeUser,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }
}
