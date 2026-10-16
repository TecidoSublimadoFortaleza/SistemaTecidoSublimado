import React, { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { SplashLoading } from './components/SplashLoading';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ExternalFrameModule } from './components/common/ExternalFrameModule';
import { FloatingChatWidget } from './components/messages/FloatingChatWidget';
import { OsConferenceDeadlineAlert } from './components/os/OsConferenceDeadlineAlert';
import { OperatorClientBirthdayAlert } from './components/client/OperatorClientBirthdayAlert';
import { MobilePWAPromptBanner } from './components/common/PWAInstallModal';
import { UserProfile } from './types/frontend';
import { ApiService } from './services/api';
import { useUserPresence } from './utils/useUserPresence';
import { Sparkles, Building2, Layers, ShieldAlert, ArrowLeft } from 'lucide-react';
import { canUserAccessModule, normalizeRoleName, getDefaultModuleForUser, syncPermissionsWithDatabase } from './utils/userPermissions';
import type { RhSubTab } from './components/rh/RhModuleView';

import { DeveloperDiagnosticsView } from './components/DeveloperDiagnosticsView';
import { ExecutiveDashboardView } from './components/ExecutiveDashboardView';
import { ClientModuleView } from './components/client/ClientModuleView';
import { OsModuleView } from './components/os/OsModuleView';
import { PdvVendaDiretaModule } from './components/pdv/PdvVendaDiretaModule';
import { KanbanModuleView } from './components/kanban/KanbanModuleView';
import { EstoqueModuleView } from './components/estoque/EstoqueModuleView';
import { ProdutosVendaModuleView } from './components/produtosVenda/ProdutosVendaModuleView';
import { EmployeeModuleView } from './components/employee/EmployeeModuleView';
import { ReportsModuleView } from './components/reports/ReportsModuleView';
import { RhModuleView } from './components/rh/RhModuleView';
import { OsHistoryModuleView } from './components/os/OsHistoryModuleView';
import { OsConferenceModuleView } from './components/os/OsConferenceModuleView';
import { ExpedicaoModuleView } from './components/expedicao/ExpedicaoModuleView';
import { EntregaDevolucaoModuleView } from './components/entregaDevolucao/EntregaDevolucaoModuleView';
import { MessagesModuleView } from './components/messages/MessagesModuleView';
import { SettingsModuleView } from './components/settings/SettingsModuleView';
import { WaleadsModuleView } from './components/waleads/WaleadsModuleView';
import { TvDashboardView } from './components/tv/TvDashboardView';
import { TvComercialDashboardView } from './components/tv/TvComercialDashboardView';
import { TvProducaoDashboardView } from './components/tv/TvProducaoDashboardView';
import { FiscalModuleView } from './components/fiscal/FiscalModuleView';
import { GerenciadorNotasFiscaisView } from './components/fiscal/GerenciadorNotasFiscaisView';
import { BackupModuleView } from './components/backup/BackupModuleView';
import { OsShopeeModuleView } from './components/os/OsShopeeModuleView';

function ModuleLoadingFallback({ title }: { title?: string }) {
  return (
    <div className="w-full min-h-[380px] flex flex-col items-center justify-center p-8 text-center animate-pulse">
      <div className="relative flex items-center justify-center mb-3">
        <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
        <Sparkles className="w-4 h-4 text-blue-600 absolute" />
      </div>
      <p className="text-xs font-bold text-slate-500 tracking-wider uppercase">
        {title ? `Carregando ${title}...` : 'Carregando módulo...'}
      </p>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isSplashActive, setIsSplashActive] = useState<boolean>(false);
  const [hasCompletedSplash, setHasCompletedSplash] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);

  // Global user presence & inactivity heartbeat
  useUserPresence(user);

  // Layout Sidebar State - Padrão aberto (isPinned: true)
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('subligestao_sidebar_pinned');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');
  const [activeMenuTitle, setActiveMenuTitle] = useState<string>('Dashboard');
  const [activeRhSubTab, setActiveRhSubTab] = useState<RhSubTab>('dashboard');
  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState<boolean>(false);
  const [permissionsVersion, setPermissionsVersion] = useState<number>(0);
  const [supportTriggerKey, setSupportTriggerKey] = useState<number>(0);

  const handleOpenSupport = () => {
    setActiveMenu('mensagens');
    setActiveMenuTitle('Mensagens Internas');
    setSupportTriggerKey((k) => k + 1);
  };

  // Listen to RBAC permissions updates and sync with Supabase / PostgreSQL
  useEffect(() => {
    // Sincroniza matriz de permissões salva no Supabase na inicialização
    syncPermissionsWithDatabase().catch(() => {});

    const handlePermissionsUpdated = () => {
      setTimeout(() => {
        setPermissionsVersion((v) => v + 1);
      }, 0);
    };

    window.addEventListener('subligestao_permissions_updated', handlePermissionsUpdated);
    window.addEventListener('storage', handlePermissionsUpdated);

    return () => {
      window.removeEventListener('subligestao_permissions_updated', handlePermissionsUpdated);
      window.removeEventListener('storage', handlePermissionsUpdated);
    };
  }, []);

  // Safe auto-select text on initial focus (e.g., Tab navigation) and eliminate wheel-based value changing on number inputs
  useEffect(() => {
    let lastFocusedElement: HTMLElement | null = null;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target === lastFocusedElement) return;
      lastFocusedElement = target;

      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const input = target as HTMLInputElement | HTMLTextAreaElement;
        const nonSelectableTypes = ['file', 'checkbox', 'radio', 'button', 'submit', 'image', 'reset', 'color', 'range'];
        if (target.tagName === 'INPUT' && nonSelectableTypes.includes((input as HTMLInputElement).type)) {
          return;
        }
        // Use requestAnimationFrame to avoid interrupting natural mouse click caret placement
        requestAnimationFrame(() => {
          if (document.activeElement === target) {
            try {
              if ((target as any).dataset?.noAutoSelect) return;
            } catch (_) {}
          }
        });
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      if (e.target === lastFocusedElement) {
        lastFocusedElement = null;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
        (target as HTMLElement).blur();
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Restore session on initial startup / page load (prevents unwanted logout on F5 refresh)
  useEffect(() => {
    try {
      sessionStorage.removeItem('subligestao_chunk_reload_count');
    } catch (_) {}
    try {
      const stored = localStorage.getItem('subligestao_user_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id && parsed.username) {
          setUser(parsed);
          setIsAuthenticated(true);
          setHasCompletedSplash(true); // Don't re-trigger splash on F5 refresh
          setIsSplashActive(false);

          // Restore last active module
          const savedMenu = localStorage.getItem('subligestao_active_menu');
          const savedMenuTitle = localStorage.getItem('subligestao_active_menu_title');
          if (savedMenu && canUserAccessModule(parsed.role, savedMenu, parsed.isDeveloper, parsed.localAtuacao)) {
            setActiveMenu(savedMenu);
            if (savedMenuTitle) setActiveMenuTitle(savedMenuTitle);
          } else {
            const initialModule = getDefaultModuleForUser(parsed.role, parsed.isDeveloper, parsed.localAtuacao);
            setActiveMenu(initialModule.menuId);
            setActiveMenuTitle(initialModule.menuTitle);
          }

          // Sincroniza em segundo plano os dados mais recentes do perfil diretamente do banco / Supabase
          ApiService.getCurrentUser().then((res: any) => {
            const fresh = res?.data?.user || res?.user;
            if (fresh && fresh.id) {
              setUser((prev) => {
                if (!prev) return prev;
                const updated: UserProfile = {
                  ...prev,
                  avatarUrl: fresh.avatarUrl !== undefined ? fresh.avatarUrl : prev.avatarUrl,
                  name: fresh.name || prev.name,
                  email: fresh.email || prev.email,
                  phone: fresh.phone || prev.phone,
                  localAtuacao: fresh.localAtuacao !== undefined ? fresh.localAtuacao : prev.localAtuacao,
                };
                localStorage.setItem('subligestao_user_profile', JSON.stringify(updated));
                return updated;
              });
            }
          }).catch(() => {});

          return;
        }
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
    }
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // Auto-validate active menu whenever user or RBAC permissions change
  useEffect(() => {
    if (user && !isInitializing) {
      if (!canUserAccessModule(user.role, activeMenu, user.isDeveloper, user.localAtuacao)) {
        const fallback = getDefaultModuleForUser(user.role, user.isDeveloper, user.localAtuacao);
        setActiveMenu(fallback.menuId);
        setActiveMenuTitle(fallback.menuTitle);
      }
    }
  }, [user, activeMenu, permissionsVersion, isInitializing]);

  const handleLoginSuccess = (loginResponse: any) => {
    const isMasterAdmin = Boolean(
      loginResponse.user?.name?.toLowerCase().includes('master') ||
      loginResponse.user?.username?.toLowerCase() === 'admin' ||
      loginResponse.roleName === 'ADM' ||
      loginResponse.user?.role === 'ADM'
    );
    const assignedRole = isMasterAdmin ? 'ADM' : (loginResponse.roleName as any);

    let birthDate = loginResponse.user.dataNascimento || (loginResponse.user as any).birthDate || '';
    let empLocalAtuacao = loginResponse.user.localAtuacao || (loginResponse.user as any).local_atuacao || '';
    if ((!birthDate || !empLocalAtuacao) && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('subligestao_employees_cache');
        if (cached) {
          const emps = JSON.parse(cached);
          if (Array.isArray(emps)) {
            const matched = emps.find((e: any) =>
              e.id === loginResponse.user.id ||
              `USR-EMP-${e.id}` === loginResponse.user.id ||
              (e.loginUsuario && e.loginUsuario.toLowerCase() === loginResponse.user.username?.toLowerCase()) ||
              (e.nome && `${e.nome} ${e.sobrenome || ''}`.trim().toLowerCase() === loginResponse.user.name?.toLowerCase())
            );
            if (matched?.dataNascimento && !birthDate) {
              birthDate = matched.dataNascimento;
            }
            if (matched?.localAtuacao && !empLocalAtuacao) {
              empLocalAtuacao = matched.localAtuacao;
            }
          }
        }
      } catch (_) {}
    }

    const profile: UserProfile = {
      id: loginResponse.user.id,
      username: loginResponse.user.username,
      name: loginResponse.user.name,
      email: loginResponse.user.email,
      phone: loginResponse.user.phone,
      avatarUrl: loginResponse.user.avatarUrl,
      role: assignedRole,
      sector: loginResponse.sectorName as any,
      branch: 'TECIDO SUBLIMADO - Matriz',
      isDeveloper: loginResponse.user.isDeveloperInvisible || loginResponse.roleName === 'Developer',
      dataNascimento: birthDate,
      localAtuacao: empLocalAtuacao,
    };

    // Activate splash screen first, ensuring hasCompletedSplash is false so no dashboard flash can ever occur
    setIsSplashActive(true);
    setHasCompletedSplash(false);
    localStorage.setItem('subligestao_user_profile', JSON.stringify(profile));
    setUser(profile);
    setIsAuthenticated(true);

    // Set initial module based on RBAC permissions
    const initialModule = getDefaultModuleForUser(profile.role, profile.isDeveloper, profile.localAtuacao);
    setActiveMenu(initialModule.menuId);
    setActiveMenuTitle(initialModule.menuTitle);
    try {
      localStorage.setItem('subligestao_active_menu', initialModule.menuId);
      localStorage.setItem('subligestao_active_menu_title', initialModule.menuTitle);
    } catch (_) {}
  };

  // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
  // LOGOUT DE EMERGÊNCIA GLOBAL: "Ctrl + Alt + X"
  // Permite encerramento instantâneo e seguro da sessão de qualquer tela ou campo do sistema
  // de forma limpa e imediata, sem necessidade de banners intrusivos.
  const handleLogout = async () => {
    try {
      ApiService.clearTokens();
      localStorage.removeItem('subligestao_user_profile');
      localStorage.removeItem('subligestao_active_menu');
      localStorage.removeItem('subligestao_active_menu_title');
      localStorage.removeItem('subligestao_access_token');
      localStorage.removeItem('subligestao_refresh_token');
    } catch (_) {}

    setIsFloatingChatOpen(false);
    setUser(null);
    setIsAuthenticated(false);
    setIsSplashActive(false);
    setHasCompletedSplash(false);

    try {
      await ApiService.logout();
    } catch (_) {}
  };

  // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
  // Listener global de captura de teclado para "Ctrl + Alt + X" (ou Cmd + Alt + X no macOS)
  // Utiliza fase de captura { capture: true } para garantir execução prioritária mesmo se focado em inputs ou modais.
  useEffect(() => {
    const handleEmergencyKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const isKeyX = e.key === 'x' || e.key === 'X' || e.code === 'KeyX' || e.keyCode === 88;

      if (isCtrlOrCmd && isAlt && isKeyX) {
        e.preventDefault();
        e.stopPropagation();
        handleLogout();
      }
    };

    window.addEventListener('keydown', handleEmergencyKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleEmergencyKeyDown, { capture: true });
  }, []);

  const handleSelectMenu = (menuId: string, menuLabel: string, rhSubTab?: RhSubTab) => {
    setActiveMenu(menuId);
    setActiveMenuTitle(menuLabel);
    try {
      localStorage.setItem('subligestao_active_menu', menuId);
      localStorage.setItem('subligestao_active_menu_title', menuLabel);
    } catch (_) {}
    if (rhSubTab) {
      setActiveRhSubTab(rhSubTab);
    }
    // Fechar automaticamente o CHAT DIRECT ao acessar Mensagens Internas
    if (menuId === 'mensagens' || rhSubTab === 'mensagens') {
      setIsFloatingChatOpen(false);
    }
  };

  // Listener para transição suave de módulos (ex: Orçamento transformado em OS navega para Ordem de Serviço)
  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail?.menuId) {
        handleSelectMenu(e.detail.menuId, e.detail.menuLabel || 'Ordem de Serviço');
      }
    };
    window.addEventListener('navigate-menu', handleNavigate);
    return () => window.removeEventListener('navigate-menu', handleNavigate);
  }, []);

  const handleUpdateUserProfile = async (updatedUser: UserProfile) => {
    // 1. Atualização otimista e imediata na interface e localStorage
    localStorage.setItem('subligestao_user_profile', JSON.stringify(updatedUser));
    setUser(updatedUser);

    // 2. Persistência garantida no backend e no banco de dados Supabase (PostgreSQL)
    try {
      const supportPhoto = updatedUser.supportAvatarUrl || (updatedUser.isSupportPhoto ? updatedUser.avatarUrl : undefined);
      const response = await ApiService.updateProfile({
        userId: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        avatarUrl: updatedUser.avatarUrl,
        supportAvatarUrl: supportPhoto,
        supportPhotoUrl: supportPhoto,
        isSupportPhoto: updatedUser.isSupportPhoto,
      });

      if (updatedUser.isSupportPhoto || updatedUser.supportAvatarUrl) {
        window.dispatchEvent(new CustomEvent('erp_support_avatar_updated', {
          detail: { url: updatedUser.supportAvatarUrl || updatedUser.avatarUrl }
        }));
      }

      const returnedUser = response?.user || (response as any)?.data?.user;
      if (returnedUser) {
        const mergedUser: UserProfile = {
          ...updatedUser,
          avatarUrl: returnedUser.avatarUrl !== undefined ? returnedUser.avatarUrl : updatedUser.avatarUrl,
          supportAvatarUrl: returnedUser.supportAvatarUrl || updatedUser.supportAvatarUrl,
          name: returnedUser.name || updatedUser.name,
          email: returnedUser.email || updatedUser.email,
          phone: returnedUser.phone || updatedUser.phone,
        };
        localStorage.setItem('subligestao_user_profile', JSON.stringify(mergedUser));
        setUser(mergedUser);
        window.dispatchEvent(new CustomEvent('subligestao_user_profile_updated', { detail: mergedUser }));
      }
    } catch (err: any) {
      console.error('[App] Erro ao sincronizar foto de perfil no Supabase:', err);
    }
  };

  // Determine sidebar expanded state (Hovered or Pinned)
  const isSidebarExpanded = isPinned || isHovered;

  // Determine if active module is a full-frame external integration or full-screen workspace
  const isFullFrameModule = [
    'azulzinha',
    'gerenciador-caixa',
    'waleads',
    'jornada',
    'mensagens',
    'controle-expedicao',
    'entrega-devolucao',
  ].includes(activeMenu);

  // 1. Initial Loading Spinner
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">Inicializando ERP SubliGestão Engine...</p>
      </div>
    );
  }

  // 2. Unauthenticated -> Login Screen
  if (!isAuthenticated || !user) {
    return (
      <LoginScreen onLoginSuccess={handleLoginSuccess} />
    );
  }

  // 3. Authenticated -> Motivational Splash Transition Screen
  // STRICT: If splash is active or splash has not finished yet, render SplashLoading immediately.
  // This guarantees that the Main ERP Application Layout NEVER renders or flashes before SplashLoading.
  if (isSplashActive || !hasCompletedSplash) {
    return (
      <SplashLoading
        user={user}
        onSplashComplete={() => {
          setIsSplashActive(false);
          setHasCompletedSplash(true);
        }}
      />
    );
  }

  // 4. Main ERP Application Layout
  return (
    <div className="min-h-screen bg-slate-200 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      {/* Top Navigation Header Bar */}
      <Header
        user={user}
        activeMenuTitle={activeMenuTitle}
        onLogout={handleLogout}
        onUpdateUserProfile={handleUpdateUserProfile}
        onOpenChatWidget={() => setIsFloatingChatOpen((prev) => !prev)}
        isExpanded={isSidebarExpanded}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        onSelectMenu={handleSelectMenu}
      />

      {/* Retractable Lateral Sidebar */}
      <Sidebar
        user={user}
        userRole={user.role}
        isDeveloper={user.isDeveloper}
        activeMenu={activeMenu}
        activeRhSubTab={activeRhSubTab}
        onSelectMenu={handleSelectMenu}
        isPinned={isPinned}
        onTogglePin={() => {
          setIsPinned((prev) => {
            const next = !prev;
            try {
              localStorage.setItem('subligestao_sidebar_pinned', String(next));
            } catch {}
            return next;
          });
        }}
        isExpanded={isSidebarExpanded}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenSupport={handleOpenSupport}
      />

      {/* MAIN CONTENT AREA - Follows Sidebar Movement & Margins */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out min-w-0 ${
          isFullFrameModule ? 'p-0 sm:p-5 lg:p-6' : 'p-3 sm:p-5 lg:p-6'
        } ${
          isSidebarExpanded ? 'md:ml-64 ml-0' : 'md:ml-16 ml-0'
        }`}
      >
        <div
          className={`w-full ${
            isFullFrameModule
              ? 'max-w-none 2xl:max-w-none space-y-0 h-full flex flex-col'
              : 'max-w-7xl 2xl:max-w-[1700px] mx-auto space-y-6'
          }`}
        >
          {/* RBAC PERMISSION GUARD */}
          {!canUserAccessModule(user.role, activeMenu, user.isDeveloper) ? (
            (() => {
              const fallbackModule = getDefaultModuleForUser(user.role, user.isDeveloper);
              return (
                <div className="p-8 bg-white rounded-2xl border border-rose-200 shadow-xs text-center space-y-4 max-w-lg mx-auto my-12">
                  <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-black text-slate-900">Acesso Restrito ao Módulo</h2>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      O seu perfil <strong className="text-rose-700">"{user.role}"</strong> não possui permissão de visualização para o módulo <strong className="text-slate-800">"{activeMenuTitle}"</strong> conforme definido no Controle e Permissões (RBAC).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectMenu(fallbackModule.menuId, fallbackModule.menuTitle)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Ir para o módulo inicial ({fallbackModule.menuTitle})</span>
                  </button>
                </div>
              );
            })()
          ) : (
            <React.Suspense fallback={<ModuleLoadingFallback title={activeMenuTitle} />}>
              {/* RENDER ACTIVE MODULE CONTENT */}
              {activeMenu === 'dev-dashboard' && user.isDeveloper && (
                <DeveloperDiagnosticsView />
              )}

              {activeMenu === 'dashboard' && (
                <ExecutiveDashboardView userRole={user.role} user={user} />
              )}

              {activeMenu === 'tv' && (
                <TvDashboardView user={user} />
              )}

              {activeMenu === 'tv-comercial' && (
                <TvComercialDashboardView user={user} />
              )}

              {activeMenu === 'tv-producao' && (
                <TvProducaoDashboardView user={user} isSidebarExpanded={isSidebarExpanded} />
              )}

              {activeMenu === 'clientes' && (
                <ClientModuleView />
              )}

              {activeMenu === 'orcamento' && (
                <OsModuleView
                  mode="ORCAMENTO"
                  activeMenu={activeMenu}
                  isSidebarExpanded={isSidebarExpanded}
                />
              )}

              {activeMenu === 'ordem-servico' && (
                <OsModuleView
                  mode="OS"
                  activeMenu={activeMenu}
                  isSidebarExpanded={isSidebarExpanded}
                />
              )}

              {activeMenu === 'ordem-servico-shopee' && (
                <OsShopeeModuleView
                  activeMenu={activeMenu}
                  isSidebarExpanded={isSidebarExpanded}
                />
              )}

              {activeMenu === 'caixa-pdv' && (
                <PdvVendaDiretaModule
                  isSidebarExpanded={isSidebarExpanded}
                />
              )}

              {activeMenu === 'kanban' && (
                <KanbanModuleView
                  user={user}
                  isSidebarExpanded={isSidebarExpanded}
                />
              )}

              {activeMenu === 'estoque' && (
                <EstoqueModuleView
                  user={user}
                  isSidebarExpanded={isSidebarExpanded}
                />
              )}

              {activeMenu === 'produtos-venda' && (
                <ProdutosVendaModuleView
                  user={user}
                  isSidebarExpanded={isSidebarExpanded}
                />
              )}

              {activeMenu === 'funcionarios' && (
                <EmployeeModuleView user={user} />
              )}

              {activeMenu === 'jornada' && (
                <ExternalFrameModule
                  title="TopPonto Web • Jornada e Ponto"
                  url="https://tecidosublimadofortaleza.topponto.com.br/#/login"
                  badge="Ponto Eletrônico"
                  badgeColor="bg-emerald-900/80 text-emerald-300 border-emerald-700"
                />
              )}

              {activeMenu === 'conferencia-os' && (
                <OsConferenceModuleView />
              )}

              {activeMenu === 'controle-expedicao' && (
                <ExpedicaoModuleView userRole={user.role} />
              )}

              {activeMenu === 'entrega-devolucao' && (
                <EntregaDevolucaoModuleView userRole={user.role} />
              )}

              {activeMenu === 'relatorios' && (
                <ReportsModuleView user={user} />
              )}

              {activeMenu === 'azulzinha' && (
                <ExternalFrameModule
                  title="Portal Azulzinha da CAIXA"
                  url="https://portal.azulzinhadacaixa.com.br/"
                  badge="Portal Financeiro"
                  badgeColor="bg-blue-900/80 text-blue-300 border-blue-700"
                />
              )}

              {activeMenu === 'gerenciador-caixa' && (
                <ExternalFrameModule
                  title="Gerenciador CAIXA"
                  url="https://gerenciador.caixa.gov.br/"
                  badge="Internet Banking Corporativo"
                  badgeColor="bg-indigo-900/80 text-indigo-300 border-indigo-700"
                />
              )}

              {activeMenu === 'notas-fiscais' && (
                <FiscalModuleView
                  userRole={user.role}
                  isDeveloper={user.isDeveloper}
                />
              )}

              {activeMenu === 'gerenciador-notas-fiscais' && (
                <GerenciadorNotasFiscaisView
                  userRole={user.role}
                  isDeveloper={user.isDeveloper}
                />
              )}

              {activeMenu === 'waleads' && (
                <WaleadsModuleView />
              )}

              {activeMenu === 'rh' && (
                <RhModuleView
                  initialTab={activeRhSubTab}
                  userRole={user.role}
                  user={user}
                />
              )}

              {activeMenu === 'historico-os' && (
                <OsHistoryModuleView />
              )}

              {activeMenu === 'mensagens' && (
                <MessagesModuleView user={user} supportTriggerKey={supportTriggerKey} />
              )}

              {activeMenu === 'backup' && (
                <BackupModuleView user={user} />
              )}

              {activeMenu === 'configuracoes' && (
                <SettingsModuleView user={user} />
              )}
            </React.Suspense>
          )}

          {/* Module Placeholders prepared for subsequent prompt stages */}
          {activeMenu !== 'dev-dashboard' &&
            activeMenu !== 'dashboard' &&
            activeMenu !== 'tv' &&
            activeMenu !== 'tv-comercial' &&
            activeMenu !== 'tv-producao' &&
            activeMenu !== 'clientes' &&
            activeMenu !== 'orcamento' &&
            activeMenu !== 'ordem-servico' &&
            activeMenu !== 'caixa-pdv' &&
            activeMenu !== 'kanban' &&
            activeMenu !== 'estoque' &&
            activeMenu !== 'produtos-venda' &&
            activeMenu !== 'funcionarios' &&
            activeMenu !== 'jornada' &&
            activeMenu !== 'conferencia-os' &&
            activeMenu !== 'controle-expedicao' &&
            activeMenu !== 'entrega-devolucao' &&
            activeMenu !== 'relatorios' &&
            activeMenu !== 'azulzinha' &&
            activeMenu !== 'gerenciador-caixa' &&
            activeMenu !== 'notas-fiscais' &&
            activeMenu !== 'gerenciador-notas-fiscais' &&
            activeMenu !== 'waleads' &&
            activeMenu !== 'rh' &&
            activeMenu !== 'historico-os' &&
            activeMenu !== 'mensagens' &&
            activeMenu !== 'configuracoes' && (
            <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Módulo: {activeMenuTitle}
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Estrutura de layout e roteamento para o módulo{' '}
                <strong className="text-slate-700">{activeMenuTitle}</strong> pronta e integrada às permissões do perfil{' '}
                <strong className="text-blue-600">{user.role}</strong>.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Integração com Backend Node.js OK</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Global Real-time Floating Chat Widget & Toast Notification Popup */}
      <FloatingChatWidget
        user={user}
        isOpen={isFloatingChatOpen}
        onClose={() => setIsFloatingChatOpen(false)}
        onOpenFullModule={() => handleSelectMenu('mensagens', 'Mensagens internas')}
      />

      {/* Real-time Delivery Deadline Alert displayed only when entering CONFERÊNCIA DE OS */}
      <OsConferenceDeadlineAlert
        user={user}
        activeMenu={activeMenu}
        onNavigateToConference={handleSelectMenu}
      />

      {/* Real-time Operator Client Birthday Alert (Individual notification for operators) */}
      <OperatorClientBirthdayAlert user={user} />

      {/* Mobile-Only Automatic Prompt Banner (Session-persistent, never on desktop) */}
      <MobilePWAPromptBanner />
    </div>
  );
}
