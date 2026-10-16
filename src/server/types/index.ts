/**
 * ERP SubliGestão - Domain Types & Interfaces
 * Standard Enterprise Schema Fields: ID, CreatedAt, UpdatedAt, DeletedAt, CreatedBy, UpdatedBy, DeletedBy, Status, Version
 */

export type EntityStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'SUSPENDED';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  createdBy: string;
  updatedBy: string;
  deletedBy?: string | null;
  status: EntityStatus;
  version: number;
}

export type SectorType =
  | 'Administrativo'
  | 'Comercial'
  | 'Atendimento'
  | 'Produção'
  | 'Impressão'
  | 'Calandra'
  | 'Expedição'
  | 'Diretoria'
  | 'Serviços Gerais'
  | 'LOGISTICA'
  | 'Operador';

export type RoleTitle =
  | 'Developer'
  | 'CEO'
  | 'ADM MASTER'
  | 'ADM SISTEMA'
  | 'ADMINISTRADOR'
  | 'Gerente Geral'
  | 'Administrativo'
  | 'Administração'
  | 'Supervisor'
  | 'Monitor'
  | 'Vendedor(a)'
  | 'Designer'
  | 'Impressão'
  | 'Calandra'
  | 'Costura'
  | 'Estoque'
  | 'Conferência'
  | 'Expedição'
  | 'RH'
  | 'Serviços Gerais'
  | 'Recepção'
  | 'LOGISTICA'
  | 'Op. Máquina de corte'
  | 'Operador';

export interface Sector extends BaseEntity {
  name: SectorType;
  description: string;
}

export interface Role extends BaseEntity {
  name: RoleTitle;
  hierarchyLevel: number; // 0 = Developer, 1 = CEO, 2 = Gerente Geral, etc.
  sectorId: string;
  description: string;
}

export interface Branch extends BaseEntity {
  name: string;
  tradeName: string;
  cnpj: string;
  stateRegistration?: string;
  address: {
    cep: string;
    logradouro: string;
    number: string;
    complement?: string;
    bairro: string;
    city: string;
    state: string;
  };
  phone: string;
  email: string;
}

export interface Permission extends BaseEntity {
  roleId: string;
  module: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXECUTE' | 'APPROVE';
  isGranted: boolean;
}

export interface User extends BaseEntity {
  username: string; // e.g. @Marcelo-dev
  passwordHash: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  supportAvatarUrl?: string;
  isSupportPhoto?: boolean;
  roleId: string;
  sectorId: string;
  branchId: string;
  isDeveloperInvisible: boolean; // Must be true ONLY for @Marcelo-dev
  failedAttempts: number;
  lockUntil?: string | null;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  lastLoginDevice?: string | null;
  mfaSecret?: string | null;
  mfaEnabled: boolean;
  dataNascimento?: string;
  temLogin?: boolean;
  employeeId?: string;
}

export interface AuthLog extends BaseEntity {
  userId?: string | null;
  username: string;
  event:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'LOGOUT'
    | 'TOKEN_REFRESH'
    | 'BRUTE_FORCE_LOCK'
    | 'BACKUP_CREATED'
    | 'SYSTEM_RESET'
    | 'UNAUTHORIZED_ACCESS';
  ip: string;
  userAgent: string;
  details?: string;
}

export interface RefreshToken extends BaseEntity {
  userId: string;
  token: string;
  expiresAt: string;
  isRevoked: boolean;
  ip: string;
  userAgent: string;
}

export interface AuditTrail extends BaseEntity {
  userId: string;
  username: string;
  module: string;
  action: string;
  entityName: string;
  entityId: string;
  previousValue?: string | null;
  newValue?: string | null;
  ip: string;
  userAgent: string;
}

export interface UserJWTPayload {
  sub: string; // userId
  username: string;
  role: RoleTitle;
  sector: SectorType;
  branchId: string;
  isDeveloper: boolean;
  type: 'access' | 'refresh';
}
