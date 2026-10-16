import React, { useState } from 'react';
import { FileCode, Download, Copy, Check, X } from 'lucide-react';
import { NotaFiscal } from '../../services/api';

interface XmlModalProps {
  nota: NotaFiscal | null;
  onClose: () => void;
  onDownload: (nota: NotaFiscal) => void;
}

export const XmlModal: React.FC<XmlModalProps> = ({ nota, onClose, onDownload }) => {
  const [copied, setCopied] = useState(false);

  if (!nota) return null;

  const xml = nota.xmlConteudo || '<!-- XML não disponível -->';

  const handleCopy = () => {
    navigator.clipboard.writeText(xml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-extrabold text-sm">XML da {nota.tipo === 'NFE' ? 'NF-e' : 'NFC-e'} Nº {nota.numero}</h3>
              <p className="text-[10px] text-slate-400 font-mono">Chave: {nota.chaveAcesso}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 bg-slate-950 flex-1 overflow-y-auto">
          <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap break-all leading-relaxed">
            {xml}
          </pre>
        </div>

        <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copiado!' : 'Copiar XML'}</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => onDownload(nota)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Arquivo .XML</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
