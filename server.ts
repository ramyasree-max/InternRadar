import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { closeDatabase, getStorageStatus, initDatabase } from './server/db.ts';
import { authRouter } from './server/routes/auth.ts';
import { internshipsRouter } from './server/routes/internships.ts';
import { workspaceRouter } from './server/routes/workspace.ts';
import { startHourlyMonitoring, stopHourlyMonitoring } from './server/services/scheduler.ts';

async function startServer() {
  await initDatabase();

  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  // Simple in-memory rate limiter for API protection
  const hits = new Map<string, { count: number; resetAt: number }>();
  app.use('/api', (req, res, next) => {
    const key = req.ip || 'local';
    const now = Date.now();
    const record = hits.get(key);
    if (!record || now > record.resetAt) {
      hits.set(key, { count: 1, resetAt: now + 60_000 });
    } else {
      record.count++;
      if (record.count > 240) {
        res.status(429).json({ error: 'Too many requests. Please slow down.' });
        return;
      }
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'InternRadar',
      storage: getStorageStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', internshipsRouter);
  app.use('/api', workspaceRouter);

  app.use('/api', (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[InternRadar API Error]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  });

  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));

  if (!isProd) {
    let viteServer: ViteDevServer | null = null;
    const viteReady = createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    }).then((vite) => {
      viteServer = vite;
      return vite;
    });

    app.use(async (req, res, next) => {
      try {
        const vite = viteServer ?? (await viteReady);
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind port 3000 immediately so dev server readiness checks pass without waiting on Vite cold-start
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`InternRadar server listening on http://localhost:${PORT}`);
    startHourlyMonitoring();
  });

  const shutdown = () => {
    stopHourlyMonitoring();
    httpServer.close(() => {
      closeDatabase().finally(() => process.exit(0));
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start InternRadar server:', err);
  process.exit(1);
});
