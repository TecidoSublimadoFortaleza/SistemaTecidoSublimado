/**
 * ERP SubliGestão - Frontend Types
 */

export type RoleTitle =
  | 'Developer'
  | 'CEO'
  | 'ADM MASTER'
  | 'ADM SISTEMA'
  | 'ADMINISTRADOR'
  | 'Gerente Geral'
  | 'Administrativo'
  | 'Administração'
  | 'Supervisor'
  | 'Monitor'
  | 'Vendedor(a)'
  | 'Vendedora Shopee'
  | 'Designer'
  | 'Impressão'
  | 'Calandra'
  | 'Costura'
  | 'Estoque'
  | 'Conferência'
  | 'Expedição'
  | 'RH'
  | 'Serviços Gerais'
  | 'Recepção'
  | 'LOGISTICA'
  | 'Op. Máquina de corte'
  | 'Operador';

export type SectorType =
  | 'Administrativo'
  | 'Comercial'
  | 'Atendimento'
  | 'Produção'
  | 'Impressão'
  | 'Calandra'
  | 'Expedição'
  | 'Diretoria'
  | 'Serviços Gerais'
  | 'LOGISTICA'
  | 'Operador';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  supportAvatarUrl?: string;
  isSupportPhoto?: boolean;
  role: RoleTitle;
  sector: SectorType;
  branch: string;
  isDeveloper: boolean;
  dataNascimento?: string;
  localAtuacao?: 'Fortaleza' | 'Piauí' | 'Shopee' | string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string; // Lucide icon name identifier
  roles: RoleTitle[]; // Allowed roles for this menu
}

export const MOTIVATIONAL_QUOTES: Record<RoleTitle, string[]> = {
  Developer: [
    'Construindo a arquitetura do futuro com precisão e segurança.',
    'Sistemas estáveis moldam indústrias de alto desempenho.',
    'Código limpo, performance impecável e inovação contínua.',
  ],
  CEO: [
    'Liderança é transformar visão em realidade sustentável.',
    'Excelência não é um ato, é um hábito corporativo.',
    'Sua visão guia nossa indústria ao topo da eficiência.',
  ],
  'ADM MASTER': [
    'Gestão estratégica soberana, liderança exemplar e controle total dos processos.',
    'Decisões assertivas constroem uma operação sólida e eficiente.',
    'Visão macro e excelência contínua em cada detalhe da empresa.',
  ],
  'ADM SISTEMA': [
    'Gestão estratégica soberana, liderança exemplar e controle total dos processos.',
    'Decisões assertivas constroem uma operação sólida e eficiente.',
    'Visão macro e excelência contínua em cada detalhe da empresa.',
  ],
  ADMINISTRADOR: [
    'Gestão estratégica soberana, liderança exemplar e controle total dos processos.',
    'Decisões assertivas constroem uma operação sólida e eficiente.',
    'Visão macro e excelência contínua em cada detalhe da empresa.',
  ],
  'Gerente Geral': [
    'A coordenação perfeita entre setores gera resultados extraordinários.',
    'Mantenha o foco nos processos e os resultados virão.',
    'Gestão ágil para uma produção impecável.',
  ],
  Supervisor: [
    'Acompanhe, oriente e inspire sua equipe a superar metas.',
    'Qualidade em cada etapa da esteira produtiva.',
    'Supervisão atenta constrói padrões de excelência.',
  ],
  Monitor: [
    'O alinhamento contínuo garante o fluxo perfeito de cada Ordem de Serviço.',
    'Acompanhe o ritmo e evite gargalos na produção.',
  ],
  'Vendedor(a)': [
    'Cada atendimento é uma oportunidade de encantar o cliente.',
    'Foco no cliente, metas batidas e grandes conquistas hoje!',
    'Seu entusiasmo transforma oportunidades em vendas de sucesso.',
  ],
  'Vendedora Shopee': [
    'Agilidade, precisão nos pedidos e excelência nas vendas da Shopee!',
    'Conectando nossa fábrica aos clientes da Shopee em todo o Brasil.',
    'Cada pedido registrado com sucesso fortalece nossa presença no marketplace.',
  ],
  Designer: [
    'Sua criatividade transforma tecidos em obras de arte sublimadas.',
    'A perfeição visual começa nos detalhes da sua arte.',
    'Inovação e estética em cada estampa.',
  ],
  Impressão: [
    'Cores vivas e nitidez perfeita passam pelas suas mãos.',
    'Precisão na impressão garante o brilho do produto final.',
  ],
  Calandra: [
    'Temperatura, pressão e ritmo perfeito: a magia da sublimação em ação.',
    'Transferência térmica com qualidade de padrão internacional.',
  ],
  Costura: [
    'Cada ponto e costura dão forma ao sonho dos nossos clientes.',
    'Acabamento impecável e amor pelo detalhe têxtil.',
  ],
  Estoque: [
    'Organização e controle preciso são a espinha dorsal do nosso ERP.',
    'Sem ruptura, sem desperdício: estoque afiado e produtivo.',
  ],
  Conferência: [
    'A última impressão é a que fica: conferência e embalagem perfeita para entregar alegria.',
    'Cuidado no toque final que valoriza todo o trabalho têxtil.',
  ],
  Expedição: [
    'Logística eficiente para garantir entregas pontuais e de qualidade.',
    'Controle logístico rigoroso que finaliza com excelência o processo.',
  ],
  Recepção: [
    'O sorriso no primeiro atendimento define a imagem da nossa marca.',
    'Agilidade e simpatia para dar as boas-vindas aos nossos clientes.',
  ],
  Administração: [
    'Organização impecável e controle corporativo eficiente.',
    'Suporte estratégico para o crescimento de toda a empresa.',
  ],
  Administrativo: [
    'Organização impecável, agilidade nos processos e controle corporativo eficiente.',
    'Suporte estratégico e gestão operacional de excelência para toda a empresa.',
    'Foco, precisão e comprometimento com os resultados da equipe.',
  ],
  RH: [
    'Cuidar de pessoas é potencializar talentos e transformar resultados.',
    'Gestão humanizada e estratégica para o crescimento conjunto da equipe.',
    'O maior patrimônio de uma grande empresa são as pessoas que a constroem.',
  ],
  'Serviços Gerais': [
    'O cuidado, a limpeza e a organização sustentam a excelência de todos os setores.',
    'Dedicação essencial que mantém nossa fábrica limpa, segura e acolhedora.',
    'Trabalho com carinho e eficiência em cada detalhe do nosso ambiente.',
  ],
  LOGISTICA: [
    'Logística estratégica para movimentação ágil e entrega impecável.',
    'Eficiência no fluxo de materiais e pontualidade em cada etapa.',
    'Organização e controle que mantêm toda a cadeia em movimento.',
  ],
  'Op. Máquina de corte': [
    'Precisão milimétrica no corte e aproveitamento máximo do tecido.',
    'Agilidade e foco operacional para alimentar a confecção com qualidade.',
    'Corte perfeito que garante a excelência da peça final.',
  ],
  Operador: [
    'A força e o ritmo da esteira operacional que transformam tecido em valor.',
    'Excelência técnica e dedicação constante na operação diária.',
    'Trabalho de precisão que move toda a nossa linha de produção.',
  ],
};
