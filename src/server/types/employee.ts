import { BaseEntity } from './index';
import { Address } from './client';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'AFASTADO' | 'BLOCKED' | 'SUSPENDED' | 'ATIVO' | 'INATIVO' | 'FERIAS';

export interface EmployeeAttachment {
  id: string;
  nomeArquivo: string;
  tipoArquivo: string; // e.g. 'pdf', 'png', 'jpg', 'doc'
  categoriaDoc: 'Contrato' | 'Documento Pessoal' | 'Exame Médico' | 'Certificado' | 'Holerite' | 'Outros';
  tamanhoFormatado: string;
  dataUpload: string;
  dataUrl: string; // base64 or URL
  observacao?: string;
}

export interface Employee extends Omit<BaseEntity, 'status'> {
  codigo: string; // e.g. TSF00001, CEO01, GRT001, SUP001
  nome: string;
  sobrenome: string;
  cpf: string;
  rg?: string;
  fotoUrl?: string;
  dataNascimento?: string;
  dataAdmissao?: string;

  cargo: string;
  setor: string;

  // Filial / Unit
  filialId?: string;
  filialNome?: string;
  localAtuacao?: 'Fortaleza' | 'Piauí' | 'Shopee' | string; // Local de Atuação: Fortaleza, Piauí ou Shopee
  salarioBase: number; // Valor salarial
  tipoSalario?: string; // Mensalista, Hora, Diarista
  comissaoPorcentagem: number; // Porcentagem de comissão %
  tipoComissao?: string; // Sobre Vendas, Sobre Produção, etc.
  metaIndividual?: number; // Meta individual em R$ para Vendedor(a) / Recepção
  chavePix?: string;
  bancoInfo?: string;
  beneficios?: string;
  observacoes?: string;

  // Address and Contact
  endereco: Address;
  telefone: string;
  email: string;

  // Status
  status: EmployeeStatus;

  // Login credentials for ERP & Chat
  temLogin?: boolean;
  loginUsuario?: string;
  loginSenha?: string;
  isDeveloperInvisible?: boolean;
  role?: string;

  // Digital Binder Attachments (Fichário)
  ficharioAnexos: EmployeeAttachment[];
}

export interface CreateEmployeeDTO {
  nome: string;
  sobrenome: string;
  cpf: string;
  rg?: string;
  fotoUrl?: string;
  dataNascimento?: string;
  dataAdmissao?: string;
  cargo: string;
  setor: string;
  filialId?: string;
  filialNome?: string;
  salarioBase: number;
  tipoSalario?: string;
  comissaoPorcentagem: number;
  tipoComissao?: string;
  metaIndividual?: number;
  chavePix?: string;
  bancoInfo?: string;
  beneficios?: string;
  observacoes?: string;
  endereco: Address;
  telefone: string;
  email: string;
  status?: EmployeeStatus;
  temLogin?: boolean;
  loginUsuario?: string;
  loginSenha?: string;
  developerPassword?: string;
  ficharioAnexos?: EmployeeAttachment[];
}
