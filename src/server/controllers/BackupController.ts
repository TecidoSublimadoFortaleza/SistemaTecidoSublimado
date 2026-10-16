import { Request, Response, NextFunction } from 'express';
import { Database } from '../db/database';
import { ChatRepository } from '../repositories/ChatRepository';
import { ClientRepository } from '../repositories/ClientRepository';
import { isUserMasterOrDeveloper } from '../middlewares/authMiddleware';
import { pgPool, ensureSystemStore } from '../db/postgres';

interface DateFilterParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Normaliza e analisa qualquer formato de data para timestamp numérico
 */
function parseDateToTimestamp(rawDate: any): number | null {
  if (!rawDate) return null;
  if (typeof rawDate === 'number') return rawDate;

  const str = String(rawDate).trim();
  if (!str) return null;

  // Formato DD/MM/YYYY ou DD/MM/YYYY HH:mm:ss
  if (str.includes('/')) {
    const parts = str.split(' ')[0].split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }

  // Formato ISO ou YYYY-MM-DD
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return parsed;

  return null;
}

/**
 * Checa se um registro está dentro do intervalo de datas especificado
 */
function isWithinDateRange(
  recordDate: any,
  startTimestamp: number | null,
  endTimestamp: number | null
): boolean {
  if (!startTimestamp && !endTimestamp) return true;

  const ts = parseDateToTimestamp(recordDate);
  if (ts === null) {
    // Se o registro não possui data rastreável, inclui por padrão para não perder integridade
    return true;
  }

  if (startTimestamp && ts < startTimestamp) return false;
  if (endTimestamp && ts > endTimestamp) return false;

  return true;
}

export class BackupController {
  /**
   * Helper para verificar se usuário logado é Developer ou Administrador Master
   */
  private static checkAccess(req: Request, res: Response): boolean {
    const user = req.user;
    if (!user || !isUserMasterOrDeveloper(user)) {
      res.status(403).json({
        success: false,
        error: 'Acesso negado. O módulo de Backup é restrito exclusivamente ao Developer e Administrador Master.',
        code: 'FORBIDDEN_BACKUP',
      });
      return false;
    }
    return true;
  }

  /**
   * GET /api/v1/backup/stats
   * Retorna contagens em tempo real dos 6 módulos com base no filtro de datas
   */
  public static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!BackupController.checkAccess(req, res)) return;

      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const startTs = startDate ? new Date(`${startDate}T00:00:00.000Z`).getTime() : null;
      const endTs = endDate ? new Date(`${endDate}T23:59:59.999Z`).getTime() : null;

      const db = Database.getInstance();

      // 1. ESTOQUE
      let estoqueCount = 0;
      for (const p of db.products.values()) {
        const pDate = (p as any).created_at || (p as any).createdAt || (p as any).updated_at;
        if (isWithinDateRange(pDate, startTs, endTs)) {
          estoqueCount++;
        }
      }

      // 2. FUNCIONÁRIOS
      let funcionariosCount = 0;
      for (const e of db.employees.values()) {
        const eDate = (e as any).dataAdmissao || (e as any).createdAt || (e as any).created_at;
        if (isWithinDateRange(eDate, startTs, endTs)) {
          funcionariosCount++;
        }
      }

      // 3. CLIENTES
      let clientesCount = 0;
      for (const c of db.clients.values()) {
        const cDate = (c as any).createdAt || (c as any).created_at || (c as any).data_cadastro || (c as any).updatedAt;
        if (isWithinDateRange(cDate, startTs, endTs)) {
          clientesCount++;
        }
      }

      // 4. OS
      let osCount = 0;
      for (const o of db.ordensServico.values()) {
        const oDate = (o as any).data_abertura || (o as any).dataEntrada || (o as any).data || (o as any).createdAt || (o as any).created_at;
        if (isWithinDateRange(oDate, startTs, endTs)) {
          osCount++;
        }
      }

      // 5. VND
      let vndCount = 0;
      for (const v of db.pdvTransactions.values()) {
        const vDate = (v as any).data || (v as any).createdAt || (v as any).timestamp;
        if (isWithinDateRange(vDate, startTs, endTs)) {
          vndCount++;
        }
      }

      // 6. MENSAGENS INTERNAS
      let mensagensCount = 0;
      for (const m of ChatRepository.messagesMap.values()) {
        const mDate = (m as any).createdAt || (m as any).created_at || (m as any).timestamp;
        if (isWithinDateRange(mDate, startTs, endTs)) {
          mensagensCount++;
        }
      }

      // 7. HISTÓRICO DE CONTROLE DE PERMISSÕES
      let historicoPermissoesCount = 0;
      for (const h of db.permissionHistory) {
        const hDate = (h as any).timestamp || (h as any).date || (h as any).createdAt;
        if (isWithinDateRange(hDate, startTs, endTs)) {
          historicoPermissoesCount++;
        }
      }
      if (historicoPermissoesCount === 0 && db.permissions.size > 0 && !startDate && !endDate) {
        historicoPermissoesCount = db.permissions.size;
      }

      // 8. FILIAIS
      let filiaisCount = 0;
      for (const b of db.branches.values()) {
        if ((b as any).deletedAt != null) continue;
        const bDate = (b as any).createdAt || (b as any).created_at || (b as any).updatedAt || (b as any).updated_at;
        if (isWithinDateRange(bDate, startTs, endTs)) {
          filiaisCount++;
        }
      }

      // 9. HISTÓRICO DE NOTAS FISCAIS
      let historicoNotasFiscaisCount = 0;
      for (const n of db.notasFiscais.values()) {
        const nDate = (n as any).dataEmissao || (n as any).data_emissao || (n as any).createdAt || (n as any).dataAutorizacao || (n as any).updatedAt;
        if (isWithinDateRange(nDate, startTs, endTs)) {
          historicoNotasFiscaisCount++;
        }
      }

      // 10. CÁLCULOS DE PRODUTO ("Cadastrar este produto como Com Medidas")
      let calculosProdutoCount = 0;
      for (const f of db.measurementFormulas.values()) {
        const fDate = (f as any).createdAt || (f as any).created_at || (f as any).updatedAt;
        if (isWithinDateRange(fDate, startTs, endTs)) {
          calculosProdutoCount++;
        }
      }
      if (calculosProdutoCount === 0 && db.measurementFormulas.size > 0 && !startDate && !endDate) {
        calculosProdutoCount = db.measurementFormulas.size;
      }

      // 11. HISTÓRICOS DE MUDANÇAS DO SISTEMA (metas, configurações globais, etc)
      let historicoMudancasCount = 0;
      for (const chg of db.systemChanges) {
        const cDate = (chg as any).timestamp || (chg as any).createdAt || (chg as any).date;
        if (isWithinDateRange(cDate, startTs, endTs)) {
          historicoMudancasCount++;
        }
      }
      // Se não houver registros explícitos de systemChanges mas existirem metas cadastradas, espelha para precisão
      if (historicoMudancasCount === 0 && db.metas.size > 0 && !startDate && !endDate) {
        historicoMudancasCount = db.metas.size;
      }

      const totalCalculated =
        estoqueCount +
        funcionariosCount +
        clientesCount +
        osCount +
        vndCount +
        mensagensCount +
        historicoPermissoesCount +
        filiaisCount +
        historicoNotasFiscaisCount +
        calculosProdutoCount +
        historicoMudancasCount;

      res.json({
        success: true,
        stats: {
          estoque: estoqueCount,
          funcionarios: funcionariosCount,
          clientes: clientesCount,
          os: osCount,
          vnd: vndCount,
          mensagens: mensagensCount,
          historicoPermissoes: historicoPermissoesCount,
          filiais: filiaisCount,
          historicoNotasFiscais: historicoNotasFiscaisCount,
          calculosProduto: calculosProdutoCount,
          historicoMudancas: historicoMudancasCount,
          total: totalCalculated,
        },
        dateFilter: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/backup/export
   * Gera o arquivo de backup compactado/estruturado com os dados selecionados
   */
  public static async exportBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!BackupController.checkAccess(req, res)) return;

      const {
        startDate,
        endDate,
        modules = [
          'estoque',
          'funcionarios',
          'clientes',
          'os',
          'vnd',
          'mensagens',
          'historicoPermissoes',
          'filiais',
          'historicoNotasFiscais',
          'calculosProduto',
          'historicoMudancas',
        ],
        includeImages = true,
      } = req.body;

      const startTs = startDate ? new Date(`${startDate}T00:00:00.000Z`).getTime() : null;
      const endTs = endDate ? new Date(`${endDate}T23:59:59.999Z`).getTime() : null;

      const db = Database.getInstance();
      const backupData: Record<string, any> = {};
      const summary: Record<string, number> = {};

      // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: Preservar compatibilidade com identificadores legados
      const shouldExport = (modName: string) =>
        modules.includes(modName) ||
        (modName === 'filiais' && modules.includes('branches')) ||
        (modName === 'historicoNotasFiscais' && modules.includes('notasFiscais')) ||
        (modName === 'historicoPermissoes' && (modules.includes('permissoes') || modules.includes('permissionHistory'))) ||
        (modName === 'calculosProduto' && (modules.includes('measurementFormulas') || modules.includes('calculosMedidas'))) ||
        (modName === 'historicoMudancas' && (modules.includes('systemChanges') || modules.includes('metas')));

      // 1. ESTOQUE
      if (shouldExport('estoque')) {
        const productsList: any[] = [];
        for (const p of db.products.values()) {
          const pDate = (p as any).created_at || (p as any).createdAt || (p as any).updated_at;
          if (isWithinDateRange(pDate, startTs, endTs)) {
            let item: any = { ...p };
            if (!includeImages && item.image_url && item.image_url.startsWith('data:image/')) {
              item.image_url = ''; // Remove Base64 pesada se desmarcado para economizar espaço
            }
            if (!includeImages && item.fotoUrl && item.fotoUrl.startsWith('data:image/')) {
              item.fotoUrl = '';
            }
            productsList.push(item);
          }
        }

        const categoriesList = Array.from(db.categories.values());
        const formulasList = Array.from(db.measurementFormulas.values());
        backupData.estoque = {
          products: productsList,
          categories: categoriesList,
          measurementFormulas: formulasList,
          calculosMedidas: formulasList,
        };
        // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: Preservar espelho em 'measurementFormulas'
        backupData.measurementFormulas = formulasList;
        summary.estoqueCount = productsList.length;
        summary.measurementFormulasCount = formulasList.length;
      }

      // 2. FUNCIONÁRIOS
      if (shouldExport('funcionarios')) {
        const employeesList: any[] = [];
        for (const e of db.employees.values()) {
          const eDate = (e as any).dataAdmissao || (e as any).createdAt || (e as any).created_at;
          if (isWithinDateRange(eDate, startTs, endTs)) {
            let item: any = { ...e };
            if (!includeImages && item.foto && typeof item.foto === 'string' && item.foto.startsWith('data:image/')) {
              item.foto = '';
            }
            if (!includeImages && item.fotoUrl && typeof item.fotoUrl === 'string' && item.fotoUrl.startsWith('data:image/')) {
              item.fotoUrl = '';
            }
            employeesList.push(item);
          }
        }

        const usersList: any[] = [];
        for (const u of db.users.values()) {
          // Não expor hashes inseguros desnecessariamente se desejar
          const uCopy: any = { ...u };
          if (!includeImages && uCopy.avatarUrl && uCopy.avatarUrl.startsWith('data:image/')) {
            uCopy.avatarUrl = '';
          }
          usersList.push(uCopy);
        }

        backupData.funcionarios = {
          employees: employeesList,
          users: usersList,
        };
        summary.funcionariosCount = employeesList.length;
      }

      // 3. CLIENTES
      if (shouldExport('clientes')) {
        const clientsList: any[] = [];
        for (const c of db.clients.values()) {
          const cDate = (c as any).createdAt || (c as any).created_at || (c as any).data_cadastro || (c as any).updatedAt;
          if (isWithinDateRange(cDate, startTs, endTs)) {
            clientsList.push(c);
          }
        }
        backupData.clientes = clientsList;
        summary.clientesCount = clientsList.length;
      }

      // 4. OS (Ordens de Serviço e Orçamentos)
      if (shouldExport('os')) {
        const osList: any[] = [];
        for (const o of db.ordensServico.values()) {
          const oDate = (o as any).data_abertura || (o as any).dataEntrada || (o as any).data || (o as any).createdAt || (o as any).created_at;
          if (isWithinDateRange(oDate, startTs, endTs)) {
            let item = { ...o };
            // Limpa anexos Base64 gigantes se a opção de otimização de imagens for selecionada
            if (!includeImages && Array.isArray(item.itens)) {
              item.itens = item.itens.map((it: any) => {
                if (it.fotoUrl && it.fotoUrl.startsWith('data:image/')) {
                  return { ...it, fotoUrl: '' };
                }
                return it;
              });
            }
            osList.push(item);
          }
        }
        backupData.os = osList;
        summary.osCount = osList.length;
      }

      // 5. VND (Transações de Venda Direta / PDV)
      if (shouldExport('vnd')) {
        const vndList: any[] = [];
        for (const v of db.pdvTransactions.values()) {
          const vDate = (v as any).data || (v as any).createdAt || (v as any).timestamp;
          if (isWithinDateRange(vDate, startTs, endTs)) {
            vndList.push(v);
          }
        }
        backupData.vnd = vndList;
        summary.vndCount = vndList.length;
      }

      // 6. MENSAGENS INTERNAS
      if (shouldExport('mensagens')) {
        const messagesList: any[] = [];
        for (const m of ChatRepository.messagesMap.values()) {
          const mDate = (m as any).createdAt || (m as any).created_at || (m as any).timestamp;
          if (isWithinDateRange(mDate, startTs, endTs)) {
            messagesList.push(m);
          }
        }
        const groupsList = Array.from(ChatRepository.groupsMap.values());
        const ticketsList = Array.from(ChatRepository.supportTicketsMap.entries()).map(([k, v]) => ({ id: k, ...v }));

        backupData.mensagens = {
          messages: messagesList,
          groups: groupsList,
          tickets: ticketsList,
        };
        summary.mensagensCount = messagesList.length;
      }

      // 7. HISTÓRICO DE CONTROLE DE PERMISSÕES
      if (shouldExport('historicoPermissoes')) {
        const historyList: any[] = [];
        for (const h of db.permissionHistory) {
          const hDate = (h as any).timestamp || (h as any).date || (h as any).createdAt;
          if (isWithinDateRange(hDate, startTs, endTs)) {
            historyList.push(h);
          }
        }

        const rolesList = Array.from(db.permissions.entries()).map(([roleId, rules]) => ({
          roleId,
          rules,
        }));

        backupData.historicoPermissoes = {
          roles: rolesList,
          history: historyList,
        };
        // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: Preservar espelho em 'permissoes'
        backupData.permissoes = Object.fromEntries(db.permissions.entries());
        summary.historicoPermissoesCount = historyList.length > 0 ? historyList.length : rolesList.length;
      }

      // 8. FILIAIS
      if (shouldExport('filiais')) {
        const branchesList: any[] = [];
        for (const b of db.branches.values()) {
          if ((b as any).deletedAt != null) continue;
          const bDate = (b as any).createdAt || (b as any).created_at || (b as any).updatedAt;
          if (isWithinDateRange(bDate, startTs, endTs)) {
            branchesList.push(b);
          }
        }
        backupData.filiais = branchesList;
        // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: Preservar espelho em 'branches'
        backupData.branches = branchesList;
        summary.filiaisCount = branchesList.length;
      }

      // 9. HISTÓRICO DE NOTAS FISCAIS
      if (shouldExport('historicoNotasFiscais')) {
        const notasList: any[] = [];
        for (const n of db.notasFiscais.values()) {
          const nDate = (n as any).dataEmissao || (n as any).data_emissao || (n as any).createdAt || (n as any).dataAutorizacao;
          if (isWithinDateRange(nDate, startTs, endTs)) {
            let item = { ...n };
            if (!includeImages && item.danfePdfBase64 && item.danfePdfBase64.length > 50000) {
              item.danfePdfBase64 = '';
            }
            notasList.push(item);
          }
        }
        backupData.historicoNotasFiscais = notasList;
        // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: Preservar espelho em 'notasFiscais'
        backupData.notasFiscais = notasList;
        summary.historicoNotasFiscaisCount = notasList.length;
      }

      // 10. CÁLCULOS DE PRODUTO ("Cadastrar este produto como Com Medidas")
      if (shouldExport('calculosProduto')) {
        const formulasList: any[] = [];
        for (const f of db.measurementFormulas.values()) {
          const fDate = (f as any).createdAt || (f as any).created_at || (f as any).updatedAt;
          if (isWithinDateRange(fDate, startTs, endTs)) {
            formulasList.push(f);
          }
        }
        backupData.calculosProduto = formulasList;
        // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: Preservar espelho com identificadores legados
        backupData.measurementFormulas = formulasList;
        backupData.calculosMedidas = formulasList;
        summary.calculosProdutoCount = formulasList.length;
      }

      // 11. HISTÓRICOS DE MUDANÇAS DO SISTEMA (metas, configurações, etc)
      if (shouldExport('historicoMudancas')) {
        const changesList: any[] = [];
        for (const chg of db.systemChanges) {
          const cDate = (chg as any).timestamp || (chg as any).createdAt || (chg as any).date;
          if (isWithinDateRange(cDate, startTs, endTs)) {
            changesList.push(chg);
          }
        }
        const metasSnapshot = Object.fromEntries(db.metas.entries());
        backupData.historicoMudancas = {
          changes: changesList,
          metas: metasSnapshot,
        };
        // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: Preservar espelho em 'metas' e 'systemChanges'
        backupData.metas = metasSnapshot;
        backupData.systemChanges = changesList;
        summary.historicoMudancasCount = changesList.length > 0 ? changesList.length : Object.keys(metasSnapshot).length;
      }

      const totalItems = Object.values(summary).reduce((acc, count) => acc + count, 0);

      const backupPackage = {
        app: 'SubliGestao-ERP',
        format: 'SUBLIGESTAO_BACKUP_V2',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        exportedBy: {
          userId: req.user?.sub,
          name: (req.user as any)?.name || req.user?.username || 'Administrador',
          role: req.user?.role || 'Developer',
        },
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          selectedModules: modules,
          includeImages,
        },
        summary: {
          ...summary,
          totalRecords: totalItems,
        },
        data: backupData,
      };

      res.json({
        success: true,
        message: 'Backup gerado com sucesso!',
        backupPackage,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/backup/import
   * Restaura ou mescla os dados de um arquivo de backup
   */
  public static async importBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!BackupController.checkAccess(req, res)) return;

      const {
        backupPackage,
        mode = 'merge', // 'merge' ou 'replace'
        selectedModules = [
          'estoque',
          'funcionarios',
          'clientes',
          'os',
          'vnd',
          'mensagens',
          'historicoPermissoes',
          'filiais',
          'historicoNotasFiscais',
          'calculosProduto',
          'historicoMudancas',
        ],
      } = req.body;

      if (!backupPackage || typeof backupPackage !== 'object' || !backupPackage.data) {
        res.status(400).json({
          success: false,
          error: 'Arquivo de backup inválido ou estrutura corrompida.',
          code: 'INVALID_BACKUP_PACKAGE',
        });
        return;
      }

      const db = Database.getInstance();
      try {
        await ensureSystemStore();
      } catch (_) {}

      const importStats: Record<string, { imported: number; updated: number; failed: number }> = {};

      // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: Preservar compatibilidade com identificadores legados
      const shouldImport = (modName: string) =>
        selectedModules.includes(modName) ||
        (modName === 'filiais' && selectedModules.includes('branches')) ||
        (modName === 'historicoNotasFiscais' && selectedModules.includes('notasFiscais')) ||
        (modName === 'historicoPermissoes' && (selectedModules.includes('permissoes') || selectedModules.includes('permissionHistory'))) ||
        (modName === 'calculosProduto' && (selectedModules.includes('measurementFormulas') || selectedModules.includes('calculosMedidas'))) ||
        (modName === 'historicoMudancas' && (selectedModules.includes('systemChanges') || selectedModules.includes('metas')));
      const isReplace = mode === 'replace';

      // 1. ESTOQUE
      if (shouldImport('estoque') && backupPackage.data.estoque) {
        let count = 0;
        let upd = 0;
        const products = backupPackage.data.estoque.products || [];
        const categories = backupPackage.data.estoque.categories || [];

        if (isReplace) {
          await db.products.clearDb();
          await db.categories.clearDb();
          await pgPool.query(`DELETE FROM categories`).catch(() => {});
        }

        const prodEntries: Array<{ key: string; value: any }> = [];
        for (const p of products) {
          if (!p) continue;
          const pid = String(p.id || p.codigo || ('PRD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)));
          const pObj = { ...p, id: pid };
          const existed = db.products.has(pid);
          Map.prototype.set.call(db.products, pid, pObj);
          prodEntries.push({ key: pid, value: pObj });
          if (existed) upd++;
          else count++;
        }

        await db.products.persistMany(prodEntries);

        for (const cat of categories) {
          const catId = cat.id || cat.nome || cat.name;
          if (catId) {
            db.categories.set(catId, cat);
            try {
              await pgPool.query(`
                INSERT INTO categories (id, name, descricao, data, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (id) DO UPDATE SET name = $2, descricao = $3, data = $4, updated_at = NOW()
              `, [String(catId), cat.nome || cat.name || catId, cat.descricao || '', JSON.stringify(cat)]);
            } catch (_) {}
            try {
              await pgPool.query(`
                INSERT INTO _system_store (collection, id, data)
                VALUES ('categories', $1, $2)
                ON CONFLICT (collection, id) DO UPDATE SET data = $2
              `, [String(catId), JSON.stringify(cat)]);
            } catch (_) {}
          }
        }

        // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: Restauração de Fórmulas e Cálculos de Medidas
        const formulas = backupPackage.data.estoque.measurementFormulas ||
          backupPackage.data.estoque.calculosMedidas ||
          backupPackage.data.measurementFormulas || [];

        for (const formula of formulas) {
          if (formula && formula.id) {
            db.measurementFormulas.set(String(formula.id), formula);
            try {
              await pgPool.query(`
                INSERT INTO _system_store (collection, id, data)
                VALUES ('measurement_formulas', $1, $2)
                ON CONFLICT (collection, id) DO UPDATE SET data = $2
              `, [String(formula.id), JSON.stringify(formula)]);
            } catch (_) {}
          }
        }

        importStats.estoque = { imported: count, updated: upd, failed: 0 };
      }

      // 2. FUNCIONÁRIOS
      if (shouldImport('funcionarios') && backupPackage.data.funcionarios) {
        let count = 0;
        let upd = 0;
        const emps = backupPackage.data.funcionarios.employees || [];
        const users = backupPackage.data.funcionarios.users || [];

        if (isReplace) {
          await db.employees.clearDb();
          await db.users.clearDb();
        }

        const empEntries: Array<{ key: string; value: any }> = [];
        for (const e of emps) {
          if (!e) continue;
          const eid = String(e.id || e.codigo || ('EMP-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)));
          const eObj = { ...e, id: eid };
          const existed = db.employees.has(eid);
          Map.prototype.set.call(db.employees, eid, eObj);
          empEntries.push({ key: eid, value: eObj });
          if (existed) upd++;
          else count++;
        }
        await db.employees.persistMany(empEntries);

        const userEntries: Array<{ key: string; value: any }> = [];
        for (const u of users) {
          if (!u || !u.id) continue;
          Map.prototype.set.call(db.users, u.id, u);
          userEntries.push({ key: u.id, value: u });
        }
        await db.users.persistMany(userEntries);

        importStats.funcionarios = { imported: count, updated: upd, failed: 0 };
      }

      // 3. CLIENTES - Persistência Segura e Rápida em Lote no Supabase
      if (shouldImport('clientes') && backupPackage.data.clientes) {
        let count = 0;
        let upd = 0;
        const clients = Array.isArray(backupPackage.data.clientes) ? backupPackage.data.clientes : [];

        if (isReplace) {
          await db.clients.clearDb();
        }

        const entriesToPersist: Array<{ key: string; value: any }> = [];
        for (const c of clients) {
          if (!c) continue;
          const cid = String(c.id || c.codigo || ('CLI-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)));
          const clientObj = { ...c, id: cid };
          const existed = db.clients.has(cid);

          // Coloca diretamente na memória para sincronismo imediato
          Map.prototype.set.call(db.clients, cid, clientObj);
          entriesToPersist.push({ key: cid, value: clientObj });

          if (existed) upd++;
          else count++;
        }

        // Persiste todos os clientes com multi-row bulk upsert direto no Supabase (PostgreSQL)
        await db.clients.persistMany(entriesToPersist);
        ClientRepository.invalidateCache();

        importStats.clientes = { imported: count, updated: upd, failed: 0 };
      }

      // 4. OS
      if (shouldImport('os') && backupPackage.data.os) {
        let count = 0;
        let upd = 0;
        const osList = Array.isArray(backupPackage.data.os) ? backupPackage.data.os : [];

        if (isReplace) {
          await db.ordensServico.clearDb();
        }

        const osEntries: Array<{ key: string; value: any }> = [];
        for (const o of osList) {
          if (!o) continue;
          const oid = String(o.id || o.codigo || ('OS-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)));
          const oObj = { ...o, id: oid };
          const existed = db.ordensServico.has(oid);
          Map.prototype.set.call(db.ordensServico, oid, oObj);
          osEntries.push({ key: oid, value: oObj });
          if (existed) upd++;
          else count++;
        }
        await db.ordensServico.persistMany(osEntries);

        importStats.os = { imported: count, updated: upd, failed: 0 };
      }

      // 5. VND
      if (shouldImport('vnd') && backupPackage.data.vnd) {
        let count = 0;
        let upd = 0;
        const vndList = Array.isArray(backupPackage.data.vnd) ? backupPackage.data.vnd : [];

        if (isReplace) {
          await db.pdvTransactions.clearDb();
          await pgPool.query(`DELETE FROM pdv_transactions`).catch(() => {});
        }

        const vndEntries: Array<{ key: string; value: any }> = [];
        for (const v of vndList) {
          if (!v) continue;
          const vid = String(v.id || ('VND-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)));
          const vObj = { ...v, id: vid };
          const existed = db.pdvTransactions.has(vid);
          Map.prototype.set.call(db.pdvTransactions, vid, vObj);
          vndEntries.push({ key: vid, value: vObj });
          if (existed) upd++;
          else count++;

          try {
            await pgPool.query(`
              INSERT INTO pdv_transactions (
                id, codigo, data, cliente_id, cliente_nome, vendedor_id, vendedor_nome,
                filial_id, filial_nome, valor_total, desconto, valor_pago, troco,
                forma_pagamento, status, itens, pagamentos, data_json, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
              ON CONFLICT (id) DO UPDATE SET
                valor_total = $10, status = $15, data_json = $18, updated_at = NOW()
            `, [
              vid,
              v.codigo || vid,
              v.data || '',
              v.clienteId || v.cliente_id || '',
              v.clienteNome || v.cliente_nome || '',
              v.vendedorId || v.vendedor_id || '',
              v.vendedorNome || v.vendedor_nome || '',
              v.filialId || v.filial_id || '',
              v.filialNome || v.filial_nome || '',
              Number(v.valorTotal || v.total || v.valor_total || 0),
              Number(v.desconto || 0),
              Number(v.valorPago || v.valor_pago || 0),
              Number(v.troco || 0),
              v.formaPagamento || v.forma_pagamento || '',
              v.status || 'CONCLUIDA',
              JSON.stringify(v.itens || []),
              JSON.stringify(v.pagamentos || []),
              JSON.stringify(v),
            ]);
          } catch (_) {}
        }
        await db.pdvTransactions.persistMany(vndEntries);

        importStats.vnd = { imported: count, updated: upd, failed: 0 };
      }

      // 6. MENSAGENS INTERNAS
      if (shouldImport('mensagens') && backupPackage.data.mensagens) {
        let count = 0;
        let upd = 0;
        const msgs = backupPackage.data.mensagens.messages || [];
        const groups = backupPackage.data.mensagens.groups || [];

        for (const m of msgs) {
          if (m.id) {
            const existed = ChatRepository.messagesMap.has(m.id);
            ChatRepository.messagesMap.set(m.id, m);
            if (existed) upd++;
            else count++;

            try {
              await pgPool.query(`
                INSERT INTO chat_messages (id, sender_id, receiver_id, content, read, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (id) DO UPDATE SET content = $4, read = $5
              `, [
                m.id,
                m.senderId || m.sender_id || 'system',
                m.receiverId || m.receiver_id || 'all',
                m.content || '',
                Boolean(m.read),
              ]);
            } catch (_) {}
          }
        }

        for (const g of groups) {
          if (g.id) {
            ChatRepository.groupsMap.set(g.id, g);
            try {
              await pgPool.query(`
                INSERT INTO _system_store (collection, id, data)
                VALUES ('chat_groups', $1, $2)
                ON CONFLICT (collection, id) DO UPDATE SET data = $2
              `, [g.id, JSON.stringify(g)]);
            } catch (_) {}
          }
        }

        importStats.mensagens = { imported: count, updated: upd, failed: 0 };
      }

      // 7. HISTÓRICO DE CONTROLE DE PERMISSÕES
      if (
        shouldImport('historicoPermissoes') &&
        (backupPackage.data.historicoPermissoes || backupPackage.data.permissoes)
      ) {
        let count = 0;
        let upd = 0;
        const permsData = backupPackage.data.historicoPermissoes || backupPackage.data.permissoes;

        if (isReplace) {
          db.permissions.clear();
          db.permissionHistory.length = 0;
          await pgPool.query(`DELETE FROM _system_store WHERE collection IN ('permissions', 'permissionHistory')`).catch(() => {});
          await pgPool.query(`DELETE FROM permissions`).catch(() => {});
        }

        // Restaura matriz de regras por perfil
        const rolesToImport: Array<{ roleId: string; rules: any }> = [];
        if (permsData && permsData.roles && Array.isArray(permsData.roles)) {
          for (const r of permsData.roles) {
            if (r && r.roleId && r.rules) {
              rolesToImport.push({ roleId: String(r.roleId), rules: r.rules });
            }
          }
        } else if (permsData && typeof permsData === 'object' && !Array.isArray(permsData)) {
          for (const [rId, rules] of Object.entries(permsData)) {
            if (rId !== 'roles' && rId !== 'history' && rules && typeof rules === 'object') {
              rolesToImport.push({ roleId: rId, rules });
            }
          }
        }

        for (const item of rolesToImport) {
          const existed = db.permissions.has(item.roleId);
          db.permissions.set(item.roleId, item.rules);
          if (existed) upd++;
          else count++;

          try {
            await pgPool.query(`
              INSERT INTO permissions (role_id, rules, updated_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (role_id) DO UPDATE SET rules = $2, updated_at = NOW()
            `, [String(item.roleId), JSON.stringify(item.rules)]);
          } catch (_) {}
        }

        // Restaura logs de auditoria e histórico de permissões
        const historyToImport: any[] = [];
        if (permsData && Array.isArray(permsData.history)) {
          historyToImport.push(...permsData.history);
        } else if (Array.isArray(permsData)) {
          historyToImport.push(...permsData);
        }

        for (const h of historyToImport) {
          if (!h) continue;
          db.permissionHistory.push(h);
          count++;

          try {
            const hId = h.id || `PERMHIST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            await pgPool.query(`
              INSERT INTO permission_history (
                id, role_id, action, details, roles_count, roles_updated, previous_rules, new_rules, performed_by, created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
              ON CONFLICT (id) DO NOTHING
            `, [
              hId,
              h.roleId || h.role_id || 'ALL_ROLES',
              h.action || 'IMPORTACAO_BACKUP',
              h.details || 'Histórico importado via backup',
              Number(h.rolesCount || h.roles_count || 1),
              JSON.stringify(h.rolesUpdated || h.roles_updated || []),
              JSON.stringify(h.previousRules || h.previous_rules || {}),
              JSON.stringify(h.newRules || h.new_rules || {}),
              h.performedBy || h.performed_by || 'Administrador',
            ]);
          } catch (_) {}
        }

        importStats.historicoPermissoes = { imported: count, updated: upd, failed: 0 };
      }

      // 8. FILIAIS
      if (
        shouldImport('filiais') &&
        (backupPackage.data.filiais || backupPackage.data.branches)
      ) {
        let count = 0;
        let upd = 0;
        const filiaisList = Array.isArray(backupPackage.data.filiais)
          ? backupPackage.data.filiais
          : Array.isArray(backupPackage.data.branches)
          ? backupPackage.data.branches
          : [];

        if (isReplace) {
          db.branches.clear();
          await pgPool.query(`DELETE FROM _system_store WHERE collection = 'branches'`).catch(() => {});
          await pgPool.query(`DELETE FROM branches`).catch(() => {});
        }

        for (const f of filiaisList) {
          if (!f) continue;
          const fid = String(f.id || f.codigo || `filial-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
          const existed = db.branches.has(fid);
          db.branches.set(fid, f);
          if (existed) upd++;
          else count++;

          try {
            await pgPool.query(`
              INSERT INTO branches (
                id, codigo, nome, cnpj, telefone, email, endereco, is_matriz, status, data, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
              ON CONFLICT (id) DO UPDATE SET
                nome = $3, cnpj = $4, data = $10, updated_at = NOW()
            `, [
              fid,
              f.codigo || fid,
              f.nome || f.name || fid,
              f.cnpj || '',
              f.telefone || '',
              f.email || '',
              JSON.stringify(f.endereco || {}),
              Boolean(f.isMatriz || f.is_matriz),
              f.status || 'ACTIVE',
              JSON.stringify(f),
            ]);
          } catch (_) {}

          try {
            await pgPool.query(`
              INSERT INTO _system_store (collection, id, data)
              VALUES ('branches', $1, $2)
              ON CONFLICT (collection, id) DO UPDATE SET data = $2
            `, [fid, JSON.stringify(f)]);
          } catch (_) {}
        }

        importStats.filiais = { imported: count, updated: upd, failed: 0 };
      }

      // 9. HISTÓRICO DE NOTAS FISCAIS
      if (
        shouldImport('historicoNotasFiscais') &&
        (backupPackage.data.historicoNotasFiscais || backupPackage.data.notasFiscais)
      ) {
        let count = 0;
        let upd = 0;
        const notasList = Array.isArray(backupPackage.data.historicoNotasFiscais)
          ? backupPackage.data.historicoNotasFiscais
          : Array.isArray(backupPackage.data.notasFiscais)
          ? backupPackage.data.notasFiscais
          : [];

        if (isReplace) {
          db.notasFiscais.clear();
          await pgPool.query(`DELETE FROM _system_store WHERE collection = 'notasFiscais'`).catch(() => {});
          await pgPool.query(`DELETE FROM notas_fiscais`).catch(() => {});
        }

        for (const n of notasList) {
          if (!n) continue;
          const nid = String(n.id || n.numero || `NF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
          const existed = db.notasFiscais.has(nid);
          db.notasFiscais.set(nid, n);
          if (existed) upd++;
          else count++;

          try {
            await pgPool.query(`
              INSERT INTO notas_fiscais (
                id, numero, serie, chave_acesso, tipo, status, cliente_id, cliente_nome,
                cliente_documento, valor_total, data_emissao, xml, danfe_pdf, itens, data_json, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
              ON CONFLICT (id) DO UPDATE SET
                status = $6, valor_total = $10, data_json = $15, updated_at = NOW()
            `, [
              nid,
              n.numero || '',
              n.serie || '',
              n.chaveAcesso || n.chave_acesso || '',
              n.tipo || 'NFe',
              n.status || 'AUTORIZADA',
              n.clienteId || n.cliente_id || '',
              n.clienteNome || n.cliente_nome || '',
              n.clienteDocumento || n.cliente_documento || '',
              Number(n.valorTotal || n.valor_total || 0),
              n.dataEmissao || n.data_emissao || '',
              n.xml || '',
              n.danfePdfBase64 || n.danfe_pdf || '',
              JSON.stringify(n.itens || []),
              JSON.stringify(n),
            ]);
          } catch (_) {}

          try {
            await pgPool.query(`
              INSERT INTO _system_store (collection, id, data)
              VALUES ('notasFiscais', $1, $2)
              ON CONFLICT (collection, id) DO UPDATE SET data = $2
            `, [nid, JSON.stringify(n)]);
          } catch (_) {}
        }

        importStats.historicoNotasFiscais = { imported: count, updated: upd, failed: 0 };
      }

      // 10. CÁLCULOS DE PRODUTO ("Cadastrar este produto como Com Medidas")
      if (
        shouldImport('calculosProduto') &&
        (backupPackage.data.calculosProduto ||
          backupPackage.data.measurementFormulas ||
          backupPackage.data.calculosMedidas ||
          backupPackage.data.estoque?.measurementFormulas ||
          backupPackage.data.estoque?.calculosMedidas)
      ) {
        let count = 0;
        let upd = 0;
        const formulasList = Array.isArray(backupPackage.data.calculosProduto)
          ? backupPackage.data.calculosProduto
          : Array.isArray(backupPackage.data.measurementFormulas)
          ? backupPackage.data.measurementFormulas
          : Array.isArray(backupPackage.data.calculosMedidas)
          ? backupPackage.data.calculosMedidas
          : Array.isArray(backupPackage.data.estoque?.measurementFormulas)
          ? backupPackage.data.estoque.measurementFormulas
          : Array.isArray(backupPackage.data.estoque?.calculosMedidas)
          ? backupPackage.data.estoque.calculosMedidas
          : [];

        if (isReplace) {
          db.measurementFormulas.clear();
          await pgPool.query(`DELETE FROM _system_store WHERE collection = 'measurement_formulas'`).catch(() => {});
        }

        for (const formula of formulasList) {
          if (!formula || !formula.id) continue;
          const fid = String(formula.id);
          const existed = db.measurementFormulas.has(fid);
          db.measurementFormulas.set(fid, formula);
          if (existed) upd++;
          else count++;

          try {
            await pgPool.query(`
              INSERT INTO _system_store (collection, id, data)
              VALUES ('measurement_formulas', $1, $2)
              ON CONFLICT (collection, id) DO UPDATE SET data = $2
            `, [fid, JSON.stringify(formula)]);
            // Remove do registro de excluídos caso estivesse deletado
            await pgPool.query(
              `DELETE FROM _system_store WHERE collection = 'measurement_formulas_deleted' AND id = $1`,
              [fid]
            ).catch(() => {});
          } catch (_) {}
        }

        importStats.calculosProduto = { imported: count, updated: upd, failed: 0 };
      }

      // 11. HISTÓRICOS DE MUDANÇAS DO SISTEMA (metas, configurações, etc)
      if (
        shouldImport('historicoMudancas') &&
        (backupPackage.data.historicoMudancas ||
          backupPackage.data.systemChanges ||
          backupPackage.data.metas)
      ) {
        let count = 0;
        let upd = 0;
        const rawMudancas = backupPackage.data.historicoMudancas;
        const changesList = Array.isArray(rawMudancas)
          ? rawMudancas
          : Array.isArray(rawMudancas?.changes)
          ? rawMudancas.changes
          : Array.isArray(backupPackage.data.systemChanges)
          ? backupPackage.data.systemChanges
          : [];

        const metasData = (rawMudancas && typeof rawMudancas === 'object' && rawMudancas.metas)
          ? rawMudancas.metas
          : backupPackage.data.metas;

        if (isReplace) {
          db.systemChanges.length = 0;
          await pgPool.query(`DELETE FROM system_changes`).catch(() => {});
          await pgPool.query(`DELETE FROM _system_store WHERE collection = 'systemChanges'`).catch(() => {});
          if (metasData && typeof metasData === 'object') {
            db.metas.clear();
            await pgPool.query(`DELETE FROM _system_store WHERE collection = 'metas'`).catch(() => {});
          }
        }

        // Restaura lista de systemChanges
        for (const chg of changesList) {
          if (!chg) continue;
          db.systemChanges.push(chg);
          count++;

          try {
            const chgId = String(chg.id || Database.generateId('SYSCHG'));
            await pgPool.query(`
              INSERT INTO system_changes (
                id, entity, action, details, entity_id, previous_state, new_state, performed_by, created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
              ON CONFLICT (id) DO NOTHING
            `, [
              chgId,
              chg.entity || 'SISTEMA',
              chg.action || 'IMPORTACAO_BACKUP',
              chg.details || 'Histórico de mudanças importado via backup',
              chg.entityId || chg.entity_id || '',
              JSON.stringify(chg.previousState || chg.previous_state || null),
              JSON.stringify(chg.newState || chg.new_state || null),
              chg.performedBy || chg.performed_by || 'Administrador',
            ]);
          } catch (_) {}
        }

        // Restaura snapshot de Metas caso fornecido
        if (metasData && typeof metasData === 'object') {
          for (const [mid, mval] of Object.entries(metasData)) {
            if (!mval) continue;
            const existed = db.metas.has(mid);
            db.metas.set(mid, mval);
            if (existed) upd++;
            else count++;

            try {
              await pgPool.query(`
                INSERT INTO _system_store (collection, id, data)
                VALUES ('metas', $1, $2)
                ON CONFLICT (collection, id) DO UPDATE SET data = $2
              `, [mid, JSON.stringify(mval)]);
            } catch (_) {}
          }
        }

        importStats.historicoMudancas = { imported: count, updated: upd, failed: 0 };
      }

      res.json({
        success: true,
        message: 'Importação do backup concluída com sucesso!',
        mode,
        importStats,
      });
    } catch (err) {
      next(err);
    }
  }
}
