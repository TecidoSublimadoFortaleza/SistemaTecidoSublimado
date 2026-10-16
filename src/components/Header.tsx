import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  User,
  Building2,
  ChevronDown,
  LogOut,
  Sparkles,
  MessageSquare,
  Menu,
  X,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  KeyRound,
} from 'lucide-react';
import { UserProfile } from '../types/frontend';
import { NotificationService, AppNotification } from '../utils/notificationService';
import { RhSubTab } from './rh/RhModuleView';
import { ProfileModal } from './profile/ProfileModal';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  user: UserProfile;
  activeMenuTitle: string;
  onLogout: () => void;
  onUpdateUserProfile: (updatedUser: UserProfile) => void | Promise<void>;
  onOpenChatWidget?: () => void;
  isExpanded?: boolean;
  onToggleMobileMenu?: () => void;
  onSelectMenu?: (menuId: string, menuLabel: string, rhSubTab?: RhSubTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeMenuTitle,
  onLogout,
  onUpdateUserProfile,
  onOpenChatWidget,
  isExpanded = false,
  onToggleMobileMenu,
  onSelectMenu,
}) => {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'password'>('profile');
  const [readingNotification, setReadingNotification] = useState<AppNotification | null>(null);
  const [notificationFilter, setNotificationFilter] = useState<'ALL' | 'MY_OS' | 'STAGES' | 'COMPLETED'>('ALL');

  const notifContainerRef = useRef<HTMLDivElement>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);

  // Real-time Notifications list
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Load and subscribe to notifications
  const reloadNotifications = () => {
    const userNotifs = NotificationService.getUserNotifications(user);
    setNotifications(userNotifs);
  };

  useEffect(() => {
    reloadNotifications();

    const handleNotifUpdate = () => {
      reloadNotifications();
    };

    window.addEventListener('subligestao_notifications_changed', handleNotifUpdate);
    window.addEventListener('subligestao_new_notification', handleNotifUpdate);
    window.addEventListener('storage', handleNotifUpdate);
    window.addEventListener('os-changed', handleNotifUpdate);

    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        reloadNotifications();
      }
    }, 12000);

    return () => {
      window.removeEventListener('subligestao_notifications_changed', handleNotifUpdate);
      window.removeEventListener('subligestao_new_notification', handleNotifUpdate);
      window.removeEventListener('storage', handleNotifUpdate);
      window.removeEventListener('os-changed', handleNotifUpdate);
      clearInterval(intervalId);
    };
  }, [user]);

  // Click outside and Escape key listener to close dropdowns reliably
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (notifContainerRef.current && !notifContainerRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (profileContainerRef.current && !profileContainerRef.current.contains(target)) {
        setShowProfileDropdown(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowProfileDropdown(false);
        setReadingNotification(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const filteredNotifications = notifications.filter((n) => {
    if (notificationFilter === 'ALL') return true;
    if (notificationFilter === 'MY_OS') {
      const userNorm = (user.name || '').toLowerCase();
      return n.operador && (n.operador.toLowerCase().includes(userNorm) || userNorm.includes(n.operador.toLowerCase()));
    }
    if (notificationFilter === 'STAGES') {
      return n.type === 'os_progression' || n.type === 'os_accepted' || n.type === 'os_rollback' || n.type === 'os_rejected';
    }
    if (notificationFilter === 'COMPLETED') {
      return n.type === 'os_completed';
    }
    return true;
  });

  const markAllAsRead = () => {
    NotificationService.markAllAsRead(user);
    reloadNotifications();
  };

  const clearAllNotifications = (e: React.MouseEvent) => {
    e.stopPropagation();
    NotificationService.clearAllNotifications(user);
    setNotifications([]);
    if (showNotifications) {
      // Pequeno timeout ou feedback visual instantâneo
    }
  };

  const handleNotificationClick = (item: AppNotification) => {
    NotificationService.markAsRead(item.id, user || undefined);
    reloadNotifications();
    setShowNotifications(false);
    // Abre a aba/modal de leitura do conteúdo sem fechar ou trocar a página anterior
    setReadingNotification(item);
  };

  const { isHolidayThemeActive, palette } = useTheme();

  return (
    <header
      style={
        palette.isCustomPalette
          ? {
              backgroundColor: palette.headerBg,
              color: palette.headerText,
              borderBottomColor: palette.borderColor || `${palette.activeItemBg}40`,
            }
          : undefined
      }
      className={`sticky top-0 z-30 h-16 flex items-center justify-between px-3 sm:px-4 lg:px-6 transition-all duration-300 ease-in-out ${
        isHolidayThemeActive && !palette.isCustomPalette
          ? 'bg-gradient-to-r from-[#78350f] via-[#b45309] to-[#92400e] text-white border-b-2 border-amber-400/50 shadow-lg shadow-amber-950/25'
          : !palette.isCustomPalette
          ? 'bg-[#2563EB] text-white shadow-md border-b border-blue-500/40'
          : 'shadow-md border-b'
      } ${
        isExpanded ? 'md:ml-64 ml-0' : 'md:ml-16 ml-0'
      }`}
    >
      {/* LEFT: Mobile Menu Button & Current Selected Module Title (Clean text, no blue background box) */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Toggle */}
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 hover:bg-white/10 active:bg-white/20 rounded-xl text-white transition-all cursor-pointer shrink-0"
            aria-label="Abrir Menu Principal"
            title="Menu Principal"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2 truncate">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <h1
            style={palette.isCustomPalette ? { color: palette.headerText } : undefined}
            className={`text-xs sm:text-sm md:text-base font-bold tracking-wide uppercase truncate ${
              !palette.isCustomPalette ? 'text-white' : ''
            }`}
          >
            {activeMenuTitle || 'Dashboard Executivo'}
          </h1>
        </div>
      </div>

      {/* RIGHT: Chat Direct, Notifications & User Profile Menu (Clean buttons without blue background boxes) */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-auto">
        {/* Floating Chat Widget Trigger */}
        {onOpenChatWidget && (
          <button
            type="button"
            onClick={onOpenChatWidget}
            style={palette.isCustomPalette ? { color: palette.headerText } : undefined}
            className={`p-2 hover:bg-white/10 active:bg-white/20 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              !palette.isCustomPalette ? 'text-white' : ''
            }`}
            title="Abrir Chat Direct"
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-300" />
            <span
              style={palette.isCustomPalette ? { color: palette.headerText } : undefined}
              className={`hidden xl:inline text-xs font-bold ${!palette.isCustomPalette ? 'text-white' : ''}`}
            >
              Chat Direct
            </span>
          </button>
        )}

        {/* Real-time Notifications Center */}
        <div ref={notifContainerRef} className="relative overflow-visible">
          <button
            type="button"
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowProfileDropdown(false);
            }}
            style={palette.isCustomPalette ? { color: palette.headerText } : undefined}
            className={`p-2 hover:bg-white/10 active:bg-white/20 rounded-xl transition-all relative cursor-pointer overflow-visible ${
              !palette.isCustomPalette ? 'text-white' : ''
            }`}
            title="Central de Alertas e Notificações em Tempo Real"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5 relative z-10" style={palette.isCustomPalette ? { color: palette.headerText } : undefined} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 bg-red-500 text-white font-black text-[10px] rounded-full flex items-center justify-center border-2 border-white shadow-md animate-pulse z-[100]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Tray (Compact & Sleek) */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-[340px] sm:w-[350px] bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-visible font-sans flex flex-col max-h-[420px] animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-2.5 sm:p-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-blue-600/30 text-blue-400 rounded-md border border-blue-500/30">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs leading-tight">Notificações</h3>
                    <p className="text-[9px] text-slate-400 leading-none mt-0.5">
                      {user.role} ({user.name.split(' ')[0]})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                    >
                      Ler todas
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAllNotifications}
                      className="text-[10px] font-medium text-slate-400 hover:text-red-400 hover:underline cursor-pointer ml-1"
                      title="Limpar histórico"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {/* Segmented Filter Pills */}
              <div className="flex items-center gap-1 p-1.5 bg-slate-100 border-b border-slate-200 text-[10px] font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => setNotificationFilter('ALL')}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    notificationFilter === 'ALL'
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todas ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationFilter('MY_OS')}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    notificationFilter === 'MY_OS'
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Minhas OS
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationFilter('STAGES')}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    notificationFilter === 'STAGES'
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Etapas
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationFilter('COMPLETED')}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    notificationFilter === 'COMPLETED'
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Concluídas
                </button>
              </div>

              {/* Notification List Items */}
              <div className="overflow-y-auto divide-y divide-slate-100 flex-1 touch-scroll">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-1.5 text-slate-400">
                      <Bell className="w-4 h-4 opacity-50" />
                    </div>
                    <p className="font-semibold text-slate-600">Tudo limpo por aqui</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Nenhuma notificação encontrada neste filtro.</p>
                  </div>
                ) : (
                  filteredNotifications.map((item) => {
                    const isProgress = item.type === 'os_progression';
                    const isAccepted = item.type === 'os_accepted';
                    const isCompleted = item.type === 'os_completed';
                    const isRollback = item.type === 'os_rollback';
                    const isRejected = item.type === 'os_rejected' || item.title.includes('NÃO Aprovada') || item.title.includes('Reprovad');

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        className={`p-2.5 hover:bg-slate-50 transition-colors cursor-pointer relative group ${
                          isRejected
                            ? 'bg-rose-50/50 hover:bg-rose-50 border-l-4 border-rose-500'
                            : item.unread
                            ? 'bg-blue-50/60'
                            : ''
                        }`}
                      >
                        {item.unread && !isRejected && (
                          <span className="absolute left-1 top-3.5 w-1.5 h-1.5 rounded-full bg-blue-600 ring-2 ring-blue-200" />
                        )}
                        <div className="pl-1.5">
                          <div className="flex items-start justify-between gap-1.5 mb-0.5">
                            <div className="flex items-center gap-1 min-w-0">
                              {isRejected && <span className="text-xs shrink-0">❌</span>}
                              {!isRejected && isProgress && <span className="text-xs shrink-0">🚀</span>}
                              {!isRejected && isAccepted && <span className="text-xs shrink-0">🔔</span>}
                              {!isRejected && isCompleted && <span className="text-xs shrink-0">✅</span>}
                              {!isRejected && isRollback && <span className="text-xs shrink-0">⏪</span>}
                              <h4
                                className={`font-extrabold text-[11px] group-hover:underline transition truncate ${
                                  isRejected ? 'text-rose-900 group-hover:text-rose-700' : 'text-slate-900 group-hover:text-blue-700'
                                }`}
                              >
                                {item.title}
                              </h4>
                            </div>
                            <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap shrink-0">
                              {item.time}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-tight line-clamp-2">
                            {item.message}
                          </p>

                          <div className="mt-1.5 flex items-center gap-1.5">
                            {item.osCodigo && (
                              <span
                                className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded ${
                                  isRejected
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 group-hover:bg-blue-100 text-slate-700 group-hover:text-blue-800'
                                }`}
                              >
                                {item.osCodigo}
                              </span>
                            )}
                            {item.stage && (
                              <span
                                className={`px-1.5 py-0.5 text-[9px] font-black rounded ${
                                  isRejected ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {item.stage}
                              </span>
                            )}
                            <span className="text-[9px] text-blue-600 font-bold ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                              Ler Mensagem <ChevronDown className="w-2.5 h-2.5 -rotate-90" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-2 bg-slate-50 border-t border-slate-200 text-center shrink-0 flex items-center justify-between text-[10px] text-slate-500 px-3">
                <span className="truncate">Notificações em tempo real</span>
                <span className="font-semibold text-slate-700 shrink-0">SubliGestão ERP</span>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Button (Clean text and avatar, no blue background box) */}
        <div ref={profileContainerRef} className="relative">
          {(() => {
            const isShopee = user.localAtuacao === 'Shopee' || user.role === 'Vendedora Shopee' || user.role?.toLowerCase().includes('shopee');
            const displayRole = (
              user.role === 'ADM MASTER' ||
              user.name?.toLowerCase().includes('master') ||
              user.username?.toLowerCase() === 'admin'
            ) && (user.role === 'Vendedor(a)' || !user.role || user.role === 'ADM MASTER')
              ? 'ADM MASTER'
              : isShopee && !user.isDeveloper
              ? 'Vendedora Shopee'
              : user.role;

            return (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileDropdown((prev) => !prev);
                    setShowNotifications(false);
                  }}
                  className={`flex items-center gap-2 sm:gap-2.5 p-1 sm:p-1.5 hover:bg-white/10 active:bg-white/20 rounded-xl transition-all cursor-pointer ${
                    !palette.isCustomPalette ? 'text-white' : ''
                  }`}
                  style={palette.isCustomPalette ? { color: palette.headerText } : undefined}
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden bg-white/20 border border-white/30 flex items-center justify-center shrink-0 font-bold text-xs"
                    style={palette.isCustomPalette ? { color: palette.headerText } : undefined}
                  >
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      user.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="hidden sm:flex flex-col text-left">
                    <span
                      style={palette.isCustomPalette ? { color: palette.headerText } : undefined}
                      className={`text-xs font-bold tracking-tight leading-none truncate max-w-[130px] ${
                        !palette.isCustomPalette ? 'text-white' : ''
                      }`}
                    >
                      {user.name}
                    </span>
                    <span
                      style={palette.isCustomPalette ? { color: palette.headerText, opacity: 0.85 } : undefined}
                      className={`text-[10px] font-medium leading-tight mt-0.5 truncate max-w-[130px] ${
                        !palette.isCustomPalette ? 'text-blue-100' : ''
                      }`}
                    >
                      {displayRole}
                    </span>
                  </div>

                  <ChevronDown
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-80"
                    style={palette.isCustomPalette ? { color: palette.headerText } : undefined}
                  />
                </button>

                {/* Profile Dropdown */}
                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-60 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-150">
                    <div
                      style={
                        palette.isCustomPalette
                          ? {
                              backgroundColor: palette.sidebarBg,
                              color: palette.sidebarText,
                            }
                          : undefined
                      }
                      className={`p-3.5 ${
                        !palette.isCustomPalette
                          ? isHolidayThemeActive
                            ? 'bg-gradient-to-br from-[#78350f] via-[#b45309] to-[#92400e] text-white'
                            : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white'
                          : ''
                      }`}
                    >
                      <p className="font-extrabold text-sm truncate" style={palette.isCustomPalette ? { color: palette.sidebarText } : undefined}>
                        {user.name}
                      </p>
                      <p className="text-xs font-medium opacity-90" style={palette.isCustomPalette ? { color: palette.sidebarText } : undefined}>
                        {displayRole}
                      </p>
                      <div
                        style={
                          palette.isCustomPalette
                            ? {
                                backgroundColor: `${palette.activeItemBg}35`,
                                color: palette.sidebarText,
                              }
                            : undefined
                        }
                        className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/20 rounded-full text-[10px]"
                      >
                        <Building2 className="w-3 h-3" />
                        <span className="truncate max-w-[180px]">{user.branch || 'TECIDO SUBLIMADO - Matriz'}</span>
                      </div>
                    </div>

              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={() => {
                    setProfileModalTab('profile');
                    setShowProfileModal(true);
                    setShowProfileDropdown(false);
                  }}
                  className="w-full px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                >
                  <User
                    className="w-4 h-4"
                    style={{
                      color: palette.isCustomPalette
                        ? palette.activeItemBg
                        : isHolidayThemeActive
                        ? '#f59e0b'
                        : '#2563eb',
                    }}
                  />
                  <span>Editar Meu Perfil & Foto</span>
                </button>

                <button
                  onClick={() => {
                    setProfileModalTab('password');
                    setShowProfileModal(true);
                    setShowProfileDropdown(false);
                  }}
                  className="w-full px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                >
                  <KeyRound
                    className="w-4 h-4"
                    style={{
                      color: palette.isCustomPalette
                        ? palette.activeItemBg
                        : isHolidayThemeActive
                        ? '#f59e0b'
                        : '#d97706',
                    }}
                  />
                  <span>Alterar Minha Senha</span>
                </button>

                <div className="border-t border-slate-100 my-1" />

                <button
                  onClick={onLogout}
                  className="w-full px-2.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
                  title="Logout de emergência rápido: Ctrl + Alt + X"
                >
                  <div className="flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span>Encerrar Sessão (Logout)</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 font-bold group-hover:bg-red-200 transition">
                    Ctrl+Alt+X
                  </span>
                </button>
              </div>
            </div>
          )}
        </>
      );
    })()}
  </div>
</div>

      {/* EDIT PROFILE & PHOTO FRAMING MODAL */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        onSave={onUpdateUserProfile}
        initialTab={profileModalTab}
      />

      {/* NOTIFICATION DETAIL READER MODAL (Aba/Modal de Leitura sem Fechar a Página Anterior) */}
      {readingNotification && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setReadingNotification(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] text-slate-800 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className={`p-4 sm:p-5 flex items-start justify-between gap-3 border-b shrink-0 ${
                readingNotification.type === 'os_rejected' ||
                readingNotification.title.includes('NÃO Aprovada') ||
                readingNotification.title.includes('Reprovad')
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : 'bg-slate-900 text-white border-slate-800'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`p-2.5 rounded-2xl shrink-0 ${
                    readingNotification.type === 'os_rejected' ||
                    readingNotification.title.includes('NÃO Aprovada') ||
                    readingNotification.title.includes('Reprovad')
                      ? 'bg-rose-600 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {readingNotification.type === 'os_rejected' ||
                  readingNotification.title.includes('NÃO Aprovada') ||
                  readingNotification.title.includes('Reprovad') ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : readingNotification.type === 'os_completed' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Bell className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-sm sm:text-base leading-tight">
                    {readingNotification.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-[11px] opacity-80 font-medium">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>Recebido em {readingNotification.time}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReadingNotification(null)}
                className="p-1.5 rounded-xl hover:bg-black/10 transition-all text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs font-medium text-slate-700">
              {/* Badges / Meta Info */}
              {(readingNotification.osCodigo || readingNotification.clienteNome || readingNotification.operador || readingNotification.stage) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11px]">
                  {readingNotification.osCodigo && (
                    <div>
                      <span className="text-slate-400 font-bold uppercase block text-[9px]">Código da OS</span>
                      <p className="font-black text-slate-900 text-xs font-mono mt-0.5">{readingNotification.osCodigo}</p>
                    </div>
                  )}

                  {readingNotification.clienteNome && (
                    <div>
                      <span className="text-slate-400 font-bold uppercase block text-[9px]">Cliente</span>
                      <p className="font-bold text-slate-800 text-xs truncate mt-0.5">{readingNotification.clienteNome}</p>
                    </div>
                  )}

                  {readingNotification.operador && (
                    <div>
                      <span className="text-slate-400 font-bold uppercase block text-[9px]">Vendedor / Atendente</span>
                      <p className="font-bold text-blue-700 text-xs truncate mt-0.5">{readingNotification.operador}</p>
                    </div>
                  )}

                  {readingNotification.stage && (
                    <div>
                      <span className="text-slate-400 font-bold uppercase block text-[9px]">Etapa / Setor</span>
                      <p className="font-extrabold text-emerald-700 text-xs mt-0.5">{readingNotification.stage}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Message Box */}
              <div
                className={`p-4 rounded-2xl border ${
                  readingNotification.type === 'os_rejected' ||
                  readingNotification.title.includes('NÃO Aprovada') ||
                  readingNotification.title.includes('Reprovad')
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2 font-black text-xs uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Conteúdo da Mensagem:</span>
                </div>
                <p className="text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap">
                  {readingNotification.message}
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                A página anterior continua aberta sem alterações
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setReadingNotification(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Fechar
                </button>
                {readingNotification.osCodigo && onSelectMenu && (
                  <button
                    type="button"
                    onClick={() => {
                      const notif = readingNotification;
                      setReadingNotification(null);
                      if (notif.stage || notif.type === 'os_progression' || notif.type === 'os_accepted' || notif.type === 'os_rollback' || notif.type === 'os_rejected') {
                        onSelectMenu('kanban', 'Fluxo de Produção');
                      } else {
                        onSelectMenu('ordem-servico', 'Ordem de Serviço');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Ir para a OS</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
