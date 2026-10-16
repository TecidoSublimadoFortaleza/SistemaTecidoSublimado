/**
 * Utilitário Completo de Matemática de Cores, Círculo Cromático e Contraste WCAG 2.1
 * Garante o perfeito contraste com base no círculo cromático (matiz HSL) e na diferença de luminosidade relativa.
 */

export interface ColorHSL {
  h: number; // 0 - 360
  s: number; // 0 - 100
  l: number; // 0 - 100
}

export interface ColorRGB {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
}

export type HarmonyMode = 'golden' | 'complementary' | 'analogous' | 'triadic' | 'monochrome' | 'auto';

export interface ComputedThemePalette {
  headerBg: string;
  headerText: string;
  sidebarBg: string;
  sidebarText: string;
  activeItemBg: string; // Módulo selecionado
  activeItemText: string; // Fonte do módulo selecionado
  sidebarFooterBg: string;
  sidebarFooterText: string;
  accentBorder: string;
  moduleCardBg?: string;
  moduleCardText?: string;
  accentColor?: string;
  accentText?: string;
  sidebarContrastRatio?: number;
  activeItemContrastRatio?: number;
  headerContrastRatio?: number;
  wcagLevel?: 'AAA' | 'AA' | 'AA-Large' | 'FAIL';
  supportBg?: string;
  supportText?: string;
  iconColor?: string;
  borderColor?: string;
}

/**
 * Converte Hexadecimal (#RRGGBB ou #RGB) para objeto RGB
 */
export function hexToRgb(hex: string): ColorRGB {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 37, g: 99, b: 235 }; // Fallback seguro
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Converte RGB para string Hexadecimal com padding
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converte RGB para HSL (Matiz 0-360°, Saturação 0-100%, Luminosidade 0-100%)
 */
export function rgbToHsl(r: number, g: number, b: number): ColorHSL {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h = h * 60;
  }

  return {
    h: Math.round(h < 0 ? h + 360 : h % 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converte HSL para RGB
 */
export function hslToRgb(h: number, s: number, l: number): ColorRGB {
  const hNorm = (((h % 360) + 360) % 360) / 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;

  if (sNorm === 0) {
    const val = Math.round(lNorm * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tNorm = t;
    if (tNorm < 0) tNorm += 1;
    if (tNorm > 1) tNorm -= 1;
    if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
    if (tNorm < 1 / 2) return q;
    if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  return {
    r: Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hNorm) * 255),
    b: Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255),
  };
}

/**
 * Converte HSL diretamente para Hexadecimal
 */
export function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

/**
 * Calcula a Luminosidade Relativa conforme especificação oficial WCAG 2.1
 * (0.0 = preto absoluto, 1.0 = branco absoluto)
 */
export function getRelativeLuminance(rgb: ColorRGB): number {
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const rLin = toLinear(rgb.r);
  const gLin = toLinear(rgb.g);
  const bLin = toLinear(rgb.b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calcula a Taxa de Contraste exata WCAG entre duas cores (1.0 a 21.0)
 * Fórmula: (L1 + 0.05) / (L2 + 0.05)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hexToRgb(hex1));
  const lum2 = getRelativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 10) / 10;
}

/**
 * Retorna o nível de conformidade WCAG e detalhes de legibilidade
 */
export function getWcagLevel(ratio: number): {
  level: 'AAA' | 'AA' | 'AA-Large' | 'FAIL';
  label: string;
  passes: boolean;
  colorClass: string;
} {
  if (ratio >= 7.0) {
    return {
      level: 'AAA',
      label: 'AAA - Contraste Perfeito',
      passes: true,
      colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-300',
    };
  }
  if (ratio >= 4.5) {
    return {
      level: 'AA',
      label: 'AA - Excelente Legibilidade',
      passes: true,
      colorClass: 'text-blue-700 bg-blue-100 border-blue-300',
    };
  }
  if (ratio >= 3.0) {
    return {
      level: 'AA-Large',
      label: 'AA Large - Aceitável',
      passes: true,
      colorClass: 'text-amber-700 bg-amber-100 border-amber-300',
    };
  }
  return {
    level: 'FAIL',
    label: 'Abaixo do ideal (Ajustar)',
    passes: false,
    colorClass: 'text-rose-700 bg-rose-100 border-rose-300',
  };
}

/**
 * Determina a cor ideal da fonte com contraste máximo para qualquer cor de fundo.
 * Testa tanto branco puro (#FFFFFF) quanto tons escuros de alta densidade (#0F172A).
 */
export function getHighContrastTextColor(hexBg: string): string {
  const whiteRatio = getContrastRatio(hexBg, '#FFFFFF');
  const darkRatio = getContrastRatio(hexBg, '#0F172A');
  return whiteRatio >= darkRatio ? '#FFFFFF' : '#0F172A';
}

/**
 * Calcula a harmonia cromática do módulo selecionado (activeItemBg)
 * com base no círculo cromático (matiz em graus) e na diferença de luminosidade.
 */
export function calculateHarmoniousModuleColor(
  sidebarBgHex: string,
  mode: HarmonyMode = 'golden'
): {
  activeItemBg: string;
  activeItemText: string;
  contrastRatio: number;
  wcagLevel: 'AAA' | 'AA' | 'AA-Large' | 'FAIL';
  wcagLabel: string;
} {
  const rgb = hexToRgb(sidebarBgHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const isDarkSidebar = hsl.l < 55;

  let activeH = hsl.h;
  let activeS = 85;
  let activeL = 50;

  switch (mode) {
    case 'golden':
      // Dourado Nobre / Ouro Metálico (Matiz 38° a 46° no círculo cromático)
      activeH = 43; // Âmbar Dourado reluzente
      if (isDarkSidebar) {
        activeS = 92;
        activeL = 54; // Dourado brilhante sobre fundo escuro
      } else {
        activeS = 95;
        activeL = 28; // Âmbar rico e profundo sobre fundo claro
      }
      break;

    case 'complementary':
      // Cor exatamente oposta (180° no círculo cromático)
      activeH = (hsl.h + 180) % 360;
      activeS = Math.min(95, hsl.s + 15);
      if (isDarkSidebar) {
        activeL = 60; // Luminosidade alta para se destacar
      } else {
        activeL = 26; // Luminosidade baixa para alto contraste
      }
      break;

    case 'analogous':
      // Cor vizinha (+35° no círculo cromático)
      activeH = (hsl.h + 35) % 360;
      activeS = Math.min(95, hsl.s + 20);
      activeL = isDarkSidebar ? 58 : 28;
      break;

    case 'triadic':
      // Vértice triádico (+120° no círculo cromático)
      activeH = (hsl.h + 120) % 360;
      activeS = Math.min(95, hsl.s + 15);
      activeL = isDarkSidebar ? 56 : 27;
      break;

    case 'monochrome':
      // Monocromático de alta diferença de luminosidade
      activeH = hsl.h;
      activeS = Math.min(100, hsl.s + 10);
      activeL = isDarkSidebar ? 75 : 22;
      break;

    case 'auto':
    default:
      // Se a cor do menu for azulada ou escura, ouro é a harmonia complementar perfeita
      if (hsl.h >= 180 && hsl.h <= 260) {
        activeH = 42; // Dourado real
        activeS = 92;
        activeL = isDarkSidebar ? 52 : 30;
      } else if (isDarkSidebar) {
        // Se escuro, complementar vibrante
        activeH = (hsl.h + 180) % 360;
        activeS = 90;
        activeL = 60;
      } else {
        // Se claro, complementar escuro
        activeH = (hsl.h + 180) % 360;
        activeS = 90;
        activeL = 25;
      }
      break;
  }

  const activeItemBg = hslToHex(activeH, activeS, activeL);
  const activeItemText = getHighContrastTextColor(activeItemBg);
  const contrastRatio = getContrastRatio(activeItemBg, activeItemText);
  const wcag = getWcagLevel(contrastRatio);

  return {
    activeItemBg,
    activeItemText,
    contrastRatio,
    wcagLevel: wcag.level,
    wcagLabel: wcag.label,
  };
}

/**
 * Gera automaticamente a paleta completa e contrastante baseada em uma cor principal
 * utilizando o círculo cromático e relações matemáticas de luminosidade.
 */
export function generateHarmoniousPalette(
  baseColorHex: string,
  harmonyMode: HarmonyMode = 'golden'
): ComputedThemePalette {
  const rgb = hexToRgb(baseColorHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // 1. Barra Superior (Header)
  const headerBg = baseColorHex;
  const headerText = getHighContrastTextColor(headerBg);
  const headerRatio = getContrastRatio(headerBg, headerText);

  // 2. Menu Lateral (Sidebar)
  // Ligeiro ajuste na luminosidade do círculo cromático para elegância
  const sidebarHsl: ColorHSL = {
    h: hsl.h,
    s: Math.max(30, Math.min(100, hsl.s)),
    l: Math.max(10, Math.min(85, hsl.l > 50 ? hsl.l - 8 : hsl.l - 5)),
  };
  const sidebarBg = hslToHex(sidebarHsl.h, sidebarHsl.s, sidebarHsl.l);
  const sidebarText = getHighContrastTextColor(sidebarBg);
  const sidebarRatio = getContrastRatio(sidebarBg, sidebarText);

  // 3. Módulo Selecionado (Item Ativo do Menu Lateral)
  const moduleCalc = calculateHarmoniousModuleColor(sidebarBg, harmonyMode);
  const activeItemBg = moduleCalc.activeItemBg;
  const activeItemText = moduleCalc.activeItemText;
  const activeRatio = moduleCalc.contrastRatio;

  // 4. Rodapé do Menu Lateral (Developer / Acesso RBAC / Suporte)
  const isDarkSidebar = sidebarHsl.l < 55;
  const footerL = isDarkSidebar
    ? Math.max(8, sidebarHsl.l - 7)
    : Math.min(95, sidebarHsl.l + 8);
  const sidebarFooterBg = hslToHex(sidebarHsl.h, sidebarHsl.s, footerL);
  const sidebarFooterText = getHighContrastTextColor(sidebarFooterBg);

  // 5. Borda de Acento e Destaque
  const accentBorder = isDarkSidebar
    ? hslToHex(hsl.h, Math.min(100, hsl.s + 20), Math.min(80, sidebarHsl.l + 25))
    : hslToHex(hsl.h, Math.min(100, hsl.s + 15), Math.max(20, sidebarHsl.l - 20));

  // 6. Cartões dos Módulos / Content Cards
  const moduleCardBg = isDarkSidebar ? '#FFFFFF' : '#F8FAFC';
  const moduleCardText = '#0F172A';

  // 7. Botão de Destaque / Ação
  const accentColor = activeItemBg;
  const accentText = activeItemText;

  const wcag = getWcagLevel(Math.min(headerRatio, sidebarRatio, activeRatio));

  return {
    headerBg,
    headerText,
    sidebarBg,
    sidebarText,
    activeItemBg,
    activeItemText,
    sidebarFooterBg,
    sidebarFooterText,
    accentBorder,
    moduleCardBg,
    moduleCardText,
    accentColor,
    accentText,
    sidebarContrastRatio: sidebarRatio,
    activeItemContrastRatio: activeRatio,
    headerContrastRatio: headerRatio,
    wcagLevel: wcag.level,
  };
}

/**
 * Determina o nome elegante da tonalidade de cor com base na matiz, saturação e luminosidade HSL
 */
export function getColorNameByHex(hex: string): string {
  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  if (s < 12) {
    if (l < 20) return 'Grafite Noturno Ultra Dark';
    if (l < 50) return 'Cinza Chumbo Nobre';
    if (l < 80) return 'Prata Metálico';
    return 'Branco Marfim';
  }

  if (h >= 15 && h <= 50) {
    if (l < 35) return 'Dourado Âmbar Nobre';
    if (l < 65) return 'Ouro Champagne Luxo';
    return 'Dourado Festivo';
  }
  if (h > 50 && h <= 75) return 'Amarelo Ouro Solar';
  if (h > 75 && h <= 165) {
    if (l < 30) return 'Verde Esmeralda Imperial';
    return 'Verde Menta Luminoso';
  }
  if (h > 165 && h <= 200) return 'Ciano Turquesa Oceano';
  if (h > 200 && h <= 250) {
    if (l < 35) return 'Azul Marinho Real';
    return 'Azul Corporativo Sofisticado';
  }
  if (h > 250 && h <= 290) return 'Púrpura Ametista Real';
  if (h > 290 && h <= 340) return 'Magenta Orquídea Nobre';
  if (h > 340 || h < 15) {
    if (l < 35) return 'Vinho Borgonha & Rubi';
    return 'Vermelho Carmim Nobre';
  }
  return 'Personalizado Harmônico';
}

/**
 * Presets de cores elegantes e prontos para seleção rápida
 */
export const PRESET_THEME_PALETTES = [
  {
    id: 'gold-natalino',
    name: 'Dourado Natalino Nobre',
    baseColor: '#b45309',
    headerBg: '#92400e',
    sidebarBg: '#78350f',
    sidebarFooterBg: '#451a03',
    activeItemBg: '#f59e0b',
    activeItemText: '#0f172a',
    harmonyMode: 'golden' as HarmonyMode,
    description: 'Dourado metálico e âmbar quente festivo',
  },
  {
    id: 'gold-champagne',
    name: 'Ouro Champagne Luxo',
    baseColor: '#d97706',
    headerBg: '#b45309',
    sidebarBg: '#854d0e',
    sidebarFooterBg: '#543206',
    activeItemBg: '#fef08a',
    activeItemText: '#713f12',
    harmonyMode: 'golden' as HarmonyMode,
    description: 'Tons suaves de champagne e ouro acetinado',
  },
  {
    id: 'blue-corporativo',
    name: 'Azul Corporativo Real (Padrão)',
    baseColor: '#2563eb',
    headerBg: '#2563eb',
    sidebarBg: '#1d4ed8',
    sidebarFooterBg: '#1e3a8a',
    activeItemBg: '#ffffff',
    activeItemText: '#1d4ed8',
    harmonyMode: 'monochrome' as HarmonyMode,
    description: 'Visual corporativo e institucional padrão',
  },
  {
    id: 'emerald-imperial',
    name: 'Verde Esmeralda Imperial',
    baseColor: '#047857',
    headerBg: '#065f46',
    sidebarBg: '#064e3b',
    sidebarFooterBg: '#022c22',
    activeItemBg: '#34d399',
    activeItemText: '#064e3b',
    harmonyMode: 'golden' as HarmonyMode,
    description: 'Elegância de pinheiro e esmeralda profunda',
  },
  {
    id: 'ruby-festivo',
    name: 'Rubi e Vinho Nobre',
    baseColor: '#9f1239',
    headerBg: '#881337',
    sidebarBg: '#4c0519',
    sidebarFooterBg: '#2a020d',
    activeItemBg: '#fbbf24',
    activeItemText: '#0f172a',
    harmonyMode: 'golden' as HarmonyMode,
    description: 'Vinho nobre e acentos dourados reluzentes',
  },
  {
    id: 'slate-grafite',
    name: 'Grafite Noturno & Ouro',
    baseColor: '#1e293b',
    headerBg: '#0f172a',
    sidebarBg: '#090d16',
    sidebarFooterBg: '#020617',
    activeItemBg: '#fbbf24',
    activeItemText: '#0f172a',
    harmonyMode: 'golden' as HarmonyMode,
    description: 'Fundo ultra dark premium com acentos dourados',
  },
  {
    id: 'purple-royal',
    name: 'Púrpura & Ametista Real',
    baseColor: '#7e22ce',
    headerBg: '#6b21a8',
    sidebarBg: '#581c87',
    sidebarFooterBg: '#3b0764',
    activeItemBg: '#fbbf24',
    activeItemText: '#0f172a',
    harmonyMode: 'golden' as HarmonyMode,
    description: 'Púrpura sofisticado com destaque dourado luminoso',
  },
];

/**
 * Converte e sanitiza URLs de imagens (incluindo links de visualização do GitHub, caminhos locais e uploads Base64)
 */
export function resolveImageUrl(url: string | undefined | null, defaultFallback: string): string {
  if (!url || typeof url !== 'string' || !url.trim()) return defaultFallback;
  let cleanUrl = url.trim();

  // Tratamento de links do GitHub (ex: https://github.com/user/repo/blob/main/public/images/natalino-fundo.png?raw=true)
  if (cleanUrl.includes('github.com')) {
    if (cleanUrl.includes('/blob/')) {
      cleanUrl = cleanUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }
    // Para URLs do raw.githubusercontent.com, limpa parâmetros desnecessários que podem truncar a imagem
    if (cleanUrl.includes('raw.githubusercontent.com') && cleanUrl.includes('?raw=true')) {
      cleanUrl = cleanUrl.replace('?raw=true', '');
    }
  }

  // Tratamento de caminhos relativos
  if (cleanUrl.startsWith('public/')) {
    cleanUrl = '/' + cleanUrl.replace(/^public\//, '');
  } else if (
    !cleanUrl.startsWith('http://') &&
    !cleanUrl.startsWith('https://') &&
    !cleanUrl.startsWith('data:') &&
    !cleanUrl.startsWith('/') &&
    !cleanUrl.startsWith('//')
  ) {
    cleanUrl = '/' + cleanUrl;
  }

  return cleanUrl;
}
