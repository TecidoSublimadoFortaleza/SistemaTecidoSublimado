import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, Check, X, Smartphone, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../../utils/usePWAInstall';

export const PWAInstallModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { promptInstall, isInstalled, isIOS, hasPrompt } = usePWAInstall();
  const [installSuccess, setInstallSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstall = async () => {
    if (hasPrompt) {
      const success = await promptInstall();
      if (success) {
        setInstallSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 p-2 flex items-center justify-center shrink-0">
              <img src="/images/icon-192.png" alt="TSF" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-base leading-tight">Instalar App TSF</h3>
                <span className="px-1.5 py-0.5 bg-amber-400 text-amber-950 font-black text-[9px] rounded-full uppercase">PWA</span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">ERP SubliGestão</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-full transition cursor-pointer text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isInstalled || installSuccess ? (
            <div className="text-center py-4 space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-900">Aplicativo instalado com sucesso!</p>
              <p className="text-xs text-slate-500">
                Você já pode acessar o ERP TSF direto da tela inicial do seu celular.
              </p>
            </div>
          ) : isIOS ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Para instalar no <strong>iPhone ou iPad (Safari)</strong>:
              </p>
              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <span>
                    Toque no botão de <strong>Compartilhar</strong> <Share className="w-4 h-4 inline text-blue-600 mx-1" /> na barra do Safari.
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <span>
                    Role para baixo e toque em <strong>Adicionar à Tela de Início</strong> <PlusSquare className="w-4 h-4 inline text-slate-700 mx-1" />.
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <span>
                    Toque em <strong>Adicionar</strong> no topo direito.
                  </span>
                </div>
              </div>
            </div>
          ) : hasPrompt ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Instale o <strong>ERP TSF</strong> no seu celular para abrir em tela cheia com alta velocidade, notificações e acesso direto pela tela inicial.
              </p>
              <button
                type="button"
                onClick={handleInstall}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-amber-300" />
                <span>Instalar Aplicativo Agora</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Como você já visualizou ou dispensou o aviso automático antes, siga o passo a passo abaixo:
              </p>
              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <span>
                    Toque no menu de <strong>três pontos</strong> <MoreVertical className="w-4 h-4 inline text-slate-700 mx-0.5" /> no canto superior direito do Chrome.
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <span>
                    Toque em <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <span>
                    Confirme para criar o ícone com acesso rápido no seu celular.
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" /> Dispositivo Móvel
            </span>
            <button onClick={onClose} className="text-slate-600 hover:underline font-semibold cursor-pointer">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Banner flutuante inteligente EXCLUSIVO para dispositivos móveis (oculto no desktop via md:hidden).
 * Diferente do Chrome nativo (que silencia por meses se dispensado),
 * este banner guarda a dispensa apenas na sessão (sessionStorage).
 * Se o usuário reabrir o navegador no celular, ele volta a sugerir gentilmente!
 */
export const MobilePWAPromptBanner: React.FC = () => {
  const { isInstalled, isMobile, isIOS, hasPrompt, promptInstall } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isInstalled || !isMobile) {
      setIsVisible(false);
      return;
    }

    // Se o usuário já dispensou nesta sessão atual, não incomoda enquanto navegar na mesma aba
    try {
      const sessionDismissed = sessionStorage.getItem('tsf_pwa_dismissed_session');
      if (sessionDismissed === 'true') {
        return;
      }
    } catch {
      // Ignored
    }

    // Delay suave de 2 segundos para o carregamento da página
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isInstalled, isMobile]);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      sessionStorage.setItem('tsf_pwa_dismissed_session', 'true');
    } catch {
      // Ignored
    }
  };

  const handleAction = async () => {
    if (hasPrompt) {
      const success = await promptInstall();
      if (success) {
        setIsVisible(false);
      }
    } else {
      setShowModal(true);
    }
  };

  if (isInstalled || !isMobile || !isVisible) {
    return showModal ? (
      <PWAInstallModal isOpen={showModal} onClose={() => setShowModal(false)} />
    ) : null;
  }

  return (
    <>
      {/* Container visível APENAS no mobile (md:hidden) */}
      <div className="md:hidden fixed bottom-3 left-3 right-3 z-50 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-blue-500/40 animate-in slide-in-from-bottom-5 duration-300 flex items-center justify-between gap-2.5 font-sans">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 p-1.5 flex items-center justify-center shrink-0">
            <img src="/images/icon-192.png" alt="TSF" className="w-full h-full object-contain rounded-lg" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-extrabold text-xs text-white truncate">Instalar App ERP TSF</h4>
              <span className="px-1.5 py-0.2 bg-blue-500 text-white font-bold text-[8px] rounded uppercase">App</span>
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              {isIOS ? 'Adicione à tela de início com 1 toque' : 'Tela cheia e acesso rápido'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleAction}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5 text-amber-300" />
            <span>Instalar</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
            title="Fechar sugestão nesta sessão"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <PWAInstallModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};
