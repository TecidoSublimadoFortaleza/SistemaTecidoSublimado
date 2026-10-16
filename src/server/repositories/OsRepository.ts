import { Database } from '../db/database';
import { OrdemServico, ProductCatalog, PdvTransaction, ProductionStage } from '../types/os';

export class OsRepository {
  private static db = Database.getInstance();

  /**
   * Check if an OS or ORC code is already taken in the active database
   */
  public static isCodeAlreadyUsed(codigo: string, excludeId?: string): boolean {
    if (!codigo) return false;
    const clean = codigo.trim().toUpperCase();
    for (const [id, os] of this.db.ordensServico.entries()) {
      if (excludeId && id === excludeId) continue;
      if (os.codigo && os.codigo.trim().toUpperCase() === clean && !os.deletedAt) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate sequential OS Code strictly: OS00000001, OS00000002, OS00000003...
   */
  public static generateOsCode(): string {
    let maxNum = 0;
    for (const os of this.db.ordensServico.values()) {
      if (os.deletedAt) continue;
      const isOrc = (os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento === true || os.codigo?.startsWith('ORC');
      const isOss = (os as any).tipoDocumento === 'OSS' || (os as any).isShopee === true || os.codigo?.toUpperCase().startsWith('OSS');
      if (!isOrc && !isOss && os.codigo?.toUpperCase().startsWith('OS')) {
        const match = os.codigo.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
    let nextNum = maxNum + 1;
    let candidate = `OS${nextNum.toString().padStart(8, '0')}`;
    while (this.isCodeAlreadyUsed(candidate)) {
      nextNum++;
      candidate = `OS${nextNum.toString().padStart(8, '0')}`;
    }
    return candidate;
  }

  /**
   * Generate sequential OSS Code strictly: OSS00000001, OSS00000002, OSS00000003...
   */
  public static generateOssCode(): string {
    let maxNum = 0;
    for (const os of this.db.ordensServico.values()) {
      if (os.deletedAt) continue;
      if (os.codigo?.toUpperCase().startsWith('OSS')) {
        const match = os.codigo.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
    let nextNum = maxNum + 1;
    let candidate = `OSS${nextNum.toString().padStart(8, '0')}`;
    while (this.isCodeAlreadyUsed(candidate)) {
      nextNum++;
      candidate = `OSS${nextNum.toString().padStart(8, '0')}`;
    }
    return candidate;
  }

  /**
   * Generate sequential ORC Code strictly: ORC00000001, ORC00000002, ORC00000003...
   */
  public static generateOrcCode(): string {
    let maxNum = 0;
    for (const os of this.db.ordensServico.values()) {
      if (os.deletedAt) continue;
      const isOrc = (os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento === true || os.codigo?.startsWith('ORC');
      if (isOrc && os.codigo?.toUpperCase().startsWith('ORC')) {
        const match = os.codigo.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
    let nextNum = maxNum + 1;
    let candidate = `ORC${nextNum.toString().padStart(8, '0')}`;
    while (this.isCodeAlreadyUsed(candidate)) {
      nextNum++;
      candidate = `ORC${nextNum.toString().padStart(8, '0')}`;
    }
    return candidate;
  }

  /**
   * Sanitize existing records to ensure no duplicate OS or ORC codes exist in the store
   */
  public static sanitizeDuplicateCodes(): void {
    const activeOrders = Array.from(this.db.ordensServico.values())
      .filter((o) => !o.deletedAt)
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

    // 1. Normalização estrita da sequência de Ordens de Serviço (OS)
    const activeOss = activeOrders.filter((o) => {
      const isOrc = (o as any).tipoDocumento === 'ORCAMENTO' || (o as any).isOrcamento === true || o.codigo?.toUpperCase().startsWith('ORC');
      return !isOrc;
    });

    let osSeq = 1;
    for (const os of activeOss) {
      const expectedCode = `OS${String(osSeq).padStart(8, '0')}`;
      if (os.codigo !== expectedCode || (os as any).tipoDocumento !== 'OS' || (os as any).isOrcamento !== false) {
        os.codigo = expectedCode;
        os.tipoDocumento = 'OS';
        os.isOrcamento = false;
        this.db.ordensServico.set(os.id, os);
      }
      osSeq++;
    }

    // 2. Normalização estrita da sequência de Orçamentos (ORC)
    const activeOrcs = activeOrders.filter((o) => {
      const isOrc = (o as any).tipoDocumento === 'ORCAMENTO' || (o as any).isOrcamento === true || o.codigo?.toUpperCase().startsWith('ORC');
      return isOrc;
    });

    let orcSeq = 1;
    for (const orc of activeOrcs) {
      const expectedCode = `ORC${String(orcSeq).padStart(8, '0')}`;
      if (orc.codigo !== expectedCode || (orc as any).tipoDocumento !== 'ORCAMENTO' || (orc as any).isOrcamento !== true) {
        orc.codigo = expectedCode;
        orc.tipoDocumento = 'ORCAMENTO';
        orc.isOrcamento = true;
        this.db.ordensServico.set(orc.id, orc);
      }
      orcSeq++;
    }

    // 3. Garantir consistência e preenchimento de códigos faltantes (sem reordenar por ordem alfabética)
    for (const [id, prod] of this.db.products.entries()) {
      const descUpper = (prod.descricao || (prod as any).nome || '').trim().toUpperCase();
      if (
        descUpper === 'PRODUTO TESTE' ||
        descUpper === 'TESTE'
      ) {
        this.db.products.delete(id);
      }
    }

    // Se algum produto ativo não possuir código, atribui o próximo sequencial disponível
    for (const prod of this.db.products.values()) {
      if (!prod.deletedAt && (!prod.codigo || !prod.codigo.trim())) {
        prod.codigo = this.generateProductCode();
        this.db.products.set(prod.id, prod);
      }
    }
  }

  /**
   * Generate sequential Product Code strictly incremental by registration order (e.g. P0000001, P0000002...)
   */
  public static generateProductCode(): string {
    const products = Array.from(this.db.products.values()).filter(p => !p.deletedAt);
    let maxNum = 0;
    for (const p of products) {
      if (p.codigo) {
        const match = p.codigo.match(/^P(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
    const nextNum = maxNum + 1;
    return `P${String(nextNum).padStart(7, '0')}`;
  }

  /**
   * Generate sequential PDV Transaction Code for Direct Sales (e.g. VND00000001)
   */
  public static generatePdvCode(): string {
    const count = Array.from(this.db.pdvTransactions.values()).filter(t => !t.osId && (!t.osCodigo || !t.osCodigo.startsWith('OS'))).length + 1;
    const padded = String(count).padStart(8, '0');
    return `VND${padded}`;
  }

  /**
   * Generate sequential Sale Code for OS payment (e.g. CDV00000001)
   */
  public static generateCdvCode(): string {
    const count = Array.from(this.db.pdvTransactions.values()).filter(t => t.osId || (t.osCodigo && t.osCodigo.startsWith('OS'))).length + 1;
    const padded = String(count).padStart(8, '0');
    return `CDV${padded}`;
  }

  // --- PRODUCTS & INVENTORY (CATEGORIES INTEGRATED DIRECTLY WITH DATABASE) ---

  public static listCategories(filter?: boolean | { forOs?: boolean; origem?: 'ESTOQUE' | 'PRODUTOS_VENDA'; scope?: 'estoque' | 'venda' | 'all' }): string[] {
    const retiredCats = ['geral', 'cetim', 'dryfit', 'microfibra', 'neoprene'];
    // Garantir exclusão permanente da categoria 'geral' e categorias descontinuadas
    for (const [id, cat] of this.db.categories.entries()) {
      const lower = (cat.nome || '').trim().toLowerCase();
      if (retiredCats.includes(lower)) {
        this.db.categories.delete(id);
      }
    }

    const opts = typeof filter === 'boolean' ? { forOs: filter } : (filter || {});
    const isEstoqueScope = opts.scope === 'estoque' || opts.origem === 'ESTOQUE';
    const isVendaScope = opts.forOs === true || opts.scope === 'venda' || opts.origem === 'PRODUTOS_VENDA';

    // Mapeamento de produtos por categoria para desempate seguro
    const internalProductCats = new Set<string>();
    const salesProductCats = new Set<string>();
    for (const prod of this.db.products.values()) {
      const c = (prod.categoria || '').trim();
      if (!c || retiredCats.includes(c.toLowerCase())) continue;
      const isInternal = prod.paraVenda === false || (prod as any).apenasEstoqueInterno === true || prod.origemCadastro === 'ESTOQUE';
      if (isInternal) {
        internalProductCats.add(c.toLowerCase());
      } else {
        salesProductCats.add(c.toLowerCase());
      }
    }

    const list: string[] = [];
    for (const [, val] of this.db.categories.entries()) {
      const nome = (val.nome || '').trim();
      const lower = nome.toLowerCase();
      if (!nome || retiredCats.includes(lower)) {
        continue;
      }

      const isInternalStock = val.apenasEstoqueInterno === true ||
        val.paraVenda === false ||
        val.origem === 'ESTOQUE' ||
        lower.includes('apenas estoque') ||
        lower.includes('estoque interno') ||
        (internalProductCats.has(lower) && !salesProductCats.has(lower));

      if (isEstoqueScope) {
        // As categorias cadastradas em "PRODUTOS DE VENDA" NÃO devem aparecer em estoque!
        // Estoque exibirá apenas as categorias de produtos internos.
        if (val.origem === 'PRODUTOS_VENDA') continue;
        if (val.paraVenda === true && val.apenasEstoqueInterno !== true && !isInternalStock) continue;
        if (!isInternalStock && val.paraVenda === true) continue;
      } else if (isVendaScope) {
        // As categorias cadastradas em "ESTOQUE" NÃO devem aparecer em produtos de venda!
        if (val.origem === 'ESTOQUE') continue;
        if (val.apenasEstoqueInterno === true || val.paraVenda === false) continue;
        if (lower.includes('apenas estoque') || lower.includes('estoque interno')) continue;
        if (internalProductCats.has(lower) && !salesProductCats.has(lower)) continue;
      }

      list.push(nome);
    }

    // Se estiver vazia, sincronizar categorias encontradas nos produtos respeitando estritamente o escopo
    if (list.length === 0) {
      for (const prod of this.db.products.values()) {
        const cat = (prod.categoria || '').trim();
        if (!cat || retiredCats.includes(cat.toLowerCase()) || list.includes(cat)) continue;
        const isInternal = prod.paraVenda === false || (prod as any).apenasEstoqueInterno === true || prod.origemCadastro === 'ESTOQUE';
        if (isEstoqueScope && !isInternal) continue;
        if (isVendaScope && isInternal) continue;

        this.addCategory(cat, {
          origem: isInternal ? 'ESTOQUE' : 'PRODUTOS_VENDA',
          paraVenda: !isInternal,
          apenasEstoqueInterno: isInternal,
        });
        list.push(cat);
      }
    }

    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }

  public static addCategory(
    categoryName: string,
    options?: { paraVenda?: boolean; apenasEstoqueInterno?: boolean; origem?: 'ESTOQUE' | 'PRODUTOS_VENDA' }
  ): string[] {
    const trimmed = categoryName.trim();
    if (trimmed && trimmed.toLowerCase() !== 'geral') {
      const lower = trimmed.toLowerCase();
      const isInternalStock = options?.origem === 'ESTOQUE' ||
        options?.apenasEstoqueInterno === true ||
        options?.paraVenda === false ||
        (lower.includes('apenas estoque interno') && options?.paraVenda !== true);

      const origem: 'ESTOQUE' | 'PRODUTOS_VENDA' = options?.origem || (isInternalStock ? 'ESTOQUE' : 'PRODUTOS_VENDA');
      const catId = `CAT-${origem}-${lower.replace(/\s+/g, '_')}`;

      // Limpa chaves legadas não qualificadas
      const legacyCatId = `CAT-${lower.replace(/\s+/g, '_')}`;
      if (this.db.categories.has(legacyCatId)) {
        this.db.categories.delete(legacyCatId);
      }

      this.db.categories.set(catId, {
        id: catId,
        nome: trimmed,
        origem,
        paraVenda: options?.paraVenda !== undefined ? options.paraVenda : !isInternalStock,
        apenasEstoqueInterno: isInternalStock,
      });
    }
    return this.listCategories(options?.origem ? { origem: options.origem } : undefined);
  }

  public static updateCategory(
    oldName: string,
    newName: string,
    options?: { paraVenda?: boolean; apenasEstoqueInterno?: boolean; origem?: 'ESTOQUE' | 'PRODUTOS_VENDA' }
  ): string[] {
    const oldTrimmed = oldName.trim();
    const newTrimmed = newName.trim();
    if (!oldTrimmed || !newTrimmed) return this.listCategories();

    const oldLower = oldTrimmed.toLowerCase();
    const newLower = newTrimmed.toLowerCase();

    // Localizar a entidade anterior para preservar ou atualizar origem
    let existingEntity: any = null;
    let oldFoundKey: string | null = null;
    for (const [k, v] of this.db.categories.entries()) {
      if ((v.nome || '').trim().toLowerCase() === oldLower) {
        existingEntity = v;
        oldFoundKey = k;
        break;
      }
    }

    const isInternalStock = options?.origem === 'ESTOQUE' ||
      options?.apenasEstoqueInterno === true ||
      options?.paraVenda === false ||
      (newLower.includes('apenas estoque interno') && options?.paraVenda !== true);

    const origem: 'ESTOQUE' | 'PRODUTOS_VENDA' = options?.origem || existingEntity?.origem || (isInternalStock ? 'ESTOQUE' : 'PRODUTOS_VENDA');
    const newCatId = `CAT-${origem}-${newLower.replace(/\s+/g, '_')}`;

    if (oldFoundKey) {
      this.db.categories.delete(oldFoundKey);
    }
    const legacyOldCatId = `CAT-${oldLower.replace(/\s+/g, '_')}`;
    if (this.db.categories.has(legacyOldCatId)) {
      this.db.categories.delete(legacyOldCatId);
    }

    this.db.categories.set(newCatId, {
      id: newCatId,
      nome: newTrimmed,
      origem,
      paraVenda: options?.paraVenda !== undefined ? options.paraVenda : (existingEntity?.paraVenda ?? !isInternalStock),
      apenasEstoqueInterno: options?.apenasEstoqueInterno !== undefined ? options.apenasEstoqueInterno : (existingEntity?.apenasEstoqueInterno ?? isInternalStock),
    });

    // Atualiza todos os produtos existentes que continham esta categoria
    for (const [id, prod] of this.db.products.entries()) {
      if (prod.categoria === oldTrimmed || prod.categoria?.toLowerCase() === oldLower) {
        this.db.products.set(id, {
          ...prod,
          categoria: newTrimmed,
        });
      }
    }

    return this.listCategories(options?.origem ? { origem: options.origem } : undefined);
  }

  public static deleteCategory(categoryName: string): string[] {
    const trimmed = categoryName.trim();
    if (trimmed) {
      const lower = trimmed.toLowerCase();
      for (const [k, v] of this.db.categories.entries()) {
        if ((v.nome || '').trim().toLowerCase() === lower || k.includes(lower.replace(/\s+/g, '_'))) {
          this.db.categories.delete(k);
        }
      }
    }
    return this.listCategories();
  }

  public static listProducts(): ProductCatalog[] {
    return Array.from(this.db.products.values())
      .filter((p) => !p.deletedAt && p.descricao !== 'PRODUTO TESTE')
      .sort((a, b) => (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' }));
  }

  public static batchImportProducts(
    items: Array<Partial<ProductCatalog> & { descricao: string }>,
    operator: string = 'Operador'
  ): { total: number; created: number; updated: number; products: ProductCatalog[] } {
    let created = 0;
    let updated = 0;
    const resultProducts: ProductCatalog[] = [];

    // Pre-index existing products for O(1) lookups
    const codeMap = new Map<string, ProductCatalog>();
    const descMap = new Map<string, ProductCatalog>();
    for (const p of this.db.products.values()) {
      if (!p.deletedAt) {
        if (p.codigo) codeMap.set(p.codigo.toUpperCase(), p);
        if (p.descricao) descMap.set(p.descricao.trim().toLowerCase(), p);
      }
    }

    for (const item of items) {
      if (!item.descricao || !item.descricao.trim()) continue;
      const descTrimmed = item.descricao.trim();

      // Check if product already exists by code or description
      let existing: ProductCatalog | undefined;
      if (item.codigo) {
        existing = codeMap.get(item.codigo.toUpperCase());
      }
      if (!existing) {
        existing = descMap.get(descTrimmed.toLowerCase());
      }

      if (existing) {
        const updatedProd = this.updateProduct(existing.id, {
          ...item,
          descricao: descTrimmed,
          importado: true,
          updatedBy: operator,
        });
        if (updatedProd) {
          resultProducts.push(updatedProd);
          codeMap.set(updatedProd.codigo.toUpperCase(), updatedProd);
          descMap.set(updatedProd.descricao.trim().toLowerCase(), updatedProd);
          updated++;
        }
      } else {
        const newProd = this.createProduct({
          ...item,
          descricao: descTrimmed,
          importado: true,
          createdBy: operator,
        });
        resultProducts.push(newProd);
        codeMap.set(newProd.codigo.toUpperCase(), newProd);
        descMap.set(newProd.descricao.trim().toLowerCase(), newProd);
        created++;
      }
    }

    return { total: items.length, created, updated, products: resultProducts };
  }

  public static getProductById(id: string): ProductCatalog | undefined {
    return this.db.products.get(id);
  }

  public static generateEan13Barcode(index: number): string {
    const base = `7898521${String(index).padStart(5, '0')}`;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(base[i], 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checksum = (10 - (sum % 10)) % 10;
    return `${base}${checksum}`;
  }

  public static createProduct(data: Partial<ProductCatalog> & {
    descricao: string;
    createdBy?: string;
    operador?: string;
  }): ProductCatalog {
    const id = Database.generateId('PRD');
    const index = this.db.products.size + 1;
    const codigo = data.codigo || this.generateProductCode();
    const codigoBarras = data.codigoBarras || this.generateEan13Barcode(index);
    const sku = data.sku || `SKU-SUBLI-${String(index).padStart(4, '0')}`;
    const referencia = data.referencia || `REF-2026-${String(index).padStart(3, '0')}`;
    const now = Database.nowISO();
    const operator = data.createdBy || data.operador || 'Operador';

    if (data.categoria) {
      this.addCategory(data.categoria, {
        paraVenda: data.paraVenda !== false,
        apenasEstoqueInterno: data.paraVenda === false,
      });
    }

    const initialHistory: any[] = data.historicoAlteracoes || [
      {
        id: Database.generateId('HST'),
        dataHora: new Date().toLocaleString('pt-BR'),
        operador: operator,
        acao: 'Cadastro Inicial',
        detalhes: `Produto "${data.descricao.trim()}" cadastrado no sistema.`,
      },
    ];

    const salePrice = Number(
      data.valorUnitario !== undefined
        ? data.valorUnitario
        : (data as any).precoVenda !== undefined
        ? (data as any).precoVenda
        : 0
    );

    const newProduct: ProductCatalog = {
      id,
      codigo,
      codigoBarras,
      sku,
      referencia,
      descricao: data.descricao.trim(),
      precoCusto: Number(data.precoCusto) || 0,
      valorUnitario: salePrice,
      precoVenda: salePrice,
      precoExpresso: data.precoExpresso !== undefined ? Number(data.precoExpresso) : undefined,
      precoMedio: Number(data.precoMedio) || Number(data.precoCusto) || 0,
      categoria: (data.categoria && data.categoria.trim().toLowerCase() !== 'geral') ? data.categoria.trim() : '',
      marca: data.marca || 'SubliGestão',
      unidade: data.unidade || 'UN',
      ncm: data.ncm || '6006.32.00',
      cfop: data.cfop || '5101',
      origemMercadoria: data.origemMercadoria || '0 - Nacional',
      pesoUnitarioKg: Number(data.pesoUnitarioKg) || 0.5,
      dimensoes: data.dimensoes || '160x100x1 cm',
      
      estoqueAtual: data.estoqueAtual !== undefined ? Number(data.estoqueAtual) : 0,
      estoqueMinimo: data.estoqueMinimo !== undefined ? Number(data.estoqueMinimo) : 10,
      estoqueMaximo: data.estoqueMaximo !== undefined ? Number(data.estoqueMaximo) : 500,
      lote: data.lote || `LOT-2026-${String(index).padStart(3, '0')}`,
      dataValidade: data.dataValidade || '',
      fornecedorPrincipal: data.fornecedorPrincipal || '',
      custoUltimaCompra: data.custoUltimaCompra !== undefined ? Number(data.custoUltimaCompra) : (Number(data.precoCusto) || 0),

      fotoUrl: data.fotoUrl || '',
      anexosPdf: data.anexosPdf || [],
      observacoes: data.observacoes || '',
      origemCadastro: data.origemCadastro || 'ESTOQUE',
      importado: data.importado !== undefined ? Boolean(data.importado) : Boolean(data.observacoes && String(data.observacoes).toLowerCase().includes('importad')),
      paraVenda: data.paraVenda !== undefined ? data.paraVenda : (data.origemCadastro === 'OS_PDV' || data.origemCadastro === 'ESTOQUE' ? false : true),
      apenasEstoqueInterno: (data as any).apenasEstoqueInterno !== undefined ? (data as any).apenasEstoqueInterno : (data.paraVenda === false),
      isInternal: (data as any).isInternal !== undefined ? (data as any).isInternal : (data.paraVenda === false),
      comMedidas: data.comMedidas !== undefined ? Boolean(data.comMedidas) : false,
      // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
      // Se comMedidas estiver marcado mas nenhum cálculo for selecionado, NÃO força cálculo automático;
      // o padrão do sistema em OS permanece Altura × Largura Total m².
      formulaMedidaId: (data.comMedidas && data.formulaMedidaId && data.formulaMedidaId !== 'padrao_altura_largura' && data.formulaMedidaId !== 'nenhum')
        ? String(data.formulaMedidaId).trim()
        : undefined,
      formulaMedidaTitulo: (data.comMedidas && data.formulaMedidaId && data.formulaMedidaId !== 'padrao_altura_largura' && data.formulaMedidaId !== 'nenhum' && data.formulaMedidaTitulo)
        ? String(data.formulaMedidaTitulo).trim()
        : undefined,
      situacao: data.situacao || 'Ativo',

      historicoAlteracoes: initialHistory,

      createdAt: now,
      updatedAt: now,
      createdBy: operator,
      updatedBy: operator,
      status: 'ACTIVE',
      version: 1,
    };

    if (!newProduct.formulaMedidaId) {
      delete (newProduct as any).formulaMedidaId;
      delete (newProduct as any).formulaMedidaTitulo;
    }

    this.db.products.set(id, newProduct);
    return newProduct;
  }

  public static updateProduct(id: string, data: Partial<ProductCatalog> & { updatedBy?: string; operador?: string }): ProductCatalog | undefined {
    const existing = this.db.products.get(id);
    if (!existing || existing.deletedAt) return undefined;

    const operator = data.updatedBy || data.operador || 'Operador';
    const now = Database.nowISO();

    if (data.categoria) {
      const pv = data.paraVenda !== undefined ? data.paraVenda : existing.paraVenda;
      this.addCategory(data.categoria, {
        paraVenda: pv !== false,
        apenasEstoqueInterno: pv === false,
      });
    }

    const history = existing.historicoAlteracoes || [];
    const newHistoryEntry = {
      id: Database.generateId('HST'),
      dataHora: new Date().toLocaleString('pt-BR'),
      operador: operator,
      acao: 'Alteração de Cadastro',
      detalhes: `Produto atualizado. Estoque atual: ${data.estoqueAtual ?? existing.estoqueAtual}.`,
    };

    const updatedSalePrice = data.valorUnitario !== undefined
      ? Number(data.valorUnitario)
      : (data as any).precoVenda !== undefined
      ? Number((data as any).precoVenda)
      : existing.valorUnitario;

    const hasMedidas = data.comMedidas !== undefined ? Boolean(data.comMedidas) : existing.comMedidas;

    // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
    // Tratamento estrito de desmarcação de cálculo em produtos:
    // 1. Se o produto não tiver medidas (comMedidas = false), qualquer fórmula anterior é removida.
    // 2. Se formulaMedidaId for enviado explicitamente como nulo, vazio, 'padrao_altura_largura' ou 'nenhum', o cálculo é desmarcado.
    // 3. Se formulaMedidaId for fornecido com um identificador válido, atualiza para a nova fórmula e título.
    // 4. Se formulaMedidaId for undefined e comMedidas continuar ativo, preserva existing.formulaMedidaId sem regressão.
    let updatedFormulaMedidaId: string | undefined = existing.formulaMedidaId;
    let updatedFormulaMedidaTitulo: string | undefined = existing.formulaMedidaTitulo;

    if (!hasMedidas) {
      updatedFormulaMedidaId = undefined;
      updatedFormulaMedidaTitulo = undefined;
    } else if (data.formulaMedidaId !== undefined) {
      const fId = data.formulaMedidaId ? String(data.formulaMedidaId).trim() : '';
      if (!fId || fId === 'padrao_altura_largura' || fId === 'nenhum') {
        updatedFormulaMedidaId = undefined;
        updatedFormulaMedidaTitulo = undefined;
      } else {
        updatedFormulaMedidaId = fId;
        updatedFormulaMedidaTitulo = data.formulaMedidaTitulo ? String(data.formulaMedidaTitulo).trim() : undefined;
      }
    }

    const updated: ProductCatalog = {
      ...existing,
      ...data,
      codigoBarras: data.codigoBarras || existing.codigoBarras || this.generateEan13Barcode(Number(id.replace(/\D/g, '')) || 1),
      sku: data.sku || existing.sku || `SKU-SUBLI-${id}`,
      referencia: data.referencia || existing.referencia || `REF-2026-${id}`,
      descricao: data.descricao ? data.descricao.trim() : existing.descricao,
      precoCusto: data.precoCusto !== undefined ? Number(data.precoCusto) : existing.precoCusto,
      valorUnitario: updatedSalePrice,
      precoVenda: updatedSalePrice,
      precoExpresso: data.precoExpresso !== undefined ? Number(data.precoExpresso) : existing.precoExpresso,
      estoqueAtual: data.estoqueAtual !== undefined ? Number(data.estoqueAtual) : existing.estoqueAtual,
      estoqueMinimo: data.estoqueMinimo !== undefined ? Number(data.estoqueMinimo) : existing.estoqueMinimo,
      estoqueMaximo: data.estoqueMaximo !== undefined ? Number(data.estoqueMaximo) : existing.estoqueMaximo,
      pesoUnitarioKg: data.pesoUnitarioKg !== undefined ? Number(data.pesoUnitarioKg) : existing.pesoUnitarioKg,
      custoUltimaCompra: data.custoUltimaCompra !== undefined ? Number(data.custoUltimaCompra) : existing.custoUltimaCompra,
      comMedidas: hasMedidas,
      formulaMedidaId: updatedFormulaMedidaId,
      formulaMedidaTitulo: updatedFormulaMedidaTitulo,
      importado: data.importado !== undefined ? Boolean(data.importado) : (existing.importado ?? Boolean(data.observacoes && String(data.observacoes).toLowerCase().includes('importad'))),
      updatedAt: now,
      updatedBy: operator,
      version: existing.version + 1,
      historicoAlteracoes: data.historicoAlteracoes ? data.historicoAlteracoes : [newHistoryEntry, ...history],
    };

    if (!updatedFormulaMedidaId) {
      delete (updated as any).formulaMedidaId;
      delete (updated as any).formulaMedidaTitulo;
      if ((updated as any).detalhes) {
        delete (updated as any).detalhes.formulaMedidaId;
        delete (updated as any).detalhes.formulaMedidaTitulo;
      }
    } else {
      if ((updated as any).detalhes) {
        (updated as any).detalhes.formulaMedidaId = updatedFormulaMedidaId;
        (updated as any).detalhes.formulaMedidaTitulo = updatedFormulaMedidaTitulo;
      }
    }

    this.db.products.set(id, updated);
    return updated;
  }

  public static deleteProduct(id: string, deletedBy?: string): boolean {
    const existing = this.db.products.get(id);
    if (!existing || existing.deletedAt) return false;

    const now = Database.nowISO();
    this.db.products.set(id, {
      ...existing,
      deletedAt: now,
      deletedBy: deletedBy || 'Operador',
      status: 'INACTIVE',
      situacao: 'Inativo',
    });
    return true;
  }

  // --- ORDENS DE SERVIÇO ---
  public static listOrdensServico(): OrdemServico[] {
    return Array.from(this.db.ordensServico.values())
      .filter((os) => !os.deletedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public static getOsById(id: string): OrdemServico | undefined {
    return this.db.ordensServico.get(id);
  }

  public static createOs(data: Partial<OrdemServico> & { operador: string; clienteNome: string }): OrdemServico {
    const isOss =
      (data as any).tipoDocumento === 'OSS' ||
      (data as any).isShopee === true ||
      Boolean(data.codigo?.toUpperCase().startsWith('OSS'));

    const isOrcamento =
      !isOss && (
        (data as any).tipoDocumento === 'ORCAMENTO' ||
        (data as any).isOrcamento === true ||
        Boolean(data.codigo?.toUpperCase().startsWith('ORC')) ||
        (data as any).estagioAtual === 'Orçamento' ||
        (data as any).status === 'Orçamento Criado'
      );

    let codigo = data.codigo;
    if (isOss) {
      if (!codigo || !codigo.toUpperCase().startsWith('OSS') || this.isCodeAlreadyUsed(codigo)) {
        codigo = this.generateOssCode();
      }
    } else if (isOrcamento) {
      if (!codigo || !codigo.toUpperCase().startsWith('ORC') || this.isCodeAlreadyUsed(codigo)) {
        codigo = this.generateOrcCode();
      }
    } else {
      if (!codigo || !codigo.toUpperCase().startsWith('OS') || codigo.toUpperCase().startsWith('OSS') || this.isCodeAlreadyUsed(codigo)) {
        codigo = this.generateOsCode();
      }
    }

    const id = isOss
      ? (data.id && data.id.startsWith('OSS-') ? data.id : Database.generateId('OSS'))
      : isOrcamento
      ? (data.id && data.id.startsWith('ORC-') ? data.id : Database.generateId('ORC'))
      : (data.id && data.id.startsWith('OS-') ? data.id : Database.generateId('OS'));
    const now = Database.nowISO();
    const todayFormatted = new Date().toLocaleDateString('pt-BR');

    const defaultFluxo: ProductionStage[] = [
      'Designer',
      'Impressão',
      'Calandra',
      'Costura',
      'RETIRADA(Recepção)',
    ];

    const effectiveFluxoRaw = isOrcamento
      ? []
      : (data.fluxoProducao && data.fluxoProducao.length > 0 ? [...data.fluxoProducao] : [...defaultFluxo]);

    // Preserva etapas e suporta legado apenas se não for fluxo dos novos 8 estágios
    const hasNewOrCustomDest = effectiveFluxoRaw.some((s) =>
      ['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)', 'Excursão', 'Correios', 'Shopee', 'Retirada (Recepção)'].includes(s as string)
    );
    if (!isOrcamento && !hasNewOrCustomDest && effectiveFluxoRaw.length > 0 && !effectiveFluxoRaw.includes('Conferência')) {
      const expIdx = effectiveFluxoRaw.findIndex((s) => s === 'Expedição' || s === 'Entrega' || s === 'Concluído');
      if (expIdx >= 0) {
        effectiveFluxoRaw.splice(expIdx, 0, 'Conferência');
      } else {
        effectiveFluxoRaw.push('Conferência');
      }
    }
    const effectiveFluxo = effectiveFluxoRaw;

    // Initial production stage on shop floor:
    // If 'Designer' is in the flow, starts at 'Designer'; otherwise starts at 'Impressão' (first active manufacturing stage)
    const firstProductionStage: ProductionStage = effectiveFluxo.includes('Designer')
      ? 'Designer'
      : (effectiveFluxo.find((s) => s !== 'Sistema') || 'Impressão');

    const initialEstagioAtual: ProductionStage = isOrcamento
      ? ('Orçamento' as any)
      : (data.estagioAtual && data.estagioAtual !== 'Sistema' ? data.estagioAtual : firstProductionStage);

    const initialSetorAceitoPor = data.setorAceitoPor && data.setorAceitoPor.length > 0
      ? data.setorAceitoPor
      : isOrcamento
      ? []
      : [
          {
            estagio: 'Sistema' as ProductionStage,
            descricaoEtapa: 'Criação da OS e Envio para Produção, Conferência & Controle de Expedição',
            funcionario: data.operador || 'VENDEDOR MATRIZ',
            aceitoEm: `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
            aceitoEmISO: now,
            status: 'Concluído' as const,
            concluidoEm: `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
            concluidoEmISO: now,
            observacao: 'OS gerada e encaminhada simultaneamente para a Conferência, o Controle de Expedição e o Fluxo de Produção.',
          },
        ];

    const initialHistory = data.historicoEdicoes && data.historicoEdicoes.length > 0
      ? data.historicoEdicoes
      : [
          {
            id: Database.generateId('HST'),
            dataHora: `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
            usuario: data.operador || 'VENDEDOR MATRIZ',
            perfil: (data as any).editorPerfil || 'Operador',
            acao: isOrcamento ? 'Criou o Orçamento' : 'Criou a Ordem de Serviço',
            detalhes: isOrcamento
              ? `Orçamento ${codigo} criado para o cliente ${data.clienteNome}.`
              : `OS ${codigo} criada para o cliente ${data.clienteNome}. Enviada simultaneamente para Conferência, Controle de Expedição e Produção [${initialEstagioAtual}].`,
          },
        ];

    const newOs: OrdemServico = {
      ...data,
      id,
      codigo,
      tipoDocumento: isOrcamento ? 'ORCAMENTO' : 'OS',
      isOrcamento: Boolean(isOrcamento),
      dataVenda: (data as any).dataVenda || todayFormatted,
      operador: data.operador,
      vendedorNome: (data as any).vendedorNome || data.operador,
      filialId: (data as any).filialId,
      filialNome: (data as any).filialNome,
      clienteId: data.clienteId,
      clienteNome: data.clienteNome,
      clienteCpfCnpj: data.clienteCpfCnpj || '',
      clienteTelefone: data.clienteTelefone || '',
      clienteEmail: data.clienteEmail || '',
      prazoEntrega: data.prazoEntrega || todayFormatted,
      fluxoProducao: effectiveFluxo,
      estagioAtual: initialEstagioAtual,
      conferido: data.conferido ?? false,
      expedido: (data as any).expedido ?? false,
      status: isOrcamento ? ('Orçamento Criado' as any) : (data.status || 'ACTIVE'),
      situacao: isOrcamento ? 'Orçamento Criado' : ((data as any).situacao || 'Aberta'),
      setorAceitoPor: initialSetorAceitoPor,
      itens: data.itens || [],
      anexos: data.anexos || [],
      observacoes: data.observacoes || '',
      subtotal: data.subtotal || 0,
      desconto: data.desconto || 0,
      valorFinal: data.valorFinal || 0,
      paymentStatus: isOrcamento ? ('orcamento' as any) : (data.paymentStatus || 'pendente'),
      formaPagamento: isOrcamento ? 'Orçamento' : (data.formaPagamento || 'PIX'),
      historicoEdicoes: initialHistory,
      createdAt: now,
      updatedAt: now,
      createdBy: data.operador,
      updatedBy: data.operador,
      version: 1,
    };

    this.db.ordensServico.set(id, newOs);

    // Auto register any new custom products in OS items into the product catalog
    newOs.itens.forEach((item) => {
      const exists = Array.from(this.db.products.values()).some(
        (p) => p.descricao.toLowerCase() === item.descricao.toLowerCase()
      );
      if (!exists) {
        this.createProduct({
          descricao: item.descricao,
          unidade: item.unidade,
          valorUnitario: item.valorUnitario,
          precoMedio: item.precoMedio,
          createdBy: data.operador,
          origemCadastro: 'OS_PDV',
          paraVenda: false,
        });
      }
    });

    return newOs;
  }

  public static updateOs(id: string, updates: Partial<OrdemServico>): OrdemServico {
    const existing = this.getOsById(id);
    if (!existing) {
      throw new Error('Ordem de serviço não encontrada.');
    }

    let updatedHistory = updates.historicoEdicoes
      ? [...updates.historicoEdicoes]
      : [...(existing.historicoEdicoes || [])];

    // Auto append history entry if updates has no new explicit history entry added
    if (
      !updates.historicoEdicoes ||
      updates.historicoEdicoes.length === (existing.historicoEdicoes || []).length
    ) {
      const now = new Date();
      const timeStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      const editorUser = updates.updatedBy || updates.operador || existing.operador || 'Operador';
      const editorPerfil = (updates as any).editorPerfil || 'Operador';

      let acao = '';
      let detalhes = '';
      if (updates.anexos && JSON.stringify(updates.anexos) !== JSON.stringify(existing.anexos)) {
        acao = 'alterou imagem / layout das artes';
        detalhes = 'Layout/arquivos de artes atualizados.';
      } else if (updates.paymentStatus && updates.paymentStatus !== existing.paymentStatus) {
        acao = `alterou status de pagamento para ${updates.paymentStatus.toUpperCase()}`;
        detalhes = `Status de pagamento alterado de ${existing.paymentStatus} para ${updates.paymentStatus}.`;
        if (
          updates.paymentStatus.toLowerCase() === 'pago' &&
          (existing.paymentStatus || '').toLowerCase() !== 'pago'
        ) {
          (updates as any).dataQuitacao = (updates as any).dataQuitacao || Database.nowISO();
          (updates as any).eraPendencia = true;
        }
      } else if (updates.estagioAtual && updates.estagioAtual !== existing.estagioAtual) {
        acao = `alterou estágio de produção para "${updates.estagioAtual}"`;
        detalhes = `Estágio avançado de ${existing.estagioAtual} para ${updates.estagioAtual}.`;
      } else if (updates.itens && JSON.stringify(updates.itens) !== JSON.stringify(existing.itens)) {
        acao = 'editou os itens da Ordem de Serviço';
        detalhes = `Itens atualizados (${updates.itens.length} itens).`;
      } else if (updates.valorFinal !== undefined && Math.abs(updates.valorFinal - (existing.valorFinal || 0)) > 0.01) {
        acao = `alterou o valor final para R$ ${updates.valorFinal.toFixed(2)}`;
        detalhes = `Valor final ajustado de R$ ${(existing.valorFinal || 0).toFixed(2)} para R$ ${updates.valorFinal.toFixed(2)}.`;
      } else if (updates.comprovanteUrl && updates.comprovanteUrl !== existing.comprovanteUrl) {
        acao = 'anexou comprovante de pagamento';
        detalhes = 'Comprovante anexado pelo operador.';
      }

      if (acao) {
        const newEntry = {
          id: Database.generateId('HST'),
          dataHora: timeStr,
          usuario: editorUser,
          perfil: editorPerfil,
          acao,
          detalhes,
        };
        // Keep newest at the top of history
        updatedHistory = [newEntry, ...updatedHistory];
      }
    }

    const wasOrcamento = Boolean(
      existing.tipoDocumento === 'ORCAMENTO' ||
      existing.isOrcamento ||
      existing.codigo?.toUpperCase().startsWith('ORC')
    );

    const isTransformingToOs =
      wasOrcamento &&
      (updates.tipoDocumento === 'OS' || (updates.isOrcamento === false && updates.tipoDocumento !== 'ORCAMENTO'));

    if (isTransformingToOs) {
      // Regra de Não Regressão e Sequencialidade Estrita:
      // Quando for transformado ORC para OS, siga SEMPRE o código de sequência da OS e NUNCA da ORC!
      const currentOsCode = updates.codigo?.toUpperCase();
      const isCandidateValidOs = Boolean(
        currentOsCode &&
        currentOsCode.startsWith('OS') &&
        !this.isCodeAlreadyUsed(currentOsCode, id) &&
        currentOsCode !== existing.codigo?.toUpperCase()
      );

      // Se o código não for OS, ou já estiver em uso, ou derivado de ORC, gera estritamente a sequência oficial de OS
      if (!isCandidateValidOs) {
        updates.codigo = this.generateOsCode();
      }
      updates.tipoDocumento = 'OS';
      updates.isOrcamento = false;
      if (!updates.status || (updates.status as any) === 'Orçamento Criado') {
        updates.status = 'Aberta';
      }
      if (!updates.situacao || (updates.situacao as any) === 'Orçamento Criado') {
        updates.situacao = 'Aberta';
      }
      if ((updates.estagioAtual as any) === 'Orçamento' || updates.estagioAtual === 'Sistema' || !updates.estagioAtual) {
        const flow = existing.fluxoProducao || [];
        const firstProd = flow.includes('Designer') ? 'Designer' : (flow.find((s) => s !== 'Sistema') || 'Impressão');
        updates.estagioAtual = firstProd;
      }
      if ((updates.paymentStatus as any) === 'orcamento') {
        updates.paymentStatus = 'pendente';
      }
      if ((updates.formaPagamento as any) === 'Orçamento') {
        updates.formaPagamento = 'PIX';
      }
    } else {
      // Cláusula de Não Regressão e Integridade Sequencial:
      // Se a OS já existe e não é uma transformação de ORC para OS, seu código é estritamente imutável!
      if (existing.codigo) {
        updates.codigo = existing.codigo;
      }
    }

    const updated: OrdemServico = {
      ...existing,
      ...updates,
      historicoEdicoes: updatedHistory,
      updatedAt: Database.nowISO(),
      version: existing.version + 1,
    };

    this.db.ordensServico.set(id, updated);
    return updated;
  }

  /**
   * Transforma um Orçamento em Ordem de Serviço seguindo estritamente a sequência da OS e nunca da ORC
   */
  public static transformOrcToOs(
    id: string,
    options?: {
      operator?: string;
      editorPerfil?: string;
      superiorAuth?: any;
    }
  ): OrdemServico {
    const existing = this.getOsById(id);
    if (!existing) {
      throw new Error('Orçamento não encontrado para transformação.');
    }

    // Regra: gerar rigorosamente o próximo código sequencial oficial de OS
    const newOsCode = this.generateOsCode();

    const now = new Date();
    const nowISO = now.toISOString();
    const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const operator = options?.operator || existing.operador || 'VENDEDOR';
    const perfil = options?.editorPerfil || 'Operador';
    const superiorAuth = options?.superiorAuth;

    const authSuffix = superiorAuth
      ? `com autorização de Superior (${superiorAuth.superiorRole || 'Superior'}: ${superiorAuth.superiorName || 'Direção'})`
      : `pelo operador (${operator})`;

    const defaultFluxo: ProductionStage[] = [
      'Designer',
      'Impressão',
      'Calandra',
      'Costura',
      'RETIRADA(Recepção)',
    ];

    const effectiveFluxoRaw = existing.fluxoProducao && existing.fluxoProducao.length > 0
      ? [...existing.fluxoProducao]
      : [...defaultFluxo];

    const hasNewOrCustomDest = effectiveFluxoRaw.some((s) =>
      ['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)', 'Excursão', 'Correios', 'Shopee', 'Retirada (Recepção)'].includes(s as string)
    );
    if (!hasNewOrCustomDest && effectiveFluxoRaw.length > 0 && !effectiveFluxoRaw.includes('Conferência')) {
      const expIdx = effectiveFluxoRaw.findIndex((s) => s === 'Expedição' || s === 'Entrega' || s === 'Concluído');
      if (expIdx >= 0) {
        effectiveFluxoRaw.splice(expIdx, 0, 'Conferência');
      } else {
        effectiveFluxoRaw.push('Conferência');
      }
    }
    const effectiveFluxo = effectiveFluxoRaw;

    const firstProductionStage: ProductionStage = effectiveFluxo.includes('Designer')
      ? 'Designer'
      : (effectiveFluxo.find((s) => s !== 'Sistema') || 'Impressão');

    const transformHistoryEntry = {
      id: Database.generateId('HST'),
      dataHora: dataHoraStr,
      usuario: operator,
      perfil,
      acao: 'transformou Orçamento em Ordem de Serviço',
      detalhes: `Transformou o Orçamento ${existing.codigo} na Ordem de Serviço ${newOsCode} ${authSuffix}. Sequência de numeração oficial de OS rigorosamente aplicada. Enviada simultaneamente para Conferência, Controle de Expedição e Produção [${firstProductionStage}].`,
    };

    const updatedHistory = [transformHistoryEntry, ...(existing.historicoEdicoes || [])];

    const setorAceitoPorUpdates = [...(existing.setorAceitoPor || [])];
    setorAceitoPorUpdates.push({
      estagio: 'Sistema' as ProductionStage,
      descricaoEtapa: 'Transformação de Orçamento em OS',
      funcionario: operator,
      aceitoEm: `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      aceitoEmISO: nowISO,
      status: 'Concluído' as const,
      concluidoEm: `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      concluidoEmISO: nowISO,
      observacao: `Orçamento ${existing.codigo} transformado na Ordem de Serviço ${newOsCode} ${authSuffix}. Encaminhado simultaneamente para a Conferência, o Controle de Expedição e o Fluxo de Produção.`,
    });

    const transformed: OrdemServico = {
      ...existing,
      codigo: newOsCode,
      tipoDocumento: 'OS',
      isOrcamento: false,
      fluxoProducao: effectiveFluxo,
      estagioAtual: existing.estagioAtual && (existing.estagioAtual as any) !== 'Orçamento' && existing.estagioAtual !== 'Sistema' ? existing.estagioAtual : firstProductionStage,
      status: 'Aberta',
      situacao: 'Aberta',
      paymentStatus: (existing.paymentStatus as any) === 'orcamento' ? 'pendente' : (existing.paymentStatus || 'pendente'),
      formaPagamento: (existing.formaPagamento as any) === 'Orçamento' ? 'PIX' : (existing.formaPagamento || 'PIX'),
      historicoEdicoes: updatedHistory,
      setorAceitoPor: setorAceitoPorUpdates,
      updatedBy: operator,
      updatedAt: nowISO,
      version: existing.version + 1,
    };

    this.db.ordensServico.set(id, transformed);
    return transformed;
  }

  public static deleteOs(id: string, passwordConfirm?: string): boolean {
    const existing = this.getOsById(id);
    if (!existing) {
      throw new Error('Ordem de Serviço não encontrada.');
    }
    const now = Database.nowISO();
    existing.deletedAt = now;
    existing.deletedBy = passwordConfirm || 'Operador';
    this.db.ordensServico.set(id, existing);

    // Soft-delete todas as transações de pagamento vinculadas a esta OS
    for (const tx of this.db.pdvTransactions.values()) {
      if (tx.osId === id || (existing.codigo && tx.osCodigo === existing.codigo)) {
        tx.deletedAt = now;
        tx.deletedBy = passwordConfirm || 'Operador';
        this.db.pdvTransactions.set(tx.id, tx);
      }
    }

    return true;
  }

  // --- PDV TRANSACTIONS ---
  public static createPdvTransaction(data: Omit<PdvTransaction, 'id' | 'codigoVenda' | 'data' | 'hora' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'version'> & { codigoVenda?: string }): PdvTransaction {
    const id = Database.generateId('PDV');
    const isOs = Boolean(data.osId || (data.osCodigo && data.osCodigo.toUpperCase().startsWith('OS')));
    let codigoVenda = data.codigoVenda;
    if (codigoVenda) {
      codigoVenda = codigoVenda.replace(/^CDV-?VND/i, 'VND');
    }
    if (!codigoVenda) {
      codigoVenda = isOs ? this.generateCdvCode() : this.generatePdvCode();
    } else if (isOs && !codigoVenda.toUpperCase().startsWith('CDV')) {
      codigoVenda = codigoVenda.replace(/^(VND|PDV)-?/i, 'CDV');
    }
    if (codigoVenda) {
      codigoVenda = codigoVenda.replace(/^CDV-?VND/i, 'VND');
    }

    const now = new Date();
    const nowISO = Database.nowISO();

    const dataFormatted = now.toLocaleDateString('pt-BR');
    const horaFormatted = now.toLocaleTimeString('pt-BR');

    const newTx: PdvTransaction = {
      ...data,
      id,
      codigoVenda,
      vendedorNome: (data as any).vendedorNome || data.operador,
      filialId: (data as any).filialId,
      filialNome: (data as any).filialNome,
      data: dataFormatted,
      hora: horaFormatted,
      createdAt: nowISO,
      updatedAt: nowISO,
      createdBy: data.operador,
      updatedBy: data.operador,
      status: data.status || 'pago',
      version: 1,
    };

    this.db.pdvTransactions.set(id, newTx);

    // If linked to OS, update OS payment status & linkage
    if (data.osId) {
      const os = this.getOsById(data.osId);
      if (os) {
        os.paymentStatus = data.status === 'pago' ? 'pago' : 'pendente';
        os.pdvTransactionId = id;
        // Advance current stage from 'Sistema' to next selected stage (e.g. 'Designer')
        if (os.fluxoProducao && os.fluxoProducao.length > 1 && os.estagioAtual === 'Sistema') {
          os.estagioAtual = os.fluxoProducao[1];
        }
        this.db.ordensServico.set(os.id, os);
      }
    }

    return newTx;
  }

  public static listPdvTransactions(): PdvTransaction[] {
    return Array.from(this.db.pdvTransactions.values())
      .filter((tx) => !tx.deletedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
