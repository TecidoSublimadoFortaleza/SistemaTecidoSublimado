/**
 * ERP SubliGestão - Internal Messaging Types
 */

export interface ChatAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  fileData: string; // Base64 data URL
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatar?: string;
  targetType: 'user' | 'group' | 'sector';
  targetId: string; // userId for 1-on-1, groupId for group, sectorName for open sector
  content: string;
  attachments?: ChatAttachment[];
  deletedByUsers: string[]; // User IDs who cleared this from their view
  readByUsers: string[]; // User IDs who read this message
  createdAt: string;
}

export interface MessageGroup {
  id: string;
  name: string;
  description: string;
  sector?: string;
  role?: string; // Cargo específico do grupo (opcional)
  targetRoles?: string[]; // Cargos vinculados ou permitidos no grupo
  adminUserId: string;
  adminName: string;
  memberUserIds: string[];
  isClosed: boolean;
  createdAt: string;
}

export type UserPresenceStatus = 'online' | 'away' | 'offline';

export interface ChatContact {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  role: string;
  sector: string;
  avatarUrl?: string;
  isOnline: boolean;
  presenceStatus?: UserPresenceStatus;
  lastSeen?: string;
  awaySince?: string;
  unreadCount?: number;
}

export interface ChatAuditLog {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  details: string;
  target: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  userSector: string;
  userAvatar?: string;
  userUsername?: string;
  status: 'OPEN' | 'ANSWERED' | 'RESOLVED';
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
  lastSenderId?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface CreateMessageDTO {
  targetType: 'user' | 'group' | 'sector';
  targetId: string;
  content: string;
  attachments?: ChatAttachment[];
}

export interface CreateGroupDTO {
  name: string;
  description?: string;
  sector?: string;
  role?: string;
  targetRoles?: string[];
  memberUserIds: string[];
}
