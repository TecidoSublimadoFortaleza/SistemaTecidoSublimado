import React, { useState, useEffect } from 'react';
import { OrdemServico, PaymentMethodType, PdvTransaction, OsAttachment } from '../../server/types/os';
import { ApiService } from '../../services/api';
import { OsPrintableA4 } from './OsPrintableA4';
import { compressImageFile } from '../../utils/imageCompressor';
import { getLoggedUserAndPerfil, isUserAuthorizedForOs, createOsHistoryEntry } from '../../utils/userPermissions';
import { NotificationService } from '../../utils/notificationService';
import {
  CreditCard,
  DollarSign,
  QrCode,
  Wallet,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  User,
  ShoppingBag,
  Printer,
  Sparkles,
  Lock,
  Upload,
  FileCheck,
  Image as ImageIcon,
} from 'lucide-react';

interface CaixaPdvModalProps {
  os?: OrdemServico | null;
  onClose: () => void;
  onPaymentSuccess?: (tx: PdvTransaction) => void;
  isSidebarExpanded?: boolean;
}

export const CaixaPdvModal: React.FC<CaixaPdvModalProps> = ({
  os,
  onClose,
  onPaymentSuccess,
  isSidebarExpanded = false,
}) => {
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethodType>('Dinheiro');
  
  // Entrada state
  const [valorEntrada, setValorEntrada] = useState<string>('');
  const [formaEntrada, setFormaEntrada] = useState<string>('PIX');

  // Balance settlement state (for OS created with entry payment)
  const [formaPagamentoRestante, setFormaPagamentoRestante] = useState<PaymentMethodType>('PIX');

  // Cartao state
  const [parcelasCartao, setParcelasCartao] = useState<number>(1);

  // Discount state
  const [tipoDesconto, setTipoDesconto] = useState<'VALOR' | 'PERCENTUAL'>('VALOR');
  const [descontoInput, setDescontoInput] = useState<string>('0');

  // Receipt Upload State (Comprovante de pagamento)
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);
  const [comprovanteFileName, setComprovanteFileName] = useState<string>('');
  const [isUploadingComprovante, setIsUploadingComprovante] = useState<boolean>(false);

  // Prefill from OS if available
  useEffect(() => {
    if (os) {
      if (os.desconto && os.desconto > 0) {
        setDescontoInput(os.desconto.toString());
      }
      if (os.valorEntrada && os.valorEntrada > 0) {
        setValorEntrada(os.valorEntrada.toString());
        setFormaPagamento('Com Entrada');
      }
      if (os.formaPagamento) {
        setFormaPagamento(os.formaPagamento as PaymentMethodType);
      }
      if (os.comprovanteUrl) {
        setComprovanteUrl(os.comprovanteUrl);
        setComprovanteFileName('comprovante_anexo.png');
      }
    }
  }, [os]);

  // Confirmation Alert Modal State
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Finished Transaction State for A4 Print View
  const [completedTx, setCompletedTx] = useState<PdvTransaction | null>(null);
  const [completedOs, setCompletedOs] = useState<OrdemServico | null>(null);

  // Logged-in user operator name
  const getLoggedOperator = () => {
    try {
      const stored = localStorage.getItem('subligestao_user_profile') || localStorage.getItem('subligestao_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.name) return u.name;
        if (u?.nome) return u.nome;
        if (u?.username) return u.username;
      }
    } catch {}
    return 'VENDEDOR MATRIZ';
  };

  const userLoggedInfo = getLoggedUserAndPerfil();
  const loggedUser = userLoggedInfo.name;
  const loggedRole = userLoggedInfo.role;
  const osOperator = os?.operador;
  const isExistingOs = Boolean(os && os.id && !os.id.startsWith('TEMP-'));
  
  // Authorized: Creator of OS OR Developer, CEO, Gerente Geral, Supervisor, Conferente, Recepção
  const isAuthorized = !isExistingOs || isUserAuthorizedForOs(osOperator);
  
  const currentOperator = loggedUser;

  // Check if OS was saved with entry payment and is pending balance settlement
  const osValorEntradaOriginal = os?.valorEntrada || 0;
  const isQuitacaoRestante = Boolean(isExistingOs && osValorEntradaOriginal > 0 && os?.paymentStatus === 'pendente');

  // Calculations
  const subtotal = os?.subtotal || 0;
  
  const discountVal = () => {
    const num = parseFloat(descontoInput.replace(',', '.')) || 0;
    if (tipoDesconto === 'PERCENTUAL') {
      return (subtotal * num) / 100;
    }
    return num;
  };

  const valorTotalCalculado = os?.valorFinal || Math.max(0, subtotal - discountVal());
  const entradaNum = parseFloat(valorEntrada.replace(',', '.')) || 0;
  const saldoRestanteCalculado = formaPagamento === 'Com Entrada' ? Math.max(0, valorTotalCalculado - entradaNum) : 0;
  
  // If settling remaining payment on an existing OS with entry:
  const saldoRestanteParaQuitar = os?.valorRestante ?? Math.max(0, valorTotalCalculado - osValorEntradaOriginal);

  // Handle receipt upload
  const handleComprovanteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingComprovante(true);
    setErrorMessage('');
    try {
      const compressed = await compressImageFile(file);
      setComprovanteUrl(compressed);
      setComprovanteFileName(file.name);
    } catch {
      setErrorMessage('Erro ao carregar e comprimir o comprovante de pagamento.');
    } finally {
      setIsUploadingComprovante(false);
    }
  };

  const [isSavingAttachmentOnly, setIsSavingAttachmentOnly] = useState<boolean>(false);

  const handleSaveOnlyAttachment = async () => {
    if (!os?.id || os.id.startsWith('TEMP-')) {
      setErrorMessage('Esta opção é para salvar anexo em Ordens de Serviço já existentes.');
      return;
    }
    if (!comprovanteUrl) {
      setErrorMessage('Por favor, envie ou selecione a imagem do comprovante antes de salvar.');
      return;
    }
    setIsSavingAttachmentOnly(true);
    setErrorMessage('');
    try {
      let currentAnexos = os.anexos || [];
      if (!currentAnexos.some((a) => a.fileUrl === comprovanteUrl)) {
        const receiptAttachment: OsAttachment = {
          id: `COMPROVANTE-${Date.now()}`,
          type: 'COMPROVANTE',
          label: `Comprovante de Pagamento Anexado (${comprovanteFileName || 'comprovante.png'})`,
          fileName: comprovanteFileName || 'comprovante.png',
          fileUrl: comprovanteUrl,
          uploadedAt: new Date().toISOString(),
        };
        currentAnexos = [...currentAnexos, receiptAttachment];
      }

      const historyEntry = createOsHistoryEntry(
        'Anexou comprovante de pagamento',
        `Comprovante (${comprovanteFileName || 'comprovante.png'}) anexado sem alterar a forma ou valor de pagamento.`
      );
      const updatedHistory = [...(os.historicoEdicoes || []), historyEntry];

      const updatedOs = await ApiService.updateOs(os.id, {
        comprovanteUrl: comprovanteUrl,
        anexos: currentAnexos,
        historicoEdicoes: updatedHistory,
      });

      if (updatedOs) {
        setCompletedOs(updatedOs);
      }
      if (onPaymentSuccess) {
        onPaymentSuccess({} as any);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar o anexo do comprovante.');
    } finally {
      setIsSavingAttachmentOnly(false);
    }
  };

  const handleFinalizePayment = async () => {
    setErrorMessage('');

    // MODE 1: Finalize remaining payment balance for an OS created with entry payment
    if (isQuitacaoRestante) {
      setIsSubmitting(true);
      try {
        const osIdToUpdate = os!.id;
        let existingAnexos = os?.anexos || [];

        // If a new receipt was uploaded during settlement, append it as attachment
        if (comprovanteUrl && !existingAnexos.some((a) => a.fileUrl === comprovanteUrl)) {
          const receiptAttachment: OsAttachment = {
            id: `COMPROVANTE-${Date.now()}`,
            type: 'COMPROVANTE',
            label: `Comprovante Saldo Restante (${formaPagamentoRestante})`,
            fileName: comprovanteFileName || 'comprovante_saldo.png',
            fileUrl: comprovanteUrl,
            uploadedAt: new Date().toISOString(),
          };
          existingAnexos = [...existingAnexos, receiptAttachment];
        }

        const payloadTx = {
          osId: osIdToUpdate,
          osCodigo: os?.codigo,
          clienteNome: os?.clienteNome || 'Cliente Balcão',
          clienteCpfCnpj: os?.clienteCpfCnpj || '',
          itens: os?.itens || [],
          anexos: existingAnexos,
          observacoes: os?.observacoes || '',
          formaPagamento: 'Com Entrada' as PaymentMethodType,
          valorEntrada: osValorEntradaOriginal,
          formaPagamentoEntrada: os?.formaPagamentoEntrada || 'PIX',
          valorRestante: 0,
          formaPagamentoRestante,
          comprovanteUrl: comprovanteUrl || undefined,
          parcelasCartao: formaPagamentoRestante === 'Cartão de Crédito' ? parcelasCartao : undefined,
          subtotal: os?.subtotal || 0,
          desconto: os?.desconto || 0,
          valorTotal: os?.valorFinal || 0,
          status: 'pago' as const,
          operador: currentOperator,
        };

        const newTx = await ApiService.createPdvTransaction(payloadTx);

        const updatedOs = await ApiService.updateOs(osIdToUpdate, {
          paymentStatus: 'pago',
          status: 'Pago',
          valorRestante: 0,
          formaPagamentoRestante,
          comprovanteUrl: comprovanteUrl || os?.comprovanteUrl,
          anexos: existingAnexos,
          pdvTransactionId: newTx.id,
          dataQuitacao: new Date().toISOString(),
          eraPendencia: true,
        });

        setCompletedOs(updatedOs || os!);
        setCompletedTx(newTx);
        setShowConfirmModal(false);
        if (onPaymentSuccess) {
          onPaymentSuccess(newTx);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao finalizar quitação do saldo restante.');
        setShowConfirmModal(false);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // MODE 2: Regular Payment Finalization (Full or New Entry Payment)
    if (formaPagamento === 'Com Entrada') {
      if (entradaNum <= 0) {
        setErrorMessage('Para pagamento com entrada, informe um valor de entrada maior que zero.');
        setShowConfirmModal(false);
        return;
      }
      if (entradaNum >= valorTotalCalculado) {
        setErrorMessage('O valor de entrada não pode ser maior ou igual ao total. Para quitação integral, selecione outra forma.');
        setShowConfirmModal(false);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const isPaidFull = formaPagamento !== 'Com Entrada';
      
      let finalOsId = os?.id;
      let activeOsObj = os;
      let currentAnexos = os?.anexos || [];

      // Append payment receipt if uploaded
      if (comprovanteUrl && !currentAnexos.some((a) => a.fileUrl === comprovanteUrl)) {
        const receiptAttachment: OsAttachment = {
          id: `COMPROVANTE-${Date.now()}`,
          type: 'COMPROVANTE',
          label: `Comprovante Pagamento (${formaPagamento})`,
          fileName: comprovanteFileName || 'comprovante_pagamento.png',
          fileUrl: comprovanteUrl,
          uploadedAt: new Date().toISOString(),
        };
        currentAnexos = [...currentAnexos, receiptAttachment];
      }

      // If OS is temporary/unsaved, create real OS on server first
      const isNewlyCreated = !finalOsId || finalOsId.startsWith('TEMP-');
      if (isNewlyCreated) {
        const clientName = os?.clienteNome || 'Cliente Balcão';
        const createdOs = await ApiService.createOs({
          codigo: os?.codigo,
          operador: currentOperator,
          clienteId: os?.clienteId,
          clienteNome: clientName,
          clienteCpfCnpj: os?.clienteCpfCnpj || '',
          clienteTelefone: os?.clienteTelefone || '',
          clienteEmail: os?.clienteEmail || '',
          prazoEntrega: os?.prazoEntrega,
          fluxoProducao: os?.fluxoProducao,
          itens: os?.itens || [],
          anexos: currentAnexos,
          observacoes: os?.observacoes || '',
          subtotal: os?.subtotal || 0,
          desconto: discountVal(),
          valorFinal: valorTotalCalculado,
          formaPagamento,
          paymentStatus: isPaidFull ? 'pago' : 'pendente',
          valorEntrada: formaPagamento === 'Com Entrada' ? entradaNum : undefined,
          formaPagamentoEntrada: formaPagamento === 'Com Entrada' ? formaEntrada : undefined,
          valorRestante: formaPagamento === 'Com Entrada' ? saldoRestanteCalculado : undefined,
          parcelasCartao: formaPagamento === 'Cartão de Crédito' ? parcelasCartao : undefined,
          comprovanteUrl: comprovanteUrl || undefined,
        });
        finalOsId = createdOs.id;
        activeOsObj = createdOs;
        NotificationService.notifyOsCreated(createdOs, currentOperator);
      }

      const payload = {
        osId: finalOsId,
        osCodigo: activeOsObj?.codigo || os?.codigo,
        clienteNome: activeOsObj?.clienteNome || os?.clienteNome || 'Cliente Balcão',
        clienteCpfCnpj: activeOsObj?.clienteCpfCnpj || os?.clienteCpfCnpj || '',
        itens: activeOsObj?.itens || os?.itens || [],
        anexos: currentAnexos,
        observacoes: activeOsObj?.observacoes || os?.observacoes || '',
        formaPagamento,
        valorEntrada: formaPagamento === 'Com Entrada' ? entradaNum : undefined,
        formaPagamentoEntrada: formaPagamento === 'Com Entrada' ? formaEntrada : undefined,
        valorRestante: formaPagamento === 'Com Entrada' ? saldoRestanteCalculado : undefined,
        parcelasCartao: formaPagamento === 'Cartão de Crédito' ? parcelasCartao : undefined,
        comprovanteUrl: comprovanteUrl || undefined,
        subtotal,
        desconto: discountVal(),
        valorTotal: valorTotalCalculado,
        status: isPaidFull ? ('pago' as const) : ('pendente' as const),
        operador: currentOperator,
      };

      const newTx = await ApiService.createPdvTransaction(payload);
      
      // Notify payment only if it was an existing OS being paid (new OS already notified via notifyOsCreated)
      if (activeOsObj && !isNewlyCreated) {
        NotificationService.notifyOsPaid(
          activeOsObj,
          formaPagamento,
          valorTotalCalculado,
          currentOperator
        );
      }
      
      // Update OS status & payment fields if linked
      if (finalOsId && !finalOsId.startsWith('TEMP-')) {
        try {
          const updatedOs = await ApiService.updateOs(finalOsId, {
            paymentStatus: isPaidFull ? 'pago' : 'pendente',
            pdvTransactionId: newTx.id,
            formaPagamento,
            valorEntrada: formaPagamento === 'Com Entrada' ? entradaNum : undefined,
            formaPagamentoEntrada: formaPagamento === 'Com Entrada' ? formaEntrada : undefined,
            valorRestante: formaPagamento === 'Com Entrada' ? saldoRestanteCalculado : undefined,
            parcelasCartao: formaPagamento === 'Cartão de Crédito' ? parcelasCartao : undefined,
            comprovanteUrl: comprovanteUrl || undefined,
            anexos: currentAnexos,
          });
          if (updatedOs) {
            activeOsObj = updatedOs;
          }
        } catch {}
      }

      setCompletedOs(activeOsObj);
      setCompletedTx(newTx);
      setShowConfirmModal(false);
      if (onPaymentSuccess) {
        onPaymentSuccess(newTx);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao finalizar pagamento no Caixa PDV.');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Printable A4 if completed
  if (completedTx) {
    return (
      <OsPrintableA4
        os={completedOs || os}
        pdvTx={completedTx}
        initialDocType="OS"
        isSidebarExpanded={isSidebarExpanded}
        onClose={onClose}
      />
    );
  }

  // OPERATOR RESTRICTION GUARD
  if (!isAuthorized) {
    return (
      <div
        className={`fixed top-16 right-0 bottom-0 z-20 bg-slate-950/80 backdrop-blur-md p-4 overflow-hidden flex items-center justify-center transition-all duration-300 ease-in-out ${
          isSidebarExpanded ? 'left-64' : 'left-16'
        }`}
      >
        <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center space-y-5">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <span className="px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-full tracking-wider">
              Acesso Restrito - Caixa PDV
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-2">
              Perfil Não Autorizado para esta OS
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Esta Ordem de Serviço (<strong className="text-slate-900 font-extrabold">{os?.codigo}</strong>) foi criada pelo operador{' '}
              <strong className="text-blue-700 font-black">{osOperator}</strong>.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Apenas o criador da OS ou usuários com perfil autorizado (<strong className="text-slate-700 font-bold">Developer, CEO, Gerente Geral, Supervisor, Conferente e Recepção</strong>) possuem acesso para movimentações no caixa.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-1.5 font-medium text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold">Operador Criador da OS:</span>
              <span className="font-extrabold text-slate-900">{osOperator}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold">Seu Usuário Logado:</span>
              <span className="font-extrabold text-slate-900">{loggedUser}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold">Seu Perfil Atual:</span>
              <span className="font-extrabold text-red-600">{loggedRole}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
          >
            Voltar ao Painel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed top-16 right-0 bottom-0 z-20 bg-slate-100 p-2 sm:p-4 overflow-hidden flex flex-col transition-all duration-300 ease-in-out ${
        isSidebarExpanded ? 'md:left-64 left-0' : 'md:left-16 left-0'
      }`}
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-lg w-full h-full overflow-hidden flex flex-col">
        {/* TOP BAR */}
        <div className="bg-[#2563EB] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl">
              <ShoppingBag className="w-6 h-6 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-cyan-400 text-slate-950 text-[10px] font-black uppercase rounded">
                  VENDAS DIRETAS
                </span>
                <span className="text-xs text-cyan-200 font-bold">• {os?.codigo || 'Venda Direta'}</span>
              </div>
              <h2 className="text-lg font-black tracking-tight mt-0.5">
                {isQuitacaoRestante
                  ? 'Quitação do Saldo Restante da Ordem de Serviço'
                  : 'Módulo de Checkout e Integração Financeira'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ERROR MESSAGE BANNER */}
        {errorMessage && (
          <div className="bg-red-50 border-b border-red-200 p-3 px-6 text-red-900 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* BODY CONTENT - SPLIT INTO TWO COLUMNS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: OS DETAILS & PRODUCT LIST (7 COLS) */}
          <div className="lg:col-span-7 space-y-4">
            {/* SALES HEADER INFO */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-semibold">
              <div>
                <span className="block text-[10px] font-extrabold text-slate-400 uppercase">Data & Hora</span>
                <span className="text-slate-900 font-bold flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div>
                <span className="block text-[10px] font-extrabold text-slate-400 uppercase">Operador Autorizado</span>
                <span className="text-slate-900 font-bold flex items-center gap-1 mt-0.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  {currentOperator}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <span className="block text-[10px] font-extrabold text-slate-400 uppercase">Cliente / Empresa</span>
                <strong className="text-blue-700 block truncate mt-0.5">
                  {os?.clienteNome || 'Cliente Balcão'}
                </strong>
                <span className="text-[10px] text-slate-500">{os?.clienteCpfCnpj || 'Sem CPF'}</span>
              </div>
            </div>

            {/* PRODUCT LIST TABLE */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 font-black text-xs text-slate-800 uppercase tracking-wide">
                Itens da Ordem de Serviço
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] font-extrabold uppercase">
                      <th className="p-2.5">Descrição</th>
                      <th className="p-2.5 text-center">UN</th>
                      <th className="p-2.5 text-center">Qtd</th>
                      <th className="p-2.5 text-right">Val. Unit</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                    {os?.itens && os.itens.length > 0 ? (
                      os.itens.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">
                            {item.categoria ? `${item.categoria} - ${item.descricao}` : item.descricao}
                          </td>
                          <td className="p-2.5 text-center text-slate-500">{item.unidade}</td>
                          <td className="p-2.5 text-center font-bold">{item.quantidade}</td>
                          <td className="p-2.5 text-right">R$ {item.valorUnitario.toFixed(2)}</td>
                          <td className="p-2.5 text-right font-black text-blue-600">
                            R$ {item.total.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          Nenhum item adicionado à OS.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: PAYMENT METHODS & DISCOUNTS (5 COLS) */}
          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* MODE 1: SETTLEMENT OF REMAINING BALANCE (WHEN ENTRY WAS ALREADY PAID) */}
              {isQuitacaoRestante ? (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-amber-600" />
                      <h3 className="text-xs font-black text-amber-900 uppercase tracking-wide">
                        Quitação de Saldo Restante
                      </h3>
                    </div>
                    <p className="text-[11px] text-amber-800 font-medium">
                      Esta venda foi iniciada com pagamento de entrada. Selecione como o cliente efetuará o pagamento do restante do valor.
                    </p>
                    <div className="pt-2 border-t border-amber-200 text-xs font-bold space-y-1">
                      <div className="flex justify-between text-amber-950">
                        <span>Valor Total da OS:</span>
                        <span>R$ {valorTotalCalculado.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>Entrada Paga Inicialmente ({os?.formaPagamentoEntrada || 'Entrada'}):</span>
                        <span>- R$ {osValorEntradaOriginal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-red-600 text-sm font-black pt-1 border-t border-amber-300">
                        <span>SALDO PENDENTE A QUITAR:</span>
                        <span>R$ {saldoRestanteParaQuitar.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">
                    Forma de Pagamento do Saldo Restante
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Dinheiro', label: 'Dinheiro', icon: DollarSign },
                      { id: 'PIX', label: 'PIX', icon: QrCode },
                      { id: 'Cartão de Débito', label: 'Débito', icon: CreditCard },
                      { id: 'Cartão de Crédito', label: 'Crédito', icon: CreditCard },
                    ].map((item) => {
                      const IconComp = item.icon;
                      const isSel = formaPagamentoRestante === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFormaPagamentoRestante(item.id as PaymentMethodType)}
                          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            isSel
                              ? 'bg-[#2563EB] text-white border-blue-600 shadow-md scale-[1.02]'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                          }`}
                        >
                          <IconComp className={`w-4 h-4 ${isSel ? 'text-cyan-300' : 'text-slate-500'}`} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {formaPagamentoRestante === 'Cartão de Crédito' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                      <label className="block text-[10px] font-bold text-blue-900 uppercase">
                        Quantidade de Parcelas no Crédito
                      </label>
                      <select
                        value={parcelasCartao}
                        onChange={(e) => setParcelasCartao(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-900"
                      >
                        {[1, 2, 3, 4, 5, 6, 10, 12].map((p) => (
                          <option key={p} value={p}>
                            {p}x de R$ {(saldoRestanteParaQuitar / p).toFixed(2)} {p === 1 ? '(À Vista)' : 'sem juros'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                /* MODE 2: STANDARD PAYMENT SELECTION (FULL OR WITH ENTRY) */
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">
                    Forma de Pagamento
                  </h3>

                  {/* PAYMENT METHOD SELECTOR GRID */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Dinheiro', label: 'Dinheiro', icon: DollarSign },
                      { id: 'PIX', label: 'PIX', icon: QrCode },
                      { id: 'Com Entrada', label: 'Com Entrada', icon: Wallet },
                      { id: 'Cartão de Débito', label: 'Débito', icon: CreditCard },
                      { id: 'Cartão de Crédito', label: 'Crédito', icon: CreditCard },
                    ].map((item) => {
                      const IconComp = item.icon;
                      const isSel = formaPagamento === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFormaPagamento(item.id as PaymentMethodType)}
                          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            isSel
                              ? 'bg-[#2563EB] text-white border-blue-600 shadow-md scale-[1.02]'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                          }`}
                        >
                          <IconComp className={`w-4 h-4 ${isSel ? 'text-cyan-300' : 'text-slate-500'}`} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* SPECIFIC OPTIONS: COM ENTRADA */}
                  {formaPagamento === 'Com Entrada' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                      <span className="block text-[11px] font-black text-amber-900 uppercase">
                        Configuração de Entrada
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">
                            Valor da Entrada (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorEntrada}
                            onChange={(e) => setValorEntrada(e.target.value)}
                            placeholder="Ex: 100.00"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">
                            Forma da Entrada
                          </label>
                          <select
                            value={formaEntrada}
                            onChange={(e) => setFormaEntrada(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                          >
                            <option value="PIX">PIX</option>
                            <option value="Dinheiro">Dinheiro</option>
                            <option value="Débito">Débito</option>
                            <option value="Crédito">Crédito</option>
                          </select>
                        </div>
                      </div>

                      <div className="text-[11px] font-bold text-amber-900 pt-1 flex justify-between border-t border-amber-200">
                        <span>Saldo Restante a Pagar na Entrega:</span>
                        <strong className="text-red-600">R$ {saldoRestanteCalculado.toFixed(2)}</strong>
                      </div>
                    </div>
                  )}

                  {/* SPECIFIC OPTIONS: CARTÃO DE CRÉDITO PARCELAS */}
                  {formaPagamento === 'Cartão de Crédito' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                      <label className="block text-[10px] font-bold text-blue-900 uppercase">
                        Quantidade de Parcelas
                      </label>
                      <select
                        value={parcelasCartao}
                        onChange={(e) => setParcelasCartao(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-900"
                      >
                        {[1, 2, 3, 4, 5, 6, 10, 12].map((p) => (
                          <option key={p} value={p}>
                            {p}x de R$ {(valorTotalCalculado / p).toFixed(2)} {p === 1 ? '(À Vista)' : 'sem juros'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* DISCOUNT INPUT FIELD */}
                  {!isExistingOs && (
                    <div className="space-y-1.5 bg-white border border-slate-200 rounded-xl p-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>Conceder Desconto</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setTipoDesconto('VALOR')}
                            className={`px-2 py-0.5 text-[10px] font-black rounded ${
                              tipoDesconto === 'VALOR' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            R$
                          </button>
                          <button
                            type="button"
                            onClick={() => setTipoDesconto('PERCENTUAL')}
                            className={`px-2 py-0.5 text-[10px] font-black rounded ${
                              tipoDesconto === 'PERCENTUAL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            %
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={descontoInput}
                        onChange={(e) => setDescontoInput(e.target.value)}
                        placeholder="0,00"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* REQUIREMENT 3: COMPROVANTE DE PAGAMENTO ATTACHMENT */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-blue-600" />
                    <span>Anexar Comprovante de Pagamento</span>
                  </label>
                  {comprovanteUrl && (
                    <button
                      type="button"
                      onClick={() => { setComprovanteUrl(null); setComprovanteFileName(''); }}
                      className="text-[10px] text-red-600 hover:underline font-bold"
                    >
                      Remover
                    </button>
                  )}
                </div>

                {comprovanteUrl ? (
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <div
                      className="w-14 h-14 rounded overflow-hidden border border-slate-300 shrink-0 shadow-sm"
                      style={{
                        backgroundImage:
                          'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
                        backgroundSize: '10px 10px',
                        backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                        backgroundColor: '#f8fafc',
                      }}
                    >
                      <img src={comprovanteUrl} alt="Comprovante" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0 text-xs">
                      <span className="block font-bold text-slate-800 truncate">{comprovanteFileName || 'Comprovante'}</span>
                      <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        Pronto para anexar à OS
                      </span>
                    </div>
                  </div>
                ) : (
                  <label className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-center gap-2 cursor-pointer transition-all">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>{isUploadingComprovante ? 'Processando Imagem...' : 'Enviar Imagem do Comprovante (PNG/PDF)'}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleComprovanteUpload}
                      className="hidden"
                    />
                  </label>
                )}

                {/* BOTÃO PARA SALVAR ANEXO SEM MEXER NA FORMA DE PAGAMENTO */}
                {isExistingOs && (
                  <div className="pt-2 border-t border-slate-200 space-y-1">
                    <button
                      type="button"
                      onClick={handleSaveOnlyAttachment}
                      disabled={isSavingAttachmentOnly || !comprovanteUrl}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                        comprovanteUrl
                          ? 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                      title="Salvar apenas o anexo do comprovante sem alterar a forma de pagamento registrada"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{isSavingAttachmentOnly ? 'Salvando Anexo...' : 'Salvar Apenas Anexo (Manter Pagamento)'}</span>
                    </button>
                    <p className="text-[10px] text-slate-500 text-center font-semibold leading-tight">
                      * Caso tenha reaberto a OS para incluir o comprovante esquecido, clique neste botão para não alterar o caixa ou forma de pagamento.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* TOTALS & FINALIZATION BUTTON */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="space-y-1 text-xs font-semibold text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
                {isQuitacaoRestante ? (
                  <>
                    <div className="flex justify-between">
                      <span>Valor Total da OS:</span>
                      <span className="font-bold text-slate-900">R$ {valorTotalCalculado.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Entrada Já Paga ({os?.formaPagamentoEntrada || 'PIX'}):</span>
                      <span>- R$ {osValorEntradaOriginal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t-2 border-slate-900">
                      <span>SALDO RESTANTE A QUITAR AGORA:</span>
                      <span className="text-blue-700 text-base">R$ {saldoRestanteParaQuitar.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>Subtotal dos Produtos:</span>
                      <span className="font-bold text-slate-900">R$ {subtotal.toFixed(2)}</span>
                    </div>

                    {discountVal() > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Desconto Concedido (Desc.):</span>
                        <span>- R$ {discountVal().toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-900 font-extrabold pt-1 border-t border-slate-100">
                      <span>Valor Total do Pedido:</span>
                      <span>R$ {valorTotalCalculado.toFixed(2)}</span>
                    </div>

                    {entradaNum > 0 && (
                      <div className="flex justify-between text-amber-700 font-bold">
                        <span>Valor de Entrada Recebido:</span>
                        <span>- R$ {entradaNum.toFixed(2)}</span>
                      </div>
                    )}

                    {entradaNum > 0 ? (
                      <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t-2 border-slate-900">
                        <span>SALDO RESTANTE A PAGAR:</span>
                        <span className="text-red-600 text-base">R$ {saldoRestanteCalculado.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t-2 border-slate-900">
                        <span>TOTAL A PAGAR:</span>
                        <span className="text-blue-700 text-base">R$ {valorTotalCalculado.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4 text-cyan-300" />
                <span>
                  {isQuitacaoRestante
                    ? `Quitar Saldo Restante (${formaPagamentoRestante})`
                    : 'Finalizar Pagamento (ENTER)'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER METADATA BAR */}
        <div className="bg-slate-100 border-t border-slate-200 p-2.5 px-6 text-[11px] font-semibold text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span>Operador Autorizado: <strong className="text-slate-900">{currentOperator}</strong></span>
            <span>Filial: <strong className="text-slate-900">Fortaleza - CE (Matriz)</strong></span>
            <span>Data: <strong className="text-slate-900">{new Date().toLocaleDateString('pt-BR')}</strong></span>
            <span>Hora: <strong className="text-slate-900">{new Date().toLocaleTimeString('pt-BR')}</strong></span>
          </div>
          <span className="font-bold text-blue-600">SubliGestão Versão 1.0</span>
        </div>
      </div>

      {/* CONFIRMATION POPUP MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 max-w-md w-full space-y-4 text-center">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <HelpCircle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">
                {isQuitacaoRestante ? 'Quitar Saldo Restante?' : 'Finalizar Pagamento?'}
              </h3>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                Confirma a conclusão do recebimento no valor de{' '}
                <strong className="text-blue-700 font-extrabold">
                  R$ {(isQuitacaoRestante ? saldoRestanteParaQuitar : valorTotalCalculado).toFixed(2)}
                </strong>{' '}
                via{' '}
                <strong className="text-slate-900">
                  {isQuitacaoRestante ? formaPagamentoRestante : formaPagamento}
                </strong>?
              </p>
              {comprovanteUrl && (
                <p className="text-[11px] text-emerald-700 font-bold mt-1 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Comprovante de pagamento será anexado à OS
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-2 italic">
                Após a confirmação, a Ordem de Serviço será enviada ao Fluxo de Produção e o caixa será liquidado.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
              >
                Não (Voltar)
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalizePayment}
                className="flex-1 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                {isSubmitting ? 'Finalizando...' : 'Sim, Finalizar!'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
