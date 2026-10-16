import { BaseEntity, EntityStatus } from './index';

export type ProductionStage =
  | 'Sistema'
  | 'Designer'
  | 'DESIGNER'
  | 'Impressão'
  | 'IMPRESSÃO'
  | 'Calandra'
  | 'CALANDRA'
  | 'Costura'
  | 'COSTURA'
  | 'EXCURSÃO'
  | 'Excursão'
  | 'CORREIOS'
  | 'Correios'
  | 'SHOPEE'
  | 'Shopee'
  | 'RETIRADA(Recepção)'
  | 'Retirada (Recepção)'
  | 'Conferência'
  | 'Expedição'
  | 'Entrega'
  | 'Concluído';

export type TipoExpedicao = 'NORMAL' | 'EXPRESSO EXCURSÃO' | 'EXPRESSO DO DIA' | 'SHOPEE';

export interface OsItem {
  id: string;
  codigo: string;
  descricao: string;
  categoria?: string;
  unidade: string; // UN, M2, KG, PC, M, CX, etc.
  quantidade: number;
  valorUnitario: number;
  precoMedio: number;
  desconto: number;
  total: number;
  // Medidas Personalizadas (Cálculo de Mesa)
  comMedidas?: boolean;
  medidaFrente?: number;
  medidaLateral?: number;
  medidaAltura?: number;
  medidaCaimento?: number;
  medidaBabado?: number;
  medidaCalculo?: number;
  comSobreposicao?: boolean;
  valorBabado?: number;
  valorTampo?: number;
  valorSobreposicao?: number;
  precoExpresso?: boolean;
  qtdBabado?: number;
  valorFaixa?: number;
  valorFaixaDeBabado?: number;
  valorBase?: number;
  valorBaseCilindro?: number;
  tampCilindro?: number;
  valorTampoCilindro?: number;
  calculoCubo?: number;
  valorCubo?: number;
  medidaTampo?: number;
  valorFaixaBabado?: number;
  medidasProducao?: any;
  formulaMedidaId?: string;
}

export interface OsAttachment {
  id: string;
  type?: 'MODELO' | 'FINAL' | 'ARTE' | 'PARA_IMPRESSAO' | string;
  isParaImpressao?: boolean;
  fileName: string;
  fileUrl: string; // Base64 or URL
  fileSize?: string;
  uploadedAt: string;
  x?: number; // position X in % or px
  y?: number; // position Y in % or px
  width?: number; // width in % or px
  height?: number; // height in % or px
  scale?: number; // scale multiplier e.g. 1
  rotation?: number; // rotation angle (0, 90, 180, 270)
  label?: string; // e.g. "Arte #1", "Arte", "Arte para Impressão"
  orientation?: 'PORTRAIT' | 'LANDSCAPE'; // Sheet orientation (Portrait/Landscape)
  page?: number;
}

export interface ProductHistoryEntry {
  id: string;
  dataHora: string;
  operador: string;
  acao: string;
  detalhes: string;
}

export interface ProductPdfAttachment {
  id: string;
  nome: string;
  url: string;
  tamanho?: string;
  dataEnvio: string;
}

export interface ProductCatalog extends BaseEntity {
  codigo: string;
  codigoBarras?: string;
  sku?: string;
  referencia?: string;
  descricao: string;
  precoCusto?: number;
  valorUnitario: number; // Preço de Venda
  precoVenda?: number;
  precoExpresso?: number;
  precoMedio: number;
  categoria?: string;
  marca?: string;
  unidade: string;
  ncm?: string;
  cfop?: string;
  origemMercadoria?: string;
  pesoUnitarioKg?: number;
  dimensoes?: string; // Ex: "160x100x1 cm"

  // Controle de Estoque
  estoqueAtual?: number;
  estoqueMinimo?: number;
  estoqueMaximo?: number;
  lote?: string;
  dataValidade?: string; // DD/MM/YYYY
  fornecedorPrincipal?: string;
  custoUltimaCompra?: number;

  // Arquivos
  fotoUrl?: string;
  anexosPdf?: ProductPdfAttachment[];

  // Observações
  observacoes?: string;

  // Origem e Destinação de Venda
  origemCadastro?: 'ESTOQUE' | 'OS_PDV' | 'PRODUTOS_VENDA';
  paraVenda?: boolean;
  apenasEstoqueInterno?: boolean;
  isInternal?: boolean;
  comMedidas?: boolean;
  formulaMedidaId?: string;
  formulaMedidaTitulo?: string;
  importado?: boolean;

  // Situação
  situacao?: 'Ativo' | 'Inativo';

  // Operador responsável
  operador?: string;

  // Histórico de Alterações
  historicoAlteracoes?: ProductHistoryEntry[];
}

export interface OsHistoryEntry {
  id: string;
  dataHora: string;
  usuario: string;
  perfil?: string;
  acao: string;
  detalhes?: string;
}

export type OsStatus =
  | 'Aberta'
  | 'Em Produção'
  | 'Pendente Pagamento'
  | 'Pago'
  | 'Concluído'
  | 'Cancelado';

export interface OrdemServico extends Omit<BaseEntity, 'status'> {
  codigo: string; // e.g., OS-2026-0001
  dataVenda: string; // DD/MM/YYYY
  operador: string;
  clienteId?: string;
  clienteNome: string;
  clienteCpfCnpj: string;
  clienteTelefone: string;
  clienteEmail: string;
  clienteEndereco?: string;
  prazoEntrega: string; // DD/MM/YYYY
  
  // Fluxo de Aprovação do Cliente
  aguardandoAprovacaoCliente?: boolean;
  aguardandoAprovacaoDesde?: string;
  aguardandoAceitacaoDesde?: string; // Para o cronômetro de Aceitação

  tipoDocumento?: 'OS' | 'ORCAMENTO' | 'OSS';
  isOrcamento?: boolean;
  fluxoProducao: ProductionStage[];
  tipoExpedicao?: TipoExpedicao;
  estagioAtual: ProductionStage;
  setorAceitoPor?: {
    estagio: ProductionStage;
    descricaoEtapa?: string;
    funcionario: string;
    aceitoEm: string;
    aceitoEmISO?: string;
    tempoAceitacao?: string;
    status?: 'Pendente' | 'Em Andamento' | 'Concluído' | 'Em Aprovação' | 'Reprovado / Ajuste';
    concluidoEm?: string;
    concluidoEmISO?: string;
    tempoAndamento?: string;
    tempoAprovacao?: string;
    observacao?: string;
  }[];

  itens: OsItem[];
  anexos: OsAttachment[];
  observacoes?: string;

  subtotal: number;
  desconto: number;
  valorFinal: number;
  valorTotal?: number;

  vendedorNome?: string;
  vendedor?: string;
  filialId?: string;
  filialNome?: string;
  branchId?: string;
  branch?: string;
  criadoPor?: string;
  usuario?: string;

  paymentStatus: 'pendente' | 'pago';
  pdvTransactionId?: string;
  formaPagamento?: string;
  valorEntrada?: number;
  formaPagamentoEntrada?: string;
  valorRestante?: number;
  formaPagamentoRestante?: string;
  comprovanteUrl?: string;
  parcelasCartao?: number;
  status: EntityStatus | OsStatus;
  historicoEdicoes?: OsHistoryEntry[];

  // Shopee Marketplace Integration
  isShopee?: boolean;
  shopeePedidoId?: string;
  idPedido?: string;

  // Conferência & Auditoria de Saída
  conferido?: boolean;
  dataConferencia?: string;
  conferenteNome?: string;
  observacoesConferencia?: string;

  // Controle de Expedição
  expedido?: boolean;
  dataExpedicao?: string;
  expedidoPor?: string;
  destinoExpedicao?: string;
  observacoesExpedicao?: string;

  // Entrega & Devolução
  entregue?: boolean;
  dataEntrega?: string;
  entreguePor?: string;
  entreguePorNome?: string;
  recebidoPorNome?: string;
  recebidoPorTelefone?: string;
  recebidoPorCpf?: string;
  entregaObservacoes?: string;
  observacoesEntrega?: string;

  devolvido?: boolean;
  dataDevolucao?: string;
  devolvidoPor?: string;
  motivoDevolucao?: string;
  detalhesDevolucao?: string;
  situacaoEntrega?: 'ENTREGUE' | 'DEVOLVIDO' | 'NAO_ENTREGUE' | 'EM_TRANSITO';
  retornouParaProducao?: boolean;

  situacao?: string;
}

export type PaymentMethodType =
  | 'Dinheiro'
  | 'PIX'
  | 'Com Entrada'
  | 'Cartão de Débito'
  | 'Cartão de Crédito';

export interface PdvTransaction extends Omit<BaseEntity, 'status'> {
  codigoVenda: string; // e.g. PDV-2026-0001
  osId?: string;
  osCodigo?: string;
  data: string; // DD/MM/YYYY
  hora: string; // HH:mm:ss
  operador: string;
  operadorNome?: string;
  vendedorNome?: string;
  vendedor?: string;
  filialId?: string;
  filialNome?: string;
  branchId?: string;
  branch?: string;
  criadoPor?: string;
  usuario?: string;
  clienteNome: string;
  clienteCpfCnpj: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  clienteEndereco?: string;
  itens: OsItem[];
  anexos?: OsAttachment[];
  observacoes?: string;
  
  formaPagamento: PaymentMethodType;
  valorEntrada?: number;
  formaPagamentoEntrada?: string;
  valorRestante?: number;
  formaPagamentoRestante?: string;
  comprovanteUrl?: string;
  parcelasCartao?: number;
  
  subtotal: number;
  desconto: number;
  valorTotal: number;
  valorFinal?: number;
  status: 'pago' | 'pendente';
}
