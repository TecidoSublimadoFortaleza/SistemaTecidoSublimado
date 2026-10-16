import {
  Branch,
  Role,
  Sector,
  User,
  Permission,
  RefreshToken,
  AuthLog,
  AuditTrail,
} from '../types';
import { Client } from '../types/client';
import { Employee } from '../types/employee';
import { OrdemServico, ProductCatalog, PdvTransaction } from '../types/os';
import { PersistentMap } from './PersistentMap';
import { PersistentArray } from './PersistentArray';
import { pgPool, ensureSystemStore } from './postgres';
import { CryptoSecurity } from '../security/crypto';
import { initializeThemesEngine } from './themeStorage';

export class Database {
  private static instance: Database;

  public branches = new PersistentMap<string, Branch>('branches');
  public sectors = new PersistentMap<string, Sector>('sectors');
  public roles = new PersistentMap<string, Role>('roles');
  public permissions = new PersistentMap<string, any>('permissions', true);
  public users = new PersistentMap<string, User>('users', true);
  public clients = new PersistentMap<string, Client>('clients', true);
  public employees = new PersistentMap<string, Employee>('employees', true);
  public ordensServico = new PersistentMap<string, OrdemServico>('orders', true);
  public products = new PersistentMap<string, ProductCatalog>('products', true);
  public pdvTransactions = new PersistentMap<string, PdvTransaction>('pdvTransactions');
  public refreshTokens = new PersistentMap<string, RefreshToken>('refreshTokens');
  public categories = new PersistentMap<string, any>('categories');
  public notasFiscais = new PersistentMap<string, any>('notasFiscais');
  public configuracaoFiscal = new PersistentMap<string, any>('configuracaoFiscal');
  public metas = new PersistentMap<string, any>('metas');
  public measurementFormulas = new PersistentMap<string, any>('measurement_formulas');
  public customThemes = new PersistentMap<string, any>('custom_themes');

  public authLogs = new PersistentArray<AuthLog>('authLogs');
  public auditTrails = new PersistentArray<AuditTrail>('auditTrails');
  // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: histórico de auditoria e controle de permissões
  public permissionHistory = new PersistentArray<any>('permissionHistory');
  // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO: Históricos de mudanças do sistema (metas, configurações, etc)
  public systemChanges = new PersistentArray<any>('systemChanges');

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async initialize() {
    try {
      await ensureSystemStore();
    } catch (e) {
      console.error('PostgreSQL not available, running in memory-only mode.');
      await initializeThemesEngine().catch(() => {});
      return;
    }
    try {
      const res = await pgPool.query('SELECT collection, id, data FROM _system_store');
      for (const row of res.rows) {
        const { collection, id, data } = row;
        switch (collection) {
          case 'branches': superSet(this.branches, id, data); break;
          case 'sectors': superSet(this.sectors, id, data); break;
          case 'roles': superSet(this.roles, id, data); break;
          case 'permissions': superSet(this.permissions, id, data); break;
          case 'users': superSet(this.users, id, data); break;
          case 'clients': superSet(this.clients, id, data); break;
          case 'employees': superSet(this.employees, id, data); break;
          case 'orders': {
            let orderData = data;
            const isOss = Boolean(
              orderData.tipoDocumento === 'OSS' ||
              orderData.isShopee === true ||
              orderData.codigo?.toUpperCase().startsWith('OSS')
            );
            const isOrc = !isOss && Boolean(
              orderData.tipoDocumento === 'ORCAMENTO' ||
              (orderData.isOrcamento === true && orderData.tipoDocumento !== 'OS' && !orderData.codigo?.toUpperCase().startsWith('OS'))
            );
            if (isOss) {
              let cod = orderData.codigo;
              if (!cod || !cod.toUpperCase().startsWith('OSS')) {
                const match = cod ? cod.match(/\d+/) : null;
                const numStr = match ? match[0] : '1';
                cod = `OSS${numStr.padStart(8, '0')}`;
              }
              orderData = {
                ...orderData,
                codigo: cod,
                tipoDocumento: 'OSS',
                isShopee: true,
                isOrcamento: false,
              };
            } else if (isOrc) {
              let cod = orderData.codigo;
              if (!cod || !cod.toUpperCase().startsWith('ORC')) {
                const match = cod ? cod.match(/\d+/) : null;
                const numStr = match ? match[0] : '1';
                cod = `ORC${numStr.padStart(8, '0')}`;
              }
              orderData = {
                ...orderData,
                codigo: cod,
                tipoDocumento: 'ORCAMENTO',
                isOrcamento: true,
                status: orderData.status || 'Orçamento Criado',
                situacao: orderData.situacao || 'Orçamento Criado',
                estagioAtual: orderData.estagioAtual || 'Orçamento',
              };
            } else {
              let cod = orderData.codigo;
              if (!cod || !cod.toUpperCase().startsWith('OS')) {
                // Seguir rigorosamente a sequência de OS e nunca a numeração de ORC
                const count = this.ordensServico.size + 1;
                cod = `OS${String(count).padStart(8, '0')}`;
              }
              orderData = {
                ...orderData,
                codigo: cod,
                tipoDocumento: 'OS',
                isOrcamento: false,
              };
            }
            superSet(this.ordensServico, id, orderData);
            break;
          }
          case 'products': superSet(this.products, id, data); break;
          case 'pdvTransactions': superSet(this.pdvTransactions, id, data); break;
          case 'refreshTokens': superSet(this.refreshTokens, id, data); break;
          case 'notasFiscais': {
            let notaData = data;
            const isOs = notaData.origem === 'OS' || Boolean(notaData.origemCodigo && String(notaData.origemCodigo).toUpperCase().startsWith('OS'));
            const targetSerie = isOs ? '7' : '6';
            if (!notaData.serie || String(notaData.serie) === '1' || String(notaData.serie) === '3') {
              notaData = { ...notaData, serie: targetSerie };
              if (notaData.chaveAcesso && notaData.chaveAcesso.length === 44) {
                const cleanSerie = targetSerie.padStart(3, '0');
                const base43 = notaData.chaveAcesso.substring(0, 22) + cleanSerie + notaData.chaveAcesso.substring(25, 43);
                let soma = 0;
                let peso = 2;
                for (let i = base43.length - 1; i >= 0; i--) {
                  soma += parseInt(base43[i], 10) * peso;
                  peso = peso >= 9 ? 2 : peso + 1;
                }
                const resto = soma % 11;
                const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
                notaData.chaveAcesso = `${base43}${dv}`;
              }
              if (notaData.xmlConteudo) {
                notaData.xmlConteudo = notaData.xmlConteudo
                  .replace(/<serie>1<\/serie>/g, `<serie>${targetSerie}</serie>`)
                  .replace(/<serie>001<\/serie>/g, `<serie>${targetSerie.padStart(3, '0')}</serie>`);
              }
            }
            superSet(this.notasFiscais, id, notaData);
            break;
          }
          case 'categories': superSet(this.categories, id, data); break;
          case 'configuracaoFiscal': superSet(this.configuracaoFiscal, id, data); break;
          case 'metas': superSet(this.metas, id, data); break;
          case 'measurement_formulas': superSet(this.measurementFormulas, id, data); break;
          case 'custom_themes':
          case 'themes': superSet(this.customThemes, id, data); break;
          case 'authLogs': superPush(this.authLogs, data); break;
          case 'auditTrails': superPush(this.auditTrails, data); break;
          case 'permissionHistory': superPush(this.permissionHistory, data); break;
          case 'systemChanges': superPush(this.systemChanges, data); break;
        }
      }

      // Load relational users from Supabase/Postgres
      try {
        const userRows = await pgPool.query('SELECT * FROM users');
        for (const u of userRows.rows) {
          let existing = this.users.get(u.id);
          if (!existing && u.username) {
            const cleanU = u.username.toLowerCase();
            for (const usr of this.users.values()) {
              if (
                usr.username?.toLowerCase() === cleanU ||
                `@${usr.username?.replace(/^@/, '')}`.toLowerCase() === cleanU ||
                (Boolean(u.is_developer) && (usr.isDeveloperInvisible || usr.username?.toLowerCase().includes('marcelo') || usr.username?.toLowerCase().includes('dev')))
              ) {
                existing = usr;
                break;
              }
            }
          }

          if (!existing) {
            const mappedUser: any = {
              id: u.id,
              username: u.username,
              passwordHash: u.password,
              name: u.name || u.username,
              email: u.email || `${u.username}@subligestao.com`,
              phone: u.phone || '',
              avatarUrl: u.avatar_url || '',
              roleId: u.role || 'Gerente Geral',
              sectorId: u.sector || 'Diretoria',
              branchId: u.branch || 'Matriz',
              isDeveloperInvisible: Boolean(u.is_developer),
              status: 'ACTIVE',
              createdAt: u.created_at || new Date().toISOString(),
              updatedAt: u.updated_at || new Date().toISOString(),
              failedAttempts: 0,
              lockUntil: null,
              twoFactorEnabled: false
            };
            superSet(this.users, u.id, mappedUser);
            existing = mappedUser;
          } else {
            // Sincroniza foto e dados se atualizados diretamente no banco de dados (ex: Supabase)
            if (u.avatar_url) {
              existing.avatarUrl = u.avatar_url;
            }
            if (u.support_avatar_url) existing.supportAvatarUrl = u.support_avatar_url;
            if (u.name) existing.name = u.name;
            if (u.email) existing.email = u.email;
            if (u.phone) existing.phone = u.phone;
            if (u.password && existing.passwordHash !== u.password && !u.password.includes('xV.oP1mXh')) {
              existing.passwordHash = u.password;
              existing.failedAttempts = 0;
              existing.lockUntil = null;
            }
          }

          // Se houver colaborador correspondente em employees, sincroniza foto bidirecionalmente
          if (existing && existing.avatarUrl) {
            const empId = existing.id.startsWith('USR-EMP-') ? existing.id.replace('USR-EMP-', '') : null;
            const uClean = (existing.username || '').toLowerCase().replace(/^@/, '');
            for (const emp of this.employees.values()) {
              const empClean = (emp.loginUsuario || '').toLowerCase().replace(/^@/, '');
              if ((empId && emp.id === empId) || (empClean && empClean === uClean)) {
                if (!emp.fotoUrl || emp.fotoUrl !== existing.avatarUrl) {
                  emp.fotoUrl = existing.avatarUrl;
                }
              }
            }
          }
        }

        // Carrega developer_avatar salvo no _system_store se existir
        try {
          const devAvatarStore = await pgPool.query("SELECT data FROM _system_store WHERE collection = 'system_settings' AND id = 'developer_avatar'");
          if (devAvatarStore.rows.length > 0) {
            const rawD = devAvatarStore.rows[0].data;
            const parsed = typeof rawD === 'string' ? JSON.parse(rawD) : rawD;
            if (parsed?.avatarUrl) {
              for (const u of this.users.values()) {
                if (u.isDeveloperInvisible || u.id === 'USR-DEV-MARCELO-001' || u.username?.toLowerCase().includes('marcelo') || u.username?.toLowerCase().includes('dev')) {
                  if (!u.avatarUrl || u.avatarUrl.length < 50) {
                    u.avatarUrl = parsed.avatarUrl;
                  }
                }
              }
            }
          }
        } catch (_) {}

        // Carrega support_avatar salvo no _system_store se existir
        try {
          const suppStore = await pgPool.query("SELECT data FROM _system_store WHERE collection = 'system_settings' AND id = 'support_avatar'");
          if (suppStore.rows.length > 0) {
            const rawS = suppStore.rows[0].data;
            const parsed = typeof rawS === 'string' ? JSON.parse(rawS) : rawS;
            if (parsed?.url) {
              for (const u of this.users.values()) {
                if (u.isDeveloperInvisible || u.username?.toLowerCase().includes('marcelo') || u.username?.toLowerCase().includes('dev') || u.roleId === 'ROLE-ADM_MASTER') {
                  u.supportAvatarUrl = parsed.url;
                }
              }
            }
          }
        } catch (_) {}
      } catch (userRelErr) {
        // Table might not exist or empty
      }

      // Load relational orders from Supabase/Postgres if not in memory or update deletedAt
      try {
        const orderRows = await pgPool.query('SELECT * FROM orders');
        for (const o of orderRows.rows) {
          const isOrc = Boolean(
            o.tipo_documento === 'ORCAMENTO' ||
            (o.is_orcamento === true && o.tipo_documento !== 'OS' && !o.codigo?.toUpperCase().startsWith('OS'))
          );
          const mappedOs: any = {
            id: o.id,
            codigo: o.codigo,
            tipoDocumento: o.tipo_documento || (isOrc ? 'ORCAMENTO' : 'OS'),
            isOrcamento: isOrc,
            clienteId: o.cliente_id || o.client_id || '',
            clienteNome: o.cliente_nome || '',
            clienteCpfCnpj: o.cliente_cpf_cnpj || '',
            clienteTelefone: o.cliente_telefone || '',
            clienteEmail: o.cliente_email || '',
            clienteEndereco: o.cliente_endereco || '',
            operador: o.operador || 'VENDEDOR',
            vendedorNome: o.vendedor_nome || o.operador || 'VENDEDOR',
            filialId: o.filial_id || 'FILIAL-MATRIZ-001',
            filialNome: o.filial_nome || 'Matriz',
            dataVenda: o.data_venda || new Date().toLocaleDateString('pt-BR'),
            prazoEntrega: o.prazo_entrega || '',
            estagioAtual: o.estagio_atual || (isOrc ? 'Orçamento' : 'Sistema'),
            status: o.status || (isOrc ? 'Orçamento Criado' : 'Aberta'),
            situacao: o.situacao || (isOrc ? 'Orçamento Criado' : 'Aberta'),
            subtotal: Number(o.subtotal || 0),
            desconto: Number(o.desconto || 0),
            valorFinal: Number(o.valor_final || o.total_value || 0),
            formaPagamento: o.forma_pagamento || 'PIX',
            paymentStatus: o.payment_status || (isOrc ? 'orcamento' : 'pendente'),
            tipoExpedicao: o.tipo_expedicao || 'NORMAL',
            itens: typeof o.itens === 'string' ? JSON.parse(o.itens) : (o.itens || []),
            anexos: typeof o.anexos === 'string' ? JSON.parse(o.anexos) : (o.anexos || []),
            historicoEdicoes: typeof o.historico_edicoes === 'string' ? JSON.parse(o.historico_edicoes) : (o.historico_edicoes || []),
            fluxoProducao: typeof o.fluxo_producao === 'string' ? JSON.parse(o.fluxo_producao) : (o.fluxo_producao || ['Sistema']),
            observacoes: o.observacoes || '',
            deletedAt: o.deleted_at ? new Date(o.deleted_at).toISOString() : undefined,
            deletedBy: o.deleted_by || undefined,
            createdAt: o.created_at ? new Date(o.created_at).toISOString() : new Date().toISOString(),
            updatedAt: o.updated_at ? new Date(o.updated_at).toISOString() : new Date().toISOString()
          };
          if (!this.ordensServico.has(o.id)) {
            superSet(this.ordensServico, o.id, mappedOs);
          } else {
            const existing = this.ordensServico.get(o.id)!;
            if (mappedOs.deletedAt && !existing.deletedAt) {
              existing.deletedAt = mappedOs.deletedAt;
              existing.deletedBy = mappedOs.deletedBy;
            }
          }
        }
      } catch (orderRelErr) {
        // Table might not exist or empty
      }

      // Load relational clients from Supabase/Postgres if not in memory
      try {
        const clientRows = await pgPool.query('SELECT * FROM clients');
        for (const c of clientRows.rows) {
          if (!this.clients.has(c.id)) {
            const addr = typeof c.address === 'string' ? JSON.parse(c.address) : (c.address || {});
            const mappedClient: any = {
              id: c.id,
              codigo: c.codigo || '',
              type: c.type || 'PF',
              nome: c.name || '',
              sobrenome: '',
              name: c.name || '',
              cpf: c.cpf || c.document || '',
              cnpj: c.cnpj || '',
              razaoSocial: c.razao_social || '',
              nomeFantasia: c.nome_fantasia || '',
              inscricaoEstadual: c.inscricao_estadual || 'ISENTO',
              document: c.document || c.cpf || c.cnpj || '',
              email: c.email || '',
              telefone: c.phone || '',
              phone: c.phone || '',
              endereco: addr,
              dataNascimento: c.data_nascimento || c.birth_date || '',
              dataFundacao: c.data_fundacao || '',
              fotoUrl: c.foto_url || '',
              operador: c.operador || '',
              vendedorNome: c.vendedor_nome || '',
              status: c.status || 'ACTIVE',
              createdAt: c.created_at || new Date().toISOString(),
              updatedAt: c.updated_at || new Date().toISOString(),
              createdBy: c.created_by || 'SYSTEM',
              updatedBy: c.updated_by || 'SYSTEM',
            };
            superSet(this.clients, c.id, mappedClient);
          }
        }
      } catch (clientRelErr) {
        // Table might not exist or empty
      }

      // Load relational employees from Supabase/Postgres (with or without login credentials)
      try {
        const empRows = await pgPool.query('SELECT * FROM employees');
        for (const emp of empRows.rows) {
          if (!this.employees.has(emp.id)) {
            const addr = typeof emp.endereco === 'string' ? JSON.parse(emp.endereco) : (emp.endereco || null);
            const anexos = typeof emp.fichario_anexos === 'string' ? JSON.parse(emp.fichario_anexos) : (emp.fichario_anexos || []);
            const mappedEmp: Employee = {
              id: emp.id,
              codigo: emp.codigo || '',
              nome: emp.nome || '',
              sobrenome: emp.sobrenome || '',
              cpf: emp.cpf || '',
              rg: emp.rg || '',
              fotoUrl: emp.foto_url || '',
              dataNascimento: emp.data_nascimento || '',
              dataAdmissao: emp.data_admissao || '',
              cargo: emp.cargo || 'Administrativo',
              setor: emp.setor || 'Comercial & Vendas',
              filialId: emp.filial_id || 'filial-matriz-fortaleza',
              filialNome: emp.filial_nome || 'TECIDO SUBLIMADO FORTALEZA',
              salarioBase: Number(emp.salario_base || 0),
              tipoSalario: emp.tipo_salario || 'Mensalista',
              comissaoPorcentagem: Number(emp.comissao_porcentagem || 0),
              tipoComissao: emp.tipo_comissao || 'Sobre Vendas',
              metaIndividual: Number(emp.meta_individual || 0),
              chavePix: emp.chave_pix || '',
              bancoInfo: emp.banco_info || '',
              beneficios: emp.beneficios || '',
              observacoes: emp.observacoes || '',
              endereco: addr,
              telefone: emp.telefone || '',
              email: emp.email || '',
              status: emp.status || 'ACTIVE',
              temLogin: Boolean(emp.tem_login),
              loginUsuario: emp.login_usuario || '',
              loginSenha: emp.login_senha || '',
              ficharioAnexos: anexos,
              createdAt: emp.created_at ? new Date(emp.created_at).toISOString() : new Date().toISOString(),
              updatedAt: emp.updated_at ? new Date(emp.updated_at).toISOString() : new Date().toISOString(),
              createdBy: emp.created_by || 'SYSTEM',
              updatedBy: emp.updated_by || 'SYSTEM',
              version: 1,
            };
            superSet(this.employees, emp.id, mappedEmp);
          } else {
            const existingEmp = this.employees.get(emp.id)!;
            if (emp.foto_url && (!existingEmp.fotoUrl || existingEmp.fotoUrl !== emp.foto_url)) {
              existingEmp.fotoUrl = emp.foto_url;
            }
          }
        }
      } catch (empRelErr) {
        // Table might not exist or empty
      }

      // Sync employees to users in-memory without triggering thousands of redundant DB writes during boot
      for (const [id, emp] of this.employees.entries()) {
        const userId = `USR-EMP-${emp.id}`;
        let uEntity = this.users.get(userId);
        if (!uEntity) {
          const cleanCode = (emp.codigo || 'colab').toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanId = emp.id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-6);
          const username = emp.loginUsuario?.trim() || `@${cleanCode}_${cleanId}`;
          uEntity = {
            id: userId,
            username,
            passwordHash: emp.loginSenha ? CryptoSecurity.hashPasswordSync(emp.loginSenha) : '',
            name: `${emp.nome} ${emp.sobrenome || ''}`.trim(),
            email: emp.email || `${username.replace('@', '')}@subligestao.com.br`,
            phone: emp.telefone || '',
            roleId: emp.cargo || 'ROLE-VENDEDOR_A_',
            sectorId: emp.setor || 'SEC-COMERCIAL',
            branchId: emp.filialId || 'filial-matriz-fortaleza',
            isDeveloperInvisible: false,
            failedAttempts: 0,
            mfaEnabled: false,
            status: emp.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
            temLogin: Boolean(emp.temLogin),
            employeeId: emp.id,
            avatarUrl: emp.fotoUrl || '',
            version: 1,
            createdAt: emp.createdAt || new Date().toISOString(),
            updatedAt: emp.updatedAt || new Date().toISOString(),
            createdBy: 'EMPLOYEE_MODULE',
            updatedBy: 'EMPLOYEE_MODULE',
          };
          superSet(this.users, userId, uEntity);
        } else {
          uEntity.temLogin = Boolean(emp.temLogin);
          uEntity.employeeId = emp.id;
          if (emp.fotoUrl) uEntity.avatarUrl = emp.fotoUrl;
          superSet(this.users, userId, uEntity);
        }
      }

      // Load relational products from Supabase/Postgres if not in memory
      try {
        const prodRows = await pgPool.query('SELECT * FROM products');
        for (const p of prodRows.rows) {
            const mappedProd: any = {
              id: p.id,
              codigo: p.codigo,
              descricao: p.descricao || p.nome,
              nome: p.nome || p.descricao,
              categoria: (p.categoria && p.categoria.trim().toLowerCase() !== 'geral') ? p.categoria.trim() : '',
              unidade: p.unidade || 'UN',
              precoVenda: Number(p.preco_venda || 0),
              valorUnitario: Number(p.preco_venda || 0),
              precoCusto: Number(p.preco_custo || 0),
              precoMedio: Number(p.preco_medio || p.preco_custo || 0),
              estoqueAtual: Number(p.estoque_atual || 0),
              fotoUrl: p.foto_url || p.image_url || '',
              deletedAt: p.deleted_at || null,
              deletedBy: p.deleted_by || null,
              ...(p.detalhes || {})
            };
            superSet(this.products, p.id, mappedProd);
        }
      } catch (prodRelErr) {
        // Table might not exist or empty
      }

      // Sanitize products and historical entries to replace any legacy 'Malgom' references with 'TSF'
      for (const [pId, prod] of this.products.entries()) {
        let modified = false;
        if (prod.createdBy && prod.createdBy.includes('Malgom')) {
          prod.createdBy = prod.createdBy.replace(/Malgom/gi, 'TSF');
          modified = true;
        }
        if (prod.updatedBy && prod.updatedBy.includes('Malgom')) {
          prod.updatedBy = prod.updatedBy.replace(/Malgom/gi, 'TSF');
          modified = true;
        }
        if (prod.deletedBy && prod.deletedBy.includes('Malgom')) {
          prod.deletedBy = prod.deletedBy.replace(/Malgom/gi, 'TSF');
          modified = true;
        }
        if (Array.isArray(prod.historicoAlteracoes)) {
          for (const h of prod.historicoAlteracoes) {
            if (h.operador && h.operador.includes('Malgom')) {
              h.operador = h.operador.replace(/Malgom/gi, 'TSF');
              modified = true;
            }
            if (h.detalhes && h.detalhes.includes('Malgom')) {
              h.detalhes = h.detalhes.replace(/Malgom/gi, 'TSF');
              modified = true;
            }
          }
        }
        if (modified) {
          superSet(this.products, pId, prod);
        }
      }

      // Load relational permissions from Supabase/Postgres permissions table
      try {
        const permRows = await pgPool.query('SELECT role_id, rules FROM permissions');
        for (const pr of permRows.rows) {
          if (pr.role_id && pr.rules) {
            superSet(this.permissions, pr.role_id, pr.rules);
          }
        }
      } catch (permRelErr) {
        // Table might not exist or empty
      }

      // Seed default monthly meta (750.000) ONLY if database has no metas configured at all
      const currentMatrizMeta = this.metas.get('FILIAL-MATRIZ-001') || this.metas.get('filial-matriz-fortaleza');
      if (this.metas.size === 0) {
        const existing = currentMatrizMeta || {};
        const MESES_NOMES = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const defaultMatrizMeta = {
          filialId: 'FILIAL-MATRIZ-001',
          filialCodigo: 'MATRIZ',
          filialNome: 'TECIDO SUBLIMADO - Matriz',
          metaMensalValor: 750000,
          metaDiariaValor: Math.round(750000 / 22),
          metaQtdOs: existing.metaQtdOs || 0,
          vendaAtualValor: 0,
          metasMensais: MESES_NOMES.map((mesNome, idx) => {
            const existingMonth = existing.metasMensais?.find((m: any) => m.mesIndex === idx);
            return {
              mesIndex: idx,
              mesNome,
              metaValor: existingMonth && existingMonth.metaValor > 0 ? existingMonth.metaValor : 750000,
              metaQtdOs: existingMonth?.metaQtdOs || 0,
              metaTicketMedio: existingMonth?.metaTicketMedio || 0,
              vendaAtualValor: 0,
            };
          }),
          metaRelampago: existing.metaRelampago || {
            ativa: false,
            titulo: '',
            metaValorHoje: 0,
            metaQtdOsHoje: 0,
            realizadoHojeValor: 0,
            realizadoHojeOs: 0,
            observacoes: '',
          },
          metasDiaSemana: existing.metasDiaSemana || [
            { diaCodigo: 'SEG', diaNome: 'Segunda-feira', metaValor: Math.round(750000 / 22), metaQtdOs: 0 },
            { diaCodigo: 'TER', diaNome: 'Terça-feira', metaValor: Math.round(750000 / 22), metaQtdOs: 0 },
            { diaCodigo: 'QUA', diaNome: 'Quarta-feira', metaValor: Math.round(750000 / 22), metaQtdOs: 0 },
            { diaCodigo: 'QUI', diaNome: 'Quinta-feira', metaValor: Math.round(750000 / 22), metaQtdOs: 0 },
            { diaCodigo: 'SEX', diaNome: 'Sexta-feira', metaValor: Math.round(750000 / 22), metaQtdOs: 0 },
            { diaCodigo: 'SAB', diaNome: 'Sábado', metaValor: 0, metaQtdOs: 0 },
            { diaCodigo: 'DOM', diaNome: 'Domingo', metaValor: 0, metaQtdOs: 0 },
          ],
        };
        this.metas.set('FILIAL-MATRIZ-001', defaultMatrizMeta);
      }

      // Sincroniza e garante persistência integral dos temas no Supabase e em disco
      await initializeThemesEngine().catch(() => {});
    } catch (e) {
      console.error('Failed to load from Postgres:', e);
      await initializeThemesEngine().catch(() => {});
    }
  }

  public static nowISO(): string {
    return new Date().toISOString();
  }

  public static generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const randomHex = Math.random().toString(36).substring(2, 8);
    return `${prefix.toUpperCase()}-${timestamp}-${randomHex}`;
  }

  /**
   * Registra histórico de mudanças do sistema (metas, configurações, etc)
   * que não pertencem a outras entidades específicas.
   */
  public async recordSystemChange(entry: {
    entity: string;
    action: string;
    details: string;
    entityId?: string;
    previousState?: any;
    newState?: any;
    performedBy?: string;
  }): Promise<void> {
    const id = Database.generateId('SYSCHG');
    const nowIso = new Date().toISOString();
    const fullEntry = {
      id,
      entity: entry.entity,
      action: entry.action,
      details: entry.details,
      entityId: entry.entityId || entry.entity,
      previousState: entry.previousState || null,
      newState: entry.newState || null,
      performedBy: entry.performedBy || 'Sistema / Usuário',
      timestamp: nowIso,
      createdAt: nowIso,
    };

    this.systemChanges.push(fullEntry);

    try {
      await pgPool.query(`
        INSERT INTO system_changes (id, entity, action, details, entity_id, previous_state, new_state, performed_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        id,
        fullEntry.entity,
        fullEntry.action,
        fullEntry.details,
        fullEntry.entityId,
        JSON.stringify(fullEntry.previousState),
        JSON.stringify(fullEntry.newState),
        fullEntry.performedBy,
      ]);
    } catch (_) {}
  }

  private lastProductsSync = 0;
  private lastEmployeesSync = 0;
  private lastClientsSync = 0;
  private lastOrdersSync = 0;
  private lastUsersSync = 0;

  /**
   * High-speed bidirectional synchronization of catalog and stock with Supabase.
   * Ensures all stock quantities, descriptions, and catalog items are in 100% sync.
   */
  public async syncStockBidirectional(): Promise<{ count: number; durationMs: number; source: string }> {
    const start = Date.now();
    try {
      const prodRows = await pgPool.query('SELECT * FROM products ORDER BY updated_at DESC');
      const dbIds = new Set<string>();

      for (const p of prodRows.rows) {
        dbIds.add(p.id);
        const mappedProd: any = {
          id: p.id,
          codigo: p.codigo,
          descricao: p.descricao || p.nome,
          nome: p.nome,
          categoria: (p.categoria && p.categoria.trim().toLowerCase() !== 'geral') ? p.categoria.trim() : '',
          unidade: p.unidade || 'UN',
          precoVenda: Number(p.preco_venda || 0),
          valorUnitario: Number(p.preco_venda || 0),
          precoCusto: Number(p.preco_custo || 0),
          precoMedio: Number(p.preco_medio || p.preco_custo || 0),
          estoqueAtual: Number(p.estoque_atual || 0),
          estoqueMinimo: Number(p.estoque_minimo || 0),
          estoqueMaximo: Number(p.estoque_maximo || 500),
          fotoUrl: p.foto_url || p.image_url || '',
          codigoBarras: p.codigo_barras || '',
          sku: p.sku || '',
          referencia: p.referencia || '',
          origemCadastro: p.origem_cadastro || 'ESTOQUE',
          paraVenda: p.para_venda !== false,
          situacao: p.situacao || 'Ativo',
          status: p.status || 'ACTIVE',
          deletedAt: p.deleted_at || null,
          deletedBy: p.deleted_by || null,
          ...(p.detalhes || {})
        };
        superSet(this.products, p.id, mappedProd);
      }

      // Check if any in-memory products need to be pushed to Supabase
      const missingInDb: Array<{ key: string; value: any }> = [];
      for (const [id, prod] of this.products.entries()) {
        if (!dbIds.has(id)) {
          missingInDb.push({ key: id, value: prod });
        }
      }

      if (missingInDb.length > 0) {
        await this.products.persistMany(missingInDb);
      }

      this.lastProductsSync = Date.now();
      return {
        count: this.products.size,
        durationMs: Date.now() - start,
        source: 'Supabase PostgreSQL Cloud'
      };
    } catch (err: any) {
      return {
        count: this.products.size,
        durationMs: Date.now() - start,
        source: 'Local Cache Contingency'
      };
    }
  }

  public async syncCollection(collectionName: string, force = false): Promise<void> {
    try {
      const now = Date.now();
      const COOLDOWN_MS = 300000; // 5 minutos de cooldown para proteger Egress do Supabase

      if (collectionName === 'products') {
        if (!force && this.products.size > 0 && (now - this.lastProductsSync < COOLDOWN_MS)) {
          return;
        }
        await this.syncStockBidirectional();
        return;
      }
      if (collectionName === 'employees') {
        if (!force && this.employees.size > 0 && (now - this.lastEmployeesSync < COOLDOWN_MS)) {
          return;
        }
        this.lastEmployeesSync = now;
        const empRows = await pgPool.query('SELECT * FROM employees');
        for (const emp of empRows.rows) {
          const addr = typeof emp.endereco === 'string' ? JSON.parse(emp.endereco) : (emp.endereco || null);
          const anexos = typeof emp.fichario_anexos === 'string' ? JSON.parse(emp.fichario_anexos) : (emp.fichario_anexos || []);
          const mappedEmp: Employee = {
            id: emp.id,
            codigo: emp.codigo || '',
            nome: emp.nome || '',
            sobrenome: emp.sobrenome || '',
            cpf: emp.cpf || '',
            rg: emp.rg || '',
            fotoUrl: emp.foto_url || '',
            dataNascimento: emp.data_nascimento || '',
            dataAdmissao: emp.data_admissao || '',
            cargo: emp.cargo || 'Administrativo',
            setor: emp.setor || 'Comercial & Vendas',
            filialId: emp.filial_id || 'filial-matriz-fortaleza',
            filialNome: emp.filial_nome || 'TECIDO SUBLIMADO FORTALEZA',
            salarioBase: Number(emp.salario_base || 0),
            tipoSalario: emp.tipo_salario || 'Mensalista',
            comissaoPorcentagem: Number(emp.comissao_porcentagem || 0),
            tipoComissao: emp.tipo_comissao || 'Sobre Vendas',
            metaIndividual: Number(emp.meta_individual || 0),
            chavePix: emp.chave_pix || '',
            bancoInfo: emp.banco_info || '',
            beneficios: emp.beneficios || '',
            observacoes: emp.observacoes || '',
            endereco: addr,
            telefone: emp.telefone || '',
            email: emp.email || '',
            status: emp.status || 'ACTIVE',
            temLogin: Boolean(emp.tem_login),
            loginUsuario: emp.login_usuario || '',
            loginSenha: emp.login_senha || '',
            ficharioAnexos: anexos,
            createdAt: emp.created_at ? new Date(emp.created_at).toISOString() : new Date().toISOString(),
            updatedAt: emp.updated_at ? new Date(emp.updated_at).toISOString() : new Date().toISOString(),
            createdBy: emp.created_by || 'SYSTEM',
            updatedBy: emp.updated_by || 'SYSTEM',
            version: 1,
          };
          superSet(this.employees, emp.id, mappedEmp);
        }
      } else if (collectionName === 'users') {
        if (!force && this.users.size > 0 && (now - this.lastUsersSync < COOLDOWN_MS)) {
          return;
        }
        this.lastUsersSync = now;
        const userRows = await pgPool.query('SELECT * FROM users');
        for (const u of userRows.rows) {
          let existing = this.users.get(u.id);
          if (!existing && u.username) {
            const cleanU = u.username.toLowerCase();
            for (const usr of this.users.values()) {
              if (
                usr.username?.toLowerCase() === cleanU ||
                `@${usr.username?.replace(/^@/, '')}`.toLowerCase() === cleanU ||
                (Boolean(u.is_developer) && (usr.isDeveloperInvisible || usr.username?.toLowerCase().includes('marcelo') || usr.username?.toLowerCase().includes('dev')))
              ) {
                existing = usr;
                break;
              }
            }
          }
          if (existing) {
            if (u.avatar_url) existing.avatarUrl = u.avatar_url;
            if (u.support_avatar_url) existing.supportAvatarUrl = u.support_avatar_url;
            if (u.role) existing.roleId = u.role;
            if (u.sector) existing.sectorId = u.sector;
            if (u.tem_login !== undefined) existing.temLogin = Boolean(u.tem_login);
            if (u.employee_id) existing.employeeId = u.employee_id;
          }
        }
      } else if (collectionName === 'clients') {
        if (!force && this.clients.size > 0 && (now - this.lastClientsSync < COOLDOWN_MS)) {
          return;
        }
        this.lastClientsSync = now;
        const clientRows = await pgPool.query('SELECT * FROM clients');
        for (const c of clientRows.rows) {
          if (!this.clients.has(c.id)) {
            const addr = typeof c.address === 'string' ? JSON.parse(c.address) : (c.address || {});
            const mappedClient: any = {
              id: c.id,
              codigo: c.codigo || '',
              type: c.type || 'PF',
              nome: c.name || '',
              sobrenome: '',
              name: c.name || '',
              cpf: c.cpf || c.document || '',
              cnpj: c.cnpj || '',
              razaoSocial: c.razao_social || '',
              nomeFantasia: c.nome_fantasia || '',
              inscricaoEstadual: c.inscricao_estadual || 'ISENTO',
              document: c.document || c.cpf || c.cnpj || '',
              email: c.email || '',
              telefone: c.phone || '',
              phone: c.phone || '',
              endereco: addr,
              dataNascimento: c.data_nascimento || c.birth_date || '',
              dataFundacao: c.data_fundacao || '',
              fotoUrl: c.foto_url || '',
              operador: c.operador || '',
              vendedorNome: c.vendedor_nome || '',
              status: c.status || 'ACTIVE',
              createdAt: c.created_at || new Date().toISOString(),
              updatedAt: c.updated_at || new Date().toISOString(),
              createdBy: c.created_by || 'SYSTEM',
              updatedBy: c.updated_by || 'SYSTEM',
            };
            superSet(this.clients, c.id, mappedClient);
          }
        }
      } else if (collectionName === 'orders') {
        const COOLDOWN_MS = 10000;
        if (!force && this.ordensServico.size > 0 && (now - this.lastOrdersSync < COOLDOWN_MS)) {
          return;
        }
        this.lastOrdersSync = now;

        const activeDbIds = new Set<string>();

        // 1. Fetch from _system_store for full object fidelity (including deletedAt)
        const storeRows = await pgPool.query("SELECT id, data FROM _system_store WHERE collection = 'orders'");
        for (const row of storeRows.rows) {
          activeDbIds.add(row.id);
          const rawData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          const existing = this.ordensServico.get(row.id);

          if (!existing) {
            superSet(this.ordensServico, row.id, rawData);
          } else {
            if (
              rawData.deletedAt !== existing.deletedAt ||
              rawData.updatedAt !== existing.updatedAt ||
              rawData.status !== existing.status ||
              rawData.estagioAtual !== existing.estagioAtual ||
              rawData.valorFinal !== existing.valorFinal
            ) {
              superSet(this.ordensServico, row.id, { ...existing, ...rawData });
            }
          }
        }

        // 2. Also check relational orders table for deleted_at or direct DB updates
        const orderRows = await pgPool.query('SELECT id, deleted_at, deleted_by, status, estagio_atual, updated_at FROM orders');
        for (const o of orderRows.rows) {
          activeDbIds.add(o.id);
          const existing = this.ordensServico.get(o.id);
          if (existing) {
            if (o.deleted_at && !existing.deletedAt) {
              existing.deletedAt = new Date(o.deleted_at).toISOString();
              existing.deletedBy = o.deleted_by || existing.deletedBy;
            }
          }
        }

        // 3. Se uma OS foi hard-deleted do banco, remove da memória local
        if (storeRows.rows.length > 0 || orderRows.rows.length > 0) {
          for (const inMemId of Array.from(this.ordensServico.keys())) {
            if (!activeDbIds.has(inMemId)) {
              this.ordensServico.delete(inMemId);
            }
          }
        }
      } else if (collectionName === 'branches') {
        const storeRows = await pgPool.query("SELECT id, data FROM _system_store WHERE collection = 'branches'");
        const dbBranchIds = new Set<string>();
        for (const row of storeRows.rows) {
          dbBranchIds.add(row.id);
          const bData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          superSet(this.branches, row.id, bData);
        }
        for (const memId of Array.from(this.branches.keys())) {
          if (!dbBranchIds.has(memId) && dbBranchIds.size > 0) {
            this.branches.delete(memId);
          }
        }
      } else if (collectionName === 'permissions') {
        const permRows = await pgPool.query('SELECT role_id, rules FROM permissions');
        for (const pr of permRows.rows) {
          if (pr.role_id && pr.rules) {
            const rulesObj = typeof pr.rules === 'string' ? JSON.parse(pr.rules) : pr.rules;
            superSet(this.permissions, pr.role_id, rulesObj);
          }
        }
      } else if (collectionName === 'themes') {
        const themeRows = await pgPool.query('SELECT * FROM themes ORDER BY created_at ASC');
        for (const tr of themeRows.rows) {
          const full = typeof tr.full_data === 'string' ? JSON.parse(tr.full_data) : (tr.full_data || {});
          const colors = typeof tr.colors === 'string' ? JSON.parse(tr.colors) : (tr.colors || full.palette || {});
          const loginSettings = typeof tr.login_settings === 'string' ? JSON.parse(tr.login_settings) : (tr.login_settings || full.loginSettings || {});

          const isDisplay = Boolean(tr.is_active === true || full.displayTheme === true || full.is_active === true);
          const mappedTheme: any = {
            ...full,
            id: String(tr.id),
            name: tr.name || full.name || 'Tema Personalizado',
            displayTheme: isDisplay,
            is_active: isDisplay,
            themeType: tr.theme_type || full.themeType || 'natalino',
            primaryColor: tr.primary_color || full.primaryColor || 'gold',
            startDate: tr.start_date || full.startDate || '',
            endDate: tr.end_date || full.endDate || '',
            palette: colors,
            bg70Url: tr.bg70_url || full.bg70Url || loginSettings.bg70Url || '',
            bg30Url: tr.bg30_url || full.bg30Url || loginSettings.bg30Url || '',
            loginSettings: {
              ...loginSettings,
              bg70Url: tr.bg70_url || loginSettings.bg70Url || full.bg70Url || '',
              bg30Url: tr.bg30_url || loginSettings.bg30Url || full.bg30Url || '',
            },
            createdAt: tr.created_at ? new Date(tr.created_at).toISOString() : (full.createdAt || new Date().toISOString()),
            updatedAt: tr.updated_at ? new Date(tr.updated_at).toISOString() : (full.updatedAt || new Date().toISOString()),
          };
          superSet(this.customThemes, mappedTheme.id, mappedTheme);
        }
      }
    } catch (err) {
      // Non-fatal sync error
    }
  }
}

function superSet(map: any, key: string, value: any) {
  Map.prototype.set.call(map, key, value);
}

function superPush(arr: any, value: any) {
  Array.prototype.push.call(arr, value);
}
