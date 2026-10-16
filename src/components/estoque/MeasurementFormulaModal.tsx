import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calculator,
  HelpCircle,
  CheckCircle2,
  Save,
  RotateCcw,
  Sparkles,
  Lock,
  DollarSign,
  Layers,
  Check,
  Info,
  ArrowLeft,
} from 'lucide-react';
import {
  MeasurementFormula,
  MeasurementFieldDef,
  OPERADORES_MATEMATICOS,
  CAMPOS_PADRAO_SUGERIDOS,
  REGRAS_CALCULO_PADRAO_MESA,
  REGRAS_CALCULO_MESA_REDONDA,
  REGRAS_CALCULO_MESA_RETRO,
  REGRAS_CALCULO_MESA_BABADO,
  REGRAS_CALCULO_CILINDRO,
  REGRAS_CALCULO_CUBO,
  FORMULA_PADRAO_MESA,
  FORMULA_MESA_REDONDA,
  FORMULA_MESA_RETRO,
  FORMULA_MESA_BABADO,
  FORMULA_CILINDRO,
  FORMULA_CUBO_MESA_VESTE,
  RegrasCalculoFinanceiro,
} from '../../types/measurementFormula';
import { ApiService } from '../../services/api';

interface MeasurementFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formula: MeasurementFormula) => Promise<void>;
  onDelete?: (formula: MeasurementFormula) => void;
  initialFormula?: MeasurementFormula | null;
  operatorName?: string;
}

export const MeasurementFormulaModal: React.FC<MeasurementFormulaModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialFormula,
  operatorName = 'Admin',
}) => {
  const [titulo, setTitulo] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');
  const [campos, setCampos] = useState<MeasurementFieldDef[]>([
    { id: 'frente', label: 'Frente', unidade: 'm', obrigatorio: true },
    { id: 'lateral', label: 'Lateral', unidade: 'm', obrigatorio: true },
    { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
    { id: 'caimento', label: 'Caimento', unidade: 'm', obrigatorio: false },
    { id: 'babado', label: 'Babado', unidade: 'm', obrigatorio: false },
  ]);
  const [formulaExpressao, setFormulaExpressao] = useState<string>('(babado * altura) + (frente * lateral)');
  const [formulaTexto, setFormulaTexto] = useState<string>('Saia (Babado × Altura) + Tampo (Frente × Lateral)');
  const [permiteSobreposicao, setPermiteSobreposicao] = useState<boolean>(true);
  const [novoCampoNome, setNovoCampoNome] = useState<string>('');
  const [novoCampoUnidade, setNovoCampoUnidade] = useState<string>('m');

  // Catálogo de produtos para busca de Preço de Venda
  const [produtosCatalogo, setProdutosCatalogo] = useState<any[]>([]);
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<string>('');

  // Regras de Cálculos Financeiros (Babado, Tampo, Sobreposição, etc.)
  const [tamanhoBabadoFormula, setTamanhoBabadoFormula] = useState<string>(
    REGRAS_CALCULO_PADRAO_MESA.tamanhoBabadoFormula || '=(SOMA(FRENTE:LATERAL)*2)*2'
  );
  const [valorBabadoFormula, setValorBabadoFormula] = useState<string>(
    REGRAS_CALCULO_PADRAO_MESA.valorBabadoFormula || '=ARREDONDAR.PARA.CIMA((BABADO * ALTURA * VALOR DO M2); 0)'
  );
  const [valorTampoFormula, setValorTampoFormula] = useState<string>(
    REGRAS_CALCULO_PADRAO_MESA.valorTampoFormula || '=ARREDONDAR.PARA.CIMA((FRENTE * LATERAL * VALOR DO M2); 0)'
  );
  const [valorSobreposicaoFormula, setValorSobreposicaoFormula] = useState<string>(
    REGRAS_CALCULO_PADRAO_MESA.valorSobreposicaoFormula || '=ARREDONDAR.PARA.CIMA((SOMA(FRENTE;CAIMENTO) * SOMA(LATERAL;CAIMENTO)) * 32; 0)'
  );
  const [valorComSobreposicaoFormula, setValorComSobreposicaoFormula] = useState<string>(
    REGRAS_CALCULO_PADRAO_MESA.valorComSobreposicaoFormula || '=SOMA(VALOR DO BABADO:VALOR DA SOBREPOSIÇÃO) + 20'
  );
  const [valorSemSobreposicaoFormula, setValorSemSobreposicaoFormula] = useState<string>(
    REGRAS_CALCULO_PADRAO_MESA.valorSemSobreposicaoFormula || '=SOMA(VALOR DO BABADO:VALOR TAMPO) + 20'
  );
  const [taxaSobreposicaoM2, setTaxaSobreposicaoM2] = useState<number>(32);
  const [taxaAdicionalAcabamento, setTaxaAdicionalAcabamento] = useState<number>(20);

  // Teste de cálculo interativo
  const [valoresTeste, setValoresTeste] = useState<Record<string, string>>({
    frente: '2',
    lateral: '1',
    altura: '0.75',
    caimento: '0.30',
    babado: '12',
  });
  const [valorM2Teste, setValorM2Teste] = useState<string>('45');
  const [comSobreposicaoTeste, setComSobreposicaoTeste] = useState<boolean>(true);
  const [resultadoTeste, setResultadoTeste] = useState<number | null>(null);
  const [simulacaoFinanceira, setSimulacaoFinanceira] = useState<{
    tamanhoBabado: number;
    valorBabado: number;
    valorTampo: number;
    valorSobreposicao: number;
    valorComSobreposicao: number;
    valorSemSobreposicao: number;
    valorFinalCalculado: number;
  } | null>(null);
  const [erroFormula, setErroFormula] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (initialFormula) {
      setTitulo(initialFormula.titulo);
      setDescricao(initialFormula.descricao || '');
      setCampos(initialFormula.campos || []);
      setFormulaExpressao(initialFormula.formulaExpressao || '');
      setFormulaTexto(initialFormula.formulaTexto || '');
      setPermiteSobreposicao(Boolean(initialFormula.permiteSobreposicao));

      const isRetroInit = initialFormula.id === 'calculo_mesa_retro' || (initialFormula.titulo || '').toLowerCase().includes('retrô') || (initialFormula.titulo || '').toLowerCase().includes('retro');
      const isCilindroInit = initialFormula.id === 'calculo_cilindro' || (initialFormula.titulo || '').toLowerCase().includes('cilindro');
      const isCuboInit = initialFormula.id === 'calculo_cubo' || (initialFormula.titulo || '').toLowerCase().includes('cubo') || (initialFormula.titulo || '').toLowerCase().includes('mesa veste');
      const defaultRf = isRetroInit ? REGRAS_CALCULO_MESA_RETRO : (isCilindroInit ? REGRAS_CALCULO_CILINDRO : (isCuboInit ? REGRAS_CALCULO_CUBO : REGRAS_CALCULO_PADRAO_MESA));
      const rf = initialFormula.regrasFinanceiras || defaultRf;
      setTamanhoBabadoFormula(rf.tamanhoBabadoFormula || defaultRf.tamanhoBabadoFormula || '=(SOMA(FRENTE:LATERAL)*2)*2');
      setValorBabadoFormula(rf.valorBabadoFormula || defaultRf.valorBabadoFormula || '=ARREDONDAR.PARA.CIMA((BABADO * ALTURA * VALOR DO M2); 0)');
      setValorTampoFormula(rf.valorTampoFormula || defaultRf.valorTampoFormula || '=ARREDONDAR.PARA.CIMA((FRENTE * LATERAL * VALOR DO M2); 0)');
      setValorSobreposicaoFormula(rf.valorSobreposicaoFormula || defaultRf.valorSobreposicaoFormula || '=ARREDONDAR.PARA.CIMA((SOMA(FRENTE;CAIMENTO) * SOMA(LATERAL;CAIMENTO)) * 32; 0)');
      setValorComSobreposicaoFormula(rf.valorComSobreposicaoFormula || defaultRf.valorComSobreposicaoFormula || '=VALOR DO BABADO + VALOR DO TAMPO + VALOR DA SOBREPOSIÇÃO + 20');
      setValorSemSobreposicaoFormula(rf.valorSemSobreposicaoFormula || defaultRf.valorSemSobreposicaoFormula || '=VALOR DO BABADO + VALOR DO TAMPO + 20');
      setTaxaSobreposicaoM2(rf.taxaSobreposicaoM2 || (isCuboInit || isCilindroInit ? 0 : 32));
      setTaxaAdicionalAcabamento(rf.taxaAdicionalAcabamento || (isCuboInit || isCilindroInit ? 0 : 20));

      const testMap: Record<string, string> = isCuboInit ? {
        medida: '1',
        altura: '1',
        tampo: '1',
        preco_venda: '30',
      } : isRetroInit ? {
        frente: '2.7',
        lateral: '1.7',
        altura: '0.8',
        caimento: '0.5',
        babado: '21',
        preco_venda: '32',
      } : {
        frente: '2',
        lateral: '1',
        altura: '0.75',
        caimento: '0.30',
        babado: '12',
        preco_venda: '45',
      };
      (initialFormula.campos || []).forEach((c) => {
        if (!testMap[c.id]) testMap[c.id] = '1';
      });
      setValoresTeste(testMap);
    } else {
      setTitulo('');
      setDescricao('');
      setCampos([
        { id: 'frente', label: 'Frente', unidade: 'm', obrigatorio: true },
        { id: 'lateral', label: 'Lateral', unidade: 'm', obrigatorio: true },
        { id: 'altura', label: 'Altura', unidade: 'm', obrigatorio: true },
        { id: 'caimento', label: 'Caimento', unidade: 'm', obrigatorio: false },
        { id: 'babado', label: 'Babado', unidade: 'm', obrigatorio: false },
        { id: 'preco_venda', label: 'Preço de Venda (m²)', unidade: 'R$', obrigatorio: false, dica: 'Busca o preço de venda cadastrado do produto' },
      ]);
      setFormulaExpressao('(babado * altura) + (frente * lateral)');
      setFormulaTexto('Saia (Babado × Altura) + Tampo (Frente × Lateral)');
      setPermiteSobreposicao(true);
      setTamanhoBabadoFormula(REGRAS_CALCULO_PADRAO_MESA.tamanhoBabadoFormula || '=(SOMA(FRENTE:LATERAL)*2)*2');
      setValorBabadoFormula(REGRAS_CALCULO_PADRAO_MESA.valorBabadoFormula || '=ARREDONDAR.PARA.CIMA((BABADO * ALTURA * VALOR DO M2); 0)');
      setValorTampoFormula(REGRAS_CALCULO_PADRAO_MESA.valorTampoFormula || '=ARREDONDAR.PARA.CIMA((FRENTE * LATERAL * VALOR DO M2); 0)');
      setValorSobreposicaoFormula(REGRAS_CALCULO_PADRAO_MESA.valorSobreposicaoFormula || '=ARREDONDAR.PARA.CIMA((SOMA(FRENTE;CAIMENTO) * SOMA(LATERAL;CAIMENTO)) * 32; 0)');
      setValorComSobreposicaoFormula(REGRAS_CALCULO_PADRAO_MESA.valorComSobreposicaoFormula || '=VALOR DO BABADO + VALOR DO TAMPO + VALOR DA SOBREPOSIÇÃO + 20');
      setValorSemSobreposicaoFormula(REGRAS_CALCULO_PADRAO_MESA.valorSemSobreposicaoFormula || '=VALOR DO BABADO + VALOR DO TAMPO + 20');
      setTaxaSobreposicaoM2(32);
      setTaxaAdicionalAcabamento(20);
      setValoresTeste({
        frente: '2',
        lateral: '1',
        altura: '0.75',
        caimento: '0.30',
        babado: '12',
        preco_venda: '45',
      });
    }
    setErroFormula(null);
  }, [initialFormula, isOpen]);

  // Carrega produtos para permitir buscar Preço de Venda
  useEffect(() => {
    if (isOpen) {
      ApiService.getProducts()
        .then((data) => {
          if (Array.isArray(data)) {
            setProdutosCatalogo(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSelecionarProdutoParaM2 = (prodId: string) => {
    setProdutoSelecionadoId(prodId);
    const prod = produtosCatalogo.find((p) => p.id === prodId);
    if (prod) {
      const precoVenda = (prod.precoVenda !== undefined && Number(prod.precoVenda) > 0)
        ? Number(prod.precoVenda)
        : (Number(prod.valorUnitario) || 0);
      setValorM2Teste(String(precoVenda));
      setValoresTeste((prev) => ({
        ...prev,
        preco_venda: String(precoVenda),
      }));
    }
  };

  const handleAplicarPresetMesaPadrao = () => {
    setTitulo(FORMULA_PADRAO_MESA.titulo);
    setDescricao(FORMULA_PADRAO_MESA.descricao || '');
    setCampos(FORMULA_PADRAO_MESA.campos);
    setFormulaExpressao(FORMULA_PADRAO_MESA.formulaExpressao);
    setFormulaTexto(FORMULA_PADRAO_MESA.formulaTexto || '');
    setPermiteSobreposicao(true);
    setTamanhoBabadoFormula(REGRAS_CALCULO_PADRAO_MESA.tamanhoBabadoFormula || '');
    setValorBabadoFormula(REGRAS_CALCULO_PADRAO_MESA.valorBabadoFormula || '');
    setValorTampoFormula(REGRAS_CALCULO_PADRAO_MESA.valorTampoFormula || '');
    setValorSobreposicaoFormula(REGRAS_CALCULO_PADRAO_MESA.valorSobreposicaoFormula || '');
    setValorComSobreposicaoFormula(REGRAS_CALCULO_PADRAO_MESA.valorComSobreposicaoFormula || '');
    setValorSemSobreposicaoFormula(REGRAS_CALCULO_PADRAO_MESA.valorSemSobreposicaoFormula || '');
    setTaxaSobreposicaoM2(32);
    setTaxaAdicionalAcabamento(20);
    setValoresTeste({
      frente: '2',
      lateral: '1',
      altura: '0.75',
      caimento: '0.30',
      babado: '12',
      preco_venda: '45',
    });
    setErroFormula(null);
  };

  const handleAplicarPresetMesaRedonda = () => {
    setTitulo(FORMULA_MESA_REDONDA.titulo);
    setDescricao(FORMULA_MESA_REDONDA.descricao || '');
    setCampos(FORMULA_MESA_REDONDA.campos);
    setFormulaExpressao(FORMULA_MESA_REDONDA.formulaExpressao);
    setFormulaTexto(FORMULA_MESA_REDONDA.formulaTexto || '');
    setPermiteSobreposicao(true);
    setTamanhoBabadoFormula(REGRAS_CALCULO_MESA_REDONDA.tamanhoBabadoFormula || '');
    setValorBabadoFormula(REGRAS_CALCULO_MESA_REDONDA.valorBabadoFormula || '');
    setValorTampoFormula(REGRAS_CALCULO_MESA_REDONDA.valorTampoFormula || '');
    setValorSobreposicaoFormula(REGRAS_CALCULO_MESA_REDONDA.valorSobreposicaoFormula || '');
    setValorComSobreposicaoFormula(REGRAS_CALCULO_MESA_REDONDA.valorComSobreposicaoFormula || '');
    setValorSemSobreposicaoFormula(REGRAS_CALCULO_MESA_REDONDA.valorSemSobreposicaoFormula || '');
    setTaxaSobreposicaoM2(32);
    setTaxaAdicionalAcabamento(20);
    setValoresTeste({
      frente: '1.5',
      lateral: '1.5',
      altura: '0.8',
      caimento: '0.30',
      babado: '10',
      preco_venda: '32',
    });
    setErroFormula(null);
  };

  const handleAplicarPresetRetro = () => {
    setTitulo(FORMULA_MESA_RETRO.titulo);
    setDescricao(FORMULA_MESA_RETRO.descricao || '');
    setCampos(FORMULA_MESA_RETRO.campos);
    setFormulaExpressao(FORMULA_MESA_RETRO.formulaExpressao);
    setFormulaTexto(FORMULA_MESA_RETRO.formulaTexto || '');
    setPermiteSobreposicao(true);
    setTamanhoBabadoFormula(REGRAS_CALCULO_MESA_RETRO.tamanhoBabadoFormula || '');
    setValorBabadoFormula(REGRAS_CALCULO_MESA_RETRO.valorBabadoFormula || '');
    setValorTampoFormula(REGRAS_CALCULO_MESA_RETRO.valorTampoFormula || '');
    setValorSobreposicaoFormula(REGRAS_CALCULO_MESA_RETRO.valorSobreposicaoFormula || '');
    setValorComSobreposicaoFormula(REGRAS_CALCULO_MESA_RETRO.valorComSobreposicaoFormula || '');
    setValorSemSobreposicaoFormula(REGRAS_CALCULO_MESA_RETRO.valorSemSobreposicaoFormula || '');
    setTaxaSobreposicaoM2(32);
    setTaxaAdicionalAcabamento(20);
    setValoresTeste({
      frente: '2.8',
      lateral: '1.7',
      altura: '0.8',
      caimento: '0.5',
      babado: '21',
      preco_venda: '32',
    });
    setErroFormula(null);
  };

  const handleAplicarPresetMesaBabado = () => {
    setTitulo(FORMULA_MESA_BABADO.titulo);
    setDescricao(FORMULA_MESA_BABADO.descricao || '');
    setCampos(FORMULA_MESA_BABADO.campos);
    setFormulaExpressao(FORMULA_MESA_BABADO.formulaExpressao);
    setFormulaTexto(FORMULA_MESA_BABADO.formulaTexto || '');
    setPermiteSobreposicao(false);
    setTamanhoBabadoFormula(REGRAS_CALCULO_MESA_BABADO.tamanhoBabadoFormula || '');
    setValorBabadoFormula(REGRAS_CALCULO_MESA_BABADO.valorBabadoFormula || '');
    setValorTampoFormula(REGRAS_CALCULO_MESA_BABADO.valorTampoFormula || '');
    setValorSobreposicaoFormula(REGRAS_CALCULO_MESA_BABADO.valorSobreposicaoFormula || '');
    setValorComSobreposicaoFormula(REGRAS_CALCULO_MESA_BABADO.valorComSobreposicaoFormula || '');
    setValorSemSobreposicaoFormula(REGRAS_CALCULO_MESA_BABADO.valorSemSobreposicaoFormula || '');
    setTaxaSobreposicaoM2(32);
    setTaxaAdicionalAcabamento(20);
    setValoresTeste({
      frente: '2.0',
      lateral: '1.0',
      altura: '0.8',
      qtd_babado: '2',
      preco_venda: '35',
    });
    setErroFormula(null);
  };

  const handleAplicarPresetCilindro = () => {
    setTitulo(FORMULA_CILINDRO.titulo);
    setDescricao(FORMULA_CILINDRO.descricao || '');
    setCampos(FORMULA_CILINDRO.campos);
    setFormulaExpressao(FORMULA_CILINDRO.formulaExpressao);
    setFormulaTexto(FORMULA_CILINDRO.formulaTexto || '');
    setPermiteSobreposicao(false);
    setTamanhoBabadoFormula(REGRAS_CALCULO_CILINDRO.tamanhoBabadoFormula || '');
    setValorBabadoFormula(REGRAS_CALCULO_CILINDRO.valorBabadoFormula || '');
    setValorTampoFormula(REGRAS_CALCULO_CILINDRO.valorTampoFormula || '');
    setValorSobreposicaoFormula(REGRAS_CALCULO_CILINDRO.valorSobreposicaoFormula || '');
    setValorComSobreposicaoFormula(REGRAS_CALCULO_CILINDRO.valorComSobreposicaoFormula || '');
    setValorSemSobreposicaoFormula(REGRAS_CALCULO_CILINDRO.valorSemSobreposicaoFormula || '');
    setTaxaSobreposicaoM2(32);
    setTaxaAdicionalAcabamento(0);
    setValoresTeste({
      largura: '1.47',
      altura: '0.60',
      preco_venda: '32',
    });
    setErroFormula(null);
  };

  const handleAplicarPresetCubo = () => {
    setTitulo(FORMULA_CUBO_MESA_VESTE.titulo);
    setDescricao(FORMULA_CUBO_MESA_VESTE.descricao || '');
    setCampos(FORMULA_CUBO_MESA_VESTE.campos);
    setFormulaExpressao(FORMULA_CUBO_MESA_VESTE.formulaExpressao);
    setFormulaTexto(FORMULA_CUBO_MESA_VESTE.formulaTexto || '');
    setPermiteSobreposicao(false);
    setTamanhoBabadoFormula(REGRAS_CALCULO_CUBO.tamanhoBabadoFormula || '');
    setValorBabadoFormula(REGRAS_CALCULO_CUBO.valorBabadoFormula || '');
    setValorTampoFormula(REGRAS_CALCULO_CUBO.valorTampoFormula || '');
    setValorSobreposicaoFormula(REGRAS_CALCULO_CUBO.valorSobreposicaoFormula || '');
    setValorComSobreposicaoFormula(REGRAS_CALCULO_CUBO.valorComSobreposicaoFormula || '');
    setValorSemSobreposicaoFormula(REGRAS_CALCULO_CUBO.valorSemSobreposicaoFormula || '');
    setTaxaSobreposicaoM2(0);
    setTaxaAdicionalAcabamento(0);
    setValoresTeste({
      medida: '1',
      altura: '1',
      tampo: '1',
      preco_venda: '30',
    });
    setErroFormula(null);
  };

  // Função para testar/avaliar a fórmula e os cálculos financeiros
  const testarCalculo = () => {
    try {
      setErroFormula(null);
      if (!formulaExpressao.trim()) {
        setErroFormula('Informe ou monte uma expressão matemática.');
        return;
      }

      const isRetro = (titulo || '').toLowerCase().includes('retrô') ||
        (titulo || '').toLowerCase().includes('retro') ||
        (descricao || '').toLowerCase().includes('retrô') ||
        (descricao || '').toLowerCase().includes('retro') ||
        tamanhoBabadoFormula.includes('3.14') ||
        tamanhoBabadoFormula.includes('3,14') ||
        tamanhoBabadoFormula.toLowerCase().includes('w66');

      const isRedonda = !isRetro && (
        (titulo || '').toLowerCase().includes('redond') ||
        (descricao || '').toLowerCase().includes('redond') ||
        tamanhoBabadoFormula.toLowerCase().includes('diâmetro') ||
        tamanhoBabadoFormula.toLowerCase().includes('diametro')
      );

      const isBabado = !isRetro && !isRedonda && (
        (titulo || '').toLowerCase().includes('babado') ||
        (descricao || '').toLowerCase().includes('babado')
      );

      const isCilindro = !isRetro && !isRedonda && !isBabado && (
        (titulo || '').toLowerCase().includes('cilindro') ||
        (descricao || '').toLowerCase().includes('cilindro')
      );

      const isCubo = !isRetro && !isRedonda && !isBabado && !isCilindro && (
        (titulo || '').toLowerCase().includes('cubo') ||
        (titulo || '').toLowerCase().includes('mesa veste') ||
        (descricao || '').toLowerCase().includes('cubo') ||
        (descricao || '').toLowerCase().includes('mesa veste')
      );

      // Valores numéricos dos campos
      const f = parseFloat(String(valoresTeste.frente || '0').replace(',', '.')) || 0;
      const l = parseFloat(String(valoresTeste.lateral || '0').replace(',', '.')) || 0;
      const a = parseFloat(String(valoresTeste.altura || '0').replace(',', '.')) || 0;
      const c = parseFloat(String(valoresTeste.caimento || '0').replace(',', '.')) || 0;
      const qtdBabado = Math.max(2, parseInt(String(valoresTeste.qtd_babado || '2')) || 2);

      const bCalc = (f > 0 || l > 0)
        ? (isRetro
            ? Math.ceil(((f + 0.5) * 3.14) * 2)
            : (isRedonda
                ? Math.ceil(((f > 0 ? f : l) * 3.14) * 2)
                : (isBabado
                    ? (2 * ((2 * f) + (2 * l)))
                    : Math.ceil(((f + l) * 2) * 2))))
        : 0;
      const b = parseFloat(String(valoresTeste.babado || bCalc).replace(',', '.')) || bCalc;
      // Ao calcular "Valor m²", busca pelo Preço de Venda:
      const m2 = parseFloat(String(valoresTeste.preco_venda || valorM2Teste || '32').replace(',', '.')) || 32;

      // Substitui os nomes dos campos pelos valores numéricos de teste
      let expr = formulaExpressao.toLowerCase();
      campos.forEach((campo) => {
        let val = parseFloat(String(valoresTeste[campo.id] || '0').replace(',', '.')) || 0;
        if (campo.id === 'babado' && val === 0 && bCalc > 0) {
          val = bCalc;
        }
        if (campo.id === 'preco_venda' && val === 0) {
          val = m2;
        }
        if (campo.id === 'qtd_babado' && val === 0) {
          val = qtdBabado;
        }
        const regex = new RegExp(`\\b${campo.id.toLowerCase()}\\b`, 'g');
        expr = expr.replace(regex, `(${val})`);
      });

      // Também substitui variáveis ou referências diretas a Preço de Venda / Valor m²
      expr = expr.replace(/\b(preco_venda|precovenda|precodevenda|valor_do_m2|valor_m2|valordom2|m2)\b/g, `(${m2})`);

      // Permite apenas números, operadores básicos e parênteses
      if (!/^[\d\s+\-*/().]+$/.test(expr)) {
        setErroFormula('A fórmula contém símbolos inválidos ou campos não identificados.');
        return;
      }

      // Avaliação segura de expressão puramente aritmética
      // eslint-disable-next-line no-new-func
      const calcResult = Function(`"use strict"; return (${expr});`)();
      if (typeof calcResult === 'number' && !isNaN(calcResult) && isFinite(calcResult)) {
        setResultadoTeste(Number(calcResult.toFixed(4)));
      } else {
        setErroFormula('O resultado da fórmula é inválido.');
      }

      let valBabado = 0;
      let valTampo = 0;
      let valSobreposicao = 0;

      if (isRetro) {
        // Mesa Retrô:
        valBabado = Math.ceil(b * Math.max(0, a - 0.25) * m2);
        valTampo = Math.ceil((f + 0.5) * (l + 0.5) * m2);
        valSobreposicao = Math.ceil((f + 0.5 + c) * (l + 0.5 + c) * m2);
      } else if (isRedonda) {
        // Mesa Redonda:
        const diam = f > 0 ? f : l;
        valBabado = Math.ceil(b * a * m2);
        valTampo = Math.ceil(diam * diam * m2);
        valSobreposicao = Math.ceil((diam + c) * (diam + c) * (taxaSobreposicaoM2 || 32));
      } else if (isBabado) {
        // Mesa Babado:
        const perimetro = (2 * f) + (2 * l);
        const valFaixa = Math.ceil(perimetro * a * m2);
        const valFaixaBabado = Math.ceil((perimetro * 2) * (a / (qtdBabado || 1)) * m2);
        valBabado = valFaixaBabado * qtdBabado;
        valTampo = Math.ceil(f * l * m2);
        const totalBabado = valTampo + valFaixa + valBabado + (20 * qtdBabado);

        setSimulacaoFinanceira({
          tamanhoBabado: perimetro * 2,
          valorBabado: valBabado,
          valorTampo: valTampo,
          valorSobreposicao: valFaixa,
          valorComSobreposicao: totalBabado,
          valorSemSobreposicao: totalBabado,
          valorFinalCalculado: totalBabado,
        });
        return;
      } else if (isCilindro) {
        // Cálculo de Cilindro:
        const larg = parseFloat(String(valoresTeste.largura || valoresTeste.lateral || valoresTeste.frente || '0').replace(',', '.')) || 0;
        const alt = parseFloat(String(valoresTeste.altura || '0').replace(',', '.')) || 0;
        const tampo = larg / 3;
        const valBase = larg * alt * m2;
        const valTampo = Math.pow(tampo, 2) * m2;
        const totalCilindro = Math.ceil(valBase + valTampo);

        setSimulacaoFinanceira({
          tamanhoBabado: tampo,
          valorBabado: 0,
          valorTampo: valTampo,
          valorSobreposicao: valBase,
          valorComSobreposicao: totalCilindro,
          valorSemSobreposicao: totalCilindro,
          valorFinalCalculado: totalCilindro,
        });
        return;
      } else if (isCubo) {
        // Cálculo Cubo/Mesa Veste:
        // calculo = (medida * 4) (não arredonde para cima)
        // valor = (altura * calculo * preço de venda/preço expresso)
        // valor tampo = (tampo * tampo * preço de venda/preço expresso)
        // Total = (valor + valor tampo) arredonde pra cima
        const med = parseFloat(String(valoresTeste.medida || valoresTeste.frente || '0').replace(',', '.')) || 0;
        const alt = parseFloat(String(valoresTeste.altura || '0').replace(',', '.')) || 0;
        const tamp = parseFloat(String(valoresTeste.tampo || valoresTeste.medida || valoresTeste.frente || '0').replace(',', '.')) || 0;
        const calc = med * 4; // Não arredonda para cima
        const valCorpo = (alt > 0 && calc > 0 && m2 > 0) ? Math.ceil(alt * calc * m2) : 0;
        const valT = (tamp > 0 && m2 > 0) ? Math.ceil(tamp * tamp * m2) : 0;
        const totalCubo = (valCorpo > 0 || valT > 0) ? (valCorpo + valT) : 0;

        setSimulacaoFinanceira({
          tamanhoBabado: calc,
          valorBabado: valCorpo,
          valorTampo: valT,
          valorSobreposicao: 0,
          valorComSobreposicao: totalCubo,
          valorSemSobreposicao: totalCubo,
          valorFinalCalculado: totalCubo,
        });
        return;
      } else {
        // Mesa Retangular:
        valBabado = Math.ceil(b * a * m2);
        valTampo = Math.ceil(f * l * m2);
        valSobreposicao = Math.ceil((f + c) * (l + c) * (taxaSobreposicaoM2 || 32));
      }

      const adicional = taxaAdicionalAcabamento || 20;
      const valComSobrep = (valBabado > 0 || valTampo > 0 || valSobreposicao > 0)
        ? (valBabado + valTampo + valSobreposicao + adicional)
        : 0;
      const valSemSobrep = (valBabado > 0 || valTampo > 0)
        ? (valBabado + valTampo + adicional)
        : 0;
      const valFinal = comSobreposicaoTeste ? valComSobrep : valSemSobrep;

      setSimulacaoFinanceira({
        tamanhoBabado: b,
        valorBabado: valBabado,
        valorTampo: valTampo,
        valorSobreposicao: valSobreposicao,
        valorComSobreposicao: valComSobrep,
        valorSemSobreposicao: valSemSobrep,
        valorFinalCalculado: valFinal,
      });
    } catch (err: any) {
      setErroFormula(`Erro na fórmula: ${err.message || 'expressão inválida'}`);
      setResultadoTeste(null);
      setSimulacaoFinanceira(null);
    }
  };

  type TargetCalcField =
    | 'babado'
    | 'valorBabado'
    | 'valorTampo'
    | 'valorSobreposicao'
    | 'valorComSobreposicao'
    | 'valorSemSobreposicao';
  const [activeTargetField, setActiveTargetField] = useState<TargetCalcField>('babado');

  const handleInserirTokenNoCampoAtivo = (token: string) => {
    switch (activeTargetField) {
      case 'babado':
        setTamanhoBabadoFormula((prev) => `${prev ? prev.trim() : ''}${token.startsWith(' ') || !prev ? '' : ' '}${token} `.trim());
        break;
      case 'valorBabado':
        setValorBabadoFormula((prev) => `${prev ? prev.trim() : ''}${token.startsWith(' ') || !prev ? '' : ' '}${token} `.trim());
        break;
      case 'valorTampo':
        setValorTampoFormula((prev) => `${prev ? prev.trim() : ''}${token.startsWith(' ') || !prev ? '' : ' '}${token} `.trim());
        break;
      case 'valorSobreposicao':
        setValorSobreposicaoFormula((prev) => `${prev ? prev.trim() : ''}${token.startsWith(' ') || !prev ? '' : ' '}${token} `.trim());
        break;
      case 'valorComSobreposicao':
        setValorComSobreposicaoFormula((prev) => `${prev ? prev.trim() : ''}${token.startsWith(' ') || !prev ? '' : ' '}${token} `.trim());
        break;
      case 'valorSemSobreposicao':
        setValorSemSobreposicaoFormula((prev) => `${prev ? prev.trim() : ''}${token.startsWith(' ') || !prev ? '' : ' '}${token} `.trim());
        break;
    }
  };

  const handleLimparCampoAtivo = () => {
    switch (activeTargetField) {
      case 'babado': setTamanhoBabadoFormula(''); break;
      case 'valorBabado': setValorBabadoFormula(''); break;
      case 'valorTampo': setValorTampoFormula(''); break;
      case 'valorSobreposicao': setValorSobreposicaoFormula(''); break;
      case 'valorComSobreposicao': setValorComSobreposicaoFormula(''); break;
      case 'valorSemSobreposicao': setValorSemSobreposicaoFormula(''); break;
    }
  };

  const handleInserirSinal = (sinal: string) => {
    handleInserirTokenNoCampoAtivo(sinal);
    setFormulaExpressao((prev) => `${prev.trim()} ${sinal} `.trim());
  };

  const handleInserirCampoNaFormula = (campoId: string) => {
    handleInserirTokenNoCampoAtivo(campoId.toUpperCase());
    setFormulaExpressao((prev) => `${prev.trim()} ${campoId} `.trim());
  };

  const handleAdicionarCampo = () => {
    if (!novoCampoNome.trim()) return;
    const cleanId = novoCampoNome
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_');

    if (campos.some((c) => c.id === cleanId)) {
      setErroFormula('Já existe uma área/campo com este identificador.');
      return;
    }

    const novoCampo: MeasurementFieldDef = {
      id: cleanId,
      label: novoCampoNome.trim(),
      unidade: novoCampoUnidade || 'm',
      obrigatorio: true,
    };

    setCampos((prev) => [...prev, novoCampo]);
    setValoresTeste((prev) => ({ ...prev, [cleanId]: '1' }));
    setNovoCampoNome('');
    setErroFormula(null);
  };

  const handleRemoverCampo = (campoId: string) => {
    if (campos.length <= 1) {
      setErroFormula('A fórmula precisa ter pelo menos 1 área/campo definido.');
      return;
    }
    setCampos((prev) => prev.filter((c) => c.id !== campoId));
    setErroFormula(null);
  };

  const handleSalvar = async () => {
    if (!titulo.trim()) {
      setErroFormula('Por favor, informe o título do cálculo.');
      return;
    }
    if (campos.length === 0) {
      setErroFormula('Cadastre ao menos uma área/variável de medida para este cálculo.');
      return;
    }
    if (!formulaExpressao.trim()) {
      setErroFormula('Monte ou informe a expressão da fórmula de cálculo.');
      return;
    }

    setIsSaving(true);
    setErroFormula(null);
    try {
      const id = initialFormula?.id || `formula_${Date.now()}`;
      const formulaToSave: MeasurementFormula = {
        id,
        titulo: titulo.trim(),
        descricao: descricao.trim() || `Fórmula personalizada: ${titulo.trim()}`,
        tipo: id === 'calculo_mesa' ? 'mesa' : 'personalizado',
        campos,
        formulaExpressao: formulaExpressao.trim(),
        formulaTexto: formulaTexto.trim() || formulaExpressao.trim(),
        permiteSobreposicao: Boolean(permiteSobreposicao),
        regrasFinanceiras: {
          tamanhoBabadoFormula: (tamanhoBabadoFormula || '').trim(),
          valorBabadoFormula: (valorBabadoFormula || '').trim(),
          valorTampoFormula: (valorTampoFormula || '').trim(),
          valorSobreposicaoFormula: (valorSobreposicaoFormula || '').trim(),
          valorComSobreposicaoFormula: (valorComSobreposicaoFormula || '').trim(),
          valorSemSobreposicaoFormula: (valorSemSobreposicaoFormula || '').trim(),
          taxaSobreposicaoM2: Number(taxaSobreposicaoM2) || 0,
          taxaAdicionalAcabamento: Number(taxaAdicionalAcabamento) || 0,
        },
        ativo: true,
        criadoPor: initialFormula?.criadoPor || operatorName,
        atualizadoEm: new Date().toISOString(),
      };

      await onSave(formulaToSave);
      onClose();
    } catch (err: any) {
      setErroFormula(`Erro ao salvar fórmula: ${err?.message || 'Erro inesperado'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col animate-fadeIn">
      {/* CABEÇALHO EM TELA CHEIA */}
      <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-fuchsia-700 text-white flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl border border-white/20 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-xs active:scale-95"
            title="Voltar para Estoque"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-xl font-black tracking-tight">
                {initialFormula ? 'Editar Cálculo de Medidas' : 'Novo Cálculo de Medidas'}
              </h2>
              <span className="bg-white/20 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border border-white/20">
                Exclusivo Admin / Developer
              </span>
            </div>
            <p className="text-xs text-blue-100 mt-0.5">
              Defina o título, as áreas e variáveis a serem calculadas, as expressões matemáticas e as regras de precificação.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-2xl transition cursor-pointer"
          title="Fechar e voltar"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* CORPO EM TELA CHEIA */}
      <div className="p-4 sm:p-7 space-y-6 flex-1">
          {/* PRESETS DE FÓRMULAS PRÉ-CONFIGURADAS */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-fuchsia-600" />
              <span className="text-xs font-bold text-slate-800">Modelos Oficiais de Cálculo:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAplicarPresetMesaPadrao}
                className="px-2.5 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 hover:border-blue-400 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1.5"
                title="Carregar fórmula para Toalha de Mesa Retangular"
              >
                <span>📐</span>
                <span>Mesa Retangular</span>
              </button>
              <button
                type="button"
                onClick={handleAplicarPresetMesaRedonda}
                className="px-2.5 py-1.5 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 hover:border-purple-400 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1.5"
                title="Carregar fórmula para Mesa Redonda"
              >
                <span>⭕</span>
                <span>Mesa Redonda</span>
              </button>
              <button
                type="button"
                onClick={handleAplicarPresetRetro}
                className="px-2.5 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-xs font-black transition shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1.5"
                title="Carregar fórmula oficial para Mesa Retrô"
              >
                <span>✨</span>
                <span>Mesa Retrô</span>
              </button>
              <button
                type="button"
                onClick={handleAplicarPresetMesaBabado}
                className="px-2.5 py-1.5 bg-white hover:bg-pink-50 text-pink-700 border border-pink-200 hover:border-pink-400 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1.5"
                title="Carregar fórmula para Mesa com Babado"
              >
                <span>🎀</span>
                <span>Mesa Babado</span>
              </button>
              <button
                type="button"
                onClick={handleAplicarPresetCilindro}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1.5"
                title="Carregar fórmula para Cilindro"
              >
                <span>🥫</span>
                <span>Cilindro</span>
              </button>
            </div>
          </div>

          {/* 1. TÍTULO E DESCRIÇÃO DO CÁLCULO */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8 space-y-1">
              <label className="block text-xs font-black uppercase text-slate-700">
                Título do Cálculo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Cálculo de Mesa, Cilindro, Painel Redondo..."
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-4 space-y-1">
              <label className="block text-xs font-black uppercase text-slate-700">
                Permite Sobreposição?
              </label>
              <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={permiteSobreposicao}
                  onChange={(e) => setPermiteSobreposicao(e.target.checked)}
                  className="w-4 h-4 text-fuchsia-600 rounded border-slate-300 focus:ring-fuchsia-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">Sim (Caimento/Bainha)</span>
              </label>
            </div>
            <div className="sm:col-span-12 space-y-1">
              <label className="block text-xs font-black uppercase text-slate-700">
                Descrição ou Explicativo da Regra
              </label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Fórmula aplicada para toalhas retangulares com saia e tampo personalizado."
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* 2. ÁREAS / VARIÁVEIS A SEREM CALCULADAS */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
                  <span>📐</span>
                  <span>Áreas e Variáveis a serem Calculadas</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Esses serão os campos que o operador preencherá na Ordem de Serviço.
                </p>
              </div>

              {/* Botões rápidos de sugestão */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 mr-1">Sugeridos:</span>
                {CAMPOS_PADRAO_SUGERIDOS.slice(0, 6).map((sug) => {
                  const jaExiste = campos.some((c) => c.id === sug.id);
                  if (jaExiste) return null;
                  return (
                    <button
                      key={sug.id}
                      type="button"
                      onClick={() => {
                        setCampos((prev) => [...prev, sug]);
                        setValoresTeste((prev) => ({ ...prev, [sug.id]: '1' }));
                      }}
                      className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-md text-[10px] font-bold hover:bg-blue-50 hover:text-blue-700 transition"
                    >
                      + {sug.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* REGRA OFICIAL DO VALOR M2: BUSCA PELO PREÇO DE VENDA */}
            <div className="bg-blue-50/90 border border-blue-200/90 rounded-xl p-2.5 flex items-start gap-2 text-xs text-blue-900 shadow-2xs">
              <span className="text-base shrink-0">🏷️</span>
              <div>
                <span className="font-black uppercase tracking-tight">Regra de Cálculo de Valor m²:</span>
                <span className="font-medium ml-1">
                  Ao calcular o <strong>"Valor m²"</strong> nas fórmulas (para Babado, Tampo ou Saia), o sistema busca e aplica automaticamente o <strong>preço de venda</strong> do produto selecionado no catálogo/estoque.
                </span>
              </div>
            </div>

            {/* LISTA DE CAMPOS ATUAIS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {campos.map((campo, index) => (
                <div
                  key={campo.id}
                  className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between shadow-2xs group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-xs font-black text-slate-900">{campo.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        id: {campo.id} ({campo.unidade || 'm'})
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleInserirCampoNaFormula(campo.id)}
                      title={`Inserir "${campo.id}" na fórmula`}
                      className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-extrabold transition cursor-pointer"
                    >
                      + na Fórmula
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoverCampo(campo.id)}
                      title="Excluir este campo"
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ADICIONAR NOVO CAMPO */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
              <input
                type="text"
                value={novoCampoNome}
                onChange={(e) => setNovoCampoNome(e.target.value)}
                placeholder="Nome da nova área (ex: Diâmetro, Aba, Folga...)"
                className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdicionarCampo();
                  }
                }}
              />
              <select
                value={novoCampoUnidade}
                onChange={(e) => setNovoCampoUnidade(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="m">m (metros)</option>
                <option value="cm">cm</option>
                <option value="mm">mm</option>
                <option value="un">un</option>
              </select>
              <button
                type="button"
                onClick={handleAdicionarCampo}
                disabled={!novoCampoNome.trim()}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition ${
                  novoCampoNome.trim()
                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Área</span>
              </button>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 3. BASE PARA CALCULAR INDIVIDUALMENTE */}
          {/* ======================================================== */}
          <div className="bg-white border-2 border-fuchsia-200/90 rounded-3xl p-5 sm:p-7 space-y-5 shadow-xs animate-fadeIn">
            {/* TÍTULO PRINCIPAL CENTRALIZADO */}
            <h2 className="text-xl sm:text-2xl font-black uppercase text-center tracking-tight text-[#832655]">
              BASE PARA CALCULAR INDIVIDUALMENTE
            </h2>

            {/* GRADE COM OS 6 CAMPOS DE VALORES INDIVIDUAIS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
              {/* 1. BABADO */}
              <div className="space-y-1">
                <label
                  onClick={() => setActiveTargetField('babado')}
                  className="block text-[11px] font-black uppercase text-[#832655] text-center truncate cursor-pointer hover:underline"
                >
                  BABADO
                </label>
                <input
                  type="text"
                  value={tamanhoBabadoFormula}
                  onFocus={() => setActiveTargetField('babado')}
                  onChange={(e) => setTamanhoBabadoFormula(e.target.value)}
                  placeholder="=(SOMA(FRENTE:LATERAL)*2)*2"
                  className={`w-full px-3 py-2 rounded-2xl text-xs font-black font-mono text-center transition shadow-2xs focus:outline-none cursor-text ${
                    activeTargetField === 'babado'
                      ? 'bg-fuchsia-50/90 border-2 border-fuchsia-600 ring-2 ring-fuchsia-400/40 text-fuchsia-950'
                      : 'bg-white border-2 border-fuchsia-300 text-slate-800 hover:border-fuchsia-400'
                  }`}
                />
              </div>

              {/* 2. VALOR DO BABADO */}
              <div className="space-y-1">
                <label
                  onClick={() => setActiveTargetField('valorBabado')}
                  className="block text-[11px] font-black uppercase text-[#832655] text-center truncate cursor-pointer hover:underline"
                >
                  VALOR DO BABADO
                </label>
                <input
                  type="text"
                  value={valorBabadoFormula}
                  onFocus={() => setActiveTargetField('valorBabado')}
                  onChange={(e) => setValorBabadoFormula(e.target.value)}
                  placeholder="=ARREDONDAR.PARA.CIMA((BABADO*ALTURA*VALOR DO M2);0)"
                  className={`w-full px-3 py-2 rounded-2xl text-xs font-black font-mono text-center transition shadow-2xs focus:outline-none cursor-text ${
                    activeTargetField === 'valorBabado'
                      ? 'bg-fuchsia-50/90 border-2 border-fuchsia-600 ring-2 ring-fuchsia-400/40 text-fuchsia-950'
                      : 'bg-white border-2 border-fuchsia-300 text-slate-800 hover:border-fuchsia-400'
                  }`}
                />
              </div>

              {/* 3. VALOR DO TAMPO */}
              <div className="space-y-1">
                <label
                  onClick={() => setActiveTargetField('valorTampo')}
                  className="block text-[11px] font-black uppercase text-[#832655] text-center truncate cursor-pointer hover:underline"
                >
                  VALOR DO TAMPO
                </label>
                <input
                  type="text"
                  value={valorTampoFormula}
                  onFocus={() => setActiveTargetField('valorTampo')}
                  onChange={(e) => setValorTampoFormula(e.target.value)}
                  placeholder="=ARREDONDAR.PARA.CIMA((FRENTE*LATERAL*VALOR DO M2);0)"
                  className={`w-full px-3 py-2 rounded-2xl text-xs font-black font-mono text-center transition shadow-2xs focus:outline-none cursor-text ${
                    activeTargetField === 'valorTampo'
                      ? 'bg-fuchsia-50/90 border-2 border-fuchsia-600 ring-2 ring-fuchsia-400/40 text-fuchsia-950'
                      : 'bg-white border-2 border-fuchsia-300 text-slate-800 hover:border-fuchsia-400'
                  }`}
                />
              </div>

              {/* 4. VALOR DO SOBREPOSIÇÃO */}
              <div className="space-y-1">
                <label
                  onClick={() => setActiveTargetField('valorSobreposicao')}
                  className="block text-[11px] font-black uppercase text-[#832655] text-center truncate cursor-pointer hover:underline"
                >
                  VALOR SOBREPOSIÇÃO
                </label>
                <input
                  type="text"
                  value={valorSobreposicaoFormula}
                  onFocus={() => setActiveTargetField('valorSobreposicao')}
                  onChange={(e) => setValorSobreposicaoFormula(e.target.value)}
                  placeholder="=ARREDONDAR.PARA.CIMA((SOMA(FRENTE;CAIMENTO)*SOMA(LATERAL;CAIMENTO))*32;0)"
                  className={`w-full px-3 py-2 rounded-2xl text-xs font-black font-mono text-center transition shadow-2xs focus:outline-none cursor-text ${
                    activeTargetField === 'valorSobreposicao'
                      ? 'bg-fuchsia-50/90 border-2 border-fuchsia-600 ring-2 ring-fuchsia-400/40 text-fuchsia-950'
                      : 'bg-white border-2 border-fuchsia-300 text-slate-800 hover:border-fuchsia-400'
                  }`}
                />
              </div>

              {/* 5. C/ SOBREPOSIÇÃO */}
              <div className="space-y-1">
                <label
                  onClick={() => setActiveTargetField('valorComSobreposicao')}
                  className="block text-[11px] font-black uppercase text-[#832655] text-center truncate cursor-pointer hover:underline"
                >
                  C/ SOBREPOSIÇÃO
                </label>
                <input
                  type="text"
                  value={valorComSobreposicaoFormula}
                  onFocus={() => setActiveTargetField('valorComSobreposicao')}
                  onChange={(e) => setValorComSobreposicaoFormula(e.target.value)}
                  placeholder="=VALOR DO BABADO + VALOR DO TAMPO + VALOR DA SOBREPOSIÇÃO + 20"
                  className={`w-full px-3 py-2 rounded-2xl text-xs font-black font-mono text-center transition shadow-2xs focus:outline-none cursor-text ${
                    activeTargetField === 'valorComSobreposicao'
                      ? 'bg-fuchsia-50/90 border-2 border-fuchsia-600 ring-2 ring-fuchsia-400/40 text-fuchsia-950'
                      : 'bg-white border-2 border-fuchsia-300 text-slate-800 hover:border-fuchsia-400'
                  }`}
                />
              </div>

              {/* 6. S/ SOBREPOSIÇÃO */}
              <div className="space-y-1">
                <label
                  onClick={() => setActiveTargetField('valorSemSobreposicao')}
                  className="block text-[11px] font-black uppercase text-[#832655] text-center truncate cursor-pointer hover:underline"
                >
                  S/ SOBREPOSIÇÃO
                </label>
                <input
                  type="text"
                  value={valorSemSobreposicaoFormula}
                  onFocus={() => setActiveTargetField('valorSemSobreposicao')}
                  onChange={(e) => setValorSemSobreposicaoFormula(e.target.value)}
                  placeholder="=VALOR DO BABADO + VALOR DO TAMPO + 20"
                  className={`w-full px-3 py-2 rounded-2xl text-xs font-black font-mono text-center transition shadow-2xs focus:outline-none cursor-text ${
                    activeTargetField === 'valorSemSobreposicao'
                      ? 'bg-fuchsia-50/90 border-2 border-fuchsia-600 ring-2 ring-fuchsia-400/40 text-fuchsia-950'
                      : 'bg-white border-2 border-fuchsia-300 text-slate-800 hover:border-fuchsia-400'
                  }`}
                />
              </div>
            </div>

            {/* PAINEL DE TECLADO / SINAIS E OPERADORES MATEMÁTICOS DISPONÍVEIS */}
            <div className="bg-gradient-to-r from-fuchsia-50/50 via-purple-50/30 to-pink-50/50 border border-fuchsia-200/90 rounded-3xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-black uppercase text-fuchsia-950 flex items-center gap-1.5">
                    <span>🧮</span>
                    <span>Sinais e Operadores Matemáticos Disponíveis</span>
                  </h3>
                  <p className="text-[11px] text-fuchsia-900/80 font-medium">
                    Clique nos botões de sinais ou campos para construir a expressão matemática do cálculo selecionado acima.
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-fuchsia-100 text-[#832655] border border-fuchsia-200">
                  Campo Ativo:{' '}
                  {activeTargetField === 'babado'
                    ? 'BABADO'
                    : activeTargetField === 'valorBabado'
                    ? 'VALOR DO BABADO'
                    : activeTargetField === 'valorTampo'
                    ? 'VALOR DO TAMPO'
                    : activeTargetField === 'valorSobreposicao'
                    ? 'VALOR SOBREPOSIÇÃO'
                    : activeTargetField === 'valorComSobreposicao'
                    ? 'C/ SOBREPOSIÇÃO'
                    : 'S/ SOBREPOSIÇÃO'}
                </span>
              </div>

              {/* LINHA 1: SINAIS E OPERADORES MATEMÁTICOS */}
              <div className="flex items-center gap-2 flex-wrap">
                {OPERADORES_MATEMATICOS.map((op) => (
                  <button
                    key={op.sinal}
                    type="button"
                    onClick={() => handleInserirTokenNoCampoAtivo(op.sinal)}
                    className="px-3 py-1.5 bg-white hover:bg-fuchsia-100 border border-fuchsia-300 text-fuchsia-950 rounded-xl font-mono text-xs font-black shadow-2xs hover:shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                    title={op.descricao}
                  >
                    <span>{op.sinal}</span>
                    <span className="text-[10px] text-fuchsia-700 font-sans font-bold">
                      {op.label.split(' ')[0]}
                    </span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleLimparCampoAtivo}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  title="Limpar campo ativo"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Limpar</span>
                </button>
              </div>

              {/* LINHA 2: VALORES CALCULADOS */}
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-fuchsia-200/60">
                {[
                  'BABADO',
                  'VALOR DO BABADO',
                  'VALOR DO TAMPO',
                  'VALOR DO SOBREPOSIÇÃO',
                  'C/ SOBREPOSIÇÃO',
                  'S/ SOBREPOSIÇÃO',
                  'PREÇO DE VENDA',
                  'VALOR DO M2',
                ].map((valBtn) => (
                  <button
                    key={valBtn}
                    type="button"
                    onClick={() => handleInserirTokenNoCampoAtivo(valBtn)}
                    className="px-3.5 py-1.5 bg-white hover:bg-[#832655] hover:text-white border-2 border-[#832655] text-[#832655] rounded-xl text-xs font-black uppercase shadow-2xs hover:shadow-xs transition active:scale-95 cursor-pointer"
                    title={`Inserir "${valBtn}" no campo ativo`}
                  >
                    {valBtn}
                  </button>
                ))}
              </div>

              {/* LINHA 3: ÁREAS E VARIÁVEIS DIMENSIONAIS */}
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-fuchsia-200/60">
                {campos.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleInserirTokenNoCampoAtivo(c.label.toUpperCase())}
                    className="px-3.5 py-1.5 bg-white hover:bg-[#832655] hover:text-white border-2 border-[#832655] text-[#832655] rounded-xl text-xs font-black uppercase shadow-2xs hover:shadow-xs transition active:scale-95 cursor-pointer"
                    title={`Inserir dimensão "${c.label}" no campo ativo`}
                  >
                    {c.label.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. SIMULADOR E TESTE DO CÁLCULO COMPLETO */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Simulador do Cálculo de Medidas em Tempo Real</span>
                </h3>
                <p className="text-[11px] text-emerald-900/80 font-medium">
                  Altere as medidas de teste e o valor unitário para simular tanto a metragem quadrada quanto os valores em R$.
                </p>
              </div>
              <button
                type="button"
                onClick={testarCalculo}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <Calculator className="w-4 h-4" />
                <span>Simular Cálculos</span>
              </button>
            </div>

            {/* SELETOR PARA BUSCAR PREÇO DE VENDA DO PRODUTO */}
            {produtosCatalogo.length > 0 && (
              <div className="bg-white/90 border border-emerald-300 rounded-xl p-2.5 flex items-center justify-between flex-wrap gap-2 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs text-emerald-950 font-black">
                  <span>🔍</span>
                  <span>Buscar Preço de Venda do Produto no Catálogo:</span>
                </div>
                <div className="flex-1 min-w-[240px]">
                  <select
                    value={produtoSelecionadoId}
                    onChange={(e) => handleSelecionarProdutoParaM2(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                  >
                    <option value="">Selecione um produto para puxar o Preço de Venda (m²)...</option>
                    {produtosCatalogo.map((prod) => {
                      const pv = (prod.precoVenda !== undefined && Number(prod.precoVenda) > 0)
                        ? Number(prod.precoVenda)
                        : (Number(prod.valorUnitario) || 0);
                      return (
                        <option key={prod.id} value={prod.id}>
                          {prod.descricao} — Preço de Venda: R$ {pv.toFixed(2)} {prod.unidade ? `(${prod.unidade})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}

            {/* ENTRADAS DO SIMULADOR */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {campos.map((campo) => (
                <div key={campo.id} className="space-y-0.5">
                  <label className="block text-[10px] font-black text-slate-700 uppercase truncate">
                    {campo.label} ({campo.unidade || 'm'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={valoresTeste[campo.id] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setValoresTeste((prev) => ({ ...prev, [campo.id]: val }));
                    }}
                    className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-center"
                  />
                </div>
              ))}

              {/* VALOR DO M2 / PREÇO DE VENDA TESTE */}
              <div className="space-y-0.5">
                <label className="block text-[10px] font-black text-slate-700 uppercase truncate" title="Preço de Venda por m²">
                  Valor m² (Preço Venda R$)
                </label>
                <input
                  type="number"
                  step="0.50"
                  value={valorM2Teste}
                  onChange={(e) => {
                    setValorM2Teste(e.target.value);
                    setValoresTeste((prev) => ({ ...prev, preco_venda: e.target.value }));
                  }}
                  className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-center"
                />
              </div>

              {/* OPÇÃO DE SOBREPOSIÇÃO NA SIMULAÇÃO */}
              <div className="space-y-0.5 col-span-2 sm:col-span-1 flex flex-col justify-end">
                <label className="flex items-center gap-1.5 p-1.5 bg-white border border-emerald-300 rounded-xl cursor-pointer text-[10px] font-black text-slate-800 h-[34px]">
                  <input
                    type="checkbox"
                    checked={comSobreposicaoTeste}
                    onChange={(e) => setComSobreposicaoTeste(e.target.checked)}
                    className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300"
                  />
                  <span>C/ Sobreposição</span>
                </label>
              </div>
            </div>

            {/* RESULTADOS DA SIMULAÇÃO (MESMO PADRÃO E TAMANHO DA TELA DE OS) */}
            {simulacaoFinanceira !== null && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-emerald-200">
                  <span className="text-[11px] font-black uppercase text-emerald-900">
                    Resultados Calculados (Arredondados para Cima)
                  </span>
                  {resultadoTeste !== null && (
                    <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md font-mono">
                      Cálculo: {resultadoTeste.toFixed(2)} m²
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end pt-1">
                  {/* 1. VALOR DO BABADO */}
                  <div>
                    <label className="block text-[10px] font-black text-fuchsia-900 uppercase mb-0.5 text-center truncate" title="VALOR DO BABADO">
                      VALOR DO BABADO
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`R$ ${simulacaoFinanceira.valorBabado.toFixed(2)}`}
                      className="w-full px-2 py-1.5 bg-white border border-fuchsia-300 rounded-xl text-xs font-black text-slate-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                    />
                  </div>

                  {/* 2. VALOR DO TAMPO */}
                  <div>
                    <label className="block text-[10px] font-black text-fuchsia-900 uppercase mb-0.5 text-center truncate" title="VALOR DO TAMPO">
                      VALOR DO TAMPO
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`R$ ${simulacaoFinanceira.valorTampo.toFixed(2)}`}
                      className="w-full px-2 py-1.5 bg-white border border-fuchsia-300 rounded-xl text-xs font-black text-slate-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                    />
                  </div>

                  {/* 3. VALOR DA SOBREPOSIÇÃO */}
                  <div>
                    <label className="block text-[10px] font-black text-fuchsia-900 uppercase mb-0.5 text-center truncate" title="VALOR DO SOBREPOSIÇÃO">
                      VALOR DO SOBREPOSIÇÃO
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`R$ ${simulacaoFinanceira.valorSobreposicao.toFixed(2)}`}
                      className="w-full px-2 py-1.5 bg-white border border-fuchsia-300 rounded-xl text-xs font-black text-slate-900 text-center shadow-2xs focus:outline-none cursor-default font-mono"
                    />
                  </div>

                  {/* 4. C/ SOBREPOSIÇÃO */}
                  <div>
                    <label className="block text-[10px] font-black text-fuchsia-900 uppercase mb-0.5 text-center truncate" title="SUBTOTAL COM SOBREPOSIÇÃO (+ R$ 20)">
                      C/ SOBREPOSIÇÃO
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`R$ ${simulacaoFinanceira.valorComSobreposicao.toFixed(2)}`}
                      className={`w-full px-2 py-1.5 rounded-xl text-xs font-black text-center shadow-2xs focus:outline-none cursor-default font-mono transition ${
                        comSobreposicaoTeste
                          ? 'bg-amber-100 text-amber-950 border-2 border-amber-500'
                          : 'bg-white border border-slate-300 text-slate-700'
                      }`}
                    />
                  </div>

                  {/* 5. S/ SOBREPOSIÇÃO */}
                  <div>
                    <label className="block text-[10px] font-black text-fuchsia-900 uppercase mb-0.5 text-center truncate" title="SUBTOTAL SEM SOBREPOSIÇÃO (+ R$ 20)">
                      S/ SOBREPOSIÇÃO
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`R$ ${simulacaoFinanceira.valorSemSobreposicao.toFixed(2)}`}
                      className={`w-full px-2 py-1.5 rounded-xl text-xs font-black text-center shadow-2xs focus:outline-none cursor-default font-mono transition ${
                        !comSobreposicaoTeste
                          ? 'bg-fuchsia-100 text-fuchsia-950 border-2 border-fuchsia-500'
                          : 'bg-white border border-slate-300 text-slate-700'
                      }`}
                    />
                  </div>

                  {/* 6. VALOR FINAL / VALOR DA PEÇA */}
                  <div>
                    <label className="block text-[10px] font-black text-fuchsia-900 uppercase mb-0.5 text-center truncate" title="VALOR FINAL DA PEÇA">
                      VALOR DA PEÇA
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`R$ ${simulacaoFinanceira.valorFinalCalculado.toFixed(2)}`}
                      className="w-full px-2 py-1.5 bg-emerald-600 text-white border border-emerald-700 rounded-xl text-xs font-black text-center shadow-2xs focus:outline-none cursor-default font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {erroFormula && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>{erroFormula}</span>
              </div>
            )}
          </div>
        </div>

      {/* RODAPÉ COM AÇÕES */}
      <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancelar e Voltar</span>
          </button>

          {initialFormula && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(initialFormula)}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs"
              title="Excluir este cálculo do sistema"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Excluir Cálculo</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleSalvar}
          disabled={isSaving || !titulo.trim() || campos.length === 0}
          className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition shadow-sm cursor-pointer ${
            !titulo.trim() || campos.length === 0 || isSaving
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Salvando...' : initialFormula ? 'Salvar e Atualizar Cálculo' : 'Salvar Novo Cálculo'}</span>
        </button>
      </div>
    </div>
  );
};
