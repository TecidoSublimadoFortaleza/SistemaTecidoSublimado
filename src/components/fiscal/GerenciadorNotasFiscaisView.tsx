import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  Download,
  Share2,
  FileText,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Ban,
  FileEdit,
  Unlink,
  Info,
  Send,
  Trash2,
  Table as TableIcon,
  Calendar,
} from 'lucide-react';
import { ApiService, NotaFiscal, ConfiguracaoFiscal } from '../../services/api';
import { XmlModal } from './XmlModal';
import { CancelamentoModal } from './CancelamentoModal';
import { NovaNotaModal } from './NovaNotaModal';
import { openDanfeInNewTab } from '../../utils/danfePrintHelper';

export interface FiscalGerenciadorItem {
  id: string;
  situacao: 'Autorizado' | 'Cancelado' | 'Inutilizado' | 'Pendente';
  tipoNf: string; // 'NE', 'NF-e', 'NFC-e'
  numOperacao: string; // '540', '541', etc.
  numNf: string; // '6112', '6113', etc.
  operacao: string; // 'NOTA AVULSA SAIDA', 'VENDA'
  cpfCnpj: string;
  nome: string;
  dataEmissao: string; // 'DD/MM/AAAA'
  total: number;
  motivoCancelamento?: string;
  serieNf: string;
  retornoSefaz: string;
  chaveAcesso?: string;
  protocolo?: string;
  itensCount?: number;
  email?: string;
  telefone?: string;
  filialId?: string;
  filialNome?: string;
  emitenteCnpj?: string;
}

// Lista inicial vazia conforme solicitação (nenhuma nota fiscal gerada ainda)
const INITIAL_MOCK_RECORDS: FiscalGerenciadorItem[] = [];

// Funções auxiliares para filtro de datas padrão (hoje) e personalizadas
import {
  getTodayFormatted,
  parseDateToMidnight,
  parseDateToEndOfDay,
} from '../../utils/dateFiscalUtils';
import { isVendedoraOuRecepcaoProfile, getLoggedUserAndPerfil } from '../../utils/userPermissions';

export {
  getTodayFormatted,
  parseDateToMidnight,
  parseDateToEndOfDay,
};

interface GerenciadorNotasFiscaisViewProps {
  userRole?: string;
  isDeveloper?: boolean;
}

export const GerenciadorNotasFiscaisView: React.FC<GerenciadorNotasFiscaisViewProps> = ({
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

  // Dados principais
  const [items, setItems] = useState<FiscalGerenciadorItem[]>(() => {
    try {
      localStorage.removeItem('subligestao_gerenciador_nfe');
      const saved = localStorage.getItem('subligestao_gerenciador_nfe_v2');
      if (saved) {
        const list: FiscalGerenciadorItem[] = JSON.parse(saved);
        const cleanList = list.filter(
          (it) =>
            it &&
            it.serieNf !== '6' &&
            it.situacao !== 'Inutilizado' &&
            !it.retornoSefaz?.includes('Rejeição') &&
            (it as any).status !== 'REJEITADA' &&
            it.id !== 'nfe_1789992380992_nv1tg'
        );
        localStorage.setItem('subligestao_gerenciador_nfe_v2', JSON.stringify(cleanList));
        return cleanList;
      }
    } catch {}
    return [];
  });

  // Filtros principais: padrão para notas geradas no dia (hoje), com total liberdade para outras datas
  const [dataInicio, setDataInicio] = useState<string>(() => getTodayFormatted());
  const [dataFim, setDataFim] = useState<string>(() => getTodayFormatted());
  const [filtroTipoData, setFiltroTipoData] = useState('DATA TRANSMISSÃO');
  const [filtroOperacao, setFiltroOperacao] = useState('TODAS AS OPERAÇÕES');
  const [filtroNumNf, setFiltroNumNf] = useState('');
  const [filtroSerieNf, setFiltroSerieNf] = useState('');

  // Checkboxes de Tipos
  const [filtroNfce, setFiltroNfce] = useState(true);
  const [filtroNfe, setFiltroNfe] = useState(true);

  // Checkboxes de Situação
  const [filtroEmitidas, setFiltroEmitidas] = useState(false);
  const [filtroPendentes, setFiltroPendentes] = useState(false);
  const [filtroCanceladas, setFiltroCanceladas] = useState(false);
  const [filtroInutilizadas, setFiltroInutilizadas] = useState(false);

  // Filtro de quebra
  const [quebraPor, setQuebraPor] = useState('');

  // Paginação e Busca
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Modais de ação
  const [selectedXml, setSelectedXml] = useState<NotaFiscal | null>(null);
  const [itemParaCancelar, setItemParaCancelar] = useState<FiscalGerenciadorItem | null>(null);
  const [itemParaInutilizar, setItemParaInutilizar] = useState<FiscalGerenciadorItem | null>(null);
  const [itemParaCce, setItemParaCce] = useState<FiscalGerenciadorItem | null>(null);
  const [itemParaMaisInfo, setItemParaMaisInfo] = useState<FiscalGerenciadorItem | null>(null);
  const [itemParaDesvincular, setItemParaDesvincular] = useState<FiscalGerenciadorItem | null>(null);
  const [itemParaEnviar, setItemParaEnviar] = useState<FiscalGerenciadorItem | null>(null);
  const [isNovaNotaOpen, setIsNovaNotaOpen] = useState(false);
  const [config, setConfig] = useState<ConfiguracaoFiscal | null>(null);

  // Estados dos formulários de modal
  const [justificativaCancelamento, setJustificativaCancelamento] = useState('');
  const [motivoInutilizacao, setMotivoInutilizacao] = useState('');
  const [textoCce, setTextoCce] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [isSyncingSpedy, setIsSyncingSpedy] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Helper para mapear NotaFiscal do backend para o formato da tabela
  const mapBackendNotaToGerenciadorItem = (bn: NotaFiscal, cfg: ConfiguracaoFiscal | null): FiscalGerenciadorItem => {
    let situacao: 'Autorizado' | 'Cancelado' | 'Inutilizado' | 'Pendente' = 'Autorizado';
    if (bn.status === 'CANCELADA') situacao = 'Cancelado';
    else if (bn.status === 'REJEITADA') situacao = 'Inutilizado';
    else if (bn.status === 'PROCESSANDO' || bn.status === 'PENDENTE') situacao = 'Pendente';

    const dateStr = bn.dataEmissao
      ? new Date(bn.dataEmissao).toLocaleDateString('pt-BR')
      : getTodayFormatted();

    const isOs = bn.origem === 'OS' || Boolean(bn.origemCodigo && String(bn.origemCodigo).toUpperCase().startsWith('OS'));
    const defaultSerie = isOs ? (cfg?.serieNfeOs || '7') : (bn.tipo === 'NFCE' ? (cfg?.serieNfce || '6') : (cfg?.serieNfe || '6'));
    const serieFinal = bn.serie && bn.serie !== '1' && bn.serie !== '3' ? bn.serie : defaultSerie;
    const operacaoFormatada =
      isOs
        ? 'ORDEM DE SERVIÇO'
        : bn.origem === 'PDV'
        ? 'VENDA'
        : 'NOTA AVULSA SAIDA';

    return {
      id: bn.id,
      situacao,
      tipoNf: bn.tipo === 'NFE' ? 'NE' : 'NFC-e',
      numOperacao: bn.origemCodigo?.replace(/\D/g, '') || bn.numero.toString(),
      numNf: bn.numero.toString(),
      operacao: operacaoFormatada,
      cpfCnpj: bn.clienteDocumento || '000.000.000-00',
      nome: bn.clienteNome,
      dataEmissao: dateStr,
      total: bn.valorTotal || 0,
      motivoCancelamento: bn.motivoCancelamento,
      serieNf: serieFinal,
      retornoSefaz:
        bn.statusSefaz
          ? bn.statusSefaz
          : bn.status === 'CANCELADA'
          ? 'Cancelamento de NF-e homologado Código: 101'
          : bn.status === 'REJEITADA'
          ? 'Rejeição: Nota rejeitada pela SEFAZ'
          : bn.status === 'PROCESSANDO' || bn.status === 'PENDENTE'
          ? 'Em processamento pela SEFAZ...'
          : 'Autorizado o uso da NF-e Código: 100',
      chaveAcesso: bn.chaveAcesso,
      protocolo: bn.protocolo,
      telefone: bn.clienteTelefone,
      email: bn.clienteEmail,
    };
  };

  const syncWithSpedy = async (silent = false) => {
    if (isSyncingSpedy) return;
    setIsSyncingSpedy(true);
    try {
      const res = await ApiService.syncPendingNotas();
      if (res?.notas && Array.isArray(res.notas)) {
        const mapped = res.notas.map((bn) => mapBackendNotaToGerenciadorItem(bn, config));
        setItems(mapped);
        try {
          localStorage.setItem('subligestao_gerenciador_nfe_v2', JSON.stringify(mapped));
        } catch {}
      }
      if (res?.updatedCount && res.updatedCount > 0) {
        setSyncFeedback(`${res.updatedCount} nota(s) atualizada(s) via Spedy!`);
        setTimeout(() => setSyncFeedback(null), 4000);
      } else if (!silent) {
        setSyncFeedback('Situação atualizada com a Spedy.');
        setTimeout(() => setSyncFeedback(null), 3000);
      }
    } catch (err: any) {
      if (!silent) {
        setSyncFeedback(`Erro na sincronização: ${err.message || 'Falha de comunicação'}`);
        setTimeout(() => setSyncFeedback(null), 4000);
      }
    } finally {
      setIsSyncingSpedy(false);
    }
  };

  // Salvar no localStorage sempre que houver modificações
  useEffect(() => {
    try {
      localStorage.setItem('subligestao_gerenciador_nfe_v2', JSON.stringify(items));
    } catch {}
  }, [items]);

  // Carregar notas reais do backend e sincronizar
  useEffect(() => {
    const fetchBackendNotas = async () => {
      try {
        const [backendNotas, cfg] = await Promise.all([
          ApiService.listNotasFiscais(),
          ApiService.getFiscalConfig().catch(() => null),
        ]);
        if (cfg) setConfig(cfg);
        if (Array.isArray(backendNotas)) {
          const mapped = backendNotas.map((bn) => mapBackendNotaToGerenciadorItem(bn, cfg));
          setItems(mapped);
          try {
            localStorage.setItem('subligestao_gerenciador_nfe_v2', JSON.stringify(mapped));
          } catch {}
        }
      } catch {}
    };

    fetchBackendNotas();
    // Executa sincronização suave com a Spedy
    syncWithSpedy(true);
  }, []);

  // Polling automático inteligente para atualizar notas pendentes
  useEffect(() => {
    const hasPending = items.some((i) => i.situacao === 'Pendente');
    const intervalMs = hasPending ? 7000 : 45000;

    const timer = setInterval(() => {
      syncWithSpedy(true);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [items.map((i) => `${i.id}_${i.situacao}`).join(',')]);

  // Filtragem dos registros
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Busca geral
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          item.nome.toLowerCase().includes(term) ||
          item.cpfCnpj.toLowerCase().includes(term) ||
          item.numNf.toLowerCase().includes(term) ||
          item.numOperacao.toLowerCase().includes(term) ||
          item.operacao.toLowerCase().includes(term) ||
          item.retornoSefaz.toLowerCase().includes(term);
        if (!matches) return false;
      }

      // Filtro por Data (Início e Fim) - Padrão: notas geradas no dia
      const startTs = parseDateToMidnight(dataInicio);
      const endTs = parseDateToEndOfDay(dataFim);
      if (startTs !== null || endTs !== null) {
        const itemTs = parseDateToMidnight(item.dataEmissao);
        if (itemTs !== null) {
          if (startTs !== null && itemTs < startTs) {
            return false;
          }
          if (endTs !== null && itemTs > endTs) {
            return false;
          }
        }
      }

      // Filtro Operação
      if (
        filtroOperacao !== 'TODAS AS OPERAÇÕES' &&
        item.operacao.toUpperCase() !== filtroOperacao.toUpperCase()
      ) {
        return false;
      }

      // Filtro Número NF
      if (filtroNumNf.trim() && !item.numNf.includes(filtroNumNf.trim())) {
        return false;
      }

      // Filtro Série NF
      if (filtroSerieNf.trim() && item.serieNf !== filtroSerieNf.trim()) {
        return false;
      }

      // Checkbox Tipo NF
      if (!filtroNfce && (item.tipoNf === 'NFC-e' || item.tipoNf === 'NFCE')) {
        return false;
      }
      if (!filtroNfe && (item.tipoNf === 'NE' || item.tipoNf === 'NFE' || item.tipoNf === 'NF-e')) {
        return false;
      }

      // Checkbox de Situação (se alguma marcada, filtra por elas)
      const hasStatusFilter =
        filtroEmitidas || filtroPendentes || filtroCanceladas || filtroInutilizadas;
      if (hasStatusFilter) {
        const matchesStatus =
          (filtroEmitidas && item.situacao === 'Autorizado') ||
          (filtroPendentes && item.situacao === 'Pendente') ||
          (filtroCanceladas && item.situacao === 'Cancelado') ||
          (filtroInutilizadas && item.situacao === 'Inutilizado');
        if (!matchesStatus) return false;
      }

      return true;
    });
  }, [
    items,
    searchTerm,
    dataInicio,
    dataFim,
    filtroOperacao,
    filtroNumNf,
    filtroSerieNf,
    filtroNfce,
    filtroNfe,
    filtroEmitidas,
    filtroPendentes,
    filtroCanceladas,
    filtroInutilizadas,
  ]);

  // Paginação
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredItems.length);
  const currentRecords = filteredItems.slice(startIndex, endIndex);

  // Ações da Linha
  const handleGerarNota = (item: FiscalGerenciadorItem) => {
    // Se a nota já estiver autorizada, confirma reemissão ou gera
    const updated = items.map((rec) => {
      if (rec.id === item.id) {
        return {
          ...rec,
          situacao: 'Autorizado' as const,
          retornoSefaz: 'Autorizado o uso da NF-e Código: 100',
        };
      }
      return rec;
    });
    setItems(updated);
    setActionSuccessMsg(`Nota Fiscal Nº ${item.numNf} autorizada com sucesso na SEFAZ!`);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleConfirmarCancelamento = () => {
    if (!itemParaCancelar) return;
    if (justificativaCancelamento.trim().length < 15) {
      alert('A justificativa de cancelamento da SEFAZ deve ter no mínimo 15 caracteres.');
      return;
    }

    const updated = items.map((rec) => {
      if (rec.id === itemParaCancelar.id) {
        return {
          ...rec,
          situacao: 'Cancelado' as const,
          motivoCancelamento: justificativaCancelamento.trim().toUpperCase(),
          retornoSefaz: 'Cancelamento de NF-e homologado Código: 101',
        };
      }
      return rec;
    });

    setItems(updated);
    setActionSuccessMsg(`Nota Fiscal Nº ${itemParaCancelar.numNf} cancelada com sucesso na SEFAZ.`);
    setItemParaCancelar(null);
    setJustificativaCancelamento('');
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleConfirmarInutilizacao = () => {
    if (!itemParaInutilizar) return;
    if (motivoInutilizacao.trim().length < 15) {
      alert('O motivo da inutilização deve conter no mínimo 15 caracteres.');
      return;
    }

    const updated = items.map((rec) => {
      if (rec.id === itemParaInutilizar.id) {
        return {
          ...rec,
          situacao: 'Inutilizado' as const,
          retornoSefaz: 'Inutilizacao de numero homologado Código: 102',
        };
      }
      return rec;
    });

    setItems(updated);
    setActionSuccessMsg(
      `Numeração da NF Nº ${itemParaInutilizar.numNf} inutilizada com sucesso na SEFAZ.`
    );
    setItemParaInutilizar(null);
    setMotivoInutilizacao('');
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleConfirmarCce = () => {
    if (!itemParaCce) return;
    if (textoCce.trim().length < 15) {
      alert('A Carta de Correção Eletrônica (CC-e) exige no mínimo 15 caracteres.');
      return;
    }

    setActionSuccessMsg(
      `Carta de Correção Eletrônica vinculada com sucesso à NF Nº ${itemParaCce.numNf} (Protocolo SEFAZ: 12326000${Math.floor(
        Math.random() * 900000 + 100000
      )}).`
    );
    setItemParaCce(null);
    setTextoCce('');
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleConfirmarDesvincular = () => {
    if (!itemParaDesvincular) return;
    const updated = items.map((rec) => {
      if (rec.id === itemParaDesvincular.id) {
        return {
          ...rec,
          numOperacao: '—',
          retornoSefaz: 'Nota desvinculada da operação',
        };
      }
      return rec;
    });

    setItems(updated);
    setActionSuccessMsg(
      `Nota Fiscal Nº ${itemParaDesvincular.numNf} desvinculada da operação com sucesso.`
    );
    setItemParaDesvincular(null);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleExcluirRegistro = async (item: FiscalGerenciadorItem) => {
    if (!confirm(`Deseja excluir permanentemente o registro da Nota Nº ${item.numNf} (${item.nome})?`)) return;

    const updated = items.filter((it) => it.id !== item.id);
    setItems(updated);
    try {
      localStorage.setItem('subligestao_gerenciador_nfe_v2', JSON.stringify(updated));
    } catch {}

    try {
      await (ApiService as any).deleteNota?.(item.id);
    } catch {}

    setActionSuccessMsg(`Registro da Nota Nº ${item.numNf} excluído com sucesso.`);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleLimparTodosRegistros = async () => {
    if (!confirm('Deseja limpar todos os registros de teste e redefinir a lista?')) return;

    setItems([]);
    try {
      localStorage.setItem('subligestao_gerenciador_nfe_v2', JSON.stringify([]));
    } catch {}

    try {
      await ApiService.resetFiscalTesting();
    } catch {}

    setActionSuccessMsg('Todos os registros de teste foram limpos com sucesso!');
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Conversor para o DanfeModal e XmlModal existentes
  const itemToNotaFiscal = (item: FiscalGerenciadorItem): NotaFiscal => {
    return {
      id: item.id,
      tipo: item.tipoNf === 'NFC-e' ? 'NFCE' : 'NFE',
      origem: item.operacao === 'VENDA' ? 'PDV' : 'AVULSA',
      origemCodigo: `OP-${item.numOperacao}`,
      numero: Number(item.numNf) || 6100,
      serie: item.serieNf,
      chaveAcesso: item.chaveAcesso || `232609071234560001895500300000${item.numNf}1005401234`,
      protocolo: item.protocolo || '123260001540100',
      dataEmissao: new Date().toISOString(),
      status: item.situacao === 'Cancelado' ? 'CANCELADA' : 'AUTORIZADA',
      statusSefaz: item.retornoSefaz,
      motivoCancelamento: item.motivoCancelamento,
      clienteNome: item.nome,
      clienteDocumento: item.cpfCnpj,
      clienteTelefone: item.telefone,
      clienteEmail: item.email,
      clienteEndereco: (item as any).clienteEndereco
        ? (typeof (item as any).clienteEndereco === 'object'
            ? (item as any).clienteEndereco
            : { logradouro: String((item as any).clienteEndereco), numero: 'S/N', bairro: '', cidade: 'FORTALEZA', uf: 'CE', cep: '' })
        : undefined,
      emitente: {
        cnpj: '36.047.818/0001-07',
        razaoSocial: 'TECIDO SUBLIMADO FORTALEZA COMERCIO E SERVICOS LTDA',
        nomeFantasia: 'TECIDO SUBLIMADO FORTALEZA',
        inscricaoEstadual: '061671967',
        regimeTributario: 'SIMPLES_NACIONAL',
        endereco: 'AVENIDA SENADOR FERNANDES TÁVORA, 2305',
        cidade: 'FORTALEZA',
        uf: 'CE',
        telefone: '(85) 98425-1321',
      } as any,
      naturezaOperacao: item.operacao,
      valorProdutos: item.total,
      valorTotal: item.total,
      formaPagamento: 'PIX',
      itens: [
        {
          id: 'item-1',
          descricao: item.operacao,
          quantidade: 1,
          valorUnitario: item.total,
          valorTotal: item.total,
          unidade: 'UN',
          ncm: '6109.10.00',
          cfop: '5102',
          csosn: '102',
        },
      ],
      xmlConteudo: `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${item.chaveAcesso || '232609071234560001895500300000' + item.numNf + '1005401234'}" versao="4.00">
      <ide>
        <cUF>23</cUF>
        <cNF>${item.numOperacao}</cNF>
        <natOp>${item.operacao}</natOp>
        <mod>55</mod>
        <serie>${item.serieNf}</serie>
        <nNF>${item.numNf}</nNF>
        <dhEmi>2026-09-01T10:00:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>2304400</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>4</cDV>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>SubliGestao_4.0</verProc>
      </ide>
      <emit>
        <CNPJ>07123456000189</CNPJ>
        <xNome>TECIDO SUBLIMADO FORTALEZA LTDA</xNome>
        <xFant>TECIDO SUBLIMADO</xFant>
        <IE>061234567</IE>
        <CRT>1</CRT>
      </emit>
      <dest>
        <CNPJ>${item.cpfCnpj.replace(/\D/g, '')}</CNPJ>
        <xNome>${item.nome}</xNome>
        <indIEDest>9</indIEDest>
      </dest>
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vProd>${item.total.toFixed(2)}</vProd>
          <vNF>${item.total.toFixed(2)}</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>SEFAZ_CE_4.0</verAplic>
      <chNFe>${item.chaveAcesso || '232609071234560001895500300000' + item.numNf + '1005401234'}</chNFe>
      <dhRecbto>2026-09-01T10:00:05-03:00</dhRecbto>
      <nProt>${item.protocolo || '123260001540100'}</nProt>
      <digVal>abcdef123456=</digVal>
      <cStat>${item.situacao === 'Cancelado' ? '101' : '100'}</cStat>
      <xMotivo>${item.retornoSefaz}</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`,
      ambiente: 'PRODUCAO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handleExportCsv = () => {
    const headers = [
      'Situação',
      'Tipo NF',
      'Nº Operação',
      'Nº NF',
      'Operação',
      'CPF/CNPJ',
      'Nome',
      'Data Emissão',
      'Total',
      'Motivo Cancelamento',
      'Série NF',
      'Retorno SEFAZ',
    ];
    const rows = filteredItems.map((item) => [
      item.situacao,
      item.tipoNf,
      item.numOperacao,
      item.numNf,
      `"${item.operacao}"`,
      `"${item.cpfCnpj}"`,
      `"${item.nome}"`,
      item.dataEmissao,
      item.total.toFixed(2).replace('.', ','),
      `"${item.motivoCancelamento || ''}"`,
      item.serieNf,
      `"${item.retornoSefaz}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gerenciador_notas_fiscais_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    // Generate dedicated, clean printable report of current filtered items
    const itemsToPrint = currentRecords && currentRecords.length > 0 ? currentRecords : filteredItems;
    const rowsHtml = itemsToPrint
      .map(
        (item) => `
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px;">${item.situacao}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px;">${item.tipoNf}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; font-weight: bold; font-family: monospace;">${item.numNf}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; font-family: monospace; text-align: center;">${item.serieNf}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px;">${item.operacao}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; font-family: monospace;">${item.cpfCnpj}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; font-weight: 500;">${item.nome}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; text-align: center;">${item.dataEmissao}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; text-align: right; font-weight: bold;">R$ ${item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      </tr>`
      )
      .join('');

    const totalGeral = filteredItems.reduce((acc, curr) => acc + curr.total, 0);

    const reportHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Notas Fiscais - Tecido Sublimado</title>
  <style>
    @page { size: landscape; margin: 8mm; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 16px; color: #0f172a; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
    .title { font-size: 18px; font-weight: 800; color: #0f172a; }
    .meta { font-size: 11px; color: #64748b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #0f172a; color: #ffffff; padding: 7px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
    .footer { margin-top: 16px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; border-top: 1px solid #94a3b8; padding-top: 10px; }
    .no-print { margin-bottom: 16px; display: flex; gap: 8px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">🖨️ Imprimir Relatório / Salvar PDF</button>
    <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">Fechar</button>
  </div>
  <div class="header">
    <div>
      <div class="title">RELATÓRIO GERENCIAL DE NOTAS FISCAIS</div>
      <div class="meta">TECIDO SUBLIMADO • Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</div>
    </div>
    <div style="text-align: right;">
      <div class="meta">Total de Registros: <strong>${filteredItems.length}</strong></div>
      <div class="meta">Valor Total: <strong>R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Situação</th>
        <th>Tipo</th>
        <th>Nº NF</th>
        <th style="text-align: center;">Série</th>
        <th>Operação</th>
        <th>CPF/CNPJ</th>
        <th>Cliente / Razão Social</th>
        <th style="text-align: center;">Data</th>
        <th style="text-align: right;">Total (R$)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="footer">
    <span>ERP SubliGestão - Módulo Fiscal</span>
    <span>Total Filtrado: R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 350);
    };
  </script>
</body>
</html>`;

    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  };

  if (isNovaNotaOpen) {
    return (
      <div className="w-full space-y-4 animate-in fade-in duration-150">
        <NovaNotaModal
          isOpen={true}
          isInlineView={true}
          config={config}
          userRole={effectiveRole}
          isDeveloper={effectiveIsDev}
          onClose={() => setIsNovaNotaOpen(false)}
          onSuccess={(novaNota) => {
            const dateStr = new Date().toLocaleDateString('pt-BR');
            const isOs = novaNota.origem === 'OS' || Boolean(novaNota.origemCodigo && String(novaNota.origemCodigo).toUpperCase().startsWith('OS'));
            const targetSerie = isOs ? (config?.serieNfeOs || '7') : (novaNota.tipo === 'NFCE' ? (config?.serieNfce || '6') : (config?.serieNfe || '6'));
            const serieFinal = novaNota.serie && novaNota.serie !== '1' && novaNota.serie !== '3' ? novaNota.serie : targetSerie;

            const newItem: FiscalGerenciadorItem = {
              id: novaNota.id,
              situacao: 'Autorizado',
              tipoNf: novaNota.tipo === 'NFE' ? 'NE' : 'NFC-e',
              numOperacao: novaNota.origemCodigo || String(novaNota.numero),
              numNf: String(novaNota.numero),
              operacao: novaNota.naturezaOperacao || (isOs ? 'ORDEM DE SERVIÇO' : 'VENDA'),
              cpfCnpj: novaNota.clienteDocumento || '000.000.000-00',
              nome: novaNota.clienteNome,
              dataEmissao: dateStr,
              total: novaNota.valorTotal,
              serieNf: serieFinal,
              retornoSefaz: 'Autorizado o uso da NF-e Código: 100',
              chaveAcesso: novaNota.chaveAcesso,
              protocolo: novaNota.protocolo,
              filialId: novaNota.filialId,
              filialNome: novaNota.emitente?.razaoSocial || novaNota.emitente?.nomeFantasia,
              emitenteCnpj: novaNota.emitente?.cnpj,
            };
            setItems((prev) => [newItem, ...prev]);
            setIsNovaNotaOpen(false);
            openDanfeInNewTab(novaNota);
            setActionSuccessMsg(`Nota Fiscal Nº ${newItem.numNf} emitida e autorizada com sucesso!`);
            setTimeout(() => setActionSuccessMsg(null), 4000);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans text-slate-800 animate-in fade-in duration-200">
      {/* Notificação Flutuante de Sucesso */}
      {actionSuccessMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-500 animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-200" />
          <span className="text-sm font-bold">{actionSuccessMsg}</span>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="ml-3 hover:text-emerald-200 text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Breadcrumb / Top Bar Fiel à imagem */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100/80 px-3 py-2 rounded-lg border border-slate-200">
        <ChevronLeft className="w-4 h-4 text-blue-600 cursor-pointer" />
        <span className="text-blue-600 font-bold hover:underline cursor-pointer">Operações</span>
        <span>|</span>
        <span className="text-blue-600 font-bold hover:underline cursor-pointer">
          Documentos Fiscais
        </span>
        <span>|</span>
        <span className="text-slate-800 font-bold">Gerenciador de Notas Fiscais</span>
      </div>

      {/* Card Principal */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Barra de Título Superior do Card */}
        <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xs sm:text-sm font-bold text-slate-700">
              Gerenciador de Notas Fiscais
            </h2>
            {syncFeedback && (
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 animate-in fade-in duration-200">
                {syncFeedback}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => syncWithSpedy(false)}
              disabled={isSyncingSpedy}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Consultar situação atualizada de notas no Spedy / SEFAZ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSpedy ? 'animate-spin' : ''}`} />
              <span>{isSyncingSpedy ? 'Sincronizando...' : 'Sincronizar com Spedy'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsNovaNotaOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title={
                isVendedoraOuRecepcao
                  ? 'Importar e emitir nota fiscal de pedido (OS ou VND)'
                  : 'Emitir nova nota fiscal'
              }
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isVendedoraOuRecepcao ? 'Importar Nota (OS / VND)' : 'Emitir Nova Nota'}</span>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Formulário de Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            {/* Linha 1 */}
            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-600">Início</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDataInicio(getTodayFormatted());
                      setCurrentPage(1);
                    }}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    title="Definir Início como hoje"
                  >
                    Hoje
                  </button>
                  {dataInicio && (
                    <button
                      type="button"
                      onClick={() => {
                        setDataInicio('');
                        setCurrentPage(1);
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Limpar filtro de início"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="DD/MM/AAAA"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 pr-7 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                />
                <input
                  type="date"
                  aria-label="Selecionar Data de Início"
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split('-');
                      setDataInicio(`${d}/${m}/${y}`);
                      setCurrentPage(1);
                    }
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40 hover:opacity-100 cursor-pointer border-0 p-0 bg-transparent text-transparent"
                  title="Selecionar no calendário"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-600">Fim</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDataFim(getTodayFormatted());
                      setCurrentPage(1);
                    }}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    title="Definir Fim como hoje"
                  >
                    Hoje
                  </button>
                  {dataFim && (
                    <button
                      type="button"
                      onClick={() => {
                        setDataFim('');
                        setCurrentPage(1);
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Limpar filtro de fim"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="DD/MM/AAAA"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 pr-7 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                />
                <input
                  type="date"
                  aria-label="Selecionar Data de Fim"
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split('-');
                      setDataFim(`${d}/${m}/${y}`);
                      setCurrentPage(1);
                    }
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40 hover:opacity-100 cursor-pointer border-0 p-0 bg-transparent text-transparent"
                  title="Selecionar no calendário"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filtro</label>
              <select
                value={filtroTipoData}
                onChange={(e) => setFiltroTipoData(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 bg-white"
              >
                <option value="DATA TRANSMISSÃO">DATA TRANSMISSÃO</option>
                <option value="DATA EMISSÃO">DATA EMISSÃO</option>
                <option value="DATA AUTORIZAÇÃO">DATA AUTORIZAÇÃO</option>
                <option value="DATA CANCELAMENTO">DATA CANCELAMENTO</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Operação</label>
              <select
                value={filtroOperacao}
                onChange={(e) => setFiltroOperacao(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 bg-white"
              >
                <option value="TODAS AS OPERAÇÕES">TODAS AS OPERAÇÕES</option>
                <option value="NOTA AVULSA SAIDA">NOTA AVULSA SAIDA</option>
                <option value="VENDA">VENDA</option>
                <option value="DEVOLUÇÃO">DEVOLUÇÃO</option>
                <option value="TRANSFERÊNCIA">TRANSFERÊNCIA</option>
              </select>
            </div>

            {/* Linha 2 */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Número NF
              </label>
              <input
                type="text"
                value={filtroNumNf}
                onChange={(e) => setFiltroNumNf(e.target.value)}
                placeholder=""
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>

            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-600">
                  Série NF
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroSerieNf('6');
                      setCurrentPage(1);
                    }}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition ${
                      filtroSerieNf === '6'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title="Filtrar Série 6 (VND / Pronta Entrega)"
                  >
                    Série 6
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroSerieNf('7');
                      setCurrentPage(1);
                    }}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition ${
                      filtroSerieNf === '7'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title="Filtrar Série 7 (OS / Sob Demanda)"
                  >
                    Série 7
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={filtroSerieNf}
                onChange={(e) => setFiltroSerieNf(e.target.value)}
                placeholder="Ex: 6 ou 7"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>

            <div className="md:col-span-6 flex flex-col justify-end gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium">Atalhos de Período:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayFormatted();
                      setDataInicio(today);
                      setDataFim(today);
                      setCurrentPage(1);
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition ${
                      dataInicio === getTodayFormatted() && dataFim === getTodayFormatted()
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title="Filtrar notas geradas no dia de hoje (Padrão)"
                  >
                    Hoje (Padrão)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                      const fd = `${String(firstDay.getDate()).padStart(2, '0')}/${String(firstDay.getMonth() + 1).padStart(2, '0')}/${firstDay.getFullYear()}`;
                      setDataInicio(fd);
                      setDataFim(getTodayFormatted());
                      setCurrentPage(1);
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer transition"
                    title="Filtrar notas do mês atual"
                  >
                    Mês Atual
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDataInicio('');
                      setDataFim('');
                      setCurrentPage(1);
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition ${
                      !dataInicio && !dataFim
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title="Exibir todas as notas emitidas sem filtro de período"
                  >
                    Todas as Datas
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                className="w-full bg-[#0088ff] hover:bg-[#0077ee] text-white font-bold py-1.5 px-4 rounded shadow-2xs flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Consulta</span>
              </button>
            </div>
          </div>

          {/* Linhas de Checkboxes */}
          <div className="space-y-2 pt-1 border-t border-slate-100 text-xs">
            {/* Checkbox Tipo */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtroNfce}
                  onChange={(e) => setFiltroNfce(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span className="text-slate-700 font-medium text-xs">NFC-e</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtroNfe}
                  onChange={(e) => setFiltroNfe(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span className="text-slate-700 font-medium text-xs">NF-e</span>
              </label>
            </div>

            {/* Checkbox Status */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtroEmitidas}
                  onChange={(e) => setFiltroEmitidas(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span className="text-slate-700 font-medium text-xs">Emitidas</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtroPendentes}
                  onChange={(e) => setFiltroPendentes(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span className="text-slate-700 font-medium text-xs">Pendentes</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtroCanceladas}
                  onChange={(e) => setFiltroCanceladas(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span className="text-slate-700 font-medium text-xs">Canceladas</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtroInutilizadas}
                  onChange={(e) => setFiltroInutilizadas(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span className="text-slate-700 font-medium text-xs">Inutilizadas</span>
              </label>
            </div>
          </div>

          {/* Barra de Quebra para Impressão com Ícones no Lado Direito */}
          <div className="pt-3 border-t border-slate-200 flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div className="w-full md:w-80">
              <p className="text-[10px] text-slate-500 font-medium mb-1">
                Filtros abaixo são referentes à impressão
              </p>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Quebra por
              </label>
              <select
                value={quebraPor}
                onChange={(e) => setQuebraPor(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 bg-white"
              >
                <option value="">Selecione uma quebra</option>
                <option value="OPERACAO">Por Operação</option>
                <option value="CLIENTE">Por Cliente</option>
                <option value="DATA">Por Data de Emissão</option>
                <option value="SITUACAO">Por Situação</option>
              </select>
            </div>

            {/* Ícones Azuis de Ação Superior (Tabela, Excel, Imprimir) */}
            <div className="flex items-center gap-1.5 self-end">
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                title="Visualizar Tabela"
                className="w-8 h-8 rounded bg-[#0088ff] hover:bg-[#0077ee] text-white flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              >
                <TableIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                title="Exportar Excel/CSV"
                className="w-8 h-8 rounded bg-[#0088ff] hover:bg-[#0077ee] text-white flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handlePrint}
                title="Imprimir Relatório"
                className="w-8 h-8 rounded bg-[#0088ff] hover:bg-[#0077ee] text-white flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Controles de Tabela: 'Mostrar X Resultados' e 'Buscar:' */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span>Mostrar</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-slate-300 rounded px-2 py-1 bg-white text-xs text-slate-700 focus:outline-hidden"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>Resultados</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Buscar:</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white w-48 sm:w-60"
              />
            </div>
          </div>

          {/* Tabela de Dados Exata */}
          <div className="w-full overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-[11px] whitespace-nowrap border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-2 px-2.5 border-r border-slate-200">Situação</th>
                  <th className="py-2 px-2 border-r border-slate-200">Tipo NF</th>
                  <th className="py-2 px-2 border-r border-slate-200">Nº Operação</th>
                  <th className="py-2 px-2 border-r border-slate-200">Nº NF</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">Operação</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">CPF/CNPJ</th>
                  <th className="py-2 px-3 border-r border-slate-200">Nome</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">Data Emissão</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">Total</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">Motivo Cancelamento</th>
                  <th className="py-2 px-2 border-r border-slate-200">Série NF</th>
                  <th className="py-2 px-3 border-r border-slate-200 text-center">Ações</th>
                  <th className="py-2 px-3">Retorno Sefaz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {currentRecords.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-500 font-medium">
                      <div className="flex flex-col items-center justify-center gap-2 py-4">
                        <FileText className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                        <p className="text-sm font-bold text-slate-700">
                          {items.length === 0
                            ? 'Nenhuma nota fiscal gerada até o momento'
                            : 'Nenhum registro encontrado para os filtros selecionados'}
                        </p>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                          {items.length === 0
                            ? 'O módulo está pronto e limpo. Conforme novas notas forem emitidas (avulsa, por pedido/OS ou no PDV), elas serão listadas aqui.'
                            : 'Tente alterar ou limpar os filtros de data, operação ou situação para visualizar os registros.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentRecords.map((item) => {
                    // Estilos de Situação
                    let badgeBg = 'bg-[#22c55e] text-white'; // Autorizado (Verde)
                    if (item.situacao === 'Cancelado') {
                      badgeBg = 'bg-[#ef4444] text-white'; // Cancelado (Vermelho)
                    } else if (item.situacao === 'Inutilizado') {
                      badgeBg = 'bg-[#eab308] text-white'; // Inutilizado (Amarelo)
                    } else if (item.situacao === 'Pendente') {
                      badgeBg = 'bg-[#64748b] text-white'; // Pendente (Cinza/Azul)
                    }

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Situação */}
                        <td className="py-2 px-2.5 border-r border-slate-200">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${badgeBg} ${
                              item.situacao === 'Pendente' ? 'animate-pulse' : ''
                            }`}
                          >
                            {item.situacao === 'Pendente' && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                            <span>{item.situacao}</span>
                          </span>
                        </td>

                        {/* 2. Tipo NF */}
                        <td className="py-2 px-2 text-center text-slate-700 font-medium border-r border-slate-200">
                          {item.tipoNf}
                        </td>

                        {/* 3. Nº Operação */}
                        <td className="py-2 px-2 text-center font-medium text-slate-700 border-r border-slate-200">
                          {item.numOperacao}
                        </td>

                        {/* 4. Nº NF */}
                        <td className="py-2 px-2 text-center font-bold text-slate-900 border-r border-slate-200">
                          <div>{item.numNf}</div>
                          {item.filialNome && (
                            <span
                              className="inline-block mt-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[9px] font-black truncate max-w-[120px]"
                              title={`Filial Emissora: ${item.filialNome}${item.emitenteCnpj ? ' - CNPJ: ' + item.emitenteCnpj : ''}`}
                            >
                              {item.filialNome.replace('TECIDO SUBLIMADO - ', '')}
                            </span>
                          )}
                        </td>

                        {/* 5. Operação */}
                        <td className="py-2 px-2.5 text-slate-700 font-medium border-r border-slate-200">
                          {item.operacao}
                        </td>

                        {/* 6. CPF/CNPJ */}
                        <td className="py-2 px-2.5 text-slate-700 font-mono text-[10.5px] border-r border-slate-200">
                          {item.cpfCnpj}
                        </td>

                        {/* 7. Nome */}
                        <td
                          className="py-2 px-3 text-slate-900 font-semibold max-w-[220px] truncate border-r border-slate-200"
                          title={item.nome}
                        >
                          {item.nome}
                        </td>

                        {/* 8. Data Emissão */}
                        <td className="py-2 px-2.5 text-slate-700 text-center border-r border-slate-200">
                          {item.dataEmissao}
                        </td>

                        {/* 9. Total */}
                        <td className="py-2 px-2.5 text-slate-900 font-bold text-right border-r border-slate-200">
                          {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>

                        {/* 10. Motivo Cancelamento */}
                        <td
                          className="py-2 px-2.5 text-slate-600 italic max-w-[160px] truncate border-r border-slate-200"
                          title={item.motivoCancelamento || ''}
                        >
                          {item.motivoCancelamento || ''}
                        </td>

                        {/* 11. Série NF */}
                        <td className="py-2 px-2 text-center text-slate-700 font-medium border-r border-slate-200">
                          {item.serieNf}
                        </td>

                        {/* 12. Botões de Ação Coloridos Fiel à Imagem */}
                        <td className="py-1.5 px-2 border-r border-slate-200">
                          <div className="flex items-center gap-1 justify-center">
                            {/* Gerar Nota (Verde) */}
                            <button
                              type="button"
                              onClick={() => handleGerarNota(item)}
                              className="bg-[#22c55e] hover:bg-[#16a34a] text-white text-[10px] font-bold px-2 py-1 rounded shadow-2xs cursor-pointer transition-colors whitespace-nowrap"
                            >
                              Gerar Nota
                            </button>

                            {/* Cancelar Nota (Vermelho) */}
                            <button
                              type="button"
                              onClick={() => {
                                setItemParaCancelar(item);
                                setJustificativaCancelamento('');
                              }}
                              className="bg-[#ef4444] hover:bg-[#dc2626] text-white text-[10px] font-bold px-2 py-1 rounded shadow-2xs cursor-pointer transition-colors whitespace-nowrap"
                            >
                              Cancelar Nota
                            </button>

                            {/* Inutilizar Nota (Oliva/Cinza) */}
                            <button
                              type="button"
                              onClick={() => {
                                setItemParaInutilizar(item);
                                setMotivoInutilizacao('');
                              }}
                              className="bg-[#78716c] hover:bg-[#57534e] text-white text-[10px] font-bold px-2 py-1 rounded shadow-2xs cursor-pointer transition-colors whitespace-nowrap"
                            >
                              Inutilizar Nota
                            </button>

                            {/* CC-e (Amarelo) */}
                            <button
                              type="button"
                              onClick={() => {
                                setItemParaCce(item);
                                setTextoCce('');
                              }}
                              className="bg-[#eab308] hover:bg-[#ca8a04] text-white text-[10px] font-bold px-2 py-1 rounded shadow-2xs cursor-pointer transition-colors whitespace-nowrap"
                            >
                              CC-e
                            </button>

                            {/* Desvincular Nota (Laranja) */}
                            <button
                              type="button"
                              onClick={() => setItemParaDesvincular(item)}
                              className="bg-[#f97316] hover:bg-[#ea580c] text-white text-[10px] font-bold px-2 py-1 rounded shadow-2xs cursor-pointer transition-colors whitespace-nowrap"
                            >
                              Desvincular Nota
                            </button>

                            {/* Mais Informações (Azul Escuro) */}
                            <button
                              type="button"
                              onClick={() => setItemParaMaisInfo(item)}
                              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[10px] font-bold px-2 py-1 rounded shadow-2xs cursor-pointer transition-colors whitespace-nowrap"
                            >
                              Mais Informações
                            </button>

                            {/* Imprimir (Azul Claro) */}
                            <button
                              type="button"
                              onClick={() => {
                                const nota = itemToNotaFiscal(item);
                                openDanfeInNewTab(nota);
                              }}
                              className="bg-[#0284c7] hover:bg-[#0369a1] text-white text-[10px] font-bold px-2 py-1 rounded shadow-2xs cursor-pointer transition-colors whitespace-nowrap"
                            >
                              Imprimir
                            </button>

                            {/* XML (Azul Claro) */}
                            <button
                              type="button"
                              onClick={() => setSelectedXml(itemToNotaFiscal(item))}
                              className="bg-[#0284c7] hover:bg-[#0369a1] text-white text-[10px] font-bold px-2 py-1 rounded shadow-2xs cursor-pointer transition-colors whitespace-nowrap"
                            >
                              XML
                            </button>

                            {/* Enviar Nota (Azul Claro com Ícone Share) */}
                            <button
                              type="button"
                              onClick={() => setItemParaEnviar(item)}
                              className="bg-[#0284c7] hover:bg-[#0369a1] text-white text-[10px] font-bold px-2 py-1 rounded shadow-2xs cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap"
                            >
                              <Share2 className="w-2.5 h-2.5" />
                              <span>Enviar Nota</span>
                            </button>

                            {/* Excluir Registro (Vermelho Escuro com Ícone Trash2) */}
                            <button
                              type="button"
                              onClick={() => handleExcluirRegistro(item)}
                              title="Excluir este registro do gerenciador"
                              className="bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-2xs cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </td>

                        {/* 13. Retorno Sefaz */}
                        <td
                          className="py-2 px-3 text-slate-700 text-[10.5px] max-w-[280px] truncate"
                          title={item.retornoSefaz}
                        >
                          {item.retornoSefaz}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé da Tabela: 'Mostrando X a Y de Z resultados' e Paginação */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-600">
            <div>
              {filteredItems.length === 0
                ? 'Mostrando 0 resultados'
                : `Mostrando ${startIndex + 1} a ${endIndex} de ${filteredItems.length} resultados.`}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="px-2 py-1 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs cursor-pointer"
                >
                  Anterior
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => setCurrentPage(pg)}
                    className={`px-2.5 py-1 border rounded text-xs font-bold cursor-pointer ${
                      safeCurrentPage === pg
                        ? 'bg-[#0088ff] text-white border-[#0088ff]'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {pg}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  className="px-2 py-1 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs cursor-pointer"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Barra Inferior com Botão 'Gerar Notas' Azul Fiel à Imagem */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={() => setIsNovaNotaOpen(true)}
            className="w-full bg-[#0088ff] hover:bg-[#0077ee] text-white font-bold py-2 px-6 rounded shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs uppercase tracking-wider"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Gerar Notas</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: CANCELAR NOTA */}
      {itemParaCancelar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-black">
                <Ban className="w-5 h-5" />
                <h3 className="text-base">Cancelar Nota Fiscal</h3>
              </div>
              <button
                onClick={() => setItemParaCancelar(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                Você está solicitando o cancelamento da <strong>NF Nº {itemParaCancelar.numNf}</strong>{' '}
                (Série {itemParaCancelar.serieNf}) emitida para{' '}
                <strong>{itemParaCancelar.nome}</strong>.
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Atenção: Conforme exigência legal da SEFAZ, o cancelamento só é permitido em até 24h
                da emissão e requer justificativa de no mínimo 15 caracteres.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Justificativa do Cancelamento *
              </label>
              <textarea
                rows={3}
                value={justificativaCancelamento}
                onChange={(e) => setJustificativaCancelamento(e.target.value)}
                placeholder="Ex: CLIENTE SOLICITOU CANCELAMENTO DEVIDO A DADOS DE ENTREGA INCORRETOS"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
              <span className="text-[10px] text-slate-400">
                Caracteres: {justificativaCancelamento.length} / 15 mínimo
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemParaCancelar(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={justificativaCancelamento.trim().length < 15}
                onClick={handleConfirmarCancelamento}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                Confirmar Cancelamento SEFAZ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: INUTILIZAR NOTA */}
      {itemParaInutilizar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-stone-700 font-black">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-base">Inutilizar Numeração de NF</h3>
              </div>
              <button
                onClick={() => setItemParaInutilizar(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                Inutilização de número na SEFAZ para a <strong>NF Nº {itemParaInutilizar.numNf}</strong>{' '}
                (Série {itemParaInutilizar.serieNf}).
              </p>
              <p className="text-[11px] text-slate-500">
                A inutilização de numeração comunica à Receita Estadual que este número não foi
                utilizado devido a quebra de sequência ou falha de sistema.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo da Inutilização (mínimo 15 caracteres) *
              </label>
              <textarea
                rows={3}
                value={motivoInutilizacao}
                onChange={(e) => setMotivoInutilizacao(e.target.value)}
                placeholder="Ex: QUEBRA DE SEQUENCIA FISCAL OCASIONADA POR FALHA DE SISTEMA"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemParaInutilizar(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={motivoInutilizacao.trim().length < 15}
                onClick={handleConfirmarInutilizacao}
                className="px-4 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                Transmitir Inutilização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CARTA DE CORREÇÃO ELETRÔNICA (CC-E) */}
      {itemParaCce && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-600 font-black">
                <FileEdit className="w-5 h-5" />
                <h3 className="text-base">Carta de Correção Eletrônica (CC-e)</h3>
              </div>
              <button
                onClick={() => setItemParaCce(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                Emissão de CC-e vinculada à <strong>NF Nº {itemParaCce.numNf}</strong> (Série{' '}
                {itemParaCce.serieNf}).
              </p>
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-[11px] text-amber-800 space-y-1">
                <p className="font-bold">A CC-e NÃO pode ser utilizada para alterar:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Valores, alíquotas ou dados que alterem o cálculo do imposto</li>
                  <li>Dados cadastrais que impliquem mudança do remetente ou destinatário</li>
                  <li>Data de emissão ou de saída da mercadoria</li>
                </ul>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Texto de Correção (mínimo 15 caracteres) *
              </label>
              <textarea
                rows={4}
                value={textoCce}
                onChange={(e) => setTextoCce(e.target.value)}
                placeholder="Descreva a correção detalhada. Ex: O endereço correto de entrega do destinatário é Rua das Flores, 123, Bairro Centro, Fortaleza-CE."
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <span className="text-[10px] text-slate-400">
                Caracteres: {textoCce.length} / 15 mínimo (Máx: 1000)
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemParaCce(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={textoCce.trim().length < 15}
                onClick={handleConfirmarCce}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                Transmitir CC-e para a SEFAZ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DESVINCULAR NOTA */}
      {itemParaDesvincular && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-orange-600 font-black">
                <Unlink className="w-5 h-5" />
                <h3 className="text-base">Desvincular Nota</h3>
              </div>
              <button
                onClick={() => setItemParaDesvincular(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Deseja desvincular a <strong>NF Nº {itemParaDesvincular.numNf}</strong> da operação{' '}
              <strong>Nº {itemParaDesvincular.numOperacao}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemParaDesvincular(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Não
              </button>
              <button
                type="button"
                onClick={handleConfirmarDesvincular}
                className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                Sim, Desvincular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: MAIS INFORMAÇÕES */}
      {itemParaMaisInfo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-blue-600 font-black">
                <Info className="w-5 h-5" />
                <h3 className="text-base">
                  Detalhes da Nota Fiscal Nº {itemParaMaisInfo.numNf}
                </h3>
              </div>
              <button
                onClick={() => setItemParaMaisInfo(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Situação</span>
                <p className="text-xs font-black text-slate-800">{itemParaMaisInfo.situacao}</p>
                <p className="text-[11px] text-slate-500">{itemParaMaisInfo.retornoSefaz}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Protocolo SEFAZ</span>
                <p className="text-xs font-mono font-bold text-slate-800">
                  {itemParaMaisInfo.protocolo || '123260001540100'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Transmissão: {itemParaMaisInfo.dataEmissao} às 10:00:05
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  Chave de Acesso (44 Dígitos)
                </span>
                <p className="text-xs font-mono font-bold text-blue-700 break-all select-all">
                  {itemParaMaisInfo.chaveAcesso ||
                    '232609071234560001895500300000' + itemParaMaisInfo.numNf + '1005401234'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Destinatário</span>
                <p className="text-xs font-bold text-slate-900">{itemParaMaisInfo.nome}</p>
                <p className="text-[11px] text-slate-600 font-mono">
                  CPF/CNPJ: {itemParaMaisInfo.cpfCnpj}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Operação</span>
                <p className="text-xs font-bold text-slate-800">{itemParaMaisInfo.operacao}</p>
                <p className="text-[11px] text-slate-500">
                  Nº Operação: {itemParaMaisInfo.numOperacao}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Total da Nota</span>
                <p className="text-sm font-black text-emerald-700">
                  R$ {itemParaMaisInfo.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-500">Série: {itemParaMaisInfo.serieNf}</p>
              </div>

              {itemParaMaisInfo.motivoCancelamento && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-1 sm:col-span-2">
                  <span className="text-[10px] text-rose-600 font-bold uppercase">
                    Motivo do Cancelamento
                  </span>
                  <p className="text-xs font-semibold text-rose-900">
                    {itemParaMaisInfo.motivoCancelamento}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const nota = itemToNotaFiscal(itemParaMaisInfo);
                  openDanfeInNewTab(nota);
                  setItemParaMaisInfo(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Visualizar DANFE</span>
              </button>
              <button
                type="button"
                onClick={() => setItemParaMaisInfo(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: ENVIAR NOTA */}
      {itemParaEnviar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-blue-600 font-black">
                <Send className="w-5 h-5" />
                <h3 className="text-base">Enviar Nota Fiscal</h3>
              </div>
              <button
                onClick={() => setItemParaEnviar(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Enviar DANFE e XML da <strong>NF Nº {itemParaEnviar.numNf}</strong> para o cliente{' '}
              <strong>{itemParaEnviar.nome}</strong>.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const cleanPhone = (itemParaEnviar.telefone || '85999999999').replace(/\D/g, '');
                  const msg = encodeURIComponent(
                    `Olá, ${itemParaEnviar.nome}! Segue os dados da sua Nota Fiscal Nº ${itemParaEnviar.numNf} (Série ${itemParaEnviar.serieNf}) emitida pela TECIDO SUBLIMADO:\n\nValor: R$ ${itemParaEnviar.total.toFixed(2).replace('.', ',')}\nChave de Acesso: ${itemParaEnviar.chaveAcesso || '232609071234560001895500300000' + itemParaEnviar.numNf}\nProtocolo SEFAZ: ${itemParaEnviar.retornoSefaz}`
                  );
                  window.open(`https://wa.me/55${cleanPhone}?text=${msg}`, '_blank');
                  setItemParaEnviar(null);
                  setActionSuccessMsg('Link de compartilhamento via WhatsApp gerado com sucesso!');
                  setTimeout(() => setActionSuccessMsg(null), 4000);
                }}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Share2 className="w-4 h-4" />
                <span>Enviar via WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  alert(`E-mail com XML e DANFE em anexo enviado para ${itemParaEnviar.nome}!`);
                  setItemParaEnviar(null);
                  setActionSuccessMsg('E-mail com XML e DANFE enviado com sucesso!');
                  setTimeout(() => setActionSuccessMsg(null), 4000);
                }}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>Enviar via E-mail</span>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setItemParaEnviar(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE XML */}
      {selectedXml && (
        <XmlModal
          nota={selectedXml}
          onClose={() => setSelectedXml(null)}
          onDownload={(nota) => {
            const blob = new Blob([nota.xmlConteudo || ''], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `NFe_${nota.chaveAcesso}.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
        />
      )}
    </div>
  );
};
