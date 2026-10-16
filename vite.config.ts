import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      },
      dedupe: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        'motion/react',
        'recharts',
        'xlsx',
      ],
      exclude: ['express', 'pg', 'jsonwebtoken', 'bcryptjs', 'dotenv', 'cors', '@google/genai'],
      entries: [
        'index.html',
      ],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      hmr: false,
      watch: {
        usePolling: true,
        interval: 200,
      },
    },
  };
});
