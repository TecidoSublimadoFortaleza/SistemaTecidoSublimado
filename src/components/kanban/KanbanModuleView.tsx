import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Kanban,
  CheckCircle2,
  Clock,
  User,
  AlertCircle,
  Search,
  RefreshCw,
  Eye,
  ArrowRight,
  ArrowLeft,
  Printer,
  Download,
  FileDown,
  FileText,
  MessageSquare,
  Paperclip,
  Palette,
  Scissors,
  Box,
  Truck,
  Flame,
  Check,
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign,
  Plus,
  Send,
  Bell,
  X,
  Layers,
  RotateCcw,
  Lock,
  ExternalLink,
  ShoppingBag,
  Mail,
  Store,
  PackageCheck,
} from 'lucide-react';
import { OrdemServico, ProductionStage, TipoExpedicao } from '../../server/types/os';
import { ApiService } from '../../services/api';
import { RoleTitle } from '../../types/frontend';
import { OsPrintableA4 } from '../os/OsPrintableA4';
import { canUserVoltarAcaoKanban, canUserPerformAction, normalizeRoleName, isRoleAuthorizedForSales } from '../../utils/userPermissions';
import { verifySuperiorPassword } from '../../utils/superiorAuth';
import { NotificationService } from '../../utils/notificationService';
import { DeliveryModal } from '../entregaDevolucao/DeliveryModal';
import { ReturnModal } from '../entregaDevolucao/ReturnModal';

interface KanbanModuleViewProps {
  user: {
    name: string;
    role: RoleTitle;
    isDeveloper?: boolean;
    sector?: string;
  };
  isSidebarExpanded?: boolean;
}

// 1ª LINHA: ETAPAS DE FABRICAÇÃO COM ACEITE (NA MESMA LINHA)
export const ROW_1_STAGES: ProductionStage[] = [
  'Designer',
  'Impressão',
  'Calandra',
  'Costura',
];

export const ROW_1_ACEITE_CONFIG: { stage: ProductionStage; label: string }[] = [
  { stage: 'Designer', label: 'DESIGNER' },
  { stage: 'Impressão', label: 'IMPRESSÃO' },
  { stage: 'Calandra', label: 'CALANDRA' },
  { stage: 'Costura', label: 'COSTURA' },
];

// 2ª LINHA: DESTINOS DE EXPEDIÇÃO CONFORME CONTROLE DE EXPEDIÇÃO (APENAS EXIBIÇÃO)
export type ExpedicaoDestId = 'EXCURSÃO' | 'CORREIOS' | 'SHOPEE' | 'RETIRADA(Recepção)';

export const ROW_2_EXIBICAO_COLUMNS: {
  id: ExpedicaoDestId;
  label: string;
  icon: any;
  style: { bg: string; border: string; text: string; badge: string };
}[] = [
  {
    id: 'EXCURSÃO',
    label: 'EXCURSÃO',
    icon: Truck,
    style: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', badge: 'bg-red-100 text-red-800' },
  },
  {
    id: 'CORREIOS',
    label: 'CORREIOS',
    icon: Mail,
    style: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-800' },
  },
  {
    id: 'SHOPEE',
    label: 'SHOPEE',
    icon: ShoppingBag,
    style: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', badge: 'bg-orange-100 text-orange-800' },
  },
  {
    id: 'RETIRADA(Recepção)',
    label: 'RETIRADA(Recepção)',
    icon: Store,
    style: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-800' },
  },
];

export const ROW_2_STAGES: ProductionStage[] = [
  'EXCURSÃO',
  'CORREIOS',
  'SHOPEE',
  'RETIRADA(Recepção)',
];

export const ALL_STAGES: ProductionStage[] = [
  'Sistema',
  ...ROW_1_STAGES,
  ...ROW_2_STAGES,
];

// Helper: Identifica se a OS ainda está ativa em um dos setores de aceite (Linha 1)
export const isOsInAcceptanceStage = (os: OrdemServico): boolean => {
  if (os.estagioAtual === 'Sistema') return false; // Sistema não é etapa ativa de chão de fábrica
  const stg = (os.estagioAtual || '').toLowerCase().trim();
  return (
    stg === 'designer' ||
    stg.includes('design') ||
    stg.includes('arte') ||
    stg.includes('cria') ||
    stg === 'impressão' ||
    stg === 'impressao' ||
    stg.includes('impress') ||
    stg.includes('print') ||
    stg === 'calandra' ||
    stg.includes('calandr') ||
    stg.includes('prensa') ||
    stg === 'costura' ||
    stg.includes('costur') ||
    stg.includes('acabamento')
  );
};

// Helper: Extrai se o destino de expedição foi definido explicitamente em "Controle de Expedição" ou na OS
export const getOsExplicitDestination = (os: OrdemServico): string | null => {
  const destExp = (os as any).destinoExpedicao || (os as any).destino;
  if (destExp && typeof destExp === 'string' && destExp.trim().length > 0) {
    const clean = destExp.trim().toUpperCase();
    if (clean.includes('SHOPEE')) return 'SHOPEE';
    if (clean.includes('CORREIO')) return 'CORREIOS';
    if (clean.includes('EXCURS') || clean.includes('ESCURS')) return 'EXCURSÃO';
    if (clean.includes('RETIRADA') || clean.includes('RECEP')) return 'RETIRADA(Recepção)';
    return clean;
  }
  if (os.tipoExpedicao === 'EXPRESSO EXCURSÃO' || String(os.tipoExpedicao).toUpperCase().includes('EXCURS')) {
    return 'EXCURSÃO';
  }
  const canal = String((os as any).canal || (os as any).canalVenda || (os as any).origem || '').toUpperCase();
  const obs = String(os.observacoes || '').toUpperCase();
  if (canal.includes('SHOPEE') || obs.includes('SHOPEE')) return 'SHOPEE';
  if (canal.includes('CORREIO') || obs.includes('CORREIO')) return 'CORREIOS';
  return null;
};

// Helper: Determina a coluna de destino da Linha 2 quando a OS sai da última etapa de aceite
export const getOsRow2Destination = (os: OrdemServico): ExpedicaoDestId => {
  const explicit = getOsExplicitDestination(os);
  if (explicit) {
    if (explicit.includes('SHOPEE')) return 'SHOPEE';
    if (explicit.includes('CORREIO')) return 'CORREIOS';
    if (explicit.includes('EXCURS') || explicit.includes('ESCURS')) return 'EXCURSÃO';
    if (explicit.includes('RETIRADA') || explicit.includes('RECEP')) return 'RETIRADA(Recepção)';
  }
  const stg = (os.estagioAtual || '').toLowerCase();
  const tipoExp = String(os.tipoExpedicao || '').toUpperCase();
  if (stg.includes('shopee') || tipoExp.includes('SHOPEE')) return 'SHOPEE';
  if (stg.includes('correio') || tipoExp.includes('CORREIO')) return 'CORREIOS';
  if (stg.includes('excurs') || tipoExp.includes('EXCURS')) return 'EXCURSÃO';
  return 'RETIRADA(Recepção)';
};

// Stage icon helper
const getStageIcon = (stage: ProductionStage) => {
  switch (stage) {
    case 'Sistema':
      return Layers;
    case 'Designer':
    case 'DESIGNER':
      return Palette;
    case 'Impressão':
    case 'IMPRESSÃO':
      return Printer;
    case 'Calandra':
    case 'CALANDRA':
      return Flame;
    case 'Costura':
    case 'COSTURA':
      return Scissors;
    case 'EXCURSÃO':
    case 'Excursão':
      return Truck;
    case 'CORREIOS':
    case 'Correios':
      return Mail;
    case 'SHOPEE':
    case 'Shopee':
      return ShoppingBag;
    case 'RETIRADA(Recepção)':
    case 'Retirada (Recepção)':
      return Store;
    case 'Conferência':
      return Box;
    case 'Expedição':
      return Truck;
    case 'Entrega':
      return Calendar;
    case 'Concluído':
      return CheckCircle2;
    default:
      return Clock;
  }
};

// Stage theme color helper
const getStageColor = (stage: ProductionStage) => {
  switch (stage) {
    case 'Sistema':
      return { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800', badge: 'bg-slate-200 text-slate-800' };
    case 'Designer':
    case 'DESIGNER':
      return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', badge: 'bg-purple-100 text-purple-800' };
    case 'Impressão':
    case 'IMPRESSÃO':
      return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-800' };
    case 'Calandra':
    case 'CALANDRA':
      return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-800' };
    case 'Costura':
    case 'COSTURA':
      return { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', badge: 'bg-rose-100 text-rose-800' };
    case 'EXCURSÃO':
    case 'Excursão':
      return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', badge: 'bg-red-100 text-red-800' };
    case 'CORREIOS':
    case 'Correios':
      return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-800' };
    case 'SHOPEE':
    case 'Shopee':
      return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', badge: 'bg-orange-100 text-orange-800' };
    case 'RETIRADA(Recepção)':
    case 'Retirada (Recepção)':
      return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-800' };
    case 'Conferência':
      return { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900', badge: 'bg-indigo-100 text-indigo-800' };
    case 'Expedição':
      return { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-900', badge: 'bg-cyan-100 text-cyan-800' };
    case 'Entrega':
      return { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-900', badge: 'bg-teal-100 text-teal-800' };
    case 'Concluído':
      return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-800' };
    default:
      return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', badge: 'bg-slate-100 text-slate-800' };
  }
};

const ElapsedTimer: React.FC<{ startDate: string }> = ({ startDate }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const start = new Date(startDate).getTime();
    if (isNaN(start)) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = now - start;
      if (diff < 0) return;

      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      const formatted = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      setElapsed(formatted);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  return <span className="font-mono tabular-nums">{elapsed}</span>;
};

function formatElapsedDuration(diffMs: number): string {
  if (diffMs <= 0 || isNaN(diffMs)) return '00:00:01';
  const hrs = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function parseDurationToMs(dur?: string): number {
  if (!dur) return 0;
  const parts = dur.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return 0;
}

function calculateTotalStageDuration(tempoAceitacao?: string, tempoAndamento?: string, tempoAprovacao?: string): string {
  const ms1 = parseDurationToMs(tempoAceitacao);
  const ms2 = parseDurationToMs(tempoAndamento);
  const ms3 = parseDurationToMs(tempoAprovacao);
  const totalMs = ms1 + ms2 + ms3;
  if (totalMs <= 0) return '';
  return formatElapsedDuration(totalMs);
}

interface KanbanServiceCardProps {
  os: OrdemServico;
  stage: ProductionStage;
  isAccepted: boolean;
  acceptanceInfo?: {
    funcionario: string;
    aceitoEm: string;
    aceitoEmISO?: string;
    tempoAceitacao?: string;
    tempoAndamento?: string;
    status?: string;
    concluidoEm?: string;
  };
  canOperate: boolean;
  canVoltarAcao: boolean;
  hasPrevious: boolean;
  definedDestination?: string | null;
  isDisplayOnly?: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onAdvance: () => void;
  onRollback: () => void;
  onDeliver?: () => void;
  onReturn?: () => void;
  onClientApprove?: () => void;
  onClientReject?: () => void;
  canApproveOrReject?: boolean;
}

const KanbanServiceCard: React.FC<KanbanServiceCardProps> = ({
  os,
  stage,
  isAccepted,
  acceptanceInfo,
  canOperate,
  canVoltarAcao,
  hasPrevious,
  definedDestination,
  isDisplayOnly,
  onSelect,
  onAccept,
  onAdvance,
  onRollback,
  onDeliver,
  onReturn,
  onClientApprove,
  onClientReject,
  canApproveOrReject,
}) => {
  const isConcluded = stage === 'Concluído';
  const isAguardandoAprovacao = !!os.aguardandoAprovacaoCliente;
  const isDesigner = stage === 'Designer';

  const borderColor = isDisplayOnly
    ? 'border-emerald-500'
    : isConcluded
    ? 'border-[#10b981]' // Emerald
    : isAguardandoAprovacao
    ? 'border-[#f97316]' // Orange
    : isAccepted
    ? 'border-[#3b82f6]' // Blue
    : 'border-[#dc2626]'; // Red

  // Pill stylings
  const orangePillClass = "bg-[#f97316] text-white font-black px-3 py-1 rounded-full text-center tracking-wide uppercase whitespace-nowrap shadow-sm text-[11px]";
  const redPillClass = "bg-[#dc2626] text-white font-black px-3 py-1 rounded-full text-center tracking-wide uppercase whitespace-nowrap shadow-sm text-[11px]";
  const bluePillClass = "bg-[#3b82f6] text-white font-black px-3 py-1 rounded-full text-center tracking-wide uppercase whitespace-nowrap shadow-sm text-[11px]";
  const emeraldPillClass = "bg-[#10b981] text-white font-black px-3 py-1 rounded-full text-center uppercase tracking-wide shadow-sm text-[11px]";

  // VISÃO EXCLUSIVA DE APENAS EXIBIÇÃO (LINHA DE BAIXO - CONTROLE DE EXPEDIÇÃO)
  if (isDisplayOnly) {
    const isExpedido = Boolean(os.expedido);
    const isConferido = Boolean(os.conferido);
    const destName = definedDestination || 'EXPEDIÇÃO';

    return (
      <div
        onClick={onSelect}
        className={`relative bg-white border-[3px] ${borderColor} rounded-[2rem] p-3 shadow-sm hover:shadow-md transition-all cursor-pointer select-none flex flex-col items-center justify-between gap-2.5`}
      >
        {/* TOP: PILLS & DESTINATION */}
        <div className="flex flex-col gap-1.5 w-full shrink-0">
          {/* OS NUMBER */}
          <div className={`${orangePillClass} text-sm py-1.5`}>
            {os.codigo}
          </div>

          {/* DESTINO DEFINIDO */}
          <div
            className="bg-slate-900 text-white font-black text-[10px] px-2.5 py-1 rounded-full text-center uppercase tracking-wide shadow-2xs flex items-center justify-center gap-1"
            title={`Destino da Expedição: ${destName}`}
          >
            <Truck className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">DESTINO: {destName}</span>
          </div>

          {/* BADGE APENAS EXIBIÇÃO */}
          <div className="bg-slate-100 text-slate-700 border border-slate-300 font-black text-[9px] px-2 py-0.5 rounded-full text-center uppercase tracking-wider">
            (apenaS exibição)
          </div>

          {/* STATUS DE EXPEDIÇÃO */}
          {isExpedido ? (
            <div className="bg-emerald-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full text-center uppercase tracking-wide shadow-2xs flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>EXPEDIDO / DESPACHADO</span>
            </div>
          ) : isConferido ? (
            <div className="bg-blue-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full text-center uppercase tracking-wide shadow-2xs flex items-center justify-center gap-1">
              <Check className="w-3 h-3" />
              <span>CONFERIDO • AGUARDANDO COLETA</span>
            </div>
          ) : isConcluded ? (
            <div className="bg-emerald-700 text-white font-black text-[10px] px-2.5 py-1 rounded-full text-center uppercase tracking-wide shadow-2xs flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>CONCLUÍDO</span>
            </div>
          ) : (
            <div className="bg-indigo-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full text-center uppercase tracking-wide shadow-2xs flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              <span>AGUARDANDO EXPEDIÇÃO</span>
            </div>
          )}
        </div>

        {/* MIDDLE: CLIENTE & VENDEDOR & OBS EXPEDIÇÃO */}
        <div className="flex flex-col items-center justify-center gap-1 flex-1 min-w-0 w-full bg-slate-50/70 rounded-xl p-2 border border-slate-200">
          <div className="text-center w-full">
            <div className="text-[#64748b] font-extrabold text-[9px] uppercase tracking-wider mb-[-2px]">CLIENTE</div>
            <div className="text-[#2563eb] font-black text-xs uppercase truncate px-1">{os.clienteNome || 'NÃO INFORMADO'}</div>
          </div>
          
          <div className="text-center w-full">
            <div className="text-[#64748b] font-extrabold text-[9px] uppercase tracking-wider mb-[-2px]">VENDEDOR</div>
            <div className="text-[#2563eb] font-black text-xs uppercase truncate px-1">{os.operador || 'NÃO INFORMADO'}</div>
          </div>

          {os.tipoExpedicao && (
            <div className="text-center w-full mt-0.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase">
                Modalidade: <strong className="text-slate-800 font-black">{os.tipoExpedicao}</strong>
              </span>
            </div>
          )}

          {os.observacoesExpedicao && (
            <div className="text-center w-full mt-1 pt-1 border-t border-slate-200">
              <div className="text-[#64748b] font-extrabold text-[8.5px] uppercase tracking-wider">OBS EXPEDIÇÃO</div>
              <p className="text-slate-800 font-bold text-[9.5px] line-clamp-2 px-1 leading-tight">{os.observacoesExpedicao}</p>
            </div>
          )}
        </div>

        {/* BOTTOM: BOTÕES */}
        <div className="w-full shrink-0 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
          {onDeliver && (
            <button
              type="button"
              onClick={onDeliver}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-full px-3 py-2 font-black transition-all flex items-center justify-center gap-1.5 shadow-sm uppercase text-[10px] cursor-pointer"
              title="Definir OS como Entregue (informar quem recebeu, telefone e CPF)"
            >
              <PackageCheck className="w-3.5 h-3.5 text-white" />
              <span>Definir como Entregue</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSelect}
            className="w-full bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-full px-4 py-1.5 font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm uppercase text-[9.5px] cursor-pointer"
            title="Visualizar detalhes completos desta OS"
          >
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span>Ver Detalhes da OS</span>
          </button>
        </div>
      </div>
    );
  }

  // VISÃO PADRÃO COM ETAPAS DE ACEITE (LINHA 1)
  return (
    <div
      onClick={onSelect}
      className={`relative bg-white border-[3px] ${borderColor} rounded-[2rem] p-3 shadow-sm hover:shadow-md transition-all cursor-pointer select-none flex flex-col items-center justify-between gap-3`}
    >
      {/* LEFT COLUMN: PILLS */}
      <div className="flex flex-col gap-1.5 w-full shrink-0">
        {/* OS NUMBER */}
        <div className={`${orangePillClass} text-sm py-1.5`}>
          {os.codigo}
        </div>

        {/* MODALIDADE DE ENVIO / EXPEDIÇÃO BADGE */}
        <div
          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full text-center uppercase tracking-wide shadow-2xs flex items-center justify-center gap-1 ${
            (os.tipoExpedicao as string) === 'EXPRESSO EXCURSÃO'
              ? 'bg-red-600 text-white'
              : (os.tipoExpedicao as string) === 'EXPRESSO DO DIA'
              ? 'bg-[#FFA500] text-slate-950 font-black'
              : (os.tipoExpedicao as string) === 'SHOPEE'
              ? 'bg-[#EE4D2D] text-white font-black'
              : 'bg-blue-600 text-white'
          }`}
          title={`Modalidade de Expedição: ${os.tipoExpedicao || 'NORMAL'}`}
        >
          <Truck className="w-3 h-3 shrink-0" />
          <span>{os.tipoExpedicao || 'NORMAL'}</span>
        </div>

        {/* BADGE DE ARTE PARA IMPRESSÃO EM ALTA RESOLUÇÃO */}
        {os.anexos?.some((a) => a.type === 'PARA_IMPRESSAO' || a.isParaImpressao || (a.label || '').toLowerCase().includes('impressão') || (a.label || '').toLowerCase().includes('impressao')) && (
          <div
            className="bg-purple-900 text-purple-100 font-black px-2 py-0.5 rounded-full text-center uppercase tracking-wide shadow-2xs text-[9.5px] flex items-center justify-center gap-1 border border-purple-400/40"
            title="Esta OS possui arquivo em alta resolução anexado para impressão"
          >
            <Printer className="w-2.5 h-2.5 text-purple-300" />
            <span>ARTE P/ IMPRESSÃO</span>
          </div>
        )}

        {/* PARALELO BADGE SE ESTIVER NA COLUNA CONFERÊNCIA MAS O ESTÁGIO ATUAL FOR OUTRO */}
        {stage === 'Conferência' && os.estagioAtual !== 'Conferência' && (
          <div
            className="bg-purple-700 text-white font-black px-2 py-0.5 rounded-full text-center uppercase tracking-wide shadow-2xs text-[10px] flex items-center justify-center gap-1"
            title={`Conferência Paralela: a OS está fisicamente no setor [${os.estagioAtual}]`}
          >
            <span>PARALELO • EM {os.estagioAtual.toUpperCase()}</span>
          </div>
        )}

        {/* STATUS PILL & TIMER */}
        {isConcluded ? (
          <div className={`${emeraldPillClass}`}>
            CONCLUÍDO
          </div>
        ) : isAguardandoAprovacao ? (
          <>
            <div className={`${orangePillClass}`}>
              EM APROVAÇÃO
            </div>
            {os.aguardandoAprovacaoDesde ? (
              <div className={`${orangePillClass} text-base tracking-widest py-1.5`}>
                <ElapsedTimer startDate={os.aguardandoAprovacaoDesde} />
              </div>
            ) : (
              <div className={`${orangePillClass} text-base tracking-widest py-1.5`}>
                <ElapsedTimer startDate={os.createdAt || new Date().toISOString()} />
              </div>
            )}
          </>
        ) : !isAccepted ? (
          <>
            <div className={`${redPillClass}`}>
              AGUARDANDO ACEITAÇÃO
            </div>
            {os.aguardandoAceitacaoDesde ? (
              <div className={`${redPillClass} text-base tracking-widest py-1.5`}>
                <ElapsedTimer startDate={os.aguardandoAceitacaoDesde} />
              </div>
            ) : (
              <div className={`${redPillClass} text-base tracking-widest py-1.5`}>
                <ElapsedTimer startDate={os.createdAt || new Date().toISOString()} />
              </div>
            )}
          </>
        ) : (
          <>
            <div className={`${bluePillClass}`}>
              EM ANDAMENTO
            </div>
            {acceptanceInfo?.aceitoEmISO ? (
              <div className={`${bluePillClass} text-base tracking-widest py-1.5`}>
                <ElapsedTimer startDate={acceptanceInfo.aceitoEmISO} />
              </div>
            ) : (
              <div className={`${bluePillClass} text-base tracking-widest py-1.5`}>
                00:00:00
              </div>
            )}
          </>
        )}
      </div>

      {/* OBSERVAÇÃO DE DESTINO DEFINIDO ANTECIPADAMENTE (ENQUANTO AINDA EM SETOR DE ACEITE) */}
      {definedDestination && (
        <div className="w-full bg-amber-50/95 border-2 border-amber-400 rounded-xl p-2 text-center shadow-xs">
          <div className="flex items-center justify-center gap-1 text-amber-950 font-black text-[10.5px] uppercase tracking-wide">
            <Truck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>DESTINO DEFINIDO: {definedDestination}</span>
          </div>
          <p className="text-[9px] font-bold text-amber-900 mt-0.5 leading-tight">
            Aguardando saída de {stage} para exibição no fluxo {definedDestination}
          </p>
        </div>
      )}

      {/* MIDDLE COLUMN: INFO & ROLLBACK BUTTON */}
      <div className="flex flex-col items-center justify-center gap-1 flex-1 min-w-0 w-full bg-slate-50/50 rounded-xl p-1.5">
        <div className="text-center w-full">
          <div className="text-[#64748b] font-extrabold text-[9px] uppercase tracking-wider mb-[-2px]">NOME DO CLIENTE</div>
          <div className="text-[#2563eb] font-black text-xs uppercase truncate px-1">{os.clienteNome || 'NÃO INFORMADO'}</div>
        </div>
        
        <div className="text-center w-full">
          <div className="text-[#64748b] font-extrabold text-[9px] uppercase tracking-wider mb-[-2px]">NOME DO VENDEDOR</div>
          <div className="text-[#2563eb] font-black text-xs uppercase truncate px-1">{os.operador || 'NÃO INFORMADO'}</div>
        </div>

        {/* ROLLBACK BUTTON (Strictly Developer, CEO, Gerente Geral, Supervisor - Only for Designer stage) */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
          {stage === 'Designer' && hasPrevious && canVoltarAcao && !isAguardandoAprovacao && (
            <button
              type="button"
              onClick={onRollback}
              className="flex flex-col items-center justify-center text-[#2563eb] font-black text-[9px] hover:opacity-80 active:scale-95 transition-transform group cursor-pointer"
              title="Voltar Etapa (Requer Senha de Superior: Developer, CEO, Gerente Geral ou Supervisor)"
            >
              <div className="bg-[#f97316] text-white p-1.5 rounded-full mb-0.5 group-hover:bg-[#ea580c] transition-colors shadow-sm">
                <RotateCcw className="w-3 h-3" />
              </div>
              <span className="uppercase text-center leading-tight">VOLTAR ETAPA</span>
            </button>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: ACTION BUTTONS */}
      <div className="flex flex-col items-center justify-center gap-1.5 shrink-0 w-full" onClick={(e) => e.stopPropagation()}>
        {isAguardandoAprovacao && (
          <div className="w-full text-center pb-0.5">
            <span className="text-[9px] font-black text-amber-800 bg-amber-100/90 border border-amber-300/80 px-2 py-0.5 rounded-full text-center uppercase tracking-tight block truncate">
              Vendedor aguarda aprovação
            </span>
          </div>
        )}
        {isAguardandoAprovacao && canApproveOrReject ? (
          <>
             <button
              type="button"
              onClick={onClientReject}
              className="w-full bg-[#dc2626] hover:bg-[#b91c1c] active:scale-95 text-white rounded-full px-4 py-2 font-black transition-all flex items-center justify-center gap-1.5 shadow-sm uppercase text-[10px] cursor-pointer"
              title="Solicitar ajuste na arte (Retorna para o Designer)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>AJUSTAR ARTE</span>
            </button>
            <button
              type="button"
              onClick={onClientApprove}
              className="w-full bg-[#10b981] hover:bg-[#059669] active:scale-95 text-white rounded-full px-4 py-2 font-black transition-all flex items-center justify-center gap-1.5 shadow-sm uppercase text-[10px] cursor-pointer"
              title="Aprovar arte do cliente (Avança diretamente para a próxima etapa)"
            >
              <Check className="w-4 h-4" />
              <span>APROVADO</span>
            </button>
          </>
        ) : isAguardandoAprovacao && !canApproveOrReject ? (
          <button
            type="button"
            onClick={onSelect}
            className="w-full bg-amber-100/90 hover:bg-amber-200 active:scale-95 text-amber-900 border border-amber-300 rounded-full px-3 py-2 font-black transition-all flex items-center justify-center gap-1.5 shadow-xs uppercase text-[10px] cursor-pointer"
            title="Clique para visualizar o status e detalhes da aprovação da arte"
          >
            <Eye className="w-3.5 h-3.5 text-amber-700" />
            <span>Ver Situação</span>
          </button>
        ) : !isAccepted && !isConcluded && canOperate && !isAguardandoAprovacao ? (
          <button
            type="button"
            onClick={onAccept}
            className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-95 text-white rounded-full px-4 py-2 font-black transition-all flex items-center justify-center gap-1.5 shadow-sm uppercase text-[11px] tracking-wide cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Aceitar Serviço</span>
          </button>
        ) : isAccepted && !isConcluded && canOperate && !isAguardandoAprovacao ? (
          <button
            type="button"
            onClick={onAdvance}
            className="w-full bg-[#10b981] hover:bg-[#059669] active:scale-95 text-white rounded-full px-4 py-2 font-black transition-all flex items-center justify-center gap-1.5 shadow-sm uppercase text-[11px] tracking-wide cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>
              {isDesigner
                ? 'Enviar p/ Aprovação'
                : stage === 'Conferência'
                ? 'Aprovar e Liberar OS'
                : 'Avançar Etapa'}
            </span>
          </button>
        ) : (
           <button
            type="button"
            onClick={onSelect}
            className="w-full bg-[#f1f5f9] hover:bg-[#e2e8f0] active:scale-95 text-[#475569] rounded-full px-4 py-2 font-black transition-all flex items-center justify-center gap-1.5 shadow-sm uppercase text-[10px] cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ver Detalhes</span>
          </button>
        )}
      </div>
    </div>
  );
};

const filterProductionOs = (data: any[] | null) => {
  return (data || []).filter(
    (os) => os.tipoDocumento !== 'ORCAMENTO' && !os.isOrcamento && !(os.codigo && os.codigo.startsWith('ORC'))
  );
};

export const KanbanModuleView: React.FC<KanbanModuleViewProps> = ({ user, isSidebarExpanded = false }) => {
  const cachedInitial = ApiService.getCachedOrdensServico();
  const [osList, setOsList] = useState<OrdemServico[]>(() => {
    return cachedInitial ? filterProductionOs(cachedInitial) : [];
  });
  const [loading, setLoading] = useState<boolean>(() => !cachedInitial || cachedInitial.length === 0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterOnlyMyRole, setFilterOnlyMyRole] = useState<boolean>(false);

  // Modal OS Detail State
  const [selectedOs, setSelectedOs] = useState<OrdemServico | null>(null);
  const [deliveryModalOs, setDeliveryModalOs] = useState<OrdemServico | null>(null);
  const [returnModalOs, setReturnModalOs] = useState<OrdemServico | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printableOs, setPrintableOs] = useState<OrdemServico | null>(null);
  const [previewImageModalUrl, setPreviewImageModalUrl] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string>('');

  // Handle direct file download for artes and attachments
  const handleDownloadAttachment = (att: { fileUrl: string; fileName?: string; isParaImpressao?: boolean }) => {
    if (!att.fileUrl) return;
    const link = document.createElement('a');
    link.href = att.fileUrl;
    link.download = att.fileName || (att.isParaImpressao ? 'arte_para_impressao.png' : 'arte_os.png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // System Notifications Log
  const [notifications, setNotifications] = useState<
    { id: string; timestamp: string; message: string; osCodigo: string; stage: string }[]
  >([]);

  // Production Notes State in Modal
  const [stageNoteInput, setStageNoteInput] = useState<string>('');

  // Voltar Ação (Retrocesso) State
  const [rollbackModalOs, setRollbackModalOs] = useState<OrdemServico | null>(null);
  const [rollbackPassword, setRollbackPassword] = useState<string>('');
  const [rollbackShowPass, setRollbackShowPass] = useState<boolean>(false);
  const [rollbackLoading, setRollbackLoading] = useState<boolean>(false);
  const [rollbackError, setRollbackError] = useState<string>('');

  // Floating Real-time Stage Alerts State (5-second duration, instant dismiss on acceptance)
  interface FloatingStageAlert {
    id: string;
    osId: string;
    osCodigo: string;
    clienteNome: string;
    operador: string;
    stage: ProductionStage;
    valorFinal: number;
    createdAt: number;
    expiresAt: number;
    os: OrdemServico;
  }
  const [stageAlerts, setStageAlerts] = useState<FloatingStageAlert[]>([]);
  const seenAlertKeysRef = useRef<Set<string>>(new Set());

  // Reactive tick for real-time permission updates
  const [permTick, setPermTick] = useState<number>(0);

  useEffect(() => {
    const handlePermUpdate = () => {
      setTimeout(() => {
        setPermTick((t) => t + 1);
      }, 0);
    };
    window.addEventListener('subligestao_permissions_updated', handlePermUpdate);
    window.addEventListener('storage', handlePermUpdate);
    return () => {
      window.removeEventListener('subligestao_permissions_updated', handlePermUpdate);
      window.removeEventListener('storage', handlePermUpdate);
    };
  }, []);

  // Strict RBAC: Check if user has permission to "Criar / Editar" in Fluxo de Produção (Kanban)
  const canUserCriarEditarKanban = useMemo(() => {
    return canUserPerformAction(user.role, 'kanban', 'criarEditar', user.isDeveloper);
  }, [user.role, user.isDeveloper, permTick]);

  // Strict RBAC: Check if user has permission to "Voltar Ação" in Fluxo de Produção (Kanban)
  const canUserVoltarAcao = useMemo(() => {
    return canUserVoltarAcaoKanban(user.role, user.isDeveloper);
  }, [user.role, user.isDeveloper, permTick]);

  // Floating alert detector: Trigger alert on screen for operators of the next stage (lasts 5s, dismisses immediately on acceptance)
  const [alertTick, setAlertTick] = useState<number>(0);

  useEffect(() => {
    if (!osList || osList.length === 0) return;

    const now = Date.now();
    const newAlertsToAdd: FloatingStageAlert[] = [];

    osList.forEach((os) => {
      const currentStage = os.estagioAtual;
      if (currentStage === 'Sistema' || currentStage === 'Concluído') return;

      const isAccepted = isStageAccepted(os, currentStage);
      const key = `${os.id}_${currentStage}`;

      // If accepted, immediately remove from active floating alerts
      if (isAccepted) {
        setStageAlerts((prev) => prev.filter((a) => !(a.osId === os.id && a.stage === currentStage)));
        return;
      }

      // If pending acceptance and current user can operate this stage
      if (!isAccepted && canUserOperateStage(currentStage, os)) {
        if (!seenAlertKeysRef.current.has(key)) {
          seenAlertKeysRef.current.add(key);
          const alertItem: FloatingStageAlert = {
            id: `alert-${os.id}-${currentStage}-${now}-${Math.random().toString(36).substring(2, 6)}`,
            osId: os.id,
            osCodigo: os.codigo,
            clienteNome: os.clienteNome,
            operador: os.operador || 'Vendedor',
            stage: currentStage,
            valorFinal: os.valorFinal || 0,
            createdAt: now,
            expiresAt: now + 5000,
            os,
          };
          newAlertsToAdd.push(alertItem);
        }
      }
    });

    if (newAlertsToAdd.length > 0) {
      setStageAlerts((prev) => [...prev, ...newAlertsToAdd]);
    }
  }, [osList, user.role, canUserCriarEditarKanban]);

  // Tick every 100ms to update progress and auto-expire floating alerts after 5 seconds
  useEffect(() => {
    if (stageAlerts.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setStageAlerts((prev) => prev.filter((a) => a.expiresAt > now));
      setAlertTick((t) => t + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [stageAlerts.length]);

  // Listen for global notification events to dismiss alerts immediately on acceptance
  useEffect(() => {
    const handleNotificationEvent = (e: any) => {
      const detail = e.detail;
      if (detail && detail.type === 'os_accepted' && detail.osId && detail.stage) {
        setStageAlerts((prev) => prev.filter((a) => !(a.osId === detail.osId && a.stage === detail.stage)));
      }
    };
    window.addEventListener('subligestao_new_notification', handleNotificationEvent);
    return () => window.removeEventListener('subligestao_new_notification', handleNotificationEvent);
  }, []);

  const loadData = async (silent: boolean | any = false) => {
    const isSilent = typeof silent === 'boolean' ? silent : false;
    try {
      if (!isSilent && osList.length === 0) {
        setLoading(true);
      }
      const data = await ApiService.getOrdensServico();
      if (Array.isArray(data)) {
        setOsList(filterProductionOs(data));
      }
    } catch (err) {
      console.error('Erro ao carregar Ordens de Serviço:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hasCached = Boolean(cachedInitial && cachedInitial.length > 0);
    loadData(hasCached);

    const interval = setInterval(() => {
      ApiService.getOrdensServico().then((data) => {
        if (data) setOsList(filterProductionOs(data));
      }).catch(() => {});
    }, 25000);

    const handleOsChanged = () => {
      ApiService.getOrdensServico().then((data) => {
        if (data) setOsList(filterProductionOs(data));
      }).catch(() => {});
    };

    window.addEventListener('os-changed', handleOsChanged);
    return () => {
      clearInterval(interval);
      window.removeEventListener('os-changed', handleOsChanged);
    };
  }, []);

  // Update selected OS when list refreshes
  useEffect(() => {
    if (selectedOs) {
      const fresh = osList.find((os) => os.id === selectedOs.id);
      if (fresh) {
        setSelectedOs(fresh);
      }
    }
  }, [osList]);

  // Checks if logged user is in Sales (Vendedor) and not an executive/supervisory role (CEO, Gerente, Supervisor, Dev)
  const isLoggedUserSeller = useMemo(() => {
    if (user.isDeveloper) return false;
    const normRole = normalizeRoleName(user.role);
    if (['CEO', 'Gerente Geral', 'Supervisor'].includes(normRole) || ['CEO', 'Gerente Geral', 'Supervisor'].includes(user.role)) {
      return false;
    }
    const lowerRole = (user.role || '').toLowerCase();
    return normRole === 'Vendedor(a)' || lowerRole.includes('vendedor') || lowerRole.includes('comercial');
  }, [user.role, user.isDeveloper]);

  // Checks if the OS was created by, assigned to, or operated by the logged user
  const isOsOfLoggedSeller = (targetOs: OrdemServico): boolean => {
    const curName = (user.name || '').toLowerCase().trim();
    const curUser = (((user as any).username || '') as string).toLowerCase().trim();
    const opName = (targetOs.operador || '').toLowerCase().trim();
    const vendNome = (targetOs.vendedorNome || '').toLowerCase().trim();
    const vend = (targetOs.vendedor || '').toLowerCase().trim();
    const createdBy = (((targetOs as any).criadoPor || (targetOs as any).createdBy || '') as string).toLowerCase().trim();
    const updatedBy = (targetOs.updatedBy || '').toLowerCase().trim();

    if (!curName && !curUser) return true;

    const checkList = [opName, vendNome, vend, createdBy, updatedBy].filter(Boolean);
    for (const val of checkList) {
      if (curName && (val === curName || val.includes(curName) || curName.includes(val))) return true;
      if (curUser && (val === curUser || val.includes(curUser) || curUser.includes(val))) return true;
    }

    const sistemaLog = (targetOs.setorAceitoPor || []).find((s) => s.estagio === 'Sistema');
    if (sistemaLog?.funcionario) {
      const func = sistemaLog.funcionario.toLowerCase().trim();
      if (curName && (func === curName || func.includes(curName) || curName.includes(func))) return true;
      if (curUser && (func === curUser || func.includes(curUser) || curUser.includes(func))) return true;
    }

    if (Array.isArray(targetOs.historicoEdicoes)) {
      for (const h of targetOs.historicoEdicoes) {
        const u = (h.usuario || '').toLowerCase().trim();
        if (curName && (u === curName || u.includes(curName) || curName.includes(u))) return true;
        if (curUser && (u === curUser || u.includes(curUser) || curUser.includes(u))) return true;
      }
    }

    return false;
  };

  // Check if logged user is the responsible seller for the OS
  const isUserResponsibleSeller = (targetOs: OrdemServico) => {
    if (user.isDeveloper) return true;
    const normRole = normalizeRoleName(user.role);
    if (['CEO', 'Gerente Geral', 'Supervisor'].includes(normRole) || ['CEO', 'Gerente Geral', 'Supervisor'].includes(user.role)) {
      return true;
    }
    return isOsOfLoggedSeller(targetOs);
  };

  // Check if current user can accept/operate/advance in stage (Strictly respects Criar / Editar on Fluxo de Produção)
  const canUserOperateStage = (stage: ProductionStage, targetOs?: OrdemServico) => {
    if (user.isDeveloper) return true;

    // Strict RBAC enforcement: 'Criar / Editar' in 'Fluxo de Produção' (kanban) MUST be marked!
    if (!canUserCriarEditarKanban) {
      return false;
    }

    const normRole = normalizeRoleName(user.role);
    if (['CEO', 'Gerente Geral', 'Supervisor'].includes(normRole) || ['CEO', 'Gerente Geral', 'Supervisor'].includes(user.role)) {
      return true;
    }

    if (stage === 'Sistema') {
      if (targetOs) {
        return isUserResponsibleSeller(targetOs);
      }
      return isRoleAuthorizedForSales(user.role, user.isDeveloper);
    }

    const stripAcc = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const sNorm = stripAcc(stage);
    const uRoleNorm = stripAcc(user.role);
    const nRoleNorm = stripAcc(normRole);

    if (sNorm.includes('confer') && (uRoleNorm.includes('confer') || nRoleNorm.includes('confer'))) {
      return true;
    }

    return nRoleNorm === sNorm || uRoleNorm === sNorm;
  };

  // Check if stage is accepted for OS
  const isStageAccepted = (os: OrdemServico, stage: ProductionStage) => {
    const records = os.setorAceitoPor || [];
    const acceptance = [...records].reverse().find((s) => s.estagio === stage);
    return acceptance && (acceptance.status === 'Em Andamento' || acceptance.status === 'Concluído');
  };

  // Get acceptance info (latest for stage)
  const getStageAcceptanceInfo = (os: OrdemServico, stage: ProductionStage) => {
    const records = os.setorAceitoPor || [];
    return [...records].reverse().find((s) => s.estagio === stage);
  };

  // Handler: Update Tipo de Expedição
  const handleUpdateTipoExpedicao = async (osId: string, novoTipo: TipoExpedicao) => {
    try {
      const updated = await ApiService.updateOs(osId, { tipoExpedicao: novoTipo });
      if (updated) {
        setOsList((prev) => prev.map((o) => (o.id === osId ? { ...o, tipoExpedicao: novoTipo } : o)));
        if (selectedOs && selectedOs.id === osId) {
          setSelectedOs((prev) => (prev ? { ...prev, tipoExpedicao: novoTipo } : prev));
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar modalidade de expedição:', err);
    }
  };

  // Handler: Accept OS in Stage
  const handleAcceptStage = async (os: OrdemServico, stage: ProductionStage) => {
    const canOperate = canUserOperateStage(stage, os);
    if (!canOperate) {
      if (stage === 'Sistema') {
        alert(`Acesso Negado: Apenas o vendedor responsável (${os.operador || 'Vendedor'}) possui autorização para aceitar esta OS no Sistema.`);
      } else {
        alert(`Acesso Negado: Seu perfil não possui permissão para aceitar serviços no setor [${stage}]. Verifique a permissão "Criar / Editar" no menu Configurações.`);
      }
      return;
    }

    try {
      const nowISO = new Date().toLocaleString('pt-BR');
      const nowISOStr = new Date().toISOString();
      const updatedAcceptances = [...(os.setorAceitoPor || [])];
      
      let tempoAceitacaoMsg = '';
      if (os.aguardandoAceitacaoDesde) {
        const start = new Date(os.aguardandoAceitacaoDesde).getTime();
        const nowMs = new Date().getTime();
        if (!isNaN(start)) {
          tempoAceitacaoMsg = formatElapsedDuration(Math.max(0, nowMs - start));
        }
      } else if (os.createdAt) {
        const start = new Date(os.createdAt).getTime();
        const nowMs = new Date().getTime();
        if (!isNaN(start)) {
          tempoAceitacaoMsg = formatElapsedDuration(Math.max(0, nowMs - start));
        }
      }
      if (!tempoAceitacaoMsg) {
        tempoAceitacaoMsg = '00:00:01';
      }

      // Find the last record for this stage (or pending entry)
      let targetIndex = -1;
      for (let i = updatedAcceptances.length - 1; i >= 0; i--) {
        if (updatedAcceptances[i].estagio === stage) {
          targetIndex = i;
          break;
        }
      }

      const existingRecord = targetIndex >= 0 ? updatedAcceptances[targetIndex] : undefined;
      const newEntry = {
        ...(existingRecord || {}),
        estagio: stage,
        funcionario: user.name,
        aceitoEm: nowISO,
        aceitoEmISO: nowISOStr,
        tempoAceitacao: tempoAceitacaoMsg,
        status: 'Em Andamento' as const,
      };

      if (targetIndex >= 0) {
        updatedAcceptances[targetIndex] = newEntry;
      } else {
        updatedAcceptances.push(newEntry);
      }

      const updated = await ApiService.updateOs(os.id, {
        setorAceitoPor: updatedAcceptances,
        status: 'Em Produção',
      });

      // Register real-time notification
      NotificationService.notifyOsStageAccepted(os, stage, user.name);
      // Immediately dismiss floating alert for this OS
      setStageAlerts((prev) => prev.filter((a) => a.osId !== os.id));

      const notificationMsg = `🔔 Notificação enviada ao operador [${os.operador}]: O setor [${stage}] ACEITOU a OS ${os.codigo}! Responsável: ${user.name}`;
      setNotifications((prev) => [
        {
          id: Math.random().toString(),
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          message: notificationMsg,
          osCodigo: os.codigo,
          stage,
        },
        ...prev,
      ]);

      if (selectedOs?.id === os.id) {
        setSelectedOs(updated);
      }
      loadData();
    } catch (err: any) {
      alert(`Erro ao aceitar etapa: ${err.message || 'Falha na comunicação'}`);
    }
  };

  // Handler: Advance OS to Next Stage
  const handleAdvanceStage = async (os: OrdemServico, targetStage?: ProductionStage) => {
    const stageToAdvance = targetStage || os.estagioAtual;
    const canOperate = canUserOperateStage(stageToAdvance, os);
    if (!canOperate) {
      if (stageToAdvance === 'Sistema') {
        alert(`Acesso Negado: Apenas o vendedor responsável (${os.operador || 'Vendedor'}) possui autorização para concluir etapa e avançar esta OS no Sistema.`);
      } else {
        alert(`Acesso Negado: Seu perfil não possui permissão para operar no setor [${stageToAdvance}]. Verifique a permissão "Criar / Editar" no menu Configurações.`);
      }
      return;
    }

    try {
      const currentStage = os.estagioAtual;
      const fluxo = os.fluxoProducao || ALL_STAGES;
      const currentIndex = fluxo.indexOf(currentStage);

      const nowLocale = new Date().toLocaleString('pt-BR');
      const nowISOStr = new Date().toISOString();

      // REGRA 8: EM "CONFERÊNCIA" APÓS "Aprovar e Liberar OS" NÃO AVANÇA ETAPAS DE OUTRO SETOR APENAS O SEU.
      // Se a ação for chamada especificamente na Conferência enquanto a OS estiver paralelamente em outro setor de produção:
      if (stageToAdvance === 'Conferência' && currentStage !== 'Conferência') {
        const records = os.setorAceitoPor || [];
        const confIndex = records.map((x) => x.estagio).lastIndexOf('Conferência');
        let tempoAceitacaoMsg = '00:00:01';
        let tempoAndamentoMsg = '00:00:01';
        const nowMs = new Date().getTime();

        if (confIndex >= 0) {
          const acc = records[confIndex];
          tempoAceitacaoMsg = acc.tempoAceitacao || '00:00:01';
          const acceptStart = acc.aceitoEmISO ? new Date(acc.aceitoEmISO).getTime() : nowMs;
          tempoAndamentoMsg = formatElapsedDuration(Math.max(0, nowMs - acceptStart));
        }

        const noteText = stageNoteInput.trim()
          ? `Conferência Aprovada: ${stageNoteInput.trim()}`
          : 'Conferência Aprovada e Liberada (Paralelamente)';

        const updatedAcceptances = confIndex >= 0
          ? records.map((s, idx) => {
              if (idx === confIndex) {
                return {
                  ...s,
                  status: 'Concluído' as const,
                  funcionario: user.name,
                  concluidoEm: nowLocale,
                  concluidoEmISO: nowISOStr,
                  tempoAndamento: tempoAndamentoMsg,
                  observacao: noteText,
                };
              }
              return s;
            })
          : [
              ...records,
              {
                estagio: 'Conferência' as ProductionStage,
                funcionario: user.name,
                aceitoEm: nowLocale,
                aceitoEmISO: nowISOStr,
                concluidoEm: nowLocale,
                concluidoEmISO: nowISOStr,
                tempoAceitacao: tempoAceitacaoMsg,
                tempoAndamento: tempoAndamentoMsg,
                status: 'Concluído' as const,
                observacao: noteText,
              },
            ];

        setStageNoteInput('');

        const newHistory = [
          {
            id: Math.random().toString(),
            dataHora: nowLocale,
            usuario: user.name,
            perfil: user.role,
            acao: 'Conferência de OS Aprovada e Liberada',
            detalhes: `Auditoria aprovada paralelamente por [${user.name}]. A produção da OS permanece ativa no setor [${currentStage}].`,
          },
          ...(os.historicoEdicoes || []),
        ];

        const updated = await ApiService.updateOs(os.id, {
          conferido: true,
          conferenteNome: user.name,
          dataConferencia: nowLocale,
          observacoesConferencia: stageNoteInput.trim() || undefined,
          estagioAtual: currentStage, // NÃO AVANÇA O OUTRO SETOR! Mantém o estágio atual da OS!
          setorAceitoPor: updatedAcceptances,
          historicoEdicoes: newHistory,
        });

        NotificationService.notifyOsConferenced(updated, user.name);
        const notificationMsg = `✅ OS ${os.codigo} APROVADA E LIBERADA pela Conferência paralelamente por [${user.name}]! A produção segue no setor [${currentStage}].`;

        setNotifications((prev) => [
          {
            id: Math.random().toString(),
            timestamp: new Date().toLocaleTimeString('pt-BR'),
            message: notificationMsg,
            osCodigo: os.codigo,
            stage: 'Conferência',
          },
          ...prev,
        ]);

        if (selectedOs?.id === os.id) {
          setSelectedOs(updated);
        }
        loadData();
        return;
      }

      // Calculate tempoAndamento for currentStage
      const records = os.setorAceitoPor || [];
      const currentAcceptance = [...records].reverse().find((s) => s.estagio === currentStage);
      let tempoAndamentoMsg = '';
      if (currentAcceptance?.aceitoEmISO) {
        const start = new Date(currentAcceptance.aceitoEmISO).getTime();
        const nowMs = new Date().getTime();
        if (!isNaN(start)) {
          tempoAndamentoMsg = formatElapsedDuration(Math.max(0, nowMs - start));
        }
      } else if (currentAcceptance?.aceitoEm) {
        try {
          const start = new Date(currentAcceptance.aceitoEm).getTime();
          if (!isNaN(start)) {
            const nowMs = new Date().getTime();
            tempoAndamentoMsg = formatElapsedDuration(Math.max(0, nowMs - start));
          }
        } catch {}
      }
      if (!tempoAndamentoMsg) {
        tempoAndamentoMsg = '00:00:01';
      }

      // Update current stage status as Concluído in acceptances with tempoAndamento
      const lastCurrentIndex = records.map((x) => x.estagio).lastIndexOf(currentStage);
      const updatedAcceptances = records.map((s, idx) => {
        if (idx === lastCurrentIndex) {
          return {
            ...s,
            status: 'Concluído' as const,
            concluidoEm: nowLocale,
            concluidoEmISO: nowISOStr,
            tempoAndamento: tempoAndamentoMsg,
          };
        }
        return s;
      });

      // Special Flow for Designer: finishes art and routes to Salesperson for Client Approval
      if (currentStage === 'Designer') {
        const appendedObs = stageNoteInput.trim()
          ? (os.observacoes ? `${os.observacoes}\n[Designer - ${user.name}]: ${stageNoteInput.trim()}` : `[Designer - ${user.name}]: ${stageNoteInput.trim()}`)
          : (os.observacoes ? `${os.observacoes}\n[Designer - ${user.name}]: Arte finalizada. Aguardando aprovação do vendedor/cliente.` : `[Designer - ${user.name}]: Arte finalizada. Aguardando aprovação do vendedor/cliente.`);
        setStageNoteInput('');

        const updated = await ApiService.updateOs(os.id, {
          aguardandoAprovacaoCliente: true,
          aguardandoAprovacaoDesde: nowISOStr,
          setorAceitoPor: records.map((s, idx) => {
            if (idx === lastCurrentIndex) {
              return {
                ...s,
                status: 'Em Aprovação' as const,
                concluidoEm: nowLocale,
                concluidoEmISO: nowISOStr,
                tempoAndamento: tempoAndamentoMsg,
              };
            }
            return s;
          }),
          observacoes: appendedObs,
        });

        const notificationMsg = `⚠️ OS ${os.codigo} em APROVAÇÃO DA ARTE (Vendedor aguarda aprovação). Enviado por [${user.name}].`;
        setNotifications((prev) => [
          {
            id: Math.random().toString(),
            timestamp: new Date().toLocaleTimeString('pt-BR'),
            message: notificationMsg,
            osCodigo: os.codigo,
            stage: 'Designer',
          },
          ...prev,
        ]);

        setSelectedOs(updated);
        loadData();
        return;
      }

      // Determinação do próximo estágio (Avanço de Costura vai para o Destino de Expedição correspondente)
      let nextStage: ProductionStage | undefined = undefined;
      const isCosturaStage = currentStage === 'Costura' || (currentStage as string).toLowerCase().includes('costur');
      if (isCosturaStage) {
        const dest = getOsRow2Destination(os);
        const nextInFluxo = currentIndex >= 0 && currentIndex < fluxo.length - 1 ? fluxo[currentIndex + 1] : undefined;
        if (nextInFluxo && ['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)'].includes(nextInFluxo as string)) {
          nextStage = nextInFluxo;
        } else {
          nextStage = dest as ProductionStage;
        }
      } else if (currentIndex !== -1 && currentIndex < fluxo.length - 1) {
        nextStage = fluxo[currentIndex + 1];
      }

      if (!nextStage || nextStage === 'Concluído') {
        // Complete OS
        const updated = await ApiService.updateOs(os.id, {
          estagioAtual: 'Concluído',
          status: 'Concluído',
          setorAceitoPor: updatedAcceptances,
          aguardandoAceitacaoDesde: undefined,
          ...(currentStage === 'Conferência' && {
            conferido: true,
            conferenteNome: user.name,
            dataConferencia: nowLocale,
          }),
        });
        setSelectedOs(updated);
        loadData();
        return;
      }

      // Prepare updates
      const isNextFinal = (nextStage as string) === 'Concluído';
      const updates: Partial<OrdemServico> = {
        estagioAtual: nextStage,
        aguardandoAceitacaoDesde: isNextFinal ? undefined : nowISOStr,
        setorAceitoPor: updatedAcceptances,
        status: isNextFinal ? 'Concluído' : 'Em Produção',
        ...(currentStage === 'Conferência' && {
          conferido: true,
          conferenteNome: user.name,
          dataConferencia: nowLocale,
        }),
      };

      if (stageNoteInput.trim()) {
        const appendedObs = os.observacoes
          ? `${os.observacoes}\n[${currentStage} - ${user.name}]: ${stageNoteInput.trim()}`
          : `[${currentStage} - ${user.name}]: ${stageNoteInput.trim()}`;
        updates.observacoes = appendedObs;
        setStageNoteInput('');
      }

      const updated = await ApiService.updateOs(os.id, updates);

      // Register notification
      NotificationService.notifyOsStageAdvanced(os, currentStage, nextStage, user.name);
      const notificationMsg = isNextFinal
        ? `🎉 OS ${os.codigo} FINALIZADA e Concluída por [${user.name}]!`
        : `🚀 OS ${os.codigo} avançou de [${currentStage}] ➔ [${nextStage}]! Pendente de Aceitação por [${nextStage}].`;

      setNotifications((prev) => [
        {
          id: Math.random().toString(),
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          message: notificationMsg,
          osCodigo: os.codigo,
          stage: nextStage,
        },
        ...prev,
      ]);

      setSelectedOs(updated);
      loadData();
    } catch (err: any) {
      alert(`Erro ao avançar etapa: ${err.message || 'Falha de comunicação'}`);
    }
  };

  // Helper: Find Previous Stage
  const getPreviousStage = (os: OrdemServico): ProductionStage | null => {
    const fluxo = os.fluxoProducao || ALL_STAGES;
    const currentStage = os.estagioAtual;
    if (currentStage === 'Concluído') {
      const reversed = [...fluxo].reverse();
      const prev = reversed.find((s) => s !== 'Concluído');
      return prev || 'Entrega';
    }
    const currentIndex = fluxo.indexOf(currentStage);
    if (currentIndex > 0) {
      return fluxo[currentIndex - 1];
    }
    return null;
  };

  // Handler: Request Rollback Stage (Strictly Developer, CEO, Gerente Geral, Supervisor - Only for Designer stage)
  const handleRequestRollback = (os: OrdemServico) => {
    if (os.estagioAtual !== 'Designer') {
      alert('O recurso de voltar etapa só está disponível para a etapa de Designer. Da Impressão em diante não é permitido voltar etapa.');
      return;
    }

    const hasPermission = canUserVoltarAcaoKanban(user.role, user.isDeveloper);
    if (!hasPermission) {
      alert('Acesso Negado: Apenas DEVELOPER, CEO, GERENTE GERAL e SUPERVISOR têm permissão para retroceder ação na esteira de produção.');
      return;
    }

    const prevStage = getPreviousStage(os);
    if (!prevStage) {
      alert(`A OS ${os.codigo} já está no primeiro estágio (${os.estagioAtual}) e não pode ser retrocedida.`);
      return;
    }

    setRollbackError('');
    setRollbackPassword('');
    setRollbackShowPass(false);
    setRollbackModalOs(os);
  };

  // Handler: Return for Client Approval (Designer -> Vendedor / Voltar Etapa)
  const handleReturnForApproval = async (os: OrdemServico) => {
    try {
      const nowISO = new Date().toISOString();
      const nowLocale = new Date().toLocaleString('pt-BR');
      
      const records = os.setorAceitoPor || [];
      const lastDesignerIdx = records.map((x) => x.estagio).lastIndexOf('Designer');
      const lastDesigner = lastDesignerIdx >= 0 ? records[lastDesignerIdx] : undefined;

      // Calculate tempoAndamento for Designer up to this point
      let tempoAndamentoMsg = '';
      if (lastDesigner?.aceitoEmISO) {
        const start = new Date(lastDesigner.aceitoEmISO).getTime();
        const nowMs = new Date().getTime();
        if (!isNaN(start)) {
          tempoAndamentoMsg = formatElapsedDuration(Math.max(0, nowMs - start));
        }
      } else if (lastDesigner?.aceitoEm) {
        try {
          const start = new Date(lastDesigner.aceitoEm).getTime();
          if (!isNaN(start)) {
            const nowMs = new Date().getTime();
            tempoAndamentoMsg = formatElapsedDuration(Math.max(0, nowMs - start));
          }
        } catch {}
      }
      if (!tempoAndamentoMsg) {
        tempoAndamentoMsg = '00:00:01';
      }

      const updatedAcceptances = records.map((s, idx) => {
        if (idx === lastDesignerIdx) {
          return {
            ...s,
            status: 'Em Aprovação' as const,
            tempoAndamento: tempoAndamentoMsg,
            concluidoEm: nowLocale,
            concluidoEmISO: nowISO,
          };
        }
        return s;
      });

      const updates: Partial<OrdemServico> = {
        aguardandoAprovacaoCliente: true,
        aguardandoAprovacaoDesde: nowISO,
        setorAceitoPor: updatedAcceptances,
        observacoes: os.observacoes 
          ? `${os.observacoes}\n[Designer - ${user.name}]: Arte finalizada. Aguardando aprovação do vendedor/cliente.`
          : `[Designer - ${user.name}]: Arte finalizada. Aguardando aprovação do vendedor/cliente.`,
      };

      const updated = await ApiService.updateOs(os.id, updates);
      
      const notificationMsg = `⚠️ OS ${os.codigo} em APROVAÇÃO DA ARTE (Vendedor aguarda aprovação). Solicitado por [${user.name}].`;
      setNotifications((prev) => [
        {
          id: Math.random().toString(),
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          message: notificationMsg,
          osCodigo: os.codigo,
          stage: 'Designer',
        },
        ...prev,
      ]);

      if (selectedOs?.id === os.id) setSelectedOs(updated);
      loadData();
    } catch (err: any) {
      alert(`Erro ao devolver para aprovação: ${err.message}`);
    }
  };

  // Handler: Client Approved (Advances from Designer to Impressão)
  const handleClientApprove = async (os: OrdemServico) => {
    try {
      const fluxo = os.fluxoProducao || ALL_STAGES;
      const designerIndex = fluxo.indexOf('Designer');
      const nextStage = designerIndex >= 0 && designerIndex < fluxo.length - 1 ? fluxo[designerIndex + 1] : 'Impressão';
      
      const nowStr = new Date().toLocaleString('pt-BR');
      const nowISO = new Date().toISOString();

      // Calculate tempoAprovacao
      let tempoAprovacaoMsg = '';
      if (os.aguardandoAprovacaoDesde) {
        const start = new Date(os.aguardandoAprovacaoDesde).getTime();
        const nowMs = new Date().getTime();
        if (!isNaN(start)) {
          tempoAprovacaoMsg = formatElapsedDuration(Math.max(0, nowMs - start));
        }
      }

      const records = os.setorAceitoPor || [];
      const lastDesignerIdx = records.map((x) => x.estagio).lastIndexOf('Designer');

      const updatedAcceptances = records.map((s, idx) => {
        if (idx === lastDesignerIdx) {
          return {
            ...s,
            status: 'Concluído' as const,
            concluidoEm: nowStr,
            concluidoEmISO: nowISO,
            tempoAprovacao: tempoAprovacaoMsg || s.tempoAprovacao,
          };
        }
        return s;
      });

      const isNextFinal = nextStage === 'Concluído';
      const updates: Partial<OrdemServico> = {
        aguardandoAprovacaoCliente: false,
        aguardandoAprovacaoDesde: undefined,
        aguardandoAceitacaoDesde: isNextFinal ? undefined : nowISO, // Reset acceptance timer for next stage (e.g. Impressão)
        estagioAtual: nextStage,
        setorAceitoPor: updatedAcceptances,
        status: isNextFinal ? 'Concluído' : 'Em Produção',
        observacoes: os.observacoes 
          ? `${os.observacoes}\n[Sistema - ${user.name}]: Arte APROVADA pelo vendedor/cliente. Avançado para ${nextStage}.`
          : `[Sistema - ${user.name}]: Arte APROVADA pelo vendedor/cliente. Avançado para ${nextStage}.`,
      };

      const updated = await ApiService.updateOs(os.id, updates);
      
      const notificationMsg = `✅ OS ${os.codigo}: Arte APROVADA! Avançando para [${nextStage}].`;
      setNotifications((prev) => [
        {
          id: Math.random().toString(),
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          message: notificationMsg,
          osCodigo: os.codigo,
          stage: nextStage,
        },
        ...prev,
      ]);

      if (selectedOs?.id === os.id) setSelectedOs(updated);
      loadData();
    } catch (err: any) {
      alert(`Erro ao aprovar arte: ${err.message}`);
    }
  };

  // Handler: Client Rejected (Returns to Designer for fixes, preserving full cycle history)
  const handleClientReject = async (os: OrdemServico) => {
    try {
      const nowStr = new Date().toLocaleString('pt-BR');
      const nowISO = new Date().toISOString();

      // Calculate tempoAprovacao (tempo que demorou para avaliar e reprovar)
      let tempoAprovacaoMsg = '';
      if (os.aguardandoAprovacaoDesde) {
        const start = new Date(os.aguardandoAprovacaoDesde).getTime();
        const nowMs = new Date().getTime();
        if (!isNaN(start)) {
          tempoAprovacaoMsg = formatElapsedDuration(Math.max(0, nowMs - start));
        }
      }

      const records = os.setorAceitoPor || [];
      const designerCycles = records.filter((s) => s.estagio === 'Designer').length;
      const currentCycleLabel = designerCycles <= 1 ? 'Designer (Arte Inicial)' : `Designer (Ajuste #${designerCycles - 1})`;
      const nextCycleLabel = `Designer (Ajuste #${designerCycles})`;

      const lastDesignerIdx = records.map((x) => x.estagio).lastIndexOf('Designer');

      // Archive previous cycle
      const updatedAcceptances = records.map((s, idx) => {
        if (idx === lastDesignerIdx) {
          return {
            ...s,
            descricaoEtapa: s.descricaoEtapa || currentCycleLabel,
            status: 'Concluído' as const,
            concluidoEm: nowStr,
            concluidoEmISO: nowISO,
            tempoAprovacao: tempoAprovacaoMsg || s.tempoAprovacao,
            observacao: 'Ajuste solicitado pelo vendedor/cliente',
          };
        }
        return s;
      });

      // Append new pending cycle for Designer
      updatedAcceptances.push({
        estagio: 'Designer',
        descricaoEtapa: nextCycleLabel,
        funcionario: '',
        aceitoEm: '',
        aceitoEmISO: undefined,
        tempoAceitacao: undefined,
        tempoAndamento: undefined,
        status: 'Pendente' as const,
      });

      const updates: Partial<OrdemServico> = {
        aguardandoAprovacaoCliente: false,
        aguardandoAprovacaoDesde: undefined,
        aguardandoAceitacaoDesde: nowISO, // Restart acceptance timer for Designer to accept the adjustment
        estagioAtual: 'Designer',
        setorAceitoPor: updatedAcceptances,
        status: 'Em Produção',
        observacoes: os.observacoes 
          ? `${os.observacoes}\n[Sistema - ${user.name}]: Arte REPROVADA / Solicitado ajuste pelo vendedor/cliente. Devolvido para ajustes no Designer (${nextCycleLabel}).`
          : `[Sistema - ${user.name}]: Arte REPROVADA / Solicitado ajuste pelo vendedor/cliente. Devolvido para ajustes no Designer (${nextCycleLabel}).`
      };

      const updated = await ApiService.updateOs(os.id, updates);

      // Register system notification
      NotificationService.addNotification({
        title: `Ajuste Solicitado na Arte (OS ${os.codigo})`,
        message: `A arte da OS ${os.codigo} (${os.clienteNome || 'Cliente'}) foi reprovada / devolvida para ajustes no Designer por ${user.name}.`,
        type: 'os_rollback',
        osId: os.id,
        osCodigo: os.codigo,
        clienteNome: os.clienteNome,
        operador: os.operador,
        targetRoles: ['Designer', 'DESIGNER', 'OPERADOR', 'Supervisor', 'CEO', 'Gerente Geral'],
        stage: 'Designer',
      });
      
      const notificationMsg = `❌ OS ${os.codigo}: Ajuste solicitado na arte. Retornando para ajustes no Designer.`;
      setNotifications((prev) => [
        {
          id: Math.random().toString(),
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          message: notificationMsg,
          osCodigo: os.codigo,
          stage: 'Designer',
        },
        ...prev,
      ]);

      if (selectedOs?.id === os.id) setSelectedOs(updated);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao reprovar arte: ${err.message}`);
    }
  };

  // Handler: Confirm Rollback Stage (Strictly with Developer, CEO, Gerente Geral, or Supervisor password validation)
  const handleConfirmRollback = async () => {
    if (!rollbackModalOs) return;
    if (rollbackModalOs.estagioAtual !== 'Designer') {
      setRollbackError('O recurso de voltar etapa só está disponível para o setor de Designer.');
      return;
    }
    if (!rollbackPassword.trim()) {
      setRollbackError('Por favor, digite a senha de um Superior Autorizado (Developer, CEO, Gerente Geral ou Supervisor).');
      return;
    }

    if (!canUserVoltarAcaoKanban(user.role, user.isDeveloper)) {
      setRollbackError('Acesso Negado: Apenas Developer, CEO, Gerente Geral e Supervisor podem retroceder ação.');
      return;
    }

    try {
      setRollbackLoading(true);
      setRollbackError('');

      const verifyRes = await verifySuperiorPassword(rollbackPassword.trim(), {
        loggedUsername: user.name,
        actionDescription: `Retrocesso Kanban da OS ${rollbackModalOs.codigo}`,
      });

      if (!verifyRes.valid) {
        setRollbackError(
          verifyRes.error ||
            'Senha incorreta ou sem permissão de Superior (Developer, CEO, Gerente Geral ou Supervisor) para autorizar o retrocesso da etapa.'
        );
        setRollbackLoading(false);
        return;
      }

      const prevStage = getPreviousStage(rollbackModalOs);
      if (!prevStage) {
        setRollbackError('Não há estágio anterior para esta OS.');
        setRollbackLoading(false);
        return;
      }

      const currentStage = rollbackModalOs.estagioAtual;
      const nowISO = new Date().toLocaleString('pt-BR');

      // Adjust acceptances:
      // Mark current stage status as Pendente and clear completion
      // Mark previous stage status as Em Andamento and clear completion timestamp
      const nowISOStr = new Date().toISOString();
      const updatedAcceptances = (rollbackModalOs.setorAceitoPor || []).map((s) => {
        if (s.estagio === currentStage) {
          return { ...s, status: 'Pendente' as const, concluidoEm: undefined };
        }
        if (s.estagio === prevStage) {
          return { ...s, status: 'Em Andamento' as const, concluidoEm: undefined, aceitoEmISO: nowISOStr };
        }
        return s;
      });

      const obsEntry = `\n[Retrocesso Kanban - ${nowISO} por ${user.name}]: Avanço retrocedido de [${currentStage}] para [${prevStage}].`;
      const newObservacoes = rollbackModalOs.observacoes
        ? `${rollbackModalOs.observacoes}${obsEntry}`
        : obsEntry.trim();

      const updates: Partial<OrdemServico> = {
        estagioAtual: prevStage,
        status: 'Em Produção',
        setorAceitoPor: updatedAcceptances,
        observacoes: newObservacoes,
      };

      if (prevStage === 'Sistema') {
        updates.aguardandoAprovacaoCliente = true;
        updates.aguardandoAprovacaoDesde = nowISOStr;
      }

      const updated = await ApiService.updateOs(rollbackModalOs.id, updates);

      // Register real-time notification
      NotificationService.notifyOsRollback(rollbackModalOs, currentStage, prevStage, user.name);
      const notificationMsg = `⏪ OS ${rollbackModalOs.codigo} RETROCEDIDA de [${currentStage}] ➔ [${prevStage}] por [${user.name}].`;
      setNotifications((prev) => [
        {
          id: Math.random().toString(),
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          message: notificationMsg,
          osCodigo: rollbackModalOs.codigo,
          stage: prevStage,
        },
        ...prev,
      ]);

      if (selectedOs?.id === rollbackModalOs.id) {
        setSelectedOs(updated);
      }

      setRollbackModalOs(null);
      setRollbackPassword('');
      loadData();
    } catch (err: any) {
      setRollbackError(`Erro ao processar retrocesso: ${err.message || 'Falha de comunicação'}`);
    } finally {
      setRollbackLoading(false);
    }
  };

  // Filter OS list by search term
  const filteredOsList = osList.filter((os) => {
    // Exclude Orçamentos from production Kanban
    if ((os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento || os.codigo?.startsWith('ORC')) {
      return false;
    }

    // CLÁUSULA DE ENTREGA:
    // A OS fica no fluxo de produção até que o operador defina como "entregue".
    // Daí então a OS sai do "fluxo de produção" e é listada em Entrega & Devolução.
    if (os.entregue === true && !os.retornouParaProducao) {
      return false;
    }

    // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
    // EM "fluxo de produção" / "Aguardando Entrada no Fluxo de Produção" (estágio 'Sistema'):
    // O vendedor verá apenas seus serviços sendo exibidos.
    if (os.estagioAtual === 'Sistema' && isLoggedUserSeller) {
      if (!isOsOfLoggedSeller(os)) {
        return false;
      }
    }

    const matchesSearch =
      os.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      os.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (os.clienteCpfCnpj && os.clienteCpfCnpj.includes(searchTerm));

    if (!matchesSearch) return false;

    if (filterOnlyMyRole) {
      return canUserOperateStage(os.estagioAtual, os);
    }
    return true;
  });

  // Strictly checks if current user is authorized to Approve or Reject Art (Salesperson / Supervisory / Assigned Seller, NOT Designer)
  const canUserApproveOrRejectArt = (os?: OrdemServico | null): boolean => {
    if (!os) return false;
    if (user.isDeveloper) return true;
    const normRole = normalizeRoleName(user.role);
    if (['CEO', 'Gerente Geral', 'Supervisor'].includes(normRole) || ['CEO', 'Gerente Geral', 'Supervisor'].includes(user.role)) {
      return true;
    }
    // Designers are explicitly NOT allowed to approve or reject art
    if (normRole === 'Designer' || user.role === 'Designer') {
      return false;
    }
    if (isRoleAuthorizedForSales(user.role, user.isDeveloper)) {
      return true;
    }
    if (['Vendedor', 'Recepção', 'ADMINISTRATIVO', 'Administrativo'].includes(normRole)) {
      return true;
    }
    if (user.name && (user.name === os.operador || user.name === os.vendedorNome || user.name === os.vendedor)) {
      return true;
    }
    return false;
  };

  const canApproveOrRejectForSelected = canUserApproveOrRejectArt(selectedOs);

  return (
    <div className="space-y-6 relative">
      {/* 0. FLOATING REAL-TIME RED ALERTS - COMPACT & RESILIENT FOR MULTIPLE SERVICES */}
      {stageAlerts.length > 0 && (
        <div className="fixed top-16 right-3 sm:right-6 z-50 flex flex-col gap-2 max-w-[340px] sm:max-w-[360px] w-[calc(100%-1.5rem)] pointer-events-auto">
          {/* Header indicator when multiple alerts exist */}
          {stageAlerts.length > 1 && (
            <div className="flex items-center justify-between bg-rose-950/90 text-rose-200 text-[10px] font-bold px-3 py-1 rounded-xl shadow-md backdrop-blur-xs border border-rose-800/80">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                <span>{stageAlerts.length} novos serviços na fila</span>
              </div>
              <button
                type="button"
                onClick={() => setStageAlerts([])}
                className="text-rose-300 hover:text-white underline cursor-pointer text-[9.5px]"
              >
                Dispensar todos
              </button>
            </div>
          )}

          {/* Render top 3 alerts */}
          {stageAlerts.slice(0, 3).map((alert) => {
            const now = Date.now();
            const remainingMs = Math.max(0, alert.expiresAt - now);
            const progressPct = Math.min(100, Math.max(0, (remainingMs / 5000) * 100));

            return (
              <div
                key={alert.id}
                className="bg-rose-600 border border-rose-700 text-white rounded-2xl p-2.5 shadow-xl space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200 relative overflow-hidden group"
              >
                {/* 5-second countdown progress bar */}
                <div className="w-full bg-rose-950/40 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-white h-full rounded-full transition-all duration-100 ease-linear"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Main Compact Row */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="bg-amber-300 text-amber-950 font-black text-[10px] px-1.5 py-0.5 rounded border border-amber-400 shrink-0">
                      {alert.osCodigo}
                    </span>
                    <span className="text-xs font-black text-white uppercase truncate" title={alert.clienteNome}>
                      {alert.clienteNome}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-bold text-rose-200 font-mono">
                      {(remainingMs / 1000).toFixed(0)}s
                    </span>
                    <button
                      type="button"
                      onClick={() => setStageAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                      className="p-0.5 text-white/70 hover:text-white rounded hover:bg-white/10 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sub-row with Sector & Quick Accept */}
                <div className="flex items-center justify-between gap-1.5 pt-0.5 border-t border-rose-500/40">
                  <div className="text-[10px] text-rose-100 font-bold truncate">
                    <span className="bg-rose-700/80 px-1.5 py-0.5 rounded text-[9.5px] uppercase mr-1 border border-rose-500/50">
                      {alert.stage}
                    </span>
                    <span>R$ {Number(alert.valorFinal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedOs(alert.os)}
                      className="text-[10.5px] font-bold text-rose-100 hover:text-white underline cursor-pointer px-1"
                    >
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAcceptStage(alert.os, alert.stage)}
                      className="px-2.5 py-1 bg-white hover:bg-rose-50 active:scale-95 text-rose-700 font-black text-[10.5px] rounded-lg flex items-center gap-1 shadow-xs cursor-pointer transition-all whitespace-nowrap"
                    >
                      <Check className="w-3 h-3 text-rose-700" />
                      <span>Aceitar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Bottom badge if more than 3 alerts are in queue */}
          {stageAlerts.length > 3 && (
            <div className="text-center text-[10px] font-extrabold text-rose-700 bg-rose-100 border border-rose-300 py-1 px-2 rounded-xl shadow-2xs">
              + {stageAlerts.length - 3} outro(s) serviço(s) aguardando aceitação...
            </div>
          )}
        </div>
      )}

      {/* CASO selectedOs ESTEJA SELECIONADO: EXIBE EM TELA CHEIA MANTENDO O MENU LATERAL E A BARRA SUPERIOR */}
      {selectedOs ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col w-full animate-in fade-in duration-150">
          {/* CABEÇALHO DA OS EM TELA CHEIA */}
          <div className="bg-slate-900 text-white px-5 py-4 sm:px-6 sm:py-4.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0 border-b border-slate-800 shadow-sm">
            <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
              <div className="px-3.5 py-2 bg-blue-600 text-white rounded-xl flex items-center gap-2 font-black text-xs uppercase tracking-wider shrink-0 shadow-xs">
                <Clock className="w-4 h-4" />
                <span>HISTÓRICO DE PRODUÇÃO</span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-xl font-black tracking-tight text-white">{selectedOs.codigo}</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${
                      selectedOs.paymentStatus === 'pago'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    {selectedOs.paymentStatus === 'pago' ? '✓ PAGO' : '⏳ PENDENTE DE PAGAMENTO'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-1 truncate">
                  Cliente: <strong className="text-white font-semibold">{selectedOs.clienteNome}</strong> • Vendedor: {selectedOs.operador}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
              {selectedOs.estagioAtual === 'Designer' && getPreviousStage(selectedOs) && canUserVoltarAcao && (
                <button
                  type="button"
                  onClick={() => handleRequestRollback(selectedOs)}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Retroceder etapa atual caso o avanço tenha sido feito indevidamente (Requer Senha)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Voltar Ação</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedOs(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs border border-slate-700 hover:border-slate-600"
                title="Voltar ao Quadro Kanban"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao Quadro</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedOs(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                title="Fechar e retornar ao Quadro Kanban"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* CORPO DA OS EM TELA CHEIA */}
          <div className="p-5 sm:p-6 lg:p-8 space-y-6 flex-1">
            {/* FLUXO DE PRODUÇÃO STEPPER TIMELINE */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Andamento em Tempo Real do Fluxo de Produção</span>
                </h4>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                  Etapa Atual: {selectedOs.estagioAtual}
                </span>
              </div>

              {/* STEPPER HORIZONTAL / GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2 pt-1">
                {(selectedOs.fluxoProducao || ALL_STAGES).map((stg, idx) => {
                  const isCurrent = selectedOs.estagioAtual === stg;
                  const acceptance = getStageAcceptanceInfo(selectedOs, stg);
                  const isDone = acceptance?.status === 'Concluído' || (stg === 'Sistema' && selectedOs.estagioAtual !== 'Sistema');
                  const isPendingAccept = isCurrent && !acceptance;

                  return (
                    <div
                      key={stg}
                      className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all ${
                        isCurrent
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400/50'
                          : isDone
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                          : 'bg-white text-slate-400 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-wider mb-1">
                        {idx + 1}. {stg}
                      </div>
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mb-1" />
                      ) : isCurrent ? (
                        <Clock className="w-4 h-4 text-white animate-pulse mb-1" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-slate-300 mb-1" />
                      )}

                      <span className="text-[9px] font-bold truncate w-full">
                        {isDone
                          ? `✓ Concluído`
                          : (stg === 'Designer' && selectedOs.aguardandoAprovacaoCliente)
                          ? '⏳ Em Aprovação'
                          : isCurrent
                          ? isPendingAccept
                            ? '⏳ Pendente'
                            : `👤 ${acceptance?.funcionario}`
                          : 'Aguardando'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* APPROVAL PANEL IN MODAL (WHEN AWAITING SELLER/CLIENT APPROVAL) */}
            {selectedOs.aguardandoAprovacaoCliente && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                    <span>Em Aprovação • Vendedor aguarda aprovação da arte</span>
                  </h4>
                  <span className="text-[11px] font-bold text-amber-900 bg-amber-200/80 px-3 py-1 rounded-full border border-amber-300">
                    Tempo em aprovação: {selectedOs.aguardandoAprovacaoDesde ? <ElapsedTimer startDate={selectedOs.aguardandoAprovacaoDesde} /> : '00:00:00'}
                  </span>
                </div>
                <p className="text-xs text-amber-900 font-medium leading-relaxed">
                  A arte foi finalizada pelo Designer e o status retornou para o início da esteira aguardando a aprovação do vendedor/cliente antes de avançar para a Impressão.
                </p>
                {canApproveOrRejectForSelected ? (
                  <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleClientReject(selectedOs)}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                      title="Solicitar ajuste na arte (Retorna para o Designer)"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Ajustar Arte (Reprovar)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClientApprove(selectedOs)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                      title="Aprovar arte do cliente (Avança diretamente para a próxima etapa)"
                    >
                      <Check className="w-4 h-4" />
                      <span>Aprovar Arte e Avançar</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 flex items-center gap-2 text-amber-900 font-bold text-xs bg-amber-100/90 border border-amber-300 p-2.5 rounded-xl">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Arte enviada para validação. Aguardando decisão do vendedor (Aprovar para Impressão ou Solicitar Ajuste).</span>
                  </div>
                )}
              </div>
            )}

            {/* CURRENT STAGE ACTION PANEL */}
            {selectedOs.estagioAtual !== 'Concluído' && !selectedOs.aguardandoAprovacaoCliente && (
              <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Painel da Etapa Atual: [{selectedOs.estagioAtual}]</span>
                  </h4>
                  {!canUserOperateStage(selectedOs.estagioAtual, selectedOs) && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg">
                      {selectedOs.estagioAtual === 'Sistema'
                        ? `⚠️ Apenas o vendedor responsável (${selectedOs.operador || 'Vendedor'}) pode avançar esta OS`
                        : `⚠️ Requer perfil ou permissão de [${selectedOs.estagioAtual}]`}
                    </span>
                  )}
                </div>

                {/* IF PENDING ACCEPTANCE */}
                {!isStageAccepted(selectedOs, selectedOs.estagioAtual) ? (
                  <div className="bg-white p-4 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-slate-900">
                        Aguardando Aceite do Setor [{selectedOs.estagioAtual}]
                      </h5>
                      <p className="text-[11px] text-slate-500">
                        O responsável do setor deve aceitar o serviço para iniciar a produção e se vincular à OS.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 animate-pulse text-amber-600" />
                          Tempo aguardando aceite: <ElapsedTimer startDate={selectedOs.aguardandoAceitacaoDesde || selectedOs.createdAt} />
                        </span>
                      </div>
                    </div>
                    {canUserOperateStage(selectedOs.estagioAtual, selectedOs) && (
                      <button
                        onClick={() => handleAcceptStage(selectedOs, selectedOs.estagioAtual)}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md shrink-0 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Aceitar Serviço Agora</span>
                      </button>
                    )}
                  </div>
                ) : (
                  /* IF ALREADY ACCEPTED - ADVANCE PANEL */
                  <div className="bg-white p-4 rounded-xl border border-blue-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Responsável</span>
                        <span className="text-xs font-black text-blue-700 truncate block">
                          {getStageAcceptanceInfo(selectedOs, selectedOs.estagioAtual)?.funcionario || '---'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aceito em</span>
                        <span className="text-[11px] font-semibold text-slate-700 truncate block">
                          {getStageAcceptanceInfo(selectedOs, selectedOs.estagioAtual)?.aceitoEm || '---'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-xl">
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Demora p/ Aceite (Fixo)</span>
                        <span className="text-xs font-black text-amber-700 font-mono block">
                          {getStageAcceptanceInfo(selectedOs, selectedOs.estagioAtual)?.tempoAceitacao || '---'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                        <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Tempo em Andamento</span>
                        <span className="text-xs font-black text-blue-700 font-mono block">
                          <ElapsedTimer startDate={getStageAcceptanceInfo(selectedOs, selectedOs.estagioAtual)?.aceitoEmISO} />
                        </span>
                      </div>
                    </div>

                    {/* MODALIDADE DE EXPEDIÇÃO SELETOR (EXPEDIÇÃO) */}
                    {selectedOs.estagioAtual === 'Expedição' && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <span>Modalidade de Expedição (Envio / Entrega)</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {(['NORMAL', 'EXPRESSO EXCURSÃO', 'EXPRESSO DO DIA'] as TipoExpedicao[]).map((tipo) => {
                            const isSelected = (selectedOs.tipoExpedicao || 'NORMAL') === tipo;
                            let themeBtn = 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500';
                            let badgeDot = 'bg-blue-600';
                            if (tipo === 'EXPRESSO EXCURSÃO') {
                              themeBtn = 'border-red-600 bg-red-50 text-red-950 ring-2 ring-red-500';
                              badgeDot = 'bg-red-600';
                            } else if (tipo === 'EXPRESSO DO DIA') {
                              themeBtn = 'border-[#FFA500] bg-orange-50 text-orange-950 ring-2 ring-[#FFA500]';
                              badgeDot = 'bg-[#FFA500]';
                            }

                            return (
                              <button
                                key={tipo}
                                type="button"
                                onClick={() => handleUpdateTipoExpedicao(selectedOs.id, tipo)}
                                className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                                  isSelected ? themeBtn : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-3 h-3 rounded-full shrink-0 ${badgeDot}`} />
                                  <span className="truncate">{tipo}</span>
                                </div>
                                {isSelected && <Check className="w-4 h-4 shrink-0 text-emerald-600" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ADD PRODUCTION NOTE */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Adicionar Observação de Produção nesta etapa (opcional):
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Arte verificada e ajustada. Material enviado para o setor..."
                        value={stageNoteInput}
                        onChange={(e) => setStageNoteInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* ADVANCE & ROLLBACK BUTTONS */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                      {getPreviousStage(selectedOs) && canUserVoltarAcao && (
                        <button
                          onClick={() => handleRequestRollback(selectedOs)}
                          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                          title="Voltar etapa caso o avanço tenha sido feito indevidamente (Requer Senha)"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Voltar Ação (Retroceder)</span>
                        </button>
                      )}
                      {canUserOperateStage(selectedOs.estagioAtual, selectedOs) && (
                        <button
                          onClick={() => handleAdvanceStage(selectedOs)}
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md cursor-pointer ml-auto"
                        >
                          <ArrowRight className="w-4 h-4" />
                          <span>{selectedOs.estagioAtual === 'Designer' ? 'Enviar Arte p/ Aprovação' : 'Concluir Etapa e Avançar'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* PAINEL DE CONFERÊNCIA PARALELA (REGRA 8) */}
                {selectedOs.estagioAtual !== 'Conferência' &&
                  selectedOs.estagioAtual !== 'Sistema' &&
                  (selectedOs.fluxoProducao || ALL_STAGES).includes('Conferência') && (
                    <div className="bg-purple-50/90 border border-purple-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                          <span>Conferência de OS (Fluxo Paralelo)</span>
                        </h4>
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                            selectedOs.conferido
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-purple-100 text-purple-800 border-purple-200'
                          }`}
                        >
                          {selectedOs.conferido ? '✓ Aprovada e Liberada' : '⏳ Pendente de Aprovação'}
                        </span>
                      </div>

                      {selectedOs.conferido ? (
                        <div className="bg-white p-3 rounded-xl border border-purple-100 flex items-center gap-2 text-xs font-bold text-emerald-800">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Conferência Aprovada e Liberada por [{selectedOs.conferenteNome || 'Conferência'}] em{' '}
                            {selectedOs.dataConferencia || ''}.
                          </span>
                        </div>
                      ) : (
                        <div className="bg-white p-3 rounded-xl border border-purple-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-800">
                              A OS está sendo processada no setor [{selectedOs.estagioAtual}] e disponível para conferência paralelamente.
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Aprovar a conferência não altera o setor do chão de fábrica ({selectedOs.estagioAtual}), liberando a auditoria da OS.
                            </p>
                          </div>
                          {canUserOperateStage('Conferência', selectedOs) && (
                            <div className="flex items-center gap-2 shrink-0">
                              {!isStageAccepted(selectedOs, 'Conferência') ? (
                                <button
                                  type="button"
                                  onClick={() => handleAcceptStage(selectedOs, 'Conferência')}
                                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Aceitar Conferência</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStage(selectedOs, 'Conferência')}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Aprovar e Liberar OS</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                {/* NOTIFICAÇÕES DESTA OS EM TEMPO REAL DENTRO DO PAINEL */}
                {notifications.filter((n) => !n.osCodigo || n.osCodigo === selectedOs.codigo || n.osCodigo.includes(selectedOs.codigo)).length > 0 && (
                  <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-900 font-extrabold text-[11px]">
                        <Bell className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                        <span>Notificações de Aceitação / Avanço em Tempo Real</span>
                      </div>
                    </div>
                    <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                      {notifications
                        .filter((n) => !n.osCodigo || n.osCodigo === selectedOs.codigo || n.osCodigo.includes(selectedOs.codigo))
                        .map((notif) => (
                          <div key={notif.id} className="text-xs font-bold text-slate-800 bg-white p-2 rounded-lg border border-amber-100 flex items-center justify-between gap-2 shadow-xs">
                            <span>{notif.message}</span>
                            <span className="text-[10px] font-semibold text-slate-400 shrink-0">{notif.timestamp}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HISTÓRICO FIXO DE TEMPOS DA ESTEIRA DE PRODUÇÃO */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-700" />
                  <span>Histórico Fixo de Tempos da Esteira de Produção</span>
                </h4>
                <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  Demora p/ Aceite, Andamento & Espera de Aprovação
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-white">
                      <th className="py-2.5 px-3">Etapa / Setor</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Responsável</th>
                      <th className="py-2.5 px-3">Demora p/ Aceite</th>
                      <th className="py-2.5 px-3">Tempo de Andamento</th>
                      <th className="py-2.5 px-3">Espera p/ Aprovação</th>
                      <th className="py-2.5 px-3">Aceito em</th>
                      <th className="py-2.5 px-3">Concluído em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 bg-white">
                    {(() => {
                      const fluxo = selectedOs.fluxoProducao || ALL_STAGES;
                      const records = selectedOs.setorAceitoPor || [];

                      const rows: {
                        key: string;
                        etapaNome: string;
                        estagio: ProductionStage;
                        isCurrent: boolean;
                        isDone: boolean;
                        isAguardandoAprovacao: boolean;
                        isPendingAccept: boolean;
                        funcionario?: string;
                        tempoAceitacao?: string;
                        tempoAndamento?: string;
                        tempoAprovacao?: string;
                        aceitoEm?: string;
                        aceitoEmISO?: string;
                        concluidoEm?: string;
                        totalDuration?: string;
                        observacao?: string;
                      }[] = [];

                      // 1. Sempre adicionar todos os registros históricos (inclui edições, avanços, retrocessos)
                      records.forEach((rec, idx) => {
                        const isCurrent = selectedOs.estagioAtual === rec.estagio && (idx === records.length - 1 || rec.status === 'Em Andamento' || rec.status === 'Pendente');
                        const isDone = rec.status === 'Concluído' || (!isCurrent && !!rec.concluidoEm);
                        const isAguardandoAprovacao = isCurrent && !!selectedOs.aguardandoAprovacaoCliente;
                        const isPendingAccept = isCurrent && rec.status === 'Pendente' && !isAguardandoAprovacao;
                        const totalDuration = calculateTotalStageDuration(rec.tempoAceitacao, rec.tempoAndamento, rec.tempoAprovacao);

                        rows.push({
                          key: `rec-${idx}-${rec.estagio}`,
                          etapaNome: rec.descricaoEtapa || rec.estagio,
                          estagio: rec.estagio,
                          isCurrent,
                          isDone,
                          isAguardandoAprovacao,
                          isPendingAccept,
                          funcionario: rec.funcionario,
                          tempoAceitacao: rec.tempoAceitacao,
                          tempoAndamento: rec.tempoAndamento,
                          tempoAprovacao: rec.tempoAprovacao,
                          aceitoEm: rec.aceitoEm,
                          aceitoEmISO: rec.aceitoEmISO,
                          concluidoEm: rec.concluidoEm,
                          totalDuration,
                          observacao: rec.observacao,
                        });
                      });

                      // 2. Verificar se o estágio atual precisa ser adicionado como pendente
                      // Isso ocorre se não houver registros, ou se o último registro for de uma etapa anterior,
                      // ou se o último registro da mesma etapa já foi concluído (ex: OS voltou ou foi editada).
                      const lastRecord = records.length > 0 ? records[records.length - 1] : null;
                      let hasCurrentStageActive = false;
                      
                      if (lastRecord && lastRecord.estagio === selectedOs.estagioAtual && lastRecord.status !== 'Concluído') {
                        hasCurrentStageActive = true;
                      }

                      if (!hasCurrentStageActive && selectedOs.estagioAtual !== 'Concluído') {
                        rows.push({
                          key: `current-pending-${selectedOs.estagioAtual}`,
                          etapaNome: selectedOs.estagioAtual,
                          estagio: selectedOs.estagioAtual,
                          isCurrent: true,
                          isDone: false,
                          isAguardandoAprovacao: !!selectedOs.aguardandoAprovacaoCliente,
                          isPendingAccept: !selectedOs.aguardandoAprovacaoCliente,
                          concluidoEm: selectedOs.estagioAtual === 'Sistema' && selectedOs.createdAt ? new Date(selectedOs.createdAt).toLocaleString('pt-BR') : undefined,
                        });
                      }

                      // 3. Adicionar as próximas etapas do fluxo (upcoming stages)
                      const currentStageIndex = fluxo.indexOf(selectedOs.estagioAtual);
                      if (currentStageIndex >= 0) {
                        for (let i = currentStageIndex + 1; i < fluxo.length; i++) {
                          const upcomingStage = fluxo[i];
                          if (upcomingStage !== 'Concluído') {
                            rows.push({
                              key: `upcoming-${upcomingStage}-${i}`,
                              etapaNome: upcomingStage,
                              estagio: upcomingStage,
                              isCurrent: false,
                              isDone: false,
                              isAguardandoAprovacao: false,
                              isPendingAccept: false,
                            });
                          }
                        }
                      }

                      return rows.map((row, rowIdx) => {
                        return (
                          <tr key={row.key} className={`hover:bg-slate-50/80 transition-colors ${row.isCurrent ? 'bg-blue-50/40 font-semibold' : ''}`}>
                            <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-300 text-[9px] font-black flex items-center justify-center text-slate-600">
                                {rowIdx + 1}
                              </span>
                              <div>
                                <span>{row.etapaNome}</span>
                                {row.observacao && (
                                  <span className="block text-[9px] text-red-500 font-semibold">{row.observacao}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              {row.isDone ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Concluído
                                </span>
                              ) : row.isCurrent ? (
                                row.isAguardandoAprovacao ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                                    Em Aprovação
                                  </span>
                                ) : row.isPendingAccept ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-300">
                                    <Clock className="w-3 h-3 text-red-600 animate-pulse" />
                                    Aguardando Aceite
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                    <Clock className="w-3 h-3 text-blue-600 animate-pulse" />
                                    Em Andamento
                                  </span>
                                )
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400">Aguardando</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-medium">
                              {row.funcionario ? (
                                <span className="font-bold text-slate-800">{row.funcionario}</span>
                              ) : (
                                <span className="text-slate-400">---</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {row.tempoAceitacao ? (
                                <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                                  {row.tempoAceitacao}
                                </span>
                              ) : row.isCurrent && row.isPendingAccept ? (
                                <span className="text-red-700 font-bold bg-red-100/80 px-2 py-0.5 rounded border border-red-300 inline-flex items-center gap-1 animate-pulse">
                                  ⏳ <ElapsedTimer startDate={selectedOs.aguardandoAceitacaoDesde || selectedOs.createdAt} />
                                </span>
                              ) : (
                                <span className="text-slate-300">---</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {row.tempoAndamento ? (
                                <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
                                  {row.tempoAndamento}
                                </span>
                              ) : row.isCurrent && row.aceitoEmISO && !row.isDone ? (
                                <span className="text-blue-700 font-bold bg-blue-100/70 px-2 py-0.5 rounded border border-blue-300 inline-flex items-center gap-1 animate-pulse">
                                  ⏱️ <ElapsedTimer startDate={row.aceitoEmISO} />
                                </span>
                              ) : (
                                <span className="text-slate-300">---</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {row.tempoAprovacao ? (
                                <span 
                                  className="text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200 inline-block"
                                  title="Tempo de espera pela aprovação da arte pelo vendedor/cliente"
                                >
                                  {row.tempoAprovacao}
                                </span>
                              ) : row.isCurrent && row.isAguardandoAprovacao ? (
                                <span 
                                  className="text-amber-700 font-bold bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 inline-flex items-center gap-1 animate-pulse"
                                  title="Aguardando aprovação do vendedor/cliente neste momento"
                                >
                                  ⏳ <ElapsedTimer startDate={selectedOs.aguardandoAprovacaoDesde} />
                                </span>
                              ) : (
                                <span className="text-slate-300">---</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-500">
                              {row.aceitoEm || '---'}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-700 font-medium">
                              {row.isDone ? (
                                <div className="flex flex-col gap-0.5">
                                  {row.totalDuration && (
                                    <span 
                                      className="font-mono text-[11px] font-black text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 inline-block w-fit cursor-help"
                                      title={`Soma Total da Etapa: Aceite (${row.tempoAceitacao || '00:00:00'}) + Andamento (${row.tempoAndamento || '00:00:00'})${row.tempoAprovacao ? ` + Espera de Aprovação (${row.tempoAprovacao})` : ''} = ${row.totalDuration}`}
                                    >
                                      ⏱️ Total: {row.totalDuration}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-500 font-semibold">
                                    {row.concluidoEm || (row.estagio === 'Sistema' ? (selectedOs.createdAt ? new Date(selectedOs.createdAt).toLocaleString('pt-BR') : '---') : '---')}
                                  </span>
                                </div>
                              ) : row.isCurrent ? (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
                                  Em andamento...
                                </span>
                              ) : (
                                <span className="text-slate-300">---</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* COMPLETED STAGE REOPEN / ROLLBACK PANEL */}
            {selectedOs.estagioAtual === 'Concluído' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-emerald-900 uppercase">Ordem de Serviço Concluída</h4>
                    <p className="text-[11px] text-emerald-700">Esta OS finalizou todos os estágios de produção com sucesso.</p>
                  </div>
                </div>
                {getPreviousStage(selectedOs) && canUserVoltarAcao && (
                  <button
                    onClick={() => handleRequestRollback(selectedOs)}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md shrink-0 cursor-pointer"
                    title="Voltar um avanço que tenha sido feito indevidamente (Requer Senha)"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Voltar Ação (Reabrir Produção)</span>
                  </button>
                )}
              </div>
            )}

            {/* PRODUCTS & ITEMS TABLE */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Itens da Ordem de Serviço
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Código / Descrição</th>
                      <th className="p-3 text-center">Unid.</th>
                      <th className="p-3 text-center">Qtd.</th>
                      <th className="p-3 text-right">Valor Unit.</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {selectedOs.itens && selectedOs.itens.length > 0 ? (
                      selectedOs.itens.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold">{item.descricao}</td>
                          <td className="p-3 text-center text-slate-500">{item.unidade}</td>
                          <td className="p-3 text-center font-bold">{item.quantidade}</td>
                          <td className="p-3 text-right">R$ {item.valorUnitario.toFixed(2)}</td>
                          <td className="p-3 text-right font-extrabold text-slate-900">
                            R$ {item.total.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                          Nenhum item adicionado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAYMENT & FINANCIAL SUMMARY */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs font-bold text-slate-800">
                <span className="block text-[10px] text-slate-500 uppercase">Forma de Pagamento Registrada</span>
                <div className="text-slate-900 font-black text-sm">
                  {selectedOs.formaPagamento || (selectedOs.paymentStatus === 'pago' ? 'PAGO NO CAIXA PDV' : 'PENDENTE DE PAGAMENTO')}
                </div>
                {selectedOs.valorEntrada !== undefined && (
                  <div className="text-emerald-700">
                    Entrada: R$ {selectedOs.valorEntrada.toFixed(2)} ({selectedOs.formaPagamentoEntrada || 'PIX/Dinheiro'})
                  </div>
                )}
                {selectedOs.valorRestante !== undefined && (
                  <div className="text-amber-700">
                    Restante Devedor: R$ {selectedOs.valorRestante.toFixed(2)}
                  </div>
                )}
                {selectedOs.parcelasCartao && selectedOs.parcelasCartao > 1 && (
                  <div className="text-blue-700">
                    Parcelas: {selectedOs.parcelasCartao}x de R$ {(selectedOs.valorFinal / selectedOs.parcelasCartao).toFixed(2)}
                  </div>
                )}
              </div>

              <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-1 text-xs font-bold flex flex-col justify-between">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>R$ {selectedOs.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Desconto:</span>
                  <span>- R$ {selectedOs.desconto.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black border-t border-slate-800 pt-1.5 text-white">
                  <span>VALOR TOTAL:</span>
                  <span className="text-emerald-400">R$ {selectedOs.valorFinal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* ANEXOS & ARQUIVOS DA OS / PARA IMPRESSÃO */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-purple-600" />
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                    Anexos e Artes da OS ({selectedOs.anexos?.length || 0})
                  </h4>
                </div>
                {selectedOs.anexos && selectedOs.anexos.length > 0 && (
                  <span className="text-[11px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-lg">
                    Disponível para Visualização & Download pelo Impressor
                  </span>
                )}
              </div>

              {!selectedOs.anexos || selectedOs.anexos.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 italic">
                  Nenhum arquivo ou arte anexada a esta Ordem de Serviço.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 1. SEPARADOR / DESTAQUE: ARQUIVOS PARA IMPRESSÃO (ALTA RESOLUÇÃO) */}
                  {selectedOs.anexos.some((a) => a.type === 'PARA_IMPRESSAO' || a.isParaImpressao || (a.label || '').toLowerCase().includes('impressão') || (a.label || '').toLowerCase().includes('impressao')) && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-950 border border-purple-300 text-xs font-black uppercase tracking-wide flex items-center gap-1.5 shadow-2xs">
                            <Printer className="w-3.5 h-3.5 text-purple-700" />
                            Arquivos em Alta Resolução Para Impressão
                          </span>
                        </div>
                        <span className="text-[11px] text-purple-800 font-semibold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          Não impresso na folha física da OS • Arquivo original para o impressor
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {selectedOs.anexos
                          .filter((a) => a.type === 'PARA_IMPRESSAO' || a.isParaImpressao || (a.label || '').toLowerCase().includes('impressão') || (a.label || '').toLowerCase().includes('impressao'))
                          .map((att, aIdx) => (
                            <div
                              key={att.id || aIdx}
                              className="bg-purple-50/60 border-2 border-purple-300 rounded-xl p-3 flex flex-col justify-between space-y-2.5 shadow-2xs hover:border-purple-500 hover:bg-purple-50 transition-all"
                            >
                              <div className="flex items-start gap-2.5">
                                {att.fileUrl && (att.fileUrl.startsWith('data:image') || att.fileUrl.startsWith('http') || att.fileUrl.startsWith('blob')) ? (
                                  <img
                                    src={att.fileUrl}
                                    alt={att.fileName || 'Arte p/ impressão'}
                                    className="w-14 h-14 rounded-lg object-contain bg-white border border-purple-200 p-0.5 shrink-0 shadow-2xs"
                                  />
                                ) : (
                                  <div className="w-14 h-14 rounded-lg bg-purple-200/80 flex items-center justify-center text-purple-800 shrink-0 border border-purple-300 shadow-2xs">
                                    <Printer className="w-6 h-6" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-black text-purple-950 truncate" title={att.fileName || att.label}>
                                    {att.fileName || att.label || `Arte de Impressão #${aIdx + 1}`}
                                  </p>
                                  <div className="text-[10px] text-purple-700 font-bold mt-1 space-y-0.5">
                                    <div>{att.fileSize ? `Tamanho: ${att.fileSize}` : 'Alta Fidelidade (Original)'}</div>
                                    {att.uploadedAt && <div>Anexado: {new Date(att.uploadedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 pt-1.5 border-t border-purple-200">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewImageModalUrl(att.fileUrl);
                                    setPreviewImageName(att.fileName || 'Arte para Impressão');
                                  }}
                                  className="flex-1 px-2.5 py-1.5 bg-white hover:bg-purple-100 text-purple-900 border border-purple-300 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                  title="Visualizar arte em tamanho ampliado"
                                >
                                  <Eye className="w-3.5 h-3.5 text-purple-700" />
                                  <span>Visualizar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttachment(att)}
                                  className="flex-1 px-2.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                  title="Baixar arquivo original sem compressão para impressão"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Baixar</span>
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* 2. DEMAIS ARTES E LAYOUTS REGULARES (SE HOUVER) */}
                  {selectedOs.anexos.some((a) => !(a.type === 'PARA_IMPRESSAO' || a.isParaImpressao || (a.label || '').toLowerCase().includes('impressão') || (a.label || '').toLowerCase().includes('impressao'))) && (
                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block">
                        Outras Artes & Layouts Anexados
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {selectedOs.anexos
                          .filter((a) => !(a.type === 'PARA_IMPRESSAO' || a.isParaImpressao || (a.label || '').toLowerCase().includes('impressão') || (a.label || '').toLowerCase().includes('impressao')))
                          .map((att, aIdx) => (
                            <div
                              key={att.id || aIdx}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between space-y-2 shadow-2xs hover:border-slate-300 transition-all"
                            >
                              <div className="flex items-start gap-2.5">
                                {att.fileUrl ? (
                                  <img
                                    src={att.fileUrl}
                                    alt={att.fileName || 'Arte'}
                                    className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                                    <Paperclip className="w-5 h-5" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-800 truncate" title={att.fileName || att.label}>
                                    {att.fileName || att.label || `Arte #${aIdx + 1}`}
                                  </p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {att.fileSize || 'Layout Anexo'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewImageModalUrl(att.fileUrl);
                                    setPreviewImageName(att.fileName || 'Arte OS');
                                  }}
                                  className="flex-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                  title="Visualizar arte"
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Visualizar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttachment(att)}
                                  className="flex-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                  title="Baixar arquivo"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Baixar</span>
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DETALHES DE PRODUÇÃO / INSTRUÇÕES & HORÁRIOS DAS ETAPAS REGISTRADAS */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                    Detalhes de produção / Instruções
                  </h4>
                </div>
                <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  Registro Cronológico de Etapas & Ações
                </span>
              </div>

              {/* OBSERVAÇÕES E INSTRUÇÕES ESCRITAS */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block">
                  Instruções & Observações do Pedido
                </span>
                {selectedOs.observacoes ? (
                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {selectedOs.observacoes}
                  </div>
                ) : (
                  <div className="p-3 bg-white border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 italic">
                    Nenhuma observação especial informada na abertura da OS.
                  </div>
                )}
              </div>

              {/* HORÁRIOS EM QUE CADA ETAPA/AÇÃO FOI REGISTRADA */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  Horários e Ações Registradas por Etapa
                </span>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/90 text-slate-700 font-extrabold uppercase text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Etapa / Ação</th>
                          <th className="py-2.5 px-3">Responsável</th>
                          <th className="py-2.5 px-3">Horário de Aceite / Entrada</th>
                          <th className="py-2.5 px-3">Horário de Conclusão / Saída</th>
                          <th className="py-2.5 px-3">Tempo em Produção</th>
                          <th className="py-2.5 px-3 text-right">Status do Registro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800 text-[11px]">
                        {/* 1. Registro de Abertura / Sistema */}
                        <tr className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3">
                            <span className="font-black text-slate-900 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                              1. Abertura da OS (Sistema)
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">
                            {selectedOs.operador || selectedOs.vendedor || 'Sistema / Vendedor'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {selectedOs.createdAt
                              ? new Date(selectedOs.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
                              : `${selectedOs.dataVenda} (Horário de Abertura)`}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {selectedOs.createdAt
                              ? new Date(selectedOs.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
                              : `${selectedOs.dataVenda} (Emitido)`}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-semibold">Instantâneo</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✓ Registrado
                            </span>
                          </td>
                        </tr>

                        {/* 2. Registros das Etapas do Fluxo (setorAceitoPor) */}
                        {(() => {
                          const stagesList = selectedOs.fluxoProducao || ALL_STAGES;
                          const logs = selectedOs.setorAceitoPor || [];

                          return stagesList
                            .filter((stg) => stg !== 'Sistema')
                            .map((stageName, sIdx) => {
                              const matchingLog = logs.find((l) => l.estagio === stageName);
                              const isCurrent = selectedOs.estagioAtual === stageName;
                              const isDone = !!matchingLog?.concluidoEm || (logs.some((l) => l.estagio === stageName && l.status === 'Concluído'));

                              return (
                                <tr key={stageName} className={`hover:bg-slate-50/60 ${isCurrent ? 'bg-blue-50/30' : ''}`}>
                                  <td className="py-2.5 px-3">
                                    <span className="font-black text-slate-900 flex items-center gap-1.5">
                                      <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                          isDone ? 'bg-emerald-500' : isCurrent ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'
                                        }`}
                                      ></span>
                                      {sIdx + 2}. {stageName}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-700">
                                    {matchingLog?.funcionario || (isCurrent ? 'Aguardando Atribuição' : '—')}
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-slate-800">
                                    {matchingLog?.aceitoEm || matchingLog?.aceitoEmISO ? (
                                      <span>
                                        {matchingLog.aceitoEmISO
                                          ? new Date(matchingLog.aceitoEmISO).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
                                          : matchingLog.aceitoEm}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-normal italic">
                                        {isCurrent ? 'Pendente de Aceite' : 'Não iniciado'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-slate-800">
                                    {matchingLog?.concluidoEm || matchingLog?.concluidoEmISO ? (
                                      <span>
                                        {matchingLog.concluidoEmISO
                                          ? new Date(matchingLog.concluidoEmISO).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
                                          : matchingLog.concluidoEm}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-normal italic">
                                        {isCurrent ? 'Em produção ativa' : '—'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-600">
                                    {stageName === 'Conferência' ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px]">
                                          <span className="text-slate-500 font-bold">Demora p/ Aceitar:</span>
                                          <span className="text-amber-800 font-black bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                            {matchingLog?.tempoAceitacao || (isCurrent && !matchingLog?.aceitoEm ? 'Em contagem...' : '00:00:01')}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px]">
                                          <span className="text-slate-500 font-bold">Aceite ➔ Aprovar:</span>
                                          <span className="text-blue-800 font-black bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                            {matchingLog?.tempoAndamento || (matchingLog?.concluidoEm ? '00:00:01' : isCurrent && matchingLog?.aceitoEm ? 'Em conferência...' : '—')}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      matchingLog?.tempoAndamento || (matchingLog?.concluidoEm ? 'Finalizado' : isCurrent ? 'Em contagem...' : '—')
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    {isDone ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        ✓ Concluído
                                      </span>
                                    ) : isCurrent ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                                        ⏳ Etapa Atual
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                                        Na Fila
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 1. TOP CONTROLS & SEARCH - CLEAN & MINIMALIST */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por N° OS ou Nome do Cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterOnlyMyRole(!filterOnlyMyRole)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    filterOnlyMyRole
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs'
                  }`}
                >
                  {filterOnlyMyRole ? `✓ Minha Etapa (${user.role})` : `Ver Minhas Etapas (${user.role})`}
                </button>

                <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl">
                  Total: {osList.length} OS
                </span>

                <button
                  type="button"
                  onClick={() => loadData(false)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-xs transition-all cursor-pointer"
                  title="Atualizar fluxo de produção"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>
            </div>
          </div>

      {/* BANNER FOR OS STILL IN 'SISTEMA' AGUARDANDO ENTRADA */}
      {filteredOsList.filter((os) => os.estagioAtual === 'Sistema').length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl font-black shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-blue-900 uppercase">
                Aguardando Entrada no Fluxo de Produção ({filteredOsList.filter((os) => os.estagioAtual === 'Sistema').length} OS no Sistema)
              </h4>
              <p className="text-[11px] text-blue-700 font-medium">
                {isLoggedUserSeller
                  ? 'Seus serviços gerados aguardando início na etapa de Designer.'
                  : 'Ordens geradas prontas para iniciar na etapa de Designer.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 max-h-36 overflow-y-auto custom-scrollbar">
            {filteredOsList
              .filter((os) => os.estagioAtual === 'Sistema')
              .map((os) => (
                <button
                  key={os.id}
                  onClick={() => setSelectedOs(os)}
                  className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                  title={`Abrir OS #${os.codigo} - ${os.clienteNome}`}
                >
                  <span>{os.codigo}</span>
                  <span className="text-blue-400">•</span>
                  <span className="max-w-[150px] truncate">{os.clienteNome}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* 3. KANBAN BOARD - STRUCTURED IN 2 ROWS OF 4 COLUMNS AS SPECIFIED BY USER */}
      <div className="space-y-8">
        {/* ROW 1 (NA MESMA LINHA): DESIGNER (aceite) | IMPRESSÃO (aceite) | CALANDRA (aceite) | COSTURA (aceite) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-600 inline-block animate-pulse"></span>
              <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                1ª LINHA: ETAPAS DE ACEITE (FLUXO DE PRODUÇÃO)
              </h2>
            </div>
            <span className="text-[11px] font-black text-purple-800 bg-purple-100 px-3 py-0.5 rounded-full border border-purple-200">
             
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROW_1_ACEITE_CONFIG.map((col) => {
              const stage = col.stage;
              const StageIcon = getStageIcon(stage);
              const stageStyle = getStageColor(stage);
              const stageOsList = filteredOsList.filter((os) => os.estagioAtual === stage);

              return (
                <div
                  key={stage}
                  className="flex flex-col bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm max-h-[640px]"
                >
                  {/* COLUMN HEADER */}
                  <div className={`p-3.5 ${stageStyle.bg} border-b ${stageStyle.border} flex items-center justify-between shrink-0`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg bg-white/80 ${stageStyle.text}`}>
                        <StageIcon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-black uppercase tracking-wide ${stageStyle.text}`}>
                        {col.label}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black ${stageStyle.badge}`}>
                      {stageOsList.length}
                    </span>
                  </div>

                  {/* COLUMN CARDS CONTAINER */}
                  <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                    {stageOsList.length === 0 ? (
                      <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl bg-white/50">
                        <p className="text-[11px] font-bold text-slate-400">
                          Nenhum serviço em {col.label}
                        </p>
                      </div>
                    ) : (
                      stageOsList.map((os) => {
                        const isAccepted = isStageAccepted(os, stage);
                        const acceptanceInfo = getStageAcceptanceInfo(os, stage);
                        const canOperate = canUserOperateStage(stage, os);
                        const hasPrevious = Boolean(getPreviousStage(os));
                        const canApproveOrReject = canUserApproveOrRejectArt(os);
                        const definedDestination = getOsExplicitDestination(os);

                        return (
                          <KanbanServiceCard
                            key={os.id}
                            os={os}
                            stage={stage}
                            isAccepted={isAccepted}
                            acceptanceInfo={acceptanceInfo}
                            canOperate={canOperate}
                            canVoltarAcao={canUserVoltarAcao}
                            hasPrevious={hasPrevious}
                            definedDestination={definedDestination}
                            isDisplayOnly={false}
                            onSelect={() => setSelectedOs(os)}
                            onAccept={() => handleAcceptStage(os, stage)}
                            onAdvance={() => handleAdvanceStage(os, stage)}
                            onRollback={() => handleRequestRollback(os)}
                            onClientApprove={() => handleClientApprove(os)}
                            onClientReject={() => handleClientReject(os)}
                            canApproveOrReject={canApproveOrReject}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ROW 2 (NA LINHA ABAIXO): CONFORME A DETERMINAÇÃO DA EXPEDIÇÃO EM "CONTROLE DE EXPEDIÇÃO" (APENAS EXIBIÇÃO) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block animate-pulse"></span>
              <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                2ª LINHA: CONTROLE DE EXPEDIÇÃO
              </h2>
            </div>
            <span className="text-[11px] font-black text-emerald-800 bg-emerald-100 px-3 py-0.5 rounded-full border border-emerald-200">
             
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROW_2_EXIBICAO_COLUMNS.map((col) => {
              const ColIcon = col.icon;
              const colStyle = col.style;

              // FILTRO RIGOROSO CONFORME DETERMINAÇÃO DO USUÁRIO E CLÁUSULA DE PROTEÇÃO:
              // 1. Cláusula de proteção: se estiver em 'Sistema' (Aguardando Entrada), NÃO entra
              // 2. Só entra se já saiu da última etapa de aceite: !isOsInAcceptanceStage(os)
              // 3. Destino corresponde exatamente a esta coluna de exibição
              const colOsList = filteredOsList.filter((os) => {
                const stg = (os.estagioAtual || '').toLowerCase().trim();
                if (
                  stg === 'sistema' ||
                  stg === 'aguardando entrada no fluxo de produção' ||
                  stg === 'aguardando entrada'
                ) {
                  return false;
                }
                // Se ainda está em etapa de aceite (Designer, Impressão, Calandra ou Costura),
                // NÃO é exibido aqui (fica na linha 1 com observação do destino definido)
                if (isOsInAcceptanceStage(os)) {
                  return false;
                }
                return getOsRow2Destination(os) === col.id;
              });

              return (
                <div
                  key={col.id}
                  className="flex flex-col bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm max-h-[640px]"
                >
                  {/* COLUMN HEADER */}
                  <div className={`p-3.5 ${colStyle.bg} border-b ${colStyle.border} flex items-center justify-between shrink-0`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg bg-white/80 ${colStyle.text}`}>
                        <ColIcon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-black uppercase tracking-wide ${colStyle.text}`}>
                        {col.label}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black ${colStyle.badge}`}>
                      {colOsList.length}
                    </span>
                  </div>

                  {/* COLUMN CARDS CONTAINER */}
                  <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                    {colOsList.length === 0 ? (
                      <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl bg-white/50">
                        <p className="text-[11px] font-bold text-slate-400">
                          Nenhum serviço em {col.id}
                        </p>
                      </div>
                    ) : (
                      colOsList.map((os) => {
                        return (
                          <KanbanServiceCard
                            key={os.id}
                            os={os}
                            stage={'Expedição' as ProductionStage}
                            isAccepted={true}
                            canOperate={false}
                            canVoltarAcao={false}
                            hasPrevious={false}
                            definedDestination={col.id}
                            isDisplayOnly={true}
                            onSelect={() => setSelectedOs(os)}
                            onAccept={() => {}}
                            onAdvance={() => {}}
                            onRollback={() => {}}
                            onDeliver={() => setDeliveryModalOs(os)}
                            onReturn={() => setReturnModalOs(os)}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. LISTA DOS ÚLTIMOS 10 SERVIÇOS CONCLUÍDOS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Últimos 10 Serviços Concluídos
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Comando de lista e histórico dos trabalhos finalizados no fluxo de produção
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-800 font-black text-xs rounded-full border border-emerald-200">
            Total Concluídos: {osList.filter((os) => os.estagioAtual === 'Concluído' || os.status === 'Concluído').length} OS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-extrabold border-b border-slate-200">
                <th className="p-3">Código OS</th>
                <th className="p-3">Data</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Vendedor / Operador</th>
                <th className="p-3 text-right">Valor Final</th>
                <th className="p-3">Status Pagamento</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {osList
                .filter((os) => os.estagioAtual === 'Concluído' || os.status === 'Concluído')
                .slice(0, 10).length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 font-bold">
                    Nenhum serviço concluído registrado no momento.
                  </td>
                </tr>
              ) : (
                osList
                  .filter((os) => os.estagioAtual === 'Concluído' || os.status === 'Concluído')
                  .slice(0, 10)
                  .map((os) => (
                    <tr key={os.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-black text-blue-600">{os.codigo}</td>
                      <td className="p-3">{os.dataVenda}</td>
                      <td className="p-3 font-bold text-slate-900">{os.clienteNome}</td>
                      <td className="p-3 text-slate-600">{os.operador}</td>
                      <td className="p-3 text-right font-black text-slate-900">R$ {os.valorFinal.toFixed(2)}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            os.paymentStatus === 'pago'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {os.paymentStatus === 'pago' ? '✓ Pago' : '⏳ Pendente'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedOs(os)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detalhes</span>
                          </button>
                          <button
                            onClick={() => setPrintableOs(os)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir OS</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* 5. A4 PRINT MODAL FROM KANBAN */}
      {(showPrintModal && selectedOs) && (
        <OsPrintableA4
          os={selectedOs}
          isSidebarExpanded={isSidebarExpanded}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {printableOs && (
        <OsPrintableA4
          os={printableOs}
          isSidebarExpanded={isSidebarExpanded}
          onClose={() => setPrintableOs(null)}
        />
      )}

      {/* 6. MODAL DE CONFIRMAÇÃO DE SENHA PARA VOLTAR AÇÃO (RETROCESSO) */}
      {rollbackModalOs && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* HEADER */}
            <div className="bg-amber-500 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-600/60 rounded-xl">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide">Voltar Ação de Produção</h3>
                  <span className="text-[11px] text-amber-100 font-medium">Autorização Requer Senha</span>
                </div>
              </div>
              <button
                onClick={() => setRollbackModalOs(null)}
                className="p-1.5 hover:bg-amber-600 text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CONTENT */}
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-2">
                <div className="flex items-center justify-between font-black">
                  <span>OS: {rollbackModalOs.codigo}</span>
                  <span className="text-amber-800 font-bold truncate max-w-[180px]">{rollbackModalOs.clienteNome}</span>
                </div>
                <div className="flex items-center gap-2 pt-1 font-bold">
                  <span className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-[11px] text-slate-800 shadow-2xs">
                    {rollbackModalOs.estagioAtual}
                  </span>
                  <ArrowRight className="w-4 h-4 text-amber-700" />
                  <span className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-black shadow-2xs">
                    {getPreviousStage(rollbackModalOs)}
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 pt-1 leading-snug">
                  Esta ação irá retroceder a ordem de serviço para o estágio anterior. Permitido exclusivamente para <strong>DEVELOPER, CEO, GERENTE GERAL e SUPERVISOR</strong>, exigindo sempre a confirmação da senha de um deles.
                </p>
              </div>

              {rollbackError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-bold animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{rollbackError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-700">
                  Senha de Autorização (Developer, CEO, Gerente Geral ou Supervisor):
                </label>
                <div className="relative">
                  <input
                    type={rollbackShowPass ? 'text' : 'password'}
                    value={rollbackPassword}
                    onChange={(e) => {
                      setRollbackPassword(e.target.value);
                      if (rollbackError) setRollbackError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmRollback();
                    }}
                    placeholder="Digite a senha de Developer, CEO, Gerente Geral ou Supervisor..."
                    autoFocus
                    className="w-full pl-3 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setRollbackShowPass(!rollbackShowPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 text-[11px] font-bold cursor-pointer"
                  >
                    {rollbackShowPass ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRollbackModalOs(null)}
                  disabled={rollbackLoading}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRollback}
                  disabled={rollbackLoading}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {rollbackLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  <span>Confirmar e Retroceder</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ENTREGA */}
      {deliveryModalOs && (
        <DeliveryModal
          os={deliveryModalOs}
          isOpen={Boolean(deliveryModalOs)}
          onClose={() => setDeliveryModalOs(null)}
          onSuccess={() => {
            if (selectedOs?.id === deliveryModalOs.id) {
              setSelectedOs(null);
            }
            loadData();
          }}
        />
      )}

      {/* MODAL DE DEVOLUÇÃO */}
      {returnModalOs && (
        <ReturnModal
          os={returnModalOs}
          isOpen={Boolean(returnModalOs)}
          onClose={() => setReturnModalOs(null)}
          onSuccess={() => {
            if (selectedOs?.id === returnModalOs.id) {
              setSelectedOs(null);
            }
            loadData();
          }}
        />
      )}

      {/* MODAL DE PREVIEW DA IMAGEM / ARTE */}
      {previewImageModalUrl && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden flex flex-col border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950 text-white border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Printer className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-xs font-black truncate max-w-md">{previewImageName || 'Visualização da Arte'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment({ fileUrl: previewImageModalUrl, fileName: previewImageName })}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Arquivo Original</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewImageModalUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-slate-950/60 min-h-[300px]">
              <img
                src={previewImageModalUrl}
                alt={previewImageName || 'Preview da Arte'}
                className="max-h-[75vh] max-w-full object-contain rounded-lg border border-slate-800 shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
