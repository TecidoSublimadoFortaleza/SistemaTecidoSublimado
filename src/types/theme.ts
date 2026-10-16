export interface ThemePaletteColors {
  headerBg?: string;
  headerText?: string;
  sidebarBg?: string;
  sidebarText?: string;
  activeItemBg?: string; // Módulo selecionado
  activeItemText?: string; // Fonte do módulo selecionado
  sidebarFooterBg?: string;
  sidebarFooterText?: string;
  moduleCardBg?: string;
  moduleCardText?: string;
  accentColor?: string;
  accentText?: string;
  harmonyMode?: 'golden' | 'complementary' | 'analogous' | 'triadic' | 'monochrome' | 'auto';
  // Personalização individual de lugares circulados
  supportBg?: string;        // Cor de fundo do botão/área de Suporte
  supportText?: string;      // Cor da fonte de Suporte
  iconColor?: string;        // Cor dos ícones (Menu, Header, Suporte)
  borderColor?: string;      // Cor dos contornos / bordas
}

export interface LoginImageLayer {
  id: string;
  url: string;
  isForeground: boolean; // true = Primeiro plano (à frente dos textos), false = Segundo plano (por trás)
  panel: '70' | '30';    // '70' (Área Hero 70%) ou '30' (Área Formulário 30%)
  posX?: number;         // Posição X em % (0 a 100)
  posY?: number;         // Posição Y em % (0 a 100)
  scale?: number;        // Escala/Tamanho em % (10 a 200)
  opacity?: number;      // Opacidade (0 a 100)
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
}

export interface LoginCustomizationSettings {
  bg70Url?: string; // Segundo plano 70%
  fg70Url?: string; // Primeiro plano 70%
  bg30Url?: string; // Segundo plano 30%
  fg30Url?: string; // Primeiro plano 30%
  imageLayers?: LoginImageLayer[];
  loginHeroTitle?: string;
  loginHeroSubtitle?: string;
  loginHeroTitleColor?: string;
  loginHeroSubtitleColor?: string;
  loginFormTitle?: string;
  loginFormSubtitle?: string;
  loginFormTitleColor?: string;
  loginFormSubtitleColor?: string;
  loginFormLabelColor?: string;
  loginFormSecurityTextColor?: string;
  loginButtonBg?: string;
  loginButtonText?: string;
  loginButtonTextColor?: string;
}

export interface SplashCustomizationSettings {
  bgUrl?: string;            // Imagem de Fundo da Tela de Transição
  bgColor?: string;          // Cor ou Gradiente de Fundo
  greetingColor?: string;    // Cor do texto de saudação ("Seja bem-vindo...")
  messageColor?: string;     // Cor do texto da Mensagem do Dia / Frase
  progressColor?: string;    // Cor da barra de progresso e % de carregamento
  animationEffect?: 'none' | 'snow' | 'twinkle' | 'sparkles' | 'lights'; // Animações (neve caindo, pisca-pisca, estrelas)
}

export interface CustomTheme {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  displayTheme: boolean; // Se marcado, exibe o tema a qualquer momento
  is_active?: boolean; // Sincronizado com a coluna is_active da tabela themes do Supabase
  themeType: 'natalino' | 'padrao' | 'custom';
  primaryColor: 'gold' | string;
  palette?: ThemePaletteColors;
  bg70Url?: string;
  bg30Url?: string;
  loginSettings?: LoginCustomizationSettings;
  splashSettings?: SplashCustomizationSettings;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_CORPORATE_PADRAO_THEME: CustomTheme = {
  id: 'tema-padrao-azul',
  name: 'Tema Padrão SubliGestão (Azul Corporativo)',
  startDate: '',
  endDate: '',
  displayTheme: true,
  themeType: 'padrao',
  primaryColor: '#2563EB',
  palette: {
    headerBg: '#2563EB',
    headerText: '#FFFFFF',
    sidebarBg: '#2563EB',
    sidebarText: '#FFFFFF',
    activeItemBg: '#FFFFFF',
    activeItemText: '#2563EB',
    sidebarFooterBg: '#1e3a8a',
    sidebarFooterText: '#FFFFFF',
    moduleCardBg: '#FFFFFF',
    moduleCardText: '#0F172A',
    accentColor: '#2563EB',
    accentText: '#FFFFFF',
  },
  bg70Url: '/Login-fundo.jpg',
  bg30Url: '/images/login-texture.jpg',
  loginSettings: {
    bg70Url: '/Login-fundo.jpg',
    bg30Url: '/images/login-texture.jpg',
    loginHeroTitle: 'Controle Total de Produção, Estoque e Finanças em Tempo Real.',
    loginHeroSubtitle: 'Plataforma corporativa de missão crítica com fluxo de trabalho Kanban automatizado, módulo de RH inteligente e rastreabilidade ponta a ponta.',
    loginHeroTitleColor: '#FFFFFF',
    loginHeroSubtitleColor: '#DBEAFE',
    loginFormTitle: 'Acesso ao ERP',
    loginFormSubtitle: 'Informe seu usuário e senha corporativa',
    loginFormTitleColor: '#0F172A',
    loginFormSubtitleColor: '#475569',
    loginFormLabelColor: '#334155',
    loginFormSecurityTextColor: '#047857',
    loginButtonBg: '#2563EB',
    loginButtonText: 'Acessar SubliGestão',
    loginButtonTextColor: '#FFFFFF',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_NATALINO_THEME: CustomTheme = {
  id: 'tema-natalino-2026',
  name: 'Tema Natalino 2026',
  startDate: '2026-12-01',
  endDate: '2026-12-31',
  displayTheme: false,
  themeType: 'natalino',
  primaryColor: 'gold',
  palette: {
    headerBg: '#92400e',
    headerText: '#ffffff',
    sidebarBg: '#78350f',
    sidebarText: '#ffffff',
    activeItemBg: '#f59e0b',
    activeItemText: '#0f172a',
    sidebarFooterBg: '#451a03',
    sidebarFooterText: '#fef3c7',
  },
  bg70Url: '/images/natalino-fundo.png',
  bg30Url: '/images/natalino-fundo2.png',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function isThemeActive(theme: CustomTheme | null | undefined): boolean {
  if (!theme) return false;
  // Regra: checkbox "exibir tema" exibe a qualquer momento quando marcada
  if (theme.displayTheme) return true;
  if (!theme.startDate || !theme.endDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return today >= theme.startDate && today <= theme.endDate;
}
