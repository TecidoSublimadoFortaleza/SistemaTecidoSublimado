/**
 * ERP SubliGestão - Serviço de Notificações em Tempo Real
 * Gerencia alertas de produção, avanço de etapas de OS para Vendedores, Recepcionistas e Gestores.
 */

import { UserProfile } from '../types/frontend';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string; // Ex: "17/08 às 10:45"
  timestamp: number;
  unread: boolean;
  readByUsers?: string[]; // Usuários que já marcaram como lida
  clearedByUsers?: string[]; // Usuários que limparam/removeram de sua visão individual
  type: 'os_progression' | 'os_created' | 'os_accepted' | 'os_completed' | 'os_rollback' | 'system' | 'financial' | 'os_rejected';
  osId?: string;
  osCodigo?: string;
  clienteNome?: string;
  operador?: string; // Criador da OS (Vendedor/Recepção)
  targetRole?: string;
  targetRoles?: string[];
  targetUser?: string;
  targetGroup?: 'DIRETORIA' | 'VENDEDOR' | 'OPERADOR' | 'ALL';
  stage?: string;
  authorName?: string;
  rejectionReason?: string;
}

const STORAGE_KEY = 'subligestao_notifications';

function getUserIdentifiers(user?: { id?: string; username?: string; name?: string; role?: string }): string[] {
  if (!user) return [];
  const keys: string[] = [];
  if (user.id) keys.push(user.id.toLowerCase().trim());
  if (user.username) keys.push(user.username.toLowerCase().trim());
  if (user.name) keys.push(user.name.toLowerCase().trim());
  return keys.filter(Boolean);
}

function isNotificationClearedForUser(
  notif: AppNotification,
  user?: { id?: string; username?: string; name?: string; role?: string }
): boolean {
  if (!user || !notif.clearedByUsers || notif.clearedByUsers.length === 0) return false;
  const userKeys = getUserIdentifiers(user);
  if (userKeys.length === 0) return false;

  return notif.clearedByUsers.some((clearedItem) => {
    const normCleared = clearedItem.toLowerCase().trim();
    return userKeys.some((uk) => uk === normCleared || normCleared.includes(uk) || uk.includes(normCleared));
  });
}

function formatTimestampBR(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month} às ${hours}:${minutes}`;
}

export class NotificationService {
  private static getInitialSeedNotifications(): AppNotification[] {
    // Retorna vazio: notificações só serão exibidas caso haja ações reais registradas no sistema
    return [];
  }

  public static clearGlobalAllNotifications(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('subligestao_notifications_changed'));
      }
    } catch {}
  }

  public static getAllNotifications(): AppNotification[] {
    try {
      // Garantir limpeza total e inicial de quaisquer notificações legadas ou mockadas de todos os perfis
      const isReset = localStorage.getItem('subligestao_notifications_purged_v3');
      if (!isReset) {
        localStorage.setItem('subligestao_notifications_purged_v3', 'true');
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        return [];
      }

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filtra e remove quaisquer notificações mockadas/iniciais antigas ('notif-init-*')
          const realNotificationsOnly = parsed.filter((n) => !n.id || !n.id.startsWith('notif-init-'));
          if (realNotificationsOnly.length !== parsed.length) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(realNotificationsOnly));
            } catch {}
          }
          return realNotificationsOnly;
        }
      }
    } catch {}

    const initialList: AppNotification[] = [];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialList));
    } catch {}

    return initialList;
  }

  public static getUserNotifications(currentUser?: {
    id?: string;
    username?: string;
    name?: string;
    role?: string;
    isDeveloper?: boolean;
  }): AppNotification[] {
    const all = this.getAllNotifications();
    if (!currentUser) return all;

    const { name, role, isDeveloper } = currentUser;
    const userKeys = getUserIdentifiers(currentUser);

    const userNameNorm = (name || '').trim().toLowerCase();
    const userRoleNorm = (role || '').trim().toLowerCase();

    const isDiretoria =
      Boolean(isDeveloper) ||
      userRoleNorm.includes('ceo') ||
      userRoleNorm.includes('gerente') ||
      userRoleNorm.includes('supervisor') ||
      userRoleNorm.includes('developer') ||
      userRoleNorm.includes('diretor') ||
      userRoleNorm.includes('diretoria') ||
      userRoleNorm.includes('direção');

    const isVendedorOuRecepcao =
      userRoleNorm.includes('vendedor') ||
      userRoleNorm.includes('vendas') ||
      userRoleNorm.includes('recep') ||
      userRoleNorm.includes('atendimento');

    // Filtragem precisa e direcionada para cada perfil
    const filtered = all.filter((n) => {
      // 0. Se a notificação foi limpa individualmente por este usuário, oculta apenas para ele
      if (isNotificationClearedForUser(n, currentUser)) {
        return false;
      }

      if (isDeveloper) return true;

      // REGRA ISOLADA PARA VENDEDORES: SÓ RECEBEM NOTIFICAÇÕES DO SEU PRÓPRIO SERVIÇO
      if (isVendedorOuRecepcao) {
        if (n.operador) {
          const opNorm = n.operador.trim().toLowerCase();
          if (userNameNorm && (opNorm === userNameNorm || opNorm.includes(userNameNorm) || userNameNorm.includes(opNorm))) {
            return true;
          }
          // Se for de outro operador, vendedor não recebe (mesmo que seja targetGroup ALL)
          return false;
        }

        if (n.targetUser) {
          const tUserNorm = n.targetUser.trim().toLowerCase();
          if (userNameNorm && (tUserNorm === userNameNorm || tUserNorm.includes(userNameNorm) || userNameNorm.includes(tUserNorm))) {
            return true;
          }
          return false;
        }

        if (n.targetGroup === 'VENDEDOR' || n.targetGroup === 'ALL') return true;
        if (n.targetRoles && n.targetRoles.some((tr) => tr.toLowerCase().includes('vendedor') || tr.toLowerCase().includes('recep'))) return true;
        if (n.targetRole && (n.targetRole.toLowerCase().includes('vendedor') || n.targetRole.toLowerCase().includes('recep'))) return true;

        return (!n.targetUser && !n.targetGroup && !n.targetRole && !n.targetRoles);
      }

      // Broadcast global (todas as notificações de fluxo e sistema para a equipe restante)
      if (n.targetGroup === 'ALL' || (!n.targetUser && !n.targetGroup && !n.targetRole && !n.targetRoles && !n.operador)) {
        return true;
      }

      // 1. Notificação enviada especificamente para este usuário pelo nome
      if (n.targetUser) {
        const tUserNorm = n.targetUser.trim().toLowerCase();
        if (userNameNorm && (tUserNorm === userNameNorm || tUserNorm.includes(userNameNorm) || userNameNorm.includes(tUserNorm))) {
          return true;
        }
        if (!n.targetRoles && !n.targetGroup) {
          return false;
        }
      }

      // 2. Diretoria (CEO, Gerente Geral, Supervisor, Developer):
      if (isDiretoria) {
        return true;
      }

      // 4. Operador de Setor de Produção (Design, Impressão, Calandra, Costura, Conferência, Expedição)
      if (n.stage && userRoleNorm) {
        const stageNorm = n.stage.toLowerCase();
        if (userRoleNorm.includes(stageNorm) || stageNorm.includes(userRoleNorm)) {
          return true;
        }
      }

      if (n.targetRoles && n.targetRoles.some((tr) => userRoleNorm.includes(tr.toLowerCase()))) return true;
      if (n.targetRole && userRoleNorm.includes(n.targetRole.toLowerCase())) return true;

      return false;
    });

    // Mapeia o estado de leitura individual do usuário
    return filtered.map((n) => {
      if (userKeys.length === 0) return n;
      const isReadByUser = n.readByUsers?.some((r) => {
        const normR = r.toLowerCase().trim();
        return userKeys.some((uk) => uk === normR || normR.includes(uk) || uk.includes(normR));
      });
      return {
        ...n,
        unread: isReadByUser ? false : n.unread,
      };
    });
  }

  public static addNotification(
    notifData: Omit<AppNotification, 'id' | 'timestamp' | 'unread' | 'time'>
  ): AppNotification {
    const all = this.getAllNotifications();
    const newNotif: AppNotification = {
      ...notifData,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      time: formatTimestampBR(),
      timestamp: Date.now(),
      unread: true,
      readByUsers: [],
      clearedByUsers: [],
    };

    const updated = [newNotif, ...all].slice(0, 100); // Mantém as últimas 100 notificações
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('subligestao_new_notification', { detail: newNotif }));
        window.dispatchEvent(new Event('subligestao_notifications_changed'));
      }
    } catch {}

    return newNotif;
  }

  public static markAllAsRead(currentUser?: { id?: string; username?: string; name?: string; role?: string; isDeveloper?: boolean }): void {
    const userKeys = getUserIdentifiers(currentUser);
    const primaryKey = currentUser ? (currentUser.username || currentUser.id || currentUser.name || '') : '';
    const all = this.getAllNotifications();
    const userNotifs = this.getUserNotifications(currentUser);
    const userNotifIds = new Set(userNotifs.map((n) => n.id));

    const updated = all.map((n) => {
      if (userNotifIds.has(n.id)) {
        const existingRead = n.readByUsers || [];
        const keysToAdd = [primaryKey, ...userKeys].filter(Boolean);
        const newRead = Array.from(new Set([...existingRead, ...keysToAdd]));
        return { ...n, unread: false, readByUsers: newRead };
      }
      return n;
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('subligestao_notifications_changed'));
      }
    } catch {}
  }

  public static markAsRead(id: string, currentUser?: { id?: string; username?: string; name?: string }): void {
    const userKeys = getUserIdentifiers(currentUser);
    const primaryKey = currentUser ? (currentUser.username || currentUser.id || currentUser.name || '') : '';
    const all = this.getAllNotifications();
    const updated = all.map((n) => {
      if (n.id === id) {
        const existingRead = n.readByUsers || [];
        const keysToAdd = [primaryKey, ...userKeys].filter(Boolean);
        const newRead = Array.from(new Set([...existingRead, ...keysToAdd]));
        return { ...n, unread: false, readByUsers: newRead };
      }
      return n;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('subligestao_notifications_changed'));
      }
    } catch {}
  }

  /**
   * Limpa APENAS as notificações para o usuário logado que solicitou a limpeza.
   * As notificações continuam armazenadas e ativas para todos os demais usuários do sistema.
   */
  public static clearAllNotifications(currentUser?: { id?: string; username?: string; name?: string; role?: string; isDeveloper?: boolean }): void {
    if (!currentUser) return;
    const userKeys = getUserIdentifiers(currentUser);
    const primaryKey = (currentUser.username || currentUser.id || currentUser.name || '').trim();
    if (!primaryKey && userKeys.length === 0) return;

    const all = this.getAllNotifications();
    const userNotifs = this.getUserNotifications(currentUser);
    const userNotifIds = new Set(userNotifs.map((n) => n.id));

    const updated = all.map((n) => {
      if (userNotifIds.has(n.id)) {
        const existingCleared = n.clearedByUsers || [];
        const keysToAdd = [primaryKey, ...userKeys].filter(Boolean);
        const newCleared = Array.from(new Set([...existingCleared, ...keysToAdd]));
        return {
          ...n,
          clearedByUsers: newCleared,
        };
      }
      return n;
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('subligestao_notifications_changed'));
      }
    } catch {}
  }

  // Helpers específicos de eventos do Fluxo de Produção (1 ÚNICA NOTIFICAÇÃO POR AÇÃO)

  /**
   * 1. Vendedor cria uma OS -> 1 única notificação informando que a OS foi gerada e está pronta para a produção
   */
  public static notifyOsCreated(
    os: { id?: string; codigo: string; clienteNome?: string; operador?: string; fluxoProducao?: string[] },
    creatorName: string,
    targetSector?: string
  ): void {
    const operadorNome = os.operador || creatorName || 'Vendedor';
    const nextSector = targetSector || (os.fluxoProducao && os.fluxoProducao.length > 1 ? os.fluxoProducao[1] : 'Designer');
    const setorAviso = nextSector ? ` (encaminhada simultaneamente para a Conferência, Controle de Expedição e [${nextSector}])` : '';

    this.addNotification({
      title: `✨ Nova OS ${os.codigo}`,
      message: `A Ordem de Serviço ${os.codigo} foi gerada com sucesso por ${operadorNome}${setorAviso}.`,
      type: 'os_created',
      osId: os.id,
      osCodigo: os.codigo,
      clienteNome: os.clienteNome,
      operador: operadorNome,
      stage: nextSector,
      targetGroup: 'ALL',
    });
  }

  /**
   * 2. OS Atualizada/Editada -> 1 única notificação informando a atualização
   */
  public static notifyOsUpdated(
    os: { id?: string; codigo: string; clienteNome?: string; operador?: string },
    updatedBy: string
  ): void {
    const operadorNome = os.operador || updatedBy || 'Vendedor';

    this.addNotification({
      title: `📝 OS ${os.codigo} Atualizada`,
      message: `A OS ${os.codigo} (Vendedor: ${operadorNome}) teve seus dados atualizados por ${updatedBy}.`,
      type: 'os_created',
      osId: os.id,
      osCodigo: os.codigo,
      clienteNome: os.clienteNome,
      operador: operadorNome,
      targetGroup: 'ALL',
    });
  }

  /**
   * 3. Pagamento de OS no Caixa PDV (se chamado isoladamente)
   */
  public static notifyOsPaid(
    os: { id?: string; codigo: string; clienteNome?: string; operador?: string },
    formaPagamento: string,
    _valorTotal: number,
    operadorName: string
  ): void {
    const operadorNome = os.operador || operadorName || 'Vendedor';

    this.addNotification({
      title: `💰 Pagamento Confirmado: OS ${os.codigo}`,
      message: `Pagamento (${formaPagamento}) confirmado para a OS ${os.codigo} (Vendedor: ${operadorNome}) por ${operadorName}.`,
      type: 'financial',
      osId: os.id,
      osCodigo: os.codigo,
      clienteNome: os.clienteNome,
      operador: operadorNome,
      targetGroup: 'ALL',
    });
  }

  /**
   * 4. Venda Direta PDV Concluída -> 1 única notificação (sem exibir valores monetários)
   */
  public static notifyPdvSale(
    tx: { id?: string; osCodigo?: string; clienteNome?: string; valorTotal?: number; formaPagamento?: string },
    operadorName: string
  ): void {
    this.addNotification({
      title: `🛒 Venda Direta ${tx.osCodigo || 'PDV'}`,
      message: `Venda Direta ${tx.osCodigo || 'Balcão'} realizada com sucesso pelo operador ${operadorName}.`,
      type: 'financial',
      clienteNome: tx.clienteNome,
      operador: operadorName,
      targetGroup: 'ALL',
    });
  }

  /**
   * 5. Alguma etapa foi aceita -> 1 única notificação a todos informando quem aceitou
   */
  public static notifyOsStageAccepted(
    os: { id?: string; codigo: string; clienteNome?: string; operador?: string },
    stage: string,
    acceptedBy: string
  ): void {
    const operadorNome = os.operador || 'Vendedor';

    this.addNotification({
      title: `🔔 OS ${os.codigo} aceita em [${stage.toUpperCase()}]`,
      message: `A OS ${os.codigo} Vendedor: ${operadorNome} foi aceita no setor [${stage}] por ${acceptedBy}.`,
      type: 'os_accepted',
      osId: os.id,
      osCodigo: os.codigo,
      clienteNome: os.clienteNome,
      operador: operadorNome,
      stage,
      targetGroup: 'ALL',
    });
  }

  /**
   * 6. Alguma etapa avançou -> 1 única notificação a todos informando que a OS avançou para a próxima etapa para aguardar aceitação
   */
  public static notifyOsStageAdvanced(
    os: { id?: string; codigo: string; clienteNome?: string; operador?: string },
    fromStage: string,
    toStage: string,
    advancedBy: string
  ): void {
    if (toStage === 'Concluído' || toStage.toLowerCase().includes('conclu')) {
      this.notifyOsCompleted(os, advancedBy);
      return;
    }

    const operadorNome = os.operador || 'Vendedor';

    this.addNotification({
      title: `🚀 OS ${os.codigo} avançou para [${toStage.toUpperCase()}]`,
      message: `A OS ${os.codigo} (Vendedor: ${operadorNome}) avançou de [${fromStage}] para [${toStage}] por ${advancedBy} e aguarda aceitação.`,
      type: 'os_progression',
      osId: os.id,
      osCodigo: os.codigo,
      clienteNome: os.clienteNome,
      operador: operadorNome,
      stage: toStage,
      targetGroup: 'ALL',
    });
  }

  /**
   * 7. OS 100% Concluída -> 1 única notificação informando a finalização
   */
  public static notifyOsCompleted(
    os: { id?: string; codigo: string; clienteNome?: string; operador?: string },
    completedBy: string
  ): void {
    const operadorNome = os.operador || 'Vendedor';

    this.addNotification({
      title: `🎉 OS ${os.codigo} Concluída`,
      message: `A OS ${os.codigo} (Vendedor: ${operadorNome}) foi finalizada na expedição por ${completedBy} e está liberada para entrega.`,
      type: 'os_completed',
      osId: os.id,
      osCodigo: os.codigo,
      clienteNome: os.clienteNome,
      operador: operadorNome,
      stage: 'Concluído',
      targetGroup: 'ALL',
    });
  }

  /**
   * 8. Retrocesso no Kanban -> 1 única notificação informando o retrocesso
   */
  public static notifyOsRollback(
    os: { id?: string; codigo: string; clienteNome?: string; operador?: string },
    fromStage: string,
    toStage: string,
    rolledBackBy: string
  ): void {
    const operadorNome = os.operador || 'Vendedor';

    this.addNotification({
      title: `⏪ OS ${os.codigo} retornou para [${toStage.toUpperCase()}]`,
      message: `A OS ${os.codigo} (Vendedor: ${operadorNome}) retornou de [${fromStage}] para [${toStage}] por autorização de ${rolledBackBy}.`,
      type: 'os_rollback',
      osId: os.id,
      osCodigo: os.codigo,
      clienteNome: os.clienteNome,
      operador: operadorNome,
      stage: toStage,
      targetGroup: 'ALL',
    });
  }

  /**
   * 9. Conferência e Liberação Física de OS -> 1 única notificação informando a auditoria
   */
  public static notifyOsConferenced(
    os: { id?: string; codigo: string; clienteNome?: string; operador?: string },
    conferenteName: string
  ): void {
    const operadorNome = os.operador || 'Vendedor';

    this.addNotification({
      title: `📦 OS ${os.codigo} Conferida & Liberada`,
      message: `A conferência física e auditoria de saída da OS ${os.codigo} (Vendedor: ${operadorNome}) foi aprovada por ${conferenteName}.`,
      type: 'os_accepted',
      osId: os.id,
      osCodigo: os.codigo,
      clienteNome: os.clienteNome,
      operador: operadorNome,
      stage: 'Conferência',
      targetGroup: 'ALL',
    });
  }

  /**
   * 10. Conferência NÃO Aprovada -> Alerta imediato ao Vendedor/Sistema e equipe com o relato do conferente
   */
  public static notifyOsConferenceRejected(
    os: { id?: string; codigo: string; clienteNome?: string; operador?: string; vendedor?: string; vendedorNome?: string },
    conferenteName: string,
    motivoRelato: string
  ): void {
    const operadorNome = os.operador || os.vendedor || os.vendedorNome || 'Vendedor';

    this.addNotification({
      title: `❌ OS ${os.codigo} NÃO Aprovada na Conferência`,
      message: `A OS ${os.codigo} (Vendedor: ${operadorNome} • Cliente: ${os.clienteNome || 'Geral'}) não foi aprovada na conferência por ${conferenteName} e retornou para o vendedor (sistema).\n\n📝 Relato do Conferente:\n"${motivoRelato}"`,
      type: 'os_rejected',
      osId: os.id,
      osCodigo: os.codigo,
      clienteNome: os.clienteNome,
      operador: operadorNome,
      targetUser: operadorNome,
      stage: 'Sistema',
      authorName: conferenteName,
      rejectionReason: motivoRelato,
      targetGroup: 'ALL',
    });
  }
}

