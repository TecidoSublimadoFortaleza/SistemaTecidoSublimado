import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PdvTransaction, OsItem, PaymentMethodType, ProductCatalog } from '../../server/types/os';
import { Client } from '../../server/types/client';
import { ApiService } from '../../services/api';
import { OsPrintableA4 } from '../os/OsPrintableA4';
import { ClientModuleView } from '../client/ClientModuleView';
import { compressImageFile } from '../../utils/imageCompressor';
import { getLoggedUserAndPerfil, isRoleAuthorizedForSales } from '../../utils/userPermissions';
import { NotificationService } from '../../utils/notificationService';
import {
  getClientDisplayName,
  matchClientSearch,
  buildClientSearchIndex,
  fastFilterClients,
} from '../../utils/clientSearch';
import {
  CreditCard,
  DollarSign,
  QrCode,
  Wallet,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  ShoppingBag,
  Printer,
  Sparkles,
  Plus,
  Trash2,
  Upload,
  FileCheck,
  Image as ImageIcon,
  Search,
  ShoppingCart,
  Users,
  UserPlus,
  Building2,
  ChevronDown,
  Edit2,
  Save,
  Filter,
  Calendar,
  TrendingUp,
  PackageCheck,
  FileText,
  RefreshCw,
} from 'lucide-react';

const formatMoney = (val: number): string => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface PdvVendaDiretaModuleProps {
  isSidebarExpanded?: boolean;
}

export const PdvVendaDiretaModule: React.FC<PdvVendaDiretaModuleProps> = ({
  isSidebarExpanded = false,
}) => {
  // Generate Venda Direta code
  const [vendaCodigo, setVendaCodigo] = useState<string>('VND000001');

  // Client info & Smart Search
  const [clienteNome, setClienteNome] = useState<string>('');
  const [clienteCpfCnpj, setClienteCpfCnpj] = useState<string>('');
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [selectedClientObj, setSelectedClientObj] = useState<Client | null>(null);
  const [showFullClientModal, setShowFullClientModal] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Client Purchases History State
  const [clientPurchases, setClientPurchases] = useState<Array<{
    codigo: string;
    data: string;
    total: number;
    tipo: 'OS' | 'VND';
    status: string;
  }>>([]);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState<boolean>(false);

  // Cart Items State & Catalog
  const [cartItens, setCartItens] = useState<OsItem[]>([]);
  const [productCatalog, setProductCatalog] = useState<ProductCatalog[]>([]);
  
  // Item Builder Inputs
  const [itemDescricao, setItemDescricao] = useState<string>('');
  const [itemCategoria, setItemCategoria] = useState<string>('');
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const [itemQuantidade, setItemQuantidade] = useState<number>(1);
  const [itemValorUnitario, setItemValorUnitario] = useState<string>('');
  const [itemPrecoMedio, setItemPrecoMedio] = useState<number>(0);
  const [itemUnidade, setItemUnidade] = useState<string>('UN');
  const [itemTipoDesconto, setItemTipoDesconto] = useState<'R$' | '%'>('R$');
  const [itemDescontoInput, setItemDescontoInput] = useState<string>('0');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const descricaoInputRef = useRef<HTMLInputElement>(null);

  // Payment method
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethodType>('Dinheiro');
  const [valorEntrada, setValorEntrada] = useState<string>('');
  const [formaEntrada, setFormaEntrada] = useState<string>('PIX');
  const [parcelasCartao, setParcelasCartao] = useState<number>(1);

  // Discount
  const [tipoDesconto, setTipoDesconto] = useState<'VALOR' | 'PERCENTUAL'>('VALOR');
  const [descontoInput, setDescontoInput] = useState<string>('0');

  // Receipt Upload
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);
  const [comprovanteFileName, setComprovanteFileName] = useState<string>('');
  const [isUploadingComprovante, setIsUploadingComprovante] = useState<boolean>(false);

  // Modals & Submitting
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Finished Transaction
  const [completedTx, setCompletedTx] = useState<PdvTransaction | null>(null);

  // Search VND Modal State (F3)
  const [showSearchVndModal, setShowSearchVndModal] = useState<boolean>(false);
  const [allVndTransactions, setAllVndTransactions] = useState<PdvTransaction[]>([]);
  const [isLoadingVndModal, setIsLoadingVndModal] = useState<boolean>(false);
  const [vndSearchQuery, setVndSearchQuery] = useState<string>('');
  const [selectedVndToPrint, setSelectedVndToPrint] = useState<PdvTransaction | null>(null);

  const userLoggedInfo = getLoggedUserAndPerfil();
  const loggedUser = userLoggedInfo.name;

  // Handle F3 key shortcut to open "PESQUISAR VND" modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        setShowSearchVndModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchVndTransactions = async () => {
    setIsLoadingVndModal(true);
    try {
      const txs = await ApiService.getPdvTransactions();
      const vnds = (txs || []).filter((t) => {
        const osCode = (t.osCodigo || '').toUpperCase();
        const cdvCode = (t.codigoVenda || '').toUpperCase();
        return !t.osId && !osCode.startsWith('OS') && !cdvCode.startsWith('CDV');
      });
      setAllVndTransactions(vnds);
    } catch {
      setAllVndTransactions([]);
    } finally {
      setIsLoadingVndModal(false);
    }
  };

  useEffect(() => {
    if (showSearchVndModal) {
      fetchVndTransactions();
    }
  }, [showSearchVndModal]);

  // Date filters for Gestão Integrada de Vendas Diretas
  const [vndShortcut, setVndShortcut] = useState<string>('all');
  const [vndStartDate, setVndStartDate] = useState<string>('');
  const [vndEndDate, setVndEndDate] = useState<string>('');

  const handleVndShortcutChange = (type: string) => {
    setVndShortcut(type);
    const now = new Date();
    if (type === 'today') {
      const d = now.toISOString().split('T')[0];
      setVndStartDate(d);
      setVndEndDate(d);
    } else if (type === '7days') {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setVndStartDate(start);
      setVndEndDate(now.toISOString().split('T')[0]);
    } else if (type === '30days') {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setVndStartDate(start);
      setVndEndDate(now.toISOString().split('T')[0]);
    } else if (type === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setVndStartDate(start);
      setVndEndDate(now.toISOString().split('T')[0]);
    } else if (type === 'all') {
      setVndStartDate('');
      setVndEndDate('');
    }
  };

  const filteredVndTransactions = allVndTransactions.filter((tx) => {
    const code = (tx.codigoVenda || tx.osCodigo || '').toUpperCase();
    if (code.startsWith('OS') || code.startsWith('CDV')) return false;

    // Date range filter
    if (vndStartDate || vndEndDate) {
      const txDateStr = tx.data || tx.createdAt;
      if (txDateStr) {
        let dt: Date | null = null;
        if (txDateStr.includes('/')) {
          const parts = txDateStr.split('/');
          if (parts.length === 3) {
            const yearPart = parts[2].split(' ')[0];
            dt = new Date(Number(yearPart), Number(parts[1]) - 1, Number(parts[0]));
          }
        } else {
          dt = new Date(txDateStr);
        }
        if (dt && !isNaN(dt.getTime())) {
          if (vndStartDate) {
            const start = new Date(vndStartDate + 'T00:00:00');
            if (dt < start) return false;
          }
          if (vndEndDate) {
            const end = new Date(vndEndDate + 'T23:59:59');
            if (dt > end) return false;
          }
        }
      }
    }

    if (!vndSearchQuery.trim()) return true;
    const q = vndSearchQuery.toLowerCase().trim();
    const client = (tx.clienteNome || '').toLowerCase();
    const doc = (tx.clienteCpfCnpj || '').toLowerCase();
    const op = (tx.operador || '').toLowerCase();
    const payment = (tx.formaPagamento || '').toLowerCase();
    const date = (tx.data || '').toLowerCase();
    const itemsStr = (tx.itens || []).map((i) => i.descricao.toLowerCase()).join(' ');

    return (
      code.toLowerCase().includes(q) ||
      client.includes(q) ||
      doc.includes(q) ||
      op.includes(q) ||
      payment.includes(q) ||
      date.includes(q) ||
      itemsStr.includes(q)
    );
  });

  const totalVndVal = filteredVndTransactions.reduce((acc, t) => acc + (t.valorTotal || 0), 0);
  const ticketMedioVnd = filteredVndTransactions.length > 0 ? totalVndVal / filteredVndTransactions.length : 0;
  const totalItensVendidos = filteredVndTransactions.reduce((acc, t) => {
    const itemsCount = (t.itens || []).reduce((iAcc, item) => iAcc + (item.quantidade || 0), 0);
    return acc + itemsCount;
  }, 0);

  // Load highest VND code & product catalog on mount
  useEffect(() => {
    const fetchNextCode = async () => {
      try {
        const txs = await ApiService.getPdvTransactions();
        const vndTxs = txs.filter((t) => t.osCodigo?.startsWith('VND'));
        let maxNum = 0;
        vndTxs.forEach((t) => {
          const numPart = parseInt(t.osCodigo?.replace(/\D/g, '') || '0', 10);
          if (numPart > maxNum) maxNum = numPart;
        });
        const nextCode = `VND${String(maxNum + 1).padStart(6, '0')}`;
        setVendaCodigo(nextCode);
      } catch {
        const randomCode = `VND${String(Math.floor(Math.random() * 900000) + 100000)}`;
        setVendaCodigo(randomCode);
      }
    };
    fetchNextCode();
    fetchClients();
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      const data = await ApiService.getProducts();
      setProductCatalog(data || []);
    } catch {
      setProductCatalog([]);
    }
  };

  // Fetch registered clients for smart search
  const fetchClients = async () => {
    try {
      const data = await ApiService.getClients();
      setClientsList(data || []);
    } catch {
      setClientsList([]);
    }
  };

  // Pré-indexação otimizada para mais de 12.000 clientes
  const indexedClients = useMemo(() => {
    return buildClientSearchIndex(clientsList);
  }, [clientsList]);

  // Smart Client Search Filtering (sub-milissegundo com memoização)
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) {
      return clientsList.slice(0, 20);
    }
    return fastFilterClients(indexedClients, clientSearchQuery)
      .slice(0, 30)
      .map((i) => i.client);
  }, [indexedClients, clientsList, clientSearchQuery]);

  const handleSelectClient = (client: Client) => {
    const name = getClientDisplayName(client);
    const doc = client.cpf || client.cnpj || '';

    setClienteNome(name || 'Cliente Cadastrado');
    setClienteCpfCnpj(doc);
    setSelectedClientObj(client);
    setClientSearchQuery('');
    setShowClientDropdown(false);
  };

  const handleClearClientSelection = () => {
    setSelectedClientObj(null);
    setClienteNome('');
    setClienteCpfCnpj('');
    setClientSearchQuery('');
  };

  // Fetch past purchases (OS / VND) for selected client
  useEffect(() => {
    const fetchClientHistory = async () => {
      if (!selectedClientObj || !clienteNome) {
        setClientPurchases([]);
        return;
      }
      setIsLoadingPurchases(true);
      try {
        const [pdvTxs, osList] = await Promise.all([
          ApiService.getPdvTransactions().catch(() => []),
          ApiService.getOrdensServico().catch(() => []),
        ]);

        const matchedPdv = (pdvTxs || [])
          .filter((t: any) => {
            if (!t) return false;
            // Exclude PDV transactions associated with an OS (payments for OS - CDV / OS)
            const osCode = (t.osCodigo || '').toUpperCase();
            const cdvCode = (t.codigoVenda || '').toUpperCase();
            if (t.osId || osCode.startsWith('OS') || cdvCode.startsWith('CDV')) {
              return false;
            }
            const nameMatch = t.clienteNome && clienteNome && t.clienteNome.toLowerCase().includes(clienteNome.toLowerCase());
            const docMatch = clienteCpfCnpj && t.clienteCpfCnpj && t.clienteCpfCnpj === clienteCpfCnpj;
            return nameMatch || docMatch;
          })
          .map((t: any) => ({
            codigo: t.codigoVenda || t.osCodigo || 'VND000000',
            data: t.data || (t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '-'),
            total: t.valorTotal || 0,
            tipo: 'VND' as const,
            status: (t.status === 'pago' || t.status === 'concluido' || !t.status || t.status === 'ACTIVE') ? 'PAGO' : 'PENDENTE',
          }));

        const matchedOs = (osList || [])
          .filter((o: any) => {
            if (!o) return false;
            const nameMatch = o.clienteNome && clienteNome && o.clienteNome.toLowerCase().includes(clienteNome.toLowerCase());
            const docMatch = clienteCpfCnpj && o.clienteCpfCnpj && o.clienteCpfCnpj === clienteCpfCnpj;
            return nameMatch || docMatch;
          })
          .map((o: any) => {
            let statusDisplay = 'PENDENTE';
            if (o.paymentStatus === 'pago') {
              statusDisplay = 'PAGO';
            } else if (o.paymentStatus === 'pendente') {
              statusDisplay = 'PENDENTE';
            } else if (o.paymentStatus === 'parcial') {
              statusDisplay = 'PARCIAL';
            } else if (o.estagioAtual === 'Finalizado' || o.estagioAtual === 'Entregue') {
              statusDisplay = 'PAGO';
            } else if (o.valorEntrada && o.valorFinal && o.valorEntrada >= o.valorFinal) {
              statusDisplay = 'PAGO';
            } else {
              statusDisplay = 'PENDENTE';
            }

            return {
              codigo: o.codigo || 'OS',
              data: o.dataVenda || (o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : '-'),
              total: o.valorFinal || o.subtotal || 0,
              tipo: 'OS' as const,
              status: statusDisplay,
            };
          });

        const combined = [...matchedPdv, ...matchedOs].slice(0, 5);
        setClientPurchases(combined);
      } catch {
        setClientPurchases([]);
      } finally {
        setIsLoadingPurchases(false);
      }
    };

    fetchClientHistory();
  }, [clienteNome, clienteCpfCnpj, selectedClientObj]);

  const formattedAddress = (client?: Client | null) => {
    if (!client || !client.endereco) return 'Endereço não informado';
    const addr = client.endereco;
    const parts = [
      addr.logradouro ? `${addr.logradouro}${addr.numero ? `, ${addr.numero}` : ''}` : '',
      addr.complemento,
      addr.bairro,
      addr.cidade && addr.estado ? `${addr.cidade}/${addr.estado}` : addr.cidade || addr.estado,
      addr.cep ? `CEP: ${addr.cep}` : '',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : 'Endereço não informado';
  };

  // Keyboard shortcut listener for ENTER
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isSubmitting) {
        if (showConfirmModal) {
          e.preventDefault();
          handleFinalizeVendaDireta();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConfirmModal, isSubmitting]);

  // Extract unique categories from catalog (excluding "geral")
  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    productCatalog.forEach((p) => {
      if (p.categoria && p.categoria.trim().length > 0) {
        const catTrimmed = p.categoria.trim();
        if (catTrimmed.toLowerCase() !== 'geral') {
          cats.add(catTrimmed);
        }
      }
    });
    return Array.from(cats).sort();
  }, [productCatalog]);

  // Helper para validar se uma categoria é cadastrada e válida (excluindo ALL / Todas as Categorias / Geral)
  const isRegisteredCategory = React.useCallback(
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

  // Categoria vinculada ao item em edição / inclusão
  const activeProductCategory = React.useMemo(() => {
    // 1. Categoria selecionada no dropdown
    const selectedCat = itemCategoria?.trim();
    if (selectedCat && isRegisteredCategory(selectedCat)) {
      return selectedCat;
    }
    // 2. Produto encontrado no catálogo
    const match = productCatalog.find(
      (p) => p.descricao.toLowerCase().trim() === itemDescricao.toLowerCase().trim()
    );
    if (match?.categoria && isRegisteredCategory(match.categoria)) {
      return match.categoria.trim();
    }
    // 3. Item em edição
    if (editingItemId) {
      const editItem = cartItens.find((i) => i.id === editingItemId);
      if (editItem?.categoria && isRegisteredCategory(editItem.categoria)) {
        return editItem.categoria.trim();
      }
    }
    return null;
  }, [itemCategoria, itemDescricao, productCatalog, editingItemId, cartItens, isRegisteredCategory]);

  const hasValidCategory = Boolean(activeProductCategory);
  const isMissingCategory = Boolean(itemDescricao.trim().length > 0 && !hasValidCategory);

  // Catalog Product Search Filtering
  const filteredProducts = React.useMemo(() => {
    return productCatalog.filter((p) => {
      const isInternalCategory =
        p.categoria &&
        (p.categoria.toLowerCase().includes('apenas estoque interno') ||
          p.categoria.toLowerCase() === 'estoque interno');
      if (isInternalCategory && p.paraVenda !== true) return false;

      const matchesCat =
        !itemCategoria ||
        itemCategoria === 'ALL' ||
        (p.categoria && p.categoria.toLowerCase() === itemCategoria.toLowerCase());

      if (!itemDescricao.trim()) return matchesCat;
      const query = itemDescricao.toLowerCase().trim();
      return (
        matchesCat &&
        (p.descricao.toLowerCase().includes(query) ||
          (p.sku && p.sku.toLowerCase().includes(query)) ||
          (p.codigo && p.codigo.toLowerCase().includes(query)) ||
          (p.referencia && p.referencia.toLowerCase().includes(query)) ||
          (p.codigoBarras && p.codigoBarras.toLowerCase().includes(query)))
      );
    });
  }, [productCatalog, itemCategoria, itemDescricao]);

  const handleSelectCatalogProduct = (prod: ProductCatalog) => {
    setItemDescricao(prod.descricao);
    if (prod.categoria && isRegisteredCategory(prod.categoria)) {
      setItemCategoria(prod.categoria);
    } else {
      setItemCategoria('');
    }
    setItemUnidade(prod.unidade || 'UN');
    setItemValorUnitario(String(prod.valorUnitario || 0));
    setItemPrecoMedio(prod.precoMedio || prod.valorUnitario || 0);
    setShowProductDropdown(false);
  };

  // Calculations
  const subtotal = cartItens.reduce((acc, item) => acc + item.total, 0);

  const discountVal = () => {
    const num = parseFloat(descontoInput.replace(',', '.')) || 0;
    if (tipoDesconto === 'PERCENTUAL') {
      return (subtotal * num) / 100;
    }
    return num;
  };

  const valorTotalCalculado = Math.max(0, subtotal - discountVal());
  const entradaNum = parseFloat(valorEntrada.replace(',', '.')) || 0;
  const saldoRestanteCalculado = formaPagamento === 'Com Entrada' ? Math.max(0, valorTotalCalculado - entradaNum) : 0;

  // Add or Update Product Item in Cart (OS Model)
  const handleAddOrUpdateProduct = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!itemDescricao.trim()) {
      setErrorMessage('Informe a descrição do produto ou serviço.');
      return;
    }

    if (!hasValidCategory || !activeProductCategory) {
      setErrorMessage('Produto não cadastrado! Selecione uma categoria cadastrada no catálogo.');
      return;
    }

    const valUnit = parseFloat(itemValorUnitario.replace(',', '.')) || 0;
    if (valUnit <= 0) {
      setErrorMessage('Informe um valor unitário válido maior que zero.');
      return;
    }

    const descNum = parseFloat(itemDescontoInput.replace(',', '.')) || 0;
    const descontoCalculado =
      itemTipoDesconto === '%'
        ? (valUnit * itemQuantidade * descNum) / 100
        : descNum;

    const itemTotal = Math.max(0, valUnit * itemQuantidade - descontoCalculado);

    const categoryToSave = activeProductCategory;

    if (editingItemId) {
      setCartItens((prev) =>
        prev.map((i) =>
          i.id === editingItemId
            ? {
                ...i,
                descricao: itemDescricao.trim(),
                categoria: categoryToSave || i.categoria || undefined,
                unidade: itemUnidade,
                quantidade: itemQuantidade,
                valorUnitario: valUnit,
                precoMedio: itemPrecoMedio || valUnit,
                desconto: descontoCalculado,
                total: itemTotal,
              }
            : i
        )
      );
      setEditingItemId(null);
    } else {
      const productIndex = productCatalog.length + cartItens.length + 1;
      const newCode = `P${String(productIndex).padStart(7, '0')}`;
      const newItem: OsItem = {
        id: `ITEM-${Date.now()}`,
        codigo: newCode,
        descricao: itemDescricao.trim(),
        categoria: categoryToSave,
        unidade: itemUnidade,
        quantidade: itemQuantidade,
        valorUnitario: valUnit,
        precoMedio: itemPrecoMedio || valUnit,
        desconto: descontoCalculado,
        total: itemTotal,
      };

      setCartItens((prev) => [...prev, newItem]);

      // Automatically register product in backend catalog if new
      ApiService.createProduct({
        descricao: itemDescricao.trim(),
        categoria: categoryToSave,
        unidade: itemUnidade,
        valorUnitario: valUnit,
        precoMedio: itemPrecoMedio || valUnit,
        origemCadastro: 'OS_PDV',
        paraVenda: true,
      }).then(() => fetchCatalog()).catch(() => {});
    }

    // Reset item input fields
    setItemDescricao('');
    setItemCategoria('');
    setItemUnidade('UN');
    setItemQuantidade(1);
    setItemValorUnitario('');
    setItemPrecoMedio(0);
    setItemDescontoInput('0');
    setShowProductDropdown(false);
    setErrorMessage('');
  };

  const handleEditItem = (item: OsItem) => {
    setEditingItemId(item.id);
    setItemDescricao(item.descricao);
    setItemCategoria(item.categoria || '');
    setItemUnidade(item.unidade || 'UN');
    setItemQuantidade(item.quantidade);
    setItemValorUnitario(String(item.valorUnitario));
    setItemPrecoMedio(item.precoMedio || item.valorUnitario);
    setItemTipoDesconto('R$');
    setItemDescontoInput(String(item.desconto || 0));
    if (descricaoInputRef.current) {
      descricaoInputRef.current.focus();
    }
  };

  const handleRemoveItem = (id: string) => {
    setCartItens((prev) => prev.filter((item) => item.id !== id));
    if (editingItemId === id) {
      setEditingItemId(null);
      setItemDescricao('');
      setItemQuantidade(1);
      setItemValorUnitario('');
      setItemDescontoInput('0');
    }
  };

  // Receipt Upload
  const handleComprovanteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingComprovante(true);
    setErrorMessage('');
    try {
      const compressed = await compressImageFile(file);
      setComprovanteUrl(compressed);
      setComprovanteFileName(file.name);
    } catch {
      setErrorMessage('Erro ao carregar e comprimir o comprovante.');
    } finally {
      setIsUploadingComprovante(false);
    }
  };

  // Finalize Venda Direta
  const handleFinalizeVendaDireta = async () => {
    setErrorMessage('');

    const { role: userRole, isDeveloper } = getLoggedUserAndPerfil();
    if (!isRoleAuthorizedForSales(userRole, isDeveloper)) {
      setErrorMessage('Acesso Restrito: Apenas os cargos autorizados (Developer, CEO, Gerente Geral, Supervisor, Vendedor(a), Recepção) podem efetuar vendas no Caixa PDV.');
      setShowConfirmModal(false);
      return;
    }

    if (!selectedClientObj) {
      setErrorMessage('A seleção ou cadastro do cliente é obrigatória para finalizar a venda.');
      setShowConfirmModal(false);
      return;
    }

    if (cartItens.length === 0) {
      setErrorMessage('Adicione pelo menos 1 item ao carrinho de Vendas Diretas antes de finalizar.');
      setShowConfirmModal(false);
      return;
    }

    if (formaPagamento === 'Com Entrada') {
      if (entradaNum <= 0) {
        setErrorMessage('Para venda com entrada, informe um valor de entrada maior que zero.');
        setShowConfirmModal(false);
        return;
      }
      if (entradaNum >= valorTotalCalculado) {
        setErrorMessage('O valor de entrada não pode ser maior ou igual ao total. Escolha outra forma de pagamento.');
        setShowConfirmModal(false);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const isPaidFull = formaPagamento !== 'Com Entrada';

      const clientAddr = selectedClientObj?.endereco
        ? `${selectedClientObj.endereco.logradouro || ''}${selectedClientObj.endereco.numero ? `, Nº ${selectedClientObj.endereco.numero}` : ''}${selectedClientObj.endereco.complemento ? ` (${selectedClientObj.endereco.complemento})` : ''}${selectedClientObj.endereco.bairro ? ` - Bairro ${selectedClientObj.endereco.bairro}` : ''}${selectedClientObj.endereco.cidade ? `, ${selectedClientObj.endereco.cidade}` : ''}${selectedClientObj.endereco.estado ? `/${selectedClientObj.endereco.estado}` : ''}${selectedClientObj.endereco.cep ? ` - CEP: ${selectedClientObj.endereco.cep}` : ''}`
        : '';

      const payload = {
        osCodigo: vendaCodigo,
        clienteNome: clienteNome.trim() || 'Cliente Não Informado',
        clienteCpfCnpj: clienteCpfCnpj.trim() || '',
        clienteTelefone: selectedClientObj?.telefone || selectedClientObj?.celular || '',
        clienteEndereco: clientAddr,
        itens: cartItens,
        observacoes: 'Venda Direta realizada no Caixa PDV',
        formaPagamento,
        valorEntrada: formaPagamento === 'Com Entrada' ? entradaNum : undefined,
        formaPagamentoEntrada: formaPagamento === 'Com Entrada' ? formaEntrada : undefined,
        valorRestante: formaPagamento === 'Com Entrada' ? saldoRestanteCalculado : undefined,
        parcelasCartao: formaPagamento === 'Cartão de Crédito' ? parcelasCartao : undefined,
        comprovanteUrl: comprovanteUrl || undefined,
        subtotal,
        desconto: discountVal(),
        valorTotal: valorTotalCalculado,
        status: isPaidFull ? ('pago' as const) : ('pendente' as const),
        operador: loggedUser,
      };

      const newTx = await ApiService.createPdvTransaction(payload);
      NotificationService.notifyPdvSale(newTx, loggedUser);
      setCompletedTx(newTx);
      setShowConfirmModal(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao finalizar Venda Direta no Caixa PDV.');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetNewVenda = () => {
    setCompletedTx(null);
    setCartItens([]);
    setSelectedClientObj(null);
    setClienteNome('');
    setClienteCpfCnpj('');
    setDescontoInput('0');
    setValorEntrada('');
    setComprovanteUrl(null);
    setComprovanteFileName('');
    setFormaPagamento('Dinheiro');
    // Generate new code
    const numPart = parseInt(vendaCodigo.replace(/\D/g, '') || '0', 10);
    setVendaCodigo(`VND${String(numPart + 1).padStart(6, '0')}`);
  };

  // Render Gestão Integrada de VENDAS DIRETAS (F3) in full screen
  if (showSearchVndModal) {
    return (
      <div className="w-full space-y-6">
        {/* TOP HEADER / BAR */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-500/20">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Gestão Integrada de VENDAS DIRETAS</span>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-black">VND</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Consulta analítica, emissão de relatórios e controle de caixa das vendas diretas (PDV)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowSearchVndModal(false);
              setVndSearchQuery('');
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <ShoppingBag className="w-4 h-4 text-blue-400" />
            <span>
              ← Voltar à Frente de Caixa PDV
              <span className="hidden lg:inline"> (F3)</span>
            </span>
          </button>
        </div>

        {/* 3 COLUMNS / SIDEBAR & LIST LAYOUT */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* COLUMN 1: SIDEBAR CONTROLS & METRICS */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-4">
            {/* SEARCH & FILTER CARD */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                    <Filter className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 tracking-tight">Filtros de Venda</h2>
                    <p className="text-[11px] text-slate-500 font-medium">Consulta do caixa VND</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchVndTransactions}
                  disabled={isLoadingVndModal}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                  title="Atualizar Vendas"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingVndModal ? 'animate-spin text-blue-600' : ''}`} />
                </button>
              </div>

              {/* SEARCH INPUT */}
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={vndSearchQuery}
                  onChange={(e) => setVndSearchQuery(e.target.value)}
                  placeholder="Buscar por código VND, cliente, CPF, item..."
                  className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
                {vndSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setVndSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* DATE RANGE INPUTS */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Período de Consulta</span>
                <div className="flex flex-col gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="date"
                      value={vndStartDate}
                      onChange={(e) => {
                        setVndStartDate(e.target.value);
                        setVndShortcut('custom');
                      }}
                      className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none w-full"
                    />
                  </div>
                  <div className="text-center font-extrabold text-[10px] text-slate-400 uppercase tracking-wider">até</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="date"
                      value={vndEndDate}
                      onChange={(e) => {
                        setVndEndDate(e.target.value);
                        setVndShortcut('custom');
                      }}
                      className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none w-full"
                    />
                  </div>
                </div>
              </div>

              {/* DATE SHORTCUT BUTTONS */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleVndShortcutChange('today')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold text-center transition cursor-pointer ${
                    vndShortcut === 'today' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => handleVndShortcutChange('7days')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold text-center transition cursor-pointer ${
                    vndShortcut === '7days' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  7 Dias
                </button>
                <button
                  type="button"
                  onClick={() => handleVndShortcutChange('30days')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold text-center transition cursor-pointer ${
                    vndShortcut === '30days' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  30 Dias
                </button>
                <button
                  type="button"
                  onClick={() => handleVndShortcutChange('month')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold text-center transition cursor-pointer ${
                    vndShortcut === 'month' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Mês
                </button>
                <button
                  type="button"
                  onClick={() => handleVndShortcutChange('all')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold text-center transition cursor-pointer ${
                    vndShortcut === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos
                </button>
              </div>
            </div>

            {/* METRIC CARDS */}
            <div className="space-y-3">
              {/* CARD 1: TOTAL VENDAS VND */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Total de Vendas Diretas</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-2xl font-black text-slate-900">{filteredVndTransactions.length}</h3>
                    <span className="text-xs font-bold text-slate-500">Lançamentos</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold mt-1">
                    Faturamento: <strong className="text-slate-900">{formatMoney(totalVndVal)}</strong>
                  </p>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <ShoppingBag className="w-6 h-6" />
                </div>
              </div>

              {/* CARD 2: TICKET MÉDIO */}
              <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider block">Ticket Médio (VND)</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-2xl font-black text-emerald-600">{formatMoney(ticketMedioVnd)}</h3>
                  </div>
                  <p className="text-[11px] text-emerald-800 font-bold mt-1">
                    Média por atendimento de balcão
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

              {/* CARD 3: TOTAL DE ITENS VENDIDOS */}
              <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-extrabold text-indigo-800 uppercase tracking-wider block">Total de Itens Vendidos</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-2xl font-black text-indigo-600">{totalItensVendidos}</h3>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                      Produtos
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-800 font-bold mt-1">
                    Quantidade total de peças comercializadas
                  </p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <PackageCheck className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT AREA: TRANSACTIONS LIST */}
          <div className="flex-1 w-full bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">Histórico de Vendas Diretas (VND)</h2>
                    <span className="px-2.5 py-0.5 text-xs font-extrabold bg-blue-100 text-blue-800 rounded-full">
                      {filteredVndTransactions.length} registradas
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Relação completa de recebimentos do caixa de balcão
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-blue-700 block tracking-tight">
                  {formatMoney(totalVndVal)}
                </span>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Total Geral</span>
              </div>
            </div>

            {/* LIST OF TRANSACTIONS */}
            <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
              {isLoadingVndModal ? (
                <div className="p-12 text-center text-slate-400 font-bold text-sm">
                  Carregando vendas diretas...
                </div>
              ) : filteredVndTransactions.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-3xl space-y-2">
                  <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">Nenhuma Venda Direta (VND) encontrada.</p>
                  <p className="text-xs text-slate-400">
                    {vndSearchQuery ? `Nenhum resultado para "${vndSearchQuery}"` : 'Ainda não há vendas diretas lançadas no período selecionado.'}
                  </p>
                </div>
              ) : (
                filteredVndTransactions.map((tx) => {
                  const rawCode = tx.codigoVenda || tx.osCodigo || 'VND000000';
                  const code = rawCode.replace(/^CDV-?VND/i, 'VND');
                  return (
                    <div
                      key={tx.id}
                      className="bg-slate-50 hover:bg-blue-50/40 border border-slate-200 hover:border-blue-300 rounded-2xl p-4 transition-all space-y-3 shadow-2xs"
                    >
                      {/* HEADER ROW */}
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-black tracking-wide">
                            {code}
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {tx.clienteNome || 'Cliente Balcão'}
                          </span>
                          {tx.clienteCpfCnpj && (
                            <span className="text-xs font-extrabold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                              CPF/CNPJ: {tx.clienteCpfCnpj}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 font-medium">
                            {tx.data} {tx.hora ? `• ${tx.hora}` : ''}
                          </span>
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-black uppercase">
                            {tx.status === 'pendente' ? 'PENDENTE' : 'PAGO'}
                          </span>
                        </div>
                      </div>

                      {/* ITEMS TABLE */}
                      <div className="bg-white border border-slate-200/70 rounded-xl p-3 space-y-1.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                          Itens da Venda ({tx.itens?.length || 0})
                        </span>
                        <div className="divide-y divide-slate-100 text-xs">
                          {(tx.itens || []).map((item, idx) => (
                            <div key={idx} className="py-1 flex items-center justify-between text-slate-800">
                              <span className="font-bold">
                                {item.quantidade}x {item.descricao} ({item.unidade || 'UN'})
                              </span>
                              <span className="font-mono text-slate-700 font-bold">
                                {formatMoney(item.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* FOOTER INFO & ACTIONS */}
                      <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                        <div className="text-xs text-slate-600 font-medium flex items-center gap-4 flex-wrap">
                          <span>
                            Forma de Pgto: <strong className="text-slate-900">{tx.formaPagamento}</strong>
                          </span>
                          <span>
                            Operador: <strong className="text-slate-900">{tx.operador}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-extrabold block uppercase">Valor Total</span>
                            <span className="text-lg font-black text-blue-700">{formatMoney(tx.valorTotal || 0)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedVndToPrint(tx)}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                          >
                            <Printer className="w-4 h-4 text-blue-400" />
                            <span>Imprimir / Ver Recibo</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* PRINT RECEIPT VIEW */}
        {selectedVndToPrint && (
          <OsPrintableA4
            os={{
              id: selectedVndToPrint.id,
              codigo: selectedVndToPrint.osCodigo || selectedVndToPrint.codigoVenda || 'VND000000',
              dataVenda: selectedVndToPrint.data || selectedVndToPrint.createdAt,
              operador: selectedVndToPrint.operador || loggedUser,
              clienteNome: selectedVndToPrint.clienteNome,
              clienteCpfCnpj: selectedVndToPrint.clienteCpfCnpj,
              clienteTelefone: selectedVndToPrint.clienteTelefone,
              clienteEndereco: selectedVndToPrint.clienteEndereco,
              itens: selectedVndToPrint.itens || [],
              subtotal: selectedVndToPrint.subtotal,
              desconto: selectedVndToPrint.desconto,
              valorFinal: selectedVndToPrint.valorTotal,
              valorTotal: selectedVndToPrint.valorTotal,
              formaPagamento: selectedVndToPrint.formaPagamento,
              valorEntrada: selectedVndToPrint.valorEntrada,
              valorRestante: selectedVndToPrint.valorRestante,
              formaPagamentoEntrada: selectedVndToPrint.formaPagamentoEntrada,
              prazoEntrega: (selectedVndToPrint as any).prazoEntrega,
              paymentStatus: selectedVndToPrint.status,
              comprovanteUrl: selectedVndToPrint.comprovanteUrl,
              observacoes: selectedVndToPrint.observacoes,
              estagioAtual: 'Finalizado',
            } as any}
            pdvTx={selectedVndToPrint}
            initialDocType="OS"
            isSidebarExpanded={isSidebarExpanded}
            onClose={() => setSelectedVndToPrint(null)}
          />
        )}
      </div>
    );
  }

  // Render Printable Receipt if completed
  if (completedTx) {
    const dummyOsForPrint = {
      id: completedTx.id,
      codigo: completedTx.codigoVenda || completedTx.osCodigo || vendaCodigo,
      dataVenda: new Date().toISOString(),
      operador: completedTx.operador || loggedUser,
      clienteNome: completedTx.clienteNome || clienteNome || 'Cliente Não Informado',
      clienteCpfCnpj: completedTx.clienteCpfCnpj || clienteCpfCnpj || '---',
      clienteTelefone: completedTx.clienteTelefone || selectedClientObj?.telefone || selectedClientObj?.celular || '---',
      clienteEndereco: completedTx.clienteEndereco || (selectedClientObj?.endereco ? `${selectedClientObj.endereco.logradouro || ''}${selectedClientObj.endereco.numero ? `, Nº ${selectedClientObj.endereco.numero}` : ''}${selectedClientObj.endereco.complemento ? ` (${selectedClientObj.endereco.complemento})` : ''}${selectedClientObj.endereco.bairro ? ` - Bairro ${selectedClientObj.endereco.bairro}` : ''}${selectedClientObj.endereco.cidade ? `, ${selectedClientObj.endereco.cidade}` : ''}${selectedClientObj.endereco.estado ? `/${selectedClientObj.endereco.estado}` : ''}${selectedClientObj.endereco.cep ? ` - CEP: ${selectedClientObj.endereco.cep}` : ''}` : 'Endereço não informado'),
      itens: (completedTx.itens && completedTx.itens.length > 0) ? completedTx.itens : cartItens,
      subtotal: completedTx.subtotal ?? subtotal,
      desconto: completedTx.desconto ?? discountVal(),
      valorFinal: completedTx.valorTotal ?? valorTotalCalculado,
      valorTotal: completedTx.valorTotal ?? valorTotalCalculado,
      formaPagamento: completedTx.formaPagamento || formaPagamento,
      valorEntrada: completedTx.valorEntrada ?? (formaPagamento === 'Com Entrada' ? entradaNum : undefined),
      valorRestante: completedTx.valorRestante ?? (formaPagamento === 'Com Entrada' ? saldoRestanteCalculado : undefined),
      formaPagamentoEntrada: completedTx.formaPagamentoEntrada || formaEntrada,
      paymentStatus: completedTx.status,
      comprovanteUrl: completedTx.comprovanteUrl,
      estagioAtual: 'Finalizado',
    };

    return (
      <div className="space-y-4">
        <div className="bg-emerald-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-200" />
            <div>
              <h3 className="text-base font-black uppercase tracking-tight">
                Venda Direta Concluída com Sucesso! ({completedTx.osCodigo})
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                Comprovante gerado. Você pode imprimir ou iniciar uma nova venda direta.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetNewVenda}
            className="px-4 py-2 bg-white text-emerald-900 rounded-xl text-xs font-black hover:bg-emerald-50 transition-all cursor-pointer shadow-md"
          >
            + Nova Venda Direta
          </button>
        </div>

        <OsPrintableA4
          os={dummyOsForPrint as any}
          pdvTx={completedTx}
          initialDocType="OS"
          isSidebarExpanded={isSidebarExpanded}
          onClose={handleResetNewVenda}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* ERROR MESSAGE BANNER */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 text-xs font-bold flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* MAIN THREE-COLUMN GRID (20% / 60% / 20%) */}
      <div className="grid grid-cols-1 xl:grid-cols-[22%_56%_22%] gap-3 items-start">
        {/* COLUNA 1 (20% ~ 22%): IDENTIFICAÇÃO DO CLIENTE & HISTÓRICO */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-4">
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">1. Identificação do Cliente</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                setEditingClient(null);
                setShowFullClientModal(true);
              }}
              className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Cadastrar Novo Cliente"
              aria-label="Cadastrar Novo Cliente"
            >
              <UserPlus className="w-4 h-4 text-blue-600" />
            </button>
          </div>

          {/* BUSCA INTELIGENTE DE CLIENTE */}
          <div className="relative">
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
              Buscar Cliente (busca inteligente)
            </label>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={clientSearchQuery}
                onChange={(e) => {
                  setClientSearchQuery(e.target.value);
                  if (e.target.value.trim().length > 0) {
                    setShowClientDropdown(true);
                  } else {
                    setShowClientDropdown(false);
                  }
                }}
                onFocus={(e) => {
                  e.target.select();
                  if (clientSearchQuery.trim().length > 0) {
                    setShowClientDropdown(true);
                  }
                }}
                placeholder="Pesquise por Nome, CPF, CNPJ, Telefone ou Código..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none overflow-hidden"
              />
              {clientSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setClientSearchQuery('');
                    setShowClientDropdown(false);
                  }}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 text-[10px] font-extrabold uppercase"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* DROPDOWN RESULTS */}
            {showClientDropdown && clientSearchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
                <div className="p-2 bg-slate-50 text-[10px] font-extrabold text-slate-400 uppercase flex justify-between items-center sticky top-0 border-b border-slate-200 z-10">
                  <span>Clientes Encontrados ({filteredClients.length})</span>
                  <button
                    type="button"
                    onClick={() => setShowClientDropdown(false)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {filteredClients.length === 0 ? (
                  <div className="p-4 text-center space-y-2">
                    <p className="text-xs text-slate-500 font-medium">
                      Nenhum cliente cadastrado encontrado para "{clientSearchQuery}".
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowClientDropdown(false);
                        setEditingClient(null);
                        setShowFullClientModal(true);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Cadastrar como Novo Cliente</span>
                    </button>
                  </div>
                ) : (
                  filteredClients.map((client) => {
                    const clientDisplayName = getClientDisplayName(client);
                    const doc = client.cpf || client.cnpj || 'Sem documento';

                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleSelectClient(client)}
                        className="w-full text-left p-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between cursor-pointer group"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-bold text-xs text-slate-900 group-hover:text-blue-700 flex items-center gap-1.5 truncate">
                            {client.type === 'PJ' ? (
                              <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            )}
                            <span className="truncate">{clientDisplayName}</span>
                            <span className="text-[10px] font-extrabold text-slate-400 shrink-0">
                              ({client.codigo || 'CLI'})
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            Doc: {doc} {client.telefone ? `• ${client.telefone}` : ''}
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-slate-100 text-slate-700 group-hover:bg-blue-600 group-hover:text-white shrink-0 ml-1">
                          {client.type}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* DADOS DO CLIENTE */}
          {selectedClientObj ? (
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                    {selectedClientObj.type === 'PJ' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-slate-900 truncate">{clienteNome}</div>
                    <div className="text-[10px] font-extrabold text-blue-700">{selectedClientObj.codigo} ({selectedClientObj.type})</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClient(selectedClientObj);
                      setShowFullClientModal(true);
                    }}
                    className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={handleClearClientSelection}
                    className="px-2 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    Trocar
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-slate-700">
                <div>
                  <strong className="text-slate-900">Documento:</strong> {clienteCpfCnpj || 'Não informado'}
                </div>
                <div>
                  <strong className="text-slate-900">Telefone:</strong> {selectedClientObj.telefone || 'Não informado'}
                </div>
                <div>
                  <strong className="text-slate-900">E-mail:</strong> {selectedClientObj.email || 'Não informado'}
                </div>
                <div>
                  <strong className="text-slate-900">Endereço:</strong> {formattedAddress(selectedClientObj)}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 space-y-2.5 text-amber-900">
              <div className="flex items-center gap-2 font-black text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Cliente Não Selecionado</span>
              </div>
              <p className="text-[11px] font-bold text-amber-800/90 leading-tight">
                A seleção ou cadastro de um cliente é <strong className="text-amber-950 underline">obrigatória</strong> para poder finalizar a venda no PDV.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingClient(null);
                  setShowFullClientModal(true);
                }}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Cadastrar Cliente Obrigatório</span>
              </button>
            </div>
          )}

          {/* LISTE AS ÚLTIMAS COMPRAS DO CLIENTE COM OS OU VND */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Últimas Compras (OS / VND)</span>
            </h3>

            {isLoadingPurchases ? (
              <div className="p-3 text-center text-[11px] text-slate-400 font-medium">
                Carregando histórico do cliente...
              </div>
            ) : clientPurchases.length === 0 ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center text-[10px] text-slate-400 font-bold">
                {clienteNome === 'Cliente Balcão'
                  ? 'Selecione um cliente cadastrado para visualizar o histórico de compras.'
                  : 'Nenhuma compra anterior encontrada para este cliente.'}
              </div>
            ) : (
              <div className="space-y-1.5">
                {clientPurchases.map((p, idx) => (
                  <div key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-1.5 font-black text-slate-900">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-black ${p.tipo === 'OS' ? 'bg-indigo-100 text-indigo-700' : 'bg-cyan-100 text-cyan-800'}`}>
                          {p.tipo}
                        </span>
                        <span>{p.codigo}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {p.data}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-blue-700">R$ {p.total.toFixed(2)}</div>
                      <div className={`text-[9px] font-extrabold uppercase ${
                        p.status === 'PAGO' ? 'text-emerald-600' : p.status === 'PARCIAL' ? 'text-amber-600' : 'text-rose-600'
                      }`}>
                        {p.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BOTÃO PESQUISAR VND (F3) */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowSearchVndModal(true)}
              className="w-full py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-2xl font-black text-xs flex items-center justify-between transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                <span>
                  PESQUISAR VND
                  <span className="hidden lg:inline"> (F3)</span>
                </span>
              </div>
              <span className="hidden lg:inline-block px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-md">
                F3
              </span>
            </button>
          </div>
        </div>

        {/* COLUNA 2 (60% ~ 56%): ÁREA DE VENDAS / INCLUSÃO DE PRODUTOS / SERVIÇOS */}
        <div className="space-y-4">
          {/* CARD ADICIONAR PRODUTO (MODELO CONFORME IMAGEM) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-3.5 sm:p-4 shadow-sm space-y-2.5">
            {/* HEADER COM TITULO E SELETOR DE CATEGORIA A DIREITA */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600 shrink-0" />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  2. INCLUSÃO DE PRODUTOS / SERVIÇOS
                </h2>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1">
                <div className="flex items-center gap-2">
                  {isMissingCategory && (
                    <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                      <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                      <span>produto não cadastrado</span>
                    </span>
                  )}
                  {hasValidCategory && activeProductCategory && (
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Categoria: <strong className="text-slate-900">{activeProductCategory}</strong></span>
                    </span>
                  )}
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Categoria
                  </label>
                </div>
                <div className="relative">
                  <select
                    value={itemCategoria && itemCategoria.toLowerCase() !== 'geral' && isRegisteredCategory(itemCategoria) ? itemCategoria : 'ALL'}
                    onChange={(e) => {
                      setItemCategoria(e.target.value === 'ALL' ? '' : e.target.value);
                    }}
                    className="appearance-none pl-3.5 pr-8 py-1.5 bg-white border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none min-w-[190px] cursor-pointer shadow-2xs"
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
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* LINHA UNIFICADA DE CAMPOS COM BORDAS AZUIS E FORMATO CONFORME A IMAGEM */}
            <div className="flex flex-wrap lg:flex-nowrap items-end gap-2 sm:gap-2.5 pt-1">
              {/* 1. DESCRIÇÃO DO ITEM */}
              <div className="flex-1 min-w-[240px] relative">
                <label className="block text-[10px] font-black text-slate-800 uppercase tracking-tight mb-1">
                  DESCRIÇÃO DO ITEM <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={descricaoInputRef}
                    type="text"
                    value={itemDescricao}
                    onChange={(e) => {
                      setItemDescricao(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={(e) => {
                      e.target.select();
                      if (itemDescricao.trim().length > 0) setShowProductDropdown(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOrUpdateProduct();
                      }
                    }}
                    placeholder=""
                    className={`w-full px-3.5 py-2 bg-white border-2 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none transition-all shadow-2xs ${
                      isMissingCategory
                        ? 'border-rose-500 focus:ring-2 focus:ring-rose-500'
                        : 'border-blue-500 focus:ring-2 focus:ring-blue-600'
                    }`}
                  />

                  {/* INTELLIGENT PRODUCT DROPDOWN */}
                  {showProductDropdown && itemDescricao.trim().length > 0 && filteredProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-2xl shadow-2xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {filteredProducts.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleSelectCatalogProduct(prod)}
                          className="w-full text-left p-2.5 hover:bg-blue-50 text-xs font-bold text-slate-900 flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="truncate">{prod.descricao}</span>
                            {prod.categoria && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black rounded uppercase">
                                {prod.categoria}
                              </span>
                            )}
                          </div>
                          <span className="text-blue-600 font-mono font-bold shrink-0 ml-2">
                            R$ {(prod.valorUnitario || 0).toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. UN */}
              <div className="w-20 shrink-0">
                <label className="block text-[10px] font-black text-slate-800 uppercase tracking-tight text-center mb-1">
                  UN
                </label>
                <div className="relative">
                  <select
                    value={itemUnidade}
                    onChange={(e) => setItemUnidade(e.target.value)}
                    className="w-full appearance-none pl-2.5 pr-6 py-2 bg-white border-2 border-blue-500 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center cursor-pointer shadow-2xs"
                  >
                    <option value="UN">UN</option>
                    <option value="M2">M2</option>
                    <option value="KG">KG</option>
                    <option value="PC">PC</option>
                    <option value="M">M</option>
                    <option value="CX">CX</option>
                    <option value="PAR">PAR</option>
                    <option value="L">L</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-3 pointer-events-none" />
                </div>
              </div>

              {/* 3. QTD */}
              <div className="w-20 shrink-0">
                <label className="block text-[10px] font-black text-slate-800 uppercase tracking-tight text-center mb-1">
                  QTD
                </label>
                <input
                  type="number"
                  min="1"
                  value={itemQuantidade || ''}
                  onChange={(e) => setItemQuantidade(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOrUpdateProduct();
                    }
                  }}
                  className="w-full px-2 py-2 bg-slate-100/90 border-2 border-blue-500 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-2xs"
                />
              </div>

              {/* 4. VAL. UNIT (R$) */}
              <div className="w-28 shrink-0">
                <label className="block text-[10px] font-black text-slate-800 uppercase tracking-tight text-center mb-1">
                  VAL. UNIT (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemValorUnitario}
                  onChange={(e) => setItemValorUnitario(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOrUpdateProduct();
                    }
                  }}
                  placeholder=""
                  className="w-full px-3 py-2 bg-white border-2 border-blue-500 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-2xs"
                />
              </div>

              {/* 5. + ADICIONAR ITEM */}
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => handleAddOrUpdateProduct()}
                  disabled={!itemDescricao.trim() || isMissingCategory}
                  className={`px-5 py-2 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap h-[40px] ${
                    !itemDescricao.trim() || isMissingCategory
                      ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
                      : 'bg-[#2563EB] hover:bg-blue-700 text-white hover:shadow-md cursor-pointer active:scale-95'
                  }`}
                  title={
                    isMissingCategory
                      ? 'Produto não cadastrado'
                      : 'Adicionar Item (ENTER)'
                  }
                >
                  {editingItemId ? (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar Edição</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Adicionar Item</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* LISTA DE PRODUTOS / CART TABLE */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black text-blue-600 uppercase tracking-wide">
                  ITENS ({cartItens.length})
                </span>
              </div>
            </div>

            <div className="max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] font-extrabold uppercase sticky top-0">
                    <th className="p-3">Descrição do Item</th>
                    <th className="p-3 text-center">UN</th>
                    <th className="p-3 text-center">Qtd</th>
                    <th className="p-3 text-right">Val. Unit</th>
                    <th className="p-3 text-right">Desconto</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                  {cartItens.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-400 font-medium">
                        Nenhum produto ou serviço adicionado à lista.
                      </td>
                    </tr>
                  ) : (
                    cartItens.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">
                          {item.categoria ? `${item.categoria} - ${item.descricao}` : item.descricao}
                        </td>
                        <td className="p-3 text-center text-slate-500 font-semibold">{item.unidade}</td>
                        <td className="p-3 text-center font-bold">{item.quantidade}</td>
                        <td className="p-3 text-right">R$ {item.valorUnitario.toFixed(2)}</td>
                        <td className="p-3 text-right text-emerald-600 font-bold">
                          {item.desconto ? `- R$ ${item.desconto.toFixed(2)}` : 'R$ 0.00'}
                        </td>
                        <td className="p-3 text-right font-black text-blue-600">
                          R$ {item.total.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditItem(item)}
                              className="p-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-all cursor-pointer"
                              title="Editar Item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all cursor-pointer"
                              title="Remover Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* COLUNA 3 (20% ~ 22%): PAGAMENTO & FINALIZAÇÃO (VENDA DIRETA) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-col justify-between space-y-4 shadow-sm min-h-[500px]">
          <div className="space-y-4">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2.5">
              3. Pagamento & Finalização (VENDA DIRETA)
            </h2>

            {/* FORMAS DE PAGAMENTO */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase">
                Forma de Pagamento
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  { id: 'Com Entrada', label: 'Com Entrada', icon: Wallet },
                  { id: 'PIX', label: 'PIX', icon: QrCode },
                  { id: 'Dinheiro', label: 'Dinheiro', icon: DollarSign },
                  { id: 'Cartão de Crédito', label: 'Crédito', icon: CreditCard },
                  { id: 'Cartão de Débito', label: 'Débito', icon: CreditCard },
                ].map((item) => {
                  const IconComp = item.icon;
                  const isSel = formaPagamento === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormaPagamento(item.id as PaymentMethodType)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        isSel
                          ? 'bg-[#2563EB] text-white border-blue-600 shadow-md scale-[1.01]'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <IconComp className={`w-4 h-4 ${isSel ? 'text-cyan-300' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isSel && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* OPTIONS: COM ENTRADA */}
            {formaPagamento === 'Com Entrada' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-2.5">
                <div>
                  <label className="block text-[10px] font-extrabold text-amber-900 uppercase mb-1">
                    Valor da Entrada (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorEntrada}
                    onChange={(e) => setValorEntrada(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-black text-amber-950 focus:ring-2 focus:ring-amber-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-amber-900 uppercase mb-1">
                    Forma da Entrada
                  </label>
                  <div className="grid grid-cols-3 gap-1 text-[10px] font-bold">
                    {['PIX', 'Dinheiro', 'Cartão'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFormaEntrada(opt)}
                        className={`py-1 rounded border transition-all cursor-pointer text-center ${
                          formaEntrada === opt
                            ? 'bg-amber-600 text-white border-amber-700'
                            : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1.5 border-t border-amber-200 flex justify-between items-center text-xs font-black text-amber-950">
                  <span>Saldo Restante:</span>
                  <span className="text-red-700">R$ {saldoRestanteCalculado.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* OPTIONS: CREDIT CARD PARCELAS */}
            {formaPagamento === 'Cartão de Crédito' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-2.5 space-y-1.5">
                <label className="block text-[10px] font-bold text-blue-900 uppercase">
                  Parcelas
                </label>
                <select
                  value={parcelasCartao}
                  onChange={(e) => setParcelasCartao(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-900"
                >
                  {[1, 2, 3, 4, 5, 6, 10, 12].map((p) => (
                    <option key={p} value={p}>
                      {p}x de R$ {(valorTotalCalculado / p).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* DESCONTO NA VENDA */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-600 uppercase">
                  Desconto na Venda
                </span>
                <div className="flex items-center gap-1 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setTipoDesconto('VALOR')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      tipoDesconto === 'VALOR'
                        ? 'bg-blue-600 text-white font-black'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
                    }`}
                  >
                    R$
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoDesconto('PERCENTUAL')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      tipoDesconto === 'PERCENTUAL'
                        ? 'bg-blue-600 text-white font-black'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>

              <input
                type="number"
                step="0.01"
                value={descontoInput}
                onChange={(e) => setDescontoInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0.00"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* COMPROVANTE DE PAGAMENTO */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Comprovante de Pagamento</span>
                </span>
                {comprovanteUrl && (
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                    Anexado
                  </span>
                )}
              </div>

              {comprovanteUrl ? (
                <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-800 truncate">
                      {comprovanteFileName || 'comprovante.png'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setComprovanteUrl(null);
                      setComprovanteFileName('');
                    }}
                    className="text-red-600 hover:text-red-800 p-1 text-[10px] font-bold cursor-pointer shrink-0"
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 p-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-600">
                    {isUploadingComprovante ? 'Enviando...' : 'Anexar Comprovante'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleComprovanteUpload}
                    disabled={isUploadingComprovante}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* SUBTOTAL, VALOR TOTAL & BOTAO FINALIZAR */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="space-y-1 font-bold text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {discountVal() > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Desconto:</span>
                  <span>- R$ {discountVal().toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 text-base font-black pt-1 border-t border-slate-200">
                <span>VALOR TOTAL:</span>
                <span className="text-blue-700">R$ {valorTotalCalculado.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!selectedClientObj) {
                  setErrorMessage('A seleção ou cadastro de um cliente é obrigatória para poder finalizar a venda.');
                  return;
                }
                if (cartItens.length === 0) {
                  setErrorMessage('Adicione pelo menos 1 item ao carrinho de Vendas Diretas antes de finalizar.');
                  return;
                }
                setErrorMessage('');
                setShowConfirmModal(true);
              }}
              disabled={cartItens.length === 0 || !selectedClientObj}
              className={`w-full py-3.5 text-white font-black text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
                cartItens.length === 0 || !selectedClientObj
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800 shadow-blue-500/20'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 text-cyan-300 shrink-0" />
              <span>Finalizar Pagamento (ENTER)</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full space-y-6 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-8 h-8 text-blue-600" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 bg-cyan-400 text-slate-950 text-[10px] font-black uppercase rounded-full">
                VENDA DIRETA • {vendaCodigo}
              </span>
              <h3 className="text-xl font-black text-slate-900">
                Confirmar Pagamento da Venda Direta?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Deseja concluir a venda direta para{' '}
                <strong className="text-blue-700 font-extrabold">{clienteNome}</strong> no valor total de{' '}
                <strong className="text-slate-900 font-black">R$ {valorTotalCalculado.toFixed(2)}</strong> via{' '}
                <strong className="text-blue-700 font-black">{formaPagamento}</strong>?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleFinalizeVendaDireta}
                disabled={isSubmitting}
                className="py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-cyan-300" />
                    <span>Confirmar (ENTER)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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
              const name = getClientDisplayName(savedClient);
              const doc = savedClient.cpf || savedClient.cnpj || '';

              setClienteNome(name || 'Cliente Cadastrado');
              setClienteCpfCnpj(doc);
              setSelectedClientObj(savedClient);
              setShowFullClientModal(false);
              setEditingClient(null);

              // Refresh clients list
              fetchClients();
            }}
          />
        </div>
      )}

    </div>
  );
};
