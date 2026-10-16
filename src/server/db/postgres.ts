import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Check if a real DATABASE_URL is configured
const rawDbUrl = process.env.DATABASE_URL?.trim();
const hasConfiguredDb = Boolean(rawDbUrl && rawDbUrl.length > 0 && !rawDbUrl.includes('YOUR_') && !rawDbUrl.includes('example'));

let connectionString = hasConfiguredDb ? rawDbUrl! : 'postgresql://postgres:postgres@localhost:5432/subligestao';

// If connecting to Supabase Pooler on session port 5432, upgrade to transaction port 6543 to avoid EMAXCONNSESSION limits
if (connectionString.includes('pooler.supabase.com:5432')) {
  connectionString = connectionString.replace(':5432', ':6543');
}

const isCloud = Boolean(
  hasConfiguredDb &&
  (connectionString.includes('supabase') ||
   connectionString.includes('pooler') ||
   connectionString.includes('sslmode=require') ||
   process.env.NODE_ENV === 'production')
);

export let pgPool = new Pool({
  connectionString,
  ssl: isCloud ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 300000, // 5 minutes to keep pool connections warm
  max: 6, // Avoid connection saturation
  min: 0, // Zero min connections to prevent unhandled connection errors on startup
  keepAlive: true,
  keepAliveInitialDelayMillis: 2000,
  statement_timeout: 25000,
  query_timeout: 25000,
});

// Periodic heartbeat ping to keep Supabase pooler connections warm and avoid cold TLS reconnections
setInterval(async () => {
  if (isDbAvailable === true) {
    try {
      await pgPool.query('SELECT 1');
    } catch (err: any) {
      markDatabaseUnavailable(err);
    }
  }
}, 30000);

// Track database connection status so we don't bombard or fail when DB is unreachable
let isDbAvailable: boolean | null = null;
let lastCheckTime = 0;
let lastErrorDetails = '';

export function extractProjectRef(url?: string): string | null {
  if (!url) return null;
  const matchUser = url.match(/postgres\.([a-zA-Z0-9_-]+):/);
  if (matchUser) return matchUser[1];
  const matchHost = url.match(/db\.([a-zA-Z0-9_-]+)\.supabase\.co/);
  if (matchHost) return matchHost[1];
  return null;
}

export function getDatabaseDiagnostics(): {
  isConfigured: boolean;
  connected: boolean;
  status: 'CONNECTED' | 'PAUSED_OR_NOT_FOUND' | 'OFFLINE_OR_MEMORY' | 'NOT_CONFIGURED';
  projectRef: string | null;
  unpauseUrl: string | null;
  poolerHost: string | null;
  maskedUrl: string | null;
  lastError: string;
  mode: string;
} {
  const currentUrl = process.env.DATABASE_URL?.trim();
  const isConfigured = Boolean(currentUrl && currentUrl.length > 0 && !currentUrl.includes('YOUR_') && !currentUrl.includes('example'));
  const projectRef = extractProjectRef(currentUrl);
  const unpauseUrl = projectRef ? `https://supabase.com/dashboard/project/${projectRef}` : null;

  let poolerHost: string | null = null;
  if (currentUrl) {
    try {
      const atSplit = currentUrl.split('@');
      if (atSplit.length > 1) {
        poolerHost = atSplit[1].split('/')[0];
      }
    } catch {}
  }

  const maskedUrl = currentUrl ? currentUrl.replace(/:[^:@]+@/, ':••••••••@') : null;

  let status: 'CONNECTED' | 'PAUSED_OR_NOT_FOUND' | 'OFFLINE_OR_MEMORY' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';
  if (isConfigured) {
    if (isDbAvailable === true) {
      status = 'CONNECTED';
    } else if (lastErrorDetails && (lastErrorDetails.includes('tenant') || lastErrorDetails.includes('not found') || lastErrorDetails.includes('ENOTFOUND'))) {
      status = 'PAUSED_OR_NOT_FOUND';
    } else if (isDbAvailable === false) {
      status = 'OFFLINE_OR_MEMORY';
    } else {
      // Not yet tested or verifying - default to CONNECTED if configured
      status = 'CONNECTED';
    }
  }

  const isActuallyConnected = isDbAvailable === true || (isConfigured && isDbAvailable !== false);

  return {
    isConfigured,
    connected: isActuallyConnected,
    status,
    projectRef,
    unpauseUrl,
    poolerHost,
    maskedUrl,
    lastError: lastErrorDetails,
    mode: isActuallyConnected ? 'PostgreSQL Supabase (Nuvem)' : 'Contingência em Memória / Local',
  };
}

export async function forceTestConnection(): Promise<{
  connected: boolean;
  message: string;
  projectRef: string | null;
  unpauseUrl: string | null;
  isPaused: boolean;
  dbName?: string;
  serverTime?: string;
}> {
  isDbAvailable = null;
  lastCheckTime = 0;
  const projectRef = extractProjectRef(process.env.DATABASE_URL);
  const unpauseUrl = projectRef ? `https://supabase.com/dashboard/project/${projectRef}` : null;

  try {
    const client = await pgPool.connect();
    const res = await client.query('SELECT NOW() as server_time, current_database() as db_name');
    client.release();
    isDbAvailable = true;
    lastErrorDetails = '';
    return {
      connected: true,
      message: `Conectado com sucesso ao banco Supabase: ${res.rows[0]?.db_name}`,
      projectRef,
      unpauseUrl,
      isPaused: false,
      dbName: res.rows[0]?.db_name,
      serverTime: String(res.rows[0]?.server_time),
    };
  } catch (err: any) {
    markDatabaseUnavailable(err);
    const msg = String(err?.message || err);
    const isPaused = msg.includes('tenant') || msg.includes('not found') || msg.includes('ENOTFOUND');
    return {
      connected: false,
      message: msg,
      projectRef,
      unpauseUrl,
      isPaused,
    };
  }
}

export async function updateDatabaseUrl(newUrl: string): Promise<{
  success: boolean;
  message: string;
  diagnostics: ReturnType<typeof getDatabaseDiagnostics>;
}> {
  const cleanUrl = newUrl.trim();
  if (!cleanUrl.startsWith('postgresql://') && !cleanUrl.startsWith('postgres://')) {
    throw new Error('A URL de conexão deve iniciar com postgresql:// ou postgres://');
  }

  // Update in-memory
  process.env.DATABASE_URL = cleanUrl;

  // Persist to .env file
  try {
    const fs = await import('fs');
    const path = await import('path');
    const envPath = path.resolve('.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('DATABASE_URL=')) {
        envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${cleanUrl}"`);
      } else {
        envContent += `\nDATABASE_URL="${cleanUrl}"\n`;
      }
    } else {
      envContent = `DATABASE_URL="${cleanUrl}"\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
  } catch (fsErr) {
    console.warn('Não foi possível gravar no arquivo .env:', fsErr);
  }

  // Re-create pool
  try {
    await pgPool.end().catch(() => {});
  } catch {}

  let targetConn = cleanUrl;
  if (targetConn.includes('pooler.supabase.com:5432')) {
    targetConn = targetConn.replace(':5432', ':6543');
  }
  const isCloud = Boolean(
    targetConn.includes('supabase') ||
    targetConn.includes('pooler') ||
    targetConn.includes('sslmode=require') ||
    process.env.NODE_ENV === 'production'
  );

  pgPool = new Pool({
    connectionString: targetConn,
    ssl: isCloud ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 300000,
    max: 6,
    min: 0,
    keepAlive: true,
    keepAliveInitialDelayMillis: 2000,
    statement_timeout: 10000,
    query_timeout: 10000,
  });

  pgPool.on('error', (err: any) => {
    markDatabaseUnavailable(err);
  });

  const testResult = await forceTestConnection();
  return {
    success: testResult.connected,
    message: testResult.message,
    diagnostics: getDatabaseDiagnostics(),
  };
}

export async function checkDatabaseConnection(): Promise<boolean> {
  const now = Date.now();
  // Cache check for 30 seconds if negative, 60 seconds if positive
  if (isDbAvailable !== null && (now - lastCheckTime < (isDbAvailable ? 60000 : 30000))) {
    return isDbAvailable;
  }

  lastCheckTime = now;
  try {
    const client = await pgPool.connect();
    client.release();
    isDbAvailable = true;
    lastErrorDetails = '';
    return true;
  } catch (err: any) {
    markDatabaseUnavailable(err);
    return false;
  }
}

export function isPostgresActive(): boolean {
  if (isDbAvailable === false) {
    // If it was marked unavailable more than 30 seconds ago, allow retry
    if (Date.now() - lastCheckTime > 30000) {
      isDbAvailable = null;
      return Boolean(process.env.DATABASE_URL);
    }
    return false;
  }
  return isDbAvailable === true || Boolean(process.env.DATABASE_URL);
}

export function markDatabaseUnavailable(err?: any) {
  isDbAvailable = false;
  lastCheckTime = Date.now();
  if (err?.message) {
    lastErrorDetails = String(err.message);
  }
}

// Suppress unhandled error crashes from pgPool when PostgreSQL is not running, tenant is paused, or credentials fail
pgPool.on('error', (err: any) => {
  markDatabaseUnavailable(err);
  // Silent fallback - do not crash application
});

// Helper for dynamic tables and relational views for pgAdmin 4
export async function ensureSystemStore() {
  const isAvailable = await checkDatabaseConnection();
  if (!isAvailable) {
    throw new Error('PostgreSQL not accessible. Using in-memory fallback.');
  }

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS _system_store (
      collection VARCHAR(100) NOT NULL,
      id VARCHAR(100) NOT NULL,
      data JSONB NOT NULL,
      PRIMARY KEY (collection, id)
    );

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

    CREATE TABLE IF NOT EXISTS permissions (
      role_id VARCHAR(100) PRIMARY KEY,
      rules JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS permission_history (
      id VARCHAR(100) PRIMARY KEY,
      role_id VARCHAR(100),
      action VARCHAR(100) NOT NULL,
      details TEXT,
      roles_count INT DEFAULT 1,
      roles_updated JSONB,
      previous_rules JSONB,
      new_rules JSONB,
      performed_by VARCHAR(150),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS system_changes (
      id VARCHAR(100) PRIMARY KEY,
      entity VARCHAR(100) NOT NULL,
      action VARCHAR(100) NOT NULL,
      details TEXT,
      entity_id VARCHAR(100),
      previous_state JSONB,
      new_state JSONB,
      performed_by VARCHAR(150),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(100) PRIMARY KEY,
      username VARCHAR(100) UNIQUE,
      password VARCHAR(255),
      name VARCHAR(150),
      email VARCHAR(150),
      phone VARCHAR(50),
      avatar_url TEXT,
      role VARCHAR(100),
      sector VARCHAR(100),
      is_developer BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(100) PRIMARY KEY,
      name TEXT,
      document TEXT,
      email TEXT,
      phone TEXT,
      address JSONB,
      birth_date TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
    CREATE INDEX IF NOT EXISTS idx_clients_document ON clients(document);

    CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(100) PRIMARY KEY,
      codigo VARCHAR(50),
      nome VARCHAR(150),
      sobrenome VARCHAR(150),
      cpf VARCHAR(50),
      rg VARCHAR(50),
      foto_url TEXT,
      data_nascimento VARCHAR(50),
      data_admissao VARCHAR(50),
      cargo VARCHAR(100),
      setor VARCHAR(100),
      filial_id VARCHAR(100),
      filial_nome VARCHAR(150),
      salario_base NUMERIC(12,2) DEFAULT 0,
      tipo_salario VARCHAR(50),
      comissao_porcentagem NUMERIC(6,2) DEFAULT 0,
      tipo_comissao VARCHAR(50),
      meta_individual NUMERIC(12,2) DEFAULT 0,
      chave_pix VARCHAR(150),
      banco_info TEXT,
      beneficios TEXT,
      observacoes TEXT,
      endereco JSONB,
      telefone VARCHAR(50),
      email VARCHAR(150),
      status VARCHAR(50) DEFAULT 'ACTIVE',
      tem_login BOOLEAN DEFAULT FALSE,
      login_usuario VARCHAR(100),
      login_senha VARCHAR(255),
      fichario_anexos JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(100) PRIMARY KEY,
      codigo VARCHAR(50),
      tipo_documento VARCHAR(20) DEFAULT 'OS',
      is_orcamento BOOLEAN DEFAULT FALSE,
      client_id VARCHAR(100),
      cliente_id VARCHAR(100),
      cliente_nome VARCHAR(255),
      cliente_cpf_cnpj VARCHAR(50),
      cliente_telefone VARCHAR(50),
      cliente_email VARCHAR(150),
      cliente_endereco TEXT,
      operador VARCHAR(150),
      vendedor_nome VARCHAR(150),
      filial_id VARCHAR(100),
      filial_nome VARCHAR(150),
      data_venda VARCHAR(50),
      prazo_entrega VARCHAR(50),
      estagio_atual VARCHAR(50),
      status VARCHAR(50),
      situacao VARCHAR(50),
      subtotal NUMERIC(12,2) DEFAULT 0,
      desconto NUMERIC(12,2) DEFAULT 0,
      valor_final NUMERIC(12,2) DEFAULT 0,
      total_value NUMERIC(12,2) DEFAULT 0,
      forma_pagamento VARCHAR(50),
      payment_status VARCHAR(50),
      tipo_expedicao VARCHAR(50),
      itens JSONB DEFAULT '[]'::jsonb,
      anexos JSONB DEFAULT '[]'::jsonb,
      historico_edicoes JSONB DEFAULT '[]'::jsonb,
      fluxo_producao JSONB DEFAULT '[]'::jsonb,
      observacoes TEXT,
      created_by VARCHAR(150),
      updated_by VARCHAR(150),
      deleted_at TIMESTAMP WITH TIME ZONE,
      deleted_by VARCHAR(150),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id VARCHAR(100) PRIMARY KEY,
      sender_id VARCHAR(100) NOT NULL,
      receiver_id VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(100) PRIMARY KEY,
      codigo VARCHAR(50),
      nome VARCHAR(255),
      descricao TEXT,
      categoria VARCHAR(100),
      unidade VARCHAR(20) DEFAULT 'UN',
      preco_venda NUMERIC(12,2) DEFAULT 0,
      preco_custo NUMERIC(12,2) DEFAULT 0,
      preco_medio NUMERIC(12,2) DEFAULT 0,
      estoque_atual NUMERIC(12,2) DEFAULT 0,
      estoque_minimo NUMERIC(12,2) DEFAULT 0,
      estoque_maximo NUMERIC(12,2) DEFAULT 500,
      codigo_barras VARCHAR(50),
      sku VARCHAR(50),
      referencia VARCHAR(50),
      origem_cadastro VARCHAR(50) DEFAULT 'ESTOQUE',
      para_venda BOOLEAN DEFAULT TRUE,
      situacao VARCHAR(50) DEFAULT 'Ativo',
      status VARCHAR(50) DEFAULT 'ACTIVE',
      foto_url TEXT,
      image_url TEXT,
      detalhes JSONB DEFAULT '{}'::jsonb,
      deleted_at TIMESTAMP WITH TIME ZONE,
      deleted_by VARCHAR(150),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS branches (
      id VARCHAR(100) PRIMARY KEY,
      codigo VARCHAR(50),
      nome VARCHAR(150),
      cnpj VARCHAR(50),
      telefone VARCHAR(50),
      email VARCHAR(150),
      endereco JSONB,
      is_matriz BOOLEAN DEFAULT FALSE,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      data JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      descricao TEXT,
      data JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pdv_transactions (
      id VARCHAR(100) PRIMARY KEY,
      codigo VARCHAR(50),
      data VARCHAR(50),
      cliente_id VARCHAR(100),
      cliente_nome VARCHAR(255),
      vendedor_id VARCHAR(100),
      vendedor_nome VARCHAR(150),
      filial_id VARCHAR(100),
      filial_nome VARCHAR(150),
      valor_total NUMERIC(12,2) DEFAULT 0,
      desconto NUMERIC(12,2) DEFAULT 0,
      valor_pago NUMERIC(12,2) DEFAULT 0,
      troco NUMERIC(12,2) DEFAULT 0,
      forma_pagamento VARCHAR(50),
      status VARCHAR(50) DEFAULT 'CONCLUIDA',
      itens JSONB DEFAULT '[]'::jsonb,
      pagamentos JSONB DEFAULT '[]'::jsonb,
      data_json JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notas_fiscais (
      id VARCHAR(100) PRIMARY KEY,
      numero VARCHAR(50),
      serie VARCHAR(20),
      chave_acesso VARCHAR(100),
      tipo VARCHAR(20) DEFAULT 'NFe',
      status VARCHAR(50) DEFAULT 'AUTORIZADA',
      cliente_id VARCHAR(100),
      cliente_nome VARCHAR(255),
      cliente_documento VARCHAR(50),
      valor_total NUMERIC(12,2) DEFAULT 0,
      data_emissao VARCHAR(50),
      xml TEXT,
      danfe_pdf TEXT,
      itens JSONB DEFAULT '[]'::jsonb,
      data_json JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_orders_codigo ON orders(codigo);
    CREATE INDEX IF NOT EXISTS idx_orders_tipo ON orders(tipo_documento);
    CREATE INDEX IF NOT EXISTS idx_orders_cliente_nome ON orders(cliente_nome);
    CREATE INDEX IF NOT EXISTS idx_orders_is_orcamento ON orders(is_orcamento);
    CREATE INDEX IF NOT EXISTS idx_employees_codigo ON employees(codigo);
    CREATE INDEX IF NOT EXISTS idx_employees_cpf ON employees(cpf);
    CREATE INDEX IF NOT EXISTS idx_employees_nome ON employees(nome);
    CREATE INDEX IF NOT EXISTS idx_products_estoque ON products(estoque_atual);
    CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_products_codigo ON products(codigo);
    CREATE INDEX IF NOT EXISTS idx_products_nome ON products(nome);
    CREATE INDEX IF NOT EXISTS idx_products_categoria ON products(categoria);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_products_situacao ON products(situacao);
    CREATE INDEX IF NOT EXISTS idx_system_store_collection ON _system_store(collection);

    -- Safe migration columns
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS support_avatar_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(150);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_developer BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tem_login BOOLEAN DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    ALTER TABLE employees ADD COLUMN IF NOT EXISTS rg VARCHAR(50);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS foto_url TEXT;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS data_nascimento VARCHAR(50);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS data_admissao VARCHAR(50);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS filial_id VARCHAR(100);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS filial_nome VARCHAR(150);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS salario_base NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS tipo_salario VARCHAR(50);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS comissao_porcentagem NUMERIC(6,2) DEFAULT 0;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS tipo_comissao VARCHAR(50);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS meta_individual NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS chave_pix VARCHAR(150);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS banco_info TEXT;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS beneficios TEXT;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS observacoes TEXT;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS endereco JSONB;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS telefone VARCHAR(50);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(150);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS tem_login BOOLEAN DEFAULT FALSE;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS login_usuario VARCHAR(100);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS login_senha VARCHAR(255);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS fichario_anexos JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    ALTER TABLE orders ADD COLUMN IF NOT EXISTS codigo VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20) DEFAULT 'OS';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_orcamento BOOLEAN DEFAULT FALSE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS cliente_id VARCHAR(100);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(255);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS cliente_cpf_cnpj VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS cliente_telefone VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS cliente_email VARCHAR(150);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS cliente_endereco TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS operador VARCHAR(150);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendedor_nome VARCHAR(150);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS filial_id VARCHAR(100);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS filial_nome VARCHAR(150);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS data_venda VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS prazo_entrega VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS estagio_atual VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS situacao VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS desconto NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS valor_final NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tipo_expedicao VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS itens JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS anexos JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS historico_edicoes JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS fluxo_producao JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_id VARCHAR(100);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_value NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by VARCHAR(150);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS observacoes TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(150);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(150);
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_date VARCHAR(50);

    -- Views dedicated to pgAdmin 4 for immediate clarity
    CREATE OR REPLACE VIEW vw_orcamentos AS
      SELECT 
        id,
        codigo,
        tipo_documento,
        cliente_nome,
        cliente_cpf_cnpj,
        cliente_telefone,
        vendedor_nome,
        operador,
        data_venda,
        prazo_entrega,
        valor_final,
        subtotal,
        desconto,
        status,
        forma_pagamento,
        payment_status,
        itens,
        created_at,
        updated_at
      FROM orders
      WHERE (is_orcamento = TRUE OR tipo_documento = 'ORCAMENTO' OR codigo LIKE 'ORC%') AND (deleted_at IS NULL);

    CREATE OR REPLACE VIEW vw_ordens_servico AS
      SELECT 
        id,
        codigo,
        tipo_documento,
        estagio_atual,
        cliente_nome,
        cliente_cpf_cnpj,
        cliente_telefone,
        vendedor_nome,
        operador,
        data_venda,
        prazo_entrega,
        valor_final,
        subtotal,
        desconto,
        status,
        forma_pagamento,
        payment_status,
        tipo_expedicao,
        itens,
        fluxo_producao,
        created_at,
        updated_at
      FROM orders
      WHERE (is_orcamento IS NOT TRUE) AND (tipo_documento != 'ORCAMENTO' OR tipo_documento IS NULL) AND (codigo NOT LIKE 'ORC%' OR codigo IS NULL) AND (deleted_at IS NULL);
  `);
}
