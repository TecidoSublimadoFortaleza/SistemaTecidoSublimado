import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Search,
  MapPin,
  CheckCircle2,
  ChevronRight,
  X,
  Clock,
  AlertCircle,
  ShieldCheck,
  Package,
  Layers,
  Sparkles,
  Calendar,
  Send,
  RefreshCw,
  ExternalLink,
  Tag,
  Eye,
  FileText,
  PackageCheck,
  RotateCcw
} from 'lucide-react';
import { RoleTitle } from '../../types/frontend';
import { OrdemServico, OsHistoryEntry, ProductionStage } from '../../server/types/os';
import { ApiService } from '../../services/api';
import { getLoggedUserAndPerfil } from '../../utils/userPermissions';
import { formatDateBR as formatDateBr } from '../../utils/formatters';
import { DeliveryModal } from '../entregaDevolucao/DeliveryModal';
import { ReturnModal } from '../entregaDevolucao/ReturnModal';

interface ExpedicaoModuleViewProps {
  userRole?: RoleTitle | string;
}

const DESTINATIONS = [
  'RETIRADA (RECEPÇÃO)',
  'EXCURSÃO',
  'CORREIOS',
  'SHOPEE'
];

export const ExpedicaoModuleView: React.FC<ExpedicaoModuleViewProps> = ({ userRole }) => {
  const [osList, setOsList] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'todas' | 'no_setor' | 'producao' | 'expedidas'>('todas');
  const [destinationFilter, setDestinationFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Modal state
  const [selectedOs, setSelectedOs] = useState<OrdemServico | null>(null);
  const [deliveryModalOs, setDeliveryModalOs] = useState<OrdemServico | null>(null);
  const [returnModalOs, setReturnModalOs] = useState<OrdemServico | null>(null);
  const [dispatchDestination, setDispatchDestination] = useState<string>('');
  const [trackingOrRecipient, setTrackingOrRecipient] = useState<string>('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await ApiService.getOrdensServico();
      if (Array.isArray(data)) {
        // REGRA: APENAS ORDENS DE SERVIÇO (ignora vendas rápidas de PDV/VND e Orçamentos/ORC)
        // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
        // ENQUANTO A OS ESTIVER EM "Aguardando Entrada no Fluxo de Produção" (** OS no Sistema), ELA NÃO DEVE SER EXIBIDA EM CONTROLE DE EXPEDIÇÃO.
        // Assim que a OS é gerada e entra no fluxo de produção, ela é enviada paralelamente para:
        // 1. O Fluxo de Produção (Kanban)
        // 2. Conferência de OS
        // 3. Controle de Expedição
        const pureOsList = data.filter((os) => {
          const cod = (os.codigo || '').toUpperCase();
          const isOrc =
            (os as any).tipoDocumento === 'ORCAMENTO' ||
            (os as any).isOrcamento ||
            cod.startsWith('ORC');
          const isSistema = (os.estagioAtual || 'Sistema').trim().toLowerCase() === 'sistema';
          const isCanceled = os.status === 'Cancelado';
          return !cod.startsWith('VND') && !cod.startsWith('PDV') && !isOrc && !isSistema && !isCanceled;
        });

        setOsList(pureOsList);
      }
    } catch (error) {
      console.error('Erro ao buscar OS para Controle de Expedição:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, 30000);

    const handleOsChanged = () => loadData(true);
    const handleNotification = () => loadData(true);

    window.addEventListener('os-changed', handleOsChanged);
    window.addEventListener('subligestao_new_notification', handleNotification);

    return () => {
      clearInterval(interval);
      window.removeEventListener('os-changed', handleOsChanged);
      window.removeEventListener('subligestao_new_notification', handleNotification);
    };
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    let total = osList.length;
    let noSetor = 0;
    let emProducao = 0;
    let expedidas = 0;

    osList.forEach((os) => {
      const isExp = Boolean(
        os.expedido === true ||
        (os as any).dataExpedicao ||
        (os.status === 'Concluído' && os.estagioAtual !== 'Expedição')
      );

      if (isExp) {
        expedidas++;
      } else if (os.estagioAtual === 'Expedição') {
        noSetor++;
      } else {
        emProducao++;
      }
    });

    return { total, noSetor, emProducao, expedidas };
  }, [osList]);

  // Filtered List
  const filteredOsList = useMemo(() => {
    let list = [...osList];

    // Filter by Tab
    if (filterTab === 'no_setor') {
      list = list.filter((os) => os.estagioAtual === 'Expedição' && !os.expedido);
    } else if (filterTab === 'producao') {
      list = list.filter((os) => os.estagioAtual !== 'Expedição' && !os.expedido && os.status !== 'Concluído');
    } else if (filterTab === 'expedidas') {
      list = list.filter((os) => Boolean(os.expedido === true || (os as any).dataExpedicao || os.status === 'Concluído'));
    }

    // Filter by Destination
    if (destinationFilter !== 'ALL') {
      list = list.filter((os) => {
        const explicitDest = String((os as any).destinoExpedicao || (os as any).destino || '').toUpperCase();
        if (explicitDest) {
          return explicitDest.includes(destinationFilter.toUpperCase());
        }
        const dest = String(os.observacoes || '').toUpperCase();
        return dest.includes(destinationFilter.toUpperCase());
      });
    }

    // Filter by Priority / Modality
    if (priorityFilter !== 'ALL') {
      list = list.filter((os) => {
        const tipo = (os.tipoExpedicao || 'NORMAL').toUpperCase();
        return tipo === priorityFilter.toUpperCase();
      });
    }

    // Search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (os) =>
          (os.codigo || '').toLowerCase().includes(term) ||
          (os.clienteNome || '').toLowerCase().includes(term) ||
          (os.vendedorNome || os.operador || '').toLowerCase().includes(term) ||
          (os.clienteCpfCnpj || '').includes(term)
      );
    }

    // Sort: Expedição stage first, then creation date desc
    return list.sort((a, b) => {
      if (a.estagioAtual === 'Expedição' && b.estagioAtual !== 'Expedição') return -1;
      if (a.estagioAtual !== 'Expedição' && b.estagioAtual === 'Expedição') return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [osList, filterTab, destinationFilter, priorityFilter, searchTerm]);

  const handleOpenDispatchModal = (os: OrdemServico) => {
    setSelectedOs(os);
    setDispatchDestination((os as any).destinoExpedicao || (os as any).destino || 'RETIRADA (RECEPÇÃO)');
    setTrackingOrRecipient('');
    setDispatchNotes((os as any).observacoesExpedicao || '');
  };

  const handleDispatchOs = async () => {
    if (!selectedOs || !dispatchDestination) return;
    setIsDispatching(true);

    try {
      const logged = getLoggedUserAndPerfil();
      const now = new Date();
      const nowISO = now.toISOString();
      const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

      // Calculate Next Stage if OS is at 'Expedição'
      const fluxo = selectedOs.fluxoProducao || [];
      const currentIndex = fluxo.indexOf(selectedOs.estagioAtual);
      let nextStage = selectedOs.estagioAtual;

      const updatedAcceptances = [...(selectedOs.setorAceitoPor || [])];

      if (selectedOs.estagioAtual === 'Expedição') {
        if (currentIndex !== -1 && currentIndex < fluxo.length - 1) {
          nextStage = fluxo[currentIndex + 1];
          const existingAccIndex = updatedAcceptances.findIndex((a) => a.estagio === selectedOs.estagioAtual);
          if (existingAccIndex >= 0) {
            updatedAcceptances[existingAccIndex] = {
              ...updatedAcceptances[existingAccIndex],
              status: 'Concluído',
              concluidoEm: dataHoraStr,
              concluidoEmISO: nowISO,
            };
          } else {
            updatedAcceptances.push({
              estagio: selectedOs.estagioAtual,
              funcionario: logged.name,
              aceitoEm: dataHoraStr,
              aceitoEmISO: nowISO,
              concluidoEm: dataHoraStr,
              concluidoEmISO: nowISO,
              status: 'Concluído',
            });
          }
        } else if (currentIndex !== -1) {
          nextStage = 'Concluído';
        }
      }

      const isNextFinal = nextStage === 'Concluído';

      const trackingText = trackingOrRecipient.trim() ? ` [Rastreio/Recebedor: ${trackingOrRecipient.trim()}]` : '';
      const obsAppend = `\n[Controle de Expedição - ${logged.name}]: Destino: ${dispatchDestination}.${trackingText}${dispatchNotes ? ` Obs: ${dispatchNotes}` : ''}`;
      const newObservacoes = selectedOs.observacoes ? `${selectedOs.observacoes}${obsAppend}` : obsAppend.trim();

      const newHistoryEntry: OsHistoryEntry = {
        id: `HST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        dataHora: dataHoraStr,
        usuario: logged.name,
        perfil: logged.role,
        acao: 'OS Expedida / Liberada para Envio',
        detalhes: `Destino: ${dispatchDestination}.${trackingText} Registrado no Controle de Expedição por ${logged.name}. Encaminhada para [${nextStage}].`,
      };
      const updatedHistory = [newHistoryEntry, ...(selectedOs.historicoEdicoes || [])];

      const isAtExpedicaoStage = selectedOs.estagioAtual === 'Expedição';

      let newTipoExpedicao = selectedOs.tipoExpedicao;
      if (dispatchDestination !== 'EXCURSÃO' && selectedOs.tipoExpedicao === 'EXPRESSO EXCURSÃO') {
        newTipoExpedicao = 'NORMAL';
      }

      const updatedOs: any = {
        expedido: isAtExpedicaoStage || isNextFinal ? true : (selectedOs.expedido || false),
        dataExpedicao: isAtExpedicaoStage || isNextFinal ? dataHoraStr : selectedOs.dataExpedicao,
        destinoExpedicao: dispatchDestination,
        destino: dispatchDestination,
        tipoExpedicao: newTipoExpedicao,
        expedidoPor: isAtExpedicaoStage || isNextFinal ? logged.name : selectedOs.expedidoPor,
        observacoesExpedicao: dispatchNotes ? `${dispatchNotes}${trackingText}` : trackingText.trim() || undefined,
        estagioAtual: isAtExpedicaoStage ? nextStage : selectedOs.estagioAtual,
        status: isNextFinal ? 'Concluído' : selectedOs.status || 'Em Produção',
        setorAceitoPor: updatedAcceptances,
        historicoEdicoes: updatedHistory,
        observacoes: newObservacoes,
        aguardandoAceitacaoDesde: isNextFinal ? undefined : (isAtExpedicaoStage ? nowISO : selectedOs.aguardandoAceitacaoDesde),
      };

      await ApiService.updateOs(selectedOs.id, updatedOs);

      if (isAtExpedicaoStage) {
        setSuccessToast(`✅ OS ${selectedOs.codigo} expedida com sucesso com destino para ${dispatchDestination}!`);
      } else {
        setSuccessToast(`✅ Destino de envio da OS ${selectedOs.codigo} definido como "${dispatchDestination}" com sucesso!`);
      }
      setTimeout(() => setSuccessToast(null), 4000);

      // Refresh data
      setSelectedOs(null);
      await loadData(true);
      window.dispatchEvent(new Event('os-changed'));
    } catch (error) {
      console.error('Erro ao expedir OS:', error);
      alert('Não foi possível registrar a expedição. Tente novamente.');
    } finally {
      setIsDispatching(false);
    }
  };

  const getStageBadge = (stage?: string) => {
    const s = (stage || 'Produção').trim();
    if (s.toLowerCase().includes('design')) {
      return 'bg-purple-100 text-purple-900 border-purple-300';
    }
    if (s.toLowerCase().includes('impress')) {
      return 'bg-sky-100 text-sky-900 border-sky-300';
    }
    if (s.toLowerCase().includes('calandr')) {
      return 'bg-amber-100 text-amber-900 border-amber-300';
    }
    if (s.toLowerCase().includes('costur')) {
      return 'bg-rose-100 text-rose-900 border-rose-300';
    }
    if (s.toLowerCase().includes('confer')) {
      return 'bg-indigo-100 text-indigo-900 border-indigo-300';
    }
    if (s.toLowerCase().includes('expedi')) {
      return 'bg-blue-600 text-white border-blue-700 font-black animate-pulse';
    }
    if (s.toLowerCase().includes('entreg')) {
      return 'bg-teal-100 text-teal-900 border-teal-300';
    }
    if (s.toLowerCase().includes('conclu')) {
      return 'bg-slate-100 text-slate-800 border-slate-300';
    }
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  const formatPrazoDisplay = (prazo?: string): string => {
    return formatDateBr(prazo);
  };

  return (
    <div className="p-4 sm:p-6 w-full h-full flex flex-col space-y-6">
      {/* Toast Feedback */}
      {successToast && (
        <div className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2 text-sm font-black">
            <CheckCircle2 className="w-5 h-5" />
            {successToast}
          </div>
          <button onClick={() => setSuccessToast(null)} className="p-1 hover:bg-emerald-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & KPI Summary */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-blue-600 text-white shadow-lg shrink-0">
              <Truck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Controle de Expedição
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-300">
                  Fluxo Paralelo Ativo
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-500 mt-1">
                Acompanhamento simultâneo de todas as Ordens de Serviço desde a geração até a expedição final
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData(false)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              title="Atualizar dados agora"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar
            </button>

            <div className="w-full sm:w-72 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar OS, Cliente, Vendedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-semibold"
              />
            </div>
          </div>
        </div>

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <button
            onClick={() => setFilterTab('todas')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              filterTab === 'todas'
                ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/60'
            }`}
          >
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Total em Expedição
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {stats.total}
            </div>
            <div className="text-[11px] font-bold text-slate-400 mt-0.5">
              Acompanhadas paralelamente
            </div>
          </button>

          <button
            onClick={() => setFilterTab('no_setor')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              filterTab === 'no_setor'
                ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-500/30'
                : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/60'
            }`}
          >
            <div className={`text-[11px] font-black uppercase tracking-wider ${filterTab === 'no_setor' ? 'text-blue-200' : 'text-slate-500'}`}>
              No Setor de Expedição
            </div>
            <div className={`text-2xl font-black mt-1 ${filterTab === 'no_setor' ? 'text-white' : 'text-blue-600'}`}>
              {stats.noSetor}
            </div>
            <div className={`text-[11px] font-bold mt-0.5 ${filterTab === 'no_setor' ? 'text-blue-200' : 'text-slate-400'}`}>
              Prontas para liberação
            </div>
          </button>

          <button
            onClick={() => setFilterTab('producao')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              filterTab === 'producao'
                ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-500/20 shadow-sm'
                : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/60'
            }`}
          >
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Em Produção Paralela
            </div>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {stats.emProducao}
            </div>
            <div className="text-[11px] font-bold text-slate-400 mt-0.5">
              Designer, Impressão, etc.
            </div>
          </button>

          <button
            onClick={() => setFilterTab('expedidas')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              filterTab === 'expedidas'
                ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-sm'
                : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/60'
            }`}
          >
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Já Expedidas
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {stats.expedidas}
            </div>
            <div className="text-[11px] font-bold text-slate-400 mt-0.5">
              Envio registrado / Concluído
            </div>
          </button>
        </div>

        {/* Secondary filters row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">
              Destino:
            </span>
            {['ALL', 'RETIRADA (RECEPÇÃO)', 'EXCURSÃO', 'CORREIOS', 'SHOPEE'].map((dest) => (
              <button
                key={dest}
                onClick={() => setDestinationFilter(dest)}
                className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer text-[11px] ${
                  destinationFilter === dest
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {dest === 'ALL' ? 'Todos' : dest.replace(' (RECEPÇÃO)', '')}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">
              Prioridade:
            </span>
            {['ALL', 'EXPRESSO EXCURSÃO', 'EXPRESSO DO DIA', 'NORMAL'].map((prio) => (
              <button
                key={prio}
                onClick={() => setPriorityFilter(prio)}
                className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer text-[11px] ${
                  priorityFilter === prio
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {prio === 'ALL' ? 'Todas' : prio}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List / Table */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        {loading && osList.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-12">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-sm font-bold">Carregando controle de expedição...</p>
          </div>
        ) : filteredOsList.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
            <h2 className="text-xl font-bold text-slate-800">Nenhuma Ordem de Serviço encontrada</h2>
            <p className="max-w-md mx-auto mt-2 text-sm text-slate-500">
              Não há Ordens de Serviço correspondentes aos filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto h-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/60">
                  <th className="py-4 px-6">OS</th>
                  <th className="py-4 px-6">Cliente & Vendedor</th>
                  <th className="py-4 px-6">Etapa na Produção</th>
                  <th className="py-4 px-6">Conferência</th>
                  <th className="py-4 px-6">Tipo & Destino</th>
                  <th className="py-4 px-6">Prazo</th>
                  <th className="py-4 px-6 text-right">Ação / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-sm">
                {filteredOsList.map((os) => {
                  const itemCount =
                    Array.isArray(os.itens) && os.itens.length > 0
                      ? os.itens.reduce((acc, it) => acc + (Number(it.quantidade) || 1), 0)
                      : 1;

                  const isExpedida = Boolean(
                    os.expedido === true || (os as any).dataExpedicao
                  );
                  const isAtExpedicaoStage = os.estagioAtual === 'Expedição';
                  const isConferida = Boolean(os.conferido === true);

                  return (
                    <tr
                      key={os.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isAtExpedicaoStage ? 'bg-blue-50/20' : ''
                      }`}
                    >
                      {/* OS Code */}
                      <td className="py-4 px-6 align-middle">
                        <div className="flex flex-col">
                          <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-slate-900 text-white font-black font-mono text-xs shadow-xs w-fit">
                            {os.codigo}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 font-semibold">
                            {formatDateBr(os.createdAt || os.dataVenda)}
                          </span>
                        </div>
                      </td>

                      {/* Cliente & Vendedor */}
                      <td className="py-4 px-6 align-middle">
                        <div className="font-black text-slate-900 text-sm leading-snug">
                          {os.clienteNome || 'Cliente Não Informado'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                          <span>{itemCount} item(ns)</span>
                          <span>•</span>
                          <span className="text-slate-600 font-semibold">
                            Vendedor: {os.vendedorNome || os.operador || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Etapa Atual na Produção */}
                      <td className="py-4 px-6 align-middle">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${getStageBadge(
                              os.estagioAtual
                            )}`}
                          >
                            <Layers className="w-3.5 h-3.5 shrink-0" />
                            {os.estagioAtual || 'Produção'}
                          </span>
                          {isAtExpedicaoStage ? (
                            <span className="text-[10px] font-black text-blue-700 uppercase tracking-wide">
                              ★ Pronto para Despacho
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400">
                              Em acompanhamento
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Conferência Status */}
                      <td className="py-4 px-6 align-middle">
                        {isConferida ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            Conferida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            Pendente
                          </span>
                        )}
                      </td>

                      {/* Tipo Envio & Destino */}
                      <td className="py-4 px-6 align-middle">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-black border uppercase tracking-wide ${
                              os.tipoExpedicao === 'EXPRESSO EXCURSÃO'
                                ? 'bg-red-100 text-red-900 border-red-300'
                                : os.tipoExpedicao === 'EXPRESSO DO DIA'
                                ? 'bg-orange-100 text-orange-950 border-orange-300'
                                : 'bg-blue-100 text-blue-900 border-blue-300'
                            }`}
                          >
                            {os.tipoExpedicao || 'NORMAL'}
                          </span>

                          {(os as any).destinoExpedicao && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {(os as any).destinoExpedicao}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Prazo */}
                      <td className="py-4 px-6 align-middle">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatPrazoDisplay(os.prazoEntrega)}</span>
                        </div>
                      </td>

                      {/* Ação */}
                      <td className="py-4 px-6 align-middle text-right">
                        {os.entregue ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-600 text-white shadow-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Entregue
                            </span>
                            <button
                              onClick={() => setReturnModalOs(os)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                              title="Registrar Devolução"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : os.devolvido ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-600 text-white shadow-xs">
                              <RotateCcw className="w-3.5 h-3.5" />
                              Devolvida
                            </span>
                            <button
                              onClick={() => setDeliveryModalOs(os)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                              title="Registrar Entrega"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : isExpedida ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                              Expedida
                            </span>
                            <button
                              onClick={() => setDeliveryModalOs(os)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer"
                              title="Definir OS como Entregue (nome de quem recebeu, telefone e CPF)"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Entregar</span>
                            </button>
                            <button
                              onClick={() => setReturnModalOs(os)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Registrar devolução / não entregue"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenDispatchModal(os)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Ver ou atualizar dados de envio"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        ) : isAtExpedicaoStage ? (
                          <button
                            onClick={() => handleOpenDispatchModal(os)}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-500/20 ml-auto cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            Expedir Agora
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenDispatchModal(os)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all ml-auto cursor-pointer"
                          >
                            <MapPin className="w-3 h-3 text-slate-500" />
                            Definir Destino
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dispatch Modal */}
      {selectedOs && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Controle de Envio da OS
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-black font-mono text-blue-700">
                      {selectedOs.codigo}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-bold text-slate-600">
                      {selectedOs.clienteNome}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedOs(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Current Stage Info */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    Etapa Atual na Fábrica
                  </div>
                  <div className="font-black text-slate-900 mt-0.5">
                    {selectedOs.estagioAtual || 'Produção'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    Auditoria de Conferência
                  </div>
                  <div className="mt-0.5 font-bold">
                    {selectedOs.conferido ? (
                      <span className="text-emerald-700 font-black">✓ Aprovada na Conferência</span>
                    ) : (
                      <span className="text-amber-700 font-bold">⏳ Pendente de Conferência</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Destination Radio Cards */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" /> Selecione o Destino de Envio
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DESTINATIONS.map((dest) => (
                    <label
                      key={dest}
                      className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        dispatchDestination === dest
                          ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="destination"
                        value={dest}
                        checked={dispatchDestination === dest}
                        onChange={(e) => setDispatchDestination(e.target.value)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 mr-2.5"
                      />
                      <span
                        className={`text-xs font-black ${
                          dispatchDestination === dest ? 'text-blue-900' : 'text-slate-700'
                        }`}
                      >
                        {dest}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Rastreio / Quem Retirou */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Código de Rastreio / Transportadora / Nome de quem retirou
                </label>
                <input
                  type="text"
                  value={trackingOrRecipient}
                  onChange={(e) => setTrackingOrRecipient(e.target.value)}
                  placeholder="Ex: BR123456789, Jadlog, João da Silva (motorista)..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition font-semibold"
                />
              </div>

              {/* Observações de Envio */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Observações da Expedição (Opcional)
                </label>
                <textarea
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="Instruções de entrega, horário combinado, volume de caixas..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition min-h-[70px]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-0 flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedOs(null)}
                disabled={isDispatching}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDispatchOs}
                disabled={!dispatchDestination || isDispatching}
                className="flex-[2] px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black transition shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDispatching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando Envio...
                  </>
                ) : (
                  <>
                    {selectedOs.estagioAtual === 'Expedição' ? 'Confirmar Expedição' : 'Definir Destino de Envio'}
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Entrega */}
      {deliveryModalOs && (
        <DeliveryModal
          os={deliveryModalOs}
          isOpen={Boolean(deliveryModalOs)}
          onClose={() => setDeliveryModalOs(null)}
          onSuccess={() => {
            loadData(true);
            setSuccessToast(`OS ${deliveryModalOs.codigo} definida como entregue com sucesso!`);
            setTimeout(() => setSuccessToast(null), 4000);
          }}
        />
      )}

      {/* Modal de Devolução */}
      {returnModalOs && (
        <ReturnModal
          os={returnModalOs}
          isOpen={Boolean(returnModalOs)}
          onClose={() => setReturnModalOs(null)}
          onSuccess={() => {
            loadData(true);
            setSuccessToast(`Devolução da OS ${returnModalOs.codigo} registrada com sucesso!`);
            setTimeout(() => setSuccessToast(null), 4000);
          }}
        />
      )}
    </div>
  );
};
