import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Award,
  Clock,
  CheckCircle2,
  Target,
  Crown,
  Medal,
  Building2,
  RefreshCw,
  FileText,
  Users,
  AlertCircle,
  TrendingDown,
  Percent,
  ShieldCheck,
  Lock,
  Sparkles,
  UserCheck,
  Zap,
  BarChart3,
  Layers,
  Cake,
  Gift,
  PartyPopper,
  MessageCircle,
  X,
  Bell,
  Calendar,
  Wallet,
  Palette,
  Printer,
  Flame,
  Scissors,
  Truck,
  Package,
  ShoppingBag,
  Store,
  MapPin,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { RoleTitle, UserProfile } from '../types/frontend';
import { ApiService } from '../services/api';
import { OrdemServico } from '../server/types/os';
import { Employee } from '../server/types/employee';
import { Client } from '../server/types/client';
import { buildClientBirthdayMessage } from './client/OperatorClientBirthdayAlert';
import { FilialItem, DEFAULT_MATRIZ_FILIAL } from './settings/SettingsModuleView';
import { isRoleAuthorizedForSales, normalizeRoleName } from '../utils/userPermissions';

interface ExecutiveDashboardViewProps {
  userRole: RoleTitle;
  user?: UserProfile;
}

export interface MonthlyEvolutionItem {
  mes: string;
  mesCompleto: string;
  faturamento: number;
  pedidos: number;
  meta: number;
  atingimento: number;
  ticketMedio: number;
  color: string;
}

// Distinct vibrant colors for each of the 12 months
const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_NAMES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const MONTH_PALETTE = [
  '#2563EB', // Jan - Azul Real
  '#7C3AED', // Fev - Violeta Intenso
  '#DB2777', // Mar - Rosa Pink
  '#D97706', // Abr - Âmbar / Laranja
  '#059669', // Mai - Esmeralda
  '#0891B2', // Jun - Ciano
  '#4F46E5', // Jul - Índigo
  '#EA580C', // Ago - Laranja Queimado
  '#0D9488', // Set - Teal / Turquesa
  '#65A30D', // Out - Lima / Verde
  '#9333EA', // Nov - Púrpura
  '#0284C7', // Dez - Azul Céu
];

const SELLER_LINE_COLORS = [
  '#2563EB', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Purple
  '#DB2777', // Pink
  '#0891B2', // Cyan
  '#EA580C', // Orange
  '#4F46E5', // Indigo
  '#10B981', // Green
  '#9333EA', // Violet
  '#0284C7', // Sky
  '#DC2626', // Red
];

// 12 cores em degradê inspiradas no modelo do Ranquing dos Melhores Desempenhos (do azul no topo ao vermelho na base)
export const RANKING_PERFORMANCE_COLORS = [
  '#2b7bc4', // 1: Azul vibrante
  '#36a5b8', // 2: Ciano / Azul petróleo
  '#43bc92', // 3: Verde azulado
  '#68cb66', // 4: Verde folha
  '#91ce4f', // 5: Verde limão
  '#bfd237', // 6: Amarelo esverdeado
  '#e4c227', // 7: Amarelo puro
  '#f0ab28', // 8: Amarelo âmbar
  '#ee882b', // 9: Laranja claro
  '#ea6a2a', // 10: Laranja escuro
  '#e74c30', // 11: Coral avermelhado
  '#e13131', // 12: Vermelho base
];

export interface TopSellerItem {
  id: string;
  rank: number;
  name: string;
  cargo: string;
  salesTotal: number;
  count: number;
  osCount: number;
  osTotal: number;
  vndCount: number;
  vndTotal: number;
  paidCount?: number;
  paidTotal?: number;
  pendingCount?: number;
  pendingTotal?: number;
  percentageOfTotal: number;
  barColor: string;
  widthPct: number;
  badgeColor: string;
  icon?: any;
}

export interface ProductionFlowStep {
  name: string;
  count: number;
  color: string;
  textColor: string;
  badgeBg: string;
  borderColor: string;
  key: string;
  icon: any;
  isDestination?: boolean;
}

/**
 * Normaliza e agrupa vendedores sob sua identidade única canônica para evitar duplicações
 * (ex: "Marcelo (Developer System)" e "Marcelo Gomes" resolvem para o mesmo vendedor único).
 */
export function resolveCanonicalSeller(
  rawName: string | undefined,
  employees: Employee[],
  currentUser?: { name?: string; username?: string; role?: string; email?: string }
): { id: string; name: string; cargo: string } {
  const raw = (rawName || '').trim();
  if (!raw || raw.toLowerCase() === 'não atribuído' || raw.toLowerCase() === 'nao atribuido') {
    return { id: 'sem_vendedor', name: 'Vendedor Geral', cargo: 'Vendedor(a)' };
  }

  const rawLower = raw.toLowerCase();
  // Remove anotações entre parênteses como "(developer system)", "(vendedor)", "(matriz)"
  const cleanRaw = rawLower.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const rawFirst = cleanRaw.split(' ')[0] || '';

  // 1. Verifica correspondência com o usuário atualmente logado
  if (currentUser) {
    const uName = (currentUser.name || '').trim();
    const uLower = uName.toLowerCase();
    const uClean = uLower.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    const uFirst = uClean.split(' ')[0] || '';
    const uUsername = (currentUser.username || '').toLowerCase().trim();

    const isMatchUser =
      rawLower === uLower ||
      cleanRaw === uClean ||
      (uFirst.length >= 3 && cleanRaw === uFirst) ||
      (uFirst.length >= 3 && rawLower.includes(uFirst)) ||
      (uUsername && (rawLower === uUsername || cleanRaw === uUsername));

    if (isMatchUser) {
      return {
        id: `user-${uUsername || uClean.replace(/\s+/g, '_')}`,
        name: uName,
        cargo: currentUser.role || 'Vendedor(a)',
      };
    }
  }

  // 2. Verifica correspondência com a lista de colaboradores (employees)
  for (const emp of employees) {
    const empFullName = `${emp.nome} ${emp.sobrenome || ''}`.trim();
    const empLower = empFullName.toLowerCase();
    const empClean = empLower.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    const empFirst = (emp.nome || '').toLowerCase().trim();
    const empLogin = (emp.loginUsuario || '').toLowerCase().trim();

    const isMatchEmp =
      rawLower === empLower ||
      cleanRaw === empClean ||
      (empFirst.length >= 3 && cleanRaw === empFirst) ||
      (empFirst.length >= 3 && rawLower.includes(empFirst)) ||
      (empLogin && (rawLower === empLogin || cleanRaw === empLogin));

    if (isMatchEmp) {
      return {
        id: `emp-${emp.id || empClean.replace(/\s+/g, '_')}`,
        name: empFullName,
        cargo: emp.cargo || 'Vendedor(a)',
      };
    }
  }

  // 3. Fallback: mantém nome limpo com capitalização
  const displayName = raw.replace(/\s*\([^)]*\)\s*/g, ' ').trim() || raw;
  return {
    id: `raw-${cleanRaw.replace(/\s+/g, '_') || rawLower}`,
    name: displayName,
    cargo: 'Vendedor(a)',
  };
}

interface ActivityItem {
  id: string;
  title: string;
  details: string;
  time: string;
  color: string;
  timestamp: string;
  destino?: string;
}

export interface EmployeeBirthday {
  id: string;
  nome: string;
  sobrenome: string;
  fotoUrl?: string;
  cargo: string;
  setor: string;
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

export function parseDateSafe(input: any): Date {
  if (!input) return new Date();
  if (input instanceof Date && !isNaN(input.getTime())) return input;

  if (typeof input === 'number') {
    const d = new Date(input);
    if (!isNaN(d.getTime())) return d;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return new Date();

    // Check Brazilian format: DD/MM/YYYY or DD/MM/YY (with optional comma, "às", time HH:mm:ss)
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[,\s]+(?:às\s+)?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/i);
    if (brMatch) {
      const day = parseInt(brMatch[1], 10);
      const month = parseInt(brMatch[2], 10) - 1;
      let year = parseInt(brMatch[3], 10);
      if (year < 100) year += 2000;
      const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
      const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
      const sec = brMatch[6] ? parseInt(brMatch[6], 10) : 0;
      const d = new Date(year, month, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }

    // Check Brazilian format with hyphens: DD-MM-YYYY
    const brHyphenMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})(?:[,\s]+(?:às\s+)?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/i);
    if (brHyphenMatch && parseInt(brHyphenMatch[1], 10) <= 31 && parseInt(brHyphenMatch[2], 10) <= 12) {
      const day = parseInt(brHyphenMatch[1], 10);
      const month = parseInt(brHyphenMatch[2], 10) - 1;
      let year = parseInt(brHyphenMatch[3], 10);
      if (year < 100) year += 2000;
      const hour = brHyphenMatch[4] ? parseInt(brHyphenMatch[4], 10) : 0;
      const min = brHyphenMatch[5] ? parseInt(brHyphenMatch[5], 10) : 0;
      const sec = brHyphenMatch[6] ? parseInt(brHyphenMatch[6], 10) : 0;
      const d = new Date(year, month, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }

    const isoDate = new Date(trimmed);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }
  }

  return new Date();
}

export function parseEmployeeBirthdays(employees: Employee[], referenceDate: Date = new Date()): EmployeeBirthday[] {
  const currentDay = referenceDate.getDate();
  const currentMonth = referenceDate.getMonth() + 1; // 1-12
  const currentYear = referenceDate.getFullYear();

  const results: EmployeeBirthday[] = [];

  employees.forEach((emp) => {
    if (!emp.dataNascimento) return;
    const raw = String(emp.dataNascimento).trim();
    if (!raw) return;

    let day = 0;
    let month = 0;
    let year = 0;

    // Format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const parts = raw.split('T')[0].split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }
    // Format DD/MM/YYYY
    else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(raw)) {
      const parts = raw.split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
    // Format DD-MM-YYYY
    else if (/^\d{1,2}-\d{1,2}-\d{2,4}/.test(raw)) {
      const parts = raw.split('-');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
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

  // Sort by day ascending
  return results.sort((a, b) => a.dia - b.dia);
}

export interface ClientBirthday {
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

export function parseClientBirthdays(clients: any[], referenceDate: Date = new Date()): ClientBirthday[] {
  const currentDay = referenceDate.getDate();
  const currentMonth = referenceDate.getMonth() + 1; // 1-12
  const currentYear = referenceDate.getFullYear();

  const results: ClientBirthday[] = [];

  clients.forEach((client) => {
    if (client.status === 'INACTIVE') return;
    const raw = String(client.dataNascimento || client.dataFundacao || '').trim();
    if (!raw) return;

    let day = 0;
    let month = 0;
    let year = 0;

    // Format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const parts = raw.split('T')[0].split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }
    // Format DD/MM/YYYY
    else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(raw)) {
      const parts = raw.split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
    }
    // Format DD-MM-YYYY
    else if (/^\d{1,2}-\d{1,2}-\d{2,4}/.test(raw)) {
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

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({ userRole, user }) => {
  const [selectedFilialFilter, setSelectedFilialFilter] = useState<string>('ALL');
  const [filiaisList, setFiliaisList] = useState<FilialItem[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Birthdays for Diretoria & Administração
  const [monthBirthdays, setMonthBirthdays] = useState<EmployeeBirthday[]>([]);
  const [upcomingAlertBirthdays, setUpcomingAlertBirthdays] = useState<EmployeeBirthday[]>([]);
  const [dismissFloatingAlert, setDismissFloatingAlert] = useState<boolean>(false);

  // Clientes Aniversariantes do Mês (Visão Geral - Todos os Perfis com Dashboard permitido)
  const [monthClientBirthdays, setMonthClientBirthdays] = useState<ClientBirthday[]>([]);

  // Supervisor check
  const isSupervisor = Boolean(
    userRole === 'Supervisor' ||
    normalizeRoleName(userRole) === 'Supervisor' ||
    user?.role === 'Supervisor' ||
    normalizeRoleName(user?.role || '') === 'Supervisor' ||
    (userRole && userRole.toLowerCase().includes('supervisor')) ||
    (user?.role && user.role.toLowerCase().includes('supervisor'))
  );

  // Individual role check (Vendedor(a) / Recepção) - excludes supervisor
  const isIndividualSalesView =
    !isSupervisor &&
    (userRole === 'Vendedor(a)' ||
      userRole === 'Recepção' ||
      userRole?.toLowerCase().includes('vendedor') ||
      userRole?.toLowerCase().includes('recep') ||
      (user?.role &&
        (user.role === 'Vendedor(a)' ||
          user.role === 'Recepção' ||
          user.role.toLowerCase().includes('vendedor') ||
          user.role.toLowerCase().includes('recep'))));

  // Developer and CEO permissions
  const isDeveloperUser = Boolean(
    user?.isDeveloper ||
    userRole === 'Developer' ||
    normalizeRoleName(userRole) === 'Developer' ||
    normalizeRoleName(user?.role || '') === 'Developer'
  );

  const isCeoUser = Boolean(
    userRole === 'CEO' ||
    normalizeRoleName(userRole) === 'CEO' ||
    user?.role === 'CEO' ||
    normalizeRoleName(user?.role || '') === 'CEO'
  );

  // Diretoria & Administração check
  const isDiretoriaOuAdministracao = Boolean(
    isDeveloperUser ||
    isCeoUser ||
    isSupervisor ||
    userRole === 'Administração' ||
    userRole === 'Administrativo' ||
    userRole === 'Expedição' ||
    userRole?.toLowerCase().includes('diretor') ||
    userRole?.toLowerCase().includes('administra') ||
    userRole?.toLowerCase().includes('gerente') ||
    userRole?.toLowerCase().includes('supervisor') ||
    userRole?.toLowerCase().includes('expedição') ||
    userRole?.toLowerCase().includes('expedicao') ||
    userRole?.toLowerCase().includes('ceo') ||
    (user?.role && (
      user.role.toLowerCase().includes('diretor') ||
      user.role.toLowerCase().includes('administra') ||
      user.role.toLowerCase().includes('gerente') ||
      user.role.toLowerCase().includes('supervisor') ||
      user.role.toLowerCase().includes('expedição') ||
      user.role.toLowerCase().includes('expedicao') ||
      user.role.toLowerCase().includes('ceo')
    ))
  );

  const isGerenteGeral = Boolean(
    userRole === 'Gerente Geral' ||
    normalizeRoleName(userRole) === 'Gerente Geral' ||
    user?.role === 'Gerente Geral' ||
    normalizeRoleName(user?.role || '') === 'Gerente Geral' ||
    (userRole && (userRole.toLowerCase().includes('gerente geral') || userRole.toLowerCase() === 'gerente')) ||
    (user?.role && (user.role.toLowerCase().includes('gerente geral') || user.role.toLowerCase() === 'gerente'))
  );

  const isAdmMaster = Boolean(
    userRole.toLowerCase().includes('adm') ||
    userRole.toLowerCase().includes('admin') ||
    userRole.toLowerCase().includes('master') ||
    (user?.role && (user.role.toLowerCase().includes('adm') || user.role.toLowerCase().includes('admin') || user.role.toLowerCase().includes('master')))
  );

  // Profiles authorized to view/filter all filiais (Developer, CEO, Gerente Geral, Admins Master)
  // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
  // No Dashboard de Supervisão (isSupervisor), a seleção de filiais é desativada e mantida restrita estritamente a Fortaleza.
  const canSelectAllFiliais = (isDeveloperUser || isCeoUser || isGerenteGeral || isAdmMaster) && !isSupervisor;

  // Direção Check (Developer, CEO, Gerente Geral)
  const isDirecao = Boolean(isDeveloperUser || isCeoUser || isGerenteGeral);

  const [assignedFilialId, setAssignedFilialId] = useState<string>('');
  const [assignedFilialNome, setAssignedFilialNome] = useState<string>('');

  // Global Dashboard Metrics
  const [faturamentoAnual, setFaturamentoAnual] = useState<number>(0);
  const [faturamentoMensal, setFaturamentoMensal] = useState<number>(0);
  const [faturamentoMesAnterior, setFaturamentoMesAnterior] = useState<number>(0);
  const [ticketMedio, setTicketMedio] = useState<number>(0);
  const [totalOsMes, setTotalOsMes] = useState<number>(0);

  // Direção Specific Metrics (Faturamento Bruto: Pagas + Pendentes / Faturamento Líquido: Apenas Pagas)
  const [faturamentoBrutoMensal, setFaturamentoBrutoMensal] = useState<number>(0);
  const [faturamentoLiquidoMensal, setFaturamentoLiquidoMensal] = useState<number>(0);
  const [faturamentoBrutoAnual, setFaturamentoBrutoAnual] = useState<number>(0);
  const [faturamentoLiquidoAnual, setFaturamentoLiquidoAnual] = useState<number>(0);
  const [faturamentoPendenteMensal, setFaturamentoPendenteMensal] = useState<number>(0);
  const [pedidosPagosMes, setPedidosPagosMes] = useState<number>(0);
  const [pedidosPendentesMes, setPedidosPendentesMes] = useState<number>(0);

  // Supervisor Specific Dashboard Metrics (Calculated strictly based on Vendedores & Recepção sales)
  const [supervisorFaturamentoMensal, setSupervisorFaturamentoMensal] = useState<number>(0);
  const [supervisorFaturamentoMesAnterior, setSupervisorFaturamentoMesAnterior] = useState<number>(0);
  const [supervisorTicketMedio, setSupervisorTicketMedio] = useState<number>(0);
  const [supervisorTotalOsMes, setSupervisorTotalOsMes] = useState<number>(0);

  // Daily evolution data for Supervisor line chart
  const [selectedSupervisorChartMonth, setSelectedSupervisorChartMonth] = useState<number>(() => new Date().getMonth());
  const [dailySellersChartData, setDailySellersChartData] = useState<any[]>([]);
  const [dailyActiveSellers, setDailyActiveSellers] = useState<{ name: string; color: string; cargo: string; totalMes: number }[]>([]);
  
  // Individual Dashboard Metrics (for Vendedor / Recepção)
  const [faturamentoIndividualMensal, setFaturamentoIndividualMensal] = useState<number>(0);
  const [faturamentoIndividualMesAnterior, setFaturamentoIndividualMesAnterior] = useState<number>(0);
  const [ticketMedioIndividual, setTicketMedioIndividual] = useState<number>(0);
  const [pedidosIndividualMes, setPedidosIndividualMes] = useState<number>(0);
  const [comissaoPorcentagem, setComissaoPorcentagem] = useState<number>(0);
  const [comissaoValorMensal, setComissaoValorMensal] = useState<number>(0);
  const [metaIndividual, setMetaIndividual] = useState<number>(0);
  const [metaIndividualPorcentagem, setMetaIndividualPorcentagem] = useState<number>(0);
  const [minhaPosicaoRanking, setMinhaPosicaoRanking] = useState<number>(1);
  const [totalVendedoresNoRanking, setTotalVendedoresNoRanking] = useState<number>(1);
  
  // Meta Mensal (Global / Filial)
  const [metaMensal, setMetaMensal] = useState<number>(750000);
  const [metaMensalPorcentagem, setMetaMensalPorcentagem] = useState<number>(0);
  const [quantoFaltaMetaMensal, setQuantoFaltaMetaMensal] = useState<number>(0);

  // Production Flow Workflow Stats (8 Estágios: DESIGNER, IMPRESSÃO, CALANDRA, COSTURA, EXCURSÃO, CORREIOS, SHOPEE, RETIRADA(Recepção))
  const [productionFlow, setProductionFlow] = useState<ProductionFlowStep[]>([
    { name: 'DESIGNER', count: 0, color: 'bg-purple-600', textColor: 'text-purple-700', badgeBg: 'bg-purple-50', borderColor: 'border-purple-200', key: 'DESIGNER', icon: Palette },
    { name: 'IMPRESSÃO', count: 0, color: 'bg-blue-600', textColor: 'text-blue-700', badgeBg: 'bg-blue-50', borderColor: 'border-blue-200', key: 'IMPRESSÃO', icon: Printer },
    { name: 'CALANDRA', count: 0, color: 'bg-orange-500', textColor: 'text-orange-700', badgeBg: 'bg-orange-50', borderColor: 'border-orange-200', key: 'CALANDRA', icon: Flame },
    { name: 'COSTURA', count: 0, color: 'bg-rose-600', textColor: 'text-rose-700', badgeBg: 'bg-rose-50', borderColor: 'border-rose-200', key: 'COSTURA', icon: Scissors },
    { name: 'EXCURSÃO', count: 0, color: 'bg-red-600', textColor: 'text-red-700', badgeBg: 'bg-red-50', borderColor: 'border-red-200', key: 'EXCURSÃO', icon: Truck },
    { name: 'CORREIOS', count: 0, color: 'bg-amber-600', textColor: 'text-amber-700', badgeBg: 'bg-amber-50', borderColor: 'border-amber-200', key: 'CORREIOS', icon: Package },
    { name: 'SHOPEE', count: 0, color: 'bg-orange-600', textColor: 'text-orange-700', badgeBg: 'bg-orange-50', borderColor: 'border-orange-200', key: 'SHOPEE', icon: ShoppingBag },
    { name: 'RETIRADA(Recepção)', count: 0, color: 'bg-emerald-600', textColor: 'text-emerald-700', badgeBg: 'bg-emerald-50', borderColor: 'border-emerald-200', key: 'RETIRADA(Recepção)', icon: Store },
  ]);

  const [pedidosAtrasadosCount, setPedidosAtrasadosCount] = useState<number>(0);
  const [flowOrdersMap, setFlowOrdersMap] = useState<Record<string, OrdemServico[]>>({
    'DESIGNER': [],
    'IMPRESSÃO': [],
    'CALANDRA': [],
    'COSTURA': [],
    'EXCURSÃO': [],
    'CORREIOS': [],
    'SHOPEE': [],
    'RETIRADA(Recepção)': [],
  });
  const [selectedFlowModalStage, setSelectedFlowModalStage] = useState<string | null>(null);
  const [rankingFilterType, setRankingFilterType] = useState<'ALL' | 'OS' | 'VND'>('ALL');
  const [allRankingSellers, setAllRankingSellers] = useState<TopSellerItem[]>([]);
  const [topSellers, setTopSellers] = useState<TopSellerItem[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);

  // Filtro de exibição dinâmico: Todos (OS + VND), Apenas OS ou Apenas VND
  const displayedTopSellers = React.useMemo<TopSellerItem[]>(() => {
    let list: TopSellerItem[] = [];

    if (rankingFilterType === 'OS') {
      list = allRankingSellers
        .filter((s) => s.osCount > 0 && s.osTotal > 0)
        .map((s) => ({
          ...s,
          salesTotal: s.osTotal,
          count: s.osCount,
        }))
        .sort((a, b) => b.salesTotal - a.salesTotal);
    } else if (rankingFilterType === 'VND') {
      list = allRankingSellers
        .filter((s) => s.vndCount > 0 && s.vndTotal > 0)
        .map((s) => ({
          ...s,
          salesTotal: s.vndTotal,
          count: s.vndCount,
        }))
        .sort((a, b) => b.salesTotal - a.salesTotal);
    } else {
      list = allRankingSellers
        .filter((s) => s.salesTotal > 0)
        .sort((a, b) => b.salesTotal - a.salesTotal);
    }

    const maxSales = list[0]?.salesTotal || 1;
    const totalSales = list.reduce((acc, curr) => acc + curr.salesTotal, 0);

    return list.slice(0, 10).map((seller, idx) => {
      const rank = idx + 1;
      let badgeColor = 'bg-slate-100 text-slate-700 border-slate-300';
      let icon = undefined;

      if (rank === 1) {
        badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
        icon = Crown;
      } else if (rank === 2) {
        badgeColor = 'bg-slate-200 text-slate-800 border-slate-400';
        icon = Medal;
      } else if (rank === 3) {
        badgeColor = 'bg-amber-700/10 text-amber-900 border-amber-700/30';
        icon = Award;
      }

      const barColor = RANKING_PERFORMANCE_COLORS[idx % RANKING_PERFORMANCE_COLORS.length];
      const widthPct = Math.max(16, Math.round((seller.salesTotal / maxSales) * 100));
      const percentageOfTotal =
        totalSales > 0 ? Number(((seller.salesTotal / totalSales) * 100).toFixed(1)) : 100;

      return {
        ...seller,
        rank,
        badgeColor,
        icon,
        barColor,
        widthPct,
        percentageOfTotal,
      };
    });
  }, [allRankingSellers, rankingFilterType]);

  // Monthly Evolution with Distinct Colors per Month
  const [monthlyEvolutionData, setMonthlyEvolutionData] = useState<MonthlyEvolutionItem[]>([]);
  const [chartMetricMode, setChartMetricMode] = useState<'faturamento' | 'pedidos' | 'comparativo'>('faturamento');

  // Load Filiais (Cache local + Sincronização direta com o Banco de Dados)
  useEffect(() => {
    const handleFiliaisUpdated = () => {
      const stored = localStorage.getItem('subligestao_filiais');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFiliaisList(parsed);
            return;
          }
        } catch {}
      }
    };

    handleFiliaisUpdated();

    ApiService.getFiliais().then((serverFiliais) => {
      if (Array.isArray(serverFiliais) && serverFiliais.length > 0) {
        setFiliaisList(serverFiliais);
        localStorage.setItem('subligestao_filiais', JSON.stringify(serverFiliais));
      }
    }).catch(() => {});

    window.addEventListener('subligestao_filiais_changed', handleFiliaisUpdated);
    return () => {
      window.removeEventListener('subligestao_filiais_changed', handleFiliaisUpdated);
    };
  }, []);

  // Sync Logic
  const syncDashboardData = useCallback(async () => {
    try {
      // 1. Fetch OSs, PDV, Employees, Clients, Metas, Branches in parallel
      const [ordens, pdvTransactions, employees, clients, serverMetas, serverBranches] = await Promise.all([
        ApiService.getOrdensServico().catch(() => [] as OrdemServico[]),
        ApiService.getPdvTransactions().catch(() => [] as any[]),
        ApiService.getEmployees().catch(() => [] as Employee[]),
        ApiService.getClients().catch(() => [] as any[]),
        ApiService.getMetas().catch(() => null),
        ApiService.getFiliais().catch(() => [] as FilialItem[]),
      ]);

      if (serverMetas && typeof serverMetas === 'object' && Object.keys(serverMetas).length > 0) {
        try {
          localStorage.setItem('subligestao_metas_filiais', JSON.stringify(serverMetas));
        } catch (_) {}
      }

      const currentBranches: FilialItem[] = (Array.isArray(serverBranches) && serverBranches.length > 0)
        ? serverBranches
        : (filiaisList.length > 0 ? filiaisList : []);

      if (Array.isArray(serverBranches) && serverBranches.length > 0) {
        setFiliaisList(serverBranches);
        try {
          localStorage.setItem('subligestao_filiais', JSON.stringify(serverBranches));
        } catch (_) {}
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const previousMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      // Identify logged-in user profile / employee
      const userFullName = (user?.name || '').toLowerCase().trim();
      const userFirstName = userFullName.split(' ')[0] || '';
      const userUsername = (user?.username || '').toLowerCase().trim();

      const matchedEmployee = employees.find((emp) => {
        const empFullName = `${emp.nome} ${emp.sobrenome || ''}`.toLowerCase().trim();
        return (
          empFullName === userFullName ||
          emp.nome.toLowerCase().trim() === userFirstName ||
          (emp.loginUsuario && emp.loginUsuario.toLowerCase().trim() === userUsername) ||
          (emp.email && user?.email && emp.email.toLowerCase() === user.email.toLowerCase())
        );
      });

      // Identify assigned filial for the employee
      let userFilialId = matchedEmployee?.filialId || '';
      let userFilialNome = matchedEmployee?.filialNome || '';

      if (!userFilialId && user?.branch) {
        const found = filiaisList.find(
          (f) =>
            f.nome.toLowerCase() === user.branch.toLowerCase() ||
            f.codigo.toLowerCase() === user.branch.toLowerCase() ||
            user.branch.toLowerCase().includes(f.nome.toLowerCase())
        );
        if (found) {
          userFilialId = found.id;
          userFilialNome = found.nome;
        }
      }

      if (!userFilialId) {
        userFilialId = DEFAULT_MATRIZ_FILIAL.id;
        userFilialNome = DEFAULT_MATRIZ_FILIAL.nome;
      }

      setAssignedFilialId(userFilialId);
      setAssignedFilialNome(userFilialNome);

      // Effective filial filter:
      // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
      // No Dashboard de Supervisão (isSupervisor), a visibilidade é restrita estritamente à filial Fortaleza.
      const effectiveFilialFilter = isSupervisor
        ? 'FORTALEZA'
        : canSelectAllFiliais
        ? selectedFilialFilter
        : (userFilialId || 'FORTALEZA');

      // Employee commission and individual goal
      const empComissaoPct = matchedEmployee?.comissaoPorcentagem || 0;
      const empMetaIndiv = matchedEmployee?.metaIndividual || 0;
      setComissaoPorcentagem(empComissaoPct);
      setMetaIndividual(empMetaIndiv);

      // Helper to check if a transaction belongs to this user as seller / operator
      const isUserTransaction = (
        sellerNameInput?: string,
        createdByUser?: string,
        operatorNameInput?: string,
        extraNameInput?: string
      ) => {
        const sName = (sellerNameInput || '').toLowerCase().trim();
        const cbName = (createdByUser || '').toLowerCase().trim();
        const opName = (operatorNameInput || '').toLowerCase().trim();
        const exName = (extraNameInput || '').toLowerCase().trim();

        const matchCandidates = [
          userFullName,
          userFirstName,
          userUsername,
          user?.email ? user.email.toLowerCase().trim() : '',
          matchedEmployee ? `${matchedEmployee.nome} ${matchedEmployee.sobrenome || ''}`.toLowerCase().trim() : '',
          matchedEmployee?.nome ? matchedEmployee.nome.toLowerCase().trim() : '',
          matchedEmployee?.loginUsuario ? matchedEmployee.loginUsuario.toLowerCase().trim() : '',
        ].filter(Boolean);

        const checkCandidate = (val: string) => {
          if (!val) return false;
          const v = val.toLowerCase().trim();
          return matchCandidates.some((m) => {
            if (!m) return false;
            return v === m || v.includes(m) || m.includes(v);
          });
        };

        return checkCandidate(sName) || checkCandidate(cbName) || checkCandidate(opName) || checkCandidate(exName);
      };

      // Filter by selected Filial (Developer/CEO/Gerente Geral/Supervisor) or assigned Filial (Employees)
      const currentFilialObj = filiaisList.find((f) => f.id === effectiveFilialFilter);
      const currentFilialNome = (currentFilialObj?.nome || '').toLowerCase().trim();
      const currentFilialCodigo = (currentFilialObj?.codigo || '').toLowerCase().trim();
      const isMatrizFilter =
        effectiveFilialFilter === DEFAULT_MATRIZ_FILIAL.id ||
        effectiveFilialFilter === 'filial-matriz-fortaleza' ||
        effectiveFilialFilter === 'FILIAL-MATRIZ-001' ||
        currentFilialCodigo === 'matriz';

      const filteredOS = ordens.filter((os) => {
        // Exclude Orçamentos (ORC) from sales and commission metrics
        if ((os as any).tipoDocumento === 'ORCAMENTO' || (os as any).isOrcamento || os.codigo?.startsWith('ORC')) {
          return false;
        }

        const status = (os.status || (os as any).situacao || '').toLowerCase();
        if (status === 'cancelada' || status === 'cancelado' || (os as any).deletedAt) {
          return false;
        }

        // --- Identificação de Origem e Canal (Fortaleza / Shopee / Piauí) ---
        const stage = String((os as any).estagio || (os as any).stage || (os as any).etapa || '').toLowerCase();
        const destino = String((os as any).destinoExpedicao || (os as any).destino || (os as any).tipoEntrega || '').toLowerCase();
        const canal = String((os as any).canalVenda || (os as any).canal || (os as any).origemVenda || (os as any).origem || (os as any).modalidadeVenda || (os as any).modalidade || '').toLowerCase();
        const cliente = String((os as any).clienteNome || (os as any).cliente || ((os as any).cliente && (os as any).cliente.nome) || '').toLowerCase();
        const tipoExp = String((os as any).tipoExpedicao || (os as any).expedicaoTipo || '').toLowerCase();
        const obs = String(os.observacoes || (os as any).obs || (os as any).observacao || (os as any).detalhes || '').toLowerCase();
        const historicoStr = Array.isArray((os as any).historico)
          ? (os as any).historico.map((h: any) => `${h.descricao || ''} ${h.acao || ''}`).join(' ').toLowerCase()
          : '';
        const osFilialId = String((os as any).filialId || (os as any).branchId || '').toLowerCase();
        const osFilialNome = String((os as any).filialNome || '').toLowerCase().trim();

        let isShopee =
          stage.includes('shopee') ||
          destino.includes('shopee') ||
          canal.includes('shopee') ||
          cliente.includes('shopee') ||
          tipoExp.includes('shopee') ||
          obs.includes('shopee') ||
          historicoStr.includes('shopee') ||
          osFilialNome.includes('shopee') ||
          osFilialId.includes('shopee');

        let isPiaui =
          osFilialNome.includes('piauí') ||
          osFilialNome.includes('piaui') ||
          osFilialId.includes('piauí') ||
          osFilialId.includes('piaui') ||
          obs.includes('piauí') ||
          obs.includes('piaui');

        const sellerName = ((os as any).vendedorNome || (os as any).vendedor || os.operador || '').toLowerCase().trim();
        let sellerEmp: any = null;
        if (sellerName) {
          sellerEmp = employees.find((e) => {
            const fullName = `${e.nome} ${e.sobrenome || ''}`.toLowerCase().trim();
            return fullName === sellerName || e.nome.toLowerCase() === sellerName || e.loginUsuario?.toLowerCase() === sellerName;
          });
          if (sellerEmp) {
            if (sellerEmp.localAtuacao === 'Shopee') isShopee = true;
            else if (sellerEmp.localAtuacao === 'Piauí') isPiaui = true;
            else if ((sellerEmp.filialNome || '').toLowerCase().includes('piauí') || (sellerEmp.filialNome || '').toLowerCase().includes('piaui')) isPiaui = true;
          }
        }

        const isFortaleza = !isPiaui && !isShopee;

        if (effectiveFilialFilter === 'ALL') return true;
        if (effectiveFilialFilter === 'FORTALEZA') return isFortaleza;
        if (effectiveFilialFilter === 'SHOPEE') return isShopee;
        if (effectiveFilialFilter === 'PIAUI') return isPiaui;
        if (effectiveFilialFilter === 'FORTALEZA_SHOPEE') return isFortaleza || isShopee;
        if (effectiveFilialFilter === 'PIAUI_SHOPEE') return isPiaui || isShopee;

        // Fallback for direct filial id matching (preservação sem regressão)
        if (osFilialId) {
          return osFilialId === effectiveFilialFilter.toLowerCase();
        }
        if (osFilialNome && currentFilialNome) {
          return osFilialNome === currentFilialNome || osFilialNome.includes(currentFilialNome) || currentFilialNome.includes(osFilialNome);
        }
        if (sellerEmp && sellerEmp.filialId) {
          return sellerEmp.filialId === effectiveFilialFilter || sellerEmp.filialId.toLowerCase() === effectiveFilialFilter.toLowerCase();
        }
        return isMatrizFilter;
      });

      // Filter PDV: Exclude transactions that are OS payment settlements to avoid double-counting!
      const directPDV = pdvTransactions.filter((pdv) => {
        const status = (pdv.status || '').toLowerCase();
        if (status === 'cancelada' || status === 'cancelado' || (pdv as any).deletedAt) {
          return false;
        }

        const isOsPayment =
          Boolean(pdv.osId) ||
          (pdv.osCodigo && pdv.osCodigo.toUpperCase().startsWith('OS')) ||
          (pdv.codigoVenda && pdv.codigoVenda.toUpperCase().startsWith('CDV'));
        if (isOsPayment) return false;

        const pdvFilialId = String(pdv.filialId || pdv.branchId || '').toLowerCase();
        const pdvFilialNome = String((pdv as any).filialNome || '').toLowerCase().trim();
        const canal = String((pdv as any).canalVenda || (pdv as any).canal || (pdv as any).origemVenda || (pdv as any).origem || (pdv as any).modalidadeVenda || (pdv as any).modalidade || '').toLowerCase();
        const obs = String(pdv.observacoes || (pdv as any).obs || (pdv as any).observacao || (pdv as any).detalhes || '').toLowerCase();
        const cliente = String(pdv.clienteNome || (pdv as any).cliente || ((pdv as any).cliente && (pdv as any).cliente.nome) || '').toLowerCase();

        let isShopee =
          canal.includes('shopee') ||
          obs.includes('shopee') ||
          cliente.includes('shopee') ||
          pdvFilialNome.includes('shopee') ||
          pdvFilialId.includes('shopee');

        let isPiaui =
          pdvFilialNome.includes('piauí') ||
          pdvFilialNome.includes('piaui') ||
          pdvFilialId.includes('piauí') ||
          pdvFilialId.includes('piaui') ||
          obs.includes('piauí') ||
          obs.includes('piaui');

        const sellerName = (pdv.vendedorNome || (pdv as any).vendedor || pdv.operadorNome || pdv.operador || '').toLowerCase().trim();
        let sellerEmp: any = null;
        if (sellerName) {
          sellerEmp = employees.find((e) => {
            const fullName = `${e.nome} ${e.sobrenome || ''}`.toLowerCase().trim();
            return fullName === sellerName || e.nome.toLowerCase() === sellerName || e.loginUsuario?.toLowerCase() === sellerName;
          });
          if (sellerEmp) {
            if (sellerEmp.localAtuacao === 'Shopee') isShopee = true;
            else if (sellerEmp.localAtuacao === 'Piauí') isPiaui = true;
            else if ((sellerEmp.filialNome || '').toLowerCase().includes('piauí') || (sellerEmp.filialNome || '').toLowerCase().includes('piaui')) isPiaui = true;
          }
        }

        const isFortaleza = !isPiaui && !isShopee;

        if (effectiveFilialFilter === 'ALL') return true;
        if (effectiveFilialFilter === 'FORTALEZA') return isFortaleza;
        if (effectiveFilialFilter === 'SHOPEE') return isShopee;
        if (effectiveFilialFilter === 'PIAUI') return isPiaui;
        if (effectiveFilialFilter === 'FORTALEZA_SHOPEE') return isFortaleza || isShopee;
        if (effectiveFilialFilter === 'PIAUI_SHOPEE') return isPiaui || isShopee;

        if (pdvFilialId) {
          return pdvFilialId === effectiveFilialFilter.toLowerCase();
        }
        if (pdvFilialNome && currentFilialNome) {
          return pdvFilialNome === currentFilialNome || pdvFilialNome.includes(currentFilialNome) || currentFilialNome.includes(pdvFilialNome);
        }
        if (sellerEmp && sellerEmp.filialId) {
          return sellerEmp.filialId === effectiveFilialFilter || sellerEmp.filialId.toLowerCase() === effectiveFilialFilter.toLowerCase();
        }
        return isMatrizFilter;
      });

      // --- Financial Aggregations (Global & Individual) ---
      let yearTotal = 0; // Faturamento Bruto Anual (todas: pagas e pendentes)
      let yearPaidTotal = 0; // Faturamento Líquido Anual (apenas pagas)
      let monthTotal = 0; // Faturamento Bruto Mensal (todas: pagas e pendentes)
      let monthPaidTotal = 0; // Faturamento Líquido Mensal (apenas pagas)
      let prevMonthTotal = 0;
      let monthCount = 0;
      let monthPaidCount = 0;
      let monthPendingCount = 0;

      let indivMonthTotal = 0;
      let indivPaidMonthTotal = 0;
      let indivPrevMonthTotal = 0;
      let indivMonthCount = 0;
      let indivPaidMonthCount = 0;

      // Helper estrito: verifica se a OS está no status de pendente
      const isOsPendente = (osItem: any): boolean => {
        const pStatus = (osItem.paymentStatus || '').toLowerCase().trim();
        const sPagamento = ((osItem as any).statusPagamento || '').toLowerCase().trim();
        const status = (osItem.status || '').toLowerCase().trim();
        const situacao = ((osItem as any).situacao || '').toLowerCase().trim();
        const estagio = ((osItem as any).estagioAtual || '').toLowerCase().trim();

        if (
          pStatus === 'pendente' ||
          sPagamento === 'pendente' ||
          status === 'pendente' ||
          situacao === 'pendente' ||
          estagio === 'pendente'
        ) {
          return true;
        }

        // Se há saldo restante a pagar e o status de pagamento não é explicitamente pago
        if (Number(osItem.valorRestante) > 0 && pStatus !== 'pago') {
          return true;
        }

        // Se não possui nenhum flag indicativo de pagamento confirmado
        const isConfirmadoPago =
          pStatus === 'pago' ||
          sPagamento === 'pago' ||
          (osItem as any).pago === true ||
          (osItem as any).pagoTotal === true;

        return !isConfirmadoPago;
      };

      const isOsEfetivamentePaga = (osItem: any): boolean => {
        return !isOsPendente(osItem);
      };

      const isPdvEfetivamentePago = (pdvItem: any): boolean => {
        const status = (pdvItem.status || '').toLowerCase().trim();
        const pStatus = ((pdvItem as any).paymentStatus || '').toLowerCase().trim();
        const sPagamento = ((pdvItem as any).statusPagamento || '').toLowerCase().trim();

        if (status === 'pendente' || pStatus === 'pendente' || sPagamento === 'pendente') {
          return false;
        }

        const isPago =
          status === 'pago' ||
          status === 'concluido' ||
          status === 'active' ||
          pStatus === 'pago' ||
          !status;

        return Boolean(isPago);
      };

      // Process OS sales (attributed to seller/vendedor or operator)
      filteredOS.forEach((os) => {
        const osDate = parseDateSafe(os.createdAt || (os as any).dataCriacao || (os as any).dataVenda || (os as any).data);
        const val = Number(os.valorFinal) || Number((os as any).valorTotal) || Number(os.subtotal) || 0;
        const isOsPaga = isOsEfetivamentePaga(os);
        const sellerName = (os as any).vendedorNome || (os as any).vendedor || os.operador || (os as any).operadorNome || (os as any).criadoPor || (os as any).createdBy || (os as any).responsavel || (os as any).atendente;
        const belongsToUser = isUserTransaction(
          sellerName,
          (os as any).criadoPor || (os as any).createdBy,
          os.operador || (os as any).operadorNome,
          (os as any).responsavel || (os as any).atendente
        );

        if (osDate.getFullYear() === currentYear) {
          yearTotal += val;
          if (isOsPaga) {
            yearPaidTotal += val;
          }

          if (osDate.getMonth() === currentMonth) {
            monthTotal += val;
            monthCount++;

            if (isOsPaga) {
              monthPaidTotal += val;
              monthPaidCount++;
            } else {
              monthPendingCount++;
            }

            if (belongsToUser) {
              indivMonthTotal += val;
              indivMonthCount++;
              if (isOsPaga) {
                indivPaidMonthTotal += val;
                indivPaidMonthCount++;
              }
            }
          }
        }
        if (osDate.getFullYear() === previousMonthYear && osDate.getMonth() === previousMonth) {
          prevMonthTotal += val;
          if (belongsToUser) {
            indivPrevMonthTotal += val;
          }
        }
      });

      // Process Pure Direct PDV sales (VND only)
      directPDV.forEach((pdv) => {
        const pdvDate = parseDateSafe(pdv.createdAt || pdv.dataVenda || (pdv as any).data || (pdv as any).dataHora || (pdv as any).timestamp);
        const val = Number(pdv.valorTotal) || Number(pdv.subtotal) || 0;
        const isPdvPago = isPdvEfetivamentePago(pdv);
        const belongsToUser = isUserTransaction(
          pdv.vendedorNome || (pdv as any).vendedor,
          pdv.usuario || pdv.createdBy,
          pdv.operadorNome || pdv.operador,
          (pdv as any).atendente
        );

        if (pdvDate.getFullYear() === currentYear) {
          yearTotal += val;
          if (isPdvPago) {
            yearPaidTotal += val;
          }

          if (pdvDate.getMonth() === currentMonth) {
            monthTotal += val;
            monthCount++;

            if (isPdvPago) {
              monthPaidTotal += val;
              monthPaidCount++;
            } else {
              monthPendingCount++;
            }

            if (belongsToUser) {
              indivMonthTotal += val;
              indivMonthCount++;
              if (isPdvPago) {
                indivPaidMonthTotal += val;
                indivPaidMonthCount++;
              }
            }
          }
        }
        if (pdvDate.getFullYear() === previousMonthYear && pdvDate.getMonth() === previousMonth) {
          prevMonthTotal += val;
          if (belongsToUser) {
            indivPrevMonthTotal += val;
          }
        }
      });

      // Update Global Metrics
      setFaturamentoAnual(yearTotal);
      setFaturamentoMensal(monthTotal);
      setFaturamentoMesAnterior(prevMonthTotal);
      setTotalOsMes(monthCount);
      setTicketMedio(monthCount > 0 ? monthTotal / monthCount : 0);

      // Update Direção Metrics (Developer, CEO, Gerente Geral)
      setFaturamentoBrutoMensal(monthTotal);
      setFaturamentoLiquidoMensal(monthPaidTotal);
      setFaturamentoBrutoAnual(yearTotal);
      setFaturamentoLiquidoAnual(yearPaidTotal);
      setFaturamentoPendenteMensal(Math.max(0, monthTotal - monthPaidTotal));
      setPedidosPagosMes(monthPaidCount);
      setPedidosPendentesMes(monthPendingCount);

      // --- META MENSAL CALCULATION (Current Month) ---
      // Sincronizado 100% com as Metas definidas em CONFIGURAÇÕES -> Filiais -> Metas
      let calculatedMetaMensal = 0;
      let hasFoundConfiguredMeta = false;

      let metasSource: any = serverMetas;
      if (!metasSource || typeof metasSource !== 'object' || Object.keys(metasSource).length === 0) {
        const storedMetas = localStorage.getItem('subligestao_metas_filiais');
        if (storedMetas) {
          try {
            metasSource = JSON.parse(storedMetas);
          } catch (_) {}
        }
      }

      const getMonthlyMetaForFilial = (fMeta: any, targetMonthIdx: number): number | null => {
        if (!fMeta) return null;
        if (typeof fMeta === 'number') return fMeta;
        if (fMeta.metasMensais && Array.isArray(fMeta.metasMensais)) {
          const item = fMeta.metasMensais.find((m: any) => m.mesIndex === targetMonthIdx);
          if (item && item.metaValor !== undefined && item.metaValor !== null) {
            return Number(item.metaValor);
          }
        }
        if (fMeta.metaMensalValor !== undefined && fMeta.metaMensalValor !== null) {
          return Number(fMeta.metaMensalValor);
        }
        return null;
      };

      const targetBranches = currentBranches.length > 0 ? currentBranches : filiaisList;

      const getMetaForLocation = (loc: 'FORTALEZA' | 'PIAUI' | 'SHOPEE', mIdx: number): number => {
        let sum = 0;
        let found = false;

        if (targetBranches && targetBranches.length > 0) {
          const seenBranchIds = new Set<string>();
          targetBranches.forEach((filial) => {
            if (!filial || !filial.id) return;
            if ((filial.status as string) === 'INATIVA' || (filial.status as string) === 'INACTIVE') return;

            // Deduplicação estrita de filiais para garantir que cada unidade conte apenas 1 vez
            const codeKey = String(filial.codigo || filial.id || '').toUpperCase();
            if (codeKey === 'MATRIZ' && seenBranchIds.has('MATRIZ')) return;
            if (seenBranchIds.has(filial.id)) return;
            seenBranchIds.add(filial.id);
            if (codeKey === 'MATRIZ') seenBranchIds.add('MATRIZ');

            const fName = String(filial.nome || '').toLowerCase();
            const fCod = String(filial.codigo || '').toLowerCase();
            const fId = String(filial.id || '').toLowerCase();
            const isP = fName.includes('piauí') || fName.includes('piaui') || fCod.includes('piaui') || fId.includes('piaui');
            const isS = fName.includes('shopee') || fCod.includes('shopee') || fId.includes('shopee');
            const isF = !isP && !isS;

            if ((loc === 'PIAUI' && isP) || (loc === 'SHOPEE' && isS) || (loc === 'FORTALEZA' && isF)) {
              let fMeta = metasSource[filial.id];
              if (!fMeta && filial.codigo) {
                fMeta = metasSource[filial.codigo];
              }
              if (!fMeta) {
                fMeta = Object.values(metasSource).find(
                  (m: any) =>
                    m?.filialId === filial.id ||
                    (m?.filialCodigo && m.filialCodigo.toUpperCase() === filial.codigo?.toUpperCase()) ||
                    (m?.filialNome && m.filialNome.toLowerCase() === filial.nome.toLowerCase())
                );
              }

              const val = getMonthlyMetaForFilial(fMeta, mIdx);
              if (val !== null) {
                sum += val;
                found = true;
              }
            }
          });
        } else {
          const seenCodigos = new Set<string>();
          Object.values(metasSource).forEach((m: any) => {
            const isMatriz =
              m?.filialCodigo === 'MATRIZ' ||
              m?.filialId === 'FILIAL-MATRIZ-001' ||
              m?.filialId === 'filial-matriz-fortaleza' ||
              String(m?.filialNome || '').toLowerCase().includes('matriz');
            const dedupKey = isMatriz ? 'MATRIZ' : String(m?.filialCodigo || m?.filialId || m?.filialNome || '').toUpperCase();
            if (dedupKey && seenCodigos.has(dedupKey)) return;
            if (dedupKey) seenCodigos.add(dedupKey);

            const fName = String(m?.filialNome || '').toLowerCase();
            const fCod = String(m?.filialCodigo || '').toLowerCase();
            const fId = String(m?.filialId || '').toLowerCase();
            const isP = fName.includes('piauí') || fName.includes('piaui') || fCod.includes('piaui') || fId.includes('piaui');
            const isS = fName.includes('shopee') || fCod.includes('shopee') || fId.includes('shopee');
            const isF = !isP && !isS;

            if ((loc === 'PIAUI' && isP) || (loc === 'SHOPEE' && isS) || (loc === 'FORTALEZA' && isF)) {
              const val = getMonthlyMetaForFilial(m, mIdx);
              if (val !== null) {
                sum += val;
                found = true;
              }
            }
          });
        }

        if (found) return sum;
        if (loc === 'FORTALEZA') return 750000;
        if (loc === 'PIAUI') return 150000;
        if (loc === 'SHOPEE') return 100000;
        return 0;
      };

      if (metasSource && typeof metasSource === 'object') {

        if (effectiveFilialFilter === 'ALL') {
          let sumMetas = 0;
          let matchedCount = 0;

          if (targetBranches.length > 0) {
            // Itera SOMENTE sobre as filiais reais do sistema, garantindo que Matriz seja somada apenas uma vez
            targetBranches.forEach((filial) => {
              const fMeta =
                metasSource[filial.id] ||
                metasSource[filial.codigo] ||
                Object.values(metasSource).find(
                  (m: any) =>
                    m?.filialId === filial.id ||
                    m?.filialCodigo === filial.codigo ||
                    (m?.filialNome && m.filialNome.toLowerCase() === filial.nome.toLowerCase())
                );
              const val = getMonthlyMetaForFilial(fMeta, currentMonth);
              if (val !== null) {
                sumMetas += val;
                matchedCount++;
              }
            });
          } else {
            // Se targetBranches ainda estiver vazio, deduplica por filialCodigo (ex: MATRIZ só conta 1x)
            const seenCodigos = new Set<string>();
            Object.values(metasSource).forEach((fMeta: any) => {
              const codeKey = String(fMeta?.filialCodigo || fMeta?.filialId || '').toUpperCase();
              if (codeKey && seenCodigos.has(codeKey)) return;
              if (codeKey) seenCodigos.add(codeKey);

              const val = getMonthlyMetaForFilial(fMeta, currentMonth);
              if (val !== null) {
                sumMetas += val;
                matchedCount++;
              }
            });
          }

          if (matchedCount > 0) {
            calculatedMetaMensal = sumMetas;
            hasFoundConfiguredMeta = true;
          }
        } else if (effectiveFilialFilter === 'FORTALEZA') {
          calculatedMetaMensal = getMetaForLocation('FORTALEZA', currentMonth);
          hasFoundConfiguredMeta = true;
        } else if (effectiveFilialFilter === 'SHOPEE') {
          calculatedMetaMensal = getMetaForLocation('SHOPEE', currentMonth);
          hasFoundConfiguredMeta = true;
        } else if (effectiveFilialFilter === 'PIAUI') {
          calculatedMetaMensal = getMetaForLocation('PIAUI', currentMonth);
          hasFoundConfiguredMeta = true;
        } else if (effectiveFilialFilter === 'FORTALEZA_SHOPEE') {
          calculatedMetaMensal = getMetaForLocation('FORTALEZA', currentMonth) + getMetaForLocation('SHOPEE', currentMonth);
          hasFoundConfiguredMeta = true;
        } else if (effectiveFilialFilter === 'PIAUI_SHOPEE') {
          calculatedMetaMensal = getMetaForLocation('PIAUI', currentMonth) + getMetaForLocation('SHOPEE', currentMonth);
          hasFoundConfiguredMeta = true;
        } else {
          const currentFilialObj = targetBranches.find(
            (f) => f.id === effectiveFilialFilter || f.codigo === effectiveFilialFilter
          );
          const fMeta =
            metasSource[effectiveFilialFilter] ||
            (currentFilialObj ? metasSource[currentFilialObj.id] : null) ||
            (currentFilialObj ? metasSource[currentFilialObj.codigo] : null) ||
            Object.values(metasSource).find(
              (m: any) =>
                m?.filialId === effectiveFilialFilter ||
                (currentFilialObj && m?.filialCodigo === currentFilialObj.codigo) ||
                (currentFilialObj && m?.filialNome?.toLowerCase() === currentFilialObj.nome.toLowerCase())
            );

          const val = getMonthlyMetaForFilial(fMeta, currentMonth);
          if (val !== null) {
            calculatedMetaMensal = val;
            hasFoundConfiguredMeta = true;
          }
        }
      }

      if (!hasFoundConfiguredMeta) {
        calculatedMetaMensal = effectiveFilialFilter === 'ALL' ? 750000 * Math.max(1, filiaisList.length) : 750000;
      }

      setMetaMensal(calculatedMetaMensal);
      const pctMensal = calculatedMetaMensal > 0 ? (monthTotal / calculatedMetaMensal) * 100 : 0;
      setMetaMensalPorcentagem(pctMensal);
      const faltaMensal = Math.max(0, calculatedMetaMensal - monthTotal);
      setQuantoFaltaMetaMensal(faltaMensal);

      // --- Monthly Evolution (12 Meses com Cores Únicas por Mês) ---
      // No dashboard dos vendedores: exibir estritamente suas vendas individuais e meta individual
      const isSellerIndividualView = Boolean(isIndividualSalesView);
      const getTargetMetaForMonthIdx = (monthIdx: number): number => {
        if (isSellerIndividualView && empMetaIndiv > 0) return empMetaIndiv;
        if (!metasSource || typeof metasSource !== 'object') return calculatedMetaMensal;

        const targetBranches = currentBranches.length > 0 ? currentBranches : filiaisList;

        if (effectiveFilialFilter === 'ALL') {
          let sum = 0;
          let found = false;
          if (targetBranches.length > 0) {
            targetBranches.forEach((filial) => {
              const fMeta =
                metasSource[filial.id] ||
                metasSource[filial.codigo] ||
                Object.values(metasSource).find(
                  (m: any) =>
                    m?.filialId === filial.id ||
                    m?.filialCodigo === filial.codigo ||
                    (m?.filialNome && m.filialNome.toLowerCase() === filial.nome.toLowerCase())
                );
              const val = getMonthlyMetaForFilial(fMeta, monthIdx);
              if (val !== null) {
                sum += val;
                found = true;
              }
            });
          }
          return found ? sum : calculatedMetaMensal;
        } else if (effectiveFilialFilter === 'FORTALEZA') {
          return getMetaForLocation('FORTALEZA', monthIdx);
        } else if (effectiveFilialFilter === 'SHOPEE') {
          return getMetaForLocation('SHOPEE', monthIdx);
        } else if (effectiveFilialFilter === 'PIAUI') {
          return getMetaForLocation('PIAUI', monthIdx);
        } else if (effectiveFilialFilter === 'FORTALEZA_SHOPEE') {
          return getMetaForLocation('FORTALEZA', monthIdx) + getMetaForLocation('SHOPEE', monthIdx);
        } else if (effectiveFilialFilter === 'PIAUI_SHOPEE') {
          return getMetaForLocation('PIAUI', monthIdx) + getMetaForLocation('SHOPEE', monthIdx);
        } else {
          const currentFilialObj = targetBranches.find(
            (f) => f.id === effectiveFilialFilter || f.codigo === effectiveFilialFilter
          );
          const fMeta =
            metasSource[effectiveFilialFilter] ||
            (currentFilialObj ? metasSource[currentFilialObj.id] : null) ||
            (currentFilialObj ? metasSource[currentFilialObj.codigo] : null) ||
            Object.values(metasSource).find(
              (m: any) =>
                m?.filialId === effectiveFilialFilter ||
                (currentFilialObj && m?.filialCodigo === currentFilialObj.codigo) ||
                (currentFilialObj && m?.filialNome?.toLowerCase() === currentFilialObj.nome.toLowerCase())
            );
          const val = getMonthlyMetaForFilial(fMeta, monthIdx);
          return val !== null ? val : calculatedMetaMensal;
        }
      };

      const monthlyBuckets: MonthlyEvolutionItem[] = Array.from({ length: 12 }, (_, idx) => {
        return {
          mes: MONTH_NAMES_SHORT[idx],
          mesCompleto: MONTH_NAMES_FULL[idx],
          faturamento: 0,
          pedidos: 0,
          meta: getTargetMetaForMonthIdx(idx),
          atingimento: 0,
          ticketMedio: 0,
          color: MONTH_PALETTE[idx],
        };
      });

      // Sum OS and PDV per month for current year
      filteredOS.forEach((os) => {
        const sellerName = (os as any).vendedorNome || (os as any).vendedor || os.operador || (os as any).operadorNome || (os as any).criadoPor || (os as any).createdBy || (os as any).responsavel || (os as any).atendente;
        const belongsToUser = isUserTransaction(
          sellerName,
          (os as any).criadoPor || (os as any).createdBy,
          os.operador || (os as any).operadorNome,
          (os as any).responsavel || (os as any).atendente
        );

        // Se for vendedor/recepção individual, contabiliza apenas suas vendas
        if (isSellerIndividualView && !belongsToUser) {
          return;
        }

        const osDate = parseDateSafe(os.createdAt || (os as any).dataCriacao || (os as any).dataVenda || (os as any).data);
        if (osDate.getFullYear() === currentYear) {
          const m = osDate.getMonth();
          if (m >= 0 && m < 12) {
            const val = Number(os.valorFinal) || Number((os as any).valorTotal) || Number(os.subtotal) || 0;
            monthlyBuckets[m].faturamento += val;
            monthlyBuckets[m].pedidos += 1;
          }
        }
      });

      directPDV.forEach((pdv) => {
        const belongsToUser = isUserTransaction(
          pdv.vendedorNome || (pdv as any).vendedor,
          pdv.usuario || pdv.createdBy,
          pdv.operadorNome || pdv.operador,
          (pdv as any).atendente
        );

        // Se for vendedor/recepção individual, contabiliza apenas suas vendas
        if (isSellerIndividualView && !belongsToUser) {
          return;
        }

        const pdvDate = parseDateSafe(pdv.createdAt || pdv.dataVenda || (pdv as any).data || (pdv as any).dataHora);
        if (pdvDate.getFullYear() === currentYear) {
          const m = pdvDate.getMonth();
          if (m >= 0 && m < 12) {
            const val = Number(pdv.valorTotal) || Number(pdv.subtotal) || 0;
            monthlyBuckets[m].faturamento += val;
            monthlyBuckets[m].pedidos += 1;
          }
        }
      });

      monthlyBuckets.forEach((b) => {
        b.atingimento = b.meta > 0 ? (b.faturamento / b.meta) * 100 : 0;
        b.ticketMedio = b.pedidos > 0 ? b.faturamento / b.pedidos : 0;
      });

      setMonthlyEvolutionData(monthlyBuckets);

      // Update Individual Metrics
      setFaturamentoIndividualMensal(indivMonthTotal);
      setFaturamentoIndividualMesAnterior(indivPrevMonthTotal);
      setPedidosIndividualMes(indivMonthCount);
      setTicketMedioIndividual(indivMonthCount > 0 ? indivMonthTotal / indivMonthCount : 0);
      
      // Regra de comissão: calculada ESTRITAMENTE sobre vendas pagas (vendas pendentes NÃO geram comissão)
      const indivComissaoCalculada = (indivPaidMonthTotal * empComissaoPct) / 100;
      setComissaoValorMensal(indivComissaoCalculada);

      const indivMetaPct = empMetaIndiv > 0 ? Math.min(100, (indivMonthTotal / empMetaIndiv) * 100) : 0;
      setMetaIndividualPorcentagem(indivMetaPct);

      // --- SUPERVISOR SPECIFIC CALCULATIONS (Vendedores & Recepção base) ---
      const isSalesOrReceptionPerson = (
        nameInput?: string,
        creatorInput?: string,
        operatorInput?: string,
        extraInput?: string
      ) => {
        const n1 = (nameInput || '').trim().toLowerCase();
        const n2 = (creatorInput || '').trim().toLowerCase();
        const n3 = (operatorInput || '').trim().toLowerCase();
        const n4 = (extraInput || '').trim().toLowerCase();

        const match = employees.find((e) => {
          const fn = `${e.nome} ${e.sobrenome || ''}`.trim().toLowerCase();
          const sim = e.nome.trim().toLowerCase();
          const usr = (e.loginUsuario || '').trim().toLowerCase();
          return (
            (n1 && (fn === n1 || sim === n1 || usr === n1 || n1.includes(sim) || fn.includes(n1))) ||
            (n2 && (fn === n2 || sim === n2 || usr === n2 || n2.includes(sim) || fn.includes(n2))) ||
            (n3 && (fn === n3 || sim === n3 || usr === n3 || n3.includes(sim) || fn.includes(n3))) ||
            (n4 && (fn === n4 || sim === n4 || usr === n4 || n4.includes(sim) || fn.includes(n4)))
          );
        });

        if (match) {
          const roleNorm = normalizeRoleName(match.cargo || '');
          return (
            roleNorm === 'Vendedor(a)' ||
            roleNorm === 'Recepção' ||
            roleNorm.toLowerCase().includes('vendedor') ||
            roleNorm.toLowerCase().includes('recep') ||
            roleNorm.toLowerCase().includes('comercial') ||
            roleNorm.toLowerCase().includes('atendente') ||
            roleNorm.toLowerCase().includes('supervisor') ||
            roleNorm.toLowerCase().includes('gerente') ||
            isRoleAuthorizedForSales(match.cargo, false)
          );
        }

        // If no explicit match in employee directory, all direct registered sales are counted
        return true;
      };

      let supMonthTotal = 0;
      let supPrevMonthTotal = 0;
      let supMonthCount = 0;

      filteredOS.forEach((os) => {
        const osDate = parseDateSafe(os.createdAt || (os as any).dataCriacao || (os as any).dataVenda || (os as any).data);
        const val = Number(os.valorFinal) || Number((os as any).valorTotal) || Number(os.subtotal) || 0;
        const sellerName = (os as any).vendedorNome || (os as any).vendedor || os.operador || (os as any).operadorNome || (os as any).criadoPor || (os as any).createdBy || (os as any).responsavel || (os as any).atendente;
        const isSales = isSalesOrReceptionPerson(sellerName, (os as any).criadoPor || (os as any).createdBy, os.operador || (os as any).operadorNome, (os as any).responsavel || (os as any).atendente);

        if (isSales) {
          if (osDate.getFullYear() === currentYear && osDate.getMonth() === currentMonth) {
            supMonthTotal += val;
            supMonthCount++;
          }
          if (osDate.getFullYear() === previousMonthYear && osDate.getMonth() === previousMonth) {
            supPrevMonthTotal += val;
          }
        }
      });

      directPDV.forEach((pdv) => {
        const pdvDate = parseDateSafe(pdv.createdAt || pdv.dataVenda || (pdv as any).data || (pdv as any).dataHora);
        const val = Number(pdv.valorTotal) || Number(pdv.subtotal) || 0;
        const isSales = isSalesOrReceptionPerson(
          pdv.vendedorNome || (pdv as any).vendedor,
          pdv.usuario || pdv.createdBy,
          pdv.operadorNome || pdv.operador,
          (pdv as any).atendente
        );

        if (isSales) {
          if (pdvDate.getFullYear() === currentYear && pdvDate.getMonth() === currentMonth) {
            supMonthTotal += val;
            supMonthCount++;
          }
          if (pdvDate.getFullYear() === previousMonthYear && pdvDate.getMonth() === previousMonth) {
            supPrevMonthTotal += val;
          }
        }
      });

      // Fallback if no specific seller tag found
      if (supMonthTotal === 0 && monthTotal > 0) {
        supMonthTotal = monthTotal;
        supPrevMonthTotal = prevMonthTotal;
        supMonthCount = monthCount;
      }

      setSupervisorFaturamentoMensal(supMonthTotal);
      setSupervisorFaturamentoMesAnterior(supPrevMonthTotal);
      setSupervisorTotalOsMes(supMonthCount);
      setSupervisorTicketMedio(supMonthCount > 0 ? supMonthTotal / supMonthCount : 0);

      // --- Daily Line Chart Data for Supervisor (Selected Month) ---
      const targetChartMonth = selectedSupervisorChartMonth >= 0 && selectedSupervisorChartMonth <= 11
        ? selectedSupervisorChartMonth
        : currentMonth;
      const daysInTargetMonth = new Date(currentYear, targetChartMonth + 1, 0).getDate();

      // Track active sellers and their daily sales
      const sellersTargetMonthMap: Record<string, { name: string; cargo: string; total: number }> = {};
      const dailyBuckets = Array.from({ length: daysInTargetMonth }, (_, i) => {
        const dayNum = i + 1;
        return {
          diaNum: dayNum,
          dia: `Dia ${dayNum}`,
          Total: 0,
        } as any;
      });

      filteredOS.forEach((os) => {
        const osDate = parseDateSafe(os.createdAt || (os as any).dataCriacao || (os as any).dataVenda || (os as any).data);
        if (osDate.getFullYear() === currentYear && osDate.getMonth() === targetChartMonth) {
          const val = Number(os.valorFinal) || Number((os as any).valorTotal) || Number(os.subtotal) || 0;
          const day = osDate.getDate();
          const rawSeller = (
            (os as any).vendedorNome ||
            (os as any).vendedor ||
            os.operador ||
            (os as any).operadorNome ||
            (os as any).criadoPor ||
            (os as any).createdBy ||
            (os as any).responsavel ||
            (os as any).atendente ||
            'Vendedor'
          ).trim();
          
          if (!sellersTargetMonthMap[rawSeller]) {
            const matched = employees.find(
              (e) =>
                `${e.nome} ${e.sobrenome || ''}`.trim().toLowerCase() === rawSeller.toLowerCase() ||
                e.nome.trim().toLowerCase() === rawSeller.toLowerCase() ||
                (e.loginUsuario && e.loginUsuario.toLowerCase() === rawSeller.toLowerCase())
            );
            sellersTargetMonthMap[rawSeller] = {
              name: rawSeller,
              cargo: matched?.cargo || 'Vendedor(a)',
              total: 0,
            };
          }
          sellersTargetMonthMap[rawSeller].total += val;

          if (day >= 1 && day <= daysInTargetMonth) {
            dailyBuckets[day - 1][rawSeller] = (dailyBuckets[day - 1][rawSeller] || 0) + val;
            dailyBuckets[day - 1].Total += val;
          }
        }
      });

      directPDV.forEach((pdv) => {
        const pdvDate = parseDateSafe(pdv.createdAt || pdv.dataVenda || (pdv as any).data || (pdv as any).dataHora);
        if (pdvDate.getFullYear() === currentYear && pdvDate.getMonth() === targetChartMonth) {
          const val = Number(pdv.valorTotal) || Number(pdv.subtotal) || 0;
          const day = pdvDate.getDate();
          const rawSeller = (
            pdv.vendedorNome ||
            (pdv as any).vendedor ||
            pdv.operadorNome ||
            pdv.operador ||
            pdv.usuario ||
            pdv.createdBy ||
            (pdv as any).atendente ||
            'Recepção'
          ).trim();

          if (!sellersTargetMonthMap[rawSeller]) {
            const matched = employees.find(
              (e) =>
                `${e.nome} ${e.sobrenome || ''}`.trim().toLowerCase() === rawSeller.toLowerCase() ||
                e.nome.trim().toLowerCase() === rawSeller.toLowerCase() ||
                (e.loginUsuario && e.loginUsuario.toLowerCase() === rawSeller.toLowerCase())
            );
            sellersTargetMonthMap[rawSeller] = {
              name: rawSeller,
              cargo: matched?.cargo || 'Recepção',
              total: 0,
            };
          }
          sellersTargetMonthMap[rawSeller].total += val;

          if (day >= 1 && day <= daysInTargetMonth) {
            dailyBuckets[day - 1][rawSeller] = (dailyBuckets[day - 1][rawSeller] || 0) + val;
            dailyBuckets[day - 1].Total += val;
          }
        }
      });

      const sortedActiveSellers = Object.values(sellersTargetMonthMap)
        .sort((a, b) => b.total - a.total)
        .map((s, idx) => ({
          name: s.name,
          cargo: s.cargo,
          totalMes: s.total,
          color: SELLER_LINE_COLORS[idx % SELLER_LINE_COLORS.length],
        }));

      // Ensure every bucket has all active sellers defined (as 0 if not present) so lines render cleanly
      dailyBuckets.forEach((bucket) => {
        sortedActiveSellers.forEach((s) => {
          if (bucket[s.name] === undefined) {
            bucket[s.name] = 0;
          }
        });
      });

      setDailyActiveSellers(sortedActiveSellers);
      setDailySellersChartData(dailyBuckets);

      // --- Production Flow Counts (Fluxo Geral de Produção Têxtil: 8 Estágios) ---
      // DESIGNER | IMPRESSÃO | CALANDRA | COSTURA | EXCURSÃO | CORREIOS | SHOPEE | RETIRADA(Recepção)
      const flowCounts: Record<string, number> = {
        'DESIGNER': 0,
        'IMPRESSÃO': 0,
        'CALANDRA': 0,
        'COSTURA': 0,
        'EXCURSÃO': 0,
        'CORREIOS': 0,
        'SHOPEE': 0,
        'RETIRADA(Recepção)': 0,
      };

      const flowOrders: Record<string, OrdemServico[]> = {
        'DESIGNER': [],
        'IMPRESSÃO': [],
        'CALANDRA': [],
        'COSTURA': [],
        'EXCURSÃO': [],
        'CORREIOS': [],
        'SHOPEE': [],
        'RETIRADA(Recepção)': [],
      };

      let lateCount = 0;
      const todayISO = new Date().toISOString().split('T')[0];

      filteredOS.forEach((os) => {
        // Desconsidera orçamentos puros
        if ((os as any).isOrcamento || (os as any).tipoDocumento === 'ORCAMENTO' || os.codigo?.startsWith('ORC')) {
          return;
        }
        const cod = (os.codigo || '').toUpperCase();
        if (cod.startsWith('VND') || cod.startsWith('PDV')) {
          return;
        }

        const stage = (os.estagioAtual || (os as any).statusProcesso || '').toLowerCase().trim();
        const status = (os.status || '').toLowerCase().trim();

        // CLÁUSULA DE PROTEÇÃO CONTRA REGRESSÃO:
        // Enquanto a OS estiver em "Aguardando Entrada no Fluxo de Produção" (estágio "Sistema"),
        // ela NÃO DEVE ser exibida no fluxo de produção/expedição.
        if (
          stage === 'sistema' ||
          stage === 'aguardando entrada no fluxo de produção' ||
          stage === 'aguardando entrada'
        ) {
          return;
        }

        // Desconsidera canceladas ou deletadas
        if (status === 'cancelado' || status === 'cancelada' || (os as any).deletedAt) {
          return;
        }

        // Checagem de atraso para pedidos no fluxo ativo
        if (
          os.prazoEntrega &&
          os.prazoEntrega < todayISO &&
          !status.includes('conclu') &&
          !status.includes('entreg') &&
          !status.includes('cancel')
        ) {
          lateCount++;
        }

        const obs = (os.observacoes || '').toLowerCase();
        const destino = String((os as any).destinoExpedicao || (os as any).destino || '').toLowerCase();
        const canal = String((os as any).canal || (os as any).canalVenda || (os as any).origem || '').toLowerCase();
        const cliente = String(os.clienteNome || (os as any).cliente || '').toLowerCase();
        const tipoExp = String(os.tipoExpedicao || '').toLowerCase();
        const historicoStr = (os.historicoEdicoes || []).map((h) => `${h.acao} ${h.detalhes || ''}`).join(' ').toLowerCase();

        // Identifica se é do canal ou destino Shopee
        const isShopeeOrder =
          stage.includes('shopee') ||
          destino.includes('shopee') ||
          canal.includes('shopee') ||
          cliente.includes('shopee') ||
          tipoExp.includes('shopee') ||
          obs.includes('shopee') ||
          historicoStr.includes('shopee');

        // 1. Etapas de Fabricação Ativa (DESIGNER, IMPRESSÃO, CALANDRA, COSTURA)
        if (stage.includes('design') || stage.includes('arte') || stage.includes('cria')) {
          flowCounts['DESIGNER']++;
          flowOrders['DESIGNER'].push(os);
        } else if (stage.includes('impress') || stage.includes('print')) {
          flowCounts['IMPRESSÃO']++;
          flowOrders['IMPRESSÃO'].push(os);
        } else if (stage.includes('calandr') || stage.includes('prensa')) {
          flowCounts['CALANDRA']++;
          flowOrders['CALANDRA'].push(os);
        } else if (stage.includes('costur') || stage.includes('acabamento')) {
          flowCounts['COSTURA']++;
          flowOrders['COSTURA'].push(os);
        }
        // 2. Destinos de Expedição & Entrega (EXCURSÃO, CORREIOS, SHOPEE, RETIRADA(Recepção))
        // REGRA DE OURO: Quando o destino de envio foi explicitamente definido (destinoExpedicao / destino),
        // ele tem PREVALÊNCIA ABSOLUTA sobre qualquer outro campo!
        else if (destino.includes('shopee')) {
          flowCounts['SHOPEE']++;
          flowOrders['SHOPEE'].push(os);
        } else if (destino.includes('correio')) {
          flowCounts['CORREIOS']++;
          flowOrders['CORREIOS'].push(os);
        } else if (destino.includes('excurs')) {
          flowCounts['EXCURSÃO']++;
          flowOrders['EXCURSÃO'].push(os);
        } else if (destino.includes('retirada') || destino.includes('recep')) {
          flowCounts['RETIRADA(Recepção)']++;
          flowOrders['RETIRADA(Recepção)'].push(os);
        }
        // Casos em que o destino de envio ainda NÃO foi explicitamente selecionado pelo operador:
        else if (stage.includes('shopee') || isShopeeOrder) {
          flowCounts['SHOPEE']++;
          flowOrders['SHOPEE'].push(os);
        } else if (stage.includes('correio') || tipoExp.includes('correio') || canal.includes('correio')) {
          flowCounts['CORREIOS']++;
          flowOrders['CORREIOS'].push(os);
        } else if (stage.includes('excurs') || tipoExp.includes('excurs')) {
          flowCounts['EXCURSÃO']++;
          flowOrders['EXCURSÃO'].push(os);
        } else if (stage.includes('retirada') || stage.includes('recep')) {
          flowCounts['RETIRADA(Recepção)']++;
          flowOrders['RETIRADA(Recepção)'].push(os);
        } else {
          // Se a OS já concluiu etapas de costura / está em expedição, conferência, entrega ou concluído
          // e não tem canal específico, o destino natural de balcão é RETIRADA(Recepção)
          if (
            stage.includes('confer') ||
            stage.includes('expedi') ||
            stage.includes('entreg') ||
            stage.includes('pronto') ||
            stage.includes('conclu') ||
            os.expedido
          ) {
            flowCounts['RETIRADA(Recepção)']++;
            flowOrders['RETIRADA(Recepção)'].push(os);
          } else {
            // Padrão do fluxo inicial de fabricação: Designer
            flowCounts['DESIGNER']++;
            flowOrders['DESIGNER'].push(os);
          }
        }
      });

      setProductionFlow([
        { name: 'DESIGNER', count: flowCounts['DESIGNER'], color: 'bg-purple-600', textColor: 'text-purple-700', badgeBg: 'bg-purple-50', borderColor: 'border-purple-200', key: 'DESIGNER', icon: Palette },
        { name: 'IMPRESSÃO', count: flowCounts['IMPRESSÃO'], color: 'bg-blue-600', textColor: 'text-blue-700', badgeBg: 'bg-blue-50', borderColor: 'border-blue-200', key: 'IMPRESSÃO', icon: Printer },
        { name: 'CALANDRA', count: flowCounts['CALANDRA'], color: 'bg-orange-500', textColor: 'text-orange-700', badgeBg: 'bg-orange-50', borderColor: 'border-orange-200', key: 'CALANDRA', icon: Flame },
        { name: 'COSTURA', count: flowCounts['COSTURA'], color: 'bg-rose-600', textColor: 'text-rose-700', badgeBg: 'bg-rose-50', borderColor: 'border-rose-200', key: 'COSTURA', icon: Scissors },
        { name: 'EXCURSÃO', count: flowCounts['EXCURSÃO'], color: 'bg-red-600', textColor: 'text-red-700', badgeBg: 'bg-red-50', borderColor: 'border-red-200', key: 'EXCURSÃO', icon: Truck, isDestination: true },
        { name: 'CORREIOS', count: flowCounts['CORREIOS'], color: 'bg-amber-600', textColor: 'text-amber-700', badgeBg: 'bg-amber-50', borderColor: 'border-amber-200', key: 'CORREIOS', icon: Package, isDestination: true },
        { name: 'SHOPEE', count: flowCounts['SHOPEE'], color: 'bg-orange-600', textColor: 'text-orange-700', badgeBg: 'bg-orange-50', borderColor: 'border-orange-200', key: 'SHOPEE', icon: ShoppingBag, isDestination: true },
        { name: 'RETIRADA(Recepção)', count: flowCounts['RETIRADA(Recepção)'], color: 'bg-emerald-600', textColor: 'text-emerald-700', badgeBg: 'bg-emerald-50', borderColor: 'border-emerald-200', key: 'RETIRADA(Recepção)', icon: Store, isDestination: true },
      ]);
      setFlowOrdersMap(flowOrders);

      setPedidosAtrasadosCount(lateCount);

      // --- Top Sellers Ranking Computation (Current Month) ---
      // Vendedores entram no ranking mesmo com vendas pendentes (comissão apurada estritamente sobre as pagas)
      const sellersMap: Record<
        string,
        {
          id: string;
          name: string;
          cargo: string;
          salesTotal: number;
          count: number;
          osCount: number;
          osTotal: number;
          vndCount: number;
          vndTotal: number;
          paidCount: number;
          paidTotal: number;
          pendingCount: number;
          pendingTotal: number;
        }
      > = {};

      // 1. Atribui vendas de OS no mês atual ao vendedor canônico (inclui pagas e pendentes no ranking)
      filteredOS.forEach((os) => {
        const osDate = parseDateSafe(os.createdAt || (os as any).dataCriacao || (os as any).dataVenda || (os as any).data);
        if (osDate.getFullYear() === currentYear && osDate.getMonth() === currentMonth) {
          const rawSeller =
            (os as any).vendedorNome ||
            (os as any).vendedor ||
            os.operador ||
            (os as any).operadorNome ||
            (os as any).criadoPor ||
            (os as any).createdBy ||
            (os as any).responsavel ||
            (os as any).atendente ||
            'Vendedor';
          const canonical = resolveCanonicalSeller(rawSeller, employees, user);
          const val = Number(os.valorFinal) || Number((os as any).valorTotal) || Number(os.subtotal) || 0;
          const isPago = isOsEfetivamentePaga(os);

          if (!sellersMap[canonical.id]) {
            sellersMap[canonical.id] = {
              id: canonical.id,
              name: canonical.name,
              cargo: canonical.cargo,
              salesTotal: 0,
              count: 0,
              osCount: 0,
              osTotal: 0,
              vndCount: 0,
              vndTotal: 0,
              paidCount: 0,
              paidTotal: 0,
              pendingCount: 0,
              pendingTotal: 0,
            };
          }
          sellersMap[canonical.id].salesTotal += val;
          sellersMap[canonical.id].count += 1;
          sellersMap[canonical.id].osTotal += val;
          sellersMap[canonical.id].osCount += 1;

          if (isPago) {
            sellersMap[canonical.id].paidTotal += val;
            sellersMap[canonical.id].paidCount += 1;
          } else {
            sellersMap[canonical.id].pendingTotal += val;
            sellersMap[canonical.id].pendingCount += 1;
          }
        }
      });

      // 2. Atribui vendas puras de Balcão / PDV (VND) no mês atual (inclui pagas e pendentes no ranking)
      directPDV.forEach((pdv) => {
        const pdvDate = parseDateSafe(pdv.createdAt || pdv.dataVenda || (pdv as any).data || (pdv as any).dataHora);
        if (pdvDate.getFullYear() === currentYear && pdvDate.getMonth() === currentMonth) {
          const rawSeller =
            pdv.vendedorNome ||
            (pdv as any).vendedor ||
            pdv.operadorNome ||
            pdv.operador ||
            pdv.usuario ||
            pdv.createdBy ||
            (pdv as any).atendente ||
            'Recepção';
          const canonical = resolveCanonicalSeller(rawSeller, employees, user);
          const val = Number(pdv.valorTotal) || Number(pdv.subtotal) || 0;
          const isPago = isPdvEfetivamentePago(pdv);

          if (!sellersMap[canonical.id]) {
            sellersMap[canonical.id] = {
              id: canonical.id,
              name: canonical.name,
              cargo: canonical.cargo,
              salesTotal: 0,
              count: 0,
              osCount: 0,
              osTotal: 0,
              vndCount: 0,
              vndTotal: 0,
              paidCount: 0,
              paidTotal: 0,
              pendingCount: 0,
              pendingTotal: 0,
            };
          }
          sellersMap[canonical.id].salesTotal += val;
          sellersMap[canonical.id].count += 1;
          sellersMap[canonical.id].vndTotal += val;
          sellersMap[canonical.id].vndCount += 1;

          if (isPago) {
            sellersMap[canonical.id].paidTotal += val;
            sellersMap[canonical.id].paidCount += 1;
          } else {
            sellersMap[canonical.id].pendingTotal += val;
            sellersMap[canonical.id].pendingCount += 1;
          }
        }
      });

      // Filtra vendedores autorizados ou com vendas reais computadas
      const validSellersList = Object.values(sellersMap).filter((item) => {
        const roleNorm = normalizeRoleName(item.cargo);
        return (
          isRoleAuthorizedForSales(item.cargo, false) ||
          roleNorm.toLowerCase().includes('developer') ||
          roleNorm.toLowerCase().includes('diret') ||
          roleNorm.toLowerCase().includes('geren') ||
          roleNorm.toLowerCase().includes('superv') ||
          item.salesTotal > 0
        );
      });

      const allSortedSellers = (validSellersList.length > 0 ? validSellersList : Object.values(sellersMap))
        .filter((s) => s.salesTotal > 0)
        .sort((a, b) => b.salesTotal - a.salesTotal);

      setTotalVendedoresNoRanking(Math.max(1, allSortedSellers.length));

      // Determina posição do usuário logado no ranking (inclui vendas pendentes no ranking)
      if (indivMonthCount === 0 || indivMonthTotal === 0) {
        setMinhaPosicaoRanking(0);
      } else {
        const myRankIdx = allSortedSellers.findIndex((s) =>
          isUserTransaction(s.name, s.name, s.name, s.name)
        );
        setMinhaPosicaoRanking(myRankIdx >= 0 ? myRankIdx + 1 : 0);
      }

      // Prepara lista completa de ranking com cores do modelo e barras de desempenho
      const grandTotalSales = allSortedSellers.reduce((sum, s) => sum + s.salesTotal, 0);
      const topSortedItems: TopSellerItem[] = allSortedSellers.map((item, idx) => {
        const rank = idx + 1;
        let badgeColor = 'bg-slate-100 text-slate-700 border-slate-300';
        let icon = undefined;

        if (rank === 1) {
          badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
          icon = Crown;
        } else if (rank === 2) {
          badgeColor = 'bg-slate-200 text-slate-800 border-slate-400';
          icon = Medal;
        } else if (rank === 3) {
          badgeColor = 'bg-amber-700/10 text-amber-900 border-amber-700/30';
          icon = Award;
        }

        const barColor = RANKING_PERFORMANCE_COLORS[idx % RANKING_PERFORMANCE_COLORS.length];
        const pct = grandTotalSales > 0 ? Number(((item.salesTotal / grandTotalSales) * 100).toFixed(1)) : 100;
        const widthPct =
          allSortedSellers[0]?.salesTotal > 0
            ? Math.max(16, Math.round((item.salesTotal / allSortedSellers[0].salesTotal) * 100))
            : 100;

        return {
          id: item.id,
          rank,
          name: item.name,
          cargo: normalizeRoleName(item.cargo || 'Vendedor(a)'),
          salesTotal: item.salesTotal,
          count: item.count,
          osCount: item.osCount,
          osTotal: item.osTotal,
          vndCount: item.vndCount,
          vndTotal: item.vndTotal,
          paidCount: item.paidCount,
          paidTotal: item.paidTotal,
          pendingCount: item.pendingCount,
          pendingTotal: item.pendingTotal,
          percentageOfTotal: pct,
          barColor,
          widthPct,
          badgeColor,
          icon,
        };
      });

      setAllRankingSellers(topSortedItems);
      setTopSellers(topSortedItems.slice(0, 5));

      // --- Recent Activities Feed ---
      const activities: ActivityItem[] = [];

      // If individual view: filter activities to show only the user's transactions
      const targetOSList = isIndividualSalesView
        ? filteredOS.filter((os) =>
            isUserTransaction(
              (os as any).vendedorNome || (os as any).vendedor || os.operador || (os as any).operadorNome,
              (os as any).criadoPor || (os as any).createdBy,
              os.operador || (os as any).operadorNome,
              (os as any).responsavel || (os as any).atendente
            )
          )
        : filteredOS;

      const targetPDVList = isIndividualSalesView
        ? directPDV.filter((pdv) =>
            isUserTransaction(
              pdv.vendedorNome || (pdv as any).vendedor,
              pdv.usuario || pdv.createdBy,
              pdv.operadorNome || pdv.operador,
              (pdv as any).atendente
            )
          )
        : directPDV;

      targetOSList.slice(0, 5).forEach((os) => {
        const destino = (os as any).destinoExpedicao || (os as any).destino;
        activities.push({
          id: `os-${os.id}`,
          title: `Ordem de Serviço ${os.codigo || (os as any).codigoOS || 'OS'}`,
          details: `Cliente: ${os.clienteNome || 'Cliente'} • Valor: R$ ${Number(os.valorFinal || 0).toFixed(2)}${destino ? ` • Destino: ${destino}` : ''}`,
          time: formatRelativeTime(os.createdAt || (os as any).dataCriacao),
          color: 'bg-blue-500',
          timestamp: os.createdAt || (os as any).dataCriacao || new Date().toISOString(),
          destino: destino || undefined,
        });
      });

      targetPDVList.slice(0, 3).forEach((pdv) => {
        activities.push({
          id: `pdv-${pdv.id}`,
          title: `Venda Direta PDV #${pdv.codigoVenda || (pdv as any).vendaCodigo || pdv.id.substring(0, 6)}`,
          details: `Atendente: ${pdv.vendedorNome || pdv.operadorNome || 'Você'} • Total: R$ ${Number(pdv.valorTotal || 0).toFixed(2)}`,
          time: formatRelativeTime(pdv.createdAt || pdv.dataVenda),
          color: 'bg-emerald-500',
          timestamp: pdv.createdAt || pdv.dataVenda || new Date().toISOString(),
        });
      });

      if (!isIndividualSalesView) {
        employees.slice(0, 3).forEach((emp) => {
          activities.push({
            id: `emp-${emp.id}`,
            title: `Colaborador ${emp.nome} ${emp.sobrenome || ''}`,
            details: `Cargo: ${emp.cargo} • Filial: ${emp.filialNome || 'Matriz'}`,
            time: formatRelativeTime(emp.createdAt),
            color: 'bg-purple-500',
            timestamp: emp.createdAt || new Date().toISOString(),
          });
        });
      }

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivities(activities.slice(0, 6));

      // --- Process Birthdays of the Month for Diretoria & Administração ---
      const parsedBirthdays = parseEmployeeBirthdays(employees, now);
      setMonthBirthdays(parsedBirthdays);

      // Filter upcoming birthdays: 0 to 2 days (Hoje, Falta 1 dia, Faltam 2 dias)
      const upcoming = parsedBirthdays.filter((b) => b.diasRestantes >= 0 && b.diasRestantes <= 2);
      setUpcomingAlertBirthdays(upcoming);

      // --- Process Clientes Aniversariantes do Mês (Visão Geral - Todos os Perfis) ---
      const parsedClientBirthdays = parseClientBirthdays(clients, now);
      setMonthClientBirthdays(parsedClientBirthdays);

      setLastSyncTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setLoading(false);
    } catch (err) {
      console.error('Error syncing dashboard:', err);
      setLoading(false);
    }
  }, [selectedFilialFilter, canSelectAllFiliais, userRole, user, isIndividualSalesView, selectedSupervisorChartMonth, filiaisList]);

  // Initial load & real-time listeners
  useEffect(() => {
    syncDashboardData();

    const handleSyncEvent = () => syncDashboardData();
    window.addEventListener('os-changed', handleSyncEvent);
    window.addEventListener('pdv-changed', handleSyncEvent);
    window.addEventListener('employee-changed', handleSyncEvent);
    window.addEventListener('subligestao_metas_changed', handleSyncEvent);
    window.addEventListener('storage', handleSyncEvent);

    const interval = setInterval(() => {
      syncDashboardData();
    }, 60000);

    return () => {
      window.removeEventListener('os-changed', handleSyncEvent);
      window.removeEventListener('pdv-changed', handleSyncEvent);
      window.removeEventListener('employee-changed', handleSyncEvent);
      window.removeEventListener('subligestao_metas_changed', handleSyncEvent);
      window.removeEventListener('storage', handleSyncEvent);
      clearInterval(interval);
    };
  }, [syncDashboardData]);

  // Month vs previous month comparisons
  const monthVsPrevGlobal = faturamentoMesAnterior > 0 
    ? (((faturamentoMensal - faturamentoMesAnterior) / faturamentoMesAnterior) * 100).toFixed(1)
    : '0.0';

  const monthVsPrevIndiv = faturamentoIndividualMesAnterior > 0
    ? (((faturamentoIndividualMensal - faturamentoIndividualMesAnterior) / faturamentoIndividualMesAnterior) * 100).toFixed(1)
    : '0.0';

  const supervisorMonthVsPrev = supervisorFaturamentoMesAnterior > 0
    ? (((supervisorFaturamentoMensal - supervisorFaturamentoMesAnterior) / supervisorFaturamentoMesAnterior) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* ==============================================================
          HEADER CONTROLS & SECURITY / PRIVACY BADGE
         ============================================================== */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 overflow-hidden">
        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
          <div className={`p-2.5 rounded-xl shrink-0 ${isSupervisor ? 'bg-amber-100 text-amber-800' : isIndividualSalesView ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
            {isSupervisor ? <Users className="w-5 h-5" /> : isIndividualSalesView ? <UserCheck className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black text-slate-900 truncate">
                {isSupervisor
                  ? `Dashboard de Supervisão • ${user?.name || 'Supervisor'}`
                  : isIndividualSalesView
                  ? `Dashboard Individual • ${user?.name || userRole}`
                  : 'Dashboard Executivo Sincronizado'}
              </h2>
              {isSupervisor && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-black rounded-md flex items-center gap-1 border border-amber-300 shrink-0">
                  <ShieldCheck className="w-3 h-3 text-amber-700" />
                  <span>Painel de Supervisão</span>
                </span>
              )}
              {isIndividualSalesView && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-black rounded-md flex items-center gap-1 shrink-0">
                  <Lock className="w-3 h-3" />
                  <span>Painel Individual</span>
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-500 leading-tight mt-0.5">
              {isSupervisor
                ? 'Acompanhamento do faturamento das vendas dos vendedores/recepção, metas e fluxo de produção'
                : isIndividualSalesView
                ? 'Acompanhamento confidencial de metas, comissões, vendas e fluxo de produção'
                : 'Visão consolidada em tempo real de todas as operações do ERP'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto sm:justify-end min-w-0">
          {/* Filial Select Filter for Developer and CEO, or Branch Badge for Employees */}
          {canSelectAllFiliais ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 shadow-xs w-full sm:w-auto min-w-0 max-w-full">
              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-xs font-extrabold text-slate-700 shrink-0">Filial:</span>
              <select
                value={selectedFilialFilter}
                onChange={(e) => setSelectedFilialFilter(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer min-w-0 flex-1 truncate"
              >
                <option value="ALL">🏢 Todas</option>
                <option value="FORTALEZA">🏢 Fortaleza</option>
                <option value="SHOPEE">🛍️ Shopee</option>
                <option value="PIAUI">🏢 Piauí</option>
                <option value="FORTALEZA_SHOPEE">🏢 Fortaleza/Shopee</option>
                <option value="PIAUI_SHOPEE">🏢 Piauí/Shopee</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-black text-blue-900 shadow-xs w-full sm:w-auto min-w-0 max-w-full">
              <Building2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span className="text-blue-700 font-bold shrink-0">{isSupervisor ? 'Filial Restrita:' : 'Filial Vinculada:'}</span>
              <span className="truncate min-w-0 flex-1 sm:max-w-[200px]">
                {isSupervisor ? '🏢 Fortaleza' : (assignedFilialNome || user?.branch || 'Matriz')}
              </span>
            </div>
          )}

          {/* Sync Button & Indicator */}
          <button
            type="button"
            onClick={() => syncDashboardData()}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black inline-flex items-center justify-center sm:justify-start gap-1.5 transition border border-blue-200 cursor-pointer shadow-xs self-end sm:self-auto shrink-0"
            title="Sincronizar dados do Dashboard agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''} shrink-0`} />
            <span className="truncate">{lastSyncTime ? `Sincronizado: ${lastSyncTime}` : 'Sincronizar'}</span>
          </button>
        </div>
      </div>

      {/* ==============================================================
          SUPERVISOR SPECIFIC VIEW LAYOUT (CARDS -> FLUXO DE PRODUÇÃO -> DAILY LINE CHART -> LOWER GRID)
         ============================================================== */}
      {isSupervisor ? (
        <>
          {/* SUPERVISOR KPI CARDS ROW: 3 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Faturamento Mensal */}
            <div className="p-5 bg-gradient-to-br from-white to-blue-50/40 rounded-2xl border-2 border-blue-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <span className="text-xs font-black text-blue-900 uppercase tracking-wider block">
                    Faturamento Mensal
                  </span>
                  <span className="text-[10px] font-bold text-blue-600">Base: Vendedores & Recepção</span>
                </div>
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  supervisorFaturamentoMensal
                )}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-bold">
                {Number(supervisorMonthVsPrev) >= 0 ? (
                  <span className="text-emerald-600 font-black inline-flex items-center gap-0.5">
                    <TrendingUp className="w-3.5 h-3.5" /> +{supervisorMonthVsPrev}% vs mês anterior
                  </span>
                ) : (
                  <span className="text-rose-600 font-black inline-flex items-center gap-0.5">
                    <TrendingDown className="w-3.5 h-3.5" /> {supervisorMonthVsPrev}% vs mês anterior
                  </span>
                )}
              </div>
            </div>

            {/* 2. Ticket Médio Geral */}
            <div className="p-5 bg-gradient-to-br from-white to-amber-50/40 rounded-2xl border-2 border-amber-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wider block">
                    Ticket Médio Geral
                  </span>
                  <span className="text-[10px] font-bold text-amber-700">Média por pedido da equipe</span>
                </div>
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                  <ShoppingCart className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  supervisorTicketMedio
                )}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <span>{supervisorTotalOsMes} pedido(s) concluído(s) no mês pela equipe</span>
              </div>
            </div>

            {/* 3. META MENSAL */}
            <div className="p-5 bg-gradient-to-br from-white to-emerald-50/40 rounded-2xl border-2 border-emerald-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-600" />
                    <span>META MENSAL</span>
                  </span>
                  <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                    <Target className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metaMensal)}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>{((supervisorFaturamentoMensal / (metaMensal || 1)) * 100).toFixed(1)}% atingido</span>
                  <span className="text-slate-500 text-[11px]">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(supervisorFaturamentoMensal)} realizados
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (supervisorFaturamentoMensal / (metaMensal || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                {supervisorFaturamentoMensal >= metaMensal && metaMensal > 0 ? (
                  <span className="text-emerald-700 font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Meta Batida! (+{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(supervisorFaturamentoMensal - metaMensal)})</span>
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold flex items-center gap-1.5">
                    <span className="text-slate-500 font-semibold">Falta p/ meta:</span>
                    <strong className="font-black text-amber-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, metaMensal - supervisorFaturamentoMensal))}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* FLUXO GERAL DE PRODUÇÃO TÊXTIL */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Fluxo Geral de Produção</h3>
                <p className="text-xs text-slate-500">Acompanhamento em tempo real do status das Ordens de Serviço por setor de produção e expedição</p>
              </div>

              <div className={`px-3 py-1.5 border rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
                pedidosAtrasadosCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {pedidosAtrasadosCount > 0 ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600 animate-pulse" />
                    <span>Pedidos Atrasados: {pedidosAtrasadosCount} OS</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Sem Pedidos Atrasados</span>
                  </>
                )}
              </div>
            </div>

            {/* 8 Estágios na Mesma Linha: DESIGNER | IMPRESSÃO | CALANDRA | COSTURA | EXCURSÃO | CORREIOS | SHOPEE | RETIRADA(Recepção) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
              {productionFlow.map((step) => {
                const IconComp = step.icon;
                return (
                  <div
                    key={step.name}
                    onClick={() => setSelectedFlowModalStage(step.name)}
                    className="p-3 bg-slate-50/80 hover:bg-slate-100/90 rounded-xl border border-slate-200 text-center transition-all cursor-pointer flex flex-col justify-between items-center min-h-[96px] shadow-2xs hover:shadow-xs group relative hover:border-blue-300"
                    title={`${step.name}: ${step.count} OS • Clique para ver detalhes`}
                  >
                    {step.isDestination && (
                      <span className="text-[7.5px] font-black uppercase tracking-wider text-blue-700 bg-blue-100/90 border border-blue-200 px-1 py-0.2 rounded-md mb-1">
                        Destino de Envio
                      </span>
                    )}
                    <div className="flex items-center justify-center gap-1.5 w-full">
                      {IconComp && (
                        <IconComp className={`w-3.5 h-3.5 ${step.textColor} shrink-0`} />
                      )}
                      <span className="block text-[10px] sm:text-[11px] font-black text-slate-800 uppercase tracking-tight truncate max-w-full">
                        {step.name}
                      </span>
                    </div>
                    <span className="block text-2xl font-black text-slate-900 my-1 group-hover:scale-105 transition-transform">
                      {step.count}
                    </span>
                    <div className="w-full">
                      <div className={`w-full h-1.5 rounded-full ${step.color} opacity-90`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SUPERVISOR LINE CHART: EVOLUÇÃO MENSAL DE FATURAMENTO & DESEMPENHO DOS VENDEDORES/RECEPÇÃO (2026) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <span>Evolução Mensal de Faturamento & Desempenho dos vendedores/recepção(2026)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Gráfico de linha pontuando diariamente o desempenho individual de todos os vendedores e recepção no mês de{' '}
                  <strong className="text-slate-800 font-bold">{MONTH_NAMES_FULL[selectedSupervisorChartMonth]}</strong> (2026).
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 font-black text-xs rounded-xl border border-blue-200">
                  Mês Ativo: {MONTH_NAMES_FULL[selectedSupervisorChartMonth]}
                </span>
              </div>
            </div>

            {/* RECHARTS LINE CHART */}
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dailySellersChartData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="diaNum"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(d) => `Dia ${d}`}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0),
                      name === 'Total' ? '⚡ Total Diário' : name,
                    ]}
                    labelFormatter={(label) => `Dia ${label} de ${MONTH_NAMES_FULL[selectedSupervisorChartMonth]}`}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderRadius: '12px',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                    itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                    labelStyle={{ color: '#F8FAFC', fontWeight: '700', marginBottom: '6px' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    formatter={(value) => (value === 'Total' ? '⚡ Total Diário' : value)}
                  />
                  {/* Line for each active salesperson in the month */}
                  {dailyActiveSellers.map((seller) => (
                    <Line
                      key={seller.name}
                      type="monotone"
                      dataKey={seller.name}
                      name={`${seller.name} (${seller.cargo})`}
                      stroke={seller.color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: seller.color }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#FFFFFF' }}
                      connectNulls
                    />
                  ))}
                  {/* Total team performance line */}
                  <Line
                    type="monotone"
                    dataKey="Total"
                    name="Total"
                    stroke="#0F172A"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={{ r: 4, fill: '#0F172A' }}
                    activeDot={{ r: 7, strokeWidth: 2, stroke: '#FFFFFF' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* MONTHS COLOR PALETTE LEGEND BAR (ABAIXO MANTENHA OS MESES COMO ESTÁ) */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Selecione o mês para visualizar o desempenho diário:</span>
                <span className="text-[11px] font-semibold text-blue-600">Ano 2026</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                {monthlyEvolutionData.map((item, idx) => {
                  const isSelected = selectedSupervisorChartMonth === idx;
                  return (
                    <button
                      type="button"
                      key={item.mes}
                      onClick={() => setSelectedSupervisorChartMonth(idx)}
                      className={`flex flex-col items-center p-2 rounded-xl transition cursor-pointer text-center border ${
                        isSelected
                          ? 'bg-blue-50 border-blue-500 shadow-xs ring-2 ring-blue-400/30'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className={`text-[11px] font-black ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                          {item.mes}
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold text-slate-600 mt-0.5 truncate w-full">
                        R$ {(item.faturamento / 1000).toFixed(1)}k
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* STANDARD VIEW FOR VENDEDOR / RECEPÇÃO / ADMIN / CEO / DEVELOPER */
        <>
          {/* ==============================================================
              KPI CARDS ROW 1: (INDIVIDUAL FOR VENDEDOR/RECEPÇÃO vs GLOBAL FOR ADMIN/CEO)
             ============================================================== */}
          {isIndividualSalesView ? (
            /* INDIVIDUAL CARDS FOR VENDEDOR(A) / RECEPÇÃO */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Faturamento Mensal (INDIVIDUAL) */}
              <div className="p-5 bg-gradient-to-br from-white to-blue-50/30 rounded-2xl border-2 border-blue-200 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-extrabold text-blue-900 uppercase tracking-wider">
                    Faturamento Mensal (Individual)
                  </span>
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    faturamentoIndividualMensal
                  )}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-bold">
                  {Number(monthVsPrevIndiv) >= 0 ? (
                    <span className="text-emerald-600 font-black inline-flex items-center gap-0.5">
                      <TrendingUp className="w-3.5 h-3.5" /> +{monthVsPrevIndiv}% vs mês anterior
                    </span>
                  ) : (
                    <span className="text-rose-600 font-black inline-flex items-center gap-0.5">
                      <TrendingDown className="w-3.5 h-3.5" /> {monthVsPrevIndiv}% vs mês anterior
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Ticket Médio (INDIVIDUAL) */}
              <div className="p-5 bg-gradient-to-br from-white to-indigo-50/30 rounded-2xl border-2 border-indigo-200 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
                    Ticket Médio (Individual)
                  </span>
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    ticketMedioIndividual
                  )}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <span className="font-extrabold text-indigo-700">
                    {pedidosIndividualMes} pedido(s) concluído(s) por você
                  </span>
                </div>
              </div>

              {/* 3. COMISSÃO (INDIVIDUAL) */}
              <div className="p-5 bg-gradient-to-br from-white to-emerald-50/40 rounded-2xl border-2 border-emerald-300 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-emerald-600" />
                    <span>COMISSÃO (INDIVIDUAL)</span>
                  </span>
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-2xl font-black text-emerald-700">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    comissaoValorMensal
                  )}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs font-bold text-emerald-800">
                  <span>Taxa: <strong className="text-emerald-950 font-black">{comissaoPorcentagem}%</strong></span>
                  <span className="px-2 py-0.5 bg-emerald-100 rounded text-[10px] font-black uppercase text-emerald-800" title="Comissão apurada exclusivamente sobre vendas quitadas/pagas">
                    Apenas Vendas Pagas
                  </span>
                </div>
              </div>

              {/* 4. Meta Individual de Vendas */}
              <div className="p-5 bg-gradient-to-br from-white to-purple-50/40 rounded-2xl border-2 border-purple-300 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-purple-600" />
                    <span>Meta Individual</span>
                  </span>
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                    <Target className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                {metaIndividual > 0 ? (
                  <>
                    <p className="text-2xl font-black text-slate-900">
                      {metaIndividualPorcentagem.toFixed(1)}% <span className="text-xs font-bold text-slate-500">da Meta</span>
                    </p>
                    <div className="w-full bg-purple-100 h-2 rounded-full mt-2.5 overflow-hidden">
                      <div
                        className="bg-purple-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, metaIndividualPorcentagem)}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-bold text-purple-800 mt-1.5 truncate">
                      Alvo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metaIndividual)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-black text-slate-700 mt-1">
                      Sem meta definida
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 mt-1">
                      Peça ao gerente para cadastrar sua meta em Funcionários.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* GLOBAL EXECUTIVE CARDS (ADMIN / DEVELOPER / CEO / GERENTE GERAL) */
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${isDirecao ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
              {/* FATURAMENTO BRUTO: TODAS AS VENDAS (PAGAS E PENDENTES) */}
              <div className="p-5 bg-white rounded-2xl border-2 border-indigo-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/40 rounded-bl-full -z-0 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                      Faturamento Bruto
                    </span>
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Wallet className="w-5 h-5" />
                    </div>
                  </div>
                  <span className="inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-100/90 text-indigo-800 mb-1.5 border border-indigo-200">
                    Pagas + Pendentes
                  </span>
                  <p className="text-2xl font-black text-slate-900 mt-0.5">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoBrutoMensal)}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1 text-xs relative z-10">
                  <div className="flex items-center justify-between text-slate-600 font-bold text-[11px]">
                    <span>Total do Mês:</span>
                    <strong className="text-slate-900 font-extrabold">{totalOsMes} pedido(s)</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 font-medium text-[10px]">
                    <span>Bruto Anual:</span>
                    <strong className="text-indigo-950 font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoBrutoAnual)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* FATURAMENTO LÍQUIDO: APENAS COM AS PAGAS */}
              <div className="p-5 bg-white rounded-2xl border-2 border-emerald-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-bl-full -z-0 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                      Faturamento Líquido
                    </span>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>
                  <span className="inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 mb-1.5 border border-emerald-200">
                    ✓ Apenas Vendas Pagas
                  </span>
                  <p className="text-2xl font-black text-emerald-900 mt-0.5">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoLiquidoMensal)}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1 text-xs relative z-10">
                  <div className="flex items-center justify-between text-emerald-700 font-black text-[11px]">
                    <span>Quitadas no Mês:</span>
                    <span>{pedidosPagosMes} pedido(s)</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 font-medium text-[10px]">
                    <span>Líquido Anual:</span>
                    <strong className="text-emerald-800 font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoLiquidoAnual)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* PENDENTE A RECEBER OU FATURAMENTO ANUAL */}
              {isDirecao ? (
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                        Pendente a Receber
                      </span>
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                        <Clock className="w-5 h-5" />
                      </div>
                    </div>
                    <span className="inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-800 mb-1.5 border border-amber-200">
                      Aguardando Pagamento
                    </span>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoPendenteMensal)}
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>{pedidosPendentesMes} OS pendente(s)</span>
                    <span className="text-amber-700 font-extrabold text-[11px]">A liquidar</span>
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Faturamento Anual</span>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <DollarSign className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoAnual)}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <span className="text-emerald-600 font-black">
                      {faturamentoAnual > 0 ? '🟢 Em crescimento' : 'Aguardando vendas'}
                    </span>
                  </div>
                </div>
              )}

              {/* Ticket Médio */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Ticket Médio Geral</span>
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticketMedio)}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Média por pedido</span>
                  <span className="text-slate-800 font-black">{totalOsMes} pedido(s)</span>
                </div>
              </div>

              {/* META MENSAL */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-emerald-600" />
                      <span>META MENSAL</span>
                    </span>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <Target className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metaMensal)}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>{metaMensalPorcentagem.toFixed(1)}% atingido</span>
                    <span className="text-slate-400 text-[11px]">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoMensal)} realizados
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, metaMensalPorcentagem)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  {faturamentoMensal >= metaMensal && metaMensal > 0 ? (
                    <span className="text-emerald-700 font-black flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Meta Batida! (+{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoMensal - metaMensal)})</span>
                    </span>
                  ) : (
                    <span className="text-amber-700 font-bold flex items-center gap-1.5">
                      <span className="text-slate-500 font-semibold">Falta p/ meta:</span>
                      <strong className="font-black text-amber-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quantoFaltaMetaMensal)}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              CHART CARD: EVOLUÇÃO MENSAL COM CORES DIFERENTES POR MÊS
             ============================================================== */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <span>
                    {isIndividualSalesView
                      ? 'Evolução Mensal de Faturamento & Desempenho (2026) • Suas Vendas Individuais'
                      : 'Evolução Mensal de Faturamento & Desempenho (2026)'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  {isIndividualSalesView
                    ? 'Acompanhamento mês a mês exclusivo das suas vendas individuais, sua meta e pedidos concluídos por você em cores por mês.'
                    : 'Acompanhamento mês a mês com metas, faturamento consolidado e volume de pedidos em cores individuais por mês.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Metric Mode Switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setChartMetricMode('faturamento')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      chartMetricMode === 'faturamento'
                        ? 'bg-white text-blue-700 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Faturamento (R$)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetricMode('pedidos')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      chartMetricMode === 'pedidos'
                        ? 'bg-white text-blue-700 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Volume (OS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetricMode('comparativo')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      chartMetricMode === 'comparativo'
                        ? 'bg-white text-blue-700 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Realizado vs Meta
                  </button>
                </div>

                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-extrabold text-[11px] rounded-lg border border-blue-200 shrink-0">
                  {isIndividualSalesView ? 'Suas Vendas Individuais • 12 Meses' : '12 Meses • Cores por Mês'}
                </span>
              </div>
            </div>

            {/* RECHARTS BAR CHART */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {chartMetricMode === 'comparativo' ? (
                  <BarChart data={monthlyEvolutionData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        typeof value === 'number'
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
                          : value,
                        name === 'faturamento'
                          ? (isIndividualSalesView ? 'Suas Vendas (Realizado)' : 'Faturamento Realizado')
                          : (isIndividualSalesView ? 'Sua Meta Individual' : 'Meta Estipulada'),
                      ]}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#FFFFFF', border: 'none', fontSize: '12px' }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: '700', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar
                      dataKey="meta"
                      name={isIndividualSalesView ? 'Sua Meta Individual' : 'Meta Estipulada'}
                      fill="#CBD5E1"
                      radius={[4, 4, 0, 0]}
                      barSize={16}
                    />
                    <Bar
                      dataKey="faturamento"
                      name={isIndividualSalesView ? 'Suas Vendas (Realizado)' : 'Faturamento Realizado'}
                      radius={[4, 4, 0, 0]}
                      barSize={16}
                    >
                      {monthlyEvolutionData.map((entry, index) => (
                        <Cell key={`cell-comp-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : chartMetricMode === 'pedidos' ? (
                  <BarChart data={monthlyEvolutionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: any) => [
                        `${value} pedidos / OS`,
                        isIndividualSalesView ? 'Seus Pedidos Concluídos' : 'Volume',
                      ]}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#FFFFFF', border: 'none', fontSize: '12px' }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: '700', marginBottom: '4px' }}
                    />
                    <Bar
                      dataKey="pedidos"
                      name={isIndividualSalesView ? 'Seus Pedidos Concluídos' : 'Volume de OS / Pedidos'}
                      radius={[6, 6, 0, 0]}
                      barSize={26}
                    >
                      {monthlyEvolutionData.map((entry, index) => (
                        <Cell key={`cell-pedidos-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={monthlyEvolutionData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0),
                        isIndividualSalesView ? 'Suas Vendas Mensais' : 'Faturamento',
                      ]}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#FFFFFF', border: 'none', fontSize: '12px' }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: '700', marginBottom: '4px' }}
                    />
                    <Bar
                      dataKey="faturamento"
                      name={isIndividualSalesView ? 'Suas Vendas Mensais' : 'Faturamento Mensal'}
                      radius={[6, 6, 0, 0]}
                      barSize={26}
                    >
                      {monthlyEvolutionData.map((entry, index) => (
                        <Cell key={`cell-fat-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* MONTHS COLOR PALETTE LEGEND BAR */}
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2 pt-3 border-t border-slate-100">
              {monthlyEvolutionData.map((item) => (
                <div
                  key={item.mes}
                  className="flex flex-col items-center p-1.5 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition cursor-default text-center"
                >
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[11px] font-black text-slate-800">{item.mes}</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-600 mt-0.5 truncate w-full">
                    {chartMetricMode === 'pedidos'
                      ? `${item.pedidos} OS`
                      : `R$ ${(item.faturamento / 1000).toFixed(1)}k`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ==============================================================
              FLUXO GERAL DE PRODUÇÃO TÊXTIL (KANBAN SUMMARY)
             ============================================================== */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Fluxo Geral de Produção Têxtil</h3>
                <p className="text-xs text-slate-500">Acompanhamento em tempo real do status das Ordens de Serviço por setor de produção e expedição</p>
              </div>

              <div className={`px-3 py-1.5 border rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
                pedidosAtrasadosCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {pedidosAtrasadosCount > 0 ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600 animate-pulse" />
                    <span>Pedidos Atrasados: {pedidosAtrasadosCount} OS</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Sem Pedidos Atrasados</span>
                  </>
                )}
              </div>
            </div>

            {/* 8 Estágios na Mesma Linha: DESIGNER | IMPRESSÃO | CALANDRA | COSTURA | EXCURSÃO | CORREIOS | SHOPEE | RETIRADA(Recepção) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
              {productionFlow.map((step) => {
                const IconComp = step.icon;
                return (
                  <div
                    key={step.name}
                    onClick={() => setSelectedFlowModalStage(step.name)}
                    className="p-3 bg-slate-50/80 hover:bg-slate-100/90 rounded-xl border border-slate-200 text-center transition-all cursor-pointer flex flex-col justify-between items-center min-h-[96px] shadow-2xs hover:shadow-xs group relative hover:border-blue-300"
                    title={`${step.name}: ${step.count} OS • Clique para ver detalhes`}
                  >
                    {step.isDestination && (
                      <span className="text-[7.5px] font-black uppercase tracking-wider text-blue-700 bg-blue-100/90 border border-blue-200 px-1 py-0.2 rounded-md mb-1">
                        Destino de Envio
                      </span>
                    )}
                    <div className="flex items-center justify-center gap-1.5 w-full">
                      {IconComp && (
                        <IconComp className={`w-3.5 h-3.5 ${step.textColor} shrink-0`} />
                      )}
                      <span className="block text-[10px] sm:text-[11px] font-black text-slate-800 uppercase tracking-tight truncate max-w-full">
                        {step.name}
                      </span>
                    </div>
                    <span className="block text-2xl font-black text-slate-900 my-1 group-hover:scale-105 transition-transform">
                      {step.count}
                    </span>
                    <div className="w-full">
                      <div className={`w-full h-1.5 rounded-full ${step.color} opacity-90`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ==============================================================
          LOWER GRID: TOP VENDEDORES, ANIVERSARIANTES & ATIVIDADES
         ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOP VENDEDORES DO MÊS */}
        {isIndividualSalesView ? (
          /* INDIVIDUAL RANKING POSITION CARD (CONFIDENTIAL & MOTIVATIONAL) */
          <div className="p-6 bg-gradient-to-br from-white via-amber-50/20 to-purple-50/30 rounded-2xl border-2 border-amber-300/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-extrabold text-slate-900">Top Vendedores do Mês</h3>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300">
                Sua Posição Individual
              </span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-amber-200/80 shadow-xs space-y-4">
              {minhaPosicaoRanking === 0 || pedidosIndividualMes === 0 || faturamentoIndividualMensal === 0 ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700 border border-amber-300 flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                    <Sparkles className="w-7 h-7 text-amber-600" />
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-base font-black text-slate-900">
                      Sua primeira venda do mês ainda está por vir!
                    </h4>
                    <p className="text-xs font-bold text-slate-600">
                      Você ainda não tem posição no Ranking
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
                    {minhaPosicaoRanking === 1 ? (
                      <Crown className="w-7 h-7 text-amber-100" />
                    ) : minhaPosicaoRanking === 2 ? (
                      <Medal className="w-7 h-7 text-slate-100" />
                    ) : minhaPosicaoRanking === 3 ? (
                      <Award className="w-7 h-7 text-amber-200" />
                    ) : (
                      <span>#{minhaPosicaoRanking}</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-black text-slate-900">
                        {minhaPosicaoRanking === 1
                          ? '🥇 1º Lugar no Ranking Geral!'
                          : minhaPosicaoRanking === 2
                          ? '🥈 2º Lugar no Ranking Geral'
                          : minhaPosicaoRanking === 3
                          ? '🥉 3º Lugar no Ranking Geral'
                          : `🏅 ${minhaPosicaoRanking}º Lugar no Ranking Geral`}
                      </h4>
                    </div>
                    <p className="text-xs font-bold text-slate-600">
                      Você está na posição <strong className="text-amber-700">#{minhaPosicaoRanking}</strong> de{' '}
                      <strong className="text-slate-800">{totalVendedoresNoRanking}</strong> vendedor(es)/atendentes no mês.
                    </p>
                  </div>
                </div>
              )}

              {/* Individual Stats Row */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200">
                  <span className="text-[11px] font-black text-amber-900 uppercase block">Seu Faturamento</span>
                  <span className="text-base font-black text-slate-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      faturamentoIndividualMensal
                    )}
                  </span>
                </div>

                <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
                  <span className="text-[11px] font-black text-blue-900 uppercase block">Vendas Concluídas</span>
                  <span className="text-base font-black text-slate-900">
                    {pedidosIndividualMes} pedido(s)
                  </span>
                </div>
              </div>

              {/* Privacy protection notice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 flex items-start gap-2">
                <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Visualização Individual Protegida:</strong> Por política interna da Tecido Sublimado Fortaleza, 
                  os resultados do seu desempenho mensal são confidenciais e exclusivos para a sua visualização. 
                  Nenhum outro vendedor terá acesso aos seus números, indicadores individuais ou informações de comissionamento.
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* GLOBAL TOP SELLERS RANKING (FOR ADMIN / CEO / GERENTE) */
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
                  <Award className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Ranking dos Melhores Desempenhos
                  </h3>
                  <p className="text-[11px] text-slate-600 font-bold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-blue-600" />
                    <span>Desempenho Geral de Vendas (OS & VND)</span>
                  </p>
                </div>
              </div>

              {/* Controles de Filtro: Todos (OS + VND), Apenas OS, Apenas VND */}
              <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setRankingFilterType('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                    rankingFilterType === 'ALL'
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  Todos (OS + VND)
                </button>
                <button
                  type="button"
                  onClick={() => setRankingFilterType('OS')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 ${
                    rankingFilterType === 'OS'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <span>Apenas OS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRankingFilterType('VND')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 ${
                    rankingFilterType === 'VND'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <span>Apenas VND</span>
                </button>
              </div>
            </div>

            {/* Lista dos Melhores Desempenhos com Cores e Valores em Reais */}
            <div className="space-y-3">
              {displayedTopSellers.length === 0 ? (
                <div className="p-6 text-center text-xs font-semibold text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  {rankingFilterType === 'OS'
                    ? 'Nenhuma OS registrada neste período.'
                    : rankingFilterType === 'VND'
                    ? 'Nenhuma venda direta (VND) registrada neste período.'
                    : 'Nenhuma venda registrada por vendedores neste período.'}
                </div>
              ) : (
                displayedTopSellers.map((seller) => {
                  const IconComp = seller.icon;
                  return (
                    <div
                      key={`${seller.rank}-${seller.id}`}
                      className="p-3.5 bg-slate-50/80 hover:bg-slate-100/90 rounded-xl border border-slate-200 transition-all space-y-2 shadow-2xs"
                    >
                      {/* Linha Superior: Posição, Nome, Cargo, Tags de OS/VND e Valor */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Badge de Posição / Ícone com Cor de Desempenho */}
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border shrink-0 shadow-2xs ${seller.badgeColor}`}
                            style={
                              seller.rank > 3
                                ? { borderColor: seller.barColor, color: seller.barColor }
                                : undefined
                            }
                          >
                            {IconComp ? <IconComp className="w-4 h-4" /> : `#${seller.rank}`}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                                {seller.name}
                              </h4>
                              <span className="text-[10px] font-black text-blue-700 bg-blue-100/80 border border-blue-200 px-1.5 py-0.2 rounded-md">
                                {seller.cargo}
                              </span>
                            </div>

                            {/* Tags discriminando OS e VND */}
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {rankingFilterType === 'ALL' ? (
                                <>
                                  {seller.osCount > 0 && (
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                      {seller.osCount} OS
                                    </span>
                                  )}
                                  {seller.vndCount > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                      {seller.vndCount} VND
                                    </span>
                                  )}
                                  {seller.osCount === 0 && seller.vndCount === 0 && (
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      {seller.count} venda(s)
                                    </span>
                                  )}
                                </>
                              ) : rankingFilterType === 'OS' ? (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                  {seller.osCount} OS
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                  {seller.vndCount} VND
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Lado Direito: Exibição Clara do Valor em Reais e Status */}
                        <div className="text-right shrink-0">
                          <span className="block text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                              seller.salesTotal
                            )}
                          </span>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            {seller.pendingCount && seller.pendingCount > 0 ? (
                              <span
                                className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200"
                                title={`${seller.paidCount || 0} quitada(s) / ${seller.pendingCount} pendente(s)`}
                              >
                                {seller.paidCount && seller.paidCount > 0 ? `${seller.paidCount} pagas • ` : ''}
                                {seller.pendingCount} pendente{seller.pendingCount > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Quitado
                              </span>
                            )}
                            <span className="text-[10px] font-black text-slate-500">
                              {seller.percentageOfTotal}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Barra de Desempenho Colorida do Funil */}
                      <div className="w-full h-2 bg-slate-200/90 rounded-full overflow-hidden flex">
                        <div
                          className="h-full rounded-full transition-all duration-500 shadow-2xs"
                          style={{
                            width: `${seller.widthPct}%`,
                            backgroundColor: seller.barColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ANIVERSARIANTES DA EQUIPE (EXCLUSIVO PARA DIRETORIA & ADMINISTRAÇÃO) */}
        {isDiretoriaOuAdministracao && (
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Cake className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                    <span>Aniversariantes da Equipe</span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-black">
                      {monthBirthdays.length}
                    </span>
                  </h3>
                </div>
              </div>
              <span className="text-[10px] font-extrabold uppercase text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                Colaboradores • RH
              </span>
            </div>

            <div className="space-y-3">
              {monthBirthdays.length === 0 ? (
                <div className="p-6 text-center text-xs font-semibold text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
                  <Cake className="w-6 h-6 text-slate-300" />
                  <span>Nenhum colaborador aniversariante registrado neste mês ({MONTH_NAMES_FULL[new Date().getMonth()]}).</span>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {monthBirthdays.map((bday) => {
                    const bdayFullName = `${bday.nome} ${bday.sobrenome || ''}`.trim().toLowerCase();
                    const userFullName = (user?.name || '').trim().toLowerCase();
                    const isLoggedUserBday = Boolean(
                      (user?.id && bday.id && String(user.id).toLowerCase() === String(bday.id).toLowerCase()) ||
                      (userFullName && bdayFullName && (userFullName === bdayFullName || userFullName.includes(bdayFullName) || bdayFullName.includes(userFullName))) ||
                      (user?.username && bday.id && String(user.username).toLowerCase() === String(bday.id).toLowerCase())
                    );

                    let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                    let badgeText = `Dia ${bday.dia}`;

                    if (bday.diasRestantes === 0) {
                      badgeColor = 'bg-emerald-500 text-white font-black animate-pulse shadow-xs';
                      badgeText = isLoggedUserBday ? '🎉 PARABÉNS!' : '🎉 É HOJE!';
                    } else if (bday.diasRestantes === 1) {
                      badgeColor = 'bg-orange-500 text-white font-black animate-pulse shadow-xs';
                      badgeText = '⚡ Falta 1 dia!';
                    } else if (bday.diasRestantes === 2) {
                      badgeColor = 'bg-amber-500 text-white font-black animate-pulse shadow-xs';
                      badgeText = '⚡ Faltam 2 dias!';
                    } else if (bday.diasRestantes > 2) {
                      badgeColor = 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
                      badgeText = `Em ${bday.diasRestantes} dias`;
                    } else {
                      badgeColor = 'bg-slate-100 text-slate-400 font-medium';
                      badgeText = `Comemorado (${String(bday.dia).padStart(2, '0')}/${String(bday.mes).padStart(2, '0')})`;
                    }

                    return (
                      <div
                        key={bday.id}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          bday.isHoje
                            ? 'bg-emerald-50/70 border-emerald-300'
                            : bday.isPrestesAFazer
                            ? 'bg-amber-50/70 border-amber-300'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {bday.fotoUrl ? (
                            <img
                              src={bday.fotoUrl}
                              alt={bday.nome}
                              className="w-9 h-9 rounded-full object-cover border border-slate-300 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-xs flex items-center justify-center border border-amber-300 shrink-0 shadow-xs">
                              {bday.nome.charAt(0)}{bday.sobrenome ? bday.sobrenome.charAt(0) : ''}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-slate-900 truncate">
                                {bday.nome} {bday.sobrenome}
                              </h4>
                              <span className="text-[10px] font-extrabold text-blue-700 bg-blue-100/80 border border-blue-200 px-1.5 py-0.2 rounded-md truncate">
                                {bday.cargo}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium truncate">
                              {bday.filialNome} • {bday.dataFormatada}
                              {bday.idade ? ` • ${bday.idade} anos` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] uppercase border ${badgeColor}`}>
                            {badgeText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CLIENTES ANIVERSARIANTES DO MÊS (VISÃO GERAL PARA TODOS OS PERFIS COM DASHBOARD) */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <PartyPopper className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                  <span>CLIENTES ANIVERSARIANTES DO MÊS</span>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-full text-[10px] font-black">
                    {monthClientBirthdays.length}
                  </span>
                </h3>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
              Visão Geral • Clientes
            </span>
          </div>

          <div className="space-y-3">
            {monthClientBirthdays.length === 0 ? (
              <div className="p-6 text-center text-xs font-semibold text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
                <PartyPopper className="w-6 h-6 text-slate-300" />
                <span>Nenhum cliente aniversariante registrado neste mês ({MONTH_NAMES_FULL[new Date().getMonth()]}).</span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {monthClientBirthdays.map((bday) => {
                  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                  let badgeText = `Dia ${bday.dia}`;

                  if (bday.diasRestantes === 0) {
                    badgeColor = 'bg-emerald-500 text-white font-black animate-pulse shadow-xs';
                    badgeText = '🎉 É HOJE!';
                  } else if (bday.diasRestantes === 1) {
                    badgeColor = 'bg-orange-500 text-white font-black animate-pulse shadow-xs';
                    badgeText = '⚡ Falta 1 dia!';
                  } else if (bday.diasRestantes === 2) {
                    badgeColor = 'bg-amber-500 text-white font-black animate-pulse shadow-xs';
                    badgeText = '⚡ Faltam 2 dias!';
                  } else if (bday.diasRestantes > 2) {
                    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
                    badgeText = `Em ${bday.diasRestantes} dias`;
                  } else {
                    badgeColor = 'bg-slate-100 text-slate-400 font-medium';
                    badgeText = `Comemorado (${String(bday.dia).padStart(2, '0')}/${String(bday.mes).padStart(2, '0')})`;
                  }

                  const cleanPhone = (bday.telefone || '').replace(/\D/g, '');
                  const whatsappUrl = cleanPhone
                    ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
                        buildClientBirthdayMessage(bday.nome)
                      )}`
                    : null;

                  return (
                    <div
                      key={bday.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        bday.isHoje
                          ? 'bg-emerald-50/70 border-emerald-300'
                          : bday.isPrestesAFazer
                          ? 'bg-indigo-50/70 border-indigo-300'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {bday.fotoUrl ? (
                          <img
                            src={bday.fotoUrl}
                            alt={bday.nome}
                            className="w-9 h-9 rounded-full object-cover border border-slate-300 shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-9 h-9 rounded-full font-black text-xs flex items-center justify-center border shrink-0 shadow-xs ${
                              bday.type === 'PJ'
                                ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-purple-400'
                                : 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-blue-400'
                            }`}
                          >
                            {bday.type === 'PJ' ? 'PJ' : bday.nome.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {bday.nome}
                            </h4>
                            <span className="text-[10px] font-black text-slate-600 bg-slate-100 border border-slate-300 px-1.5 py-0.2 rounded-md truncate">
                              {bday.codigo}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                bday.type === 'PJ'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {bday.type}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium truncate">
                            {bday.dataFormatada}{bday.idade ? ` • ${bday.idade} anos` : ''} • Doc: {bday.documento}
                          </p>
                          {(bday.operador || bday.createdBy) && (
                            <p className="text-[9px] text-slate-400 font-medium truncate">
                              Cadastrado por: <span className="text-slate-600 font-semibold">{bday.operador || bday.createdBy}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {whatsappUrl && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition shadow-2xs"
                            title="Enviar WhatsApp de felicitações"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] uppercase border ${badgeColor}`}>
                          {badgeText}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RECENT ACTIVITIES TIMELINE */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-extrabold text-slate-900">
                {isIndividualSalesView ? 'Suas Atividades Recentes' : 'Atividades Recentes do ERP'}
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Tempo Real</span>
            </span>
          </div>

          {recentActivities.length === 0 ? (
            <div className="p-6 text-center text-xs font-semibold text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Nenhuma atividade recente registrada para exibição.
            </div>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
              {recentActivities.map((act) => (
                <div key={act.id} className="relative pl-8">
                  <div
                    className={`absolute left-2 top-1.5 w-3 h-3 ${act.color} rounded-full border-2 border-white shadow`}
                  />
                  <p className="text-xs font-bold text-slate-900 flex items-center justify-between gap-1">
                    <span className="truncate">{act.title}</span>
                    {act.destino && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded shrink-0">
                        <Truck className="w-2.5 h-2.5" />
                        {act.destino}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500">{act.details}</p>
                  <span className="text-[10px] text-slate-400 font-semibold">{act.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>



      {/* MODAL DE DETALHES DO FLUXO / DESTINO DE ENVIO */}
      {selectedFlowModalStage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100/80 text-blue-700 rounded-xl">
                  {['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)'].includes(selectedFlowModalStage) ? (
                    <Truck className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Layers className="w-5 h-5 text-purple-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">
                      {selectedFlowModalStage}
                    </h3>
                    {['EXCURSÃO', 'CORREIOS', 'SHOPEE', 'RETIRADA(Recepção)'].includes(selectedFlowModalStage) && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                        Destino de Envio
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {flowOrdersMap[selectedFlowModalStage]?.length || 0} Ordem(ns) de Serviço neste estágio / destino
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFlowModalStage(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {!flowOrdersMap[selectedFlowModalStage] || flowOrdersMap[selectedFlowModalStage].length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm font-semibold">
                  Nenhuma Ordem de Serviço encontrada para {selectedFlowModalStage}.
                </div>
              ) : (
                flowOrdersMap[selectedFlowModalStage].map((os) => {
                  const destinoOS = (os as any).destinoExpedicao || (os as any).destino;
                  return (
                    <div
                      key={os.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-slate-900">
                            {os.codigo || (os as any).codigoOS || 'OS'}
                          </span>
                          <span className="text-xs font-bold text-slate-700 truncate">
                            {os.clienteNome || 'Cliente'}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            {os.estagioAtual || 'Produção'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span>Vendedor: <strong className="text-slate-700 font-semibold">{os.vendedorNome || (os as any).vendedor || 'Geral'}</strong></span>
                          <span>Criado em: {os.createdAt ? new Date(os.createdAt).toLocaleDateString('pt-BR') : '—'}</span>
                          {os.prazoEntrega && (
                            <span>Prazo: {new Date(os.prazoEntrega).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                        {destinoOS && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-black shadow-xs">
                            <Truck className="w-3.5 h-3.5" />
                            <span>Destino: {destinoOS}</span>
                          </div>
                        )}
                        <span className="text-sm font-black text-slate-900">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(os.valorFinal || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedFlowModalStage(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper relative time formatter
function formatRelativeTime(dateInput?: string): string {
  if (!dateInput) return 'Agora mesmo';
  const now = new Date();
  const past = new Date(dateInput);
  const diffMs = now.getTime() - past.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Agora mesmo';
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Há ${diffDays} dia(s)`;
}
