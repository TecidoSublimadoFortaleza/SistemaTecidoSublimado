import { PersistentMap } from '../db/PersistentMap';
import { PersistentArray } from '../db/PersistentArray';
import { pgPool } from '../db/postgres';
import { Database } from '../db/database';
import { User } from '../types';
import {
  ChatMessage,
  MessageGroup,
  ChatContact,
  ChatAuditLog,
  CreateMessageDTO,
  CreateGroupDTO,
  UserPresenceStatus,
  SupportTicket,
} from '../../types/chat';

export interface PresenceRecord {
  userId: string;
  username: string;
  lastSeen: number;
  status: UserPresenceStatus;
  awaySince?: number;
}

export class ChatRepository {
  public static defaultSupportAvatarUrl: string =
    '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png';
  public static supportAvatarUrl: string =
    '/images/88171a07-82fd-4a8a-b3d7-4a7a4ce34038.png';

  public static getSupportAvatarUrl(db?: Database): string {
    if (this.supportAvatarUrl && this.supportAvatarUrl !== '/images/logo-suporte.svg') {
      return this.supportAvatarUrl;
    }
    try {
      const database = db || Database.getInstance();
      for (const u of database.users.values()) {
        if ((u.isDeveloperInvisible || u.username?.toLowerCase().includes('marcelo')) && u.supportAvatarUrl) {
          this.supportAvatarUrl = u.supportAvatarUrl;
          return u.supportAvatarUrl;
        }
      }
    } catch {
      // fallback
    }
    return this.supportAvatarUrl || this.defaultSupportAvatarUrl;
  }

  public static setSupportAvatarUrl(url: string) {
    if (!url) return;
    this.supportAvatarUrl = url;
  }

  public static async initialize() {
    try {
      try { await pgPool.query('SELECT 1'); } catch (e) { return; }

      // Carrega avatar customizado do suporte se já salvo nas configurações
      try {
        const supportStore = await pgPool.query("SELECT data FROM _system_store WHERE collection = 'system_settings' AND id = 'support_avatar'");
        if (supportStore.rows.length > 0 && supportStore.rows[0].data?.url) {
          this.supportAvatarUrl = supportStore.rows[0].data.url;
        }
      } catch (err) {
        // ignore
      }

      const res = await pgPool.query("SELECT collection, id, data FROM _system_store WHERE collection IN ('chat_messages', 'chat_groups', 'chat_auditLogs', 'chat_support_tickets')");
      for (const row of res.rows) {
        if (row.collection === 'chat_messages') Map.prototype.set.call(this.messagesMap, row.id, row.data);
        if (row.collection === 'chat_groups') Map.prototype.set.call(this.groupsMap, row.id, row.data);
        if (row.collection === 'chat_auditLogs') Array.prototype.push.call(this.auditLogsList, row.data);
        if (row.collection === 'chat_support_tickets') Map.prototype.set.call(this.supportTicketsMap, row.id, row.data);
      }

      // Load from relational chat_messages table if present
      try {
        const msgRows = await pgPool.query('SELECT * FROM chat_messages ORDER BY created_at ASC');
        for (const row of msgRows.rows) {
          if (!this.messagesMap.has(row.id)) {
            const mappedMsg: ChatMessage = {
              id: row.id,
              senderId: row.sender_id || '',
              senderName: row.sender_name || 'Colaborador',
              senderRole: row.sender_role || 'Colaborador',
              senderAvatar: row.sender_avatar || '',
              targetType: (row.target_type as any) || (row.channel === 'group' ? 'group' : 'user'),
              targetId: row.target_id || row.receiver_id || row.channel || '',
              content: row.content || row.message || '',
              attachments: typeof row.attachments === 'string' ? JSON.parse(row.attachments) : (row.attachments || (row.attachment_url ? [{ id: 'att-1', name: 'Anexo', url: row.attachment_url, type: 'image' }] : [])),
              deletedByUsers: typeof row.deleted_by_users === 'string' ? JSON.parse(row.deleted_by_users) : (row.deleted_by_users || []),
              readByUsers: typeof row.read_by_users === 'string' ? JSON.parse(row.read_by_users) : (row.read_by_users || []),
              createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
              ...(row.detalhes || {})
            };
            Map.prototype.set.call(this.messagesMap, row.id, mappedMsg);
          }
        }
      } catch (msgRelErr) {
        // Table may not exist yet or empty
      }
    } catch(e) { console.error('Chat init error', e); }
  }

  private db = Database.getInstance();
  public static messagesMap = new PersistentMap<string, ChatMessage>('chat_messages', true);
  public static groupsMap = new PersistentMap<string, MessageGroup>('chat_groups');
  public static auditLogsList = new PersistentArray<ChatAuditLog>('chat_auditLogs');
  public static supportTicketsMap = new PersistentMap<string, { status: 'OPEN' | 'ANSWERED' | 'RESOLVED'; resolvedAt?: string; resolvedBy?: string }>('chat_support_tickets');
  public static presenceMap = new Map<string, PresenceRecord>();
  private static isInitialized = false;

  public static updatePresence(
    userId: string,
    username: string,
    status: UserPresenceStatus = 'online',
    clientAwaySince?: string | number | null
  ): void {
    const now = Date.now();
    const cleanUsername = (username || '').toLowerCase().replace('@', '');
    const existing =
      (userId && ChatRepository.presenceMap.get(userId)) ||
      (cleanUsername && ChatRepository.presenceMap.get(`user:${cleanUsername}`));

    let awaySince: number | undefined;
    if (status === 'away') {
      if (clientAwaySince) {
        const parsed = typeof clientAwaySince === 'number' ? clientAwaySince : new Date(clientAwaySince).getTime();
        awaySince = isNaN(parsed) ? (existing?.awaySince || now) : parsed;
      } else if (existing?.status === 'away' && existing.awaySince) {
        awaySince = existing.awaySince;
      } else {
        awaySince = now;
      }
    } else {
      awaySince = undefined;
    }

    const record: PresenceRecord = {
      userId,
      username: cleanUsername,
      lastSeen: now,
      status,
      awaySince,
    };
    if (userId) {
      ChatRepository.presenceMap.set(userId, record);
    }
    if (cleanUsername) {
      ChatRepository.presenceMap.set(`user:${cleanUsername}`, record);
    }
  }

  public static getPresenceStatus(
    userId?: string,
    username?: string
  ): { isOnline: boolean; status: UserPresenceStatus; lastSeen?: string; awaySince?: string } {
    const now = Date.now();
    const OFFLINE_THRESHOLD_MS = 60 * 1000; // 60 segundos sem heartbeat = offline

    let record: PresenceRecord | undefined;
    if (userId && ChatRepository.presenceMap.has(userId)) {
      record = ChatRepository.presenceMap.get(userId);
    }
    if (!record && username) {
      const cleanUsername = username.toLowerCase().replace('@', '');
      record = ChatRepository.presenceMap.get(`user:${cleanUsername}`);
    }

    if (!record) {
      let fallbackDate: string | undefined;
      try {
        const db = Database.getInstance();
        if (userId) {
          const u = db.users.get(userId);
          if (u?.lastLoginAt) {
            fallbackDate = u.lastLoginAt;
          } else if (u?.createdAt) {
            fallbackDate = u.createdAt;
          } else if (userId.startsWith('USR-EMP-')) {
            const empId = userId.replace('USR-EMP-', '');
            const emp = db.employees.get(empId);
            if (emp?.createdAt) {
              fallbackDate = emp.createdAt;
            }
            // Look up corresponding user's actual last login or creation date
            for (const usr of db.users.values()) {
              if (usr.employeeId === empId) {
                if (usr.lastLoginAt) {
                  fallbackDate = usr.lastLoginAt;
                  break;
                } else if (usr.createdAt) {
                  fallbackDate = usr.createdAt;
                  break;
                }
              }
            }
          }
        }
        if (!fallbackDate && username) {
          const clean = username.toLowerCase().replace('@', '');
          for (const u of db.users.values()) {
            if (u.username.toLowerCase().replace('@', '') === clean) {
              if (u.lastLoginAt) {
                fallbackDate = u.lastLoginAt;
                break;
              } else if (u.createdAt) {
                fallbackDate = u.createdAt;
                break;
              }
            }
          }
          if (!fallbackDate) {
            for (const emp of db.employees.values()) {
              if ((emp.loginUsuario || '').toLowerCase().replace('@', '') === clean) {
                if (emp.createdAt) {
                  fallbackDate = emp.createdAt;
                  break;
                }
              }
            }
          }
        }
      } catch (err) {
        // Fallback silently if db query fails
      }

      // Se o perfil foi cadastrado recentemente (de ontem pra hoje), mantém sua data de criação como visto por último
      if (!fallbackDate) {
        fallbackDate = Database.nowISO();
      }

      return {
        isOnline: false,
        status: 'offline',
        lastSeen: fallbackDate,
      };
    }

    if (record.status === 'offline' || now - record.lastSeen > OFFLINE_THRESHOLD_MS) {
      return {
        isOnline: false,
        status: 'offline',
        lastSeen: new Date(record.lastSeen).toISOString(),
      };
    }

    if (record.status === 'away') {
      const awayDateIso = record.awaySince
        ? new Date(record.awaySince).toISOString()
        : new Date(record.lastSeen).toISOString();
      return {
        isOnline: true,
        status: 'away',
        lastSeen: new Date(record.lastSeen).toISOString(),
        awaySince: awayDateIso,
      };
    }

    return {
      isOnline: true,
      status: 'online',
      lastSeen: new Date(record.lastSeen).toISOString(),
    };
  }

  constructor() {
    this.ensureDefaultGroups();
  }

  private static getRoleHierarchyRank(roleName?: string): number {
    if (!roleName) return 99;
    const clean = roleName.toLowerCase().trim();
    if (clean.includes('dev') || clean.includes('desenvolvedor')) return 0;
    if (
      clean.includes('ceo') ||
      clean.includes('presidente') ||
      clean.includes('diretor') ||
      clean.includes('diretora') ||
      clean.includes('diretoria') ||
      clean.includes('sócio') ||
      clean.includes('socio')
    ) {
      return 1;
    }
    if (clean.includes('gerente')) return 2;
    if (clean.includes('supervisor') || clean.includes('coordenador') || clean.includes('monitor')) return 3;
    if (
      clean.includes('administra') ||
      clean.includes('rh') ||
      clean.includes('recursos humanos') ||
      clean.includes('estoque') ||
      clean.includes('almoxarifado') ||
      clean.includes('designer') ||
      clean.includes('vendedor') ||
      clean.includes('comercial') ||
      clean.includes('recep') ||
      clean.includes('atendimento')
    ) {
      return 4;
    }
    if (
      clean.includes('impress') ||
      clean.includes('calandra') ||
      clean.includes('costura') ||
      clean.includes('embal') ||
      clean.includes('empacot') ||
      clean.includes('produç') ||
      clean.includes('operad') ||
      clean.includes('auxiliar') ||
      clean.includes('assistente')
    ) {
      return 5;
    }
    return 6;
  }

  private ensureDefaultGroups() {
    if (!ChatRepository.groupsMap.has('GRP-GERAL-EMPRESA')) {
      ChatRepository.groupsMap.set('GRP-GERAL-EMPRESA', {
        id: 'GRP-GERAL-EMPRESA',
        name: 'Geral (Todos os Colaboradores)',
        description: 'Canal coletivo aberto para todos os colaboradores e setores da empresa',
        sector: 'Geral',
        adminUserId: 'SYSTEM',
        adminName: 'SubliGestão ERP',
        memberUserIds: [], // vazio = aberto a todos os colaboradores
        isClosed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    }
  }

  /**
   * List contactable collaborators.
   * EXCLUDES Developer profile (@Marcelo-dev or isDeveloperInvisible / Developer role) for standard view.
   * EXCLUDES the currently logged-in user themselves from the "Geral" list.
   */
  public listContacts(currentUserId: string): ChatContact[] {
    const contacts: ChatContact[] = [];
    const addedIds = new Set<string>();
    const addedUsernames = new Set<string>();

    const currentUser = this.db.users.get(currentUserId);
    const currentCleanUsername = currentUser?.username?.toLowerCase() || '';

    const isCurrentDev =
      currentUser?.isDeveloperInvisible ||
      currentUser?.username.toLowerCase() === '@marcelo-dev' ||
      currentUser?.roleId === 'ROLE-DEVELOPER' ||
      currentUser?.roleId === 'Developer';

    // 1. Scan active users from this.db.users
    for (const user of this.db.users.values()) {
      if (user.deletedAt != null || user.status !== 'ACTIVE') continue;

      // RULE 1: O próprio usuário logado NÃO deve aparecer na lista "Geral" para si mesmo
      if (user.id === currentUserId) continue;
      if (currentCleanUsername && user.username.toLowerCase() === currentCleanUsername) continue;

      // RULE 2: O perfil Developer (@Marcelo-dev) NÃO deve aparecer na lista para outros usuários
      const isDevAccount =
        user.isDeveloperInvisible ||
        user.username.toLowerCase() === '@marcelo-dev' ||
        user.roleId === 'ROLE-DEVELOPER' ||
        user.roleId === 'Developer';

      if (isDevAccount && !isCurrentDev) {
        continue;
      }

      // Calculate unread count from this contact to current user
      let unreadCount = 0;
      for (const msg of ChatRepository.messagesMap.values()) {
        if (
          msg.targetType === 'user' &&
          msg.senderId === user.id &&
          msg.targetId === currentUserId &&
          !msg.readByUsers.includes(currentUserId) &&
          !msg.deletedByUsers.includes(currentUserId)
        ) {
          unreadCount++;
        }
      }

      // Format role name
      const roleObj = this.db.roles.get(user.roleId);
      const rawRoleName = roleObj?.name || user.roleId?.replace(/^ROLE-/, '') || 'Colaborador';
      const roleName = rawRoleName === 'ADM MASTER' ? 'ADM SISTEMA' : rawRoleName;
      const sectorObj = this.db.sectors.get(user.sectorId);
      const sectorName = sectorObj?.name || user.sectorId?.replace(/^SEC-/, '') || 'Geral';

      const userPresence = ChatRepository.getPresenceStatus(user.id, user.username);
      const effectiveLastSeen = userPresence.status === 'offline'
        ? (user.lastLoginAt || userPresence.lastSeen || user.createdAt || Database.nowISO())
        : userPresence.lastSeen;

      contacts.push({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: roleName,
        sector: sectorName,
        avatarUrl: user.avatarUrl,
        isOnline: userPresence.isOnline,
        presenceStatus: userPresence.status,
        lastSeen: effectiveLastSeen,
        awaySince: userPresence.awaySince,
        unreadCount,
      });

      addedIds.add(user.id);
      addedUsernames.add(user.username.toLowerCase());
    }

    // 2. Scan active employees with login & password
    for (const emp of this.db.employees.values()) {
      if (emp.status !== 'ACTIVE' || !emp.temLogin || !emp.loginUsuario) continue;

      const empUserId = `USR-EMP-${emp.id}`;
      let cleanUsername = emp.loginUsuario.toLowerCase();
      if (!cleanUsername.startsWith('@')) cleanUsername = `@${cleanUsername}`;

      // RULE 1: O próprio usuário logado NÃO deve aparecer na lista "Geral" para si mesmo
      if (
        empUserId === currentUserId ||
        emp.id === currentUserId ||
        (currentCleanUsername && cleanUsername === currentCleanUsername) ||
        (currentCleanUsername && cleanUsername.replace('@', '') === currentCleanUsername.replace('@', ''))
      ) {
        continue;
      }

      if (
        addedIds.has(empUserId) ||
        addedIds.has(emp.id) ||
        addedUsernames.has(cleanUsername) ||
        addedUsernames.has(cleanUsername.replace('@', ''))
      ) {
        continue;
      }

      let unreadCount = 0;
      for (const msg of ChatRepository.messagesMap.values()) {
        if (
          msg.targetType === 'user' &&
          (msg.senderId === empUserId || msg.senderId === emp.id) &&
          msg.targetId === currentUserId &&
          !msg.readByUsers.includes(currentUserId) &&
          !msg.deletedByUsers.includes(currentUserId)
        ) {
          unreadCount++;
        }
      }

      const empPresence =
        ChatRepository.getPresenceStatus(empUserId, emp.loginUsuario).status !== 'offline'
          ? ChatRepository.getPresenceStatus(empUserId, emp.loginUsuario)
          : ChatRepository.getPresenceStatus(emp.id, emp.loginUsuario);

      const empLastSeen = empPresence.status === 'offline'
        ? (empPresence.lastSeen || emp.createdAt || Database.nowISO())
        : empPresence.lastSeen;

      contacts.push({
        id: empUserId,
        name: `${emp.nome} ${emp.sobrenome}`.trim(),
        username: cleanUsername,
        email: emp.email,
        phone: emp.telefone,
        role: (emp.cargo === 'ADM MASTER' ? 'ADM SISTEMA' : emp.cargo) || 'Colaborador',
        sector: emp.setor || 'Geral',
        avatarUrl: emp.fotoUrl,
        isOnline: empPresence.isOnline,
        presenceStatus: empPresence.status,
        lastSeen: empLastSeen,
        awaySince: empPresence.awaySince,
        unreadCount,
      });

      addedIds.add(empUserId);
      addedUsernames.add(cleanUsername);
    }

    const sortedContacts = contacts.sort((a, b) => {
      const rankA = ChatRepository.getRoleHierarchyRank(a.role);
      const rankB = ChatRepository.getRoleHierarchyRank(b.role);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.name.localeCompare(b.name);
    });

    // Support contact for all collaborators
    if (currentUserId !== 'SYS-SUPPORT') {
      let supportUnreadCount = 0;
      for (const msg of ChatRepository.messagesMap.values()) {
        if (
          msg.targetType === 'user' &&
          msg.senderId === 'SYS-SUPPORT' &&
          (msg.targetId === currentUserId || (currentUserId.startsWith('USR-EMP-') && msg.targetId === currentUserId.replace('USR-EMP-', ''))) &&
          !msg.readByUsers.includes(currentUserId) &&
          !msg.deletedByUsers.includes(currentUserId)
        ) {
          supportUnreadCount++;
        }
      }

      const supportContact: ChatContact = {
        id: 'SYS-SUPPORT',
        name: 'Suporte do Sistema',
        username: '@suporte',
        email: 'suporte@subligestao.com.br',
        phone: '',
        role: 'Central de Atendimento & TI',
        sector: 'Suporte Técnico',
        avatarUrl: ChatRepository.getSupportAvatarUrl(this.db),
        isOnline: true,
        presenceStatus: 'online',
        lastSeen: new Date().toISOString(),
        unreadCount: supportUnreadCount,
      };

      return [supportContact, ...sortedContacts];
    }

    return sortedContacts;
  }

  /**
   * List accessible chat groups for the current user.
   */
  public listGroups(currentUserId: string): MessageGroup[] {
    const groups: MessageGroup[] = [];

    const u = this.db.users.get(currentUserId);
    const roleObj = u ? this.db.roles.get(u.roleId) : undefined;
    const emp = this.db.employees.get(currentUserId);
    const rawRole = (roleObj?.name || emp?.cargo || '').trim().toLowerCase();
    const userRole = rawRole === 'adm master' ? 'adm sistema' : rawRole;

    const roleMatches = (targetR: string, actualR: string): boolean => {
      const t = targetR.trim().toLowerCase();
      const a = actualR.trim().toLowerCase();
      if (t === a) return true;
      if (
        (t === 'adm sistema' || t === 'adm master' || t === 'administrador') &&
        (a === 'adm sistema' || a === 'adm master' || a === 'administrador')
      ) {
        return true;
      }
      return false;
    };

    for (const g of ChatRepository.groupsMap.values()) {
      if (g.isClosed) continue;

      const matchesTargetRole = Boolean(
        userRole &&
        (
          (g.role && roleMatches(g.role, userRole)) ||
          (g.targetRoles && g.targetRoles.some((r) => roleMatches(r, userRole)))
        )
      );

      // Accessible if open group, or user in memberUserIds, or admin, or matches group role
      if (
        (g.memberUserIds.length === 0 && !g.role && (!g.targetRoles || g.targetRoles.length === 0)) ||
        matchesTargetRole ||
        g.memberUserIds.includes(currentUserId) ||
        g.adminUserId === currentUserId
      ) {
        groups.push(g);
      }
    }

    return groups.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Create a new group (Direção, Gerente, Supervisor, Developer).
   */
  public createGroup(dto: CreateGroupDTO, creatorUser: User): MessageGroup {
    if (!dto.name?.trim()) throw new Error('Nome do grupo é obrigatório.');

    const now = Database.nowISO();
    const id = Database.generateId('GRP');

    const newGroup: MessageGroup = {
      id,
      name: dto.name.trim(),
      description: dto.description?.trim() || 'Grupo interno de trabalho',
      sector: dto.sector || 'Geral',
      role: dto.role?.trim() || undefined,
      targetRoles: dto.targetRoles || (dto.role?.trim() ? [dto.role.trim()] : undefined),
      adminUserId: creatorUser.id,
      adminName: creatorUser.name,
      memberUserIds: dto.memberUserIds || [],
      isClosed: false,
      createdAt: now,
    };

    ChatRepository.groupsMap.set(id, newGroup);

    // Audit log
    this.addAuditLog({
      action: 'CREATE_GROUP',
      performedBy: `${creatorUser.name} (${creatorUser.username})`,
      details: `Criou o grupo "${newGroup.name}"${newGroup.role ? ` com cargo alvo "${newGroup.role}"` : ''} com ${newGroup.memberUserIds.length} membros.`,
      target: id,
    });

    return newGroup;
  }

  /**
   * Update or close a group.
   */
  public updateGroup(groupId: string, dto: Partial<CreateGroupDTO> & { isClosed?: boolean }, updatedByUser: User): MessageGroup {
    const group = ChatRepository.groupsMap.get(groupId);
    if (!group) throw new Error('Grupo não encontrado.');

    if (dto.name !== undefined) group.name = dto.name.trim();
    if (dto.description !== undefined) group.description = dto.description.trim();
    if (dto.sector !== undefined) group.sector = dto.sector;
    if (dto.role !== undefined) group.role = dto.role ? dto.role.trim() : undefined;
    if (dto.targetRoles !== undefined) group.targetRoles = dto.targetRoles;
    if (dto.memberUserIds !== undefined) group.memberUserIds = dto.memberUserIds;
    if (dto.isClosed !== undefined) group.isClosed = dto.isClosed;

    ChatRepository.groupsMap.set(groupId, group);

    this.addAuditLog({
      action: dto.isClosed ? 'CLOSE_GROUP' : 'UPDATE_GROUP',
      performedBy: `${updatedByUser.name} (${updatedByUser.username})`,
      details: `Atualizou o grupo "${group.name}".`,
      target: groupId,
    });

    return group;
  }

  /**
   * Permanently delete a group.
   */
  public deleteGroup(groupId: string, user: User): void {
    const group = ChatRepository.groupsMap.get(groupId);
    if (!group) throw new Error('Grupo não encontrado.');

    ChatRepository.groupsMap.delete(groupId);

    this.addAuditLog({
      action: 'DELETE_GROUP',
      performedBy: `${user.name} (${user.username})`,
      details: `Excluiu o grupo "${group.name}".`,
      target: groupId,
    });
  }

  /**
   * Send a chat message (1-on-1, group, or sector).
   */
  public sendMessage(dto: CreateMessageDTO, senderUser: User): ChatMessage {
    if (!dto.content?.trim() && (!dto.attachments || dto.attachments.length === 0)) {
      throw new Error('A mensagem precisa ter texto ou anexo.');
    }

    const now = Database.nowISO();
    const id = Database.generateId('MSG');

    const roleObj = this.db.roles.get(senderUser.roleId);
    const senderRole = roleObj?.name || senderUser.roleId || 'Colaborador';

    const newMessage: ChatMessage = {
      id,
      senderId: senderUser.id,
      senderName: senderUser.name,
      senderRole: senderRole,
      senderAvatar: senderUser.avatarUrl,
      targetType: dto.targetType,
      targetId: dto.targetId,
      content: dto.content?.trim() || '',
      attachments: dto.attachments || [],
      deletedByUsers: [],
      readByUsers: [senderUser.id], // Sender automatically reads their own message
      createdAt: now,
    };

    ChatRepository.messagesMap.set(id, newMessage);

    // Support ticket handling
    if (dto.targetId === 'SYS-SUPPORT') {
      ChatRepository.supportTicketsMap.set(senderUser.id, {
        status: 'OPEN',
      });

      // Auto-acknowledgment if first time contacting SYS-SUPPORT
      const priorMessages = Array.from(ChatRepository.messagesMap.values()).filter(
        (m) => m.targetId === 'SYS-SUPPORT' && m.senderId === senderUser.id && m.id !== id
      );
      if (priorMessages.length === 0) {
        const autoReplyId = Database.generateId('MSG');
        const autoReply: ChatMessage = {
          id: autoReplyId,
          senderId: 'SYS-SUPPORT',
          senderName: 'Suporte do Sistema',
          senderRole: 'Central de Atendimento & TI',
          senderAvatar: ChatRepository.getSupportAvatarUrl(this.db),
          targetType: 'user',
          targetId: senderUser.id,
          content: 'Olá! Sua mensagem foi recebida pela Central de Suporte e TI do ERP. Um administrador ou desenvolvedor responderá em breve por este canal.',
          deletedByUsers: [],
          readByUsers: [],
          createdAt: new Date(Date.now() + 50).toISOString(),
        };
        ChatRepository.messagesMap.set(autoReplyId, autoReply);
      }
    }

    // Audit Log for Developer audit trail
    this.addAuditLog({
      action: 'SEND_MESSAGE',
      performedBy: `${senderUser.name} (${senderUser.username})`,
      details: `Enviou mensagem no tipo "${dto.targetType}" para "${dto.targetId}" com ${dto.attachments?.length || 0} anexos.`,
      target: id,
    });

    return newMessage;
  }

  /**
   * Helper to verify if a given user is a Support Operator (Developer or Administrador Master).
   */
  public isSupportOperatorUser(userOrId: string | User | undefined | null): boolean {
    if (!userOrId) return false;
    let u: User | undefined;
    if (typeof userOrId === 'string') {
      const cleanId = userOrId.replace('USR-EMP-', '');
      u = this.db.users.get(userOrId) || this.db.users.get(cleanId);
      if (!u) {
        const emp = this.db.employees.get(cleanId);
        if (emp) {
          if (emp.isDeveloperInvisible) return true;
          const cargo = (emp.cargo || '').toLowerCase();
          if (
            cargo.includes('developer') ||
            cargo.includes('desenvolvedor') ||
            cargo.includes('admin master') ||
            cargo.includes('adm master') ||
            cargo.includes('administrador master') ||
            cargo.includes('administradora master')
          ) {
            return true;
          }
        }
      }
    } else {
      u = userOrId;
    }

    if (!u) return false;
    if ((u as any).isDeveloper || (u as any).isDeveloperInvisible) return true;

    const username = (u.username || '').toLowerCase();
    if (
      username === '@marcelo-dev' ||
      username.includes('marcelo-dev') ||
      username.includes('developer') ||
      username === 'adminmaster' ||
      username.includes('adminmaster')
    ) {
      return true;
    }

    const roleObj = this.db.roles.get(u.roleId);
    const roleName = (roleObj?.name || u.roleId || '').toLowerCase();
    if (
      roleName.includes('developer') ||
      roleName.includes('desenvolvedor') ||
      roleName.includes('admin master') ||
      roleName.includes('adm master') ||
      roleName.includes('administrador master') ||
      roleName.includes('administradora master') ||
      roleName === 'master'
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get thread message history for current user.
   */
  public getMessageHistory(
    currentUserId: string,
    targetType: 'user' | 'group' | 'sector',
    targetId: string
  ): ChatMessage[] {
    const list: ChatMessage[] = [];
    const safeCurrentId = currentUserId ? String(currentUserId) : '';
    const safeTargetId = targetId ? String(targetId) : '';
    const altCurrentId = safeCurrentId.startsWith('USR-EMP-')
      ? safeCurrentId.replace('USR-EMP-', '')
      : (safeCurrentId ? `USR-EMP-${safeCurrentId}` : '');
    const altTargetId = safeTargetId.startsWith('USR-EMP-')
      ? safeTargetId.replace('USR-EMP-', '')
      : (safeTargetId ? `USR-EMP-${safeTargetId}` : '');

    const isSupportOperator = this.isSupportOperatorUser(safeCurrentId);

    for (const msg of ChatRepository.messagesMap.values()) {
      // Filter out if user deleted this message from their view
      if (
        (safeCurrentId && msg.deletedByUsers.includes(safeCurrentId)) ||
        (altCurrentId && msg.deletedByUsers.includes(altCurrentId))
      ) {
        continue;
      }

      if (targetType === 'user') {
        // 1-on-1 private chat thread
        const isFromMe = (safeCurrentId && msg.senderId === safeCurrentId) || (altCurrentId && msg.senderId === altCurrentId);
        const isToTarget = (safeTargetId && msg.targetId === safeTargetId) || (altTargetId && msg.targetId === altTargetId);
        const isFromTarget = (safeTargetId && msg.senderId === safeTargetId) || (altTargetId && msg.senderId === altTargetId);
        const isToMe = (safeCurrentId && msg.targetId === safeCurrentId) || (altCurrentId && msg.targetId === altCurrentId);

        // Support integration: If operator is chatting with a client or client is viewing SYS-SUPPORT
        const isSupportThread =
          (isSupportOperator && (
            (msg.targetId === 'SYS-SUPPORT' && (msg.senderId === safeTargetId || (altTargetId && msg.senderId === altTargetId))) ||
            (msg.senderId === 'SYS-SUPPORT' && (msg.targetId === safeTargetId || (altTargetId && msg.targetId === altTargetId)))
          )) ||
          (safeTargetId === 'SYS-SUPPORT' && (
            (msg.targetId === 'SYS-SUPPORT' && (msg.senderId === safeCurrentId || (altCurrentId && msg.senderId === altCurrentId))) ||
            (msg.senderId === 'SYS-SUPPORT' && (msg.targetId === safeCurrentId || (altCurrentId && msg.targetId === altCurrentId)))
          ));

        if ((isFromMe && isToTarget) || (isFromTarget && isToMe) || isSupportThread) {
          list.push(msg);
        }
      } else if (targetType === 'group' || targetType === 'sector') {
        if (msg.targetType === targetType && msg.targetId === safeTargetId) {
          list.push(msg);
        }
      }
    }

    return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * Mark messages as read for current user in a target thread.
   */
  public markAsRead(currentUserId: string, targetType: 'user' | 'group' | 'sector', targetId: string): void {
    const safeCurrentId = currentUserId ? String(currentUserId) : '';
    const safeTargetId = targetId ? String(targetId) : '';
    if (!safeCurrentId) return;

    const altCurrentId = safeCurrentId.startsWith('USR-EMP-')
      ? safeCurrentId.replace('USR-EMP-', '')
      : (safeCurrentId ? `USR-EMP-${safeCurrentId}` : '');
    const altTargetId = safeTargetId.startsWith('USR-EMP-')
      ? safeTargetId.replace('USR-EMP-', '')
      : (safeTargetId ? `USR-EMP-${safeTargetId}` : '');

    const isSupportOperator = this.isSupportOperatorUser(safeCurrentId);

    for (const msg of ChatRepository.messagesMap.values()) {
      if (
        (safeCurrentId && msg.deletedByUsers.includes(safeCurrentId)) ||
        (altCurrentId && msg.deletedByUsers.includes(altCurrentId))
      ) {
        continue;
      }

      let isTargetMatch = false;
      if (targetType === 'user') {
        const isFromTarget = (safeTargetId && msg.senderId === safeTargetId) || (altTargetId && msg.senderId === altTargetId);
        const isToMe = (safeCurrentId && msg.targetId === safeCurrentId) || (altCurrentId && msg.targetId === altCurrentId);
        const isSupportThread =
          (isSupportOperator && (
            (msg.targetId === 'SYS-SUPPORT' && (msg.senderId === safeTargetId || (altTargetId && msg.senderId === altTargetId))) ||
            (msg.senderId === 'SYS-SUPPORT' && (msg.targetId === safeTargetId || (altTargetId && msg.targetId === altTargetId)))
          )) ||
          (safeTargetId === 'SYS-SUPPORT' && (
            (msg.targetId === 'SYS-SUPPORT' && (msg.senderId === safeCurrentId || (altCurrentId && msg.senderId === altCurrentId))) ||
            (msg.senderId === 'SYS-SUPPORT' && (msg.targetId === safeCurrentId || (altCurrentId && msg.targetId === altCurrentId)))
          ));

        isTargetMatch = Boolean((isFromTarget && isToMe) || isSupportThread);
      } else if (targetType === 'group' || targetType === 'sector') {
        isTargetMatch = msg.targetType === targetType && msg.targetId === safeTargetId;
      }

      if (
        isTargetMatch &&
        !msg.readByUsers.includes(safeCurrentId) &&
        (!altCurrentId || !msg.readByUsers.includes(altCurrentId))
      ) {
        msg.readByUsers.push(safeCurrentId);
        ChatRepository.messagesMap.set(msg.id, msg);
      }
    }
  }

  /**
   * User clears their own visual history for a conversation.
   * Soft-delete: Appends currentUserId to deletedByUsers.
   */
  public clearUserHistory(currentUserId: string, targetType: 'user' | 'group' | 'sector', targetId: string): void {
    const safeCurrentId = currentUserId ? String(currentUserId) : '';
    const safeTargetId = targetId ? String(targetId) : '';
    if (!safeCurrentId) return;

    let clearedCount = 0;
    const altCurrentId = safeCurrentId.startsWith('USR-EMP-')
      ? safeCurrentId.replace('USR-EMP-', '')
      : (safeCurrentId ? `USR-EMP-${safeCurrentId}` : '');
    const altTargetId = safeTargetId.startsWith('USR-EMP-')
      ? safeTargetId.replace('USR-EMP-', '')
      : (safeTargetId ? `USR-EMP-${safeTargetId}` : '');

    for (const msg of ChatRepository.messagesMap.values()) {
      let isMatch = false;
      if (targetType === 'user') {
        const isFromMe = (safeCurrentId && msg.senderId === safeCurrentId) || (altCurrentId && msg.senderId === altCurrentId);
        const isToTarget = (safeTargetId && msg.targetId === safeTargetId) || (altTargetId && msg.targetId === altTargetId);
        const isFromTarget = (safeTargetId && msg.senderId === safeTargetId) || (altTargetId && msg.senderId === altTargetId);
        const isToMe = (safeCurrentId && msg.targetId === safeCurrentId) || (altCurrentId && msg.targetId === altCurrentId);
        isMatch = Boolean((isFromMe && isToTarget) || (isFromTarget && isToMe));
      } else {
        isMatch = msg.targetType === targetType && msg.targetId === safeTargetId;
      }

      if (isMatch && !msg.deletedByUsers.includes(safeCurrentId)) {
        msg.deletedByUsers.push(safeCurrentId);
        clearedCount++;
        ChatRepository.messagesMap.set(msg.id, msg);
      }
    }

    this.addAuditLog({
      action: 'CLEAR_USER_HISTORY',
      performedBy: safeCurrentId,
      details: `Usuário limpou ${clearedCount} mensagens de seu histórico visual (${targetType}:${safeTargetId}).`,
      target: safeTargetId,
    });
  }

  /**
   * Get unread messages for floating notifications & header badges.
   */
  public getUnreadMessagesForUser(currentUserId: string): ChatMessage[] {
    const unread: ChatMessage[] = [];
    const safeCurrentId = currentUserId ? String(currentUserId) : '';
    if (!safeCurrentId) return [];

    const altCurrentId = safeCurrentId.startsWith('USR-EMP-')
      ? safeCurrentId.replace('USR-EMP-', '')
      : (safeCurrentId ? `USR-EMP-${safeCurrentId}` : '');

    // User's group IDs
    const userGroupIds = this.listGroups(safeCurrentId).map((g) => g.id);
    const isSupportOperator = this.isSupportOperatorUser(safeCurrentId);

    for (const msg of ChatRepository.messagesMap.values()) {
      if (msg.senderId === safeCurrentId || (altCurrentId && msg.senderId === altCurrentId)) continue;
      if (msg.deletedByUsers.includes(safeCurrentId) || (altCurrentId && msg.deletedByUsers.includes(altCurrentId))) continue;
      if (msg.readByUsers.includes(safeCurrentId) || (altCurrentId && msg.readByUsers.includes(altCurrentId))) continue;

      const isDirectToMe = msg.targetType === 'user' && (msg.targetId === safeCurrentId || (altCurrentId && msg.targetId === altCurrentId));
      const isGroupToMe = msg.targetType === 'group' && userGroupIds.includes(msg.targetId);

      // Support operator rule: Developer and Administrador Master receive ALL unread support messages sent to SYS-SUPPORT
      const isSupportTicketForOperator = isSupportOperator && msg.targetId === 'SYS-SUPPORT';

      if (isDirectToMe || isGroupToMe || isSupportTicketForOperator) {
        unread.push(msg);
      }
    }

    return unread.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Developer Audit History - returns all stored messages, groups, audit trails.
   */
  public getDeveloperAuditHistory() {
    const allMessages = Array.from(ChatRepository.messagesMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const allGroups = Array.from(ChatRepository.groupsMap.values());
    const auditLogs = [...ChatRepository.auditLogsList].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    let totalAttachmentsCount = 0;
    allMessages.forEach((m) => {
      totalAttachmentsCount += m.attachments?.length || 0;
    });

    return {
      messages: allMessages,
      groups: allGroups,
      auditLogs,
      stats: {
        totalMessages: allMessages.length,
        totalGroups: allGroups.length,
        totalAttachments: totalAttachmentsCount,
      },
    };
  }

  /**
   * Developer action: clear own history or wipe general history system-wide.
   */
  public developerClearHistory(scope: 'own' | 'all', devUserId: string) {
    if (scope === 'own') {
      for (const msg of ChatRepository.messagesMap.values()) {
        if (!msg.deletedByUsers.includes(devUserId)) {
          msg.deletedByUsers.push(devUserId);
          ChatRepository.messagesMap.set(msg.id, msg);
        }
      }
      this.addAuditLog({
        action: 'DEV_CLEAR_OWN_HISTORY',
        performedBy: devUserId,
        details: 'Developer limpou o próprio histórico de visualização.',
        target: 'SYSTEM',
      });
    } else if (scope === 'all') {
      ChatRepository.messagesMap.clear();
      pgPool.query('DELETE FROM chat_messages').catch(() => {});
      this.addAuditLog({
        action: 'DEV_CLEAR_ALL_HISTORY',
        performedBy: devUserId,
        details: 'Developer limpou TODO o histórico geral de mensagens do sistema.',
        target: 'SYSTEM',
      });
    }
  }

  /**
   * List all support tickets for Developer and Admin Master.
   */
  public listSupportTickets(currentUserId?: string): SupportTicket[] {
    const ticketsMap = new Map<string, SupportTicket>();

    for (const msg of ChatRepository.messagesMap.values()) {
      if (msg.targetId !== 'SYS-SUPPORT' && msg.senderId !== 'SYS-SUPPORT') continue;

      const clientUserId = msg.targetId === 'SYS-SUPPORT' ? msg.senderId : msg.targetId;
      if (!clientUserId || clientUserId === 'SYS-SUPPORT') continue;

      let ticket = ticketsMap.get(clientUserId);
      if (!ticket) {
        let userName = 'Colaborador';
        let userRole = 'Geral';
        let userSector = 'Geral';
        let userAvatar = '';
        let userUsername = '';

        const u = this.db.users.get(clientUserId);
        if (u) {
          userName = u.name;
          const roleObj = this.db.roles.get(u.roleId);
          userRole = roleObj?.name || u.roleId?.replace(/^ROLE-/, '') || 'Colaborador';
          const sectorObj = this.db.sectors.get(u.sectorId);
          userSector = sectorObj?.name || u.sectorId?.replace(/^SEC-/, '') || 'Geral';
          userAvatar = u.avatarUrl || '';
          userUsername = u.username || '';
        } else {
          const rawEmpId = clientUserId.replace('USR-EMP-', '');
          const emp = this.db.employees.get(rawEmpId);
          if (emp) {
            userName = [emp.nome, emp.sobrenome].filter(Boolean).join(' ') || emp.nome;
            userRole = emp.cargo;
            userSector = emp.setor;
            userAvatar = emp.fotoUrl || '';
            userUsername = (emp as any).loginUsuario ? `@${(emp as any).loginUsuario.replace('@', '')}` : '';
          }
        }

        const storedStatus = ChatRepository.supportTicketsMap.get(clientUserId);

        ticket = {
          id: clientUserId,
          userId: clientUserId,
          userName,
          userRole,
          userSector,
          userAvatar,
          userUsername,
          status: storedStatus?.status || 'OPEN',
          unreadCount: 0,
          lastMessage: '',
          lastMessageAt: '',
          lastSenderId: '',
          createdAt: msg.createdAt,
          resolvedAt: storedStatus?.resolvedAt,
          resolvedBy: storedStatus?.resolvedBy,
        };
        ticketsMap.set(clientUserId, ticket);
      }

      if (msg.targetId === 'SYS-SUPPORT' && (!currentUserId || !msg.readByUsers.includes(currentUserId))) {
        ticket.unreadCount++;
      }

      if (!ticket.lastMessageAt || new Date(msg.createdAt).getTime() >= new Date(ticket.lastMessageAt).getTime()) {
        ticket.lastMessageAt = msg.createdAt;
        ticket.lastMessage = msg.content || (msg.attachments && msg.attachments.length > 0 ? '📎 Anexo' : '');
        ticket.lastSenderId = msg.senderId;
      }
    }

    return Array.from(ticketsMap.values()).sort((a, b) => {
      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return timeB - timeA;
    });
  }

  /**
   * Developer / Master sends a response masked as "Suporte do Sistema".
   */
  public sendSupportReply(
    clientUserId: string,
    content: string,
    attachments: any[] | undefined,
    devUser: User
  ): ChatMessage {
    if (!content?.trim() && (!attachments || attachments.length === 0)) {
      throw new Error('Mensagem vazia.');
    }

    const now = Database.nowISO();
    const id = Database.generateId('MSG');

    const newMessage: ChatMessage = {
      id,
      senderId: 'SYS-SUPPORT',
      senderName: 'Suporte do Sistema',
      senderRole: 'Central de Atendimento & TI',
      senderAvatar: ChatRepository.getSupportAvatarUrl(this.db),
      targetType: 'user',
      targetId: clientUserId,
      content: content?.trim() || '',
      attachments: attachments || [],
      deletedByUsers: [],
      readByUsers: ['SYS-SUPPORT', devUser.id],
      createdAt: now,
    };

    ChatRepository.messagesMap.set(id, newMessage);

    const existing = ChatRepository.supportTicketsMap.get(clientUserId);
    ChatRepository.supportTicketsMap.set(clientUserId, {
      ...existing,
      status: 'ANSWERED',
    });

    this.addAuditLog({
      action: 'SUPPORT_REPLY',
      performedBy: `${devUser.name} (${devUser.username})`,
      details: `Respondeu ao chamado de suporte do colaborador ${clientUserId}.`,
      target: clientUserId,
    });

    return newMessage;
  }

  /**
   * Mark a support ticket as RESOLVED or OPEN.
   */
  public resolveSupportTicket(
    clientUserId: string,
    status: 'OPEN' | 'RESOLVED',
    devUser: User
  ): void {
    const existing = ChatRepository.supportTicketsMap.get(clientUserId);
    ChatRepository.supportTicketsMap.set(clientUserId, {
      ...existing,
      status,
      resolvedAt: status === 'RESOLVED' ? Database.nowISO() : undefined,
      resolvedBy: status === 'RESOLVED' ? devUser.name : undefined,
    });

    this.addAuditLog({
      action: status === 'RESOLVED' ? 'RESOLVE_TICKET' : 'REOPEN_TICKET',
      performedBy: `${devUser.name} (${devUser.username})`,
      details: `${status === 'RESOLVED' ? 'Concluiu' : 'Reabriu'} o chamado de suporte do colaborador ${clientUserId}.`,
      target: clientUserId,
    });
  }

  private addAuditLog(log: { action: string; performedBy: string; details: string; target: string }) {
    ChatRepository.auditLogsList.push({
      id: Database.generateId('LOG'),
      timestamp: Database.nowISO(),
      action: log.action,
      performedBy: log.performedBy,
      details: log.details,
      target: log.target,
    });
  }
}
