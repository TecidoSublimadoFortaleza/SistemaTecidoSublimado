import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  ArrowRight,
  ArrowLeft,
  Users,
  Building2,
  User,
  RefreshCw,
  SlidersHorizontal,
  Table,
  Check,
  Info,
  ChevronDown,
} from 'lucide-react';
import { ApiService } from '../../services/api';
import { Client } from '../../server/types/client';
import { cleanClientFullName } from '../../utils/clientSearch';
import { getLoggedUserAndPerfil, isDeveloperOrAdminMaster } from '../../utils/userPermissions';

export interface ClientImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedCount: number) => void;
  existingClients?: Client[];
}

interface ColumnMapping {
  nome: string;
  sobrenome: string;
  razaoSocial: string;
  nomeFantasia: string;
  tipo: string;
  documento: string; // CPF ou CNPJ
  telefone: string;
  celular: string;
  whatsapp: string;
  email: string;
  dataNascimento: string;
  inscricaoEstadual: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

const DEFAULT_MAPPING: ColumnMapping = {
  nome: '',
  sobrenome: '',
  razaoSocial: '',
  nomeFantasia: '',
  tipo: '',
  documento: '',
  telefone: '',
  celular: '',
  whatsapp: '',
  email: '',
  dataNascimento: '',
  inscricaoEstadual: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
};

interface ColumnOption {
  key: string;
  colIndex: number;
  colLetter: string;
  headerText: string;
  sampleVal: string;
  label: string;
}

const NORMALIZE = (str: string) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const HEADER_KEYWORDS = [
  'nome',
  'razao',
  'social',
  'fantasia',
  'cliente',
  'cpf',
  'cnpj',
  'documento',
  'telefone',
  'celular',
  'whatsapp',
  'fone',
  'tel',
  'email',
  'mail',
  'cidade',
  'municipio',
  'uf',
  'estado',
  'endereco',
  'rua',
  'logradouro',
  'bairro',
  'cep',
  'inscricao',
  'codigo',
  'cod',
  'contato',
];

export const ClientImportModal: React.FC<ClientImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingClients = [],
}) => {
  const [step, setStep] = useState<'UPLOAD' | 'MAP' | 'PREVIEW' | 'RESULT'>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // 2D raw data of rows and cells
  const [sheet2D, setSheet2D] = useState<any[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [columnOptions, setColumnOptions] = useState<ColumnOption[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);

  // Import options
  const [updateExistingByDoc, setUpdateExistingByDoc] = useState(true);
  const [updateExistingByName, setUpdateExistingByName] = useState(false);
  const [autoDetectType, setAutoDetectType] = useState(true);

  // Submission & Result States
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    total: number;
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; identifier: string; error: string }>;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Parse sheet into 2D rows and detect the header row
  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      setErrorMessage('Aba não encontrada na planilha.');
      return;
    }

    // Read full sheet as 2D array of rows
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false,
    });

    if (!rows || rows.length === 0) {
      setErrorMessage('A aba selecionada não contém linhas de dados.');
      return;
    }

    setSheet2D(rows);

    // Auto-detect header row index (scanning first 20 rows)
    let bestRowIndex = 0;
    let maxScore = -1;

    const rowsToCheck = Math.min(rows.length, 25);
    for (let r = 0; r < rowsToCheck; r++) {
      const row = rows[r] || [];
      let keywordHits = 0;
      let textCellsCount = 0;

      for (const cell of row) {
        const strVal = String(cell || '').trim();
        if (!strVal) continue;
        textCellsCount++;
        const clean = NORMALIZE(strVal);
        if (clean.length >= 2 && HEADER_KEYWORDS.some((kw) => clean === kw || clean.includes(kw))) {
          keywordHits++;
        }
      }

      const score = keywordHits * 15 + textCellsCount;
      if (score > maxScore && (keywordHits >= 1 || (r === 0 && textCellsCount >= 3))) {
        maxScore = score;
        bestRowIndex = r;
      }
    }

    setHeaderRowIndex(bestRowIndex);
    buildColumnOptions(rows, bestRowIndex);
    setStep('MAP');
  };

  // Build Column Options from 2D data & selected Header Row
  const buildColumnOptions = (rows: any[][], hRowIdx: number) => {
    if (!rows || rows.length === 0) return;
    const headerRow = rows[hRowIdx] || [];

    // Calculate max columns across header and first 30 data rows
    let maxCols = headerRow.length;
    const sampleLimit = Math.min(rows.length, hRowIdx + 30);
    for (let r = hRowIdx + 1; r < sampleLimit; r++) {
      if (rows[r] && rows[r].length > maxCols) {
        maxCols = rows[r].length;
      }
    }

    const options: ColumnOption[] = [];

    for (let c = 0; c < maxCols; c++) {
      const colLetter = XLSX.utils.encode_col(c);
      const rawHead = String(headerRow[c] || '').trim();
      const isAutoEmpty = !rawHead || rawHead.toLowerCase().startsWith('__empty') || rawHead.toLowerCase().startsWith('_empty');

      // Find first non-empty sample value in that column
      let sampleVal = '';
      for (let r = hRowIdx + 1; r < sampleLimit; r++) {
        const val = String(rows[r]?.[c] || '').trim();
        if (val) {
          sampleVal = val;
          break;
        }
      }

      let displayLabel = '';
      if (!isAutoEmpty) {
        const sampleDisplay = sampleVal ? ` (Ex: "${sampleVal.length > 18 ? sampleVal.slice(0, 18) + '...' : sampleVal}")` : '';
        displayLabel = `Col ${colLetter}: ${rawHead}${sampleDisplay}`;
      } else {
        const sampleDisplay = sampleVal ? ` (Ex: "${sampleVal.length > 22 ? sampleVal.slice(0, 22) + '...' : sampleVal}")` : ' (Vazia)';
        displayLabel = `Coluna ${colLetter}${sampleDisplay}`;
      }

      options.push({
        key: `col_${c}`,
        colIndex: c,
        colLetter,
        headerText: isAutoEmpty ? '' : rawHead,
        sampleVal,
        label: displayLabel,
      });
    }

    setColumnOptions(options);
    autoMapFields(options);
  };

  // Smart matching for fields
  const autoMapFields = (options: ColumnOption[]) => {
    const matchField = (patterns: string[]): string => {
      // 1. Exact match on clean header
      for (const pat of patterns) {
        const cleanPat = NORMALIZE(pat);
        const exact = options.find((opt) => {
          if (!opt.headerText) return false;
          return NORMALIZE(opt.headerText) === cleanPat;
        });
        if (exact) return exact.key;
      }

      // 2. Substring match on clean header (min length 3)
      for (const pat of patterns) {
        const cleanPat = NORMALIZE(pat);
        if (cleanPat.length < 3) continue;
        const sub = options.find((opt) => {
          if (!opt.headerText) return false;
          const cleanH = NORMALIZE(opt.headerText);
          return cleanH.includes(cleanPat) || (cleanH.length >= 3 && cleanPat.includes(cleanH));
        });
        if (sub) return sub.key;
      }

      return '';
    };

    const newMap: ColumnMapping = {
      nome: matchField([
        'nome',
        'cliente',
        'nomedocliente',
        'contato',
        'nomecompleto',
        'nomcli',
        'razaosocial',
      ]),
      sobrenome: matchField(['sobrenome', 'ultimonome', 'segundonome']),
      razaoSocial: matchField(['razaosocial', 'razao', 'nomeempresarial', 'razsoc']),
      nomeFantasia: matchField(['nomeempresa', 'nomefantasia', 'fantasia', 'apelido', 'nomfan']),
      tipo: matchField(['tipocliente', 'tipo', 'tipopessoa', 'pessoafisicajuridica', 'pfouj', 'pjpf']),
      documento: matchField([
        'cpfcnpj',
        'cpf',
        'cnpj',
        'documento',
        'doc',
        'cgc',
        'cgccpf',
        'numdoc',
      ]),
      telefone: matchField([
        'fone',
        'telefone',
        'tel',
        'contatofone',
        'tel1',
        'fone1',
      ]),
      celular: matchField([
        'celular',
        'mobile',
        'cel',
        'telcel',
      ]),
      whatsapp: matchField([
        'whatsapp',
        'zap',
        'whats',
      ]),
      email: matchField(['email', 'mail', 'correioeletronico', 'e-mail']),
      dataNascimento: matchField([
        'nascimento',
        'datanascimento',
        'datadenascimento',
        'aniversario',
        'datadeaniversario',
        'dtnasc',
        'dtnascimento',
        'aniv',
        'birthdate',
        'birthday',
      ]),
      inscricaoEstadual: matchField(['rgie', 'ie', 'inscricaoestadual', 'inscestadual', 'inscriest', 'rg']),
      cep: matchField(['cep', 'codigopostal', 'zipcode']),
      logradouro: matchField(['endereco', 'logradouro', 'rua', 'avenida', 'end', 'lougradouro']),
      numero: matchField(['numero', 'num', 'nro', 'numend']),
      complemento: matchField(['complemento', 'compl']),
      bairro: matchField(['bairro', 'distrito', 'bai']),
      cidade: matchField(['cidade', 'municipio', 'localidade', 'cid']),
      estado: matchField(['uf', 'estado', 'est']),
    };

    // Heuristic fallbacks if header had no title but sample data matches standard patterns
    if (!newMap.documento) {
      const docMatch = options.find((opt) => {
        const digits = (opt.sampleVal || '').replace(/\D/g, '');
        return digits.length === 11 || digits.length === 14;
      });
      if (docMatch) newMap.documento = docMatch.key;
    }

    if (!newMap.email) {
      const emailMatch = options.find((opt) => (opt.sampleVal || '').includes('@'));
      if (emailMatch) newMap.email = emailMatch.key;
    }

    if (!newMap.telefone && !newMap.celular && !newMap.whatsapp) {
      const telMatch = options.find((opt) => {
        const digits = (opt.sampleVal || '').replace(/\D/g, '');
        return digits.length >= 10 && digits.length <= 13;
      });
      if (telMatch && telMatch.key !== newMap.documento) newMap.telefone = telMatch.key;
    }

    setColumnMapping(newMap);
  };

  // Process selected file
  const handleFile = (selectedFile: File) => {
    setErrorMessage(null);
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = selectedFile.name.toLowerCase();
    const isValid = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValid) {
      setErrorMessage('Formato inválido! Por favor envie um arquivo .xlsx, .xls ou .csv.');
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        // Detect and handle CSV with semicolon or comma
        const workbookParsed = XLSX.read(buffer, {
          type: 'binary',
          cellDates: true,
          raw: false,
        });

        setWorkbook(workbookParsed);
        const sheets = workbookParsed.SheetNames;
        setSheetNames(sheets);

        const firstSheetName = sheets[0];
        setSelectedSheet(firstSheetName);
        loadSheetData(workbookParsed, firstSheetName);
        setIsProcessing(false);
      } catch (err: any) {
        setIsProcessing(false);
        setErrorMessage(
          'Erro ao ler a planilha: ' + (err.message || 'Arquivo corrompido ou formato ilegível.')
        );
      }
    };
    reader.onerror = () => {
      setIsProcessing(false);
      setErrorMessage('Não foi possível ler o arquivo selecionado.');
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleSheetChange = (newSheet: string) => {
    if (!workbook) return;
    setSelectedSheet(newSheet);
    loadSheetData(workbook, newSheet);
  };

  const handleHeaderRowChange = (newRowIndex: number) => {
    setHeaderRowIndex(newRowIndex);
    buildColumnOptions(sheet2D, newRowIndex);
  };

  // Generate Parsed Clients based on current Column Mapping & Data Rows
  const parsedClients = useMemo(() => {
    if (!sheet2D || sheet2D.length <= headerRowIndex + 1) return [];

    const dataRows = sheet2D.slice(headerRowIndex + 1);

    const colIndexMap = new Map<string, number>();
    for (const opt of columnOptions) {
      colIndexMap.set(opt.key, opt.colIndex);
    }

    const getVal = (colKey: string, row: any[]) => {
      if (!colKey) return '';
      const cIdx = colIndexMap.get(colKey);
      if (cIdx === undefined) return '';
      const val = row[cIdx];
      return val !== undefined && val !== null ? String(val).trim() : '';
    };

    return dataRows.map((row, index) => {
      const originalRow = headerRowIndex + index + 2; // Linha real no Excel
      const rawNome = getVal(columnMapping.nome, row);
      const rawSobrenome = getVal(columnMapping.sobrenome, row);
      const rawRazaoSocial = getVal(columnMapping.razaoSocial, row);
      const rawNomeFantasia = getVal(columnMapping.nomeFantasia, row);
      const rawTipo = getVal(columnMapping.tipo, row).toUpperCase();
      const rawDoc = getVal(columnMapping.documento, row).replace(/\D/g, '');
      const rawFone = getVal(columnMapping.telefone, row);
      const rawCel = getVal(columnMapping.celular, row);
      const rawZap = getVal(columnMapping.whatsapp, row);

      // Best phone resolution: prioritize mobile/whatsapp or fallback cleanly
      const telefone = rawZap || rawCel || rawFone || '';
      const celular = rawCel || (rawZap && rawZap !== telefone ? rawZap : undefined) || (rawFone && rawFone !== telefone ? rawFone : undefined);

      // Determine type PF or PJ
      let type: 'PF' | 'PJ' = 'PF';
      if (rawTipo.includes('PJ') || rawTipo.includes('JUR') || rawTipo === 'J' || rawTipo.includes('EMPRESA') || rawTipo.includes('REVEND')) {
        type = 'PJ';
      } else if (rawTipo.includes('PF') || rawTipo.includes('FIS') || rawTipo === 'F' || rawTipo.includes('CONSUMIDOR')) {
        type = 'PF';
      } else if (autoDetectType) {
        if (rawDoc.length === 14 || Boolean(rawRazaoSocial && !rawNome)) {
          type = 'PJ';
        } else {
          type = 'PF';
        }
      }

      // Name resolution
      let nome = '';
      let razaoSocial = rawRazaoSocial;
      let nomeFantasia = rawNomeFantasia;

      if (type === 'PF') {
        nome = cleanClientFullName(rawNome, rawSobrenome);
      } else {
        if (!razaoSocial) razaoSocial = nomeFantasia || rawNome;
        if (!nomeFantasia) nomeFantasia = razaoSocial;
      }

      // Check existence against existing clients
      let isExisting = false;
      if (rawDoc) {
        isExisting = existingClients.some(
          (c) =>
            (c.cpf && c.cpf.replace(/\D/g, '') === rawDoc) ||
            (c.cnpj && c.cnpj.replace(/\D/g, '') === rawDoc)
        );
      }

      const displayName = type === 'PF' ? (nome || `Cliente Linha ${originalRow}`) : (nomeFantasia || razaoSocial || `Cliente Linha ${originalRow}`);
      const isValid = Boolean((type === 'PF' ? nome : (razaoSocial || nomeFantasia)) || rawDoc);

      return {
        originalRow,
        type,
        nome: type === 'PF' ? nome : undefined,
        sobrenome: undefined,
        razaoSocial: type === 'PJ' ? razaoSocial : undefined,
        nomeFantasia: type === 'PJ' ? nomeFantasia : undefined,
        cpf: type === 'PF' && rawDoc ? rawDoc : undefined,
        cnpj: type === 'PJ' && rawDoc ? rawDoc : undefined,
        telefone,
        celular,
        email: getVal(columnMapping.email, row),
        dataNascimento: getVal(columnMapping.dataNascimento, row) || undefined,
        inscricaoEstadual: getVal(columnMapping.inscricaoEstadual, row) || 'ISENTO',
        endereco: {
          cep: getVal(columnMapping.cep, row),
          logradouro: getVal(columnMapping.logradouro, row),
          numero: getVal(columnMapping.numero, row),
          complemento: getVal(columnMapping.complemento, row),
          bairro: getVal(columnMapping.bairro, row),
          cidade: getVal(columnMapping.cidade, row),
          estado: getVal(columnMapping.estado, row),
        },
        displayName: displayName || `Cliente Linha ${originalRow}`,
        documentoLimpo: rawDoc,
        isExisting,
        isValid,
      };
    });
  }, [sheet2D, headerRowIndex, columnMapping, columnOptions, autoDetectType, existingClients]);

  // Execute bulk import to backend API
  const handleExecuteImport = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setImportProgress(10);

    try {
      setImportProgress(25);
      const payloadClients = parsedClients.filter((c) => c.isValid);

      if (payloadClients.length === 0) {
        throw new Error('Nenhum registro válido encontrado com o mapeamento atual de colunas.');
      }

      setImportProgress(50);
      const response = await ApiService.bulkImportClients({
        clients: payloadClients,
        options: {
          updateExistingByDoc,
          updateExistingByName,
        },
      });

      setImportProgress(100);
      setImportResult(response.data);
      setStep('RESULT');
      onSuccess(response.data.imported + response.data.updated);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao importar clientes. Verifique os dados da planilha.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Example Spreadsheet Template
  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    const sampleData = [
      {
        Tipo: 'PF',
        'Nome Completo': 'Carlos Eduardo Silva',
        'CPF/CNPJ': '012.345.678-90',
        'Telefone/WhatsApp': '(85) 99876-5432',
        'E-mail': 'carlos.silva@exemplo.com.br',
        CEP: '60170-001',
        Rua: 'Av. Santos Dumont',
        Numero: '2500',
        Complemento: 'Sala 402',
        Bairro: 'Aldeota',
        Cidade: 'Fortaleza',
        UF: 'CE',
      },
      {
        Tipo: 'PJ',
        'Razao Social': 'ESTAMPARIA E SUBLIMACAO BRASIL LTDA',
        'Nome Fantasia': 'SUBLI BRASIL',
        'CPF/CNPJ': '12.345.678/0001-99',
        'Inscricao Estadual': '061234567',
        'Telefone/WhatsApp': '(85) 3214-5500',
        'E-mail': 'financeiro@sublibrasil.com.br',
        CEP: '60810-000',
        Rua: 'Rua Desembargador Gonzaga',
        Numero: '1120',
        Complemento: 'Galpão A',
        Bairro: 'Cidade dos Funcionários',
        Cidade: 'Fortaleza',
        UF: 'CE',
      },
      {
        Tipo: 'PF',
        'Nome Completo': 'Mariana Albuquerque Lima',
        'CPF/CNPJ': '987.654.321-11',
        'Telefone/WhatsApp': '(85) 98711-2233',
        'E-mail': 'mariana.albuquerque@gmail.com',
        CEP: '60160-230',
        Rua: 'Rua Silva Jatahy',
        Numero: '88',
        Complemento: 'Apt 1201',
        Bairro: 'Meireles',
        Cidade: 'Fortaleza',
        UF: 'CE',
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo Clientes');

    if (format === 'csv') {
      XLSX.writeFile(wb, 'Modelo_Importacao_Clientes_SubliGestao.csv', { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, 'Modelo_Importacao_Clientes_SubliGestao.xlsx', { bookType: 'xlsx' });
    }
  };

  // Helper renderer for each column mapping selector
  const renderColumnSelector = (
    fieldKey: keyof ColumnMapping,
    label: string,
    badge?: string,
    badgeColor?: string,
    isEssential?: boolean
  ) => {
    return (
      <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition shadow-2xs">
        <label className="block text-xs font-black text-slate-800 mb-1.5 flex items-center justify-between">
          <span className="truncate">
            {label} {isEssential && <span className="text-rose-500">*</span>}
          </span>
          {badge && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                badgeColor || 'text-slate-600 bg-slate-200/70'
              }`}
            >
              {badge}
            </span>
          )}
        </label>
        <select
          value={columnMapping[fieldKey]}
          onChange={(e) => setColumnMapping({ ...columnMapping, [fieldKey]: e.target.value })}
          className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs truncate cursor-pointer ${
            columnMapping[fieldKey]
              ? 'border-blue-500 text-blue-900 bg-blue-50/30'
              : 'border-slate-300 text-slate-500'
          }`}
        >
          <option value="">(Não mapear)</option>
          {columnOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const { role: loggedRole, isDeveloper: isLoggedDev, username: loggedUsername } = getLoggedUserAndPerfil();
  const isAuthorized = isDeveloperOrAdminMaster(loggedRole, isLoggedDev, loggedUsername);

  if (!isOpen || !isAuthorized) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-scaleUp">
        {/* MODAL HEADER */}
        <div className="bg-[#2563EB] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl shadow-xs">
              <FileSpreadsheet className="w-6 h-6 text-cyan-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Importar Planilha de Clientes
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                Importação em lote de clientes legados ou listas em Excel (.xlsx, .xls) e CSV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white/90 hover:text-white transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP PROGRESS BAR */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                step === 'UPLOAD'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {step !== 'UPLOAD' ? <Check className="w-3.5 h-3.5" /> : '1'}
            </span>
            <span className={step === 'UPLOAD' ? 'text-blue-700 font-black' : ''}>1. Envio do Arquivo</span>
          </div>

          <div className="h-0.5 w-6 sm:w-12 bg-slate-200" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                step === 'MAP'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : step === 'PREVIEW' || step === 'RESULT'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {step === 'PREVIEW' || step === 'RESULT' ? <Check className="w-3.5 h-3.5" /> : '2'}
            </span>
            <span className={step === 'MAP' ? 'text-blue-700 font-black' : ''}>2. Mapeamento de Colunas</span>
          </div>

          <div className="h-0.5 w-6 sm:w-12 bg-slate-200" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                step === 'PREVIEW'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : step === 'RESULT'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {step === 'RESULT' ? <Check className="w-3.5 h-3.5" /> : '3'}
            </span>
            <span className={step === 'PREVIEW' || step === 'RESULT' ? 'text-blue-700 font-black' : ''}>
              3. Pré-Visualização & Importar
            </span>
          </div>
        </div>

        {/* ERROR NOTIFICATION */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: UPLOAD FILE */}
          {step === 'UPLOAD' && (
            <div className="space-y-6">
              {/* DRAG & DROP ZONE */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) handleFile(droppedFile);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) handleFile(selected);
                  }}
                  className="hidden"
                />
                <div className="p-4 bg-blue-100 text-blue-700 rounded-2xl mb-3 shadow-inner">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-base font-black text-slate-800 mb-1">
                  Clique para selecionar sua planilha ou arraste o arquivo aqui
                </h3>
                <p className="text-xs text-slate-500 max-w-md mb-4">
                  Suporta arquivos do Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) e planilhas de texto (<strong>.csv</strong>).
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg">
                    .xlsx (Excel Moderno)
                  </span>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg">
                    .xls (Excel 97-2003)
                  </span>
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg">
                    .csv (Valores Separados)
                  </span>
                </div>
              </div>

              {/* DOWNLOAD SAMPLE TEMPLATES */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl mt-0.5">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wide text-slate-700">
                      Precisa de uma planilha modelo para testar?
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Baixe um modelo com colunas organizadas prontas para preenchimento de clientes PF e PJ.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('xlsx')}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Modelo .xlsx</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('csv')}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-blue-600" />
                    <span>Modelo .csv</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 'MAP' && (
            <div className="space-y-6">
              {/* FILE & SHEET / HEADER ROW SELECTOR */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-slate-800">{file?.name}</span>
                      <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                        {sheet2D.length - headerRowIndex - 1} clientes a processar
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Confira ou ajuste a linha dos cabeçalhos e selecione a coluna correspondente a cada campo.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-700 w-full lg:w-auto">
                  {sheetNames.length > 1 && (
                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5">
                      <span className="text-slate-500">Aba:</span>
                      <select
                        value={selectedSheet}
                        onChange={(e) => handleSheetChange(e.target.value)}
                        className="font-bold text-slate-800 focus:outline-none cursor-pointer"
                      >
                        {sheetNames.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Header Row Selector */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-2xs">
                    <span className="text-slate-500 whitespace-nowrap">Linha dos Títulos:</span>
                    <select
                      value={headerRowIndex}
                      onChange={(e) => handleHeaderRowChange(Number(e.target.value))}
                      className="font-black text-blue-700 focus:outline-none cursor-pointer max-w-[200px]"
                      title="Selecione qual linha da planilha contém os nomes das colunas"
                    >
                      {sheet2D.slice(0, 15).map((row, rIdx) => {
                        const previewStr = row
                          .filter((c) => String(c || '').trim().length > 0)
                          .slice(0, 4)
                          .join(' | ');
                        return (
                          <option key={rIdx} value={rIdx}>
                            Linha {rIdx + 1}: {previewStr ? `[${previewStr.slice(0, 30)}...]` : '(Vazia)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* MAPPING FIELDS GRID */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                    <span>Mapeamento de Colunas</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => autoMapFields(columnOptions)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reaplicar Reconhecimento Automático</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {renderColumnSelector('nome', 'Nome Completo / Razão Social', 'Essencial', 'text-rose-700 bg-rose-100', true)}
                  {renderColumnSelector('documento', 'CPF / CNPJ (Documento)', 'Chave Única', 'text-blue-700 bg-blue-100')}
                  {renderColumnSelector('tipo', 'Tipo de Cliente (PF ou PJ)', 'Classificação')}
                  {renderColumnSelector('razaoSocial', 'Razão Social (PJ)', 'Empresa')}
                  {renderColumnSelector('nomeFantasia', 'Nome Empresa / Fantasia', 'PJ')}
                  {renderColumnSelector('telefone', 'Fone / Telefone Fixo', 'Contato')}
                  {renderColumnSelector('celular', 'Celular', 'Contato')}
                  {renderColumnSelector('whatsapp', 'WhatsApp', 'Mensagens')}
                  {renderColumnSelector('email', 'E-mail', 'Contato')}
                  {renderColumnSelector('dataNascimento', 'Data de Nascimento / Aniversário', 'Geral')}
                  {renderColumnSelector('inscricaoEstadual', 'RG / IE (Inscrição Estadual)', 'Fiscal')}
                  {renderColumnSelector('cep', 'CEP', 'Endereço')}
                  {renderColumnSelector('logradouro', 'Endereço / Logradouro', 'Endereço')}
                  {renderColumnSelector('numero', 'Número', 'Endereço')}
                  {renderColumnSelector('complemento', 'Complemento', 'Endereço')}
                  {renderColumnSelector('bairro', 'Bairro', 'Endereço')}
                  {renderColumnSelector('cidade', 'Cidade', 'Endereço')}
                  {renderColumnSelector('estado', 'UF / Estado', 'Endereço')}
                </div>
              </div>

              {/* IMPORT RULES AND OPTIONS */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Regras de Importação
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateExistingByDoc}
                      onChange={(e) => setUpdateExistingByDoc(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-700">
                      Atualizar dados se o cliente já existir (mesmo CPF ou CNPJ)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoDetectType}
                      onChange={(e) => setAutoDetectType(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-700">
                      Detectar PF ou PJ automaticamente pelo tamanho do CPF/CNPJ
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 'PREVIEW' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Table className="w-4 h-4 text-blue-600" />
                    <span>Pré-visualização dos Dados ({parsedClients.length} registros detectados)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Confira como os clientes foram interpretados antes de salvar no sistema.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">
                    {parsedClients.filter((c) => !c.isExisting && c.isValid).length} Novos
                  </span>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg">
                    {parsedClients.filter((c) => c.isExisting).length} Já Cadastrados (Atualizarão)
                  </span>
                </div>
              </div>

              {/* PREVIEW TABLE */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-black sticky top-0 border-b border-slate-200 uppercase text-[10px] tracking-wider z-10">
                      <tr>
                        <th className="py-2.5 px-3">Linha</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Nome / Razão Social</th>
                        <th className="py-2.5 px-3">Documento (CPF/CNPJ)</th>
                        <th className="py-2.5 px-3">Telefone</th>
                        <th className="py-2.5 px-3">E-mail</th>
                        <th className="py-2.5 px-3">Cidade/UF</th>
                        <th className="py-2.5 px-3 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {parsedClients.slice(0, 50).map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition">
                          <td className="py-2 px-3 font-mono text-slate-400 font-bold">{c.originalRow}</td>
                          <td className="py-2 px-3">
                            {c.type === 'PF' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
                                <User className="w-3 h-3" /> PF
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold">
                                <Building2 className="w-3 h-3" /> PJ
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900 max-w-[200px] truncate">
                            {c.displayName || <span className="text-slate-400 italic">Sem nome</span>}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {c.documentoLimpo || <span className="text-slate-400">-</span>}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{c.telefone || '-'}</td>
                          <td className="py-2 px-3 text-slate-600 max-w-[150px] truncate">{c.email || '-'}</td>
                          <td className="py-2 px-3 text-slate-600">
                            {c.endereco.cidade
                              ? `${c.endereco.cidade}${c.endereco.estado ? `/${c.endereco.estado}` : ''}`
                              : '-'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {c.isExisting ? (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-bold">
                                Atualizará
                              </span>
                            ) : c.isValid ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold">
                                Novo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded text-[10px] font-bold">
                                Inválido
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsedClients.length > 50 && (
                  <div className="bg-slate-50 p-2.5 text-center text-xs text-slate-500 font-medium border-t border-slate-200">
                    Mostrando as primeiras 50 de {parsedClients.length} linhas. Todas as linhas válidas serão importadas.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: IMPORT RESULT */}
          {step === 'RESULT' && importResult && (
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Importação Concluída com Sucesso!
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  A relação de clientes foi processada e salva com códigos automáticos no banco de dados.
                </p>
              </div>

              {/* METRICS CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="block text-xl font-black text-slate-800">{importResult.total}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Linhas</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="block text-xl font-black text-emerald-700">{importResult.imported}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Novos Cadastros</span>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="block text-xl font-black text-blue-700">{importResult.updated}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Atualizados</span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="block text-xl font-black text-amber-700">{importResult.skipped}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Ignorados</span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="max-w-xl mx-auto text-left bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs">
                  <span className="font-black text-rose-800 block mb-1">
                    {importResult.errors.length} registro(s) tiveram avisos ou inconsistências:
                  </span>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <div key={i} className="text-rose-700 text-[11px]">
                        Linha {err.row} ({err.identifier}): {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div>
            {step === 'MAP' && (
              <button
                type="button"
                onClick={() => setStep('UPLOAD')}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Trocar Arquivo</span>
              </button>
            )}

            {step === 'PREVIEW' && (
              <button
                type="button"
                onClick={() => setStep('MAP')}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao Mapeamento</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step !== 'RESULT' && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
            )}

            {step === 'MAP' && (
              <button
                type="button"
                onClick={() => {
                  if (!columnMapping.nome && !columnMapping.razaoSocial && !columnMapping.documento) {
                    setErrorMessage('Mapeie pelo menos a coluna de Nome, Razão Social ou Documento para continuar.');
                    return;
                  }
                  setErrorMessage(null);
                  setStep('PREVIEW');
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Avançar para Pré-Visualização</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 'PREVIEW' && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importando Clientes... ({importProgress}%)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar e Importar {parsedClients.filter((c) => c.isValid).length} Clientes</span>
                  </>
                )}
              </button>
            )}

            {step === 'RESULT' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setStep('UPLOAD');
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Importar Outra Planilha
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer"
                >
                  Concluir e Ver Clientes
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
