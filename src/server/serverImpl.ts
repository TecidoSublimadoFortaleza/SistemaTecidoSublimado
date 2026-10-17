import { Database } from './db/database';
import { OsRepository } from './repositories/OsRepository';
import { ChatRepository } from './repositories/ChatRepository';
import { pgPool, checkDatabaseConnection } from './db/postgres';
import {
  getImageFromSupabase,
  syncAllLocalPublicImagesToSupabase,
} from './db/imageStorage';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './routes/apiRouter';
import { rateLimiterMiddleware } from './middlewares/rateLimiter';
import { globalErrorHandler } from './middlewares/errorHandler';
import { initializeDatabaseSeed } from './db/seed';

export async function startEnterpriseServer() {
  const portArgIndex = process.argv.indexOf('--port');
  const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? Number(process.argv[portArgIndex + 1]) : null;
  const envPort = process.env.PORT ? Number(process.env.PORT) : null;
  const PORT = cliPort || envPort || 3000;
  const HOST = '0.0.0.0';
  const app = express();

  console.log(`[Server] Iniciando servidor Express na porta ${PORT} (${HOST})...`);

  // 1. Start listening IMMEDIATELY to prevent Hostinger 503 Gateway Timeout
  const server = app.listen(PORT, HOST, () => {
    console.log(`[Server] Servidor escutando ativamente em http://${HOST}:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('[Server Error]:', err);
  });

  // 2. Synchronize database and seed in background (non-blocking)
  setTimeout(async () => {
    try {
      await checkDatabaseConnection();
      await Database.getInstance().initialize();
      OsRepository.sanitizeDuplicateCodes();
      syncAllLocalPublicImagesToSupabase().catch(() => {});
      console.log('[Server] Banco de dados Supabase e repositórios sincronizados com sucesso!');
    } catch (err) {
      console.error('[Server] Sincronização inicial falhou, operando em contingência:', err);
    }
    initializeDatabaseSeed();
  }, 100);

  // Periodic background sync from Supabase
  setInterval(async () => {
    try {
      const db = Database.getInstance();
      await Promise.allSettled([
        db.syncCollection('products'),
        db.syncCollection('orders'),
        db.syncCollection('employees'),
        db.syncCollection('clients'),
        db.syncCollection('users'),
        db.syncCollection('branches'),
        db.syncCollection('permissions'),
        db.syncCollection('themes'),
      ]);
    } catch (_) {}
  }, 12000);

  // 3. Security Headers & CORS Setup
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.url.startsWith('/api') && duration > 1500) {
        console.log(`[API Slow] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // 4. Rate Limiter
  app.use('/api/', rateLimiterMiddleware);

  // 5. API Router
  app.use('/api/v1', apiRouter);

  // Health check endpoint for Hostinger
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // 6. Static frontend serving in production
  const isProduction = process.env.NODE_ENV === 'production' || process.env.PORT || fs.existsSync(path.resolve(process.cwd(), 'dist')) || fs.existsSync(path.resolve(process.cwd(), 'build/dist'));
  
  if (isProduction) {
    const possibleDistPaths = [
      path.resolve(process.cwd(), 'dist'),
      path.resolve(process.cwd(), 'build/dist'),
      path.resolve(process.cwd(), 'public'),
    ];

    let staticDir = possibleDistPaths.find((p) => fs.existsSync(p));
    if (!staticDir) staticDir = possibleDistPaths[0];

    console.log(`[Production] Servindo arquivos estáticos de: ${staticDir}`);
    app.use(express.static(staticDir));

    app.get('*', (req, res, next) => {
      if (req.url.startsWith('/api')) {
        return next();
      }
      const htmlPath = path.join(staticDir!, 'index.html');
      if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
      } else {
        res.status(404).send('Application bundle not found. Please verify build output.');
      }
    });
  } else {
    // Development Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // 7. Global Exception Handler
  app.use(globalErrorHandler);
}

startEnterpriseServer().catch((err) => {
  console.error('[FATAL] Falha ao iniciar o servidor ERP:', err);
  process.exit(1);
});
