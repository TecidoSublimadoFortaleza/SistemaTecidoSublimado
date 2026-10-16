/**
 * ERP SubliGestão - Utilitários de Data e Horário para Status de Presença no Chat
 */

/**
 * Formata o texto completo do status offline com o tempo decorrido do último acesso.
 * Exemplo de retorno: "offline: último acesso a 5 minutos"
 */
export function formatOfflineLastSeen(lastSeen?: string | number | Date | null): string {
  if (!lastSeen) {
    return 'offline';
  }

  const date = new Date(lastSeen);
  if (isNaN(date.getTime())) {
    return 'offline';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Caso o timestamp seja muito recente ou haja pequena variação de relógio
  if (diffMs < 60 * 1000) {
    return `offline • visto às ${timeStr} (agora)`;
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) {
    return `offline • visto às ${timeStr} (há ${diffMinutes} min)`;
  }

  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) {
    const isSameDay =
      now.getDate() === date.getDate() &&
      now.getMonth() === date.getMonth() &&
      now.getFullYear() === date.getFullYear();

    if (isSameDay) {
      return `offline • visto hoje às ${timeStr}`;
    }
    return `offline • visto ontem às ${timeStr}`;
  }

  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 1) {
    return `offline • visto ontem às ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `offline • visto em ${dateStr} às ${timeStr}`;
}

/**
 * Versão concisa para crachás ou selos com pouco espaço.
 * Exemplo: "às 15:30", "ontem 18:20", "22/09 14:15"
 */
export function formatOfflineLastSeenShort(lastSeen?: string | number | Date | null): string {
  if (!lastSeen) return 'offline';

  const date = new Date(lastSeen);
  if (isNaN(date.getTime())) return 'offline';

  const now = new Date();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isSameDay =
    now.getDate() === date.getDate() &&
    now.getMonth() === date.getMonth() &&
    now.getFullYear() === date.getFullYear();

  if (isSameDay) {
    return `às ${timeStr}`;
  }

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 1) {
    return `ontem ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${dateStr} ${timeStr}`;
}

/**
 * Formata o tempo decorrido em que o colaborador está no status ausente.
 * Exemplo de retorno: "ausente há 15 min", "ausente há menos de 1 min", "ausente há 1 hora e 20 min"
 */
export function formatAwayDuration(awaySince?: string | number | Date | null): string {
  if (!awaySince) {
    return 'ausente';
  }

  const date = new Date(awaySince);
  if (isNaN(date.getTime())) {
    return 'ausente';
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());

  if (diffMs < 60 * 1000) {
    return 'ausente há menos de 1 min';
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) {
    return `ausente há ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const minRemainder = diffMinutes % 60;
  if (diffHours < 24) {
    if (minRemainder > 0) {
      return `ausente há ${diffHours}h e ${minRemainder} min`;
    }
    return `ausente há ${diffHours}h`;
  }

  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return `ausente há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
}

/**
 * Versão concisa para crachás ou selos do status ausente.
 * Exemplo: "há 15 min", "< 1 min", "há 2h", "há 1d"
 */
export function formatAwayDurationShort(awaySince?: string | number | Date | null): string {
  if (!awaySince) return 'ausente';

  const date = new Date(awaySince);
  if (isNaN(date.getTime())) return 'ausente';

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());

  if (diffMs < 60 * 1000) {
    return '< 1 min';
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) {
    return `há ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) {
    const minRemainder = diffMinutes % 60;
    if (minRemainder > 0 && diffHours < 10) {
      return `há ${diffHours}h${minRemainder}m`;
    }
    return `há ${diffHours}h`;
  }

  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return `há ${diffDays}d`;
}

