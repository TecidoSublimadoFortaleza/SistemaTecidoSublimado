import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  Clock,
  Sun,
  Moon,
  Factory,
  Palette,
  Printer,
  Flame,
  Scissors,
  Box,
  ShoppingBag,
  Truck,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Filter,
  Package,
  Store,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { ApiService } from '../../services/api';
import { OrdemServico } from '../../server/types/os';
import { UserProfile } from '../../types/frontend';

interface TvProducaoDashboardViewProps {
  user?: UserProfile | null;
  isSidebarExpanded?: boolean;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.'];

export interface SectorMeta {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  headerBgLight: string;
  headerBgDark: string;
  badgeClass: string;
  pillBg: string;
}

// LINHA 1: ETAPAS DE PRODUÇÃO / FABRICAÇÃO (4 COLUNAS)
export const ROW_1_SECTORS_CONFIG: SectorMeta[] = [
  {
    key: 'DESIGNER',
    label: 'DESIGNER',
    icon: Palette,
    colorClass: 'text-purple-600',
    headerBgLight: 'bg-purple-100/90 text-purple-950 border-purple-200',
    headerBgDark: 'bg-purple-950/70 text-purple-200 border-purple-900',
    badgeClass: 'bg-purple-600 text-white',
    pillBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  },
  {
    key: 'IMPRESSÃO',
    label: 'IMPRESSÃO',
    icon: Printer,
    colorClass: 'text-blue-600',
    headerBgLight: 'bg-blue-100/90 text-blue-950 border-blue-200',
    headerBgDark: 'bg-blue-950/70 text-blue-200 border-blue-900',
    badgeClass: 'bg-blue-600 text-white',
    pillBg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  },
  {
    key: 'CALANDRA',
    label: 'CALANDRA',
    icon: Flame,
    colorClass: 'text-orange-500',
    headerBgLight: 'bg-orange-100/90 text-orange-950 border-orange-200',
    headerBgDark: 'bg-orange-950/70 text-orange-200 border-orange-900',
    badgeClass: 'bg-orange-500 text-white',
    pillBg: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
  },
  {
    key: 'COSTURA',
    label: 'COSTURA',
    icon: Scissors,
    colorClass: 'text-rose-600',
    headerBgLight: 'bg-rose-100/90 text-rose-950 border-rose-200',
    headerBgDark: 'bg-rose-950/70 text-rose-200 border-rose-900',
    badgeClass: 'bg-rose-600 text-white',
    pillBg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  },
];

// LINHA 2: EXPEDIÇÃO E DESTINOS (4 COLUNAS)
export const ROW_2_SECTORS_CONFIG: SectorMeta[] = [
  {
    key: 'EXCURSÃO',
    label: 'EXCURSÃO',
    icon: Truck,
    colorClass: 'text-red-600',
    headerBgLight: 'bg-red-100/90 text-red-950 border-red-200',
    headerBgDark: 'bg-red-950/70 text-red-200 border-red-900',
    badgeClass: 'bg-red-600 text-white',
    pillBg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
  },
  {
    key: 'CORREIOS',
    label: 'CORREIOS',
    icon: Package,
    colorClass: 'text-amber-600',
    headerBgLight: 'bg-amber-100/90 text-amber-950 border-amber-200',
    headerBgDark: 'bg-amber-950/70 text-amber-200 border-amber-900',
    badgeClass: 'bg-amber-600 text-white',
    pillBg: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  },
  {
    key: 'SHOPEE',
    label: 'SHOPEE',
    icon: ShoppingBag,
    colorClass: 'text-orange-600',
    headerBgLight: 'bg-orange-100/90 text-orange-950 border-orange-200',
    headerBgDark: 'bg-orange-950/70 text-orange-200 border-orange-900',
    badgeClass: 'bg-orange-600 text-white',
    pillBg: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
  },
  {
    key: 'RETIRADA(Recepção)',
    label: 'RETIRADA(Recepção)',
    icon: Store,
    colorClass: 'text-emerald-600',
    headerBgLight: 'bg-emerald-100/90 text-emerald-950 border-emerald-200',
    headerBgDark: 'bg-emerald-950/70 text-emerald-200 border-emerald-900',
    badgeClass: 'bg-emerald-600 text-white',
    pillBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
];

export const SECTORS_CONFIG: SectorMeta[] = [
  ...ROW_1_SECTORS_CONFIG,
  ...ROW_2_SECTORS_CONFIG,
];

export const TvProducaoDashboardView: React.FC<TvProducaoDashboardViewProps> = ({
  isSidebarExpanded = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Estados principais - Padrão é Modo Claro ('light') com fundo cinza suave
  const [osList, setOsList] = useState<OrdemServico[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [tvTheme, setTvTheme] = useState<'dark' | 'light'>('light');
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('TODOS');

  // Relógio digital ao vivo
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Busca dados de ordens de serviço
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const orders = await ApiService.getOrdensServico().catch(() => []);
      setOsList(Array.isArray(orders) ? orders : []);
    } catch (err) {
      console.warn('Erro ao carregar dados do Dashboard de Produção:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Ouvinte em tempo real para novas vendas ou atualizações no sistema
  useEffect(() => {
    const handleOsChanged = () => {
      fetchData();
    };
    window.addEventListener('os-changed', handleOsChanged);
    return () => window.removeEventListener('os-changed', handleOsChanged);
  }, []);

  // Ciclo regressivo de atualização automática (15s)
  useEffect(() => {
    const countdownTimer = setInterval(() => {
      setAutoRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchData();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, []);

  // Manipulador de tela cheia
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch((err) => {
          console.warn('Fullscreen request failed:', err);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Exit fullscreen failed:', err);
        });
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Formata número da OS com 8 dígitos (ex: OS 00000002)
  const formatOsNumber = (rawNum?: string | number) => {
    if (!rawNum) return 'OS 00000000';
    const str = String(rawNum).replace(/\D/g, '');
    if (!str) {
      return String(rawNum).toUpperCase().startsWith('OS') ? String(rawNum).toUpperCase() : `OS ${rawNum}`;
    }
    return `OS ${str.padStart(8, '0')}`;
  };

  // Helper para formatar vendedor
  const formatVendedor = (os: OrdemServico): string => {
    const raw = (os as any).vendedorNome || (os as any).vendedor || os.operador || (os as any).operadorNome || '';
    if (!raw) return 'VEND. PADRÃO';
    const clean = String(raw).trim().toUpperCase();
    return clean;
  };

  // Helper para formatação de data
  const formatDateSimple = (dtStr?: string | Date): string => {
    if (!dtStr) return '—';
    try {
      const dt = new Date(dtStr);
      if (isNaN(dt.getTime())) return '—';
      const d = String(dt.getDate()).padStart(2, '0');
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const h = String(dt.getHours()).padStart(2, '0');
      const min = String(dt.getMinutes()).padStart(2, '0');
      return `${d}/${m} ${h}:${min}`;
    } catch {
      return '—';
    }
  };

  // Mês e ano vigentes para cabeçalho
  const currentMonthIdx = currentTime.getMonth();
  const currentMonthName = MONTH_NAMES[currentMonthIdx];
  const currentYear = currentTime.getFullYear();
  const currentWeekday = WEEKDAY_NAMES[currentTime.getDay()];
  const currentDay = String(currentTime.getDate()).padStart(2, '0');
  const monthAbbr = currentMonthName.substring(0, 3).toUpperCase();

  // Mapeamento e agrupamento das ordens de serviço por setor de produção
  const { osBySector, totalActiveOs, totalCompletedToday } = useMemo(() => {
    const sectors: Record<string, OrdemServico[]> = {
      'DESIGNER': [],
      'IMPRESSÃO': [],
      'CALANDRA': [],
      'COSTURA': [],
      'EXCURSÃO': [],
      'CORREIOS': [],
      'SHOPEE': [],
      'RETIRADA(Recepção)': [],
    };

    let activeCount = 0;
    let doneTodayCount = 0;
    const todayStr = new Date().toDateString();

    osList.forEach((os) => {
      // Desconsidera orçamentos puros
      if ((os as any).isOrcamento || (os as any).tipoDocumento === 'ORCAMENTO' || os.codigo?.startsWith('ORC')) {
        return;
      }
      const cod = (os.codigo || '').toUpperCase();
      if (cod.startsWith('VND') || cod.startsWith('PDV')) {
        return;
      }
      const stage = (os.estagioAtual || '').toLowerCase().trim();
      const status = (os.status || '').toLowerCase().trim();

      // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
      // Enquanto a OS estiver em "Aguardando Entrada no Fluxo de Produção" (estágio "Sistema"),
      // ela NÃO DEVE ser exibida no Dashboard de Produção.
      if (
        stage === 'sistema' ||
        stage === 'aguardando entrada no fluxo de produção' ||
        stage === 'aguardando entrada'
      ) {
        return;
      }

      // Desconsidera cancelados
      if (status === 'cancelado' || status === 'cancelada' || (os as any).deletedAt) return;

      const isDone = status === 'pronto' || status === 'concluida' || status === 'concluido' || status === 'entregue';
      if (isDone) {
        const updateDate = os.updatedAt ? new Date(os.updatedAt).toDateString() : '';
        if (updateDate === todayStr) {
          doneTodayCount += 1;
        }
      }

      const obs = (os.observacoes || '').toLowerCase();
      const destino = String((os as any).destinoExpedicao || (os as any).destino || '').toLowerCase();
      const canal = String((os as any).canal || (os as any).canalVenda || (os as any).origem || '').toLowerCase();
      const cliente = String(os.clienteNome || (os as any).cliente || '').toLowerCase();
      const tipoExp = String(os.tipoExpedicao || '').toLowerCase();
      const historicoStr = (os.historicoEdicoes || []).map(h => `${h.acao} ${h.detalhes || ''}`).join(' ').toLowerCase();

      // Identifica se é do canal ou destino Shopee
      const isShopeeOrder =
        stage.includes('shopee') ||
        destino.includes('shopee') ||
        canal.includes('shopee') ||
        cliente.includes('shopee') ||
        tipoExp.includes('shopee') ||
        obs.includes('shopee') ||
        historicoStr.includes('shopee');

      activeCount += 1;

      // 1. Etapas de Fabricação Ativa (Linha 1)
      if (stage.includes('design') || stage.includes('arte')) {
        sectors['DESIGNER'].push(os);
      } else if (stage.includes('impress') || stage.includes('print')) {
        sectors['IMPRESSÃO'].push(os);
      } else if (stage.includes('calandra') || stage.includes('prensa')) {
        sectors['CALANDRA'].push(os);
      } else if (stage.includes('costura') || stage.includes('acabamento')) {
        sectors['COSTURA'].push(os);
      }
      // 2. Destinos de Expedição & Entrega (Linha 2)
      // REGRA DE OURO: Quando o destino de envio foi explicitamente definido (destinoExpedicao / destino),
      // ele tem PREVALÊNCIA ABSOLUTA sobre qualquer outro campo!
      else if (destino.includes('shopee')) {
        sectors['SHOPEE'].push(os);
      } else if (destino.includes('correio')) {
        sectors['CORREIOS'].push(os);
      } else if (destino.includes('excurs')) {
        sectors['EXCURSÃO'].push(os);
      } else if (destino.includes('retirada') || destino.includes('recep')) {
        sectors['RETIRADA(Recepção)'].push(os);
      }
      // Casos em que o destino de envio ainda NÃO foi explicitamente selecionado pelo operador:
      else if (stage.includes('shopee') || isShopeeOrder) {
        sectors['SHOPEE'].push(os);
      } else if (stage.includes('correio') || tipoExp.includes('correio') || canal.includes('correio')) {
        sectors['CORREIOS'].push(os);
      } else if (stage.includes('excurs') || tipoExp.includes('excurs')) {
        sectors['EXCURSÃO'].push(os);
      } else if (stage.includes('retirada') || stage.includes('recep')) {
        sectors['RETIRADA(Recepção)'].push(os);
      } else {
        // Se a OS já concluiu etapas de costura/está em expedição/conferência ou concluído e não tem canal específico,
        // o destino natural de balcão é RETIRADA(Recepção)
        if (
          stage.includes('confer') ||
          stage.includes('expedi') ||
          stage.includes('entreg') ||
          stage.includes('pronto') ||
          stage.includes('conclu') ||
          os.expedido
        ) {
          sectors['RETIRADA(Recepção)'].push(os);
        } else {
          // Padrão do fluxo inicial de fabricação: Designer
          sectors['DESIGNER'].push(os);
        }
      }
    });

    return {
      osBySector: sectors,
      totalActiveOs: activeCount,
      totalCompletedToday: doneTodayCount,
    };
  }, [osList]);

  // Setores exibidos de acordo com o filtro
  const displayedSectors = useMemo(() => {
    if (selectedSector === 'TODOS') return SECTORS_CONFIG;
    return SECTORS_CONFIG.filter((s) => s.key === selectedSector);
  }, [selectedSector]);

  // Renderizador individual de coluna de setor (compartilhado e padronizado)
  const renderSectorColumn = (sector: SectorMeta) => {
    const rawItems = osBySector[sector.key] || [];

    // Filtrar por termo de busca se houver
    const items = rawItems.filter((os) => {
      if (!searchQuery) return true;
      const term = searchQuery.toLowerCase();
      const osCode = String(os.codigo || (os as any).numero || (os as any).numeroOs || '').toLowerCase();
      const client = String(os.clienteNome || (os as any).cliente || '').toLowerCase();
      const seller = String(
        (os as any).vendedorNome || (os as any).vendedor || os.operador || ''
      ).toLowerCase();
      return osCode.includes(term) || client.includes(term) || seller.includes(term);
    });

    const SectorIcon = sector.icon;

    return (
      <div
        key={sector.key}
        className={`rounded-2xl border flex flex-col min-h-[380px] max-h-[500px] shadow-sm transition overflow-hidden ${
          tvTheme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
        }`}
      >
        {/* Header da Coluna do Setor */}
        <div
          className={`py-2.5 px-3 border-b flex items-center justify-between gap-1.5 transition ${
            tvTheme === 'dark' ? sector.headerBgDark : sector.headerBgLight
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <SectorIcon className="w-4 h-4 shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider truncate">
              {sector.label}
            </span>
          </div>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${sector.badgeClass}`}>
            {items.length} OS{items.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Lista Vertical de Ordens de Serviço (OS) */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center my-auto min-h-[160px]">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                  tvTheme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <SectorIcon className="w-5 h-5" />
              </div>
              <span className="text-xs italic font-medium text-slate-400">
                Nenhuma OS nesta etapa
              </span>
            </div>
          ) : (
            items.map((os) => {
              const osFormattedNumber = formatOsNumber(
                os.codigo || (os as any).numero || (os as any).numeroOs
              );
              const clientName = os.clienteNome || 'CLIENTE';
              const sellerName = formatVendedor(os);
              const createdDate = formatDateSimple(os.createdAt || (os as any).dataCriacao);
              const deliveryDate = (os as any).dataPrevisao || (os as any).dataEntrega;
              const itemsCount = os.itens?.length || 0;
              const isConferido = Boolean((os as any).conferido);
              const tipoExpedicao = os.tipoExpedicao;

              return (
                <div
                  key={os.id}
                  className={`rounded-xl p-2.5 border transition-all duration-200 shadow-xs hover:shadow-md ${
                    tvTheme === 'dark'
                      ? 'bg-slate-800/90 border-slate-700/80 hover:border-indigo-500/80'
                      : 'bg-white border-slate-200 hover:border-indigo-400'
                  }`}
                >
                  {/* Linha 1: Número da OS em destaque e Vendedor */}
                  <div className="flex items-center justify-between gap-1 text-xs">
                    <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight text-[12px]">
                      {osFormattedNumber}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold truncate max-w-[110px] ${
                        tvTheme === 'dark' ? 'text-sky-400' : 'text-sky-700'
                      }`}
                      title={`Vendedor: ${sellerName}`}
                    >
                      {sellerName}
                    </span>
                  </div>

                  {/* Linha 2: Nome do Cliente em caixa alta e negrito */}
                  <div
                    className={`text-xs font-black uppercase mt-1 truncate ${
                      tvTheme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}
                    title={clientName}
                  >
                    {clientName}
                  </div>

                  {/* Tags de Modalidade / Expedição / Conferência */}
                  {(tipoExpedicao || isConferido || (os as any).destinoExpedicao || (os as any).destino) && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {((os as any).destinoExpedicao || (os as any).destino) && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 dark:bg-blue-950/90 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1 max-w-full truncate shadow-2xs">
                          <Truck className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="truncate">Destino: {(os as any).destinoExpedicao || (os as any).destino}</span>
                        </span>
                      )}
                      {tipoExpedicao === 'EXPRESSO EXCURSÃO' && (!((os as any).destinoExpedicao || (os as any).destino) || String((os as any).destinoExpedicao || (os as any).destino).toLowerCase().includes('excurs')) && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-red-600 text-white tracking-wider">
                          EXPRESSO EXCURSÃO
                        </span>
                      )}
                      {tipoExpedicao === 'EXPRESSO DO DIA' && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white tracking-wider">
                          EXPRESSO DO DIA
                        </span>
                      )}
                      {isConferido && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Conferida
                        </span>
                      )}
                    </div>
                  )}

                  {/* Linha 3: Detalhes operacionais (Data de criação e quantidade de itens) */}
                  <div className="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-700/60 text-[10px]">
                    <div
                      className={`flex items-center gap-1 font-semibold ${
                        tvTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{createdDate}</span>
                    </div>

                    {itemsCount > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold ${
                          tvTheme === 'dark'
                            ? 'bg-slate-700/70 text-slate-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {itemsCount} {itemsCount === 1 ? 'item' : 'itens'}
                      </span>
                    )}
                  </div>

                  {/* Linha 4: Previsão de Entrega (se informada) */}
                  {deliveryDate && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Entrega: {formatDateSimple(deliveryDate)}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`min-h-screen transition-colors duration-300 font-sans select-none ${
        tvTheme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-900'
      } ${isFullscreen ? 'p-3' : 'p-3 md:p-5'}`}
    >
      {/* 1. HEADER DO DASHBOARD DE PRODUÇÃO */}
      <div
        className={`rounded-2xl border shadow-sm p-3 sm:p-3.5 xl:py-2.5 xl:px-4 mb-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 transition-colors ${
          tvTheme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
        }`}
      >
        {/* Identidade Visual */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Factory className="w-5 h-5 xl:w-6 xl:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
              <h1
                className={`text-sm sm:text-base xl:text-lg font-black tracking-tight uppercase whitespace-nowrap ${
                  tvTheme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}
              >
                DASHBOARD DE PRODUÇÃO
              </h1>
              <span className="text-indigo-600 font-black text-xs sm:text-sm xl:text-base whitespace-nowrap">
                • {currentMonthName} / {currentYear}
              </span>
            </div>
            <p className={`text-[10px] sm:text-xs font-semibold truncate sm:whitespace-normal ${tvTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              Fluxo Operacional em Lista com Números de Ordem de Serviço (OS)
            </p>
          </div>
        </div>

        {/* Badges de Resumo, Relógio, Auto-Sync e Botões de Controle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between xl:justify-end gap-2.5 w-full xl:w-auto shrink-0">
          {/* Subgrupo 1: Badges de Resumo (Em Produção & Concluídas Hoje) */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Badge: Em Produção */}
            <div
              className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold whitespace-nowrap ${
                tvTheme === 'dark' ? 'bg-slate-800/90 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Em Produção:</span>
              <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono text-xs sm:text-sm">
                {totalActiveOs}
              </span>
            </div>

            {/* Badge: Concluídas Hoje */}
            <div
              className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold whitespace-nowrap ${
                tvTheme === 'dark' ? 'bg-slate-800/90 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Concluídas Hoje:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-xs sm:text-sm">
                {totalCompletedToday}
              </span>
            </div>
          </div>

          {/* Subgrupo 2: Relógio, Auto-Sync e Botões de Controle */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 shrink-0">
            {/* Relógio Digital */}
            <div
              className={`px-2 sm:px-2.5 py-1 rounded-xl border flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                tvTheme === 'dark' ? 'bg-slate-800/90 border-slate-700' : 'bg-slate-50 border-slate-200/80'
              }`}
            >
              <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="flex flex-col">
                <span
                  className={`font-mono text-xs sm:text-sm font-black tracking-wider leading-tight ${
                    tvTheme === 'dark' ? 'text-white' : 'text-slate-800'
                  }`}
                >
                  {currentTime.toLocaleTimeString('pt-BR')}
                </span>
                <span
                  className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-tight leading-none ${
                    tvTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {currentWeekday}, {currentDay} DE {monthAbbr}.
                </span>
              </div>
            </div>

            {/* Auto-Sync */}
            <div
              className={`px-2 sm:px-2.5 py-1.5 rounded-xl border flex items-center gap-1 sm:gap-1.5 text-xs whitespace-nowrap ${
                tvTheme === 'dark' ? 'bg-slate-800/90 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200/80 text-slate-600'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">AUTO-SYNC</span>
              <span
                className={`font-black text-xs font-mono ${
                  tvTheme === 'dark' ? 'text-white' : 'text-slate-800'
                }`}
              >
                {autoRefreshCountdown}s
              </span>
            </div>

            {/* Tela Cheia */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer whitespace-nowrap active:scale-95 shrink-0"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 shrink-0" /> : <Maximize2 className="w-3.5 h-3.5 shrink-0" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
            </button>

            {/* Alternador de Tema */}
            <button
              type="button"
              onClick={() => setTvTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              className={`p-1.5 sm:p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                tvTheme === 'dark'
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="Alternar Modo Escuro/Claro"
            >
              {tvTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FILTRO POR SETOR E BUSCA RÁPIDA DE OS */}
      <div
        className={`rounded-2xl border shadow-sm p-3 mb-4 flex flex-wrap items-center justify-between gap-3 ${
          tvTheme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black uppercase text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtrar Setor:
          </span>
          <button
            onClick={() => setSelectedSector('TODOS')}
            className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition cursor-pointer ${
              selectedSector === 'TODOS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : tvTheme === 'dark'
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todos ({totalActiveOs})
          </button>
          {SECTORS_CONFIG.map((s) => {
            const count = osBySector[s.key]?.length || 0;
            const isSelected = selectedSector === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSelectedSector(s.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase transition flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? `${s.badgeClass} shadow-xs`
                    : tvTheme === 'dark'
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{s.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected
                      ? 'bg-black/20 text-white'
                      : tvTheme === 'dark'
                      ? 'bg-slate-700 text-slate-200'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Campo de Busca Rápida por OS ou Cliente */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por OS, cliente ou vendedor..."
            className={`w-full pl-9 pr-3 py-1.5 rounded-xl text-xs font-bold outline-none border transition ${
              tvTheme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500'
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-600'
            }`}
          />
        </div>
      </div>

      {/* 3. FLUXO DE PRODUÇÃO DIVIDIDO RIGOROSAMENTE EM COLUNAS DE 4 */}
      {selectedSector !== 'TODOS' ? (
        // Visualização filtrada de setor específico
        <div className="grid grid-cols-1 max-w-2xl mx-auto">
          {displayedSectors.map((sector) => renderSectorColumn(sector))}
        </div>
      ) : (
        // Visualização completa dividida em 2 linhas com 4 colunas cada
        <div className="space-y-4">
          {/* LINHA 1: DESIGNER | IMPRESSÃO | CALANDRA | COSTURA */}
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
              <h2
                className={`text-xs font-black uppercase tracking-wider ${
                  tvTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                1ª Linha: Etapas de Fabricação
              </h2>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  tvTheme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                }`}
              >
                4 Colunas
              </span>
              <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {ROW_1_SECTORS_CONFIG.map((sector) => renderSectorColumn(sector))}
            </div>
          </div>

          {/* LINHA 2: EXCURSÃO | CORREIOS | SHOPEE | RETIRADA(Recepção) */}
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2
                className={`text-xs font-black uppercase tracking-wider ${
                  tvTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                2ª Linha: Expedição e Entrega
              </h2>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  tvTheme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                }`}
              >
                4 Colunas
              </span>
              <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {ROW_2_SECTORS_CONFIG.map((sector) => renderSectorColumn(sector))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const DashboardProducaoView = TvProducaoDashboardView;
export default TvProducaoDashboardView;
