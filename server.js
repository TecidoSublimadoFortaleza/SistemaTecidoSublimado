import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const distServer = path.resolve(process.cwd(), 'dist/server.cjs');
const buildServer = path.resolve(process.cwd(), 'build/server.cjs');

const targetServer = fs.existsSync(distServer)
  ? distServer
  : fs.existsSync(buildServer)
    ? buildServer
    : null;

if (targetServer) {
  const require = createRequire(import.meta.url);
  require(targetServer);
} else {
  // Fallback: usa import() dinâmico SEM top-level await
  import(pathToFileURL(path.resolve(process.cwd(), 'src/server/serverImpl.ts')).href)
    .catch((err) => {
      console.error('[Fatal] dist/server.cjs not found and fallback failed:', err);
      process.exit(1);
    });
}