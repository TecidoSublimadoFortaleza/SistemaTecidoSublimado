import React, { useState, useEffect, useRef } from 'react';
import { Address, ClientType } from '../../server/types/client';
import { Employee, EmployeeAttachment, EmployeeStatus } from '../../server/types/employee';
import { AddressForm } from '../common/AddressForm';
import { ApiService } from '../../services/api';
import { validateCPF } from '../../utils/validators';
import { FilialItem, DEFAULT_MATRIZ_FILIAL } from '../settings/SettingsModuleView';
import { getLoggedUserAndPerfil, canUserPerformAction, isDeveloperOrAdminMaster } from '../../utils/userPermissions';
import { verifySuperiorPassword, getSuperiorHierarchyRank, getSuperiorRoleLabel } from '../../utils/superiorAuth';
import { UserProfile } from '../../types/frontend';
import {
  UserCheck,
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
  Users,
  History,
  ArrowLeft,
  DollarSign,
  Percent,
  Target,
  FileText,
  File,
  Image as ImageIcon,
  Eye,
  Download,
  FolderOpen,
  Calendar,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Plus,
  Shield,
  Edit2,
  ExternalLink,
  Crown,
  Lock,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';

const initialAddress: Address = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
};

const SECTORES_PADRAO = [
  'Comercial & Vendas',
  'Criação & Design',
  'Impressão & Calandra',
  'Costura & Acabamento',
  'Estoque & Expedição',
  'RH & Gestão',
  'Recepção & Atendimento',
  'Diretoria & Administração',
  'Serviços Gerais',
  'LOGISTICA',
  'Operador',
];

const CARGOS_PADRAO = [
  'Administrativo',
  'Calandra',
  'Conferência',
  'Costura',
  'Designer',
  'Estoque',
  'Impressão',
  'LOGISTICA',
  'Monitor',
  'Op. Máquina de corte',
  'Operador',
  'Recepção',
  'RH',
  'Serviços Gerais',
  'Supervisor',
  'Vendedor(a)',
  'Vendedora Shopee',
  'Gerente Geral',
  'CEO',
  'Outro',
];

export const isGrtOrCeoCargo = (cargoStr?: string, codigoStr?: string): boolean => {
  if (codigoStr) {
    const cod = codigoStr.trim().toUpperCase();
    if (cod.startsWith('CEO') || cod.startsWith('GRT')) return true;
  }
  if (!cargoStr) return false;
  const c = cargoStr.trim().toUpperCase();
  if (c === 'CEO' || c.startsWith('CEO ') || c.endsWith(' CEO') || c.includes('DIRETOR EXECUTIVO (CEO)')) return true;
  if (c === 'GRT' || c.startsWith('GRT ') || c.endsWith(' GRT') || c === 'GERENTE GERAL' || c.includes('GERENTE GERAL') || c.includes('GERENTE')) return true;
  return false;
};

export interface EmployeeModuleViewProps {
  user?: UserProfile | null;
  onEmployeeSaved?: (employee: Employee) => void;
  onClose?: () => void;
  initialEmployee?: Employee | null;
  isModal?: boolean;
}

export const EmployeeModuleView: React.FC<EmployeeModuleViewProps> = ({
  user,
  onEmployeeSaved,
  onClose,
  initialEmployee,
  isModal = false,
}) => {
  // Active View Mode: 'FORM' (Cadastro / Edição) or 'LIST' (Consultar Funcionários & Fichário)
  const [activeView, setActiveView] = useState<'FORM' | 'LIST'>('FORM');

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCodigo, setEditingCodigo] = useState<string | null>(null);

  // Form Basic Info (Pessoa Física Structure)
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | undefined>(undefined);
  const [dataNascimento, setDataNascimento] = useState('');
  const [dataAdmissao, setDataAdmissao] = useState(new Date().toISOString().split('T')[0]);

  // Role, Sector & Filial
  const [cargo, setCargo] = useState('Administrativo');
  const [customCargo, setCustomCargo] = useState('');
  const [setor, setSetor] = useState('Comercial & Vendas');
  const [filiaisList, setFiliaisList] = useState<FilialItem[]>([]);
  const [filialId, setFilialId] = useState<string>('filial-matriz-fortaleza');
  const [filialNome, setFilialNome] = useState<string>('TECIDO SUBLIMADO FORTALEZA');
  const [localAtuacao, setLocalAtuacao] = useState<'Fortaleza' | 'Piauí' | 'Shopee'>('Fortaleza');

  // Compensation & Financials
  const [salarioBase, setSalarioBase] = useState<number | ''>('');
  const [tipoSalario, setTipoSalario] = useState('Mensalista');
  const [comissaoPorcentagem, setComissaoPorcentagem] = useState<number | ''>('');
  const [tipoComissao, setTipoComissao] = useState('Sobre Vendas');
  const [metaIndividual, setMetaIndividual] = useState<number | ''>('');
  const [chavePix, setChavePix] = useState('');
  const [bancoInfo, setBancoInfo] = useState('');
  const [beneficios, setBeneficios] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Helper to check if role is Vendedor(a) or Recepção
  const isCommercialOrReceptionRole = (roleName: string, customName: string = '') => {
    const c = (roleName === 'Outro' ? customName : roleName).toLowerCase().trim();
    return c.includes('vendedor') || c.includes('recep');
  };

  // Helper to check if role is CEO (exclusivo do Desenvolvedor)
  const isCeoRole = (roleName: string, customName: string = '') => {
    return isGrtOrCeoCargo(roleName === 'Outro' ? customName : roleName);
  };

  // Determine if the current logged-in user is Master Administrator or Developer
  const checkHasGrtAndCeoAccess = (): boolean => {
    if (user) {
      if (isDeveloperOrAdminMaster(user.role, user.isDeveloper, user.username, user.name)) {
        return true;
      }
    }
    const logged = getLoggedUserAndPerfil();
    if (logged) {
      if (isDeveloperOrAdminMaster(logged.role, logged.isDeveloper, logged.username, logged.name)) {
        return true;
      }
    }
    return false;
  };

  const hasGrtAndCeoAccess = checkHasGrtAndCeoAccess();

  // Cargos available in the select dropdown (excludes LOGISTICA, Outro always; excludes CEO & Gerente Geral unless user is Master or Developer)
  const availableCargos = React.useMemo(() => {
    const isExcludedAlways = (c: string) => {
      const upper = c.toUpperCase();
      return upper === 'LOGISTICA' || upper === 'OUTRO';
    };

    if (hasGrtAndCeoAccess) {
      return CARGOS_PADRAO.filter((c) => !isExcludedAlways(c));
    }
    return CARGOS_PADRAO.filter((c) => !isExcludedAlways(c) && !isGrtOrCeoCargo(c));
  }, [hasGrtAndCeoAccess]);

  // Ensure unauthorized cargo is not pre-selected if access changes
  useEffect(() => {
    if (!hasGrtAndCeoAccess && isGrtOrCeoCargo(cargo, customCargo)) {
      setCargo('Administrativo');
      setCustomCargo('');
    }
  }, [hasGrtAndCeoAccess, cargo, customCargo]);

  // Developer Authorization Modal for CEO creation/update by non-developer profiles
  const [showCeoDevAuthModal, setShowCeoDevAuthModal] = useState<boolean>(false);
  const [ceoDevPassword, setCeoDevPassword] = useState<string>('');
  const [showCeoDevPassword, setShowCeoDevPassword] = useState<boolean>(false);
  const [ceoDevPasswordError, setCeoDevPasswordError] = useState<string>('');
  const [isVerifyingCeoAuth, setIsVerifyingCeoAuth] = useState<boolean>(false);

  // Contact and Address
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<EmployeeStatus>('ACTIVE');
  const [address, setAddress] = useState<Address>(initialAddress);

  // Login Credentials for ERP & Chat
  const [temLogin, setTemLogin] = useState<boolean>(false);
  const [loginUsuario, setLoginUsuario] = useState<string>('');
  const [loginSenha, setLoginSenha] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);

  // Fichário Digital (Attached documents)
  const [ficharioAnexos, setFicharioAnexos] = useState<EmployeeAttachment[]>([]);
  const [novoAnexoCategoria, setNovoAnexoCategoria] = useState<
    'Contrato' | 'Documento Pessoal' | 'Exame Médico' | 'Certificado' | 'Holerite' | 'Outros'
  >('Contrato');
  const [novoAnexoObs, setNovoAnexoObs] = useState('');

  // Feedback and Async states
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

  // List and Search State
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterCargo, setFilterCargo] = useState<string>('ALL');
  const [filterSetor, setFilterSetor] = useState<string>('ALL');
  const [filterFilial, setFilterFilial] = useState<string>('ALL');
  const [filterLocalAtuacao, setFilterLocalAtuacao] = useState<string>('ALL');

  // Detail Modal / Profile Drawer
  const [selectedProfile, setSelectedProfile] = useState<Employee | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<EmployeeAttachment | null>(null);

  // Delete Employee Confirmation with Password Modal
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [showDeletePassword, setShowDeletePassword] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingEmployee, setIsDeletingEmployee] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const topContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to top of module / screen
  const scrollToTop = () => {
    try {
      if (topContainerRef.current) {
        topContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.documentElement?.scrollTo({ top: 0, behavior: 'smooth' });
        document.body?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      window.scrollTo(0, 0);
    }
  };

  // Load registered employees on mount or refresh
  const fetchEmployees = async () => {
    try {
      const data = await ApiService.getEmployees();
      if (Array.isArray(data)) {
        setEmployeeList(data);
        // Backup to localStorage
        localStorage.setItem('subligestao_employees_cache', JSON.stringify(data));
      }
    } catch {
      // Fallback to local cache if offline
      const cached = localStorage.getItem('subligestao_employees_cache');
      if (cached) {
        try {
          setEmployeeList(JSON.parse(cached));
        } catch {}
      }
    }
  };

  useEffect(() => {
    fetchEmployees();

    const handleEmployeesUpdated = (event?: any) => {
      fetchEmployees();

      // Se o formulário estiver aberto editando o funcionário cuja senha foi alterada, atualiza o campo de senha
      const customDetail = event?.detail;
      if (customDetail?.newPassword && editingId) {
        setLoginSenha(customDetail.newPassword);
      }
    };

    window.addEventListener('subligestao_employees_updated', handleEmployeesUpdated);
    window.addEventListener('storage', handleEmployeesUpdated);

    // Load available filiais list (Cache local + Sincronização direta com o Banco de Dados)
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
      window.removeEventListener('subligestao_employees_updated', handleEmployeesUpdated);
      window.removeEventListener('storage', handleEmployeesUpdated);
      window.removeEventListener('subligestao_filiais_changed', handleFiliaisUpdated);
    };
  }, [editingId]);

  // Pre-fill form if editing existing employee or passed initial props
  useEffect(() => {
    if (initialEmployee) {
      if (!hasGrtAndCeoAccess && isGrtOrCeoCargo(initialEmployee.cargo, initialEmployee.codigo)) {
        setFeedback({
          type: 'error',
          message: 'Acesso Restrito: Apenas o Administrador Master e o Developer têm permissão para acessar os cargos Gerente Geral e CEO.',
        });
        resetForm();
        return;
      }
      loadEmployeeToForm(initialEmployee);
    }
  }, [initialEmployee, hasGrtAndCeoAccess]);

  const loadEmployeeToForm = (emp: Employee) => {
    if (!hasGrtAndCeoAccess && isGrtOrCeoCargo(emp.cargo, emp.codigo)) {
      setFeedback({
        type: 'error',
        message: 'Acesso Restrito: Apenas o Administrador Master e o Developer têm permissão para acessar os cargos Gerente Geral e CEO.',
      });
      return;
    }
    setEditingId(emp.id);
    setEditingCodigo(emp.codigo);
    setNome(emp.nome || '');
    setSobrenome(emp.sobrenome || '');
    setCpf(emp.cpf || '');
    setRg(emp.rg || '');
    setFotoUrl(emp.fotoUrl);
    setDataNascimento(emp.dataNascimento || '');
    setDataAdmissao(emp.dataAdmissao || '');

    if (CARGOS_PADRAO.includes(emp.cargo)) {
      setCargo(emp.cargo);
      setCustomCargo('');
    } else {
      setCargo('Outro');
      setCustomCargo(emp.cargo);
    }

    setSetor(emp.setor || 'Comercial & Vendas');
    setFilialId(emp.filialId || 'filial-matriz-fortaleza');
    setFilialNome(emp.filialNome || 'TECIDO SUBLIMADO FORTALEZA');
    setLocalAtuacao(
      (emp.localAtuacao as any) ||
      (emp.filialNome?.toLowerCase().includes('piauí') || emp.filialNome?.toLowerCase().includes('piaui') ? 'Piauí' : 'Fortaleza')
    );
    setSalarioBase(emp.salarioBase ?? '');
    setTipoSalario(emp.tipoSalario || 'Mensalista');
    setComissaoPorcentagem(emp.comissaoPorcentagem ?? '');
    setTipoComissao(emp.tipoComissao || 'Sobre Vendas');
    setMetaIndividual(emp.metaIndividual ?? '');
    setChavePix(emp.chavePix || '');
    setBancoInfo(emp.bancoInfo || '');
    setBeneficios(emp.beneficios || '');
    setObservacoes(emp.observacoes || '');

    setTelefone(emp.telefone || '');
    setEmail(emp.email || '');
    setStatus(emp.status || 'ACTIVE');
    setTemLogin(!!emp.temLogin);
    setLoginUsuario(emp.loginUsuario || '');
    setLoginSenha(emp.loginSenha || '');
    if (emp.endereco) setAddress(emp.endereco);
    setFicharioAnexos(emp.ficharioAnexos || []);

    setActiveView('FORM');
  };

  // Reset Form
  const resetForm = () => {
    setEditingId(null);
    setEditingCodigo(null);
    setNome('');
    setSobrenome('');
    setCpf('');
    setRg('');
    setFotoUrl(undefined);
    setDataNascimento('');
    setDataAdmissao(new Date().toISOString().split('T')[0]);
    setCargo('Administrativo');
    setCustomCargo('');
    setSetor('Comercial & Vendas');
    if (filiaisList.length > 0) {
      setFilialId(filiaisList[0].id);
      setFilialNome(filiaisList[0].nome);
    } else {
      setFilialId('filial-matriz-fortaleza');
      setFilialNome('TECIDO SUBLIMADO FORTALEZA');
    }
    setLocalAtuacao('Fortaleza');
    setSalarioBase('');
    setTipoSalario('Mensalista');
    setComissaoPorcentagem('');
    setTipoComissao('Sobre Vendas');
    setMetaIndividual('');
    setChavePix('');
    setBancoInfo('');
    setBeneficios('');
    setObservacoes('');
    setTelefone('');
    setEmail('');
    setStatus('ACTIVE');
    setTemLogin(false);
    setLoginUsuario('');
    setLoginSenha('');
    setShowLoginPassword(false);
    setAddress(initialAddress);
    setFicharioAnexos([]);
    setNovoAnexoObs('');
    setFeedback({ type: null, message: '' });
  };

  // Format CPF Input dynamically
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (raw.length > 9) {
      raw = raw.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    } else if (raw.length > 6) {
      raw = raw.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    } else if (raw.length > 3) {
      raw = raw.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    }
    setCpf(raw);
  };

  // Format Phone Input dynamically
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (raw.length > 10) {
      raw = raw.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (raw.length > 6) {
      raw = raw.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else if (raw.length > 2) {
      raw = raw.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    }
    setTelefone(raw);
  };

  // Photo Upload Handler (Base64)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Por favor, selecione um arquivo de imagem válido (PNG/JPG).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'A foto deve ter no máximo 5MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFotoUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Attach Document Handler for Fichario
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (file.size > 15 * 1024 * 1024) {
        setFeedback({ type: 'error', message: `O arquivo ${file.name} excede o limite de 15MB.` });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'arquivo';
        const formattedSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

        const newAnexo: EmployeeAttachment = {
          id: `ANX-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          nomeArquivo: file.name,
          tipoArquivo: ext,
          categoriaDoc: novoAnexoCategoria,
          tamanhoFormatado: formattedSize,
          dataUpload: new Date().toLocaleDateString('pt-BR'),
          dataUrl: event.target?.result as string,
          observacao: novoAnexoObs.trim() || undefined,
        };

        setFicharioAnexos((prev) => [newAnexo, ...prev]);
        setFeedback({ type: 'success', message: `Arquivo "${file.name}" anexado ao fichário!` });
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
    setNovoAnexoObs('');
  };

  // Remove File from Fichario
  const handleRemoveAnexo = (anexoId: string) => {
    setFicharioAnexos((prev) => prev.filter((item) => item.id !== anexoId));
  };

  // Execute Save Employee (after validations & developer authorization if required)
  const executeSaveEmployee = async (developerPasswordAuth?: string) => {
    const finalCargo = cargo === 'Outro' ? customCargo.trim() || 'Outro' : cargo;

    const payload = {
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      cpf: cpf.trim(),
      rg: rg.trim(),
      fotoUrl,
      dataNascimento,
      dataAdmissao,
      cargo: finalCargo,
      setor,
      filialId,
      filialNome,
      localAtuacao,
      salarioBase: Number(salarioBase) || 0,
      tipoSalario,
      comissaoPorcentagem: Number(comissaoPorcentagem) || 0,
      tipoComissao,
      metaIndividual: metaIndividual === '' ? 0 : Number(metaIndividual),
      chavePix: chavePix.trim(),
      bancoInfo: bancoInfo.trim(),
      beneficios: beneficios.trim(),
      observacoes: observacoes.trim(),
      endereco: address,
      telefone: telefone.trim(),
      email: email.trim(),
      status,
      temLogin,
      loginUsuario: loginUsuario.trim(),
      loginSenha: loginSenha.trim(),
      developerPassword: developerPasswordAuth,
      ficharioAnexos,
    };

    setIsSubmitting(true);

    try {
      let resultEmployee: Employee;

      if (editingId) {
        // Update
        const updated = await ApiService.updateEmployee(editingId, payload);
        resultEmployee = updated;
        const successMsg = isCeoRole(finalCargo) && developerPasswordAuth
          ? `👑 Cadastro de "${nome} ${sobrenome}" [${editingCodigo} - CEO] atualizado com sucesso com autorização do Desenvolvedor!`
          : `✅ Cadastro de "${nome} ${sobrenome}" [${editingCodigo}] atualizado com sucesso!`;

        resetForm();
        setFeedback({
          type: 'success',
          message: successMsg,
        });
        scrollToTop();
        setTimeout(scrollToTop, 100);
      } else {
        // Create
        const created = await ApiService.createEmployee(payload);
        resultEmployee = created;
        const successMsg = isCeoRole(finalCargo) && developerPasswordAuth
          ? `👑 Funcionário "${created.nome} ${created.sobrenome}" [Código: ${created.codigo} - CEO] cadastrado com sucesso com autorização do Desenvolvedor!`
          : `🎉 Funcionário "${created.nome} ${created.sobrenome}" [Código: ${created.codigo}] cadastrado com sucesso! Os campos foram limpos para um novo cadastro.`;

        resetForm();
        setFeedback({
          type: 'success',
          message: successMsg,
        });
        scrollToTop();
        setTimeout(scrollToTop, 100);
      }

      await fetchEmployees();

      if (onEmployeeSaved) {
        onEmployeeSaved(resultEmployee);
      }

      // If modal mode and callback provided, close after brief delay
      if (isModal && onClose) {
        setTimeout(() => onClose(), 1200);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao realizar o cadastro do funcionário.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback({ type: null, message: '' });

    const logged = getLoggedUserAndPerfil();
    const currentRole = user?.role || logged.role;
    const currentIsDev = user?.isDeveloper ?? logged.isDeveloper;
    const canCreateEdit = canUserPerformAction(currentRole, 'funcionarios', 'criarEditar', currentIsDev);
    if (!canCreateEdit) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para Criar / Editar Funcionários (permissão desmarcada no RBAC).',
      });
      return;
    }

    // Validations
    if (!nome.trim()) {
      setFeedback({ type: 'error', message: 'Nome do funcionário é obrigatório.' });
      return;
    }
    if (!sobrenome.trim()) {
      setFeedback({ type: 'error', message: 'Sobrenome do funcionário é obrigatório.' });
      return;
    }
    if (!cpf.trim()) {
      setFeedback({ type: 'error', message: 'CPF do funcionário é obrigatório.' });
      return;
    }
    if (!validateCPF(cpf)) {
      setFeedback({ type: 'error', message: 'CPF informado é matematicamente inválido. Verifique os dígitos.' });
      return;
    }
    if (!telefone.trim()) {
      setFeedback({ type: 'error', message: 'Telefone de contato é obrigatório.' });
      return;
    }
    if (email.trim() && !/\S+@\S+\.\S+/.test(email.trim())) {
      setFeedback({ type: 'error', message: 'E-mail informado é inválido.' });
      return;
    }

    if (temLogin) {
      if (!loginUsuario.trim()) {
        setFeedback({
          type: 'error',
          message: 'Ao habilitar o login de acesso, o Nome de Usuário (Login) é obrigatório.',
        });
        return;
      }
      if (!editingId && !loginSenha.trim()) {
        setFeedback({
          type: 'error',
          message: 'Ao habilitar o login para um novo funcionário, a Senha de Acesso é obrigatória.',
        });
        return;
      }
    }

    const finalCargo = cargo === 'Outro' ? customCargo.trim() || 'Outro' : cargo;
    const isRestrictedCargo = isGrtOrCeoCargo(finalCargo);

    // If Gerente Geral or CEO role is selected and logged-in user is NOT Master Admin or Developer, restrict access
    if (isRestrictedCargo && !hasGrtAndCeoAccess) {
      setFeedback({
        type: 'error',
        message: 'Acesso Restrito: Apenas o Administrador Master e o Developer têm permissão para acessar ou cadastrar os cargos Gerente Geral e CEO.',
      });
      return;
    }

    // Direct registration if authorized as Master or Developer, or regular role
    await executeSaveEmployee();
  };

  // Confirm Developer Authorization for CEO
  const handleConfirmCeoDevAuth = async () => {
    const trimmed = ceoDevPassword.trim();
    if (!trimmed) {
      setCeoDevPasswordError('A senha de permissão do Developer é obrigatória.');
      return;
    }

    setIsVerifyingCeoAuth(true);
    setCeoDevPasswordError('');

    try {
      let isValid = false;
      try {
        const res = await ApiService.verifyPassword(trimmed);
        if (res && res.valid && (res.superiorRole === 'DEVELOPER' || (res as any).isDeveloper || res.message?.toLowerCase().includes('desenvolvedor'))) {
          isValid = true;
        }
      } catch {
        isValid = false;
      }

      if (!isValid) {
        setCeoDevPasswordError('Senha do Developer incorreta! O cadastro do cargo de CEO não foi autorizado.');
        setIsVerifyingCeoAuth(false);
        return;
      }

      setShowCeoDevAuthModal(false);
      await executeSaveEmployee(trimmed);
    } catch (err: any) {
      setCeoDevPasswordError(err.message || 'Senha do Developer incorreta!');
    } finally {
      setIsVerifyingCeoAuth(false);
    }
  };

  // Initiate Delete Employee (RBAC & Developer check)
  const handleInitiateDeleteEmployee = (emp: Employee) => {
    const logged = getLoggedUserAndPerfil();
    const isDev = Boolean(
      logged.isDeveloper ||
      user?.isDeveloper ||
      user?.role === 'Developer' ||
      user?.role?.toLowerCase().includes('developer') ||
      logged.role?.toLowerCase().includes('developer') ||
      logged.role?.toLowerCase().includes('desenvolvedor') ||
      logged.username?.toLowerCase().includes('marcelo-dev')
    );

    // Developer profile has 100% full access to all operations; does NOT require RBAC permission check
    if (isDev) {
      setEmployeeToDelete(emp);
      setDeletePassword('');
      setDeleteError(null);
      setShowDeletePassword(false);
      return;
    }

    // Other roles: rigorously enforce marked RBAC 'excluir' permission
    const canDelete = canUserPerformAction(logged.role, 'funcionarios', 'excluir', isDev);
    if (!canDelete) {
      setFeedback({
        type: 'error',
        message: 'Acesso Negado: Seu perfil não possui permissão para Excluir Registros de Funcionários (permissão desmarcada no RBAC).',
      });
      return;
    }

    setEmployeeToDelete(emp);
    setDeletePassword('');
    setDeleteError(null);
    setShowDeletePassword(false);
  };

  // Confirm and Execute Employee Deletion with Hierarchical Superior Password Verification
  const handleConfirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    const trimmedPass = deletePassword.trim();
    if (!trimmedPass) {
      setDeleteError('Por favor, informe a senha de acesso de um Superior autorizado (Developer, CEO, Gerente Geral ou Supervisor).');
      return;
    }

    setIsDeletingEmployee(true);
    setDeleteError(null);

    try {
      const { username: loggedUsername } = getLoggedUserAndPerfil();
      const targetCargo = employeeToDelete.cargo;

      // Unificada com regras estritas de hierarquia:
      // Developer > CEO > Gerente Geral > Supervisor
      // Supervisor não pode excluir Gerente | Gerente não pode excluir CEO | Developer total
      const verifyRes = await verifySuperiorPassword(trimmedPass, {
        targetRole: targetCargo,
        loggedUsername,
        actionDescription: `Exclusão de Funcionário: ${employeeToDelete.nome} ${employeeToDelete.sobrenome} (${targetCargo})`,
      });

      if (!verifyRes.valid) {
        setDeleteError(
          verifyRes.error ||
            'Senha incorreta ou sem permissão hierárquica suficiente para autorizar a exclusão.'
        );
        setIsDeletingEmployee(false);
        return;
      }

      // Password is valid: proceed to delete
      const targetId = employeeToDelete.id;
      const targetCode = employeeToDelete.codigo;
      const targetName = `${employeeToDelete.nome} ${employeeToDelete.sobrenome}`;

      try {
        await ApiService.deleteEmployee(targetId);
      } catch (apiErr: any) {
        console.warn('API delete request warning:', apiErr?.message);
      }

      // Update state immediately
      setEmployeeList((prev) => prev.filter((e) => e.id !== targetId));

      // Clean up cached list if present
      try {
        const cached = localStorage.getItem('subligestao_employees_cache');
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const updated = list.filter((e: any) => e.id !== targetId);
            localStorage.setItem('subligestao_employees_cache', JSON.stringify(updated));
          }
        }
      } catch {}

      if (selectedProfile?.id === targetId) {
        setSelectedProfile(null);
      }
      if (editingId === targetId) {
        resetForm();
      }

      setEmployeeToDelete(null);
      setDeletePassword('');
      setDeleteError(null);

      setFeedback({
        type: 'success',
        message: `🗑️ Funcionário [${targetCode}] "${targetName}" foi excluído com sucesso por autorização de ${verifyRes.superiorRole || 'Superior'}!`,
      });

      await fetchEmployees();
    } catch (err: any) {
      setDeleteError(err.message || 'Falha ao excluir o cadastro do funcionário.');
    } finally {
      setIsDeletingEmployee(false);
    }
  };

  // 1. Base visibility filter: hide GRT and CEO employees if not Master Admin or Developer
  const visibleEmployees = React.useMemo(() => {
    if (hasGrtAndCeoAccess) {
      return employeeList;
    }
    return employeeList.filter((emp) => !isGrtOrCeoCargo(emp.cargo, emp.codigo));
  }, [employeeList, hasGrtAndCeoAccess]);

  // Intelligent Search Filter for Employees & Fichário
  const filteredEmployees = visibleEmployees.filter((emp) => {
    const rawSearch = searchTerm.trim().toLowerCase();
    
    // Status, Cargo, Sector, Filial & Lugar de Atuação filters
    const matchesStatus = filterStatus === 'ALL' || emp.status === filterStatus;
    const matchesCargo = filterCargo === 'ALL' || 
                         (emp.cargo || '').toLowerCase() === filterCargo.toLowerCase() ||
                         (emp.cargo || '').toLowerCase().includes(filterCargo.toLowerCase());
    const matchesSetor = filterSetor === 'ALL' || emp.setor === filterSetor;
    const matchesFilial = filterFilial === 'ALL' || emp.filialId === filterFilial;
    const empLocal = emp.localAtuacao || (emp.filialNome?.toLowerCase().includes('piauí') || emp.filialNome?.toLowerCase().includes('piaui') ? 'Piauí' : 'Fortaleza');
    const matchesLocalAtuacao = filterLocalAtuacao === 'ALL' || empLocal.toLowerCase() === filterLocalAtuacao.toLowerCase();
    if (!matchesStatus || !matchesCargo || !matchesSetor || !matchesFilial || !matchesLocalAtuacao) return false;

    if (!rawSearch) return true;

    // Split search into individual terms for intelligent multi-word matching
    const searchTerms = rawSearch.split(/\s+/);
    
    const fullName = `${emp.nome} ${emp.sobrenome}`.toLowerCase();
    const rawCpf = (emp.cpf || '').replace(/\D/g, '');
    const formattedCpf = (emp.cpf || '').toLowerCase();
    const rawPhone = (emp.telefone || '').replace(/\D/g, '');
    const formattedPhone = (emp.telefone || '').toLowerCase();
    const codigo = (emp.codigo || '').toLowerCase();
    const cargo = (emp.cargo || '').toLowerCase();
    const setor = (emp.setor || '').toLowerCase();
    const email = (emp.email || '').toLowerCase();
    const rg = (emp.rg || '').toLowerCase();
    const localAtuacaoStr = (emp.localAtuacao || '').toLowerCase();

    // Check if every search term matches at least one attribute of the employee or their fichário attachments
    return searchTerms.every((term) => {
      const cleanTerm = term.replace(/\D/g, '');

      const matchesBasic =
        fullName.includes(term) ||
        codigo.includes(term) ||
        cargo.includes(term) ||
        setor.includes(term) ||
        localAtuacaoStr.includes(term) ||
        email.includes(term) ||
        rg.includes(term) ||
        formattedCpf.includes(term) ||
        formattedPhone.includes(term);

      const matchesCleanNumbers =
        cleanTerm.length > 0 && (rawCpf.includes(cleanTerm) || rawPhone.includes(cleanTerm));

      const matchesFichario =
        emp.ficharioAnexos &&
        emp.ficharioAnexos.some(
          (anexo) =>
            anexo.nomeArquivo.toLowerCase().includes(term) ||
            anexo.categoriaDoc.toLowerCase().includes(term) ||
            (anexo.observacao && anexo.observacao.toLowerCase().includes(term))
        );

      return matchesBasic || matchesCleanNumbers || matchesFichario;
    });
  });

  // Calculate Metrics
  const totalEmployees = visibleEmployees.length;
  const activeEmployees = visibleEmployees.filter((e) => e.status === 'ACTIVE').length;
  const totalPayroll = visibleEmployees.reduce((acc, curr) => acc + (curr.salarioBase || 0), 0);
  const totalCommissioned = visibleEmployees.filter((e) => (e.comissaoPorcentagem || 0) > 0).length;
  const totalFiles = visibleEmployees.reduce((acc, curr) => acc + (curr.ficharioAnexos?.length || 0), 0);

  // Download / View File Helper
  const openAttachmentInNewTab = (dataUrl: string, fileName: string) => {
    const win = window.open();
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>${fileName}</title>
            <style>
              body { margin: 0; background: #0f172a; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: sans-serif; }
              iframe, img { max-width: 100%; max-height: 100vh; border: none; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            </style>
          </head>
          <body>
            ${
              dataUrl.startsWith('data:image/')
                ? `<img src="${dataUrl}" alt="${fileName}" />`
                : `<iframe src="${dataUrl}" width="100%" height="100%"></iframe>`
            }
          </body>
        </html>
      `);
    }
  };

  return (
    <div ref={topContainerRef} className="space-y-6 animate-fadeIn">
      {/* ==============================================================
          MODULE HEADER - DISCREET & MINIMALIST
         ============================================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserCheck className="w-7 h-7 text-blue-600 shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Módulo de Gestão de Funcionários & Fichário Digital
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
              Cadastre colaboradores, defina salários e comissões, gerencie documentos e consulte o fichário.
            </p>
          </div>
        </div>

        {/* TOP ACTION BUTTONS (ALWAYS VISIBLE ON MOBILE & DESKTOP) */}
        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          {editingCodigo && activeView === 'FORM' && (
            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-bold flex items-center gap-1">
              <Edit2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Editando: {editingCodigo}</span>
            </span>
          )}

          {/* BOTÃO CADASTRAR NOVO FUNCIONÁRIO */}
          <button
            type="button"
            onClick={() => {
              resetForm();
              setActiveView('FORM');
            }}
            className={`p-2.5 sm:p-2 rounded-xl border transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
              activeView === 'FORM' && !editingId
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white hover:bg-blue-50 text-blue-600 border-slate-200 hover:border-blue-200'
            }`}
            title={editingId ? `Cadastrar Novo Funcionário (Limpar Edição: ${editingCodigo})` : 'Cadastrar Novo Funcionário'}
            aria-label="Cadastrar Novo Funcionário"
          >
            <UserPlus className="w-5 h-5 text-current" />
            <span className="text-xs font-bold sm:hidden">Cadastrar Novo</span>
          </button>

          {/* BOTÃO CONSULTAR & FICHÁRIO */}
          <button
            type="button"
            onClick={() => {
              setActiveView('LIST');
              fetchEmployees();
            }}
            className={`p-2.5 sm:p-2 rounded-xl border transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
              activeView === 'LIST'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white hover:bg-blue-50 text-blue-600 border-slate-200 hover:border-blue-200'
            }`}
            title={`Consultar & Fichário (${totalEmployees})`}
            aria-label={`Consultar & Fichário (${totalEmployees})`}
          >
            <FolderOpen className="w-5 h-5 text-current" />
            <span className="text-xs font-bold sm:hidden">Fichário ({totalEmployees})</span>
          </button>
        </div>
      </div>

      {/* FLOATING DISCREET FEEDBACK TOAST (Auto-dismisses in 3 seconds) */}
      {feedback.type && feedback.message && (
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

      {/* ==============================================================
          VIEW 1: FORM - CADASTRO / EDIÇÃO DE FUNCIONÁRIO (PESSOA FÍSICA)
         ============================================================== */}
      {activeView === 'FORM' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* CARD 1: DADOS PESSOAIS E CARGO (PESSOA FÍSICA) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <User className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
                  1. Dados Pessoais e Função do Colaborador
                </h2>
              </div>
              
              {editingCodigo && (
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold">
                  Código: {editingCodigo}
                </span>
              )}
            </div>

            {/* Photo & Basic Inputs Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Photo Upload Avatar Box */}
              <div className="md:col-span-3 flex flex-col items-center justify-center p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center space-y-3">
                <div className="relative group w-28 h-28 rounded-full overflow-hidden border-2 border-blue-600 bg-white shadow-md flex items-center justify-center">
                  {fotoUrl ? (
                    <img src={fotoUrl} alt="Foto do Funcionário" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-slate-300" />
                  )}
                </div>
                <input
                  type="file"
                  ref={photoInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-sm font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>{fotoUrl ? 'Alterar Foto' : 'Carregar Foto'}</span>
                </button>
              </div>

              {/* Main Fields */}
              <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Nome */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700 flex items-center justify-between">
                    <span>Nome <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: João"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                {/* Sobrenome */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700">
                    Sobrenome <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={sobrenome}
                    onChange={(e) => setSobrenome(e.target.value)}
                    placeholder="Ex: Silva Santos"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                {/* CPF */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700">
                    CPF <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={cpf}
                    onChange={handleCpfChange}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                {/* RG */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700">RG / Doc</label>
                  <input
                    type="text"
                    value={rg}
                    onChange={(e) => setRg(e.target.value)}
                    placeholder="Ex: 12.345.678-9"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                {/* Data de Nascimento */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700">Data Nasc.</label>
                  <input
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                {/* Data de Admissão */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700">Data Admissão</label>
                  <input
                    type="date"
                    value={dataAdmissao}
                    onChange={(e) => setDataAdmissao(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                {/* Cargo / Função */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700">
                    Cargo / Função <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  >
                    {availableCargos.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Custom Cargo if 'Outro' selected */}
                {cargo === 'Outro' && (
                  <div className="space-y-1">
                    <label className="text-sm font-extrabold text-slate-700">Especifique o Cargo</label>
                    <input
                      type="text"
                      value={customCargo}
                      onChange={(e) => setCustomCargo(e.target.value)}
                      placeholder="Ex: Operador CNC"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                    />
                  </div>
                )}

                {/* GRT and CEO Exclusive Banner for Master / Developer */}
                {isGrtOrCeoCargo(cargo, customCargo) && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    {hasGrtAndCeoAccess ? (
                      <div className="bg-gradient-to-r from-amber-900/10 via-purple-900/10 to-blue-900/10 border-2 border-amber-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-slate-900 shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-amber-600 text-white rounded-xl shadow-xs shrink-0">
                            <Crown className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-black uppercase tracking-wide flex items-center gap-1.5 text-amber-900">
                              Cargo de Alta Governança ({cargo === 'Outro' ? customCargo || 'Personalizado' : cargo}) • Acesso Master / Developer
                            </span>
                            <p className="text-[11px] text-slate-700 font-semibold mt-0.5">
                              Como Administrador Master ou Desenvolvedor, você possui autorização direta e irrestrita para gerenciar este cargo estratégico.
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-amber-600 text-white text-[10px] font-black rounded-lg uppercase tracking-wider shrink-0 shadow-xs">
                          Acesso Autorizado
                        </span>
                      </div>
                    ) : (
                      <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-3.5 flex items-center gap-3 text-rose-950 shadow-xs">
                        <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs shrink-0">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-black uppercase tracking-wide flex items-center gap-1.5 text-rose-900">
                            Acesso Restrito: Cargo Exclusivo
                          </span>
                          <p className="text-[11px] text-rose-700 font-semibold mt-0.5">
                            Os cargos Gerente Geral e CEO são exclusivos do Administrador Master e do Developer.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Meta Individual Mensal (Abre quando selecionado Vendedor(a) ou Recepção) */}
                {isCommercialOrReceptionRole(cargo, customCargo) && (
                  <div className="sm:col-span-2 lg:col-span-3 bg-gradient-to-r from-purple-50 via-indigo-50/70 to-blue-50 border-2 border-purple-300/80 rounded-2xl p-4 space-y-2.5 shadow-xs transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-black text-purple-950 flex items-center gap-2 uppercase tracking-wide">
                        <Target className="w-4 h-4 text-purple-600 animate-pulse" />
                        <span>Meta Individual Mensal de Vendas / Atendimento (R$)</span>
                      </label>
                      <span className="px-2.5 py-0.5 bg-purple-200/90 text-purple-900 text-[10px] font-black rounded-full uppercase tracking-wider">
                        🎯 Habilitado para {cargo === 'Outro' ? customCargo || 'Cargo Comercial' : cargo}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-purple-700">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={metaIndividual}
                          onChange={(e) => setMetaIndividual(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="0,00 (Ex: 30000.00)"
                          className="w-full bg-white border-2 border-purple-300 focus:border-purple-600 rounded-xl pl-11 pr-4 py-2.5 text-base font-black text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition shadow-xs"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] font-semibold text-purple-700 flex items-center gap-1.5">
                      <span>💡 Esta meta individual define o cálculo de desempenho no Dashboard individual do colaborador e sua meta mensal.</span>
                    </p>
                  </div>
                )}

                {/* Setor */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700">
                    Setor / Depto <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={setor}
                    onChange={(e) => setSetor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  >
                    {SECTORES_PADRAO.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filial de Lotação */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700 flex items-center justify-between">
                    <span>Filial de Lotação <span className="text-rose-500">*</span></span>
                  </label>
                  <select
                    value={filialId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setFilialId(selectedId);
                      const matched = filiaisList.find((f) => f.id === selectedId);
                      setFilialNome(matched ? matched.nome : 'MATRIZ');
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  >
                    {filiaisList.map((f) => (
                      <option key={f.id} value={f.id}>
                        🏢 {f.codigo} - {f.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lugar de Atuação (Fortaleza, Piauí ou Shopee) */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700 flex items-center justify-between">
                    <span>Lugar de Atuação <span className="text-rose-500">*</span></span>
                  </label>
                  <select
                    value={localAtuacao}
                    onChange={(e) => {
                      const val = e.target.value as 'Fortaleza' | 'Piauí' | 'Shopee';
                      setLocalAtuacao(val);
                      if (val === 'Shopee' && (!cargo || cargo === 'Vendedor(a)' || cargo === 'Operador')) {
                        setCargo('Vendedora Shopee');
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  >
                    <option value="Fortaleza">📍 Fortaleza</option>
                    <option value="Piauí">📍 Piauí</option>
                    <option value="Shopee">🛍️ Shopee</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700">Status da Conta</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  >
                    <option value="ACTIVE">🟢 Ativo em Exercício</option>
                    <option value="AFASTADO">🟡 Afastado / Licença</option>
                    <option value="INACTIVE">🔴 Desligado / Inativo</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: REMUNERAÇÃO, SALÁRIO E COMISSÕES */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
                2. Informações Financeiras, Salário & Comissões
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Valor Salarial */}
              <div className="space-y-1 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                <label className="text-sm font-black text-emerald-900 flex items-center justify-between">
                  <span>Valor Salarial (R$)</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salarioBase}
                  onChange={(e) => setSalarioBase(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-white border border-emerald-300 rounded-lg px-3.5 py-2.5 text-base font-black text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                />
              </div>

              {/* Tipo de Salário */}
              <div className="space-y-1">
                <label className="text-sm font-extrabold text-slate-700">Regime Salarial</label>
                <select
                  value={tipoSalario}
                  onChange={(e) => setTipoSalario(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                >
                  <option value="Mensalista">Mensalista (CLT)</option>
                  <option value="Hora">Por Hora / Horista</option>
                  <option value="Diarista">Diarista / Eventual</option>
                  <option value="Comissionado">100% Comissionado</option>
                  <option value="PJ">Pessoa Jurídica (PJ)</option>
                </select>
              </div>

              {/* Comissões (%) */}
              <div className="space-y-1 bg-blue-50/50 p-3 rounded-xl border border-blue-200">
                <label className="text-sm font-black text-blue-900 flex items-center justify-between">
                  <span>Comissão (%)</span>
                  <Percent className="w-4 h-4 text-blue-600" />
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={comissaoPorcentagem}
                  onChange={(e) => setComissaoPorcentagem(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.0 %"
                  className="w-full bg-white border border-blue-300 rounded-lg px-3.5 py-2.5 text-base font-black text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              {/* Tipo de Comissão */}
              <div className="space-y-1">
                <label className="text-sm font-extrabold text-slate-700">Regra de Comissão</label>
                <select
                  value={tipoComissao}
                  onChange={(e) => setTipoComissao(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                >
                  <option value="Sobre Vendas">Sobre Vendas Faturadas</option>
                  <option value="Sobre Produção">Sobre Peças / M² Produzidos</option>
                  <option value="Fixa por OS">Valor Fixo por OS Finalizada</option>
                  <option value="Sem Comissão">Isento de Comissão</option>
                </select>
              </div>

              {/* Chave PIX */}
              <div className="space-y-1">
                <label className="text-sm font-extrabold text-slate-700">Chave PIX</label>
                <input
                  type="text"
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  placeholder="CPF, Telefone, E-mail ou Chave Aleatória"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              {/* Dados Bancários */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-extrabold text-slate-700">Banco / Agência / Conta</label>
                <input
                  type="text"
                  value={bancoInfo}
                  onChange={(e) => setBancoInfo(e.target.value)}
                  placeholder="Ex: Banco do Brasil - Ag: 1234 - Conta: 56789-0"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              {/* Benefícios */}
              <div className="space-y-1">
                <label className="text-sm font-extrabold text-slate-700">Benefícios</label>
                <input
                  type="text"
                  value={beneficios}
                  onChange={(e) => setBeneficios(e.target.value)}
                  placeholder="Ex: VT (R$ 15,00/dia), VR (R$ 25,00/dia)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>
            </div>
          </div>

          {/* CARD 3: CREDENCIAIS DE ACESSO AO SISTEMA & CHAT INTERNO */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <h2 className="text-base font-black uppercase tracking-wide text-slate-900">
                    3. Credenciais de Acesso (Login & Senha)
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Cadastre o login e a senha para permitir entrada no ERP e exibição automática em Mensagens Internas.
                  </p>
                </div>
              </div>

              <label 
                id="btn-toggle-login-acesso"
                className={`relative inline-flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all cursor-pointer select-none shadow-xs shrink-0 self-start sm:self-auto ${
                  temLogin
                    ? 'bg-emerald-50 border-emerald-500 hover:bg-emerald-100/80 text-emerald-950'
                    : 'bg-slate-100 border-slate-300 hover:bg-slate-200 hover:border-slate-400 text-slate-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={temLogin}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setTemLogin(checked);
                    if (checked && !loginUsuario && nome) {
                      const cleanName = nome
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/\s+/g, '.');
                      setLoginUsuario(`@${cleanName}`);
                    }
                  }}
                  className="sr-only"
                />
                {/* Switch visual com alto contraste */}
                <div
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 border ${
                    temLogin
                      ? 'bg-emerald-600 border-emerald-700'
                      : 'bg-slate-300 border-slate-400'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md border border-slate-200 transform transition-transform ${
                      temLogin ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </div>

                {/* Texto e status em destaque */}
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    {temLogin ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                    <span
                      className={`text-xs font-black uppercase tracking-tight ${
                        temLogin ? 'text-emerald-800' : 'text-slate-800'
                      }`}
                    >
                      {temLogin ? 'Login Habilitado' : 'Sem Acesso ao Chat/ERP'}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold ${
                      temLogin ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {temLogin ? 'Acesso ao ERP & Chat Ativo' : 'Clique aqui para liberar acesso'}
                  </span>
                </div>
              </label>
            </div>

            {temLogin ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 animate-fadeIn">
                {/* Login / Usuário */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700 flex items-center justify-between">
                    <span>Nome de Usuário (Login) <span className="text-rose-500">*</span></span>
                    <span className="text-[10px] text-blue-600 font-bold">Ex: @joao.silva</span>
                  </label>
                  <input
                    type="text"
                    required={temLogin}
                    value={loginUsuario}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val && !val.startsWith('@')) val = `@${val}`;
                      setLoginUsuario(val);
                    }}
                    placeholder="@nome.usuario"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                  <p className="text-[11px] text-slate-500 font-medium">
                    Com este login ativo, o funcionário aparecerá na lista de colaboradores no Chat de Mensagens Internas.
                  </p>
                </div>

                {/* Senha */}
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-slate-700 flex items-center justify-between">
                    <span>
                      Senha de Acesso{' '}
                      {editingId ? (
                        <span className="text-slate-400 font-normal">(Deixe em branco para manter a atual)</span>
                      ) : (
                        <span className="text-rose-500">*</span>
                      )}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required={temLogin && !editingId}
                      value={loginSenha}
                      onChange={(e) => setLoginSenha(e.target.value)}
                      placeholder={editingId ? '•••••••• (Inalterada)' : 'Defina a senha'}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-600 transition text-xs font-bold px-2 py-1 rounded-lg bg-slate-200/80 hover:bg-slate-200"
                    >
                      {showLoginPassword ? 'Ocultar' : 'Exibir'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Utilizada para autenticação do funcionário na tela de Login.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic pt-1">
                Ative a chave acima para criar o nome de usuário (Login) e a senha do funcionário. Todos os colaboradores cadastrados com Login e Senha aparecem automaticamente nas listas do módulo de Mensagens Internas (com Nome, Cargo e Setor).
              </p>
            )}
          </div>

          {/* CARD 4: CONTATO E ENDEREÇO */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <Phone className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
                4. Contato e Endereço Residencial
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Telefone */}
              <div className="space-y-1">
                <label className="text-sm font-extrabold text-slate-700">
                  Telefone / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={telefone}
                  onChange={handlePhoneChange}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              {/* E-mail */}
              <div className="space-y-1">
                <label className="text-sm font-extrabold text-slate-700">
                  E-mail Corporativo / Pessoal
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colaborador@subligestao.com.br"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>
            </div>

            {/* Address Component */}
            <div className="pt-2">
              <AddressForm value={address} onChange={setAddress} />
            </div>
          </div>

          {/* CARD 5: FICHÁRIO DIGITAL DO FUNCIONÁRIO (ANEXOS PDF, PNG, IMG, ETC.) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
                  5. Fichário Digital do Funcionário (Anexos em PDF, PNG, Imagens, etc.)
                </h2>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold">
                {ficharioAnexos.length} documento(s) anexado(s)
              </span>
            </div>

            {/* File Upload Dropzone */}
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-800">
                  Anexe contratos, documentos pessoais (RG/CPF), exames ASO, holerites e certificados
                </p>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  Formatos aceitos: PDF, PNG, JPG, JPEG, WEBP, DOCX (Tamanho máx: 15MB por arquivo).
                </p>
              </div>

              {/* Category & Observation Row */}
              <div className="max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">Categoria do Documento</label>
                  <select
                    value={novoAnexoCategoria}
                    onChange={(e) =>
                      setNovoAnexoCategoria(
                        e.target.value as any
                      )
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900"
                  >
                    <option value="Contrato">Contrato de Trabalho</option>
                    <option value="Documento Pessoal">Documento Pessoal (RG/CPF)</option>
                    <option value="Exame Médico">Exame Médico ASO</option>
                    <option value="Certificado">Certificado / Diploma</option>
                    <option value="Holerite">Holerite / Comprovante</option>
                    <option value="Outros">Outros Documentos</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">Observação / Título</label>
                  <input
                    type="text"
                    value={novoAnexoObs}
                    onChange={(e) => setNovoAnexoObs(e.target.value)}
                    placeholder="Ex: Assinado em 10/05/2026"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900"
                  />
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-black inline-flex items-center gap-2 transition shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Selecionar Arquivos no Computador</span>
              </button>
            </div>

            {/* Fichario Digital File Grid / Table */}
            {ficharioAnexos.length === 0 ? (
              <div className="p-6 text-center text-sm font-medium text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                Nenhum documento anexado ao fichário digital até o momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ficharioAnexos.map((anexo) => {
                  const isPdf = anexo.tipoArquivo === 'pdf';
                  const isImg = ['png', 'jpg', 'jpeg', 'webp'].includes(anexo.tipoArquivo);

                  return (
                    <div
                      key={anexo.id}
                      className="p-4 bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-300 rounded-xl space-y-3 transition shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className={`p-2.5 rounded-xl shrink-0 ${isPdf ? 'bg-rose-100 text-rose-700' : isImg ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isPdf ? <FileText className="w-5 h-5" /> : isImg ? <ImageIcon className="w-5 h-5" /> : <File className="w-5 h-5" />}
                          </div>
                          <div className="overflow-hidden">
                            <span className="text-sm font-black text-slate-900 truncate block" title={anexo.nomeArquivo}>
                              {anexo.nomeArquivo}
                            </span>
                            <span className="text-xs font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md inline-block mt-0.5">
                              {anexo.categoriaDoc}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveAnexo(anexo.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Remover anexo do fichário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {anexo.observacao && (
                        <p className="text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                          {anexo.observacao}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs text-slate-500 font-semibold">
                        <span>{anexo.tamanhoFormatado}</span>
                        <span>{anexo.dataUpload}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openAttachmentInNewTab(anexo.dataUrl, anexo.nomeArquivo)}
                          className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Visualizar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SUBMIT BUTTONS */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition"
              >
                Cancelar Edição
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black flex items-center gap-2 transition shadow-lg shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{editingId ? 'Salvar Alterações do Funcionário' : 'Salvar Cadastro de Funcionário'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ==============================================================
          VIEW 2: CONSULTAR E GERENCIAR FUNCIONÁRIOS + FICHÁRIO COMPLETO
         ============================================================== */}
      {activeView === 'LIST' && (
        <div className="space-y-6">
          {/* SUMMARY METRICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-500 block uppercase">Total Colaboradores</span>
                <span className="text-xl font-black text-slate-900">{totalEmployees}</span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-500 block uppercase">Folha Salarial Base</span>
                <span className="text-xl font-black text-emerald-700">
                  R$ {totalPayroll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Percent className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-500 block uppercase">Comissionados</span>
                <span className="text-xl font-black text-amber-700">{totalCommissioned} ativo(s)</span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-500 block uppercase">Arquivos no Fichário</span>
                <span className="text-xl font-black text-indigo-700">{totalFiles} documento(s)</span>
              </div>
            </div>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
            {/* Top row: Search input + View Switcher Action Buttons */}
            <div className="flex items-center gap-2 w-full">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar por nome, CPF, código (TSF00001, CEO01, SUP001) ou cargo..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              {/* ACTION BUTTONS (CADASTRAR NOVO FUNCIONÁRIO & CONSULTAR FICHÁRIO) */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveView('FORM');
                  }}
                  className="p-2.5 sm:px-3.5 sm:py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  title="Cadastrar Novo Funcionário"
                  aria-label="Cadastrar Novo Funcionário"
                >
                  <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="hidden md:inline font-bold">Novo Funcionário</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveView('LIST');
                    fetchEmployees();
                  }}
                  className="p-2.5 sm:p-2 bg-blue-50 hover:bg-blue-100/80 active:scale-95 text-blue-700 border border-blue-200 rounded-xl transition cursor-pointer flex items-center justify-center"
                  title={`Consultar & Fichário (${totalEmployees})`}
                  aria-label={`Consultar & Fichário (${totalEmployees})`}
                >
                  <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Bottom row: Filters wrapped responsively */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 w-full cursor-pointer"
              >
                <option value="ALL">Todos os Status</option>
                <option value="ACTIVE">🟢 Ativos</option>
                <option value="AFASTADO">🟡 Afastados</option>
                <option value="INACTIVE">🔴 Desligados</option>
              </select>

              <select
                value={filterCargo}
                onChange={(e) => setFilterCargo(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 w-full cursor-pointer"
                title="Filtrar por cargo específico"
              >
                <option value="ALL">Todos os Cargos</option>
                {CARGOS_PADRAO.filter((c) => {
                  if (c === 'Outro' || c === 'LOGISTICA') return false;
                  if (c === 'CEO' || c === 'Gerente Geral') {
                    return hasGrtAndCeoAccess;
                  }
                  return true;
                }).map((c) => (
                  <option key={c} value={c}>
                    💼 {c}
                  </option>
                ))}
              </select>

              <select
                value={filterSetor}
                onChange={(e) => setFilterSetor(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 w-full cursor-pointer"
              >
                <option value="ALL">Todos os Setores</option>
                {SECTORES_PADRAO.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={filterFilial}
                onChange={(e) => setFilterFilial(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 w-full cursor-pointer"
              >
                <option value="ALL">Todas as Filiais</option>
                {filiaisList.map((f) => (
                  <option key={f.id} value={f.id}>
                    🏢 {f.codigo} - {f.nome}
                  </option>
                ))}
              </select>

              <select
                value={filterLocalAtuacao}
                onChange={(e) => setFilterLocalAtuacao(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 w-full cursor-pointer"
                title="Filtrar por Lugar de Atuação"
              >
                <option value="ALL">Lugar: Todos</option>
                <option value="Fortaleza">📍 Fortaleza</option>
                <option value="Piauí">📍 Piauí</option>
                <option value="Shopee">🛍️ Shopee</option>
              </select>
            </div>
          </div>

          {/* TABLE OF EMPLOYEES */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-700 font-black uppercase text-xs tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Código</th>
                    <th className="p-3.5">Colaborador</th>
                    <th className="p-3.5">Cargo / Setor</th>
                    <th className="p-3.5">Filial</th>
                    <th className="p-3.5">Contato</th>
                    <th className="p-3.5">Salário Base</th>
                    <th className="p-3.5">Comissão (%)</th>
                    <th className="p-3.5">Fichário</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                        Nenhum funcionário encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-black text-blue-600">{emp.codigo}</td>

                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center border border-slate-300">
                              {emp.fotoUrl ? (
                                <img src={emp.fotoUrl} alt={emp.nome} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-5 h-5 text-slate-500" />
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">
                                {emp.nome} {emp.sobrenome}
                              </span>
                              <span className="text-xs text-slate-500 font-mono">CPF: {emp.cpf}</span>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span className="font-bold text-slate-800 block">{emp.cargo}</span>
                          <span className="text-xs text-slate-500">{emp.setor}</span>
                          {emp.temLogin && emp.loginUsuario && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded text-[11px] font-extrabold">
                              <Shield className="w-3 h-3 text-cyan-600" />
                              <span>{emp.loginUsuario}</span>
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-slate-700">
                            <Building2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>{emp.filialNome || 'MATRIZ'}</span>
                          </span>
                          <span className="block mt-1 text-[11px] font-bold text-slate-600">
                            Atuação: <strong className={emp.localAtuacao === 'Shopee' ? 'text-amber-600' : 'text-blue-700'}>
                              {emp.localAtuacao ? (emp.localAtuacao === 'Shopee' ? '🛍️ Shopee' : `📍 ${emp.localAtuacao}`) : (emp.filialNome?.toLowerCase().includes('piauí') || emp.filialNome?.toLowerCase().includes('piaui') ? '📍 Piauí' : '📍 Fortaleza')}
                            </strong>
                          </span>
                        </td>

                        <td className="p-3.5 text-xs">
                          <div className="font-bold text-slate-800">{emp.telefone}</div>
                          <div className="text-slate-500 truncate max-w-[150px]">{emp.email}</div>
                        </td>

                        <td className="p-3.5 font-black text-emerald-700">
                          R$ {(emp.salarioBase || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="p-3.5 font-bold text-blue-700">
                          {emp.comissaoPorcentagem ? `${emp.comissaoPorcentagem}%` : '0%'}
                        </td>

                        <td className="p-3.5">
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg text-xs flex items-center gap-1.5 w-fit">
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>{emp.ficharioAnexos?.length || 0} doc(s)</span>
                          </span>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                              emp.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : emp.status === 'AFASTADO'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {emp.status === 'ACTIVE' ? 'Ativo' : emp.status === 'AFASTADO' ? 'Afastado' : 'Desligado'}
                          </span>
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Ver Ficha e Fichário */}
                            <button
                              type="button"
                              onClick={() => {
                                if (!hasGrtAndCeoAccess && isGrtOrCeoCargo(emp.cargo, emp.codigo)) {
                                  setFeedback({
                                    type: 'error',
                                    message: 'Acesso Restrito: Apenas o Administrador Master e o Developer têm permissão para acessar este perfil.',
                                  });
                                  return;
                                }
                                setSelectedProfile(emp);
                              }}
                              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Visualizar Ficha Completa & Fichário Digital"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Editar */}
                            <button
                              type="button"
                              onClick={() => loadEmployeeToForm(emp)}
                              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Editar Cadastro"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Excluir */}
                            <button
                              type="button"
                              onClick={() => handleInitiateDeleteEmployee(emp)}
                              className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Excluir Funcionário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          PROFILE & FICHÁRIO DETAIL MODAL
         ============================================================== */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border-2 border-blue-600 flex items-center justify-center">
                  {selectedProfile.fotoUrl ? (
                    <img src={selectedProfile.fotoUrl} alt={selectedProfile.nome} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {selectedProfile.nome} {selectedProfile.sobrenome}
                  </h2>
                  <p className="text-sm font-bold text-slate-500">
                    {selectedProfile.cargo} • Setor: {selectedProfile.setor} • Filial: {selectedProfile.filialNome || 'MATRIZ'} • Código: {selectedProfile.codigo}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Profile Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Box 1: Informações Pessoais & Contato */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
                <h3 className="font-black text-slate-900 border-b pb-2 uppercase tracking-wide flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>Dados Pessoais & Contato</span>
                </h3>
                <div>
                  <strong className="text-slate-600 block">CPF:</strong> {selectedProfile.cpf}
                </div>
                {selectedProfile.rg && (
                  <div>
                    <strong className="text-slate-600 block">RG:</strong> {selectedProfile.rg}
                  </div>
                )}
                <div>
                  <strong className="text-slate-600 block">Telefone:</strong> {selectedProfile.telefone}
                </div>
                <div>
                  <strong className="text-slate-600 block">E-mail:</strong> {selectedProfile.email}
                </div>
                {selectedProfile.temLogin && selectedProfile.loginUsuario && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg font-mono text-xs">
                    <span className="font-bold text-blue-900 block">Acesso ERP & Chat Interno:</span>
                    <span className="text-blue-700 font-black">{selectedProfile.loginUsuario}</span>
                    <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                      Ativo no Chat
                    </span>
                  </div>
                )}
                {selectedProfile.dataAdmissao && (
                  <div>
                    <strong className="text-slate-600 block">Data Admissão:</strong> {selectedProfile.dataAdmissao}
                  </div>
                )}
                {selectedProfile.endereco && (
                  <div className="pt-2 border-t text-xs">
                    <strong className="text-slate-700 block mb-0.5">Endereço Residencial:</strong>
                    {selectedProfile.endereco.logradouro}, {selectedProfile.endereco.numero}{' '}
                    {selectedProfile.endereco.complemento ? `- ${selectedProfile.endereco.complemento}` : ''} -{' '}
                    {selectedProfile.endereco.bairro}, {selectedProfile.endereco.cidade}/
                    {selectedProfile.endereco.estado} - CEP: {selectedProfile.endereco.cep}
                  </div>
                )}
              </div>

              {/* Box 2: Remuneração & Dados Bancários */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-2 text-sm">
                <h3 className="font-black text-emerald-950 border-b border-emerald-200 pb-2 uppercase tracking-wide flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Remuneração & Finanças</span>
                </h3>
                <div>
                  <strong className="text-slate-600 block">Salário Base:</strong>
                  <span className="text-lg font-black text-emerald-700">
                    R$ {(selectedProfile.salarioBase || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>{' '}
                  ({selectedProfile.tipoSalario || 'Mensalista'})
                </div>
                <div>
                  <strong className="text-slate-600 block">Comissão:</strong>
                  <span className="font-bold text-blue-700">
                    {selectedProfile.comissaoPorcentagem || 0}% ({selectedProfile.tipoComissao || 'Sobre Vendas'})
                  </span>
                </div>
                {(selectedProfile.metaIndividual !== undefined && selectedProfile.metaIndividual > 0 || isCommercialOrReceptionRole(selectedProfile.cargo)) && (
                  <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                    <strong className="text-purple-900 block text-xs font-black uppercase flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-purple-600" />
                      <span>Meta Individual Mensal:</span>
                    </strong>
                    <span className="text-base font-black text-purple-800">
                      R$ {(selectedProfile.metaIndividual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {selectedProfile.chavePix && (
                  <div>
                    <strong className="text-slate-600 block">Chave PIX:</strong> {selectedProfile.chavePix}
                  </div>
                )}
                {selectedProfile.bancoInfo && (
                  <div>
                    <strong className="text-slate-600 block">Banco:</strong> {selectedProfile.bancoInfo}
                  </div>
                )}
                {selectedProfile.beneficios && (
                  <div>
                    <strong className="text-slate-600 block">Benefícios:</strong> {selectedProfile.beneficios}
                  </div>
                )}
              </div>
            </div>

            {/* Box 3: Fichário Digital Documents List */}
            <div className="space-y-4 pt-2">
              <h3 className="font-black text-slate-900 border-b pb-2 uppercase tracking-wide flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-indigo-600" />
                  <span>Fichário Digital de Documentos</span>
                </div>
                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold">
                  {selectedProfile.ficharioAnexos?.length || 0} arquivo(s)
                </span>
              </h3>

              {!selectedProfile.ficharioAnexos || selectedProfile.ficharioAnexos.length === 0 ? (
                <div className="p-8 text-center text-sm font-medium text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  Nenhum documento cadastrado no fichário deste colaborador.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedProfile.ficharioAnexos.map((anexo) => (
                    <div
                      key={anexo.id}
                      className="p-3.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-sm transition"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-sm font-bold text-slate-900 block truncate" title={anexo.nomeArquivo}>
                            {anexo.nomeArquivo}
                          </span>
                          <span className="text-xs text-indigo-600 font-semibold">{anexo.categoriaDoc} • {anexo.tamanhoFormatado}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openAttachmentInNewTab(anexo.dataUrl, anexo.nomeArquivo)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-sm shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const empToDelete = selectedProfile;
                  setSelectedProfile(null);
                  handleInitiateDeleteEmployee(empToDelete);
                }}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-sm flex items-center gap-2 transition border border-rose-200 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Excluir Funcionário</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const empToEdit = selectedProfile;
                    setSelectedProfile(null);
                    loadEmployeeToForm(empToEdit);
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm flex items-center gap-2 transition shadow-md cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Editar Este Cadastro</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedProfile(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  Fechar Ficha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          DELETE EMPLOYEE CONFIRMATION MODAL WITH PASSWORD AUTH
         ============================================================== */}
      {employeeToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 max-w-md w-full space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Confirmar Exclusão de Funcionário
                </h3>
                <p className="text-[11px] text-rose-700 font-bold">
                  Ação permanente e irreversível
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmployeeToDelete(null);
                  setDeletePassword('');
                  setDeleteError(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Employee Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-500">Colaborador</span>
                <strong className="text-xs font-black text-slate-900">
                  {employeeToDelete.nome} {employeeToDelete.sobrenome}
                </strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">Código / Cargo:</span>
                <span className="font-bold text-slate-800 font-mono">
                  [{employeeToDelete.codigo}] {employeeToDelete.cargo}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">Setor / Filial:</span>
                <span className="text-slate-700 font-medium">
                  {employeeToDelete.setor} • {employeeToDelete.filialNome || 'MATRIZ'}
                </span>
              </div>
              {employeeToDelete.cpf && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">CPF:</span>
                  <span className="font-mono text-slate-700">{employeeToDelete.cpf}</span>
                </div>
              )}
            </div>

            {/* Advisory Note - Hierarquia de Poder */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-amber-950 text-xs">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="font-semibold text-[11px] leading-relaxed">
                  Toda exclusão exige a confirmação de senha de um <strong>Superior Autorizado</strong> (Developer, CEO, Gerente Geral ou Supervisor), mantendo a <strong>Hierarquia de Poder</strong>.
                </p>
              </div>
              <div className="text-[10px] text-amber-900 bg-amber-100/70 p-2 rounded-xl border border-amber-200/60 space-y-1">
                <p className="font-bold">Regras Hierárquicas:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                  <li>Supervisor <strong>NÃO</strong> pode excluir Gerente.</li>
                  <li>Gerente / Supervisor <strong>NÃO</strong> podem excluir CEO.</li>
                  <li>Developer possui acesso <strong>Total e Irrestrito</strong>.</li>
                </ul>
              </div>
            </div>

            {/* Error Message */}
            {deleteError && (
              <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 text-xs font-extrabold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Password Input */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wide">
                Senha de Superior Autorizado (Obrigatória)
              </label>
              <div className="relative">
                <input
                  type={showDeletePassword ? 'text' : 'password'}
                  autoFocus
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmDeleteEmployee();
                    }
                  }}
                  placeholder="Digite a senha de um Superior (Developer, CEO, Gerente, Supervisor)..."
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-600 focus:outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  title={showDeletePassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEmployeeToDelete(null);
                  setDeletePassword('');
                  setDeleteError(null);
                }}
                disabled={isDeletingEmployee}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteEmployee}
                disabled={isDeletingEmployee}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeletingEmployee ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 text-white" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer Authorization Modal for CEO Role Registration/Update */}
      {showCeoDevAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Autorização do Desenvolvedor
                </h3>
                <p className="text-[11px] text-purple-700 font-bold">
                  Cadastro de CEO exclusivo do Desenvolvedor
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCeoDevAuthModal(false);
                  setCeoDevPassword('');
                  setCeoDevPasswordError('');
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SUMMARY */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-500">Colaborador</span>
                <strong className="text-xs font-black text-slate-900">
                  {nome} {sobrenome}
                </strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">Cargo Selecionado:</span>
                <span className="text-xs font-black text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-md font-mono flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" />
                  {cargo === 'Outro' ? customCargo || 'CEO' : cargo}
                </span>
              </div>
            </div>

            {/* ADVISORY */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl flex items-start gap-2.5 text-purple-950 text-xs">
              <KeyRound className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
              <p className="font-semibold text-[11px] leading-relaxed">
                A função de cadastrar o cargo de <strong>CEO</strong> é exclusiva do <strong>Desenvolvedor</strong>. Para autorizar este cadastro através do seu perfil atual, solicite e informe a senha de permissão do Developer.
              </p>
            </div>

            {/* ERROR DISPLAY */}
            {ceoDevPasswordError && (
              <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 text-xs font-extrabold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{ceoDevPasswordError}</span>
              </div>
            )}

            {/* PASSWORD INPUT */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wide">
                Senha do Desenvolvedor (Obrigatória)
              </label>
              <div className="relative">
                <input
                  type={showCeoDevPassword ? 'text' : 'password'}
                  autoFocus
                  value={ceoDevPassword}
                  onChange={(e) => setCeoDevPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmCeoDevAuth();
                    }
                  }}
                  placeholder="Digite a senha de permissão do Developer..."
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowCeoDevPassword(!showCeoDevPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  title={showCeoDevPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showCeoDevPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCeoDevAuthModal(false);
                  setCeoDevPassword('');
                  setCeoDevPasswordError('');
                }}
                disabled={isVerifyingCeoAuth}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCeoDevAuth}
                disabled={isVerifyingCeoAuth}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isVerifyingCeoAuth ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>Autorizar & Salvar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Floating Action Button (FAB) for Cadastrar Novo Funcionário */}
      <div className="fixed bottom-6 right-6 z-40 sm:hidden">
        <button
          type="button"
          onClick={() => {
            resetForm();
            setActiveView('FORM');
          }}
          className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 border-2 border-white transition cursor-pointer"
          title="Cadastrar Novo Funcionário"
          aria-label="Cadastrar Novo Funcionário"
        >
          <UserPlus className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );
};
