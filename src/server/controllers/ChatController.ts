import { Request, Response, NextFunction } from 'express';
import { ChatRepository } from '../repositories/ChatRepository';
import { UserRepository } from '../repositories/UserRepository';
import { CreateMessageDTO, CreateGroupDTO } from '../../types/chat';

const chatRepo = new ChatRepository();
const userRepo = new UserRepository();

function getUserId(req: Request): string {
  const u = (req as any).user;
  if (!u) return '';
  return u.sub || u.userId || u.id || '';
}

async function getFullUser(req: Request) {
  const userId = getUserId(req);
  const u = (req as any).user || {};
  if (userId) {
    const found = await userRepo.findById(userId, true);
    if (found) return found;
  }
  return {
    id: userId,
    name: u.username || 'Colaborador',
    username: u.username || '@usuario',
    roleId: u.role || 'ROLE-OPERADOR',
    sectorId: u.sector || 'SEC-PRODUCAO',
    branchId: u.branchId || 'MATRIZ',
    isDeveloperInvisible: Boolean(u.isDeveloper),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export class ChatController {
  public static heartbeat = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = getUserId(req);
      const u = (req as any).user || {};
      const username = u.username || '';
      const { status, awaySince } = req.body;
      const validStatus = status === 'away' ? 'away' : status === 'offline' ? 'offline' : 'online';

      ChatRepository.updatePresence(userId, username, validStatus, awaySince);
      res.json({ success: true, status: validStatus });
    } catch (err: any) {
      next(err);
    }
  };

  public static listContacts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = getUserId(req);
      const u = (req as any).user || {};
      const username = u.username || '';
      if (userId) {
        const currentPresence = ChatRepository.getPresenceStatus(userId, username);
        if (currentPresence.status === 'away') {
          ChatRepository.updatePresence(userId, username, 'away', currentPresence.awaySince);
        } else {
          ChatRepository.updatePresence(userId, username, 'online');
        }
      }
      const contacts = chatRepo.listContacts(userId);
      res.json({ success: true, data: contacts });
    } catch (err: any) {
      next(err);
    }
  };

  public static listGroups = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = getUserId(req);
      const groups = chatRepo.listGroups(userId);
      res.json({ success: true, data: groups });
    } catch (err: any) {
      next(err);
    }
  };

  public static createGroup = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = await getFullUser(req);
      const dto: CreateGroupDTO = req.body;
      const group = chatRepo.createGroup(dto, user as any);
      res.status(201).json({ success: true, data: group, message: 'Grupo criado com sucesso.' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Falha ao criar grupo.' });
    }
  };

  public static updateGroup = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = await getFullUser(req);
      const { id } = req.params;
      const dto = req.body;
      const group = chatRepo.updateGroup(id, dto, user as any);
      res.json({ success: true, data: group, message: 'Grupo atualizado com sucesso.' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Falha ao atualizar grupo.' });
    }
  };

  public static deleteGroup = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = await getFullUser(req);
      const { id } = req.params;
      chatRepo.deleteGroup(id, user as any);
      res.json({ success: true, message: 'Grupo excluído com sucesso.' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Falha ao excluir grupo.' });
    }
  };

  public static sendMessage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = await getFullUser(req);
      const dto: CreateMessageDTO = req.body;
      const msg = chatRepo.sendMessage(dto, user as any);
      res.status(201).json({ success: true, data: msg });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Falha ao enviar mensagem.' });
    }
  };

  public static getHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { targetType, targetId } = req.params;
      const messages = chatRepo.getMessageHistory(
        userId,
        targetType as 'user' | 'group' | 'sector',
        targetId
      );
      res.json({ success: true, data: messages });
    } catch (err: any) {
      next(err);
    }
  };

  public static markAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { targetType, targetId } = req.body;
      chatRepo.markAsRead(userId, targetType, targetId);
      res.json({ success: true });
    } catch (err: any) {
      next(err);
    }
  };

  public static clearHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { targetType, targetId } = req.body;
      chatRepo.clearUserHistory(userId, targetType, targetId);
      res.json({ success: true, message: 'Histórico de conversas limpo para o seu perfil.' });
    } catch (err: any) {
      next(err);
    }
  };

  public static getUnread = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = getUserId(req);
      const unread = chatRepo.getUnreadMessagesForUser(userId);
      res.json({ success: true, data: unread });
    } catch (err: any) {
      next(err);
    }
  };

  public static getDeveloperAudit = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const audit = chatRepo.getDeveloperAuditHistory();
      res.json({ success: true, data: audit });
    } catch (err: any) {
      next(err);
    }
  };

  public static developerClear = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { scope } = req.body; // 'own' | 'all'
      chatRepo.developerClearHistory(scope || 'own', userId);
      res.json({ success: true, message: 'Operação de limpeza executada pelo Developer.' });
    } catch (err: any) {
      next(err);
    }
  };

  public static listSupportTickets = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = getUserId(req);
      const tickets = chatRepo.listSupportTickets(userId);
      res.json({ success: true, data: tickets });
    } catch (err: any) {
      next(err);
    }
  };

  public static sendSupportReply = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = await getFullUser(req);
      const { clientUserId, content, attachments } = req.body;
      if (!clientUserId) throw new Error('ID do colaborador é obrigatório.');
      const msg = chatRepo.sendSupportReply(clientUserId, content, attachments, user as any);
      res.json({ success: true, data: msg });
    } catch (err: any) {
      next(err);
    }
  };

  public static resolveSupportTicket = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = await getFullUser(req);
      const { clientUserId, status } = req.body;
      if (!clientUserId) throw new Error('ID do colaborador é obrigatório.');
      chatRepo.resolveSupportTicket(clientUserId, status || 'RESOLVED', user as any);
      res.json({ success: true, message: 'Status do chamado atualizado com sucesso.' });
    } catch (err: any) {
      next(err);
    }
  };
}
