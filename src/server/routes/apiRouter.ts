import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthController } from '../controllers/AuthController';
import { DeveloperController } from '../controllers/DeveloperController';
import { ClientController } from '../controllers/ClientController';
import { EmployeeController } from '../controllers/EmployeeController';
import { OsController } from '../controllers/OsController';
import { ChatController } from '../controllers/ChatController';
import { FiscalController } from '../controllers/FiscalController';
import { BackupController } from '../controllers/BackupController';
import { requireAuth, requireDeveloper, optionalAuth } from '../middlewares/authMiddleware';
import { RoleRepository } from '../repositories/RoleRepository';
import { Database } from '../db/database';
import { pgPool, isPostgresActive, markDatabaseUnavailable } from '../db/postgres';
import { getDefaultSystemPermissions } from '../db/defaultPermissions';
import {
  getThemesList,
  saveThemeFull,
  applyThemeFull,
  deleteThemeFull,
  registerThemeSseClient,
  getThemeCurrentVersion,
  checkAndSyncExternalSupabaseChanges,
} from '../db/themeStorage';
import { saveImageToSupabase } from '../db/imageStorage';

const roleRepo = new RoleRepository();
export const apiRouter = Router();

// --- Authentication Endpoints ---
apiRouter.post('/v1/auth/login', AuthController.login);
apiRouter.post('/v1/auth/refresh', AuthController.refreshToken);
apiRouter.post('/v1/auth/logout', requireAuth, AuthController.logout);
apiRouter.get('/v1/auth/me', requireAuth, AuthController.getCurrentUser);
apiRouter.post('/v1/auth/verify-password', AuthController.verifyPassword);
apiRouter.post('/v1/auth/verify-os-edit-password', AuthController.verifyOsEditPassword);
apiRouter.post('/v1/auth/change-password', optionalAuth, AuthController.changePassword);
apiRouter.put('/v1/auth/profile', optionalAuth, AuthController.updateProfile);
apiRouter.put('/v1/auth/me', optionalAuth, AuthController.updateProfile);
apiRouter.put('/v1/users/profile', optionalAuth, AuthController.updateProfile);

// --- Client Endpoints ---
apiRouter.post('/v1/clients', requireAuth, ClientController.createClient);
apiRouter.post('/v1/clients/bulk-import', requireAuth, ClientController.bulkImportClients);
apiRouter.put('/v1/clients/:id', requireAuth, ClientController.updateClient);
apiRouter.delete('/v1/clients/:id', requireAuth, ClientController.deleteClient);
apiRouter.get('/v1/clients', requireAuth, ClientController.listClients);
apiRouter.get('/v1/clients/:id', requireAuth, ClientController.getClientById);

// --- Employee Endpoints ---
apiRouter.post('/v1/employees', requireAuth, EmployeeController.createEmployee);
apiRouter.put('/v1/employees/:id', requireAuth, EmployeeController.updateEmployee);
apiRouter.delete('/v1/employees/:id', requireAuth, EmployeeController.deleteEmployee);
apiRouter.get('/v1/employees', requireAuth, EmployeeController.listEmployees);
apiRouter.get('/v1/employees/:id', requireAuth, EmployeeController.getEmployeeById);

// --- Catalog Products & Categories Endpoints ---
apiRouter.get('/v1/products', requireAuth, OsController.listProducts);
apiRouter.post('/v1/products/sync', requireAuth, OsController.syncStock);
apiRouter.post('/v1/stock/sync', requireAuth, OsController.syncStock);
apiRouter.post('/v1/products', requireAuth, OsController.createProduct);
apiRouter.post('/v1/products/batch-import', requireAuth, OsController.batchImportProducts);
apiRouter.put('/v1/products/:id', requireAuth, OsController.updateProduct);
apiRouter.delete('/v1/products/:id', requireAuth, OsController.deleteProduct);
apiRouter.get('/v1/categories', requireAuth, OsController.listCategories);
apiRouter.post('/v1/categories', requireAuth, OsController.addCategory);
apiRouter.put('/v1/categories/:oldName', requireAuth, OsController.updateCategory);
apiRouter.delete('/v1/categories/:name', requireAuth, OsController.deleteCategory);

// --- Ordens de Serviço Endpoints ---
apiRouter.get('/v1/os/next-code', requireAuth, OsController.getNextCode);
apiRouter.get('/v1/os', requireAuth, OsController.listOrdensServico);
apiRouter.get('/v1/os/:id', requireAuth, OsController.getOsById);
apiRouter.post('/v1/os', requireAuth, OsController.createOs);
apiRouter.post('/v1/os/:id/transform-to-os', requireAuth, OsController.transformOrcToOs);
apiRouter.put('/v1/os/:id', requireAuth, OsController.updateOs);
apiRouter.delete('/v1/os/:id', requireAuth, OsController.deleteOs);

// --- PDV Transactions Endpoints ---
apiRouter.get('/v1/pdv/transactions', requireAuth, OsController.listPdvTransactions);
apiRouter.post('/v1/pdv/transactions', requireAuth, OsController.createPdvTransaction);

// --- Mensagens Internas (Chat) Endpoints ---
apiRouter.get('/v1/messages/contacts', requireAuth, ChatController.listContacts);
apiRouter.post('/v1/messages/heartbeat', requireAuth, ChatController.heartbeat);
apiRouter.get('/v1/messages/groups', requireAuth, ChatController.listGroups);
apiRouter.post('/v1/messages/groups', requireAuth, ChatController.createGroup);
apiRouter.put('/v1/messages/groups/:id', requireAuth, ChatController.updateGroup);
apiRouter.delete('/v1/messages/groups/:id', requireAuth, ChatController.deleteGroup);
apiRouter.post('/v1/messages/send', requireAuth, ChatController.sendMessage);
apiRouter.get('/v1/messages/history/:targetType/:targetId', requireAuth, ChatController.getHistory);
apiRouter.post('/v1/messages/read', requireAuth, ChatController.markAsRead);
apiRouter.post('/v1/messages/clear-history', requireAuth, ChatController.clearHistory);
apiRouter.get('/v1/messages/unread', requireAuth, ChatController.getUnread);
apiRouter.get('/v1/messages/developer/audit', requireAuth, requireDeveloper, ChatController.getDeveloperAudit);
apiRouter.post('/v1/messages/developer/clear', requireAuth, requireDeveloper, ChatController.developerClear);
apiRouter.get('/v1/messages/support/tickets', requireAuth, ChatController.listSupportTickets);
apiRouter.post('/v1/messages/support/reply', requireAuth, ChatController.sendSupportReply);
apiRouter.post('/v1/messages/support/resolve', requireAuth, ChatController.resolveSupportTicket);

// --- Metadata Endpoints (Sectors, Roles, Branches) ---
apiRouter.get('/v1/metadata/sectors', requireAuth, async (req, res, next) => {
  try {
    const sectors = await roleRepo.listSectors();
    res.json({ success: true, data: sectors });
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/v1/metadata/roles', requireAuth, async (req, res, next) => {
  try {
    const roles = await roleRepo.listRoles();
    res.json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
});

// --- Filiais / Unidades da Empresa (Persistência no Banco de Dados Postgres / _system_store) ---
function normalizeFilial(f: any) {
  if (!f) return null;
  const isMatriz = f.id === 'FILIAL-MATRIZ-001' || f.id === 'filial-matriz-fortaleza' || f.codigo === 'MATRIZ' || f.tipo === 'MATRIZ';
  const nome = f.nome || f.name || f.tradeName || (isMatriz ? 'TECIDO SUBLIMADO FORTALEZA' : 'FILIAL');
  const razaoSocial = f.razaoSocial || f.name || f.nome || (isMatriz ? 'TECIDO SUBLIMADO FORTALEZA' : 'FILIAL');
  const telefone = f.telefone || f.phone || '(85) 98425-1321';
  const city = f.cidade || f.address?.city || 'FORTALEZA';
  const state = f.uf || f.address?.state || 'CE';
  const now = new Date().toISOString();

  const enderecoObj = f.endereco || (f.address ? {
    cep: f.address.cep || '',
    logradouro: f.address.logradouro || '',
    numero: f.address.number || '',
    complemento: f.address.complement || '',
    bairro: f.address.bairro || '',
    cidade: f.address.city || city,
    estado: f.address.state || state,
  } : undefined);

  return {
    id: String(f.id || `filial-${Date.now()}`),
    codigo: f.codigo || (isMatriz ? 'MATRIZ' : 'FL-01'),
    nome,
    name: nome,
    tradeName: razaoSocial,
    razaoSocial,
    cnpj: f.cnpj || '36.047.818/0001-07',
    inscricaoEstadual: f.inscricaoEstadual || f.stateRegistration || 'ISENTO',
    stateRegistration: f.inscricaoEstadual || f.stateRegistration || 'ISENTO',
    cidade: city,
    uf: state,
    responsavel: f.responsavel || (isMatriz ? 'Gerente Geral Matriz' : 'Responsável Filial'),
    telefone,
    phone: telefone,
    whatsapp: f.whatsapp || telefone,
    email: f.email || 'contato@tecidosublimado.com.br',
    status: (f.status === 'INACTIVE' || f.status === 'INATIVA' ? 'INACTIVE' : 'ACTIVE') as any,
    tipo: f.tipo || (isMatriz ? 'MATRIZ' : 'FILIAL'),
    logoUrl: f.logoUrl || '/images/logo-web.png',
    createdAt: f.createdAt || now,
    updatedAt: f.updatedAt || now,
    createdBy: f.createdBy || 'SYSTEM',
    updatedBy: f.updatedBy || 'SYSTEM',
    version: Number(f.version || 1),
    address: {
      cep: enderecoObj?.cep || '',
      logradouro: enderecoObj?.logradouro || '',
      number: enderecoObj?.numero || '',
      complement: enderecoObj?.complemento || '',
      bairro: enderecoObj?.bairro || '',
      city,
      state,
    },
    endereco: enderecoObj,
  };
}

apiRouter.get('/v1/filiais', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const branches = Array.from(db.branches.values()).filter((b: any) => b.deletedAt == null);
    const normalized = branches.map(normalizeFilial).filter(Boolean);
    res.json({ success: true, data: normalized });
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/v1/branches', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const branches = Array.from(db.branches.values()).filter((b: any) => b.deletedAt == null);
    const normalized = branches.map(normalizeFilial).filter(Boolean);
    res.json({ success: true, data: normalized });
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/v1/metadata/branches', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const branches = Array.from(db.branches.values()).filter((b: any) => b.deletedAt == null);
    const normalized = branches.map(normalizeFilial).filter(Boolean);
    res.json({ success: true, data: normalized });
  } catch (err) {
    next(err);
  }
});

apiRouter.put('/v1/filiais', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const incoming = req.body?.filiais || req.body?.branches || req.body;
    const filiaisList = Array.isArray(incoming) ? incoming : (incoming ? [incoming] : []);

    for (const item of filiaisList) {
      if (!item || !item.id) continue;
      const normalized = normalizeFilial(item);
      if (normalized) {
        db.branches.set(String(item.id), normalized as any);
      }
    }

    const branches = Array.from(db.branches.values()).filter((b: any) => b.deletedAt == null);
    const normalized = branches.map(normalizeFilial).filter(Boolean);
    res.json({
      success: true,
      message: 'Filiais sincronizadas e salvas com sucesso no banco de dados',
      data: normalized,
    });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/v1/filiais', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const incoming = req.body?.filial || req.body?.filiais || req.body;
    const filiaisList = Array.isArray(incoming) ? incoming : (incoming ? [incoming] : []);

    for (const item of filiaisList) {
      if (!item || !item.id) continue;
      const normalized = normalizeFilial(item);
      if (normalized) {
        db.branches.set(String(item.id), normalized as any);
      }
    }

    const branches = Array.from(db.branches.values()).filter((b: any) => b.deletedAt == null);
    const normalized = branches.map(normalizeFilial).filter(Boolean);
    res.json({
      success: true,
      message: 'Filial cadastrada com sucesso no banco de dados',
      data: normalized,
    });
  } catch (err) {
    next(err);
  }
});

apiRouter.delete('/v1/filiais/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = Database.getInstance();
    if (id) {
      db.branches.delete(id);
      try {
        await pgPool.query(`DELETE FROM _system_store WHERE collection = 'branches' AND (id = $1 OR LOWER(id) = LOWER($1))`, [id]);
        await pgPool.query(`DELETE FROM branches WHERE id = $1`, [id]).catch(() => {});
      } catch (_) {}
    }
    res.json({ success: true, message: `Filial ${id} removida com sucesso do banco de dados.` });
  } catch (err) {
    next(err);
  }
});

apiRouter.delete('/v1/filiais', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    db.branches.clear();
    try {
      await pgPool.query(`DELETE FROM _system_store WHERE collection = 'branches'`);
      await pgPool.query(`DELETE FROM branches`).catch(() => {});
    } catch (_) {}
    res.json({ success: true, message: 'Todas as filiais foram excluídas com sucesso do banco de dados.' });
  } catch (err) {
    next(err);
  }
});

// --- Metas de Vendas (Persistência no Banco de Dados Postgres / _system_store) ---
apiRouter.get('/v1/metas', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const hasRealMatriz = db.metas.has('FILIAL-MATRIZ-001') || Array.from(db.metas.values()).some((m: any) => m?.filialCodigo === 'MATRIZ' && m?.filialId !== 'filial-matriz-fortaleza');
    const metasMap: Record<string, any> = {};
    for (const [id, data] of db.metas.entries()) {
      if (id === 'filial-matriz-fortaleza' && hasRealMatriz) {
        continue;
      }
      metasMap[id] = data;
    }
    res.json({ success: true, data: metasMap });
  } catch (err) {
    next(err);
  }
});

apiRouter.put('/v1/metas', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const incomingMetas = req.body?.metas || req.body;
    if (incomingMetas && typeof incomingMetas === 'object') {
      const hasOtherMatriz = incomingMetas['FILIAL-MATRIZ-001'] || Object.values(incomingMetas).some((m: any) => m?.filialCodigo === 'MATRIZ' && m?.filialId !== 'filial-matriz-fortaleza');
      if (hasOtherMatriz && db.metas.has('filial-matriz-fortaleza')) {
        db.metas.delete('filial-matriz-fortaleza');
        try {
          await pgPool.query(`DELETE FROM _system_store WHERE collection = 'metas' AND id = 'filial-matriz-fortaleza'`);
        } catch (_) {}
      }
      for (const [id, data] of Object.entries(incomingMetas)) {
        db.metas.set(id, data);
        try {
          await pgPool.query(`
            INSERT INTO _system_store (collection, id, data)
            VALUES ('metas', $1, $2)
            ON CONFLICT (collection, id) DO UPDATE SET data = $2
          `, [id, JSON.stringify(data)]);
        } catch (_) {}
      }
    }
    const hasRealMatriz = db.metas.has('FILIAL-MATRIZ-001') || Array.from(db.metas.values()).some((m: any) => m?.filialCodigo === 'MATRIZ' && m?.filialId !== 'filial-matriz-fortaleza');
    const metasMap: Record<string, any> = {};
    for (const [id, data] of db.metas.entries()) {
      if (id === 'filial-matriz-fortaleza' && hasRealMatriz) continue;
      metasMap[id] = data;
    }
    res.json({ success: true, data: metasMap });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/v1/metas', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const incomingMetas = req.body?.metas || req.body;
    if (incomingMetas && typeof incomingMetas === 'object') {
      const hasOtherMatriz = incomingMetas['FILIAL-MATRIZ-001'] || Object.values(incomingMetas).some((m: any) => m?.filialCodigo === 'MATRIZ' && m?.filialId !== 'filial-matriz-fortaleza');
      if (hasOtherMatriz && db.metas.has('filial-matriz-fortaleza')) {
        db.metas.delete('filial-matriz-fortaleza');
        try {
          await pgPool.query(`DELETE FROM _system_store WHERE collection = 'metas' AND id = 'filial-matriz-fortaleza'`);
        } catch (_) {}
      }
      for (const [id, data] of Object.entries(incomingMetas)) {
        db.metas.set(id, data);
        try {
          await pgPool.query(`
            INSERT INTO _system_store (collection, id, data)
            VALUES ('metas', $1, $2)
            ON CONFLICT (collection, id) DO UPDATE SET data = $2
          `, [id, JSON.stringify(data)]);
        } catch (_) {}
      }
    }
    const hasRealMatriz = db.metas.has('FILIAL-MATRIZ-001') || Array.from(db.metas.values()).some((m: any) => m?.filialCodigo === 'MATRIZ' && m?.filialId !== 'filial-matriz-fortaleza');
    const metasMap: Record<string, any> = {};
    for (const [id, data] of db.metas.entries()) {
      if (id === 'filial-matriz-fortaleza' && hasRealMatriz) continue;
      metasMap[id] = data;
    }
    res.json({ success: true, data: metasMap });
  } catch (err) {
    next(err);
  }
});

// --- Controle e Permissões (RBAC) (Persistência no Banco de Dados Postgres / Supabase) ---
async function fetchPermissionsFromDb(db: Database): Promise<Record<string, any>> {
  if (isPostgresActive() !== false) {
    try {
      const permRows = await pgPool.query('SELECT role_id, rules FROM permissions');
      for (const pr of permRows.rows) {
        if (pr.role_id && pr.rules) {
          const rulesObj = typeof pr.rules === 'string' ? JSON.parse(pr.rules) : pr.rules;
          db.permissions.set(pr.role_id, rulesObj);
        }
      }
    } catch (permRelErr: any) {
      markDatabaseUnavailable(permRelErr);
    }
  }

  // Se o banco estiver vazio ou faltar os papéis padrão, semeia com os padrões do sistema
  if (db.permissions.size === 0) {
    const defaultPerms = getDefaultSystemPermissions();
    for (const [id, rules] of Object.entries(defaultPerms)) {
      db.permissions.set(id, rules);
    }
    if (isPostgresActive() !== false) {
      savePermissionsToDb(db, defaultPerms).catch(() => {});
    }
  }

  const permissionsMap: Record<string, any> = {};
  for (const [id, data] of db.permissions.entries()) {
    permissionsMap[id] = data;
  }
  return permissionsMap;
}

const ROLE_ALIAS_GROUPS = [
  ['ADMINISTRATIVO', 'Administrativo', 'Administração', 'administracao', 'Administracao', 'admin'],
  ['CONFERENCIA', 'Conferência', 'Conferencia'],
  ['IMPRESSÃO', 'Impressão', 'Impressao'],
  ['CALANDRA', 'Calandra'],
];

async function savePermissionsToDb(db: Database, incoming: any): Promise<Record<string, any>> {
  if (incoming && typeof incoming === 'object') {
    // Se algum alias do grupo estiver ausente em incoming, preenche com o existente
    for (const group of ROLE_ALIAS_GROUPS) {
      const presentAlias = group.find((alias) => incoming[alias] && typeof incoming[alias] === 'object');
      if (presentAlias) {
        for (const alias of group) {
          if (!incoming[alias]) {
            incoming[alias] = { ...incoming[presentAlias] };
          }
        }
      }
    }

    const promises = Object.entries(incoming).map(async ([id, data]) => {
      if (!id || typeof data !== 'object') return;
      db.permissions.set(id, data);
      if (isPostgresActive() !== false) {
        const jsonStr = JSON.stringify(data);
        try {
          await pgPool.query(`
            INSERT INTO permissions (role_id, rules, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (role_id) DO UPDATE SET
              rules = $2, updated_at = NOW()
          `, [String(id), jsonStr]);
        } catch (dbErr: any) {
          markDatabaseUnavailable(dbErr);
        }
        try {
          await pgPool.query(`
            INSERT INTO _system_store (collection, id, data)
            VALUES ('permissions', $1, $2)
            ON CONFLICT (collection, id) DO UPDATE SET
              data = $2
          `, [String(id), jsonStr]);
        } catch (storeErr: any) {
          markDatabaseUnavailable(storeErr);
        }
      }
    });

    await Promise.all(promises);

    // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: Registrar histórico de auditoria e controle de permissões
    try {
      const updatedRolesCount = Object.keys(incoming).length;
      const historyId = `PERMHIST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const nowIso = new Date().toISOString();
      const historyEntry = {
        id: historyId,
        action: 'ATUALIZACAO_PERMISSOES_RBAC',
        rolesCount: updatedRolesCount,
        rolesUpdated: Object.keys(incoming),
        details: `Atualização da matriz de permissões para ${updatedRolesCount} perfil(is)`,
        performedBy: 'Developer / Administrador Master',
        timestamp: nowIso,
        createdAt: nowIso,
      };
      db.permissionHistory.push(historyEntry);
      if (isPostgresActive() !== false) {
        pgPool.query(`
          INSERT INTO permission_history (id, action, details, roles_count, roles_updated, performed_by, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (id) DO NOTHING
        `, [
          historyId,
          historyEntry.action,
          historyEntry.details,
          historyEntry.rolesCount,
          JSON.stringify(historyEntry.rolesUpdated),
          historyEntry.performedBy,
        ]).catch(() => {});
      }
    } catch (_) {}
  }

  const permissionsMap: Record<string, any> = {};
  for (const [id, data] of db.permissions.entries()) {
    permissionsMap[id] = data;
  }
  return permissionsMap;
}

apiRouter.get('/v1/permissions', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const permissionsMap = await fetchPermissionsFromDb(db);
    res.json({ success: true, data: permissionsMap });
  } catch (err) {
    next(err);
  }
});

apiRouter.put('/v1/permissions', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const incoming = req.body?.permissions || req.body;
    const permissionsMap = await savePermissionsToDb(db, incoming);
    res.json({ success: true, message: 'Permissões salvas com sucesso no Supabase / PostgreSQL', data: permissionsMap });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/v1/permissions', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const incoming = req.body?.permissions || req.body;
    const permissionsMap = await savePermissionsToDb(db, incoming);
    res.json({ success: true, message: 'Permissões salvas com sucesso no Supabase / PostgreSQL', data: permissionsMap });
  } catch (err) {
    next(err);
  }
});

// Alias em português para compatibilidade
apiRouter.get('/v1/permissoes', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const permissionsMap = await fetchPermissionsFromDb(db);
    res.json({ success: true, data: permissionsMap });
  } catch (err) {
    next(err);
  }
});

apiRouter.put('/v1/permissoes', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const incoming = req.body?.permissions || req.body?.permissoes || req.body;
    const permissionsMap = await savePermissionsToDb(db, incoming);
    res.json({ success: true, message: 'Permissões salvas com sucesso no Supabase / PostgreSQL', data: permissionsMap });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/v1/permissoes', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    const incoming = req.body?.permissions || req.body?.permissoes || req.body;
    const permissionsMap = await savePermissionsToDb(db, incoming);
    res.json({ success: true, message: 'Permissões salvas com sucesso no Supabase / PostgreSQL', data: permissionsMap });
  } catch (err) {
    next(err);
  }
});

// --- Emissão de Notas Fiscais (NF-e / NFC-e) Endpoints ---
apiRouter.get('/v1/fiscal/config', requireAuth, FiscalController.getConfig);
apiRouter.put('/v1/fiscal/config', requireAuth, FiscalController.updateConfig);
apiRouter.get('/v1/fiscal/notas', requireAuth, FiscalController.listNotas);
apiRouter.get('/v1/fiscal/notas/:id', requireAuth, FiscalController.getNotaById);
apiRouter.get('/v1/fiscal/notas/origem/:origemId', requireAuth, FiscalController.getNotaByOrigem);
apiRouter.post('/v1/fiscal/emitir', requireAuth, FiscalController.emitirNota);
apiRouter.post('/v1/fiscal/notas/:id/cancelar', requireAuth, FiscalController.cancelarNota);
apiRouter.post('/v1/fiscal/notas/:id/sync', requireAuth, FiscalController.syncNota);
apiRouter.post('/v1/fiscal/sync-pending', requireAuth, FiscalController.syncPendingNotas);
apiRouter.get('/v1/fiscal/notas/:id/xml', requireAuth, FiscalController.getXml);
apiRouter.delete('/v1/fiscal/notas/:id', requireAuth, FiscalController.deleteNota);
apiRouter.post('/v1/fiscal/reset-testing', requireAuth, FiscalController.resetFiscalTesting);
apiRouter.get('/v1/fiscal/dashboard', requireAuth, FiscalController.getDashboardMetrics);
apiRouter.post('/v1/fiscal/test-connection', requireAuth, FiscalController.testConnection);

// --- Exclusive Developer Endpoints ---
apiRouter.get('/v1/developer/diagnostics', requireAuth, requireDeveloper, DeveloperController.getSystemDiagnostics);
apiRouter.post('/v1/developer/test-database', requireAuth, requireDeveloper, DeveloperController.testDatabaseConnection);
apiRouter.post('/v1/developer/update-database-url', requireAuth, requireDeveloper, DeveloperController.updateDatabaseUrl);
apiRouter.post('/v1/developer/backup', requireAuth, requireDeveloper, DeveloperController.triggerBackup);
apiRouter.post('/v1/developer/reset', requireAuth, requireDeveloper, DeveloperController.resetSystem);

// --- Backup & Restauração Endpoints (Exclusivo Developer & Administrador Master) ---
apiRouter.get('/v1/backup/stats', requireAuth, BackupController.getStats);
apiRouter.post('/v1/backup/export', requireAuth, BackupController.exportBackup);
apiRouter.post('/v1/backup/import', requireAuth, BackupController.importBackup);
// --- Fórmulas de Cálculo de Medidas (Persistência no Banco de Dados / _system_store / Supabase) ---
apiRouter.get('/v1/measurement-formulas', optionalAuth, async (req, res, next) => {
  try {
    const db = Database.getInstance();
    let formulas: any[] = Array.from(db.measurementFormulas.values());

    if (formulas.length === 0) {
      try {
        const rows = await pgPool.query(
          `SELECT id, data FROM _system_store WHERE collection = 'measurement_formulas' ORDER BY id ASC`
        );
        if (rows && rows.rows && rows.rows.length > 0) {
          formulas = rows.rows.map((r: any) => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
          for (const f of formulas) {
            if (f && f.id) {
              db.measurementFormulas.set(String(f.id), f);
            }
          }
        }
      } catch (_) {}
    }

    const defaultMesa = {
      id: 'calculo_mesa',
      titulo: 'Cálculo de Mesa Retangular',
      descricao: 'Cálculo padrão para Toalha de Mesa Retangular: Babado =(Frente+Lateral)*4 | Valor Babado =Babado*Alt*m² | Valor Tampo =Frente*Lat*m² | Valor Sobreposição =(Frente+Caimento)*(Lateral+Caimento)*32 | C/ Sobreposição =Babado+Tampo+Sobrep+20 | S/ Sobreposição =Babado+Tampo+20',
      tipo: 'mesa',
      campos: [
        { id: 'frente', label: 'Frente', unidade: 'm', obrigatorio: true },
        { id: 'lateral', label: 'Lateral', unidade: 'm', obrigatorio: true },
        { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
        { id: 'caimento', label: 'Caimento', unidade: 'm', obrigatorio: false },
        { id: 'babado', label: 'Babado', unidade: 'm', obrigatorio: false },
        { id: 'preco_venda', label: 'Preço de Venda (m²)', unidade: 'R$', obrigatorio: false, dica: 'Busca o preço de venda cadastrado do produto' },
      ],
      formulaExpressao: '(babado * altura) + (frente * lateral)',
      formulaTexto: 'Saia (Babado × Altura) + Tampo (Frente × Lateral) com Sobreposição',
      permiteSobreposicao: true,
      regrasFinanceiras: {
        tamanhoBabadoFormula: '=(SOMA(FRENTE:LATERAL)*2)*2',
        valorBabadoFormula: '=ARREDONDAR.PARA.CIMA((BABADO * ALTURA * VALOR DO M2); 0)',
        valorTampoFormula: '=ARREDONDAR.PARA.CIMA((FRENTE * LATERAL * VALOR DO M2); 0)',
        valorSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA((SOMA(FRENTE;CAIMENTO) * SOMA(LATERAL;CAIMENTO)) * 32; 0)',
        valorComSobreposicaoFormula: '=VALOR DO BABADO + VALOR DO TAMPO + VALOR DA SOBREPOSIÇÃO + 20',
        valorSemSobreposicaoFormula: '=VALOR DO BABADO + VALOR DO TAMPO + 20',
        taxaSobreposicaoM2: 32,
        taxaAdicionalAcabamento: 20,
      },
      ativo: true,
      ordem: 1,
      criadoPor: 'Sistema SubliGestão'
    };

    const defaultMesaRedonda = {
      id: 'calculo_mesa_redonda',
      titulo: 'Cálculo de Mesa Redonda',
      descricao: 'Cálculo padrão para Toalha de Mesa Redonda: Babado =(Diâmetro*3.14)*2 | Valor Babado =Babado*Alt*m² | Valor Tampo =Diâmetro*Diâmetro*m² | Valor Sobreposição =(Diâmetro+Caimento)*(Diâmetro+Caimento)*32 | C/ Sobreposição =Babado+Tampo+Sobrep+20 | S/ Sobreposição =Babado+Tampo+20',
      tipo: 'mesa',
      campos: [
        { id: 'frente', label: 'Diâmetro (Frente)', unidade: 'm', obrigatorio: true },
        { id: 'lateral', label: 'Lateral', unidade: 'm', obrigatorio: false },
        { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
        { id: 'caimento', label: 'Caimento', unidade: 'm', obrigatorio: false },
        { id: 'babado', label: 'Babado', unidade: 'm', obrigatorio: false },
        { id: 'preco_venda', label: 'Preço de Venda (m²)', unidade: 'R$', obrigatorio: false, dica: 'Busca o preço de venda cadastrado do produto' },
      ],
      formulaExpressao: '(babado * altura) + (frente * frente)',
      formulaTexto: 'Saia (Babado × Altura) + Tampo Redondo com Sobreposição',
      permiteSobreposicao: true,
      regrasFinanceiras: {
        tamanhoBabadoFormula: '=(DIÂMETRO * 3.14) * 2',
        valorBabadoFormula: '=ARREDONDAR.PARA.CIMA((BABADO * ALTURA * VALOR DO M2); 0)',
        valorTampoFormula: '=ARREDONDAR.PARA.CIMA((DIÂMETRO * DIÂMETRO * VALOR DO M2); 0)',
        valorSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA(((DIÂMETRO + CAIMENTO) * (DIÂMETRO + CAIMENTO)) * 32; 0)',
        valorComSobreposicaoFormula: '=VALOR DO BABADO + VALOR DO TAMPO + VALOR DA SOBREPOSIÇÃO + 20',
        valorSemSobreposicaoFormula: '=VALOR DO BABADO + VALOR DO TAMPO + 20',
        taxaSobreposicaoM2: 32,
        taxaAdicionalAcabamento: 20,
      },
      ativo: true,
      ordem: 2,
      criadoPor: 'Sistema SubliGestão'
    };

    const defaultMesaRetro = {
      id: 'calculo_mesa_retro',
      titulo: 'Cálculo Mesa Retrô',
      descricao: 'Cálculo específico para Mesa Retrô: Babado =((Frente+0,5)*3,14)*2 | Valor Babado =Babado*(Alt-0,25)*m² | Valor Tampo =(Frente+0,5)*(Lateral+0,5)*m² | Sobreposição =(Frente+0,5+Caimento)*(Lateral+0,5+Caimento)*m² | C/ Sobrep =Babado+Tampo+Sobrep+20 | S/ Sobrep =Babado+Tampo+20',
      tipo: 'mesa',
      campos: [
        { id: 'frente', label: 'Frente Mesa', unidade: 'm', obrigatorio: true },
        { id: 'lateral', label: 'Lateral', unidade: 'm', obrigatorio: true },
        { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
        { id: 'caimento', label: 'Caimento', unidade: 'm', obrigatorio: false },
        { id: 'babado', label: 'Babado', unidade: 'm', obrigatorio: false },
        { id: 'preco_venda', label: 'Preço de Venda (m²)', unidade: 'R$', obrigatorio: false, dica: 'Busca o preço de venda cadastrado do produto' },
      ],
      formulaExpressao: '(babado * (altura - 0.25)) + ((frente + 0.5) * (lateral + 0.5))',
      formulaTexto: 'Saia Babado ((Frente+0,5)×3,14×2 × (Altura-0,25)) + Tampo ((Frente+0,5) × (Lateral+0,5))',
      permiteSobreposicao: true,
      regrasFinanceiras: {
        tamanhoBabadoFormula: '=ARREDONDAR.PARA.CIMA(((FRENTE + 0,5) * 3,14) * 2; 0)',
        valorBabadoFormula: '=ARREDONDAR.PARA.CIMA((BABADO * (ALTURA - 0,25) * VALOR DO M2); 0)',
        valorTampoFormula: '=ARREDONDAR.PARA.CIMA(((FRENTE + 0,5) * (LATERAL + 0,5) * VALOR DO M2); 0)',
        valorSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA(((FRENTE + 0,5 + CAIMENTO) * (LATERAL + 0,5 + CAIMENTO) * VALOR DO M2); 0)',
        valorComSobreposicaoFormula: '=VALOR DO BABADO + VALOR DO TAMPO + VALOR DA SOBREPOSIÇÃO + 20',
        valorSemSobreposicaoFormula: '=VALOR DO BABADO + VALOR DO TAMPO + 20',
        taxaSobreposicaoM2: 32,
        taxaAdicionalAcabamento: 20,
      },
      ativo: true,
      ordem: 3,
      criadoPor: 'Sistema SubliGestão'
    };

    const defaultMesaBabado = {
      id: 'calculo_mesa_babado',
      titulo: 'Cálculo de Mesa Babado',
      descricao: 'Cálculo específico para Mesa Babado: Tampo, Faixa e Faixas de Babado com base na Qtd de Babado.',
      tipo: 'mesa',
      campos: [
        { id: 'frente', label: 'Frente', unidade: 'm', obrigatorio: true },
        { id: 'lateral', label: 'Lateral', unidade: 'm', obrigatorio: true },
        { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
        { id: 'qtd_babado', label: 'Qtd de Babado', unidade: 'un', obrigatorio: true, padrao: 2 },
        { id: 'preco_venda', label: 'Preço de Venda (m²)', unidade: 'R$', obrigatorio: false, dica: 'Busca o preço de venda cadastrado do produto' },
      ],
      formulaExpressao: '(frente * lateral) + (((2*frente) + (2*lateral)) * altura) + ((2 * ((2*frente) + (2*lateral))) * altura)',
      formulaTexto: 'Tampo (Frente × Lateral) + Faixa (Perímetro × Altura) + Babado (2 × Perímetro × Altura)',
      permiteSobreposicao: false,
      regrasFinanceiras: {
        tamanhoBabadoFormula: '=(2 * ((2*FRENTE) + (2*LATERAL)))',
        valorFaixaBabadoFormula: '=ARREDONDAR.PARA.CIMA((2 * ((2*FRENTE) + (2*LATERAL)) * (ALTURA / QTD DE BABADO) * VALOR DO M2); 0)',
        valorBabadoFormula: '=FAIXA DE BABADO * QTD DE BABADO',
        valorTampoFormula: '=ARREDONDAR.PARA.CIMA((FRENTE * LATERAL * VALOR DO M2); 0)',
        valorFaixaFormula: '=ARREDONDAR.PARA.CIMA((((2*FRENTE) + (2*LATERAL)) * ALTURA * VALOR DO M2); 0)',
        valorTotalFormula: '=(VALOR DO TAMPO + FAIXA + VALOR DE BABADO) + (20 * QTD DE BABADO)',
        valorComSobreposicaoFormula: '=(VALOR DO TAMPO + FAIXA + VALOR DE BABADO) + (20 * QTD DE BABADO)',
        valorSemSobreposicaoFormula: '=(VALOR DO TAMPO + FAIXA + VALOR DE BABADO) + (20 * QTD DE BABADO)',
        taxaSobreposicaoM2: 32,
        taxaAdicionalAcabamento: 20,
      },
      ativo: true,
      ordem: 4,
      criadoPor: 'Sistema SubliGestão'
    };

    const defaultCilindro = {
      id: 'calculo_cilindro',
      titulo: 'Cálculo de Cilindro',
      descricao: 'Cálculo específico para Cilindro: Tampo (Largura/3), Valor Base (Largura×Altura×m²), Valor Tampo ((Largura/3)²×m²).',
      tipo: 'cilindro',
      campos: [
        { id: 'largura', label: 'Largura', unidade: 'm', obrigatorio: true },
        { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
        { id: 'preco_venda', label: 'Preço de Venda (m²)', unidade: 'R$', obrigatorio: false, dica: 'Busca o preço de venda cadastrado do produto' },
      ],
      formulaExpressao: '(largura * altura) + (((largura / 3) ^ 2) * preco_venda)',
      formulaTexto: 'Valor Base (Largura × Altura × m²) + Valor do Tampo ((Largura / 3)² × m²)',
      permiteSobreposicao: false,
      regrasFinanceiras: {
        tamanhoBabadoFormula: '=LARGURA / 3',
        valorTampoFormula: '=((LARGURA / 3)^2) * VALOR DO M2',
        valorSobreposicaoFormula: '=LARGURA * ALTURA * VALOR DO M2',
        valorTotalFormula: '=ARREDONDAR.PARA.CIMA((LARGURA * ALTURA * VALOR DO M2) + (((LARGURA / 3)^2) * VALOR DO M2); 0)',
        valorComSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA((LARGURA * ALTURA * VALOR DO M2) + (((LARGURA / 3)^2) * VALOR DO M2); 0)',
        valorSemSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA((LARGURA * ALTURA * VALOR DO M2) + (((LARGURA / 3)^2) * VALOR DO M2); 0)',
        taxaSobreposicaoM2: 32,
      },
      ativo: true,
      ordem: 5,
      criadoPor: 'Sistema SubliGestão'
    };

    const defaultCubo = {
      id: 'calculo_cubo',
      titulo: 'Cálculo Cubo/Mesa Veste',
      descricao: 'Cálculo Cubo/Mesa Veste: Medida, Altura e Tampo. calculo = (medida * 4), valor = ARREDONDAR.PARA.CIMA(altura * calculo * preço; 0), valor tampo = ARREDONDAR.PARA.CIMA(tampo * tampo * preço; 0), Total = (valor + valor tampo).',
      tipo: 'cubo',
      campos: [
        { id: 'medida', label: 'Medida', unidade: 'm', obrigatorio: true },
        { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
        { id: 'tampo', label: 'Tampo', unidade: 'm', obrigatorio: true },
      ],
      formulaExpressao: 'ARREDONDAR.PARA.CIMA((altura * (medida * 4) * preco_venda) + (tampo * tampo * preco_venda); 0)',
      formulaTexto: 'calculo = (medida * 4) | valor = ARREDONDAR.PARA.CIMA(altura * calculo * preço; 0) | valor tampo = ARREDONDAR.PARA.CIMA(tampo * tampo * preço; 0) | Total = (valor + valor tampo)',
      permiteSobreposicao: false,
      regrasFinanceiras: {
        tamanhoBabadoFormula: '=MEDIDA * 4',
        valorBabadoFormula: '=ARREDONDAR.PARA.CIMA(ALTURA * CÁLCULO * PREÇO; 0)',
        valorTampoFormula: '=ARREDONDAR.PARA.CIMA(TAMPO * TAMPO * PREÇO; 0)',
        valorTotalFormula: '=ARREDONDAR.PARA.CIMA(VALOR + VALOR TAMPO; 0)',
        valorComSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA(VALOR + VALOR TAMPO; 0)',
        valorSemSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA(VALOR + VALOR TAMPO; 0)',
      },
      ativo: true,
      ordem: 6,
      criadoPor: 'Sistema SubliGestão'
    };

    const baseSix = [defaultMesa, defaultMesaRedonda, defaultMesaRetro, defaultMesaBabado, defaultCilindro, defaultCubo];

    // Consulta se alguma base foi explicitamente excluída
    let deletedBaseIds = new Set<string>();
    try {
      const delRows = await pgPool.query(
        `SELECT id FROM _system_store WHERE collection = 'measurement_formulas_deleted'`
      );
      if (delRows && delRows.rows) {
        deletedBaseIds = new Set(delRows.rows.map((r: any) => String(r.id)));
      }
    } catch (_) {}

    // Garante que as bases essenciais estejam no retorno se não foram excluídas
    for (const base of baseSix) {
      if (deletedBaseIds.has(base.id)) {
        continue;
      }
      const existingIdx = formulas.findIndex((f: any) => f.id === base.id);
      if (existingIdx >= 0) {
        formulas[existingIdx] = base;
      } else {
        formulas.push(base);
      }
      await db.measurementFormulas.set(base.id, base);
    }

    const finalFormulas: any[] = [];
    const seenIds = new Set<string>();

    for (const base of baseSix) {
      if (!deletedBaseIds.has(base.id)) {
        finalFormulas.push(base);
        seenIds.add(base.id);
      }
    }

    for (const f of formulas) {
      if (f && f.id && !seenIds.has(f.id) && !deletedBaseIds.has(f.id)) {
        finalFormulas.push(f);
        seenIds.add(f.id);
      }
    }

    res.json({ success: true, data: finalFormulas });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/v1/measurement-formulas', optionalAuth, async (req, res, next) => {
  try {
    const formula = req.body;
    if (!formula || !formula.id || !formula.titulo) {
      res.status(400).json({ success: false, error: 'ID e título da fórmula são obrigatórios.' });
      return;
    }
    const db = Database.getInstance();
    await db.measurementFormulas.set(String(formula.id), formula);
    try {
      await pgPool.query(
        `INSERT INTO _system_store (collection, id, data) VALUES ('measurement_formulas', $1, $2)
         ON CONFLICT (collection, id) DO UPDATE SET data = $2`,
        [String(formula.id), JSON.stringify(formula)]
      );
      // Remove da lista de excluídos caso tenha sido recriada
      await pgPool.query(
        `DELETE FROM _system_store WHERE collection = 'measurement_formulas_deleted' AND id = $1`,
        [String(formula.id)]
      );
    } catch (_) {}
    res.json({ success: true, data: formula });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/v1/measurement-formulas/restore-defaults', optionalAuth, async (_req, res, next) => {
  try {
    try {
      await pgPool.query(
        `DELETE FROM _system_store WHERE collection = 'measurement_formulas_deleted'`
      );
    } catch (_) {}
    res.json({ success: true, message: 'Bases de cálculo padrão restauradas com sucesso.' });
  } catch (err) {
    next(err);
  }
});

apiRouter.delete('/v1/measurement-formulas/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = Database.getInstance();
    await db.measurementFormulas.delete(String(id));
    try {
      await pgPool.query(
        `DELETE FROM _system_store WHERE collection = 'measurement_formulas' AND id = $1`,
        [String(id)]
      );
      const baseIds = ['calculo_mesa', 'calculo_mesa_redonda', 'calculo_mesa_retro', 'calculo_mesa_babado', 'calculo_cilindro', 'calculo_cubo'];
      if (baseIds.includes(String(id))) {
        await pgPool.query(
          `INSERT INTO _system_store (collection, id, data) VALUES ('measurement_formulas_deleted', $1, $2)
           ON CONFLICT (collection, id) DO UPDATE SET data = $2`,
          [String(id), JSON.stringify({ deletedAt: new Date().toISOString() })]
        );
      }
    } catch (_) {}
    res.json({ success: true, message: 'Fórmula removida com sucesso.' });
  } catch (err) {
    next(err);
  }
});


// --- OpenAPI Specification Endpoint ---
apiRouter.get('/v1/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'ERP SubliGestão - Enterprise API',
      version: '1.0.0',
      description: 'API corporativa para gestão da Tecido Sublimado Fortaleza e sublimação.',
    },
    paths: {
      '/api/v1/auth/login': {
        post: {
          summary: 'Autenticação de Usuário',
          description: 'Efetua login via username (@Marcelo-dev) e senha com Argon2/BCrypt.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    username: { type: 'string', example: 'usuario.sistema' },
                    password: { type: 'string', example: '********' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Autenticação realizada com sucesso.' },
            '401': { description: 'Credenciais inválidas ou conta bloqueada.' },
          },
        },
      },
      '/api/v1/auth/me': {
        get: {
          summary: 'Obter perfil do usuário autenticado',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Dados do perfil do usuário.' } },
        },
      },
      '/api/v1/developer/diagnostics': {
        get: {
          summary: 'Métricas técnicas e diagnósticos (Exclusivo Developer)',
          security: [{ bearerAuth: [] }],
        },
      },
    },
  });
});

// =====================================================================================
// ROTAS DE GESTÃO E SINCRONIZAÇÃO DE TEMAS DIVERSOS (TABELA 'themes' DO SUPABASE / POSTGRESQL)
// =====================================================================================

function mapThemeRowToCustomTheme(r: any): any {
  const full = typeof r.full_data === 'string' ? JSON.parse(r.full_data) : (r.full_data || {});
  const colors = typeof r.colors === 'string' ? JSON.parse(r.colors) : (r.colors || full.palette || {});
  const loginSettings = typeof r.login_settings === 'string' ? JSON.parse(r.login_settings) : (r.login_settings || full.loginSettings || {});

  let bg70 = r.bg70_url || full.bg70Url || loginSettings.bg70Url || '';
  let bg30 = r.bg30_url || full.bg30Url || loginSettings.bg30Url || '';

  // Salva cópia local em disco como cache estático de alta performance, mantendo a string original intacta para sincronização multi-servidor (Render + Google IA)
  if (bg70 && bg70.startsWith('data:image/') && bg70.length > 500) {
    try {
      const match = bg70.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        let ext = match[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        const buffer = Buffer.from(match[2], 'base64');
        const themesDir = path.join(process.cwd(), 'public/images/themes');
        if (!fs.existsSync(themesDir)) fs.mkdirSync(themesDir, { recursive: true });
        const filename = `theme_${r.id}_bg70.${ext}`;
        fs.writeFileSync(path.join(themesDir, filename), buffer);
      }
    } catch (_) {}
  }

  if (bg30 && bg30.startsWith('data:image/') && bg30.length > 500) {
    try {
      const match = bg30.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        let ext = match[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        const buffer = Buffer.from(match[2], 'base64');
        const themesDir = path.join(process.cwd(), 'public/images/themes');
        if (!fs.existsSync(themesDir)) fs.mkdirSync(themesDir, { recursive: true });
        const filename = `theme_${r.id}_bg30.${ext}`;
        fs.writeFileSync(path.join(themesDir, filename), buffer);
      }
    } catch (_) {}
  }

  const isDisplay = Boolean(r.is_active === true || full.displayTheme === true || full.is_active === true);

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
    bg70Url: bg70,
    bg30Url: bg30,
    loginSettings: {
      ...loginSettings,
      bg70Url: bg70,
      bg30Url: bg30,
    },
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : (full.createdAt || new Date().toISOString()),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : (full.updatedAt || new Date().toISOString()),
  };
}

async function saveThemeToSupabaseTable(themeData: any) {
  const isDisplay = Boolean(themeData.displayTheme === true || themeData.is_active === true);

  if (isDisplay) {
    await pgPool.query('UPDATE themes SET is_active = false, updated_at = NOW() WHERE id != $1', [themeData.id]).catch(() => {});
  }

  const colorsJson = JSON.stringify(themeData.palette || {});
  const loginSettingsJson = JSON.stringify(themeData.loginSettings || {});
  const fullDataJson = JSON.stringify({
    ...themeData,
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
    themeData.id,
    themeData.name,
    colorsJson,
    isDisplay,
    'Usuário / Developer',
    themeData.themeType || 'natalino',
    themeData.primaryColor || 'gold',
    themeData.startDate || '',
    themeData.endDate || '',
    themeData.bg70Url || '',
    themeData.bg30Url || '',
    loginSettingsJson,
    fullDataJson,
  ]);
}

function sanitizeThemeForAudit(theme: any): any {
  if (!theme || typeof theme !== 'object') return theme;
  try {
    const clone = JSON.parse(JSON.stringify(theme));
    const truncateBase64 = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === 'string' && val.startsWith('data:image/')) {
          obj[key] = `[Imagem Base64 - ${Math.round(val.length / 1024)} KB]`;
        } else if (typeof val === 'object' && val !== null) {
          truncateBase64(val);
        }
      }
    };
    truncateBase64(clone);
    return clone;
  } catch {
    return { id: theme.id, name: theme.name, displayTheme: theme.displayTheme };
  }
}

// Endpoint dedicado para upload e salvamento de imagens de temas em disco
apiRouter.post('/v1/themes/upload-image', optionalAuth, async (req, res, next) => {
  try {
    const { imageBase64, filename } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/')) {
      return res.status(400).json({ success: false, message: 'Formato de imagem inválido ou ausente.' });
    }

    const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, message: 'Dados base64 de imagem inválidos.' });
    }

    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    const buffer = Buffer.from(matches[2], 'base64');

    const themesDir = path.join(process.cwd(), 'public/images/themes');
    if (!fs.existsSync(themesDir)) {
      fs.mkdirSync(themesDir, { recursive: true });
    }

    const safeName = `theme_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = path.join(themesDir, safeName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/images/themes/${safeName}`;

    // SALVA A IMAGEM EM BASE64 DIRETO NO SUPABASE NA TABELA SYSTEM_IMAGES
    // PARA FUNCIONAR TANTO NO RENDER QUANTO NO GOOGLE IA
    await saveImageToSupabase(publicUrl, filename || safeName, imageBase64, `image/${ext}`).catch(() => {});
    if (filename) {
      await saveImageToSupabase(`/images/${filename}`, filename, imageBase64, `image/${ext}`).catch(() => {});
    }

    res.json({
      success: true,
      url: imageBase64, // Base64 direto para persistência universal no Supabase
      localUrl: publicUrl,
      publicUrl: publicUrl,
      message: 'Imagem de tema salva em Base64 no Supabase e em cache de disco.',
    });
  } catch (err) {
    next(err);
  }
});

// =====================================================================================
// ROTAS DE GESTÃO E SINCRONIZAÇÃO EM TEMPO REAL DE TEMAS DIVERSOS (SUPABASE + DISK + SSE)
// =====================================================================================

// Stream SSE em Tempo Real para todos os perfis conectados
// Stream SSE em Tempo Real para todos os perfis conectados
apiRouter.get('/v1/themes/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const themesList = await getThemesList();
  const active = themesList.find((t) => t.displayTheme || t.is_active);
  const initialData = JSON.stringify({
    type: 'INITIAL_STATE',
    version: getThemeCurrentVersion(),
    activeThemeId: active ? active.id : null,
    data: themesList,
    timestamp: new Date().toISOString(),
  });
  res.write(`data: ${initialData}\n\n`);

  const unregister = registerThemeSseClient(res);

  // Heartbeat ping a cada 15 segundos
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
      unregister();
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unregister();
  });
});

// Endpoint leve para verificação de versão do tema em tempo real
apiRouter.get('/v1/themes/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Dispara verificação em segundo plano sem bloquear a resposta HTTP
  checkAndSyncExternalSupabaseChanges().catch(() => {});

  res.json({
    success: true,
    version: getThemeCurrentVersion(),
  });
});

// Consulta de temas cadastrados
apiRouter.get('/v1/themes', optionalAuth, async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const themesList = await getThemesList();
    res.json({
      success: true,
      version: getThemeCurrentVersion(),
      data: themesList,
    });
  } catch (err) {
    next(err);
  }
});

// Salvar ou atualizar tema
apiRouter.post('/v1/themes', optionalAuth, async (req, res, next) => {
  try {
    const body = req.body;
    if (!body || !body.id) {
      return res.status(400).json({ success: false, message: 'Dados do tema incompletos ou ID ausente.' });
    }

    const updatedThemes = await saveThemeFull(body);
    res.json({
      success: true,
      message: 'Tema salvo com sucesso, persistido em disco, sincronizado no Supabase e propagado em tempo real.',
      version: getThemeCurrentVersion(),
      data: updatedThemes,
    });
  } catch (err) {
    next(err);
  }
});

// Aplicar tema específico ou reverter para padrão
apiRouter.post('/v1/themes/apply', optionalAuth, async (req, res, next) => {
  try {
    const { themeId, theme } = req.body || {};
    const updatedThemes = await applyThemeFull(themeId ? String(themeId) : null, theme);
    res.json({
      success: true,
      message: themeId ? 'Tema aplicado como padrão em tempo real em todos os perfis.' : 'Sistema revertido para o Modelo Padrão.',
      version: getThemeCurrentVersion(),
      data: updatedThemes,
    });
  } catch (err) {
    next(err);
  }
});

// Resetar todos os temas customizados para o Padrão Corporativo
apiRouter.post('/v1/themes/reset-default', optionalAuth, async (_req, res, next) => {
  try {
    const updatedThemes = await applyThemeFull(null);
    res.json({
      success: true,
      message: 'Sistema revertido para o Modelo Padrão com sucesso.',
      version: getThemeCurrentVersion(),
      data: updatedThemes,
    });
  } catch (err) {
    next(err);
  }
});

// Excluir tema customizado
apiRouter.delete('/v1/themes/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID do tema ausente.' });
    }

    const updatedThemes = await deleteThemeFull(String(id));
    res.json({
      success: true,
      message: 'Tema excluído com sucesso do Supabase e sincronizado em tempo real.',
      version: getThemeCurrentVersion(),
      data: updatedThemes,
    });
  } catch (err) {
    next(err);
  }
});

