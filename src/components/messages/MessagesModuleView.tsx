import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Users,
  Send,
  Paperclip,
  Trash2,
  Plus,
  Search,
  FileText,
  Download,
  Building2,
  Shield,
  ShieldAlert,
  Clock,
  Sparkles,
  CheckCheck,
  Check,
  X,
  AlertTriangle,
  Lock,
  UserCheck,
  MessageSquareHeart,
  Pencil,
  Bell,
  CheckCircle,
  Image as ImageIcon,
  Radio,
  Volume2,
  Award,
  ArrowLeft,
  ChevronLeft,
  Headphones,
} from 'lucide-react';
import { UserProfile } from '../../types/frontend';
import {
  ChatMessage,
  ChatContact,
  MessageGroup,
  ChatAttachment,
  ChatAuditLog,
  SupportTicket,
} from '../../types/chat';
import { ApiService } from '../../services/api';
import {
  sortContactsByHierarchy,
  getRoleCategoryLabel,
  getRoleBadgeStyle,
} from '../../utils/roleHierarchy';
import {
  useInactivityTimeout,
  DEFAULT_INACTIVITY_MINUTES,
} from '../../utils/useUserPresence';
import {
  formatOfflineLastSeen,
  formatOfflineLastSeenShort,
  formatAwayDuration,
  formatAwayDurationShort,
} from '../../utils/presenceDateUtils';
import {
  getLoggedUserAndPerfil,
  isDeveloperOrAdminMaster,
} from '../../utils/userPermissions';

export const DEFAULT_SUPPORT_AVATAR =
  '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png';

function getPresenceInfo(
  presenceStatus?: 'online' | 'away' | 'offline',
  isOnline?: boolean,
  inactivityMinutes: number = 5,
  lastSeen?: string | number | Date | null,
  awaySince?: string | number | Date | null
) {
  const status = presenceStatus || (isOnline ? 'online' : 'offline');
  if (status === 'online') {
    return {
      status: 'online' as const,
      dotClass: 'bg-emerald-500',
      ringClass: 'ring-emerald-400/40',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: 'Online',
      tooltip: 'Online (com o sistema aberto e ativo)',
      offlineText: '',
      awayText: '',
      awayShortText: '',
    };
  }
  if (status === 'away') {
    const awayText = formatAwayDuration(awaySince || lastSeen);
    const awayShortText = formatAwayDurationShort(awaySince || lastSeen);
    return {
      status: 'away' as const,
      dotClass: 'bg-amber-400',
      ringClass: 'ring-amber-400/40',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      label: 'Ausente',
      awayText,
      awayShortText,
      tooltip: `${awayText.charAt(0).toUpperCase() + awayText.slice(1)} (sem mexer o mouse ou digitar há mais de ${inactivityMinutes} min)`,
      offlineText: '',
    };
  }
  const offlineText = formatOfflineLastSeen(lastSeen);
  return {
    status: 'offline' as const,
    dotClass: 'bg-slate-400',
    ringClass: 'ring-slate-300/40',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    label: 'Offline',
    offlineText,
    awayText: '',
    awayShortText: '',
    tooltip: offlineText,
  };
}

interface MessagesModuleViewProps {
  user: UserProfile;
  supportTriggerKey?: number;
}

export const MessagesModuleView: React.FC<MessagesModuleViewProps> = ({ user, supportTriggerKey }) => {
  const [activeTab, setActiveTab] = useState<'contacts' | 'groups' | 'support' | 'audit'>('contacts');
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [groups, setGroups] = useState<MessageGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportFilter, setSupportFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [supportSearchTerm, setSupportSearchTerm] = useState<string>('');

  // Presence & Inactivity Timeout Configuration State
  const [inactivityMinutes, setInactivityMinutes] = useInactivityTimeout();
  const [isPresenceConfigModalOpen, setIsPresenceConfigModalOpen] = useState<boolean>(false);
  const [tempInactivityMinutes, setTempInactivityMinutes] = useState<number>(inactivityMinutes);

  // Permissões: Apenas Administrador Master e Developer podem visualizar e configurar o tempo de inatividade/ausente
  const logged = getLoggedUserAndPerfil();
  const canConfigPresence = Boolean(
    isDeveloperOrAdminMaster(user?.role, user?.isDeveloper, user?.username, user?.name) ||
    isDeveloperOrAdminMaster(logged?.role, logged?.isDeveloper, logged?.username, logged?.name)
  );

  // Re-render periodically to keep relative time strings (e.g., "offline: último acesso a 5 minutos") updated
  const [, setPresenceTick] = useState<number>(0);
  useEffect(() => {
    const ticker = setInterval(() => {
      setPresenceTick((prev) => prev + 1);
    }, 20000);
    return () => clearInterval(ticker);
  }, []);

  // Active Chat Target: starts with General Company channel (Open to all)
  const [activeTarget, setActiveTarget] = useState<{
    type: 'user' | 'group' | 'sector';
    id: string;
    name: string;
    subtitle: string;
    sector?: string;
    avatarUrl?: string;
    role?: string;
    isPublic?: boolean;
  } | null>({
    type: 'group',
    id: 'GRP-GERAL-EMPRESA',
    name: 'Geral (Todos os Colaboradores)',
    subtitle: 'Canal coletivo da empresa • Aberto a todos',
    sector: 'Geral',
    isPublic: true,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Group creation & edition modal state
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState<boolean>(false);
  const [editingGroup, setEditingGroup] = useState<MessageGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupDesc, setNewGroupDesc] = useState<string>('');
  const [newGroupSector, setNewGroupSector] = useState<string>('Geral');
  const [selectedGroupRoles, setSelectedGroupRoles] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [onlyShowMatchingRole, setOnlyShowMatchingRole] = useState<boolean>(false);

  // Mobile Active View: 'list' (Contacts/Groups) or 'chat' (Active conversation)
  const [mobileActiveView, setMobileActiveView] = useState<'list' | 'chat'>('list');

  const handleSelectTarget = (target: {
    type: 'user' | 'group' | 'sector';
    id: string;
    name: string;
    subtitle: string;
    sector?: string;
    avatarUrl?: string;
    role?: string;
    isPublic?: boolean;
  }) => {
    setActiveTarget(target);
    setMobileActiveView('chat');
  };

  // Preview Image Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // On-screen notice for directed messages & group actions
  const [directedNotice, setDirectedNotice] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  // Auto-dismiss confirmation feedback (cadastros, alterações e salvamentos) after 3 seconds
  useEffect(() => {
    if (directedNotice && directedNotice.type === 'success') {
      const timer = setTimeout(() => {
        setDirectedNotice(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [directedNotice]);

  // Developer Audit State
  const [auditData, setAuditData] = useState<{
    messages: ChatMessage[];
    groups: MessageGroup[];
    auditLogs: ChatAuditLog[];
    stats: { totalMessages: number; totalGroups: number; totalAttachments: number };
  } | null>(null);
  const [auditSearchTerm, setAuditSearchTerm] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Contacts and Groups
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [cts, grps] = await Promise.all([
        ApiService.getChatContacts(),
        ApiService.getChatGroups(),
      ]);

      // FILTER RULE: Developer profile is NEVER shown in selectable contact list for non-Developer users
      setContacts(cts);
      setGroups(grps);

      if (user.isDeveloper) {
        const audit = await ApiService.getDeveloperChatAudit();
        setAuditData(audit);
      }
      if (canConfigPresence) {
        const tickets = await ApiService.listSupportTickets();
        setSupportTickets(tickets || []);
      }
    } catch (err) {
      console.error('Failed to load messaging data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSupportTickets = async () => {
    if (!canConfigPresence) return;
    try {
      const tickets = await ApiService.listSupportTickets();
      setSupportTickets(tickets || []);
    } catch {
      // silent
    }
  };

  const handleToggleResolveTicket = async () => {
    if (!activeTarget || activeTarget.type !== 'user') return;
    const ticket = supportTickets.find((t) => t.userId === activeTarget.id);
    const newStatus = ticket?.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED';
    try {
      await ApiService.resolveSupportTicket(activeTarget.id, newStatus);
      await loadSupportTickets();
      setDirectedNotice({
        type: 'success',
        text: `Chamado ${newStatus === 'RESOLVED' ? 'concluído e resolvido' : 'reaberto'} com sucesso.`,
      });
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status do chamado.');
    }
  };

  // Support trigger key from Sidebar support button
  useEffect(() => {
    if (!supportTriggerKey) return;
    if (canConfigPresence) {
      setActiveTab('support');
      loadSupportTickets();
    } else {
      setActiveTab('contacts');
      handleSelectTarget({
        type: 'user',
        id: 'SYS-SUPPORT',
        name: 'Suporte do Sistema',
        avatarUrl: supportContact?.avatarUrl || user?.supportAvatarUrl || DEFAULT_SUPPORT_AVATAR,
        subtitle: 'Central de Atendimento & TI • Suporte Técnico',
        sector: 'Suporte Técnico',
        role: 'Central de Atendimento & TI',
        isPublic: false,
      });
      setMobileActiveView('chat');
    }
  }, [supportTriggerKey]);

  useEffect(() => {
    loadInitialData();

    // Polling periódico para manter os status de presença (online, ausente, offline) sempre atualizados
    const presenceInterval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const cts = await ApiService.getChatContacts();
        setContacts(cts);
        if (canConfigPresence) {
          const tickets = await ApiService.listSupportTickets();
          setSupportTickets(tickets || []);
        }
      } catch {
        // silent
      }
    }, 30000);

    // Listener para atualização em tempo real da foto oficial do suporte
    const handleSupportAvatarEvent = (e: any) => {
      const newUrl = e?.detail?.url;
      if (newUrl) {
        setContacts((prev) =>
          prev.map((c) => (c.id === 'SYS-SUPPORT' ? { ...c, avatarUrl: newUrl } : c))
        );
        setActiveTarget((prev) =>
          prev && prev.id === 'SYS-SUPPORT' ? { ...prev, avatarUrl: newUrl } : prev
        );
      }
    };
    window.addEventListener('erp_support_avatar_updated', handleSupportAvatarEvent);

    return () => {
      clearInterval(presenceInterval);
      window.removeEventListener('erp_support_avatar_updated', handleSupportAvatarEvent);
    };
  }, [user.id]);

  // Load Active Conversation Messages
  const loadActiveMessages = async () => {
    if (!activeTarget) return;
    try {
      const msgs = await ApiService.getChatHistory(activeTarget.type, activeTarget.id);
      setMessages(msgs);
      await ApiService.markChatRead(activeTarget.type, activeTarget.id);

      // Refresh unread counts in contact list
      setContacts((prev) =>
        prev.map((c) => (c.id === activeTarget.id ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err) {
      console.error('Failed to load conversation history:', err);
    }
  };

  useEffect(() => {
    loadActiveMessages();
  }, [activeTarget?.id, activeTarget?.type]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, attachments]);

  // Polling periodically for incoming new messages when tab is visible
  useEffect(() => {
    if (!activeTarget) return;
    const interval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      try {
        const msgs = await ApiService.getChatHistory(activeTarget.type, activeTarget.id);
        setMessages((prev) => {
          if (msgs.length !== prev.length || JSON.stringify(msgs) !== JSON.stringify(prev)) {
            return msgs;
          }
          return prev;
        });
      } catch (err) {
        // Silent catch for background polling
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [activeTarget?.id, activeTarget?.type]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTarget) return;
    if (!inputText.trim() && attachments.length === 0) return;

    setIsSending(true);
    try {
      let newMsg: any;
      if (activeTab === 'support' && activeTarget.type === 'user') {
        newMsg = await ApiService.sendSupportReply(activeTarget.id, inputText.trim(), attachments);
        loadSupportTickets();
      } else {
        newMsg = await ApiService.sendChatMessage({
          targetType: activeTarget.type,
          targetId: activeTarget.id,
          content: inputText.trim(),
          attachments,
        });
      }

      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
      setAttachments([]);

      if (activeTarget.type === 'user') {
        setDirectedNotice({
          type: 'success',
          text: activeTab === 'support'
            ? `Resposta oficial enviada como Suporte para ${activeTarget.name}`
            : `Mensagem privada enviada com sucesso para ${activeTarget.name}`,
        });
        setTimeout(() => setDirectedNotice(null), 4000);
      }

      if (user.isDeveloper) {
        const audit = await ApiService.getDeveloperChatAudit();
        setAuditData(audit);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar mensagem.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle file uploads (Images, Documents, PDFs)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (file.size > 15 * 1024 * 1024) {
        alert(`O arquivo ${file.name} excede o limite máximo permitido de 15MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        const newAtt: ChatAttachment = {
          id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: `${(file.size / 1024).toFixed(1)} KB`,
          fileData: base64Data,
        };
        setAttachments((prev) => [...prev, newAtt]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Clear current user's visual history
  const handleClearHistory = async () => {
    if (!activeTarget) return;
    const confirmClear = window.confirm(
      `Deseja apagar o histórico de mensagens com "${activeTarget.name}" do seu perfil?`
    );
    if (!confirmClear) return;

    try {
      await ApiService.clearChatHistory(activeTarget.type, activeTarget.id);
      setMessages([]);
      alert('Histórico visual limpo com sucesso.');
    } catch (err: any) {
      alert('Falha ao limpar histórico.');
    }
  };

  // Developer clear options
  const handleDeveloperClear = async (scope: 'own' | 'all') => {
    const msg =
      scope === 'all'
        ? 'ATENÇÃO DEVELOPER: Esta ação excluirá permanentemente TODO o histórico de mensagens de todos os usuários no sistema. Continuar?'
        : 'Deseja limpar apenas o seu histórico de visualização Developer?';

    if (!window.confirm(msg)) return;

    try {
      await ApiService.developerClearChat(scope);
      if (scope === 'all') {
        setMessages([]);
      }
      const audit = await ApiService.getDeveloperChatAudit();
      setAuditData(audit);
      alert('Operação executada com sucesso.');
    } catch (err: any) {
      alert('Falha ao executar limpeza de desenvolvedor.');
    }
  };

  // Group Management (Roles: CEO, Gerente Geral, Supervisor, Administrativo, Developer)
  const roleStr = String(user.role || '').toLowerCase();
  const isGroupAdminAuthorized =
    Boolean(user.isDeveloper) ||
    user.role === 'Developer' ||
    user.role === 'CEO' ||
    user.role === 'Gerente Geral' ||
    user.role === 'Supervisor' ||
    user.role === 'Administrativo' ||
    user.role === 'Administração' ||
    roleStr.includes('admin') ||
    roleStr.includes('geren') ||
    roleStr.includes('dire');

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      alert('Informe o nome do grupo.');
      return;
    }

    try {
      const roleStr = selectedGroupRoles.join(', ');
      const groupPayload = {
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        sector: newGroupSector,
        role: roleStr || undefined,
        targetRoles: selectedGroupRoles.length > 0 ? selectedGroupRoles : undefined,
        memberUserIds: selectedMemberIds,
      };

      if (editingGroup) {
        const updated = await ApiService.updateChatGroup(editingGroup.id, groupPayload);
        setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
        if (activeTarget?.id === updated.id) {
          setActiveTarget({
            type: 'group',
            id: updated.id,
            name: updated.name,
            subtitle: `Grupo: ${updated.sector}${updated.role ? ` • Cargo: ${updated.role}` : ''} • ${updated.memberUserIds.length} membros`,
            sector: updated.sector,
            role: updated.role,
          });
        }
      } else {
        const created = await ApiService.createChatGroup(groupPayload);
        setGroups((prev) => [...prev, created]);
        setActiveTarget({
          type: 'group',
          id: created.id,
          name: created.name,
          subtitle: `Grupo: ${created.sector}${created.role ? ` • Cargo: ${created.role}` : ''} • ${created.memberUserIds.length} membros`,
          sector: created.sector,
          role: created.role,
        });
      }

      setDirectedNotice({
        type: 'success',
        text: editingGroup
          ? `Grupo "${newGroupName.trim()}" alterado com sucesso!`
          : `Novo grupo "${newGroupName.trim()}" cadastrado com sucesso!`,
      });

      setIsCreateGroupModalOpen(false);
      setEditingGroup(null);
      setNewGroupName('');
      setNewGroupDesc('');
      setSelectedGroupRoles([]);
      setSelectedMemberIds([]);
      setOnlyShowMatchingRole(false);
    } catch (err: any) {
      alert(err.message || 'Falha ao salvar grupo.');
    }
  };

  const handleOpenEditGroupModal = (group: MessageGroup) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setNewGroupDesc(group.description);
    setNewGroupSector(group.sector || 'Geral');
    const groupRoles = group.targetRoles && group.targetRoles.length > 0
      ? group.targetRoles
      : (group.role ? group.role.split(',').map((r) => r.trim()).filter(Boolean) : []);
    setSelectedGroupRoles(groupRoles.map((r) => (r === 'ADM MASTER' ? 'ADM SISTEMA' : r)));
    setSelectedMemberIds(group.memberUserIds);
    setOnlyShowMatchingRole(false);
    setIsCreateGroupModalOpen(true);
  };

  const handleDeleteGroup = async (group: MessageGroup) => {
    if (!window.confirm(`Deseja excluir permanentemente o grupo "${group.name}"?`)) return;
    try {
      await ApiService.deleteChatGroup(group.id);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      if (activeTarget?.id === group.id) {
        // Fallback to general company channel
        setActiveTarget({
          type: 'group',
          id: 'GRP-GERAL-EMPRESA',
          name: 'Geral (Todos os Colaboradores)',
          subtitle: 'Canal coletivo da empresa • Aberto a todos',
          sector: 'Geral',
          isPublic: true,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Falha ao excluir grupo.');
    }
  };

  // Filtered contacts list - EXCLUDES currently logged-in user themselves
  const supportContact = contacts.find((c) => c.id === 'SYS-SUPPORT');
  const supportUnreadTotal = supportTickets.reduce((acc, t) => acc + (t.unreadCount || 0), 0);

  const filteredSupportTickets = supportTickets.filter((ticket) => {
    if (supportFilter === 'OPEN' && ticket.status === 'RESOLVED') return false;
    if (supportFilter === 'RESOLVED' && ticket.status !== 'RESOLVED') return false;
    if (!supportSearchTerm.trim()) return true;
    const term = supportSearchTerm.toLowerCase();
    return (
      ticket.userName.toLowerCase().includes(term) ||
      ticket.userRole.toLowerCase().includes(term) ||
      ticket.userSector.toLowerCase().includes(term) ||
      (ticket.lastMessage && ticket.lastMessage.toLowerCase().includes(term))
    );
  });

  const filteredContacts = sortContactsByHierarchy(
    contacts.filter((c) => {
      if (!c) return false;
      if (c.id === 'SYS-SUPPORT') return false; // Handled in dedicated Support direct card
      const currentUid = user?.id ? String(user.id) : '';
      const contactId = c.id ? String(c.id) : '';

      if (currentUid && contactId === currentUid) return false;
      if (c.username && user?.username && c.username.toLowerCase() === user.username.toLowerCase()) return false;
      if (
        c.username &&
        user?.username &&
        `@${c.username.toLowerCase().replace(/^@/, '')}` === `@${user.username.toLowerCase().replace(/^@/, '')}`
      ) {
        return false;
      }
      if (currentUid.startsWith('USR-EMP-') && contactId === currentUid.replace('USR-EMP-', '')) return false;
      if (contactId.startsWith('USR-EMP-') && contactId.replace('USR-EMP-', '') === currentUid) return false;

      // Filter by search term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        c.role.toLowerCase().includes(term) ||
        c.sector.toLowerCase().includes(term) ||
        c.username.toLowerCase().includes(term)
      );
    })
  );

  // Filtered Groups list (Excluding the default company general group from manual group list if redundant)
  const filteredGroups = groups.filter((g) => {
    if (g.id === 'GRP-GERAL-EMPRESA') return false; // Show in main Geral highlight
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      g.name.toLowerCase().includes(term) ||
      g.description.toLowerCase().includes(term) ||
      (g.sector && g.sector.toLowerCase().includes(term))
    );
  });

  const filteredAuditMessages = (auditData?.messages || []).filter((m) => {
    if (!auditSearchTerm.trim()) return true;
    const term = auditSearchTerm.toLowerCase();
    return (
      m.senderName.toLowerCase().includes(term) ||
      m.content.toLowerCase().includes(term) ||
      m.targetId.toLowerCase().includes(term)
    );
  });

  const isGeneralCompanyActive =
    activeTarget?.id === 'GRP-GERAL-EMPRESA' ||
    (activeTarget?.type === 'group' && activeTarget?.name.toLowerCase().includes('geral'));

  const SECTORS_LIST = [
    'Diretoria',
    'Gerência',
    'Supervisão',
    'Administrativo',
    'Comercial & Vendas',
    'Design & Criação',
    'Impressão Digital',
    'Calandra & Termotransferência',
    'Costura & Acabamento',
    'Estoque & Almoxarifado',
    'Operador',
    'Logística & Expedição',
    'TI & Desenvolvimento',
  ];

  const formatCargoDisplay = (role?: string): string => {
    if (!role) return '';
    const trimmed = role.trim();
    if (trimmed === 'ADM MASTER') return 'ADM SISTEMA';
    return trimmed;
  };

  const isRoleMatching = (selectedRole: string, contactRole?: string): boolean => {
    if (!contactRole) return false;
    const sel = selectedRole.trim().toLowerCase();
    const cr = contactRole.trim().toLowerCase();
    if (sel === cr) return true;
    if (
      (sel === 'adm sistema' || sel === 'adm master' || sel === 'administrador') &&
      (cr === 'adm sistema' || cr === 'adm master' || cr === 'administrador')
    ) {
      return true;
    }
    return false;
  };

  const isForbiddenMasterRole = (roleStr?: string): boolean => {
    if (!roleStr) return false;
    const r = roleStr.toLowerCase().trim();
    return (
      r === 'administrador master' ||
      r === 'adm master' ||
      r === 'admin master' ||
      r === 'master admin'
    );
  };

  const isAdmMasterContact = (c: ChatContact): boolean => {
    const r = (c.role || '').toLowerCase().trim();
    const n = (c.name || '').toLowerCase().trim();
    return (
      isForbiddenMasterRole(r) ||
      n === 'administrador master' ||
      n === 'adm master' ||
      n === 'admin master'
    );
  };

  const getModalMemberRank = (c: ChatContact): number => {
    const role = (c.role || '').toLowerCase().trim();
    const name = (c.name || '').toLowerCase().trim();
    const username = (c.username || '').toLowerCase().trim();
    const id = (c.id || '').toUpperCase().trim();

    // 1. CEO
    if (role === 'ceo' || name === 'ceo' || username === '@ceo' || username === 'ceo') {
      return 1;
    }
    // 2. GERENTE GERAL
    if (role === 'gerente geral' || name === 'gerente geral' || role.includes('gerente geral')) {
      return 2;
    }
    // 3. SUPORTE DO SISTEMA
    if (
      id === 'SYS-SUPPORT' ||
      name.includes('suporte') ||
      username === '@suporte' ||
      role.includes('suporte')
    ) {
      return 3;
    }
    // 4. Todos os outros
    return 4;
  };

  const availableCargos = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => {
      if (c.role && c.role.trim()) {
        const r = c.role.trim();
        const lower = r.toLowerCase();
        if (
          lower === 'adm sistema' ||
          lower === 'adm master' ||
          lower === 'ceo' ||
          isForbiddenMasterRole(r)
        ) {
          return;
        }
        set.add(r);
      }
    });
    [
      'Administrativo',
      'Calandra',
      'Conferência',
      'Costura',
      'Designer',
      'Estoque',
      'Gerente Geral',
      'Impressão',
      'LOGISTICA',
      'Monitor',
      'Op. Máquina de corte',
      'Operador',
      'Recepção',
      'RH',
      'Serviços Gerais',
      'Supervisor',
      'Vendedor(a)',
    ].forEach((c) => {
      const lower = c.toLowerCase();
      if (
        lower !== 'adm sistema' &&
        lower !== 'adm master' &&
        lower !== 'ceo' &&
        !isForbiddenMasterRole(c)
      ) {
        set.add(c);
      }
    });
    // Não exibir em "+ Selecionar cargo para o grupo...": ADM SISTEMA, CEO e Administrador Master
    set.delete('ADM SISTEMA');
    set.delete('CEO');
    set.delete('ceo');
    set.delete('ADM MASTER');
    set.delete('Administrador Master');
    set.delete('ADMINISTRADOR MASTER');
    set.delete('Admin Master');
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const filteredContactsForModal = useMemo(() => {
    // 1. Filtrar para NÃO exibir "Administrador Master"
    let list = contacts.filter((c) => !isAdmMasterContact(c));

    // 2. Se a opção "Filtrar por cargo" estiver ativa
    if (onlyShowMatchingRole && selectedGroupRoles.length > 0) {
      list = list.filter((c) =>
        selectedGroupRoles.some((r) => isRoleMatching(r, c.role))
      );
    }

    // 3. Ordenar com hierarquia estrita:
    // CEO -> GERENTE GERAL -> SUPORTE DO SISTEMA -> DEPOIS TODOS OS OUTROS EM ORDEM ALFABÉTICA
    return list.slice().sort((a, b) => {
      const rankA = getModalMemberRank(a);
      const rankB = getModalMemberRank(b);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
    });
  }, [contacts, onlyShowMatchingRole, selectedGroupRoles]);

  const onlineCount = contacts.filter(
    (c) => (c.presenceStatus || (c.isOnline ? 'online' : 'offline')) === 'online'
  ).length;
  const awayCount = contacts.filter(
    (c) => (c.presenceStatus || (c.isOnline ? 'online' : 'offline')) === 'away'
  ).length;
  const offlineCount = contacts.filter(
    (c) => (c.presenceStatus || (c.isOnline ? 'online' : 'offline')) === 'offline'
  ).length;

  return (
    <div className="space-y-4">
      {/* ALERTA DE SUCESSO / NOTIFICAÇÃO EM TELA */}
      {directedNotice && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md animate-in fade-in slide-in-from-top-2 duration-300 ${
            directedNotice.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-blue-600 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-white" />
            <span>{directedNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setDirectedNotice(null)}
            className="text-white/80 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2-COLUMN CHAT APPLICATION CANVAS (DESKTOP: SIDE-BY-SIDE | MOBILE: FULL SCREEN CENTERED) */}
      <div className="w-full flex-1 flex flex-col lg:flex-row h-[calc(100dvh-4rem)] sm:h-[calc(100vh-80px)] min-h-0 bg-white sm:rounded-3xl sm:border sm:border-slate-200/90 sm:shadow-xl overflow-hidden">
        
        {/* ========================================================================= */}
        {/* COLUNA ESQUERDA: COLABORADORES, GRUPOS E AUDITORIA                        */}
        {/* ========================================================================= */}
        <div
          className={`w-full lg:w-[32%] xl:w-[28%] border-b lg:border-b-0 lg:border-r border-slate-200/90 flex flex-col bg-slate-50/70 select-none h-full overflow-hidden shrink-0 ${
            mobileActiveView === 'chat' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          
          {/* Header da Coluna: "Sala interna de mensagens" + Badges de Status */}
          <div className="p-3 sm:p-4 bg-slate-100 text-slate-900 border-b border-slate-200 space-y-2.5 sm:space-y-3 shadow-xs shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-black tracking-tight text-slate-900 truncate">
                    Mensagens Internas ERP
                  </h1>
                  <p className="text-[10px] text-slate-500 truncate font-medium">
                    Canal Geral e Mensagens Privadas
                  </p>
                </div>
              </div>

              {/* Botão de Configuração do Tempo de Inatividade para Ausente (apenas Administrador Master e Developer) */}
              {canConfigPresence && (
                <button
                  type="button"
                  onClick={() => {
                    setTempInactivityMinutes(inactivityMinutes);
                    setIsPresenceConfigModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-200/90 active:bg-slate-300 text-slate-700 rounded-xl border border-slate-300 transition shadow-2xs flex items-center gap-1.5 text-[11px] font-bold cursor-pointer shrink-0"
                  title="Detectar Ausente por Inatividade (sem mexer o mouse ou digitar): clique para configurar"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline text-slate-600">Ausente:</span>
                  <span className="font-black text-amber-700">{inactivityMinutes}m</span>
                </button>
              )}
            </div>

            {/* Badges / Indicadores solicitados */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              <div className="p-1.5 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
                <span className="text-[9px] text-emerald-700 font-bold block truncate leading-tight">
                  Colaboradores
                </span>
                <span className="text-xs font-black text-slate-900">{contacts.length}</span>
              </div>

              <div className="p-1.5 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
                <span className="text-[9px] text-blue-700 font-bold block truncate leading-tight">
                  Grupos Internos
                </span>
                <span className="text-xs font-black text-slate-900">{groups.length}</span>
              </div>

              <div className="p-1.5 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
                <span className="text-[9px] text-blue-700 font-bold block truncate leading-tight">
                  Status
                </span>
                <span className="text-[10px] font-black text-blue-900 truncate block">
                  {user.isDeveloper ? 'Developer' : 'Criptografado'}
                </span>
              </div>
            </div>

            {/* Barra de Status de Presença em Tempo Real */}
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1 font-bold text-emerald-700" title="Usuários com o sistema aberto e ativos no ERP">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs" />
                  <span>{onlineCount} Online</span>
                </span>
                <span className="flex items-center gap-1 font-bold text-amber-700" title={`Usuários sem mexer o mouse ou digitar há mais de ${inactivityMinutes} minutos`}>
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-2xs" />
                  <span>{awayCount} Ausente</span>
                </span>
                <span className="flex items-center gap-1 font-bold text-slate-500" title="Usuários desconectados ou com sistema fechado">
                  <span className="w-2 h-2 rounded-full bg-slate-300 shadow-2xs" />
                  <span>{offlineCount} Off</span>
                </span>
              </div>
              {canConfigPresence && (
                <button
                  type="button"
                  onClick={() => {
                    setTempInactivityMinutes(inactivityMinutes);
                    setIsPresenceConfigModalOpen(true);
                  }}
                  className="text-[10px] text-amber-700 hover:text-amber-900 font-extrabold flex items-center gap-1 cursor-pointer transition hover:underline"
                  title="Detectar Ausente por Inatividade (sem mexer o mouse ou digitar): clique para alterar"
                >
                  <span>Ajustar ({inactivityMinutes}m)</span>
                </button>
              )}
            </div>
          </div>

          {/* Campo de Busca & Navegação de Abas */}
          <div className="p-3 border-b border-slate-200 bg-white space-y-2.5 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por colaborador, cargo ou grupo..."
                className="w-full pl-9 pr-3 py-2 bg-slate-100/90 border border-slate-200/80 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition placeholder:text-slate-400"
              />
            </div>

            {/* Abas: Geral (Aberto a todos + Lista por Hierarquia) | Grupos | Auditoria */}
            <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('contacts');
                  // Ao clicar em GERAL, abre o canal coletivo aberto a todos da empresa
                  setActiveTarget({
                    type: 'group',
                    id: 'GRP-GERAL-EMPRESA',
                    name: 'Geral (Todos os Colaboradores)',
                    subtitle: 'Canal coletivo da empresa • Aberto a todos',
                    sector: 'Geral',
                    isPublic: true,
                  });
                }}
                className={`flex-1 py-1.5 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'contacts'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Canal Geral aberto a todos e lista de funcionários por hierarquia"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Geral</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('groups')}
                className={`flex-1 py-1.5 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'groups'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Grupos</span>
              </button>

              {canConfigPresence && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('support');
                    loadSupportTickets();
                  }}
                  className={`flex-1 py-1.5 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 relative ${
                    activeTab === 'support'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Fila de Chamados e Atendimento ao Colaborador"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Suporte</span>
                  {supportUnreadTotal > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-black rounded-full shadow-2xs">
                      {supportUnreadTotal}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`flex-1 py-1.5 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'audit'
                    ? user.isDeveloper
                      ? 'bg-cyan-700 text-white shadow-sm'
                      : 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Painel de Auditoria e Logs Técnicos"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Auditoria</span>
              </button>
            </div>

            {/* Botão de Criação de Grupo para Funções Autorizadas */}
            {activeTab === 'groups' && isGroupAdminAuthorized && (
              <button
                type="button"
                onClick={() => {
                  setEditingGroup(null);
                  setNewGroupName('');
                  setNewGroupDesc('');
                  setNewGroupSector('Geral');
                  setSelectedGroupRoles([]);
                  setSelectedMemberIds([]);
                  setOnlyShowMatchingRole(false);
                  setIsCreateGroupModalOpen(true);
                }}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Novo Grupo Interno</span>
              </button>
            )}
          </div>

          {/* Lista de Contatos / Grupos / Auditoria */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            
            {/* 1. ABA GERAL (CANAL GERAL ABERTO A TODOS + HIERARQUIA DE FUNCIONÁRIOS) */}
            {activeTab === 'contacts' && (
              <>
                {/* CARD DE DESTAQUE FIXO: CANAL GERAL DA EMPRESA (ABERTO A TODOS) */}
                <button
                  type="button"
                  onClick={() =>
                    handleSelectTarget({
                      type: 'group',
                      id: 'GRP-GERAL-EMPRESA',
                      name: 'Geral (Todos os Colaboradores)',
                      subtitle: 'Canal coletivo da empresa • Aberto a todos',
                      sector: 'Geral',
                      isPublic: true,
                    })
                  }
                  className={`w-full p-3 rounded-2xl transition flex items-center gap-3 text-left cursor-pointer border relative overflow-hidden ${
                    isGeneralCompanyActive
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md border-emerald-500 ring-2 ring-emerald-400/30'
                      : 'hover:bg-emerald-50/80 bg-white text-slate-800 border-emerald-200/90 shadow-xs'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border ${
                      isGeneralCompanyActive
                        ? 'bg-white text-emerald-700 border-white/40'
                        : 'bg-gradient-to-br from-emerald-100 to-teal-200 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-black text-xs truncate">Canal Geral da Empresa</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide shrink-0 ${
                          isGeneralCompanyActive
                            ? 'bg-white text-emerald-800'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        📢 Aberto a Todos
                      </span>
                    </div>
                    <span
                      className={`text-[11px] truncate block font-medium ${
                        isGeneralCompanyActive ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Avisos, alinhamentos e mensagens gerais
                    </span>
                  </div>
                </button>

                {/* CARD DE DESTAQUE FIXO: CANAL EXCLUSIVO DE SUPORTE & TI */}
                <button
                  type="button"
                  onClick={() => {
                    handleSelectTarget({
                      type: 'user',
                      id: 'SYS-SUPPORT',
                      name: 'Suporte do Sistema',
                      avatarUrl: supportContact?.avatarUrl || user?.supportAvatarUrl || DEFAULT_SUPPORT_AVATAR,
                      subtitle: 'Central de Atendimento & TI • Suporte Técnico',
                      sector: 'Suporte Técnico',
                      role: 'Central de Atendimento & TI',
                      isPublic: false,
                    });
                  }}
                  className={`w-full p-3 rounded-2xl transition flex items-center gap-3 text-left cursor-pointer border relative overflow-hidden mt-1.5 ${
                    activeTarget?.type === 'user' && activeTarget?.id === 'SYS-SUPPORT'
                      ? 'bg-gradient-to-r from-blue-700 to-cyan-700 text-white shadow-md border-blue-500 ring-2 ring-cyan-400/40'
                      : 'hover:bg-blue-50/80 bg-white text-slate-800 border-blue-200/90 shadow-xs'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden shadow-sm border-2 border-white flex items-center justify-center bg-blue-600">
                      <img
                        src={supportContact?.avatarUrl || (activeTarget?.id === 'SYS-SUPPORT' ? activeTarget.avatarUrl : undefined) || user?.supportAvatarUrl || DEFAULT_SUPPORT_AVATAR}
                        alt="Suporte do Sistema"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png';
                        }}
                      />
                    </div>
                    {/* Status online badge visível quando não selecionado (ou sempre online) */}
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className={`font-black text-xs sm:text-sm truncate ${
                        activeTarget?.type === 'user' && activeTarget?.id === 'SYS-SUPPORT' ? 'text-white' : 'text-slate-900'
                      }`}>
                        Suporte do Sistema
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {supportContact?.unreadCount ? (
                          <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black animate-pulse shadow-xs">
                            {supportContact.unreadCount}
                          </span>
                        ) : null}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide flex items-center gap-1 ${
                            activeTarget?.type === 'user' && activeTarget?.id === 'SYS-SUPPORT'
                              ? 'bg-white text-blue-900'
                              : 'bg-blue-100 text-blue-900 border border-blue-200'
                          }`}
                        >
                          <Headphones className="w-3 h-3 shrink-0" />
                          <span>
                            {activeTarget?.type === 'user' && activeTarget?.id === 'SYS-SUPPORT'
                              ? 'Canal Direto'
                              : 'Canal Oficial de Suporte'}
                          </span>
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] truncate block font-medium ${
                        activeTarget?.type === 'user' && activeTarget?.id === 'SYS-SUPPORT'
                          ? 'text-cyan-100'
                          : 'text-slate-500'
                      }`}
                    >
                      {activeTarget?.type === 'user' && activeTarget?.id === 'SYS-SUPPORT'
                        ? 'Dúvidas operacionais, erros e solicitações de TI'
                        : 'Central de Atendimento & TI • Suporte Técnico'}
                    </span>
                  </div>
                </button>

                {/* DIVISOR DE SEÇÃO: HIERARQUIA DE FUNCIONÁRIOS (MENSAGENS PRIVADAS) */}
                <div className="pt-2 pb-1 px-2 flex items-center justify-between border-t border-slate-200/80 mt-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <Award className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Hierarquia de Funcionários (Privado)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {filteredContacts.length}
                  </span>
                </div>

                {filteredContacts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    Nenhum colaborador encontrado.
                  </div>
                ) : (
                  filteredContacts.map((c) => {
                    const isSelected = activeTarget?.type === 'user' && activeTarget?.id === c.id;
                    const badgeStyle = getRoleBadgeStyle(c.role);
                    const categoryLabel = getRoleCategoryLabel(c.role);
                    const presence = getPresenceInfo(
                      c.presenceStatus,
                      c.isOnline,
                      inactivityMinutes,
                      c.lastSeen,
                      c.awaySince
                    );

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          handleSelectTarget({
                            type: 'user',
                            id: c.id,
                            name: c.name,
                            subtitle: `${c.role} • ${c.sector}`,
                            sector: c.sector,
                            avatarUrl: c.avatarUrl,
                            role: c.role,
                            isPublic: false,
                          })
                        }
                        className={`w-full p-2.5 rounded-2xl transition flex items-center gap-3 text-left cursor-pointer border ${
                          isSelected
                            ? 'bg-slate-200/90 text-slate-900 shadow-xs border-slate-300 ring-2 ring-emerald-500/40'
                            : 'hover:bg-slate-200/70 bg-white text-slate-800 border-slate-200/80'
                        }`}
                      >
                        {/* Avatar com status online / ausente / offline */}
                        <div className="relative shrink-0">
                          {c.avatarUrl ? (
                            <img
                              src={c.avatarUrl}
                              alt={c.name}
                              className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs"
                            />
                          ) : (
                            <div
                              className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm shadow-xs ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-800 border border-slate-300'
                              }`}
                            >
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white rounded-full shadow-2xs ${presence.dotClass}`}
                            title={presence.tooltip}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="font-extrabold text-xs truncate">{c.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {c.unreadCount ? (
                                <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black animate-pulse shadow-xs">
                                  {c.unreadCount}
                                </span>
                              ) : null}
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border flex items-center gap-1 shadow-2xs ${presence.badgeClass}`}
                                title={presence.tooltip}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${presence.dotClass}`} />
                                <span>
                                  {presence.status === 'away' && presence.awayShortText
                                    ? `Ausente (${presence.awayShortText})`
                                    : presence.label}
                                </span>
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border truncate max-w-[85px] ${
                                  isSelected
                                    ? 'bg-white text-emerald-800 border-emerald-300'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                                title={categoryLabel}
                              >
                                {c.role}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`text-[11px] truncate block ${
                              isSelected ? 'text-slate-600 font-medium' : 'text-slate-500'
                            }`}
                          >
                            {categoryLabel} • {c.sector}
                          </span>
                          {presence.status === 'offline' ? (
                            <div
                              className={`text-[10px] truncate flex items-center gap-1 mt-0.5 font-medium ${
                                isSelected ? 'text-slate-600 font-semibold' : 'text-slate-500'
                              }`}
                              title={presence.tooltip}
                            >
                              <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">{presence.offlineText}</span>
                            </div>
                          ) : presence.status === 'away' ? (
                            <div
                              className={`text-[10px] truncate flex items-center gap-1 mt-0.5 font-semibold ${
                                isSelected ? 'text-amber-800' : 'text-amber-700'
                              }`}
                              title={presence.tooltip}
                            >
                              <Clock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                              <span className="truncate capitalize">{presence.awayText}</span>
                            </div>
                          ) : (
                            <span
                              className={`text-[10px] truncate block font-mono ${
                                isSelected ? 'text-slate-400' : 'text-slate-400'
                              }`}
                            >
                              @{c.username}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </>
            )}

            {/* 2. ABA GRUPOS */}
            {activeTab === 'groups' && (
              <>
                {filteredGroups.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    Nenhum grupo interno cadastrado.
                  </div>
                ) : (
                  filteredGroups.map((g) => {
                    const isSelected = activeTarget?.type === 'group' && activeTarget?.id === g.id;
                    return (
                      <div
                        key={g.id}
                        className={`p-2.5 rounded-2xl transition flex items-center justify-between gap-2 border ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-md border-emerald-600'
                            : 'hover:bg-slate-200/70 bg-white text-slate-800 border-slate-200/80'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleSelectTarget({
                              type: 'group',
                              id: g.id,
                              name: g.name,
                              subtitle: `Grupo: ${g.sector}${g.role ? ` • Cargo: ${formatCargoDisplay(g.role)}` : ''} • ${g.memberUserIds.length} membros`,
                              sector: g.sector,
                              role: g.role,
                              isPublic: false,
                            })
                          }
                          className="flex-1 flex items-center gap-3 text-left min-w-0 cursor-pointer"
                        >
                          <div
                            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-xs border ${
                              isSelected
                                ? 'bg-white text-emerald-800 border-white/40'
                                : 'bg-gradient-to-br from-indigo-100 to-blue-200 text-indigo-800 border-indigo-200'
                            }`}
                          >
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-extrabold text-xs truncate block mb-0.5">
                              {g.name}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[10px] truncate block ${
                                  isSelected ? 'text-emerald-100' : 'text-slate-500'
                                }`}
                              >
                                Setor {g.sector} • {g.memberUserIds.length} membros
                              </span>
                              {g.role && (
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-black truncate max-w-[140px] ${
                                    isSelected
                                      ? 'bg-white/20 text-white'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                  title={`Cargo: ${formatCargoDisplay(g.role)}`}
                                >
                                  {formatCargoDisplay(g.role)}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Botão de edição para admin */}
                        {isGroupAdminAuthorized && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditGroupModal(g)}
                            className={`p-1.5 rounded-lg transition shrink-0 cursor-pointer ${
                              isSelected
                                ? 'hover:bg-white/20 text-white'
                                : 'hover:bg-slate-200 text-slate-500'
                            }`}
                            title="Editar Grupo"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}

            {/* 3. ABA SUPORTE (Central de Chamados e Atendimento ao Colaborador) */}
            {activeTab === 'support' && (
              <div className="space-y-2">
                {/* Header da Aba Suporte */}
                <div className="p-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-2xl shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-black text-xs">
                      <Headphones className="w-4 h-4 text-cyan-200" />
                      <span>Fila de Chamados de Suporte</span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-white/20 text-white rounded text-[10px] font-bold">
                      {supportTickets.length} total
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-100 leading-snug">
                    Canal direto com os colaboradores. Suas respostas são enviadas em nome de <b>Suporte do Sistema</b>.
                  </p>

                  {/* Filtro de status */}
                  <div className="flex items-center gap-1 pt-1">
                    {(['ALL', 'OPEN', 'RESOLVED'] as const).map((filterKey) => (
                      <button
                        key={filterKey}
                        type="button"
                        onClick={() => setSupportFilter(filterKey)}
                        className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                          supportFilter === filterKey
                            ? 'bg-white text-blue-900 shadow-xs'
                            : 'bg-white/15 text-white hover:bg-white/25'
                        }`}
                      >
                        {filterKey === 'ALL' && 'Todos'}
                        {filterKey === 'OPEN' && 'Pendentes'}
                        {filterKey === 'RESOLVED' && 'Concluídos'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campo de busca nos chamados */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={supportSearchTerm}
                    onChange={(e) => setSupportSearchTerm(e.target.value)}
                    placeholder="Filtrar por nome, cargo ou mensagem..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                  />
                </div>

                {/* Lista de chamados de suporte */}
                {filteredSupportTickets.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/80">
                    <Headphones className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    Nenhum chamado de suporte encontrado.
                  </div>
                ) : (
                  filteredSupportTickets.map((ticket) => {
                    const isSelected = activeTarget?.type === 'user' && activeTarget?.id === ticket.userId;
                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => {
                          handleSelectTarget({
                            type: 'user',
                            id: ticket.userId,
                            name: ticket.userName,
                            subtitle: `${ticket.userRole} • ${ticket.userSector} (Chamado #${ticket.id})`,
                            sector: ticket.userSector,
                            role: ticket.userRole,
                            avatarUrl: ticket.userAvatar,
                            isPublic: false,
                          });
                        }}
                        className={`w-full p-3 rounded-2xl transition flex items-start gap-3 text-left cursor-pointer border ${
                          isSelected
                            ? 'bg-blue-50/90 text-blue-950 border-blue-300 ring-2 ring-blue-500/40 shadow-xs'
                            : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200/80 shadow-2xs'
                        }`}
                      >
                        <div className="relative shrink-0 mt-0.5">
                          {ticket.userAvatar ? (
                            <img
                              src={ticket.userAvatar}
                              alt={ticket.userName}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 text-white font-black text-sm flex items-center justify-center shadow-2xs">
                              {ticket.userName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {ticket.unreadCount && ticket.unreadCount > 0 ? (
                            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-black rounded-full animate-pulse shadow-xs">
                              {ticket.unreadCount}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-extrabold text-xs text-slate-900 truncate">
                              {ticket.userName}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 border ${
                                ticket.status === 'RESOLVED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : ticket.status === 'ANSWERED'
                                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                                  : 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                              }`}
                            >
                              {ticket.status === 'RESOLVED' && 'Resolvido'}
                              {ticket.status === 'ANSWERED' && 'Respondido'}
                              {ticket.status === 'OPEN' && 'Pendente'}
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-500 truncate mb-1">
                            <span>{ticket.userRole}</span> • <span>{ticket.userSector}</span>
                          </div>

                          {ticket.lastMessage && (
                            <p className="text-[11px] text-slate-600 line-clamp-1 italic font-medium">
                              "{ticket.lastMessage}"
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* 4. ABA AUDITORIA (Exclusivo Developer para Inspeção Geral ou Selo de Privacidade) */}
            {activeTab === 'audit' && (
              <div className="space-y-3">
                {user.isDeveloper ? (
                  <div className="p-3.5 bg-slate-100 text-slate-900 rounded-2xl space-y-3 text-xs border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-700 font-extrabold">
                        <Shield className="w-4 h-4" />
                        <span>Painel Developer Audit</span>
                      </div>
                      <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[9px] font-mono rounded">
                        MASTER
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                      Auditoria técnica e visão global de todas as mensagens privadas do ERP.
                    </p>

                    {auditData?.stats && (
                      <div className="space-y-1.5 text-[10px] font-mono bg-white p-2.5 rounded-xl border border-slate-200">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total de Mensagens:</span>
                          <span className="text-blue-700 font-bold">{auditData.stats.totalMessages}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Grupos Cadastrados:</span>
                          <span className="text-blue-700 font-bold">{auditData.stats.totalGroups}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Anexos Armazenados:</span>
                          <span className="text-blue-700 font-bold">{auditData.stats.totalAttachments}</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-1 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleDeveloperClear('own')}
                        className="w-full py-1.5 px-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 border border-slate-200 shadow-xs cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Limpar Meu Histórico (Dev)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeveloperClear('all')}
                        className="w-full py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 border border-rose-200 shadow-xs cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Limpar Histórico Geral do ERP</span>
                      </button>
                    </div>

                    {/* Quick Audit Explorer */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 uppercase">
                          Registros Recentes ({filteredAuditMessages.length})
                        </span>
                      </div>

                      <input
                        type="text"
                        value={auditSearchTerm}
                        onChange={(e) => setAuditSearchTerm(e.target.value)}
                        placeholder="Filtrar mensagens na auditoria..."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                      />

                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                        {filteredAuditMessages.slice(0, 15).map((logMsg) => (
                          <div
                            key={logMsg.id}
                            className="p-2 bg-white rounded-lg border border-slate-200 text-[10px] space-y-0.5 font-mono shadow-xs"
                          >
                            <div className="flex items-center justify-between text-blue-700 font-bold">
                              <span className="truncate">{logMsg.senderName}</span>
                              <span className="text-[9px] text-slate-400">
                                {new Date(logMsg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-slate-700 truncate">{logMsg.content || '[Anexo enviado]'}</p>
                            <div className="text-[9px] text-slate-400">
                              Destino: {logMsg.targetType} ({logMsg.targetId})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 text-xs">
                    <div className="flex items-center gap-2 text-emerald-700 font-extrabold">
                      <Shield className="w-5 h-5 text-emerald-600" />
                      <span>Conformidade & Privacidade</span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      As mensagens individuais são <strong>estritamente privadas</strong> entre os perfis participantes da conversa.
                    </p>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-[11px] text-emerald-950">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Lock className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Criptografia de Sessão Ativa</span>
                      </div>
                      <p className="text-[10px] text-emerald-800">
                        Nenhum outro colaborador tem acesso às suas conversas individuais privadas.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUNA DIREITA: ÁREA PRINCIPAL DAS CONVERSAS                              */}
        {/* ========================================================================= */}
        <div
          className={`w-full lg:flex-1 flex flex-col bg-[#efeae2]/40 relative h-full overflow-hidden ${
            mobileActiveView === 'list' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          
          {activeTarget ? (
            <>
              {/* TOPO DA COLUNA: Nome do Canal / Perfil Selecionado + Status + Ações */}
              <div className="p-3 sm:p-3.5 px-3 sm:px-4 bg-slate-100 text-slate-900 flex items-center justify-between border-b border-slate-200 shadow-xs z-10 shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Botão Voltar para Mobile */}
                  <button
                    type="button"
                    onClick={() => setMobileActiveView('list')}
                    className="lg:hidden p-1.5 -ml-1 text-slate-700 hover:text-slate-900 active:bg-slate-200 rounded-xl transition cursor-pointer shrink-0"
                    title="Voltar para lista de conversas"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-800" />
                  </button>

                  {/* Avatar do canal ou perfil selecionado */}
                  {(() => {
                    const activeUserContact =
                      activeTarget.type === 'user' ? contacts.find((c) => c.id === activeTarget.id) : null;
                    const activeUserPresence = activeUserContact
                      ? getPresenceInfo(
                          activeUserContact.presenceStatus,
                          activeUserContact.isOnline,
                          inactivityMinutes,
                          activeUserContact.lastSeen,
                          activeUserContact.awaySince
                        )
                      : null;

                    return (
                      <>
                        <div className="relative shrink-0">
                          {isGeneralCompanyActive ? (
                            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                              <Radio className="w-5 h-5" />
                            </div>
                          ) : activeTarget.id === 'SYS-SUPPORT' ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden shadow-xs border-2 border-white/90 bg-blue-600 flex items-center justify-center">
                              <img
                                src={activeTarget.avatarUrl || supportContact?.avatarUrl || user?.supportAvatarUrl || DEFAULT_SUPPORT_AVATAR}
                                alt="Suporte do Sistema"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png';
                                }}
                              />
                            </div>
                          ) : activeTarget.type === 'group' ? (
                            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                              <Users className="w-5 h-5" />
                            </div>
                          ) : activeTarget.avatarUrl ? (
                            <img
                              src={activeTarget.avatarUrl}
                              alt={activeTarget.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shadow-xs"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                              {activeTarget.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full shadow-2xs ${
                              activeTarget.id === 'SYS-SUPPORT'
                                ? 'bg-emerald-500 ring-1 ring-white'
                                : activeTarget.type === 'group'
                                ? 'bg-indigo-500'
                                : activeUserPresence
                                ? activeUserPresence.dotClass
                                : 'bg-emerald-500'
                            }`}
                            title={activeTarget.id === 'SYS-SUPPORT' ? 'Atendimento Online' : activeUserPresence ? activeUserPresence.tooltip : 'Canal'}
                          />
                        </div>

                        {/* Nome e status detalhado */}
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="font-black text-sm text-slate-900 truncate tracking-tight">
                              {activeTarget.name}
                            </h2>
                            {isGeneralCompanyActive ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black rounded-full flex items-center gap-1 shadow-xs">
                                <Radio className="w-2.5 h-2.5" />
                                <span>Aberto a Todos</span>
                              </span>
                            ) : activeTarget.id === 'SYS-SUPPORT' ? (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-black rounded-full flex items-center gap-1 shadow-xs">
                                <Headphones className="w-2.5 h-2.5 text-blue-700" />
                                <span>Canal Oficial de Suporte</span>
                              </span>
                            ) : activeTarget.type === 'group' ? (
                              <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                                <Users className="w-2.5 h-2.5" />
                                <span>Grupo Interno</span>
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 bg-slate-200 border border-slate-300 text-slate-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>Privado</span>
                                </span>
                                {activeUserPresence && (
                                  <span
                                    className={`px-2 py-0.5 border text-[10px] font-bold rounded-full flex items-center gap-1.5 shadow-2xs ${activeUserPresence.badgeClass}`}
                                    title={activeUserPresence.tooltip}
                                  >
                                    <span className={`w-2 h-2 rounded-full ${activeUserPresence.dotClass}`} />
                                    <span>
                                      {activeUserPresence.status === 'offline'
                                        ? activeUserPresence.offlineText
                                        : activeUserPresence.status === 'away'
                                        ? `Ausente (${activeUserPresence.awayText})`
                                        : activeUserPresence.label}
                                    </span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 truncate font-medium flex items-center gap-1">
                            <span className="truncate">{activeTarget.subtitle}</span>
                            {activeUserContact?.lastSeen && activeUserPresence?.status === 'offline' && (
                              <span className="text-slate-400 font-normal shrink-0">
                                {' '}(visto às {new Date(activeUserContact.lastSeen).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })})
                              </span>
                            )}
                            {activeUserContact?.awaySince && activeUserPresence?.status === 'away' && (
                              <span className="text-amber-600 font-semibold shrink-0">
                                {' '}(desde às {new Date(activeUserContact.awaySince).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })})
                              </span>
                            )}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Botões de Ações do Chat */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {activeTarget.type === 'group' && !isGeneralCompanyActive && isGroupAdminAuthorized && (
                    <>
                      {(() => {
                        const targetGroup = groups.find((g) => g.id === activeTarget.id);
                        if (!targetGroup) return null;
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditGroupModal(targetGroup)}
                              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                              title="Editar Grupo"
                            >
                              <Pencil className="w-3.5 h-3.5 text-blue-600" />
                              <span className="hidden md:inline">Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(targetGroup)}
                              className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl transition cursor-pointer shadow-xs"
                              title="Excluir Grupo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        );
                      })()}
                    </>
                  )}

                  {activeTab === 'support' && activeTarget.type === 'user' && (
                    <button
                      type="button"
                      onClick={handleToggleResolveTicket}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border ${
                        supportTickets.find((t) => t.userId === activeTarget.id)?.status === 'RESOLVED'
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
                      }`}
                      title="Alterar status de atendimento deste chamado"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {supportTickets.find((t) => t.userId === activeTarget.id)?.status === 'RESOLVED'
                          ? 'Reabrir Chamado'
                          : 'Concluir Chamado'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Limpar meu histórico visual nesta conversa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Limpar Conversa</span>
                  </button>
                </div>
              </div>

              {/* Banner Informativo de Tipo de Conversa (Aberto a Todos vs Privado vs Suporte) */}
              <div
                className={`px-4 py-1.5 text-[11px] flex items-center justify-center gap-2 border-b select-none ${
                  isGeneralCompanyActive
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                    : activeTarget.id === 'SYS-SUPPORT' || activeTab === 'support'
                    ? 'bg-blue-50 text-blue-900 border-blue-200 font-semibold'
                    : 'bg-slate-100 text-slate-700 border-slate-200 font-medium'
                }`}
              >
                {isGeneralCompanyActive ? (
                  <>
                    <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    <span>
                      📢 <strong>Conversa Aberta a Todos:</strong> As mensagens enviadas neste canal coletivo são visíveis para todos os colaboradores da empresa.
                    </span>
                  </>
                ) : activeTarget.id === 'SYS-SUPPORT' ? (
                  <>
                    <Headphones className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      🎧 <strong>Canal Exclusivo de Suporte:</strong> Suas mensagens vão direto para a equipe de Suporte Técnico & TI com privacidade total.
                    </span>
                  </>
                ) : activeTab === 'support' ? (
                  <>
                    <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 border border-blue-400 inline-flex items-center justify-center">
                      <img
                        src={supportContact?.avatarUrl || user?.supportAvatarUrl || DEFAULT_SUPPORT_AVATAR}
                        alt="Suporte do Sistema"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png';
                        }}
                      />
                    </div>
                    <span>
                      🎧 <strong>Atendimento de Suporte:</strong> Você está respondendo ao chamado do colaborador em nome de <strong>Suporte do Sistema</strong>.
                    </span>
                  </>
                ) : activeTarget.type === 'group' ? (
                  <>
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      👥 <strong>Grupo de Trabalho:</strong> Mensagens visíveis para os participantes do setor {activeTarget.sector}.
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-emerald-600" />
                    <span>
                      🔒 <strong>Conversa Privada:</strong> As mensagens nesta conversa são estritamente privadas entre você e <strong>{activeTarget.name}</strong>.
                    </span>
                  </>
                )}
              </div>

              {/* ÁREA DE MENSAGENS NO ESTILO WHATSAPP & DIRECT DO MESSENGER */}
              <div
                className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3 scrollbar-thin"
                style={{
                  backgroundImage: `radial-gradient(#94a3b8 0.75px, transparent 0.75px)`,
                  backgroundSize: '16px 16px',
                }}
              >
                {/* Indicador de Início da Conversa */}
                <div className="flex justify-center my-2">
                  <div className="bg-white/80 backdrop-blur-xs text-slate-600 text-[10px] font-extrabold px-3.5 py-1 rounded-full shadow-xs border border-slate-200/70 uppercase tracking-wide flex items-center gap-1.5">
                    {isGeneralCompanyActive ? (
                      <>
                        <Radio className="w-3 h-3 text-emerald-600" />
                        <span>Canal Oficial Coletivo da Empresa</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span>Mensagens com Criptografia de Ponta a Ponta</span>
                      </>
                    )}
                  </div>
                </div>

                {messages.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-2 select-none">
                    <div className="w-14 h-14 bg-white/80 rounded-full flex items-center justify-center shadow-sm border border-slate-200">
                      {isGeneralCompanyActive ? (
                        <Radio className="w-7 h-7 text-emerald-600" />
                      ) : (
                        <MessageSquareHeart className="w-7 h-7 text-emerald-600" />
                      )}
                    </div>
                    <h3 className="font-black text-sm text-slate-800">
                      Nenhuma mensagem enviada ainda
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm">
                      {isGeneralCompanyActive
                        ? 'Escreva um aviso ou mensagem para compartilhar com todos os colaboradores da empresa.'
                        : `Escreva uma mensagem abaixo para iniciar a conversa privada com ${activeTarget.name}.`}
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const currentUid = user?.id ? String(user.id) : '';
                    const senderId = m.senderId ? String(m.senderId) : '';
                    const isOwn =
                      (activeTab === 'support' && senderId === 'SYS-SUPPORT') ||
                      (activeTarget?.id === 'SYS-SUPPORT' && senderId !== 'SYS-SUPPORT') ||
                      (currentUid && senderId === currentUid) ||
                      (user?.username && m.senderName?.toLowerCase() === user?.name?.toLowerCase()) ||
                      (currentUid.startsWith('USR-EMP-') && senderId === currentUid.replace('USR-EMP-', '')) ||
                      (senderId.startsWith('USR-EMP-') && senderId.replace('USR-EMP-', '') === currentUid);

                    const messageDate = new Date(m.createdAt);
                    const formattedTime = messageDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={m.id}
                        className={`w-full flex ${isOwn ? 'justify-end' : 'justify-start'} my-1.5`}
                      >
                        <div
                          className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[72%]`}
                        >
                          {/* Remetente em conversas de canal geral, grupos ou mensagens do Suporte Oficial */}
                          {!isOwn && (isGeneralCompanyActive || activeTarget.type === 'group' || senderId === 'SYS-SUPPORT') && (
                            <div className="flex items-center gap-1.5 mb-1 ml-2 text-[11px]">
                              {senderId === 'SYS-SUPPORT' ? (
                                <>
                                  <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 border border-blue-300 inline-flex items-center justify-center">
                                    <img
                                      src={supportContact?.avatarUrl || user?.supportAvatarUrl || DEFAULT_SUPPORT_AVATAR}
                                      alt="Suporte do Sistema"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png';
                                      }}
                                    />
                                  </div>
                                  <Headphones className="w-3 h-3 text-blue-600 shrink-0" />
                                  <span className="font-extrabold text-blue-900">{m.senderName}</span>
                                  <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-1.5 py-0.2 rounded border border-blue-200">
                                    Canal Oficial
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="font-extrabold text-emerald-900">{m.senderName}</span>
                                  <span className="text-[10px] text-slate-500 font-semibold bg-white/70 px-1.5 py-0.2 rounded border border-slate-200">
                                    {m.senderRole}
                                  </span>
                                </>
                              )}
                            </div>
                          )}

                          {/* Balão de Mensagem (WhatsApp / Direct Style) */}
                          <div
                            className={`relative p-3 rounded-2xl text-xs leading-relaxed shadow-sm transition-all ${
                              isOwn
                                ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-xs border border-[#c1eac0]'
                                : 'bg-white text-[#111b21] rounded-tl-xs border border-slate-200/80'
                            }`}
                          >
                            {/* Conteúdo textual da mensagem */}
                            {m.content && (
                              <p className="whitespace-pre-wrap break-words text-[13px] font-normal leading-relaxed">
                                {m.content}
                              </p>
                            )}

                            {/* Anexos de Mídia / Imagens / Arquivos */}
                            {m.attachments && m.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {m.attachments.map((att) => {
                                  const isImage =
                                    (att.fileType && att.fileType.startsWith('image/')) ||
                                    (att.fileData && att.fileData.startsWith('data:image/'));

                                  if (isImage) {
                                    return (
                                      <div
                                        key={att.id}
                                        className="rounded-xl overflow-hidden border border-black/10 relative group bg-black/5"
                                      >
                                        <img
                                          src={att.fileData}
                                          alt={att.fileName}
                                          onClick={() => setLightboxImage(att.fileData)}
                                          className="w-full max-h-64 object-cover cursor-pointer hover:opacity-95 transition"
                                        />
                                        <div className="p-1.5 bg-black/60 backdrop-blur-xs text-white text-[10px] flex items-center justify-between">
                                          <span className="truncate max-w-[200px]">{att.fileName}</span>
                                          <a
                                            href={att.fileData}
                                            download={att.fileName}
                                            className="p-1 hover:bg-white/20 rounded transition"
                                            title="Baixar imagem"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </a>
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <a
                                      key={att.id}
                                      href={att.fileData}
                                      download={att.fileName}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition text-xs font-bold ${
                                        isOwn
                                          ? 'bg-[#c5f5bd] border-[#aee4a5] text-emerald-950 hover:bg-[#bbf0b3]'
                                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                                      }`}
                                    >
                                      <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                                        <FileText className="w-4 h-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="truncate block leading-tight">{att.fileName}</span>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                          {att.fileSize}
                                        </span>
                                      </div>
                                      <Download className="w-4 h-4 text-emerald-800 shrink-0" />
                                    </a>
                                  );
                                })}
                              </div>
                            )}

                            {/* Rodapé do Balão: Timestamp + Checkmarks */}
                            <div className="flex items-center justify-end gap-1 text-[10px] mt-1 select-none text-slate-500 font-medium">
                              <span>{formattedTime}</span>
                              {isOwn && (
                                <CheckCheck className="w-3.5 h-3.5 text-cyan-600 stroke-[2.5]" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Previews de Arquivos Anexados antes do envio */}
              {attachments.length > 0 && (
                <div className="p-3 bg-slate-100 border-t border-slate-200 flex flex-wrap gap-2 z-10">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="px-3 py-1.5 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-800 flex items-center gap-2 shadow-xs"
                    >
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span className="truncate max-w-[180px]">{att.fileName}</span>
                      <span className="text-[10px] text-slate-400">{att.fileSize}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                        }
                        className="text-rose-600 hover:text-rose-800 font-black text-sm ml-1 cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* BARRA DE DIGITAÇÃO ESTILO WHATSAPP & DIRECT DO MESSENGER */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 px-4 bg-[#f0f2f5] border-t border-slate-300/80 flex items-center gap-2.5 z-10"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  multiple
                />

                {/* Botão de Anexo (Clipe) */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-200/80 rounded-full transition cursor-pointer"
                  title="Anexar fotos, documentos ou PDFs"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {/* Input de Mensagem */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      isGeneralCompanyActive
                        ? 'Escrever mensagem aberta para todos os colaboradores...'
                        : `Mensagem privada para ${activeTarget.name}...`
                    }
                    className="w-full px-4 py-2.5 bg-white border border-slate-300/90 rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400 shadow-xs"
                  />
                </div>

                {/* Botão de Enviar Estilo WhatsApp / Direct */}
                <button
                  type="submit"
                  disabled={isSending || (!inputText.trim() && attachments.length === 0)}
                  className={`p-3 rounded-full text-white shadow-md transition flex items-center justify-center cursor-pointer ${
                    inputText.trim() || attachments.length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                      : 'bg-slate-400 opacity-50 cursor-not-allowed'
                  }`}
                  title="Enviar mensagem"
                >
                  <Send className="w-4 h-4 translate-x-0.5" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-3">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md border border-slate-200">
                <MessageSquare className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="font-black text-base text-slate-800">
                Selecione uma conversa ou colaborador
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Escolha o Canal Geral ou um colaborador na lista à esquerda para iniciar o envio de mensagens.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: CRIAR OU EDITAR GRUPO DE TRABALHO */}
      {isCreateGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-900 text-base">
                  {editingGroup ? 'Editar Grupo de Trabalho' : 'Criar Novo Grupo Interno'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateGroupModalOpen(false);
                  setEditingGroup(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 block">Nome do Grupo *</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Ex: Equipe de Produção Noturna"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 block">Setor Responsável</label>
                  <select
                    value={newGroupSector}
                    onChange={(e) => setNewGroupSector(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  >
                    <option value="Geral">Geral (Todos)</option>
                    {SECTORS_LIST.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-extrabold text-slate-700 block">Cargo / Função Alvo</label>
                    {selectedGroupRoles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedGroupRoles([])}
                        className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      if (!selectedGroupRoles.includes(val)) {
                        setSelectedGroupRoles((prev) => [...prev, val]);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white transition cursor-pointer"
                  >
                    <option value="">+ Selecionar cargo para o grupo...</option>
                    {availableCargos.map((cargo) => (
                      <option key={cargo} value={cargo} disabled={selectedGroupRoles.includes(cargo)}>
                        {cargo} {selectedGroupRoles.includes(cargo) ? '✓' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Badges de Cargos Selecionados & Ações Rápidas */}
              {selectedGroupRoles.length > 0 && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-[11px] font-bold text-blue-900">
                      Cargos Vinculados ({selectedGroupRoles.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const matchingIds = contacts
                          .filter((c) =>
                            selectedGroupRoles.some((r) => isRoleMatching(r, c.role))
                          )
                          .map((c) => c.id);
                        setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...matchingIds])));
                      }}
                      className="text-[10px] font-black text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-50 px-2 py-0.5 rounded-lg transition shadow-2xs cursor-pointer"
                      title="Marcar automaticamente todos os colaboradores destes cargos"
                    >
                      ✓ Marcar todos destes cargos
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGroupRoles.map((role) => {
                      const count = contacts.filter((c) => isRoleMatching(role, c.role)).length;
                      return (
                        <span
                          key={role}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 border border-blue-300 text-[11px] font-bold shadow-2xs"
                        >
                          <span>{role} ({count})</span>
                          <button
                            type="button"
                            onClick={() => setSelectedGroupRoles((prev) => prev.filter((r) => r !== role))}
                            className="text-blue-700 hover:text-rose-600 rounded-full p-0.5 transition cursor-pointer"
                            title="Remover cargo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 block">Descrição</label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Objetivo deste canal..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              {/* Seleção de Membros */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="font-extrabold text-slate-700 block">
                    Membros do Grupo ({selectedMemberIds.length} selecionados)
                  </label>
                  <div className="flex items-center gap-2">
                    {selectedGroupRoles.length > 0 && (
                      <label className="text-[10px] text-blue-700 flex items-center gap-1 cursor-pointer font-bold select-none">
                        <input
                          type="checkbox"
                          checked={onlyShowMatchingRole}
                          onChange={(e) => setOnlyShowMatchingRole(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 cursor-pointer"
                        />
                        <span>Filtrar por cargo</span>
                      </label>
                    )}
                    <span className="text-[10px] text-slate-500">
                      Se vazio, o grupo será aberto a todos do setor
                    </span>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50 scrollbar-thin">
                  {filteredContactsForModal.map((c) => {
                    const isChecked = selectedMemberIds.includes(c.id);
                    const matchesRole = selectedGroupRoles.some((r) => isRoleMatching(r, c.role));
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                          isChecked ? 'bg-emerald-100 text-emerald-950 font-bold' : 'hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMemberIds((prev) => [...prev, c.id]);
                              } else {
                                setSelectedMemberIds((prev) => prev.filter((id) => id !== c.id));
                              }
                            }}
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                          />
                          <div className="truncate">
                            <span className="block text-xs truncate">{c.name}</span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {formatCargoDisplay(c.role)} • {c.sector}
                            </span>
                          </div>
                        </div>
                        {matchesRole && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[9px] font-black shrink-0">
                            Cargo Alvo
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateGroupModalOpen(false);
                    setEditingGroup(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-sm transition cursor-pointer"
                >
                  {editingGroup ? 'Salvar Alterações' : 'Criar Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURAÇÃO DE TEMPO PARA AUSENTE POR INATIVIDADE (Apenas Administrador Master e Developer) */}
      {isPresenceConfigModalOpen && canConfigPresence && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Cabeçalho */}
            <div className="p-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">Status de Presença & Ausência</h3>
                  <p className="text-[11px] text-amber-100 font-medium">Controle de inatividade do usuário</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPresenceConfigModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-black text-slate-900 mb-1.5">
                  Detectar Ausente por Inatividade (sem mexer o mouse ou digitar):
                </label>
                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                  Selecione após quanto tempo sem nenhuma interação (movimentação do cursor, cliques ou teclas digitadas) o colaborador terá seu status alterado para <strong>Ausente (🟡)</strong>.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 1, label: '1 minuto' },
                    { value: 2, label: '2 minutos' },
                    { value: 3, label: '3 minutos' },
                    { value: 5, label: '5 minutos (Padrão)' },
                    { value: 10, label: '10 minutos' },
                    { value: 15, label: '15 minutos' },
                    { value: 30, label: '30 minutos' },
                  ].map((opt) => {
                    const isSelected = tempInactivityMinutes === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTempInactivityMinutes(opt.value)}
                        className={`p-2.5 rounded-xl border text-left font-bold transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-400/30 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Explicação dos 3 status */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px]">
                <div className="font-black text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Como funcionam os 3 status de presença:</span>
                </div>
                <div className="space-y-1.5 text-slate-600 leading-normal">
                  <div className="flex items-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                    <div>
                      <strong className="text-emerald-900">Online:</strong> Colaborador com o sistema aberto e em atividade recente no computador.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-1" />
                    <div>
                      <strong className="text-amber-900">Ausente:</strong> Colaborador com o sistema aberto, mas sem mexer o mouse ou digitar há mais de {tempInactivityMinutes} minutos. Retorna para Online imediatamente ao mover o mouse ou digitar.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0 mt-1" />
                    <div>
                      <strong className="text-slate-900">Offline:</strong> Colaborador fechou o sistema ou aba do navegador há mais de 1 minuto.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé / Ações */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPresenceConfigModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setInactivityMinutes(tempInactivityMinutes);
                  setIsPresenceConfigModalOpen(false);
                  setDirectedNotice({
                    type: 'success',
                    text: `Detectar Ausente por Inatividade configurado para ${tempInactivityMinutes} minutos com sucesso!`,
                  });
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl shadow-xs transition cursor-pointer"
              >
                Salvar Configuração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX: VISUALIZADOR DE IMAGEM AMPLIADA */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-3 -right-3 p-2 bg-slate-900 text-white rounded-full hover:bg-rose-600 transition shadow-lg cursor-pointer z-10"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Visualização ampliada"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}
    </div>
  );
};
