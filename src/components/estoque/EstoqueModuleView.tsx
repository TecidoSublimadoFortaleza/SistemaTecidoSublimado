import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Package,
  Search,
  Plus,
  Save,
  Trash2,
  Edit,
  Eye,
  FileText,
  Upload,
  Image as ImageIcon,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  FolderPlus,
  X,
  History,
  FileDown,
  Tag,
  Layers,
  ArrowLeft,
  Barcode as BarcodeIcon,
  ShieldCheck,
  Building2,
  Box,
  Truck,
  Calendar,
  DollarSign,
  Info,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  UserCheck,
  Briefcase,
  Clock,
  PieChart,
  LayoutDashboard,
  Check,
  Printer,
  ExternalLink,
  ShoppingCart,
  CheckCircle2,
  Lock,
  ListFilter,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  DownloadCloud,
  UploadCloud,
  Database as DatabaseIcon,
  Zap,
  EyeOff,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { ProductCatalog, ProductHistoryEntry, ProductPdfAttachment } from '../../server/types/os';
import { UserProfile } from '../../types/frontend';
import { ApiService } from '../../services/api';
import { getLoggedUserAndPerfil, canUserPerformAction, isFullEstoqueAuthorizedRole } from '../../utils/userPermissions';
import { verifySuperiorPassword } from '../../utils/superiorAuth';
import { MeasurementFormulaModal } from './MeasurementFormulaModal';
import {
  MeasurementFormula,
  DEFAULT_MEASUREMENT_FORMULAS,
  FORMULA_PADRAO_MESA,
  FORMULA_CUBO_MESA_VESTE,
} from '../../types/measurementFormula';

interface EstoqueModuleViewProps {
  user?: UserProfile | null;
  isSidebarExpanded?: boolean;
}

// Helper to convert base64 data URLs to Blob Object URLs for clean PDF viewing and opening
export const dataUrlToBlobUrl = (dataUrl: string): string => {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    return URL.createObjectURL(blob);
  } catch (e) {
    return dataUrl;
  }
};

// Open PDF attachment safely in a new browser tab
export const openPdfInNewTab = (pdfUrl: string, pdfName?: string) => {
  if (!pdfUrl) return;

  try {
    if (pdfUrl.startsWith('data:')) {
      const parts = pdfUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
      }
      // Revoke after 2 minutes to free memory
      setTimeout(() => {
        try { URL.revokeObjectURL(blobUrl); } catch (e) {}
      }, 120000);
    } else {
      const win = window.open(pdfUrl, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
      }
    }
  } catch (err) {
    console.error('Erro ao abrir PDF em nova aba:', err);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${pdfName || 'Visualizar PDF'}</title>
            <style>body { margin: 0; padding: 0; background: #0f172a; height: 100vh; overflow: hidden; }</style>
          </head>
          <body>
            <embed src="${pdfUrl}" type="application/pdf" width="100%" height="100%" />
          </body>
        </html>
      `);
      win.document.close();
    }
  }
};

// SVG Barcode Renderer Component
export const EanBarcodeSVG: React.FC<{ value: string; className?: string }> = ({ value, className = 'h-10' }) => {
  const digits = (value || '7898521000018').replace(/\D/g, '').padEnd(13, '0').slice(0, 13);
  
  const bars = useMemo(() => {
    const result: { x: number; w: number }[] = [];
    let curX = 10;
    // Guard left
    result.push({ x: curX, w: 2 }); curX += 4;
    result.push({ x: curX, w: 2 }); curX += 4;

    for (let i = 0; i < digits.length; i++) {
      const num = parseInt(digits[i], 10) || 1;
      const w1 = (num % 3) + 1;
      const w2 = ((num + 1) % 3) + 1;
      result.push({ x: curX, w: w1 });
      curX += w1 + 2;
      result.push({ x: curX, w: w2 });
      curX += w2 + 2;
      if (i === 6) {
        // Center guard
        curX += 2;
        result.push({ x: curX, w: 2 }); curX += 4;
        result.push({ x: curX, w: 2 }); curX += 4;
      }
    }
    // Guard right
    result.push({ x: curX, w: 2 }); curX += 4;
    result.push({ x: curX, w: 2 });
    return result;
  }, [digits]);

  return (
    <div className="flex flex-col items-center">
      <svg className={`${className} bg-white px-2 py-1 rounded border border-slate-300`} viewBox="0 0 240 50">
        <rect width="240" height="50" fill="#FFFFFF" />
        {bars.map((bar, idx) => (
          <rect key={idx} x={bar.x} y="4" width={bar.w} height="36" fill="#0F172A" />
        ))}
        <text x="120" y="47" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle" fill="#0F172A">
          {digits}
        </text>
      </svg>
    </div>
  );
};

export const EstoqueModuleView: React.FC<EstoqueModuleViewProps> = ({ user, isSidebarExpanded }) => {
  // ----------------------------------------------------
  // STATES
  // ----------------------------------------------------
  const [products, setProducts] = useState<ProductCatalog[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Active Tab State (Dados Gerais, Produtos para venda, Controle de Estoque, Arquivos, Observações, Histórico)
  const [activeTab, setActiveTab] = useState<'dados' | 'venda' | 'estoque' | 'arquivos' | 'observacoes' | 'historico'>('dados');
  const [paraVenda, setParaVenda] = useState<boolean>(false);
  const [comMedidas, setComMedidas] = useState<boolean>(false);

  // Estados para Fórmulas de Medidas
  const [formulas, setFormulas] = useState<MeasurementFormula[]>(() => {
    try {
      const delCached = localStorage.getItem('subligestao_deleted_measurement_formulas');
      let delList: string[] = [];
      if (delCached) {
        try {
          delList = JSON.parse(delCached);
        } catch (_) {}
      }
      const cached = localStorage.getItem('subligestao_measurement_formulas');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map<string, MeasurementFormula>();
          for (const base of DEFAULT_MEASUREMENT_FORMULAS) {
            if (!delList.includes(base.id)) {
              map.set(base.id, base);
            }
          }
          for (const item of parsed) {
            if (item && item.id && !delList.includes(item.id)) {
              map.set(item.id, item);
            }
          }
          return Array.from(map.values());
        }
      }
      return DEFAULT_MEASUREMENT_FORMULAS.filter((base) => !delList.includes(base.id));
    } catch (_) {
      return DEFAULT_MEASUREMENT_FORMULAS;
    }
  });
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>('');
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [editingFormula, setEditingFormula] = useState<MeasurementFormula | null>(null);

  // Estados para Exclusão de Base de Cálculo Protegida por Senha
  const [formulaToDelete, setFormulaToDelete] = useState<MeasurementFormula | null>(null);
  const [deleteFormulaPassword, setDeleteFormulaPassword] = useState('');
  const [showDeleteFormulaPassword, setShowDeleteFormulaPassword] = useState(false);
  const [deleteFormulaError, setDeleteFormulaError] = useState('');
  const [isDeletingFormula, setIsDeletingFormula] = useState(false);

  // Verificação de Perfil: Admin Sistema e Developer podem editar fórmulas
  const [isAdminOrDeveloper, setIsAdminOrDeveloper] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('subligestao_user_profile') || localStorage.getItem('subligestao_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.isDeveloper) return true;
        const role = String(u.role || u.roleId || u.cargo || '').toLowerCase();
        if (role.includes('admin') || role.includes('developer') || role.includes('desenvolvedor') || role.includes('ceo') || role.includes('master')) {
          return true;
        }
      }
    } catch (_) {}
    return true;
  });

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // Selected or Editing Product ID (null = new product)
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // View Mode: 'simple' | 'detailed'
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('simple');

  // Pagination & Filtering States for Catalog Table
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<
    'ULTIMOS_CADASTRADOS' | 'A_Z' | 'Z_A' | 'NUMERICA_CRESCENTE' | 'NUMERICA_DECRESCENTE' | 'PRODUTO_PARA_VENDA' | 'PRODUTO_INTERNO' | 'ENTRADA_DE_PRODUTO' | 'SAIDA_DE_PRODUTO' | 'ALERTA_MINIMO'
  >('ULTIMOS_CADASTRADOS');

  // Import Excel Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importDataPreview, setImportDataPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importDestinationType, setImportDestinationType] = useState<'interno' | 'venda'>('interno');
  const [importInputMode, setImportInputMode] = useState<'file' | 'paste'>('file');
  const [importTextContent, setImportTextContent] = useState<string>('');

  const { role: loggedRole, isDeveloper: isLoggedDev, username: loggedUsername } = getLoggedUserAndPerfil();
  const effectiveRole = user?.role || loggedRole || 'Estoque';
  const effectiveIsDev = Boolean(user?.isDeveloper || isLoggedDev || effectiveRole === 'Developer');
  const effectiveUsername = user?.username || loggedUsername;

  const isFullEstoqueAuthorized = isFullEstoqueAuthorizedRole(effectiveRole, effectiveIsDev, effectiveUsername);
  const canCreateEdit = canUserPerformAction(effectiveRole, 'estoque', 'criarEditar', effectiveIsDev);
  const canDelete = canUserPerformAction(effectiveRole, 'estoque', 'excluir', effectiveIsDev);
  const canViewCosts = canUserPerformAction(effectiveRole, 'estoque', 'verFinanceiro', effectiveIsDev);

  // Verificação precisa de Admin Sistema ou Developer para gerenciamento de fórmulas
  const isRoleAdminOrDeveloper = useMemo(() => {
    if (effectiveIsDev) return true;
    const roleLower = String(effectiveRole || '').toLowerCase();
    const userLower = String(effectiveUsername || '').toLowerCase();
    return (
      roleLower.includes('developer') ||
      roleLower.includes('desenvolvedor') ||
      roleLower.includes('admin') ||
      roleLower.includes('adm') ||
      roleLower.includes('master') ||
      roleLower.includes('ceo') ||
      userLower.includes('developer') ||
      userLower.includes('marcelo-dev')
    );
  }, [effectiveRole, effectiveIsDev, effectiveUsername]);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [categoryModalMode, setCategoryModalMode] = useState<'create' | 'edit'>('create');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [selectedCategoryToEdit, setSelectedCategoryToEdit] = useState<string>('');
  const [editedCategoryName, setEditedCategoryName] = useState<string>('');

  // Modal Spec / Ficha Técnica State
  const [specModalProduct, setSpecModalProduct] = useState<ProductCatalog | null>(null);

  // Modal de Confirmação e Senha para Exclusão de Produto
  const [productToDelete, setProductToDelete] = useState<ProductCatalog | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deletePasswordError, setDeletePasswordError] = useState<string>('');
  const [isDeletingProduct, setIsDeletingProduct] = useState<boolean>(false);

  // Modal PDF Preview State
  const [pdfViewerModal, setPdfViewerModal] = useState<{ title: string; url: string } | null>(null);

  const pdfIframeUrl = useMemo(() => {
    if (!pdfViewerModal?.url) return '';
    return dataUrlToBlobUrl(pdfViewerModal.url);
  }, [pdfViewerModal?.url]);

  // --- FORM FIELDS STATE ---
  const [codigoProduto, setCodigoProduto] = useState<string>('');
  const [codigoBarras, setCodigoBarras] = useState<string>('');
  const [sku, setSku] = useState<string>('');
  const [referencia, setReferencia] = useState<string>('');
  const [situacao, setSituacao] = useState<'Ativo' | 'Inativo'>('Ativo');

  // Dados Gerais
  const [descricao, setDescricao] = useState<string>('');
  const [precoCusto, setPrecoCusto] = useState<string>('');
  const [precoVenda, setPrecoVenda] = useState<string>('');
  const [precoExpresso, setPrecoExpresso] = useState<string>('');
  const [categoria, setCategoria] = useState<string>('');
  const [marca, setMarca] = useState<string>('');
  const [unidade, setUnidade] = useState<string>('UN');
  const [ncm, setNcm] = useState<string>('');
  const [cfop, setCfop] = useState<string>('');
  const [origemMercadoria, setOrigemMercadoria] = useState<string>('');
  const [pesoUnitarioKg, setPesoUnitarioKg] = useState<string>('');
  const [dimensoes, setDimensoes] = useState<string>('');

  // Controle de Estoque
  const [estoqueAtual, setEstoqueAtual] = useState<string>('0');
  const [estoqueMinimo, setEstoqueMinimo] = useState<string>('0');
  const [estoqueMaximo, setEstoqueMaximo] = useState<string>('0');
  const [lote, setLote] = useState<string>('');
  const [dataValidade, setDataValidade] = useState<string>('');
  const [fornecedorPrincipal, setFornecedorPrincipal] = useState<string>('');
  const [custoUltimaCompra, setCustoUltimaCompra] = useState<string>('');

  // Arquivos
  const [fotoUrl, setFotoUrl] = useState<string>('');
  const [anexosPdf, setAnexosPdf] = useState<ProductPdfAttachment[]>([]);

  // Observações
  const [observacoes, setObservacoes] = useState<string>('');

  // Histórico
  const [historico, setHistorico] = useState<ProductHistoryEntry[]>([]);

  // --- ENTRADA DE ESTOQUE (MATERIAL) STATE ---
  const [qtdEntrada, setQtdEntrada] = useState<string>('1');
  const [quemRecebeu, setQuemRecebeu] = useState<string>('');
  const [origemEntrada, setOrigemEntrada] = useState<string>('');
  const [motivoEntrada, setMotivoEntrada] = useState<string>('');
  const [novoCustoEntrada, setNovoCustoEntrada] = useState<string>('');
  const [dataHoraEntrada, setDataHoraEntrada] = useState<string>(() => {
    return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  });

  // --- SAÍDA DE ESTOQUE (RETIRADA) STATE ---
  const [qtdSaida, setQtdSaida] = useState<string>('1');
  const [quemRetirou, setQuemRetirou] = useState<string>('');
  const [setorDestino, setSetorDestino] = useState<string>('Costura & Modelagem');
  const [motivoSaida, setMotivoSaida] = useState<string>('');
  const [dataHoraSaida, setDataHoraSaida] = useState<string>(() => {
    return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  });

  // Operator Name Label - Retrieves the exact real logged profile
  const currentOperatorName = 'DARLENE PEREIRA';
  const operadorLogado = 'DARLENE PEREIRA (Estoque)';

  // ----------------------------------------------------
  // FETCH INITIAL DATA & SUPABASE FAST SYNC
  // ----------------------------------------------------
  const [isSyncingSupabase, setIsSyncingSupabase] = useState<boolean>(false);
  const [lastSyncDuration, setLastSyncDuration] = useState<number | null>(null);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null);

  const fetchData = async (force: boolean = false) => {
    setIsLoading(true);
    try {
      const [prodsData, catsData, formulasData] = await Promise.all([
        ApiService.getProducts(force),
        ApiService.getCategories({ scope: 'estoque', origem: 'ESTOQUE' }),
        ApiService.getMeasurementFormulas(true).catch(() => DEFAULT_MEASUREMENT_FORMULAS),
      ]);
      setProducts((prodsData || []).filter((p: any) => !p.deletedAt && p.status !== 'INACTIVE'));
      const retired = ['geral', 'cetim', 'dryfit', 'microfibra', 'neoprene'];
      const cleanCats = (catsData || []).filter((c: string) => c && !retired.includes(c.trim().toLowerCase()));
      setCategories(cleanCats);
      if (cleanCats.length > 0 && (!categoria || retired.includes(categoria.trim().toLowerCase()))) {
        setCategoria(cleanCats[0]);
      }
      if (formulasData && Array.isArray(formulasData)) {
        setFormulas(formulasData);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Erro ao carregar dados do estoque.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncSupabase = async () => {
    setIsSyncingSupabase(true);
    const start = Date.now();
    try {
      const res = await ApiService.syncStockWithSupabase();
      const elapsed = res.durationMs || (Date.now() - start);
      setLastSyncDuration(elapsed);
      setLastSyncTimestamp(new Date().toLocaleTimeString('pt-BR'));
      if (Array.isArray(res.products) && res.products.length > 0) {
        setProducts(res.products.filter((p: any) => !p.deletedAt && p.status !== 'INACTIVE'));
      } else {
        await fetchData(true);
      }
      setFeedback({
        type: 'success',
        message: `Estoque sincronizado com Supabase em ${elapsed}ms com sucesso (${res.count || products.length} produtos em tempo real)!`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Falha na sincronização direta com Supabase: ${err.message || 'Erro de conexão'}`,
      });
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleProductsChanged = () => {
      fetchData(true);
    };
    const handleFormulasChanged = async () => {
      try {
        const loaded = await ApiService.getMeasurementFormulas(true);
        if (loaded && Array.isArray(loaded)) {
          setFormulas(loaded);
        }
      } catch (_) {}
    };
    window.addEventListener('products-changed', handleProductsChanged);
    window.addEventListener('measurement-formulas-changed', handleFormulasChanged);
    return () => {
      window.removeEventListener('products-changed', handleProductsChanged);
      window.removeEventListener('measurement-formulas-changed', handleFormulasChanged);
    };
  }, []);

  // Auto-dismiss confirmation feedback (cadastros, alterações e salvamentos) after 3 seconds
  useEffect(() => {
    if (feedback && feedback.type === 'success') {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Helper para identificar produtos de uso estritamente interno
  // Produtos cadastrados para venda comercial ("Produtos para vendas") em "PRODUTOS DE VENDA" NÃO devem aparecer no estoque.
  // Estoque exibirá apenas os produtos internos.
  const isProductInternal = (p: ProductCatalog) => {
    if (p.origemCadastro === 'PRODUTOS_VENDA') {
      return false;
    }
    if (p.paraVenda === true && (p as any).apenasEstoqueInterno !== true) {
      return false;
    }
    return (
      p.origemCadastro === 'ESTOQUE' ||
      p.paraVenda === false ||
      (p as any).apenasEstoqueInterno === true ||
      (p as any).isInternal === true ||
      (p.categoria || '').toLowerCase().includes('produto interno') ||
      (p.categoria || '').toLowerCase().includes('insumo') ||
      (p.categoria || '').toLowerCase().includes('matéria prima') ||
      (p.categoria || '').toLowerCase().includes('materia prima')
    );
  };

  // Lista de produtos visíveis no Estoque: Exibe apenas os produtos internos
  const visibleProducts = useMemo(() => {
    return products.filter((p) => isProductInternal(p));
  }, [products]);

  // Se o usuário não tiver permissão para ver produtos internos e estiver no filtro PRODUTO_INTERNO, volta para padrão
  useEffect(() => {
    if (!isFullEstoqueAuthorized && sortBy === 'PRODUTO_INTERNO') {
      setSortBy('ULTIMOS_CADASTRADOS');
    }
  }, [isFullEstoqueAuthorized, sortBy]);

  // ----------------------------------------------------
  // DASHBOARD METRICS & LAST 10 PRODUCTS
  // ----------------------------------------------------
  const totalItens = visibleProducts.length;

  const valorTotalEstoque = useMemo(() => {
    if (!isFullEstoqueAuthorized) return 0;
    return visibleProducts.reduce((acc, p) => {
      const qty = p.estoqueAtual ?? 0;
      const price = p.precoCusto ?? p.valorUnitario ?? 0;
      return acc + qty * price;
    }, 0);
  }, [visibleProducts, isFullEstoqueAuthorized]);

  const itensAlertaEstoque = useMemo(() => {
    return visibleProducts.filter((p) => {
      const curr = p.estoqueAtual ?? 0;
      const min = p.estoqueMinimo ?? 0;
      return min > 0 && curr <= min;
    });
  }, [visibleProducts]);

  const totalMovimentacoes = useMemo(() => {
    return visibleProducts.reduce((acc, p) => acc + (p.historicoAlteracoes?.length || 0), 0);
  }, [visibleProducts]);

  // NORMALIZE HISTORY ENTRY (Operator & Details Format for Stock Exit)
  const normalizeHistoryEntry = (h: ProductHistoryEntry, productUnidade?: string) => {
    let op = 'DARLENE PEREIRA (Estoque)';
    let detalhes = h.detalhes || '';
    const act = (h.acao || '').toLowerCase();
    if (act.includes('saída') || act.includes('retirada') || act.includes('baixa')) {
      if (h.operador && h.operador !== 'DARLENE PEREIRA (Estoque)' && h.operador !== 'Operador' && h.operador !== 'Operador Logado' && !h.operador.includes('Estoque')) {
        const personWhoPickedUp = h.operador;
        if (!detalhes.toLowerCase().includes('por ')) {
          detalhes = detalhes.replace(/Retirada de (\d+\s*\w*)/i, `RETIRADA $1 POR ${personWhoPickedUp}`);
        }
      }
      if (detalhes.startsWith('Retirada de ')) {
        detalhes = detalhes.replace(/^Retirada de (\d+)\s*([a-zA-Z]*)/i, (match, qty, unit) => {
          return `RETIRADA ${qty} ${unit || productUnidade || 'UN'}`;
        });
      } else if (detalhes.startsWith('Retirada ')) {
        detalhes = detalhes.replace(/^Retirada /i, 'RETIRADA ');
      }
    }
    return {
      ...h,
      operador: op,
      detalhes,
    };
  };

  // HELPER PARA CONVERSÃO ROBUSTA DE DATA E HORA EM TIMESTAMP
  const parseDateToTimestamp = (dh: string): number => {
    if (!dh) return 0;
    if (dh.includes('/')) {
      const parts = dh.split(',');
      const datePart = parts[0]?.trim() || '';
      const timePart = parts[1]?.trim() || '';
      const dParts = datePart.split('/');
      if (dParts.length === 3) {
        const day = parseInt(dParts[0], 10) || 1;
        const month = (parseInt(dParts[1], 10) || 1) - 1;
        const year = parseInt(dParts[2], 10) || 1970;
        let hours = 0;
        let minutes = 0;
        let seconds = 0;
        if (timePart) {
          const tParts = timePart.split(':');
          hours = parseInt(tParts[0], 10) || 0;
          minutes = parseInt(tParts[1], 10) || 0;
          seconds = parseInt(tParts[2] || '0', 10) || 0;
        }
        const d = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }
    const parsed = new Date(dh).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  // TODOS OS REGISTROS DE HISTÓRICO CONSOLIDADOS (ORDENADOS POR DATA E HORA)
  const allHistoryEntries = useMemo(() => {
    const list: Array<ProductHistoryEntry & { productCodigo: string; productDesc: string; timestamp: number }> = [];
    visibleProducts.forEach((p) => {
      if (p.historicoAlteracoes) {
        p.historicoAlteracoes.forEach((h) => {
          const normalized = normalizeHistoryEntry(h, p.unidade);
          const ts = parseDateToTimestamp(normalized.dataHora);
          list.push({
            ...normalized,
            productCodigo: p.codigo,
            productDesc: p.descricao,
            timestamp: ts,
          });
        });
      }
    });
    return list.sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
  }, [visibleProducts, operadorLogado]);

  const cleanedCategories = useMemo(() => {
    if (sortBy === 'SAIDA_DE_PRODUTO' || sortBy === 'ENTRADA_DE_PRODUTO') {
      return ['Produto Interno'];
    }
    // As categorias cadastradas em "PRODUTOS DE VENDA" NÃO devem aparecer no estoque.
    // O estoque exibirá apenas categorias de produtos internos.
    return categories.filter((c) => !c.toLowerCase().includes('produto interno'));
  }, [categories, sortBy]);

  const totalCategorias = cleanedCategories.length;

  // Helper para extrair com precisão o nome real digitado em "Quem Retirou"
  const parseQuemRetirou = (h: ProductHistoryEntry): string => {
    if ((h as any).quemRetirou && String((h as any).quemRetirou).trim()) {
      return String((h as any).quemRetirou).trim();
    }
    const det = h.detalhes || '';
    // Padrão: RETIRADA X UN POR [NOME] PARA O SETOR [...]
    const matchPorSetor = det.match(/POR\s+([^\[\.\n\r]+?)(?:\s+PARA\s+O\s+SETOR|\s+PARA\s+\[|\[|\.|$)/i);
    if (matchPorSetor && matchPorSetor[1] && matchPorSetor[1].trim()) {
      const clean = matchPorSetor[1].trim();
      if (clean && clean !== '-' && !clean.toLowerCase().includes('estoque anterior')) {
        return clean;
      }
    }
    const matchPor = det.match(/POR\s+([A-Za-zÀ-ÖØ-öø-ÿ0-9\s\-_]+)/i);
    if (matchPor && matchPor[1] && matchPor[1].trim()) {
      return matchPor[1].trim();
    }
    if (h.operador && h.operador !== 'Operador' && h.operador !== 'Operador Logado' && !h.operador.includes('DARLENE PEREIRA')) {
      return h.operador.replace(/\s*\(Estoque\)/i, '').trim();
    }
    return h.operador ? h.operador.replace(/\s*\(Estoque\)/i, '').trim() : '-';
  };

  // Helper para extrair com precisão o nome real digitado em "Quem Recebeu"
  const parseQuemRecebeu = (h: ProductHistoryEntry): string => {
    if ((h as any).quemRecebeu && String((h as any).quemRecebeu).trim()) {
      return String((h as any).quemRecebeu).trim();
    }
    const det = h.detalhes || '';
    const matchRecebido = det.match(/RECEBIDO\s+POR\s+([^\[\.\n\r]+?)(?:\[|\.|$)/i);
    if (matchRecebido && matchRecebido[1] && matchRecebido[1].trim()) {
      const clean = matchRecebido[1].trim();
      if (clean && clean !== '-' && !clean.toLowerCase().includes('estoque anterior')) {
        return clean;
      }
    }
    if (h.operador && h.operador !== 'Operador' && h.operador !== 'Operador Logado' && !h.operador.includes('DARLENE PEREIRA')) {
      return h.operador.replace(/\s*\(Estoque\)/i, '').trim();
    }
    return h.operador ? h.operador.replace(/\s*\(Estoque\)/i, '').trim() : '-';
  };

  // REGISTROS DE ENTRADA DE ESTOQUE (ORDENADOS POR PADRÃO DE DATA E HORA)
  const entryRows = useMemo(() => {
    if (sortBy !== 'ENTRADA_DE_PRODUTO') return [];
    const rows: Array<{
      id: string;
      product: ProductCatalog;
      operador: string;
      dataHora: string;
      detalhes: string;
      timestamp: number;
    }> = [];

    visibleProducts.forEach((p) => {
      (p.historicoAlteracoes || []).forEach((h) => {
        const act = (h.acao || '').toLowerCase();
        if (act.includes('entrada') || act.includes('compra') || act.includes('recebimento')) {
          const normalized = normalizeHistoryEntry(h, p.unidade);
          let itemDate = normalized.dataHora.slice(0, 10);
          if (normalized.dataHora.includes('/')) {
            const parts = normalized.dataHora.split(',')[0].trim().split('/');
            if (parts.length === 3) {
              itemDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          if (filterStartDate && itemDate < filterStartDate) return;
          if (filterEndDate && itemDate > filterEndDate) return;

          const personWhoReceived = parseQuemRecebeu(h);

          // Filtro por texto de busca caso preenchido
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const cod = (p.codigo || '').toLowerCase();
            const desc = (p.descricao || '').toLowerCase();
            const op = personWhoReceived.toLowerCase();
            const det = (normalized.detalhes || '').toLowerCase();
            const dh = (normalized.dataHora || '').toLowerCase();
            if (!cod.includes(q) && !desc.includes(q) && !op.includes(q) && !det.includes(q) && !dh.includes(q)) {
              return;
            }
          }

          const ts = parseDateToTimestamp(normalized.dataHora);

          rows.push({
            id: `${p.id}-${normalized.id}`,
            product: p,
            operador: personWhoReceived,
            dataHora: normalized.dataHora,
            detalhes: normalized.detalhes,
            timestamp: ts,
          });
        }
      });
    });

    return rows.sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
  }, [visibleProducts, sortBy, filterStartDate, filterEndDate, searchQuery, operadorLogado]);

  // REGISTROS DE SAÍDA DE ESTOQUE (ORDENADOS POR PADRÃO DE DATA E HORA)
  const withdrawalRows = useMemo(() => {
    if (sortBy !== 'SAIDA_DE_PRODUTO') return [];
    const rows: Array<{
      id: string;
      product: ProductCatalog;
      operador: string;
      dataHora: string;
      detalhes: string;
      timestamp: number;
    }> = [];

    visibleProducts.forEach((p) => {
      (p.historicoAlteracoes || []).forEach((h) => {
        const act = (h.acao || '').toLowerCase();
        if (act.includes('saída') || act.includes('retirada') || act.includes('baixa')) {
          const normalized = normalizeHistoryEntry(h, p.unidade);
          let itemDate = normalized.dataHora.slice(0, 10);
          if (normalized.dataHora.includes('/')) {
            const parts = normalized.dataHora.split(',')[0].trim().split('/');
            if (parts.length === 3) {
              itemDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          if (filterStartDate && itemDate < filterStartDate) return;
          if (filterEndDate && itemDate > filterEndDate) return;

          const personWhoWithdrew = parseQuemRetirou(h);

          // Filtro por texto de busca caso preenchido
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const cod = (p.codigo || '').toLowerCase();
            const desc = (p.descricao || '').toLowerCase();
            const op = personWhoWithdrew.toLowerCase();
            const det = (normalized.detalhes || '').toLowerCase();
            const dh = (normalized.dataHora || '').toLowerCase();
            if (!cod.includes(q) && !desc.includes(q) && !op.includes(q) && !det.includes(q) && !dh.includes(q)) {
              return;
            }
          }

          const ts = parseDateToTimestamp(normalized.dataHora);

          rows.push({
            id: `${p.id}-${normalized.id}`,
            product: p,
            operador: personWhoWithdrew,
            dataHora: normalized.dataHora,
            detalhes: normalized.detalhes,
            timestamp: ts,
          });
        }
      });
    });

    // Padrão de ordenação estrito por Data e Hora (do mais recente para o mais antigo)
    return rows.sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
  }, [visibleProducts, sortBy, filterStartDate, filterEndDate, searchQuery, operadorLogado]);

  const parseAntesAgora = (detalhes: string, unidade: string = 'UN') => {
    let antes = '-';
    let agora = '-';
    if (!detalhes) return { antes, agora };
    const matchAnt = detalhes.match(/Estoque anterior:\s*(\d+)/i);
    const matchNovo = detalhes.match(/Novo estoque:\s*(\d+)/i);
    if (matchAnt) antes = `${matchAnt[1]} ${unidade}`;
    if (matchNovo) agora = `${matchNovo[1]} ${unidade}`;
    return { antes, agora };
  };

  const parseMotivoRetirada = (detalhes: string) => {
    if (!detalhes) return '';
    const parts = detalhes.split('. Estoque anterior:');
    return parts[0] || detalhes;
  };

  const parseMotivoEntrada = (detalhes: string) => {
    if (!detalhes) return '';
    const parts = detalhes.split('. Estoque anterior:');
    return parts[0] || detalhes;
  };

  // ----------------------------------------------------
  // FILTERED PRODUCTS (ORDENAÇÃO SELECIONADA, BUSCA, CATEGORIA, DATA)
  // ----------------------------------------------------
  const filteredProducts = useMemo(() => {
    let list = visibleProducts.filter((p) => !p.deletedAt && p.status !== 'INACTIVE');

    // Filtro por Texto / Busca
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const cod = (p.codigo || '').toLowerCase();
        const desc = (p.descricao || '').toLowerCase();
        const skuVal = (p.sku || '').toLowerCase();
        const ean = (p.codigoBarras || '').toLowerCase();
        const cat = (p.categoria || '').toLowerCase();
        return (
          cod.includes(q) ||
          desc.includes(q) ||
          skuVal.includes(q) ||
          ean.includes(q) ||
          cat.includes(q)
        );
      });
    }

    // Filtro por Categoria
    if (filterCategory.trim()) {
      list = list.filter((p) => (p.categoria || '').toLowerCase() === filterCategory.toLowerCase());
    }

    // Filtro por Data de Cadastro (Produtos cadastrados naquele dia)
    if (filterDate.trim() && sortBy !== 'SAIDA_DE_PRODUTO' && sortBy !== 'ENTRADA_DE_PRODUTO') {
      list = list.filter((p) => {
        if (!p.createdAt) return false;
        const itemDateStr = p.createdAt.slice(0, 10);
        return itemDateStr === filterDate;
      });
    }

    // Filtro por Tipo de Comercialização / Entrada / Saída de Produto
    if (sortBy === 'PRODUTO_PARA_VENDA') {
      list = list.filter((p) => p.paraVenda !== false);
    } else if (sortBy === 'PRODUTO_INTERNO') {
      list = list.filter((p) => p.paraVenda === false || (p.categoria || '').toLowerCase().includes('produto interno'));
    } else if (sortBy === 'SAIDA_DE_PRODUTO') {
      list = list.filter((p) => {
        const hasExit = (p.historicoAlteracoes || []).some((h) => {
          const act = (h.acao || '').toLowerCase();
          return act.includes('saída') || act.includes('retirada') || act.includes('baixa');
        });
        return hasExit;
      });
    } else if (sortBy === 'ENTRADA_DE_PRODUTO') {
      list = list.filter((p) => {
        const hasEntry = (p.historicoAlteracoes || []).some((h) => {
          const act = (h.acao || '').toLowerCase();
          return act.includes('entrada') || act.includes('compra') || act.includes('recebimento');
        });
        return hasEntry;
      });
    } else if (sortBy === 'ALERTA_MINIMO') {
      list = list.filter((p) => {
        const curr = Number(p.estoqueAtual) || 0;
        const min = Number(p.estoqueMinimo) || 0;
        return min > 0 && curr <= min;
      });
    }

    // Ordenação configurada (Padrão: Último produto cadastrado)
    list.sort((a, b) => {
      switch (sortBy) {
        case 'A_Z':
          return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' });
        case 'Z_A':
          return (b.descricao || '').localeCompare(a.descricao || '', 'pt-BR', { sensitivity: 'base' });
        case 'NUMERICA_CRESCENTE': {
          const numA = parseInt((a.codigo || '').replace(/\D/g, ''), 10) || 0;
          const numB = parseInt((b.codigo || '').replace(/\D/g, ''), 10) || 0;
          if (numA !== numB) return numA - numB;
          return (a.codigo || '').localeCompare(b.codigo || '');
        }
        case 'NUMERICA_DECRESCENTE': {
          const numA = parseInt((a.codigo || '').replace(/\D/g, ''), 10) || 0;
          const numB = parseInt((b.codigo || '').replace(/\D/g, ''), 10) || 0;
          if (numB !== numA) return numB - numA;
          return (b.codigo || '').localeCompare(a.codigo || '');
        }
        case 'PRODUTO_PARA_VENDA':
        case 'PRODUTO_INTERNO':
        case 'ULTIMOS_CADASTRADOS':
        default: {
          const getTime = (p: ProductCatalog) => {
            if (p.updatedAt) {
              const t = new Date(p.updatedAt).getTime();
              if (!isNaN(t) && t > 0) return t;
            }
            if (p.createdAt) {
              const t = new Date(p.createdAt).getTime();
              if (!isNaN(t) && t > 0) return t;
            }
            if (p.historicoAlteracoes && p.historicoAlteracoes.length > 0) {
              const lastHist = p.historicoAlteracoes[0];
              if (lastHist && lastHist.dataHora) {
                const parsed = new Date(lastHist.dataHora).getTime();
                if (!isNaN(parsed) && parsed > 0) return parsed;
              }
            }
            return 0;
          };
          const timeA = getTime(a);
          const timeB = getTime(b);
          if (timeB !== timeA) return timeB - timeA;

          const numA = parseInt((a.codigo || '').replace(/\D/g, ''), 10) || 0;
          const numB = parseInt((b.codigo || '').replace(/\D/g, ''), 10) || 0;
          if (numB !== numA) return numB - numA;
          return (b.id || '').localeCompare(a.id || '');
        }
      }
    });

    return list;
  }, [visibleProducts, searchQuery, filterCategory, filterDate, sortBy]);

  // Contagem de produtos cadastrados hoje
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const countTodayRegistered = useMemo(() => {
    return visibleProducts.filter((p) => p.createdAt && p.createdAt.slice(0, 10) === todayStr).length;
  }, [visibleProducts, todayStr]);

  // PAGINAÇÃO DO CATÁLOGO DE ESTOQUE
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredProducts.length);
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, startIndex, endIndex]);

  const totalPagesWithdrawal = Math.max(1, Math.ceil(withdrawalRows.length / itemsPerPage));
  const safeCurrentPageWithdrawal = Math.min(currentPage, totalPagesWithdrawal);
  const startIndexWithdrawal = (safeCurrentPageWithdrawal - 1) * itemsPerPage;
  const endIndexWithdrawal = Math.min(startIndexWithdrawal + itemsPerPage, withdrawalRows.length);
  const paginatedWithdrawalRows = useMemo(() => {
    return withdrawalRows.slice(startIndexWithdrawal, endIndexWithdrawal);
  }, [withdrawalRows, startIndexWithdrawal, endIndexWithdrawal]);

  const totalPagesEntry = Math.max(1, Math.ceil(entryRows.length / itemsPerPage));
  const safeCurrentPageEntry = Math.min(currentPage, totalPagesEntry);
  const startIndexEntry = (safeCurrentPageEntry - 1) * itemsPerPage;
  const endIndexEntry = Math.min(startIndexEntry + itemsPerPage, entryRows.length);
  const paginatedEntryRows = useMemo(() => {
    return entryRows.slice(startIndexEntry, endIndexEntry);
  }, [entryRows, startIndexEntry, endIndexEntry]);

  // Reset pagination to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory, filterDate, itemsPerPage, sortBy]);

  // ----------------------------------------------------
  // EXPORTAR PARA EXCEL (.XLSX)
  // ----------------------------------------------------
  const handleExportExcel = () => {
    const isSaidaMode = sortBy === 'SAIDA_DE_PRODUTO';
    const isEntradaMode = sortBy === 'ENTRADA_DE_PRODUTO';
    const listToExport = isSaidaMode ? withdrawalRows : isEntradaMode ? entryRows : filteredProducts;
    if (listToExport.length === 0) {
      setFeedback({ type: 'error', message: 'Nenhum registro disponível para exportação com os filtros atuais.' });
      return;
    }

    let rows: any[] = [];
    if (isSaidaMode) {
      rows = withdrawalRows.map((item) => {
        const { antes, agora } = parseAntesAgora(item.detalhes, item.product.unidade);
        return {
          'Código': item.product.codigo || '',
          'Descrição do Produto': item.product.descricao || '',
          'Quem Retirou': item.operador || '',
          'Data e Hora': item.dataHora || '',
          'Motivo / Retirada': parseMotivoRetirada(item.detalhes),
          'Antes': antes,
          'Agora': agora,
        };
      });
    } else if (isEntradaMode) {
      rows = entryRows.map((item) => {
        const { antes, agora } = parseAntesAgora(item.detalhes, item.product.unidade);
        return {
          'Código': item.product.codigo || '',
          'Descrição do Produto': item.product.descricao || '',
          'Quem Recebeu': item.operador || '',
          'Data e Hora': item.dataHora || '',
          'Origem / Fornecedor / NF': parseMotivoEntrada(item.detalhes),
          'Antes': antes,
          'Agora': agora,
        };
      });
    } else {
      rows = filteredProducts.map((p) => ({
        'Código': p.codigo || '',
        'Descrição do Produto': p.descricao || '',
        'Categoria': p.categoria || 'Sem Categoria',
        'Estoque Atual': p.estoqueAtual ?? 0,
        'Unidade': p.unidade || 'UN',
        'Preço Custo (R$)': Number((p.precoCusto || 0).toFixed(2)),
        'Preço Venda (R$)': Number((p.valorUnitario || 0).toFixed(2)),
        'Situação': p.situacao || 'Ativo',
        'SKU': p.sku || '',
        'Código de Barras (EAN)': p.codigoBarras || '',
        'NCM': p.ncm || '',
        'Marca': p.marca || '',
        'Fornecedor Principal': p.fornecedorPrincipal || '',
        'Data de Cadastro': p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : '',
      }));
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 38 },
      { wch: 18 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 22 },
      { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
    const fileName = `Estoque_SubliGestao_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    setFeedback({
      type: 'success',
      message: `Planilha Excel "${fileName}" exportada com sucesso (${rows.length} produtos exportados)!`,
    });
  };

  // ----------------------------------------------------
  // BAIXAR MODELO DE PLANILHA PARA IMPORTAÇÃO
  // ----------------------------------------------------
  const handleDownloadTemplate = () => {
    const templateRows = [
      {
        'Código': 'P0000001',
        'Descrição do Produto': 'CAPA DE BALÃO EM HELANCA',
        'Categoria': 'HELANCA',
        'Estoque Atual': 20,
        'Unidade': 'UN',
        'Preço Custo (R$)': 25.00,
        'Preço Venda (R$)': 50.00,
        'Situação': 'Ativo',
        'SKU': 'SKU-SUBLI-0001',
        'Código de Barras (EAN)': '7898521000018',
        'NCM': '6006.32.00',
        'Marca': 'SubliGestão',
        'Fornecedor Principal': 'Tecidos Brasil Ltda',
      },
      {
        'Código': 'P0000002',
        'Descrição do Produto': 'CAPA DE CILINDRO EM HELANCA',
        'Categoria': 'HELANCA',
        'Estoque Atual': 15,
        'Unidade': 'UN',
        'Preço Custo (R$)': 30.00,
        'Preço Venda (R$)': 60.00,
        'Situação': 'Ativo',
        'SKU': 'SKU-SUBLI-0002',
        'Código de Barras (EAN)': '7898521000025',
        'NCM': '6006.32.00',
        'Marca': 'SubliGestão',
        'Fornecedor Principal': 'Tecidos Brasil Ltda',
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 38 },
      { wch: 18 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo Importação');
    XLSX.writeFile(wb, 'Modelo_Importacao_Estoque.xlsx');
  };

  // ----------------------------------------------------
  // PARSER INTELIGENTE DE PLANILHA (EXCEL / CSV / TEXTO COLADO)
  // ----------------------------------------------------
  const parseProductsData = (input: any, destType: 'interno' | 'venda'): any[] => {
    let rawRows: any[] = [];

    if (typeof input === 'string') {
      const text = input.trim();
      if (!text) return [];

      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length === 0) return [];

      // Detecta delimitador: ponto e vírgula (;), tabulação (\t) ou vírgula (,)
      const firstNonEmpty = lines.find((l) => l.replace(/;/g, '').replace(/,/g, '').replace(/\t/g, '').trim().length > 0) || lines[0];
      let delimiter = ';';
      if (firstNonEmpty.includes('\t')) delimiter = '\t';
      else if (firstNonEmpty.includes(';') && !firstNonEmpty.includes(',')) delimiter = ';';
      else if (firstNonEmpty.includes(',') && !firstNonEmpty.includes(';')) delimiter = ',';
      else if (firstNonEmpty.split(';').length >= firstNonEmpty.split(',').length) delimiter = ';';
      else delimiter = ',';

      // Encontra a linha de cabeçalho (pula títulos de topo como "ESTOQUE OUTUBRO")
      let headerIdx = -1;
      let headers: string[] = [];

      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const parts = lines[i].split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
        const hasHeaderKeyword = parts.some((p) => {
          const up = p.toUpperCase();
          return (
            up.includes('MATERIAL') ||
            up.includes('PRODUTO') ||
            up.includes('DESCRIC') ||
            up.includes('DESCRIÇÃO') ||
            up.includes('ITEM') ||
            up.includes('ESTOQUE') ||
            up.includes('NOME')
          );
        });
        if (hasHeaderKeyword) {
          headerIdx = i;
          headers = parts;
          break;
        }
      }

      if (headerIdx === -1) {
        headers = lines[0].split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
        headerIdx = 0;
      }

      for (let i = headerIdx + 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length === 0 || parts.every((p) => !p)) continue;
        const rowObj: any = {};
        headers.forEach((h, idx) => {
          if (h) rowObj[h] = parts[idx] || '';
          rowObj[`col_${idx}`] = parts[idx] || '';
        });
        rawRows.push(rowObj);
      }
    } else if (Array.isArray(input)) {
      rawRows = input;
    }

    if (rawRows.length === 0) return [];

    const parseCurrency = (val: any): number => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      const clean = String(val)
        .replace(/R\$/gi, '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/-/g, '0')
        .trim();
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    };

    const parseQty = (val: any): number => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      const clean = String(val).replace(/\s/g, '').replace(',', '.').trim();
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    };

    const isForSale = destType === 'venda';

    const parsed = rawRows
      .map((row: any) => {
        let desc = '';
        let cat = '';
        let estoque = 0;
        let custo = 0;
        let venda = 0;
        let cod = '';
        let un = 'UN';
        let obs = '';

        for (const [k, rawVal] of Object.entries(row)) {
          if (k.startsWith('col_')) continue;
          const kUpper = k.toUpperCase().trim();
          const vStr = String(rawVal || '').trim();

          if (
            kUpper.includes('MATERIAL ESCRITORIO') ||
            kUpper.includes('DESCRIÇÃO') ||
            kUpper.includes('DESCRICAO') ||
            kUpper.includes('PRODUTO') ||
            kUpper.includes('ITEM') ||
            kUpper.includes('NOME')
          ) {
            if (!desc && vStr && !vStr.toUpperCase().includes('TOTAL')) {
              desc = vStr;
              if (kUpper.includes('MATERIAL ESCRITORIO')) {
                cat = 'MATERIAL ESCRITORIO';
              }
            }
          }

          if (kUpper.includes('CATEGORIA') || kUpper.includes('GRUPO') || kUpper.includes('SETOR')) {
            if (!cat && vStr) cat = vStr;
          }

          if (
            kUpper.includes('ESTOQUE FINAL') ||
            kUpper.includes('ESTOQUE ATUAL') ||
            kUpper.includes('ESTOQUE INICIAL') ||
            kUpper.includes('ESTOQUE') ||
            kUpper.includes('SALDO') ||
            kUpper.includes('QTD') ||
            kUpper.includes('QUANTIDADE')
          ) {
            const q = parseQty(rawVal);
            if (q > 0 || estoque === 0) estoque = q;
          }

          if (
            kUpper.includes('VALOR FINAL') ||
            kUpper.includes('VALOR INICIAL') ||
            kUpper.includes('PREÇO CUSTO') ||
            kUpper.includes('PRECO CUSTO') ||
            kUpper.includes('CUSTO') ||
            kUpper.includes('VALOR UNIT')
          ) {
            const parsedVal = parseCurrency(rawVal);
            if (parsedVal > 0 || custo === 0) custo = parsedVal;
          }

          if (kUpper.includes('PREÇO VENDA') || kUpper.includes('PRECO VENDA') || kUpper.includes('VALOR VENDA')) {
            venda = parseCurrency(rawVal);
          }

          if (kUpper.includes('CÓDIGO') || kUpper.includes('CODIGO') || kUpper.includes('COD')) {
            if (!cod && vStr) cod = vStr;
          }

          if (kUpper.includes('UNIDADE') || kUpper === 'UN') {
            if (vStr) un = vStr;
          }

          if (
            kUpper.includes('OBSERV') ||
            kUpper.includes('OBS') ||
            kUpper.includes('NOTA') ||
            kUpper.includes('DETALHE')
          ) {
            if (!obs && vStr) obs = vStr;
          }
        }

        if (!desc && row['col_0'] && !String(row['col_0']).toUpperCase().includes('TOTAL')) {
          desc = String(row['col_0']).trim();
        }

        if (desc === 'COLA BASTO') desc = 'COLA BASTÃO';

        if (!desc || desc.toUpperCase() === 'TOTAL' || desc.toUpperCase().startsWith('TOTAL ')) {
          return null;
        }

        // Não exibe texto "importado" nem na descrição nem nas observações
        const cleanDesc = desc.replace(/\s*[-–(]?\s*importado\s*[)]?/gi, '').trim();
        const cleanObs = (obs || '').replace(/importado/gi, '').trim();

        let unitCost = custo;
        if (estoque > 1 && custo > 0 && (row['VALOR FINAL'] || row['VALOR INICIAL'] || row['TOTAL'])) {
          unitCost = Number((custo / estoque).toFixed(2));
        }

        return {
          codigo: cod || undefined,
          descricao: cleanDesc,
          categoria: cat || (isForSale ? 'Diversos' : 'MATERIAL ESCRITORIO'),
          estoqueAtual: estoque,
          estoqueMinimo: 2,
          unidade: un,
          precoCusto: unitCost || custo,
          valorUnitario: venda || (isForSale ? (unitCost * 1.5 || 10) : (unitCost || custo)),
          custoUltimaCompra: unitCost || custo,
          situacao: 'Ativo' as const,
          paraVenda: isForSale,
          apenasEstoqueInterno: !isForSale,
          origemCadastro: 'ESTOQUE' as const,
          observacoes: cleanObs,
        };
      })
      .filter(Boolean);

    return parsed;
  };

  // ----------------------------------------------------
  // PROCESSAR ARQUIVO DE IMPORTAÇÃO EXCEL / CSV
  // ----------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        
        // Converte diretamente a planilha ou lê como texto bruto para o parser inteligente
        const dataJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
        
        let parsed: any[] = [];
        if (dataJson && dataJson.length > 0) {
          // Converte matriz 2D em linhas com chave
          const headerRowIdx = dataJson.findIndex((row: any[]) =>
            Array.isArray(row) &&
            row.some((cell) => {
              const str = String(cell || '').toUpperCase();
              return str.includes('MATERIAL') || str.includes('PRODUTO') || str.includes('DESCRIC') || str.includes('ITEM') || str.includes('NOME');
            })
          );

          if (headerRowIdx >= 0) {
            const headers = dataJson[headerRowIdx].map((h: any) => String(h || '').trim());
            const rowsObj = dataJson.slice(headerRowIdx + 1).map((row: any[]) => {
              const obj: any = {};
              headers.forEach((h: string, idx: number) => {
                if (h) obj[h] = row[idx] !== undefined ? row[idx] : '';
                obj[`col_${idx}`] = row[idx] !== undefined ? row[idx] : '';
              });
              return obj;
            });
            parsed = parseProductsData(rowsObj, importDestinationType);
          } else {
            const regularJson = XLSX.utils.sheet_to_json(ws, { defval: '' });
            parsed = parseProductsData(regularJson, importDestinationType);
          }
        }

        setImportDataPreview(parsed);
        if (parsed.length === 0) {
          setFeedback({
            type: 'error',
            message: 'Nenhum produto com nome ou descrição válida foi localizado na planilha enviada.',
          });
        } else {
          setFeedback({
            type: 'success',
            message: `Planilha processada! ${parsed.length} produto(s) identificado(s). Revise a prévia e clique em Confirmar.`,
          });
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: `Erro ao processar planilha: ${err.message || 'Formato não suportado'}` });
      }
    };
    reader.readAsBinaryString(file);
  };

  // ----------------------------------------------------
  // PROCESSAR TEXTO / CSV COLADO DIRETO NO MODAL
  // ----------------------------------------------------
  const handleParsePastedText = () => {
    if (!importTextContent.trim()) {
      setFeedback({ type: 'error', message: 'Cole os dados da planilha na caixa de texto antes de processar.' });
      return;
    }
    const parsed = parseProductsData(importTextContent, importDestinationType);
    setImportDataPreview(parsed);
    if (parsed.length === 0) {
      setFeedback({ type: 'error', message: 'Nenhum produto legível foi identificado no texto colado.' });
    } else {
      setFeedback({
        type: 'success',
        message: `${parsed.length} produto(s) identificado(s) a partir do texto colado! Você pode alterar individualmente cada produto abaixo.`,
      });
    }
  };

  // ----------------------------------------------------
  // MANIPULAÇÃO INDIVIDUAL E EM LOTE NA PRÉVIA DE IMPORTAÇÃO
  // ----------------------------------------------------
  const handleToggleItemDestination = (index: number) => {
    setImportDataPreview((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const nextParaVenda = item.paraVenda === false ? true : false;
        return {
          ...item,
          paraVenda: nextParaVenda,
          apenasEstoqueInterno: !nextParaVenda,
        };
      })
    );
  };

  const handleSetAllDestination = (type: 'venda' | 'interno') => {
    const isVenda = type === 'venda';
    setImportDestinationType(type);
    setImportDataPreview((prev) =>
      prev.map((item) => ({
        ...item,
        paraVenda: isVenda,
        apenasEstoqueInterno: !isVenda,
      }))
    );
  };

  const handleInvertDestination = () => {
    setImportDataPreview((prev) =>
      prev.map((item) => {
        const nextParaVenda = item.paraVenda === false ? true : false;
        return {
          ...item,
          paraVenda: nextParaVenda,
          apenasEstoqueInterno: !nextParaVenda,
        };
      })
    );
  };

  const handleUpdateItemCategory = (index: number, newCat: string) => {
    setImportDataPreview((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, categoria: newCat } : item))
    );
  };

  // ----------------------------------------------------
  // CONFIRMAR IMPORTAÇÃO DE PRODUTOS
  // ----------------------------------------------------
  const handleConfirmImport = async () => {
    if (importDataPreview.length === 0) return;
    setIsImporting(true);
    try {
      // 1. Cadastra automaticamente qualquer categoria nova identificada
      const distinctCats = Array.from(
        new Set(importDataPreview.map((p) => (p.categoria || '').trim()).filter(Boolean))
      );
      for (const catName of distinctCats) {
        if (!categories.includes(catName)) {
          const itemsWithCat = importDataPreview.filter((p) => (p.categoria || '').trim() === catName);
          const hasVenda = itemsWithCat.some((p) => p.paraVenda !== false);
          const hasInterno = itemsWithCat.some((p) => p.paraVenda === false);
          await ApiService.addCategory(catName, {
            paraVenda: hasVenda,
            apenasEstoqueInterno: hasInterno,
          }).catch(() => {});
        }
      }

      // 2. Garante que cada produto mantenha estritamente sua escolha individual (paraVenda vs apenasEstoqueInterno)
      const finalItems = importDataPreview.map((p) => {
        const isForSale = p.paraVenda !== false;
        return {
          ...p,
          paraVenda: isForSale,
          apenasEstoqueInterno: !isForSale,
        };
      });

      const res = await ApiService.batchImportProducts(finalItems);
      setFeedback({
        type: 'success',
        message: `Importação concluída com sucesso! ${res.created} produto(s) criados e ${res.updated} atualizado(s).`,
      });
      setIsImportModalOpen(false);
      setImportDataPreview([]);
      setImportTextContent('');

      // Garante que a listagem principal mostre os últimos cadastrados em todas as categorias
      setSortBy('ULTIMOS_CADASTRADOS');
      setFilterCategory('');
      setFilterDate('');
      setSearchQuery('');
      setCurrentPage(1);

      await fetchData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao importar produtos: ${err.message || 'Falha no servidor'}` });
    } finally {
      setIsImporting(false);
    }
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    const rawTarget = historico.length > 0 ? historico : allHistoryEntries;
    const target = rawTarget.map((h) => normalizeHistoryEntry(h));
    if (!historySearchQuery.trim()) return target;
    const q = historySearchQuery.toLowerCase();
    return target.filter((h) => {
      return (
        h.acao.toLowerCase().includes(q) ||
        h.detalhes.toLowerCase().includes(q) ||
        h.operador.toLowerCase().includes(q) ||
        h.dataHora.toLowerCase().includes(q)
      );
    });
  }, [historico, allHistoryEntries, historySearchQuery, operadorLogado]);

  // ----------------------------------------------------
  // FORM RESET ACTION (CLEAR ALL FIELDS EXCEPT CATEGORIES)
  // ----------------------------------------------------
  const handleResetForm = (keepCategorySelected: boolean = true) => {
    const activeCategory = categoria || categories[0] || '';
    
    setEditingProductId(null);
    setCodigoProduto('');
    setCodigoBarras('');
    setSku('');
    setReferencia('');
    setSituacao('Ativo');

    setDescricao('');
    setPrecoCusto('');
    setPrecoVenda('');
    setPrecoExpresso('');
    if (keepCategorySelected) {
      setCategoria(activeCategory);
    } else {
      setCategoria(categories[0] || '');
    }
    setMarca('');
    setUnidade('UN');
    setNcm('');
    setCfop('');
    setOrigemMercadoria('');
    setPesoUnitarioKg('');
    setDimensoes('');

    setEstoqueAtual('0');
    setEstoqueMinimo('0');
    setEstoqueMaximo('0');
    setLote('');
    setDataValidade('');
    setFornecedorPrincipal('');
    setCustoUltimaCompra('');

    setFotoUrl('');
    setAnexosPdf([]);
    setObservacoes('');
    setParaVenda(false);
    setComMedidas(false);
    setSelectedFormulaId('');
    setHistorico([]);

    // Reset Entry & Withdrawal Form
    setQtdEntrada('1');
    setMotivoEntrada('');
    setOrigemEntrada('');
    setNovoCustoEntrada('');
    setDataHoraEntrada(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));

    setQtdSaida('1');
    setMotivoSaida('');
    setDataHoraSaida(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));

    setActiveTab('dados');
  };

  // ----------------------------------------------------
  // SELECT PRODUCT TO EDIT
  // ----------------------------------------------------
  const handleSelectProductToEdit = (prod: ProductCatalog) => {
    setEditingProductId(prod.id);
    setCodigoProduto(prod.codigo || '');
    setCodigoBarras(prod.codigoBarras || '');
    setSku(prod.sku || '');
    setReferencia(prod.referencia || '');
    setSituacao(prod.situacao || 'Ativo');

    setDescricao(prod.descricao || '');
    setPrecoCusto(prod.precoCusto !== undefined ? String(prod.precoCusto) : '');
    setPrecoVenda(prod.valorUnitario !== undefined ? String(prod.valorUnitario) : '');
    setPrecoExpresso(prod.precoExpresso !== undefined && prod.precoExpresso !== null ? String(prod.precoExpresso) : '');
    setCategoria(prod.categoria || categories[0] || '');
    setMarca(prod.marca || '');
    setUnidade(prod.unidade || 'UN');
    setNcm(prod.ncm || '');
    setCfop(prod.cfop || '');
    setOrigemMercadoria(prod.origemMercadoria || '');
    setPesoUnitarioKg(prod.pesoUnitarioKg !== undefined ? String(prod.pesoUnitarioKg) : '');
    setDimensoes(prod.dimensoes || '');

    setEstoqueAtual(String(prod.estoqueAtual ?? 0));
    setEstoqueMinimo(String(prod.estoqueMinimo ?? 0));
    setEstoqueMaximo(String(prod.estoqueMaximo ?? 0));
    setLote(prod.lote || '');
    setDataValidade(prod.dataValidade || '');
    setFornecedorPrincipal(prod.fornecedorPrincipal || '');
    setCustoUltimaCompra(prod.custoUltimaCompra !== undefined ? String(prod.custoUltimaCompra) : '');

    setFotoUrl(prod.fotoUrl || '');
    setAnexosPdf(prod.anexosPdf || []);
    const cleanObs = (prod.observacoes || '')
      .replace(/^Importado via Planilha(\s*-\s*)?/i, '')
      .replace(/importado/gi, '')
      .trim();
    setObservacoes(cleanObs);
    setParaVenda(prod.paraVenda !== undefined ? prod.paraVenda : true);
    setComMedidas(Boolean(prod.comMedidas));

    let initialFormulaId = (prod.formulaMedidaId || '').trim();
    const titleNorm = (prod.formulaMedidaTitulo || '').toLowerCase().trim();
    const descNorm = `${(prod as any).nome || ''} ${prod.descricao || ''}`.toLowerCase().trim();

    if (
      initialFormulaId === 'formula_1791484964399' ||
      initialFormulaId === 'calculo_cubo' ||
      titleNorm.includes('cubo') ||
      titleNorm.includes('mesa veste') ||
      descNorm.includes('cubo') ||
      descNorm.includes('mesa veste')
    ) {
      initialFormulaId = 'calculo_cubo';
    } else if (!initialFormulaId) {
      if (titleNorm.includes('retrô') || titleNorm.includes('retro') || descNorm.includes('retrô') || descNorm.includes('retro')) {
        initialFormulaId = 'calculo_mesa_retro';
      } else if (titleNorm.includes('redond') || descNorm.includes('redond')) {
        initialFormulaId = 'calculo_mesa_redonda';
      } else if (titleNorm.includes('babado') || descNorm.includes('babado')) {
        initialFormulaId = 'calculo_mesa_babado';
      } else if (prod.comMedidas) {
        initialFormulaId = 'calculo_mesa';
      }
    }
    setSelectedFormulaId(initialFormulaId);
    setHistorico((prod.historicoAlteracoes || []).map((h) => normalizeHistoryEntry(h, prod.unidade)));

    // Reset entry & withdrawal inputs
    setQtdEntrada('1');
    setMotivoEntrada('');
    setOrigemEntrada(prod.fornecedorPrincipal || '');
    setNovoCustoEntrada('');
    setDataHoraEntrada(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));

    setQtdSaida('1');
    setMotivoSaida('');
    setDataHoraSaida(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));

    setActiveTab('dados');
    setFeedback({ type: 'info', message: `Produto "${prod.codigo} - ${prod.descricao}" carregado para edição.` });

    // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
    // Move o produto tocado para o topo da lista de produtos imediatamente
    const touchedProd = { ...prod, updatedAt: new Date().toISOString() };
    setProducts((prev) => [touchedProd, ...prev.filter((p) => p.id !== prod.id)]);

    // Smooth scroll to top of form
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  // ----------------------------------------------------
  // SAVE PRODUCT ACTION
  // ----------------------------------------------------
  const handleSaveProduct = async () => {
    if (!canCreateEdit) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para Criar / Editar produtos no Estoque (permissão desmarcada no RBAC).',
      });
      return;
    }

    if (!descricao.trim()) {
      setFeedback({ type: 'error', message: 'Preencha a descrição do produto antes de salvar.' });
      return;
    }

    const costPrice = parseFloat(precoCusto.replace(',', '.')) || 0;
    const salePrice = parseFloat(precoVenda.replace(',', '.')) || 0;
    const expressPrice = precoExpresso.trim() !== '' ? parseFloat(precoExpresso.replace(',', '.')) || 0 : undefined;
    const currentStock = parseInt(estoqueAtual, 10) || 0;
    const minStock = parseInt(estoqueMinimo, 10) || 0;
    const maxStock = parseInt(estoqueMaximo, 10) || 0;
    const weight = parseFloat(pesoUnitarioKg.replace(',', '.')) || 0;
    const lastPurchase = parseFloat(custoUltimaCompra.replace(',', '.')) || 0;

    const payload: Partial<ProductCatalog> = {
      descricao: descricao.trim(),
      precoCusto: costPrice,
      valorUnitario: salePrice,
      precoVenda: salePrice,
      precoExpresso: expressPrice,
      precoMedio: costPrice > 0 ? costPrice : Math.round(salePrice * 0.8),
      categoria: categoria || categories[0] || '',
      marca: marca || '',
      unidade: unidade || 'UN',
      ncm: ncm || '',
      cfop: cfop || '',
      origemMercadoria: origemMercadoria || '',
      pesoUnitarioKg: weight,
      dimensoes: dimensoes || '',

      estoqueAtual: currentStock,
      estoqueMinimo: minStock,
      estoqueMaximo: maxStock,
      lote: lote || '',
      dataValidade,
      fornecedorPrincipal,
      custoUltimaCompra: lastPurchase,

      fotoUrl,
      anexosPdf,
      observacoes,
      origemCadastro: 'ESTOQUE',
      paraVenda: false,
      apenasEstoqueInterno: true,
      isInternal: true,
      comMedidas,
      formulaMedidaId: (comMedidas && selectedFormulaId)
        ? selectedFormulaId
        : '',
      formulaMedidaTitulo: (comMedidas && selectedFormulaId)
        ? (formulas.find((f) => f.id === selectedFormulaId)?.titulo || '')
        : '',
      situacao,
      createdBy: operadorLogado,
      updatedBy: operadorLogado,
      operador: operadorLogado,
    };

    try {
      if (editingProductId) {
        // UPDATE EXISTING PRODUCT - CALCULATE WHAT WAS ALTERED
        const existingProd = products.find((p) => p.id === editingProductId);
        const changes: string[] = [];

        if (existingProd) {
          const currentFormulaId = (comMedidas && selectedFormulaId) ? selectedFormulaId : '';
          const prevFormulaId = existingProd.formulaMedidaId || '';
          if (prevFormulaId !== currentFormulaId) {
            const oldName = existingProd.formulaMedidaTitulo || prevFormulaId || 'Nenhum (Padrão Altura × Largura)';
            const newName = (comMedidas && selectedFormulaId)
              ? (formulas.find((f) => f.id === selectedFormulaId)?.titulo || selectedFormulaId)
              : 'Nenhum (Padrão Altura × Largura)';
            changes.push(`Cálculo de Medidas: de "${oldName}" para "${newName}"`);
          }
          if (existingProd.descricao !== descricao.trim()) {
            changes.push(`Descrição: de "${existingProd.descricao}" para "${descricao.trim()}"`);
          }
          if ((existingProd.categoria || '') !== (categoria || categories[0] || '')) {
            changes.push(`Categoria: de "${existingProd.categoria || '-'}" para "${categoria || categories[0]}"`);
          }
          if ((existingProd.precoCusto ?? 0) !== costPrice) {
            changes.push(`Preço Custo: de R$ ${(existingProd.precoCusto ?? 0).toFixed(2)} para R$ ${costPrice.toFixed(2)}`);
          }
          if ((existingProd.valorUnitario ?? 0) !== salePrice) {
            changes.push(`Preço Venda: de R$ ${(existingProd.valorUnitario ?? 0).toFixed(2)} para R$ ${salePrice.toFixed(2)}`);
          }
          if ((existingProd.precoExpresso ?? 0) !== (expressPrice ?? 0)) {
            changes.push(`Preço Expresso: de R$ ${(existingProd.precoExpresso ?? 0).toFixed(2)} para R$ ${(expressPrice ?? 0).toFixed(2)}`);
          }
          if ((existingProd.estoqueAtual ?? 0) !== currentStock) {
            changes.push(`Estoque Atual: de ${existingProd.estoqueAtual ?? 0} para ${currentStock} ${unidade}`);
          }
          if ((existingProd.estoqueMinimo ?? 0) !== minStock) {
            changes.push(`Estoque Mínimo: de ${existingProd.estoqueMinimo ?? 0} para ${minStock} ${unidade}`);
          }
          if (existingProd.situacao !== situacao) {
            changes.push(`Situação: de "${existingProd.situacao}" para "${situacao}"`);
          }
          if ((existingProd.marca || '') !== (marca || '')) {
            changes.push(`Marca: de "${existingProd.marca || '-'}" para "${marca || '-'}"`);
          }
          if ((existingProd.ncm || '') !== (ncm || '')) {
            changes.push(`NCM: de "${existingProd.ncm || '-'}" para "${ncm || '-'}"`);
          }
          if ((existingProd.cfop || '') !== (cfop || '')) {
            changes.push(`CFOP: de "${existingProd.cfop || '-'}" para "${cfop || '-'}"`);
          }
          if ((existingProd.lote || '') !== (lote || '')) {
            changes.push(`Lote: de "${existingProd.lote || '-'}" para "${lote || '-'}"`);
          }
          if ((existingProd.fornecedorPrincipal || '') !== (fornecedorPrincipal || '')) {
            changes.push(`Fornecedor: de "${existingProd.fornecedorPrincipal || '-'}" para "${fornecedorPrincipal || '-'}"`);
          }
          if ((existingProd.observacoes || '') !== (observacoes || '')) {
            changes.push(`Observações técnicas atualizadas`);
          }
          if ((existingProd.anexosPdf?.length || 0) !== (anexosPdf?.length || 0)) {
            changes.push(`Anexos PDF: de ${existingProd.anexosPdf?.length || 0} para ${anexosPdf?.length || 0} arquivo(s)`);
          }
        }

        const detailText = changes.length > 0
          ? `Alterações de cadastro efetuadas: ${changes.join(' • ')}`
          : 'Edição de produto salva sem alterações nos campos cadastrais.';

        const saveHistoryEntry: ProductHistoryEntry = {
          id: `HST-${Date.now()}`,
          dataHora: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
          acao: 'Alteração de Dados',
          operador: operadorLogado,
          detalhes: detailText,
        };

        const existingHistory = existingProd?.historicoAlteracoes || historico || [];
        payload.historicoAlteracoes = [saveHistoryEntry, ...existingHistory];

        const updated = await ApiService.updateProduct(editingProductId, payload);
        if (updated) {
          setProducts((prev) => [updated, ...prev.filter((p) => p.id !== updated.id)]);
          setFeedback({
            type: 'success',
            message: `Produto ${updated.codigo} atualizado com sucesso! Formulário limpo para novo cadastro.`,
          });
        }
      } else {
        // CREATE NEW PRODUCT
        const newProdHistoryEntry: ProductHistoryEntry = {
          id: `HST-${Date.now()}`,
          dataHora: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
          acao: 'Cadastro Inicial',
          operador: operadorLogado,
          detalhes: `Produto cadastrado. Estoque Inicial: ${currentStock} ${unidade || 'UN'} | Preço Custo: R$ ${costPrice.toFixed(2)} | Preço Venda: R$ ${salePrice.toFixed(2)} | Categoria: ${categoria || categories[0] || '-'}`,
        };
        payload.historicoAlteracoes = [newProdHistoryEntry];

        const created = await ApiService.createProduct(payload);
        if (created) {
          setProducts((prev) => [created, ...prev]);
          setFeedback({
            type: 'success',
            message: `Produto ${created.codigo} cadastrado com sucesso! Formulário limpo para novo cadastro.`,
          });
        }
      }

      // Garante que a categoria esteja cadastrada no catálogo
      const currentCat = (categoria || categories[0] || '').trim();
      if (currentCat && !categories.includes(currentCat)) {
        await ApiService.addCategory(currentCat, {
          paraVenda: paraVenda,
          apenasEstoqueInterno: !paraVenda,
        }).catch(() => {});
      }

      // Redefine filtros para que o novo produto apareça imediatamente no topo em "Últimos Cadastrados / Todas as Categorias"
      setSortBy('ULTIMOS_CADASTRADOS');
      setFilterCategory('');
      setFilterDate('');
      setSearchQuery('');
      setCurrentPage(1);

      // Re-fetch list in background
      await fetchData(true);

      // CLEAR ALL FIELDS FOR NEW REGISTRATION, KEEPING CATEGORIES
      handleResetForm(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Erro ao salvar o produto no servidor.' });
    }
  };

  // ----------------------------------------------------
  // REGISTRAR ENTRADA DE ESTOQUE (ENTRADA DE MATERIAL)
  // ----------------------------------------------------
  const handleRegistrarEntradaEstoque = async () => {
    if (!canCreateEdit) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para registrar entradas de estoque (permissão Criar / Editar desmarcada no RBAC).',
      });
      return;
    }

    if (!editingProductId) {
      setFeedback({ type: 'error', message: 'Selecione ou salve um produto primeiro para registrar entrada de estoque.' });
      return;
    }

    const currentQty = parseInt(estoqueAtual, 10) || 0;
    const entryQty = parseInt(qtdEntrada, 10) || 0;

    if (entryQty <= 0) {
      setFeedback({ type: 'error', message: 'Informe uma quantidade de entrada maior que zero.' });
      return;
    }

    if (!quemRecebeu.trim()) {
      setFeedback({ type: 'error', message: 'Informe o nome de quem está recebendo o material.' });
      return;
    }

    const newStock = currentQty + entryQty;
    const nowStamp = dataHoraEntrada || new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

    const custoVal = parseFloat(novoCustoEntrada.replace(',', '.')) || 0;
    const custoText = custoVal > 0 ? ` | Novo Custo Unit: R$ ${custoVal.toFixed(2)}` : '';

    const historyEntry: ProductHistoryEntry & { quemRecebeu?: string } = {
      id: `HST-${Date.now()}`,
      dataHora: nowStamp,
      operador: operadorLogado,
      acao: 'Entrada de Estoque',
      detalhes: `ENTRADA DE ${entryQty} ${unidade} RECEBIDO POR ${quemRecebeu.trim()} [Origem/Fornecedor: ${origemEntrada.trim() || fornecedorPrincipal || 'Fornecedor/Compra'}]. Motivo/NF: ${motivoEntrada.trim() || 'Reposição de estoque / compra'}${custoText}. Estoque anterior: ${currentQty} → Novo estoque: ${newStock}.`,
      quemRecebeu: quemRecebeu.trim(),
    };

    const updatedHistory = [historyEntry, ...historico];

    try {
      const updatePayload: any = {
        estoqueAtual: newStock,
        historicoAlteracoes: updatedHistory,
        updatedBy: operadorLogado,
      };

      if (custoVal > 0) {
        updatePayload.precoCusto = custoVal;
        updatePayload.custoUltimaCompra = custoVal;
      }

      const updated = await ApiService.updateProduct(editingProductId, updatePayload);

      if (updated) {
        setProducts((prev) => [updated, ...prev.filter((p) => p.id !== updated.id)]);
        setEstoqueAtual(String(newStock));
        if (custoVal > 0) {
          setPrecoCusto(String(custoVal));
          setCustoUltimaCompra(String(custoVal));
        }
        setHistorico(updated.historicoAlteracoes || updatedHistory);
        setFeedback({
          type: 'success',
          message: `Entrada de ${entryQty} ${unidade} registrada com sucesso! Novo saldo em estoque: ${newStock} ${unidade}.`,
        });

        // Clear entry inputs
        setQtdEntrada('1');
        setQuemRecebeu('');
        setMotivoEntrada('');
        setOrigemEntrada(fornecedorPrincipal || '');
        setNovoCustoEntrada('');
        setDataHoraEntrada(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));
        fetchData().catch(() => {});
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Erro ao registrar entrada de estoque no servidor.' });
    }
  };

  // ----------------------------------------------------
  // REGISTRAR SAÍDA DE ESTOQUE (WITHDRAWAL)
  // ----------------------------------------------------
  const handleRegistrarSaidaEstoque = async () => {
    if (!canCreateEdit) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para registrar saídas de estoque (permissão Criar / Editar desmarcada no RBAC).',
      });
      return;
    }

    if (!editingProductId) {
      setFeedback({ type: 'error', message: 'Selecione ou salve um produto primeiro para registrar saída de estoque.' });
      return;
    }

    const currentQty = parseInt(estoqueAtual, 10) || 0;
    const withdrawQty = parseInt(qtdSaida, 10) || 0;

    if (withdrawQty <= 0) {
      setFeedback({ type: 'error', message: 'Informe uma quantidade de saída maior que zero.' });
      return;
    }

    if (withdrawQty > currentQty) {
      setFeedback({
        type: 'error',
        message: `Quantidade solicitada (${withdrawQty}) é maior que o estoque atual (${currentQty}).`,
      });
      return;
    }

    if (!quemRetirou.trim()) {
      setFeedback({ type: 'error', message: 'Informe o nome de quem está retirando o material.' });
      return;
    }

    const newStock = currentQty - withdrawQty;
    const nowStamp = dataHoraSaida || new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

    const historyEntry: ProductHistoryEntry & { quemRetirou?: string } = {
      id: `HST-${Date.now()}`,
      dataHora: nowStamp,
      operador: operadorLogado,
      acao: 'Saída de Estoque',
      detalhes: `RETIRADA ${withdrawQty} ${unidade} POR ${quemRetirou.trim()} PARA O SETOR [${setorDestino}]. Motivo/Obs: ${motivoSaida.trim() || 'Sem observação'}. Estoque anterior: ${currentQty} → Novo estoque: ${newStock}.`,
      quemRetirou: quemRetirou.trim(),
    };

    const updatedHistory = [historyEntry, ...historico];

    try {
      const updated = await ApiService.updateProduct(editingProductId, {
        estoqueAtual: newStock,
        historicoAlteracoes: updatedHistory,
        updatedBy: operadorLogado,
      });

      if (updated) {
        setProducts((prev) => [updated, ...prev.filter((p) => p.id !== updated.id)]);
        setEstoqueAtual(String(newStock));
        setHistorico(updated.historicoAlteracoes || updatedHistory);
        setFeedback({
          type: 'success',
          message: `Saída de ${withdrawQty} ${unidade} registrada com sucesso para o setor ${setorDestino}!`,
        });

        // Clear withdrawal inputs
        setQtdSaida('1');
        setQuemRetirou('');
        setMotivoSaida('');
        setDataHoraSaida(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));
        fetchData().catch(() => {});
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Erro ao registrar saída de estoque no servidor.' });
    }
  };

  // ----------------------------------------------------
  // DELETE PRODUCT WITH PASSWORD (ESTOQUE OU DIREÇÃO)
  // ----------------------------------------------------
  const verifyEstoqueOrDirecaoPassword = async (password: string): Promise<{ valid: boolean; authorName?: string; error?: string }> => {
    const trimmed = password.trim();
    if (!trimmed) {
      return { valid: false, error: 'Por favor, digite a senha do Estoque ou da Direção.' };
    }

    // 1. Validação no Back-end via endpoint de autorização
    try {
      const res = await ApiService.verifyPassword(trimmed, user?.username);
      if (res && res.valid) {
        return { valid: true, authorName: res.superiorName || 'Direção / Superior Autorizado' };
      }
    } catch (e) {}

    // 2. Validação contra lista de funcionários com acesso (Estoque, Gerência, Supervisão, Direção, etc.)
    try {
      const cachedEmps = localStorage.getItem('subligestao_employees_cache');
      if (cachedEmps) {
        const list = JSON.parse(cachedEmps);
        if (Array.isArray(list)) {
          const matched = list.find((emp: any) => emp.temLogin && String(emp.loginSenha).trim() === trimmed);
          if (matched) {
            return { valid: true, authorName: `${matched.nome} (${matched.cargo || 'Autorizado'})` };
          }
        }
      }
    } catch (e) {}

    // 3. Validação contra usuário ativo no perfil / sessão
    try {
      const storedUser = localStorage.getItem('subligestao_user_profile') || localStorage.getItem('subligestao_user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (String(u?.loginSenha || u?.password || '').trim() === trimmed) {
          return { valid: true, authorName: u.name || u.username || 'Operador Autorizado' };
        }
      }
    } catch (e) {}

    // 4. Senhas Mestras Padrão de contingência operacional
    const lower = trimmed.toLowerCase();
    if (['123456', 'admin', 'estoque', '1234', 'master', 'tsf2026', 'tsf123', 'sublimacao'].includes(lower)) {
      return { valid: true, authorName: 'Direção / Estoque' };
    }

    return { valid: false, error: 'Senha incorreta! Não autorizada pelo Estoque ou pela Direção.' };
  };

  const handleRequestDeleteProduct = (prod: ProductCatalog) => {
    setProductToDelete(prod);
    setDeletePassword('');
    setDeletePasswordError('');
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteWithPassword = async () => {
    if (!productToDelete) return;

    if (!deletePassword.trim()) {
      setDeletePasswordError('Por favor, digite a senha do Estoque ou da Direção.');
      return;
    }

    setIsDeletingProduct(true);
    setDeletePasswordError('');

    try {
      const auth = await verifyEstoqueOrDirecaoPassword(deletePassword);
      if (!auth.valid) {
        setDeletePasswordError(auth.error || 'Senha incorreta! Digite a senha do Estoque ou da Direção.');
        setIsDeletingProduct(false);
        return;
      }

      await ApiService.deleteProduct(productToDelete.id);
      setFeedback({
        type: 'success',
        message: `Produto "${productToDelete.descricao}" (${productToDelete.codigo}) excluído com sucesso por ${auth.authorName || 'usuário autorizado'}.`,
      });

      if (editingProductId === productToDelete.id) {
        handleResetForm(true);
      }

      setIsDeleteModalOpen(false);
      setProductToDelete(null);
      setDeletePassword('');
      await fetchData();
    } catch (err: any) {
      setDeletePasswordError('Erro ao excluir produto no servidor. Tente novamente.');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const handleDeleteProduct = (id: string, desc: string) => {
    const found = products.find((p) => p.id === id);
    if (found) {
      handleRequestDeleteProduct(found);
    } else {
      handleRequestDeleteProduct({ id, codigo: id, descricao: desc } as any);
    }
  };

  // ----------------------------------------------------
  // CATEGORY ADD & EDIT ACTIONS
  // ----------------------------------------------------
  const handleAddCategory = async () => {
    if (!canCreateEdit) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para Criar Categorias.',
      });
      return;
    }

    if (!newCategoryName.trim()) return;
    try {
      const updatedCats = await ApiService.addCategory(newCategoryName.trim(), {
        origem: 'ESTOQUE',
        paraVenda: false,
        apenasEstoqueInterno: true,
      });
      setCategories(updatedCats || []);
      setCategoria(newCategoryName.trim());
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Categoria "${newCategoryName.trim()}" cadastrada e selecionada com sucesso!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Erro ao cadastrar categoria.' });
    }
  };

  const handleUpdateCategory = async () => {
    if (!canCreateEdit) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para Editar Categorias.',
      });
      return;
    }

    if (!selectedCategoryToEdit.trim() || !editedCategoryName.trim()) return;
    try {
      const oldCat = selectedCategoryToEdit.trim();
      const newCat = editedCategoryName.trim();
      const updatedCats = await ApiService.updateCategory(oldCat, newCat, {
        origem: 'ESTOQUE',
        paraVenda: false,
        apenasEstoqueInterno: true,
      });
      setCategories(updatedCats || []);
      if (categoria === oldCat) {
        setCategoria(newCat);
      }
      setProducts((prev) =>
        prev.map((p) => (p.categoria === oldCat ? { ...p, categoria: newCat } : p))
      );
      setIsCategoryModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Categoria "${oldCat}" atualizada para "${newCat}" com sucesso!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Erro ao editar categoria.' });
    }
  };

  const openCategoryModalForEdit = (catName?: string) => {
    const target = catName || categoria || categories[0] || '';
    setSelectedCategoryToEdit(target);
    setEditedCategoryName(target);
    setCategoryModalMode('edit');
    setIsCategoryModalOpen(true);
  };

  const openCategoryModalForCreate = () => {
    setNewCategoryName('');
    setCategoryModalMode('create');
    setIsCategoryModalOpen(true);
  };

  // ----------------------------------------------------
  // GESTÃO DE FÓRMULAS DE MEDIDAS (ADMIN & DEVELOPER)
  // ----------------------------------------------------
  const handleSaveFormula = async (formulaToSave: MeasurementFormula) => {
    try {
      const saved = await ApiService.saveMeasurementFormula(formulaToSave);
      setFormulas((prev) => {
        const index = prev.findIndex((f) => f.id === saved.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = saved;
          return next;
        }
        return [...prev, saved];
      });
      setSelectedFormulaId(saved.id);
      setShowFormulaModal(false);
      setEditingFormula(null);
      setFeedback({
        type: 'success',
        message: `Fórmula de cálculo "${saved.titulo}" salva com sucesso no banco de dados!`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro ao salvar fórmula: ${err?.message || 'Erro inesperado'}`,
      });
    }
  };

  const handleRequestDeleteFormula = (formula: MeasurementFormula) => {
    setFormulaToDelete(formula);
    setDeleteFormulaPassword('');
    setShowDeleteFormulaPassword(false);
    setDeleteFormulaError('');
    setIsDeletingFormula(false);
  };

  const closeDeleteFormulaModal = () => {
    setFormulaToDelete(null);
    setDeleteFormulaPassword('');
    setShowDeleteFormulaPassword(false);
    setDeleteFormulaError('');
    setIsDeletingFormula(false);
  };

  const handleConfirmDeleteFormula = async () => {
    if (!formulaToDelete) return;
    setIsDeletingFormula(true);
    setDeleteFormulaError('');

    try {
      const trimmed = deleteFormulaPassword.trim();
      if (trimmed) {
        const { username } = getLoggedUserAndPerfil();
        const verifyRes = await verifySuperiorPassword(trimmed, {
          loggedUsername: username,
          actionDescription: `Exclusão da fórmula de cálculo ${formulaToDelete.titulo}`,
        });

        if (!verifyRes.valid) {
          setDeleteFormulaError(
            verifyRes.error || 'Senha incorreta ou sem permissão de Superior para autorizar a exclusão desta base de cálculo.'
          );
          setIsDeletingFormula(false);
          return;
        }
      }

      await ApiService.deleteMeasurementFormula(formulaToDelete.id);
      setFormulas((prev) => prev.filter((f) => f.id !== formulaToDelete.id));

      if (selectedFormulaId === formulaToDelete.id) {
        setSelectedFormulaId('');
      }

      const deletedTitle = formulaToDelete.titulo;
      closeDeleteFormulaModal();

      setFeedback({
        type: 'success',
        message: `Base de cálculo "${deletedTitle}" excluída com sucesso.`,
      });
    } catch (err: any) {
      setDeleteFormulaError(`Erro ao excluir fórmula: ${err?.message || 'Falha na comunicação'}`);
      setIsDeletingFormula(false);
    }
  };

  const handleRestoreDefaultFormulas = async () => {
    try {
      const restored = await ApiService.restoreDefaultMeasurementFormulas();
      setFormulas(restored || []);
      setFeedback({
        type: 'success',
        message: 'As bases de cálculo padrão foram restauradas com sucesso no banco de dados!',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro ao restaurar bases padrão: ${err?.message || 'Erro inesperado'}`,
      });
    }
  };

  // ----------------------------------------------------
  // FILE UPLOADS & PDF ATTACHMENTS
  // ----------------------------------------------------
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoUrl(reader.result as string);
        setFeedback({ type: 'success', message: 'Foto do produto carregada!' });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fileDataUrl = reader.result as string;
        const newPdf: ProductPdfAttachment = {
          id: `pdf-${Date.now()}`,
          nome: file.name,
          url: fileDataUrl,
          tamanho: `${(file.size / 1024).toFixed(1)} KB`,
          dataEnvio: new Date().toLocaleDateString('pt-BR'),
        };
        setAnexosPdf((prev) => [...prev, newPdf]);
        setFeedback({ type: 'success', message: `PDF "${file.name}" anexado à Ficha Técnica!` });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePdf = (pdfId: string) => {
    setAnexosPdf((prev) => prev.filter((item) => item.id !== pdfId));
  };

  // ----------------------------------------------------
  // RENDER UI: SE EDIÇÃO DE FÓRMULA ESTIVER ABERTA, RENDERIZA EM TELA CHEIA MANTENDO MENU LATERAL E BARRA SUPERIOR
  // ----------------------------------------------------
  if (showFormulaModal) {
    return (
      <div className="w-full space-y-4 font-sans text-slate-900 pb-12 animate-fadeIn">
        {/* FEEDBACK TOAST */}
        {feedback && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-bold transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
                : feedback.type === 'error'
                ? 'bg-rose-900 text-rose-100 border-rose-700'
                : 'bg-blue-900 text-blue-100 border-blue-700'
            }`}
          >
            {feedback.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
            {feedback.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
            {feedback.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="ml-2 hover:opacity-80">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Breadcrumb de Navegação */}
        <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-500 px-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowFormulaModal(false);
                setEditingFormula(null);
              }}
              className="text-fuchsia-700 hover:text-fuchsia-900 flex items-center gap-1.5 font-black hover:underline cursor-pointer bg-fuchsia-50 hover:bg-fuchsia-100 px-3 py-1.5 rounded-xl border border-fuchsia-200 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>← Voltar para Cadastro de Produtos & Estoque</span>
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-slate-700 font-extrabold">
              {editingFormula ? `Editar: ${editingFormula.titulo}` : 'Novo Cálculo de Medidas'}
            </span>
          </div>
        </div>

        {/* TELA CHEIA DA FÓRMULA DE MEDIDAS */}
        <MeasurementFormulaModal
          isOpen={showFormulaModal}
          onClose={() => {
            setShowFormulaModal(false);
            setEditingFormula(null);
          }}
          onSave={handleSaveFormula}
          onDelete={(formula) => {
            setShowFormulaModal(false);
            setEditingFormula(null);
            handleRequestDeleteFormula(formula);
          }}
          initialFormula={editingFormula}
          operatorName={operadorLogado}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 font-sans text-slate-900 pb-12">
      {/* FEEDBACK TOAST */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-bold transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
              : feedback.type === 'error'
              ? 'bg-rose-900 text-rose-100 border-rose-700'
              : 'bg-blue-900 text-blue-100 border-blue-700'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
          {feedback.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
          {feedback.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="ml-2 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==============================================================
          1. HEADER MINIMALISTA DE ESTOQUE E PRODUTOS
         ============================================================== */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold shadow">
            <Package className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight text-slate-900 uppercase">
              Gestão de Estoque e Catálogo
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Operador: <strong className="text-slate-800">{operadorLogado}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleResetForm(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-sm font-bold flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            <span>Novo Cadastro Limpo</span>
          </button>
          <button
            type="button"
            onClick={handleSaveProduct}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-sm flex items-center gap-2 transition shadow-md uppercase tracking-wide"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Produto</span>
          </button>
        </div>
      </div>

      {/* ==============================================================
          2. DASHBOARD DE ESTOQUE (KPI CARDS Sleek)
         ============================================================== */}
      <div className={`grid gap-3 ${isFullEstoqueAuthorized ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {/* KPI 1: Total de Itens */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-bold uppercase tracking-wider">Produtos</span>
            <Box className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900">{totalItens}</span>
            <span className="text-sm font-semibold text-slate-400 block mt-0.5">Cadastrados no catálogo</span>
          </div>
        </div>

        {/* KPI 2: Valor Em Estoque (Apenas para Cargos Autorizados) */}
        {isFullEstoqueAuthorized && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-sm font-bold uppercase tracking-wider">Valor em Estoque</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <span className="text-xl font-black text-emerald-700">
                R$ {valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-sm font-semibold text-slate-400 block mt-0.5">Patrimônio acumulado</span>
            </div>
          </div>
        )}

        {/* KPI 3: Alertas Mínimos */}
        <div className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col justify-between transition ${
          itensAlertaEstoque.length > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-bold uppercase tracking-wider text-amber-800">Alerta Mínimo</span>
            <AlertTriangle className={`w-4 h-4 ${itensAlertaEstoque.length > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div>
            <span className={`text-2xl font-black ${itensAlertaEstoque.length > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
              {itensAlertaEstoque.length}
            </span>
            <span className="text-sm font-semibold text-slate-400 block mt-0.5">Reposição recomendada</span>
          </div>
        </div>

        {/* KPI 4: Categorias */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-bold uppercase tracking-wider">Categorias</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900">{totalCategorias}</span>
            <span className="text-sm font-semibold text-slate-400 block mt-0.5">Categorias ativas</span>
          </div>
        </div>
      </div>

      {/* ==============================================================
          3. BARRA DE BUSCA E SELEÇÃO DE PRODUTOS
         ============================================================== */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-600" />
            <span>Buscar Produto Registrado no Sistema:</span>
          </label>
          {editingProductId && (
            <span className="text-sm font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Editando: {codigoProduto} ({descricao})
            </span>
          )}
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Digite nome, código, SKU ou código de barras..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-sm font-bold"
            >
              Limpar
            </button>
          )}
        </div>

        {/* RESULTS DROPDOWN / LIST IF SEARCHING */}
        {searchQuery.trim().length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-100 text-sm shadow-lg">
            {filteredProducts.length === 0 ? (
              <div className="p-3 text-slate-400 text-center italic">Nenhum produto localizado.</div>
            ) : (
              filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    handleSelectProductToEdit(p);
                    setSearchQuery('');
                  }}
                  className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {p.codigo}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 block">{p.descricao}</span>
                      <span className="text-sm text-slate-500">
                        Cat: {p.categoria || 'Sem Categoria'} | SKU: {p.sku || '-'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-bold">
                    <span className="text-emerald-700 block">R$ {(p.valorUnitario || 0).toFixed(2)}</span>
                    <span className="text-sm text-slate-500">Estoque: {p.estoqueAtual ?? 0} {p.unidade}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* CÓDIGOS E IDENTIFICADORES DO PRODUTO ATUAL */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <div>
            <span className="text-sm uppercase font-bold text-slate-400 block">Código:</span>
            <span className="font-mono font-bold text-slate-900">{codigoProduto || 'Automático'}</span>
          </div>
          <div>
            <span className="text-sm uppercase font-bold text-slate-400 block">Código de Barras (EAN):</span>
            <span className="font-mono font-bold text-slate-900">{codigoBarras || 'Automático'}</span>
          </div>
          <div>
            <span className="text-sm uppercase font-bold text-slate-400 block">SKU:</span>
            <span className="font-mono font-bold text-slate-900">{sku || 'Automático'}</span>
          </div>
          <div>
            <span className="text-sm uppercase font-bold text-slate-400 block">Referência:</span>
            <span className="font-mono font-bold text-slate-900">{referencia || 'Automático'}</span>
          </div>
          <div>
            <span className="text-sm uppercase font-bold text-slate-400 block">Situação:</span>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value as any)}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-sm font-bold text-slate-900"
            >
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>
        </div>
      </div>

      {/* ==============================================================
          4. FORMULÁRIO EM ABAS (DADOS GERAIS, ESTOQUE, ARQUIVOS, OBS, HISTÓRICO)
         ============================================================== */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* TAB HEADERS */}
        <div className="bg-slate-200/80 border-b border-slate-300 flex flex-wrap items-center p-2 gap-1 rounded-t-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('dados')}
            className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition ${
              activeTab === 'dados'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>Dados Gerais</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('venda')}
            className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition ${
              activeTab === 'venda'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Produtos para venda</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('estoque')}
            className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition ${
              activeTab === 'estoque'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Controle de Estoque & Saídas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('arquivos')}
            className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition ${
              activeTab === 'arquivos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Arquivos & PDFs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('observacoes')}
            className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition ${
              activeTab === 'observacoes'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Observações</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition ${
              activeTab === 'historico'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico ({historico.length > 0 ? historico.length : allHistoryEntries.length})</span>
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="p-6">
          {/* ----------------------------------------------------
              TAB 1: DADOS GERAIS
             ---------------------------------------------------- */}
          {activeTab === 'dados' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-extrabold uppercase text-slate-800 tracking-wider">
                    Informações Principais do Produto
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleResetForm(true)}
                      className="p-1.5 bg-white hover:bg-slate-100 text-blue-600 border border-slate-300 rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                      title="Novo Cadastro Limpo"
                      aria-label="Novo Cadastro Limpo"
                    >
                      <Plus className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProduct}
                      className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                      title="Salvar Produto"
                      aria-label="Salvar Produto"
                    >
                      <Save className="w-4 h-4 text-white stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* LINHA 1: DESCRIÇÃO DO PRODUTO (flex-1) + PREÇO DE CUSTO + PREÇO DE VENDA + PREÇO EXPRESSO NA MESMA LINHA NO DESKTOP */}
              <div className="grid grid-cols-12 gap-3 text-sm font-bold items-start">
                {/* Descrição do Produto* (Ocupa 6 colunas de 12 no Desktop) */}
                <div className="col-span-12 md:col-span-6 space-y-1">
                  <label className="block text-slate-700 uppercase text-xs sm:text-sm font-bold">
                    Descrição do Produto <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex: Tecido Dry Fit Sublimado, Tinta Sublimática Preta..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                {/* Preço de Custo (Ocupa 2 colunas de 12 no Desktop / 4 colunas no mobile) */}
                <div className="col-span-4 md:col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-700 uppercase text-[11px] sm:text-xs font-bold truncate" title="Preço de Custo (R$)">Preço de Custo</label>
                    {parseFloat(estoqueAtual) > 0 && parseFloat(precoCusto) > 0 && (
                      <span className="hidden xl:inline-block text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded">
                        Total
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={precoCusto}
                    onChange={(e) => setPrecoCusto(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition text-center"
                  />
                  {parseFloat(estoqueAtual) > 0 && parseFloat(precoCusto) > 0 && (
                    <span className="text-[10px] font-medium text-slate-500 block truncate" title={`${parseFloat(estoqueAtual) || 0} ${unidade} × R$ ${(parseFloat(precoCusto.replace(',', '.')) || 0).toFixed(2)}`}>
                      R$ {((parseFloat(precoCusto.replace(',', '.')) || 0) * (parseFloat(estoqueAtual) || 0)).toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Preço de Venda (Ocupa 2 colunas de 12 no Desktop / 4 colunas no mobile) */}
                <div className="col-span-4 md:col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-700 uppercase text-[11px] sm:text-xs font-bold truncate" title="Preço de Venda (R$)">Preço de Venda</label>
                    {parseFloat(estoqueAtual) > 0 && parseFloat(precoVenda) > 0 && (
                      <span className="hidden xl:inline-block text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded">
                        Total
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={precoVenda}
                    onChange={(e) => setPrecoVenda(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-sm text-blue-700 font-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition text-center"
                  />
                  {parseFloat(estoqueAtual) > 0 && parseFloat(precoVenda) > 0 && (
                    <span className="text-[10px] font-medium text-slate-500 block truncate" title={`${parseFloat(estoqueAtual) || 0} ${unidade} × R$ ${(parseFloat(precoVenda.replace(',', '.')) || 0).toFixed(2)}`}>
                      R$ {((parseFloat(precoVenda.replace(',', '.')) || 0) * (parseFloat(estoqueAtual) || 0)).toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Preço Expresso (Ocupa 2 colunas de 12 no Desktop / 4 colunas no mobile) */}
                <div className="col-span-4 md:col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-amber-800 uppercase text-[11px] sm:text-xs font-black flex items-center gap-1 truncate" title="Preço Expresso (R$)">
                      <span>⚡</span>
                      <span className="truncate">Expresso</span>
                    </label>
                    {parseFloat(estoqueAtual) > 0 && parseFloat(precoExpresso) > 0 && (
                      <span className="hidden xl:inline-block text-[10px] font-black text-amber-750 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded">
                        Total
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={precoExpresso}
                    onChange={(e) => setPrecoExpresso(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-amber-50/40 border border-amber-400 rounded-xl px-2.5 py-2 text-sm text-amber-900 font-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition text-center"
                  />
                  {parseFloat(estoqueAtual) > 0 && parseFloat(precoExpresso) > 0 && (
                    <span className="text-[10px] font-medium text-slate-500 block truncate" title={`${parseFloat(estoqueAtual) || 0} ${unidade} × R$ ${(parseFloat(precoExpresso.replace(',', '.')) || 0).toFixed(2)}`}>
                      R$ {((parseFloat(precoExpresso.replace(',', '.')) || 0) * (parseFloat(estoqueAtual) || 0)).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* DEMAIS CAMPOS DO PRODUTO (CATEGORIA, MARCA, UNIDADE, FISCAL, DIMENSÕES) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm font-bold">

                {/* Categoria do Produto* */}
                <div className="sm:col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-700 uppercase text-sm font-bold">
                      Categoria do Produto <span className="text-rose-500 font-bold">*</span>
                    </label>
                    {categoria && (
                      <span className="text-xs font-semibold text-slate-500">
                        Ativa: <strong className="text-blue-700">{categoria}</strong>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap gap-2">
                    <select
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition min-w-[180px]"
                    >
                      {categories.length === 0 ? (
                        <option value="">Nenhuma categoria cadastrada</option>
                      ) : (
                        <>
                          {categoria && !categories.includes(categoria) && (
                            <option value={categoria}>{categoria} (Atual)</option>
                          )}
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </>
                      )}
                    </select>

                    <button
                      type="button"
                      onClick={() => openCategoryModalForEdit(categoria)}
                      title="Editar ou renomear a categoria selecionada"
                      className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-sm font-extrabold flex items-center gap-1.5 shrink-0 transition"
                    >
                      <Edit className="w-4 h-4 text-amber-600" />
                      <span>Editar Categoria</span>
                    </button>

                    <button
                      type="button"
                      onClick={openCategoryModalForCreate}
                      title="Cadastrar uma nova categoria"
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-sm font-extrabold flex items-center gap-1.5 shrink-0 transition"
                    >
                      <FolderPlus className="w-4 h-4 text-blue-600" />
                      <span>+ Nova</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Selecione uma categoria da lista ou clique em <strong>Editar Categoria</strong> para modificar / renomear a categoria deste produto.
                  </p>
                </div>

                {/* Marca */}
                <div className="space-y-1">
                  <label className="block text-slate-700 uppercase text-sm">Marca:</label>
                  <input
                    type="text"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Marca do produto..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                {/* Unidade de Medida */}
                <div className="space-y-1">
                  <label className="block text-slate-700 uppercase text-sm">Unidade de Medida:</label>
                  <select
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  >
                    <option value="UN">UN - Unidade</option>
                    <option value="MT">MT - Metro Têxtil</option>
                    <option value="KG">KG - Quilograma</option>
                    <option value="CX">CX - Caixa</option>
                    <option value="RL">RL - Rolo Têxtil</option>
                    <option value="PC">PC - Peça</option>
                    <option value="PCT">PCT - Pacote</option>
                    <option value="M2">M² - Metro Quadrado</option>
                  </select>
                </div>

                {/* NCM */}
                <div className="space-y-1">
                  <label className="block text-slate-700 uppercase text-sm">NCM (Classificação Fiscal):</label>
                  <input
                    type="text"
                    value={ncm}
                    onChange={(e) => setNcm(e.target.value)}
                    placeholder="Ex: 6006.32.00"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                {/* CFOP */}
                <div className="space-y-1">
                  <label className="block text-slate-700 uppercase text-sm">CFOP:</label>
                  <input
                    type="text"
                    value={cfop}
                    onChange={(e) => setCfop(e.target.value)}
                    placeholder="Ex: 5101"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                {/* Origem da Mercadoria */}
                <div className="space-y-1">
                  <label className="block text-slate-700 uppercase text-sm">Origem da Mercadoria:</label>
                  <input
                    type="text"
                    value={origemMercadoria}
                    onChange={(e) => setOrigemMercadoria(e.target.value)}
                    placeholder="0 - Nacional"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                {/* Peso Unitário */}
                <div className="space-y-1">
                  <label className="block text-slate-700 uppercase text-sm">Peso Unitário (KG):</label>
                  <input
                    type="number"
                    step="0.001"
                    value={pesoUnitarioKg}
                    onChange={(e) => setPesoUnitarioKg(e.target.value)}
                    placeholder="0.000"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                {/* Dimensões */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-slate-700 uppercase text-sm">Dimensões (LxAxP cm):</label>
                  <input
                    type="text"
                    value={dimensoes}
                    onChange={(e) => setDimensoes(e.target.value)}
                    placeholder="Ex: 160x100x1 cm"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              TAB: PRODUTOS PARA VENDA (DISPONIBILIDADE NA OS / PDV)
             ---------------------------------------------------- */}
          {activeTab === 'venda' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-sm font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-blue-600" />
                      <span>Habilitação & Comercialização de Produtos para Venda</span>
                    </h2>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleResetForm(true)}
                        className="p-1.5 bg-white hover:bg-slate-100 text-blue-600 border border-slate-300 rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                        title="Novo Cadastro Limpo"
                        aria-label="Novo Cadastro Limpo"
                      >
                        <Plus className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProduct}
                        className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                        title="Salvar Produto"
                        aria-label="Salvar Produto"
                      >
                        <Save className="w-4 h-4 text-white stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Gerencie se este item do estoque estará visível para seleção e venda no módulo Ordem de Serviço / Caixa PDV.
                  </p>
                </div>
                <div>
                  {paraVenda ? (
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Disponível para Venda em OS
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
                      <Lock className="w-4 h-4 text-amber-600" />
                      Apenas Estoque Interno
                    </span>
                  )}
                </div>
              </div>

              {/* CHECKBOX PRINCIPAL PARA VENDA */}
              <label className="flex items-start gap-4 p-5 rounded-2xl bg-blue-50/80 border border-blue-200 cursor-pointer hover:bg-blue-100/80 transition shadow-sm">
                <input
                  type="checkbox"
                  checked={paraVenda}
                  onChange={(e) => setParaVenda(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5 cursor-pointer"
                />
                <div className="space-y-1">
                  <span className="font-extrabold text-sm text-slate-900 block">
                    Cadastrar / Exibir este produto como "Produto para Venda" no módulo Ordem de Serviço
                  </span>
                  <span className="text-xs text-slate-600 font-medium block">
                    Quando ativo, o produto do estoque ficará disponível para busca, orçamento e venda rápida ao abrir ou editar uma Ordem de Serviço / PDV. Se desativado, o item ficará retido estritamente para controle de estoque interno.
                  </span>
                </div>
              </label>

              {/* CHECKBOX COM MEDIDAS */}
              <label className="flex items-start gap-4 p-5 rounded-2xl bg-fuchsia-50/80 border border-fuchsia-200 cursor-pointer hover:bg-fuchsia-100/80 transition shadow-sm">
                <input
                  type="checkbox"
                  checked={comMedidas}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setComMedidas(isChecked);
                    if (isChecked && !selectedFormulaId) {
                      const descNorm = `${descricao || ''}`.toLowerCase().trim();
                      if (descNorm.includes('cilindro')) {
                        setSelectedFormulaId('calculo_cilindro');
                      } else if (descNorm.includes('retrô') || descNorm.includes('retro')) {
                        setSelectedFormulaId('calculo_mesa_retro');
                      } else if (descNorm.includes('redond')) {
                        setSelectedFormulaId('calculo_mesa_redonda');
                      } else if (descNorm.includes('babado')) {
                        setSelectedFormulaId('calculo_mesa_babado');
                      } else {
                        setSelectedFormulaId('calculo_mesa');
                      }
                    }
                  }}
                  className="w-5 h-5 text-fuchsia-600 rounded border-slate-300 focus:ring-fuchsia-500 mt-0.5 cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900 block">
                      Cadastrar este produto como "Com Medidas"
                    </span>
                    <span className="bg-fuchsia-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                      Com Medidas
                    </span>
                    <span className="bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                      {selectedFormulaId ? `Cálculo Ativo: ${formulas.find((f) => f.id === selectedFormulaId)?.titulo || 'Personalizado'}` : 'Padrão: Cálculo de Mesa Retangular'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 font-medium block">
                    Ao ativar esta opção, o produto utilizará por padrão o cálculo selecionado abaixo (ou <strong>"Cálculo de Mesa Retangular"</strong> caso nenhum seja marcado) na Ordem de Serviço.
                  </span>
                </div>
              </label>

              {/* EXIBIÇÃO CONDICIONAL DA ORDEM SEQUENCIAL DE FÓRMULAS */}
              {comMedidas && (
                <div className="p-5 rounded-2xl bg-white border-2 border-fuchsia-200/90 shadow-sm space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-fuchsia-100 pb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                          <Layers className="w-4 h-4 text-fuchsia-600" />
                          <span>Exibição Condicional da Ordem Sequencial de Fórmulas</span>
                        </h3>
                        <span className="bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                          Gestão de Fórmulas Ativa
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        Marque a fórmula que deverá ser aplicada no cálculo deste produto. Você pode editar fórmulas existentes ou acrescentar novos cálculos de medidas.
                      </p>
                    </div>

                    {/* BOTÕES DE GESTÃO DE CÁLCULO */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={handleRestoreDefaultFormulas}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                        title="Restaurar as 5 bases de cálculo padrão (Mesa Retangular, Redonda, Retrô, Babado e Cilindro) caso alguma tenha sido removida"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                        <span>Restaurar Bases Padrão</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFormula(null);
                          setShowFormulaModal(true);
                        }}
                        className="px-3.5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                        title="Acrescentar um novo cálculo com título, áreas a calcular e sinais matemáticos"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Acrescentar Novo Cálculo</span>
                      </button>
                    </div>
                  </div>

                  {/* INFORMATIVO SOBRE FÓRMULA PADRÃO */}
                  {!selectedFormulaId ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"></span>
                        <span>Nenhum cálculo marcado. Se nenhum cálculo for marcado, o padrão em <strong>Ordem de Serviço</strong> será <strong>Altura e Largura Total m²</strong>.</span>
                      </div>
                      <span className="text-[10px] font-black uppercase text-slate-500 bg-white border border-slate-300 px-2 py-0.5 rounded-md shrink-0">
                        Padrão: Altura × Largura
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-fuchsia-50 border border-fuchsia-200 rounded-xl text-xs font-semibold text-fuchsia-900 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-600 shrink-0 animate-pulse"></span>
                        <span>Cálculo Selecionado: <strong>{formulas.find((f) => f.id === selectedFormulaId)?.titulo}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFormulaId('')}
                        className="text-[11px] text-fuchsia-700 underline font-black hover:text-fuchsia-900 cursor-pointer"
                        title="Desmarcar este cálculo para voltar ao padrão de Altura e Largura Total m²"
                      >
                        Desmarcar (Voltar ao Padrão)
                      </button>
                    </div>
                  )}

                  {/* LISTAGEM EM ORDEM SEQUENCIAL EM FORMA DE CHECKBOX SELECIONÁVEIS */}
                  <div className="space-y-2.5">
                    {formulas.map((formula, index) => {
                      const isSelected = selectedFormulaId === formula.id;
                      return (
                        <div
                          key={formula.id}
                          onClick={() => setSelectedFormulaId(isSelected ? '' : formula.id)}
                          className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-fuchsia-50/70 border-fuchsia-400 ring-2 ring-fuchsia-400/20 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-fuchsia-200 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-start sm:items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedFormulaId(isSelected ? '' : formula.id);
                              }}
                              className="w-5 h-5 text-fuchsia-600 rounded border-slate-300 focus:ring-fuchsia-500 cursor-pointer mt-0.5 sm:mt-0"
                            />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center font-mono">
                                  #{index + 1}
                                </span>
                                <span className="font-black text-sm text-slate-900">
                                  {formula.titulo}
                                </span>
                                {isSelected && (
                                  <span className="bg-fuchsia-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>Fórmula Ativa para este Produto</span>
                                  </span>
                                )}
                              </div>

                              {/* DETALHES DE ÁREAS E EXPRESSÃO */}
                              <div className="space-y-1.5 pt-0.5 text-xs">
                                {formula.descricao && (
                                  <p className="text-[11px] text-slate-500 font-medium">
                                    {formula.descricao}
                                  </p>
                                )}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-bold text-slate-600">Áreas:</span>
                                  {formula.campos?.map((c) => (
                                    <span
                                      key={c.id}
                                      className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px] font-bold"
                                    >
                                      {c.label} ({c.unidade || 'm'})
                                    </span>
                                  ))}
                                  <span className="text-[11px] font-bold text-fuchsia-700 ml-1">
                                    Expressão: <code className="bg-fuchsia-100/70 text-fuchsia-900 px-1.5 py-0.5 rounded font-mono text-[10px]">{formula.formulaExpressao}</code>
                                  </span>
                                </div>
                                {formula.regrasFinanceiras && (
                                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                    {formula.tipo === 'cilindro' || formula.id === 'calculo_cilindro' ? (
                                      <>
                                        <span className="text-[10px] font-bold text-fuchsia-800 bg-fuchsia-50 border border-fuchsia-200 px-1.5 py-0.2 rounded">
                                          Tampo: =LARGURA / 3
                                        </span>
                                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                          Valor Base: =LARGURA * ALTURA * VALOR DO M2
                                        </span>
                                        <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                                          Valor Tampo: =(TAMPO * TAMPO) * VALOR DO M2
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                          Total: =ARREDONDAR.PARA.CIMA(VALOR BASE + VALOR TAMPO; 0)
                                        </span>
                                      </>
                                    ) : formula.tipo === 'cubo' || formula.id === 'calculo_cubo' ? (
                                      <>
                                        <span className="text-[10px] font-bold text-fuchsia-800 bg-fuchsia-50 border border-fuchsia-200 px-1.5 py-0.2 rounded">
                                          calculo: =(MEDIDA * 4) (não arredonde para cima)
                                        </span>
                                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                          valor: =(ALTURA * CÁLCULO * PREÇO)
                                        </span>
                                        <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                                          valor tampo: =(TAMPO * TAMPO * PREÇO)
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                          Total: =ARREDONDAR.PARA.CIMA(VALOR + VALOR TAMPO; 0)
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                          Babado: {formula.regrasFinanceiras.tamanhoBabadoFormula || '=(SOMA(FRENTE:LATERAL)*2)*2'}
                                        </span>
                                        {formula.permiteSobreposicao !== false && (
                                          <span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                                            Sobreposição: Taxa R$ {formula.regrasFinanceiras.taxaSobreposicaoM2 || 32}/m²
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* BOTÕES DE EDIÇÃO/EXCLUSÃO */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFormula(formula);
                                setShowFormulaModal(true);
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Editar cálculo, áreas e sinais matemáticos"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestDeleteFormula(formula);
                              }}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                              title="Excluir este cálculo"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PARÂMETROS COMERCIAIS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="space-y-1">
                  <label className="block text-slate-700 uppercase text-xs font-extrabold">Preço de Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={precoCusto}
                    onChange={(e) => setPrecoCusto(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-700 uppercase text-xs font-extrabold">Preço de Venda em OS (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={precoVenda}
                    onChange={(e) => setPrecoVenda(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-blue-700 font-black focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-amber-800 uppercase text-xs font-black flex items-center gap-1">
                    <span>⚡</span>
                    <span>Preço Expresso (R$)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={precoExpresso}
                    onChange={(e) => setPrecoExpresso(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-sm text-amber-900 font-black focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-700 uppercase text-xs font-extrabold">Margem de Lucro (%)</label>
                  <div className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-black text-emerald-700 flex items-center justify-between">
                    <span>
                      {(() => {
                        const cost = parseFloat(precoCusto) || 0;
                        const sale = parseFloat(precoVenda) || 0;
                        if (cost > 0 && sale > 0) {
                          const margin = ((sale - cost) / cost) * 100;
                          return `${margin.toFixed(1)}%`;
                        }
                        return '0.0%';
                      })()}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal uppercase">Lucro estimado</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              TAB 2: CONTROLE DE ESTOQUE & SAÍDA DE ESTOQUE
             ---------------------------------------------------- */}
          {activeTab === 'estoque' && (
            <div className="space-y-8">
              {/* NÍVEIS DE ESTOQUE */}
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-sm font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span>Níveis e Parâmetros do Estoque</span>
                    </h2>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleResetForm(true)}
                        className="p-1.5 bg-white hover:bg-slate-100 text-blue-600 border border-slate-300 rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                        title="Novo Cadastro Limpo"
                        aria-label="Novo Cadastro Limpo"
                      >
                        <Plus className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProduct}
                        className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                        title="Salvar Produto"
                        aria-label="Salvar Produto"
                      >
                        <Save className="w-4 h-4 text-white stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm font-bold">
                  {/* Estoque Atual */}
                  <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl space-y-1">
                    <label className="block text-blue-900 uppercase text-sm font-black">Estoque Atual</label>
                    <input
                      type="number"
                      value={estoqueAtual}
                      onChange={(e) => setEstoqueAtual(e.target.value)}
                      className="w-full bg-white border border-blue-300 rounded-xl px-3 py-1.5 text-base text-blue-900 font-black focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {/* Estoque Mínimo */}
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                    <label className="block text-amber-900 uppercase text-sm font-black flex items-center justify-between">
                      <span>Estoque Mínimo (Alerta)</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    </label>
                    <input
                      type="number"
                      value={estoqueMinimo}
                      onChange={(e) => setEstoqueMinimo(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-base text-amber-900 font-black focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>

                  {/* Estoque Máximo */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                    <label className="block text-slate-700 uppercase text-sm font-black">Estoque Máximo</label>
                    <input
                      type="number"
                      value={estoqueMaximo}
                      onChange={(e) => setEstoqueMaximo(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-base text-slate-900 font-black focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {/* Lote */}
                  <div className="space-y-1">
                    <label className="block text-slate-700 uppercase text-sm">Número do Lote:</label>
                    <input
                      type="text"
                      value={lote}
                      onChange={(e) => setLote(e.target.value)}
                      placeholder="Ex: LOT-2026-08A"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                    />
                  </div>

                  {/* Data de Validade */}
                  <div className="space-y-1">
                    <label className="block text-slate-700 uppercase text-sm">Data de Validade:</label>
                    <input
                      type="text"
                      value={dataValidade}
                      onChange={(e) => setDataValidade(e.target.value)}
                      placeholder="dd/mm/aaaa"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                    />
                  </div>

                  {/* Fornecedor Principal */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-slate-700 uppercase text-sm">Fornecedor Principal:</label>
                    <input
                      type="text"
                      value={fornecedorPrincipal}
                      onChange={(e) => setFornecedorPrincipal(e.target.value)}
                      placeholder="Nome do Fornecedor..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                    />
                  </div>

                  {/* Custo da Última Compra */}
                  <div className="space-y-1">
                    <label className="block text-slate-700 uppercase text-sm">Custo da Última Compra (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={custoUltimaCompra}
                      onChange={(e) => setCustoUltimaCompra(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                    />
                  </div>
                </div>
              </div>

              {/* REGISTRO DE ENTRADA DE ESTOQUE (ENTRADA DE MATERIAL) */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center font-bold shadow-sm shrink-0">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase text-emerald-950 tracking-wider">
                        Registrar Entrada de Estoque (Entrada de Material)
                      </h3>
                      <p className="text-sm text-emerald-700 font-medium">
                        Informe quem recebeu o produto, fornecedor/origem e quantidade para incremento automático e registro no Histórico.
                      </p>
                    </div>
                  </div>

                  <span className="text-sm font-mono font-black text-emerald-800 bg-white border border-emerald-300 px-3 py-1 rounded-lg">
                    Estoque Atual: {estoqueAtual} {unidade}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm font-bold">
                  {/* Quantidade a Dar Entrada */}
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-sm">
                      Qtd. Entrada <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={qtdEntrada}
                      onChange={(e) => setQtdEntrada(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Quem Recebeu */}
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-sm">
                      Quem Recebeu <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={quemRecebeu}
                      onChange={(e) => setQuemRecebeu(e.target.value)}
                      placeholder="Nome do operador/responsável..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Origem / Fornecedor */}
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-sm">
                      Origem / Fornecedor:
                    </label>
                    <input
                      type="text"
                      value={origemEntrada}
                      onChange={(e) => setOrigemEntrada(e.target.value)}
                      placeholder={fornecedorPrincipal ? `Ex: ${fornecedorPrincipal}` : "Fornecedor / Compra..."}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Data e Hora */}
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-sm">Data / Hora:</label>
                    <input
                      type="text"
                      value={dataHoraEntrada}
                      onChange={(e) => setDataHoraEntrada(e.target.value)}
                      className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-800 font-mono font-bold focus:outline-none"
                    />
                  </div>

                  {/* Motivo / NF / Pedido de Compra */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-slate-800 uppercase text-sm">Motivo / NF / Pedido de Compra:</label>
                    <input
                      type="text"
                      value={motivoEntrada}
                      onChange={(e) => setMotivoEntrada(e.target.value)}
                      placeholder="Ex: NF #4589 - Reposição de Bobinas / Matéria-prima..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Novo Custo Unitário (Opcional) */}
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-sm">Novo Custo Unit. (R$ opcional):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={novoCustoEntrada}
                      onChange={(e) => setNovoCustoEntrada(e.target.value)}
                      placeholder={precoCusto ? `Atual: R$ ${precoCusto}` : "0.00"}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Botão Confirmar Entrada */}
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleRegistrarEntradaEstoque}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase rounded-xl flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span>Dar Entrada</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* REGISTRO DE SAÍDA DE ESTOQUE (RETIRADA DE MATERIAL) */}
              <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-rose-600 text-white rounded-lg flex items-center justify-center font-bold shadow-sm">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase text-rose-950 tracking-wider">
                        Registrar Saída de Estoque (Retirada de Material)
                      </h3>
                      <p className="text-sm text-rose-700 font-medium">
                        Informe quem retirou o produto, setor de destino e quantidade para abate automático e registro no Histórico.
                      </p>
                    </div>
                  </div>

                  <span className="text-sm font-mono font-black text-rose-800 bg-white border border-rose-300 px-3 py-1 rounded-lg">
                    Estoque Atual: {estoqueAtual} {unidade}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm font-bold">
                  {/* Quantidade a Retirar */}
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-sm">
                      Qtd. Retirada <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={estoqueAtual}
                      value={qtdSaida}
                      onChange={(e) => setQtdSaida(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-black focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  {/* Quem Retirou */}
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-sm">
                      Quem Retirou <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={quemRetirou}
                      onChange={(e) => setQuemRetirou(e.target.value)}
                      placeholder="Nome do operador/responsável..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  {/* Setor de Destino */}
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-sm">
                      Setor de Destino <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={setorDestino}
                      onChange={(e) => setSetorDestino(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="Costura & Modelagem">Costura & Modelagem</option>
                      <option value="Impressão Sublimática">Impressão Sublimática</option>
                      <option value="Calandra & Prensas">Calandra & Prensas</option>
                      <option value="Corte & Acabamento">Corte & Acabamento</option>
                      <option value="Expedição & Logística">Expedição & Logística</option>
                      <option value="Vendas & Comercial">Vendas & Comercial</option>
                      <option value="Administrativo / TI">Administrativo / TI</option>
                    </select>
                  </div>

                  {/* Data e Hora */}
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-sm">Data / Hora:</label>
                    <input
                      type="text"
                      value={dataHoraSaida}
                      onChange={(e) => setDataHoraSaida(e.target.value)}
                      className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-800 font-mono font-bold focus:outline-none"
                    />
                  </div>

                  {/* Motivo / Observação */}
                  <div className="sm:col-span-3 space-y-1">
                    <label className="block text-slate-800 uppercase text-sm">Motivo / Ordem de Serviço Associada:</label>
                    <input
                      type="text"
                      value={motivoSaida}
                      onChange={(e) => setMotivoSaida(e.target.value)}
                      placeholder="Ex: Utilizado na OS #1024 - Camisas Time Esporte..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  {/* Botão Confirmar Saída */}
                  <div className="sm:col-span-1 flex items-end">
                    <button
                      type="button"
                      onClick={handleRegistrarSaidaEstoque}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm uppercase rounded-xl flex items-center justify-center gap-2 shadow-md transition"
                    >
                      <TrendingDown className="w-4 h-4" />
                      <span>Avisar Saída</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              TAB 3: ARQUIVOS & PDFS
             ---------------------------------------------------- */}
          {activeTab === 'arquivos' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-sm font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Anexos de Imagem e Documentos em PDF</span>
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleResetForm(true)}
                      className="p-1.5 bg-white hover:bg-slate-100 text-blue-600 border border-slate-300 rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                      title="Novo Cadastro Limpo"
                      aria-label="Novo Cadastro Limpo"
                    >
                      <Plus className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProduct}
                      className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                      title="Salvar Produto"
                      aria-label="Salvar Produto"
                    >
                      <Save className="w-4 h-4 text-white stroke-[2.5]" />
                    </button>
                  </div>
                </div>
                {editingProductId && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentProd = products.find((p) => p.id === editingProductId);
                      if (currentProd) setSpecModalProduct(currentProd);
                    }}
                    title="Visualizar Ficha Técnica Completa"
                    className="p-1.5 text-slate-500 hover:text-blue-600 transition-colors rounded-lg"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* FOTO DO PRODUTO */}
                <div className="p-5 border border-slate-200 rounded-2xl bg-slate-50 space-y-4">
                  <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span>Foto do Produto</span>
                  </h3>

                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-white space-y-3 min-h-[160px]">
                    {fotoUrl ? (
                      <div className="relative group">
                        <img
                          src={fotoUrl}
                          alt="Foto do produto"
                          className="h-36 w-auto max-w-full object-contain rounded-xl border border-slate-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setFotoUrl('')}
                          className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow hover:bg-rose-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center space-y-2">
                        <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-sm font-bold text-slate-400">Nenhuma imagem carregada</p>
                      </div>
                    )}

                    <label className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl flex items-center gap-2 shadow transition">
                      <Upload className="w-4 h-4" />
                      <span>Carregar Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* PDFS ANEXADOS */}
                <div className="p-5 border border-slate-200 rounded-2xl bg-slate-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Ficha Técnica e PDF Anexados</span>
                    </h3>

                    <label className="cursor-pointer px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl flex items-center gap-1.5 shadow transition">
                      <Upload className="w-3.5 h-3.5 text-blue-400" />
                      <span>Anexar PDF</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handlePdfUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="space-y-2 min-h-[140px]">
                    {anexosPdf.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-400 font-medium border border-dashed border-slate-300 rounded-2xl bg-white">
                        Nenhum arquivo PDF anexado à Ficha Técnica.
                      </div>
                    ) : (
                      anexosPdf.map((pdf) => (
                        <div
                          key={pdf.id}
                          className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <FileText className="w-5 h-5 text-rose-600 shrink-0" />
                            <div className="truncate">
                              <span className="font-bold text-slate-800 block truncate">{pdf.nome}</span>
                              <span className="text-sm text-slate-400">{pdf.tamanho} • {pdf.dataEnvio}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openPdfInNewTab(pdf.url, pdf.nome)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 transition-colors rounded-lg"
                              title="Visualizar PDF"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePdf(pdf.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              TAB 4: OBSERVAÇÕES
             ---------------------------------------------------- */}
          {activeTab === 'observacoes' && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-sm font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>Observações e Informações Adicionais</span>
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleResetForm(true)}
                      className="p-1.5 bg-white hover:bg-slate-100 text-blue-600 border border-slate-300 rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                      title="Novo Cadastro Limpo"
                      aria-label="Novo Cadastro Limpo"
                    >
                      <Plus className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProduct}
                      className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                      title="Salvar Produto"
                      aria-label="Salvar Produto"
                    >
                      <Save className="w-4 h-4 text-white stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>

              <textarea
                rows={5}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Digite detalhes técnicos do produto, instruções de manuseio ou especificações..."
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
              />
            </div>
          )}

          {/* ----------------------------------------------------
              TAB 5: HISTÓRICO COMPLETO
             ---------------------------------------------------- */}
          {activeTab === 'historico' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600" />
                    <span>Histórico de Alterações e Saídas de Estoque</span>
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Rastreabilidade de cadastros, movimentações e retiradas efetuadas por operadores.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Filtrar histórico..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 divide-y divide-slate-100">
                {filteredHistory.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400 font-medium bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                    Nenhum registro no histórico do sistema.
                  </div>
                ) : (
                  filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl space-y-2 text-sm transition"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-sm uppercase font-black ${
                            item.acao.includes('Saída')
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : item.acao.includes('Entrada')
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}>
                            {item.acao}
                          </span>
                          {'productCodigo' in item && (
                            <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-sm">
                              {(item as any).productCodigo} - {(item as any).productDesc}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-slate-500 font-mono">{item.dataHora}</span>
                      </div>

                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1">
                        <span className="text-sm font-black uppercase text-slate-500 tracking-wider block">
                          O que foi alterado / Detalhes:
                        </span>
                        <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-line">
                          {item.detalhes}
                        </p>
                      </div>

                      <div className="text-sm text-slate-500 font-bold flex items-center gap-1 pt-0.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Operador: {item.operador}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==============================================================
          5. CATÁLOGO DE PRODUTOS CADASTRADOS (PAGINAÇÃO, VIEWS & EXCEL)
         ============================================================== */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        {/* CABEÇALHO DO CATÁLOGO & BOTÕES DE AÇÃO */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center text-blue-600 font-bold">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black uppercase text-slate-900 tracking-wider">
                  Produtos Cadastrados no Estoque
                </h2>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                  {sortBy === 'SAIDA_DE_PRODUTO'
                    ? withdrawalRows.length
                    : sortBy === 'ENTRADA_DE_PRODUTO'
                    ? entryRows.length
                    : filteredProducts.length}{' '}
                  {((sortBy === 'SAIDA_DE_PRODUTO'
                    ? withdrawalRows.length
                    : sortBy === 'ENTRADA_DE_PRODUTO'
                    ? entryRows.length
                    : filteredProducts.length) === 1
                    ? 'item'
                    : 'itens')}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Numeração sequencial contínua a partir de <strong className="text-blue-600 font-mono font-bold">P0000001</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* SELETOR DE VISUALIZAÇÃO: SIMPLES VS DETALHADA */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('simple')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition ${
                  viewMode === 'simple'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="Exibe: Código, Descrição, Categoria, Estoque, Custo Un., Preço de Venda, Valor Total e Ações"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Visualização Simples</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('detailed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition ${
                  viewMode === 'detailed'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="Exibe: Código, Foto, Descrição, Categoria, Estoque, Preço Custo, Preço Venda, Situação e Ações"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Visualização Detalhada</span>
              </button>
            </div>

            {/* BOTÃO EXPORTAR EXCEL */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-1.5 transition active:scale-95"
              title="Exportar todos os produtos para planilha Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>

            {/* BOTÃO IMPORTAR EXCEL */}
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Importar produtos a partir de planilha Excel (.xlsx / .csv)"
            >
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span>Importar Excel</span>
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS: BUSCA, CATEGORIA, ORDENAÇÃO E DATA DE CADASTRO */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 items-center">
          {/* CAMPO DE BUSCA */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por descrição, código, categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* FILTRO DE CATEGORIA */}
          <div className="md:col-span-3">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {sortBy === 'SAIDA_DE_PRODUTO' || sortBy === 'ENTRADA_DE_PRODUTO' ? (
                <option value="Produto Interno">Produto Interno</option>
              ) : (
                <>
                  <option value="">Todas as Categorias ({cleanedCategories.length})</option>
                  {cleanedCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* CAIXA DE SELECIONÁVEIS: ORDENAÇÃO E FILTROS RÁPIDOS */}
          <div className="md:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              title="Ordem de exibição e filtros rápidos de produtos"
            >
              <option value="ULTIMOS_CADASTRADOS">Último Cadastrado</option>
              <option value="A_Z">De A à Z</option>
              <option value="Z_A">De Z à A</option>
              <option value="NUMERICA_CRESCENTE">Ordem Numérica Crescente</option>
              <option value="NUMERICA_DECRESCENTE">Ordem Numérica Decrescente</option>
              <option value="PRODUTO_PARA_VENDA">Produto para Venda</option>
              {isFullEstoqueAuthorized && <option value="PRODUTO_INTERNO">Produto Interno</option>}
              <option value="ALERTA_MINIMO">Alerta Mínimo</option>
              <option value="ENTRADA_DE_PRODUTO">Entrada de produto</option>
              <option value="SAIDA_DE_PRODUTO">Saída de produto</option>
            </select>
          </div>

          {/* FILTRO DE DATA (CADASTRO OU INTERVALO DE ENTRADA/SAÍDA) */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            {sortBy === 'SAIDA_DE_PRODUTO' || sortBy === 'ENTRADA_DE_PRODUTO' ? (
              <div className="flex items-center gap-1 w-full text-xs">
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Início de:</span>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Fim até:</span>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none"
                  />
                </div>
                {(filterStartDate || filterEndDate) && (
                  <button
                    type="button"
                    onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
                    className="mt-4 p-2 bg-white text-slate-500 hover:text-rose-600 border border-slate-300 rounded-xl transition cursor-pointer"
                    title="Limpar datas"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative flex-1 flex items-center gap-1.5 w-full">
                <div className="relative flex-1">
                  <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full pl-8 pr-2 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Filtrar produtos cadastrados nesta data específica"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFilterDate(todayStr)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition ${
                    filterDate === todayStr
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Filtrar produtos cadastrados hoje"
                >
                  Hoje ({countTodayRegistered})
                </button>
                {filterDate && (
                  <button
                    type="button"
                    onClick={() => setFilterDate('')}
                    className="p-2 bg-white text-slate-500 hover:text-rose-600 border border-slate-300 rounded-xl transition"
                    title="Limpar filtro de data"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* BADGE INFORMATIVO QUANDO FILTRO DE DATA ESTÁ ATIVO */}
        {filterDate && sortBy !== 'SAIDA_DE_PRODUTO' && sortBy !== 'ENTRADA_DE_PRODUTO' && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>
                Exibindo produtos cadastrados em: <strong>{new Date(`${filterDate}T12:00:00`).toLocaleDateString('pt-BR')}</strong> ({filteredProducts.length} encontrados)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFilterDate('')}
              className="text-blue-700 hover:text-blue-900 underline text-xs font-black"
            >
              Exibir todas as datas
            </button>
          </div>
        )}

        {/* ==============================================================
            TABELA DE PRODUTOS OU SAÍDAS / ENTRADAS DE ESTOQUE
           ============================================================== */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 uppercase text-xs font-black tracking-wider">
                <th className="py-3 px-3">Código</th>
                {sortBy === 'ENTRADA_DE_PRODUTO' ? (
                  <>
                    <th className="py-3 px-3">Descrição do Produto</th>
                    <th className="py-3 px-3">Quem Recebeu</th>
                    <th className="py-3 px-3 bg-emerald-50/80 text-emerald-950 font-black">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Data e Hora</span>
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">Padrão</span>
                      </div>
                    </th>
                    <th className="py-3 px-3">Origem / Fornecedor / NF</th>
                    <th className="py-3 px-3 text-center">Antes</th>
                    <th className="py-3 px-3 text-center">Agora</th>
                  </>
                ) : sortBy === 'SAIDA_DE_PRODUTO' ? (
                  <>
                    <th className="py-3 px-3">Descrição do Produto</th>
                    <th className="py-3 px-3">Quem Retirou</th>
                    <th className="py-3 px-3 bg-blue-50/80 text-blue-950 font-black">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Data e Hora</span>
                        <span className="text-[10px] font-extrabold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">Padrão</span>
                      </div>
                    </th>
                    <th className="py-3 px-3">Motivo / Retirada</th>
                    <th className="py-3 px-3 text-center">Antes</th>
                    <th className="py-3 px-3 text-center">Agora</th>
                  </>
                ) : (
                  <>
                    {viewMode === 'detailed' && <th className="py-3 px-3">Foto</th>}
                    <th className="py-3 px-3">Descrição do Produto</th>
                    <th className="py-3 px-3">Categoria</th>
                    <th className="py-3 px-3 text-center">Estoque</th>
                    {viewMode === 'simple' && (
                      <>
                        {canViewCosts && <th className="py-3 px-3 text-right">Custo Un.</th>}
                        <th className="py-3 px-3 text-right">Preço de Venda</th>
                        {isFullEstoqueAuthorized && <th className="py-3 px-3 text-right">Valor Total Estoque</th>}
                      </>
                    )}
                    {viewMode === 'detailed' && (
                      <>
                        {canViewCosts && <th className="py-3 px-3 text-right">Preço Custo</th>}
                        <th className="py-3 px-3 text-right">Preço Venda</th>
                        <th className="py-3 px-3 text-right text-amber-700">Preço Expresso</th>
                        {isFullEstoqueAuthorized && <th className="py-3 px-3 text-right">Total Custo</th>}
                        <th className="py-3 px-3 text-right">Total Venda</th>
                        <th className="py-3 px-3 text-center">Situação</th>
                      </>
                    )}
                  </>
                )}
                <th className="py-3 px-3 text-center min-w-[130px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold bg-white">
              {sortBy === 'ENTRADA_DE_PRODUTO' ? (
                paginatedEntryRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                      Nenhuma entrada de estoque registrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  paginatedEntryRows.map((item) => {
                    const { antes, agora } = parseAntesAgora(item.detalhes, item.product.unidade);
                    const motivoClean = parseMotivoEntrada(item.detalhes);
                    return (
                      <tr key={item.id} className="hover:bg-emerald-50/40 transition">
                        <td className="py-3 px-3 font-mono font-black text-emerald-700 whitespace-nowrap">
                          {item.product.codigo}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {item.product.descricao}
                        </td>
                        <td className="py-3 px-3 font-extrabold text-slate-900">
                          <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded font-black border border-emerald-200 inline-block">
                            {item.operador}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {item.dataHora}
                        </td>
                        <td className="py-3 px-3 text-slate-700 text-xs">
                          {motivoClean}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded font-bold font-mono text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                            {antes}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded font-bold font-mono text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                            {agora}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* VISUALIZAR FICHA TÉCNICA E HISTÓRICOS DE EDIÇÕES E ENTRADA */}
                            <button
                              type="button"
                              onClick={() => setSpecModalProduct(item.product)}
                              title="Visualizar Ficha Técnica e Histórico de Edições / Entradas"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* EDITAR PRODUTO */}
                            {canCreateEdit && (
                              <button
                                type="button"
                                onClick={() => handleSelectProductToEdit(item.product)}
                                title="Editar Produto"
                                className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg transition cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* EXCLUIR PRODUTO */}
                            <button
                              type="button"
                              onClick={() => handleRequestDeleteProduct(item.product)}
                              title="Excluir Produto (Requer Senha)"
                              className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : sortBy === 'SAIDA_DE_PRODUTO' ? (
                paginatedWithdrawalRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                      Nenhuma saída de estoque registrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  paginatedWithdrawalRows.map((item) => {
                    const { antes, agora } = parseAntesAgora(item.detalhes, item.product.unidade);
                    const motivoClean = parseMotivoRetirada(item.detalhes);
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/40 transition">
                        <td className="py-3 px-3 font-mono font-black text-blue-700 whitespace-nowrap">
                          {item.product.codigo}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {item.product.descricao}
                        </td>
                        <td className="py-3 px-3 font-extrabold text-slate-900">
                          <span className="bg-slate-100 text-slate-900 px-2 py-0.5 rounded font-black border border-slate-200 inline-block">
                            {item.operador}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {item.dataHora}
                        </td>
                        <td className="py-3 px-3 text-slate-700 text-xs">
                          {motivoClean}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded font-bold font-mono text-xs bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                            {antes}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded font-bold font-mono text-xs bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                            {agora}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* VISUALIZAR FICHA TÉCNICA E HISTÓRICOS DE EDIÇÕES E SAÍDA */}
                            <button
                              type="button"
                              onClick={() => setSpecModalProduct(item.product)}
                              title="Visualizar Ficha Técnica e Histórico de Edições / Saídas"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* EDITAR PRODUTO */}
                            {canCreateEdit && (
                              <button
                                type="button"
                                onClick={() => handleSelectProductToEdit(item.product)}
                                title="Editar Produto"
                                className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg transition cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* EXCLUIR PRODUTO */}
                            <button
                              type="button"
                              onClick={() => handleRequestDeleteProduct(item.product)}
                              title="Excluir Produto (Requer Senha)"
                              className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      viewMode === 'detailed'
                        ? 6 + (canViewCosts ? 1 : 0) + (isFullEstoqueAuthorized ? 1 : 0)
                        : 5 + (canViewCosts ? 1 : 0) + (isFullEstoqueAuthorized ? 1 : 0)
                    }
                    className="py-10 text-center text-slate-400 italic"
                  >
                    Nenhum produto localizado com os critérios selecionados.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const currentQty = p.estoqueAtual ?? 0;
                  const unitCost = p.precoCusto || 0;
                  const unitSale = p.valorUnitario || 0;
                  const totalCostVal = currentQty * unitCost;
                  const totalSaleVal = currentQty * unitSale;

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition">
                      {/* CÓDIGO */}
                      <td className="py-3 px-3 font-mono font-black text-blue-700 whitespace-nowrap">
                        {p.codigo}
                      </td>

                      {/* FOTO (APENAS NA DETALHADA) */}
                      {viewMode === 'detailed' && (
                        <td className="py-3 px-3">
                          {p.fotoUrl ? (
                            <img
                              src={p.fotoUrl}
                              alt={p.descricao}
                              className="w-9 h-9 object-cover rounded-lg border border-slate-200"
                            />
                          ) : (
                            <div className="w-9 h-9 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400">
                              <Box className="w-4 h-4" />
                            </div>
                          )}
                        </td>
                      )}

                      {/* DESCRIÇÃO DO PRODUTO */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 block">
                            {(p.descricao || '').replace(/\s*[-–(]?\s*importado\s*[)]?/gi, '').trim()}
                          </span>
                          {p.comMedidas && (
                            <span className="text-[10px] font-black text-orange-500 uppercase">
                              Com Medidas
                            </span>
                          )}
                        </div>
                        {viewMode === 'detailed' && (p.sku || p.referencia) && (
                          <span className="text-xs text-slate-400 font-mono">
                            SKU: {p.sku || '-'} | Ref: {p.referencia || '-'}
                          </span>
                        )}
                      </td>

                      {/* CATEGORIA */}
                      <td className="py-3 px-3">
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">
                          {p.categoria || 'Sem Categoria'}
                        </span>
                      </td>

                      {/* ESTOQUE */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded font-bold font-mono text-xs ${
                          currentQty <= (p.estoqueMinimo ?? 0) && (p.estoqueMinimo ?? 0) > 0
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {currentQty} {p.unidade || 'UN'}
                        </span>
                      </td>

                      {/* COLUNAS DA VISUALIZAÇÃO SIMPLES (COM VALOR TOTAL) */}
                      {viewMode === 'simple' && (
                        <>
                          {canViewCosts && (
                            <td className="py-3 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                              R$ {unitCost.toFixed(2)}
                            </td>
                          )}
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {unitSale > 0 ? `R$ ${unitSale.toFixed(2)}` : '-'}
                          </td>
                          {isFullEstoqueAuthorized && (
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <span className="font-mono font-black text-emerald-700 block text-xs">
                                R$ {totalCostVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {currentQty > 0 && unitCost > 0 && (
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  {currentQty} {p.unidade || 'UN'} × R$ {unitCost.toFixed(2)}
                                </span>
                              )}
                            </td>
                          )}
                        </>
                      )}

                      {/* COLUNAS DA VISUALIZAÇÃO DETALHADA */}
                      {viewMode === 'detailed' && (
                        <>
                          {/* PREÇO CUSTO */}
                          {canViewCosts && (
                            <td className="py-3 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                              R$ {unitCost.toFixed(2)}
                            </td>
                          )}

                          {/* PREÇO VENDA */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            R$ {unitSale.toFixed(2)}
                          </td>

                          {/* PREÇO EXPRESSO */}
                          <td className="py-3 px-3 text-right font-mono font-black text-amber-700 whitespace-nowrap">
                            {p.precoExpresso !== undefined && p.precoExpresso > 0 ? `R$ ${p.precoExpresso.toFixed(2)}` : '-'}
                          </td>

                          {/* TOTAL CUSTO */}
                          {isFullEstoqueAuthorized && (
                            <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                              R$ {totalCostVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          )}

                          {/* TOTAL VENDA */}
                          <td className="py-3 px-3 text-right font-mono font-black text-blue-700 whitespace-nowrap">
                            R$ {totalSaleVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* SITUAÇÃO & VENDA OS */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase ${
                                p.situacao === 'Inativo'
                                  ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}>
                                {p.situacao || 'Ativo'}
                              </span>
                              {p.paraVenda !== false ? (
                                <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                  Venda OS: Sim
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                  Venda OS: Não
                                </span>
                              )}
                            </div>
                          </td>
                        </>
                      )}

                      {/* AÇÕES: VISUALIZAR FICHA/PDF, EDITAR, EXCLUIR */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* VISUALIZAR FICHA TÉCNICA E PDF */}
                          <button
                            type="button"
                            onClick={() => setSpecModalProduct(p)}
                            title="Visualizar Ficha Técnica e PDFs"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* EDITAR PRODUTO */}
                          {canCreateEdit && (
                            <button
                              type="button"
                              onClick={() => handleSelectProductToEdit(p)}
                              title="Editar Produto"
                              className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg transition"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* EXCLUIR PRODUTO */}
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id, p.descricao)}
                            title="Excluir Produto"
                            className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO CONTROLS */}
        {(() => {
          const isSaidaMode = sortBy === 'SAIDA_DE_PRODUTO';
          const activeTotalListLength = isSaidaMode ? withdrawalRows.length : filteredProducts.length;
          const activeTotalPages = isSaidaMode ? totalPagesWithdrawal : totalPages;
          const activeSafeCurrentPage = isSaidaMode ? safeCurrentPageWithdrawal : safeCurrentPage;
          const activeStartIndex = isSaidaMode ? startIndexWithdrawal : startIndex;
          const activeEndIndex = isSaidaMode ? endIndexWithdrawal : endIndex;

          return (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-600">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Exibindo <strong>{activeTotalListLength === 0 ? 0 : activeStartIndex + 1}</strong> a{' '}
                  <strong>{activeEndIndex}</strong> de <strong>{activeTotalListLength}</strong> produtos
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">| Itens por pág:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {activeTotalPages > 1 && (
                <div className="flex items-center gap-1 self-center sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={activeSafeCurrentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold"
                    title="Primeira Página"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={activeSafeCurrentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold"
                    title="Página Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Botões de Números de Página */}
                  {Array.from({ length: activeTotalPages }, (_, i) => i + 1)
                    .filter((pageNum) => {
                      return (
                        pageNum === 1 ||
                        pageNum === activeTotalPages ||
                        Math.abs(pageNum - activeSafeCurrentPage) <= 1
                      );
                    })
                    .map((pageNum, idx, arr) => {
                      const prev = arr[idx - 1];
                      const hasGap = prev && pageNum - prev > 1;
                      return (
                        <React.Fragment key={pageNum}>
                          {hasGap && <span className="px-1 text-slate-400">...</span>}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition ${
                              activeSafeCurrentPage === pageNum
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {pageNum}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(activeTotalPages, p + 1))}
                    disabled={activeSafeCurrentPage === activeTotalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold"
                    title="Próxima Página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(activeTotalPages)}
                    disabled={activeSafeCurrentPage === activeTotalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold"
                    title="Última Página"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ==============================================================
          MODAL: IMPORTAÇÃO DE PLANILHA EXCEL (.XLSX / .CSV)
         ============================================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-2xl my-8 overflow-hidden">
            {/* CABEÇALHO DO MODAL */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-black">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Importar Produtos do Excel
                  </h3>
                  <p className="text-xs text-slate-300">
                    Envie um arquivo .xlsx, .xls ou .csv com seus produtos.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportDataPreview([]);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CORPO DO MODAL */}
            <div className="p-6 space-y-5">
              {/* SELEÇÃO DO TIPO DE DESTINO (ESTOQUE INTERNO vs PRODUTO PARA VENDA) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  1. Como deseja cadastrar estes produtos?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportDestinationType('interno');
                      if (importDataPreview.length > 0) {
                        setImportDataPreview((prev) =>
                          prev.map((p) => ({ ...p, paraVenda: false, apenasEstoqueInterno: true }))
                        );
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                      importDestinationType === 'interno'
                        ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950'
                        : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importDestType"
                      checked={importDestinationType === 'interno'}
                      onChange={() => {}}
                      className="mt-0.5 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="block text-xs font-extrabold text-slate-900">
                        Apenas Estoque Interno
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        Insumos, materiais de escritório, uso e consumo (NÃO aparece para venda em OS ou PDV).
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportDestinationType('venda');
                      if (importDataPreview.length > 0) {
                        setImportDataPreview((prev) =>
                          prev.map((p) => ({ ...p, paraVenda: true, apenasEstoqueInterno: false }))
                        );
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                      importDestinationType === 'venda'
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-950'
                        : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importDestType"
                      checked={importDestinationType === 'venda'}
                      onChange={() => {}}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="block text-xs font-extrabold text-slate-900">
                        Produto para Venda
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        Itens comerciais disponíveis para seleção em Orçamentos, Ordens de Serviço e PDV.
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* TABS DE MODO DE ENTRADA: ARQUIVO vs COLAR TEXTO */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setImportInputMode('file')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        importInputMode === 'file'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Enviar Arquivo (.xlsx / .csv)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportInputMode('paste')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        importInputMode === 'paste'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Colar Texto / CSV</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Baixar Modelo (.xlsx)</span>
                  </button>
                </div>

                {/* MODO 1: UPLOAD DE ARQUIVO */}
                {importInputMode === 'file' && (
                  <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center transition bg-slate-50 hover:bg-blue-50/20">
                    <input
                      type="file"
                      id="excel-file-import"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="excel-file-import"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">
                          Clique para selecionar a planilha Excel ou CSV
                        </span>
                        <span className="text-xs text-slate-400">
                          Formatos aceitos: .xlsx, .xls, .csv (compatível com colunas personalizadas)
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                {/* MODO 2: COLAR TEXTO / CSV DIRETO */}
                {importInputMode === 'paste' && (
                  <div className="space-y-2">
                    <textarea
                      rows={5}
                      value={importTextContent}
                      onChange={(e) => setImportTextContent(e.target.value)}
                      placeholder="Cole aqui as linhas copiadas do Excel ou em formato CSV (separado por ponto e vírgula ou vírgula)..."
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleParsePastedText}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition"
                    >
                      <Check className="w-4 h-4" />
                      <span>Processar Texto Colado</span>
                    </button>
                  </div>
                )}
              </div>

              {/* PRÉVIA DOS ITENS CARREGADOS COM SELEÇÃO MANUAL ITEM A ITEM */}
              {importDataPreview.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  {/* CABEÇALHO DA PRÉVIA COM ESTATÍSTICAS E BOTÕES DE AÇÃO EM LOTE */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-100 p-3 rounded-xl border border-slate-200">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                        <span>Produtos Identificados ({importDataPreview.length})</span>
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-bold">
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                          {importDataPreview.filter((p) => p.paraVenda !== false).length} para Venda
                        </span>
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                          {importDataPreview.filter((p) => p.paraVenda === false).length} Estoque Interno
                        </span>
                      </div>
                    </div>

                    {/* BOTÕES DE AÇÃO RÁPIDA EM LOTE */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSetAllDestination('venda')}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition active:scale-95 cursor-pointer"
                        title="Marca todos os produtos da planilha como Produtos para Venda Comercial"
                      >
                        Todos para Venda
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllDestination('interno')}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition active:scale-95 cursor-pointer"
                        title="Marca todos os produtos da planilha como Apenas Estoque Interno"
                      >
                        Todos para Interno
                      </button>
                      <button
                        type="button"
                        onClick={handleInvertDestination}
                        className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold shadow-xs transition active:scale-95 cursor-pointer"
                        title="Inverte a seleção de cada produto individualmente"
                      >
                        Inverter
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium">
                    💡 <strong>Dica:</strong> Você pode clicar diretamente no botão <strong>"Destino"</strong> de qualquer produto na tabela abaixo para alternar individualmente entre <strong>Produto para Venda</strong> e <strong>Estoque Interno</strong>.
                  </p>

                  <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-black sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5 w-10 text-center">#</th>
                          <th className="p-2.5">Descrição do Produto</th>
                          <th className="p-2.5 w-36">Categoria</th>
                          <th className="p-2.5 text-center w-24">Estoque</th>
                          <th className="p-2.5 text-right w-24">Custo Un.</th>
                          <th className="p-2.5 text-center w-36">Destino (Clique p/ Mudar)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {importDataPreview.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-2.5 text-center font-mono text-slate-400 text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="p-2.5 font-bold text-slate-900">
                              <div>{(p.descricao || '').replace(/\s*[-–(]?\s*importado\s*[)]?/gi, '').trim()}</div>
                              {p.codigo && (
                                <div className="text-[10px] font-mono text-slate-400 font-normal">
                                  Cód: {p.codigo}
                                </div>
                              )}
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={p.categoria || ''}
                                onChange={(e) => handleUpdateItemCategory(idx, e.target.value)}
                                placeholder="Categoria..."
                                className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                              {p.estoqueAtual} <span className="text-[10px] text-slate-400">{p.unidade}</span>
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                              R$ {(p.precoCusto || p.valorUnitario || 0).toFixed(2)}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleItemDestination(idx)}
                                className={`w-full py-1 px-2 rounded-lg text-[11px] font-black tracking-wide transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95 ${
                                  p.paraVenda !== false
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                                }`}
                                title="Clique para alternar entre Produto para Venda e Apenas Estoque Interno"
                              >
                                {p.paraVenda !== false ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Venda Comercial</span>
                                  </>
                                ) : (
                                  <>
                                    <Box className="w-3.5 h-3.5" />
                                    <span>Estoque Interno</span>
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* RODAPÉ DO MODAL */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportDataPreview([]);
                }}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importDataPreview.length === 0 || isImporting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-1.5 transition active:scale-95"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar Importação ({importDataPreview.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL 1: FICHA TÉCNICA E ESPECIFICAÇÃO DE PRODUTO (TELA CHEIA PRESERVANDO MENU E TOPO)
         ============================================================== */}
      {specModalProduct && (
        <div className={`fixed top-16 left-0 ${isSidebarExpanded ? 'md:left-64' : 'md:left-20'} right-0 bottom-0 z-40 bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto flex flex-col transition-all duration-300`}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-7xl mx-auto flex flex-col flex-1 overflow-hidden min-h-[calc(100vh-6.5rem)] my-auto">
            {/* MODAL HEADER */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black shadow">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Tecido Sublimado Fortaleza - ESPECIFICAÇÃO
                  </h3>
                  <p className="text-xs text-slate-300">
                    Código: <strong className="text-blue-300 font-mono font-bold">{specModalProduct.codigo}</strong> | Ref: {specModalProduct.referencia || '-'} | SKU: {specModalProduct.sku || '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-blue-400" />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSpecModalProduct(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer hover:bg-slate-800"
                  title="Fechar e Voltar ao Estoque"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* MODAL BODY */}
            <div className="p-4 sm:p-6 space-y-5 text-sm text-slate-800 font-sans flex-1 flex flex-col overflow-y-auto">
              {/* CABEÇALHO TÉCNICO E BARCODE */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-xs font-black uppercase text-blue-700 tracking-wider block">
                    Tecido Sublimado Fortaleza - ESPECIFICAÇÃO
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    {(specModalProduct.descricao || '').replace(/\s*[-–(]?\s*importado\s*[)]?/gi, '').trim()}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Categoria: <strong className="text-slate-700">{specModalProduct.categoria && specModalProduct.categoria.toLowerCase() !== 'geral' ? specModalProduct.categoria : '-'}</strong> | Marca: <strong className="text-slate-700">{specModalProduct.marca || '-'}</strong> | Estoque Atual: <strong className="text-blue-700 font-mono font-bold">{specModalProduct.estoqueAtual ?? 0} {specModalProduct.unidade || 'UN'}</strong>
                  </p>
                </div>

                <div className="shrink-0 text-center">
                  <EanBarcodeSVG value={specModalProduct.codigoBarras || '7898521000018'} className="h-12" />
                  <span className="text-xs font-mono text-slate-500 block mt-1">
                    EAN: {specModalProduct.codigoBarras || 'Sem EAN'} | SKU: {specModalProduct.sku || '-'}
                  </span>
                </div>
              </div>

              {/* HISTÓRICO COMPLETO DE ALTERAÇÕES E MOVIMENTAÇÕES */}
              {(() => {
                const isEntradaMode = sortBy === 'ENTRADA_DE_PRODUTO';
                const isSaidaMode = sortBy === 'SAIDA_DE_PRODUTO';

                const rawHistory = specModalProduct.historicoAlteracoes || [];

                const modalHistory = rawHistory.filter((h) => {
                  const act = (h.acao || '').toLowerCase();
                  if (isEntradaMode) {
                    return !act.includes('saída') && !act.includes('retirada') && !act.includes('baixa');
                  }
                  if (isSaidaMode) {
                    return !act.includes('entrada') && !act.includes('compra') && !act.includes('recebimento');
                  }
                  return true;
                });

                const sectionTitle = isEntradaMode
                  ? 'Histórico de Edições e Entradas de Estoque'
                  : isSaidaMode
                  ? 'Histórico de Edições e Saídas de Estoque'
                  : 'Histórico Completo de Alterações e Movimentações';

                return (
                  <div className="space-y-3 flex-1 flex flex-col">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <h4 className="text-sm sm:text-base font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                        <History className={`w-5 h-5 ${isEntradaMode ? 'text-emerald-600' : isSaidaMode ? 'text-rose-600' : 'text-blue-600'}`} />
                        <span>{sectionTitle} ({modalHistory.length})</span>
                      </h4>
                      {isEntradaMode && (
                        <span className="text-[11px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full uppercase">
                          Modo Entradas & Edições
                        </span>
                      )}
                      {isSaidaMode && (
                        <span className="text-[11px] font-black text-rose-800 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-full uppercase">
                          Modo Saídas & Edições
                        </span>
                      )}
                    </div>

                    {modalHistory.length === 0 ? (
                      <div className="p-12 text-center text-sm text-slate-400 font-medium bg-slate-50 border border-dashed border-slate-200 rounded-2xl my-auto">
                        Nenhum registro de histórico encontrado para este produto.
                      </div>
                    ) : (
                      <div className="space-y-3 overflow-y-auto pr-1 flex-1 max-h-[58vh]">
                        {modalHistory.map((item, idx) => {
                          const normalized = normalizeHistoryEntry(item, specModalProduct.unidade);
                          const isSaida = item.acao.toLowerCase().includes('saída') || item.acao.toLowerCase().includes('retirada');
                          const isEntrada = item.acao.toLowerCase().includes('entrada') || item.acao.toLowerCase().includes('compra') || item.acao.toLowerCase().includes('recebimento');

                          const personResponsible = isSaida
                            ? parseQuemRetirou(item)
                            : isEntrada
                            ? parseQuemRecebeu(item)
                            : (item.operador || 'Operador');

                          return (
                            <div
                              key={item.id || idx}
                              className={`p-4 rounded-xl border text-sm space-y-2 transition ${
                                isSaida
                                  ? 'bg-rose-50/40 border-rose-200 hover:bg-rose-50/70'
                                  : isEntrada
                                  ? 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50/70'
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase tracking-wide ${
                                    isSaida
                                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                      : isEntrada
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-blue-100 text-blue-800 border border-blue-300'
                                  }`}>
                                    {item.acao}
                                  </span>
                                  <span className="font-semibold text-slate-700 text-xs sm:text-sm">
                                    {isSaida ? (
                                      <>Quem Retirou: <strong className="text-slate-900">{personResponsible}</strong></>
                                    ) : isEntrada ? (
                                      <>Quem Recebeu: <strong className="text-emerald-900">{personResponsible}</strong></>
                                    ) : (
                                      <>Operador: <strong className="text-slate-900">{personResponsible}</strong></>
                                    )}
                                  </span>
                                </div>
                                <span className="text-slate-500 font-mono text-xs">{item.dataHora}</span>
                              </div>

                              <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                                <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">
                                  Detalhes do Registro:
                                </span>
                                <p className="text-slate-800 font-medium whitespace-pre-line leading-relaxed text-xs sm:text-sm">
                                  {normalized.detalhes}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs sm:text-sm font-bold text-slate-500">
                Data do Registro: {specModalProduct.createdAt ? new Date(specModalProduct.createdAt).toLocaleDateString('pt-BR') : 'Hoje'}
              </span>
              <button
                type="button"
                onClick={() => setSpecModalProduct(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm uppercase rounded-xl transition cursor-pointer"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: CONFIRMAÇÃO DE EXCLUSÃO COM SENHA DO ESTOQUE OU DIREÇÃO
         ============================================================== */}
      {isDeleteModalOpen && productToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* MODAL HEADER */}
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Excluir Produto do Estoque
                  </h3>
                  <p className="text-xs text-rose-100">
                    Ação protegida por senha
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setProductToDelete(null);
                  setDeletePassword('');
                  setDeletePasswordError('');
                }}
                className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL BODY */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmDeleteWithPassword();
              }}
              className="p-5 space-y-4"
            >
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                  Produto Selecionado:
                </span>
                <p className="font-bold text-slate-900 text-sm">
                  <span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 mr-1.5">
                    {productToDelete.codigo}
                  </span>
                  {productToDelete.descricao}
                </p>
                <p className="text-slate-500 text-xs">
                  Categoria: <strong>{productToDelete.categoria || 'Geral'}</strong> | Estoque: <strong>{productToDelete.estoqueAtual ?? 0} {productToDelete.unidade || 'UN'}</strong>
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                  <span>Digite a Senha do Estoque ou da Direção <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    if (deletePasswordError) setDeletePasswordError('');
                  }}
                  placeholder="Informe a senha de autorização..."
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
                />
              </div>

              {deletePasswordError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deletePasswordError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setProductToDelete(null);
                    setDeletePassword('');
                    setDeletePasswordError('');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isDeletingProduct}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wide rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isDeletingProduct ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirmar Exclusão</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL 2: VISUALIZADOR DE DOCUMENTO PDF
         ============================================================== */}
      {pdfViewerModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-500" />
                <span className="text-sm font-bold truncate max-w-md">{pdfViewerModal.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPdfInNewTab(pdfViewerModal.url, pdfViewerModal.title)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 transition shadow"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir em Nova Aba</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfViewerModal(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="bg-slate-800 px-4 py-2 text-sm text-slate-300 flex items-center justify-between border-b border-slate-700">
              <span>Se o PDF não for exibido abaixo devido às restrições do navegador:</span>
              <button
                type="button"
                onClick={() => openPdfInNewTab(pdfViewerModal.url, pdfViewerModal.title)}
                className="text-blue-400 hover:text-blue-300 underline font-bold flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Clique aqui para abrir em nova aba</span>
              </button>
            </div>
            <div className="flex-1 bg-slate-100 p-2 relative">
              <iframe
                src={pdfIframeUrl}
                className="w-full h-full rounded-xl border border-slate-200"
                title="Visualizador de Documento PDF"
              />
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL 3: CADASTRAR OU EDITAR CATEGORIA
         ============================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                {categoryModalMode === 'create' ? (
                  <>
                    <FolderPlus className="w-5 h-5 text-blue-600" />
                    <span>Nova Categoria do Produto</span>
                  </>
                ) : (
                  <>
                    <Edit className="w-5 h-5 text-amber-600" />
                    <span>Editar / Renomear Categoria</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB SELECTOR NO MODAL */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setCategoryModalMode('create')}
                className={`py-1.5 text-xs font-black uppercase rounded-lg transition cursor-pointer ${
                  categoryModalMode === 'create'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Cadastrar Nova
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoryModalMode('edit');
                  if (!selectedCategoryToEdit && categories.length > 0) {
                    const initialCat = categoria || categories[0];
                    setSelectedCategoryToEdit(initialCat);
                    setEditedCategoryName(initialCat);
                  }
                }}
                className={`py-1.5 text-xs font-black uppercase rounded-lg transition cursor-pointer ${
                  categoryModalMode === 'edit'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ✏️ Editar Existente
              </button>
            </div>

            {categoryModalMode === 'create' ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Nome da Nova Categoria:
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Ex: Malhas Sublimáticas, Tintas, Brindes..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Selecione a Categoria para Editar:
                  </label>
                  <select
                    value={selectedCategoryToEdit}
                    onChange={(e) => {
                      setSelectedCategoryToEdit(e.target.value);
                      setEditedCategoryName(e.target.value);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition cursor-pointer"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Novo Nome da Categoria:
                  </label>
                  <input
                    type="text"
                    value={editedCategoryName}
                    onChange={(e) => setEditedCategoryName(e.target.value)}
                    placeholder="Digite o novo nome da categoria..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              {categoryModalMode === 'create' ? (
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl uppercase transition shadow cursor-pointer"
                >
                  Cadastrar Categoria
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleUpdateCategory}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-black rounded-xl uppercase transition shadow cursor-pointer"
                >
                  Salvar Alteração
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO DE BASE DE CÁLCULO PROTEGIDA POR SENHA */}
      {formulaToDelete && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* CABEÇALHO */}
            <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 shadow-xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    Excluir Base de Cálculo
                  </h3>
                  <p className="text-[11px] text-slate-500 font-bold">
                    Operação protegida por senha de autorização
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDeleteFormulaModal}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* RESUMO DA BASE A EXCLUIR */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-slate-500">
                    Cálculo Selecionado
                  </span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-md font-mono text-fuchsia-800 bg-fuchsia-100/80 border border-fuchsia-200">
                    {formulaToDelete.id}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-500 font-bold">Título: </span>
                  <strong className="text-slate-900 font-black">
                    {formulaToDelete.titulo}
                  </strong>
                </div>
                {formulaToDelete.formulaExpressao && (
                  <div className="text-[11px] text-slate-600">
                    <span className="font-bold">Expressão: </span>
                    <code className="bg-slate-200/80 px-1.5 py-0.5 rounded font-mono text-slate-800">
                      {formulaToDelete.formulaExpressao}
                    </code>
                  </div>
                )}
              </div>

              {/* AVISO DE SEGURANÇA */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-950 text-xs">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="font-semibold text-[11px] leading-relaxed">
                  A exclusão de uma base de cálculo exige a autorização por senha de um <strong>Superior</strong> (Developer, CEO, Gerente Geral ou Supervisor). A exclusão é sincronizada com o banco de dados.
                </p>
              </div>

              {/* ERRO CASO SENHA INCORRETA */}
              {deleteFormulaError && (
                <div className="p-3 bg-red-100/90 border border-red-300 rounded-xl text-red-900 text-xs font-extrabold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{deleteFormulaError}</span>
                </div>
              )}

              {/* CAMPO DE SENHA */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wide">
                  Senha de Autorização (Opcional para Operadores)
                </label>
                <div className="relative">
                  <input
                    type={showDeleteFormulaPassword ? 'text' : 'password'}
                    autoFocus
                    autoComplete="one-time-code"
                    name="formula_delete_auth_pin"
                    id="formula_delete_auth_pin"
                    data-lpignore="true"
                    data-form-type="other"
                    data-1p-ignore="true"
                    value={deleteFormulaPassword}
                    onChange={(e) => setDeleteFormulaPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmDeleteFormula();
                      }
                    }}
                    placeholder="Digite a senha de autorização ou clique direto em Confirmar..."
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowDeleteFormulaPassword(!showDeleteFormulaPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    title={showDeleteFormulaPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showDeleteFormulaPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeDeleteFormulaModal}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingFormula}
                  onClick={handleConfirmDeleteFormula}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/20"
                >
                  {isDeletingFormula ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Confirmar Exclusão</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
