import { Database } from '../db/database';
import { Employee, CreateEmployeeDTO } from '../types/employee';
import { User } from '../types';
import { CryptoSecurity } from '../security/crypto';
import { ClientRepository } from './ClientRepository';

export class EmployeeRepository {
  private db = Database.getInstance();
  private static sequenceCounter = 1;

  public findByCPF(cpfRaw: string): Employee | undefined {
    const cleanCpf = cpfRaw.replace(/\D/g, '');
    return Array.from(this.db.employees.values()).find(
      (emp) => emp.cpf.replace(/\D/g, '') === cleanCpf
    );
  }

  public generateNextCode(cargo?: string): string {
    const cleanCargo = (cargo || '').trim().toUpperCase();

    // 1. CEO -> CEO01, CEO02...
    if (
      cleanCargo === 'CEO' ||
      cleanCargo.startsWith('CEO ') ||
      cleanCargo.endsWith(' CEO') ||
      cleanCargo.includes('DIRETOR EXECUTIVO (CEO)') ||
      cleanCargo.includes('CEO')
    ) {
      let maxNum = 0;
      for (const emp of this.db.employees.values()) {
        if (!emp.codigo) continue;
        const match = emp.codigo.match(/^CEO(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      const nextNum = maxNum + 1;
      return `CEO${String(nextNum).padStart(2, '0')}`;
    }

    // 2. Gerente Geral -> GRT001, GRT002...
    if (
      cleanCargo === 'GERENTE GERAL' ||
      cleanCargo.includes('GERENTE GERAL') ||
      cleanCargo.includes('GERENTE')
    ) {
      let maxNum = 0;
      for (const emp of this.db.employees.values()) {
        if (!emp.codigo) continue;
        const match = emp.codigo.match(/^GRT(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      const nextNum = maxNum + 1;
      return `GRT${String(nextNum).padStart(3, '0')}`;
    }

    // 3. Supervisor -> SUP001, SUP002...
    if (
      cleanCargo === 'SUPERVISOR' ||
      cleanCargo.includes('SUPERVISOR')
    ) {
      let maxNum = 0;
      for (const emp of this.db.employees.values()) {
        if (!emp.codigo) continue;
        const match = emp.codigo.match(/^SUP(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      const nextNum = maxNum + 1;
      return `SUP${String(nextNum).padStart(3, '0')}`;
    }

    // 4. Regular Employees -> TSF00001, TSF00002, TSF00003...
    let maxNum = 0;
    for (const emp of this.db.employees.values()) {
      if (!emp.codigo) continue;
      const match = emp.codigo.match(/^(?:TSF|FUNC-?)(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const nextNum = maxNum + 1;
    return `TSF${String(nextNum).padStart(5, '0')}`;
  }

  private syncEmployeeUserAccount(employee: Employee, loginSenha?: string): void {
    const userId = `USR-EMP-${employee.id}`;
    const hasLogin = Boolean(employee.temLogin && employee.loginUsuario?.trim() && employee.status === 'ACTIVE');

    let cleanUsername = employee.loginUsuario?.trim() || '';
    if (!cleanUsername) {
      const cleanCode = (employee.codigo || 'colab').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanId = employee.id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-6);
      cleanUsername = `@${cleanCode}_${cleanId}`;
    }

    if (hasLogin) {
      // Check username duplicate across other users (case-insensitive & prefix-tolerant)
      const uNormalized = cleanUsername.toLowerCase().replace(/^@/, '');
      for (const u of this.db.users.values()) {
        if (
          u.id !== userId &&
          u.deletedAt == null &&
          (u.username.toLowerCase() === cleanUsername.toLowerCase() ||
           u.username.toLowerCase().replace(/^@/, '') === uNormalized)
        ) {
          throw new Error(`O login de usuário "${cleanUsername}" já está em uso por outra conta.`);
        }
      }
    }

    const effectivePassword = (loginSenha && loginSenha.trim()) || (employee.loginSenha && employee.loginSenha.trim());
    const existingUser = this.db.users.get(userId);
    let passwordHash: string | undefined = undefined;

    if (hasLogin) {
      if (existingUser?.passwordHash && !loginSenha) {
        passwordHash = existingUser.passwordHash;
      } else if (effectivePassword) {
        passwordHash = CryptoSecurity.hashPasswordSync(effectivePassword);
      } else {
        passwordHash = CryptoSecurity.hashPasswordSync('123456');
      }
    } else {
      // Sem acesso ao sistema: passwordHash é nulo para impedir qualquer login
      passwordHash = undefined;
    }

    // Map sector & role if possible
    let roleId = existingUser?.roleId || 'ROLE-VENDEDOR_A_';
    if (employee.cargo) {
      const cargoUpper = employee.cargo.toUpperCase();
      for (const [id, role] of this.db.roles.entries()) {
        if (role.name.toUpperCase() === cargoUpper) {
          roleId = id;
          break;
        }
      }
    }

    let sectorId = existingUser?.sectorId || 'SEC-COMERCIAL';
    if (employee.setor) {
      const setorUpper = employee.setor.toUpperCase();
      for (const [id, sec] of this.db.sectors.entries()) {
        if (sec.name.toUpperCase() === setorUpper) {
          sectorId = id;
          break;
        }
      }
    }

    const userEntity: User = {
      id: userId,
      username: cleanUsername,
      passwordHash: passwordHash || '',
      name: `${employee.nome} ${employee.sobrenome || ''}`.trim(),
      email: employee.email || `${cleanUsername.replace('@', '')}@subligestao.com.br`,
      phone: employee.telefone || '',
      roleId: roleId,
      sectorId: sectorId,
      branchId: employee.filialId || 'filial-matriz-fortaleza',
      isDeveloperInvisible: false,
      failedAttempts: 0,
      mfaEnabled: false,
      status: employee.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      temLogin: hasLogin,
      employeeId: employee.id,
      avatarUrl: employee.fotoUrl || '',
      version: existingUser ? existingUser.version + 1 : 1,
      createdAt: existingUser ? existingUser.createdAt : (employee.createdAt || Database.nowISO()),
      updatedAt: Database.nowISO(),
      createdBy: 'EMPLOYEE_MODULE',
      updatedBy: 'EMPLOYEE_MODULE',
    };

    this.db.users.set(userId, userEntity);
  }

  public create(dto: CreateEmployeeDTO, createdBy: string = 'SYSTEM'): Employee {
    if (!dto.nome?.trim()) throw new Error('Nome do funcionário é obrigatório.');
    if (!dto.sobrenome?.trim()) throw new Error('Sobrenome do funcionário é obrigatório.');
    if (!dto.cpf?.trim()) throw new Error('CPF do funcionário é obrigatório.');

    if (!ClientRepository.validateCPF(dto.cpf)) {
      throw new Error('CPF inválido! Verifique o número digitado.');
    }

    if (this.findByCPF(dto.cpf)) {
      throw new Error('Já existe um funcionário cadastrado com este CPF.');
    }

    if (!dto.cargo?.trim()) throw new Error('Cargo / Função é obrigatório.');
    if (!dto.setor?.trim()) throw new Error('Setor é obrigatório.');

    if (dto.temLogin) {
      if (!dto.loginUsuario?.trim()) {
        throw new Error('Nome de Usuário (Login) é obrigatório quando o acesso ao sistema está ativado.');
      }
      if (!dto.loginSenha?.trim()) {
        throw new Error('Senha de Acesso é obrigatória ao cadastrar um novo login de funcionário.');
      }
    }

    const now = Database.nowISO();
    const id = Database.generateId('EMP');
    const codigo = this.generateNextCode(dto.cargo);

    const cleanLoginUsuario = dto.loginUsuario?.trim() || '';

    const newEmployee: Employee = {
      id,
      codigo,
      nome: dto.nome.trim(),
      sobrenome: dto.sobrenome.trim(),
      cpf: dto.cpf.trim(),
      rg: dto.rg?.trim() || '',
      fotoUrl: dto.fotoUrl || '',
      dataNascimento: dto.dataNascimento || '',
      dataAdmissao: dto.dataAdmissao || new Date().toISOString().split('T')[0],
      cargo: dto.cargo.trim(),
      setor: dto.setor.trim(),
      filialId: dto.filialId?.trim() || 'filial-matriz-fortaleza',
      filialNome: dto.filialNome?.trim() || 'TECIDO SUBLIMADO FORTALEZA',
      salarioBase: Number(dto.salarioBase) || 0,
      tipoSalario: dto.tipoSalario || 'Mensalista',
      comissaoPorcentagem: Number(dto.comissaoPorcentagem) || 0,
      tipoComissao: dto.tipoComissao || 'Sobre Vendas',
      metaIndividual: Number(dto.metaIndividual) || 0,
      chavePix: dto.chavePix?.trim() || '',
      bancoInfo: dto.bancoInfo?.trim() || '',
      beneficios: dto.beneficios?.trim() || '',
      observacoes: dto.observacoes?.trim() || '',
      endereco: dto.endereco,
      telefone: dto.telefone?.trim() || '',
      email: dto.email?.trim() || '',
      status: dto.status || 'ACTIVE',
      temLogin: !!dto.temLogin,
      loginUsuario: cleanLoginUsuario,
      loginSenha: dto.loginSenha?.trim() || '',
      ficharioAnexos: dto.ficharioAnexos || [],
      createdAt: now,
      updatedAt: now,
      createdBy,
      updatedBy: createdBy,
      version: 1,
    };

    // Sync with User database for auth and chat
    this.syncEmployeeUserAccount(newEmployee, dto.loginSenha);

    this.db.employees.set(id, newEmployee);
    return newEmployee;
  }

  public update(id: string, dto: Partial<CreateEmployeeDTO>, updatedBy: string = 'SYSTEM'): Employee {
    const existing = this.findByIdSync(id);
    if (!existing) {
      throw new Error('Funcionário não encontrado.');
    }

    const cleanLoginUsuario = dto.loginUsuario !== undefined ? dto.loginUsuario.trim() : existing.loginUsuario;

    const newTemLogin = dto.temLogin !== undefined ? !!dto.temLogin : !!existing.temLogin;

    if (newTemLogin && !cleanLoginUsuario) {
      throw new Error('Nome de Usuário (Login) é obrigatório quando o acesso ao sistema está ativado.');
    }

    const updated: Employee = {
      ...existing,
      ...dto,
      nome: dto.nome !== undefined ? dto.nome.trim() : existing.nome,
      sobrenome: dto.sobrenome !== undefined ? dto.sobrenome.trim() : existing.sobrenome,
      rg: dto.rg !== undefined ? dto.rg.trim() : existing.rg,
      cargo: dto.cargo !== undefined ? dto.cargo.trim() : existing.cargo,
      setor: dto.setor !== undefined ? dto.setor.trim() : existing.setor,
      filialId: dto.filialId !== undefined ? dto.filialId.trim() : existing.filialId,
      filialNome: dto.filialNome !== undefined ? dto.filialNome.trim() : existing.filialNome,
      salarioBase: dto.salarioBase !== undefined ? Number(dto.salarioBase) : existing.salarioBase,
      comissaoPorcentagem: dto.comissaoPorcentagem !== undefined ? Number(dto.comissaoPorcentagem) : existing.comissaoPorcentagem,
      metaIndividual: dto.metaIndividual !== undefined ? Number(dto.metaIndividual) : existing.metaIndividual,
      telefone: dto.telefone !== undefined ? dto.telefone.trim() : existing.telefone,
      email: dto.email !== undefined ? dto.email.trim() : existing.email,
      endereco: dto.endereco ? { ...existing.endereco, ...dto.endereco } : existing.endereco,
      temLogin: newTemLogin,
      loginUsuario: cleanLoginUsuario,
      loginSenha: dto.loginSenha !== undefined && dto.loginSenha.trim() !== '' ? dto.loginSenha.trim() : existing.loginSenha,
      ficharioAnexos: dto.ficharioAnexos !== undefined ? dto.ficharioAnexos : existing.ficharioAnexos,
      updatedAt: Database.nowISO(),
      updatedBy,
      version: existing.version + 1,
    };

    // Sync with User database
    this.syncEmployeeUserAccount(updated, dto.loginSenha);

    this.db.employees.set(id, updated);
    return updated;
  }

  public delete(id: string): boolean {
    const userId = `USR-EMP-${id}`;
    if (this.db.users.has(userId)) {
      this.db.users.delete(userId);
    }
    return this.db.employees.delete(id);
  }

  public async listAll(): Promise<Employee[]> {
    if (this.db.employees.size === 0) {
      await this.db.syncCollection('employees');
    }
    return Array.from(this.db.employees.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  public async findById(id: string): Promise<Employee | undefined> {
    let emp = this.db.employees.get(id);
    if (!emp) {
      await this.db.syncCollection('employees');
      emp = this.db.employees.get(id);
    }
    return emp;
  }

  public findByIdSync(id: string): Employee | undefined {
    return this.db.employees.get(id);
  }
}
