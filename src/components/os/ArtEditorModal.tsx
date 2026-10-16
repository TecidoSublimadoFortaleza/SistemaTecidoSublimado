import React, { useState, useRef } from 'react';
import { OsAttachment } from '../../server/types/os';
import {
  X,
  Upload,
  Move,
  RotateCw,
  Trash2,
  Grid,
  Maximize2,
  Minimize2,
  Check,
  Sparkles,
  Sliders,
  Plus,
  Image as ImageIcon,
} from 'lucide-react';

import { compressImageFile } from '../../utils/imageCompressor';

interface ArtEditorModalProps {
  anexos: OsAttachment[];
  osCodigo?: string;
  onSave: (updatedAnexos: OsAttachment[]) => void;
  onClose: () => void;
}

export const ArtEditorModal: React.FC<ArtEditorModalProps> = ({
  anexos,
  osCodigo = 'OS-2026',
  onSave,
  onClose,
}) => {
  // Local editable copy of attachments with layout values
  const [items, setItems] = useState<OsAttachment[]>(() => {
    return anexos.map((att, idx) => ({
      ...att,
      type: 'ARTE',
      label: att.label || `Arte #${idx + 1}`,
      x: att.x ?? (10 + (idx % 3) * 28),
      y: att.y ?? (10 + Math.floor(idx / 3) * 28),
      width: att.width ?? 25,
      height: att.height ?? 25,
      scale: att.scale ?? 1,
      rotation: att.rotation ?? 0,
    }));
  });

  const [selectedId, setSelectedId] = useState<string | null>(
    items.length > 0 ? items[0].id : null
  );

  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>(() => {
    return (anexos[0]?.orientation as 'PORTRAIT' | 'LANDSCAPE') || 'PORTRAIT';
  });

  // Canvas ref for drag and drop
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Currently selected item object
  const selectedItem = items.find((i) => i.id === selectedId);

  // Auto-arrange images into optimal grid layout on the A4 sheet
  const handleAutoArrange = () => {
    if (items.length === 0) return;
    const count = items.length;
    let cols = 2;
    if (count > 4) cols = 3;
    if (count > 9) cols = 4;

    const margin = 5;
    const itemWidth = Math.floor((90 - margin * (cols - 1)) / cols);
    const itemHeight = itemWidth;

    const updated = items.map((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      return {
        ...item,
        x: margin + col * (itemWidth + margin),
        y: margin + row * (itemHeight + margin),
        width: itemWidth,
        height: itemHeight,
        rotation: 0,
        scale: 1,
      };
    });

    setItems(updated);
  };

  // Upload new image attachments inside editor
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files) as File[];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileUrl = await compressImageFile(file);
      const newIdx = items.length + i;
      const newItem: OsAttachment = {
        id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'ARTE',
        label: `Arte #${newIdx + 1}`,
        fileName: file.name,
        fileUrl,
        uploadedAt: new Date().toISOString(),
        x: 10 + (newIdx % 3) * 28,
        y: 10 + Math.floor(newIdx / 3) * 28,
        width: 25,
        height: 25,
        scale: 1,
        rotation: 0,
      };

      setItems((prev) => [...prev, newItem]);
      if (!selectedId && i === 0) setSelectedId(newItem.id);
    }
  };

  // Helper to adjust scale smoothly via mouse wheel or buttons
  const adjustScale = (id: string, deltaY: number) => {
    const step = 0.05;
    const delta = deltaY < 0 ? step : -step;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const currentScale = item.scale ?? 1;
        const rawScale = currentScale + delta;
        const newScale = Math.min(2.5, Math.max(0.3, Math.round(rawScale * 100) / 100));
        return { ...item, scale: newScale };
      })
    );
  };

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    setIsDragging(true);

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 100;
      const clickY = ((e.clientY - rect.top) / rect.height) * 100;

      const target = items.find((i) => i.id === id);
      if (target) {
        setDragOffset({
          x: clickX - (target.x || 0),
          y: clickY - (target.y || 0),
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    let currentX = ((e.clientX - rect.left) / rect.width) * 100;
    let currentY = ((e.clientY - rect.top) / rect.height) * 100;

    // Movimentação totalmente livre sem limitação de espaço artificial na folha
    let newX = Math.max(-50, Math.min(130, currentX - dragOffset.x));
    let newY = Math.max(-50, Math.min(130, currentY - dragOffset.y));

    setItems((prev) =>
      prev.map((item) => (item.id === selectedId ? { ...item, x: newX, y: newY } : item))
    );
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Property updates for selected item
  const updateSelectedItem = (key: keyof OsAttachment, val: any) => {
    if (!selectedId) return;
    setItems((prev) =>
      prev.map((item) => (item.id === selectedId ? { ...item, [key]: val } : item))
    );
  };

  // Delete item
  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  // Rotate selected item by 90 deg
  const handleRotate = () => {
    if (!selectedItem) return;
    const currentRot = selectedItem.rotation || 0;
    const nextRot = (currentRot + 90) % 360;
    updateSelectedItem('rotation', nextRot);
  };

  const handleSaveAndClose = () => {
    const itemsWithOrientation = items.map((item) => ({
      ...item,
      orientation,
    }));
    onSave(itemsWithOrientation);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col p-2 sm:p-4 md:p-6 overflow-hidden select-none">
      {/* HEADER BAR (FIXA NO TOPO COM TONS CLAROS E CINZA MÉDIO) */}
      <div className="bg-slate-200 text-slate-900 rounded-2xl p-4 border border-slate-300 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl border border-blue-300 shadow-xs">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black uppercase rounded shadow-xs">
                Editor Corel / Layout da Arte
              </span>
              <span className="text-xs text-slate-600 font-bold">• {osCodigo}</span>
            </div>
            <h2 className="text-base font-black tracking-tight text-slate-900 mt-0.5">
              Otimizador de Espaços e Diagramação para Impressão
            </h2>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-2">
          <label className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
            <Upload className="w-4 h-4 text-blue-100" />
            <span>Adicionar Artes</span>
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleAutoArrange}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            title="Ajustar e distribuir todas as artes automaticamente na folha"
          >
            <Grid className="w-4 h-4 text-emerald-100" />
            <span>Organizar Automático</span>
          </button>

          <button
            type="button"
            onClick={() => setOrientation(orientation === 'PORTRAIT' ? 'LANDSCAPE' : 'PORTRAIT')}
            className="px-3 py-2 bg-slate-300 hover:bg-slate-400/80 text-slate-800 border border-slate-400/60 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <span>Folha: {orientation === 'PORTRAIT' ? 'Retrato (A4)' : 'Paisagem (A4)'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-600/20"
          >
            <Check className="w-4 h-4 text-white" />
            <span>Salvar Layout</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-700 hover:text-slate-950 bg-slate-300 hover:bg-slate-400 rounded-xl transition-all cursor-pointer border border-slate-400/50 shadow-xs"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT WORKSPACE */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4 overflow-hidden min-h-0">
        {/* LEFT CANVAS AREA (A4 SHEET PREVIEW EM FUNDO CINZA MÉDIO CLARO) */}
        <div className="lg:col-span-8 bg-slate-300/80 border border-slate-300 rounded-2xl p-4 flex flex-col items-center justify-center overflow-auto relative shadow-inner">
          <div className="text-[11px] font-bold text-slate-700 mb-2 flex flex-wrap items-center justify-between gap-2 w-full max-w-[678px]">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Arraste para mover • <strong>Scroll do mouse</strong> para redimensionar</span>
            </div>
            <span className="px-2.5 py-0.5 bg-slate-200 text-slate-800 border border-slate-400 rounded-full font-mono text-[11px] font-bold shadow-xs">
              Artes inclusas: {items.length}
            </span>
          </div>

          {/* CANVAS A4 - MODELO REAL SEM TEXTOS/PONTOS */}
          <div
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={(e) => {
              if (selectedId) {
                e.preventDefault();
                adjustScale(selectedId, e.deltaY);
              }
            }}
            className={`bg-white shadow-xl relative border-2 border-slate-400/80 transition-all overflow-hidden rounded-xs ${
              orientation === 'PORTRAIT'
                ? 'w-[480px] max-w-full aspect-[210/297]'
                : 'w-[678px] max-w-full aspect-[297/210]'
            }`}
          >
            {items.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 space-y-2 p-6 text-center">
                <ImageIcon className="w-12 h-12 text-slate-400 stroke-1" />
                <p className="text-xs font-bold text-slate-600">
                  Nenhuma arte anexada ainda.
                </p>
                <label className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-blue-700 transition-all shadow-sm">
                  <span>Fazer Upload de Artes</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              items.map((item) => {
                const isSelected = item.id === selectedId;
                const posX = item.x ?? 10;
                const posY = item.y ?? 10;
                const widthPercent = item.width ?? 25;
                const heightPercent = item.height ?? 25;
                const rotation = item.rotation ?? 0;
                const scale = item.scale ?? 1;

                return (
                  <div
                    key={item.id}
                    onMouseDown={(e) => handleMouseDown(e, item.id)}
                    onWheel={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedId(item.id);
                      adjustScale(item.id, e.deltaY);
                    }}
                    className={`absolute cursor-move group transition-shadow ${
                      isSelected
                        ? 'ring-2 ring-blue-600 ring-offset-1 z-20 shadow-xl'
                        : 'hover:ring-1 hover:ring-blue-400 z-10'
                    }`}
                    style={{
                      left: `${posX}%`,
                      top: `${posY}%`,
                      width: `${widthPercent * scale}%`,
                      height: `${heightPercent * scale}%`,
                      transform: `rotate(${rotation}deg)`,
                    }}
                  >
                    <img
                      src={item.fileUrl}
                      alt={item.fileName}
                      className="w-full h-full object-contain pointer-events-none"
                    />

                    {/* SELECTION RESIZE HANDLES & CORNER CONTROLS */}
                    {isSelected && (
                      <>
                        <div className="absolute -top-2 -left-2 w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow" />
                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow" />
                        <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow" />
                        <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow" />
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR CONTROLS & LIST OF ARTES (TONS DE CINZA MÉDIO E CLAROS) */}
        <div className="lg:col-span-4 bg-slate-200 border border-slate-300 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto space-y-4 shadow-sm">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wide border-b border-slate-300 pb-2">
              Painel de Ajustes da Arte selecionada
            </h3>

            {selectedItem ? (
              <div className="space-y-4 bg-slate-100 p-3.5 rounded-xl border border-slate-300 text-xs text-slate-800 shadow-xs">
                {/* PREVIEW THUMBNAIL */}
                <div className="flex items-center gap-3">
                  <img
                    src={selectedItem.fileUrl}
                    alt={selectedItem.fileName}
                    className="h-16 w-16 object-contain rounded bg-white p-1 border border-slate-300 shadow-xs"
                  />
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] text-slate-600 font-bold mb-0.5">Nome da Arte</label>
                    <input
                      type="text"
                      value={selectedItem.label || ''}
                      onChange={(e) => updateSelectedItem('label', e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Arte #1"
                    />
                    <span className="block text-[9px] text-slate-500 truncate mt-1">
                      {selectedItem.fileName}
                    </span>
                  </div>
                </div>

                {/* SCALE SLIDER */}
                <div
                  className="space-y-1.5 p-2 rounded-xl bg-white border border-slate-300 hover:border-blue-400 transition-colors shadow-2xs"
                  onWheel={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    adjustScale(selectedItem.id, e.deltaY);
                  }}
                  title="Dica: Use o scroll do mouse aqui ou sobre a arte para aumentar/diminuir o tamanho"
                >
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-700">Tamanho / Escala</span>
                      <span className="text-[9px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-semibold border border-blue-200">
                        Scroll Ativo 🖱️
                      </span>
                    </div>
                    <span className="text-blue-700 font-black text-xs">
                      {Math.round((selectedItem.scale || 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="2.5"
                    step="0.05"
                    value={selectedItem.scale || 1}
                    onChange={(e) => updateSelectedItem('scale', parseFloat(e.target.value))}
                    onWheel={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      adjustScale(selectedItem.id, e.deltaY);
                    }}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[9px] text-slate-500 pt-0.5">
                    <button
                      type="button"
                      onClick={() => adjustScale(selectedItem.id, 100)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold transition-all cursor-pointer border border-slate-200"
                      title="Diminuir 5%"
                    >
                      - 5%
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedItem('scale', 1)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded font-bold transition-all cursor-pointer border border-slate-200"
                      title="Restaurar tamanho original (100%)"
                    >
                      100% (Padrão)
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustScale(selectedItem.id, -100)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold transition-all cursor-pointer border border-slate-200"
                      title="Aumentar 5%"
                    >
                      + 5%
                    </button>
                  </div>
                </div>

                {/* POSITION X & Y CUSTOM PERCENTAGE */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <label className="block text-slate-600 font-bold mb-0.5">Posição X (%)</label>
                    <input
                      type="number"
                      value={Math.round(selectedItem.x ?? 10)}
                      onChange={(e) => updateSelectedItem('x', Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-0.5">Posição Y (%)</label>
                    <input
                      type="number"
                      value={Math.round(selectedItem.y ?? 10)}
                      onChange={(e) => updateSelectedItem('y', Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* WIDTH & HEIGHT CUSTOM PERCENTAGE */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <label className="block text-slate-600 font-bold mb-0.5">Largura (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={Math.round(selectedItem.width || 25)}
                      onChange={(e) => updateSelectedItem('width', Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-0.5">Altura (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={Math.round(selectedItem.height || 25)}
                      onChange={(e) => updateSelectedItem('height', Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* ROTATION BUTTON */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-600">Rotação</span>
                  <button
                    type="button"
                    onClick={handleRotate}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                    <span>Girar 90° ({selectedItem.rotation || 0}°)</span>
                  </button>
                </div>

                {/* DELETE BUTTON */}
                <div className="pt-2 border-t border-slate-300">
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(selectedItem.id)}
                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Excluir esta Arte</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-300 text-center text-slate-600 text-xs font-medium">
                Clique em uma arte no modelo A4 para editar tamanho, rotação e posição.
              </div>
            )}

            {/* ALL ARTES LIST */}
            <div className="space-y-2">
              <span className="block text-[10px] font-black uppercase text-slate-700">
                Lista de Artes Inclusas ({items.length})
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {items.map((it, idx) => (
                  <div
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                    className={`p-2 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                      it.id === selectedId
                        ? 'bg-blue-50 border-blue-500 text-blue-950 font-black shadow-xs ring-1 ring-blue-400'
                        : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={it.fileUrl}
                        alt={it.fileName}
                        className="h-8 w-8 object-contain rounded bg-white p-0.5 border border-slate-300 shrink-0"
                      />
                      <span className="truncate">{it.label || `Arte #${idx + 1}`}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(it.id);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Excluir arte"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FOOTER SAVE BUTTON */}
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer mt-4 active:scale-98 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Concluir Layout de Impressão</span>
          </button>
        </div>
      </div>
    </div>
  );
};
