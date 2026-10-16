import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../../types/frontend';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  LayoutDashboard,
  UserCheck,
  UserPlus,
  Briefcase,
  Building2,
  Clock,
  CalendarDays,
  FileText,
  BookOpen,
  Award,
  BrainCircuit,
  MessageSquareHeart,
  SmilePlus,
  Palmtree,
  AlertOctagon,
  BarChart3,
  MessageSquare,
  FileSignature,
  Settings,
  Search,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  Send,
  Printer,
  Download,
  Sparkles,
  ArrowUpRight,
  Filter,
  Users,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Calendar,
  FileSpreadsheet,
  CheckSquare,
  HelpCircle,
  Clock4,
  GraduationCap,
  Cake,
  TrendingUp,
  TrendingDown,
  Target,
  Lightbulb,
  Activity,
  Percent,
  UserX,
  HeartHandshake,
  ShieldCheck,
  Zap,
  ExternalLink,
  RefreshCw,
  Globe,
  Maximize2,
} from 'lucide-react';
import { EmployeeModuleView } from '../employee/EmployeeModuleView';
import { Employee } from '../../server/types/employee';
import { ApiService } from '../../services/api';
import {
  JobOpening,
  Candidate,
  CandidateStage,
  StandardPosition,
  TimeClockRecord,
  WorkShift,
  EmployeeDocumentCheck,
  TrainingCourse,
  PerformanceReview,
  DiscAssessment,
  FeedbackLog,
  ClimateSurvey,
  VacationRequest,
  DisciplinaryAction,
  DigitalSignatureDoc,
  RhAlert,
  RhMessage,
} from '../../server/types/rh';

export type RhSubTab =
  | 'dashboard'
  | 'funcionarios'
  | 'recrutamento'
  | 'cargos-setores'
  | 'jornada'
  | 'documentos'
  | 'treinamentos'
  | 'avaliacoes'
  | 'disc'
  | 'feedbacks'
  | 'pesquisa-clima'
  | 'ferias'
  | 'advertencias'
  | 'relatorios-rh'
  | 'mensagens'
  | 'assinatura-digital'
  | 'configuracoes';

interface RhSubMenuOption {
  id: RhSubTab;
  label: string;
  icon: React.ElementType;
  description: string;
  badge?: string;
}

export const RH_SUBMENU_OPTIONS: RhSubMenuOption[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Visão geral e métricas de pessoas' },
  { id: 'jornada', label: 'Jornada', icon: Clock, description: 'Registro de ponto eletrônico e banco de horas' },
  { id: 'avaliacoes', label: 'Avaliações', icon: Award, description: 'Avaliação de desempenho 90 dias, 360° e KPIs' },
  { id: 'disc', label: 'Perfil Comportamental (DISC)', icon: BrainCircuit, description: 'Mapeamento comportamental e teste DISC' },
  { id: 'ferias', label: 'Férias', icon: Palmtree, description: 'Programação de férias e abono pecuniário' },
  { id: 'advertencias', label: 'Advertências', icon: AlertOctagon, description: 'Registro de ocorrências e sanções disciplinares' },
  { id: 'relatorios-rh', label: 'Relatórios', icon: BarChart3, description: 'Relatórios analíticos de gestão de pessoas' },
  { id: 'assinatura-digital', label: 'Assinatura Digital', icon: FileSignature, description: 'Assinatura eletrônica de documentos e holerites' },
];

// -----------------------------------------------------------------------------
// QUESTIONÁRIO E LÓGICA DO TESTE DISC (DINÂMICA: QUAL PALAVRA MELHOR TE DESCREVE?)
// -----------------------------------------------------------------------------
export const MR_COACH_DISC_QUESTIONS = [
  {
    q: 1,
    title: 'Grupo 01',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Determinado (firme, focado em vencer desafios e metas)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Entusiasta (alegre, comunicativo, otimista e contagiante)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Paciente (calmo, leal, companheiro e equilibrado)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Preciso (meticuloso, perfeccionista, disciplinado e exato)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 2,
    title: 'Grupo 02',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Assertivo (direto, rápido e focado em soluções imediatas)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Persuasivo (carismático, amigável e influente com pessoas)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Constante (estável, pacificador, seguro e previsível)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Analítico (lógico, detalhista, criterioso e cauteloso)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 3,
    title: 'Grupo 03',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Ousado (corajoso, assume riscos e toma iniciativa)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Extrovertido (sociável, expressivo, aberto e animado)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Tolerante (compreensivo, atencioso, bom ouvinte e pacífico)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Disciplinado (organizado, respeita normas e regras rígidas)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 4,
    title: 'Grupo 04',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Competitivo (movido a vitórias, conquistas e autonomia)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Inspirador (cativante, criativo, otimista e motivador)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Acolhedor (gentil, harmonioso, cooperativo e parceiro)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Detalhista (cuidadoso com informações, busca zero erros)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 5,
    title: 'Grupo 05',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Independente (autônomo, proativo, decide por conta própria)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Comunicativo (fácil diálogo, expressivo e articulado)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Ponderado (sereno, prudente, evita atritos e precipitações)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Sistemático (metódico, estruturado e planejado passo a passo)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 6,
    title: 'Grupo 06',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Decidido (firme, resolve problemas sem hesitação)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Popular (amigável, conecta pessoas e constrói laços)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Prestativo (dedicado, disposto a ajudar e fiel ao grupo)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Cuidadoso (cauteloso, checa padrões e exige conformidade)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 7,
    title: 'Grupo 07',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Enérgico (alto ritmo, senso de urgência e apetite de liderança)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Empolgante (espontâneo, divertido e animador do ambiente)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Equilibrado (tranquilo, mantém a postura sob pressão)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Perfeccionista (busca a máxima excelência e rigor técnico)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 8,
    title: 'Grupo 08',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Objetivo (direto ao ponto, focado em resultados práticos)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Cativante (envolvente, amável, agradável e carismático)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Leal (fiel aos compromissos, traz paz e estabilidade ao time)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Rigoroso (exato, embasado em fatos, provas e estatísticas)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 9,
    title: 'Grupo 09',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Pioneiro (inovador na ação, desbravador de novas metas)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Inspirador (entusiasma pessoas, traz boas vibrações e ideias)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Sereno (modera conflitos, promove harmonia e união)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Meticuloso (revisa nos mínimos detalhes, não tolera descuido)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 10,
    title: 'Grupo 10',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Desafiador (provocativo, busca metas cada vez mais ousadas)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Simpático (acessível, caloroso, atrativo e integrador social)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Confiável (previsível, cumpre acordos e apoia a equipe)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Crítico (raciocínio lógico refinado, questiona incoerências)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 11,
    title: 'Grupo 11',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Impulsionador (destrava processos, cobra agilidade e prazos)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Expressivo (comunicação fluida, hábil em conversas e vendas)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Diplomata (pacificador, escuta todos os lados com respeito)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Auditor (focado na qualidade, manuais e padrões de fabricação)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 12,
    title: 'Grupo 12',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Firme (convicto de suas decisões, focado no resultado final)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Flexível (aberto a novidades, improviso e boa convivência)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Cadenciado (ritmo constante, metódico e sem sobressaltos)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Formal (sério, compenetrado e muito atento aos regulamentos)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 13,
    title: 'Grupo 13',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Comandante (assume a liderança e direciona a equipe)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Promotor (sabe engajar pessoas e vender visões de futuro)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Apoiador (sustenta o trabalho dos colegas com dedicação)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Especialista (detém o conhecimento técnico exato e detalhado)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 14,
    title: 'Grupo 14',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Prático (foco em soluções eficientes sem rodeios)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Descontraído (torna o ambiente leve, alegre e dinâmico)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Estável (mantém a rotina sob controle com segurança)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Exato (baseado em dados comprovados e verificações rigorosas)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 15,
    title: 'Grupo 15',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Incisivo (exige velocidade e não tolera lentidão ou desculpas)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Generoso (afetuoso, atencioso e entusiasmado com o time)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Protetor (cuida do bem-estar e da boa convivência da equipe)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Exigente (alto padrão de acabamento, sem margem para falhas)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 16,
    title: 'Grupo 16',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Autônomo (gosta de gerenciar os próprios projetos e ter voz)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Sociável (ama interagir, conversar e trabalhar em grupo)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Paciente (resistência física e mental para tarefas contínuas)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Estruturado (organiza tudo em processos, listas e fluxos claros)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 17,
    title: 'Grupo 17',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Vencedor (determinado a atingir o topo e bater todos os recordes)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Reconhecido (valoriza o aplauso, o elogio e a boa imagem)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Tranquilo (busca um clima calmo, harmonioso e seguro)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Conformista Técnico (siga rigorosamente os padrões de qualidade)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 18,
    title: 'Grupo 18',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Proativo (toma a iniciativa antes de ser solicitado)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Radiante (transmite energia positiva e entusiasmo no ambiente)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Compreensivo (coloca-se no lugar dos outros e sabe escutar)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Reflexivo (examina os detalhes com prudência e método)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 19,
    title: 'Grupo 19',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Acelerado (imprime urgência e cobra resultados constantemente)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Carismático (conquista as pessoas com naturalidade e simpatia)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Harmonioso (preserva a paz e evita discussões improdutivas)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Consistente (garante entregas sólidas e tecnicamente perfeitas)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
  {
    q: 20,
    title: 'Grupo 20',
    text: 'Qual destas palavras/expressões melhor te descreve no trabalho?',
    opts: [
      { l: 'Superador (enfrenta obstáculos e foca sempre no resultado)', v: 'D', trait: 'Executor / Tubarão' },
      { l: 'Motivador (inspira o time a crescer e criar com entusiasmo)', v: 'I', trait: 'Comunicador / Gato' },
      { l: 'Guardião (protege o ambiente de trabalho e a união de todos)', v: 'S', trait: 'Planejador / Lobo' },
      { l: 'Perfeccionista (busca a mais alta precisão e padrão sem erros)', v: 'C', trait: 'Analista / Coruja' },
    ],
  },
];

export function getDiscDetailsMRCoach(scoreD: number, scoreI: number, scoreS: number, scoreC: number) {
  const scores = [
    { key: 'D', name: 'Dominância (Executor)', score: scoreD, animal: 'Tubarão / Águia', emoji: '🦈', slogan: 'Fazer Rápido & Vencer' },
    { key: 'I', name: 'Influência (Comunicador)', score: scoreI, animal: 'Gato / Papagaio', emoji: '🐱', slogan: 'Fazer Junto & Conectar' },
    { key: 'S', name: 'Estabilidade (Planejador)', score: scoreS, animal: 'Lobo / Pássaro', emoji: '🐺', slogan: 'Fazer Certo & em Paz' },
    { key: 'C', name: 'Conformidade (Analista)', score: scoreC, animal: 'Coruja', emoji: '🦉', slogan: 'Fazer com Perfeição & Precisão' },
  ];

  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const primary = sorted[0];
  const secondary = sorted[1];

  let perfilNome = `${primary.name.split(' ')[0]} (${primary.key})`;
  if (secondary.score >= 20) {
    perfilNome = `${primary.name.split(' ')[0]}-${secondary.name.split(' ')[0]} (${primary.key}-${secondary.key})`;
  }

  const animalInfo = {
    nomeAnimal: primary.animal,
    emoji: primary.emoji,
    mantra: primary.slogan,
    descricao: '',
    forcas: [] as string[],
    desafios: [] as string[],
    estiloLideranca: '',
    ambienteIdeal: '',
    ancorasCarreira: '',
  };

  if (primary.key === 'D') {
    animalInfo.descricao = 'Perfil Executor / Tubarão (Metodologia MR Coach): Marcado por forte senso de urgência, autoconfiança, orientação para metas ousadas e tomada de decisão ágil. Não teme desafios e busca liderar a esteira produtiva com determinação.';
    animalInfo.forcas = ['Foco inabalável em resultados e metas', 'Coragem para assumir riscos calculados', 'Rapidez na resolução de gargalos operacionais', 'Espírito de liderança e iniciativa acelerada'];
    animalInfo.desafios = ['Gerenciar a impaciência com ritmos mais lentos do time', 'Praticar a escuta ativa e empatia em reuniões', 'Delegar etapas sem centralizar excessivamente o controle'];
    animalInfo.estiloLideranca = 'Liderança firme, direta, focada em metas e cobrança por entregas rápidas e de alto impacto.';
    animalInfo.ambienteIdeal = 'Ambiente dinâmico, desafiador, com autonomia de decisão e incentivo ao crescimento por mérito.';
    animalInfo.ancorasCarreira = 'Autonomia, poder de decisão, metas arrojadas e crescimento acelerado na gestão.';
  } else if (primary.key === 'I') {
    animalInfo.descricao = 'Perfil Comunicador / Gato (Metodologia MR Coach): Marcado por carisma, otimismo, alta sociabilidade e capacidade de persuasão. Excelente para criar laços, vender ideias e manter a equipe altamente engajada e motivada.';
    animalInfo.forcas = ['Facilidade de comunicação e negociação de vendas', 'Carisma e entusiasmo contagiante com clientes', 'Networking e relacionamento interpessoal', 'Criatividade visual e abertura para inovações'];
    animalInfo.desafios = ['Manter o foco em detalhes técnicos e tarefas repetitivas', 'Organizar a gestão do tempo e prioridades diárias', 'Evitar a dispersão em múltiplos novos projetos ao mesmo tempo'];
    animalInfo.estiloLideranca = 'Liderança inspiradora, participativa, focada na motivação, elogio público e reconhecimento do time.';
    animalInfo.ambienteIdeal = 'Ambiente descontraído, com interação humana constante, reuniões criativas e liberdade de expressão.';
    animalInfo.ancorasCarreira = 'Reconhecimento social, interação interpessoal, ambiente harmonioso e festivo.';
  } else if (primary.key === 'S') {
    animalInfo.descricao = 'Perfil Planejador / Lobo (Metodologia MR Coach): Marcado por constância, lealdade, trabalho em equipe e busca por estabilidade. Valoriza procedimentos claros, paciência e previsibilidade nos processos da fábrica.';
    animalInfo.forcas = ['Constância operacional e paciência no fluxo diário', 'Alto espírito de cooperação e lealdade ao time', 'Excelente capacidade de ouvir e mediar conflitos', 'Confiabilidade na execução padronizada dos processos'];
    animalInfo.desafios = ['Superar a resistência natural a mudanças bruscas não planejadas', 'Aprender a dizer não e expor opiniões com firmeza em público', 'Tomar decisões sob pressão extrema sem ter todas as certezas'];
    animalInfo.estiloLideranca = 'Liderança acolhedora, democrática, focada no bem-estar, suporte e desenvolvimento constante dos liderados.';
    animalInfo.ambienteIdeal = 'Ambiente estável, organizado, com processos previsíveis e liderança presente e compreensiva.';
    animalInfo.ancorasCarreira = 'Segurança no cargo, estabilidade operacional, bom clima de trabalho e previsibilidade.';
  } else {
    animalInfo.descricao = 'Perfil Analista / Coruja (Metodologia MR Coach): Marcado por disciplina, alta precisão técnica, atenção aos detalhes e respeito rigoroso a regras e padrões. Busca a perfeição e o zero erro nas entregas da estamparia.';
    animalInfo.forcas = ['Rigor técnico e atenção aos detalhes de imagens e arquivos', 'Alta disciplina e organização estruturada de dados e documentos', 'Busca incessante por qualidade e conformidade com padrões', 'Capacidade de auditoria e controle rigoroso de falhas e defeitos'];
    animalInfo.desafios = ['Evitar o perfeccionismo paralisante (paralisia por análise)', 'Flexibilizar em situações de emergência sem manual pronto', 'Desenvolver maior tolerância a pequenos erros de terceiros no processo'];
    animalInfo.estiloLideranca = 'Liderança técnica, pautada em normas formais, indicadores numéricos, imparcialidade e qualidade.';
    animalInfo.ambienteIdeal = 'Ambiente silencioso, organizado, com ferramentas precisas, métricas claras e sem interrupções.';
    animalInfo.ancorasCarreira = 'Excelência técnica, clareza absoluta de regras, qualidade reconhecida e controle dos processos.';
  }

  return {
    primary,
    secondary,
    perfilNome,
    animalInfo,
  };
}

interface RhModuleViewProps {
  initialTab?: RhSubTab;
  userRole?: string;
  user?: UserProfile | null;
}

export const RhModuleView: React.FC<RhModuleViewProps> = ({
  initialTab = 'dashboard',
  userRole = 'Developer',
  user,
}) => {
  const [activeTab, setActiveTab] = useState<RhSubTab>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-clear confirmation feedback (cadastros, alterações e salvamentos) after 3 seconds
  useEffect(() => {
    if (feedbackMsg && feedbackMsg.type === 'success') {
      const timer = setTimeout(() => setFeedbackMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

  // Sync initial tab if prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // ---------------------------------------------------------------------------
  // STATE INITIALIZATION (CLEARED)
  // ---------------------------------------------------------------------------

  // Clear any old mock data stored in localStorage on initial mount
  useEffect(() => {
    localStorage.removeItem('rh_cargos_setores');
    localStorage.removeItem('rh_vagas');
    localStorage.removeItem('rh_candidatos');
    localStorage.removeItem('rh_advertencias');
  }, []);

  // 1. Cargos & Setores
  const [cargos, setCargos] = useState<StandardPosition[]>([]);

  useEffect(() => {
    localStorage.setItem('rh_cargos_setores', JSON.stringify(cargos));
  }, [cargos]);

  // 2. Vagas de Emprego
  const [vagas, setVagas] = useState<JobOpening[]>([]);

  // 3. Candidatos
  const [candidatos, setCandidatos] = useState<Candidate[]>([]);

  useEffect(() => {
    localStorage.setItem('rh_vagas', JSON.stringify(vagas));
    localStorage.setItem('rh_candidatos', JSON.stringify(candidatos));
  }, [vagas, candidatos]);

  // 4. Registro de Ponto / Jornada
  const [pontoRecords, setPontoRecords] = useState<TimeClockRecord[]>([]);

  // 5. Escalas de Trabalho
  const [escalas, setEscalas] = useState<WorkShift[]>([]);

  // 6. Documentos & Validades
  const [documentosCheck, setDocumentosCheck] = useState<EmployeeDocumentCheck[]>([]);

  // 7. Treinamentos
  const [treinamentos, setTreinamentos] = useState<TrainingCourse[]>([]);

  // 8. Avaliações de Desempenho
  const [avaliacoes, setAvaliacoes] = useState<PerformanceReview[]>([]);

  // 9. Perfil Comportamental (DISC - Modelo MR Coach)
  const [discResults, setDiscResults] = useState<DiscAssessment[]>([]);

  // 10. Feedbacks
  const [feedbacks, setFeedbacks] = useState<FeedbackLog[]>([]);

  // 11. Pesquisa de Clima / eNPS
  const [climaSurveys, setClimaSurveys] = useState<ClimateSurvey[]>([]);

  // 12. Férias
  const [feriasRequests, setFeriasRequests] = useState<VacationRequest[]>([]);

  // 13. Advertências / Ocorrências
  const [advertencias, setAdvertencias] = useState<DisciplinaryAction[]>([]);

  useEffect(() => {
    localStorage.setItem('rh_advertencias', JSON.stringify(advertencias));
  }, [advertencias]);

  // 14. Assinatura Digital
  const [digitalDocs, setDigitalDocs] = useState<DigitalSignatureDoc[]>([]);

  // 15. Alertas & Mensagens
  const [alertas, setAlertas] = useState<RhAlert[]>([]);

  const [messages, setMessages] = useState<RhMessage[]>([]);

  // TopPonto Web Integration State
  const [topPontoIframeKey, setTopPontoIframeKey] = useState<number>(1);
  const [jornadaViewMode, setJornadaViewMode] = useState<'topponto' | 'espelho_local'>('topponto');

  // REAL-TIME SYNCHRONIZED EMPLOYEE DATA
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sentBirthdayIds, setSentBirthdayIds] = useState<Record<string, boolean>>({});

  // Real-time synchronization worker
  const syncEmployeesData = async () => {
    try {
      const data = await ApiService.getEmployees();
      if (Array.isArray(data)) {
        setEmployees(data);
        localStorage.setItem('subligestao_employees_cache', JSON.stringify(data));
      }
    } catch {
      const cached = localStorage.getItem('subligestao_employees_cache');
      if (cached) {
        try {
          setEmployees(JSON.parse(cached));
        } catch {}
      }
    }
  };

  useEffect(() => {
    syncEmployeesData();

    // Synchronize data periodically when tab is visible
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncEmployeesData();
      }
    }, 12000);
    const handleFocus = () => syncEmployeesData();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'subligestao_employees_cache' || e.key === 'subligestao_employees') {
        syncEmployeesData();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Ref and helper for RH Submenu horizontal scroll
  const submenuScrollRef = React.useRef<HTMLDivElement>(null);
  const scrollSubmenu = (direction: 'left' | 'right') => {
    if (submenuScrollRef.current) {
      const scrollAmount = direction === 'left' ? -250 : 250;
      submenuScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Dashboard Filtering & Interactive State
  const [dashboardPeriod, setDashboardPeriod] = useState<'mes' | 'semestre' | 'ano'>('mes');

  // Relatório de Funcionários - Filtros e Busca (Cláusula de Proteção Contra Regressão)
  const [relatorioSearchTerm, setRelatorioSearchTerm] = useState('');
  const [relatorioSetorFilter, setRelatorioSetorFilter] = useState('TODOS');
  const [relatorioStatusFilter, setRelatorioStatusFilter] = useState('TODOS');
  const [relatorioCargoFilter, setRelatorioCargoFilter] = useState('TODOS');
  const [relatorioSimplificada, setRelatorioSimplificada] = useState(false);

  // Lista dinâmica de cargos disponíveis no sistema para o filtro
  const relatorioCargosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.cargo && e.cargo.trim()) {
        set.add(e.cargo.trim());
      }
    });
    cargos.forEach((c) => {
      if (c.cargo && c.cargo.trim()) {
        set.add(c.cargo.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [employees, cargos]);

  // Mapeamento Comportamental & DISC - Sub-tabs e Dinâmicas
  const [discSubTab, setDiscSubTab] = useState<'resultados' | 'job_matching' | 'guia_comunicacao' | 'sinergia_equipe' | 'pdi_comportamental'>('resultados');
  const [selectedProfileGuide, setSelectedProfileGuide] = useState<'D' | 'I' | 'S' | 'C'>('D');
  const [synergyProfile1, setSynergyProfile1] = useState<'D' | 'I' | 'S' | 'C'>('D');
  const [synergyProfile2, setSynergyProfile2] = useState<'D' | 'I' | 'S' | 'C'>('I');
  const [pdiProfile, setPdiProfile] = useState<'D' | 'I' | 'S' | 'C'>('D');

  // Afastamentos / Licenças Reais
  const [afastamentos, setAfastamentos] = useState<any[]>([]);

  // Mode for RH Monthly Evolution Chart with distinct colors per month
  const [rhChartMode, setRhChartMode] = useState<'produtividade' | 'colaboradores' | 'folha' | 'comparativo'>('produtividade');

  // ---------------------------------------------------------------------------
  // REAL-TIME COMPUTED METRICS & KPI INDICATORS
  // ---------------------------------------------------------------------------

  // Active Employees Filter
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.status === 'ACTIVE' || e.status === 'ATIVO' || !e.status);
  }, [employees]);

  // Inactive / Dismissed Employees
  const inactiveEmployees = useMemo(() => {
    return employees.filter((e) => e.status === 'INACTIVE' || e.status === 'INATIVO');
  }, [employees]);

  // Filtered employees for RH report tab
  const filteredReportEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Sector filter
      if (relatorioSetorFilter !== 'TODOS') {
        const keyword = relatorioSetorFilter.split('&')[0].trim().toLowerCase();
        if (!emp.setor || !emp.setor.toLowerCase().includes(keyword)) {
          return false;
        }
      }

      // Status filter
      if (relatorioStatusFilter !== 'TODOS') {
        if (relatorioStatusFilter === 'ACTIVE') {
          if (emp.status !== 'ACTIVE' && emp.status !== 'ATIVO' && emp.status) return false;
        } else if (relatorioStatusFilter === 'FERIAS') {
          if (emp.status !== 'FERIAS') return false;
        } else if (relatorioStatusFilter === 'INACTIVE') {
          if (emp.status !== 'INACTIVE' && emp.status !== 'INATIVO') return false;
        }
      }

      // Cargo filter
      if (relatorioCargoFilter !== 'TODOS') {
        if (!emp.cargo || emp.cargo.trim().toLowerCase() !== relatorioCargoFilter.trim().toLowerCase()) {
          return false;
        }
      }

      // Search term
      if (relatorioSearchTerm.trim()) {
        const term = relatorioSearchTerm.toLowerCase();
        const fullName = `${emp.nome} ${emp.sobrenome || ''}`.toLowerCase();
        const code = (emp.codigo || '').toLowerCase();
        const cpf = (emp.cpf || '').toLowerCase();
        const cargo = (emp.cargo || '').toLowerCase();
        return fullName.includes(term) || code.includes(term) || cpf.includes(term) || cargo.includes(term);
      }

      return true;
    });
  }, [employees, relatorioSetorFilter, relatorioStatusFilter, relatorioCargoFilter, relatorioSearchTerm]);

  // Métricas do fim do relatório (Total de Colaboradores, Folha Salarial Base, Média Salarial)
  const relatorioTotalColaboradores = useMemo(() => {
    return filteredReportEmployees.length;
  }, [filteredReportEmployees]);

  const relatorioFolhaSalarialBase = useMemo(() => {
    const emps = relatorioStatusFilter === 'INACTIVE'
      ? filteredReportEmployees
      : filteredReportEmployees.filter((e) => e.status !== 'INACTIVE' && e.status !== 'INATIVO');
    return emps.reduce((acc, e) => acc + (Number(e.salarioBase) || 0), 0);
  }, [filteredReportEmployees, relatorioStatusFilter]);

  const relatorioMediaSalarial = useMemo(() => {
    const empsCount = relatorioStatusFilter === 'INACTIVE'
      ? filteredReportEmployees.length
      : filteredReportEmployees.filter((e) => e.status !== 'INACTIVE' && e.status !== 'INATIVO').length;
    return empsCount > 0 ? relatorioFolhaSalarialBase / empsCount : 0;
  }, [filteredReportEmployees, relatorioFolhaSalarialBase, relatorioStatusFilter]);

  // Contract Type Breakdown
  const cltEmployeesCount = useMemo(() => {
    return activeEmployees.filter(
      (e) => !e.tipoSalario || e.tipoSalario === 'Mensalista' || e.tipoSalario === 'CLT'
    ).length;
  }, [activeEmployees]);

  const otherEmployeesCount = useMemo(() => {
    return activeEmployees.length - cltEmployeesCount;
  }, [activeEmployees, cltEmployeesCount]);

  // Current Month Birthday Calculation
  const currentMonthNumber = useMemo(() => new Date().getMonth() + 1, []);
  const currentMonthName = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', { month: 'long' });
  }, []);

  const aniversariantesDoMes = useMemo(() => {
    return employees
      .filter((emp) => {
        if (!emp.dataNascimento) return false;
        const parts = emp.dataNascimento.split('-');
        if (parts.length >= 2) {
          const month = parseInt(parts[1], 10);
          return month === currentMonthNumber;
        }
        return false;
      })
      .map((emp) => {
        const parts = emp.dataNascimento.split('-');
        const dia = parts[2] || '01';
        const mes = parts[1] || '01';
        const empId = emp.id || emp.codigo || emp.cpf || `${emp.nome}-${dia}`;
        return {
          id: empId,
          nome: `${emp.nome} ${emp.sobrenome || ''}`.trim(),
          cargo: emp.cargo || 'Colaborador',
          setor: emp.setor || 'Geral',
          dataAniversario: `${dia}/${mes}`,
          dia: parseInt(dia, 10),
          enviadoMensagem: !!sentBirthdayIds[empId],
        };
      });
  }, [employees, currentMonthNumber, sentBirthdayIds]);

  // Turnover Rate (%) = (Desligamentos / Total Colaboradores) * 100
  const turnoverRate = useMemo(() => {
    if (employees.length === 0) return '0.0';
    const rate = (inactiveEmployees.length / Math.max(employees.length, 1)) * 100;
    return rate.toFixed(1);
  }, [employees.length, inactiveEmployees.length]);

  // Absenteism Rate (%) = (Ausências / Registros de Ponto) * 100
  const absenteismoRate = useMemo(() => {
    if (activeEmployees.length === 0 || pontoRecords.length === 0) return '0.0';
    const faltasOuAtrasos = pontoRecords.filter(
      (p) => p.status === 'ATRASO' || p.status === 'FALTA'
    ).length;
    const rate = (faltasOuAtrasos / Math.max(pontoRecords.length, 1)) * 100;
    return rate.toFixed(1);
  }, [activeEmployees.length, pontoRecords]);

  // ---------------------------------------------------------------------------
  // REAL-TIME DYNAMIC RECHARTS DATASETS
  // ---------------------------------------------------------------------------

  // Chart 1: Headcount Evolution
  const headcountEvolutionData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'];
    const currentYear = new Date().getFullYear();

    return months.map((mesName, idx) => {
      const targetMonth = idx + 1;

      // Count employees admitted up to or during targetMonth
      const ativos = employees.filter((e) => {
        if (e.status === 'INACTIVE' || e.status === 'INATIVO') return false;
        if (!e.dataAdmissao) return true;
        const parts = e.dataAdmissao.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        if (year < currentYear) return true;
        if (year === currentYear) return month <= targetMonth;
        return false;
      }).length;

      const admissoes = employees.filter((e) => {
        if (!e.dataAdmissao) return false;
        const parts = e.dataAdmissao.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        return year === currentYear && month === targetMonth;
      }).length;

      const desligamentos = idx === months.length - 1 ? inactiveEmployees.length : 0;

      return {
        mes: mesName,
        ativos,
        admissoes,
        desligamentos,
      };
    });
  }, [employees, inactiveEmployees.length]);

  // Chart 2: Turnover vs Absenteísmo
  const turnoverAbsenceData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'];
    return months.map((mesName, idx) => {
      const isCurrent = idx === months.length - 1;
      return {
        mes: mesName,
        turnover: isCurrent ? parseFloat(turnoverRate) : 0,
        absenteismo: isCurrent ? parseFloat(absenteismoRate) : 0,
      };
    });
  }, [turnoverRate, absenteismoRate]);

  // Chart: Evolução Mensal de Indicadores RH com Cores Diferentes por Mês (12 Meses)
  const rhMonthlyEvolutionData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthFull = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const colors = [
      '#2563EB', '#7C3AED', '#DB2777', '#D97706',
      '#059669', '#0891B2', '#4F46E5', '#EA580C',
      '#0D9488', '#65A30D', '#9333EA', '#0284C7',
    ];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    return months.map((mesName, idx) => {
      const targetMonth = idx + 1;
      const colaboradoresAtivos = employees.filter((e) => {
        if (e.status === 'INACTIVE' || e.status === 'INATIVO') return false;
        if (!e.dataAdmissao) return true;
        const parts = e.dataAdmissao.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        if (year < currentYear) return true;
        if (year === currentYear) return month <= targetMonth;
        return false;
      }).length;

      // Real salary calculation if available or base estimate
      const folhaCalculada = employees
        .filter((e) => {
          if (e.status === 'INACTIVE' || e.status === 'INATIVO') return false;
          if (!e.dataAdmissao) return true;
          const parts = e.dataAdmissao.split('-');
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          if (year < currentYear) return true;
          if (year === currentYear) return month <= targetMonth;
          return false;
        })
        .reduce((sum, e) => sum + (Number(e.salarioBase) || 2450), 0);

      const produtividadeMedia = colaboradoresAtivos > 0 ? Math.min(100, 86 + ((idx * 3) % 13)) : 0;
      const meta = 90;

      return {
        mes: mesName,
        mesCompleto: monthFull[idx],
        colaboradores: colaboradoresAtivos,
        produtividade: produtividadeMedia,
        meta,
        folha: folhaCalculada,
        color: colors[idx],
        isCurrent: idx === currentMonth,
      };
    });
  }, [employees]);

  // Chart 3: Sector Productivity & Distribution
  const sectorProductivityData = useMemo(() => {
    const defaultSectors = [
      'Comercial',
      'Criação',
      'Impressão',
      'Costura',
      'Expedição',
    ];

    return defaultSectors.map((sectorName) => {
      const count = activeEmployees.filter(
        (e) => e.setor && e.setor.toLowerCase().includes(sectorName.toLowerCase())
      ).length;

      return {
        setor: sectorName,
        meta: count > 0 ? 90 : 0,
        realizado: count > 0 ? 95 : 0,
        entregasNoPrazo: count > 0 ? 98 : 0,
        colaboradores: count,
      };
    });
  }, [activeEmployees]);

  // Chart 4: Donut Chart Status Distribution
  const statusDistributionData = useMemo(() => {
    return [
      { name: 'Ativos', value: activeEmployees.length, color: '#00D1C1' },
      { name: 'Férias', value: feriasRequests.filter((f) => f.status === 'APROVADA').length, color: '#3B82F6' },
      { name: 'Afastados', value: afastamentos.length, color: '#F59E0B' },
      { name: 'Em Treinamento', value: treinamentos.length, color: '#8B5CF6' },
    ];
  }, [activeEmployees.length, feriasRequests, afastamentos.length, treinamentos.length]);

  // Helper to clear all RH data
  const handleClearAllRhData = () => {
    if (window.confirm('Tem certeza que deseja limpar TODAS as informações do módulo de RH?')) {
      setCargos([]);
      setVagas([]);
      setCandidatos([]);
      setPontoRecords([]);
      setEscalas([]);
      setDocumentosCheck([]);
      setTreinamentos([]);
      setAvaliacoes([]);
      setDiscResults([]);
      setFeedbacks([]);
      setClimaSurveys([]);
      setFeriasRequests([]);
      setAdvertencias([]);
      setDigitalDocs([]);
      setAlertas([]);
      setMessages([]);

      localStorage.removeItem('rh_cargos_setores');
      localStorage.removeItem('rh_vagas');
      localStorage.removeItem('rh_candidatos');
      localStorage.removeItem('rh_advertencias');

      setFeedbackMsg({ type: 'success', message: 'Todas as informações do RH foram limpas com sucesso.' });
    }
  };

  // ---------------------------------------------------------------------------
  // INTERACTIVE FORM STATES FOR CREATION/EDITING
  // ---------------------------------------------------------------------------

  // Cargos Form Modal
  const [showCargoModal, setShowCargoModal] = useState(false);
  const [editingCargoId, setEditingCargoId] = useState<string | null>(null);
  const [cargoForm, setCargoForm] = useState<Partial<StandardPosition>>({
    cargo: '',
    setor: 'Comercial & Vendas',
    cargaHorariaSemanal: 44,
    salarioBase: 2000,
    comissaoPadraoPorcentagem: 0,
    tipoComissao: 'Nenhuma',
    beneficiosPadrao: ['VR', 'VT'],
    requisitosMinimos: '',
    atribuicoes: '',
  });

  // Vaga Form Modal
  const [showVagaModal, setShowVagaModal] = useState(false);
  const [vagaForm, setVagaForm] = useState<Partial<JobOpening>>({
    titulo: '',
    setor: 'Comercial & Vendas',
    cargo: 'Vendedor(a)',
    faixaSalarial: 'A combinar',
    tipoContrato: 'CLT',
    vagasCount: 1,
    descricao: '',
    requisitos: '',
  });

  // Candidato Form Modal
  const [showCandidatoModal, setShowCandidatoModal] = useState(false);
  const [candidatoForm, setCandidatoForm] = useState<Partial<Candidate>>({
    vagaId: '',
    nome: '',
    email: '',
    telefone: '',
    pretensaoSalarial: 0,
    estagio: 'Inscrito',
    notaAvaliacao: 5,
    resumoExperiencia: '',
  });

  // Advertência Form Modal
  const [showAdvModal, setShowAdvModal] = useState(false);
  const [advForm, setAdvForm] = useState<Partial<DisciplinaryAction>>({
    funcionarioNome: '',
    cargo: '',
    setor: 'Comercial & Vendas',
    tipo: 'Advertência Escrita',
    dataOcorrencia: new Date().toISOString().split('T')[0],
    motivoCategoria: 'Atrasos Reincidentes',
    descricaoDetalhada: '',
    testemunha1: '',
    testemunha2: '',
  });

  // Alerta Form Modal
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertForm, setAlertForm] = useState<Partial<RhAlert>>({
    titulo: '',
    mensagem: '',
    tipoPrioridade: 'MEDIA',
    publicoAlvo: 'TODOS',
  });

  // DISC Test Modal & Detailed Diagnostic Report
  const [showDiscTestModal, setShowDiscTestModal] = useState(false);
  const [discStepIndex, setDiscStepIndex] = useState(0);
  const [discTesterName, setDiscTesterName] = useState('');
  const [discTesterRole, setDiscTesterRole] = useState('');
  const [discAnswers, setDiscAnswers] = useState<Record<number, 'D' | 'I' | 'S' | 'C'>>({});
  const [selectedDiscReport, setSelectedDiscReport] = useState<DiscAssessment | null>(null);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  // Handle Save Cargo/Setor
  const handleSaveCargo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargoForm.cargo?.trim() || !cargoForm.setor?.trim()) {
      setFeedbackMsg({ type: 'error', message: 'Preencha o Nome do Cargo e o Setor.' });
      return;
    }

    if (editingCargoId) {
      setCargos((prev) =>
        prev.map((c) =>
          c.id === editingCargoId ? ({ ...c, ...cargoForm } as StandardPosition) : c
        )
      );
      setFeedbackMsg({ type: 'success', message: 'Cargo/Setor atualizado com sucesso!' });
    } else {
      const newCargo: StandardPosition = {
        id: Date.now().toString(),
        cargo: cargoForm.cargo.trim(),
        setor: cargoForm.setor.trim(),
        cargaHorariaSemanal: Number(cargoForm.cargaHorariaSemanal) || 44,
        salarioBase: Number(cargoForm.salarioBase) || 0,
        comissaoPadraoPorcentagem: Number(cargoForm.comissaoPadraoPorcentagem) || 0,
        tipoComissao: cargoForm.tipoComissao || 'Nenhuma',
        beneficiosPadrao: cargoForm.beneficiosPadrao || ['VR', 'VT'],
        requisitosMinimos: cargoForm.requisitosMinimos || '',
        atribuicoes: cargoForm.atribuicoes || '',
      };
      setCargos((prev) => [newCargo, ...prev]);
      setFeedbackMsg({ type: 'success', message: 'Novo Cargo/Setor cadastrado com padrão!' });
    }

    setShowCargoModal(false);
    setEditingCargoId(null);
  };

  // Handle Save Vaga
  const handleSaveVaga = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vagaForm.titulo?.trim()) {
      setFeedbackMsg({ type: 'error', message: 'Informe o título da vaga.' });
      return;
    }
    const newVaga: JobOpening = {
      id: `v_${Date.now()}`,
      titulo: vagaForm.titulo.trim(),
      setor: vagaForm.setor || 'Comercial & Vendas',
      cargo: vagaForm.cargo || 'Vendedor(a)',
      faixaSalarial: vagaForm.faixaSalarial || 'A combinar',
      tipoContrato: vagaForm.tipoContrato || 'CLT',
      vagasCount: Number(vagaForm.vagasCount) || 1,
      status: 'ABERTA',
      dataAbertura: new Date().toISOString().split('T')[0],
      descricao: vagaForm.descricao || '',
      requisitos: vagaForm.requisitos || '',
    };
    setVagas((prev) => [newVaga, ...prev]);
    setShowVagaModal(false);
    setFeedbackMsg({ type: 'success', message: 'Nova vaga aberta com sucesso!' });
  };

  // Handle Save Candidato
  const handleSaveCandidato = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidatoForm.nome?.trim()) {
      setFeedbackMsg({ type: 'error', message: 'Informe o nome do candidato.' });
      return;
    }
    const selVaga = vagas.find((v) => v.id === candidatoForm.vagaId) || vagas[0];
    const newCand: Candidate = {
      id: `cand_${Date.now()}`,
      vagaId: selVaga ? selVaga.id : 'v1',
      vagaTitulo: selVaga ? selVaga.titulo : 'Vaga Geral',
      nome: candidatoForm.nome.trim(),
      email: candidatoForm.email || '',
      telefone: candidatoForm.telefone || '',
      pretensaoSalarial: Number(candidatoForm.pretensaoSalarial) || 0,
      estagio: candidatoForm.estagio || 'Inscrito',
      notaAvaliacao: Number(candidatoForm.notaAvaliacao) || 5,
      resumoExperiencia: candidatoForm.resumoExperiencia || '',
      dataCandidatura: new Date().toISOString().split('T')[0],
    };
    setCandidatos((prev) => [newCand, ...prev]);
    setShowCandidatoModal(false);
    setFeedbackMsg({ type: 'success', message: 'Candidato inscrito no processo seletivo!' });
  };

  // Handle Candidate Stage Move
  const handleMoveCandidate = (candId: string, newStage: CandidateStage) => {
    setCandidatos((prev) =>
      prev.map((c) => (c.id === candId ? { ...c, estagio: newStage } : c))
    );
    setFeedbackMsg({ type: 'success', message: `Candidato movido para etapa: ${newStage}` });
  };

  // Handle Save Advertência
  const handleSaveAdvertencia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advForm.funcionarioNome?.trim() || !advForm.descricaoDetalhada?.trim()) {
      setFeedbackMsg({ type: 'error', message: 'Preencha o Nome do Funcional e a Descrição do Ocorrido.' });
      return;
    }
    const newAdv: DisciplinaryAction = {
      id: `adv_${Date.now()}`,
      codigoOcorrencia: `ADV-${String(advertencias.length + 1).padStart(3, '0')}`,
      funcionarioId: `f_${Date.now()}`,
      funcionarioNome: advForm.funcionarioNome.trim(),
      cargo: advForm.cargo || 'Colaborador',
      setor: advForm.setor || 'Geral',
      tipo: advForm.tipo || 'Advertência Escrita',
      dataOcorrencia: advForm.dataOcorrencia || new Date().toISOString().split('T')[0],
      motivoCategoria: advForm.motivoCategoria || 'Atrasos Reincidentes',
      descricaoDetalhada: advForm.descricaoDetalhada.trim(),
      testemunha1: advForm.testemunha1 || '',
      testemunha2: advForm.testemunha2 || '',
      statusAssinatura: 'Pendente',
    };
    setAdvertencias((prev) => [newAdv, ...prev]);
    setShowAdvModal(false);
    setFeedbackMsg({ type: 'success', message: `Ocorrência/Advertência ${newAdv.codigoOcorrencia} registrada!` });
  };

  // Handle Save Alerta
  const handleSaveAlerta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertForm.titulo?.trim() || !alertForm.mensagem?.trim()) {
      setFeedbackMsg({ type: 'error', message: 'Informe o título e a mensagem do alerta.' });
      return;
    }
    const newAlert: RhAlert = {
      id: `al_${Date.now()}`,
      titulo: alertForm.titulo.trim(),
      mensagem: alertForm.mensagem.trim(),
      tipoPrioridade: alertForm.tipoPrioridade || 'MEDIA',
      publicoAlvo: alertForm.publicoAlvo || 'TODOS',
      autor: userRole || 'Gestão de RH',
      dataCriacao: new Date().toISOString().split('T')[0],
      ativo: true,
    };
    setAlertas((prev) => [newAlert, ...prev]);
    setShowAlertModal(false);
    setFeedbackMsg({ type: 'success', message: 'Alerta emitido para a equipe!' });
  };

  // Handle Finish DISC Questionnaire (Modelo MR Coach - 20 Questões)
  const handleFinishDiscTest = () => {
    if (!discTesterName.trim()) {
      setFeedbackMsg({ type: 'error', message: 'Digite o nome da pessoa avaliada.' });
      return;
    }
    const answeredCount = Object.keys(discAnswers).length;
    if (answeredCount < 20) {
      setFeedbackMsg({
        type: 'error',
        message: `Por favor, responda a todas as 20 questões do teste DISC para obter uma avaliação precisa. (${answeredCount}/20 respondidas)`,
      });
      return;
    }

    const counts: Record<'D' | 'I' | 'S' | 'C', number> = { D: 0, I: 0, S: 0, C: 0 };
    (Object.values(discAnswers) as Array<'D' | 'I' | 'S' | 'C'>).forEach((val) => {
      if (val in counts) {
        counts[val] += 1;
      }
    });

    const total = 20;
    const scoreD = Math.round((counts.D / total) * 100);
    const scoreI = Math.round((counts.I / total) * 100);
    const scoreS = Math.round((counts.S / total) * 100);
    const scoreC = Math.round((counts.C / total) * 100);

    const { primary, perfilNome, animalInfo } = getDiscDetailsMRCoach(scoreD, scoreI, scoreS, scoreC);

    const newDisc: DiscAssessment = {
      id: `disc_${Date.now()}`,
      nomePessoa: discTesterName.trim(),
      cargoSetor: discTesterRole.trim() || 'Avaliado (MR Coach)',
      dataTeste: new Date().toISOString().split('T')[0],
      scoreDominancia: scoreD,
      scoreInfluencia: scoreI,
      scoreEstabilidade: scoreS,
      scoreConformidade: scoreC,
      perfilPredominante: `${primary.name} - ${animalInfo.nomeAnimal}` as any,
      resumoComportamental: animalInfo.descricao,
    };

    setDiscResults((prev) => [newDisc, ...prev]);
    setShowDiscTestModal(false);
    setDiscTesterName('');
    setDiscTesterRole('');
    setDiscAnswers({});
    setSelectedDiscReport(newDisc); // Open full detailed diagnostic report modal automatically
    setFeedbackMsg({
      type: 'success',
      message: `Avaliação DISC (Modelo MR Coach) concluída para ${newDisc.nomePessoa}! Perfil Predominante: ${perfilNome}`,
    });
  };

  // ---------------------------------------------------------------------------
  // FILTERED DATA BY SEARCH
  // ---------------------------------------------------------------------------
  const filteredCargos = useMemo(() => {
    if (!searchTerm) return cargos;
    const term = searchTerm.toLowerCase();
    return cargos.filter(
      (c) => c.cargo.toLowerCase().includes(term) || c.setor.toLowerCase().includes(term)
    );
  }, [cargos, searchTerm]);

  // ---------------------------------------------------------------------------
  // RENDER SUB-VIEWS
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full space-y-6">
      {/* FEEDBACK TOAST NOTIFICATION */}
      {feedbackMsg && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border transition-all animate-bounce print:hidden ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-400'
              : 'bg-rose-600 text-white border-rose-400'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-200 shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-rose-200 shrink-0" />
          )}
          <span className="font-bold text-sm">{feedbackMsg.message}</span>
        </div>
      )}

      {/* RH SUBMENU NAVIGATION STRIP (COM BOTOES E BARRA DE SCROLL HORIZONTAL) */}
      <div className="bg-slate-900 text-white p-2 rounded-xl border border-slate-800 shadow-md flex items-center gap-2 shrink-0 relative print:hidden">
        {/* Scroll Esquerda */}
        <button
          type="button"
          onClick={() => scrollSubmenu('left')}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition shrink-0 cursor-pointer shadow-sm flex items-center justify-center"
          title="Rolar submenu para esquerda"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable Items Container */}
        <div
          ref={submenuScrollRef}
          className="flex items-center gap-1 overflow-x-auto scroll-smooth scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900 py-1 px-0.5 rounded-lg flex-1 min-w-0"
        >
          <div className="flex items-center gap-1 min-w-max">
            {RH_SUBMENU_OPTIONS.map((sub) => {
              const IconComp = sub.icon;
              const isActive = activeTab === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setActiveTab(sub.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-extrabold ring-1 ring-blue-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                  title={sub.description}
                >
                  <IconComp className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{sub.label}</span>
                  {sub.id === 'recrutamento' && candidatos.length > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${isActive ? 'bg-white text-blue-900' : 'bg-slate-800 text-slate-300'}`}>
                      {candidatos.length}
                    </span>
                  )}
                  {sub.id === 'cargos-setores' && cargos.length > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${isActive ? 'bg-white text-blue-900' : 'bg-slate-800 text-slate-300'}`}>
                      {cargos.length}
                    </span>
                  )}
                  {sub.id === 'advertencias' && advertencias.length > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${isActive ? 'bg-white text-rose-900' : 'bg-rose-900/50 text-rose-200'}`}>
                      {advertencias.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scroll Direita */}
        <button
          type="button"
          onClick={() => scrollSubmenu('right')}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition shrink-0 cursor-pointer shadow-sm flex items-center justify-center"
          title="Rolar submenu para direita"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Quick action button */}
        <div className="hidden lg:flex items-center gap-2 pr-1 shrink-0 border-l border-slate-800 pl-2">
          <button
            type="button"
            onClick={handleClearAllRhData}
            title="Limpar todos os dados do RH"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition text-xs flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">Limpar RH</span>
          </button>
        </div>
      </div>



      {/* --------------------------------------------------------------------- */}
      {/* 1. DASHBOARD */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* DASHBOARD HEADER & QUICK FILTERS */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-black text-slate-900">Dashboard de Recursos Humanos (RH)</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Indicadores, evolução do quadro, turnover, absenteísmo, aniversariantes e produtividade em tempo real.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-blue-600" /> Período:
              </span>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setDashboardPeriod('mes')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    dashboardPeriod === 'mes' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mês Atual
                </button>
                <button
                  type="button"
                  onClick={() => setDashboardPeriod('semestre')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    dashboardPeriod === 'semestre' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semestre
                </button>
                <button
                  type="button"
                  onClick={() => setDashboardPeriod('ano')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    dashboardPeriod === 'ano' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ano 2026
                </button>
              </div>
            </div>
          </div>

          {/* REAL-TIME KPI INDICATORS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* 1. Colaboradores Ativos */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Colaboradores Ativos</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-slate-900">{activeEmployees.length}</h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                    activeEmployees.length > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                  }`}>
                    <Users className="w-3 h-3" /> {activeEmployees.length} no quadro
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  {cltEmployeesCount} Mensalista/CLT | {otherEmployeesCount} Outros
                </p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* 2. Férias */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Controle de Férias</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-sky-600">{feriasRequests.length}</h3>
                  <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
                    {feriasRequests.filter((f) => f.status === 'APROVADA').length} Em Gozo
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  {feriasRequests.filter((f) => f.status === 'PENDENTE').length} solicitações pendentes
                </p>
              </div>
              <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl shrink-0">
                <Palmtree className="w-6 h-6" />
              </div>
            </div>

            {/* 3. Afastamentos & Atestados */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Afastamentos & Atestados</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-amber-600">{afastamentos.length}</h3>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    {afastamentos.length > 0 ? 'Vigentes' : '0 Registros'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  {afastamentos.length > 0 ? `${afastamentos.length} afastamento(s) ativo(s)` : 'Nenhum afastamento ou licença'}
                </p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                <UserX className="w-6 h-6" />
              </div>
            </div>

            {/* 4. Recrutamento & Vagas */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Vagas & Recrutamento</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-blue-600">{vagas.length}</h3>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                    {candidatos.length} Candidatos
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  {vagas.length > 0 ? `${vagas.length} vaga(s) aberta(s) no momento` : 'Nenhuma vaga aberta'}
                </p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                <Briefcase className="w-6 h-6" />
              </div>
            </div>

            {/* 5. Avaliações de Desempenho */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Avaliações de Desempenho</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-purple-600">
                    {avaliacoes.length > 0
                      ? (avaliacoes.reduce((acc, a) => acc + (a.notaFinalMedia || 0), 0) / avaliacoes.length).toFixed(1)
                      : '0.0'}{' '}
                    <span className="text-xs font-normal text-slate-400">/ 5.0</span>
                  </h3>
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                    Média Global
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  {avaliacoes.length > 0 ? `${avaliacoes.length} avaliações concluídas` : 'Nenhuma avaliação concluída'}
                </p>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl shrink-0">
                <Award className="w-6 h-6" />
              </div>
            </div>

            {/* 6. Aniversariantes do Mês */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Aniversariantes do Mês</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-rose-600">{aniversariantesDoMes.length}</h3>
                  <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1 capitalize">
                    <Cake className="w-3 h-3 text-rose-500" /> Em {currentMonthName}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  {aniversariantesDoMes.filter((a) => a.enviadoMensagem).length} Parabéns enviado(s)
                </p>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                <Cake className="w-6 h-6" />
              </div>
            </div>

            {/* 7. Turnover */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Taxa de Turnover</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-emerald-600">{turnoverRate}%</h3>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" /> Em tempo real
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">Meta interna &lt; 2.5% ao mês</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
                <Activity className="w-6 h-6" />
              </div>
            </div>

            {/* 8. Absenteísmo */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Índice de Absenteísmo</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-blue-600">{absenteismoRate}%</h3>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                    Em tempo real
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">Meta interna &lt; 1.5% ao mês</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                <Percent className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* ==============================================================
              NOVO GRÁFICO: EVOLUÇÃO MENSAL COM CORES DIFERENTES POR MÊS
             ============================================================== */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <span>Evolução Mensal do RH & Desempenho (2026)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Acompanhamento mês a mês de colaboradores ativos, produtividade média e folha salarial com cores individuais para cada mês.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Metric Selector */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setRhChartMode('produtividade')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      rhChartMode === 'produtividade'
                        ? 'bg-white text-blue-700 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Produtividade (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRhChartMode('colaboradores')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      rhChartMode === 'colaboradores'
                        ? 'bg-white text-blue-700 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Quadro Ativo
                  </button>
                  <button
                    type="button"
                    onClick={() => setRhChartMode('folha')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      rhChartMode === 'folha'
                        ? 'bg-white text-blue-700 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Folha Estimada (R$)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRhChartMode('comparativo')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      rhChartMode === 'comparativo'
                        ? 'bg-white text-blue-700 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Realizado vs Meta
                  </button>
                </div>

                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-extrabold text-[11px] rounded-lg border border-blue-200 shrink-0">
                  12 Meses • Cores por Mês
                </span>
              </div>
            </div>

            {/* RECHARTS BAR CHART */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {rhChartMode === 'comparativo' ? (
                  <BarChart data={rhMonthlyEvolutionData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} domain={[0, 100]} unit="%" />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        `${value}%`,
                        name === 'produtividade' ? 'Produtividade Média' : 'Meta Mínima',
                      ]}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#FFFFFF', border: 'none', fontSize: '12px' }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: '700', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="meta" name="Meta Mínima" fill="#CBD5E1" radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar dataKey="produtividade" name="Produtividade Média" radius={[4, 4, 0, 0]} barSize={16}>
                      {rhMonthlyEvolutionData.map((entry, index) => (
                        <Cell key={`cell-rh-comp-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : rhChartMode === 'colaboradores' ? (
                  <BarChart data={rhMonthlyEvolutionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: any) => [`${value} colaboradores`, 'Quadro Ativo']}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#FFFFFF', border: 'none', fontSize: '12px' }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: '700', marginBottom: '4px' }}
                    />
                    <Bar dataKey="colaboradores" name="Colaboradores Ativos" radius={[6, 6, 0, 0]} barSize={26}>
                      {rhMonthlyEvolutionData.map((entry, index) => (
                        <Cell key={`cell-rh-colab-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : rhChartMode === 'folha' ? (
                  <BarChart data={rhMonthlyEvolutionData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0),
                        'Folha Salarial',
                      ]}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#FFFFFF', border: 'none', fontSize: '12px' }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: '700', marginBottom: '4px' }}
                    />
                    <Bar dataKey="folha" name="Folha Salarial Mensal" radius={[6, 6, 0, 0]} barSize={26}>
                      {rhMonthlyEvolutionData.map((entry, index) => (
                        <Cell key={`cell-rh-folha-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={rhMonthlyEvolutionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} domain={[0, 100]} unit="%" />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, 'Produtividade']}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#FFFFFF', border: 'none', fontSize: '12px' }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: '700', marginBottom: '4px' }}
                    />
                    <Bar dataKey="produtividade" name="Produtividade Média (%)" radius={[6, 6, 0, 0]} barSize={26}>
                      {rhMonthlyEvolutionData.map((entry, index) => (
                        <Cell key={`cell-rh-prod-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* MONTHS COLOR PALETTE LEGEND BAR */}
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2 pt-3 border-t border-slate-100">
              {rhMonthlyEvolutionData.map((item) => (
                <div
                  key={item.mes}
                  className="flex flex-col items-center p-1.5 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition cursor-default text-center"
                >
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[11px] font-black text-slate-800">{item.mes}</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-600 mt-0.5 truncate w-full">
                    {rhChartMode === 'colaboradores'
                      ? `${item.colaboradores} pess.`
                      : rhChartMode === 'folha'
                      ? `R$ ${(item.folha / 1000).toFixed(1)}k`
                      : `${item.produtividade}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CHARTS GRID 1: EVOLUÇÃO DO QUADRO & TURNOVER X ABSENTEÍSMO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Evolução do Quadro Funcional */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Evolução do Quadro Funcional (Ativos)
                  </h3>
                  <p className="text-xs text-slate-500">Crescimento de colaboradores, admissões e desligamentos mensais.</p>
                </div>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-extrabold text-[11px] rounded-lg border border-blue-200">
                  Ano 2026
                </span>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={headcountEvolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAtivos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} domain={[0, 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#FFFFFF', border: 'none', fontSize: '12px' }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: '700', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="ativos" name="Colaboradores Ativos" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorAtivos)" />
                    <Bar dataKey="admissoes" name="Admissões" fill="#10B981" radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar dataKey="desligamentos" name="Desligamentos" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={12} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Turnover vs Absenteísmo */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    Turnover vs Absenteísmo (%)
                  </h3>
                  <p className="text-xs text-slate-500">Comparativo mensal dos índices de rotatividade e ausências.</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-[11px] rounded-lg border border-emerald-200">
                  Sincronizado
                </span>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={turnoverAbsenceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} domain={[0, 'auto']} unit="%" />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, '']}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#FFFFFF', border: 'none', fontSize: '12px' }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: '700', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="turnover" name="Turnover (%)" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar dataKey="absenteismo" name="Absenteísmo (%)" fill="#0284C7" radius={[4, 4, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* CHARTS GRID 2: PRODUTIVIDADE POR SETOR & DISTRIBUIÇÃO DO QUADRO */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 3: Produtividade por Setor */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Distribuição & Produtividade por Setor (%)
                  </h3>
                  <p className="text-xs text-slate-500">Acompanhamento do cumprimento de metas operacionais.</p>
                </div>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-extrabold text-[11px] rounded-lg border border-amber-200">
                  {activeEmployees.length} Colaborador(es)
                </span>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorProductivityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="setor" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} domain={[0, 100]} unit="%" />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, '']}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#FFFFFF', border: 'none', fontSize: '12px' }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: '700', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="meta" name="Meta Estipulada" fill="#94A3B8" radius={[4, 4, 0, 0]} barSize={14} />
                    <Bar dataKey="realizado" name="Produtividade Realizada" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={14} />
                    <Bar dataKey="entregasNoPrazo" name="Entregas no Prazo" fill="#10B981" radius={[4, 4, 0, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Donut Chart: Distribuição do Quadro Funcional */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  Status da Equipe
                </h3>
                <p className="text-xs text-slate-500">Distribuição em tempo real do quadro atual.</p>
              </div>

              <div className="h-48 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#FFFFFF', border: 'none', fontSize: '12px' }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: '600' }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: '700', marginBottom: '4px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-2 border-t border-slate-100">
                {statusDistributionData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 text-[11px] truncate">{item.name}:</span>
                    <span className="text-slate-900 font-extrabold ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* INTERACTIVE DETAIL PANELS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* PANEL 1: ANIVERSARIANTES DO MÊS */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <Cake className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Aniversariantes do Mês</h3>
                    <p className="text-[11px] text-slate-500 capitalize">{currentMonthName} / {new Date().getFullYear()}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-xs font-extrabold rounded-full">
                  {aniversariantesDoMes.length}
                </span>
              </div>

              <div className="space-y-3">
                {aniversariantesDoMes.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                    <Cake className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-extrabold text-slate-600">
                      Nenhum aniversariante neste mês ({currentMonthName})
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Ao cadastrar colaboradores com data de nascimento na aba Funcionários, os aniversariantes do mês aparecerão aqui automaticamente.
                    </p>
                  </div>
                ) : (
                  aniversariantesDoMes.map((aniv) => (
                    <div key={aniv.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-extrabold text-slate-900 block">{aniv.nome}</span>
                        <span className="text-[11px] text-slate-500 block">{aniv.cargo} • {aniv.setor}</span>
                        <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" /> Dia {aniv.dataAniversario}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSentBirthdayIds((prev) => ({ ...prev, [aniv.id]: true }));
                          setFeedbackMsg({ type: 'success', message: `Parabéns enviado para ${aniv.nome} com sucesso!` });
                        }}
                        disabled={aniv.enviadoMensagem}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1 transition cursor-pointer ${
                          aniv.enviadoMensagem
                            ? 'bg-emerald-100 text-emerald-800 cursor-default'
                            : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                        }`}
                      >
                        {aniv.enviadoMensagem ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Enviado
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" /> Parabéns
                          </>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* PANEL 2: FÉRIAS E AFASTAMENTOS VIGENTES */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <UserX className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Afastamentos & Atestados</h3>
                    <p className="text-[11px] text-slate-500">Colaboradores ausentes ou com atestado</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-extrabold rounded-full">
                  {afastamentos.length}
                </span>
              </div>

              <div className="space-y-3">
                {afastamentos.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                    <UserX className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-extrabold text-slate-600">
                      Nenhum afastamento ou atestado registrado
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Lançamentos de atestados e licenças médicas serão sincronizados nesta lista.
                    </p>
                  </div>
                ) : (
                  afastamentos.map((af) => (
                    <div key={af.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900">{af.colaborador}</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-extrabold rounded-md">
                          {af.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium">{af.motivo}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                        <span>Início: {af.inicio}</span>
                        <span className="font-bold text-slate-800">Retorno: {af.retornoPrevisto}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* PANEL 3: DADOS DE AVALIAÇÕES */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Avaliações de Desempenho</h3>
                    <p className="text-[11px] text-slate-500">Feedback e avaliações periódicas</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-extrabold rounded-full">
                  {avaliacoes.length}
                </span>
              </div>

              <div className="space-y-3">
                {avaliacoes.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                    <Award className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-extrabold text-slate-600">
                      Nenhuma avaliação pendente
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Avaliações de desempenho cadastradas no RH aparecerão aqui.
                    </p>
                  </div>
                ) : (
                  <>
                    {avaliacoes.map((a) => (
                      <div key={a.id} className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-blue-950">{a.tipoAvaliacao}</span>
                          <span className="px-2 py-0.5 bg-blue-200 text-blue-900 text-[10px] font-extrabold rounded-md">
                            Média {a.notaFinalMedia || 5.0}
                          </span>
                        </div>
                        <p className="text-[11px] text-blue-800">{a.colaboradorNome} - {a.status}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. FUNCIONÁRIOS (UTILIZE O MESMO MÓDULOS "FUNCIONÁRIOS") */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'funcionarios' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <EmployeeModuleView user={user} />
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. RECRUTAMENTO E SELEÇÃO */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'recrutamento' && (
        <div className="space-y-6">
          {/* TOP ACTIONS */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Funil de Recrutamento & Seleção (R&S)</h2>
              <p className="text-xs text-slate-500">Gestão de vagas e acompanhamento dos candidatos por etapas.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowVagaModal(true)}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-blue-700 transition cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                Nova Vaga
              </button>
              <button
                type="button"
                onClick={() => setShowCandidatoModal(true)}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 transition cursor-pointer shadow-md"
              >
                <UserPlus className="w-4 h-4" />
                Inscrever Candidato
              </button>
            </div>
          </div>

          {/* VAGAS ABERTAS SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vagas.map((v) => (
              <div key={v.id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      {v.setor}
                    </span>
                    <h3 className="text-base font-black text-slate-900 mt-1">{v.titulo}</h3>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-lg">
                    {v.vagasCount} {v.vagasCount > 1 ? 'Vagas' : 'Vaga'} ({v.tipoContrato})
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <p><strong>Faixa Salarial:</strong> {v.faixaSalarial}</p>
                  <p><strong>Requisitos:</strong> {v.requisitos}</p>
                </div>
              </div>
            ))}
          </div>

          {/* KANBAN BOARD OF CANDIDATES */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-white space-y-4">
            <h3 className="text-sm font-black tracking-wider uppercase text-cyan-400 flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Pipeline de Candidatos por Estágio
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
              {(['Inscrito', 'Triagem', 'Entrevista RH', 'Teste Prático', 'Proposta', 'Contratado'] as CandidateStage[]).map(
                (stage) => {
                  const stageCands = candidatos.filter((c) => c.estagio === stage);
                  return (
                    <div key={stage} className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 min-h-[220px] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
                          <span className="text-xs font-black text-slate-200">{stage}</span>
                          <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-extrabold rounded-md">
                            {stageCands.length}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {stageCands.map((c) => (
                            <div key={c.id} className="p-3 bg-slate-900 rounded-lg border border-slate-700 shadow-sm space-y-2">
                              <span className="text-xs font-black text-white block">{c.nome}</span>
                              <span className="text-[10px] text-cyan-300 block">{c.vagaTitulo}</span>
                              <div className="text-[10px] text-slate-400 space-y-0.5">
                                <p>Tel: {c.telefone}</p>
                                <p>Pretensão: R$ {c.pretensaoSalarial.toLocaleString('pt-BR')}</p>
                              </div>
                              {/* Stage Movement Selector */}
                              <select
                                value={c.estagio}
                                onChange={(e) => handleMoveCandidate(c.id, e.target.value as CandidateStage)}
                                className="w-full text-[10px] font-bold bg-slate-800 border border-slate-600 text-cyan-200 rounded px-1.5 py-1 focus:outline-none cursor-pointer"
                              >
                                {['Inscrito', 'Triagem', 'Entrevista RH', 'Teste Prático', 'Proposta', 'Contratado', 'Desqualificado'].map(
                                  (st) => (
                                    <option key={st} value={st}>
                                      Mover: {st}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. CARGOS/SETORES (FORMULÁRIO EM TELA CHEIA AO ABRIR) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'cargos-setores' && (
        <div className="space-y-6 w-full">
          {/* FORMULÁRIO COMPLETO EM TELA CHEIA / LARGURA TOTAL */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {editingCargoId ? 'Editar Cargo / Setor Padrão' : 'Cadastrar Novo Cargo e Tabela Salarial'}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Preencha todos os parâmetros de cargos, salário base, benefícios e comissões da empresa.
                </p>
              </div>

              {editingCargoId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCargoId(null);
                    setCargoForm({
                      cargo: '',
                      setor: 'Comercial & Vendas',
                      cargaHorariaSemanal: 44,
                      salarioBase: 2000,
                      comissaoPadraoPorcentagem: 0,
                      tipoComissao: 'Nenhuma',
                      beneficiosPadrao: ['VR', 'VT'],
                      requisitosMinimos: '',
                      atribuicoes: '',
                    });
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar Edição (Criar Novo)</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSaveCargo} className="space-y-4 text-xs font-bold text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1 font-extrabold text-slate-800">Nome do Cargo Padrão *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Operador de Calandra"
                    value={cargoForm.cargo || ''}
                    onChange={(e) => setCargoForm({ ...cargoForm, cargo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-extrabold text-slate-800">Setor Pertencente *</label>
                  <select
                    value={cargoForm.setor || 'Comercial & Vendas'}
                    onChange={(e) => setCargoForm({ ...cargoForm, setor: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Comercial & Vendas">Comercial & Vendas</option>
                    <option value="Criação & Design">Criação & Design</option>
                    <option value="Impressão & Calandra">Impressão & Calandra</option>
                    <option value="Costura & Acabamento">Costura & Acabamento</option>
                    <option value="Estoque & Expedição">Estoque & Expedição</option>
                    <option value="RH & Gestão">RH & Gestão</option>
                    <option value="Recepção & Atendimento">Recepção & Atendimento</option>
                    <option value="Diretoria & Administração">Diretoria & Administração</option>
                    <option value="Serviços Gerais">Serviços Gerais</option>
                    <option value="LOGISTICA">LOGISTICA</option>
                    <option value="Operador">Operador</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 font-extrabold text-slate-800">Salário Base (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={cargoForm.salarioBase || 0}
                    onChange={(e) => setCargoForm({ ...cargoForm, salarioBase: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1 font-extrabold text-slate-800">% Comissão Padrão</label>
                  <input
                    type="number"
                    step="0.1"
                    value={cargoForm.comissaoPadraoPorcentagem || 0}
                    onChange={(e) => setCargoForm({ ...cargoForm, comissaoPadraoPorcentagem: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-extrabold text-slate-800">Tipo de Comissão</label>
                  <select
                    value={cargoForm.tipoComissao || 'Nenhuma'}
                    onChange={(e) => setCargoForm({ ...cargoForm, tipoComissao: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Nenhuma">Nenhuma</option>
                    <option value="Porcentagem de Venda">Porcentagem de Venda</option>
                    <option value="Valor Fixo por Peça">Valor Fixo por Peça</option>
                    <option value="Meta Batida">Meta Batida</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 font-extrabold text-slate-800">Carga Horária Semanal</label>
                  <input
                    type="number"
                    value={cargoForm.cargaHorariaSemanal || 44}
                    onChange={(e) => setCargoForm({ ...cargoForm, cargaHorariaSemanal: parseInt(e.target.value) || 44 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 font-extrabold text-slate-800">Requisitos Mínimos</label>
                  <input
                    type="text"
                    placeholder="Ex: Ensino Médio Completo + Experiência em Sublimação"
                    value={cargoForm.requisitosMinimos || ''}
                    onChange={(e) => setCargoForm({ ...cargoForm, requisitosMinimos: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-extrabold text-slate-800">Atribuições Principais</label>
                  <textarea
                    rows={1}
                    placeholder="Breve resumo das responsabilidades do cargo..."
                    value={cargoForm.atribuicoes || ''}
                    onChange={(e) => setCargoForm({ ...cargoForm, atribuicoes: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCargoId(null);
                    setCargoForm({
                      cargo: '',
                      setor: 'Comercial & Vendas',
                      cargaHorariaSemanal: 44,
                      salarioBase: 2000,
                      comissaoPadraoPorcentagem: 0,
                      tipoComissao: 'Nenhuma',
                      beneficiosPadrao: ['VR', 'VT'],
                      requisitosMinimos: '',
                      atribuicoes: '',
                    });
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-extrabold transition cursor-pointer"
                >
                  Limpar Formulário
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-extrabold hover:bg-blue-700 transition shadow-md cursor-pointer flex items-center gap-2"
                >
                  <span>{editingCargoId ? 'Atualizar Cargo' : 'Salvar e Cadastrar Cargo'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* LISTA E TABELA DE CARGOS CADASTRADOS COM BUSCA */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Cargos e Setores Cadastrados</h3>
                <p className="text-[11px] text-slate-500 font-medium">Tabela oficial de estrutura salarial da empresa</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cargo ou setor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Cargo & Setor</th>
                    <th className="py-3 px-4">Salário Base</th>
                    <th className="py-3 px-4">Comissão Padrão</th>
                    <th className="py-3 px-4">Carga Horária</th>
                    <th className="py-3 px-4">Benefícios</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredCargos.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <span className="font-black text-slate-900 block">{item.cargo}</span>
                        <span className="text-[11px] font-bold text-blue-600">{item.setor}</span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-slate-800">
                        R$ {item.salarioBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold text-xs rounded-md">
                          {item.comissaoPadraoPorcentagem}% ({item.tipoComissao})
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-600">
                        {item.cargaHorariaSemanal}h / semana
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {Array.isArray(item.beneficiosPadrao) ? item.beneficiosPadrao.join(', ') : item.beneficiosPadrao}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCargoId(item.id);
                            setCargoForm(item);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition text-xs flex items-center gap-1 mx-auto cursor-pointer"
                          title="Editar este Cargo"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 5. JORNADA DE TRABALHO & PONTO (INTEGRAÇÃO TOPPONTO WEB DIRETA) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'jornada' && (
        <div className="w-full h-[calc(100vh-80px)] min-h-[750px] bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden relative flex flex-col">
          {/* BOTÃO FLUTUANTE DISCRETO: APENAS ÍCONE DE ABRIR EM NOVA ABA */}
          <button
            type="button"
            onClick={() => window.open('https://tecidosublimadofortaleza.topponto.com.br/#/login', '_blank', 'noopener,noreferrer')}
            className="absolute top-3 right-3 z-20 p-2.5 bg-white/90 hover:bg-white text-blue-600 hover:text-blue-700 rounded-xl shadow-md border border-slate-200/80 backdrop-blur-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Abrir em Nova Aba"
          >
            <ArrowUpRight className="w-5 h-5 text-blue-600" />
          </button>

          <iframe
            key={topPontoIframeKey}
            src="https://tecidosublimadofortaleza.topponto.com.br/#/login"
            title="TopPonto Web • Tecido Sublimado Fortaleza"
            className="w-full h-full flex-1 border-0 bg-white"
            allow="geolocation; microphone; camera; display-capture; clipboard-read; clipboard-write; autoplay"
            sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
          />
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 6. CONTROLE DE DOCUMENTOS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'documentos' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Controle de Documentos e Exames Médicos (ASO)</h2>
            <p className="text-xs text-slate-500">Monitoramento de validades de exames ocupacionais, CNH e documentação trabalhista.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Documento</th>
                    <th className="py-3 px-4">Emissão</th>
                    <th className="py-3 px-4">Vencimento</th>
                    <th className="py-3 px-4">Status Validade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {documentosCheck.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{doc.funcionarioNome}</td>
                      <td className="py-3.5 px-4 font-bold text-blue-600">{doc.tipoDocumento}</td>
                      <td className="py-3.5 px-4 text-slate-600">{doc.dataEmissao || '-'}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{doc.dataVencimento || 'N/A'}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          doc.statusValidade === 'VALIDO' ? 'bg-emerald-100 text-emerald-800' :
                          doc.statusValidade === 'ALERTA_VENCIMENTO' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {doc.statusValidade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 8. TREINAMENTOS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'treinamentos' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Treinamentos e Capacitação Têxtil</h2>
            <p className="text-xs text-slate-500">Cursos corporativos, NRs de segurança e módulos de formação técnica.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {treinamentos.map((t) => (
              <div key={t.id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded">
                    {t.categoria}
                  </span>
                  <span className="text-xs font-bold text-slate-500">{t.cargaHoraria}h de aula</span>
                </div>
                <h3 className="text-base font-black text-slate-900">{t.titulo}</h3>
                <p className="text-xs text-slate-600">{t.descricao}</p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Instrutor: {t.instrutor}</span>
                  <span className="text-emerald-600">{t.participantesInscritos} Inscritos</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 9. AVALIAÇÕES */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'avaliacoes' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Avaliações de Desempenho e Experiência</h2>
            <p className="text-xs text-slate-500">Acompanhamento de período de experiência (45/90 dias) e ciclo de metas.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5">
            {avaliacoes.map((av) => (
              <div key={av.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">{av.funcionarioNome} ({av.cargo})</h3>
                    <span className="text-xs font-bold text-blue-600">{av.tipoAvaliacao} - {av.dataAvaliacao}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Média Final</span>
                    <span className="text-lg font-black text-emerald-600">{av.notaFinalMedia} / 5.0</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600"><strong>Pontos Fortes:</strong> {av.pontosFortes}</p>
                <p className="text-xs text-slate-600"><strong>Aprimoramento:</strong> {av.pontosMelhoria}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 10. PERFIL COMPORTAMENTAL (DISC) & DINÂMICAS DE MAPEAMENTO */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'disc' && (
        <div className="space-y-6">
          {/* HEADER HUB */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-lg uppercase tracking-wider">
                  Mapeamento Comportamental
                </span>
                <span className="text-xs text-slate-400 font-bold">• ERP SubliGestão</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                Análise Comportamental DISC & Dinâmicas de Equipe
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Avaliação de Dominância (D), Influência (I), Estabilidade (S) e Conformidade (C) inspirada na metodologia MR Coach.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDiscStepIndex(0);
                setDiscAnswers({});
                setDiscTesterName('');
                setDiscTesterRole('');
                setShowDiscTestModal(true);
              }}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shrink-0"
            >
              <BrainCircuit className="w-4 h-4 text-white" />
              Realizar Teste DISC (Modelo MR Coach)
            </button>
          </div>

          {/* SUB-NAVIGATION TABS FOR BEHAVIORAL DYNAMICS */}
          <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'resultados', label: `📊 Avaliações (${discResults.length})` },
              { id: 'job_matching', label: '🎯 Job Matching (Cargo x Perfil)' },
              { id: 'guia_comunicacao', label: '💡 Guia de Comunicação' },
              { id: 'sinergia_equipe', label: '⚡ Sinergia & Conflitos' },
              { id: 'pdi_comportamental', label: '🚀 PDI Comportamental' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setDiscSubTab(st.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer ${
                  discSubTab === st.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* SUB-TAB 1: RESULTADOS DAS AVALIAÇÕES */}
          {discSubTab === 'resultados' && (
            <div className="space-y-4">
              {discResults.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
                  <BrainCircuit className="w-12 h-12 text-blue-500 mx-auto" />
                  <h3 className="font-black text-slate-800 text-base">Nenhuma Avaliação DISC Registrada</h3>
                  <p className="text-slate-500 text-xs max-w-md mx-auto">
                    Aplique o Teste DISC Modelo MR Coach para mapear o perfil comportamental dos colaboradores e candidatos da empresa.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscStepIndex(0);
                      setDiscAnswers({});
                      setDiscTesterName('');
                      setDiscTesterRole('');
                      setShowDiscTestModal(true);
                    }}
                    className="mt-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-extrabold text-xs inline-flex items-center gap-2 hover:bg-blue-700 shadow-md cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Iniciar Primeira Avaliação
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-xs font-black text-slate-800">
                      Exibindo {discResults.length} avaliação(ões) cadastrada(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Deseja realmente limpar todos os dados de avaliações DISC?')) {
                          setDiscResults([]);
                        }
                      }}
                      className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-xl border border-rose-200 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Limpar Histórico de Avaliações</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {discResults.map((res) => (
                      <div key={res.id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-black text-slate-900">{res.nomePessoa}</h3>
                            <span className="text-xs text-slate-500 font-bold">{res.cargoSetor} • Avaliado em {res.dataTeste}</span>
                          </div>
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-900 text-xs font-black rounded-xl border border-indigo-200 shrink-0">
                            {res.perfilPredominante}
                          </span>
                        </div>

                        {/* SCORES BARS */}
                        <div className="grid grid-cols-2 gap-3 text-xs font-bold bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                          <div>
                            <div className="flex justify-between text-rose-700">
                              <span>Dominância (D):</span>
                              <span>{res.scoreDominancia}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full mt-1">
                              <div className="bg-rose-500 h-2 rounded-full transition-all" style={{ width: `${res.scoreDominancia}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-amber-700">
                              <span>Influência (I):</span>
                              <span>{res.scoreInfluencia}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full mt-1">
                              <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${res.scoreInfluencia}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-emerald-700">
                              <span>Estabilidade (S):</span>
                              <span>{res.scoreEstabilidade}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full mt-1">
                              <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${res.scoreEstabilidade}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-blue-700">
                              <span>Conformidade (C):</span>
                              <span>{res.scoreConformidade}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full mt-1">
                              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${res.scoreConformidade}%` }} />
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          <strong>Análise Comportamental:</strong> {res.resumoComportamental}
                        </p>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Excluir a avaliação de ${res.nomePessoa}?`)) {
                                setDiscResults((prev) => prev.filter((item) => item.id !== res.id));
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Excluir Avaliação"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedDiscReport(res)}
                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black rounded-xl border border-indigo-200/80 transition cursor-pointer flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Ver Laudo Completo MR Coach</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 2: JOB MATCHING (COMPATIBILIDADE CARGO X PERFIL) */}
          {discSubTab === 'job_matching' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-600" />
                  Matriz de Compatibilidade de Perfil por Cargo (Job Matching)
                </h3>
                <p className="text-xs text-slate-500">
                  Mapeamento dos perfis comportamentais ideais para cada função na fábrica de tecidos e estamparia sublimada.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    cargo: 'Vendedor / Atendimento Comercial',
                    setor: 'Comercial & Vendas',
                    perfilIdeal: 'Comunicador (I) & Executor (D)',
                    badgeColor: 'bg-amber-100 text-amber-900 border-amber-200',
                    motivo: 'Exige forte poder de comunicação, empatia com o cliente, fechamento rápido de vendas e orientação para metas de faturamento.',
                    caracteristicas: ['Sociável e persuasivo', 'Foco em fechar negócios', 'Alta energia interpessoal'],
                  },
                  {
                    cargo: 'Designer Gráfico / Arte-Finalista',
                    setor: 'Criação & Pré-Impressão',
                    perfilIdeal: 'Analista (C) & Comunicador (I)',
                    badgeColor: 'bg-blue-100 text-blue-900 border-blue-200',
                    motivo: 'Exige rigor técnico em resolução de imagem, perfil de cor e vetorização, combinado com sensibilidade estética e criatividade.',
                    caracteristicas: ['Atenção aos detalhes e sangrias', 'Criatividade visual', 'Acurácia técnica em arquivos'],
                  },
                  {
                    cargo: 'Operador de Impressão Digital & Calandra',
                    setor: 'Impressão & Sublimação',
                    perfilIdeal: 'Planejador (S) & Analista (C)',
                    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-200',
                    motivo: 'Necessita de sequência metódica, acompanhamento do rolo de tecido, temperatura constante da prensa e disciplina em processos contínuos.',
                    caracteristicas: ['Paciência e atenção ao fluxo', 'Segurança operacional', 'Minúcia contra falhas de cor'],
                  },
                  {
                    cargo: 'Costureira(o) & Acabamento Têxtil',
                    setor: 'Costureira & Confecção',
                    perfilIdeal: 'Planejador (S) & Analista (C)',
                    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-200',
                    motivo: 'Exige ritmo constante, concentração nas costuras de barras e elásticos, cuidado com acabamento e baixo índice de retrabalho.',
                    caracteristicas: ['Ritmo padronizado e constante', 'Excelente coordenação e capricho', 'Espírito cooperativo'],
                  },
                  {
                    cargo: 'Gerente de Produção / PCP',
                    setor: 'PCP & PCP Industrial',
                    perfilIdeal: 'Executor (D) & Planejador (S)',
                    badgeColor: 'bg-rose-100 text-rose-900 border-rose-200',
                    motivo: 'Exige poder de decisão para destravar gargalos da fábrica, liderança firme perante prazos de entrega e organização da fila de pedidos.',
                    caracteristicas: ['Liderança firme e assertiva', 'Foco em prazos de expedição', 'Capacidade de resolução sob pressão'],
                  },
                  {
                    cargo: 'Expedição & Controle de Estoque',
                    setor: 'Logística & Expedição',
                    perfilIdeal: 'Analista (C) & Planejador (S)',
                    badgeColor: 'bg-blue-100 text-blue-900 border-blue-200',
                    motivo: 'Exige conferência rigorosa das peças sublimadas x notas de envio, embalagem impecável e controle exato do saldo de insumos.',
                    caracteristicas: ['Conferência sem margem de erro', 'Organização de prateleiras', 'Organização documental'],
                  },
                ].map((item, idx) => (
                  <div key={idx} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{item.setor}</span>
                        <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-lg border ${item.badgeColor}`}>
                          {item.perfilIdeal}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900">{item.cargo}</h4>
                      <p className="text-xs text-slate-600 mt-2 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {item.motivo}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[11px] font-black text-slate-700 block mb-1">Atributos-Chave Buscados:</span>
                      <ul className="space-y-1">
                        {item.caracteristicas.map((c, i) => (
                          <li key={i} className="text-[11px] text-slate-600 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: GUIA DE COMUNICAÇÃO & LIDERANÇA POR PERFIL */}
          {discSubTab === 'guia_comunicacao' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    Guia Prático de Comunicação & Liderança por Perfil
                  </h3>
                  <p className="text-xs text-slate-500">
                    Como o gestor de RH ou líder de setor deve se comunicar, motivar e dar feedback para cada perfil comportamental.
                  </p>
                </div>

                {/* PROFILE SELECTOR BUTTONS */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl shrink-0">
                  {[
                    { id: 'D', label: 'Executor (D)', color: 'bg-rose-600 text-white' },
                    { id: 'I', label: 'Comunicador (I)', color: 'bg-amber-500 text-white' },
                    { id: 'S', label: 'Planejador (S)', color: 'bg-emerald-600 text-white' },
                    { id: 'C', label: 'Analista (C)', color: 'bg-blue-600 text-white' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProfileGuide(p.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                        selectedProfileGuide === p.id ? p.color : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* PROFILE DETAILS CARD */}
              {selectedProfileGuide === 'D' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-3">
                    <span className="px-2.5 py-1 bg-rose-200 text-rose-900 text-xs font-black rounded-lg inline-block">
                      💬 Como Comunicar com o Executor (D)
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">👉 <span>Seja direto, objetivo e vá direto ao ponto sem rodeios.</span></li>
                      <li className="flex items-start gap-2">👉 <span>Foque em resultados, prazos e metas tangíveis.</span></li>
                      <li className="flex items-start gap-2">👉 <span>Apresente opções com autonomia para ele escolher a melhor rota.</span></li>
                    </ul>
                  </div>

                  <div className="p-5 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-3">
                    <span className="px-2.5 py-1 bg-amber-200 text-amber-900 text-xs font-black rounded-lg inline-block">
                      🔥 Como Motivar o Executor (D)
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">🎯 <span>Desafios estimulantes e metas arrojadas de produção.</span></li>
                      <li className="flex items-start gap-2">👑 <span>Autonomia para liderar projetos e tomar decisões.</span></li>
                      <li className="flex items-start gap-2">🏆 <span>Reconhecimento pelo cumprimento acelerado de prazos.</span></li>
                    </ul>
                  </div>

                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <span className="px-2.5 py-1 bg-slate-200 text-slate-800 text-xs font-black rounded-lg inline-block">
                      🚫 O Que JAMAIS Fazer (Evite com D)
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">❌ <span>Microgerenciar ou controlar cada passo do trabalho.</span></li>
                      <li className="flex items-start gap-2">❌ <span>Tirar sua autoridade diante da equipe.</span></li>
                      <li className="flex items-start gap-2">❌ <span>Apresentar explicações longas e cheias de detalhes irrelevantes.</span></li>
                    </ul>
                  </div>

                  <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-3">
                    <span className="px-2.5 py-1 bg-indigo-200 text-indigo-900 text-xs font-black rounded-lg inline-block">
                      📋 Estilo Ideal de Feedback
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">💡 <span>Feedback direto, privativo e focado em números e fatos.</span></li>
                      <li className="flex items-start gap-2">💡 <span>Estimule-o a praticar a escuta ativa com a equipe de apoio.</span></li>
                    </ul>
                  </div>
                </div>
              )}

              {selectedProfileGuide === 'I' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-3">
                    <span className="px-2.5 py-1 bg-amber-200 text-amber-900 text-xs font-black rounded-lg inline-block">
                      💬 Como Comunicar com o Comunicador (I)
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">👉 <span>Seja caloroso, entusiasmado e estimule a conversa livre.</span></li>
                      <li className="flex items-start gap-2">👉 <span>Valorize suas ideias criativas e permita a troca de experiências.</span></li>
                      <li className="flex items-start gap-2">👉 <span>Mantenha um tom amigável e descontraído.</span></li>
                    </ul>
                  </div>

                  <div className="p-5 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-3">
                    <span className="px-2.5 py-1 bg-purple-200 text-purple-900 text-xs font-black rounded-lg inline-block">
                      🔥 Como Motivar o Comunicador (I)
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">🌟 <span>Reconhecimento público diante dos colegas e clientes.</span></li>
                      <li className="flex items-start gap-2">🤝 <span>Trabalho em equipe e ambiente de trabalho social dinâmico.</span></li>
                      <li className="flex items-start gap-2">🎨 <span>Oportunidades de criar e apresentar novos projetos.</span></li>
                    </ul>
                  </div>

                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <span className="px-2.5 py-1 bg-slate-200 text-slate-800 text-xs font-black rounded-lg inline-block">
                      🚫 O Que JAMAIS Fazer (Evite com I)
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">❌ <span>Isolar a pessoa em rotinas extremamente solitárias.</span></li>
                      <li className="flex items-start gap-2">❌ <span>Ser frio, distante ou ignorar suas sugestões.</span></li>
                      <li className="flex items-start gap-2">❌ <span>Exigir planilhas extensas sem dar um objetivo visual claro.</span></li>
                    </ul>
                  </div>

                  <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-3">
                    <span className="px-2.5 py-1 bg-indigo-200 text-indigo-900 text-xs font-black rounded-lg inline-block">
                      📋 Estilo Ideal de Feedback
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">💡 <span>Comece elogiando a dedicação antes de apontar melhorias.</span></li>
                      <li className="flex items-start gap-2">💡 <span>Ajude-o a criar um checklist visual de prazos e detalhes.</span></li>
                    </ul>
                  </div>
                </div>
              )}

              {selectedProfileGuide === 'S' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3">
                    <span className="px-2.5 py-1 bg-emerald-200 text-emerald-900 text-xs font-black rounded-lg inline-block">
                      💬 Como Comunicar com o Planejador (S)
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">👉 <span>Fale de forma calma, paciente e com tom acolhedor.</span></li>
                      <li className="flex items-start gap-2">👉 <span>Explique o passo a passo dos procedimentos antes da execução.</span></li>
                      <li className="flex items-start gap-2">👉 <span>Mostre segurança e suporte constante do líder.</span></li>
                    </ul>
                  </div>

                  <div className="p-5 bg-teal-50/60 rounded-2xl border border-teal-200 space-y-3">
                    <span className="px-2.5 py-1 bg-teal-200 text-teal-900 text-xs font-black rounded-lg inline-block">
                      🔥 Como Motivar o Planejador (S)
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">🛡️ <span>Ambiente de trabalho harmonioso, sem brigas ou sobressaltos.</span></li>
                      <li className="flex items-start gap-2">📅 <span>Previsibilidade nas tarefas diárias e estabilidade no cargo.</span></li>
                      <li className="flex items-start gap-2">👥 <span>Saber que seu trabalho apoia verdadeiramente os colegas.</span></li>
                    </ul>
                  </div>

                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <span className="px-2.5 py-1 bg-slate-200 text-slate-800 text-xs font-black rounded-lg inline-block">
                      🚫 O Que JAMAIS Fazer (Evite com S)
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">❌ <span>Impor mudanças repentinas sem aviso prévio ou explicação.</span></li>
                      <li className="flex items-start gap-2">❌ <span>Pressioná-lo de forma agressiva ou ríspida em público.</span></li>
                      <li className="flex items-start gap-2">❌ <span>Forçar situações de conflito direto com parceiros de equipe.</span></li>
                    </ul>
                  </div>

                  <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-3">
                    <span className="px-2.5 py-1 bg-indigo-200 text-indigo-900 text-xs font-black rounded-lg inline-block">
                      📋 Estilo Ideal de Feedback
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">💡 <span>Conversa individual sincera e tranquilarizadora.</span></li>
                      <li className="flex items-start gap-2">💡 <span>Incentive-o a expressar suas opiniões sem medo de errar.</span></li>
                    </ul>
                  </div>
                </div>
              )}

              {selectedProfileGuide === 'C' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-3">
                    <span className="px-2.5 py-1 bg-blue-200 text-blue-900 text-xs font-black rounded-lg inline-block">
                      💬 Como Comunicar com o Analista (C)
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">👉 <span>Apresente dados, fatos, especificações técnicas e regras claras.</span></li>
                      <li className="flex items-start gap-2">👉 <span>Evite generalizações; seja preciso com números e padrões.</span></li>
                      <li className="flex items-start gap-2">👉 <span>Dê tempo para que ele analise e revise as informações.</span></li>
                    </ul>
                  </div>

                  <div className="p-5 bg-cyan-50/60 rounded-2xl border border-cyan-200 space-y-3">
                    <span className="px-2.5 py-1 bg-cyan-200 text-cyan-900 text-xs font-black rounded-lg inline-block">
                      🔥 Como Motivar o Analista (C)
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">📐 <span>Processos bem estruturados e padrões de qualidade definidos.</span></li>
                      <li className="flex items-start gap-2">🔍 <span>Projetos que exijam alta precisão, conferência e controle.</span></li>
                      <li className="flex items-start gap-2">E <span>Reconhecimento pela qualidade impecável do trabalho entregue.</span></li>
                    </ul>
                  </div>

                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <span className="px-2.5 py-1 bg-slate-200 text-slate-800 text-xs font-black rounded-lg inline-block">
                      🚫 O Que JAMAIS Fazer (Evite com C)
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">❌ <span>Exigir que entregue trabalhos sem tempo para verificação.</span></li>
                      <li className="flex items-start gap-2">❌ <span>Criticar o trabalho sem apresentar provas fundamentadas.</span></li>
                      <li className="flex items-start gap-2">❌ <span>Desrespeitar o regulamento e as normas operacionais.</span></li>
                    </ul>
                  </div>

                  <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-3">
                    <span className="px-2.5 py-1 bg-indigo-200 text-indigo-900 text-xs font-black rounded-lg inline-block">
                      📋 Estilo Ideal de Feedback
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700 font-bold">
                      <li className="flex items-start gap-2">💡 <span>Feedback embasado em indicadores e padrões formais.</span></li>
                      <li className="flex items-start gap-2">💡 <span>Incentive-o a ter maior tolerância com imperfeições menores.</span></li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 4: MATRIZ DE SINERGIA E CONFLITOS DE EQUIPE */}
          {discSubTab === 'sinergia_equipe' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <Zap className="w-5 h-5 text-indigo-600" />
                    Simulador de Sinergia e Conflitos Entre Perfis
                  </h3>
                  <p className="text-xs text-slate-500">
                    Selecione dois perfis para analisar o potencial de colaboração, pontos fortes da dupla e orientações de mediação.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">Perfil 1 (Colaborador A):</label>
                    <select
                      value={synergyProfile1}
                      onChange={(e) => setSynergyProfile1(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs"
                    >
                      <option value="D">Executor (Dominante - D)</option>
                      <option value="I">Comunicador (Influente - I)</option>
                      <option value="S">Planejador (Estável - S)</option>
                      <option value="C">Analista (Conforme - C)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">Perfil 2 (Colaborador B):</label>
                    <select
                      value={synergyProfile2}
                      onChange={(e) => setSynergyProfile2(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs"
                    >
                      <option value="D">Executor (Dominante - D)</option>
                      <option value="I">Comunicador (Influente - I)</option>
                      <option value="S">Planejador (Estável - S)</option>
                      <option value="C">Analista (Conforme - C)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ANALYSIS RESULT CARD */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                  <span className="text-xs font-black text-emerald-900 block flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Pontos de Sinergia da Dupla
                  </span>
                  <p className="text-xs text-slate-700 font-bold leading-relaxed">
                    {synergyProfile1 === 'D' && synergyProfile2 === 'I' && 'Alta velocidade de execução combinada com forte capacidade de persuasão e vendas.'}
                    {synergyProfile1 === 'D' && synergyProfile2 === 'S' && 'O Executor imprime velocidade enquanto o Planejador garante a sustentabilidade e paz na equipe.'}
                    {synergyProfile1 === 'D' && synergyProfile2 === 'C' && 'Visão estratégica e foco na meta aliados à precisão técnica impecável sem erros.'}
                    {synergyProfile1 === 'I' && synergyProfile2 === 'S' && 'Excelente clima interpessoal, empatia com clientes e ambiente altamente colaborativo.'}
                    {synergyProfile1 === 'I' && synergyProfile2 === 'C' && 'Inovação e entusiasmo criativo combinados com disciplina e conformidade técnica.'}
                    {synergyProfile1 === 'S' && synergyProfile2 === 'C' && 'Altíssima estabilidade, respeito às normas, baixíssimo índice de retrabalho e controle total.'}
                    {synergyProfile1 === synergyProfile2 && 'Identidade total nos valores e no ritmo de trabalho, facilitando o alinhamento rápido.'}
                  </p>
                </div>

                <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 space-y-2">
                  <span className="text-xs font-black text-rose-900 block flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Risco de Atrito ou Impasse
                  </span>
                  <p className="text-xs text-slate-700 font-bold leading-relaxed">
                    {synergyProfile1 === 'D' && synergyProfile2 === 'D' && 'Disputa de liderança e impaciência mútua na tomada de decisões.'}
                    {synergyProfile1 === 'D' && synergyProfile2 === 'S' && 'A pressa do Executor pode atropelar a necessidade de estabilidade do Planejador.'}
                    {synergyProfile1 === 'D' && synergyProfile2 === 'C' && 'O Executor pode achar o Analista lento demais; o Analista pode achar o Executor descuidado.'}
                    {synergyProfile1 === 'I' && synergyProfile2 === 'C' && 'O Comunicador pode achar o Analista muito rígido e frio; o Analista pode achar o Comunicador disperso.'}
                    {synergyProfile1 === 'S' && synergyProfile2 === 'S' && 'Risco de resistência excessiva a mudanças necessárias ou atraso diante de imprevistos.'}
                    {synergyProfile1 !== synergyProfile2 && 'Ritmos ou prioridades opostas necessitando de mediação clara do gestor.'}
                  </p>
                </div>

                <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-200 space-y-2">
                  <span className="text-xs font-black text-indigo-900 block flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" /> Orientação para o Líder
                  </span>
                  <p className="text-xs text-slate-700 font-bold leading-relaxed">
                    Defina claramente os papéis de cada colaborador no projeto. Garanta que o perfil analítico forneça os dados enquanto o perfil executor/comunicador lidera a interface e entrega das metas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 5: PDI COMPORTAMENTAL */}
          {discSubTab === 'pdi_comportamental' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-indigo-600" />
                      Gerador de Plano de Desenvolvimento Comportamental (PDI)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Plano prático de 30-60-90 dias focado na evolução das competências do colaborador.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-700">Selecione o Perfil:</span>
                    <select
                      value={pdiProfile}
                      onChange={(e) => setPdiProfile(e.target.value as any)}
                      className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-xs text-indigo-900"
                    >
                      <option value="D">PDI para Executor (D)</option>
                      <option value="I">PDI para Comunicador (I)</option>
                      <option value="S">PDI para Planejador (S)</option>
                      <option value="C">PDI para Analista (C)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg uppercase">
                      Primeiros 30 Dias
                    </span>
                    <h4 className="text-xs font-black text-slate-900">Autoconsciência & Escuta Ativa</h4>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {pdiProfile === 'D' && 'Praticar ouvir a opinião dos colegas antes de tomar decisões finais. Exercitar a paciência com o ritmo alheio.'}
                      {pdiProfile === 'I' && 'Implementar um gerenciador de tarefas diário para registrar compromissos e priorizar prazos críticos.'}
                      {pdiProfile === 'S' && 'Identificar oportunidades para expressar abertamente ideias e sugestões nas reuniões de setor.'}
                      {pdiProfile === 'C' && 'Desenvolver tolerância a pequenos imprevistos operacionais sem paralisar o andamento da tarefa.'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg uppercase">
                      60 Dias
                    </span>
                    <h4 className="text-xs font-black text-slate-900">Aprimoramento de Competências</h4>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {pdiProfile === 'D' && 'Delegar tarefas operacionais dando suporte à equipe sem centralizar todas as etapas.'}
                      {pdiProfile === 'I' && 'Revisar detalhadamente dados e especificações técnicas antes de enviar propostas finais aos clientes.'}
                      {pdiProfile === 'S' && 'Assumir a liderança em pequenos projetos internos para praticar tomada de decisão sob pressão.'}
                      {pdiProfile === 'C' && 'Aumentar a velocidade de entrega em projetos simplificados que não exigem perfeccionismo absoluto.'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg uppercase">
                      90 Dias
                    </span>
                    <h4 className="text-xs font-black text-slate-900">Consolidação do Hábito</h4>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {pdiProfile === 'D' && 'Consolidar um estilo de liderança inspirador e empático, focado tanto em resultados quanto em pessoas.'}
                      {pdiProfile === 'I' && 'Alcançar consistência entre alta energia de vendas e rigor no acompanhamento pós-venda.'}
                      {pdiProfile === 'S' && 'Manter a estabilidade do setor servindo como referência de suporte e calma nos picos de produção.'}
                      {pdiProfile === 'C' && 'Ser o guardião da qualidade e padronização da fábrica mantendo relacionamento fluido com o time.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 11. FEEDBACKS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'feedbacks' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Registros de Feedbacks e 1-on-1</h2>
            <p className="text-xs text-slate-500">Histórico de conversas individuais, alinhamentos e elogios.</p>
          </div>

          <div className="space-y-3">
            {feedbacks.map((fb) => (
              <div key={fb.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-sm">{fb.funcionarioNome}</span>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">{fb.tipo}</span>
                </div>
                <p className="text-xs text-slate-600">{fb.resumoConversa}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 12. PESQUISA DE CLIMA */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'pesquisa-clima' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Pesquisa de Clima Organizacional & eNPS</h2>
            <p className="text-xs text-slate-500">Satisfação do time, índice eNPS e caixinha de sugestões.</p>
          </div>

          {climaSurveys.map((cs) => (
            <div key={cs.id} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-black text-slate-900">{cs.titulo}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-emerald-50 rounded-xl">
                  <span className="text-xs font-bold text-emerald-800 block">eNPS Clima</span>
                  <span className="text-2xl font-black text-emerald-600">+{cs.scoreNpsClima}</span>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl">
                  <span className="text-xs font-bold text-blue-800 block">Liderança</span>
                  <span className="text-2xl font-black text-blue-600">{cs.mediaSatisfacaoLideranca} / 5.0</span>
                </div>
                <div className="p-4 bg-indigo-50 rounded-xl">
                  <span className="text-xs font-bold text-indigo-800 block">Ambiente</span>
                  <span className="text-2xl font-black text-indigo-600">{cs.mediaSatisfacaoAmbiente} / 5.0</span>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl">
                  <span className="text-xs font-bold text-purple-800 block">Respostas</span>
                  <span className="text-2xl font-black text-purple-600">{cs.totalRespostas}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 13. FÉRIAS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'ferias' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Programação e Gestão de Férias</h2>
            <p className="text-xs text-slate-500">Acompanhamento do período aquisitivo, concessivo e abono pecuniário.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Período Aquisitivo</th>
                    <th className="py-3 px-4">Início - Fim</th>
                    <th className="py-3 px-4">Abono Pecuniário (1/3)</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {feriasRequests.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{f.funcionarioNome} ({f.cargo})</td>
                      <td className="py-3.5 px-4 text-slate-600">{f.periodoAquisitivo}</td>
                      <td className="py-3.5 px-4 font-bold text-blue-700">{f.dataInicio} até {f.dataFim}</td>
                      <td className="py-3.5 px-4 text-slate-600">{f.abonoPecuniario ? 'Sim (Vendeu 10 dias)' : 'Não (30 dias)'}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          f.status === 'APROVADA' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 14. ADVERTÊNCIAS & OCORRÊNCIAS DISCIPLINARES */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'advertencias' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Registro de Ocorrências e Advertências Disciplinares</h2>
              <p className="text-xs text-slate-500">Emissão formal de advertências verbais, escritas, suspensões e registros legais.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvModal(true)}
              className="px-4 py-2.5 bg-rose-600 text-white rounded-xl font-extrabold text-xs flex items-center gap-2 hover:bg-rose-700 transition cursor-pointer shadow-md"
            >
              <AlertOctagon className="w-4 h-4" />
              Nova Advertência Formal
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Código & Data</th>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Tipo de Medida</th>
                    <th className="py-3 px-4">Motivo</th>
                    <th className="py-3 px-4">Status Assinatura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {advertencias.map((adv) => (
                    <tr key={adv.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 font-black text-rose-700">
                        {adv.codigoOcorrencia} <span className="text-[10px] text-slate-400 block">{adv.dataOcorrencia}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{adv.funcionarioNome} ({adv.cargo})</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 font-extrabold text-xs rounded-md">
                          {adv.tipo}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{adv.motivoCategoria}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700">{adv.statusAssinatura}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 15. RELATÓRIOS DO RH (QUADRO E GESTÃO DE FUNCIONÁRIOS) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'relatorios-rh' && (
        <div className="space-y-6 w-full no-print-padding">
          {/* CABEÇALHO FORMAL EXCLUSIVO PARA IMPRESSÃO (SUBSTITUI OS ITENS DA TELA NA IMPRESSÃO) */}
          <div className="hidden print:block border-b-2 border-slate-800 pb-2 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-black text-slate-900 uppercase tracking-wide">
                  Relatório Analítico de Funcionários & RH
                </h1>
                <p className="text-[10px] text-slate-600 font-bold">
                  Consolidado gerencial de colaboradores, folha salarial e quadro de pessoal
                </p>
              </div>
              <div className="text-right text-[10px] font-bold text-slate-500">
                <span>Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>

          {/* HEADER & ACTIONS (OCULTO NA IMPRESSÃO CONFORME SOLICITAÇÃO) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <span>Relatório Analítico de Funcionários & RH</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Consolidado gerencial de colaboradores, resumo de folha salarial por setor e indicadores de RH.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={syncEmployeesData}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Relatório</span>
              </button>
            </div>
          </div>

          {/* INDICADORES EM DESTAQUE (KPI CARDS - OCULTOS NA IMPRESSÃO E NO MODO SIMPLIFICADO) */}
          {!relatorioSimplificada && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Total de Colaboradores</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900">{employees.length}</span>
                  <span className="text-[10px] font-bold text-slate-400">Cadastrados</span>
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Colaboradores Ativos</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-emerald-600">{activeEmployees.length}</span>
                  <span className="text-[10px] font-bold text-emerald-700">
                    {employees.length > 0 ? `${((activeEmployees.length / employees.length) * 100).toFixed(0)}%` : '0%'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Folha Salarial Base</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-black text-blue-700">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      activeEmployees.reduce((acc, e) => acc + (e.salarioBase || 0), 0)
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-blue-600">Mensal</span>
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Média Salarial</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-black text-indigo-700">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      activeEmployees.length > 0
                        ? activeEmployees.reduce((acc, e) => acc + (e.salarioBase || 0), 0) / activeEmployees.length
                        : 0
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600">por Func.</span>
                </div>
              </div>
            </div>
          )}

          {/* FILTROS DE PESQUISA (OCULTOS NA IMPRESSÃO CONFORME SOLICITAÇÃO) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-3 text-xs font-bold print:hidden">
            <div className="relative w-full lg:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, código, CPF..."
                value={relatorioSearchTerm}
                onChange={(e) => setRelatorioSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-slate-500 shrink-0">Setor:</span>
                <select
                  value={relatorioSetorFilter}
                  onChange={(e) => setRelatorioSetorFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="TODOS">Todos os Setores</option>
                  <option value="Comercial & Vendas">Comercial & Vendas</option>
                  <option value="Criação & Design">Criação & Design</option>
                  <option value="Impressão & Calandra">Impressão & Calandra</option>
                  <option value="Costura & Acabamento">Costura & Acabamento</option>
                  <option value="Estoque & Expedição">Estoque & Expedição</option>
                  <option value="RH & Gestão">RH & Gestão</option>
                  <option value="Recepção & Atendimento">Recepção & Atendimento</option>
                  <option value="Diretoria & Administração">Diretoria & Administração</option>
                  <option value="Serviços Gerais">Serviços Gerais</option>
                  <option value="LOGISTICA">LOGISTICA</option>
                  <option value="Operador">Operador</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-slate-500 shrink-0">Status:</span>
                <select
                  value={relatorioStatusFilter}
                  onChange={(e) => setRelatorioStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="TODOS">Todos os Status</option>
                  <option value="ACTIVE">Ativos</option>
                  <option value="FERIAS">Em Férias</option>
                  <option value="INACTIVE">Inativos / Desligados</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-slate-500 shrink-0">Cargo:</span>
                <select
                  value={relatorioCargoFilter}
                  onChange={(e) => setRelatorioCargoFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[200px]"
                >
                  <option value="TODOS">Todos os Cargos</option>
                  {relatorioCargosDisponiveis.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* CHECKBOX SIMPLIFICADA CONFORME SOLICITAÇÃO */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl transition border border-slate-300 shadow-2xs">
                <input
                  type="checkbox"
                  checked={relatorioSimplificada}
                  onChange={(e) => setRelatorioSimplificada(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-slate-800 font-extrabold text-xs">Simplificada</span>
              </label>
            </div>
          </div>

          {/* TABELA DE CONSOLIDADO DE FOLHA POR SETOR (OCULTA NA IMPRESSÃO E NO MODO SIMPLIFICADO) */}
          {!relatorioSimplificada && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4 print:hidden">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Resumo da Folha Salarial por Setor</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-black uppercase text-slate-500 tracking-wider">
                      <th className="py-2.5 px-4">Setor</th>
                      <th className="py-2.5 px-4 text-center">Qtd. Colaboradores</th>
                      <th className="py-2.5 px-4 text-right">Folha Salarial Base (R$)</th>
                      <th className="py-2.5 px-4 text-right">Média Salarial do Setor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {(() => {
                      const setoresList = [
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

                      const sectorStats = setoresList.map((setorName) => {
                        const empsInSector = activeEmployees.filter((e) =>
                          (e.setor || '').toLowerCase().includes(setorName.split('&')[0].trim().toLowerCase())
                        );
                        const totalFolha = empsInSector.reduce((acc, e) => acc + (e.salarioBase || 0), 0);
                        const media = empsInSector.length > 0 ? totalFolha / empsInSector.length : 0;
                        return {
                          setor: setorName,
                          count: empsInSector.length,
                          totalFolha,
                          media,
                        };
                      });

                      return sectorStats.map((st, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-bold text-slate-900">{st.setor}</td>
                          <td className="py-2.5 px-4 text-center font-bold">{st.count}</td>
                          <td className="py-2.5 px-4 text-right font-black text-blue-700">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(st.totalFolha)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-700">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(st.media)}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABELA COMPLETA DO QUADRO DE FUNCIONÁRIOS */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {relatorioSimplificada ? 'Listagem Simplificada dos Colaboradores' : 'Listagem Detalhada dos Colaboradores'} ({filteredReportEmployees.length})
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Relatório individual de cadastro, cargos e salários</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Código / Nome</th>
                    <th className="py-3 px-4">CPF</th>
                    <th className="py-3 px-4">Contato</th>
                    <th className="py-3 px-4">Admissão</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    {!relatorioSimplificada && <th className="py-3 px-4 text-right print:hidden">Salário Base (R$)</th>}
                    {!relatorioSimplificada && <th className="py-3 px-4 text-center print:hidden">Comissão %</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredReportEmployees.length > 0 ? (
                    filteredReportEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="font-black text-blue-600 text-xs shrink-0">{emp.codigo || 'S/N'}</span>
                            <span className="font-black text-slate-900 text-xs uppercase">{emp.nome} {emp.sobrenome || ''}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                            {emp.cargo || 'Vendedor(a)'}{emp.setor ? ` • ${emp.setor}` : ''}{emp.filialNome ? ` • ${emp.filialNome}` : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-bold text-xs">
                          {emp.cpf || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-bold text-xs">
                          {emp.telefone || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-bold text-xs">
                          {emp.dataAdmissao ? new Date(emp.dataAdmissao + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                            emp.status === 'ACTIVE' || emp.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-800' :
                            emp.status === 'FERIAS' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {emp.status === 'ACTIVE' || emp.status === 'ATIVO' ? 'Ativo' :
                             emp.status === 'FERIAS' ? 'Férias' : 'Inativo'}
                          </span>
                        </td>
                        {!relatorioSimplificada && (
                          <td className="py-3 px-4 text-right font-black text-blue-600 text-xs print:hidden">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(emp.salarioBase || 0)}
                          </td>
                        )}
                        {!relatorioSimplificada && (
                          <td className="py-3 px-4 text-center font-bold text-slate-700 text-xs print:hidden">
                            {emp.comissaoPorcentagem ? `${emp.comissaoPorcentagem}%` : '0%'}
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={relatorioSimplificada ? 5 : 7} className="py-8 text-center text-slate-400 font-bold">
                        Nenhum funcionário encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RESUMO CONSOLIDADO NO FIM DO RELATÓRIO (LISTA CONFORME ESPECIFICAÇÃO) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 print:border print:border-slate-300 print:shadow-none space-y-2.5 break-inside-avoid">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1.5 flex items-center justify-between">
              <span>Resumo do Relatório</span>
              <span className="text-[11px] font-bold text-slate-500 normal-case">
                {relatorioTotalColaboradores} colaborador(es) listado(s)
              </span>
            </h4>
            <ul className="text-xs font-bold divide-y divide-slate-100">
              <li className="py-2 flex items-center justify-between">
                <span className="text-slate-700 font-extrabold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600 print:hidden"></span>
                  Total de Colaboradores:
                </span>
                <span className="text-sm font-black text-slate-900">
                  {relatorioTotalColaboradores}
                </span>
              </li>
              <li className="py-2 flex items-center justify-between">
                <span className="text-slate-700 font-extrabold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 print:hidden"></span>
                  Folha Salarial Base:
                </span>
                <span className="text-sm font-black text-blue-700">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(relatorioFolhaSalarialBase)}
                </span>
              </li>
              <li className="py-2 flex items-center justify-between">
                <span className="text-slate-700 font-extrabold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 print:hidden"></span>
                  Média Salarial:
                </span>
                <span className="text-sm font-black text-indigo-700">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(relatorioMediaSalarial)}
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 16. MENSAGENS INTERNAS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'mensagens' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Central de Mensagens Internas do RH</h2>
            <p className="text-xs text-slate-500">Comunicação direta entre o setor de RH, gestores e equipe.</p>
          </div>

          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">De: {m.remetente} ({m.assunto})</span>
                  <span className="text-[10px] text-slate-400">{m.dataHora}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{m.conteudo}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 18. ASSINATURA DIGITAL */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'assinatura-digital' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Controle de Assinatura Digital de Documentos</h2>
            <p className="text-xs text-slate-500">Holerites, termos de EPI, espelhos de ponto e avisos de férias assinados eletronicamente.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Documento</th>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Envio</th>
                    <th className="py-3 px-4">Status Assinatura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {digitalDocs.map((sd) => (
                    <tr key={sd.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{sd.tituloDoc}</td>
                      <td className="py-3.5 px-4 text-slate-700">{sd.funcionarioNome}</td>
                      <td className="py-3.5 px-4 text-slate-500">{sd.dataEnvio}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          sd.status === 'ASSINADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {sd.status === 'ASSINADO' ? `Assinado (${sd.dataAssinatura})` : 'Pendente de Assinatura'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 19. CONFIGURAÇÕES */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'configuracoes' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-slate-900">Parâmetros e Configurações do RH</h2>
          <p className="text-xs text-slate-500">Definições gerais do sistema de Recursos Humanos e avisos automáticos.</p>

          <div className="space-y-3 pt-2 max-w-xl">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-800">Carga Horária Padrão CLT</span>
              <span className="text-xs font-black text-blue-600">44 Horas / Semana</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-800">Alerta Prévio ASO Vencendo</span>
              <span className="text-xs font-black text-blue-600">30 Dias Antes</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-800">Alerta Prévio Férias</span>
              <span className="text-xs font-black text-blue-600">60 Dias Antes</span>
            </div>
          </div>
        </div>
      )}



      {/* MODAL: NOVA VAGA DE EMPREGO */}
      {showVagaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-900 to-slate-900 text-white flex items-center justify-between">
              <h3 className="font-black text-base">Abertura de Nova Vaga no Sistema</h3>
              <button type="button" onClick={() => setShowVagaModal(false)} className="text-white hover:bg-white/20 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveVaga} className="p-6 space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block mb-1">Título da Vaga *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Operador de Impressora Roland"
                  value={vagaForm.titulo || ''}
                  onChange={(e) => setVagaForm({ ...vagaForm, titulo: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Faixa Salarial</label>
                  <input
                    type="text"
                    placeholder="Ex: R$ 2.500 + comissão"
                    value={vagaForm.faixaSalarial || ''}
                    onChange={(e) => setVagaForm({ ...vagaForm, faixaSalarial: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block mb-1">Número de Vagas</label>
                  <input
                    type="number"
                    value={vagaForm.vagasCount || 1}
                    onChange={(e) => setVagaForm({ ...vagaForm, vagasCount: parseInt(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowVagaModal(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-extrabold">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-xl font-extrabold hover:bg-blue-700">
                  Criar Vaga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INSCREVER CANDIDATO */}
      {showCandidatoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-emerald-900 to-slate-900 text-white flex items-center justify-between">
              <h3 className="font-black text-base">Inscrição de Candidato em Vaga</h3>
              <button type="button" onClick={() => setShowCandidatoModal(false)} className="text-white hover:bg-white/20 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCandidato} className="p-6 space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block mb-1">Selecione a Vaga *</label>
                <select
                  value={candidatoForm.vagaId || (vagas[0]?.id || '')}
                  onChange={(e) => setCandidatoForm({ ...candidatoForm, vagaId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {vagas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.titulo} ({v.setor})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1">Nome Completo do Candidato *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do candidato..."
                  value={candidatoForm.nome || ''}
                  onChange={(e) => setCandidatoForm({ ...candidatoForm, nome: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={candidatoForm.telefone || ''}
                    onChange={(e) => setCandidatoForm({ ...candidatoForm, telefone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block mb-1">Pretensão Salarial (R$)</label>
                  <input
                    type="number"
                    value={candidatoForm.pretensaoSalarial || 0}
                    onChange={(e) => setCandidatoForm({ ...candidatoForm, pretensaoSalarial: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowCandidatoModal(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-extrabold">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-extrabold hover:bg-emerald-700">
                  Salvar Candidato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA ADVERTÊNCIA FORMAL */}
      {showAdvModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-rose-900 to-slate-900 text-white flex items-center justify-between">
              <h3 className="font-black text-base">Emissão de Ocorrência / Advertência Disciplinar</h3>
              <button type="button" onClick={() => setShowAdvModal(false)} className="text-white hover:bg-white/20 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAdvertencia} className="p-6 space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block mb-1">Nome do Colaborador *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do funcionário advertido..."
                  value={advForm.funcionarioNome || ''}
                  onChange={(e) => setAdvForm({ ...advForm, funcionarioNome: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Tipo de Medida Disciplinar</label>
                  <select
                    value={advForm.tipo || 'Advertência Escrita'}
                    onChange={(e) => setAdvForm({ ...advForm, tipo: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Advertência Verbal">Advertência Verbal</option>
                    <option value="Advertência Escrita">Advertência Escrita</option>
                    <option value="Suspensão Disciplinar">Suspensão Disciplinar</option>
                    <option value="Demissão por Justa Causa">Demissão por Justa Causa</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1">Motivo / Categoria</label>
                  <select
                    value={advForm.motivoCategoria || 'Atrasos Reincidentes'}
                    onChange={(e) => setAdvForm({ ...advForm, motivoCategoria: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Atrasos Reincidentes">Atrasos Reincidentes</option>
                    <option value="Faltas Injustificadas">Faltas Injustificadas</option>
                    <option value="Insubordinação">Insubordinação</option>
                    <option value="Descumprimento de Norma/EPI">Descumprimento de Norma/EPI</option>
                    <option value="Desídia/Negligência">Desídia/Negligência</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block mb-1">Descrição Detalhada do Fato Ocorrido *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Relate os detalhes e datas do acontecimento que gerou a penalidade..."
                  value={advForm.descricaoDetalhada || ''}
                  onChange={(e) => setAdvForm({ ...advForm, descricaoDetalhada: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowAdvModal(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-extrabold">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-rose-600 text-white rounded-xl font-extrabold hover:bg-rose-700">
                  Emitir Advertência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TESTE DISC FULLSCREEN (PERGUNTA POR PERGUNTA COM ANIMAÇÕES) */}
      {showDiscTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-200">
          {/* HEADER BAR */}
          <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shrink-0">
                <BrainCircuit className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-black rounded uppercase tracking-wider border border-indigo-500/30">
                    Modelo MR Coach
                  </span>
                  <span className="text-xs font-bold text-slate-400">20 Grupos de Palavras</span>
                </div>
                <h2 className="text-base font-black text-white">Mapeamento Comportamental DISC</h2>
              </div>
            </div>

            {/* CANDIDATE NAME & ROLE INLINE INPUTS */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex-1 sm:w-56">
                <input
                  type="text"
                  placeholder="Nome do avaliado *"
                  value={discTesterName}
                  onChange={(e) => setDiscTesterName(e.target.value)}
                  className="w-full px-3.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex-1 sm:w-48">
                <input
                  type="text"
                  placeholder="Cargo / Setor"
                  value={discTesterRole}
                  onChange={(e) => setDiscTesterRole(e.target.value)}
                  className="w-full px-3.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowDiscTestModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
                title="Fechar Teste"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* PROGRESS BAR & STEP INDICATOR HEADER */}
          <div className="bg-slate-900/60 border-b border-slate-800/80 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-indigo-400">
                Grupo {discStepIndex + 1} de 20
              </span>
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                • {Object.keys(discAnswers).length} respondidas ({Math.round((Object.keys(discAnswers).length / 20) * 100)}%)
              </span>
            </div>

            <div className="flex items-center gap-3 flex-1 max-w-xs">
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${((discStepIndex + 1) / 20) * 100}%` }}
                />
              </div>
              <span className="text-xs font-black text-slate-300 shrink-0">
                {Math.round(((discStepIndex + 1) / 20) * 100)}%
              </span>
            </div>
          </div>

          {/* MAIN INTERACTIVE QUESTION STAGE WITH ANIMATION */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
            <div className="w-full max-w-3xl space-y-6">
              <AnimatePresence mode="wait">
                {(() => {
                  const currentQ = MR_COACH_DISC_QUESTIONS[discStepIndex];
                  if (!currentQ) return null;
                  const currentAnswer = discAnswers[currentQ.q];

                  return (
                    <motion.div
                      key={currentQ.q}
                      initial={{ opacity: 0, x: 40, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -40, scale: 0.98 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6"
                    >
                      {/* QUESTION HEADER */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-4">
                        <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-black text-xs rounded-xl uppercase tracking-wider">
                          {currentQ.title}
                        </span>
                        {currentAnswer && (
                          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black rounded-xl flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" /> Selecionado
                          </span>
                        )}
                      </div>

                      {/* QUESTION TEXT */}
                      <div className="space-y-1">
                        <h3 className="text-lg sm:text-xl font-black text-white leading-relaxed">
                          {currentQ.text}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                          Escolha a palavra ou expressão que melhor descreve seu comportamento no ambiente de trabalho:
                        </p>
                      </div>

                      {/* OPTIONS CARDS */}
                      <div className="grid grid-cols-1 gap-3 sm:gap-3.5 pt-2">
                        {currentQ.opts.map((op) => {
                          const isSelected = currentAnswer === op.v;
                          return (
                            <motion.button
                              key={op.v}
                              type="button"
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => {
                                setDiscAnswers((prev) => ({ ...prev, [currentQ.q]: op.v as any }));
                                if (discStepIndex < 19) {
                                  setTimeout(() => {
                                    setDiscStepIndex((idx) => idx + 1);
                                  }, 200);
                                }
                              }}
                              className={`p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 ${
                                isSelected
                                  ? 'bg-gradient-to-r from-indigo-950/90 to-purple-950/90 border-indigo-500 text-white shadow-xl ring-2 ring-indigo-500/40'
                                  : 'bg-slate-800/60 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center gap-3.5">
                                <span
                                  className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 transition-all ${
                                    isSelected
                                      ? 'bg-indigo-500 text-white shadow-md'
                                      : 'bg-slate-700 text-slate-300'
                                  }`}
                                >
                                  {op.v}
                                </span>
                                <div>
                                  <span className="text-xs sm:text-sm font-bold leading-snug block text-white">
                                    {op.l}
                                  </span>
                                </div>
                              </div>
                              {isSelected ? (
                                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-slate-600 shrink-0" />
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>
          </div>

          {/* BOTTOM NAVIGATION BAR */}
          <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 backdrop-blur-md">
            {/* STEP DOTS / NUMBERS PAGINATION */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
              {MR_COACH_DISC_QUESTIONS.map((qItem, idx) => {
                const isAns = discAnswers[qItem.q] !== undefined;
                const isCurr = discStepIndex === idx;

                return (
                  <button
                    key={qItem.q}
                    type="button"
                    onClick={() => setDiscStepIndex(idx)}
                    className={`w-7 h-7 rounded-lg text-xs font-black transition cursor-pointer shrink-0 flex items-center justify-center ${
                      isCurr
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/50 shadow-md scale-110'
                        : isAns
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                    title={`Ir para questão ${qItem.q}`}
                  >
                    {qItem.q}
                  </button>
                );
              })}
            </div>

            {/* PREV / NEXT / FINISH ACTIONS */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                disabled={discStepIndex === 0}
                onClick={() => setDiscStepIndex((idx) => Math.max(0, idx - 1))}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              {discStepIndex < 19 ? (
                <button
                  type="button"
                  onClick={() => setDiscStepIndex((idx) => Math.min(19, idx + 1))}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishDiscTest}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 text-white rounded-xl font-extrabold text-xs transition shadow-lg flex items-center gap-2 cursor-pointer animate-pulse"
                >
                  <BrainCircuit className="w-4 h-4 text-cyan-200" />
                  <span>Calcular & Gerar Laudo DISC</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL LAUDO DIAGNÓSTICO DISC COMPLETO (MODELO MR COACH) */}
      {/* --------------------------------------------------------------------- */}
      {selectedDiscReport && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* MODAL HEADER */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 text-[10px] font-black rounded-md uppercase tracking-wider border border-indigo-400/30">
                    Laudo Comportamental DISC • MR Coach
                  </span>
                  <span className="text-xs text-slate-400 font-medium">ERP SubliGestão RH</span>
                </div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <span>{selectedDiscReport.nomePessoa}</span>
                </h3>
                <p className="text-xs text-slate-300">
                  {selectedDiscReport.cargoSetor} • Avaliação realizada em {selectedDiscReport.dataTeste}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-white/10 cursor-pointer"
                  title="Imprimir Laudo"
                >
                  <Printer className="w-4 h-4 text-cyan-300" />
                  <span className="hidden sm:inline">Imprimir Laudo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDiscReport(null)}
                  className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-800 flex-1">
              {(() => {
                const details = getDiscDetailsMRCoach(
                  selectedDiscReport.scoreDominancia,
                  selectedDiscReport.scoreInfluencia,
                  selectedDiscReport.scoreEstabilidade,
                  selectedDiscReport.scoreConformidade
                );

                return (
                  <>
                    {/* EXECUTIVE ANIMAL BANNER */}
                    <div className="p-6 bg-gradient-to-br from-indigo-50 via-purple-50 to-white rounded-2xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-5">
                        <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-4xl shadow-lg shrink-0">
                          {details.animalInfo.emoji}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg uppercase tracking-wider">
                              {details.perfilNome}
                            </span>
                            <span className="text-xs font-black text-purple-700 uppercase tracking-wide">
                              {details.animalInfo.nomeAnimal}
                            </span>
                          </div>
                          <h4 className="text-lg font-black text-slate-900 mt-1">
                            {details.primary.name}
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5 italic font-semibold">
                            "{details.animalInfo.mantra}"
                          </p>
                        </div>
                      </div>

                      <div className="w-full md:w-auto bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center md:text-right shrink-0">
                        <span className="text-[11px] text-slate-400 font-extrabold uppercase block">Fator Predominante</span>
                        <span className="text-2xl font-black text-indigo-700">{details.primary.score}%</span>
                        <span className="text-xs font-bold text-slate-500 block mt-0.5">Perfil Secundário: {details.secondary.name} ({details.secondary.score}%)</span>
                      </div>
                    </div>

                    {/* SCORES DIMENSION BREAKDOWN */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4 text-indigo-600" />
                        <span>Distribuição Percentual das 4 Dimensões (DISC)</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white p-3.5 rounded-xl border border-rose-200 space-y-1">
                          <div className="flex justify-between items-center text-xs font-black text-rose-800">
                            <span>Dominância (D)</span>
                            <span>{selectedDiscReport.scoreDominancia}%</span>
                          </div>
                          <div className="w-full bg-rose-100 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${selectedDiscReport.scoreDominancia}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium block">Resultados, Urgência & Comando</span>
                        </div>

                        <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-1">
                          <div className="flex justify-between items-center text-xs font-black text-amber-800">
                            <span>Influência (I)</span>
                            <span>{selectedDiscReport.scoreInfluencia}%</span>
                          </div>
                          <div className="w-full bg-amber-100 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${selectedDiscReport.scoreInfluencia}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium block">Pessoas, Persuasão & Carisma</span>
                        </div>

                        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-1">
                          <div className="flex justify-between items-center text-xs font-black text-emerald-800">
                            <span>Estabilidade (S)</span>
                            <span>{selectedDiscReport.scoreEstabilidade}%</span>
                          </div>
                          <div className="w-full bg-emerald-100 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${selectedDiscReport.scoreEstabilidade}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium block">Processos, Paciência & Harmonia</span>
                        </div>

                        <div className="bg-white p-3.5 rounded-xl border border-blue-200 space-y-1">
                          <div className="flex justify-between items-center text-xs font-black text-blue-800">
                            <span>Conformidade (C)</span>
                            <span>{selectedDiscReport.scoreConformidade}%</span>
                          </div>
                          <div className="w-full bg-blue-100 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${selectedDiscReport.scoreConformidade}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium block">Precisão, Padrões & Qualidade</span>
                        </div>
                      </div>
                    </div>

                    {/* DETAILED DIAGNOSTIC SECTIONS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* FORÇAS E TALENTOS */}
                      <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 space-y-3">
                        <h4 className="text-xs font-black uppercase text-emerald-900 tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Principais Forças & Talentos em Destaque</span>
                        </h4>
                        <ul className="space-y-2 text-xs font-medium text-emerald-950">
                          {details.animalInfo.forcas.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* DESAFIOS E COMPORTAMENTO SOB ESTRESSE */}
                      <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-200/80 space-y-3">
                        <h4 className="text-xs font-black uppercase text-rose-900 tracking-wider flex items-center gap-1.5">
                          <AlertOctagon className="w-4 h-4 text-rose-600" />
                          <span>Pontos de Desenvolvimento & sob Estresse</span>
                        </h4>
                        <ul className="space-y-2 text-xs font-medium text-rose-950">
                          {details.animalInfo.desafios.map((d, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0 mt-1.5" />
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* GUIA DE LIDERANÇA E AMBIENTE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-purple-600" />
                          <span>Estilo de Liderança Recomendado</span>
                        </h4>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                          {details.animalInfo.estiloLideranca}
                        </p>
                      </div>

                      <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                          <Target className="w-4 h-4 text-indigo-600" />
                          <span>Ambiente Ideal & Âncoras de Carreira</span>
                        </h4>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                          {details.animalInfo.ambienteIdeal}
                        </p>
                        <p className="text-[11px] text-slate-500 font-bold pt-1">
                          <strong>Âncoras:</strong> {details.animalInfo.ancorasCarreira}
                        </p>
                      </div>
                    </div>

                    {/* DISCLAMER FINAL */}
                    <div className="p-4 bg-slate-100/70 rounded-xl border border-slate-200 text-slate-500 text-[11px] leading-relaxed">
                      <strong>Nota Metodológica RH SubliGestão:</strong> Este laudo comportamental foi elaborado segundo o mapeamento quantitativo DISC de 20 dimensões (Inspirado no modelo MR Coach). Utilize este parecer como ferramenta de apoio à gestão, retenção de talentos e harmonização das equipes operacionais da fábrica.
                    </div>
                  </>
                );
              })()}
            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-bold">ERP SubliGestão • Recursos Humanos</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-extrabold border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Laudo Completo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDiscReport(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
