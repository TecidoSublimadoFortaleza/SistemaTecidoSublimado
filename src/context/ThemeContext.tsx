import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { CustomTheme, DEFAULT_CORPORATE_PADRAO_THEME, DEFAULT_NATALINO_THEME, isThemeActive } from '../types/theme';
import { ApiService } from '../services/api';
import {
  generateHarmoniousPalette,
  getHighContrastTextColor,
  ComputedThemePalette,
  resolveImageUrl,
} from '../utils/colorContrast';

export interface ActiveThemePalette extends ComputedThemePalette {
  isCustomPalette: boolean;
}

interface ThemeContextValue {
  themes: CustomTheme[];
  activeTheme: CustomTheme | null;
  isHolidayThemeActive: boolean;
  palette: ActiveThemePalette;
  refreshThemes: () => Promise<void>;
  saveTheme: (theme: CustomTheme) => Promise<void>;
  deleteTheme: (id: string) => Promise<void>;
  applyThemeById: (themeId: string | null, targetTheme?: CustomTheme) => Promise<void>;
}

const DEFAULT_CORPORATE_PALETTE: ActiveThemePalette = {
  headerBg: '#2563EB',
  headerText: '#FFFFFF',
  sidebarBg: '#2563EB',
  sidebarText: '#FFFFFF',
  activeItemBg: '#FFFFFF',
  activeItemText: '#2563EB',
  sidebarFooterBg: '#1e3a8a',
  sidebarFooterText: '#FFFFFF',
  accentBorder: '#3b82f6',
  moduleCardBg: '#FFFFFF',
  moduleCardText: '#0F172A',
  accentColor: '#2563EB',
  accentText: '#FFFFFF',
  sidebarContrastRatio: 8.5,
  activeItemContrastRatio: 8.5,
  headerContrastRatio: 8.5,
  wcagLevel: 'AAA',
  isCustomPalette: false,
};

const ThemeContext = createContext<ThemeContextValue>({
  themes: [DEFAULT_CORPORATE_PADRAO_THEME, DEFAULT_NATALINO_THEME],
  activeTheme: null,
  isHolidayThemeActive: false,
  palette: DEFAULT_CORPORATE_PALETTE,
  refreshThemes: async () => {},
  saveTheme: async () => {},
  deleteTheme: async () => {},
  applyThemeById: async () => {},
});

const THEME_CACHE_KEY = 'subligestao_custom_themes_cache';
export const ACTIVE_THEME_CACHE_KEY = 'subligestao_active_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themes, setThemes] = useState<CustomTheme[]>(() => {
    const deleted = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('subligestao_deleted_theme_ids') || '[]')) : [];
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(THEME_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = parsed.filter((t: CustomTheme) => t && t.id && !deleted.includes(t.id));
            if (filtered.length > 0) return filtered;
          }
        }
      } catch (_) {}

      // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
      // Fallback prioritário: se o cache geral estiver vazio ou em nova aba, recupera o tema ativo instantaneamente
      try {
        const activeCached = localStorage.getItem(ACTIVE_THEME_CACHE_KEY);
        if (activeCached) {
          const parsedActive = JSON.parse(activeCached);
          if (parsedActive && parsedActive.id && !deleted.includes(parsedActive.id)) {
            return [parsedActive, DEFAULT_CORPORATE_PADRAO_THEME, DEFAULT_NATALINO_THEME];
          }
        }
      } catch (_) {}
    }
    const initialList = [DEFAULT_CORPORATE_PADRAO_THEME, DEFAULT_NATALINO_THEME];
    return initialList.filter((t) => !deleted.includes(t.id));
  });

  // Identifica o tema atualmente ativo
  const activeTheme = useMemo(() => {
    // 1. Prioriza tema com displayTheme === true ou is_active === true (aplicado ativamente no sistema)
    const forceDisplay = themes.find((t) => t.displayTheme === true || t.is_active === true);
    if (forceDisplay) return forceDisplay;

    // 2. Verifica se algum tema está no período de data ativa
    const activeByDate = themes.find((t) => isThemeActive(t));
    if (activeByDate) return activeByDate;

    // 3. CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
    // Fallback instantâneo em tempo de montagem para o tema ativo salvo em cache
    if (typeof window !== 'undefined') {
      try {
        const activeCached = localStorage.getItem(ACTIVE_THEME_CACHE_KEY);
        if (activeCached) {
          const parsedActive = JSON.parse(activeCached);
          if (parsedActive && parsedActive.id) return parsedActive;
        }
      } catch (_) {}
    }

    // 4. Se não houver tema com "Exibir Tema" marcado nem na data vigente, retorna null (Modelo Padrão Azul)
    return null;
  }, [themes]);

  const isHolidayThemeActive = Boolean(
    activeTheme && (activeTheme.themeType === 'natalino' || activeTheme.primaryColor === 'gold')
  );

  // Calcula a paleta dinâmica com garantia de contraste do círculo cromático e luminosidade
  const palette = useMemo<ActiveThemePalette>(() => {
    if (!activeTheme) {
      return DEFAULT_CORPORATE_PALETTE;
    }

    const custom = activeTheme.palette;
    if (custom && custom.headerBg && custom.sidebarBg) {
      const headerBg = custom.headerBg;
      const headerText = custom.headerText || getHighContrastTextColor(headerBg);
      const sidebarBg = custom.sidebarBg;
      const sidebarText = custom.sidebarText || getHighContrastTextColor(sidebarBg);
      const activeItemBg = custom.activeItemBg || '#F59E0B';
      const activeItemText = custom.activeItemText || getHighContrastTextColor(activeItemBg);
      const sidebarFooterBg = custom.sidebarFooterBg || '#451A03';
      const sidebarFooterText = custom.sidebarFooterText || getHighContrastTextColor(sidebarFooterBg);

      const moduleCardBg = custom.moduleCardBg || '#FFFFFF';
      const moduleCardText = custom.moduleCardText || '#0F172A';
      const accentColor = custom.accentColor || activeItemBg;
      const accentText = custom.accentText || activeItemText;

      return {
        headerBg,
        headerText,
        sidebarBg,
        sidebarText,
        activeItemBg,
        activeItemText,
        sidebarFooterBg,
        sidebarFooterText,
        accentBorder: '#D97706',
        moduleCardBg,
        moduleCardText,
        accentColor,
        accentText,
        supportBg: custom.supportBg || sidebarFooterBg,
        supportText: custom.supportText || activeItemBg,
        iconColor: custom.iconColor || activeItemBg,
        borderColor: custom.borderColor || `${activeItemBg}50`,
        isCustomPalette: true,
      };
    }

    // Se tiver apenas cor primária ou tipo natalino
    const baseColor = activeTheme.primaryColor === 'gold' ? '#B45309' : activeTheme.primaryColor || '#2563EB';
    const computed = generateHarmoniousPalette(baseColor);
    return {
      ...computed,
      isCustomPalette: true,
    };
  }, [activeTheme]);

  // Aplica classes e variáveis CSS de cores em document.documentElement para consumo instantâneo
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (isHolidayThemeActive) {
        document.body.classList.add('theme-holiday-gold');
      } else {
        document.body.classList.remove('theme-holiday-gold');
      }

      if (palette.isCustomPalette) {
        root.style.setProperty('--theme-header-bg', palette.headerBg);
        root.style.setProperty('--theme-header-text', palette.headerText);
        root.style.setProperty('--theme-sidebar-bg', palette.sidebarBg);
        root.style.setProperty('--theme-sidebar-text', palette.sidebarText);
        root.style.setProperty('--theme-active-item-bg', palette.activeItemBg);
        root.style.setProperty('--theme-active-item-text', palette.activeItemText);
        root.style.setProperty('--theme-sidebar-footer-bg', palette.sidebarFooterBg);
        root.style.setProperty('--theme-sidebar-footer-text', palette.sidebarFooterText);
        root.style.setProperty('--theme-module-card-bg', palette.moduleCardBg || '#FFFFFF');
        root.style.setProperty('--theme-module-card-text', palette.moduleCardText || '#0F172A');
        root.style.setProperty('--theme-accent-color', palette.accentColor || palette.activeItemBg);
        root.style.setProperty('--theme-accent-text', palette.accentText || palette.activeItemText);
      } else {
        root.style.removeProperty('--theme-header-bg');
        root.style.removeProperty('--theme-header-text');
        root.style.removeProperty('--theme-sidebar-bg');
        root.style.removeProperty('--theme-sidebar-text');
        root.style.removeProperty('--theme-active-item-bg');
        root.style.removeProperty('--theme-active-item-text');
        root.style.removeProperty('--theme-sidebar-footer-bg');
        root.style.removeProperty('--theme-sidebar-footer-text');
        root.style.removeProperty('--theme-module-card-bg');
        root.style.removeProperty('--theme-module-card-text');
        root.style.removeProperty('--theme-accent-color');
        root.style.removeProperty('--theme-accent-text');
      }
    }
  }, [isHolidayThemeActive, palette]);

  // Pré-carregamento imediato e leve: apenas do tema ATIVO atual
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlsToPreload = new Set<string>();
    const isMobile = window.innerWidth < 1024;

    // Se houver um tema ativo aplicado, pré-carrega apenas seus assets
    if (activeTheme) {
      if (!isMobile) {
        if (activeTheme.bg70Url) urlsToPreload.add(resolveImageUrl(activeTheme.bg70Url, ''));
        if (activeTheme.loginSettings?.bg70Url) urlsToPreload.add(resolveImageUrl(activeTheme.loginSettings.bg70Url, ''));
      }
      if (activeTheme.bg30Url) urlsToPreload.add(resolveImageUrl(activeTheme.bg30Url, ''));
      if (activeTheme.loginSettings?.bg30Url) urlsToPreload.add(resolveImageUrl(activeTheme.loginSettings.bg30Url, ''));
    } else {
      if (!isMobile) {
        urlsToPreload.add('/Login-fundo.jpg');
      }
      urlsToPreload.add('/images/login-texture.jpg');
    }
    urlsToPreload.add('/images/logo-web.webp');

    urlsToPreload.forEach((url) => {
      if (!url || typeof url !== 'string' || url.length < 3) return;
      const img = new Image();
      img.src = url;
    });
  }, [activeTheme]);

  const DELETED_THEMES_KEY = 'subligestao_deleted_theme_ids';

  const getDeletedThemeIds = (): string[] => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(DELETED_THEMES_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (_) {}
    }
    return [];
  };

  const markThemeAsDeleted = (id: string) => {
    if (typeof window !== 'undefined') {
      try {
        const current = getDeletedThemeIds();
        if (!current.includes(id)) {
          const updated = [...current, id];
          localStorage.setItem(DELETED_THEMES_KEY, JSON.stringify(updated));
        }
      } catch (_) {}
    }
  };

  const unmarkThemeAsDeleted = (id: string) => {
    if (typeof window !== 'undefined') {
      try {
        const current = getDeletedThemeIds();
        if (current.includes(id)) {
          const updated = current.filter((item) => item !== id);
          localStorage.setItem(DELETED_THEMES_KEY, JSON.stringify(updated));
        }
      } catch (_) {}
    }
  };

  const syncCache = (list: CustomTheme[]) => {
    setThemes(list);
    try {
      const sanitized = list.map((t) => ({
        ...t,
        bg70Url: t.bg70Url?.startsWith('data:') ? '' : t.bg70Url,
        bg30Url: t.bg30Url?.startsWith('data:') ? '' : t.bg30Url,
        loginSettings: t.loginSettings ? {
          ...t.loginSettings,
          bg70Url: t.loginSettings.bg70Url?.startsWith('data:') ? '' : t.loginSettings.bg70Url,
          fg70Url: t.loginSettings.fg70Url?.startsWith('data:') ? '' : t.loginSettings.fg70Url,
          bg30Url: t.loginSettings.bg30Url?.startsWith('data:') ? '' : t.loginSettings.bg30Url,
          fg30Url: t.loginSettings.fg30Url?.startsWith('data:') ? '' : t.loginSettings.fg30Url,
          imageLayers: (t.loginSettings.imageLayers || []).map((layer) => ({
            ...layer,
            url: layer.url?.startsWith('data:') ? '' : layer.url,
          })),
        } : t.loginSettings,
      }));
      localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(sanitized));

      // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
      // Salva o tema ativo em cache dedicado de alta prioridade para inicialização com zero delay visual
      const deletedIds = getDeletedThemeIds();
      const active = sanitized.find((t) => (t.displayTheme === true || t.is_active === true) && !deletedIds.includes(t.id));
      if (active) {
        localStorage.setItem(ACTIVE_THEME_CACHE_KEY, JSON.stringify(active));
      } else {
        localStorage.removeItem(ACTIVE_THEME_CACHE_KEY);
      }

      window.dispatchEvent(new CustomEvent('subligestao_theme_changed', { detail: list }));
    } catch (storageErr) {
      console.warn('Aviso: Limite de armazenamento local (localStorage) excedido ou protegido:', storageErr);
      try {
        localStorage.removeItem(THEME_CACHE_KEY);
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('subligestao_theme_changed', { detail: list }));
    }
  };

  const mergeServerThemes = (incoming: CustomTheme[]): CustomTheme[] => {
    const map = new Map<string, CustomTheme>();
    const deletedIds = getDeletedThemeIds();

    // 1. Identifica se há tema ativado vindo do servidor (autoridade máxima)
    const serverActive = incoming.find((t) => (t.displayTheme === true || t.is_active === true) && !deletedIds.includes(t.id));

    // 2. Insere todos os temas do servidor (autoridade máxima: se foi excluído, não entra no mapa!)
    for (const item of incoming) {
      if (item && item.id && !deletedIds.includes(item.id)) {
        unmarkThemeAsDeleted(item.id);
        map.set(item.id, {
          ...item,
          displayTheme: serverActive ? item.id === serverActive.id : Boolean(item.displayTheme),
          is_active: serverActive ? item.id === serverActive.id : Boolean(item.is_active),
        });
      }
    }

    // 3. Garante que os temas padrão essenciais sempre existam se o servidor não enviou
    if (!map.has(DEFAULT_CORPORATE_PADRAO_THEME.id)) {
      map.set(DEFAULT_CORPORATE_PADRAO_THEME.id, {
        ...DEFAULT_CORPORATE_PADRAO_THEME,
        displayTheme: serverActive ? false : true,
      });
    }
    if (!map.has(DEFAULT_NATALINO_THEME.id)) {
      map.set(DEFAULT_NATALINO_THEME.id, {
        ...DEFAULT_NATALINO_THEME,
        displayTheme: serverActive ? serverActive.id === DEFAULT_NATALINO_THEME.id : false,
      });
    }

    return Array.from(map.values());
  };

  const refreshThemes = useCallback(async () => {
    try {
      const serverThemes = await ApiService.getThemes();
      if (Array.isArray(serverThemes) && serverThemes.length > 0) {
        const merged = mergeServerThemes(serverThemes);
        syncCache(merged);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    // Carregamento inicial garantido
    refreshThemes();

    // 1. Conexão SSE (Server-Sent Events) para propagação instantânea em tempo real para todos os perfis
    let eventSource: EventSource | null = null;
    let sseRetryTimer: any = null;

    const setupSSE = () => {
      try {
        if (typeof window === 'undefined') return;
        eventSource = new EventSource('/api/v1/themes/stream');

        eventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload && Array.isArray(payload.data) && payload.data.length > 0) {
              const merged = mergeServerThemes(payload.data);
              syncCache(merged);
            }
          } catch (_) {}
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Reconectar rapidamente após 2 segundos em caso de oscilação
          if (!sseRetryTimer) {
            sseRetryTimer = setTimeout(() => {
              sseRetryTimer = null;
              setupSSE();
            }, 2000);
          }
        };
      } catch (_) {}
    };

    setupSSE();

    // 2. Verificação ultra-rápida de versão a cada 1.5 segundos (garantia de tempo real em proxies e abas em segundo plano)
    let knownVersion = 0;
    const versionCheckInterval = setInterval(async () => {
      try {
        if (typeof document !== 'undefined') {
          const v = await ApiService.getThemeVersion();
          if (v > knownVersion) {
            knownVersion = v;
            refreshThemes();
          }
        }
      } catch (_) {}
    }, 1500);

    // 3. Ouvinte de eventos entre abas e janelas do mesmo navegador
    const handleThemeEvent = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setThemes(mergeServerThemes(e.detail));
      } else {
        refreshThemes();
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === THEME_CACHE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            const merged = mergeServerThemes(parsed);
            setThemes(merged);
          }
        } catch (_) {}
      }
    };

    window.addEventListener('subligestao_theme_changed', handleThemeEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (sseRetryTimer) {
        clearTimeout(sseRetryTimer);
      }
      clearInterval(versionCheckInterval);
      window.removeEventListener('subligestao_theme_changed', handleThemeEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [refreshThemes]);

  const saveTheme = async (theme: CustomTheme) => {
    unmarkThemeAsDeleted(theme.id);
    let updatedList: CustomTheme[] = [];

    setThemes((prev) => {
      const exists = prev.some((t) => t.id === theme.id);
      if (theme.displayTheme || theme.is_active) {
        updatedList = exists
          ? prev.map((t) => (t.id === theme.id ? { ...theme, displayTheme: true, is_active: true } : { ...t, displayTheme: false, is_active: false }))
          : [...prev.map((t) => ({ ...t, displayTheme: false, is_active: false })), { ...theme, displayTheme: true, is_active: true }];
      } else {
        updatedList = exists ? prev.map((t) => (t.id === theme.id ? theme : t)) : [...prev, theme];
      }
      syncCache(updatedList);
      return updatedList;
    });

    try {
      const savedFromServer = await ApiService.saveTheme(theme);
      if (Array.isArray(savedFromServer) && savedFromServer.length > 0) {
        const merged = mergeServerThemes(savedFromServer);
        syncCache(merged);
      }
    } catch (err) {
      console.error('Falha ao sincronizar tema com Supabase:', err);
    }
  };

  const deleteTheme = async (id: string) => {
    markThemeAsDeleted(id);
    setThemes((prev) => {
      const updatedList = prev.filter((t) => t.id !== id);
      syncCache(updatedList);
      return updatedList;
    });

    try {
      const result = await ApiService.deleteTheme(id);
      if (Array.isArray(result)) {
        const merged = mergeServerThemes(result).filter((t) => t.id !== id);
        syncCache(merged);
      }
    } catch (err) {
      console.error('Falha ao excluir tema no Supabase:', err);
    }
  };

  const applyThemeById = async (themeId: string | null, targetTheme?: CustomTheme) => {
    let resolvedTheme = targetTheme;
    let computedList: CustomTheme[] = [];

    setThemes((prev) => {
      let list = [...prev];
      if (themeId && resolvedTheme && !list.some((t) => t.id === themeId)) {
        list.push(resolvedTheme);
      }
      if (!resolvedTheme && themeId) {
        resolvedTheme = list.find((t) => t.id === themeId);
      }
      computedList = list.map((t) => ({
        ...t,
        displayTheme: themeId ? t.id === themeId : false,
        is_active: themeId ? t.id === themeId : false,
        updatedAt: themeId && t.id === themeId ? new Date().toISOString() : t.updatedAt,
      }));
      syncCache(computedList);
      return computedList;
    });

    try {
      const saved = await ApiService.applyTheme(themeId, resolvedTheme);
      if (Array.isArray(saved) && saved.length > 0) {
        const merged = mergeServerThemes(saved);
        syncCache(merged);
      }
    } catch (err) {
      console.warn('Tentando fallback para saveTheme:', err);
      if (resolvedTheme) {
        const saved = await ApiService.saveTheme({
          ...resolvedTheme,
          displayTheme: true,
          is_active: true,
        });
        if (Array.isArray(saved)) {
          const merged = mergeServerThemes(saved);
          syncCache(merged);
        }
      } else {
        const saved = await ApiService.resetDefaultTheme();
        if (Array.isArray(saved)) {
          const merged = mergeServerThemes(saved);
          syncCache(merged);
        }
      }
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        themes,
        activeTheme,
        isHolidayThemeActive,
        palette,
        refreshThemes,
        saveTheme,
        deleteTheme,
        applyThemeById,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
