import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Search,
  Calendar,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Printer,
  X,
  ExternalLink,
  ShieldCheck,
  Tag,
  RefreshCw,
  User,
  Phone,
  ArrowUpRight,
  TrendingUp,
  Eye,
  ChevronRight,
  Layers,
  PackageCheck,
  CreditCard,
  Building2,
} from 'lucide-react';
import { ApiService } from '../../services/api';
import { OrdemServico, PdvTransaction } from '../../server/types/os';
import { OsPrintableA4 } from './OsPrintableA4';
import { filterVisibleHistory } from '../../utils/userPermissions';

const formatMoney = (val: number): string => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const parseDate = (dateStr?: string): Date | null => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const yearPart = parts[2].split(' ')[0];
      return new Date(Number(yearPart), Number(parts[1]) - 1, Number(parts[0]));
    }
  }
  if (str.includes('-') && !str.includes('T')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

const isCreatedToday = (os: OrdemServico): boolean => {
  const now = new Date();
  const tDay = now.getDate();
  const tMonth = now.getMonth();
  const tYear = now.getFullYear();

  const datesToCheck = [os.dataVenda, os.createdAt, os.prazoEntrega].filter(Boolean);
  for (const dStr of datesToCheck) {
    if (!dStr) continue;
    const dt = parseDate(dStr);
    if (dt && dt.getDate() === tDay && dt.getMonth() === tMonth && dt.getFullYear() === tYear) {
      return true;
    }
  }
  return false;
};

export const OsHistoryModuleView: React.FC = () => {
  const [osList, setOsList] = useState<OrdemServico[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedShortcut, setSelectedShortcut] = useState<string>('30days');

  // Full Screen Modal State for OS Details
  const [selectedOsDetail, setSelectedOsDetail] = useState<OrdemServico | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'detalhes' | 'comprovantes' | 'historico' | 'impressao'>('detalhes');

  // Date Filters
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(thirtyDaysAgo);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const osData = await ApiService.getOrdensServico().catch(() => []);
      const realOsList: OrdemServico[] = Array.isArray(osData) ? osData : [];
      setOsList(realOsList);
    } catch (error) {
      console.error('Erro ao carregar histórico de OS:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Poll periodically when tab is visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 12000);

    const handleFocus = () => loadData(true);
    const handleOsChanged = () => loadData(true);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('os-changed', handleOsChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('os-changed', handleOsChanged);
    };
  }, []);

  // Apply Shortcuts
  const handleShortcutChange = (type: string) => {
    setSelectedShortcut(type);
    const now = new Date();

    if (type === 'today') {
      const d = now.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (type === '7days') {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (type === '30days') {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (type === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (type === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const startDateTime = useMemo(() => {
    if (!startDate) return null;
    const d = parseDate(startDate);
    if (!d) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }, [startDate]);

  const endDateTime = useMemo(() => {
    if (!endDate) return null;
    const d = parseDate(endDate);
    if (!d) return null;
    d.setHours(23, 59, 59, 999);
    return d;
  }, [endDate]);

  // Filtered OS list by Date and Search (sorted newest first for real-time updates)
  const filteredOsList = useMemo(() => {
    return osList
      .filter((os) => {
        // Exclude Orçamentos (ORC)
        if ((os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento || os.codigo?.startsWith('ORC')) {
          return false;
        }

        // Date filter
        if (startDateTime || endDateTime) {
          const dt = parseDate(os.dataVenda || os.createdAt);
          if (dt) {
            if (startDateTime && dt < startDateTime) return false;
            if (endDateTime && dt > endDateTime) return false;
          }
        }

        // Search filter
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const code = (os.codigo || '').toLowerCase();
          const client = (os.clienteNome || '').toLowerCase();
          const phone = (os.clienteTelefone || '').toLowerCase();
          const cpf = (os.clienteCpfCnpj || '').toLowerCase();
          const op = (os.operador || '').toLowerCase();
          const itemsStr = (os.itens || []).map((i) => i.descricao.toLowerCase()).join(' ');

          return (
            code.includes(term) ||
            client.includes(term) ||
            phone.includes(term) ||
            cpf.includes(term) ||
            op.includes(term) ||
            itemsStr.includes(term)
          );
        }

        return true;
      })
      .sort((a, b) => {
        const dtA = parseDate(a.dataVenda || a.createdAt)?.getTime() || 0;
        const dtB = parseDate(b.dataVenda || b.createdAt)?.getTime() || 0;
        return dtB - dtA;
      });
  }, [osList, startDateTime, endDateTime, searchTerm]);

  // Separate into Pendentes and Pagos EXACTLY like Relatórios:
  // - PAGOS: os.paymentStatus === 'pago'
  // - PENDENTES: os.paymentStatus !== 'pago'
  const { pendentesList, pagosList } = useMemo(() => {
    const pendentes: OrdemServico[] = [];
    const pagos: OrdemServico[] = [];

    filteredOsList.forEach((os) => {
      if (os.paymentStatus === 'pago') {
        pagos.push(os);
      } else {
        pendentes.push(os);
      }
    });

    return { pendentesList: pendentes, pagosList: pagos };
  }, [filteredOsList]);

  // Summary totals
  const totalGeralVal = useMemo(
    () => filteredOsList.reduce((acc, os) => acc + (os.valorFinal || 0), 0),
    [filteredOsList]
  );

  const totalPendenteVal = useMemo(() => {
    return pendentesList.reduce((acc, os) => {
      const finalVal = os.valorFinal || 0;
      const entrada = os.valorEntrada || 0;
      const saldo = Math.max(0, finalVal - entrada);
      return acc + saldo;
    }, 0);
  }, [pendentesList]);

  const totalPagoVal = useMemo(() => {
    return pagosList.reduce((acc, os) => acc + (os.valorFinal || 0), 0);
  }, [pagosList]);

  const taxaQuitacao = useMemo(() => {
    if (filteredOsList.length === 0) return 0;
    return Math.round((pagosList.length / filteredOsList.length) * 100);
  }, [filteredOsList, pagosList]);

  const handleOpenDetailModal = (os: OrdemServico, initialTab: 'detalhes' | 'comprovantes' | 'historico' | 'impressao' = 'detalhes') => {
    setSelectedOsDetail(os);
    setModalActiveTab(initialTab);
  };

  return (
    <div className="w-full">
      {/* 3 COLUMNS LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* COLUMN 1: SIDEBAR CONTROLS & METRICS (NARROWER SIDEBAR) */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-4">
          {/* HEADER CARD */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-base font-black text-slate-900 tracking-tight">Histórico de Ordens de Serviço</h1>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Filtros e indicadores do caixa
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => loadData()}
                disabled={isLoading}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                title="Atualizar Dados"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por OS, cliente, CPF, item ou atendente..."
                className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* DATE RANGE INPUTS */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Período de Consulta</span>
              <div className="flex flex-col gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setSelectedShortcut('custom');
                    }}
                    className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none w-full"
                  />
                </div>
                <div className="text-center font-extrabold text-[10px] text-slate-400 uppercase tracking-wider">até</div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setSelectedShortcut('custom');
                    }}
                    className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none w-full"
                  />
                </div>
              </div>
            </div>

            {/* DATE SHORTCUT BUTTONS */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleShortcutChange('today')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold text-center transition cursor-pointer ${
                  selectedShortcut === 'today' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => handleShortcutChange('7days')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold text-center transition cursor-pointer ${
                  selectedShortcut === '7days' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                7 Dias
              </button>
              <button
                type="button"
                onClick={() => handleShortcutChange('30days')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold text-center transition cursor-pointer ${
                  selectedShortcut === '30days' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                30 Dias
              </button>
              <button
                type="button"
                onClick={() => handleShortcutChange('month')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold text-center transition cursor-pointer ${
                  selectedShortcut === 'month' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Mês
              </button>
              <button
                type="button"
                onClick={() => handleShortcutChange('all')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold text-center transition cursor-pointer ${
                  selectedShortcut === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
            </div>
          </div>

          {/* METRIC SUMMARY CARDS (STACKED VERTICALLY) */}
          <div className="space-y-3">
            {/* CARD 1: TOTAL OS */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Total de OS no Período</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-slate-900">{filteredOsList.length}</h3>
                  <span className="text-xs font-bold text-slate-500">Ordens</span>
                </div>
                <p className="text-[11px] text-slate-500 font-bold mt-1">
                  Movimentação: <strong className="text-slate-900">{formatMoney(totalGeralVal)}</strong>
                </p>
              </div>
              <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            {/* CARD 2: PENDENTES */}
            <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider block">OS Pendentes (A Receber)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-amber-600">{pendentesList.length}</h3>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    Em aberto
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 font-bold mt-1">
                  Saldo a Receber: <strong className="text-amber-900">{formatMoney(totalPendenteVal)}</strong>
                </p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>

            {/* CARD 3: PAGOS */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider block">OS Pagas (Quitadas)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-emerald-600">{pagosList.length}</h3>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Liquidadas
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 font-bold mt-1">
                  Total Baixado: <strong className="text-emerald-900">{formatMoney(totalPagoVal)}</strong>
                </p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            {/* CARD 4: TAXA DE QUITAÇÃO */}
            <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-blue-800 uppercase tracking-wider block">Taxa de Quitação</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-blue-600">{taxaQuitacao}%</h3>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                    {pagosList.length} de {filteredOsList.length}
                  </span>
                </div>
                <p className="text-[11px] text-blue-800 font-bold mt-1">
                  Índice de recebimento do caixa
                </p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNS 2 & 3: PENDENTES & PAGOS (IN LIST FORMAT LIKE RELATÓRIOS) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {/* COLUMN 2: PENDENTES */}
          <div className="bg-white p-5 rounded-3xl border border-amber-200/80 shadow-sm flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-amber-950 uppercase tracking-wider">Pendentes</h2>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-800 rounded-full">
                      {pendentesList.length} OS
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Ordens de serviço com saldo a receber
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-amber-900 block tracking-tight">
                  {formatMoney(totalPendenteVal)}
                </span>
                <span className="text-[10px] font-extrabold text-amber-700 uppercase">A Receber</span>
              </div>
            </div>

            {/* LISTA DE PENDENTES */}
            <div className="space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
              {pendentesList.length > 0 ? (
                pendentesList.map((os) => {
                  const valorFinal = os.valorFinal || 0;
                  const valorEntrada = os.valorEntrada || 0;
                  const valorAberto = Math.max(0, valorFinal - valorEntrada);

                  return (
                    <div
                      key={os.id}
                      className="p-3.5 bg-amber-50/60 hover:bg-amber-100/90 border border-amber-200/80 rounded-2xl transition space-y-2.5"
                    >
                      <div
                        onClick={() => handleOpenDetailModal(os, 'detalhes')}
                        className="flex items-center justify-between cursor-pointer group min-w-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="px-2.5 py-1 bg-amber-200/90 text-amber-950 font-black text-xs rounded-lg shrink-0">
                            {os.codigo.startsWith('OS') || os.codigo.startsWith('VND') ? os.codigo : `OS #${os.codigo}`}
                          </span>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {os.clienteNome || 'Cliente não informado'}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {os.dataVenda || 'Sem data'} • {os.operador || 'Atendente'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right pl-2 shrink-0">
                          <span className="text-xs font-black text-amber-900 block">
                            {formatMoney(valorAberto)}
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 group-hover:underline flex items-center justify-end gap-0.5">
                            Ver Detalhes <ArrowUpRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>

                      {/* QUICK ACTION BUTTONS */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-amber-200/60 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(os, 'detalhes')}
                          className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 font-extrabold rounded-lg border border-amber-200 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Detalhes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(os, 'comprovantes')}
                          className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-800 font-extrabold rounded-lg border border-amber-200 transition flex items-center gap-1 cursor-pointer"
                        >
                          <DollarSign className="w-3 h-3" />
                          <span>Comprovante</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(os, 'historico')}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-lg border border-amber-200 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Histórico</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(os, 'impressao')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer ml-auto"
                        >
                          <Printer className="w-3 h-3" />
                          <span>A4</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Nenhuma OS pendente no período selecionado.
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: PAGOS */}
          <div className="bg-white p-5 rounded-3xl border border-emerald-200/80 shadow-sm flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-emerald-950 uppercase tracking-wider">Pagos / Quitados</h2>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded-full">
                      {pagosList.length} OS
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Ordens de serviço totalmente quitadas
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-emerald-900 block tracking-tight">
                  {formatMoney(totalPagoVal)}
                </span>
                <span className="text-[10px] font-extrabold text-emerald-700 uppercase">Total Quitado</span>
              </div>
            </div>

            {/* LISTA DE PAGOS */}
            <div className="space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
              {pagosList.length > 0 ? (
                pagosList.map((os) => {
                  const valorFinal = os.valorFinal || 0;

                  return (
                    <div
                      key={os.id}
                      className="p-3.5 bg-emerald-50/60 hover:bg-emerald-100/90 border border-emerald-200/80 rounded-2xl transition space-y-2.5"
                    >
                      <div
                        onClick={() => handleOpenDetailModal(os, 'detalhes')}
                        className="flex items-center justify-between cursor-pointer group min-w-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="px-2.5 py-1 bg-emerald-200/90 text-emerald-950 font-black text-xs rounded-lg shrink-0">
                            {os.codigo.startsWith('OS') || os.codigo.startsWith('VND') ? os.codigo : `OS #${os.codigo}`}
                          </span>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {os.clienteNome || 'Cliente não informado'}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {os.dataVenda || 'Sem data'} • {os.operador || 'Atendente'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right pl-2 shrink-0">
                          <span className="text-xs font-black text-emerald-900 block">
                            {formatMoney(valorFinal)}
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 group-hover:underline flex items-center justify-end gap-0.5">
                            Ver Detalhes <ArrowUpRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>

                      {/* QUICK ACTION BUTTONS */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-emerald-200/60 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(os, 'detalhes')}
                          className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 font-extrabold rounded-lg border border-emerald-200 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Detalhes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(os, 'comprovantes')}
                          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 font-extrabold rounded-lg border border-emerald-200 transition flex items-center gap-1 cursor-pointer"
                        >
                          <DollarSign className="w-3 h-3" />
                          <span>Comprovante</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(os, 'historico')}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-lg border border-emerald-200 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Histórico</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(os, 'impressao')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer ml-auto"
                        >
                          <Printer className="w-3 h-3" />
                          <span>A4</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Nenhuma OS quitada no período selecionado.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FULL-SCREEN DETAIL MODAL (Matching ReportsModuleView model) */}
      {selectedOsDetail && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* MODAL HEADER */}
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600 text-white rounded-2xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black">{selectedOsDetail.codigo}</h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                        selectedOsDetail.paymentStatus === 'pago'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {selectedOsDetail.paymentStatus === 'pago' ? 'Pago' : 'Pendente'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Cliente: {selectedOsDetail.clienteNome} • Emissão: {selectedOsDetail.dataVenda || 'N/I'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModalActiveTab('impressao')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir A4</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOsDetail(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* TAB BAR NAVIGATION INSIDE MODAL */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex flex-wrap gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setModalActiveTab('detalhes')}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  modalActiveTab === 'detalhes'
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Detalhes & Itens</span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveTab('comprovantes')}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  modalActiveTab === 'comprovantes'
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Comprovantes de Pagamento</span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveTab('historico')}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  modalActiveTab === 'historico'
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Histórico & Alterações</span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveTab('impressao')}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  modalActiveTab === 'impressao'
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>Impressões & A4</span>
              </button>
            </div>

            {/* TAB CONTENT BODY */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* TAB 1: DETALHES & ITENS */}
              {modalActiveTab === 'detalhes' && (
                <div className="space-y-6">
                  {/* CARDS RESUMO FINANCEIRO */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Valor Total Final</span>
                      <span className="text-2xl font-black text-slate-900 block">
                        {formatMoney(selectedOsDetail.valorFinal || 0)}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">Subtotal da Ordem de Serviço</span>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                      <span className="text-xs font-bold text-emerald-800 uppercase block mb-1">Valor Entrada / Pago</span>
                      <span className="text-2xl font-black text-emerald-900 block">
                        {formatMoney(selectedOsDetail.valorEntrada || (selectedOsDetail.paymentStatus === 'pago' ? selectedOsDetail.valorFinal : 0))}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Meio: {selectedOsDetail.formaPagamentoEntrada || selectedOsDetail.formaPagamento || 'Não especificado'}
                      </span>
                    </div>

                    <div className={`p-4 rounded-2xl border ${selectedOsDetail.paymentStatus === 'pago' ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                      <span className="text-xs font-bold text-slate-600 uppercase block mb-1">Saldo Restante</span>
                      <span className={`text-2xl font-black block ${selectedOsDetail.paymentStatus === 'pago' ? 'text-slate-700' : 'text-amber-900'}`}>
                        {formatMoney(Math.max(0, (selectedOsDetail.valorFinal || 0) - (selectedOsDetail.valorEntrada || (selectedOsDetail.paymentStatus === 'pago' ? selectedOsDetail.valorFinal : 0))))}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {selectedOsDetail.paymentStatus === 'pago' ? 'Totalmente quitado' : 'Aguardando pagamento do saldo'}
                      </span>
                    </div>
                  </div>

                  {/* GRID DADOS DO CLIENTE & PROCESSO */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">Cliente</span>
                      <p className="font-extrabold text-sm text-slate-900">{selectedOsDetail.clienteNome || 'Cliente Geral'}</p>
                      <p className="text-xs text-slate-500">CPF/CNPJ: {selectedOsDetail.clienteCpfCnpj || 'Não informado'}</p>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">Contato</span>
                      <p className="font-extrabold text-sm text-slate-900">{selectedOsDetail.clienteTelefone || 'Sem telefone'}</p>
                      <p className="text-xs text-slate-500">{selectedOsDetail.clienteEmail || 'Sem email'}</p>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">Datas</span>
                      <p className="font-bold text-xs text-slate-800">Emissão: {selectedOsDetail.dataVenda || 'N/I'}</p>
                      <p className="font-bold text-xs text-blue-700">Prazo Entrega: {selectedOsDetail.prazoEntrega || 'Não informado'}</p>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">Estágio de Produção</span>
                      <span className="inline-block mt-1 px-3 py-1 bg-blue-100 text-blue-900 font-black text-xs rounded-xl">
                        {selectedOsDetail.estagioAtual || 'Sistema'}
                      </span>
                    </div>
                  </div>

                  {/* TABELA DE ITENS */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                      <h3 className="font-black text-sm text-slate-900">Itens e Serviços Contratados</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase">
                          <tr>
                            <th className="p-3">Item / Código</th>
                            <th className="p-3">Descrição</th>
                            <th className="p-3">Unidade</th>
                            <th className="p-3 text-center">Qtd</th>
                            <th className="p-3 text-right">Valor Unit.</th>
                            <th className="p-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                          {selectedOsDetail.itens && selectedOsDetail.itens.length > 0 ? (
                            selectedOsDetail.itens.map((item, idx) => (
                              <tr key={item.id || idx}>
                                <td className="p-3 font-bold text-blue-700">{item.codigo || `#${idx + 1}`}</td>
                                <td className="p-3 font-extrabold">{item.categoria ? `${item.categoria} - ${item.descricao}` : item.descricao}</td>
                                <td className="p-3">{item.unidade || 'UN'}</td>
                                <td className="p-3 text-center font-bold">{item.quantidade}</td>
                                <td className="p-3 text-right">{formatMoney(item.valorUnitario)}</td>
                                <td className="p-3 text-right font-black text-slate-900">{formatMoney(item.total)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                                Nenhum item discriminado na OS.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* OBSERVAÇÕES */}
                  {selectedOsDetail.observacoes && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Observações do Pedido</span>
                      <p className="text-xs font-medium text-slate-800 whitespace-pre-wrap">{selectedOsDetail.observacoes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: COMPROVANTES DE PAGAMENTO */}
              {modalActiveTab === 'comprovantes' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                        Comprovante & Registro de Pagamento
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                          selectedOsDetail.paymentStatus === 'pago'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {selectedOsDetail.paymentStatus === 'pago' ? 'Pagamento Concluído' : 'Aguardando Saldo'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[10px]">Forma de Pagamento Principal</span>
                        <p className="font-black text-sm text-slate-900">{selectedOsDetail.formaPagamento || 'Não informada'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[10px]">Entrada Registrada</span>
                        <p className="font-black text-sm text-emerald-800">
                          {formatMoney(selectedOsDetail.valorEntrada || 0)} ({selectedOsDetail.formaPagamentoEntrada || 'Entrada'})
                        </p>
                      </div>
                    </div>

                    {/* IMAGEM DO COMPROVANTE */}
                    {selectedOsDetail.comprovanteUrl ? (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-700 uppercase block">Anexo do Comprovante</span>
                        <div className="p-4 bg-slate-900 rounded-2xl flex flex-col items-center justify-center gap-3">
                          <img
                            src={selectedOsDetail.comprovanteUrl}
                            alt="Comprovante de Pagamento"
                            className="max-h-96 object-contain rounded-lg border border-slate-800"
                          />
                          <a
                            href={selectedOsDetail.comprovanteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Abrir Comprovante em Nova Aba
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-2">
                        <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="font-bold text-slate-700 text-sm">Comprovante Digital Lançado no Caixa</p>
                        <p className="text-xs text-slate-500">
                          A transação financeira foi baixada diretamente no módulo fiscal e caixa da empresa.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: HISTÓRICO & ALTERAÇÕES */}
              {modalActiveTab === 'historico' && (() => {
                const isVndSale = Boolean(
                  selectedOsDetail.codigo?.toUpperCase().startsWith('VND') ||
                  selectedOsDetail.codigo?.toUpperCase().startsWith('PDV') ||
                  selectedOsDetail.codigo?.toUpperCase().startsWith('CDV') ||
                  selectedOsDetail.observacoes?.toLowerCase().includes('venda') ||
                  selectedOsDetail.observacoes?.toLowerCase().includes('pdv')
                );

                return (
                  <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200">
                      <h3 className="font-black text-base text-slate-900 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        Linha do Tempo & Histórico de Alterações
                      </h3>

                      <div className="space-y-3">
                        {(() => {
                          const visibleHistory = filterVisibleHistory(selectedOsDetail.historicoEdicoes);
                          return visibleHistory.length > 0 ? (
                            visibleHistory.map((log) => (
                              <div key={log.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                <div className="p-2 bg-blue-100 text-blue-800 rounded-lg font-black text-xs shrink-0">
                                  <Clock className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-xs text-slate-900">{log.acao}</span>
                                    <span className="text-[10px] font-semibold text-slate-400">• {log.dataHora}</span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-0.5">{log.detalhes || 'Sem detalhes adicionais'}</p>
                                  <span className="text-[10px] font-bold text-blue-700 block mt-1">Por: {log.usuario}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="space-y-3">
                              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg font-black text-xs shrink-0">
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-xs text-slate-900">
                                      {isVndSale ? 'Lançamento de VENDA' : 'Abertura e Lançamento de OS'}
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-400">• {selectedOsDetail.dataVenda || 'Data Registro'}</span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-0.5">
                                    {isVndSale
                                      ? `Venda Direta registrada e vinculada ao cliente ${selectedOsDetail.clienteNome || 'Consumidor Final'}.`
                                      : `Ordem de Serviço criada e vinculada ao cliente ${selectedOsDetail.clienteNome || 'Cliente não informado'}.`}
                                  </p>
                                  <span className="text-[10px] font-bold text-blue-700 block mt-1">Operador: {selectedOsDetail.operador || 'Atendente'}</span>
                                </div>
                              </div>

                              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                <div className="p-2 bg-blue-100 text-blue-800 rounded-lg font-black text-xs shrink-0">
                                  <Tag className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-xs text-slate-900">
                                      {isVndSale ? 'Status de Conclusão da Venda' : 'Estágio de Produção Atual'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-0.5">
                                    {isVndSale
                                      ? `Venda finalizada e processada pelo sistema.`
                                      : `Status produtivo atualizado para "${selectedOsDetail.estagioAtual || 'Sistema'}".`}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 4: IMPRESSÃO E A4 */}
              {modalActiveTab === 'impressao' && (
                <div className="bg-slate-100 p-4 rounded-2xl border border-slate-300 overflow-x-auto">
                  <OsPrintableA4 os={selectedOsDetail} onClose={() => setSelectedOsDetail(null)} inlineMode={true} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
