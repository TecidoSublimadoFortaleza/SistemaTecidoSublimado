const fs = require('fs');
const filePath = '/app/applet/src/components/produtosVenda/ProdutosVendaModuleView.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add state historyModalProduct
if (!code.includes('historyModalProduct')) {
  code = code.replace(
    'const [pdfViewerModal, setPdfViewerModal] = useState<{ title: string; url: string } | null>(null);',
    'const [pdfViewerModal, setPdfViewerModal] = useState<{ title: string; url: string } | null>(null);\n  const [historyModalProduct, setHistoryModalProduct] = useState<ProductCatalog | null>(null);'
  );
}

// 2. Set default sortBy to CODIGO
code = code.replace(
  "const [sortBy, setSortBy] = useState<string>('ULTIMOS_CADASTRADOS');",
  "const [sortBy, setSortBy] = useState<string>('CODIGO');"
);

// 3. Update handleSaveProduct dates
if (!code.includes('const nowIso = new Date().toISOString();')) {
  code = code.replace(
    'const payload: Partial<ProductCatalog> = {',
    'const nowIso = new Date().toISOString();\n    const payload: Partial<ProductCatalog> = {\n      updatedAt: nowIso,'
  );
  code = code.replace(
    'payload.historicoAlteracoes = [newHistoryEntry];',
    'payload.createdAt = nowIso;\n        payload.historicoAlteracoes = [newHistoryEntry];'
  );
}

// 4. Update sortedProducts
const oldSortMarker = '  // Ordenação\n  const sortedProducts = useMemo(() => {';
if (code.includes(oldSortMarker)) {
  const newSortBlock = `  // Ordenação dos Produtos de Venda
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (sortBy === 'CODIGO') {
      list.sort((a, b) => {
        const codeA = (a.codigo || a.sku || '').toString().trim();
        const codeB = (b.codigo || b.sku || '').toString().trim();
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });
    } else if (sortBy === 'ULTIMOS_CADASTRADOS') {
      list.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.id ? Number(a.id) || 0 : 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.id ? Number(b.id) || 0 : 0);
        if (timeA !== timeB) return timeB - timeA;
        return (b.id || '').localeCompare(a.id || '');
      });
    } else if (sortBy === 'EDICOES_ALTERACOES') {
      list.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (timeA !== timeB) return timeB - timeA;
        return (b.id || '').localeCompare(a.id || '');
      });
    } else if (sortBy === 'ALFABETICA') {
      list.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));
    } else if (sortBy === 'MENOR_ESTOQUE') {
      list.sort((a, b) => (a.estoqueAtual ?? 0) - (b.estoqueAtual ?? 0));
    } else if (sortBy === 'MAIOR_ESTOQUE') {
      list.sort((a, b) => (b.estoqueAtual ?? 0) - (a.estoqueAtual ?? 0));
    }
    return list;
  }, [filteredProducts, sortBy]);`;

  const oldSortFull = code.substring(
    code.indexOf('  // Ordenação\n  const sortedProducts = useMemo'),
    code.indexOf('  // Paginação\n  const totalPages')
  );
  code = code.replace(oldSortFull, newSortBlock + '\n\n');
}

// 5. Section Header for Relação produtos e histórico
const oldHeaderMarker = '{/* PAINEL DE BUSCA E LISTAGEM DE PRODUTOS DE VENDA */}';
if (code.includes(oldHeaderMarker)) {
  const newPanelHeader = `{/* PAINEL DE BUSCA E LISTAGEM DE PRODUTOS DE VENDA - RELAÇÃO PRODUTOS E HISTÓRICO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* CABEÇALHO DA SEÇÃO: RELAÇÃO PRODUTOS E HISTÓRICO */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 rounded-xl border border-blue-400/30 text-blue-300 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
                <span>Relação produtos e histórico</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/30 text-blue-200 border border-blue-400/30 tracking-wider">
                  Catálogo Comercial
                </span>
              </h2>
              <p className="text-xs text-blue-200/80 font-medium">
                Catálogo ordenado dos produtos de venda com suporte a ordens por código, últimos cadastros e edições/alterações.
              </p>
            </div>
          </div>

          {/* BOTÕES DE ATALHO DE ORDENAÇÃO NO TOPO */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-extrabold text-blue-200/80 uppercase tracking-wider mr-1">
              Ordenar por:
            </span>
            <button
              type="button"
              onClick={() => { setSortBy('CODIGO'); setCurrentPage(1); }}
              className={\`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 \${
                sortBy === 'CODIGO'
                  ? 'bg-blue-600 text-white shadow-md border border-blue-400'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }\`}
            >
              <span>Por Código</span>
            </button>
            <button
              type="button"
              onClick={() => { setSortBy('ULTIMOS_CADASTRADOS'); setCurrentPage(1); }}
              className={\`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 \${
                sortBy === 'ULTIMOS_CADASTRADOS'
                  ? 'bg-blue-600 text-white shadow-md border border-blue-400'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }\`}
            >
              <span>Últimos Cadastrados</span>
            </button>
            <button
              type="button"
              onClick={() => { setSortBy('EDICOES_ALTERACOES'); setCurrentPage(1); }}
              className={\`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 \${
                sortBy === 'EDICOES_ALTERACOES'
                  ? 'bg-blue-600 text-white shadow-md border border-blue-400'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }\`}
            >
              <span>Edições / Alterações</span>
            </button>
          </div>
        </div>`;

  code = code.replace('{/* PAINEL DE BUSCA E LISTAGEM DE PRODUTOS DE VENDA */}\n      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">', newPanelHeader);
}

// 6. Update Sort Select Dropdown Options
const oldSortSelect = `{/* Ordenação */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
            >
              <option value="ULTIMOS_CADASTRADOS">Últimos Cadastrados</option>
              <option value="ALFABETICA">Ordem Alfabética</option>
              <option value="MENOR_ESTOQUE">Menor Estoque</option>
              <option value="MAIOR_ESTOQUE">Maior Estoque</option>
            </select>`;

const newSortSelect = `{/* Ordenação */}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
            >
              <option value="CODIGO">Ordem por Código</option>
              <option value="ULTIMOS_CADASTRADOS">Últimos Cadastrados</option>
              <option value="EDICOES_ALTERACOES">Edições / Alterações</option>
              <option value="ALFABETICA">Ordem Alfabética</option>
              <option value="MENOR_ESTOQUE">Menor Estoque</option>
              <option value="MAIOR_ESTOQUE">Maior Estoque</option>
            </select>`;

code = code.replace(oldSortSelect, newSortSelect);

// 7. Add History Icon Button in Table Row
const oldEyeButton = `<button
                            type="button"
                            onClick={() => setSpecModalProduct(p)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Ficha Técnica Rápida"
                          >
                            <Eye className="w-4 h-4" />
                          </button>`;

const newEyeButton = `<button
                            type="button"
                            onClick={() => setHistoryModalProduct(p)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                            title="Ver Histórico de Alterações / Movimentações"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSpecModalProduct(p)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Ficha Técnica Rápida"
                          >
                            <Eye className="w-4 h-4" />
                          </button>`;

code = code.replace(oldEyeButton, newEyeButton);

// 8. Add History Modal at bottom of component jsx
if (!code.includes('MODAL DE HISTÓRICO DE ALTERAÇÕES E MOVIMENTAÇÕES')) {
  const modalCode = `
      {/* MODAL DE HISTÓRICO DE ALTERAÇÕES E MOVIMENTAÇÕES */}
      {historyModalProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    Histórico do Produto: {historyModalProduct.codigo}
                  </h2>
                  <p className="text-xs text-slate-500 font-bold">
                    {historyModalProduct.descricao}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {!historyModalProduct.historicoAlteracoes || historyModalProduct.historicoAlteracoes.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-8">
                  Nenhum registro de histórico gravado para este produto de venda.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {historyModalProduct.historicoAlteracoes.map((h, idx) => (
                    <div key={h.id || idx} className="py-3 space-y-1">
                      <div className="flex items-center justify-between font-extrabold text-slate-800">
                        <span className="flex items-center gap-1.5 text-blue-600 font-bold">
                          <Tag className="w-3.5 h-3.5" />
                          {h.acao}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {h.dataHora}
                        </span>
                      </div>
                      <p className="text-slate-600 font-medium text-xs">
                        {h.detalhes}
                      </p>
                      {h.operador && (
                        <p className="text-[11px] text-slate-400 font-bold">
                          Operador: {h.operador}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setHistoryModalProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}
`;

  const lastDivIndex = code.lastIndexOf('</div>');
  if (lastDivIndex !== -1) {
    code = code.substring(0, lastDivIndex) + modalCode + '\n    </div>' + code.substring(lastDivIndex + 6);
  }
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Update script executed successfully.');
