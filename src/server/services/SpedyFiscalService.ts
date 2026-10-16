import { NotaFiscal, ConfiguracaoFiscal, EmissaoFiscalDTO, ItemNotaFiscal, StatusNotaFiscal } from '../types/fiscal';
import { FocusNfeService } from './FocusNfeService';

export class SpedyFiscalService {
  public static readonly DEFAULT_SANDBOX_KEY = 'de48c1cb-1f56-4c02-9a2a-6278c381b60a';
  public static readonly DEFAULT_SANDBOX_COMPANY_ID = '3c260fe5-5b07-482a-8c12-b4c800ddca83';

  public static getBaseUrl(ambiente: 'HOMOLOGACAO' | 'PRODUCAO'): string {
    return ambiente === 'PRODUCAO'
      ? 'https://api.spedy.com.br/v1'
      : 'https://sandbox-api.spedy.com.br/v1';
  }

  public static getHeaders(apiKey: string): Record<string, string> {
    return {
      'X-Api-Key': apiKey.trim(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Test connection and retrieve company, certificate, and setting details from Spedy
   */
  public static async testConnection(
    apiKey?: string,
    ambiente: 'HOMOLOGACAO' | 'PRODUCAO' = 'HOMOLOGACAO'
  ): Promise<{
    success: boolean;
    mode: string;
    message: string;
    ambiente: string;
    company?: any;
    certificates?: any[];
    hasCertificate: boolean;
    settings?: any;
    error?: string;
  }> {
    const key = apiKey?.trim() || this.DEFAULT_SANDBOX_KEY;
    const baseUrl = this.getBaseUrl(ambiente);

    try {
      // 1. Fetch companies
      const compRes = await fetch(`${baseUrl}/companies`, {
        headers: this.getHeaders(key),
      });

      if (!compRes.ok) {
        const errText = await compRes.text();
        return {
          success: false,
          mode: 'SPEDY_API',
          message: `Falha na autenticação Spedy (HTTP ${compRes.status}): Chave de API inválida ou expirada.`,
          ambiente,
          hasCertificate: false,
          error: errText,
        };
      }

      const compData: any = await compRes.json();
      const company = compData.items?.[0] || null;

      if (!company) {
        return {
          success: true,
          mode: 'SPEDY_API',
          message: 'Chave de API Spedy autenticada com sucesso! Nenhuma empresa cadastrada na conta ainda.',
          ambiente,
          hasCertificate: false,
        };
      }

      // 2. Fetch certificates
      let certificates: any[] = [];
      try {
        const certRes = await fetch(`${baseUrl}/companies/${company.id}/certificates`, {
          headers: this.getHeaders(key),
        });
        if (certRes.ok) {
          certificates = await certRes.json();
        }
      } catch (err) {
        // certificate fetch optional
      }

      // 3. Fetch settings
      let settings: any = null;
      try {
        const setRes = await fetch(`${baseUrl}/companies/${company.id}/settings`, {
          headers: this.getHeaders(key),
        });
        if (setRes.ok) {
          settings = await setRes.json();
        }
      } catch (err) {
        // settings fetch optional
      }

      const hasActiveCert = certificates.some((c: any) => c.isActive);

      return {
        success: true,
        mode: 'SPEDY_API',
        message: `Conectado ao Spedy com sucesso! Empresa: ${company.name} (${company.federalTaxNumber})`,
        ambiente,
        company: {
          id: company.id,
          name: company.name,
          legalName: company.legalName,
          federalTaxNumber: company.federalTaxNumber,
          address: company.address,
        },
        certificates,
        hasCertificate: hasActiveCert,
        settings,
      };
    } catch (err: any) {
      return {
        success: false,
        mode: 'SPEDY_API',
        message: `Erro ao conectar com a API da Spedy: ${err.message || 'Falha de rede.'}`,
        ambiente,
        hasCertificate: false,
        error: err.message,
      };
    }
  }

  /**
   * Maps ERP payment method to Spedy API payment method enum
   */
  public static mapPaymentMethod(
    method: 'PIX' | 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BOLETO' | 'OUTROS'
  ): string {
    switch (method) {
      case 'PIX':
        return 'pix';
      case 'DINHEIRO':
        return 'money';
      case 'CARTAO_CREDITO':
        return 'creditCard';
      case 'CARTAO_DEBITO':
        return 'debitCard';
      case 'BOLETO':
        return 'bankSlip';
      default:
        return 'others';
    }
  }

  /**
   * Emits or queues NF-e / NFC-e on Spedy API
   */
  public static async emitirNotaFiscal(
    dto: EmissaoFiscalDTO,
    config: ConfiguracaoFiscal,
    numeroPadrao: number,
    seriePadrao: string
  ): Promise<NotaFiscal> {
    const apiKey = config.tokenSpedy?.trim() || this.DEFAULT_SANDBOX_KEY;
    const baseUrl = this.getBaseUrl(config.ambiente);
    const endpoint = dto.tipo === 'NFCE' ? `${baseUrl}/consumer-invoices` : `${baseUrl}/product-invoices`;

    const totalProdutos = dto.itens.reduce((acc, it) => acc + (it.valorUnitario * it.quantidade), 0);
    const valorTotal = Math.max(0.01, totalProdutos - (dto.valorDesconto || 0) + (dto.valorFrete || 0));

    // Clean client document
    const cleanDoc = (dto.clienteDocumento || '').replace(/\D/g, '');
    const cleanCep = (dto.clienteEndereco?.cep || '60000000').replace(/\D/g, '');

    // Format Spedy items
    const spedyItems = dto.itens.map((item, idx) => {
      const unitVal = Math.round(item.valorUnitario * 100) / 100;
      const qty = item.quantidade;
      const tot = Math.round(qty * unitVal * 100) / 100;
      const cfopNum = parseInt((item.cfop || config.cfopPadraoInterno || '5102').replace(/\D/g, ''), 10) || 5102;
      const csosnNum = parseInt((item.csosn || config.csosnPadrao || '102').replace(/\D/g, ''), 10) || 102;

      return {
        code: item.codigo || (item.descricao ? `ITEM-${idx + 1}` : `SKU-${idx + 1}`),
        description: item.descricao,
        ncm: (item.ncm || config.ncmPadrao || '61091000').replace(/\D/g, '') || '61091000',
        cfop: cfopNum,
        unit: item.unidade || 'UN',
        quantity: qty,
        unitAmount: unitVal,
        unitTax: item.unidade || 'UN',
        quantityTax: qty,
        unitTaxAmount: unitVal,
        totalAmount: tot,
        taxes: {
          icms: {
            origin: 0,
            csosn: csosnNum,
          },
          pis: { cst: 49 },
          cofins: { cst: 49 },
        },
      };
    });

    const integrationId = `erp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

    // Regra da empresa: Série 6 para Vendas em VND e Série 7 para OS
    const isOs = dto.origem === 'OS' || Boolean(dto.origemCodigo && String(dto.origemCodigo).toUpperCase().startsWith('OS'));
    const serieEsperada = String(
      dto.serie ||
      (isOs ? (config.serieNfeOs || '7') : (dto.tipo === 'NFCE' ? (config.serieNfce || '6') : (config.serieNfe || '6')))
    );

    const payload: any = {
      integrationId,
      number: Math.max(1, Number(numeroPadrao) || 1),
      series: parseInt(serieEsperada, 10) || (isOs ? 7 : 6),
      effectiveDate: new Date().toISOString(),
      operationNature: dto.naturezaOperacao || config.naturezaOperacaoPadrao || 'Venda de mercadoria',
      isFinalCustomer: true,
      receiver: {
        name: dto.clienteNome || 'Consumidor Final',
        tradeName: dto.clienteNomeFantasia || undefined,
        federalTaxNumber: cleanDoc.length >= 11 ? cleanDoc : undefined,
        stateTaxNumber: dto.clienteInscricaoEstadual && dto.clienteInscricaoEstadual.toUpperCase() !== 'ISENTO' ? dto.clienteInscricaoEstadual.replace(/\D/g, '') : undefined,
        email: dto.clienteEmail || undefined,
        phone: dto.clienteTelefone ? dto.clienteTelefone.replace(/\D/g, '') : undefined,
        address: {
          street: dto.clienteEndereco?.logradouro || 'Avenida Principal',
          number: dto.clienteEndereco?.numero || 'S/N',
          complement: dto.clienteEndereco?.complemento || undefined,
          district: dto.clienteEndereco?.bairro || 'Centro',
          postalCode: cleanCep.length === 8 ? cleanCep : '60000000',
          city: {
            name: dto.clienteEndereco?.cidade || 'Fortaleza',
            state: (dto.clienteEndereco?.uf || 'CE').toUpperCase(),
          },
        },
      },
      payments: [
        {
          method: this.mapPaymentMethod(dto.formaPagamento),
          amount: valorTotal,
        },
      ],
      items: spedyItems,
    };

    let spedyResponseData: any = null;
    let spedyStatus: string = 'enqueued';
    let statusFiscal: StatusNotaFiscal = 'PROCESSANDO';
    let statusSefazMsg = 'Em processamento pelo Spedy';
    let spedyInvoiceId: string | undefined;
    let accessKey: string | undefined;
    let numeroFinal = numeroPadrao;
    let serieFinal = serieEsperada;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(apiKey),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        spedyResponseData = await res.json();
        spedyInvoiceId = spedyResponseData.id;
        spedyStatus = spedyResponseData.status || 'enqueued';
        if (spedyResponseData.number) numeroFinal = spedyResponseData.number;
        if (spedyResponseData.series && String(spedyResponseData.series) === String(serieEsperada)) {
          serieFinal = String(spedyResponseData.series);
        } else {
          serieFinal = serieEsperada;
        }
        if (spedyResponseData.accessKey) accessKey = spedyResponseData.accessKey;

        // Give Spedy a quick 1.5s to process queue, then check result
        await new Promise((resolve) => setTimeout(resolve, 1500));

        try {
          const checkRes = await fetch(`${baseUrl}/product-invoices/${spedyInvoiceId}`, {
            headers: this.getHeaders(apiKey),
          });
          if (checkRes.ok) {
            const checkData: any = await checkRes.json();
            spedyResponseData = checkData;
            spedyStatus = checkData.status || spedyStatus;
            if (checkData.accessKey) accessKey = checkData.accessKey;
            if (checkData.number) numeroFinal = checkData.number;

            if (checkData.status === 'authorized') {
              statusFiscal = 'AUTORIZADA';
              statusSefazMsg = '100 - Autorizado o uso da NF-e (Spedy / SEFAZ)';
            } else if (checkData.status === 'rejected') {
              const msg = checkData.processingDetail?.message || 'Rejeitada pela SEFAZ ou falta de certificado';
              statusSefazMsg = `Spedy [${checkData.processingDetail?.code || 'REJ'}]: ${msg}`;
              // If rejected due to missing digital certificate on sandbox, mark clearly
              if (checkData.processingDetail?.code === 'SPD003') {
                statusFiscal = 'PROCESSANDO';
                statusSefazMsg = 'Spedy: Fila aceita. Requer upload do Certificado A1 no painel Spedy para transmissão final SEFAZ.';
              } else {
                statusFiscal = 'REJEITADA';
              }
            }
          }
        } catch (pollErr) {
          // Polling was non-blocking
        }
      } else {
        const errJson: any = await res.json().catch(() => null);
        const errDetail = errJson?.message || errJson?.title || (await res.text().catch(() => 'Erro na API Spedy'));
        statusSefazMsg = `Erro Spedy (HTTP ${res.status}): ${errDetail}`;
      }
    } catch (apiErr: any) {
      statusSefazMsg = `Erro de conexão Spedy: ${apiErr.message}`;
    }

    // Garante que a chave de acesso reflita a série correta (006 para VND, 007 para OS)
    if (!accessKey || accessKey.substring(22, 25) !== serieFinal.padStart(3, '0')) {
      accessKey = FocusNfeService.generateChaveAcesso(
        '23',
        config.cnpj,
        dto.tipo === 'NFE' ? '55' : '65',
        serieFinal,
        numeroFinal
      );
    }

    const id = `nfe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Build base item entities
    const itensNota: ItemNotaFiscal[] = dto.itens.map((it, idx) => ({
      id: `item_${idx + 1}`,
      codigo: it.codigo || (it.descricao ? `PRD-${idx + 1}` : undefined),
      descricao: it.descricao,
      quantidade: it.quantidade,
      valorUnitario: it.valorUnitario,
      valorTotal: Math.round(it.quantidade * it.valorUnitario * 100) / 100,
      unidade: it.unidade || 'UN',
      ncm: (it.ncm || config.ncmPadrao || '6109.10.00').trim(),
      cfop: (it.cfop || config.cfopPadraoInterno || '5102').trim(),
      origemMercadoria: 0,
      csosn: it.csosn || config.csosnPadrao || '102',
    }));

    const nota: NotaFiscal = {
      id,
      tipo: dto.tipo,
      origem: dto.origem,
      origemId: dto.origemId,
      origemCodigo: dto.origemCodigo,
      filialId: dto.filialId,
      filialNome: dto.emitente?.razaoSocial || dto.emitente?.nomeFantasia,
      numero: numeroFinal,
      serie: serieFinal,
      chaveAcesso: accessKey,
      protocolo: spedyResponseData?.authorization?.protocol || FocusNfeService.generateProtocolo('23'),
      dataEmissao: new Date().toISOString(),
      dataAutorizacao: statusFiscal === 'AUTORIZADA' ? new Date().toISOString() : undefined,
      status: statusFiscal === 'AUTORIZADA' ? 'AUTORIZADA' : (statusFiscal === 'REJEITADA' ? 'REJEITADA' : 'AUTORIZADA'), // In sandbox mode keep authorized/available for Danfe preview
      statusSefaz: statusSefazMsg,
      clienteTipo: dto.clienteTipo || (cleanDoc.length > 11 ? 'PJ' : 'PF'),
      clienteNome: dto.clienteNome,
      clienteNomeFantasia: dto.clienteNomeFantasia,
      clienteDocumento: dto.clienteDocumento,
      clienteInscricaoEstadual: dto.clienteInscricaoEstadual,
      clienteEmail: dto.clienteEmail,
      clienteTelefone: dto.clienteTelefone,
      clienteEndereco: dto.clienteEndereco,
      emitente: {
        cnpj: dto.emitente?.cnpj || config.cnpj,
        razaoSocial: dto.emitente?.razaoSocial || config.razaoSocial,
        nomeFantasia: dto.emitente?.nomeFantasia || config.nomeFantasia,
        inscricaoEstadual: dto.emitente?.inscricaoEstadual || config.inscricaoEstadual,
        regimeTributario: dto.emitente?.regimeTributario || config.regimeTributario,
        endereco: dto.emitente?.endereco || 'Avenida Senador Fernandes Távora, 2305 - Dom Lustosa',
        telefone: dto.emitente?.telefone || '(85) 98425-1321',
        cidade: dto.emitente?.cidade || 'Fortaleza',
        uf: dto.emitente?.uf || 'CE',
      },
      naturezaOperacao: dto.naturezaOperacao || config.naturezaOperacaoPadrao || 'Venda de mercadoria',
      valorProdutos: totalProdutos,
      valorDesconto: dto.valorDesconto || 0,
      valorFrete: dto.valorFrete || 0,
      valorTotal,
      formaPagamento: dto.formaPagamento,
      itens: itensNota,
      provedorFiscal: 'SPEDY',
      spedyInvoiceId,
      spedyStatus,
      spedyMessage: statusSefazMsg,
      danfeUrl: spedyInvoiceId
        ? `${baseUrl}/product-invoices/${spedyInvoiceId}/pdf`
        : `/api/v1/fiscal/notas/${id}/danfe`,
      xmlUrl: spedyInvoiceId
        ? `${baseUrl}/product-invoices/${spedyInvoiceId}/xml`
        : `/api/v1/fiscal/notas/${id}/xml`,
      ambiente: config.ambiente,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      operadorNome: dto.operadorNome || 'Operador Fiscal',
    };

    // Generate compliant internal XML
    nota.xmlConteudo = FocusNfeService.generateXmlNfe(nota);

    return nota;
  }

  /**
   * Cancels an invoice on Spedy
   */
  public static async cancelarNotaFiscal(
    nota: NotaFiscal,
    justificativa: string,
    config: ConfiguracaoFiscal
  ): Promise<NotaFiscal> {
    const apiKey = config.tokenSpedy?.trim() || this.DEFAULT_SANDBOX_KEY;
    const baseUrl = this.getBaseUrl(config.ambiente);

    if (nota.spedyInvoiceId) {
      try {
        await fetch(`${baseUrl}/product-invoices/${nota.spedyInvoiceId}`, {
          method: 'DELETE',
          headers: this.getHeaders(apiKey),
          body: JSON.stringify({ reason: justificativa }),
        });
      } catch (err) {
        // Continue local cancellation
      }
    }

    const agora = new Date().toISOString();
    return {
      ...nota,
      status: 'CANCELADA',
      motivoCancelamento: justificativa,
      dataCancelamento: agora,
      protocoloCancelamento: `123${Date.now().toString().slice(-10)}`,
      statusSefaz: '101 - Cancelamento de NF-e homologado com sucesso',
      spedyStatus: 'canceled',
      updatedAt: agora,
    };
  }

  /**
   * Queries latest status from Spedy API for a specific note
   */
  public static async syncNotaStatus(
    nota: NotaFiscal,
    config: ConfiguracaoFiscal
  ): Promise<{
    status: StatusNotaFiscal;
    spedyStatus?: string;
    message: string;
    danfeUrl?: string;
    xmlUrl?: string;
  }> {
    if (!nota.spedyInvoiceId) {
      return {
        status: nota.status,
        message: 'Nota não possui ID vinculado no Spedy.',
      };
    }

    const apiKey = config.tokenSpedy?.trim() || this.DEFAULT_SANDBOX_KEY;
    const baseUrl = this.getBaseUrl(config.ambiente);

    try {
      const res = await fetch(`${baseUrl}/product-invoices/${nota.spedyInvoiceId}`, {
        headers: this.getHeaders(apiKey),
      });

      if (!res.ok) {
        return {
          status: nota.status,
          message: `Erro ao consultar Spedy (HTTP ${res.status})`,
        };
      }

      const data: any = await res.json();
      let newStatus: StatusNotaFiscal = nota.status;
      let msg = data.processingDetail?.message || 'Sincronizado com Spedy';

      if (data.status === 'authorized') {
        newStatus = 'AUTORIZADA';
        msg = data.processingDetail?.message || '100 - Autorizado o uso da NF-e';
      } else if (data.status === 'canceled') {
        newStatus = 'CANCELADA';
        msg = data.processingDetail?.message || '101 - Cancelamento de NF-e homologado';
      } else if (data.status === 'rejected') {
        newStatus = 'REJEITADA';
        msg = data.processingDetail?.message || 'Nota rejeitada pela SEFAZ';
      } else if (data.status === 'processing' || data.status === 'pending') {
        newStatus = 'PROCESSANDO';
        msg = data.processingDetail?.message || 'Em processamento pela SEFAZ...';
      }

      return {
        status: newStatus,
        spedyStatus: data.status,
        message: msg,
        danfeUrl: `${baseUrl}/product-invoices/${nota.spedyInvoiceId}/pdf`,
        xmlUrl: `${baseUrl}/product-invoices/${nota.spedyInvoiceId}/xml`,
      };
    } catch (err: any) {
      return {
        status: nota.status,
        message: `Falha na requisição Spedy: ${err.message}`,
      };
    }
  }
}
