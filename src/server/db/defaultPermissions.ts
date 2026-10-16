export interface SystemModulePermissionRules {
  visualizar: boolean;
  criarEditar: boolean;
  excluir: boolean;
  descontoEspecial: boolean;
  voltarAcao?: boolean;
  verFinanceiro: boolean;
  configuracoes: boolean;
}

export const SYSTEM_MODULES = [
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

export const SYSTEM_ROLES = [
  'Developer',
  'ADM MASTER',
  'ADM SISTEMA',
  'ADMINISTRADOR',
  'CEO',
  'Gerente Geral',
  'Administrativo',
  'ADMINISTRATIVO',
  'Administração',
  'Supervisor',
  'Monitor',
  'Vendedor(a)',
  'Vendedora Shopee',
  'Recepção',
  'Estoque',
  'Conferência',
  'CONFERENCIA',
  'Designer',
  'Impressão',
  'IMPRESSÃO',
  'Calandra',
  'CALANDRA',
  'Costura',
  'Op. Máquina de corte',
  'Operador',
  'Expedição',
  'LOGISTICA',
  'RH',
  'Serviços Gerais',
];

export function normalizeSystemRole(role: string): string {
  if (!role) return '';
  const r = role.trim();
  const lower = r.toLowerCase();
  if (lower === 'adm master' || lower === 'admin master' || lower === 'administrador master') return 'ADM MASTER';
  if (lower === 'developer' || lower === 'desenvolvedor') return 'Developer';
  if (lower === 'ceo') return 'CEO';
  if (lower === 'gerente geral') return 'Gerente Geral';
  if (lower === 'administrativo' || lower === 'administração' || lower === 'administracao') return 'ADMINISTRATIVO';
  if (lower === 'supervisor') return 'Supervisor';
  if (lower === 'monitor') return 'Monitor';
  if (lower.includes('shopee')) return 'Vendedora Shopee';
  if (lower === 'vendedor(a)' || lower === 'vendedora' || lower === 'vendedor') return 'Vendedor(a)';
  if (lower === 'recepção' || lower === 'recepcao') return 'Recepção';
  if (lower === 'estoque') return 'Estoque';
  if (lower === 'conferência' || lower === 'conferencia') return 'Conferência';
  if (lower === 'impressão' || lower === 'impressao') return 'Impressão';
  if (lower === 'calandra') return 'Calandra';
  if (lower === 'expedição' || lower === 'expedicao') return 'Expedição';
  if (lower === 'serviços gerais' || lower === 'servicos gerais') return 'Serviços Gerais';
  return r;
}

export function getDefaultSystemPermissions(): Record<string, Record<string, SystemModulePermissionRules>> {
  try {
    const fs = require('fs');
    const path = require('path');
    const officialPath = path.resolve(__dirname, 'officialPermissionsData.json');
    if (fs.existsSync(officialPath)) {
      const content = fs.readFileSync(officialPath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch (_) {}

  const map: Record<string, Record<string, SystemModulePermissionRules>> = {};

  SYSTEM_ROLES.forEach((role) => {
    map[role] = {};
    const norm = normalizeSystemRole(role);

    SYSTEM_MODULES.forEach((mod) => {
      // 1. Liderança e TI
      if (
        norm === 'Developer' ||
        norm === 'ADM MASTER' ||
        norm === 'ADM SISTEMA' ||
        norm === 'ADMINISTRADOR' ||
        norm === 'CEO' ||
        norm === 'Gerente Geral'
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
      // 2. ADMINISTRATIVO (Gestão Corporativa) - 9 módulos: Funcionários, Jornada, Relatórios, Azulzinha, Gerenciador CAIXA, RH, Mensagens Internas, Notas Fiscais (NF-e), Gerenciador de Notas Fiscais
      else if (norm === 'ADMINISTRATIVO') {
        const hasAccess = [
          'funcionarios', 'jornada', 'relatorios', 'azulzinha',
          'gerenciadorCaixa', 'rh', 'mensagens', 'notasFiscais',
          'gerenciadorNotasFiscais'
        ].includes(mod);
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
      // 3. Supervisor (Liderança Tática) - Dashboard, Dashboard Comercial, Clientes, Kanban (Fluxo de produção), Orçamento, Ordem de Serviço, Estoque, Produtos de Venda, Relatórios, Histórico de OS, Mensagens Internas, Notas Fiscais e Gerenciador de Notas Fiscais
      else if (norm === 'Supervisor') {
        const hasAccess = [
          'dashboard', 'tv-comercial', 'clientes', 'kanban',
          'orcamento', 'ordemServico', 'estoque', 'produtos-venda', 'relatorios',
          'historicoOs', 'mensagens', 'notasFiscais', 'gerenciadorNotasFiscais'
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
      // 4. Vendedor(a) (Comercial & Balcão) - Dashboard, Clientes, Kanban (Fluxo de produção), Orçamento, Ordem de Serviço, Produtos de Venda, Histórico de OS, Mensagens Internas, Notas Fiscais, Gerenciador de Notas Fiscais
      else if (norm === 'Vendedor(a)') {
        const hasAccess = [
          'dashboard', 'clientes', 'kanban', 'orcamento',
          'ordemServico', 'produtos-venda', 'historicoOs', 'mensagens', 'notasFiscais',
          'gerenciadorNotasFiscais'
        ].includes(mod);
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
      // 5. Vendedora Shopee (Marketplace) - 6 módulos restritos: Dashboard, Kanban (Fluxo de produção), Orçamento, Ordem de Serviço Shopee, Histórico de OS e Mensagens Internas
      else if (norm === 'Vendedora Shopee') {
        const hasAccess = [
          'dashboard', 'kanban', 'orcamento', 'ordemServicoShopee',
          'historicoOs', 'mensagens'
        ].includes(mod);
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
      // 6. Recepção (Atendimento Presencial) - 11 módulos: Dashboard, Clientes, Kanban (Fluxo de produção), Orçamento, Ordem de Serviço, Entrega & Devolução, Histórico de OS, Mensagens Internas, PDV (Caixa), Notas Fiscais e Gerenciador de Notas Fiscais
      else if (norm === 'Recepção') {
        const hasAccess = [
          'dashboard', 'clientes', 'kanban', 'orcamento',
          'ordemServico', 'entrega-devolucao', 'historicoOs', 'mensagens',
          'pdv', 'notasFiscais', 'gerenciadorNotasFiscais'
        ].includes(mod);
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
      // 7. Monitor (Auditoria de Qualidade) - 4 módulos: Kanban (Fluxo de produção), Conferência de OS, Controle de Expedição e Mensagens Internas
      else if (norm === 'Monitor') {
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
      // 8. Setores Produtivos Têxteis: Designer, IMPRESSÃO, CALANDRA e Costura - 2 módulos cada: Kanban (Fluxo de produção) e Mensagens Internas
      else if (['Designer', 'Impressão', 'Calandra', 'Costura', 'Op. Máquina de corte', 'Operador'].includes(norm)) {
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
      // 9. Estoque (Materiais e Insumos) - Estoque, Produtos de Venda e Mensagens Internas
      else if (norm === 'Estoque') {
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
      // 10. CONFERÊNCIA (Inspeção de Saída e Embalagem) - 4 módulos: Kanban, Conferência de OS, Histórico de OS e Mensagens Internas
      else if (norm === 'Conferência') {
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
      // Expedição e Logística - 3 módulos: Kanban, Controle de Expedição, Mensagens Internas
      else if (norm === 'Expedição' || norm === 'LOGISTICA') {
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
      // 11. RH (Recursos Humanos & DP) - 6 módulos: Funcionários, Jornada, RH, Mensagens Internas, TV e TV Comercial
      else if (norm === 'RH') {
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
      // 12. Serviços Gerais (Apoio Operacional) - 0 módulos
      else if (norm === 'Serviços Gerais') {
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
    });
  });

  return map;
}
