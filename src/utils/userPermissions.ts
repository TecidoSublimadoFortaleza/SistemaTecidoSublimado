import { OsHistoryEntry } from '../server/types/os';
import { ApiService } from '../services/api';

export interface UserLoggedInfo {
  name: string;
  username?: string;
  role: string;
  isDeveloper: boolean;
  localAtuacao?: string;
}

export interface ModulePermissionRules {
  visualizar: boolean;
  criarEditar: boolean;
  excluir: boolean;
  descontoEspecial: boolean;
  voltarAcao?: boolean;
  verFinanceiro: boolean;
  configuracoes: boolean;
}

export function getLoggedUserAndPerfil(): UserLoggedInfo {
  try {
    const stored = localStorage.getItem('subligestao_user_profile') || localStorage.getItem('subligestao_user');
    if (stored) {
      const u = JSON.parse(stored);
      const username = u?.username || u?.user?.username || u?.loginUsuario || '';
      const name = u?.name || u?.nome || u?.username || u?.user?.name || u?.user?.username || 'Operador Logado';
      let rawRole = u?.role || u?.perfil || u?.cargo || u?.roleName || '';
      const localAtuacao = u?.localAtuacao || u?.user?.localAtuacao || '';
      
      const isDev = Boolean(
        u?.isDeveloper === true ||
        u?.isDeveloperInvisible === true ||
        u?.user?.isDeveloper === true ||
        u?.user?.isDeveloperInvisible === true ||
        username === '@Marcelo-dev' ||
        username.toLowerCase().includes('marcelo-dev') ||
        username.toLowerCase() === 'developer' ||
        rawRole === 'Developer' ||
        rawRole.toLowerCase().includes('developer') ||
        rawRole.toLowerCase().includes('desenvolvedor')
      );

      let role = rawRole || (isDev ? 'Developer' : 'Operador');
      if (isDev && !role.toLowerCase().includes('developer')) {
        role = `Developer (${role})`;
      }
      return { name, username, role, isDeveloper: isDev, localAtuacao };
    }
  } catch {}
  return { name: 'Operador Logado', username: '@Marcelo-dev', role: 'Developer', isDeveloper: true };
}

export function isShopeeSellerProfile(role?: string, localAtuacao?: string, username?: string): boolean {
  if (localAtuacao === 'Shopee') return true;
  if (role) {
    const lower = role.toLowerCase().trim();
    if (lower.includes('shopee')) return true;
  }
  try {
    const logged = getLoggedUserAndPerfil();
    if (logged.localAtuacao === 'Shopee') return true;
    if (logged.role?.toLowerCase().includes('shopee')) return true;
  } catch {}
  return false;
}

export const AUTHORIZED_SALES_ROLES = [
  'Developer',
  'CEO',
  'ADM MASTER',
  'Gerente Geral',
  'Supervisor',
  'Vendedor(a)',
  'Recepção',
];

/**
 * Verifica se o usuário é Administrador Master ou Developer.
 * Usado para ações e recursos restritos de alta governança, como importação em massa de planilhas de clientes.
 */
export function isDeveloperOrAdminMaster(role?: string, isDeveloper?: boolean, username?: string, name?: string): boolean {
  if (isDeveloper) return true;
  if (username) {
    const uLower = username.toLowerCase().trim();
    if (
      uLower === '@marcelo-dev' ||
      uLower.includes('marcelo-dev') ||
      uLower.includes('developer') ||
      uLower === 'admin' ||
      uLower.includes('adminmaster')
    ) {
      return true;
    }
  }
  if (name) {
    const nLower = name.toLowerCase().trim();
    if (nLower.includes('master')) return true;
  }
  if (!role) return false;

  const lower = role.toLowerCase().trim();

  // 1. Developer / Desenvolvedor
  if (lower.includes('developer') || lower.includes('desenvolvedor') || lower === 'dev') {
    return true;
  }

  // 2. Administrador Master
  if (
    lower === 'adm' ||
    lower === 'adm master' ||
    lower.includes('admin master') ||
    lower.includes('adm master') ||
    lower.includes('administrador master') ||
    lower.includes('administradora master') ||
    lower === 'master' ||
    (lower.startsWith('adm') && lower.includes('master'))
  ) {
    return true;
  }

  return false;
}

export function isRoleAuthorizedForSales(role?: string, isDeveloper?: boolean): boolean {
  if (isDeveloper) return true;
  if (!role) return false;
  const norm = normalizeRoleName(role);
  if (norm === 'Developer' || norm === 'ADM MASTER') return true;

  const lower = role.toLowerCase().trim();
  if (lower.includes('developer') || lower.includes('dev')) return true;
  if (lower.includes('adm master') || lower.includes('admin master')) return true;
  if (lower === 'ceo' || lower.includes('diretoria')) return true;
  if (lower.includes('gerente')) return true;
  if (lower.includes('supervisor')) return true;
  if (lower.includes('vendedor') || lower.includes('comercial')) return true;
  if (lower.includes('recepção') || lower.includes('recepcao') || lower.includes('balcão') || lower.includes('recepcao')) return true;

  return AUTHORIZED_SALES_ROLES.includes(norm);
}

/**
 * Verifica se o usuário pertence estritamente ao perfil operacional de Vendedora ou Recepção,
 * onde é permitida apenas a importação de notas vinculadas a pedidos de OS e VND,
 * sendo terminantemente proibida a emissão de notas avulsas.
 */
export function isVendedoraOuRecepcaoProfile(role?: string, isDeveloper?: boolean, username?: string): boolean {
  if (isDeveloper) return false;
  if (isDeveloperOrAdminMaster(role, isDeveloper, username)) return false;
  if (!role) return false;

  const norm = normalizeRoleName(role);
  // Papéis de liderança/gestão e desenvolvimento têm permissão total (incluindo notas avulsas)
  if (['Developer', 'ADM MASTER', 'CEO', 'Gerente Geral', 'Supervisor', 'ADMINISTRATIVO'].includes(norm)) {
    return false;
  }

  const lower = role.toLowerCase().trim();
  if (lower.includes('developer') || lower.includes('desenvolvedor') || lower.includes('admin') || lower.includes('gerente') || lower.includes('supervisor') || lower.includes('ceo')) {
    return false;
  }

  return norm === 'Vendedor(a)' || norm === 'Recepção' || lower.includes('vendedor') || lower.includes('comercial') || lower.includes('recep') || lower.includes('balcão') || lower.includes('balcao');
}

/**
 * Verifica se o usuário tem cargo autorizado a visualizar e editar Ordem de Serviço PAGA.
 * Autorizados: Diretoria, Supervisor, Admin Master, Developer, CEO, Gerente, Supervivor.
 * Aos demais funcionários (Vendedor, Recepção, Produção, etc.): NÃO exibe a ação editar quando a OS for paga.
 */
export function isRoleAuthorizedToEditPaidOs(role?: string, isDeveloper?: boolean, username?: string): boolean {
  if (isDeveloper) return true;
  if (username) {
    const uLower = username.toLowerCase().trim();
    if (uLower === '@marcelo-dev' || uLower.includes('marcelo-dev') || uLower.includes('developer')) {
      return true;
    }
  }
  if (!role) return false;

  const lower = role.toLowerCase().trim();

  // 1. Developer
  if (lower.includes('developer') || lower.includes('desenvolvedor') || lower === 'dev') {
    return true;
  }

  // 2. CEO & Diretoria
  if (
    lower === 'ceo' ||
    lower.startsWith('ceo ') ||
    lower.endsWith(' ceo') ||
    lower.includes('diretoria') ||
    lower.includes('diretor') ||
    lower.includes('presidente') ||
    lower.includes('sócio') ||
    lower.includes('socio')
  ) {
    return true;
  }

  // 3. Gerente Geral / Gerência
  if (lower.includes('gerente') || lower.includes('gerência') || lower.includes('gerencia')) {
    return true;
  }

  // 4. Supervisor / Supervivor
  if (
    lower.includes('supervisor') ||
    lower.includes('supervisora') ||
    lower.includes('supervivor') ||
    lower.includes('supervisão') ||
    lower.includes('supervisao') ||
    lower.includes('coordenador') ||
    lower.includes('coordenadora')
  ) {
    return true;
  }

  // 5. Admin Master / Administrador
  if (
    lower.includes('admin master') ||
    lower.includes('master') ||
    lower === 'admin' ||
    lower.includes('administrador') ||
    lower.includes('administrativo') ||
    lower.includes('administração') ||
    lower.includes('administracao')
  ) {
    return true;
  }

  return false;
}

/**
 * Alias para checar se usuário pertence à Direção/Superiores
 * (Diretoria, Supervisor, Admin Master, Developer, CEO, Gerente Geral, Supervivor)
 */
export const isUserDirecao = isRoleAuthorizedToEditPaidOs;

/**
 * Verifica se o usuário possui cargo autorizado para visualização completa do módulo Estoque
 * (exibição do KPI e colunas de "Valor em Estoque" e visualização de produtos internos).
 * Cargos autorizados: "estoque", "CEO", "gerente geral", "developer" e "admin sistema".
 * Para os demais cargos com acesso concedido ao Estoque, não exibe "Valor em Estoque" nem os produtos internos.
 */
export function isFullEstoqueAuthorizedRole(role?: string, isDeveloper?: boolean, username?: string): boolean {
  if (isDeveloper) return true;
  if (username) {
    const uLower = username.toLowerCase().trim();
    if (
      uLower === '@marcelo-dev' ||
      uLower.includes('marcelo-dev') ||
      uLower.includes('developer') ||
      uLower === 'admin' ||
      uLower.includes('adminmaster')
    ) {
      return true;
    }
  }
  if (!role) return false;
  const lower = role.toLowerCase().trim();
  const norm = normalizeRoleName(role);

  // 1. Developer
  if (lower.includes('developer') || lower.includes('desenvolvedor') || lower === 'dev' || norm === 'Developer') {
    return true;
  }
  // 2. Estoque / Almoxarifado
  if (lower.includes('estoque') || lower.includes('estoquista') || lower.includes('almoxarif') || norm === 'Estoque') {
    return true;
  }
  // 3. CEO / Diretoria
  if (
    lower === 'ceo' ||
    lower.startsWith('ceo ') ||
    lower.endsWith(' ceo') ||
    lower.includes('diretoria') ||
    lower.includes('diretor') ||
    norm === 'CEO'
  ) {
    return true;
  }
  // 4. Gerente Geral / Gerência
  if (lower.includes('gerente') || lower.includes('gerência') || lower.includes('gerencia') || norm === 'Gerente Geral') {
    return true;
  }
  // 5. Admin Sistema / ADM MASTER / Administrador
  if (
    lower.includes('admin sistema') ||
    lower.includes('administrador do sistema') ||
    lower.includes('adm sistema') ||
    lower.includes('adm master') ||
    lower.includes('admin master') ||
    lower.includes('administrador') ||
    lower.includes('administradora') ||
    lower === 'admin' ||
    lower === 'adm' ||
    lower.includes('master') ||
    norm === 'ADM MASTER' ||
    norm === 'ADMINISTRATIVO'
  ) {
    return true;
  }

  return false;
}

/**
 * Verifica se um determinado usuário (ou o usuário logado) é o responsável por esta Ordem de Serviço.
 * (Compara com os.operador, os.vendedorNome, os.createdBy)
 */
export function isUserResponsibleForOs(
  os?: { operador?: string; vendedorNome?: string; createdBy?: string } | null,
  userToCheck?: { name?: string; username?: string }
): boolean {
  if (!os) return false;
  const norm = (str?: string) => (str || '').trim().toLowerCase();

  let targetName = norm(userToCheck?.name);
  let targetUsername = norm(userToCheck?.username);

  if (!targetName && !targetUsername) {
    try {
      const logged = getLoggedUserAndPerfil();
      targetName = norm(logged.name);
      targetUsername = norm(logged.username);
    } catch {}
  }

  const osOp = norm(os.operador);
  const osVend = norm(os.vendedorNome);
  const osCreated = norm(os.createdBy);

  const checkMatch = (targetStr: string) => {
    if (!targetStr) return false;
    if (targetName && (targetStr === targetName || targetStr.includes(targetName) || targetName.includes(targetStr))) return true;
    if (targetUsername && (targetStr === targetUsername || targetStr.includes(targetUsername) || targetUsername.includes(targetStr))) return true;
    return false;
  };

  return checkMatch(osOp) || checkMatch(osVend) || checkMatch(osCreated);
}

/**
 * Verifica se o usuário tem autorização para iniciar a edição de uma OS.
 * Regra: "se não for o responsavel ou alguem da direção que for editar a os, informe que ele não tem autorização"
 */
export function canUserInitiateOsEdit(
  os: { operador?: string; vendedorNome?: string; createdBy?: string; [key: string]: any }
): { allowed: boolean; reason?: string; responsibleName: string; isDirecao: boolean; isResponsible: boolean } {
  const responsibleName = os.operador || os.vendedorNome || os.createdBy || 'Responsável';
  const { role, isDeveloper, name, username } = getLoggedUserAndPerfil();

  const isDir = isUserDirecao(role, isDeveloper, username);
  const isResp = isUserResponsibleForOs(os, { name, username });

  if (isDir || isResp) {
    return {
      allowed: true,
      responsibleName,
      isDirecao: isDir,
      isResponsible: isResp,
    };
  }

  return {
    allowed: false,
    reason: `Acesso Restrito: Você não tem autorização para editar esta Ordem de Serviço. Apenas o responsável (${responsibleName}) ou alguém da Direção podem editá-la.`,
    responsibleName,
    isDirecao: false,
    isResponsible: false,
  };
}

export function normalizeRoleName(role: string): string {
  if (!role) return 'Vendedor(a)';
  const r = role.trim();
  const lower = r.toLowerCase();

  if (lower.includes('developer') || lower === 'dev') return 'Developer';
  if (lower.includes('adm master') || lower.includes('admin master') || lower === 'master' || lower === 'adm') return 'ADM MASTER';
  if (lower === 'ceo' || lower.includes('diretoria')) return 'CEO';
  if (lower.includes('gerente')) return 'Gerente Geral';
  if (lower.includes('administrativo') || lower.includes('administração') || lower.includes('administracao') || lower === 'admin') return 'ADMINISTRATIVO';
  if (lower.includes('supervisor')) return 'Supervisor';
  if (lower.includes('monitor')) return 'Monitor';
  if (lower.includes('shopee')) return 'Vendedora Shopee';
  if (lower.includes('vendedor') || lower.includes('comercial')) return 'Vendedor(a)';
  if (lower.includes('designer') || lower.includes('arte')) return 'Designer';
  if (lower.includes('impress') || lower === 'impressão') return 'IMPRESSÃO';
  if (lower.includes('calandra')) return 'CALANDRA';
  if (lower.includes('costura')) return 'Costura';
  if (lower.includes('estoque') || lower.includes('almoxarifado')) return 'Estoque';
  if (lower.includes('conferencia') || lower.includes('conferência') || lower.includes('conferente')) return 'CONFERENCIA';
  if (lower === 'rh' || lower.includes('recursos humanos')) return 'RH';
  if (lower.includes('serviços gerais') || lower.includes('servicos gerais') || lower.includes('serviço geral') || lower.includes('servico geral') || lower.includes('limpeza')) return 'Serviços Gerais';
  if (lower.includes('corte') || lower.includes('máquina de corte') || lower.includes('maquina de corte') || lower.includes('op. máquina de corte') || lower.includes('op. maquina de corte')) return 'Op. Máquina de corte';
  if (lower.includes('logística') || lower.includes('logistica')) return 'LOGISTICA';
  if (lower.includes('operador')) return 'Operador';
  if (lower.includes('expedição') || lower.includes('expedicao') || lower.includes('exped')) return 'Expedição';
  if (lower.includes('recepção') || lower.includes('recepcao') || lower.includes('balcão') || lower.includes('balcao')) return 'Recepção';

  return r;
}

export function getErpModuleIdFromMenuId(menuId: string): string {
  switch (menuId) {
    case 'tv':
      return 'tv';
    case 'tv-comercial':
      return 'tv-comercial';
    case 'tv-producao':
      return 'tv-producao';
    case 'orcamento':
      return 'orcamento';
    case 'ordem-servico':
      return 'ordemServico';
    case 'ordem-servico-shopee':
      return 'ordemServicoShopee';
    case 'conferencia-os':
      return 'conferenciaOs';
    case 'historico-os':
      return 'historicoOs';
    case 'caixa-pdv':
      return 'pdv';
    case 'gerenciador-caixa':
      return 'gerenciadorCaixa';
    case 'waleads':
      return 'waleads';
    case 'notas-fiscais':
      return 'notasFiscais';
    case 'gerenciador-notas-fiscais':
      return 'gerenciadorNotasFiscais';
    default:
      return menuId;
  }
}

export const PERMISSIONS_VERSION = 'v14_filiais_unified_sync';

export function getDefaultPermissionsMap(): Record<string, Record<string, ModulePermissionRules>> {
  const roles = [
    'Developer',
    'CEO',
    'Gerente Geral',
    'ADMINISTRATIVO',
    'Administrativo',
    'Supervisor',
    'Monitor',
    'Vendedor(a)',
    'Vendedora Shopee',
    'Designer',
    'IMPRESSÃO',
    'Impressão',
    'CALANDRA',
    'Calandra',
    'Costura',
    'Op. Máquina de corte',
    'Operador',
    'Estoque',
    'LOGISTICA',
    'CONFERENCIA',
    'Conferência',
    'Expedição',
    'Recepção',
    'RH',
    'Serviços Gerais',
  ];

  const modules = [
    'dashboard',
    'tv',
    'tv-comercial',
    'tv-producao',
    'clientes',
    'kanban',
    'orcamento',
    'ordemServico',
    'ordemServicoShopee',
    'estoque',
    'produtos-venda',
    'funcionarios',
    'jornada',
    'conferenciaOs',
    'controle-expedicao',
    'entrega-devolucao',
    'relatorios',
    'azulzinha',
    'gerenciadorCaixa',
    'waleads',
    'rh',
    'historicoOs',
    'mensagens',
    'pdv',
    'notasFiscais',
    'gerenciadorNotasFiscais',
    'backup',
    'configuracoes',
    'filiais',
  ];

  const map: Record<string, Record<string, ModulePermissionRules>> = {};

  roles.forEach((role) => {
    map[role] = {};
    const normRole = normalizeRoleName(role);

    modules.forEach((mod) => {
      // 1. DEVELOPER, CEO, GERENTE GERAL, ADM MASTER: All modules, all actions enabled (including excluir filiais)
      if (
        normRole === 'Developer' ||
        normRole === 'CEO' ||
        normRole === 'Gerente Geral' ||
        normRole === 'ADM MASTER' ||
        normRole === 'Master'
      ) {
        map[role][mod] = {
          visualizar: true,
          criarEditar: true,
          excluir: true,
          descontoEspecial: true,
          voltarAcao: true,
          verFinanceiro: true,
          configuracoes: true,
        };
      }
      // 2. ADMINISTRATIVO (Gestão Corporativa) - Funcionários, Jornada, Relatórios, Azulzinha, Gerenciador CAIXA, RH, Mensagens Internas, Notas Fiscais, Gerenciador de Notas Fiscais, Produtos de Venda
      else if (normRole === 'ADMINISTRATIVO' || normRole === 'Administrativo') {
        const hasAccess = ['funcionarios', 'jornada', 'relatorios', 'azulzinha', 'gerenciadorCaixa', 'rh', 'mensagens', 'notasFiscais', 'gerenciadorNotasFiscais', 'produtos-venda'].includes(mod);
        const isFin = ['relatorios', 'azulzinha', 'gerenciadorCaixa', 'notasFiscais', 'gerenciadorNotasFiscais'].includes(mod);
        map[role][mod] = {
          visualizar: hasAccess,
          criarEditar: hasAccess,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: isFin,
          configuracoes: mod === 'notasFiscais' || mod === 'gerenciadorNotasFiscais',
        };
      }
      // 3. SUPERVISOR (Liderança Tática) - Dashboard, Dashboard Comercial (tv-comercial), Clientes, Kanban, Orçamento, Ordem de Serviço, Estoque, Produtos de Venda, Relatórios, Histórico de OS, Mensagens Internas, Notas Fiscais, Gerenciador de Notas Fiscais
      else if (normRole === 'Supervisor') {
        const hasAccess = [
          'dashboard', 'tv-comercial', 'clientes', 'kanban',
          'orcamento', 'ordemServico', 'estoque', 'produtos-venda',
          'relatorios', 'historicoOs', 'mensagens', 'notasFiscais', 'gerenciadorNotasFiscais'
        ].includes(mod);

        map[role][mod] = {
          visualizar: hasAccess,
          criarEditar: hasAccess,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: mod === 'kanban',
          verFinanceiro: ['relatorios', 'notasFiscais', 'gerenciadorNotasFiscais'].includes(mod),
          configuracoes: false,
        };
      }
      // 4. VENDEDOR(A) (Comercial & Balcão) - Dashboard, Clientes, Kanban, Orçamento, Ordem de Serviço, Produtos de Venda, Histórico de OS, Mensagens Internas, Notas Fiscais, Gerenciador de Notas Fiscais
      else if (normRole === 'Vendedor(a)') {
        const hasAccess = ['dashboard', 'clientes', 'kanban', 'orcamento', 'ordemServico', 'produtos-venda', 'historicoOs', 'mensagens', 'notasFiscais', 'gerenciadorNotasFiscais'].includes(mod);
        map[role][mod] = {
          visualizar: hasAccess,
          criarEditar: hasAccess,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: false,
          configuracoes: false,
        };
      }
      // 5. VENDEDORA SHOPEE (Marketplace) - Dashboard, Kanban, Orçamento, Ordem de Serviço Shopee, Produtos de Venda, Histórico de OS, Mensagens Internas
      else if (normRole === 'Vendedora Shopee') {
        const hasAccess = ['dashboard', 'kanban', 'orcamento', 'ordemServicoShopee', 'produtos-venda', 'historicoOs', 'mensagens'].includes(mod);
        map[role][mod] = {
          visualizar: hasAccess,
          criarEditar: hasAccess,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: false,
          configuracoes: false,
        };
      }
      // 6. RECEPÇÃO (Atendimento Presencial) - Dashboard, Clientes, Kanban, Orçamento, Ordem de Serviço, Produtos de Venda, Entrega & Devolução, Histórico de OS, Mensagens Internas, PDV (Caixa), Notas Fiscais, Gerenciador de Notas Fiscais
      else if (normRole === 'Recepção') {
        const hasAccess = ['dashboard', 'clientes', 'kanban', 'orcamento', 'ordemServico', 'produtos-venda', 'entrega-devolucao', 'historicoOs', 'mensagens', 'pdv', 'notasFiscais', 'gerenciadorNotasFiscais'].includes(mod);
        map[role][mod] = {
          visualizar: hasAccess,
          criarEditar: hasAccess,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: false,
          configuracoes: false,
        };
      }
      // 7. MONITOR (Auditoria de Qualidade) - 4 módulos: Kanban, Conferência de OS, Controle de Expedição, Mensagens Internas
      else if (normRole === 'Monitor') {
        const hasAccess = ['kanban', 'conferenciaOs', 'controle-expedicao', 'mensagens'].includes(mod);
        map[role][mod] = {
          visualizar: hasAccess,
          criarEditar: hasAccess,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: false,
          configuracoes: false,
        };
      }
      // 8. SETORES PRODUTIVOS TÊXTEIS: Designer, IMPRESSÃO, CALANDRA, Costura - 2 módulos cada: Kanban e Mensagens Internas
      else if (['Designer', 'IMPRESSÃO', 'Impressão', 'CALANDRA', 'Calandra', 'Costura', 'Op. Máquina de corte', 'Operador'].includes(normRole)) {
        const hasAccess = ['kanban', 'mensagens'].includes(mod);
        map[role][mod] = {
          visualizar: hasAccess,
          criarEditar: hasAccess,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: false,
          configuracoes: false,
        };
      }
      // 9. ESTOQUE (Materiais e Insumos) - Estoque, Produtos de Venda, Mensagens Internas
      else if (normRole === 'Estoque') {
        const hasAccess = ['estoque', 'produtos-venda', 'mensagens'].includes(mod);
        map[role][mod] = {
          visualizar: hasAccess,
          criarEditar: hasAccess,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: false,
          configuracoes: false,
        };
      }
      // 10. CONFERÊNCIA (Inspeção de Saída e Embalagem) - 4 módulos: Kanban, Conferência de OS, Histórico de OS, Mensagens Internas
      else if (normRole === 'CONFERENCIA' || normRole === 'Conferência') {
        const hasAccess = ['kanban', 'conferenciaOs', 'historicoOs', 'mensagens'].includes(mod);
        map[role][mod] = {
          visualizar: hasAccess,
          criarEditar: hasAccess,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: false,
          configuracoes: false,
        };
      }
      // EXPEDIÇÃO & LOGÍSTICA - 3 módulos: Kanban, Controle de Expedição, Mensagens Internas
      else if (normRole === 'Expedição' || normRole === 'LOGISTICA') {
        const hasAccess = ['kanban', 'controle-expedicao', 'mensagens'].includes(mod);
        map[role][mod] = {
          visualizar: hasAccess,
          criarEditar: hasAccess,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: false,
          configuracoes: false,
        };
      }
      // 11. RH (Recursos Humanos & DP) - 6 módulos: Funcionários, Jornada, RH, Mensagens Internas, TV, TV Comercial
      else if (normRole === 'RH') {
        const hasAccess = ['funcionarios', 'jornada', 'rh', 'mensagens', 'tv', 'tv-comercial'].includes(mod);
        map[role][mod] = {
          visualizar: hasAccess,
          criarEditar: hasAccess,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: false,
          configuracoes: false,
        };
      }
      // 12. SERVIÇOS GERAIS (Apoio Operacional) - 0 módulos
      else if (normRole === 'Serviços Gerais') {
        map[role][mod] = {
          visualizar: false,
          criarEditar: false,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: false,
          configuracoes: false,
        };
      }
      // Fallback
      else {
        const hasAccess = ['mensagens', 'tv', 'tv-comercial', 'tv-producao'].includes(mod);
        map[role][mod] = {
          visualizar: hasAccess,
          criarEditar: hasAccess,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: false,
          configuracoes: false,
        };
      }
    });
  });

  return map;
}

export function getPermissionsMap(): Record<string, Record<string, ModulePermissionRules>> {
  try {
    const stored = localStorage.getItem('subligestao_permissoes');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return syncAllRoleAliases(parsed);
      }
    }
  } catch {}

  const defaultMap = getDefaultPermissionsMap();
  try {
    const syncedDefaults = syncAllRoleAliases(defaultMap);
    localStorage.setItem('subligestao_permissoes', JSON.stringify(syncedDefaults));
    return syncedDefaults;
  } catch {}
  return defaultMap;
}

export const ROLE_ALIAS_GROUPS: string[][] = [
  ['ADMINISTRATIVO', 'Administrativo', 'Administração', 'administracao', 'Administracao', 'admin'],
  ['CONFERENCIA', 'Conferência', 'Conferencia'],
  ['IMPRESSÃO', 'Impressão', 'Impressao'],
  ['CALANDRA', 'Calandra'],
];

/**
 * Garante que todos os aliases de papéis idênticos (ex: 'ADMINISTRATIVO' e 'Administrativo')
 * compartilhem a mesmíssima matriz de permissões sem qualquer divergência.
 */
export function syncAllRoleAliases(
  map: Record<string, Record<string, ModulePermissionRules>>,
  preferredRole?: string
): Record<string, Record<string, ModulePermissionRules>> {
  if (!map || typeof map !== 'object') return {};
  const consolidatedMap: Record<string, Record<string, ModulePermissionRules>> = { ...map };

  for (const group of ROLE_ALIAS_GROUPS) {
    let sourceKey: string | undefined;

    if (preferredRole) {
      sourceKey = group.find((k) => k.toLowerCase() === preferredRole.toLowerCase() && consolidatedMap[k]);
    }

    if (!sourceKey) {
      sourceKey = group.find((k) => consolidatedMap[k] && Object.keys(consolidatedMap[k]).length > 0);
    }

    if (sourceKey && consolidatedMap[sourceKey]) {
      const sourceRules = consolidatedMap[sourceKey];
      for (const alias of group) {
        consolidatedMap[alias] = JSON.parse(JSON.stringify(sourceRules));
      }
    }
  }

  return consolidatedMap;
}

export function savePermissionsMap(map: Record<string, Record<string, ModulePermissionRules>>): void {
  try {
    const consolidatedMap = syncAllRoleAliases(map);

    localStorage.setItem('subligestao_permissoes', JSON.stringify(consolidatedMap));
    localStorage.setItem('subligestao_permissoes_version', PERMISSIONS_VERSION);

    // Persistência direta no Banco de Dados / Supabase
    ApiService.savePermissions(consolidatedMap).catch(() => {});

    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new Event('subligestao_permissions_updated'));
        window.dispatchEvent(new StorageEvent('storage', { key: 'subligestao_permissoes' }));
      }, 0);
    }
  } catch (err) {
    // Silent fallback to local storage
  }
}

/**
 * Sincroniza a matriz de permissões direto do Supabase/PostgreSQL com o cliente
 */
export async function syncPermissionsWithDatabase(): Promise<Record<string, Record<string, ModulePermissionRules>> | null> {
  try {
    const remoteData = await ApiService.getPermissions();
    if (remoteData && typeof remoteData === 'object' && Object.keys(remoteData).length > 0) {
      const consolidated = syncAllRoleAliases(remoteData);
      localStorage.setItem('subligestao_permissoes', JSON.stringify(consolidated));
      localStorage.setItem('subligestao_permissoes_version', PERMISSIONS_VERSION);
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new Event('subligestao_permissions_updated'));
          window.dispatchEvent(new StorageEvent('storage', { key: 'subligestao_permissoes' }));
        }, 0);
      }
      return consolidated;
    }
  } catch (err) {
    // Operando em contingência local
  }
  return null;
}

export function getRoleRulesFromMap(
  permissionsMap: Record<string, Record<string, ModulePermissionRules>>,
  role: string
): Record<string, ModulePermissionRules> | null {
  if (!permissionsMap || typeof permissionsMap !== 'object') return null;

  // 1. Direct match
  if (permissionsMap[role]) return permissionsMap[role];

  // 2. Normalized role match
  const normRole = normalizeRoleName(role);
  if (permissionsMap[normRole]) return permissionsMap[normRole];

  // 3. Search in alias groups (e.g. 'Administrativo' <-> 'ADMINISTRATIVO')
  for (const group of ROLE_ALIAS_GROUPS) {
    if (group.some((a) => a.toLowerCase() === role.toLowerCase() || a.toLowerCase() === normRole.toLowerCase())) {
      for (const a of group) {
        if (permissionsMap[a]) return permissionsMap[a];
      }
    }
  }

  // 4. Case-insensitive / normalized search across all saved keys
  const targetLower = role.toLowerCase().trim();
  const keys = Object.keys(permissionsMap);
  for (const k of keys) {
    if (k.toLowerCase().trim() === targetLower) return permissionsMap[k];
    if (normalizeRoleName(k) === normRole) return permissionsMap[k];
  }

  return null;
}

export function getModuleRule(
  roleRules: Record<string, ModulePermissionRules>,
  moduleIdOrMenuId: string
): ModulePermissionRules | null {
  if (!roleRules || typeof roleRules !== 'object') return null;

  if (roleRules[moduleIdOrMenuId]) return roleRules[moduleIdOrMenuId];

  const normModId = getErpModuleIdFromMenuId(moduleIdOrMenuId);
  if (roleRules[normModId]) return roleRules[normModId];

  // Check common aliases
  if (moduleIdOrMenuId === 'ordem-servico' || moduleIdOrMenuId === 'ordemServico') {
    return roleRules.ordemServico || roleRules['ordem-servico'] || null;
  }
  if (moduleIdOrMenuId === 'conferencia-os' || moduleIdOrMenuId === 'conferenciaOs') {
    return roleRules.conferenciaOs || roleRules['conferencia-os'] || null;
  }
  if (moduleIdOrMenuId === 'caixa-pdv' || moduleIdOrMenuId === 'pdv') {
    return roleRules.pdv || roleRules['caixa-pdv'] || null;
  }
  if (moduleIdOrMenuId === 'gerenciador-caixa' || moduleIdOrMenuId === 'gerenciadorCaixa') {
    return roleRules.gerenciadorCaixa || roleRules['gerenciador-caixa'] || null;
  }
  if (moduleIdOrMenuId === 'historico-os' || moduleIdOrMenuId === 'historicoOs') {
    return roleRules.historicoOs || roleRules['historico-os'] || null;
  }
  if (moduleIdOrMenuId === 'funcionarios' || moduleIdOrMenuId === 'colaboradores') {
    return roleRules.funcionarios || roleRules.colaboradores || null;
  }
  if (moduleIdOrMenuId === 'rh') {
    return roleRules.rh || null;
  }

  // Generic case-insensitive match
  const lowerMod = moduleIdOrMenuId.toLowerCase().trim();
  for (const k of Object.keys(roleRules)) {
    if (k.toLowerCase().trim() === lowerMod) return roleRules[k];
    if (getErpModuleIdFromMenuId(k) === normModId) return roleRules[k];
  }

  return null;
}

export function canUserAccessModule(role: string, moduleIdOrMenuId: string, isDeveloper?: boolean, localAtuacao?: string): boolean {
  if (isDeveloper) return true;
  if (!role || !localAtuacao) {
    try {
      const logged = getLoggedUserAndPerfil();
      if (logged.isDeveloper || logged.role.toLowerCase().includes('developer') || logged.role.toLowerCase().includes('desenvolvedor') || logged.role.toLowerCase().includes('adm master')) {
        return true;
      }
      if (!role) role = logged.role;
      if (!localAtuacao) localAtuacao = logged.localAtuacao;
    } catch {
      if (!role) return true;
    }
  }

  const normRole = normalizeRoleName(role);
  if (normRole === 'Developer' || normRole === 'ADM MASTER') return true;
  if (role.toLowerCase().includes('developer') || role.toLowerCase().includes('desenvolvedor') || role.toLowerCase().includes('adm master') || role.toLowerCase().includes('admin master')) return true;

  if (moduleIdOrMenuId === 'dev-dashboard') return false;
  if (moduleIdOrMenuId === 'backup') return isDeveloperOrAdminMaster(role, isDeveloper);

  // Perfil da Vendedora Shopee: acesso estrito aos 5 módulos solicitados
  if (isShopeeSellerProfile(role, localAtuacao) && !isDeveloper) {
    const shopeeAllowed = [
      'dashboard',
      'kanban',
      'ordem-servico-shopee',
      'ordemServicoShopee',
      'relatorios',
      'mensagens',
    ];
    return shopeeAllowed.includes(moduleIdOrMenuId);
  }

  const permissionsMap = getPermissionsMap();
  let roleRules = getRoleRulesFromMap(permissionsMap, role);

  if (!roleRules) {
    const defaultMap = getDefaultPermissionsMap();
    roleRules = getRoleRulesFromMap(defaultMap, role);
  }

  if (!roleRules) return false; // Fallback if completely unconfigured

  const modRule = getModuleRule(roleRules, moduleIdOrMenuId);
  if (!modRule) {
    // If not in current map, check default
    const defaultMap = getDefaultPermissionsMap();
    const defaultRoleRules = getRoleRulesFromMap(defaultMap, role);
    if (defaultRoleRules) {
      const defaultModRule = getModuleRule(defaultRoleRules, moduleIdOrMenuId);
      if (defaultModRule) return Boolean(defaultModRule.visualizar);
    }
    return false;
  }

  // Rigorously enforce marked permission: if visualizar is checked, access is permitted
  return Boolean(modRule.visualizar);
}

export function canUserPerformAction(
  role: string,
  moduleIdOrMenuId: string,
  action: keyof ModulePermissionRules,
  isDeveloper?: boolean
): boolean {
  // CRITICAL RULE: Developer ALWAYS has 100% full access to ALL actions in ALL modules without any RBAC restriction!
  if (isDeveloper) return true;
  if (!role) {
    try {
      const logged = getLoggedUserAndPerfil();
      if (logged.isDeveloper || logged.role.toLowerCase().includes('developer') || logged.role.toLowerCase().includes('desenvolvedor') || logged.role.toLowerCase().includes('adm master')) {
        return true;
      }
      role = logged.role;
    } catch {
      return false;
    }
  }

  const normRole = normalizeRoleName(role);
  if (
    normRole === 'Developer' ||
    normRole === 'ADM MASTER' ||
    normRole === 'CEO' ||
    normRole === 'Gerente Geral' ||
    normRole === 'Master'
  ) return true;
  if (
    role.toLowerCase().includes('developer') ||
    role.toLowerCase().includes('desenvolvedor') ||
    role.toLowerCase().includes('adm master') ||
    role.toLowerCase().includes('admin master') ||
    role.toLowerCase().includes('ceo') ||
    role.toLowerCase().includes('gerente geral')
  ) return true;

  // Permissão explícita de exclusão de filiais para perfis administrativos
  if ((moduleIdOrMenuId === 'filiais' || moduleIdOrMenuId === 'configuracoes') && action === 'excluir') {
    if (normRole === 'ADMINISTRATIVO' || normRole === 'Administrativo' || role.toLowerCase().includes('admin')) {
      return true;
    }
  }

  const permissionsMap = getPermissionsMap();
  let roleRules = getRoleRulesFromMap(permissionsMap, role);

  if (!roleRules) {
    const defaultMap = getDefaultPermissionsMap();
    roleRules = getRoleRulesFromMap(defaultMap, role);
  }

  if (!roleRules) return false;

  const modRule = getModuleRule(roleRules, moduleIdOrMenuId);
  if (!modRule) {
    const defaultMap = getDefaultPermissionsMap();
    const defaultRoleRules = getRoleRulesFromMap(defaultMap, role);
    if (defaultRoleRules) {
      const defaultModRule = getModuleRule(defaultRoleRules, moduleIdOrMenuId);
      if (defaultModRule) return Boolean(defaultModRule[action]);
    }
    return false;
  }

  return Boolean(modRule[action]);
}

/**
 * Check if the user has permission to rollback action in Kanban.
 * STRICT HIERARCHY RULE: ONLY DEVELOPER, CEO, GERENTE GERAL, and SUPERVISOR can rollback stage!
 */
export function canUserVoltarAcaoKanban(role?: string, isDeveloper?: boolean): boolean {
  if (isDeveloper) return true;
  if (!role) return false;
  const normRole = normalizeRoleName(role);
  if (normRole === 'Developer') return true;

  // Strict list: Only Developer, CEO, Gerente Geral, and Supervisor
  const allowedSuperiorRoles = ['Developer', 'CEO', 'Gerente Geral', 'Supervisor'];
  if (!allowedSuperiorRoles.includes(normRole)) {
    return false;
  }

  return canUserPerformAction(normRole, 'kanban', 'voltarAcao', isDeveloper);
}

/**
 * Check if current logged user is authorized for OS Edição / Caixa.
 */
export function isUserAuthorizedForOs(osOperator?: string): boolean {
  try {
    const { name, role, isDeveloper } = getLoggedUserAndPerfil();
    if (isDeveloper) return true;

    const currentName = name.trim().toLowerCase();
    const creatorName = (osOperator || '').trim().toLowerCase();
    if (creatorName && currentName && creatorName === currentName) {
      return true;
    }

    return canUserPerformAction(role, 'ordemServico', 'criarEditar', isDeveloper);
  } catch {}
  return true;
}

/**
 * Verifica se o usuário atual é o criador/vendedor responsável pelo Orçamento.
 */
export function isUserCreatorOfOrc(
  orc?: { operador?: string; vendedorNome?: string; createdBy?: string } | null,
  currentUserName?: string,
  loggedOp?: string,
  currentUsername?: string
): boolean {
  if (!orc) return false;
  const norm = (str?: string) => (str || '').trim().toLowerCase();
  
  let cName = norm(currentUserName);
  let cOp = norm(loggedOp);
  let cUser = norm(currentUsername);

  if (!cName && !cOp && !cUser) {
    try {
      const logged = getLoggedUserAndPerfil();
      cName = norm(logged.name);
      cUser = norm(logged.username);
    } catch {}
  }

  const orcOp = norm(orc.operador);
  const orcVend = norm(orc.vendedorNome);
  const orcCreated = norm(orc.createdBy);

  const checkMatch = (target: string) => {
    if (!target) return false;
    if (cName && (target === cName || target.includes(cName) || cName.includes(target))) return true;
    if (cOp && (target === cOp || target.includes(cOp) || cOp.includes(target))) return true;
    if (cUser && (target === cUser || target.includes(cUser) || cUser.includes(target))) return true;
    return false;
  };

  return checkMatch(orcOp) || checkMatch(orcVend) || checkMatch(orcCreated);
}

export interface InitialModuleInfo {
  menuId: string;
  menuTitle: string;
}

/**
 * Ordem canônica do Menu Lateral do Sistema (Sidebar)
 */
export const SIDEBAR_MENU_ORDER: { id: string; label: string }[] = [
  { id: 'dev-dashboard', label: 'Dashboard Técnico & Servidor' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tv', label: 'TV' },
  { id: 'tv-comercial', label: 'Dashboard Comercial' },
  { id: 'tv-producao', label: 'Dashboard de Produção' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'kanban', label: 'Fluxo de produção (kanbam)' },
  { id: 'ordem-servico', label: 'Ordem de serviço' },
  { id: 'ordem-servico-shopee', label: 'ORDEM DE SERVIÇO SHOPEE' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'produtos-venda', label: 'Produtos de Venda' },
  { id: 'funcionarios', label: 'Funcionários' },
  { id: 'jornada', label: 'Jornada' },
  { id: 'conferencia-os', label: 'Conferência de OS' },
  { id: 'controle-expedicao', label: 'Controle de Expedição' },
  { id: 'entrega-devolucao', label: 'Entrega & Devolução' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'azulzinha', label: 'AZULZINHA' },
  { id: 'gerenciador-caixa', label: 'Gerenciador CAIXA' },
  { id: 'notas-fiscais', label: 'Notas Fiscais (NF-e)' },
  { id: 'gerenciador-notas-fiscais', label: 'Gerenciador de Notas Fiscais' },
  { id: 'waleads', label: 'WALEADS' },
  { id: 'rh', label: 'RH' },
  { id: 'historico-os', label: 'Histórico de OS' },
  { id: 'mensagens', label: 'Mensagens internas' },
  { id: 'caixa-pdv', label: 'PDV' },
  { id: 'configuracoes', label: 'Configurações' },
  { id: 'filiais', label: 'Filiais da Empresa' },
];

/**
 * Retorna o módulo inicial para o usuário:
 * - Se Developer: "dev-dashboard"
 * - Se tiver permissão de Dashboard marcada nas configurações: "dashboard"
 * - Se NÃO tiver permissão de Dashboard: o PRIMEIRO módulo do menu lateral marcado no perfil
 */
export function getDefaultModuleForUser(role?: string, isDeveloper?: boolean, localAtuacao?: string): InitialModuleInfo {
  if (isDeveloper) {
    return { menuId: 'dev-dashboard', menuTitle: 'Dashboard Técnico & Servidor' };
  }

  const userRole = role || '';

  const normRole = normalizeRoleName(userRole);
  if (normRole === 'Expedição') {
    if (canUserAccessModule(userRole, 'controle-expedicao', isDeveloper, localAtuacao)) {
      return { menuId: 'controle-expedicao', menuTitle: 'Controle de Expedição' };
    }
  }

  // 1. Se tem permissão de visualização do Dashboard marcada no perfil
  if (canUserAccessModule(userRole, 'dashboard', isDeveloper, localAtuacao)) {
    return { menuId: 'dashboard', menuTitle: 'Dashboard' };
  }

  // 2. Se NÃO tem permissão de Dashboard, busca o PRIMEIRO módulo do menu lateral com permissão marcada
  for (const item of SIDEBAR_MENU_ORDER) {
    if (item.id === 'dev-dashboard' || item.id === 'dashboard') continue;
    if (canUserAccessModule(userRole, item.id, isDeveloper, localAtuacao)) {
      return { menuId: item.id, menuTitle: item.label };
    }
  }

  // 3. Fallback seguro
  return { menuId: 'mensagens', menuTitle: 'Mensagens internas' };
}

/**
 * Helper to build an OS History Entry
 */
export function createOsHistoryEntry(acao: string, detalhes?: string): OsHistoryEntry {
  const { name, role } = getLoggedUserAndPerfil();
  const now = new Date();
  const dataFormatted = now.toLocaleDateString('pt-BR');
  const horaFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dataHora = `${dataFormatted} às ${horaFormatted}`;

  return {
    id: `HST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    dataHora,
    usuario: name,
    perfil: role,
    acao,
    detalhes,
  };
}

/**
 * Helper to filter out generic "editou dados da Ordem de Serviço" entries with no details or meaningful content.
 * Regra: Não exibir "editou dados da Ordem de Serviço" quando estiver "Sem detalhes adicionais" ou vazio.
 * Apenas exibir caso modifique algo em "editar" no módulo "Gestão Integrada de Ordem de Serviço" após a OS ter sido criada.
 */
export function shouldDisplayHistoryEntry(log?: OsHistoryEntry | null): boolean {
  if (!log) return false;
  const acaoLower = (log.acao || '').toLowerCase().trim();
  const isGenericEdit = acaoLower.includes('editou dados da ordem de serviço') || acaoLower.includes('editou dados da os');
  if (isGenericEdit) {
    const details = (log.detalhes || '').trim();
    if (!details || details === 'Sem detalhes adicionais' || details === 'Edição realizada via painel.' || details === 'Nenhum detalhe') {
      return false;
    }
  }
  return true;
}

export function filterVisibleHistory(history?: OsHistoryEntry[] | null): OsHistoryEntry[] {
  if (!Array.isArray(history)) return [];
  return history.filter(shouldDisplayHistoryEntry);
}

