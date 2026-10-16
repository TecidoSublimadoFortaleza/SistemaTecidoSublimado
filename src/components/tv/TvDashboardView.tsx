import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Tv,
  Maximize2,
  Minimize2,
  RefreshCw,
  Clock,
  Sun,
  Moon,
  AlertCircle,
  Palette,
  Printer,
  Flame,
  Scissors,
  Truck,
  Package,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { ApiService } from '../../services/api';
import { OrdemServico } from '../../server/types/os';
import { UserProfile } from '../../types/frontend';

interface TvDashboardViewProps {
  user?: UserProfile | null;
}

// 8 ESTÁGIOS NA MESMA LINHA:
// DESIGNER | IMPRESSÃO | CALANDRA | COSTURA | EXCURSÃO | CORREIOS | SHOPEE | RETIRADA(Recepção)
export const SECTOR_KEYS = [
  'DESIGNER',
  'IMPRESSÃO',
  'CALANDRA',
  'COSTURA',
  'EXCURSÃO',
  'CORREIOS',
  'SHOPEE',
  'RETIRADA(Recepção)',
] as const;

export type SectorKey = typeof SECTOR_KEYS[number];

interface SectorMeta {
  key: SectorKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeBg: string;
  badgeText: string;
  codeColorLight: string;
  codeColorDark: string;
  accentBarColor: string;
}

const SECTORS_META: Record<SectorKey, SectorMeta> = {
  'DESIGNER': {
    key: 'DESIGNER',
    label: 'DESIGNER',
    icon: Palette,
    color: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-600',
    badgeText: 'text-white',
    codeColorLight: 'text-purple-700',
    codeColorDark: 'text-purple-400',
    accentBarColor: 'bg-purple-600',
  },
  'IMPRESSÃO': {
    key: 'IMPRESSÃO',
    label: 'IMPRESSÃO',
    icon: Printer,
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-600',
    badgeText: 'text-white',
    codeColorLight: 'text-blue-700',
    codeColorDark: 'text-blue-400',
    accentBarColor: 'bg-blue-600',
  },
  'CALANDRA': {
    key: 'CALANDRA',
    label: 'CALANDRA',
    icon: Flame,
    color: 'text-orange-500 dark:text-orange-400',
    badgeBg: 'bg-orange-500',
    badgeText: 'text-white',
    codeColorLight: 'text-orange-700',
    codeColorDark: 'text-orange-400',
    accentBarColor: 'bg-orange-500',
  },
  'COSTURA': {
    key: 'COSTURA',
    label: 'COSTURA',
    icon: Scissors,
    color: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-600',
    badgeText: 'text-white',
    codeColorLight: 'text-rose-700',
    codeColorDark: 'text-rose-400',
    accentBarColor: 'bg-rose-600',
  },
  'EXCURSÃO': {
    key: 'EXCURSÃO',
    label: 'EXCURSÃO',
    icon: Truck,
    color: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-600',
    badgeText: 'text-white',
    codeColorLight: 'text-red-700',
    codeColorDark: 'text-red-400',
    accentBarColor: 'bg-red-600',
  },
  'CORREIOS': {
    key: 'CORREIOS',
    label: 'CORREIOS',
    icon: Package,
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-600',
    badgeText: 'text-white',
    codeColorLight: 'text-amber-700',
    codeColorDark: 'text-amber-400',
    accentBarColor: 'bg-amber-600',
  },
  'SHOPEE': {
    key: 'SHOPEE',
    label: 'SHOPEE',
    icon: ShoppingBag,
    color: 'text-orange-600 dark:text-orange-400',
    badgeBg: 'bg-orange-600',
    badgeText: 'text-white',
    codeColorLight: 'text-orange-700',
    codeColorDark: 'text-orange-400',
    accentBarColor: 'bg-orange-600',
  },
  'RETIRADA(Recepção)': {
    key: 'RETIRADA(Recepção)',
    label: 'RETIRADA(Recepção)',
    icon: Store,
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    codeColorLight: 'text-emerald-700',
    codeColorDark: 'text-emerald-400',
    accentBarColor: 'bg-emerald-600',
  },
};

export const TvDashboardView: React.FC<TvDashboardViewProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // States
  const [osList, setOsList] = useState<OrdemServico[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [tvTheme, setTvTheme] = useState<'light' | 'dark'>('light');
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState<number>(20);

  // Live Clock (1 second interval)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Data function
  const fetchData = async () => {
    try {
      const osData = await ApiService.getOrdensServico().catch(() => []);
      if (Array.isArray(osData)) {
        setOsList(osData);
      }
      setAutoRefreshCountdown(20);
    } catch (err) {
      console.error('Erro ao carregar dados do Painel TV:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and auto-refresh loop (20s)
  useEffect(() => {
    fetchData();

    const countdownTimer = setInterval(() => {
      setAutoRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchData();
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, []);

  // Fullscreen toggle handler
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

  // Format OS Number with leading zeros (e.g. OS 00000100)
  const formatOsNumber = (rawNum?: string | number) => {
    if (!rawNum) return 'OS 00000000';
    const str = String(rawNum).replace(/\D/g, '');
    if (!str) {
      return String(rawNum).toUpperCase().startsWith('OS') ? String(rawNum).toUpperCase() : `OS ${rawNum}`;
    }
    return `OS ${str.padStart(8, '0')}`;
  };

  // Helper to extract clean seller name
  const extractSellerName = (os: OrdemServico): string => {
    const raw = (os as any).vendedorNome || (os as any).vendedor || os.operador || (os as any).operadorNome || (os as any).createdBy || '';
    if (!raw) return 'PADRÃO';
    return String(raw).trim().toUpperCase();
  };

  const formatDateOnly = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
      }
      return dateStr;
    } catch {
      return '';
    }
  };

  // =========================================================================
  // AGRUPAMENTO DOS 8 SETORES SEGUINDO A CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO
  // =========================================================================
  const { osBySector, totalActiveOs, totalAtrasadas } = useMemo(() => {
    const sectors: Record<SectorKey, OrdemServico[]> = {
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
    let lateCount = 0;
    const todayISO = new Date().toISOString().split('T')[0];

    osList.forEach((os) => {
      // Desconsidera orçamentos puros
      if ((os as any).isOrcamento || (os as any).tipoDocumento === 'ORCAMENTO' || os.codigo?.startsWith('ORC')) {
        return;
      }
      const cod = (os.codigo || '').toUpperCase();
      if (cod.startsWith('VND') || cod.startsWith('PDV')) {
        return;
      }

      const stage = (os.estagioAtual || (os as any).statusProcesso || '').toLowerCase().trim();
      const status = (os.status || '').toLowerCase().trim();

      // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
      // Enquanto a OS estiver em "Aguardando Entrada no Fluxo de Produção" (estágio "Sistema"),
      // ela NÃO DEVE ser exibida no fluxo de produção/expedição.
      if (
        stage === 'sistema' ||
        stage === 'aguardando entrada no fluxo de produção' ||
        stage === 'aguardando entrada'
      ) {
        return;
      }

      // Desconsidera cancelados ou deletados
      if (status === 'cancelado' || status === 'cancelada' || (os as any).deletedAt) {
        return;
      }

      // Checagem de atraso para pedidos no fluxo ativo
      if (
        os.prazoEntrega &&
        os.prazoEntrega < todayISO &&
        !status.includes('conclu') &&
        !status.includes('entreg') &&
        !status.includes('cancel')
      ) {
        lateCount++;
      }

      activeCount++;

      const obs = (os.observacoes || '').toLowerCase();
      const destino = String((os as any).destinoExpedicao || (os as any).destino || '').toLowerCase();
      const canal = String((os as any).canal || (os as any).canalVenda || (os as any).origem || '').toLowerCase();
      const cliente = String(os.clienteNome || (os as any).cliente || '').toLowerCase();
      const tipoExp = String(os.tipoExpedicao || '').toLowerCase();
      const historicoStr = (os.historicoEdicoes || []).map((h) => `${h.acao} ${h.detalhes || ''}`).join(' ').toLowerCase();

      // Identifica se é do canal ou destino Shopee
      const isShopeeOrder =
        stage.includes('shopee') ||
        destino.includes('shopee') ||
        canal.includes('shopee') ||
        cliente.includes('shopee') ||
        tipoExp.includes('shopee') ||
        obs.includes('shopee') ||
        historicoStr.includes('shopee');

      // 1. Etapas de Fabricação Ativa (DESIGNER, IMPRESSÃO, CALANDRA, COSTURA)
      if (stage.includes('design') || stage.includes('arte') || stage.includes('cria')) {
        sectors['DESIGNER'].push(os);
      } else if (stage.includes('impress') || stage.includes('print')) {
        sectors['IMPRESSÃO'].push(os);
      } else if (stage.includes('calandr') || stage.includes('prensa')) {
        sectors['CALANDRA'].push(os);
      } else if (stage.includes('costur') || stage.includes('acabamento')) {
        sectors['COSTURA'].push(os);
      }
      // 2. Destinos de Expedição & Entrega (EXCURSÃO, CORREIOS, SHOPEE, RETIRADA(Recepção))
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
        // Se a OS já concluiu etapas de costura / está em expedição, conferência, entrega ou concluído
        // e não tem canal específico, o destino natural de balcão é RETIRADA(Recepção)
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
      totalAtrasadas: lateCount,
    };
  }, [osList]);

  // Date Formatter
  const formattedDate = useMemo(() => {
    return currentTime.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }, [currentTime]);

  const formattedTime = useMemo(() => {
    return currentTime.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [currentTime]);

  const isDark = tvTheme === 'dark';
  const todayISO = new Date().toISOString().split('T')[0];

  return (
    <div
      ref={containerRef}
      id="tv-dashboard-module"
      className={`min-h-screen transition-colors duration-300 select-none ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
      } p-3 sm:p-4 flex flex-col gap-3 font-sans h-screen overflow-hidden`}
    >
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (Corporate TV Live Bar) */}
      {/* ========================================================================= */}
      <header
        id="tv-header-bar"
        className={`rounded-2xl px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3 border shrink-0 transition-colors ${
          isDark
            ? 'bg-slate-900/90 border-slate-800 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Left: Branding & Live indicator */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shrink-0">
            <Tv className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                PAINEL TV • FLUXO DE PRODUÇÃO E EXPEDIÇÃO
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                AO VIVO
              </span>
            </div>
            <p className={`text-[11px] capitalize font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              TECIDO SUBLIMADO • {formattedDate}
            </p>
          </div>
        </div>

        {/* Center: Live Digital Clock & Summary Stats */}
        <div className="flex items-center gap-3">
          <div
            id="tv-live-clock"
            className={`px-3 py-1 rounded-xl border flex items-center gap-2 font-mono text-lg sm:text-xl font-black tracking-widest transition-colors ${
              isDark
                ? 'bg-slate-950/60 border-slate-800 text-blue-400'
                : 'bg-slate-50 border-blue-200 text-blue-900'
            }`}
          >
            <Clock className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-900'} animate-pulse`} />
            <span>{formattedTime}</span>
          </div>

          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-2 ${
              isDark ? 'bg-slate-950/60 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <span>TOTAL NO FLUXO:</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-extrabold text-xs">
              {totalActiveOs} OS
            </span>
          </div>

          {totalAtrasadas > 0 && (
            <div className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300 text-xs font-black flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
              <span>{totalAtrasadas} ATRASADAS</span>
            </div>
          )}
        </div>

        {/* Right: Controls (Refresh, Theme, Fullscreen) */}
        <div className="flex items-center gap-2">
          {/* Refresh Timer & Manual button */}
          <button
            type="button"
            onClick={fetchData}
            title="Atualizar dados agora"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
            <span className="hidden md:inline">{autoRefreshCountdown}s</span>
          </button>

          {/* Theme switcher */}
          <button
            type="button"
            onClick={() => setTvTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            title={isDark ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro (TV)'}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Exibir em Tela Cheia'}
            className="px-3 py-1.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. OS 8 ESTÁGIOS NA MESMA LINHA:                                          */}
      {/* DESIGNER | IMPRESSÃO | CALANDRA | COSTURA | EXCURSÃO | CORREIOS | SHOPEE | RETIRADA(Recepção) */}
      {/* ========================================================================= */}
      <main
        id="tv-setores-fluxo"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5 flex-1 min-h-0"
      >
        {SECTOR_KEYS.map((sectorKey) => {
          const meta = SECTORS_META[sectorKey];
          const SectorIcon = meta.icon;
          const items = osBySector[sectorKey] || [];

          return (
            <div
              key={sectorKey}
              className={`rounded-2xl p-2.5 sm:p-3 border shadow-sm flex flex-col transition-colors h-full min-h-0 overflow-hidden ${
                isDark
                  ? 'bg-slate-900/95 border-slate-800 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Top Accent Bar */}
              <div className={`w-full h-1 rounded-full ${meta.accentBarColor} mb-2 shrink-0 opacity-90`} />

              {/* Column Header */}
              <div
                className={`flex items-center justify-between mb-2 pb-2 border-b shrink-0 ${
                  isDark ? 'border-slate-800' : 'border-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <SectorIcon className={`w-4 h-4 shrink-0 ${meta.color}`} />
                  <h3
                    className={`font-black text-[11px] sm:text-xs tracking-tight uppercase truncate ${
                      isDark ? 'text-slate-100' : 'text-slate-800'
                    }`}
                    title={sectorKey}
                  >
                    {sectorKey}
                  </h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-black shrink-0 shadow-2xs ${meta.badgeBg} ${meta.badgeText}`}
                >
                  {items.length}
                </span>
              </div>

              {/* Scrollable List of OS Cards */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar min-h-0">
                {items.length === 0 ? (
                  <div
                    className={`h-full min-h-[140px] flex flex-col items-center justify-center text-center p-3 rounded-xl border border-dashed ${
                      isDark
                        ? 'border-slate-800/80 text-slate-500 bg-slate-950/30'
                        : 'border-slate-200 text-slate-400 bg-slate-50/50'
                    }`}
                  >
                    <SectorIcon className="w-6 h-6 mb-1 opacity-30" />
                    <span className="text-[11px] font-semibold italic">
                      Nenhuma OS nesta etapa
                    </span>
                  </div>
                ) : (
                  items.map((os) => {
                    const clienteNome = (os.clienteNome || (os as any).cliente || 'CLIENTE').toUpperCase();
                    const vendNome = extractSellerName(os);
                    const osCode = formatOsNumber(os.codigo || os.id);
                    const isExpresso = Boolean((os.tipoExpedicao && os.tipoExpedicao.includes('EXPRESSO')) || (os as any).isExpresso);
                    const prazoFmt = formatDateOnly(os.prazoEntrega);
                    const isAtrasado = Boolean(os.prazoEntrega && os.prazoEntrega < todayISO && !os.status?.toLowerCase().includes('conclu'));

                    return (
                      <div
                        key={os.id}
                        className={`p-2 rounded-xl border shadow-2xs transition-all flex flex-col gap-1 ${
                          isDark
                            ? 'bg-slate-950/80 hover:bg-slate-950 border-slate-800/90 text-slate-200'
                            : 'bg-slate-50/90 hover:bg-slate-100/90 border-slate-200 text-slate-900'
                        } ${isAtrasado ? 'ring-1 ring-rose-500/40' : ''}`}
                      >
                        {/* OS Code & Tag / Prazo */}
                        <div className="flex items-center justify-between gap-1">
                          <span className={`font-black text-xs shrink-0 ${isDark ? meta.codeColorDark : meta.codeColorLight}`}>
                            {osCode}
                          </span>
                          {isExpresso ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-600 text-white animate-pulse shrink-0">
                              URGENTE
                            </span>
                          ) : isAtrasado ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0">
                              ATRASADO
                            </span>
                          ) : prazoFmt ? (
                            <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'} shrink-0`}>
                              {prazoFmt}
                            </span>
                          ) : null}
                        </div>

                        {/* Cliente */}
                        <div className="min-w-0">
                          <p
                            className={`font-extrabold text-xs leading-tight truncate ${
                              isDark ? 'text-slate-100' : 'text-slate-800'
                            }`}
                            title={clienteNome}
                          >
                            {clienteNome}
                          </p>
                        </div>

                        {/* Destino de Envio */}
                        {((os as any).destinoExpedicao || (os as any).destino) && (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 dark:bg-blue-950/90 dark:text-blue-300 border border-blue-200 dark:border-blue-800 truncate max-w-full shadow-2xs">
                              <Truck className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 shrink-0" />
                              <span className="truncate">Destino: {(os as any).destinoExpedicao || (os as any).destino}</span>
                            </span>
                          </div>
                        )}

                        {/* Vendedor & Peças */}
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px]">
                          <span
                            className={`font-black uppercase truncate ${
                              isDark ? 'text-blue-300' : 'text-blue-700'
                            }`}
                            title={`Vendedor: ${vendNome}`}
                          >
                            VEND. {vendNome}
                          </span>
                          {Number((os as any).quantidadeTotal || (os as any).pecasTotal || 0) > 0 && (
                            <span className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'} shrink-0`}>
                              {Number((os as any).quantidadeTotal || (os as any).pecasTotal)} pçs
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
};
