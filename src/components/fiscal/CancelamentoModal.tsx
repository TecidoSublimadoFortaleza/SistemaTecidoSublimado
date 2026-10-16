import React, { useState } from 'react';
import { AlertTriangle, X, RefreshCw, Trash2 } from 'lucide-react';
import { ApiService, NotaFiscal } from '../../services/api';

interface CancelamentoModalProps {
  nota: NotaFiscal | null;
  onClose: () => void;
  onSuccess: (notaAtualizada: NotaFiscal) => void;
}

export const CancelamentoModal: React.FC<CancelamentoModalProps> = ({ nota, onClose, onSuccess }) => {
  const [justificativa, setJustificativa] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!nota) return null;

  const handleConfirm = async () => {
    if (justificativa.trim().length < 15) {
      setErrorMsg('A justificativa de cancelamento da SEFAZ deve conter no mínimo 15 caracteres.');
      return;
    }

    setIsCancelling(true);
    setErrorMsg(null);

    try {
      const res = await ApiService.cancelarNotaFiscal(nota.id, justificativa.trim());
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cancelar a nota fiscal na SEFAZ.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-white" />
            <h3 className="font-extrabold text-sm">Cancelar {nota.tipo === 'NFE' ? 'NF-e' : 'NFC-e'} na SEFAZ</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-rose-700 rounded-lg transition text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
            <p className="font-bold">Atenção: Ação Fiscal Irreversível</p>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              O cancelamento será homologado perante os servidores da SEFAZ. Uma vez cancelada, a nota não poderá ser reativada.
            </p>
          </div>

          <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p><span className="font-bold text-slate-600">Documento:</span> Nº {nota.numero} (Série {nota.serie})</p>
            <p><span className="font-bold text-slate-600">Cliente:</span> {nota.clienteNome}</p>
            <p><span className="font-bold text-slate-600">Valor Total:</span> R$ {nota.valorTotal.toFixed(2)}</p>
            <p className="font-mono text-[10px] text-slate-500 truncate"><span className="font-bold">Chave:</span> {nota.chaveAcesso}</p>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-100 text-rose-800 rounded-lg text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Justificativa Legal da SEFAZ (Mínimo 15 caracteres) *
            </label>
            <textarea
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Cancelamento solicitado pelo cliente devido a erro de faturamento ou desistência da compra."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Caracteres digitados: {justificativa.trim().length}</span>
              <span className={justificativa.trim().length >= 15 ? 'text-emerald-600 font-bold' : 'text-rose-500'}>
                {justificativa.trim().length >= 15 ? 'Válido' : 'Mínimo 15'}
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCancelling}
              className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isCancelling || justificativa.trim().length < 15}
              className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              {isCancelling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Transmitindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Homologar Cancelamento</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
