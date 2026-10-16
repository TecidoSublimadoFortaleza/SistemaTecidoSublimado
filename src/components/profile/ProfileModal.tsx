import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  Camera,
  X,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  RefreshCw,
  Sliders,
  Sparkles,
  Trash2,
  Image as ImageIcon,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Upload,
  CheckCircle2,
  Headphones,
} from 'lucide-react';
import { UserProfile } from '../../types/frontend';
import { ApiService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

export const DEFAULT_SUPPORT_AVATAR =
  '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSave: (updatedUser: UserProfile) => void | Promise<void>;
  initialTab?: 'profile' | 'password';
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
  initialTab = 'profile',
}) => {
  const { palette } = useTheme();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>(initialTab);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Permissão especial para alteração do Login de Acesso em "Alterar Minha Senha":
  // Apenas perfis ADMIN, DEVELOPER e CEO possuem essa permissão. Os demais mantêm o login fixo.
  const canEditLoginUsername = (() => {
    if (user.isDeveloper) return true;
    const roleStr = String(user.role || '').trim().toLowerCase();
    const uname = String(user.username || '').trim().toLowerCase();
    const nameStr = String(user.name || '').trim().toLowerCase();

    // Developer
    if (roleStr.includes('dev') || uname.includes('marcelo-dev')) return true;

    // CEO
    if (roleStr === 'ceo' || roleStr.includes('ceo') || uname.includes('ceo')) return true;

    // Admin (Admin Master, ADM MASTER, Administrador, Administrativo, Gerente Geral)
    if (
      roleStr.includes('admin') ||
      roleStr.includes('adm') ||
      roleStr.includes('master') ||
      roleStr.includes('gerente') ||
      roleStr.includes('diretoria') ||
      uname.includes('admin') ||
      nameStr.includes('admin') ||
      nameStr.includes('master')
    ) {
      return true;
    }

    return false;
  })();

  // Permissão para escolher a Foto Oficial do Suporte & Fazer Upload de imagens customizadas
  // Habilitado para Desenvolvedores, Administradores (ADM MASTER / Admin) e Direção
  const isDevOrAdmin = (() => {
    if (user.isDeveloper) return true;
    const roleStr = String(user.role || '').trim().toLowerCase();
    const uname = String(user.username || '').trim().toLowerCase();
    const nameStr = String(user.name || '').trim().toLowerCase();
    return (
      roleStr.includes('dev') ||
      roleStr.includes('desenvolvedor') ||
      roleStr.includes('admin') ||
      roleStr.includes('adm') ||
      roleStr.includes('master') ||
      roleStr.includes('diretoria') ||
      roleStr.includes('gerente') ||
      uname.includes('marcelo-dev') ||
      uname.includes('admin') ||
      nameStr.includes('master') ||
      nameStr.includes('marcelo')
    );
  })();

  const [loginUsername, setLoginUsername] = useState(user.username || '');

  // Foto Pessoal Registrada (Foto própria do usuário diferente da logo do suporte)
  const defaultPersonal = (() => {
    if (user.avatarUrl && user.avatarUrl !== '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png' && user.avatarUrl !== '/images/logo-suporte.svg' && !user.isSupportPhoto) return user.avatarUrl;
    if (user.isDeveloper || String(user.username || '').toLowerCase().includes('marcelo')) {
      return '/images/marcelo-perfil.svg';
    }
    return '';
  })();

  const [personalPhotoUrl, setPersonalPhotoUrl] = useState<string>(defaultPersonal);
  const [supportPhotoUrl, setSupportPhotoUrl] = useState<string>(user.supportAvatarUrl || DEFAULT_SUPPORT_AVATAR);
  const [isSupportPhotoSelected, setIsSupportPhotoSelected] = useState<boolean>(
    Boolean(user.isSupportPhoto || user.avatarUrl === DEFAULT_SUPPORT_AVATAR || user.avatarUrl === '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png' || user.avatarUrl === '/images/logo-suporte.svg')
  );
  const [uploadTargetType, setUploadTargetType] = useState<'personal' | 'support'>('personal');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // Framing & Cropping state
  const [isFramingOpen, setIsFramingOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [rotation, setRotation] = useState(0); // in degrees
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const cropViewportRef = useRef<HTMLDivElement>(null);

  // Wheel zoom handler with passive: false to prevent scrolling page
  useEffect(() => {
    const el = cropViewportRef.current;
    if (!el || !isFramingOpen) return;

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
  }, [isFramingOpen]);

  // Sync state when user changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'profile');
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone || '');
      setAvatarUrl(user.avatarUrl || '');
      setLoginUsername(user.username || '');
      setIsFramingOpen(false);
      setZoom(1.0);
      setOffsetX(0);
      setOffsetY(0);
      setRotation(0);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus({ type: 'idle', message: '' });

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, user, initialTab]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus({ type: 'idle', message: '' });

    const isChangingUsername = canEditLoginUsername && loginUsername.trim() !== user.username;
    if (isChangingUsername && loginUsername.trim().length < 3) {
      setPasswordStatus({
        type: 'error',
        message: 'O novo login de acesso deve possuir no mínimo 3 caracteres.',
      });
      return;
    }

    if (!newPassword || newPassword.trim().length < 4) {
      setPasswordStatus({
        type: 'error',
        message: 'A nova senha deve possuir no mínimo 4 caracteres.',
      });
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setPasswordStatus({
        type: 'error',
        message: 'A confirmação de senha não confere com a nova senha digitada.',
      });
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const res = await ApiService.changePassword({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
        confirmPassword: confirmPassword.trim(),
        username: user.username,
        userId: user.id,
        newUsername: canEditLoginUsername ? loginUsername.trim() : undefined,
      });

      // Se novos tokens foram emitidos pelo backend, atualiza para manter a sessão autenticada
      if (res.accessToken && res.refreshToken) {
        ApiService.setTokens(res.accessToken, res.refreshToken);
      }

      const effectiveNewUsername = res.newUsername || (isChangingUsername ? loginUsername.trim() : user.username);

      // Se o login foi alterado, atualiza o perfil do usuário logado na aplicação
      if (effectiveNewUsername !== user.username) {
        const updatedUserProfile: UserProfile = {
          ...user,
          username: effectiveNewUsername,
        };
        onSave(updatedUserProfile);
      }

      // Sincronizar cache de funcionários no localStorage
      try {
        const cached = localStorage.getItem('subligestao_employees_cache');
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const cleanUser = (user.username || '').trim().toLowerCase().replace(/^@/, '');
            const cleanName = (user.name || '').trim().toLowerCase();
            const cleanEmail = (user.email || '').trim().toLowerCase();
            let anyUpdated = false;

            const updatedList = list.map((emp: any) => {
              const empUser = (emp.loginUsuario || '').trim().toLowerCase().replace(/^@/, '');
              const empCode = (emp.codigo || '').trim().toLowerCase();
              const empFullName = `${emp.nome || ''} ${emp.sobrenome || ''}`.trim().toLowerCase();
              const empEmail = (emp.email || '').trim().toLowerCase();

              const isMatch =
                (empUser && empUser === cleanUser) ||
                (empCode && empCode === cleanUser) ||
                (emp.id && user.id && (emp.id === user.id || `USR-EMP-${emp.id}` === user.id)) ||
                (empEmail && cleanEmail && empEmail === cleanEmail) ||
                (empFullName && cleanName && (empFullName === cleanName || cleanName.includes(emp.nome?.toLowerCase() || '')));

              if (isMatch) {
                anyUpdated = true;
                return {
                  ...emp,
                  loginSenha: newPassword.trim(),
                  loginUsuario: isChangingUsername ? effectiveNewUsername : emp.loginUsuario,
                  updatedAt: new Date().toISOString(),
                };
              }
              return emp;
            });

            if (anyUpdated) {
              localStorage.setItem('subligestao_employees_cache', JSON.stringify(updatedList));
            }
          }
        }
      } catch (cacheErr) {
        console.warn('Aviso ao sincronizar cache de funcionários:', cacheErr);
      }

      // Notificar outros componentes abertos sobre a atualização de credenciais
      window.dispatchEvent(
        new CustomEvent('subligestao_employees_updated', {
          detail: {
            username: effectiveNewUsername,
            userId: user.id,
            newPassword: newPassword.trim(),
          },
        })
      );

      setPasswordStatus({
        type: 'success',
        message: res.message || 'Credenciais alteradas com sucesso! A nova senha está criptografada e sincronizada.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Após fazer a alteração, fecha a aba / modal automaticamente
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setPasswordStatus({
        type: 'error',
        message: err.message || 'Erro ao alterar credenciais. Verifique a senha atual digitada.',
      });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFramingOpen) {
          setIsFramingOpen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFramingOpen, onClose]);

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
        setRawImageSrc(result);
        setZoom(1.0);
        setOffsetX(0);
        setOffsetY(0);
        setRotation(0);
        setIsFramingOpen(true);
      };
      reader.readAsDataURL(file);
    }
    // reset input
    if (e.target) {
      e.target.value = '';
    }
  };

  // Open framing for current avatar if available
  const handleOpenFramingExisting = () => {
    if (avatarUrl) {
      setRawImageSrc(avatarUrl);
      setIsFramingOpen(true);
    } else {
      fileInputRef.current?.click();
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
    if (!rawImageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const outputSize = 400; // 400x400 high resolution avatar
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      // Fill background
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
      setAvatarUrl(framedDataUrl);
      if (uploadTargetType === 'support') {
        setSupportPhotoUrl(framedDataUrl);
        setIsSupportPhotoSelected(true);
      } else {
        setPersonalPhotoUrl(framedDataUrl);
        setIsSupportPhotoSelected(false);
      }
      setIsFramingOpen(false);
    };
    img.src = rawImageSrc;
  };

  const handleResetFraming = () => {
    setZoom(1.0);
    setOffsetX(0);
    setOffsetY(0);
    setRotation(0);
  };

  const handleRemovePhoto = () => {
    setAvatarUrl('');
    setRawImageSrc(null);
    setIsSupportPhotoSelected(false);
    setIsFramingOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const updated: UserProfile = {
        ...user,
        name: name.trim() || user.name,
        email: email.trim() || user.email,
        phone: phone.trim(),
        avatarUrl,
        supportAvatarUrl: isSupportPhotoSelected ? avatarUrl : (supportPhotoUrl || user.supportAvatarUrl),
        isSupportPhoto: isSupportPhotoSelected,
      };
      await onSave(updated);
      setIsSavingProfile(false);
      onClose();
    } catch {
      setIsSavingProfile(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border text-slate-800 font-sans my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        style={{
          borderColor: palette.isCustomPalette ? (palette.accentBorder || '#cbd5e1') : '#e2e8f0',
        }}
      >
        {/* Header com estilo adaptável ao tema ativo */}
        <div
          className="p-3.5 sm:p-4 text-white flex items-center justify-between shrink-0 shadow-xs transition-colors duration-200"
          style={{
            backgroundColor: palette.isCustomPalette ? palette.headerBg : '#2563EB',
            backgroundImage: palette.isCustomPalette
              ? `linear-gradient(135deg, ${palette.sidebarBg} 0%, ${palette.headerBg} 100%)`
              : 'linear-gradient(to right, #2563eb, #4f46e5)',
            color: palette.headerText,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-lg shadow-2xs"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: palette.headerText,
              }}
            >
              {activeTab === 'password' && !isFramingOpen ? (
                <KeyRound className="w-4 h-4" style={{ color: palette.headerText }} />
              ) : (
                <User className="w-4 h-4" style={{ color: palette.headerText }} />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight" style={{ color: palette.headerText }}>
                {isFramingOpen
                  ? 'Enquadramento da Foto'
                  : activeTab === 'password'
                  ? canEditLoginUsername
                    ? 'Alterar Login & Senha'
                    : 'Alterar Minha Senha'
                  : 'Editar Meu Perfil & Foto'}
              </h3>
              <p className="text-[10px] font-medium" style={{ color: palette.headerText, opacity: 0.88 }}>
                {isFramingOpen
                  ? 'Ajuste zoom, posição e rotação'
                  : `Usuário: @${user.username || user.name.toLowerCase().replace(/\s+/g, '')}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 active:bg-white/30 rounded-lg transition-colors cursor-pointer"
            style={{ color: palette.headerText }}
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher com Realce Cromático do Tema */}
        {!isFramingOpen && (
          <div className="flex border-b border-slate-200 bg-slate-50/90 px-4 pt-2 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'profile'
                  ? palette.isCustomPalette ? '' : 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              style={
                activeTab === 'profile' && palette.isCustomPalette
                  ? {
                      borderColor: palette.activeItemBg || palette.headerBg,
                      color: palette.activeItemBg || palette.headerBg,
                    }
                  : undefined
              }
            >
              <User className="w-3.5 h-3.5" />
              <span>Dados do Perfil</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'password'
                  ? palette.isCustomPalette ? '' : 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              style={
                activeTab === 'password' && palette.isCustomPalette
                  ? {
                      borderColor: palette.activeItemBg || palette.headerBg,
                      color: palette.activeItemBg || palette.headerBg,
                    }
                  : undefined
              }
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{canEditLoginUsername ? 'Alterar Login & Senha' : 'Alterar Senha'}</span>
            </button>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Framing / Cropping Mode */}
        {isFramingOpen && rawImageSrc ? (
          <div className="p-4 space-y-4 overflow-y-auto touch-scroll flex-1">
            <div className="text-center">
              <p className="text-xs font-bold text-slate-700">
                Arraste a imagem para reposicionar e use os controles abaixo
              </p>
              <p className="text-[11px] text-slate-500">
                A foto será enquadrada perfeitamente no formato do seu avatar
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
                className="relative w-60 h-60 bg-slate-900 rounded-2xl overflow-hidden border-2 shadow-inner flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                style={{
                  borderColor: palette.isCustomPalette ? (palette.activeItemBg || palette.headerBg) : '#3b82f6',
                  touchAction: 'none',
                }}
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
                    src={rawImageSrc}
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
                  <div className="border-r border-white/30" />
                  <div className="border-r border-white/30" />
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
                onClick={() => setIsFramingOpen(false)}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleApplyFraming}
                className="flex-1 py-2 px-3 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-98"
                style={{
                  backgroundColor: palette.isCustomPalette ? (palette.activeItemBg || palette.headerBg) : '#059669',
                  color: palette.isCustomPalette ? (palette.activeItemText || '#FFFFFF') : '#FFFFFF',
                }}
              >
                <Check className="w-4 h-4" />
                <span>Aplicar Enquadramento</span>
              </button>
            </div>
          </div>
        ) : activeTab === 'password' ? (
          /* Password Change Mode */
          <form onSubmit={handleChangePassword} className="p-4 sm:p-5 space-y-4 overflow-y-auto touch-scroll flex-1">
            <div
              className="p-3 border rounded-2xl flex items-start gap-2.5 transition-colors"
              style={{
                backgroundColor: palette.isCustomPalette ? `${palette.headerBg}12` : '#eff6ff',
                borderColor: palette.isCustomPalette ? `${palette.headerBg}35` : '#bfdbfe',
              }}
            >
              <div
                className="p-1.5 rounded-xl shrink-0 mt-0.5 shadow-xs"
                style={{
                  backgroundColor: palette.isCustomPalette ? palette.headerBg : '#2563EB',
                  color: palette.headerText,
                }}
              >
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div
                className="text-xs leading-relaxed"
                style={{
                  color: palette.isCustomPalette ? (palette.sidebarFooterBg || '#1e3a8a') : '#1e3a8a',
                }}
              >
                <p className="font-extrabold text-[12px]">
                  {canEditLoginUsername ? 'Segurança & Credenciais de Acesso' : 'Segurança da Conta'}
                </p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  {canEditLoginUsername
                    ? 'Perfis Admin, Developer e CEO possuem permissão para atualizar seu Login de Acesso e Senha com criptografia forte (Bcrypt).'
                    : 'Atualize sua senha de acesso. A nova credencial é protegida com criptografia forte (Bcrypt 12 rounds) e salva com segurança no banco de dados.'}
                </p>
              </div>
            </div>

            {/* Status notification */}
            {passwordStatus.type !== 'idle' && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in duration-150 ${
                  passwordStatus.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
              >
                {passwordStatus.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-semibold">{passwordStatus.message}</span>
              </div>
            )}

            {/* Login de Acesso (Editável para Admin, Developer e CEO; Fixo para os demais perfis) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Login de Acesso (Usuário)
                </label>
                {canEditLoginUsername ? (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border"
                    style={{
                      backgroundColor: palette.isCustomPalette ? `${palette.headerBg}15` : '#eff6ff',
                      color: palette.isCustomPalette ? palette.headerBg : '#1d4ed8',
                      borderColor: palette.isCustomPalette ? `${palette.headerBg}35` : '#bfdbfe',
                    }}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    Edição Permitida: {user.role || 'Admin'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                    <Lock className="w-3 h-3 text-slate-400" />
                    Fixo para este perfil
                  </span>
                )}
              </div>

              {canEditLoginUsername ? (
                <div className="relative">
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Digite o novo login de acesso"
                    required
                    minLength={3}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={user.username}
                    readOnly
                    disabled
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed select-all"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}
              <p className="text-[10px] text-slate-500 mt-1">
                {canEditLoginUsername
                  ? 'Como Admin, Developer ou CEO, você pode alterar o login usado para entrar no sistema.'
                  : 'O login deste perfil é fixo. Apenas perfis Admin, Developer e CEO podem alterar o login de acesso.'}
              </p>
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Senha Atual
              </label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                  required
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title={showCurrentPass ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Nova Senha (Mínimo 4 caracteres)
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite sua nova senha"
                  required
                  minLength={4}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title={showNewPass ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha para confirmação"
                  required
                  minLength={4}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title={showConfirmPass ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password match indicator */}
            {newPassword && confirmPassword && (
              <div className="text-[11px] font-bold flex items-center gap-1.5">
                {newPassword === confirmPassword ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> As senhas conferem
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> As senhas não conferem
                  </span>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  isSubmittingPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword !== confirmPassword ||
                  (canEditLoginUsername && loginUsername.trim().length < 3)
                }
                className="flex-1 py-2.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-98"
                style={{
                  backgroundColor: palette.isCustomPalette ? (palette.activeItemBg || palette.headerBg) : '#059669',
                  color: palette.isCustomPalette ? (palette.activeItemText || '#FFFFFF') : '#FFFFFF',
                }}
              >
                {isSubmittingPassword ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>
                      {canEditLoginUsername && loginUsername.trim() !== user.username
                        ? 'Salvar Login e Nova Senha'
                        : 'Salvar Nova Senha'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Normal Profile Edit Mode */
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto touch-scroll flex-1">
            {/* Avatar Preview & Actions */}
            <div className="flex flex-col items-center justify-center p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200 shadow-2xs">
              <div
                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-white border-2 shadow-md group"
                style={{
                  borderColor: palette.isCustomPalette ? (palette.activeItemBg || palette.headerBg) : '#2563EB',
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-black text-slate-400 bg-slate-100">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}

                <label
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold">Alterar Foto</span>
                </label>
              </div>

              {/* Status indicator */}
              {isSupportPhotoSelected || avatarUrl === supportPhotoUrl || avatarUrl === '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png' || avatarUrl === '/images/logo-suporte.svg' ? (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-100 text-blue-900 rounded-full text-[10px] font-extrabold border border-blue-300">
                  <Headphones className="w-3 h-3 text-blue-600" />
                  <span>Foto Oficial do Suporte do Sistema Ativa</span>
                </div>
              ) : avatarUrl ? (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 rounded-full text-[10px] font-extrabold border border-emerald-300">
                  <User className="w-3 h-3 text-emerald-600" />
                  <span>Foto Própria Pessoal Ativa</span>
                </div>
              ) : null}

              {/* Quick Choice Buttons for Dev and Admin */}
              {isDevOrAdmin ? (
                <div className="w-full mt-3 pt-3 border-t border-slate-200 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Foto do Perfil (Própria vs Suporte)
                    </span>
                    <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                      TI & Gestão
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* 1. Opção Foto Própria */}
                    <div className="flex flex-col gap-1 p-2 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                          <User className="w-3 h-3 text-emerald-600" />
                          Foto Própria
                        </span>
                        {!isSupportPhotoSelected && avatarUrl && (
                          <Check className="w-3 h-3 text-emerald-600" />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const target = personalPhotoUrl || defaultPersonal;
                            setAvatarUrl(target);
                            setIsSupportPhotoSelected(false);
                          }}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center cursor-pointer border ${
                            !isSupportPhotoSelected && avatarUrl
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                              : 'bg-white hover:bg-emerald-50 text-emerald-800 border-slate-300'
                          }`}
                          title="Usar sua foto própria de perfil"
                        >
                          Usar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadTargetType('personal');
                            fileInputRef.current?.click();
                          }}
                          className="px-2 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                          title="Fazer upload de nova foto pessoal"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Upload</span>
                        </button>
                      </div>
                    </div>

                    {/* 2. Opção Foto Suporte */}
                    <div className="flex flex-col gap-1 p-2 rounded-xl bg-blue-50/70 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-900 flex items-center gap-1">
                          <Headphones className="w-3 h-3 text-blue-600" />
                          Foto Suporte
                        </span>
                        {isSupportPhotoSelected && (
                          <Check className="w-3 h-3 text-blue-600" />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarUrl(supportPhotoUrl || DEFAULT_SUPPORT_AVATAR);
                            setIsSupportPhotoSelected(true);
                          }}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center cursor-pointer border ${
                            isSupportPhotoSelected
                              ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                              : 'bg-white hover:bg-blue-50 text-blue-800 border-blue-300'
                          }`}
                          title="Usar a logo/foto do Suporte do Sistema"
                        >
                          Usar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadTargetType('support');
                            fileInputRef.current?.click();
                          }}
                          className="px-2 py-1.5 bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                          title="Fazer upload de nova foto para o Suporte do Sistema"
                        >
                          <Upload className="w-3 h-3 text-blue-600" />
                          <span>Upload</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 text-center leading-tight">
                    Ao atualizar em <strong className="text-blue-700 font-bold">Foto Suporte</strong>, a nova imagem é sincronizada para todos os canais e cabeçalhos de <strong>Suporte do Sistema</strong>.
                  </p>

                  {/* Secondary actions: Edit Framing & Remove */}
                  {avatarUrl && (
                    <div className="flex items-center justify-center gap-2 mt-0.5">
                      <button
                        type="button"
                        onClick={handleOpenFramingExisting}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Editar zoom, rotação e enquadramento da foto"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Ajustar Foto</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Remover foto e usar inicial"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Standard user photo controls */
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Foto</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleOpenFramingExisting}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Editar zoom, rotação e enquadramento da foto atual"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                  )}

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs transition cursor-pointer shadow-2xs"
                      title="Remover foto e usar inicial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Editable Fields */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                E-mail Corporativo
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(85) 99999-9999"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {/* Read-only System Badges */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Cargo:</span>
                <span className="font-bold text-slate-900">
                  {user.isDeveloper || user.role === 'Developer' || user.username?.toLowerCase().includes('marcelo-dev') ? 'Desenvolvedor' : user.role}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Setor:</span>
                <span className="font-bold text-slate-900">
                  {user.isDeveloper || user.role === 'Developer' || user.username?.toLowerCase().includes('marcelo-dev') ? 'Suporte' : user.sector}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Filial:</span>
                <span className="font-bold text-slate-900 truncate max-w-[200px]">{user.branch}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSavingProfile}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="flex-1 py-2.5 px-4 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-98"
                style={{
                  backgroundColor: palette.isCustomPalette ? (palette.activeItemBg || palette.headerBg) : '#2563EB',
                  color: palette.isCustomPalette ? (palette.activeItemText || '#FFFFFF') : '#FFFFFF',
                }}
              >
                {isSavingProfile ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {isSavingProfile ? 'Salvando Perfil...' : 'Salvar Perfil'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};
