import { Database } from './database';
import { CryptoSecurity } from '../security/crypto';
import { Branch, Role, Sector, User, RoleTitle, SectorType } from '../types';
import { Employee } from '../types/employee';
import { getDefaultSystemPermissions } from './defaultPermissions';

/**
 * Enterprise Database Seed Script
 * Initializes system sectors, roles, default branch, permissions,
 * the predefined user: @Marcelo-dev (Developer role),
 * and the authorized enterprise employees with their respective login credentials.
 */
export function initializeDatabaseSeed(): void {
  const db = Database.getInstance();

  // 1. Initialize Default Branches (Filial Matriz & Filial Empório) - Ambas Ativas como padrão
  const now = Database.nowISO();
  const branchId = 'FILIAL-MATRIZ-001';
  const branch2Id = 'filial-1790682978484';

  if (!db.branches.has(branchId)) {
    const mainBranch: Branch = {
      id: branchId,
      name: 'TECIDO SUBLIMADO - Matriz',
      tradeName: 'Tecido Sublimado Fortaleza',
      cnpj: '36.047.818/0001-07',
      stateRegistration: '061671967',
      address: {
        cep: '60510291',
        logradouro: 'AVENIDA SENADOR FERNANDES TAVORA',
        number: '2305',
        bairro: 'HENRIQUE JORGE',
        city: 'FORTALEZA',
        state: 'CE',
      },
      phone: '(85) 8425-1321',
      email: 'contato@tecidosublimado.com.br',
      status: 'ACTIVE',
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'SYSTEM_SEED',
      updatedBy: 'SYSTEM_SEED',
    };
    db.branches.set(branchId, mainBranch);
  }

  if (!db.branches.has(branch2Id)) {
    const emporioBranch: Branch = {
      id: branch2Id,
      name: 'EMPORIO DA SUBLIMACAO',
      tradeName: 'EMPORIO DA SUBLIMACAO LTDA',
      cnpj: '59.158.781/0001-90',
      stateRegistration: '072385812',
      address: {
        cep: '60526-641',
        logradouro: 'Avenida Senador Fernandes Távora',
        number: '02305',
        bairro: 'Autran Nunes',
        city: 'Fortaleza',
        state: 'CE',
      },
      phone: '(85) 99208-4810',
      email: 'FINANCEIROTSFORTALEZA@GMAIL.COM',
      status: 'ACTIVE',
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'SYSTEM_SEED',
      updatedBy: 'SYSTEM_SEED',
    };
    db.branches.set(branch2Id, emporioBranch);
  }

  // 2. Initialize System Sectors
  const sectorsData: Array<{ name: SectorType; description: string }> = [
    { name: 'Diretoria', description: 'Gestão Executiva e Estratégica (CEO, Gerente Geral)' },
    { name: 'Administrativo', description: 'Administração Geral, Recursos Humanos e Estoque' },
    { name: 'Comercial', description: 'Supervisão, Monitoria e Vendas Directas/OS' },
    { name: 'Atendimento', description: 'Recepção e Conferência/Expedição' },
    { name: 'Produção', description: 'Costura e Linha de Montagem Têxtil' },
    { name: 'Impressão', description: 'Impressão Sublimática e Papel' },
    { name: 'Calandra', description: 'Transferência Térmica e Calandragem' },
    { name: 'Expedição', description: 'Logística, Embalagem e Entrega' },
    { name: 'LOGISTICA', description: 'Logística e Movimentação' },
    { name: 'Operador', description: 'Operação e Manufatura' },
    { name: 'Serviços Gerais', description: 'Serviços Gerais e Apoio' },
  ];

  const sectorMap = new Map<SectorType, string>();

  sectorsData.forEach((s) => {
    const sectorId = `SEC-${s.name.toUpperCase().replace(/\s+/g, '_')}`;
    sectorMap.set(s.name, sectorId);
    if (!db.sectors.has(sectorId)) {
      const sectorEntity: Sector = {
        id: sectorId,
        name: s.name,
        description: s.description,
        status: 'ACTIVE',
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: 'SYSTEM_SEED',
        updatedBy: 'SYSTEM_SEED',
      };
      db.sectors.set(sectorId, sectorEntity);
    }
  });

  // 3. Initialize Roles with Hierarchy Levels
  const rolesData: Array<{ name: RoleTitle; level: number; sectorName: SectorType }> = [
    { name: 'Developer', level: 0, sectorName: 'Diretoria' },
    { name: 'ADM SISTEMA', level: 0, sectorName: 'Diretoria' },
    { name: 'ADMINISTRADOR', level: 0, sectorName: 'Diretoria' },
    { name: 'CEO', level: 1, sectorName: 'Diretoria' },
    { name: 'Gerente Geral', level: 2, sectorName: 'Diretoria' },
    { name: 'Administrativo', level: 3, sectorName: 'Administrativo' },
    { name: 'Administração', level: 3, sectorName: 'Administrativo' },
    { name: 'Expedição', level: 3, sectorName: 'Expedição' },
    { name: 'Estoque', level: 3, sectorName: 'Administrativo' },
    { name: 'Supervisor', level: 3, sectorName: 'Comercial' },
    { name: 'Monitor', level: 3, sectorName: 'Comercial' },
    { name: 'Vendedor(a)', level: 3, sectorName: 'Comercial' },
    { name: 'Recepção', level: 3, sectorName: 'Atendimento' },
    { name: 'Conferência', level: 3, sectorName: 'Atendimento' },
    { name: 'Designer', level: 3, sectorName: 'Impressão' },
    { name: 'Impressão', level: 3, sectorName: 'Impressão' },
    { name: 'Calandra', level: 3, sectorName: 'Calandra' },
    { name: 'Costura', level: 3, sectorName: 'Produção' },
    { name: 'Op. Máquina de corte', level: 3, sectorName: 'Produção' },
    { name: 'LOGISTICA', level: 3, sectorName: 'LOGISTICA' },
    { name: 'Operador', level: 3, sectorName: 'Operador' },
    { name: 'Serviços Gerais', level: 4, sectorName: 'Serviços Gerais' },
    { name: 'RH', level: 2, sectorName: 'Administrativo' },
  ];

  const roleMap = new Map<RoleTitle, string>();

  rolesData.forEach((r) => {
    const roleId = `ROLE-${r.name.toUpperCase().replace(/[\(\)\s]+/g, '_')}`;
    roleMap.set(r.name, roleId);
    const sectorId = sectorMap.get(r.sectorName) || sectorMap.get('Diretoria')!;

    if (!db.roles.has(roleId)) {
      const roleEntity: Role = {
        id: roleId,
        name: r.name,
        hierarchyLevel: r.level,
        sectorId: sectorId,
        description: `Cargo ${r.name} do setor ${r.sectorName}`,
        status: 'ACTIVE',
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: 'SYSTEM_SEED',
        updatedBy: 'SYSTEM_SEED',
      };
      db.roles.set(roleId, roleEntity);
    }
  });

  // 4. Initialize the predefined Developer User: @Marcelo-dev
  const devUserId = 'USR-DEV-MARCELO-001';
  let existingDev = db.users.get(devUserId);
  if (!existingDev) {
    for (const u of db.users.values()) {
      if (u.isDeveloperInvisible || u.username === '@Marcelo-dev') {
        existingDev = u;
        break;
      }
    }
  }

  if (!existingDev) {
    // Hash password 'Clara2105*' securely with bcrypt
    const passwordHash = CryptoSecurity.hashPasswordSync('Clara2105*');
    const devRoleId = roleMap.get('Developer')!;
    const devSectorId = sectorMap.get('Diretoria')!;

    const devUser: User = {
      id: devUserId,
      username: '@Marcelo-dev',
      passwordHash: passwordHash,
      name: 'Marcelo Gomes',
      email: 'dev@subligestao.internal',
      phone: '(85) 99960-8799',
      roleId: devRoleId,
      sectorId: devSectorId,
      branchId: branchId,
      isDeveloperInvisible: true, // Invisible to all non-Developer users
      avatarUrl: '',
      failedAttempts: 0,
      mfaEnabled: false,
      status: 'ACTIVE',
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'SYSTEM_SEED',
      updatedBy: 'SYSTEM_SEED',
    };

    db.users.set(devUserId, devUser);
    console.log('[SEED] Predefined @Marcelo-dev (Developer) account initialized securely.');
  } else {
    // Ensure existing developer keeps developer role & flag
    existingDev.isDeveloperInvisible = true;
    if (roleMap.has('Developer')) {
      existingDev.roleId = roleMap.get('Developer')!;
    }
  }

  // 5. Initialize Authorized Enterprise Employees and Login Credentials
  const employeesSeedData: Array<{
    id: string;
    codigo: string;
    nome: string;
    sobrenome: string;
    cargo: RoleTitle;
    setor: SectorType;
    senha: string;
    cpf: string;
    salarioBase: number;
    comissaoPorcentagem: number;
  }> = [];


  const defaultAddress = {
    cep: '60510-291',
    logradouro: 'Avenida Senador Fernandes Távora',
    numero: '2305',
    complemento: '',
    bairro: 'Henrique Jorge',
    cidade: 'Fortaleza',
    estado: 'CE',
  };

  employeesSeedData.forEach((emp) => {
    const roleId = roleMap.get(emp.cargo) || 'ROLE-VENDEDOR_A_';
    const sectorId = sectorMap.get(emp.setor) || 'SEC-DIRETORIA';
    const username = `@${emp.nome.toUpperCase()}`;
    const email = `${emp.nome.toLowerCase()}@tecidosublimado.com.br`;
    const userId = `USR-EMP-${emp.id}`;

    // 1. Employee Record
    if (!db.employees.has(emp.id)) {
      const employeeEntity: Employee = {
        id: emp.id,
        codigo: emp.codigo,
        nome: emp.nome,
        sobrenome: emp.sobrenome,
        cpf: emp.cpf,
        rg: '',
        fotoUrl: '',
        dataNascimento: '',
        dataAdmissao: '2026-01-05',
        cargo: emp.cargo,
        setor: emp.setor,
        filialId: branchId,
        filialNome: 'TECIDO SUBLIMADO - Matriz',
        salarioBase: emp.salarioBase,
        tipoSalario: 'Mensalista',
        comissaoPorcentagem: emp.comissaoPorcentagem,
        tipoComissao: emp.comissaoPorcentagem > 0 ? 'Sobre Vendas' : 'Fixo',
        metaIndividual: 0,
        chavePix: '',
        bancoInfo: '',
        beneficios: 'VT, VR, Plano de Saúde',
        observacoes: 'Cadastro corporativo oficial',
        endereco: defaultAddress,
        telefone: '(85) 8425-1321',
        email: email,
        status: 'ACTIVE',
        temLogin: true,
        loginUsuario: username,
        loginSenha: emp.senha,
        ficharioAnexos: [],
        createdAt: now,
        updatedAt: now,
        createdBy: 'SYSTEM_SEED',
        updatedBy: 'SYSTEM_SEED',
        version: 1,
      };
      db.employees.set(emp.id, employeeEntity);
    }

    // 2. User Account Record (Login)
    if (!db.users.has(userId)) {
      const passwordHash = CryptoSecurity.hashPasswordSync(emp.senha);
      const userEntity: User = {
        id: userId,
        username: username,
        passwordHash: passwordHash,
        name: emp.nome,
        email: email,
        phone: '(85) 8425-1321',
        roleId: roleId,
        sectorId: sectorId,
        branchId: branchId,
        isDeveloperInvisible: false,
        failedAttempts: 0,
        mfaEnabled: false,
        status: 'ACTIVE',
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: 'SYSTEM_SEED',
        updatedBy: 'SYSTEM_SEED',
      };
      db.users.set(userId, userEntity);
    }
  });

  // 6. Initialize Default Permissions ONLY if completely empty (Immutable User Settings)
  if (db.permissions.size === 0) {
    const defaultPerms = getDefaultSystemPermissions();
    for (const [roleId, rules] of Object.entries(defaultPerms)) {
      db.permissions.set(roleId, rules);
    }
  }

  console.log(`[SEED] Permissões do sistema e ${employeesSeedData.length} funcionários inicializados com sucesso.`);
}
