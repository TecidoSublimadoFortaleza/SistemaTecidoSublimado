import React, { useState } from 'react';
import { X, RotateCcw, AlertTriangle, FileText, ArrowRight, CheckCircle2, RotateCw } from 'lucide-react';
import { OrdemServico, OsHistoryEntry, ProductionStage } from '../../server/types/os';
import { ApiService } from '../../services/api';
import { getLoggedUserAndPerfil } from '../../utils/userPermissions';

interface ReturnModalProps {
  os: OrdemServico | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const COMMON_REASONS = [
  'Destinatário ausente / não encontrado no local',
  'Endereço incorreto ou incompleto',
  'Pacote avariado ou violado durante o transporte',
  'Cliente recusou o recebimento da encomenda',
  'Inconformidade na peça / Solicitou ajuste ou correção',
  'Objeto não retirado na agência / prazo expirado',
  'Extravio ou sinistro confirmado pela transportadora',
  'Outro (descrever abaixo)',
];

const RETURN_STAGES: ProductionStage[] = [
  'Designer',
  'Impressão',
  'Calandra',
  'Costura',
  'Conferência',
  'Expedição',
];

export const ReturnModal: React.FC<ReturnModalProps> = ({
  os,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [motivo, setMotivo] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [acaoDevolucao, setAcaoDevolucao] = useState<'manter_devolvido' | 'retornar_producao'>('manter_devolvido');
  const [etapaRetorno, setEtapaRetorno] = useState<ProductionStage>('Conferência');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && os) {
      setMotivo(os.motivoDevolucao || '');
      setSelectedPreset('');
      setAcaoDevolucao('manter_devolvido');
      setEtapaRetorno('Conferência');
      setErrorMsg(null);
    }
  }, [isOpen, os]);

  if (!isOpen || !os) return null;

  const handleSelectPreset = (preset: string) => {
    setSelectedPreset(preset);
    if (preset !== 'Outro (descrever abaixo)') {
      setMotivo((prev) => {
        if (!prev.trim()) return preset;
        return `${prev}\n${preset}`;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      setErrorMsg('Por favor, descreva o que aconteceu com a mercadoria.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const logged = getLoggedUserAndPerfil();
      const now = new Date();
      const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;

      const historyDetail = `[DEVOLUÇÃO / NÃO ENTREGUE]: ${motivo.trim()}.${
        acaoDevolucao === 'retornar_producao'
          ? ` OS reenviada ao Fluxo de Produção na etapa [${etapaRetorno}].`
          : ' OS mantida em registro de devolução.'
      }`;

      const newHistoryEntry: OsHistoryEntry = {
        id: `HST-RET-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        dataHora: dataHoraStr,
        usuario: logged.name,
        perfil: logged.role,
        acao: 'Registro de Devolução / Não Entrega',
        detalhes: historyDetail,
      };

      const updatedHistory = [newHistoryEntry, ...(os.historicoEdicoes || [])];

      const updates: Partial<OrdemServico> = {
        devolvido: true,
        dataDevolucao: dataHoraStr,
        devolvidoPor: logged.name,
        motivoDevolucao: motivo.trim(),
        situacaoEntrega: 'DEVOLVIDO',
        historicoEdicoes: updatedHistory,
      };

      if (acaoDevolucao === 'retornar_producao') {
        updates.retornouParaProducao = true;
        updates.entregue = false;
        updates.estagioAtual = etapaRetorno;
        updates.status = 'Em Produção';
      } else {
        updates.retornouParaProducao = false;
      }

      await ApiService.updateOs(os.id, updates);

      window.dispatchEvent(new CustomEvent('os-changed'));
      window.dispatchEvent(new CustomEvent('subligestao_new_notification', {
        detail: {
          title: 'Devolução Registrada',
          message: `OS ${os.codigo} marcada como devolução/não entregue.`,
        },
      }));

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao registrar devolução:', err);
      setErrorMsg(err.message || 'Erro ao registrar ocorrência. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 to-amber-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <RotateCcw className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wide">
                Registrar Devolução / Não Entregue
              </h2>
              <p className="text-xs text-rose-100 font-medium">
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

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Dados Resumidos */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Cliente</span>
              <span className="font-extrabold text-slate-800 text-xs">{os.clienteNome || 'Não informado'}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Destino</span>
              <span className="font-extrabold text-amber-700 text-xs">
                {(os as any).destinoExpedicao || (os as any).destino || 'Não especificado'}
              </span>
            </div>
          </div>

          {/* Atalhos Rápidos de Motivos */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Motivos Frequentes (Clique para preencher)
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
              {COMMON_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleSelectPreset(r)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition text-left cursor-pointer ${
                    selectedPreset === r
                      ? 'bg-rose-100 text-rose-900 border-rose-300 ring-1 ring-rose-400'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Caixa de Texto: O que aconteceu */}
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>O que aconteceu? (Descreva o motivo detalhado)</span>
              <span className="text-rose-600">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva com clareza o motivo da devolução ou por que o serviço não pôde ser entregue..."
              className="w-full p-3 text-xs text-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition resize-none font-medium"
            />
          </div>

          {/* Ação a Tomar */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Qual ação tomar agora com esta OS?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAcaoDevolucao('manter_devolvido')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  acaoDevolucao === 'manter_devolvido'
                    ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500 text-rose-900'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-xs font-black">Manter como Devolvido</span>
                </div>
                <span className="text-[10px] text-slate-500 leading-tight">
                  Registra no histórico e mantém no módulo Entrega & Devolução aguardando resolução.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAcaoDevolucao('retornar_producao')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  acaoDevolucao === 'retornar_producao'
                    ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500 text-amber-900'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <RotateCw className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-black">Retornar para Produção</span>
                </div>
                <span className="text-[10px] text-slate-500 leading-tight">
                  Reinsere a OS de volta no Fluxo de Produção (Kanban) para ajuste, conserto ou retrabalho.
                </span>
              </button>
            </div>

            {/* Se escolheu retornar para a produção, seleciona a etapa */}
            {acaoDevolucao === 'retornar_producao' && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                <label className="block text-[11px] font-black text-amber-900 uppercase">
                  Reenviar para qual etapa do Fluxo de Produção?
                </label>
                <select
                  value={etapaRetorno}
                  onChange={(e) => setEtapaRetorno(e.target.value as ProductionStage)}
                  className="w-full p-2 bg-white text-xs font-bold text-slate-800 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  {RETURN_STAGES.map((stg) => (
                    <option key={stg} value={stg}>
                      {stg}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
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
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Confirmar Devolução'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
