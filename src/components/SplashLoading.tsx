import React, { useEffect, useState, useMemo, useRef } from 'react';
import { UserProfile, MOTIVATIONAL_QUOTES } from '../types/frontend';
import { LOGO_URL } from './LoginScreen';
import { Sparkles, ShieldCheck, Cake, PartyPopper } from 'lucide-react';
import { BirthdayCelebrationCanvas } from './BirthdayCelebrationCanvas';
import { checkIsBirthdayToday, getRandomBirthdayQuote } from '../data/birthdayQuotes';
import { ApiService } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { SantaHat } from './common/SantaHat';
import { resolveImageUrl } from '../utils/colorContrast';

// Animação de Neve Caindo
export const SnowAnimationOverlay: React.FC = () => {
  const snowflakes = useMemo(() => Array.from({ length: 32 }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    animationDuration: `${3 + Math.random() * 5}s`,
    animationDelay: `${Math.random() * 3}s`,
    opacity: 0.4 + Math.random() * 0.6,
    size: `${10 + Math.random() * 14}px`,
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {snowflakes.map((s) => (
        <span
          key={s.id}
          className="absolute text-white select-none"
          style={{
            left: s.left,
            top: '-20px',
            fontSize: s.size,
            opacity: s.opacity,
            animation: `snowFall ${s.animationDuration} linear infinite`,
            animationDelay: s.animationDelay,
          }}
        >
          ❄
        </span>
      ))}
      <style>{`
        @keyframes snowFall {
          0% { transform: translateY(-20px) rotate(0deg); }
          100% { transform: translateY(105vh) rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Animação de Pisca-Pisca / Luzes
export const TwinklingLightsOverlay: React.FC = () => {
  const bulbs = useMemo(() => Array.from({ length: 24 }).map((_, i) => ({
    id: i,
    color: ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#ec4899', '#a855f7'][i % 6],
    delay: `${(i % 5) * 0.25}s`,
  })), []);

  return (
    <div className="absolute top-0 inset-x-0 z-20 pointer-events-none flex justify-around p-2 overflow-hidden bg-black/30 backdrop-blur-3xs border-b border-white/10">
      {bulbs.map((b) => (
        <div
          key={b.id}
          className="w-3.5 h-3.5 rounded-full shadow-lg animate-pulse"
          style={{
            backgroundColor: b.color,
            boxShadow: `0 0 12px ${b.color}`,
            animationDelay: b.delay,
            animationDuration: '1.2s',
          }}
        />
      ))}
    </div>
  );
};

// Animação de Estrelas / Partículas
export const SparklesParticlesOverlay: React.FC = () => {
  const particles = useMemo(() => Array.from({ length: 25 }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 3}s`,
    size: `${8 + Math.random() * 12}px`,
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {particles.map((p) => (
        <Sparkles
          key={p.id}
          className="absolute text-amber-300 animate-pulse"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
};

interface SplashLoadingProps {
  user: UserProfile;
  onSplashComplete: () => void;
}

export const SplashLoading: React.FC<SplashLoadingProps> = ({ user, onSplashComplete }) => {
  const { activeTheme, isHolidayThemeActive } = useTheme();
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const splash = activeTheme?.splashSettings;
  const splashBgImage = splash?.bgUrl ? resolveImageUrl(splash.bgUrl, '') : '';
  const splashBgColor = splash?.bgColor || '';
  const greetingColor = splash?.greetingColor || '';
  const messageColor = splash?.messageColor || '';
  const progressColor = splash?.progressColor || '';
  const animationEffect = splash?.animationEffect || (isHolidayThemeActive ? 'snow' : 'none');

  // Check if today is the user's birthday (initial check from profile or dev preview flags or cached employee records)
  const [isBirthday, setIsBirthday] = useState<boolean>(() => {
    if (checkIsBirthdayToday(user.dataNascimento)) return true;
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('subligestao_force_birthday_splash') === 'true') return true;
      if (window.location.search.includes('testBirthday=1')) return true;
      try {
        const cached = localStorage.getItem('subligestao_employees_cache');
        if (cached) {
          const employees = JSON.parse(cached);
          if (Array.isArray(employees)) {
            const userFullName = (user?.name || '').toLowerCase().trim();
            const userFirstName = userFullName.split(' ')[0] || '';
            const userUsername = (user?.username || '').toLowerCase().trim();
            const matchedEmp = employees.find((emp: any) => {
              const empFullName = `${emp.nome} ${emp.sobrenome || ''}`.toLowerCase().trim();
              return (
                empFullName === userFullName ||
                emp.nome?.toLowerCase().trim() === userFirstName ||
                (emp.loginUsuario && emp.loginUsuario.toLowerCase().trim() === userUsername) ||
                (emp.email && user.email && emp.email.toLowerCase() === user.email.toLowerCase()) ||
                emp.id === user.id ||
                `USR-EMP-${emp.id}` === user.id
              );
            });
            if (matchedEmp?.dataNascimento && checkIsBirthdayToday(matchedEmp.dataNascimento)) {
              return true;
            }
          }
        }
      } catch (_) {}
    }
    return false;
  });

  // Asynchronously verify with employee database in case user object lacked dataNascimento
  useEffect(() => {
    let isMounted = true;
    ApiService.getEmployees()
      .then((employees) => {
        if (!isMounted || !Array.isArray(employees)) return;
        try {
          localStorage.setItem('subligestao_employees_cache', JSON.stringify(employees));
        } catch (_) {}
        const userFullName = (user?.name || '').toLowerCase().trim();
        const userFirstName = userFullName.split(' ')[0] || '';
        const userUsername = (user?.username || '').toLowerCase().trim();

        const matchedEmp = employees.find((emp) => {
          const empFullName = `${emp.nome} ${emp.sobrenome || ''}`.toLowerCase().trim();
          return (
            empFullName === userFullName ||
            emp.nome?.toLowerCase().trim() === userFirstName ||
            (emp.loginUsuario && emp.loginUsuario.toLowerCase().trim() === userUsername) ||
            (emp.email && user.email && emp.email.toLowerCase() === user.email.toLowerCase()) ||
            emp.id === user.id ||
            `USR-EMP-${emp.id}` === user.id
          );
        });

        if (matchedEmp?.dataNascimento && checkIsBirthdayToday(matchedEmp.dataNascimento)) {
          setIsBirthday(true);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Duration logic:
  // - If isBirthday: 14000ms (14 seconds) with celebratory music and effects continuous on every login
  // - If not birthday: 3000ms (3 seconds) normal standard splash
  const duration = useMemo(() => (isBirthday ? 14000 : 3000), [isBirthday]);

  // Stable motivational quote
  const [motivationalQuote, setMotivationalQuote] = useState<string>(() => {
    if (isBirthday) {
      return getRandomBirthdayQuote();
    }
    const quotes = MOTIVATIONAL_QUOTES[user.role] || [
      'Bem-vindo ao ERP SubliGestão. Tenha um excelente e produtivo dia!',
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  });

  useEffect(() => {
    if (isBirthday) {
      setMotivationalQuote(getRandomBirthdayQuote());
    }
  }, [isBirthday]);

  // Handle Birthday Music Playback
  const BASE_VOLUME = 0.7;

  useEffect(() => {
    if (!isBirthday) {
      return;
    }

    const audio = new Audio('/audio/aniversario.mp3');
    audio.preload = 'auto';
    audio.volume = BASE_VOLUME;
    audioRef.current = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[SplashLoading] Autoplay aguardando interação do usuário:', err);
        const handleFirstInteraction = () => {
          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
          window.removeEventListener('click', handleFirstInteraction);
          window.removeEventListener('keydown', handleFirstInteraction);
        };
        window.addEventListener('click', handleFirstInteraction);
        window.addEventListener('keydown', handleFirstInteraction);
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [isBirthday]);

  // Progress & Volume Fade-out Loop
  useEffect(() => {
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min(100, (elapsed / duration) * 100);

      setProgress(currentProgress);

      if (isBirthday && audioRef.current) {
        if (elapsed >= 10000 && elapsed <= 14000) {
          const fadeProgress = (elapsed - 10000) / 4000;
          const targetVolume = Math.max(0, Math.min(BASE_VOLUME, BASE_VOLUME * (1 - fadeProgress)));
          audioRef.current.volume = targetVolume;
        } else if (elapsed > 14000) {
          audioRef.current.volume = 0;
        }
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        onSplashComplete();
      }
    }, 40);

    return () => clearInterval(interval);
  }, [duration, isBirthday, onSplashComplete]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col items-center justify-center p-6 selection:bg-blue-600 overflow-y-auto overflow-x-hidden transition-all duration-300"
      style={{
        background: splashBgColor || undefined,
      }}
      onClick={() => {
        if (isBirthday && audioRef.current && audioRef.current.paused) {
          audioRef.current.play().catch(() => {});
        }
      }}
    >
      {/* Background Image da Transição */}
      {splashBgImage && (
        <img
          src={splashBgImage}
          alt="Fundo Transição"
          className="absolute inset-0 w-full h-full object-cover object-center z-0 pointer-events-none select-none opacity-90 transition-opacity duration-300"
        />
      )}

      {/* Animações e Efeitos Especiais de Transição */}
      {animationEffect === 'snow' && <SnowAnimationOverlay />}
      {animationEffect === 'lights' && <TwinklingLightsOverlay />}
      {(animationEffect === 'sparkles' || animationEffect === 'twinkle') && <SparklesParticlesOverlay />}

      {/* Background Atmosphere */}
      {isBirthday ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-slate-900 to-purple-950/60 z-0" />
          <div className="absolute w-[600px] h-[600px] bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
          <BirthdayCelebrationCanvas />
        </>
      ) : !splashBgImage && !splashBgColor ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-slate-900 to-indigo-950/60 z-0" />
          <div className="absolute w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        </>
      ) : null}

      {/* Desktop scaling wrapper for center content */}
      <div className="relative z-20 w-full flex flex-col items-center justify-center my-auto md:scale-[1.20] origin-center transition-transform duration-200">
        <div className="max-w-xl w-full text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
          {/* Company Logo Header */}
          <div className={`relative p-4 backdrop-blur-md rounded-2xl border mb-6 shadow-2xl transition-all overflow-visible ${
            isBirthday
              ? 'bg-amber-500/10 border-amber-400/30 shadow-amber-500/10 ring-1 ring-amber-400/20'
              : isHolidayThemeActive
              ? 'bg-amber-500/15 border-amber-400/40 shadow-amber-500/20 ring-1 ring-amber-400/30'
              : 'bg-white/10 border-white/15'
          }`}>
            {isHolidayThemeActive && (
              <SantaHat className="w-9 h-9 absolute -top-3.5 -right-3 rotate-12 drop-shadow pointer-events-none z-50" />
            )}
            <img
              src={LOGO_URL}
              alt="Logo SubliGestão"
              className="h-16 w-auto object-contain mx-auto"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          {/* Welcome / Celebration Tag */}
          {isBirthday ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-amber-500/30 via-rose-500/30 to-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-black rounded-full uppercase tracking-wider mb-4 shadow-lg shadow-amber-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
              <PartyPopper className="w-4 h-4 text-amber-300 animate-bounce" />
              <span>🎉 FELIZ ANIVERSÁRIO! • HOMENAGEM DA EQUIPE</span>
              <Cake className="w-4 h-4 text-rose-300" />
            </div>
          ) : isHolidayThemeActive ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-500/25 border border-amber-400/50 text-amber-200 text-xs font-black rounded-full uppercase tracking-wider mb-4 shadow-lg shadow-amber-500/20">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>🎄 BOAS FESTAS • ERP SUBLIGESTÃO DOURADO</span>
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600/30 border border-blue-400/30 text-blue-200 text-xs font-bold rounded-full uppercase tracking-wider mb-4">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Acesso Autorizado • ERP SubliGestão</span>
            </div>
          )}

          {/* User Greeting Title */}
          <h1
            className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2"
            style={{ color: greetingColor || undefined }}
          >
            {isBirthday ? (
              <span className="bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent">
                Parabéns pelo seu dia, {user.name}! 🎂
              </span>
            ) : (
              `Seja bem-vindo, ${user.name}!`
            )}
          </h1>

          {/* Role & Sector Badges */}
          {(() => {
            const isDev = Boolean(
              user.isDeveloper ||
              user.role === 'Developer' ||
              (user.role as string) === 'Desenvolvedor' ||
              user.username?.toLowerCase().includes('marcelo-dev') ||
              user.name?.toLowerCase().includes('marcelo')
            );
            const displayRole = isDev ? 'Desenvolvedor' : user.role === 'Developer' ? 'Desenvolvedor' : user.role;
            const displaySector = isDev ? 'Suporte' : user.sector;

            return (
              <div className="flex flex-wrap items-center justify-center gap-2 mb-6 text-xs font-semibold">
                {isBirthday && (
                  <span className="bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-black px-3 py-1 rounded-lg shadow-md flex items-center gap-1.5">
                    <Cake className="w-3.5 h-3.5 text-slate-950" />
                    Dia de Comemoração
                  </span>
                )}
                <span className={`${isBirthday ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'} px-3 py-1 rounded-lg shadow-sm font-bold`}>
                  Cargo: {displayRole}
                </span>
                <span className="bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1 rounded-lg font-medium">
                  Setor: {displaySector}
                </span>
                <span className="bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1 rounded-lg font-medium">
                  {user.branch}
                </span>
              </div>
            );
          })()}

          {/* Motivational Card */}
          <div className={`w-full p-6 rounded-2xl shadow-xl backdrop-blur-md mb-8 transition-all ${
            isBirthday
              ? 'bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-amber-500/40 shadow-amber-500/10 ring-1 ring-amber-500/20'
              : 'bg-slate-800/80 border border-slate-700/80'
          }`}>
            <div className="flex items-center justify-center gap-2 mb-2 text-amber-400/90">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-bold">
                {isBirthday ? 'Você é muito especial' : 'Mensagem do Dia'}
              </span>
              <Sparkles className="w-4 h-4" />
            </div>
            <p
              className="text-sm sm:text-base text-slate-100 italic font-medium leading-relaxed"
              style={{ color: messageColor || undefined }}
            >
              "{motivationalQuote}"
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-md">
            <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-2">
              <span>
                {isBirthday
                  ? 'EM INSTANTES VOCÊ ACESSARÁ O SISTEMA...'
                  : 'Carregando ambiente de trabalho...'}
              </span>
              <span
                className={`${isBirthday || isHolidayThemeActive ? 'text-amber-400' : 'text-blue-400'} font-mono font-bold text-sm`}
                style={{ color: progressColor || undefined }}
              >
                {Math.round(progress)}%
              </span>
            </div>

            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  isBirthday
                    ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500'
                    : isHolidayThemeActive
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 shadow-lg shadow-amber-500/50'
                    : 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500'
                }`}
                style={{
                  width: `${progress}%`,
                  backgroundColor: progressColor || undefined,
                  backgroundImage: progressColor ? 'none' : undefined,
                }}
              />
            </div>
          </div>

          {/* Footer Subtitle */}
          <div className="mt-8 flex items-center gap-2 text-xs">
            {isBirthday ? (
              <div className="flex items-center gap-2 text-amber-300/90 font-medium">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Desejamos muita saúde, felicidade e realizações neste novo ciclo de vida!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Controle de Acesso RBAC Ativo • Sessão Criptografada</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

