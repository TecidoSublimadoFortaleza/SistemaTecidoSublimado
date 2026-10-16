import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  X,
  Minimize2,
  Maximize2,
  ChevronUp,
  ChevronDown,
  Users,
  Bell,
  Trash2,
  Check,
  CheckCheck,
  CheckCircle,
  FileText,
  Download,
  Building2,
  Shield,
  Clock,
  Sparkles,
  Lock,
  ExternalLink,
  UserCheck,
  GripVertical,
  Move,
  Headphones,
  LifeBuoy,
} from 'lucide-react';
import { UserProfile } from '../../types/frontend';
import { ChatMessage, ChatContact, MessageGroup, ChatAttachment, SupportTicket } from '../../types/chat';
import { ApiService } from '../../services/api';
import { sortContactsByHierarchy } from '../../utils/roleHierarchy';
import { formatOfflineLastSeen, formatAwayDuration } from '../../utils/presenceDateUtils';
import { isDeveloperOrAdminMaster } from '../../utils/userPermissions';

export const DEFAULT_SUPPORT_AVATAR =
  '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png';

interface FloatingChatWidgetProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onOpenFullModule?: () => void;
}

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({
  user,
  isOpen,
  onClose,
  onOpenFullModule,
}) => {
  const [unreadMessages, setUnreadMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [isVisible, setIsVisible] = useState<boolean>(isOpen);
  const [isExpanded, setIsExpanded] = useState<boolean>(isOpen);
  const [hasNewMessageAlert, setHasNewMessageAlert] = useState<boolean>(false);
  const [supportAlertBanner, setSupportAlertBanner] = useState<{ clientName: string; text: string } | null>(null);

  const isSupportOperator = isDeveloperOrAdminMaster(user?.role, user?.isDeveloper, user?.username, user?.name);
  const [isOperatingAsSupport, setIsOperatingAsSupport] = useState<boolean>(false);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  // Drag & drop flexible positioning state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialPosX: number;
    initialPosY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    initialPosX: 0,
    initialPosY: 0,
    hasMoved: false,
  });

  const widgetRef = useRef<HTMLDivElement | HTMLButtonElement | null>(null);

  // Active chat state in floating widget
  const [activeTarget, setActiveTarget] = useState<{
    type: 'user' | 'group' | 'sector';
    id: string;
    name: string;
    subtitle: string;
    avatarUrl?: string;
    isSupportTicket?: boolean;
  } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isSending, setIsSending] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const isInitialPollRef = useRef<boolean>(true);

  // Sync external isOpen prop changes
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsExpanded(true);
      setHasNewMessageAlert(false);
    } else {
      setIsExpanded(false);
      setIsVisible(false);
    }
  }, [isOpen]);

  // Load support tickets list for Support Operators (Developer / Admin Master only)
  const loadSupportTickets = useCallback(async () => {
    if (!isSupportOperator) return;
    try {
      const tickets = await ApiService.listSupportTickets();
      setSupportTickets(tickets || []);
    } catch {
      // Background silent
    }
  }, [isSupportOperator]);

  // Real-time polling for unread messages and instant support routing
  useEffect(() => {
    let isMounted = true;

    const pollUnread = async () => {
      try {
        const unreads: ChatMessage[] = await ApiService.getUnreadChatMessages();
        if (!isMounted) return;

        setUnreadMessages(unreads);

        // First poll on mount: register existing messages without auto-opening or alerting
        if (isInitialPollRef.current) {
          for (const msg of unreads) {
            knownMessageIdsRef.current.add(msg.id);
          }
          isInitialPollRef.current = false;
          return;
        }

        // Subsequent polls: check for genuine new incoming messages from another employee
        let hasNew = false;
        let incomingSupportMsg: ChatMessage | null = null;

        for (const msg of unreads) {
          if (!knownMessageIdsRef.current.has(msg.id)) {
            knownMessageIdsRef.current.add(msg.id);
            if (msg.senderId !== user.id) {
              hasNew = true;
              if (isSupportOperator && msg.targetId === 'SYS-SUPPORT') {
                incomingSupportMsg = msg;
              }
            }
          }
        }

        // INSTANT SUPPORT CHAT TRIGGER FOR DEVELOPER & ADMINISTRADOR MASTER ONLY WHEN A TICKET ARRIVES
        if (incomingSupportMsg && isSupportOperator) {
          setIsVisible(true);
          setIsExpanded(true);
          setIsOperatingAsSupport(true);
          setActiveTarget({
            type: 'user',
            id: incomingSupportMsg.senderId,
            name: incomingSupportMsg.senderName || 'Colaborador',
            subtitle: `${incomingSupportMsg.senderRole || 'Colaborador'} • Suporte Solicitado`,
            isSupportTicket: true,
          });
          setSupportAlertBanner({
            clientName: incomingSupportMsg.senderName,
            text: incomingSupportMsg.content || 'Novo chamado de suporte aberto',
          });
          loadSupportTickets();

          // Audio chime notification if audio context available
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.35);
          } catch {
            // Audio policy ignore
          }
        } else if (hasNew) {
          // Open minimized / alert only if there is a real incoming message from a colleague
          setIsVisible(true);
          setHasNewMessageAlert(true);
        } else if (unreads.length === 0) {
          setHasNewMessageAlert(false);
        }
      } catch (err) {
        // Silent catch for background polling
      }
    };

    pollUnread();
    if (isSupportOperator) {
      loadSupportTickets();
    }

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        pollUnread();
        if (isSupportOperator) {
          loadSupportTickets();
        }
      }
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user.id, isSupportOperator, loadSupportTickets]);

  // Load direct contacts when widget mounts or opens
  useEffect(() => {
    loadContacts();

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
      window.removeEventListener('erp_support_avatar_updated', handleSupportAvatarEvent);
    };
  }, [isExpanded]);

  const loadContacts = async () => {
    if (!user || !user.id) return;
    try {
      const cts = await ApiService.getChatContacts();
      const validList = Array.isArray(cts) ? cts : [];
      setContacts(validList);

      // Filter out self
      const currentUid = user?.id ? String(user.id) : '';
      const validContacts = validList.filter((c) => {
        if (!c) return false;
        const contactId = c.id ? String(c.id) : '';
        if (currentUid && contactId === currentUid) return false;
        if (c.username && user?.username && c.username.toLowerCase() === user.username.toLowerCase()) return false;
        if (currentUid.startsWith('USR-EMP-') && contactId === currentUid.replace('USR-EMP-', '')) return false;
        if (contactId.startsWith('USR-EMP-') && contactId.replace('USR-EMP-', '') === currentUid) return false;
        return true;
      });

      const sorted = sortContactsByHierarchy(validContacts);

      // Default active target if none selected
      if (!activeTarget && sorted.length > 0) {
        setActiveTarget({
          type: 'user',
          id: sorted[0].id,
          name: sorted[0].name,
          subtitle: `${sorted[0].role} • ${sorted[0].sector}`,
          isSupportTicket: sorted[0].id === 'SYS-SUPPORT',
        });
      }
    } catch (err) {
      console.warn('[FloatingChatWidget] Aguardando inicialização de contatos:', err);
    }
  };

  // Load message history when activeTarget changes or when widget is expanded
  useEffect(() => {
    if (!activeTarget || !isExpanded) return;

    let isMounted = true;
    const fetchHistory = async () => {
      try {
        const hist: ChatMessage[] = await ApiService.getChatHistory(
          activeTarget.type,
          activeTarget.id
        );
        if (!isMounted) return;
        setMessages(hist);
        // Mark as read
        await ApiService.markChatRead(activeTarget.type, activeTarget.id);
        setUnreadMessages((prev) =>
          prev.filter((m) =>
            activeTarget.type === 'user'
              ? m.senderId !== activeTarget.id && m.targetId !== activeTarget.id
              : m.targetId !== activeTarget.id
          )
        );
      } catch (err) {
        console.error('Failed to fetch message history:', err);
      }
    };

    fetchHistory();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchHistory();
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTarget, isExpanded]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current && isExpanded) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  // Drag handlers for flexible movement on screen
  const startDrag = useCallback(
    (clientX: number, clientY: number, elementWidth: number, elementHeight: number) => {
      const currentPosX =
        position?.x ?? Math.max(16, window.innerWidth - elementWidth - 24);
      const currentPosY =
        position?.y ?? Math.max(16, window.innerHeight - elementHeight - 24);

      dragStartRef.current = {
        startX: clientX,
        startY: clientY,
        initialPosX: currentPosX,
        initialPosY: currentPosY,
        hasMoved: false,
      };

      const handlePointerMove = (e: MouseEvent | TouchEvent) => {
        const moveX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const moveY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const deltaX = moveX - dragStartRef.current.startX;
        const deltaY = moveY - dragStartRef.current.startY;

        if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
          dragStartRef.current.hasMoved = true;
          setIsDragging(true);
        }

        if (dragStartRef.current.hasMoved) {
          const maxLeft = Math.max(8, window.innerWidth - elementWidth - 8);
          const maxTop = Math.max(8, window.innerHeight - elementHeight - 8);

          const newX = Math.min(maxLeft, Math.max(8, dragStartRef.current.initialPosX + deltaX));
          const newY = Math.min(maxTop, Math.max(8, dragStartRef.current.initialPosY + deltaY));

          setPosition({ x: newX, y: newY });
        }
      };

      const handlePointerUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('mouseup', handlePointerUp);
        window.removeEventListener('touchmove', handlePointerMove);
        window.removeEventListener('touchend', handlePointerUp);
      };

      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, { passive: true });
      window.addEventListener('touchend', handlePointerUp);
    },
    [position]
  );

  const handleMouseDownMiniature = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startDrag(e.clientX, e.clientY, 230, 56);
  };

  const handleTouchStartMiniature = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY, 230, 56);
    }
  };

  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.button !== 0) return;
    startDrag(e.clientX, e.clientY, 384, 540);
  };

  const isCurrentTargetSupportTicket = Boolean(
    activeTarget?.id === 'SYS-SUPPORT' ||
    activeTarget?.isSupportTicket
  );

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeTarget || (!inputText.trim() && attachments.length === 0)) return;

    setIsSending(true);
    try {
      let newMsg: ChatMessage;

      // If Developer or Administrador Master is operating as support replying to a ticket
      if (isSupportOperator && isOperatingAsSupport && activeTarget.type === 'user' && activeTarget.id !== 'SYS-SUPPORT') {
        newMsg = await ApiService.sendSupportReply(
          activeTarget.id,
          inputText.trim(),
          attachments
        );
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
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar mensagem.');
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleResolveTicket = async () => {
    if (!activeTarget || activeTarget.type !== 'user' || !isSupportOperator) return;
    const ticket = supportTickets.find((t) => t.userId === activeTarget.id);
    const newStatus = ticket?.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED';
    try {
      await ApiService.resolveSupportTicket(activeTarget.id, newStatus);
      await loadSupportTickets();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar chamado.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((fileObj: unknown) => {
      const file = fileObj as File;
      if (file.size > 10 * 1024 * 1024) {
        alert(`O arquivo ${file.name} excede o limite de 10MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const sizeFormatted = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        setAttachments((prev) => [
          ...prev,
          {
            id: `ATT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            fileName: file.name,
            fileType: file.type || 'application/octet-stream',
            fileSize: sizeFormatted,
            fileData: base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearHistory = async () => {
    if (!activeTarget) return;
    if (!confirm('Deseja limpar seu histórico visual desta conversa? (O outro participante manterá seu próprio histórico)')) return;

    try {
      await ApiService.clearChatHistory(activeTarget.type, activeTarget.id);
      setMessages([]);
    } catch (err: any) {
      alert(err.message || 'Erro ao limpar histórico.');
    }
  };

  const handleOpenWidget = () => {
    if (dragStartRef.current.hasMoved) return;
    setIsVisible(true);
    setIsExpanded(true);
    setHasNewMessageAlert(false);
  };

  const handleMinimizeWidget = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsExpanded(false);
    setIsVisible(true);
  };

  const handleCloseWidget = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsExpanded(false);
    setIsVisible(false);
    setHasNewMessageAlert(false);
    setSupportAlertBanner(null);
    onClose();
  };

  const latestUnread = unreadMessages[0];
  const totalUnreadCount = unreadMessages.length;
  const isPulsing = hasNewMessageAlert || totalUnreadCount > 0;

  // Filtered contacts list sorted by role hierarchy - EXCLUDES currently logged-in user themselves
  const filteredContacts = sortContactsByHierarchy(
    contacts.filter((c) => {
      if (!c) return false;
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
      return true;
    })
  );

  if (!isVisible) {
    return null;
  }

  const supportContact = contacts.find((c) => c.id === 'SYS-SUPPORT');

  const currentTicket = isSupportOperator && activeTarget?.type === 'user'
    ? supportTickets.find((t) => t.userId === activeTarget.id)
    : null;

  return (
    <>
      {/* 1. MINIMIZED FLOATING TAB (FLEXIBLE / DRAGGABLE MINIATURE) */}
      {!isExpanded && (
        <div
          id="minimized-floating-chat-tab"
          onMouseDown={handleMouseDownMiniature}
          onTouchStart={handleTouchStartMiniature}
          style={{
            position: 'fixed',
            left: position ? `${position.x}px` : undefined,
            top: position ? `${position.y}px` : undefined,
            right: !position ? '20px' : undefined,
            bottom: !position ? '20px' : undefined,
            touchAction: 'none',
          }}
          className={`z-40 h-14 rounded-2xl shadow-2xl border select-none transition-shadow flex items-center gap-2.5 px-3 ${
            isDragging ? 'cursor-grabbing scale-105 shadow-emerald-500/50' : 'cursor-grab'
          } ${
            isPulsing
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-700 text-white border-emerald-300 shadow-emerald-500/40 ring-4 ring-emerald-400/40 animate-pulse'
              : 'bg-slate-900/95 hover:bg-slate-900 text-white border-slate-700/80 shadow-slate-900/40 hover:border-blue-500/60'
          }`}
          title="Chat Direct (Clique para abrir ou clique e arraste para posicionar)"
        >
          {/* Grip Drag Handle */}
          <div className="text-slate-400 hover:text-white shrink-0 cursor-grab active:cursor-grabbing p-0.5">
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Centered Chat Icon */}
          <button
            type="button"
            onClick={handleOpenWidget}
            className="relative flex items-center justify-center shrink-0 cursor-pointer"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isPulsing ? 'bg-white text-emerald-700 font-black shadow-sm' : 'bg-blue-600 text-white'
              }`}
            >
              {isSupportOperator ? (
                <Headphones className="w-4 h-4 text-cyan-300" />
              ) : (
                <MessageSquare className="w-4 h-4" />
              )}
            </div>

            {/* Pulsing indicator when new message */}
            {isPulsing && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-80" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400" />
              </span>
            )}
          </button>

          {/* Label / Notification Preview Text */}
          <div
            onClick={handleOpenWidget}
            className="flex flex-col items-start text-left pr-1 min-w-0 cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-wide truncate">
                {isSupportOperator ? 'Suporte & Chat' : isPulsing ? 'Nova Mensagem!' : 'Chat Direct'}
              </span>
              {totalUnreadCount > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white font-black text-[10px] rounded-full shadow-xs">
                  {totalUnreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-300 truncate max-w-[110px]">
              {latestUnread ? `${latestUnread.senderName}: ${latestUnread.content || 'Anexo'}` : 'Arraste para mover'}
            </span>
          </div>

          {/* Close Minimized Tab Button */}
          <button
            type="button"
            onClick={handleCloseWidget}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/20 rounded-lg transition shrink-0 cursor-pointer ml-1"
            title="Fechar Chat Direct"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. EXPANDED FLOATING CHAT WINDOW (FLEXIBLE / DRAGGABLE) */}
      {isExpanded && (
        <div
          id="expanded-floating-chat-window"
          style={{
            position: 'fixed',
            left: position ? `${position.x}px` : undefined,
            top: position ? `${position.y}px` : undefined,
            right: !position ? '16px' : undefined,
            bottom: !position ? '16px' : undefined,
          }}
          className={`z-50 w-96 max-w-[calc(100vw-1.5rem)] h-[550px] max-h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            isDragging ? 'shadow-2xl ring-2 ring-blue-500/50' : ''
          }`}
        >
          {/* Top Bar (Draggable Area) */}
          <div
            onMouseDown={handleMouseDownHeader}
            className={`text-white px-3.5 py-2.5 flex items-center justify-between border-b cursor-move select-none ${
              isCurrentTargetSupportTicket
                ? 'bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800 border-cyan-500/30'
                : 'bg-gradient-to-r from-blue-700 to-blue-600 border-blue-500/30'
            }`}
            title="Arraste pelo topo para mover a janela pela tela"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-blue-300 hover:text-white cursor-grab active:cursor-grabbing shrink-0">
                <Move className="w-3.5 h-3.5" />
              </div>
              <div className="w-7 h-7 rounded-full overflow-hidden bg-cyan-400/20 text-cyan-200 flex items-center justify-center font-bold text-xs shrink-0 border border-cyan-400/30">
                {isCurrentTargetSupportTicket || activeTarget?.id === 'SYS-SUPPORT' ? (
                  <img
                    src={activeTarget?.avatarUrl || supportContact?.avatarUrl || user?.supportAvatarUrl || DEFAULT_SUPPORT_AVATAR}
                    alt="Suporte do Sistema"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png';
                    }}
                  />
                ) : activeTarget?.type === 'group' ? (
                  <Users className="w-3.5 h-3.5 text-cyan-300" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-300" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-xs sm:text-sm truncate leading-tight tracking-wide flex items-center gap-1.5">
                  <span>{activeTarget ? activeTarget.name : 'CHAT DIRECT'}</span>
                  {activeTarget?.id === 'SYS-SUPPORT' ? (
                    <span className="px-1.5 py-0.2 bg-cyan-400 text-cyan-950 text-[9px] font-black rounded-md">
                      SUPORTE
                    </span>
                  ) : activeTarget?.isSupportTicket ? (
                    <span className="px-1.5 py-0.2 bg-amber-400 text-amber-950 text-[9px] font-black rounded-md">
                      CHAMADO
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] text-blue-200 truncate">
                  {activeTarget ? activeTarget.subtitle : 'Comunicação direta ERP'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isSupportOperator && currentTicket && (
                <button
                  type="button"
                  onClick={handleToggleResolveTicket}
                  className={`p-1.5 rounded-lg transition cursor-pointer text-[10px] font-bold flex items-center gap-1 ${
                    currentTicket.status === 'RESOLVED'
                      ? 'bg-amber-500/30 text-amber-200 hover:bg-amber-500/50'
                      : 'bg-emerald-500/30 text-emerald-200 hover:bg-emerald-500/50'
                  }`}
                  title={currentTicket.status === 'RESOLVED' ? 'Reabrir Chamado' : 'Concluir Chamado'}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                </button>
              )}
              {activeTarget && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="p-1.5 text-blue-200 hover:text-rose-300 hover:bg-blue-800/50 rounded-lg transition cursor-pointer"
                  title="Limpar meu histórico visual"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onOpenFullModule && (
                <button
                  type="button"
                  onClick={() => {
                    handleMinimizeWidget();
                    onOpenFullModule();
                  }}
                  className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-800/50 rounded-lg transition cursor-pointer"
                  title="Abrir Módulo Completo de Mensagens e Atendimento"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleMinimizeWidget}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-800/50 rounded-lg transition cursor-pointer"
                title="Minimizar para miniatura flutuante"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCloseWidget}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-rose-600/80 rounded-lg transition cursor-pointer"
                title="Fechar Chat Direct"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Instant Support Alert Banner */}
          {supportAlertBanner && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 text-[11px] font-bold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-1.5 truncate">
                <Headphones className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                <span className="truncate">
                  Novo chamado de <strong>{supportAlertBanner.clientName}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSupportAlertBanner(null)}
                className="text-white/80 hover:text-white text-xs font-black ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Direct Collaborators / Support Quick Selector Bar */}
          <div className="bg-slate-50 border-b border-slate-200 p-2 overflow-x-auto flex items-center gap-1.5 scrollbar-thin">
            {/* Quick Support channel button for collaborators */}
            {!isSupportOperator && (
              <button
                type="button"
                onClick={() => {
                  setActiveTarget({
                    type: 'user',
                    id: 'SYS-SUPPORT',
                    name: 'Suporte do Sistema',
                    subtitle: 'Central de Atendimento & TI',
                    isSupportTicket: true,
                  });
                  setIsOperatingAsSupport(false);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTarget?.id === 'SYS-SUPPORT'
                    ? 'bg-blue-700 text-white shadow-sm ring-1 ring-blue-400'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                <img
                  src={supportContact?.avatarUrl || user?.supportAvatarUrl || DEFAULT_SUPPORT_AVATAR}
                  alt="Suporte do Sistema"
                  className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png';
                  }}
                />
                <span>Suporte</span>
              </button>
            )}

            {filteredContacts.length === 0 ? (
              <span className="text-[11px] text-slate-400 px-2 py-0.5">
                Nenhum contato disponível
              </span>
            ) : (
              filteredContacts.map((c) => {
                const isSelected = activeTarget?.type === 'user' && activeTarget?.id === c.id;
                const isSupportContact = c.id === 'SYS-SUPPORT';

                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveTarget({
                        type: 'user',
                        id: c.id,
                        name: c.name,
                        subtitle: `${c.role} • ${c.sector}`,
                        isSupportTicket: false,
                      });
                      setIsOperatingAsSupport(false);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : isSupportContact
                        ? 'bg-cyan-50 text-cyan-900 border border-cyan-200 hover:bg-cyan-100'
                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {isSupportContact ? (
                      <Headphones className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                    ) : (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          (c.presenceStatus || (c.isOnline ? 'online' : 'offline')) === 'online'
                            ? 'bg-emerald-500'
                            : (c.presenceStatus || (c.isOnline ? 'online' : 'offline')) === 'away'
                            ? 'bg-amber-400'
                            : 'bg-slate-300'
                        }`}
                        title={
                          (c.presenceStatus || (c.isOnline ? 'online' : 'offline')) === 'online'
                            ? 'Online (com o sistema aberto)'
                            : (c.presenceStatus || (c.isOnline ? 'online' : 'offline')) === 'away'
                            ? `Ausente (${formatAwayDuration(c.awaySince || c.lastSeen)})`
                            : formatOfflineLastSeen(c.lastSeen)
                        }
                      />
                    )}
                    <span>{c.name.split(' ')[0]}</span>
                    {c.unreadCount ? (
                      <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-extrabold">
                        {c.unreadCount}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {/* Privacy / Support Mode Banner */}
          {activeTarget?.type === 'user' && (() => {
            const isSysSupport = activeTarget.id === 'SYS-SUPPORT';

            if (isSysSupport) {
              return (
                <div className="px-3 py-1 bg-blue-900 text-blue-100 text-[10px] flex items-center justify-between border-b border-blue-800 select-none">
                  <div className="flex items-center gap-1.5 truncate mr-2">
                    <Headphones className="w-3 h-3 text-cyan-300 shrink-0" />
                    <span className="truncate font-semibold">Canal Oficial de Suporte & TI</span>
                  </div>
                  <span className="text-cyan-200 font-mono text-[9px] shrink-0">Atendimento ERP</span>
                </div>
              );
            }

            if (isSupportOperator && activeTarget?.isSupportTicket) {
              return (
                <div className="px-3 py-1 bg-slate-800 text-slate-200 text-[10px] flex items-center justify-between border-b border-slate-700 select-none">
                  <div className="flex items-center gap-1.5 truncate mr-2">
                    <Shield className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">
                      Chamado de Suporte: <b className={isOperatingAsSupport ? 'text-cyan-300' : 'text-slate-300'}>
                        {isOperatingAsSupport ? 'Respondendo como Suporte' : user.name}
                      </b>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOperatingAsSupport(!isOperatingAsSupport)}
                    className="text-[9px] px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-cyan-200 rounded font-bold transition cursor-pointer"
                    title="Alternar entre responder como Suporte ou resposta direta pessoal"
                  >
                    {isOperatingAsSupport ? 'Modo: Suporte' : 'Modo: Direto'}
                  </button>
                </div>
              );
            }

            const targetContact = contacts.find((c) => c.id === activeTarget.id);
            const status = targetContact?.presenceStatus || (targetContact?.isOnline ? 'online' : 'offline');
            const isOffline = status === 'offline';
            const isAway = status === 'away';

            return (
              <div className="px-3 py-1 bg-slate-800 text-slate-300 text-[10px] flex items-center justify-between border-b border-slate-700 select-none">
                <div className="flex items-center gap-1.5 truncate mr-2">
                  <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {isOffline ? (
                      formatOfflineLastSeen(targetContact?.lastSeen)
                    ) : isAway ? (
                      <span className="text-amber-300 font-medium">
                        {formatAwayDuration(targetContact?.awaySince || targetContact?.lastSeen)}
                      </span>
                    ) : (
                      'Conversa Privada (1-a-1)'
                    )}
                  </span>
                </div>
                <span className="text-slate-400 font-mono text-[9px] truncate max-w-[120px] shrink-0">
                  {activeTarget.subtitle}
                </span>
              </div>
            );
          })()}

          {/* Messages Feed */}
          <div
            className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-[#efeae2]/30 scrollbar-thin"
            style={{
              backgroundImage: `radial-gradient(#cbd5e1 0.75px, transparent 0.75px)`,
              backgroundSize: '12px 12px',
            }}
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center space-y-2 select-none">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xs border border-slate-200">
                  {activeTarget?.id === 'SYS-SUPPORT' ? (
                    <Headphones className="w-5 h-5 text-blue-600" />
                  ) : (
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <p className="text-xs font-bold text-slate-700">Nenhuma mensagem ainda</p>
                <p className="text-[11px] text-slate-400">
                  {activeTarget?.id === 'SYS-SUPPORT'
                    ? 'Envie sua dúvida ou solicitação para a equipe de Suporte e TI.'
                    : `Inicie uma conversa com ${activeTarget?.name || 'este perfil'}.`}
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const currentUid = user?.id ? String(user.id) : '';
                const senderId = m.senderId ? String(m.senderId) : '';
                const isOwn =
                  (isSupportOperator && isOperatingAsSupport && senderId === 'SYS-SUPPORT') ||
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

                const isSysSupportMsg = m.senderId === 'SYS-SUPPORT';

                return (
                  <div
                    key={m.id}
                    className={`w-full flex ${isOwn ? 'justify-end' : 'justify-start'} my-1`}
                  >
                    <div
                      className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%]`}
                    >
                      {/* Sender Tag if Support */}
                      {isSysSupportMsg && (
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-700 mb-0.5 select-none">
                          <div className="w-3.5 h-3.5 rounded-full overflow-hidden shrink-0 border border-blue-300 inline-flex items-center justify-center">
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
                          <span>Suporte do Sistema</span>
                        </div>
                      )}

                      <div
                        className={`p-2.5 rounded-2xl text-xs leading-relaxed shadow-xs transition-all ${
                          isOwn
                            ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-xs border border-[#c1eac0]'
                            : isSysSupportMsg
                            ? 'bg-blue-50 text-blue-950 rounded-tl-xs border border-blue-200'
                            : 'bg-white text-[#111b21] rounded-tl-xs border border-slate-200/80'
                        }`}
                      >
                        {m.content && (
                          <p className="whitespace-pre-wrap break-words text-[12px]">{m.content}</p>
                        )}

                        {/* Attachments Preview */}
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="mt-1.5 space-y-1.5">
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
                                      className="w-full max-h-40 object-cover"
                                    />
                                    <div className="p-1 bg-black/60 backdrop-blur-xs text-white text-[9px] flex items-center justify-between">
                                      <span className="truncate max-w-[120px]">{att.fileName}</span>
                                      <a
                                        href={att.fileData}
                                        download={att.fileName}
                                        className="p-0.5 hover:bg-white/20 rounded transition"
                                        title="Baixar"
                                      >
                                        <Download className="w-3 h-3" />
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
                                  className={`flex items-center gap-2 p-1.5 rounded-lg border text-[11px] font-bold ${
                                    isOwn
                                      ? 'bg-[#c5f5bd] border-[#aee4a5] text-emerald-950'
                                      : 'bg-slate-50 border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <FileText className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                                  <span className="truncate flex-1">{att.fileName}</span>
                                  <Download className="w-3 h-3 text-slate-600 shrink-0" />
                                </a>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-1 text-[9px] mt-0.5 text-slate-500 select-none">
                          <span>{formattedTime}</span>
                          {isOwn && <CheckCheck className="w-3 h-3 text-cyan-600 stroke-[2.5]" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachments preview before sending */}
          {attachments.length > 0 && (
            <div className="p-2 bg-slate-100 border-t border-slate-200 flex flex-wrap gap-1.5">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="px-2 py-1 bg-white rounded-lg border border-slate-300 text-[10px] font-bold text-slate-800 flex items-center gap-1.5"
                >
                  <FileText className="w-3 h-3 text-blue-600" />
                  <span className="truncate max-w-[120px]">{att.fileName}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                    className="text-rose-600 hover:text-rose-800 font-bold ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-2 px-3 bg-[#f0f2f5] border-t border-slate-300/80 flex items-center gap-2"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-200 rounded-full transition cursor-pointer"
              title="Anexar arquivo ou foto"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isSupportOperator && isOperatingAsSupport && activeTarget?.type === 'user' && activeTarget.id !== 'SYS-SUPPORT'
                  ? 'Responder como Suporte do Sistema...'
                  : activeTarget?.id === 'SYS-SUPPORT'
                  ? 'Mensagem para o Suporte e TI...'
                  : 'Mensagem direta...'
              }
              className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
            />

            <button
              type="submit"
              disabled={isSending || (!inputText.trim() && attachments.length === 0)}
              className={`p-2 rounded-full text-white shadow-sm transition flex items-center justify-center cursor-pointer ${
                inputText.trim() || attachments.length > 0
                  ? isSupportOperator && isOperatingAsSupport
                    ? 'bg-cyan-600 hover:bg-cyan-700 active:scale-95'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                  : 'bg-slate-400 opacity-50 cursor-not-allowed'
              }`}
              title="Enviar mensagem"
            >
              <Send className="w-3.5 h-3.5 translate-x-0.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

