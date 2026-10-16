/**
 * ERP SubliGestão - RH (Recursos Humanos) Types
 */

export interface JobOpening {
  id: string;
  titulo: string;
  setor: string;
  cargo: string;
  faixaSalarial: string;
  tipoContrato: 'CLT' | 'PJ' | 'Estágio' | 'Temporário';
  vagasCount: number;
  status: 'ABERTA' | 'EM_SELECAO' | 'PREENCHIDA' | 'CANCELADA';
  dataAbertura: string;
  descricao: string;
  requisitos: string;
}

export type CandidateStage = 'Inscrito' | 'Triagem' | 'Entrevista RH' | 'Teste Prático' | 'Proposta' | 'Contratado' | 'Desqualificado';

export interface Candidate {
  id: string;
  vagaId: string;
  vagaTitulo: string;
  nome: string;
  email: string;
  telefone: string;
  pretensaoSalarial: number;
  estagio: CandidateStage;
  notaAvaliacao: number; // 1-5
  resumoExperiencia: string;
  linkCurriculo?: string;
  dataCandidatura: string;
  historicoNotas?: string[];
}

export interface StandardPosition {
  id: string;
  cargo: string;
  setor: string;
  cargaHorariaSemanal: number; // e.g. 44h
  salarioBase: number;
  comissaoPadraoPorcentagem: number;
  tipoComissao: string;
  beneficiosPadrao: string[]; // e.g. ['VR R$30/dia', 'VT', 'Plano de Saúde']
  requisitosMinimos: string;
  atribuicoes: string;
}

export interface TimeClockRecord {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  cargo: string;
  data: string; // YYYY-MM-DD
  entrada: string; // HH:mm
  saidaAlmoco?: string;
  retornoAlmoco?: string;
  saida: string;
  totalHorasTrabalhadas: string;
  bancoHorasMinutos: number; // + or - in minutes
  status: 'NORMAL' | 'HORAS_EXTRAS' | 'ATRASO' | 'FALTA' | 'ABONADO';
  observacao?: string;
}

export interface WorkShift {
  id: string;
  nomeEscala: string; // e.g. "Escala 6x1 Tarde", "12x36 Noite"
  tipoEscala: '5x2' | '6x1' | '12x36' | 'Plantão' | 'Personalizada';
  horarioInicio: string;
  horarioFim: string;
  diasFolga: string[];
  setoresAplicaveis: string[];
}

export interface EmployeeDocumentCheck {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  tipoDocumento: 'ASO_ADMISSONAL' | 'ASO_PERIODICO' | 'CNH' | 'CTPS' | 'COMPROVANTE_RESIDENCIA' | 'CERTIFICADO_NR' | 'EPI_TERMO';
  dataEmissao?: string;
  dataVencimento?: string;
  statusValidade: 'VALIDO' | 'ALERTA_VENCIMENTO' | 'VENCIDO' | 'PENDENTE_ENTREGA';
  observacao?: string;
}

export interface TrainingCourse {
  id: string;
  titulo: string;
  categoria: 'Integração' | 'Segurança NR' | 'Qualidade Têxtil' | 'Liderança' | 'Operacional';
  instrutor: string;
  cargaHoraria: number; // horas
  obrigatorioParaSetor?: string;
  status: 'ATIVO' | 'CONCLUIDO' | 'AGENDADO';
  participantesInscritos: number;
  dataRealizacao: string;
  descricao: string;
}

export interface PerformanceReview {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  colaboradorNome?: string;
  cargo: string;
  avaliadorNome: string;
  tipoAvaliacao: 'Experiência 45 Dias' | 'Experiência 90 Dias' | 'Avaliação Anual 360' | 'Metas e KPIs';
  dataAvaliacao: string;
  notaQualidadeTrabalho: number; // 1-5
  notaAssiduidade: number; // 1-5
  notaRelacionamento: number; // 1-5
  notaIniciativa: number; // 1-5
  notaFinalMedia: number; // 1.0 - 5.0
  pontosFortes: string;
  pontosMelhoria: string;
  parecerAprovacao: 'Aprovado' | 'Manter em Observação' | 'Desligamento';
  status?: string;
}

export interface DiscAssessment {
  id: string;
  funcionarioId?: string;
  candidatoId?: string;
  nomePessoa: string;
  cargoSetor: string;
  dataTeste: string;
  scoreDominancia: number; // 0-100%
  scoreInfluencia: number;
  scoreEstabilidade: number;
  scoreConformidade: number;
  perfilPredominante: 'Executor (D)' | 'Comunicador (I)' | 'Planejador (S)' | 'Analista (C)';
  resumoComportamental: string;
}

export interface FeedbackLog {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  gestorNome: string;
  data: string;
  tipo: 'Elogio' | 'Ponto de Melhoria' | 'Alinhamento 1-on-1' | 'Plano de Ação (PDI)';
  resumoConversa: string;
  planoAcaoProposto: string;
  prazoAcompanhamento?: string;
}

export interface ClimateSurvey {
  id: string;
  titulo: string;
  periodoAno: string;
  totalRespostas: number;
  scoreNpsClima: number; // -100 a +100
  mediaSatisfacaoLideranca: number; // 1-5
  mediaSatisfacaoAmbiente: number; // 1-5
  mediaSatisfacaoBeneficios: number; // 1-5
  status: 'ABERTA' | 'FINALIZADA';
}

export interface VacationRequest {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  cargo: string;
  periodoAquisitivo: string; // e.g. "2024-2025"
  diasDireito: number; // e.g. 30
  diasGozar: number; // e.g. 20 or 30
  abonoPecuniario: boolean; // vender 10 dias
  dataInicio: string;
  dataFim: string;
  status: 'PENDENTE_APROVACAO' | 'APROVADA' | 'EM_GOZO' | 'CONCLUIDA' | 'CANCELADA' | 'PENDENTE';
  alertaAvisoPrevio30DiasSent: boolean;
}

export interface DisciplinaryAction {
  id: string;
  codigoOcorrencia: string;
  funcionarioId: string;
  funcionarioNome: string;
  cargo: string;
  setor: string;
  tipo: 'Advertência Verbal' | 'Advertência Escrita' | 'Suspensão Disciplinar' | 'Demissão por Justa Causa';
  dataOcorrencia: string;
  motivoCategoria: 'Atrasos Reincidentes' | 'Faltas Injustificadas' | 'Insubordinação' | 'Descumprimento de Norma/EPI' | 'Desídia/Negligência' | 'Outro';
  descricaoDetalhada: string;
  testemunha1?: string;
  testemunha2?: string;
  statusAssinatura: 'Pendente' | 'Assinado pelo Colaborador' | 'Assinado por Testemunhas (Recusa)';
}

export interface DigitalSignatureDoc {
  id: string;
  tituloDoc: string;
  tipoDocumento: 'Holerite / Espelho de Ponto' | 'Termo de Entrega de EPI' | 'Advertência' | 'Aviso de Férias' | 'Contrato de Trabalho';
  funcionarioNome: string;
  dataEnvio: string;
  dataAssinatura?: string;
  status: 'PENDENTE' | 'ASSINADO' | 'RECUSADO';
  hashSeguranca?: string;
  ipOrigem?: string;
}

export interface RhAlert {
  id: string;
  titulo: string;
  mensagem: string;
  tipoPrioridade: 'ALTA' | 'MEDIA' | 'INFORMATIVA';
  publicoAlvo: 'TODOS' | 'APENAS_RH' | 'GESTORES' | 'SETOR_ESPECIFICO';
  setorAlvo?: string;
  autor: string;
  dataCriacao: string;
  ativo: boolean;
}

export interface RhMessage {
  id: string;
  remetente: string;
  destinatario: string; // ou "Geral RH"
  assunto: string;
  conteudo: string;
  dataHora: string;
  lida: boolean;
}
