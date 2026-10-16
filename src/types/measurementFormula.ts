export interface MeasurementFieldDef {
  id: string; // identificador único do campo, ex: "frente", "lateral", "altura", "caimento", "babado", "diametro"
  label: string; // Nome exibido na interface, ex: "Frente", "Lateral", "Altura"
  unidade?: string; // ex: "m", "cm", "un"
  obrigatorio?: boolean;
  padrao?: string | number;
  dica?: string;
}

export interface RegrasCalculoFinanceiro {
  tamanhoBabadoFormula?: string;
  valorBabadoFormula?: string;
  valorTampoFormula?: string;
  valorSobreposicaoFormula?: string;
  valorFaixaFormula?: string;
  valorFaixaBabadoFormula?: string;
  valorTotalFormula?: string;
  valorComSobreposicaoFormula?: string;
  valorSemSobreposicaoFormula?: string;
  taxaSobreposicaoM2?: number; // Padrão 32
  taxaAdicionalAcabamento?: number; // Padrão 20
}

export interface MeasurementFormula {
  id: string;
  titulo: string; // ex: "Cálculo de Mesa"
  descricao?: string; // Descrição ou explicação da fórmula
  tipo: 'mesa' | 'cilindro' | 'cubo' | 'personalizado';
  campos: MeasurementFieldDef[];
  formulaExpressao: string; // ex: "(babado * altura) + (frente * lateral)"
  formulaTexto?: string; // Exibição amigável: "Saia (Babado × Altura) + Tampo (Frente × Lateral)"
  operadoresUsados?: string[];
  permiteSobreposicao?: boolean;
  regrasFinanceiras?: RegrasCalculoFinanceiro;
  ativo: boolean;
  criadoPor?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  ordem?: number;
}

export const OPERADORES_MATEMATICOS = [
  { sinal: '+', label: 'Adição (+)', descricao: 'Soma valores ou áreas' },
  { sinal: '-', label: 'Subtração (-)', descricao: 'Subtrai valores' },
  { sinal: '*', label: 'Multiplicação (×)', descricao: 'Multiplica dimensões ou fatores' },
  { sinal: '/', label: 'Divisão (÷)', descricao: 'Divide grandezas' },
  { sinal: '(', label: 'Abre Parênteses (', descricao: 'Define prioridade de cálculo' },
  { sinal: ')', label: 'Fecha Parênteses )', descricao: 'Fecha grupo de cálculo' },
  { sinal: '2*', label: 'Dobro (2×)', descricao: 'Multiplicador por 2 (ex: duas laterais)' },
  { sinal: '3.14159*', label: 'Pi (π ×)', descricao: 'Para cálculos circulares/redondos' },
] as const;

export const CAMPOS_PADRAO_SUGERIDOS: MeasurementFieldDef[] = [
  { id: 'frente', label: 'Frente', unidade: 'm', obrigatorio: true },
  { id: 'lateral', label: 'Lateral', unidade: 'm', obrigatorio: true },
  { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: false },
  { id: 'caimento', label: 'Caimento', unidade: 'm', obrigatorio: false },
  { id: 'babado', label: 'Babado', unidade: 'm', obrigatorio: false },
  { id: 'preco_venda', label: 'Preço de Venda (m²)', unidade: 'R$', obrigatorio: false, dica: 'Busca o preço de venda cadastrado do produto' },
  { id: 'diametro', label: 'Diâmetro', unidade: 'm', obrigatorio: false },
  { id: 'raio', label: 'Raio', unidade: 'm', obrigatorio: false },
  { id: 'comprimento', label: 'Comprimento', unidade: 'm', obrigatorio: false },
  { id: 'largura', label: 'Largura', unidade: 'm', obrigatorio: false },
  { id: 'medida', label: 'Medida', unidade: 'm', obrigatorio: false },
  { id: 'tampo', label: 'Tampo', unidade: 'm', obrigatorio: false },
  { id: 'aba', label: 'Aba / Bainha', unidade: 'm', obrigatorio: false },
];

export const REGRAS_CALCULO_PADRAO_MESA: RegrasCalculoFinanceiro = {
  tamanhoBabadoFormula: '=(SOMA(FRENTE:LATERAL)*2)*2',
  valorBabadoFormula: '=ARREDONDAR.PARA.CIMA((BABADO * ALTURA * VALOR DO M2); 0)',
  valorTampoFormula: '=ARREDONDAR.PARA.CIMA((FRENTE * LATERAL * VALOR DO M2); 0)',
  valorSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA((SOMA(FRENTE;CAIMENTO) * SOMA(LATERAL;CAIMENTO)) * 32; 0)',
  valorComSobreposicaoFormula: '=VALOR DO BABADO + VALOR DO TAMPO + VALOR DA SOBREPOSIÇÃO + 20',
  valorSemSobreposicaoFormula: '=VALOR DO BABADO + VALOR DO TAMPO + 20',
  taxaSobreposicaoM2: 32,
  taxaAdicionalAcabamento: 20,
};

export const FORMULA_PADRAO_MESA: MeasurementFormula = {
  id: 'calculo_mesa',
  titulo: 'Cálculo de Mesa Retangular',
  descricao: 'Cálculo padrão para Toalha de Mesa Retangular: Babado =(Frente+Lateral)*4 | Valor Babado =Babado*Alt*m² | Valor Tampo =Frente*Lat*m² | Valor Sobreposição =(Frente+Caimento)*(Lateral+Caimento)*32 | C/ Sobreposição =Babado+Tampo+Sobrep+20 | S/ Sobreposição =Babado+Tampo+20',
  tipo: 'mesa',
  campos: [
    { id: 'frente', label: 'Frente', unidade: 'm', obrigatorio: true },
    { id: 'lateral', label: 'Lateral', unidade: 'm', obrigatorio: true },
    { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
    { id: 'caimento', label: 'Caimento', unidade: 'm', obrigatorio: false },
    { id: 'babado', label: 'Babado', unidade: 'm', obrigatorio: false },
    { id: 'preco_venda', label: 'Preço de Venda (m²)', unidade: 'R$', obrigatorio: false, dica: 'Busca o preço de venda cadastrado do produto' },
  ],
  formulaExpressao: '(babado * altura) + (frente * lateral)',
  formulaTexto: 'Saia (Babado × Altura) + Tampo (Frente × Lateral) com Sobreposição',
  permiteSobreposicao: true,
  regrasFinanceiras: REGRAS_CALCULO_PADRAO_MESA,
  ativo: true,
  ordem: 1,
  criadoPor: 'Sistema SubliGestão',
};

export const REGRAS_CALCULO_MESA_REDONDA: RegrasCalculoFinanceiro = {
  tamanhoBabadoFormula: '=(DIÂMETRO * 3.14) * 2',
  valorBabadoFormula: '=ARREDONDAR.PARA.CIMA((BABADO * ALTURA * VALOR DO M2); 0)',
  valorTampoFormula: '=ARREDONDAR.PARA.CIMA((DIÂMETRO * DIÂMETRO * VALOR DO M2); 0)',
  valorSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA(((DIÂMETRO + CAIMENTO) * (DIÂMETRO + CAIMENTO)) * 32; 0)',
  valorComSobreposicaoFormula: '=VALOR DO BABADO + VALOR DO TAMPO + VALOR DA SOBREPOSIÇÃO + 20',
  valorSemSobreposicaoFormula: '=VALOR DO BABADO + VALOR DO TAMPO + 20',
  taxaSobreposicaoM2: 32,
  taxaAdicionalAcabamento: 20,
};

export const FORMULA_MESA_REDONDA: MeasurementFormula = {
  id: 'calculo_mesa_redonda',
  titulo: 'Cálculo de Mesa Redonda',
  descricao: 'Cálculo padrão para Toalha de Mesa Redonda: Babado =(Diâmetro*3.14)*2 | Valor Babado =Babado*Alt*m² | Valor Tampo =Diâmetro*Diâmetro*m² | Valor Sobreposição =(Diâmetro+Caimento)*(Diâmetro+Caimento)*32 | C/ Sobreposição =Babado+Tampo+Sobrep+20 | S/ Sobreposição =Babado+Tampo+20',
  tipo: 'mesa',
  campos: [
    { id: 'frente', label: 'Diâmetro (Frente)', unidade: 'm', obrigatorio: true },
    { id: 'lateral', label: 'Lateral', unidade: 'm', obrigatorio: false },
    { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
    { id: 'caimento', label: 'Caimento', unidade: 'm', obrigatorio: false },
    { id: 'babado', label: 'Babado', unidade: 'm', obrigatorio: false },
    { id: 'preco_venda', label: 'Preço de Venda (m²)', unidade: 'R$', obrigatorio: false, dica: 'Busca o preço de venda cadastrado do produto' },
  ],
  formulaExpressao: '(babado * altura) + (frente * frente)',
  formulaTexto: 'Saia (Babado × Altura) + Tampo Redondo com Sobreposição',
  permiteSobreposicao: true,
  regrasFinanceiras: REGRAS_CALCULO_MESA_REDONDA,
  ativo: true,
  ordem: 2,
  criadoPor: 'Sistema SubliGestão',
};

export const REGRAS_CALCULO_MESA_RETRO: RegrasCalculoFinanceiro = {
  tamanhoBabadoFormula: '=ARREDONDAR.PARA.CIMA(((FRENTE + 0,5) * 3,14) * 2; 0)',
  valorBabadoFormula: '=ARREDONDAR.PARA.CIMA((BABADO * (ALTURA - 0,25) * VALOR DO M2); 0)',
  valorTampoFormula: '=ARREDONDAR.PARA.CIMA(((FRENTE + 0,5) * (LATERAL + 0,5) * VALOR DO M2); 0)',
  valorSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA(((FRENTE + 0,5 + CAIMENTO) * (LATERAL + 0,5 + CAIMENTO) * VALOR DO M2); 0)',
  valorComSobreposicaoFormula: '=VALOR DO BABADO + VALOR DO TAMPO + VALOR DA SOBREPOSIÇÃO + 20',
  valorSemSobreposicaoFormula: '=VALOR DO BABADO + VALOR DO TAMPO + 20',
  taxaSobreposicaoM2: 32,
  taxaAdicionalAcabamento: 20,
};

export const FORMULA_MESA_RETRO: MeasurementFormula = {
  id: 'calculo_mesa_retro',
  titulo: 'Cálculo Mesa Retrô',
  descricao: 'Cálculo específico para Mesa Retrô: Babado =((Frente+0,5)*3,14)*2 | Valor Babado =Babado*(Alt-0,25)*m² | Valor Tampo =(Frente+0,5)*(Lateral+0,5)*m² | Sobreposição =(Frente+0,5+Caimento)*(Lateral+0,5+Caimento)*m² | C/ Sobrep =Babado+Tampo+Sobrep+20 | S/ Sobrep =Babado+Tampo+20',
  tipo: 'mesa',
  campos: [
    { id: 'frente', label: 'Frente Mesa', unidade: 'm', obrigatorio: true },
    { id: 'lateral', label: 'Lateral', unidade: 'm', obrigatorio: true },
    { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
    { id: 'caimento', label: 'Caimento', unidade: 'm', obrigatorio: false },
    { id: 'babado', label: 'Babado', unidade: 'm', obrigatorio: false },
    { id: 'preco_venda', label: 'Preço de Venda (m²)', unidade: 'R$', obrigatorio: false, dica: 'Busca o preço de venda cadastrado do produto' },
  ],
  formulaExpressao: '(babado * (altura - 0.25)) + ((frente + 0.5) * (lateral + 0.5))',
  formulaTexto: 'Saia Babado ((Frente+0,5)×3,14×2 × (Altura-0,25)) + Tampo ((Frente+0,5) × (Lateral+0,5))',
  permiteSobreposicao: true,
  regrasFinanceiras: REGRAS_CALCULO_MESA_RETRO,
  ativo: true,
  ordem: 3,
  criadoPor: 'Sistema SubliGestão',
};

export const REGRAS_CALCULO_MESA_BABADO: RegrasCalculoFinanceiro = {
  tamanhoBabadoFormula: '=(2 * ((2*FRENTE) + (2*LATERAL)))',
  valorFaixaBabadoFormula: '=ARREDONDAR.PARA.CIMA((2 * ((2*FRENTE) + (2*LATERAL)) * (ALTURA / QTD DE BABADO) * VALOR DO M2); 0)',
  valorBabadoFormula: '=FAIXA DE BABADO * QTD DE BABADO',
  valorTampoFormula: '=ARREDONDAR.PARA.CIMA((FRENTE * LATERAL * VALOR DO M2); 0)',
  valorFaixaFormula: '=ARREDONDAR.PARA.CIMA((((2*FRENTE) + (2*LATERAL)) * ALTURA * VALOR DO M2); 0)',
  valorTotalFormula: '=(VALOR DO TAMPO + FAIXA + VALOR DE BABADO) + (20 * QTD DE BABADO)',
  valorComSobreposicaoFormula: '=(VALOR DO TAMPO + FAIXA + VALOR DE BABADO) + (20 * QTD DE BABADO)',
  valorSemSobreposicaoFormula: '=(VALOR DO TAMPO + FAIXA + VALOR DE BABADO) + (20 * QTD DE BABADO)',
  taxaSobreposicaoM2: 32,
  taxaAdicionalAcabamento: 20,
};

export const FORMULA_MESA_BABADO: MeasurementFormula = {
  id: 'calculo_mesa_babado',
  titulo: 'Cálculo de Mesa Babado',
  descricao: 'Cálculo específico para Mesa Babado: Tampo, Faixa e Faixas de Babado com base na Qtd de Babado.',
  tipo: 'mesa',
  campos: [
    { id: 'frente', label: 'Frente', unidade: 'm', obrigatorio: true },
    { id: 'lateral', label: 'Lateral', unidade: 'm', obrigatorio: true },
    { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
    { id: 'qtd_babado', label: 'Qtd de Babado', unidade: 'un', obrigatorio: true, padrao: 2 },
    { id: 'preco_venda', label: 'Preço de Venda (m²)', unidade: 'R$', obrigatorio: false, dica: 'Busca o preço de venda cadastrado do produto' },
  ],
  formulaExpressao: '(frente * lateral) + (((2*frente) + (2*lateral)) * altura) + ((2 * ((2*frente) + (2*lateral))) * altura)',
  formulaTexto: 'Tampo (Frente × Lateral) + Faixa (Perímetro × Altura) + Babado (2 × Perímetro × Altura)',
  permiteSobreposicao: false,
  regrasFinanceiras: REGRAS_CALCULO_MESA_BABADO,
  ativo: true,
  ordem: 4,
  criadoPor: 'Sistema SubliGestão',
};

export const REGRAS_CALCULO_CILINDRO: RegrasCalculoFinanceiro = {
  tamanhoBabadoFormula: '=LARGURA / 3',
  valorTampoFormula: '=((LARGURA / 3)^2) * VALOR DO M2',
  valorSobreposicaoFormula: '=LARGURA * ALTURA * VALOR DO M2',
  valorTotalFormula: '=ARREDONDAR.PARA.CIMA((LARGURA * ALTURA * VALOR DO M2) + (((LARGURA / 3)^2) * VALOR DO M2); 0)',
  valorComSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA((LARGURA * ALTURA * VALOR DO M2) + (((LARGURA / 3)^2) * VALOR DO M2); 0)',
  valorSemSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA((LARGURA * ALTURA * VALOR DO M2) + (((LARGURA / 3)^2) * VALOR DO M2); 0)',
  taxaSobreposicaoM2: 32,
};

export const FORMULA_CILINDRO: MeasurementFormula = {
  id: 'calculo_cilindro',
  titulo: 'Cálculo de Cilindro',
  descricao: 'Cálculo específico para Cilindro: Tampo (Largura/3), Valor Base (Largura×Altura×m²), Valor Tampo ((Largura/3)²×m²).',
  tipo: 'cilindro',
  campos: [
    { id: 'largura', label: 'Largura', unidade: 'm', obrigatorio: true },
    { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
    { id: 'preco_venda', label: 'Preço de Venda (m²)', unidade: 'R$', obrigatorio: false, dica: 'Busca o preço de venda cadastrado do produto' },
  ],
  formulaExpressao: '(largura * altura) + (((largura / 3) ^ 2) * preco_venda)',
  formulaTexto: 'Valor Base (Largura × Altura × m²) + Valor do Tampo ((Largura / 3)² × m²)',
  permiteSobreposicao: false,
  regrasFinanceiras: REGRAS_CALCULO_CILINDRO,
  ativo: true,
  ordem: 5,
  criadoPor: 'Sistema SubliGestão',
};

export const REGRAS_CALCULO_CUBO: RegrasCalculoFinanceiro = {
  tamanhoBabadoFormula: '=MEDIDA * 4',
  valorBabadoFormula: '=ARREDONDAR.PARA.CIMA(ALTURA * CÁLCULO * PREÇO; 0)',
  valorTampoFormula: '=ARREDONDAR.PARA.CIMA(TAMPO * TAMPO * PREÇO; 0)',
  valorTotalFormula: '=ARREDONDAR.PARA.CIMA(VALOR + VALOR TAMPO; 0)',
  valorComSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA(VALOR + VALOR TAMPO; 0)',
  valorSemSobreposicaoFormula: '=ARREDONDAR.PARA.CIMA(VALOR + VALOR TAMPO; 0)',
};

export const FORMULA_CUBO_MESA_VESTE: MeasurementFormula = {
  id: 'calculo_cubo',
  titulo: 'Cálculo Cubo/Mesa Veste',
  descricao: 'Cálculo Cubo/Mesa Veste: Medida, Altura e Tampo. calculo = (medida * 4), valor = ARREDONDAR.PARA.CIMA(altura * calculo * preço; 0), valor tampo = ARREDONDAR.PARA.CIMA(tampo * tampo * preço; 0), Total = (valor + valor tampo).',
  tipo: 'cubo',
  campos: [
    { id: 'medida', label: 'Medida', unidade: 'm', obrigatorio: true },
    { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
    { id: 'tampo', label: 'Tampo', unidade: 'm', obrigatorio: true },
  ],
  formulaExpressao: 'ARREDONDAR.PARA.CIMA((altura * (medida * 4) * preco_venda) + (tampo * tampo * preco_venda); 0)',
  formulaTexto: 'calculo = (medida * 4) | valor = ARREDONDAR.PARA.CIMA(altura * calculo * preço; 0) | valor tampo = ARREDONDAR.PARA.CIMA(tampo * tampo * preço; 0) | Total = (valor + valor tampo)',
  permiteSobreposicao: false,
  regrasFinanceiras: REGRAS_CALCULO_CUBO,
  ativo: true,
  ordem: 6,
  criadoPor: 'Sistema SubliGestão',
};

export const DEFAULT_MEASUREMENT_FORMULAS: MeasurementFormula[] = [
  FORMULA_PADRAO_MESA,
  FORMULA_MESA_REDONDA,
  FORMULA_MESA_RETRO,
  FORMULA_MESA_BABADO,
  FORMULA_CILINDRO,
  FORMULA_CUBO_MESA_VESTE,
];

export function sanitizeMeasurementFormula(formula: MeasurementFormula): MeasurementFormula {
  if (!formula) return FORMULA_PADRAO_MESA;
  const isRetro = formula.id === 'calculo_mesa_retro' || (formula.titulo || '').toLowerCase().includes('retrô') || (formula.titulo || '').toLowerCase().includes('retro');
  const isRedonda = formula.id === 'calculo_mesa_redonda' || (formula.titulo || '').toLowerCase().includes('redond');
  const isBabado = formula.id === 'calculo_mesa_babado' || (formula.titulo || '').toLowerCase().includes('babado');
  const isCilindro = formula.id === 'calculo_cilindro' || (formula.titulo || '').toLowerCase().includes('cilindro');
  const isCubo = formula.id === 'calculo_cubo' || (formula.titulo || '').toLowerCase().includes('cubo') || (formula.titulo || '').toLowerCase().includes('mesa veste');

  let defaultRules = REGRAS_CALCULO_PADRAO_MESA;
  let defaultCampos = FORMULA_PADRAO_MESA.campos;
  let defaultTitulo = 'Cálculo de Mesa Retangular';
  let defaultDesc = FORMULA_PADRAO_MESA.descricao;
  let defaultExpr = FORMULA_PADRAO_MESA.formulaExpressao;
  let defaultTexto = FORMULA_PADRAO_MESA.formulaTexto;

  if (isRetro) {
    defaultRules = REGRAS_CALCULO_MESA_RETRO;
    defaultCampos = FORMULA_MESA_RETRO.campos;
    defaultTitulo = 'Cálculo Mesa Retrô';
    defaultDesc = FORMULA_MESA_RETRO.descricao;
    defaultExpr = FORMULA_MESA_RETRO.formulaExpressao;
    defaultTexto = FORMULA_MESA_RETRO.formulaTexto;
  } else if (isRedonda) {
    defaultRules = REGRAS_CALCULO_MESA_REDONDA;
    defaultCampos = FORMULA_MESA_REDONDA.campos;
    defaultTitulo = 'Cálculo de Mesa Redonda';
    defaultDesc = FORMULA_MESA_REDONDA.descricao;
    defaultExpr = FORMULA_MESA_REDONDA.formulaExpressao;
    defaultTexto = FORMULA_MESA_REDONDA.formulaTexto;
  } else if (isBabado) {
    defaultRules = REGRAS_CALCULO_MESA_BABADO;
    defaultCampos = FORMULA_MESA_BABADO.campos;
    defaultTitulo = 'Cálculo de Mesa Babado';
    defaultDesc = FORMULA_MESA_BABADO.descricao;
    defaultExpr = FORMULA_MESA_BABADO.formulaExpressao;
    defaultTexto = FORMULA_MESA_BABADO.formulaTexto;
  } else if (isCilindro) {
    defaultRules = REGRAS_CALCULO_CILINDRO;
    defaultCampos = FORMULA_CILINDRO.campos;
    defaultTitulo = 'Cálculo de Cilindro';
    defaultDesc = FORMULA_CILINDRO.descricao;
    defaultExpr = FORMULA_CILINDRO.formulaExpressao;
    defaultTexto = FORMULA_CILINDRO.formulaTexto;
  } else if (isCubo) {
    defaultRules = REGRAS_CALCULO_CUBO;
    defaultCampos = FORMULA_CUBO_MESA_VESTE.campos;
    defaultTitulo = 'Cálculo Cubo/Mesa Veste';
    defaultDesc = FORMULA_CUBO_MESA_VESTE.descricao;
    defaultExpr = FORMULA_CUBO_MESA_VESTE.formulaExpressao;
    defaultTexto = FORMULA_CUBO_MESA_VESTE.formulaTexto;
  }

  return {
    ...formula,
    id: formula.id || `formula_${Date.now()}`,
    titulo: formula.titulo || defaultTitulo,
    descricao: formula.descricao || defaultDesc,
    tipo: formula.tipo || 'mesa',
    campos: Array.isArray(formula.campos) && formula.campos.length > 0 ? formula.campos : defaultCampos,
    formulaExpressao: formula.formulaExpressao || defaultExpr,
    formulaTexto: formula.formulaTexto || formula.formulaExpressao || defaultTexto,
    permiteSobreposicao: formula.permiteSobreposicao !== undefined ? formula.permiteSobreposicao : true,
    regrasFinanceiras: {
      tamanhoBabadoFormula: formula.regrasFinanceiras?.tamanhoBabadoFormula || defaultRules.tamanhoBabadoFormula,
      valorBabadoFormula: formula.regrasFinanceiras?.valorBabadoFormula || defaultRules.valorBabadoFormula,
      valorTampoFormula: formula.regrasFinanceiras?.valorTampoFormula || defaultRules.valorTampoFormula,
      valorSobreposicaoFormula: formula.regrasFinanceiras?.valorSobreposicaoFormula || defaultRules.valorSobreposicaoFormula,
      valorComSobreposicaoFormula: formula.regrasFinanceiras?.valorComSobreposicaoFormula || defaultRules.valorComSobreposicaoFormula,
      valorSemSobreposicaoFormula: formula.regrasFinanceiras?.valorSemSobreposicaoFormula || defaultRules.valorSemSobreposicaoFormula,
      taxaSobreposicaoM2: Number(formula.regrasFinanceiras?.taxaSobreposicaoM2) || 32,
      taxaAdicionalAcabamento: Number(formula.regrasFinanceiras?.taxaAdicionalAcabamento) || 20,
    },
    ativo: formula.ativo !== undefined ? formula.ativo : true,
  };
}
