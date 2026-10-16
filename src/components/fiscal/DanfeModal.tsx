import React, { useRef, useState } from 'react';
import {
  Printer,
  Download,
  Share2,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  Building2,
  ExternalLink,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { NotaFiscal } from '../../services/api';
import { openDanfeInNewTab } from '../../utils/danfePrintHelper';

interface DanfeModalProps {
  nota: NotaFiscal | null;
  onClose: () => void;
  onDownloadXml: (nota: NotaFiscal) => void;
}

// Helper to render realistic Code-128 SEFAZ barcode SVG
const DanfeBarcodeSvg: React.FC<{ code: string }> = ({ code }) => {
  const digits = (code || '23260936047818000107550030000061771120519837').replace(/\D/g, '');
  // Deterministic bar widths pattern based on code
  const bars: { width: number; isBlack: boolean }[] = [];
  bars.push({ width: 2, isBlack: true }, { width: 1, isBlack: false }, { width: 1, isBlack: true });
  for (let i = 0; i < digits.length; i++) {
    const val = parseInt(digits[i], 10) || 1;
    const w1 = (val % 3) + 1;
    const w2 = ((val * 2) % 2) + 1;
    const w3 = ((val * 3) % 3) + 1;
    bars.push({ width: w1, isBlack: true });
    bars.push({ width: 1, isBlack: false });
    bars.push({ width: w2, isBlack: true });
    bars.push({ width: w3, isBlack: false });
  }
  bars.push({ width: 2, isBlack: true }, { width: 1, isBlack: false }, { width: 3, isBlack: true });

  let currentX = 2;
  const rects = bars.map((b, idx) => {
    const x = currentX;
    currentX += b.width * 1.65;
    if (!b.isBlack) return null;
    return <rect key={idx} x={x} y={1} width={b.width * 1.6} height={34} fill="#000" />;
  });

  return (
    <svg viewBox={`0 0 ${Math.max(340, Math.ceil(currentX + 4))} 36`} className="w-full h-9">
      {rects}
    </svg>
  );
};

export const DanfeModal: React.FC<DanfeModalProps> = ({ nota, onClose, onDownloadXml }) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);
  const [copiedChave, setCopiedChave] = useState(false);

  if (!nota) return null;

  const isNfce = nota.tipo === 'NFCE';
  const formattedChave = (nota.chaveAcesso || '').replace(/(\d{4})/g, '$1 ').trim();
  const formatNumero = (n: number) => String(n || 1).padStart(9, '0');
  const formatBRL = (v: number) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatQtd = (q: number) => (q || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const formatDate = (dStr?: string) => {
    if (!dStr) return new Date().toLocaleDateString('pt-BR');
    try {
      const d = new Date(dStr);
      return isNaN(d.getTime()) ? dStr : d.toLocaleDateString('pt-BR');
    } catch {
      return dStr;
    }
  };

  const formatDateTime = (dStr?: string) => {
    if (!dStr) return `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`;
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${dd}/${mm}/${yy} ${hh}:${min}:${ss}`;
    } catch {
      return dStr;
    }
  };

  const logoUrl = 'https://raw.githubusercontent.com/MarceloGomes-Dev/WWW.TECIDOSUBLIMADOFORTALEZA/main/public/images/logo-ts.png';

  const handleCopyChave = () => {
    if (!nota.chaveAcesso) return;
    navigator.clipboard.writeText(nota.chaveAcesso);
    setCopiedChave(true);
    setTimeout(() => setCopiedChave(false), 2500);
  };

  const getPrintableHtml = () => {
    if (!printAreaRef.current) return '';
    const content = printAreaRef.current.innerHTML;
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFE_${nota.tipo}_${nota.numero}_Serie_${nota.serie}_${nota.chaveAcesso || 'SEFAZ'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page {
      size: ${isNfce ? '80mm auto' : 'A4 portrait'};
      margin: ${isNfce ? '2mm' : '4mm'};
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print {
        display: none !important;
      }
      #print-root {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
      }
    }
    body {
      background: #ffffff !important;
      color: #000000 !important;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: ${isNfce ? '4px' : '10px'};
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    * {
      box-sizing: border-box;
    }
    img {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .top-actions-bar {
      background: #0f172a;
      color: #ffffff;
      padding: 12px 18px;
      margin-bottom: 14px;
      border-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      font-family: sans-serif;
    }
  </style>
</head>
<body>
  <div class="no-print top-actions-bar">
    <div>
      <span style="font-weight: 800; font-size: 14px;">DANFE ${nota.tipo === 'NFE' ? 'NF-e (Modelo 55)' : 'NFC-e (Cupom)'} Nº ${nota.numero} (Série ${nota.serie})</span>
      <span style="font-size: 11px; opacity: 0.8; margin-left: 10px;">TECIDO SUBLIMADO</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" style="background: #2563eb; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px;">
        🖨️ Imprimir / Salvar como PDF
      </button>
      <button onclick="window.close()" style="background: #334155; color: #ffffff; border: none; padding: 8px 14px; font-weight: 600; border-radius: 8px; cursor: pointer; font-size: 13px;">
        Fechar
      </button>
    </div>
  </div>
  <div id="print-root">
    ${content}
  </div>
  <script>
    // Trigger print automatically after styles & fonts load
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;
  };

  const handleOpenInNewTab = () => {
    if (nota) {
      setPrintFeedback('Abrindo DANFE em nova guia...');
      setTimeout(() => setPrintFeedback(null), 3000);
      openDanfeInNewTab(nota);
      return;
    }
    window.print();
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setPrintFeedback('Iniciando diálogo de impressão do DANFE...');
    setTimeout(() => setPrintFeedback(null), 4000);

    const html = getPrintableHtml();
    if (!html) {
      window.print();
      setIsPrinting(false);
      return;
    }

    // Method 1: Invisible isolated iframe (does not print the background dashboard)
    try {
      let printIframe = document.getElementById('danfe-print-iframe') as HTMLIFrameElement;
      if (printIframe && printIframe.parentNode) {
        printIframe.parentNode.removeChild(printIframe);
      }

      printIframe = document.createElement('iframe');
      printIframe.id = 'danfe-print-iframe';
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = 'none';
      printIframe.style.opacity = '0';
      printIframe.style.pointerEvents = 'none';
      document.body.appendChild(printIframe);

      const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();

        setTimeout(() => {
          try {
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
            setIsPrinting(false);
          } catch (iframeErr) {
            console.warn('Iframe print restricted by sandbox, falling back to new tab:', iframeErr);
            handleOpenInNewTab();
            setIsPrinting(false);
          }
        }, 400);
        return;
      }
    } catch (err) {
      console.warn('Direct iframe print failed, using new tab fallback:', err);
    }

    // Method 2: Fallback to new tab print
    handleOpenInNewTab();
    setIsPrinting(false);
  };

  const handleSendWhatsApp = () => {
    const cleanPhone = (nota.clienteTelefone || '').replace(/\D/g, '');
    const mensagem = encodeURIComponent(
      `Olá, ${nota.clienteNome}! Segue os dados da sua Nota Fiscal Eletrônica emitida pela TECIDO SUBLIMADO:\n\n` +
      `📄 Tipo: ${nota.tipo === 'NFE' ? 'NF-e (Modelo 55)' : 'NFC-e (Cupom Fiscal)'}\n` +
      `🔢 Número: ${nota.numero} (Série: ${nota.serie})\n` +
      `💰 Valor Total: R$ ${nota.valorTotal.toFixed(2).replace('.', ',')}\n` +
      `🔑 Chave de Acesso: ${nota.chaveAcesso}\n` +
      `✅ Protocolo SEFAZ: ${nota.protocolo || 'Autorizada'}\n\n` +
      `Você pode consultar a autenticidade diretamente no portal oficial da SEFAZ.`
    );
    const url = cleanPhone ? `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${mensagem}` : `https://api.whatsapp.com/send?text=${mensagem}`;
    window.open(url, '_blank');
  };

  const hasExternalPdf = Boolean(
    nota.danfeUrl &&
    nota.danfeUrl.startsWith('http') &&
    !nota.danfeUrl.includes('/api/v1/fiscal')
  );

  return (
    <div id="danfe-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div id="danfe-modal-card" className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Print Feedback Toast */}
        {printFeedback && (
          <div className="bg-blue-600 text-white text-xs px-4 py-2 font-bold flex items-center justify-between animate-in slide-in-from-top-2 duration-150 print:hidden">
            <div className="flex items-center gap-2">
              <Printer className="w-3.5 h-3.5 animate-pulse" />
              <span>{printFeedback}</span>
            </div>
            <button
              onClick={() => setPrintFeedback(null)}
              className="text-white/80 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header Action Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800 print:hidden flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-blue-600 rounded-xl shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base">
                  {isNfce ? 'DANFE NFC-e (Cupom Fiscal)' : 'DANFE NF-e (Modelo 55)'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    nota.status === 'AUTORIZADA'
                      ? 'bg-emerald-500 text-white'
                      : nota.status === 'CANCELADA'
                      ? 'bg-rose-500 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {nota.status}
                </span>
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">
                  Nº {nota.numero} • Série {nota.serie}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs sm:max-w-md">
                  Chave: {nota.chaveAcesso}
                </p>
                <button
                  onClick={handleCopyChave}
                  className="text-slate-400 hover:text-white p-0.5 transition cursor-pointer"
                  title="Copiar chave de acesso"
                >
                  {copiedChave ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {hasExternalPdf && (
              <a
                href={nota.danfeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/80 hover:bg-blue-800 text-blue-200 text-xs font-bold rounded-xl transition cursor-pointer border border-blue-700/50"
                title="Abrir PDF Oficial do Spedy"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PDF Oficial</span>
              </a>
            )}

            <button
              onClick={handleSendWhatsApp}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              title="Compartilhar pelo WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={() => onDownloadXml(nota)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
              title="Baixar Arquivo XML Oficial"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Baixar XML</span>
            </button>

            {/* ABRIR EM NOVA ABA (ESSENCIAL PARA IFRAMES) */}
            <button
              onClick={handleOpenInNewTab}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-700"
              title="Abrir DANFE em nova guia com impressão limpa e livre de restrições"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Nova Aba</span>
            </button>

            {/* BOTAO ATIVO DE IMPRESSAO */}
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-75"
              title="Imprimir DANFE ou Salvar como PDF"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>{isPrinting ? 'Preparando...' : 'Imprimir / PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable DANFE Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50 print:bg-white print:p-0">
          <div
            ref={printAreaRef}
            id="danfe-printable-container"
            className="bg-white border border-slate-300 p-4 sm:p-6 rounded-xl shadow-xs text-slate-900 font-sans max-w-3xl mx-auto print:border-none print:shadow-none print:max-w-none print:p-0"
          >
            {/* DANFE CANCELADA WATERMARK */}
            {nota.status === 'CANCELADA' && (
              <div className="mb-4 p-3 bg-rose-50 border-2 border-dashed border-rose-400 rounded-xl text-center">
                <p className="text-rose-700 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> NOTA FISCAL CANCELADA NA SEFAZ
                </p>
                <p className="text-rose-600 text-xs mt-0.5">
                  Motivo: {nota.motivoCancelamento || 'Cancelamento solicitado pela empresa.'} • Protocolo: {nota.protocoloCancelamento}
                </p>
              </div>
            )}

            {isNfce ? (
              /* ========================================================================= */
              /* NFC-e LAYOUT (CUPOM FISCAL DE CONSUMIDOR)                                 */
              /* ========================================================================= */
              <div className="max-w-md mx-auto text-xs font-mono space-y-3 p-4 border border-slate-300 rounded-xl bg-slate-50/50">
                <div className="text-center border-b border-dashed border-slate-300 pb-3">
                  <h2 className="font-bold text-sm tracking-tight">{nota.emitente.razaoSocial}</h2>
                  <p className="text-[11px]">{nota.emitente.nomeFantasia}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    CNPJ: {nota.emitente.cnpj} • IE: {nota.emitente.inscricaoEstadual}
                  </p>
                  <p className="text-[10px] text-slate-600">Av. Senador Fernandes Távora, 2305 - Henrique Jorge - Fortaleza/CE</p>
                  <div className="mt-2 py-1 bg-slate-100 font-bold text-[10px] uppercase border border-slate-200">
                    DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
                  </div>
                  <p className="text-[9px] text-slate-500 mt-0.5">Não permite aproveitamento de crédito de ICMS</p>
                </div>

                {/* Items */}
                <div className="border-b border-dashed border-slate-300 pb-3 space-y-1">
                  <div className="grid grid-cols-12 font-bold text-[10px] border-b pb-1 text-slate-700">
                    <span className="col-span-6">ITEM / DESCRIÇÃO</span>
                    <span className="col-span-2 text-center">QTD</span>
                    <span className="col-span-2 text-right">VL UN</span>
                    <span className="col-span-2 text-right">TOTAL</span>
                  </div>
                  {nota.itens.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 text-[10px] py-0.5">
                      <span className="col-span-6 truncate font-medium">{it.descricao}</span>
                      <span className="col-span-2 text-center">{it.quantidade}</span>
                      <span className="col-span-2 text-right">R$ {it.valorUnitario.toFixed(2)}</span>
                      <span className="col-span-2 text-right font-bold">R$ {it.valorTotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-b border-dashed border-slate-300 pb-3 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Qtd. Total de Itens:</span>
                    <span className="font-bold">{nota.itens.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor Total dos Produtos:</span>
                    <span>R$ {nota.valorProdutos.toFixed(2)}</span>
                  </div>
                  {Boolean(nota.valorDesconto) && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Desconto:</span>
                      <span>- R$ {Number(nota.valorDesconto).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t">
                    <span>VALOR TOTAL A PAGAR:</span>
                    <span>R$ {nota.valorTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>FORMA DE PAGAMENTO:</span>
                    <span className="font-bold">{nota.formaPagamento}</span>
                  </div>
                </div>

                {/* Consumer */}
                <div className="border-b border-dashed border-slate-300 pb-3 text-[10px]">
                  <p className="font-bold">CONSUMIDOR:</p>
                  <p>{nota.clienteNome || 'Consumidor Final Não Identificado'}</p>
                  {nota.clienteDocumento && <p>CPF/CNPJ: {nota.clienteDocumento}</p>}
                </div>

                {/* Fiscal info & QR Code */}
                <div className="text-center pt-2 space-y-2">
                  <div className="flex items-center justify-center p-3 bg-white border border-slate-200 rounded-lg inline-block mx-auto">
                    <QrCode className="w-24 h-24 text-slate-900" />
                  </div>
                  <p className="text-[10px] text-slate-600 font-bold">Consulte pela Chave de Acesso em:</p>
                  <p className="text-[9px] text-blue-600 break-all">http://nfce.sefaz.ce.gov.br/consulta</p>
                  <p className="text-[10px] font-mono font-bold tracking-tight bg-slate-100 p-1.5 rounded">
                    {formattedChave}
                  </p>
                  <div className="text-[9px] text-slate-500 pt-1">
                    <p>Nº: {nota.numero} • Série: {nota.serie} • Emissão: {new Date(nota.dataEmissao).toLocaleString('pt-BR')}</p>
                    <p>Protocolo de Autorização: {nota.protocolo || '123456789012345'}</p>
                    <p className="font-bold text-slate-700 mt-1">{nota.ambiente === 'PRODUCAO' ? 'EMITIDA EM AMBIENTE DE PRODUÇÃO' : 'AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL'}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* ========================================================================= */
              /* NF-e MODELO 55 LAYOUT (OFICIAL SEFAZ BRASIL - TECIDO SUBLIMADO)          */
              /* ========================================================================= */
              <div className="space-y-2 text-[8.5px] leading-tight text-slate-900">
                {/* 0. CANHOTO DE RECEBIMENTO */}
                <div className="border border-black text-[8px] leading-tight">
                  <div className="grid grid-cols-12 border-b border-black">
                    <div className="col-span-10 p-1.5 font-bold uppercase">
                      RECEBEMOS DE {nota.emitente.razaoSocial || 'TECIDO SUBLIMADO FORTALEZA COMERCIO E SERVICOS LTDA'} OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO
                    </div>
                    <div className="col-span-2 border-l border-black p-1 text-center font-bold">
                      <div className="text-[10px]">NF-e</div>
                      <div>Nº {formatNumero(nota.numero)}</div>
                      <div>Série {nota.serie}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-12">
                    <div className="col-span-3 border-r border-black p-1">
                      <span className="text-[7px] block font-bold text-slate-600">DATA DE RECEBIMENTO</span>
                      <div className="h-4"></div>
                    </div>
                    <div className="col-span-6 border-r border-black p-1">
                      <span className="text-[7px] block font-bold text-slate-600">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
                      <div className="h-4"></div>
                    </div>
                    <div className="col-span-3 p-1 text-[7.5px] leading-tight">
                      <p><span className="font-bold">DESTINATÁRIO:</span> <span className="truncate">{nota.clienteNome}</span></p>
                      <p><span className="font-bold">VLR TOTAL NOTA:</span> R$ {formatBRL(nota.valorTotal)}</p>
                      <p><span className="font-bold">DATA DA EMISSÃO:</span> {formatDate(nota.dataEmissao)}</p>
                    </div>
                  </div>
                </div>

                <div className="border-b border-dashed border-slate-400 my-1 relative">
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-white px-2 text-[7px] text-slate-400 uppercase font-mono">Destaque aqui</span>
                </div>

                {/* 1. SEFAZ Header */}
                <div className="border border-black">
                  <div className="grid grid-cols-12 border-b border-black">
                    {/* Left: Emitente */}
                    <div className="col-span-5 p-2 border-r border-black flex gap-3 items-center">
                      <div className="w-20 h-20 shrink-0 flex items-center justify-center p-1 bg-white border border-slate-200 rounded">
                        <img
                          src={logoUrl}
                          alt="Logo Tecido Sublimado"
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">IDENTIFICAÇÃO DO EMITENTE</div>
                        <h2 className="font-black text-[13px] leading-tight uppercase text-slate-900 mb-1">
                          {nota.emitente.razaoSocial || 'TECIDO SUBLIMADO FORTALEZA COMERCIO E SERVICOS LTDA'}
                        </h2>
                        <div className="text-[9.5px] text-slate-800 leading-snug font-medium">
                          <p>{nota.emitente?.endereco || 'AVENIDA SENADOR FERNANDES TÁVORA, 2305'}</p>
                          <p>{(nota.emitente as any)?.bairro ? `${(nota.emitente as any).bairro} — ` : 'HENRIQUE JORGE — '}{nota.emitente?.cidade || 'FORTALEZA'} - {nota.emitente?.uf || 'CE'}</p>
                          <p>CEP: {(nota.emitente as any)?.cep || '60510-291'} • FONE: {nota.emitente?.telefone || '(85) 98425-1321'}</p>
                          <p className="text-[9px] text-slate-600 mt-0.5">CNPJ: {nota.emitente?.cnpj || '36.047.818/0001-07'} • IE: {nota.emitente?.inscricaoEstadual || '061671967'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Center: DANFE Info */}
                    <div className="col-span-3 p-1.5 border-r border-black text-center flex flex-col justify-between">
                      <div>
                        <h1 className="font-black text-lg tracking-wider">DANFE</h1>
                        <p className="text-[7.5px] font-bold uppercase leading-tight">
                          Documento Auxiliar da Nota Fiscal Eletrônica
                        </p>
                        <div className="mt-1 flex items-center justify-center gap-1.5 text-[8px] font-bold">
                          <span>0 - ENTRADA</span>
                          <span className="inline-flex items-center gap-1">
                            <span>1 - SAÍDA</span>
                            <span className="w-4 h-4 border border-black inline-flex items-center justify-center font-black">1</span>
                          </span>
                        </div>
                      </div>
                      <div className="font-mono text-center pt-1 border-t border-slate-300">
                        <p className="font-black text-[11px]">Nº {formatNumero(nota.numero)}</p>
                        <p className="text-[8.5px] font-bold">SÉRIE {nota.serie}</p>
                        <p className="text-[7.5px] text-slate-600">FL 1 / 1</p>
                      </div>
                    </div>

                    {/* Right: Barcode & Chave */}
                    <div className="col-span-4 p-1.5 flex flex-col justify-between">
                      <div className="flex flex-col items-center">
                        <DanfeBarcodeSvg code={nota.chaveAcesso} />
                        <div className="w-full text-center mt-0.5">
                          <span className="text-[7px] font-bold uppercase block text-slate-500">CHAVE DE ACESSO</span>
                          <span className="font-mono text-[8px] font-black tracking-tight block">
                            {formattedChave}
                          </span>
                        </div>
                      </div>
                      <div className="text-[6.5px] text-slate-600 text-center leading-tight pt-1 border-t border-slate-200">
                        Consulta de autenticidade no portal nacional da NF-e<br />
                        <span className="font-bold">www.nfe.fazenda.gov.br/portal</span> ou no site da Sefaz Autorizadora
                      </div>
                    </div>
                  </div>

                  {/* Natureza e Protocolo */}
                  <div className="grid grid-cols-12 border-b border-black text-[8px]">
                    <div className="col-span-7 p-1 border-r border-black">
                      <span className="text-[6.5px] font-bold uppercase block text-slate-500">NATUREZA DA OPERAÇÃO</span>
                      <span className="font-bold truncate block">{nota.naturezaOperacao || 'Venda de producao do estabelecimento'}</span>
                    </div>
                    <div className="col-span-5 p-1">
                      <span className="text-[6.5px] font-bold uppercase block text-slate-500">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
                      <span className="font-mono font-bold block">{nota.protocolo || '223260099625374'} {formatDateTime(nota.dataAutorizacao || nota.dataEmissao)}</span>
                    </div>
                  </div>

                  {/* Inscrição Estadual e CNPJ */}
                  <div className="grid grid-cols-12 text-[8px]">
                    <div className="col-span-4 p-1 border-r border-black">
                      <span className="text-[6.5px] font-bold uppercase block text-slate-500">INSCRIÇÃO ESTADUAL</span>
                      <span className="font-mono font-bold block">{nota.emitente.inscricaoEstadual || '061671967'}</span>
                    </div>
                    <div className="col-span-4 p-1 border-r border-black">
                      <span className="text-[6.5px] font-bold uppercase block text-slate-500">INSC. ESTADUAL DO SUBST. TRIBUTÁRIO</span>
                      <span className="font-mono block">-</span>
                    </div>
                    <div className="col-span-4 p-1">
                      <span className="text-[6.5px] font-bold uppercase block text-slate-500">CNPJ / CPF</span>
                      <span className="font-mono font-bold block">{nota.emitente.cnpj || '36.047.818/0001-07'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. DESTINATÁRIO / REMETENTE */}
                <div>
                  <div className="bg-slate-100 border border-black border-b-0 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                    DESTINATÁRIO / REMETENTE
                  </div>
                  <div className="border border-black text-[8px] leading-tight">
                    <div className="grid grid-cols-12 border-b border-black">
                      <div className="col-span-7 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">NOME / RAZÃO SOCIAL</span>
                        <span className="font-bold truncate block">
                          {nota.clienteNome}
                          {nota.clienteNomeFantasia && nota.clienteNomeFantasia !== nota.clienteNome ? ` (${nota.clienteNomeFantasia})` : ''}
                        </span>
                      </div>
                      <div className="col-span-3 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">CNPJ / CPF / IDEstr.</span>
                        <span className="font-mono font-bold block">{nota.clienteDocumento || 'Consumidor Final'}</span>
                      </div>
                      <div className="col-span-2 p-1">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">DATA DA EMISSÃO</span>
                        <span className="font-mono font-bold block">{formatDate(nota.dataEmissao)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 border-b border-black">
                      <div className="col-span-5 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">ENDEREÇO</span>
                        <span className="truncate block">
                          {nota.clienteEndereco
                            ? (typeof nota.clienteEndereco === 'string'
                                ? nota.clienteEndereco
                                : `${nota.clienteEndereco.logradouro || ''}${nota.clienteEndereco.numero ? `, ${nota.clienteEndereco.numero}` : ''}${nota.clienteEndereco.complemento ? ` - ${nota.clienteEndereco.complemento}` : ''}`)
                            : ''}
                        </span>
                      </div>
                      <div className="col-span-3 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">BAIRRO / DISTRITO</span>
                        <span className="truncate block">{typeof nota.clienteEndereco === 'object' ? (nota.clienteEndereco?.bairro || '') : ''}</span>
                      </div>
                      <div className="col-span-2 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">CEP</span>
                        <span className="font-mono block">{typeof nota.clienteEndereco === 'object' ? (nota.clienteEndereco?.cep || '') : ''}</span>
                      </div>
                      <div className="col-span-2 p-1">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">DATA/HORA ENTRADA/SAÍDA</span>
                        <span className="font-mono block">{formatDateTime(nota.dataEmissao)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-12">
                      <div className="col-span-5 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">MUNICÍPIO</span>
                        <span className="truncate block">{typeof nota.clienteEndereco === 'object' ? (nota.clienteEndereco?.cidade || 'FORTALEZA') : 'FORTALEZA'}</span>
                      </div>
                      <div className="col-span-3 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">FONE / FAX</span>
                        <span className="font-mono block">{nota.clienteTelefone || ''}</span>
                      </div>
                      <div className="col-span-1 p-1 border-r border-black text-center">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">UF</span>
                        <span className="font-bold block">{typeof nota.clienteEndereco === 'object' ? (nota.clienteEndereco?.uf || 'CE') : 'CE'}</span>
                      </div>
                      <div className="col-span-3 p-1">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">INSCRIÇÃO ESTADUAL</span>
                        <span className="font-mono block">{nota.clienteInscricaoEstadual || ''}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. CÁLCULO DO IMPOSTO */}
                <div>
                  <div className="bg-slate-100 border border-black border-b-0 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                    CÁLCULO DO IMPOSTO
                  </div>
                  <div className="border border-black text-[8px] leading-tight">
                    <div className="grid grid-cols-6 border-b border-black">
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">BASE DE CÁLC. DO ICMS</span>
                        <span className="font-mono block text-right font-medium">0,00</span>
                      </div>
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">VALOR DO ICMS</span>
                        <span className="font-mono block text-right font-medium">0,00</span>
                      </div>
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">BASE CÁLC. ICMS SUBST.</span>
                        <span className="font-mono block text-right font-medium">0,00</span>
                      </div>
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">VALOR DO ICMS SUBST.</span>
                        <span className="font-mono block text-right font-medium">0,00</span>
                      </div>
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">V. IMP. IMPORTAÇÃO</span>
                        <span className="font-mono block text-right font-medium">0,00</span>
                      </div>
                      <div className="p-1">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">V. TOTAL DOS PRODUTOS</span>
                        <span className="font-mono block text-right font-bold">R$ {formatBRL(nota.valorProdutos)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-6">
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">VALOR DO FRETE</span>
                        <span className="font-mono block text-right font-medium">R$ {formatBRL(nota.valorFrete || 0)}</span>
                      </div>
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">VALOR DO SEGURO</span>
                        <span className="font-mono block text-right font-medium">0,00</span>
                      </div>
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">DESCONTO</span>
                        <span className="font-mono block text-right font-medium">R$ {formatBRL(nota.valorDesconto || 0)}</span>
                      </div>
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">OUTRAS DESPESAS</span>
                        <span className="font-mono block text-right font-medium">0,00</span>
                      </div>
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">VALOR DO IPI</span>
                        <span className="font-mono block text-right font-medium">0,00</span>
                      </div>
                      <div className="p-1 bg-slate-50">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-600">V. TOTAL DA NOTA</span>
                        <span className="font-mono block text-right font-black text-[9px]">R$ {formatBRL(nota.valorTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. TRANSPORTADOR / VOLUMES TRANSPORTADOS */}
                <div>
                  <div className="bg-slate-100 border border-black border-b-0 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                    TRANSPORTADOR / VOLUMES TRANSPORTADOS
                  </div>
                  <div className="border border-black text-[8px] leading-tight">
                    <div className="grid grid-cols-12 border-b border-black">
                      <div className="col-span-5 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">RAZÃO SOCIAL</span>
                        <span className="font-bold truncate block">{nota.transportadora?.razaoSocial || 'RETIRADA NO LOCAL'}</span>
                      </div>
                      <div className="col-span-3 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">FRETE POR CONTA</span>
                        <span className="truncate block font-semibold">0-Contrat. por conta do Remetente</span>
                      </div>
                      <div className="col-span-1 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">CÓD. ANTT</span>
                        <span className="font-mono block">-</span>
                      </div>
                      <div className="col-span-1 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">PLACA</span>
                        <span className="font-mono block">-</span>
                      </div>
                      <div className="col-span-1 p-1 border-r border-black text-center">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">UF</span>
                        <span className="font-bold block">-</span>
                      </div>
                      <div className="col-span-1 p-1">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">CNPJ / CPF</span>
                        <span className="font-mono block">-</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 border-b border-black">
                      <div className="col-span-5 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">ENDEREÇO</span>
                        <span className="truncate block">-</span>
                      </div>
                      <div className="col-span-4 p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">MUNICÍPIO</span>
                        <span className="truncate block">FORTALEZA</span>
                      </div>
                      <div className="col-span-1 p-1 border-r border-black text-center">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">UF</span>
                        <span className="font-bold block">CE</span>
                      </div>
                      <div className="col-span-2 p-1">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">INSCRIÇÃO ESTADUAL</span>
                        <span className="font-mono block">-</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-6 text-[7.5px]">
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">QUANTIDADE</span>
                        <span className="font-mono block text-right font-medium">{nota.itens.reduce((acc, it) => acc + (it.quantidade || 0), 0)}</span>
                      </div>
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">ESPÉCIE</span>
                        <span className="block font-medium">VOLUMES</span>
                      </div>
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">MARCA</span>
                        <span className="block font-medium">-</span>
                      </div>
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">NUMERAÇÃO</span>
                        <span className="block font-medium">-</span>
                      </div>
                      <div className="p-1 border-r border-black">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">PESO BRUTO</span>
                        <span className="font-mono block text-right">-</span>
                      </div>
                      <div className="p-1">
                        <span className="text-[6.5px] font-bold uppercase block text-slate-500">PESO LÍQUIDO</span>
                        <span className="font-mono block text-right">-</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. DADOS DO PRODUTO / SERVIÇO */}
                <div>
                  <div className="bg-slate-100 border border-black border-b-0 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                    DADOS DO PRODUTO / SERVIÇO
                  </div>
                  <div className="border border-black overflow-x-auto">
                    <table className="w-full text-[7.5px] text-left border-collapse leading-tight">
                      <thead>
                        <tr className="bg-slate-50 border-b border-black text-[6.5px] uppercase font-bold text-slate-700">
                          <th className="p-1 border-r border-black w-14">CÓD. PROD.</th>
                          <th className="p-1 border-r border-black">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                          <th className="p-1 border-r border-black text-center w-14">NCM/SH</th>
                          <th className="p-1 border-r border-black text-center w-10">CSOSN</th>
                          <th className="p-1 border-r border-black text-center w-10">CFOP</th>
                          <th className="p-1 border-r border-black text-center w-8">UN</th>
                          <th className="p-1 border-r border-black text-right w-12">QTD</th>
                          <th className="p-1 border-r border-black text-right w-14">V. UNITÁRIO</th>
                          <th className="p-1 border-r border-black text-right w-14">V. TOTAL</th>
                          <th className="p-1 border-r border-black text-right w-12">BC ICMS</th>
                          <th className="p-1 border-r border-black text-right w-12">V. ICMS</th>
                          <th className="p-1 border-r border-black text-right w-10">V. IPI</th>
                          <th className="p-1 border-r border-black text-right w-10">ALIQ. ICMS</th>
                          <th className="p-1 text-right w-10">ALIQ. IPI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono">
                        {nota.itens.map((it, idx) => (
                          <tr key={it.id || idx} className="hover:bg-slate-50/50">
                            <td className="p-1 border-r border-black font-bold text-slate-900">{it.codigo || `PRD-${idx + 1}`}</td>
                            <td className="p-1 border-r border-black font-sans font-medium text-slate-800">{it.descricao}</td>
                            <td className="p-1 border-r border-black text-center">{it.ncm}</td>
                            <td className="p-1 border-r border-black text-center">{it.csosn || '102'}</td>
                            <td className="p-1 border-r border-black text-center">{it.cfop}</td>
                            <td className="p-1 border-r border-black text-center font-bold">{it.unidade || 'UN'}</td>
                            <td className="p-1 border-r border-black text-right">{formatQtd(it.quantidade)}</td>
                            <td className="p-1 border-r border-black text-right">{formatBRL(it.valorUnitario)}</td>
                            <td className="p-1 border-r border-black text-right font-bold text-slate-900">{formatBRL(it.valorTotal)}</td>
                            <td className="p-1 border-r border-black text-right">0,00</td>
                            <td className="p-1 border-r border-black text-right">0,00</td>
                            <td className="p-1 border-r border-black text-right">0,00</td>
                            <td className="p-1 border-r border-black text-right">0,00</td>
                            <td className="p-1 text-right">0,00</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 6. DADOS ADICIONAIS */}
                <div>
                  <div className="bg-slate-100 border border-black border-b-0 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                    DADOS ADICIONAIS
                  </div>
                  <div className="border border-black grid grid-cols-12 text-[7.5px] leading-relaxed">
                    <div className="col-span-8 p-1.5 border-r border-black text-slate-800">
                      <p className="font-bold text-slate-900 text-[8px]">INFORMAÇÕES COMPLEMENTARES:</p>
                      <p className="mt-0.5">
                        TRIB APROX 15,45% MUNICIPAL FONTE: IBPT PROCON 151 SCS QUADRA 8 EDIFICIO VENANCIO 2000 BLOCO B60 SALA 240 B 28,82
                      </p>
                      <p className="mt-0.5">
                        Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI e ICMS.
                        {nota.origemCodigo ? ` Ref Pedido/OS: ${nota.origemCodigo}.` : ''}
                      </p>
                      <p className="mt-1 font-mono text-[7px] text-slate-500">
                        Chave de Acesso: {formattedChave} • Protocolo SEFAZ: {nota.protocolo || '223260099625374'}
                      </p>
                    </div>
                    <div className="col-span-4 p-1.5 flex flex-col justify-between">
                      <span className="text-[7px] font-bold uppercase text-slate-500 block">RESERVADO AO FISCO</span>
                      <div className="h-10"></div>
                    </div>
                  </div>
                </div>

                {/* 7. RODAPÉ DE IMPRESSÃO */}
                <div className="text-[7px] text-slate-500 text-right pt-0.5">
                  DATA E HORA DA IMPRESSÃO: {formatDateTime()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between print:hidden flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Documento assinado digitalmente e validado pela SEFAZ.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="px-3 py-1.5 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5"
              title="Abrir em Nova Aba"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>Abrir Nova Aba</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5 shadow-2xs disabled:opacity-75"
              title="Imprimir DANFE ou Salvar em PDF"
            >
              {isPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span>{isPrinting ? 'Preparando...' : 'Imprimir / PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
