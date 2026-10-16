import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  Printer,
  Calendar,
  Filter,
  Users,
  UserCheck,
  Package,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Award,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PieChart,
  ArrowUpRight,
  ShieldAlert,
  ArrowLeft,
  X,
  FileText,
  Eye,
  Download,
  ExternalLink,
  ShieldCheck,
  Tag,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutList,
  SlidersHorizontal,
} from 'lucide-react';
import { ApiService } from '../../services/api';
import { OrdemServico, PdvTransaction, ProductCatalog } from '../../server/types/os';
import { Employee } from '../../server/types/employee';
import { Client } from '../../server/types/client';
import { OsPrintableA4 } from '../os/OsPrintableA4';
import { UserProfile } from '../../types/frontend';
import { getLoggedUserAndPerfil, normalizeRoleName, filterVisibleHistory } from '../../utils/userPermissions';

type ReportTab =
  | 'vendas_gerais'
  | 'por_os'
  | 'por_vnd'
  | 'vendas_vendedor'
  | 'vendas_cliente'
  | 'estoque_produtos'
  | 'estoque_descricao'
  | 'estoque_categoria'
  | 'estoque_venda'
  | 'estoque_interno'
  | 'vendas_produto'
  | 'funcionarios'
  | 'listagem_analitica';

interface ReportsModuleViewProps {
  user?: UserProfile | null;
  userRole?: string;
}

export const ReportsModuleView: React.FC<ReportsModuleViewProps> = ({ user: propUser, userRole: propRole }) => {
  const loggedUser = propUser || getLoggedUserAndPerfil();
  const userRole = propUser?.role || propRole || loggedUser.role || '';
  const isDev = Boolean(propUser?.isDeveloper || loggedUser.isDeveloper);
  const normalizedRole = normalizeRoleName(userRole);
  const isSupervisor = normalizedRole === 'Supervisor' || userRole.toLowerCase().includes('supervisor');
  const isEstoque = normalizedRole === 'Estoque' || userRole.toLowerCase().includes('estoque') || propUser?.sector?.toLowerCase() === 'estoque' || (loggedUser as any)?.sector?.toLowerCase() === 'estoque';

  const [activeTab, setActiveTab] = useState<ReportTab>(() => (isEstoque ? 'estoque_produtos' : 'vendas_gerais'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [selectedShortcut, setSelectedShortcut] = useState<'today' | '30days' | '90days' | 'year' | 'all'>('today');
  const [selectedSeller, setSelectedSeller] = useState<string>('TODOS');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'TODOS' | 'OS' | 'VND' | 'OSS'>('TODOS');

  // Estoque view controls (Excel format, items per page 10, 20, 30, simple/detailed view)
  const [estoqueItemsPerPage, setEstoqueItemsPerPage] = useState<number>(10);
  const [estoqueCurrentPage, setEstoqueCurrentPage] = useState<number>(1);
  const [estoqueViewMode, setEstoqueViewMode] = useState<'simple' | 'detailed'>('detailed');

  // Strict tab isolation:
  // - ESTOQUE profile: only estoque_produtos, estoque_venda, estoque_interno
  // - All OTHER profiles: only vendas_gerais, por_os, por_vnd, listagem_analitica, vendas_vendedor, vendas_cliente
  useEffect(() => {
    if (isEstoque) {
      if (!['estoque_produtos', 'estoque_descricao', 'estoque_categoria', 'estoque_venda', 'estoque_interno'].includes(activeTab)) {
        setActiveTab('estoque_produtos');
      }
    } else {
      if (!['vendas_gerais', 'por_os', 'por_vnd', 'listagem_analitica', 'vendas_vendedor', 'vendas_cliente'].includes(activeTab)) {
        setActiveTab('vendas_gerais');
      }
    }
  }, [isEstoque, activeTab]);

  // Full Screen Modal State for OS Details
  const [selectedOsDetail, setSelectedOsDetail] = useState<OrdemServico | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'detalhes' | 'comprovantes' | 'historico' | 'impressao'>('detalhes');

  // Data states
  const [osList, setOsList] = useState<OrdemServico[]>([]);
  const [pdvList, setPdvList] = useState<PdvTransaction[]>([]);
  const [productList, setProductList] = useState<ProductCatalog[]>([]);
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [clientList, setClientList] = useState<Client[]>([]);

  // Date Filter State (Default to 'Hoje' / Current Day, Data Final ALWAYS current day)
  const todayStr = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Reset pagination whenever filters or page size changes
  useEffect(() => {
    setEstoqueCurrentPage(1);
  }, [searchTerm, selectedCategory, activeTab, startDate, endDate, estoqueItemsPerPage]);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [osData, pdvData, prodData, empData, cliData] = await Promise.all([
        ApiService.getOrdensServico().catch(() => []),
        ApiService.getPdvTransactions().catch(() => []),
        ApiService.getProducts().catch(() => []),
        ApiService.getEmployees().catch(() => []),
        ApiService.getClients().catch(() => []),
      ]);

      setOsList(Array.isArray(osData) ? osData : []);
      setPdvList(Array.isArray(pdvData) ? pdvData : []);
      // Exclude products created directly in OS/PDV from inventory reports
      const estoqueOnlyProducts = (Array.isArray(prodData) ? prodData : []).filter(
        (p) => p.origemCadastro !== 'OS_PDV'
      );
      setProductList(estoqueOnlyProducts);
      setEmployeeList(Array.isArray(empData) ? empData : []);
      setClientList(Array.isArray(cliData) ? cliData : []);
    } catch (error) {
      console.error('Erro ao carregar dados dos relatórios:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Polling fallback every 30 seconds (updates reactively on events)
    const interval = setInterval(() => {
      loadData(true);
    }, 30000);

    const handleFocus = () => loadData(true);
    const handleOsChanged = () => loadData(true);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('os-changed', handleOsChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('os-changed', handleOsChanged);
    };
  }, []);

  const handleOpenOsDetail = (os: OrdemServico) => {
    setSelectedOsDetail(os);
    setModalActiveTab('detalhes');
  };

  const handleOpenOsDetailBySale = (sale: any) => {
    const matched = osList.find(
      (o) => o.id === sale.id || o.codigo === sale.codigo || (sale.codigo && o.codigo === sale.codigo)
    );
    if (matched) {
      setSelectedOsDetail(matched);
      setModalActiveTab('detalhes');
    } else {
      const rawPdv = sale.rawPdv || {};
      const statusPdv = sale.paymentStatus || rawPdv.paymentStatus || rawPdv.status || 'pago';
      const isPaid = statusPdv === 'pago';

      const valorEntradaCalculado = sale.valorEntrada !== undefined && sale.valorEntrada !== null
        ? Number(sale.valorEntrada)
        : (rawPdv.valorEntrada !== undefined && rawPdv.valorEntrada !== null
            ? Number(rawPdv.valorEntrada)
            : (rawPdv.entrada !== undefined && rawPdv.entrada !== null
                ? Number(rawPdv.entrada)
                : (isPaid ? sale.valorTotal : 0)));

      const dummyOs: OrdemServico = {
        id: sale.id,
        codigo: sale.codigo || `PDV-${sale.id}`,
        dataVenda: sale.data,
        operador: sale.vendedor,
        clienteNome: sale.cliente,
        clienteCpfCnpj: rawPdv.clienteCpfCnpj || '',
        clienteTelefone: rawPdv.clienteTelefone || '',
        clienteEmail: rawPdv.clienteEmail || '',
        prazoEntrega: sale.data,
        fluxoProducao: ['Concluído'],
        estagioAtual: 'Concluído',
        setorAceitoPor: [],
        itens: (sale.itens || []).map((i: any, idx: number) => ({
          id: `ITEM-${idx}`,
          codigo: `PROD-${idx + 1}`,
          descricao: i.descricao,
          quantidade: i.quantidade,
          unidade: 'UN',
          valorUnitario: i.quantidade > 0 ? i.total / i.quantidade : i.total,
          total: i.total,
        })),
        anexos: [],
        observacoes: rawPdv.observacoes || 'Venda de Balcão / PDV',
        subtotal: rawPdv.subtotal || sale.valorTotal,
        desconto: rawPdv.desconto || 0,
        valorFinal: sale.valorTotal,
        formaPagamento: sale.formaPagamento,
        valorEntrada: valorEntradaCalculado,
        formaPagamentoEntrada: sale.formaPagamentoEntrada || rawPdv.formaPagamentoEntrada || sale.formaPagamento,
        paymentStatus: isPaid ? 'pago' : 'pendente',
        comprovanteUrl: rawPdv.comprovanteUrl || '',
        historicoEdicoes: rawPdv.historicoEdicoes || [],
        createdAt: rawPdv.createdAt || new Date().toISOString(),
        updatedAt: rawPdv.updatedAt || new Date().toISOString(),
        createdBy: sale.vendedor,
        updatedBy: sale.vendedor,
        status: 'ACTIVE',
        version: 1,
      };
      setSelectedOsDetail(dummyOs);
      setModalActiveTab('detalhes');
    }
  };

  // Helper to parse date string (DD/MM/YYYY or YYYY-MM-DD) into Date object without timezone shift
  const parseDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
    if (dateStr.includes('-') && !dateStr.includes('T')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const startDateTime = useMemo(() => {
    if (!startDate) return null;
    const d = parseDate(startDate);
    if (!d) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }, [startDate]);

  const endDateTime = useMemo(() => {
    if (!endDate) return null;
    const d = parseDate(endDate);
    if (!d) return null;
    d.setHours(23, 59, 59, 999);
    return d;
  }, [endDate]);

  // Determines if current filter represents "Hoje"
  const isFilterToday = useMemo(() => {
    return selectedShortcut === 'today' || (startDate === todayStr && endDate === todayStr);
  }, [selectedShortcut, startDate, endDate, todayStr]);

  // Filter OS & PDV by Date Range, mantendo pendências e incluindo quitações
  const filteredOsList = useMemo(() => {
    return osList.filter((os) => {
      // Exclude Orçamentos from sales reports
      if ((os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento || os.codigo?.startsWith('ORC')) {
        return false;
      }
      if ((os.status || '').toLowerCase() === 'cancelada') {
        return false;
      }

      const dt = parseDate(os.dataVenda || os.createdAt);
      const isPaid = (os.paymentStatus || '').toLowerCase() === 'pago';
      const isPending = !isPaid;

      // 1. Data da OS dentro do período selecionado
      const isInRange = Boolean(
        dt && (!startDateTime || dt >= startDateTime) && (!endDateTime || dt <= endDateTime)
      );

      // 2. Se a OS está com pendência ativa:
      // "CASO HAJA UMA PENDENCIA, MANTENHA A OS EXIBIDA MESMO EM OUTROS DIAS ATÉ QUE SEUS STATUS MUDE PARA 'PAGO'"
      if (isPending) {
        if (isFilterToday || !endDateTime || (endDateTime && endDateTime.getTime() >= (parseDate(todayStr)?.getTime() || 0))) {
          return true;
        }
      }

      // 3. Se a OS foi quitada/paga hoje (ou no período) vindo de uma pendência anterior:
      // "AI VC INCLUE COMO PAGO NO DIA, MAS DEIXE QUE ERA UMA PENDENCIA"
      const quitacaoDateStr = (os as any).dataQuitacao || os.updatedAt || '';
      const dtQuitacao = parseDate(quitacaoDateStr);
      const hasPdvQuitaHoje = pdvList.some(
        (p) => (p.osId === os.id || p.osCodigo === os.codigo) && p.status === 'pago' && p.data?.startsWith(todayStr)
      );

      const wasQuitadaHoje = isPaid && (
        quitacaoDateStr.startsWith(todayStr) ||
        hasPdvQuitaHoje ||
        Boolean((os as any).eraPendencia)
      );

      if (isFilterToday && wasQuitadaHoje) {
        return true;
      }

      // Se período customizado e foi quitada dentro do período
      if (isPaid && dtQuitacao && startDateTime && endDateTime && dtQuitacao >= startDateTime && dtQuitacao <= endDateTime) {
        return true;
      }

      return isInRange;
    });
  }, [osList, pdvList, startDateTime, endDateTime, isFilterToday, todayStr]);

  const filteredPdvList = useMemo(() => {
    return pdvList.filter((pdv) => {
      const dt = parseDate(pdv.data || pdv.createdAt);
      const isPaidPdv = ((pdv as any).paymentStatus || (pdv as any).status || 'pago') === 'pago';
      const isPendingPdv = !isPaidPdv;

      // 1. Data dentro do range
      if (dt && (!startDateTime || dt >= startDateTime) && (!endDateTime || dt <= endDateTime)) {
        return true;
      }

      // 2. Se for pendência em aberto, mantém exibida em Hoje
      if (isPendingPdv && (isFilterToday || !endDateTime || endDateTime.getTime() >= (parseDate(todayStr)?.getTime() || 0))) {
        return true;
      }

      // 3. Se quitada hoje
      const pdvDateStr = pdv.data || pdv.createdAt || '';
      if (isFilterToday && isPaidPdv && ((pdv as any).eraPendencia || pdvDateStr.startsWith(todayStr))) {
        return true;
      }

      return false;
    });
  }, [pdvList, startDateTime, endDateTime, isFilterToday, todayStr]);

  // Combined Sales Data (Finalized OS + PDV Transactions) sorted newest first
  const salesList = useMemo(() => {
    const combined: Array<{
      id: string;
      codigo: string;
      data: string;
      dataOriginal?: string;
      cliente: string;
      vendedor: string;
      formaPagamento: string;
      valorTotal: number;
      tipo: 'OS' | 'VND' | 'OSS';
      paymentStatus: string;
      eraPendencia?: boolean;
      isPendenteDeOutroDia?: boolean;
      valorEntrada: number;
      formaPagamentoEntrada?: string;
      rawPdv?: any;
      itens: Array<{ descricao: string; quantidade: number; total: number }>;
    }> = [];

    // Ordens de Serviço (Vendas com produção originadas no módulo de OS e OSS)
    filteredOsList.forEach((os) => {
      let codeDisplay = os.codigo || 'OS00000001';
      const isOss =
        codeDisplay.toUpperCase().startsWith('OSS') ||
        (os as any).tipoDocumento === 'OSS' ||
        (os as any).isShopee === true;

      const tipo: 'OS' | 'OSS' = isOss ? 'OSS' : 'OS';

      const upperCode = codeDisplay.toUpperCase();
      if (!upperCode.startsWith('OS') && !upperCode.startsWith('OSS')) {
        codeDisplay = `OS #${codeDisplay}`;
      }

      const osSeller = (os as any).vendedorNome || (os as any).vendedor || os.operador || 'Atendente Padrão';
      const isPaid = (os.paymentStatus || '').toLowerCase() === 'pago';
      const isPending = !isPaid;

      const dataVendaStr = os.dataVenda || os.createdAt || '';
      const dtVenda = parseDate(dataVendaStr);
      const isFromPastDate = Boolean(
        dtVenda && (isFilterToday ? !dataVendaStr.startsWith(todayStr) : (startDateTime && dtVenda < startDateTime))
      );

      // Verificação de quitação hoje/no período
      const quitacaoDateStr = (os as any).dataQuitacao || os.updatedAt || '';
      const hasPdvQuitaHoje = pdvList.some(
        (p) => (p.osId === os.id || p.osCodigo === os.codigo) && p.status === 'pago' && p.data?.startsWith(todayStr)
      );

      const eraPendencia = Boolean(
        isPaid && (
          (os as any).eraPendencia ||
          (isFromPastDate && (quitacaoDateStr.startsWith(todayStr) || hasPdvQuitaHoje || isFilterToday))
        )
      );

      const isPendenteDeOutroDia = isPending && isFromPastDate;

      // Se era pendência paga no dia, a data de inclusão no relatório do dia é hoje
      const displayData = eraPendencia && isFilterToday ? todayStr : dataVendaStr;

      combined.push({
        id: os.id,
        codigo: codeDisplay,
        data: displayData,
        dataOriginal: dataVendaStr,
        cliente: os.clienteNome || 'Cliente Não Informado',
        vendedor: osSeller,
        formaPagamento: (os as any).formaPagamentoRestante || os.formaPagamento || 'Não especificada',
        valorTotal: os.valorFinal || 0,
        tipo: tipo,
        paymentStatus: isPaid ? 'pago' : 'pendente',
        eraPendencia,
        isPendenteDeOutroDia,
        valorEntrada: isPaid ? (os.valorFinal || 0) : (os.valorEntrada || 0),
        itens: (os.itens || []).map((i) => ({
          descricao: i.descricao,
          quantidade: i.quantidade,
          total: i.total,
        })),
      });
    });

    // Transações do PDV (Apenas vendas diretas de balcão sem OS / sem fluxo de produção)
    filteredPdvList.forEach((pdv) => {
      // Verifica se a transação do PDV foi originada de uma OS (venda com produção)
      const isOsOrigin = Boolean(
        pdv.osId ||
        (pdv.osCodigo && pdv.osCodigo.toUpperCase().startsWith('OS')) ||
        (pdv.codigoVenda && (pdv.codigoVenda.toUpperCase().startsWith('CDV') || pdv.codigoVenda.toUpperCase().startsWith('OS')))
      );

      // Regra de negócio estrita: OS é venda com produção e VND é venda direta do PDV.
      // Uma transação vinculada a OS JAMAIS pode ser convertida para VND.
      // Se a OS está ativa na lista, ela já foi computada acima. Se foi excluída, não deve gerar VND fantasma.
      if (isOsOrigin) {
        return;
      }

      // Check if PDV transaction is linked to an existing OS in filteredOsList
      const isLinkedToOs = Boolean(
        filteredOsList.some((o) => (pdv.osId && o.id === pdv.osId) || (pdv.osCodigo && o.codigo === pdv.osCodigo))
      );

      if (!isLinkedToOs) {
        let codeDisplay = pdv.codigoVenda || pdv.osCodigo || 'VND000001';
        const upperCode = codeDisplay.toUpperCase();
        if (!upperCode.startsWith('VND')) {
          codeDisplay = `VND-${codeDisplay}`;
        }

        const pdvPaymentStatus = (pdv as any).paymentStatus || (pdv as any).status || 'pago';
        const isPaidPdv = pdvPaymentStatus === 'pago';
        const isPendingPdv = !isPaidPdv;

        const pdvDateStr = pdv.data || pdv.createdAt || '';
        const dtPdv = parseDate(pdvDateStr);
        const isPdvFromPast = Boolean(
          dtPdv && (isFilterToday ? !pdvDateStr.startsWith(todayStr) : (startDateTime && dtPdv < startDateTime))
        );

        const eraPendencia = Boolean(isPaidPdv && ((pdv as any).eraPendencia || (isPdvFromPast && isFilterToday)));
        const isPendenteDeOutroDia = isPendingPdv && isPdvFromPast;

        const rawEntradaVal = (pdv as any).valorEntrada !== undefined && (pdv as any).valorEntrada !== null
          ? Number((pdv as any).valorEntrada)
          : ((pdv as any).entrada !== undefined && (pdv as any).entrada !== null
              ? Number((pdv as any).entrada)
              : undefined);

        const valorEntradaPdv = rawEntradaVal !== undefined
          ? rawEntradaVal
          : (isPaidPdv ? (pdv.valorTotal || 0) : 0);

        const pdvSeller = (pdv as any).vendedorNome || (pdv as any).vendedor || pdv.operadorNome || pdv.operador || 'Recepção / Balcão';
        combined.push({
          id: pdv.id,
          codigo: codeDisplay,
          data: eraPendencia && isFilterToday ? todayStr : pdvDateStr,
          dataOriginal: pdvDateStr,
          cliente: pdv.clienteNome || 'Cliente Balcão (Recepção)',
          vendedor: pdvSeller,
          formaPagamento: pdv.formaPagamento || 'PIX / Dinheiro',
          valorTotal: pdv.valorTotal || 0,
          tipo: 'VND',
          paymentStatus: isPaidPdv ? 'pago' : 'pendente',
          eraPendencia,
          isPendenteDeOutroDia,
          valorEntrada: valorEntradaPdv,
          formaPagamentoEntrada: (pdv as any).formaPagamentoEntrada || pdv.formaPagamento,
          rawPdv: pdv,
          itens: (pdv.itens || []).map((i) => ({
            descricao: i.descricao,
            quantidade: i.quantidade,
            total: i.total,
          })),
        });
      }
    });

    // Sort combined sales list newest first so real-time created OS appears at the top
    combined.sort((a, b) => {
      const dtA = parseDate(a.data)?.getTime() || 0;
      const dtB = parseDate(b.data)?.getTime() || 0;
      return dtB - dtA;
    });

    return combined;
  }, [filteredOsList, filteredPdvList, pdvList, isFilterToday, startDateTime, todayStr]);

  // Options for Seller / Role / Sector filter - RELACIONE APENAS OS VENDEDORES/RECEPÇÃO
  const sellerOptions = useMemo(() => {
    const set = new Set<string>();

    const checkIsVendedorOrRecepcaoEmp = (emp: Employee) => {
      const cargo = (emp.cargo || '').toLowerCase();
      const setor = (emp.setor || '').toLowerCase();
      return (
        cargo.includes('vendedor') ||
        cargo.includes('comercial') ||
        cargo.includes('recep') ||
        cargo.includes('atendente') ||
        cargo.includes('balc') ||
        setor.includes('venda') ||
        setor.includes('comercial') ||
        setor.includes('recep') ||
        setor.includes('atendimento') ||
        setor.includes('balc')
      );
    };

    // 1. Incluir colaboradores cadastrados com cargo/setor de Vendedor ou Recepção
    employeeList.forEach((emp) => {
      if (checkIsVendedorOrRecepcaoEmp(emp)) {
        if (emp.nome) {
          set.add(emp.nome.trim());
        }
      }
    });

    // 2. Verificar vendedores registrados em OS e PDV
    const checkNameIsVendedorOrRecepcao = (name: string) => {
      const n = name.trim().toLowerCase();
      if (!n) return false;
      if (
        n.includes('vendedor') ||
        n.includes('recep') ||
        n.includes('balc') ||
        n.includes('comercial') ||
        n.includes('atendente')
      ) {
        return true;
      }
      const matched = employeeList.find((e) => {
        const fn = `${e.nome} ${e.sobrenome || ''}`.trim().toLowerCase();
        const sim = e.nome.trim().toLowerCase();
        return fn === n || sim === n || n.includes(sim) || fn.includes(n);
      });
      if (matched) {
        return checkIsVendedorOrRecepcaoEmp(matched);
      }
      return false;
    };

    osList.forEach((os) => {
      const v = (os as any).vendedorNome || (os as any).vendedor || os.operador;
      if (v && checkNameIsVendedorOrRecepcao(v)) {
        set.add(v.trim());
      }
    });

    pdvList.forEach((pdv) => {
      const v = (pdv as any).vendedorNome || (pdv as any).vendedor || (pdv as any).operadorNome || pdv.operador;
      if (v && checkNameIsVendedorOrRecepcao(v)) {
        set.add(v.trim());
      }
    });

    // Fallback: Se não houver funcionários específicos cadastrados ainda, relacionar vendedores presentes nas vendas
    if (set.size === 0) {
      osList.forEach((os) => {
        const v = (os as any).vendedorNome || (os as any).vendedor;
        if (v) set.add(v.trim());
      });
      pdvList.forEach((pdv) => {
        const v = (pdv as any).vendedorNome || (pdv as any).vendedor;
        if (v) set.add(v.trim());
      });
    }

    return Array.from(set).sort();
  }, [employeeList, osList, pdvList]);

  // Effective Type filter taking into account specific tabs (POR OS / POR VND)
  const effectiveTypeFilter = useMemo<'TODOS' | 'OS' | 'VND' | 'OSS'>(() => {
    if (activeTab === 'por_os') return 'OS';
    if (activeTab === 'por_vnd') return 'VND';
    return selectedTypeFilter;
  }, [activeTab, selectedTypeFilter]);

  // Combined Sales Data filtered by seller and type if selected
  const salesListFilteredBySeller = useMemo(() => {
    let list = salesList;
    if (selectedSeller !== 'TODOS') {
      list = list.filter(
        (s) => s.vendedor.toLowerCase() === selectedSeller.toLowerCase()
      );
    }
    if (effectiveTypeFilter !== 'TODOS') {
      list = list.filter((s) => s.tipo === effectiveTypeFilter);
    }
    return list;
  }, [salesList, selectedSeller, effectiveTypeFilter]);

  // List of Pending sales items (OS + VND)
  const pendingSalesList = useMemo(() => {
    return salesListFilteredBySeller.filter((s) => s.paymentStatus !== 'pago');
  }, [salesListFilteredBySeller]);

  // List of Paid sales items (OS + VND)
  const paidSalesList = useMemo(() => {
    return salesListFilteredBySeller.filter((s) => s.paymentStatus === 'pago');
  }, [salesListFilteredBySeller]);

  // PENDENTES & PAGOS Stats Summary
  const summaryStats = useMemo(() => {
    const qtdPendentes = pendingSalesList.length;
    const valorPendentes = pendingSalesList.reduce(
      (acc, s) => acc + Math.max(0, s.valorTotal - (s.valorEntrada || 0)),
      0
    );

    const qtdPagos = paidSalesList.length;
    const valorPagos = paidSalesList.reduce((acc, s) => acc + s.valorTotal, 0);

    return {
      qtdPendentes,
      valorPendentes,
      qtdPagos,
      valorPagos,
    };
  }, [pendingSalesList, paidSalesList]);

  // Render Pendentes e Pagos Cards (reusable across tabs)
  const renderPendentesEPagosCards = (prefix?: string) => {
    const labelType =
      activeTab === 'por_vnd' || effectiveTypeFilter === 'VND'
        ? 'VND'
        : activeTab === 'por_os' || effectiveTypeFilter === 'OS'
        ? 'OS'
        : 'Vendas';

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PENDENTES */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-amber-100">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-amber-800 tracking-wider">
                    {prefix ? `${prefix} - PENDENTES` : 'PENDENTES'}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-800 rounded-full">
                    {pendingSalesList.length} {labelType}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Vendas e Ordens com saldo a receber (clique para abrir)
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-amber-900 block tracking-tight">
                {formatMoney(summaryStats.valorPendentes)}
              </span>
            </div>
          </div>

          {/* LISTA EM FORMATO DE LISTA - CLICÁVEIS */}
          <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
            {pendingSalesList.length > 0 ? (
              pendingSalesList.map((sale) => {
                const valorAberto = Math.max(0, sale.valorTotal - (sale.valorEntrada || 0));
                return (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => handleOpenOsDetailBySale(sale)}
                    className="w-full text-left p-3 bg-amber-50/60 hover:bg-amber-100/90 border border-amber-200/80 rounded-xl transition flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`px-2.5 py-1 font-black text-xs rounded-lg shrink-0 ${
                        sale.tipo === 'VND' ? 'bg-emerald-200/90 text-emerald-950' : 'bg-amber-200/90 text-amber-950'
                      }`}>
                        {sale.codigo}
                      </span>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {sale.cliente || 'Cliente não informado'}
                          </p>
                          {sale.isPendenteDeOutroDia && (
                            <span className="px-1.5 py-0.2 text-[9px] font-black bg-amber-200/90 text-amber-950 rounded shrink-0">
                              Em aberto
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {sale.data || 'Sem data'} • {sale.vendedor || 'Atendente'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right pl-2 shrink-0">
                      <span className="text-xs font-black text-amber-900 block">
                        {formatMoney(valorAberto)}
                      </span>
                      <span className="text-[10px] font-bold text-blue-600 group-hover:underline flex items-center justify-end gap-0.5">
                        Ver Detalhes <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs font-bold text-slate-400 bg-slate-50 rounded-xl">
                Nenhuma venda pendente no período.
              </div>
            )}
          </div>
        </div>

        {/* PAGOS */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-emerald-800 tracking-wider">
                    {prefix ? `${prefix} - PAGOS` : 'PAGOS'}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded-full">
                    {paidSalesList.length} {labelType}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Ordens e vendas quitadas (clique para abrir)
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-emerald-900 block tracking-tight">
                {formatMoney(summaryStats.valorPagos)}
              </span>
            </div>
          </div>

          {/* LISTA EM FORMATO DE LISTA - CLICÁVEIS */}
          <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
            {paidSalesList.length > 0 ? (
              paidSalesList.map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => handleOpenOsDetailBySale(sale)}
                  className="w-full text-left p-3 bg-emerald-50/60 hover:bg-emerald-100/90 border border-emerald-200/80 rounded-xl transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`px-2.5 py-1 font-black text-xs rounded-lg shrink-0 ${
                      sale.tipo === 'VND' ? 'bg-emerald-200/90 text-emerald-950' : 'bg-emerald-200/90 text-emerald-950'
                    }`}>
                      {sale.codigo}
                    </span>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {sale.cliente || 'Cliente não informado'}
                        </p>
                        {sale.eraPendencia && (
                          <span className="px-1.5 py-0.2 text-[9px] font-black bg-amber-200 text-amber-950 rounded border border-amber-300 shrink-0">
                            Era Pendência
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {sale.data || 'Sem data'} • {sale.vendedor || 'Atendente'}
                        {sale.eraPendencia && sale.dataOriginal && sale.dataOriginal !== sale.data ? ` • Origem: ${sale.dataOriginal}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right pl-2 shrink-0">
                    <span className="text-xs font-black text-emerald-900 block">
                      {formatMoney(sale.valorTotal)}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 group-hover:underline flex items-center justify-end gap-0.5">
                      Ver Detalhes <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-xs font-bold text-slate-400 bg-slate-50 rounded-xl">
                Nenhuma venda paga no período.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Sales by Seller Calculation
  const salesBySeller = useMemo(() => {
    const map = new Map<
      string,
      { vendedor: string; qtdVendas: number; totalFaturado: number }
    >();

    salesList.forEach((sale) => {
      const sellerName = sale.vendedor || 'Geral';
      const existing = map.get(sellerName) || {
        vendedor: sellerName,
        qtdVendas: 0,
        totalFaturado: 0,
      };
      existing.qtdVendas += 1;
      existing.totalFaturado += sale.valorTotal;
      map.set(sellerName, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalFaturado - a.totalFaturado);
  }, [salesList]);

  // Sales by Client Calculation
  const salesByClient = useMemo(() => {
    const map = new Map<
      string,
      { cliente: string; qtdPedidos: number; totalGasto: number; ultimaVenda: string }
    >();

    salesList.forEach((sale) => {
      const clientName = sale.cliente || 'Cliente Diversos';
      const existing = map.get(clientName) || {
        cliente: clientName,
        qtdPedidos: 0,
        totalGasto: 0,
        ultimaVenda: sale.data,
      };
      existing.qtdPedidos += 1;
      existing.totalGasto += sale.valorTotal;
      existing.ultimaVenda = sale.data || existing.ultimaVenda;
      map.set(clientName, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalGasto - a.totalGasto);
  }, [salesList]);

  // Sales by Product Calculation
  const salesByProduct = useMemo(() => {
    const map = new Map<
      string,
      { produto: string; qtdVendida: number; valorTotal: number }
    >();

    salesList.forEach((sale) => {
      sale.itens.forEach((item) => {
        const prodName = item.descricao || 'Produto Indefinido';
        const existing = map.get(prodName) || {
          produto: prodName,
          qtdVendida: 0,
          valorTotal: 0,
        };
        existing.qtdVendida += item.quantidade || 1;
        existing.valorTotal += item.total || 0;
        map.set(prodName, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.valorTotal - a.valorTotal);
  }, [salesList]);

  // Categories in stock
  const estoqueCategories = useMemo(() => {
    const cats = new Set<string>();
    productList.forEach((p) => {
      if (p.categoria && p.categoria.trim() && p.categoria.trim().toLowerCase() !== 'geral') {
        cats.add(p.categoria.trim());
      }
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [productList]);

  // Filtered products specifically for Estoque reports
  const filteredEstoqueProducts = useMemo(() => {
    return productList.filter((prod) => {
      // 1. Tab-specific filtering
      if (activeTab === 'estoque_venda' && prod.paraVenda === false) {
        return false;
      }
      if (activeTab === 'estoque_interno' && prod.paraVenda !== false) {
        return false;
      }

      // 2. Category filtering
      if (activeTab === 'estoque_categoria' || (isEstoque && selectedCategory !== 'TODAS')) {
        if (selectedCategory && selectedCategory !== 'TODAS') {
          if ((prod.categoria || '').trim().toLowerCase() !== selectedCategory.trim().toLowerCase()) {
            return false;
          }
        }
      }

      // 3. Search term (busca automatica)
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const matchesCode = (prod.codigo || '').toLowerCase().includes(term);
        const matchesDesc = (prod.descricao || '').toLowerCase().includes(term);
        const matchesCat = (prod.categoria || '').toLowerCase().includes(term);
        const matchesBarcode = (prod.codigoBarras || '').toLowerCase().includes(term);
        const matchesSku = (prod.sku || '').toLowerCase().includes(term);
        const matchesRef = (prod.referencia || '').toLowerCase().includes(term);
        if (!matchesCode && !matchesDesc && !matchesCat && !matchesBarcode && !matchesSku && !matchesRef) {
          return false;
        }
      }

      // 4. Date filtering (Data Inicial e Data Final)
      if (startDate || endDate) {
        const prodDate = (prod.createdAt || prod.updatedAt || '').slice(0, 10);
        if (prodDate) {
          if (startDate && prodDate < startDate) return false;
          if (endDate && prodDate > endDate) return false;
        }
      }

      return true;
    });
  }, [productList, activeTab, isEstoque, selectedCategory, searchTerm, startDate, endDate]);

  // Estoque pagination calculation
  const totalEstoquePages = useMemo(() => {
    if (estoqueItemsPerPage <= 0) return 1;
    return Math.max(1, Math.ceil(filteredEstoqueProducts.length / estoqueItemsPerPage));
  }, [filteredEstoqueProducts.length, estoqueItemsPerPage]);

  const paginatedEstoqueProducts = useMemo(() => {
    if (estoqueItemsPerPage <= 0) return filteredEstoqueProducts;
    const startIdx = (estoqueCurrentPage - 1) * estoqueItemsPerPage;
    return filteredEstoqueProducts.slice(startIdx, startIdx + estoqueItemsPerPage);
  }, [filteredEstoqueProducts, estoqueCurrentPage, estoqueItemsPerPage]);

  // Handle Print Action
  const handlePrint = () => {
    window.print();
  };

  // Exportar Relatórios em Arquivo Excel (.xlsx) com formatação completa e suporte multi-abas
  const exportToExcel = (mode: 'current' | 'all' = 'current') => {
    try {
      const wb = XLSX.utils.book_new();
      const dateFormatted = new Date().toISOString().split('T')[0];
      const periodoTexto = startDate && endDate
        ? `${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`
        : 'Histórico Completo';

      const getPeriodHeader = (subtitulo: string) => [
        ['SUBLIGESTÃO ERP - TECIDO SUBLIMADO FORTALEZA'],
        [subtitulo.toUpperCase()],
        [`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`],
        [`Período Selecionado: ${periodoTexto}`],
        [`Filtro Vendedor/Setor: ${selectedSeller === 'TODOS' ? 'Todos os Vendedores e Setores' : selectedSeller}`],
        [`Filtro de Venda: ${selectedTypeFilter === 'TODOS' ? 'Todas (OS + Venda Direta VND)' : selectedTypeFilter === 'VND' ? 'Apenas Vendas Diretas (VND)' : 'Apenas Ordens de Serviço (OS)'}`],
        [], // Linha de espaçamento
      ];

      // 1. Planilha de Vendas Consolidadas (OS / VND / TODOS)
      const createVendasSheet = (typeFilter: 'TODOS' | 'OS' | 'VND' = 'TODOS', customTitle?: string) => {
        const title = customTitle || (
          typeFilter === 'OS'
            ? 'Relatório de Vendas por Ordem de Serviço (OS)'
            : typeFilter === 'VND'
            ? 'Relatório de Vendas Diretas / Balcão (VND)'
            : 'Relatório Consolidado de Vendas (Ordens de Serviço & Vendas Diretas)'
        );
        const header = getPeriodHeader(title);
        const tableHeader = [
          'Código',
          'Tipo',
          'Data',
          'Cliente',
          'Vendedor / Atendente',
          'Forma de Pagamento',
          'Valor Total (R$)',
          'Entrada / Pago (R$)',
          'Saldo Pendente (R$)',
          'Status do Pagamento',
          'Qtd Itens',
          'Resumo dos Produtos / Serviços',
        ];

        const dataset = typeFilter === 'TODOS'
          ? salesListFilteredBySeller
          : salesListFilteredBySeller.filter((s) => s.tipo === typeFilter);

        const rows = dataset.map((s) => {
          const saldoRestante = Math.max(0, s.valorTotal - (s.valorEntrada || 0));
          const resumoItens = s.itens && s.itens.length > 0
            ? s.itens.map((i) => `${i.quantidade}x ${i.descricao}`).join(', ')
            : 'Venda Geral';

          return [
            s.codigo,
            s.tipo === 'VND' ? 'Venda Direta (VND)' : 'Ordem de Serviço (OS)',
            s.eraPendencia && s.dataOriginal && s.dataOriginal !== s.data
              ? `${s.data} (Origem: ${s.dataOriginal})`
              : (s.data || '-'),
            s.cliente || 'Cliente Não Informado',
            s.vendedor || 'Geral',
            s.formaPagamento || '-',
            s.valorTotal || 0,
            s.valorEntrada || 0,
            s.paymentStatus === 'pago' ? 0 : saldoRestante,
            s.paymentStatus === 'pago'
              ? (s.eraPendencia ? 'PAGO (ERA PENDÊNCIA)' : 'PAGO')
              : (s.isPendenteDeOutroDia ? 'PENDENTE (EM ABERTO)' : 'PENDENTE'),
            s.itens.reduce((acc, i) => acc + (i.quantidade || 1), 0),
            resumoItens,
          ];
        });

        const totalVendas = dataset.reduce((acc, s) => acc + (s.valorTotal || 0), 0);
        const totalEntradas = dataset.reduce((acc, s) => acc + (s.valorEntrada || 0), 0);
        const totalPendentes = dataset
          .filter((s) => s.paymentStatus !== 'pago')
          .reduce((acc, s) => acc + Math.max(0, s.valorTotal - (s.valorEntrada || 0)), 0);

        const totalsRow = [
          'TOTAL GERAL',
          '',
          '',
          '',
          '',
          '',
          totalVendas,
          totalEntradas,
          totalPendentes,
          `${dataset.length} Registros`,
          '',
          '',
        ];

        const data = [...header, tableHeader, ...rows, totalsRow];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [
          { wch: 18 }, // Código
          { wch: 24 }, // Tipo
          { wch: 14 }, // Data
          { wch: 32 }, // Cliente
          { wch: 24 }, // Vendedor
          { wch: 22 }, // Forma Pagamento
          { wch: 18 }, // Total
          { wch: 18 }, // Entrada
          { wch: 18 }, // Saldo Pendente
          { wch: 18 }, // Status
          { wch: 12 }, // Qtd Itens
          { wch: 45 }, // Resumo
        ];
        return ws;
      };

      // 2. Planilha por Vendedor
      const createVendedorSheet = () => {
        const header = getPeriodHeader('Desempenho e Faturamento por Vendedora / Vendedor');
        const tableHeader = [
          'Vendedora / Vendedor',
          'Qtd de Vendas',
          'Total Faturado (R$)',
          'Ticket Médio (R$)',
          '% Participação no Total',
        ];
        const totalGeral = salesBySeller.reduce((acc, s) => acc + s.totalFaturado, 0);

        const rows = salesBySeller.map((s) => [
          s.vendedor,
          s.qtdVendas,
          s.totalFaturado,
          s.qtdVendas > 0 ? s.totalFaturado / s.qtdVendas : 0,
          totalGeral > 0 ? `${((s.totalFaturado / totalGeral) * 100).toFixed(2)}%` : '0%',
        ]);

        const totalQtd = salesBySeller.reduce((acc, s) => acc + s.qtdVendas, 0);
        const totalsRow = [
          'TOTAL CONSOLIDADO',
          totalQtd,
          totalGeral,
          totalQtd > 0 ? totalGeral / totalQtd : 0,
          '100.00%',
        ];

        const data = [...header, tableHeader, ...rows, totalsRow];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 20 }, { wch: 20 }];
        return ws;
      };

      // 3. Planilha por Cliente
      const createClienteSheet = () => {
        const header = getPeriodHeader('Relatório de Compras por Cliente');
        const tableHeader = [
          'Nome do Cliente',
          'Qtd de Pedidos',
          'Total em Compras (R$)',
          'Ticket Médio (R$)',
          'Última Transação',
          '% Participação',
        ];
        const totalGeral = salesByClient.reduce((acc, s) => acc + s.totalGasto, 0);

        const rows = salesByClient.map((s) => [
          s.cliente,
          s.qtdPedidos,
          s.totalGasto,
          s.qtdPedidos > 0 ? s.totalGasto / s.qtdPedidos : 0,
          s.ultimaVenda || '-',
          totalGeral > 0 ? `${((s.totalGasto / totalGeral) * 100).toFixed(2)}%` : '0%',
        ]);

        const totalPedidos = salesByClient.reduce((acc, s) => acc + s.qtdPedidos, 0);
        const totalsRow = [
          'TOTAL GERAL',
          totalPedidos,
          totalGeral,
          totalPedidos > 0 ? totalGeral / totalPedidos : 0,
          '',
          '100.00%',
        ];

        const data = [...header, tableHeader, ...rows, totalsRow];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 35 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 18 }, { wch: 18 }];
        return ws;
      };

      // 4. Planilha por Produto
      const createProdutoSheet = () => {
        const header = getPeriodHeader('Relatório de Produtos e Itens Mais Vendidos');
        const tableHeader = [
          'Produto / Serviço / Descrição',
          'Quantidade Vendida',
          'Valor Total Faturado (R$)',
          'Preço Médio Unitário (R$)',
          '% Participação no Total',
        ];
        const totalGeral = salesByProduct.reduce((acc, s) => acc + s.valorTotal, 0);

        const rows = salesByProduct.map((s) => [
          s.produto,
          s.qtdVendida,
          s.valorTotal,
          s.qtdVendida > 0 ? s.valorTotal / s.qtdVendida : 0,
          totalGeral > 0 ? `${((s.valorTotal / totalGeral) * 100).toFixed(2)}%` : '0%',
        ]);

        const totalQtd = salesByProduct.reduce((acc, s) => acc + s.qtdVendida, 0);
        const totalsRow = [
          'TOTAL GERAL DE PRODUTOS',
          totalQtd,
          totalGeral,
          totalQtd > 0 ? totalGeral / totalQtd : 0,
          '100.00%',
        ];

        const data = [...header, tableHeader, ...rows, totalsRow];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 42 }, { wch: 20 }, { wch: 24 }, { wch: 22 }, { wch: 20 }];
        return ws;
      };

      // 5. Planilha de Estoque
      const createEstoqueSheet = (customProducts?: ProductCatalog[], customTitle?: string) => {
        const prods = customProducts || (isEstoque ? filteredEstoqueProducts : productList);
        const title = customTitle || (
          activeTab === 'estoque_venda'
            ? 'Relatório de Produtos para Venda em OS / PDV'
            : activeTab === 'estoque_interno'
            ? 'Relatório de Produtos de Estoque Interno'
            : activeTab === 'estoque_categoria'
            ? `Relatório de Estoque por Categoria (${selectedCategory === 'TODAS' ? 'Todas as Categorias' : selectedCategory})`
            : activeTab === 'estoque_descricao'
            ? 'Relatório de Estoque por Descrição'
            : 'Relatório Geral de Estoque de Produtos'
        );
        const header = getPeriodHeader(title);
        const tableHeader = [
          'Código',
          'Descrição do Produto',
          'Categoria',
          'Unidade',
          'Qtd em Estoque',
          'Estoque Mínimo',
          'Custo Unitário (R$)',
          'Preço de Venda (R$)',
          'Valor Total em Estoque (R$)',
          'Destinação Comercial',
          'Status do Estoque',
        ];

        const rows = prods.map((p) => {
          const qty = p.estoqueAtual || 0;
          const precoVenda = p.valorUnitario || 0;
          const precoCusto = p.precoCusto || 0;
          const valorTotalItem = qty * precoVenda;
          const isBaixo = qty <= (p.estoqueMinimo || 5);
          return [
            p.codigo,
            p.descricao,
            p.categoria || 'Geral',
            p.unidade || 'UN',
            qty,
            p.estoqueMinimo || 0,
            precoCusto,
            precoVenda,
            valorTotalItem,
            p.paraVenda !== false ? 'PRODUTO PARA VENDA' : 'ESTOQUE INTERNO',
            isBaixo ? 'ESTOQUE BAIXO' : 'REGULAR',
          ];
        });

        const totalItens = prods.reduce((acc, p) => acc + (p.estoqueAtual || 0), 0);
        const totalEstoqueReais = prods.reduce(
          (acc, p) => acc + (p.estoqueAtual || 0) * (p.valorUnitario || 0),
          0
        );

        const totalsRow = [
          'TOTAL EM ESTOQUE',
          '',
          '',
          '',
          totalItens,
          '',
          '',
          '',
          totalEstoqueReais,
          '',
          `${prods.length} Itens`,
        ];

        const data = [...header, tableHeader, ...rows, totalsRow];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [
          { wch: 16 },
          { wch: 38 },
          { wch: 22 },
          { wch: 10 },
          { wch: 16 },
          { wch: 16 },
          { wch: 18 },
          { wch: 18 },
          { wch: 24 },
          { wch: 24 },
          { wch: 18 },
        ];
        return ws;
      };

      // 6. Planilha de Funcionários (Apenas usuários autorizados)
      const createFuncionariosSheet = () => {
        const header = getPeriodHeader('Quadro de Funcionários & Recursos Humanos');
        const tableHeader = [
          'Código',
          'Nome Completo',
          'CPF',
          'Cargo',
          'Setor',
          'Status',
          'Salário Base (R$)',
          'Comissão %',
        ];

        const rows = employeeList.map((e) => [
          e.codigo,
          `${e.nome} ${e.sobrenome || ''}`.trim(),
          e.cpf,
          e.cargo,
          e.setor,
          e.status === 'ACTIVE' ? 'ATIVO' : e.status === 'AFASTADO' ? 'AFASTADO' : 'INATIVO',
          e.salarioBase || 0,
          e.comissaoPorcentagem || 0,
        ]);

        const totalFolha = employeeList
          .filter((e) => e.status === 'ACTIVE')
          .reduce((acc, e) => acc + (e.salarioBase || 0), 0);
        const totalsRow = ['TOTAL FOLHA ATIVOS', '', '', '', '', '', totalFolha, ''];

        const data = [...header, tableHeader, ...rows, totalsRow];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [
          { wch: 16 },
          { wch: 32 },
          { wch: 18 },
          { wch: 24 },
          { wch: 22 },
          { wch: 14 },
          { wch: 20 },
          { wch: 14 },
        ];
        return ws;
      };

      if (mode === 'all') {
        XLSX.utils.book_append_sheet(wb, createVendasSheet('TODOS'), 'Vendas Gerais');
        XLSX.utils.book_append_sheet(wb, createVendasSheet('OS', 'Vendas Por Ordem de Serviço (OS)'), 'Por OS');
        XLSX.utils.book_append_sheet(wb, createVendasSheet('VND', 'Vendas Diretas / Balcão (VND)'), 'Por VND');
        XLSX.utils.book_append_sheet(wb, createVendedorSheet(), 'Por Vendedora');
        XLSX.utils.book_append_sheet(wb, createClienteSheet(), 'Por Cliente');
        if (isEstoque) {
          XLSX.utils.book_append_sheet(wb, createEstoqueSheet(), 'Estoque Total');
        }
        XLSX.writeFile(wb, `Relatorio_Completo_SubliGestao_${dateFormatted}.xlsx`);
      } else {
        let fileName = `Relatorio_${activeTab}_${dateFormatted}.xlsx`;
        if (activeTab === 'vendas_gerais' || activeTab === 'listagem_analitica') {
          XLSX.utils.book_append_sheet(wb, createVendasSheet('TODOS'), 'Vendas Gerais');
          fileName = `Relatorio_Vendas_Gerais_${dateFormatted}.xlsx`;
        } else if (activeTab === 'por_os') {
          XLSX.utils.book_append_sheet(wb, createVendasSheet('OS', 'Vendas Por Ordem de Serviço (OS)'), 'Por OS');
          fileName = `Relatorio_Por_OS_${dateFormatted}.xlsx`;
        } else if (activeTab === 'por_vnd') {
          XLSX.utils.book_append_sheet(wb, createVendasSheet('VND', 'Vendas Diretas / Balcão (VND)'), 'Por VND');
          fileName = `Relatorio_Por_VND_${dateFormatted}.xlsx`;
        } else if (activeTab === 'vendas_vendedor') {
          XLSX.utils.book_append_sheet(wb, createVendedorSheet(), 'Por Vendedora');
          fileName = `Relatorio_Por_Vendedora_${dateFormatted}.xlsx`;
        } else if (activeTab === 'vendas_cliente') {
          XLSX.utils.book_append_sheet(wb, createClienteSheet(), 'Por Cliente');
          fileName = `Relatorio_Por_Cliente_${dateFormatted}.xlsx`;
        } else if (
          ['estoque_produtos', 'estoque_descricao', 'estoque_categoria', 'estoque_venda', 'estoque_interno'].includes(activeTab)
        ) {
          XLSX.utils.book_append_sheet(wb, createEstoqueSheet(), 'Estoque');
          fileName = `Relatorio_Estoque_${activeTab}_${dateFormatted}.xlsx`;
        } else {
          XLSX.utils.book_append_sheet(wb, createVendasSheet('TODOS'), 'Vendas Gerais');
          fileName = `Relatorio_SubliGestao_${dateFormatted}.xlsx`;
        }
        XLSX.writeFile(wb, fileName);
      }
    } catch (err) {
      console.error('Erro ao exportar arquivo Excel:', err);
      alert('Não foi possível gerar a exportação Excel. Tente novamente.');
    }
  };

  // Preset Date Controls - Data Final (Até) always remains current day
  const setPresetDates = (preset: 'today' | '30days' | '90days' | 'year' | 'all') => {
    setSelectedShortcut(preset);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (preset === 'today') {
      setStartDate(today);
    } else if (preset === '30days') {
      const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
    } else if (preset === '90days') {
      const past = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
    } else if (preset === 'year') {
      const firstDayYear = new Date(now.getFullYear(), 0, 1);
      setStartDate(firstDayYear.toISOString().split('T')[0]);
    } else if (preset === 'all') {
      setStartDate('');
    }
    setEndDate(today);
  };

  // Formatting currency
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  // Total sales revenue for percentage calculation
  const totalSalesRevenue = useMemo(() => {
    return salesList.reduce((acc, s) => acc + s.valorTotal, 0);
  }, [salesList]);

  return (
    <div className="space-y-6 pb-12">
      {/* PRINT HEADERS STYLING & MEDIA PRINT RULES */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 12pt !important;
          @page {
            size: landscape;
            margin: 10mm;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 9pt !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-card {
            border: 1px solid #94a3b8 !important;
            box-shadow: none !important;
            break-inside: avoid;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8.5pt !important;
            page-break-inside: auto !important;
          }
          .print-table tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          .print-table th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 800 !important;
            border: 1px solid #64748b !important;
            padding: 5px 6px !important;
            text-transform: uppercase !important;
            font-size: 8pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-table td {
            border: 1px solid #94a3b8 !important;
            padding: 4px 6px !important;
            color: #0f172a !important;
          }
          .print-table tbody tr:nth-child(even) {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-table tfoot tr, .print-table .excel-total-row {
            background-color: #e2e8f0 !important;
            font-weight: 800 !important;
            border-top: 2px solid #0f172a !important;
            border-bottom: 2px solid #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* OFFICIAL PRINT HEADER (VISIBLE ONLY DURING PRINTING - EXCEL STYLE) */}
      <div className="print-only mb-4 border-b-2 border-slate-900 pb-3">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              SUBLIGESTÃO ERP - TECIDO SUBLIMADO FORTALEZA
            </h1>
            <p className="text-[11px] font-bold text-slate-700">
              Relatório Oficial Emitido em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm font-black text-blue-900 block uppercase">
              {activeTab === 'vendas_gerais' && 'Relatório Geral de Vendas (OS & Balcão VND)'}
              {activeTab === 'por_os' && 'Relatório de Vendas por Ordem de Serviço (OS)'}
              {activeTab === 'por_vnd' && 'Relatório de Vendas Diretas / Balcão (VND)'}
              {activeTab === 'listagem_analitica' && 'Listagem Analítica de Vendas'}
              {activeTab === 'vendas_vendedor' && 'Relatório de Desempenho por Vendedora / Vendedor / Recepção'}
              {activeTab === 'vendas_cliente' && 'Relatório de Vendas por Cliente'}
              {activeTab === 'estoque_produtos' && 'Relatório de Estoque Total de Produtos'}
              {activeTab === 'estoque_venda' && 'Relatório de Produtos para Venda em OS / PDV'}
              {activeTab === 'estoque_interno' && 'Relatório de Produtos de Estoque Interno'}
            </span>
            <p className="text-[10px] font-semibold text-slate-600">
              {startDate && endDate
                ? startDate === endDate
                  ? `Período: ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} (Hoje)`
                  : `Período: ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`
                : 'Período: Histórico Completo'}
              {selectedSeller !== 'TODOS' ? ` • Vendedor/Recepção: ${selectedSeller}` : ''}
              {isEstoque && selectedCategory !== 'TODAS' ? ` • Categoria: ${selectedCategory}` : ''}
              {searchTerm.trim() ? ` • Filtro: "${searchTerm}"` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* SCREEN CONTAINER WITH FIXED LEFT SIDEBAR & RIGHT CONTENT */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* COLUNA FIXA AO LADO DO MENU (PANEL DE FILTROS) */}
        <aside className="no-print w-full lg:w-80 shrink-0 space-y-5 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm self-start lg:sticky lg:top-4">
          {isEstoque ? (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-500/20">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-base text-slate-900 tracking-tight">Filtros de Estoque</h2>
                  <p className="text-xs text-slate-500 font-medium">Controle de datas e busca</p>
                </div>
              </div>

              {/* DATA INICIAL (DE) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Data Inicial (De):
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* DATA FINAL (ATÉ) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Data Final (Até):
                </label>
                <input
                  type="date"
                  value={endDate || todayStr}
                  onChange={(e) => setEndDate(e.target.value || todayStr)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* BUSCA AUTOMÁTICA POR DESCRIÇÃO / CÓDIGO */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Por descrição (busca automatica):
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Digite o nome, código ou SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* FILTRO POR CATEGORIA */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Por Categoria:
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="TODAS">Todas as Categorias ({estoqueCategories.length})</option>
                  {estoqueCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* QUICK ACTIONS */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  onClick={() => { loadData(); }}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Buscar Dados
                </button>



                <button
                  type="button"
                  onClick={() => exportToExcel('current')}
                  className="w-full px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-black text-xs shadow-md shadow-green-700/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  title="Exportar dados da visualização atual para Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar Excel (.xlsx)
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-500/20">
                  <Filter className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-base text-slate-900 tracking-tight">Filtro de Período</h2>
                  <p className="text-xs text-slate-500 font-medium">Controle e datas do relatório</p>
                </div>
              </div>

              {/* DATA INICIAL (DE) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Data Inicial (De):
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* DATA FINAL (ATÉ) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Data Final (Até):
                </label>
                <input
                  type="date"
                  value={endDate || todayStr}
                  onChange={(e) => setEndDate(e.target.value || todayStr)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* CAIXA SELECIONÁVEL ATALHOS */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Caixa selecionável atalhos:
                </label>
                <select
                  value={selectedShortcut}
                  onChange={(e) => {
                    const val = e.target.value as 'today' | '30days' | '90days' | 'year' | 'all';
                    setPresetDates(val);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="today">Hoje</option>
                  <option value="30days">Últimos 30 Dias</option>
                  <option value="90days">Últimos 90 Dias</option>
                  <option value="year">Este Ano</option>
                  <option value="all">Todas as Datas</option>
                </select>

                {/* BUTTON SHORTCUT PILLS */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <button
                    type="button"
                    onClick={() => setPresetDates('today')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      selectedShortcut === 'today'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDates('30days')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      selectedShortcut === '30days'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Últimos 30d
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDates('90days')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      selectedShortcut === '90days'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Últimos 90d
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDates('year')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      selectedShortcut === 'year'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Este Ano
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDates('all')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      selectedShortcut === 'all'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Todas
                  </button>
                </div>
              </div>

              {/* BUSCA RÁPIDA NA TABELA */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Busca Rápida na Tabela:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome, código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* FILTRO VENDEDOR / CARGO / SETOR */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Vendedor / Cargo / Setor:
                </label>
                <select
                  value={selectedSeller}
                  onChange={(e) => setSelectedSeller(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="TODOS">Todos os Vendedores / Setores</option>
                  {sellerOptions.map((seller) => (
                    <option key={seller} value={seller}>
                      {seller}
                    </option>
                  ))}
                </select>
              </div>

              {/* FILTRO TIPO DE VENDA (TODOS / OS / VND) */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Tipo de Venda:
                </label>
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value as 'TODOS' | 'OS' | 'VND' | 'OSS')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="TODOS">Todas as Vendas (OS + VND + OSS)</option>
                  <option value="OS">Apenas Ordens de Serviço (Código OS)</option>
                  <option value="OSS">Apenas Ordens de Serviço Shopee (Código OSS)</option>
                  <option value="VND">Apenas Vendas Diretas (Código VND)</option>
                </select>
              </div>

              {/* QUICK ACTIONS */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  onClick={() => { loadData(); }}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Buscar Dados
                </button>



                <button
                  type="button"
                  onClick={() => exportToExcel('current')}
                  className="w-full px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-black text-xs shadow-md shadow-green-700/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  title="Exportar dados da visualização atual para Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar Excel (.xlsx)
                </button>

                <button
                  type="button"
                  onClick={() => exportToExcel('all')}
                  className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl font-bold text-[11px] border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Exportar todas as abas consolidadas em uma única planilha"
                >
                  <Download className="w-3.5 h-3.5 text-green-700" />
                  Exportar Pasta Completa (Excel)
                </button>
              </div>
            </>
          )}
        </aside>

        {/* MAIN CONTENT AREA (NO RESTANTE DA TELA) */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* SUBMENU MINIMALISTA APENAS CLICÁVEL (HORIZONTAL UM AO LADO DO OUTRO) */}
          <div className="no-print bg-white rounded-2xl p-2.5 border border-slate-200 shadow-xs mb-6">
            <nav className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm font-bold">
              {/* Funcionários button */}
              <button
                type="button"
                onClick={() => setActiveTab('funcionarios')}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'funcionarios'
                    ? 'bg-blue-600 text-white font-black shadow-sm'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100/70 bg-transparent'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Funcionários</span>
              </button>
              <span className="text-slate-300 font-light select-none">-</span>

              {/* 1. VENDAS GERAIS */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('vendas_gerais');
                  setSelectedTypeFilter('TODOS');
                }}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'vendas_gerais' || activeTab === 'listagem_analitica'
                    ? 'bg-blue-600 text-white font-black shadow-sm'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100/70 bg-transparent'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>VENDAS GERAIS</span>
              </button>
              <span className="text-slate-300 font-light select-none">-</span>

              {/* 2. POR OS */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('por_os');
                }}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'por_os'
                    ? 'bg-blue-600 text-white font-black shadow-sm'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100/70 bg-transparent'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>POR OS</span>
              </button>
              <span className="text-slate-300 font-light select-none">-</span>

              {/* 3. POR VND */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('por_vnd');
                }}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'por_vnd'
                    ? 'bg-emerald-600 text-white font-black shadow-sm'
                    : 'text-slate-600 hover:text-emerald-600 hover:bg-slate-100/70 bg-transparent'
                }`}
              >
                <Tag className="w-4 h-4" />
                <span>POR VND</span>
              </button>
              <span className="text-slate-300 font-light select-none">-</span>

              {/* 4. POR VENDEDORA */}
              <button
                type="button"
                onClick={() => setActiveTab('vendas_vendedor')}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'vendas_vendedor'
                    ? 'bg-blue-600 text-white font-black shadow-sm'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100/70 bg-transparent'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>POR VENDEDORA</span>
              </button>
              <span className="text-slate-300 font-light select-none">-</span>

              {/* 5. POR CLIENTE */}
              <button
                type="button"
                onClick={() => setActiveTab('vendas_cliente')}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'vendas_cliente'
                    ? 'bg-blue-600 text-white font-black shadow-sm'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100/70 bg-transparent'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>POR CLIENTE</span>
              </button>
              <span className="text-slate-300 font-light select-none">-</span>

              {/* 6. Estoque Total */}
              <button
                type="button"
                onClick={() => setActiveTab('estoque_produtos')}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'estoque_produtos' || activeTab === 'estoque_descricao' || activeTab === 'estoque_categoria'
                    ? 'bg-blue-600 text-white font-black shadow-sm'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100/70 bg-transparent'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Estoque Total</span>
              </button>
              <span className="text-slate-300 font-light select-none">-</span>

              {/* 7. Por Produto */}
              <button
                type="button"
                onClick={() => setActiveTab('vendas_produto')}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'vendas_produto'
                    ? 'bg-blue-600 text-white font-black shadow-sm'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100/70 bg-transparent'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Por Produto</span>
              </button>

              {/* ACTION SHORTCUTS (IMPRIMIR E EXPORTAR EXCEL) */}
              <div className="ml-auto flex items-center gap-2 pt-2 sm:pt-0 w-full sm:w-auto justify-end border-t sm:border-t-0 border-slate-100">

                <button
                  type="button"
                  onClick={() => exportToExcel('current')}
                  className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Exportar Visualização Atual para Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Exportar Excel</span>
                </button>
              </div>
            </nav>
          </div>

      {/* REPORT CONTENT VIEW */}
      {isLoading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="font-extrabold text-base text-slate-700">Carregando dados consolidados para o relatório...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1, 2, 3 & LISTAGEM: VENDAS GERAIS / POR OS / POR VND */}
          {(activeTab === 'vendas_gerais' || activeTab === 'por_os' || activeTab === 'por_vnd' || activeTab === 'listagem_analitica') && (
            <div className="space-y-6">
              {/* RESUMO MINIMALISTA E LISTA DE OS: PENDENTES / PAGOS */}
              {renderPendentesEPagosCards()}

              {/* Table List */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print-card">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center no-print">
                  <h2 className="text-lg font-black text-slate-900">
                    {activeTab === 'por_os'
                      ? 'Listagem Analítica - Ordens de Serviço (OS)'
                      : activeTab === 'por_vnd'
                      ? 'Listagem Analítica - Vendas Diretas (VND / Balcão)'
                      : 'Listagem Analítica de Vendas Gerais (OS & Balcão VND)'}
                  </h2>
                  <span className="text-sm font-bold text-slate-500">
                    Exibindo {salesListFilteredBySeller.length} registro(s)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  {/* ON SCREEN INTERACTIVE TABLE */}
                  <table className="w-full text-left no-print">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-sm uppercase">
                      <tr>
                        <th className="p-4">Código</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4">Data</th>
                        <th className="p-4">Cliente</th>
                        <th className="p-4">Vendedor / Recepção</th>
                        <th className="p-4">Forma Pagamento</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-sm text-slate-800">
                      {salesListFilteredBySeller
                        .filter((s) => {
                          if (!searchTerm) return true;
                          const t = searchTerm.toLowerCase();
                          return (
                            s.codigo.toLowerCase().includes(t) ||
                            s.cliente.toLowerCase().includes(t) ||
                            s.vendedor.toLowerCase().includes(t) ||
                            s.formaPagamento.toLowerCase().includes(t)
                          );
                        })
                        .map((sale) => {
                          const osCodeDisplay = sale.codigo
                            ? sale.codigo.toUpperCase().startsWith('OS') ||
                              sale.codigo.toUpperCase().startsWith('PDV') ||
                              sale.codigo.toUpperCase().startsWith('VND') ||
                              sale.codigo.toUpperCase().startsWith('CDV')
                              ? sale.codigo
                              : sale.tipo === 'OS'
                              ? `OS #${sale.codigo}`
                              : sale.codigo
                            : sale.id
                            ? `OS #${sale.id}`
                            : 'OS-001';

                          return (
                            <tr
                              key={sale.id}
                              onClick={() => handleOpenOsDetailBySale(sale)}
                              className="hover:bg-blue-50/60 transition cursor-pointer group"
                            >
                              <td className={`p-4 font-black flex items-center gap-2 ${
                                sale.tipo === 'VND' ? 'text-emerald-700' : 'text-blue-700'
                              }`}>
                                <span>{osCodeDisplay}</span>
                                <ArrowUpRight className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition ${
                                  sale.tipo === 'VND' ? 'text-emerald-400' : 'text-blue-400'
                                }`} />
                              </td>
                              <td className="p-4">
                                <span
                                  className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                                    sale.tipo === 'OSS'
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : sale.tipo === 'OS'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {sale.tipo === 'OSS' ? '🛍️ OSS' : sale.tipo}
                                </span>
                              </td>
                              <td className="p-4">
                                {sale.eraPendencia ? (
                                  <div>
                                    <span className="font-bold text-slate-800">{sale.data}</span>
                                    {sale.dataOriginal && sale.dataOriginal !== sale.data && (
                                      <span className="text-[10px] text-slate-400 block font-normal">
                                        Origem: {sale.dataOriginal}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span>{sale.data || 'N/I'}</span>
                                )}
                              </td>
                              <td className="p-4 font-bold">{sale.cliente}</td>
                              <td className="p-4">{sale.vendedor}</td>
                              <td className="p-4">{sale.formaPagamento}</td>
                              <td className="p-4">
                                {sale.paymentStatus === 'pago' ? (
                                  sale.eraPendencia ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="px-2 py-0.5 rounded-md text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 w-fit">
                                        ✓ Pago
                                      </span>
                                      <span className="text-[10px] font-black text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 w-fit">
                                        Era Pendência
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md text-xs font-black bg-emerald-100 text-emerald-800 w-fit">
                                      ✓ Pago
                                    </span>
                                  )
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="px-2 py-0.5 rounded-md text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 w-fit">
                                      ⏳ Pendente
                                    </span>
                                    {sale.isPendenteDeOutroDia && (
                                      <span className="text-[10px] font-bold text-amber-700">
                                        Desde {sale.dataOriginal || sale.data}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="p-4 text-right font-black text-slate-900">
                                {formatMoney(sale.valorTotal)}
                              </td>
                            </tr>
                          );
                        })}

                      {salesList.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 font-bold">
                            Nenhuma venda registrada no período selecionado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VENDAS POR VENDEDOR */}
          {activeTab === 'vendas_vendedor' && (
            <div className="space-y-6">
              {/* RESUMO E LISTA DE OS: PENDENTES / PAGOS POR VENDEDOR */}
              {renderPendentesEPagosCards('Por Vendedor')}

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print-card">
                <div className="p-5 border-b border-slate-100 no-print flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      Listagem Analítica Por Vendedor / Recepção
                    </h2>
                    <p className="text-sm font-semibold text-slate-500">
                      Consolidado de faturamento e volume de pedidos agrupado por funcionário/vendedor/recepção
                    </p>
                  </div>
                  {selectedSeller !== 'TODOS' && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 font-black text-xs rounded-xl">
                      Filtrado por: {selectedSeller}
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  {/* ON SCREEN TABLE */}
                  <table className="w-full text-left no-print">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-sm uppercase">
                      <tr>
                        <th className="p-4">Vendedor / Recepção</th>
                        <th className="p-4 text-center">Qtd de Vendas</th>
                        <th className="p-4 text-right">Total Faturado</th>
                        <th className="p-4 text-right">Ticket Médio</th>
                        <th className="p-4 text-right">% do Faturamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-sm text-slate-800">
                      {salesBySeller
                        .filter((s) => s.vendedor.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((seller, idx) => {
                          const percent = totalSalesRevenue > 0 ? (seller.totalFaturado / totalSalesRevenue) * 100 : 0;
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                              <td className="p-4 font-extrabold text-slate-900 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-black flex items-center justify-center">
                                  #{idx + 1}
                                </span>
                                {seller.vendedor}
                              </td>
                              <td className="p-4 text-center font-bold">{seller.qtdVendas}</td>
                              <td className="p-4 text-right font-black text-emerald-600">
                                {formatMoney(seller.totalFaturado)}
                              </td>
                              <td className="p-4 text-right font-bold">
                                {formatMoney(seller.qtdVendas > 0 ? seller.totalFaturado / seller.qtdVendas : 0)}
                              </td>
                              <td className="p-4 text-right font-black text-blue-700">
                                {percent.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}

                      {salesBySeller.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500 font-bold">
                            Nenhum registro de vendedor para o período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* PRINT TABLE (EXCEL SPREADSHEET STYLE) */}
                  <table className="w-full text-left border-collapse print-only print-table text-[10px] font-mono">
                    <thead className="bg-slate-100 text-slate-900 font-black uppercase">
                      <tr>
                        <th className="p-1.5 border border-slate-400 text-center w-8">#</th>
                        <th className="p-1.5 border border-slate-400">Vendedora / Vendedor / Recepção</th>
                        <th className="p-1.5 border border-slate-400 text-center w-28">Qtd Vendas</th>
                        <th className="p-1.5 border border-slate-400 text-right w-32">Total Faturado</th>
                        <th className="p-1.5 border border-slate-400 text-right w-32">Ticket Médio</th>
                        <th className="p-1.5 border border-slate-400 text-right w-28">% Faturamento</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-900">
                      {salesBySeller
                        .filter((s) => s.vendedor.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((seller, idx) => {
                          const percent = totalSalesRevenue > 0 ? (seller.totalFaturado / totalSalesRevenue) * 100 : 0;
                          return (
                            <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                              <td className="p-1.5 border border-slate-300 text-center">{idx + 1}</td>
                              <td className="p-1.5 border border-slate-300 font-sans font-bold">{seller.vendedor}</td>
                              <td className="p-1.5 border border-slate-300 text-center font-bold">{seller.qtdVendas}</td>
                              <td className="p-1.5 border border-slate-300 text-right font-bold text-emerald-800">
                                {formatMoney(seller.totalFaturado)}
                              </td>
                              <td className="p-1.5 border border-slate-300 text-right">
                                {formatMoney(seller.qtdVendas > 0 ? seller.totalFaturado / seller.qtdVendas : 0)}
                              </td>
                              <td className="p-1.5 border border-slate-300 text-right font-bold">
                                {percent.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      {/* SUMMARY FOOTER ROW */}
                      <tr className="bg-slate-200 font-bold border-t-2 border-slate-800">
                        <td colSpan={2} className="p-2 border border-slate-400 text-right uppercase">
                          Totais Consolidados:
                        </td>
                        <td className="p-2 border border-slate-400 text-center">
                          {salesBySeller.reduce((acc, s) => acc + s.qtdVendas, 0)}
                        </td>
                        <td className="p-2 border border-slate-400 text-right font-black">
                          {formatMoney(salesBySeller.reduce((acc, s) => acc + s.totalFaturado, 0))}
                        </td>
                        <td className="p-2 border border-slate-400 text-right">
                          {formatMoney(
                            salesBySeller.reduce((acc, s) => acc + s.qtdVendas, 0) > 0
                              ? salesBySeller.reduce((acc, s) => acc + s.totalFaturado, 0) /
                                  salesBySeller.reduce((acc, s) => acc + s.qtdVendas, 0)
                              : 0
                          )}
                        </td>
                        <td className="p-2 border border-slate-400 text-right">100.0%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VENDAS POR CLIENTE */}
          {activeTab === 'vendas_cliente' && (
            <div className="space-y-6">
              {/* RESUMO E LISTA DE OS: PENDENTES / PAGOS POR CLIENTE */}
              {renderPendentesEPagosCards('Por Cliente')}

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print-card">
                <div className="p-5 border-b border-slate-100 no-print">
                  <h2 className="text-lg font-black text-slate-900">
                    Listagem Analítica Por Cliente
                  </h2>
                  <p className="text-sm font-semibold text-slate-500">
                    Ranking de clientes que mais compraram no período selecionado
                  </p>
                </div>

                <div className="overflow-x-auto">
                  {/* ON SCREEN TABLE */}
                  <table className="w-full text-left no-print">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-sm uppercase">
                      <tr>
                        <th className="p-4">Cliente</th>
                        <th className="p-4 text-center">Qtd de Pedidos</th>
                        <th className="p-4 text-right">Total Gasto</th>
                        <th className="p-4 text-right">Ticket Médio</th>
                        <th className="p-4 text-right">Última Compra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-sm text-slate-800">
                      {salesByClient
                        .filter((c) => c.cliente.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((cli, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-4 font-black text-slate-900">{cli.cliente}</td>
                            <td className="p-4 text-center font-bold">{cli.qtdPedidos}</td>
                            <td className="p-4 text-right font-black text-emerald-600">
                              {formatMoney(cli.totalGasto)}
                            </td>
                            <td className="p-4 text-right font-bold">
                              {formatMoney(cli.qtdPedidos > 0 ? cli.totalGasto / cli.qtdPedidos : 0)}
                            </td>
                            <td className="p-4 text-right">{cli.ultimaVenda || 'N/I'}</td>
                          </tr>
                        ))}

                      {salesByClient.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500 font-bold">
                            Nenhum cliente registrado no período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* PRINT TABLE (EXCEL SPREADSHEET STYLE) */}
                  <table className="w-full text-left border-collapse print-only print-table text-[10px] font-mono">
                    <thead className="bg-slate-100 text-slate-900 font-black uppercase">
                      <tr>
                        <th className="p-1.5 border border-slate-400 text-center w-8">#</th>
                        <th className="p-1.5 border border-slate-400">Cliente</th>
                        <th className="p-1.5 border border-slate-400 text-center w-28">Qtd Pedidos</th>
                        <th className="p-1.5 border border-slate-400 text-right w-32">Total Gasto</th>
                        <th className="p-1.5 border border-slate-400 text-right w-32">Ticket Médio</th>
                        <th className="p-1.5 border border-slate-400 text-right w-28">Última Compra</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-900">
                      {salesByClient
                        .filter((c) => c.cliente.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((cli, idx) => (
                          <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="p-1.5 border border-slate-300 text-center">{idx + 1}</td>
                            <td className="p-1.5 border border-slate-300 font-sans font-bold">{cli.cliente}</td>
                            <td className="p-1.5 border border-slate-300 text-center font-bold">{cli.qtdPedidos}</td>
                            <td className="p-1.5 border border-slate-300 text-right font-bold text-emerald-800">
                              {formatMoney(cli.totalGasto)}
                            </td>
                            <td className="p-1.5 border border-slate-300 text-right">
                              {formatMoney(cli.qtdPedidos > 0 ? cli.totalGasto / cli.qtdPedidos : 0)}
                            </td>
                            <td className="p-1.5 border border-slate-300 text-right">{cli.ultimaVenda || '—'}</td>
                          </tr>
                        ))}
                      {/* SUMMARY FOOTER ROW */}
                      <tr className="bg-slate-200 font-bold border-t-2 border-slate-800">
                        <td colSpan={2} className="p-2 border border-slate-400 text-right uppercase">
                          Totais ({salesByClient.length} clientes):
                        </td>
                        <td className="p-2 border border-slate-400 text-center">
                          {salesByClient.reduce((acc, c) => acc + c.qtdPedidos, 0)}
                        </td>
                        <td className="p-2 border border-slate-400 text-right font-black">
                          {formatMoney(salesByClient.reduce((acc, c) => acc + c.totalGasto, 0))}
                        </td>
                        <td className="p-2 border border-slate-400 text-right">
                          {formatMoney(
                            salesByClient.reduce((acc, c) => acc + c.qtdPedidos, 0) > 0
                              ? salesByClient.reduce((acc, c) => acc + c.totalGasto, 0) /
                                  salesByClient.reduce((acc, c) => acc + c.qtdPedidos, 0)
                              : 0
                          )}
                        </td>
                        <td className="p-2 border border-slate-400 text-right">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ESTOQUE DE PRODUTOS E SUB-RELATÓRIOS DE ESTOQUE (EXCLUSIVO DO PERFIL ESTOQUE) */}
          {isEstoque &&
            ['estoque_produtos', 'estoque_descricao', 'estoque_categoria', 'estoque_venda', 'estoque_interno'].includes(activeTab) && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 no-print">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print-card">
                  <span className="text-sm font-bold text-slate-500 block mb-1">Itens Filtrados</span>
                  <span className="text-2xl font-black text-slate-900 block">{filteredEstoqueProducts.length}</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print-card">
                  <span className="text-sm font-bold text-slate-500 block mb-1">Total Peças / Unidades</span>
                  <span className="text-2xl font-black text-blue-600 block">
                    {filteredEstoqueProducts.reduce((acc, p) => acc + (p.estoqueAtual || 0), 0)}
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print-card">
                  <span className="text-sm font-bold text-slate-500 block mb-1">Estoque Baixo / Crítico</span>
                  <span className="text-2xl font-black text-amber-600 block">
                    {
                      filteredEstoqueProducts.filter(
                        (p) => (p.estoqueAtual || 0) <= (p.estoqueMinimo || 5) && (p.estoqueAtual || 0) > 0
                      ).length
                    }
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print-card">
                  <span className="text-sm font-bold text-slate-500 block mb-1">Valor Total em Estoque (PV)</span>
                  <span className="text-2xl font-black text-emerald-600 block">
                    {formatMoney(
                      filteredEstoqueProducts.reduce((acc, p) => acc + (p.valorUnitario || 0) * (p.estoqueAtual || 0), 0)
                    )}
                  </span>
                </div>
              </div>

              {/* EXCEL MINIMALIST SPREADSHEET REPORT CONTAINER */}
              <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden print-card font-sans">
                {/* EXCEL TOP TOOLBAR (NO-PRINT) */}
                <div className="p-4 bg-slate-50 border-b border-slate-300 no-print flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: View Mode & Title */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase text-slate-500 tracking-wider mr-1">
                      Visualização:
                    </span>
                    <div className="inline-flex bg-slate-200 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setEstoqueViewMode('simple')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                          estoqueViewMode === 'simple'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <LayoutList className="w-3.5 h-3.5 text-blue-600" />
                        <span>Visualização Simples</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEstoqueViewMode('detailed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                          estoqueViewMode === 'detailed'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Visualização Detalhada</span>
                      </button>
                    </div>
                  </div>

                  {/* Right: Items per page (10, 20, 30, Todos) & Record count */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-600 whitespace-nowrap">
                        Itens em tela:
                      </label>
                      <select
                        value={estoqueItemsPerPage}
                        onChange={(e) => {
                          setEstoqueItemsPerPage(Number(e.target.value));
                          setEstoqueCurrentPage(1);
                        }}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                      >
                        <option value={10}>10 itens</option>
                        <option value={20}>20 itens</option>
                        <option value={30}>30 itens</option>
                        <option value={0}>Todos ({filteredEstoqueProducts.length})</option>
                      </select>
                    </div>

                    <div className="text-xs font-bold text-slate-600 bg-slate-200/70 px-3 py-1.5 rounded-lg">
                      {filteredEstoqueProducts.length > 0 ? (
                        <span>
                          {estoqueItemsPerPage > 0 ? (
                            <>
                              Exibindo {Math.min(filteredEstoqueProducts.length, (estoqueCurrentPage - 1) * estoqueItemsPerPage + 1)}-
                              {Math.min(filteredEstoqueProducts.length, estoqueCurrentPage * estoqueItemsPerPage)} de{' '}
                              <strong>{filteredEstoqueProducts.length}</strong> itens
                            </>
                          ) : (
                            <>Total: <strong>{filteredEstoqueProducts.length}</strong> itens</>
                          )}
                        </span>
                      ) : (
                        <span>0 itens</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* EXCEL SHEET TABLE CONTAINER */}
                <div className="overflow-x-auto">
                  {/* ON SCREEN TABLE (PAGINATED ACCORDING TO USER SETTING) */}
                  <table className="w-full text-left border-collapse no-print text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b-2 border-slate-300">
                      <tr>
                        <th className="p-2.5 border border-slate-300 text-center w-12 bg-slate-200/70 text-slate-600">
                          #
                        </th>
                        <th className="p-2.5 border border-slate-300 w-28">Código / SKU</th>
                        <th className="p-2.5 border border-slate-300">Descrição do Produto</th>
                        <th className="p-2.5 border border-slate-300 w-36">Categoria</th>
                        <th className="p-2.5 border border-slate-300 text-center w-16">UN</th>
                        <th className="p-2.5 border border-slate-300 text-center w-28">Estoque Atual</th>
                        {estoqueViewMode === 'detailed' && (
                          <>
                            <th className="p-2.5 border border-slate-300 text-center w-24">Est. Mínimo</th>
                            <th className="p-2.5 border border-slate-300 text-center w-28">Status</th>
                            <th className="p-2.5 border border-slate-300 text-center w-32">Destinação</th>
                          </>
                        )}
                        <th className="p-2.5 border border-slate-300 text-right w-28">Preço Venda</th>
                        <th className="p-2.5 border border-slate-300 text-right w-32">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                      {paginatedEstoqueProducts.map((prod, idx) => {
                        const rowIndex = estoqueItemsPerPage > 0 ? (estoqueCurrentPage - 1) * estoqueItemsPerPage + idx + 1 : idx + 1;
                        const qty = prod.estoqueAtual || 0;
                        const min = prod.estoqueMinimo || 5;
                        const totalVal = qty * (prod.valorUnitario || 0);
                        const isZero = qty <= 0;
                        const isLow = qty <= min && qty > 0;

                        return (
                          <tr
                            key={prod.id}
                            className={`transition hover:bg-blue-50/60 ${
                              idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                            }`}
                          >
                            <td className="p-2.5 border border-slate-200 text-center font-mono text-slate-400 bg-slate-50/80">
                              {rowIndex}
                            </td>
                            <td className="p-2.5 border border-slate-200 font-bold text-blue-800 font-mono">
                              {prod.codigo}
                            </td>
                            <td className="p-2.5 border border-slate-200 font-bold text-slate-900">
                              {prod.descricao}
                            </td>
                            <td className="p-2.5 border border-slate-200 text-slate-700">
                              {prod.categoria || 'Geral'}
                            </td>
                            <td className="p-2.5 border border-slate-200 text-center font-semibold text-slate-600">
                              {prod.unidade || 'UN'}
                            </td>
                            <td className="p-2.5 border border-slate-200 text-center font-mono font-bold">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-black ${
                                  isZero
                                    ? 'text-rose-700 bg-rose-50 border border-rose-200'
                                    : isLow
                                    ? 'text-amber-700 bg-amber-50 border border-amber-200'
                                    : 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                                }`}
                              >
                                {qty} {prod.unidade || 'UN'}
                              </span>
                            </td>

                            {estoqueViewMode === 'detailed' && (
                              <>
                                <td className="p-2.5 border border-slate-200 text-center font-mono text-slate-500">
                                  {min}
                                </td>
                                <td className="p-2.5 border border-slate-200 text-center">
                                  {isZero ? (
                                    <span className="text-rose-700 font-bold text-[11px]">Zerado</span>
                                  ) : isLow ? (
                                    <span className="text-amber-700 font-bold text-[11px]">Estoque Baixo</span>
                                  ) : (
                                    <span className="text-emerald-700 font-bold text-[11px]">Normal</span>
                                  )}
                                </td>
                                <td className="p-2.5 border border-slate-200 text-center">
                                  {prod.paraVenda !== false ? (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                                      Venda em OS
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
                                      Uso Interno
                                    </span>
                                  )}
                                </td>
                              </>
                            )}

                            <td className="p-2.5 border border-slate-200 text-right font-mono text-slate-700">
                              {formatMoney(prod.valorUnitario || 0)}
                            </td>
                            <td className="p-2.5 border border-slate-200 text-right font-mono font-bold text-slate-900">
                              {formatMoney(totalVal)}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredEstoqueProducts.length === 0 && (
                        <tr>
                          <td
                            colSpan={estoqueViewMode === 'detailed' ? 11 : 8}
                            className="p-8 text-center text-slate-500 font-bold bg-white"
                          >
                            Nenhum produto encontrado com os filtros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* PRINT TABLE (CONTAINS ALL FILTERED ITEMS FOR CLEAN EXCEL PRINTING) */}
                  <table className="w-full text-left border-collapse print-only print-table text-[10px] font-mono">
                    <thead className="bg-slate-100 text-slate-900 font-black uppercase">
                      <tr>
                        <th className="p-1.5 border border-slate-400 text-center w-8">#</th>
                        <th className="p-1.5 border border-slate-400 w-20">Código</th>
                        <th className="p-1.5 border border-slate-400">Descrição do Produto</th>
                        <th className="p-1.5 border border-slate-400 w-28">Categoria</th>
                        <th className="p-1.5 border border-slate-400 text-center w-10">UN</th>
                        <th className="p-1.5 border border-slate-400 text-center w-16">Estoque</th>
                        <th className="p-1.5 border border-slate-400 text-center w-14">Mínimo</th>
                        <th className="p-1.5 border border-slate-400 text-center w-20">Destinação</th>
                        <th className="p-1.5 border border-slate-400 text-right w-20">Preço Venda</th>
                        <th className="p-1.5 border border-slate-400 text-right w-24">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-900">
                      {filteredEstoqueProducts.map((prod, idx) => {
                        const qty = prod.estoqueAtual || 0;
                        const min = prod.estoqueMinimo || 5;
                        const totalVal = qty * (prod.valorUnitario || 0);

                        return (
                          <tr key={prod.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="p-1.5 border border-slate-300 text-center">{idx + 1}</td>
                            <td className="p-1.5 border border-slate-300 font-bold">{prod.codigo}</td>
                            <td className="p-1.5 border border-slate-300 font-sans">{prod.descricao}</td>
                            <td className="p-1.5 border border-slate-300">{prod.categoria || 'Geral'}</td>
                            <td className="p-1.5 border border-slate-300 text-center">{prod.unidade || 'UN'}</td>
                            <td className="p-1.5 border border-slate-300 text-center font-bold">{qty}</td>
                            <td className="p-1.5 border border-slate-300 text-center">{min}</td>
                            <td className="p-1.5 border border-slate-300 text-center">
                              {prod.paraVenda !== false ? 'Venda OS' : 'Interno'}
                            </td>
                            <td className="p-1.5 border border-slate-300 text-right">
                              {formatMoney(prod.valorUnitario || 0)}
                            </td>
                            <td className="p-1.5 border border-slate-300 text-right font-bold">
                              {formatMoney(totalVal)}
                            </td>
                          </tr>
                        );
                      })}
                      {/* SUMMARY FOOTER ROW IN PRINT */}
                      <tr className="bg-slate-200 font-bold border-t-2 border-slate-800">
                        <td colSpan={5} className="p-2 border border-slate-400 text-right uppercase">
                          Totais ({filteredEstoqueProducts.length} itens):
                        </td>
                        <td className="p-2 border border-slate-400 text-center">
                          {filteredEstoqueProducts.reduce((acc, p) => acc + (p.estoqueAtual || 0), 0)}
                        </td>
                        <td colSpan={3} className="p-2 border border-slate-400 text-right uppercase">
                          Valor Total em Estoque:
                        </td>
                        <td className="p-2 border border-slate-400 text-right">
                          {formatMoney(
                            filteredEstoqueProducts.reduce(
                              (acc, p) => acc + (p.valorUnitario || 0) * (p.estoqueAtual || 0),
                              0
                            )
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* EXCEL STATUS BAR & PAGINATION FOOTER (NO-PRINT) */}
                <div className="p-3 bg-slate-100 border-t border-slate-300 no-print flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  {/* Left: Summary Numbers (Excel style) */}
                  <div className="flex flex-wrap items-center gap-4 text-slate-700 font-semibold">
                    <div>
                      Linhas: <strong className="text-slate-900 font-mono">{filteredEstoqueProducts.length}</strong>
                    </div>
                    <span className="text-slate-300">|</span>
                    <div>
                      Soma Qtd Peças:{' '}
                      <strong className="text-blue-700 font-mono">
                        {filteredEstoqueProducts.reduce((acc, p) => acc + (p.estoqueAtual || 0), 0)}
                      </strong>
                    </div>
                    <span className="text-slate-300">|</span>
                    <div>
                      Soma Valor Total:{' '}
                      <strong className="text-emerald-700 font-mono">
                        {formatMoney(
                          filteredEstoqueProducts.reduce(
                            (acc, p) => acc + (p.valorUnitario || 0) * (p.estoqueAtual || 0),
                            0
                          )
                        )}
                      </strong>
                    </div>
                  </div>

                  {/* Right: Pagination Controls */}
                  {estoqueItemsPerPage > 0 && totalEstoquePages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEstoqueCurrentPage(1)}
                        disabled={estoqueCurrentPage === 1}
                        className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold"
                        title="Primeira página"
                      >
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEstoqueCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={estoqueCurrentPage === 1}
                        className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold"
                        title="Página anterior"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>

                      <span className="px-2.5 py-1 text-slate-700 font-bold">
                        Página <strong className="text-slate-900">{estoqueCurrentPage}</strong> de{' '}
                        <strong>{totalEstoquePages}</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => setEstoqueCurrentPage((prev) => Math.min(totalEstoquePages, prev + 1))}
                        disabled={estoqueCurrentPage === totalEstoquePages}
                        className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold"
                        title="Próxima página"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEstoqueCurrentPage(totalEstoquePages)}
                        disabled={estoqueCurrentPage === totalEstoquePages}
                        className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold"
                        title="Última página"
                      >
                        <ChevronsRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL TELA CHEIA: DETALHES DA OS / VENDA */}
      {selectedOsDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md overflow-y-auto flex flex-col p-2 sm:p-4 md:p-6 animate-in fade-in duration-200 no-print">
          <div className="bg-white w-full max-w-6xl mx-auto rounded-3xl shadow-2xl flex flex-col min-h-[90vh] my-auto overflow-hidden border border-slate-200">
            {/* TOP HEADER */}
            <div className="bg-slate-900 text-white p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedOsDetail(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition flex items-center gap-2 text-xs font-bold cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {selectedOsDetail.codigo.startsWith('OS')
                        ? selectedOsDetail.codigo
                        : `Ordem de Serviço #${selectedOsDetail.codigo}`}
                    </h2>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                        selectedOsDetail.paymentStatus === 'pago'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-amber-500 text-white shadow-xs'
                      }`}
                    >
                      {selectedOsDetail.paymentStatus === 'pago' ? 'Quitado / Pago' : 'Pendente'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Cliente: <strong className="text-slate-200">{selectedOsDetail.clienteNome || 'Cliente Geral'}</strong> • Data da Venda: {selectedOsDetail.dataVenda || 'N/I'} • Vendedor: {selectedOsDetail.operador || 'Atendente'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalActiveTab('impressao')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir A4</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOsDetail(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* TAB BAR NAVIGATION INSIDE MODAL */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex flex-wrap gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setModalActiveTab('detalhes')}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  modalActiveTab === 'detalhes'
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Detalhes & Itens</span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveTab('comprovantes')}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  modalActiveTab === 'comprovantes'
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Comprovantes de Pagamento</span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveTab('historico')}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  modalActiveTab === 'historico'
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Histórico & Alterações</span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveTab('impressao')}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  modalActiveTab === 'impressao'
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>Impressões & A4</span>
              </button>
            </div>

            {/* TAB CONTENT BODY */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* TAB 1: DETALHES & ITENS */}
              {modalActiveTab === 'detalhes' && (
                <div className="space-y-6">
                  {/* CARDS RESUMO FINANCEIRO */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Valor Total Final</span>
                      <span className="text-2xl font-black text-slate-900 block">
                        {formatMoney(selectedOsDetail.valorFinal || 0)}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">Subtotal sem descontos</span>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                      <span className="text-xs font-bold text-emerald-800 uppercase block mb-1">Valor Entrada / Pago</span>
                      <span className="text-2xl font-black text-emerald-900 block">
                        {formatMoney(selectedOsDetail.valorEntrada || (selectedOsDetail.paymentStatus === 'pago' ? selectedOsDetail.valorFinal : 0))}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Meio: {selectedOsDetail.formaPagamentoEntrada || selectedOsDetail.formaPagamento || 'Não especificado'}
                      </span>
                    </div>

                    <div className={`p-4 rounded-2xl border ${selectedOsDetail.paymentStatus === 'pago' ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                      <span className="text-xs font-bold text-slate-600 uppercase block mb-1">Saldo Restante</span>
                      <span className={`text-2xl font-black block ${selectedOsDetail.paymentStatus === 'pago' ? 'text-slate-700' : 'text-amber-900'}`}>
                        {formatMoney(Math.max(0, (selectedOsDetail.valorFinal || 0) - (selectedOsDetail.valorEntrada || (selectedOsDetail.paymentStatus === 'pago' ? selectedOsDetail.valorFinal : 0))))}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {selectedOsDetail.paymentStatus === 'pago' ? 'Totalmente quitado' : 'Aguardando pagamento do saldo'}
                      </span>
                    </div>
                  </div>

                  {/* GRID DADOS DO CLIENTE & PROCESSO */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">Cliente</span>
                      <p className="font-extrabold text-sm text-slate-900">{selectedOsDetail.clienteNome || 'Cliente Geral'}</p>
                      <p className="text-xs text-slate-500">CPF/CNPJ: {selectedOsDetail.clienteCpfCnpj || 'Não informado'}</p>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">Contato</span>
                      <p className="font-extrabold text-sm text-slate-900">{selectedOsDetail.clienteTelefone || 'Sem telefone'}</p>
                      <p className="text-xs text-slate-500">{selectedOsDetail.clienteEmail || 'Sem email'}</p>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">Datas</span>
                      <p className="font-bold text-xs text-slate-800">Emissão: {selectedOsDetail.dataVenda || 'N/I'}</p>
                      <p className="font-bold text-xs text-blue-700">Prazo Entrega: {selectedOsDetail.prazoEntrega || 'Não informado'}</p>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">Estágio de Produção</span>
                      <span className="inline-block mt-1 px-3 py-1 bg-blue-100 text-blue-900 font-black text-xs rounded-xl">
                        {selectedOsDetail.estagioAtual || 'Sistema'}
                      </span>
                    </div>
                  </div>

                  {/* TABELA DE ITENS */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                      <h3 className="font-black text-sm text-slate-900">Itens e Serviços Contratados</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase">
                          <tr>
                            <th className="p-3">Item / Código</th>
                            <th className="p-3">Descrição</th>
                            <th className="p-3">Unidade</th>
                            <th className="p-3 text-center">Qtd</th>
                            <th className="p-3 text-right">Valor Unit.</th>
                            <th className="p-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                          {selectedOsDetail.itens && selectedOsDetail.itens.length > 0 ? (
                            selectedOsDetail.itens.map((item, idx) => (
                              <tr key={item.id || idx}>
                                <td className="p-3 font-bold text-blue-700">{item.codigo || `#${idx + 1}`}</td>
                                <td className="p-3 font-extrabold">{item.descricao}</td>
                                <td className="p-3">{item.unidade || 'UN'}</td>
                                <td className="p-3 text-center font-bold">{item.quantidade}</td>
                                <td className="p-3 text-right">{formatMoney(item.valorUnitario)}</td>
                                <td className="p-3 text-right font-black text-slate-900">{formatMoney(item.total)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                                Nenhum item discriminado na OS.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* OBSERVAÇÕES & ANEXOS */}
                  {selectedOsDetail.observacoes && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Observações do Pedido</span>
                      <p className="text-xs font-medium text-slate-800 whitespace-pre-wrap">{selectedOsDetail.observacoes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: COMPROVANTES DE PAGAMENTO */}
              {modalActiveTab === 'comprovantes' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                        Comprovante & Registro de Pagamento
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                          selectedOsDetail.paymentStatus === 'pago'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {selectedOsDetail.paymentStatus === 'pago' ? 'Pagamento Concluído' : 'Aguardando Saldo'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[10px]">Forma de Pagamento Principal</span>
                        <p className="font-black text-sm text-slate-900">{selectedOsDetail.formaPagamento || 'Não informada'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[10px]">Entrada Registrada</span>
                        <p className="font-black text-sm text-emerald-800">
                          {formatMoney(selectedOsDetail.valorEntrada || 0)} ({selectedOsDetail.formaPagamentoEntrada || 'Entrada'})
                        </p>
                      </div>
                    </div>

                    {/* IMAGEM DO COMPROVANTE */}
                    {selectedOsDetail.comprovanteUrl ? (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-700 uppercase block">Anexo do Comprovante</span>
                        <div className="p-4 bg-slate-900 rounded-2xl flex flex-col items-center justify-center gap-3">
                          <img
                            src={selectedOsDetail.comprovanteUrl}
                            alt="Comprovante de Pagamento"
                            className="max-h-96 object-contain rounded-lg border border-slate-800"
                          />
                          <a
                            href={selectedOsDetail.comprovanteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Abrir Comprovante em Nova Aba
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-2">
                        <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="font-bold text-slate-700 text-sm">Comprovante Digital Lançado no Caixa</p>
                        <p className="text-xs text-slate-500">
                          A transação financeira foi baixada diretamente no módulo fiscal e caixa da empresa.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: HISTÓRICO & ALTERAÇÕES */}
              {modalActiveTab === 'historico' && (() => {
                const isVndSale = Boolean(
                  selectedOsDetail.codigo?.toUpperCase().startsWith('VND') ||
                  selectedOsDetail.codigo?.toUpperCase().startsWith('PDV') ||
                  selectedOsDetail.codigo?.toUpperCase().startsWith('CDV') ||
                  selectedOsDetail.observacoes?.toLowerCase().includes('venda') ||
                  selectedOsDetail.observacoes?.toLowerCase().includes('pdv')
                );

                return (
                  <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200">
                      <h3 className="font-black text-base text-slate-900 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        Linha do Tempo & Histórico de Alterações
                      </h3>

                      <div className="space-y-3">
                        {(() => {
                          const visibleHistory = filterVisibleHistory(selectedOsDetail.historicoEdicoes);
                          return visibleHistory.length > 0 ? (
                            visibleHistory.map((log) => (
                              <div key={log.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                <div className="p-2 bg-blue-100 text-blue-800 rounded-lg font-black text-xs shrink-0">
                                  <Clock className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-xs text-slate-900">{log.acao}</span>
                                    <span className="text-[10px] font-semibold text-slate-400">• {log.dataHora}</span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-0.5">{log.detalhes || 'Sem detalhes adicionais'}</p>
                                  <span className="text-[10px] font-bold text-blue-700 block mt-1">Por: {log.usuario}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="space-y-3">
                              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg font-black text-xs shrink-0">
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-xs text-slate-900">
                                      {isVndSale ? 'Lançamento de VENDA' : 'Abertura e Lançamento de OS'}
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-400">• {selectedOsDetail.dataVenda || 'Data Registro'}</span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-0.5">
                                    {isVndSale
                                      ? `Venda Direta registrada e vinculada ao cliente ${selectedOsDetail.clienteNome || 'Consumidor Final'}.`
                                      : `Ordem de Serviço criada e vinculada ao cliente ${selectedOsDetail.clienteNome || 'Cliente não informado'}.`}
                                  </p>
                                  <span className="text-[10px] font-bold text-blue-700 block mt-1">Operador: {selectedOsDetail.operador || 'Atendente'}</span>
                                </div>
                              </div>

                              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                <div className="p-2 bg-blue-100 text-blue-800 rounded-lg font-black text-xs shrink-0">
                                  <Tag className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-xs text-slate-900">
                                      {isVndSale ? 'Status de Conclusão da Venda' : 'Estágio de Produção Atual'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-0.5">
                                    {isVndSale
                                      ? `Venda finalizada e processada pelo sistema.`
                                      : `Status produtivo atualizado para "${selectedOsDetail.estagioAtual || 'Sistema'}".`}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 4: IMPRESSÃO E A4 */}
              {modalActiveTab === 'impressao' && (
                <div className="bg-slate-100 p-4 rounded-2xl border border-slate-300 overflow-x-auto">
                  <OsPrintableA4 os={selectedOsDetail} onClose={() => setSelectedOsDetail(null)} inlineMode={true} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  );
};
