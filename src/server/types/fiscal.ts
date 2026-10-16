export type TipoDocumentoFiscal = 'NFE' | 'NFCE';
export type StatusNotaFiscal = 'AUTORIZADA' | 'PROCESSANDO' | 'PENDENTE' | 'CANCELADA' | 'REJEITADA' | 'ERRO';
export type OrigemNotaFiscal = 'OS' | 'PDV' | 'AVULSA';

export interface ItemNotaFiscal {
  id: string;
  codigo?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  unidade: string; // UN, M, M2, PC, etc.
  ncm: string; // e.g. "6109.10.00"
  cfop: string; // e.g. "5102"
  origemMercadoria?: number; // 0 = Nacional
  csosn?: string; // 102, 400, etc. (Simples Nacional)
  cst?: string;
  aliquotaIcms?: number;
  valorIcms?: number;
}

export interface NotaFiscal {
  id: string;
  tipo: TipoDocumentoFiscal; // 'NFE' ou 'NFCE'
  origem: OrigemNotaFiscal; // 'OS', 'PDV', 'AVULSA'
  origemId?: string; // ID da OS ou ID da transação PDV
  origemCodigo?: string; // e.g. "OS00000014" ou "PDV-2026-003"
  filialId?: string; // ID da Filial emissora
  filialNome?: string; // Nome da Filial emissora
  numero: number; // Sequencial da nota (ex: 1, 2, 3...)
  serie: string; // e.g. "1"
  chaveAcesso: string; // 44 dígitos numéricos da SEFAZ
  protocolo?: string; // e.g. "123456789012345"
  dataEmissao: string; // ISO string
  dataAutorizacao?: string; // ISO string
  status: StatusNotaFiscal;
  statusSefaz?: string; // e.g. "100 - Autorizado o uso da NF-e"
  motivoCancelamento?: string;
  dataCancelamento?: string;
  protocoloCancelamento?: string;

  // Destinatário (Cliente)
  clienteId?: string;
  clienteTipo?: 'PF' | 'PJ';
  clienteNome: string;
  clienteNomeFantasia?: string;
  clienteDocumento?: string; // CPF ou CNPJ
  clienteInscricaoEstadual?: string;
  clienteEmail?: string;
  clienteTelefone?: string;
  clienteEndereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };

  // Emitente (Filial)
  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    inscricaoEstadual: string;
    regimeTributario: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';
    endereco?: string;
    bairro?: string;
    cep?: string;
    telefone?: string;
    cidade?: string;
    uf?: string;
  };

  // Valores
  naturezaOperacao: string; // "Venda de mercadoria", "Prestação de serviço têxtil", etc.
  valorProdutos: number;
  valorDesconto?: number;
  valorFrete?: number;
  valorOutrasDespesas?: number;
  valorTotal: number;

  // Pagamento
  formaPagamento: 'PIX' | 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BOLETO' | 'OUTROS';

  // Transporte
  transportadora?: {
    razaoSocial?: string;
    cnpj?: string;
    endereco?: string;
    cidade?: string;
    uf?: string;
    inscricaoEstadual?: string;
    fretePorConta?: string;
  };

  // Itens
  itens: ItemNotaFiscal[];

  // Links e Arquivos
  danfeUrl?: string; // Link para PDF do DANFE (Focus NFe ou gerador local)
  xmlUrl?: string; // Link para download do XML assinado
  xmlConteudo?: string; // XML estruturado da SEFAZ
  qrCodeUrl?: string; // Link ou Payload do QR Code da NFC-e

  // Ambiente e Provedor
  ambiente?: 'HOMOLOGACAO' | 'PRODUCAO';
  provedorFiscal?: 'SPEDY' | 'FOCUS_NFE' | 'INTERNO';
  spedyInvoiceId?: string;
  spedyStatus?: string;
  spedyMessage?: string;
  focusNfeRef?: string; // Referência única enviada para o Focus NFe
  focusNfeStatus?: string;

  createdAt: string;
  updatedAt: string;
  operadorNome?: string;
}

export interface ConfiguracaoFiscal {
  id: string;
  provedorFiscal?: 'SPEDY' | 'FOCUS_NFE' | 'INTERNO';
  tokenSpedy?: string; // Chave de API da Spedy
  spedyCompanyId?: string; // ID da empresa no Spedy
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  regimeTributario: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';
  naturezaOperacaoPadrao: string;
  cfopPadraoInterno: string; // e.g. "5102"
  cfopPadraoInterestadual: string; // e.g. "6102"
  ncmPadrao: string; // e.g. "6109.10.00"
  csosnPadrao: string; // e.g. "102"
  serieNfe: string; // e.g. "6"
  proximoNumeroNfe: number; // e.g. 1
  serieNfeOs?: string; // e.g. "7" para Produção / Ordens de Serviço
  proximoNumeroNfeOs?: number; // e.g. 1
  serieNfce: string; // e.g. "6" para NFC-e (Balcão/PDV)
  proximoNumeroNfce: number; // e.g. 1
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  tokenFocusNfe?: string; // Token da API Focus NFe
  cIdToken?: string; // CSC da NFC-e
  cscToken?: string; // CSC da NFC-e
  mensagemFiscalPadrao?: string;
  updatedAt: string;
}

export interface EmissaoFiscalDTO {
  tipo: TipoDocumentoFiscal; // 'NFE' | 'NFCE'
  origem: OrigemNotaFiscal;
  serie?: string; // e.g. "6" para VND/Balcão ou "7" para OS/Demanda
  origemId?: string;
  origemCodigo?: string;
  filialId?: string;
  emitente?: {
    cnpj?: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    inscricaoEstadual?: string;
    regimeTributario?: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';
    endereco?: string;
    telefone?: string;
    cidade?: string;
    uf?: string;
  };
  naturezaOperacao?: string;
  clienteTipo?: 'PF' | 'PJ';
  clienteNome: string;
  clienteNomeFantasia?: string;
  clienteDocumento?: string; // CPF ou CNPJ
  clienteInscricaoEstadual?: string;
  clienteEmail?: string;
  clienteTelefone?: string;
  clienteEndereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
  formaPagamento: 'PIX' | 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BOLETO' | 'OUTROS';
  valorDesconto?: number;
  valorFrete?: number;
  itens: Array<{
    codigo?: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    unidade?: string;
    ncm?: string;
    cfop?: string;
    csosn?: string;
  }>;
  operadorNome?: string;
}
