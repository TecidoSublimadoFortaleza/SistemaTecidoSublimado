import React, { useState, useEffect, useMemo } from 'react';
import {
  PackageCheck,
  Truck,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Store,
  Mail,
  ShoppingBag,
  User,
  Phone,
  FileText,
  Eye,
  RefreshCw,
  Plus,
  X,
  Calendar,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { OrdemServico } from '../../server/types/os';
import { ApiService } from '../../services/api';
import { DeliveryModal } from './DeliveryModal';
import { ReturnModal } from './ReturnModal';
import { OsDetailsModal } from '../os/OsDetailsModal';

interface EntregaDevolucaoModuleViewProps {
  userRole?: string;
}

export const EntregaDevolucaoModuleView: React.FC<EntregaDevolucaoModuleViewProps> = ({
  userRole,
}) => {
  const [osList, setOsList] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'todas' | 'entregues' | 'devolvidas' | 'aguardando'>('todas');
  const [destinationFilter, setDestinationFilter] = useState<string>('ALL');

  // Modals state
  const [deliveryModalOs, setDeliveryModalOs] = useState<OrdemServico | null>(null);
  const [returnModalOs, setReturnModalOs] = useState<OrdemServico | null>(null);
  const [detailsModalOs, setDetailsModalOs] = useState<OrdemServico | null>(null);
  const [reasonModalOs, setReasonModalOs] = useState<OrdemServico | null>(null);
  const [isManualSelectOpen, setIsManualSelectOpen] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await ApiService.getOrdensServico();
      if (Array.isArray(data)) {
        // Cláusula de proteção contra regressão:
        // Apenas ordens de serviço puras (ignora orçamentos e vendas rápidas)
        // e que não estejam no estágio inicial "Sistema"
        const validOs = data.filter((os) => {
          const cod = (os.codigo || '').toUpperCase();
          const isOrc =
            (os as any).tipoDocumento === 'ORCAMENTO' ||
            (os as any).isOrcamento ||
            cod.startsWith('ORC');
          const isSistema = (os.estagioAtual || 'Sistema').trim().toLowerCase() === 'sistema';
          const isCanceled = os.status === 'Cancelado';
          return !cod.startsWith('VND') && !cod.startsWith('PDV') && !isOrc && !isSistema && !isCanceled;
        });

        // Filtrar apenas OSs relevantes para Entrega & Devolução:
        // 1. OSs com entregue === true
        // 2. OSs com devolvido === true
        // 3. OSs expedidas / com destino de envio definido (RETIRADA, EXCURSÃO, CORREIOS, SHOPEE)
        const entregaOs = validOs.filter((os) => {
          if (os.entregue === true || os.devolvido === true) return true;
          if ((os as any).dataEntrega || (os as any).dataDevolucao) return true;
          if (os.expedido === true || (os as any).dataExpedicao) return true;
          const dest = String((os as any).destinoExpedicao || (os as any).destino || os.observacoes || '').toUpperCase();
          return dest.includes('SHOPEE') || dest.includes('CORREIO') || dest.includes('EXCURS') || dest.includes('RETIRADA') || dest.includes('RECEP');
        });

        setOsList(entregaOs);
      }
    } catch (err) {
      console.error('Erro ao buscar ordens de serviço para Entrega & Devolução:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 12000);

    const handleOsChanged = () => loadData(true);
    window.addEventListener('os-changed', handleOsChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('os-changed', handleOsChanged);
    };
  }, []);

  const getDestinationTag = (os: OrdemServico) => {
    const raw = String(
      (os as any).destinoExpedicao ||
      (os as any).destino ||
      os.observacoesExpedicao ||
      os.observacoes ||
      ''
    ).toUpperCase();

    if (raw.includes('SHOPEE')) {
      return { id: 'SHOPEE', label: 'SHOPEE', icon: ShoppingBag, color: 'text-orange-700 bg-orange-50 border-orange-200' };
    }
    if (raw.includes('CORREIO')) {
      return { id: 'CORREIOS', label: 'CORREIOS', icon: Mail, color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    if (raw.includes('EXCURS') || raw.includes('ESCURS')) {
      return { id: 'EXCURSÃO', label: 'EXCURSÃO', icon: Truck, color: 'text-red-700 bg-red-50 border-red-200' };
    }
    return { id: 'RETIRADA', label: 'RETIRADA (RECEPÇÃO)', icon: Store, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  };

  // KPIs
  const metrics = useMemo(() => {
    let entregues = 0;
    let devolvidos = 0;
    let aguardando = 0;
    let shopeeCount = 0;
    let correiosCount = 0;
    let excursaoCount = 0;
    let retiradaCount = 0;

    osList.forEach((os) => {
      if (os.devolvido === true) {
        devolvidos++;
      } else if (os.entregue === true) {
        entregues++;
      } else {
        aguardando++;
      }

      const dest = getDestinationTag(os).id;
      if (dest === 'SHOPEE') shopeeCount++;
      else if (dest === 'CORREIOS') correiosCount++;
      else if (dest === 'EXCURSÃO') excursaoCount++;
      else retiradaCount++;
    });

    return {
      total: osList.length,
      entregues,
      devolvidos,
      aguardando,
      shopeeCount,
      correiosCount,
      excursaoCount,
      retiradaCount,
    };
  }, [osList]);

  // Filtered List
  const filteredList = useMemo(() => {
    let list = [...osList];

    // Tab filter
    if (activeTab === 'entregues') {
      list = list.filter((os) => os.entregue === true && !os.devolvido);
    } else if (activeTab === 'devolvidas') {
      list = list.filter((os) => os.devolvido === true);
    } else if (activeTab === 'aguardando') {
      list = list.filter((os) => !os.entregue && !os.devolvido);
    }

    // Destination filter
    if (destinationFilter !== 'ALL') {
      list = list.filter((os) => {
        const d = getDestinationTag(os).id;
        return d === destinationFilter;
      });
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((os) => {
        return (
          (os.codigo || '').toLowerCase().includes(term) ||
          (os.clienteNome || '').toLowerCase().includes(term) ||
          (os.clienteTelefone || '').includes(term) ||
          (os.clienteCpfCnpj || '').includes(term) ||
          (os.recebidoPorNome || '').toLowerCase().includes(term) ||
          (os.recebidoPorTelefone || '').includes(term) ||
          (os.recebidoPorCpf || '').includes(term) ||
          (os.motivoDevolucao || '').toLowerCase().includes(term)
        );
      });
    }

    // Sort: Devolvidas first, then by dataEntrega / dataDevolucao / updatedAt desc
    return list.sort((a, b) => {
      if (a.devolvido && !b.devolvido) return -1;
      if (!a.devolvido && b.devolvido) return 1;
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });
  }, [osList, activeTab, destinationFilter, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 space-y-6">
      {/* HEADER */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-500/10">
            <PackageCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                Entrega & Devolução
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                {metrics.total} Serviços Registrados
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Controle de recebimento de mercadorias entregues, coletas na recepção e gestão de devoluções.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData()}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsManualSelectOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Entrega de OS</span>
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entregues */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
              ORDENS ENTREGUES
            </span>
            <span className="text-3xl font-black text-emerald-600 mt-1 block">
              {metrics.entregues}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">Mercadorias recebidas pelo cliente</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Devolvidos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
              ORDENS DEVOLVIDAS
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-3xl font-black text-rose-600">
                {metrics.devolvidos}
              </span>
              {metrics.devolvidos > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 animate-pulse">
                  Requer Atenção
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-bold">Serviços com ocorrência de entrega</span>
          </div>
          <div className="p-3 bg-rose-50 rounded-full text-rose-600 border border-rose-100">
            <RotateCcw className="w-6 h-6" />
          </div>
        </div>

        {/* Aguardando Entrega */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
              PENDENTES DE ENTREGA
            </span>
            <span className="text-3xl font-black text-amber-500 mt-1 block">
              {metrics.aguardando}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">Aguardando confirmação de entrega</span>
          </div>
          <div className="p-3 bg-amber-50 rounded-full text-amber-500 border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Canais de Envio */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1">
            POR DESTINO DE ENVIO
          </span>
          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-extrabold">
            <span className="px-2 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-100 flex items-center justify-between">
              <span>Retirada:</span>
              <strong className="font-black text-xs">{metrics.retiradaCount}</strong>
            </span>
            <span className="px-2 py-1 bg-red-50 text-red-800 rounded-lg border border-red-100 flex items-center justify-between">
              <span>Excursão:</span>
              <strong className="font-black text-xs">{metrics.excursaoCount}</strong>
            </span>
            <span className="px-2 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-100 flex items-center justify-between">
              <span>Correios:</span>
              <strong className="font-black text-xs">{metrics.correiosCount}</strong>
            </span>
            <span className="px-2 py-1 bg-orange-50 text-orange-800 rounded-lg border border-orange-100 flex items-center justify-between">
              <span>Shopee:</span>
              <strong className="font-black text-xs">{metrics.shopeeCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* FILTROS E BUSCA */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setActiveTab('todas')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer whitespace-nowrap ${
                activeTab === 'todas'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Todas ({metrics.total})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('entregues')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'entregues'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Entregues ({metrics.entregues})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('devolvidas')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'devolvidas'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Devoluções / Não Entregues ({metrics.devolvidos})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('aguardando')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'aguardando'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pendentes de Entrega ({metrics.aguardando})</span>
            </button>
          </div>

          {/* Destino Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Destino:</span>
            <select
              value={destinationFilter}
              onChange={(e) => setDestinationFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Todos os Destinos</option>
              <option value="RETIRADA">RETIRADA (RECEPÇÃO)</option>
              <option value="EXCURSÃO">EXCURSÃO</option>
              <option value="CORREIOS">CORREIOS</option>
              <option value="SHOPEE">SHOPEE</option>
            </select>
          </div>
        </div>

        {/* Input de Busca */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por número da OS, cliente, responsável pela entrega ou documento..."
            className="w-full pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
          />
        </div>
      </div>

      {/* LISTAGEM DE ENTREGAS & DEVOLUÇÕES (TABELA ESTRUTURADA) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-500">Carregando ordens de serviço...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center">
            <PackageCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-black text-slate-700 uppercase">Nenhum registro encontrado</h3>
            <p className="text-xs text-slate-400 mt-1">
              Não há ordens de serviço correspondentes aos filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-4 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider w-[120px]">
                    OS
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider w-[130px]">
                    STATUS
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider min-w-[190px]">
                    CLIENTE
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider w-[140px]">
                    DESTINO
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider min-w-[240px]">
                    DADOS DA ENTREGA / RECEBIMENTO
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right min-w-[280px]">
                    AÇÕES
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((os) => {
                  const dest = getDestinationTag(os);
                  const DestIcon = dest.icon;
                  const isDevolvido = Boolean(os.devolvido);
                  const isEntregue = Boolean(os.entregue);

                  return (
                    <tr
                      key={os.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isDevolvido
                          ? 'bg-rose-50/30'
                          : isEntregue
                          ? 'bg-emerald-50/20'
                          : ''
                      }`}
                    >
                      {/* OS */}
                      <td className="px-4 py-3.5 align-middle">
                        <span className="px-3 py-1 bg-slate-900 text-white font-mono font-black text-xs rounded-xl shadow-xs inline-block">
                          {os.codigo}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-4 py-3.5 align-middle">
                        {isDevolvido ? (
                          <span className="px-2.5 py-1 bg-rose-600 text-white text-[11px] font-black rounded-lg uppercase inline-flex items-center gap-1.5 shadow-xs animate-pulse">
                            <RotateCcw className="w-3 h-3" />
                            <span>Devolvido</span>
                          </span>
                        ) : isEntregue ? (
                          <span className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-black rounded-lg uppercase inline-flex items-center gap-1.5 shadow-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Entregue</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-500 text-white text-[11px] font-black rounded-lg uppercase inline-flex items-center gap-1.5 shadow-xs">
                            <Clock className="w-3 h-3" />
                            <span>Aguardando</span>
                          </span>
                        )}
                      </td>

                      {/* CLIENTE */}
                      <td className="px-4 py-3.5 align-middle">
                        <div>
                          <span className="font-black text-slate-900 text-xs block">
                            {os.clienteNome || 'Cliente não informado'}
                          </span>
                          {os.clienteTelefone && (
                            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{os.clienteTelefone}</span>
                            </span>
                          )}
                          {os.clienteCpfCnpj && (
                            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                              {os.clienteCpfCnpj}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* DESTINO */}
                      <td className="px-4 py-3.5 align-middle">
                        <div
                          className={`px-2.5 py-1 rounded-lg border font-black text-[10.5px] uppercase inline-flex items-center gap-1.5 ${dest.color}`}
                        >
                          <DestIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{dest.label}</span>
                        </div>
                      </td>

                      {/* DADOS DE ENTREGA / RECEBIMENTO */}
                      <td className="px-4 py-3.5 align-middle text-xs">
                        {isEntregue ? (
                          <div className="space-y-0.5">
                            <span className="font-black text-emerald-800 text-xs flex items-center gap-1">
                              <User className="w-3 h-3 text-emerald-600" />
                              <span>Recebido por: {os.recebidoPorNome || 'Nome não informado'}</span>
                            </span>
                            <div className="flex items-center gap-2 text-[10.5px] text-slate-600 font-semibold">
                              {os.recebidoPorTelefone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-2.5 h-2.5 text-slate-400" />
                                  <span>{os.recebidoPorTelefone}</span>
                                </span>
                              )}
                              {os.recebidoPorCpf && <span>CPF: {os.recebidoPorCpf}</span>}
                            </div>
                            {os.dataEntrega && (
                              <span className="text-[10px] text-slate-400 font-bold block flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                Entregue em: {os.dataEntrega}
                              </span>
                            )}
                            {os.entreguePorNome && (
                              <span className="text-[10px] text-slate-500 font-medium block">
                                Entregue por: {os.entreguePorNome}
                              </span>
                            )}
                          </div>
                        ) : isDevolvido ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-rose-700 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>Motivo: {os.motivoDevolucao || 'Ocorrência registrada'}</span>
                            </span>
                            {os.dataDevolucao && (
                              <span className="text-[10.5px] text-slate-500 font-semibold block">
                                Devolução em: {os.dataDevolucao}
                              </span>
                            )}
                            {os.devolvidoPor && (
                              <span className="text-[10px] text-slate-400 font-medium block">
                                Registrado por: {os.devolvidoPor}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">
                            Aguardando confirmação de entrega pelo operador.
                          </span>
                        )}
                      </td>

                      {/* AÇÕES */}
                      <td className="px-4 py-3.5 align-middle text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Se devolvido, botão para ver a ocorrência */}
                          {isDevolvido && (
                            <button
                              type="button"
                              onClick={() => setReasonModalOs(os)}
                              className="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer border border-rose-300"
                              title="Ver ocorrência de devolução"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                              <span>Ocorrência</span>
                            </button>
                          )}

                          {/* Botão Registrar/Editar Entrega */}
                          <button
                            type="button"
                            onClick={() => setDeliveryModalOs(os)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                            title="Registrar ou atualizar entrega"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>{isEntregue ? 'Editar Entrega' : 'Registrar Entrega'}</span>
                          </button>

                          {/* Botão Devolução / Não Entregue */}
                          <button
                            type="button"
                            onClick={() => setReturnModalOs(os)}
                            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 active:scale-95 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            title="Marcar como devolvido ou não entregue"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{isDevolvido ? 'Atualizar Devolução' : 'Devolução / Não Entregue'}</span>
                          </button>

                          {/* Detalhes da OS */}
                          <button
                            type="button"
                            onClick={() => setDetailsModalOs(os)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                            title="Ver OS Completa"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Linhas vazias decorativas para preenchimento de grade estilo ERP (quando há poucos itens) */}
                {filteredList.length < 5 &&
                  Array.from({ length: 5 - filteredList.length }).map((_, idx) => (
                    <tr key={`empty-row-${idx}`} className="h-12 border-b border-slate-100/60">
                      <td colSpan={6} className="px-4 py-3">&nbsp;</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE ENTREGA */}
      {deliveryModalOs && (
        <DeliveryModal
          os={deliveryModalOs}
          isOpen={Boolean(deliveryModalOs)}
          onClose={() => setDeliveryModalOs(null)}
          onSuccess={() => loadData(true)}
        />
      )}

      {/* MODAL DE DEVOLUÇÃO */}
      {returnModalOs && (
        <ReturnModal
          os={returnModalOs}
          isOpen={Boolean(returnModalOs)}
          onClose={() => setReturnModalOs(null)}
          onSuccess={() => loadData(true)}
        />
      )}

      {/* MODAL CAIXA "O QUE ACONTECEU" (DETALHES DA DEVOLUÇÃO) */}
      {reasonModalOs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-rose-600 to-amber-700 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-black uppercase tracking-wide">
                  Ocorrência de Devolução - {reasonModalOs.codigo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReasonModalOs(null)}
                className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block">
                  O que aconteceu:
                </span>
                <p className="text-xs font-bold text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {reasonModalOs.motivoDevolucao || 'Nenhum motivo detalhado foi registrado.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[9.5px] font-black text-slate-400 uppercase block">Data do Registro</span>
                  <span className="font-extrabold text-slate-800">{reasonModalOs.dataDevolucao || 'Não informada'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[9.5px] font-black text-slate-400 uppercase block">Registrado Por</span>
                  <span className="font-extrabold text-slate-800">{reasonModalOs.devolvidoPor || 'Operador'}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const osTarget = reasonModalOs;
                    setReasonModalOs(null);
                    setReturnModalOs(osTarget);
                  }}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Editar Motivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReasonModalOs(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES DA OS */}
      {detailsModalOs && (
        <OsDetailsModal
          os={detailsModalOs}
          onClose={() => setDetailsModalOs(null)}
        />
      )}

      {/* MODAL SELETOR MANUAL DE OS PARA ENTREGA */}
      {isManualSelectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <PackageCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black uppercase tracking-wide">
                  Selecione uma Ordem de Serviço para Registrar Entrega
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsManualSelectOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              <p className="text-xs text-slate-500 font-medium mb-2">
                Clique na OS para abrir o formulário de entrega com os dados do recebedor:
              </p>
              {osList.map((os) => (
                <div
                  key={os.id}
                  onClick={() => {
                    setIsManualSelectOpen(false);
                    setDeliveryModalOs(os);
                  }}
                  className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-slate-900">{os.codigo}</span>
                      <span className="text-[11px] font-bold text-slate-600">{os.clienteNome}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase">
                      Destino: {(os as any).destinoExpedicao || (os as any).destino || 'Retirada'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-lg"
                  >
                    Selecionar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
