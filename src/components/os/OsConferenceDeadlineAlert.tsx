import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  Clock,
  Truck,
  Check,
  X,
  Eye,
  AlertTriangle,
  PackageCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { OrdemServico, TipoExpedicao, ProductionStage } from '../../server/types/os';
import { UserProfile } from '../../types/frontend';
import { ApiService } from '../../services/api';
import { canUserAccessModule, normalizeRoleName } from '../../utils/userPermissions';
import { NotificationService } from '../../utils/notificationService';
import { formatDateBR as formatDateBr } from '../../utils/formatters';
import { OsPrintableA4 } from './OsPrintableA4';

interface OsConferenceDeadlineAlertProps {
  user: UserProfile;
  activeMenu?: string;
  onNavigateToConference?: (menuId: string, menuLabel: string) => void;
}

interface UrgentOsItem {
  os: OrdemServico;
  diffDays: number;
  urgencyTag: string;
  prazoDisplay: string;
  theme: {
    bgClass: string;
    borderClass: string;
    textClass: string;
    subBgClass: string;
    modalityBadgeBg: string;
    modalityLabel: string;
    colorName: string;
  };
}

const parseDateOnly = (dateStr?: string): Date | null => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const yearPart = parts[2].split(' ')[0].split('T')[0];
      return new Date(Number(yearPart), Number(parts[1]) - 1, Number(parts[0]));
    }
  }
  if (str.includes('-')) {
    const clean = str.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

// Returns exact matching background, border and theme based on modality:
// NORMAL -> Blue (Azul)
// EXPRESSO DO DIA -> Orange (Laranja)
// EXPRESSO EXCURSÃO / ESCURSÃO -> Red (Vermelho)
const getModalityCardStyle = (tipoExpedicao?: string) => {
  const tipo = (tipoExpedicao || 'NORMAL').toUpperCase().trim();

  if (tipo.includes('EXCURS') || tipo.includes('ESCURS') || tipo === 'EXPRESSO EXCURSÃO' || tipo === 'EXPRESSO ESCURSÃO') {
    // EXPRESSO EXCURSÃO -> Red (Vermelho)
    return {
      bgClass: 'bg-rose-600',
      borderClass: 'border-rose-700',
      textClass: 'text-white',
      subBgClass: 'bg-rose-700/90 border-rose-400/40',
      modalityBadgeBg: 'bg-rose-950/40 text-rose-100 border-rose-400/50',
      modalityLabel: 'EXPRESSO EXCURSÃO',
      colorName: 'Vermelho',
    };
  }

  if (tipo.includes('DIA') || tipo === 'EXPRESSO DO DIA') {
    // EXPRESSO DO DIA -> Orange (Laranja / #ea580c / #FFA500)
    return {
      bgClass: 'bg-[#ea580c]',
      borderClass: 'border-orange-700',
      textClass: 'text-white',
      subBgClass: 'bg-orange-700/90 border-orange-400/40',
      modalityBadgeBg: 'bg-orange-950/40 text-orange-100 border-orange-400/50',
      modalityLabel: 'EXPRESSO DO DIA',
      colorName: 'Laranja',
    };
  }

  // NORMAL -> Blue (Azul)
  return {
    bgClass: 'bg-blue-600',
    borderClass: 'border-blue-700',
    textClass: 'text-white',
    subBgClass: 'bg-blue-700/90 border-blue-400/40',
    modalityBadgeBg: 'bg-blue-950/40 text-blue-100 border-blue-400/50',
    modalityLabel: 'NORMAL',
    colorName: 'Azul',
  };
};

export const OsConferenceDeadlineAlert: React.FC<OsConferenceDeadlineAlertProps> = ({
  user,
  activeMenu,
  onNavigateToConference,
}) => {
  const [osList, setOsList] = useState<OrdemServico[]>([]);
  const [dismissedOsIds, setDismissedOsIds] = useState<Set<string>>(new Set());
  const [acceptingOsId, setAcceptingOsId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [viewingOs, setViewingOs] = useState<OrdemServico | null>(null);

  // Check if current user belongs to Conference profile or has access to Conference module
  const hasConferenceAccess = useMemo(() => {
    if (!user) return false;
    if (user.isDeveloper) return true;
    const norm = normalizeRoleName(user.role);
    if (norm === 'CONFERENCIA' || norm === 'Conferência' || user.role.toLowerCase().includes('confer')) {
      return true;
    }
    return canUserAccessModule(user.role, 'conferenciaOs', user.isDeveloper);
  }, [user]);

  // Whenever the user enters/switches to the "CONFERÊNCIA DE OS" module,
  // reset any temporarily closed alerts so they show up again until accepted.
  useEffect(() => {
    if (activeMenu === 'conferencia-os') {
      setDismissedOsIds(new Set());
      loadOsData();
    }
  }, [activeMenu]);

  // Load OS data
  const loadOsData = async () => {
    if (!hasConferenceAccess) return;
    try {
      const data = await ApiService.getOrdensServico().catch(() => []);
      if (Array.isArray(data)) {
        // Exclude quick PDV / VND tickets
        const pureOs = data.filter((os) => {
          const cod = (os.codigo || '').toUpperCase();
          return !cod.startsWith('VND') && !cod.startsWith('PDV');
        });
        setOsList(pureOs);
      }
    } catch (err) {
      console.error('Erro ao carregar OS para alerta de prazo:', err);
    }
  };

  useEffect(() => {
    if (!hasConferenceAccess) return;

    loadOsData();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadOsData();
      }
    }, 12000);
    const handleOsChanged = () => loadOsData();
    const handleFocus = () => loadOsData();

    window.addEventListener('os-changed', handleOsChanged);
    window.addEventListener('focus', handleFocus);

    // Listen to global notification events when OS stage is accepted
    const handleNotificationEvent = (e: any) => {
      const detail = e.detail;
      if (detail && detail.type === 'os_accepted' && detail.osId && detail.stage === 'Conferência') {
        loadOsData();
      }
    };
    window.addEventListener('subligestao_new_notification', handleNotificationEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('os-changed', handleOsChanged);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('subligestao_new_notification', handleNotificationEvent);
    };
  }, [hasConferenceAccess]);

  // Filter OS that:
  // 1. Are for today (same-day delivery / purchase day / diffDays === 0)
  // 2. Are expiring with at least 24h of anticipation (diffDays === 1)
  // 3. Are already overdue (diffDays < 0)
  // AND are not yet conferidas AND conference is not yet accepted
  const urgentOsList = useMemo<UrgentOsItem[]>(() => {
    if (!hasConferenceAccess || !osList || osList.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items: UrgentOsItem[] = [];

    osList.forEach((os) => {
      // 1. Skip if dismissed in this session
      if (dismissedOsIds.has(os.id)) return;
      
      // Only alert for OS that are currently in Conferência stage
      if (os.estagioAtual !== 'Conferência') return;

      // 2. Skip ONLY if already conferida (status "conferido" or conferido: true or finalizado/entregue)
      const isConferida = Boolean(
        os.conferido === true ||
        (typeof os.status === 'string' && os.status.toLowerCase() === 'conferido') ||
        (typeof os.estagioAtual === 'string' && os.estagioAtual.toLowerCase() === 'concluído') ||
        (typeof os.estagioAtual === 'string' && os.estagioAtual.toLowerCase() === 'entrega') ||
        (os.estagioAtual === 'Conferência' && os.conferido)
      );
      if (isConferida) return;

      // 3. Check delivery deadline (prazoEntrega)
      const deadline = parseDateOnly(os.prazoEntrega);
      if (!deadline) return;

      const targetDate = new Date(deadline);
      targetDate.setHours(0, 0, 0, 0);

      // Difference in days (targetDate - today)
      const diffMs = targetDate.getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Rule:
      // - diffDays === 0: Ordem de serviço do dia (prazo de entrega hoje / compra no mesmo dia) -> Alerta ativo com prazo pro dia!
      // - diffDays === 1: Alerta com antecedência de 24 horas (vence amanhã)
      // - diffDays < 0: Prazo expirado / em atraso
      // - diffDays > 1: Mais de 24h à frente -> aguarda atingir a janela de 24h
      if (diffDays <= 1) {
        let urgencyTag = 'Antecedência 24h';
        let prazoDisplay = `Prazo: Amanhã (${formatDateBr(os.prazoEntrega)})`;

        if (diffDays === 0) {
          urgencyTag = 'Prazo Hoje';
          prazoDisplay = `Prazo: Hoje (${formatDateBr(os.prazoEntrega)})`;
        } else if (diffDays < 0) {
          const atraso = Math.abs(diffDays);
          urgencyTag = `Expirado (${atraso}d)`;
          prazoDisplay = `Expirada em ${formatDateBr(os.prazoEntrega)}`;
        }

        const theme = getModalityCardStyle(os.tipoExpedicao);

        items.push({
          os,
          diffDays,
          urgencyTag,
          prazoDisplay,
          theme,
        });
      }
    });

    // Sort: most urgent first (overdue < today < tomorrow)
    return items.sort((a, b) => a.diffDays - b.diffDays);
  }, [hasConferenceAccess, osList, dismissedOsIds]);

  // Exiba o alerta de conferência apenas quando entrar no módulo "CONFERÊNCIA DE OS"
  if (!hasConferenceAccess || activeMenu !== 'conferencia-os' || urgentOsList.length === 0) {
    return null;
  }

  // Handle "Aceitar" action
  const handleAcceptConference = async (item: UrgentOsItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const os = item.os;
    setAcceptingOsId(os.id);

    try {
      const now = new Date();
      const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

      const existingAcceptance = os.setorAceitoPor || [];
      const filtered = existingAcceptance.filter((s) => s.estagio !== 'Conferência');

      const newEntry = {
        estagio: 'Conferência' as ProductionStage,
        descricaoEtapa: 'Auditoria e Conferência de Saída',
        funcionario: user.name,
        aceitoEm: dataHoraStr,
        aceitoEmISO: now.toISOString(),
        status: 'Em Andamento' as const,
        observacao: 'Aceite de conferência realizado via alerta de prazo de entrega.',
      };

      const updatedOs: OrdemServico = {
        ...os,
        estagioAtual:
          os.estagioAtual === 'Costura' ||
          os.estagioAtual === 'Calandra' ||
          os.estagioAtual === 'Impressão' ||
          os.estagioAtual === 'Designer'
            ? 'Conferência'
            : os.estagioAtual,
        setorAceitoPor: [...filtered, newEntry],
      };

      await ApiService.updateOs(os.id, updatedOs);

      // Notify team that conference was accepted
      NotificationService.notifyOsStageAccepted(updatedOs, 'Conferência', user.name);

      setSuccessToast(`OS #${os.codigo} aceita para conferência por ${user.name}!`);
      setTimeout(() => setSuccessToast(null), 3500);

      window.dispatchEvent(new Event('os-changed'));

      // Save pending target to sessionStorage and dispatch event to open directly in "Aprovar e Liberar OS"
      try {
        sessionStorage.setItem(
          'subligestao_pending_open_os_conference',
          JSON.stringify({ osId: os.id, os: updatedOs, tab: 'conferencia' })
        );
      } catch (_) {}

      window.dispatchEvent(
        new CustomEvent('subligestao_open_os_conference', {
          detail: { osId: os.id, os: updatedOs, tab: 'conferencia' },
        })
      );

      if (onNavigateToConference) {
        onNavigateToConference('conferencia-os', 'Conferência de OS');
      }

      setViewingOs(null);
      await loadOsData();
    } catch (err) {
      console.error('Erro ao aceitar conferência da OS:', err);
      alert('Não foi possível aceitar a conferência da OS. Verifique a conexão.');
    } finally {
      setAcceptingOsId(null);
    }
  };

  const handleDismiss = (osId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDismissedOsIds((prev) => new Set([...prev, osId]));
  };

  const handleView = (os: OrdemServico, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setViewingOs(os);
  };

  return (
    <>
      {/* Toast Feedback */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-xs font-black tracking-wide">{successToast}</span>
        </div>
      )}

      {/* Floating Corner Notification Stack (Top-Right matching Kanban Production Flow alerts) */}
      <aside
        id="os-conference-deadline-alert"
        aria-label="Alerta de Prazo de Entrega para Conferência de OS"
        className="fixed top-16 right-3 sm:right-6 z-50 flex flex-col gap-2 max-w-[340px] sm:max-w-[370px] w-[calc(100%-1.5rem)] pointer-events-auto select-none"
      >
        {/* Header indicator when multiple alerts exist */}
        {urgentOsList.length > 1 && (
          <div className="flex items-center justify-between bg-slate-900/90 text-white text-[10.5px] font-bold px-3 py-1 rounded-xl shadow-md backdrop-blur-xs border border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>
                {urgentOsList.length} OSs com prazo de entrega próximo (Hoje / 24h)
              </span>
            </div>
            {onNavigateToConference && (
              <button
                type="button"
                onClick={() => onNavigateToConference('conferencia-os', 'Conferência de OS')}
                className="text-amber-300 hover:text-white underline cursor-pointer text-[9.5px]"
              >
                Atualizar
              </button>
            )}
          </div>
        )}

        {/* Render Cards - styled identically to Kanban stage alerts with Modalidade colors */}
        {urgentOsList.slice(0, 3).map((item) => {
          const { os, urgencyTag, prazoDisplay, theme } = item;
          const isAccepting = acceptingOsId === os.id;

          return (
            <div
              key={os.id}
              className={`${theme.bgClass} border ${theme.borderClass} ${theme.textClass} rounded-2xl p-2.5 shadow-xl space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200 relative overflow-hidden group`}
            >
              {/* Top Accent/Progress Track */}
              <div className="w-full bg-black/25 h-1 rounded-full overflow-hidden">
                <div className="bg-white h-full rounded-full transition-all duration-300 ease-linear w-full" />
              </div>

              {/* Main Compact Row: OS Code, Client Name, Urgency Tag and Dismiss */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {/* Yellow OS Badge */}
                  <span className="bg-amber-300 text-amber-950 font-black text-[10px] px-1.5 py-0.5 rounded border border-amber-400 shrink-0 font-mono">
                    {os.codigo}
                  </span>
                  {/* Client Name in Bold Uppercase */}
                  <span
                    className="text-xs font-black text-white uppercase truncate"
                    title={os.clienteNome || 'Cliente Geral'}
                  >
                    {os.clienteNome || 'Cliente Geral'}
                  </span>
                </div>

                {/* Right Header Controls: Urgency Tag and Close Button */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-bold text-white/95 font-mono bg-black/30 px-1.5 py-0.5 rounded border border-white/20">
                    {urgencyTag}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDismiss(os.id, e)}
                    className="p-0.5 text-white/70 hover:text-white rounded hover:bg-white/10 cursor-pointer transition"
                    title="Fechar alerta temporariamente"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sub-row with Sector, Modality & Quick Actions ("Ver" and "✓ Aceitar") */}
              <div className="flex items-center justify-between gap-1.5 pt-0.5 border-t border-white/20">
                <div className="text-[10px] text-white/95 font-bold truncate flex items-center gap-1">
                  {/* Sector Tag */}
                  <span className={`${theme.subBgClass} px-1.5 py-0.5 rounded text-[9.5px] uppercase border font-black`}>
                    CONFERÊNCIA
                  </span>
                  {/* Modality Tag (NORMAL, EXPRESSO DO DIA, EXPRESSO EXCURSÃO) */}
                  <span className={`${theme.modalityBadgeBg} px-1.5 py-0.5 rounded text-[9.5px] uppercase border font-black`}>
                    {theme.modalityLabel}
                  </span>
                  <span className="font-semibold text-white/90 text-[10px] hidden sm:inline truncate">
                    {prazoDisplay}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* "Ver" Button */}
                  <button
                    type="button"
                    onClick={(e) => handleView(os, e)}
                    className="text-[10.5px] font-bold text-white hover:text-white underline cursor-pointer px-1"
                  >
                    Ver
                  </button>

                  {/* "✓ Aceitar" Button */}
                  <button
                    type="button"
                    onClick={(e) => handleAcceptConference(item, e)}
                    disabled={isAccepting}
                    className="px-2.5 py-1 bg-white hover:bg-white/90 active:scale-95 text-slate-900 font-black text-[10.5px] rounded-lg flex items-center gap-1 shadow-xs cursor-pointer transition-all whitespace-nowrap disabled:opacity-50"
                  >
                    <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                    <span>{isAccepting ? 'Aceitando...' : 'Aceitar'}</span>
                  </button>
                </div>
              </div>

              {/* Mobile Prazo line fallback */}
              <div className="sm:hidden text-[9.5px] font-semibold text-white/85 pt-0.5">
                {prazoDisplay}
              </div>
            </div>
          );
        })}

        {/* Bottom indicator if more than 3 alerts are in queue */}
        {urgentOsList.length > 3 && (
          <div className="text-center text-[10px] font-extrabold text-slate-700 bg-white/95 border border-slate-300 py-1 px-2 rounded-xl shadow-md">
            + {urgentOsList.length - 3} outra(s) OS no prazo limite aguardando conferência
          </div>
        )}
      </aside>

      {/* Modal for viewing OS details when "Ver" is clicked */}
      {viewingOs && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="bg-amber-400 text-slate-950 font-mono font-black text-xs px-2 py-0.5 rounded-md">
                  {viewingOs.codigo}
                </span>
                <h3 className="text-base font-black tracking-tight">{viewingOs.clienteNome || 'Cliente'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingOs(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 touch-scroll">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Modalidade</span>
                  <span className="text-xs font-black text-slate-800 uppercase">{viewingOs.tipoExpedicao || 'NORMAL'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Prazo de Entrega</span>
                  <span className="text-xs font-black text-amber-700">{formatDateBr(viewingOs.prazoEntrega)}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Estágio Atual</span>
                  <span className="text-xs font-black text-slate-800">{viewingOs.estagioAtual || 'Produção'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Valor Total</span>
                  <span className="text-xs font-black text-emerald-700">
                    R$ {Number(viewingOs.valorFinal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Telefone</span>
                  <span className="text-xs font-black text-slate-800">{viewingOs.clienteTelefone || '-'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Itens</span>
                  <span className="text-xs font-black text-slate-800">{viewingOs.itens?.length || 0} item(ns)</span>
                </div>
              </div>

              {/* Items Summary */}
              {viewingOs.itens && viewingOs.itens.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    Grade de Itens do Pedido
                  </div>
                  <div className="divide-y divide-slate-100">
                    {viewingOs.itens.map((item, idx) => (
                      <div key={idx} className="p-3 text-xs flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800">{item.descricao || `Item #${idx + 1}`}</span>
                        <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {item.quantidade}x
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewingOs(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Fechar
              </button>

              <div className="flex items-center gap-2">
                {onNavigateToConference && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetOs = viewingOs;
                      setViewingOs(null);
                      try {
                        sessionStorage.setItem(
                          'subligestao_pending_open_os_conference',
                          JSON.stringify({ osId: targetOs.id, os: targetOs, tab: 'conferencia' })
                        );
                      } catch (_) {}
                      window.dispatchEvent(
                        new CustomEvent('subligestao_open_os_conference', {
                          detail: { osId: targetOs.id, os: targetOs, tab: 'conferencia' },
                        })
                      );
                      onNavigateToConference('conferencia-os', 'Conferência de OS');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir na Conferência</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const targetItem = urgentOsList.find((i) => i.os.id === viewingOs.id);
                    if (targetItem) {
                      handleAcceptConference(targetItem);
                      setViewingOs(null);
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Aceitar Conferir Agora</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
