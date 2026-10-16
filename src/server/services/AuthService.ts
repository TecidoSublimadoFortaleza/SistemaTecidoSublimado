import { UserRepository } from '../repositories/UserRepository';
import { RoleRepository } from '../repositories/RoleRepository';
import { AuditRepository } from '../repositories/AuditRepository';
import { CryptoSecurity } from '../security/crypto';
import { JWTManager } from '../security/jwt';
import { User, RoleTitle, SectorType } from '../types';
import { Database } from '../db/database';
import { ChatRepository } from '../repositories/ChatRepository';

export class AuthService {
  private userRepo = new UserRepository();
  private roleRepo = new RoleRepository();
  private auditRepo = new AuditRepository();

  public async login(
    usernameInput: string,
    passwordInput: string,
    ip: string,
    userAgent: string
  ): Promise<{
    user: Omit<User, 'passwordHash' | 'mfaSecret'>;
    accessToken: string;
    refreshToken: string;
    roleName: RoleTitle;
    sectorName: SectorType;
  }> {
    const user = await this.userRepo.findByUsername(usernameInput);

    if (!user) {
      // Log failed attempt for unknown user
      await this.auditRepo.logAuthEvent({
        username: usernameInput,
        event: 'LOGIN_FAILED',
        ip,
        userAgent,
        details: 'Usuário não localizado no sistema.',
      });
      throw new Error('Credenciais de acesso inválidas.');
    }

    if (user.temLogin === false) {
      throw new Error('Colaborador sem permissão de acesso ao sistema (login não habilitado).');
    }

    // Check account lockout
    const nowMs = Date.now();
    if (user.lockUntil && new Date(user.lockUntil).getTime() > nowMs) {
      const remainingMs = new Date(user.lockUntil).getTime() - nowMs;
      const remainingMin = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
      await this.auditRepo.logAuthEvent({
        userId: user.id,
        username: user.username,
        event: 'LOGIN_FAILED',
        ip,
        userAgent,
        details: `Tentativa de login em conta bloqueada temporariamente (${remainingMin} min restantes).`,
      });
      throw new Error(
        `Conta temporariamente bloqueada devido a múltiplas tentativas falhas. Tente novamente em ${remainingMin} minuto(s) ou solicite o desbloqueio ao Administrador.`
      );
    }

    // Check password hash using CryptoSecurity
    let isValid = await CryptoSecurity.verifyPassword(passwordInput, user.passwordHash);

    // Fallback: If password verification failed, check if employee record has the password and self-heal
    if (!isValid) {
      try {
        const empId = user.id.startsWith('USR-EMP-') ? user.id.replace('USR-EMP-', '') : user.id;
        const db = Database.getInstance();
        const employee = db.employees.get(empId) ||
          Array.from(db.employees.values()).find(e => e.loginUsuario === user.username);

        if (employee && employee.temLogin && employee.loginSenha) {
          const empPass = employee.loginSenha.toString().trim();
          const cleanInput = passwordInput.toString().trim();
          if (
            empPass === cleanInput ||
            empPass === passwordInput ||
            employee.loginSenha === passwordInput ||
            await CryptoSecurity.verifyPassword(cleanInput, empPass) ||
            await CryptoSecurity.verifyPassword(passwordInput, employee.loginSenha)
          ) {
            isValid = true;
            // Self-heal the user's passwordHash in database immediately
            const newHash = CryptoSecurity.hashPasswordSync(cleanInput);
            user.passwordHash = newHash;
            user.failedAttempts = 0;
            user.lockUntil = null;
            await this.userRepo.updateUser(
              user.id,
              { passwordHash: newHash, failedAttempts: 0, lockUntil: null },
              user.id,
              ip,
              userAgent
            );
          }
        }
      } catch (e) {
        console.error('Error during fallback employee password check:', e);
      }
    }

    if (!isValid) {
      const newFailedAttempts = user.failedAttempts + 1;
      let lockUntil: string | null = null;

      if (newFailedAttempts >= 5) {
        // Lock for 15 minutes
        lockUntil = new Date(nowMs + 15 * 60 * 1000).toISOString();
        await this.auditRepo.logAuthEvent({
          userId: user.id,
          username: user.username,
          event: 'BRUTE_FORCE_LOCK',
          ip,
          userAgent,
          details: 'Conta bloqueada temporariamente após 5 tentativas incorretas.',
        });
      } else {
        await this.auditRepo.logAuthEvent({
          userId: user.id,
          username: user.username,
          event: 'LOGIN_FAILED',
          ip,
          userAgent,
          details: `Senha incorreta (${newFailedAttempts}/5 tentativas).`,
        });
      }

      await this.userRepo.updateUser(
        user.id,
        { failedAttempts: newFailedAttempts, lockUntil },
        user.id,
        ip,
        userAgent
      );

      throw new Error('Credenciais de acesso inválidas.');
    }

    // Credentials valid: fetch role and sector
    const role = await this.roleRepo.getRoleById(user.roleId);
    const sector = await this.roleRepo.getSectorById(user.sectorId);

    const isMasterAdmin = Boolean(
      user.name?.toLowerCase().includes('master') ||
      user.username?.toLowerCase() === 'admin' ||
      user.roleId === 'ROLE-ADM_MASTER' ||
      (user as any).role === 'ADM MASTER'
    );
    const roleName: RoleTitle = isMasterAdmin ? 'ADM MASTER' : (role ? role.name : 'Vendedor(a)');
    const sectorName = sector ? sector.name : 'Comercial';

    // Reset failed attempts and update login metadata
    const updatedUser = await this.userRepo.updateUser(
      user.id,
      {
        failedAttempts: 0,
        lockUntil: null,
        lastLoginAt: Database.nowISO(),
        lastLoginIp: ip,
        lastLoginDevice: userAgent,
      },
      user.id,
      ip,
      userAgent
    );

    // Generate Tokens
    const accessToken = JWTManager.generateAccessToken({
      userId: updatedUser.id,
      username: updatedUser.username,
      role: roleName,
      sector: sectorName,
      branchId: updatedUser.branchId,
      isDeveloper: updatedUser.isDeveloperInvisible,
    });

    const refreshToken = JWTManager.generateRefreshToken(updatedUser.id);

    // Log Successful Auth
    await this.auditRepo.logAuthEvent({
      userId: updatedUser.id,
      username: updatedUser.username,
      event: 'LOGIN_SUCCESS',
      ip,
      userAgent,
      details: 'Autenticação realizada com sucesso.',
    });

    const { passwordHash, mfaSecret, ...safeUser } = updatedUser;

    // Attach supportAvatarUrl from ChatRepository if missing
    if (!safeUser.supportAvatarUrl) {
      (safeUser as any).supportAvatarUrl = ChatRepository.getSupportAvatarUrl();
    }

    // Attach dataNascimento and localAtuacao from employee record if present
    const db = Database.getInstance();
    const empId = updatedUser.id.startsWith('USR-EMP-') ? updatedUser.id.replace('USR-EMP-', '') : updatedUser.id;
    const emp = db.employees.get(empId) || Array.from(db.employees.values()).find(e =>
      e.id === empId ||
      (e.loginUsuario && e.loginUsuario.toLowerCase() === updatedUser.username.toLowerCase()) ||
      (e.nome && `${e.nome} ${e.sobrenome || ''}`.trim().toLowerCase() === updatedUser.name.toLowerCase())
    );
    if (emp?.dataNascimento && !safeUser.dataNascimento) {
      (safeUser as any).dataNascimento = emp.dataNascimento;
    }
    if (emp?.localAtuacao) {
      (safeUser as any).localAtuacao = emp.localAtuacao;
    }

    return {
      user: safeUser,
      accessToken,
      refreshToken,
      roleName,
      sectorName,
    };
  }

  public async refresh(
    refreshTokenInput: string,
    ip: string,
    userAgent: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = JWTManager.verifyRefreshToken(refreshTokenInput);
    const user = await this.userRepo.findById(payload.sub, true);

    if (!user || user.status !== 'ACTIVE') {
      throw new Error('Usuário inativo ou não encontrado.');
    }

    const role = await this.roleRepo.getRoleById(user.roleId);
    const sector = await this.roleRepo.getSectorById(user.sectorId);

    const isMasterAdmin = Boolean(
      user.name?.toLowerCase().includes('master') ||
      user.username?.toLowerCase() === 'admin' ||
      user.roleId === 'ROLE-ADM_MASTER' ||
      (user as any).role === 'ADM MASTER'
    );
    const roleName: RoleTitle = isMasterAdmin ? 'ADM MASTER' : (role ? role.name : 'Vendedor(a)');
    const sectorName = sector ? sector.name : 'Comercial';

    const newAccessToken = JWTManager.generateAccessToken({
      userId: user.id,
      username: user.username,
      role: roleName,
      sector: sectorName,
      branchId: user.branchId,
      isDeveloper: user.isDeveloperInvisible,
    });

    const newRefreshToken = JWTManager.generateRefreshToken(user.id);

    await this.auditRepo.logAuthEvent({
      userId: user.id,
      username: user.username,
      event: 'TOKEN_REFRESH',
      ip,
      userAgent,
      details: 'Renovação de token realizada com sucesso.',
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
