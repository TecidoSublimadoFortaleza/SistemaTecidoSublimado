import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { CustomTheme, isThemeActive } from '../../types/theme';
import {
  Sparkles,
  Plus,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit2,
  AlertCircle,
  Check,
  CheckCheck,
  Loader2,
  X,
  Palette,
  Clock,
  Layers,
  Sliders,
  ShieldCheck,
  Headphones,
  RotateCcw,
  BookmarkPlus,
  Save,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Type,
  Eye,
  Lock,
  User,
  ArrowRight,
  Monitor,
  Building2,
} from 'lucide-react';
import { SantaHat } from '../common/SantaHat';
import {
  generateHarmoniousPalette,
  getHighContrastTextColor,
  getContrastRatio,
  getWcagLevel,
  calculateHarmoniousModuleColor,
  getColorNameByHex,
  PRESET_THEME_PALETTES,
  resolveImageUrl,
} from '../../utils/colorContrast';
import { compressImageFile } from '../../utils/imageCompressor';
import { ApiService } from '../../services/api';

interface ThemesSettingsSectionProps {
  isSettingsAdmin: boolean;
  isDeveloperUser: boolean;
}

export const ThemesSettingsSection: React.FC<ThemesSettingsSectionProps> = ({
  isSettingsAdmin,
  isDeveloperUser,
}) => {
  const { themes, saveTheme, deleteTheme, applyThemeById } = useTheme();

  // Seleção atual da checkbox "exibir tema" nos temas cadastrados
  const [selectedDisplayThemeId, setSelectedDisplayThemeId] = useState<string | null>(() => {
    const active = themes.find((t) => t.displayTheme === true || t.is_active === true);
    return active ? active.id : null;
  });
  const [isApplyingTheme, setIsApplyingTheme] = useState(false);

  // Mantém sincronizado apenas se o tema ativo REAL mudar no servidor, sem desmarcar a seleção pendente do usuário
  const prevActiveIdRef = React.useRef<string | null | undefined>(undefined);
  React.useEffect(() => {
    const active = themes.find((t) => t.displayTheme === true || t.is_active === true);
    const activeId = active ? active.id : null;

    if (prevActiveIdRef.current === undefined) {
      prevActiveIdRef.current = activeId;
      setSelectedDisplayThemeId(activeId);
      return;
    }

    if (activeId !== prevActiveIdRef.current) {
      prevActiveIdRef.current = activeId;
      setSelectedDisplayThemeId(activeId);
    }
  }, [themes]);

  // Estados dos modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null);
  const [themeToDelete, setThemeToDelete] = useState<CustomTheme | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campos do formulário
  const [formName, setFormName] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDisplayTheme, setFormDisplayTheme] = useState(false);
  const [formThemeType, setFormThemeType] = useState<'natalino' | 'padrao' | 'custom'>('natalino');
  const [formPrimaryColor, setFormPrimaryColor] = useState('gold');

  // Paleta de Cores Dinâmica (Locais circulados na imagem do usuário)
  const [formBaseColor, setFormBaseColor] = useState('#b45309');
  const [formHeaderBg, setFormHeaderBg] = useState('#92400e');
  const [formSidebarBg, setFormSidebarBg] = useState('#78350f');
  const [formActiveItemBg, setFormActiveItemBg] = useState('#f59e0b');
  const [formSidebarFooterBg, setFormSidebarFooterBg] = useState('#451a03');
  const [formHarmonyMode, setFormHarmonyMode] = useState<'golden' | 'complementary' | 'analogous' | 'triadic' | 'monochrome' | 'auto'>('golden');
  const [showAdvancedColors, setShowAdvancedColors] = useState(false);

  // Personalização individual dos lugares circulados (Suporte, Ícones, Fontes e Contornos)
  const [formSupportBg, setFormSupportBg] = useState('#451a03');
  const [formSupportText, setFormSupportText] = useState('#fef3c7');
  const [formIconColor, setFormIconColor] = useState('#f59e0b');
  const [formBorderColor, setFormBorderColor] = useState('#f59e0b50');

  const [formHeaderText, setFormHeaderText] = useState('#FFFFFF');
  const [formSidebarText, setFormSidebarText] = useState('#FFFFFF');
  const [formActiveItemText, setFormActiveItemText] = useState('#0F172A');
  const [formSidebarFooterText, setFormSidebarFooterText] = useState('#FEF3C7');

  // Campos da Página de Login (Área 70% e Área 30%)
  const [formLoginBg70Url, setFormLoginBg70Url] = useState('/images/natalino-fundo.png');
  const [formLoginFg70Url, setFormLoginFg70Url] = useState('');
  const [formLoginBg30Url, setFormLoginBg30Url] = useState('/images/natalino-fundo2.png');
  const [formLoginFg30Url, setFormLoginFg30Url] = useState('');

  // Camadas de Imagens Adicionais com Botão '+' e Posicionamento em Tempo Real
  const [formImageLayers, setFormImageLayers] = useState<any[]>([]);

  const [formLoginHeroTitle, setFormLoginHeroTitle] = useState('Controle Total de Produção, Estoque e Finanças em Tempo Real.');
  const [formLoginHeroSubtitle, setFormLoginHeroSubtitle] = useState('Plataforma corporativa de missão crítica com fluxo de trabalho Kanban automatizado, módulo de RH inteligente e rastreabilidade ponta a ponta.');
  const [formLoginHeroTitleColor, setFormLoginHeroTitleColor] = useState('#FFFFFF');
  const [formLoginHeroSubtitleColor, setFormLoginHeroSubtitleColor] = useState('#DBEAFE');

  const [formLoginFormTitle, setFormLoginFormTitle] = useState('Acesso ao ERP');
  const [formLoginFormSubtitle, setFormLoginFormSubtitle] = useState('Informe seu usuário e senha corporativa');
  const [formLoginFormTitleColor, setFormLoginFormTitleColor] = useState('#0F172A');
  const [formLoginFormSubtitleColor, setFormLoginFormSubtitleColor] = useState('#475569');
  const [formLoginFormLabelColor, setFormLoginFormLabelColor] = useState('#334155');
  const [formLoginFormSecurityTextColor, setFormLoginFormSecurityTextColor] = useState('#047857');

  const [formLoginButtonBg, setFormLoginButtonBg] = useState('#2563EB');
  const [formLoginButtonText, setFormLoginButtonText] = useState('Acessar SubliGestão');
  const [formLoginButtonTextColor, setFormLoginButtonTextColor] = useState('#FFFFFF');
  const [showLoginSettings, setShowLoginSettings] = useState(false);

  // Exclusão de opções das Sugestões Harmônicas Prontas
  const [deletedPresetIds, setDeletedPresetIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('subligestao_deleted_preset_ids');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (_) {}
    }
    return [];
  });

  // Sugestões Harmônicas salvas pelo usuário
  const [savedCustomPresets, setSavedCustomPresets] = useState<(typeof PRESET_THEME_PALETTES)[0][]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('subligestao_custom_palette_presets');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (_) {}
    }
    return [];
  });

  // Modo de Exibição das Miniaturas (Tela Inteira ERP, Tela de Login ou Ambas)
  const [previewMode, setPreviewMode] = useState<'both' | 'fullApp' | 'login'>('both');

  // Textos calculados automaticamente com contraste perfeito WCAG
  const computedHeaderText = formHeaderText || getHighContrastTextColor(formHeaderBg);
  const computedSidebarText = formSidebarText || getHighContrastTextColor(formSidebarBg);
  const computedActiveItemText = formActiveItemText || getHighContrastTextColor(formActiveItemBg);
  const computedFooterText = formSidebarFooterText || getHighContrastTextColor(formSidebarFooterBg);

  const headerContrastRatio = getContrastRatio(formHeaderBg, computedHeaderText);
  const sidebarContrastRatio = getContrastRatio(formSidebarBg, computedSidebarText);
  const activeContrastRatio = getContrastRatio(formActiveItemBg, computedActiveItemText);

  const headerWcag = getWcagLevel(headerContrastRatio);
  const sidebarWcag = getWcagLevel(sidebarContrastRatio);
  const activeWcag = getWcagLevel(activeContrastRatio);

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Atualiza automaticamente o nome do título do tema com base na cor escolhida
  const updateTitleNameFromColor = (hex: string) => {
    const colorName = getColorNameByHex(hex);
    setFormName(`Tema ${colorName}`);
  };

  // Excluir qualquer opção das Sugestões Harmônicas Prontas
  const handleDeletePreset = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (presetId.startsWith('custom-preset-')) {
      const updatedCustom = savedCustomPresets.filter((p) => p.id !== presetId);
      setSavedCustomPresets(updatedCustom);
      try {
        localStorage.setItem('subligestao_custom_palette_presets', JSON.stringify(updatedCustom));
      } catch (_) {}
    }
    const updatedDeleted = [...deletedPresetIds, presetId];
    setDeletedPresetIds(updatedDeleted);
    try {
      localStorage.setItem('subligestao_deleted_preset_ids', JSON.stringify(updatedDeleted));
    } catch (_) {}
    showFeedback('Sugestão harmônica excluída da lista com sucesso.', 'success');
  };

  const handleRestorePresets = () => {
    setDeletedPresetIds([]);
    try {
      localStorage.removeItem('subligestao_deleted_preset_ids');
    } catch (_) {}
    showFeedback('Sugestões harmônicas originais restauradas com sucesso!', 'success');
  };

  // Handlers para Imagens Adicionais com Botão '+' e Posicionamento em Tempo Real
  const handleAddImageLayer = () => {
    const newLayer = {
      id: `layer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      url: '',
      isForeground: false,
      panel: '70' as const,
      posX: 50,
      posY: 50,
      scale: 100,
      opacity: 100,
      objectFit: 'cover' as const,
    };
    setFormImageLayers((prev) => [...prev, newLayer]);
    showFeedback('Novo campo de imagem adicionado! Insira a URL ou faça upload.', 'success');
  };

  const handleRemoveLayer = (id: string) => {
    setFormImageLayers((prev) => prev.filter((l) => l.id !== id));
    showFeedback('Camada de imagem removida.', 'success');
  };

  const handleUpdateLayer = (id: string, updates: Record<string, any>) => {
    setFormImageLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  const handleLayerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, layerId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset para permitir re-seleção do mesmo arquivo
    e.target.value = '';

    if (file.size > 20 * 1024 * 1024) {
      showFeedback('A imagem selecionada excede o limite máximo permitido de 20MB.', 'error');
      return;
    }

    showFeedback('Otimizando e processando camada de imagem...', 'success');

    try {
      const compressedDataUrl = await compressImageFile(file, 1600, 0.82);
      let finalUrl = compressedDataUrl;

      // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
      // Salva a imagem como arquivo web estático leve no servidor para garantir carregamento instantâneo
      // sem delay de rede e sem estouro do limite de localStorage.
      try {
        const uploadRes = await ApiService.uploadThemeImage(compressedDataUrl, file.name);
        if (uploadRes && uploadRes.url) {
          finalUrl = uploadRes.url;
        }
      } catch (uploadErr) {
        console.warn('Upload de imagem estática operando com fallback em memória:', uploadErr);
      }

      handleUpdateLayer(layerId, { url: finalUrl });
      showFeedback('Camada de imagem atualizada e salva com sucesso!', 'success');
    } catch (err: any) {
      console.error('Erro no upload de camada de imagem:', err);
      showFeedback(`Falha ao processar imagem: ${err?.message || 'Erro desconhecido'}`, 'error');
    }
  };

  // Aplica uma cor base e calcula instantaneamente todos os contrastes harmônicos
  const handleApplyBaseColor = (baseHex: string, modeOverride?: 'golden' | 'complementary' | 'analogous' | 'triadic' | 'monochrome' | 'auto') => {
    setFormBaseColor(baseHex);
    const mode = modeOverride || formHarmonyMode;
    const computed = generateHarmoniousPalette(baseHex, mode);
    setFormHeaderBg(computed.headerBg);
    setFormSidebarBg(computed.sidebarBg);
    setFormActiveItemBg(computed.activeItemBg);
    setFormSidebarFooterBg(computed.sidebarFooterBg);
    setFormHeaderText(computed.headerText || getHighContrastTextColor(computed.headerBg));
    setFormSidebarText(computed.sidebarText || getHighContrastTextColor(computed.sidebarBg));
    setFormActiveItemText(computed.activeItemText || getHighContrastTextColor(computed.activeItemBg));
    setFormSidebarFooterText(computed.sidebarFooterText || getHighContrastTextColor(computed.sidebarFooterBg));
    setFormSupportBg(computed.sidebarFooterBg);
    setFormSupportText(computed.activeItemBg);
    setFormIconColor(computed.activeItemBg);
    setFormBorderColor(`${computed.activeItemBg}80`);
    updateTitleNameFromColor(computed.sidebarBg || baseHex);
  };

  const handleHarmonyModeChange = (mode: 'golden' | 'complementary' | 'analogous' | 'triadic' | 'monochrome' | 'auto') => {
    setFormHarmonyMode(mode);
    const moduleCalc = calculateHarmoniousModuleColor(formSidebarBg, mode);
    setFormActiveItemBg(moduleCalc.activeItemBg);
    setFormActiveItemText(getHighContrastTextColor(moduleCalc.activeItemBg));
  };

  // Aplica um dos presets prontos do círculo cromático
  const handleApplyPreset = (preset: (typeof PRESET_THEME_PALETTES)[0]) => {
    setFormBaseColor(preset.baseColor);
    setFormHeaderBg(preset.headerBg);
    setFormSidebarBg(preset.sidebarBg);
    setFormActiveItemBg(preset.activeItemBg);
    setFormSidebarFooterBg(preset.sidebarFooterBg);
    setFormHeaderText(getHighContrastTextColor(preset.headerBg));
    setFormSidebarText(getHighContrastTextColor(preset.sidebarBg));
    setFormActiveItemText(preset.activeItemText || getHighContrastTextColor(preset.activeItemBg));
    setFormSidebarFooterText(getHighContrastTextColor(preset.sidebarFooterBg));
    setFormSupportBg(preset.sidebarFooterBg);
    setFormSupportText(preset.activeItemBg);
    setFormIconColor(preset.activeItemBg);
    setFormBorderColor(`${preset.activeItemBg}80`);
    if (preset.harmonyMode) setFormHarmonyMode(preset.harmonyMode);
    
    // Altera o nome do título conforme a cor usada no preset
    const colorName = getColorNameByHex(preset.sidebarBg || preset.baseColor);
    setFormName(`Tema ${colorName}`);
  };

  // Salva a combinação atual como uma nova Sugestão Harmônica
  const handleSaveCurrentPaletteAsPreset = () => {
    const colorName = getColorNameByHex(formSidebarBg || formBaseColor);
    const newPreset = {
      id: `custom-preset-${Date.now()}`,
      name: `${colorName} (Personalizado)`,
      baseColor: formBaseColor,
      headerBg: formHeaderBg,
      sidebarBg: formSidebarBg,
      sidebarFooterBg: formSidebarFooterBg,
      activeItemBg: formActiveItemBg,
      activeItemText: computedActiveItemText,
      harmonyMode: formHarmonyMode,
      description: 'Sugestão harmônica salva pelo usuário',
    };

    const updated = [newPreset, ...savedCustomPresets];
    setSavedCustomPresets(updated);
    try {
      localStorage.setItem('subligestao_custom_palette_presets', JSON.stringify(updated));
    } catch (_) {}

    showFeedback(`Paleta "${newPreset.name}" salva com sucesso em Sugestões Harmônicas Prontas!`, 'success');
  };

  // Helper de Upload de Arquivos de Imagem para Tela de Login (70% ou 30%, Primeiro Plano ou Segundo Plano)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'bg70' | 'fg70' | 'bg30' | 'fg30') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset para permitir re-seleção do mesmo arquivo
    e.target.value = '';

    if (file.size > 20 * 1024 * 1024) {
      showFeedback('A imagem selecionada excede o limite máximo recomendado de 20MB.', 'error');
      return;
    }

    showFeedback('Otimizando e processando imagem...', 'success');

    try {
      const compressedDataUrl = await compressImageFile(file, 1600, 0.82);
      let finalUrl = compressedDataUrl;

      // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
      // Salva a imagem como arquivo web estático leve no servidor para garantir carregamento instantâneo
      // sem delay de rede e sem estouro do limite de localStorage.
      try {
        const uploadRes = await ApiService.uploadThemeImage(compressedDataUrl, file.name);
        if (uploadRes && uploadRes.url) {
          finalUrl = uploadRes.url;
        }
      } catch (uploadErr) {
        console.warn('Upload de imagem estática operando com fallback em memória:', uploadErr);
      }

      if (target === 'bg70') setFormLoginBg70Url(finalUrl);
      else if (target === 'fg70') setFormLoginFg70Url(finalUrl);
      else if (target === 'bg30') setFormLoginBg30Url(finalUrl);
      else if (target === 'fg30') setFormLoginFg30Url(finalUrl);

      showFeedback(
        `Imagem de ${target.startsWith('fg') ? 'Primeiro Plano' : 'Segundo Plano'} para área de ${target.includes('70') ? '70%' : '30%'} aplicada e salva com sucesso!`,
        'success'
      );
    } catch (err: any) {
      console.error('Erro no upload de imagem:', err);
      showFeedback(`Falha ao processar imagem: ${err?.message || 'Erro desconhecido'}`, 'error');
    }
  };

  const openCreateModal = () => {
    setEditingTheme(null);
    setFormName('');
    setFormStartDate('2026-12-01');
    setFormEndDate('2026-12-31');
    setFormDisplayTheme(true); // Exibir tema ativo por padrão
    setFormThemeType('natalino');
    setFormPrimaryColor('gold');
    setFormHarmonyMode('golden');
    // Paleta padrão Dourado Natalino Nobre
    handleApplyBaseColor('#b45309', 'golden');
    setShowAdvancedColors(false);
    setShowLoginSettings(false);

    // Reset de Suporte, Ícones e Bordas
    setFormSupportBg('#451a03');
    setFormSupportText('#fef3c7');
    setFormIconColor('#f59e0b');
    setFormBorderColor('#f59e0b50');
    setFormImageLayers([]);

    // Campos de Login
    setFormLoginBg70Url('/images/natalino-fundo.png');
    setFormLoginFg70Url('');
    setFormLoginBg30Url('/images/natalino-fundo2.png');
    setFormLoginFg30Url('');
    setFormLoginHeroTitle('Controle Total de Produção, Estoque e Finanças em Tempo Real.');
    setFormLoginHeroSubtitle('Plataforma corporativa de missão crítica com fluxo de trabalho Kanban automatizado, módulo de RH inteligente e rastreabilidade ponta a ponta.');
    setFormLoginHeroTitleColor('#FFFFFF');
    setFormLoginHeroSubtitleColor('#DBEAFE');
    setFormLoginFormTitle('Acesso ao ERP');
    setFormLoginFormSubtitle('Informe seu usuário e senha corporativa');
    setFormLoginFormTitleColor('#0F172A');
    setFormLoginFormSubtitleColor('#475569');
    setFormLoginFormLabelColor('#334155');
    setFormLoginFormSecurityTextColor('#047857');
    setFormLoginButtonBg('#2563EB');
    setFormLoginButtonText('Acessar SubliGestão');
    setFormLoginButtonTextColor('#FFFFFF');

    setIsModalOpen(true);
  };

  const openEditModal = (theme: CustomTheme) => {
    setEditingTheme(theme);
    setFormName(theme.name);
    setFormStartDate(theme.startDate || '');
    setFormEndDate(theme.endDate || '');
    setFormDisplayTheme(Boolean(theme.displayTheme));
    setFormThemeType(theme.themeType || 'natalino');
    setFormPrimaryColor(theme.primaryColor || 'gold');

    if (theme.palette) {
      setFormHeaderBg(theme.palette.headerBg || '#92400e');
      setFormSidebarBg(theme.palette.sidebarBg || '#78350f');
      setFormActiveItemBg(theme.palette.activeItemBg || '#f59e0b');
      setFormSidebarFooterBg(theme.palette.sidebarFooterBg || '#451a03');
      setFormHeaderText(theme.palette.headerText || getHighContrastTextColor(theme.palette.headerBg || '#92400e'));
      setFormSidebarText(theme.palette.sidebarText || getHighContrastTextColor(theme.palette.sidebarBg || '#78350f'));
      setFormActiveItemText(theme.palette.activeItemText || getHighContrastTextColor(theme.palette.activeItemBg || '#f59e0b'));
      setFormSidebarFooterText(theme.palette.sidebarFooterText || getHighContrastTextColor(theme.palette.sidebarFooterBg || '#451a03'));
      setFormSupportBg(theme.palette.supportBg || theme.palette.sidebarFooterBg || '#451a03');
      setFormSupportText(theme.palette.supportText || theme.palette.activeItemBg || '#fef3c7');
      setFormIconColor(theme.palette.iconColor || theme.palette.activeItemBg || '#f59e0b');
      setFormBorderColor(theme.palette.borderColor || '#f59e0b50');
      setFormBaseColor(theme.palette.headerBg || '#b45309');
      if (theme.palette.harmonyMode) setFormHarmonyMode(theme.palette.harmonyMode);
    } else {
      const base = theme.primaryColor === 'gold' ? '#b45309' : theme.primaryColor || '#2563eb';
      handleApplyBaseColor(base);
    }

    const ls = theme.loginSettings;
    setFormLoginBg70Url(ls?.bg70Url || theme.bg70Url || '/images/natalino-fundo.png');
    setFormLoginFg70Url(ls?.fg70Url || '');
    setFormLoginBg30Url(ls?.bg30Url || theme.bg30Url || '/images/natalino-fundo2.png');
    setFormLoginFg30Url(ls?.fg30Url || '');
    setFormImageLayers(ls?.imageLayers || []);

    setFormLoginHeroTitle(ls?.loginHeroTitle || 'Controle Total de Produção, Estoque e Finanças em Tempo Real.');
    setFormLoginHeroSubtitle(ls?.loginHeroSubtitle || 'Plataforma corporativa de missão crítica com fluxo de trabalho Kanban automatizado, módulo de RH inteligente e rastreabilidade ponta a ponta.');
    setFormLoginHeroTitleColor(ls?.loginHeroTitleColor || '#FFFFFF');
    setFormLoginHeroSubtitleColor(ls?.loginHeroSubtitleColor || '#DBEAFE');
    setFormLoginFormTitle(ls?.loginFormTitle || 'Acesso ao ERP');
    setFormLoginFormSubtitle(ls?.loginFormSubtitle || 'Informe seu usuário e senha corporativa');
    setFormLoginFormTitleColor(ls?.loginFormTitleColor || '#0F172A');
    setFormLoginFormSubtitleColor(ls?.loginFormSubtitleColor || '#475569');
    setFormLoginFormLabelColor(ls?.loginFormLabelColor || '#334155');
    setFormLoginFormSecurityTextColor(ls?.loginFormSecurityTextColor || '#047857');
    setFormLoginButtonBg(ls?.loginButtonBg || '#2563EB');
    setFormLoginButtonText(ls?.loginButtonText || 'Acessar SubliGestão');
    setFormLoginButtonTextColor(ls?.loginButtonTextColor || '#FFFFFF');

    setShowAdvancedColors(false);
    setShowLoginSettings(false);
    setIsModalOpen(true);
  };

  const handleApplyTheme = async () => {
    setIsApplyingTheme(true);
    try {
      if (selectedDisplayThemeId) {
        const target = themes.find((t) => t.id === selectedDisplayThemeId);
        await applyThemeById(selectedDisplayThemeId, target);
        showFeedback(
          `Tema "${target?.name || 'Selecionado'}" aplicado como padrão automaticamente e sincronizado com o Supabase!`,
          'success'
        );
      } else {
        await applyThemeById(null);
        showFeedback(
          'Nenhum tema com "Exibir tema" marcado. O sistema retornou ao Modelo Padrão com sucesso!',
          'success'
        );
      }
    } catch {
      showFeedback('Falha ao aplicar tema no banco de dados Supabase.', 'error');
    } finally {
      setIsApplyingTheme(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showFeedback('O nome do tema é obrigatório.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const themeId = editingTheme ? editingTheme.id : `tema-${Date.now()}`;
      const payload: CustomTheme = {
        id: themeId,
        name: formName.trim(),
        startDate: formStartDate,
        endDate: formEndDate,
        displayTheme: formDisplayTheme,
        is_active: formDisplayTheme,
        themeType: formThemeType,
        primaryColor: formBaseColor,
        palette: {
          headerBg: formHeaderBg,
          headerText: computedHeaderText,
          sidebarBg: formSidebarBg,
          sidebarText: computedSidebarText,
          activeItemBg: formActiveItemBg,
          activeItemText: computedActiveItemText,
          sidebarFooterBg: formSidebarFooterBg,
          sidebarFooterText: computedFooterText,
          supportBg: formSupportBg,
          supportText: formSupportText,
          iconColor: formIconColor,
          borderColor: formBorderColor,
          harmonyMode: formHarmonyMode,
        },
        bg70Url: formLoginBg70Url,
        bg30Url: formLoginBg30Url,
        loginSettings: {
          bg70Url: formLoginBg70Url,
          fg70Url: formLoginFg70Url,
          bg30Url: formLoginBg30Url,
          fg30Url: formLoginFg30Url,
          imageLayers: formImageLayers,
          loginHeroTitle: formLoginHeroTitle,
          loginHeroSubtitle: formLoginHeroSubtitle,
          loginHeroTitleColor: formLoginHeroTitleColor,
          loginHeroSubtitleColor: formLoginHeroSubtitleColor,
          loginFormTitle: formLoginFormTitle,
          loginFormSubtitle: formLoginFormSubtitle,
          loginFormTitleColor: formLoginFormTitleColor,
          loginFormSubtitleColor: formLoginFormSubtitleColor,
          loginFormLabelColor: formLoginFormLabelColor,
          loginFormSecurityTextColor: formLoginFormSecurityTextColor,
          loginButtonBg: formLoginButtonBg,
          loginButtonText: formLoginButtonText,
          loginButtonTextColor: formLoginButtonTextColor,
        },
        createdAt: editingTheme ? editingTheme.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveTheme(payload);
      if (formDisplayTheme) {
        setSelectedDisplayThemeId(themeId);
        await applyThemeById(themeId, payload);
      }
      setIsModalOpen(false);
      showFeedback(
        editingTheme
          ? `Tema "${payload.name}" atualizado, sincronizado no Supabase e aplicado em tempo real em todos os perfis!`
          : `Tema "${payload.name}" criado, sincronizado no Supabase e aplicado em tempo real em todos os perfis!`,
        'success'
      );
    } catch {
      showFeedback('Falha ao salvar tema no Supabase / PostgreSQL.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!themeToDelete) return;
    const deletedId = themeToDelete.id;
    const deletedName = themeToDelete.name;

    try {
      await deleteTheme(deletedId);

      // Se o tema excluído era o tema atualmente selecionado para exibição ou ativo
      if (selectedDisplayThemeId === deletedId) {
        setSelectedDisplayThemeId(null);
        await applyThemeById(null);
      }

      // Se o tema excluído estava aberto no editor de edição
      if (editingTheme?.id === deletedId) {
        setIsModalOpen(false);
        setEditingTheme(null);
      }

      showFeedback(`Tema "${deletedName}" excluído com sucesso do Supabase e sincronizado no sistema.`, 'success');
      setThemeToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir tema:', err);
      showFeedback('Erro ao excluir tema no banco de dados Supabase.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner Superior & Ações */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Temas Diversos & Personalização Visual
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Supabase Sync
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Defina cores personalizadas para o menu lateral, barra superior, módulos e rodapé com contraste cromático perfeito.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleApplyTheme}
            disabled={isApplyingTheme}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-2 cursor-pointer transition shrink-0 active:scale-95"
            title="Ao marcar a caixa 'exibir tema' e clicar em Aplicar, o tema se torna padrão. Se nenhuma estiver marcada, volta ao modelo Padrão."
          >
            {isApplyingTheme ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            <span>Aplicar</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-2 cursor-pointer transition shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Tema</span>
          </button>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Lista de Temas Cadastrados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Temas Cadastrados ({themes.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Persistido na nuvem e sincronizado em tempo real
          </span>
        </div>

        {themes.length === 0 ? (
          <div className="p-12 text-center">
            <Palette className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Nenhum tema cadastrado</p>
            <p className="text-xs text-slate-400 mt-1">
              Clique no botão "Criar Tema" para cadastrar seu primeiro tema sazonal.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {themes.map((theme) => {
              const active = isThemeActive(theme);
              const isForceActive = theme.displayTheme;
              const p = theme.palette;

              return (
                <div
                  key={theme.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition hover:bg-slate-50/80 ${
                    active ? 'bg-amber-50/40' : ''
                  }`}
                >
                  {/* Informações Principais */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs"
                      style={{
                        backgroundColor: p?.headerBg || '#b45309',
                        color: p?.headerText || '#ffffff',
                        borderColor: p?.activeItemBg || '#f59e0b',
                      }}
                    >
                      <Sparkles className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 tracking-tight truncate">
                          {theme.name}
                        </h4>

                        {/* Status de Ativação */}
                        {(theme.themeType === 'padrao' || theme.id === 'tema-padrao-azul') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
                            <BookmarkPlus className="w-3 h-3 text-blue-600" />
                            Padrão
                          </span>
                        )}

                        {selectedDisplayThemeId === theme.id ? (
                          isForceActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="w-3 h-3" />
                              Tema Padrão Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                              <Sparkles className="w-3 h-3" />
                              Marcado (clique em Aplicar)
                            </span>
                          )
                        ) : isForceActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            Desmarcado (clique em Aplicar)
                          </span>
                        ) : active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-300">
                            <Clock className="w-3 h-3" />
                            Ativo por Calendário
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            Inativo
                          </span>
                        )}

                        {/* Amostras visuais da paleta */}
                        {p && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg border border-slate-200">
                            <span
                              className="w-3 h-3 rounded-full border border-black/20"
                              style={{ backgroundColor: p.headerBg }}
                              title={`Header: ${p.headerBg}`}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-black/20"
                              style={{ backgroundColor: p.sidebarBg }}
                              title={`Sidebar: ${p.sidebarBg}`}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-black/20"
                              style={{ backgroundColor: p.activeItemBg }}
                              title={`Item Ativo: ${p.activeItemBg}`}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-black/20"
                              style={{ backgroundColor: p.sidebarFooterBg }}
                              title={`Rodapé: ${p.sidebarFooterBg}`}
                            />
                          </div>
                        )}
                      </div>

                      {/* Período de Exibição */}
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Período:{' '}
                            {theme.startDate
                              ? new Date(`${theme.startDate}T00:00:00`).toLocaleDateString('pt-BR')
                              : 'Sem início'}{' '}
                            até{' '}
                            {theme.endDate
                              ? new Date(`${theme.endDate}T00:00:00`).toLocaleDateString('pt-BR')
                              : 'Sem fim'}
                          </span>
                        </span>

                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>Paleta Harmônica WCAG</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Controles e Ações */}
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    {/* Botão/Checkbox "Exibir tema" com seleção estável para aplicar */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedDisplayThemeId((prev) => (prev === theme.id ? null : theme.id));
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-extrabold cursor-pointer transition select-none ${
                        selectedDisplayThemeId === theme.id
                          ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs ring-2 ring-amber-400/50'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                      title="Marque a caixa 'exibir tema' e clique em 'Aplicar' para definir este tema como padrão"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDisplayThemeId === theme.id}
                        readOnly
                        tabIndex={-1}
                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 pointer-events-none"
                      />
                      <span>Exibir tema</span>
                    </button>

                    {/* Botão Editar */}
                    <button
                      type="button"
                      onClick={() => openEditModal(theme)}
                      className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer border border-blue-200 shadow-xs"
                      title="Editar tema e paleta de cores"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    {/* Botão Excluir */}
                    <button
                      type="button"
                      onClick={() => setThemeToDelete(theme)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Excluir este tema"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir tema</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TELA CHEIA: EDITOR SPLIT-SCREEN CRIAR / EDITAR TEMA */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="fixed top-16 right-0 bottom-0 left-0 md:left-64 z-20 bg-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-200">
          {/* Barra Superior do Editor Full-Screen */}
          <div className="p-3.5 sm:p-4 bg-white border-b border-slate-200 shadow-xs flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shadow-2xs">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">
                    {editingTheme ? 'Editar Tema & Paleta de Cores' : 'Criar Novo Tema & Paleta de Cores'}
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Editor Tela Cheia
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium hidden sm:block">
                  Dividido em <strong className="text-slate-800">Pré-visualização em Tempo Real (Lado Esquerdo)</strong> e <strong className="text-slate-800">Campos de Edição (Lado Direito)</strong>
                </p>
              </div>
            </div>

            {/* Ações Rápidas de Salvamento no Topo */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Cancelar / Voltar</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  const form = document.getElementById('theme-editor-form') as HTMLFormElement;
                  if (form) form.requestSubmit();
                }}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm transition cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <span>Salvando...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{editingTheme ? 'Salvar Alterações' : 'Criar Tema'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Form Principal Split-Screen */}
          <form id="theme-editor-form" onSubmit={handleSubmit} className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* LADO 1: PRÉ-VISUALIZAÇÃO EM TEMPO REAL (ESQUERDA EM DESKTOP) */}
            <div className="lg:w-1/2 w-full h-full bg-slate-900 border-r border-slate-800 p-4 sm:p-5 lg:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Header do Lado 1 & Seletor de Modo de Visão */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <span>Lado 1: Pré-visualização em Tempo Real</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Proporção Real
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Miniatura proporcional da tela inteira em tempo real
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('both')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                      previewMode === 'both'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ambas
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('fullApp')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer flex items-center gap-1 ${
                      previewMode === 'fullApp'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3 h-3" />
                    <span>ERP Full</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('login')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer flex items-center gap-1 ${
                      previewMode === 'login'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Login</span>
                  </button>
                </div>
              </div>

              {/* MOCKUP 1: MINIATURA PROPORCIONAL DA TELA INTEIRA DO ERP (HEADER + SIDEBAR + MÓDULO) */}
              {(previewMode === 'both' || previewMode === 'fullApp') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Miniatura Proporcional da Tela Inteira do ERP (16:10 Desktop)
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${activeWcag.colorClass}`}>
                      WCAG {activeWcag.level} ({activeContrastRatio}:1)
                    </span>
                  </div>

                  {/* Moldura Desktop em Proporção Fiel 16:10 */}
                  <div className="rounded-2xl overflow-hidden border-2 border-slate-700/90 shadow-2xl bg-slate-950 flex flex-col aspect-[16/10] relative group">
                    {/* 1. Barra Superior em Proporção Fiel (Header) */}
                    <div
                      className="h-[12%] px-3 flex items-center justify-between text-[11px] font-black transition-colors shrink-0 shadow-xs"
                      style={{
                        backgroundColor: formHeaderBg,
                        color: computedHeaderText,
                        borderBottom: `2px solid ${formBorderColor || formActiveItemBg}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-black/15 rounded-md flex items-center justify-center">
                          <Sparkles className="w-3.5 h-3.5" style={{ color: formIconColor || formActiveItemBg }} />
                        </div>
                        <span className="font-extrabold uppercase tracking-wide text-[10px] truncate">
                          ERP SubliGestão — Tecido Sublimado
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[9px] font-bold opacity-90">
                        <span className="px-1.5 py-0.5 rounded bg-black/15 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>Ativo</span>
                        </span>
                        <span className="hidden sm:inline">Marcelo Gomes (Dev)</span>
                      </div>
                    </div>

                    {/* 2. Corpo do Sistema: Sidebar (26% largura) + Módulo Ativo (74% largura) */}
                    <div className="flex-1 flex overflow-hidden bg-slate-100 relative">
                      {/* Sidebar - Menu Lateral Proporcional */}
                      <div
                        className="w-[28%] p-2 flex flex-col justify-between transition-colors shadow-md shrink-0"
                        style={{
                          backgroundColor: formSidebarBg,
                          color: computedSidebarText,
                          borderRight: `2px solid ${formBorderColor || formActiveItemBg}`,
                        }}
                      >
                        <div className="space-y-1.5">
                          <div className="text-[8px] font-black uppercase opacity-65 px-1 tracking-wider">
                            Menu Lateral
                          </div>

                          <div className="px-1.5 py-1 rounded text-[9px] font-bold opacity-80 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" style={{ color: formIconColor || 'currentColor' }} />
                            <span className="truncate">NOTAS FISCAIS</span>
                          </div>

                          {/* 3. Módulo Selecionado (Item Ativo Circulado) */}
                          <div
                            className="px-2 py-1.5 rounded-lg text-[9.5px] font-black flex items-center gap-1 shadow-md transition-all ring-1 ring-black/10"
                            style={{
                              backgroundColor: formActiveItemBg,
                              color: computedActiveItemText,
                              borderColor: formBorderColor,
                            }}
                          >
                            <Check className="w-3 h-3 stroke-[3]" style={{ color: computedActiveItemText }} />
                            <span className="truncate">MÓDULO SELECIONADO</span>
                          </div>

                          <div className="px-1.5 py-1 rounded text-[9px] font-bold opacity-80 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" style={{ color: formIconColor || 'currentColor' }} />
                            <span className="truncate">HISTÓRICO DE OS</span>
                          </div>

                          <div className="px-1.5 py-1 rounded text-[9px] font-bold opacity-80 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" style={{ color: formIconColor || 'currentColor' }} />
                            <span className="truncate">CONTROLE PDV</span>
                          </div>
                        </div>

                        {/* 4. Rodapé do Menu Lateral (Developer / Suporte) */}
                        <div
                          className="p-1 rounded-lg border flex items-center justify-between text-[8px] transition-colors"
                          style={{
                            backgroundColor: formSidebarFooterBg,
                            color: computedFooterText,
                            borderColor: formBorderColor || `${formActiveItemBg}40`,
                          }}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: formIconColor || formActiveItemBg }} />
                            <span className="font-bold truncate">Developer</span>
                          </div>
                          <div
                            className="px-1 py-0.5 rounded text-[7.5px] font-black flex items-center gap-0.5 shrink-0"
                            style={{
                              backgroundColor: formSupportBg || formSidebarFooterBg,
                              color: formSupportText || computedFooterText,
                            }}
                          >
                            <Headphones className="w-2 h-2 text-current" style={{ color: formIconColor || formSupportText }} />
                            <span>Suporte</span>
                          </div>
                        </div>
                      </div>

                      {/* Main Content Workspace - Módulos do ERP Proporcional */}
                      <div className="flex-1 p-2.5 flex flex-col justify-between bg-slate-100 text-slate-800 overflow-hidden">
                        <div className="space-y-2">
                          {/* Card de Título do Módulo Ativo */}
                          <div
                            className="p-2 rounded-xl border shadow-xs flex items-center justify-between transition-colors bg-white"
                            style={{
                              borderColor: `${formActiveItemBg}40`,
                            }}
                          >
                            <div>
                              <span className="text-[9.5px] font-black uppercase text-slate-900 block tracking-tight">
                                Visualização Geral da Tela Inteira
                              </span>
                              <p className="text-[8px] text-slate-500 font-medium">
                                Cores e fontes integradas na proporção real do layout
                              </p>
                            </div>
                            <span
                              className="px-2 py-0.5 rounded text-[8px] font-black uppercase text-white shadow-2xs"
                              style={{ backgroundColor: formActiveItemBg, color: computedActiveItemText }}
                            >
                              Modulo Ativo
                            </span>
                          </div>

                          {/* Grid de Cards Métricas do Módulo */}
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                              <span className="text-[7px] font-bold text-slate-400 block uppercase">Vendas Mês</span>
                              <span className="text-[10px] font-black text-slate-900">R$ 142.500</span>
                            </div>
                            <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                              <span className="text-[7px] font-bold text-slate-400 block uppercase">OS em Produção</span>
                              <span className="text-[10px] font-black text-slate-900">38 Ordens</span>
                            </div>
                            <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                              <span className="text-[7px] font-bold text-slate-400 block uppercase">Notas Emitidas</span>
                              <span className="text-[10px] font-black text-slate-900">124 NF-e</span>
                            </div>
                          </div>
                        </div>

                        {/* Rodapé com Indicador de Contraste AAA */}
                        <div className="p-1 bg-emerald-50 border border-emerald-200 rounded text-[7.5px] font-extrabold text-emerald-900 flex items-center justify-between">
                          <span>✅ Perfeito Contraste de Cores Garantido</span>
                          <span className="font-mono">{activeContrastRatio}:1</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MOCKUP 2: MINIATURA PROPORCIONAL FIEL DA TELA DE LOGIN (ÁREA 70% E ÁREA 30%) */}
              {(previewMode === 'both' || previewMode === 'login') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Miniatura Proporcional Fiel da Tela de Login (70% Hero / 30% Form)
                    </span>
                    <span className="text-emerald-400 text-[10px] font-bold">
                      Auto-Contraste em Tempo Real
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl">
                    <div className="rounded-xl overflow-hidden border border-slate-800 flex flex-col sm:flex-row aspect-[16/9] relative shadow-2xl bg-slate-950">
                      {/* Mockup 70% Principal - Hero Area */}
                      <div className="sm:w-[70%] w-full bg-slate-950 text-white p-3 sm:p-4 flex flex-col justify-between relative overflow-hidden">
                        {/* Segundo Plano 70% Principal */}
                        <img
                          src={resolveImageUrl(formLoginBg70Url, '/Login-fundo.jpg')}
                          alt="Preview Login 70%"
                          className="absolute inset-0 w-full h-full object-cover object-center z-0 pointer-events-none select-none opacity-95"
                        />
                        {/* Segundo Plano 70% Camadas Adicionais */}
                        {formImageLayers.filter(l => l.panel === '70' && !l.isForeground && l.url).map(l => (
                          <img
                            key={l.id}
                            src={resolveImageUrl(l.url, '')}
                            alt="Camada Fundo 70%"
                            className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
                            style={{
                              objectPosition: `${l.posX ?? 50}% ${l.posY ?? 50}%`,
                              transform: `scale(${(l.scale ?? 100) / 100})`,
                              opacity: (l.opacity ?? 100) / 100,
                              objectFit: l.objectFit || 'cover',
                            }}
                          />
                        ))}
                        {/* Dynamic Overlay Filter */}
                        <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-slate-950/45" />

                        {/* Primeiro Plano 70% Principal (z-20 - À Frente dos Textos) */}
                        {formLoginFg70Url && (
                          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                            <img
                              src={resolveImageUrl(formLoginFg70Url, '')}
                              alt="Frente 70%"
                              className="w-full h-full object-contain pointer-events-none select-none"
                            />
                          </div>
                        )}
                        {/* Primeiro Plano 70% Camadas Adicionais */}
                        {formImageLayers.filter(l => l.panel === '70' && l.isForeground && l.url).map(l => (
                          <div key={l.id} className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center overflow-hidden">
                            <img
                              src={resolveImageUrl(l.url, '')}
                              alt="Camada Frente 70%"
                              className="w-full h-full pointer-events-none select-none"
                              style={{
                                objectPosition: `${l.posX ?? 50}% ${l.posY ?? 50}%`,
                                transform: `scale(${(l.scale ?? 100) / 100})`,
                                opacity: (l.opacity ?? 100) / 100,
                                objectFit: l.objectFit || 'contain',
                              }}
                            />
                          </div>
                        ))}

                        {/* Top Branding Badge */}
                        <div className="relative z-10 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-xl shadow-xs">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                            <span className="font-bold text-[8.5px] tracking-wide text-white uppercase">
                              ERP SubliGestão Enterprise v1.0
                            </span>
                          </div>
                        </div>

                        {/* Hero Central Content */}
                        <div className="relative z-10 my-auto max-w-xl">
                          <h1
                            style={{ color: formLoginHeroTitleColor || '#FFFFFF' }}
                            className="text-[11px] sm:text-xs font-black tracking-tight leading-tight mb-1"
                          >
                            {formLoginHeroTitle || 'Controle Total de Produção, Estoque e Finanças em Tempo Real.'}
                          </h1>
                          <p
                            style={{ color: formLoginHeroSubtitleColor || '#DBEAFE' }}
                            className="text-[7.5px] sm:text-[8.5px] font-normal leading-relaxed mb-1.5 opacity-90 line-clamp-2"
                          >
                            {formLoginHeroSubtitle || 'Plataforma corporativa de missão crítica com fluxo de trabalho Kanban automatizado, módulo de RH inteligente e rastreabilidade ponta a ponta.'}
                          </p>

                          {/* Capability Feature Pills */}
                          <div className="grid grid-cols-3 gap-1 border-t border-white/15 pt-1.5">
                            <div className="flex items-start gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-300 mt-0.5 shrink-0" />
                              <div>
                                <h4 className="font-bold text-[7px] text-white leading-none">Fluxo Kanban Têxtil</h4>
                                <p className="text-[6px] text-blue-200 leading-tight">Designer até expedição</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-300 mt-0.5 shrink-0" />
                              <div>
                                <h4 className="font-bold text-[7px] text-white leading-none">Segurança RBAC</h4>
                                <p className="text-[6px] text-blue-200 leading-tight">Controle por cargo</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-300 mt-0.5 shrink-0" />
                              <div>
                                <h4 className="font-bold text-[7px] text-white leading-none">OS & PDV Direct</h4>
                                <p className="text-[6px] text-blue-200 leading-tight">Emissão A4 e caixa</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Footer Info */}
                        <div className="relative z-10 flex items-center justify-between text-[6.5px] text-blue-200 border-t border-white/10 pt-1 gap-1">
                          <span className="truncate">&copy; 2026 ERP SubliGestão Enterprise by Marcelo Gomes.</span>
                          <span className="flex items-center gap-0.5 font-medium shrink-0">
                            <Building2 className="w-2.5 h-2.5" /> Matriz Fortaleza - CE
                          </span>
                        </div>
                      </div>

                      {/* Mockup 30% Formulário */}
                      <div
                        className="sm:w-[30%] w-full bg-white relative p-2.5 flex flex-col justify-between border-l border-slate-200 overflow-hidden shadow-2xl"
                        style={{
                          backgroundImage: `url("${resolveImageUrl(formLoginBg30Url, '/images/login-texture.jpg')}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      >
                        {/* Segundo Plano 30% Camadas Adicionais */}
                        {formImageLayers.filter(l => l.panel === '30' && !l.isForeground && l.url).map(l => (
                          <img
                            key={l.id}
                            src={resolveImageUrl(l.url, '')}
                            alt="Camada Fundo 30%"
                            className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
                            style={{
                              objectPosition: `${l.posX ?? 50}% ${l.posY ?? 50}%`,
                              transform: `scale(${(l.scale ?? 100) / 100})`,
                              opacity: (l.opacity ?? 100) / 100,
                              objectFit: l.objectFit || 'cover',
                            }}
                          />
                        ))}
                        <div className="absolute inset-0 bg-white/80 pointer-events-none z-0" />

                        {/* Primeiro Plano 30% Principal (z-20 - À Frente dos Textos) */}
                        {formLoginFg30Url && (
                          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                            <img
                              src={resolveImageUrl(formLoginFg30Url, '')}
                              alt="Frente 30%"
                              className="w-full h-full object-contain pointer-events-none select-none drop-shadow-md"
                            />
                          </div>
                        )}
                        {/* Primeiro Plano 30% Camadas Adicionais */}
                        {formImageLayers.filter(l => l.panel === '30' && l.isForeground && l.url).map(l => (
                          <div key={l.id} className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center overflow-hidden">
                            <img
                              src={resolveImageUrl(l.url, '')}
                              alt="Camada Frente 30%"
                              className="w-full h-full pointer-events-none select-none drop-shadow-md"
                              style={{
                                objectPosition: `${l.posX ?? 50}% ${l.posY ?? 50}%`,
                                transform: `scale(${(l.scale ?? 100) / 100})`,
                                opacity: (l.opacity ?? 100) / 100,
                                objectFit: l.objectFit || 'contain',
                              }}
                            />
                          </div>
                        ))}

                        {/* Logo & Header Form */}
                        <div className="text-center pt-0.5 mb-1 relative z-30">
                          <div className="relative inline-block p-1 bg-blue-50 border border-blue-100 rounded-lg shadow-2xs mb-0.5 overflow-visible">
                            <SantaHat className="w-4 h-4 absolute -top-1.5 -right-1 rotate-12 drop-shadow-2xs pointer-events-none z-50" />
                            <img
                              src="/images/logo-web.webp"
                              alt="Logo"
                              className="h-5 w-auto object-contain mx-auto"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <h2
                            style={{ color: formLoginFormTitleColor || '#0F172A' }}
                            className="text-[10px] font-black tracking-tight leading-tight block truncate"
                          >
                            {formLoginFormTitle || 'Acesso ao ERP'}
                          </h2>
                          <p
                            style={{ color: formLoginFormSubtitleColor || '#475569' }}
                            className="text-[7px] font-semibold block truncate"
                          >
                            {formLoginFormSubtitle || 'Informe seu usuário e senha corporativa'}
                          </p>
                        </div>

                        {/* Form Inputs */}
                        <div className="space-y-1 relative z-30 my-auto">
                          <div>
                            <label
                              style={{ color: formLoginFormLabelColor || '#334155' }}
                              className="block text-[6.5px] font-bold uppercase tracking-wider mb-0.5"
                            >
                              Usuário / Login
                            </label>
                            <div className="relative flex items-center">
                              <div className="absolute left-1 flex items-center pointer-events-none text-slate-400 z-10">
                                <User className="w-2.5 h-2.5" />
                              </div>
                              <div className="w-full pl-4.5 pr-1 py-0.5 bg-slate-50/90 border border-slate-300 rounded text-[7.5px] font-medium text-slate-500 shadow-2xs truncate flex items-center">
                                Digite seu login...
                              </div>
                            </div>
                          </div>

                          <div>
                            <label
                              style={{ color: formLoginFormLabelColor || '#334155' }}
                              className="block text-[6.5px] font-bold uppercase tracking-wider mb-0.5"
                            >
                              Senha de Acesso
                            </label>
                            <div className="relative flex items-center">
                              <div className="absolute left-1 flex items-center pointer-events-none text-slate-400 z-10">
                                <Lock className="w-2.5 h-2.5" />
                              </div>
                              <div className="w-full pl-4.5 pr-4.5 py-0.5 bg-slate-50/90 border border-slate-300 rounded text-[7.5px] font-medium text-slate-500 shadow-2xs truncate flex items-center">
                                ••••••••••••
                              </div>
                              <div className="absolute right-1 flex items-center text-slate-400 z-10">
                                <Eye className="w-2.5 h-2.5" />
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            style={{
                              backgroundColor: formLoginButtonBg || '#2563EB',
                              color: formLoginButtonTextColor || '#FFFFFF',
                            }}
                            className="w-full py-1 px-2 font-bold text-[8px] rounded-lg shadow-2xs flex items-center justify-center gap-1 transition-all mt-1 cursor-pointer"
                          >
                            <span>{formLoginButtonText || 'Acessar SubliGestão'}</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        {/* Security Badge Footer (relative z-50 so it is NEVER behind any foreground image) */}
                        <div className="pt-0.5 border-t border-slate-300/50 text-center relative z-50 mt-0.5">
                          <p
                            style={{ color: formLoginFormSecurityTextColor || '#047857' }}
                            className="text-[6px] font-bold flex items-center justify-center gap-0.5 truncate"
                          >
                            <ShieldCheck className="w-2.5 h-2.5 shrink-0" style={{ color: formLoginFormSecurityTextColor || '#047857' }} />
                            <span>Sessão encriptada via JWT Refresh Auth</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* LADO 2: CAMPOS DE EDIÇÕES (DIREITA EM DESKTOP) */}
            <div className="lg:w-1/2 w-full h-full bg-slate-50 p-4 sm:p-5 lg:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Header do Lado 2 */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Lado 2: Campos de Edição do Tema
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Altere cores, fontes, imagens, posições e textos do tema
                    </p>
                  </div>
                </div>
              </div>

              {/* Nome do Tema */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome do Tema <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tema Padrão SubliGestão (Azul)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                />
              </div>

              {/* Tipo do Tema (Padrão, Natalino, Customizado) */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipo de Tema
                </label>
                <select
                  value={formThemeType}
                  onChange={(e) => {
                    const newType = e.target.value as 'padrao' | 'natalino' | 'custom';
                    setFormThemeType(newType);
                    if (newType === 'padrao') {
                      setFormName('Tema Padrão SubliGestão (Azul Corporativo)');
                      handleApplyBaseColor('#2563EB', 'monochrome');
                      setFormLoginBg70Url('/Login-fundo.jpg');
                      setFormLoginBg30Url('/images/login-texture.jpg');
                    } else if (newType === 'natalino') {
                      setFormName('Tema Natalino 2026');
                      handleApplyBaseColor('#b45309', 'golden');
                      setFormLoginBg70Url('/images/natalino-fundo.png');
                      setFormLoginBg30Url('/images/natalino-fundo2.png');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                >
                  <option value="padrao">Padrão (Modelo Azul Corporativo Original)</option>
                  <option value="natalino">Natalino / Sazonal (Dourado & Festivo)</option>
                  <option value="custom">Personalizado (Cores e Imagens Customizadas)</option>
                </select>
              </div>

              {/* Datas de Início e Fim */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    Data de Fim
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                  />
                </div>
              </div>

              {/* Checkbox "Exibir tema" com destaque solicitado */}
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 space-y-1">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formDisplayTheme}
                    onChange={(e) => setFormDisplayTheme(e.target.checked)}
                    className="w-5 h-5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
                      Exibir Tema
                    </span>
                    <p className="text-[11px] text-amber-800 font-medium">
                      Essa checkbox <strong>"exibir tema"</strong> é para ser exibido a qualquer momento que for marcada, independentemente do período de datas.
                    </p>
                  </div>
                </label>
              </div>

              {/* ======================================================================= */}
              {/* SEÇÃO DA PALETA DE CORES & CÍRCULO CROMÁTICO (LOCAIS CIRCULADOS) */}
              {/* ======================================================================= */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black uppercase text-slate-900 tracking-wider">
                      Paleta de Cores & Círculo Cromático (Lugares Circulados)
                    </span>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${activeWcag.colorClass}`}>
                    WCAG {activeWcag.level} ({activeContrastRatio}:1)
                  </span>
                </div>

                {/* Modos de Harmonia Cromática do Círculo Cromático */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-800">
                      Modo de Harmonia Cromática (Auto-Contraste Módulo Selecionado):
                    </label>
                    <button
                      type="button"
                      onClick={() => handleApplyBaseColor(formBaseColor)}
                      className="text-[10px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer underline"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Recalcular Auto-Contraste WCAG AAA</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'golden', label: '🌟 Dourado Nobre / Ouro', desc: 'Dourado reluzente de alto contraste' },
                      { id: 'complementary', label: '🎨 Complementar (180°)', desc: 'Cor oposta no círculo cromático' },
                      { id: 'analogous', label: '🌿 Análoga (±35°)', desc: 'Harmonia suave de tons vizinhos' },
                      { id: 'triadic', label: '📐 Triádica (120°)', desc: 'Equilíbrio de 3 pontos cromáticos' },
                      { id: 'monochrome', label: '🌓 Monocromático', desc: 'Contraste extremo por luminosidade' },
                      { id: 'auto', label: '🤖 Auto-Inteligente', desc: 'Ajuste otimizado automático' },
                    ].map((m) => {
                      const isSelected = formHarmonyMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleHarmonyModeChange(m.id as any)}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-400/50 shadow-xs'
                              : 'bg-slate-50 hover:bg-white border-slate-200'
                          }`}
                        >
                          <span className="text-[11px] font-black text-slate-900 block truncate">
                            {m.label}
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium block truncate mt-0.5">
                            {m.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Presets Rápidos */}
                <div>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                    <span className="block text-[11px] font-bold text-slate-700">
                      Sugestões Harmônicas Prontas (Clique para aplicar):
                    </span>
                    <div className="flex items-center gap-2">
                      {deletedPresetIds.length > 0 && (
                        <button
                          type="button"
                          onClick={handleRestorePresets}
                          className="text-[10px] text-amber-700 hover:text-amber-800 underline font-bold cursor-pointer"
                        >
                          Restaurar sugestões de fábrica
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveCurrentPaletteAsPreset}
                        className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-95 shrink-0"
                        title="Salvar a paleta atual de cores em Sugestões Harmônicas Prontas"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Salvar Combinação em Sugestões</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[...savedCustomPresets, ...PRESET_THEME_PALETTES]
                      .filter((preset) => !deletedPresetIds.includes(preset.id))
                      .map((preset) => {
                        const isSelected = formHeaderBg === preset.headerBg && formSidebarBg === preset.sidebarBg;

                        return (
                          <div
                            key={preset.id}
                            className={`group relative p-2 rounded-xl border text-left transition flex flex-col gap-1.5 cursor-pointer select-none ${
                              isSelected
                                ? 'bg-white border-amber-500 shadow-sm ring-2 ring-amber-400'
                                : 'bg-white/70 hover:bg-white border-slate-200 hover:border-slate-300'
                            }`}
                            onClick={() => handleApplyPreset(preset)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                                  style={{ backgroundColor: preset.headerBg }}
                                  title="Header"
                                />
                                <span
                                  className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                                  style={{ backgroundColor: preset.sidebarBg }}
                                  title="Menu Lateral"
                                />
                                <span
                                  className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                                  style={{ backgroundColor: preset.activeItemBg }}
                                  title="Módulo Selecionado"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={(e) => handleDeletePreset(preset.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 transition cursor-pointer"
                                title="Excluir esta opção das sugestões"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-[10px] font-black text-slate-800 line-clamp-1">
                              {preset.name}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Seletor de Cor Base do Círculo Cromático */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      Cor Principal no Círculo Cromático:
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Mude essa cor e o contraste dos módulos e das fontes atualizará automaticamente!
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formBaseColor}
                      onChange={(e) => handleApplyBaseColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                      title="Clique para escolher no círculo cromático"
                    />
                    <input
                      type="text"
                      value={formBaseColor}
                      onChange={(e) => handleApplyBaseColor(e.target.value)}
                      placeholder="#b45309"
                      className="w-24 px-2 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 uppercase text-center"
                    />
                  </div>
                </div>

                {/* =================================================================== */}
                {/* PRÉ-VISUALIZAÇÃO EM TEMPO REAL DOS ELEMENTOS CIRCULADOS */}
                {/* =================================================================== */}
                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-white space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase">
                    <span className="text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Pré-visualização Fiel dos Lugares Circulados
                    </span>
                    <span className="text-emerald-400">
                      Taxa WCAG: {activeContrastRatio}:1 ({activeWcag.level})
                    </span>
                  </div>

                  {/* Mockup da Interface */}
                  <div className="rounded-xl overflow-hidden border border-slate-700/80 shadow-2xl flex flex-col">
                    {/* 1. Barra Superior Mockup */}
                    <div
                      className="h-10 px-3 flex items-center justify-between text-xs font-black shadow-xs transition-colors"
                      style={{
                        backgroundColor: formHeaderBg,
                        color: computedHeaderText,
                        borderBottom: `2px solid ${formBorderColor || formActiveItemBg}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5" style={{ color: formIconColor || formActiveItemBg }} />
                        <span className="uppercase text-[11px] tracking-wide">1. Barra Superior (Header)</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] opacity-90">
                        <span>Chat Direct</span>
                        <span>•</span>
                        <span>Marcelo Gomes (Dev)</span>
                      </div>
                    </div>

                    {/* Corpo com Mockup do Menu Lateral */}
                    <div className="flex h-40 bg-slate-100">
                      {/* 2. Menu Lateral Mockup */}
                      <div
                        className="w-52 p-2.5 flex flex-col justify-between transition-colors shadow-md"
                        style={{
                          backgroundColor: formSidebarBg,
                          color: computedSidebarText,
                          borderRight: `2px solid ${formBorderColor || formActiveItemBg}`,
                        }}
                      >
                        {/* Itens do Menu */}
                        <div className="space-y-1">
                          <div className="text-[10px] font-black uppercase opacity-75 px-2 py-0.5">
                            2. Menu Lateral
                          </div>

                          {/* Item Inativo */}
                          <div
                            className="px-2 py-1 rounded-md text-[11px] font-bold opacity-80 flex items-center gap-1.5"
                            style={{ color: computedSidebarText }}
                          >
                            <span className="w-2 h-2 rounded-full opacity-60 bg-current" style={{ color: formIconColor || 'currentColor' }} />
                            <span>NOTAS FISCAIS</span>
                          </div>

                          {/* 3. Módulo Selecionado (Item Ativo Circulado) */}
                          <div
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 shadow-md transition-all ring-1 ring-black/10"
                            style={{
                              backgroundColor: formActiveItemBg,
                              color: computedActiveItemText,
                              borderColor: formBorderColor,
                            }}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" style={{ color: computedActiveItemText }} />
                            <span className="truncate">3. MÓDULO SELECIONADO</span>
                          </div>

                          {/* Outro Item Inativo */}
                          <div
                            className="px-2 py-1 rounded-md text-[11px] font-bold opacity-80 flex items-center gap-1.5"
                            style={{ color: computedSidebarText }}
                          >
                            <span className="w-2 h-2 rounded-full opacity-60 bg-current" style={{ color: formIconColor || 'currentColor' }} />
                            <span>HISTÓRICO DE OS</span>
                          </div>
                        </div>

                        {/* 4. Rodapé do Menu Lateral Circulado (Developer / Suporte) */}
                        <div
                          className="p-1.5 rounded-xl border flex items-center justify-between text-[10px] transition-colors"
                          style={{
                            backgroundColor: formSidebarFooterBg,
                            color: computedFooterText,
                            borderColor: formBorderColor || `${formActiveItemBg}50`,
                          }}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: formIconColor || formActiveItemBg }} />
                            <div className="truncate leading-tight">
                              <span className="font-bold block">Developer</span>
                              <span className="text-[8px] opacity-80">4. Rodapé Sidebar</span>
                            </div>
                          </div>
                          <div
                            className="px-1.5 py-0.5 rounded text-[9px] font-black flex items-center gap-1 shrink-0 shadow-2xs"
                            style={{
                              backgroundColor: formSupportBg || formSidebarFooterBg,
                              color: formSupportText || computedFooterText,
                              border: `1px solid ${formBorderColor || 'transparent'}`,
                            }}
                          >
                            <Headphones className="w-2.5 h-2.5" style={{ color: formIconColor || formSupportText }} />
                            <span>Suporte</span>
                          </div>
                        </div>
                      </div>

                      {/* Área de Conteúdo Mockup com Exibição das Fontes e Módulos */}
                      <div className="flex-1 p-3 flex flex-col justify-between bg-slate-200/90 text-slate-800">
                        <div className="p-2.5 bg-white rounded-xl border border-slate-300/80 shadow-2xs space-y-1">
                          <span className="text-[10px] font-black uppercase text-amber-700 block">
                            Contraste de Fontes dos Módulos:
                          </span>
                          <p className="text-[11px] font-extrabold text-slate-900 leading-tight">
                            Cor do Módulo Selecionado: <span className="px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: formActiveItemBg, color: computedActiveItemText }}>{formActiveItemBg}</span>
                          </p>
                          <p className="text-[10px] font-medium text-slate-600">
                            Fonte Calculada: <strong style={{ color: computedActiveItemText }}>{computedActiveItemText}</strong> (WCAG AAA)
                          </p>
                        </div>

                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-extrabold text-emerald-900 flex items-center justify-between">
                          <span>✅ Perfeito Contraste de Cores Garantido</span>
                          <span className="font-mono">{activeContrastRatio}:1</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botão de Toggle para Ajuste Fino Individual */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedColors(!showAdvancedColors)}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 cursor-pointer underline"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>
                      {showAdvancedColors
                        ? 'Ocultar ajuste fino individual cada lugar circulado'
                        : 'Personalizar cada lugar circulado individualmente'}
                    </span>
                  </button>
                </div>

                {/* Ajustes Finos Individuais */}
                {showAdvancedColors && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 animate-in fade-in duration-200">
                    {/* 1. Barra Superior - Fundo & Fonte */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-black text-slate-700 uppercase">
                          1. Barra Superior (Header):
                        </label>
                        <span className="text-[9px] font-mono font-bold text-slate-500">
                          Ratio: {headerContrastRatio}:1
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">Fundo:</span>
                        <input
                          type="color"
                          value={formHeaderBg}
                          onChange={(e) => {
                            setFormHeaderBg(e.target.value);
                            updateTitleNameFromColor(e.target.value);
                          }}
                          className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formHeaderBg}
                          onChange={(e) => {
                            setFormHeaderBg(e.target.value);
                            updateTitleNameFromColor(e.target.value);
                          }}
                          className="w-20 px-1.5 py-1 text-xs font-mono font-bold border rounded uppercase"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">Fonte:</span>
                        <input
                          type="color"
                          value={computedHeaderText}
                          onChange={(e) => setFormHeaderText(e.target.value)}
                          className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={computedHeaderText}
                          onChange={(e) => setFormHeaderText(e.target.value)}
                          className="w-20 px-1.5 py-1 text-xs font-mono font-bold border rounded uppercase"
                        />
                      </div>
                    </div>

                    {/* 2. Menu Lateral - Fundo & Fonte */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-black text-slate-700 uppercase">
                          2. Menu Lateral (Sidebar):
                        </label>
                        <span className="text-[9px] font-mono font-bold text-slate-500">
                          Ratio: {sidebarContrastRatio}:1
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">Fundo:</span>
                        <input
                          type="color"
                          value={formSidebarBg}
                          onChange={(e) => {
                            setFormSidebarBg(e.target.value);
                            const moduleCalc = calculateHarmoniousModuleColor(e.target.value, formHarmonyMode);
                            setFormActiveItemBg(moduleCalc.activeItemBg);
                            updateTitleNameFromColor(e.target.value);
                          }}
                          className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formSidebarBg}
                          onChange={(e) => {
                            setFormSidebarBg(e.target.value);
                            const moduleCalc = calculateHarmoniousModuleColor(e.target.value, formHarmonyMode);
                            setFormActiveItemBg(moduleCalc.activeItemBg);
                            updateTitleNameFromColor(e.target.value);
                          }}
                          className="w-20 px-1.5 py-1 text-xs font-mono font-bold border rounded uppercase"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">Fonte:</span>
                        <input
                          type="color"
                          value={computedSidebarText}
                          onChange={(e) => setFormSidebarText(e.target.value)}
                          className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={computedSidebarText}
                          onChange={(e) => setFormSidebarText(e.target.value)}
                          className="w-20 px-1.5 py-1 text-xs font-mono font-bold border rounded uppercase"
                        />
                      </div>
                    </div>

                    {/* 3. Módulo Selecionado - Fundo & Fonte */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-black text-slate-700 uppercase">
                          3. Módulo Selecionado (Item Ativo):
                        </label>
                        <span className="text-[9px] font-mono font-bold text-slate-500">
                          Ratio: {activeContrastRatio}:1
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">Fundo:</span>
                        <input
                          type="color"
                          value={formActiveItemBg}
                          onChange={(e) => {
                            setFormActiveItemBg(e.target.value);
                            updateTitleNameFromColor(e.target.value);
                          }}
                          className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formActiveItemBg}
                          onChange={(e) => {
                            setFormActiveItemBg(e.target.value);
                            updateTitleNameFromColor(e.target.value);
                          }}
                          className="w-20 px-1.5 py-1 text-xs font-mono font-bold border rounded uppercase"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">Fonte:</span>
                        <input
                          type="color"
                          value={computedActiveItemText}
                          onChange={(e) => setFormActiveItemText(e.target.value)}
                          className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={computedActiveItemText}
                          onChange={(e) => setFormActiveItemText(e.target.value)}
                          className="w-20 px-1.5 py-1 text-xs font-mono font-bold border rounded uppercase"
                        />
                      </div>
                    </div>

                    {/* 4. Rodapé da Sidebar - Fundo & Fonte */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
                      <label className="block text-[11px] font-black text-slate-700 uppercase">
                        4. Rodapé (Developer / Rodapé):
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">Fundo:</span>
                        <input
                          type="color"
                          value={formSidebarFooterBg}
                          onChange={(e) => {
                            setFormSidebarFooterBg(e.target.value);
                            updateTitleNameFromColor(e.target.value);
                          }}
                          className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formSidebarFooterBg}
                          onChange={(e) => {
                            setFormSidebarFooterBg(e.target.value);
                            updateTitleNameFromColor(e.target.value);
                          }}
                          className="w-20 px-1.5 py-1 text-xs font-mono font-bold border rounded uppercase"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">Fonte:</span>
                        <input
                          type="color"
                          value={computedFooterText}
                          onChange={(e) => setFormSidebarFooterText(e.target.value)}
                          className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={computedFooterText}
                          onChange={(e) => setFormSidebarFooterText(e.target.value)}
                          className="w-20 px-1.5 py-1 text-xs font-mono font-bold border rounded uppercase"
                        />
                      </div>
                    </div>

                    {/* 5. Suporte - Cor de Fundo & Cor da Fonte */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
                      <label className="block text-[11px] font-black text-slate-700 uppercase">
                        5. Botão / Área de Suporte:
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">Fundo:</span>
                        <input
                          type="color"
                          value={formSupportBg}
                          onChange={(e) => setFormSupportBg(e.target.value)}
                          className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formSupportBg}
                          onChange={(e) => setFormSupportBg(e.target.value)}
                          className="w-20 px-1.5 py-1 text-xs font-mono font-bold border rounded uppercase"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">Fonte:</span>
                        <input
                          type="color"
                          value={formSupportText}
                          onChange={(e) => setFormSupportText(e.target.value)}
                          className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formSupportText}
                          onChange={(e) => setFormSupportText(e.target.value)}
                          className="w-20 px-1.5 py-1 text-xs font-mono font-bold border rounded uppercase"
                        />
                      </div>
                    </div>

                    {/* 6. Cores dos Ícones & Contornos / Bordas */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
                      <label className="block text-[11px] font-black text-slate-700 uppercase">
                        6. Ícones & Contornos:
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">Ícones:</span>
                        <input
                          type="color"
                          value={formIconColor}
                          onChange={(e) => setFormIconColor(e.target.value)}
                          className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formIconColor}
                          onChange={(e) => setFormIconColor(e.target.value)}
                          className="w-20 px-1.5 py-1 text-xs font-mono font-bold border rounded uppercase"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0">Contornos:</span>
                        <input
                          type="color"
                          value={formBorderColor.slice(0, 7)}
                          onChange={(e) => setFormBorderColor(e.target.value)}
                          className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formBorderColor}
                          onChange={(e) => setFormBorderColor(e.target.value)}
                          className="w-20 px-1.5 py-1 text-xs font-mono font-bold border rounded uppercase"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ======================================================================= */}
              {/* SEÇÃO DEDICADA À PÁGINA DE LOGIN (ÁREA 70% E ÁREA 30%) */}
              {/* ======================================================================= */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black uppercase text-slate-900 tracking-wider">
                      Área Destinada à Página de Login (Área 70% e Área 30%)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLoginSettings(!showLoginSettings)}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-black flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>{showLoginSettings ? 'Ocultar Opções de Login' : 'Personalizar Login'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Modifique a imagem de fundo via URL ou Upload para o painel principal (70%) e o painel do formulário (30%), além dos textos e cores com suporte a Círculo Cromático e Auto-Contraste em Tempo Real.
                </p>

                {/* Opções Expansíveis da Tela de Login */}
                {showLoginSettings && (
                  <div className="space-y-4 pt-2 border-t border-slate-200 animate-in fade-in duration-200">
                    
                    {/* 1. IMAGENS DE SEGUNDO PLANO E PRIMEIRO PLANO (70% e 30%) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Painel Esquerdo Hero 70% */}
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <label className="block text-[11px] font-black uppercase text-slate-900">
                            1. Painel Principal (70% - Hero):
                          </label>
                          <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            Esquerdo
                          </span>
                        </div>

                        {/* Segundo Plano 70% */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-700 uppercase">
                            Segundo Plano (Fundo Por Trás):
                          </label>
                          <div className="flex items-center gap-2">
                            <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={formLoginBg70Url}
                              onChange={(e) => setFormLoginBg70Url(e.target.value)}
                              placeholder="/images/natalino-fundo.png ou https://..."
                              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-300 shrink-0">
                              <Upload className="w-3.5 h-3.5 text-blue-600" />
                              <span>Upload Fundo</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileUpload(e, 'bg70')}
                                className="hidden"
                              />
                            </label>

                            {formLoginBg70Url && (
                              <div className="h-7 w-12 rounded border overflow-hidden shrink-0 bg-slate-900">
                                <img
                                  src={formLoginBg70Url}
                                  alt="Preview Fundo 70%"
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Primeiro Plano 70% */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <label className="block text-[10px] font-bold text-slate-700 uppercase">
                            Primeiro Plano (Frente dos Textos):
                          </label>
                          <div className="flex items-center gap-2">
                            <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={formLoginFg70Url}
                              onChange={(e) => setFormLoginFg70Url(e.target.value)}
                              placeholder="URL de imagem transparente (PNG/WebP)..."
                              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-300 shrink-0">
                              <Upload className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Upload Frente</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileUpload(e, 'fg70')}
                                className="hidden"
                              />
                            </label>

                            {formLoginFg70Url && (
                              <div className="h-7 w-12 rounded border overflow-hidden shrink-0 bg-slate-900">
                                <img
                                  src={formLoginFg70Url}
                                  alt="Preview Frente 70%"
                                  className="w-full h-full object-contain"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Painel Direito Formulário 30% */}
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <label className="block text-[11px] font-black uppercase text-slate-900">
                            2. Painel Formulário (30% - Login):
                          </label>
                          <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            Direito
                          </span>
                        </div>

                        {/* Segundo Plano 30% */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-700 uppercase">
                            Segundo Plano (Fundo Por Trás do Form):
                          </label>
                          <div className="flex items-center gap-2">
                            <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={formLoginBg30Url}
                              onChange={(e) => setFormLoginBg30Url(e.target.value)}
                              placeholder="/images/natalino-fundo2.png ou https://..."
                              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-300 shrink-0">
                              <Upload className="w-3.5 h-3.5 text-blue-600" />
                              <span>Upload Fundo</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileUpload(e, 'bg30')}
                                className="hidden"
                              />
                            </label>

                            {formLoginBg30Url && (
                              <div className="h-7 w-12 rounded border overflow-hidden shrink-0 bg-slate-900">
                                <img
                                  src={formLoginBg30Url}
                                  alt="Preview Fundo 30%"
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Primeiro Plano 30% */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <label className="block text-[10px] font-bold text-slate-700 uppercase">
                            Primeiro Plano (À Frente dos Textos e Campos):
                          </label>
                          <div className="flex items-center gap-2">
                            <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={formLoginFg30Url}
                              onChange={(e) => setFormLoginFg30Url(e.target.value)}
                              placeholder="URL de imagem transparente (PNG/WebP)..."
                              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-300 shrink-0">
                              <Upload className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Upload Frente</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileUpload(e, 'fg30')}
                                className="hidden"
                              />
                            </label>

                            {formLoginFg30Url && (
                              <div className="h-7 w-12 rounded border overflow-hidden shrink-0 bg-slate-900">
                                <img
                                  src={formLoginFg30Url}
                                  alt="Preview Frente 30%"
                                  className="w-full h-full object-contain"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CAMADAS DE IMAGENS ADICIONAIS COM BOTÃO "+" E POSICIONAMENTO EM TEMPO REAL */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-black uppercase text-slate-800">
                            Imagens Livres Adicionais ({formImageLayers.length})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddImageLayer}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                          title="Clique para incluir um novo campo para adicionar imagem via URL ou Upload"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Adicionar Imagem / Camada</span>
                        </button>
                      </div>

                      {formImageLayers.length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium text-center py-2">
                          Nenhuma camada adicional criada. Clique no botão <strong>"+"</strong> acima para incluir imagens livremente via URL ou Upload.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {formImageLayers.map((layer, index) => (
                            <div key={layer.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="text-xs font-black text-slate-800">
                                  Camada #{index + 1}
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Select da Área (70% ou 30%) */}
                                  <select
                                    value={layer.panel}
                                    onChange={(e) => handleUpdateLayer(layer.id, { panel: e.target.value })}
                                    className="px-2 py-1 text-[10px] font-black rounded border border-slate-300 bg-white"
                                  >
                                    <option value="70">Área 70% (Hero)</option>
                                    <option value="30">Área 30% (Formulário)</option>
                                  </select>

                                  {/* Checkbox de Primeiro Plano vs Segundo Plano */}
                                  <label className="flex items-center gap-1 text-[10px] font-black text-slate-700 bg-white px-2 py-1 rounded border border-slate-300 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={layer.isForeground}
                                      onChange={(e) => handleUpdateLayer(layer.id, { isForeground: e.target.checked })}
                                      className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 cursor-pointer"
                                    />
                                    <span>{layer.isForeground ? 'Primeiro Plano (Frente)' : 'Segundo Plano (Por Trás)'}</span>
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLayer(layer.id)}
                                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded transition cursor-pointer"
                                    title="Remover esta camada de imagem"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* URL + Upload */}
                              <div className="flex items-center gap-2">
                                <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <input
                                  type="text"
                                  value={layer.url}
                                  onChange={(e) => handleUpdateLayer(layer.id, { url: e.target.value })}
                                  placeholder="Cole a URL https:// ou caminho da imagem..."
                                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <label className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-300 shrink-0">
                                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Upload</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleLayerFileUpload(e, layer.id)}
                                    className="hidden"
                                  />
                                </label>
                              </div>

                              {/* Controles de Posicionamento em Tempo Real */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-600 uppercase">
                                    Posição X ({layer.posX || 50}%):
                                  </label>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={layer.posX ?? 50}
                                    onChange={(e) => handleUpdateLayer(layer.id, { posX: Number(e.target.value) })}
                                    className="w-full accent-blue-600 cursor-pointer"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[9px] font-bold text-slate-600 uppercase">
                                    Posição Y ({layer.posY || 50}%):
                                  </label>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={layer.posY ?? 50}
                                    onChange={(e) => handleUpdateLayer(layer.id, { posY: Number(e.target.value) })}
                                    className="w-full accent-blue-600 cursor-pointer"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[9px] font-bold text-slate-600 uppercase">
                                    Escala ({layer.scale || 100}%):
                                  </label>
                                  <input
                                    type="range"
                                    min="10"
                                    max="200"
                                    value={layer.scale ?? 100}
                                    onChange={(e) => handleUpdateLayer(layer.id, { scale: Number(e.target.value) })}
                                    className="w-full accent-blue-600 cursor-pointer"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[9px] font-bold text-slate-600 uppercase">
                                    Opacidade ({layer.opacity || 100}%):
                                  </label>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={layer.opacity ?? 100}
                                    onChange={(e) => handleUpdateLayer(layer.id, { opacity: Number(e.target.value) })}
                                    className="w-full accent-blue-600 cursor-pointer"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 2. TEXTOS E CONTEÚDOS DO LOGIN */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <Type className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-black uppercase text-slate-800">
                          Textos Personalizados do Login
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                            Título Principal (Hero 70%):
                          </label>
                          <input
                            type="text"
                            value={formLoginHeroTitle}
                            onChange={(e) => setFormLoginHeroTitle(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                            Subtítulo (Hero 70%):
                          </label>
                          <input
                            type="text"
                            value={formLoginHeroSubtitle}
                            onChange={(e) => setFormLoginHeroSubtitle(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                            Título Formulário (30%):
                          </label>
                          <input
                            type="text"
                            value={formLoginFormTitle}
                            onChange={(e) => setFormLoginFormTitle(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                            Subtítulo Formulário (30%):
                          </label>
                          <input
                            type="text"
                            value={formLoginFormSubtitle}
                            onChange={(e) => setFormLoginFormSubtitle(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                            Texto do Botão de Login:
                          </label>
                          <input
                            type="text"
                            value={formLoginButtonText}
                            onChange={(e) => setFormLoginButtonText(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. CORES DETALHADAS E CÍRCULO CROMÁTICO DO FORMULÁRIO 30% */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <Palette className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-black uppercase text-slate-800">
                            Cores Específicas do Formulário (30%)
                          </span>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getWcagLevel(getContrastRatio(formLoginButtonBg, formLoginButtonTextColor)).colorClass}`}>
                          Botão: WCAG {getWcagLevel(getContrastRatio(formLoginButtonBg, formLoginButtonTextColor)).level} ({getContrastRatio(formLoginButtonBg, formLoginButtonTextColor)}:1)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Cor de "Acesso ao ERP" */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                            Acesso ao ERP:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={formLoginFormTitleColor}
                              onChange={(e) => setFormLoginFormTitleColor(e.target.value)}
                              className="w-7 h-7 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={formLoginFormTitleColor}
                              onChange={(e) => setFormLoginFormTitleColor(e.target.value)}
                              className="w-20 px-1.5 py-1 text-xs font-mono border rounded uppercase"
                            />
                          </div>
                        </div>

                        {/* Cor de "Informe seu usuário..." */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                            Informe seu usuário...:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={formLoginFormSubtitleColor}
                              onChange={(e) => setFormLoginFormSubtitleColor(e.target.value)}
                              className="w-7 h-7 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={formLoginFormSubtitleColor}
                              onChange={(e) => setFormLoginFormSubtitleColor(e.target.value)}
                              className="w-20 px-1.5 py-1 text-xs font-mono border rounded uppercase"
                            />
                          </div>
                        </div>

                        {/* Cor de "Usuário / Login" e "Senha de Acesso" */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                            Usuário / Login & Senha:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={formLoginFormLabelColor}
                              onChange={(e) => setFormLoginFormLabelColor(e.target.value)}
                              className="w-7 h-7 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={formLoginFormLabelColor}
                              onChange={(e) => setFormLoginFormLabelColor(e.target.value)}
                              className="w-20 px-1.5 py-1 text-xs font-mono border rounded uppercase"
                            />
                          </div>
                        </div>

                        {/* Cor de "Sessão encriptada via JWT..." */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                            Sessão Encriptada Auth:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={formLoginFormSecurityTextColor}
                              onChange={(e) => setFormLoginFormSecurityTextColor(e.target.value)}
                              className="w-7 h-7 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={formLoginFormSecurityTextColor}
                              onChange={(e) => setFormLoginFormSecurityTextColor(e.target.value)}
                              className="w-20 px-1.5 py-1 text-xs font-mono border rounded uppercase"
                            />
                          </div>
                        </div>

                        {/* Fundo do Botão */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-bold text-slate-700 uppercase">
                              Fundo Botão Login:
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const autoText = getHighContrastTextColor(formLoginButtonBg);
                                setFormLoginButtonTextColor(autoText);
                              }}
                              className="text-[9px] font-black text-amber-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                              title="Calcular automaticamente contraste WCAG AAA para a fonte do botão"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Auto</span>
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={formLoginButtonBg}
                              onChange={(e) => {
                                setFormLoginButtonBg(e.target.value);
                                setFormLoginButtonTextColor(getHighContrastTextColor(e.target.value));
                              }}
                              className="w-7 h-7 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={formLoginButtonBg}
                              onChange={(e) => {
                                setFormLoginButtonBg(e.target.value);
                                setFormLoginButtonTextColor(getHighContrastTextColor(e.target.value));
                              }}
                              className="w-20 px-1.5 py-1 text-xs font-mono border rounded uppercase"
                            />
                          </div>
                        </div>

                        {/* Fonte do Botão */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                            Fonte Botão Login:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={formLoginButtonTextColor}
                              onChange={(e) => setFormLoginButtonTextColor(e.target.value)}
                              className="w-7 h-7 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={formLoginButtonTextColor}
                              onChange={(e) => setFormLoginButtonTextColor(e.target.value)}
                              className="w-20 px-1.5 py-1 text-xs font-mono border rounded uppercase"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* MOCKUP INTERATIVO DA TELA DE LOGIN EM TEMPO REAL */}
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-white space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-amber-400">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          Pré-visualização Fiel da Tela de Login Personalizada
                        </span>
                        <span className="text-emerald-400">
                          Auto-Contraste em Tempo Real
                        </span>
                      </div>

                      <div className="rounded-xl overflow-hidden border border-slate-800 flex flex-col sm:flex-row h-44 relative shadow-2xl">
                        {/* Mockup 70% */}
                        <div className="sm:w-[70%] w-full bg-slate-900 relative p-3 flex flex-col justify-between overflow-hidden">
                          {/* Segundo Plano 70% Principal */}
                          <img
                            src={resolveImageUrl(formLoginBg70Url, '/Login-fundo.jpg')}
                            alt="Preview Login 70%"
                            className="absolute inset-0 w-full h-full object-cover opacity-80"
                          />
                          {/* Segundo Plano 70% Camadas Adicionais */}
                          {formImageLayers.filter(l => l.panel === '70' && !l.isForeground && l.url).map(l => (
                            <img
                              key={l.id}
                              src={resolveImageUrl(l.url, '')}
                              alt="Camada Fundo 70%"
                              className="absolute inset-0 w-full h-full pointer-events-none"
                              style={{
                                objectPosition: `${l.posX ?? 50}% ${l.posY ?? 50}%`,
                                transform: `scale(${(l.scale ?? 100) / 100})`,
                                opacity: (l.opacity ?? 100) / 100,
                                objectFit: l.objectFit || 'cover',
                              }}
                            />
                          ))}
                          <div className="absolute inset-0 bg-slate-950/60 pointer-events-none" />

                          {/* Primeiro Plano 70% Principal (z-20 - À Frente dos Textos) */}
                          {formLoginFg70Url && (
                            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                              <img
                                src={resolveImageUrl(formLoginFg70Url, '')}
                                alt="Frente 70%"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          {/* Primeiro Plano 70% Camadas Adicionais */}
                          {formImageLayers.filter(l => l.panel === '70' && l.isForeground && l.url).map(l => (
                            <div key={l.id} className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center overflow-hidden">
                              <img
                                src={resolveImageUrl(l.url, '')}
                                alt="Camada Frente 70%"
                                className="w-full h-full"
                                style={{
                                  objectPosition: `${l.posX ?? 50}% ${l.posY ?? 50}%`,
                                  transform: `scale(${(l.scale ?? 100) / 100})`,
                                  opacity: (l.opacity ?? 100) / 100,
                                  objectFit: l.objectFit || 'contain',
                                }}
                              />
                            </div>
                          ))}

                          <div className="relative z-10 text-[9px] font-bold uppercase text-white/80 bg-white/10 w-max px-1.5 py-0.5 rounded backdrop-blur-xs">
                            Painel Hero (70%)
                          </div>
                          <div className="relative z-10 my-auto">
                            <h4
                              style={{ color: formLoginHeroTitleColor }}
                              className="text-xs font-black line-clamp-2 leading-tight"
                            >
                              {formLoginHeroTitle}
                            </h4>
                            <p
                              style={{ color: formLoginHeroSubtitleColor }}
                              className="text-[9px] line-clamp-2 mt-1 opacity-90"
                            >
                              {formLoginHeroSubtitle}
                            </p>
                          </div>
                        </div>

                        {/* Mockup 30% */}
                        <div
                          className="sm:w-[30%] w-full bg-white relative p-2.5 flex flex-col justify-between border-l border-slate-200 overflow-hidden"
                          style={{
                            backgroundImage: `url("${resolveImageUrl(formLoginBg30Url, '/images/login-texture.jpg')}")`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        >
                          {/* Segundo Plano 30% Camadas Adicionais */}
                          {formImageLayers.filter(l => l.panel === '30' && !l.isForeground && l.url).map(l => (
                            <img
                              key={l.id}
                              src={resolveImageUrl(l.url, '')}
                              alt="Camada Fundo 30%"
                              className="absolute inset-0 w-full h-full pointer-events-none"
                              style={{
                                objectPosition: `${l.posX ?? 50}% ${l.posY ?? 50}%`,
                                transform: `scale(${(l.scale ?? 100) / 100})`,
                                opacity: (l.opacity ?? 100) / 100,
                                objectFit: l.objectFit || 'cover',
                              }}
                            />
                          ))}
                          <div className="absolute inset-0 bg-white/80 pointer-events-none" />

                          {/* Primeiro Plano 30% Principal (z-20 - À Frente do Título, Subtítulo, Login e Senha) */}
                          {formLoginFg30Url && (
                            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                              <img
                                src={resolveImageUrl(formLoginFg30Url, '')}
                                alt="Frente 30%"
                                className="w-full h-full object-contain drop-shadow-md"
                              />
                            </div>
                          )}
                          {/* Primeiro Plano 30% Camadas Adicionais */}
                          {formImageLayers.filter(l => l.panel === '30' && l.isForeground && l.url).map(l => (
                            <div key={l.id} className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center overflow-hidden">
                              <img
                                src={resolveImageUrl(l.url, '')}
                                alt="Camada Frente 30%"
                                className="w-full h-full drop-shadow-md"
                                style={{
                                  objectPosition: `${l.posX ?? 50}% ${l.posY ?? 50}%`,
                                  transform: `scale(${(l.scale ?? 100) / 100})`,
                                  opacity: (l.opacity ?? 100) / 100,
                                  objectFit: l.objectFit || 'contain',
                                }}
                              />
                            </div>
                          ))}

                          <div className="relative z-10 text-center">
                            <span
                              style={{ color: formLoginFormTitleColor }}
                              className="text-[11px] font-black block truncate"
                            >
                              {formLoginFormTitle}
                            </span>
                            <span
                              style={{ color: formLoginFormSubtitleColor }}
                              className="text-[8px] font-bold block truncate"
                            >
                              {formLoginFormSubtitle}
                            </span>
                          </div>

                          <div className="relative z-10 space-y-1 my-1">
                            <div>
                              <span
                                style={{ color: formLoginFormLabelColor }}
                                className="text-[7px] font-bold block uppercase mb-0.5"
                              >
                                Usuário / Login
                              </span>
                              <div className="relative flex items-center">
                                <div className="absolute left-1 flex items-center pointer-events-none text-slate-400 z-10">
                                  <User className="w-2.5 h-2.5" />
                                </div>
                                <div className="w-full pl-4.5 pr-1 py-0.5 bg-slate-50/90 border border-slate-300 rounded text-[7.5px] font-medium text-slate-500 shadow-2xs truncate flex items-center">
                                  Digite seu login...
                                </div>
                              </div>
                            </div>

                            <div>
                              <span
                                style={{ color: formLoginFormLabelColor }}
                                className="text-[7px] font-bold block uppercase mb-0.5"
                              >
                                Senha de Acesso
                              </span>
                              <div className="relative flex items-center">
                                <div className="absolute left-1 flex items-center pointer-events-none text-slate-400 z-10">
                                  <Lock className="w-2.5 h-2.5" />
                                </div>
                                <div className="w-full pl-4.5 pr-4.5 py-0.5 bg-slate-50/90 border border-slate-300 rounded text-[7.5px] font-medium text-slate-500 shadow-2xs truncate flex items-center">
                                  ••••••••••••
                                </div>
                                <div className="absolute right-1 flex items-center text-slate-400 z-10">
                                  <Eye className="w-2.5 h-2.5" />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="relative z-30">
                            <button
                              type="button"
                              style={{
                                backgroundColor: formLoginButtonBg,
                                color: formLoginButtonTextColor,
                              }}
                              className="w-full py-1 text-[9px] font-black rounded-lg shadow-xs flex items-center justify-center gap-1"
                            >
                              <span>{formLoginButtonText}</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>

                            <p
                              style={{ color: formLoginFormSecurityTextColor }}
                              className="text-[6.5px] font-bold text-center mt-1 truncate relative z-50"
                            >
                              Sessão encriptada JWT
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões do Rodapé do Lado 2 */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-200 hover:bg-slate-300 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 rounded-xl shadow-sm transition cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Salvando...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingTheme ? 'Salvar Alterações do Tema' : 'Criar Tema'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {/* ===================================================================== */}
      {themeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">Excluir Tema?</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Tem certeza que deseja excluir o tema <strong>"{themeToDelete.name}"</strong>? Essa ação é permanente no banco de dados Supabase.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setThemeToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition cursor-pointer"
              >
                Sim, Excluir Tema
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
