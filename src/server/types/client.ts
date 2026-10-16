import { BaseEntity } from './index';

export type ClientType = 'PF' | 'PJ';

export interface Address {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface Client extends BaseEntity {
  codigo: string; // Auto generated e.g., C0000001
  type: ClientType;
  
  // Person Physical (PF) specific fields
  nome?: string;
  sobrenome?: string;
  cpf?: string;
  fotoUrl?: string;
  dataNascimento?: string; // e.g. YYYY-MM-DD or DD/MM/YYYY

  // Person Juridical (PJ) specific fields
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  dataFundacao?: string;

  // Shared fields
  endereco: Address;
  telefone: string;
  celular?: string;
  email: string;
  operador?: string;
  vendedorNome?: string;
}

export interface CreateClientDTO {
  type: ClientType;
  nome?: string;
  sobrenome?: string;
  cpf?: string;
  fotoUrl?: string;
  dataNascimento?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  dataFundacao?: string;
  endereco: Address;
  telefone: string;
  celular?: string;
  email: string;
  status?: 'ACTIVE' | 'INACTIVE';
  operador?: string;
  vendedorNome?: string;
}
