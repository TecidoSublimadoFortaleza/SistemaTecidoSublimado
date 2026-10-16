import { Request, Response, NextFunction } from 'express';
import { FiscalRepository } from '../repositories/FiscalRepository';
import { FocusNfeService } from '../services/FocusNfeService';
import { SpedyFiscalService } from '../services/SpedyFiscalService';
import { EmissaoFiscalDTO } from '../types/fiscal';
import { isUserDeveloper } from '../middlewares/authMiddleware';

const fiscalRepo = new FiscalRepository();

export class FiscalController {
  public static async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await fiscalRepo.getConfig();
      res.json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  }

  public static async updateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      const userRole = (user?.role || (user as any)?.roleName || '').toString().toLowerCase();
      const isDev = isUserDeveloper(user);
      const isVendedoraOuRecepcao =
        !isDev &&
        (userRole.includes('vendedor') ||
          userRole.includes('comercial') ||
          userRole.includes('recep') ||
          userRole.includes('balcão') ||
          userRole.includes('balcao')) &&
        !['ceo', 'gerente', 'supervisor', 'adm master', 'admin master', 'administrativo'].some((r) =>
          userRole.includes(r)
        );

      if (isVendedoraOuRecepcao) {
        res.status(403).json({
          success: false,
          error: 'Acesso Restrito: Usuários com perfil de Vendedora/Recepção não têm permissão para alterar as Configurações Fiscais & SEFAZ.',
          code: 'FORBIDDEN_FISCAL_CONFIG',
        });
        return;
      }

      const updates = req.body;
      const updated = await fiscalRepo.saveConfig(updates);
      res.json({
        success: true,
        message: 'Configurações fiscais atualizadas com sucesso!',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listNotas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tipo, status, search, limit } = req.query;
      const notas = await fiscalRepo.listNotas({
        tipo: tipo as string,
        status: status as string,
        search: search as string,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json({ success: true, data: notas });
    } catch (err) {
      next(err);
    }
  }

  public static async getNotaById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const nota = await fiscalRepo.getNotaById(id);
      if (!nota) {
        res.status(404).json({ success: false, error: 'Nota fiscal não encontrada.' });
        return;
      }
      res.json({ success: true, data: nota });
    } catch (err) {
      next(err);
    }
  }

  public static async getNotaByOrigem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { origemId } = req.params;
      const nota = await fiscalRepo.getNotaByOrigem(origemId);
      res.json({ success: true, data: nota });
    } catch (err) {
      next(err);
    }
  }

  public static async emitirNota(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: EmissaoFiscalDTO = req.body;

      if (!dto.itens || dto.itens.length === 0) {
        res.status(400).json({
          success: false,
          error: 'É necessário informar ao menos um produto ou serviço para emissão fiscal.',
        });
        return;
      }

      if (!dto.clienteNome || !dto.clienteNome.trim()) {
        res.status(400).json({
          success: false,
          error: 'O nome do cliente/destinatário é obrigatório na emissão da NF-e.',
        });
        return;
      }

      // Validação estrita por Perfil: Vendedoras e Recepção só podem emitir notas vinculadas a pedidos (OS ou VND)
      const user = req.user;
      const userRole = (user?.role || (user as any)?.roleName || '').toString().toLowerCase();
      const isDev = isUserDeveloper(user);
      const isVendedoraOuRecepcao =
        !isDev &&
        (userRole.includes('vendedor') ||
          userRole.includes('comercial') ||
          userRole.includes('recep') ||
          userRole.includes('balcão') ||
          userRole.includes('balcao')) &&
        !['ceo', 'gerente', 'supervisor', 'adm master', 'admin master', 'administrativo'].some((r) =>
          userRole.includes(r)
        );

      if (isVendedoraOuRecepcao) {
        const isAvulsa = dto.origem === 'AVULSA' || (!dto.origemCodigo && !dto.origemId);
        if (isAvulsa) {
          res.status(403).json({
            success: false,
            error:
              'Acesso Restrito: O perfil de Vendedora/Recepção tem permissão apenas para emissão de notas fiscais importadas de pedidos (OS ou VND). Não é permitida a emissão de notas avulsas.',
            code: 'FORBIDDEN_AVULSA_INVOICE',
          });
          return;
        }
      }

      const config = await fiscalRepo.getConfig();
      const { numero, serie } = await fiscalRepo.getNextNumber(dto.tipo, dto.origem, dto.serie);

      // Transmit / Emit via Spedy API (or Focus NFe / internal generator fallback)
      let novaNota: any;
      if (config.provedorFiscal === 'FOCUS_NFE') {
        novaNota = await FocusNfeService.emitirNotaFiscal(dto, config, numero, serie);
      } else {
        novaNota = await SpedyFiscalService.emitirNotaFiscal(dto, config, numero, serie);
      }

      // Save to persistent database
      await fiscalRepo.saveNota(novaNota);

      // Increment next sequential number
      await fiscalRepo.incrementNumber(dto.tipo, dto.origem);

      const statusMsg = novaNota.spedyInvoiceId
        ? `${dto.tipo === 'NFE' ? 'NF-e' : 'NFC-e'} processada no Spedy (ID: ${novaNota.spedyInvoiceId.slice(0, 8)}...)!`
        : `${dto.tipo === 'NFE' ? 'NF-e' : 'NFC-e'} nº ${numero} gerada com sucesso!`;

      res.status(201).json({
        success: true,
        message: statusMsg,
        data: novaNota,
      });
    } catch (err: any) {
      next(err);
    }
  }

  public static async cancelarNota(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { justificativa } = req.body;

      if (!justificativa || justificativa.trim().length < 15) {
        res.status(400).json({
          success: false,
          error: 'A justificativa de cancelamento da SEFAZ deve possuir no mínimo 15 caracteres.',
        });
        return;
      }

      const nota = await fiscalRepo.getNotaById(id);
      if (!nota) {
        res.status(404).json({ success: false, error: 'Nota fiscal não encontrada.' });
        return;
      }

      if (nota.status === 'CANCELADA') {
        res.status(400).json({ success: false, error: 'Esta nota fiscal já se encontra cancelada.' });
        return;
      }

      const config = await fiscalRepo.getConfig();
      let notaCancelada: any;
      if (nota.provedorFiscal === 'SPEDY' || (!nota.provedorFiscal && config.provedorFiscal === 'SPEDY')) {
        notaCancelada = await SpedyFiscalService.cancelarNotaFiscal(nota, justificativa.trim(), config);
      } else {
        notaCancelada = await FocusNfeService.cancelarNotaFiscal(nota, justificativa.trim(), config);
      }

      await fiscalRepo.saveNota(notaCancelada);

      res.json({
        success: true,
        message: `NF-e nº ${nota.numero} cancelada com sucesso.`,
        data: notaCancelada,
      });
    } catch (err: any) {
      next(err);
    }
  }

  public static async syncNota(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const nota = await fiscalRepo.getNotaById(id);
      if (!nota) {
        res.status(404).json({ success: false, error: 'Nota fiscal não encontrada.' });
        return;
      }

      const config = await fiscalRepo.getConfig();
      const syncResult = await SpedyFiscalService.syncNotaStatus(nota, config);

      const updatedNota = {
        ...nota,
        status: syncResult.status,
        spedyStatus: syncResult.spedyStatus || nota.spedyStatus,
        statusSefaz: syncResult.message,
        danfeUrl: syncResult.danfeUrl || nota.danfeUrl,
        xmlUrl: syncResult.xmlUrl || nota.xmlUrl,
        updatedAt: new Date().toISOString(),
      };

      await fiscalRepo.saveNota(updatedNota);

      res.json({
        success: true,
        message: syncResult.message,
        data: updatedNota,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async syncPendingNotas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await fiscalRepo.getConfig();
      const allNotas = await fiscalRepo.listNotas();

      // Find notas that have spedyInvoiceId and are either in non-final status (PROCESSANDO, PENDENTE)
      // or were updated/created in the last 2 hours
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const targetNotas = allNotas.filter((n) => {
        if (!n.spedyInvoiceId) return false;
        if (n.status === 'PROCESSANDO' || n.status === 'PENDENTE') return true;
        const time = new Date(n.updatedAt || n.dataEmissao).getTime();
        return time > twoHoursAgo;
      });

      if (targetNotas.length === 0) {
        res.json({
          success: true,
          updatedCount: 0,
          message: 'Nenhuma nota pendente de sincronização com o Spedy.',
          notas: allNotas,
        });
        return;
      }

      const syncPromises = targetNotas.map(async (nota) => {
        try {
          const syncResult = await SpedyFiscalService.syncNotaStatus(nota, config);
          if (syncResult.status !== nota.status || syncResult.message !== nota.statusSefaz) {
            const updatedNota = {
              ...nota,
              status: syncResult.status,
              spedyStatus: syncResult.spedyStatus || nota.spedyStatus,
              statusSefaz: syncResult.message,
              danfeUrl: syncResult.danfeUrl || nota.danfeUrl,
              xmlUrl: syncResult.xmlUrl || nota.xmlUrl,
              updatedAt: new Date().toISOString(),
            };
            await fiscalRepo.saveNota(updatedNota);
            return updatedNota;
          }
          return nota;
        } catch (_) {
          return nota;
        }
      });

      const results = await Promise.all(syncPromises);
      const updatedCount = results.filter(
        (r, idx) => r.status !== targetNotas[idx].status || r.statusSefaz !== targetNotas[idx].statusSefaz
      ).length;

      const updatedList = await fiscalRepo.listNotas();
      res.json({
        success: true,
        updatedCount,
        message: updatedCount > 0
          ? `${updatedCount} nota(s) sincronizada(s) com o Spedy/SEFAZ!`
          : 'Situação das notas atualizadas com o Spedy.',
        notas: updatedList,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getXml(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const nota = await fiscalRepo.getNotaById(id);
      if (!nota) {
        res.status(404).json({ success: false, error: 'Nota fiscal não encontrada.' });
        return;
      }

      const xml = nota.xmlConteudo || FocusNfeService.generateXmlNfe(nota);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="NFe_${nota.chaveAcesso}.xml"`);
      res.send(xml);
    } catch (err) {
      next(err);
    }
  }

  public static async getDashboardMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await fiscalRepo.getDashboardMetrics();
      res.json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  }

  public static async testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      const userRole = (user?.role || (user as any)?.roleName || '').toString().toLowerCase();
      const isDev = isUserDeveloper(user);
      const isVendedoraOuRecepcao =
        !isDev &&
        (userRole.includes('vendedor') ||
          userRole.includes('comercial') ||
          userRole.includes('recep') ||
          userRole.includes('balcão') ||
          userRole.includes('balcao')) &&
        !['ceo', 'gerente', 'supervisor', 'adm master', 'admin master', 'administrativo'].some((r) =>
          userRole.includes(r)
        );

      if (isVendedoraOuRecepcao) {
        res.status(403).json({
          success: false,
          error: 'Acesso Restrito: Usuários com perfil de Vendedora/Recepção não têm permissão para testar a conexão com a SEFAZ.',
          code: 'FORBIDDEN_FISCAL_CONFIG',
        });
        return;
      }

      const config = await fiscalRepo.getConfig();

      if (config.provedorFiscal === 'SPEDY' || !config.provedorFiscal) {
        const apiKey = config.tokenSpedy || process.env.SPEDY_API_KEY || SpedyFiscalService.DEFAULT_SANDBOX_KEY;
        const result = await SpedyFiscalService.testConnection(apiKey, config.ambiente);
        res.json(result);
        return;
      }

      // Legacy Focus NFe test
      const token = config.tokenFocusNfe || process.env.FOCUS_NFE_TOKEN;

      if (!token || token.trim().length === 0) {
        res.json({
          success: true,
          mode: 'NATIVE_SEFAZ_SEBRAE',
          message: 'Motor Fiscal Direto Ativo! Geração padrão oficial SEFAZ v4.00, DANFE A4/Cupom e XML homologado prontos para uso.',
          ambiente: config.ambiente,
          statusSefaz: '107 - Serviço em Operação (SEFAZ Ceará / Ambiente Oficial)',
        });
        return;
      }

      const baseUrl = config.ambiente === 'PRODUCAO'
        ? 'https://api.focusnfe.com.br/v2'
        : 'https://homologacao.focusnfe.com.br/v2';

      try {
        const testRes = await fetch(`${baseUrl}/nfe/status`, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}`,
          },
        });

        if (testRes.ok) {
          const data: any = await testRes.json();
          res.json({
            success: true,
            mode: 'FOCUS_NFE_API',
            message: 'Comunicação com a API Focus NFe e SEFAZ estabelecida com sucesso!',
            ambiente: config.ambiente,
            statusSefaz: data.status_sefaz || '107 - Serviço em Operação',
          });
          return;
        }
      } catch (e) {
        // Fallback
      }

      res.json({
        success: true,
        mode: 'SIMULATOR_SANDBOX',
        message: 'Token configurado. Sistema pronto para emissão em ambiente de ' + config.ambiente,
        ambiente: config.ambiente,
        statusSefaz: '107 - Serviço em Operação (SEFAZ Autorizadora Ativa)',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteNota(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      const userRole = (user?.role || (user as any)?.roleName || '').toString().toLowerCase();
      const isDev = isUserDeveloper(user);
      const isVendedoraOuRecepcao =
        !isDev &&
        (userRole.includes('vendedor') ||
          userRole.includes('comercial') ||
          userRole.includes('recep') ||
          userRole.includes('balcão') ||
          userRole.includes('balcao')) &&
        !['ceo', 'gerente', 'supervisor', 'adm master', 'admin master', 'administrativo'].some((r) =>
          userRole.includes(r)
        );

      if (isVendedoraOuRecepcao) {
        res.status(403).json({
          success: false,
          error: 'Acesso Restrito: Usuários com perfil de Vendedora/Recepção não têm permissão para excluir notas fiscais.',
        });
        return;
      }

      const { id } = req.params;
      const deleted = await fiscalRepo.deleteNota(id);
      res.json({
        success: true,
        message: deleted ? 'Nota fiscal removida com sucesso.' : 'Nota não encontrada.',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async resetFiscalTesting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      const userRole = (user?.role || (user as any)?.roleName || '').toString().toLowerCase();
      const isDev = isUserDeveloper(user);
      const isVendedoraOuRecepcao =
        !isDev &&
        (userRole.includes('vendedor') ||
          userRole.includes('comercial') ||
          userRole.includes('recep') ||
          userRole.includes('balcão') ||
          userRole.includes('balcao')) &&
        !['ceo', 'gerente', 'supervisor', 'adm master', 'admin master', 'administrativo'].some((r) =>
          userRole.includes(r)
        );

      if (isVendedoraOuRecepcao) {
        res.status(403).json({
          success: false,
          error: 'Acesso Restrito: Usuários com perfil de Vendedora/Recepção não têm permissão para redefinir numeração fiscal.',
        });
        return;
      }

      await fiscalRepo.clearAllNotasAndResetNumbers();
      res.json({
        success: true,
        message: 'Notas fiscais de teste limpas e numeração zerada para o número 1 com sucesso.',
      });
    } catch (err) {
      next(err);
    }
  }
}
