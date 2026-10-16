import { Request, Response, NextFunction } from 'express';
import { ClientRepository } from '../repositories/ClientRepository';
import { CreateClientDTO } from '../types/client';

const repo = new ClientRepository();

export class ClientController {
  public static createClient = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const dto: CreateClientDTO = req.body;
      const username = (req as any).user?.username || 'SYSTEM';
      const client = repo.create(dto, username);

      res.status(201).json({
        success: true,
        data: client,
        message: 'Cliente cadastrado com sucesso!',
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Falha ao realizar cadastro de cliente.',
      });
    }
  };

  public static updateClient = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const dto = req.body;
      const username = (req as any).user?.username || 'SYSTEM';
      const client = repo.update(id, dto, username);

      res.status(200).json({
        success: true,
        data: client,
        message: 'Cliente atualizado com sucesso!',
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Falha ao atualizar cadastro de cliente.',
      });
    }
  };

  public static listClients = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const clients = await repo.listAll();
      res.json({
        success: true,
        data: clients,
      });
    } catch (err: any) {
      next(err);
    }
  };

  public static deleteClient = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      repo.delete(id);
      res.json({
        success: true,
        message: 'Cliente excluído com sucesso!',
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Falha ao excluir cliente.',
      });
    }
  };

  public static getClientById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const client = repo.findById(id);
      if (!client) {
        res.status(404).json({ success: false, error: 'Cliente não encontrado.' });
        return;
      }
      res.json({ success: true, data: client });
    } catch (err: any) {
      next(err);
    }
  };

  public static bulkImportClients = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { clients, options } = req.body;
      if (!Array.isArray(clients) || clients.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Nenhum cliente informado para importação.',
        });
        return;
      }

      const username = (req as any).user?.username || 'SYSTEM';
      const result = repo.bulkImport(clients, options || {}, username);

      res.status(200).json({
        success: true,
        data: result,
        message: `${result.imported} cliente(s) importado(s) e ${result.updated} atualizado(s) com sucesso!`,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Falha ao importar clientes em lote.',
      });
    }
  };
}
