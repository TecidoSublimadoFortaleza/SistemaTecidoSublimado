import { pgPool, isPostgresActive, markDatabaseUnavailable } from './postgres';

export class PersistentMap<K, V> extends Map<K, V> {
  constructor(private collectionName: string, private isRelational: boolean = false) {
    super();
  }

  set(key: K, value: V): this {
    super.set(key, value);
    // Only attempt database persistence if PostgreSQL is active or configured
    this.persist(key, value).catch(() => {});
    return this;
  }

  setMany(entries: Array<{ key: K; value: V }>): this {
    for (const { key, value } of entries) {
      super.set(key, value);
    }
    this.persistMany(entries).catch(() => {});
    return this;
  }

  public async clearDb(): Promise<void> {
    super.clear();
    if (isPostgresActive() !== false) {
      try {
        if (this.isRelational) {
          if (this.collectionName === 'permissions') {
            await pgPool.query('DELETE FROM permissions');
          } else {
            await pgPool.query(`DELETE FROM ${this.collectionName}`);
          }
        }
        await pgPool.query('DELETE FROM _system_store WHERE collection = $1', [this.collectionName]);
      } catch (err: any) {
        console.error(`Error clearing ${this.collectionName} from DB:`, err);
      }
    }
  }

  public async persistMany(entries: Array<{ key: K; value: V }>): Promise<void> {
    if (isPostgresActive() === false || entries.length === 0) return;

    if (this.collectionName === 'clients') {
      const BATCH_SIZE = 150;
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        const relValues: string[] = [];
        const relParams: any[] = [];
        let pIdx = 1;

        const storeValues: string[] = [];
        const storeParams: any[] = [];
        let sIdx = 1;

        for (const { key, value } of batch) {
          const val: any = value;
          const clientId = String(val.id || key);
          const clientName = String(val.name || val.nome || (val.razaoSocial ? `${val.razaoSocial} (${val.nomeFantasia || ''})` : 'Cliente')).trim();
          const clientDoc = String(val.document || val.cpf || val.cnpj || val.clienteCpfCnpj || '').trim();
          const clientPhone = String(val.phone || val.telefone || '').trim();
          const clientEmail = String(val.email || '').trim();
          const clientAddress = val.address || val.endereco || {};
          const clientBirthDate = val.dataNascimento || val.birthDate || null;

          relValues.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
          relParams.push(clientId, clientName, clientDoc, clientEmail, clientPhone, JSON.stringify(clientAddress), clientBirthDate);

          storeValues.push(`($${sIdx++}, $${sIdx++}, $${sIdx++})`);
          storeParams.push('clients', clientId, JSON.stringify(val));
        }

        const relSql = `
          INSERT INTO clients (id, name, document, email, phone, address, birth_date)
          VALUES ${relValues.join(', ')}
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            document = EXCLUDED.document,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            address = EXCLUDED.address,
            birth_date = EXCLUDED.birth_date
        `;

        const storeSql = `
          INSERT INTO _system_store (collection, id, data)
          VALUES ${storeValues.join(', ')}
          ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data
        `;

        await Promise.all([
          pgPool.query(relSql, relParams),
          pgPool.query(storeSql, storeParams)
        ]).catch(async (batchErr) => {
          console.warn('Batch multi-row upsert failed, falling back to individual inserts:', batchErr.message);
          for (const item of batch) {
            await this.persist(item.key, item.value).catch(() => {});
          }
        });
      }
      return;
    }

    const CHUNK_SIZE = 50;
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map((item) => this.persist(item.key, item.value).catch(() => {})));
    }
  }

  delete(key: K): boolean {
    const result = super.delete(key);
    if (result) {
      this.removeFromDb(key).catch(() => {});
    }
    return result;
  }

  private async persist(key: K, value: any) {
    // If PostgreSQL was marked unavailable or is not active, skip DB queries smoothly
    if (isPostgresActive() === false) {
      return;
    }

    if (this.isRelational) {
      try {
        if (this.collectionName === 'users') {
          const userPassword = value.passwordHash || value.password || null;
          const temLoginVal = value.temLogin !== undefined ? Boolean(value.temLogin) : true;
          const empIdVal = value.employeeId || null;
          const supportAvatar = value.supportAvatarUrl || null;
          try {
            await pgPool.query(`
              INSERT INTO users (id, username, password, name, email, phone, avatar_url, role, sector, is_developer, tem_login, employee_id, support_avatar_url)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              ON CONFLICT (id) DO UPDATE SET
                username = $2, password = COALESCE($3, users.password), name = $4, email = $5, phone = $6, avatar_url = COALESCE(NULLIF($7, ''), users.avatar_url, $7), role = $8, sector = $9, is_developer = $10, tem_login = $11, employee_id = $12, support_avatar_url = COALESCE(NULLIF($13, ''), users.support_avatar_url, $13)
            `, [value.id, value.username, userPassword, value.name, value.email, value.phone, value.avatarUrl, (value.role || value.roleId || 'Admin'), (value.sectorId || value.sector || 'Geral'), (value.isDeveloperInvisible || false), temLoginVal, empIdVal, supportAvatar]);
          } catch (insertErr: any) {
            if (insertErr?.code === '23505' || insertErr?.message?.includes('users_username_key')) {
              await pgPool.query(`
                UPDATE users SET
                  password = COALESCE($2, users.password), name = $3, email = $4, phone = $5, avatar_url = COALESCE(NULLIF($6, ''), users.avatar_url, $6), role = $7, sector = $8, is_developer = $9, tem_login = $10, employee_id = $11, support_avatar_url = COALESCE(NULLIF($12, ''), users.support_avatar_url, $12)
                WHERE username = $1
              `, [value.username, userPassword, value.name, value.email, value.phone, value.avatarUrl, (value.role || value.roleId || 'Admin'), (value.sectorId || value.sector || 'Geral'), (value.isDeveloperInvisible || false), temLoginVal, empIdVal, supportAvatar]);
            } else {
              throw insertErr;
            }
          }
        } else if (this.collectionName === 'clients') {
          const clientId = String(value.id || key);
          const clientName = String(value.name || value.nome || (value.razaoSocial ? `${value.razaoSocial} (${value.nomeFantasia || ''})` : 'Cliente')).trim();
          const clientDoc = String(value.document || value.cpf || value.cnpj || value.clienteCpfCnpj || '').trim();
          const clientPhone = String(value.phone || value.telefone || '').trim();
          const clientEmail = String(value.email || '').trim();
          const clientAddress = value.address || value.endereco || null;
          const clientBirthDate = value.dataNascimento || value.birthDate || null;
          await pgPool.query(`
            INSERT INTO clients (id, name, document, email, phone, address, birth_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              name = $2, document = $3, email = $4, phone = $5, address = $6, birth_date = $7
          `, [clientId, clientName, clientDoc, clientEmail, clientPhone, clientAddress ? JSON.stringify(clientAddress) : null, clientBirthDate]);
        } else if (this.collectionName === 'employees') {
          const empId = value.id || String(key);
          const empCodigo = value.codigo || '';
          const empNome = value.nome || '';
          const empSobrenome = value.sobrenome || '';
          const empCpf = value.cpf || '';
          const empRg = value.rg || '';
          const empFotoUrl = value.fotoUrl || '';
          const empDataNascimento = value.dataNascimento || '';
          const empDataAdmissao = value.dataAdmissao || '';
          const empCargo = value.cargo || '';
          const empSetor = value.setor || '';
          const empFilialId = value.filialId || null;
          const empFilialNome = value.filialNome || '';
          const empSalarioBase = Number(value.salarioBase || 0);
          const empTipoSalario = value.tipoSalario || 'Mensalista';
          const empComissao = Number(value.comissaoPorcentagem || 0);
          const empTipoComissao = value.tipoComissao || 'Sobre Vendas';
          const empMetaIndividual = Number(value.metaIndividual || 0);
          const empChavePix = value.chavePix || '';
          const empBancoInfo = value.bancoInfo || '';
          const empBeneficios = value.beneficios || '';
          const empObservacoes = value.observacoes || '';
          const empEndereco = value.endereco ? JSON.stringify(value.endereco) : null;
          const empTelefone = value.telefone || '';
          const empEmail = value.email || '';
          const empStatus = value.status || 'ACTIVE';
          const empTemLogin = Boolean(value.temLogin);
          const empLoginUsuario = value.loginUsuario || null;
          const empLoginSenha = value.loginSenha || null;
          const empFicharioAnexos = JSON.stringify(value.ficharioAnexos || []);

          await pgPool.query(`
            INSERT INTO employees (
              id, codigo, nome, sobrenome, cpf, rg, foto_url, data_nascimento, data_admissao,
              cargo, setor, filial_id, filial_nome, salario_base, tipo_salario,
              comissao_porcentagem, tipo_comissao, meta_individual, chave_pix,
              banco_info, beneficios, observacoes, endereco, telefone, email,
              status, tem_login, login_usuario, login_senha, fichario_anexos, updated_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9,
              $10, $11, $12, $13, $14, $15,
              $16, $17, $18, $19,
              $20, $21, $22, $23, $24, $25,
              $26, $27, $28, $29, $30, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              codigo = $2,
              nome = $3,
              sobrenome = $4,
              cpf = $5,
              rg = $6,
              foto_url = $7,
              data_nascimento = $8,
              data_admissao = $9,
              cargo = $10,
              setor = $11,
              filial_id = $12,
              filial_nome = $13,
              salario_base = $14,
              tipo_salario = $15,
              comissao_porcentagem = $16,
              tipo_comissao = $17,
              meta_individual = $18,
              chave_pix = $19,
              banco_info = $20,
              beneficios = $21,
              observacoes = $22,
              endereco = $23,
              telefone = $24,
              email = $25,
              status = $26,
              tem_login = $27,
              login_usuario = $28,
              login_senha = COALESCE($29, employees.login_senha),
              fichario_anexos = $30,
              updated_at = NOW()
          `, [
            empId, empCodigo, empNome, empSobrenome, empCpf, empRg, empFotoUrl, empDataNascimento, empDataAdmissao,
            empCargo, empSetor, empFilialId, empFilialNome, empSalarioBase, empTipoSalario,
            empComissao, empTipoComissao, empMetaIndividual, empChavePix,
            empBancoInfo, empBeneficios, empObservacoes, empEndereco, empTelefone, empEmail,
            empStatus, empTemLogin, empLoginUsuario, empLoginSenha, empFicharioAnexos
          ]);
        } else if (this.collectionName === 'orders') {
          const isOrc = Boolean(
            value.tipoDocumento === 'ORCAMENTO' ||
            (value.isOrcamento === true && value.tipoDocumento !== 'OS' && !value.codigo?.toUpperCase().startsWith('OS'))
          );
          const tipoDoc = isOrc ? 'ORCAMENTO' : 'OS';
          await pgPool.query(`
            INSERT INTO orders (
              id, codigo, tipo_documento, is_orcamento,
              client_id, cliente_id, cliente_nome, cliente_cpf_cnpj, cliente_telefone, cliente_email, cliente_endereco,
              operador, vendedor_nome, filial_id, filial_nome,
              data_venda, prazo_entrega, estagio_atual, status, situacao,
              subtotal, desconto, valor_final, total_value,
              forma_pagamento, payment_status, tipo_expedicao,
              itens, anexos, historico_edicoes, fluxo_producao, observacoes,
              created_by, updated_by, deleted_at, deleted_by
            )
            VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8, $9, $10, $11,
              $12, $13, $14, $15,
              $16, $17, $18, $19, $20,
              $21, $22, $23, $24,
              $25, $26, $27,
              $28, $29, $30, $31, $32,
              $33, $34, $35, $36
            )
            ON CONFLICT (id) DO UPDATE SET
              codigo = $2,
              tipo_documento = $3,
              is_orcamento = $4,
              client_id = $5,
              cliente_id = $6,
              cliente_nome = $7,
              cliente_cpf_cnpj = $8,
              cliente_telefone = $9,
              cliente_email = $10,
              cliente_endereco = $11,
              operador = $12,
              vendedor_nome = $13,
              filial_id = $14,
              filial_nome = $15,
              data_venda = $16,
              prazo_entrega = $17,
              estagio_atual = $18,
              status = $19,
              situacao = $20,
              subtotal = $21,
              desconto = $22,
              valor_final = $23,
              total_value = $24,
              forma_pagamento = $25,
              payment_status = $26,
              tipo_expedicao = $27,
              itens = $28,
              anexos = $29,
              historico_edicoes = $30,
              fluxo_producao = $31,
              observacoes = $32,
              updated_by = $34,
              deleted_at = $35,
              deleted_by = $36,
              updated_at = NOW()
          `, [
            value.id,
            value.codigo,
            tipoDoc,
            isOrc,
            value.clienteId || value.clientId || null,
            value.clienteId || value.clientId || null,
            value.clienteNome || value.clientName || '',
            value.clienteCpfCnpj || '',
            value.clienteTelefone || '',
            value.clienteEmail || '',
            value.clienteEndereco || '',
            value.operador || '',
            value.vendedorNome || value.operador || '',
            value.filialId || null,
            value.filialNome || '',
            value.dataVenda || '',
            value.prazoEntrega || '',
            value.estagioAtual || (isOrc ? 'Orçamento' : 'Sistema'),
            value.status || (isOrc ? 'Orçamento Criado' : 'Aberta'),
            value.situacao || (isOrc ? 'Orçamento Criado' : 'Aberta'),
            Number(value.subtotal || 0),
            Number(value.desconto || 0),
            Number(value.valorFinal || value.totalValue || 0),
            Number(value.valorFinal || value.totalValue || 0),
            value.formaPagamento || '',
            value.paymentStatus || (isOrc ? 'orcamento' : 'pendente'),
            value.tipoExpedicao || 'NORMAL',
            JSON.stringify(value.itens || []),
            JSON.stringify(value.anexos || []),
            JSON.stringify(value.historicoEdicoes || []),
            JSON.stringify(value.fluxoProducao || []),
            value.observacoes || '',
            value.createdBy || value.operador || 'VENDEDOR',
            value.updatedBy || value.operador || 'VENDEDOR',
            value.deletedAt ? new Date(value.deletedAt) : null,
            value.deletedBy || null
          ]);
        } else if (this.collectionName === 'chat_messages') {
          await pgPool.query(`
            INSERT INTO chat_messages (id, sender_id, receiver_id, content, read, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
              sender_id = $2, receiver_id = $3, content = $4, read = $5, created_at = $6
          `, [value.id, value.senderId, value.targetId, value.content, value.readByUsers?.length > 0, value.createdAt]);
        } else if (this.collectionName === 'permissions') {
          await pgPool.query(`
            INSERT INTO permissions (role_id, rules, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (role_id) DO UPDATE SET
              rules = $2, updated_at = NOW()
          `, [String(key), JSON.stringify(value)]);
        } else if (this.collectionName === 'categories') {
          const nome = value.nome || value.name || String(key);
          await Promise.allSettled([
            pgPool.query(`
              INSERT INTO product_categories (nome, para_venda, apenas_estoque_interno)
              VALUES ($1, $2, $3)
              ON CONFLICT (nome) DO UPDATE SET
                para_venda = $2, apenas_estoque_interno = $3
            `, [nome, value.paraVenda !== false, Boolean(value.apenasEstoqueInterno)]),
            pgPool.query(
              `INSERT INTO _system_store (collection, id, data) VALUES ($1, $2, $3) ON CONFLICT (collection, id) DO UPDATE SET data = $3`,
              [this.collectionName, String(key), JSON.stringify(value)]
            )
          ]);
        } else if (this.collectionName === 'products') {
          let fotoUrl = value.fotoUrl || value.image_url || '';
          if (fotoUrl.startsWith('data:image/')) {
            try {
              const match = fotoUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
              if (match) {
                const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
                const filename = `${String(key).toLowerCase()}.${ext}`;
                const fs = await import('fs');
                const path = await import('path');
                const dir = path.resolve('public/images/products');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, filename), Buffer.from(match[2], 'base64'));
                fotoUrl = `/images/products/${filename}`;
                value.fotoUrl = fotoUrl;
                value.image_url = fotoUrl;
              }
            } catch {}
          }

          const salePrice = Number(
            value.valorUnitario !== undefined
              ? value.valorUnitario
              : value.precoVenda !== undefined
              ? value.precoVenda
              : 0
          );
          value.valorUnitario = salePrice;
          value.precoVenda = salePrice;

          // Execute products table upsert and _system_store upsert concurrently for 2x faster performance
          const productUpsertPromise = pgPool.query(`
            INSERT INTO products (
              id, codigo, nome, descricao, categoria, unidade,
              preco_venda, preco_custo, preco_medio,
              estoque_atual, estoque_minimo, estoque_maximo,
              codigo_barras, sku, referencia,
              origem_cadastro, para_venda, situacao, status,
              foto_url, image_url, detalhes, deleted_at, deleted_by, updated_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9,
              $10, $11, $12,
              $13, $14, $15,
              $16, $17, $18, $19,
              $20, $21, $22, $23, $24, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              codigo = EXCLUDED.codigo,
              nome = EXCLUDED.nome,
              descricao = EXCLUDED.descricao,
              categoria = EXCLUDED.categoria,
              unidade = EXCLUDED.unidade,
              preco_venda = EXCLUDED.preco_venda,
              preco_custo = EXCLUDED.preco_custo,
              preco_medio = EXCLUDED.preco_medio,
              estoque_atual = EXCLUDED.estoque_atual,
              estoque_minimo = EXCLUDED.estoque_minimo,
              estoque_maximo = EXCLUDED.estoque_maximo,
              codigo_barras = EXCLUDED.codigo_barras,
              sku = EXCLUDED.sku,
              referencia = EXCLUDED.referencia,
              origem_cadastro = EXCLUDED.origem_cadastro,
              para_venda = EXCLUDED.para_venda,
              situacao = EXCLUDED.situacao,
              status = EXCLUDED.status,
              foto_url = EXCLUDED.foto_url,
              image_url = EXCLUDED.image_url,
              detalhes = EXCLUDED.detalhes,
              deleted_at = EXCLUDED.deleted_at,
              deleted_by = EXCLUDED.deleted_by,
              updated_at = NOW()
          `, [
            String(key),
            value.codigo || '',
            value.nome || value.descricao || 'Produto',
            value.descricao || value.nome || '',
            value.categoria || '',
            value.unidade || 'UN',
            salePrice,
            Number(value.precoCusto || 0),
            Number(value.precoMedio || value.precoCusto || 0),
            Number(value.estoqueAtual || 0),
            Number(value.estoqueMinimo || 0),
            Number(value.estoqueMaximo || 500),
            value.codigoBarras || '',
            value.sku || '',
            value.referencia || '',
            value.origemCadastro || 'ESTOQUE',
            value.paraVenda !== false,
            value.situacao || 'Ativo',
            value.status || 'ACTIVE',
            fotoUrl,
            fotoUrl,
            (() => {
              const prodDetails: any = {
                ...(value.detalhes || {}),
                ...value,
                historicoAlteracoes: value.historicoAlteracoes || []
              };
              if (!value.formulaMedidaId) {
                delete prodDetails.formulaMedidaId;
                delete prodDetails.formulaMedidaTitulo;
              }
              return JSON.stringify(prodDetails);
            })(),
            value.deletedAt ? new Date(value.deletedAt) : null,
            value.deletedBy || null
          ]);

          const storeUpsertPromise = pgPool.query(
            `INSERT INTO _system_store (collection, id, data) VALUES ($1, $2, $3) ON CONFLICT (collection, id) DO UPDATE SET data = $3`,
            [this.collectionName, String(key), JSON.stringify(value)]
          );

          await Promise.all([productUpsertPromise, storeUpsertPromise]);
          return; // Already persisted to both in parallel
        }
      } catch (relErr: any) {
        // Mark database unavailable if connection or authentication failed
        if (
          relErr.code === 'ECONNREFUSED' ||
          relErr.code === '28P01' || // password authentication failed
          relErr.message?.includes('password authentication') ||
          relErr.message?.includes('timeout')
        ) {
          markDatabaseUnavailable(relErr);
        }
      }
    }

    // Always persist into _system_store JSONB for 100% full object fidelity if DB is available
    if (isPostgresActive() !== false) {
      try {
        await pgPool.query(
          `INSERT INTO _system_store (collection, id, data) VALUES ($1, $2, $3) ON CONFLICT (collection, id) DO UPDATE SET data = $3`,
          [this.collectionName, String(key), JSON.stringify(value)]
        );
      } catch (storeErr: any) {
        if (
          storeErr.code === 'ECONNREFUSED' ||
          storeErr.code === '28P01' ||
          storeErr.message?.includes('password authentication') ||
          storeErr.message?.includes('timeout')
        ) {
          markDatabaseUnavailable(storeErr);
        }
      }
    }
  }

  private async removeFromDb(key: K) {
    if (isPostgresActive() === false) return;

    try {
      if (this.isRelational) {
        if (this.collectionName === 'permissions') {
          await pgPool.query(`DELETE FROM permissions WHERE role_id = $1`, [String(key)]).catch(() => {});
        } else {
          await pgPool.query(`DELETE FROM ${this.collectionName} WHERE id = $1`, [String(key)]).catch(() => {});
        }
      }
      await pgPool.query(`DELETE FROM _system_store WHERE collection = $1 AND id = $2`, [this.collectionName, String(key)]).catch(() => {});
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === '28P01') {
        markDatabaseUnavailable(err);
      }
    }
  }
}
