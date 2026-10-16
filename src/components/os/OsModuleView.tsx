import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { OrdemServico, OsItem, OsAttachment, ProductionStage, ProductCatalog, TipoExpedicao } from '../../server/types/os';
import { Client } from '../../server/types/client';
import { MeasurementFormula } from '../../types/measurementFormula';
import { ApiService } from '../../services/api';

import { CaixaOsModal } from './CaixaOsModal';
import { OsPrintableA4 } from './OsPrintableA4';
import { ArtEditorModal } from './ArtEditorModal';
import { WhatsAppMessageModal } from './WhatsAppMessageModal';
import { ClientModuleView } from '../client/ClientModuleView';
import { formatDateBR } from '../../utils/formatters';
import { compressImageFile } from '../../utils/imageCompressor';
import {
  getClientDisplayName,
  matchClientSearch,
  buildClientSearchIndex,
  fastFilterClients,
} from '../../utils/clientSearch';
import {
  getLoggedUserAndPerfil,
  normalizeRoleName,
  isUserAuthorizedForOs,
  isUserCreatorOfOrc,
  createOsHistoryEntry,
  isRoleAuthorizedForSales,
  isRoleAuthorizedToEditPaidOs,
  isUserDirecao,
  isUserResponsibleForOs,
  canUserInitiateOsEdit,
  canUserPerformAction,
  filterVisibleHistory,
} from '../../utils/userPermissions';
import { verifySuperiorPassword, verifyOsEditPassword } from '../../utils/superiorAuth';
import { NotificationService } from '../../utils/notificationService';
import {
  FileText,
  Search,
  Plus,
  PlusCircle,
  Save,
  Trash2,
  Edit2,
  Edit3,
  Upload,
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Calendar,
  User,
  Building2,
  ShoppingCart,
  Printer,
  Download,
  X,
  UserPlus,
  RefreshCw,
  Layers,
  ArrowRight,
  Sparkles,
  Lock,
  KeyRound,
  History,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Clock,
  FileEdit,
  MapPin,
  MessageSquare,
  Bell,
  Send,
  Truck,
  Check,
  Palette,
  Flame,
  Scissors,
  Mail,
  ShoppingBag,
  Store,
  Package,
  Hash,
  CreditCard,
} from 'lucide-react';

const PRODUCTION_STAGES_ALL: ProductionStage[] = [
  'Designer',
  'Impressão',
  'Calandra',
  'Costura',
  'EXCURSÃO',
  'CORREIOS',
  'SHOPEE',
  'RETIRADA(Recepção)',
];

export interface OsModuleViewProps {
  activeMenu?: string;
  isSidebarExpanded?: boolean;
  mode?: 'OS' | 'ORCAMENTO' | 'OSS';
}

export const OsModuleView: React.FC<OsModuleViewProps> = ({
  activeMenu,
  isSidebarExpanded = false,
  mode = 'OS',
}) => {
  const isShopeeMode = mode === 'OSS' || activeMenu === 'ordem-servico-shopee';
  const isOrcamentoMode = !isShopeeMode && (mode === 'ORCAMENTO' || activeMenu === 'orcamento');

  // Active View: 'NEW_OS' | 'SEARCH_OS' | 'ORCAMENTOS'
  const [activeView, setActiveView] = useState<'NEW_OS' | 'SEARCH_OS' | 'ORCAMENTOS'>('NEW_OS');

  // OS / ORC / OSS Number & Date Auto Generation State
  const [osCodigo, setOsCodigo] = useState<string>(
    isShopeeMode ? 'OSS00000001' : isOrcamentoMode ? 'ORC00000001' : 'OS00000001'
  );
  const [dataVenda, setDataVenda] = useState<string>(new Date().toLocaleDateString('pt-BR'));
  const [osSituacao, setOsSituacao] = useState<string>(isOrcamentoMode ? 'Orçamento Criado' : 'Aberta');

  // Shopee Marketplace ID do Pedido State (Substitui Dados do Cliente no modo Shopee)
  const [shopeeIdPedido, setShopeeIdPedido] = useState<string>('');
  const [shopeeCompradorNome, setShopeeCompradorNome] = useState<string>('');

  // Cliente Selection State
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearchText, setClientSearchText] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Quick Client Registration Modal
  const [showQuickClientModal, setShowQuickClientModal] = useState<boolean>(false);
  const [quickClientNome, setQuickClientNome] = useState<string>('');
  const [quickClientDoc, setQuickClientDoc] = useState<string>('');
  const [quickClientPhone, setQuickClientPhone] = useState<string>('');
  const [quickClientEmail, setQuickClientEmail] = useState<string>('');

  // Prazo de Entrega State
  const [prazoEntrega, setPrazoEntrega] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Kanban Production Flow Stages Selection State
  const [selectedStages, setSelectedStages] = useState<ProductionStage[]>(
    isShopeeMode
      ? ['Designer', 'Impressão', 'Calandra', 'Costura', 'SHOPEE']
      : ['Designer', 'Impressão', 'Calandra', 'Costura', 'RETIRADA(Recepção)']
  );

  // Modalidade de Expedição State (Normal, Expresso Excursão, Expresso do Dia, Shopee)
  const [tipoExpedicao, setTipoExpedicao] = useState<TipoExpedicao>(
    isShopeeMode ? 'SHOPEE' : 'NORMAL'
  );

  // Product Intelligent Search & Entry State
  const [categories, setCategories] = useState<string[]>([]);
  const [itemCategoria, setItemCategoria] = useState<string>('ALL');
  const [productCatalog, setProductCatalog] = useState<ProductCatalog[]>([]);
  const [itemDescricao, setItemDescricao] = useState<string>('');
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const [itemUnidade, setItemUnidade] = useState<string>('UN');
  const [itemQuantidade, setItemQuantidade] = useState<number>(1);
  const [itemValorUnitario, setItemValorUnitario] = useState<number>(0);
  const [itemPrecoMedio, setItemPrecoMedio] = useState<number>(0);
  const [itemTipoDesconto, setItemTipoDesconto] = useState<'R$' | '%'>('R$');
  const [itemDescontoInput, setItemDescontoInput] = useState<number>(0);

  // Items List State
  const [osItens, setOsItens] = useState<OsItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Estados para Cálculo de Medidas (Cálculo de Mesa)
  const [comMedidas, setComMedidas] = useState<boolean>(false);
  const [medidaFrente, setMedidaFrente] = useState<string>('');
  const [medidaLateral, setMedidaLateral] = useState<string>('');
  const [medidaAltura, setMedidaAltura] = useState<string>('');
  const [medidaCaimento, setMedidaCaimento] = useState<string>('');
  const [medidaBabado, setMedidaBabado] = useState<string>('');
  const [medidaQtdBabado, setMedidaQtdBabado] = useState<string>('');
  const [medidaTampo, setMedidaTampo] = useState<string>('');
  const [comSobreposicao, setComSobreposicao] = useState<boolean>(false);
  const [precoExpressoActive, setPrecoExpressoActive] = useState<boolean>(false);
  const [measurementFormulas, setMeasurementFormulas] = useState<MeasurementFormula[]>([]);
  const [selectedFormulaOverride, setSelectedFormulaOverride] = useState<string | null>(null);
  const [expandedMedidasItemIds, setExpandedMedidasItemIds] = useState<Record<string, boolean>>({});

  const toggleMedidasExpand = (itemId: string) => {
    setExpandedMedidasItemIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // Helper para formatar o texto compacto de medidas (ex: 2X1X0,80X0,80X12)
  const formatCompactMedidas = (item: OsItem) => {
    if (!item.comMedidas) return '';
    const formatDim = (val?: number) => {
      if (val === undefined || val === null) return '';
      const num = Number(val);
      if (isNaN(num)) return '';
      if (Number.isInteger(num)) return String(num);
      const str = num.toFixed(2).replace('.', ',');
      return str.endsWith(',00') ? String(num) : str;
    };
    // Se for Cilindro
    if (item.valorBaseCilindro !== undefined || item.tampCilindro !== undefined || (item.formulaMedidaId && item.formulaMedidaId.includes('cilindro'))) {
      const larg = formatDim(item.medidaLateral || item.medidaFrente);
      const alt = formatDim(item.medidaAltura);
      const tamp = formatDim(item.tampCilindro || ((Number(item.medidaLateral || item.medidaFrente) || 0) / 3));
      return `Larg ${larg}m × Alt ${alt}m (Tampo: ${tamp}m)`;
    }
    // Se for Cubo / Mesa Veste
    if (item.calculoCubo !== undefined || item.valorCubo !== undefined || (item.medidaTampo !== undefined && item.medidaTampo > 0) || (item.formulaMedidaId && (item.formulaMedidaId.includes('cubo') || item.formulaMedidaId.includes('veste')))) {
      const m = formatDim(item.medidaFrente);
      const a = formatDim(item.medidaAltura);
      const t = formatDim(item.medidaTampo || item.medidaFrente);
      const c = formatDim(item.calculoCubo !== undefined ? item.calculoCubo : ((Number(item.medidaFrente) || 0) * 4));
      return `Medida ${m}m × Alt ${a}m × Tampo ${t}m (Cálc: ${c}m)`;
    }
    if (item.qtdBabado || item.valorFaixa || (item.formulaMedidaId && item.formulaMedidaId.includes('babado'))) {
      const f = formatDim(item.medidaFrente);
      const l = formatDim(item.medidaLateral);
      const a = formatDim(item.medidaAltura);
      const q = Math.max(2, item.qtdBabado || 2);
      return `${f}X${l}X${a} (${q} Babado${q > 1 ? 's' : ''})`;
    }
    // Se for padrão Altura e Largura (sem babado e caimento)
    if (!item.medidaBabado && !item.medidaCaimento && (item.medidaAltura || item.medidaLateral || item.medidaFrente)) {
      const a = formatDim(item.medidaAltura);
      const l = formatDim(item.medidaLateral || item.medidaFrente);
      const m2 = item.medidaCalculo ? `${String(item.medidaCalculo).replace('.', ',')}m²` : '';
      if (a && l) return `${a}X${l}${m2 ? ` (${m2})` : ''}`;
    }
    const f = formatDim(item.medidaFrente);
    const l = formatDim(item.medidaLateral);
    const a = formatDim(item.medidaAltura);
    const c = formatDim(item.medidaCaimento);
    const b = formatDim(item.medidaBabado);
    const parts = [f, l, a, c, b].filter((p) => p !== '');
    if (parts.length === 0) return '';
    return parts.join('X');
  };

  // Helper to normalize strings for comparison (case-insensitive, trims, removes accents)
  const normalizeStr = (s?: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // Find matching catalog product based on itemDescricao (strictly for products marked for sale)
  const matchingCatalogProduct = useMemo(() => {
    const queryNorm = normalizeStr(itemDescricao);
    if (!queryNorm) return null;
    return (
      productCatalog.find((p) => {
        if (p.paraVenda === false || (p as any).apenasEstoqueInterno === true) return false;
        const descNorm = normalizeStr(p.descricao);
        const codNorm = normalizeStr(p.codigo);
        const skuNorm = normalizeStr(p.sku);
        const refNorm = normalizeStr(p.referencia);
        const barNorm = normalizeStr(p.codigoBarras);
        return (
          descNorm === queryNorm ||
          codNorm === queryNorm ||
          skuNorm === queryNorm ||
          refNorm === queryNorm ||
          barNorm === queryNorm
        );
      }) || null
    );
  }, [itemDescricao, productCatalog]);

  // Fórmula de medida ativa associada ao produto (sincronizada com o catálogo/banco)
  const activeProductFormula = useMemo(() => {
    if (!matchingCatalogProduct) return null;
    const fId = matchingCatalogProduct.formulaMedidaId;
    if (fId) {
      const found = measurementFormulas.find((f) => f.id === fId);
      if (found) return found;
    }
    const fTitulo = matchingCatalogProduct.formulaMedidaTitulo;
    if (fTitulo) {
      const found = measurementFormulas.find((f) =>
        f.titulo.toLowerCase().trim() === fTitulo.toLowerCase().trim()
      );
      if (found) return found;
    }
    return null;
  }, [matchingCatalogProduct, measurementFormulas]);

  // Fórmula efetiva levando em conta se o operador escolheu outra ou o padrão
  const effectiveProductFormula = useMemo(() => {
    if (selectedFormulaOverride === 'padrao_altura_largura') return null;
    if (selectedFormulaOverride) {
      return measurementFormulas.find((f) => f.id === selectedFormulaOverride) || null;
    }
    return activeProductFormula;
  }, [selectedFormulaOverride, activeProductFormula, measurementFormulas]);

  // Se nenhum dos cálculos foram marcados, o padrão é Altura e Largura Total m²!
  const isAreaPadrao = useMemo(() => {
    return !effectiveProductFormula;
  }, [effectiveProductFormula]);

  // Identifica se é Cálculo Mesa Retrô (apenas se houver fórmula específica ativa)
  const isRetroTable = useMemo(() => {
    if (isAreaPadrao || !effectiveProductFormula) return false;
    const id = (effectiveProductFormula.id || '').toLowerCase();
    const t = (effectiveProductFormula.titulo || '').toLowerCase();
    const d = (effectiveProductFormula.descricao || '').toLowerCase();
    const babadoF = (effectiveProductFormula.regrasFinanceiras?.tamanhoBabadoFormula || '').toLowerCase();
    return (
      id === 'calculo_mesa_retro' ||
      id.includes('retro') ||
      id.includes('retrô') ||
      t.includes('retrô') ||
      t.includes('retro') ||
      d.includes('retrô') ||
      d.includes('retro') ||
      babadoF.includes('w66') ||
      (babadoF.includes('3.14') && !t.includes('redond')) ||
      (babadoF.includes('3,14') && !t.includes('redond'))
    );
  }, [isAreaPadrao, effectiveProductFormula]);

  // Identifica se é mesa redonda (quando NÃO for mesa retrô)
  const isRoundTable = useMemo(() => {
    if (isAreaPadrao || !effectiveProductFormula || isRetroTable) return false;
    const id = (effectiveProductFormula.id || '').toLowerCase();
    const t = (effectiveProductFormula.titulo || '').toLowerCase();
    const d = (effectiveProductFormula.descricao || '').toLowerCase();
    const babadoF = (effectiveProductFormula.regrasFinanceiras?.tamanhoBabadoFormula || '').toLowerCase();
    return id.includes('redond') || t.includes('redond') || d.includes('redond') || (babadoF.includes('3.14') && !babadoF.includes('0.5') && !babadoF.includes('0,5'));
  }, [isAreaPadrao, effectiveProductFormula, isRetroTable]);

  // Identifica se é cálculo específico de Mesa Babado
  const isBabadoTable = useMemo(() => {
    if (isAreaPadrao || !effectiveProductFormula || isRetroTable || isRoundTable) return false;
    const id = (effectiveProductFormula.id || '').toLowerCase();
    const t = (effectiveProductFormula.titulo || '').toLowerCase();
    return id === 'calculo_mesa_babado' || id === 'formula_1791398786927' || t.includes('babado');
  }, [isAreaPadrao, effectiveProductFormula, isRetroTable, isRoundTable]);

  // Identifica se é cálculo Cubo / Mesa Veste
  const isCuboTable = useMemo(() => {
    if (isAreaPadrao || !effectiveProductFormula) return false;
    const id = (effectiveProductFormula.id || '').toLowerCase();
    const t = (effectiveProductFormula.titulo || '').toLowerCase();
    return id === 'calculo_cubo' || id.includes('cubo') || t.includes('cubo') || t.includes('mesa veste');
  }, [isAreaPadrao, effectiveProductFormula]);

  // Identifica se é cálculo de Cilindro
  const isCilindroTable = useMemo(() => {
    if (isAreaPadrao || !effectiveProductFormula || isRetroTable || isRoundTable || isBabadoTable || isCuboTable) return false;
    const id = (effectiveProductFormula.id || '').toLowerCase();
    const t = (effectiveProductFormula.titulo || '').toLowerCase();
    return id === 'calculo_cilindro' || t.includes('cilindro');
  }, [isAreaPadrao, effectiveProductFormula, isRetroTable, isRoundTable, isBabadoTable, isCuboTable]);

  // Cálculo automático da área da mesa ou área padrão (altura * largura) em m²
  const medidaCalculo = useMemo(() => {
    const a = parseFloat(String(medidaAltura).replace(',', '.')) || 0;
    const lRaw = parseFloat(String(medidaLateral || medidaFrente).replace(',', '.')) || 0;

    if (isAreaPadrao) {
      // Padrão: Altura e Largura Total m²
      const total = a * lRaw;
      return Math.round(total * 100) / 100;
    }

    const f = parseFloat(String(medidaFrente).replace(',', '.')) || 0;
    const l = (isRoundTable && lRaw === 0 && f > 0) ? f : lRaw;
    const c = parseFloat(String(medidaCaimento).replace(',', '.')) || 0;
    const b = parseFloat(String(medidaBabado).replace(',', '.')) || 0;

    if (isRetroTable) {
      const altEfetiva = Math.max(0, a - 0.25);
      const areaBabado = b * altEfetiva;
      const areaTampo = (f + 0.5) * (l + 0.5);
      const areaSobreposicao = comSobreposicao ? (f + 0.5 + c) * (l + 0.5 + c) : 0;
      const total = areaBabado + areaTampo + areaSobreposicao;
      return Math.round(total * 100) / 100;
    }

    if (isBabadoTable) {
      const q = Math.max(2, parseInt(String(medidaQtdBabado).replace(/\D/g, '')) || 2);
      const areaTampo = f * l;
      const areaFaixa = ((2 * f) + (2 * l)) * a;
      const areaBabado = (2 * ((2 * f) + (2 * l))) * (a / q) * q;
      const total = areaTampo + areaFaixa + areaBabado;
      return Math.round(total * 100) / 100;
    }

    if (isCuboTable) {
      const m = f;
      const t = parseFloat(String(medidaTampo || medidaFrente).replace(',', '.')) || m;
      const calc = Math.ceil(m * 4);
      const total = (a * calc) + (t * t);
      return Math.round(total * 100) / 100;
    }

    if (isCilindroTable) {
      const tampoVal = lRaw / 3;
      const areaBase = lRaw * a;
      const areaTampo = Math.pow(tampoVal, 2);
      const total = areaBase + areaTampo;
      return Math.round(total * 100) / 100;
    }

    // Área da Saia / Babado = Babado * Altura
    const areaBabado = b * a;
    const areaTampo = comSobreposicao
      ? (f + 2 * c) * (l + 2 * c)
      : f * l;

    const total = areaBabado + areaTampo;
    return Math.round(total * 100) / 100;
  }, [medidaFrente, medidaLateral, medidaAltura, medidaCaimento, medidaBabado, medidaQtdBabado, medidaTampo, comSobreposicao, isAreaPadrao, isRoundTable, isRetroTable, isBabadoTable, isCilindroTable, isCuboTable]);

  // Cálculo da medida exata do babado antes do arredondamento
  const calculoBabadoExato = useMemo(() => {
    const f = parseFloat(String(medidaFrente).replace(',', '.')) || 0;
    const lRaw = parseFloat(String(medidaLateral).replace(',', '.')) || 0;
    const l = (isRoundTable && lRaw === 0 && f > 0) ? f : lRaw;

    if (isRetroTable) {
      return f > 0 ? ((f + 0.5) * 3.14) * 2 : 0;
    }
    if (isRoundTable) {
      const diametro = f > 0 ? f : l;
      return diametro > 0 ? (diametro * 3.14) * 2 : 0;
    }
    if (isBabadoTable) {
      return (f > 0 || l > 0) ? (2 * ((2 * f) + (2 * l))) : 0;
    }
    // Mesa Retangular
    return (f > 0 || l > 0) ? ((f + l) * 2) * 2 : 0;
  }, [medidaFrente, medidaLateral, isRetroTable, isRoundTable, isBabadoTable]);

  // Auto-cálculo do tamanho do babado
  useEffect(() => {
    if (!comMedidas || isAreaPadrao || isBabadoTable) return;
    const f = parseFloat(String(medidaFrente).replace(',', '.')) || 0;
    const l = parseFloat(String(medidaLateral).replace(',', '.')) || 0;
    if (isRetroTable) {
      if (f > 0) {
        const calcBabado = Math.ceil(((f + 0.5) * 3.14) * 2);
        setMedidaBabado(String(calcBabado));
      } else if (f === 0) {
        setMedidaBabado('');
      }
    } else if (isRoundTable) {
      const diametro = f > 0 ? f : l;
      if (diametro > 0) {
        const calcBabado = Math.ceil((diametro * 3.14) * 2);
        setMedidaBabado(String(calcBabado));
      } else if (diametro === 0) {
        setMedidaBabado('');
      }
    } else {
      if (f > 0 || l > 0) {
        const calcBabado = Math.ceil(((f + l) * 2) * 2);
        setMedidaBabado(String(calcBabado));
      } else if (f === 0 && l === 0) {
        setMedidaBabado('');
      }
    }
  }, [medidaFrente, medidaLateral, comMedidas, isAreaPadrao, isRoundTable, isRetroTable, isBabadoTable]);

  // Cálculos financeiros avançados de medidas (Babado, Tampo, Faixa, Sobreposição, Com/Sem Sobreposição)
  const {
    valorDoBabado,
    valorFaixaDeBabado = 0,
    valorFaixa = 0,
    valorDoTampo,
    valorDaSobreposicao,
    valorBase = 0,
    valorComSobreposicao,
    valorSemSobreposicao,
    valorFinalCalculado,
    calculoCubo = 0,
    valorCuboCorpo = 0,
    valorCuboTampo = 0,
  } = useMemo(() => {
    const f = parseFloat(String(medidaFrente).replace(',', '.')) || 0;
    const lRaw = parseFloat(String(medidaLateral).replace(',', '.')) || 0;
    const l = (isRoundTable && lRaw === 0 && f > 0) ? f : lRaw;
    const a = parseFloat(String(medidaAltura).replace(',', '.')) || 0;
    const c = parseFloat(String(medidaCaimento).replace(',', '.')) || 0;

    let bDefault = 0;
    if (f > 0 || l > 0) {
      if (isRetroTable) {
        bDefault = Math.ceil(((f + 0.5) * 3.14) * 2);
      } else if (isRoundTable) {
        bDefault = Math.ceil(((f > 0 ? f : l) * 3.14) * 2);
      } else {
        bDefault = Math.ceil(((f + l) * 2) * 2);
      }
    }
    const b = parseFloat(String(medidaBabado).replace(',', '.')) || bDefault;
    
    const catalogPrecoExpresso = matchingCatalogProduct?.precoExpresso !== undefined && Number(matchingCatalogProduct.precoExpresso) > 0
      ? Number(matchingCatalogProduct.precoExpresso)
      : undefined;
    const catalogPrecoVenda = matchingCatalogProduct?.precoVenda !== undefined && Number(matchingCatalogProduct.precoVenda) > 0
      ? Number(matchingCatalogProduct.precoVenda)
      : (matchingCatalogProduct?.valorUnitario !== undefined && Number(matchingCatalogProduct.valorUnitario) > 0
          ? Number(matchingCatalogProduct.valorUnitario)
          : undefined);
    const effectiveStockPrice = (precoExpressoActive && catalogPrecoExpresso !== undefined)
      ? catalogPrecoExpresso
      : catalogPrecoVenda;
    const valorM2 = (effectiveStockPrice !== undefined ? effectiveStockPrice : itemValorUnitario) || 0;

    if (isAreaPadrao) {
      const aVal = parseFloat(String(medidaAltura).replace(',', '.')) || 0;
      const lVal = parseFloat(String(medidaLateral || medidaFrente).replace(',', '.')) || 0;
      const areaPadrao = Math.round((aVal * lVal) * 100) / 100;
      const valPadrao = valorM2 > 0 && areaPadrao > 0 ? Math.round(areaPadrao * valorM2 * 100) / 100 : 0;
      return {
        valorDoBabado: 0,
        valorFaixaDeBabado: 0,
        valorFaixa: 0,
        valorDoTampo: 0,
        valorDaSobreposicao: 0,
        valorBase: 0,
        valorComSobreposicao: 0,
        valorSemSobreposicao: 0,
        valorFinalCalculado: valPadrao,
      };
    }

    if (isBabadoTable) {
      const q = Math.max(2, parseInt(String(medidaQtdBabado).replace(/\D/g, '')) || 2);
      const perimetro = (2 * f) + (2 * l);
      const valTampo = Math.ceil(f * l * valorM2);
      const valFaixa = Math.ceil(perimetro * a * valorM2);
      const valFaixaBabado = Math.ceil((perimetro * 2) * (a / q) * valorM2);
      const valBabado = valFaixaBabado * q;
      const totalBabado = valTampo + valFaixa + valBabado + (20 * q);

      return {
        valorDoBabado: valBabado,
        valorFaixaDeBabado: valFaixaBabado,
        valorFaixa: valFaixa,
        valorDoTampo: valTampo,
        valorDaSobreposicao: 0,
        valorBase: 0,
        valorComSobreposicao: totalBabado,
        valorSemSobreposicao: totalBabado,
        valorFinalCalculado: totalBabado,
      };
    }

    if (isCuboTable) {
      // Cálculo Cubo / Mesa Veste:
      // Medida
      // Altura
      // Tampo
      // calculo = (medida * 4) (não arredonde para cima)
      // valor = (altura * calculo * preço de venda/preço expresso)
      // valor tampo = (tampo * tampo * preço de venda/preço expresso)
      // Total = (valor + valor tampo) arredonde pra cima
      const m = f;
      const t = parseFloat(String(medidaTampo !== '' ? medidaTampo : medidaFrente).replace(',', '.')) || 0;
      const calculo = m * 4; // Não arredonda para cima
      const valorCorpo = (a > 0 && calculo > 0 && valorM2 > 0)
        ? Math.ceil(a * calculo * valorM2)
        : 0;
      const valorT = (t > 0 && valorM2 > 0)
        ? Math.ceil(t * t * valorM2)
        : 0;
      const totalCubo = (valorCorpo > 0 || valorT > 0)
        ? (valorCorpo + valorT)
        : 0;

      return {
        valorDoBabado: valorCorpo,
        valorFaixaDeBabado: 0,
        valorFaixa: 0,
        valorDoTampo: valorT,
        valorDaSobreposicao: 0,
        valorBase: 0,
        valorComSobreposicao: totalCubo,
        valorSemSobreposicao: totalCubo,
        valorFinalCalculado: totalCubo,
        calculoCubo: calculo,
        valorCuboCorpo: valorCorpo,
        valorCuboTampo: valorT,
      };
    }

    if (isCilindroTable) {
      const larg = parseFloat(String(medidaLateral || medidaFrente).replace(',', '.')) || 0;
      const tampoVal = larg / 3;
      const vBase = Math.round(larg * a * valorM2 * 100) / 100;
      const vTampo = Math.round(Math.pow(tampoVal, 2) * valorM2 * 100) / 100;
      const totalCilindro = (larg > 0 || a > 0) ? Math.ceil((larg * a * valorM2) + (Math.pow(tampoVal, 2) * valorM2)) : 0;

      return {
        valorDoBabado: 0,
        valorFaixaDeBabado: 0,
        valorFaixa: 0,
        valorDoTampo: vTampo,
        valorDaSobreposicao: vBase,
        valorBase: vBase,
        valorComSobreposicao: totalCilindro,
        valorSemSobreposicao: totalCilindro,
        valorFinalCalculado: totalCilindro,
      };
    }

    const taxaSobrep = effectiveProductFormula?.regrasFinanceiras?.taxaSobreposicaoM2 || 32;
    const taxaAcabamento = effectiveProductFormula?.regrasFinanceiras?.taxaAdicionalAcabamento || 20;

    let valBabado = 0;
    let valTampo = 0;
    let valSobreposicao = 0;

    if (isRetroTable) {
      const altEfetiva = Math.max(0, a - 0.25);
      valBabado = Math.ceil(b * altEfetiva * valorM2);
      valTampo = Math.ceil((f + 0.5) * (l + 0.5) * valorM2);
      const taxaSobrepRetro = valorM2 > 0 ? valorM2 : taxaSobrep;
      valSobreposicao = Math.ceil((f + 0.5 + c) * (l + 0.5 + c) * taxaSobrepRetro);
    } else {
      valBabado = Math.ceil(b * a * valorM2);
      valTampo = Math.ceil(f * l * valorM2);
      valSobreposicao = Math.ceil((f + c) * (l + c) * taxaSobrep);
    }

    const hasAnyCalc = valBabado > 0 || valTampo > 0 || valSobreposicao > 0;
    const valComSobrep = hasAnyCalc ? (valBabado + valTampo + valSobreposicao + taxaAcabamento) : 0;
    const hasAnyCalcSem = valBabado > 0 || valTampo > 0;
    const valSemSobrep = hasAnyCalcSem ? (valBabado + valTampo + taxaAcabamento) : 0;
    const finalVal = comSobreposicao ? valComSobrep : valSemSobrep;

    return {
      valorDoBabado: valBabado,
      valorFaixaDeBabado: 0,
      valorFaixa: 0,
      valorDoTampo: valTampo,
      valorDaSobreposicao: valSobreposicao,
      valorBase: 0,
      valorComSobreposicao: valComSobrep,
      valorSemSobreposicao: valSemSobrep,
      valorFinalCalculado: finalVal,
    };
  }, [medidaFrente, medidaLateral, medidaAltura, medidaCaimento, medidaBabado, medidaQtdBabado, medidaTampo, itemValorUnitario, comSobreposicao, precoExpressoActive, matchingCatalogProduct, isAreaPadrao, isRoundTable, isRetroTable, isBabadoTable, isCilindroTable, isCuboTable, effectiveProductFormula]);

  // Valida se a categoria é cadastrada e válida (excluindo ALL / Todas as Categorias / Geral)
  const isRegisteredCategory = useCallback(
    (catName?: string | null): boolean => {
      if (!catName) return false;
      const trimmed = catName.trim();
      const lower = trimmed.toLowerCase();
      if (!trimmed || lower === 'all' || lower === 'todas as categorias' || lower === 'geral' || lower === 'sem categoria') {
        return false;
      }
      return categories.some((c) => c.trim().toLowerCase() === lower);
    },
    [categories]
  );

  // Categoria vinculada à descrição do produto (ou do item sendo editado, ou selecionada no dropdown)
  const effectiveProductCategory = useMemo(() => {
    // 1. Categoria do produto casado no catálogo
    const catalogCat = matchingCatalogProduct?.categoria?.trim();
    if (catalogCat && isRegisteredCategory(catalogCat)) {
      return catalogCat;
    }
    // 2. Se estiver editando um item com categoria cadastrada válida
    if (editingItemId) {
      const editItem = osItens.find((i) => i.id === editingItemId);
      const editCat = editItem?.categoria?.trim();
      if (editCat && isRegisteredCategory(editCat)) {
        return editCat;
      }
    }
    // 3. Categoria explicitamente selecionada no dropdown de categorias (não pode ser "ALL" nem "Todas as Categorias")
    const selectedCat = itemCategoria?.trim();
    if (selectedCat && isRegisteredCategory(selectedCat)) {
      return selectedCat;
    }
    return null;
  }, [matchingCatalogProduct, editingItemId, osItens, itemCategoria, isRegisteredCategory]);

  const hasValidCategory = Boolean(effectiveProductCategory);

  // Se digitar um produto e ele não possuir categoria cadastrada válida: bloqueado
  const isProductUnregistered = Boolean(itemDescricao.trim().length > 0 && !hasValidCategory);

  // Sincroniza categoria e ativa automaticamente "Com Medidas" quando encontra produto no catálogo
  useEffect(() => {
    if (matchingCatalogProduct) {
      if (matchingCatalogProduct.categoria && isRegisteredCategory(matchingCatalogProduct.categoria)) {
        const catTrimmed = matchingCatalogProduct.categoria.trim();
        if (itemCategoria !== catTrimmed) {
          setItemCategoria(catTrimmed);
        }
      }
      const hasMedidas = Boolean(matchingCatalogProduct.comMedidas) || 
        matchingCatalogProduct.unidade === 'M2' || 
        /medida|mesa|toalha|saia|painel|m2/i.test(matchingCatalogProduct.descricao) ||
        (matchingCatalogProduct.categoria && /medida|mesa|toalha|saia|painel|m2/i.test(matchingCatalogProduct.categoria));
      if (hasMedidas) {
        setComMedidas(true);
        if (itemUnidade === 'UN') {
          setItemUnidade('M2');
        }
      }
      const productExpressPrice = matchingCatalogProduct.precoExpresso !== undefined && Number(matchingCatalogProduct.precoExpresso) > 0
        ? Number(matchingCatalogProduct.precoExpresso)
        : undefined;
      const productStandardPrice = matchingCatalogProduct.valorUnitario !== undefined && matchingCatalogProduct.valorUnitario > 0
        ? matchingCatalogProduct.valorUnitario
        : undefined;
      const targetPrice = (precoExpressoActive && productExpressPrice !== undefined)
        ? productExpressPrice
        : productStandardPrice;

      if (targetPrice !== undefined && targetPrice > 0) {
        setItemValorUnitario(targetPrice);
      }
      if (matchingCatalogProduct.precoMedio !== undefined && matchingCatalogProduct.precoMedio > 0) {
        setItemPrecoMedio(matchingCatalogProduct.precoMedio);
      }
    }
  }, [matchingCatalogProduct, isRegisteredCategory, itemCategoria, itemUnidade, precoExpressoActive]);

  // Ativa automaticamente "Com Medidas" ao selecionar categoria que possua produtos com medidas
  useEffect(() => {
    if (itemCategoria && itemCategoria !== 'ALL') {
      const catNorm = normalizeStr(itemCategoria);
      const catHasMedidas = productCatalog.some(
        (p) =>
          normalizeStr(p.categoria) === catNorm &&
          (Boolean(p.comMedidas) || p.unidade === 'M2')
      );
      const catNameImpliesMedidas = /medida|mesa|toalha|saia|painel|m2|cortina|tecido|lona|banner/i.test(itemCategoria);
      if (catHasMedidas || catNameImpliesMedidas) {
        setComMedidas(true);
        if (itemUnidade === 'UN') {
          setItemUnidade('M2');
        }
      }
    }
  }, [itemCategoria, productCatalog, itemUnidade]);

  // Attachments & Notes State
  const [anexos, setAnexos] = useState<OsAttachment[]>([]);
  const [observacoes, setObservacoes] = useState<string>('');
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const [showArtEditorModal, setShowArtEditorModal] = useState<boolean>(false);

  // Saved OS List for Search / History
  const [osList, setOsList] = useState<OrdemServico[]>(() => ApiService.getCachedOrdensServico() || []);
  const [searchTermOs, setSearchTermOs] = useState<string>('');
  const [expandedOsIds, setExpandedOsIds] = useState<Set<string>>(new Set());

  const toggleExpandOs = (osId: string) => {
    setExpandedOsIds((prev) => {
      const next = new Set(prev);
      if (next.has(osId)) {
        next.delete(osId);
      } else {
        next.add(osId);
      }
      return next;
    });
  };

  // Active Editing OS ID (null for new OS)
  const [editingOsId, setEditingOsId] = useState<string | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<string>('PIX');

  // Active Caixa PDV Modal & Printable A4 Modal State
  const [showCaixaPdvModal, setShowCaixaPdvModal] = useState<boolean>(false);
  const [currentOsForPdv, setCurrentOsForPdv] = useState<OrdemServico | null>(null);
  const [printableOs, setPrintableOs] = useState<OrdemServico | null>(null);

  // Reference to hold clean search term before opening password/auth modals, preventing browser credential autofill leakage
  const previousSearchTermRef = useRef<string>('');

  // Password Confirmation Modal for OS/ORC Deletion (Protected by Dev / Superior permissions)
  const [deleteModalOs, setDeleteModalOs] = useState<OrdemServico | null>(null);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [showDeletePassword, setShowDeletePassword] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');
  const [isDeletingOs, setIsDeletingOs] = useState<boolean>(false);

  // Password Confirmation Modal for Transforming Orçamento into OS (Protected by Superior permissions)
  const [transformModalOrc, setTransformModalOrc] = useState<OrdemServico | null>(null);
  const [transformPassword, setTransformPassword] = useState<string>('');
  const [showTransformPassword, setShowTransformPassword] = useState<boolean>(false);
  const [transformError, setTransformError] = useState<string>('');
  const [isTransforming, setIsTransforming] = useState<boolean>(false);

  // Password Confirmation Modal for Editing OS (Protected by Responsible Operator / Direção)
  const [editOsAuthModal, setEditOsAuthModal] = useState<OrdemServico | null>(null);
  const [editOsAuthPassword, setEditOsAuthPassword] = useState<string>('');
  const [showEditOsAuthPassword, setShowEditOsAuthPassword] = useState<boolean>(false);
  const [editOsAuthError, setEditOsAuthError] = useState<string>('');
  const [isVerifyingEditOsAuth, setIsVerifyingEditOsAuth] = useState<boolean>(false);

  // Backward compatibility aliases
  const editPaidOsModal = editOsAuthModal;
  const setEditPaidOsModal = setEditOsAuthModal;
  const editPaidPassword = editOsAuthPassword;
  const setEditPaidPassword = setEditOsAuthPassword;
  const showEditPaidPassword = showEditOsAuthPassword;
  const setShowEditPaidPassword = setShowEditOsAuthPassword;
  const editPaidError = editOsAuthError;
  const setEditPaidError = setEditOsAuthError;
  const isVerifyingEditPaid = isVerifyingEditOsAuth;

  // Safe handler for search term changes to strictly block browser credential/username autofill into OS search filter
  const handleSearchTermChange = (val: string) => {
    // 1. Se qualquer modal de confirmação/autorização por senha estiver aberto, bloqueia categoricamente qualquer alteração no campo de busca
    if (deleteModalOs || transformModalOrc || editOsAuthModal) {
      return;
    }

    const { username } = getLoggedUserAndPerfil();
    const rawVal = (val || '').trim();
    const lowerVal = rawVal.toLowerCase();
    const unameClean = (username || '').toLowerCase().trim();

    // 2. Bloqueia tentativas de autofill do navegador que injetam logins (ex: @marcelo-dev ou qualquer login com @)
    if (lowerVal.startsWith('@')) {
      return;
    }

    // 3. Bloqueia o login do próprio usuário logado
    if (unameClean && (lowerVal === unameClean || lowerVal === `@${unameClean.replace(/^@/, '')}`)) {
      return;
    }

    setSearchTermOs(val);
  };

  // Blindagem ativa contra vazamento de autofill do navegador no campo de busca durante abertura/uso de modais de senha
  useEffect(() => {
    if (deleteModalOs || transformModalOrc || editOsAuthModal) {
      const cleanTerm = previousSearchTermRef.current || '';
      if (searchTermOs !== cleanTerm) {
        setSearchTermOs(cleanTerm);
      }
    }
  }, [deleteModalOs, transformModalOrc, editOsAuthModal, searchTermOs]);

  // Safe close handler for delete modal restoring search term if polluted by browser password manager
  const closeDeleteModal = () => {
    setDeleteModalOs(null);
    setDeletePassword('');
    setDeleteError('');
    setShowDeletePassword(false);

    // Restaura incondicionalmente o termo de busca prévio que existia antes do modal abrir
    setSearchTermOs(previousSearchTermRef.current || '');
  };
  const setIsVerifyingEditPaid = setIsVerifyingEditOsAuth;

  // WhatsApp Automated Direct Message State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [whatsappSelectedOs, setWhatsappSelectedOs] = useState<OrdemServico | null>(null);
  const [whatsappModalMode, setWhatsappModalMode] = useState<'AGRADECIMENTO' | 'LEMBRETE_COBRANCA'>('AGRADECIMENTO');
  const [dismissedReminderIds, setDismissedReminderIds] = useState<Set<string>>(new Set());

  const handleOpenWhatsApp = (os: OrdemServico, mode: 'AGRADECIMENTO' | 'LEMBRETE_COBRANCA') => {
    setWhatsappSelectedOs(os);
    setWhatsappModalMode(mode);
    setShowWhatsAppModal(true);
  };

  const isDeliveryDueOrToday = (prazoEntregaStr?: string): boolean => {
    if (!prazoEntregaStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const clean = prazoEntregaStr.trim();
    let target: Date | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-').map(Number);
      target = new Date(y, m - 1, d);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      const [d, m, y] = clean.split('/').map(Number);
      target = new Date(y, m - 1, d);
    }

    if (!target || isNaN(target.getTime())) return false;
    target.setHours(0, 0, 0, 0);
    return target.getTime() <= today.getTime();
  };

  // Operator & Full Client Overlay Modal States
  const { name: loggedInName } = getLoggedUserAndPerfil();
  const [loggedOperator, setLoggedOperator] = useState<string>(loggedInName || 'Operador Logado');
  const [showFullClientModal, setShowFullClientModal] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Client Duplicate Pending OS Alert State
  const [pendingOsPrompt, setPendingOsPrompt] = useState<{
    client: Client;
    pendingOs: OrdemServico;
    action?: 'SELECT_CLIENT' | 'TRANSFORM_ORC';
    orcToTransform?: OrdemServico;
  } | null>(null);

  // Feedback Notification Banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  // Auto-dismiss confirmation feedback (cadastros, alterações e salvamentos) after 3 seconds
  useEffect(() => {
    if (feedback.message && feedback.type === 'success') {
      const timer = setTimeout(() => {
        setFeedback({ type: null, message: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const descricaoInputRef = useRef<HTMLInputElement>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  // Close product dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(event.target as Node)
      ) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto detect logged-in operator
  useEffect(() => {
    const detectUser = async () => {
      try {
        const userLogged = getLoggedUserAndPerfil();
        if (userLogged.name && userLogged.name !== 'Operador Logado') {
          setLoggedOperator(userLogged.name);
          return;
        }
        const stored = localStorage.getItem('subligestao_user_profile') || localStorage.getItem('subligestao_user');
        if (stored) {
          const u = JSON.parse(stored);
          const userName = u?.name || u?.nome || u?.username || u?.user?.name || u?.user?.username;
          if (userName) setLoggedOperator(userName);
        } else {
          const me = await ApiService.getCurrentUser();
          if (me && me.user) {
            setLoggedOperator(me.user.name || me.user.username || 'Operador Logado');
          }
        }
      } catch {}
    };
    detectUser();
  }, []);

  // Fetch initial clients, catalog products, and saved OS in parallel
  const loadData = async () => {
    try {
      const [clientData, prodData, osData, catData, nextCodeData, formulasData] = await Promise.all([
        ApiService.getClients(),
        ApiService.getProducts(),
        ApiService.getOrdensServico(),
        ApiService.getCategories(true).catch(() => []),
        !editingOsId
          ? ApiService.getNextOsCode(isShopeeMode ? 'OSS' : isOrcamentoMode ? 'ORCAMENTO' : 'OS').catch(() => null)
          : Promise.resolve(null),
        ApiService.getMeasurementFormulas().catch(() => []),
      ]);
      setClients(clientData || []);
      setProductCatalog(prodData || []);
      setOsList(osData || []);
      if (Array.isArray(formulasData)) {
        setMeasurementFormulas(formulasData);
      }

      if (!editingOsId) {
        if (nextCodeData?.nextCode) {
          setOsCodigo(nextCodeData.nextCode);
        } else {
          const filteredDocs = (osData || []).filter((o: OrdemServico) =>
            isShopeeMode
              ? (o as any).tipoDocumento === 'OSS' || (o as any).isShopee || o.codigo?.startsWith('OSS')
              : isOrcamentoMode
              ? (o as any).tipoDocumento === 'ORCAMENTO' || (o as any).isOrcamento || o.codigo?.startsWith('ORC')
              : (o as any).tipoDocumento !== 'ORCAMENTO' && !(o as any).isOrcamento && !o.codigo?.startsWith('ORC')
          );
          const docNumbers = filteredDocs.map((o: OrdemServico) => {
            const match = o.codigo?.match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
          });
          const nextNum = (docNumbers.length > 0 ? Math.max(...docNumbers) : 0) + 1;
          setOsCodigo(
            isShopeeMode
              ? `OSS${String(nextNum).padStart(8, '0')}`
              : isOrcamentoMode
              ? `ORC${String(nextNum).padStart(8, '0')}`
              : `OS${String(nextNum).padStart(8, '0')}`
          );
        }
      }

      // Products strictly available for OS
      const osAvailableProds = (prodData || []).filter((p: ProductCatalog) => {
        const isInternalCategory = p.categoria && (
          p.categoria.toLowerCase().includes('apenas estoque interno') ||
          p.categoria.toLowerCase() === 'estoque interno'
        );
        if (isInternalCategory && p.paraVenda !== true) return false;
        return (
          p.origemCadastro === 'OS_PDV' ||
          ((p.origemCadastro === 'ESTOQUE' || !p.origemCadastro) && p.paraVenda !== false)
        );
      });

      // Categories strictly available for OS (excluding "Apenas Estoque Interno" when not marked for sale, and excluding "Geral")
      const validCategories = Array.from(
        new Set([
          ...(catData || []),
          ...osAvailableProds.map((p: ProductCatalog) => p.categoria).filter(Boolean),
        ])
      ).filter((catName) => {
        if (!catName) return false;
        const lower = catName.trim().toLowerCase();
        if (lower === 'geral') {
          return false;
        }
        if (lower.includes('apenas estoque interno') || lower === 'estoque interno') {
          return false;
        }
        return true;
      }) as string[];

      setCategories(validCategories);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => {
      ApiService.getOrdensServico().then((data) => setOsList(data || [])).catch(() => {});
      ApiService.getClients().then((data) => setClients(data || [])).catch(() => {});
      ApiService.getProducts().then((data) => setProductCatalog(data || [])).catch(() => {});
      ApiService.getMeasurementFormulas().then((data) => setMeasurementFormulas(data || [])).catch(() => {});
    };
    window.addEventListener('os-changed', handleSync);
    window.addEventListener('clients-changed', handleSync);
    window.addEventListener('products-changed', handleSync);
    window.addEventListener('formulas-changed', handleSync);
    window.addEventListener('focus', handleSync);
    const syncInterval = setInterval(handleSync, 15000);
    return () => {
      window.removeEventListener('os-changed', handleSync);
      window.removeEventListener('clients-changed', handleSync);
      window.removeEventListener('products-changed', handleSync);
      window.removeEventListener('formulas-changed', handleSync);
      window.removeEventListener('focus', handleSync);
      clearInterval(syncInterval);
    };
  }, []);

  // Keyboard Shortcuts Listener (F2, F3, F4, F5, F7, F8, F10, ESC, ENTER)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2: Nova OS / Novo ORC
      if (e.key === 'F2') {
        e.preventDefault();
        handleNewOs();
      }
      // F3: Pesquisar OS / Pesquisar ORC
      if (e.key === 'F3') {
        e.preventDefault();
        setActiveView('SEARCH_OS');
      }
      // F4: Cadastrar Novo Cliente
      if (e.key === 'F4') {
        e.preventDefault();
        setEditingClient(null);
        setShowFullClientModal(true);
      }
      // F5: Pesquisar Cliente
      if (e.key === 'F5') {
        e.preventDefault();
        setShowClientDropdown(true);
      }
      // F7: Imprimir OS / ORC
      if (e.key === 'F7') {
        e.preventDefault();
        if (currentOsForPdv) {
          setPrintableOs(currentOsForPdv);
        } else if (osList.length > 0) {
          setPrintableOs(osList[0]);
        }
      }
      // F10: Criar Orçamento (em modo Orçamento), Registrar Pagamento (em modo Shopee) ou Abrir Caixa PDV (em modo OS)
      if (e.key === 'F10') {
        e.preventDefault();
        if (isShopeeMode) {
          handleRegistrarPagamentoShopee();
        } else if (isOrcamentoMode) {
          handleSaveOrcamento();
        } else {
          handleOpenPdv();
        }
      }
      // ESC: Close Modals
      if (e.key === 'Escape') {
        setShowClientDropdown(false);
        setShowProductDropdown(false);
        setShowQuickClientModal(false);
        setSelectedPreviewImage(null);
        closeDeleteModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentOsForPdv, osList, isOrcamentoMode, isShopeeMode, shopeeIdPedido, osItens.length]);

  // Helper to check if an OS has payment status "pago"
  const isOsPago = (os: OrdemServico) => {
    const paymentStatus = (os.paymentStatus || '').toLowerCase().trim();
    return paymentStatus === 'pago' || (os as any).pago === true;
  };

  // Check if current user can see & edit a paid OS
  // Apenas: Diretoria, Supervisor, Admin Master, Developer, CEO, Gerente, Supervivor.
  // Aos demais funcionários NÃO exibe a ação editar quando a OS estiver paga.
  const canUserSeePaidOsEdit = useMemo(() => {
    const { role, isDeveloper, username } = getLoggedUserAndPerfil();
    return isRoleAuthorizedToEditPaidOs(role, isDeveloper, username);
  }, []);

  // Backward-compatibility alias
  const canUserEditPaidOs = canUserSeePaidOsEdit;

  // Intercept Edit request:
  // "solicite uma senha para editar um os, cada responsavel pela os terá sua senha autorizada, se não for o responsavel ou alguem da direção que for editar a os, informe que ele não tem autorização, e ao colocar a senha e não for o responsavel, informe que a senha dele está incorreta."
  const handleRequestEditOs = (osToEdit: OrdemServico) => {
    // 1. Orçamento continua com o fluxo normal (preservação sem regressão)
    if (isOrcamentoMode) {
      handleLoadOsToEdit(osToEdit);
      return;
    }

    // 2. Cláusula de proteção contra regressão para OS Paga:
    if (isOsPago(osToEdit) && !canUserSeePaidOsEdit) {
      setFeedback({
        type: 'error',
        message: 'Acesso Restrito: Ordens de Serviço com pagamento PAGO só podem ser editadas por Diretoria, Supervisor, Admin Master, Developer, CEO ou Gerente com senha de autorização.',
      });
      return;
    }

    // 3. Regra de autorização para edição de OS:
    // "se não for o responsavel ou alguem da direção que for editar a os, informe que ele não tem autorização"
    const authCheck = canUserInitiateOsEdit(osToEdit);
    if (!authCheck.allowed) {
      setFeedback({
        type: 'error',
        message: authCheck.reason || `Acesso Restrito: Você não tem autorização para editar esta Ordem de Serviço. Apenas o responsável (${authCheck.responsibleName}) ou alguém da Direção podem editá-la.`,
      });
      return;
    }

    // 4. "solicite uma senha para editar um os, cada responsavel pela os terá sua senha autorizada"
    setEditOsAuthModal(osToEdit);
    setEditOsAuthPassword('');
    setEditOsAuthError('');
    setShowEditOsAuthPassword(false);
  };

  // Confirm authorization password for editing OS
  const handleConfirmEditOsAuth = async () => {
    if (!editOsAuthModal) return;
    const trimmed = editOsAuthPassword.trim();
    if (!trimmed) {
      setEditOsAuthError('Por favor, informe a sua senha de autorização.');
      return;
    }

    setIsVerifyingEditOsAuth(true);
    setEditOsAuthError('');

    try {
      const verifyRes = await verifyOsEditPassword(trimmed, editOsAuthModal);

      if (!verifyRes.valid) {
        // "e ao colocar a senha e não for o responsavel, informe que a senha dele está incorreta."
        const respName = editOsAuthModal.operador || editOsAuthModal.vendedorNome || 'o responsável pela OS';
        setEditOsAuthError(
          verifyRes.error || `Senha incorreta! Apenas a senha do responsável (${respName}) ou da Direção pode autorizar a edição desta Ordem de Serviço.`
        );
        setIsVerifyingEditOsAuth(false);
        return;
      }

      const targetOs = editOsAuthModal;
      setEditOsAuthModal(null);
      setEditOsAuthPassword('');
      setEditOsAuthError('');
      setShowEditOsAuthPassword(false);
      setIsVerifyingEditOsAuth(false);

      // Carrega a OS com autorização confirmada
      handleLoadOsToEdit(targetOs, true);
      setFeedback({
        type: 'success',
        message: `Edição da OS (${targetOs.codigo}) autorizada com sucesso por ${verifyRes.authorizedName || 'Usuário'} (${verifyRes.authorizedRole || 'Autorizado'}).`,
      });
    } catch (err: any) {
      setEditOsAuthError(err.message || 'Erro ao validar autorização de edição.');
      setIsVerifyingEditOsAuth(false);
    }
  };

  // Backward-compatibility alias
  const handleConfirmEditPaidOs = handleConfirmEditOsAuth;

  // Load OS / ORC for editing
  const handleLoadOsToEdit = (osToEdit: OrdemServico, skipAuthCheck: boolean = false) => {
    if (!isOrcamentoMode && isOsPago(osToEdit) && !canUserSeePaidOsEdit && !skipAuthCheck) {
      setFeedback({
        type: 'error',
        message: 'Acesso Restrito: Ordens de Serviço com status de pagamento PAGO não podem ser editadas sem autorização superior.',
      });
      return;
    }

    if (!isOrcamentoMode && !skipAuthCheck) {
      const authCheck = canUserInitiateOsEdit(osToEdit);
      if (!authCheck.allowed) {
        setFeedback({
          type: 'error',
          message: authCheck.reason || 'Acesso Restrito: Você não tem autorização para editar esta Ordem de Serviço. Apenas o responsável ou alguém da Direção podem editá-la.',
        });
        return;
      }
    }

    setActiveView('NEW_OS');
    setEditingOsId(osToEdit.id);
    setOsCodigo(osToEdit.codigo);
    setDataVenda(osToEdit.dataVenda);
    setOsSituacao(osToEdit.status || (isOrcamentoMode ? 'Orçamento Criado' : 'Aberta'));
    setCurrentOsForPdv(osToEdit);

    if (osToEdit.clienteCpfCnpj) {
      const foundClient = clients.find(
        (c) => c.cpf === osToEdit.clienteCpfCnpj || c.cnpj === osToEdit.clienteCpfCnpj
      );
      if (foundClient) {
        setSelectedClient(foundClient);
        setClientSearchText(getClientDisplayName(foundClient));
      } else {
        setSelectedClient(null);
        setClientSearchText(osToEdit.clienteNome);
      }
    } else {
      setSelectedClient(null);
      setClientSearchText(osToEdit.clienteNome);
    }

    if (osToEdit.shopeePedidoId || osToEdit.idPedido || (osToEdit as any).isShopee) {
      setShopeeIdPedido(osToEdit.shopeePedidoId || osToEdit.idPedido || '');
      setShopeeCompradorNome(osToEdit.clienteNome?.replace(/\s*\(Shopee ID:.*\)/i, '')?.replace(/^Shopee\s*-\s*Pedido\s*#.*/i, '') || '');
    }

    setSelectedStages(osToEdit.fluxoProducao || []);
    setTipoExpedicao((osToEdit.tipoExpedicao as TipoExpedicao) || 'NORMAL');
    setOsItens(osToEdit.itens || []);
    setAnexos(osToEdit.anexos || []);
    setObservacoes(osToEdit.observacoes || '');
    setFormaPagamento(osToEdit.formaPagamento || 'PIX');
    setEditingItemId(null);
    setFeedback({
      type: 'success',
      message: `${isOrcamentoMode ? 'Orçamento' : 'Ordem de Serviço'} ${osToEdit.codigo} carregada para edição.`,
    });
  };

  // Helper to check if a client has an ongoing/pending OS
  const findPendingOsForClient = (client: Client, ignoreOsId?: string): OrdemServico | undefined => {
    const clientName = getClientDisplayName(client).trim().toLowerCase();

    const clientCpf = client.cpf ? client.cpf.replace(/\D/g, '') : '';
    const clientCnpj = client.cnpj ? client.cnpj.replace(/\D/g, '') : '';

    return osList.find((os) => {
      // Ignore the OS currently being edited or explicitly ignored
      if (editingOsId && os.id === editingOsId) return false;
      if (ignoreOsId && os.id === ignoreOsId) return false;

      // Also ignore if it is an Orcamento
      if ((os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento || os.codigo?.startsWith('ORC')) return false;

      // Status in progress / pending payment check
      const paymentStatus = (os.paymentStatus || '').toLowerCase();
      const osStatus = (os.status || '').toLowerCase();
      const isPaid = paymentStatus === 'pago' || osStatus === 'concluído' || osStatus === 'entregue' || osStatus === 'cancelada';
      const isPending = !isPaid;

      if (!isPending) return false;

      // Match by CPF/CNPJ
      const osDoc = os.clienteCpfCnpj ? os.clienteCpfCnpj.replace(/\D/g, '') : '';
      if (osDoc && (osDoc === clientCpf || osDoc === clientCnpj)) {
        return true;
      }

      // Match by Client ID or Name
      if (os.clienteId && os.clienteId === client.id) {
        return true;
      }

      const osClientName = (os.clienteNome || '').trim().toLowerCase();
      if (osClientName && (osClientName === clientName || (clientName.length >= 4 && osClientName.includes(clientName)))) {
        return true;
      }

      return false;
    });
  };

  // Select client with check for existing pending OS
  const handleSelectClient = (client: Client) => {
    const clientName = getClientDisplayName(client).trim();

    // Check if client has any OS in course / pending
    const existingPendingOs = findPendingOsForClient(client);

    if (existingPendingOs && !isOrcamentoMode) {
      setShowClientDropdown(false);
      setPendingOsPrompt({ client, pendingOs: existingPendingOs, action: 'SELECT_CLIENT' });
    } else {
      setSelectedClient(client);
      setClientSearchText(clientName);
      setShowClientDropdown(false);
    }
  };

  // Reset form to start a New OS / ORC
  const handleNewOs = (customList?: any) => {
    const listToUse = Array.isArray(customList) ? customList : osList;
    const { name: currentUserName } = getLoggedUserAndPerfil();
    if (currentUserName && currentUserName !== 'Operador Logado') {
      setLoggedOperator(currentUserName);
    }
    setActiveView('NEW_OS');
    setEditingOsId(null);
    const filteredDocs = listToUse.filter((o) =>
      isShopeeMode
        ? (o as any).tipoDocumento === 'OSS' || (o as any).isShopee || o.codigo?.startsWith('OSS')
        : isOrcamentoMode
        ? (o as any).tipoDocumento === 'ORCAMENTO' || (o as any).isOrcamento || o.codigo?.startsWith('ORC')
        : (o as any).tipoDocumento !== 'ORCAMENTO' && !(o as any).isOrcamento && !o.codigo?.startsWith('ORC')
    );
    const docNumbers = filteredDocs.map((o) => {
      const match = o.codigo?.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const nextNum = (docNumbers.length > 0 ? Math.max(...docNumbers) : 0) + 1;
    setOsCodigo(
      isShopeeMode
        ? `OSS${String(nextNum).padStart(8, '0')}`
        : isOrcamentoMode
        ? `ORC${String(nextNum).padStart(8, '0')}`
        : `OS${String(nextNum).padStart(8, '0')}`
    );
    
    // Asynchronously guarantee backend synchronization
    ApiService.getNextOsCode(isShopeeMode ? 'OSS' : isOrcamentoMode ? 'ORCAMENTO' : 'OS')
      .then((res) => {
        if (res?.nextCode) {
          setOsCodigo(res.nextCode);
        }
      })
      .catch(() => {});

    setDataVenda(new Date().toLocaleDateString('pt-BR'));
    setOsSituacao(isOrcamentoMode ? 'Orçamento Criado' : 'Aberta');
    setSelectedClient(null);
    setClientSearchText('');
    setShopeeIdPedido('');
    setShopeeCompradorNome('');
    setSelectedStages(
      isShopeeMode
        ? ['Designer', 'Impressão', 'Calandra', 'Costura', 'SHOPEE']
        : ['Designer', 'Impressão', 'Calandra', 'Costura', 'RETIRADA(Recepção)']
    );
    setTipoExpedicao(isShopeeMode ? 'SHOPEE' : 'NORMAL');
    setOsItens([]);
    setAnexos([]);
    setObservacoes('');
    setFormaPagamento('PIX');
    setEditingItemId(null);
    setCurrentOsForPdv(null);
    setFeedback({ type: null, message: '' });
  };

  // Sync next code when switching between ORC, OS and OSS modes
  useEffect(() => {
    let isCancelled = false;
    if (!editingOsId && osList.length >= 0) {
      const filteredDocs = osList.filter((o) =>
        isShopeeMode
          ? (o as any).tipoDocumento === 'OSS' || (o as any).isShopee || o.codigo?.startsWith('OSS')
          : isOrcamentoMode
          ? (o as any).tipoDocumento === 'ORCAMENTO' || (o as any).isOrcamento || o.codigo?.startsWith('ORC')
          : (o as any).tipoDocumento !== 'ORCAMENTO' && !(o as any).isOrcamento && !o.codigo?.startsWith('ORC')
      );
      const docNumbers = filteredDocs.map((o) => {
        const match = o.codigo?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
      const nextNum = (docNumbers.length > 0 ? Math.max(...docNumbers) : 0) + 1;
      setOsCodigo(
        isShopeeMode
          ? `OSS${String(nextNum).padStart(8, '0')}`
          : isOrcamentoMode
          ? `ORC${String(nextNum).padStart(8, '0')}`
          : `OS${String(nextNum).padStart(8, '0')}`
      );
      setOsSituacao(isOrcamentoMode ? 'Orçamento Criado' : 'Aberta');

      ApiService.getNextOsCode(isShopeeMode ? 'OSS' : isOrcamentoMode ? 'ORCAMENTO' : 'OS')
        .then((res) => {
          if (!isCancelled && res?.nextCode && !editingOsId) {
            setOsCodigo(res.nextCode);
          }
        })
        .catch(() => {});
    }
    return () => {
      isCancelled = true;
    };
  }, [isShopeeMode, isOrcamentoMode, activeMenu, osList.length, editingOsId]);

  // Toggle stage in Kanban sequence (Fluxo de 8 estágios oficiais)
  const toggleStage = (stage: ProductionStage) => {
    if (stage === 'Designer') {
      if (selectedStages.includes('Designer')) {
        setSelectedStages((prev) => prev.filter((s) => s !== 'Designer'));
      } else {
        setSelectedStages((prev) => ['Designer', ...prev.filter((s) => s !== 'Designer')]);
      }
      return;
    }

    const fabricationStages = ['Impressão', 'Calandra', 'Costura'];
    if (fabricationStages.includes(stage as string)) {
      if (selectedStages.includes(stage)) {
        if (selectedStages.filter((s) => fabricationStages.includes(s as string)).length > 1) {
          setSelectedStages((prev) => prev.filter((s) => s !== stage));
        }
      } else {
        const order = ['Designer', 'Impressão', 'Calandra', 'Costura', 'EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)'];
        const nextList = [...selectedStages, stage].sort((a, b) => order.indexOf(a as string) - order.indexOf(b as string));
        setSelectedStages(nextList);
      }
      return;
    }

    const destinationStages = ['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)'];
    if (destinationStages.includes(stage as string)) {
      setSelectedStages((prev) => [
        ...prev.filter((s) => !destinationStages.includes(s as string)),
        stage,
      ]);
      if (stage === 'EXCURSÃO') {
        setTipoExpedicao('EXPRESSO EXCURSÃO');
      } else if (tipoExpedicao === 'EXPRESSO EXCURSÃO') {
        setTipoExpedicao('NORMAL');
      }
    }
  };

  // Handle Quick Add Product (+ button or ENTER in description field)
  const handleAddOrUpdateProduct = async () => {
    if (!itemDescricao.trim()) {
      setFeedback({ type: 'error', message: 'Digite a descrição do produto.' });
      return;
    }

    if (isProductUnregistered || !hasValidCategory || !effectiveProductCategory) {
      setFeedback({
        type: 'error',
        message: 'Produto não cadastrado! Selecione uma categoria cadastrada no catálogo.',
      });
      return;
    }

    const effectiveItemPrice = comMedidas && valorFinalCalculado > 0 ? valorFinalCalculado : itemValorUnitario;
    const effectiveMultiplier = comMedidas ? (valorFinalCalculado > 0 ? 1 : (medidaCalculo > 0 ? medidaCalculo : 1)) : 1;
    const rawSubtotal = itemQuantidade * effectiveMultiplier * effectiveItemPrice;
    const descVal = Number(itemDescontoInput) || 0;
    const descontoCalculado = itemTipoDesconto === '%' ? (rawSubtotal * descVal) / 100 : descVal;
    const itemTotal = Math.max(0, rawSubtotal - descontoCalculado);

    const { role, isDeveloper } = getLoggedUserAndPerfil();
    if (descontoCalculado > 0) {
      const canApproveDiscount = canUserPerformAction(role, 'ordemServico', 'descontoEspecial', isDeveloper);
      if (!canApproveDiscount) {
        setFeedback({
          type: 'error',
          message: 'Acesso Negado: Seu perfil não possui permissão para Conceder / Aprovar Desconto (permissão desmarcada no RBAC).',
        });
        return;
      }
    }

    const categoryToSave = effectiveProductCategory;

    const effectivePrecoMedio = itemPrecoMedio > 0 ? itemPrecoMedio : (itemQuantidade > 0 ? Number((itemTotal / (itemQuantidade * (effectiveMultiplier || 1))).toFixed(2)) : effectiveItemPrice);

    if (editingItemId) {
      // Update existing item
      setOsItens((prev) =>
        prev.map((i) =>
          i.id === editingItemId
            ? {
                ...i,
                descricao: itemDescricao,
                categoria: categoryToSave || i.categoria || undefined,
                unidade: itemUnidade,
                quantidade: itemQuantidade,
                valorUnitario: effectiveItemPrice,
                precoMedio: effectivePrecoMedio,
                desconto: descontoCalculado,
                total: itemTotal,
                comMedidas,
                medidaFrente: comMedidas ? parseFloat(String(medidaFrente).replace(',', '.')) || 0 : undefined,
                medidaLateral: comMedidas ? parseFloat(String(medidaLateral).replace(',', '.')) || 0 : undefined,
                medidaAltura: comMedidas ? parseFloat(String(medidaAltura).replace(',', '.')) || 0 : undefined,
                medidaCaimento: comMedidas ? parseFloat(String(medidaCaimento).replace(',', '.')) || 0 : undefined,
                medidaBabado: comMedidas ? parseFloat(String(medidaBabado).replace(',', '.')) || 0 : undefined,
                medidaCalculo: comMedidas ? medidaCalculo : undefined,
                comSobreposicao: comMedidas && !isCilindroTable && !isBabadoTable ? comSobreposicao : undefined,
                valorBabado: comMedidas ? valorDoBabado : undefined,
                valorTampo: comMedidas ? valorDoTampo : undefined,
                valorSobreposicao: comMedidas && !isCilindroTable && !isBabadoTable && !isCuboTable ? valorDaSobreposicao : undefined,
                valorBase: comMedidas && isCilindroTable ? valorBase : undefined,
                valorBaseCilindro: comMedidas && isCilindroTable ? valorBase : undefined,
                tampCilindro: comMedidas && isCilindroTable ? ((parseFloat(String(medidaLateral || medidaFrente).replace(',', '.')) || 0) / 3) : undefined,
                valorTampoCilindro: comMedidas && isCilindroTable ? valorDoTampo : undefined,
                medidaTampo: comMedidas && isCuboTable ? (parseFloat(String(medidaTampo || medidaFrente).replace(',', '.')) || 0) : undefined,
                valorCubo: comMedidas && isCuboTable ? valorCuboCorpo : undefined,
                calculoCubo: comMedidas && isCuboTable ? calculoCubo : undefined,
                precoExpresso: precoExpressoActive,
                qtdBabado: comMedidas && isBabadoTable ? Math.max(2, parseInt(medidaQtdBabado) || 2) : undefined,
                valorFaixa: comMedidas && isBabadoTable ? valorFaixa : undefined,
                valorFaixaDeBabado: comMedidas && isBabadoTable ? valorFaixaDeBabado : undefined,
                formulaMedidaId: effectiveProductFormula?.id,
              }
            : i
        )
      );
      setEditingItemId(null);
      setFeedback({ type: 'success', message: 'Item atualizado com sucesso!' });
    } else {
      // Create product code (P0000001 format) or use catalog code and add to OS items
      const productIndex = productCatalog.length + osItens.length + 1;
      const newCode = matchingCatalogProduct?.codigo || `P${String(productIndex).padStart(7, '0')}`;
      const newItem: OsItem = {
        id: `ITEM-${Date.now()}`,
        codigo: newCode,
        descricao: itemDescricao,
        categoria: categoryToSave,
        unidade: itemUnidade,
        quantidade: itemQuantidade,
        valorUnitario: effectiveItemPrice,
        precoMedio: effectivePrecoMedio,
        desconto: descontoCalculado,
        total: itemTotal,
        comMedidas,
        medidaFrente: comMedidas ? parseFloat(String(medidaFrente).replace(',', '.')) || 0 : undefined,
        medidaLateral: comMedidas ? parseFloat(String(medidaLateral).replace(',', '.')) || 0 : undefined,
        medidaAltura: comMedidas ? parseFloat(String(medidaAltura).replace(',', '.')) || 0 : undefined,
        medidaCaimento: comMedidas ? parseFloat(String(medidaCaimento).replace(',', '.')) || 0 : undefined,
        medidaBabado: comMedidas ? parseFloat(String(medidaBabado).replace(',', '.')) || 0 : undefined,
        medidaCalculo: comMedidas ? medidaCalculo : undefined,
        comSobreposicao: comMedidas && !isCilindroTable && !isBabadoTable && !isCuboTable ? comSobreposicao : undefined,
        valorBabado: comMedidas ? valorDoBabado : undefined,
        valorTampo: comMedidas ? valorDoTampo : undefined,
        valorSobreposicao: comMedidas && !isCilindroTable && !isBabadoTable && !isCuboTable ? valorDaSobreposicao : undefined,
        valorBase: comMedidas && isCilindroTable ? valorBase : undefined,
        valorBaseCilindro: comMedidas && isCilindroTable ? valorBase : undefined,
        tampCilindro: comMedidas && isCilindroTable ? ((parseFloat(String(medidaLateral || medidaFrente).replace(',', '.')) || 0) / 3) : undefined,
        valorTampoCilindro: comMedidas && isCilindroTable ? valorDoTampo : undefined,
        medidaTampo: comMedidas && isCuboTable ? (parseFloat(String(medidaTampo || medidaFrente).replace(',', '.')) || 0) : undefined,
        valorCubo: comMedidas && isCuboTable ? valorCuboCorpo : undefined,
        calculoCubo: comMedidas && isCuboTable ? calculoCubo : undefined,
        precoExpresso: precoExpressoActive,
        qtdBabado: comMedidas && isBabadoTable ? Math.max(2, parseInt(medidaQtdBabado) || 2) : undefined,
        valorFaixa: comMedidas && isBabadoTable ? valorFaixa : undefined,
        valorFaixaDeBabado: comMedidas && isBabadoTable ? valorFaixaDeBabado : undefined,
        formulaMedidaId: effectiveProductFormula?.id,
      };

      setOsItens((prev) => [...prev, newItem]);
      setFeedback({ type: 'success', message: 'Item adicionado à Ordem de Serviço!' });
    }

    // Reset item input fields (limpa todo o formulário de itens e medidas)
    setItemDescricao('');
    setItemUnidade('UN');
    setItemQuantidade(1);
    setItemValorUnitario(0);
    setItemPrecoMedio(0);
    setItemDescontoInput(0);
    setComMedidas(false);
    setPrecoExpressoActive(false);
    setMedidaFrente('');
    setMedidaLateral('');
    setMedidaAltura('');
    setMedidaCaimento('');
    setMedidaBabado('');
    setMedidaQtdBabado('');
    setMedidaTampo('');
    setComSobreposicao(false);
    setSelectedFormulaOverride(null);
    setShowProductDropdown(false);
    if (descricaoInputRef.current) {
      descricaoInputRef.current.focus();
    }
  };

  // Select product from intelligent autocomplete dropdown
  const handleSelectCatalogProduct = (prod: ProductCatalog) => {
    if (prod.categoria && isRegisteredCategory(prod.categoria)) {
      setItemCategoria(prod.categoria);
    }
    setItemDescricao(prod.descricao);
    const hasMedidas = Boolean(prod.comMedidas) || 
      prod.unidade === 'M2' || 
      /medida|mesa|toalha|saia|painel|m2/i.test(prod.descricao) ||
      (prod.categoria && /medida|mesa|toalha|saia|painel|m2/i.test(prod.categoria));
    setItemUnidade(prod.unidade || (hasMedidas ? 'M2' : 'UN'));
    const expressPrice = (prod.precoExpresso !== undefined && Number(prod.precoExpresso) > 0)
      ? Number(prod.precoExpresso)
      : undefined;
    const salePrice = (prod.precoVenda !== undefined && Number(prod.precoVenda) > 0)
      ? Number(prod.precoVenda)
      : (Number(prod.valorUnitario) || 0);
    const chosenPrice = (precoExpressoActive && expressPrice !== undefined) ? expressPrice : salePrice;
    setItemValorUnitario(chosenPrice);
    setItemPrecoMedio(prod.precoMedio || 0);
    if (hasMedidas) {
      setComMedidas(true);
    }
    if (prod.formulaMedidaId) {
      setSelectedFormulaOverride(prod.formulaMedidaId);
    } else {
      setSelectedFormulaOverride('padrao_altura_largura');
    }
    // Limpa todo o campo de medidas para inserção limpa
    setMedidaFrente('');
    setMedidaLateral('');
    setMedidaAltura('');
    setMedidaCaimento('');
    setMedidaBabado('');
    setMedidaQtdBabado('');
    setMedidaTampo('');
    setComSobreposicao(false);
    setShowProductDropdown(false);
  };

  // Handle Edit Item
  const handleEditItem = (item: OsItem) => {
    setEditingItemId(item.id);
    setItemDescricao(item.descricao);
    setItemCategoria(item.categoria && isRegisteredCategory(item.categoria) ? item.categoria : 'ALL');
    setItemUnidade(item.unidade);
    setItemQuantidade(item.quantidade);
    setItemValorUnitario(item.valorUnitario);
    setItemPrecoMedio(item.precoMedio);
    setItemTipoDesconto('R$');
    setItemDescontoInput(item.desconto || 0);
    setPrecoExpressoActive(Boolean(item.precoExpresso));
    if (item.comMedidas) {
      setComMedidas(true);
      setMedidaFrente(item.medidaFrente !== undefined ? String(item.medidaFrente) : '');
      setMedidaLateral(item.medidaLateral !== undefined ? String(item.medidaLateral) : '');
      setMedidaAltura(item.medidaAltura !== undefined ? String(item.medidaAltura) : '');
      setMedidaCaimento(item.medidaCaimento !== undefined ? String(item.medidaCaimento) : '');
      setMedidaBabado(item.medidaBabado !== undefined ? String(item.medidaBabado) : '');
      setMedidaQtdBabado(item.qtdBabado !== undefined ? String(Math.max(2, item.qtdBabado)) : '');
      setMedidaTampo(item.medidaTampo !== undefined ? String(item.medidaTampo) : (item.medidaFrente !== undefined ? String(item.medidaFrente) : ''));
      setComSobreposicao(Boolean(item.comSobreposicao));
      if (item.formulaMedidaId) {
        setSelectedFormulaOverride(item.formulaMedidaId);
      } else if (!item.medidaBabado && !item.medidaCaimento && !item.calculoCubo && item.valorBaseCilindro === undefined) {
        setSelectedFormulaOverride('padrao_altura_largura');
      } else {
        setSelectedFormulaOverride(null);
      }
    } else {
      setComMedidas(false);
      setMedidaTampo('');
      setSelectedFormulaOverride(null);
    }
    // Focus back on product description input
    if (descricaoInputRef.current) {
      descricaoInputRef.current.focus();
    }
  };

  // Handle Delete Item
  const handleDeleteItem = (id: string) => {
    setOsItens((prev) => prev.filter((i) => i.id !== id));
  };

  // Handle Attachment Upload for Artes (Multiple Files)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files) as File[];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileUrl = await compressImageFile(file);
      const currentCount = anexos.length + i + 1;
      const newAttachment: OsAttachment = {
        id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'ARTE',
        label: `Arte #${currentCount}`,
        fileName: file.name,
        fileUrl,
        uploadedAt: new Date().toISOString(),
        x: 10 + ((currentCount - 1) % 3) * 28,
        y: 10 + Math.floor((currentCount - 1) / 3) * 28,
        width: 25,
        height: 25,
        scale: 1,
        rotation: 0,
      };
      setAnexos((prev) => [...prev, newAttachment]);
    }
  };

  // Handle Attachment Upload for Artes "Para Impressão" (Preserves high fidelity & resolution, not rendered in printed physical OS)
  const handleFileUploadParaImpressao = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files) as File[];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });

      const currentCount = anexos.length + i + 1;
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
        : `${(file.size / 1024).toFixed(1)} KB`;

      const newAttachment: OsAttachment = {
        id: `ATT-PRINT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'PARA_IMPRESSAO',
        isParaImpressao: true,
        label: `Arte para Impressão #${currentCount}`,
        fileName: file.name,
        fileUrl,
        fileSize: sizeStr,
        uploadedAt: new Date().toISOString(),
        x: 10 + ((currentCount - 1) % 3) * 28,
        y: 10 + Math.floor((currentCount - 1) / 3) * 28,
        width: 25,
        height: 25,
        scale: 1,
        rotation: 0,
      };
      setAnexos((prev) => [...prev, newAttachment]);
    }
  };

  // Handle direct file download
  const handleDownloadAttachment = (att: OsAttachment) => {
    if (!att.fileUrl) return;
    const link = document.createElement('a');
    link.href = att.fileUrl;
    link.download = att.fileName || (att.isParaImpressao ? 'arte_para_impressao.png' : 'arte_os.png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate Subtotal & Total
  const subtotalOS = osItens.reduce((sum, item) => sum + item.total, 0);
  const totalDescontosOS = osItens.reduce((sum, item) => sum + item.desconto, 0);
  const valorFinalOS = Math.max(0, subtotalOS);

  // Handle Quick Client Creation Modal Save
  const handleSaveQuickClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClientNome.trim() || !quickClientPhone.trim()) {
      alert('Nome e Telefone são obrigatórios para cadastrar o cliente.');
      return;
    }

    try {
      const isCnpj = quickClientDoc.length > 14;
      const newClient = await ApiService.createClient({
        type: isCnpj ? 'PJ' : 'PF',
        nome: !isCnpj ? quickClientNome.trim() : undefined,
        sobrenome: undefined,
        razaoSocial: isCnpj ? quickClientNome : undefined,
        nomeFantasia: isCnpj ? quickClientNome : undefined,
        cpf: !isCnpj ? quickClientDoc : undefined,
        cnpj: isCnpj ? quickClientDoc : undefined,
        telefone: quickClientPhone,
        email: quickClientEmail || 'cliente@exemplo.com',
        status: 'ACTIVE',
        endereco: {
          cep: '60510-291',
          logradouro: 'Avenida Senador Fernandes Tavora',
          numero: '2305',
          bairro: 'Henrique Jorge',
          cidade: 'Fortaleza',
          estado: 'CE',
        },
      });

      setSelectedClient(newClient);
      setClientSearchText(quickClientNome);
      setShowQuickClientModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar novo cliente.');
    }
  };

  // Helper to resolve or verify if a registered client is selected or found in client list
  const getRegisteredClient = (): Client | null => {
    if (selectedClient) return selectedClient;

    const textToSearch = clientSearchText.trim().toLowerCase();
    if (!textToSearch) return null;

    const docClean = textToSearch.replace(/\D/g, '');

    const found = clients.find((c) => {
      const doc = (c.type === 'PF' ? c.cpf : c.cnpj || '').replace(/\D/g, '');
      const clientName = getClientDisplayName(c).toLowerCase();

      const docMatch = !!(docClean.length > 0 && doc && doc === docClean);
      const nameMatch = !!(
        textToSearch.length > 0 &&
        (clientName === textToSearch ||
          (textToSearch.length >= 3 && clientName.includes(textToSearch)))
      );
      return docMatch || nameMatch;
    });

    return found || null;
  };

  // Handle Save Ordem de Serviço
  const handleSaveOs = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFeedback({ type: null, message: '' });

    const { role, name, isDeveloper } = getLoggedUserAndPerfil();
    if (editingOsId && !isOrcamentoMode) {
      const existing = osList.find((o) => o.id === editingOsId);
      if (existing && isOsPago(existing) && !canUserSeePaidOsEdit) {
        setFeedback({
          type: 'error',
          message: 'Acesso Restrito: Esta Ordem de Serviço possui status de pagamento PAGO e sua edição é permitida apenas para Diretoria, Supervisor, Admin Master, Developer, CEO, Gerente ou Supervivor.',
        });
        return;
      }
    }

    const canCreateEdit = canUserPerformAction(role, 'ordemServico', 'criarEditar', isDeveloper);
    if (!canCreateEdit) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para Criar / Editar Ordens de Serviço (permissão desmarcada no RBAC).',
      });
      return;
    }

    if (!isRoleAuthorizedForSales(role, isDeveloper)) {
      setFeedback({
        type: 'error',
        message: 'Acesso Restrito: Apenas os cargos autorizados (Developer, CEO, Gerente Geral, Supervisor, Vendedor(a), Recepção) podem efetuar vendas e emitir Ordens de Serviço.',
      });
      return;
    }

    const activeRegisteredClient = getRegisteredClient();
    if (!activeRegisteredClient) {
      setFeedback({
        type: 'error',
        message: 'Atenção: Para "Salvar Alterações" e avançar, é OBRIGATÓRIO selecionar ou cadastrar um cliente e adicionar pelo menos 1 produto.',
      });
      return;
    }

    if (!selectedClient) {
      setSelectedClient(activeRegisteredClient);
    }

    if (osItens.length === 0) {
      setFeedback({ type: 'error', message: 'Adicione pelo menos 1 item à Ordem de Serviço.' });
      return;
    }

    try {
      const clientName = getClientDisplayName(activeRegisteredClient);

      const clientDoc = activeRegisteredClient.type === 'PF'
        ? activeRegisteredClient.cpf
        : activeRegisteredClient.cnpj;

      const { role, name } = getLoggedUserAndPerfil();
      const existingHistory = editingOsId
        ? osList.find((o) => o.id === editingOsId)?.historicoEdicoes || []
        : [];

      const formattedPrazo = new Date(prazoEntrega).toLocaleDateString('pt-BR');
      let updatedHistory = existingHistory;
      let setorAceitoPorUpdates: any = undefined;

      if (editingOsId) {
        const existingOs = osList.find((o) => o.id === editingOsId);
        if (existingOs) {
          const changesList: string[] = [];

          if (clientName && clientName !== existingOs.clienteNome) {
            changesList.push(`Cliente (${existingOs.clienteNome || '---'} ➔ ${clientName})`);
          }
          if (clientDoc && clientDoc !== existingOs.clienteCpfCnpj) {
            changesList.push(`Documento CPF/CNPJ (${existingOs.clienteCpfCnpj || '---'} ➔ ${clientDoc})`);
          }
          if (formattedPrazo !== existingOs.prazoEntrega) {
            changesList.push(`Prazo de entrega (${existingOs.prazoEntrega || '---'} ➔ ${formattedPrazo})`);
          }
          if (tipoExpedicao !== existingOs.tipoExpedicao) {
            changesList.push(`Tipo de expedição (${existingOs.tipoExpedicao || 'NORMAL'} ➔ ${tipoExpedicao})`);
          }
          if (formaPagamento !== existingOs.formaPagamento) {
            changesList.push(`Forma de pagamento (${existingOs.formaPagamento || '---'} ➔ ${formaPagamento})`);
          }
          if (observacoes !== existingOs.observacoes) {
            changesList.push('Instruções e observações do pedido');
          }
          if (Math.abs(valorFinalOS - (existingOs.valorFinal || 0)) > 0.01) {
            changesList.push(`Valor final (R$ ${(existingOs.valorFinal || 0).toFixed(2)} ➔ R$ ${valorFinalOS.toFixed(2)})`);
          }
          if (JSON.stringify(osItens) !== JSON.stringify(existingOs.itens)) {
            changesList.push(`Itens da OS (${osItens.length} item(s))`);
          }
          if (JSON.stringify(anexos) !== JSON.stringify(existingOs.anexos)) {
            changesList.push('Arquivos/anexos do layout');
          }
          if (JSON.stringify(selectedStages) !== JSON.stringify(existingOs.fluxoProducao)) {
            changesList.push(`Fluxo de produção (${selectedStages.join(' ➔ ')})`);
          }

          // Apenas registra caso haja edição real
          if (changesList.length > 0) {
            const detailMsg = `Modificações realizadas: ${changesList.join(', ')}.`;
            const newHistoryEntry = createOsHistoryEntry(
              'editou dados da Ordem de Serviço',
              detailMsg
            );
            updatedHistory = [newHistoryEntry, ...existingHistory];

            const now = new Date();
            const nowISO = now.toISOString();
            const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

            setorAceitoPorUpdates = [...(existingOs.setorAceitoPor || [])];
            setorAceitoPorUpdates.push({
              estagio: 'Sistema',
              descricaoEtapa: 'Edição de Dados da OS',
              funcionario: loggedOperator || name || 'VENDEDOR MATRIZ',
              aceitoEm: dataHoraStr,
              aceitoEmISO: nowISO,
              status: 'Concluído',
              concluidoEm: dataHoraStr,
              concluidoEmISO: nowISO,
              observacao: `Edição de OS: ${changesList.join(', ')}`
            });
          }
        }
      } else {
        // Criação de OS
        const newHistoryEntry = createOsHistoryEntry(
          'criou a Ordem de Serviço',
          `Ordem de Serviço criada para o cliente ${clientName}.`
        );
        updatedHistory = [newHistoryEntry, ...existingHistory];
      }

      const clientEndereco = activeRegisteredClient.endereco
        ? `${activeRegisteredClient.endereco.logradouro || ''}${activeRegisteredClient.endereco.numero ? `, Nº ${activeRegisteredClient.endereco.numero}` : ''}${activeRegisteredClient.endereco.complemento ? ` (${activeRegisteredClient.endereco.complemento})` : ''}${activeRegisteredClient.endereco.bairro ? ` - Bairro ${activeRegisteredClient.endereco.bairro}` : ''}${activeRegisteredClient.endereco.cidade ? `, ${activeRegisteredClient.endereco.cidade}` : ''}${activeRegisteredClient.endereco.estado ? `/${activeRegisteredClient.endereco.estado}` : ''}${activeRegisteredClient.endereco.cep ? ` - CEP: ${activeRegisteredClient.endereco.cep}` : ''}`
        : (editingOsId ? osList.find((o) => o.id === editingOsId)?.clienteEndereco || '' : '');

      const payload: any = {
        codigo: editingOsId ? (osList.find((o) => o.id === editingOsId)?.codigo || osCodigo) : undefined,
        operador: loggedOperator || name || 'VENDEDOR MATRIZ',
        editorPerfil: role,
        updatedBy: name,
        clienteId: activeRegisteredClient.id,
        clienteNome: clientName,
        clienteCpfCnpj: clientDoc,
        clienteTelefone: activeRegisteredClient.telefone || '',
        clienteEmail: activeRegisteredClient.email || '',
        clienteEndereco: clientEndereco,
        prazoEntrega: new Date(prazoEntrega).toLocaleDateString('pt-BR'),
        fluxoProducao: selectedStages,
        tipoExpedicao,
        destinoExpedicao:
          (selectedStages.find((s) => ['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)'].includes(s as string)) as string) ||
          (tipoExpedicao === 'EXPRESSO EXCURSÃO' ? 'EXCURSÃO' : 'RETIRADA(Recepção)'),
        itens: osItens,
        anexos,
        observacoes,
        subtotal: subtotalOS,
        desconto: totalDescontosOS,
        valorFinal: valorFinalOS,
        formaPagamento,
        estagioAtual: editingOsId ? (osList.find((o) => o.id === editingOsId)?.estagioAtual || 'Sistema') : 'Sistema',
        historicoEdicoes: updatedHistory,
        ...(setorAceitoPorUpdates && { setorAceitoPor: setorAceitoPorUpdates })
      };

      const nextSector = selectedStages.length > 1 ? selectedStages[1] : 'Designer';

      if (editingOsId) {
        const updated = await ApiService.updateOs(editingOsId, payload);
        setCurrentOsForPdv(updated);
        setOsList((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        NotificationService.notifyOsUpdated(updated, name || 'Operador');
        setFeedback({
          type: 'success',
          message: `✅ Ordem de Serviço "${updated.codigo}" atualizada com sucesso! Notificação enviada ao setor [${nextSector}].`,
        });
      } else {
        const created = await ApiService.createOs(payload);
        setCurrentOsForPdv(created);
        setOsList((prev) => [created, ...prev.filter((o) => o.id !== created.id)]);
        NotificationService.notifyOsCreated(created, name || 'Operador', nextSector);
        setFeedback({
          type: 'success',
          message: `✅ Nova Ordem de Serviço "${created.codigo}" gerada com sucesso! Notificação enviada ao setor [${nextSector}].`,
        });
        // Atualiza próximo código em background sem travar a interface
        ApiService.getNextOsCode('OS').then((res) => {
          if (res?.nextCode) setOsCodigo(res.nextCode);
        }).catch(() => {});
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar a Ordem de Serviço.' });
    }
  };

  // CORE ACTION FOR SHOPEE: "REGISTRAR PAGAMENTO"
  // As requested:
  // - Retires "Pagar no Caixa PDV (F10)"
  // - Includes "REGISTRAR PAGAMENTO"
  // - When clicked: "PAGAMENTO REGISTRADO COM SUCESSO"
  // - After that, status is saved as "PAGO" (an "OSS")
  // - Listed alongside "OS" and "VND" normally
  const handleRegistrarPagamentoShopee = async () => {
    const cleanIdPedido = shopeeIdPedido.trim();
    if (!cleanIdPedido) {
      setFeedback({
        type: 'error',
        message: 'Atenção: Por favor, informe o "ID DO PEDIDO" da Shopee para registrar o pagamento.',
      });
      return;
    }

    if (osItens.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Atenção: Adicione pelo menos 1 item à Ordem de Serviço Shopee.',
      });
      return;
    }

    const { role, isDeveloper, name } = getLoggedUserAndPerfil();
    const cleanBuyer = shopeeCompradorNome.trim();
    const clientDisplayName = cleanBuyer
      ? `${cleanBuyer} (Shopee ID: ${cleanIdPedido})`
      : `Shopee - Pedido #${cleanIdPedido}`;

    const todayBR = new Date().toLocaleDateString('pt-BR');

    const historyEntry = createOsHistoryEntry(
      'registrou o pagamento da OSS',
      `Pagamento de R$ ${valorFinalOS.toFixed(2)} registrado com sucesso via Plataforma Shopee para o Pedido ID: ${cleanIdPedido}.`
    );

    const payload: Partial<OrdemServico> & { [key: string]: any } = {
      tipoDocumento: 'OSS',
      isShopee: true,
      shopeePedidoId: cleanIdPedido,
      idPedido: cleanIdPedido,
      codigo: editingOsId ? (osList.find((o) => o.id === editingOsId)?.codigo || osCodigo) : undefined,
      operador: loggedOperator || name || 'Vendedora Shopee',
      vendedorNome: loggedOperator || name || 'Vendedora Shopee',
      editorPerfil: role,
      updatedBy: name,
      clienteId: `CLI-SHOPEE-${cleanIdPedido}`,
      clienteNome: clientDisplayName,
      clienteCpfCnpj: 'SHOPEE-MARKETPLACE',
      clienteTelefone: 'Shopee App',
      clienteEmail: 'pedidos@shopee.com.br',
      clienteEndereco: 'Plataforma Shopee Brasil (Marketplace)',
      prazoEntrega: new Date(prazoEntrega).toLocaleDateString('pt-BR'),
      fluxoProducao: selectedStages,
      tipoExpedicao: 'SHOPEE',
      destinoExpedicao: 'SHOPEE',
      itens: osItens,
      anexos,
      observacoes: observacoes ? `[ID PEDIDO SHOPEE: ${cleanIdPedido}] ${observacoes}` : `[ID PEDIDO SHOPEE: ${cleanIdPedido}]`,
      subtotal: subtotalOS,
      desconto: totalDescontosOS,
      valorFinal: valorFinalOS,
      formaPagamento: 'Plataforma Shopee',
      paymentStatus: 'pago',
      status: 'Pago' as any,
      situacao: 'Pago' as any,
      estagioAtual: selectedStages.includes('Designer') ? 'Designer' : (selectedStages[0] || 'Designer'),
      dataQuitacao: todayBR,
      historicoEdicoes: [historyEntry],
    };

    try {
      let savedOs: OrdemServico;
      if (editingOsId) {
        savedOs = await ApiService.updateOs(editingOsId, payload);
      } else {
        savedOs = await ApiService.createOs(payload as any);
      }

      setOsList((prev) => [savedOs, ...prev.filter((o) => o.id !== savedOs.id)]);
      setOsSituacao('Pago');

      const nextSector = selectedStages.length > 1 ? selectedStages[1] : 'Designer';
      NotificationService.notifyOsCreated(savedOs, name || 'Vendedora Shopee', nextSector);

      // EXACT USER REQUIREMENT: "PAGAMENTO REGISTRADO COM SUCESSO"
      setFeedback({
        type: 'success',
        message: 'PAGAMENTO REGISTRADO COM SUCESSO',
      });

      setTimeout(() => {
        handleNewOs();
      }, 1500);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao registrar pagamento da Ordem de Serviço Shopee.',
      });
    }
  };

  // Handle Create/Save Orçamento (Bypasses PDV / Sales / Commission accounting)
  const handleSaveOrcamento = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFeedback({ type: null, message: '' });

    const { role, isDeveloper, name } = getLoggedUserAndPerfil();
    const canCreateEdit = canUserPerformAction(role, 'orcamento', 'criarEditar', isDeveloper);
    if (!canCreateEdit) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para Criar / Editar Orçamentos (permissão desmarcada no RBAC).',
      });
      return;
    }

    if (!isRoleAuthorizedForSales(role, isDeveloper)) {
      setFeedback({
        type: 'error',
        message: 'Acesso Restrito: Apenas os cargos autorizados (Developer, CEO, Gerente Geral, Supervisor, Vendedor(a), Recepção) podem emitir Orçamentos.',
      });
      return;
    }

    const activeRegisteredClient = getRegisteredClient();
    if (!activeRegisteredClient) {
      setFeedback({
        type: 'error',
        message: 'Atenção: Para criar ou salvar um Orçamento é OBRIGATÓRIO selecionar ou cadastrar um CLIENTE no sistema. Clique em "Novo Cliente" para realizar o cadastro.',
      });
      return;
    }

    if (!selectedClient) {
      setSelectedClient(activeRegisteredClient);
    }

    if (osItens.length === 0) {
      setFeedback({ type: 'error', message: 'Adicione pelo menos 1 item ao Orçamento.' });
      return;
    }

    try {
      const clientName = getClientDisplayName(activeRegisteredClient);

      const clientDoc = activeRegisteredClient.type === 'PF'
        ? activeRegisteredClient.cpf
        : activeRegisteredClient.cnpj;

      const subtotalVal = subtotalOS;
      const descVal = totalDescontosOS;
      const finalVal = valorFinalOS;

      if (editingOsId) {
        // Cláusula de Não Regressão: Se o documento editado já for uma Ordem de Serviço (ou foi transformado em OS), salva como OS
        const currentDoc = osList.find((o) => o.id === editingOsId);
        const isAlreadyOs = (currentDoc as any)?.tipoDocumento === 'OS' || !(currentDoc as any)?.isOrcamento || osCodigo?.toUpperCase().startsWith('OS');
        if (isAlreadyOs) {
          return handleSaveOs();
        }

        const payload: Partial<OrdemServico> = {
          clienteId: activeRegisteredClient.id,
          clienteNome: clientName,
          clienteCpfCnpj: clientDoc,
          clienteTelefone: activeRegisteredClient.telefone || '',
          clienteEmail: activeRegisteredClient.email || '',
          clienteEndereco: activeRegisteredClient.endereco
            ? `${activeRegisteredClient.endereco.logradouro || ''}, Nº ${activeRegisteredClient.endereco.numero || ''} - ${activeRegisteredClient.endereco.bairro || ''}, ${activeRegisteredClient.endereco.cidade || ''}/${activeRegisteredClient.endereco.estado || ''}`
            : '',
          prazoEntrega,
          fluxoProducao: selectedStages,
          tipoExpedicao,
          itens: osItens,
          anexos,
          observacoes,
          subtotal: subtotalVal,
          desconto: descVal,
          valorFinal: finalVal,
          tipoDocumento: 'ORCAMENTO',
          isOrcamento: true,
          status: 'Orçamento Criado' as any,
          estagioAtual: 'Orçamento' as any,
        };

        if (osCodigo && osCodigo.startsWith('ORC')) {
          payload.codigo = osCodigo;
        }

        const updated = await ApiService.updateOs(editingOsId, payload);
        setCurrentOsForPdv(updated);
        
        await loadData();
        
        setFeedback({
          type: 'success',
          message: `✅ Orçamento "${updated.codigo}" atualizado com sucesso! Armazenado em Pesquisar ORC.`,
        });
      } else {
        const payload = {
          tipoDocumento: 'ORCAMENTO' as const,
          isOrcamento: true,
          codigo: editingOsId ? osCodigo : undefined,
          dataVenda,
          operador: loggedOperator || name || 'VENDEDOR',
          vendedorNome: loggedOperator || name || 'VENDEDOR',
          clienteId: activeRegisteredClient.id,
          clienteNome: clientName,
          clienteCpfCnpj: clientDoc,
          clienteTelefone: activeRegisteredClient.telefone || '',
          clienteEmail: activeRegisteredClient.email || '',
          clienteEndereco: activeRegisteredClient.endereco
            ? `${activeRegisteredClient.endereco.logradouro || ''}, Nº ${activeRegisteredClient.endereco.numero || ''} - ${activeRegisteredClient.endereco.bairro || ''}, ${activeRegisteredClient.endereco.cidade || ''}/${activeRegisteredClient.endereco.estado || ''}`
            : '',
          prazoEntrega,
          fluxoProducao: selectedStages,
          tipoExpedicao,
          estagioAtual: 'Orçamento' as any,
          status: 'Orçamento Criado',
          situacao: 'Orçamento Criado',
          itens: osItens,
          anexos,
          observacoes,
          subtotal: subtotalVal,
          desconto: descVal,
          valorFinal: finalVal,
          formaPagamento: 'Orçamento',
          paymentStatus: 'orcamento',
        };

        const created = await ApiService.createOs(payload as any);
        setCurrentOsForPdv(created);
        
        const updatedList = [created, ...osList.filter((o) => o.id !== created.id)];
        setOsList(updatedList);
        
        // Clear fields and calculate next sequence number based on updated list
        handleNewOs(updatedList);
        
        setFeedback({
          type: 'success',
          message: `✅ Orçamento "${created.codigo}" criado e armazenado em Pesquisar ORC com sucesso!`,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar o Orçamento.' });
    }
  };

  // Open Caixa PDV Modal linked to current OS
  const handleOpenPdv = () => {
    const { role, isDeveloper } = getLoggedUserAndPerfil();
    if (!isRoleAuthorizedForSales(role, isDeveloper)) {
      setFeedback({
        type: 'error',
        message: 'Acesso Restrito: Apenas os cargos autorizados (Developer, CEO, Gerente Geral, Supervisor, Vendedor(a), Recepção) podem efetuar vendas e acessar o Caixa PDV.',
      });
      return;
    }

    const activeRegisteredClient = getRegisteredClient();
    if (!activeRegisteredClient) {
      setFeedback({
        type: 'error',
        message: 'Atenção: É possível que você não tenha autorização direta ao PDV, apenas ao clicar em "Pagar no Caixa PDV" mas para isso você precisa preencher os campos obrigatórios',
      });
      return;
    }

    if (!selectedClient) {
      setSelectedClient(activeRegisteredClient);
    }

    if (osItens.length === 0) {
      setFeedback({ type: 'error', message: 'Adicione itens à OS antes de prosseguir ao Caixa PDV.' });
      return;
    }

    const clientName = getClientDisplayName(activeRegisteredClient);

    const clientDoc = activeRegisteredClient.type === 'PF'
      ? activeRegisteredClient.cpf
      : activeRegisteredClient.cnpj;

    const tempOs: OrdemServico = currentOsForPdv
      ? {
          ...currentOsForPdv,
          clienteNome: clientName,
          clienteCpfCnpj: clientDoc,
          clienteTelefone: activeRegisteredClient.telefone || '',
          clienteEmail: activeRegisteredClient.email || '',
          prazoEntrega: prazoEntrega || currentOsForPdv.prazoEntrega,
          fluxoProducao: selectedStages.length > 0 ? selectedStages : currentOsForPdv.fluxoProducao,
          tipoExpedicao: tipoExpedicao || currentOsForPdv.tipoExpedicao || 'NORMAL',
          itens: osItens.length > 0 ? osItens : currentOsForPdv.itens,
          anexos: anexos.length > 0 ? anexos : currentOsForPdv.anexos,
          observacoes: observacoes || currentOsForPdv.observacoes,
          subtotal: subtotalOS,
          desconto: totalDescontosOS,
          valorFinal: valorFinalOS,
        }
      : {
          id: `TEMP-${Date.now()}`,
          codigo: osCodigo,
          dataVenda,
          operador: loggedOperator || 'VENDEDOR MATRIZ',
          clienteId: activeRegisteredClient.id,
          clienteNome: clientName,
          clienteCpfCnpj: clientDoc,
          clienteTelefone: activeRegisteredClient.telefone || '',
          clienteEmail: activeRegisteredClient.email || '',
          prazoEntrega,
          fluxoProducao: selectedStages,
          tipoExpedicao,
          estagioAtual: selectedStages.includes('Designer') ? 'Designer' : (selectedStages.find(s => s !== 'Sistema') || 'Designer'),
          itens: osItens,
          anexos,
          observacoes,
          subtotal: subtotalOS,
          desconto: totalDescontosOS,
          valorFinal: valorFinalOS,
          paymentStatus: 'pendente',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: loggedOperator || 'VENDEDOR',
          updatedBy: loggedOperator || 'VENDEDOR',
          status: 'ACTIVE',
          version: 1,
        };

    setCurrentOsForPdv(tempOs);
    setShowCaixaPdvModal(true);
  };

  // Request OS / Orçamento Deletion with RBAC Permission Check
  const handleRequestDeleteOs = (os: OrdemServico) => {
    const { role, isDeveloper, name, username } = getLoggedUserAndPerfil();
    const canDelete = canUserPerformAction(role, 'ordemServico', 'excluir', isDeveloper);

    if (!canDelete) {
      const isOrc = (os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento || os.codigo?.startsWith('ORC');
      const rawName = loggedOperator || name || username || '';
      const operatorName = (rawName && rawName !== 'Operador Logado') ? rawName : (username || name || '');
      const operatorDisplay = operatorName && operatorName.toLowerCase() !== role.toLowerCase()
        ? `${operatorName} - ${role}`
        : role;

      setFeedback({
        type: 'error',
        message: `Acesso Negado ${operatorDisplay}: Seu perfil não possui permissão para Excluir ${isOrc ? 'Orçamentos' : 'Ordens de Serviço'}. Acesso restrito a DIREÇÃO.`,
      });
      return;
    }

    previousSearchTermRef.current = searchTermOs;
    setDeleteModalOs(os);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError('');
  };

  // Delete OS / Orçamento with Hierarchical Superior Password Authorization
  const handleConfirmDeleteOs = async () => {
    if (!deleteModalOs) return;
    const trimmed = deletePassword.trim();
    const isOrc = (deleteModalOs as any).tipoDocumento === 'ORCAMENTO' || (deleteModalOs as any).isOrcamento || deleteModalOs.codigo?.startsWith('ORC');
    if (!trimmed) {
      setDeleteError(`A senha de um Superior (Developer, CEO, Gerente Geral, Supervisor) é obrigatória para autorizar a exclusão do ${isOrc ? 'Orçamento' : 'da Ordem de Serviço'}.`);
      return;
    }

    setIsDeletingOs(true);
    setDeleteError('');

    try {
      const { username } = getLoggedUserAndPerfil();

      const verifyRes = await verifySuperiorPassword(trimmed, {
        loggedUsername: username,
        actionDescription: `Exclusão do ${isOrc ? 'Orçamento' : 'Ordem de Serviço'} ${deleteModalOs.codigo}`,
      });

      if (!verifyRes.valid) {
        setDeleteError(
          verifyRes.error ||
            `Senha incorreta ou sem permissão de Superior para autorizar a exclusão deste ${isOrc ? 'Orçamento' : 'OS'}.`
        );
        setIsDeletingOs(false);
        return;
      }

      await ApiService.deleteOs(deleteModalOs.id, trimmed);

      const deletedCode = deleteModalOs.codigo || (isOrc ? 'ORC' : 'OS');
      const wasEditingThisOs = editingOsId === deleteModalOs.id;

      setDeleteModalOs(null);
      setDeletePassword('');
      setShowDeletePassword(false);

      // Garante que o campo de busca seja limpo e restaurado incondicionalmente sem nenhum login de autofill
      setSearchTermOs(previousSearchTermRef.current || '');

      if (wasEditingThisOs) {
        handleNewOs();
      }

      await loadData();
      setFeedback({
        type: 'success',
        message: `🗑️ ${isOrc ? 'Orçamento' : 'Ordem de Serviço'} [${deletedCode}] excluído(a) com sucesso por autorização de ${verifyRes.superiorRole || 'Superior'}!`,
      });
    } catch (err: any) {
      setDeleteError(err.message || 'Senha de acesso incorreta! A exclusão não foi autorizada.');
    } finally {
      setIsDeletingOs(false);
    }
  };

  // Execute Transform Orçamento into OS (either by original creator seller or with superior authorization)
  const executeTransformOrcToOs = async (orc: OrdemServico, superiorAuth: any = null) => {
    setIsTransforming(true);
    setTransformError('');

    try {
      const { username, name: currentUserName, role } = getLoggedUserAndPerfil();
      const currentOp = loggedOperator || currentUserName || 'VENDEDOR';

      let updated: OrdemServico;
      try {
        // Chamada principal para o backend que gera estritamente a sequência oficial de OS
        updated = await ApiService.transformOrcToOs(orc.id, {
          operator: currentOp,
          editorPerfil: role,
          superiorAuth,
        });
      } catch (errApi: any) {
        // Fallback garantindo sempre a sequência oficial de OS e NUNCA a numeração da ORC
        const nextData = await ApiService.getNextOsCode('OS');
        let newOsCode = nextData?.nextCode;
        if (!newOsCode) {
          const currentList = await ApiService.getOrdensServico();
          const osNumbers = currentList
            .filter((os) => (os as any).tipoDocumento !== 'ORCAMENTO' && !(os as any).isOrcamento && !os.codigo?.startsWith('ORC'))
            .map((os) => {
              const match = os.codigo?.match(/\d+/);
              return match ? parseInt(match[0], 10) : 0;
            });
          const maxNum = osNumbers.length > 0 ? Math.max(...osNumbers) : 0;
          newOsCode = `OS${String(maxNum + 1).padStart(8, '0')}`;
        }

        const now = new Date();
        const nowISO = now.toISOString();
        const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        
        const superiorRole = superiorAuth?.superiorRole || 'Superior';
        const superiorUser = superiorAuth?.superiorName || 'Direção/Supervisão';
        const authSuffix = superiorAuth
          ? `com autorização de Superior (${superiorRole}: ${superiorUser})`
          : `pelo operador (${currentOp})`;

        const transformHistoryEntry = createOsHistoryEntry(
          'transformou Orçamento em Ordem de Serviço',
          `Transformou o Orçamento ${orc.codigo} na Ordem de Serviço ${newOsCode} ${authSuffix}. Sequência oficial de numeração de OS rigorosamente aplicada.`
        );

        const existingHistory = orc.historicoEdicoes || [];
        const updatedHistory = [transformHistoryEntry, ...existingHistory];

        const setorAceitoPorUpdates = [...(orc.setorAceitoPor || [])];
        setorAceitoPorUpdates.push({
          estagio: 'Sistema',
          descricaoEtapa: 'Transformação de Orçamento em OS',
          funcionario: currentOp,
          aceitoEm: dataHoraStr,
          aceitoEmISO: nowISO,
          status: 'Concluído',
          concluidoEm: dataHoraStr,
          concluidoEmISO: nowISO,
          observacao: `Orçamento ${orc.codigo} transformado na Ordem de Serviço ${newOsCode} ${authSuffix}.`
        });

        const orcFluxo = orc.fluxoProducao || [];
        const firstProdStage = orcFluxo.includes('Designer') ? 'Designer' : (orcFluxo.find((s: string) => s !== 'Sistema') || 'Designer');

        const payload: Partial<OrdemServico> = {
          codigo: newOsCode,
          tipoDocumento: 'OS',
          isOrcamento: false,
          status: 'Aberta',
          situacao: 'Aberta',
          estagioAtual: firstProdStage as any,
          paymentStatus: 'pendente',
          formaPagamento: orc.formaPagamento === 'Orçamento' ? 'PIX' : (orc.formaPagamento || 'PIX'),
          historicoEdicoes: updatedHistory,
          setorAceitoPor: setorAceitoPorUpdates,
          updatedBy: currentOp,
          updatedAt: nowISO,
        };

        updated = await ApiService.updateOs(orc.id, payload);
      }

      setTransformModalOrc(null);
      setTransformPassword('');
      setShowTransformPassword(false);

      // Notificar transição de menu para Ordem de Serviço caso esteja no módulo de Orçamento
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('navigate-menu', {
            detail: {
              menuId: 'ordem-servico',
              menuLabel: 'Ordem de Serviço',
              osToEdit: updated,
            },
          })
        );
      }

      // Load newly generated OS into active editor
      handleLoadOsToEdit(updated);
      setActiveView('NEW_OS');

      await loadData();
      NotificationService.notifyOsCreated(updated, currentUserName || 'Operador', 'Designer');

      setFeedback({
        type: 'success',
        message: `✅ Orçamento "${orc.codigo}" transformado com sucesso na Ordem de Serviço "${updated.codigo}"! Código sequencial oficial de OS aplicado rigorosamente.`,
      });
    } catch (err: any) {
      setTransformError(err.message || 'Erro ao transformar Orçamento em Ordem de Serviço.');
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao transformar Orçamento em Ordem de Serviço.',
      });
    } finally {
      setIsTransforming(false);
    }
  };

  // Request Transform Orçamento into OS
  const handleRequestGenerateOs = (orc: OrdemServico, forceContinue: boolean = false) => {
    const { role, isDeveloper, name: currentUserName, username } = getLoggedUserAndPerfil();
    if (!isRoleAuthorizedForSales(role, isDeveloper)) {
      setFeedback({
        type: 'error',
        message: 'Acesso Restrito: Apenas cargos autorizados podem transformar Orçamentos em Ordens de Serviço.',
      });
      return;
    }

    if (!forceContinue) {
      const client = clients.find(c => c.id === orc.clienteId || (c.cpf && c.cpf.replace(/\D/g, '') === orc.clienteCpfCnpj?.replace(/\D/g, '')) || (c.cnpj && c.cnpj.replace(/\D/g, '') === orc.clienteCpfCnpj?.replace(/\D/g, '')) || (c.nome && orc.clienteNome?.toLowerCase().includes(c.nome.toLowerCase())));
      
      if (client) {
         const existingPendingOs = findPendingOsForClient(client, orc.id);
         if (existingPendingOs) {
            setPendingOsPrompt({ client, pendingOs: existingPendingOs, action: 'TRANSFORM_ORC', orcToTransform: orc });
            return;
         }
      } else if (orc.clienteNome) {
         const existingPendingOs = findPendingOsForClient({ id: orc.clienteId, nome: orc.clienteNome, type: 'PF' } as Client, orc.id);
         if (existingPendingOs) {
            setPendingOsPrompt({ client: { id: orc.clienteId, nome: orc.clienteNome, type: 'PF' } as Client, pendingOs: existingPendingOs, action: 'TRANSFORM_ORC', orcToTransform: orc });
            return;
         }
      }
    }

    // Regra: O acesso aos orçamentos é livre entre os vendedores e recepção (eles podem visualizar qualquer ORC),
    // mas SÓ o vendedor responsável pela criação da ORC poderá convertê-la/transformá-la em OS diretamente.
    // Se outro perfil tentar gerar uma OS pelo orçamento já criado, solicita a senha da diretoria ou supervisão.
    const isCreator = isUserCreatorOfOrc(orc, currentUserName, loggedOperator, username);

    if (isCreator) {
      // Vendedor criador original: converte diretamente sem exigir senha superior
      executeTransformOrcToOs(orc, null);
      return;
    }

    // Outro perfil: abre o modal solicitando a senha da diretoria ou supervisão
    setTransformModalOrc(orc);
    setTransformPassword('');
    setShowTransformPassword(false);
    setTransformError('');
  };

  // Confirm Transform Orçamento into OS with Hierarchical Superior Password Authorization (for non-creators)
  const handleConfirmGenerateOs = async () => {
    if (!transformModalOrc) return;
    const trimmed = transformPassword.trim();
    if (!trimmed) {
      setTransformError('A senha da Diretoria ou Supervisão é obrigatória para autorizar a conversão deste Orçamento em OS.');
      return;
    }

    setIsTransforming(true);
    setTransformError('');

    try {
      const { username } = getLoggedUserAndPerfil();

      const verifyRes = await verifySuperiorPassword(trimmed, {
        loggedUsername: username,
        actionDescription: `Transformação do Orçamento ${transformModalOrc.codigo} em Ordem de Serviço`,
      });

      if (!verifyRes.valid) {
        setTransformError(
          verifyRes.error ||
            'Senha incorreta ou sem permissão de Superior para autorizar a transformação deste Orçamento em OS.'
        );
        setIsTransforming(false);
        return;
      }

      await executeTransformOrcToOs(transformModalOrc, verifyRes);
    } catch (err: any) {
      setTransformError(err.message || 'Erro ao transformar Orçamento em Ordem de Serviço.');
      setIsTransforming(false);
    }
  };

  // Pre-indexed clients for sub-millisecond search across 12,000+ records
  const indexedClients = useMemo(() => {
    return buildClientSearchIndex(clients);
  }, [clients]);

  // Filter autocomplete clients (capped to 25 items for instant rendering)
  const filteredClients = useMemo(() => {
    if (!clientSearchText.trim()) return [];
    return fastFilterClients(indexedClients, clientSearchText)
      .slice(0, 25)
      .map((i) => i.client);
  }, [indexedClients, clientSearchText]);

  // Filter catalog products available for OS (strictly products marked as Produto para Venda)
  const filteredProducts = productCatalog.filter((p) => {
    if (p.paraVenda === false || (p as any).apenasEstoqueInterno === true) return false;
    const isInternalCategory = p.categoria && (
      p.categoria.toLowerCase().includes('apenas estoque interno') ||
      p.categoria.toLowerCase() === 'estoque interno'
    );
    if (isInternalCategory && p.paraVenda !== true) return false;

    const matchesCat =
      !itemCategoria ||
      itemCategoria === 'ALL' ||
      itemCategoria.trim().toLowerCase() === 'geral' ||
      (p.categoria && p.categoria.toLowerCase() === itemCategoria.toLowerCase());

    const query = itemDescricao.toLowerCase().trim();
    const matchesDesc =
      !query ||
      p.descricao.toLowerCase().includes(query) ||
      (p.sku && p.sku.toLowerCase().includes(query)) ||
      (p.codigo && p.codigo.toLowerCase().includes(query)) ||
      (p.referencia && p.referencia.toLowerCase().includes(query)) ||
      (p.codigoBarras && p.codigoBarras.toLowerCase().includes(query));

    return matchesCat && matchesDesc;
  });

  return (
    <div className="w-full space-y-3">
      {/* HEADER BAR WITH TWO MAIN TOP BUTTONS AND OS/ORC HEADER DETAILS */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-semibold rounded-md tracking-wider">
            <span>
              {isShopeeMode
                ? 'Ordem de Serviço Shopee'
                : isOrcamentoMode
                ? 'Orçamento / Pré-Venda'
                : 'Ordem de Serviço / Caixa PDV'}
            </span>
            <span className="text-slate-400">•</span>
            <span>
              {isShopeeMode
                ? 'Vendas Shopee & Produção Integrada'
                : isOrcamentoMode
                ? 'Cotações & Pré-Vendas'
                : 'Vendas & Produção Integrada'}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-1">
            {isShopeeMode
              ? 'Gestão Integrada de Ordem de Serviço Shopee'
              : isOrcamentoMode
              ? 'Gestão de Orçamentos'
              : 'Gestão Integrada de Ordem de Serviço'}
          </h1>
          <p className="hidden lg:block text-[11px] text-slate-500 font-medium mt-0.5">
            {isShopeeMode
              ? 'Atalhos: [F2] Nova OSS | [F3] Pesquisar OSS | [F10] Registrar Pagamento'
              : isOrcamentoMode
              ? 'Atalhos: [F2] Novo ORC | [F3] Pesquisar ORC | [F4] Novo Cliente | [F10] Criar Orçamento'
              : 'Atalhos: [F2] Nova OS | [F3] Pesquisar OS | [F4] Novo Cliente | [F10] Caixa PDV'}
          </p>
        </div>

        {/* TOP BUTTONS & HEADER RIGHT BOX */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* BUTTON 1: "NOVA OS" / "NOVA OSS" / "NOVO ORC" */}
          <button
            type="button"
            onClick={handleNewOs}
            className={`flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
              activeView === 'NEW_OS'
                ? 'bg-white border-blue-600 text-blue-700 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>
              {isShopeeMode ? 'NOVA OSS' : isOrcamentoMode ? 'NOVO ORC' : 'NOVA OS'}
              <span className="hidden lg:inline"> (F2)</span>
            </span>
          </button>

          {/* BUTTON 2: "PESQUISAR OS" / "PESQUISAR OSS" / "PESQUISAR ORC" */}
          <button
            type="button"
            onClick={() => setActiveView('SEARCH_OS')}
            className={`flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
              activeView === 'SEARCH_OS'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <Search className="w-4 h-4 text-blue-600" />
            <span>
              {isShopeeMode ? 'PESQUISAR OSS' : isOrcamentoMode ? 'PESQUISAR ORC' : 'PESQUISAR OS'}
              <span className="hidden lg:inline"> (F3)</span>
            </span>
          </button>

          {/* BUTTON 3: "ORÇAMENTOS" (IN OS MODE, PLACED BESIDE "PESQUISAR OS") */}
          {!isOrcamentoMode && !isShopeeMode && (
            <button
              type="button"
              onClick={() => setActiveView('ORCAMENTOS')}
              className={`flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                activeView === 'ORCAMENTOS'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white hover:bg-amber-50/70 text-slate-700 hover:text-amber-800 border-slate-200 shadow-xs'
              }`}
              title="Abrir módulo com todos os Orçamentos criados"
            >
              <FileText className={`w-4 h-4 ${activeView === 'ORCAMENTOS' ? 'text-white' : 'text-amber-600'}`} />
              <span>ORÇAMENTOS</span>
              {osList.filter((o) => (o as any).tipoDocumento === 'ORCAMENTO' || (o as any).isOrcamento || o.codigo?.startsWith('ORC')).length > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  activeView === 'ORCAMENTOS' ? 'bg-amber-800 text-amber-100' : 'bg-amber-100 text-amber-800'
                }`}>
                  {osList.filter((o) => (o as any).tipoDocumento === 'ORCAMENTO' || (o as any).isOrcamento || o.codigo?.startsWith('ORC')).length}
                </span>
              )}
            </button>
          )}

          {/* HEADER RIGHT BOX: OS/ORC/OSS NUMBER, DATE, SITUAÇÃO - DISCREET & MINIMALIST */}
          <div className="bg-slate-50/90 text-slate-800 p-2 px-3.5 rounded-xl border border-slate-200/90 flex items-center gap-3.5 text-xs shrink-0 shadow-2xs">
            <div>
              <span className="block text-[9px] uppercase text-blue-600 font-bold tracking-wide">
                {isShopeeMode ? 'Número da OSS' : isOrcamentoMode ? 'Número do ORC' : 'Número da OS'}
              </span>
              <strong className="text-sm font-extrabold text-slate-900">{osCodigo}</strong>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <div>
              <span className="block text-[9px] uppercase text-blue-600 font-bold tracking-wide">Data Emissão</span>
              <span className="text-xs font-bold text-slate-900">{formatDateBR(dataVenda)}</span>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <div>
              <span className="block text-[9px] uppercase text-blue-600 font-bold tracking-wide">Situação</span>
              <span className="text-xs font-extrabold text-blue-700">{osSituacao}</span>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING DISCREET FEEDBACK TOAST (Auto-dismisses in 3 seconds) */}
      {feedback.message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 max-w-md animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto shadow-xl"
        >
          <div
            className={`p-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 border backdrop-blur-md transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-50/95 text-emerald-950 border-emerald-300 shadow-emerald-900/10'
                : 'bg-rose-50/95 text-rose-950 border-rose-300 shadow-rose-900/10'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-xs sm:text-sm leading-snug break-words">{feedback.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback({ type: null, message: '' })}
              className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-black/5 transition shrink-0 ml-1"
              title="Fechar notificação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: OS CREATION / EDITING FORM */}
      {activeView === 'NEW_OS' && (
        <div className="space-y-3">
          {/* BLOCK 1: DADOS DO CLIENTE & PRAZO DE ENTREGA & KANBAN FLUXO DE PRODUÇÃO */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs space-y-2.5">
            {isShopeeMode ? (
              /* MODO SHOPEE: NO LUGAR DE "DADOS DO CLIENTE & PRAZO DE ENTREGA" -> "ID DO PEDIDO" */
              <>
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-blue-600" />
                    <span>ID DO PEDIDO</span>
                  </h2>

                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/90 rounded-xl text-xs font-black flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                    <span>Shopee Marketplace</span>
                  </span>
                </div>

                {/* ID DO PEDIDO SHOPEE ROW */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
                  <div className="md:col-span-8 relative">
                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                      ID do Pedido Shopee <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={shopeeIdPedido}
                        onChange={(e) => setShopeeIdPedido(e.target.value)}
                        placeholder="Digite ou cole o ID do Pedido Shopee (Ex: 240501ABC123)..."
                        className="w-full pl-8 pr-3.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none shadow-2xs"
                      />
                      <Hash className="w-4 h-4 text-blue-600 absolute left-2.5 top-2" />
                    </div>
                  </div>

                  <div className="md:col-span-4 relative">
                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                      Nome do Comprador (Opcional)
                    </label>
                    <input
                      type="text"
                      value={shopeeCompradorNome}
                      onChange={(e) => setShopeeCompradorNome(e.target.value)}
                      placeholder="Nome do cliente na Shopee..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none shadow-2xs"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* MODO PADRÃO: DADOS DO CLIENTE & PRAZO DE ENTREGA */
              <>
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>DADOS DO CLIENTE & PRAZO DE ENTREGA</span>
                  </h2>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingClient(null);
                      setShowFullClientModal(true);
                    }}
                    className="px-3 py-1 bg-blue-50/80 hover:bg-blue-100 text-blue-600 border border-blue-200/90 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Novo Cliente<span className="hidden lg:inline"> (F4)</span></span>
                  </button>
                </div>

            {/* CLIENT SEARCH & DELIVERY DATE ROW */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
              {/* CLIENT INTELLIGENT SEARCH INPUT (8 COLS) */}
              <div className="md:col-span-8 relative">
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                  Buscar Cliente por CPF/CNPJ, Nome ou Razão Social <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={selectedClient ? getClientDisplayName(selectedClient) : clientSearchText}
                    onChange={(e) => {
                      setSelectedClient(null);
                      setClientSearchText(e.target.value);
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={() => {
                      // Slight delay to allow clicking on dropdown items
                      setTimeout(() => {
                        if (!selectedClient && clientSearchText.trim()) {
                          const resolved = getRegisteredClient();
                          if (resolved) {
                            handleSelectClient(resolved);
                          }
                        }
                      }, 200);
                    }}
                    placeholder="Digite ex: 'emp' para buscar automaticamente..."
                    className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none shadow-2xs"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
                  {selectedClient && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClient(null);
                        setClientSearchText('');
                      }}
                      className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* INTELLIGENT CLIENT AUTOCOMPLETE DROPDOWN */}
                {showClientDropdown && clientSearchText.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-30 max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {filteredClients.length === 0 ? (
                      <div className="p-2.5 text-xs text-slate-400 text-center">
                        Nenhum cliente encontrado.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setShowClientDropdown(false);
                            setEditingClient(null);
                            setShowFullClientModal(true);
                          }}
                          className="text-blue-600 font-bold underline cursor-pointer"
                        >
                          Cadastrar novo cliente<span className="hidden lg:inline"> (F4)</span>
                        </button>
                      </div>
                    ) : (
                      filteredClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => handleSelectClient(client)}
                          className="w-full text-left p-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <p className="text-xs font-black text-slate-900">
                              {getClientDisplayName(client)}
                            </p>
                            <p className="text-[10px] text-slate-500 font-semibold">
                              Doc: {client.type === 'PF' ? client.cpf : client.cnpj} • Fone: {client.telefone}
                            </p>
                          </div>
                          <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                            {client.codigo}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* VERIFICATION CARD: DADOS DO CLIENTE ENCONTRADO */}
                {selectedClient && (
                  <div className="mt-2 bg-blue-50/80 border border-blue-200 rounded-xl p-2 space-y-1">
                    <div className="flex items-center justify-between border-b border-blue-200/80 pb-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded">
                          {selectedClient.codigo}
                        </span>
                        <h4 className="text-xs font-black text-blue-950 uppercase tracking-wide">
                          {getClientDisplayName(selectedClient)}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClient(null);
                          setClientSearchText('');
                        }}
                        className="text-[10px] text-slate-600 hover:text-slate-900 font-extrabold flex items-center gap-1 cursor-pointer bg-slate-200/80 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition-all"
                      >
                        <X className="w-3 h-3" />
                        <span>Trocar</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-semibold text-slate-800">
                      <div>
                        <span className="block text-[9px] uppercase text-slate-500 font-black">CPF/CNPJ</span>
                        <span>{selectedClient.type === 'PF' ? selectedClient.cpf : selectedClient.cnpj || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase text-slate-500 font-black">Telefone</span>
                        <span className="text-emerald-700 font-bold">{selectedClient.telefone || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase text-slate-500 font-black">E-mail</span>
                        <span className="truncate block">{selectedClient.email || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase text-slate-500 font-black">Cidade/UF</span>
                        <span>{selectedClient.endereco ? `${selectedClient.endereco.cidade}/${selectedClient.endereco.estado}` : '—'}</span>
                      </div>
                    </div>

                    {/* ENDEREÇO COMPLETO DO CLIENTE */}
                    <div className="pt-1 border-t border-blue-200/80 text-[11px] font-medium text-slate-800 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[9px] uppercase text-slate-500 font-black mr-1">Endereço Completo:</span>
                        <span className="font-bold text-slate-900">
                          {selectedClient.endereco ? (
                            `${selectedClient.endereco.logradouro || ''}${selectedClient.endereco.numero ? `, Nº ${selectedClient.endereco.numero}` : ''}${selectedClient.endereco.complemento ? ` (${selectedClient.endereco.complemento})` : ''}${selectedClient.endereco.bairro ? ` - Bairro ${selectedClient.endereco.bairro}` : ''}${selectedClient.endereco.cidade ? `, ${selectedClient.endereco.cidade}` : ''}${selectedClient.endereco.estado ? `/${selectedClient.endereco.estado}` : ''}${selectedClient.endereco.cep ? ` - CEP: ${selectedClient.endereco.cep}` : ''}`
                          ) : (
                            'Endereço não informado'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PRAZO DE ENTREGA WITH CALENDAR & VALIDATION (4 COLS) */}
              <div className="md:col-span-4">
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                  Prazo de Entrega Prometido <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={prazoEntrega}
                    onChange={(e) => setPrazoEntrega(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none shadow-2xs"
                  />
                  <Calendar className="w-4 h-4 text-blue-600 absolute left-2.5 top-2" />
                </div>
              </div>
            </div>
          </>
        )}

            {/* FLUXO DE PRODUÇÃO KANBAN (PROGRESS BAR COM 8 ESTÁGIOS OFICIAIS) */}
            {!isOrcamentoMode && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>FLUXO DE PRODUÇÃO KANBAN</span>
                  </span>
                </div>

                {/* HORIZONTAL STAGES PROGRESS BAR WITH DYNAMIC SEQUENTIAL ORDER - BORDER TOTALMENTE VISÍVEL E SEM FUNDO */}
                <div className="flex items-center gap-2 overflow-x-auto py-2.5 px-1 scrollbar-none flex-nowrap">
                  {PRODUCTION_STAGES_ALL.map((stage) => {
                    const isSelected = selectedStages.includes(stage);
                    const isDesigner = stage === 'Designer';
                    const isDestination = ['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)'].includes(stage as string);
                    const stageIndex = selectedStages.indexOf(stage);

                    // Stage visual themes (Apenas fonte e borda com cor, fundo transparente)
                    let activeStyles = 'border-2 border-blue-600 text-blue-700';
                    let StageIcon = Layers;

                    if (stage === 'Designer') {
                      activeStyles = 'border-2 border-purple-600 text-purple-700';
                      StageIcon = Palette;
                    } else if (stage === 'Impressão') {
                      activeStyles = 'border-2 border-blue-600 text-blue-700';
                      StageIcon = Printer;
                    } else if (stage === 'Calandra') {
                      activeStyles = 'border-2 border-amber-500 text-amber-800';
                      StageIcon = Flame;
                    } else if (stage === 'Costura') {
                      activeStyles = 'border-2 border-rose-600 text-rose-700';
                      StageIcon = Scissors;
                    } else if (stage === 'EXCURSÃO') {
                      activeStyles = 'border-2 border-red-600 text-red-700';
                      StageIcon = Truck;
                    } else if (stage === 'CORREIOS') {
                      activeStyles = 'border-2 border-amber-600 text-amber-800';
                      StageIcon = Mail;
                    } else if (stage === 'SHOPEE') {
                      activeStyles = 'border-2 border-orange-600 text-orange-700';
                      StageIcon = ShoppingBag;
                    } else if (stage === 'RETIRADA(Recepção)') {
                      activeStyles = 'border-2 border-emerald-600 text-emerald-800';
                      StageIcon = Store;
                    }

                    return (
                      <React.Fragment key={stage}>
                        <button
                          type="button"
                          onClick={() => toggleStage(stage)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 shrink-0 bg-transparent cursor-pointer active:scale-95 ${
                            isSelected
                              ? `${activeStyles} hover:opacity-85`
                              : 'border-2 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                          }`}
                          title={
                            isDesigner
                              ? isSelected
                                ? 'Designer no fluxo. Clique para desmarcar.'
                                : 'Designer desmarcado. Clique para incluir.'
                              : isDestination
                              ? `Destino de Expedição: ${stage}. Clique para definir como destino final desta OS.`
                              : `${stage}: Etapa de Fabricação. Clique para alternar.`
                          }
                        >
                          <StageIcon className="w-3.5 h-3.5 shrink-0 text-current" />
                          {isSelected ? (
                            <span className="w-4 h-4 rounded-full border border-current text-current flex items-center justify-center text-[9px] font-black bg-transparent">
                              {stageIndex + 1}
                            </span>
                          ) : (
                            <span className="w-4 h-4 rounded-full border border-slate-300 text-slate-400 flex items-center justify-center text-[9px] font-bold bg-transparent">
                              +
                            </span>
                          )}
                          <span className="text-current">{stage}</span>
                          {isSelected && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-current shrink-0" />
                          )}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* CAIXA SELECIONÁVEL DE EXPEDIÇÃO: NORMAL, EXPRESSO EXCURSÃO, EXPRESSO DO DIA */}
                <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-black text-slate-900 uppercase block leading-none">
                        Expedição / Modalidade de Envio:
                      </span>
                      <span className="text-[9.5px] text-slate-500 font-semibold">
                        Defina a prioridade e rota para conferência e expedição
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'NORMAL', label: 'NORMAL', color: 'blue', desc: 'Fluxo Padrão (Azul)' },
                        { id: 'EXPRESSO EXCURSÃO', label: 'EXPRESSO EXCURSÃO', color: 'red', desc: 'Urgência Excursão (Vermelho)' },
                        { id: 'EXPRESSO DO DIA', label: 'EXPRESSO DO DIA', color: 'orange', desc: 'Entrega no Dia (Laranja #FFA500)' },
                      ] as const
                    ).map((opt) => {
                      const isCurrent = tipoExpedicao === opt.id;
                      let btnClass = '';
                      if (opt.id === 'EXPRESSO EXCURSÃO') {
                        btnClass = isCurrent
                          ? 'bg-white text-red-700 border-2 border-red-600 font-bold shadow-sm'
                          : 'bg-white hover:bg-red-50 text-red-700 border border-red-200';
                      } else if (opt.id === 'EXPRESSO DO DIA') {
                        btnClass = isCurrent
                          ? 'bg-white text-orange-600 border-2 border-orange-500 font-bold shadow-sm'
                          : 'bg-white hover:bg-orange-50 text-orange-600 border border-orange-200';
                      } else {
                        btnClass = isCurrent
                          ? 'bg-white text-blue-700 border-2 border-blue-600 font-bold shadow-sm'
                          : 'bg-white hover:bg-blue-50 text-blue-700 border border-blue-200';
                      }

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setTipoExpedicao(opt.id);
                            if (opt.id === 'EXPRESSO EXCURSÃO') {
                              setSelectedStages((prev) => [
                                ...prev.filter((s) => !['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)'].includes(s as string)),
                                'EXCURSÃO',
                              ]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${btnClass}`}
                          title={opt.desc}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              opt.id === 'EXPRESSO EXCURSÃO'
                                ? 'bg-red-500'
                                : opt.id === 'EXPRESSO DO DIA'
                                ? 'bg-[#FFA500]'
                                : 'bg-blue-500'
                            } ${isCurrent ? 'ring-2 ring-white animate-pulse' : ''}`}
                          />
                          <span>{opt.label}</span>
                          {isCurrent && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SEQUÊNCIA ATIVA DO FLUXO DEFINIDO - APENAS FONTE E BORDA COM COR, SEM FUNDO */}
                {selectedStages.length > 0 && (
                  <div className="p-2.5 bg-slate-50/70 border border-slate-200 rounded-xl flex items-center gap-1.5 overflow-x-auto py-2.5 px-2 text-[11px] font-bold">
                    <span className="text-[10px] uppercase font-black text-slate-700 shrink-0 mr-1 flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-slate-600" />
                      Sequência do Fluxo:
                    </span>
                    {selectedStages.map((stg, sIdx) => {
                      let badgeClass = 'bg-transparent border-2 border-slate-300 text-slate-700';
                      if (stg === 'Designer') badgeClass = 'bg-transparent border-2 border-purple-600 text-purple-700';
                      else if (stg === 'Impressão') badgeClass = 'bg-transparent border-2 border-blue-600 text-blue-700';
                      else if (stg === 'Calandra') badgeClass = 'bg-transparent border-2 border-amber-500 text-amber-800';
                      else if (stg === 'Costura') badgeClass = 'bg-transparent border-2 border-rose-600 text-rose-700';
                      else if (stg === 'EXCURSÃO') badgeClass = 'bg-transparent border-2 border-red-600 text-red-700 font-black';
                      else if (stg === 'CORREIOS') badgeClass = 'bg-transparent border-2 border-amber-600 text-amber-800 font-black';
                      else if (stg === 'SHOPEE') badgeClass = 'bg-transparent border-2 border-orange-600 text-orange-700 font-black';
                      else if (stg === 'RETIRADA(Recepção)') badgeClass = 'bg-transparent border-2 border-emerald-600 text-emerald-800 font-black';

                      return (
                        <React.Fragment key={stg}>
                          <span className={`px-2.5 py-0.5 rounded-lg shrink-0 font-extrabold flex items-center gap-1.5 ${badgeClass}`}>
                            <span className="text-[10px] font-black opacity-80">#{sIdx + 1}</span>
                            <span>{stg}</span>
                          </span>
                          {sIdx < selectedStages.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BLOCK 2: INCLUSÃO DE PRODUTOS / SERVIÇOS */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <span>INCLUSÃO DE PRODUTOS / SERVIÇOS</span>
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {isProductUnregistered && (
                  <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                    <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                    <span>produto não cadastrado</span>
                  </span>
                )}
                <label
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer border select-none ${
                    precoExpressoActive
                      ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                      : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  }`}
                  title="Calcular este item pelo Preço Expresso determinado no Cadastro de Estoque"
                >
                  <input
                    type="checkbox"
                    checked={precoExpressoActive}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setPrecoExpressoActive(checked);
                      if (matchingCatalogProduct) {
                        const expressPrice = matchingCatalogProduct.precoExpresso !== undefined && Number(matchingCatalogProduct.precoExpresso) > 0
                          ? Number(matchingCatalogProduct.precoExpresso)
                          : undefined;
                        const standardPrice = matchingCatalogProduct.valorUnitario !== undefined && Number(matchingCatalogProduct.valorUnitario) > 0
                          ? Number(matchingCatalogProduct.valorUnitario)
                          : (matchingCatalogProduct.precoVenda || 0);
                        if (checked && expressPrice !== undefined) {
                          setItemValorUnitario(expressPrice);
                        } else if (!checked && standardPrice > 0) {
                          setItemValorUnitario(standardPrice);
                        }
                      }
                    }}
                    className="w-3.5 h-3.5 text-amber-600 border-amber-400 rounded focus:ring-amber-500 cursor-pointer accent-amber-600"
                  />
                  <span>⚡</span>
                  <span>PREÇO EXPRESSO</span>
                </label>
                {comMedidas && !isAreaPadrao && !isBabadoTable && !isCilindroTable && !isCuboTable && (
                  <label
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer border select-none ${
                      comSobreposicao
                        ? 'bg-red-600 text-white border-red-700 shadow-2xs ring-2 ring-red-300'
                        : 'bg-red-500 text-white border-red-600 hover:bg-red-600'
                    }`}
                    title="Calcular este item com acréscimo de caimento no tampo (sobreposição)"
                  >
                    <input
                      type="checkbox"
                      checked={comSobreposicao}
                      onChange={(e) => setComSobreposicao(e.target.checked)}
                      className="w-3.5 h-3.5 text-red-600 border-red-300 rounded focus:ring-red-500 cursor-pointer accent-white"
                    />
                    <span className="text-white">Com Sobreposição</span>
                  </label>
                )}
              </div>
            </div>

            {/* PRODUCT INPUT FIELDS - EXACT ORDER AND STYLING FROM REFERENCE IMAGE */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              {/* 1. CATEGORIA */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-blue-900 mb-0.5">
                  Categoria
                </label>
                <div className="relative">
                  <select
                    value={itemCategoria && itemCategoria.trim().toLowerCase() === 'geral' ? 'ALL' : itemCategoria}
                    onChange={(e) => {
                      const selectedCat = e.target.value;
                      setItemCategoria(selectedCat);
                      setShowProductDropdown(false);
                      if (selectedCat !== 'ALL') {
                        const catNorm = normalizeStr(selectedCat);
                        const catProducts = productCatalog.filter(
                          (p) => normalizeStr(p.categoria) === catNorm
                        );
                        const hasMedidas = catProducts.some((p) => Boolean(p.comMedidas) || p.unidade === 'M2') ||
                          /medida|mesa|toalha|saia|painel|m2|cortina|tecido|lona|banner/i.test(selectedCat);
                        if (hasMedidas) {
                          setComMedidas(true);
                          setItemUnidade('M2');
                          setMedidaFrente('');
                          setMedidaLateral('');
                          setMedidaAltura('');
                          setMedidaCaimento('');
                          setMedidaBabado('');
                          setComSobreposicao(false);
                        }
                        const firstWithPrice = catProducts.find((p) => (p.valorUnitario || 0) > 0);
                        if (catProducts.length === 1 && !itemDescricao.trim()) {
                          setItemDescricao(catProducts[0].descricao);
                          setItemValorUnitario(catProducts[0].valorUnitario || 0);
                          setItemPrecoMedio(catProducts[0].precoMedio || 0);
                        } else if (firstWithPrice && (itemValorUnitario === 0 || !itemDescricao.trim())) {
                          setItemValorUnitario(firstWithPrice.valorUnitario || 0);
                          if (firstWithPrice.precoMedio) {
                            setItemPrecoMedio(firstWithPrice.precoMedio);
                          }
                        }
                      }
                      if (descricaoInputRef.current) {
                        descricaoInputRef.current.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOrUpdateProduct();
                      }
                    }}
                    className="w-full appearance-none pl-2.5 pr-6 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-bold text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none truncate cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">Todas as Categorias</option>
                    {categories
                      .filter((cat) => cat && cat.trim().toLowerCase() !== 'geral')
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-blue-500 absolute right-2 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* 2. DESCRIÇÃO DO PRODUTO */}
              <div className="sm:col-span-5 relative" ref={dropdownContainerRef}>
                <label className="block text-[10px] font-bold text-blue-900 mb-0.5">
                  Descrição do Produto <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={descricaoInputRef}
                    type="text"
                    value={itemDescricao}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItemDescricao(val);
                      setShowProductDropdown(val.trim().length > 0);
                      if (val.trim()) {
                        const valNorm = normalizeStr(val);
                        const matched = productCatalog.find((p) => {
                          return (
                            normalizeStr(p.descricao) === valNorm ||
                            normalizeStr(p.codigo) === valNorm ||
                            normalizeStr(p.sku) === valNorm ||
                            normalizeStr(p.referencia) === valNorm ||
                            normalizeStr(p.codigoBarras) === valNorm ||
                            (valNorm.length >= 3 && normalizeStr(p.descricao).includes(valNorm))
                          );
                        });
                        const hasMedidas = Boolean(matched?.comMedidas) || 
                          matched?.unidade === 'M2' || 
                          /medida|mesa|toalha|saia|painel|m2/i.test(val) ||
                          (matched?.categoria && /medida|mesa|toalha|saia|painel|m2/i.test(matched.categoria));
                        if (hasMedidas) {
                          setComMedidas(true);
                          setItemUnidade('M2');
                        }
                        if (matched) {
                          const salePrice = (matched.precoVenda !== undefined && Number(matched.precoVenda) > 0)
                            ? Number(matched.precoVenda)
                            : (Number(matched.valorUnitario) || 0);
                          if (salePrice > 0) {
                            setItemValorUnitario(salePrice);
                          }
                          if (matched.precoMedio !== undefined && matched.precoMedio > 0) {
                            setItemPrecoMedio(matched.precoMedio);
                          }
                        }
                      }
                    }}
                    onClick={() => {
                      if (itemDescricao.trim().length > 0) {
                        setShowProductDropdown(true);
                      }
                    }}
                    onFocus={() => {
                      if (itemDescricao.trim().length > 0) {
                        setShowProductDropdown(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOrUpdateProduct();
                      } else if (e.key === 'Escape') {
                        setShowProductDropdown(false);
                      }
                    }}
                    placeholder="Digite para buscar produtos nesta categoria..."
                    className={`w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-bold text-blue-900 focus:outline-none shadow-2xs ${
                      isProductUnregistered
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                        : 'border-blue-500 focus:ring-2 focus:ring-blue-600'
                    }`}
                  />

                  {/* INTELLIGENT PRODUCT DROPDOWN FROM ESTOQUE */}
                  {showProductDropdown && itemDescricao.trim().length > 0 && filteredProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-blue-500 rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {filteredProducts.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleSelectCatalogProduct(prod)}
                          className="w-full text-left p-2.5 hover:bg-blue-50 text-xs font-bold text-blue-900 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div className="flex flex-col pr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{prod.descricao}</span>
                              {prod.comMedidas && (
                                <span className="text-orange-500 text-[10px] font-black uppercase">
                                  Com Medidas
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-blue-600 font-semibold">
                              {prod.categoria && prod.categoria.trim().toLowerCase() !== 'geral' ? `Cat: ${prod.categoria} • ` : ''}UN: {prod.unidade || (prod.comMedidas ? 'M2' : 'UN')} • Cód: {prod.codigo}
                            </span>
                          </div>
                          <span className="text-blue-600 font-black shrink-0">
                            R$ {(prod.valorUnitario || 0).toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. UN */}
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-blue-900 mb-0.5 text-center">
                  UN
                </label>
                <div className="relative">
                  <select
                    value={itemUnidade}
                    onChange={(e) => setItemUnidade(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOrUpdateProduct();
                      }
                    }}
                    className="w-full appearance-none pl-2 pr-5 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-bold text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center cursor-pointer shadow-2xs"
                  >
                    <option value="UN">UN</option>
                    <option value="M2">M2</option>
                    <option value="KG">KG</option>
                    <option value="PC">PC</option>
                    <option value="M">M</option>
                    <option value="CX">CX</option>
                    <option value="PAR">PAR</option>
                    <option value="RL">RL</option>
                    <option value="L">L</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-blue-500 absolute right-1.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* 4. QTD */}
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-blue-900 mb-0.5 text-center">
                  Qtd
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={itemQuantidade}
                  onChange={(e) => setItemQuantidade(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOrUpdateProduct();
                    }
                  }}
                  className="w-full px-1.5 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-bold text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                />
              </div>

              {/* 5. PREÇO DE VENDA */}
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-blue-900 mb-0.5 text-center">
                  Preço de Venda
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemValorUnitario}
                  readOnly
                  title="O Preço de Venda é fixo e é alterado apenas no Estoque"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOrUpdateProduct();
                    }
                  }}
                  className="w-full px-1.5 py-1.5 bg-blue-50/50 border border-blue-500 rounded-xl text-xs font-bold text-blue-900 focus:outline-none text-center shadow-2xs cursor-not-allowed"
                />
              </div>

              {/* 6. + ADICIONAR */}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddOrUpdateProduct}
                  disabled={!itemDescricao.trim() || isProductUnregistered}
                  className={`w-full py-1.5 px-3 rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1 transition-all truncate ${
                    !itemDescricao.trim() || isProductUnregistered
                      ? 'bg-slate-100 border border-slate-300 text-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-white hover:bg-blue-50 border border-blue-600 active:scale-95 text-blue-700 cursor-pointer'
                  }`}
                  title={
                    isProductUnregistered
                      ? 'Produto não cadastrado'
                      : 'Adicionar Item à Ordem de Serviço (ENTER)'
                  }
                >
                  {editingItemId ? <Save className="w-3.5 h-3.5 shrink-0" /> : <Plus className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{editingItemId ? 'Salvar' : '+ Adicionar'}</span>
                </button>
              </div>
            </div>

            {/* PAINEL DE CÁLCULO DE MEDIDAS (FRENTE, LATERAL, ALTURA, CAIMENTO, BABADO, CÁLCULO) */}
            {comMedidas && (
              <div className="bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-3 shadow-sm space-y-2.5 mt-2 transition-all">

                {isAreaPadrao ? (
                  /* GRID PARA CÁLCULO PADRÃO: ALTURA E LARGURA TOTAL M² */
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                      {/* 1. ALTURA */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center">
                          ALTURA (m)
                        </label>
                        <input
                          type="text"
                          value={medidaAltura}
                          onChange={(e) => setMedidaAltura(e.target.value)}
                          placeholder="Ex: 2,00"
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 2. LARGURA */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center">
                          LARGURA (m)
                        </label>
                        <input
                          type="text"
                          value={medidaLateral}
                          onChange={(e) => {
                            setMedidaLateral(e.target.value);
                            setMedidaFrente(e.target.value);
                          }}
                          placeholder="Ex: 1,50"
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 3. TOTAL M² */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                          TOTAL M² (ALTURA × LARGURA)
                        </label>
                        <div className="w-full py-1.5 px-2 bg-blue-600 text-white rounded-xl text-xs font-black text-center shadow-2xs border border-blue-700 flex items-center justify-center font-mono">
                          {medidaCalculo > 0 ? `${medidaCalculo.toFixed(2).replace('.', ',')} m²` : '0,00 m²'}
                        </div>
                      </div>

                      {/* 4. VALOR DA PEÇA (R$) */}
                      <div>
                        <label className="block text-[10px] font-black text-emerald-900 uppercase mb-0.5 text-center truncate">
                          VALOR DA PEÇA (R$)
                        </label>
                        <div
                          className="w-full py-1.5 px-2 bg-emerald-600 text-white rounded-xl text-xs font-black text-center shadow-2xs border border-emerald-700 flex items-center justify-center font-mono"
                          title={`Total m² (${medidaCalculo.toFixed(2)} m²) × R$ ${((precoExpressoActive && matchingCatalogProduct?.precoExpresso !== undefined && Number(matchingCatalogProduct.precoExpresso) > 0) ? Number(matchingCatalogProduct.precoExpresso) : (matchingCatalogProduct?.precoVenda || itemValorUnitario)).toFixed(2)}`}
                        >
                          R$ {(valorFinalCalculado > 0 ? valorFinalCalculado : (medidaCalculo * itemValorUnitario)).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Resumo visual do cálculo padrão */}
                    <div className="text-[11px] font-bold text-blue-950 bg-white/90 border border-blue-200 rounded-xl px-3 py-1.5 flex items-center justify-between flex-wrap gap-2">
                      <span>
                        Dimensões: <strong>{medidaAltura || '0'} m (Alt) × {medidaLateral || '0'} m (Larg)</strong> = <strong className="text-blue-700 font-extrabold">{medidaCalculo.toFixed(2)} m²</strong>
                        {itemValorUnitario > 0 && <span className="text-slate-600"> • R$ {itemValorUnitario.toFixed(2)}/m²</span>}
                      </span>
                      <span>
                        Valor da Peça: <strong className="text-emerald-700 font-black">R$ {(valorFinalCalculado > 0 ? valorFinalCalculado : (medidaCalculo * itemValorUnitario)).toFixed(2)}</strong> | Total estimado: <strong className="text-emerald-800 font-black">R$ {(((valorFinalCalculado > 0 ? valorFinalCalculado : (itemValorUnitario * (medidaCalculo > 0 ? medidaCalculo : 1))) * itemQuantidade) - (itemTipoDesconto === '%' ? ((valorFinalCalculado > 0 ? valorFinalCalculado : (itemValorUnitario * (medidaCalculo > 0 ? medidaCalculo : 1))) * itemQuantidade * (itemDescontoInput / 100)) : itemDescontoInput)).toFixed(2)}</strong> ({itemQuantidade} un)
                      </span>
                    </div>
                  </div>
                ) : isBabadoTable ? (
                  /* PAINEL DEDICADO PARA "CÁLCULO DE MESA BABADO" */
                  <div className="space-y-3">
                    {/* LINHA 1: CAMPOS DE ENTRADA (FRENTE MESA, LATERAL, ALTURA, QTD DE BABADO) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                      {/* 1. FRENTE MESA (M) */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                          FRENTE MESA (M)
                        </label>
                        <input
                          type="text"
                          value={medidaFrente}
                          onChange={(e) => setMedidaFrente(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 2. LATERAL (M) */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                          LATERAL (M)
                        </label>
                        <input
                          type="text"
                          value={medidaLateral}
                          onChange={(e) => setMedidaLateral(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 3. ALTURA (M) */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                          ALTURA (M)
                        </label>
                        <input
                          type="text"
                          value={medidaAltura}
                          onChange={(e) => setMedidaAltura(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 4. QTD DE BABADO (COM STEPPER - MÍNIMO 2) */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                          QTD DE BABADO
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const curr = parseInt(medidaQtdBabado) || 2;
                              if (curr > 2) setMedidaQtdBabado(String(curr - 1));
                              else setMedidaQtdBabado('');
                            }}
                            disabled={!medidaQtdBabado || parseInt(medidaQtdBabado) <= 2}
                            className="w-7 h-7 flex items-center justify-center bg-blue-50 border border-blue-500 text-blue-900 font-black rounded-lg hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={2}
                            placeholder="0"
                            value={medidaQtdBabado}
                            onChange={(e) => setMedidaQtdBabado(e.target.value)}
                            onBlur={() => {
                              if (medidaQtdBabado.trim() !== '') {
                                const v = parseInt(medidaQtdBabado) || 2;
                                setMedidaQtdBabado(String(Math.max(2, v)));
                              }
                            }}
                            className="w-full px-1 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center focus:ring-2 focus:ring-blue-600 focus:outline-none shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const curr = parseInt(medidaQtdBabado) || 2;
                              setMedidaQtdBabado(String(curr + 1));
                            }}
                            className="w-7 h-7 flex items-center justify-center bg-blue-50 border border-blue-500 text-blue-900 font-black rounded-lg hover:bg-blue-100 cursor-pointer transition shadow-2xs text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* LINHA 2: VALORES CALCULADOS EM R$ (CONFORME IMAGEM) */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end pt-1">
                      {/* 1. VALOR DO TAMPO */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                          VALOR DO TAMPO
                        </label>
                        <div className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs font-mono">
                          R$ {valorDoTampo.toFixed(2)}
                        </div>
                      </div>

                      {/* 2. FAIXA */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                          FAIXA
                        </label>
                        <div className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs font-mono">
                          R$ {valorFaixa.toFixed(2)}
                        </div>
                      </div>

                      {/* 3. FAIXA DE BABADO */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                          FAIXA DE BABADO
                        </label>
                        <div className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs font-mono">
                          R$ {valorFaixaDeBabado.toFixed(2)}
                        </div>
                      </div>

                      {/* 4. TOTAL BABADO */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                          TOTAL BABADO
                        </label>
                        <div className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs font-mono">
                          R$ {valorDoBabado.toFixed(2)}
                        </div>
                      </div>

                      {/* 5. VALOR TOTAL DA PEÇA */}
                      <div>
                        <label className="block text-[10px] font-black text-emerald-900 uppercase mb-0.5 text-center truncate">
                          VALOR TOTAL DA PEÇA
                        </label>
                        <div className="w-full px-2 py-1.5 bg-emerald-600 text-white border border-emerald-700 rounded-xl text-xs font-black text-center shadow-2xs font-mono">
                          R$ {valorFinalCalculado.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* LINHA 3: CARD DE MEDIDAS PARA PRODUÇÃO (IMPRESSÃO / CORTE E COSTURA) */}
                    {(() => {
                      const fNum = parseFloat(String(medidaFrente).replace(',', '.')) || 0;
                      const lNum = parseFloat(String(medidaLateral).replace(',', '.')) || 0;
                      const aNum = parseFloat(String(medidaAltura).replace(',', '.')) || 0;
                      const qNum = Math.max(2, parseInt(String(medidaQtdBabado).replace(/\D/g, '')) || 2);

                      const faixaLargura = (fNum * 2) + (lNum * 2);
                      const babadoLarguraExata = faixaLargura * 2;
                      const babadoLarguraFinal = Math.ceil(babadoLarguraExata);
                      const babadoAlturaPadrao = (aNum / qNum) + 0.02;
                      const babadoAlturaUltima = (aNum / qNum) + 0.07;

                      return (
                        <div className="bg-white/95 border border-blue-200 rounded-2xl p-3 shadow-2xs space-y-2 mt-2">
                          <div className="flex items-center gap-1.5 text-blue-950 font-black uppercase text-[11px] border-b border-blue-100 pb-1.5">
                            <span className="text-sm">📐</span>
                            <span>MEDIDAS PARA PRODUÇÃO (IMPRESSÃO / CORTE E COSTURA)</span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                                  <th className="py-1.5 px-2">PEÇA / PARTE</th>
                                  <th className="py-1.5 px-2 text-center">LARGURA FINAL</th>
                                  <th className="py-1.5 px-2 text-center">ALTURA FINAL</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-bold text-slate-800 text-xs">
                                {/* 1. TAMPO */}
                                <tr>
                                  <td className="py-2 px-2 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shadow-2xs" />
                                    <span className="font-black text-slate-900">TAMPO</span>
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono font-black text-slate-800">
                                    {fNum > 0 ? `${(fNum + 0.05).toFixed(2).replace('.', ',')} m` : '-'}
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono font-black text-slate-800">
                                    {lNum > 0 ? `${(lNum + 0.05).toFixed(2).replace('.', ',')} m` : '-'}
                                  </td>
                                </tr>

                                {/* 2. FAIXA */}
                                <tr>
                                  <td className="py-2 px-2 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-2xs" />
                                    <span className="font-black text-slate-900">FAIXA</span>
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono font-black text-slate-800">
                                    {(fNum > 0 || lNum > 0) ? `${faixaLargura.toFixed(2).replace('.', ',')} m` : '-'}
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono font-black text-slate-800">
                                    {aNum > 0 ? `${aNum.toFixed(2).replace('.', ',')} m` : '-'}
                                  </td>
                                </tr>

                                 {/* 3. FAIXA DE BABADO */}
                                <tr>
                                  <td className="py-2 px-2 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shadow-2xs" />
                                    <span className="font-black text-slate-900">FAIXA DE BABADO</span>
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono font-black text-slate-800">
                                    {(fNum > 0 || lNum > 0) ? `${babadoLarguraFinal.toFixed(2).replace('.', ',')} m` : '-'}
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono font-black text-slate-800">
                                    {aNum > 0 ? (
                                      <div className="flex items-center justify-center gap-3">
                                        <span>{babadoAlturaPadrao.toFixed(2).replace('.', ',')} m</span>
                                        <span className="font-sans font-extrabold text-blue-700 text-xs">{qNum - 1}x</span>
                                      </div>
                                    ) : '-'}
                                  </td>
                                </tr>

                                {/* 4. ÚLTIMA FAIXA DE BABADO */}
                                <tr>
                                  <td className="py-2 px-2 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-purple-700 inline-block shadow-2xs" />
                                    <span className="font-black text-slate-900">ÚLTIMA FAIXA DE BABADO</span>
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono font-black text-slate-800">
                                    {(fNum > 0 || lNum > 0) ? `${babadoLarguraFinal.toFixed(2).replace('.', ',')} m` : '-'}
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono font-black text-slate-800">
                                    {aNum > 0 ? (
                                      <div className="flex items-center justify-center gap-3">
                                        <span>{babadoAlturaUltima.toFixed(2).replace('.', ',')} m</span>
                                        <span className="font-sans font-extrabold text-purple-700 text-xs">1x</span>
                                      </div>
                                    ) : '-'}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : isCilindroTable ? (
                  /* PAINEL DEDICADO PARA "CÁLCULO DE CILINDRO" */
                  <div className="space-y-3">
                    {(() => {
                      const largNum = parseFloat(String(medidaLateral || medidaFrente).replace(',', '.')) || 0;
                      const altNum = parseFloat(String(medidaAltura).replace(',', '.')) || 0;
                      const tampoCalculado = largNum / 3;

                      return (
                        <>
                          {/* LINHA 1: CAMPOS DE ENTRADA (LARGURA, ALTURA) E TAMPO / VALOR M² */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                            {/* 1. LARGURA (M) */}
                            <div>
                              <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                                LARGURA (M)
                              </label>
                              <input
                                type="text"
                                value={medidaLateral || medidaFrente}
                                onChange={(e) => {
                                  setMedidaLateral(e.target.value);
                                  setMedidaFrente(e.target.value);
                                }}
                                placeholder="0"
                                className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                              />
                            </div>

                            {/* 2. ALTURA (M) */}
                            <div>
                              <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                                ALTURA (M)
                              </label>
                              <input
                                type="text"
                                value={medidaAltura}
                                onChange={(e) => setMedidaAltura(e.target.value)}
                                placeholder="0"
                                className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                              />
                            </div>

                            {/* 3. TAMPO (M) */}
                            <div>
                              <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                                TAMPO (M)
                              </label>
                              <div className="w-full px-2 py-1.5 bg-blue-50/50 border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs font-mono">
                                {largNum > 0 ? `${tampoCalculado.toFixed(2).replace('.', ',')} m` : '0,00 m'}
                              </div>
                            </div>

                            {/* 4. VALOR M² (R$) sem a palavra "fixo" */}
                            <div>
                              <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                                VALOR M² (R$)
                              </label>
                              <div className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs font-mono">
                                R$ {((precoExpressoActive && matchingCatalogProduct?.precoExpresso !== undefined && Number(matchingCatalogProduct.precoExpresso) > 0) ? Number(matchingCatalogProduct.precoExpresso) : (matchingCatalogProduct?.precoVenda || itemValorUnitario)).toFixed(2).replace('.', ',')}
                              </div>
                            </div>
                          </div>

                          {/* LINHA 2: VALORES CALCULADOS EM R$ (CONFORME IMAGEM DO EXCEL) */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end pt-1">
                            {/* 1. VALOR DA BASE */}
                            <div>
                              <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                                VALOR DA BASE
                              </label>
                              <div className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs font-mono">
                                R$ {valorBase.toFixed(2).replace('.', ',')}
                              </div>
                            </div>

                            {/* 2. VALOR DO TAMPO */}
                            <div>
                              <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                                VALOR DO TAMPO
                              </label>
                              <div className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs font-mono">
                                R$ {valorDoTampo.toFixed(2).replace('.', ',')}
                              </div>
                            </div>

                            {/* 3. VALOR TOTAL DA PEÇA */}
                            <div>
                              <label className="block text-[10px] font-black text-emerald-900 uppercase mb-0.5 text-center truncate">
                                VALOR TOTAL DA PEÇA
                              </label>
                              <div className="w-full px-2 py-1.5 bg-emerald-600 text-white border border-emerald-700 rounded-xl text-xs font-black text-center shadow-2xs font-mono">
                                R$ {valorFinalCalculado.toFixed(2).replace('.', ',')}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : isCuboTable ? (
                  /* PAINEL DEDICADO PARA "CÁLCULO CUBO/MESA VESTE" */
                  <div className="space-y-3">
                    {/* LINHA 1: CAMPOS SOLICITADOS (Medida, Altura, Tampo) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                      {/* 1. Medida */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                          Medida
                        </label>
                        <input
                          type="text"
                          value={medidaFrente}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMedidaFrente(val);
                            if (!medidaTampo || medidaTampo === medidaFrente) {
                              setMedidaTampo(val);
                            }
                          }}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 2. Altura */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                          Altura
                        </label>
                        <input
                          type="text"
                          value={medidaAltura}
                          onChange={(e) => setMedidaAltura(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 3. Tampo */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate">
                          Tampo
                        </label>
                        <input
                          type="text"
                          value={medidaTampo !== '' ? medidaTampo : medidaFrente}
                          onChange={(e) => setMedidaTampo(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* LINHA 2: CÁLCULOS (calculo, valor, valor tampo, Total) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end pt-1">
                      {/* 1. calculo = (medida * 4) (não arredonde para cima) */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 mb-0.5 text-center truncate" title="calculo = (medida * 4) (não arredonde para cima)">
                          calculo
                        </label>
                        <div
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs font-mono"
                          title={`calculo = (medida * 4) = ${calculoCubo > 0 ? String(calculoCubo).replace('.', ',') : '0,00'}`}
                        >
                          {calculoCubo > 0 ? (Number.isInteger(calculoCubo) ? calculoCubo.toString() : calculoCubo.toFixed(2).replace('.', ',')) : '0,00'}
                        </div>
                      </div>

                      {/* 2. valor = (altura * calculo * preço de venda/preço expresso) */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 mb-0.5 text-center truncate" title="valor = (altura * calculo * preço de venda/preço expresso)">
                          valor
                        </label>
                        <div
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs font-mono"
                          title={`valor = (altura * calculo * preço) = R$ ${valorCuboCorpo.toFixed(2).replace('.', ',')}`}
                        >
                          R$ {valorCuboCorpo.toFixed(2).replace('.', ',')}
                        </div>
                      </div>

                      {/* 3. valor tampo = (tampo * tampo * preço de venda/preço expresso) */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 mb-0.5 text-center truncate" title="valor tampo = (tampo * tampo * preço de venda/preço expresso)">
                          valor tampo
                        </label>
                        <div
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs font-mono"
                          title={`valor tampo = (tampo * tampo * preço) = R$ ${valorCuboTampo.toFixed(2).replace('.', ',')}`}
                        >
                          R$ {valorCuboTampo.toFixed(2).replace('.', ',')}
                        </div>
                      </div>

                      {/* 4. Total = (valor + valor tampo) arredonde pra cima */}
                      <div>
                        <label className="block text-[10px] font-black text-emerald-900 uppercase mb-0.5 text-center truncate" title="Total = (valor + valor tampo) arredonde pra cima">
                          Total
                        </label>
                        <div
                          className="w-full px-2 py-1.5 bg-emerald-600 text-white border border-emerald-700 rounded-xl text-xs font-black text-center shadow-2xs font-mono"
                          title={`Total = (valor + valor tampo) arredondado para cima = R$ ${valorFinalCalculado.toFixed(2).replace('.', ',')}`}
                        >
                          R$ {valorFinalCalculado.toFixed(2).replace('.', ',')}
                        </div>
                      </div>
                    </div>

                    {/* Resumo visual do cálculo cubo / mesa veste */}
                    <div className="text-[11px] font-bold text-blue-950 bg-white/90 border border-blue-200 rounded-xl px-3 py-1.5 flex items-center justify-between flex-wrap gap-2">
                      <span>
                        Dimensões: <strong>Medida: {medidaFrente || '0'} m</strong> | <strong>Altura: {medidaAltura || '0'} m</strong> | <strong>Tampo: {(medidaTampo !== '' ? medidaTampo : medidaFrente) || '0'} m</strong> • calculo: <strong className="text-blue-700">{calculoCubo > 0 ? String(calculoCubo).replace('.', ',') : '0,00'} m</strong>
                        {itemValorUnitario > 0 && <span className="text-slate-600"> • R$ {((precoExpressoActive && matchingCatalogProduct?.precoExpresso !== undefined && Number(matchingCatalogProduct.precoExpresso) > 0) ? Number(matchingCatalogProduct.precoExpresso) : (matchingCatalogProduct?.precoVenda || itemValorUnitario)).toFixed(2)}/m²</span>}
                      </span>
                      <span>
                        Total da Peça: <strong className="text-emerald-700 font-black">R$ {valorFinalCalculado.toFixed(2)}</strong> | Total estimado: <strong className="text-emerald-800 font-black">R$ {(((valorFinalCalculado > 0 ? valorFinalCalculado : (itemValorUnitario * (medidaCalculo > 0 ? medidaCalculo : 1))) * itemQuantidade) - (itemTipoDesconto === '%' ? ((valorFinalCalculado > 0 ? valorFinalCalculado : (itemValorUnitario * (medidaCalculo > 0 ? medidaCalculo : 1))) * itemQuantidade * (itemDescontoInput / 100)) : itemDescontoInput)).toFixed(2)}</strong> ({itemQuantidade} un)
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                      {/* 1. FRENTE */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center">
                          FRENTE
                        </label>
                        <input
                          type="text"
                          value={medidaFrente}
                          onChange={(e) => setMedidaFrente(e.target.value)}
                          placeholder=""
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 2. LATERAL */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center">
                          LATERAL
                        </label>
                        <input
                          type="text"
                          value={medidaLateral}
                          onChange={(e) => setMedidaLateral(e.target.value)}
                          placeholder=""
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 3. ALTURA */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center">
                          ALTURA 
                        </label>
                        <input
                          type="text"
                          value={medidaAltura}
                          onChange={(e) => setMedidaAltura(e.target.value)}
                          placeholder=""
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 4. CAIMENTO */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center">
                          CAIMENTO 
                        </label>
                        <input
                          type="text"
                          value={medidaCaimento}
                          onChange={(e) => setMedidaCaimento(e.target.value)}
                          placeholder=""
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 5. BABADO */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center">
                          BABADO 
                        </label>
                        <input
                          type="text"
                          value={medidaBabado}
                          onChange={(e) => setMedidaBabado(e.target.value)}
                          placeholder=""
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 6. CALCULOS */}
                      <div>
                        <label
                          className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate"
                          title={
                            isRetroTable
                              ? "CÁLCULO PARA O BABADO = ((Frente + 0,5) × 3,14) × 2 -> Arredondado pra cima no BABADO"
                              : isRoundTable
                              ? "CÁLCULO PARA O BABADO = (Diâmetro × 3,14) × 2 -> Arredondado pra cima no BABADO"
                              : "CÁLCULO PARA O BABADO = ((Frente + Lateral) × 2) × 2 -> Arredondado pra cima no BABADO"
                          }
                        >
                          CÁLCULO (m²)
                        </label>
                        <div
                          className="w-full py-1.5 px-2 bg-blue-600 text-white rounded-xl text-xs font-black text-center shadow-2xs border border-blue-700 flex items-center justify-center font-mono"
                          title={
                            calculoBabadoExato > 0
                              ? `Cálculo do Babado: ${calculoBabadoExato.toFixed(2).replace('.', ',')} -> Arredondado para cima = ${Math.ceil(calculoBabadoExato)}`
                              : undefined
                          }
                        >
                          <span>
                            {calculoBabadoExato > 0
                              ? calculoBabadoExato.toFixed(2).replace('.', ',')
                              : (medidaCalculo > 0 ? `${medidaCalculo.toFixed(2).replace('.', ',')} m²` : '0,00')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* LINHA 2: VALORES CALCULADOS EM R$ (COM MESMO TAMANHO E LABELS EM CIMA DE FORA IGUAL A FRENTE E LATERAL) */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end pt-1">
                      {/* 1. VALOR DO BABADO */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate" title="VALOR DO BABADO">
                          VALOR DO BABADO
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${valorDoBabado.toFixed(2)}`}
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                        />
                      </div>

                      {/* 2. VALOR DO TAMPO */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate" title="VALOR DO TAMPO">
                          VALOR DO TAMPO
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${valorDoTampo.toFixed(2)}`}
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                        />
                      </div>

                      {/* 3. VALOR DA SOBREPOSIÇÃO */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate" title="VALOR DO SOBREPOSIÇÃO">
                          VALOR DO SOBREPOSIÇÃO
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${valorDaSobreposicao.toFixed(2)}`}
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                        />
                      </div>

                      {/* 4. C/ SOBREPOSIÇÃO */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate" title="SUBTOTAL COM SOBREPOSIÇÃO (+ R$ 20)">
                          C/ SOBREPOSIÇÃO
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${valorComSobreposicao.toFixed(2)}`}
                          className={`w-full px-2 py-1.5 rounded-xl text-xs font-black text-center shadow-2xs focus:outline-none cursor-default font-mono transition ${
                            comSobreposicao 
                              ? 'bg-red-600 text-white border-2 border-red-700 ring-2 ring-red-400/20' 
                              : 'bg-white border border-blue-500 text-blue-900'
                          }`}
                        />
                      </div>

                      {/* 5. S/ SOBREPOSIÇÃO */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate" title="SUBTOTAL SEM SOBREPOSIÇÃO (+ R$ 20)">
                          S/ SOBREPOSIÇÃO
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${valorSemSobreposicao.toFixed(2)}`}
                          className={`w-full px-2 py-1.5 rounded-xl text-xs font-black text-center shadow-2xs focus:outline-none cursor-default font-mono transition ${
                            !comSobreposicao 
                              ? 'bg-blue-100 text-blue-950 border-2 border-blue-500 ring-2 ring-blue-400/20' 
                              : 'bg-white border border-blue-500 text-blue-900'
                          }`}
                        />
                      </div>

                      {/* 6. VALOR FINAL / VALOR DA PEÇA */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate" title="VALOR FINAL DA PEÇA">
                          VALOR DA PEÇA
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${valorFinalCalculado.toFixed(2)}`}
                          className="w-full px-2 py-1.5 bg-emerald-600 text-white border border-emerald-700 rounded-xl text-xs font-black text-center shadow-2xs focus:outline-none cursor-default font-mono"
                        />
                      </div>
                    </div>

                    {/* Resumo visual do cálculo */}
                    <div className="text-[11px] font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-slate-800">
                        Saia/Babado: <strong className="text-blue-600 font-extrabold">{medidaBabado || '0'} m</strong> <span className="text-slate-700 font-semibold">({((parseFloat(String(medidaBabado).replace(',', '.')) || 0) * (isRetroTable ? Math.max(0, (parseFloat(String(medidaAltura).replace(',', '.')) || 0) - 0.25) : (parseFloat(String(medidaAltura).replace(',', '.')) || 0))).toFixed(2)} m²)</span> | Tampo: <strong className="text-blue-600 font-extrabold">{isRetroTable ? `${((parseFloat(String(medidaFrente).replace(',', '.')) || 0) + 0.5).toFixed(2)} × ${((parseFloat(String(medidaLateral).replace(',', '.')) || 0) + 0.5).toFixed(2)}` : (comSobreposicao ? `${((parseFloat(String(medidaFrente).replace(',', '.')) || 0) + (parseFloat(String(medidaCaimento).replace(',', '.')) || 0)).toFixed(2)} × ${((parseFloat(String(medidaLateral).replace(',', '.')) || 0) + (parseFloat(String(medidaCaimento).replace(',', '.')) || 0)).toFixed(2)}` : `${(parseFloat(String(medidaFrente).replace(',', '.')) || 0).toFixed(2)} × ${(parseFloat(String(medidaLateral).replace(',', '.')) || 0).toFixed(2)}`)} m</strong> = <strong className="text-blue-600 font-black">{medidaCalculo.toFixed(2)} m²</strong>
                      </span>
                      <span>
                        Valor da Peça: <strong className="text-emerald-700 font-black">R$ {(valorFinalCalculado > 0 ? valorFinalCalculado : itemValorUnitario).toFixed(2)}</strong> | Total estimado: <strong className="text-emerald-800 font-black">R$ {(((valorFinalCalculado > 0 ? valorFinalCalculado : (itemValorUnitario * (medidaCalculo > 0 ? medidaCalculo : 1))) * itemQuantidade) - (itemTipoDesconto === '%' ? ((valorFinalCalculado > 0 ? valorFinalCalculado : (itemValorUnitario * (medidaCalculo > 0 ? medidaCalculo : 1))) * itemQuantidade * (itemDescontoInput / 100)) : itemDescontoInput)).toFixed(2)}</strong> ({itemQuantidade} un)
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* BLOCK 3: LISTA DOS ITENS DA ORDEM DE SERVIÇO (THE HEART OF THE OS) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-2">
            <div className="border-b border-slate-200 pb-1 flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Lista dos Itens da Ordem de Serviço ({osItens.length})
              </h2>
            </div>

            <div className="overflow-x-auto max-h-[160px] sm:max-h-[185px] overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 text-slate-800 font-black uppercase text-[10px] border-b border-slate-200">
                    <th className="p-2">Código</th>
                    <th className="p-2">Descrição Item</th>
                    <th className="p-2 text-center">Unidade</th>
                    <th className="p-2 text-center">Qtd</th>
                    <th className="p-2 text-right">Valor Unit.</th>
                    <th className="p-2 text-right">Preço Médio</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-bold text-slate-900">
                  {osItens.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400 font-medium">
                        Nenhum item adicionado à lista da Ordem de Serviço até o momento.
                      </td>
                    </tr>
                  ) : (
                    osItens.map((item, idx) => {
                      // ALTERNATING MINT GREEN BACKGROUNDS: #9BFAB0 & #D0FDD7
                      const bgClass = idx % 2 === 0 ? 'bg-[#9BFAB0]' : 'bg-[#D0FDD7]';

                      return (
                        <tr key={item.id} className={`${bgClass} transition-colors`}>
                          <td className="p-2 font-mono font-black text-slate-900">{item.codigo}</td>
                          <td className="p-2 font-extrabold text-slate-950">
                            {item.comMedidas ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{item.categoria ? `${item.categoria} - ${item.descricao}` : item.descricao}</span>
                                  {!expandedMedidasItemIds[item.id] && formatCompactMedidas(item) && (
                                    <span className="font-black text-slate-950 tracking-tight">
                                      {formatCompactMedidas(item)}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => toggleMedidasExpand(item.id)}
                                    className="p-0.5 hover:bg-black/10 rounded transition-colors text-slate-800 cursor-pointer inline-flex items-center"
                                    title={expandedMedidasItemIds[item.id] ? "Ocultar detalhes de medidas" : "Abrir detalhes de medidas"}
                                  >
                                    {expandedMedidasItemIds[item.id] ? (
                                      <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                                    )}
                                  </button>
                                </div>

                                 {/* DETALHE EXPANDIDO (EXATAMENTE CONFORME A IMAGEM) */}
                                {expandedMedidasItemIds[item.id] && (
                                  <div className="text-[10px] font-semibold text-purple-950 bg-purple-100/90 border border-purple-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5 flex-wrap shadow-2xs animate-fadeIn">
                                    {item.qtdBabado || item.valorFaixa || (item.formulaMedidaId && item.formulaMedidaId.includes('babado')) ? (
                                      <div className="space-y-0.5">
                                        <span>📐 <strong>Mesa Babado:</strong> Frente: {item.medidaFrente ?? '-'}m | Lat: {item.medidaLateral ?? '-'}m | Alt: {item.medidaAltura ?? '-'}m | Qtd Babado: {item.qtdBabado ?? 2} un</span><br />
                                        <span className="text-amber-900 font-bold">
                                          🏭 <strong>Produção:</strong> Tampo: {((item.medidaFrente || 0) + 0.05).toFixed(2)}×{((item.medidaLateral || 0) + 0.05).toFixed(2)}m | Faixa: {(((item.medidaFrente || 0) * 2) + ((item.medidaLateral || 0) * 2)).toFixed(2)}×{(item.medidaAltura || 0).toFixed(2)}m | Babado: {Math.ceil((((item.medidaFrente || 0) * 2) + ((item.medidaLateral || 0) * 2)) * 2).toFixed(2)}×{(((item.medidaAltura || 0) / (item.qtdBabado || 2)) + 0.02).toFixed(2)}m | Última Faixa: {Math.ceil((((item.medidaFrente || 0) * 2) + ((item.medidaLateral || 0) * 2)) * 2).toFixed(2)}×{(((item.medidaAltura || 0) / (item.qtdBabado || 2)) + 0.07).toFixed(2)}m
                                        </span>
                                      </div>
                                    ) : (item.calculoCubo !== undefined || item.valorCubo !== undefined || (item.medidaTampo !== undefined && item.medidaTampo > 0) || (item.formulaMedidaId && (item.formulaMedidaId.includes('cubo') || item.formulaMedidaId.includes('veste')))) ? (
                                      <div className="space-y-0.5">
                                        <span>📐 <strong>Cálculo Cubo/Mesa Veste:</strong> Medida: {item.medidaFrente !== undefined ? String(item.medidaFrente).replace('.', ',') : '-'}m | Altura: {item.medidaAltura !== undefined ? String(item.medidaAltura).replace('.', ',') : '-'}m | Tampo: {(item.medidaTampo !== undefined ? String(item.medidaTampo) : (item.medidaFrente !== undefined ? String(item.medidaFrente) : '-')).replace('.', ',')}m</span><br />
                                        <span className="text-amber-900 font-bold">
                                          🏭 <strong>Valores:</strong> calculo: {item.calculoCubo !== undefined ? `${Number(item.calculoCubo).toFixed(2).replace('.', ',')}m` : `${((Number(item.medidaFrente) || 0) * 4).toFixed(2).replace('.', ',')}m`} | valor: R$ {(item.valorCubo !== undefined ? item.valorCubo : (item.valorBabado || 0)).toFixed(2).replace('.', ',')} | valor tampo: R$ {(item.valorTampo || 0).toFixed(2).replace('.', ',')} | Total: R$ {(item.total || 0).toFixed(2).replace('.', ',')}
                                        </span>
                                      </div>
                                    ) : item.valorBase !== undefined || (item.formulaMedidaId && item.formulaMedidaId.includes('cilindro')) ? (
                                      <div className="space-y-0.5">
                                        <span>📐 <strong>Cilindro:</strong> Largura: {item.medidaLateral ?? item.medidaFrente ?? '-'}m | Altura: {item.medidaAltura ?? '-'}m | Tampo: {(((item.medidaLateral || item.medidaFrente || 0) / 3)).toFixed(2).replace('.', ',')}m</span><br />
                                        <span className="text-amber-900 font-bold">
                                          🏭 <strong>Valores:</strong> Base: R$ {(item.valorBase || 0).toFixed(2)} | Tampo: R$ {(item.valorTampo || 0).toFixed(2)} | Total: R$ {(item.total || 0).toFixed(2)}
                                        </span>
                                      </div>
                                    ) : item.medidaBabado || item.medidaCaimento || item.valorBabado ? (
                                      <span>📐 <strong>Medidas:</strong> Frente: {item.medidaFrente !== undefined ? String(item.medidaFrente).replace('.', ',') : '-'}m | Lat: {item.medidaLateral !== undefined ? String(item.medidaLateral).replace('.', ',') : '-'}m | Alt: {item.medidaAltura !== undefined ? String(item.medidaAltura).replace('.', ',') : '-'}m | Caimento: {item.medidaCaimento !== undefined ? String(item.medidaCaimento).replace('.', ',') : '-'}m | Babado: {item.medidaBabado !== undefined ? String(item.medidaBabado).replace('.', ',') : '-'}m</span>
                                    ) : (
                                      <span>📐 <strong>Medidas:</strong> Altura: {item.medidaAltura !== undefined ? String(item.medidaAltura).replace('.', ',') : '-'}m | Largura: {(item.medidaLateral !== undefined ? item.medidaLateral : item.medidaFrente) !== undefined ? String(item.medidaLateral ?? item.medidaFrente).replace('.', ',') : '-'}m</span>
                                    )}
                                    <span className="bg-purple-700 text-white text-[9px] px-1.5 py-0.2 rounded font-black">
                                      Cálculo: {item.medidaCalculo ?? '-'} m²
                                    </span>
                                    {item.comSobreposicao && (
                                      <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase shadow-2xs">
                                        Sobreposição
                                      </span>
                                    )}
                                    {item.valorBabado !== undefined && item.valorBabado > 0 && (
                                      <span className="bg-fuchsia-200 text-fuchsia-950 text-[9px] px-1 rounded font-bold">
                                        Babado: R$ {item.valorBabado.toFixed(2)}
                                      </span>
                                    )}
                                    {item.valorTampo !== undefined && item.valorTampo > 0 && (
                                      <span className="bg-blue-200 text-blue-950 text-[9px] px-1 rounded font-bold">
                                        Tampo: R$ {item.valorTampo.toFixed(2)}
                                      </span>
                                    )}
                                    {item.valorSobreposicao !== undefined && item.valorSobreposicao > 0 && (
                                      <span className="bg-amber-200 text-amber-950 text-[9px] px-1 rounded font-bold">
                                        Sobrep.: R$ {item.valorSobreposicao.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{item.categoria ? `${item.categoria} - ${item.descricao}` : item.descricao}</span>
                                {item.precoExpresso && (
                                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] px-1.5 py-0.2 rounded font-black uppercase">
                                    ⚡ Preço Expresso
                                  </span>
                                )}
                              </div>
                            )}
                            {item.comMedidas && item.precoExpresso && (
                              <div className="mt-0.5">
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] px-1.5 py-0.2 rounded font-black uppercase inline-block">
                                  ⚡ Preço Expresso
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-center">{item.unidade}</td>
                          <td className="p-2 text-center font-black text-slate-950">{item.quantidade}</td>
                          <td className="p-2 text-right">R$ {(item.valorUnitario ?? 0).toFixed(2)}</td>
                          <td className="p-2 text-right text-slate-700">R$ {(item.precoMedio ?? item.valorUnitario ?? 0).toFixed(2)}</td>
                          <td className="p-2 text-right font-black text-slate-950">
                            R$ {(item.total ?? ((item.quantidade || 1) * (item.valorUnitario || 0))).toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditItem(item)}
                                className="p-1 bg-white/80 hover:bg-white text-blue-700 rounded-md transition-all cursor-pointer shadow-sm"
                                title="Editar item"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 bg-white/80 hover:bg-white text-red-700 rounded-md transition-all cursor-pointer shadow-sm"
                                title="Excluir item"
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
          </div>

          {/* BLOCK 4 & BLOCK 4.5 SIDE-BY-SIDE IN A 2-COLUMN GRID TO OPTIMIZE HEIGHT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* BLOCK 4: ANEXOS DA ORDEM DE SERVIÇO (ARTES) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-3.5 shadow-sm space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Anexos da OS (Artes) ({anexos.length})
                </h2>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <label className="px-2.5 py-1 bg-white border border-blue-600 hover:bg-blue-50 text-blue-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>Upload Artes</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <label className="px-2.5 py-1 bg-purple-50 border border-purple-600 hover:bg-purple-100 text-purple-800 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-2xs" title="Upload de arte em alta resolução para download pelo impressor (não sai na folha impressa da OS)">
                    <Printer className="w-3.5 h-3.5 text-purple-700" />
                    <span>Para Impressão</span>
                    <input
                      type="file"
                      accept="image/*,.pdf,.cdr,.psd,.ai,.tiff,.tif"
                      multiple
                      onChange={handleFileUploadParaImpressao}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowArtEditorModal(true)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-900 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-2xs border border-slate-900"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-900" />
                    <span>Editor Corel</span>
                  </button>
                </div>
              </div>

              {/* ARTES DISPLAY */}
              {anexos.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-xl p-3 text-center space-y-1 bg-slate-50/50 my-auto">
                  <p className="text-xs font-bold text-slate-500">
                    Nenhuma arte anexada até o momento.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                  {anexos.map((a, idx) => {
                    const isParaImpressao = a.type === 'PARA_IMPRESSAO' || a.isParaImpressao === true || (a.label || '').toLowerCase().includes('impressão') || (a.label || '').toLowerCase().includes('impressao');
                    return (
                      <div
                        key={a.id}
                        className={`border rounded-xl p-1.5 text-center space-y-1 relative group transition-all ${
                          isParaImpressao
                            ? 'bg-purple-50/70 border-purple-300 ring-1 ring-purple-400/50'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {isParaImpressao && (
                          <span className="absolute top-1 left-1 z-10 bg-purple-700 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs uppercase tracking-tight flex items-center gap-0.5">
                            <Printer className="w-2.5 h-2.5" />
                            <span>Impressão</span>
                          </span>
                        )}
                        <img
                          src={a.fileUrl}
                          alt={a.fileName}
                          className="h-12 w-full object-contain rounded border border-slate-200 bg-white"
                        />
                        <div className="text-[10px] font-bold text-slate-700 truncate px-0.5" title={a.fileName}>
                          {a.fileName}
                        </div>
                        <div className="flex items-center justify-center gap-1 pt-0.5 border-t border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => setSelectedPreviewImage(a.fileUrl)}
                            className="p-1 text-blue-700 hover:bg-blue-100 rounded cursor-pointer"
                            title="Visualizar arte"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadAttachment(a)}
                            className="p-1 text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer"
                            title="Baixar arquivo original"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnexos((prev) => prev.filter((item) => item.id !== a.id))}
                            className="p-1 text-red-700 hover:bg-red-100 rounded cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* BLOCK 4.5: OBSERVAÇÕES GERAIS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-3.5 shadow-sm space-y-1.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Observações Gerais
                </h2>
              </div>
              <textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Digite instruções adicionais para a produção ou observações do cliente..."
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* BLOCK 5: VALORES TOTAIS & BOTÕES DE AÇÃO */}
          <div className="bg-slate-100 text-slate-900 border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase">
                {isOrcamentoMode ? 'Resumo Financeiro do Orçamento' : 'Resumo Financeiro da Ordem'}
              </span>
              <div className="flex items-center gap-3 text-xs font-extrabold">
                <span>Subtotal: <strong className="text-slate-900">R$ {(subtotalOS || 0).toFixed(2)}</strong></span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div>
                <span className="block text-[10px] text-slate-500 font-black uppercase text-right">VALOR FINAL</span>
                <span className="text-xl font-black text-blue-600">R$ {(valorFinalOS || 0).toFixed(2)}</span>
              </div>

              {(isOrcamentoMode && (!editingOsId || !osCodigo.startsWith('OS'))) ? (
                <>
                  {/* "EXCLUIR ORC" BUTTON (VISIBLE WHEN EDITING AN EXISTING ORC) */}
                  {editingOsId && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentOs = osList.find((o) => o.id === editingOsId);
                        if (currentOs) {
                          handleRequestDeleteOs(currentOs);
                        }
                      }}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                      title="Excluir este Orçamento (Requer senha de acesso)"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Excluir ORC</span>
                    </button>
                  )}

                  {/* "GERAR OS" BUTTON (VISIBLE WHEN EDITING AN EXISTING ORC) */}
                  {editingOsId && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentOs = osList.find((o) => o.id === editingOsId);
                        if (currentOs) {
                          handleRequestGenerateOs(currentOs);
                        }
                      }}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                      title="Transformar este Orçamento em Ordem de Serviço (Requer senha de Superior)"
                    >
                      <Sparkles className="w-4 h-4 text-white" />
                      <span>Gerar OS</span>
                    </button>
                  )}

                  {/* "CRIAR ORÇAMENTO / SALVAR ORÇAMENTO" BUTTON */}
                  <button
                    type="button"
                    onClick={handleSaveOrcamento}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-blue-600 hover:bg-blue-50 text-blue-700 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-4 h-4 text-blue-600" />
                    <span>
                      {editingOsId ? 'Salvar Orçamento' : 'Criar Orçamento'}
                      <span className="hidden lg:inline"> (F10)</span>
                    </span>
                  </button>
                </>
              ) : (
                <>
                  {/* "SALVAR ALTERAÇÕES" BUTTON */}
                  <button
                    type="button"
                    onClick={handleSaveOs}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-emerald-600 hover:bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-4 h-4 text-emerald-600" />
                    <span>Salvar Alterações</span>
                  </button>

                  {/* "EXCLUIR OS" BUTTON (VISIBLE WHEN EDITING AN EXISTING OS) */}
                  {editingOsId && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentOs = osList.find((o) => o.id === editingOsId);
                        if (currentOs) {
                          handleRequestDeleteOs(currentOs);
                        }
                      }}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                      title="Excluir esta Ordem de Serviço (Requer senha de acesso)"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Excluir OS</span>
                    </button>
                  )}

                  {/* ACTION BUTTON: REGISTRAR PAGAMENTO (SHOPEE) OU PAGAR NO CAIXA PDV (OS PADRÃO) */}
                  {isShopeeMode ? (
                    <button
                      type="button"
                      onClick={handleRegistrarPagamentoShopee}
                      className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <CreditCard className="w-4 h-4 text-white" />
                      <span>
                        REGISTRAR PAGAMENTO
                        <span className="hidden lg:inline"> (F10)</span>
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenPdv}
                      className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-blue-600 hover:bg-blue-50 text-blue-700 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <ShoppingCart className="w-4 h-4 text-blue-600" />
                      <span>
                        Pagar no Caixa PDV
                        <span className="hidden lg:inline"> (F10)</span>
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: FULL-SCREEN SEARCH & OS/ORC HISTORY */}
      {activeView === 'SEARCH_OS' && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[#2563EB] text-white p-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black tracking-tight">
                {isOrcamentoMode ? 'Histórico & Pesquisa de Orçamentos' : 'Histórico & Pesquisa de Ordens de Serviço'}
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                {isOrcamentoMode
                  ? 'Consulte todos os Orçamentos cadastrados no sistema.'
                  : 'Consulte todas as Ordens de Serviço cadastradas e acompanhe seus estágios.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveView('NEW_OS')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <span>
                {isOrcamentoMode ? 'Voltar ao Orçamento' : 'Voltar ao Cadastro'}
                <span className="hidden lg:inline"> (F2)</span>
              </span>
            </button>
          </div>

          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <input
                type="search"
                name="os_search_filter_term_no_autofill"
                id="os_search_filter_term_no_autofill"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-form-type="other"
                data-1p-ignore="true"
                readOnly={Boolean(deleteModalOs || transformModalOrc || editOsAuthModal)}
                value={searchTermOs}
                onChange={(e) => handleSearchTermChange(e.target.value)}
                placeholder={
                  isOrcamentoMode
                    ? 'Pesquise por Número do Orçamento, Cliente, CPF/CNPJ ou Situação...'
                    : 'Pesquise por Número da OS, Cliente, CPF/CNPJ ou Status...'
                }
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>

            <button
              type="button"
              onClick={loadData}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[10px] font-extrabold">
                  <th className="p-3">{isOrcamentoMode ? 'Código ORC' : 'Código OS'}</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Expedição</th>
                  <th className="p-3">{isOrcamentoMode ? 'Situação' : 'Estágio Atual'}</th>
                  <th className="p-3 text-right">Valor Final</th>
                  <th className="p-3">{isOrcamentoMode ? 'Status' : 'Pagamento'}</th>
                  <th className="p-3">Data de Entrega</th>
                  <th className="p-3"></th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {osList
                  .filter((os) =>
                    isOrcamentoMode
                      ? ((os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento || os.codigo.startsWith('ORC'))
                      : ((os as any).tipoDocumento !== 'ORCAMENTO' && !(os as any).isOrcamento && !os.codigo.startsWith('ORC'))
                  )
                  .filter((os) =>
                    os.codigo.toLowerCase().includes(searchTermOs.toLowerCase()) ||
                    os.clienteNome.toLowerCase().includes(searchTermOs.toLowerCase())
                  ).length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      {isOrcamentoMode ? 'Nenhum Orçamento encontrado.' : 'Nenhuma Ordem de Serviço encontrada.'}
                    </td>
                  </tr>
                ) : (
                  osList
                    .filter((os) =>
                      isOrcamentoMode
                        ? ((os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento || os.codigo.startsWith('ORC'))
                        : ((os as any).tipoDocumento !== 'ORCAMENTO' && !(os as any).isOrcamento && !os.codigo.startsWith('ORC'))
                    )
                    .filter((os) =>
                      os.codigo.toLowerCase().includes(searchTermOs.toLowerCase()) ||
                      os.clienteNome.toLowerCase().includes(searchTermOs.toLowerCase())
                    )
                    .map((os) => {
                      const isExpanded = expandedOsIds.has(os.id);
                      const historyList = filterVisibleHistory(os.historicoEdicoes);
                      const isDue = isDeliveryDueOrToday(os.prazoEntrega);
                      const isPendente = os.paymentStatus !== 'pago';

                      return (
                        <React.Fragment key={os.id}>
                          <tr
                            onClick={() => toggleExpandOs(os.id)}
                            className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${
                              isExpanded ? 'bg-blue-50/30' : ''
                            }`}
                          >
                            <td className="p-3 font-black text-blue-600">
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-blue-600 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                )}
                                <span className="hover:underline">{os.codigo}</span>
                                {historyList.length > 0 && (
                                  <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-black rounded-full">
                                    {historyList.length}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">{formatDateBR(os.dataVenda)}</td>
                            <td className="p-3 font-bold text-slate-900">{os.clienteNome}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                                  os.tipoExpedicao === 'EXPRESSO EXCURSÃO'
                                    ? 'bg-red-600 text-white'
                                    : os.tipoExpedicao === 'EXPRESSO DO DIA'
                                    ? 'bg-[#FFA500] text-slate-950 font-black'
                                    : 'bg-blue-600 text-white'
                                }`}
                              >
                                <Truck className="w-3 h-3" />
                                {os.tipoExpedicao || 'NORMAL'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                                {isOrcamentoMode ? (os.status || 'Orçamento Criado') : os.estagioAtual}
                              </span>
                            </td>
                            <td className="p-3 text-right font-black">R$ {(os.valorFinal ?? 0).toFixed(2)}</td>
                            <td className="p-3">
                              {isOrcamentoMode ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                                  Orçamento
                                </span>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    os.paymentStatus === 'pago'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {os.paymentStatus === 'pago' ? 'Pago' : 'Pendente'}
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`text-xs ${
                                  !isOrcamentoMode && isPendente && isDue
                                    ? 'text-red-600 font-extrabold'
                                    : 'text-slate-800 font-medium'
                                }`}
                              >
                                {formatDateBR(os.prazoEntrega)}
                              </span>
                            </td>
                            <td className="p-3 text-left" onClick={(e) => e.stopPropagation()}>
                              {isPendente && isDue ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenWhatsApp(os, 'LEMBRETE_COBRANCA')}
                                  className="text-red-600 hover:text-red-700 font-black text-[10px] uppercase tracking-tight hover:underline cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1 active:scale-95"
                                  title="Enviar Mensagem de Lembrete e Cobrança via WhatsApp"
                                >
                                  <span>ENVIAR MENSAGEM DE LEMBRETE</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenWhatsApp(os, 'AGRADECIMENTO')}
                                  className="text-emerald-600 hover:text-emerald-700 font-black text-[10px] uppercase tracking-tight hover:underline cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1 active:scale-95"
                                  title="Enviar Mensagem de Agradecimento via WhatsApp"
                                >
                                  <span>ENVIAR MENSAGEM DE AGRADECIMENTO</span>
                                </button>
                              )}
                            </td>
                            <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {/* BOTÃO GERAR OS (PARA ORÇAMENTOS) */}
                                {((os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento || os.codigo?.startsWith('ORC')) && (
                                  <button
                                    type="button"
                                    onClick={() => handleRequestGenerateOs(os)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                                    title="Transformar este Orçamento em Ordem de Serviço (Requer senha de Superior)"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-white" />
                                    <span>Gerar OS</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setPrintableOs(os)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="Visualizar e Imprimir A4"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Imprimir</span>
                                </button>

                                {/* BOTÃO "EDITAR" (PARA OS PAGA: EXIBE APENAS PARA DIRETORIA, SUPERVISOR, ADMIN MASTER, DEVELOPER, CEO, GERENTE, SUPERVIVOR; REQUER SENHA DE AUTORIZAÇÃO) */}
                                {(isOrcamentoMode || !isOsPago(os) || canUserSeePaidOsEdit) && (
                                  <button
                                    type="button"
                                    onClick={() => handleRequestEditOs(os)}
                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                    title={isOrcamentoMode ? 'Editar Orçamento' : isOsPago(os) ? 'Editar Ordem de Serviço Paga (Requer senha de autorização)' : 'Editar Ordem de Serviço'}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Editar</span>
                                  </button>
                                )}

                                {!isOrcamentoMode && os.paymentStatus !== 'pago' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!isUserAuthorizedForOs(os.operador)) {
                                        const { role } = getLoggedUserAndPerfil();
                                        setFeedback({
                                          type: 'error',
                                          message: `Acesso Restrito ao Caixa (${role}): Apenas o criador da OS "${os.operador}" ou perfis autorizados (Developer, CEO, Gerente Geral, Supervisor, Conferente e Recepção) possuem autorização para movimentar o caixa desta Ordem de Serviço.`,
                                        });
                                        return;
                                      }
                                      setCurrentOsForPdv(os);
                                      setShowCaixaPdvModal(true);
                                    }}
                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                    title="Abrir Caixa PDV para Pagamento"
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                    <span>Caixa</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleRequestDeleteOs(os)}
                                  className="p-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-all cursor-pointer"
                                  title={isOrcamentoMode ? 'Excluir Orçamento (Requer senha)' : 'Excluir OS (Requer senha)'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* EXPANDED EDIT HISTORY SUB-ROW */}
                          {isExpanded && (
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <td colSpan={9} className="p-3 sm:p-4 bg-slate-50">
                                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                    <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                                      <History className="w-4 h-4 text-blue-600 shrink-0" />
                                      <span>Histórico de Edições & Alterações no Arquivo — {os.codigo}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-semibold">
                                      Clique na linha para recolher
                                    </span>
                                  </div>

                                  {historyList.length === 0 ? (
                                    <div className="p-3 text-xs text-slate-500 flex items-center gap-2 italic bg-slate-50 rounded-xl">
                                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                      <span>
                                        Operador ({os.operador}) gerou a Ordem de Serviço em {formatDateBR(os.dataVenda)}. Nenhuma edição posterior registrada.
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col space-y-2">
                                      {historyList.map((entry, idx) => (
                                        <div
                                          key={entry.id || idx}
                                          className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-blue-50/50 rounded-xl border border-slate-200/80 transition-colors text-xs"
                                        >
                                          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0 mt-0.5">
                                            <FileEdit className="w-3.5 h-3.5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                              <span className="font-extrabold text-slate-900">
                                                ({entry.perfil || 'Operador'}) <span className="text-blue-700 font-black">{entry.usuario}</span> {entry.acao}
                                              </span>
                                              <span className="text-[10px] font-bold text-slate-500 shrink-0 flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                {entry.dataHora}
                                              </span>
                                            </div>
                                            {entry.detalhes && (
                                              <p className="text-[11px] text-slate-600 mt-1 font-medium leading-relaxed">
                                                {entry.detalhes}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: FULL-SCREEN ORÇAMENTOS MANAGEMENT (ACCESSIBLE FROM OS VIA "ORÇAMENTOS" BUTTON) */}
      {activeView === 'ORCAMENTOS' && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-5 flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1">
                <FileText className="w-3 h-3 text-amber-200" />
                <span>Gestão de Orçamentos & Cotações</span>
              </div>
              <h2 className="text-base font-black tracking-tight">
                Painel de Orçamentos Criados
              </h2>
              <p className="text-xs text-amber-100 font-medium">
                Consulte todos os orçamentos criados. Transforme um orçamento em Ordem de Serviço ou exclua com autorização superior.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('NEW_OS')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>
                  Voltar à Ordem de Serviço
                  <span className="hidden lg:inline"> (F2)</span>
                </span>
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <input
                type="search"
                name="orc_search_filter_term_no_autofill"
                id="orc_search_filter_term_no_autofill"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-form-type="other"
                data-1p-ignore="true"
                readOnly={Boolean(deleteModalOs || transformModalOrc || editOsAuthModal)}
                value={searchTermOs}
                onChange={(e) => handleSearchTermChange(e.target.value)}
                placeholder="Pesquise por Número do Orçamento (ORC...), Cliente, CPF/CNPJ, Vendedor ou Itens..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              {searchTermOs && (
                <button
                  type="button"
                  onClick={() => setSearchTermOs('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={loadData}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
              title="Atualizar lista"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[10px] font-extrabold">
                  <th className="p-3">Código ORC</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Expedição</th>
                  <th className="p-3">Vendedor</th>
                  <th className="p-3 text-right">Valor Final</th>
                  <th className="p-3">Situação</th>
                  <th className="p-3">Data de Entrega</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {osList
                  .filter((os) => (os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento || os.codigo?.startsWith('ORC'))
                  .filter((os) =>
                    os.codigo.toLowerCase().includes(searchTermOs.toLowerCase()) ||
                    os.clienteNome.toLowerCase().includes(searchTermOs.toLowerCase()) ||
                    (os.clienteCpfCnpj && os.clienteCpfCnpj.includes(searchTermOs)) ||
                    (os.operador && os.operador.toLowerCase().includes(searchTermOs.toLowerCase()))
                  ).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <span>Nenhum Orçamento cadastrado ou encontrado.</span>
                    </td>
                  </tr>
                ) : (
                  osList
                    .filter((os) => (os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento || os.codigo?.startsWith('ORC'))
                    .filter((os) =>
                      os.codigo.toLowerCase().includes(searchTermOs.toLowerCase()) ||
                      os.clienteNome.toLowerCase().includes(searchTermOs.toLowerCase()) ||
                      (os.clienteCpfCnpj && os.clienteCpfCnpj.includes(searchTermOs)) ||
                      (os.operador && os.operador.toLowerCase().includes(searchTermOs.toLowerCase()))
                    )
                    .map((orc) => {
                      const isExpanded = expandedOsIds.has(orc.id);
                      const historyList = filterVisibleHistory(orc.historicoEdicoes);

                      return (
                        <React.Fragment key={orc.id}>
                          <tr
                            onClick={() => toggleExpandOs(orc.id)}
                            className={`hover:bg-amber-50/40 transition-colors cursor-pointer ${
                              isExpanded ? 'bg-amber-50/20' : ''
                            }`}
                          >
                            <td className="p-3">
                              <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-mono">
                                {orc.codigo}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600">{formatDateBR(orc.dataVenda)}</td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{orc.clienteNome}</div>
                              {orc.clienteCpfCnpj && (
                                <span className="text-[10px] text-slate-400 font-mono block">{orc.clienteCpfCnpj}</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                  orc.tipoExpedicao === 'EXPRESSO DO DIA'
                                    ? 'bg-rose-100 text-rose-800'
                                    : orc.tipoExpedicao === 'EXPRESSO EXCURSÃO'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                <Truck className="w-3 h-3" />
                                {orc.tipoExpedicao || 'NORMAL'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 font-bold">{orc.operador || '---'}</td>
                            <td className="p-3 text-right font-black text-slate-900">
                              R$ {(orc.valorFinal || 0).toFixed(2)}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                                {orc.status || 'Orçamento Criado'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-700 font-medium">{formatDateBR(orc.prazoEntrega)}</td>
                            <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {/* BOTÃO "GERAR OS" */}
                                <button
                                  type="button"
                                  onClick={() => handleRequestGenerateOs(orc)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                                  title="Transformar este Orçamento em Ordem de Serviço (Requer senha da Direção ou Supervisor)"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-white" />
                                  <span>Gerar OS</span>
                                </button>

                                {/* BOTÃO "IMPRIMIR" */}
                                <button
                                  type="button"
                                  onClick={() => setPrintableOs(orc)}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="Visualizar e Imprimir Orçamento A4"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Imprimir</span>
                                </button>

                                {/* BOTÃO "EDITAR" */}
                                <button
                                  type="button"
                                  onClick={() => handleLoadOsToEdit(orc)}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="Carregar Orçamento para Edição"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Editar</span>
                                </button>

                                {/* BOTÃO "EXCLUIR" */}
                                <button
                                  type="button"
                                  onClick={() => handleRequestDeleteOs(orc)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-all cursor-pointer"
                                  title="Excluir Orçamento (Requer senha de Superior)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* ACCORDION EXPANSION: ITENS AND AUDIT LOG OF ORÇAMENTO */}
                          {isExpanded && (
                            <tr className="bg-slate-50/70">
                              <td colSpan={9} className="p-4 border-b border-slate-200">
                                <div className="space-y-3">
                                  <div>
                                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <Layers className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Itens do Orçamento ({orc.itens?.length || 0})</span>
                                    </h4>

                                    {(!orc.itens || orc.itens.length === 0) ? (
                                      <p className="text-xs text-slate-400 italic">Nenhum item adicionado.</p>
                                    ) : (
                                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                                        <table className="w-full text-xs text-left">
                                          <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                                            <tr>
                                              <th className="p-2">Item</th>
                                              <th className="p-2">Qtd</th>
                                              <th className="p-2">Un</th>
                                              <th className="p-2 text-right">Valor Unit.</th>
                                              <th className="p-2 text-right">Desconto</th>
                                              <th className="p-2 text-right">Total</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                            {orc.itens.map((it) => (
                                              <tr key={it.id} className="hover:bg-slate-50">
                                                <td className="p-2 font-bold text-slate-800">{it.descricao}</td>
                                                <td className="p-2 text-slate-700">{it.quantidade}</td>
                                                <td className="p-2 text-slate-500">{it.unidade}</td>
                                                <td className="p-2 text-right text-slate-700">R$ {(it.valorUnitario || 0).toFixed(2)}</td>
                                                <td className="p-2 text-right text-rose-600">
                                                  {(it.desconto || 0) > 0 ? `- R$ ${(it.desconto || 0).toFixed(2)}` : 'R$ 0,00'}
                                                </td>
                                                <td className="p-2 text-right font-black text-slate-900">
                                                  R$ {(it.total || (it as any).valorTotal || ((it.quantidade || 1) * (it.valorUnitario || 0) - (it.desconto || 0))).toFixed(2)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>

                                  {/* AUDIT LOG FOR ORÇAMENTO */}
                                  <div className="pt-2 border-t border-slate-200">
                                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <History className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Histórico do Orçamento</span>
                                    </h4>

                                    {historyList.length === 0 ? (
                                      <div className="p-3 text-xs text-slate-500 flex items-center gap-2 italic bg-white rounded-xl border border-slate-200">
                                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span>
                                          Vendedor ({orc.operador}) cadastrou o Orçamento em {formatDateBR(orc.dataVenda)}.
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col space-y-2">
                                        {historyList.map((entry, idx) => (
                                          <div
                                            key={entry.id || idx}
                                            className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200/80 text-xs shadow-2xs"
                                          >
                                            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                                              <FileEdit className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <span className="font-extrabold text-slate-900">
                                                  ({entry.perfil || 'Operador'}) <span className="text-amber-700 font-black">{entry.usuario}</span> {entry.acao}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500 shrink-0 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                                                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                  {entry.dataHora}
                                                </span>
                                              </div>
                                              {entry.detalhes && (
                                                <p className="text-[11px] text-slate-600 mt-1 font-medium leading-relaxed">
                                                  {entry.detalhes}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QUICK CLIENT REGISTRATION MODAL (FULL SCREEN) */}
      {showQuickClientModal && (
        <div className="fixed inset-0 top-16 left-0 sm:left-16 z-40 bg-slate-100 p-4 sm:p-6 overflow-y-auto transition-all duration-300">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-5 sm:p-6 max-w-4xl mx-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
                    Cadastrar Novo Cliente
                    <span className="hidden lg:inline"> (F4)</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Sera vinculado diretamente à Ordem de Serviço em andamento
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowQuickClientModal(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              >
                <X className="w-4 h-4" />
                <span>
                  Voltar à OS
                  <span className="hidden lg:inline"> (ESC)</span>
                </span>
              </button>
            </div>

            <form onSubmit={handleSaveQuickClient} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome Completo / Razão Social <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quickClientNome}
                    onChange={(e) => setQuickClientNome(e.target.value)}
                    placeholder="Ex: Empresa Sublimação LTDA"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CPF ou CNPJ</label>
                  <input
                    type="text"
                    value={quickClientDoc}
                    onChange={(e) => setQuickClientDoc(e.target.value)}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telefone / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quickClientPhone}
                    onChange={(e) => setQuickClientPhone(e.target.value)}
                    placeholder="(85) 90000-0000"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={quickClientEmail}
                    onChange={(e) => setQuickClientEmail(e.target.value)}
                    placeholder="cliente@exemplo.com"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowQuickClientModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Cancelar e Voltar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
                >
                  Salvar e Usar na OS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE PREVIEW MODAL */}
      {selectedPreviewImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-4 max-w-2xl w-full relative">
            <button
              type="button"
              onClick={() => setSelectedPreviewImage(null)}
              className="absolute top-3 right-3 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={selectedPreviewImage} alt="Preview Anexo" className="max-h-[80vh] w-full object-contain rounded-2xl" />
          </div>
        </div>
      )}

      {/* DELETE OS/ORC PASSWORD CONFIRMATION MODAL (DEVELOPER & PERMISSÃO EXCLUIR REGISTROS / SUPERIOR) */}
      {deleteModalOs && (
        (() => {
          const isOrc = (deleteModalOs as any).tipoDocumento === 'ORCAMENTO' || (deleteModalOs as any).isOrcamento || deleteModalOs.codigo?.startsWith('ORC');
          return (
            <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete_modal_title"
                className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 max-w-md w-full space-y-4"
              >

                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-10 h-10 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      {isOrc ? 'Excluir Orçamento' : 'Excluir Ordem de Serviço'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-bold">
                      Operação protegida por permissão e senha
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* SUMMARY OF OS/ORC BEING DELETED */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-slate-500">
                      {isOrc ? 'Orçamento' : 'Ordem de Serviço'}
                    </span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-md font-mono ${
                      isOrc ? 'text-amber-800 bg-amber-100 border border-amber-200' : 'text-blue-700 bg-blue-100/80'
                    }`}>
                      {deleteModalOs.codigo}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-bold">Cliente:</span>
                    <strong className="text-slate-900 truncate max-w-[200px]">
                      {deleteModalOs.clienteNome || 'Cliente Geral'}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-bold">Valor Total Final:</span>
                    <strong className="text-slate-950 font-black">
                      R$ {(deleteModalOs.valorFinal || 0).toFixed(2)}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-bold">Data de Emissão:</span>
                    <span className="text-slate-700 font-semibold">
                      {deleteModalOs.dataVenda || 'Não informada'}
                    </span>
                  </div>
                </div>

                {/* DANGER ADVISORY & HIERARCHY */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-950 text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="font-semibold text-[11px] leading-relaxed">
                    A exclusão {isOrc ? 'do Orçamento' : 'da OS'} exige a autorização por senha de um <strong>Superior</strong> (Developer, CEO, Gerente Geral ou Supervisor). A exclusão é definitiva.
                  </p>
                </div>

                {/* ERROR DISPLAY */}
                {deleteError && (
                  <div className="p-3 bg-red-100/90 border border-red-300 rounded-xl text-red-900 text-xs font-extrabold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{deleteError}</span>
                  </div>
                )}

                {/* PASSWORD INPUT WITH SHOW/HIDE */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wide">
                    Senha de Superior Autorizado (Obrigatória)
                  </label>
                  <div className="relative">
                    <input
                      type={showDeletePassword ? 'text' : 'password'}
                      autoFocus
                      autoComplete="one-time-code"
                      name="superior_delete_authorization_pin"
                      id="superior_delete_authorization_pin"
                      data-lpignore="true"
                      data-form-type="other"
                      data-1p-ignore="true"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleConfirmDeleteOs();
                        }
                      }}
                      placeholder="Digite a senha de um Superior (Developer, CEO, Gerente, Supervisor)..."
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      title={showDeletePassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    disabled={isDeletingOs}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmDeleteOs}
                    disabled={isDeletingOs}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isDeletingOs ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Excluindo...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 text-white" />
                        <span>Confirmar Exclusão</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* TRANSFORM ORÇAMENTO INTO OS PASSWORD CONFIRMATION MODAL (DIREÇÃO / SUPERVISOR) */}
      {transformModalOrc && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmGenerateOs();
            }}
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 max-w-md w-full space-y-4"
          >
            {/* Armadilhas dummy ocultas para absorver autofill do navegador sem vazar para a tela de fundo */}
            <input
              type="text"
              name="fake_user_transform_prevent_autofill"
              style={{ display: 'none', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              tabIndex={-1}
              autoComplete="username"
              aria-hidden="true"
              readOnly
            />
            <input
              type="password"
              name="fake_pass_transform_prevent_autofill"
              style={{ display: 'none', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              tabIndex={-1}
              autoComplete="current-password"
              aria-hidden="true"
              readOnly
            />

            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1 px-2 py-0.2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black rounded uppercase">
                  <span>Autorização Superior</span>
                </div>
                <h3 className="text-base font-black text-slate-900 leading-tight mt-0.5">
                  Gerar Ordem de Serviço
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTransformModalOrc(null);
                  setTransformPassword('');
                  setTransformError('');
                  setShowTransformPassword(false);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SUMMARY OF ORÇAMENTO TO BE TRANSFORMED */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-500">Orçamento Origem</span>
                <span className="text-xs font-black text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md font-mono">
                  {transformModalOrc.codigo}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">Cliente:</span>
                <strong className="text-slate-900 truncate max-w-[200px]">
                  {transformModalOrc.clienteNome || 'Cliente Geral'}
                </strong>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">Valor Total Final:</span>
                <strong className="text-emerald-700 font-black text-sm">
                  R$ {(transformModalOrc.valorFinal || 0).toFixed(2)}
                </strong>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">Itens Cadastrados:</span>
                <span className="text-slate-700 font-semibold">
                  {transformModalOrc.itens?.length || 0} item(ns)
                </span>
              </div>
            </div>

            {/* SUPERIOR AUTHORIZATION ADVISORY - EXACT REQUIREMENT */}
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-950 text-xs shadow-2xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <p className="font-extrabold text-amber-900 leading-snug">
                  Como esse orçamento não foi elaborado por você, a conversão dele em uma Ordem de Serviço não está autorizada para o seu perfil. Para fazer essa conversão é necessário a senha da diretoria ou supervisão.
                </p>
                <div className="text-[11px] text-amber-800 font-semibold bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200 inline-flex items-center gap-1.5">
                  <User className="w-3 h-3 text-amber-700" />
                  <span>Vendedor criador do orçamento:</span>
                  <strong className="font-black text-amber-950">{transformModalOrc.operador || transformModalOrc.vendedorNome || 'Vendedor'}</strong>
                </div>
              </div>
            </div>

            {/* ERROR DISPLAY */}
            {transformError && (
              <div className="p-3 bg-red-100/90 border border-red-300 rounded-xl text-red-900 text-xs font-extrabold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{transformError}</span>
              </div>
            )}

            {/* PASSWORD INPUT WITH SHOW/HIDE */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wide">
                Senha da Diretoria / Supervisão (Obrigatória)
              </label>
              <div className="relative">
                <input
                  type={showTransformPassword ? 'text' : 'password'}
                  autoFocus
                  autoComplete="new-password"
                  name="superior_transform_authorization_token"
                  id="superior_transform_authorization_token"
                  data-lpignore="true"
                  data-form-type="other"
                  data-1p-ignore="true"
                  value={transformPassword}
                  onChange={(e) => setTransformPassword(e.target.value)}
                  placeholder="Digite a senha da diretoria ou supervisão..."
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowTransformPassword(!showTransformPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  title={showTransformPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showTransformPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTransformModalOrc(null);
                  setTransformPassword('');
                  setTransformError('');
                  setShowTransformPassword(false);
                }}
                disabled={isTransforming}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isTransforming}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isTransforming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Gerando OS...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    <span>Confirmar & Gerar OS</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT OS AUTHORIZATION PASSWORD MODAL (RESPONSÁVEL PELA OS OU DIRETORIA / SUPERIOR) */}
      {editOsAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmEditOsAuth();
            }}
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4"
          >
            {/* Armadilhas dummy ocultas para absorver autofill do navegador sem vazar para a tela de fundo */}
            <input
              type="text"
              name="fake_user_edit_auth_prevent_autofill"
              style={{ display: 'none', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              tabIndex={-1}
              autoComplete="username"
              aria-hidden="true"
              readOnly
            />
            <input
              type="password"
              name="fake_pass_edit_auth_prevent_autofill"
              style={{ display: 'none', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              tabIndex={-1}
              autoComplete="current-password"
              aria-hidden="true"
              readOnly
            />

            {/* HEADER */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                isOsPago(editOsAuthModal) ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  {isOsPago(editOsAuthModal) ? 'Autorização para Editar OS Paga' : 'Autorização para Editar OS'}
                </h3>
                <p className="text-[11px] text-slate-500 font-bold">
                  {isOsPago(editOsAuthModal)
                    ? 'Operação restrita com pagamento concluído'
                    : 'Acesso restrito ao responsável ou à Direção'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditOsAuthModal(null);
                  setEditOsAuthPassword('');
                  setEditOsAuthError('');
                  setShowEditOsAuthPassword(false);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SUMMARY OF OS */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-500">
                  Ordem de Serviço
                </span>
                <span className="text-xs font-black px-2 py-0.5 rounded-md font-mono text-blue-700 bg-blue-100/80">
                  {editOsAuthModal.codigo}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">Responsável pela OS:</span>
                <strong className="text-slate-950 font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                  {editOsAuthModal.operador || editOsAuthModal.vendedorNome || 'Não informado'}
                </strong>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">Cliente:</span>
                <strong className="text-slate-900 truncate max-w-[200px]">
                  {editOsAuthModal.clienteNome || 'Cliente Geral'}
                </strong>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">Valor Final:</span>
                <strong className="text-slate-950 font-black">
                  R$ {(editOsAuthModal.valorFinal || 0).toFixed(2)}
                </strong>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">Status do Pagamento:</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${
                  isOsPago(editOsAuthModal)
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {isOsPago(editOsAuthModal) ? 'Pago' : (editOsAuthModal.paymentStatus || 'Pendente')}
                </span>
              </div>
            </div>

            {/* ADVISORY */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-950 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="font-semibold text-[11px] leading-relaxed">
                {isOsPago(editOsAuthModal) ? (
                  <>
                    Esta Ordem de Serviço possui status <strong>PAGO</strong>. Para desbloquear a edição, digite a sua senha de autorização (Responsável ou Direção).
                  </>
                ) : (
                  <>
                    Cada responsável pela OS e a Direção possuem senha autorizada para edição. Digite a sua senha para liberar a edição desta Ordem de Serviço.
                  </>
                )}
              </p>
            </div>

            {/* ERROR DISPLAY */}
            {editOsAuthError && (
              <div className="p-3 bg-red-100/90 border border-red-300 rounded-xl text-red-900 text-xs font-extrabold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{editOsAuthError}</span>
              </div>
            )}

            {/* PASSWORD INPUT */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wide">
                Senha de Autorização
              </label>
              <div className="relative">
                <input
                  type={showEditOsAuthPassword ? 'text' : 'password'}
                  autoFocus
                  autoComplete="new-password"
                  name="superior_edit_authorization_token"
                  id="superior_edit_authorization_token"
                  data-lpignore="true"
                  data-form-type="other"
                  data-1p-ignore="true"
                  value={editOsAuthPassword}
                  onChange={(e) => setEditOsAuthPassword(e.target.value)}
                  placeholder="Digite sua senha de autorização..."
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowEditOsAuthPassword(!showEditOsAuthPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  title={showEditOsAuthPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showEditOsAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditOsAuthModal(null);
                  setEditOsAuthPassword('');
                  setEditOsAuthError('');
                  setShowEditOsAuthPassword(false);
                }}
                disabled={isVerifyingEditOsAuth}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isVerifyingEditOsAuth}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isVerifyingEditOsAuth ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Validando...</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4 text-white" />
                    <span>Autorizar Edição</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CLIENT DUPLICATE PENDING OS PROMPT MODAL */}
      {pendingOsPrompt && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center gap-3 text-amber-600 border-b border-slate-200 pb-3">
              <AlertTriangle className="w-6 h-6 shrink-0 text-amber-500" />
              <div>
                <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Atenção: OS em Curso
                </span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mt-0.5">
                  Cliente com Ordem de Serviço Pendente
                </h3>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-700 leading-relaxed bg-amber-50/60 border border-amber-200 p-3.5 rounded-2xl">
              <p className="font-bold text-slate-900">
                Este cliente já possui uma OS em curso (<span className="text-blue-600 font-black">{pendingOsPrompt.pendingOs.codigo}</span>) com status de pagamento <span className="text-amber-700 font-black">PENDENTE</span>.
              </p>
              <p className="text-slate-600">
                O que você deseja fazer? Você pode carregar e editar a OS em curso existente ou continuar para criar uma nova OS separada para este cliente.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingOsPrompt(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingOsPrompt.action === 'TRANSFORM_ORC' && pendingOsPrompt.orcToTransform) {
                    const orc = pendingOsPrompt.orcToTransform;
                    setPendingOsPrompt(null);
                    handleRequestGenerateOs(orc, true);
                  } else {
                    const { client } = pendingOsPrompt;
                    const clientName = getClientDisplayName(client);
                    setSelectedClient(client);
                    setClientSearchText(clientName);
                    setEditingOsId(null);
                    
                    const filteredDocs = osList.filter((o) =>
                      isOrcamentoMode
                        ? (o as any).tipoDocumento === 'ORCAMENTO' || (o as any).isOrcamento || o.codigo?.startsWith('ORC')
                        : (o as any).tipoDocumento !== 'ORCAMENTO' && !(o as any).isOrcamento && !o.codigo?.startsWith('ORC')
                    );
                    const docNumbers = filteredDocs.map((o) => {
                      const match = o.codigo?.match(/\d+/);
                      return match ? parseInt(match[0], 10) : 0;
                    });
                    const nextNum = (docNumbers.length > 0 ? Math.max(...docNumbers) : 0) + 1;
                    setOsCodigo(isOrcamentoMode ? `ORC${String(nextNum).padStart(8, '0')}` : `OS${String(nextNum).padStart(8, '0')}`);
                    
                    setPendingOsPrompt(null);
                  }
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Sim, Continuar (Nova OS)
              </button>
              <button
                type="button"
                onClick={() => {
                  const osToEdit = pendingOsPrompt.pendingOs;
                  setPendingOsPrompt(null);
                  handleRequestEditOs(osToEdit);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar OS ({pendingOsPrompt.pendingOs.codigo})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAIXA OS MODAL */}
      {showCaixaPdvModal && (
        <CaixaOsModal
          os={currentOsForPdv}
          isSidebarExpanded={isSidebarExpanded}
          onClose={() => setShowCaixaPdvModal(false)}
          onPaymentSuccess={() => {
            loadData();
            handleNewOs();
          }}
        />
      )}

      {/* FULL CLIENT MODULE OVERLAY (FULL SCREEN MAINTAINING TOP BAR & LEFT SIDEBAR) */}
      {showFullClientModal && (
        <div className={`fixed inset-0 top-16 ${isSidebarExpanded ? 'left-0 sm:left-64' : 'left-0 sm:left-16'} z-40 bg-slate-100 p-3 sm:p-5 overflow-y-auto transition-all duration-300`}>
          <ClientModuleView
            isModal={false}
            initialClient={editingClient}
            onClose={() => {
              setShowFullClientModal(false);
              setEditingClient(null);
            }}
            onClientSaved={(savedClient) => {
              setSelectedClient(savedClient);
              setShowFullClientModal(false);
              setEditingClient(null);
              loadData();
            }}
          />
        </div>
      )}

      {/* PRINTABLE A4 VIEW */}
      {printableOs && (
        <OsPrintableA4
          os={printableOs}
          onClose={() => setPrintableOs(null)}
        />
      )}

      {/* COREL ART LAYOUT EDITOR MODAL */}
      {showArtEditorModal && (
        <ArtEditorModal
          anexos={anexos}
          osCodigo={osCodigo}
          onSave={async (updated) => {
            setAnexos(updated);
            if (editingOsId) {
              try {
                const existingOs = osList.find((o) => o.id === editingOsId);
                const logged = getLoggedUserAndPerfil();
                const historyEntry = createOsHistoryEntry('alterou imagem / layout das artes');
                const updatedHistory = [historyEntry, ...(existingOs?.historicoEdicoes || [])];

                let setorAceitoPorUpdates = undefined;
                if (existingOs) {
                  const now = new Date();
                  const nowISO = now.toISOString();
                  const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                  
                  setorAceitoPorUpdates = [...(existingOs.setorAceitoPor || [])];
                  setorAceitoPorUpdates.push({
                    estagio: 'Sistema',
                    descricaoEtapa: 'Edição de Layout/Artes',
                    funcionario: logged.name || 'Operador',
                    aceitoEm: dataHoraStr,
                    aceitoEmISO: nowISO,
                    status: 'Concluído',
                    concluidoEm: dataHoraStr,
                    concluidoEmISO: nowISO,
                    observacao: 'Artes/Layouts atualizados.'
                  });
                }

                const updatedOs = await ApiService.updateOs(editingOsId, {
                  anexos: updated,
                  subtotal: subtotalOS,
                  desconto: totalDescontosOS,
                  valorFinal: valorFinalOS,
                  itens: osItens,
                  observacoes,
                  fluxoProducao: selectedStages,
                  historicoEdicoes: updatedHistory,
                  ...(setorAceitoPorUpdates && { setorAceitoPor: setorAceitoPorUpdates })
                });
                setCurrentOsForPdv(updatedOs);
                setOsList((prev) =>
                  prev.map((o) => (o.id === editingOsId ? updatedOs : o))
                );
                if (printableOs && printableOs.id === editingOsId) {
                  setPrintableOs(updatedOs);
                }
                setFeedback({
                  type: 'success',
                  message: `✅ Layout das artes atualizado e salvo na OS "${updatedOs.codigo}" com sucesso!`,
                });
              } catch (err: any) {
                console.error('Erro ao atualizar artes na OS:', err);
              }
            }
          }}
          onClose={() => setShowArtEditorModal(false)}
        />
      )}

      {/* FLOATING DELIVERY & COLLECTION ALERT ON DELIVERY DAY */}
      {(() => {
        const pendingRemindersToday = osList.filter(
          (os) =>
            os.paymentStatus !== 'pago' &&
            isDeliveryDueOrToday(os.prazoEntrega) &&
            !dismissedReminderIds.has(os.id)
        );

        if (pendingRemindersToday.length === 0) return null;

        return (
          <div className="fixed bottom-5 right-5 z-40 max-w-sm w-full bg-white border-2 border-red-500 rounded-3xl p-4 shadow-2xl animate-in slide-in-from-bottom-5 duration-300 space-y-3">
            <div className="flex items-center justify-between border-b border-red-100 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-100 text-red-600 rounded-2xl animate-bounce">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                    Lembrete de Entrega ({pendingRemindersToday.length})
                  </h4>
                  <p className="text-[10px] text-red-600 font-extrabold">
                    OS com entrega hoje/pendente de cobrança
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newSet = new Set(dismissedReminderIds);
                  pendingRemindersToday.forEach((o) => newSet.add(o.id));
                  setDismissedReminderIds(newSet);
                }}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all cursor-pointer"
                title="Dispensar avisos"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {pendingRemindersToday.map((os) => (
                <div
                  key={os.id}
                  className="p-2.5 bg-red-50/80 hover:bg-red-100/60 border border-red-200 rounded-2xl flex items-center justify-between gap-2 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-slate-900 text-xs">{os.codigo}</span>
                      <span className="text-[10px] font-black text-red-700 bg-red-100 px-1.5 py-0.5 rounded-md">
                        R$ {(os.valorFinal ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 font-bold truncate mt-0.5">
                      {os.clienteNome}
                    </p>
                    <p className="text-[10px] text-red-600 font-medium">
                      Entrega: {formatDateBR(os.prazoEntrega)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenWhatsApp(os, 'LEMBRETE_COBRANCA')}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black shrink-0 flex items-center gap-1.5 shadow-sm hover:shadow-md active:scale-95 cursor-pointer transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Enviar Lembrete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* WHATSAPP AUTOMATION FLOATING MODAL */}
      <WhatsAppMessageModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        os={whatsappSelectedOs}
        initialMode={whatsappModalMode}
        customSellerName={loggedOperator}
        onConfirmSent={(osId) => {
          setDismissedReminderIds((prev) => new Set([...prev, osId]));
        }}
      />
    </div>
  );
};
