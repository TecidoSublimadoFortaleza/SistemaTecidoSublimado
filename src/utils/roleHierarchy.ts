import { ChatContact } from '../types/chat';

export interface RoleHierarchyCategory {
  rank: number;
  label: string;
  badgeClass: string;
}

export function getRoleHierarchyRank(roleName?: string): number {
  if (!roleName) return 99;
  const clean = roleName.toLowerCase().trim();

  // Nível 0: Desenvolvedor / Dev
  if (clean.includes('dev') || clean.includes('desenvolvedor')) {
    return 0;
  }

  // Nível 1: Diretoria & Sócios (CEO, Presidente, Diretores)
  if (
    clean.includes('ceo') ||
    clean.includes('presidente') ||
    clean.includes('diretor') ||
    clean.includes('diretora') ||
    clean.includes('diretoria') ||
    clean.includes('sócio') ||
    clean.includes('socio')
  ) {
    return 1;
  }

  // Nível 2: Gerência (Gerente Geral, Gerentes de Setor)
  if (clean.includes('gerente')) {
    return 2;
  }

  // Nível 3: Supervisão & Coordenação (Supervisores, Coordenadores, Monitores)
  if (
    clean.includes('supervisor') ||
    clean.includes('supervisora') ||
    clean.includes('coordenador') ||
    clean.includes('coordenadora') ||
    clean.includes('monitor') ||
    clean.includes('monitora')
  ) {
    return 3;
  }

  // Nível 4: Especialistas, Administrativo, Comercial, Expedição, Estoque, Designers
  if (
    clean.includes('administra') ||
    clean.includes('expedição') ||
    clean.includes('expedicao') ||
    clean.includes('logística') ||
    clean.includes('logistica') ||
    clean.includes('estoque') ||
    clean.includes('almoxarifado') ||
    clean.includes('designer') ||
    clean.includes('vendedor') ||
    clean.includes('vendedora') ||
    clean.includes('comercial') ||
    clean.includes('recep') ||
    clean.includes('atendimento') ||
    clean.includes('financeiro') ||
    clean.includes('compras')
  ) {
    return 4;
  }

  // Nível 5: Produção & Operacional (Impressão, Calandra, Costura, Embalagem, Conferência, Operadores)
  if (
    clean.includes('impress') ||
    clean.includes('calandra') ||
    clean.includes('costura') ||
    clean.includes('costureir') ||
    clean.includes('embal') ||
    clean.includes('empacot') ||
    clean.includes('produç') ||
    clean.includes('operad') ||
    clean.includes('corte') ||
    clean.startsWith('op.') ||
    clean.includes('máquina') ||
    clean.includes('maquina') ||
    clean.includes('auxiliar') ||
    clean.includes('assistente')
  ) {
    return 5;
  }

  return 6;
}

export function getRoleCategoryLabel(roleName?: string): string {
  const rank = getRoleHierarchyRank(roleName);
  switch (rank) {
    case 0:
      return 'Tecnologia / Developer';
    case 1:
      return 'Diretoria & Presidência';
    case 2:
      return 'Gerência Geral & Setorial';
    case 3:
      return 'Supervisão & Coordenação';
    case 4:
      return 'Administrativo & Especialistas';
    case 5:
      return 'Produção & Operacional';
    default:
      return 'Colaboradores';
  }
}

export function getRoleBadgeStyle(roleName?: string): { bg: string; text: string; border: string } {
  const rank = getRoleHierarchyRank(roleName);
  switch (rank) {
    case 0:
      return { bg: 'bg-cyan-950/60', text: 'text-cyan-400', border: 'border-cyan-500/40' };
    case 1:
      return { bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-500/40' };
    case 2:
      return { bg: 'bg-purple-950/60', text: 'text-purple-300', border: 'border-purple-500/40' };
    case 3:
      return { bg: 'bg-blue-950/60', text: 'text-blue-300', border: 'border-blue-500/40' };
    case 4:
      return { bg: 'bg-emerald-950/60', text: 'text-emerald-300', border: 'border-emerald-500/40' };
    case 5:
      return { bg: 'bg-slate-800/60', text: 'text-slate-300', border: 'border-slate-700' };
    default:
      return { bg: 'bg-slate-800/60', text: 'text-slate-300', border: 'border-slate-700' };
  }
}

export function sortContactsByHierarchy(contacts: ChatContact[]): ChatContact[] {
  return [...contacts].sort((a, b) => {
    const rankA = getRoleHierarchyRank(a.role);
    const rankB = getRoleHierarchyRank(b.role);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.name.localeCompare(b.name);
  });
}
