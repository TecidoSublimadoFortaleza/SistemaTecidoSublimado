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
import { formatDateBR } from '../../utils/formatters';
import { getLoggedUserAndPerfil, canUserPerformAction } from '../../utils/userPermissions';
import { verifySuperiorPassword } from '../../utils/superiorAuth';
import { MeasurementFormulaModal } from '../estoque/MeasurementFormulaModal';
import {
  MeasurementFormula,
  DEFAULT_MEASUREMENT_FORMULAS,
  FORMULA_PADRAO_MESA,
  FORMULA_CUBO_MESA_VESTE,
} from '../../types/measurementFormula';
import { EanBarcodeSVG, openPdfInNewTab } from '../estoque/EstoqueModuleView';

interface ProdutosVendaModuleViewProps {
  user?: UserProfile | null;
  isSidebarExpanded?: boolean;
}

// Converte data URL em Blob URL para visualização segura de PDFs
const dataUrlToBlobUrl = (dataUrl: string): string => {
  if (!dataUrl) return '';
  if (!dataUrl.startsWith('data:')) return dataUrl;
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
  } catch {
    return dataUrl;
  }
};

/**
 * CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
 * Módulo especializado e dedicado "PRODUTOS DE VENDA".
 * Responsável pelo cadastro, gerenciamento de estoque comercial, controle de entradas/saídas
 * e especificações técnicas exclusivas dos produtos destinados à venda em Ordens de Serviço (OS) e PDV.
 * Possui 5 modais/seções operacionais:
 * 1. Dados Gerais (Informações Principais do Produto com Preço Custo, Venda, Expresso, NCM, CFOP, Origem, Peso, Dimensões)
 * 2. Produtos para venda (Habilitação com Medidas & Fórmulas Sequenciais)
 * 3. Entra e sai
 * 4. Arquivos & PDFs
 * 5. Observações
 */
export const ProdutosVendaModuleView: React.FC<ProdutosVendaModuleViewProps> = ({
  user,
  isSidebarExpanded = true,
}) => {
  // ----------------------------------------------------
  // ESTADOS DO CATÁLOGO DE PRODUTOS DE VENDA
  // ----------------------------------------------------
  const [products, setProducts] = useState<ProductCatalog[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
  // 5 Abas/Modais operacionais solicitadas para o módulo de Produtos de Venda
  const [activeTab, setActiveTab] = useState<'dados' | 'venda' | 'entra-sai' | 'arquivos' | 'observacoes'>('dados');
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
  const [editingFormula, setEditingFormula] = useState<MeasurementFormula | null>(null);
  const [precoPorM2, setPrecoPorM2] = useState<string>('');
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

  // Estados dos Campos do Formulário de Produto de Venda
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string>('');
  const [referencia, setReferencia] = useState<string>('');
  const [sku, setSku] = useState<string>('');
  const [codigoBarras, setCodigoBarras] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');
  const [categoria, setCategoria] = useState<string>('');
  const [marca, setMarca] = useState<string>('');
  const [unidade, setUnidade] = useState<string>('UN');
  const [precoCusto, setPrecoCusto] = useState<string>('');
  const [precoVenda, setPrecoVenda] = useState<string>('');
  const [precoExpresso, setPrecoExpresso] = useState<string>('');
  const [margemLucro, setMargemLucro] = useState<string>('');
  const [situacao, setSituacao] = useState<'Ativo' | 'Inativo'>('Ativo');

  // Campos Fiscais e Dimensões
  const [ncm, setNcm] = useState<string>('');
  const [cfop, setCfop] = useState<string>('');
  const [origemMercadoria, setOrigemMercadoria] = useState<string>('0 - Nacional');
  const [pesoUnitarioKg, setPesoUnitarioKg] = useState<string>('');
  const [dimensoes, setDimensoes] = useState<string>('');

  // Estoque & Lote
  const [estoqueAtual, setEstoqueAtual] = useState<string>('0');
  const [estoqueMinimo, setEstoqueMinimo] = useState<string>('5');
  const [estoqueMaximo, setEstoqueMaximo] = useState<string>('100');
  const [lote, setLote] = useState<string>('');
  const [dataValidade, setDataValidade] = useState<string>('');
  const [fornecedorPrincipal, setFornecedorPrincipal] = useState<string>('');
  const [custoUltimaCompra, setCustoUltimaCompra] = useState<string>('');

  // Entradas de Estoque
  const [qtdEntrada, setQtdEntrada] = useState<string>('');
  const [quemRecebeu, setQuemRecebeu] = useState<string>('');
  const [origemEntrada, setOrigemEntrada] = useState<string>('');
  const [dataHoraEntrada, setDataHoraEntrada] = useState<string>('');
  const [motivoEntrada, setMotivoEntrada] = useState<string>('');
  const [novoCustoEntrada, setNovoCustoEntrada] = useState<string>('');

  // Saídas de Estoque
  const [qtdSaida, setQtdSaida] = useState<string>('');
  const [quemRetirou, setQuemRetirou] = useState<string>('');
  const [setorDestinoSaida, setSetorDestinoSaida] = useState<string>('Comercial / Vendas');
  const [dataHoraSaida, setDataHoraSaida] = useState<string>('');
  const [motivoSaida, setMotivoSaida] = useState<string>('');

  // Arquivos, Fotos & PDFs
  const [fotoUrl, setFotoUrl] = useState<string>('');
  const [anexosPdf, setAnexosPdf] = useState<ProductPdfAttachment[]>([]);
  const [observacoes, setObservacoes] = useState<string>('');

  // Modais de Apoio
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDataPreview, setImportDataPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [categoryModalMode, setCategoryModalMode] = useState<'create' | 'edit'>('create');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [selectedCategoryToEdit, setSelectedCategoryToEdit] = useState<string>('');
  const [editedCategoryName, setEditedCategoryName] = useState<string>('');

  const [specModalProduct, setSpecModalProduct] = useState<ProductCatalog | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [productToDelete, setProductToDelete] = useState<ProductCatalog | null>(null);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [pdfViewerModal, setPdfViewerModal] = useState<{ title: string; url: string } | null>(null);
  const [historyModalProduct, setHistoryModalProduct] = useState<ProductCatalog | null>(null);
  const pdfBlobUrl = useMemo(() => {
    if (!pdfViewerModal?.url) return '';
    return dataUrlToBlobUrl(pdfViewerModal.url);
  }, [pdfViewerModal?.url]);

  // Filtros de Tabela
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('TODAS');
  const [filterStatus, setFilterStatus] = useState<string>('TODAS');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('ULTIMOS_CADASTRADOS');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Operador logado
  const operadorLogado = useMemo(() => {
    if (user?.name) return user.name;
    try {
      const logged = getLoggedUserAndPerfil();
      return logged.username || 'Operador Comercial';
    } catch {
      return 'Operador Comercial';
    }
  }, [user]);

  // Recarregar Dados
  const fetchData = async (force: boolean = false) => {
    setIsLoading(true);
    try {
      const [prodsData, catsData, formulasData] = await Promise.all([
        ApiService.getProducts(force),
        ApiService.getCategories({ scope: 'venda', origem: 'PRODUTOS_VENDA' }),
        ApiService.getMeasurementFormulas(true).catch(() => DEFAULT_MEASUREMENT_FORMULAS),
      ]);
      setProducts((prodsData || []).filter((p: any) => !p.deletedAt && p.status !== 'INACTIVE'));
      const retired = ['geral', 'cetim', 'dryfit', 'microfibra', 'neoprene'];
      const cleanCats = (catsData || [])
        .map((c: any) => (typeof c === 'string' ? c : c.nome || ''))
        .filter((c: string) => {
          if (!c) return false;
          const lower = c.toLowerCase().trim();
          if (retired.includes(lower)) return false;
          if (lower.includes('apenas estoque') || lower.includes('estoque interno') || lower.includes('produto interno') || lower.includes('insumo')) return false;
          return true;
        });
      setCategories(cleanCats);
      if (Array.isArray(formulasData) && formulasData.length > 0) {
        setFormulas(formulasData);
      }
    } catch (err: any) {
      console.error('Erro ao buscar catálogo de produtos de venda:', err);
      setFeedback({ type: 'error', message: 'Falha ao sincronizar produtos de venda com o servidor.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleRefresh = () => fetchData(true);
    window.addEventListener('products-changed', handleRefresh);
    return () => window.removeEventListener('products-changed', handleRefresh);
  }, []);

  // Inicializa datas e operador nos registros de entrada e saída
  useEffect(() => {
    const nowStr = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    setDataHoraEntrada(nowStr);
    setDataHoraSaida(nowStr);
    if (!quemRecebeu) setQuemRecebeu(operadorLogado);
    if (!quemRetirou) setQuemRetirou(operadorLogado);
  }, [operadorLogado, editingId]);

  // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
  // Filtro exclusivo: exibe apenas produtos cadastrados para venda comercial ("Produtos para vendas").
  // Os produtos cadastrados em "PRODUTOS DE VENDA" não devem aparecer em "estoque" e vice-versa.
  // Produtos de estoque interno NUNCA devem aparecer aqui.
  const visibleProducts = useMemo(() => {
    return products.filter((p) => {
      // Produtos de estoque interno NUNCA devem aparecer em produtos de venda
      if (p.origemCadastro === 'ESTOQUE') return false;
      if (p.paraVenda === false) return false;
      if ((p as any).apenasEstoqueInterno === true) return false;
      if ((p as any).isInternal === true) return false;
      const catLower = (p.categoria || '').toLowerCase();
      if (
        catLower.includes('produto interno') ||
        catLower.includes('insumo') ||
        catLower.includes('matéria prima') ||
        catLower.includes('materia prima')
      ) {
        return false;
      }
      return true;
    });
  }, [products]);

  // Cálculo automático de Margem de Lucro (%)
  useEffect(() => {
    const custo = parseFloat(precoCusto);
    const venda = parseFloat(precoVenda);
    if (!isNaN(custo) && !isNaN(venda) && custo > 0) {
      const margem = ((venda - custo) / custo) * 100;
      setMargemLucro(margem.toFixed(1));
    }
  }, [precoCusto, precoVenda]);

  // Gerador automático de EAN-13
  const handleGenerateEan13 = () => {
    const prefix = '7898521';
    const rand = Math.floor(10000 + Math.random() * 90000).toString();
    const base12 = `${prefix}${rand}`;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const n = parseInt(base12[i], 10);
      sum += i % 2 === 0 ? n : n * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const generated = `${base12}${checkDigit}`;
    setCodigoBarras(generated);
    if (!sku) setSku(`SKU-${rand}`);
  };

  // Gerador automático de Código de Produto de Venda
  const handleGenerateNextCode = () => {
    const maxNum = visibleProducts.reduce((max, p) => {
      const match = (p.codigo || '').match(/(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        return n > max ? n : max;
      }
      return max;
    }, 0);
    const nextCode = `VENDA-${String(maxNum + 1).padStart(4, '0')}`;
    setCodigo(nextCode);
  };

  // Limpa formulário para novo cadastro
  const handleClearForm = () => {
    setEditingId(null);
    setCodigo('');
    setReferencia('');
    setSku('');
    setCodigoBarras('');
    setDescricao('');
    setCategoria(categories[0] || 'Geral');
    setMarca('');
    setUnidade('UN');
    setPrecoCusto('');
    setPrecoVenda('');
    setPrecoExpresso('');
    setMargemLucro('');
    setSituacao('Ativo');
    setNcm('');
    setCfop('');
    setOrigemMercadoria('0 - Nacional');
    setPesoUnitarioKg('');
    setDimensoes('');
    setComMedidas(false);
    setSelectedFormulaId('');
    setPrecoPorM2('');
    setEstoqueAtual('0');
    setEstoqueMinimo('5');
    setEstoqueMaximo('100');
    setLote('');
    setDataValidade('');
    setFornecedorPrincipal('');
    setCustoUltimaCompra('');
    setFotoUrl('');
    setAnexosPdf([]);
    setObservacoes('');
    setActiveTab('dados');
    setFeedback({ type: 'info', message: 'Formulário pronto para novo cadastro de Produto de Venda.' });
  };

  // Seleciona produto para edição nas 5 abas
  const handleSelectProductToEdit = (prod: ProductCatalog) => {
    setEditingId(prod.id);
    setCodigo(prod.codigo || '');
    setReferencia(prod.referencia || '');
    setSku(prod.sku || '');
    setCodigoBarras(prod.codigoBarras || '');
    setDescricao(prod.descricao || '');
    setCategoria(prod.categoria || categories[0] || 'Geral');
    setMarca(prod.marca || '');
    setUnidade(prod.unidade || 'UN');
    setPrecoCusto(prod.precoCusto !== undefined ? String(prod.precoCusto) : '');
    setPrecoVenda(prod.precoVenda !== undefined ? String(prod.precoVenda) : '');
    setPrecoExpresso(prod.precoExpresso !== undefined ? String(prod.precoExpresso) : '');
    setSituacao(prod.situacao || 'Ativo');
    setNcm(prod.ncm || '');
    setCfop(prod.cfop || '');
    setOrigemMercadoria(prod.origemMercadoria || '0 - Nacional');
    setPesoUnitarioKg(prod.pesoUnitarioKg !== undefined ? String(prod.pesoUnitarioKg) : '');
    setDimensoes(prod.dimensoes || '');
    setComMedidas(Boolean(prod.comMedidas));
    setSelectedFormulaId(prod.formulaMedidaId || '');
    setPrecoPorM2((prod as any).precoPorM2 !== undefined ? String((prod as any).precoPorM2) : '');
    setEstoqueAtual(String(prod.estoqueAtual ?? 0));
    setEstoqueMinimo(String(prod.estoqueMinimo ?? 5));
    setEstoqueMaximo(String(prod.estoqueMaximo ?? 100));
    setLote(prod.lote || '');
    setDataValidade(prod.dataValidade || '');
    setFornecedorPrincipal(prod.fornecedorPrincipal || '');
    setCustoUltimaCompra(prod.custoUltimaCompra !== undefined ? String(prod.custoUltimaCompra) : '');
    setFotoUrl(prod.fotoUrl || '');
    setAnexosPdf(prod.anexosPdf || []);
    setObservacoes(prod.observacoes || '');
    setActiveTab('dados');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Upload de Foto Principal
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'A imagem deve ter no máximo 15MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFotoUrl(reader.result as string);
      setFeedback({ type: 'success', message: 'Foto do produto carregada com sucesso!' });
    };
    reader.readAsDataURL(file);
  };

  // Upload de PDFs
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setFeedback({ type: 'error', message: 'Apenas arquivos em formato PDF são aceitos.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const newPdf: ProductPdfAttachment = {
        id: `PDF-${Date.now()}`,
        nome: file.name,
        tamanho: `${(file.size / 1024).toFixed(0)} KB`,
        dataEnvio: new Date().toLocaleDateString('pt-BR'),
        url: reader.result as string,
      };
      setAnexosPdf((prev) => [...prev, newPdf]);
      setFeedback({ type: 'success', message: `Arquivo "${file.name}" anexado com sucesso!` });
    };
    reader.readAsDataURL(file);
  };

  // Restaurar fórmulas padrão
  const handleRestoreDefaultFormulas = async () => {
    try {
      localStorage.removeItem('subligestao_deleted_measurement_formulas');
      setFormulas(DEFAULT_MEASUREMENT_FORMULAS);
      setFeedback({ type: 'success', message: 'Fórmulas padrão de medidas restauradas com sucesso!' });
    } catch (_) {}
  };

  // Excluir fórmula
  const handleDeleteFormula = (formulaId: string) => {
    const updated = formulas.filter((f) => f.id !== formulaId);
    setFormulas(updated);
    if (selectedFormulaId === formulaId) {
      setSelectedFormulaId('');
    }
    try {
      const delCached = localStorage.getItem('subligestao_deleted_measurement_formulas');
      let delList: string[] = delCached ? JSON.parse(delCached) : [];
      if (!delList.includes(formulaId)) {
        delList.push(formulaId);
        localStorage.setItem('subligestao_deleted_measurement_formulas', JSON.stringify(delList));
      }
      localStorage.setItem('subligestao_measurement_formulas', JSON.stringify(updated));
    } catch (_) {}
    setFeedback({ type: 'info', message: 'Fórmula de cálculo removida.' });
  };

  // ----------------------------------------------------
  // GESTÃO DE CATEGORIAS (MESMA LÓGICA DO MÓDULO ESTOQUE)
  // ----------------------------------------------------
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

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const trimmed = newCategoryName.trim();
      const updatedCats = await ApiService.addCategory(trimmed, {
        origem: 'PRODUTOS_VENDA',
        paraVenda: true,
        apenasEstoqueInterno: false,
      });
      setCategories(updatedCats || []);
      setCategoria(trimmed);
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Categoria "${trimmed}" cadastrada e selecionada com sucesso!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Erro ao cadastrar categoria.' });
    }
  };

  const handleUpdateCategory = async () => {
    if (!selectedCategoryToEdit.trim() || !editedCategoryName.trim()) return;
    try {
      const oldCat = selectedCategoryToEdit.trim();
      const newCat = editedCategoryName.trim();
      const updatedCats = await ApiService.updateCategory(oldCat, newCat, {
        origem: 'PRODUTOS_VENDA',
        paraVenda: true,
        apenasEstoqueInterno: false,
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

  // Salvar Produto de Venda (Create / Update)
  const handleSaveProduct = async () => {
    if (!descricao.trim()) {
      setFeedback({ type: 'error', message: 'A descrição do produto de venda é obrigatória.' });
      setActiveTab('dados');
      return;
    }

    const costPrice = parseFloat(precoCusto) || 0;
    const salePrice = parseFloat(precoVenda) || 0;
    const expressPrice = parseFloat(precoExpresso) || 0;
    const currentStock = parseFloat(estoqueAtual) || 0;
    const minStock = parseFloat(estoqueMinimo) || 0;
    const maxStock = parseFloat(estoqueMaximo) || 500;
    const finalCode = codigo.trim() || `VENDA-${String(Date.now()).slice(-4)}`;

    const nowIso = new Date().toISOString();
    const payload: Partial<ProductCatalog> = {
      updatedAt: nowIso,
      codigo: finalCode,
      referencia: referencia.trim(),
      sku: sku.trim(),
      codigoBarras: codigoBarras.trim(),
      descricao: descricao.trim(),
      categoria: categoria || categories[0] || 'Geral',
      marca: marca.trim(),
      unidade: unidade || 'UN',
      precoCusto: costPrice,
      precoVenda: salePrice,
      precoExpresso: expressPrice,
      valorUnitario: salePrice,
      precoMedio: salePrice,
      situacao,
      ncm: ncm.trim(),
      cfop: cfop.trim(),
      origemMercadoria: origemMercadoria.trim(),
      pesoUnitarioKg: pesoUnitarioKg ? parseFloat(pesoUnitarioKg) : undefined,
      dimensoes: dimensoes.trim(),
      estoqueAtual: currentStock,
      estoqueMinimo: minStock,
      estoqueMaximo: maxStock,
      lote: lote.trim(),
      dataValidade: dataValidade.trim(),
      fornecedorPrincipal: fornecedorPrincipal.trim(),
      custoUltimaCompra: custoUltimaCompra ? parseFloat(custoUltimaCompra) : costPrice,
      fotoUrl,
      anexosPdf,
      observacoes,
      origemCadastro: 'PRODUTOS_VENDA',
      paraVenda: true,
      apenasEstoqueInterno: false,
      isInternal: false,
      comMedidas,
      formulaMedidaId: comMedidas && selectedFormulaId ? selectedFormulaId : '',
      formulaMedidaTitulo: comMedidas && selectedFormulaId ? (formulas.find((f) => f.id === selectedFormulaId)?.titulo || '') : '',
      ...({
        margemLucro: margemLucro ? parseFloat(margemLucro) : 0,
        precoPorM2: comMedidas && precoPorM2 ? parseFloat(precoPorM2) : undefined,
      } as any),
    };

    try {
      if (editingId) {
        // UPDATE
        const existing = products.find((p) => p.id === editingId);
        const history: ProductHistoryEntry[] = existing?.historicoAlteracoes || [];
        const updateHistoryEntry: ProductHistoryEntry = {
          id: `HST-${Date.now()}`,
          dataHora: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
          acao: 'Atualização de Cadastro',
          operador: operadorLogado,
          detalhes: `Produto atualizado via Produtos de Venda. Estoque: ${currentStock} ${unidade} | Preço Venda: R$ ${salePrice.toFixed(2)}`,
        };
        payload.historicoAlteracoes = [updateHistoryEntry, ...history];

        const updated = await ApiService.updateProduct(editingId, payload);
        if (updated) {
          setProducts((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
          setFeedback({ type: 'success', message: `Produto ${updated.codigo} atualizado com sucesso!` });
        }
      } else {
        // CREATE NEW
        const newHistoryEntry: ProductHistoryEntry = {
          id: `HST-${Date.now()}`,
          dataHora: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
          acao: 'Cadastro Inicial (Produtos de Venda)',
          operador: operadorLogado,
          detalhes: `Produto cadastrado em Produtos de Venda. Estoque Inicial: ${currentStock} ${unidade} | Preço Venda: R$ ${salePrice.toFixed(2)}`,
        };
        payload.createdAt = nowIso;
        payload.historicoAlteracoes = [newHistoryEntry];

        const created = await ApiService.createProduct(payload);
        if (created) {
          setProducts((prev) => [created, ...prev]);
          setFeedback({ type: 'success', message: `Produto de Venda ${created.codigo} cadastrado com sucesso!` });
          handleClearForm();
        }
      }

      // Adiciona categoria se for nova
      const currentCat = (categoria || categories[0] || '').trim();
      if (currentCat && !categories.includes(currentCat)) {
        await ApiService.addCategory(currentCat, { paraVenda: true, apenasEstoqueInterno: false }).catch(() => {});
        setCategories((prev) => [currentCat, ...prev]);
      }
    } catch (err: any) {
      console.error('Erro ao salvar produto de venda:', err);
      setFeedback({ type: 'error', message: `Falha ao salvar produto: ${err?.message || 'Erro desconhecido'}` });
    }
  };

  // Registrar Entrada no Entra e Sai
  const handleRegistrarEntrada = async () => {
    const qtd = parseFloat(qtdEntrada);
    if (isNaN(qtd) || qtd <= 0) {
      setFeedback({ type: 'error', message: 'Informe uma quantidade válida maior que zero para entrada.' });
      return;
    }
    if (!quemRecebeu.trim()) {
      setFeedback({ type: 'error', message: 'Informe quem recebeu o produto.' });
      return;
    }

    const current = parseFloat(estoqueAtual) || 0;
    const novoEstoque = current + qtd;
    setEstoqueAtual(String(novoEstoque));

    const entryDetail = `ENTRADA: +${qtd} ${unidade} recebido por ${quemRecebeu.trim()}${origemEntrada ? ` (${origemEntrada.trim()})` : ''}. Motivo: ${motivoEntrada || 'Reposição de Vendas'}. Estoque anterior: ${current}. Novo estoque: ${novoEstoque}.`;

    if (editingId) {
      const prod = products.find((p) => p.id === editingId);
      const history = prod?.historicoAlteracoes || [];
      const newEntry: ProductHistoryEntry = {
        id: `ENT-${Date.now()}`,
        dataHora: dataHoraEntrada || new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
        acao: 'Entrada de Estoque',
        operador: quemRecebeu.trim(),
        detalhes: entryDetail,
      };

      const nowIso = new Date().toISOString();
    const payload: Partial<ProductCatalog> = {
      updatedAt: nowIso,
        estoqueAtual: novoEstoque,
        historicoAlteracoes: [newEntry, ...history],
      };

      if (novoCustoEntrada) {
        payload.precoCusto = parseFloat(novoCustoEntrada);
        payload.custoUltimaCompra = parseFloat(novoCustoEntrada);
      }

      await ApiService.updateProduct(editingId, payload);
      setProducts((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...payload } : p)));
    }

    setQtdEntrada('');
    setMotivoEntrada('');
    setNovoCustoEntrada('');
    setFeedback({ type: 'success', message: `Entrada de +${qtd} ${unidade} registrada com sucesso!` });
  };

  // Registrar Saída no Entra e Sai
  const handleRegistrarSaida = async () => {
    const qtd = parseFloat(qtdSaida);
    const current = parseFloat(estoqueAtual) || 0;

    if (isNaN(qtd) || qtd <= 0) {
      setFeedback({ type: 'error', message: 'Informe uma quantidade válida maior que zero para saída.' });
      return;
    }
    if (qtd > current) {
      setFeedback({ type: 'error', message: `Saldo insuficiente! Estoque atual é de ${current} ${unidade}.` });
      return;
    }
    if (!quemRetirou.trim()) {
      setFeedback({ type: 'error', message: 'Informe quem retirou o produto.' });
      return;
    }

    const novoEstoque = current - qtd;
    setEstoqueAtual(String(novoEstoque));

    const exitDetail = `SAÍDA: -${qtd} ${unidade} retirado por ${quemRetirou.trim()} para ${setorDestinoSaida}. Motivo: ${motivoSaida || 'Venda Comercial / OS'}. Estoque anterior: ${current}. Novo estoque: ${novoEstoque}.`;

    if (editingId) {
      const prod = products.find((p) => p.id === editingId);
      const history = prod?.historicoAlteracoes || [];
      const newExit: ProductHistoryEntry = {
        id: `SAI-${Date.now()}`,
        dataHora: dataHoraSaida || new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
        acao: 'Saída de Estoque',
        operador: quemRetirou.trim(),
        detalhes: exitDetail,
      };

      const nowIso = new Date().toISOString();
    const payload: Partial<ProductCatalog> = {
      updatedAt: nowIso,
        estoqueAtual: novoEstoque,
        historicoAlteracoes: [newExit, ...history],
      };

      await ApiService.updateProduct(editingId, payload);
      setProducts((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...payload } : p)));
    }

    setQtdSaida('');
    setMotivoSaida('');
    setFeedback({ type: 'success', message: `Saída de -${qtd} ${unidade} registrada com sucesso!` });
  };

  // Confirmar Exclusão com Senha Superior
  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setDeleteError(null);

    const isAuthorized = verifySuperiorPassword(deletePassword);
    if (!isAuthorized) {
      setDeleteError('Senha de superior inválida ou não autorizada para exclusão.');
      return;
    }

    try {
      await ApiService.deleteProduct(productToDelete.id);
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
      if (editingId === productToDelete.id) {
        handleClearForm();
      }
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
      setDeletePassword('');
      setFeedback({ type: 'success', message: `Produto de Venda "${productToDelete.descricao}" excluído com sucesso.` });
    } catch (err: any) {
      setDeleteError(err?.message || 'Falha ao excluir produto no servidor.');
    }
  };

  // Exportação Excel (.xlsx)
  const handleExportExcel = () => {
    if (visibleProducts.length === 0) {
      setFeedback({ type: 'error', message: 'Nenhum produto de venda para exportar.' });
      return;
    }

    const data = visibleProducts.map((p) => ({
      'Código': p.codigo || '',
      'Descrição': p.descricao || '',
      'Categoria': p.categoria || 'Geral',
      'Marca': p.marca || '',
      'Unidade': p.unidade || 'UN',
      'Preço Custo (R$)': p.precoCusto ?? 0,
      'Preço Venda (R$)': p.precoVenda ?? 0,
      'Preço Expresso (R$)': p.precoExpresso ?? 0,
      'Estoque Atual': p.estoqueAtual ?? 0,
      'Estoque Mínimo': p.estoqueMinimo ?? 5,
      'Com Medidas': p.comMedidas ? 'SIM' : 'NÃO',
      'Fórmula Medida': p.formulaMedidaTitulo || '',
      'Situação': p.situacao || 'Ativo',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos de Venda');
    XLSX.writeFile(workbook, `Produtos_de_Venda_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setFeedback({ type: 'success', message: 'Relatório Excel exportado com sucesso!' });
  };

  // Importação Excel
  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const preview = data.map((row: any, i) => ({
          codigo: row['Código'] || row['codigo'] || `VENDA-${1000 + i}`,
          descricao: row['Descrição'] || row['descricao'] || row['Nome'] || 'Produto Sem Nome',
          categoria: row['Categoria'] || row['categoria'] || 'Geral',
          precoVenda: parseFloat(row['Preço Venda'] || row['precoVenda'] || row['Preço'] || 0),
          precoCusto: parseFloat(row['Preço Custo'] || row['precoCusto'] || 0),
          estoqueAtual: parseFloat(row['Estoque'] || row['estoqueAtual'] || 0),
          unidade: row['Unidade'] || row['unidade'] || 'UN',
        }));

        setImportDataPreview(preview);
      } catch (err) {
        setFeedback({ type: 'error', message: 'Erro ao ler arquivo Excel. Verifique a planilha.' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (importDataPreview.length === 0) return;
    setIsImporting(true);
    try {
      let importedCount = 0;
      for (const item of importDataPreview) {
        const nowIso = new Date().toISOString();
    const payload: Partial<ProductCatalog> = {
      updatedAt: nowIso,
          codigo: item.codigo,
          descricao: item.descricao,
          categoria: item.categoria,
          precoVenda: item.precoVenda,
          precoCusto: item.precoCusto,
          valorUnitario: item.precoVenda,
          estoqueAtual: item.estoqueAtual,
          unidade: item.unidade,
          paraVenda: true,
          situacao: 'Ativo',
        };
        await ApiService.createProduct(payload);
        importedCount++;
      }
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportDataPreview([]);
      fetchData(true);
      setFeedback({ type: 'success', message: `${importedCount} produtos de venda importados com sucesso!` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Falha na importação de produtos.' });
    } finally {
      setIsImporting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Helpers para movimentações de Entrada e Saída
  // --------------------------------------------------------------------------
  const normalizeHistoryEntry = (h: ProductHistoryEntry, defaultUnit: string = 'UN') => {
    let detalhes = h.detalhes || '';
    let op = h.operador || 'Operador Comercial';
    if (h.acao && h.acao.includes('Entrada') && !detalhes.toLowerCase().includes('estoque')) {
      detalhes = `${detalhes}. Estoque anterior: 0 ${defaultUnit}. Novo estoque: ${defaultUnit}`;
    }
    return {
      ...h,
      operador: op,
      detalhes,
    };
  };

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

  const parseQuemRetirou = (h: ProductHistoryEntry): string => {
    if ((h as any).quemRetirou && String((h as any).quemRetirou).trim()) {
      return String((h as any).quemRetirou).trim();
    }
    const det = h.detalhes || '';
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
    return h.operador ? h.operador.replace(/\s*\(Comercial\)/i, '').replace(/\s*\(Estoque\)/i, '').trim() : '-';
  };

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
    return h.operador ? h.operador.replace(/\s*\(Comercial\)/i, '').replace(/\s*\(Estoque\)/i, '').trim() : '-';
  };

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

  // REGISTROS DE ENTRADA DE PRODUTOS DE VENDA
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
        if (act.includes('entrada') || act.includes('compra') || act.includes('recebimento') || act.includes('cadastro')) {
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
            id: `${p.id}-${normalized.id || Math.random()}`,
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
  }, [visibleProducts, sortBy, filterStartDate, filterEndDate, searchQuery]);

  // REGISTROS DE SAÍDA DE PRODUTOS DE VENDA
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
        if (act.includes('saída') || act.includes('retirada') || act.includes('baixa') || act.includes('venda')) {
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
            id: `${p.id}-${normalized.id || Math.random()}`,
            product: p,
            operador: personWhoWithdrew,
            dataHora: normalized.dataHora,
            detalhes: normalized.detalhes,
            timestamp: ts,
          });
        }
      });
    });

    return rows.sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
  }, [visibleProducts, sortBy, filterStartDate, filterEndDate, searchQuery]);

  // Contagem de produtos cadastrados hoje
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const countTodayRegistered = useMemo(() => {
    return visibleProducts.filter((p) => p.createdAt && p.createdAt.slice(0, 10) === todayStr).length;
  }, [visibleProducts, todayStr]);

  // Filtragem e Ordenação dos Produtos Exibidos na Tabela
  const filteredProducts = useMemo(() => {
    return visibleProducts.filter((p) => {
      const term = searchQuery.toLowerCase().trim();
      const matchText =
        !term ||
        (p.codigo || '').toLowerCase().includes(term) ||
        (p.descricao || '').toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term) ||
        (p.categoria || '').toLowerCase().includes(term) ||
        (p.referencia || '').toLowerCase().includes(term);

      const matchCat = filterCategory === 'TODAS' || p.categoria === filterCategory;
      const matchStatus = filterStatus === 'TODAS' || p.situacao === filterStatus;

      // Filtro por Data de Cadastro (dd/mm/aaaa)
      let matchDate = true;
      if (filterDate.trim() && sortBy !== 'SAIDA_DE_PRODUTO' && sortBy !== 'ENTRADA_DE_PRODUTO') {
        if (!p.createdAt) matchDate = false;
        else {
          const itemDateStr = p.createdAt.slice(0, 10);
          matchDate = itemDateStr === filterDate;
        }
      }

      // Filtro de Alerta Mínimo
      let matchAlerta = true;
      if (sortBy === 'ALERTA_MINIMO') {
        const curr = Number(p.estoqueAtual) || 0;
        const min = Number(p.estoqueMinimo) || 0;
        matchAlerta = min > 0 && curr <= min;
      }

      return matchText && matchCat && matchStatus && matchDate && matchAlerta;
    });
  }, [visibleProducts, searchQuery, filterCategory, filterStatus, filterDate, sortBy]);

  // Ordenação dos Produtos de Venda (Lógica idêntica ao Módulo Estoque)
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    list.sort((a, b) => {
      switch (sortBy) {
        case 'A_Z':
        case 'ALFABETICA':
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
        case 'CODIGO': {
          const codeA = (a.codigo || a.sku || '').toString().trim();
          const codeB = (b.codigo || b.sku || '').toString().trim();
          return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        }
        case 'EDICOES_ALTERACOES': {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          if (timeA !== timeB) return timeB - timeA;
          return (b.id || '').localeCompare(a.id || '');
        }
        case 'MENOR_ESTOQUE':
          return (a.estoqueAtual ?? 0) - (b.estoqueAtual ?? 0);
        case 'ALERTA_MINIMO': {
          const ratioA = (Number(a.estoqueAtual) || 0) - (Number(a.estoqueMinimo) || 0);
          const ratioB = (Number(b.estoqueAtual) || 0) - (Number(b.estoqueMinimo) || 0);
          if (ratioA !== ratioB) return ratioA - ratioB;
          return (Number(a.estoqueAtual) || 0) - (Number(b.estoqueAtual) || 0);
        }
        case 'ULTIMOS_CADASTRADOS':
        case 'ULTIMO_CADASTRO':
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
  }, [filteredProducts, sortBy]);

  // Paginação dinâmica para produtos, entradas ou saídas
  const currentTotalItems = useMemo(() => {
    if (sortBy === 'ENTRADA_DE_PRODUTO') return entryRows.length;
    if (sortBy === 'SAIDA_DE_PRODUTO') return withdrawalRows.length;
    return sortedProducts.length;
  }, [sortBy, entryRows.length, withdrawalRows.length, sortedProducts.length]);

  const totalPages = Math.max(1, Math.ceil(currentTotalItems / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedProducts = useMemo(() => {
    return sortedProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedProducts, startIndex, itemsPerPage]);

  const totalPagesEntry = Math.max(1, Math.ceil(entryRows.length / itemsPerPage));
  const safeCurrentPageEntry = Math.min(currentPage, totalPagesEntry);
  const startIndexEntry = (safeCurrentPageEntry - 1) * itemsPerPage;
  const endIndexEntry = Math.min(startIndexEntry + itemsPerPage, entryRows.length);
  const paginatedEntryRows = useMemo(() => {
    return entryRows.slice(startIndexEntry, endIndexEntry);
  }, [entryRows, startIndexEntry, endIndexEntry]);

  const totalPagesWithdrawal = Math.max(1, Math.ceil(withdrawalRows.length / itemsPerPage));
  const safeCurrentPageWithdrawal = Math.min(currentPage, totalPagesWithdrawal);
  const startIndexWithdrawal = (safeCurrentPageWithdrawal - 1) * itemsPerPage;
  const endIndexWithdrawal = Math.min(startIndexWithdrawal + itemsPerPage, withdrawalRows.length);
  const paginatedWithdrawalRows = useMemo(() => {
    return withdrawalRows.slice(startIndexWithdrawal, endIndexWithdrawal);
  }, [withdrawalRows, startIndexWithdrawal, endIndexWithdrawal]);

  // Totais KPI
  const totalItensVenda = visibleProducts.length;
  const valorTotalEstoque = visibleProducts.reduce(
    (acc, p) => acc + (p.estoqueAtual ?? 0) * (p.precoVenda ?? 0),
    0
  );
  const itensBaixoEstoque = visibleProducts.filter(
    (p) => (p.estoqueAtual ?? 0) <= (p.estoqueMinimo ?? 5)
  ).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen text-slate-800">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-md shrink-0">
            <ShoppingCart className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Produtos de Venda
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">
                Catálogo Comercial
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Gestão especializada de cadastro, precificação, controle de entradas/saídas e catálogo para Ordem de Serviço & PDV.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fetchData(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer"
            title="Sincronizar dados com o servidor"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Atualizar</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar Excel</span>
          </button>
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
            <span>Importar Planilha</span>
          </button>
          <button
            type="button"
            onClick={handleClearForm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-md transition cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-bold shadow-sm transition animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
            {feedback.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            {feedback.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/5 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CARDS DE KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Total de Produtos de Venda</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalItensVenda}</h3>
            <span className="text-xs font-semibold text-blue-600 mt-0.5 block">Itens cadastrados para venda</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Valor em Estoque Comercial</span>
            <h3 className="text-2xl font-black text-emerald-700 mt-1">
              {valorTotalEstoque.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h3>
            <span className="text-xs font-semibold text-emerald-600 mt-0.5 block">Preço de venda projetado</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Estoque Baixo / Alerta</span>
            <h3 className="text-2xl font-black text-amber-700 mt-1">{itensBaixoEstoque}</h3>
            <span className="text-xs font-semibold text-amber-600 mt-0.5 block">Itens abaixo da cota mínima</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Categorias de Venda</span>
            <h3 className="text-2xl font-black text-purple-700 mt-1">{categories.length}</h3>
            <span className="text-xs font-semibold text-purple-600 mt-0.5 block">Classificações ativas</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Tag className="w-6 h-6 stroke-[2]" />
          </div>
        </div>
      </div>

      {/* PAINEL DE FORMULÁRIO COM AS 5 ABAS / MODAIS DEFINIDAS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* CABEÇALHO DO FORMULÁRIO */}
        <div className="bg-slate-50/80 p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
              {editingId ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {editingId ? `Editando Produto de Venda: ${codigo}` : 'Cadastrar Novo Produto de Venda'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Selecione as abas abaixo para preencher os dados comerciais, configurações de venda, entra e sai, arquivos e observações.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editingId && (
              <button
                type="button"
                onClick={handleClearForm}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancelar Edição
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveProduct}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-md transition cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Produto</span>
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO ENTRE AS 5 ABAS / MODAIS */}
        <div className="flex items-center gap-1.5 p-2 bg-slate-100/70 border-b border-slate-200 overflow-x-auto">
          {/* 1. DADOS GERAIS */}
          <button
            type="button"
            onClick={() => setActiveTab('dados')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'dados'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>Dados Gerais</span>
          </button>

          {/* 2. PRODUTOS PARA VENDA */}
          <button
            type="button"
            onClick={() => setActiveTab('venda')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'venda'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Produtos para venda</span>
          </button>

          {/* 3. ENTRA E SAI */}
          <button
            type="button"
            onClick={() => setActiveTab('entra-sai')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'entra-sai'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Entra e sai</span>
          </button>

          {/* 4. ARQUIVOS & PDFS */}
          <button
            type="button"
            onClick={() => setActiveTab('arquivos')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'arquivos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Arquivos & PDFs</span>
          </button>

          {/* 5. OBSERVAÇÕES */}
          <button
            type="button"
            onClick={() => setActiveTab('observacoes')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'observacoes'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Observações</span>
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <div className="p-5 sm:p-6 lg:p-8">
          {/* ======================================================== */}
          {/* ABA 1: DADOS GERAIS - EXATAMENTE IGUAL À IMAGEM DO USUÁRIO */}
          {/* ======================================================== */}
          {activeTab === 'dados' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-extrabold uppercase text-slate-800 tracking-wider">
                    Informações Principais do Produto
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleClearForm}
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

              {/* LINHA 1: DESCRIÇÃO DO PRODUTO (col-span-6) + PREÇO DE CUSTO (col-span-2) + PREÇO DE VENDA (col-span-2) + PREÇO EXPRESSO (col-span-2) */}
              <div className="grid grid-cols-12 gap-3 text-sm font-bold items-start">
                {/* Descrição do Produto* */}
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

                {/* Preço de Custo */}
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

                {/* Preço de Venda */}
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

                {/* Preço Expresso */}
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
                    <label className="block text-slate-700 uppercase text-xs sm:text-sm font-bold">
                      Categoria do Produto <span className="text-rose-500 font-bold">*</span>
                    </label>
                    {categoria && (
                      <span className="text-xs font-semibold text-slate-500">
                        Ativa: <strong className="text-blue-700 uppercase">{categoria}</strong>
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
                      className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                    >
                      <Edit className="w-4 h-4 text-amber-600" />
                      <span>Editar Categoria</span>
                    </button>
                    <button
                      type="button"
                      onClick={openCategoryModalForCreate}
                      title="Cadastrar uma nova categoria"
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
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
                  <label className="block text-slate-700 uppercase text-xs sm:text-sm font-bold">Marca:</label>
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
                  <label className="block text-slate-700 uppercase text-xs sm:text-sm font-bold">Unidade de Medida:</label>
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
                  <label className="block text-slate-700 uppercase text-xs sm:text-sm font-bold">NCM (Classificação Fiscal):</label>
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
                  <label className="block text-slate-700 uppercase text-xs sm:text-sm font-bold">CFOP:</label>
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
                  <label className="block text-slate-700 uppercase text-xs sm:text-sm font-bold">Origem da Mercadoria:</label>
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
                  <label className="block text-slate-700 uppercase text-xs sm:text-sm font-bold">Peso Unitário (KG):</label>
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
                  <label className="block text-slate-700 uppercase text-xs sm:text-sm font-bold">Dimensões (LxAxP cm):</label>
                  <input
                    type="text"
                    value={dimensoes}
                    onChange={(e) => setDimensoes(e.target.value)}
                    placeholder="Ex: 160x100x1 cm"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>
              </div>

              {/* PAINEL DE CÓDIGOS E IDENTIFICAÇÃO */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-xs font-black uppercase text-slate-600 tracking-wider block">Identificação & Código de Barras</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-bold">
                  {/* Código */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-slate-700 uppercase font-black">
                        Código do Produto <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateNextCode}
                        className="text-[11px] text-blue-600 hover:text-blue-700 underline font-extrabold cursor-pointer"
                      >
                        Gerar Próximo
                      </button>
                    </div>
                    <input
                      type="text"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      placeholder="Ex: VENDA-0001"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                    />
                  </div>

                  {/* Referência */}
                  <div className="space-y-1">
                    <label className="block text-slate-700 uppercase font-black">Referência Interna:</label>
                    <input
                      type="text"
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                      placeholder="Ex: REF-COM-2026"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                    />
                  </div>

                  {/* SKU */}
                  <div className="space-y-1">
                    <label className="block text-slate-700 uppercase font-black">SKU:</label>
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="Ex: SKU-TEC-01"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                    />
                  </div>

                  {/* Código de Barras EAN-13 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-slate-700 uppercase font-black">EAN-13:</label>
                      <button
                        type="button"
                        onClick={handleGenerateEan13}
                        className="text-[11px] text-emerald-600 hover:text-emerald-700 underline font-extrabold cursor-pointer"
                      >
                        Gerar EAN
                      </button>
                    </div>
                    <input
                      type="text"
                      value={codigoBarras}
                      onChange={(e) => setCodigoBarras(e.target.value)}
                      placeholder="7898521000000"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                    />
                  </div>
                </div>

                {codigoBarras && (
                  <div className="pt-2 flex items-center justify-between flex-wrap gap-4 border-t border-slate-200">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase block">Pré-visualização do Código de Barras:</span>
                      <span className="text-xs font-mono font-bold text-slate-800">{codigoBarras}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs">
                      <EanBarcodeSVG value={codigoBarras} className="h-10" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ABA 2: PRODUTOS PARA VENDA - EXATAMENTE IGUAL À IMAGEM 2 DO USUÁRIO */}
          {/* ======================================================== */}
          {activeTab === 'venda' && (
            <div className="space-y-6 animate-in fade-in duration-200">
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
                        onClick={handleClearForm}
                        className="p-1.5 bg-white hover:bg-slate-100 text-blue-600 border border-slate-300 rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                        title="Novo Cadastro Limpo"
                      >
                        <Plus className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProduct}
                        className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                        title="Salvar Produto"
                      >
                        <Save className="w-4 h-4 text-white stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Gerencie a habilitação de cálculo por medidas sob encomenda e precificação comercial do catálogo de vendas.
                  </p>
                </div>
                <div>
                  <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Disponível para Venda em OS & PDV
                  </span>
                </div>
              </div>

              {/* CARD DE "COM MEDIDAS" - REPRODUZINDO COM FIDELIDADE A SEGUNDA IMAGEM */}
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
                      COM MEDIDAS
                    </span>
                    <span className="bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                      {selectedFormulaId
                        ? `CÁLCULO ATIVO: ${(formulas.find((f) => f.id === selectedFormulaId)?.titulo || 'CÁLCULO DE MESA RETANGULAR').toUpperCase()}`
                        : 'CÁLCULO ATIVO: CÁLCULO DE MESA RETANGULAR'}
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
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={handleRestoreDefaultFormulas}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                        title="Restaurar fórmulas padrão de medidas"
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
                        title="Acrescentar um novo cálculo"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Acrescentar Novo Cálculo</span>
                      </button>
                    </div>
                  </div>

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
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => setSelectedFormulaId(isSelected ? '' : formula.id)}
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
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFormula(formula);
                                setShowFormulaModal(true);
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFormula(formula.id);
                              }}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
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
                    className="w-full bg-amber-50/40 border border-amber-400 rounded-xl px-3.5 py-2 text-sm text-amber-900 font-black focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-fuchsia-800 uppercase text-xs font-black">Preço por M² (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={precoPorM2}
                    onChange={(e) => setPrecoPorM2(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-fuchsia-50/50 border border-fuchsia-300 rounded-xl px-3.5 py-2 text-sm text-fuchsia-900 font-black focus:outline-none focus:ring-2 focus:ring-fuchsia-500 transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ABA 3: ENTRA E SAI */}
          {/* ======================================================== */}
          {activeTab === 'entra-sai' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                  <span className="text-xs font-black uppercase text-blue-800 block">Saldo Atual em Estoque</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-blue-900">{estoqueAtual}</span>
                    <span className="text-sm font-bold text-blue-700">{unidade}</span>
                  </div>
                  <span className="text-[11px] text-blue-700 mt-1 block">Unidade: {unidade}</span>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <span className="text-xs font-black uppercase text-amber-800 block">Estoque Mínimo (Alerta)</span>
                  <input
                    type="number"
                    value={estoqueMinimo}
                    onChange={(e) => setEstoqueMinimo(e.target.value)}
                    className="w-full mt-1 bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xl text-amber-900 font-black focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                  <span className="text-[11px] text-amber-700 mt-1 block">Aviso automático se atingir este valor</span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-xs font-black uppercase text-slate-700 block">Estoque Máximo</span>
                  <input
                    type="number"
                    value={estoqueMaximo}
                    onChange={(e) => setEstoqueMaximo(e.target.value)}
                    className="w-full mt-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xl text-slate-900 font-black focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Capacidade máxima recomendada</span>
                </div>
              </div>

              {/* PAINEL: REGISTRAR ENTRADA */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center font-bold shadow-sm">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase text-emerald-950 tracking-wider">
                        Registrar Entrada de Produto (Entra)
                      </h3>
                      <p className="text-xs text-emerald-700 font-medium">
                        Adiciona saldo imediato ao estoque e grava a entrada com data, hora e responsável no histórico.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-800 bg-white border border-emerald-300 px-3 py-1 rounded-lg">
                    Saldo Atual: {estoqueAtual} {unidade}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm font-bold">
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-xs">
                      Qtd. Entrada <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={qtdEntrada}
                      onChange={(e) => setQtdEntrada(e.target.value)}
                      placeholder="Qtd..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-xs">
                      Quem Recebeu <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={quemRecebeu}
                      onChange={(e) => setQuemRecebeu(e.target.value)}
                      placeholder="Nome do operador..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-xs">Origem / Fornecedor:</label>
                    <input
                      type="text"
                      value={origemEntrada}
                      onChange={(e) => setOrigemEntrada(e.target.value)}
                      placeholder="Fábrica / Fornecedor..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleRegistrarEntrada}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer active:scale-95"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span>Confirmar Entrada</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* PAINEL: REGISTRAR SAÍDA */}
              <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-rose-200 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-rose-600 text-white rounded-lg flex items-center justify-center font-bold shadow-sm">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase text-rose-950 tracking-wider">
                        Registrar Saída de Produto (Sai)
                      </h3>
                      <p className="text-xs text-rose-700 font-medium">
                        Abate a quantidade informada do saldo e registra a justificativa no histórico.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-rose-800 bg-white border border-rose-300 px-3 py-1 rounded-lg">
                    Saldo Atual: {estoqueAtual} {unidade}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm font-bold">
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-xs">
                      Qtd. Saída <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={estoqueAtual}
                      value={qtdSaida}
                      onChange={(e) => setQtdSaida(e.target.value)}
                      placeholder="Qtd..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-xs">
                      Quem Retirou <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={quemRetirou}
                      onChange={(e) => setQuemRetirou(e.target.value)}
                      placeholder="Nome do responsável..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-800 uppercase text-xs">Setor Destino:</label>
                    <input
                      type="text"
                      value={setorDestinoSaida}
                      onChange={(e) => setSetorDestinoSaida(e.target.value)}
                      placeholder="Comercial / Vendas / OS..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleRegistrarSaida}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer active:scale-95"
                    >
                      <TrendingDown className="w-4 h-4" />
                      <span>Confirmar Saída</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* EXTRATO DE MOVIMENTAÇÕES */}
              {editingId && (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-600" />
                    <span>Últimas Movimentações deste Produto</span>
                  </h3>
                  {(() => {
                    const prod = products.find((p) => p.id === editingId);
                    const historyList = prod?.historicoAlteracoes || [];
                    if (historyList.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 italic">
                          Nenhum registro de entrada ou saída gravado para este item.
                        </p>
                      );
                    }
                    return (
                      <div className="divide-y divide-slate-200 text-xs">
                        {historyList.slice(0, 10).map((h) => {
                          const isEntrada = (h.acao || '').toLowerCase().includes('entrada') || (h.detalhes || '').includes('ENTRADA');
                          const isSaida = (h.acao || '').toLowerCase().includes('saída') || (h.detalhes || '').includes('SAÍDA');
                          return (
                            <div key={h.id} className="py-2.5 flex items-start justify-between gap-3">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                      isEntrada
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isSaida
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {h.acao}
                                  </span>
                                  <span className="font-bold text-slate-800">{h.operador}</span>
                                </div>
                                <p className="text-slate-600">{h.detalhes}</p>
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 shrink-0">{h.dataHora}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* ABA 4: ARQUIVOS & PDFS */}
          {/* ======================================================== */}
          {activeTab === 'arquivos' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* UPLOAD DA FOTO PRINCIPAL */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                      <span>Foto Principal do Produto</span>
                    </h3>
                    {fotoUrl && (
                      <button
                        type="button"
                        onClick={() => setFotoUrl('')}
                        className="text-[11px] text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                      >
                        Remover Foto
                      </button>
                    )}
                  </div>
                  {fotoUrl ? (
                    <div className="relative group rounded-xl overflow-hidden border border-slate-300 max-h-56 flex items-center justify-center bg-black/5">
                      <img src={fotoUrl} alt="Foto do Produto" className="max-h-56 object-contain" />
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-white">
                      <Upload className="w-8 h-8 text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">Clique para selecionar uma imagem</span>
                      <span className="text-[10px] text-slate-400">Formatos aceitos: JPG, PNG, WEBP (Máx: 15MB)</span>
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  )}
                </div>

                {/* UPLOAD DE ANEXOS EM PDF */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-rose-600" />
                      <span>Documentos & Manuais (PDF)</span>
                    </h3>
                    <label className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Anexar PDF</span>
                      <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
                    </label>
                  </div>
                  {anexosPdf.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-400 text-xs italic">
                      Nenhum arquivo PDF anexado a este produto.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {anexosPdf.map((pdf) => (
                        <div
                          key={pdf.id}
                          className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                            <div className="truncate">
                              <span className="text-xs font-bold text-slate-800 block truncate">{pdf.nome}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {pdf.tamanho || 'Anexo'} • {pdf.dataEnvio}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPdfViewerModal({ title: pdf.nome, url: pdf.url })}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Visualizar PDF"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openPdfInNewTab(pdf.url, pdf.nome)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Abrir em Nova Aba"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setAnexosPdf((prev) => prev.filter((p) => p.id !== pdf.id))}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Excluir Anexo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ABA 5: OBSERVAÇÕES */}
          {/* ======================================================== */}
          {activeTab === 'observacoes' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <label className="block text-slate-700 uppercase text-xs font-black">
                Observações Gerais & Informações Técnicas de Venda:
              </label>
              <textarea
                rows={5}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Insira detalhes adicionais do produto de venda, instruções especiais para produção ou especificações do fornecedor..."
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
              />
            </div>
          )}
        </div>
      </div>

      {/* PAINEL DE BUSCA E LISTAGEM DE PRODUTOS DE VENDA - RELAÇÃO PRODUTOS E HISTÓRICO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* CABEÇALHO DA SEÇÃO: RELAÇÃO PRODUTOS E HISTÓRICO */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200 text-blue-600 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black tracking-tight text-slate-900 uppercase">
                  Relação produtos e histórico
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 tracking-wider uppercase">
                  Catálogo Comercial
                </span>
                <span className="text-xs font-bold text-slate-500">
                  ({filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'itens'})
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Catálogo ordenado dos produtos de venda com suporte a busca, filtros e histórico.
              </p>
            </div>
          </div>
        </div>
        {/* BARRA DE FILTROS E PESQUISA */}
        <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar produtos de venda por código, descrição, SKU ou categoria..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Categoria */}
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 transition cursor-pointer"
            >
              <option value="TODAS">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Situação */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 transition cursor-pointer"
            >
              <option value="TODAS">Todas as Situações</option>
              <option value="Ativo">Apenas Ativos</option>
              <option value="Inativo">Apenas Inativos</option>
            </select>

            {/* Ordenação - Segue estritamente a lógica do Módulo Estoque */}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 transition cursor-pointer"
              title="Ordem de exibição e filtros rápidos de produtos"
            >
              <option value="ULTIMOS_CADASTRADOS">Últimos cadastros</option>
              <option value="A_Z">De A à Z</option>
              <option value="Z_A">De Z à A</option>
              <option value="NUMERICA_CRESCENTE">Ordem Numérica Crescente</option>
              <option value="NUMERICA_DECRESCENTE">Ordem Numérica Decrescente</option>
              <option value="ALERTA_MINIMO">Alerta Mínimo</option>
              <option value="ENTRADA_DE_PRODUTO">Entrada de Produto</option>
              <option value="SAIDA_DE_PRODUTO">Saída de Produto</option>
            </select>

            {/* FILTRO DE DATA (CADASTRO OU INTERVALO DE ENTRADA/SAÍDA - dd/mm/aaaa) */}
            {sortBy === 'SAIDA_DE_PRODUTO' || sortBy === 'ENTRADA_DE_PRODUTO' ? (
              <div className="flex items-center gap-1.5 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-500">Início:</span>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => {
                      setFilterStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="dd/mm/aaaa"
                    title="Data inicial (dd/mm/aaaa)"
                    className="px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-500">Fim:</span>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => {
                      setFilterEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="dd/mm/aaaa"
                    title="Data final (dd/mm/aaaa)"
                    className="px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {(filterStartDate || filterEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStartDate('');
                      setFilterEndDate('');
                      setCurrentPage(1);
                    }}
                    className="p-2 bg-white text-slate-500 hover:text-rose-600 border border-slate-300 rounded-xl transition cursor-pointer"
                    title="Limpar datas"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative flex items-center gap-1.5">
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => {
                      setFilterDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="dd/mm/aaaa"
                    title="Filtrar por data específica (dd/mm/aaaa)"
                    className="pl-8 pr-2 py-1.5 sm:py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilterDate(todayStr);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
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
                    onClick={() => {
                      setFilterDate('');
                      setCurrentPage(1);
                    }}
                    className="p-1.5 sm:p-2 bg-white text-slate-500 hover:text-rose-600 border border-slate-300 rounded-xl transition cursor-pointer"
                    title="Limpar filtro de data"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FEEDBACK DE DATA ATIVA FILTRADA */}
        {filterDate && sortBy !== 'SAIDA_DE_PRODUTO' && sortBy !== 'ENTRADA_DE_PRODUTO' && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between text-xs text-blue-900 font-bold">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>
                Exibindo produtos cadastrados em: <strong>{formatDateBR(filterDate)}</strong> ({filteredProducts.length} encontrados)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setFilterDate('');
                setCurrentPage(1);
              }}
              className="text-blue-700 hover:text-blue-900 underline text-xs font-black cursor-pointer"
            >
              Exibir todas as datas
            </button>
          </div>
        )}

        {/* TABELA DE DADOS */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-black uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-3">Código</th>
                {sortBy === 'ENTRADA_DE_PRODUTO' ? (
                  <>
                    <th className="py-3 px-3">Descrição do Produto</th>
                    <th className="py-3 px-3">Quem Recebeu</th>
                    <th className="py-3 px-3 bg-emerald-50/80 text-emerald-950 font-black">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Data e Hora</span>
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Padrão</span>
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
                        <span className="text-[10px] font-extrabold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">Padrão</span>
                      </div>
                    </th>
                    <th className="py-3 px-3">Motivo / Retirada</th>
                    <th className="py-3 px-3 text-center">Antes</th>
                    <th className="py-3 px-3 text-center">Agora</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-4">Descrição do Produto de Venda</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4 text-center">Unidade</th>
                    <th className="py-3 px-4 text-right">Preço Venda</th>
                    <th className="py-3 px-4 text-center">Saldo em Estoque</th>
                    <th className="py-3 px-4 text-center">Data Cadastro (dd/mm/aaaa)</th>
                    <th className="py-3 px-4 text-center">Situação</th>
                  </>
                )}
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sortBy === 'ENTRADA_DE_PRODUTO' ? (
                paginatedEntryRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                      Nenhuma entrada de produto registrada com os filtros selecionados.
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
                            <button
                              type="button"
                              onClick={() => setHistoryModalProduct(item.product)}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                              title="Ver Histórico"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSpecModalProduct(item.product)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Ficha Técnica"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectProductToEdit(item.product)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Editar Produto"
                            >
                              <Edit className="w-4 h-4" />
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
                    <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                      Nenhuma saída de produto registrada com os filtros selecionados.
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
                            <button
                              type="button"
                              onClick={() => setHistoryModalProduct(item.product)}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                              title="Ver Histórico"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSpecModalProduct(item.product)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Ficha Técnica"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectProductToEdit(item.product)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Editar Produto"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                    Nenhum produto de venda encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const isBaixo = (p.estoqueAtual ?? 0) <= (p.estoqueMinimo ?? 5);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 transition cursor-pointer"
                      onClick={() => handleSelectProductToEdit(p)}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <div>{p.codigo}</div>
                        {p.sku && <div className="text-[10px] text-slate-400">SKU: {p.sku}</div>}
                        {p.createdAt && (
                          <div className="text-[10px] text-slate-400 font-sans font-medium flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{formatDateBR(p.createdAt)}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.descricao}</div>
                        {p.marca && <div className="text-[10px] text-slate-500">Marca: {p.marca}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200">
                          {p.categoria || 'Geral'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-600">
                        {p.unidade || 'UN'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700">
                        {(p.precoVenda ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full font-black text-xs inline-flex items-center gap-1 ${
                            isBaixo
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-blue-100 text-blue-900 border border-blue-200'
                          }`}
                        >
                          {isBaixo && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                          {p.estoqueAtual ?? 0} {p.unidade || 'UN'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="font-mono font-bold text-xs text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{p.createdAt ? formatDateBR(p.createdAt) : 'dd/mm/aaaa'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase ${
                            p.situacao === 'Ativo'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {p.situacao || 'Ativo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
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
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectProductToEdit(p)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Editar Produto"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProductToDelete(p);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Excluir Produto"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* PAGINAÇÃO */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-slate-600">
          <div>
            Exibindo {currentTotalItems === 0 ? 0 : startIndex + 1} a {Math.min(startIndex + itemsPerPage, currentTotalItems)} de {currentTotalItems} {sortBy === 'ENTRADA_DE_PRODUTO' ? 'entradas registradas' : sortBy === 'SAIDA_DE_PRODUTO' ? 'saídas registradas' : 'produtos de venda'}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
              title="Primeira Página"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
              title="Página Anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 font-black">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
              title="Próxima Página"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
              title="Última Página"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: FICHA TÉCNICA / DETALHES RÁPIDOS DO PRODUTO */}
      {/* ======================================================== */}
      {specModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-blue-600 uppercase">Ficha Técnica do Produto de Venda</span>
                <h3 className="text-lg font-black text-slate-900">{specModalProduct.descricao}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSpecModalProduct(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 font-bold block">Código:</span>
                <span className="font-mono font-bold text-slate-900">{specModalProduct.codigo}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 font-bold block">Categoria:</span>
                <span className="font-bold text-slate-900">{specModalProduct.categoria || 'Geral'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 font-bold block">Unidade:</span>
                <span className="font-bold text-slate-900">{specModalProduct.unidade || 'UN'}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl">
                <span className="text-emerald-700 font-bold block">Preço de Venda:</span>
                <span className="font-black text-emerald-800 text-sm">
                  {(specModalProduct.precoVenda ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <span className="text-blue-700 font-bold block">Estoque Atual:</span>
                <span className="font-black text-blue-900 text-sm">
                  {specModalProduct.estoqueAtual ?? 0} {specModalProduct.unidade || 'UN'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 font-bold block">Marca:</span>
                <span className="font-bold text-slate-900">{specModalProduct.marca || '-'}</span>
              </div>
            </div>
            {specModalProduct.codigoBarras && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center">
                <EanBarcodeSVG value={specModalProduct.codigoBarras} className="h-12" />
                <span className="text-xs font-mono font-bold text-slate-600 mt-1">{specModalProduct.codigoBarras}</span>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSpecModalProduct(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CONFIRMAÇÃO DE EXCLUSÃO COM SENHA SUPERIOR */}
      {/* ======================================================== */}
      {isDeleteModalOpen && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-slate-900">Excluir Produto de Venda</h3>
            </div>
            <p className="text-xs text-slate-600">
              Você está prestes a excluir o produto <strong>{productToDelete.codigo} - {productToDelete.descricao}</strong>. Por motivos de segurança e rastreabilidade fiscal, insira a senha de superior/administrador para confirmar.
            </p>
            <div className="space-y-1 text-xs font-bold">
              <label className="block text-slate-700 uppercase">Senha de Autorização:</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Insira a senha do superior..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setProductToDelete(null);
                  setDeletePassword('');
                }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: NOVA / EDITAR CATEGORIA (MESMA LÓGICA DO ESTOQUE) */}
      {/* ======================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB SELECTOR NO MODAL */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setCategoryModalMode('create')}
                className={`py-1.5 text-xs font-black uppercase rounded-lg transition ${
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
                className={`py-1.5 text-xs font-black uppercase rounded-lg transition ${
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
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

            {/* AVISO */}
            <p className="text-xs font-bold text-blue-700 uppercase leading-snug tracking-tight bg-blue-50/90 border border-blue-200 rounded-xl p-3">
              DEFINA SE ESSA CATEGORIA SERÁ EXIBIDA EM ORDEM DE SERVIÇO E PDV.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={categoryModalMode === 'create' ? handleAddCategory : handleUpdateCategory}
                className={`px-4 py-2 text-white font-black text-xs uppercase tracking-wide rounded-xl shadow transition cursor-pointer ${
                  categoryModalMode === 'create' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                {categoryModalMode === 'create' ? 'Cadastrar Categoria' : 'Salvar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: VISUALIZADOR DE PDF */}
      {/* ======================================================== */}
      {pdfViewerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-white">
              <span className="text-sm font-bold truncate max-w-md">{pdfViewerModal.title}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPdfInNewTab(pdfViewerModal.url, pdfViewerModal.title)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Nova Aba</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfViewerModal(null)}
                  className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-950 p-1">
              <iframe src={pdfBlobUrl} className="w-full h-full rounded-b-xl border-none" title={pdfViewerModal.title} />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: IMPORTAÇÃO DE PLANILHA EXCEL */}
      {/* ======================================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Importar Produtos de Venda via Excel (.xlsx)</h3>
                <p className="text-xs text-slate-500">Selecione uma planilha para cadastro em lote no catálogo comercial.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50">
              <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
              <span className="text-xs font-bold text-slate-700">
                {importFile ? importFile.name : 'Clique para selecionar a planilha (.xlsx, .xls)'}
              </span>
              <input type="file" accept=".xlsx,.xls" onChange={handleExcelFileSelect} className="hidden" />
            </label>

            {importDataPreview.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Pré-visualização dos primeiros itens a importar ({importDataPreview.length} identificados):
                </span>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                  {importDataPreview.slice(0, 5).map((row, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{row.descricao}</span>
                      <span className="font-mono text-emerald-700 font-bold">
                        R$ {row.precoVenda?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isImporting || importDataPreview.length === 0}
                onClick={handleConfirmImport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isImporting ? 'Importando...' : 'Confirmar Importação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: FÓRMULAS DE MEDIDAS */}
      {/* ======================================================== */}
      {showFormulaModal && (
        <MeasurementFormulaModal
          isOpen={showFormulaModal}
          onClose={() => {
            setShowFormulaModal(false);
            setEditingFormula(null);
          }}
          initialFormula={editingFormula}
          onSave={async (formula) => {
            try {
              await ApiService.saveMeasurementFormula(formula);
              setFormulas((prev) => {
                const idx = prev.findIndex((f) => f.id === formula.id);
                return idx >= 0 ? prev.map((f) => (f.id === formula.id ? formula : f)) : [...prev, formula];
              });
              setSelectedFormulaId(formula.id);
              setComMedidas(true);
              setShowFormulaModal(false);
              setEditingFormula(null);
              setFeedback({ type: 'success', message: `Fórmula "${formula.titulo}" associada com sucesso!` });
            } catch (err: any) {
              setFeedback({ type: 'error', message: `Erro ao salvar fórmula: ${err?.message || 'Erro'}` });
            }
          }}
          operatorName={operadorLogado}
        />
      )}
    
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

    </div>
  );
};

export default ProdutosVendaModuleView;
