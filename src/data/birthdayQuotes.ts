/**
 * ERP SubliGestão - Frases de Motivação Pessoal para Aniversário de Colaboradores
 * 20 frases exclusivas, neutras (sem distinção de gênero / para ambos os sexos),
 * celebrando a vida, o potencial, o entusiasmo e o novo ciclo pessoal e profissional.
 */

export const BIRTHDAY_MOTIVATIONAL_QUOTES: string[] = [
  'Parabéns por mais um ano de vida! Que este novo ciclo traga paz, saúde e conquistas grandiosas para a sua caminhada.',
  'Hoje o dia é de festa e celebração! Que a alegria de viver se renove e que cada sonho encontre caminhos férteis para florescer.',
  'Feliz aniversário! Que nunca falte coragem para buscar o topo e sabedoria para desfrutar cada momento da jornada.',
  'Que este novo ano chegue trazendo realizações extraordinárias, energia positiva e momentos inesquecíveis. Parabéns pelo seu dia!',
  'Celebrar a sua vida é celebrar dedicação, luz e inspiração. Que o seu futuro reserve surpresas tão brilhantes quanto o seu potencial.',
  'Feliz vida! Que a cada passo dado haja entusiasmo, que a confiança no próprio caminho seja inabalável e que a felicidade faça morada permanente em você.',
  'Parabéns! Que este novo ciclo traga grandes oportunidades e muita força para transformar qualquer desafio em vitória.',
  'Que a celebração de hoje seja o início de uma etapa repleta de realizações, plenitude e motivos diários para sorrir. Feliz aniversário!',
  'Viver é uma dádiva e cada novo ano é uma chance de superar limites. Que a sua presença continue fazendo a diferença por onde passar. Parabéns!',
  'Feliz aniversário! Desejo que cada instante deste dia especial traga paz e que a sua trajetória continue sendo motivo de orgulho e admiração.',
  'Parabéns por esta data tão especial! Que os seus objetivos mais nobres se concretizem com leveza, sabedoria e muita prosperidade.',
  'Que o entusiasmo de viver continue impulsionando cada escolha sua. Muita saúde, harmonia e sucesso em cada detalhe deste novo ano. Parabéns!',
  'Feliz aniversário! Que os sorrisos compartilhados hoje se multipliquem em conquistas constantes ao longo de toda a sua jornada.',
  'Comemorar a sua existência é motivo de imensa alegria para toda a nossa equipe. Parabéns por somar tanto com o seu talento e dedicação!',
  'Que a vida presenteie este novo ciclo com saúde plena, paz de espírito e muitas razões para brindar o futuro. Feliz aniversário!',
  'Parabéns pelo seu dia! Que a energia da renovação inspire os seus passos e que cada amanhecer chegue carregado de esperança e realizações.',
  'Feliz vida! Continue trilhando o seu caminho com autenticidade, nobreza e entusiasmo. O mundo se torna melhor com a sua presença!',
  'Que a colheita deste novo ano de vida seja abundante em sorrisos, harmonia e momentos de realização total. Parabéns!',
  'Parabéns pelo aniversário! Que nunca lhe faltem horizontes amplos para sonhar e passos firmes para realizar tudo o que tiver vontade.',
  'Feliz aniversário! Que este novo capítulo chegue repleto de vitalidade, prosperidade e vitórias marcantes em todas as áreas da sua vida.',
];

/**
 * Retorna uma frase aleatória dentre as 20 frases de aniversário.
 */
export function getRandomBirthdayQuote(): string {
  const index = Math.floor(Math.random() * BIRTHDAY_MOTIVATIONAL_QUOTES.length);
  return BIRTHDAY_MOTIVATIONAL_QUOTES[index];
}

/**
 * Valida se uma data de nascimento coincide com o dia e mês de hoje.
 * Suporta formatos ISO (YYYY-MM-DD), brasileiro (DD/MM/YYYY) ou com traços (DD-MM-YYYY).
 */
export function checkIsBirthdayToday(birthDateRaw?: string | null): boolean {
  if (!birthDateRaw) return false;
  const raw = String(birthDateRaw).trim();
  if (!raw) return false;

  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1; // 1-12

  let day = 0;
  let month = 0;

  // YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const parts = raw.split('T')[0].split('-');
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  }
  // DD/MM/YYYY
  else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(raw)) {
    const parts = raw.split('/');
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  }
  // DD-MM-YYYY
  else if (/^\d{1,2}-\d{1,2}-\d{2,4}/.test(raw)) {
    const parts = raw.split('-');
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      day = parsed.getUTCDate ? parsed.getUTCDate() : parsed.getDate();
      month = (parsed.getUTCMonth ? parsed.getUTCMonth() : parsed.getMonth()) + 1;
    }
  }

  return day === currentDay && month === currentMonth;
}
