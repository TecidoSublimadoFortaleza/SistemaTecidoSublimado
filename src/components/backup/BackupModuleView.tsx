import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  Calendar,
  Package,
  Users,
  Building2,
  FileText,
  ShoppingCart,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileDown,
  FileUp,
  Sliders,
  CheckSquare,
  Square,
  Sparkles,
  Info,
  Clock,
  HardDrive,
  Layers,
  ArrowRight,
  FileCode2,
  Calculator,
  History,
} from 'lucide-react';
import { UserProfile } from '../../types/frontend';
import { ApiService } from '../../services/api';
import { isDeveloperOrAdminMaster } from '../../utils/userPermissions';

interface BackupModuleViewProps {
  user?: UserProfile | null;
}

type BackupModuleKey =
  | 'estoque'
  | 'funcionarios'
  | 'clientes'
  | 'os'
  | 'vnd'
  | 'mensagens'
  | 'historicoPermissoes'
  | 'filiais'
  | 'historicoNotasFiscais'
  | 'calculosProduto'
  | 'historicoMudancas';

interface ModuleConfig {
  key: BackupModuleKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
  badgeColor: string;
  borderColor: string;
  textColor: string;
  bgLight: string;
}

// CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
// Mantém os 6 módulos originais e as entidades existentes (Permissões, Filiais, NF-e) inalterados,
// e adiciona as novas entidades do sistema solicitadas:
// 1) Calculos de produto ("Cadastrar este produto como Com Medidas")
// 2) Históricos de mudanças do sistema (metas, configurações, etc)
const BACKUP_MODULES: ModuleConfig[] = [
  {
    key: 'estoque',
    label: 'ESTOQUE',
    shortLabel: 'Estoque & Produtos',
    description: 'Catálogo de produtos, categorias, saldos, preços e códigos',
    icon: Package,
    badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    borderColor: 'border-amber-200 dark:border-amber-900/40',
    textColor: 'text-amber-600',
    bgLight: 'bg-amber-50 dark:bg-amber-950/20',
  },
  {
    key: 'funcionarios',
    label: 'FUNCIONÁRIOS',
    shortLabel: 'Funcionários & Usuários',
    description: 'Colaboradores, contas de acesso ao sistema e permissões',
    icon: Users,
    badgeColor: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    borderColor: 'border-purple-200 dark:border-purple-900/40',
    textColor: 'text-purple-600',
    bgLight: 'bg-purple-50 dark:bg-purple-950/20',
  },
  {
    key: 'clientes',
    label: 'CLIENTES',
    shortLabel: 'Clientes PF / PJ',
    description: 'Base completa de clientes, contatos, CNPJ/CPF e endereços',
    icon: Building2,
    badgeColor: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    borderColor: 'border-blue-200 dark:border-blue-900/40',
    textColor: 'text-blue-600',
    bgLight: 'bg-blue-50 dark:bg-blue-950/20',
  },
  {
    key: 'os',
    label: 'OS',
    shortLabel: 'Ordens de Serviço & Orçamentos',
    description: 'Ordens de serviço, orçamentos, histórico de estágios e itens',
    icon: FileText,
    badgeColor: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    borderColor: 'border-indigo-200 dark:border-indigo-900/40',
    textColor: 'text-indigo-600',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/20',
  },
  {
    key: 'vnd',
    label: 'VND',
    shortLabel: 'Vendas Diretas & PDV',
    description: 'Transações de caixa, vendas balcão, pagamentos e cupons',
    icon: ShoppingCart,
    badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    borderColor: 'border-emerald-200 dark:border-emerald-900/40',
    textColor: 'text-emerald-600',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/20',
  },
  {
    key: 'mensagens',
    label: 'MENSAGENS INTERNAS',
    shortLabel: 'Chat & Mensagens Internas',
    description: 'Histórico de conversas internas, canais, grupos e suporte',
    icon: MessageSquare,
    badgeColor: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    borderColor: 'border-rose-200 dark:border-rose-900/40',
    textColor: 'text-rose-600',
    bgLight: 'bg-rose-50 dark:bg-rose-950/20',
  },
  {
    key: 'historicoPermissoes',
    label: 'HISTÓRICO DE CONTROLE DE PERMISSÕES',
    shortLabel: 'Histórico de Controle de Permissões',
    description: 'Matriz de permissões RBAC por perfil, logs de auditoria e controle de acessos',
    icon: ShieldCheck,
    badgeColor: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
    borderColor: 'border-violet-200 dark:border-violet-900/40',
    textColor: 'text-violet-600',
    bgLight: 'bg-violet-50 dark:bg-violet-950/20',
  },
  {
    key: 'filiais',
    label: 'FILIAIS',
    shortLabel: 'Filiais & Unidades da Empresa',
    description: 'Cadastro de filiais e matriz, dados fiscais, CNPJ, endereços e identificação',
    icon: Building2,
    badgeColor: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20',
    borderColor: 'border-teal-200 dark:border-teal-900/40',
    textColor: 'text-teal-600',
    bgLight: 'bg-teal-50 dark:bg-teal-950/20',
  },
  {
    key: 'historicoNotasFiscais',
    label: 'HISTÓRICO DE NOTAS FISCAIS',
    shortLabel: 'Histórico de Notas Fiscais & NFC-e',
    description: 'Registro de notas fiscais emitidas, NF-e/NFC-e, XMLs, status SEFAZ e cancelamentos',
    icon: FileCode2,
    badgeColor: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
    borderColor: 'border-orange-200 dark:border-orange-900/40',
    textColor: 'text-orange-600',
    bgLight: 'bg-orange-50 dark:bg-orange-950/20',
  },
  {
    key: 'calculosProduto',
    label: 'CÁLCULOS DE PRODUTO',
    shortLabel: 'Cálculos de Produto ("Com Medidas")',
    description: 'Armazena todos os cálculos criados em "Cadastrar este produto como Com Medidas"',
    icon: Calculator,
    badgeColor: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/20',
    borderColor: 'border-fuchsia-200 dark:border-fuchsia-900/40',
    textColor: 'text-fuchsia-600',
    bgLight: 'bg-fuchsia-50 dark:bg-fuchsia-950/20',
  },
  {
    key: 'historicoMudancas',
    label: 'HISTÓRICOS DE MUDANÇAS DO SISTEMA',
    shortLabel: 'Históricos de Mudanças do Sistema',
    description: 'Armazena o histórico das mudanças do sistema não salvas em outras entidades (ex: metas)',
    icon: History,
    badgeColor: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
    borderColor: 'border-cyan-200 dark:border-cyan-900/40',
    textColor: 'text-cyan-600',
    bgLight: 'bg-cyan-50 dark:bg-cyan-950/20',
  },
];

export const BackupModuleView: React.FC<BackupModuleViewProps> = ({ user }) => {
  const isAuthorized = isDeveloperOrAdminMaster(
    user?.role,
    user?.isDeveloper,
    user?.username,
    user?.name
  );

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Filtros de Data
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateFilterPreset, setDateFilterPreset] = useState<string>('all');

  // Seleção de Módulos (11 entidades do sistema com suporte completo)
  const [selectedModules, setSelectedModules] = useState<BackupModuleKey[]>([
    'estoque',
    'funcionarios',
    'clientes',
    'os',
    'vnd',
    'mensagens',
    'historicoPermissoes',
    'filiais',
    'historicoNotasFiscais',
    'calculosProduto',
    'historicoMudancas',
  ]);

  // Opções Avançadas
  const [includeImages, setIncludeImages] = useState<boolean>(true);

  // Estatísticas em Tempo Real
  const [stats, setStats] = useState<Record<BackupModuleKey, number>>({
    estoque: 0,
    funcionarios: 0,
    clientes: 0,
    os: 0,
    vnd: 0,
    mensagens: 0,
    historicoPermissoes: 0,
    filiais: 0,
    historicoNotasFiscais: 0,
    calculosProduto: 0,
    historicoMudancas: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);

  // Estados de Exportação
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccessInfo, setExportSuccessInfo] = useState<any | null>(null);
  const [recentExports, setRecentExports] = useState<Array<{ name: string; size: string; timestamp: string; count: number }>>([]);

  // Estados de Importação
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPackage, setImportPackage] = useState<any | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importModulesToApply, setImportModulesToApply] = useState<BackupModuleKey[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega estatísticas do banco
  const loadStats = async (start = startDate, end = endDate) => {
    try {
      setIsLoadingStats(true);
      const res = await ApiService.getBackupStats({
        startDate: start || undefined,
        endDate: end || undefined,
      });
      setStats({
        estoque: res.estoque || 0,
        funcionarios: res.funcionarios || 0,
        clientes: res.clientes || 0,
        os: res.os || 0,
        vnd: res.vnd || 0,
        mensagens: res.mensagens || 0,
        historicoPermissoes: res.historicoPermissoes || 0,
        filiais: res.filiais || 0,
        historicoNotasFiscais: res.historicoNotasFiscais || 0,
        calculosProduto: res.calculosProduto || 0,
        historicoMudancas: res.historicoMudancas || 0,
      });
    } catch (err) {
      console.error('Erro ao carregar estatísticas do backup:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadStats();
    }
  }, [isAuthorized]);

  // Presets de Data
  const applyDatePreset = (preset: string) => {
    setDateFilterPreset(preset);
    const now = new Date();
    let start = '';
    let end = '';

    const formatYMD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'today') {
      start = formatYMD(now);
      end = formatYMD(now);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      start = formatYMD(past);
      end = formatYMD(now);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = formatYMD(firstDay);
      end = formatYMD(now);
    } else if (preset === 'year') {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      start = formatYMD(firstDay);
      end = formatYMD(now);
    } else if (preset === 'all') {
      start = '';
      end = '';
    }

    setStartDate(start);
    setEndDate(end);
    loadStats(start, end);
  };

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setDateFilterPreset('custom');
    loadStats(start, end);
  };

  // Toggle Módulo
  const toggleModule = (modKey: BackupModuleKey) => {
    setSelectedModules((prev) =>
      prev.includes(modKey) ? prev.filter((k) => k !== modKey) : [...prev, modKey]
    );
  };

  const selectAllModules = () => {
    setSelectedModules(BACKUP_MODULES.map((m) => m.key));
  };

  const deselectAllModules = () => {
    setSelectedModules([]);
  };

  // Executar Exportação
  const handleExport = async () => {
    if (selectedModules.length === 0) {
      alert('Selecione pelo menos um módulo para exportar.');
      return;
    }

    try {
      setIsExporting(true);
      setExportSuccessInfo(null);

      const res = await ApiService.exportBackup({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        modules: selectedModules,
        includeImages,
      });

      if (res && res.success && res.backupPackage) {
        const pkg = res.backupPackage;
        const jsonStr = JSON.stringify(pkg, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
        const filename = `SubliGestao_Backup_${dateStr}_${timeStr}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const sizeInKB = (blob.size / 1024).toFixed(1);
        const sizeStr = blob.size > 1024 * 1024 ? `${(blob.size / (1024 * 1024)).toFixed(2)} MB` : `${sizeInKB} KB`;

        setExportSuccessInfo({
          filename,
          sizeStr,
          totalRecords: pkg.summary?.totalRecords || 0,
          summary: pkg.summary,
        });

        setRecentExports((prev) => [
          {
            name: filename,
            size: sizeStr,
            timestamp: new Date().toLocaleTimeString('pt-BR'),
            count: pkg.summary?.totalRecords || 0,
          },
          ...prev.slice(0, 4),
        ]);
      } else {
        alert(res?.error || 'Erro ao gerar backup.');
      }
    } catch (err: any) {
      console.error('Erro na exportação:', err);
      alert('Falha na comunicação ao exportar backup: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsExporting(false);
    }
  };

  // Leitura do arquivo de importação
  const handleFileSelect = (file: File) => {
    setImportError(null);
    setImportResult(null);
    setImportPackage(null);
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed || typeof parsed !== 'object' || !parsed.data) {
          setImportError('O arquivo selecionado não é um backup válido do SubliGestão ERP.');
          return;
        }

        setImportPackage(parsed);

        // Auto-seleciona os módulos presentes no arquivo (com retrocompatibilidade)
        const availableInFile: BackupModuleKey[] = [];
        if (parsed.data.estoque) availableInFile.push('estoque');
        if (parsed.data.funcionarios) availableInFile.push('funcionarios');
        if (parsed.data.clientes) availableInFile.push('clientes');
        if (parsed.data.os) availableInFile.push('os');
        if (parsed.data.vnd) availableInFile.push('vnd');
        if (parsed.data.mensagens) availableInFile.push('mensagens');
        if (parsed.data.historicoPermissoes || parsed.data.permissoes) availableInFile.push('historicoPermissoes');
        if (parsed.data.filiais || parsed.data.branches) availableInFile.push('filiais');
        if (parsed.data.historicoNotasFiscais || parsed.data.notasFiscais) availableInFile.push('historicoNotasFiscais');
        if (parsed.data.calculosProduto || parsed.data.measurementFormulas || parsed.data.calculosMedidas || parsed.data.estoque?.measurementFormulas) availableInFile.push('calculosProduto');
        if (parsed.data.historicoMudancas || parsed.data.systemChanges || parsed.data.metas) availableInFile.push('historicoMudancas');

        setImportModulesToApply(availableInFile);
      } catch (err) {
        setImportError('Erro ao decodificar arquivo JSON. Certifique-se de selecionar um arquivo .json válido.');
      }
    };
    reader.readAsText(file);
  };

  // Executar Importação
  const handleExecuteImport = async () => {
    if (!importPackage) {
      alert('Carregue um arquivo de backup primeiro.');
      return;
    }

    if (importModulesToApply.length === 0) {
      alert('Selecione pelo menos uma entidade para restaurar.');
      return;
    }

    if (importMode === 'replace') {
      const confirmReplace = window.confirm(
        'ATENÇÃO: Você selecionou o modo SUBSTITUIÇÃO / RESTAURAÇÃO TOTAL. Os dados atuais das entidades selecionadas serão substituídos pelos dados do arquivo. Deseja prosseguir?'
      );
      if (!confirmReplace) return;
    }

    try {
      setIsImporting(true);
      setImportError(null);
      setImportResult(null);

      const res = await ApiService.importBackup({
        backupPackage: importPackage,
        mode: importMode,
        selectedModules: importModulesToApply,
      });

      if (res && res.success) {
        setImportResult(res);
        loadStats(); // Atualiza contadores
      } else {
        setImportError(res?.error || 'Falha ao processar importação do backup.');
      }
    } catch (err: any) {
      console.error('Erro na importação:', err);
      setImportError('Erro ao comunicar com o servidor: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsImporting(false);
    }
  };

  // Total selecionado para exportação
  const totalSelectedRecords = selectedModules.reduce((acc, key) => acc + (stats[key] || 0), 0);

  // Se não tiver autorização (não for Developer ou Admin Master)
  if (!isAuthorized) {
    return (
      <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Acesso Exclusivo e Restrito</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            O módulo de <strong>Backup & Restauração</strong> é de uso exclusivo dos perfis{' '}
            <strong className="text-rose-600 dark:text-rose-400">Developer</strong> e{' '}
            <strong className="text-indigo-600 dark:text-indigo-400">Administrador Master</strong> para garantir a segurança e governança dos dados corporativos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER DO MÓDULO */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl shadow-md shadow-indigo-500/20">
              <Database className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  MÓDULO DE BACKUP & RESTAURAÇÃO
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                  DEVELOPER & ADM MASTER
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Exportação e Importação completa do banco de dados com filtro por período e seleção de entidades.
              </p>
            </div>
          </div>

          {/* SELETOR DE ABAS PRINCIPAIS */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                activeTab === 'export'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>EXPORTAR DADOS</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                activeTab === 'import'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>IMPORTAR & RESTAURAR</span>
            </button>
          </div>
        </div>
      </div>

      {/* PAINEL DE CONTROLE DE PERÍODO & ENTIDADES */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Filtro por Período de Data
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Selecione o intervalo de datas para filtrar os registros a serem manipulados.
              </p>
            </div>
          </div>

          {/* Quick Filter Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Todo o Período' },
              { id: 'today', label: 'Hoje' },
              { id: '7days', label: 'Últimos 7 Dias' },
              { id: 'month', label: 'Este Mês' },
              { id: 'year', label: 'Este Ano' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyDatePreset(p.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  dateFilterPreset === p.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* INPUTS DE DATA INICIO E FIM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              Data de Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleDateChange(e.target.value, endDate)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              Data de Fim
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleDateChange(startDate, e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="button"
              onClick={() => loadStats(startDate, endDate)}
              disabled={isLoadingStats}
              className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer h-[38px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin' : ''}`} />
              <span>Atualizar Contagem em Tempo Real</span>
            </button>
          </div>
        </div>

        {/* SELEÇÃO DE ENTIDADES / MÓDULOS */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Entidades do Sistema ({selectedModules.length} de {BACKUP_MODULES.length} selecionadas)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllModules}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Selecionar Todas
              </button>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <button
                type="button"
                onClick={deselectAllModules}
                className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
              >
                Desmarcar Todas
              </button>
            </div>
          </div>

          {/* GRID DE CARDS DAS ENTIDADES DO SISTEMA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BACKUP_MODULES.map((mod) => {
              const isSelected = selectedModules.includes(mod.key);
              const count = stats[mod.key] || 0;
              const Icon = mod.icon;

              return (
                <div
                  key={mod.key}
                  onClick={() => toggleModule(mod.key)}
                  className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? `${mod.borderColor} ${mod.bgLight} shadow-xs`
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-white dark:bg-slate-800 shadow-xs' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <Icon className={`w-5 h-5 ${mod.textColor}`} />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900 dark:text-white tracking-wide">
                          "{mod.label}"
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {mod.shortLabel}
                      </p>
                      <div className="pt-1 flex items-center gap-1.5 text-[11px] font-black text-slate-700 dark:text-slate-300">
                        <span>{isLoadingStats ? '...' : count.toLocaleString('pt-BR')} registros</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-0.5">
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CONTEÚDO DA ABA: EXPORTAÇÃO */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PAINEL PRINCIPAL DE EXPORTAÇÃO */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <FileDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Gerar e Baixar Arquivo de Backup
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Exporta todos os dados das entidades selecionadas em um pacote JSON padronizado.
                </p>
              </div>
            </div>

            {/* RESUMO DO PACOTE A SER GERADO */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Resumo da Exportação:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black">
                  {totalSelectedRecords.toLocaleString('pt-BR')} registros selecionados
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                {BACKUP_MODULES.map((m) => {
                  const isSel = selectedModules.includes(m.key);
                  return (
                    <div
                      key={m.key}
                      className={`p-2 rounded-lg flex items-center justify-between ${
                        isSel
                          ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700'
                          : 'bg-transparent text-slate-400 line-through'
                      }`}
                    >
                      <span className="font-bold">{m.label}:</span>
                      <span>{isSel ? stats[m.key] : 0}</span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Período:{' '}
                    <strong>
                      {startDate && endDate
                        ? `${startDate} até ${endDate}`
                        : startDate
                        ? `A partir de ${startDate}`
                        : endDate
                        ? `Até ${endDate}`
                        : 'Todo o Histórico'}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Formato JSON estruturado com metadados e checksum</span>
                </div>
              </div>
            </div>

            {/* OPÇÕES AVANÇADAS */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                Opções do Arquivo
              </label>

              <div
                onClick={() => setIncludeImages(!includeImages)}
                className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Otimizar Imagens e Anexos (Base64)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {includeImages
                      ? 'Todas as fotos e anexos serão exportados no arquivo (arquivo maior).'
                      : 'Fotos Base64 muito pesadas serão omitidas para gerar um arquivo leve e rápido.'}
                  </div>
                </div>
                <div className="pt-0.5">
                  {includeImages ? (
                    <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>
            </div>

            {/* BOTÃO DE EXPORTAÇÃO */}
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || selectedModules.length === 0}
              className={`w-full p-4 rounded-xl font-black text-sm transition flex items-center justify-center gap-2.5 cursor-pointer shadow-md ${
                isExporting || selectedModules.length === 0
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-indigo-500/25 active:scale-[0.99]'
              }`}
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Gerando Pacote de Backup...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>GERAR E BAIXAR BACKUP (.JSON)</span>
                </>
              )}
            </button>

            {/* MENSAGEM DE SUCESSO APÓS EXPORTAÇÃO */}
            {exportSuccessInfo && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Backup gerado e baixado com sucesso!</span>
                </div>
                <div className="text-slate-600 dark:text-slate-300 space-y-0.5 text-[11px]">
                  <p>
                    Arquivo: <strong>{exportSuccessInfo.filename}</strong> ({exportSuccessInfo.sizeStr})
                  </p>
                  <p>
                    Total de registros exportados:{' '}
                    <strong>{exportSuccessInfo.totalRecords.toLocaleString('pt-BR')}</strong>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* COLUNA LATERAL: HISTÓRICO & INSTRUÇÕES */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white uppercase">
                <Info className="w-4 h-4 text-indigo-500" />
                <span>Instruções de Backup</span>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <span>
                    O arquivo gerado é compatível com a aba <strong>Importar & Restaurar</strong> deste módulo.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <span>
                    Guarde o arquivo em local seguro (Drive, HD externo ou nuvem corporativa).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <span>
                    O backup pode ser gerado pontualmente ou por períodos específicos (ex: fechamento mensal).
                  </span>
                </li>
              </ul>
            </div>

            {/* EXPORTAÇÕES RECENTES DA SESSÃO */}
            {recentExports.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white uppercase">
                  <HardDrive className="w-4 h-4 text-indigo-500" />
                  <span>Downloads Recentes</span>
                </div>
                <div className="space-y-2">
                  {recentExports.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60 text-xs space-y-0.5"
                    >
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {item.name}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{item.size} • {item.count} registros</span>
                        <span>{item.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: IMPORTAÇÃO & RESTAURAÇÃO */}
      {activeTab === 'import' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Importação & Restauração de Dados
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Selecione um arquivo de backup previamente gerado (.JSON) para restaurar os dados no sistema.
              </p>
            </div>
          </div>

          {/* ÁREA DE DRAG & DROP / UPLOAD */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/10 rounded-2xl p-8 text-center cursor-pointer transition space-y-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.sublibackup"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Upload className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {importFile ? importFile.name : 'Clique para selecionar ou arraste o arquivo de backup aqui'}
              </p>
              <p className="text-xs text-slate-500">
                Suporta arquivos .JSON exportados pelo SubliGestão ERP
              </p>
            </div>
          </div>

          {/* MENSAGEM DE ERRO NA VALIDAÇÃO */}
          {importError && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-center gap-3 text-xs text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {/* PRÉ-VISUALIZAÇÃO DO ARQUIVO CARREGADO */}
          {importPackage && (
            <div className="space-y-5 pt-2">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-black text-slate-900 dark:text-white uppercase">
                      Arquivo Validado com Sucesso
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Gerado em: {importPackage.timestamp ? new Date(importPackage.timestamp).toLocaleString('pt-BR') : 'Data não informada'}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {[
                    { key: 'estoque', label: 'Estoque', count: importPackage.data?.estoque?.products?.length || 0 },
                    { key: 'funcionarios', label: 'Funcionários', count: importPackage.data?.funcionarios?.employees?.length || 0 },
                    { key: 'clientes', label: 'Clientes', count: Array.isArray(importPackage.data?.clientes) ? importPackage.data.clientes.length : 0 },
                    { key: 'os', label: 'OS & Orç.', count: Array.isArray(importPackage.data?.os) ? importPackage.data.os.length : 0 },
                    { key: 'vnd', label: 'VND / PDV', count: Array.isArray(importPackage.data?.vnd) ? importPackage.data.vnd.length : 0 },
                    { key: 'mensagens', label: 'Mensagens', count: importPackage.data?.mensagens?.messages?.length || 0 },
                    {
                      key: 'historicoPermissoes',
                      label: 'Permissões',
                      count:
                        (importPackage.data?.historicoPermissoes?.roles?.length || 0) +
                          (importPackage.data?.historicoPermissoes?.history?.length || 0) ||
                        (Array.isArray(importPackage.data?.historicoPermissoes) ? importPackage.data.historicoPermissoes.length : 0) ||
                        (importPackage.data?.permissoes ? Object.keys(importPackage.data.permissoes).length : 0),
                    },
                    {
                      key: 'filiais',
                      label: 'Filiais',
                      count: Array.isArray(importPackage.data?.filiais)
                        ? importPackage.data.filiais.length
                        : Array.isArray(importPackage.data?.branches)
                        ? importPackage.data.branches.length
                        : 0,
                    },
                    {
                      key: 'historicoNotasFiscais',
                      label: 'Notas Fiscais',
                      count: Array.isArray(importPackage.data?.historicoNotasFiscais)
                        ? importPackage.data.historicoNotasFiscais.length
                        : Array.isArray(importPackage.data?.notasFiscais)
                        ? importPackage.data.notasFiscais.length
                        : 0,
                    },
                    {
                      key: 'calculosProduto',
                      label: 'Cálculos de Produto',
                      count: Array.isArray(importPackage.data?.calculosProduto)
                        ? importPackage.data.calculosProduto.length
                        : Array.isArray(importPackage.data?.measurementFormulas)
                        ? importPackage.data.measurementFormulas.length
                        : Array.isArray(importPackage.data?.calculosMedidas)
                        ? importPackage.data.calculosMedidas.length
                        : Array.isArray(importPackage.data?.estoque?.measurementFormulas)
                        ? importPackage.data.estoque.measurementFormulas.length
                        : 0,
                    },
                    {
                      key: 'historicoMudancas',
                      label: 'Mudanças do Sistema',
                      count: Array.isArray(importPackage.data?.historicoMudancas?.changes)
                        ? importPackage.data.historicoMudancas.changes.length
                        : Array.isArray(importPackage.data?.historicoMudancas)
                        ? importPackage.data.historicoMudancas.length
                        : Array.isArray(importPackage.data?.systemChanges)
                        ? importPackage.data.systemChanges.length
                        : importPackage.data?.metas
                        ? Object.keys(importPackage.data.metas).length
                        : 0,
                    },
                  ].map((it) => (
                    <div
                      key={it.key}
                      className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-1"
                    >
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{it.label}</div>
                      <div className="text-base font-black text-indigo-600 dark:text-indigo-400">
                        {it.count.toLocaleString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* MODO DE RESTAURAÇÃO */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
                  Escolha o Modo de Restauração:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setImportMode('merge')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition space-y-1 ${
                      importMode === 'merge'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        🔄 Mesclar e Atualizar (Recomendado)
                      </span>
                      {importMode === 'merge' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Insere novos registros e atualiza registros existentes sem apagar outros dados do banco.
                    </p>
                  </div>

                  <div
                    onClick={() => setImportMode('replace')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition space-y-1 ${
                      importMode === 'replace'
                        ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-700 dark:text-rose-400">
                        ⚠️ Substituição / Restauração Total
                      </span>
                      {importMode === 'replace' && <CheckCircle2 className="w-4 h-4 text-rose-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Substitui integralmente os dados das categorias selecionadas pelos dados do arquivo.
                    </p>
                  </div>
                </div>
              </div>

              {/* BOTÃO EXECUTAR IMPORTAÇÃO */}
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isImporting}
                className={`w-full p-4 rounded-xl font-black text-sm transition flex items-center justify-center gap-2.5 cursor-pointer shadow-md ${
                  isImporting
                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-purple-500/25 active:scale-[0.99]'
                }`}
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Processando e Restaurando Dados...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>INICIAR RESTAURAÇÃO DO BACKUP</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* RESULTADO DA IMPORTAÇÃO */}
          {importResult && (
            <div className="p-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>{importResult.message}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs">
                {Object.entries(importResult.importStats || {}).map(([key, value]: [string, any]) => (
                  <div
                    key={key}
                    className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-800/40 space-y-0.5"
                  >
                    <div className="font-black text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                      {key}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Inseridos: <strong>{value.imported}</strong> | Atualizados: <strong>{value.updated}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
