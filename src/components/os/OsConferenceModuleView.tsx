import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Printer,
  X,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Eye,
  CheckSquare,
  Square,
  BadgeAlert,
  Info,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Sparkles,
  ArrowUpDown,
  FileCheck,
  ArrowLeft,
  Truck,
  Check,
  Tag,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Send,
} from 'lucide-react';
import { ApiService } from '../../services/api';
import { OrdemServico, OsHistoryEntry, TipoExpedicao } from '../../server/types/os';
import { OsPrintableA4 } from './OsPrintableA4';
import { getLoggedUserAndPerfil, filterVisibleHistory } from '../../utils/userPermissions';
import { NotificationService } from '../../utils/notificationService';
import { formatElapsedDuration } from '../../utils/formatters';

const formatMoney = (val: number): string => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const getModalityVisualTheme = (tipoExpedicao?: string) => {
  const tipo = (tipoExpedicao as TipoExpedicao) || 'NORMAL';
  if (tipo === 'EXPRESSO EXCURSÃO') {
    return {
      type: 'EXPRESSO EXCURSÃO' as const,
      label: 'EXPRESSO EXCURSÃO',
      colorName: 'Vermelho',
      colorHex: '#dc2626',
      borderLeftClass: 'border-l-[6px] border-l-red-600',
      badgeClass: 'bg-red-600 text-white font-black',
      rowClass: 'bg-red-50/25 hover:bg-red-100/45',
      pillClass: 'bg-red-100 text-red-950 border border-red-300',
      tagText: 'text-red-700',
    };
  }

  if (tipo === 'EXPRESSO DO DIA') {
    return {
      type: 'EXPRESSO DO DIA' as const,
      label: 'EXPRESSO DO DIA',
      colorName: 'Laranja (#FFA500)',
      colorHex: '#FFA500',
      borderLeftClass: 'border-l-[6px] border-l-[#FFA500]',
      badgeClass: 'bg-[#FFA500] text-slate-950 font-black',
      rowClass: 'bg-orange-50/30 hover:bg-orange-100/50',
      pillClass: 'bg-orange-100 text-orange-950 border border-orange-300',
      tagText: 'text-orange-900',
    };
  }

  // NORMAL (Azul)
  return {
    type: 'NORMAL' as const,
    label: 'NORMAL',
    colorName: 'Azul',
    colorHex: '#2563eb',
    borderLeftClass: 'border-l-[6px] border-l-blue-600',
    badgeClass: 'bg-blue-600 text-white font-black',
    rowClass: 'bg-blue-50/15 hover:bg-blue-100/35',
    pillClass: 'bg-blue-100 text-blue-900 border border-blue-300',
    tagText: 'text-blue-700',
  };
};

export const getOsVisualTheme = (os: OrdemServico) => {
  const isConferida = Boolean(
    os.conferido === true ||
    os.estagioAtual?.toLowerCase().includes('conferid') ||
    os.estagioAtual?.toLowerCase().includes('expedi') ||
    os.estagioAtual?.toLowerCase().includes('entreg')
  );

  if (isConferida) {
    return {
      type: 'CONFERIDO' as const,
      label: 'CONFERIDO',
      colorName: 'Verde',
      colorHex: '#059669',
      borderLeftClass: 'border-l-[6px] border-l-emerald-600',
      badgeClass: 'bg-emerald-600 text-white font-black',
      rowClass: 'bg-emerald-50/20 hover:bg-emerald-100/40',
      pillClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
      tagText: 'text-emerald-700',
    };
  }

  return getModalityVisualTheme(os.tipoExpedicao);
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
      const yearPart = parts[0];
      return new Date(Number(yearPart), Number(parts[1]) - 1, Number(parts[2]));
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

export const formatDateBr = (dateStr?: string | Date | null): string => {
  if (!dateStr) return '-';
  if (dateStr instanceof Date) {
    if (isNaN(dateStr.getTime())) return '-';
    const dia = String(dateStr.getDate()).padStart(2, '0');
    const mes = String(dateStr.getMonth() + 1).padStart(2, '0');
    const ano = dateStr.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
  const str = String(dateStr).trim();
  // If already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    return str.split(' ')[0];
  }
  // If in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const clean = str.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  const d = parseDate(str);
  if (!d) return str;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
};

export const OsConferenceModuleView: React.FC = () => {
  const [osList, setOsList] = useState<OrdemServico[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedShortcut, setSelectedShortcut] = useState<string>('30days');
  const [conferenceFilter, setConferenceFilter] = useState<'all' | 'pendentes' | 'conferidas'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'EXPRESSO EXCURSÃO' | 'EXPRESSO DO DIA' | 'NORMAL' | 'CONFERIDAS'>('ALL');

  // Selected row checkboxes for batch actions
  const [selectedOsIds, setSelectedOsIds] = useState<string[]>([]);

  // Full Screen Modal State for OS Details / Conference
  const [selectedOsDetail, setSelectedOsDetail] = useState<OrdemServico | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'conferencia' | 'detalhes' | 'comprovantes' | 'historico' | 'impressao'>('conferencia');

  // Conference checklist state inside modal
  const [checklist, setChecklist] = useState<{
    itensQtd: boolean;
    medidasDimensoes: boolean;
    tecidoMaterial: boolean;
    qualidadeEstampa: boolean;
    acabamentoCostura: boolean;
    etiquetasEmbalagem: boolean;
  }>({
    itensQtd: true,
    medidasDimensoes: true,
    tecidoMaterial: true,
    qualidadeEstampa: true,
    acabamentoCostura: true,
    etiquetasEmbalagem: true,
  });
  const [conferenceNotes, setConferenceNotes] = useState<string>('');
  const [isSavingConference, setIsSavingConference] = useState<boolean>(false);
  const [isBatchSaving, setIsBatchSaving] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Rejection modal state for "Não Aprovado" flow
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectReasonText, setRejectReasonText] = useState<string>('');
  const [isRejectingConference, setIsRejectingConference] = useState<boolean>(false);

  // Sorting
  const [sortField, setSortField] = useState<'codigo' | 'cliente' | 'data' | 'prazo' | 'valor' | 'status'>('data');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Date Filters
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(thirtyDaysAgo);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const osData = await ApiService.getOrdensServico().catch(() => []);
      const allList: OrdemServico[] = Array.isArray(osData) ? osData : [];

      // REGRA: APENAS ORDENS DE SERVIÇO (ignora vendas rápidas de PDV/VND e Orçamentos/ORC)
      // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
      // ENQUANTO A OS ESTIVER EM "Aguardando Entrada no Fluxo de Produção" (** OS no Sistema), ELA NÃO DEVE SER EXIBIDA EM CONFERÊNCIA.
      const pureOsList = allList.filter((os) => {
        const cod = (os.codigo || '').toUpperCase();
        const isOrc = (os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento || cod.startsWith('ORC');
        const isSistema = (os.estagioAtual || 'Sistema').trim().toLowerCase() === 'sistema';
        return !cod.startsWith('VND') && !cod.startsWith('PDV') && !isOrc && !isSistema;
      });

      setOsList(pureOsList);

      // Check if there is a pending OS requested to open directly in "Aprovar e Liberar OS"
      try {
        const pending = sessionStorage.getItem('subligestao_pending_open_os_conference');
        if (pending) {
          const parsed = JSON.parse(pending);
          if (parsed && (parsed.os || parsed.osId)) {
            const target = parsed.os || pureOsList.find((x) => x.id === parsed.osId);
            if (target && (target.estagioAtual || 'Sistema').trim().toLowerCase() !== 'sistema') {
              setSelectedOsDetail(target);
              setModalActiveTab((parsed.tab as any) || 'conferencia');
              sessionStorage.removeItem('subligestao_pending_open_os_conference');
            }
          }
        }
      } catch (_) {}

      // If detail modal is open, refresh the selected OS
      if (selectedOsDetail) {
        const updatedSelected = pureOsList.find((item) => item.id === selectedOsDetail.id);
        if (updatedSelected) {
          setSelectedOsDetail(updatedSelected);
        } else {
          // Se a OS não pertence mais à Conferência (ex: retornou para Sistema), desativa detalhe
          setSelectedOsDetail(null);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar Conferência de OS:', error);
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

    const handleOpenOsEvent = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      if (detail.os) {
        if ((detail.os.estagioAtual || 'Sistema').trim().toLowerCase() !== 'sistema') {
          setSelectedOsDetail(detail.os);
          setModalActiveTab((detail.tab as any) || 'conferencia');
        }
      } else if (detail.osId) {
        ApiService.getOrdensServico()
          .then((data) => {
            if (Array.isArray(data)) {
              const found = data.find((x) => x.id === detail.osId);
              if (found && (found.estagioAtual || 'Sistema').trim().toLowerCase() !== 'sistema') {
                setSelectedOsDetail(found);
                setModalActiveTab((detail.tab as any) || 'conferencia');
              }
            }
          })
          .catch(() => {});
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('os-changed', handleOsChanged);
    window.addEventListener('subligestao_open_os_conference', handleOpenOsEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('os-changed', handleOsChanged);
      window.removeEventListener('subligestao_open_os_conference', handleOpenOsEvent);
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

  // Filtered OS list by Date, Search and Conference Status
  const filteredOsList = useMemo(() => {
    const list = osList.filter((os) => {
      // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
      // Enquanto a OS estiver em "Aguardando Entrada no Fluxo de Produção" (** OS no Sistema), ela NÃO deve ser exibida em Conferência.
      if ((os.estagioAtual || 'Sistema').trim().toLowerCase() === 'sistema') {
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
        const conferente = (os.conferenteNome || os.observacoesConferencia || '').toLowerCase();
        const itemsStr = (os.itens || []).map((i) => `${i.descricao} ${i.categoria || ''}`).join(' ').toLowerCase();

        const matches =
          code.includes(term) ||
          client.includes(term) ||
          phone.includes(term) ||
          cpf.includes(term) ||
          op.includes(term) ||
          conferente.includes(term) ||
          itemsStr.includes(term);

        if (!matches) return false;
      }

      // Conference tab filter
      const isConferida = Boolean(
        os.conferido === true ||
        os.estagioAtual?.toLowerCase().includes('concl') ||
        os.estagioAtual?.toLowerCase().includes('expedi') ||
        os.estagioAtual?.toLowerCase().includes('entreg')
      );

      if (conferenceFilter === 'pendentes') {
        if (isConferida) return false;
      } else if (conferenceFilter === 'conferidas') {
        if (!isConferida) return false;
      }

      // Priority & Visual Color Theme Filter
      if (priorityFilter !== 'ALL') {
        const theme = getOsVisualTheme(os);
        if (priorityFilter === 'CONFERIDAS' && theme.type !== 'CONFERIDO') return false;
        if (priorityFilter === 'EXPRESSO EXCURSÃO' && (theme.type !== 'EXPRESSO EXCURSÃO' || os.conferido)) return false;
        if (priorityFilter === 'EXPRESSO DO DIA' && (theme.type !== 'EXPRESSO DO DIA' || os.conferido)) return false;
        if (priorityFilter === 'NORMAL' && (theme.type !== 'NORMAL' || os.conferido)) return false;
      }

      return true;
    });

    // Sorting
    return list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'codigo') {
        comparison = (a.codigo || '').localeCompare(b.codigo || '');
      } else if (sortField === 'cliente') {
        comparison = (a.clienteNome || '').localeCompare(b.clienteNome || '');
      } else if (sortField === 'prazo') {
        const dtA = parseDate(a.prazoEntrega)?.getTime() || 0;
        const dtB = parseDate(b.prazoEntrega)?.getTime() || 0;
        comparison = dtA - dtB;
      } else if (sortField === 'valor') {
        comparison = (a.valorFinal || 0) - (b.valorFinal || 0);
      } else if (sortField === 'status') {
        const confA = a.conferido ? 1 : 0;
        const confB = b.conferido ? 1 : 0;
        comparison = confA - confB;
      } else {
        // default data
        const dtA = parseDate(a.dataVenda || a.createdAt)?.getTime() || 0;
        const dtB = parseDate(b.dataVenda || b.createdAt)?.getTime() || 0;
        comparison = dtA - dtB;
      }

      return sortAsc ? comparison : -comparison;
    });
  }, [osList, startDateTime, endDateTime, searchTerm, conferenceFilter, priorityFilter, sortField, sortAsc]);

  // Visual Color Stats & Summaries
  const stats = useMemo(() => {
    let total = 0;
    let expressoExcursao = 0;
    let expressoDia = 0;
    let normal = 0;
    let conferidos = 0;

    osList.forEach((os) => {
      if ((os.estagioAtual || 'Sistema').trim().toLowerCase() === 'sistema') return;
      total++;
      const isConf = Boolean(
        os.conferido === true ||
        os.estagioAtual?.toLowerCase().includes('conferid') ||
        os.estagioAtual?.toLowerCase().includes('expedi') ||
        os.estagioAtual?.toLowerCase().includes('entreg')
      );

      if (isConf) {
        conferidos++;
      } else {
        const tipo = (os.tipoExpedicao as TipoExpedicao) || 'NORMAL';
        if (tipo === 'EXPRESSO EXCURSÃO') {
          expressoExcursao++;
        } else if (tipo === 'EXPRESSO DO DIA') {
          expressoDia++;
        } else {
          normal++;
        }
      }
    });

    return { total, expressoExcursao, expressoDia, normal, conferidos };
  }, [osList]);

  // Counts & Summaries
  const pendentesCount = useMemo(() => {
    return osList.filter((os) => {
      if ((os.estagioAtual || 'Sistema').trim().toLowerCase() === 'sistema') return false;
      const isConf = Boolean(
        os.conferido === true ||
        os.estagioAtual?.toLowerCase().includes('concl') ||
        os.estagioAtual?.toLowerCase().includes('expedi') ||
        os.estagioAtual?.toLowerCase().includes('entreg')
      );
      return !isConf;
    }).length;
  }, [osList]);

  const conferidasCount = useMemo(() => {
    return osList.filter((os) => {
      if ((os.estagioAtual || 'Sistema').trim().toLowerCase() === 'sistema') return false;
      return Boolean(
        os.conferido === true ||
        os.estagioAtual?.toLowerCase().includes('concl') ||
        os.estagioAtual?.toLowerCase().includes('expedi') ||
        os.estagioAtual?.toLowerCase().includes('entreg')
      );
    }).length;
  }, [osList]);

  const totalGeralVal = useMemo(
    () => filteredOsList.reduce((acc, os) => acc + (os.valorFinal || 0), 0),
    [filteredOsList]
  );

  const totalPecasGeral = useMemo(() => {
    return filteredOsList.reduce((acc, os) => {
      const itemsSum = (os.itens || []).reduce((sum, it) => sum + (Number(it.quantidade) || 0), 0);
      return acc + (itemsSum || 1);
    }, 0);
  }, [filteredOsList]);

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedOsIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedOsIds.length === filteredOsList.length) {
      setSelectedOsIds([]);
    } else {
      setSelectedOsIds(filteredOsList.map((os) => os.id));
    }
  };

  const handleOpenDetailModal = (
    os: OrdemServico,
    initialTab: 'conferencia' | 'detalhes' | 'comprovantes' | 'historico' | 'impressao' = 'conferencia'
  ) => {
    setSelectedOsDetail(os);
    setModalActiveTab(initialTab);
    setConferenceNotes(os.observacoesConferencia || '');
    setChecklist({
      itensQtd: true,
      medidasDimensoes: true,
      tecidoMaterial: true,
      qualidadeEstampa: true,
      acabamentoCostura: true,
      etiquetasEmbalagem: true,
    });
  };

  const handleApproveConference = async () => {
    if (!selectedOsDetail) return;
    setIsSavingConference(true);

    try {
      const logged = getLoggedUserAndPerfil();
      const now = new Date();
      const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

      const newHistoryEntry: OsHistoryEntry = {
        id: `HST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        dataHora: dataHoraStr,
        usuario: logged.name,
        perfil: logged.role,
        acao: 'Conferência de OS Aprovada',
        detalhes: `Auditoria de saída realizada com 100% dos itens verificados. Observação: ${conferenceNotes.trim() || 'Nenhuma ressalva'}.`,
      };

      const updatedHistory = [newHistoryEntry, ...(selectedOsDetail.historicoEdicoes || [])];

      // REGRA 8: EM "CONFERÊNCIA" APÓS "Aprovar e Liberar OS" NÃO AVANÇA ETAPAS DE OUTRO SETOR APENAS O SEU.
      const fluxo = selectedOsDetail.fluxoProducao || [];
      const currentStage = selectedOsDetail.estagioAtual;
      const isCurrentlyInConferencia = currentStage === 'Conferência';
      let nextStage = currentStage;
      const nowISO = now.toISOString();

      const updatedAcceptances = [...(selectedOsDetail.setorAceitoPor || [])];
      const nowMs = now.getTime();

      if (isCurrentlyInConferencia) {
        // A OS está de fato no estágio de Conferência: avança para a próxima etapa do fluxo (ex: Expedição)
        const confIndex = fluxo.indexOf('Conferência');
        if (confIndex !== -1 && confIndex < fluxo.length - 1) {
          nextStage = fluxo[confIndex + 1];
        } else {
          nextStage = 'Concluído';
        }

        const existingAccIndex = updatedAcceptances.findIndex((a) => a.estagio === 'Conferência');
        let tempoAceitacaoMsg = '';
        let tempoAndamentoMsg = '';

        if (existingAccIndex >= 0) {
          const acc = updatedAcceptances[existingAccIndex];
          tempoAceitacaoMsg = acc.tempoAceitacao || '';

          if (!tempoAceitacaoMsg) {
            const startWait = selectedOsDetail.aguardandoAceitacaoDesde
              ? new Date(selectedOsDetail.aguardandoAceitacaoDesde).getTime()
              : (acc.aceitoEmISO ? new Date(acc.aceitoEmISO).getTime() : (selectedOsDetail.createdAt ? new Date(selectedOsDetail.createdAt).getTime() : nowMs));
            const acceptTime = acc.aceitoEmISO ? new Date(acc.aceitoEmISO).getTime() : nowMs;
            tempoAceitacaoMsg = formatElapsedDuration(Math.max(0, acceptTime - startWait));
          }

          const acceptStart = acc.aceitoEmISO ? new Date(acc.aceitoEmISO).getTime() : nowMs;
          tempoAndamentoMsg = formatElapsedDuration(Math.max(0, nowMs - acceptStart));

          updatedAcceptances[existingAccIndex] = {
            ...acc,
            status: 'Concluído',
            concluidoEm: dataHoraStr,
            concluidoEmISO: nowISO,
            tempoAceitacao: tempoAceitacaoMsg || '00:00:01',
            tempoAndamento: tempoAndamentoMsg || '00:00:01',
            observacao: conferenceNotes.trim() ? `Conferência Aprovada: ${conferenceNotes.trim()}` : 'Conferência Aprovada',
          };
        } else {
          const startWait = selectedOsDetail.aguardandoAceitacaoDesde
            ? new Date(selectedOsDetail.aguardandoAceitacaoDesde).getTime()
            : (selectedOsDetail.createdAt ? new Date(selectedOsDetail.createdAt).getTime() : nowMs);
          tempoAceitacaoMsg = formatElapsedDuration(Math.max(0, nowMs - startWait));
          tempoAndamentoMsg = '00:00:01';

          updatedAcceptances.push({
            estagio: 'Conferência',
            funcionario: logged.name,
            aceitoEm: dataHoraStr,
            aceitoEmISO: nowISO,
            concluidoEm: dataHoraStr,
            concluidoEmISO: nowISO,
            tempoAceitacao: tempoAceitacaoMsg || '00:00:01',
            tempoAndamento: tempoAndamentoMsg,
            status: 'Concluído',
            observacao: conferenceNotes.trim() ? `Conferência Aprovada: ${conferenceNotes.trim()}` : 'Conferência Aprovada',
          });
        }
      } else {
        // A OS está em outro setor da fábrica (ex: Designer, Impressão, Calandra, Costura).
        // NÃO AVANÇA A ETAPA DO OUTRO SETOR! Mantém o estagioAtual inalterado!
        nextStage = currentStage;

        // Conclui especificamente a etapa de Conferência em paralelo sem afetar o outro setor
        const existingAccIndex = updatedAcceptances.findIndex((a) => a.estagio === 'Conferência');
        let tempoAceitacaoMsg = '';
        let tempoAndamentoMsg = '';

        if (existingAccIndex >= 0) {
          const acc = updatedAcceptances[existingAccIndex];
          tempoAceitacaoMsg = acc.tempoAceitacao || '00:00:01';
          const acceptStart = acc.aceitoEmISO ? new Date(acc.aceitoEmISO).getTime() : nowMs;
          tempoAndamentoMsg = formatElapsedDuration(Math.max(0, nowMs - acceptStart));

          updatedAcceptances[existingAccIndex] = {
            ...acc,
            status: 'Concluído',
            concluidoEm: dataHoraStr,
            concluidoEmISO: nowISO,
            tempoAceitacao: tempoAceitacaoMsg,
            tempoAndamento: tempoAndamentoMsg || '00:00:01',
            observacao: conferenceNotes.trim() ? `Conferência Aprovada: ${conferenceNotes.trim()}` : 'Conferência Aprovada Paralelamente',
          };
        } else {
          const startWait = selectedOsDetail.aguardandoAceitacaoDesde
            ? new Date(selectedOsDetail.aguardandoAceitacaoDesde).getTime()
            : (selectedOsDetail.createdAt ? new Date(selectedOsDetail.createdAt).getTime() : nowMs);
          tempoAceitacaoMsg = formatElapsedDuration(Math.max(0, nowMs - startWait));
          tempoAndamentoMsg = '00:00:01';

          updatedAcceptances.push({
            estagio: 'Conferência',
            funcionario: logged.name,
            aceitoEm: dataHoraStr,
            aceitoEmISO: nowISO,
            concluidoEm: dataHoraStr,
            concluidoEmISO: nowISO,
            tempoAceitacao: tempoAceitacaoMsg || '00:00:01',
            tempoAndamento: tempoAndamentoMsg,
            status: 'Concluído',
            observacao: conferenceNotes.trim() ? `Conferência Aprovada: ${conferenceNotes.trim()}` : 'Conferência Aprovada Paralelamente',
          });
        }
      }

      const isNextFinal = nextStage === 'Concluído';

      const updatedOs: OrdemServico = {
        ...selectedOsDetail,
        conferido: true,
        dataConferencia: dataHoraStr,
        conferenteNome: logged.name,
        observacoesConferencia: conferenceNotes.trim() || undefined,
        estagioAtual: nextStage,
        status: isNextFinal ? 'Concluído' : (selectedOsDetail.status || 'Em Produção'),
        setorAceitoPor: updatedAcceptances,
        historicoEdicoes: updatedHistory,
        aguardandoAceitacaoDesde: isCurrentlyInConferencia
          ? (isNextFinal ? undefined : nowISO)
          : selectedOsDetail.aguardandoAceitacaoDesde,
      };

      await ApiService.updateOs(selectedOsDetail.id, updatedOs);

      // Dispara 1 notificação informando que a OS foi conferida e liberada
      NotificationService.notifyOsConferenced(updatedOs, logged.name);

      // Local State Update
      setSelectedOsDetail(updatedOs);
      setOsList((prev) => prev.map((item) => (item.id === updatedOs.id ? updatedOs : item)));

      setSuccessToast(`OS #${selectedOsDetail.codigo} conferida e liberada com sucesso!`);
      setTimeout(() => setSuccessToast(null), 4000);

      window.dispatchEvent(new Event('os-changed'));
    } catch (error) {
      console.error('Erro ao aprovar conferência:', error);
      alert('Não foi possível salvar a conferência da OS. Tente novamente.');
    } finally {
      setIsSavingConference(false);
    }
  };

  /**
   * FLUXO "NÃO APROVADO":
   * 1. Registra o relato do conferente em "Instruções & Observações do Pedido" (campo observacoes da OS)
   * 2. Retorna a OS direto para o vendedor (estagioAtual: 'Sistema')
   * 3. Dispara alerta/notificação imediata para o vendedor com o relato do conferente
   */
  const handleRejectConference = async () => {
    if (!selectedOsDetail) return;
    if (!rejectReasonText.trim()) {
      alert('Por favor, descreva detalhadamente o motivo da não aprovação para orientar o vendedor e a produção.');
      return;
    }

    setIsRejectingConference(true);
    try {
      const logged = getLoggedUserAndPerfil();
      const now = new Date();
      const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      const motivoTrimmed = rejectReasonText.trim();

      const reportEntry = `[NÃO APROVADO NA CONFERÊNCIA - ${dataHoraStr} - Conferente: ${logged.name}]\nMotivo: ${motivoTrimmed}`;

      // Registra esse relato em "Instruções & Observações do Pedido" que está em "FLUXO DE PRODUÇÃO"
      const updatedObservacoes = selectedOsDetail.observacoes
        ? `${reportEntry}\n\n----------------------------------------\n${selectedOsDetail.observacoes}`
        : reportEntry;

      const newHistoryEntry: OsHistoryEntry = {
        id: `HST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        dataHora: dataHoraStr,
        usuario: logged.name,
        perfil: logged.role,
        acao: 'Conferência Não Aprovada (Retorno ao Vendedor)',
        detalhes: `Conferência não aprovada por ${logged.name}. Motivo: ${motivoTrimmed}. OS retornada diretamente para o vendedor (sistema).`,
      };

      const existingAcceptances = (selectedOsDetail.setorAceitoPor || []).filter(
        (s) => s.estagio !== 'Conferência'
      );

      const conferenceRejectRecord = {
        estagio: 'Conferência' as const,
        descricaoEtapa: 'Auditoria e Conferência de Saída',
        funcionario: logged.name,
        aceitoEm: dataHoraStr,
        aceitoEmISO: now.toISOString(),
        status: 'Reprovado / Ajuste' as const,
        observacao: `Não Aprovado na Conferência por ${logged.name}: ${motivoTrimmed}`,
      };

      const updatedOs: OrdemServico = {
        ...selectedOsDetail,
        conferido: false,
        dataConferencia: undefined,
        conferenteNome: undefined,
        observacoesConferencia: `Não Aprovado (${dataHoraStr}): ${motivoTrimmed}`,
        observacoes: updatedObservacoes,
        estagioAtual: 'Sistema', // Retorna direto para o vendedor (sistema)
        setorAceitoPor: [...existingAcceptances, conferenceRejectRecord],
        historicoEdicoes: [newHistoryEntry, ...(selectedOsDetail.historicoEdicoes || [])],
      };

      await ApiService.updateOs(selectedOsDetail.id, updatedOs);

      // Envia alerta para o vendedor com o relato do conferente em notificações
      NotificationService.notifyOsConferenceRejected(updatedOs, logged.name, motivoTrimmed);

      // Local State Update:
      // Como a OS agora está em "Sistema" (Aguardando Entrada no Fluxo de Produção),
      // ela é imediatamente removida da listagem de Conferência.
      setSelectedOsDetail(null);
      setOsList((prev) => prev.filter((item) => item.id !== selectedOsDetail.id));

      setShowRejectModal(false);
      setRejectReasonText('');
      setSuccessToast(`OS #${selectedOsDetail.codigo} marcada como Não Aprovada. Retornada com sucesso para o vendedor!`);
      setTimeout(() => setSuccessToast(null), 4500);

      window.dispatchEvent(new Event('os-changed'));
    } catch (error) {
      console.error('Erro ao registrar não aprovação da conferência:', error);
      alert('Não foi possível registrar a reprovação da OS. Tente novamente.');
    } finally {
      setIsRejectingConference(false);
    }
  };

  // Batch approve selected OS
  const handleBatchApprove = async () => {
    if (selectedOsIds.length === 0) return;
    if (!window.confirm(`Deseja aprovar a conferência de ${selectedOsIds.length} Ordens de Serviço selecionadas?`)) {
      return;
    }

    setIsBatchSaving(true);
    try {
      const logged = getLoggedUserAndPerfil();
      const now = new Date();
      const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

      const promises = selectedOsIds.map(async (id) => {
        const os = osList.find((item) => item.id === id);
        if (!os) return;

        const newHistoryEntry: OsHistoryEntry = {
          id: `HST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          dataHora: dataHoraStr,
          usuario: logged.name,
          perfil: logged.role,
          acao: 'Conferência de OS Aprovada em Lote',
          detalhes: 'Auditoria de saída aprovada em lote via painel ERP clássico.',
        };

        const updatedOs: OrdemServico = {
          ...os,
          conferido: true,
          dataConferencia: dataHoraStr,
          conferenteNome: logged.name,
          historicoEdicoes: [newHistoryEntry, ...(os.historicoEdicoes || [])],
        };

        await ApiService.updateOs(os.id, updatedOs);
        NotificationService.notifyOsConferenced(updatedOs, logged.name);
      });

      await Promise.all(promises);
      await loadData(true);

      setSelectedOsIds([]);
      setSuccessToast(`${selectedOsIds.length} Ordens de Serviço aprovadas com sucesso!`);
      setTimeout(() => setSuccessToast(null), 4000);
      window.dispatchEvent(new Event('os-changed'));
    } catch (error) {
      console.error('Erro no lote de conferência:', error);
      alert('Erro ao processar lote. Verifique a conexão.');
    } finally {
      setIsBatchSaving(false);
    }
  };

  const handleSort = (field: 'codigo' | 'cliente' | 'data' | 'prazo' | 'valor' | 'status') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // FULL-SCREEN PRINT & A4 VIEW FOR OS CONFERENCE (Maintaining Sidebar and Top Header)
  if (selectedOsDetail && modalActiveTab === 'impressao') {
    return (
      <div className="w-full min-h-[calc(100vh-140px)] bg-slate-200/90 p-3 sm:p-4 rounded-3xl space-y-3 border border-slate-300 shadow-sm flex flex-col animate-in fade-in duration-150">
        {/* TOP BAR WITH VOLTAR BUTTON AND CLEAN CONTROLS */}
        <div className="print:hidden w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setModalActiveTab('detalhes');
              }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-blue-400" />
              <span>VOLTAR</span>
            </button>
            <div className="h-5 w-px bg-slate-300 hidden sm:block" />
            <div>
              <span className="text-xs font-black text-slate-800 uppercase tracking-tight block">
                Conferência da OS • {selectedOsDetail.codigo}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Cliente: {selectedOsDetail.clienteNome || 'Geral'}
              </span>
            </div>
          </div>
        </div>

        {/* FULL-WIDTH SCROLLABLE A4 DOCUMENT */}
        <div className="flex justify-center w-full overflow-y-auto py-2">
          <OsPrintableA4
            os={selectedOsDetail}
            initialDocType="OS"
            inlineMode={true}
            hideActionBar={true}
          />
        </div>
      </div>
    );
  }

  // FULL-SCREEN DETAIL & CONFERENCE VIEW (Maintaining Sidebar and Top Header)
  if (selectedOsDetail) {
    return (
      <div className="w-full space-y-3 animate-in fade-in duration-150">
        {/* SUCCESS TOAST NOTIFICATION */}
        {successToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-xs font-black tracking-wide">{successToast}</span>
          </div>
        )}

        {/* FULL WORKSPACE CARD */}
        <div className="bg-white w-full rounded-3xl shadow-sm border border-slate-300 overflow-hidden flex flex-col min-h-[calc(100vh-140px)]">
          {/* HEADER (EXACT BRAZILIAN DATE FORMAT DD/MM/AAAA) */}
          {(() => {
            const detailTheme = getOsVisualTheme(selectedOsDetail);
            return (
              <div className="bg-[#0f172a] text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
                <div className="flex items-center gap-3.5">
                  <div className={`p-3 text-white rounded-2xl shadow-md ${detailTheme.badgeClass}`}>
                    <ClipboardCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                        {selectedOsDetail.codigo.startsWith('OS') ? selectedOsDetail.codigo : `OS #${selectedOsDetail.codigo}`}
                      </h2>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-xs ${detailTheme.badgeClass}`}
                      >
                        {detailTheme.label}
                      </span>
                      {selectedOsDetail.tipoExpedicao && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-white/15 text-white flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5" />
                          Modalidade: {selectedOsDetail.tipoExpedicao}
                        </span>
                      )}
                    </div>
                    {/* RIGOROUS DD/MM/AAAA FORMAT AS REQUESTED */}
                    <p className="text-xs text-slate-300 font-medium mt-1">
                      Cliente: <strong>{selectedOsDetail.clienteNome || 'Geral'}</strong> • Emissão: <strong>{formatDateBr(selectedOsDetail.dataVenda || selectedOsDetail.createdAt)}</strong> • Prazo: <strong className="text-amber-300">{formatDateBr(selectedOsDetail.prazoEntrega)}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setSelectedOsDetail(null)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                    title="Fechar e Voltar"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* TAB BAR NAVIGATION INSIDE DETAIL VIEW */}
          <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setModalActiveTab('impressao')}
              className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                modalActiveTab === 'impressao'
                  ? 'bg-blue-600 text-white font-black shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <FileCheck className="w-4 h-4 text-blue-600" />
              <span>CONFERÊNCIA DA OS</span>
            </button>

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
              onClick={() => setModalActiveTab('conferencia')}
              className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                modalActiveTab === 'conferencia'
                  ? 'bg-emerald-600 text-white font-black shadow-xs'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Aprovar e Liberar OS</span>
            </button>
          </div>

          {/* TAB CONTENT BODY */}
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-6">
            {/* TAB 1: INSPEÇÃO & CHECKLIST DE CONFERÊNCIA (Aprovar e Liberar OS) */}
            {modalActiveTab === 'conferencia' && (
              <div className="space-y-6">
                {/* STATUS & ACTIONS BANNER */}
                <div
                  className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    selectedOsDetail.conferido
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-3 rounded-2xl ${
                        selectedOsDetail.conferido ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                      }`}
                    >
                      {selectedOsDetail.conferido ? <ShieldCheck className="w-7 h-7" /> : <BadgeAlert className="w-7 h-7" />}
                    </div>
                    <div>
                      <h3 className="font-black text-base">
                        {selectedOsDetail.conferido ? 'Conferência de Saída Concluída' : 'Ordem de Serviço Pronta para Conferência'}
                      </h3>
                      <p className="text-xs font-medium opacity-90 mt-0.5">
                        {selectedOsDetail.conferido
                          ? `Validada por ${selectedOsDetail.conferenteNome || 'Conferente'} em ${selectedOsDetail.dataConferencia || 'Data não informada'}.`
                          : 'Realize a auditoria física dos itens. Se aprovada, libere para entrega/expedição; se houver pendência ou erro, marque como Não Aprovado.'}
                      </p>
                    </div>
                  </div>

                  {/* ACTION BUTTONS: NÃO APROVADO & APROVAR */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setRejectReasonText('');
                        setShowRejectModal(true);
                      }}
                      disabled={isSavingConference || isRejectingConference}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white shadow-md cursor-pointer disabled:opacity-50 active:scale-95"
                      title="Marcar como não aprovado e relatar motivo para o vendedor"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Não Aprovado</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleApproveConference}
                      disabled={isSavingConference || isRejectingConference}
                      className={`px-5 py-2.5 rounded-xl font-black text-xs transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 active:scale-95 ${
                        selectedOsDetail.conferido
                          ? 'bg-emerald-800 hover:bg-emerald-900 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isSavingConference
                          ? 'Salvando...'
                          : selectedOsDetail.conferido
                          ? 'Revalidar Conferência'
                          : 'Aprovar e Liberar OS'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* CHECKLIST DE AUDITORIA & INSPEÇÃO FÍSICA */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-blue-600" />
                        Checklist de Conferência Física & Qualidade
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Confirme a verificação de todos os quesitos obrigatórios antes de aprovar
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[11px] font-extrabold rounded-lg">
                      Auditoria de Saída
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={checklist.itensQtd}
                        onChange={(e) => setChecklist({ ...checklist, itensQtd: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">1. Quantidade de Peças/Itens</span>
                        <span className="text-[11px] text-slate-500">Contagem física confere com o pedido</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={checklist.medidasDimensoes}
                        onChange={(e) => setChecklist({ ...checklist, medidasDimensoes: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">2. Medidas e Dimensões</span>
                        <span className="text-[11px] text-slate-500">Tamanhos e gabaritos corretos</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={checklist.tecidoMaterial}
                        onChange={(e) => setChecklist({ ...checklist, tecidoMaterial: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">3. Tecido & Material</span>
                        <span className="text-[11px] text-slate-500">Gramatura e material solicitado</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={checklist.qualidadeEstampa}
                        onChange={(e) => setChecklist({ ...checklist, qualidadeEstampa: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">4. Qualidade da Estampa & Cor</span>
                        <span className="text-[11px] text-slate-500">Sublimação nítida e sem falhas</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={checklist.acabamentoCostura}
                        onChange={(e) => setChecklist({ ...checklist, acabamentoCostura: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">5. Acabamento & Costura</span>
                        <span className="text-[11px] text-slate-500">Bainhas, overloque e ilhoses firmes</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={checklist.etiquetasEmbalagem}
                        onChange={(e) => setChecklist({ ...checklist, etiquetasEmbalagem: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">6. Embalagem & Identificação</span>
                        <span className="text-[11px] text-slate-500">Devidamente dobrado e etiquetado</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* OBSERVAÇÕES DA CONFERÊNCIA */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <label className="font-black text-xs text-slate-800 uppercase tracking-wider block">
                    Observações e Ressalvas do Conferente:
                  </label>
                  <textarea
                    value={conferenceNotes}
                    onChange={(e) => setConferenceNotes(e.target.value)}
                    rows={3}
                    placeholder="Insira observações opcionais sobre a conferência de saída..."
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* RESUMO DOS ITENS DA OS */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider">
                    Itens Cadastrados no Pedido ({selectedOsDetail.itens?.length || 0})
                  </h4>
                  {selectedOsDetail.itens && selectedOsDetail.itens.length > 0 ? (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                      {selectedOsDetail.itens.map((item, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 flex items-center justify-between gap-3">
                          <div>
                            <span className="font-bold text-slate-900 block">{item.descricao || `Item #${idx + 1}`}</span>
                            <span className="text-slate-500 text-[11px]">
                              {item.categoria ? `Categoria: ${item.categoria}` : ''} {item.unidade ? `• Unidade: ${item.unidade}` : ''}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-slate-900 block">{item.quantidade}x</span>
                            <span className="text-slate-500 text-[11px]">{formatMoney(item.total || item.valorUnitario || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Nenhum item específico listado nesta OS.</p>
                  )}
                </div>
              </div>
            )}

            {/* MODAL DE OBSERVAÇÃO / MOTIVO DE NÃO APROVADO */}
            {showRejectModal && (
              <div
                className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
                onClick={() => setShowRejectModal(false)}
              >
                <div
                  className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] text-slate-800 animate-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="bg-rose-50 border-b border-rose-200 text-rose-950 p-4 sm:p-5 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-rose-600 text-white rounded-2xl shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-base leading-tight">
                          Não Aprovado na Conferência
                        </h3>
                        <p className="text-xs font-semibold text-rose-800 mt-0.5">
                          OS #{selectedOsDetail.codigo} • Cliente: {selectedOsDetail.clienteNome || 'Geral'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRejectModal(false)}
                      className="p-1.5 rounded-xl hover:bg-rose-100 text-rose-700 transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-5 overflow-y-auto space-y-4 text-xs font-medium text-slate-700">
                    <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl text-[11px] text-rose-900 space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        Aviso de Retorno ao Vendedor (Sistema)
                      </p>
                      <p className="leading-relaxed text-rose-800">
                        Ao confirmar a não aprovação, esta OS retornará direto para o vendedor no sistema. O relato preenchido abaixo será registrado em <strong>Instruções & Observações do Pedido</strong> (no Fluxo de Produção) e enviado com alerta imediato para o vendedor em notificações.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-black text-xs text-slate-900 block">
                        Relato do Conferente (Motivo da Não Aprovação): <span className="text-rose-600">*</span>
                      </label>
                      <textarea
                        value={rejectReasonText}
                        onChange={(e) => setRejectReasonText(e.target.value)}
                        rows={4}
                        autoFocus
                        placeholder="Ex: Faltam 2 peças tamanho M do item #1, e a estampa do banner veio com tonalidade diferente da aprovada pelo cliente. Favor corrigir na produção..."
                        className="w-full p-3.5 rounded-2xl border-2 border-rose-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden transition resize-y font-medium"
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowRejectModal(false)}
                      disabled={isRejectingConference}
                      className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleRejectConference}
                      disabled={isRejectingConference || !rejectReasonText.trim()}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 active:scale-95"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{isRejectingConference ? 'Registrando...' : 'Confirmar e Retornar ao Vendedor'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DETALHES & ITENS */}
            {modalActiveTab === 'detalhes' && (
              <div className="space-y-6">
                {/* DADOS CADASTRAIS DO CLIENTE */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
                  <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-blue-600" />
                    Informações do Cliente e da Ordem
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-700">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 font-bold uppercase block text-[10px]">Cliente</span>
                      <p className="font-black text-slate-900 text-sm">{selectedOsDetail.clienteNome || 'Cliente Geral'}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 font-bold uppercase block text-[10px]">Telefone / Contato</span>
                      <p className="font-black text-slate-900 text-sm">{selectedOsDetail.clienteTelefone || '-'}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 font-bold uppercase block text-[10px]">CPF / CNPJ</span>
                      <p className="font-black text-slate-900 text-sm">{selectedOsDetail.clienteCpfCnpj || '-'}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 font-bold uppercase block text-[10px]">Data de Emissão</span>
                      <p className="font-black text-slate-900 text-sm">{formatDateBr(selectedOsDetail.dataVenda || selectedOsDetail.createdAt)}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 font-bold uppercase block text-[10px]">Prazo de Entrega</span>
                      <p className="font-black text-amber-800 text-sm">{formatDateBr(selectedOsDetail.prazoEntrega)}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 font-bold uppercase block text-[10px]">Atendente / Vendedor</span>
                      <p className="font-black text-blue-700 text-sm">{selectedOsDetail.operador || 'Sistema'}</p>
                    </div>
                  </div>

                  {/* OBSERVAÇÕES GERAIS */}
                  {selectedOsDetail.observacoes && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-xs font-bold text-amber-900 uppercase block mb-1">Observações da OS:</span>
                      <p className="text-xs text-amber-950 font-medium">{selectedOsDetail.observacoes}</p>
                    </div>
                  )}
                </div>

                {/* RESUMO FINANCEIRO */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    Resumo Financeiro da OS
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 font-bold uppercase block text-[10px]">Valor Bruto</span>
                      <p className="font-black text-slate-800 text-sm">{formatMoney(selectedOsDetail.valorTotal || 0)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 font-bold uppercase block text-[10px]">Desconto</span>
                      <p className="font-black text-red-600 text-sm">{formatMoney(selectedOsDetail.desconto || 0)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 font-bold uppercase block text-[10px]">Entrada Paga</span>
                      <p className="font-black text-emerald-700 text-sm">{formatMoney(selectedOsDetail.valorEntrada || 0)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <span className="text-blue-700 font-bold uppercase block text-[10px]">Valor Final</span>
                      <p className="font-black text-blue-900 text-base">{formatMoney(selectedOsDetail.valorFinal || 0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: COMPROVANTES DE PAGAMENTO */}
            {modalActiveTab === 'comprovantes' && (
              <div className="space-y-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
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

            {/* TAB 4: HISTÓRICO & ALTERAÇÕES */}
            {modalActiveTab === 'historico' && (
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
                                <span className="font-black text-xs text-slate-900">Abertura e Lançamento de OS</span>
                                <span className="text-[10px] font-semibold text-slate-400">• {formatDateBr(selectedOsDetail.dataVenda || selectedOsDetail.createdAt)}</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">
                                Ordem de Serviço criada e vinculada ao cliente {selectedOsDetail.clienteNome || 'Cliente não informado'}.
                              </p>
                              <span className="text-[10px] font-bold text-blue-700 block mt-1">Operador: {selectedOsDetail.operador || 'Atendente'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-100px)] bg-[#cbd5e1] p-3 sm:p-4 rounded-3xl space-y-3 border border-slate-300 shadow-sm flex flex-col justify-between">
      {/* SUCCESS TOAST NOTIFICATION */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-xs font-black tracking-wide">{successToast}</span>
        </div>
      )}

      <div className="space-y-3">
        {/* TOP CONTROLS & FILTER BAR (WHITE HEADER CARD) */}
        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            {/* LEFT: TITLE & ICON */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight uppercase">
                    Conferência de OS (ERP Clássico)
                  </h1>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] font-black rounded-md">
                    Grade de Alta Densidade
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Auditoria de saída, conferência física de peças e controle de qualidade
                </p>
              </div>
            </div>

            {/* RIGHT: SEARCH, SHORTCUTS, DATE PICKER & REFRESH */}
            <div className="flex flex-wrap items-center gap-2 justify-start xl:justify-end">
              {/* SEARCH INPUT */}
              <div className="relative min-w-[220px] sm:min-w-[260px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por OS, cliente, CPF, item ou conferente..."
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-[11px] font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* PERIOD SHORTCUTS PILLS */}
              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-full border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => handleShortcutChange('today')}
                  className={`px-2.5 py-1 rounded-full font-bold text-[11px] transition cursor-pointer ${
                    selectedShortcut === 'today' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => handleShortcutChange('7days')}
                  className={`px-2.5 py-1 rounded-full font-bold text-[11px] transition cursor-pointer ${
                    selectedShortcut === '7days' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  7D
                </button>
                <button
                  type="button"
                  onClick={() => handleShortcutChange('30days')}
                  className={`px-2.5 py-1 rounded-full font-bold text-[11px] transition cursor-pointer ${
                    selectedShortcut === '30days' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  30D
                </button>
                <button
                  type="button"
                  onClick={() => handleShortcutChange('month')}
                  className={`px-2.5 py-1 rounded-full font-bold text-[11px] transition cursor-pointer ${
                    selectedShortcut === 'month' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Mês
                </button>
                <button
                  type="button"
                  onClick={() => handleShortcutChange('all')}
                  className={`px-2.5 py-1 rounded-full font-bold text-[11px] transition cursor-pointer ${
                    selectedShortcut === 'all' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Todos
                </button>
              </div>

              {/* DATE RANGE DISPLAY (DD/MM/AAAA) */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 text-[11px] font-bold text-slate-700">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setSelectedShortcut('custom');
                  }}
                  className="bg-transparent text-slate-700 text-[11px] font-bold focus:outline-none w-26 cursor-pointer"
                />
                <span className="text-slate-400 font-bold">a</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setSelectedShortcut('custom');
                  }}
                  className="bg-transparent text-slate-700 text-[11px] font-bold focus:outline-none w-26 cursor-pointer"
                />
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>

              {/* REFRESH BUTTON */}
              <button
                type="button"
                onClick={() => loadData()}
                disabled={isLoading}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-full transition flex items-center justify-center cursor-pointer border border-slate-200 disabled:opacity-50"
                title="Atualizar Dados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* BATCH ACTION BAR IF ITEMS SELECTED */}
          {selectedOsIds.length > 0 && (
            <div className="mt-2.5 bg-blue-50 border border-blue-200 p-2 rounded-xl flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-600 text-white font-black text-xs rounded-md">
                  {selectedOsIds.length} selecionadas
                </span>
                <span className="text-xs font-bold text-blue-900">
                  Ações em lote disponíveis para os registros marcados
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBatchApprove}
                  disabled={isBatchSaving}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isBatchSaving ? 'Aprovando...' : 'Aprovar Conferência em Lote'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOsIds([])}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition cursor-pointer"
                >
                  Limpar Seleção
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CLASSIC HIGH DENSITY ERP TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] sm:text-xs">
              <thead>
                <tr className="bg-white text-slate-800 font-bold border-b border-slate-200 select-none">
                  {/* CHECKBOX */}
                  <th className="p-2 sm:p-2.5 text-center w-8 border-r border-slate-100">
                    <input
                      type="checkbox"
                      checked={filteredOsList.length > 0 && selectedOsIds.length === filteredOsList.length}
                      onChange={handleSelectAll}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </th>

                  {/* INFO (i) BADGE / DETALHES */}
                  <th className="p-2 sm:p-2.5 text-center w-8 border-r border-slate-100">
                    <span>Info</span>
                  </th>

                  {/* MODALIDADE / EXPEDIÇÃO */}
                  <th className="p-2 sm:p-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                    <span>Modalidade</span>
                  </th>

                  {/* CÓDIGO DA OS */}
                  <th
                    onClick={() => handleSort('codigo')}
                    className="p-2 sm:p-2.5 cursor-pointer hover:bg-slate-50 transition border-r border-slate-100 whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>Nº OS</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* CLIENTE */}
                  <th
                    onClick={() => handleSort('cliente')}
                    className="p-2 sm:p-2.5 cursor-pointer hover:bg-slate-50 transition border-r border-slate-100"
                  >
                    <div className="flex items-center gap-1">
                      <span>Cliente / Documento</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* ITENS / PRODUTOS */}
                  <th className="p-2 sm:p-2.5 border-r border-slate-100">
                    <span>Itens & Descrição Resumida</span>
                  </th>

                  {/* QUANTIDADE DE PEÇAS */}
                  <th className="p-2 sm:p-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                    <span>Qtd Peças</span>
                  </th>

                  {/* DATA DE EMISSÃO */}
                  <th
                    onClick={() => handleSort('data')}
                    className="p-2 sm:p-2.5 text-center cursor-pointer hover:bg-slate-50 transition border-r border-slate-100 whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Emissão</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* DATA DE PRAZO (DD/MM/AAAA) */}
                  <th
                    onClick={() => handleSort('prazo')}
                    className="p-2 sm:p-2.5 text-center cursor-pointer hover:bg-slate-50 transition border-r border-slate-100 whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Prazo (DD/MM/AAAA)</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* VALOR TOTAL */}
                  <th
                    onClick={() => handleSort('valor')}
                    className="p-2 sm:p-2.5 text-right cursor-pointer hover:bg-slate-50 transition border-r border-slate-100 whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Valor Total</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* STATUS CONFERÊNCIA */}
                  <th
                    onClick={() => handleSort('status')}
                    className="p-2 sm:p-2.5 text-center cursor-pointer hover:bg-slate-50 transition border-r border-slate-100 whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status / Auditoria</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* CONFERENTE / AUDITOR */}
                  <th className="p-2 sm:p-2.5 border-r border-slate-100 whitespace-nowrap">
                    <span>Conferente</span>
                  </th>

                  {/* AÇÕES */}
                  <th className="p-2 sm:p-2.5 text-center whitespace-nowrap">
                    <span>Ações</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredOsList.length > 0 ? (
                  filteredOsList.map((os) => {
                    const isSelected = selectedOsIds.includes(os.id);
                    const isConferida = Boolean(os.conferido);
                    const theme = getOsVisualTheme(os);
                    const modalityTheme = getModalityVisualTheme(os.tipoExpedicao);
                    const totalPecas = (os.itens || []).reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);
                    const resumoItens = (os.itens || []).map((i) => i.descricao).join(', ') || 'Item padrão';
                    const valorTotal = os.valorFinal || 0;

                    const dataEmissaoBr = formatDateBr(os.dataVenda || os.createdAt);
                    const prazoEntregaBr = formatDateBr(os.prazoEntrega);

                    return (
                      <tr
                        key={os.id}
                        className={`transition duration-75 select-none ${theme.borderLeftClass} ${
                          isSelected ? 'bg-blue-100/90' : theme.rowClass
                        }`}
                      >
                        {/* CHECKBOX */}
                        <td className="p-2 sm:p-2.5 text-center border-r border-slate-100">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(os.id)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* INFO (i) BADGE */}
                        <td className="p-2 sm:p-2.5 text-center border-r border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(os, 'conferencia')}
                            className="w-5 h-5 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition inline-flex items-center justify-center shadow-2xs cursor-pointer text-[10px] font-black"
                            title="Inspecionar Ordem de Serviço"
                          >
                            <Info className="w-3 h-3" />
                          </button>
                        </td>

                        {/* MODALIDADE / EXPEDIÇÃO (COLOR BADGE) */}
                        <td className="p-2 sm:p-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] uppercase font-black shadow-2xs ${modalityTheme.badgeClass}`}>
                            <Truck className="w-3 h-3 shrink-0" />
                            {modalityTheme.label}
                          </span>
                        </td>

                        {/* CÓDIGO DA OS */}
                        <td className="p-2 sm:p-2.5 font-bold text-blue-600 border-r border-slate-100 whitespace-nowrap">
                          <span
                            onClick={() => handleOpenDetailModal(os, 'conferencia')}
                            className="hover:underline cursor-pointer font-extrabold"
                          >
                            {os.codigo.startsWith('OS') ? os.codigo : `OS #${os.codigo}`}
                          </span>
                        </td>

                        {/* CLIENTE & DOC */}
                        <td className="p-2 sm:p-2.5 border-r border-slate-100 max-w-[180px] truncate">
                          <div className="truncate">
                            <span className="font-extrabold text-slate-900 block truncate" title={os.clienteNome}>
                              {os.clienteNome || 'Cliente não informado'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold block truncate">
                              {os.clienteCpfCnpj ? `Doc: ${os.clienteCpfCnpj}` : os.clienteTelefone || 'Balcão'}
                            </span>
                          </div>
                        </td>

                        {/* ITENS & DESCRIÇÃO */}
                        <td className="p-2 sm:p-2.5 border-r border-slate-100 max-w-[260px] truncate">
                          <span className="text-slate-800 font-bold block truncate" title={resumoItens}>
                            {resumoItens}
                          </span>
                        </td>

                        {/* QUANTIDADE DE PEÇAS */}
                        <td className="p-2 sm:p-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded text-[10px]">
                            {totalPecas > 0 ? totalPecas : (os.itens?.length || 1)} UN
                          </span>
                        </td>

                        {/* DATA DE EMISSÃO (DD/MM/AAAA) */}
                        <td className="p-2 sm:p-2.5 text-center text-slate-700 font-semibold border-r border-slate-100 whitespace-nowrap">
                          {dataEmissaoBr}
                        </td>

                        {/* DATA DE PRAZO (DD/MM/AAAA) */}
                        <td className="p-2 sm:p-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                              prazoEntregaBr === '-'
                                ? 'text-slate-400 bg-slate-100'
                                : 'text-blue-900 bg-blue-50/80 border border-blue-200/80'
                            }`}
                          >
                            {prazoEntregaBr}
                          </span>
                        </td>

                        {/* VALOR TOTAL */}
                        <td className="p-2 sm:p-2.5 text-right font-black text-slate-900 border-r border-slate-100 whitespace-nowrap">
                          {formatMoney(valorTotal)}
                        </td>

                        {/* STATUS / AUDITORIA */}
                        <td className="p-2 sm:p-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                          {isConferida ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-600 text-white font-black rounded-full text-[10px] uppercase shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                              CONFERIDO
                            </span>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-600 text-white font-black rounded-full text-[10px] uppercase shadow-2xs">
                                <AlertCircle className="w-3 h-3" />
                                {os.estagioAtual === 'Conferência' ? 'EM CONFERÊNCIA' : `EM ${os.estagioAtual.toUpperCase()}`}
                              </span>
                              {os.estagioAtual !== 'Conferência' && (
                                <span className="text-[9px] font-bold text-slate-500">
                                  Fluxo: {os.estagioAtual}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* CONFERENTE */}
                        <td className="p-2 sm:p-2.5 border-r border-slate-100 text-slate-600 text-[11px] whitespace-nowrap">
                          {os.conferenteNome || (isConferida ? 'Sistema / Expedição' : 'Pendente')}
                        </td>

                        {/* AÇÕES */}
                        <td className="p-2 sm:p-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(os, 'conferencia')}
                              className="p-1 bg-[#e65100] hover:bg-[#d84315] text-white font-bold rounded transition cursor-pointer shadow-2xs"
                              title="Conferir e Inspecionar Itens"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(os, 'detalhes')}
                              className="p-1 bg-white hover:bg-blue-50 text-blue-600 font-bold rounded border border-slate-200 transition cursor-pointer"
                              title="Ver Detalhes e Itens"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(os, 'impressao')}
                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded transition cursor-pointer shadow-2xs"
                              title="CONFERÊNCIA DA OS"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={13} className="p-10 text-center text-slate-500 font-bold bg-slate-50">
                      <div className="max-w-md mx-auto space-y-2">
                        <ClipboardCheck className="w-10 h-10 text-slate-400 mx-auto" />
                        <p className="text-sm font-black text-slate-700">Nenhuma Ordem de Serviço encontrada</p>
                        <p className="text-xs text-slate-500">
                          Ajuste os filtros de busca ou período de datas para visualizar os registros de OS.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER */}
          <div className="bg-white p-3 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs font-bold text-slate-700">
            <div>
              <span>Exibindo <strong>{filteredOsList.length}</strong> de <strong>{osList.length}</strong> Ordens de Serviço</span>
            </div>

            <div>
              <span>Total Somado em Tela: <strong className="text-slate-900 text-sm font-black">{formatMoney(totalGeralVal)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM MODALITY & STATUS FILTER DOCK PILLS (EXACT AS IMAGE) */}
      <div className="flex justify-center items-center gap-3 pt-6 pb-2 flex-wrap select-none">
        {/* 1. TODAS AS OS / VISÃO GERAL */}
        <button
          type="button"
          onClick={() => setPriorityFilter('ALL')}
          className={`rounded-2xl border-2 border-slate-900 px-4 py-1.5 flex items-center gap-3 cursor-pointer shadow-xs transition active:scale-95 ${
            priorityFilter === 'ALL'
              ? 'bg-slate-900 text-white ring-2 ring-slate-400/50'
              : 'bg-white text-slate-900 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full border-2 border-dashed flex items-center justify-center shrink-0 ${
              priorityFilter === 'ALL' ? 'border-white' : 'border-slate-900'
            }`} />
            <div className="text-left">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight block leading-tight">
                TODAS AS OS
              </span>
              <span className={`text-[8.5px] font-bold block uppercase tracking-tight ${
                priorityFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
              }`}>
                VISÃO GERAL
              </span>
            </div>
          </div>
          <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ml-1 ${
            priorityFilter === 'ALL' ? 'bg-white text-slate-900' : 'bg-slate-100 border border-slate-300 text-slate-900'
          }`}>
            {stats.total}
          </span>
        </button>

        {/* 2. NORMAL / Azul (Padrão) */}
        <button
          type="button"
          onClick={() => setPriorityFilter('NORMAL')}
          className={`rounded-2xl border-2 border-blue-600 px-4 py-1.5 flex items-center gap-3 cursor-pointer shadow-xs transition active:scale-95 ${
            priorityFilter === 'NORMAL'
              ? 'bg-blue-600 text-white ring-2 ring-blue-400/50'
              : 'bg-white text-blue-900 hover:bg-blue-50/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-300 shrink-0" />
            <div className="text-left">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight block leading-tight text-blue-900 dark:text-inherit">
                NORMAL
              </span>
              <span className={`text-[8.5px] font-bold block ${
                priorityFilter === 'NORMAL' ? 'text-blue-100' : 'text-blue-600/80'
              }`}>
                Azul (Padrão)
              </span>
            </div>
          </div>
          <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ml-1 ${
            priorityFilter === 'NORMAL' ? 'bg-white text-blue-900' : 'bg-blue-100 text-blue-900'
          }`}>
            {stats.normal}
          </span>
        </button>

        {/* 3. EXPRESSO DO DIA / Laranja (#FFA500) */}
        <button
          type="button"
          onClick={() => setPriorityFilter('EXPRESSO DO DIA')}
          className={`rounded-2xl border-2 border-[#FFA500] px-4 py-1.5 flex items-center gap-3 cursor-pointer shadow-xs transition active:scale-95 ${
            priorityFilter === 'EXPRESSO DO DIA'
              ? 'bg-[#FFA500] text-slate-950 ring-2 ring-orange-400/50'
              : 'bg-white text-orange-950 hover:bg-orange-50/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#FFA500] ring-2 ring-orange-300 shrink-0" />
            <div className="text-left">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight block leading-tight text-orange-950 dark:text-inherit">
                EXPRESSO DO DIA
              </span>
              <span className={`text-[8.5px] font-bold block ${
                priorityFilter === 'EXPRESSO DO DIA' ? 'text-slate-900/80' : 'text-orange-700/80'
              }`}>
                Laranja (#FFA500)
              </span>
            </div>
          </div>
          <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ml-1 ${
            priorityFilter === 'EXPRESSO DO DIA' ? 'bg-black/20 text-slate-950' : 'bg-orange-100 text-orange-950'
          }`}>
            {stats.expressoDia}
          </span>
        </button>

        {/* 4. EXPRESSO EXCURSÃO / Vermelho (Urgente) */}
        <button
          type="button"
          onClick={() => setPriorityFilter('EXPRESSO EXCURSÃO')}
          className={`rounded-2xl border-2 border-red-500 px-4 py-1.5 flex items-center gap-3 cursor-pointer shadow-xs transition active:scale-95 ${
            priorityFilter === 'EXPRESSO EXCURSÃO'
              ? 'bg-red-600 text-white ring-2 ring-red-400/50'
              : 'bg-white text-red-950 hover:bg-red-50/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600 ring-2 ring-red-300 shrink-0" />
            <div className="text-left">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight block leading-tight text-red-950 dark:text-inherit">
                EXPRESSO EXCURSÃO
              </span>
              <span className={`text-[8.5px] font-bold block ${
                priorityFilter === 'EXPRESSO EXCURSÃO' ? 'text-red-100' : 'text-red-700/80'
              }`}>
                Vermelho (Urgente)
              </span>
            </div>
          </div>
          <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ml-1 ${
            priorityFilter === 'EXPRESSO EXCURSÃO' ? 'bg-white text-red-900' : 'bg-red-100 text-red-950'
          }`}>
            {stats.expressoExcursao}
          </span>
        </button>

        {/* 5. CONFERIDOS / Verde (Liberados) */}
        <button
          type="button"
          onClick={() => setPriorityFilter('CONFERIDAS')}
          className={`rounded-2xl border-2 border-emerald-600 px-4 py-1.5 flex items-center gap-3 cursor-pointer shadow-xs transition active:scale-95 ${
            priorityFilter === 'CONFERIDAS'
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/50'
              : 'bg-white text-emerald-950 hover:bg-emerald-50/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600 ring-2 ring-emerald-300 shrink-0" />
            <div className="text-left">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight block leading-tight text-emerald-950 dark:text-inherit">
                CONFERIDOS
              </span>
              <span className={`text-[8.5px] font-bold block ${
                priorityFilter === 'CONFERIDAS' ? 'text-emerald-100' : 'text-emerald-700/80'
              }`}>
                Verde (Liberados)
              </span>
            </div>
          </div>
          <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ml-1 ${
            priorityFilter === 'CONFERIDAS' ? 'bg-white text-emerald-900' : 'bg-emerald-100 text-emerald-950'
          }`}>
            {stats.conferidos}
          </span>
        </button>
      </div>
    </div>
  );
};

