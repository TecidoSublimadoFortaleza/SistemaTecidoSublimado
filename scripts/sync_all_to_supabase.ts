import { pgPool, ensureSystemStore, checkDatabaseConnection } from '../src/server/db/postgres';
import { Database } from '../src/server/db/database';
import { ChatRepository } from '../src/server/repositories/ChatRepository';

async function main() {
  console.log('1. Conectando ao Supabase e garantindo a criação de todas as tabelas...');
  const connected = await checkDatabaseConnection();
  if (!connected) {
    console.error('Não foi possível conectar ao Supabase.');
    process.exit(1);
  }

  await ensureSystemStore();
  console.log('Tabelas verificadas e criadas no Supabase.');

  const db = Database.getInstance();
  await db.initialize();

  console.log('2. Sincronizando dados atuais para as tabelas relacionais do Supabase...');

  // A. Clientes
  for (const [id, c] of db.clients.entries()) {
    const cl = c as any;
    try {
      await pgPool.query(`
        INSERT INTO clients (id, name, document, email, phone, address, birth_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET name = $2, document = $3, email = $4, phone = $5, address = $6
      `, [id, cl.name || cl.nome || '', cl.document || cl.cpfCnpj || '', cl.email || '', cl.phone || cl.telefone || '', JSON.stringify(cl.address || cl.endereco || {}), cl.birth_date || cl.dataNascimento || '']);
    } catch (_) {}
  }

  // B. Produtos
  for (const [id, p] of db.products.entries()) {
    const pr = p as any;
    try {
      await pgPool.query(`
        INSERT INTO products (
          id, codigo, nome, descricao, categoria, unidade, preco_venda, preco_custo,
          estoque_atual, estoque_minimo, estoque_maximo, codigo_barras, status, situacao, detalhes, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
        ON CONFLICT (id) DO UPDATE SET nome = $3, estoque_atual = $9, preco_venda = $7, updated_at = NOW()
      `, [
        id, pr.codigo || id, pr.nome || pr.name || id, pr.descricao || '', pr.categoria || pr.category || 'Geral',
        pr.unidade || 'UN', Number(pr.precoVenda || pr.preco_venda || 0), Number(pr.precoCusto || pr.preco_custo || 0),
        Number(pr.estoqueAtual || pr.estoque_atual || pr.stock || 0), Number(pr.estoqueMinimo || pr.estoque_minimo || 0),
        Number(pr.estoqueMaximo || pr.estoque_maximo || 500), pr.codigoBarras || pr.codigo_barras || '',
        pr.status || 'ACTIVE', pr.situacao || 'Ativo', JSON.stringify(pr.detalhes || {})
      ]);
    } catch (_) {}
  }

  // C. Categorias
  for (const [id, cat] of db.categories.entries()) {
    try {
      await pgPool.query(`
        INSERT INTO categories (id, name, descricao, data, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO UPDATE SET name = $2, descricao = $3, data = $4, updated_at = NOW()
      `, [id, (cat as any).nome || (cat as any).name || id, (cat as any).descricao || '', JSON.stringify(cat)]);
    } catch (_) {}
  }

  // D. Funcionários
  for (const [id, e] of db.employees.entries()) {
    const emp = e as any;
    try {
      await pgPool.query(`
        INSERT INTO employees (
          id, codigo, nome, sobrenome, cpf, rg, cargo, setor, filial_id, filial_nome,
          salario_base, tipo_salario, chave_pix, status, email, telefone, endereco, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
        ON CONFLICT (id) DO UPDATE SET nome = $3, cargo = $7, setor = $8, updated_at = NOW()
      `, [
        id, emp.codigo || id, emp.nome || '', emp.sobrenome || '', emp.cpf || '', emp.rg || '',
        emp.cargo || '', emp.setor || '', emp.filialId || emp.filial_id || '', emp.filialNome || emp.filial_nome || '',
        Number(emp.salarioBase || emp.salario_base || 0), emp.tipoSalario || 'MENSAL', emp.chavePix || '',
        emp.status || 'ACTIVE', emp.email || '', emp.telefone || '', JSON.stringify(emp.endereco || {})
      ]);
    } catch (_) {}
  }

  // E. Usuários
  for (const [id, u] of db.users.entries()) {
    const usr = u as any;
    try {
      await pgPool.query(`
        INSERT INTO users (
          id, username, password, name, email, phone, role, sector, is_developer, tem_login, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET name = $4, role = $7, sector = $8, updated_at = NOW()
      `, [
        id, usr.username || id, usr.password || '', usr.name || usr.username || '', usr.email || '',
        usr.phone || '', usr.role || 'Vendedor(a)', usr.sector || 'Comercial', Boolean(usr.is_developer || usr.isDeveloperInvisible),
        Boolean(usr.tem_login !== false)
      ]);
    } catch (_) {}
  }

  // F. Ordens de Serviço & Orçamentos
  for (const [id, o] of db.ordensServico.entries()) {
    const ord = o as any;
    try {
      const isOrc = Boolean(ord.tipoDocumento === 'ORCAMENTO' || ord.isOrcamento || ord.codigo?.startsWith('ORC'));
      await pgPool.query(`
        INSERT INTO orders (
          id, codigo, tipo_documento, is_orcamento, cliente_id, cliente_nome, cliente_cpf_cnpj,
          cliente_telefone, cliente_email, cliente_endereco, vendedor_nome, operador, filial_nome,
          data_venda, prazo_entrega, estagio_atual, status, situacao, valor_final, subtotal,
          desconto, forma_pagamento, payment_status, tipo_expedicao, itens, fluxo_producao, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW())
        ON CONFLICT (id) DO UPDATE SET valor_final = $19, status = $17, estagio_atual = $16, updated_at = NOW()
      `, [
        id, ord.codigo || id, isOrc ? 'ORCAMENTO' : 'OS', isOrc, ord.clienteId || ord.cliente_id || '',
        ord.clienteNome || ord.cliente_nome || '', ord.clienteCpfCnpj || ord.cliente_cpf_cnpj || '',
        ord.clienteTelefone || ord.cliente_telefone || '', ord.clienteEmail || ord.cliente_email || '',
        ord.clienteEndereco || ord.cliente_endereco || '', ord.vendedorNome || ord.vendedor_nome || '',
        ord.operador || '', ord.filialNome || ord.filial_nome || '', ord.dataVenda || ord.data_venda || '',
        ord.prazoEntrega || ord.prazo_entrega || '', ord.estagioAtual || ord.estagio_atual || 'Pendente',
        ord.status || 'Ativo', ord.situacao || 'Normal', Number(ord.valorFinal || ord.valor_final || ord.total || 0),
        Number(ord.subtotal || 0), Number(ord.desconto || 0), ord.formaPagamento || ord.forma_pagamento || '',
        ord.paymentStatus || ord.payment_status || 'PENDENTE', ord.tipoExpedicao || ord.tipo_expedicao || 'Balcão',
        JSON.stringify(ord.itens || []), JSON.stringify(ord.fluxoProducao || ord.fluxo_producao || [])
      ]);
    } catch (_) {}
  }

  // G. Filiais
  for (const [id, f] of db.branches.entries()) {
    try {
      await pgPool.query(`
        INSERT INTO branches (id, codigo, nome, cnpj, telefone, email, endereco, is_matriz, status, data, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET nome = $3, cnpj = $4, data = $10, updated_at = NOW()
      `, [
        id, (f as any).codigo || id, (f as any).nome || (f as any).name || id, (f as any).cnpj || '',
        (f as any).telefone || '', (f as any).email || '', JSON.stringify((f as any).endereco || {}),
        Boolean((f as any).isMatriz || (f as any).is_matriz), (f as any).status || 'ACTIVE', JSON.stringify(f)
      ]);
    } catch (_) {}
  }

  // H. Notas Fiscais
  for (const [id, n] of db.notasFiscais.entries()) {
    try {
      await pgPool.query(`
        INSERT INTO notas_fiscais (
          id, numero, serie, chave_acesso, tipo, status, cliente_id, cliente_nome,
          cliente_documento, valor_total, data_emissao, xml, danfe_pdf, itens, data_json, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
        ON CONFLICT (id) DO UPDATE SET status = $6, valor_total = $10, data_json = $15, updated_at = NOW()
      `, [
        id, (n as any).numero || '', (n as any).serie || '', (n as any).chaveAcesso || (n as any).chave_acesso || '',
        (n as any).tipo || 'NFe', (n as any).status || 'AUTORIZADA', (n as any).clienteId || (n as any).cliente_id || '',
        (n as any).clienteNome || (n as any).cliente_nome || '', (n as any).clienteDocumento || (n as any).cliente_documento || '',
        Number((n as any).valorTotal || (n as any).valor_total || 0), (n as any).dataEmissao || (n as any).data_emissao || '',
        (n as any).xml || '', (n as any).danfePdfBase64 || (n as any).danfe_pdf || '',
        JSON.stringify((n as any).itens || []), JSON.stringify(n)
      ]);
    } catch (_) {}
  }

  // I. PDV Transactions
  for (const [id, v] of db.pdvTransactions.entries()) {
    try {
      await pgPool.query(`
        INSERT INTO pdv_transactions (
          id, codigo, data, cliente_id, cliente_nome, vendedor_id, vendedor_nome,
          filial_id, filial_nome, valor_total, desconto, valor_pago, troco,
          forma_pagamento, status, itens, pagamentos, data_json, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
        ON CONFLICT (id) DO UPDATE SET valor_total = $10, status = $15, data_json = $18, updated_at = NOW()
      `, [
        id, (v as any).codigo || id, (v as any).data || '', (v as any).clienteId || (v as any).cliente_id || '',
        (v as any).clienteNome || (v as any).cliente_nome || '', (v as any).vendedorId || (v as any).vendedor_id || '',
        (v as any).vendedorNome || (v as any).vendedor_nome || '', (v as any).filialId || (v as any).filial_id || '',
        (v as any).filialNome || (v as any).filial_nome || '', Number((v as any).valorTotal || (v as any).total || (v as any).valor_total || 0),
        Number((v as any).desconto || 0), Number((v as any).valorPago || (v as any).valor_pago || 0), Number((v as any).troco || 0),
        (v as any).formaPagamento || (v as any).forma_pagamento || '', (v as any).status || 'CONCLUIDA',
        JSON.stringify((v as any).itens || []), JSON.stringify((v as any).pagamentos || []), JSON.stringify(v)
      ]);
    } catch (_) {}
  }

  // J. Temas Diversos (Supabase table 'themes')
  for (const [id, t] of db.customThemes.entries()) {
    const tm = t as any;
    try {
      const isDisplay = Boolean(tm.displayTheme === true || tm.is_active === true);
      const colorsJson = JSON.stringify(tm.palette || {});
      const loginSettingsJson = JSON.stringify(tm.loginSettings || {});
      const fullDataJson = JSON.stringify({ ...tm, displayTheme: isDisplay, is_active: isDisplay });
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
        id, tm.name || id, colorsJson, isDisplay, 'Usuário / Developer',
        tm.themeType || 'natalino', tm.primaryColor || 'gold', tm.startDate || '',
        tm.endDate || '', tm.bg70Url || '', tm.bg30Url || '', loginSettingsJson, fullDataJson
      ]);
    } catch (_) {}
  }

  console.log('3. Listando todas as tabelas criadas no Supabase e suas contagens:');
  const tablesRes = await pgPool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  for (const row of tablesRes.rows) {
    try {
      const countRes = await pgPool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
      console.log(`- Tabela [${row.table_name}]: ${countRes.rows[0].count} registro(s)`);
    } catch (e: any) {
      console.log(`- View/Tabela [${row.table_name}]: Ativa`);
    }
  }

  console.log('--- SINCRONIZAÇÃO COMPLETA FINALIZADA COM SUCESSO ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha geral:', err);
  process.exit(1);
});
