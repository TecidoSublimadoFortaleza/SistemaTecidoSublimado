import fs from 'fs';
import path from 'path';
import { pgPool, isPostgresActive } from './postgres';

export function getMimeTypeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.gif':
      return 'image/gif';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Garante que a tabela `system_images` exista no Supabase para compartilhamento universal de imagens
 * entre os servidores do Render e Google AI Studio.
 */
export async function ensureSystemImagesTable(): Promise<boolean> {
  if (isPostgresActive() === false) return false;
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS system_images (
        path VARCHAR(500) PRIMARY KEY,
        filename VARCHAR(255),
        data TEXT NOT NULL,
        mime_type VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    return true;
  } catch (err: any) {
    console.warn('[ImageStorage] Falha ao verificar tabela system_images no Supabase:', err?.message || err);
    return false;
  }
}

/**
 * Salva ou atualiza uma imagem em Base64 diretamente no Supabase.
 */
export async function saveImageToSupabase(
  imagePath: string,
  filename: string,
  dataBase64: string,
  mimeType?: string
): Promise<boolean> {
  if (isPostgresActive() === false) return false;
  try {
    await ensureSystemImagesTable();
    const cleanPath = imagePath.trim();
    const cleanName = filename ? filename.trim() : path.basename(cleanPath);
    const mime = mimeType || (cleanPath.endsWith('.webp') ? 'image/webp' : cleanPath.endsWith('.jpg') || cleanPath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png');

    await pgPool.query(
      `INSERT INTO system_images (path, filename, data, mime_type, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (path) DO UPDATE SET data = $3, updated_at = NOW()`,
      [cleanPath, cleanName, dataBase64, mime]
    );
    return true;
  } catch (err: any) {
    console.warn('[ImageStorage] Aviso ao salvar imagem no Supabase:', err?.message || err);
    return false;
  }
}

/**
 * Recupera imagem em Base64 do Supabase por caminho ou nome de arquivo.
 */
export async function getImageFromSupabase(
  imagePathOrName: string
): Promise<{ data: string; mimeType: string; filename: string } | null> {
  if (isPostgresActive() === false) return null;
  try {
    await ensureSystemImagesTable();
    const clean = imagePathOrName.trim();
    const basename = path.basename(clean);

    // 1. Busca exata por path
    let res = await pgPool.query('SELECT * FROM system_images WHERE path = $1 LIMIT 1', [clean]);
    if (res.rows && res.rows.length > 0) {
      const r = res.rows[0];
      return { data: r.data, mimeType: r.mime_type || 'image/png', filename: r.filename || basename };
    }

    // 2. Busca por filename
    res = await pgPool.query('SELECT * FROM system_images WHERE filename = $1 OR path LIKE $2 LIMIT 1', [
      basename,
      `%/${basename}`,
    ]);
    if (res.rows && res.rows.length > 0) {
      const r = res.rows[0];
      return { data: r.data, mimeType: r.mime_type || 'image/png', filename: r.filename || basename };
    }
  } catch (err: any) {
    console.warn('[ImageStorage] Aviso ao buscar imagem do Supabase:', err?.message || err);
  }
  return null;
}

/**
 * Converte qualquer caminho local de imagem (/images/..., public/images/...) para Base64 síncrono/universal.
 * Se o arquivo existe no disco local (Render ou Google IA), lê e converte para Base64 e salva no Supabase.
 * Se o arquivo NÃO existe no disco local, busca na tabela `system_images` do Supabase e salva em cache no disco.
 */
export async function convertLocalPathToBase64(urlOrPath: string | undefined | null): Promise<string> {
  if (!urlOrPath || typeof urlOrPath !== 'string') return '';
  const clean = urlOrPath.trim();
  if (!clean) return '';

  // Se já for Base64 (data:image/...) ou URL externa (http), retorna direto
  if (clean.startsWith('data:image/') || clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }

  // Tenta localizar no disco local
  let localCandidates: string[] = [];
  if (clean.startsWith('/')) {
    localCandidates.push(path.join(process.cwd(), 'public', clean));
    localCandidates.push(path.join(process.cwd(), clean));
  } else if (clean.startsWith('public/')) {
    localCandidates.push(path.join(process.cwd(), clean));
    localCandidates.push(path.join(process.cwd(), 'public', clean.replace(/^public\//, '')));
  } else {
    localCandidates.push(path.join(process.cwd(), 'public/images', clean));
    localCandidates.push(path.join(process.cwd(), 'public/images/themes', clean));
    localCandidates.push(path.join(process.cwd(), 'public', clean));
  }

  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      try {
        const buf = fs.readFileSync(candidate);
        const mime = getMimeTypeFromExt(candidate);
        const base64Data = `data:${mime};base64,${buf.toString('base64')}`;

        // Sincroniza em segundo plano para o Supabase para que o outro servidor (Render / Google IA) receba
        const standardPath = clean.startsWith('/') ? clean : `/${clean}`;
        saveImageToSupabase(standardPath, path.basename(candidate), base64Data, mime).catch(() => {});
        return base64Data;
      } catch (err) {
        console.warn('[ImageStorage] Falha ao ler arquivo local para Base64:', candidate, err);
      }
    }
  }

  // Se não existe no disco local deste container, busca no Supabase (ex: arquivo foi adicionado no Render)
  try {
    const fromDb = await getImageFromSupabase(clean);
    if (fromDb && fromDb.data && fromDb.data.startsWith('data:image/')) {
      // Salva em cache no disco local para próximas requisições
      try {
        const matches = fromDb.data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches && matches[2]) {
          const buffer = Buffer.from(matches[2], 'base64');
          const cachePath = path.join(process.cwd(), 'public/images', path.basename(clean));
          if (!fs.existsSync(path.dirname(cachePath))) {
            fs.mkdirSync(path.dirname(cachePath), { recursive: true });
          }
          fs.writeFileSync(cachePath, buffer);
        }
      } catch (_) {}
      return fromDb.data;
    }
  } catch (_) {}

  return clean;
}

/**
 * Converte todas as imagens de um tema para Base64 garantindo persistência universal no Supabase
 * compartilhada de forma transparente entre o servidor Render e o ambiente Google IA.
 */
export async function processThemeImagesToBase64(theme: any): Promise<any> {
  if (!theme) return theme;

  if (theme.bg70Url) {
    theme.bg70Url = await convertLocalPathToBase64(theme.bg70Url);
  }
  if (theme.bg30Url) {
    theme.bg30Url = await convertLocalPathToBase64(theme.bg30Url);
  }

  if (theme.loginSettings) {
    if (theme.loginSettings.bg70Url) {
      theme.loginSettings.bg70Url = await convertLocalPathToBase64(theme.loginSettings.bg70Url);
    }
    if (theme.loginSettings.bg30Url) {
      theme.loginSettings.bg30Url = await convertLocalPathToBase64(theme.loginSettings.bg30Url);
    }
    if (theme.loginSettings.fg70Url) {
      theme.loginSettings.fg70Url = await convertLocalPathToBase64(theme.loginSettings.fg70Url);
    }
    if (theme.loginSettings.fg30Url) {
      theme.loginSettings.fg30Url = await convertLocalPathToBase64(theme.loginSettings.fg30Url);
    }

    if (Array.isArray(theme.loginSettings.imageLayers)) {
      for (const layer of theme.loginSettings.imageLayers) {
        if (layer && layer.url) {
          layer.url = await convertLocalPathToBase64(layer.url);
        }
      }
    }
  }

  return theme;
}

/**
 * Sincroniza todas as imagens locais existentes em `public/images/` para o Supabase `system_images`.
 * Isso garante que imagens adicionadas diretamente em um dos ambientes (como `ano-novo.png`)
 * sejam imediatamente disponibilizadas para o outro ambiente (Render / Google IA).
 */
export async function syncAllLocalPublicImagesToSupabase(): Promise<void> {
  if (isPostgresActive() === false) return;
  const publicImagesDir = path.join(process.cwd(), 'public/images');
  if (!fs.existsSync(publicImagesDir)) return;

  await ensureSystemImagesTable();

  const scanAndSync = async (dir: string, baseRoute: string) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanAndSync(fullPath, `${baseRoute}/${entry.name}`);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext)) {
            try {
              const stat = fs.statSync(fullPath);
              if (stat.size > 0 && stat.size < 20 * 1024 * 1024) {
                const standardPath = `${baseRoute}/${entry.name}`;
                const mime = getMimeTypeFromExt(fullPath);
                const buf = fs.readFileSync(fullPath);
                const base64 = `data:${mime};base64,${buf.toString('base64')}`;
                await saveImageToSupabase(standardPath, entry.name, base64, mime);
              }
            } catch (fileErr) {
              console.warn('[ImageStorage] Falha ao sincronizar imagem local:', fullPath, fileErr);
            }
          }
        }
      }
    } catch (dirErr) {
      console.warn('[ImageStorage] Erro ao ler diretório para sincronização:', dir, dirErr);
    }
  };

  await scanAndSync(publicImagesDir, '/images');
  console.log('[ImageStorage] Sincronização de imagens locais com Supabase concluída!');
}
