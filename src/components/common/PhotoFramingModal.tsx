import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  RefreshCw,
  Sliders,
  Sparkles,
  Crop,
  Image as ImageIcon,
} from 'lucide-react';

export interface PhotoFramingModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string | null;
  onApply: (framedDataUrl: string) => void;
  title?: string;
  subtitle?: string;
}

export const PhotoFramingModal: React.FC<PhotoFramingModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  onApply,
  title = 'Enquadramento da Foto',
  subtitle = 'Ajuste zoom, posição e rotação da foto',
}) => {
  const [currentRawSrc, setCurrentRawSrc] = useState<string | null>(imageSrc);
  const [zoom, setZoom] = useState(1.0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [rotation, setRotation] = useState(0); // in degrees
  const [isDragging, setIsDragging] = useState(false);

  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const cropViewportRef = useRef<HTMLDivElement>(null);

  // Sync image source and reset position when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentRawSrc(imageSrc);
      setZoom(1.0);
      setOffsetX(0);
      setOffsetY(0);
      setRotation(0);

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, imageSrc]);

  // Wheel zoom handler with passive: false to prevent scrolling page
  useEffect(() => {
    const el = cropViewportRef.current;
    if (!el || !isOpen) return;

    const onWheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomStep = 0.08;
      const direction = e.deltaY < 0 ? 1 : -1;
      setZoom((prev) => {
        const nextZoom = prev + direction * zoomStep;
        return Math.min(3.0, Math.max(0.8, Number(nextZoom.toFixed(2))));
      });
    };

    el.addEventListener('wheel', onWheelHandler, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheelHandler);
    };
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle outside click on backdrop
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setCurrentRawSrc(result);
        setZoom(1.0);
        setOffsetX(0);
        setOffsetY(0);
        setRotation(0);
      };
      reader.readAsDataURL(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  // Drag to pan image inside framing box
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartOffset.current = { x: offsetX, y: offsetY };
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;
      setOffsetX(dragStartOffset.current.x + deltaX);
      setOffsetY(dragStartOffset.current.y + deltaY);
    },
    [isDragging]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch drag for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragStartOffset.current = { x: offsetX, y: offsetY };
    }
  };

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - dragStartPos.current.x;
      const deltaY = e.touches[0].clientY - dragStartPos.current.y;
      setOffsetX(dragStartOffset.current.x + deltaX);
      setOffsetY(dragStartOffset.current.y + deltaY);
    },
    [isDragging]
  );

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Generate framed canvas result
  const handleApplyFraming = () => {
    if (!currentRawSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const outputSize = 400; // 400x400 high resolution avatar
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      // Fill clean background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outputSize, outputSize);

      ctx.save();
      // Move to center of canvas
      ctx.translate(outputSize / 2, outputSize / 2);

      // Rotate
      ctx.rotate((rotation * Math.PI) / 180);

      // Scale factor mapping from framing preview (preview box size: 240px)
      const previewBoxSize = 240;
      const scaleMultiplier = outputSize / previewBoxSize;

      // Translate offset
      ctx.translate(offsetX * scaleMultiplier, offsetY * scaleMultiplier);

      // Draw image scaled
      const minDim = Math.min(img.width, img.height);
      const baseScale = previewBoxSize / minDim;
      const finalWidth = img.width * baseScale * zoom * scaleMultiplier;
      const finalHeight = img.height * baseScale * zoom * scaleMultiplier;

      ctx.drawImage(img, -finalWidth / 2, -finalHeight / 2, finalWidth, finalHeight);
      ctx.restore();

      const framedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      onApply(framedDataUrl);
      onClose();
    };
    img.src = currentRawSrc;
  };

  const handleResetFraming = () => {
    setZoom(1.0);
    setOffsetX(0);
    setOffsetY(0);
    setRotation(0);
  };

  if (!isOpen || !currentRawSrc) return null;

  return createPortal(
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 text-slate-800 font-sans my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-4 py-3 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <Crop className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-black text-sm tracking-tight">{title}</h2>
              <p className="text-[10px] text-blue-100 font-medium">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 active:bg-white/30 rounded-lg transition-colors cursor-pointer text-white"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden File Input for Image Replacement */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Framing & Cropping Body */}
        <div className="p-4 space-y-4 overflow-y-auto touch-scroll flex-1">
          <div className="text-center">
            <p className="text-xs font-bold text-slate-700">
              Arraste a imagem para reposicionar e use os controles abaixo
            </p>
            <p className="text-[11px] text-slate-500">
              A foto será enquadrada perfeitamente no formato do avatar do cliente
            </p>
          </div>

          {/* Interactive Crop Viewport */}
          <div className="flex justify-center">
            <div
              ref={cropViewportRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="relative w-60 h-60 bg-slate-900 rounded-2xl overflow-hidden border-2 border-blue-500 shadow-inner flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
              style={{ touchAction: 'none' }}
            >
              {/* Image Container with Transforms */}
              <div
                className="w-full h-full flex items-center justify-center pointer-events-none"
                style={{
                  transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.08s ease-out',
                }}
              >
                <img
                  ref={previewImageRef}
                  src={currentRawSrc}
                  alt="Preview de Enquadramento"
                  className="max-w-none max-h-none object-contain pointer-events-none"
                  style={{
                    width: '240px',
                    height: '240px',
                  }}
                  draggable={false}
                />
              </div>

              {/* Circular Crop Overlay Guide */}
              <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)]" />

              {/* Rule of Thirds Grid Lines inside circle */}
              <div className="absolute inset-4 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-30 border border-white/40 rounded-full">
                <div className="border-r border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div />
              </div>

              {/* Drag & Wheel Zoom Hint Badge */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-slate-900/85 backdrop-blur-xs text-white text-[9px] font-bold rounded-full pointer-events-none flex items-center gap-1.5 border border-white/20 whitespace-nowrap shadow-sm">
                <Move className="w-2.5 h-2.5 text-blue-400" />
                <span>Arraste para mover • Scroll para zoom</span>
              </div>
            </div>
          </div>

          {/* Framing Controls Panel */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
            {/* Zoom Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <ZoomIn className="w-3.5 h-3.5 text-blue-600" />
                  Zoom ({Math.round(zoom * 100)}%)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setZoom((prev) => Math.max(0.8, Number((prev - 0.1).toFixed(1))))}
                    className="p-1 bg-white hover:bg-slate-200 border border-slate-200 rounded text-slate-700 cursor-pointer"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((prev) => Math.min(3.0, Number((prev + 0.1).toFixed(1))))}
                    className="p-1 bg-white hover:bg-slate-200 border border-slate-200 rounded text-slate-700 cursor-pointer"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="0.8"
                max="3.0"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Offset X & Y Precision Controls */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span>Posição Horiz. (X)</span>
                  <span className="text-slate-400">{offsetX}px</span>
                </div>
                <input
                  type="range"
                  min="-120"
                  max="120"
                  step="2"
                  value={offsetX}
                  onChange={(e) => setOffsetX(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span>Posição Vert. (Y)</span>
                  <span className="text-slate-400">{offsetY}px</span>
                </div>
                <input
                  type="range"
                  min="-120"
                  max="120"
                  step="2"
                  value={offsetY}
                  onChange={(e) => setOffsetY(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>

            {/* Rotate & Presets */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                <span>Girar 90°</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResetFraming}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
                  title="Centralizar e resetar enquadramento"
                >
                  <RefreshCw className="w-3 h-3 text-slate-500" />
                  <span>Centralizar</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-blue-600 flex items-center gap-1 cursor-pointer"
                  title="Escolher outra imagem do computador"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Trocar Foto</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons for Framing */}
          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition"
            >
              Voltar / Cancelar
            </button>
            <button
              type="button"
              onClick={handleApplyFraming}
              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar Enquadramento</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
