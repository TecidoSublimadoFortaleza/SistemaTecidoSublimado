import { Database } from '../db/database';
import { Client, CreateClientDTO } from '../types/client';

/**
 * Remove repetitive / duplicated tokens from names (e.g. "João Silva João Silva" -> "João Silva")
 */
function deduplicateRepetitiveName(str: string): string {
  if (!str) return '';
  const trimmed = str.trim().replace(/\s+/g, ' ');

  // Test if words repeat in halves: "Carlos Silva Carlos Silva"
  const words = trimmed.split(' ');
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    const firstHalf = words.slice(0, half).join(' ');
    const secondHalf = words.slice(half).join(' ');
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      return firstHalf;
    }
  }

  // Test character-level halves: "MARIA SILVAMARIA SILVA"
  const len = trimmed.length;
  if (len >= 6) {
    const halfLen = Math.floor(len / 2);
    const p1 = trimmed.slice(0, halfLen).trim();
    const p2 = trimmed.slice(halfLen).trim();
    if (p1.toLowerCase() === p2.toLowerCase()) {
      return p1;
    }
  }

  return trimmed;
}

/**
 * Clean & format full name without duplication
 */
export function cleanClientFullName(nome?: string, sobrenome?: string): string {
  const n = (nome || '').trim();
  const s = (sobrenome || '').trim();

  if (!n && !s) return '';
  if (!s) return deduplicateRepetitiveName(n);
  if (!n) return deduplicateRepetitiveName(s);

  if (n.toLowerCase() === s.toLowerCase()) {
    return deduplicateRepetitiveName(n);
  }

  if (n.toLowerCase().endsWith(s.toLowerCase()) || n.toLowerCase().includes(s.toLowerCase())) {
    return deduplicateRepetitiveName(n);
  }

  if (s.toLowerCase().startsWith(n.toLowerCase()) || s.toLowerCase().includes(n.toLowerCase())) {
    return deduplicateRepetitiveName(s);
  }

  return deduplicateRepetitiveName(`${n} ${s}`.trim());
}

export class ClientRepository {
  private db = Database.getInstance();
  private static sequenceCounter = 1;

  private static sanitized = false;
  private static cachedSortedClients: Client[] | null = null;

  public static invalidateCache(): void {
    ClientRepository.cachedSortedClients = null;
  }

  constructor() {
    this.sanitizeExistingClients();
  }

  /**
   * Automatically heals any legacy clients with duplicated names (run once)
   */
  public sanitizeExistingClients(): void {
    if (ClientRepository.sanitized) return;
    try {
      for (const [id, client] of this.db.clients.entries()) {
        if (client.type === 'PF' || (!client.type && (client.nome || (client as any).name))) {
          const rawNome = client.nome || (client as any).name;
          const cleaned = cleanClientFullName(rawNome, client.sobrenome);
          if (cleaned && (cleaned !== client.nome || client.sobrenome)) {
            this.db.clients.set(id, {
              ...client,
              nome: cleaned,
              sobrenome: undefined,
            });
          }
        }
      }
      ClientRepository.sanitized = true;
    } catch (_) {}
  }

  /**
   * Helper function to validate mathematical CPF
   */
  public static validateCPF(cpfRaw: string): boolean {
    const cpf = cpfRaw.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i), 10) * (10 - i);
    }
    let rev = (sum * 10) % 11;
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(9), 10)) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i), 10) * (11 - i);
    }
    rev = (sum * 10) % 11;
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(10), 10)) return false;

    return true;
  }

  /**
   * Helper function to validate mathematical CNPJ
   */
  public static validateCNPJ(cnpjRaw: string): boolean {
    const cnpj = cnpjRaw.replace(/\D/g, '');
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    const digits = cnpj.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i), 10) * pos--;
      if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0), 10)) return false;

    size = size + 1;
    numbers = cnpj.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i), 10) * pos--;
      if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1), 10)) return false;

    return true;
  }

  /**
   * Check duplicate CPF in database
   */
  public findByCPF(cpfRaw: string): Client | undefined {
    const cleanCpf = cpfRaw.replace(/\D/g, '');
    return Array.from(this.db.clients.values()).find(
      (client) => client.type === 'PF' && client.cpf?.replace(/\D/g, '') === cleanCpf
    );
  }

  /**
   * Check duplicate CNPJ in database
   */
  public findByCNPJ(cnpjRaw: string): Client | undefined {
    const cleanCnpj = cnpjRaw.replace(/\D/g, '');
    return Array.from(this.db.clients.values()).find(
      (client) => client.type === 'PJ' && client.cnpj?.replace(/\D/g, '') === cleanCnpj
    );
  }

  /**
   * Generate next sequential code with pattern "C0000001", "C0000002", etc.
   * Letter 'C' followed by 7 digits in ascending order.
   */
  public generateNextCode(): string {
    let maxNum = 0;
    for (const client of this.db.clients.values()) {
      if (!client.codigo) continue;
      const match = client.codigo.match(/^C?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    const nextNum = maxNum + 1;
    const codeNumber = String(nextNum).padStart(7, '0');
    return `C${codeNumber}`;
  }

  /**
   * Create new Client record in DB Map
   */
  public create(dto: CreateClientDTO, createdBy: string = 'SYSTEM'): Client {
    // 1. Validation for PF
    if (dto.type === 'PF') {
      if (!dto.nome?.trim()) throw new Error('Nome Completo do cliente é obrigatório.');
      if (!dto.cpf?.trim()) throw new Error('CPF do cliente é obrigatório.');
      
      if (!ClientRepository.validateCPF(dto.cpf)) {
        throw new Error('CPF inválido! Verifique o número digitado.');
      }

      if (this.findByCPF(dto.cpf)) {
        throw new Error('Já existe um cliente cadastrado com este CPF.');
      }
    }

    // 2. Validation for PJ
    if (dto.type === 'PJ') {
      if (!dto.razaoSocial?.trim()) throw new Error('Razão Social é obrigatória.');
      if (!dto.nomeFantasia?.trim()) throw new Error('Nome Fantasia é obrigatório.');
      if (!dto.cnpj?.trim()) throw new Error('CNPJ é obrigatório.');

      if (!ClientRepository.validateCNPJ(dto.cnpj)) {
        throw new Error('CNPJ inválido! Verifique o número digitado.');
      }

      if (this.findByCNPJ(dto.cnpj)) {
        throw new Error('Já existe um cliente cadastrado com este CNPJ.');
      }
    }

    // 3. Shared Validations
    if (dto.email?.trim() && !/\S+@\S+\.\S+/.test(dto.email.trim())) {
      throw new Error('E-mail do cliente informado é inválido.');
    }

    if (!dto.telefone?.trim()) {
      throw new Error('Telefone do cliente é obrigatório.');
    }

    if (dto.endereco && (!dto.endereco.numero || !dto.endereco.numero.trim())) {
      throw new Error('O campo Número no Endereço do Cliente é obrigatório. Caso não possua número, informe "S/N".');
    }

    const now = Database.nowISO();
    const id = Database.generateId('CLI');
    const codigo = this.generateNextCode();
    const cleanNome = dto.type === 'PF' ? cleanClientFullName(dto.nome, dto.sobrenome) : undefined;

    const newClient: Client = {
      id,
      codigo,
      type: dto.type,
      nome: cleanNome,
      sobrenome: undefined,
      cpf: dto.cpf?.trim(),
      fotoUrl: dto.fotoUrl,
      dataNascimento: dto.dataNascimento?.trim() || undefined,
      razaoSocial: dto.razaoSocial?.trim(),
      nomeFantasia: dto.nomeFantasia?.trim(),
      cnpj: dto.cnpj?.trim(),
      inscricaoEstadual: dto.inscricaoEstadual?.trim() || 'ISENTO',
      dataFundacao: dto.dataFundacao?.trim() || undefined,
      endereco: dto.endereco,
      telefone: dto.telefone?.trim(),
      email: dto.email?.trim() || '',
      operador: dto.operador?.trim() || createdBy,
      vendedorNome: dto.vendedorNome?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      createdBy,
      updatedBy: createdBy,
      status: dto.status || 'ACTIVE',
      version: 1,
    };

    this.db.clients.set(id, newClient);
    ClientRepository.invalidateCache();
    return newClient;
  }

  public update(id: string, dto: Partial<CreateClientDTO>, updatedBy: string = 'SYSTEM'): Client {
    const existing = this.findById(id);
    if (!existing) {
      throw new Error('Cliente não encontrado.');
    }

    if (dto.endereco !== undefined) {
      const mergedNumero = dto.endereco.numero !== undefined ? dto.endereco.numero : existing.endereco?.numero;
      if (!mergedNumero || !mergedNumero.trim()) {
        throw new Error('O campo Número no Endereço do Cliente é obrigatório. Caso não possua número, informe "S/N".');
      }
    }

    const updatedNome = dto.nome !== undefined 
      ? cleanClientFullName(dto.nome, dto.sobrenome)
      : existing.nome;

    const updated: Client = {
      ...existing,
      ...dto,
      nome: updatedNome,
      sobrenome: undefined,
      dataNascimento: dto.dataNascimento !== undefined ? (dto.dataNascimento?.trim() || undefined) : existing.dataNascimento,
      dataFundacao: dto.dataFundacao !== undefined ? (dto.dataFundacao?.trim() || undefined) : existing.dataFundacao,
      razaoSocial: dto.razaoSocial !== undefined ? dto.razaoSocial.trim() : existing.razaoSocial,
      nomeFantasia: dto.nomeFantasia !== undefined ? dto.nomeFantasia.trim() : existing.nomeFantasia,
      telefone: dto.telefone !== undefined ? dto.telefone.trim() : existing.telefone,
      email: dto.email !== undefined ? dto.email.trim() : existing.email,
      operador: dto.operador !== undefined ? dto.operador.trim() : (existing.operador || updatedBy),
      vendedorNome: dto.vendedorNome !== undefined ? dto.vendedorNome.trim() : existing.vendedorNome,
      endereco: dto.endereco ? { ...existing.endereco, ...dto.endereco } : existing.endereco,
      updatedAt: Database.nowISO(),
      updatedBy,
      version: existing.version + 1,
    };

    this.db.clients.set(id, updated);
    ClientRepository.invalidateCache();
    return updated;
  }

  /**
   * Delete Client by ID
   */
  public delete(id: string): boolean {
    const existing = this.findById(id);
    if (!existing) {
      throw new Error('Cliente não encontrado.');
    }
    const res = this.db.clients.delete(id);
    ClientRepository.invalidateCache();
    return res;
  }

  /**
   * List all clients sorted by creation date (cached)
   */
  public async listAll(): Promise<Client[]> {
    this.sanitizeExistingClients();
    if (this.db.clients.size === 0) {
      await this.db.syncCollection('clients');
    }
    const sorted = Array.from(this.db.clients.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    ClientRepository.cachedSortedClients = sorted;
    return sorted;
  }

  /**
   * Get Client by ID
   */
  public findById(id: string): Client | undefined {
    return this.db.clients.get(id);
  }

  /**
   * Bulk import or update clients from spreadsheet data (Excel / CSV)
   */
  public bulkImport(
    clients: Array<Partial<CreateClientDTO> & { originalRow?: number }>,
    options: {
      updateExistingByDoc?: boolean;
      updateExistingByName?: boolean;
    } = {},
    createdBy: string = 'SYSTEM'
  ): {
    total: number;
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; identifier: string; error: string }>;
  } {
    const updateExistingByDoc = options.updateExistingByDoc !== false;
    const updateExistingByName = options.updateExistingByName === true;
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ row: number; identifier: string; error: string }> = [];

    // Pre-calculate next maxNum for sequential code generation
    let maxNum = 0;
    for (const client of this.db.clients.values()) {
      if (!client.codigo) continue;
      const match = client.codigo.match(/^C?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    const generateCode = () => {
      maxNum += 1;
      return `C${String(maxNum).padStart(7, '0')}`;
    };

    const now = Database.nowISO();

    const affectedIds: string[] = [];

    clients.forEach((item, index) => {
      const rowNum = item.originalRow ?? (index + 2); // Linha no Excel (linha 1 é cabeçalho)
      try {
        const rawNome = (item.nome || item.razaoSocial || item.nomeFantasia || '').trim();
        if (!rawNome) {
          throw new Error('Nome ou Razão Social não informado.');
        }

        const rawDoc = (item.cpf || item.cnpj || '').replace(/\D/g, '');
        const isCnpj = rawDoc.length === 14 || item.type === 'PJ' || Boolean(item.razaoSocial && !item.nome);
        const type = isCnpj ? 'PJ' : 'PF';

        // Verifica existência pelo documento CPF ou CNPJ
        let existingClient: Client | undefined;
        if (rawDoc) {
          if (type === 'PJ') {
            existingClient = this.findByCNPJ(rawDoc);
          } else {
            existingClient = this.findByCPF(rawDoc);
          }
        }

        // Se não encontrou pelo documento, tenta pelo nome se a opção estiver ativada
        if (!existingClient && updateExistingByName && rawNome) {
          const lowerName = rawNome.toLowerCase();
          existingClient = Array.from(this.db.clients.values()).find((c) => {
            const clientName = (
              c.type === 'PF'
                ? cleanClientFullName(c.nome, c.sobrenome)
                : `${c.razaoSocial || ''} ${c.nomeFantasia || ''}`
            ).toLowerCase();
            return clientName.trim() === lowerName || (clientName.length > 5 && clientName.includes(lowerName));
          });
        }

        if (existingClient) {
          if (updateExistingByDoc) {
            // Atualiza cliente existente com os dados mais recentes da planilha
            const cleanUpdatedNome = type === 'PF'
              ? (cleanClientFullName(item.nome || rawNome, item.sobrenome) || existingClient.nome)
              : existingClient.nome;

            const updatedClient: Client = {
              ...existingClient,
              nome: cleanUpdatedNome,
              sobrenome: undefined,
              razaoSocial: type === 'PJ' ? (item.razaoSocial?.trim() || existingClient.razaoSocial) : existingClient.razaoSocial,
              nomeFantasia: type === 'PJ' ? (item.nomeFantasia?.trim() || existingClient.nomeFantasia) : existingClient.nomeFantasia,
              telefone: item.telefone?.trim() || existingClient.telefone,
              email: item.email?.trim() || existingClient.email,
              dataNascimento: (item as any).dataNascimento?.trim() || existingClient.dataNascimento,
              dataFundacao: (item as any).dataFundacao?.trim() || existingClient.dataFundacao,
              inscricaoEstadual: item.inscricaoEstadual?.trim() || existingClient.inscricaoEstadual,
              endereco: {
                cep: item.endereco?.cep || existingClient.endereco?.cep || '',
                logradouro: item.endereco?.logradouro || existingClient.endereco?.logradouro || '',
                numero: item.endereco?.numero || existingClient.endereco?.numero || '',
                complemento: item.endereco?.complemento || existingClient.endereco?.complemento || '',
                bairro: item.endereco?.bairro || existingClient.endereco?.bairro || '',
                cidade: item.endereco?.cidade || existingClient.endereco?.cidade || '',
                estado: item.endereco?.estado || existingClient.endereco?.estado || '',
              },
              updatedAt: now,
              updatedBy: createdBy,
              version: (existingClient.version || 1) + 1,
            };
            this.db.clients.set(existingClient.id, updatedClient);
            affectedIds.push(existingClient.id);
            updated++;
          } else {
            skipped++;
          }
          return;
        }

        // Prepara dados de criação de novo cliente
        let nome = '';
        let razaoSocial = '';
        let nomeFantasia = '';

        if (type === 'PF') {
          nome = cleanClientFullName(item.nome || rawNome, item.sobrenome);
        } else {
          razaoSocial = item.razaoSocial?.trim() || rawNome;
          nomeFantasia = item.nomeFantasia?.trim() || item.razaoSocial?.trim() || rawNome;
        }

        const id = Database.generateId('CLI');
        const codigo = generateCode();

        const newClient: Client = {
          id,
          codigo,
          type,
          nome: type === 'PF' ? nome : undefined,
          sobrenome: undefined,
          cpf: type === 'PF' && rawDoc ? rawDoc : (type === 'PF' ? item.cpf?.trim() : undefined),
          razaoSocial: type === 'PJ' ? razaoSocial : undefined,
          nomeFantasia: type === 'PJ' ? nomeFantasia : undefined,
          cnpj: type === 'PJ' && rawDoc ? rawDoc : (type === 'PJ' ? item.cnpj?.trim() : undefined),
          inscricaoEstadual: item.inscricaoEstadual?.trim() || 'ISENTO',
          endereco: {
            cep: item.endereco?.cep?.trim() || '',
            logradouro: item.endereco?.logradouro?.trim() || '',
            numero: item.endereco?.numero?.trim() || '',
            complemento: item.endereco?.complemento?.trim() || '',
            bairro: item.endereco?.bairro?.trim() || '',
            cidade: item.endereco?.cidade?.trim() || '',
            estado: item.endereco?.estado?.trim() || '',
          },
          telefone: item.telefone?.trim() || '',
          email: item.email?.trim() || '',
          dataNascimento: (item as any).dataNascimento?.trim() || undefined,
          dataFundacao: (item as any).dataFundacao?.trim() || undefined,
          createdAt: now,
          updatedAt: now,
          createdBy,
          updatedBy: createdBy,
          status: 'ACTIVE',
          version: 1,
        };

        this.db.clients.set(id, newClient);
        affectedIds.push(id);
        imported++;
      } catch (err: any) {
        errors.push({
          row: rowNum,
          identifier: item.nome || item.razaoSocial || item.cpf || item.cnpj || `Linha ${rowNum}`,
          error: err.message || 'Erro ao processar linha',
        });
      }
    });

    if (affectedIds.length > 0) {
      const entriesToPersist = affectedIds
        .map((id) => {
          const val = this.db.clients.get(id);
          return val ? { key: id, value: val } : null;
        })
        .filter((x): x is { key: string; value: any } => Boolean(x));

      this.db.clients.persistMany(entriesToPersist).catch((e) => {
        console.error('Error background persisting spreadsheet clients to Supabase:', e);
      });
    }

    ClientRepository.invalidateCache();

    return {
      total: clients.length,
      imported,
      updated,
      skipped,
      errors,
    };
  }
}
