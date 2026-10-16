import React, { useState, useEffect } from 'react';
import { OrdemServico } from '../../server/types/os';
import { formatDateBR } from '../../utils/formatters';
import { getLoggedUserAndPerfil } from '../../utils/userPermissions';
import {
  MessageSquare,
  Send,
  Copy,
  Check,
  X,
  Phone,
  User,
  Calendar,
  DollarSign,
  FileText,
  Sparkles,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface WhatsAppMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  os: OrdemServico | null;
  initialMode?: 'AGRADECIMENTO' | 'LEMBRETE_COBRANCA';
  customSellerName?: string;
  onConfirmSent?: (osId: string) => void;
}

export const WhatsAppMessageModal: React.FC<WhatsAppMessageModalProps> = ({
  isOpen,
  onClose,
  os,
  initialMode = 'AGRADECIMENTO',
  customSellerName,
  onConfirmSent,
}) => {
  const [mode, setMode] = useState<'AGRADECIMENTO' | 'LEMBRETE_COBRANCA'>(initialMode);
  const [clientPhone, setClientPhone] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [sellerName, setSellerName] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  const [sentConfirmed, setSentConfirmed] = useState<boolean>(false);

  // Sync state when OS or initialMode changes
  useEffect(() => {
    if (!os) return;

    const { name: loggedName } = getLoggedUserAndPerfil();
    const resolvedSeller =
      customSellerName ||
      os.vendedorNome ||
      os.vendedor ||
      os.operador ||
      loggedName ||
      'Vendedor(a)';

    setMode(initialMode);
    setClientName(os.clienteNome || 'Cliente');
    setClientPhone(os.clienteTelefone || '');
    setSellerName(resolvedSeller);

    generateMessage(initialMode, os, resolvedSeller, os.clienteNome || 'Cliente');
  }, [os, initialMode, customSellerName, isOpen]);

  // Generate Message Template
  const generateMessage = (
    msgMode: 'AGRADECIMENTO' | 'LEMBRETE_COBRANCA',
    currentOs: OrdemServico | null,
    currentSeller: string,
    currentClient: string
  ) => {
    if (!currentOs) return;

    const codigo = currentOs.codigo || 'OS';
    const dataEntregaFormatada = formatDateBR(currentOs.prazoEntrega) || 'A combinar';
    const valorFinal = (currentOs.valorFinal || 0).toFixed(2);
    const saldoRestante = currentOs.valorRestante !== undefined && currentOs.valorRestante !== null
      ? (currentOs.valorRestante || 0).toFixed(2)
      : valorFinal;

    const itensDesc =
      currentOs.itens && currentOs.itens.length > 0
        ? currentOs.itens.map((it) => `• ${it.quantidade}x ${it.descricao}`).join('\n')
        : '• Produtos / Serviços de Sublimação';

    const isOrcamento = (currentOs as any)?.tipoDocumento === 'ORCAMENTO' || (currentOs as any)?.isOrcamento || codigo.startsWith('ORC');
    const docLabel = isOrcamento ? `do seu Orçamento ${codigo}` : `da sua Ordem de Serviço ${codigo}`;
    const docTitle = isOrcamento ? `Orçamento ${codigo}` : `Ordem de Serviço ${codigo}`;

    if (msgMode === 'AGRADECIMENTO') {
      const text = isOrcamento
        ? `Olá, ${currentClient.trim()}! Tudo bem? 😊\n\nAqui é a ${currentSeller.trim()} da equipe TECIDO SUBLIMADO FORTALEZA.\n\nSeguem as informações do seu Orçamento ${codigo}: 📋✨\n\n📋 Resumo do Orçamento:\n${itensDesc}\n\n💰 Valor Total: R$ ${valorFinal}\n📅 Previsão / Prazo: ${dataEntregaFormatada}\n\nFico à total disposição para tirar qualquer dúvida e formalizar o seu pedido!\n\nMuito obrigada e tenha um excelente dia! ✨`
        : `Olá, ${currentClient.trim()}! Tudo bem? 😊\n\nAqui é a ${currentSeller.trim()} da equipe TECIDO SUBLIMADO FORTALEZA.\n\nPassando para agradecer pela sua preferência e confiança na contratação da sua Ordem de Serviço ${codigo}! 🎉\n\n📋 Resumo do seu Pedido:\n${itensDesc}\n\n💰 Valor Total: R$ ${valorFinal}\n📅 Previsão de Entrega: ${dataEntregaFormatada}\n\nSeu pedido já foi encaminhado para a nossa linha de produção. Caso precise de qualquer ajuste ou informação, estou à sua total disposição!\n\nMuito obrigada e tenha um excelente dia! ✨`;

      setMessageText(text);
    } else {
      // LEMBRETE & COBRANÇA
      const text = `Olá, ${currentClient.trim()}! Tudo bem? 😊\n\nAqui é a ${currentSeller.trim()} da equipe TECIDO SUBLIMADO FORTALEZA.\n\nEstamos entrando em contato sobre ${docLabel}, com previsão programada para ${dataEntregaFormatada}! 📦\n\n📋 Itens:\n${itensDesc}\n\n💰 Valor: R$ ${saldoRestante}\n\nFico à disposição por aqui para qualquer dúvida ou confirmação!\n\nAtenciosamente,\n${currentSeller.trim()} — TECIDO SUBLIMADO FORTALEZA`;

      setMessageText(text);
    }
  };

  const handleModeChange = (newMode: 'AGRADECIMENTO' | 'LEMBRETE_COBRANCA') => {
    setMode(newMode);
    generateMessage(newMode, os, sellerName, clientName);
  };

  const handleConfirmSent = () => {
    if (!messageText) return;
    navigator.clipboard.writeText(messageText);
    setSentConfirmed(true);
    if (os && onConfirmSent) {
      onConfirmSent(os.id);
    }
    setTimeout(() => {
      setSentConfirmed(false);
      onClose();
    }, 1200);
  };

  const handleOpenWhatsApp = () => {
    if (!messageText) return;

    // Clean phone number: remove non-digits
    let cleanPhone = clientPhone.replace(/\D/g, '');

    // Add Brazilian DDI (55) if missing
    if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
      cleanPhone = `55${cleanPhone}`;
    }

    const encodedText = encodeURIComponent(messageText);
    let whatsappUrl = '';

    if (cleanPhone.length >= 10) {
      whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    } else {
      // Open WhatsApp web with text only if phone is empty
      whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    }

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen || !os) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER FLUTUANTE ESTILO WHATSAPP */}
        <div className="bg-[#075E54] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shadow-md">
              <MessageSquare className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">WhatsApp Direto ao Cliente</h2>
                <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-black rounded-full uppercase">
                  {os.codigo}
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-medium">
                {mode === 'AGRADECIMENTO' ? 'Mensagem de Agradecimento pela Venda' : 'Lembrete de Entrega & Cobrança'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer"
            title="Fechar Janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TOGGLE MODO: AGRADECIMENTO VS LEMBRETE/COBRANÇA */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleModeChange('AGRADECIMENTO')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                mode === 'AGRADECIMENTO'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎉 Agradecimento
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('LEMBRETE_COBRANCA')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                mode === 'LEMBRETE_COBRANCA'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚠️ Lembrete & Cobrança
            </button>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
            <span>Status:</span>
            <span
              className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] ${
                os.paymentStatus === 'pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {os.paymentStatus === 'pago' ? 'Pago' : 'Pendente'}
            </span>
          </div>
        </div>

        {/* BODY COM INFORMAÇÕES DE CONTATO E TEXTO DA MENSAGEM */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          {/* DADOS DO CLIENTE E VENDEDOR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-tight mb-1">
                Cliente / Destinatário
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    generateMessage(mode, os, sellerName, e.target.value);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-tight mb-1">
                WhatsApp / Telefone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Ex: (85) 98888-7777"
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <Phone className="w-3.5 h-3.5 text-emerald-600 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-700 uppercase tracking-tight mb-1">
              Nome do Vendedor / Atendente no Texto
            </label>
            <input
              type="text"
              value={sellerName}
              onChange={(e) => {
                setSellerName(e.target.value);
                generateMessage(mode, os, e.target.value, clientName);
              }}
              placeholder="Nome do Vendedor"
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* TEXTO DA MENSAGEM GERADO */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-tight">
                Texto Personalizado para Envio
              </label>
              <button
                type="button"
                onClick={() => generateMessage(mode, os, sellerName, clientName)}
                className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold hover:underline cursor-pointer"
              >
                Regenerar Modelo
              </button>
            </div>
            <textarea
              rows={8}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full p-3 bg-emerald-50/40 border border-emerald-300/80 rounded-2xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed font-sans"
            />
          </div>

          {/* DICA DE ENVIO */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-[11px] text-slate-600 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Ao clicar em <strong>Abrir no WhatsApp</strong>, o aplicativo ou WhatsApp Web será aberto já com o texto preenchido e formatado.
            </span>
          </div>
        </div>

        {/* FOOTER COM BOTÕES DE AÇÃO */}
        <div className="bg-slate-100 border-t border-slate-200 p-3.5 sm:p-4 flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirmSent}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs ${
                sentConfirmed
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
              }`}
              title="Confirmar envio e pausar lembrete desta OS"
            >
              {sentConfirmed ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-slate-600" />}
              <span>{sentConfirmed ? 'Enviado!' : 'Mensagem Enviada'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="px-5 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>Abrir no WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
