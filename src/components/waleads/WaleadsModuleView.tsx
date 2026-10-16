import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  ShieldCheck,
  Copy,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

const WALEADS_URL = 'https://app.waleads.com.br/login';

export const WaleadsModuleView: React.FC = () => {
  const [iframeKey, setIframeKey] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Safety timer to remove loading state if cross-origin iframe does not trigger onLoad
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [iframeKey]);

  // Handle Fullscreen toggle
  const handleToggleFullscreen = async () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (containerRef.current && !document.fullscreenElement) {
          if (containerRef.current.requestFullscreen) {
            await containerRef.current.requestFullscreen();
          }
        }
      } catch {
        // Fallback to CSS fixed inset-0 overlay
      }
    } else {
      handleExitFullscreen();
    }
  };

  const handleExitFullscreen = async () => {
    setIsFullscreen(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignored
    }
  };

  // Keyboard shortcut listener for ESC key to reduce screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        handleExitFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Sync state when exiting native browser fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isFullscreen]);

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(WALEADS_URL);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = WALEADS_URL;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleOpenNewTab = () => {
    window.open(WALEADS_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col w-full transition-all duration-200 ${
        isFullscreen
          ? 'fixed inset-0 z-[99999] bg-white w-screen h-screen m-0 p-0'
          : 'h-[calc(100dvh-4rem)] sm:h-[calc(100vh-80px)] min-h-0 sm:min-h-[620px]'
      }`}
    >
      {/* BOTÃO FLUTUANTE DE REDUZIR A TELA (EXIBIDO NO CENTRO SUPERIOR DA TELA) */}
      {isFullscreen && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100000] flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <button
            type="button"
            onClick={handleExitFullscreen}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900/90 hover:bg-slate-900 text-white font-semibold text-sm rounded-full shadow-2xl border border-slate-700/80 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer group"
            title="Reduzir para o tamanho normal"
          >
            <Minimize2 className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
            <span>Reduzir Tela</span>
            <kbd className="hidden lg:inline-block text-[10px] font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 ml-1">
              ESC
            </kbd>
          </button>

          <button
            type="button"
            onClick={handleOpenNewTab}
            className="p-2 bg-white/90 hover:bg-white text-slate-700 hover:text-emerald-600 rounded-full shadow-xl border border-slate-200 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Abrir em Nova Aba"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER BAR CONFORME IDENTIDADE VISUAL SOLICITADA (OCULTA EM TELA CHEIA PARA APROVEITAMENTO TOTAL) */}
      {!isFullscreen && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs px-4 py-3 sm:px-5 sm:py-3.5 mb-3 flex flex-wrap items-center justify-between gap-3">
          {/* LADO ESQUERDO: ÍCONE, TÍTULO, BADGE E LINK SEGURO */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 text-emerald-600" />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  WaLeads
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  WhatsApp Leads CRM
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-0.5 truncate">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{WALEADS_URL}</span>
              </div>
            </div>
          </div>

          {/* LADO DIREITO: BOTÕES DE AÇÃO */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* 1. COPIAR LINK */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-sm font-medium rounded-xl border border-slate-200 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              title="Copiar link de acesso"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Copiar Link</span>
                </>
              )}
            </button>

            {/* 2. RECARREGAR */}
            <button
              type="button"
              onClick={handleRefresh}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-sm font-medium rounded-xl border border-slate-200 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              title="Recarregar página"
            >
              <RotateCcw
                className={`w-4 h-4 text-slate-500 ${
                  isLoading ? 'animate-spin text-emerald-600' : ''
                }`}
              />
              <span>Recarregar</span>
            </button>

            {/* 3. TELA CHEIA */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-sm font-medium rounded-xl border border-slate-200 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              title="Expandir para tela cheia"
            >
              <Maximize2 className="w-4 h-4 text-slate-500" />
              <span>Tela Cheia</span>
            </button>

            {/* 4. ABRIR EM NOVA ABA */}
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              title="Abrir WaLeads em uma nova aba do navegador"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Abrir em Nova Aba</span>
            </button>
          </div>
        </div>
      )}

      {/* CONTAINER DO IFRAME */}
      <div
        className={`flex-1 w-full bg-white relative overflow-hidden flex items-center justify-center ${
          isFullscreen
            ? 'h-full border-0 rounded-none'
            : 'rounded-2xl border border-slate-200 shadow-xs'
        }`}
      >
        {/* SPINNER DE CARREGAMENTO SUAVE */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-xs z-10 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300">
            <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs font-bold text-slate-700 tracking-wide bg-white/95 px-3 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Carregando WaLeads CRM...
            </span>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={WALEADS_URL}
          title="WaLeads CRM"
          onLoad={() => setIsLoading(false)}
          className="w-full h-full flex-1 border-0 bg-white block"
          allow="geolocation; microphone; camera; display-capture; clipboard-read; clipboard-write; autoplay"
          sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
        />
      </div>
    </div>
  );
};
