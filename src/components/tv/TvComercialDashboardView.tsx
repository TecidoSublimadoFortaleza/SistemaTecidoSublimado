import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  Clock,
  Sun,
  Moon,
  PieChart as PieIcon,
  Palette,
  Printer,
  Flame,
  Scissors,
  Box,
  ShoppingBag,
  Truck,
  Package,
  Store,
  Crown,
  Medal,
  Award,
  Edit3,
  Target,
  X,
  Check,
  Building2,
} from 'lucide-react';
import { ApiService } from '../../services/api';
import { OrdemServico } from '../../server/types/os';
import { Employee } from '../../server/types/employee';
import { UserProfile } from '../../types/frontend';

interface TvComercialDashboardViewProps {
  user?: UserProfile | null;
}

interface FunnelSellerItem {
  id: string;
  rank: number;
  name: string;
  shortName: string;
  cargo: string;
  percentual: number;
  total: number;
  osCount: number;
  vndCount: number;
  barColor: string;
  widthPct: number;
  badgeColor: string;
  icon?: React.ComponentType<{ className?: string }>;
}

// Formatação compacta e legível para a meta (ex: 750 MIL, 500 MIL, 1 MILHÃO, 2,05 MI)
export function formatMetaCompact(valor: number): string {
  if (!valor || valor <= 0) return 'DEFINIR META';
  if (valor >= 1000000) {
    const mi = valor / 1000000;
    if (mi % 1 === 0) {
      return mi > 1 ? `${mi} MILHÕES` : `${mi} MILHÃO`;
    }
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }).format(mi);
    return `${formatted} MI`;
  }
  if (valor >= 1000) {
    const mil = valor / 1000;
    if (mil % 1 === 0) {
      return `${mil} MIL`;
    }
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }).format(mil);
    return `${formatted} MIL`;
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(valor);
}

// Carrega a meta oficial definida pela empresa para o mês informado e filial
export function getCompanyGoalForMonth(monthIdx: number, filialFilter: string = 'ALL'): number {
  if (typeof window === 'undefined') return 0;

  // 1. Prioridade: Metas definidas nas configurações de filiais/matriz da empresa para o mês
  const storedMetas = localStorage.getItem('subligestao_metas_filiais');
  let totalFromFiliais = 0;
  let hasFiliaisMeta = false;

  if (storedMetas) {
    try {
      const parsed = JSON.parse(storedMetas);
      if (parsed && typeof parsed === 'object') {
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

        // Obtém a lista de filiais ativas do sistema no escopo geral da função
        let activeBranches: any[] = [];
        try {
          const storedF = localStorage.getItem('subligestao_filiais');
          if (storedF) activeBranches = JSON.parse(storedF);
        } catch (_) {}

        if (!Array.isArray(activeBranches) || activeBranches.length === 0) {
          activeBranches = [
            { id: 'FILIAL-MATRIZ-001', codigo: 'MATRIZ', nome: 'TECIDO SUBLIMADO - Matriz', status: 'ATIVA' },
            { id: 'filial-1790682978484', codigo: 'FL-02', nome: 'EMPORIO DA SUBLIMACAO', status: 'ATIVA' },
          ];
        }

        const activeOnly = activeBranches.filter((f) => f.status !== 'INATIVA' && f.status !== 'INACTIVE');

        if (filialFilter === 'ALL') {
          const seenBranchIds = new Set<string>();
          activeOnly.forEach((filial) => {
            const codeKey = String(filial.codigo || filial.id || '').toUpperCase();
            if (codeKey === 'MATRIZ' && seenBranchIds.has('MATRIZ')) return;
            if (seenBranchIds.has(filial.id)) return;
            seenBranchIds.add(filial.id);
            if (codeKey === 'MATRIZ') seenBranchIds.add('MATRIZ');

            const fMeta =
              parsed[filial.id] ||
              parsed[filial.codigo] ||
              Object.values(parsed).find(
                (m: any) =>
                  m?.filialId === filial.id ||
                  (m?.filialCodigo && m.filialCodigo.toUpperCase() === filial.codigo?.toUpperCase()) ||
                  (m?.filialNome && m.filialNome.toLowerCase() === filial.nome.toLowerCase())
              );
            const val = getMonthlyMetaForFilial(fMeta, monthIdx);
            if (val !== null) {
              totalFromFiliais += val;
              hasFiliaisMeta = true;
            }
          });
          if (hasFiliaisMeta) {
            return totalFromFiliais;
          }
        } else if (filialFilter === 'FORTALEZA' || filialFilter === 'SHOPEE' || filialFilter === 'PIAUI' || filialFilter === 'FORTALEZA_SHOPEE' || filialFilter === 'PIAUI_SHOPEE') {
          const getMetaForLocation = (loc: 'FORTALEZA' | 'PIAUI' | 'SHOPEE'): number => {
            let sum = 0;
            let found = false;

            if (activeOnly && activeOnly.length > 0) {
              const seenBranchIds = new Set<string>();
              activeOnly.forEach((filial: any) => {
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
                  let fMeta = parsed[filial.id];
                  if (!fMeta && filial.codigo) {
                    fMeta = parsed[filial.codigo];
                  }
                  if (!fMeta) {
                    fMeta = Object.values(parsed).find(
                      (m: any) =>
                        m?.filialId === filial.id ||
                        (m?.filialCodigo && m.filialCodigo.toUpperCase() === filial.codigo?.toUpperCase()) ||
                        (m?.filialNome && m.filialNome.toLowerCase() === filial.nome.toLowerCase())
                    );
                  }
                  const val = getMonthlyMetaForFilial(fMeta, monthIdx);
                  if (val !== null) {
                    sum += val;
                    found = true;
                  }
                }
              });
            } else {
              const seenCodigos = new Set<string>();
              Object.values(parsed).forEach((m: any) => {
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
                  const val = getMonthlyMetaForFilial(m, monthIdx);
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

          if (filialFilter === 'FORTALEZA') return getMetaForLocation('FORTALEZA');
          if (filialFilter === 'SHOPEE') return getMetaForLocation('SHOPEE');
          if (filialFilter === 'PIAUI') return getMetaForLocation('PIAUI');
          if (filialFilter === 'FORTALEZA_SHOPEE') return getMetaForLocation('FORTALEZA') + getMetaForLocation('SHOPEE');
          if (filialFilter === 'PIAUI_SHOPEE') return getMetaForLocation('PIAUI') + getMetaForLocation('SHOPEE');
        } else {
          const filialMeta =
            parsed[filialFilter] ||
            Object.values(parsed).find(
              (m: any) =>
                m?.filialId === filialFilter ||
                m?.filialCodigo === filialFilter ||
                (m?.filialNome && m.filialNome.toLowerCase() === filialFilter.toLowerCase())
            );
          if (filialMeta) {
            const val = getMonthlyMetaForFilial(filialMeta, monthIdx);
            if (val !== null && val > 0) {
              return val;
            }
          }
        }
      }
    } catch (e) {
      console.error('Erro ao carregar metas das filiais:', e);
    }
  }

  // 2. Chave direta global de meta da empresa
  const directMeta = localStorage.getItem('subligestao_meta_empresa');
  if (directMeta) {
    const parsed = Number(directMeta);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 750000;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.'];

// 12 cores exatas em degradê da imagem (do azul no topo até o vermelho na base)
const FUNNEL_COLORS = [
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

export const TvComercialDashboardView: React.FC<TvComercialDashboardViewProps> = ({ user }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Estados principais - Padrão é Modo Claro ('light')
  const [osList, setOsList] = useState<OrdemServico[]>([]);
  const [pdvList, setPdvList] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [tvTheme, setTvTheme] = useState<'dark' | 'light'>('light');
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState<number>(15);

  // Mês e ano vigentes
  const currentMonthIdx = currentTime.getMonth();
  const currentMonthName = MONTH_NAMES[currentMonthIdx];
  const currentYear = currentTime.getFullYear();
  const currentYear2Digits = String(currentYear).slice(-2);
  const currentWeekday = WEEKDAY_NAMES[currentTime.getDay()];
  const currentDay = String(currentTime.getDate()).padStart(2, '0');
  const monthAbbr = currentMonthName.substring(0, 3).toUpperCase();

  // Filial Selecionada na TV
  const [filiaisList, setFiliaisList] = useState<any[]>([]);
  const [selectedFilialId, setSelectedFilialId] = useState<string>('ALL');

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
    return () => window.removeEventListener('subligestao_filiais_changed', handleFiliaisUpdated);
  }, []);

  // Meta definida pela Empresa para o mês vigente
  const [metaEmpresa, setMetaEmpresa] = useState<number>(() => {
    return getCompanyGoalForMonth(new Date().getMonth(), 'ALL');
  });
  const [isEditingMetaModalOpen, setIsEditingMetaModalOpen] = useState<boolean>(false);
  const [tempMetaInput, setTempMetaInput] = useState<string>('');

  // Atualiza a meta da empresa dinamicamente com base na filial selecionada
  const reloadCompanyGoal = useCallback(() => {
    const goal = getCompanyGoalForMonth(currentTime.getMonth(), selectedFilialId);
    setMetaEmpresa(goal);
  }, [currentTime, selectedFilialId]);

  useEffect(() => {
    reloadCompanyGoal();

    // Query fresh goals from database on mount
    ApiService.getMetas().then((serverMetas) => {
      if (serverMetas && Object.keys(serverMetas).length > 0) {
        localStorage.setItem('subligestao_metas_filiais', JSON.stringify(serverMetas));
        reloadCompanyGoal();
      }
    }).catch(() => {});

    const handleMetasChanged = () => reloadCompanyGoal();
    window.addEventListener('subligestao_metas_changed', handleMetasChanged);
    window.addEventListener('storage', handleMetasChanged);
    return () => {
      window.removeEventListener('subligestao_metas_changed', handleMetasChanged);
      window.removeEventListener('storage', handleMetasChanged);
    };
  }, [reloadCompanyGoal]);

  // Salva a nova meta definida pela empresa
  const handleSaveCompanyGoal = (newVal: number) => {
    if (isNaN(newVal) || newVal < 0) return;

    // 1. Salva na chave global de meta da empresa
    localStorage.setItem('subligestao_meta_empresa', newVal.toString());

    // 2. Atualiza no mapa de metas de filiais (para o mês corrente)
    try {
      const storedMetas = localStorage.getItem('subligestao_metas_filiais');
      let map = storedMetas ? JSON.parse(storedMetas) : {};
      if (!map || typeof map !== 'object' || Object.keys(map).length === 0) {
        map = {
          'filial-matriz-fortaleza': {
            filialId: 'filial-matriz-fortaleza',
            filialCodigo: 'MATRIZ',
            filialNome: 'TECIDO SUBLIMADO FORTALEZA',
            metaMensalValor: newVal,
            metaDiariaValor: Math.round(newVal / 22),
            metaQtdOs: 0,
            vendaAtualValor: 0,
            metasMensais: MONTH_NAMES.map((mesNome, idx) => ({
              mesIndex: idx,
              mesNome,
              metaValor: idx === currentMonthIdx ? newVal : 0,
              metaQtdOs: 0,
              metaTicketMedio: 0,
              vendaAtualValor: 0,
            })),
          },
        };
        const targetKey = selectedFilialId !== 'ALL'
          ? selectedFilialId
          : (map['FILIAL-MATRIZ-001'] ? 'FILIAL-MATRIZ-001' : (map['filial-1790682978484'] ? 'filial-1790682978484' : Object.keys(map)[0]));

        if (map[targetKey]) {
          map[targetKey].metaMensalValor = newVal;
          if (Array.isArray(map[targetKey].metasMensais)) {
            map[targetKey].metasMensais = map[targetKey].metasMensais.map((m: any) =>
              m.mesIndex === currentMonthIdx ? { ...m, metaValor: newVal } : m
            );
          }
        }
        localStorage.setItem('subligestao_metas_filiais', JSON.stringify(map));
        // Persist directly to database
        ApiService.saveMetas(map).catch((err) => {
          console.error('Erro ao persistir meta da empresa no banco de dados:', err);
        });
      }
    } catch (e) {
      console.error('Erro ao atualizar meta nas filiais:', e);
    }

    setMetaEmpresa(newVal);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('subligestao_metas_changed'));
    }
    setIsEditingMetaModalOpen(false);
  };

  // Texto formatado para exibição da meta (ex: 750 MIL, 500 MIL, DEFINIR META)
  const metaLabelText = useMemo(() => formatMetaCompact(metaEmpresa), [metaEmpresa]);

  // Relógio digital ao vivo
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Busca de dados com tratamento de erro
  const fetchData = async () => {
    try {
      const [fetchedOs, fetchedPdv, fetchedEmp] = await Promise.all([
        ApiService.getOrdensServico().catch(() => []),
        ApiService.getPdvTransactions().catch(() => []),
        ApiService.getEmployees().catch(() => []),
      ]);
      setOsList(fetchedOs || []);
      setPdvList(fetchedPdv || []);
      setEmployees(fetchedEmp || []);
    } catch (err) {
      console.warn('Erro ao sincronizar dados da TV Comercial:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Ouvinte em tempo real para novas vendas ou atualizações no sistema
  useEffect(() => {
    const handleOsChanged = () => {
      fetchData();
    };
    window.addEventListener('os-changed', handleOsChanged);
    return () => window.removeEventListener('os-changed', handleOsChanged);
  }, []);

  // Ciclo regressivo de atualização automática
  useEffect(() => {
    const countdownTimer = setInterval(() => {
      setAutoRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchData();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, []);

  // Manipulador de tela cheia
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch((err) => {
          console.warn('Fullscreen request failed:', err);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Exit fullscreen failed:', err);
        });
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Formata número da OS com 8 dígitos (ex: OS 00000002)
  const formatOsNumber = (rawNum?: string | number) => {
    if (!rawNum) return 'OS 00000000';
    const str = String(rawNum).replace(/\D/g, '');
    if (!str) {
      return String(rawNum).toUpperCase().startsWith('OS') ? String(rawNum).toUpperCase() : `OS ${rawNum}`;
    }
    return `OS ${str.padStart(8, '0')}`;
  };

  // Helper para formatar vendedor truncado (ex: VEND. MARC...)
  const formatVendedorTruncado = (os: OrdemServico): string => {
    const raw = (os as any).vendedorNome || (os as any).vendedor || os.operador || (os as any).operadorNome || '';
    if (!raw) return 'VEND. PADRÃO';
    const clean = String(raw).trim().toUpperCase();
    if (clean.length > 9) {
      return `VEND. ${clean.substring(0, 5)}...`;
    }
    return `VEND. ${clean}`;
  };

  // Helper robusto para parsear datas com segurança
  const parseDateSafe = (val: any): Date => {
    if (!val) return new Date(0);
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date(val);
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  // 1. CÁLCULO REAL DO FATURAMENTO EM OS E VND (MÊS VIGENTE) E AGRUPAMENTO POR VENDEDOR
  const {
    faturamentoPercentual,
    totalFaturadoReal,
    totalVendasOS,
    totalVendasVND,
    sellersWithSales,
  } = useMemo(() => {
    let sumOS = 0;
    let sumVND = 0;
    const sellersMap: Record<
      string,
      { name: string; total: number; osTotal: number; vndTotal: number; osCount: number; vndCount: number }
    > = {};

    // 1.1 Processar Ordens de Serviço (OS) do mês atual
    osList.forEach((os) => {
      // Exclui orçamentos
      if ((os as any).isOrcamento || (os as any).tipoDocumento === 'ORCAMENTO' || os.codigo?.startsWith('ORC')) {
        return;
      }
      const status = (os.status || '').toLowerCase().trim();
      if (status === 'cancelado' || status === 'cancelada' || (os as any).deletedAt) {
        return;
      }

      // Validar data no mês e ano vigentes
      const dt = parseDateSafe(os.createdAt || (os as any).dataCriacao || (os as any).dataVenda || (os as any).data);
      if (dt.getMonth() !== currentMonthIdx || dt.getFullYear() !== currentYear) {
        return;
      }

      // Segmentação por Filial na TV (Todas, Fortaleza, Shopee, Piauí, Fortaleza/Shopee, Piauí/Shopee)
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

      const sellerName = String((os as any).vendedorNome || (os as any).vendedor || (os as any).operador || '').toLowerCase().trim();
      if (sellerName && Array.isArray(employees)) {
        const sellerEmp = employees.find((e) => {
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

      if (selectedFilialId === 'FORTALEZA' && !isFortaleza) return;
      if (selectedFilialId === 'SHOPEE' && !isShopee) return;
      if (selectedFilialId === 'PIAUI' && !isPiaui) return;
      if (selectedFilialId === 'FORTALEZA_SHOPEE' && !isFortaleza && !isShopee) return;
      if (selectedFilialId === 'PIAUI_SHOPEE' && !isPiaui && !isShopee) return;

      if (selectedFilialId !== 'ALL' && selectedFilialId !== 'FORTALEZA' && selectedFilialId !== 'SHOPEE' && selectedFilialId !== 'PIAUI' && selectedFilialId !== 'FORTALEZA_SHOPEE' && selectedFilialId !== 'PIAUI_SHOPEE') {
        const currentFilialObj = filiaisList.find((f) => f.id === selectedFilialId);
        const currentFilialNome = (currentFilialObj?.nome || '').toLowerCase().trim();
        const currentFilialCodigo = (currentFilialObj?.codigo || '').toLowerCase().trim();
        const isMatriz =
          selectedFilialId === 'filial-matriz-fortaleza' ||
          selectedFilialId === 'FILIAL-MATRIZ-001' ||
          currentFilialCodigo === 'matriz';

        if (osFilialId) {
          if (osFilialId !== selectedFilialId && osFilialId.toLowerCase() !== selectedFilialId.toLowerCase()) {
            return;
          }
        } else if (osFilialNome && currentFilialNome) {
          if (osFilialNome !== currentFilialNome && !osFilialNome.includes(currentFilialNome) && !currentFilialNome.includes(osFilialNome)) {
            return;
          }
        } else {
          if (!isMatriz) return;
        }
      }

      const val = Number(os.valorTotal || (os as any).valorFinal || (os as any).subtotal || 0) || 0;
      sumOS += val;

      const rawSeller =
        (os as any).vendedorNome ||
        (os as any).vendedor ||
        os.operador ||
        (os as any).operadorNome ||
        (os as any).criadoPor ||
        (os as any).createdBy ||
        (os as any).responsavel ||
        (os as any).atendente;
      const cleanSeller = String(rawSeller || '')
        .replace(/\([^)]*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
      const sName = cleanSeller || 'VENDEDOR';

      if (!sellersMap[sName]) {
        sellersMap[sName] = { name: sName, total: 0, osTotal: 0, vndTotal: 0, osCount: 0, vndCount: 0 };
      }
      sellersMap[sName].total += val;
      sellersMap[sName].osTotal += val;
      sellersMap[sName].osCount += 1;
    });

    // 1.2 Processar Vendas Diretas / Balcão (VND / PDV) do mês atual
    pdvList.forEach((pdv) => {
      const status = (pdv.status || '').toLowerCase().trim();
      if (status === 'cancelado' || status === 'cancelada' || (pdv as any).deletedAt) {
        return;
      }

      // Excluir quitação de OS no PDV para não duplicar valores
      const isOsPayment =
        Boolean(pdv.osId) ||
        (pdv.osCodigo && pdv.osCodigo.toUpperCase().startsWith('OS')) ||
        (pdv.codigoVenda && pdv.codigoVenda.toUpperCase().startsWith('CDV-OS'));
      if (isOsPayment) {
        return;
      }

      // Validar data no mês e ano vigentes
      const dt = parseDateSafe(pdv.createdAt || pdv.dataVenda || (pdv as any).data || (pdv as any).dataHora || (pdv as any).timestamp);
      if (dt.getMonth() !== currentMonthIdx || dt.getFullYear() !== currentYear) {
        return;
      }

      // Segmentação por Filial na TV (Todas, Fortaleza, Shopee, Piauí, Fortaleza/Shopee, Piauí/Shopee)
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

      const sellerName = String(pdv.vendedorNome || (pdv as any).vendedor || pdv.operadorNome || pdv.operador || '').toLowerCase().trim();
      if (sellerName && Array.isArray(employees)) {
        const sellerEmp = employees.find((e) => {
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

      if (selectedFilialId === 'FORTALEZA' && !isFortaleza) return;
      if (selectedFilialId === 'SHOPEE' && !isShopee) return;
      if (selectedFilialId === 'PIAUI' && !isPiaui) return;
      if (selectedFilialId === 'FORTALEZA_SHOPEE' && !isFortaleza && !isShopee) return;
      if (selectedFilialId === 'PIAUI_SHOPEE' && !isPiaui && !isShopee) return;

      if (selectedFilialId !== 'ALL' && selectedFilialId !== 'FORTALEZA' && selectedFilialId !== 'SHOPEE' && selectedFilialId !== 'PIAUI' && selectedFilialId !== 'FORTALEZA_SHOPEE' && selectedFilialId !== 'PIAUI_SHOPEE') {
        const currentFilialObj = filiaisList.find((f) => f.id === selectedFilialId);
        const currentFilialNome = (currentFilialObj?.nome || '').toLowerCase().trim();
        const currentFilialCodigo = (currentFilialObj?.codigo || '').toLowerCase().trim();
        const isMatriz =
          selectedFilialId === 'filial-matriz-fortaleza' ||
          selectedFilialId === 'FILIAL-MATRIZ-001' ||
          currentFilialCodigo === 'matriz';

        if (pdvFilialId) {
          if (pdvFilialId !== selectedFilialId && pdvFilialId.toLowerCase() !== selectedFilialId.toLowerCase()) {
            return;
          }
        } else if (pdvFilialNome && currentFilialNome) {
          if (pdvFilialNome !== currentFilialNome && !pdvFilialNome.includes(currentFilialNome) && !currentFilialNome.includes(pdvFilialNome)) {
            return;
          }
        } else {
          if (!isMatriz) return;
        }
      }

      const val = Number(pdv.valorTotal || pdv.subtotal || 0) || 0;
      sumVND += val;

      const rawSeller =
        pdv.vendedorNome ||
        (pdv as any).vendedor ||
        pdv.operadorNome ||
        pdv.operador ||
        pdv.usuario ||
        pdv.createdBy ||
        (pdv as any).atendente;
      const cleanSellerPdv = String(rawSeller || '')
        .replace(/\([^)]*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
      const sName = cleanSellerPdv || 'BALCÃO / VND';

      if (!sellersMap[sName]) {
        sellersMap[sName] = { name: sName, total: 0, osTotal: 0, vndTotal: 0, osCount: 0, vndCount: 0 };
      }
      sellersMap[sName].total += val;
      sellersMap[sName].vndTotal += val;
      sellersMap[sName].vndCount += 1;
    });

    const grandTotal = sumOS + sumVND;
    // Percentual real sobre a meta da empresa (ou 0 se não houver meta ou faturamento)
    const pct = grandTotal > 0 && metaEmpresa > 0
      ? Number(((grandTotal / metaEmpresa) * 100).toFixed(1))
      : 0;

    // Apenas vendedores com vendas reais (> 0), ordenados pelo maior desempenho
    const sorted = Object.values(sellersMap)
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total);

    return {
      faturamentoPercentual: pct,
      totalFaturadoReal: grandTotal,
      totalVendasOS: sumOS,
      totalVendasVND: sumVND,
      sellersWithSales: sorted,
    };
  }, [osList, pdvList, currentMonthIdx, currentYear, metaEmpresa, selectedFilialId, filiaisList]);

  // 2. FUNIL DE VENDEDORES (RANQUING DOS MELHORES DESEMPENHOS)
  // Exibe o modelo de barra e identificação de vendedor com o mesmo padrão e riqueza visual do Dashboard
  const funnelList = useMemo<FunnelSellerItem[]>(() => {
    if (sellersWithSales.length === 0) {
      return [];
    }

    const maxSales = sellersWithSales[0]?.total || 0;

    return sellersWithSales.slice(0, 12).map((seller, i) => {
      const rank = i + 1;
      let badgeColor = 'bg-slate-100 text-slate-700 border-slate-300';
      let icon = undefined;

      if (rank === 1) {
        badgeColor = 'bg-amber-50 text-amber-700 border-amber-300';
        icon = Crown;
      } else if (rank === 2) {
        badgeColor = 'bg-slate-100 text-slate-700 border-slate-300';
        icon = Medal;
      } else if (rank === 3) {
        badgeColor = 'bg-amber-800/10 text-amber-800 border-amber-800/30';
        icon = Award;
      }

      // Largura da barra proporcional ao líder ou mínimo de 16% (igual ao Dashboard)
      const widthPct =
        maxSales > 0 ? Math.max(16, Math.round((seller.total / maxSales) * 100)) : 100;

      // Percentual de participação nas vendas faturadas do mês
      const pct =
        totalFaturadoReal > 0
          ? Number(((seller.total / totalFaturadoReal) * 100).toFixed(1))
          : 0;

      const emp = employees.find(
        (e) =>
          ((e as any).nome || (e as any).name || '').trim().toLowerCase() ===
          seller.name.trim().toLowerCase()
      );
      const cargo = emp?.role || (emp as any)?.cargo || 'Vendedor(a)';

      return {
        id: `seller-${i}-${seller.name}`,
        rank,
        name: seller.name,
        shortName: seller.name.length > 15 ? `${seller.name.substring(0, 13)}...` : seller.name,
        cargo,
        percentual: pct,
        total: seller.total,
        osCount: seller.osCount,
        vndCount: seller.vndCount,
        barColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
        widthPct,
        badgeColor,
        icon,
      };
    });
  }, [sellersWithSales, totalFaturadoReal, employees]);

  // Top 3 do pódio (apenas se houver vendedores com vendas, senão '—')
  const top1 = funnelList[0]?.name || '—';
  const top2 = funnelList[1]?.name || '—';
  const top3 = funnelList[2]?.name || '—';

  // 3. SETORES DE FLUXO (LINHA 1: DESIGNER, IMPRESSÃO, CALANDRA, COSTURA / LINHA 2: EXCURSÃO, CORREIOS, SHOPEE, RETIRADA(Recepção))
  const osBySector = useMemo(() => {
    const sectors: Record<string, OrdemServico[]> = {
      'DESIGNER': [],
      'IMPRESSÃO': [],
      'CALANDRA': [],
      'COSTURA': [],
      'EXCURSÃO': [],
      'CORREIOS': [],
      'SHOPEE': [],
      'RETIRADA(Recepção)': [],
    };

    osList.forEach((os) => {
      // Desconsidera orçamentos puros
      if ((os as any).isOrcamento || (os as any).tipoDocumento === 'ORCAMENTO' || os.codigo?.startsWith('ORC')) {
        return;
      }
      const cod = (os.codigo || '').toUpperCase();
      if (cod.startsWith('VND') || cod.startsWith('PDV')) {
        return;
      }
      const stage = (os.estagioAtual || '').toLowerCase().trim();
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

      if (status === 'cancelado' || status === 'cancelada' || (os as any).deletedAt) return;

      const obs = (os.observacoes || '').toLowerCase();
      const destino = String((os as any).destinoExpedicao || (os as any).destino || '').toLowerCase();
      const canal = String((os as any).canal || (os as any).canalVenda || (os as any).origem || '').toLowerCase();
      const cliente = String(os.clienteNome || (os as any).cliente || '').toLowerCase();
      const tipoExp = String(os.tipoExpedicao || '').toLowerCase();
      const historicoStr = (os.historicoEdicoes || []).map(h => `${h.acao} ${h.detalhes || ''}`).join(' ').toLowerCase();

      // Identifica se é do canal ou destino Shopee
      const isShopeeOrder =
        stage.includes('shopee') ||
        destino.includes('shopee') ||
        canal.includes('shopee') ||
        cliente.includes('shopee') ||
        tipoExp.includes('shopee') ||
        obs.includes('shopee') ||
        historicoStr.includes('shopee');

      // 1. Etapas de Fabricação Ativa (Linha 1)
      if (stage.includes('design') || stage.includes('arte')) {
        sectors['DESIGNER'].push(os);
      } else if (stage.includes('impress') || stage.includes('print')) {
        sectors['IMPRESSÃO'].push(os);
      } else if (stage.includes('calandra') || stage.includes('prensa')) {
        sectors['CALANDRA'].push(os);
      } else if (stage.includes('costura') || stage.includes('acabamento')) {
        sectors['COSTURA'].push(os);
      }
      // 2. Destinos de Expedição & Entrega (Linha 2)
      // REGRA DE OURO: Quando o destino de envio foi explicitamente definido (destinoExpedicao / destino),
      // ele tem PREVALÊNCIA ABSOLUTA sobre qualquer outro campo!
      else if (destino.includes('shopee')) {
        sectors['SHOPEE'].push(os);
      } else if (destino.includes('correio')) {
        sectors['CORREIOS'].push(os);
      } else if (destino.includes('excurs')) {
        sectors['EXCURSÃO'].push(os);
      } else if (destino.includes('retirada') || destino.includes('recep')) {
        sectors['RETIRADA(Recepção)'].push(os);
      }
      // Casos em que o destino de envio ainda NÃO foi explicitamente selecionado pelo operador:
      else if (stage.includes('shopee') || isShopeeOrder) {
        sectors['SHOPEE'].push(os);
      } else if (stage.includes('correio') || tipoExp.includes('correio') || canal.includes('correio')) {
        sectors['CORREIOS'].push(os);
      } else if (stage.includes('excurs') || tipoExp.includes('excurs')) {
        sectors['EXCURSÃO'].push(os);
      } else if (stage.includes('retirada') || stage.includes('recep')) {
        sectors['RETIRADA(Recepção)'].push(os);
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
          sectors['RETIRADA(Recepção)'].push(os);
        } else {
          // Padrão do fluxo inicial de fabricação: Designer
          sectors['DESIGNER'].push(os);
        }
      }
    });

    return sectors;
  }, [osList]);

  // LINHA 1: DESIGNER, IMPRESSÃO, CALANDRA, COSTURA (4 COLUNAS)
  const ROW_1_SECTORS_CONFIG = [
    { key: 'DESIGNER', label: 'DESIGNER', icon: Palette, colorClass: 'text-purple-600', badgeClass: 'bg-[#9333ea] text-white' },
    { key: 'IMPRESSÃO', label: 'IMPRESSÃO', icon: Printer, colorClass: 'text-blue-600', badgeClass: 'bg-blue-600 text-white' },
    { key: 'CALANDRA', label: 'CALANDRA', icon: Flame, colorClass: 'text-orange-500', badgeClass: 'bg-orange-500 text-white' },
    { key: 'COSTURA', label: 'COSTURA', icon: Scissors, colorClass: 'text-rose-600', badgeClass: 'bg-rose-600 text-white' },
  ];

  // LINHA 2: EXCURSÃO, CORREIOS, SHOPEE, RETIRADA(Recepção) (4 COLUNAS)
  const ROW_2_SECTORS_CONFIG = [
    { key: 'EXCURSÃO', label: 'EXCURSÃO', icon: Truck, colorClass: 'text-red-600', badgeClass: 'bg-red-600 text-white' },
    { key: 'CORREIOS', label: 'CORREIOS', icon: Package, colorClass: 'text-amber-600', badgeClass: 'bg-amber-600 text-white' },
    { key: 'SHOPEE', label: 'SHOPEE', icon: ShoppingBag, colorClass: 'text-orange-600', badgeClass: 'bg-orange-600 text-white' },
    { key: 'RETIRADA(Recepção)', label: 'RETIRADA(Recepção)', icon: Store, colorClass: 'text-emerald-600', badgeClass: 'bg-emerald-600 text-white' },
  ];

  const SECTORS_CONFIG = [...ROW_1_SECTORS_CONFIG, ...ROW_2_SECTORS_CONFIG];

  // Cálculo dos arcos do gráfico de pizza circular
  // Fatia Vermelha (Faturamento) vs Fatia Azul (750 MIL)
  const piePaths = useMemo(() => {
    const cx = 140;
    const cy = 140;
    const r = 120;

    // Se não há faturamento (pct === 0), desenha círculo 100% azul limpo da meta
    if (faturamentoPercentual <= 0) {
      return {
        isZero: true,
        cx,
        cy,
        r,
        redPath: '',
        bluePath: '',
        textRedX: cx,
        textRedY: cy + 30,
        textBlueX: cx,
        textBlueY: cy - 6,
      };
    }

    const pct = Math.min(100, faturamentoPercentual);
    const redAngle = (pct / 100) * 360;

    // Converte ângulo em radianos
    const startAngle = 90; // Começa na parte inferior
    const endAngle = startAngle + redAngle;

    const toRad = (deg: number) => (deg * Math.PI) / 180;

    // Coordenadas
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));

    const largeArcFlagRed = redAngle > 180 ? 1 : 0;
    const largeArcFlagBlue = (360 - redAngle) > 180 ? 1 : 0;

    const redPath = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlagRed} 1 ${x2} ${y2} Z`;
    const bluePath = `M ${cx} ${cy} L ${x2} ${y2} A ${r} ${r} 0 ${largeArcFlagBlue} 1 ${x1} ${y1} Z`;

    // Posições dos textos nas fatias
    const midRedAngle = startAngle + redAngle / 2;
    const midBlueAngle = endAngle + (360 - redAngle) / 2;
    const textRadius = r * 0.55;

    const textRedX = cx + textRadius * Math.cos(toRad(midRedAngle));
    const textRedY = cy + textRadius * Math.sin(toRad(midRedAngle));

    const textBlueX = cx + textRadius * Math.cos(toRad(midBlueAngle));
    const textBlueY = cy + textRadius * Math.sin(toRad(midBlueAngle));

    return {
      isZero: false,
      cx,
      cy,
      r,
      redPath,
      bluePath,
      textRedX,
      textRedY,
      textBlueX,
      textBlueY,
    };
  }, [faturamentoPercentual]);

  // Renderizador de Coluna Individual do Fluxo
  const renderSectorColumn = (sector: (typeof ROW_1_SECTORS_CONFIG)[0]) => {
    const SectorIcon = sector.icon;
    const items = osBySector[sector.key] || [];

    return (
      <div
        key={sector.key}
        className={`rounded-xl border p-2.5 flex flex-col min-h-[220px] max-h-[270px] shadow-sm transition ${
          tvTheme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {/* Header da Coluna com Ícone e Badge */}
        <div
          className={`flex items-center justify-between gap-1 pb-2 border-b mb-2 ${
            tvTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <SectorIcon
              className={`w-4 h-4 shrink-0 ${
                tvTheme === 'dark' ? 'text-indigo-400' : sector.colorClass
              }`}
            />
            <span
              className={`text-xs font-black uppercase truncate tracking-tight ${
                tvTheme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}
            >
              {sector.label}
            </span>
          </div>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
              items.length > 0
                ? sector.badgeClass
                : tvTheme === 'dark'
                ? 'bg-slate-800 text-slate-300'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {items.length} OS{items.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Lista de OSs da Coluna */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
          {items.length === 0 ? (
            <div className="h-full flex items-center justify-center p-3">
              <span
                className={`text-xs italic text-center font-medium ${
                  tvTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Nenhuma OS nesta etapa
              </span>
            </div>
          ) : (
            items.map((os) => {
              const tipoExpedicao = os.tipoExpedicao;
              return (
                <div
                  key={os.id}
                  className={`border rounded-lg p-2 shadow-xs transition ${
                    tvTheme === 'dark'
                      ? 'bg-slate-800/90 border-slate-700 hover:border-slate-600'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-black gap-1">
                    <span
                      className={
                        tvTheme === 'dark' ? 'text-indigo-300' : 'text-[#3b28cc]'
                      }
                    >
                      {formatOsNumber(os.codigo || (os as any).numero || (os as any).numeroOs)}
                    </span>
                    <span
                      className={`truncate text-[10px] ${
                        tvTheme === 'dark' ? 'text-sky-300' : 'text-[#1d63b8]'
                      }`}
                    >
                      {formatVendedorTruncado(os)}
                    </span>
                  </div>
                  <div
                    className={`text-[11px] font-black uppercase mt-1 truncate ${
                      tvTheme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {os.clienteNome || 'CLIENTE'}
                  </div>
                  {((os as any).destinoExpedicao || (os as any).destino) && (
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 dark:bg-blue-950/90 dark:text-blue-300 border border-blue-200 dark:border-blue-800 truncate max-w-full shadow-2xs">
                        <Truck className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="truncate">Destino: {(os as any).destinoExpedicao || (os as any).destino}</span>
                      </span>
                    </div>
                  )}
                  {tipoExpedicao === 'EXPRESSO EXCURSÃO' && (!((os as any).destinoExpedicao || (os as any).destino) || String((os as any).destinoExpedicao || (os as any).destino).toLowerCase().includes('excurs')) && (
                    <div className="mt-1">
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-red-600 text-white tracking-wider">
                        EXPRESSO EXCURSÃO
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`min-h-screen transition-colors duration-300 font-sans select-none ${
        tvTheme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-900'
      } ${isFullscreen ? 'p-3' : 'p-3 md:p-5'}`}
    >
      {/* 1. HEADER DO DASHBOARD COMERCIAL */}
      <header
        className={`rounded-2xl shadow-sm border p-3.5 sm:p-4 px-4 sm:px-5 mb-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
          tvTheme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {/* Esquerda: Ícone de pizza verde + Título e Subtítulo */}
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#00875a] flex items-center justify-center text-white shadow-md shrink-0">
            <PieIcon className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1
                className={`text-lg sm:text-xl md:text-2xl font-black tracking-tight uppercase truncate ${
                  tvTheme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}
              >
                DASHBOARD COMERCIAL
              </h1>
              <span className="text-[#00875a] font-black text-sm sm:text-lg md:text-xl shrink-0">
                • {currentMonthName} / {currentYear}
              </span>
            </div>
            <p className={`text-[11px] sm:text-xs font-semibold mt-0.5 truncate ${tvTheme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>
              Painel de Performance e Acompanhamento de Metas em Tempo Real
            </p>
          </div>
        </div>

        {/* Direita: Filial, Relógio, Auto-sync, Alternador de Tema e Botão Tela Cheia */}
        <div className="flex items-center justify-start md:justify-end gap-2 sm:gap-2.5 flex-wrap">
          {/* Seletor de Filial da TV */}
          <div
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl border flex items-center gap-1.5 sm:gap-2 grow sm:grow-0 ${
              tvTheme === 'dark' ? 'bg-slate-800/90 border-slate-700 text-white' : 'bg-slate-50 border-slate-200/80 text-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
            <select
              value={selectedFilialId}
              onChange={(e) => setSelectedFilialId(e.target.value)}
              className="bg-transparent text-xs font-black focus:outline-none cursor-pointer w-full"
              title="Selecione a Filial para exibir no painel da TV"
            >
              <option value="ALL" className="text-slate-900">🏢 Todas</option>
              <option value="FORTALEZA" className="text-slate-900">🏢 Fortaleza</option>
              <option value="SHOPEE" className="text-slate-900">🛍️ Shopee</option>
              <option value="PIAUI" className="text-slate-900">🏢 Piauí</option>
              <option value="FORTALEZA_SHOPEE" className="text-slate-900">🏢 Fortaleza/Shopee</option>
              <option value="PIAUI_SHOPEE" className="text-slate-900">🏢 Piauí/Shopee</option>
            </select>
          </div>

          {/* Relógio Digital */}
          <div
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl border flex items-center gap-2 shrink-0 ${
              tvTheme === 'dark' ? 'bg-slate-800/90 border-slate-700' : 'bg-slate-50 border-slate-200/80'
            }`}
          >
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#00875a] shrink-0" />
            <div className="flex flex-col">
              <span
                className={`font-mono text-xs sm:text-sm md:text-base font-black tracking-wider leading-tight ${
                  tvTheme === 'dark' ? 'text-white' : 'text-slate-800'
                }`}
              >
                {currentTime.toLocaleTimeString('pt-BR')}
              </span>
              <span
                className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-tight ${
                  tvTheme === 'dark' ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                {currentWeekday.slice(0, 3)}, {currentDay} DE {monthAbbr}.
              </span>
            </div>
          </div>

          {/* Auto-Sync */}
          <div
            className={`px-2 sm:px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs shrink-0 ${
              tvTheme === 'dark' ? 'bg-slate-800/90 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200/80 text-slate-600'
            }`}
          >
            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider hidden xs:inline">AUTO-SYNC</span>
            <span
              className={`font-black text-xs font-mono ${
                tvTheme === 'dark' ? 'text-white' : 'text-slate-800'
              }`}
            >
              {autoRefreshCountdown}s
            </span>
          </div>

          {/* Alternador de Tema (Padrão Claro) */}
          <button
            onClick={() => setTvTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
            className={`p-2 sm:p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
              tvTheme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700'
                : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100'
            }`}
            title="Alternar Modo Escuro/Claro"
          >
            {tvTheme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Botão Tela Cheia */}
          <button
            onClick={handleToggleFullscreen}
            className="bg-[#00875a] hover:bg-[#00744e] text-white font-bold text-xs px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl flex items-center gap-1.5 sm:gap-2 shadow-sm transition active:scale-95 cursor-pointer shrink-0"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">Tela Cheia</span>
          </button>
        </div>
      </header>

      {/* 2. GRID PRINCIPAL (3 COLUNAS CONFORME A IMAGEM) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
        {/* COLUNA 1: META MENSAL (GRÁFICO DE PIZZA) */}
        <div className="lg:col-span-4 flex flex-col">
          {/* Aba Azul Superior */}
          <div className="bg-[#1d63b8] text-white font-black py-2 px-3 sm:px-4 rounded-t-xl uppercase tracking-wider text-xs sm:text-sm shadow-sm flex items-center justify-between">
            <span className="flex-1 text-center pl-6">
              META {currentMonthName.toUpperCase()} {currentYear2Digits}
            </span>
            <button
              type="button"
              onClick={() => {
                setTempMetaInput(metaEmpresa > 0 ? metaEmpresa.toString() : '');
                setIsEditingMetaModalOpen(true);
              }}
              className="p-1 hover:bg-white/20 rounded-lg text-white/90 hover:text-white transition cursor-pointer"
              title="Definir / Ajustar Meta da Empresa"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Card sem Borda */}
          <div
            className={`flex-1 rounded-b-2xl ${
              tvTheme === 'dark' ? 'bg-slate-900' : 'bg-white'
            } p-3.5 sm:p-4 flex flex-col items-center justify-center min-h-[320px] sm:min-h-[360px] shadow-sm`}
          >
            {/* SVG Pie Chart Preenchido Exatamente como na imagem */}
            <div
              className="relative max-w-[260px] sm:max-w-[280px] w-full aspect-square mx-auto flex items-center justify-center cursor-pointer group"
              onClick={() => {
                setTempMetaInput(metaEmpresa > 0 ? metaEmpresa.toString() : '');
                setIsEditingMetaModalOpen(true);
              }}
              title="Clique para definir ou alterar a meta da empresa"
            >
              {piePaths.isZero ? (
                <svg viewBox="0 0 280 280" className="w-full h-full drop-shadow-md transition-transform group-hover:scale-[1.02]">
                  {/* Círculo 100% Azul da Meta da Empresa */}
                  <circle cx={piePaths.cx} cy={piePaths.cy} r={piePaths.r} fill="#1d63b8" stroke="#111827" strokeWidth="1" />
                  {/* Texto central da Meta definida pela empresa */}
                  <text
                    x={piePaths.textBlueX}
                    y={piePaths.textBlueY}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontWeight="900"
                    fontSize={metaLabelText.length > 9 ? "16" : metaLabelText.length > 7 ? "19" : "22"}
                    className="uppercase tracking-wider"
                  >
                    {metaLabelText}
                  </text>
                  {/* Indicador limpo de FATURAMENTO 0% ou instrução para definir meta */}
                  <text
                    x={piePaths.textRedX}
                    y={piePaths.textRedY}
                    textAnchor="middle"
                    fill="#bfdbfe"
                    fontWeight="900"
                    fontSize="13"
                    className="uppercase tracking-wider"
                  >
                    {metaEmpresa > 0 ? 'FATURAMENTO 0%' : 'CLIQUE P/ DEFINIR META'}
                  </text>
                </svg>
              ) : (
                <svg viewBox="0 0 280 280" className="w-full h-full drop-shadow-md transition-transform group-hover:scale-[1.02]">
                  {/* Fatia Vermelha (FATURAMENTO) */}
                  <path d={piePaths.redPath} fill="#e52e2e" stroke="#111827" strokeWidth="1" />
                  {/* Fatia Azul (Meta da Empresa) */}
                  <path d={piePaths.bluePath} fill="#1d63b8" stroke="#111827" strokeWidth="1" />

                  {/* Texto na fatia vermelha */}
                  <text
                    x={piePaths.textRedX}
                    y={piePaths.textRedY - 8}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontWeight="900"
                    fontSize="14"
                    className="uppercase tracking-tight"
                  >
                    FATURAMENTO
                  </text>
                  <text
                    x={piePaths.textRedX}
                    y={piePaths.textRedY + 14}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontWeight="900"
                    fontSize="22"
                  >
                    {faturamentoPercentual}%
                  </text>

                  {/* Texto na fatia azul (Meta definida pela empresa) */}
                  <text
                    x={piePaths.textBlueX}
                    y={piePaths.textBlueY}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontWeight="900"
                    fontSize={metaLabelText.length > 9 ? "14" : metaLabelText.length > 7 ? "16" : "17"}
                    className="uppercase tracking-wider"
                  >
                    {metaLabelText}
                  </text>
                </svg>
              )}
            </div>

            {/* Informações detalhadas da Meta */}
            <div className="mt-3 flex flex-col items-center gap-1 text-center w-full">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 flex-wrap">
                <span>Meta da Empresa:</span>
                <span className={`font-black ${tvTheme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                  {metaEmpresa > 0
                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metaEmpresa)
                    : 'Não definida'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTempMetaInput(metaEmpresa > 0 ? metaEmpresa.toString() : '');
                    setIsEditingMetaModalOpen(true);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-[11px] font-black underline ml-1 cursor-pointer"
                >
                  {metaEmpresa > 0 ? 'Alterar' : 'Definir'}
                </button>
              </div>
              {metaEmpresa > 0 && (
                <div className="text-[11px] font-semibold text-slate-400">
                  Faturado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFaturadoReal)} ({faturamentoPercentual}% atingido)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUNA 2: RANQUING DOS MELHORES DESEMPENHOS */}
        <div className="lg:col-span-5 flex flex-col">
          {/* Aba Azul Superior */}
          <div className="bg-[#1d63b8] text-white font-black text-center py-2 px-4 rounded-t-xl uppercase tracking-wider text-xs sm:text-sm shadow-sm">
            RANQUING DOS MELHORES DESEMPENHOS
          </div>
          {/* Card sem Borda e Lista dos Melhores Desempenhos */}
          <div
            className={`flex-1 rounded-b-2xl ${
              tvTheme === 'dark' ? 'bg-slate-900' : 'bg-white'
            } p-3 sm:p-4 flex flex-col justify-start min-h-[320px] sm:min-h-[360px] shadow-sm`}
          >
            {funnelList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center my-auto">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                    tvTheme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <PieIcon className="w-6 h-6" />
                </div>
                <p
                  className={`text-sm font-black uppercase tracking-tight ${
                    tvTheme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                  }`}
                >
                  Nenhum vendedor com vendas registradas neste mês
                </p>
                <p
                  className={`text-xs mt-1.5 font-medium max-w-xs ${
                    tvTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  O ranquing e os percentuais de OS e VND serão exibidos automaticamente assim que houver faturamento.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 w-full overflow-y-auto max-h-[380px] pr-1 custom-scrollbar">
                {funnelList.map((seller) => {
                  const IconComp = seller.icon;
                  return (
                    <div
                      key={seller.id}
                      className="p-2 sm:p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Badge de Posição / Ícone */}
                          <div
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-black text-xs border shrink-0 shadow-2xs ${seller.badgeColor}`}
                            style={
                              seller.rank > 3
                                ? { borderColor: seller.barColor, color: seller.barColor }
                                : undefined
                            }
                          >
                            {IconComp ? <IconComp className="w-4 h-4" /> : `#${seller.rank}`}
                          </div>

                          {/* Nome do Vendedor e Discriminação de Vendas */}
                          <div className="min-w-0">
                            <span
                              className={`font-black text-xs sm:text-sm uppercase tracking-tight block truncate ${
                                tvTheme === 'dark' ? 'text-white' : 'text-slate-950'
                              }`}
                            >
                              {seller.name}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 flex-wrap">
                              {seller.osCount > 0 && <span className="text-indigo-600 dark:text-indigo-400">{seller.osCount} OS</span>}
                              {seller.osCount > 0 && seller.vndCount > 0 && <span>•</span>}
                              {seller.vndCount > 0 && <span className="text-emerald-600 dark:text-emerald-400">{seller.vndCount} VND</span>}
                            </div>
                          </div>
                        </div>

                        {/* Valor em Reais e % de Participação */}
                        <div className="text-right shrink-0">
                          <span className={`block font-black text-xs sm:text-sm ${tvTheme === 'dark' ? 'text-emerald-400' : 'text-slate-900'}`}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(seller.total)}
                          </span>
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">
                            {seller.percentual}%
                          </span>
                        </div>
                      </div>

                      {/* Barra de Progresso Horizontal com o Percentual no Fim */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden flex">
                        <div
                          className="h-full rounded-full transition-all duration-500 shadow-2xs flex items-center justify-end px-1.5"
                          style={{
                            width: `${seller.widthPct}%`,
                            backgroundColor: seller.barColor,
                            minWidth: '2rem',
                          }}
                        >
                          <span className="text-[8px] font-black text-white leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
                            {seller.percentual}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUNA 3: PARABÉNS AOS MELHORES DO MÊS (PÓDIO VERTICAL) */}
        <div className="lg:col-span-3 flex flex-col">
          {/* Aba Azul Superior */}
          <div className="bg-[#1d63b8] text-white font-black text-center py-2 px-4 rounded-t-xl uppercase tracking-wider text-xs sm:text-sm shadow-sm">
            PARABÉNS AOS MELHORES DO MÊS
          </div>
          {/* Card sem Borda com os 3 Primeiros Colocados */}
          <div
            className={`flex-1 rounded-b-2xl ${
              tvTheme === 'dark' ? 'bg-slate-900' : 'bg-white'
            } p-4 flex flex-col justify-around text-center min-h-[360px] shadow-sm`}
          >
            {/* 1º LUGAR (OURO) */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="w-10 h-10 mb-1 flex items-center justify-center">
                <svg viewBox="0 0 40 40" className="w-9 h-9 drop-shadow-sm">
                  {/* Fitas Vermelhas */}
                  <path d="M14 6 L10 20 L16 18 Z" fill="#dc2626" />
                  <path d="M26 6 L30 20 L24 18 Z" fill="#b91c1c" />
                  <path d="M16 6 L20 18 L24 6 Z" fill="#3b82f6" />
                  {/* Medalha Dourada */}
                  <circle cx="20" cy="24" r="12" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />
                  <circle cx="20" cy="24" r="9" fill="#fbbf24" />
                  <text x="20" y="28" textAnchor="middle" fill="#78350f" fontWeight="900" fontSize="11">
                    1
                  </text>
                </svg>
              </div>
              <span
                className={`text-[11px] font-black uppercase tracking-tight ${
                  tvTheme === 'dark' ? 'text-amber-400' : 'text-slate-900'
                }`}
              >
                PRIMEIRO LUGAR
              </span>
              <h2
                className={`text-xl sm:text-2xl font-black uppercase tracking-tight truncate max-w-full px-2 ${
                  top1 !== '—'
                    ? tvTheme === 'dark'
                      ? 'text-white'
                      : 'text-slate-900'
                    : tvTheme === 'dark'
                    ? 'text-slate-500 text-lg'
                    : 'text-slate-400 text-lg'
                }`}
              >
                {top1}
              </h2>
            </div>

            <div
              className={`w-3/4 mx-auto border-t ${
                tvTheme === 'dark' ? 'border-slate-800' : 'border-slate-200/60'
              }`}
            />

            {/* 2º LUGAR (PRATA) */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="w-10 h-10 mb-1 flex items-center justify-center">
                <svg viewBox="0 0 40 40" className="w-9 h-9 drop-shadow-sm">
                  {/* Fitas Azuis */}
                  <path d="M14 6 L10 20 L16 18 Z" fill="#2563eb" />
                  <path d="M26 6 L30 20 L24 18 Z" fill="#1d4ed8" />
                  <path d="M16 6 L20 18 L24 6 Z" fill="#ef4444" />
                  {/* Medalha Prateada */}
                  <circle cx="20" cy="24" r="12" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
                  <circle cx="20" cy="24" r="9" fill="#cbd5e1" />
                  <text x="20" y="28" textAnchor="middle" fill="#334155" fontWeight="900" fontSize="11">
                    2
                  </text>
                </svg>
              </div>
              <span
                className={`text-[11px] font-black uppercase tracking-tight ${
                  tvTheme === 'dark' ? 'text-slate-300' : 'text-slate-900'
                }`}
              >
                SEGUNDO LUGAR
              </span>
              <h2
                className={`text-xl sm:text-2xl font-black uppercase tracking-tight truncate max-w-full px-2 ${
                  top2 !== '—'
                    ? tvTheme === 'dark'
                      ? 'text-white'
                      : 'text-slate-900'
                    : tvTheme === 'dark'
                    ? 'text-slate-500 text-lg'
                    : 'text-slate-400 text-lg'
                }`}
              >
                {top2}
              </h2>
            </div>

            <div
              className={`w-3/4 mx-auto border-t ${
                tvTheme === 'dark' ? 'border-slate-800' : 'border-slate-200/60'
              }`}
            />

            {/* 3º LUGAR (BRONZE) */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="w-10 h-10 mb-1 flex items-center justify-center">
                <svg viewBox="0 0 40 40" className="w-9 h-9 drop-shadow-sm">
                  {/* Fitas Laranjas */}
                  <path d="M14 6 L10 20 L16 18 Z" fill="#ea580c" />
                  <path d="M26 6 L30 20 L24 18 Z" fill="#c2410c" />
                  <path d="M16 6 L20 18 L24 6 Z" fill="#3b82f6" />
                  {/* Medalha Bronze */}
                  <circle cx="20" cy="24" r="12" fill="#d97706" stroke="#92400e" strokeWidth="1.5" />
                  <circle cx="20" cy="24" r="9" fill="#f59e0b" />
                  <text x="20" y="28" textAnchor="middle" fill="#78350f" fontWeight="900" fontSize="11">
                    3
                  </text>
                </svg>
              </div>
              <span
                className={`text-[11px] font-black uppercase tracking-tight ${
                  tvTheme === 'dark' ? 'text-amber-500' : 'text-slate-900'
                }`}
              >
                TERCEIRO LUGAR
              </span>
              <h2
                className={`text-xl sm:text-2xl font-black uppercase tracking-tight truncate max-w-full px-2 ${
                  top3 !== '—'
                    ? tvTheme === 'dark'
                      ? 'text-white'
                      : 'text-slate-900'
                    : tvTheme === 'dark'
                    ? 'text-slate-500 text-lg'
                    : 'text-slate-400 text-lg'
                }`}
              >
                {top3}
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* 3. FLUXO DE PRODUÇÃO E EXPEDIÇÃO (DIVIDIDO EM 2 LINHAS DE 4 COLUNAS) */}
      <div className="space-y-3.5 mt-1">
        {/* LINHA 1: DESIGNER | IMPRESSÃO | CALANDRA | COSTURA */}
        <div>
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <h2
              className={`text-xs font-black uppercase tracking-wider ${
                tvTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              1ª Linha: Etapas de Fabricação
            </h2>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                tvTheme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
              }`}
            >
              4 Colunas
            </span>
            <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {ROW_1_SECTORS_CONFIG.map((sector) => renderSectorColumn(sector))}
          </div>
        </div>

        {/* LINHA 2: EXCURSÃO | CORREIOS | SHOPEE | RETIRADA(Recepção) */}
        <div>
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2
              className={`text-xs font-black uppercase tracking-wider ${
                tvTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              2ª Linha: Expedição e Entrega
            </h2>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                tvTheme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
              }`}
            >
              4 Colunas
            </span>
            <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {ROW_2_SECTORS_CONFIG.map((sector) => renderSectorColumn(sector))}
          </div>
        </div>
      </div>

      {/* MODAL PARA DEFINIR / ALTERAR A META DA EMPRESA */}
      {isEditingMetaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scaleUp">
            {/* Cabeçalho do Modal */}
            <div className="bg-[#1d63b8] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg tracking-tight">Meta Mensal da Empresa</h3>
                  <p className="text-xs text-blue-100 font-medium">
                    {currentMonthName} de {currentYear}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingMetaModalOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-xl text-white/90 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Formulário */}
            <div className="p-5 sm:p-6 space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Informe o valor da meta de vendas da empresa. O valor configurado substituirá o indicador no gráfico da TV e será sincronizado com o painel executivo e as filiais.
              </p>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Valor da Meta (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                    R$
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={tempMetaInput}
                    onChange={(e) => setTempMetaInput(e.target.value)}
                    placeholder="Ex: 750000"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-[#1d63b8] focus:ring-2 focus:ring-blue-100 outline-none text-lg font-black text-slate-800 transition"
                    autoFocus
                  />
                </div>
                {Number(tempMetaInput) > 0 && (
                  <p className="text-xs font-bold text-blue-700 mt-1.5 flex items-center gap-1">
                    <span>Visualização:</span>
                    <span className="bg-blue-50 px-2 py-0.5 rounded text-[#1d63b8]">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(tempMetaInput))}
                      {' '}— ({formatMetaCompact(Number(tempMetaInput))})
                    </span>
                  </p>
                )}
              </div>

              {/* Atalhos Rápidos */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Valores Sugeridos
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[300000, 500000, 750000, 1000000, 1200000, 1500000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTempMetaInput(val.toString())}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold transition text-center cursor-pointer border ${
                        Number(tempMetaInput) === val
                          ? 'bg-blue-50 border-[#1d63b8] text-[#1d63b8] shadow-sm font-black'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {formatMetaCompact(val)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rodapé com Ações */}
            <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditingMetaModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = Number(tempMetaInput);
                  if (isNaN(val) || val < 0) return;
                  handleSaveCompanyGoal(val);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-[#1d63b8] hover:bg-[#154d91] shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Meta</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Exportação com ambos os nomes para assegurar compatibilidade e cláusula de proteção contra regressão
export const DashboardComercialView = TvComercialDashboardView;
export default TvComercialDashboardView;
