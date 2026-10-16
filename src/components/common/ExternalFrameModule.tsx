import React, { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, ShieldAlert, Sparkles, Globe, Lock, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface ExternalFrameModuleProps {
  title: string;
  url: string;
  badge?: string;
  badgeColor?: string;
  accentColor?: string;
  description?: string;
}

export const ExternalFrameModule: React.FC<ExternalFrameModuleProps> = ({
  title,
  url,
  badge = 'Integração Web',
  badgeColor = 'bg-blue-100 text-blue-800 border-blue-200',
  accentColor = 'from-blue-600 to-indigo-700',
  description = 'Acesso em tela cheia mantendo navegação e recursos do sistema.',
}) => {
  const [iframeKey, setIframeKey] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4500);
    return () => clearTimeout(timer);
  }, [iframeKey, url]);

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenNewTab = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full flex flex-col h-[calc(100dvh-4rem)] sm:h-[calc(100vh-80px)] min-h-0 sm:min-h-[600px] bg-white sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-sm overflow-hidden relative">
      {/* BOTÃO FLUTUANTE DISCRETO: APENAS ÍCONE DE ABRIR EM NOVA ABA */}
      <button
        type="button"
        onClick={handleOpenNewTab}
        className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 p-2 sm:p-2.5 bg-white/95 hover:bg-white text-blue-600 hover:text-blue-700 rounded-xl shadow-md border border-slate-200/80 backdrop-blur-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
        title="Abrir em Nova Aba"
      >
        <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
      </button>

      {/* IFRAME CONTAINER */}
      <div className="flex-1 w-full h-full relative bg-white overflow-hidden flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-xs z-10 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs font-bold text-slate-700 tracking-wide bg-white/95 px-3 py-1 rounded-full border border-slate-200 shadow-sm">
              Carregando {title}...
            </span>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={url}
          title={title}
          onLoad={() => setIsLoading(false)}
          className="w-full h-full flex-1 border-0 bg-white block"
          allow="geolocation; microphone; camera; display-capture; clipboard-read; clipboard-write; autoplay"
          sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
        />
      </div>
    </div>
  );
};
