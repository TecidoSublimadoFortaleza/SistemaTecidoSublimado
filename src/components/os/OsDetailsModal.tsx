import React, { useState } from 'react';
import {
  X,
  FileText,
  User,
  Phone,
  Calendar,
  DollarSign,
  Package,
  Truck,
  CheckCircle2,
  RotateCcw,
  Clock,
  ShieldCheck,
  MapPin,
  Tag,
  AlertTriangle,
  Printer,
  Download,
  Eye,
  Paperclip
} from 'lucide-react';
import { OrdemServico } from '../../server/types/os';

const formatCurrencyBr = (val: number): string => {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface OsDetailsModalProps {
  os: OrdemServico;
  onClose: () => void;
}

export const OsDetailsModal: React.FC<OsDetailsModalProps> = ({ os, onClose }) => {
  const [previewImageModalUrl, setPreviewImageModalUrl] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string>('');

  const handleDownloadAttachment = (att: { fileUrl: string; fileName?: string; isParaImpressao?: boolean }) => {
    if (!att.fileUrl) return;
    const link = document.createElement('a');
    link.href = att.fileUrl;
    link.download = att.fileName || (att.isParaImpressao ? 'arte_para_impressao.png' : 'arte_os.png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const isShopee = os.destinoExpedicao === 'SHOPEE' || (os as any).isShopee;
  const isCorreios = os.destinoExpedicao === 'CORREIOS';
  const isExcursao = os.destinoExpedicao === 'EXCURSÃO';
  const isRetirada = os.destinoExpedicao === 'RETIRADA (RECEPÇÃO)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">{os.codigo}</h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {os.estagioAtual || 'Produção'}
                </span>
                {os.entregue && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Entregue
                  </span>
                )}
                {os.devolvido && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    Devolvida
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Cliente: <strong className="text-white">{os.clienteNome}</strong> • Vendedor: {os.operador}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar text-slate-700 text-xs">
          {/* BANNER SE ENTREGUE */}
          {os.entregue && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-black text-xs uppercase tracking-wide">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Confirmação de Entrega</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Recebido Por:</span>
                  <p className="font-extrabold text-sm text-emerald-950">{os.recebidoPorNome || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Telefone:</span>
                  <p className="font-semibold">{os.recebidoPorTelefone || 'Não informado'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">CPF:</span>
                  <p className="font-semibold">{os.recebidoPorCpf || 'Não informado'}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-emerald-100 flex flex-wrap items-center justify-between text-[11px] text-emerald-800 font-medium">
                <span>Data da Entrega: <strong>{formatDate(os.dataEntrega)}</strong></span>
                {os.entreguePorNome && <span>Registrado por: <strong>{os.entreguePorNome}</strong></span>}
              </div>
              {os.observacoesEntrega && (
                <div className="pt-1 text-[11px] text-slate-600 italic">
                  <strong>Observação:</strong> {os.observacoesEntrega}
                </div>
              )}
            </div>
          )}

          {/* BANNER SE DEVOLVIDO */}
          {os.devolvido && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-rose-900 font-black text-xs uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Registro de Devolução / Não Entrega</span>
              </div>
              <div className="space-y-1 text-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Motivo:</span>
                  <p className="font-extrabold text-sm text-rose-950">{os.motivoDevolucao || 'Motivo não especificado'}</p>
                </div>
                {os.detalhesDevolucao && (
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">O que aconteceu:</span>
                    <p className="bg-white p-2.5 rounded-xl border border-rose-200 text-xs text-slate-700 whitespace-pre-wrap">
                      {os.detalhesDevolucao}
                    </p>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-rose-100 flex flex-wrap items-center justify-between text-[11px] text-rose-800 font-medium">
                <span>Data: <strong>{formatDate(os.dataDevolucao)}</strong></span>
                {os.retornouParaProducao && (
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-900 rounded-full font-bold">
                    ✓ Retornou ao Fluxo de Produção
                  </span>
                )}
              </div>
            </div>
          )}

          {/* DADOS GERAIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <h4 className="text-[11px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Dados do Cliente</span>
              </h4>
              <div className="space-y-1">
                <p className="font-bold text-slate-900">{os.clienteNome}</p>
                {os.clienteTelefone && (
                  <p className="text-slate-600 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {os.clienteTelefone}
                  </p>
                )}
                {os.clienteCpfCnpj && (
                  <p className="text-slate-500 font-mono text-[11px]">
                    CPF/CNPJ: {os.clienteCpfCnpj}
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <h4 className="text-[11px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span>Expedição e Logística</span>
              </h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Destino:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isShopee
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : isCorreios
                      ? 'bg-yellow-100 text-yellow-900 border border-yellow-300'
                      : isExcursao
                      ? 'bg-purple-100 text-purple-900 border border-purple-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}>
                    {os.destinoExpedicao || 'NÃO DEFINIDO'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Modalidade:</span>
                  <span className="font-bold text-slate-800">{os.tipoExpedicao || 'NORMAL'}</span>
                </div>
                {os.prazoEntrega && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Prazo: {formatDate(os.prazoEntrega)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ITENS DA OS */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-black uppercase text-slate-500 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-600" />
              <span>Itens da Ordem de Serviço ({os.itens?.length || 0})</span>
            </h4>
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                    <th className="py-2.5 px-3">Item / Descrição</th>
                    <th className="py-2.5 px-3 text-center">Qtd</th>
                    <th className="py-2.5 px-3 text-right">Unitário</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {Array.isArray(os.itens) && os.itens.length > 0 ? (
                    os.itens.map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <p className="font-bold text-slate-900">{it.nome || it.descricao || `Item #${idx + 1}`}</p>
                          {it.tecido && <p className="text-[10px] text-slate-400">Tecido: {it.tecido}</p>}
                          {it.medidasProducao && (
                            <div className="mt-1 p-2 bg-purple-50 border border-purple-200 rounded-lg text-[10px] text-slate-800 space-y-1">
                              <div className="font-black text-purple-900 uppercase flex items-center justify-between">
                                <span>📐 Medidas para Produção (Corte e Costura)</span>
                                {it.qtdBabado && <span className="bg-purple-200 text-purple-900 px-1 rounded text-[9px] font-bold">{it.qtdBabado} Babados</span>}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 font-mono text-[9.5px]">
                                <div className="bg-white/80 border border-blue-200 rounded px-1.5 py-0.5">
                                  <strong className="text-blue-900">TAMPO:</strong> {it.medidasProducao.tampo?.largura || '-'} × {it.medidasProducao.tampo?.altura || '-'}
                                </div>
                                <div className="bg-white/80 border border-amber-200 rounded px-1.5 py-0.5">
                                  <strong className="text-amber-900">FAIXA:</strong> {it.medidasProducao.faixa?.largura || '-'} × {it.medidasProducao.faixa?.altura || '-'}
                                </div>
                                <div className="bg-white/80 border border-fuchsia-200 rounded px-1.5 py-0.5">
                                  <strong className="text-fuchsia-900">FAIXA BABADO:</strong> {it.medidasProducao.faixaBabado?.largura || '-'} × {it.medidasProducao.faixaBabado?.altura || '-'}
                                </div>
                                {it.medidasProducao.ultimaFaixaBabado && (
                                  <div className="bg-white/80 border border-purple-200 rounded px-1.5 py-0.5">
                                    <strong className="text-purple-900">ÚLTIMA FAIXA:</strong> {it.medidasProducao.ultimaFaixaBabado?.largura || '-'} × {it.medidasProducao.ultimaFaixaBabado?.altura || '-'}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {(it.valorBaseCilindro !== undefined || it.tampCilindro !== undefined) && (
                            <div className="mt-1 text-[10px] bg-cyan-50/90 border border-cyan-200 rounded-lg p-1.5 space-y-1">
                              <span className="font-extrabold text-cyan-900 uppercase block">🛢️ Medidas Cilindro:</span>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 font-mono text-[9.5px]">
                                <div className="bg-white/80 border border-cyan-200 rounded px-1.5 py-0.5">
                                  <strong className="text-cyan-900">LARGURA:</strong> {it.medidaFrente !== undefined ? String(it.medidaFrente).replace('.', ',') : '-'} m
                                </div>
                                <div className="bg-white/80 border border-cyan-200 rounded px-1.5 py-0.5">
                                  <strong className="text-cyan-900">ALTURA:</strong> {it.medidaAltura !== undefined ? String(it.medidaAltura).replace('.', ',') : '-'} m
                                </div>
                                <div className="bg-white/80 border border-cyan-200 rounded px-1.5 py-0.5">
                                  <strong className="text-cyan-900">TAMPO:</strong> {it.tampCilindro !== undefined ? Number(it.tampCilindro).toFixed(2).replace('.', ',') : '-'} m
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-bold">{it.quantidade}</td>
                        <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-600">
                          {formatCurrencyBr(it.valorUnitario || it.preco || 0)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrencyBr((it.quantidade || 1) * (it.valorUnitario || it.preco || 0))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-3 px-4 text-center text-slate-400">
                        Nenhum item discriminado nesta OS.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ANEXOS & ARQUIVOS DA OS / PARA IMPRESSÃO */}
          {os.anexos && os.anexos.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-purple-700" />
                  <h4 className="text-[11px] font-black uppercase text-slate-800">
                    Arquivos e Artes da OS ({os.anexos.length})
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                  Download pelo Impressor
                </span>
              </div>

              {/* ARQUIVOS PARA IMPRESSÃO */}
              {os.anexos.some((a) => a.type === 'PARA_IMPRESSAO' || a.isParaImpressao || (a.label || '').toLowerCase().includes('impressão') || (a.label || '').toLowerCase().includes('impressao')) && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-purple-900 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded inline-block">
                    Arquivos em Alta Resolução Para Impressão
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {os.anexos
                      .filter((a) => a.type === 'PARA_IMPRESSAO' || a.isParaImpressao || (a.label || '').toLowerCase().includes('impressão') || (a.label || '').toLowerCase().includes('impressao'))
                      .map((att, aIdx) => (
                        <div
                          key={att.id || aIdx}
                          className="bg-purple-50/80 border border-purple-300 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {att.fileUrl && (att.fileUrl.startsWith('data:image') || att.fileUrl.startsWith('http') || att.fileUrl.startsWith('blob')) ? (
                              <img
                                src={att.fileUrl}
                                alt={att.fileName || 'Arte'}
                                className="w-10 h-10 rounded-lg object-contain bg-white border border-purple-200 p-0.5 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-purple-200 flex items-center justify-center text-purple-800 shrink-0">
                                <Printer className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-purple-950 truncate" title={att.fileName || att.label}>
                                {att.fileName || att.label || `Arte Impressão #${aIdx + 1}`}
                              </p>
                              <p className="text-[10px] text-purple-700">{att.fileSize || 'Original'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewImageModalUrl(att.fileUrl);
                                setPreviewImageName(att.fileName || 'Arte para Impressão');
                              }}
                              className="p-1.5 bg-white hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-lg transition cursor-pointer"
                              title="Visualizar"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadAttachment(att)}
                              className="p-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg transition cursor-pointer"
                              title="Baixar arquivo original"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* OUTRAS ARTES */}
              {os.anexos.some((a) => !(a.type === 'PARA_IMPRESSAO' || a.isParaImpressao || (a.label || '').toLowerCase().includes('impressão') || (a.label || '').toLowerCase().includes('impressao'))) && (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Outras Artes Anexadas
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {os.anexos
                      .filter((a) => !(a.type === 'PARA_IMPRESSAO' || a.isParaImpressao || (a.label || '').toLowerCase().includes('impressão') || (a.label || '').toLowerCase().includes('impressao')))
                      .map((att, aIdx) => (
                        <div
                          key={att.id || aIdx}
                          className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {att.fileUrl ? (
                              <img
                                src={att.fileUrl}
                                alt={att.fileName || 'Arte'}
                                className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                                <Paperclip className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate" title={att.fileName || att.label}>
                                {att.fileName || att.label || `Arte #${aIdx + 1}`}
                              </p>
                              <p className="text-[10px] text-slate-400">{att.fileSize || 'Anexo'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewImageModalUrl(att.fileUrl);
                                setPreviewImageName(att.fileName || 'Arte');
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                              title="Visualizar"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadAttachment(att)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition cursor-pointer"
                              title="Baixar"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VALOR TOTAL */}
          <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl">
            <span className="text-xs font-bold text-slate-300">Valor Total da OS:</span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              {formatCurrencyBr(os.valorTotal || 0)}
            </span>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* LIGHTBOX PREVIEW MODAL */}
      {previewImageModalUrl && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden flex flex-col border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950 text-white border-b border-slate-800 shrink-0">
              <span className="text-xs font-black truncate max-w-md">{previewImageName || 'Visualização da Arte'}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment({ fileUrl: previewImageModalUrl, fileName: previewImageName })}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewImageModalUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-slate-950/60 min-h-[300px]">
              <img
                src={previewImageModalUrl}
                alt={previewImageName || 'Preview'}
                className="max-h-[75vh] max-w-full object-contain rounded-lg border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
