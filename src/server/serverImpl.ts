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
  const app = express();

  // 1. Synchronize database from Postgres before initializing seed and accepting requests
  try {
    await checkDatabaseConnection();
    await Database.getInstance().initialize();
    OsRepository.sanitizeDuplicateCodes();
    syncAllLocalPublicImagesToSupabase().catch(() => {});
    console.log('[Server] Banco de dados Supabase e repositórios sincronizados com sucesso!');
  } catch (err) {
    console.error('[Server] Sincronização inicial falhou, operando em contingência:', err);
  }

  // 2. Initialize DB Seed Script without overriding existing profiles/passwords
  initializeDatabaseSeed();

  // Periodic background sync from Supabase to keep instances in lockstep without saturating database connection
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

  // 2. Security Headers & CORS Setup
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Developer-Password', 'x-developer-password'],
    })
  );

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 3. Rate Limiting for API routes
  app.use('/api', rateLimiterMiddleware);

  // 4. API Routes Registration
  app.use('/api', apiRouter);

  // Direct route for support avatar (serves the exact requested file directly with 200 OK)
  app.get('/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png', (req, res) => {
    const localImg = path.join(process.cwd(), 'public/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png');
    if (fs.existsSync(localImg)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(localImg);
    }
    const fallback = path.join(process.cwd(), 'public/images/icon-512.png');
    if (fs.existsSync(fallback)) {
      res.setHeader('Content-Type', 'image/png');
      return res.sendFile(fallback);
    }
    res.status(404).send('Avatar not found');
  });

  // 5. Health Check Endpoint (Para Cloud Run, Render e monitoramento de saúde)
  const healthCheckHandler = async (_req: express.Request, res: express.Response) => {
    let databaseStatus = 'disconnected';
    let databaseMessage = '';
    try {
      const qRes = await pgPool.query('SELECT NOW() as server_time, current_database() as db_name');
      if (qRes.rows && qRes.rows.length > 0) {
        databaseStatus = 'CONNECTED_SUPABASE_POSTGRES';
        databaseMessage = `Conectado ao banco: ${qRes.rows[0].db_name} (${qRes.rows[0].server_time})`;
      }
    } catch (err: any) {
      databaseStatus = 'OFFLINE_OR_MEMORY_MODE';
      databaseMessage = 'Serviço operacional (banco em modo de contingência)';
    }

    res.json({
      status: 'ONLINE',
      system: 'ERP SubliGestão Enterprise Engine',
      database: databaseStatus,
      message: databaseMessage,
      timestamp: new Date().toISOString(),
    });
  };

  app.get('/health', healthCheckHandler);
  app.get('/api/health', healthCheckHandler);

  // 5.1 API 404 Catch-All (Ensure API endpoints never fall through to Vite SPA index.html)
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `Endpoint ${req.method} ${req.originalUrl} não encontrado no servidor de API.`,
      code: 'API_ROUTE_NOT_FOUND',
    });
  });

  // 5.1 Universal Image Handler with Cross-Server Supabase Sync (Render <-> Google AI)
  app.get('/images/:subpath(*)', async (req, res, next) => {
    const subpath = req.params.subpath;
    const localFile = path.join(process.cwd(), 'public/images', subpath);

    // Se o arquivo existe no disco local deste container, serve diretamente
    if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
      return res.sendFile(localFile);
    }

    // Se NÃO existe no disco local (ex: adicionado no Render ou Google IA), busca no Supabase
    try {
      const fromDb = await getImageFromSupabase(`/images/${subpath}`);
      if (fromDb && fromDb.data) {
        const matches = fromDb.data.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches[2]) {
          const buf = Buffer.from(matches[2], 'base64');
          // Salva em cache no disco local para que as próximas requisições sejam instantâneas
          try {
            if (!fs.existsSync(path.dirname(localFile))) {
              fs.mkdirSync(path.dirname(localFile), { recursive: true });
            }
            fs.writeFileSync(localFile, buf);
          } catch (_) {}

          res.setHeader('Content-Type', matches[1] || fromDb.mimeType || 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=2592000');
          return res.send(buf);
        }
      }
    } catch (_) {}

    // Fallbacks padrão caso seja uma imagem temática inexistente
    if (subpath.startsWith('themes/')) {
      const fallbackNatalino = path.join(process.cwd(), 'public/images/natalino-fundo.png');
      if (fs.existsSync(fallbackNatalino)) {
        res.setHeader('Content-Type', 'image/png');
        return res.sendFile(fallbackNatalino);
      }
      const fallbackDefault = path.join(process.cwd(), 'public/Login-fundo.jpg');
      if (fs.existsSync(fallbackDefault)) {
        res.setHeader('Content-Type', 'image/jpeg');
        return res.sendFile(fallbackDefault);
      }
    }
    next();
  });

  // 5.2 Serve public images with aggressive HTTP caching for instant rendering
  app.use(
    '/images',
    express.static(path.join(process.cwd(), 'public/images'), {
      maxAge: '30d',
      etag: true,
    })
  );
  app.use(
    '/image',
    express.static(path.join(process.cwd(), 'public/images'), {
      maxAge: '30d',
      etag: true,
    })
  );
  app.use(
    express.static(path.join(process.cwd(), 'public'), {
      maxAge: '30d',
      etag: true,
    })
  );

  // 6. Vite Integration (Development Middleware vs Production Static Assets)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), 'vite.config.ts'),
      root: process.cwd(),
      server: {
        middlewareMode: true,
        hmr: false,
        watch: {
          usePolling: true,
          interval: 200,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const htmlPath = path.join(distPath, 'index.html');
      try {
        let html = fs.readFileSync(htmlPath, 'utf-8');
        const host = req.get('host') || 'subligestao-erp-v2.onrender.com';
        const rawProto = req.headers['x-forwarded-proto'];
        const protocol = typeof rawProto === 'string' ? rawProto.split(',')[0].trim() : (req.protocol || 'https');
        const baseUrl = `${protocol}://${host}`;
        html = html.replace(/https:\/\/subligestao-erp-v2\.onrender\.com/g, baseUrl);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch {
        res.sendFile(htmlPath);
      }
    });
  }

  // 7. Global Exception Handler
  app.use(globalErrorHandler);

  // 8. Start Listening on Port 3000 (0.0.0.0 host binding)
  const server = app.listen(PORT, '0.0.0.0', () => {
    let networkIp: string | null = null;
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          if (iface.family === 'IPv4' && !iface.internal) {
            networkIp = iface.address;
            break;
          }
        }
        if (networkIp) break;
      }
    } catch {}

    console.log(`====================================================`);
    console.log(`[ERP SubliGestão] Servidor Backend Ativo:`);
    console.log(`  ➜ No seu computador:  http://localhost:${PORT}`);
    if (networkIp) {
      console.log(`  ➜ Na rede local/Wi-Fi: http://${networkIp}:${PORT}`);
    } else {
      console.log(`  ➜ Na rede local/Wi-Fi: http://127.0.0.1:${PORT}`);
    }
    console.log(`[Segurança] Login de Desenvolvedor inicializado: @Marcelo-dev`);
    console.log(`====================================================`);
  });

  server.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE') {
      console.error(`\n[ERRO] A porta ${PORT} já está em uso por outro processo no seu computador.`);
      console.error(`[DICA Windows] Para liberar a porta 3000, rode no terminal:`);
      console.error(`  npx kill-port ${PORT}\n`);
    } else {
      console.error('\n[ERRO no servidor]:', err);
    }
  });
}

startEnterpriseServer().catch((err) => {
  console.error('[FATAL] Falha ao iniciar o servidor ERP:', err);
  process.exit(1);
});
