import React, { useState } from 'react';
import { X, PackageCheck, User, Phone, FileText, AlertCircle, CheckCircle2, Truck, ShoppingBag, Store, Mail } from 'lucide-react';
import { OrdemServico, OsHistoryEntry } from '../../server/types/os';
import { ApiService } from '../../services/api';
import { getLoggedUserAndPerfil } from '../../utils/userPermissions';

interface DeliveryModalProps {
  os: OrdemServico | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DeliveryModal: React.FC<DeliveryModalProps> = ({
  os,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [recebedorNome, setRecebedorNome] = useState('');
  const [recebedorTelefone, setRecebedorTelefone] = useState('');
  const [recebedorCpf, setRecebedorCpf] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize fields when modal opens
  React.useEffect(() => {
    if (isOpen && os) {
      setRecebedorNome(os.recebidoPorNome || os.clienteNome || '');
      setRecebedorTelefone(os.recebidoPorTelefone || os.clienteTelefone || '');
      setRecebedorCpf(os.recebidoPorCpf || '');
      setObservacoes(os.entregaObservacoes || '');
      setErrorMsg(null);
    }
  }, [isOpen, os]);

  if (!isOpen || !os) return null;

  const getDestinationInfo = () => {
    const rawDest = (
      (os as any).destinoExpedicao ||
      (os as any).destino ||
      os.observacoesExpedicao ||
      os.observacoes ||
      ''
    ).toUpperCase();

    if (rawDest.includes('SHOPEE')) {
      return { label: 'SHOPEE', icon: ShoppingBag, color: 'text-orange-600 bg-orange-50 border-orange-200' };
    }
    if (rawDest.includes('CORREIO')) {
      return { label: 'CORREIOS', icon: Mail, color: 'text-amber-600 bg-amber-50 border-amber-200' };
    }
    if (rawDest.includes('EXCURS') || rawDest.includes('ESCURS')) {
      return { label: 'EXCURSÃO', icon: Truck, color: 'text-red-600 bg-red-50 border-red-200' };
    }
    return { label: 'RETIRADA (RECEPÇÃO)', icon: Store, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  };

  const destInfo = getDestinationInfo();
  const DestIcon = destInfo.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recebedorNome.trim()) {
      setErrorMsg('Por favor, informe o nome de quem recebeu a mercadoria.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const logged = getLoggedUserAndPerfil();
      const now = new Date();
      const nowISO = now.toISOString();
      const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;

      const historyDetails = `Entrega confirmada no destino [${destInfo.label}]. Recebido por: ${recebedorNome.trim()}${
        recebedorTelefone.trim() ? ` | Tel: ${recebedorTelefone.trim()}` : ''
      }${recebedorCpf.trim() ? ` | CPF: ${recebedorCpf.trim()}` : ''}${
        observacoes.trim() ? ` | Obs: ${observacoes.trim()}` : ''
      }`;

      const newHistoryEntry: OsHistoryEntry = {
        id: `HST-DELIV-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        dataHora: dataHoraStr,
        usuario: logged.name,
        perfil: logged.role,
        acao: 'Mercadoria Entregue ao Destinatário',
        detalhes: historyDetails,
      };

      const updatedHistory = [newHistoryEntry, ...(os.historicoEdicoes || [])];

      const updates: Partial<OrdemServico> = {
        entregue: true,
        dataEntrega: dataHoraStr,
        entreguePor: logged.name,
        recebidoPorNome: recebedorNome.trim(),
        recebidoPorTelefone: recebedorTelefone.trim() || undefined,
        recebidoPorCpf: recebedorCpf.trim() || undefined,
        entregaObservacoes: observacoes.trim() || undefined,
        situacaoEntrega: 'ENTREGUE',
        devolvido: false, // Limpa caso houvesse devolução prévia
        retornouParaProducao: false,
        status: 'Concluído',
        estagioAtual: 'Entrega',
        historicoEdicoes: updatedHistory,
      };

      await ApiService.updateOs(os.id, updates);

      window.dispatchEvent(new CustomEvent('os-changed'));
      window.dispatchEvent(new CustomEvent('subligestao_new_notification', {
        detail: {
          title: 'Mercadoria Entregue',
          message: `OS ${os.codigo} entregue com sucesso para ${recebedorNome.trim()} (${destInfo.label})`,
        },
      }));

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao confirmar entrega:', err);
      setErrorMsg(err.message || 'Erro ao registrar entrega. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <PackageCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wide">Confirmar Entrega</h2>
              <p className="text-xs text-emerald-100 font-medium">
                Ordem de Serviço: <strong className="text-white font-mono">{os.codigo}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Destino e Cliente */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Destino de Envio</span>
              <div className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-black text-[11px] ${destInfo.color}`}>
                <DestIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{destInfo.label}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Cliente</span>
              <span className="font-extrabold text-slate-800 text-xs mt-1 block truncate">
                {os.clienteNome || 'Não informado'}
              </span>
            </div>
          </div>

          {/* Campo: Nome de quem recebeu (Obrigatório) */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
              Nome de quem recebeu <span className="text-rose-500">* (Obrigatório)</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={recebedorNome}
                onChange={(e) => setRecebedorNome(e.target.value)}
                placeholder="Ex: João da Silva, Maria dos Santos..."
                className="w-full pl-9 pr-3 py-2.5 text-xs font-bold text-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Linha dupla: Telefone e CPF (Não obrigatórios) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-600 mb-1">
                Telefone <span className="text-[10px] text-slate-400 font-normal">(Não obrigatório)</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={recebedorTelefone}
                  onChange={(e) => setRecebedorTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-600 mb-1">
                CPF <span className="text-[10px] text-slate-400 font-normal">(Não obrigatório)</span>
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={recebedorCpf}
                  onChange={(e) => setRecebedorCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Observações da Entrega */}
          <div>
            <label className="block text-xs font-extrabold text-slate-600 mb-1">
              Observações / Informações Adicionais <span className="text-[10px] text-slate-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Entregue diretamente na recepção com documento conferido; assinado por responsável..."
              className="w-full p-2.5 text-xs text-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition resize-none"
            />
          </div>

          {/* Aviso do Fluxo */}
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900 text-[11px] font-semibold flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              Ao confirmar a entrega, a <strong>OS {os.codigo}</strong> sairá do <strong>Fluxo de Produção</strong> e ficará registrada permanentemente no módulo <strong>Entrega & Devolução</strong>.
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <PackageCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Confirmar como Entregue'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
