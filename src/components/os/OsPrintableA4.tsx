import React from 'react';
import { OrdemServico, PdvTransaction } from '../../server/types/os';
import { Printer, FileText, ArrowLeft, CheckCircle2, X, MessageSquare } from 'lucide-react';
import { formatDateBR } from '../../utils/formatters';
import { ApiService } from '../../services/api';
import { Client } from '../../server/types/client';
import { WhatsAppMessageModal } from './WhatsAppMessageModal';
import { getClientDisplayName } from '../../utils/clientSearch';

interface OsPrintableA4Props {
  os?: OrdemServico | null;
  pdvTx?: PdvTransaction | null;
  onClose?: () => void;
  initialDocType?: 'OS' | 'NF' | 'CUPOM';
  inlineMode?: boolean;
  hideActionBar?: boolean;
  hideDocTypes?: boolean;
  hidePrintWindow?: boolean;
  hideWhatsApp?: boolean;
  hidePrintOsF7?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  backButtonLabel?: string;
  isSidebarExpanded?: boolean;
}

const DanfeBarcodeSVG: React.FC = () => {
  const bars = [2, 5, 8, 12, 14, 17, 21, 24, 28, 31, 33, 37, 40, 44, 47, 51, 54, 58, 61, 65, 68, 72, 75, 79, 82, 86, 89, 93, 96, 100, 103, 107, 110, 114, 117, 121, 124, 128, 131, 135, 138, 142, 145, 149, 152, 156, 159, 163, 166, 170, 173, 177, 180, 184, 187, 191, 194, 198];
  return (
    <svg className="w-full h-8 my-0.5" viewBox="0 0 200 32" preserveAspectRatio="none">
      <rect x="0" y="0" width="200" height="32" fill="#ffffff" />
      <g fill="#000000">
        {bars.map((x, i) => (
          <rect key={i} x={x} y="1" width={i % 4 === 0 ? 2.5 : i % 2 === 0 ? 1.8 : 1} height="30" />
        ))}
      </g>
    </svg>
  );
};

export const OsPrintableA4: React.FC<OsPrintableA4Props> = ({
  os,
  pdvTx,
  onClose,
  initialDocType,
  inlineMode = false,
  hideActionBar = false,
  hideDocTypes = false,
  hidePrintWindow = false,
  hideWhatsApp = false,
  hidePrintOsF7 = false,
  showBackButton = false,
  onBack,
  backButtonLabel = 'VOLTAR',
  isSidebarExpanded: isSidebarExpandedProp,
}) => {
  if (!os && !pdvTx) return null;

  // Estado e sincronização da Sidebar para manter menu lateral e barra superior visíveis
  const [internalSidebarExpanded, setInternalSidebarExpanded] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('subligestao_sidebar_pinned') === 'true';
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    const handleCheckSidebar = () => {
      try {
        const isPinned = localStorage.getItem('subligestao_sidebar_pinned') === 'true';
        setInternalSidebarExpanded(isPinned);
      } catch {}
    };
    window.addEventListener('storage', handleCheckSidebar);
    window.addEventListener('subligestao_sidebar_toggle', handleCheckSidebar);
    return () => {
      window.removeEventListener('storage', handleCheckSidebar);
      window.removeEventListener('subligestao_sidebar_toggle', handleCheckSidebar);
    };
  }, []);

  const effectiveSidebarExpanded = isSidebarExpandedProp !== undefined ? isSidebarExpandedProp : internalSidebarExpanded;

  // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
  // O padrão unificado oficial de impressão de OS, VND e ORC é a folha A4 estruturada ('OS'),
  // mantendo modos alternativos (CUPOM / NF) perfeitamente acessíveis sob demanda.
  const [docType, setDocType] = React.useState<'OS' | 'NF' | 'CUPOM'>(
    initialDocType ? initialDocType : 'OS'
  );
  const [cupomWidth, setCupomWidth] = React.useState<'80mm' | '58mm'>('80mm');
  const [showWhatsAppModal, setShowWhatsAppModal] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (initialDocType) {
      setDocType(initialDocType);
    }
  }, [initialDocType]);

  const handlePrintOs = () => {
    setDocType('OS');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintNotaFiscal = () => {
    setDocType('NF');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintCupom = () => {
    setDocType('CUPOM');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Fallback Popup Print Window if iframe print is blocked
  const handleOpenPrintWindow = (type: 'OS' | 'NF' | 'CUPOM') => {
    setDocType(type);
    const printContent = document.getElementById('printable-a4-document');
    if (!printContent) return;

    const isCupom = type === 'CUPOM';
    const winWidth = isCupom ? (cupomWidth === '58mm' ? 380 : 450) : 900;
    const printWin = window.open('', '_blank', `width=${winWidth},height=900`);
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${type === 'CUPOM' ? 'Cupom Não Fiscal' : type === 'NF' ? 'Nota Fiscal' : ((os as any)?.tipoDocumento === 'ORCAMENTO' || os?.codigo?.toUpperCase().startsWith('ORC') ? 'Orçamento' : (pdvTx || os?.codigo?.toUpperCase().startsWith('VND')) ? 'Venda Direta' : 'Ordem de Serviço')} - ${codigoOS !== '---' ? codigoOS : codigoVenda}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page {
                size: ${isCupom ? `${cupomWidth === '58mm' ? '58mm' : '80mm'} auto` : 'A4 portrait'};
                margin: ${isCupom ? '1mm' : '8mm'};
              }
              @page landscape-art-page { size: A4 landscape; margin: 3mm !important; }
              @page portrait-art-page { size: A4 portrait; margin: 3mm !important; }
              body { background: white !important; color: black !important; font-family: monospace, sans-serif; padding: 0px; margin: 0px; }
              #printable-a4-document { width: 100% !important; margin: 0 !important; padding: 0 !important; }
              .print\\:hidden { display: none !important; }
              .page-break-always { page-break-before: always !important; break-before: page !important; clear: both !important; display: block !important; margin: 0 !important; padding: 3mm !important; }
              .print-landscape-art-page { page: landscape-art-page; page-break-before: always !important; break-before: page !important; margin: 0 !important; padding: 3mm !important; width: 100% !important; height: 100% !important; }
              .print-portrait-art-page { page: portrait-art-page; page-break-before: always !important; break-before: page !important; margin: 0 !important; padding: 3mm !important; width: 100% !important; height: 100% !important; }
              img { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            </style>
          </head>
          <body>
            <div>${printContent.innerHTML}</div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    } else {
      window.print();
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
      if (e.key === 'F7' && !hidePrintOsF7) {
        e.preventDefault();
        handlePrintOs();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hidePrintOsF7, onClose]);

  const logoUrl = '/images/logo-web.png';

  const [foundClient, setFoundClient] = React.useState<Client | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    const targetName = os?.clienteNome || pdvTx?.clienteNome;
    const targetDoc = os?.clienteCpfCnpj || pdvTx?.clienteCpfCnpj;

    if (targetName || targetDoc) {
      ApiService.getClients()
        .then((clients) => {
          if (!isMounted) return;
          const match = clients.find((c) => {
            const doc = c.type === 'PF' ? c.cpf : c.cnpj;
            const clientName = getClientDisplayName(c).toLowerCase();
            const targetNameClean = (targetName || '').trim().toLowerCase();

            const docMatch = !!(targetDoc && doc && doc.replace(/\D/g, '') === targetDoc.replace(/\D/g, '') && doc.replace(/\D/g, '').length > 0);
            const nameMatch = !!(targetNameClean && (
              clientName === targetNameClean ||
              (targetNameClean.length > 3 && clientName.includes(targetNameClean))
            ));
            return docMatch || nameMatch;
          });
          if (match) {
            setFoundClient(match);
          }
        })
        .catch((err) => console.error('Erro ao buscar cliente para A4:', err));
    }
    return () => {
      isMounted = false;
    };
  }, [os, pdvTx]);

  const formattedClientAddress = React.useMemo(() => {
    if (foundClient?.endereco) {
      const end = foundClient.endereco;
      return `${end.logradouro || ''}${end.numero ? `, Nº ${end.numero}` : ''}${end.complemento ? ` (${end.complemento})` : ''}${end.bairro ? ` - Bairro ${end.bairro}` : ''}${end.cidade ? `, ${end.cidade}` : ''}${end.estado ? `/${end.estado}` : ''}${end.cep ? ` - CEP: ${end.cep}` : ''}`;
    }
    if (os?.clienteEndereco || pdvTx?.clienteEndereco) {
      return os?.clienteEndereco || pdvTx?.clienteEndereco || '';
    }
    return 'Endereço não informado';
  }, [foundClient, os?.clienteEndereco, pdvTx?.clienteEndereco]);

  const clientBairro = foundClient?.endereco?.bairro || '—';
  const clientCep = foundClient?.endereco?.cep || '—';
  const clientCidade = foundClient?.endereco?.cidade || '—';
  const clientEstado = foundClient?.endereco?.estado || '—';
  const clientInscricaoEstadual = foundClient?.inscricaoEstadual || 'ISENTO';

  // Extract display values
  const isOrcamento = Boolean(
    (os as any)?.tipoDocumento === 'ORCAMENTO' ||
    (os as any)?.isOrcamento ||
    os?.codigo?.toUpperCase().startsWith('ORC') ||
    pdvTx?.osCodigo?.toUpperCase().startsWith('ORC')
  );

  const isVendaDireta = Boolean(
    !isOrcamento && (
      (os as any)?.tipoDocumento === 'VENDA_DIRETA' ||
      (os as any)?.isVendaDireta ||
      (pdvTx !== undefined && pdvTx !== null) ||
      (os?.codigo && os.codigo.toUpperCase().startsWith('VND')) ||
      (os?.codigo && os.codigo.toUpperCase().startsWith('PDV')) ||
      (pdvTx?.codigoVenda && pdvTx.codigoVenda.toUpperCase().startsWith('VND')) ||
      (pdvTx?.osCodigo && pdvTx.osCodigo.toUpperCase().startsWith('VND'))
    )
  );

  const rawOsCode = os?.codigo || pdvTx?.osCodigo || '';
  const codigoOS = (rawOsCode && (rawOsCode.toUpperCase().startsWith('OSS') || rawOsCode.toUpperCase().startsWith('OS') || rawOsCode.toUpperCase().startsWith('ORC'))) ? rawOsCode : '---';

  let codigoVenda = pdvTx?.codigoVenda || (os?.codigo && !os.codigo.toUpperCase().startsWith('OS') && !os.codigo.toUpperCase().startsWith('ORC') ? os.codigo : '');
  if (codigoVenda) {
    codigoVenda = codigoVenda.replace(/^CDV-?VND/i, 'VND');
  }

  if (!codigoVenda) {
    if (isOrcamento) {
      codigoVenda = '---';
    } else if (isVendaDireta) {
      codigoVenda = rawOsCode || pdvTx?.codigoVenda || 'VND00000001';
    } else if (codigoOS !== '---') {
      const osNum = codigoOS.replace(/^(OSS|OS)-?/i, '');
      codigoVenda = `CDV${osNum}`;
    } else {
      codigoVenda = 'VND00000001';
    }
  } else if (codigoOS !== '---' && !codigoVenda.toUpperCase().startsWith('CDV') && !isVendaDireta) {
    codigoVenda = codigoVenda.replace(/^(VND|PDV)-?/i, 'CDV');
  }

  if (codigoVenda.toUpperCase().startsWith('CDVVND') || codigoVenda.toUpperCase().startsWith('CDV-VND')) {
    codigoVenda = codigoVenda.replace(/^CDV-?VND/i, 'VND');
  }

  // Padrão Unificado de Nomenclaturas e Títulos para OS, VND e ORC
  const docTypeName = isOrcamento ? 'Orçamento' : isVendaDireta ? 'Venda Direta' : 'Ordem de Serviço';
  const docBadgeTitle = isOrcamento ? 'ORÇAMENTO / VIA DO CLIENTE' : isVendaDireta ? 'VENDA DIRETA / VIA DO CLIENTE' : 'ORDEM DE SERVIÇO / VIA DO CLIENTE';
  const docNumberLabel = isOrcamento ? 'Número do Orçamento:' : isVendaDireta ? 'Número da Venda:' : 'Número da OS:';
  const docNumberValue = isOrcamento
    ? (codigoOS !== '---' ? codigoOS : codigoVenda)
    : isVendaDireta
      ? (codigoVenda !== '---' ? codigoVenda : rawOsCode || 'VND00000001')
      : codigoOS;
  const docTypeLabel = isOrcamento ? 'TIPO DOCUMENTO:' : isVendaDireta ? 'TIPO DOCUMENTO:' : 'CÓDIGO VENDA :';
  const docTypeValue = isOrcamento ? 'ORÇAMENTO' : isVendaDireta ? 'VENDA DIRETA (PDV)' : codigoVenda;
  const docDateLabel = isOrcamento ? 'Data Emissão:' : 'Data Venda:';
  const docTotalLabel = isOrcamento ? 'TOTAL DO ORÇAMENTO:' : isVendaDireta ? 'TOTAL DA VENDA DIRETA:' : 'TOTAL FINAL DO PEDIDO:';
  const docSignatureLabel = `Assinatura do Cliente • Aceite de ${docTypeName}`;
  const rawDataVenda = os?.dataVenda || pdvTx?.data || new Date().toISOString();
  const dataVenda = formatDateBR(rawDataVenda);
  const vendedor = os?.operador || pdvTx?.operador || 'VENDEDOR';

  const clienteNome = os?.clienteNome || pdvTx?.clienteNome || 'Cliente Não Informado';
  const clienteCpfCnpj = os?.clienteCpfCnpj || pdvTx?.clienteCpfCnpj || '---';
  const clienteFone = os?.clienteTelefone || pdvTx?.clienteTelefone || foundClient?.telefone || foundClient?.celular || '---';
  const clienteEmail = os?.clienteEmail || pdvTx?.clienteEmail || '---';
  const prazoEntrega = formatDateBR(os?.prazoEntrega);

  const rawItens = (os?.itens && os.itens.length > 0) ? os.itens : (pdvTx?.itens && pdvTx.itens.length > 0) ? pdvTx.itens : [];
  const itens = Array.isArray(rawItens) ? rawItens : [];

  const subtotal = Number(os?.subtotal ?? pdvTx?.subtotal ?? (itens.reduce((acc, i) => acc + (Number(i.total) || 0), 0)));
  const desconto = Number(os?.desconto ?? pdvTx?.desconto ?? 0);
  const total = Number(os?.valorFinal ?? os?.valorTotal ?? pdvTx?.valorTotal ?? pdvTx?.valorFinal ?? (subtotal - desconto));

  // Extract payment display values
  const isPaid = os?.paymentStatus === 'pago' || pdvTx?.status === 'pago';
  const formaPagamento = pdvTx?.formaPagamento || os?.formaPagamento || (isPaid ? 'PAGO NO CAIXA PDV' : 'PENDENTE DE PAGAMENTO');
  const valorEntrada = pdvTx?.valorEntrada !== undefined ? Number(pdvTx.valorEntrada) : os?.valorEntrada !== undefined ? Number(os.valorEntrada) : undefined;
  const valorRestante = pdvTx?.valorRestante !== undefined ? Number(pdvTx.valorRestante) : os?.valorRestante !== undefined ? Number(os.valorRestante) : undefined;
  const formaEntrada = pdvTx?.formaPagamentoEntrada || os?.formaPagamentoEntrada || 'PIX / Dinheiro';
  const parcelasCartao = pdvTx?.parcelasCartao || os?.parcelasCartao || 1;

  const rawAnexos = os?.anexos || pdvTx?.anexos || [];
  const comprovanteUrlOS = os?.comprovanteUrl || pdvTx?.comprovanteUrl;

  // Filter out internal payment receipt images (comprovantes) and files designated strictly as PARA_IMPRESSAO from OS print document
  const anexos = rawAnexos.filter((item) => {
    if (comprovanteUrlOS && item.fileUrl === comprovanteUrlOS) {
      return false;
    }
    if ((item as any).type === 'COMPROVANTE') {
      return false;
    }
    if ((item as any).type === 'PARA_IMPRESSAO' || (item as any).isParaImpressao === true) {
      return false;
    }
    const labelLower = (item.label || '').toLowerCase();
    const nameLower = (item.fileName || '').toLowerCase();
    if (labelLower.includes('comprovante') || nameLower.includes('comprovante')) {
      return false;
    }
    if (labelLower.includes('para impressão') || labelLower.includes('para impressao')) {
      return false;
    }
    return true;
  });
  const sheetOrientation = (anexos[0]?.orientation as 'PORTRAIT' | 'LANDSCAPE') || 'PORTRAIT';
  const observacoes = os?.observacoes || pdvTx?.observacoes;

  // Group attachments into pages (max 6 images per sheet unless explicit page is assigned)
  const getArtPages = (items: typeof anexos) => {
    if (!items || items.length === 0) return [];

    const hasExplicitPageNumber = items.some((item) => item.page && item.page > 1);
    if (hasExplicitPageNumber) {
      const pagesMap: { [page: number]: typeof anexos } = {};
      items.forEach((item) => {
        const p = item.page || 1;
        if (!pagesMap[p]) pagesMap[p] = [];
        pagesMap[p].push(item);
      });
      const sortedPageKeys = Object.keys(pagesMap)
        .map(Number)
        .sort((a, b) => a - b);
      return sortedPageKeys.map((k) => pagesMap[k]);
    }

    // Auto-chunk 6 items per sheet
    const CHUNK_SIZE = 6;
    const chunks: (typeof anexos)[] = [];
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      chunks.push(items.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  };

  const artPages = getArtPages(anexos);

  // Fluxo de Produção conforme a escolha na Ordem de Serviço
  const fluxoProducaoFormatado = React.useMemo(() => {
    const rawStages = os?.fluxoProducao || (pdvTx as any)?.fluxoProducao;
    if (Array.isArray(rawStages) && rawStages.length > 0) {
      const filtered = rawStages.filter((s) => s && s !== 'Sistema');
      if (filtered.length > 0) {
        return filtered.join(' ➔ ');
      }
    }
    if (isVendaDireta) {
      return 'VENDA DIRETA / BALCÃO (PRONTA ENTREGA)';
    }
    if (isOrcamento) {
      return 'ORÇAMENTO (AGUARDANDO APROVAÇÃO)';
    }
    return 'NÃO HÁ FLUXO DE PRODUÇÃO PARA ESSA OS';
  }, [os?.fluxoProducao, pdvTx, isVendaDireta, isOrcamento]);

  // Nota Fiscal Data
  const chaveAcessoNF = `2326 0836 0478 1800 0107 5500 1000 00${codigoOS.replace(/\D/g, '').padStart(4, '0')} 2026 8273 6410`;
  const protocoloAutorizacao = `32326000${Math.floor(10000000 + Math.random() * 90000000)} - Autorizado o uso da NF-e/NFS-e`;
  const valorTributosIBPT = (total * 0.1345).toFixed(2);

  return (
    <div
      className={
        inlineMode
          ? "w-full flex flex-col items-center"
          : `fixed top-16 right-0 bottom-0 z-20 ${
              effectiveSidebarExpanded ? 'left-0 md:left-64' : 'left-0 md:left-16'
            } bg-slate-100 p-3 sm:p-6 overflow-y-auto flex flex-col items-center transition-all duration-300 ease-in-out`
      }
    >
      <style>{`
        @media print {
          @page {
            size: ${docType === 'CUPOM' ? `${cupomWidth === '58mm' ? '58mm' : '80mm'} auto` : 'A4 portrait'};
            margin: ${docType === 'CUPOM' ? '1mm' : '8mm'};
          }
          @page landscape-art-page {
            size: A4 landscape;
            margin: 3mm !important;
          }
          @page portrait-art-page {
            size: A4 portrait;
            margin: 3mm !important;
          }
          .print-landscape-art-page {
            page: landscape-art-page;
            page-break-before: always !important;
            break-before: page !important;
            margin: 0 !important;
            padding: 3mm !important;
            width: 100% !important;
            height: 100% !important;
          }
          .print-portrait-art-page {
            page: portrait-art-page;
            page-break-before: always !important;
            break-before: page !important;
            margin: 0 !important;
            padding: 3mm !important;
            width: 100% !important;
            height: 100% !important;
          }
          html, body, #root {
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .page-break-always {
            page-break-before: always !important;
            break-before: page !important;
            clear: both !important;
            display: block !important;
          }
          .fixed {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          .shadow-2xl, .shadow-xl, .shadow-md, .shadow-lg {
            box-shadow: none !important;
          }
          .border {
            border-color: #64748b !important;
          }
          img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            max-width: 100% !important;
            display: block !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      
      {/* ACTION BAR (NON-PRINTABLE) */}
      {!hideActionBar && (
        <div className="print:hidden w-full max-w-4xl bg-white border border-slate-200 rounded-2xl px-3 py-3 sm:px-3.5 mb-4 shadow-xl flex items-center gap-2.5 overflow-x-auto no-scrollbar">

          {/* BOTÃO VOLTAR */}
          {showBackButton && (
            <button
              type="button"
              onClick={onBack || onClose}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-blue-400" />
              <span>{backButtonLabel}</span>
            </button>
          )}

          {/* 1. MODO PADRÃO A4 */}
          {!hideDocTypes && (
            <button
              type="button"
              onClick={() => setDocType('OS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                docType === 'OS'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title="Padrão Oficial Unificado de Impressão (Folha A4)"
            >
              Modo: Padrão A4 ({isOrcamento ? 'ORÇ' : isVendaDireta ? 'VND' : 'OS'})
            </button>
          )}

          {/* 2. JANELA DE IMPRESSÃO */}
          {!hidePrintWindow && (
            <button
              type="button"
              onClick={() => handleOpenPrintWindow(docType)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Abrir página dedicada para impressão do sistema"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Janela de Impressão</span>
            </button>
          )}

          {/* 3. MODO CUPOM NÃO FISCAL */}
          {!hideDocTypes && (
            <>
              <button
                type="button"
                onClick={() => setDocType('CUPOM')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  docType === 'CUPOM'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="Alternativa para impressora térmica (80mm/58mm)"
              >
                Modo: CUPOM NÃO FISCAL
              </button>

              {/* LARGURA DO CUPOM */}
              {docType === 'CUPOM' && (
                <div className="flex items-center gap-1 border border-slate-200 p-0.5 rounded-xl bg-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCupomWidth('80mm')}
                    className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      cupomWidth === '80mm'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    80mm
                  </button>

                  <button
                    type="button"
                    onClick={() => setCupomWidth('58mm')}
                    className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      cupomWidth === '58mm'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    58mm
                  </button>
                </div>
              )}
            </>
          )}

          {/* 4. WHATSAPP */}
          {!hideWhatsApp && (
            <button
              type="button"
              onClick={() => setShowWhatsAppModal(true)}
              className="px-3.5 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 whitespace-nowrap shrink-0"
              title="Enviar mensagem personalizada via WhatsApp"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
          )}

          {/* 5. FECHAR — ALINHADO À DIREITA */}
          {onClose && !showBackButton && (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <X className="w-4 h-4 text-slate-500" />
              <span>FECHAR</span>
            </button>
          )}

        </div>
      )}

      {/* PAPER CONTAINER */}
      <div id="printable-a4-document" className="w-full max-w-4xl space-y-6 print:space-y-0 print:m-0 print:p-0 print:w-full">
        {docType === 'CUPOM' ? (
          /* ==============================================================
             CUPOM NÃO FISCAL (PADRÃO 80mm OU 58mm)
             ============================================================== */
          <div className={`bg-white text-slate-950 border border-slate-300 rounded-xl shadow-2xl p-4 font-mono text-xs mx-auto print:shadow-none print:border-none print:p-0 print:m-0 print:w-full leading-tight space-y-2.5 ${
            cupomWidth === '58mm' ? 'max-w-[270px]' : 'max-w-[340px]'
          }`}>
            {/* LOGOTIPO E DADOS DA EMPRESA */}
            <div className="text-center space-y-1 pb-2 border-b-2 border-dashed border-slate-900">
              <img
                src={logoUrl}
                alt="Logo Tecido Sublimado Fortaleza"
                className="h-10 w-auto mx-auto object-contain mb-1"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <h1 className="font-black text-xs sm:text-sm uppercase tracking-tight text-slate-950">
                TECIDO SUBLIMADO FORTALEZA
              </h1>
              <p className="text-[9.5px] font-bold text-slate-900 uppercase leading-snug">
                AVENIDA SENADOR FERNANDES TAVORA, 2305 – HENRIQUE JORGE, FORTALEZA - CE CEP: 60510291
              </p>
              <p className="text-[9.5px] font-bold text-slate-900 uppercase">
                TELEFONE: (85) 98425-1321 WHATSAPP: (85) 98425-1321
              </p>
              <p className="text-[9.5px] font-bold text-slate-900 uppercase">
                CNPJ: 36.047.818/0001-07 INSC: 061671967
              </p>
            </div>

            {/* MODO / TÍTULO E DADOS DA VENDA */}
            <div className="text-center space-y-1 pb-2 border-b border-dashed border-slate-900 text-[10.5px]">
              <div className="font-black text-xs uppercase tracking-wider bg-slate-900 text-white py-0.5 px-2 rounded print:bg-transparent print:text-slate-950 print:border print:border-slate-900">
                CUPOM NÃO FISCAL
              </div>
              <div className="flex justify-between font-bold pt-1">
                <span>COMPROVANTE:</span>
                <span className="font-black">{codigoVenda || codigoOS}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>DATA/HORA:</span>
                <span>{dataVenda} {pdvTx?.hora || ''}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>OPERADOR / VENDEDOR:</span>
                <span className="font-bold uppercase">{vendedor}</span>
              </div>
            </div>

            {/* DADOS DO CLIENTE COMPLETO */}
            <div className="space-y-1 pb-2 border-b border-dashed border-slate-900 text-[10px]">
              <div className="font-black text-[10.5px] uppercase tracking-wider text-slate-950 border-b border-slate-200 pb-0.5 mb-1">
                DADOS DO CLIENTE
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-700">NOME:</span>
                <span className="font-black text-right uppercase truncate ml-1">{clienteNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-700">CPF/CNPJ:</span>
                <span>{clienteCpfCnpj}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-700">TELEFONE:</span>
                <span>{clienteFone}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 block">ENDEREÇO:</span>
                <span className="text-[9.5px] leading-tight block text-slate-900 mt-0.5">{formattedClientAddress}</span>
              </div>
            </div>

            {/* ITENS DE PRODUTO */}
            <div className="space-y-1.5 pb-2 border-b border-dashed border-slate-900 text-[10px]">
              <div className="font-black text-[10.5px] uppercase tracking-wider text-slate-950 border-b border-slate-200 pb-0.5">
                ITENS DE PRODUTO
              </div>
              <div className="grid grid-cols-12 font-bold text-[9px] uppercase text-slate-700 border-b border-slate-300 pb-0.5">
                <span className="col-span-6">DESCRIÇÃO</span>
                <span className="col-span-2 text-center">QTD</span>
                <span className="col-span-4 text-right">TOTAL</span>
              </div>
              <div className="space-y-1 divide-y divide-slate-100">
                {itens.length === 0 ? (
                  <p className="text-center text-slate-500 py-1 italic">Nenhum item adicionado.</p>
                ) : (
                  itens.map((item, idx) => (
                    <div key={idx} className="pt-1 space-y-0.5">
                      <div className="font-bold text-slate-950 uppercase leading-snug">
                        {idx + 1}. {item.categoria ? `${item.categoria} - ${item.descricao}` : item.descricao}
                      </div>
                      {item.medidasProducao && (
                        <div className="text-[8px] font-mono text-slate-800 bg-slate-100 p-0.5 rounded border border-slate-300">
                          <div><strong>TAMPO:</strong> {item.medidasProducao.tampo?.largura} × {item.medidasProducao.tampo?.altura}</div>
                          <div><strong>FAIXA:</strong> {item.medidasProducao.faixa?.largura} × {item.medidasProducao.faixa?.altura}</div>
                          <div><strong>FAIXA BABADO:</strong> {item.medidasProducao.faixaBabado?.largura} × {item.medidasProducao.faixaBabado?.altura}</div>
                          {item.medidasProducao.ultimaFaixaBabado && (
                            <div><strong>ÚLTIMA FAIXA BABADO:</strong> {item.medidasProducao.ultimaFaixaBabado?.largura} × {item.medidasProducao.ultimaFaixaBabado?.altura}</div>
                          )}
                        </div>
                      )}
                      {(item.valorBaseCilindro !== undefined || item.tampCilindro !== undefined) && (
                        <div className="text-[8px] font-mono text-slate-800 bg-slate-100 p-0.5 rounded border border-slate-300">
                          <div><strong>CILINDRO:</strong> Larg: {item.medidaFrente !== undefined ? String(item.medidaFrente).replace('.', ',') : '-'}m × Alt: {item.medidaAltura !== undefined ? String(item.medidaAltura).replace('.', ',') : '-'}m | <strong>TAMPO:</strong> {item.tampCilindro !== undefined ? `${Number(item.tampCilindro).toFixed(2).replace('.', ',')}m` : '-'}</div>
                          {item.valorBaseCilindro !== undefined && <div><strong>BASE:</strong> R$ {Number(item.valorBaseCilindro).toFixed(2)} | <strong>VALOR TAMPO:</strong> R$ {Number(item.valorTampoCilindro || 0).toFixed(2)}</div>}
                        </div>
                      )}
                      <div className="grid grid-cols-12 text-[9.5px] text-slate-800">
                        <span className="col-span-6">
                          {item.quantidade} {item.unidade || 'UN'} x R$ {Number(item.valorUnitario || 0).toFixed(2)}
                          {item.desconto ? ` (-R$ ${Number(item.desconto || 0).toFixed(2)})` : ''}
                        </span>
                        <span className="col-span-6 text-right font-bold text-slate-950">
                          R$ {Number(item.total || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SUBTOTAL, DESCONTOS, ENTRADA, TOTAL */}
            <div className="space-y-1 pb-2 border-b border-dashed border-slate-900 text-[10.5px] font-bold">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>R$ {Number(subtotal || 0).toFixed(2)}</span>
              </div>
              {desconto > 0 && (
                <div className="flex justify-between text-emerald-800">
                  <span>DESCONTOS:</span>
                  <span>- R$ {Number(desconto || 0).toFixed(2)}</span>
                </div>
              )}
              {(valorEntrada !== undefined && valorEntrada > 0) && (
                <div className="flex justify-between text-blue-900">
                  <span>ENTRADA ({formaEntrada}):</span>
                  <span>R$ {Number(valorEntrada || 0).toFixed(2)}</span>
                </div>
              )}
              {(valorRestante !== undefined && valorRestante > 0) && (
                <div className="flex justify-between text-red-800">
                  <span>SALDO RESTANTE:</span>
                  <span>R$ {Number(valorRestante || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>FORMA PAGAMENTO:</span>
                <span className="uppercase">{formaPagamento}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm font-black text-slate-950 pt-1 border-t border-slate-900">
                <span>TOTAL:</span>
                <span>R$ {Number(total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* TEXTO DE RODAPÉ DE AGRADECIMENTO */}
            <div className="text-center pt-1 space-y-1 text-[9.5px]">
              <p className="font-black text-slate-950 uppercase tracking-wide">
                AGRADECEMOS A SUA PREFERÊNCIA!
              </p>
              <p className="font-bold text-slate-800">
                Tecido Sublimado Fortaleza • Volte Sempre!
              </p>
              <p className="text-[8px] text-slate-500 pt-0.5">
                Emissão: {new Date().toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        ) : docType === 'NF' ? (
          /* ==============================================================
             DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA (SEFAZ)
             ================================------------------------------ */
          <div className="bg-white text-slate-900 w-full p-4 rounded-xl shadow-2xl border border-slate-300 font-sans text-[10px] flex flex-col justify-between min-h-[960px] print:min-h-0 print:h-auto print:max-h-[270mm] print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:box-sizing-border-box print:overflow-hidden print:page-break-after-avoid space-y-1.5">
            {/* 1. CANHOTO DE RECEBIMENTO (TOPO SEFAZ) */}
            <div>
              <div className="border border-slate-900 text-[9px]">
                <div className="flex border-b border-slate-900">
                  <div className="p-1.5 flex-1 border-r border-slate-900 leading-tight">
                    <span className="font-bold">RECEBEMOS DE TECIDO SUBLIMADO INDÚSTRIA E COMÉRCIO LTDA</span> OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO.
                  </div>
                  <div className="p-1.5 w-36 text-center font-bold">
                    <div className="text-[10px] font-black">NF-e</div>
                    <div>Nº 000.00{codigoOS.replace(/\D/g, '').padStart(4, '0')}</div>
                    <div>SÉRIE 1</div>
                  </div>
                </div>
                <div className="flex text-[8px]">
                  <div className="p-1 w-32 border-r border-slate-900">
                    <span className="block font-bold">DATA DE RECEBIMENTO</span>
                    <div className="h-3"></div>
                  </div>
                  <div className="p-1 flex-1">
                    <span className="block font-bold">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
                    <div className="h-3"></div>
                  </div>
                </div>
              </div>
              <div className="border-b border-dashed border-slate-900 my-1 text-center text-[7px] text-slate-500">
                - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              </div>
            </div>

            {/* 2. CABEÇALHO PRINCIPAL DANFE SEFAZ */}
            <div className="border border-slate-900 text-[9px]">
              <div className="grid grid-cols-12 border-b border-slate-900">
                {/* QUADRO EMITENTE */}
                <div className="col-span-4 p-1.5 border-r border-slate-900 flex items-center gap-2">
                  <img src={logoUrl} alt="Logo" className="h-9 w-auto object-contain max-w-[45px]" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                  <div className="leading-tight">
                    <h2 className="font-black text-[10px] uppercase">TECIDO SUBLIMADO LTDA</h2>
                    <p className="text-[7.5px] font-semibold text-slate-800">
                      AV. SEN. FERNANDES TÁVORA, 2305<br/>
                      HENRIQUE JORGE - FORTALEZA - CE<br/>
                      CEP: 60510-291 - TEL: (85) 98425-1321
                    </p>
                  </div>
                </div>

                {/* QUADRO DANFE TITLE */}
                <div className="col-span-3 p-1 border-r border-slate-900 text-center flex flex-col justify-between leading-tight">
                  <div className="font-black text-xs">DANFE</div>
                  <div className="text-[7px] font-bold">DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA</div>
                  <div className="flex justify-center gap-2 text-[8px] my-0.5">
                    <span>0 - ENTRADA</span>
                    <span className="border border-slate-900 px-1 font-bold">1</span>
                    <span>1 - SAÍDA</span>
                  </div>
                  <div className="font-bold text-[8.5px]">
                    Nº 000.00{codigoOS.replace(/\D/g, '').padStart(4, '0')}<br/>
                    SÉRIE 1 — FOLHA 1/1
                  </div>
                </div>

                {/* QUADRO BARCODE + CHAVE */}
                <div className="col-span-5 p-1 flex flex-col justify-between leading-tight">
                  <div>
                    <DanfeBarcodeSVG />
                    <div className="text-[8px] font-mono font-bold text-center tracking-widest">
                      {chaveAcessoNF}
                    </div>
                  </div>
                  <div className="text-[6.5px] text-center border-t border-slate-400 pt-0.5">
                    Consulta de autenticidade no portal nacional da NF-e<br/>
                    <strong>www.nfe.fazenda.gov.br/portal</strong> ou no site da Sefaz Autorizadora
                  </div>
                </div>
              </div>

              {/* NATUREZA DA OPERAÇÃO & PROTOCOLO */}
              <div className="grid grid-cols-12 border-b border-slate-900">
                <div className="col-span-7 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">NATUREZA DA OPERAÇÃO</span>
                  <span className="font-bold uppercase text-[8px]">PRESTAÇÃO DE SERVIÇOS TÊXTEIS E SUBLIMAÇÃO</span>
                </div>
                <div className="col-span-5 p-1">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
                  <span className="font-bold text-[8px]">{protocoloAutorizacao}</span>
                </div>
              </div>

              {/* INSCRIÇÕES E CNPJ */}
              <div className="grid grid-cols-12">
                <div className="col-span-4 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">INSCRIÇÃO ESTADUAL</span>
                  <span className="font-bold text-[8px]">061671967</span>
                </div>
                <div className="col-span-4 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">INSC. ESTADUAL DO SUBST. TRIB.</span>
                  <span className="font-bold text-[8px]">-</span>
                </div>
                <div className="col-span-4 p-1">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">CNPJ</span>
                  <span className="font-bold text-[8px]">36.047.818/0001-07</span>
                </div>
              </div>
            </div>

            {/* 3. DESTINATÁRIO / REMETENTE */}
            <div className="border border-slate-900 text-[8.5px]">
              <div className="bg-slate-200 p-0.5 font-bold text-[7.5px] uppercase border-b border-slate-900">
                DESTINATÁRIO / REMETENTE
              </div>
              <div className="grid grid-cols-12 border-b border-slate-900">
                <div className="col-span-7 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">NOME / RAZÃO SOCIAL</span>
                  <span className="font-bold uppercase text-[8.5px]">{clienteNome}</span>
                </div>
                <div className="col-span-3 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">CNPJ / CPF</span>
                  <span className="font-bold text-[8.5px]">{clienteCpfCnpj}</span>
                </div>
                <div className="col-span-2 p-1">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">DATA DA EMISSÃO</span>
                  <span className="font-bold text-[8.5px]">{dataVenda}</span>
                </div>
              </div>

              <div className="grid grid-cols-12 border-b border-slate-900">
                <div className="col-span-6 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">ENDEREÇO</span>
                  <span className="font-bold text-[8px]">{formattedClientAddress}</span>
                </div>
                <div className="col-span-3 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">BAIRRO / DISTRITO</span>
                  <span className="font-bold text-[8px]">{clientBairro}</span>
                </div>
                <div className="col-span-1 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">CEP</span>
                  <span className="font-bold text-[7.5px]">{clientCep}</span>
                </div>
                <div className="col-span-2 p-1">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">DATA SAÍDA / ENTRADA</span>
                  <span className="font-bold text-[8.5px]">{dataVenda}</span>
                </div>
              </div>

              <div className="grid grid-cols-12">
                <div className="col-span-4 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">MUNICÍPIO</span>
                  <span className="font-bold text-[8px]">{clientCidade}</span>
                </div>
                <div className="col-span-3 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">FONE / FAX</span>
                  <span className="font-bold text-[8px]">{clienteFone}</span>
                </div>
                <div className="col-span-1 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">UF</span>
                  <span className="font-bold text-[8px]">{clientEstado}</span>
                </div>
                <div className="col-span-2 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">INSCRIÇÃO ESTADUAL</span>
                  <span className="font-bold text-[8px]">{clientInscricaoEstadual}</span>
                </div>
                <div className="col-span-2 p-1">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">HORA DA SAÍDA</span>
                  <span className="font-bold text-[8px]">10:00</span>
                </div>
              </div>
            </div>

            {/* 4. FATURA / DADOS DO PAGAMENTO */}
            <div className="border border-slate-900 text-[8.5px]">
              <div className="bg-slate-200 p-0.5 font-bold text-[7.5px] uppercase border-b border-slate-900">
                FATURA / DADOS DO PAGAMENTO
              </div>
              <div className="p-1 flex flex-wrap items-center justify-between font-bold text-[8px]">
                <span>PARCELA: 001/01</span>
                <span>VENCIMENTO: {prazoEntrega}</span>
                <span>VALOR: R$ {total.toFixed(2)}</span>
                <span>FORMA: {formaPagamento} ({isPaid ? 'QUITADO' : 'PENDENTE'})</span>
              </div>
            </div>

            {/* 5. CÁLCULO DO IMPOSTO */}
            <div className="border border-slate-900 text-[8.5px]">
              <div className="bg-slate-200 p-0.5 font-bold text-[7.5px] uppercase border-b border-slate-900">
                CÁLCULO DO IMPOSTO
              </div>
              <div className="grid grid-cols-5 border-b border-slate-900">
                <div className="p-0.5 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">BASE DE CÁLCULO DO ICMS</span>
                  <span className="font-bold text-[8px]">R$ 0,00</span>
                </div>
                <div className="p-0.5 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">VALOR DO ICMS</span>
                  <span className="font-bold text-[8px]">R$ 0,00</span>
                </div>
                <div className="p-0.5 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">BASE CÁLCULO ICMS ST</span>
                  <span className="font-bold text-[8px]">R$ 0,00</span>
                </div>
                <div className="p-0.5 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">VALOR DO ICMS ST</span>
                  <span className="font-bold text-[8px]">R$ 0,00</span>
                </div>
                <div className="p-0.5">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">VALOR TOTAL DOS PRODUTOS</span>
                  <span className="font-bold text-[8px]">R$ {subtotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-5">
                <div className="p-0.5 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">VALOR DO FRETE</span>
                  <span className="font-bold text-[8px]">R$ 0,00</span>
                </div>
                <div className="p-0.5 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">VALOR DO SEGURO</span>
                  <span className="font-bold text-[8px]">R$ 0,00</span>
                </div>
                <div className="p-0.5 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">DESCONTO</span>
                  <span className="font-bold text-[8px]">R$ {desconto.toFixed(2)}</span>
                </div>
                <div className="p-0.5 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">OUTRAS DESP. ACESSÓRIAS</span>
                  <span className="font-bold text-[8px]">R$ 0,00</span>
                </div>
                <div className="p-0.5 bg-slate-100">
                  <span className="block text-[6.5px] font-bold text-slate-900 uppercase">VALOR TOTAL DA NOTA</span>
                  <span className="font-black text-[9px] text-slate-900">R$ {total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* 6. TRANSPORTADOR / VOLUMES */}
            <div className="border border-slate-900 text-[8.5px]">
              <div className="bg-slate-200 p-0.5 font-bold text-[7.5px] uppercase border-b border-slate-900">
                TRANSPORTADOR / VOLUMES TRANSPORTADOS
              </div>
              <div className="grid grid-cols-12 border-b border-slate-900">
                <div className="col-span-5 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">RAZÃO SOCIAL</span>
                  <span className="font-bold text-[8px]">RETIRADA NO LOCAL / O MESMO</span>
                </div>
                <div className="col-span-2 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">FRETE POR CONTA</span>
                  <span className="font-bold text-[8px]">9-SEM FRETE</span>
                </div>
                <div className="col-span-1 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">CÓD ANTT</span>
                  <span className="font-bold text-[8px]">-</span>
                </div>
                <div className="col-span-2 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">PLACA DO VEÍCULO</span>
                  <span className="font-bold text-[8px]">-</span>
                </div>
                <div className="col-span-2 p-1">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">CNPJ / CPF</span>
                  <span className="font-bold text-[8px]">-</span>
                </div>
              </div>

              <div className="grid grid-cols-12 border-b border-slate-900">
                <div className="col-span-6 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">ENDEREÇO</span>
                  <span className="font-bold text-[8px]">-</span>
                </div>
                <div className="col-span-3 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">MUNICÍPIO</span>
                  <span className="font-bold text-[8px]">FORTALEZA</span>
                </div>
                <div className="col-span-1 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">UF</span>
                  <span className="font-bold text-[8px]">CE</span>
                </div>
                <div className="col-span-2 p-1">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">INSCRIÇÃO ESTADUAL</span>
                  <span className="font-bold text-[8px]">-</span>
                </div>
              </div>

              <div className="grid grid-cols-12">
                <div className="col-span-2 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">QUANTIDADE</span>
                  <span className="font-bold text-[8px]">{itens.reduce((sum, item) => sum + (item.quantidade || 0), 0)}</span>
                </div>
                <div className="col-span-2 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">ESPÉCIE</span>
                  <span className="font-bold text-[8px]">VOLUMES</span>
                </div>
                <div className="col-span-2 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">MARCA</span>
                  <span className="font-bold text-[8px]">TS</span>
                </div>
                <div className="col-span-2 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">NUMERAÇÃO</span>
                  <span className="font-bold text-[8px]">-</span>
                </div>
                <div className="col-span-2 p-1 border-r border-slate-900">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">PESO BRUTO</span>
                  <span className="font-bold text-[8px]">1.500 KG</span>
                </div>
                <div className="col-span-2 p-1">
                  <span className="block text-[6.5px] font-bold text-slate-600 uppercase">PESO LÍQUIDO</span>
                  <span className="font-bold text-[8px]">1.450 KG</span>
                </div>
              </div>
            </div>

            {/* 7. TABELA DE PRODUTOS / SERVIÇOS */}
            <div className="border border-slate-900 text-[8px]">
              <div className="bg-slate-200 p-0.5 font-bold text-[7.5px] uppercase border-b border-slate-900">
                DADOS DOS PRODUTOS / SERVIÇOS
              </div>
              <table className="w-full border-collapse text-[7.5px]">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-900 text-left">
                    <th className="p-0.5 border-r border-slate-900">CÓDIGO</th>
                    <th className="p-0.5 border-r border-slate-900">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                    <th className="p-0.5 border-r border-slate-900 text-center">NCM/SH</th>
                    <th className="p-0.5 border-r border-slate-900 text-center">CST</th>
                    <th className="p-0.5 border-r border-slate-900 text-center">CFOP</th>
                    <th className="p-0.5 border-r border-slate-900 text-center">UNID</th>
                    <th className="p-0.5 border-r border-slate-900 text-right">QTD</th>
                    <th className="p-0.5 border-r border-slate-900 text-right">V.UNIT</th>
                    <th className="p-0.5 border-r border-slate-900 text-right">V.TOTAL</th>
                    <th className="p-0.5 border-r border-slate-900 text-right">BC ICMS</th>
                    <th className="p-0.5 border-r border-slate-900 text-right">V.ICMS</th>
                    <th className="p-0.5 text-center">ALÍQ ICMS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-400 font-medium">
                  {itens.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-2 text-center text-slate-400">
                        Nenhum item informado.
                      </td>
                    </tr>
                  ) : (
                    itens.map((item, idx) => (
                      <tr key={idx} className="leading-tight">
                        <td className="p-0.5 border-r border-slate-900 font-mono font-bold">{item.codigo}</td>
                        <td className="p-0.5 border-r border-slate-900 font-bold">
                          <div>{item.categoria ? `${item.categoria} - ${item.descricao}` : item.descricao}</div>
                          {item.medidasProducao && (
                            <div className="text-[6.5px] text-slate-700 font-mono font-normal">
                              Prod: Tampo [{item.medidasProducao.tampo?.largura}×{item.medidasProducao.tampo?.altura}] | Faixa [{item.medidasProducao.faixa?.largura}×{item.medidasProducao.faixa?.altura}] | Babado [{item.medidasProducao.faixaBabado?.largura}×{item.medidasProducao.faixaBabado?.altura}]{item.medidasProducao.ultimaFaixaBabado ? ` | Última Faixa [${item.medidasProducao.ultimaFaixaBabado?.largura}×${item.medidasProducao.ultimaFaixaBabado?.altura}]` : ''}
                            </div>
                          )}
                          {(item.valorBaseCilindro !== undefined || item.tampCilindro !== undefined) && (
                            <div className="text-[6.5px] text-slate-700 font-mono font-normal">
                              Cilindro: Larg [{item.medidaFrente !== undefined ? String(item.medidaFrente).replace('.', ',') : '-'}m] | Alt [{item.medidaAltura !== undefined ? String(item.medidaAltura).replace('.', ',') : '-'}m] | Tampo [{item.tampCilindro !== undefined ? `${Number(item.tampCilindro).toFixed(2).replace('.', ',')}m` : '-'}]
                            </div>
                          )}
                          {(item.calculoCubo !== undefined || item.valorCubo !== undefined) && (
                            <div className="text-[6.5px] text-slate-700 font-mono font-normal">
                              Cubo/Mesa Veste: Medida [{item.medidaFrente !== undefined ? String(item.medidaFrente).replace('.', ',') : '-'}m] | Alt [{item.medidaAltura !== undefined ? String(item.medidaAltura).replace('.', ',') : '-'}m] | Tampo [{(item.medidaTampo !== undefined ? String(item.medidaTampo) : (item.medidaFrente !== undefined ? String(item.medidaFrente) : '-')).replace('.', ',')}m] | Cálc [{item.calculoCubo !== undefined ? `${Number(item.calculoCubo).toFixed(2).replace('.', ',')}m` : '-'}]
                            </div>
                          )}
                        </td>
                        <td className="p-0.5 border-r border-slate-900 text-center">6006.32.00</td>
                        <td className="p-0.5 border-r border-slate-900 text-center">0102</td>
                        <td className="p-0.5 border-r border-slate-900 text-center">5101</td>
                        <td className="p-0.5 border-r border-slate-900 text-center">{item.unidade || 'UN'}</td>
                        <td className="p-0.5 border-r border-slate-900 text-right font-bold">{item.quantidade}</td>
                        <td className="p-0.5 border-r border-slate-900 text-right">{Number(item.valorUnitario || 0).toFixed(2)}</td>
                        <td className="p-0.5 border-r border-slate-900 text-right font-bold">{Number(item.total || 0).toFixed(2)}</td>
                        <td className="p-0.5 border-r border-slate-900 text-right">0.00</td>
                        <td className="p-0.5 border-r border-slate-900 text-right">0.00</td>
                        <td className="p-0.5 text-center">0%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 8. DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES */}
            <div className="border border-slate-900 text-[8px]">
              <div className="bg-slate-200 p-0.5 font-bold text-[7.5px] uppercase border-b border-slate-900">
                DADOS ADICIONAIS
              </div>
              <div className="grid grid-cols-12 min-h-[60px]">
                <div className="col-span-9 p-1 border-r border-slate-900 space-y-0.5">
                  <span className="block font-bold text-[6.5px] text-slate-600 uppercase">INFORMAÇÕES COMPLEMENTARES</span>
                  <p className="leading-tight font-semibold text-[7.5px] text-slate-800">
                    DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI.<br/>
                    VALOR APROXIMADO DOS TRIBUTOS (LEI 12.741/2012 - IBPT): R$ {valorTributosIBPT} (13.45%).<br/>
                    ORDEM DE SERVIÇO REF: {codigoOS} | VENDEDOR: {vendedor}<br/>
                    {observacoes && `OBSERVAÇÕES: ${observacoes}`}
                  </p>
                </div>
                <div className="col-span-3 p-1">
                  <span className="block font-bold text-[6.5px] text-slate-600 uppercase">RESERVADO AO FISCO</span>
                </div>
              </div>
            </div>

            <div className="pt-2 text-center text-[7.5px] text-slate-500 font-semibold border-t border-slate-300">
              SubliGestão ERP Tecido Sublimado Fortaleza • Emissão DANFE NF-e Eletrônica Sefaz • {new Date().toLocaleString('pt-BR')}
            </div>
          </div>
        ) : (
          /* ==============================================================
             ORDEM DE SERVIÇO / VIA DO CLIENTE LAYOUT
             ============================================================== */
          <div className="bg-white text-slate-900 w-full p-5 rounded-xl shadow-2xl border border-slate-300 font-sans text-[11px] flex flex-col justify-between min-h-[960px] print:min-h-0 print:h-auto print:max-h-[270mm] print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:box-sizing-border-box print:overflow-hidden print:page-break-after-avoid space-y-3">
            {/* 1. TOPO DA FOLHA (CABEÇALHO DA EMPRESA) */}
            <div className="border-b-2 border-slate-900 pb-2 space-y-0.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={logoUrl}
                    alt="Logo Tecido Sublimado"
                    className="h-10 w-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div>
                    <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none">
                      TECIDO SUBLIMADO
                    </h1>
                    <p className="text-[9px] font-bold text-slate-600">
                      Qualidade e Precisão em Sublimação e Impressão Têxtil
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block text-[11px] font-black px-2.5 py-0.5 rounded text-white bg-blue-600">
                    {docBadgeTitle}
                  </span>
                </div>
              </div>

              <p className="text-[10px] font-semibold text-slate-800 mt-1">
                AVENIDA SENADOR FERNANDES TAVORA, 2305 – HENRIQUE JORGE, FORTALEZA - CE CEP: 60510291
              </p>
              <div className="flex flex-wrap items-center justify-between text-[10px] font-semibold text-slate-800">
                <span>FONE: (85) 98425-1321 WHATSAPP: (85) 98425-1321</span>
                <span>CNPJ: 36.047.818/0001-07 INSC: 061671967</span>
              </div>
            </div>

            {/* 2. DADOS DA VENDA / DOCUMENTO */}
            <div className="border border-slate-300 px-3 py-1.5 rounded-lg bg-slate-100/80 font-bold text-slate-900">
              <div className="grid grid-cols-4 gap-2 text-[11px] items-center">
                <div>
                  <span className="text-[9px] uppercase text-slate-500 block font-bold">
                    {docNumberLabel}
                  </span>
                  <span className="text-xs font-black text-blue-700">{docNumberValue}</span>
                </div>

                <div>
                  <span className="text-[9px] uppercase text-slate-500 block font-bold">
                    {docTypeLabel}
                  </span>
                  <span>{docTypeValue}</span>
                </div>

                <div>
                  <span className="text-[9px] uppercase text-slate-500 block font-bold">
                    {docDateLabel}
                  </span>
                  <span>{dataVenda}</span>
                </div>

                <div>
                  <span className="text-[9px] uppercase text-slate-500 block font-bold">Vendedor:</span>
                  <span>{vendedor}</span>
                </div>
              </div>
            </div>

            {/* 3. DADOS DO CLIENTE */}
            <div className="border border-slate-300 p-2.5 rounded-lg space-y-1 bg-slate-50/50">
              <h3 className="text-[10px] font-black text-slate-900 uppercase border-b border-slate-200 pb-0.5">
                3. Dados do Cliente
              </h3>
              <div className="space-y-1 text-[11px]">
                <div className="flex flex-wrap items-center gap-x-4">
                  <p><strong className="text-slate-600">Nome:</strong> {clienteNome}</p>
                  <p><strong className="text-slate-600">CPF:</strong> {clienteCpfCnpj}</p>
                  <p><strong className="text-slate-600">Telefone/Whatsapp:</strong> {clienteFone}</p>
                </div>
                <div>
                  <p><strong className="text-slate-600">Endereço:</strong> {formattedClientAddress}</p>
                </div>
              </div>
            </div>

            {/* 4. TABELA DE PRODUTOS */}
            <div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase mb-1">4. Tabela de Produtos</h3>
              <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-black uppercase text-[9px] border-b border-slate-300">
                    <th className="p-1.5 border-r border-slate-300">Código</th>
                    <th className="p-1.5 border-r border-slate-300">Descrição</th>
                    <th className="p-1.5 border-r border-slate-300 text-center">Un</th>
                    <th className="p-1.5 border-r border-slate-300 text-center">Qtd</th>
                    <th className="p-1.5 border-r border-slate-300 text-right">Prc Unit</th>
                    <th className="p-1.5 border-r border-slate-300 text-right">Desc</th>
                    <th className="p-1.5 border-r border-slate-300 text-right">Prc Med.</th>
                    <th className="p-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-medium">
                  {itens.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-3 text-center text-slate-400">
                        Nenhum item listado nesta ordem.
                      </td>
                    </tr>
                  ) : (
                    itens.map((item, idx) => {
                      const itemTotalCalc = item.total !== undefined ? Number(item.total) : Math.max(0, (Number(item.quantidade) || 1) * Number(item.valorUnitario || 0) - Number(item.desconto || 0));
                      const effectivePrcMed = (item.precoMedio && item.precoMedio > 0 && item.precoMedio !== Math.round(Number(item.valorUnitario || 0) * 0.8))
                        ? Number(item.precoMedio)
                        : (Number(item.quantidade) > 0 ? (itemTotalCalc / Number(item.quantidade)) : Number(item.valorUnitario || 0));

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50">
                          <td className="p-1.5 border-r border-slate-300 font-mono font-bold">{item.codigo}</td>
                          <td className="p-1.5 border-r border-slate-300 font-bold">
                            <div>{item.categoria ? `${item.categoria} - ${item.descricao}` : item.descricao}</div>
                            {item.medidasProducao && (
                              <div className="mt-1 p-1 bg-slate-100 border border-slate-300 rounded text-[8px] text-slate-800 space-y-0.5 font-normal">
                                <div className="font-bold text-slate-900 uppercase flex items-center justify-between">
                                  <span>📐 Medidas para Produção (Corte e Costura):</span>
                                  {item.qtdBabado && <span className="bg-slate-200 px-1 rounded font-bold">{item.qtdBabado} Babados</span>}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 font-mono text-[7.5px]">
                                  <div><strong>TAMPO:</strong> {item.medidasProducao.tampo?.largura || '-'} × {item.medidasProducao.tampo?.altura || '-'}</div>
                                  <div><strong>FAIXA:</strong> {item.medidasProducao.faixa?.largura || '-'} × {item.medidasProducao.faixa?.altura || '-'}</div>
                                  <div><strong>FAIXA BABADO:</strong> {item.medidasProducao.faixaBabado?.largura || '-'} × {item.medidasProducao.faixaBabado?.altura || '-'}</div>
                                  {item.medidasProducao.ultimaFaixaBabado && (
                                    <div><strong>ÚLTIMA FAIXA:</strong> {item.medidasProducao.ultimaFaixaBabado?.largura || '-'} × {item.medidasProducao.ultimaFaixaBabado?.altura || '-'}</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 text-center">{item.unidade}</td>
                          <td className="p-1.5 border-r border-slate-300 text-center font-bold">{item.quantidade}</td>
                          <td className="p-1.5 border-r border-slate-300 text-right">
                            R$ {Number(item.valorUnitario || 0).toFixed(2)}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 text-right text-emerald-700">
                            R$ {Number(item.desconto || 0).toFixed(2)}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 text-right text-slate-700 font-semibold">
                            R$ {effectivePrcMed.toFixed(2)}
                          </td>
                          <td className="p-1.5 text-right font-black">R$ {itemTotalCalc.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 6. FORMA DE PAGAMENTO */}
            <div className="border border-slate-300 rounded-lg p-2.5 space-y-1.5 bg-slate-50">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <h3 className="text-[10px] font-black text-slate-900 uppercase">
                  Forma de Pagamento
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Status: {isPaid ? 'PAGO' : 'PENDENTE'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-bold">
                <div>
                  <span className="block text-[9px] text-slate-500 uppercase">Forma de Pagamento</span>
                  <span className="text-slate-900 font-extrabold">{formaPagamento}</span>
                </div>

                <div>
                  <span className="block text-[9px] text-slate-500 uppercase">Valor de Entrada</span>
                  <span className="text-emerald-700 font-black">R$ {Number(valorEntrada || 0).toFixed(2)}</span>
                </div>

                <div>
                  <span className="block text-[9px] text-slate-500 uppercase">Descontos (Desc.)</span>
                  <span className="text-emerald-700 font-black">R$ {Number(desconto || 0).toFixed(2)}</span>
                </div>

                <div>
                  <span className="block text-[9px] text-slate-500 uppercase">Saldo Restante</span>
                  <span className="text-amber-700 font-black">R$ {Number(valorRestante !== undefined ? valorRestante : Math.max(0, total - (valorEntrada || 0))).toFixed(2)}</span>
                </div>

                <div>
                  <span className="block text-[9px] text-slate-500 uppercase">Prazo de Entrega</span>
                  <span className="text-blue-700 font-black">{prazoEntrega}</span>
                </div>
              </div>

              <div className="border-t border-slate-300 pt-1 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-900">{docTotalLabel}</span>
                <span className="text-base font-black text-slate-900">R$ {Number(total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* FLUXO DE PRODUÇÃO */}
            <div className="py-1.5 px-2 text-xs sm:text-[13px] text-slate-900 font-bold border-t border-b border-slate-300 bg-slate-50/80 rounded leading-normal flex flex-wrap items-center gap-1.5">
              <span className="text-slate-900 font-black uppercase mr-1 tracking-tight shrink-0">
                FLUXO DE PRODUÇÃO:
              </span>
              <span className="text-blue-900 font-extrabold tracking-tight">
                {fluxoProducaoFormatado}
              </span>
            </div>

            {/* OBSERVAÇÕES GERAIS */}
            <div className="border border-slate-300 rounded-lg p-2.5 space-y-1 bg-slate-50/50 break-inside-avoid">
              <h4 className="text-[10px] font-black text-slate-900 uppercase border-b border-slate-200 pb-0.5">
                OBSERVAÇÕES GERAIS:
              </h4>
              {observacoes ? (
                <p className="text-[11px] font-semibold text-slate-800 whitespace-pre-wrap leading-tight">
                  {observacoes}
                </p>
              ) : (
                <p className="text-[10px] font-semibold text-slate-400 italic">
                  Sem observações adicionais para esta ordem.
                </p>
              )}
            </div>

            {/* RODAPÉ DO DOCUMENTO */}
            <div className="mt-auto pt-6 border-t-2 border-slate-300 text-center space-y-1.5 break-inside-avoid">
              <div className="pt-6">
                <div className="w-80 mx-auto border-t border-slate-900 pt-1" />
                <p className="text-[11px] font-black text-slate-900 uppercase mt-1">
                  {clienteNome} — CPF/CNPJ: {clienteCpfCnpj}
                </p> 
                <p className="text-[9px] text-slate-700 font-bold uppercase tracking-wider mt-1">
                  {docSignatureLabel}
                </p>
              </div>
              <p className="text-[8px] text-slate-400 mt-2">
                SubliGestão ERP Tecido Sublimado Fortaleza • Documento Emitido em {new Date().toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        )}
        {/* FIM DA FOLHA 1 */}

        {/* PÁGINAS ISOLADAS DE IMPRESSÃO: ARTES DA PRODUÇÃO (ANEXOS DIVIDIDOS EM FOLHAS DE IMPRESSÃO) */}
        {artPages.map((pageItems, pageIdx) => {
          const pageSheetOrientation = (pageItems[0]?.orientation as 'PORTRAIT' | 'LANDSCAPE') || sheetOrientation;
          return (
            <div
              key={`art-page-${pageIdx}`}
              className={`bg-white p-5 rounded-xl shadow-2xl border border-slate-300 print:shadow-none print:border-none print:p-0 print:m-0 page-break-always ${
                pageSheetOrientation === 'LANDSCAPE' ? 'print-landscape-art-page' : 'print-portrait-art-page'
              }`}
              style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
            >
              {/* ARTES CANVAS / DIAGRAMAÇÃO DE IMPRESSÃO (MARGENS MÍNIMAS DE IMPRESSÃO) */}
              <div
                className={`relative bg-white overflow-hidden mx-auto transition-all print:w-full print:h-full print:max-w-none print:m-0 print:p-0 print:border-none ${
                  pageSheetOrientation === 'LANDSCAPE'
                    ? 'w-full max-w-[840px] aspect-[297/210]'
                    : 'w-full max-w-[620px] aspect-[210/297]'
                }`}
              >
                {pageItems.map((anexo, idx) => {
                  const posX = anexo.x ?? (10 + (idx % 3) * 28);
                  const posY = anexo.y ?? (10 + Math.floor(idx / 3) * 28);
                  const widthPercent = (anexo.width ?? 25) * (anexo.scale ?? 1);
                  const heightPercent = (anexo.height ?? 25) * (anexo.scale ?? 1);
                  const rotation = anexo.rotation ?? 0;

                  return (
                    <div
                      key={anexo.id || idx}
                      className="absolute pointer-events-none"
                      style={{
                        left: `${posX}%`,
                        top: `${posY}%`,
                        width: `${widthPercent}%`,
                        height: `${heightPercent}%`,
                        transform: `rotate(${rotation}deg)`,
                      }}
                    >
                      <img
                        src={anexo.fileUrl}
                        alt={anexo.fileName}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* WHATSAPP MESSAGE FLOATING MODAL */}
      <WhatsAppMessageModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        os={
          os ||
          ({
            id: pdvTx?.id || 'synthetic-os',
            codigo: codigoOS !== '---' ? codigoOS : codigoVenda,
            dataVenda: rawDataVenda,
            operador: vendedor,
            clienteNome,
            clienteCpfCnpj,
            clienteTelefone: clienteFone !== '---' ? clienteFone : '',
            clienteEmail: clienteEmail !== '---' ? clienteEmail : '',
            prazoEntrega: os?.prazoEntrega || new Date().toISOString(),
            fluxoProducao: [],
            estagioAtual: 'Concluído',
            itens: (pdvTx?.itens || []).map((it) => ({
              id: it.id,
              codigo: it.codigo,
              descricao: it.descricao,
              unidade: it.unidade || 'UN',
              quantidade: it.quantidade,
              valorUnitario: it.valorUnitario,
              precoMedio: it.precoMedio || it.valorUnitario,
              desconto: 0,
              total: it.total,
            })),
            anexos: [],
            subtotal: pdvTx?.subtotal || total,
            desconto: pdvTx?.desconto || 0,
            valorFinal: pdvTx?.valorTotal || total,
            paymentStatus: 'pago',
          } as OrdemServico)
        }
        initialMode={os?.paymentStatus === 'pendente' ? 'LEMBRETE_COBRANCA' : 'AGRADECIMENTO'}
        customSellerName={vendedor}
      />
    </div>
  );
};
