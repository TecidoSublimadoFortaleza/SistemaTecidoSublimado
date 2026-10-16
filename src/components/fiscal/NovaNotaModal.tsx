import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileText,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  ShoppingCart,
  Send,
  Building2,
  DollarSign,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ShieldCheck,
  Zap,
  User,
  MapPin,
  Loader2,
  Users,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { ApiService, EmissaoFiscalDTO, NotaFiscal, ConfiguracaoFiscal } from '../../services/api';
import { OrdemServico, PdvTransaction } from '../../server/types/os';
import {
  getClientDisplayName,
  cleanClientFullName,
  matchClientSearch,
  buildClientSearchIndex,
  fastFilterClients,
} from '../../utils/clientSearch';
import { validateCPF, validateCNPJ } from '../../utils/validators';
import { openDanfeInNewTab } from '../../utils/danfePrintHelper';
import { isVendedoraOuRecepcaoProfile, getLoggedUserAndPerfil } from '../../utils/userPermissions';
import { FilialItem, DEFAULT_MATRIZ_FILIAL } from '../settings/SettingsModuleView';

// Formatters e Máscaras idênticas ao módulo Clientes
const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatCnpj = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, '$1-$2');
};

interface NovaNotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (nota: NotaFiscal) => void;
  config: ConfiguracaoFiscal | null;
  initialOs?: OrdemServico | null;
  initialPdv?: PdvTransaction | null;
  isInlineView?: boolean;
  userRole?: string;
  isDeveloper?: boolean;
}

export const NovaNotaModal: React.FC<NovaNotaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  config,
  initialOs,
  initialPdv,
  isInlineView = false,
  userRole,
  isDeveloper,
}) => {
  const loggedInfo = useMemo(() => getLoggedUserAndPerfil(), []);
  const effectiveRole = userRole || loggedInfo.role;
  const effectiveIsDev = isDeveloper !== undefined ? isDeveloper : loggedInfo.isDeveloper;
  const isVendedoraOuRecepcao = useMemo(
    () => isVendedoraOuRecepcaoProfile(effectiveRole, effectiveIsDev, loggedInfo.username),
    [effectiveRole, effectiveIsDev, loggedInfo.username]
  );

  const [tipo, setTipo] = useState<'NFE' | 'NFCE'>('NFE');
  const [origem, setOrigem] = useState<'OS' | 'PDV' | 'AVULSA'>('AVULSA');
  const [operacaoFiscal, setOperacaoFiscal] = useState<'VND' | 'OS'>('VND');
  const [origemId, setOrigemId] = useState<string>('');
  const [origemCodigo, setOrigemCodigo] = useState<string>('');

  // Filiais da Empresa (Empresa emissora da Nota Fiscal / DANFE)
  const [filiais, setFiliais] = useState<FilialItem[]>([]);
  const [selectedFilialId, setSelectedFilialId] = useState<string>('');

  const selectedFilial = useMemo(() => {
    return filiais.find((f) => f.id === selectedFilialId) || filiais[0] || DEFAULT_MATRIZ_FILIAL;
  }, [filiais, selectedFilialId]);

  const hasPedidoImportado = Boolean(origemCodigo && (origem === 'OS' || origem === 'PDV'));

  // Available OS and PDV lists for quick import
  const [availableOsList, setAvailableOsList] = useState<OrdemServico[]>([]);
  const [availablePdvList, setAvailablePdvList] = useState<PdvTransaction[]>([]);
  const [availableClientsList, setAvailableClientsList] = useState<any[]>([]);
  const [selectedOsId, setSelectedOsId] = useState<string>('');
  const [pedidoSearchTerm, setPedidoSearchTerm] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Destinatário (Cliente) - Idêntico aos campos de Clientes (PF e PJ)
  const [destinatarioTipo, setDestinatarioTipo] = useState<'PF' | 'PJ'>('PF');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearchTerm, setClientSearchTerm] = useState<string>('');
  const [isClientSearchDropdownOpen, setIsClientSearchDropdownOpen] = useState<boolean>(false);
  const clientSearchDropdownRef = useRef<HTMLDivElement>(null);

  // Dados PF
  const [pfNome, setPfNome] = useState<string>('');
  const [pfCpf, setPfCpf] = useState<string>('');

  // Dados PJ
  const [pjRazaoSocial, setPjRazaoSocial] = useState<string>('');
  const [pjNomeFantasia, setPjNomeFantasia] = useState<string>('');
  const [pjCnpj, setPjCnpj] = useState<string>('');
  const [pjInscricaoEstadual, setPjInscricaoEstadual] = useState<string>('ISENTO');

  // Contato compartilhado
  const [clienteEmail, setClienteEmail] = useState<string>('');
  const [clienteTelefone, setClienteTelefone] = useState<string>('');

  // Endereço Completo com busca ViaCEP
  const [cep, setCep] = useState<string>('');
  const [logradouro, setLogradouro] = useState<string>('');
  const [numero, setNumero] = useState<string>('');
  const [complemento, setComplemento] = useState<string>('');
  const [bairro, setBairro] = useState<string>('');
  const [cidade, setCidade] = useState<string>('Fortaleza');
  const [uf, setUf] = useState<string>('CE');
  const [isLoadingCep, setIsLoadingCep] = useState<boolean>(false);
  const [cepFeedback, setCepFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Computed / backwards-compatible getters
  const clienteNome = destinatarioTipo === 'PF' ? pfNome : pjRazaoSocial;
  const clienteDocumento = destinatarioTipo === 'PF' ? pfCpf : pjCnpj;

  // Natureza da Operação inicia vazia conforme solicitado
  const [naturezaOperacao, setNaturezaOperacao] = useState<string>('');
  const [formaPagamento, setFormaPagamento] = useState<
    'PIX' | 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BOLETO' | 'OUTROS'
  >('PIX');

  // Items - campos iniciam limpos conforme solicitado
  const [itens, setItens] = useState<
    Array<{
      codigo?: string;
      descricao: string;
      quantidade: number | '';
      valorUnitario: number | '';
      unidade: string;
      ncm: string;
      cfop: string;
      csosn: string;
    }>
  >([
    {
      codigo: '',
      descricao: '',
      quantidade: '',
      valorUnitario: '',
      unidade: 'UN',
      ncm: config?.ncmPadrao || '6109.10.00',
      cfop: config?.cfopPadraoInterno || '5102',
      csosn: config?.csosnPadrao || '102',
    },
  ]);

  const [valorDesconto, setValorDesconto] = useState<number>(0);
  const [valorFrete, setValorFrete] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fechar dropdown de busca inteligente ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        clientSearchDropdownRef.current &&
        !clientSearchDropdownRef.current.contains(event.target as Node)
      ) {
        setIsClientSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pré-indexação otimizada para busca instantânea em listas com mais de 12.000 clientes
  const indexedAvailableClients = useMemo(() => {
    return buildClientSearchIndex(availableClientsList);
  }, [availableClientsList]);

  // Clientes filtrados para a busca inteligente (sub-milissegundo)
  const filteredClients = useMemo(() => {
    const term = clientSearchTerm.trim();
    if (!term) {
      return availableClientsList.slice(0, 20);
    }
    return fastFilterClients(indexedAvailableClients, term)
      .slice(0, 30)
      .map((i) => i.client);
  }, [indexedAvailableClients, availableClientsList, clientSearchTerm]);

  // Load OS and PDV lists
  useEffect(() => {
    if (!isOpen) return;

    // Load available OSs (somente OS reais, excluindo orçamentos)
    ApiService.getOrdensServico()
      .then((list) => {
        const osOnly = (list || []).filter((o) => !o.isOrcamento && o.tipoDocumento !== 'ORCAMENTO' && !o.codigo?.toUpperCase().startsWith('ORC'));
        setAvailableOsList(osOnly);
      })
      .catch(() => {});

    // Load PDV transactions (apenas Vendas Diretas / VND, excluindo CDV / pagamentos de OS)
    ApiService.getPdvTransactions()
      .then((list) => {
        const vnds = (list || []).filter((t) => {
          const osCode = (t.osCodigo || '').toUpperCase();
          const cdvCode = (t.codigoVenda || '').toUpperCase();
          const isCdv = Boolean(t.osId) || osCode.startsWith('OS') || cdvCode.startsWith('CDV');
          return !isCdv;
        });
        setAvailablePdvList(vnds);
      })
      .catch(() => {});

    // Load registered clients for full address/contact synchronization
    ApiService.getClients()
      .then((list) => {
        setAvailableClientsList(list || []);
      })
      .catch(() => {});

    // Carrega filiais da empresa sincronizadas com banco de dados
    const loadFiliais = async () => {
      let list: FilialItem[] = [];
      const stored = localStorage.getItem('subligestao_filiais');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
          }
        } catch {}
      }

      try {
        const apiList = await ApiService.getFiliais();
        if (Array.isArray(apiList) && apiList.length > 0) {
          list = apiList;
        }
      } catch {}

      if (list.length === 0) {
        list = [DEFAULT_MATRIZ_FILIAL];
      }

      setFiliais(list);

      // Pré-seleciona filial pelo initialOs se houver
      if (initialOs?.filialId) {
        const found = list.find((f) => f.id === initialOs.filialId);
        if (found) {
          setSelectedFilialId(found.id);
          return;
        }
      }
      if (initialOs?.filialNome) {
        const found = list.find(
          (f) =>
            f.nome.toLowerCase() === initialOs.filialNome?.toLowerCase() ||
            f.codigo.toLowerCase() === initialOs.filialNome?.toLowerCase() ||
            (f.razaoSocial && f.razaoSocial.toLowerCase() === initialOs.filialNome?.toLowerCase())
        );
        if (found) {
          setSelectedFilialId(found.id);
          return;
        }
      }

      // Padrão: Matriz ou primeira filial ativa
      const defaultMatriz = list.find((f) => f.tipo === 'MATRIZ' || f.codigo === 'MATRIZ') || list[0];
      if (defaultMatriz) {
        setSelectedFilialId(defaultMatriz.id);
      }
    };

    loadFiliais();
  }, [isOpen, initialOs]);

  // Handle Initial Props
  useEffect(() => {
    if (initialOs) {
      applyOsData(initialOs);
    } else if (initialPdv) {
      applyPdvData(initialPdv);
    }
  }, [initialOs, initialPdv, availableClientsList]);

  const applyClientData = (client: any) => {
    if (!client) return;
    setSelectedClientId(client.id || '');
    setClientSearchTerm(getClientDisplayName(client));
    const cleanDoc = (client.cnpj || client.cpf || client.documento || '').replace(/\D/g, '');
    const isPj = client.type === 'PJ' || cleanDoc.length > 11;

    if (isPj) {
      setDestinatarioTipo('PJ');
      setPjRazaoSocial(client.razaoSocial || client.nome || '');
      setPjNomeFantasia(client.nomeFantasia || client.razaoSocial || client.nome || '');
      setPjCnpj(formatCnpj(cleanDoc || client.cnpj || ''));
      setPjInscricaoEstadual(client.inscricaoEstadual || 'ISENTO');
    } else {
      setDestinatarioTipo('PF');
      const fullName = client.nome ? cleanClientFullName(client.nome, client.sobrenome) : '';
      setPfNome(fullName || client.nome || '');
      setPfCpf(formatCpf(cleanDoc || client.cpf || ''));
    }

    if (client.email) setClienteEmail(client.email);
    if (client.telefone) setClienteTelefone(formatPhone(client.telefone));

    if (client.endereco) {
      if (client.endereco.cep) setCep(formatCep(client.endereco.cep));
      if (client.endereco.logradouro) setLogradouro(client.endereco.logradouro);
      if (client.endereco.numero) setNumero(client.endereco.numero);
      if (client.endereco.complemento) setComplemento(client.endereco.complemento);
      if (client.endereco.bairro) setBairro(client.endereco.bairro);
      if (client.endereco.cidade) setCidade(client.endereco.cidade);
      if (client.endereco.estado) setUf(client.endereco.estado.toUpperCase());
    }
  };

  const handleCepLookup = async (cepValue: string) => {
    const formatted = formatCep(cepValue);
    setCep(formatted);
    const cleanCepNum = formatted.replace(/\D/g, '');
    if (cleanCepNum.length === 8) {
      setIsLoadingCep(true);
      setCepFeedback(null);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCepNum}/json/`);
        const data = await res.json();
        if (data.erro) {
          setCepFeedback({
            type: 'error',
            message: 'CEP não localizado na base dos Correios. Por favor, preencha rua, bairro e cidade manualmente.',
          });
        } else {
          if (data.logradouro) setLogradouro(data.logradouro);
          if (data.bairro) setBairro(data.bairro);
          if (data.localidade) setCidade(data.localidade);
          if (data.uf) setUf(data.uf.toUpperCase());
          setCepFeedback({
            type: 'success',
            message: `Endereço localizado via ViaCEP: ${data.logradouro ? data.logradouro + ', ' : ''}${data.bairro || ''} - ${data.localidade}/${data.uf}`,
          });
          setTimeout(() => setCepFeedback(null), 4000);
        }
      } catch {
        setCepFeedback({
          type: 'error',
          message: 'Falha na consulta automática do CEP. Preencha os campos de endereço manualmente.',
        });
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const applyOsData = async (os: OrdemServico) => {
    setOrigem('OS');
    setOperacaoFiscal('OS');
    setOrigemId(os.id);
    setOrigemCodigo(os.codigo);
    setTipo('NFE');

    // Sincroniza filial da OS para emitente da Nota Fiscal
    if (os.filialId) {
      setSelectedFilialId(os.filialId);
    } else if (os.filialNome) {
      const match = filiais.find(
        (f) =>
          f.nome.toLowerCase() === os.filialNome?.toLowerCase() ||
          f.codigo.toLowerCase() === os.filialNome?.toLowerCase() ||
          (f.razaoSocial && f.razaoSocial.toLowerCase() === os.filialNome?.toLowerCase())
      );
      if (match) setSelectedFilialId(match.id);
    }

    // 1. Tentar encontrar cadastro completo do cliente para preencher e-mail e endereço
    let foundClient: any = null;
    if (os.clienteId) {
      foundClient = availableClientsList.find((c) => c.id === os.clienteId);
      if (!foundClient) {
        try {
          foundClient = await ApiService.getClientById(os.clienteId);
        } catch {}
      }
    }
    if (!foundClient && os.clienteCpfCnpj) {
      const cleanDoc = os.clienteCpfCnpj.replace(/\D/g, '');
      if (cleanDoc) {
        foundClient = availableClientsList.find(
          (c) =>
            (c.cpf && c.cpf.replace(/\D/g, '') === cleanDoc) ||
            (c.cnpj && c.cnpj.replace(/\D/g, '') === cleanDoc)
        );
      }
    }
    if (!foundClient && os.clienteNome) {
      const targetName = os.clienteNome.trim().toLowerCase();
      foundClient = availableClientsList.find(
        (c) => getClientDisplayName(c).trim().toLowerCase() === targetName
      );
    }

    if (foundClient) {
      applyClientData(foundClient);
    } else {
      if (os.clienteNome) setClientSearchTerm(os.clienteNome);
      const cleanDoc = (os.clienteCpfCnpj || '').replace(/\D/g, '');
      const isPj = cleanDoc.length > 11;
      if (isPj) {
        setDestinatarioTipo('PJ');
        setPjRazaoSocial(os.clienteNome || '');
        setPjNomeFantasia(os.clienteNome || '');
        setPjCnpj(formatCnpj(cleanDoc));
        setPjInscricaoEstadual('ISENTO');
      } else {
        setDestinatarioTipo('PF');
        setPfNome(os.clienteNome || '');
        setPfCpf(formatCpf(cleanDoc));
      }

      setClienteTelefone(formatPhone(os.clienteTelefone || ''));
      setClienteEmail(os.clienteEmail || '');

      if (os.clienteEndereco) {
        const endStr = os.clienteEndereco;
        const cepMatch = endStr.match(/CEP[:\s]+([\d.-]+)/i) || endStr.match(/(\d{5}-?\d{3})/);
        if (cepMatch) setCep(formatCep(cepMatch[1]));

        const numMatch = endStr.match(/N[ºo°\.]*\s*([A-Za-z0-9]+)/i) || endStr.match(/,\s*(\d+)/);
        if (numMatch) setNumero(numMatch[1]);

        const bairroMatch = endStr.match(/Bairro\s+([^,]+)/i);
        if (bairroMatch) setBairro(bairroMatch[1].trim());

        const cidadeUfMatch = endStr.match(/,\s*([^,/-]+)\s*\/\s*([A-Z]{2})/i);
        if (cidadeUfMatch) {
          setCidade(cidadeUfMatch[1].trim());
          setUf(cidadeUfMatch[2].trim().toUpperCase());
        }

        const logradouroPart = endStr.split(/,?\s*N[ºo°\.]*|,/i)[0];
        setLogradouro(logradouroPart ? logradouroPart.trim() : endStr);
      }
    }

    // 2. Corrigir cálculo de valor da OS para nunca ficar R$ 0,00
    const valorTotalOS = Number(os.valorFinal ?? os.valorTotal ?? os.subtotal ?? 0);

    // Convert OS items
    if (os.itens && os.itens.length > 0) {
      const convertedItens = os.itens.map((it: any) => {
        const qty = Number(it.quantidade) > 0 ? Number(it.quantidade) : 1;
        let vUnit = Number(it.valorUnitario || 0);

        if (vUnit <= 0 && Number(it.total || 0) > 0) {
          vUnit = Number(it.total) / qty;
        }
        if (vUnit <= 0 && valorTotalOS > 0) {
          vUnit = valorTotalOS / (os.itens.length || 1);
        }
        if (vUnit <= 0) {
          vUnit = 100;
        }

        return {
          codigo: it.codigo || it.id || `PRD-${os.itens.indexOf(it) + 1}`,
          descricao: it.descricao || it.produtoNome || `Serviço de Sublimação - Ref OS ${os.codigo}`,
          quantidade: qty,
          valorUnitario: Number(vUnit.toFixed(2)),
          unidade: it.unidade || 'UN',
          ncm: it.ncm || config?.ncmPadrao || '6109.10.00',
          cfop: config?.cfopPadraoInterno || '5102',
          csosn: config?.csosnPadrao || '102',
        };
      });
      setItens(convertedItens);
    } else {
      setItens([
        {
          codigo: os.codigo || 'OS-1',
          descricao: `Serviço de Sublimação e Confecção Têxtil - Ref OS ${os.codigo}`,
          quantidade: 1,
          valorUnitario: valorTotalOS > 0 ? Number(valorTotalOS.toFixed(2)) : 100,
          unidade: 'UN',
          ncm: config?.ncmPadrao || '6109.10.00',
          cfop: config?.cfopPadraoInterno || '5102',
          csosn: config?.csosnPadrao || '102',
        },
      ]);
    }

    setValorDesconto(Number(os.desconto || 0));
    setValorFrete(0);

    // Map payment method
    const pm = (os.formaPagamento || '').toUpperCase();
    if (pm.includes('PIX')) setFormaPagamento('PIX');
    else if (pm.includes('CART') || pm.includes('CRED')) setFormaPagamento('CARTAO_CREDITO');
    else if (pm.includes('DEB')) setFormaPagamento('CARTAO_DEBITO');
    else if (pm.includes('DINHEIRO') || pm.includes('ESP')) setFormaPagamento('DINHEIRO');
    else if (pm.includes('BOL')) setFormaPagamento('BOLETO');
  };

  const applyPdvData = async (pdv: PdvTransaction) => {
    setOrigem('PDV');
    setOperacaoFiscal('VND');
    setOrigemId(pdv.id);
    let cod = pdv.codigoVenda || pdv.osCodigo || 'VND';
    if (cod.startsWith('PDV')) {
      cod = cod.replace(/^PDV/i, 'VND');
    }
    setOrigemCodigo(cod);
    setTipo('NFCE');

    // Localizar cadastro do cliente
    let foundClient: any = null;
    if (pdv.clienteCpfCnpj) {
      const cleanDoc = pdv.clienteCpfCnpj.replace(/\D/g, '');
      if (cleanDoc) {
        foundClient = availableClientsList.find(
          (c) =>
            (c.cpf && c.cpf.replace(/\D/g, '') === cleanDoc) ||
            (c.cnpj && c.cnpj.replace(/\D/g, '') === cleanDoc)
        );
      }
    }
    if (!foundClient && pdv.clienteNome && pdv.clienteNome !== 'Consumidor Final') {
      const targetName = pdv.clienteNome.trim().toLowerCase();
      foundClient = availableClientsList.find(
        (c) => getClientDisplayName(c).trim().toLowerCase() === targetName
      );
    }

    if (foundClient) {
      applyClientData(foundClient);
    } else {
      if (pdv.clienteNome) setClientSearchTerm(pdv.clienteNome);
      const cleanDoc = (pdv.clienteCpfCnpj || '').replace(/\D/g, '');
      const isPj = cleanDoc.length > 11;
      if (isPj) {
        setDestinatarioTipo('PJ');
        setPjRazaoSocial(pdv.clienteNome || '');
        setPjNomeFantasia(pdv.clienteNome || '');
        setPjCnpj(formatCnpj(cleanDoc));
        setPjInscricaoEstadual('ISENTO');
      } else {
        setDestinatarioTipo('PF');
        setPfNome(pdv.clienteNome || '');
        setPfCpf(formatCpf(cleanDoc));
      }

      setClienteEmail(pdv.clienteEmail || '');
      setClienteTelefone(formatPhone(pdv.clienteTelefone || ''));

      if (pdv.clienteEndereco) {
        const endStr = pdv.clienteEndereco;
        const cepMatch = endStr.match(/CEP[:\s]+([\d.-]+)/i) || endStr.match(/(\d{5}-?\d{3})/);
        if (cepMatch) setCep(formatCep(cepMatch[1]));

        const numMatch = endStr.match(/N[ºo°\.]*\s*([A-Za-z0-9]+)/i) || endStr.match(/,\s*(\d+)/);
        if (numMatch) setNumero(numMatch[1]);

        const bairroMatch = endStr.match(/Bairro\s+([^,]+)/i);
        if (bairroMatch) setBairro(bairroMatch[1].trim());

        const cidadeUfMatch = endStr.match(/,\s*([^,/-]+)\s*\/\s*([A-Z]{2})/i);
        if (cidadeUfMatch) {
          setCidade(cidadeUfMatch[1].trim());
          setUf(cidadeUfMatch[2].trim().toUpperCase());
        }

        const logradouroPart = endStr.split(/,?\s*N[ºo°\.]*|,/i)[0];
        setLogradouro(logradouroPart ? logradouroPart.trim() : endStr);
      }
    }

    const valorTotalPDV = Number(pdv.valorFinal ?? pdv.valorTotal ?? pdv.subtotal ?? (pdv as any).total ?? 0);

    if (pdv.itens && pdv.itens.length > 0) {
      setItens(
        pdv.itens.map((it) => {
          const qty = Number(it.quantidade) > 0 ? Number(it.quantidade) : 1;
          let vUnit = Number(it.valorUnitario || 0);

          if (vUnit <= 0 && Number((it as any).total || 0) > 0) {
            vUnit = Number((it as any).total) / qty;
          }
          if (vUnit <= 0 && valorTotalPDV > 0) {
            vUnit = valorTotalPDV / (pdv.itens.length || 1);
          }
          if (vUnit <= 0) {
            vUnit = 1;
          }

          return {
            codigo: it.codigo || (it as any).id || `PRD-${pdv.itens.indexOf(it) + 1}`,
            descricao: it.descricao || 'Produto PDV',
            quantidade: qty,
            valorUnitario: Number(vUnit.toFixed(2)),
            unidade: it.unidade || 'UN',
            ncm: (it as any).ncm || config?.ncmPadrao || '6109.10.00',
            cfop: config?.cfopPadraoInterno || '5102',
            csosn: config?.csosnPadrao || '102',
          };
        })
      );
    } else {
      setItens([
        {
          codigo: cod || 'VND-1',
          descricao: `Venda Balcão - Ref ${cod}`,
          quantidade: 1,
          valorUnitario: valorTotalPDV > 0 ? Number(valorTotalPDV.toFixed(2)) : 100,
          unidade: 'UN',
          ncm: config?.ncmPadrao || '6109.10.00',
          cfop: config?.cfopPadraoInterno || '5102',
          csosn: config?.csosnPadrao || '102',
        },
      ]);
    }

    setValorDesconto(Number(pdv.desconto || 0));

    const pm = (pdv.formaPagamento || '').toUpperCase();
    if (pm.includes('PIX')) setFormaPagamento('PIX');
    else if (pm.includes('CRED')) setFormaPagamento('CARTAO_CREDITO');
    else if (pm.includes('DEB')) setFormaPagamento('CARTAO_DEBITO');
    else if (pm.includes('DINHEIRO')) setFormaPagamento('DINHEIRO');
  };

  const handleAddItem = () => {
    setItens([
      ...itens,
      {
        codigo: '',
        descricao: '',
        quantidade: '',
        valorUnitario: '',
        unidade: 'UN',
        ncm: config?.ncmPadrao || '6109.10.00',
        cfop: config?.cfopPadraoInterno || '5102',
        csosn: config?.csosnPadrao || '102',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (itens.length <= 1) return;
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...itens];
    (updated[index] as any)[field] = value;
    setItens(updated);
  };

  const valorProdutosTotal = itens.reduce(
    (acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0),
    0
  );
  const valorNotaTotal = Math.max(0, valorProdutosTotal - valorDesconto + valorFrete);

  // Busca Inteligente para Importação de Pedidos (Apenas OS e VND)
  const searchResults = React.useMemo(() => {
    const term = pedidoSearchTerm.trim().toLowerCase();

    const osItems = availableOsList
      .filter((os) => !os.isOrcamento && os.tipoDocumento !== 'ORCAMENTO' && !os.codigo?.toUpperCase().startsWith('ORC'))
      .map((os) => {
        const valor = Number(os.valorFinal ?? os.valorTotal ?? os.subtotal ?? 0);
        const descText = `${os.codigo} ${os.clienteNome || ''} ${os.clienteCpfCnpj || ''} ${os.clienteEmail || ''} ${(os.itens || []).map((i) => i.descricao).join(' ')}`.toLowerCase();
        return {
          type: 'OS' as const,
          id: os.id,
          codigo: os.codigo,
          clienteNome: os.clienteNome || 'Cliente não identificado',
          clienteDocumento: os.clienteCpfCnpj || '',
          clienteEmail: os.clienteEmail || '',
          data: os.dataVenda || (os as any).createdAt || '',
          valor,
          raw: os,
          descText,
        };
      });

    const vndItems = availablePdvList
      .filter((pdv) => {
        const osCode = (pdv.osCodigo || '').toUpperCase();
        const cdvCode = (pdv.codigoVenda || '').toUpperCase();
        const isCdv = Boolean(pdv.osId) || osCode.startsWith('OS') || cdvCode.startsWith('CDV');
        return !isCdv;
      })
      .map((pdv) => {
        const valor = Number(pdv.valorFinal ?? pdv.valorTotal ?? pdv.subtotal ?? (pdv as any).total ?? 0);
        let cod = pdv.codigoVenda || pdv.osCodigo || 'VND';
        if (cod.startsWith('PDV')) {
          cod = cod.replace(/^PDV/i, 'VND');
        }
        const descText = `${cod} ${pdv.clienteNome || ''} ${pdv.clienteCpfCnpj || ''} ${pdv.clienteEmail || ''} ${(pdv.itens || []).map((i) => i.descricao).join(' ')}`.toLowerCase();
        return {
          type: 'VND' as const,
          id: pdv.id,
          codigo: cod,
          clienteNome: pdv.clienteNome || 'Consumidor Final (Balcão)',
          clienteDocumento: pdv.clienteCpfCnpj || '',
          clienteEmail: pdv.clienteEmail || '',
          data: pdv.data || (pdv as any).dataHora || (pdv as any).createdAt || '',
          valor,
          raw: pdv,
          descText,
        };
      });

    const combined = [...osItems, ...vndItems];

    if (!term) {
      return combined.slice(0, 10);
    }

    return combined.filter((it) => it.descText.includes(term)).slice(0, 15);
  }, [availableOsList, availablePdvList, pedidoSearchTerm]);

  const handleSelectPedido = (item: { type: 'OS' | 'VND'; raw: any; codigo: string; valor: number }) => {
    if (item.type === 'OS') {
      setSelectedOsId(item.raw.id);
      applyOsData(item.raw);
      setOperacaoFiscal('OS');
    } else {
      applyPdvData(item.raw);
      setOperacaoFiscal('VND');
    }
    setPedidoSearchTerm('');
    setIsSearchDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validação estrita por Perfil: Vendedoras e Recepção só podem emitir notas importadas de pedidos (OS ou VND)
    if (isVendedoraOuRecepcao) {
      if (!origemCodigo || origem === 'AVULSA' || !hasPedidoImportado) {
        setErrorMsg(
          'Acesso Restrito: O seu perfil de Vendedora/Recepção permite emitir notas fiscais apenas mediante importação de pedidos de OS ou VND. A emissão de notas avulsas não é permitida.'
        );
        return;
      }
    }

    // Validações obrigatórias de Destinatário (Cliente) conforme módulo Clientes (PF e PJ)
    if (destinatarioTipo === 'PF') {
      if (!pfNome.trim()) {
        setErrorMsg('O campo Nome Completo do destinatário (Pessoa Física) é obrigatório.');
        return;
      }
      if (!pfCpf.trim()) {
        setErrorMsg('O campo CPF do destinatário (Pessoa Física) é obrigatório.');
        return;
      }
      if (!validateCPF(pfCpf)) {
        setErrorMsg('CPF informado é inválido. Por favor, verifique os 11 dígitos do CPF.');
        return;
      }
    } else {
      if (!pjRazaoSocial.trim()) {
        setErrorMsg('O campo Razão Social da empresa destinatária (Pessoa Jurídica) é obrigatório.');
        return;
      }
      if (!pjCnpj.trim()) {
        setErrorMsg('O campo CNPJ da empresa destinatária (Pessoa Jurídica) é obrigatório.');
        return;
      }
      if (!validateCNPJ(pjCnpj)) {
        setErrorMsg('CNPJ informado é inválido. Por favor, verifique os 14 dígitos do CNPJ.');
        return;
      }
      if (!pjInscricaoEstadual.trim()) {
        setErrorMsg('O campo Inscrição Estadual é obrigatório (informe o número ou "ISENTO").');
        return;
      }
    }

    // Telefone e E-mail são opcionais, mas se o e-mail for preenchido, valida o formato
    if (clienteEmail.trim() && !/\S+@\S+\.\S+/.test(clienteEmail.trim())) {
      setErrorMsg('O E-mail informado é inválido (ex: nome@dominio.com).');
      return;
    }

    // Validação obrigatória de endereço
    const cleanCepNum = cep.replace(/\D/g, '');
    if (!cleanCepNum || cleanCepNum.length !== 8) {
      setErrorMsg('O campo CEP do destinatário é obrigatório (deve conter 8 dígitos).');
      return;
    }
    if (!logradouro.trim()) {
      setErrorMsg('O campo Logradouro / Rua do endereço é obrigatório.');
      return;
    }
    if (!numero.trim()) {
      setErrorMsg('O campo Número do endereço é obrigatório (informe o número predial ou "S/N").');
      return;
    }
    if (!bairro.trim()) {
      setErrorMsg('O campo Bairro do endereço é obrigatório.');
      return;
    }
    if (!cidade.trim()) {
      setErrorMsg('O campo Cidade do endereço é obrigatório.');
      return;
    }
    if (!uf.trim() || uf.trim().length !== 2) {
      setErrorMsg('O campo UF / Estado do endereço é obrigatório (sigla de 2 letras).');
      return;
    }

    // Validação da Natureza da Operação
    if (!naturezaOperacao.trim()) {
      setErrorMsg('Informe a Natureza da Operação (ex: Venda de mercadorias, Prestação de serviços).');
      return;
    }

    // Validação dos Itens da Nota Fiscal
    if (itens.length === 0) {
      setErrorMsg('A nota fiscal deve conter ao menos um item.');
      return;
    }

    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      if (!it.descricao || !it.descricao.trim()) {
        setErrorMsg(`Informe a Descrição do Produto/Serviço no Item #${i + 1}.`);
        return;
      }
      if (it.quantidade === '' || Number(it.quantidade) <= 0) {
        setErrorMsg(`Informe a Quantidade no Item #${i + 1}.`);
        return;
      }
      if (it.valorUnitario === '' || Number(it.valorUnitario) <= 0) {
        setErrorMsg(`Informe o Valor Unitário no Item #${i + 1}.`);
        return;
      }
    }

    if (valorProdutosTotal <= 0) {
      setErrorMsg('O valor total dos produtos deve ser maior que zero.');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalNome = destinatarioTipo === 'PF' ? pfNome.trim() : pjRazaoSocial.trim();
      const finalDoc = destinatarioTipo === 'PF' ? pfCpf.trim() : pjCnpj.trim();
      const finalFantasia = destinatarioTipo === 'PJ' ? pjNomeFantasia.trim() : undefined;
      const finalIE = destinatarioTipo === 'PJ' ? pjInscricaoEstadual.trim() : undefined;

      const isOs = origem === 'OS' || (origem === 'AVULSA' && operacaoFiscal === 'OS');
      const serieFinal = isOs
        ? (config?.serieNfeOs || '7')
        : (tipo === 'NFCE' ? (config?.serieNfce || '6') : (config?.serieNfe || '6'));

      const finalEnderecoEmitente = [
        selectedFilial?.endereco?.logradouro,
        selectedFilial?.endereco?.numero ? `nº ${selectedFilial.endereco.numero}` : '',
        selectedFilial?.endereco?.bairro
      ].filter(Boolean).join(', ') || selectedFilial?.cidade || 'Fortaleza';

      const dto: EmissaoFiscalDTO = {
        tipo,
        origem: isOs ? 'OS' : (origem === 'PDV' ? 'PDV' : 'AVULSA'),
        serie: serieFinal,
        origemId: origemId || undefined,
        origemCodigo: origemCodigo || undefined,
        filialId: selectedFilial?.id,
        emitente: selectedFilial ? {
          cnpj: selectedFilial.cnpj,
          razaoSocial: selectedFilial.razaoSocial || selectedFilial.nome,
          nomeFantasia: selectedFilial.nomeFantasia || selectedFilial.nome,
          inscricaoEstadual: selectedFilial.inscricaoEstadual || 'ISENTO',
          regimeTributario: selectedFilial.regimeTributario || config?.regimeTributario || 'SIMPLES_NACIONAL',
          endereco: finalEnderecoEmitente,
          telefone: selectedFilial.telefone,
          cidade: selectedFilial.endereco?.cidade || selectedFilial.cidade || 'Fortaleza',
          uf: selectedFilial.endereco?.estado || selectedFilial.uf || 'CE',
        } : undefined,
        naturezaOperacao: naturezaOperacao.trim(),
        clienteTipo: destinatarioTipo,
        clienteNome: finalNome,
        clienteNomeFantasia: finalFantasia || undefined,
        clienteDocumento: finalDoc,
        clienteInscricaoEstadual: finalIE,
        clienteEmail: clienteEmail.trim() || undefined,
        clienteTelefone: clienteTelefone.trim() || undefined,
        clienteEndereco: {
          logradouro: logradouro.trim(),
          numero: numero.trim(),
          complemento: complemento.trim() || undefined,
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          uf: uf.trim().toUpperCase(),
          cep: cleanCepNum,
        },
        formaPagamento,
        valorDesconto,
        valorFrete,
        itens: itens.map((it, idx) => ({
          codigo: it.codigo?.trim() || `PRD-${idx + 1}`,
          descricao: it.descricao.trim(),
          quantidade: Number(it.quantidade) || 1,
          valorUnitario: Number(it.valorUnitario) || 0,
          unidade: it.unidade?.trim() || 'UN',
          ncm: it.ncm?.trim() || config?.ncmPadrao || '6109.10.00',
          cfop: it.cfop?.trim() || config?.cfopPadraoInterno || '5102',
          csosn: it.csosn?.trim() || config?.csosnPadrao || '102',
        })),
      };

      const res = await ApiService.emitirNotaFiscal(dto);
      // Abre automaticamente em nova aba em tela cheia com opções (Imprimir/Salvar PDF, Fechar, Baixar XML, WhatsApp)
      try {
        openDanfeInNewTab(res);
      } catch (e) {
        console.error('Falha ao abrir DANFE em nova aba:', e);
      }
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao transmitir nota fiscal para a SEFAZ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div className={`bg-white w-full ${isInlineView ? 'rounded-2xl border border-slate-200 shadow-xs' : 'max-w-4xl rounded-2xl shadow-xl border border-slate-200'} flex flex-col overflow-hidden animate-in fade-in duration-150`}>
      {/* Header Minimalista Claro - Sem fundos escuros */}
      <div className="px-5 py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-slate-200 shadow-2xs"
            title="Voltar para a lista"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-extrabold text-base text-slate-900 tracking-tight">
                  {isVendedoraOuRecepcao ? 'Emitir Nota por Pedido (OS ou VND)' : 'Emitir Nota Fiscal Eletrônica'}
                </h2>
                {isVendedoraOuRecepcao && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                    <Lock className="w-3 h-3 text-amber-700" />
                    Vendedora / Recepção • Apenas Pedidos
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {isVendedoraOuRecepcao
                  ? 'Importe os dados da OS ou Venda (VND) para autorizar a nota fiscal. Emissão de nota avulsa não permitida.'
                  : `Transmissão direta para a SEFAZ • ${config?.ambiente === 'PRODUCAO' ? 'Produção Oficial' : 'Ambiente de Homologação / Testes'}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>SEFAZ Online</span>
          </div>

          <div
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
              config?.ambiente === 'PRODUCAO'
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {config?.ambiente === 'PRODUCAO' ? 'Produção' : 'Homologação'}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 flex-1 overflow-y-auto">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Type Selector: NF-e vs NFC-e */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
            Modelo do Documento Fiscal
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTipo('NFE')}
              className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                tipo === 'NFE'
                  ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20'
                  : 'border-slate-200 hover:bg-slate-50 bg-white'
              }`}
            >
              <div className={`p-2 rounded-lg ${tipo === 'NFE' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-slate-900">NF-e (Modelo 55)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Nota Fiscal grande completa com frete, transportadora e dados de destinatário.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTipo('NFCE')}
              className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                tipo === 'NFCE'
                  ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20'
                  : 'border-slate-200 hover:bg-slate-50 bg-white'
              }`}
            >
              <div className={`p-2 rounded-lg ${tipo === 'NFCE' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-slate-900">NFC-e (Modelo 65)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cupom Fiscal Eletrônico para balcão/PDV com QR Code e CPF opcional.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* SELEÇÃO DA FILIAL / EMPRESA EMISSORA (EMITENTE DA NOTA FISCAL) */}
        <div className="p-4 bg-gradient-to-r from-slate-50 via-blue-50/40 to-indigo-50/20 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-600 text-white rounded-lg shadow-2xs">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <label htmlFor="filial-select-emissao" className="block text-xs font-black text-slate-900 uppercase">
                  Filial / Empresa Emissora da Nota Fiscal
                </label>
                <p className="text-[11px] text-slate-500 font-medium">
                  Selecione a empresa/unidade para a qual serão impressas as notas fiscais no cabeçalho do DANFE.
                </p>
              </div>
            </div>
            {selectedFilial && (
              <span className="px-2.5 py-1 bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-xs font-black flex items-center gap-1">
                <span>{selectedFilial.codigo || 'FL'}</span>
                <span>•</span>
                <span>{selectedFilial.tipo === 'MATRIZ' ? 'Matriz' : 'Filial'}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <select
              id="filial-select-emissao"
              value={selectedFilialId}
              onChange={(e) => setSelectedFilialId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs cursor-pointer"
            >
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>
                  [{f.codigo || 'FL'}] {f.razaoSocial || f.nome} — CNPJ: {f.cnpj} ({f.cidade}/{f.uf})
                </option>
              ))}
            </select>
          </div>

          {/* Resumo da Empresa Selecionada para Impressão */}
          {selectedFilial && (
            <div className="p-3 bg-white/95 border border-slate-200 rounded-lg text-xs space-y-2 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Razão Social / Nome Fantasia</span>
                  <span className="font-extrabold text-slate-900 text-xs">{selectedFilial.razaoSocial || selectedFilial.nome}</span>
                  {selectedFilial.nomeFantasia && selectedFilial.nomeFantasia !== selectedFilial.razaoSocial && (
                    <span className="text-[11px] text-slate-500 font-medium block">Fantasia: {selectedFilial.nomeFantasia}</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CNPJ Emissor</span>
                    <span className="font-mono font-black text-blue-700 text-xs">{selectedFilial.cnpj}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Inscrição Estadual</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">{selectedFilial.inscricaoEstadual || 'ISENTO'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-2">
                <div>
                  <span className="text-slate-400 font-medium">Endereço de Impressão: </span>
                  <span className="font-bold text-slate-700">
                    {[
                      selectedFilial.endereco?.logradouro,
                      selectedFilial.endereco?.numero ? `nº ${selectedFilial.endereco.numero}` : '',
                      selectedFilial.endereco?.bairro,
                      `${selectedFilial.endereco?.cidade || selectedFilial.cidade || 'Fortaleza'}/${selectedFilial.endereco?.estado || selectedFilial.uf || 'CE'}`,
                      selectedFilial.endereco?.cep ? `CEP ${selectedFilial.endereco.cep}` : ''
                    ].filter(Boolean).join(' - ') || 'Fortaleza - CE'}
                  </span>
                </div>
                {selectedFilial.telefone && (
                  <div>
                    <span className="text-slate-400 font-medium">Telefone: </span>
                    <span className="font-bold text-slate-700">{selectedFilial.telefone}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Import from OS or PDV com Busca Inteligente */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                {isVendedoraOuRecepcao ? 'Importação Obrigatória de Pedido (OS ou VND)' : 'Importar Dados de Pedido Existente'}
              </span>
              {origemCodigo ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[11px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    Vinculada a {origemCodigo} (R$ {valorNotaTotal.toFixed(2)})
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                      origem === 'OS'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    {origem === 'OS'
                      ? `Série ${config?.serieNfeOs || '7'} (OS Demanda)`
                      : `Série ${tipo === 'NFCE' ? config?.serieNfce || '6' : config?.serieNfe || '6'} (VND Balcão)`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOrigemId('');
                      setOrigemCodigo('');
                      setSelectedOsId('');
                      if (isVendedoraOuRecepcao) {
                        setOrigem('OS');
                        setItens([]);
                        setPfNome('');
                        setPfCpf('');
                        setPjRazaoSocial('');
                        setPjCnpj('');
                        setPjNomeFantasia('');
                        setClienteEmail('');
                        setClienteTelefone('');
                        setCep('');
                        setLogradouro('');
                        setNumero('');
                        setComplemento('');
                        setBairro('');
                      } else {
                        setOrigem('AVULSA');
                        setOperacaoFiscal('VND');
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                    title={isVendedoraOuRecepcao ? 'Desvincular para selecionar outro pedido' : 'Desvincular pedido'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : isVendedoraOuRecepcao ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-bold">
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>Emissão Avulsa Bloqueada • Selecione uma OS ou VND</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Série Fiscal:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setOperacaoFiscal('VND');
                      setOrigem('AVULSA');
                    }}
                    className={`px-2 py-0.5 text-[11px] font-bold rounded transition cursor-pointer flex items-center gap-1 ${
                      operacaoFiscal === 'VND'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${operacaoFiscal === 'VND' ? 'bg-white' : 'bg-emerald-500'}`} />
                    VND (Série {tipo === 'NFCE' ? config?.serieNfce || '6' : config?.serieNfe || '6'})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOperacaoFiscal('OS');
                      setOrigem('OS');
                    }}
                    className={`px-2 py-0.5 text-[11px] font-bold rounded transition cursor-pointer flex items-center gap-1 ${
                      operacaoFiscal === 'OS'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${operacaoFiscal === 'OS' ? 'bg-white' : 'bg-amber-500'}`} />
                    OS (Série {config?.serieNfeOs || '7'})
                  </button>
                </div>
              )}
            </div>

            {isVendedoraOuRecepcao && !origemCodigo && (
              <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Perfil Vendedora / Recepção: Importação Obrigatória</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    Pesquise ou selecione abaixo a <strong>Ordem de Serviço (OS)</strong> ou a <strong>Venda Direta (VND)</strong> correspondente. Todos os dados fiscais e produtos do pedido serão carregados automaticamente para transmissão. Notas avulsas são bloqueadas para este perfil.
                  </p>
                </div>
              </div>
            )}

            {/* Campo Digitável com Busca Inteligente */}
            <div className="relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={pedidoSearchTerm}
                  onChange={(e) => {
                    setPedidoSearchTerm(e.target.value);
                    setIsSearchDropdownOpen(true);
                  }}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  placeholder="Pesquisar pedido por Nº da OS, Código do Pedido, Nome do Cliente ou CPF/CNPJ..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent shadow-xs"
                />
                {pedidoSearchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setPedidoSearchTerm('');
                    }}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Dropdown com resultados da busca inteligente */}
              {isSearchDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsSearchDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
                    <div className="p-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>{pedidoSearchTerm ? `Resultados para "${pedidoSearchTerm}"` : 'Pedidos Recentes'}</span>
                      <span className="text-[10px] text-slate-400">Clique para importar</span>
                    </div>

                    {searchResults.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        Nenhum pedido (OS ou VND) encontrado para "{pedidoSearchTerm}".
                      </div>
                    ) : (
                      searchResults.map((item) => (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          onClick={() => handleSelectPedido(item)}
                          className="w-full p-2.5 text-left hover:bg-blue-50/80 transition flex items-center justify-between gap-3 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                                item.type === 'OS'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              {item.type}
                            </span>
                            <div className="truncate">
                              <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">
                                <span className="font-mono font-extrabold">{item.codigo}</span> - {item.clienteNome}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate flex items-center gap-2">
                                {item.clienteDocumento && <span>Doc: {item.clienteDocumento}</span>}
                                {item.clienteEmail && <span className="text-slate-400 truncate">• {item.clienteEmail}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs font-black text-emerald-600 font-mono">
                              R$ {item.valor.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Importar
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Seletores rápidos alternativos para OS e PDV */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              <select
                value={selectedOsId}
                onChange={(e) => {
                  setSelectedOsId(e.target.value);
                  const found = availableOsList.find((o) => o.id === e.target.value);
                  if (found) applyOsData(found);
                }}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">Ou selecione da lista de OS...</option>
                {availableOsList.map((o) => {
                  const val = Number(o.valorFinal ?? o.valorTotal ?? o.subtotal ?? 0);
                  return (
                    <option key={o.id} value={o.id}>
                      {o.codigo} - {o.clienteNome} (R$ {val.toFixed(2)})
                    </option>
                  );
                })}
              </select>

              <select
                onChange={(e) => {
                  const found = availablePdvList.find((p) => p.id === e.target.value);
                  if (found) applyPdvData(found);
                }}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">Ou selecione da lista de Venda Direta (VND)...</option>
                {availablePdvList.map((p) => {
                  const val = Number(p.valorFinal ?? p.valorTotal ?? p.subtotal ?? (p as any).total ?? 0);
                  let cod = p.codigoVenda || p.osCodigo || 'VND';
                  if (cod.startsWith('PDV')) {
                    cod = cod.replace(/^PDV/i, 'VND');
                  }
                  return (
                    <option key={p.id} value={p.id}>
                      {cod} - {p.clienteNome || 'Balcão'} (R$ {val.toFixed(2)})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Destinatário (Cliente) - Idêntico ao Módulo Clientes (PF e PJ) */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4">
            {/* Header da Seção com Seletor Rápido de Cliente */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100/80 text-blue-700 rounded-xl">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>Dados do Destinatário (Cliente)</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 rounded-full border border-amber-200">
                      Obrigatório *
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Campos sincronizados com o módulo Clientes (Pessoa Física ou Jurídica)
                  </p>
                </div>
              </div>

              {/* Busca Inteligente de Cliente Cadastrado */}
              <div className="flex items-center gap-2 relative" ref={clientSearchDropdownRef}>
                <div className="relative min-w-[280px] w-full sm:w-80">
                  <input
                    type="text"
                    value={clientSearchTerm}
                    onChange={(e) => {
                      setClientSearchTerm(e.target.value);
                      setIsClientSearchDropdownOpen(true);
                    }}
                    onFocus={() => setIsClientSearchDropdownOpen(true)}
                    placeholder="Puxar de cliente cadastrado..."
                    className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-600 focus:outline-none placeholder:text-slate-400"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {clientSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setClientSearchTerm('');
                        setSelectedClientId('');
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
                      title="Limpar busca"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}

                  {/* Dropdown com resultados da busca inteligente */}
                  {isClientSearchDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50 divide-y divide-slate-100">
                      {filteredClients.length > 0 ? (
                        filteredClients.map((c) => {
                          const name = getClientDisplayName(c);
                          const cleanDoc = (c.cnpj || c.cpf || c.documento || '').replace(/\D/g, '');
                          const isPj = c.type === 'PJ' || cleanDoc.length > 11;
                          const formattedDoc = isPj ? formatCnpj(cleanDoc) : formatCpf(cleanDoc);

                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                applyClientData(c);
                                setIsClientSearchDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50/70 transition flex items-center justify-between gap-2 cursor-pointer ${
                                selectedClientId === c.id ? 'bg-blue-50/90 text-blue-900 font-bold' : 'text-slate-800'
                              }`}
                            >
                              <div className="truncate flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider ${
                                      isPj ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {isPj ? 'PJ' : 'PF'}
                                  </span>
                                  <span className="font-semibold text-slate-900 truncate">{name}</span>
                                </div>
                                {formattedDoc && (
                                  <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                                    {formattedDoc}
                                  </span>
                                )}
                              </div>
                              {c.endereco?.cidade && (
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                  {c.endereco.cidade}/{c.endereco.estado || 'CE'}
                                </span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-500">
                          Nenhum cliente cadastrado encontrado com esse termo.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Alternador de Tipo: Pessoa Física (PF) vs Pessoa Jurídica (PJ) */}
            <div className="flex items-center gap-3 pt-0.5">
              <span className="text-xs font-bold text-slate-700">Tipo de Destinatário:</span>
              <div className="inline-flex p-1 bg-slate-200/80 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setDestinatarioTipo('PF')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    destinatarioTipo === 'PF'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Pessoa Física (PF)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDestinatarioTipo('PJ')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    destinatarioTipo === 'PJ'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Pessoa Jurídica (PJ)</span>
                </button>
              </div>
            </div>

            {/* Campos Específicos para Pessoa Física (PF) */}
            {destinatarioTipo === 'PF' && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                <div className="sm:col-span-8">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pfNome}
                    onChange={(e) => setPfNome(e.target.value)}
                    placeholder="Ex: Maria da Silva Santos"
                    required
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    CPF <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pfCpf}
                    onChange={(e) => setPfCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    required
                    className={`w-full p-2.5 bg-white border rounded-xl text-xs font-mono font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none ${
                      pfCpf && !validateCPF(pfCpf) ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {pfCpf && !validateCPF(pfCpf) && (
                    <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
                      CPF inválido (deve conter 11 dígitos válidos)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Campos Específicos para Pessoa Jurídica (PJ) */}
            {destinatarioTipo === 'PJ' && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Razão Social <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pjRazaoSocial}
                      onChange={(e) => setPjRazaoSocial(e.target.value)}
                      placeholder="Ex: Confecções Silva e Santos LTDA"
                      required
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nome Fantasia <span className="text-slate-400 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={pjNomeFantasia}
                      onChange={(e) => setPjNomeFantasia(e.target.value)}
                      placeholder="Ex: Estamparia & Fardamentos Santos"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      CNPJ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pjCnpj}
                      onChange={(e) => setPjCnpj(formatCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      required
                      className={`w-full p-2.5 bg-white border rounded-xl text-xs font-mono font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none ${
                        pjCnpj && !validateCNPJ(pjCnpj) ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                      }`}
                    />
                    {pjCnpj && !validateCNPJ(pjCnpj) && (
                      <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
                        CNPJ inválido (deve conter 14 dígitos válidos)
                      </span>
                    )}
                  </div>

                  <div className="sm:col-span-6">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Inscrição Estadual <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setPjInscricaoEstadual('ISENTO')}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      >
                        Definir como ISENTO
                      </button>
                    </div>
                    <input
                      type="text"
                      value={pjInscricaoEstadual}
                      onChange={(e) => setPjInscricaoEstadual(e.target.value)}
                      placeholder="Ex: 06.123.456-7 ou ISENTO"
                      required
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Contato (Telefone e E-mail) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Telefone / WhatsApp <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={clienteTelefone}
                  onChange={(e) => setClienteTelefone(formatPhone(e.target.value))}
                  placeholder="(85) 90000-0000"
                  maxLength={15}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  E-mail para Envio do DANFE/XML <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="email"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                  placeholder="cliente@exemplo.com"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Endereço Completo com Busca Automática ViaCEP */}
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>Endereço Completo do Destinatário</span>
                  <span className="text-rose-500 font-bold">*</span>
                </h4>
                <span className="text-[10px] text-slate-500 font-medium">
                  Digite o CEP para preenchimento automático
                </span>
              </div>

              {cepFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-semibold border flex items-center gap-2 ${
                    cepFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : cepFeedback.type === 'error'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}
                >
                  {cepFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>{cepFeedback.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    CEP <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cep}
                      onChange={(e) => handleCepLookup(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                      required
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                    {isLoadingCep && (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </div>

                <div className="sm:col-span-7">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Logradouro / Rua <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={logradouro}
                    onChange={(e) => setLogradouro(e.target.value)}
                    placeholder="Ex: Rua Senador Pompeu, Av. Santos Dumont"
                    required
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Número <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="Ex: 120, S/N"
                    required
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Complemento <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                    placeholder="Ex: Apto 302, Bloco B, Sala 10"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Bairro <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    placeholder="Ex: Aldeota, Centro"
                    required
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Cidade <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    placeholder="Ex: Fortaleza"
                    required
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    UF <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={uf}
                    onChange={(e) => setUf(e.target.value.toUpperCase())}
                    placeholder="CE"
                    maxLength={2}
                    required
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 text-center uppercase focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Produtos e Serviços da Nota */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-1.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Itens da Nota Fiscal ({itens.length})
                </h3>
                {isVendedoraOuRecepcao && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    {origemCodigo ? `${itens.length} item(ns) importado(s)` : 'Importação de pedido obrigatória'}
                  </span>
                )}
              </div>
              {(!isVendedoraOuRecepcao || (isVendedoraOuRecepcao && origemCodigo)) && (
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Item</span>
                </button>
              )}
            </div>

            {isVendedoraOuRecepcao && !origemCodigo && (
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-center text-xs text-amber-900 font-medium space-y-1">
                <AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="font-bold">Nenhum pedido importado ainda</p>
                <p className="text-[11px] text-amber-800">
                  Para o perfil de Vendedora / Recepção, selecione ou pesquise uma <strong>Ordem de Serviço (OS)</strong> ou <strong>Venda Direta (VND)</strong> na seção de busca acima para carregar automaticamente os itens.
                </p>
              </div>
            )}

            <div className="space-y-2">
              {itens.map((it, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-600">Item #{idx + 1}</span>
                    {itens.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Cód. Produto</label>
                      <input
                        type="text"
                        value={it.codigo || ''}
                        onChange={(e) => handleItemChange(idx, 'codigo', e.target.value)}
                        placeholder="Ex: 8969"
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Descrição do Produto/Serviço</label>
                      <input
                        type="text"
                        value={it.descricao || ''}
                        onChange={(e) => handleItemChange(idx, 'descricao', e.target.value)}
                        placeholder="Descrição do produto ou serviço"
                        required
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">UN</label>
                      <input
                        type="text"
                        value={it.unidade || 'UN'}
                        onChange={(e) => handleItemChange(idx, 'unidade', e.target.value.toUpperCase())}
                        placeholder="UN"
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 text-center uppercase focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Qtd</label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={it.quantidade === '' || it.quantidade === 0 ? '' : it.quantidade}
                        onChange={(e) => handleItemChange(idx, 'quantidade', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        placeholder="0"
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1.5">
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Vl. Unit (R$)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={it.valorUnitario === '' || it.valorUnitario === 0 ? '' : it.valorUnitario}
                        onChange={(e) => handleItemChange(idx, 'valorUnitario', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        placeholder="0,00"
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1.5">
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Total</label>
                      <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-800 text-right truncate">
                        R$ {((Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">NCM</label>
                      <input
                        type="text"
                        value={it.ncm}
                        onChange={(e) => handleItemChange(idx, 'ncm', e.target.value)}
                        placeholder="6109.10.00"
                        className="w-full p-1.5 bg-white border border-slate-200 rounded text-[11px] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">CFOP</label>
                      <input
                        type="text"
                        value={it.cfop}
                        onChange={(e) => handleItemChange(idx, 'cfop', e.target.value)}
                        placeholder="5102"
                        className="w-full p-1.5 bg-white border border-slate-200 rounded text-[11px] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">CSOSN (Simples)</label>
                      <input
                        type="text"
                        value={it.csosn}
                        onChange={(e) => handleItemChange(idx, 'csosn', e.target.value)}
                        placeholder="102"
                        className="w-full p-1.5 bg-white border border-slate-200 rounded text-[11px] font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagamento e Totais - Design Minimalista Claro */}
          <div className="p-5 bg-slate-50/80 border border-slate-200 rounded-2xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-6 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Forma de Pagamento SEFAZ
                </label>
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value as any)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent shadow-2xs"
                >
                  <option value="PIX">17 - Pagamento Instantâneo (PIX)</option>
                  <option value="CARTAO_CREDITO">03 - Cartão de Crédito</option>
                  <option value="CARTAO_DEBITO">04 - Cartão de Débito</option>
                  <option value="DINHEIRO">01 - Dinheiro</option>
                  <option value="BOLETO">15 - Boleto Bancário</option>
                  <option value="OUTROS">99 - Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Natureza da Operação
                </label>
                <input
                  type="text"
                  value={naturezaOperacao}
                  onChange={(e) => setNaturezaOperacao(e.target.value)}
                  placeholder="Informe a natureza da operação (Ex: Venda de mercadoria, Prestação de serviços)"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Desconto (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorDesconto || ''}
                    onChange={(e) => setValorDesconto(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Frete (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorFrete || ''}
                    onChange={(e) => setValorFrete(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal dos Produtos:</span>
                <span className="font-mono font-bold text-slate-900">R$ {valorProdutosTotal.toFixed(2)}</span>
              </div>
              {valorDesconto > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                  <span>Desconto:</span>
                  <span className="font-mono">- R$ {valorDesconto.toFixed(2)}</span>
                </div>
              )}
              {valorFrete > 0 && (
                <div className="flex justify-between text-xs text-slate-600 font-semibold">
                  <span>Frete:</span>
                  <span className="font-mono">+ R$ {valorFrete.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline text-base font-black text-slate-900 pt-3 border-t border-slate-200">
                <span className="text-xs uppercase tracking-wider text-slate-700">TOTAL DA NOTA:</span>
                <span className="font-mono text-emerald-600 text-2xl font-black">R$ {valorNotaTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-200">
            {isVendedoraOuRecepcao && !hasPedidoImportado && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold w-full sm:w-auto">
                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Importe um pedido (OS ou VND) para liberar a transmissão</span>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto py-2.5 px-5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl cursor-pointer transition shadow-2xs"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || valorNotaTotal <= 0 || (isVendedoraOuRecepcao && !hasPedidoImportado)}
              className="w-full sm:w-auto py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Transmitindo para a SEFAZ...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Transmitir e Autorizar {tipo === 'NFE' ? 'NF-e' : 'NFC-e'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
  );

  if (isInlineView) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {content}
    </div>
  );
};
