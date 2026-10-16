import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { pgPool, isPostgresActive, markDatabaseUnavailable } from './postgres';
import { Database } from './database';

export interface ThemeColors {
  headerBg?: string;
  headerText?: string;
  sidebarBg?: string;
  sidebarText?: string;
  activeItemBg?: string;
  activeItemText?: string;
  sidebarFooterBg?: string;
  sidebarFooterText?: string;
  moduleCardBg?: string;
  moduleCardText?: string;
  accentColor?: string;
  accentText?: string;
  harmonyMode?: string;
  supportBg?: string;
  supportText?: string;
  iconColor?: string;
  borderColor?: string;
}

export interface StoredTheme {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  displayTheme: boolean;
  is_active?: boolean;
  themeType: string;
  primaryColor: string;
  palette?: ThemeColors;
  bg70Url?: string;
  bg30Url?: string;
  loginSettings?: any;
  splashSettings?: any;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_SERVER_PADRAO_THEME: StoredTheme = {
  id: 'tema-padrao-azul',
  name: 'Tema Padrão SubliGestão (Azul Corporativo)',
  startDate: '',
  endDate: '',
  displayTheme: false,
  is_active: false,
  themeType: 'padrao',
  primaryColor: '#2563EB',
  palette: {
    headerBg: '#2563EB',
    headerText: '#FFFFFF',
    sidebarBg: '#2563EB',
    sidebarText: '#FFFFFF',
    activeItemBg: '#FFFFFF',
    activeItemText: '#2563EB',
    sidebarFooterBg: '#1e3a8a',
    sidebarFooterText: '#FFFFFF',
    moduleCardBg: '#FFFFFF',
    moduleCardText: '#0F172A',
    accentColor: '#2563EB',
    accentText: '#FFFFFF',
  },
  bg70Url: '/Login-fundo.jpg',
  bg30Url: '/images/login-texture.jpg',
  loginSettings: {
    bg70Url: '/Login-fundo.jpg',
    bg30Url: '/images/login-texture.jpg',
    loginHeroTitle: 'Controle Total de Produção, Estoque e Finanças em Tempo Real.',
    loginHeroSubtitle: 'Plataforma corporativa de missão crítica com fluxo de trabalho Kanban automatizado, módulo de RH inteligente e rastreabilidade ponta a ponta.',
    loginHeroTitleColor: '#FFFFFF',
    loginHeroSubtitleColor: '#DBEAFE',
    loginFormTitle: 'Acesso ao ERP',
    loginFormSubtitle: 'Informe seu usuário e senha corporativa',
    loginFormTitleColor: '#0F172A',
    loginFormSubtitleColor: '#475569',
    loginFormLabelColor: '#334155',
    loginFormSecurityTextColor: '#047857',
    loginButtonBg: '#2563EB',
    loginButtonText: 'Acessar SubliGestão',
    loginButtonTextColor: '#FFFFFF',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const DEFAULT_SERVER_NATALINO_THEME: StoredTheme = {
  id: 'tema-natalino-2026',
  name: 'Tema Natalino 2026',
  startDate: '2026-12-01',
  endDate: '2026-12-31',
  displayTheme: false,
  is_active: false,
  themeType: 'natalino',
  primaryColor: 'gold',
  palette: {
    headerBg: '#92400e',
    headerText: '#ffffff',
    sidebarBg: '#78350f',
    sidebarText: '#ffffff',
    activeItemBg: '#f59e0b',
    activeItemText: '#0f172a',
    sidebarFooterBg: '#451a03',
    sidebarFooterText: '#fef3c7',
  },
  bg70Url: '/images/natalino-fundo.png',
  bg30Url: '/images/natalino-fundo2.png',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const DISK_FILE_PATH = path.join(process.cwd(), 'src/server/db/customThemesData.json');
const PUBLIC_BACKUP_PATH = path.join(process.cwd(), 'public/images/themes/themes_backup.json');

// Real-time synchronization state
export let currentThemeVersion = Date.now();
let lastSupabaseSignature = '';
const sseThemeClients = new Set<Response>();

export function getThemeCurrentVersion(): number {
  return currentThemeVersion;
}

export function bumpThemeVersion(): number {
  currentThemeVersion = Date.now();
  return currentThemeVersion;
}

export function registerThemeSseClient(res: Response): () => void {
  sseThemeClients.add(res);
  return () => {
    sseThemeClients.delete(res);
  };
}

export function broadcastThemeUpdate(themes: StoredTheme[], activeThemeId: string | null) {
  currentThemeVersion = Date.now();
  const payload = JSON.stringify({
    type: 'THEMES_UPDATED',
    version: currentThemeVersion,
    activeThemeId,
    data: themes,
    timestamp: new Date().toISOString(),
  });

  for (const client of sseThemeClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseThemeClients.delete(client);
    }
  }
}

let lastSupabaseCheckTime = 0;

/**
 * Checks if Supabase table 'themes' was modified externally (e.g. deletion from Google AI or direct SQL).
 * If changed, automatically re-synchronizes the in-memory map and broadcasts to all clients.
 */
export async function checkAndSyncExternalSupabaseChanges(): Promise<boolean> {
  if (isPostgresActive() === false) return false;
  const now = Date.now();
  if (now - lastSupabaseCheckTime < 20000) return false; // Throttle to max once every 20 seconds
  lastSupabaseCheckTime = now;

  try {
    const db = Database.getInstance();
    const res = await pgPool.query('SELECT id, updated_at, is_active FROM themes ORDER BY created_at ASC');
    if (res && res.rows) {
      const serverIds = new Set(res.rows.map((r: any) => String(r.id)));
      const memoryIds = new Set(Array.from(db.customThemes.keys()).filter((id) => id !== DEFAULT_SERVER_PADRAO_THEME.id && id !== DEFAULT_SERVER_NATALINO_THEME.id));

      let externalChange = serverIds.size !== memoryIds.size;
      if (!externalChange) {
        for (const id of serverIds) {
          if (!memoryIds.has(id)) {
            externalChange = true;
            break;
          }
        }
      }
      for (const id of memoryIds) {
        if (!serverIds.has(id)) {
          externalChange = true;
          break;
        }
      }

      const resSig = await pgPool.query(`
        SELECT 
          COUNT(*)::text as cnt,
          COALESCE(MAX(updated_at)::text, '') as last_mod,
          COALESCE(MAX(CASE WHEN is_active THEN id ELSE '' END), '') as active_id
        FROM themes
      `);
      const sig = resSig.rows[0] ? `${resSig.rows[0].cnt}_${resSig.rows[0].last_mod}_${resSig.rows[0].active_id}` : '';

      if ((lastSupabaseSignature && sig !== lastSupabaseSignature) || externalChange || !lastSupabaseSignature) {
        if (lastSupabaseSignature && (sig !== lastSupabaseSignature || externalChange)) {
          lastSupabaseSignature = sig;
          bumpThemeVersion();
          const updatedList = await getThemesList(true);
          const activeTheme = updatedList.find((t) => t.displayTheme || t.is_active);
          broadcastThemeUpdate(updatedList, activeTheme ? activeTheme.id : null);
          return true;
        }
        lastSupabaseSignature = sig;
      }
    }
  } catch (_) {}
  return false;
}

/**
 * Persists themes to indestructible JSON files on server disk.
 */
function saveThemesToDisk(themes: StoredTheme[]): void {
  try {
    const json = JSON.stringify(themes, null, 2);
    const dir = path.dirname(DISK_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DISK_FILE_PATH, json, 'utf8');

    // Also write a secondary backup
    const backupDir = path.dirname(PUBLIC_BACKUP_PATH);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.writeFileSync(PUBLIC_BACKUP_PATH, json, 'utf8');
  } catch (err) {
    console.warn('[ThemeStorage] Falha ao gravar temas em disco:', err);
  }
}

/**
 * Reads themes from disk if available.
 */
function readThemesFromDisk(): StoredTheme[] {
  try {
    if (fs.existsSync(DISK_FILE_PATH)) {
      const content = fs.readFileSync(DISK_FILE_PATH, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}

  try {
    if (fs.existsSync(PUBLIC_BACKUP_PATH)) {
      const content = fs.readFileSync(PUBLIC_BACKUP_PATH, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}

  return [];
}

/**
 * Ensures the `themes` table exists in Supabase / PostgreSQL with all required columns.
 */
export async function ensureThemesTableInSupabase(): Promise<boolean> {
  if (isPostgresActive() === false) return false;
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS themes (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        colors JSONB NOT NULL,
        is_active BOOLEAN DEFAULT false,
        created_by VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        theme_type VARCHAR(100),
        primary_color VARCHAR(100),
        start_date VARCHAR(50),
        end_date VARCHAR(50),
        bg70_url TEXT,
        bg30_url TEXT,
        login_settings JSONB,
        full_data JSONB
      );
      ALTER TABLE themes ADD COLUMN IF NOT EXISTS theme_type VARCHAR(100);
      ALTER TABLE themes ADD COLUMN IF NOT EXISTS primary_color VARCHAR(100);
      ALTER TABLE themes ADD COLUMN IF NOT EXISTS start_date VARCHAR(50);
      ALTER TABLE themes ADD COLUMN IF NOT EXISTS end_date VARCHAR(50);
      ALTER TABLE themes ADD COLUMN IF NOT EXISTS bg70_url TEXT;
      ALTER TABLE themes ADD COLUMN IF NOT EXISTS bg30_url TEXT;
      ALTER TABLE themes ADD COLUMN IF NOT EXISTS login_settings JSONB;
      ALTER TABLE themes ADD COLUMN IF NOT EXISTS full_data JSONB;
    `);
    return true;
  } catch (err: any) {
    console.warn('[ThemeStorage] Falha ao verificar tabela themes no Supabase:', err?.message || err);
    return false;
  }
}

export function mapRowToTheme(r: any): StoredTheme {
  const full = typeof r.full_data === 'string' ? JSON.parse(r.full_data) : (r.full_data || {});
  const colors = typeof r.colors === 'string' ? JSON.parse(r.colors) : (r.colors || full.palette || {});
  const loginSettings = typeof r.login_settings === 'string' ? JSON.parse(r.login_settings) : (r.login_settings || full.loginSettings || {});

  const isDisplay = r.is_active !== undefined && r.is_active !== null
    ? Boolean(r.is_active)
    : Boolean(full.displayTheme === true || full.is_active === true);

  return {
    ...full,
    id: String(r.id),
    name: r.name || full.name || 'Tema Personalizado',
    displayTheme: isDisplay,
    is_active: isDisplay,
    themeType: r.theme_type || full.themeType || 'natalino',
    primaryColor: r.primary_color || full.primaryColor || 'gold',
    startDate: r.start_date || full.startDate || '',
    endDate: r.end_date || full.endDate || '',
    palette: colors,
    bg70Url: r.bg70_url || full.bg70Url || loginSettings.bg70Url || '',
    bg30Url: r.bg30_url || full.bg30Url || loginSettings.bg30Url || '',
    loginSettings: {
      ...loginSettings,
      bg70Url: r.bg70_url || loginSettings.bg70Url || full.bg70Url || '',
      bg30Url: r.bg30_url || loginSettings.bg30Url || full.bg30Url || '',
    },
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : (full.createdAt || new Date().toISOString()),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : (full.updatedAt || new Date().toISOString()),
  };
}

/**
 * Initializes and loads themes from Supabase, _system_store, and local disk.
 * Guarantees that default corporate themes exist and user themes are never lost.
 */
export async function initializeThemesEngine(): Promise<StoredTheme[]> {
  const db = Database.getInstance();
  const themeMap = new Map<string, StoredTheme>();

  // 1. Defaults first
  themeMap.set(DEFAULT_SERVER_PADRAO_THEME.id, { ...DEFAULT_SERVER_PADRAO_THEME });
  themeMap.set(DEFAULT_SERVER_NATALINO_THEME.id, { ...DEFAULT_SERVER_NATALINO_THEME });

  // 2. Read from disk backup
  const diskThemes = readThemesFromDisk();
  for (const t of diskThemes) {
    if (t && t.id) {
      themeMap.set(t.id, t);
    }
  }

  // 3. Read from Supabase PostgreSQL if active
  if (isPostgresActive() !== false) {
    try {
      await ensureThemesTableInSupabase();
      const themeRows = await pgPool.query('SELECT * FROM themes ORDER BY created_at ASC');
      if (themeRows && themeRows.rows && themeRows.rows.length > 0) {
        for (const row of themeRows.rows) {
          const mapped = mapRowToTheme(row);
          themeMap.set(mapped.id, mapped);
        }
      } else {
        // Check _system_store
        const storeRows = await pgPool.query(
          `SELECT id, data FROM _system_store WHERE collection IN ('custom_themes', 'themes') ORDER BY id ASC`
        );
        if (storeRows && storeRows.rows && storeRows.rows.length > 0) {
          for (const row of storeRows.rows) {
            const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            if (parsed && parsed.id) {
              themeMap.set(String(parsed.id), parsed);
            }
          }
        }
      }
    } catch (dbErr) {
      console.warn('[ThemeStorage] Sincronização inicial com Supabase operando em fallback:', dbErr);
    }
  }

  // 4. Update in-memory Map
  for (const [id, theme] of themeMap.entries()) {
    db.customThemes.set(id, theme);
  }

  const result = Array.from(themeMap.values());

  // Save to disk cache
  saveThemesToDisk(result);

  // If Supabase is active, sync all existing themes to Supabase `themes` table
  if (isPostgresActive() !== false) {
    try {
      for (const t of result) {
        await persistThemeToSupabaseOnly(t).catch(() => {});
      }
    } catch (_) {}
  }

  return result;
}

/**
 * Saves a single theme directly to Supabase `themes` table and `_system_store`.
 */
async function persistThemeToSupabaseOnly(theme: StoredTheme): Promise<void> {
  if (isPostgresActive() === false) return;

  const isDisplay = Boolean(theme.displayTheme === true || theme.is_active === true);
  if (isDisplay) {
    await pgPool.query('UPDATE themes SET is_active = false, updated_at = NOW() WHERE id != $1', [theme.id]).catch(() => {});
  }

  const colorsJson = JSON.stringify(theme.palette || {});
  const loginSettingsJson = JSON.stringify(theme.loginSettings || {});
  const fullDataJson = JSON.stringify({
    ...theme,
    displayTheme: isDisplay,
    is_active: isDisplay,
  });

  await pgPool.query(`
    INSERT INTO themes (
      id, name, colors, is_active, created_by, created_at, updated_at,
      theme_type, primary_color, start_date, end_date, bg70_url, bg30_url, login_settings, full_data
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      colors = EXCLUDED.colors,
      is_active = EXCLUDED.is_active,
      updated_at = NOW(),
      theme_type = EXCLUDED.theme_type,
      primary_color = EXCLUDED.primary_color,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      bg70_url = EXCLUDED.bg70_url,
      bg30_url = EXCLUDED.bg30_url,
      login_settings = EXCLUDED.login_settings,
      full_data = EXCLUDED.full_data;
  `, [
    theme.id,
    theme.name,
    colorsJson,
    isDisplay,
    'Usuário / Developer',
    theme.themeType || 'natalino',
    theme.primaryColor || 'gold',
    theme.startDate || '',
    theme.endDate || '',
    theme.bg70Url || '',
    theme.bg30Url || '',
    loginSettingsJson,
    fullDataJson,
  ]);

  // Redundancy in _system_store
  await pgPool.query(`
    INSERT INTO _system_store (collection, id, data)
    VALUES ('themes', $1, $2)
    ON CONFLICT (collection, id) DO UPDATE SET data = $2
  `, [theme.id, fullDataJson]).catch(() => {});
}

/**
 * CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
 * Sanitização e conversão automática de imagens Base64 em arquivos web estáticos leves no disco,
 * evitando sobrecarga de memória, lentidão de rede e estouro de cota no localStorage.
 */
export function sanitizeThemeImageUri(uri: string | undefined | null, themeId: string, suffix: string): string {
  if (!uri || typeof uri !== 'string' || !uri.startsWith('data:image/')) {
    return uri || '';
  }
  try {
    const matches = uri.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return uri;
    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    const filename = `theme_${themeId}_${suffix}_${Date.now()}.${ext}`;
    const themesDir = path.join(process.cwd(), 'public/images/themes');
    if (!fs.existsSync(themesDir)) {
      fs.mkdirSync(themesDir, { recursive: true });
    }
    const filePath = path.join(themesDir, filename);
    fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
    return `/images/themes/${filename}`;
  } catch (err) {
    console.warn('[ThemeStorage] Falha ao converter imagem base64:', err);
    return uri;
  }
}

/**
 * Saves or updates a theme with real-time broadcast and multi-tier persistence.
 */
export async function saveThemeFull(rawTheme: any): Promise<StoredTheme[]> {
  const db = Database.getInstance();
  const isDisplay = Boolean(rawTheme.displayTheme === true || rawTheme.is_active === true);
  const rawId = String(rawTheme.id || `tema-${Date.now()}`);

  // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
  // Converte Base64 para URLs leves para garantir renderização instantânea (Zero Delay)
  const sanitizedBg70 = sanitizeThemeImageUri(rawTheme.bg70Url, rawId, 'bg70');
  const sanitizedBg30 = sanitizeThemeImageUri(rawTheme.bg30Url, rawId, 'bg30');
  let sanitizedLoginSettings = rawTheme.loginSettings;
  if (sanitizedLoginSettings) {
    sanitizedLoginSettings = {
      ...sanitizedLoginSettings,
      bg70Url: sanitizeThemeImageUri(sanitizedLoginSettings.bg70Url || sanitizedBg70, rawId, 'ls_bg70'),
      fg70Url: sanitizeThemeImageUri(sanitizedLoginSettings.fg70Url, rawId, 'ls_fg70'),
      bg30Url: sanitizeThemeImageUri(sanitizedLoginSettings.bg30Url || sanitizedBg30, rawId, 'ls_bg30'),
      fg30Url: sanitizeThemeImageUri(sanitizedLoginSettings.fg30Url, rawId, 'ls_fg30'),
      imageLayers: (sanitizedLoginSettings.imageLayers || []).map((layer: any, idx: number) => ({
        ...layer,
        url: sanitizeThemeImageUri(layer.url, rawId, `layer_${idx}`),
      })),
    };
  }

  const themeData: StoredTheme = {
    ...rawTheme,
    id: rawId,
    name: String(rawTheme.name || 'Novo Tema').trim(),
    startDate: String(rawTheme.startDate || ''),
    endDate: String(rawTheme.endDate || ''),
    displayTheme: isDisplay,
    is_active: isDisplay,
    themeType: rawTheme.themeType || 'natalino',
    primaryColor: rawTheme.primaryColor || 'gold',
    palette: rawTheme.palette || null,
    bg70Url: sanitizedBg70 || (sanitizedLoginSettings?.bg70Url || ''),
    bg30Url: sanitizedBg30 || (sanitizedLoginSettings?.bg30Url || ''),
    loginSettings: sanitizedLoginSettings,
    createdAt: rawTheme.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // If this theme is being displayed/activated, deactivate all other themes
  if (isDisplay) {
    for (const [tId, t] of db.customThemes.entries()) {
      if (tId !== themeData.id && (t.displayTheme || t.is_active)) {
        db.customThemes.set(tId, {
          ...t,
          displayTheme: false,
          is_active: false,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  // Save to in-memory map
  db.customThemes.set(themeData.id, themeData);

  const allThemes = Array.from(db.customThemes.values());

  // Save to disk file
  saveThemesToDisk(allThemes);

  // Save to Supabase
  if (isPostgresActive() !== false) {
    try {
      await ensureThemesTableInSupabase();
      await persistThemeToSupabaseOnly(themeData);

      // Audit in system_changes
      const changeId = `SYSCHG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const changeDetails = `Tema '${themeData.name}' (${themeData.themeType}) salvo e sincronizado na tabela 'themes' do Supabase. Exibir Tema: ${themeData.displayTheme ? 'SIM' : 'NÃO'}`;
      await pgPool.query(`
        INSERT INTO system_changes (id, entity, action, details, entity_id, performed_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        changeId,
        'temas_diversos',
        'SALVAR_TEMA_CUSTOMIZADO',
        changeDetails,
        themeData.id,
        'Usuário / Developer'
      ]).catch(() => {});
    } catch (supabaseErr) {
      console.warn('[ThemeStorage] Aviso ao persistir tema no Supabase:', supabaseErr);
    }
  }

  // Real-time broadcast to all connected profiles
  const activeThemeId = isDisplay ? themeData.id : (allThemes.find((t) => t.displayTheme || t.is_active)?.id || null);
  broadcastThemeUpdate(allThemes, activeThemeId);

  return allThemes;
}

/**
 * Applies a theme as active system-wide across all profiles in real time.
 * If themeId is null, reverts to corporate default model.
 */
export async function applyThemeFull(themeId: string | null, optionalTheme?: any): Promise<StoredTheme[]> {
  const db = Database.getInstance();

  if (themeId) {
    const targetId = String(themeId);

    // If theme passed from client and missing from memory, add it
    if (optionalTheme && !db.customThemes.has(targetId)) {
      db.customThemes.set(targetId, {
        ...optionalTheme,
        id: targetId,
        displayTheme: true,
        is_active: true,
      });
    }

    // Set only targetId as active
    let found = false;
    for (const [tId, t] of db.customThemes.entries()) {
      const isSelected = tId === targetId;
      if (isSelected) found = true;
      db.customThemes.set(tId, {
        ...t,
        displayTheme: isSelected,
        is_active: isSelected,
        updatedAt: new Date().toISOString(),
      });
    }

    // If not found in customThemes, check if it's one of the defaults
    if (!found) {
      if (targetId === DEFAULT_SERVER_PADRAO_THEME.id) {
        db.customThemes.set(targetId, { ...DEFAULT_SERVER_PADRAO_THEME, displayTheme: true, is_active: true });
      } else if (targetId === DEFAULT_SERVER_NATALINO_THEME.id) {
        db.customThemes.set(targetId, { ...DEFAULT_SERVER_NATALINO_THEME, displayTheme: true, is_active: true });
      } else if (optionalTheme) {
        db.customThemes.set(targetId, { ...optionalTheme, id: targetId, displayTheme: true, is_active: true });
      }
    }

    const allThemes = Array.from(db.customThemes.values());
    saveThemesToDisk(allThemes);

    if (isPostgresActive() !== false) {
      try {
        await ensureThemesTableInSupabase();
        // Ensure the applied theme is inserted in Supabase
        const activeTheme = db.customThemes.get(targetId);
        if (activeTheme) {
          await persistThemeToSupabaseOnly(activeTheme);
        }
        await pgPool.query('UPDATE themes SET is_active = (id = $1), updated_at = NOW()', [targetId]);
        await pgPool.query(`
          UPDATE _system_store
          SET data = jsonb_set(
            data,
            '{displayTheme}',
            (CASE WHEN id = $1 THEN 'true'::jsonb ELSE 'false'::jsonb END)
          )
          WHERE collection IN ('themes', 'custom_themes')
        `, [targetId]).catch(() => {});

        const changeId = `SYSCHG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const themeName = activeTheme?.name || targetId;
        await pgPool.query(`
          INSERT INTO system_changes (id, entity, action, details, performed_by, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (id) DO NOTHING
        `, [
          changeId,
          'temas_diversos',
          'APLICAR_TEMA_PADRAO',
          `Tema '${themeName}' (${targetId}) aplicado como padrão ativo no sistema e sincronizado com o Supabase.`,
          'Usuário / Developer'
        ]).catch(() => {});
      } catch (err) {
        console.warn('[ThemeStorage] Aviso ao aplicar tema no Supabase:', err);
      }
    }

    broadcastThemeUpdate(allThemes, targetId);
    return allThemes;
  } else {
    // Revert to Corporate Default (all custom deactivated)
    for (const [tId, t] of db.customThemes.entries()) {
      db.customThemes.set(tId, {
        ...t,
        displayTheme: false,
        is_active: false,
        updatedAt: new Date().toISOString(),
      });
    }

    const allThemes = Array.from(db.customThemes.values());
    saveThemesToDisk(allThemes);

    if (isPostgresActive() !== false) {
      try {
        await ensureThemesTableInSupabase();
        await pgPool.query('UPDATE themes SET is_active = false, updated_at = NOW()');
        await pgPool.query(`
          UPDATE _system_store
          SET data = jsonb_set(data, '{displayTheme}', 'false'::jsonb)
          WHERE collection IN ('themes', 'custom_themes')
        `).catch(() => {});

        const changeId = `SYSCHG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await pgPool.query(`
          INSERT INTO system_changes (id, entity, action, details, performed_by, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (id) DO NOTHING
        `, [
          changeId,
          'temas_diversos',
          'REVERTER_TEMA_PADRAO',
          'Nenhum tema com "Exibir tema" marcado. Sistema revertido para o Modelo Padrão Corporativo SubliGestão.',
          'Usuário / Developer'
        ]).catch(() => {});
      } catch (err) {
        console.warn('[ThemeStorage] Aviso ao reverter tema no Supabase:', err);
      }
    }

    broadcastThemeUpdate(allThemes, null);
    return allThemes;
  }
}

/**
 * Deletes a theme with multi-tier cleanup and real-time broadcast.
 */
export async function deleteThemeFull(themeId: string): Promise<StoredTheme[]> {
  const db = Database.getInstance();
  const targetId = String(themeId);

  db.customThemes.delete(targetId);
  const allThemes = Array.from(db.customThemes.values());
  saveThemesToDisk(allThemes);

  if (isPostgresActive() !== false) {
    try {
      await ensureThemesTableInSupabase();
      await pgPool.query('DELETE FROM themes WHERE id = $1', [targetId]);
      await pgPool.query(`DELETE FROM _system_store WHERE collection IN ('custom_themes', 'themes') AND id = $1`, [targetId]);

      const changeId = `SYSCHG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await pgPool.query(`
        INSERT INTO system_changes (id, entity, action, details, entity_id, performed_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        changeId,
        'temas_diversos',
        'EXCLUIR_TEMA_CUSTOMIZADO',
        `Tema '${targetId}' excluído da tabela themes do Supabase`,
        targetId,
        'Usuário / Developer'
      ]).catch(() => {});
    } catch (err) {
      console.warn('[ThemeStorage] Aviso ao excluir tema do Supabase:', err);
    }
  }

  const activeTheme = allThemes.find((t) => t.displayTheme || t.is_active);
  broadcastThemeUpdate(allThemes, activeTheme ? activeTheme.id : null);
  return allThemes;
}

let lastThemesBackgroundSync = 0;

/**
 * Returns the current list of themes instantly from memory cache.
 */
export async function getThemesList(forceRefresh: boolean = false): Promise<StoredTheme[]> {
  const db = Database.getInstance();
  const now = Date.now();

  if (db.customThemes.size === 0) {
    await initializeThemesEngine();
  } else if (forceRefresh || (now - lastThemesBackgroundSync > 30000 && isPostgresActive() !== false)) {
    lastThemesBackgroundSync = now;
    // Realiza sincronização em segundo plano sem bloquear a resposta HTTP
    pgPool.query('SELECT * FROM themes ORDER BY created_at ASC').then((themeRows) => {
      if (themeRows && Array.isArray(themeRows.rows)) {
        const supabaseIds = new Set<string>();
        let changed = false;
        for (const row of themeRows.rows) {
          const mapped = mapRowToTheme(row);
          if (!db.customThemes.has(mapped.id)) {
            changed = true;
          }
          db.customThemes.set(mapped.id, mapped);
          supabaseIds.add(mapped.id);
        }

        for (const existingId of Array.from(db.customThemes.keys())) {
          if (
            existingId !== DEFAULT_SERVER_PADRAO_THEME.id &&
            existingId !== DEFAULT_SERVER_NATALINO_THEME.id &&
            !supabaseIds.has(existingId)
          ) {
            db.customThemes.delete(existingId);
            changed = true;
          }
        }
        if (changed) {
          bumpThemeVersion();
          saveThemesToDisk(Array.from(db.customThemes.values()));
        }
      }
    }).catch(() => {});
  }

  // Ensure default themes exist
  if (!db.customThemes.has(DEFAULT_SERVER_PADRAO_THEME.id)) {
    db.customThemes.set(DEFAULT_SERVER_PADRAO_THEME.id, { ...DEFAULT_SERVER_PADRAO_THEME });
  }
  if (!db.customThemes.has(DEFAULT_SERVER_NATALINO_THEME.id)) {
    db.customThemes.set(DEFAULT_SERVER_NATALINO_THEME.id, { ...DEFAULT_SERVER_NATALINO_THEME });
  }

  return Array.from(db.customThemes.values());
}
