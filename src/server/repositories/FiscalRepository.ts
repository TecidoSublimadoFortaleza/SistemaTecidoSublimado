import { Database } from '../db/database';
import { NotaFiscal, ConfiguracaoFiscal } from '../types/fiscal';

export const DEFAULT_CONFIG_FISCAL: ConfiguracaoFiscal = {
  id: 'config_fiscal_matriz',
  provedorFiscal: 'SPEDY',
  tokenSpedy: process.env.SPEDY_API_KEY || 'de48c1cb-1f56-4c02-9a2a-6278c381b60a',
  spedyCompanyId: '3c260fe5-5b07-482a-8c12-b4c800ddca83',
  cnpj: '36.047.818/0001-07',
  razaoSocial: 'TECIDO SUBLIMADO FORTALEZA COMERCIO E SERVICOS LTDA',
  nomeFantasia: 'TECIDO SUBLIMADO FORTALEZA',
  inscricaoEstadual: '061671967',
  regimeTributario: 'SIMPLES_NACIONAL',
  naturezaOperacaoPadrao: 'Venda de mercadoria e serviços têxteis',
  cfopPadraoInterno: '5102',
  cfopPadraoInterestadual: '6102',
  ncmPadrao: '6109.10.00',
  csosnPadrao: '102',
  serieNfe: '7', // Série 7: Vendas de Balcão / Pronta Entrega (VND)
  proximoNumeroNfe: 1,
  serieNfeOs: '8', // Série 8: Produção Sob Demanda / Fábrica (OS)
  proximoNumeroNfeOs: 1,
  serieNfce: '7', // Série 7: NFC-e Recepção / Venda Direta
  proximoNumeroNfce: 1,
  ambiente: 'HOMOLOGACAO',
  tokenFocusNfe: process.env.FOCUS_NFE_TOKEN || '',
  cIdToken: '',
  cscToken: '',
  mensagemFiscalPadrao: 'Documento emitido por ME ou EPP optante pelo Simples Nacional. Nao gera direito a credito fiscal de IPI e ICMS.',
  updatedAt: new Date().toISOString(),
};

export class FiscalRepository {
  private db = Database.getInstance();

  public async getConfig(): Promise<ConfiguracaoFiscal> {
    const existing = this.db.configuracaoFiscal.get('config_fiscal_matriz');
    if (existing) {
      return {
        ...DEFAULT_CONFIG_FISCAL,
        ...existing,
        provedorFiscal: existing.provedorFiscal || 'SPEDY',
        tokenSpedy: existing.tokenSpedy || process.env.SPEDY_API_KEY || DEFAULT_CONFIG_FISCAL.tokenSpedy,
        spedyCompanyId: existing.spedyCompanyId || DEFAULT_CONFIG_FISCAL.spedyCompanyId,
        tokenFocusNfe: existing.tokenFocusNfe || process.env.FOCUS_NFE_TOKEN || '',
      };
    }
    // Set default config
    this.db.configuracaoFiscal.set('config_fiscal_matriz', DEFAULT_CONFIG_FISCAL);
    return DEFAULT_CONFIG_FISCAL;
  }

  public async saveConfig(updates: Partial<ConfiguracaoFiscal>): Promise<ConfiguracaoFiscal> {
    const current = await this.getConfig();
    const updated: ConfiguracaoFiscal = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.db.configuracaoFiscal.set('config_fiscal_matriz', updated);
    return updated;
  }

  private sanitizeNota(nota: NotaFiscal, config: ConfiguracaoFiscal): NotaFiscal {
    if (!nota) return nota;
    const isOs = nota.origem === 'OS' || Boolean(nota.origemCodigo && String(nota.origemCodigo).toUpperCase().startsWith('OS'));
    const targetSerie = isOs ? (config.serieNfeOs || '7') : (nota.tipo === 'NFCE' ? (config.serieNfce || '6') : (config.serieNfe || '6'));

    if (!nota.serie || String(nota.serie) === '1' || String(nota.serie) === '3') {
      nota.serie = targetSerie;
      if (nota.chaveAcesso && nota.chaveAcesso.length === 44) {
        const cleanSerie = targetSerie.padStart(3, '0');
        const base43 = nota.chaveAcesso.substring(0, 22) + cleanSerie + nota.chaveAcesso.substring(25, 43);
        let soma = 0;
        let peso = 2;
        for (let i = base43.length - 1; i >= 0; i--) {
          soma += parseInt(base43[i], 10) * peso;
          peso = peso >= 9 ? 2 : peso + 1;
        }
        const resto = soma % 11;
        const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
        nota.chaveAcesso = `${base43}${dv}`;
      }
      if (nota.xmlConteudo) {
        nota.xmlConteudo = nota.xmlConteudo
          .replace(/<serie>1<\/serie>/g, `<serie>${targetSerie}</serie>`)
          .replace(/<serie>001<\/serie>/g, `<serie>${targetSerie.padStart(3, '0')}</serie>`);
      }
      this.db.notasFiscais.set(nota.id, nota);
    }
    return nota;
  }

  public async listNotas(filters?: {
    tipo?: string;
    status?: string;
    search?: string;
    limit?: number;
  }): Promise<NotaFiscal[]> {
    const config = await this.getConfig();
    let list = Array.from(this.db.notasFiscais.values()).map((n) => this.sanitizeNota(n as NotaFiscal, config));

    // Sort by emission date descending
    list.sort((a, b) => new Date(b.dataEmissao).getTime() - new Date(a.dataEmissao).getTime());

    if (filters?.tipo && filters.tipo !== 'ALL') {
      list = list.filter((n) => n.tipo === filters.tipo);
    }

    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter((n) => n.status === filters.status);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (n) =>
          n.numero.toString().includes(q) ||
          n.chaveAcesso.toLowerCase().includes(q) ||
          n.clienteNome.toLowerCase().includes(q) ||
          (n.clienteDocumento && n.clienteDocumento.includes(q)) ||
          (n.origemCodigo && n.origemCodigo.toLowerCase().includes(q))
      );
    }

    if (filters?.limit && filters.limit > 0) {
      list = list.slice(0, filters.limit);
    }

    return list;
  }

  public async getNotaById(id: string): Promise<NotaFiscal | null> {
    const nota = this.db.notasFiscais.get(id);
    if (!nota) return null;
    const config = await this.getConfig();
    return this.sanitizeNota(nota, config);
  }

  public async getNotaByOrigem(origemId: string): Promise<NotaFiscal | null> {
    const all = Array.from(this.db.notasFiscais.values()) as NotaFiscal[];
    const match = all.find((n) => n.origemId === origemId || n.origemCodigo === origemId);
    if (!match) return null;
    const config = await this.getConfig();
    return this.sanitizeNota(match, config);
  }

  public async saveNota(nota: NotaFiscal): Promise<NotaFiscal> {
    const config = await this.getConfig();
    const sanitized = this.sanitizeNota(nota, config);
    this.db.notasFiscais.set(sanitized.id, sanitized);
    return sanitized;
  }

  public async deleteNota(id: string): Promise<boolean> {
    return this.db.notasFiscais.delete(id);
  }

  public async clearAllNotasAndResetNumbers(): Promise<void> {
    for (const key of Array.from(this.db.notasFiscais.keys())) {
      this.db.notasFiscais.delete(key);
    }
    await this.saveConfig({
      proximoNumeroNfe: 1,
      proximoNumeroNfeOs: 1,
      proximoNumeroNfce: 1,
      serieNfe: '7',
      serieNfeOs: '8',
      serieNfce: '7',
    });
  }

  public async getNextNumber(
    tipo: 'NFE' | 'NFCE',
    origem?: 'OS' | 'PDV' | 'AVULSA',
    serieForcada?: string
  ): Promise<{ numero: number; serie: string }> {
    const config = await this.getConfig();
    if (tipo === 'NFE') {
      if (origem === 'OS') {
        const serie = serieForcada || config.serieNfeOs || '7';
        const numero = config.proximoNumeroNfeOs || 1;
        return { numero, serie };
      }
      return { numero: config.proximoNumeroNfe || 1, serie: serieForcada || config.serieNfe || '6' };
    } else {
      return { numero: config.proximoNumeroNfce || 1, serie: serieForcada || config.serieNfce || '6' };
    }
  }

  public async incrementNumber(
    tipo: 'NFE' | 'NFCE',
    origem?: 'OS' | 'PDV' | 'AVULSA'
  ): Promise<void> {
    const config = await this.getConfig();
    if (tipo === 'NFE') {
      if (origem === 'OS') {
        const nextOs = (config.proximoNumeroNfeOs || 1) + 1;
        await this.saveConfig({ proximoNumeroNfeOs: nextOs });
      } else {
        await this.saveConfig({ proximoNumeroNfe: (config.proximoNumeroNfe || 1) + 1 });
      }
    } else {
      await this.saveConfig({ proximoNumeroNfce: (config.proximoNumeroNfce || 1) + 1 });
    }
  }

  public async getDashboardMetrics(): Promise<{
    totalValor: number;
    totalQtd: number;
    autorizadas: number;
    canceladas: number;
    nfceQtd: number;
    nfeQtd: number;
  }> {
    const notas = Array.from(this.db.notasFiscais.values()) as NotaFiscal[];

    let totalValor = 0;
    let autorizadas = 0;
    let canceladas = 0;
    let nfceQtd = 0;
    let nfeQtd = 0;

    for (const n of notas) {
      if (n.status === 'AUTORIZADA') {
        totalValor += n.valorTotal;
        autorizadas++;
      } else if (n.status === 'CANCELADA') {
        canceladas++;
      }

      if (n.tipo === 'NFCE') {
        nfceQtd++;
      } else {
        nfeQtd++;
      }
    }

    return {
      totalValor,
      totalQtd: notas.length,
      autorizadas,
      canceladas,
      nfceQtd,
      nfeQtd,
    };
  }
}
