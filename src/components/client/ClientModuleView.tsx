import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { Address, Client, ClientType } from '../../server/types/client';
import { EntityStatus } from '../../server/types/index';
import { AddressForm } from '../common/AddressForm';
import { ApiService } from '../../services/api';
import { validateCPF, validateCNPJ } from '../../utils/validators';
import { getLoggedUserAndPerfil, canUserPerformAction, isDeveloperOrAdminMaster } from '../../utils/userPermissions';
import { verifySuperiorPassword } from '../../utils/superiorAuth';
import {
  matchClientSearch,
  getClientDisplayName,
  getClientDocument,
  cleanClientFullName,
  buildClientSearchIndex,
  fastFilterClients,
} from '../../utils/clientSearch';
import {
  UserPlus,
  Search,
  Save,
  Building2,
  Upload,
  Trash2,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  User,
  History,
  ArrowLeft,
  Users,
  Eye,
  EyeOff,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Calendar,
  Lock,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Crop,
  FileSpreadsheet,
} from 'lucide-react';
import { PhotoFramingModal } from '../common/PhotoFramingModal';
import { ClientImportModal } from './ClientImportModal';

export function formatDateBR(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const [y, m, d] = clean.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(clean)) {
    return clean;
  }
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('pt-BR');
  }
  return clean;
}

export function isBirthdayThisMonth(dateStr?: string): boolean {
  if (!dateStr) return false;
  const currentMonth = new Date().getMonth() + 1;
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.split('T')[0].split('-');
    const m = parseInt(parts[1], 10);
    return m === currentMonth;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(clean)) {
    const parts = clean.split('/');
    const m = parseInt(parts[1], 10);
    return m === currentMonth;
  }
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const m = (d.getUTCMonth ? d.getUTCMonth() : d.getMonth()) + 1;
    return m === currentMonth;
  }
  return false;
}

const initialAddress: Address = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
};

export interface ClientModuleViewProps {
  onClientSaved?: (client: Client) => void;
  onClose?: () => void;
  initialClient?: Client | null;
  isModal?: boolean;
}

type SortOption = 'NOME_ASC' | 'NOME_DESC' | 'DATE_DESC' | 'DATE_ASC' | 'CODE_ASC';

export const ClientModuleView: React.FC<ClientModuleViewProps> = ({
  onClientSaved,
  onClose,
  initialClient,
  isModal = false,
}) => {
  // Active View: 'FORM' (Cadastro) or 'HISTORY' (Pesquisa / Histórico em tela cheia)
  const [activeView, setActiveView] = useState<'FORM' | 'HISTORY'>('FORM');

  // Currently editing client ID (null if creating new)
  const [editingClientId, setEditingClientId] = useState<string | null>(
    initialClient?.id || null
  );

  // Client Form Type Toggle
  const [clientType, setClientType] = useState<ClientType>('PF');

  // PF Form State
  const [pfNome, setPfNome] = useState('');
  const [pfCpf, setPfCpf] = useState('');
  const [pfFotoUrl, setPfFotoUrl] = useState<string | undefined>(undefined);
  const [pfDataNascimento, setPfDataNascimento] = useState('');

  // Photo Framing / Repositioning Modal State
  const [isFramingModalOpen, setIsFramingModalOpen] = useState(false);
  const [framingImageSrc, setFramingImageSrc] = useState<string | null>(null);

  // Spreadsheet Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // PJ Form State
  const [pjRazaoSocial, setPjRazaoSocial] = useState('');
  const [pjNomeFantasia, setPjNomeFantasia] = useState('');
  const [pjCnpj, setPjCnpj] = useState('');
  const [pjInscricaoEstadual, setPjInscricaoEstadual] = useState('ISENTO');
  const [pjDataFundacao, setPjDataFundacao] = useState('');

  // Shared Form State
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<EntityStatus>('ACTIVE');
  const [address, setAddress] = useState<Address>(initialAddress);

  // Permissions check (RBAC + Developer Super-Admin)
  const { role: loggedRole, isDeveloper: isLoggedDev, username: loggedUsername } = getLoggedUserAndPerfil();
  const isDev = isLoggedDev || loggedRole === 'Developer';
  const canView = isDev || canUserPerformAction(loggedRole, 'clientes', 'visualizar', isLoggedDev);
  const canCreateEdit = isDev || canUserPerformAction(loggedRole, 'clientes', 'criarEditar', isLoggedDev);
  const canDelete = isDev || canUserPerformAction(loggedRole, 'clientes', 'excluir', isLoggedDev);
  // Exclusividade de importação de planilhas: Apenas Administrador Master e Developer
  const canImportPlanilhas = isDeveloperOrAdminMaster(loggedRole, isLoggedDev, loggedUsername);

  // Pre-fill form when editingClient changes
  const loadClientIntoForm = (client: Client) => {
    setEditingClientId(client.id);
    setClientType(client.type);
    if (client.type === 'PF') {
      setPfNome(cleanClientFullName(client.nome, client.sobrenome));
      setPfCpf(client.cpf || '');
      setPfFotoUrl(client.fotoUrl);
      setPfDataNascimento(client.dataNascimento ? client.dataNascimento.split('T')[0] : '');
    } else {
      setPjRazaoSocial(client.razaoSocial || '');
      setPjNomeFantasia(client.nomeFantasia || '');
      setPjCnpj(client.cnpj || '');
      setPjInscricaoEstadual(client.inscricaoEstadual || 'ISENTO');
      setPjDataFundacao(
        client.dataFundacao
          ? client.dataFundacao.split('T')[0]
          : client.dataNascimento
          ? client.dataNascimento.split('T')[0]
          : ''
      );
    }
    setTelefone(client.telefone || '');
    setEmail(client.email || '');
    setStatus(client.status || 'ACTIVE');
    if (client.endereco) {
      setAddress(client.endereco);
    } else {
      setAddress(initialAddress);
    }
  };

  useEffect(() => {
    if (initialClient) {
      loadClientIntoForm(initialClient);
    }
  }, [initialClient]);

  // UI Feedback & Data States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Auto-dismiss confirmation feedback (cadastros, alterações e salvamentos) after 3 seconds
  useEffect(() => {
    if (feedback.message && feedback.type === 'success') {
      const timer = setTimeout(() => {
        setFeedback({ type: null, message: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const [clientList, setClientList] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('NOME_ASC');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [selectedClientDetail, setSelectedClientDetail] = useState<Client | null>(null);

  // Delete Password Verification Modal state
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load registered clients on mount
  const fetchClients = async () => {
    try {
      const data = await ApiService.getClients();
      setClientList(data || []);
    } catch {
      setClientList([]);
    }
  };

  useEffect(() => {
    fetchClients();
    const handleClientsChanged = () => {
      fetchClients();
    };
    window.addEventListener('clients-changed', handleClientsChanged);
    return () => {
      window.removeEventListener('clients-changed', handleClientsChanged);
    };
  }, []);

  // Format Brazilian Phone: (00) 00000-0000
  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  // Format CPF: 000.000.000-00
  const formatCpf = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  // Format CNPJ: 00.000.000/0000-00
  const formatCnpj = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8)
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12)
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  };

  // Clear Form State
  const resetForm = () => {
    setEditingClientId(null);
    setPfNome('');
    setPfCpf('');
    setPfFotoUrl(undefined);
    setPfDataNascimento('');
    setPjRazaoSocial('');
    setPjNomeFantasia('');
    setPjCnpj('');
    setPjInscricaoEstadual('ISENTO');
    setPjDataFundacao('');
    setTelefone('');
    setEmail('');
    setStatus('ACTIVE');
    setAddress(initialAddress);
  };

  // Handle Image Upload and Open Framing Modal (like Profile & Foto model)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validFormats = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validFormats.includes(file.type)) {
      setFeedback({
        type: 'error',
        message: 'Formato de imagem inválido! Utilize JPG, PNG ou WEBP.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setFramingImageSrc(result);
        setIsFramingModalOpen(true);
      }
    };
    reader.readAsDataURL(file);

    // Reset input value to allow selecting same file again
    if (e.target) {
      e.target.value = '';
    }
  };

  // Handle Form Submission
  const handleSaveClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFeedback({ type: null, message: '' });

    if (!canCreateEdit) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para Criar / Editar no Módulo de Clientes (permissão desmarcada no RBAC).',
      });
      return;
    }

    // Client-side quick validations
    if (clientType === 'PF') {
      if (!pfNome.trim()) {
        setFeedback({ type: 'error', message: 'O campo Nome Completo é obrigatório.' });
        return;
      }
      if (!pfCpf.trim()) {
        setFeedback({ type: 'error', message: 'O campo CPF é obrigatório.' });
        return;
      }
      if (!validateCPF(pfCpf)) {
        setFeedback({
          type: 'error',
          message: 'CPF numérico inválido! Verifique os dígitos verificadores.',
        });
        return;
      }
    } else {
      if (!pjRazaoSocial.trim()) {
        setFeedback({ type: 'error', message: 'O campo Razão Social é obrigatório.' });
        return;
      }
      if (!pjNomeFantasia.trim()) {
        setFeedback({ type: 'error', message: 'O campo Nome Fantasia é obrigatório.' });
        return;
      }
      if (!pjCnpj.trim()) {
        setFeedback({ type: 'error', message: 'O campo CNPJ é obrigatório.' });
        return;
      }
      if (!validateCNPJ(pjCnpj)) {
        setFeedback({
          type: 'error',
          message: 'CNPJ numérico inválido! Verifique os dígitos verificadores.',
        });
        return;
      }
    }

    if (email.trim() && !/\S+@\S+\.\S+/.test(email.trim())) {
      setFeedback({ type: 'error', message: 'E-mail com formato inválido.' });
      return;
    }

    if (!telefone.trim()) {
      setFeedback({ type: 'error', message: 'O campo Telefone é obrigatório.' });
      return;
    }

    if (!address.numero?.trim()) {
      setFeedback({
        type: 'error',
        message: 'O campo Número no Endereço do Cliente é obrigatório. Caso não possua número, informe "S/N".',
      });
      return;
    }

    if (!address.cep?.trim() || !address.logradouro?.trim() || !address.bairro?.trim() || !address.cidade?.trim() || !address.estado?.trim()) {
      setFeedback({
        type: 'error',
        message: 'Preencha todos os campos obrigatórios do Endereço (CEP, Rua, Número, Bairro, Cidade, UF).',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { username: loggedUsername, name: loggedName } = getLoggedUserAndPerfil();
      const currentOperator = loggedUsername || loggedName || 'Operador';

      const payload = {
        type: clientType,
        nome: clientType === 'PF' ? pfNome.trim() : undefined,
        sobrenome: undefined,
        cpf: clientType === 'PF' ? pfCpf : undefined,
        fotoUrl: clientType === 'PF' ? pfFotoUrl : undefined,
        dataNascimento: clientType === 'PF' ? (pfDataNascimento || undefined) : (pjDataFundacao || undefined),
        dataFundacao: clientType === 'PJ' ? (pjDataFundacao || undefined) : undefined,
        razaoSocial: clientType === 'PJ' ? pjRazaoSocial : undefined,
        nomeFantasia: clientType === 'PJ' ? pjNomeFantasia : undefined,
        cnpj: clientType === 'PJ' ? pjCnpj : undefined,
        inscricaoEstadual: clientType === 'PJ' ? pjInscricaoEstadual : undefined,
        operador: currentOperator,
        endereco: address,
        telefone,
        email,
        status,
      };

      let savedClient: Client;
      if (editingClientId) {
        savedClient = await ApiService.updateClient(editingClientId, payload);
      } else {
        savedClient = await ApiService.createClient(payload);
      }

      // Onscreen success notification
      const clientDisplayName = getClientDisplayName(savedClient);

      setFeedback({
        type: 'success',
        message: `✅ Cliente "${clientDisplayName}" [Código: ${savedClient.codigo}] ${editingClientId ? 'atualizado' : 'cadastrado'} com sucesso!`,
      });

      if (onClientSaved) {
        onClientSaved(savedClient);
      }

      if (onClose && isModal) {
        setTimeout(() => {
          onClose();
        }, 600);
      }

      // Clear form data for next registration
      resetForm();
      fetchClients();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao realizar o cadastro do cliente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Start Editing a Client
  const handleStartEditClient = (client: Client) => {
    if (!canCreateEdit) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para Editar Clientes (permissão desmarcada no RBAC).',
      });
      return;
    }
    loadClientIntoForm(client);
    setSelectedClientDetail(null);
    setActiveView('FORM');
    setFeedback({
      type: 'success',
      message: `Carregado para edição: [${client.codigo}] "${getClientDisplayName(client)}"`,
    });
  };

  // Action: Delete Client (Opens Security Password Verification Modal)
  const handleDeleteClient = (client: Client) => {
    if (!canDelete) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para Excluir Registros de Clientes (permissão desmarcada em "Controle e Permissões Dev").',
      });
      return;
    }

    setClientToDelete(client);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError(null);
  };

  const handleCancelDelete = () => {
    setClientToDelete(null);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError(null);
    setIsDeletingClient(false);
  };

  // Action: Confirm and Execute Deletion with Hierarchical Superior Password
  const handleConfirmDeleteWithPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!clientToDelete) return;

    if (!canDelete) {
      setDeleteError('Acesso Negado: Seu perfil não possui permissão para Excluir Registros de Clientes.');
      return;
    }

    const trimmedPass = deletePassword.trim();
    if (!trimmedPass) {
      setDeleteError('Por favor, informe a senha de acesso de um Superior autorizado (Developer, CEO, Gerente Geral ou Supervisor).');
      return;
    }

    setIsDeletingClient(true);
    setDeleteError(null);

    try {
      const { username: loggedUsername } = getLoggedUserAndPerfil();

      const verifyRes = await verifySuperiorPassword(trimmedPass, {
        loggedUsername,
        actionDescription: `Exclusão de Cliente: ${getClientDisplayName(clientToDelete)}`,
      });

      if (!verifyRes.valid) {
        setDeleteError(
          verifyRes.error ||
            'Senha incorreta ou sem permissão de Superior para autorizar a exclusão.'
        );
        setIsDeletingClient(false);
        return;
      }

      // Password verified successfully: proceed to delete client
      const targetId = clientToDelete.id;
      const targetCode = clientToDelete.codigo;
      const targetName = getClientDisplayName(clientToDelete);

      await ApiService.deleteClient(targetId);

      // Clean up modal and detail states
      setClientToDelete(null);
      setDeletePassword('');
      setDeleteError(null);

      if (selectedClientDetail?.id === targetId) {
        setSelectedClientDetail(null);
      }
      if (editingClientId === targetId) {
        resetForm();
      }

      setFeedback({
        type: 'success',
        message: `🗑️ Cliente [${targetCode}] "${targetName}" foi excluído com sucesso por autorização de ${verifyRes.superiorRole || 'Superior'}!`,
      });

      await fetchClients();
    } catch (err: any) {
      setDeleteError(err.message || 'Falha ao excluir o cadastro do cliente.');
    } finally {
      setIsDeletingClient(false);
    }
  };

  // Action: View Client Details
  const handleViewClientDetails = (client: Client) => {
    if (!canView) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para Visualizar Clientes.',
      });
      return;
    }
    setSelectedClientDetail(client);
  };

  // Deferred search term to keep keyboard input at 60 FPS without jank
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Pre-indexed search tokens (calculated once when clientList updates, NOT on every keystroke)
  const indexedClients = useMemo(() => {
    return buildClientSearchIndex(clientList);
  }, [clientList]);

  // Ultra-fast sub-millisecond filtering across thousands of clients
  const filteredIndexedClients = useMemo(() => {
    return fastFilterClients(indexedClients, deferredSearchTerm);
  }, [indexedClients, deferredSearchTerm]);

  // Alphabetical & Registration Date Sorting with pre-calculated keys (0.5ms)
  const sortedClients = useMemo(() => {
    const list = [...filteredIndexedClients];
    switch (sortBy) {
      case 'NOME_ASC':
        return list.sort((a, b) => a.lowerDisplayName.localeCompare(b.lowerDisplayName, 'pt-BR')).map((i) => i.client);
      case 'NOME_DESC':
        return list.sort((a, b) => b.lowerDisplayName.localeCompare(a.lowerDisplayName, 'pt-BR')).map((i) => i.client);
      case 'DATE_DESC':
        return list.sort((a, b) => b.createdAtTime - a.createdAtTime).map((i) => i.client);
      case 'DATE_ASC':
        return list.sort((a, b) => a.createdAtTime - b.createdAtTime).map((i) => i.client);
      case 'CODE_ASC':
        return list.sort((a, b) => a.codigo.localeCompare(b.codigo)).map((i) => i.client);
      default:
        return list.map((i) => i.client);
    }
  }, [filteredIndexedClients, sortBy]);

  // Pagination Logic (20 em 20)
  const totalItems = sortedClients.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  // Reset page to 1 when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  // Ensure current page is valid
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedClients.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedClients, currentPage]);

  // Content Layout
  const content = (
    <div className="w-full space-y-6">
      {/* HEADER BAR - DISCREET & MINIMALIST */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-semibold rounded-md mb-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Módulo de Clientes • Gestão Integrada</span>
            {isDev && (
              <span className="ml-1 text-purple-700 font-bold">
                (Developer)
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {editingClientId
              ? 'Edição do Cadastro de Cliente'
              : 'Gestão Integrada de Clientes (PF / PJ)'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Cadastre, pesquise com código simplificado e consulte o histórico de clientes conectados às Ordens de Serviço e PDV.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <X className="w-4 h-4 text-slate-500" />
            <span>Voltar</span>
          </button>
        )}
      </div>

      {/* FLOATING DISCREET FEEDBACK TOAST (Auto-dismisses in 3 seconds) */}
      {feedback.message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 max-w-md animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto shadow-xl"
        >
          <div
            className={`p-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 border backdrop-blur-md transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-50/95 text-emerald-950 border-emerald-300 shadow-emerald-900/10'
                : 'bg-rose-50/95 text-rose-950 border-rose-300 shadow-rose-900/10'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-xs sm:text-sm leading-snug break-words">{feedback.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback({ type: null, message: '' })}
              className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-black/5 transition shrink-0 ml-1"
              title="Fechar notificação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: REGISTRATION & EDITING FORM */}
      {activeView === 'FORM' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* FORM TYPE SELECTOR TABS & ACTION BUTTONS */}
          <div className="bg-slate-50/80 border-b border-slate-200 p-2.5 flex flex-wrap items-center justify-between gap-2">
            {/* Left: Pessoa Física (PF) e Pessoa Jurídica (PJ) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setClientType('PF')}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  clientType === 'PF'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Pessoa Física (PF)</span>
              </button>

              <button
                type="button"
                onClick={() => setClientType('PJ')}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  clientType === 'PJ'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Pessoa Jurídica (PJ)</span>
              </button>
            </div>

            {/* Right: Modo de Edição e Ações em Ícones (Cadastrar novo cliente e Histórico) */}
            <div className="flex items-center gap-2 ml-auto">
              {editingClientId && (
                <div className="flex items-center gap-1.5 mr-1">
                  <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Modo de Edição</span>
                  </span>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {/* Botão: Importar Planilhas (Apenas Administrador Master e Developer) */}
              {canImportPlanilhas && (
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  title="Importar Planilha de Clientes (.xlsx, .xls, .csv)"
                  aria-label="Importar Planilhas"
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="hidden md:inline">Importar Planilhas</span>
                </button>
              )}

              {/* Botão: Cadastrar novo cliente (apenas o ícone) */}
              <button
                type="button"
                onClick={() => {
                  setActiveView('FORM');
                  resetForm();
                }}
                title="Cadastrar novo cliente"
                aria-label="Cadastrar novo cliente"
                className={`p-2.5 rounded-xl border transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                  !editingClientId
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Botão: Histórico de Clientes (apenas o ícone) */}
              <button
                type="button"
                onClick={() => {
                  fetchClients();
                  setSelectedClientDetail(null);
                  setActiveView('HISTORY');
                }}
                title="Histórico de Clientes"
                aria-label="Histórico de Clientes"
                className="p-2.5 rounded-xl border transition-all active:scale-95 cursor-pointer flex items-center justify-center bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
              >
                <History className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveClient} className="p-4 sm:p-6 space-y-6">
            {/* SECTION 1: PERSONAL OR COMPANY DATA */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  {clientType === 'PF' ? (
                    <>
                      <User className="w-4 h-4 text-blue-600" />
                      <span>Dados do Cliente - Pessoa Física</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>Dados da Empresa - Pessoa Jurídica</span>
                    </>
                  )}
                </h2>
              </div>

              {/* PF FIELDS */}
              {clientType === 'PF' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                    {/* FOTO UPLOAD BOX */}
                    <div className="md:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center flex flex-col items-center justify-center space-y-2">
                      <label className="block text-sm font-bold text-slate-700">Foto do Cliente</label>
                      <div className="w-24 h-24 rounded-full border-2 border-slate-300 bg-white overflow-hidden flex items-center justify-center relative shadow-inner">
                        {pfFotoUrl ? (
                          <img
                            src={pfFotoUrl}
                            alt="Foto Cliente"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-12 h-12 text-slate-300" />
                        )}
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                      />

                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold border border-blue-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{pfFotoUrl ? 'Trocar' : 'Upload'}</span>
                        </button>

                        {pfFotoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setFramingImageSrc(pfFotoUrl);
                              setIsFramingModalOpen(true);
                            }}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold border border-indigo-200 flex items-center gap-1 cursor-pointer"
                            title="Ajustar enquadramento, zoom e rotação da foto"
                          >
                            <Crop className="w-3 h-3" />
                            <span>Enquadrar</span>
                          </button>
                        )}

                        {pfFotoUrl && (
                          <button
                            type="button"
                            onClick={() => setPfFotoUrl(undefined)}
                            className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold border border-red-200 flex items-center gap-1 cursor-pointer"
                            title="Remover foto"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remover</span>
                          </button>
                        )}
                      </div>
                      <span className="text-sm text-slate-400">Formats: JPG, PNG, WEBP</span>
                    </div>

                    {/* PF INPUT FIELDS */}
                    <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* NOME COMPLETO */}
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                          Nome Completo <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={pfNome}
                          onChange={(e) => setPfNome(e.target.value)}
                          placeholder="Digite o nome do cliente..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        />
                      </div>

                      {/* CPF */}
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                          CPF <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={pfCpf}
                          onChange={(e) => setPfCpf(formatCpf(e.target.value))}
                          placeholder="000.000.000-00"
                          maxLength={14}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        />
                      </div>

                      {/* DATA DE NASCIMENTO (ANIVERSÁRIO) */}
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center justify-between">
                          <span>Data de Nascimento</span>
                          <span className="text-xs text-blue-600 font-bold">🎂 Aniversário</span>
                        </label>
                        <input
                          type="date"
                          value={pfDataNascimento}
                          onChange={(e) => setPfDataNascimento(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
                        />
                      </div>

                      {/* TELEFONE */}
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                          Telefone / WhatsApp <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={telefone}
                          onChange={(e) => setTelefone(formatPhone(e.target.value))}
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        />
                      </div>

                      {/* EMAIL */}
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                          E-mail
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="cliente@exemplo.com"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        />
                      </div>

                      {/* STATUS */}
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                          Status do Cliente <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
                        >
                          <option value="ACTIVE">Ativo</option>
                          <option value="INACTIVE">Inativo</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PJ FIELDS */}
              {clientType === 'PJ' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* RAZÃO SOCIAL */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Razão Social <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pjRazaoSocial}
                      onChange={(e) => setPjRazaoSocial(e.target.value)}
                      placeholder="Ex: Tecidos do Ceará LTDA"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* NOME FANTASIA */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Nome Fantasia <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pjNomeFantasia}
                      onChange={(e) => setPjNomeFantasia(e.target.value)}
                      placeholder="Ex: Subli Ceará"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* CNPJ */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      CNPJ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pjCnpj}
                      onChange={(e) => setPjCnpj(formatCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* INSCRIÇÃO ESTADUAL */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Inscrição Estadual (IE)
                    </label>
                    <input
                      type="text"
                      value={pjInscricaoEstadual}
                      onChange={(e) => setPjInscricaoEstadual(e.target.value)}
                      placeholder="Ex: 123456789 ou ISENTO"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* DATA DE FUNDAÇÃO (ANIVERSÁRIO EMPRESA) */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Data de Fundação</span>
                      <span className="text-xs text-blue-600 font-bold">🎂 Aniversário</span>
                    </label>
                    <input
                      type="date"
                      value={pjDataFundacao}
                      onChange={(e) => setPjDataFundacao(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
                    />
                  </div>

                  {/* TELEFONE */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Telefone Corporativo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* EMAIL */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      E-mail Comercial
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contato@empresa.com.br"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* STATUS */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Status da Empresa <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
                    >
                      <option value="ACTIVE">Ativo</option>
                      <option value="INACTIVE">Inativo</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: REUSABLE ADDRESS COMPONENT */}
            <AddressForm value={address} onChange={setAddress} />

            {/* BOTTOM SAVE TRIGGER BUTTON */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-extrabold transition-all cursor-pointer"
              >
                {editingClientId ? 'Cancelar Edição' : 'Limpar Campos'}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-sm font-black shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 text-cyan-300" />
                )}
                <span>
                  {editingClientId ? 'Salvar Alterações do Cliente' : 'Salvar cadastro do cliente'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 2: FULL-SCREEN HISTORY & SEARCH PANEL */}
      {activeView === 'HISTORY' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* PANEL HEADER BAR */}
          <div className="bg-[#2563EB] text-white p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <Search className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">
                  Histórico de Clientes Cadastrados
                </h3>
                <p className="text-sm text-blue-100 font-medium">
                  Pesquise por código (ex: 45, 045, C0000045), nome ou documento, ordene e gerencie registros.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {canImportPlanilhas && (
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                  title="Importar planilha do Excel (.xlsx, .xls) ou CSV com relação de clientes"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Importar Planilhas</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveView('FORM');
                  resetForm();
                }}
                className="px-3.5 py-2 bg-white text-blue-800 hover:bg-blue-50 rounded-xl text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                <span>Novo Cliente</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('FORM')}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao Cadastro</span>
              </button>
            </div>
          </div>

          {/* SEARCH, SORTING & CONTROLS TOOLBAR */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* SEARCH INPUT */}
            <div className="relative flex-1 min-w-[280px]">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquise por Código (ex: 45, 045, C0000045), Nome, CPF/CNPJ, E-mail ou Telefone..."
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* SORTING SELECTOR & REFRESH */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Ordenar por:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="NOME_ASC">Nome (A - Z)</option>
                  <option value="NOME_DESC">Nome (Z - A)</option>
                  <option value="DATE_DESC">Data de Cadastro (Mais Recentes)</option>
                  <option value="DATE_ASC">Data de Cadastro (Mais Antigos)</option>
                  <option value="CODE_ASC">Código (C0000001...)</option>
                </select>
              </div>

              <span className="text-xs font-extrabold text-slate-600 bg-white border border-slate-200 px-3 py-2.5 rounded-xl whitespace-nowrap">
                <Users className="w-3.5 h-3.5 inline mr-1 text-blue-600" />
                {totalItems} cliente(s)
              </span>

              <button
                type="button"
                onClick={fetchClients}
                className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                title="Atualizar lista"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CONTENT AREA: CLIENT DETAILS OR CLIENTS TABLE */}
          <div className="p-4 sm:p-6 space-y-4">
            {selectedClientDetail ? (
              /* DETAIL VIEW OF SELECTED CLIENT */
              <div className="space-y-5 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-4 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-sm">
                      {selectedClientDetail.type === 'PF' ? (
                        <User className="w-6 h-6" />
                      ) : (
                        <Building2 className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black uppercase text-blue-700 bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded font-mono">
                          {selectedClientDetail.codigo}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            selectedClientDetail.type === 'PF'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {selectedClientDetail.type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                            selectedClientDetail.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {selectedClientDetail.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-slate-900 mt-1">
                        {getClientDisplayName(selectedClientDetail)}
                      </h4>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Action: Edit from Detail View */}
                    <button
                      type="button"
                      onClick={() => handleStartEditClient(selectedClientDetail)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm ${
                        canCreateEdit
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60'
                      }`}
                      title={canCreateEdit ? 'Editar cliente' : 'Sem permissão para editar'}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Editar Cadastro</span>
                    </button>

                    {/* Action: Delete from Detail View */}
                    <button
                      type="button"
                      onClick={() => handleDeleteClient(selectedClientDetail)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm ${
                        canDelete
                          ? 'bg-red-50 hover:bg-red-100 text-red-900 border-red-300'
                          : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60'
                      }`}
                      title={canDelete ? 'Excluir cliente' : 'Sem permissão para excluir'}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      <span>Excluir Cliente</span>
                    </button>

                    {/* Action: Use in OS */}
                    {onClientSaved && (
                      <button
                        type="button"
                        onClick={() => {
                          onClientSaved(selectedClientDetail);
                          if (onClose) onClose();
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all cursor-pointer shadow-sm"
                      >
                        Usar na OS
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedClientDetail(null)}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Voltar à lista</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm font-medium text-slate-700">
                  <div>
                    <span className="block text-xs font-extrabold text-slate-400 uppercase">
                      {selectedClientDetail.type === 'PF' ? 'CPF' : 'CNPJ'}
                    </span>
                    <strong className="text-slate-900 font-mono">
                      {getClientDocument(selectedClientDetail)}
                    </strong>
                  </div>

                  <div>
                    <span className="block text-xs font-extrabold text-slate-400 uppercase">Contato</span>
                    <strong className="text-slate-900">{selectedClientDetail.telefone}</strong>
                  </div>

                  <div>
                    <span className="block text-xs font-extrabold text-slate-400 uppercase">E-mail</span>
                    <strong className="text-slate-900 break-all">{selectedClientDetail.email}</strong>
                  </div>

                  <div>
                    <span className="block text-xs font-extrabold text-slate-400 uppercase">Data de Cadastro</span>
                    <strong className="text-slate-900 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      {selectedClientDetail.createdAt
                        ? new Date(selectedClientDetail.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Não registrada'}
                    </strong>
                  </div>

                  {(selectedClientDetail.dataNascimento || selectedClientDetail.dataFundacao) && (
                    <div>
                      <span className="block text-xs font-extrabold text-slate-400 uppercase">
                        {selectedClientDetail.type === 'PF' ? 'Aniversário / Nascimento' : 'Fundação / Aniversário'}
                      </span>
                      <strong className="text-slate-900 flex items-center gap-1">
                        🎂 {formatDateBR(selectedClientDetail.dataNascimento || selectedClientDetail.dataFundacao)}
                        {isBirthdayThisMonth(selectedClientDetail.dataNascimento || selectedClientDetail.dataFundacao) && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-pink-100 text-pink-700">
                            Mês Atual!
                          </span>
                        )}
                      </strong>
                    </div>
                  )}

                  {(selectedClientDetail.operador || selectedClientDetail.createdBy) && (
                    <div>
                      <span className="block text-xs font-extrabold text-slate-400 uppercase">Cadastrado por</span>
                      <strong className="text-slate-900 flex items-center gap-1">
                        👤 {selectedClientDetail.operador || selectedClientDetail.createdBy}
                      </strong>
                    </div>
                  )}

                  <div className="sm:col-span-2 md:col-span-4 bg-white p-3.5 border border-slate-200 rounded-xl">
                    <span className="block text-xs font-extrabold text-slate-400 uppercase mb-1">
                      Endereço Completo
                    </span>
                    <p className="font-semibold text-slate-900">
                      {selectedClientDetail.endereco.logradouro}, {selectedClientDetail.endereco.numero}{' '}
                      {selectedClientDetail.endereco.complemento
                        ? `(${selectedClientDetail.endereco.complemento})`
                        : ''}{' '}
                      - {selectedClientDetail.endereco.bairro}, {selectedClientDetail.endereco.cidade} /{' '}
                      {selectedClientDetail.endereco.estado} - CEP:{' '}
                      <span className="font-mono">{selectedClientDetail.endereco.cep}</span>
                    </p>
                  </div>
                </div>

                {/* OS & POS HISTORY CONNECTION */}
                <div className="border-t border-slate-200 pt-3">
                  <h5 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-blue-600" />
                    <span>Histórico de Ordens de Serviço & Vendas Diretas</span>
                  </h5>
                  <div className="p-4 bg-white border border-dashed border-slate-300 rounded-xl text-center text-sm font-semibold text-slate-500">
                    Nenhuma Ordem de Serviço ou venda pendente para este cliente.
                  </div>
                </div>
              </div>
            ) : (
              /* CLIENTS LIST TABLE IN FULL SCREEN WITH 20-ITEM PAGINATION */
              <div className="space-y-4">
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-xs font-black tracking-wider">
                        <th className="p-3">Código</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Nome / Razão Social</th>
                        <th className="p-3">CPF / CNPJ</th>
                        <th className="p-3">Contato</th>
                        <th className="p-3">Cadastro</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Ações (Visualizar / Editar / Excluir)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-800">
                      {paginatedClients.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Users className="w-8 h-8 text-slate-300" />
                              <p className="font-bold text-sm text-slate-600">
                                {searchTerm
                                  ? `Nenhum cliente localizado para o termo "${searchTerm}".`
                                  : 'Nenhum cliente cadastrado no momento.'}
                              </p>
                              {searchTerm && (
                                <p className="text-xs text-slate-400">
                                  Dica: Digite apenas o número do código (ex: 45 para C0000045) ou parte do nome/documento.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedClients.map((client) => {
                          const displayName = getClientDisplayName(client);
                          const doc = getClientDocument(client);

                          return (
                            <tr key={client.id} className="hover:bg-blue-50/40 transition-colors">
                              <td className="p-3 font-black text-blue-700 font-mono">
                                {client.codigo}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    client.type === 'PF'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-indigo-100 text-indigo-800'
                                  }`}
                                >
                                  {client.type}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="font-bold text-slate-900 block">{displayName}</span>
                                <span className="text-xs text-slate-400">
                                  {client.endereco?.cidade} - {client.endereco?.estado}
                                </span>
                              </td>
                              <td className="p-3 font-semibold text-slate-700 font-mono text-xs">
                                {doc}
                              </td>
                              <td className="p-3">
                                <div className="text-xs">
                                  <div className="font-bold text-slate-900">{client.telefone}</div>
                                  <div className="text-slate-400">{client.email}</div>
                                </div>
                              </td>
                              <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                                {client.createdAt
                                  ? new Date(client.createdAt).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                    })
                                  : '-'}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                                    client.status === 'ACTIVE'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {client.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {/* Usar na OS */}
                                  {onClientSaved && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onClientSaved(client);
                                        if (onClose) onClose();
                                      }}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all cursor-pointer shadow-sm mr-1"
                                      title="Selecionar cliente para a Ordem de Serviço"
                                    >
                                      Usar na OS
                                    </button>
                                  )}

                                  {/* Visualizar */}
                                  <button
                                    type="button"
                                    onClick={() => handleViewClientDetails(client)}
                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                    title="Visualizar histórico e detalhes do cliente"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Editar */}
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditClient(client)}
                                    disabled={!canCreateEdit}
                                    className={`p-1.5 rounded-lg text-xs font-bold transition-all border ${
                                      canCreateEdit
                                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 cursor-pointer'
                                        : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                                    }`}
                                    title={canCreateEdit ? 'Editar dados do cliente' : 'Sem permissão para editar'}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Excluir */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteClient(client)}
                                    disabled={!canDelete}
                                    className={`p-1.5 rounded-lg text-xs font-bold transition-all border ${
                                      canDelete
                                        ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 cursor-pointer'
                                        : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                                    }`}
                                    title={canDelete ? 'Excluir cliente' : 'Sem permissão para excluir'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION BAR (20 EM 20) */}
                {totalItems > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-xs font-bold text-slate-600">
                      Mostrando{' '}
                      <span className="text-slate-900 font-extrabold">
                        {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalItems)}
                      </span>{' '}
                      a{' '}
                      <span className="text-slate-900 font-extrabold">
                        {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}
                      </span>{' '}
                      de <span className="text-slate-900 font-black">{totalItems}</span> clientes
                      cadastrados • <span className="text-blue-700 font-black">Página {currentPage} de {totalPages}</span>
                    </div>

                    {/* PAGINATION BUTTONS */}
                    <div className="flex items-center gap-1.5">
                      {/* Button: Página Anterior */}
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Página Anterior</span>
                      </button>

                      {/* Numeric page pills (up to 5 page numbers) */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((pageNum) => {
                            // Show first page, last page, and pages around current page
                            return (
                              pageNum === 1 ||
                              pageNum === totalPages ||
                              Math.abs(pageNum - currentPage) <= 2
                            );
                          })
                          .map((pageNum, idx, arr) => {
                            const prevPage = arr[idx - 1];
                            const showEllipsis = prevPage && pageNum - prevPage > 1;

                            return (
                              <React.Fragment key={pageNum}>
                                {showEllipsis && (
                                  <span className="px-1 text-xs text-slate-400 font-bold">...</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setCurrentPage(pageNum)}
                                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    currentPage === pageNum
                                      ? 'bg-[#2563EB] text-white shadow-sm'
                                      : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              </React.Fragment>
                            );
                          })}
                      </div>

                      {/* Button: Próxima Página */}
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <span>Próxima Página</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CLIENTE COM SENHA DE ACESSO */}
      {/* ========================================================================= */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[200] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto transform transition-all">
            {/* Header */}
            <div className="bg-rose-50 border-b border-rose-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">
                    Confirmar Exclusão de Cliente
                  </h3>
                  <p className="text-[11px] text-rose-700 font-bold">
                    Operação restrita com confirmação de senha
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={isDeletingClient}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Informações do Cliente a ser Excluído */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Cliente Selecionado
                  </span>
                  <span className="px-2 py-0.5 bg-purple-900 text-white font-mono text-[10px] font-black rounded-md">
                    {clientToDelete.codigo}
                  </span>
                </div>

                <div className="font-black text-sm text-slate-900 leading-snug">
                  {getClientDisplayName(clientToDelete)}
                </div>

                <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                  <span>
                    <strong>Doc:</strong> {getClientDocument(clientToDelete) || 'Não informado'}
                  </span>
                  <span>
                    <strong>Tipo:</strong> {clientToDelete.type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                  </span>
                  {clientToDelete.endereco?.cidade && (
                    <span>
                      <strong>Cidade:</strong> {clientToDelete.endereco.cidade} - {clientToDelete.endereco.estado}
                    </span>
                  )}
                </div>
              </div>

              {/* Alerta de Irreversibilidade & Hierarquia */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-semibold">
                    A exclusão exige a confirmação de senha de um <strong>Superior Autorizado</strong> (Developer, CEO, Gerente Geral ou Supervisor).
                  </p>
                </div>
                <p className="text-[10px] text-amber-800 font-medium">
                  Aviso: A ação é irreversível e removerá todos os dados cadastrais deste cliente.
                </p>
              </div>

              {/* Mensagem de Erro se Houver */}
              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-bold">{deleteError}</span>
                </div>
              )}

              {/* Formulário de Senha */}
              <form onSubmit={handleConfirmDeleteWithPassword} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-purple-600" />
                      Senha de Superior Autorizado
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold lowercase">
                      (obrigatória)
                    </span>
                  </label>

                  <div className="relative">
                    <input
                      type={showDeletePassword ? 'text' : 'password'}
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        if (deleteError) setDeleteError(null);
                      }}
                      placeholder="Digite a senha de um Superior (Developer, CEO, Gerente, Supervisor)..."
                      autoFocus
                      disabled={isDeletingClient}
                      className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCancelDelete}
                    disabled={isDeletingClient}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isDeletingClient || !deletePassword.trim()}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {isDeletingClient ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Validando Senha...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Confirmar Exclusão</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Photo Framing & Repositioning Modal */}
      <PhotoFramingModal
        isOpen={isFramingModalOpen}
        onClose={() => {
          setIsFramingModalOpen(false);
          setFramingImageSrc(null);
        }}
        imageSrc={framingImageSrc}
        onApply={(framedDataUrl) => {
          setPfFotoUrl(framedDataUrl);
          setIsFramingModalOpen(false);
          setFramingImageSrc(null);
        }}
        title="Enquadramento da Foto do Cliente"
        subtitle="Ajuste zoom, posição e rotação da foto do cliente"
      />

      {/* Spreadsheet Client Import Modal (Apenas Administrador Master e Developer) */}
      {canImportPlanilhas && (
        <ClientImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={(count) => {
            fetchClients();
            setFeedback({
              type: 'success',
              message: `${count} cliente(s) processado(s) com sucesso a partir da planilha!`,
            });
          }}
          existingClients={clientList}
        />
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div className="bg-slate-100 border border-slate-300 rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden my-auto p-4 sm:p-6 max-h-[90vh] overflow-y-auto relative">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>{editingClientId ? 'Alteração Rápida de Cliente' : 'Novo Cadastro de Cliente'}</span>
            </h3>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {content}
        </div>
      </div>
    );
  }

  return content;
};

