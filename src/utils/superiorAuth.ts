/**
 * ERP SubliGestão - Módulo de Hierarquia de Poder & Autenticação de Superiores
 *
 * HIERARQUIA RIGOROSA DE SUPERIORES:
 * 0. DEVELOPER (Acesso Total e Irrestrito)
 * 1. CEO
 * 2. GERENTE GERAL
 * 3. SUPERVISOR
 *
 * REGRAS DE HIERARQUIA & EXCLUSÃO:
 * - Toda ação que exigir senha (exceto login) exige senha de um dos Superiores: DEVELOPER, CEO, GERENTE GERAL ou SUPERVISOR.
 * - SUPERVISOR NÃO PODE EXCLUIR GERENTE (Requer Gerente Geral, CEO ou Developer).
 * - GERENTE NÃO PODE EXCLUIR CEO (Requer CEO ou Developer).
 * - SUPERVISOR NÃO PODE EXCLUIR CEO (Requer Developer).
 * - DEVELOPER TEM ACESSO TOTAL E IRRESTRITO.
 */

import { ApiService } from '../services/api';

export type SuperiorRole = 'DEVELOPER' | 'CEO' | 'GERENTE GERAL' | 'SUPERVISOR' | 'OPERACIONAL';

export const SUPERIOR_RANKS = {
  DEVELOPER: 0,
  CEO: 1,
  GERENTE_GERAL: 2,
  SUPERVISOR: 3,
  OUTROS: 99,
} as const;

/**
 * Retorna o nível hierárquico numérico do cargo (0 a 3 para superiores, 99 para outros).
 */
export function getSuperiorHierarchyRank(roleOrCargo?: string, isDeveloper?: boolean): number {
  if (isDeveloper) return SUPERIOR_RANKS.DEVELOPER;
  if (!roleOrCargo) return SUPERIOR_RANKS.OUTROS;

  const clean = roleOrCargo.toLowerCase().trim();

  // Nível 0: Developer
  if (
    clean === 'developer' ||
    clean.includes('developer') ||
    clean.includes('desenvolvedor') ||
    clean.includes('@marcelo-dev')
  ) {
    return SUPERIOR_RANKS.DEVELOPER;
  }

  // Nível 1: CEO & Diretoria Executiva
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
    return SUPERIOR_RANKS.CEO;
  }

  // Nível 2: Gerente Geral / Gerência / Admin Master
  if (
    clean.includes('gerente') ||
    clean.includes('admin master') ||
    clean.includes('administrador') ||
    clean.includes('administrativo')
  ) {
    return SUPERIOR_RANKS.GERENTE_GERAL;
  }

  // Nível 3: Supervisor & Coordenação
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
    return SUPERIOR_RANKS.SUPERVISOR;
  }

  return SUPERIOR_RANKS.OUTROS;
}

/**
 * Retorna o nome amigável do nível de superior.
 */
export function getSuperiorRoleLabel(roleOrCargo?: string, isDeveloper?: boolean): SuperiorRole {
  const rank = getSuperiorHierarchyRank(roleOrCargo, isDeveloper);
  switch (rank) {
    case SUPERIOR_RANKS.DEVELOPER:
      return 'DEVELOPER';
    case SUPERIOR_RANKS.CEO:
      return 'CEO';
    case SUPERIOR_RANKS.GERENTE_GERAL:
      return 'GERENTE GERAL';
    case SUPERIOR_RANKS.SUPERVISOR:
      return 'SUPERVISOR';
    default:
      return 'OPERACIONAL';
  }
}

/**
 * Verifica se um cargo/perfil pertence aos Superiores (Developer, CEO, Gerente Geral, Supervisor).
 */
export function isSuperiorUser(roleOrCargo?: string, isDeveloper?: boolean): boolean {
  const rank = getSuperiorHierarchyRank(roleOrCargo, isDeveloper);
  return rank <= SUPERIOR_RANKS.SUPERVISOR;
}

/**
 * Valida se um Superior com `superiorRank` possui autoridade hierárquica para excluir um funcionário com `targetRoleOrCargo`.
 * Regras:
 * - Developer (rank 0): Total e irrestrito.
 * - Gerente (rank 2) NÃO PODE excluir CEO (rank 1).
 * - Supervisor (rank 3) NÃO PODE excluir Gerente (rank 2) nem CEO (rank 1).
 * - Ninguém além do Developer pode excluir Developer.
 */
export function canSuperiorDeleteTarget(
  superiorRank: number,
  targetRoleOrCargo?: string
): { allowed: boolean; reason?: string } {
  const targetRank = getSuperiorHierarchyRank(targetRoleOrCargo);

  // 1. Developer tem acesso total e irrestrito
  if (superiorRank === SUPERIOR_RANKS.DEVELOPER) {
    return { allowed: true };
  }

  // 2. Ação sobre Developer (rank 0)
  if (targetRank === SUPERIOR_RANKS.DEVELOPER) {
    return {
      allowed: false,
      reason: 'Hierarquia de Poder: Apenas o Desenvolvedor possui permissão para autorizar ações sobre o perfil de Developer.',
    };
  }

  // 3. Ação sobre CEO (rank 1)
  if (targetRank === SUPERIOR_RANKS.CEO) {
    if (superiorRank === SUPERIOR_RANKS.GERENTE_GERAL) {
      return {
        allowed: false,
        reason: 'Hierarquia de Poder: Gerente Geral não possui autorização para excluir um CEO. É necessária a senha do Desenvolvedor.',
      };
    }
    if (superiorRank === SUPERIOR_RANKS.SUPERVISOR) {
      return {
        allowed: false,
        reason: 'Hierarquia de Poder: Supervisor não possui autorização para excluir um CEO. É necessária a senha do Desenvolvedor.',
      };
    }
    if (superiorRank > SUPERIOR_RANKS.SUPERVISOR) {
      return {
        allowed: false,
        reason: 'Acesso Negado: Apenas Superiores autorizados podem realizar esta operação.',
      };
    }
  }

  // 4. Ação sobre Gerente Geral / Gerente (rank 2)
  if (targetRank === SUPERIOR_RANKS.GERENTE_GERAL) {
    if (superiorRank === SUPERIOR_RANKS.SUPERVISOR) {
      return {
        allowed: false,
        reason: 'Hierarquia de Poder: Supervisor não possui autorização para excluir um Gerente. É necessária a senha do Gerente Geral, CEO ou Desenvolvedor.',
      };
    }
    if (superiorRank > SUPERIOR_RANKS.SUPERVISOR) {
      return {
        allowed: false,
        reason: 'Acesso Negado: Apenas Superiores autorizados podem realizar esta operação.',
      };
    }
  }

  // 5. Demais casos (Supervisor, Operacional, Vendedor, Recepção, Estoque, etc.)
  if (superiorRank <= SUPERIOR_RANKS.SUPERVISOR) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Apenas senhas de Superiores (Developer, CEO, Gerente Geral ou Supervisor) são autorizadas.',
  };
}

export interface SuperiorVerificationResult {
  valid: boolean;
  error?: string;
  superiorRole?: SuperiorRole;
  superiorName?: string;
  rank?: number;
  isDeveloper?: boolean;
}

/**
 * Validação local de senha de Superior contra os dados em cache / perfil ativo (fallback offline seguro).
 */
export function verifySuperiorPasswordLocally(
  password: string,
  targetRoleToOperate?: string
): SuperiorVerificationResult {
  const trimmed = password.trim();
  if (!trimmed) {
    return { valid: false, error: 'Senha não informada.' };
  }

  // 1. Busca na lista de funcionários em cache
  try {
    const cachedEmps = localStorage.getItem('subligestao_employees_cache');
    if (cachedEmps) {
      const list = JSON.parse(cachedEmps);
      if (Array.isArray(list)) {
        const matchedEmp = list.find(
          (emp: any) => emp.temLogin && emp.loginSenha === trimmed
        );
        if (matchedEmp) {
          const empRank = getSuperiorHierarchyRank(matchedEmp.cargo, matchedEmp.isDeveloperInvisible);
          if (empRank > SUPERIOR_RANKS.SUPERVISOR) {
            return {
              valid: false,
              error: 'VOCÊ NÃO TEM AUTORIZAÇÃO PARA ESSE RECURSO',
            };
          }

          // Se for exclusão de funcionário, verifica a hierarquia
          if (targetRoleToOperate) {
            const check = canSuperiorDeleteTarget(empRank, targetRoleToOperate);
            if (!check.allowed) {
              return { valid: false, error: check.reason };
            }
          }

          return {
            valid: true,
            superiorRole: getSuperiorRoleLabel(matchedEmp.cargo, matchedEmp.isDeveloperInvisible),
            superiorName: matchedEmp.nome,
            rank: empRank,
            isDeveloper: empRank === SUPERIOR_RANKS.DEVELOPER,
          };
        }
      }
    }
  } catch {}

  // 3. Busca no usuário ativo local
  try {
    const storedUser = localStorage.getItem('subligestao_user_profile') || localStorage.getItem('subligestao_user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      if (u?.loginSenha === trimmed || u?.password === trimmed) {
        const uRank = getSuperiorHierarchyRank(u.role || u.perfil || u.cargo, u.isDeveloperInvisible);
        if (uRank > SUPERIOR_RANKS.SUPERVISOR) {
          return {
            valid: false,
            error: 'VOCÊ NÃO TEM AUTORIZAÇÃO PARA ESSE RECURSO',
          };
        }

        if (targetRoleToOperate) {
          const check = canSuperiorDeleteTarget(uRank, targetRoleToOperate);
          if (!check.allowed) {
            return { valid: false, error: check.reason };
          }
        }

        return {
          valid: true,
          superiorRole: getSuperiorRoleLabel(u.role || u.perfil || u.cargo, u.isDeveloperInvisible),
          superiorName: u.name || u.username,
          rank: uRank,
          isDeveloper: uRank === SUPERIOR_RANKS.DEVELOPER,
        };
      }
    }
  } catch {}

  return {
    valid: false,
    error: 'Senha incorreta! Não foi possível autenticar nenhum Superior autorizado.',
  };
}

/**
 * Validação completa e unificada de senha de Superior (Back-end com fallback local).
 * Toda ação que exige senha deve chamar esta função.
 */
export async function verifySuperiorPassword(
  password: string,
  options?: {
    targetRole?: string;
    loggedUsername?: string;
    actionDescription?: string;
  }
): Promise<SuperiorVerificationResult> {
  const trimmed = password.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Por favor, informe a senha de acesso de um Superior para autorizar a operação.',
    };
  }

  // 1. Chamada à API de verificação no Back-end
  try {
    const res = await ApiService.verifyPassword(trimmed, options?.loggedUsername, options?.targetRole);
    if (res && res.valid) {
      const superiorRole = (res.superiorRole as SuperiorRole) || 'SUPERVISOR';
      const rank = res.rank !== undefined ? res.rank : getSuperiorHierarchyRank(superiorRole);

      // Validação final de hierarquia caso alvo tenha sido informado
      if (options?.targetRole) {
        const check = canSuperiorDeleteTarget(rank, options.targetRole);
        if (!check.allowed) {
          return { valid: false, error: check.reason };
        }
      }

      return {
        valid: true,
        superiorRole,
        superiorName: res.superiorName || 'Superior Autorizado',
        rank,
        isDeveloper: rank === SUPERIOR_RANKS.DEVELOPER,
      };
    } else if (res && !res.valid && res.message) {
      // Se o servidor retornou erro explícito de superior/hierarquia, propaga
      if (res.message.includes('Superior') || res.message.includes('Hierarquia') || res.message.includes('permissão')) {
        return { valid: false, error: res.message };
      }
    }
  } catch {
    // Falha de rede ou rota: segue para o validador local de fallback
  }

  // 3. Fallback Local com as regras estritas de hierarquia
  return verifySuperiorPasswordLocally(trimmed, options?.targetRole);
}

export interface OsEditVerificationResult {
  valid: boolean;
  error?: string;
  authorizedName?: string;
  authorizedRole?: string;
  isDeveloper?: boolean;
  isResponsible?: boolean;
  isDirecao?: boolean;
}

/**
 * Validação de senha para edição de Ordem de Serviço.
 * Requisitos:
 * - Cada responsável pela OS terá sua senha autorizada.
 * - Alguém da Direção também terá sua senha autorizada.
 * - Se não for o responsável nem da direção que colocou a senha, informa que a senha está incorreta.
 */
export async function verifyOsEditPassword(
  password: string,
  os: {
    operador?: string;
    vendedorNome?: string;
    createdBy?: string;
    codigo?: string;
  }
): Promise<OsEditVerificationResult> {
  const trimmed = password.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Por favor, digite a sua senha de autorização.',
    };
  }

  const responsibleName = os.operador || os.vendedorNome || os.createdBy || 'Responsável';

  // 1. Tenta validação no Back-end
  try {
    const res = await ApiService.verifyOsEditPassword(trimmed, {
      osOperator: os.operador,
      osVendedor: os.vendedorNome,
      osCodigo: os.codigo,
    });

    if (res && res.valid) {
      return {
        valid: true,
        authorizedName: res.authorizedName || 'Usuário Autorizado',
        authorizedRole: res.authorizedRole || 'AUTORIZADO',
        isDeveloper: !!res.isDeveloper,
        isResponsible: !!res.isResponsible,
        isDirecao: !!res.isDirecao,
      };
    } else if (res && !res.valid) {
      return {
        valid: false,
        error: res.error || res.message || `Senha incorreta! Apenas a senha do responsável (${responsibleName}) ou da Direção pode autorizar a edição.`,
      };
    }
  } catch {
    // Falha de rede: segue para o validador local de fallback
  }

  // 2. Fallback Local
  return verifyOsEditPasswordLocally(trimmed, os);
}

export function verifyOsEditPasswordLocally(
  password: string,
  os: {
    operador?: string;
    vendedorNome?: string;
    createdBy?: string;
    codigo?: string;
  }
): OsEditVerificationResult {
  const trimmed = password.trim();
  if (!trimmed) {
    return { valid: false, error: 'Por favor, digite a sua senha de autorização.' };
  }

  const norm = (str?: string) => (str || '').trim().toLowerCase();
  const targetOp = norm(os.operador);
  const targetVend = norm(os.vendedorNome);
  const targetCreated = norm(os.createdBy);

  const isResponsibleMatch = (name?: string, username?: string, email?: string): boolean => {
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
    return matches(targetOp) || matches(targetVend) || matches(targetCreated);
  };

  const isDirecao = (role?: string, isDev?: boolean): boolean => {
    if (isDev) return true;
    if (!role) return false;
    const lower = role.toLowerCase().trim();
    if (lower.includes('developer') || lower.includes('desenvolvedor') || lower === 'dev') return true;
    if (lower.includes('ceo') || lower.includes('diretoria') || lower.includes('diretor') || lower.includes('presidente') || lower.includes('sócio') || lower.includes('socio')) return true;
    if (lower.includes('gerente') || lower.includes('admin master') || lower.includes('administrador') || lower.includes('administrativo')) return true;
    if (lower.includes('supervisor') || lower.includes('supervisora') || lower.includes('supervivor') || lower.includes('supervisão') || lower.includes('supervisao') || lower.includes('coordenador') || lower.includes('coordenadora')) return true;
    return false;
  };

  // A. Checar cache de funcionários
  try {
    const cachedEmps = localStorage.getItem('subligestao_employees_cache');
    if (cachedEmps) {
      const list = JSON.parse(cachedEmps);
      if (Array.isArray(list)) {
        const matchedEmp = list.find((emp: any) => emp.temLogin && emp.loginSenha === trimmed);
        if (matchedEmp) {
          const dir = isDirecao(matchedEmp.cargo, matchedEmp.isDeveloperInvisible);
          const resp = isResponsibleMatch(matchedEmp.nome, undefined, matchedEmp.email);

          if (dir || resp) {
            return {
              valid: true,
              authorizedName: matchedEmp.nome,
              authorizedRole: matchedEmp.cargo || (dir ? 'DIREÇÃO' : 'RESPONSÁVEL'),
              isDeveloper: !!matchedEmp.isDeveloperInvisible,
              isResponsible: resp,
              isDirecao: dir,
            };
          } else {
            return {
              valid: false,
              error: `Senha incorreta! Esta senha pertence a ${matchedEmp.nome}, que não é o responsável pela OS nem membro da Direção.`,
            };
          }
        }
      }
    }
  } catch {}

  // B. Checar usuário ativo local
  try {
    const storedUser = localStorage.getItem('subligestao_user_profile') || localStorage.getItem('subligestao_user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      if (u?.loginSenha === trimmed || u?.password === trimmed) {
        const dir = isDirecao(u.role || u.perfil || u.cargo, u.isDeveloperInvisible);
        const resp = isResponsibleMatch(u.name, u.username, u.email);

        if (dir || resp) {
          return {
            valid: true,
            authorizedName: u.name || 'Usuário Ativo',
            authorizedRole: u.role || u.perfil || u.cargo || (dir ? 'DIREÇÃO' : 'RESPONSÁVEL'),
            isDeveloper: !!u.isDeveloperInvisible,
            isResponsible: resp,
            isDirecao: dir,
          };
        } else {
          return {
            valid: false,
            error: `Senha incorreta! Esta senha pertence a ${u.name || 'outro usuário'}, que não é o responsável pela OS nem membro da Direção.`,
          };
        }
      }
    }
  } catch {}

  return {
    valid: false,
    error: 'Senha incorreta!',
  };
}
