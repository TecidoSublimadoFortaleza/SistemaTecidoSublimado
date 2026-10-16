import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AddressForm } from '../common/AddressForm';
import { Address } from '../../server/types/client';
import {
  Building2,
  Target,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Edit3,
  Plus,
  Search,
  FileText,
  FileSpreadsheet,
  Database,
  Calendar,
  DollarSign,
  Layers,
  Settings,
  X,
  Lock,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Sliders,
  Save,
  Check,
  FileDown,
  UserCheck,
  Zap,
  Flame,
  Sparkles,
  ChevronRight,
  Clock,
  Percent,
  ShieldCheck,
  KeyRound,
  Users,
  CheckSquare,
  Square,
  Unlock,
  CreditCard,
  Landmark,
  ClipboardCheck,
  Calculator,
  Tv,
  PieChart,
  Factory,
  MessageCircle,
  Truck,
  PackageCheck,
  ShoppingBag,
} from 'lucide-react';
import { UserProfile } from '../../types/frontend';
import { ApiService } from '../../services/api';
import { ThemesSettingsSection } from './ThemesSettingsSection';
import {
  getLoggedUserAndPerfil,
  savePermissionsMap,
  canUserPerformAction,
  getPermissionsMap,
  getDefaultPermissionsMap,
  getRoleRulesFromMap,
  getModuleRule,
  normalizeRoleName,
  syncAllRoleAliases,
  isDeveloperOrAdminMaster,
} from '../../utils/userPermissions';

interface SettingsModuleViewProps {
  user?: UserProfile;
}

export interface FilialItem {
  id: string;
  codigo: string; // e.g. FL-01 or MATRIZ
  nome: string; // Nome Fantasia
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj: string;
  inscricaoEstadual?: string;
  regimeTributario?: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';
  cidade: string;
  uf: string;
  responsavel: string;
  telefone: string;
  whatsapp?: string;
  email: string;
  status: 'ATIVA' | 'INATIVA';
  tipo?: 'MATRIZ' | 'FILIAL';
  logoUrl?: string;
  createdAt: string;
  endereco?: Address;
}

export interface MetaMensalItem {
  mesIndex: number; // 0..11
  mesNome: string; // "Janeiro", "Fevereiro", etc.
  metaValor: number;
  metaQtdOs: number;
  metaTicketMedio: number;
  vendaAtualValor: number;
}

export interface MetaDiaSemanaItem {
  diaCodigo: 'SEG' | 'TER' | 'QUA' | 'QUI' | 'SEX' | 'SAB' | 'DOM';
  diaNome: string;
  metaValor: number;
  metaQtdOs: number;
}

export interface MetaRelampagoItem {
  ativa: boolean;
  titulo: string;
  metaValorHoje: number;
  metaQtdOsHoje: number;
  realizadoHojeValor: number;
  realizadoHojeOs: number;
  observacoes?: string;
}

export interface MetaFilialItem {
  filialId: string;
  filialCodigo: string;
  filialNome: string;
  metaMensalValor: number;
  metaDiariaValor: number;
  metaQtdOs: number;
  vendaAtualValor: number;
  metasMensais?: MetaMensalItem[];
  metaRelampago?: MetaRelampagoItem;
  metasDiaSemana?: MetaDiaSemanaItem[];
}

export interface BackupLogItem {
  id: string;
  tipo: 'DIA' | 'MES';
  dataHora: string;
  nomeArquivo: string;
  tamanho: string;
  status: 'Concluído';
  qtdRegistros: number;
}

const MESES_ANO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DIAS_SEMANA: { diaCodigo: MetaDiaSemanaItem['diaCodigo']; diaNome: string }[] = [
  { diaCodigo: 'SEG', diaNome: 'Segunda-feira' },
  { diaCodigo: 'TER', diaNome: 'Terça-feira' },
  { diaCodigo: 'QUA', diaNome: 'Quarta-feira' },
  { diaCodigo: 'QUI', diaNome: 'Quinta-feira' },
  { diaCodigo: 'SEX', diaNome: 'Sexta-feira' },
  { diaCodigo: 'SAB', diaNome: 'Sábado' },
  { diaCodigo: 'DOM', diaNome: 'Domingo' },
];

export const generateInitialMetaFilial = (
  filialId: string,
  filialCodigo: string,
  filialNome: string,
  baseMensal: number = 0,
  baseDiaria: number = 0,
  baseOs: number = 0
): MetaFilialItem => {
  const metasMensais: MetaMensalItem[] = MESES_ANO.map((mesNome, idx) => ({
    mesIndex: idx,
    mesNome,
    metaValor: baseMensal,
    metaQtdOs: baseOs,
    metaTicketMedio: baseOs > 0 ? Math.round(baseMensal / baseOs) : 0,
    vendaAtualValor: 0,
  }));

  const metasDiaSemana: MetaDiaSemanaItem[] = DIAS_SEMANA.map((d) => ({
    diaCodigo: d.diaCodigo,
    diaNome: d.diaNome,
    metaValor: baseDiaria,
    metaQtdOs: Math.round(baseOs / 22),
  }));

  return {
    filialId,
    filialCodigo,
    filialNome,
    metaMensalValor: baseMensal,
    metaDiariaValor: baseDiaria,
    metaQtdOs: baseOs,
    vendaAtualValor: 0,
    metasMensais,
    metaRelampago: {
      ativa: false,
      titulo: '',
      metaValorHoje: 0,
      metaQtdOsHoje: 0,
      realizadoHojeValor: 0,
      realizadoHojeOs: 0,
      observacoes: '',
    },
    metasDiaSemana,
  };
};

const initialAddress: Address = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
};

export const DEFAULT_MATRIZ_LOGO = '/images/logo-web.png';

export const DEFAULT_MATRIZ_FILIAL: FilialItem = {
  id: 'FILIAL-MATRIZ-001',
  codigo: 'MATRIZ',
  nome: 'TECIDO SUBLIMADO - Matriz',
  razaoSocial: 'TECIDO SUBLIMADO FORTALEZA',
  cnpj: '36.047.818/0001-07',
  inscricaoEstadual: '061671967',
  cidade: 'FORTALEZA',
  uf: 'CE',
  responsavel: 'Gerente Geral Matriz',
  telefone: '(85) 98425-1321',
  whatsapp: '(85) 98425-1321',
  email: 'contato@tecidosublimado.com.br',
  status: 'ATIVA',
  tipo: 'MATRIZ',
  logoUrl: DEFAULT_MATRIZ_LOGO,
  createdAt: '2026-01-01T00:00:00.000Z',
  endereco: {
    cep: '60510291',
    logradouro: 'AVENIDA SENADOR FERNANDES TAVORA',
    numero: '2305',
    complemento: '',
    bairro: 'HENRIQUE JORGE',
    cidade: 'FORTALEZA',
    estado: 'CE',
  },
};

export const DEFAULT_EMPORIO_FILIAL: FilialItem = {
  id: 'filial-1790682978484',
  codigo: 'FL-02',
  nome: 'EMPORIO DA SUBLIMACAO',
  razaoSocial: 'EMPORIO DA SUBLIMACAO LTDA',
  cnpj: '59.158.781/0001-90',
  inscricaoEstadual: '072385812',
  cidade: 'Fortaleza',
  uf: 'CE',
  responsavel: 'FINANCEIROTSFORTALEZA@GMAIL.COM',
  telefone: '(85) 99208-4810',
  whatsapp: '(85) 99208-4810',
  email: 'FINANCEIROTSFORTALEZA@GMAIL.COM',
  status: 'ATIVA',
  tipo: 'FILIAL',
  logoUrl: DEFAULT_MATRIZ_LOGO,
  createdAt: '2026-01-01T00:00:00.000Z',
  endereco: {
    cep: '60526-641',
    logradouro: 'Avenida Senador Fernandes Távora',
    numero: '02305',
    complemento: '',
    bairro: 'Autran Nunes',
    cidade: 'Fortaleza',
    estado: 'CE',
  },
};

export const DEFAULT_FILIAIS: FilialItem[] = [DEFAULT_MATRIZ_FILIAL, DEFAULT_EMPORIO_FILIAL];

export const DEFAULT_METAS: Record<string, MetaFilialItem> = {
  'FILIAL-MATRIZ-001': generateInitialMetaFilial(
    'FILIAL-MATRIZ-001',
    'MATRIZ',
    'TECIDO SUBLIMADO - Matriz',
    750000,
    Math.round(750000 / 22),
    0
  ),
  'filial-1790682978484': generateInitialMetaFilial(
    'filial-1790682978484',
    'FL-02',
    'EMPORIO DA SUBLIMACAO',
    0,
    0,
    0
  ),
};

export interface ModulePermissionRules {
  visualizar: boolean;
  criarEditar: boolean;
  excluir: boolean;
  descontoEspecial: boolean;
  voltarAcao?: boolean;
  verFinanceiro: boolean;
  configuracoes: boolean;
}

export const SYSTEM_ROLES_PERMISSIONS_LIST = [
  { id: 'Developer', name: 'Developer / Engenharia & Servidor', level: 'Nível 0 - Acesso Total Irrestrito', description: 'Controle irrestrito absoluto sobre todos os módulos, endpoints, diagnósticos e regras de acesso do ERP.', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'CEO', name: 'CEO / Diretoria Executiva', level: 'Nível 1 - Acesso Total', description: 'Controle irrestrito sobre todas as unidades, finanças, relatórios DRE e configurações globais do ERP.', badgeColor: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'Gerente Geral', name: 'Gerente Geral de Operações', level: 'Nível 2 - Gestão Tática', description: 'Gestão completa de vendas, fluxo de produção, controle de estoque, comissões e equipe de colaboradores.', badgeColor: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'ADMINISTRATIVO', name: 'Administrativo / Gestão Corporativa', level: 'Nível 2 - Gestão Administrativa', description: 'Acesso a funcionários, jornada de ponto, relatórios, portais financeiros (Azulzinha/Caixa) e mensagens.', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { id: 'Supervisor', name: 'Supervisor de Setor', level: 'Nível 2 - Liderança Tática', description: 'Supervisão de equipes, acompanhamento de metas diárias e acompanhamento do fluxo operacional.', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { id: 'Monitor', name: 'Monitor / Qualidade', level: 'Nível 3 - Monitoramento', description: 'Auditoria de qualidade, monitoramento de prazos, controle de processos e inspeção visual.', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { id: 'Vendedor(a)', name: 'Vendedor(a) / Comercial', level: 'Nível 3 - Vendas & Atendimento', description: 'Lançamento de Orçamentos, Ordens de Serviço (OS), atendimento a Clientes e Venda Direta no Caixa PDV.', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'Vendedora Shopee', name: 'Vendedora Shopee / Marketplace', level: 'Nível 3 - Vendas Shopee', description: 'Gestão exclusiva de pedidos da Shopee (OSS), fluxo de produção no Kanban, relatórios e mensagens internas.', badgeColor: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'Designer', name: 'Designer / Arte Finalista', level: 'Nível 3 - Produção Visual', description: 'Gestão da fila de artes no Kanban, aprovação de mockups, vetores e direcionamento para impressão.', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { id: 'IMPRESSÃO', name: 'Operador de Impressão Sublimática', level: 'Nível 4 - Operacional Têxtil', description: 'Controle de impressão de papéis sublimáticos, avanço de etapas no Kanban e consumo de tintas/papel.', badgeColor: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'CALANDRA', name: 'Operador de Calandra / Termotransferência', level: 'Nível 4 - Operacional Têxtil', description: 'Processamento de transferência térmica do papel para o tecido e avanço da esteira no Kanban.', badgeColor: 'bg-orange-100 text-orange-800 border-orange-300' },
  { id: 'Costura', name: 'Costura & Acabamento', level: 'Nível 4 - Operacional Têxtil', description: 'Montagem de tecidos, facas de corte, costura industrial e conferência de peças produzidas.', badgeColor: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300' },
  { id: 'Estoque', name: 'Estoquista & Expedição', level: 'Nível 3 - Logística & Materiais', description: 'Recebimento de insumos, conferência de estoque físico, etiquetas e liberação de pacotes.', badgeColor: 'bg-teal-100 text-teal-800 border-teal-300' },
  { id: 'CONFERENCIA', name: 'Conferência & Pacote', level: 'Nível 4 - Inspeção de Saída', description: 'Conferência final de produtos acabados, contagem de peças, embalagem e etiqueta de envio.', badgeColor: 'bg-lime-100 text-lime-800 border-lime-300' },
  { id: 'RH', name: 'Recursos Humanos & DP', level: 'Nível 2 - Gestão de Pessoas', description: 'Gestão de contratações, folha salarial, cartões de ponto, advertências e métricas de desempenho.', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' },
  { id: 'Recepção', name: 'Recepção / Atendimento de Balcão', level: 'Nível 4 - Atendimento Presencial', description: 'Acolhimento de clientes, consulta rápida de status de OS e recebimento inicial de insumos.', badgeColor: 'bg-slate-100 text-slate-800 border-slate-300' },
  { id: 'Serviços Gerais', name: 'Serviços Gerais / Apoio Operacional', level: 'Nível 4 - Apoio e Manutenção', description: 'Serviços gerais, organização interna, limpeza, zeladoria e suporte aos setores.', badgeColor: 'bg-zinc-100 text-zinc-800 border-zinc-300' },
];

export const ERP_MODULES_LIST = [
  { id: 'dashboard', name: 'Dashboard', icon: TrendingUp, category: 'Gestão' },
  { id: 'tv', name: 'TV', icon: Tv, category: 'Gestão' },
  { id: 'tv-comercial', name: 'Dashboard Comercial', icon: PieChart, category: 'Gestão' },
  { id: 'tv-producao', name: 'Dashboard de Produção', icon: Factory, category: 'Produção' },
  { id: 'clientes', name: 'Clientes', icon: UserCheck, category: 'Vendas' },
  { id: 'kanban', name: 'Fluxo de produção (kanbam)', icon: Layers, category: 'Produção' },
  { id: 'orcamento', name: 'Orçamento', icon: Calculator, category: 'Vendas' },
  { id: 'ordemServico', name: 'Ordem de serviço', icon: FileText, category: 'Vendas' },
  { id: 'ordemServicoShopee', name: 'Ordem de serviço Shopee', icon: ShoppingBag, category: 'Vendas' },
  { id: 'estoque', name: 'Estoque', icon: Database, category: 'Logística' },
  { id: 'funcionarios', name: 'Funcionários', icon: Users, category: 'Gestão' },
  { id: 'jornada', name: 'Jornada', icon: Clock, category: 'RH & DP' },
  { id: 'conferenciaOs', name: 'Conferência de OS', icon: ClipboardCheck, category: 'Expedição & Produção' },
  { id: 'controle-expedicao', name: 'Controle de Expedição', icon: Truck, category: 'Expedição & Produção' },
  { id: 'entrega-devolucao', name: 'Entrega & Devolução', icon: PackageCheck, category: 'Expedição & Produção' },
  { id: 'relatorios', name: 'Relatórios', icon: Sliders, category: 'Financeiro' },
  { id: 'azulzinha', name: 'Azulzinha', icon: CreditCard, category: 'Financeiro' },
  { id: 'gerenciadorCaixa', name: 'Gerenciador CAIXA', icon: Landmark, category: 'Financeiro' },
  { id: 'notasFiscais', name: 'Notas Fiscais (NF-e)', icon: FileText, category: 'Financeiro' },
  { id: 'gerenciadorNotasFiscais', name: 'Gerenciador de Notas Fiscais', icon: FileSpreadsheet, category: 'Financeiro' },
  { id: 'waleads', name: 'WALeads', icon: MessageCircle, category: 'Vendas' },
  { id: 'rh', name: 'RH', icon: Users, category: 'RH & DP' },
  { id: 'historicoOs', name: 'Histórico de OS', icon: Clock, category: 'Vendas' },
  { id: 'mensagens', name: 'Mensagens internas', icon: Sparkles, category: 'Comunicação' },
  { id: 'pdv', name: 'PDV', icon: DollarSign, category: 'Vendas' },
  { id: 'configuracoes', name: 'Configurações', icon: Settings, category: 'Sistema' },
  { id: 'filiais', name: 'Filiais da Empresa', icon: Building2, category: 'Configurações' },
];

export const SettingsModuleView: React.FC<SettingsModuleViewProps> = ({ user }) => {
  // Developer exclusivity and administrative check
  const loggedUser = useMemo(() => getLoggedUserAndPerfil(), [user]);
  const isDeveloperUser = useMemo(() => {
    return Boolean(
      user?.isDeveloper ||
      user?.role === 'Developer' ||
      user?.role?.toLowerCase().includes('developer') ||
      loggedUser.isDeveloper ||
      loggedUser.role?.toLowerCase().includes('developer')
    );
  }, [user, loggedUser]);

  const isSettingsAdmin = useMemo(() => {
    const roleUpper = (user?.role || loggedUser.role || '').toUpperCase();
    return Boolean(
      isDeveloperUser ||
      isDeveloperOrAdminMaster(user?.role, user?.isDeveloper, user?.username, user?.name) ||
      roleUpper.includes('DEV') ||
      roleUpper.includes('CEO') ||
      roleUpper.includes('GERENTE') ||
      roleUpper.includes('MASTER') ||
      roleUpper.includes('ADMIN')
    );
  }, [user, loggedUser, isDeveloperUser]);

  // Main view mode: SETTINGS_HOME (Default tabs), CADASTRO_FILIAL (Full page form), or DEFINIR_META_FILIAL (Full page metas)
  const [mainViewMode, setMainViewMode] = useState<'SETTINGS_HOME' | 'CADASTRO_FILIAL' | 'DEFINIR_META_FILIAL'>('SETTINGS_HOME');
  const [activeTab, setActiveTab] = useState<'filiais' | 'permissoes' | 'metas' | 'backup' | 'limpar' | 'temas'>('filiais');
  const [filialToDelete, setFilialToDelete] = useState<{ id: string; nome: string } | null>(null);
  const [isConfirmingDeleteAllFiliais, setIsConfirmingDeleteAllFiliais] = useState(false);

  // If a non-admin is on an admin-exclusive tab, automatically fall back to 'filiais'
  useEffect(() => {
    if (!isSettingsAdmin && (activeTab === 'permissoes' || activeTab === 'backup' || activeTab === 'limpar' || activeTab === 'temas')) {
      setActiveTab('filiais');
    }
  }, [isSettingsAdmin, activeTab]);

  // Controle & Permissões State
  const [permissionsMap, setPermissionsMap] = useState<Record<string, Record<string, ModulePermissionRules>>>(() => {
    return getPermissionsMap();
  });
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<string>('Vendedor(a)');
  const [permSearchTerm, setPermSearchTerm] = useState<string>('');
  const [isSavingPerms, setIsSavingPerms] = useState<boolean>(false);
  const [isLoadingPerms, setIsLoadingPerms] = useState<boolean>(false);

  // Sincroniza matriz de permissões direto do servidor ao abrir a aba
  const savePermsTimeoutRef = useRef<any>(null);
  const [savePermsIndicator, setSavePermsIndicator] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Persistência contínua com auto-save imediato no localStorage e sincronização debounced no banco
  const autoSavePermissions = useCallback((updatedMap: Record<string, Record<string, ModulePermissionRules>>, roleContext?: string) => {
    const consolidated = syncAllRoleAliases(updatedMap, roleContext);
    savePermissionsMap(consolidated);
    setSavePermsIndicator('saving');

    if (savePermsTimeoutRef.current) {
      clearTimeout(savePermsTimeoutRef.current);
    }
    savePermsTimeoutRef.current = setTimeout(async () => {
      try {
        await ApiService.savePermissions(consolidated);
        setSavePermsIndicator('saved');
        setTimeout(() => setSavePermsIndicator('idle'), 3000);
      } catch (err) {
        console.warn('[Permissões] Erro na sincronização com servidor:', err);
        setSavePermsIndicator('saved');
      }
    }, 400);
  }, []);

  useEffect(() => {
    if (activeTab === 'permissoes') {
      setIsLoadingPerms(true);
      ApiService.getPermissions()
        .then((remoteData) => {
          if (remoteData && typeof remoteData === 'object' && Object.keys(remoteData).length > 0) {
            setPermissionsMap((currentMap) => {
              const merged = { ...remoteData, ...currentMap };
              const synced = syncAllRoleAliases(merged);
              try {
                localStorage.setItem('subligestao_permissoes', JSON.stringify(synced));
              } catch {}
              return synced;
            });
          }
        })
        .catch((err) => {
          console.warn('[Permissões] Erro ao carregar permissões:', err);
        })
        .finally(() => {
          setIsLoadingPerms(false);
        });
    }
  }, [activeTab]);

  const selectedRoleObj = useMemo(() => {
    return SYSTEM_ROLES_PERMISSIONS_LIST.find((r) => r.id === selectedRoleForPerms) || SYSTEM_ROLES_PERMISSIONS_LIST[0];
  }, [selectedRoleForPerms]);

  const filteredErpModules = useMemo(() => {
    if (!permSearchTerm.trim()) return ERP_MODULES_LIST;
    const term = permSearchTerm.toLowerCase();
    return ERP_MODULES_LIST.filter(
      (m) => m.name.toLowerCase().includes(term) || m.category.toLowerCase().includes(term)
    );
  }, [permSearchTerm]);

  const handleTogglePermissionRule = (roleId: string, moduleId: string, field: keyof ModulePermissionRules) => {
    if (!isSettingsAdmin) {
      setFeedbackMsg({ type: 'error', message: 'Acesso negado: Apenas administradores e desenvolvedores podem alterar a matriz de permissões.' });
      return;
    }
    setPermissionsMap((prev) => {
      const activeRoleRules = getRoleRulesFromMap(prev, roleId) || {};
      const currentModRules = getModuleRule(activeRoleRules, moduleId) || {
        visualizar: false,
        criarEditar: false,
        excluir: false,
        descontoEspecial: false,
        voltarAcao: false,
        verFinanceiro: false,
        configuracoes: false,
      };
      const updatedMod = { ...currentModRules, [field]: !currentModRules[field] };
      const updatedRoleMap = {
        ...activeRoleRules,
        [moduleId]: updatedMod,
      };

      const nextMap: Record<string, Record<string, ModulePermissionRules>> = {
        ...prev,
        [roleId]: updatedRoleMap,
      };
      const consolidated = syncAllRoleAliases(nextMap, roleId);
      autoSavePermissions(consolidated, roleId);
      return consolidated;
    });
  };

  const handleGrantAllForRole = (roleId: string) => {
    if (!isSettingsAdmin) {
      setFeedbackMsg({ type: 'error', message: 'Acesso negado: Apenas administradores e desenvolvedores podem conceder permissões.' });
      return;
    }
    setPermissionsMap((prev) => {
      const newRoleMap: Record<string, ModulePermissionRules> = {};
      ERP_MODULES_LIST.forEach((m) => {
        newRoleMap[m.id] = {
          visualizar: true,
          criarEditar: true,
          excluir: true,
          descontoEspecial: true,
          voltarAcao: true,
          verFinanceiro: true,
          configuracoes: true,
        };
      });
      const nextMap: Record<string, Record<string, ModulePermissionRules>> = {
        ...prev,
        [roleId]: newRoleMap,
      };
      const consolidated = syncAllRoleAliases(nextMap, roleId);
      autoSavePermissions(consolidated, roleId);
      return consolidated;
    });
    setFeedbackMsg({ type: 'success', message: `Todos os acessos foram concedidos e salvos para o perfil ${roleId}.` });
  };

  const handleRevokeAllForRole = (roleId: string) => {
    if (!isSettingsAdmin) {
      setFeedbackMsg({ type: 'error', message: 'Acesso negado: Apenas administradores e desenvolvedores podem revogar permissões.' });
      return;
    }
    setPermissionsMap((prev) => {
      const newRoleMap: Record<string, ModulePermissionRules> = {};
      ERP_MODULES_LIST.forEach((m) => {
        newRoleMap[m.id] = {
          visualizar: false,
          criarEditar: false,
          excluir: false,
          descontoEspecial: false,
          voltarAcao: false,
          verFinanceiro: false,
          configuracoes: false,
        };
      });
      const nextMap: Record<string, Record<string, ModulePermissionRules>> = {
        ...prev,
        [roleId]: newRoleMap,
      };
      const consolidated = syncAllRoleAliases(nextMap, roleId);
      autoSavePermissions(consolidated, roleId);
      return consolidated;
    });
    setFeedbackMsg({ type: 'info', message: `Todos os acessos foram revogados e salvos para o perfil ${roleId}.` });
  };

  const handleSavePermissionsMap = async () => {
    if (!isSettingsAdmin) {
      setFeedbackMsg({ type: 'error', message: 'Acesso negado: Apenas administradores e desenvolvedores podem salvar a matriz de permissões.' });
      return;
    }
    setIsSavingPerms(true);
    try {
      const consolidated = syncAllRoleAliases(permissionsMap, selectedRoleForPerms);
      savePermissionsMap(consolidated);
      const res = await ApiService.savePermissions(consolidated);
      if (res && typeof res === 'object' && Object.keys(res).length > 0) {
        setPermissionsMap(syncAllRoleAliases(res));
      }
      setFeedbackMsg({ type: 'success', message: 'Matriz de Controle e Permissões salva com sucesso no sistema!' });
    } catch (err: any) {
      console.error('[Permissões] Erro ao sincronizar permissões:', err);
      const consolidated = syncAllRoleAliases(permissionsMap, selectedRoleForPerms);
      savePermissionsMap(consolidated);
      setFeedbackMsg({ type: 'info', message: `Permissões salvas localmente. Aviso de sincronização: ${err?.message || 'Erro de comunicação com o servidor'}` });
    } finally {
      setIsSavingPerms(false);
    }
    
    // Redireciona a página para o topo
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      const scrollContainers = [
        document.querySelector('main'),
        document.querySelector('.overflow-y-auto'),
        document.getElementById('root'),
        document.documentElement,
        document.body,
      ];
      scrollContainers.forEach((el) => {
        if (el && typeof el.scrollTo === 'function') {
          el.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        }
      });
    } catch {}
  };

  const handleResetPermissionsMap = async () => {
    if (!isSettingsAdmin) {
      setFeedbackMsg({ type: 'error', message: 'Acesso negado: Apenas administradores e desenvolvedores podem restaurar as permissões.' });
      return;
    }
    if (confirm('Deseja restaurar as permissões de todos os perfis para o padrão de fábrica?')) {
      const initial = getDefaultPermissionsMap();
      setPermissionsMap(initial);
      savePermissionsMap(initial);
      try {
        await ApiService.savePermissions(initial);
      } catch {}
      setFeedbackMsg({ type: 'success', message: 'Permissões restauradas com sucesso no sistema.' });
    }
  };

  // Operational State
  const [filiais, setFiliais] = useState<FilialItem[]>([]);
  const [metasMap, setMetasMap] = useState<Record<string, MetaFilialItem>>({});
  const [backupLogs, setBackupLogs] = useState<BackupLogItem[]>([]);
  const [searchTermFiliais, setSearchTermFiliais] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Auto-dismiss confirmation feedback (cadastros, alterações e salvamentos) after 3 seconds
  useEffect(() => {
    if (feedbackMsg && (feedbackMsg.type === 'success' || feedbackMsg.type === 'info')) {
      const timer = setTimeout(() => {
        setFeedbackMsg(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

  // Full-page CADASTRO DE FILIAIS Form State (Copied from Clientes PJ)
  const [editingFilialId, setEditingFilialId] = useState<string | null>(null);
  const [codigoFilial, setCodigoFilial] = useState('');
  const [pjRazaoSocial, setPjRazaoSocial] = useState('');
  const [pjNomeFantasia, setPjNomeFantasia] = useState('');
  const [pjCnpj, setPjCnpj] = useState('');
  const [pjInscricaoEstadual, setPjInscricaoEstadual] = useState('ISENTO');
  const [telefone, setTelefone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [status, setStatus] = useState<'ATIVA' | 'INATIVA'>('ATIVA');
  const [tipo, setTipo] = useState<'MATRIZ' | 'FILIAL'>('FILIAL');
  const [logoUrl, setLogoUrl] = useState('');
  const [address, setAddress] = useState<Address>(initialAddress);

  // Modal Import Backup Preview
  const [importBackupData, setImportBackupData] = useState<any | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  // Modal Clear Confirmation
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');

  // Selected period for Metas
  const [metaPeriodMonth, setMetaPeriodMonth] = useState('Agosto / 2026');

  // Metas State
  const [selectedFilialMetaId, setSelectedFilialMetaId] = useState<string | null>(null);
  const [metaSubTab, setMetaSubTab] = useState<'mensal' | 'relampago'>('mensal');
  const [searchTermMetaFiliais, setSearchTermMetaFiliais] = useState('');
  const [batchMetaValor, setBatchMetaValor] = useState<number>(750000);
  const [batchMetaInputStr, setBatchMetaInputStr] = useState<string>('750.000,00');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<number | 'ALL'>('ALL');

  const formatBRCurrencyString = (val: number): string => {
    if (!val || isNaN(val)) return '';
    return val.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseBRCurrencyInput = (str: string): number => {
    if (!str) return 0;
    const clean = str.replace(/\./g, '').replace(',', '.').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const handleBatchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawStr = e.target.value;
    setBatchMetaInputStr(rawStr);
    const parsed = parseBRCurrencyInput(rawStr);
    setBatchMetaValor(parsed);
  };

  const handleBatchInputBlur = () => {
    if (batchMetaValor > 0) {
      setBatchMetaInputStr(formatBRCurrencyString(batchMetaValor));
    } else {
      setBatchMetaInputStr('');
    }
  };

  // Format Brazilian Phone: (00) 00000-0000
  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  // Format CNPJ: 00.000.000/0000-00
  const formatCnpj = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12)
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  };

  // Load Initial Data
  useEffect(() => {
    try {
      const storedFiliais = localStorage.getItem('subligestao_filiais');
      let localFiliais: FilialItem[] = [];
      if (storedFiliais !== null) {
        try {
          const parsed = JSON.parse(storedFiliais);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localFiliais = parsed;
            setFiliais(parsed);
          }
        } catch {}
      }
      if (localFiliais.length === 0) {
        setFiliais([DEFAULT_MATRIZ_FILIAL]);
        localStorage.setItem('subligestao_filiais', JSON.stringify([DEFAULT_MATRIZ_FILIAL]));
      }

      // Sincronização direta com o Banco de Dados (Supabase / PostgreSQL)
      ApiService.getFiliais().then((serverFiliais) => {
        if (serverFiliais && Array.isArray(serverFiliais) && serverFiliais.length > 0) {
          const map = new Map<string, FilialItem>();
          serverFiliais.forEach((f: FilialItem) => {
            if (f && f.id) map.set(f.id, f);
          });

          // Se o usuário adicionou filial localmente que ainda não estava no banco, mesclar!
          localFiliais.forEach((f: FilialItem) => {
            if (f && f.id && !map.has(f.id)) {
              map.set(f.id, f);
            }
          });

          const merged = Array.from(map.values());
          setFiliais(merged);
          localStorage.setItem('subligestao_filiais', JSON.stringify(merged));
          if (typeof window !== 'undefined') {
            setTimeout(() => {
              window.dispatchEvent(new Event('subligestao_filiais_changed'));
            }, 0);
          }

          // Se a lista mesclada tiver nova filial não presente no banco, salvar no banco imediatamente!
          if (merged.length > serverFiliais.length) {
            ApiService.saveFiliais(merged).catch(() => {});
          }
        } else if (localFiliais.length > 0) {
          // Se o banco ainda não tinha filiais, persistir as filiais locais no banco imediatamente!
          ApiService.saveFiliais(localFiliais).catch(() => {});
        } else {
          ApiService.saveFiliais([DEFAULT_MATRIZ_FILIAL]).catch(() => {});
        }
      }).catch((err) => {
        console.error('Erro ao sincronizar filiais com o banco de dados:', err);
      });

      const storedMetas = localStorage.getItem('subligestao_metas_filiais');
      if (storedMetas) {
        const parsed = JSON.parse(storedMetas);
        const cleanedMetas: Record<string, MetaFilialItem> = {};
        Object.keys(parsed).forEach((key) => {
          const item = parsed[key];
          // Preserve exact user configured value (even if 0)
          const baseMensal = item.metaMensalValor !== undefined && item.metaMensalValor !== null
            ? Number(item.metaMensalValor)
            : (key === 'FILIAL-MATRIZ-001' || item.filialCodigo === 'MATRIZ' ? 750000 : 0);

          cleanedMetas[key] = {
            ...item,
            metaMensalValor: baseMensal,
            metaDiariaValor: item.metaDiariaValor !== undefined ? Number(item.metaDiariaValor) : Math.round(baseMensal / 22),
            vendaAtualValor: 0,
            metasMensais: (item.metasMensais || []).map((m: MetaMensalItem) => ({
              ...m,
              metaValor: m.metaValor !== undefined ? Number(m.metaValor) : baseMensal,
              vendaAtualValor: 0,
            })),
            metaRelampago: item.metaRelampago
              ? {
                  ...item.metaRelampago,
                  realizadoHojeValor: 0,
                  realizadoHojeOs: 0,
                }
              : {
                  ativa: false,
                  titulo: '',
                  metaValorHoje: 0,
                  metaQtdOsHoje: 0,
                  realizadoHojeValor: 0,
                  realizadoHojeOs: 0,
                  observacoes: '',
                },
          };
        });
        setMetasMap(cleanedMetas);
        localStorage.setItem('subligestao_metas_filiais', JSON.stringify(cleanedMetas));
      } else {
        setMetasMap(DEFAULT_METAS);
        localStorage.setItem('subligestao_metas_filiais', JSON.stringify(DEFAULT_METAS));
      }

      // Load Metas directly from Database (Postgres / _system_store)
      ApiService.getMetas().then((serverMetas) => {
        if (serverMetas && Object.keys(serverMetas).length > 0) {
          const loaded: Record<string, MetaFilialItem> = {};
          Object.keys(serverMetas).forEach((key) => {
            const item = serverMetas[key];
            loaded[key] = {
              ...item,
              vendaAtualValor: 0,
              metasMensais: (item.metasMensais || []).map((m: MetaMensalItem) => ({
                ...m,
                vendaAtualValor: 0,
              })),
            };
          });
          setMetasMap(loaded);
          localStorage.setItem('subligestao_metas_filiais', JSON.stringify(loaded));
          if (typeof window !== 'undefined') {
            setTimeout(() => {
              window.dispatchEvent(new Event('subligestao_metas_changed'));
            }, 0);
          }
        } else {
          // Initialize DB with DEFAULT_METAS (750.000)
          ApiService.saveMetas(DEFAULT_METAS).catch(() => {});
        }
      }).catch((err) => {
        console.warn('Carregamento de metas do banco de dados:', err);
      });

      const storedLogs = localStorage.getItem('subligestao_backup_logs');
      if (storedLogs) {
        setBackupLogs(JSON.parse(storedLogs));
      } else {
        const initialLog: BackupLogItem = {
          id: 'log-01',
          tipo: 'DIA',
          dataHora: new Date().toLocaleString('pt-BR'),
          nomeArquivo: `subligestao_backup_diario_${new Date().toISOString().split('T')[0]}.json`,
          tamanho: '142 KB',
          status: 'Concluído',
          qtdRegistros: 185,
        };
        setBackupLogs([initialLog]);
        localStorage.setItem('subligestao_backup_logs', JSON.stringify([initialLog]));
      }
    } catch {
      setFiliais([DEFAULT_MATRIZ_FILIAL]);
      setMetasMap(DEFAULT_METAS);
    }
  }, []);

  // Save Filiais to state, localStorage and Database (Postgres / Supabase)
  const saveFiliaisList = (list: FilialItem[]) => {
    setFiliais(list);
    localStorage.setItem('subligestao_filiais', JSON.stringify(list));
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new Event('subligestao_filiais_changed'));
      }, 0);
    }
    ApiService.saveFiliais(list).catch((err) => {
      console.error('Erro ao persistir filiais no banco de dados:', err);
    });
  };

  // Save Metas to state, localStorage and Database (Postgres)
  const saveMetasMap = (map: Record<string, MetaFilialItem>) => {
    setMetasMap(map);
    localStorage.setItem('subligestao_metas_filiais', JSON.stringify(map));
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new Event('subligestao_metas_changed'));
      }, 0);
    }
    ApiService.saveMetas(map).catch((err) => {
      console.error('Erro ao persistir metas no banco de dados:', err);
    });
  };

  // Get or Initialize Meta object for a Filial
  const getOrInitMetaFilial = (f: FilialItem): MetaFilialItem => {
    const existing = metasMap[f.id];
    if (existing && existing.metasMensais && existing.metasMensais.length === 12 && existing.metaRelampago && existing.metasDiaSemana) {
      return {
        ...existing,
        vendaAtualValor: 0,
        metasMensais: existing.metasMensais.map((m) => ({ ...m, vendaAtualValor: 0 })),
        metaRelampago: {
          ...existing.metaRelampago,
          realizadoHojeValor: 0,
          realizadoHojeOs: 0,
        },
      };
    }
    const initial = generateInitialMetaFilial(
      f.id,
      f.codigo,
      f.nome,
      existing?.metaMensalValor || 0,
      existing?.metaDiariaValor || 0,
      existing?.metaQtdOs || 0
    );
    if (existing) {
      initial.vendaAtualValor = 0;
      if (existing.metasMensais && existing.metasMensais.length === 12) {
        initial.metasMensais = existing.metasMensais.map((m) => ({ ...m, vendaAtualValor: 0 }));
      }
      if (existing.metaRelampago) {
        initial.metaRelampago = {
          ...existing.metaRelampago,
          realizadoHojeValor: 0,
          realizadoHojeOs: 0,
        };
      }
      if (existing.metasDiaSemana) initial.metasDiaSemana = existing.metasDiaSemana;
    }
    return initial;
  };

  // Handler: Update specific monthly meta for a filial
  const handleUpdateMonthlyMeta = (filialId: string, mesIndex: number, field: keyof MetaMensalItem, value: number) => {
    const currentFilial = filiais.find((f) => f.id === filialId);
    if (!currentFilial) return;
    const meta = getOrInitMetaFilial(currentFilial);
    const updatedMensais = (meta.metasMensais || []).map((m) => {
      if (m.mesIndex === mesIndex) {
        const updated = { ...m, [field]: value };
        if (field === 'metaValor' || field === 'metaQtdOs') {
          const val = field === 'metaValor' ? value : m.metaValor;
          const os = field === 'metaQtdOs' ? value : m.metaQtdOs;
          updated.metaTicketMedio = os > 0 ? Math.round(val / os) : 0;
        }
        return updated;
      }
      return m;
    });

    const currentMIdx = new Date().getMonth();
    const updatedMeta: MetaFilialItem = {
      ...meta,
      metasMensais: updatedMensais,
      metaMensalValor: mesIndex === currentMIdx ? (field === 'metaValor' ? value : meta.metaMensalValor) : meta.metaMensalValor,
      metaQtdOs: mesIndex === currentMIdx ? (field === 'metaQtdOs' ? value : meta.metaQtdOs) : meta.metaQtdOs,
    };

    const newMap = { ...metasMap, [filialId]: updatedMeta };
    saveMetasMap(newMap);
  };

  // Handler: Batch apply a value to all 12 months
  const handleApplyBatchMonthlyMeta = (filialId: string, value: number) => {
    const currentFilial = filiais.find((f) => f.id === filialId);
    if (!currentFilial) return;
    const meta = getOrInitMetaFilial(currentFilial);
    const updatedMensais = (meta.metasMensais || []).map((m) => ({
      ...m,
      metaValor: value,
      metaTicketMedio: m.metaQtdOs > 0 ? Math.round(value / m.metaQtdOs) : 0,
    }));

    const updatedMeta: MetaFilialItem = {
      ...meta,
      metaMensalValor: value,
      metasMensais: updatedMensais,
    };

    const newMap = { ...metasMap, [filialId]: updatedMeta };
    saveMetasMap(newMap);
    setFeedbackMsg({ type: 'success', message: `Valor ${formatMoney(value)} aplicado a todos os 12 meses e salvo no banco de dados!` });
  };

  // Handler: Save Metas explicitly
  const handleSaveMetas = (filialNome?: string) => {
    saveMetasMap(metasMap);
    setFeedbackMsg({
      type: 'success',
      message: filialNome ? `Metas da unidade "${filialNome}" salvas com sucesso no banco de dados!` : 'Metas salvas com sucesso no banco de dados!',
    });
  };

  // Handler: Update Flash Meta (Meta Relâmpago)
  const handleUpdateMetaRelampago = (filialId: string, updates: Partial<MetaRelampagoItem>) => {
    const currentFilial = filiais.find((f) => f.id === filialId);
    if (!currentFilial) return;
    const meta = getOrInitMetaFilial(currentFilial);
    const updatedRelampago: MetaRelampagoItem = {
      ...(meta.metaRelampago || {
        ativa: false,
        titulo: 'Meta Relâmpago Flash do Dia',
        metaValorHoje: 3300,
        metaQtdOsHoje: 12,
        realizadoHojeValor: 0,
        realizadoHojeOs: 0,
      }),
      ...updates,
    };

    const updatedMeta: MetaFilialItem = {
      ...meta,
      metaRelampago: updatedRelampago,
      metaDiariaValor: updatedRelampago.ativa ? updatedRelampago.metaValorHoje : meta.metaDiariaValor,
    };

    const newMap = { ...metasMap, [filialId]: updatedMeta };
    saveMetasMap(newMap);
  };

  // Handler: Update Day of Week Meta
  const handleUpdateMetaDiaSemana = (filialId: string, diaCodigo: string, field: 'metaValor' | 'metaQtdOs', value: number) => {
    const currentFilial = filiais.find((f) => f.id === filialId);
    if (!currentFilial) return;
    const meta = getOrInitMetaFilial(currentFilial);
    const updatedDias = (meta.metasDiaSemana || []).map((d) => {
      if (d.diaCodigo === diaCodigo) {
        return { ...d, [field]: value };
      }
      return d;
    });

    const updatedMeta: MetaFilialItem = {
      ...meta,
      metasDiaSemana: updatedDias,
    };

    const newMap = { ...metasMap, [filialId]: updatedMeta };
    saveMetasMap(newMap);
  };

  // Handler: Clear all metas for a filial
  const handleClearAllMetasFilial = (filialId: string) => {
    const currentFilial = filiais.find((f) => f.id === filialId);
    if (!currentFilial) return;
    const meta = getOrInitMetaFilial(currentFilial);

    const clearedMensais = (meta.metasMensais || []).map((m) => ({
      ...m,
      metaValor: 0,
      metaQtdOs: 0,
      metaTicketMedio: 0,
    }));

    const clearedRelampago: MetaRelampagoItem = {
      ativa: false,
      titulo: '',
      metaValorHoje: 0,
      metaQtdOsHoje: 0,
      realizadoHojeValor: 0,
      realizadoHojeOs: 0,
      observacoes: '',
    };

    const clearedDias = (meta.metasDiaSemana || []).map((d) => ({
      ...d,
      metaValor: 0,
      metaQtdOs: 0,
    }));

    const updatedMeta: MetaFilialItem = {
      ...meta,
      metaMensalValor: 0,
      metaDiariaValor: 0,
      metaQtdOs: 0,
      metasMensais: clearedMensais,
      metaRelampago: clearedRelampago,
      metasDiaSemana: clearedDias,
    };

    const newMap = { ...metasMap, [filialId]: updatedMeta };
    saveMetasMap(newMap);
    setBatchMetaValor(0);
    setFeedbackMsg({
      type: 'success',
      message: `Todos os campos de metas da unidade "${currentFilial.nome}" foram limpos!`,
    });
  };
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  // Filtered Filiais
  const filteredFiliais = useMemo(() => {
    if (!searchTermFiliais.trim()) return filiais;
    const term = searchTermFiliais.toLowerCase();
    return filiais.filter(
      (f) =>
        f.nome.toLowerCase().includes(term) ||
        f.codigo.toLowerCase().includes(term) ||
        f.cidade.toLowerCase().includes(term) ||
        f.cnpj.includes(term) ||
        (f.razaoSocial && f.razaoSocial.toLowerCase().includes(term))
    );
  }, [filiais, searchTermFiliais]);

  // Handler: Open Full Page "CADASTRO DE FILIAIS" (Nova Filial)
  const handleOpenNewFilial = () => {
    setEditingFilialId(null);
    const nextNum = (filiais.length + 1).toString().padStart(2, '0');
    setCodigoFilial(`FL-${nextNum}`);
    setPjRazaoSocial('');
    setPjNomeFantasia('');
    setPjCnpj('');
    setPjInscricaoEstadual('ISENTO');
    setTelefone('');
    setWhatsapp('');
    setEmail('');
    setResponsavel('');
    setStatus('ATIVA');
    setTipo('FILIAL');
    setLogoUrl(DEFAULT_MATRIZ_LOGO);
    setAddress(initialAddress);
    setMainViewMode('CADASTRO_FILIAL');
  };

  // Handler: Open Full Page "CADASTRO DE FILIAIS" (Editar Filial)
  const handleEditFilial = (filial: FilialItem) => {
    setEditingFilialId(filial.id);
    setCodigoFilial(filial.codigo);
    setPjRazaoSocial(filial.razaoSocial || filial.nome);
    setPjNomeFantasia(filial.nome);
    setPjCnpj(filial.cnpj);
    setPjInscricaoEstadual(filial.inscricaoEstadual || 'ISENTO');
    setTelefone(filial.telefone);
    setWhatsapp(filial.whatsapp || filial.telefone);
    setEmail(filial.email);
    setResponsavel(filial.responsavel);
    setStatus(filial.status);
    setTipo(filial.tipo || (filial.codigo === 'MATRIZ' ? 'MATRIZ' : 'FILIAL'));
    setLogoUrl(filial.logoUrl || DEFAULT_MATRIZ_LOGO);
    setAddress(
      filial.endereco || {
        cep: '60510291',
        logradouro: 'AVENIDA SENADOR FERNANDES TAVORA',
        numero: '2305',
        complemento: '',
        bairro: 'HENRIQUE JORGE',
        cidade: filial.cidade || 'FORTALEZA',
        estado: filial.uf || 'CE',
      }
    );
    setMainViewMode('CADASTRO_FILIAL');
  };

  // Reset Filial Form
  const resetFilialForm = () => {
    setPjRazaoSocial('');
    setPjNomeFantasia('');
    setPjCnpj('');
    setPjInscricaoEstadual('ISENTO');
    setTelefone('');
    setWhatsapp('');
    setEmail('');
    setResponsavel('');
    setStatus('ATIVA');
    setTipo('FILIAL');
    setLogoUrl(DEFAULT_MATRIZ_LOGO);
    setAddress(initialAddress);
  };

  // Handler: Save Cadastro de Filial (Full Page Form)
  const handleSaveFilialForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isDeveloperUser && !canUserPerformAction(loggedUser.role, 'configuracoes', 'criarEditar', loggedUser.isDeveloper)) {
      setFeedbackMsg({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para Criar / Editar em Configurações.',
      });
      return;
    }

    if (!pjNomeFantasia.trim() || !pjCnpj.trim()) {
      setFeedbackMsg({
        type: 'error',
        message: 'Por favor, preencha o Nome Fantasia e o CNPJ da Empresa / Filial.',
      });
      return;
    }

    const filialCidade = address.cidade || 'FORTALEZA';
    const filialUf = address.estado || 'CE';

    if (editingFilialId) {
      const updated = filiais.map((f) => {
        if (f.id === editingFilialId) {
          return {
            ...f,
            codigo: codigoFilial || f.codigo,
            nome: pjNomeFantasia,
            razaoSocial: pjRazaoSocial || pjNomeFantasia,
            cnpj: pjCnpj,
            inscricaoEstadual: pjInscricaoEstadual,
            cidade: filialCidade,
            uf: filialUf,
            responsavel: responsavel || f.responsavel,
            telefone: telefone || f.telefone,
            whatsapp: whatsapp || telefone || f.telefone,
            email: email || f.email,
            status,
            tipo,
            logoUrl: logoUrl || f.logoUrl,
            endereco: address,
          } as FilialItem;
        }
        return f;
      });
      saveFiliaisList(updated);
      setFeedbackMsg({
        type: 'success',
        message: `Empresa / Filial "${pjNomeFantasia}" atualizada com sucesso!`,
      });
    } else {
      const newFilial: FilialItem = {
        id: `filial-${Date.now()}`,
        codigo: codigoFilial || (tipo === 'MATRIZ' ? 'MATRIZ' : `FL-${(filiais.length + 1).toString().padStart(2, '0')}`),
        nome: pjNomeFantasia,
        razaoSocial: pjRazaoSocial || pjNomeFantasia,
        cnpj: pjCnpj,
        inscricaoEstadual: pjInscricaoEstadual,
        cidade: filialCidade,
        uf: filialUf,
        responsavel: responsavel || 'Gerente Geral',
        telefone: telefone || '(85) 98425-1321',
        whatsapp: whatsapp || telefone || '(85) 98425-1321',
        email: email || 'contato@tecidosublimado.com.br',
        status,
        tipo,
        logoUrl: logoUrl || DEFAULT_MATRIZ_LOGO,
        createdAt: new Date().toISOString(),
        endereco: address,
      };

      const updated = [...filiais, newFilial];
      saveFiliaisList(updated);

      // Create default meta entry for new filial
      const updatedMetas = {
        ...metasMap,
        [newFilial.id]: {
          filialId: newFilial.id,
          filialCodigo: newFilial.codigo,
          filialNome: newFilial.nome,
          metaMensalValor: 50000,
          metaDiariaValor: 2200,
          metaQtdOs: 80,
          vendaAtualValor: 0,
        },
      };
      saveMetasMap(updatedMetas);

      setFeedbackMsg({
        type: 'success',
        message: `Nova Empresa / Filial "${newFilial.nome}" cadastrada com sucesso!`,
      });
    }

    setMainViewMode('SETTINGS_HOME');
  };

  const handleToggleStatusFilial = (id: string) => {
    const updated = filiais.map((f) => {
      if (f.id === id) {
        const nextStatus = f.status === 'ATIVA' ? 'INATIVA' : 'ATIVA';
        return { ...f, status: nextStatus as 'ATIVA' | 'INATIVA' };
      }
      return f;
    });
    saveFiliaisList(updated);
    setFeedbackMsg({ type: 'info', message: 'Status da filial alterado com sucesso.' });
  };

  const handleDeleteFilial = (id: string, nome: string) => {
    setFilialToDelete({ id, nome });
  };

  const confirmDeleteFilial = () => {
    if (!filialToDelete) return;
    const { id, nome } = filialToDelete;
    setFilialToDelete(null);
    const updated = filiais.filter((f) => f.id !== id);
    saveFiliaisList(updated);
    ApiService.deleteFilial(id).catch(() => {});
    setFeedbackMsg({ type: 'success', message: `Filial "${nome}" excluída com sucesso.` });
    if (selectedFilialMetaId === id) {
      setSelectedFilialMetaId(updated[0]?.id || '');
    }
    if (editingFilialId === id) {
      setMainViewMode('SETTINGS_HOME');
      resetFilialForm();
    }
  };

  const handleDeleteAllFiliais = () => {
    setIsConfirmingDeleteAllFiliais(true);
  };

  const confirmDeleteAllFiliais = () => {
    setIsConfirmingDeleteAllFiliais(false);
    saveFiliaisList([]);
    ApiService.deleteAllFiliais().catch(() => {});
    setFeedbackMsg({ type: 'success', message: 'Todas as filiais foram excluídas com sucesso.' });
  };

  // Handlers Metas
  const handleUpdateMetaValue = (
    filialId: string,
    field: 'metaMensalValor' | 'metaDiariaValor' | 'metaQtdOs' | 'vendaAtualValor',
    val: number
  ) => {
    const current = metasMap[filialId] || {
      filialId,
      filialCodigo: filiais.find((f) => f.id === filialId)?.codigo || '',
      filialNome: filiais.find((f) => f.id === filialId)?.nome || '',
      metaMensalValor: 0,
      metaDiariaValor: 0,
      metaQtdOs: 0,
      vendaAtualValor: 0,
    };

    const updated = {
      ...metasMap,
      [filialId]: {
        ...current,
        [field]: Math.max(0, val),
      },
    };
    saveMetasMap(updated);
  };

  // Handlers Backup DIA / MÊS (Exclusivo Developer)
  const handleExportBackup = (tipo: 'DIA' | 'MES') => {
    if (!isDeveloperUser) {
      setFeedbackMsg({ type: 'error', message: 'Acesso negado: Apenas o perfil Developer pode exportar backups do ERP.' });
      return;
    }
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const monthStr = todayStr.substring(0, 7);
      const filename =
        tipo === 'DIA'
          ? `subligestao_backup_diario_${todayStr}.json`
          : `subligestao_backup_mensal_${monthStr}.json`;

      const osData = localStorage.getItem('subligestao_os_list') || '[]';
      const pdvData = localStorage.getItem('subligestao_pdv_vendas') || '[]';
      const clientesData = localStorage.getItem('subligestao_clientes') || '[]';
      const estoqueData = localStorage.getItem('subligestao_estoque') || '[]';

      const backupContent = {
        metaSystem: 'ERP SubliGestão',
        version: '3.5.0',
        tipoBackup: tipo,
        timestamp: new Date().toISOString(),
        geradoPor: user?.name || 'Developer',
        data: {
          filiais,
          metasMap,
          osList: JSON.parse(osData),
          pdvList: JSON.parse(pdvData),
          clientes: JSON.parse(clientesData),
          estoque: JSON.parse(estoqueData),
        },
      };

      const jsonString = JSON.stringify(backupContent, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const sizeKb = Math.round(jsonString.length / 1024);
      const newLog: BackupLogItem = {
        id: `log-${Date.now()}`,
        tipo,
        dataHora: new Date().toLocaleString('pt-BR'),
        nomeArquivo: filename,
        tamanho: `${sizeKb} KB`,
        status: 'Concluído',
        qtdRegistros:
          backupContent.data.osList.length +
          backupContent.data.pdvList.length +
          backupContent.data.clientes.length,
      };

      const updatedLogs = [newLog, ...backupLogs];
      setBackupLogs(updatedLogs);
      localStorage.setItem('subligestao_backup_logs', JSON.stringify(updatedLogs));

      setFeedbackMsg({
        type: 'success',
        message: `Backup ${tipo === 'DIA' ? 'Diário' : 'Mensal'} do sistema exportado com sucesso! (${filename})`,
      });
    } catch {
      setFeedbackMsg({ type: 'error', message: 'Falha ao gerar o arquivo de backup.' });
    }
  };

  // Handler Import File Select (Exclusivo Developer)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isDeveloperUser) {
      setFeedbackMsg({ type: 'error', message: 'Acesso negado: Apenas o perfil Developer pode importar backups do ERP.' });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.metaSystem || !json.data) {
          throw new Error('Arquivo de backup inválido ou incompatível.');
        }
        setImportBackupData(json);
        setShowImportModal(true);
      } catch (err: any) {
        setFeedbackMsg({
          type: 'error',
          message: err.message || 'Formato de arquivo JSON corrompido ou inválido.',
        });
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // Execute Import (Exclusivo Developer)
  const handleExecuteImport = () => {
    if (!isDeveloperUser) {
      setFeedbackMsg({ type: 'error', message: 'Acesso negado: Apenas o perfil Developer pode restaurar backups.' });
      return;
    }
    if (!importBackupData || !importBackupData.data) return;

    try {
      const { data } = importBackupData;

      if (data.filiais && Array.isArray(data.filiais)) {
        saveFiliaisList(data.filiais);
      }
      if (data.metasMap) {
        saveMetasMap(data.metasMap);
      }
      if (data.osList) {
        localStorage.setItem('subligestao_os_list', JSON.stringify(data.osList));
      }
      if (data.pdvList) {
        localStorage.setItem('subligestao_pdv_vendas', JSON.stringify(data.pdvList));
      }
      if (data.clientes) {
        localStorage.setItem('subligestao_clientes', JSON.stringify(data.clientes));
      }
      if (data.estoque) {
        localStorage.setItem('subligestao_estoque', JSON.stringify(data.estoque));
      }

      setShowImportModal(false);
      setImportBackupData(null);
      setFeedbackMsg({
        type: 'success',
        message: 'Backup restaurado com sucesso! Todos os dados e filiais foram atualizados.',
      });
    } catch {
      setFeedbackMsg({ type: 'error', message: 'Ocorreu um erro ao aplicar o backup.' });
    }
  };

  // Clear ERP / Fresh Start Execution (Exclusivo Developer)
  const handleExecuteClearErp = () => {
    if (!isDeveloperUser) {
      setFeedbackMsg({ type: 'error', message: 'Acesso negado: Apenas o perfil Developer pode zerar os dados do ERP.' });
      return;
    }
    if (clearConfirmationText.toUpperCase() !== 'LIMPAR') {
      setFeedbackMsg({
        type: 'error',
        message: 'Digite exatamente "LIMPAR" no campo de confirmação para prosseguir.',
      });
      return;
    }

    try {
      localStorage.removeItem('subligestao_os_list');
      localStorage.removeItem('subligestao_pdv_vendas');
      localStorage.removeItem('subligestao_clientes');
      localStorage.removeItem('subligestao_estoque');

      saveFiliaisList(DEFAULT_FILIAIS);
      saveMetasMap(DEFAULT_METAS);

      setShowClearModal(false);
      setClearConfirmationText('');

      setFeedbackMsg({
        type: 'success',
        message: 'ERP Limpo com sucesso! Os lançamentos de OS, PDV e Clientes foram zerados.',
      });
    } catch {
      setFeedbackMsg({ type: 'error', message: 'Erro ao zerar os dados do ERP.' });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-x-hidden pb-10">
      {/* BANNER DE FEEDBACK TEMPORÁRIO */}
      {feedbackMsg && (
        <div
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border flex items-center justify-between text-xs font-bold transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedbackMsg.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {feedbackMsg.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            {feedbackMsg.type === 'info' && <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />}
            <span className="truncate sm:whitespace-normal">{feedbackMsg.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-slate-600 p-1 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =================================================================================== */}
      {/* VISTA 1: HOME DAS CONFIGURAÇÕES (LISTA DE FILIAIS, METAS, BACKUP E LIMPAR) */}
      {/* =================================================================================== */}
      {mainViewMode === 'SETTINGS_HOME' && (
        <div className="space-y-3.5 sm:space-y-4">
          {/* NAVEGAÇÃO ENTRE ABAS DAS CONFIGURAÇÕES - ESTILO ERP CLÁSSICO MINIMALISTA */}
          <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-slate-200 shadow-xs flex items-center justify-start gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar scrollbar-none touch-pan-x min-w-0 w-full">
            <button
              type="button"
              onClick={() => setActiveTab('filiais')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-extrabold text-xs transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'filiais'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Filiais ({filiais.length})</span>
            </button>

            {/* ABAS EXCLUSIVAS DO PERFIL DEVELOPER */}
            {/* ABA CONTROLE E PERMISSÕES (ADMIN / DEVELOPER) */}
            {isSettingsAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('permissoes')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-extrabold text-xs transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                  activeTab === 'permissoes'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Controle e Permissões</span>
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-[9px] font-black uppercase">
                  Gestão
                </span>
              </button>
            )}

            {/* ABAS EXCLUSIVAS DO PERFIL DEVELOPER */}
            {isDeveloperUser && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('backup')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-extrabold text-xs transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                    activeTab === 'backup'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <span>Backup DIA/MÊS</span>
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-black uppercase">
                    Dev
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('limpar')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-extrabold text-xs transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                    activeTab === 'limpar'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Limpar ERP</span>
                  <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded text-[9px] font-black uppercase">
                    Dev
                  </span>
                </button>
              </>
            )}

            {/* ABA TEMAS DIVERSOS (ADMIN / DEVELOPER) */}
            {(isSettingsAdmin || isDeveloperUser) && (
              <button
                type="button"
                onClick={() => setActiveTab('temas')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-extrabold text-xs transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                  activeTab === 'temas'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Temas Diversos</span>
              </button>
            )}
          </div>

          {/* ----------------------------------------------------------------------------------- */}
          {/* ABA 1: CADASTRO DE FILIAIS (LISTAGEM) */}
          {/* ----------------------------------------------------------------------------------- */}
          {activeTab === 'filiais' && (
            <div className="space-y-3.5 sm:space-y-4">
              <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-lg font-black shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Cadastro e Registro de Filiais</h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Unidades cadastradas para vinculação de vendas e faturamento.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-none w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar filial..."
                      value={searchTermFiliais}
                      onChange={(e) => setSearchTermFiliais(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {filiais.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteAllFiliais}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-lg border border-rose-200 transition flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                      title="Excluir Todas as Filiais"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir Todas</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleOpenNewFilial}
                    className="flex-1 sm:flex-none px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova Filial</span>
                  </button>
                </div>
              </div>

              {/* LISTA EM CARDS PARA DISPOSITIVOS MÓVEIS (MOBILE) */}
              <div className="block md:hidden space-y-3">
                {filteredFiliais.length > 0 ? (
                  filteredFiliais.map((f) => {
                    const isMatriz = f.codigo === 'MATRIZ' || f.tipo === 'MATRIZ' || f.id === 'filial-matriz-fortaleza';
                    return (
                      <div
                        key={`mobile-filial-${f.id}`}
                        className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3"
                      >
                        {/* CABEÇALHO DO CARD MOBILE */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center p-0.5 overflow-hidden shrink-0 shadow-xs">
                              <img
                                src={f.logoUrl || DEFAULT_MATRIZ_LOGO}
                                alt={f.nome}
                                className="w-full h-full object-contain rounded"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded font-mono font-black text-[9px] tracking-wider uppercase ${
                                    isMatriz ? 'bg-purple-900 text-purple-100' : 'bg-slate-900 text-white'
                                  }`}
                                >
                                  {f.codigo || (isMatriz ? 'MATRIZ' : 'FILIAL')}
                                </span>
                                {isMatriz && (
                                  <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 border border-purple-200 rounded text-[9px] font-black uppercase">
                                    Matriz
                                  </span>
                                )}
                              </div>
                              <h3 className="font-black text-slate-900 text-xs truncate mt-0.5">{f.nome}</h3>
                              {f.razaoSocial && (
                                <p className="text-[10px] text-slate-500 font-medium truncate">{f.razaoSocial}</p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleStatusFilial(f.id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide transition cursor-pointer shrink-0 ${
                              f.status === 'ATIVA'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            {f.status === 'ATIVA' ? '✓ ATIVA' : 'INATIVA'}
                          </button>
                        </div>

                        {/* DETALHES CADASTRAIS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">CNPJ / IE</span>
                            <span className="font-mono font-bold text-slate-800 text-[11px]">{f.cnpj}</span>
                            {f.inscricaoEstadual && (
                              <span className="text-[10px] text-slate-500 block">IE: {f.inscricaoEstadual}</span>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Localização</span>
                            <span className="font-bold text-slate-800 text-[11px]">{f.cidade} - {f.uf}</span>
                            {f.endereco?.logradouro && (
                              <span className="text-[10px] text-slate-500 block truncate">
                                {f.endereco.logradouro}, {f.endereco.numero || 'S/N'}
                              </span>
                            )}
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Contato & Responsável</span>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-bold text-slate-700">
                              <span>Resp: {f.responsavel}</span>
                              <span>Tel: {f.telefone}</span>
                              {f.whatsapp && (
                                <span className="text-emerald-700 font-bold">Zap: {f.whatsapp}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* AÇÕES MOBILE EM BOTÕES DE TOQUE */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFilialMetaId(f.id);
                              setActiveTab('metas');
                              setMainViewMode('DEFINIR_META_FILIAL');
                            }}
                            className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 transition cursor-pointer flex items-center justify-center gap-1 text-[11px] font-extrabold"
                          >
                            <Target className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Metas</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditFilial(f)}
                            className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 text-[11px] font-extrabold"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFilial(f.id, f.nome)}
                            className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition cursor-pointer flex items-center justify-center gap-1 text-[11px] font-extrabold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-3">
                    <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-slate-800 font-bold text-xs">Nenhuma filial encontrada</p>
                    <button
                      type="button"
                      onClick={handleOpenNewFilial}
                      className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg"
                    >
                      Nova Filial
                    </button>
                  </div>
                )}
              </div>

              {/* TABELA DE FILIAIS EM ESTILO ERP CLÁSSICO (DESKTOP) */}
              <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[720px]">
                    <thead>
                      <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-black text-slate-700 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Código</th>
                        <th className="py-2.5 px-3">Razão Social / Nome Fantasia</th>
                        <th className="py-2.5 px-3">CNPJ</th>
                        <th className="py-2.5 px-3">Cidade / UF</th>
                        <th className="py-2.5 px-3">Gerente / Responsável</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                      {filteredFiliais.length > 0 ? (
                        filteredFiliais.map((f) => {
                          const isMatriz = f.codigo === 'MATRIZ' || f.tipo === 'MATRIZ' || f.id === 'filial-matriz-fortaleza';
                          return (
                            <tr key={f.id} className="hover:bg-blue-50/30 transition">
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded font-mono font-black text-[10px] tracking-wider uppercase ${
                                    isMatriz ? 'bg-purple-900 text-purple-100' : 'bg-slate-900 text-white'
                                  }`}
                                >
                                  {f.codigo || (isMatriz ? 'MATRIZ' : 'FILIAL')}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center p-0.5 overflow-hidden shrink-0 shadow-xs">
                                    <img
                                      src={f.logoUrl || DEFAULT_MATRIZ_LOGO}
                                      alt={f.nome}
                                      className="w-full h-full object-contain rounded"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                      <span>{f.nome}</span>
                                      {isMatriz && (
                                        <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 border border-purple-200 rounded text-[9px] font-black uppercase">
                                          Matriz
                                        </span>
                                      )}
                                    </div>
                                    {f.razaoSocial && (
                                      <div className="text-[10px] text-slate-500 font-medium">{f.razaoSocial}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-mono text-slate-900 font-bold text-[11px]">{f.cnpj}</div>
                                {f.inscricaoEstadual && (
                                  <div className="text-[10px] text-slate-500">INSC: {f.inscricaoEstadual}</div>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="text-slate-900 font-bold">{f.cidade} - {f.uf}</div>
                                {f.endereco?.logradouro && (
                                  <div className="text-[10px] text-slate-500 line-clamp-1">
                                    {f.endereco.logradouro}, {f.endereco.numero || '2305'} - {f.endereco.bairro || 'HENRIQUE JORGE'}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="text-slate-900 font-bold">{f.responsavel}</div>
                                <div className="text-[10px] text-slate-500">TEL: {f.telefone}</div>
                                {f.whatsapp && (
                                  <div className="text-[10px] text-emerald-700 font-bold">WHATSAPP: {f.whatsapp}</div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatusFilial(f.id)}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide transition cursor-pointer ${
                                    f.status === 'ATIVA'
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                  }`}
                                >
                                  {f.status === 'ATIVA' ? '✓ ATIVA' : 'INATIVA'}
                                </button>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedFilialMetaId(f.id);
                                      setActiveTab('metas');
                                      setMainViewMode('DEFINIR_META_FILIAL');
                                    }}
                                    title="Definir Metas da Filial"
                                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                                  >
                                    <Target className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Metas</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleEditFilial(f)}
                                    title="Editar Filial"
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Editar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFilial(f.id, f.nome)}
                                    title="Excluir Filial"
                                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Excluir</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-400 font-bold text-xs">
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-slate-400" />
                              </div>
                              <div>
                                <p className="text-slate-800 font-black text-sm">Nenhuma filial cadastrada em Configurações</p>
                                <p className="text-slate-500 font-medium text-xs mt-0.5">Todas as filiais foram excluídas. Clique em "Nova Filial" para cadastrar uma nova unidade.</p>
                              </div>
                              <button
                                type="button"
                                onClick={handleOpenNewFilial}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer mt-1"
                              >
                                <Plus className="w-4 h-4" />
                                Cadastrar Nova Filial
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------------------- */}
          {/* ABA 2: CONTROLE E PERMISSÕES (PERFIS DE ACESSO E MATRIZ RBAC) - EXCLUSIVO DEVELOPER */}
          {/* ----------------------------------------------------------------------------------- */}
          {activeTab === 'permissoes' && (
            !isDeveloperUser ? (
              <div className="bg-white p-8 rounded-xl border border-rose-200 text-center space-y-3 max-w-lg mx-auto shadow-xs">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900">Acesso Restrito ao Perfil Developer</h3>
                <p className="text-xs text-slate-600">
                  O módulo de <strong>Controle e Permissões</strong> é de uso exclusivo do perfil <strong>Developer</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('filiais')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Voltar para Filiais
                </button>
              </div>
            ) : (
            <div className="space-y-3.5 sm:space-y-4">
              {/* CABEÇALHO DO MÓDULO DE CONTROLE E PERMISSÕES */}
              <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-600 text-white rounded-lg font-black shadow-xs shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span>Controle e Permissões de Acesso (RBAC)</span>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] rounded font-extrabold">
                        {SYSTEM_ROLES_PERMISSIONS_LIST.length} Perfis
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] rounded font-bold border border-emerald-200 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${savePermsIndicator === 'saving' ? 'bg-amber-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></span>
                        {savePermsIndicator === 'saving' ? 'Salvando...' : savePermsIndicator === 'saved' ? 'Salvo no Sistema' : 'Auto-Save Ativo'}
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Gerencie as permissões por perfil com persistência direta e segura no sistema.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    disabled={isSavingPerms || isLoadingPerms}
                    onClick={handleResetPermissionsMap}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoadingPerms ? 'animate-spin' : ''}`} />
                    <span>Restaurar Padrão</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSavingPerms}
                    onClick={handleSavePermissionsMap}
                    className="flex-1 sm:flex-none px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    <Save className={`w-3.5 h-3.5 ${isSavingPerms ? 'animate-spin' : ''}`} />
                    <span>{isSavingPerms ? 'Salvando...' : 'Salvar Permissões'}</span>
                  </button>
                </div>
              </div>

              {/* SELEÇÃO DE PERFIL / CARGO DO SISTEMA */}
              <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                  <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span>Selecione o Perfil para Configurar</span>
                  </span>
                  {selectedRoleObj && (
                    <span className={`px-2.5 py-0.5 border rounded-full text-[11px] font-black ${selectedRoleObj.badgeColor}`}>
                      {selectedRoleObj.level}
                    </span>
                  )}
                </div>

                {/* TABS DE PERFIS */}
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar scrollbar-none touch-pan-x min-w-0 w-full">
                  {SYSTEM_ROLES_PERMISSIONS_LIST.map((role) => {
                    const isSelected = selectedRoleForPerms === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setSelectedRoleForPerms(role.id)}
                        className={`px-3 py-1.5 sm:py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 border ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <KeyRound className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-purple-600'}`} />
                        <span>{role.id}</span>
                      </button>
                    );
                  })}
                </div>

                {/* DESCRIÇÃO DO PERFIL SELECIONADO */}
                {selectedRoleObj && (
                  <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                    <div>
                      <strong className="text-purple-900 font-extrabold">{selectedRoleObj.name}: </strong>
                      <span className="text-slate-600">{selectedRoleObj.description}</span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start shrink-0">
                      <button
                        type="button"
                        onClick={() => handleGrantAllForRole(selectedRoleForPerms)}
                        className="flex-1 sm:flex-none text-[11px] font-extrabold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded border border-emerald-200 transition cursor-pointer text-center"
                      >
                        ✓ Conceder Tudo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokeAllForRole(selectedRoleForPerms)}
                        className="flex-1 sm:flex-none text-[11px] font-extrabold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded border border-rose-200 transition cursor-pointer text-center"
                      >
                        ✕ Revogar Tudo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* MATRIZ DE PERMISSÕES POR MÓDULO */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full">
                <div className="p-3 sm:p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="truncate">Matriz de Permissões para "{selectedRoleForPerms}"</span>
                  </span>

                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar módulos..."
                      value={permSearchTerm}
                      onChange={(e) => setPermSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>
                </div>

                <div className="md:hidden px-3 py-1.5 bg-purple-50/70 border-b border-purple-100 text-[10px] text-purple-700 font-bold flex items-center justify-center gap-1.5">
                  <span>👉 Deslize horizontalmente para marcar as permissões</span>
                </div>

                <div className="overflow-x-auto w-full touch-pan-x">
                  <table className="w-full text-left border-collapse min-w-[760px]">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-4 min-w-[180px]">MODULOS DE MENU</th>
                        <th className="py-2.5 px-3 text-center">Visualizar Módulo</th>
                        <th className="py-2.5 px-3 text-center">Criar / Editar</th>
                        <th className="py-2.5 px-3 text-center">Excluir Registros</th>
                        <th className="py-2.5 px-3 text-center">Aprovar Desconto</th>
                        <th className="py-2.5 px-3 text-center">Voltar Ação</th>
                        <th className="py-2.5 px-3 text-center">Ver Custo / DRE</th>
                        <th className="py-2.5 px-3 text-center">Acesso Configurações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs font-semibold">
                      {filteredErpModules.map((mod) => {
                        const IconComp = mod.icon;
                        const activeRoleRules = getRoleRulesFromMap(permissionsMap, selectedRoleForPerms) || {};
                        const roleRules = getModuleRule(activeRoleRules, mod.id) || {
                          visualizar: false,
                          criarEditar: false,
                          excluir: false,
                          descontoEspecial: false,
                          voltarAcao: false,
                          verFinanceiro: false,
                          configuracoes: false,
                        };

                        return (
                          <tr key={mod.id} className="hover:bg-purple-50/20 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                              <div className="p-1.5 bg-slate-100 rounded-lg text-purple-700 shrink-0">
                                <IconComp className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="block text-xs font-extrabold text-slate-900">{mod.name}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{mod.category}</span>
                              </div>
                            </td>

                            {/* Visualizar */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={roleRules.visualizar}
                                onChange={() => handleTogglePermissionRule(selectedRoleForPerms, mod.id, 'visualizar')}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                              />
                            </td>

                            {/* Criar / Editar */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={roleRules.criarEditar}
                                onChange={() => handleTogglePermissionRule(selectedRoleForPerms, mod.id, 'criarEditar')}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                              />
                            </td>

                            {/* Excluir */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={roleRules.excluir}
                                onChange={() => handleTogglePermissionRule(selectedRoleForPerms, mod.id, 'excluir')}
                                className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                              />
                            </td>

                            {/* Desconto Especial */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={roleRules.descontoEspecial}
                                onChange={() => handleTogglePermissionRule(selectedRoleForPerms, mod.id, 'descontoEspecial')}
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>

                            {/* Voltar Ação (Exclusivo para Fluxo de produção / Kanban) */}
                            <td className="py-3 px-3 text-center">
                              {mod.id === 'kanban' ? (
                                <div className="inline-flex items-center justify-center gap-1.5 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 shadow-2xs">
                                  <input
                                    type="checkbox"
                                    id={`chk-voltar-acao-${selectedRoleForPerms}`}
                                    checked={Boolean(roleRules.voltarAcao)}
                                    onChange={() => handleTogglePermissionRule(selectedRoleForPerms, mod.id, 'voltarAcao')}
                                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                                  />
                                  <label
                                    htmlFor={`chk-voltar-acao-${selectedRoleForPerms}`}
                                    className="text-[10px] font-black text-amber-900 cursor-pointer select-none whitespace-nowrap"
                                  >
                                    Voltar Ação
                                  </label>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-bold text-xs" title="Função exclusiva do Fluxo de produção (kanbam)">-</span>
                              )}
                            </td>

                            {/* Ver Financeiro */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={roleRules.verFinanceiro}
                                onChange={() => handleTogglePermissionRule(selectedRoleForPerms, mod.id, 'verFinanceiro')}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </td>

                            {/* Configurações */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={roleRules.configuracoes}
                                onChange={() => handleTogglePermissionRule(selectedRoleForPerms, mod.id, 'configuracoes')}
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BARRA FIXA / FLUTUANTE DE SALVAMENTO E STATUS DAS PERMISSÕES */}
              <div className="sticky bottom-3 sm:bottom-4 z-20 mt-4 p-3 sm:p-3.5 bg-white/95 backdrop-blur border border-purple-200 rounded-xl shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${savePermsIndicator === 'saving' ? 'bg-amber-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></span>
                  <span className="font-extrabold text-slate-800 shrink-0">
                    Auto-Save Ativo
                  </span>
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <span className="text-slate-600 text-[11px] font-medium truncate sm:whitespace-normal">
                    {savePermsIndicator === 'saving'
                      ? 'Sincronizando com o servidor...'
                      : savePermsIndicator === 'saved'
                      ? '✓ Todas as alterações foram salvas com sucesso'
                      : `Perfil "${selectedRoleForPerms}": cada seleção é salva instantaneamente.`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSavingPerms}
                    onClick={handleSavePermissionsMap}
                    className="w-full sm:w-auto px-4 py-2 sm:py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    <Save className={`w-3.5 h-3.5 ${isSavingPerms ? 'animate-spin' : ''}`} />
                    <span>{isSavingPerms ? 'Gravando...' : 'Salvar Permissões Agora'}</span>
                  </button>
                </div>
              </div>
            </div>
            )
          )}

          {/* ----------------------------------------------------------------------------------- */}
          {/* ABA 3: METAS DE FILIAIS (LISTA INTERATIVA, METAS MENSAIS E META RELÂMPAGO) */}
          {/* ----------------------------------------------------------------------------------- */}
          {activeTab === 'metas' && (
            <div className="space-y-4">
              {/* CABEÇALHO GERAL DE METAS */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-lg font-black shadow-xs">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      Gestão de Metas por Filial
                      {selectedFilialMetaId && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded font-extrabold">
                          Modo Detalhado
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Selecione uma filial para gerenciar as metas mensais e a meta relâmpago do dia.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-extrabold text-slate-600">Ano:</span>
                  <select
                    value={metaPeriodMonth}
                    onChange={(e) => setMetaPeriodMonth(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="Agosto / 2026">2026 (Ano Corrente)</option>
                    <option value="Setembro / 2026">2027 (Próximo Exercício)</option>
                  </select>
                </div>
              </div>

              {/* LISTA DE FILIAIS COM OPÇÃO DE DEFINIR METAS */}
              <div className="space-y-3">
                  {/* BARRA DE PESQUISA DE FILIAIS EM METAS */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Pesquisar filial por código, nome ou cidade..."
                        value={searchTermMetaFiliais}
                        onChange={(e) => setSearchTermMetaFiliais(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                      {filiais.length} {filiais.length === 1 ? 'filial' : 'filiais'}
                    </span>
                  </div>

              {/* LISTA EM CARDS PARA DISPOSITIVOS MÓVEIS (MOBILE) */}
              <div className="block md:hidden space-y-3">
                {filiais.length > 0 ? (
                  filiais
                    .filter((f) => {
                      if (!searchTermMetaFiliais.trim()) return true;
                      const t = searchTermMetaFiliais.toLowerCase();
                      return f.nome.toLowerCase().includes(t) || f.codigo.toLowerCase().includes(t) || f.cidade.toLowerCase().includes(t);
                    })
                    .map((f) => {
                      const meta = getOrInitMetaFilial(f);
                      const pct = meta.metaMensalValor > 0 ? Math.round((meta.vendaAtualValor / meta.metaMensalValor) * 100) : 0;
                      const isFlashActive = meta.metaRelampago?.ativa;

                      return (
                        <div
                          key={`mobile-meta-filial-${f.id}`}
                          onClick={() => {
                            setSelectedFilialMetaId(f.id);
                            setMainViewMode('DEFINIR_META_FILIAL');
                          }}
                          className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3 cursor-pointer hover:border-blue-400 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="px-2 py-0.5 bg-slate-900 text-white rounded font-mono font-black text-[10px] shrink-0">
                                {f.codigo}
                              </span>
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-slate-900 text-xs truncate">{f.nome}</h4>
                                <p className="text-[10px] text-slate-500 font-normal truncate">{f.cidade} - {f.uf} • Resp: {f.responsavel}</p>
                              </div>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${pct >= 100 ? 'bg-emerald-100 text-emerald-800' : pct >= 75 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                              {pct}%
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">Meta Mensal</span>
                              <span className="font-black text-slate-900 text-[11px]">{formatMoney(meta.metaMensalValor)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">Realizado</span>
                              <span className="font-black text-emerald-700 text-[11px]">{formatMoney(meta.vendaAtualValor)}</span>
                            </div>
                            <div className="col-span-2 pt-1">
                              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-600' : 'bg-amber-500'}`}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div>
                              {isFlashActive ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-full text-[10px] font-black">
                                  <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                                  RELÂMPAGO ({formatMoney(meta.metaRelampago?.metaValorHoje || 0)})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                                  Padrão ({formatMoney(meta.metaDiariaValor)})
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1 shrink-0"
                            >
                              <span>Definir Metas</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-2">
                    <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-slate-800 font-black text-sm">Nenhuma filial cadastrada</p>
                  </div>
                )}
              </div>

              {/* TABELA DE FILIAIS CLICÁVEIS (DESKTOP) */}
              <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[720px]">
                    <thead>
                      <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-black text-slate-700 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Código / Filial</th>
                        <th className="py-2.5 px-3">Localização / Gerente</th>
                        <th className="py-2.5 px-3 text-right">Meta Mês</th>
                        <th className="py-2.5 px-3 text-right">Realizado</th>
                        <th className="py-2.5 px-3 w-40">Progresso do Mês</th>
                        <th className="py-2.5 px-3 text-center">Meta Relâmpago Hoje</th>
                        <th className="py-2.5 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                      {filiais.length > 0 ? (
                        filiais
                          .filter((f) => {
                            if (!searchTermMetaFiliais.trim()) return true;
                            const t = searchTermMetaFiliais.toLowerCase();
                            return f.nome.toLowerCase().includes(t) || f.codigo.toLowerCase().includes(t) || f.cidade.toLowerCase().includes(t);
                          })
                          .map((f) => {
                            const meta = getOrInitMetaFilial(f);
                            const pct = meta.metaMensalValor > 0 ? Math.round((meta.vendaAtualValor / meta.metaMensalValor) * 100) : 0;
                            const isFlashActive = meta.metaRelampago?.ativa;

                            return (
                              <tr
                                key={f.id}
                                onClick={() => {
                                  setSelectedFilialMetaId(f.id);
                                  setMainViewMode('DEFINIR_META_FILIAL');
                                }}
                                className="hover:bg-blue-50/40 transition cursor-pointer group"
                              >
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-slate-900 group-hover:bg-blue-600 text-white rounded font-mono font-black text-[10px] transition">
                                      {f.codigo}
                                    </span>
                                    <div>
                                      <div className="font-extrabold text-slate-900 text-xs">{f.nome}</div>
                                      {f.razaoSocial && <div className="text-[10px] text-slate-500 font-normal">{f.razaoSocial}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  <div className="font-bold text-slate-800">{f.cidade} - {f.uf}</div>
                                  <div className="text-[10px] text-slate-500 font-normal">{f.responsavel}</div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                  {formatMoney(meta.metaMensalValor)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                                  {formatMoney(meta.vendaAtualValor)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px]">
                                      <span className="font-extrabold text-slate-600">{pct}%</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${pct >= 100 ? 'bg-emerald-100 text-emerald-800' : pct >= 75 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                        {pct >= 100 ? 'META OK' : pct >= 75 ? 'ALTO' : 'EM ANDAMENTO'}
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full transition-all duration-300 rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-600' : 'bg-amber-500'}`}
                                        style={{ width: `${Math.min(100, pct)}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {isFlashActive ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-full text-[10px] font-black">
                                      <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                                      RELÂMPAGO ({formatMoney(meta.metaRelampago?.metaValorHoje || 0)})
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                                      Padrão ({formatMoney(meta.metaDiariaValor)})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedFilialMetaId(f.id);
                                    }}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1 ml-auto cursor-pointer"
                                  >
                                    <span>Definir Metas</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 font-bold text-xs">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Building2 className="w-8 h-8 text-slate-300" />
                              <p className="text-slate-800 font-black text-sm">Nenhuma filial cadastrada</p>
                              <button
                                type="button"
                                onClick={handleOpenNewFilial}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer mt-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Cadastrar Nova Filial
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
                </div>
              </div>
          )}

          {/* ----------------------------------------------------------------------------------- */}
          {/* ABA 3: BACKUP DO SISTEMA DIA / MÊS & IMPORTAR BACKUP - EXCLUSIVO DEVELOPER */}
          {/* ----------------------------------------------------------------------------------- */}
          {activeTab === 'backup' && (
            !isDeveloperUser ? (
              <div className="bg-white p-8 rounded-xl border border-rose-200 text-center space-y-3 max-w-lg mx-auto shadow-xs">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900">Acesso Restrito ao Perfil Developer</h3>
                <p className="text-xs text-slate-600">
                  O módulo de <strong>Backup DIA/MÊS</strong> é de uso exclusivo do perfil <strong>Developer</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('filiais')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Voltar para Filiais
                </button>
              </div>
            ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CARD 1: EXPORTAR BACKUP */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-lg font-black">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-900">Gerar Backup Manual (DIA / MÊS)</h2>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Exporte o snapshot completo do banco de dados em formato JSON.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleExportBackup('DIA')}
                      className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition flex flex-col items-center justify-center gap-1 group cursor-pointer shadow-xs"
                    >
                      <FileDown className="w-4 h-4 text-amber-400" />
                      <span>Backup Diário (.JSON)</span>
                      <span className="text-[10px] font-normal text-slate-400">Snapshot de Hoje</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportBackup('MES')}
                      className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition flex flex-col items-center justify-center gap-1 group cursor-pointer shadow-xs"
                    >
                      <Database className="w-4 h-4 text-white" />
                      <span>Backup Mensal (.JSON)</span>
                      <span className="text-[10px] font-normal text-blue-200">Consolidado do Mês</span>
                    </button>
                  </div>
                </div>

                {/* CARD 2: IMPORTAR BACKUP */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                    <div className="p-2 bg-blue-100 text-blue-800 rounded-lg font-black">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-900">Importar Arquivo de Backup</h2>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Restaure cadastros e histórico enviando um arquivo .json.
                      </p>
                    </div>
                  </div>

                  <div className="border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 rounded-lg p-4 text-center transition cursor-pointer relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-800">Clique ou arraste o arquivo de backup (.json)</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Formatos suportados: JSON gerado pelo ERP SubliGestão</p>
                  </div>
                </div>
              </div>

              {/* HISTÓRICO DE BACKUPS REALIZADOS */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                <h3 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Histórico de Backups Gerados
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 text-[10px] font-black text-slate-600 uppercase border-b border-slate-200">
                        <th className="py-2 px-3">Data / Hora</th>
                        <th className="py-2 px-3">Tipo</th>
                        <th className="py-2 px-3">Nome do Arquivo</th>
                        <th className="py-2 px-3">Tamanho</th>
                        <th className="py-2 px-3">Registros</th>
                        <th className="py-2 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                      {backupLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-600">{log.dataHora}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                log.tipo === 'DIA'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {log.tipo}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-900">{log.nomeArquivo}</td>
                          <td className="py-2 px-3 text-slate-500">{log.tamanho}</td>
                          <td className="py-2 px-3 text-slate-800">{log.qtdRegistros} itens</td>
                          <td className="py-2 px-3 text-right">
                            <span className="text-emerald-700 font-extrabold flex items-center justify-end gap-1 text-[11px]">
                              <Check className="w-3 h-3" /> Concluído
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )
          )}

          {/* ----------------------------------------------------------------------------------- */}
          {/* ABA 4: LIMPAR ERP / NOVO INÍCIO - EXCLUSIVO DEVELOPER */}
          {/* ----------------------------------------------------------------------------------- */}
          {activeTab === 'limpar' && (
            !isDeveloperUser ? (
              <div className="bg-white p-8 rounded-xl border border-rose-200 text-center space-y-3 max-w-lg mx-auto shadow-xs">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900">Acesso Restrito ao Perfil Developer</h3>
                <p className="text-xs text-slate-600">
                  O módulo de <strong>Limpar ERP</strong> é de uso exclusivo do perfil <strong>Developer</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('filiais')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Voltar para Filiais
                </button>
              </div>
            ) : (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="bg-white p-6 rounded-xl border border-rose-200 shadow-xs space-y-4 text-center">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6" />
                </div>

                <div>
                  <h2 className="text-base font-black text-slate-900 flex items-center justify-center gap-2">
                    <span>Limpar ERP / Novo Início</span>
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] rounded font-black uppercase">
                      Exclusivo Dev
                    </span>
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto leading-normal">
                    Esta operação realiza a redefinição total dos lançamentos e ordens do sistema.
                    Ideal para zerar dados de testes antes de iniciar a operação oficial.
                  </p>
                </div>

                <div className="bg-rose-50/80 p-3.5 rounded-lg border border-rose-200 text-left text-xs font-bold text-rose-900 space-y-1">
                  <p className="font-black flex items-center gap-1.5 text-rose-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> O que será zerado com esta ação:
                  </p>
                  <ul className="list-disc list-inside text-rose-700 pl-1 space-y-0.5 text-[11px]">
                    <li>Todas as Ordens de Serviço (OS) e Histórico do Kanban;</li>
                    <li>Todas as Vendas Diretas e Lançamentos do PDV / Caixa;</li>
                    <li>Lista de Clientes e Produtos de Estoque locais;</li>
                    <li>Restaura os cadastros de Filiais para os padrões originais.</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => setShowClearModal(true)}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs transition shadow-xs flex items-center gap-1.5 mx-auto cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar ERP / Zerar Dados
                </button>
              </div>
            </div>
            )
          )}

          {/* =================================================================================== */}
          {/* ABA 6: TEMAS DIVERSOS (ADMIN / DEVELOPER - SINCRONIZADO AO SUPABASE) */}
          {/* =================================================================================== */}
          {activeTab === 'temas' && (isSettingsAdmin || isDeveloperUser) && (
            <ThemesSettingsSection
              isSettingsAdmin={isSettingsAdmin}
              isDeveloperUser={isDeveloperUser}
            />
          )}
        </div>
      )}

      {/* =================================================================================== */}
      {/* VISTA 2: PÁGINA EM TELA CHEIA - CADASTRO DE FILIAIS (ESTRUTURA COPIADA DE CLIENTES/PJ) */}
      {/* =================================================================================== */}
      {mainViewMode === 'CADASTRO_FILIAL' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col space-y-0">
          {/* BARRA SUPERIOR DO CADASTRO DE FILIAIS EM TELA CHEIA */}
          <div className="bg-blue-600 text-white p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg shrink-0">
                <Building2 className="w-5 h-5 text-cyan-200" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight">CADASTRO DE FILIAIS</h1>
                <p className="text-[11px] text-blue-100 font-medium">
                  Formulário corporativo de cadastro e parametrização da Filial / Empresa (Pessoa Jurídica)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMainViewMode('SETTINGS_HOME')}
              className="w-full sm:w-auto px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar às Configurações</span>
            </button>
          </div>

          {/* ESTRUTURA DO FORMULÁRIO PJ (COPIADA EXATAMENTE DO MÓDULO DE CLIENTES/PJ) */}
          <div className="p-3.5 sm:p-5 space-y-4 sm:space-y-5">
            {/* SELETOR DE TIPO (EXIBINDO ESTRUTURA PESSOA JURÍDICA - PJ) */}
            <div className="flex items-center justify-start border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg font-extrabold text-xs shadow-xs">
                <Building2 className="w-4 h-4" />
                <span>Pessoa Jurídica (PJ)</span>
              </div>
            </div>

            <form onSubmit={handleSaveFilialForm} className="space-y-4 sm:space-y-5">
              {/* SEÇÃO 1: DADOS DA EMPRESA / FILIAL */}
              <div className="space-y-3.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Dados da Empresa - Cadastro de Filiais</span>
                  </h2>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                    <span className="text-xs font-bold text-slate-600">Código da Filial:</span>
                    <input
                      type="text"
                      required
                      value={codigoFilial}
                      onChange={(e) => setCodigoFilial(e.target.value.toUpperCase())}
                      placeholder="Ex: FL-05"
                      className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-md text-xs font-black text-blue-700 w-24 uppercase focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5">
                  {/* TIPO DE UNIDADE (MATRIZ / FILIAL) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tipo de Unidade <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={tipo}
                      onChange={(e) => {
                        const val = e.target.value as 'MATRIZ' | 'FILIAL';
                        setTipo(val);
                        if (val === 'MATRIZ' && !codigoFilial) {
                          setCodigoFilial('MATRIZ');
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none cursor-pointer"
                    >
                      <option value="MATRIZ">Matriz</option>
                      <option value="FILIAL">Filial</option>
                    </select>
                  </div>

                  {/* RAZÃO SOCIAL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Razão Social <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={pjRazaoSocial}
                      onChange={(e) => setPjRazaoSocial(e.target.value)}
                      placeholder="Ex: TECIDO SUBLIMADO FORTALEZA"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* NOME FANTASIA / IDENTIFICAÇÃO DA FILIAL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome Fantasia / Identificação <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={pjNomeFantasia}
                      onChange={(e) => setPjNomeFantasia(e.target.value)}
                      placeholder="Ex: TECIDO SUBLIMADO FORTALEZA"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* LOGO DA EMPRESA (URL) */}
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Logo da Empresa (URL da Imagem)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://exemplo.com/logo.png"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                      {logoUrl && (
                        <div className="w-8 h-8 rounded border border-slate-300 bg-slate-50 p-0.5 shrink-0 overflow-hidden">
                          <img src={logoUrl} alt="Preview" className="w-full h-full object-contain" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CNPJ */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      CNPJ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={pjCnpj}
                      onChange={(e) => setPjCnpj(formatCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-mono font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* INSCRIÇÃO ESTADUAL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Inscrição Estadual (IE)
                    </label>
                    <input
                      type="text"
                      value={pjInscricaoEstadual}
                      onChange={(e) => setPjInscricaoEstadual(e.target.value)}
                      placeholder="Ex: 061671967 ou ISENTO"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* TELEFONE CORPORATIVO */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Telefone Corporativo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhone(e.target.value))}
                      placeholder="(85) 98425-1321"
                      maxLength={15}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* WHATSAPP COMERCIAL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      WhatsApp Comercial
                    </label>
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                      placeholder="(85) 98425-1321"
                      maxLength={15}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* EMAIL COMERCIAL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      E-mail Comercial
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contato@tecidosublimado.com.br"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* GERENTE / RESPONSÁVEL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Gerente / Responsável da Filial <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      placeholder="Ex: Gerente Geral Matriz"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* STATUS DA FILIAL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'ATIVA' | 'INATIVA')}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none cursor-pointer"
                    >
                      <option value="ATIVA">Ativa</option>
                      <option value="INATIVA">Inativa</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: COMPONENTE REUTILIZÁVEL DE ENDEREÇO DA FILIAL */}
              <AddressForm value={address} onChange={setAddress} />

              {/* BARRA INFERIOR DE AÇÕES E SALVAMENTO */}
              <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setMainViewMode('SETTINGS_HOME')}
                  className="w-full sm:w-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para Configurações</span>
                </button>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {editingFilialId && (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteFilial(editingFilialId, pjNomeFantasia || 'esta filial');
                        setMainViewMode('SETTINGS_HOME');
                      }}
                      className="w-full sm:w-auto px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      title="Excluir esta Filial do Sistema"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Excluir Filial</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={resetFilialForm}
                    className="w-full sm:w-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Limpar Campos
                  </button>

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-cyan-200" />
                    <span>Salvar Cadastro de Filial</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================================== */}
      {/* VISTA 3: PÁGINA EM TELA CHEIA - DEFINIÇÃO DE METAS DA FILIAL */}
      {/* =================================================================================== */}
      {mainViewMode === 'DEFINIR_META_FILIAL' && (() => {
        const currentFilial = filiais.find((f) => f.id === selectedFilialMetaId) || filiais[0];
        if (!currentFilial) {
          return (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-slate-800 font-extrabold text-sm">Nenhuma filial selecionada para definir metas.</p>
              <button
                type="button"
                onClick={() => setMainViewMode('SETTINGS_HOME')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                Voltar às Configurações
              </button>
            </div>
          );
        }

        const meta = getOrInitMetaFilial(currentFilial);
        const relampago = meta.metaRelampago || {
          ativa: false,
          titulo: 'Meta Relâmpago Flash do Dia',
          metaValorHoje: 3300,
          metaQtdOsHoje: 12,
          realizadoHojeValor: 0,
          realizadoHojeOs: 0,
        };

        const currentMonthIndex = new Date().getMonth();
        const monthsOrderedFromCurrent = Array.from({ length: 12 }, (_, i) => {
          const mIdx = (currentMonthIndex + i) % 12;
          return {
            mesIndex: mIdx,
            mesNome: MESES_ANO[mIdx],
            isCurrent: mIdx === currentMonthIndex,
          };
        });

        const displayedMonthlyMetas = monthsOrderedFromCurrent
          .map((m) => (meta.metasMensais || []).find((x) => x.mesIndex === m.mesIndex)!)
          .filter(Boolean)
          .filter((m) => selectedMonthFilter === 'ALL' || m.mesIndex === selectedMonthFilter);

        return (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col space-y-0">
            {/* BARRA SUPERIOR DA DEFINIÇÃO DE METAS EM TELA CHEIA */}
            <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-lg font-black shadow-xs shrink-0">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-black tracking-tight flex items-center gap-2">
                    METAS
                    <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 font-mono font-black text-xs rounded">
                      {currentFilial.codigo}
                    </span>
                  </h1>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMainViewMode('SETTINGS_HOME')}
                className="w-full sm:w-auto px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <ArrowLeft className="w-4 h-4 text-emerald-400" />
                <span>Voltar às Configurações</span>
              </button>
            </div>

            <div className="p-3.5 sm:p-5 space-y-4">
              {/* SUB-ABAS NAVEGAÇÃO DE METAS DA FILIAL E SELETOR DE MÊS */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setMetaSubTab('mensal')}
                    className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg font-extrabold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                      metaSubTab === 'mensal'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Metas Mensais (12 Meses)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetaSubTab('relampago')}
                    className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg font-extrabold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                      metaSubTab === 'relampago'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-950" />
                    <span>Meta Relâmpago "Dia a Dia"</span>
                    {relampago.ativa && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </button>
                </div>

                {metaSubTab === 'mensal' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-2xs w-full sm:w-auto">
                    <label className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Selecionar Mês:</span>
                    </label>
                    <select
                      value={selectedMonthFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedMonthFilter(val === 'ALL' ? 'ALL' : Number(val));
                      }}
                      className="w-full sm:w-auto px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">Todos os Meses (a partir de {MESES_ANO[currentMonthIndex]})</option>
                      {monthsOrderedFromCurrent.map((m) => (
                        <option key={m.mesIndex} value={m.mesIndex}>
                          {m.mesNome} {m.isCurrent ? '(Mês Atual)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* CONTEÚDO SUB-ABA 1: METAS MENSAIS INDIVIDUAIS (12 MESES) */}
              {metaSubTab === 'mensal' && (
                <div className="space-y-4">
                  {/* TOOLBAR BATCH AUTO-APLICAR */}
                  <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Ajuste Rápido de Meta para Todos os Meses
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Defina um valor padrão e replique para os 12 meses do ano nesta filial.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                      <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs font-bold text-slate-500">R$</span>
                        <input
                          type="text"
                          value={batchMetaInputStr}
                          onChange={handleBatchInputChange}
                          onBlur={handleBatchInputBlur}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          placeholder="0,00"
                          className="w-full sm:w-32 bg-transparent text-xs font-black text-slate-900 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyBatchMonthlyMeta(currentFilial.id, batchMetaValor)}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5 text-cyan-200" />
                        <span>Aplicar aos 12 Meses</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveMetas(currentFilial.nome)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Save className="w-3.5 h-3.5 text-emerald-200" />
                        <span>Salvar Metas</span>
                      </button>
                    </div>
                  </div>

                  {/* GRADE DE METAS DE CADA MÊS INDIVIDUAL */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayedMonthlyMetas.map((m) => {
                      const isCurrentMonth = m.mesIndex === currentMonthIndex;
                      const pctM = m.metaValor > 0 ? Math.round((m.vendaAtualValor / m.metaValor) * 100) : 0;

                      return (
                        <div
                          key={m.mesIndex}
                          className={`bg-white p-3.5 rounded-xl border transition shadow-xs space-y-2.5 ${
                            isCurrentMonth
                              ? 'border-emerald-500 ring-1 ring-emerald-500/30 bg-emerald-50/10'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-slate-100 font-bold text-slate-700 text-[11px] flex items-center justify-center">
                                {m.mesIndex + 1}
                              </span>
                              <h4 className="font-extrabold text-xs text-slate-900">{m.mesNome}</h4>
                            </div>
                            {isCurrentMonth && (
                              <span className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded">
                                Mês Atual
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-xs font-bold text-slate-700">
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-500 mb-0.5">
                                Meta Mensal (R$)
                              </label>
                              <input
                                type="number"
                                value={m.metaValor || ''}
                                onChange={(e) =>
                                  handleUpdateMonthlyMeta(currentFilial.id, m.mesIndex, 'metaValor', Number(e.target.value))
                                }
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => e.currentTarget.select()}
                                onWheel={(e) => e.currentTarget.blur()}
                                placeholder="0"
                                className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-500 mb-0.5">
                                  Meta OS (Qtd)
                                </label>
                                <input
                                  type="number"
                                  value={m.metaQtdOs || ''}
                                  onChange={(e) =>
                                    handleUpdateMonthlyMeta(currentFilial.id, m.mesIndex, 'metaQtdOs', Number(e.target.value))
                                  }
                                  onFocus={(e) => e.target.select()}
                                  onClick={(e) => e.currentTarget.select()}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="0"
                                  className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-500 mb-0.5">
                                  Ticket Médio
                                </label>
                                <div className="px-2.5 py-1 bg-slate-100 rounded-lg font-mono text-slate-700 text-xs text-right font-bold">
                                  {formatMoney(m.metaTicketMedio)}
                                </div>
                              </div>
                            </div>

                            {/* PROGRESSO DO MÊS */}
                            <div className="pt-0.5">
                              <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-0.5">
                                <span>Realizado: {formatMoney(m.vendaAtualValor)}</span>
                                <span className="text-emerald-700 font-extrabold">{pctM}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${pctM >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                                  style={{ width: `${Math.min(100, pctM)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CONTEÚDO SUB-ABA 2: META RELÂMPAGO DO DIA AO DIA */}
              {metaSubTab === 'relampago' && (
                <div className="space-y-4">
                  {/* CARD CENTRAL DE META RELÂMPAGO DO DIA */}
                  <div className={`p-4 sm:p-5 rounded-xl border shadow-xs space-y-4 transition ${
                    relampago.ativa
                      ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-400/30'
                      : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg font-black ${relampago.ativa ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-600'}`}>
                          <Zap className="w-5 h-5 fill-current" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            Meta Relâmpago do Dia
                            {relampago.ativa ? (
                              <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black rounded uppercase">
                                ATIVA
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded uppercase">
                                INATIVA
                              </span>
                            )}
                          </h3>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Meta relâmpago diária para motivar vendas pontuais.
                          </p>
                        </div>
                      </div>

                      {/* TOGGLE SWITCH DE META RELÂMPAGO */}
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateMetaRelampago(currentFilial.id, { ativa: !relampago.ativa })
                        }
                        className={`px-4 py-2 rounded-lg font-black text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer ${
                          relampago.ativa
                            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>{relampago.ativa ? 'Desativar Meta Relâmpago' : 'Ativar Meta Relâmpago para Hoje'}</span>
                      </button>
                    </div>

                    {/* PAINEL DE CONFIGURAÇÃO DA META RELÂMPAGO */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-bold text-slate-800">
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-extrabold text-slate-500 mb-0.5">
                          Título / Motivo da Meta Relâmpago
                        </label>
                        <input
                          type="text"
                          value={relampago.titulo}
                          onChange={(e) =>
                            handleUpdateMetaRelampago(currentFilial.id, { titulo: e.target.value })
                          }
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          placeholder="Ex: Blitz de Sexta - Desconto Sublimação"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 mb-0.5">
                          Meta Relâmpago de Hoje (R$)
                        </label>
                        <input
                          type="number"
                          value={relampago.metaValorHoje}
                          onChange={(e) =>
                            handleUpdateMetaRelampago(currentFilial.id, { metaValorHoje: Number(e.target.value) })
                          }
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg font-black text-amber-950 focus:outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 mb-0.5">
                          Meta OS Relâmpago (Qtd)
                        </label>
                        <input
                          type="number"
                          value={relampago.metaQtdOsHoje}
                          onChange={(e) =>
                            handleUpdateMetaRelampago(currentFilial.id, { metaQtdOsHoje: Number(e.target.value) })
                          }
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 mb-0.5">
                          Realizado Hoje (R$)
                        </label>
                        <input
                          type="number"
                          value={relampago.realizadoHojeValor || ''}
                          onChange={(e) =>
                            handleUpdateMetaRelampago(currentFilial.id, { realizadoHojeValor: Number(e.target.value) })
                          }
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="0"
                          className="w-full px-3 py-1.5 bg-emerald-50 border border-emerald-300 rounded-lg font-black text-emerald-950 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-extrabold text-slate-500 mb-0.5">
                          Orientações / Observações
                        </label>
                        <input
                          type="text"
                          value={relampago.observacoes || ''}
                          onChange={(e) =>
                            handleUpdateMetaRelampago(currentFilial.id, { observacoes: e.target.value })
                          }
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          placeholder="Ex: Foco nos produtos de maior margem..."
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* CARD AO VIVO DO DIA */}
                    {relampago.ativa && (
                      <div className="p-3.5 bg-slate-900 text-white rounded-lg space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-extrabold text-amber-400 flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 fill-amber-400" />
                            PROGRESSO DA META RELÂMPAGO HOJE
                          </span>
                          <span className="font-extrabold text-slate-300 text-[11px]">
                            {relampago.metaValorHoje > 0
                              ? Math.round((relampago.realizadoHojeValor / relampago.metaValorHoje) * 100)
                              : 0}
                            % ATINGIDO
                          </span>
                        </div>

                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                relampago.metaValorHoje > 0
                                  ? Math.round((relampago.realizadoHojeValor / relampago.metaValorHoje) * 100)
                                  : 0
                              )}%`,
                            }}
                          />
                        </div>

                        <div className="flex justify-between text-[10px] font-bold text-slate-300">
                          <span>Realizado: {formatMoney(relampago.realizadoHojeValor)} ({relampago.realizadoHojeOs} OS)</span>
                          <span>Meta Flash: {formatMoney(relampago.metaValorHoje)} ({relampago.metaQtdOsHoje} OS)</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PLANEJAMENTO POR DIA DA SEMANA */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        Planejamento Padrão "Dia a Dia" (Por Dia da Semana)
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Meta diária recorrente para cada dia de funcionamento.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                      {(meta.metasDiaSemana || []).map((d) => (
                        <div key={d.diaCodigo} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                          <div className="text-[10px] font-black text-slate-800 pb-0.5 border-b border-slate-200 uppercase">
                            {d.diaNome}
                          </div>
                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 mb-0.5">Meta (R$)</label>
                            <input
                              type="number"
                              value={d.metaValor}
                              onChange={(e) =>
                                handleUpdateMetaDiaSemana(currentFilial.id, d.diaCodigo, 'metaValor', Number(e.target.value))
                              }
                              onFocus={(e) => e.target.select()}
                              onClick={(e) => e.currentTarget.select()}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-black text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 mb-0.5">Meta OS (Qtd)</label>
                            <input
                              type="number"
                              value={d.metaQtdOs}
                              onChange={(e) =>
                                handleUpdateMetaDiaSemana(currentFilial.id, d.diaCodigo, 'metaQtdOs', Number(e.target.value))
                              }
                              onFocus={(e) => e.target.select()}
                              onClick={(e) => e.currentTarget.select()}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ----------------------------------------------------------------------------------- */}
      {/* MODAL: PRÉ-VISUALIZAÇÃO DE IMPORTAÇÃO DE BACKUP */}
      {/* ----------------------------------------------------------------------------------- */}
      {showImportModal && importBackupData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-blue-900 text-white flex items-center justify-between">
              <h3 className="font-black text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-300" />
                Confirmar Restauração de Backup
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-white hover:bg-white/20 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-bold text-slate-700">
              <p className="text-slate-600">
                Arquivo selecionado: <strong className="text-slate-900">{importFileName}</strong>
              </p>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <p className="font-black text-slate-900 text-xs">Resumo do Arquivo:</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>Sistema: <strong>{importBackupData.metaSystem}</strong></div>
                  <div>Tipo: <strong>{importBackupData.tipoBackup}</strong></div>
                  <div>Gerado por: <strong>{importBackupData.geradoPor}</strong></div>
                  <div>Filiais no arquivo: <strong>{importBackupData.data?.filiais?.length || 0}</strong></div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px]">
                ⚠️ Atenção: A restauração de backup irá atualizar as informações de filiais e lançamentos existentes.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black transition flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Restaurar Dados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------- */}
      {/* MODAL: CONFIRMAÇÃO DE LIMPEZA DO ERP */}
      {/* ----------------------------------------------------------------------------------- */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-rose-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-rose-900 text-white flex items-center justify-between">
              <h3 className="font-black text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300" />
                Confirmação de Segurança - Limpar ERP
              </h3>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="text-white hover:bg-white/20 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-bold text-slate-700">
              <p className="text-rose-900 font-extrabold text-xs">
                Você está prestes a apagar todas as Ordens de Serviço, lançamentos do PDV e histórico de clientes do sistema.
              </p>

              <div>
                <label className="block mb-1 text-slate-800">
                  Para confirmar esta ação irreversível, digite <strong className="text-rose-600 font-black">LIMPAR</strong> abaixo:
                </label>
                <input
                  type="text"
                  placeholder="Digite LIMPAR para confirmar"
                  value={clearConfirmationText}
                  onChange={(e) => setClearConfirmationText(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteClearErp}
                  disabled={clearConfirmationText.toUpperCase() !== 'LIMPAR'}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-black transition flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Confirmar Limpeza Total
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE FILIAL (Sem window.confirm para funcionar em iframe) */}
      {filialToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Excluir Filial</h3>
                <p className="text-xs text-slate-500">Confirmação de exclusão permanente</p>
              </div>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Tem certeza que deseja excluir o cadastro da filial{' '}
              <strong className="text-slate-900 font-black">"{filialToDelete.nome}"</strong>?
              Esta ação removerá a unidade do sistema e do banco de dados PostgreSQL.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFilialToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteFilial}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir Filial</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE TODAS AS FILIAIS */}
      {isConfirmingDeleteAllFiliais && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Excluir Todas as Filiais</h3>
                <p className="text-xs text-slate-500">Confirmação de exclusão em massa</p>
              </div>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Tem certeza que deseja excluir <strong className="text-rose-600 font-black">TODAS ({filiais.length})</strong> as filiais cadastradas em Configurações?
              Esta ação removerá todas as unidades do sistema e do banco de dados PostgreSQL.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmingDeleteAllFiliais(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAllFiliais}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir Todas as Filiais</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
