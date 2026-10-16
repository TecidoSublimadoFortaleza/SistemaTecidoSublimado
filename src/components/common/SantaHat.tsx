import React from 'react';

interface SantaHatProps {
  className?: string;
}

export const SantaHat: React.FC<SantaHatProps> = ({ className = 'w-8 h-8' }) => {
  return (
    <svg
      viewBox="-20 -25 140 140"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible', display: 'block' }}
    >
      {/* Gorro vermelho com sombra e curva suave */}
      <path
        d="M20 70 C 25 35, 45 15, 78 20 C 85 22, 88 30, 82 40 C 72 50, 78 65, 82 70 Z"
        fill="#DC2626"
      />
      <path
        d="M28 68 C 32 40, 48 22, 75 22 C 70 32, 65 48, 75 68 Z"
        fill="#B91C1C"
        opacity="0.3"
      />
      {/* Pompom branco na ponta */}
      <circle cx="82" cy="22" r="11" fill="#FFFFFF" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
      <circle cx="82" cy="22" r="9" fill="#F8FAFC" />
      {/* Barra de pelos branca na base */}
      <rect
        x="10"
        y="63"
        width="80"
        height="20"
        rx="10"
        fill="#FFFFFF"
        filter="drop-shadow(0 4px 6px rgba(0,0,0,0.15))"
      />
      <rect
        x="13"
        y="66"
        width="74"
        height="14"
        rx="7"
        fill="#F1F5F9"
      />
    </svg>
  );
};
