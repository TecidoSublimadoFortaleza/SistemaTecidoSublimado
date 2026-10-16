import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Kanban,
  FileText,
  Package,
  UserCheck,
  BarChart3,
  History,
  MessageSquare,
  ShoppingCart,
  Settings,
  Pin,
  PinOff,
  ShieldCheck,
  Server,
  Database,
  Building2,
  Calendar,
  Award,
  BookOpen,
  Briefcase,
  FileSignature,
  FileCode,
  FileSpreadsheet,
  Sparkles,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Clock,
  CalendarDays,
  GraduationCap,
  BrainCircuit,
  MessageSquareHeart,
  SmilePlus,
  Palmtree,
  AlertOctagon,
  CreditCard,
  Landmark,
  X,
  ClipboardCheck,
  Truck,
  PackageCheck,
  Calculator,
  Tv,
  PieChart,
  Factory,
  MessageCircle,
  Download,
  Headphones,
  ShoppingBag,
} from 'lucide-react';
import { RoleTitle, UserProfile } from '../types/frontend';
import { LOGO_URL } from './LoginScreen';
import { RhSubTab } from './rh/RhModuleView';
import { canUserAccessModule, isDeveloperOrAdminMaster, isShopeeSellerProfile } from '../utils/userPermissions';
import { usePWAInstall } from '../utils/usePWAInstall';
import { PWAInstallModal } from './common/PWAInstallModal';
import { useTheme } from '../context/ThemeContext';
import { SantaHat } from './common/SantaHat';

export const LOGO_COLLAPSED_URL = '/images/TSF-web.webp';

export interface MenuItemConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  roles: RoleTitle[];
}

export interface RhSubMenuItemConfig {
  id: RhSubTab;
  label: string;
  icon: React.ElementType;
}

export const RH_SUBMENU_LIST: RhSubMenuItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'jornada', label: 'Jornada', icon: Clock },
  { id: 'avaliacoes', label: 'Avaliações', icon: Award },
  { id: 'disc', label: 'Perfil Comportamental (DISC)', icon: BrainCircuit },
  { id: 'ferias', label: 'Férias', icon: Palmtree },
  { id: 'advertencias', label: 'Advertências', icon: AlertOctagon },
  { id: 'relatorios-rh', label: 'Relatórios', icon: BarChart3 },
  { id: 'assinatura-digital', label: 'Assinatura Digital', icon: FileSignature },
];

interface SidebarProps {
  userRole: RoleTitle;
  isDeveloper: boolean;
  user?: UserProfile;
  activeMenu: string;
  activeRhSubTab?: RhSubTab;
  onSelectMenu: (menuId: string, menuLabel: string, rhSubTab?: RhSubTab) => void;
  isPinned: boolean;
  onTogglePin: () => void;
  isExpanded: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenSupport?: () => void;
}

// Master Menu Items Configuration mapped by Hierarchy
const MASTER_MENU_ITEMS: MenuItemConfig[] = [
  // Developer Specific Metrics & System Server Module
  {
    id: 'dev-dashboard',
    label: 'DASHBOARD TÉCNICO',
    icon: Server,
    roles: ['Developer'],
  },
  // Main System Menu Items
  {
    id: 'dashboard',
    label: 'DASHBOARD',
    icon: LayoutDashboard,
    roles: [
      'Developer',
      'CEO',
      'Gerente Geral',
      'Supervisor',
      'Monitor',
      'Vendedor(a)',
      'Designer',
      'Impressão',
      'Calandra',
      'Costura',
      'Estoque',
      'Conferência',
      'Expedição',
      'Recepção',
    ],
  },
  {
    id: 'tv',
    label: 'TV',
    icon: Tv,
    roles: [
      'Developer',
      'CEO',
      'Gerente Geral',
      'Supervisor',
      'Monitor',
      'Vendedor(a)',
      'Designer',
      'Impressão',
      'Calandra',
      'Costura',
      'Estoque',
      'Conferência',
      'Expedição',
      'Recepção',
      'Administrativo',
    ],
  },
  {
    id: 'tv-comercial',
    label: 'DASHBOARD COMERCIAL',
    icon: PieChart,
    roles: [
      'Developer',
      'CEO',
      'Gerente Geral',
      'Supervisor',
      'Monitor',
      'Vendedor(a)',
      'Designer',
      'Impressão',
      'Calandra',
      'Costura',
      'Estoque',
      'Conferência',
      'Expedição',
      'Recepção',
      'Administrativo',
    ],
  },
  {
    id: 'tv-producao',
    label: 'DASHBOARD DE PRODUÇÃO',
    icon: Factory,
    roles: [
      'Developer',
      'CEO',
      'Gerente Geral',
      'Supervisor',
      'Monitor',
      'Vendedor(a)',
      'Designer',
      'Impressão',
      'Calandra',
      'Costura',
      'Estoque',
      'Conferência',
      'Expedição',
      'Recepção',
    ],
  },
  {
    id: 'clientes',
    label: 'CLIENTES',
    icon: Users,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Vendedor(a)', 'Recepção'],
  },
  {
    id: 'kanban',
    label: 'FLUXO DE PRODUÇÃO',
    icon: Kanban,
    roles: [
      'Developer',
      'CEO',
      'Gerente Geral',
      'Supervisor',
      'Monitor',
      'Vendedor(a)',
      'Designer',
      'Impressão',
      'Calandra',
      'Costura',
      'Conferência',
      'Expedição',
      'Recepção',
    ],
  },
  {
    id: 'orcamento',
    label: 'ORÇAMENTO',
    icon: Calculator,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Vendedor(a)', 'Recepção'],
  },
  {
    id: 'ordem-servico',
    label: 'ORDEM DE SERVIÇO',
    icon: FileText,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Vendedor(a)', 'Recepção'],
  },
  {
    id: 'ordem-servico-shopee',
    label: 'ORDEM DE SERVIÇO SHOPEE',
    icon: ShoppingBag,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Vendedor(a)', 'Vendedora Shopee', 'Recepção'],
  },
  {
    id: 'estoque',
    label: 'ESTOQUE',
    icon: Package,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Estoque'],
  },
  {
    id: 'produtos-venda',
    label: 'PRODUTOS DE VENDA',
    icon: ShoppingCart,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Estoque', 'Vendedor(a)', 'Vendedora Shopee', 'Recepção', 'Administrativo'],
  },
  {
    id: 'funcionarios',
    label: 'FUNCIONÁRIOS',
    icon: UserCheck,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Administrativo'],
  },
  {
    id: 'jornada',
    label: 'JORNADA',
    icon: Clock,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Administrativo'],
  },
  {
    id: 'conferencia-os',
    label: 'CONFERÊNCIA DE OS',
    icon: ClipboardCheck,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Conferência', 'Vendedor(a)', 'Recepção', 'Administrativo', 'Estoque'],
  },
  {
    id: 'controle-expedicao',
    label: 'CONTROLE DE EXPEDIÇÃO',
    icon: Truck,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Expedição'],
  },
  {
    id: 'entrega-devolucao',
    label: 'ENTREGA & DEVOLUÇÃO',
    icon: PackageCheck,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Expedição', 'Recepção', 'Administrativo'],
  },
  {
    id: 'relatorios',
    label: 'RELATÓRIOS',
    icon: BarChart3,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Administrativo', 'Estoque', 'Conferência', 'Recepção'],
  },
  {
    id: 'azulzinha',
    label: 'AZULZINHA',
    icon: CreditCard,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Administrativo'],
  },
  {
    id: 'gerenciador-caixa',
    label: 'GERENCIADOR CAIXA',
    icon: Landmark,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Administrativo'],
  },
  {
    id: 'notas-fiscais',
    label: 'NOTAS FISCAIS (NF-e)',
    icon: FileText,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Administrativo', 'Vendedor(a)', 'Recepção'],
  },
  {
    id: 'gerenciador-notas-fiscais',
    label: 'GERENCIADOR DE NOTAS FISCAIS',
    icon: FileSpreadsheet,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Administrativo', 'Vendedor(a)', 'Recepção'],
  },
  {
    id: 'waleads',
    label: 'WALEADS',
    icon: MessageCircle,
    roles: [
      'Developer',
      'CEO',
      'Gerente Geral',
      'Supervisor',
      'Vendedor(a)',
      'Recepção',
      'Administrativo',
    ],
  },
  {
    id: 'rh',
    label: 'RH',
    icon: Building2,
    roles: ['Developer', 'Administrativo'],
  },
  {
    id: 'historico-os',
    label: 'HISTÓRICO DE OS',
    icon: History,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Vendedor(a)', 'Conferência', 'Recepção'],
  },
  {
    id: 'mensagens',
    label: 'MENSAGENS INTERNAS',
    icon: MessageSquare,
    roles: [
      'Developer',
      'CEO',
      'Gerente Geral',
      'Administrativo',
      'Supervisor',
      'Monitor',
      'Vendedor(a)',
      'Designer',
      'Impressão',
      'Calandra',
      'Costura',
      'Estoque',
      'Conferência',
      'Expedição',
      'Recepção',
    ],
  },
  {
    id: 'caixa-pdv',
    label: 'PDV',
    icon: ShoppingCart,
    roles: ['Developer', 'CEO', 'Gerente Geral', 'Supervisor', 'Vendedor(a)', 'Recepção'],
  },
  {
    id: 'backup',
    label: 'BACKUP',
    icon: Database,
    roles: ['Developer', 'ADM MASTER', 'CEO'],
  },
  {
    id: 'configuracoes',
    label: 'CONFIGURAÇÕES',
    icon: Settings,
    roles: [
      'Developer',
      'CEO',
      'Gerente Geral',
      'Supervisor',
      'Monitor',
      'Vendedor(a)',
      'Designer',
      'Impressão',
      'Calandra',
      'Costura',
      'Estoque',
      'Conferência',
      'Expedição',
      'Recepção',
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  userRole,
  isDeveloper,
  user,
  activeMenu,
  activeRhSubTab = 'dashboard',
  onSelectMenu,
  isPinned,
  onTogglePin,
  isExpanded,
  onMouseEnter,
  onMouseLeave,
  isMobileOpen = false,
  onCloseMobile,
  onOpenSupport,
}) => {
  const { isHolidayThemeActive, palette } = useTheme();
  const [, setPermissionsVersion] = useState(0);
  const { isInstalled, hasPrompt, promptInstall } = usePWAInstall();
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
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

  // Perfil da Vendedora Shopee & Acesso
  // "O MENU LATERAL DO 'Perfil da Vendedora Shopee & Acesso' SERÁ ESSE:
  // 'DASHBOARD'
  // 'FLUXO DE PRODUÇÃO'
  // 'ORDEM DE SERVIÇO SHOPEE'
  // 'RELATÓRIOS'
  // 'MENSAGENS INTERNAS'"
  const isShopeeSeller = isShopeeSellerProfile(userRole, user?.localAtuacao, user?.username);

  // Filter menu items based on stored RBAC permissions map for user role
  let allowedMenuItems = MASTER_MENU_ITEMS.filter((item) => {
    if (item.id === 'dev-dashboard') return isDeveloper;
    if (item.id === 'backup') return isDeveloperOrAdminMaster(userRole, isDeveloper);

    if (isShopeeSeller && !isDeveloper) {
      const shopeeAllowed = [
        'dashboard',
        'kanban',
        'ordem-servico-shopee',
        'relatorios',
        'mensagens',
      ];
      return shopeeAllowed.includes(item.id);
    }

    return canUserAccessModule(userRole, item.id, isDeveloper, user?.localAtuacao);
  });

  if (isShopeeSeller && !isDeveloper) {
    const shopeeOrder = [
      'dashboard',
      'kanban',
      'ordem-servico-shopee',
      'relatorios',
      'mensagens',
    ];
    allowedMenuItems = [...allowedMenuItems].sort(
      (a, b) => shopeeOrder.indexOf(a.id) - shopeeOrder.indexOf(b.id)
    );
  }

  const handleItemClick = (id: string, label: string) => {
    onSelectMenu(id, label);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* MOBILE DRAWER (Off-canvas on < md screens) */}
      <aside
        style={
          palette.isCustomPalette
            ? {
                backgroundColor: palette.sidebarBg,
                color: palette.sidebarText,
                borderRightColor: `${palette.activeItemBg}40`,
              }
            : undefined
        }
        className={`fixed top-0 left-0 bottom-0 z-50 transition-transform duration-300 ease-in-out flex flex-col shadow-2xl select-none md:hidden w-72 max-w-[85vw] overflow-hidden no-scrollbar ${
          !palette.isCustomPalette && isHolidayThemeActive
            ? 'bg-gradient-to-b from-[#78350f] via-[#92400e] to-[#451a03] text-white border-r-2 border-amber-400/50'
            : !palette.isCustomPalette
            ? 'bg-[#2563EB] text-white border-r border-blue-500/30'
            : 'border-r-2'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* MOBILE HEADER */}
        <div
          style={
            palette.isCustomPalette
              ? {
                  backgroundColor: palette.headerBg,
                  color: palette.headerText,
                  borderBottomColor: palette.borderColor || `${palette.activeItemBg}40`,
                }
              : undefined
          }
          className={`h-16 border-b flex items-center justify-between px-3.5 ${
            !palette.isCustomPalette && isHolidayThemeActive
              ? 'bg-[#78350f] border-amber-400/40 text-white'
              : !palette.isCustomPalette
              ? 'bg-[#2563EB] border-blue-500/30 text-white'
              : ''
          }`}
        >
          <div className="flex items-center gap-3 overflow-visible">
            <div className="relative p-1.5 bg-white/10 rounded-xl shrink-0 overflow-visible z-50">
              {isHolidayThemeActive && (
                <SantaHat className="w-6 h-6 absolute -top-3 -right-2 rotate-12 drop-shadow-lg pointer-events-none z-[100]" />
              )}
              <img
                src={LOGO_URL}
                alt="Logo ERP"
                className="h-8 w-auto object-contain relative z-40"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex flex-col whitespace-nowrap overflow-hidden">
              <span className="font-black text-sm tracking-tight leading-tight">
                SubliGestão
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                !palette.isCustomPalette && isHolidayThemeActive ? 'text-amber-300' : 'opacity-85'
              }`}>
                ERP Tecido Sublimado Fortaleza
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className={`p-1.5 rounded-lg border cursor-pointer ${
              !palette.isCustomPalette && isHolidayThemeActive
                ? 'bg-amber-900/60 hover:bg-amber-800 text-amber-100 border-amber-400/40'
                : 'bg-white/10 hover:bg-white/20 border-white/20'
            }`}
            title="Fechar Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MOBILE NAVIGATION ITEMS */}
        <div
          className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1.5 no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {allowedMenuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeMenu === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id, item.label)}
                style={
                  palette.isCustomPalette
                    ? isActive
                      ? {
                          backgroundColor: palette.activeItemBg,
                          color: palette.activeItemText,
                        }
                      : {
                          color: palette.sidebarText,
                        }
                    : undefined
                }
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-extrabold text-sm sm:text-base transition-all cursor-pointer ${
                  !palette.isCustomPalette
                    ? isHolidayThemeActive
                      ? isActive
                        ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-950/40 ring-2 ring-amber-200 scale-[1.01]'
                        : 'text-amber-100 hover:text-white hover:bg-amber-600/40'
                      : isActive
                        ? 'bg-blue-800 text-white shadow-lg shadow-blue-950/50 ring-2 ring-white/50 scale-[1.01]'
                        : 'text-blue-100 hover:text-white hover:bg-blue-700/50'
                    : isActive
                      ? 'shadow-md scale-[1.01] font-black'
                      : 'hover:bg-white/10'
                }`}
              >
                <IconComponent
                  style={
                    palette.isCustomPalette && !isActive
                      ? { color: palette.iconColor }
                      : undefined
                  }
                  className={`w-5 h-5 shrink-0 ${
                    !palette.isCustomPalette
                      ? isHolidayThemeActive
                        ? isActive ? 'text-slate-950 stroke-[2.5]' : 'text-amber-200'
                        : isActive ? 'text-white stroke-[2.5]' : 'text-blue-200'
                      : isActive ? 'stroke-[2.5]' : 'opacity-85'
                  }`}
                />
                <span className={`truncate whitespace-nowrap text-left ${
                  isActive ? 'font-black' : 'font-bold'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* MOBILE FOOTER (Circulado na imagem) */}
        <div
          style={
            palette.isCustomPalette
              ? {
                  backgroundColor: `${palette.sidebarFooterBg}ee`,
                  borderTopColor: palette.borderColor || `${palette.activeItemBg}40`,
                }
              : undefined
          }
          className="p-3 border-t border-blue-500/30 bg-blue-700/70 backdrop-blur-md space-y-2"
        >
          {!isInstalled && (
            <button
              type="button"
              onClick={() => {
                if (hasPrompt) {
                  promptInstall();
                } else {
                  setShowInstallModal(true);
                }
              }}
              className="w-full py-2 px-3 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white rounded-xl border border-white/20 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition shadow-xs"
            >
              <Download className="w-4 h-4 text-amber-300" />
              <span>Instalar no Celular</span>
            </button>
          )}

          <div
            style={
              palette.isCustomPalette
                ? {
                    backgroundColor: palette.sidebarFooterBg,
                    color: palette.sidebarFooterText,
                    borderColor: palette.borderColor || `${palette.activeItemBg}40`,
                  }
                : undefined
            }
            className="flex items-center justify-between p-2 bg-blue-800/50 rounded-xl border border-blue-400/30"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldCheck
                className="w-5 h-5 shrink-0"
                style={palette.isCustomPalette ? { color: palette.iconColor || palette.activeItemBg } : undefined}
              />
              <div className="flex flex-col whitespace-nowrap overflow-hidden">
                <span className="text-xs font-bold truncate">{userRole}</span>
                <span className="text-[10px] opacity-80 font-medium">Acesso RBAC Nível 1</span>
              </div>
            </div>
            {onOpenSupport && (
              <button
                type="button"
                onClick={() => {
                  if (onCloseMobile) onCloseMobile();
                  onOpenSupport();
                }}
                style={
                  palette.isCustomPalette
                    ? {
                        backgroundColor: palette.supportBg || `${palette.activeItemBg}35`,
                        color: palette.supportText || palette.sidebarFooterText,
                        borderColor: palette.borderColor || `${palette.activeItemBg}60`,
                      }
                    : undefined
                }
                className="px-2.5 py-1 bg-cyan-500/25 hover:bg-cyan-500/40 active:bg-cyan-500/50 text-cyan-100 hover:text-white rounded-lg border border-cyan-400/40 text-[11px] font-black flex items-center gap-1.5 transition shadow-xs cursor-pointer shrink-0 ml-2"
                title="Falar com o Suporte Técnico / TI"
              >
                <Headphones
                  className="w-3.5 h-3.5"
                  style={palette.isCustomPalette && palette.iconColor ? { color: palette.iconColor } : undefined}
                />
                <span>Suporte</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* DESKTOP SIDEBAR (Visible on md+ screens) */}
      <aside
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={
          palette.isCustomPalette
            ? {
                backgroundColor: palette.sidebarBg,
                color: palette.sidebarText,
                borderRightColor: palette.borderColor || `${palette.activeItemBg}40`,
              }
            : undefined
        }
        className={`hidden md:flex fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 ease-in-out flex-col shadow-2xl select-none overflow-hidden no-scrollbar ${
          !palette.isCustomPalette && isHolidayThemeActive
            ? 'bg-gradient-to-b from-[#78350f] via-[#92400e] to-[#451a03] text-white border-r-2 border-amber-400/50 shadow-amber-950/30'
            : !palette.isCustomPalette
            ? 'bg-[#2563EB] text-white border-r border-blue-500/30'
            : 'border-r-2'
        } ${
          isExpanded ? 'w-64' : 'w-16'
        }`}
      >
        {/* DESKTOP SIDEBAR HEADER / BRANDING */}
        <div
          style={
            palette.isCustomPalette
              ? {
                  backgroundColor: palette.headerBg,
                  color: palette.headerText,
                  borderBottomColor: palette.borderColor || `${palette.activeItemBg}40`,
                }
              : undefined
          }
          className={`h-16 border-b flex items-center transition-all duration-300 ${
            !palette.isCustomPalette && isHolidayThemeActive
              ? 'bg-[#78350f] border-amber-400/40 text-white'
              : !palette.isCustomPalette
              ? 'bg-[#2563EB] border-blue-500/30 text-white'
              : ''
          } ${
            isExpanded ? 'justify-between px-3' : 'justify-center px-2'
          }`}
        >
          <div className={`flex items-center gap-3 overflow-visible ${!isExpanded ? 'justify-center w-full' : ''}`}>
            <div className={`relative p-1 bg-white/10 rounded-xl shrink-0 flex items-center justify-center overflow-visible z-50 ${!isExpanded ? 'w-10 h-10' : ''}`}>
              {isHolidayThemeActive && (
                <SantaHat className="w-6 h-6 absolute -top-3 -right-2 rotate-12 drop-shadow-lg pointer-events-none z-[100]" />
              )}
              <img
                src={isExpanded ? LOGO_URL : LOGO_COLLAPSED_URL}
                alt="Logo ERP"
                className={`${isExpanded ? 'h-8 w-auto' : 'h-8 w-8'} object-contain transition-all duration-300 relative z-40`}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            {isExpanded && (
              <div className="flex flex-col whitespace-nowrap overflow-hidden">
                <span className="font-black text-sm tracking-tight leading-tight">
                  SubliGestão
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  !palette.isCustomPalette && isHolidayThemeActive ? 'text-amber-300' : 'opacity-85'
                }`}>
                  ERP Tecido Sublimado Fortaleza
                </span>
              </div>
            )}
          </div>

          {/* PIN / TOGGLE BUTTON */}
          {isExpanded && (
            <button
              type="button"
              onClick={onTogglePin}
              className="p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 transition-all cursor-pointer"
              title={isPinned ? 'Desfixar Menu Lateral' : 'Fixar Menu Lateral'}
            >
              {isPinned ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          )}
        </div>

        {/* NAVIGATION ITEMS LIST */}
        <div
          className="flex-1 overflow-y-auto py-3 px-2 space-y-1.5 no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {allowedMenuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeMenu === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectMenu(item.id, item.label)}
                title={!isExpanded ? item.label : undefined}
                style={
                  palette.isCustomPalette
                    ? isActive
                      ? {
                          backgroundColor: palette.activeItemBg,
                          color: palette.activeItemText,
                        }
                      : {
                          color: palette.sidebarText,
                        }
                    : undefined
                }
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-extrabold text-base transition-all cursor-pointer ${
                  !palette.isCustomPalette
                    ? isHolidayThemeActive
                      ? isActive
                        ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-950/40 ring-2 ring-amber-200 scale-[1.02]'
                        : 'text-amber-100 hover:text-white hover:bg-amber-600/40'
                      : isActive
                        ? 'bg-blue-800 text-white shadow-lg shadow-blue-950/50 ring-2 ring-white/50 scale-[1.02]'
                        : 'text-blue-100 hover:text-white hover:bg-blue-700/50'
                    : isActive
                      ? 'shadow-md scale-[1.02] font-black'
                      : 'hover:bg-white/10'
                }`}
              >
                <IconComponent
                  style={
                    palette.isCustomPalette && !isActive
                      ? { color: palette.iconColor }
                      : undefined
                  }
                  className={`w-5 h-5 shrink-0 ${
                    !palette.isCustomPalette
                      ? isHolidayThemeActive
                        ? isActive ? 'text-slate-950 stroke-[2.5]' : 'text-amber-200'
                        : isActive ? 'text-white stroke-[2.5]' : 'text-blue-200'
                      : isActive ? 'stroke-[2.5]' : 'opacity-85'
                  }`}
                />
                {isExpanded && (
                  <span className={`truncate whitespace-nowrap text-left ${
                    isActive ? 'font-black' : 'font-bold'
                  }`}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* FOOTER - USER ROLE BADGE & SUPPORT BUTTON (Circulado na imagem) */}
        <div
          style={
            palette.isCustomPalette
              ? {
                  backgroundColor: `${palette.sidebarFooterBg}ee`,
                  borderTopColor: palette.borderColor || `${palette.activeItemBg}40`,
                }
              : undefined
          }
          className="p-3 border-t border-blue-500/30 bg-blue-700/70 backdrop-blur-md"
        >
          {isExpanded ? (
            <div
              style={
                palette.isCustomPalette
                  ? {
                      backgroundColor: palette.sidebarFooterBg,
                      color: palette.sidebarFooterText,
                      borderColor: palette.borderColor || `${palette.activeItemBg}40`,
                    }
                  : undefined
              }
              className="flex items-center justify-between p-2 bg-blue-800/50 rounded-xl border border-blue-400/30"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldCheck
                  className="w-5 h-5 shrink-0"
                  style={palette.isCustomPalette ? { color: palette.iconColor || palette.activeItemBg } : undefined}
                />
                <div className="flex flex-col whitespace-nowrap overflow-hidden">
                  <span className="text-xs font-bold truncate">{userRole}</span>
                  <span className="text-[10px] opacity-80 font-medium">Acesso RBAC Nível 1</span>
                </div>
              </div>
              {onOpenSupport && (
                <button
                  type="button"
                  onClick={onOpenSupport}
                  style={
                    palette.isCustomPalette
                      ? {
                          backgroundColor: palette.supportBg || `${palette.activeItemBg}35`,
                          color: palette.supportText || palette.sidebarFooterText,
                          borderColor: palette.borderColor || `${palette.activeItemBg}60`,
                        }
                      : undefined
                  }
                  className="px-2.5 py-1 bg-cyan-500/25 hover:bg-cyan-500/40 active:bg-cyan-500/50 text-cyan-100 hover:text-white rounded-lg border border-cyan-400/40 text-[11px] font-black flex items-center gap-1.5 transition shadow-xs cursor-pointer shrink-0 ml-2"
                  title="Falar com o Suporte Técnico / TI"
                >
                  <Headphones
                    className="w-3.5 h-3.5"
                    style={palette.isCustomPalette && palette.iconColor ? { color: palette.iconColor } : undefined}
                  />
                  <span>Suporte</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 p-1">
              <div title={`Perfil: ${userRole}`}>
                <ShieldCheck
                  className="w-5 h-5"
                  style={palette.isCustomPalette ? { color: palette.iconColor || palette.activeItemBg } : undefined}
                />
              </div>
              {onOpenSupport && (
                <button
                  type="button"
                  onClick={onOpenSupport}
                  style={
                    palette.isCustomPalette
                      ? {
                          backgroundColor: palette.supportBg || `${palette.activeItemBg}35`,
                          color: palette.supportText || palette.sidebarFooterText,
                          borderColor: palette.borderColor || `${palette.activeItemBg}60`,
                        }
                      : undefined
                  }
                  className="p-1.5 bg-cyan-500/25 hover:bg-cyan-500/40 text-cyan-100 hover:text-white rounded-lg border border-cyan-400/40 transition shadow-xs cursor-pointer"
                  title="Falar com o Suporte Técnico / TI"
                >
                  <Headphones
                    className="w-4 h-4"
                    style={palette.isCustomPalette && palette.iconColor ? { color: palette.iconColor } : undefined}
                  />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Fallback Install Modal for Mobile */}
      <PWAInstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </>
  );
};


