import fs from 'fs';
import path from 'path';
import { SYSTEM_MODULES, SystemModulePermissionRules } from '../src/server/db/defaultPermissions';
import { pgPool, checkDatabaseConnection, ensureSystemStore } from '../src/server/db/postgres';
import { Database } from '../src/server/db/database';

function emptyRules(): SystemModulePermissionRules {
  return {
    excluir: false,
    visualizar: false,
    voltarAcao: false,
    criarEditar: false,
    configuracoes: false,
    verFinanceiro: false,
    descontoEspecial: false,
  };
}

function fullRules(): SystemModulePermissionRules {
  return {
    excluir: true,
    visualizar: true,
    voltarAcao: true,
    criarEditar: true,
    configuracoes: true,
    verFinanceiro: true,
    descontoEspecial: true,
  };
}

export function buildOfficialPermissions(): Record<string, Record<string, SystemModulePermissionRules>> {
  const map: Record<string, Record<string, SystemModulePermissionRules>> = {};

  // 1. Developer, ADM MASTER, ADM SISTEMA, ADMINISTRADOR
  const fullRoles = ['Developer', 'ADM MASTER', 'ADM SISTEMA', 'ADMINISTRADOR'];
  for (const r of fullRoles) {
    map[r] = {};
    for (const m of SYSTEM_MODULES) {
      map[r][m] = fullRules();
    }
  }

  // 2. CEO, Gerente Geral
  for (const r of ['CEO', 'Gerente Geral']) {
    map[r] = {};
    for (const m of SYSTEM_MODULES) {
      if (['tv', 'tv-producao', 'filiais', 'waleads'].includes(m)) {
        map[r][m] = { ...emptyRules(), voltarAcao: true };
      } else {
        map[r][m] = fullRules();
      }
    }
  }

  // 3. Administrativo aliases
  const admRoles = ['Administrativo', 'ADMINISTRATIVO', 'Administração', 'administracao', 'admin', 'Administracao'];
  for (const r of admRoles) {
    map[r] = {};
    for (const m of SYSTEM_MODULES) {
      const visCriar = ['rh', 'jornada', 'azulzinha', 'mensagens', 'funcionarios', 'notasFiscais', 'conferenciaOs', 'gerenciadorCaixa', 'gerenciadorNotasFiscais'].includes(m);
      const isFin = ['azulzinha', 'relatorios', 'notasFiscais', 'gerenciadorCaixa', 'gerenciadorNotasFiscais'].includes(m);
      const isConf = ['notasFiscais', 'gerenciadorNotasFiscais'].includes(m);
      map[r][m] = {
        excluir: false,
        visualizar: visCriar,
        voltarAcao: false,
        criarEditar: visCriar,
        configuracoes: isConf,
        verFinanceiro: isFin,
        descontoEspecial: false,
      };
    }
  }

  // 4. Supervisor
  map['Supervisor'] = {};
  for (const m of SYSTEM_MODULES) {
    if (m === 'mensagens') {
      map['Supervisor'][m] = fullRules();
    } else if (['kanban', 'clientes', 'dashboard', 'orcamento', 'relatorios', 'historicoOs', 'ordemServico', 'tv-comercial'].includes(m)) {
      map['Supervisor'][m] = {
        ...emptyRules(),
        visualizar: true,
        criarEditar: true,
        voltarAcao: m === 'kanban',
      };
    } else {
      map['Supervisor'][m] = emptyRules();
    }
  }

  // 5. Monitor
  map['Monitor'] = {};
  for (const m of SYSTEM_MODULES) {
    const active = ['kanban', 'mensagens', 'conferenciaOs', 'controle-expedicao'].includes(m);
    map['Monitor'][m] = {
      ...emptyRules(),
      visualizar: active,
      criarEditar: active,
    };
  }

  // 6. Vendedor(a)
  map['Vendedor(a)'] = {};
  for (const m of SYSTEM_MODULES) {
    const active = ['kanban', 'clientes', 'dashboard', 'mensagens', 'orcamento', 'historicoOs', 'notasFiscais', 'ordemServico', 'gerenciadorNotasFiscais'].includes(m);
    map['Vendedor(a)'][m] = {
      ...emptyRules(),
      visualizar: active,
      criarEditar: active,
    };
  }

  // 7. Recepção
  map['Recepção'] = {};
  for (const m of SYSTEM_MODULES) {
    const active = ['pdv', 'kanban', 'clientes', 'dashboard', 'mensagens', 'orcamento', 'historicoOs', 'notasFiscais', 'ordemServico', 'entrega-devolucao', 'gerenciadorNotasFiscais'].includes(m);
    map['Recepção'][m] = {
      ...emptyRules(),
      visualizar: active,
      criarEditar: active,
    };
  }

  // 8. Estoque
  map['Estoque'] = {};
  for (const m of SYSTEM_MODULES) {
    const active = ['estoque', 'mensagens'].includes(m);
    map['Estoque'][m] = {
      ...emptyRules(),
      visualizar: active,
      criarEditar: active,
    };
  }

  // 9. Conferência aliases
  for (const r of ['Conferência', 'CONFERENCIA', 'Conferencia']) {
    map[r] = {};
    for (const m of SYSTEM_MODULES) {
      const active = ['kanban', 'mensagens', 'historicoOs', 'conferenciaOs'].includes(m);
      map[r][m] = {
        ...emptyRules(),
        visualizar: active,
        criarEditar: active,
      };
    }
  }

  // 10. Designer
  map['Designer'] = {};
  for (const m of SYSTEM_MODULES) {
    const active = ['kanban', 'mensagens'].includes(m);
    map['Designer'][m] = {
      ...emptyRules(),
      visualizar: active,
      criarEditar: active,
    };
  }

  // 11. Impressão aliases
  for (const r of ['Impressão', 'IMPRESSÃO', 'Impressao']) {
    map[r] = {};
    for (const m of SYSTEM_MODULES) {
      const active = ['kanban', 'mensagens'].includes(m);
      map[r][m] = {
        ...emptyRules(),
        visualizar: active,
        criarEditar: active,
      };
    }
  }

  // 12. Calandra aliases
  for (const r of ['Calandra', 'CALANDRA']) {
    map[r] = {};
    for (const m of SYSTEM_MODULES) {
      const active = ['kanban', 'mensagens'].includes(m);
      map[r][m] = {
        ...emptyRules(),
        visualizar: active,
        criarEditar: active,
      };
    }
  }

  // 13. Costura
  map['Costura'] = {};
  for (const m of SYSTEM_MODULES) {
    const active = ['kanban', 'mensagens'].includes(m);
    map['Costura'][m] = {
      ...emptyRules(),
      visualizar: active,
      criarEditar: active,
    };
  }

  // 14. Op. Máquina de corte, Operador
  for (const r of ['Op. Máquina de corte', 'Operador']) {
    map[r] = {};
    for (const m of SYSTEM_MODULES) {
      const active = ['tv', 'kanban', 'mensagens', 'tv-producao', 'tv-comercial'].includes(m);
      map[r][m] = {
        ...emptyRules(),
        visualizar: active,
        criarEditar: active,
      };
    }
  }

  // 15. Expedição, LOGISTICA
  for (const r of ['Expedição', 'LOGISTICA']) {
    map[r] = {};
    for (const m of SYSTEM_MODULES) {
      const active = ['tv', 'kanban', 'estoque', 'mensagens', 'tv-producao', 'tv-comercial', 'entrega-devolucao', 'controle-expedicao'].includes(m);
      map[r][m] = {
        ...emptyRules(),
        visualizar: active,
        criarEditar: active,
      };
    }
  }

  // 16. RH
  map['RH'] = {};
  for (const m of SYSTEM_MODULES) {
    map['RH'][m] = emptyRules();
  }

  // 17. Serviços Gerais
  map['Serviços Gerais'] = {};
  for (const m of SYSTEM_MODULES) {
    map['Serviços Gerais'][m] = emptyRules();
  }

  return map;
}

async function run() {
  console.log('--- OFICIALIZANDO CONTROLE E PERMISSÕES NO SISTEMA E SUPABASE ---');
  const officialMatrix = buildOfficialPermissions();
  const rolesCount = Object.keys(officialMatrix).length;
  console.log(`Perfis mapeados: ${rolesCount}`);

  // Salvar em arquivo JSON local
  const filePath = path.resolve(process.cwd(), 'src/server/db/officialPermissionsData.json');
  fs.writeFileSync(filePath, JSON.stringify(officialMatrix, null, 2), 'utf8');
  console.log(`Arquivo salvo: ${filePath}`);

  // Atualizar memória do servidor
  const db = Database.getInstance();
  for (const [r, rules] of Object.entries(officialMatrix)) {
    db.permissions.set(r, rules);
  }

  // Atualizar Supabase PostgreSQL
  const isAvailable = await checkDatabaseConnection();
  if (isAvailable) {
    await ensureSystemStore();
    console.log('Conectado ao Supabase com sucesso. Executando UPSERT de permissões...');

    for (const [roleId, rules] of Object.entries(officialMatrix)) {
      const jsonStr = JSON.stringify(rules);
      await pgPool.query(`
        INSERT INTO permissions (role_id, rules, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (role_id) DO UPDATE SET
          rules = $2, updated_at = NOW()
      `, [roleId, jsonStr]);

      await pgPool.query(`
        INSERT INTO _system_store (collection, id, data)
        VALUES ('permissions', $1, $2)
        ON CONFLICT (collection, id) DO UPDATE SET
          data = $2
      `, [roleId, jsonStr]);
    }

    // Inserir registro oficial no permission_history
    const historyId = `PERMHIST-OFICIAL-${Date.now()}`;
    await pgPool.query(`
      INSERT INTO permission_history (
        id,
        role_id,
        action,
        details,
        roles_count,
        roles_updated,
        new_rules,
        performed_by,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      historyId,
      'GLOBAL_OFICIAL',
      'HOMOLOGACAO_CONTROLE_OFICIAL_PADRAO',
      `Homologação e carga da Matriz Oficial Padrão de Permissões (${rolesCount} perfis) exportada pelo Developer @Marcelo-dev`,
      rolesCount,
      JSON.stringify(Object.keys(officialMatrix)),
      JSON.stringify(officialMatrix),
      '@Marcelo-dev (Developer)',
    ]);

    console.log(`Registro de auditoria inserido no permission_history: ${historyId}`);
  } else {
    console.log('Supabase não conectado diretamente no momento; salvo em memória e cache.');
  }

  console.log('--- PROCESSO CONCLUÍDO COM SUCESSO ---');
  process.exit(0);
}

run().catch((err) => {
  console.error('Erro na oficialização:', err);
  process.exit(1);
});
