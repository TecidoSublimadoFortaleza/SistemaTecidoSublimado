import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Printer,
  Download,
  Eye,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Settings,
  ShieldCheck,
  Building2,
  ShoppingCart,
  Send,
  ExternalLink,
  Save,
  Check,
  Zap,
  BookOpen,
  HelpCircle,
  X,
  Calendar,
} from 'lucide-react';
import { ApiService, NotaFiscal, ConfiguracaoFiscal } from '../../services/api';
import { NovaNotaModal } from './NovaNotaModal';
import { CancelamentoModal } from './CancelamentoModal';
import { XmlModal } from './XmlModal';
import { openDanfeInNewTab } from '../../utils/danfePrintHelper';
import {
  getTodayFormatted,
  parseDateToMidnight,
  parseDateToEndOfDay,
} from '../../utils/dateFiscalUtils';
import { isVendedoraOuRecepcaoProfile, getLoggedUserAndPerfil } from '../../utils/userPermissions';

interface FiscalModuleViewProps {
  userRole?: string;
  isDeveloper?: boolean;
}

export const FiscalModuleView: React.FC<FiscalModuleViewProps> = ({
  userRole,
  isDeveloper,
}) => {
  const loggedInfo = useMemo(() => getLoggedUserAndPerfil(), []);
  const effectiveRole = userRole || loggedInfo.role;
  const effectiveIsDev = isDeveloper !== undefined ? isDeveloper : loggedInfo.isDeveloper;
  const isVendedoraOuRecepcao = useMemo(
    () => isVendedoraOuRecepcaoProfile(effectiveRole, effectiveIsDev, loggedInfo.username),
    [effectiveRole, effectiveIsDev, loggedInfo.username]
  );

  const [activeTab, setActiveTab] = useState<'NOTAS' | 'CONFIG'>('NOTAS');

  // Proteção de segurança: se o perfil for Vendedora ou Recepção, forçar aba para NOTAS
  useEffect(() => {
    if (isVendedoraOuRecepcao && activeTab === 'CONFIG') {
      setActiveTab('NOTAS');
    }
  }, [isVendedoraOuRecepcao, activeTab]);

  // Fiscal Data State
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [config, setConfig] = useState<ConfiguracaoFiscal | null>(null);
  const [metrics, setMetrics] = useState<{
    totalValor: number;
    totalQtd: number;
    autorizadas: number;
    canceladas: number;
    nfceQtd: number;
    nfeQtd: number;
  }>({
    totalValor: 0,
    totalQtd: 0,
    autorizadas: 0,
    canceladas: 0,
    nfceQtd: 0,
    nfeQtd: 0,
  });

  // Filters - Período por Dia (Início e Fim como no Gerenciador de Notas Fiscais)
  const [dataInicio, setDataInicio] = useState<string>(() => getTodayFormatted());
  const [dataFim, setDataFim] = useState<string>(() => getTodayFormatted());
  const [searchQuery, setSearchQuery] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'ALL' | 'NFE' | 'NFCE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AUTORIZADA' | 'CANCELADA'>('ALL');

  // Loading & Feedback
  const [isLoading, setIsLoading] = useState(true);
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSavedMsg, setConfigSavedMsg] = useState(false);

  // Modals
  const [selectedNotaXml, setSelectedNotaXml] = useState<NotaFiscal | null>(null);
  const [selectedNotaCancel, setSelectedNotaCancel] = useState<NotaFiscal | null>(null);
  const [isNovaNotaOpen, setIsNovaNotaOpen] = useState(false);

  // Config Form State
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [regimeTributario, setRegimeTributario] = useState<'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'>('SIMPLES_NACIONAL');
  const [naturezaOperacaoPadrao, setNaturezaOperacaoPadrao] = useState('');
  const [cfopPadraoInterno, setCfopPadraoInterno] = useState('5102');
  const [cfopPadraoInterestadual, setCfopPadraoInterestadual] = useState('6102');
  const [ncmPadrao, setNcmPadrao] = useState('6109.10.00');
  const [csosnPadrao, setCsosnPadrao] = useState('102');
  const [serieNfe, setSerieNfe] = useState('6');
  const [proximoNumeroNfe, setProximoNumeroNfe] = useState(1);
  const [serieNfeOs, setSerieNfeOs] = useState('7');
  const [proximoNumeroNfeOs, setProximoNumeroNfeOs] = useState(1);
  const [serieNfce, setSerieNfce] = useState('6');
  const [proximoNumeroNfce, setProximoNumeroNfce] = useState(1);
  const [ambiente, setAmbiente] = useState<'HOMOLOGACAO' | 'PRODUCAO'>('HOMOLOGACAO');
  const [provedorFiscal, setProvedorFiscal] = useState<'SPEDY' | 'FOCUS_NFE' | 'INTERNO'>('SPEDY');
  const [tokenSpedy, setTokenSpedy] = useState('de48c1cb-1f56-4c02-9a2a-6278c381b60a');
  const [spedyCompanyId, setSpedyCompanyId] = useState('3c260fe5-5b07-482a-8c12-b4c800ddca83');
  const [tokenFocusNfe, setTokenFocusNfe] = useState('');
  const [isSyncingId, setIsSyncingId] = useState<string | null>(null);
  const [isSyncingPending, setIsSyncingPending] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [configData, notasData, metricsData] = await Promise.all([
        ApiService.getFiscalConfig(),
        ApiService.listNotasFiscais({ tipo: tipoFilter, status: statusFilter, search: searchQuery }),
        ApiService.getFiscalDashboard(),
      ]);

      setConfig(configData || null);
      setNotas(Array.isArray(notasData) ? notasData.filter(Boolean) : []);
      setMetrics(metricsData || { totalValor: 0, totalQtd: 0, autorizadas: 0, canceladas: 0, nfceQtd: 0, nfeQtd: 0 });

      // Populate config form
      if (configData) {
        setCnpj(configData.cnpj || '');
        setRazaoSocial(configData.razaoSocial || '');
        setNomeFantasia(configData.nomeFantasia || '');
        setInscricaoEstadual(configData.inscricaoEstadual || '');
        setRegimeTributario(configData.regimeTributario || 'SIMPLES_NACIONAL');
        setNaturezaOperacaoPadrao(configData.naturezaOperacaoPadrao || '');
        setCfopPadraoInterno(configData.cfopPadraoInterno || '5102');
        setCfopPadraoInterestadual(configData.cfopPadraoInterestadual || '6102');
        setNcmPadrao(configData.ncmPadrao || '6109.10.00');
        setCsosnPadrao(configData.csosnPadrao || '102');
        setSerieNfe(configData.serieNfe || '6');
        setProximoNumeroNfe(configData.proximoNumeroNfe || 1);
        setSerieNfeOs(configData.serieNfeOs || '7');
        setProximoNumeroNfeOs(configData.proximoNumeroNfeOs || 1);
        setSerieNfce(configData.serieNfce || '6');
        setProximoNumeroNfce(configData.proximoNumeroNfce || 1);
        setAmbiente(configData.ambiente || 'HOMOLOGACAO');
        setProvedorFiscal(configData.provedorFiscal || 'SPEDY');
        setTokenSpedy(configData.tokenSpedy || 'de48c1cb-1f56-4c02-9a2a-6278c381b60a');
        setSpedyCompanyId(configData.spedyCompanyId || '3c260fe5-5b07-482a-8c12-b4c800ddca83');
        setTokenFocusNfe(configData.tokenFocusNfe || '');
      }
    } catch (err) {
      console.error('Erro ao carregar dados fiscais:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tipoFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleDownloadXml = (nota: NotaFiscal) => {
    if (!nota) return;
    const xml = nota.xmlConteudo || '<!-- XML não disponível -->';
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe_${nota.chaveAcesso || nota.id || 'nota'}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSyncNota = async (nota: NotaFiscal) => {
    if (!nota?.id) return;
    setIsSyncingId(nota.id);
    try {
      const updated = await ApiService.syncNotaFiscal(nota.id);
      if (updated?.id) {
        setNotas((prev) => (prev || []).map((n) => (n?.id === updated.id ? updated : n)));
      }
      setSyncFeedback(`Nota Nº ${nota.numero} sincronizada com sucesso!`);
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (err: any) {
      alert(`Erro ao sincronizar com Spedy: ${err.message || 'Falha na requisição'}`);
    } finally {
      setIsSyncingId(null);
    }
  };

  const handleSyncPendingNotas = async (silent = false) => {
    if (isSyncingPending) return;
    setIsSyncingPending(true);
    try {
      const res = await ApiService.syncPendingNotas();
      if (res?.notas && Array.isArray(res.notas)) {
        setNotas(res.notas.filter(Boolean));
        // Atualiza dashboard em segundo plano
        ApiService.getFiscalDashboard()
          .then((m) => {
            if (m) setMetrics(m);
          })
          .catch(() => {});
      }
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
      if (res?.updatedCount && res.updatedCount > 0) {
        setSyncFeedback(`${res.updatedCount} nota(s) atualizada(s) via Spedy!`);
        setTimeout(() => setSyncFeedback(null), 4000);
      } else if (!silent) {
        setSyncFeedback('Situação das notas atualizada com o Spedy.');
        setTimeout(() => setSyncFeedback(null), 3000);
      }
    } catch (err: any) {
      if (!silent) {
        setSyncFeedback(`Erro na sincronização: ${err.message || 'Falha de comunicação'}`);
        setTimeout(() => setSyncFeedback(null), 4000);
      }
    } finally {
      setIsSyncingPending(false);
    }
  };

  // Sincronização e polling automático com a Spedy para exibição da situação em tempo real
  useEffect(() => {
    if (!autoSyncEnabled) return;

    // Dispara sincronização inicial em background
    handleSyncPendingNotas(true);

    // Se houver qualquer nota em processamento/pendente, sincroniza a cada 7s. Senão, a cada 40s.
    const hasPending = (notas || []).some(
      (n) => n && (n.status === 'PROCESSANDO' || n.status === 'PENDENTE')
    );
    const intervalMs = hasPending ? 7000 : 40000;

    const timer = setInterval(() => {
      handleSyncPendingNotas(true);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [autoSyncEnabled, (notas || []).map((n) => `${n?.id}_${n?.status}`).join(',')]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await ApiService.testFiscalConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Falha na comunicação' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const updated = await ApiService.updateFiscalConfig({
        cnpj,
        razaoSocial,
        nomeFantasia,
        inscricaoEstadual,
        regimeTributario,
        naturezaOperacaoPadrao,
        cfopPadraoInterno,
        cfopPadraoInterestadual,
        ncmPadrao,
        csosnPadrao,
        serieNfe,
        proximoNumeroNfe: Number(proximoNumeroNfe),
        serieNfeOs,
        proximoNumeroNfeOs: Number(proximoNumeroNfeOs),
        serieNfce,
        proximoNumeroNfce: Number(proximoNumeroNfce),
        ambiente,
        provedorFiscal,
        tokenSpedy,
        spedyCompanyId,
        tokenFocusNfe,
      });
      setConfig(updated);
      setConfigSavedMsg(true);
      setTimeout(() => setConfigSavedMsg(false), 3000);
    } catch (err: any) {
      alert(`Erro ao salvar configurações fiscais: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Períodos pré-definidos (Início e Fim como no Gerenciador de Notas Fiscais)
  const setPeriodoHoje = () => {
    const today = getTodayFormatted();
    setDataInicio(today);
    setDataFim(today);
  };

  const setPeriodoMesAtual = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    setDataInicio(`01/${m}/${y}`);
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    setDataFim(`${String(lastDay).padStart(2, '0')}/${m}/${y}`);
  };

  const setPeriodoTodas = () => {
    setDataInicio('');
    setDataFim('');
  };

  // Filtragem de notas por texto, tipo, status e período (Início e Fim)
  const filteredNotas = useMemo(() => {
    if (!Array.isArray(notas)) return [];
    return notas.filter((n): n is NotaFiscal => {
      if (!n || typeof n !== 'object' || !n.id) return false;

      // 1. Busca por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          String(n.numero || '').toLowerCase().includes(q) ||
          String(n.chaveAcesso || '').toLowerCase().includes(q) ||
          String(n.clienteNome || '').toLowerCase().includes(q) ||
          String(n.clienteDocumento || '').toLowerCase().includes(q) ||
          String(n.origemCodigo || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // 2. Tipo
      if (tipoFilter !== 'ALL' && n.tipo !== tipoFilter) {
        return false;
      }

      // 3. Status
      if (statusFilter !== 'ALL' && n.status !== statusFilter) {
        return false;
      }

      // 4. Intervalo de Datas
      const startTs = parseDateToMidnight(dataInicio);
      const endTs = parseDateToEndOfDay(dataFim);
      if (startTs !== null || endTs !== null) {
        const itemTs = parseDateToMidnight(n.dataEmissao);
        if (itemTs !== null) {
          if (startTs !== null && itemTs < startTs) return false;
          if (endTs !== null && itemTs > endTs) return false;
        }
      }

      return true;
    });
  }, [notas, searchQuery, tipoFilter, statusFilter, dataInicio, dataFim]);

  // Agrupamento das notas por dia (mais recente primeiro)
  const groupedNotasByDay = useMemo(() => {
    const groupMap: Record<
      string,
      {
        dateKey: string;
        timestamp: number;
        formattedDate: string;
        weekday: string;
        isToday: boolean;
        notas: NotaFiscal[];
        totalValor: number;
        totalAutorizadas: number;
        totalCanceladas: number;
      }
    > = {};

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    filteredNotas.forEach((n) => {
      if (!n || !n.id) return;
      const ts = parseDateToMidnight(n.dataEmissao) || 0;
      let dateKey = 'sem-data';
      let formattedDate = 'Outras / Sem Data';
      let weekday = '';
      let isToday = false;

      if (ts > 0) {
        const d = new Date(ts);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dateKey = `${y}-${m}-${day}`;
        formattedDate = `${day}/${m}/${y}`;
        const rawWeekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
        weekday = rawWeekday.charAt(0).toUpperCase() + rawWeekday.slice(1);
        isToday = dateKey === todayKey;
      }

      if (!groupMap[dateKey]) {
        groupMap[dateKey] = {
          dateKey,
          timestamp: ts,
          formattedDate,
          weekday,
          isToday,
          notas: [],
          totalValor: 0,
          totalAutorizadas: 0,
          totalCanceladas: 0,
        };
      }

      groupMap[dateKey].notas.push(n);
      if (n.status === 'AUTORIZADA') {
        groupMap[dateKey].totalValor += Number(n.valorTotal || 0);
        groupMap[dateKey].totalAutorizadas += 1;
      } else if (n.status === 'CANCELADA') {
        groupMap[dateKey].totalCanceladas += 1;
      }
    });

    // Ordenar dias do mais recente para o mais antigo
    const sortedGroups = Object.values(groupMap).sort((a, b) => b.timestamp - a.timestamp);

    // Ordenar notas de cada dia pelo número decrescente
    sortedGroups.forEach((g) => {
      if (!g || !Array.isArray(g.notas)) return;
      g.notas = g.notas.filter((item): item is NotaFiscal => Boolean(item && item.id));
      g.notas.sort((a, b) => {
        const numA = parseInt(String(a?.numero || '').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(String(b?.numero || '').replace(/\D/g, ''), 10) || 0;
        return numB - numA;
      });
    });

    return sortedGroups;
  }, [filteredNotas]);

  // Se o usuário clicar em "Emitir Nova Nota", renderiza a tela em tela cheia mantendo lateral e barra superior
  if (isNovaNotaOpen) {
    return (
      <div className="w-full space-y-4 animate-in fade-in duration-150">
        <NovaNotaModal
          isOpen={true}
          isInlineView={true}
          onClose={() => setIsNovaNotaOpen(false)}
          onSuccess={(novaNota) => {
            if (novaNota && novaNota.id) {
              setNotas((prev) => [novaNota, ...(prev || [])]);
            }
            setIsNovaNotaOpen(false);
            loadData();
          }}
          config={config}
          userRole={effectiveRole}
          isDeveloper={effectiveIsDev}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-xs">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Emissão de Notas Fiscais (NF-e / NFC-e)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isVendedoraOuRecepcao
                  ? 'Emissão exclusiva por importação de pedidos de OS e Venda Direta (VND).'
                  : 'Emissão autorizada perante a SEFAZ de notas de produtos e cupom fiscal de balcão.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-xl text-xs font-bold">
            <Zap className="w-3.5 h-3.5 text-cyan-600" />
            <span>Spedy API: {config?.provedorFiscal === 'FOCUS_NFE' ? 'Focus NFe' : 'Sandbox Ativo'}</span>
          </div>

          {/* Action: Nova Nota / Importar de Pedido */}
          <button
            onClick={() => setIsNovaNotaOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            title={
              isVendedoraOuRecepcao
                ? 'Importar e emitir nota fiscal de pedido (OS ou VND)'
                : 'Emitir nova nota fiscal'
            }
          >
            <Plus className="w-4 h-4" />
            <span>{isVendedoraOuRecepcao ? 'Importar Nota (OS / VND)' : 'Emitir Nova Nota'}</span>
          </button>
        </div>
      </div>

      {/* 2. Fiscal Metrics Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Faturado em Notas</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            R$ {metrics.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Notas fiscais autorizadas</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">NF-e Autorizadas</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 tracking-tight">
            {metrics.nfeQtd}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Modelo 55 (Grandes Clientes)</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">NFC-e Emitidas (PDV)</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-600 tracking-tight">
            {metrics.nfceQtd}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Modelo 65 (Cupons Fiscais Balcão)</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Canceladas na SEFAZ</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600 tracking-tight">
            {metrics.canceladas}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Protocolos de cancelamento</p>
        </div>
      </div>

      {/* 3. Navigation Tabs & Spedy Live Sync Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 gap-4 pb-2">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('NOTAS')}
            className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'NOTAS'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Notas Fiscais Emitidas ({filteredNotas.length}{filteredNotas.length !== notas.length ? ` de ${notas.length}` : ''})</span>
          </button>

          {!isVendedoraOuRecepcao && (
            <button
              onClick={() => setActiveTab('CONFIG')}
              className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'CONFIG'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configurações Fiscais & SEFAZ</span>
            </button>
          )}
        </div>

        {/* Barra de Sincronização em Tempo Real com Spedy */}
        <div className="flex items-center gap-3">
          {syncFeedback && (
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 animate-in fade-in duration-200">
              {syncFeedback}
            </span>
          )}

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <span className="relative flex h-2.5 w-2.5">
              {autoSyncEnabled ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400"></span>
              )}
            </span>
            <span className="text-[11px] font-medium text-slate-600">
              {autoSyncEnabled ? 'Auto-Sync Spedy' : 'Sincronização Pausada'}
            </span>
            {lastSyncTime && (
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                ({lastSyncTime})
              </span>
            )}
            <button
              type="button"
              onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-bold ml-1 cursor-pointer"
              title={autoSyncEnabled ? 'Pausar sincronização automática' : 'Ativar sincronização automática'}
            >
              {autoSyncEnabled ? 'Pausar' : 'Ativar'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleSyncPendingNotas(false)}
            disabled={isSyncingPending}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            title="Consultar situação atualizada de notas no Spedy / SEFAZ"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPending ? 'animate-spin' : ''}`} />
            <span>{isSyncingPending ? 'Sincronizando...' : 'Sincronizar com Spedy'}</span>
          </button>
        </div>
      </div>

      {/* 4. Tab 1: Notas Fiscais List (Exibição por Dia com Filtro Início e Fim) */}
      {activeTab === 'NOTAS' && (
        <div className="space-y-4">
          {/* Barra de Filtros: Início, Fim, Presets, Busca e Seletores */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-end">
              {/* Data Início */}
              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">Data Início</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDataInicio(getTodayFormatted())}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                      title="Definir Início como hoje"
                    >
                      Hoje
                    </button>
                    {dataInicio && (
                      <button
                        type="button"
                        onClick={() => setDataInicio('')}
                        className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Limpar data de início"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 pr-8 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  <input
                    type="date"
                    aria-label="Selecionar Data de Início"
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m, d] = e.target.value.split('-');
                        setDataInicio(`${d}/${m}/${y}`);
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40 hover:opacity-100 cursor-pointer border-0 p-0 bg-transparent text-transparent"
                    title="Selecionar no calendário"
                  />
                </div>
              </div>

              {/* Data Fim */}
              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">Data Fim</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDataFim(getTodayFormatted())}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                      title="Definir Fim como hoje"
                    >
                      Hoje
                    </button>
                    {dataFim && (
                      <button
                        type="button"
                        onClick={() => setDataFim('')}
                        className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Limpar data de fim"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 pr-8 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  <input
                    type="date"
                    aria-label="Selecionar Data de Fim"
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m, d] = e.target.value.split('-');
                        setDataFim(`${d}/${m}/${y}`);
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40 hover:opacity-100 cursor-pointer border-0 p-0 bg-transparent text-transparent"
                    title="Selecionar no calendário"
                  />
                </div>
              </div>

              {/* Busca por texto */}
              <div className="md:col-span-6">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Buscar Notas</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por Nº da nota, chave, cliente ou OS..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Linha de Atalhos e Filtros Rápidos */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 mr-1">Período:</span>
                <button
                  type="button"
                  onClick={setPeriodoHoje}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Hoje (Padrão)
                </button>
                <button
                  type="button"
                  onClick={setPeriodoMesAtual}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Mês Atual
                </button>
                <button
                  type="button"
                  onClick={setPeriodoTodas}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Todas as Datas
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={tipoFilter}
                  onChange={(e) => setTipoFilter(e.target.value as any)}
                  className="p-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
                >
                  <option value="ALL">Todos os Tipos (NF-e e NFC-e)</option>
                  <option value="NFE">NF-e (Modelo 55)</option>
                  <option value="NFCE">NFC-e (Modelo 65)</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="p-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
                >
                  <option value="ALL">Todos os Status</option>
                  <option value="AUTORIZADA">Autorizadas</option>
                  <option value="CANCELADA">Canceladas</option>
                </select>

                <button
                  type="button"
                  onClick={loadData}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                  title="Recarregar"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Listagem de Notas Fiscais Agrupadas por Dia */}
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-xs font-medium">Carregando notas fiscais...</p>
            </div>
          ) : notas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Nenhuma nota fiscal emitida ainda</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Clique no botão "Emitir Nova Nota" acima para emitir sua primeira NF-e ou NFC-e vinculada a uma OS ou venda.
              </p>
            </div>
          ) : filteredNotas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center text-slate-400 space-y-3">
              <Calendar className="w-10 h-10 mx-auto text-slate-300" />
              <div>
                <p className="text-sm font-bold text-slate-700">Nenhuma nota fiscal encontrada no período selecionado</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Tente alterar as datas de Início e Fim ou limpar os filtros para visualizar outras notas.
                </p>
              </div>
              <button
                type="button"
                onClick={setPeriodoTodas}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Exibir Todas as Datas
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedNotasByDay.map((group) => (
                <div key={group.dateKey} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  {/* Cabeçalho do Dia */}
                  <div className="bg-slate-50/90 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-extrabold text-slate-900">
                            {group.formattedDate}
                          </h3>
                          {group.weekday && (
                            <span className="text-xs text-slate-500 font-medium">
                              • {group.weekday}
                            </span>
                          )}
                          {group.isToday && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                              Hoje
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {group.notas.length} {group.notas.length === 1 ? 'nota emitida' : 'notas emitidas'} nesta data
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                        Total Faturado: <span className="font-mono font-black text-emerald-900">R$ {group.totalValor.toFixed(2)}</span>
                      </div>
                      <div className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold">
                        {group.totalAutorizadas} autorizada(s)
                      </div>
                      {group.totalCanceladas > 0 && (
                        <div className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold">
                          {group.totalCanceladas} cancelada(s)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tabela de Notas do Dia */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Modelo</th>
                          <th className="py-2.5 px-4">Número / Série</th>
                          <th className="py-2.5 px-4">Hora Emissão</th>
                          <th className="py-2.5 px-4">Destinatário</th>
                          <th className="py-2.5 px-4">Origem</th>
                          <th className="py-2.5 px-4 text-right">Valor Total</th>
                          <th className="py-2.5 px-4 text-center">Status SEFAZ</th>
                          <th className="py-2.5 px-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group?.notas?.filter((n): n is NotaFiscal => Boolean(n && n.id)).map((n) => (
                          <tr key={n.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                  n.tipo === 'NFE'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {n.tipo === 'NFE' ? 'NF-e 55' : 'NFC-e 65'}
                              </span>
                            </td>

                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              Nº {n.numero} <span className="text-[10px] font-normal text-slate-500">(Série {n.serie})</span>
                            </td>

                            <td className="py-3 px-4 text-slate-600 font-mono">
                              {n.dataEmissao ? (
                                (() => {
                                  try {
                                    return new Date(n.dataEmissao).toLocaleTimeString('pt-BR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    });
                                  } catch {
                                    return '--:--';
                                  }
                                })()
                              ) : (
                                '--:--'
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <p className="font-bold text-slate-900 truncate max-w-xs">{n.clienteNome || 'Cliente não informado'}</p>
                              {n.clienteDocumento && (
                                <p className="text-[10px] font-mono text-slate-500">{n.clienteDocumento}</p>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {n.origemCodigo ? (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-bold">
                                  {n.origemCodigo}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Avulsa</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right font-bold font-mono text-slate-900">
                              R$ {Number(n.valorTotal || 0).toFixed(2)}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  n.status === 'AUTORIZADA'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : n.status === 'CANCELADA'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : n.status === 'REJEITADA'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                                }`}
                              >
                                {n.status === 'AUTORIZADA' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                                {n.status === 'CANCELADA' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                                {n.status === 'REJEITADA' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                                {(n.status === 'PROCESSANDO' || n.status === 'PENDENTE') && (
                                  <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                                )}
                                <span>{n.status}</span>
                              </span>
                              {n.statusSefaz && (
                                <p
                                  className="text-[9px] text-slate-500 max-w-[170px] truncate mx-auto mt-0.5 font-medium"
                                  title={n.statusSefaz}
                                >
                                  {n.statusSefaz}
                                </p>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => {
                                    openDanfeInNewTab(n);
                                  }}
                                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer"
                                  title="Visualizar e Imprimir DANFE"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => setSelectedNotaXml(n)}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                                  title="Visualizar Detalhes do XML"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleDownloadXml(n)}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition cursor-pointer"
                                  title="Baixar XML Oficial (para SEBRAE / SEFAZ ou Contador)"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>

                                {n.spedyInvoiceId && (
                                  <button
                                    onClick={() => handleSyncNota(n)}
                                    disabled={isSyncingId === n.id}
                                    className="p-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg transition cursor-pointer"
                                    title="Sincronizar status no Spedy"
                                  >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingId === n.id ? 'animate-spin' : ''}`} />
                                  </button>
                                )}

                                {n.status === 'AUTORIZADA' && (
                                  <button
                                    onClick={() => setSelectedNotaCancel(n)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                                    title="Cancelar Nota na SEFAZ"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 2: Configurações Fiscais */}
      {activeTab === 'CONFIG' && !isVendedoraOuRecepcao && (
        <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Parâmetros do Emitente & Conexão SEFAZ</h2>
              <p className="text-xs text-slate-500">
                Configure os dados da sua empresa e credenciais de emissão de NF-e e NFC-e.
              </p>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
            >
              <Zap className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-amber-500' : 'text-blue-600'}`} />
              <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão SEFAZ'}</span>
            </button>
          </div>

          {/* Test connection output banner */}
          {testResult && (
            <div
              className={`p-4 rounded-xl text-xs space-y-2 border ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                  : 'bg-rose-50 text-rose-950 border-rose-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{testResult.message}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Ambiente: <strong>{testResult.ambiente}</strong> • Provedor:{' '}
                    <strong>{testResult.mode === 'SPEDY_API' ? 'Spedy API v1' : testResult.mode}</strong>
                  </p>
                </div>
              </div>

              {testResult.company && (
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-slate-500">Empresa no Spedy: </span>
                    <span className="font-bold text-slate-800">{testResult.company.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">CNPJ: </span>
                    <span className="font-mono font-bold text-slate-800">{testResult.company.federalTaxNumber}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500">Certificado Digital A1 no Spedy: </span>
                    {testResult.hasCertificate ? (
                      <span className="text-emerald-700 font-bold">Ativo e Válido</span>
                    ) : (
                      <span className="text-amber-700 font-bold">
                        Pendente de Upload (.pfx) no painel do Spedy (stage-app.spedy.com.br)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dados Cadastrais do Emitente */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Dados Cadastrais da Empresa (Emitente)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ do Emitente *</label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">Inscrição Estadual (IE) *</label>
                <input
                  type="text"
                  value={inscricaoEstadual}
                  onChange={(e) => setInscricaoEstadual(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">Regime Tributário *</label>
                <select
                  value={regimeTributario}
                  onChange={(e) => setRegimeTributario(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                >
                  <option value="SIMPLES_NACIONAL">1 - Simples Nacional (ME/EPP)</option>
                  <option value="LUCRO_PRESUMIDO">2 - Lucro Presumido</option>
                  <option value="LUCRO_REAL">3 - Regime Normal (Lucro Real)</option>
                </select>
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs font-bold text-slate-700 mb-1">Razão Social *</label>
                <input
                  type="text"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome Fantasia</label>
                <input
                  type="text"
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Séries e Numeração com Separação VND e OS */}
          <div className="space-y-4 pt-2 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Numeração Sequencial e Séries Fiscais Separadas</span>
              </h3>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 w-fit">
                <ShieldCheck className="w-3.5 h-3.5" />
                Série 6 (VND / Pronta Entrega) & Série 7 (OS / Sob Demanda)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Série 6 - VND (Vendas Balcão / Pronta Entrega) */}
              <div className="p-3 bg-blue-50/40 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    NF-e VND (Pronta Entrega)
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                    Série VND
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Série NF-e</label>
                    <input
                      type="text"
                      value={serieNfe}
                      onChange={(e) => setSerieNfe(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Próximo Nº</label>
                    <input
                      type="number"
                      min="1"
                      value={proximoNumeroNfe}
                      onChange={(e) => setProximoNumeroNfe(parseInt(e.target.value) || 1)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-center"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Usado automaticamente em emissões de vendas diretas e balcão (VND).
                </p>
              </div>

              {/* Série 7 - OS (Ordens de Serviço / Sob Demanda) */}
              <div className="p-3 bg-amber-50/40 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                    NF-e OS (Produção / Demanda)
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                    Série OS
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Série NF-e</label>
                    <input
                      type="text"
                      value={serieNfeOs}
                      onChange={(e) => setSerieNfeOs(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Próximo Nº</label>
                    <input
                      type="number"
                      min="1"
                      value={proximoNumeroNfeOs}
                      onChange={(e) => setProximoNumeroNfeOs(parseInt(e.target.value) || 1)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-center"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Usado automaticamente em emissões vinculadas a Ordens de Serviço (OS).
                </p>
              </div>

              {/* NFC-e Balcão / Cupom Fiscal */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                    NFC-e (Cupom Mod. 65)
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                    PDV
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Série NFC-e</label>
                    <input
                      type="text"
                      value={serieNfce}
                      onChange={(e) => setSerieNfce(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Próximo Nº</label>
                    <input
                      type="number"
                      min="1"
                      value={proximoNumeroNfce}
                      onChange={(e) => setProximoNumeroNfce(parseInt(e.target.value) || 1)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-center"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Sequência para emissão de cupom fiscal em vendas rápidas de balcão.
                </p>
              </div>
            </div>
          </div>

          {/* Padrões Fiscais (CFOP, NCM, CSOSN) */}
          <div className="space-y-4 pt-2 border-t">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Regras Fiscais Padrão (Tecido Sublimado Fortaleza / Sublimação)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-6">
                <label className="block text-xs font-bold text-slate-700 mb-1">Natureza da Operação Padrão</label>
                <input
                  type="text"
                  value={naturezaOperacaoPadrao}
                  onChange={(e) => setNaturezaOperacaoPadrao(e.target.value)}
                  placeholder="Venda de mercadoria e serviços têxteis"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">NCM Padrão</label>
                <input
                  type="text"
                  value={ncmPadrao}
                  onChange={(e) => setNcmPadrao(e.target.value)}
                  placeholder="6109.10.00"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">CFOP Interno</label>
                <input
                  type="text"
                  value={cfopPadraoInterno}
                  onChange={(e) => setCfopPadraoInterno(e.target.value)}
                  placeholder="5102"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">CSOSN Padrão</label>
                <input
                  type="text"
                  value={csosnPadrao}
                  onChange={(e) => setCsosnPadrao(e.target.value)}
                  placeholder="102"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Integração Fiscal: Provedores (Spedy vs Focus NFe vs Interno) */}
          <div className="space-y-5 pt-2 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-600" />
                <span>Provedor de Emissão Fiscal (API)</span>
              </h3>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setProvedorFiscal('SPEDY')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    provedorFiscal === 'SPEDY'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Spedy API (Oficial)
                </button>
                <button
                  type="button"
                  onClick={() => setProvedorFiscal('FOCUS_NFE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    provedorFiscal === 'FOCUS_NFE'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Focus NFe
                </button>
                <button
                  type="button"
                  onClick={() => setProvedorFiscal('INTERNO')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    provedorFiscal === 'INTERNO'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  SEBRAE / Interno
                </button>
              </div>
            </div>

            {/* SPEDY CONFIGURATION */}
            {provedorFiscal === 'SPEDY' && (
              <div className="space-y-4">
                <div className="bg-cyan-50/80 border border-cyan-200 rounded-2xl p-4 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
                      <p className="font-extrabold text-cyan-950">
                        Integração Spedy API Ativa (Plano Desenvolvedor - 1.000 notas/mês no Sandbox)
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 rounded font-mono font-bold text-[10px]">
                      stage-app.spedy.com.br
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    O ERP está configurado para se comunicar diretamente com a API v1 da Spedy para emissão de NF-e e NFC-e, transmissão em fila e sincronização em tempo real.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                    <div className="bg-white p-3 rounded-xl border border-cyan-100 shadow-xs">
                      <p className="font-bold text-cyan-900 text-[11px] mb-1">1. Empresa no Spedy</p>
                      <p className="text-[10px] text-slate-600 leading-relaxed">
                        Conectado à <strong>TECIDO SUBLIMADO FORTALEZA</strong> (CNPJ 36.047.818/0001-07) com sucesso.
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-cyan-100 shadow-xs">
                      <p className="font-bold text-cyan-900 text-[11px] mb-1">2. Certificado Digital A1</p>
                      <p className="text-[10px] text-slate-600 leading-relaxed">
                        Para validação SEFAZ oficial, faça o upload do seu certificado A1 (.pfx) no painel do Spedy.
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-cyan-100 shadow-xs">
                      <p className="font-bold text-cyan-900 text-[11px] mb-1">3. Chave de API (X-Api-Key)</p>
                      <p className="text-[10px] text-slate-600 leading-relaxed">
                        Chave do sandbox vinculada automaticamente. Notas transmitidas ficam salvas no painel do Spedy.
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 flex flex-wrap gap-2">
                    <a
                      href="https://stage-app.spedy.com.br/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg font-bold text-[11px] transition shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir Painel Sandbox da Spedy (stage-app.spedy.com.br)</span>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ambiente Spedy *</label>
                    <select
                      value={ambiente}
                      onChange={(e) => setAmbiente(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    >
                      <option value="HOMOLOGACAO">Homologação / Sandbox (sandbox-api.spedy.com.br)</option>
                      <option value="PRODUCAO">Produção (api.spedy.com.br)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-8">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Chave de API Spedy (X-Api-Key) *
                    </label>
                    <input
                      type="text"
                      value={tokenSpedy}
                      onChange={(e) => setTokenSpedy(e.target.value)}
                      placeholder="Cole sua Chave da API Spedy"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 tracking-wider"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Chave de Sandbox: de48c1cb-1f56-4c02-9a2a-6278c381b60a
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* FOCUS NFE CONFIGURATION */}
            {provedorFiscal === 'FOCUS_NFE' && (
              <div className="space-y-4">
                <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 text-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <p className="font-extrabold text-blue-950">Conexão com a SEFAZ via Focus NFe</p>
                  </div>
                  <div className="pt-1 flex flex-wrap gap-2">
                    <a
                      href="https://painel.focusnfe.com.br/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir Painel do Focus NFe</span>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ambiente de Operação *</label>
                    <select
                      value={ambiente}
                      onChange={(e) => setAmbiente(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    >
                      <option value="HOMOLOGACAO">Homologação (Testes Focus)</option>
                      <option value="PRODUCAO">Produção (Notas Oficiais SEFAZ)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-8">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Token da API Focus NFe *
                    </label>
                    <input
                      type="text"
                      value={tokenFocusNfe}
                      onChange={(e) => setTokenFocusNfe(e.target.value)}
                      placeholder="Cole aqui seu Token (ex: a1b2c3d4e5f6...)"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 tracking-wider"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SEBRAE / INTERNAL CONFIGURATION */}
            {provedorFiscal === 'INTERNO' && (
              <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-4 text-xs space-y-2">
                <p className="font-extrabold text-purple-950">
                  Emissor SEBRAE Gratuito / Geração de XML e DANFE Local
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Gera o XML padrão oficial SEFAZ v4.00 com cálculo de ICMS/Simples Nacional e DANFE A4. Você pode baixar os arquivos XML para importar no Emissor Gratuito do SEBRAE ou enviar para o seu contador.
                </p>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t flex items-center justify-between">
            {configSavedMsg && (
              <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                <Check className="w-4 h-4" />
                <span>Configurações salvas e sincronizadas com sucesso!</span>
              </div>
            )}
            {!configSavedMsg && <div />}

            <button
              type="submit"
              disabled={isSavingConfig}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition ml-auto"
            >
              {isSavingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Salvar Configurações Fiscais</span>
            </button>
          </div>
        </form>
      )}

      {/* Modals */}
      {selectedNotaXml && (
        <XmlModal
          nota={selectedNotaXml}
          onClose={() => setSelectedNotaXml(null)}
          onDownload={handleDownloadXml}
        />
      )}

      {selectedNotaCancel && (
        <CancelamentoModal
          nota={selectedNotaCancel}
          onClose={() => setSelectedNotaCancel(null)}
          onSuccess={(cancelada) => {
            if (cancelada?.id) {
              setNotas((prev) => (prev || []).map((n) => (n?.id === cancelada.id ? cancelada : n)));
            }
            loadData();
          }}
        />
      )}
    </div>
  );
};
