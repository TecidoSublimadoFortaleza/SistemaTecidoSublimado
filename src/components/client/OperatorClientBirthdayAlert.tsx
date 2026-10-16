import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Cake, X, MessageCircle, GripHorizontal, Minus, Check } from 'lucide-react';
import { UserProfile } from '../../types/frontend';
import { ApiService } from '../../services/api';
import { Client } from '../../server/types/client';
import { Employee } from '../../server/types/employee';
import { getLoggedUserAndPerfil } from '../../utils/userPermissions';

const MONTH_NAMES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function buildClientBirthdayMessage(clientName?: string): string {
  const name = clientName && clientName.trim() ? clientName.trim() : 'cliente';
  return `Olá ${name}, a equipe da Tecido Sublimado Fortaleza e eu desejamos a você um Feliz Aniversário! 🎉

Que este novo ciclo seja repleto de saúde, felicidade, sucesso e muitas realizações. Que não faltem motivos para sorrir, conquistar seus objetivos e celebrar cada nova vitória.

Parabéns e muitas felicidades! 🥳🎂`;
}

export const TECIDO_SUBLIMADO_BIRTHDAY_MESSAGE = buildClientBirthdayMessage();

export interface OperatorClientBirthdayItem {
  id: string;
  codigo: string;
  nome: string;
  documento: string;
  type: string;
  fotoUrl?: string;
  telefone?: string;
  email?: string;
  operador?: string;
  createdBy?: string;
  updatedBy?: string;
  dataNascimento: string;
  dia: number;
  mes: number;
  idade?: number;
  diasRestantes: number;
  isHoje: boolean;
  isPrestesAFazer: boolean;
  dataFormatada: string;
}

export interface EmployeeBirthdayItem {
  id: string;
  nome: string;
  sobrenome?: string;
  fotoUrl?: string;
  cargo: string;
  setor?: string;
  filialNome?: string;
  dataNascimento: string;
  dia: number;
  mes: number;
  idade?: number;
  diasRestantes: number;
  isHoje: boolean;
  isPrestesAFazer: boolean;
  dataFormatada: string;
}

/**
 * Check if the given client was registered or operated by the specified user
 */
export function isClientOperatedByUser(
  client: any,
  username?: string,
  name?: string
): boolean {
  if (!client) return false;

  const logged = getLoggedUserAndPerfil();
  const searchTokens = [
    username,
    name,
    logged.username,
    logged.name,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());

  if (searchTokens.length === 0) return false;

  const clientTokens = [
    client.operador,
    client.createdBy,
    client.updatedBy,
    client.vendedorNome,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());

  if (clientTokens.length === 0) return false;

  return clientTokens.some((target) =>
    searchTokens.some((term) => {
      if (!term || !target) return false;
      return target === term || target.includes(term) || term.includes(target);
    })
  );
}

export function parseOperatorClientBirthdays(
  clients: Client[],
  username?: string,
  name?: string,
  referenceDate: Date = new Date(),
  isDeveloper: boolean = false,
  isSupervisorOrLeadership: boolean = false
): OperatorClientBirthdayItem[] {
  const currentDay = referenceDate.getDate();
  const currentMonth = referenceDate.getMonth() + 1; // 1-12
  const currentYear = referenceDate.getFullYear();

  const results: OperatorClientBirthdayItem[] = [];

  clients.forEach((client) => {
    if (client.status === 'INACTIVE') return;

    // Se for Supervisor, Gerente Geral, Diretoria, CEO ou Developer: permite visualizar os aniversariantes do dia de toda a empresa!
    // Para operadores individuais (ex: Vendedor(a), Atendimento): filtra estritamente os clientes operados/cadastrados por ele.
    if (!isSupervisorOrLeadership && !isDeveloper) {
      const isOwner = isClientOperatedByUser(client, username, name);
      if (!isOwner) {
        return;
      }
    }

    const raw = String(client.dataNascimento || client.dataFundacao || '').trim();
    if (!raw) return;

    let day = 0;
    let month = 0;
    let year = 0;

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const parts = raw.split('T')[0].split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(raw)) {
      const parts = raw.split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
    } else if (/^\d{1,2}-\d{1,2}-\d{2,4}/.test(raw)) {
      const parts = raw.split('-');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
    } else {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        day = d.getUTCDate ? d.getUTCDate() : d.getDate();
        month = (d.getUTCMonth ? d.getUTCMonth() : d.getMonth()) + 1;
        year = d.getFullYear();
      }
    }

    // O Alerta de Aniversário de Cliente deve aparecer no dia do aniversário
    if (day === currentDay && month === currentMonth) {
      const diasRestantes = 0;
      const isHoje = true;
      const isPrestesAFazer = false;
      const idade = year > 1900 && year <= currentYear ? currentYear - year : undefined;

      const mesNome = MONTH_NAMES_FULL[month - 1] || '';
      const dataFormatada = `${String(day).padStart(2, '0')} de ${mesNome}`;

      const displayName = client.type === 'PJ'
        ? (client.nomeFantasia || client.razaoSocial || client.nome || 'Cliente PJ')
        : (client.nome || 'Cliente PF');

      const documento = client.type === 'PJ'
        ? (client.cnpj || '-')
        : (client.cpf || '-');

      results.push({
        id: client.id || `${displayName}-${day}`,
        codigo: client.codigo || '-',
        nome: displayName,
        documento,
        type: client.type || 'PF',
        fotoUrl: client.fotoUrl,
        telefone: client.telefone,
        email: client.email,
        operador: client.operador,
        createdBy: client.createdBy,
        updatedBy: client.updatedBy,
        dataNascimento: raw,
        dia: day,
        mes: month,
        idade,
        diasRestantes,
        isHoje,
        isPrestesAFazer,
        dataFormatada,
      });
    }
  });

  return results.sort((a, b) => a.dia - b.dia);
}

export function parseEmployeeBirthdaysLocal(
  employees: Employee[],
  referenceDate: Date = new Date()
): EmployeeBirthdayItem[] {
  const currentDay = referenceDate.getDate();
  const currentMonth = referenceDate.getMonth() + 1; // 1-12
  const currentYear = referenceDate.getFullYear();

  const results: EmployeeBirthdayItem[] = [];

  employees.forEach((emp) => {
    if (!emp.dataNascimento) return;
    const raw = String(emp.dataNascimento).trim();
    if (!raw) return;

    let day = 0;
    let month = 0;
    let year = 0;

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const parts = raw.split('T')[0].split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(raw)) {
      const parts = raw.split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
    } else if (/^\d{1,2}-\d{1,2}-\d{2,4}/.test(raw)) {
      const parts = raw.split('-');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
    } else {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        day = d.getUTCDate ? d.getUTCDate() : d.getDate();
        month = (d.getUTCMonth ? d.getUTCMonth() : d.getMonth()) + 1;
        year = d.getFullYear();
      }
    }

    if (day > 0 && month === currentMonth) {
      const diasRestantes = day - currentDay;
      const isHoje = diasRestantes === 0;
      const isPrestesAFazer = diasRestantes === 1 || diasRestantes === 2;
      const idade = year > 1900 && year <= currentYear ? currentYear - year : undefined;

      const mesNome = MONTH_NAMES_FULL[month - 1] || '';
      const dataFormatada = `${String(day).padStart(2, '0')} de ${mesNome}`;

      results.push({
        id: emp.id || `${emp.nome}-${day}`,
        nome: emp.nome,
        sobrenome: emp.sobrenome || '',
        fotoUrl: emp.fotoUrl,
        cargo: emp.cargo || 'Colaborador',
        setor: emp.setor || 'Geral',
        filialNome: emp.filialNome || 'Matriz',
        dataNascimento: raw,
        dia: day,
        mes: month,
        idade,
        diasRestantes,
        isHoje,
        isPrestesAFazer,
        dataFormatada,
      });
    }
  });

  return results.sort((a, b) => a.dia - b.dia);
}

interface OperatorClientBirthdayAlertProps {
  user?: UserProfile | null;
}

export const OperatorClientBirthdayAlert: React.FC<OperatorClientBirthdayAlertProps> = ({ user }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Dismissed item tracking (persisted for the session/day)
  const [dismissedClientIds, setDismissedClientIds] = useState<string[]>([]);
  const [dismissedEmployeeAlert, setDismissedEmployeeAlert] = useState<boolean>(false);

  // WhatsApp interaction tracking (1st click opens WhatsApp; subsequent clicks show alert with options)
  const [openedWhatsappClientIds, setOpenedWhatsappClientIds] = useState<string[]>([]);
  const [confirmingClientId, setConfirmingClientId] = useState<string | null>(null);

  const logged = getLoggedUserAndPerfil();
  const currentUsername = user?.username || logged.username || '';
  const currentName = user?.name || logged.name || '';
  const userRole = (user?.role || logged.role || '').trim();
  const isDev = logged.isDeveloper || user?.isDeveloper || false;

  const isSupervisor = useMemo(() => {
    const r = (userRole || user?.role || logged.role || '').toLowerCase();
    return r === 'supervisor' || r.includes('supervisor');
  }, [userRole, user, logged]);

  const isSupervisorOrLeadership = useMemo(() => {
    const r = (userRole || user?.role || logged.role || '').toLowerCase();
    return Boolean(
      isDev ||
      isSupervisor ||
      r === 'supervisor' ||
      r === 'ceo' ||
      r === 'gerente geral' ||
      r === 'adm master' ||
      r.includes('supervisor') ||
      r.includes('gerente') ||
      r.includes('diretor') ||
      r.includes('ceo') ||
      r.includes('administra')
    );
  }, [isDev, isSupervisor, userRole, user, logged]);

  const isDiretoriaOuAdministracao = useMemo(() => {
    return Boolean(
      isDev ||
      userRole === 'CEO' ||
      userRole === 'Supervisor' ||
      userRole === 'Gerente Geral' ||
      userRole === 'Administração' ||
      userRole === 'Administrativo' ||
      userRole === 'Expedição' ||
      userRole?.toLowerCase().includes('diretor') ||
      userRole?.toLowerCase().includes('administra') ||
      userRole?.toLowerCase().includes('gerente') ||
      userRole?.toLowerCase().includes('supervisor') ||
      userRole?.toLowerCase().includes('expedição') ||
      userRole?.toLowerCase().includes('expedicao') ||
      userRole?.toLowerCase().includes('ceo')
    );
  }, [isDev, userRole]);

  const dateToken = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const employeeStorageKey = useMemo(() => {
    return `subligestao_dismissed_emp_bday_${currentUsername || 'user'}_${dateToken}`;
  }, [currentUsername, dateToken]);

  const clientStorageKey = useMemo(() => {
    return `subligestao_dismissed_cli_bday_${currentUsername || 'user'}_${dateToken}`;
  }, [currentUsername, dateToken]);

  const openedWhatsappStorageKey = useMemo(() => {
    return `subligestao_opened_cli_whatsapp_${currentUsername || 'user'}_${dateToken}`;
  }, [currentUsername, dateToken]);

  // Load dismissed and opened states from sessionStorage
  useEffect(() => {
    try {
      if (sessionStorage.getItem(employeeStorageKey) === 'true') {
        setDismissedEmployeeAlert(true);
      }
      const rawCli = sessionStorage.getItem(clientStorageKey);
      if (rawCli) {
        setDismissedClientIds(JSON.parse(rawCli));
      }
      const rawOpened = sessionStorage.getItem(openedWhatsappStorageKey);
      if (rawOpened) {
        setOpenedWhatsappClientIds(JSON.parse(rawOpened));
      }
    } catch (_) {}
  }, [employeeStorageKey, clientStorageKey, openedWhatsappStorageKey]);

  // Load clients and employees
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [clientsData, employeesData] = await Promise.all([
          ApiService.getClients().catch(() => []),
          ApiService.getEmployees().catch(() => []),
        ]);
        if (isMounted) {
          if (Array.isArray(clientsData)) setClients(clientsData);
          if (Array.isArray(employeesData)) setEmployees(employeesData);
        }
      } catch (_) {}
    };

    loadData();

    const handleSync = () => loadData();
    window.addEventListener('subligestao_client_saved', handleSync);
    window.addEventListener('subligestao_sync_completed', handleSync);
    window.addEventListener('employee-changed', handleSync);

    const interval = setInterval(loadData, 60000);

    return () => {
      isMounted = false;
      window.removeEventListener('subligestao_client_saved', handleSync);
      window.removeEventListener('subligestao_sync_completed', handleSync);
      window.removeEventListener('employee-changed', handleSync);
      clearInterval(interval);
    };
  }, []);

  // Compute Upcoming Employee Birthdays (0 to 2 days)
  const upcomingEmployeeBirthdays = useMemo(() => {
    if (!isDiretoriaOuAdministracao) return [];
    const parsed = parseEmployeeBirthdaysLocal(employees, new Date());
    return parsed.filter((b) => b.diasRestantes >= 0 && b.diasRestantes <= 2);
  }, [employees, isDiretoriaOuAdministracao]);

  // Compute Operator Client Birthdays (today)
  const operatorClientBirthdays = useMemo(() => {
    return parseOperatorClientBirthdays(
      clients,
      currentUsername,
      currentName,
      new Date(),
      isDev,
      isSupervisorOrLeadership
    );
  }, [clients, currentUsername, currentName, isDev, isSupervisorOrLeadership]);

  // Active / Visible items (not dismissed)
  const hasVisibleEmployeeAlert = upcomingEmployeeBirthdays.length > 0 && !dismissedEmployeeAlert;

  const visibleClientBirthdays = useMemo(() => {
    return operatorClientBirthdays.filter((c) => !dismissedClientIds.includes(c.id));
  }, [operatorClientBirthdays, dismissedClientIds]);

  // Dismiss Employee Alert
  const handleDismissEmployee = () => {
    setDismissedEmployeeAlert(true);
    try {
      sessionStorage.setItem(employeeStorageKey, 'true');
    } catch (_) {}
  };

  // Dismiss Individual Client Card (smooth cascade shift)
  const handleDismissClient = (clientId: string) => {
    if (confirmingClientId === clientId) {
      setConfirmingClientId(null);
    }
    setDismissedClientIds((prev) => {
      const updated = [...prev, clientId];
      try {
        sessionStorage.setItem(clientStorageKey, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
  // Fluxo de parabenizar cliente:
  // 1º clique: abre a aba do WhatsApp diretamente
  // Cliques seguintes: exibe o alerta com opções "Já enviei a mensagem para o cliente" e "Parabenizar"
  // "Já enviei a mensagem para o cliente": fecha a caixa desse aniversariante (sem minimizar)
  const handleClientParabenizar = (clientId: string, whatsappUrl: string | null) => {
    if (!whatsappUrl) return;

    const alreadyOpened = openedWhatsappClientIds.includes(clientId);

    if (!alreadyOpened) {
      // 1ª vez: abre diretamente a aba do WhatsApp
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      setOpenedWhatsappClientIds((prev) => {
        const next = [...prev, clientId];
        try {
          sessionStorage.setItem(openedWhatsappStorageKey, JSON.stringify(next));
        } catch (_) {}
        return next;
      });
    } else {
      // Clicado novamente: exibe o alerta de confirmação
      setConfirmingClientId(clientId);
    }
  };

  const handleMarkMessageSent = (clientId: string) => {
    setConfirmingClientId(null);
    handleDismissClient(clientId);
  };

  const handleReopenWhatsapp = (whatsappUrl: string | null) => {
    if (whatsappUrl) {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Restore all dismissed alerts
  const handleRestoreAll = () => {
    setDismissedEmployeeAlert(false);
    setDismissedClientIds([]);
    setConfirmingClientId(null);
    try {
      sessionStorage.removeItem(employeeStorageKey);
      sessionStorage.removeItem(clientStorageKey);
    } catch (_) {}
  };

  // Draggable position state (movimentável e flexível pelo usuário - DECLARADO ANTES DE QUALQUER RETURN)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = sessionStorage.getItem('subligestao_birthday_alert_position');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return { x: 0, y: 0 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  const hasMovedRef = useRef(false);

  const handleStartDrag = (e: React.MouseEvent | React.TouchEvent, allowFromButton: boolean = false) => {
    const target = e.target as HTMLElement;
    if (!allowFromButton && (target.closest('button') || target.closest('a') || target.closest('input'))) {
      return;
    }

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    dragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: position.x,
      initialY: position.y,
    };
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - dragRef.current.startX;
      const deltaY = clientY - dragRef.current.startY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        hasMovedRef.current = true;
      }

      const newX = dragRef.current.initialX + deltaX;
      const newY = dragRef.current.initialY + deltaY;

      // Keep box on screen
      const minX = -window.innerWidth + 120;
      const maxX = 60;
      const minY = -window.innerHeight + 100;
      const maxY = 60;

      setPosition({
        x: Math.min(maxX, Math.max(minX, newX)),
        y: Math.min(maxY, Math.max(minY, newY)),
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      try {
        sessionStorage.setItem('subligestao_birthday_alert_position', JSON.stringify(position));
      } catch (_) {}
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, position]);

  const handleResetPosition = () => {
    setPosition({ x: 0, y: 0 });
    try {
      sessionStorage.removeItem('subligestao_birthday_alert_position');
    } catch (_) {}
  };

  // Minimized state: enables minimizing the card right in place
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('subligestao_birthday_alert_minimized') === 'true';
    } catch (_) {
      return false;
    }
  });

  const toggleMinimize = (val?: boolean) => {
    setIsMinimized((prev) => {
      const next = typeof val === 'boolean' ? val : !prev;
      try {
        sessionStorage.setItem('subligestao_birthday_alert_minimized', String(next));
      } catch (_) {}
      return next;
    });
  };

  const hasAnyBirthdayToday = upcomingEmployeeBirthdays.length > 0 || operatorClientBirthdays.length > 0;
  const isEverythingDismissed = !hasVisibleEmployeeAlert && visibleClientBirthdays.length === 0;

  // Se minimizado pelo usuário (e ainda houver aniversariantes não dispensados), exibe botão compacto
  // Se fechado (todas as caixas dispensadas e não minimizado), a caixa simplesmente se fecha completamente!
  if (hasAnyBirthdayToday && isMinimized && !isEverythingDismissed) {
    const totalCount = upcomingEmployeeBirthdays.length + operatorClientBirthdays.length;
    return (
      <div
        id="unified-birthday-alerts-stack-minimized"
        className="fixed bottom-[85px] sm:bottom-[75px] right-3 sm:right-5 z-50 pointer-events-none"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition: isDragging ? 'none' : 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          id="reopen-birthday-alerts-stack"
          onMouseDown={(e) => handleStartDrag(e, true)}
          onTouchStart={(e) => handleStartDrag(e, true)}
          onDoubleClick={handleResetPosition}
          onClick={() => {
            if (hasMovedRef.current) return;
            if (isMinimized) toggleMinimize(false);
            if (isEverythingDismissed) handleRestoreAll();
          }}
          className="pointer-events-auto bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 hover:scale-105 active:scale-95 text-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-xl border border-white/40 text-[9px] sm:text-xs font-black flex items-center gap-1.5 transition-all cursor-grab active:cursor-grabbing select-none"
          title="Arraste para movimentar • Clique para abrir • Duplo clique para restaurar posição"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-300"></span>
          </span>
          <Cake className="w-3.5 h-3.5 text-white" />
          <span>{totalCount} Aniversariante{totalCount > 1 ? 's' : ''}</span>
          <GripHorizontal className="w-3 h-3 text-white/60 ml-0.5" />
        </div>
      </div>
    );
  }

  if (!hasVisibleEmployeeAlert && visibleClientBirthdays.length === 0) {
    return null;
  }

  // Common card dimensions and measurements to guarantee 100% identical size
  const cardBaseStyle = "w-[260px] sm:w-[360px] max-w-[calc(100vw-24px)] rounded-lg sm:rounded-xl shadow-xl py-0.5 px-2 sm:py-1.5 sm:px-3 backdrop-blur-md transition-all duration-300 pointer-events-auto border";

  // Limit client cards stacked simultaneously in cascade to 3
  const displayedClientCards = visibleClientBirthdays.slice(0, 3);

  return (
    <div
      id="unified-birthday-alerts-stack"
      className="fixed bottom-[85px] sm:bottom-[75px] right-3 sm:right-5 z-50 flex flex-col-reverse gap-2 items-end pointer-events-none"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        transition: isDragging ? 'none' : 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ==============================================================
          1. PRIMEIRO DE BAIXO PARA CIMA: ALERTA DE ANIVERSÁRIO (COLABORADORES / RH)
          Sempre posicionado na base inferior
         ============================================================== */}
      {hasVisibleEmployeeAlert && (
        <div
          id="floating-employee-birthday-alert"
          className={`${cardBaseStyle} bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white shadow-orange-600/30 border-amber-300/80 animate-in fade-in slide-in-from-bottom-2`}
        >
          {/* HEADER (ARRASTÁVEL / MOVIMENTÁVEL) */}
          <div
            onMouseDown={handleStartDrag}
            onTouchStart={handleStartDrag}
            onDoubleClick={handleResetPosition}
            className="flex items-center justify-between gap-1.5 pb-0.5 sm:pb-1 border-b border-white/20 cursor-grab active:cursor-grabbing select-none group"
            title="Segure e arraste para movimentar • Duplo clique para restaurar posição"
          >
            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
              <span className="p-0.5 bg-white/20 rounded-md shrink-0">
                <Cake className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
              </span>
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <h4 className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-white truncate">
                  ALERTA DE ANIVERSÁRIO
                </h4>
                <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-amber-200"></span>
                </span>
                <span className="text-[8px] sm:text-[9px] text-amber-100/90 font-medium hidden md:inline">
                  • RH
                </span>
                <GripHorizontal className="w-3 h-3 text-white/50 group-hover:text-white/90 shrink-0 ml-0.5" />
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => toggleMinimize(true)}
                className="p-0.5 text-white/80 hover:text-white hover:bg-white/20 rounded transition cursor-pointer shrink-0"
                title="Minimizar alerta neste local"
              >
                <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDismissEmployee}
                className="p-0.5 text-white/80 hover:text-white hover:bg-white/20 rounded transition cursor-pointer shrink-0"
                title="Fechar alerta de colaboradores"
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          </div>

          {/* LISTA DE COLABORADORES */}
          <div className="mt-0.5 sm:mt-1 space-y-0.5 sm:space-y-1 max-h-16 sm:max-h-24 overflow-y-auto pr-0.5">
            {upcomingEmployeeBirthdays.map((bday) => {
              const fullName = [bday.nome, bday.sobrenome].filter(Boolean).join(' ').trim();
              const bdayFullName = fullName.toLowerCase();
              const userFullName = (user?.name || '').trim().toLowerCase();
              const isLoggedUserBday = Boolean(
                (user?.id && bday.id && String(user.id).toLowerCase() === String(bday.id).toLowerCase()) ||
                (userFullName && bdayFullName && (userFullName === bdayFullName || userFullName.includes(bdayFullName) || bdayFullName.includes(userFullName))) ||
                (user?.username && bday.id && String(user.username).toLowerCase() === String(bday.id).toLowerCase())
              );

              let badgeLabel = '';
              if (bday.diasRestantes === 0) {
                badgeLabel = isLoggedUserBday ? 'PARABÉNS' : 'É HOJE!';
              } else if (bday.diasRestantes === 1) {
                badgeLabel = 'FALTA 1 DIA';
              } else if (bday.diasRestantes === 2) {
                badgeLabel = 'FALTAM 2 DIAS';
              } else {
                badgeLabel = `EM ${bday.diasRestantes} DIAS`;
              }

              const displayName = bday.diasRestantes === 0 ? `${fullName} 🎉` : fullName;

              return (
                <div
                  key={bday.id}
                  className="p-0.5 sm:p-1 bg-black/15 hover:bg-black/25 rounded sm:rounded-lg border border-white/20 flex items-center justify-between gap-1 sm:gap-2 transition"
                >
                  <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                    {bday.fotoUrl ? (
                      <img
                        src={bday.fotoUrl}
                        alt={bday.nome}
                        className="w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full object-cover border border-white/40 shrink-0"
                      />
                    ) : (
                      <div className="w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full bg-white/20 text-white font-black text-[7px] sm:text-[9px] flex items-center justify-center shrink-0 border border-white/30">
                        {bday.nome.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p
                        className="text-[8.5px] sm:text-[11px] font-bold text-white truncate leading-none"
                        title={`${fullName} - ${bday.cargo || ''} (${badgeLabel})`}
                      >
                        <span>{displayName}</span>
                        {bday.cargo && (
                          <span className="font-normal text-amber-100 text-[8px] sm:hidden ml-1">
                            • {bday.cargo}
                          </span>
                        )}
                      </p>
                      <p className="text-[7.5px] sm:text-[9px] text-amber-100 font-medium truncate leading-none mt-0.5 hidden sm:block">
                        {bday.cargo} • {bday.filialNome} ({bday.dataFormatada})
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 px-1 py-0.2 sm:px-1.5 sm:py-0.5 bg-amber-400 text-amber-950 text-[7.5px] sm:text-[9px] font-black rounded uppercase tracking-tight animate-pulse shadow-xs">
                    {badgeLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==============================================================
          2. DEPOIS PARA CIMA: ALERTA DE ANIVERSÁRIO DO CLIENTE
          Efeito cascata para cima. Se fechar um, o outro assume a posição!
         ============================================================== */}
      {displayedClientCards.map((bday, idx) => {
        const cleanPhone = (bday.telefone || '').replace(/\D/g, '');
        const whatsappUrl = cleanPhone
          ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
              buildClientBirthdayMessage(bday.nome)
            )}`
          : null;

        return (
          <div
            key={bday.id}
            id={`floating-client-birthday-alert-${bday.id}`}
            className={`${cardBaseStyle} bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white shadow-indigo-950/40 border-blue-400/80 animate-in fade-in slide-in-from-bottom-2`}
          >
            {/* HEADER COM AS MESMAS MEDIDAS BASE (ARRASTÁVEL / MOVIMENTÁVEL) */}
            <div
              onMouseDown={handleStartDrag}
              onTouchStart={handleStartDrag}
              onDoubleClick={handleResetPosition}
              className="flex items-center justify-between gap-1.5 pb-0.5 sm:pb-1 border-b border-white/20 cursor-grab active:cursor-grabbing select-none group"
              title="Segure e arraste para movimentar • Duplo clique para restaurar posição"
            >
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <span className="p-0.5 bg-white/20 rounded-md shrink-0">
                  <Cake className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </span>
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                  <h4 className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-white truncate">
                    ALERTA DE ANIVERSÁRIO
                  </h4>
                  <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-300"></span>
                  </span>
                  <span className="text-[8px] sm:text-[9px] text-blue-100/90 font-medium hidden md:inline">
                    • CLIENTE{visibleClientBirthdays.length > 1 ? ` (${idx + 1}/${visibleClientBirthdays.length})` : ''}
                  </span>
                  <GripHorizontal className="w-3 h-3 text-white/50 group-hover:text-white/90 shrink-0 ml-0.5" />
                </div>
              </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => toggleMinimize(true)}
                className="p-0.5 text-white/80 hover:text-white hover:bg-white/20 rounded transition cursor-pointer shrink-0"
                title="Minimizar alerta neste local"
              >
                <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDismissClient(bday.id)}
                className="p-0.5 text-white/80 hover:text-white hover:bg-white/20 rounded transition cursor-pointer shrink-0"
                title="Fechar este aniversariante"
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          </div>

            {/* CONTEÚDO DO CLIENTE */}
            <div className="mt-0.5 sm:mt-1 p-0.5 sm:p-1 bg-black/15 hover:bg-black/25 rounded sm:rounded-lg border border-white/20 flex items-center justify-between gap-1 sm:gap-2 transition">
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
                {bday.fotoUrl ? (
                  <img
                    src={bday.fotoUrl}
                    alt={bday.nome}
                    className="w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full object-cover border border-white/40 shrink-0"
                  />
                ) : (
                  <div className="w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full bg-white/20 text-white font-black text-[7px] sm:text-[9px] flex items-center justify-center shrink-0 border border-white/30">
                    {bday.nome.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[8.5px] sm:text-[11px] font-bold text-white truncate leading-none"
                    title={`${bday.nome} (Cód: ${bday.codigo})`}
                  >
                    <span>{bday.nome} 🎉</span>
                  </p>
                  <p className="text-[7.5px] sm:text-[9px] text-blue-100 font-medium truncate leading-none mt-0.5">
                    Cód: <strong className="text-white">{bday.codigo}</strong>
                    {bday.idade ? ` • ${bday.idade} anos` : ''}
                    {bday.documento && bday.documento !== '-' ? ` • Doc: ${bday.documento}` : ''}
                  </p>
                </div>
              </div>

              {/* AÇÕES: BADGE É HOJE + WHATSAPP */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="shrink-0 px-1 py-0.2 sm:px-1.5 sm:py-0.5 bg-amber-400 text-amber-950 text-[7.5px] sm:text-[9px] font-black rounded uppercase tracking-tight animate-pulse shadow-xs">
                  É HOJE!
                </span>

                {whatsappUrl ? (
                  <button
                    type="button"
                    onClick={() => handleClientParabenizar(bday.id, whatsappUrl)}
                    className={`inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-0.5 sm:px-2 sm:py-0.5 text-white font-bold text-[7.5px] sm:text-[9px] rounded transition shadow-xs shrink-0 hover:scale-105 cursor-pointer ${
                      openedWhatsappClientIds.includes(bday.id)
                        ? 'bg-emerald-600 hover:bg-emerald-700 ring-1 ring-white/50'
                        : 'bg-emerald-500 hover:bg-emerald-600'
                    }`}
                    title={
                      openedWhatsappClientIds.includes(bday.id)
                        ? 'Você já abriu o WhatsApp. Clique novamente para opções de envio'
                        : 'Enviar mensagem de parabéns pelo WhatsApp'
                    }
                  >
                    <MessageCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span>Parabenizar</span>
                    {openedWhatsappClientIds.includes(bday.id) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse ml-0.5" />
                    )}
                  </button>
                ) : bday.telefone ? (
                  <span className="text-[8px] text-white/90 font-mono hidden sm:inline">
                    {bday.telefone}
                  </span>
                ) : null}
              </div>
            </div>

            {/* ALERTA QUANDO CLICADO NOVAMENTE: "Já enviei a mensagem para o cliente" e "Parabenizar" */}
            {confirmingClientId === bday.id && (
              <div
                id={`alert-confirm-bday-${bday.id}`}
                className="mt-1 sm:mt-1.5 p-1.5 sm:p-2 bg-slate-950/90 backdrop-blur-md rounded-md sm:rounded-lg border border-emerald-400/80 shadow-lg animate-in fade-in slide-in-from-top-1 text-white"
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <span className="text-[8px] sm:text-[9.5px] font-black text-emerald-300 uppercase tracking-wide truncate">
                      WhatsApp já aberto para {bday.nome.split(' ')[0]}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmingClientId(null)}
                    className="text-white/60 hover:text-white p-0.5 rounded text-[9px] leading-none cursor-pointer"
                    title="Fechar este alerta"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-col gap-1 sm:gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => handleMarkMessageSent(bday.id)}
                    className="w-full py-1 sm:py-1.5 px-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-black text-[11px] sm:text-[12.5px] rounded transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer leading-tight text-center"
                    title="Fechar caixa deste aniversariante"
                  >
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Já enviei a mensagem para o cliente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReopenWhatsapp(whatsappUrl)}
                    className="w-full py-1 sm:py-1.5 px-2 bg-blue-500/80 hover:bg-blue-500 active:bg-blue-600 text-white font-bold text-[11px] sm:text-[12.5px] rounded transition shadow-xs border border-white/20 flex items-center justify-center gap-1.5 cursor-pointer leading-tight text-center"
                    title="Abrir WhatsApp novamente em outra aba"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Parabenizar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
