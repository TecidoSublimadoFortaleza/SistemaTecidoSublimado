import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight, Building2, Sparkles, CheckCircle2, Download, Smartphone } from 'lucide-react';
import { ApiService } from '../services/api';
import { MobilePWAPromptBanner, PWAInstallModal } from './common/PWAInstallModal';
import { usePWAInstall } from '../utils/usePWAInstall';
import { useTheme } from '../context/ThemeContext';
import { SantaHat } from './common/SantaHat';
import { resolveImageUrl } from '../utils/colorContrast';

interface LoginScreenProps {
  onLoginSuccess: (userData: any) => void;
  // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
  // Notificação visual de logout de emergência ativado por "Ctrl + Alt + X"
  emergencyLogoutNotice?: boolean;
  onDismissEmergencyNotice?: () => void;
}

export const LOGO_URL = '/images/logo-web.webp';

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  emergencyLogoutNotice = false,
  onDismissEmergencyNotice,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const { isInstalled, isMobile, hasPrompt, promptInstall } = usePWAInstall();
  const { isHolidayThemeActive, activeTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage('Por favor, informe seu usuário e senha.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await ApiService.login(username.trim(), password);
      onLoginSuccess(response);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao autenticar no sistema. Verifique suas credenciais.');
      setIsLoading(false);
    }
  };

  // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
  // Carregamento instantâneo do tema ativo no primeiro frame (Zero-Delay Paint)
  // Se useTheme ainda não concluiu a propagação de estado, lê diretamente do cache ativo de alta velocidade
  const currentTheme = activeTheme || (() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('subligestao_active_theme');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id) return parsed;
        }
      } catch (_) {}
    }
    return null;
  })();

  const ls = currentTheme?.loginSettings;
  const isNatalinoTheme = currentTheme?.themeType === 'natalino' || currentTheme?.primaryColor === 'gold';
  const defaultBg70 = isNatalinoTheme ? '/images/natalino-fundo.png' : '/Login-fundo.jpg';
  const defaultBg30 = isNatalinoTheme ? '/images/natalino-fundo2.png' : '/images/login-texture.jpg';

  const rawBg70 = ls?.bg70Url || currentTheme?.bg70Url || defaultBg70;
  const rawFg70 = ls?.fg70Url || '';
  const rawBg30 = ls?.bg30Url || currentTheme?.bg30Url || defaultBg30;
  const rawFg30 = ls?.fg30Url || '';

  const bg70 = resolveImageUrl(rawBg70, defaultBg70);
  const fg70 = rawFg70 ? resolveImageUrl(rawFg70, '') : '';
  const bg30 = resolveImageUrl(rawBg30, defaultBg30);
  const fg30 = rawFg30 ? resolveImageUrl(rawFg30, '') : '';

  const imageLayers = ls?.imageLayers || [];

  // Pré-decodificação síncrona/instantânea em memória de todos os assets gráficos do tema ativo
  React.useEffect(() => {
    const urlsToPreload = [
      bg70,
      bg30,
      fg70,
      fg30,
      LOGO_URL,
      ...imageLayers.map((l) => resolveImageUrl(l.url, '')).filter(Boolean),
    ].filter((u) => u && typeof u === 'string' && u.trim() !== '');

    urlsToPreload.forEach((url) => {
      const img = new Image();
      img.src = url;
      if ('decode' in img) {
        img.decode().catch(() => {});
      }
    });
  }, [bg70, bg30, fg70, fg30, imageLayers]);

  const heroTitle = ls?.loginHeroTitle || 'Controle Total de Produção, Estoque e Finanças em Tempo Real.';
  const heroSubtitle = ls?.loginHeroSubtitle || 'Plataforma corporativa de missão crítica com fluxo de trabalho Kanban automatizado, módulo de RH inteligente e rastreabilidade ponta a ponta.';
  const heroTitleColor = ls?.loginHeroTitleColor || '#FFFFFF';
  const heroSubtitleColor = ls?.loginHeroSubtitleColor || '#DBEAFE';

  const formTitle = ls?.loginFormTitle || 'Acesso ao ERP';
  const formSubtitle = ls?.loginFormSubtitle || 'Informe seu usuário e senha corporativa';
  const formTitleColor = ls?.loginFormTitleColor || '#0F172A';
  const formSubtitleColor = ls?.loginFormSubtitleColor || '#475569';
  const formLabelColor = ls?.loginFormLabelColor || '#334155';
  const formSecurityTextColor = ls?.loginFormSecurityTextColor || '#047857';

  const btnBg = ls?.loginButtonBg;
  const btnText = ls?.loginButtonText || 'Acessar SubliGestão';
  const btnTextColor = ls?.loginButtonTextColor || '#FFFFFF';

  return (
    <div className={`min-h-screen w-full flex flex-col lg:flex-row bg-slate-950 font-sans selection:bg-blue-600 selection:text-white ${isHolidayThemeActive ? 'theme-holiday-gold' : ''}`}>
      {/* Hidden eager DOM preloader for instant zero-delay theme asset rendering across all selected themes */}
      <div className="hidden" aria-hidden="true">
        {bg70 && <img src={bg70} alt="" loading="eager" fetchPriority="high" />}
        {bg30 && <img src={bg30} alt="" loading="eager" fetchPriority="high" />}
        {fg70 && <img src={fg70} alt="" loading="eager" fetchPriority="high" />}
        {fg30 && <img src={fg30} alt="" loading="eager" fetchPriority="high" />}
        <img src={LOGO_URL} alt="" loading="eager" fetchPriority="high" />
        {imageLayers.map((l) => (
          l.url ? <img key={l.id} src={resolveImageUrl(l.url, '')} alt="" loading="eager" fetchPriority="high" /> : null
        ))}
      </div>

      {/* LEFT SECTION - 70% Ambient Branding & Enterprise Visual Identity (Desktop Only - Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-[70%] bg-slate-950 text-white p-8 lg:p-16 flex-col justify-between relative overflow-hidden min-h-screen">
        {/* Background Image Principal (Segundo Plano 70%) */}
        <img
          src={bg70}
          alt="Ambiente Tecido Sublimado Fortaleza"
          className="absolute inset-0 w-full h-full object-cover object-center z-0 pointer-events-none select-none opacity-95 transition-all duration-300"
          loading="eager"
          fetchPriority="high"
        />

        {/* Camadas de Imagem Adicionais de Segundo Plano 70% */}
        {imageLayers.filter(l => l.panel === '70' && !l.isForeground && l.url).map(l => (
          <img
            key={l.id}
            src={resolveImageUrl(l.url, '')}
            alt="Camada Fundo Hero 70%"
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

        {/* Foreground Image Principal (Primeiro Plano 70% - z-20) */}
        {fg70 && (
          <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden flex items-center justify-center">
            <img
              src={fg70}
              alt="Primeiro Plano Hero"
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          </div>
        )}

        {/* Camadas de Imagem Adicionais de Primeiro Plano 70% (z-20) */}
        {imageLayers.filter(l => l.panel === '70' && l.isForeground && l.url).map(l => (
          <div key={l.id} className="absolute inset-0 z-20 pointer-events-none overflow-hidden flex items-center justify-center">
            <img
              src={resolveImageUrl(l.url, '')}
              alt="Camada Frente Hero 70%"
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

        {/* Top Branding */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-2xl shadow-sm">
            <ShieldCheck className={`w-6 h-6 ${isHolidayThemeActive ? 'text-amber-300' : 'text-blue-200'}`} />
            <span className="font-bold text-sm tracking-wide text-white uppercase">
              ERP SubliGestão Enterprise v1.0
            </span>
          </div>
        </div>

        {/* Hero Central Content */}
        <div className="relative z-10 my-auto py-12 max-w-3xl">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1
              style={{ color: heroTitleColor }}
              className="text-4xl lg:text-6xl font-black tracking-tight leading-tight mb-6"
            >
              {heroTitle}
            </h1>

            <p
              style={{ color: heroSubtitleColor }}
              className="text-lg lg:text-xl font-normal leading-relaxed mb-10 max-w-2xl"
            >
              {heroSubtitle}
            </p>

            {/* Capability Feature Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/15 pt-8">
              <div className="flex items-start gap-3">
                <CheckCircle2 className={`w-5 h-5 ${isHolidayThemeActive ? 'text-amber-300' : 'text-emerald-300'} mt-0.5 shrink-0`} />
                <div>
                  <h4 className="font-bold text-sm text-white">Fluxo Kanban Têxtil</h4>
                  <p className="text-xs text-blue-200">Designer até expedição</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className={`w-5 h-5 ${isHolidayThemeActive ? 'text-amber-300' : 'text-emerald-300'} mt-0.5 shrink-0`} />
                <div>
                  <h4 className="font-bold text-sm text-white">Segurança RBAC</h4>
                  <p className="text-xs text-blue-200">Controle por cargo e setor</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className={`w-5 h-5 ${isHolidayThemeActive ? 'text-amber-300' : 'text-emerald-300'} mt-0.5 shrink-0`} />
                <div>
                  <h4 className="font-bold text-sm text-white">Ordem de Serviço & PDV</h4>
                  <p className="text-xs text-blue-200">Emissão A4 e caixa direto</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between text-xs text-blue-200 border-t border-white/10 pt-6 gap-2">
          <span>&copy; 2026 ERP SubliGestão Enterprise by Marcelo Gomes. Todos os direitos reservados.</span>
          <span className="flex items-center gap-1 font-medium">
            <Building2 className="w-4 h-4" /> Matriz Fortaleza - CE
          </span>
        </div>
      </div>

      {/* RIGHT SECTION - 30% Sleek Enterprise Login Panel */}
      <div 
        className="w-full lg:w-[30%] min-h-screen lg:min-h-0 p-8 lg:p-12 flex flex-col justify-between shadow-2xl z-20 border-l border-slate-200 relative overflow-hidden"
        style={{
          backgroundImage: `url("${bg30}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Hidden eager preloader for instant zero-delay background rendering */}
        <img src={bg30} alt="" className="hidden" loading="eager" fetchPriority="high" />
        <img src={LOGO_URL} alt="" className="hidden" loading="eager" fetchPriority="high" />
        {/* Segundo Plano 30% Camadas Adicionais */}
        {imageLayers.filter(l => l.panel === '30' && !l.isForeground && l.url).map(l => (
          <img
            key={l.id}
            src={resolveImageUrl(l.url, '')}
            alt="Camada Fundo Login 30%"
            className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
            style={{
              objectPosition: `${l.posX ?? 50}% ${l.posY ?? 50}%`,
              transform: `scale(${(l.scale ?? 100) / 100})`,
              opacity: (l.opacity ?? 100) / 100,
              objectFit: l.objectFit || 'cover',
            }}
          />
        ))}

        {/* Soft background filter */}
        <div className={`absolute inset-0 z-0 pointer-events-none ${isHolidayThemeActive ? 'bg-white/45' : 'bg-white/80'}`} />

        {/* Foreground Overlay Image Principal (Primeiro Plano 30% - z-20) */}
        {fg30 && (
          <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden flex items-center justify-center">
            <img
              src={fg30}
              alt="Primeiro Plano Login 30%"
              className="w-full h-full object-contain pointer-events-none select-none drop-shadow-xl"
            />
          </div>
        )}

        {/* Camadas de Imagem Adicionais de Primeiro Plano 30% (z-20) */}
        {imageLayers.filter(l => l.panel === '30' && l.isForeground && l.url).map(l => (
          <div key={l.id} className="absolute inset-0 z-20 pointer-events-none overflow-hidden flex items-center justify-center">
            <img
              src={resolveImageUrl(l.url, '')}
              alt="Camada Frente Login 30%"
              className="w-full h-full pointer-events-none select-none drop-shadow-xl"
              style={{
                objectPosition: `${l.posX ?? 50}% ${l.posY ?? 50}%`,
                transform: `scale(${(l.scale ?? 100) / 100})`,
                opacity: (l.opacity ?? 100) / 100,
                objectFit: l.objectFit || 'contain',
              }}
            />
          </div>
        ))}

        <div className="relative z-30 flex flex-col h-full justify-between">
          <div>
          {/* Logo Branding Header */}
          <div className="text-center pt-4 mb-8">
            <div className={`relative inline-block p-3.5 rounded-2xl border shadow-md mb-4 overflow-visible ${
              isHolidayThemeActive ? 'bg-white/95 border-amber-200/80 shadow-amber-500/10' : 'bg-blue-50 border-blue-100 shadow-sm'
            }`}>
              {isHolidayThemeActive && (
                <SantaHat className="w-9 h-9 absolute -top-3.5 -right-3 rotate-12 drop-shadow-md pointer-events-none z-50" />
              )}
              <img
                src={LOGO_URL}
                alt="Logo Tecido Sublimado"
                className="h-16 w-auto object-contain mx-auto"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <h2
              style={{ color: formTitleColor }}
              className="text-2xl font-black tracking-tight flex items-center justify-center gap-2"
            >
              {isHolidayThemeActive && <span className="text-xl">🎄</span>}
              <span>{formTitle}</span>
            </h2>
            <p
              style={{ color: formSubtitleColor }}
              className="text-xs font-semibold mt-1"
            >
              {formSubtitle}
            </p>
          </div>

          {/* CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: Notificação de Logout de Emergência */}
          {emergencyLogoutNotice && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-bold flex items-center justify-between shadow-sm mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Sessão encerrada com emergência (Ctrl + Alt + X).</span>
              </div>
              {onDismissEmergencyNotice && (
                <button
                  type="button"
                  onClick={onDismissEmergencyNotice}
                  className="p-1 hover:bg-amber-100 rounded-lg text-amber-700 cursor-pointer"
                  title="Fechar notificação"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {errorMessage && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium leading-relaxed flex items-start gap-2 shadow-sm">
                <span className="font-bold shrink-0">Erro:</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Username Input */}
            <div>
              <label
                style={{ color: formLabelColor }}
                className="block text-xs font-bold uppercase tracking-wider mb-2"
              >
                Usuário / Login
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400 z-10">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Digite aqui seu login..."
                  autoComplete="username"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50/90 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white focus:border-blue-600 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                style={{ color: formLabelColor }}
                className="block text-xs font-bold uppercase tracking-wider mb-2"
              >
                Senha de Acesso
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400 z-10">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full pl-11 pr-11 py-3 bg-slate-50/90 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white focus:border-blue-600 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer z-10"
                  tabIndex={-1}
                  title={showPassword ? "Ocultar senha" : "Exibir senha"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={
                btnBg
                  ? { backgroundColor: btnBg, color: btnTextColor }
                  : undefined
              }
              className={`relative w-full py-3.5 px-6 font-bold text-sm rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer overflow-visible ${
                !btnBg
                  ? isHolidayThemeActive
                    ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-600/30 btn-holiday-shimmer'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-600/30 hover:shadow-blue-600/40'
                  : ''
              }`}
            >
              {isHolidayThemeActive && (
                <SantaHat className="w-8 h-8 absolute -top-3 -right-2 rotate-12 drop-shadow-md pointer-events-none z-50" />
              )}
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>{btnText}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            {/* Mobile-Only Install Button (Never shown on desktop) */}
            {!isInstalled && isMobile && (
              <button
                type="button"
                onClick={() => {
                  if (hasPrompt) {
                    promptInstall();
                  } else {
                    setShowInstallModal(true);
                  }
                }}
                className="md:hidden w-full mt-3 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-slate-200 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>Instalar Aplicativo no Celular</span>
              </button>
            )}
          </form>
        </div>

        {/* Security badge at bottom (z-50 so it remains clearly visible above all image layers) */}
        <div className="mt-8 pt-6 border-t border-slate-300/50 text-center relative z-50 pointer-events-auto">
          <p
            style={{ color: formSecurityTextColor }}
            className="text-[11px] font-bold flex items-center justify-center gap-1"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: formSecurityTextColor }} />
            <span>Sessão encriptada via JWT Refresh Auth</span>
          </p>
        </div>
        </div>
      </div>

      {/* Mobile-Only Automatic Prompt Banner (Session-persistent, never on desktop) */}
      <MobilePWAPromptBanner />

      {/* Fallback Install Modal for Mobile */}
      <PWAInstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </div>
  );
};
