import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { OrdemServico, OsItem, OsAttachment, ProductionStage, ProductCatalog, TipoExpedicao } from '../../server/types/os';
import { ApiService } from '../../services/api';
import { OsPrintableA4 } from './OsPrintableA4';
import { ArtEditorModal } from './ArtEditorModal';
import { formatDateBR } from '../../utils/formatters';
import { compressImageFile } from '../../utils/imageCompressor';
import {
  getLoggedUserAndPerfil,
  createOsHistoryEntry,
} from '../../utils/userPermissions';
import { NotificationService } from '../../utils/notificationService';
import {
  Search,
  Plus,
  PlusCircle,
  Save,
  Trash2,
  Edit2,
  Edit3,
  Upload,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  Printer,
  Download,
  X,
  RefreshCw,
  Layers,
  ArrowRight,
  ShoppingCart,
  Calendar,
  User,
  CreditCard,
  FileText,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
} from 'lucide-react';

interface OsShopeeModuleViewProps {
  activeMenu?: string;
  isSidebarExpanded?: boolean;
}

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

export const OsShopeeModuleView: React.FC<OsShopeeModuleViewProps> = ({
  activeMenu = 'ordem-servico-shopee',
  isSidebarExpanded = true,
}) => {
  // Navigation & Sub-views
  const [activeView, setActiveView] = useState<'NEW_OS' | 'SEARCH_OS'>('NEW_OS');
  const [editingOsId, setEditingOsId] = useState<string | null>(null);

  // Shopee OS Form State
  const [osCodigo, setOsCodigo] = useState('OSS00000001');
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().split('T')[0]);
  const [osSituacao, setOsSituacao] = useState<'Aberta' | 'Pago'>('Aberta');

  // "ID DO PEDIDO" Block (Replaces "DADOS DO CLIENTE & PRAZO DE ENTREGA")
  const [idPedido, setIdPedido] = useState('');
  const [compradorNome, setCompradorNome] = useState('');
  const [prazoEntrega, setPrazoEntrega] = useState(new Date().toISOString().split('T')[0]);

  // Production Stages Kanban Bar
  const [selectedStages, setSelectedStages] = useState<ProductionStage[]>([
    'Designer',
    'Impressão',
    'Calandra',
    'Costura',
    'SHOPEE',
  ]);
  const [tipoExpedicao, setTipoExpedicao] = useState<TipoExpedicao>('NORMAL');

  // Products & Categories
  const [catalogProducts, setCatalogProducts] = useState<ProductCatalog[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [itemCategoria, setItemCategoria] = useState<string>('ALL');
  const [itemDescricao, setItemDescricao] = useState<string>('');
  const [itemUnidade, setItemUnidade] = useState<string>('UN');
  const [itemQuantidade, setItemQuantidade] = useState<number>(1);
  const [itemValorUnitario, setItemValorUnitario] = useState<number>(0);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<ProductCatalog | null>(null);

  // Items State
  const [osItens, setOsItens] = useState<OsItem[]>([]);

  // Estados para Cálculo de Medidas (Cálculo de Mesa)
  const [comMedidas, setComMedidas] = useState<boolean>(false);
  const [medidaFrente, setMedidaFrente] = useState<string>('');
  const [medidaLateral, setMedidaLateral] = useState<string>('');
  const [medidaAltura, setMedidaAltura] = useState<string>('');
  const [medidaTampo, setMedidaTampo] = useState<string>('');
  const [medidaCaimento, setMedidaCaimento] = useState<string>('');
  const [medidaBabado, setMedidaBabado] = useState<string>('');
  const [medidaQtdBabado, setMedidaQtdBabado] = useState<string>('');
  const [comSobreposicao, setComSobreposicao] = useState<boolean>(false);
  const [precoExpressoActive, setPrecoExpressoActive] = useState<boolean>(false);
  const [selectedFormulaOverride, setSelectedFormulaOverride] = useState<string | null>(null);
  const [expandedMedidasItemIds, setExpandedMedidasItemIds] = useState<Record<string, boolean>>({});

  const toggleMedidasExpand = (itemId: string) => {
    setExpandedMedidasItemIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // Helper para formatar o texto compacto de medidas (ex: 2X1X0,80X0,80X12 ou 2X1,5 (3m²))
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
    if (item.valorBaseCilindro !== undefined || item.tampCilindro !== undefined) {
      const larg = formatDim(item.medidaFrente);
      const alt = formatDim(item.medidaAltura);
      const tamp = formatDim(item.tampCilindro);
      return `Larg ${larg}m × Alt ${alt}m (Tampo: ${tamp}m)`;
    }
    // Se for Cubo
    if ((item as any).calculoCubo || (item.medidaTampo !== undefined && item.medidaTampo > 0)) {
      const m = formatDim(item.medidaFrente);
      const a = formatDim(item.medidaAltura);
      const t = formatDim(item.medidaTampo || item.medidaLateral || item.medidaFrente);
      const c = formatDim(item.calculoCubo || ((Number(item.medidaFrente) || 0) * 4));
      return `Medida ${m}m × Alt ${a}m × Tampo ${t}m (Cálc: ${c}m)`;
    }
    // Se for Mesa Babado (tem qtdBabado ou medidasProducao)
    if (item.qtdBabado || item.medidasProducao) {
      const f = formatDim(item.medidaFrente);
      const l = formatDim(item.medidaLateral);
      const a = formatDim(item.medidaAltura);
      const q = item.qtdBabado;
      return q ? `${f}X${l}X${a} (${q} Babados)` : `${f}X${l}X${a}`;
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

  // Se nenhum dos cálculos foram marcados, o padrão é Altura e Largura Total m²!
  const isAreaPadrao = useMemo(() => {
    if (selectedFormulaOverride === 'padrao_altura_largura') return true;
    if (selectedFormulaOverride) return false;
    return !selectedCatalogProduct?.formulaMedidaId && !selectedCatalogProduct?.formulaMedidaTitulo;
  }, [selectedFormulaOverride, selectedCatalogProduct]);

  // Identifica se é Cálculo Cubo
  const isCuboTable = useMemo(() => {
    if (isAreaPadrao) return false;
    if (selectedFormulaOverride === 'calculo_cubo' || selectedFormulaOverride === 'cubo') return true;
    if (selectedFormulaOverride === 'mesa' || selectedFormulaOverride === 'retro' || selectedFormulaOverride === 'redonda' || selectedFormulaOverride === 'calculo_mesa_babado') return false;
    const desc = (itemDescricao || '').toLowerCase();
    const catDesc = (selectedCatalogProduct?.descricao || '').toLowerCase();
    const fId = (selectedCatalogProduct?.formulaMedidaId || '').toLowerCase();
    const fTitulo = (selectedCatalogProduct?.formulaMedidaTitulo || '').toLowerCase();
    return fId === 'calculo_cubo' || fId.includes('cubo') || fId.includes('veste') || fTitulo.includes('cubo') || fTitulo.includes('mesa veste') || desc.includes('cubo') || desc.includes('mesa veste') || catDesc.includes('cubo') || catDesc.includes('mesa veste');
  }, [isAreaPadrao, selectedFormulaOverride, itemDescricao, selectedCatalogProduct]);

  // Identifica se é Cálculo de Cilindro
  const isCilindroTable = useMemo(() => {
    if (isAreaPadrao) return false;
    if (selectedFormulaOverride === 'calculo_cilindro' || selectedFormulaOverride === 'cilindro') return true;
    if (selectedFormulaOverride === 'mesa' || selectedFormulaOverride === 'retro' || selectedFormulaOverride === 'redonda' || selectedFormulaOverride === 'calculo_mesa_babado' || selectedFormulaOverride === 'calculo_cubo' || selectedFormulaOverride === 'cubo') return false;
    const desc = (itemDescricao || '').toLowerCase();
    const catDesc = (selectedCatalogProduct?.descricao || '').toLowerCase();
    const fId = (selectedCatalogProduct?.formulaMedidaId || '').toLowerCase();
    const fTitulo = (selectedCatalogProduct?.formulaMedidaTitulo || '').toLowerCase();
    return fId === 'calculo_cilindro' || fId.includes('cilindro') || fTitulo.includes('cilindro') || desc.includes('cilindro') || catDesc.includes('cilindro');
  }, [isAreaPadrao, selectedFormulaOverride, itemDescricao, selectedCatalogProduct]);

  // Identifica se é mesa retrô
  const isRetroTable = useMemo(() => {
    if (isAreaPadrao || isCuboTable || isCilindroTable) return false;
    if (selectedFormulaOverride === 'retro') return true;
    if (selectedFormulaOverride === 'mesa' || selectedFormulaOverride === 'redonda') return false;
    const desc = (itemDescricao || '').toLowerCase();
    const catDesc = (selectedCatalogProduct?.descricao || '').toLowerCase();
    const fId = (selectedCatalogProduct?.formulaMedidaId || '').toLowerCase();
    const fTitulo = (selectedCatalogProduct?.formulaMedidaTitulo || '').toLowerCase();
    return fId.includes('retro') || fTitulo.includes('retr') || desc.includes('retr') || catDesc.includes('retr');
  }, [isAreaPadrao, selectedFormulaOverride, itemDescricao, selectedCatalogProduct, isCuboTable, isCilindroTable]);

  // Identifica se é mesa redonda
  const isRoundTable = useMemo(() => {
    if (isAreaPadrao || isRetroTable || isCuboTable || isCilindroTable) return false;
    if (selectedFormulaOverride === 'redonda') return true;
    if (selectedFormulaOverride === 'mesa' || selectedFormulaOverride === 'calculo_mesa_babado') return false;
    const desc = (itemDescricao || '').toLowerCase();
    const catDesc = (selectedCatalogProduct?.descricao || '').toLowerCase();
    const fId = (selectedCatalogProduct?.formulaMedidaId || '').toLowerCase();
    const fTitulo = (selectedCatalogProduct?.formulaMedidaTitulo || '').toLowerCase();
    return fId.includes('redond') || fTitulo.includes('redond') || desc.includes('redond') || catDesc.includes('redond');
  }, [isAreaPadrao, selectedFormulaOverride, itemDescricao, selectedCatalogProduct, isRetroTable, isCuboTable, isCilindroTable]);

  // Identifica se é mesa babado
  const isBabadoTable = useMemo(() => {
    if (isAreaPadrao || isCuboTable || isCilindroTable) return false;
    if (selectedFormulaOverride === 'calculo_mesa_babado' || selectedFormulaOverride === 'babado') return true;
    if (selectedFormulaOverride === 'mesa' || selectedFormulaOverride === 'retro' || selectedFormulaOverride === 'redonda') return false;
    const desc = (itemDescricao || '').toLowerCase();
    const catDesc = (selectedCatalogProduct?.descricao || '').toLowerCase();
    const fId = (selectedCatalogProduct?.formulaMedidaId || '').toLowerCase();
    const fTitulo = (selectedCatalogProduct?.formulaMedidaTitulo || '').toLowerCase();
    return fId === 'calculo_mesa_babado' || fId.includes('babado') || fTitulo.includes('babado') || desc.includes('babado') || catDesc.includes('babado');
  }, [isAreaPadrao, selectedFormulaOverride, itemDescricao, selectedCatalogProduct, isCuboTable, isCilindroTable]);

  // Cálculo da medida exata do babado antes do arredondamento:
  // - Cubo: Medida * 4
  // - Mesa Retrô: ((Frente + 0,5) * 3,14) * 2
  // - Mesa Redonda: (Diâmetro * 3,14) * 2
  // - Mesa Retangular / Babado: ((Frente + Lateral) * 2) * 2
  const calculoBabadoExato = useMemo(() => {
    if (isAreaPadrao || isCilindroTable) return 0;
    if (isCuboTable) {
      const m = parseFloat(String(medidaFrente).replace(',', '.')) || 0;
      return m * 4;
    }
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
    // Mesa Retangular ou Mesa Babado
    return (f > 0 || l > 0) ? ((f + l) * 2) * 2 : 0;
  }, [medidaFrente, medidaLateral, isAreaPadrao, isRetroTable, isRoundTable, isCuboTable]);

  // Cálculo automático da área da mesa ou área padrão (altura * largura) em m²
  const medidaCalculo = useMemo(() => {
    const a = parseFloat(String(medidaAltura).replace(',', '.')) || 0;
    const lRaw = parseFloat(String(medidaLateral || medidaFrente).replace(',', '.')) || 0;

    if (isAreaPadrao) {
      const total = a * lRaw;
      return Math.round(total * 100) / 100;
    }

    if (isCuboTable) {
      const m = parseFloat(String(medidaFrente).replace(',', '.')) || 0;
      const t = parseFloat(String(medidaTampo || medidaFrente).replace(',', '.')) || m;
      const calcPerimetro = m * 4;
      const areaLateral = a * calcPerimetro;
      const areaTampo = t * t;
      const totalArea = areaLateral + areaTampo;
      return Math.round(totalArea * 100) / 100;
    }

    if (isCilindroTable) {
      const larg = parseFloat(String(medidaFrente).replace(',', '.')) || 0;
      const t = larg > 0 ? (larg / 3) : 0;
      const areaBase = larg * a;
      const areaTampo = t * t;
      const totalArea = areaBase + areaTampo;
      return Math.round(totalArea * 100) / 100;
    }

    const f = parseFloat(String(medidaFrente).replace(',', '.')) || 0;
    const l = (isRoundTable && lRaw === 0 && f > 0) ? f : lRaw;
    const c = parseFloat(String(medidaCaimento).replace(',', '.')) || 0;
    const b = parseFloat(String(medidaBabado).replace(',', '.')) || 0;

    if (isBabadoTable) {
      const perimetro = (2 * f) + (2 * l);
      const areaTampo = f * l;
      const areaFaixa = perimetro * a;
      const larguraBabadoUnit = Math.ceil(perimetro * 2);
      const areaBabados = larguraBabadoUnit * a;
      const total = areaTampo + areaFaixa + areaBabados;
      return Math.round(total * 100) / 100;
    }

    // Área da Saia / Babado = Babado * Altura
    const areaBabado = b * a;
    // Área do Tampo com ou sem sobreposição
    const areaTampo = comSobreposicao
      ? (f + c) * (l + c)
      : f * l;

    const total = areaBabado + areaTampo;
    return total > 0 ? Math.ceil(total) : 0;
  }, [medidaFrente, medidaLateral, medidaAltura, medidaTampo, medidaCaimento, medidaBabado, comSobreposicao, isAreaPadrao, isRoundTable, isBabadoTable, isCuboTable]);

  // Auto-cálculo do tamanho do babado:
  // Se for Mesa Retrô: ((frente + 0.5) * 3.14) * 2 sempre arredondado para cima: Math.ceil(((f + 0.5) * 3.14) * 2)
  // Se for Mesa Redonda: (Diâmetro * 3.14) * 2 sempre arredondado para cima: Math.ceil((diametro * 3.14) * 2)
  // Se for Mesa Retangular: ((frente + lateral) * 2) * 2 sempre arredondado para cima: Math.ceil(((f + l) * 2) * 2)
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
  }, [medidaFrente, medidaLateral, comMedidas, isAreaPadrao, isRetroTable, isRoundTable, isBabadoTable]);

  // Cálculos financeiros avançados de medidas (Babado, Tampo, Sobreposição, Com/Sem Sobreposição, ou Padrão Altura × Largura)
  const {
    valorDoBabado,
    valorDoTampo,
    valorDaSobreposicao,
    valorComSobreposicao,
    valorSemSobreposicao,
    valorFinalCalculado,
    valorFaixa,
    valorFaixaBabadoUnitario,
    valorTotalBabados,
    taxaCosturaBabado,
    medidasProducao,
    calculoCubo,
    valorCuboCorpo,
    valorCuboTampo,
    valorBaseCilindro,
    valorTampoCilindro,
    tampCilindro,
  } = useMemo(() => {
    const f = parseFloat(String(medidaFrente).replace(',', '.')) || 0;
    const l = parseFloat(String(medidaLateral).replace(',', '.')) || 0;
    const a = parseFloat(String(medidaAltura).replace(',', '.')) || 0;
    const c = parseFloat(String(medidaCaimento).replace(',', '.')) || 0;
    const bDefault = isRetroTable
      ? (f > 0 ? Math.ceil(((f + 0.5) * 3.14) * 2) : 0)
      : (f > 0 && l > 0 ? Math.ceil(((f + l) * 2) * 2) : 0);
    const b = parseFloat(String(medidaBabado).replace(',', '.')) || bDefault;
    
    // Quando for calcular "Valor m²", busca pelo preço de venda do produto cadastrado:
    // Se "PREÇO EXPRESSO" estiver marcado, utiliza o valor determinado em "ESTOQUE" (precoExpresso)
    const catalogPrecoExpresso = selectedCatalogProduct?.precoExpresso !== undefined && Number(selectedCatalogProduct.precoExpresso) > 0
      ? Number(selectedCatalogProduct.precoExpresso)
      : undefined;
    const catalogPrecoVenda = selectedCatalogProduct?.precoVenda !== undefined && Number(selectedCatalogProduct.precoVenda) > 0
      ? Number(selectedCatalogProduct.precoVenda)
      : (selectedCatalogProduct?.valorUnitario !== undefined && Number(selectedCatalogProduct.valorUnitario) > 0
          ? Number(selectedCatalogProduct.valorUnitario)
          : undefined);
    const effectiveStockPrice = (precoExpressoActive && catalogPrecoExpresso !== undefined)
      ? catalogPrecoExpresso
      : catalogPrecoVenda;
    const valorM2 = (effectiveStockPrice !== undefined ? effectiveStockPrice : (itemValorUnitario > 0 ? itemValorUnitario : 32)) || 32;

    // Se nenhum dos cálculos foram marcados, calcula o padrão: Altura e Largura Total m²!
    if (isAreaPadrao) {
      const aVal = parseFloat(String(medidaAltura).replace(',', '.')) || 0;
      const lVal = parseFloat(String(medidaLateral || medidaFrente).replace(',', '.')) || 0;
      const areaPadrao = Math.round((aVal * lVal) * 100) / 100;
      const valPadrao = valorM2 > 0 && areaPadrao > 0 ? Math.round(areaPadrao * valorM2 * 100) / 100 : 0;
      return {
        valorDoBabado: 0,
        valorDoTampo: 0,
        valorDaSobreposicao: 0,
        valorComSobreposicao: 0,
        valorSemSobreposicao: 0,
        valorFinalCalculado: valPadrao,
        valorFaixa: 0,
        valorFaixaBabadoUnitario: 0,
        valorTotalBabados: 0,
        taxaCosturaBabado: 0,
        medidasProducao: undefined,
        calculoCubo: 0,
        valorCuboCorpo: 0,
        valorCuboTampo: 0,
        valorBaseCilindro: 0,
        valorTampoCilindro: 0,
        tampCilindro: 0,
      };
    }

    if (isCuboTable) {
      // Cálculo Cubo:
      // Medida = m
      // Altura = a
      // Tampo = t (default m)
      // calculo = medida * 4
      // valor = altura * calculo * preço de venda/preço expresso
      // valor tampo = tampo * tampo * preço de venda/preço expresso
      // Total = valor + valor tampo
      const m = parseFloat(String(medidaFrente).replace(',', '.')) || 0;
      const t = parseFloat(String(medidaTampo || medidaFrente).replace(',', '.')) || m;
      // Cláusula de Proteção Contra Regressão: Apenas os valores (R$) são arredondados para cima (Math.ceil).
      // Os cálculos (medidas, perímetro, m²) NÃO são arredondados para cima.
      const calculo = m * 4;
      const valorCorpo = (a > 0 && calculo > 0 && valorM2 > 0)
        ? Math.ceil(a * calculo * valorM2)
        : 0;
      const valorT = (t > 0 && valorM2 > 0)
        ? Math.ceil(t * t * valorM2)
        : 0;
      const totalCubo = (valorCorpo > 0 || valorT > 0) ? (valorCorpo + valorT) : 0;

      return {
        valorDoBabado: valorCorpo,
        valorDoTampo: valorT,
        valorDaSobreposicao: 0,
        valorComSobreposicao: totalCubo,
        valorSemSobreposicao: totalCubo,
        valorFinalCalculado: totalCubo,
        valorFaixa: 0,
        valorFaixaBabadoUnitario: 0,
        valorTotalBabados: valorCorpo,
        taxaCosturaBabado: 0,
        medidasProducao: undefined,
        calculoCubo: calculo,
        valorCuboCorpo: valorCorpo,
        valorCuboTampo: valorT,
        valorBaseCilindro: 0,
        valorTampoCilindro: 0,
        tampCilindro: 0,
      };
    }

    if (isCilindroTable) {
      // Cálculo de Cilindro conforme especificação do usuário:
      // Largura
      // Altura
      // Tampo = Largura / 3
      // valor m² (sem texto "fixo")
      // Valor base = Largura * Altura * m²
      // Valor do Tampo = tampo^2 * m²
      // Valor Total = valor base + valor do tampo (arredonda pra cima)
      const larg = parseFloat(String(medidaFrente).replace(',', '.')) || 0;
      const tampo = larg > 0 ? (larg / 3) : 0;
      const valBase = (larg > 0 && a > 0 && valorM2 > 0) ? (larg * a * valorM2) : 0;
      const valT = (tampo > 0 && valorM2 > 0) ? (tampo * tampo * valorM2) : 0;
      // Cláusula de Proteção Contra Regressão: Apenas os valores (R$) são arredondados para cima (Math.ceil).
      // Os cálculos (medidas, perímetro, m²) NÃO são arredondados para cima.
      const totalCilindro = Math.ceil(valBase + valT);

      return {
        valorDoBabado: valBase,
        valorDoTampo: valT,
        valorDaSobreposicao: 0,
        valorComSobreposicao: totalCilindro,
        valorSemSobreposicao: totalCilindro,
        valorFinalCalculado: totalCilindro,
        valorFaixa: 0,
        valorFaixaBabadoUnitario: 0,
        valorTotalBabados: valBase,
        taxaCosturaBabado: 0,
        medidasProducao: undefined,
        calculoCubo: 0,
        valorCuboCorpo: 0,
        valorCuboTampo: 0,
        valorBaseCilindro: valBase,
        valorTampoCilindro: valT,
        tampCilindro: tampo,
      };
    }

    if (isBabadoTable) {
      const parsedQtd = parseInt(String(medidaQtdBabado || '2'), 10);
      const qtdBabados = Math.max(2, isNaN(parsedQtd) ? 2 : parsedQtd);
      const perimetro = (2 * f) + (2 * l);

      // 1. VALOR DO TAMPO: Frente × Lateral × Preço Metro arredondado para cima (Math.ceil)
      const valTampo = (f > 0 && l > 0 && valorM2 > 0) ? Math.ceil(f * l * valorM2) : 0;

      // 2. FAIXA: Perímetro = (2 × Frente) + (2 × Lateral); Área = Perímetro × Altura; Valor = Math.ceil(Área × Preço Metro)
      const areaFaixa = perimetro * a;
      const valFaixa = (areaFaixa > 0 && valorM2 > 0) ? Math.ceil(areaFaixa * valorM2) : 0;

      // 3. FAIXA DE BABADO (Unitária):
      const larguraBabadoUnit = perimetro > 0 ? Math.ceil(perimetro * 2) : 0;
      const alturaBabadoUnit = (qtdBabados > 0 && a > 0) ? (a / qtdBabados) : 0;
      const valFaixaBabadoUnit = (larguraBabadoUnit > 0 && alturaBabadoUnit > 0 && valorM2 > 0)
        ? Math.ceil(larguraBabadoUnit * alturaBabadoUnit * valorM2)
        : 0;

      // 4. VALOR DE BABADO (TOTAL BABADO): Faixa de Babado × Qtd de Babado
      const valTotalBabados = valFaixaBabadoUnit * qtdBabados;
      const taxaCosturaBabados = qtdBabados > 0 ? (20 * qtdBabados) : 0;
      const finalValMesaBabado = (valTampo > 0 || valFaixa > 0 || valTotalBabados > 0)
        ? (valTampo + valFaixa + valTotalBabados + taxaCosturaBabados)
        : 0;

      // MEDIDAS PARA PRODUÇÃO (Impressão / Corte e Costura)
      // - TAMPO: Mantém Frente × Lateral (com +0.05m de folga de costura) (sem indicação de quantidade)
      // - FAIXA: Mantém Perímetro × Altura (sem indicação de quantidade)
      // - FAIXA DE BABADO: Altura = (Altura / QTD DE BABADOS) + 0,02 (só exibe quantidade sem parênteses quando adicionada a qtd de babados, ex: 2x)
      // - ÚLTIMA FAIXA DE BABADO: Largura = FAIXA*2 (arredonda para cima) | Altura = (Altura / QTD DE BABADO) + 0,07 (1x sem parênteses)
      const hasQtdBabadoInformada = Boolean(medidaQtdBabado && parseInt(medidaQtdBabado, 10) >= 2);
      const qtdFaixaNormal = Math.max(1, qtdBabados - 1);
      const larguraFaixaBabado = (larguraBabadoUnit > 0 && qtdBabados > 0)
        ? `${larguraBabadoUnit.toFixed(2).replace('.', ',')} m`
        : '-';
      const alturaFaixaBabado = (a > 0 && qtdBabados > 0)
        ? `${((a / qtdBabados) + 0.02).toFixed(2).replace('.', ',')} m${hasQtdBabadoInformada ? ` ${qtdFaixaNormal}x` : ''}`
        : '-';

      const larguraUltimaFaixa = (perimetro > 0 && qtdBabados > 0)
        ? `${Math.ceil(perimetro * 2).toFixed(2).replace('.', ',')} m`
        : '-';
      const alturaUltimaFaixa = (a > 0 && qtdBabados > 0)
        ? `${((a / qtdBabados) + 0.07).toFixed(2).replace('.', ',')} m${hasQtdBabadoInformada ? ' 1x' : ''}`
        : '-';

      const medidasProd = {
        tampo: {
          largura: f > 0 ? `${(f + 0.05).toFixed(2).replace('.', ',')} m` : '-',
          altura: l > 0 ? `${(l + 0.05).toFixed(2).replace('.', ',')} m` : '-',
        },
        faixa: {
          largura: perimetro > 0 ? `${perimetro.toFixed(2).replace('.', ',')} m` : '-',
          altura: a > 0 ? `${a.toFixed(2).replace('.', ',')} m` : '-',
        },
        faixaBabado: {
          largura: larguraFaixaBabado,
          altura: alturaFaixaBabado,
        },
        ultimaFaixaBabado: {
          largura: larguraUltimaFaixa,
          altura: alturaUltimaFaixa,
        },
      };

      return {
        valorDoBabado: valTotalBabados,
        valorDoTampo: valTampo,
        valorDaSobreposicao: 0,
        valorComSobreposicao: finalValMesaBabado,
        valorSemSobreposicao: finalValMesaBabado,
        valorFinalCalculado: finalValMesaBabado,
        valorFaixa: valFaixa,
        valorFaixaBabadoUnitario: valFaixaBabadoUnit,
        valorTotalBabados: valTotalBabados,
        taxaCosturaBabado: taxaCosturaBabados,
        medidasProducao: medidasProd,
        calculoCubo: 0,
        valorCuboCorpo: 0,
        valorCuboTampo: 0,
        valorBaseCilindro: 0,
        valorTampoCilindro: 0,
        tampCilindro: 0,
      };
    }

    // 1. VALOR DO BABADO = ARREDONDAR.PARA.CIMA((BABADO * ALTURA * VALOR DO M2); 0)
    const valBabado = Math.ceil(b * a * valorM2);

    // 2. VALOR DO TAMPO = ARREDONDAR.PARA.CIMA((FRENTE * LATERAL * VALOR DO M2); 0)
    const valTampo = Math.ceil(f * l * valorM2);

    // 3. VALOR DA SOBREPOSIÇÃO = ARREDONDAR.PARA.CIMA((SOMA(FRENTE;CAIMENTO)*SOMA(LATERAL;CAIMENTO))*valorM2;0)
    const valSobreposicao = Math.ceil((f + c) * (l + c) * valorM2);

    // 4. VALOR COM SOBREPOSIÇÃO = Babado + Tampo + Sobreposição
    const hasAnyCalc = valBabado > 0 || valTampo > 0 || valSobreposicao > 0;
    const valComSobrep = hasAnyCalc ? (valBabado + (isRetroTable ? 0 : valTampo) + valSobreposicao) : 0;

    // 5. VALOR SEM SOBREPOSIÇÃO = Babado + Tampo
    const hasAnyCalcSem = valBabado > 0 || valTampo > 0;
    const valSemSobrep = hasAnyCalcSem ? (valBabado + valTampo) : 0;

    // 6. VALOR FINAL CONFORME CHECKBOX COM SOBREPOSIÇÃO
    const finalVal = comSobreposicao ? valComSobrep : valSemSobrep;

    return {
      valorDoBabado: valBabado,
      valorDoTampo: valTampo,
      valorDaSobreposicao: valSobreposicao,
      valorComSobreposicao: valComSobrep,
      valorSemSobreposicao: valSemSobrep,
      valorFinalCalculado: finalVal,
      valorFaixa: 0,
      valorFaixaBabadoUnitario: 0,
      valorTotalBabados: valBabado,
      taxaCosturaBabado: 0,
      medidasProducao: undefined,
      calculoCubo: 0,
      valorCuboCorpo: 0,
      valorCuboTampo: 0,
      valorBaseCilindro: 0,
      valorTampoCilindro: 0,
      tampCilindro: 0,
    };
  }, [medidaFrente, medidaLateral, medidaAltura, medidaTampo, medidaCaimento, medidaBabado, medidaQtdBabado, itemValorUnitario, comSobreposicao, precoExpressoActive, selectedCatalogProduct, isAreaPadrao, isRetroTable, isBabadoTable, isCuboTable, isCilindroTable]);

  // Attachments State
  const [anexos, setAnexos] = useState<OsAttachment[]>([]);
  const [showArtEditorModal, setShowArtEditorModal] = useState<boolean>(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  // General Notes
  const [observacoes, setObservacoes] = useState<string>('');

  // Database / OS List
  const [osList, setOsList] = useState<OrdemServico[]>([]);
  const [searchTermOs, setSearchTermOs] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Feedback Notification Toast
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  // Modal Print A4
  const [selectedOsForPrint, setSelectedOsForPrint] = useState<OrdemServico | null>(null);

  // Refs
  const descricaoInputRef = useRef<HTMLInputElement>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (feedback.message) {
      const timer = setTimeout(() => {
        setFeedback({ type: null, message: '' });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Click outside listener for product dropdown
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts (F10 = Registrar Pagamento, F2 = Salvar Aberta)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeView !== 'NEW_OS') return;
      if (e.key === 'F10') {
        e.preventDefault();
        handleRegistrarPagamento();
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleSaveAberta();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Load next OSS sequence code and data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextCodeData, osData, prodData] = await Promise.all([
        ApiService.getNextOsCode('OSS'),
        ApiService.getOrdensServico(),
        ApiService.getProducts().catch(() => []),
      ]);

      if (nextCodeData?.nextCode && !editingOsId) {
        setOsCodigo(nextCodeData.nextCode);
      }

      if (Array.isArray(osData)) {
        setOsList(osData);
      }

      if (Array.isArray(prodData)) {
        setCatalogProducts(prodData);
        // Extract distinct categories only from products marked for sale (excluding internal stock)
        const saleProds = prodData.filter((p: ProductCatalog) => {
          if (p.paraVenda === false || (p as any).apenasEstoqueInterno === true) return false;
          const isInternalCategory = p.categoria && (
            p.categoria.toLowerCase().includes('apenas estoque interno') ||
            p.categoria.toLowerCase() === 'estoque interno'
          );
          if (isInternalCategory && p.paraVenda !== true) return false;
          return true;
        });

        const cats = Array.from(
          new Set(
            saleProds
              .map((p) => p.categoria)
              .filter((c): c is string => Boolean(c && c.trim() && c.trim().toLowerCase() !== 'geral'))
          )
        ).sort();
        setCategories(cats);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados da OS Shopee:', err);
    } finally {
      setIsLoading(false);
    }
  }, [editingOsId]);

  useEffect(() => {
    loadData();
    const handleSync = () => {
      loadData();
    };
    window.addEventListener('products-changed', handleSync);
    window.addEventListener('os-changed', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('products-changed', handleSync);
      window.removeEventListener('os-changed', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [loadData]);

  // Financial Calculations
  const subtotalOS = useMemo(() => {
    return osItens.reduce((acc, it) => acc + (it.valorUnitario * it.quantidade), 0);
  }, [osItens]);

  const totalDescontosOS = useMemo(() => {
    return osItens.reduce((acc, it) => acc + (it.desconto || 0), 0);
  }, [osItens]);

  const valorFinalOS = useMemo(() => {
    return Math.max(0, subtotalOS - totalDescontosOS);
  }, [subtotalOS, totalDescontosOS]);

  // Products available strictly for sale in OS / OSS
  const availableProducts = useMemo(() => {
    return catalogProducts.filter((p) => {
      if (p.paraVenda === false || (p as any).apenasEstoqueInterno === true) return false;
      const isInternalCategory = p.categoria && (
        p.categoria.toLowerCase().includes('apenas estoque interno') ||
        p.categoria.toLowerCase() === 'estoque interno'
      );
      if (isInternalCategory && p.paraVenda !== true) return false;
      return true;
    });
  }, [catalogProducts]);

  // Filter products for dropdown
  const filteredProducts = useMemo(() => {
    let prods = availableProducts;
    if (itemCategoria && itemCategoria !== 'ALL') {
      prods = prods.filter(
        (p) => (p.categoria || '').toLowerCase() === itemCategoria.toLowerCase()
      );
    }
    if (!itemDescricao.trim()) {
      return prods.slice(0, 15);
    }
    const term = itemDescricao.toLowerCase();
    return prods
      .filter(
        (p) =>
          p.descricao.toLowerCase().includes(term) ||
          (p.codigo && p.codigo.toLowerCase().includes(term)) ||
          (p.sku && p.sku.toLowerCase().includes(term)) ||
          (p.referencia && p.referencia.toLowerCase().includes(term)) ||
          (p.codigoBarras && p.codigoBarras.toLowerCase().includes(term))
      )
      .slice(0, 15);
  }, [availableProducts, itemCategoria, itemDescricao]);

  // Helper to normalize strings for comparison (case-insensitive, trims, removes accents)
  const normalizeStr = (s?: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // Check if product is registered in database (strictly among products marked for sale)
  const isProductUnregistered = useMemo(() => {
    if (!itemDescricao.trim()) return false;
    return !availableProducts.some(
      (p) => normalizeStr(p.descricao) === normalizeStr(itemDescricao)
    );
  }, [availableProducts, itemDescricao]);

  // Find matching catalog product based on itemDescricao
  const matchingCatalogProduct = useMemo(() => {
    const queryNorm = normalizeStr(itemDescricao);
    if (!queryNorm) return null;
    return (
      catalogProducts.find((p) => {
        if (p.paraVenda === false || (p as any).apenasEstoqueInterno === true) return false;
        return (
          normalizeStr(p.descricao) === queryNorm ||
          normalizeStr(p.codigo) === queryNorm ||
          normalizeStr(p.sku) === queryNorm ||
          normalizeStr(p.referencia) === queryNorm ||
          normalizeStr(p.codigoBarras) === queryNorm
        );
      }) || null
    );
  }, [itemDescricao, catalogProducts]);

  // Ativa automaticamente "Com Medidas" quando encontra produto com medidas no catálogo
  useEffect(() => {
    if (matchingCatalogProduct) {
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
      const expressPrice = matchingCatalogProduct.precoExpresso !== undefined && Number(matchingCatalogProduct.precoExpresso) > 0
        ? Number(matchingCatalogProduct.precoExpresso)
        : undefined;
      const standardPrice = matchingCatalogProduct.valorUnitario !== undefined && Number(matchingCatalogProduct.valorUnitario) > 0
        ? Number(matchingCatalogProduct.valorUnitario)
        : (matchingCatalogProduct.precoVenda ? Number(matchingCatalogProduct.precoVenda) : undefined);
      const chosenPrice = (precoExpressoActive && expressPrice !== undefined) ? expressPrice : standardPrice;
      if (chosenPrice !== undefined && chosenPrice > 0) {
        setItemValorUnitario(chosenPrice);
      }
    }
  }, [matchingCatalogProduct, itemUnidade, precoExpressoActive]);

  // Ativa automaticamente "Com Medidas" ao selecionar categoria que possua produtos com medidas
  useEffect(() => {
    if (itemCategoria && itemCategoria !== 'ALL') {
      const catNorm = normalizeStr(itemCategoria);
      const catHasMedidas = catalogProducts.some(
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
  }, [itemCategoria, catalogProducts, itemUnidade]);

  // Handle select catalog product
  const handleSelectCatalogProduct = (prod: ProductCatalog) => {
    setSelectedCatalogProduct(prod);
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
    if (prod.categoria) {
      setItemCategoria(prod.categoria);
    }
    if (hasMedidas) {
      setComMedidas(true);
    }
    // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
    // Sincroniza a fórmula de medida do produto com o seletor. Se não tiver fórmula (desmarcado),
    // define expressamente como 'padrao_altura_largura' para que nenhum cálculo residual seja herdado.
    if (prod.formulaMedidaId) {
      setSelectedFormulaOverride(prod.formulaMedidaId);
    } else {
      setSelectedFormulaOverride('padrao_altura_largura');
    }
    // Limpa todo o campo de medidas ao selecionar o produto
    setMedidaFrente('');
    setMedidaLateral('');
    setMedidaAltura('');
    setMedidaCaimento('');
    setMedidaBabado('');
    setMedidaQtdBabado('');
    setComSobreposicao(false);
    setShowProductDropdown(false);
  };

  // Toggle stage in Kanban flow
  const toggleStage = (stage: ProductionStage) => {
    const isDestination = ['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)'].includes(
      stage as string
    );

    setSelectedStages((prev) => {
      if (isDestination) {
        // Only one destination stage at the end
        const withoutDests = prev.filter(
          (s) => !['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)'].includes(s as string)
        );
        if (prev.includes(stage)) {
          return withoutDests;
        } else {
          return [...withoutDests, stage];
        }
      } else {
        if (prev.includes(stage)) {
          return prev.filter((s) => s !== stage);
        } else {
          // Insert fabrication stages before destinations
          const dests = prev.filter((s) =>
            ['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)'].includes(s as string)
          );
          const nonDests = prev.filter(
            (s) => !['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)'].includes(s as string)
          );
          return [...nonDests, stage, ...dests];
        }
      }
    });
  };

  // Add or update item
  const handleAddOrUpdateProduct = () => {
    const desc = itemDescricao.trim();
    if (!desc) {
      setFeedback({ type: 'error', message: 'Informe a descrição do produto.' });
      return;
    }
    if (itemQuantidade <= 0) {
      setFeedback({ type: 'error', message: 'A quantidade deve ser maior que zero.' });
      return;
    }

    const effectiveItemPrice = comMedidas && valorFinalCalculado > 0 ? valorFinalCalculado : itemValorUnitario;
    const effectiveMultiplier = comMedidas ? (valorFinalCalculado > 0 ? 1 : (medidaCalculo > 0 ? medidaCalculo : 1)) : 1;
    const itemTotal = Number((effectiveItemPrice * effectiveMultiplier * itemQuantidade).toFixed(2));

    if (editingItemId) {
      setOsItens((prev) =>
        prev.map((it) =>
          it.id === editingItemId
            ? {
                ...it,
                descricao: desc,
                unidade: itemUnidade,
                quantidade: itemQuantidade,
                valorUnitario: effectiveItemPrice,
                precoMedio: effectiveItemPrice,
                total: itemTotal,
                comMedidas,
                medidaFrente: comMedidas ? parseFloat(String(medidaFrente).replace(',', '.')) || 0 : undefined,
                medidaLateral: comMedidas ? parseFloat(String(medidaLateral).replace(',', '.')) || 0 : undefined,
                medidaAltura: comMedidas ? parseFloat(String(medidaAltura).replace(',', '.')) || 0 : undefined,
                medidaCaimento: comMedidas ? parseFloat(String(medidaCaimento).replace(',', '.')) || 0 : undefined,
                medidaBabado: comMedidas ? parseFloat(String(medidaBabado).replace(',', '.')) || 0 : undefined,
                medidaCalculo: comMedidas ? medidaCalculo : undefined,
                comSobreposicao: comMedidas ? comSobreposicao : undefined,
                valorBabado: comMedidas ? valorDoBabado : undefined,
                valorTampo: comMedidas ? valorDoTampo : undefined,
                valorSobreposicao: comMedidas ? valorDaSobreposicao : undefined,
                qtdBabado: comMedidas && isBabadoTable ? Math.max(2, parseInt(medidaQtdBabado || '2', 10) || 2) : undefined,
                valorFaixa: comMedidas && isBabadoTable ? valorFaixa : undefined,
                valorFaixaBabado: comMedidas && isBabadoTable ? valorFaixaBabadoUnitario : undefined,
                medidasProducao: comMedidas && isBabadoTable ? medidasProducao : undefined,
                precoExpresso: precoExpressoActive,
                medidaTampo: comMedidas && isCuboTable ? (parseFloat(String(medidaTampo || medidaFrente).replace(',', '.')) || 0) : (comMedidas && isCilindroTable ? (tampCilindro || 0) : undefined),
                valorCubo: comMedidas && isCuboTable ? valorCuboCorpo : undefined,
                calculoCubo: comMedidas && isCuboTable ? calculoCubo : undefined,
                valorBaseCilindro: comMedidas && isCilindroTable ? valorBaseCilindro : undefined,
                valorTampoCilindro: comMedidas && isCilindroTable ? valorTampoCilindro : undefined,
                tampCilindro: comMedidas && isCilindroTable ? tampCilindro : undefined,
              }
            : it
        )
      );
      setEditingItemId(null);
    } else {
      const newItem: OsItem = {
        id: `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        codigo: selectedCatalogProduct?.codigo || `PROD-${Date.now()}`,
        descricao: desc,
        categoria: selectedCatalogProduct?.categoria || (itemCategoria !== 'ALL' ? itemCategoria : 'Geral'),
        unidade: itemUnidade,
        quantidade: itemQuantidade,
        valorUnitario: effectiveItemPrice,
        precoMedio: effectiveItemPrice,
        desconto: 0,
        total: itemTotal,
        comMedidas,
        medidaFrente: comMedidas ? parseFloat(String(medidaFrente).replace(',', '.')) || 0 : undefined,
        medidaLateral: comMedidas ? parseFloat(String(medidaLateral).replace(',', '.')) || 0 : undefined,
        medidaAltura: comMedidas ? parseFloat(String(medidaAltura).replace(',', '.')) || 0 : undefined,
        medidaCaimento: comMedidas ? parseFloat(String(medidaCaimento).replace(',', '.')) || 0 : undefined,
        medidaBabado: comMedidas ? parseFloat(String(medidaBabado).replace(',', '.')) || 0 : undefined,
        qtdBabado: comMedidas && isBabadoTable ? Math.max(2, parseInt(medidaQtdBabado || '2', 10) || 2) : undefined,
        valorFaixa: comMedidas && isBabadoTable ? valorFaixa : undefined,
        valorFaixaBabado: comMedidas && isBabadoTable ? valorFaixaBabadoUnitario : undefined,
        medidasProducao: comMedidas && isBabadoTable ? medidasProducao : undefined,
        medidaCalculo: comMedidas ? medidaCalculo : undefined,
        comSobreposicao: comMedidas ? comSobreposicao : undefined,
        valorBabado: comMedidas ? valorDoBabado : undefined,
        valorTampo: comMedidas ? valorDoTampo : undefined,
        valorSobreposicao: comMedidas ? valorDaSobreposicao : undefined,
        precoExpresso: precoExpressoActive,
        medidaTampo: comMedidas && isCuboTable ? (parseFloat(String(medidaTampo || medidaFrente).replace(',', '.')) || 0) : (comMedidas && isCilindroTable ? (tampCilindro || 0) : undefined),
        valorCubo: comMedidas && isCuboTable ? valorCuboCorpo : undefined,
        calculoCubo: comMedidas && isCuboTable ? calculoCubo : undefined,
        valorBaseCilindro: comMedidas && isCilindroTable ? valorBaseCilindro : undefined,
        valorTampoCilindro: comMedidas && isCilindroTable ? valorTampoCilindro : undefined,
        tampCilindro: comMedidas && isCilindroTable ? tampCilindro : undefined,
      };
      setOsItens((prev) => [...prev, newItem]);
    }

    // Reset item form
    setItemDescricao('');
    setItemQuantidade(1);
    setItemValorUnitario(0);
    setItemUnidade('UN');
    setComMedidas(false);
    setPrecoExpressoActive(false);
    setMedidaFrente('');
    setMedidaLateral('');
    setMedidaAltura('');
    setMedidaCaimento('');
    setMedidaBabado('');
    setMedidaQtdBabado('');
    setComSobreposicao(false);
    setSelectedCatalogProduct(null);
    setSelectedFormulaOverride(null);
    setShowProductDropdown(false);
    if (descricaoInputRef.current) {
      descricaoInputRef.current.focus();
    }
  };

  const handleEditItem = (it: OsItem) => {
    setEditingItemId(it.id);
    setItemDescricao(it.descricao);
    setItemUnidade(it.unidade || 'UN');
    setItemQuantidade(it.quantidade);
    setItemValorUnitario(it.valorUnitario);
    if (it.categoria) setItemCategoria(it.categoria);
    setPrecoExpressoActive(Boolean(it.precoExpresso));
    if (it.comMedidas) {
      setComMedidas(true);
      setMedidaFrente(it.medidaFrente !== undefined ? String(it.medidaFrente) : '');
      setMedidaLateral(it.medidaLateral !== undefined ? String(it.medidaLateral) : '');
      setMedidaAltura(it.medidaAltura !== undefined ? String(it.medidaAltura) : '');
      setMedidaCaimento(it.medidaCaimento !== undefined ? String(it.medidaCaimento) : '');
      setMedidaBabado(it.medidaBabado !== undefined ? String(it.medidaBabado) : '');
      setMedidaQtdBabado(it.qtdBabado !== undefined ? String(it.qtdBabado) : '');
      setComSobreposicao(Boolean(it.comSobreposicao));
      if (it.qtdBabado) {
        setSelectedFormulaOverride('calculo_mesa_babado');
      } else if (!it.medidaBabado && !it.medidaCaimento) {
        setSelectedFormulaOverride('padrao_altura_largura');
      } else {
        setSelectedFormulaOverride(null);
      }
    } else {
      setComMedidas(false);
      setMedidaQtdBabado('');
      setSelectedFormulaOverride(null);
    }
    window.scrollTo({ top: 300, behavior: 'smooth' });
    if (descricaoInputRef.current) {
      descricaoInputRef.current.focus();
    }
  };

  const handleDeleteItem = (itemId: string) => {
    setOsItens((prev) => prev.filter((it) => it.id !== itemId));
  };

  // Handle Upload Artes
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newAttachments: OsAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedBase64 = await compressImageFile(file);
        newAttachments.push({
          id: `ART-${Date.now()}-${i}`,
          fileName: file.name,
          fileUrl: compressedBase64,
          fileSize: `${(file.size / 1024).toFixed(1)} KB`,
          type: 'ARTE',
          uploadedAt: new Date().toISOString(),
        });
      }
      setAnexos((prev) => [...prev, ...newAttachments]);
      setFeedback({ type: 'success', message: `${newAttachments.length} arte(s) anexada(s)!` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar anexo.' });
    } finally {
      e.target.value = '';
    }
  };

  // Handle Upload Para Impressão
  const handleFileUploadParaImpressao = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newAttachments: OsAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedBase64 = await compressImageFile(file);
        newAttachments.push({
          id: `IMP-${Date.now()}-${i}`,
          fileName: file.name,
          fileUrl: compressedBase64,
          fileSize: `${(file.size / 1024).toFixed(1)} KB`,
          type: 'PARA_IMPRESSAO',
          isParaImpressao: true,
          label: 'Para Impressão',
          uploadedAt: new Date().toISOString(),
        });
      }
      setAnexos((prev) => [...prev, ...newAttachments]);
      setFeedback({ type: 'success', message: `${newAttachments.length} arquivo(s) de impressão anexado(s)!` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar arquivo de impressão.' });
    } finally {
      e.target.value = '';
    }
  };

  // Download Attachment
  const handleDownloadAttachment = (attachment: OsAttachment) => {
    const link = document.createElement('a');
    link.href = attachment.fileUrl;
    link.download = attachment.fileName || 'arte-shopee.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset form for new OSS
  const handleNewOs = async () => {
    setEditingOsId(null);
    setIdPedido('');
    setCompradorNome('');
    setDataVenda(new Date().toISOString().split('T')[0]);
    setPrazoEntrega(new Date().toISOString().split('T')[0]);
    setOsSituacao('Aberta');
    setSelectedStages([
      'Designer',
      'Impressão',
      'Calandra',
      'Costura',
      'SHOPEE',
    ]);
    setTipoExpedicao('NORMAL');
    setOsItens([]);
    setAnexos([]);
    setObservacoes('');
    setItemDescricao('');
    setItemQuantidade(1);
    setItemValorUnitario(0);
    setEditingItemId(null);
    setActiveView('NEW_OS');

    try {
      const res = await ApiService.getNextOsCode('OSS');
      if (res?.nextCode) {
        setOsCodigo(res.nextCode);
      }
    } catch {}
  };

  // =========================================================================
  // CORE ACTION: "REGISTRAR PAGAMENTO"
  // As requested by user:
  // - Retires "Novo Cliente (F4)"
  // - Replaces "Buscar Cliente..." with "ID DO PEDIDO"
  // - Removes "Pagar no Caixa PDV (F10)"
  // - Includes Button "REGISTRAR PAGAMENTO":
  //   Validates items and ID do Pedido, saves order with status "PAGO" (paymentStatus: 'pago')
  //   and displays the exact message: "PAGAMENTO REGISTRADO COM SUCESSO"
  // =========================================================================
  const handleRegistrarPagamento = async () => {
    // 1. Validation: ID do Pedido Shopee is mandatory
    const cleanIdPedido = idPedido.trim();
    if (!cleanIdPedido) {
      setFeedback({
        type: 'error',
        message: 'Atenção: Por favor, informe o "ID DO PEDIDO" da Shopee para registrar o pagamento.',
      });
      return;
    }

    // 2. Validation: At least 1 item
    if (osItens.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Atenção: Adicione pelo menos 1 item à Ordem de Serviço Shopee.',
      });
      return;
    }

    const { role, name } = getLoggedUserAndPerfil();
    const cleanBuyer = compradorNome.trim();
    const clientDisplayName = cleanBuyer
      ? `${cleanBuyer} (Shopee ID: ${cleanIdPedido})`
      : `Shopee - Pedido #${cleanIdPedido}`;

    const clientEnderecoStr = 'Plataforma Shopee Brasil (Marketplace)';
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
      codigo: editingOsId ? osCodigo : undefined,
      operador: name || 'Vendedora Shopee',
      vendedorNome: name || 'Vendedora Shopee',
      editorPerfil: role,
      updatedBy: name,
      clienteId: `CLI-SHOPEE-${cleanIdPedido}`,
      clienteNome: clientDisplayName,
      clienteCpfCnpj: 'SHOPEE-MARKETPLACE',
      clienteTelefone: 'Shopee App',
      clienteEmail: 'pedidos@shopee.com.br',
      clienteEndereco: clientEnderecoStr,
      prazoEntrega: new Date(prazoEntrega).toLocaleDateString('pt-BR'),
      fluxoProducao: selectedStages,
      tipoExpedicao,
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

      // Update state
      setOsList((prev) => [savedOs, ...prev.filter((o) => o.id !== savedOs.id)]);
      setOsSituacao('Pago');

      // Send production notification
      const nextSector = selectedStages.length > 1 ? selectedStages[1] : 'Designer';
      NotificationService.notifyOsCreated(savedOs, name || 'Vendedora Shopee', nextSector);

      // EXACT CONFIRMATION MESSAGE REQUESTED: "PAGAMENTO REGISTRADO COM SUCESSO"
      setFeedback({
        type: 'success',
        message: 'PAGAMENTO REGISTRADO COM SUCESSO',
      });

      // Reset form and prepare next OSS
      setTimeout(() => {
        handleNewOs();
      }, 1800);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao registrar pagamento da Ordem de Serviço Shopee.',
      });
    }
  };

  // Optional: Save as draft / Aberta (without finalizing payment)
  const handleSaveAberta = async () => {
    const cleanIdPedido = idPedido.trim();
    if (!cleanIdPedido) {
      setFeedback({
        type: 'error',
        message: 'Atenção: Por favor, informe o "ID DO PEDIDO" da Shopee.',
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

    const { role, name } = getLoggedUserAndPerfil();
    const cleanBuyer = compradorNome.trim();
    const clientDisplayName = cleanBuyer
      ? `${cleanBuyer} (Shopee ID: ${cleanIdPedido})`
      : `Shopee - Pedido #${cleanIdPedido}`;

    const payload: Partial<OrdemServico> & { [key: string]: any } = {
      tipoDocumento: 'OSS',
      isShopee: true,
      shopeePedidoId: cleanIdPedido,
      idPedido: cleanIdPedido,
      codigo: editingOsId ? osCodigo : undefined,
      operador: name || 'Vendedora Shopee',
      vendedorNome: name || 'Vendedora Shopee',
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
      tipoExpedicao,
      destinoExpedicao: 'SHOPEE',
      itens: osItens,
      anexos,
      observacoes: observacoes ? `[ID PEDIDO SHOPEE: ${cleanIdPedido}] ${observacoes}` : `[ID PEDIDO SHOPEE: ${cleanIdPedido}]`,
      subtotal: subtotalOS,
      desconto: totalDescontosOS,
      valorFinal: valorFinalOS,
      formaPagamento: 'Plataforma Shopee',
      paymentStatus: 'pendente',
      status: 'Aberta' as any,
      situacao: 'Aberta' as any,
      estagioAtual: 'Designer',
    };

    try {
      let savedOs: OrdemServico;
      if (editingOsId) {
        savedOs = await ApiService.updateOs(editingOsId, payload);
      } else {
        savedOs = await ApiService.createOs(payload as any);
      }
      setOsList((prev) => [savedOs, ...prev.filter((o) => o.id !== savedOs.id)]);
      setFeedback({
        type: 'success',
        message: `✅ Ordem de Serviço Shopee "${savedOs.codigo}" salva com sucesso!`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao salvar a Ordem de Serviço Shopee.',
      });
    }
  };

  // Open existing OSS for edit
  const handleEditOss = (os: OrdemServico) => {
    setEditingOsId(os.id);
    setOsCodigo(os.codigo);
    setDataVenda(os.dataVenda || new Date().toISOString().split('T')[0]);
    setIdPedido((os as any).shopeePedidoId || (os as any).idPedido || '');
    setCompradorNome(
      os.clienteNome.replace(/\(Shopee ID: .*\)/i, '').replace(/Shopee - Pedido #.*/i, '').trim()
    );
    setOsSituacao(os.paymentStatus === 'pago' ? 'Pago' : 'Aberta');
    setSelectedStages(os.fluxoProducao || PRODUCTION_STAGES_ALL);
    setTipoExpedicao(os.tipoExpedicao || 'NORMAL');
    setOsItens(os.itens || []);
    setAnexos(os.anexos || []);
    setObservacoes(os.observacoes?.replace(/\[ID PEDIDO SHOPEE: .*?\] /i, '') || '');
    setActiveView('NEW_OS');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filtered OSS List for Search View
  const filteredOssList = useMemo(() => {
    return osList.filter((os) => {
      const isOss =
        (os as any).tipoDocumento === 'OSS' ||
        (os as any).isShopee === true ||
        os.codigo?.toUpperCase().startsWith('OSS') ||
        (os as any).shopeePedidoId;
      if (!isOss) return false;

      if (!searchTermOs.trim()) return true;
      const term = searchTermOs.toLowerCase();
      return (
        os.codigo.toLowerCase().includes(term) ||
        os.clienteNome.toLowerCase().includes(term) ||
        ((os as any).shopeePedidoId && (os as any).shopeePedidoId.toLowerCase().includes(term))
      );
    });
  }, [osList, searchTermOs]);

  return (
    <div className="space-y-4 font-sans select-none pb-12">
      {/* MODULE HEADER BAR */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl shadow-xs">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                ORDEM DE SERVIÇO SHOPEE
              </h1>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold rounded-full">
                🛍️ Shopee Marketplace
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Lançamento exclusivo de pedidos de sublimação e confecção da Shopee (OSS).
            </p>
          </div>
        </div>

        {/* TOP CONTROLS & CODE BADGE */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* BUTTON 1: NOVA OSS */}
          <button
            type="button"
            onClick={handleNewOs}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              activeView === 'NEW_OS'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>NOVA OSS</span>
          </button>

          {/* BUTTON 2: PESQUISAR OSS */}
          <button
            type="button"
            onClick={() => setActiveView('SEARCH_OS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              activeView === 'SEARCH_OS'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <Search className="w-4 h-4 text-amber-600" />
            <span>PESQUISAR OSS</span>
            {filteredOssList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black">
                {filteredOssList.length}
              </span>
            )}
          </button>

          {/* RIGHT BOX: OSS NUMBER & DATE & STATUS */}
          <div className="bg-slate-50 text-slate-800 p-2 px-3 rounded-xl border border-slate-200 flex items-center gap-3 text-xs shrink-0 shadow-2xs">
            <div>
              <span className="block text-[9px] uppercase text-amber-600 font-black">Número da OSS</span>
              <strong className="text-sm font-extrabold text-slate-900">{osCodigo}</strong>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="block text-[9px] uppercase text-amber-600 font-black">Data Emissão</span>
              <span className="text-xs font-bold text-slate-900">{formatDateBR(dataVenda)}</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="block text-[9px] uppercase text-amber-600 font-black">Status</span>
              <span className={`text-xs font-extrabold ${osSituacao === 'Pago' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {osSituacao}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING FEEDBACK TOAST */}
      {feedback.message && (
        <div
          role="status"
          className="fixed top-5 right-5 z-50 max-w-md animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto shadow-xl"
        >
          <div
            className={`p-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 border backdrop-blur-md transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-900/20'
                : 'bg-rose-500 text-white border-rose-600 shadow-rose-900/20'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-white shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: NEW OSS FORM (IDENTICAL TO OS MODULE AND SCREENSHOT) */}
      {/* ========================================================================= */}
      {activeView === 'NEW_OS' && (
        <div className="space-y-3.5">
          {/* BLOCK 1: DADOS DO CLIENTE & PRAZO DE ENTREGA (WITH EXACT USER SUBSTITUTION: ID DO PEDIDO & WITHOUT NOVO CLIENTE F4) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs space-y-2.5">
            {/* CARD TITLE HEADER - NO "NOVO CLIENTE (F4)" BUTTON PER REQUEST */}
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                <span>DADOS DO CLIENTE & PRAZO DE ENTREGA</span>
              </h2>
            </div>

            {/* ROW: ID DO PEDIDO (8 COLS) + PRAZO DE ENTREGA (4 COLS) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
              {/* CAMPO SUBSTITUTO: ID DO PEDIDO (8 COLS) */}
              <div className="md:col-span-8 relative">
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                  ID DO PEDIDO <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={idPedido}
                    onChange={(e) => setIdPedido(e.target.value)}
                    placeholder="Digite ou cole o ID do Pedido Shopee (Ex: 240501ABC123)..."
                    className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none shadow-2xs"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
                  {idPedido && (
                    <button
                      type="button"
                      onClick={() => setIdPedido('')}
                      className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* PRAZO DE ENTREGA PROMETIDO (4 COLS) */}
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

            {/* FLUXO DE PRODUÇÃO KANBAN (PROGRESS BAR COM 8 ESTÁGIOS OFICIAIS) */}
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

                  if (stage === 'Designer') {
                    activeStyles = 'border-2 border-purple-600 text-purple-700';
                  } else if (stage === 'Impressão') {
                    activeStyles = 'border-2 border-blue-600 text-blue-700';
                  } else if (stage === 'Calandra') {
                    activeStyles = 'border-2 border-amber-500 text-amber-800';
                  } else if (stage === 'Costura') {
                    activeStyles = 'border-2 border-rose-600 text-rose-700';
                  } else if (stage === 'EXCURSÃO') {
                    activeStyles = 'border-2 border-red-600 text-red-700';
                  } else if (stage === 'CORREIOS') {
                    activeStyles = 'border-2 border-amber-600 text-amber-800';
                  } else if (stage === 'SHOPEE') {
                    activeStyles = 'border-2 border-orange-600 text-orange-700';
                  } else if (stage === 'RETIRADA(Recepção)') {
                    activeStyles = 'border-2 border-emerald-600 text-emerald-800';
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
                    <ShoppingBag className="w-4 h-4" />
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

              {/* SEQUÊNCIA ATIVA DO FLUXO DEFINIDO */}
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
          </div>

          {/* BLOCK 2: INCLUSÃO DE PRODUTOS / SERVIÇOS (IDENTICAL TO SCREENSHOT) */}
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
                {comMedidas && !isAreaPadrao && !isCilindroTable && !isCuboTable && (
                  <label
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer border select-none ${
                      comSobreposicao
                        ? 'bg-red-600 text-white border-red-700 shadow-2xs ring-2 ring-red-300'
                        : 'bg-red-500 text-white border-red-600 hover:bg-red-600'
                    }`}
                    title="Marcar para incluir o valor de sobreposição no valor final da peça"
                  >
                    <input
                      type="checkbox"
                      checked={comSobreposicao}
                      onChange={(e) => setComSobreposicao(e.target.checked)}
                      className="w-3.5 h-3.5 text-red-600 rounded border-red-300 focus:ring-red-500 cursor-pointer accent-white"
                    />
                    <span className="text-white">com sobreposição</span>
                  </label>
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
                      if (selectedCatalogProduct) {
                        const expressPrice = selectedCatalogProduct.precoExpresso !== undefined && Number(selectedCatalogProduct.precoExpresso) > 0
                          ? Number(selectedCatalogProduct.precoExpresso)
                          : undefined;
                        const standardPrice = selectedCatalogProduct.valorUnitario !== undefined && Number(selectedCatalogProduct.valorUnitario) > 0
                          ? Number(selectedCatalogProduct.valorUnitario)
                          : (selectedCatalogProduct.precoVenda || 0);
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
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  ENTER para Adicionar Item
                </span>
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
                        const catProducts = catalogProducts.filter(
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
                        } else if (firstWithPrice && (itemValorUnitario === 0 || !itemDescricao.trim())) {
                          setItemValorUnitario(firstWithPrice.valorUnitario || 0);
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
                        const matched = catalogProducts.find((p) => {
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
                        if (matched && matched.valorUnitario !== undefined && matched.valorUnitario > 0) {
                          setItemValorUnitario(Number(matched.valorUnitario));
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

                  {/* INTELLIGENT PRODUCT DROPDOWN */}
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

            {/* PAINEL DE CÁLCULO DE MEDIDAS (FRENTE, LATERAL, ALTURA, CAIMENTO, BABADO, CÁLCULO OU PADRÃO ALTURA × LARGURA) */}
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
                          placeholder="0"
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
                          placeholder="0"
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
                        >
                          R$ {(valorFinalCalculado > 0 ? valorFinalCalculado : (medidaCalculo * itemValorUnitario)).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Resumo visual do cálculo padrão */}
                    <div className="text-[11px] font-bold text-blue-950 bg-white/90 border border-blue-200 rounded-xl px-3 py-1.5 flex items-center justify-between flex-wrap gap-2">
                      <span>
                        Dimensões: <strong>{medidaAltura || '0'}m (Alt) × {medidaLateral || medidaFrente || '0'}m (Larg)</strong> = <strong className="text-blue-700 font-extrabold">{medidaCalculo > 0 ? `${medidaCalculo.toFixed(2).replace('.', ',')} m²` : '0,00 m²'}</strong>
                      </span>
                      <span>
                        Valor da Peça: <strong className="text-emerald-700 font-black">R$ {(valorFinalCalculado > 0 ? valorFinalCalculado : (medidaCalculo * itemValorUnitario)).toFixed(2)}</strong> | Total estimado: <strong className="text-emerald-800 font-black">R$ {(((valorFinalCalculado > 0 ? valorFinalCalculado : (medidaCalculo * itemValorUnitario)) * itemQuantidade)).toFixed(2)}</strong> ({itemQuantidade} un)
                      </span>
                    </div>
                  </div>
                ) : isBabadoTable ? (
                  /* PAINEL EXCLUSIVO: CÁLCULO DE MESA BABADO (CONFORME ESPECIFICAÇÃO) */
                  <div className="space-y-3">
                    {/* 1. ENTRADAS (4 CAMPOS EM SEQUÊNCIA: FRENTE, LATERAL, ALTURA, QTD DE BABADO) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                      {/* 1. FRENTE MESA */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center">
                          FRENTE MESA (m)
                        </label>
                        <input
                          type="text"
                          value={medidaFrente}
                          onChange={(e) => setMedidaFrente(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 2. LATERAL */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center">
                          LATERAL (m)
                        </label>
                        <input
                          type="text"
                          value={medidaLateral}
                          onChange={(e) => setMedidaLateral(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 3. ALTURA */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center">
                          ALTURA (m)
                        </label>
                        <input
                          type="text"
                          value={medidaAltura}
                          onChange={(e) => setMedidaAltura(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 4. QTD DE BABADO (MÍNIMO ACEITÁVEL: 2) */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center" title="Quantidade de Babados (Mínimo: 2)">
                          QTD DE BABADO
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setMedidaQtdBabado((prev) => String(Math.max(2, (parseInt(prev || '2', 10) || 2) - 1)))}
                            className="w-7 h-7 bg-blue-50 hover:bg-blue-100 border border-blue-500 rounded-lg text-xs font-black text-blue-900 flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 transition"
                            title="Diminuir quantidade de babados (Mínimo: 2)"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="2"
                            max="20"
                            value={medidaQtdBabado}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setMedidaQtdBabado('');
                              } else {
                                const num = parseInt(val, 10);
                                setMedidaQtdBabado(String(isNaN(num) ? 2 : Math.max(2, num)));
                              }
                            }}
                            onBlur={() => {
                              if (medidaQtdBabado !== '' && parseInt(medidaQtdBabado, 10) < 2) {
                                setMedidaQtdBabado('2');
                              }
                            }}
                            placeholder="0"
                            className="w-full px-1.5 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => setMedidaQtdBabado((prev) => String(Math.max(2, (parseInt(prev || '2', 10) || 2) + 1)))}
                            className="w-7 h-7 bg-blue-50 hover:bg-blue-100 border border-blue-500 rounded-lg text-xs font-black text-blue-900 flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 transition"
                            title="Aumentar quantidade de babados"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 2. CARDS / VALORES CALCULADOS EM R$ (TAMPO, FAIXA, FAIXA DE BABADO, TOTAL BABADO, VALOR TOTAL) */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end pt-0.5">
                      {/* VALOR DO TAMPO */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate" title="Frente × Lateral × Preço Metro arredondado para cima">
                          VALOR DO TAMPO
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${(valorDoTampo || 0).toFixed(2)}`}
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                        />
                      </div>

                      {/* FAIXA */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate" title="Perímetro (2F + 2L) × Altura × Preço Metro arredondado para cima">
                          FAIXA
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${(valorFaixa || 0).toFixed(2)}`}
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                        />
                      </div>

                      {/* FAIXA DE BABADO (Unitária) */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate" title="Largura Franzida 2x × (Altura / Qtd Babados) × Preço Metro">
                          FAIXA DE BABADO
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${(valorFaixaBabadoUnitario || 0).toFixed(2)}`}
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                        />
                      </div>

                      {/* TOTAL BABADO */}
                      <div>
                        <label className="block text-[10px] font-black text-blue-900 uppercase mb-0.5 text-center truncate" title="Faixa de Babado × Qtd de Babados">
                          TOTAL BABADO
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${(valorTotalBabados || 0).toFixed(2)}`}
                          className="w-full px-2 py-1.5 bg-blue-50 text-blue-950 border border-blue-500 rounded-xl text-xs font-black text-center shadow-2xs focus:outline-none cursor-default font-mono"
                        />
                      </div>

                      {/* VALOR TOTAL DA PEÇA */}
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[10px] font-black text-emerald-900 uppercase mb-0.5 text-center truncate" title="Tampo + Faixa + Total Babados + (R$ 20 × Qtd Babados)">
                          VALOR TOTAL DA PEÇA
                        </label>
                        <div className="w-full py-1.5 px-2 bg-emerald-600 text-white rounded-xl text-xs font-black text-center shadow-2xs border border-emerald-700 flex items-center justify-center font-mono">
                          R$ {(valorFinalCalculado || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* 3. TABELA DE MEDIDAS PARA PRODUÇÃO (IMPRESSÃO / CORTE E COSTURA) */}
                    <div className="bg-white/95 border border-blue-200 rounded-xl p-2.5 shadow-2xs space-y-1.5">
                      <div className="border-b border-blue-100 pb-1">
                        <span className="text-[10px] font-black text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                          <span>📐</span>
                          <span>MEDIDAS PARA PRODUÇÃO (Impressão / Corte e Costura)</span>
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-500 font-extrabold uppercase text-[9px]">
                              <th className="py-1 px-2">Peça / Parte</th>
                              <th className="py-1 px-2 text-center">Largura Final</th>
                              <th className="py-1 px-2 text-center">Altura Final</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                            {/* TAMPO */}
                            <tr className="hover:bg-slate-50">
                              <td className="py-1 px-2 font-black text-slate-900 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                <span>TAMPO</span>
                              </td>
                              <td className="py-1 px-2 text-center font-black font-mono text-blue-700">
                                {medidasProducao?.tampo?.largura || '-'}
                              </td>
                              <td className="py-1 px-2 text-center font-black font-mono text-blue-700">
                                {medidasProducao?.tampo?.altura ? medidasProducao.tampo.altura.replace(/\s*\(?1x\)?/gi, '').trim() : '-'}
                              </td>
                            </tr>

                            {/* FAIXA */}
                            <tr className="hover:bg-slate-50">
                              <td className="py-1 px-2 font-black text-slate-900 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                <span>FAIXA</span>
                              </td>
                              <td className="py-1 px-2 text-center font-black font-mono text-amber-700">
                                {medidasProducao?.faixa?.largura || '-'}
                              </td>
                              <td className="py-1 px-2 text-center font-black font-mono text-amber-700">
                                {medidasProducao?.faixa?.altura ? medidasProducao.faixa.altura.replace(/\s*\(?1x\)?/gi, '').trim() : '-'}
                              </td>
                            </tr>

                            {/* FAIXA DE BABADO */}
                            <tr className="hover:bg-slate-50">
                              <td className="py-1 px-2 font-black text-slate-900 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                <span>FAIXA DE BABADO</span>
                              </td>
                              <td className="py-1 px-2 text-center font-black font-mono text-blue-700">
                                {medidasProducao?.faixaBabado?.largura || '-'}
                              </td>
                              <td className="py-1 px-2 text-center font-black font-mono text-blue-700">
                                {medidasProducao?.faixaBabado?.altura ? (() => {
                                  const raw = medidasProducao.faixaBabado.altura.replace(/\(([^)]+)\)/g, '$1').trim();
                                  const hasQtd = Boolean(medidaQtdBabado && parseInt(medidaQtdBabado, 10) >= 2);
                                  return hasQtd ? raw : raw.replace(/\s+\d+x$/i, '').trim();
                                })() : '-'}
                              </td>
                            </tr>

                            {/* ÚLTIMA FAIXA DE BABADO */}
                            <tr className="hover:bg-slate-50">
                              <td className="py-1 px-2 font-black text-slate-900 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                                <span>ÚLTIMA FAIXA DE BABADO</span>
                              </td>
                              <td className="py-1 px-2 text-center font-black font-mono text-purple-700">
                                {medidasProducao?.ultimaFaixaBabado?.largura || '-'}
                              </td>
                              <td className="py-1 px-2 text-center font-black font-mono text-purple-700">
                                {medidasProducao?.ultimaFaixaBabado?.altura ? (() => {
                                  const raw = medidasProducao.ultimaFaixaBabado.altura.replace(/\(([^)]+)\)/g, '$1').trim();
                                  const hasQtd = Boolean(medidaQtdBabado && parseInt(medidaQtdBabado, 10) >= 2);
                                  return hasQtd ? raw : raw.replace(/\s+\d+x$/i, '').trim();
                                })() : '-'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : isCilindroTable ? (
                  /* PAINEL EXCLUSIVO: CÁLCULO DE CILINDRO (CONFORME ESPECIFICAÇÃO) */
                  <div className="space-y-3">
                    {/* 1. ENTRADAS: LARGURA, ALTURA, TAMPO, VALOR M² */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                      {/* 1. LARGURA */}
                      <div>
                        <label className="block text-[10px] font-black text-cyan-900 uppercase mb-0.5 text-center">
                          LARGURA (m)
                        </label>
                        <input
                          type="text"
                          value={medidaFrente}
                          onChange={(e) => setMedidaFrente(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-cyan-300 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-cyan-500 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 2. ALTURA */}
                      <div>
                        <label className="block text-[10px] font-black text-cyan-900 uppercase mb-0.5 text-center">
                          ALTURA (m)
                        </label>
                        <input
                          type="text"
                          value={medidaAltura}
                          onChange={(e) => setMedidaAltura(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-cyan-300 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-cyan-500 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 3. TAMPO = LARGURA / 3 */}
                      <div>
                        <label
                          className="block text-[10px] font-black text-cyan-900 uppercase mb-0.5 text-center truncate"
                          title="Tampo = Largura / 3"
                        >
                          TAMPO (m)
                        </label>
                        <div
                          className="w-full py-1.5 px-2 bg-cyan-700 text-white rounded-xl text-xs font-black text-center shadow-2xs border border-cyan-800 flex items-center justify-center font-mono"
                          title={`Tampo = Largura (${medidaFrente || '0'} m) ÷ 3 = ${(tampCilindro || 0).toFixed(2).replace('.', ',')} m`}
                        >
                          <span>{(tampCilindro || 0) > 0 ? `${(tampCilindro || 0).toFixed(2).replace('.', ',')} m` : '0,00 m'}</span>
                        </div>
                      </div>

                      {/* 4. VALOR M² (NÃO EXIBIR TEXTO 'FIXO') */}
                      <div>
                        <label
                          className="block text-[10px] font-black text-cyan-900 uppercase mb-0.5 text-center truncate"
                          title="Valor do metro quadrado (m²)"
                        >
                          VALOR M²
                        </label>
                        <div className="w-full py-1.5 px-2 bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-black text-center shadow-2xs font-mono">
                          R$ {itemValorUnitario > 0 ? itemValorUnitario.toFixed(2) : '0,00'}
                        </div>
                      </div>
                    </div>

                    {/* 2. VALORES CALCULADOS EM R$: VALOR BASE, VALOR DO TAMPO, VALOR TOTAL */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end pt-0.5">
                      {/* VALOR BASE = Largura * Altura * m² */}
                      <div>
                        <label
                          className="block text-[10px] font-black text-cyan-900 uppercase mb-0.5 text-center truncate"
                          title="Valor base = Largura × Altura × m²"
                        >
                          VALOR BASE
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${(valorBaseCilindro || 0).toFixed(2)}`}
                          className="w-full px-2 py-1.5 bg-white border border-cyan-300 rounded-xl text-xs font-black text-slate-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                        />
                      </div>

                      {/* VALOR DO TAMPO = tampo^2 * m² */}
                      <div>
                        <label
                          className="block text-[10px] font-black text-cyan-900 uppercase mb-0.5 text-center truncate"
                          title="Valor do Tampo = Tampo² × m²"
                        >
                          VALOR DO TAMPO
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${(valorTampoCilindro || 0).toFixed(2)}`}
                          className="w-full px-2 py-1.5 bg-white border border-cyan-300 rounded-xl text-xs font-black text-slate-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                        />
                      </div>

                      {/* VALOR TOTAL = valor base + valor do tampo (arredonda pra cima) */}
                      <div>
                        <label
                          className="block text-[10px] font-black text-emerald-900 uppercase mb-0.5 text-center truncate"
                          title="Valor Total = valor base + valor do tampo (arredondado para cima)"
                        >
                          TOTAL (VALOR DA PEÇA)
                        </label>
                        <div className="w-full py-1.5 px-2 bg-emerald-600 text-white rounded-xl text-xs font-black text-center shadow-2xs border border-emerald-700 flex items-center justify-center font-mono">
                          R$ {(valorFinalCalculado || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Resumo visual do cálculo do cilindro */}
                    <div className="text-[11px] font-bold text-cyan-950 bg-white/90 border border-cyan-200 rounded-xl px-3 py-1.5 flex items-center justify-between flex-wrap gap-2">
                      <span>
                        Tampo: <strong>{(tampCilindro || 0).toFixed(2).replace('.', ',')} m</strong> ({medidaFrente || '0'}m ÷ 3) | Base: <strong>R$ {(valorBaseCilindro || 0).toFixed(2)}</strong> | Tampo: <strong>R$ {(valorTampoCilindro || 0).toFixed(2)}</strong>
                        {itemValorUnitario > 0 && <span className="text-slate-600"> • R$ {itemValorUnitario.toFixed(2)}/m²</span>}
                      </span>
                      <span>
                        Valor da Peça: <strong className="text-emerald-700 font-black">R$ {(valorFinalCalculado || 0).toFixed(2)}</strong> | Total estimado: <strong className="text-emerald-800 font-black">R$ {(((valorFinalCalculado || 0) * itemQuantidade)).toFixed(2)}</strong> ({itemQuantidade} un)
                      </span>
                    </div>
                  </div>
                ) : isCuboTable ? (
                  /* PAINEL EXCLUSIVO: CÁLCULO CUBO (CONFORME ESPECIFICAÇÃO) */
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
                        <label
                          className="block text-[10px] font-black text-blue-900 mb-0.5 text-center truncate"
                          title="calculo = (medida * 4) (não arredonde para cima)"
                        >
                          calculo
                        </label>
                        <div
                          className="w-full py-1.5 px-2 bg-white text-blue-900 rounded-xl text-xs font-black text-center shadow-2xs border border-blue-500 flex items-center justify-center font-mono"
                          title={`calculo = (medida * 4) = ${(calculoCubo || 0) > 0 ? String(calculoCubo || 0).replace('.', ',') : '0,00'}`}
                        >
                          <span>{(calculoCubo || 0) > 0 ? (Number.isInteger(calculoCubo) ? calculoCubo.toString() : (calculoCubo || 0).toFixed(2).replace('.', ',')) : '0,00'}</span>
                        </div>
                      </div>

                      {/* 2. valor = (altura * calculo * preço de venda/preço expresso) */}
                      <div>
                        <label
                          className="block text-[10px] font-black text-blue-900 mb-0.5 text-center truncate"
                          title="valor = (altura * calculo * preço de venda/preço expresso)"
                        >
                          valor
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${(valorCuboCorpo || 0).toFixed(2).replace('.', ',')}`}
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                        />
                      </div>

                      {/* 3. valor tampo = (tampo * tampo * preço de venda/preço expresso) */}
                      <div>
                        <label
                          className="block text-[10px] font-black text-blue-900 mb-0.5 text-center truncate"
                          title="valor tampo = (tampo * tampo * preço de venda/preço expresso)"
                        >
                          valor tampo
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${(valorCuboTampo || 0).toFixed(2).replace('.', ',')}`}
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                        />
                      </div>

                      {/* 4. Total = (valor + valor tampo) arredonde pra cima */}
                      <div>
                        <label
                          className="block text-[10px] font-black text-emerald-900 uppercase mb-0.5 text-center truncate"
                          title="Total = (valor + valor tampo) arredonde pra cima"
                        >
                          Total
                        </label>
                        <div
                          className="w-full px-2 py-1.5 bg-emerald-600 text-white border border-emerald-700 rounded-xl text-xs font-black text-center shadow-2xs font-mono"
                          title={`Total = (valor + valor tampo) arredondado para cima = R$ ${(valorFinalCalculado || 0).toFixed(2).replace('.', ',')}`}
                        >
                          R$ {(valorFinalCalculado || 0).toFixed(2).replace('.', ',')}
                        </div>
                      </div>
                    </div>

                    {/* Resumo visual do cálculo do cubo */}
                    <div className="text-[11px] font-bold text-blue-950 bg-white/90 border border-blue-200 rounded-xl px-3 py-1.5 flex items-center justify-between flex-wrap gap-2">
                      <span>
                        Cálculo: <strong>Medida ({medidaFrente || '0'} m) × 4 = {(calculoCubo || 0).toFixed(2)} m</strong> | Saia: <strong>{medidaAltura || '0'} m (Alt) × {(calculoCubo || 0).toFixed(2)} m</strong> = <strong className="text-blue-700 font-extrabold">{((parseFloat(String(medidaAltura).replace(',', '.')) || 0) * (calculoCubo || 0)).toFixed(2)} m²</strong> | Tampo: <strong>{(medidaTampo || medidaFrente || '0')} m × {(medidaTampo || medidaFrente || '0')} m</strong> = <strong className="text-blue-700 font-extrabold">{((parseFloat(String(medidaTampo || medidaFrente).replace(',', '.')) || 0) ** 2).toFixed(2)} m²</strong>
                        {itemValorUnitario > 0 && <span className="text-slate-600"> • R$ {itemValorUnitario.toFixed(2)}/m²</span>}
                      </span>
                      <span>
                        Valor da Peça: <strong className="text-emerald-700 font-black">R$ {(valorFinalCalculado || 0).toFixed(2)}</strong> | Total estimado: <strong className="text-emerald-800 font-black">R$ {(((valorFinalCalculado || 0) * itemQuantidade)).toFixed(2)}</strong> ({itemQuantidade} un)
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
                          placeholder="0"
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
                          placeholder="0"
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
                          placeholder="0"
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
                          placeholder="0"
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
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-blue-500 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center shadow-2xs"
                        />
                      </div>

                      {/* 6. CALCULO */}
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
                              : (medidaCalculo > 0 ? `${medidaCalculo} m²` : '0,00')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* LINHA 2: VALORES CALCULADOS EM R$ */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end pt-1">
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

                      {/* 4. VALOR FINAL / VALOR DA PEÇA */}
                      <div>
                        <label className="block text-[10px] font-black text-emerald-900 uppercase mb-0.5 text-center truncate" title="VALOR FINAL DA PEÇA">
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
                        Saia/Babado: <strong className="text-blue-600 font-extrabold">{medidaBabado || '0'} m</strong> <span className="text-slate-700 font-semibold">({((parseFloat(String(medidaBabado).replace(',', '.')) || 0) * (parseFloat(String(medidaAltura).replace(',', '.')) || 0)).toFixed(2)} m²)</span> | Tampo: <strong className="text-blue-600 font-extrabold">{comSobreposicao ? `${((parseFloat(String(medidaFrente).replace(',', '.')) || 0) + (parseFloat(String(medidaCaimento).replace(',', '.')) || 0)).toFixed(2)} × ${((parseFloat(String(medidaLateral).replace(',', '.')) || 0) + (parseFloat(String(medidaCaimento).replace(',', '.')) || 0)).toFixed(2)}` : `${(parseFloat(String(medidaFrente).replace(',', '.')) || 0).toFixed(2)} × ${(parseFloat(String(medidaLateral).replace(',', '.')) || 0).toFixed(2)}`} m</strong> = <strong className="text-blue-600 font-black">{medidaCalculo} m²</strong>
                      </span>
                      <span>
                        Valor da Peça: <strong className="text-emerald-700 font-black">R$ {(valorFinalCalculado > 0 ? valorFinalCalculado : itemValorUnitario).toFixed(2)}</strong> | Total estimado: <strong className="text-emerald-800 font-black">R$ {(((valorFinalCalculado > 0 ? valorFinalCalculado : (itemValorUnitario * (medidaCalculo > 0 ? medidaCalculo : 1))) * itemQuantidade)).toFixed(2)}</strong> ({itemQuantidade} un)
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* BLOCK 3: LISTA DOS ITENS DA ORDEM DE SERVIÇO (IDENTICAL TO SCREENSHOT) */}
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

                                {/* DETALHE EXPANDIDO */}
                                {expandedMedidasItemIds[item.id] && (
                                  <div className="text-[10px] font-semibold text-purple-950 bg-purple-100/95 border border-purple-300 p-2 rounded-xl space-y-1.5 shadow-2xs animate-fadeIn w-full">
                                    {item.medidasProducao || item.qtdBabado ? (
                                       <div className="space-y-1.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span>📐 <strong>Mesa Babado:</strong> Frente: {item.medidaFrente !== undefined ? String(item.medidaFrente).replace('.', ',') : '-'}m | Lateral: {item.medidaLateral !== undefined ? String(item.medidaLateral).replace('.', ',') : '-'}m | Altura: {item.medidaAltura !== undefined ? String(item.medidaAltura).replace('.', ',') : '-'}m{item.qtdBabado ? <> | Camadas: <strong>{item.qtdBabado} Babados</strong></> : null}</span>
                                          {item.valorTampo !== undefined && item.valorTampo > 0 && (
                                            <span className="bg-blue-200 text-blue-950 text-[9px] px-1.5 py-0.2 rounded font-bold">
                                              Tampo: R$ {item.valorTampo.toFixed(2)}
                                            </span>
                                          )}
                                          {item.valorFaixa !== undefined && item.valorFaixa > 0 && (
                                            <span className="bg-amber-200 text-amber-950 text-[9px] px-1.5 py-0.2 rounded font-bold">
                                              Faixa: R$ {item.valorFaixa.toFixed(2)}
                                            </span>
                                          )}
                                          {item.valorFaixaBabado !== undefined && item.valorFaixaBabado > 0 && (
                                            <span className="bg-fuchsia-200 text-fuchsia-950 text-[9px] px-1.5 py-0.2 rounded font-bold">
                                              Faixa Babado Unit: R$ {item.valorFaixaBabado.toFixed(2)}
                                            </span>
                                          )}
                                          {item.valorBabado !== undefined && item.valorBabado > 0 && (
                                            <span className="bg-fuchsia-600 text-white text-[9px] px-1.5 py-0.2 rounded font-black">
                                              Total Babados: R$ {item.valorBabado.toFixed(2)}
                                            </span>
                                          )}
                                        </div>
                                        {item.medidasProducao && (
                                          <div className="bg-white/95 border border-purple-200 rounded-lg p-1.5 text-[9.5px] text-slate-800 space-y-1">
                                            <div className="font-black text-purple-900 uppercase flex items-center justify-between flex-wrap gap-1">
                                              <span>📐 Medidas para Produção (Corte e Costura)</span>
                                              <span className="text-purple-700 font-bold">Taxa Costura: R$ {(20 * (item.qtdBabado || 0)).toFixed(2)}</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 font-mono">
                                              <div className="bg-blue-50/70 border border-blue-200 rounded px-2 py-0.5">
                                                <strong className="text-blue-900">TAMPO:</strong> Larg: {item.medidasProducao.tampo?.largura || '-'} | Alt: {item.medidasProducao.tampo?.altura || '-'}
                                              </div>
                                              <div className="bg-amber-50/70 border border-amber-200 rounded px-2 py-0.5">
                                                <strong className="text-amber-900">FAIXA:</strong> Larg: {item.medidasProducao.faixa?.largura || '-'} | Alt: {item.medidasProducao.faixa?.altura || '-'}
                                              </div>
                                              <div className="bg-fuchsia-50/70 border border-fuchsia-200 rounded px-2 py-0.5">
                                                <strong className="text-fuchsia-900">FAIXA DE BABADO:</strong> Larg: {item.medidasProducao.faixaBabado?.largura || '-'} | Alt: {item.medidasProducao.faixaBabado?.altura || '-'}
                                              </div>
                                              {item.medidasProducao.ultimaFaixaBabado && (
                                                <div className="bg-purple-50/70 border border-purple-200 rounded px-2 py-0.5">
                                                  <strong className="text-purple-900">ÚLTIMA FAIXA:</strong> Larg: {item.medidasProducao.ultimaFaixaBabado?.largura || '-'} | Alt: {item.medidasProducao.ultimaFaixaBabado?.altura || '-'}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : (item.valorBaseCilindro !== undefined || item.tampCilindro !== undefined) ? (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span>📐 <strong>Cálculo de Cilindro:</strong> Largura: {item.medidaFrente !== undefined ? String(item.medidaFrente).replace('.', ',') : '-'}m | Altura: {item.medidaAltura !== undefined ? String(item.medidaAltura).replace('.', ',') : '-'}m | Tampo: {item.tampCilindro !== undefined ? Number(item.tampCilindro).toFixed(2).replace('.', ',') : (item.medidaAltura && Number(item.medidaAltura) > 0 ? (Number(item.medidaFrente || 0) / 3).toFixed(2).replace('.', ',') : '-')}m</span>
                                        {item.valorBaseCilindro !== undefined && item.valorBaseCilindro > 0 && (
                                          <span className="bg-cyan-100 text-cyan-900 border border-cyan-200 text-[9px] px-1 rounded font-bold">
                                            Valor Base: R$ {item.valorBaseCilindro.toFixed(2)}
                                          </span>
                                        )}
                                        {item.valorTampoCilindro !== undefined && item.valorTampoCilindro > 0 && (
                                          <span className="bg-blue-100 text-blue-900 border border-blue-200 text-[9px] px-1 rounded font-bold">
                                            Valor Tampo: R$ {item.valorTampoCilindro.toFixed(2)}
                                          </span>
                                        )}
                                        <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.2 rounded font-black">
                                          Total: R$ {((item.valorBaseCilindro || 0) + (item.valorTampoCilindro || 0) > 0 ? Math.ceil((item.valorBaseCilindro || 0) + (item.valorTampoCilindro || 0)) : (item.total || 0)).toFixed(2)}
                                        </span>
                                      </div>
                                    ) : (item.calculoCubo !== undefined || item.valorCubo !== undefined || (item.medidaTampo !== undefined && item.medidaTampo > 0)) ? (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span>📐 <strong>Cálculo Cubo:</strong> Medida: {item.medidaFrente !== undefined ? String(item.medidaFrente).replace('.', ',') : '-'}m | Altura: {item.medidaAltura !== undefined ? String(item.medidaAltura).replace('.', ',') : '-'}m | Tampo: {(item.medidaTampo !== undefined ? String(item.medidaTampo) : (item.medidaFrente !== undefined ? String(item.medidaFrente) : '-')).replace('.', ',')}m</span>
                                        <span className="bg-fuchsia-600 text-white text-[9px] px-1.5 py-0.2 rounded font-black">
                                          Cálculo: {item.calculoCubo ? `${Number(item.calculoCubo).toFixed(2).replace('.', ',')}m` : `${((Number(item.medidaFrente) || 0) * 4).toFixed(2).replace('.', ',')}m`}
                                        </span>
                                        {item.valorCubo !== undefined && item.valorCubo > 0 && (
                                          <span className="bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-200 text-[9px] px-1 rounded font-bold">
                                            Valor: R$ {item.valorCubo.toFixed(2)}
                                          </span>
                                        )}
                                        {item.valorTampo !== undefined && item.valorTampo > 0 && (
                                          <span className="bg-blue-100 text-blue-900 border border-blue-200 text-[9px] px-1 rounded font-bold">
                                            Valor Tampo: R$ {item.valorTampo.toFixed(2)}
                                          </span>
                                        )}
                                        <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.2 rounded font-black">
                                          Total: R$ {((item.valorCubo || 0) + (item.valorTampo || 0)).toFixed(2)}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span>📐 <strong>Medidas:</strong> Frente: {item.medidaFrente !== undefined ? String(item.medidaFrente).replace('.', ',') : '-'}m | Lat: {item.medidaLateral !== undefined ? String(item.medidaLateral).replace('.', ',') : '-'}m | Alt: {item.medidaAltura !== undefined ? String(item.medidaAltura).replace('.', ',') : '-'}m | Caimento: {item.medidaCaimento !== undefined ? String(item.medidaCaimento).replace('.', ',') : '-'}m | Babado: {item.medidaBabado !== undefined ? String(item.medidaBabado).replace('.', ',') : '-'}m</span>
                                        <span className="bg-purple-700 text-white text-[9px] px-1.5 py-0.2 rounded font-black">
                                          Cálculo: {item.medidaCalculo ?? '-'} m²
                                        </span>
                                        {item.comSobreposicao && (
                                          <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase shadow-2xs">
                                            Sobreposição
                                          </span>
                                        )}
                                        {item.valorBabado !== undefined && (
                                          <span className="bg-fuchsia-200 text-fuchsia-950 text-[9px] px-1 rounded font-bold">
                                            Babado: R$ {item.valorBabado.toFixed(2)}
                                          </span>
                                        )}
                                        {item.valorTampo !== undefined && (
                                          <span className="bg-blue-200 text-blue-950 text-[9px] px-1 rounded font-bold">
                                            Tampo: R$ {item.valorTampo.toFixed(2)}
                                          </span>
                                        )}
                                        {item.valorSobreposicao !== undefined && (
                                          <span className="bg-amber-200 text-amber-950 text-[9px] px-1 rounded font-bold">
                                            Sobrep.: R$ {item.valorSobreposicao.toFixed(2)}
                                          </span>
                                        )}
                                      </div>
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

          {/* BLOCK 4: 2-COLUMN GRID (ANEXOS DA OS & OBSERVAÇÕES GERAIS - EXACTLY AS IN SCREENSHOT) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* ANEXOS DA OS (ARTES) */}
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

                  <label className="px-2.5 py-1 bg-purple-50 border border-purple-600 hover:bg-purple-100 text-purple-800 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-2xs" title="Upload de arte em alta resolução para download pelo impressor">
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
                  {anexos.map((a) => {
                    const isParaImpressao = a.type === 'PARA_IMPRESSAO' || a.isParaImpressao === true || (a.label || '').toLowerCase().includes('impressão');
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

            {/* OBSERVAÇÕES GERAIS */}
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

          {/* BLOCK 5: VALORES TOTAIS & BOTÃO "REGISTRAR PAGAMENTO" (WITHOUT "PAGAR NO CAIXA PDV") */}
          <div className="bg-slate-100 text-slate-900 border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase">
                Resumo Financeiro da Ordem
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

              {/* SALVAR ALTERAÇÕES (WHEN EDITING EXISTING OSS) */}
              {editingOsId && (
                <button
                  type="button"
                  onClick={handleSaveAberta}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-emerald-600 hover:bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4 text-emerald-600" />
                  <span>Salvar Alterações</span>
                </button>
              )}

              {/* MANDATORY ACTION BUTTON: REGISTRAR PAGAMENTO (REPLACES "PAGAR NO CAIXA PDV (F10)") */}
              <button
                type="button"
                onClick={handleRegistrarPagamento}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <CreditCard className="w-4 h-4 text-white" />
                <span>
                  REGISTRAR PAGAMENTO
                  <span className="hidden lg:inline"> (F10)</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: PESQUISAR OSS (ORDEM DE SERVIÇO SHOPEE) */}
      {/* ========================================================================= */}
      {activeView === 'SEARCH_OS' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          {/* HEADER PESQUISA */}
          <div className="p-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-200" />
                <span>Histórico & Pesquisa de Ordens de Serviço Shopee (OSS)</span>
              </h2>
              <p className="text-xs text-amber-100 font-medium">
                Consulte e acompanhe todas as OSS geradas para a Shopee com status de pagamento e produção.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveView('NEW_OS')}
              className="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
            >
              Voltar ao Cadastro (NOVA OSS)
            </button>
          </div>

          {/* SEARCH BAR */}
          <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTermOs}
                onChange={(e) => setSearchTermOs(e.target.value)}
                placeholder="Pesquise por Código OSS, ID do Pedido Shopee ou Nome do Comprador..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <button
              type="button"
              onClick={loadData}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition cursor-pointer"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* TABELA DE ORDENS DE SERVIÇO SHOPEE */}
          <div className="p-4 overflow-x-auto">
            {filteredOssList.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-60" />
                <p className="font-bold text-sm">Nenhuma Ordem de Serviço Shopee (OSS) encontrada.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Clique em "NOVA OSS" acima para lançar o primeiro pedido com "REGISTRAR PAGAMENTO".
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[10px] font-extrabold">
                    <th className="p-3">Código OSS</th>
                    <th className="p-3">ID Pedido Shopee</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Comprador</th>
                    <th className="p-3">Estágio Kanban</th>
                    <th className="p-3 text-right">Valor Final</th>
                    <th className="p-3 text-center">Status Pagamento</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                  {filteredOssList.map((os) => {
                    const idShopee = (os as any).shopeePedidoId || (os as any).idPedido || '—';
                    const isPaid = (os.paymentStatus || '').toLowerCase() === 'pago';

                    return (
                      <tr key={os.id} className="hover:bg-slate-50 transition">
                        <td className="p-3">
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black rounded-lg inline-block">
                            {os.codigo}
                          </span>
                        </td>
                        <td className="p-3 font-extrabold text-slate-900">
                          {idShopee}
                        </td>
                        <td className="p-3 text-slate-500 font-semibold">
                          {formatDateBR(os.dataVenda || os.createdAt || '')}
                        </td>
                        <td className="p-3 font-bold text-slate-800 truncate max-w-[180px]">
                          {os.clienteNome}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-extrabold rounded">
                            {os.estagioAtual || 'Designer'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-black text-slate-900">
                          R$ {(os.valorFinal || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {isPaid ? 'PAGO' : 'ABERTO'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedOsForPrint(os)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                            title="Visualizar / Imprimir A4"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditOss(os)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition cursor-pointer"
                            title="Editar OSS"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL EDIT ART / COREL */}
      {showArtEditorModal && (
        <ArtEditorModal
          anexos={anexos}
          osCodigo={osCodigo}
          onClose={() => setShowArtEditorModal(false)}
          onSave={(updatedAnexos: OsAttachment[]) => {
            setAnexos(updatedAnexos);
            setShowArtEditorModal(false);
            setFeedback({ type: 'success', message: 'Artes salvas no Editor Corel!' });
          }}
        />
      )}

      {/* MODAL PREVIEW IMAGE */}
      {selectedPreviewImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl p-4 max-w-2xl w-full shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-black text-slate-800">Visualização da Arte</h3>
              <button
                type="button"
                onClick={() => setSelectedPreviewImage(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center p-2 bg-slate-100 rounded-xl max-h-[70vh] overflow-hidden">
              <img
                src={selectedPreviewImage}
                alt="Preview da Arte"
                className="max-h-[65vh] object-contain rounded-lg"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPreviewImage(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRINT A4 */}
      {selectedOsForPrint && (
        <OsPrintableA4
          os={selectedOsForPrint}
          isSidebarExpanded={isSidebarExpanded}
          onClose={() => setSelectedOsForPrint(null)}
        />
      )}
    </div>
  );
};
