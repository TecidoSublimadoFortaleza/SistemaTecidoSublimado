import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
  decay: number;
  type: 'confetti' | 'spark' | 'firework';
  rotation?: number;
  rotationSpeed?: number;
  wobble?: number;
  wobbleSpeed?: number;
}

const FESTIVE_COLORS = [
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#fbbf24', // yellow gold
  '#ffffff', // pure spark
];

export const BirthdayCelebrationCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const particles: Particle[] = [];

    // Spawns a firework explosion burst at (x, y)
    const createFirework = (x: number, y: number) => {
      const color = FESTIVE_COLORS[Math.floor(Math.random() * FESTIVE_COLORS.length)];
      const particleCount = 45 + Math.floor(Math.random() * 35);

      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.3;
        const speed = 2 + Math.random() * 6;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color: Math.random() > 0.3 ? color : '#ffffff',
          size: 2 + Math.random() * 3,
          decay: 0.015 + Math.random() * 0.015,
          type: 'firework',
        });
      }
    };

    // Spawns continuous drifting confetti pieces
    const spawnConfetti = () => {
      if (particles.length > 350) return;
      const count = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: -10,
          vx: (Math.random() - 0.5) * 3,
          vy: 2 + Math.random() * 3.5,
          alpha: 1,
          color: FESTIVE_COLORS[Math.floor(Math.random() * FESTIVE_COLORS.length)],
          size: 6 + Math.random() * 8,
          decay: 0.002,
          type: 'confetti',
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 8,
          wobble: 0,
          wobbleSpeed: 0.05 + Math.random() * 0.08,
        });
      }
    };

    // Initial fireworks bursts
    createFirework(width * 0.25, height * 0.3);
    createFirework(width * 0.75, height * 0.25);
    createFirework(width * 0.5, height * 0.4);

    let lastFireworkTime = Date.now();
    let fireworkInterval = 450; // New firework every ~450ms

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Periodically spawn fireworks
      const now = Date.now();
      if (now - lastFireworkTime > fireworkInterval) {
        const x = width * (0.15 + Math.random() * 0.7);
        const y = height * (0.15 + Math.random() * 0.45);
        createFirework(x, y);
        lastFireworkTime = now;
        fireworkInterval = 350 + Math.random() * 300;
      }

      // Constantly add falling confetti
      spawnConfetti();

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (p.type === 'confetti') {
          p.x += p.vx + Math.sin(p.wobble || 0) * 1.5;
          p.y += p.vy;
          p.wobble = (p.wobble || 0) + (p.wobbleSpeed || 0.05);
          p.rotation = (p.rotation || 0) + (p.rotationSpeed || 2);

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(((p.rotation || 0) * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();

          if (p.y > height + 20) {
            particles.splice(i, 1);
            continue;
          }
        } else {
          // Fireworks & sparkles
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.07; // Gravity
          p.vx *= 0.97; // Drag
          p.vy *= 0.97;
          p.alpha -= p.decay;

          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.alpha), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fill();
          ctx.restore();

          if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-30 w-full h-full"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};
