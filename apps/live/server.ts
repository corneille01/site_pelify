import express, { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from './server/app';
import { isProduction } from './server/security';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = parseInt(process.env.PORT || '3000', 10);

/* ───────── Application web ───────── */
async function setupVite() {
  if (isProduction()) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  app.listen(port, '0.0.0.0', () => console.log(`[OCD Live] http://0.0.0.0:${port}`));
}

setupVite().catch((e) => {
  console.error(e);
  process.exit(1);
});
