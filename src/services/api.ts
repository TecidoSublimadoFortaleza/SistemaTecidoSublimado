/**
 * ERP SubliGestão - API Client Service
 */

import type { UserProfile } from '../types/frontend';
import type { NotaFiscal, ConfiguracaoFiscal, EmissaoFiscalDTO } from '../server/types/fiscal';
import type { MeasurementFormula } from '../types/measurementFormula';
import { DEFAULT_MEASUREMENT_FORMULAS, FORMULA_CUBO_MESA_VESTE } from '../types/measurementFormula';

export type { NotaFiscal, ConfiguracaoFiscal, EmissaoFiscalDTO, MeasurementFormula };

const API_BASE = '/api/v1';

export class ApiService {
  public static getAccessToken(): string | null {
    return localStorage.getItem('subligestao_access_token');
  }

  private static getRefreshToken(): string | null {
    return localStorage.getItem('subligestao_refresh_token');
  }

  public static setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('subligestao_access_token', accessToken);
    localStorage.setItem('subligestao_refresh_token', refreshToken);
  }

  public static clearTokens(): void {
    localStorage.removeItem('subligestao_access_token');
    localStorage.removeItem('subligestao_refresh_token');
  }

  private static isAuthenticating = false;
  private static inFlightGetRequests = new Map<string, Promise<any>>();
  private static cache = new Map<string, { timestamp: number; data: any; ttl: number }>();

  private static osChangedDebounceTimer: any = null;

  public static broadcastOsChanged(): void {
    if (typeof window === 'undefined') return;
    if (this.osChangedDebounceTimer) {
      clearTimeout(this.osChangedDebounceTimer);
    }
    this.osChangedDebounceTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('os-changed'));
    }, 100);
  }

  public static getCachedOrdensServico(): any[] | null {
    for (const [key, value] of this.cache.entries()) {
      if (key.startsWith('/os_') && Array.isArray(value.data)) {
        return value.data;
      }
    }
    return null;
  }

  public static updateCachedOs(os: any): void {
    if (!os || !os.id) return;
    let found = false;
    for (const [key, value] of this.cache.entries()) {
      if (key.startsWith('/os_') && Array.isArray(value.data)) {
        const index = value.data.findIndex((o: any) => o.id === os.id);
        if (index >= 0) {
          value.data[index] = { ...value.data[index], ...os };
        } else {
          value.data = [os, ...value.data];
        }
        value.timestamp = Date.now();
        found = true;
      }
    }
    if (!found) {
      this.cache.set('/os_', { timestamp: Date.now(), data: [os], ttl: 5000 });
    }
  }

  public static removeCachedOs(id: string): void {
    for (const [key, value] of this.cache.entries()) {
      if (key.startsWith('/os_') && Array.isArray(value.data)) {
        value.data = value.data.filter((o: any) => o.id !== id);
        value.timestamp = Date.now();
      }
    }
  }

  public static invalidateCache(endpointPrefix?: string): void {
    if (!endpointPrefix) {
      this.cache.clear();
      return;
    }
    for (const key of Array.from(this.cache.keys())) {
      if (key.includes(endpointPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  private static getCacheTtlForEndpoint(endpoint: string): number {
    // Only static definitions are cached:
    if (endpoint.startsWith('/products') || endpoint.startsWith('/categories')) {
      return 15000;
    }
    if (endpoint.startsWith('/roles') || endpoint.startsWith('/sectors')) {
      return 15000;
    }
    if (endpoint.startsWith('/clients')) {
      return 10000;
    }
    // OS listings: cache of 5 seconds for fast navigation
    if (endpoint.startsWith('/os') && !endpoint.includes('next-code')) {
      return 5000;
    }
    return 0;
  }

  public static async ensureAuthToken(): Promise<string | null> {
    const existing = this.getAccessToken();
    if (existing) return existing;
    return null;
  }

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const isGet = !options.method || options.method.toUpperCase() === 'GET';

    if (!isGet) {
      if (endpoint.includes('/client')) {
        this.invalidateCache('/clients');
      }
      if (endpoint.includes('/product') || endpoint.includes('/categories')) {
        this.invalidateCache('/products');
        this.invalidateCache('/categories');
      }
      if (endpoint.includes('/employee')) {
        this.invalidateCache('/employees');
      }
      if (endpoint.includes('/measurement-formulas')) {
        this.invalidateCache('/measurement-formulas');
      }
    }

    // Deduplicate concurrent GET requests and serve short-lived cache
    if (isGet && retryCount === 0) {
      const cacheKey = `${endpoint}_${options.headers ? JSON.stringify(options.headers) : ''}`;
      const ttl = this.getCacheTtlForEndpoint(endpoint);
      if (ttl > 0) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
          return cached.data;
        }
      }

      if (this.inFlightGetRequests.has(cacheKey)) {
        return this.inFlightGetRequests.get(cacheKey) as Promise<T>;
      }
      const promise = this.executeRequest<T>(endpoint, options, 0)
        .then((data) => {
          if (ttl > 0) {
            this.cache.set(cacheKey, { timestamp: Date.now(), data, ttl });
          }
          return data;
        })
        .finally(() => {
          this.inFlightGetRequests.delete(cacheKey);
        });
      this.inFlightGetRequests.set(cacheKey, promise);
      return promise;
    }

    return this.executeRequest<T>(endpoint, options, retryCount);
  }

  private static async executeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    let token = this.getAccessToken();
    if (!token && !endpoint.includes('/auth/login')) {
      token = await this.ensureAuthToken();
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (networkErr: any) {
      if (retryCount < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, retryCount)));
        return this.executeRequest<T>(endpoint, options, retryCount + 1);
      }
      throw new Error(`Falha de conexão com o servidor: ${networkErr.message || 'Servidor indisponível'}`);
    }

    // Auto-retry on HTTP 429 (Too Many Requests) with exponential backoff
    if (response.status === 429 && retryCount < 3) {
      const waitTime = (retryCount + 1) * 800;
      console.warn(`[ApiService] Rate limit temporário detectado (429) em ${endpoint}. Aguardando ${waitTime}ms para re-tentar automaticamente...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.executeRequest<T>(endpoint, options, retryCount + 1);
    }

    const responseText = await response.text();
    let data: any = {};

    try {
      if (responseText && responseText.trim()) {
        data = JSON.parse(responseText);
      }
    } catch (parseErr) {
      // Response was not JSON (e.g. HTML error page or raw server notice)
      if (!response.ok) {
        if (response.status === 429 && retryCount < 3) {
          const waitTime = (retryCount + 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          return this.executeRequest<T>(endpoint, options, retryCount + 1);
        }
        throw new Error(`Erro do servidor HTTP ${response.status}: ${response.statusText || 'Não foi possível processar a requisição'}`);
      }
      // If server returned 200 OK with HTML (e.g. Vite dev server transition), retry once or return safe object
      if (retryCount < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return this.executeRequest<T>(endpoint, options, retryCount + 1);
      }
      return (Array.isArray(data) ? [] : {}) as T;
    }

    if (!response.ok) {
      // Handle expired token or insufficient permissions auto-refresh / developer re-auth
      if ((response.status === 401 || response.status === 403) && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
        try {
          let newToken: string | null = null;
          if (this.getRefreshToken()) {
            try {
              const newTokens = await this.refreshToken();
              this.setTokens(newTokens.accessToken, newTokens.refreshToken);
              newToken = newTokens.accessToken;
            } catch {
              this.clearTokens();
            }
          }
          if (!newToken) {
            newToken = await this.ensureAuthToken();
          }

          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
              ...options,
              headers,
            });
            const retryText = await retryResponse.text();
            let retryData: any = {};
            try {
              if (retryText && retryText.trim()) retryData = JSON.parse(retryText);
            } catch {}

            if (retryResponse.ok) {
              return retryData.data !== undefined ? retryData.data : retryData;
            }
          }
        } catch {
          // Continue to error throw below
        }
      }

      throw new Error(data.error || data.message || `Erro ${response.status} ao processar requisição no servidor.`);
    }

    return data.data !== undefined ? data.data : data;
  }

  public static async login(username: string, password: string): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
    roleName: string;
    sectorName: string;
  }> {
    const data = await this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  public static async refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) throw new Error('Refresh token indisponível.');
    return this.request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  public static async getCurrentUser(): Promise<{
    user: any;
    role: string;
    sector: string;
    branch: string;
    isDeveloper: boolean;
  }> {
    return this.request('/auth/me', { method: 'GET' });
  }

  public static async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearTokens();
    }
  }

  public static async changePassword(payload: {
    currentPassword?: string;
    newPassword: string;
    confirmPassword?: string;
    username?: string;
    userId?: string;
    newUsername?: string;
  }): Promise<{
    success: boolean;
    message: string;
    newUsername?: string;
    accessToken?: string;
    refreshToken?: string;
    updatedEmployeesCount?: number;
  }> {
    return this.request<{
      success: boolean;
      message: string;
      newUsername?: string;
      accessToken?: string;
      refreshToken?: string;
      updatedEmployeesCount?: number;
    }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public static async updateProfile(payload: {
    name?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    fotoUrl?: string;
    avatar_url?: string;
    supportAvatarUrl?: string;
    supportPhotoUrl?: string;
    isSupportPhoto?: boolean;
    userId?: string;
    username?: string;
  }): Promise<{
    user?: any;
    success?: boolean;
    message?: string;
  }> {
    return this.request<{
      user?: any;
      success?: boolean;
      message?: string;
    }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  public static async verifyPassword(
    password: string,
    username?: string,
    targetRole?: string
  ): Promise<{
    success: boolean;
    valid: boolean;
    message?: string;
    superiorRole?: string;
    rank?: number;
    superiorName?: string;
    isDeveloper?: boolean;
  }> {
    return this.request<{
      success: boolean;
      valid: boolean;
      message?: string;
      superiorRole?: string;
      rank?: number;
      superiorName?: string;
      isDeveloper?: boolean;
    }>('/auth/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password, username, targetRole }),
    });
  }

  public static async verifyOsEditPassword(
    password: string,
    params?: {
      osOperator?: string;
      osVendedor?: string;
      osCodigo?: string;
    }
  ): Promise<{
    success: boolean;
    valid: boolean;
    error?: string;
    message?: string;
    authorizedRole?: string;
    authorizedName?: string;
    isDeveloper?: boolean;
    isResponsible?: boolean;
    isDirecao?: boolean;
  }> {
    return this.request<{
      success: boolean;
      valid: boolean;
      error?: string;
      message?: string;
      authorizedRole?: string;
      authorizedName?: string;
      isDeveloper?: boolean;
      isResponsible?: boolean;
      isDirecao?: boolean;
    }>('/auth/verify-os-edit-password', {
      method: 'POST',
      body: JSON.stringify({
        password,
        osOperator: params?.osOperator,
        osVendedor: params?.osVendedor,
        osCodigo: params?.osCodigo,
      }),
    });
  }

  // Client Management Methods
  public static async createClient(clientData: any): Promise<any> {
    const res = await this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clients-changed'));
    }
    return res;
  }

  public static async bulkImportClients(payload: {
    clients: any[];
    options?: {
      updateExistingByDoc?: boolean;
      updateExistingByName?: boolean;
    };
  }): Promise<{
    success: boolean;
    data: {
      total: number;
      imported: number;
      updated: number;
      skipped: number;
      errors: Array<{ row: number; identifier: string; error: string }>;
    };
    message: string;
  }> {
    const res = await this.request<any>('/clients/bulk-import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clients-changed'));
    }
    return res;
  }

  public static async updateClient(id: string, clientData: any): Promise<any> {
    const res = await this.request(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clientData),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clients-changed'));
    }
    return res;
  }

  public static async deleteClient(id: string): Promise<any> {
    const res = await this.request(`/clients/${id}`, {
      method: 'DELETE',
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clients-changed'));
    }
    return res;
  }

  public static async getClients(): Promise<any[]> {
    const res = await this.request('/clients', { method: 'GET' });
    return Array.isArray(res) ? res : [];
  }

  public static async getClientById(id: string): Promise<any> {
    return this.request(`/clients/${id}`, { method: 'GET' });
  }

  // Employee Management Methods
  public static async createEmployee(employeeData: any): Promise<any> {
    const res = await this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('employees-changed'));
    }
    return res;
  }

  public static async updateEmployee(id: string, employeeData: any): Promise<any> {
    const res = await this.request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('employees-changed'));
    }
    return res;
  }

  public static async deleteEmployee(id: string): Promise<any> {
    const res = await this.request(`/employees/${id}`, {
      method: 'DELETE',
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('employees-changed'));
    }
    return res;
  }

  public static async getEmployees(): Promise<any[]> {
    const res = await this.request('/employees', { method: 'GET' });
    return Array.isArray(res) ? res : [];
  }

  public static async getEmployeeById(id: string): Promise<any> {
    return this.request(`/employees/${id}`, { method: 'GET' });
  }

  // Product Catalog & Inventory Methods
  public static async getProducts(forceSync: boolean = false): Promise<any[]> {
    if (forceSync) {
      this.invalidateCache('/products');
      const res = await this.request('/products?forceSync=true', { method: 'GET' });
      return Array.isArray(res) ? res : [];
    }
    const res = await this.request('/products', { method: 'GET' });
    return Array.isArray(res) ? res : [];
  }

  public static async syncStockWithSupabase(): Promise<{
    success: boolean;
    message: string;
    count: number;
    durationMs: number;
    source: string;
    products: any[];
    timestamp: string;
  }> {
    this.invalidateCache('/products');
    return this.request('/products/sync', {
      method: 'POST',
    });
  }

  public static async createProduct(productData: any): Promise<any> {
    this.invalidateCache('/products');
    const res = await this.request('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('products-changed'));
    }
    return res;
  }

  public static async batchImportProducts(items: any[]): Promise<{
    total: number;
    created: number;
    updated: number;
    products: any[];
  }> {
    this.invalidateCache('/products');
    const res = await this.request<any>('/products/batch-import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('products-changed'));
    }
    return res;
  }

  public static async updateProduct(id: string, productData: any): Promise<any> {
    this.invalidateCache('/products');
    const res = await this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('products-changed'));
    }
    return res;
  }

  public static async deleteProduct(id: string): Promise<any> {
    this.invalidateCache('/products');
    const res = await this.request(`/products/${id}`, {
      method: 'DELETE',
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('products-changed'));
    }
    return res;
  }

  public static async getCategories(
    options?: boolean | { forOs?: boolean; origem?: 'ESTOQUE' | 'PRODUTOS_VENDA'; scope?: 'estoque' | 'venda' | 'all' }
  ): Promise<string[]> {
    let url = '/categories';
    if (typeof options === 'boolean') {
      if (options) url += '?forOs=true';
    } else if (options) {
      const params = new URLSearchParams();
      if (options.forOs) params.append('forOs', 'true');
      if (options.origem) params.append('origem', options.origem);
      if (options.scope) params.append('scope', options.scope);
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }
    const res = await this.request(url, { method: 'GET' });
    return Array.isArray(res) ? res : [];
  }

  public static async addCategory(
    nome: string,
    options?: { paraVenda?: boolean; apenasEstoqueInterno?: boolean; origem?: 'ESTOQUE' | 'PRODUTOS_VENDA' }
  ): Promise<string[]> {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify({
        nome,
        paraVenda: options?.paraVenda,
        apenasEstoqueInterno: options?.apenasEstoqueInterno,
        origem: options?.origem,
      }),
    });
  }

  public static async updateCategory(
    oldName: string,
    newName: string,
    options?: { paraVenda?: boolean; apenasEstoqueInterno?: boolean; origem?: 'ESTOQUE' | 'PRODUTOS_VENDA' }
  ): Promise<string[]> {
    return this.request(`/categories/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      body: JSON.stringify({
        oldName,
        newName,
        paraVenda: options?.paraVenda,
        apenasEstoqueInterno: options?.apenasEstoqueInterno,
        origem: options?.origem,
      }),
    });
  }

  public static async deleteCategory(name: string): Promise<string[]> {
    return this.request(`/categories/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }

  // Ordem de Serviço Methods
  public static async getNextOsCode(tipo: 'OS' | 'ORCAMENTO' | 'OSS'): Promise<{ nextCode: string; tipo: string }> {
    return this.request(`/os/next-code?tipo=${tipo}`, { method: 'GET' });
  }

  public static async getOrdensServico(): Promise<any[]> {
    const res = await this.request('/os', { method: 'GET' });
    return Array.isArray(res) ? res : [];
  }

  public static async getOsById(id: string): Promise<any> {
    return this.request(`/os/${id}`, { method: 'GET' });
  }

  public static async createOs(osData: any): Promise<any> {
    const res = await this.request<any>('/os', {
      method: 'POST',
      body: JSON.stringify(osData),
    });
    if (res && res.id) {
      this.updateCachedOs(res);
    }
    this.broadcastOsChanged();
    return res;
  }

  public static async transformOrcToOs(id: string, payload?: any): Promise<any> {
    const res = await this.request<any>(`/os/${id}/transform-to-os`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
    if (res && res.id) {
      this.updateCachedOs(res);
    }
    this.broadcastOsChanged();
    return res;
  }

  public static async updateOs(id: string, updates: any): Promise<any> {
    const res = await this.request<any>(`/os/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (res && res.id) {
      this.updateCachedOs(res);
    }
    this.broadcastOsChanged();
    return res;
  }

  public static async deleteOs(id: string, passwordConfirm: string): Promise<any> {
    const res = await this.request<any>(`/os/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ passwordConfirm }),
    });
    this.removeCachedOs(id);
    this.broadcastOsChanged();
    return res;
  }

  // PDV Methods
  public static async getPdvTransactions(): Promise<any[]> {
    return this.request('/pdv/transactions', { method: 'GET' });
  }

  public static async createPdvTransaction(txData: any): Promise<any> {
    const res = await this.request('/pdv/transactions', {
      method: 'POST',
      body: JSON.stringify(txData),
    });
    this.broadcastOsChanged();
    return res;
  }

  // Developer Specific Actions
  public static async getDeveloperDiagnostics(): Promise<any> {
    return this.request('/developer/diagnostics', { method: 'GET' });
  }

  public static async testDatabaseConnection(): Promise<any> {
    return this.request('/developer/test-database', { method: 'POST' });
  }

  public static async updateDatabaseUrl(databaseUrl: string): Promise<any> {
    return this.request('/developer/update-database-url', {
      method: 'POST',
      body: JSON.stringify({ databaseUrl }),
    });
  }

  public static async triggerBackup(): Promise<any> {
    return this.request('/developer/backup', { method: 'POST' });
  }

  public static async triggerReset(): Promise<any> {
    return this.request('/developer/reset', { method: 'POST' });
  }

  // Mensagens Internas (Chat) Methods
  public static async getChatContacts(): Promise<any[]> {
    try {
      const res = await this.request<any[]>('/messages/contacts', { method: 'GET' });
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.warn('[ApiService] Não foi possível carregar contatos do chat:', err);
      return [];
    }
  }

  public static async sendChatHeartbeat(
    status: 'online' | 'away' | 'offline' = 'online',
    awaySince?: string | number | null
  ): Promise<any> {
    try {
      return await this.request('/messages/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ status, awaySince }),
      });
    } catch {
      // Silent error on heartbeat to avoid interrupting user flows
      return { success: false };
    }
  }

  public static async getChatGroups(): Promise<any[]> {
    return this.request('/messages/groups', { method: 'GET' });
  }

  public static async createChatGroup(groupData: { name: string; description?: string; sector?: string; role?: string; targetRoles?: string[]; memberUserIds: string[] }): Promise<any> {
    return this.request('/messages/groups', {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
  }

  public static async updateChatGroup(id: string, groupData: any): Promise<any> {
    return this.request(`/messages/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(groupData),
    });
  }

  public static async deleteChatGroup(id: string): Promise<any> {
    return this.request(`/messages/groups/${id}`, {
      method: 'DELETE',
    });
  }

  public static async sendChatMessage(msgData: { targetType: 'user' | 'group' | 'sector'; targetId: string; content: string; attachments?: any[] }): Promise<any> {
    return this.request('/messages/send', {
      method: 'POST',
      body: JSON.stringify(msgData),
    });
  }

  public static async getChatHistory(targetType: 'user' | 'group' | 'sector', targetId: string): Promise<any[]> {
    return this.request(`/messages/history/${targetType}/${targetId}`, { method: 'GET' });
  }

  public static async markChatRead(targetType: 'user' | 'group' | 'sector', targetId: string): Promise<any> {
    return this.request('/messages/read', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId }),
    });
  }

  public static async clearChatHistory(targetType: 'user' | 'group' | 'sector', targetId: string): Promise<any> {
    return this.request('/messages/clear-history', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId }),
    });
  }

  public static async getUnreadChatMessages(): Promise<any[]> {
    return this.request('/messages/unread', { method: 'GET' });
  }

  public static async getDeveloperChatAudit(): Promise<any> {
    return this.request('/messages/developer/audit', { method: 'GET' });
  }

  public static async developerClearChat(scope: 'own' | 'all'): Promise<any> {
    return this.request('/messages/developer/clear', {
      method: 'POST',
      body: JSON.stringify({ scope }),
    });
  }

  // --- Suporte Técnico Interno ---
  public static async listSupportTickets(): Promise<any[]> {
    return this.request('/messages/support/tickets', { method: 'GET' });
  }

  public static async sendSupportReply(clientUserId: string, content: string, attachments?: any[]): Promise<any> {
    return this.request('/messages/support/reply', {
      method: 'POST',
      body: JSON.stringify({ clientUserId, content, attachments }),
    });
  }

  public static async resolveSupportTicket(clientUserId: string, status: 'OPEN' | 'RESOLVED'): Promise<any> {
    return this.request('/messages/support/resolve', {
      method: 'POST',
      body: JSON.stringify({ clientUserId, status }),
    });
  }

  // --- Emissão de Notas Fiscais (NF-e / NFC-e) ---
  public static async getFiscalConfig(): Promise<ConfiguracaoFiscal> {
    return this.request('/fiscal/config', { method: 'GET' });
  }

  public static async updateFiscalConfig(updates: Partial<ConfiguracaoFiscal>): Promise<ConfiguracaoFiscal> {
    return this.request('/fiscal/config', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  public static async listNotasFiscais(params?: {
    tipo?: string;
    status?: string;
    search?: string;
    limit?: number;
  }): Promise<NotaFiscal[]> {
    const query = new URLSearchParams();
    if (params?.tipo) query.set('tipo', params.tipo);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/fiscal/notas${qs}`, { method: 'GET' });
  }

  public static async getNotaFiscalById(id: string): Promise<NotaFiscal> {
    return this.request(`/fiscal/notas/${id}`, { method: 'GET' });
  }

  public static async getNotaFiscalByOrigem(origemId: string): Promise<NotaFiscal | null> {
    return this.request(`/fiscal/notas/origem/${origemId}`, { method: 'GET' });
  }

  public static async emitirNotaFiscal(dto: EmissaoFiscalDTO): Promise<NotaFiscal> {
    return this.request('/fiscal/emitir', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  public static async cancelarNotaFiscal(id: string, justificativa: string): Promise<NotaFiscal> {
    return this.request(`/fiscal/notas/${id}/cancelar`, {
      method: 'POST',
      body: JSON.stringify({ justificativa }),
    });
  }

  public static async syncNotaFiscal(id: string): Promise<NotaFiscal> {
    const res = await this.request<{ success: boolean; message: string; data: NotaFiscal }>(`/fiscal/notas/${id}/sync`, {
      method: 'POST',
    });
    return res.data;
  }

  public static async syncPendingNotas(): Promise<{ success: boolean; updatedCount: number; message: string; notas: NotaFiscal[] }> {
    return this.request('/fiscal/sync-pending', {
      method: 'POST',
    });
  }

  public static async getFiscalDashboard(): Promise<{
    totalValor: number;
    totalQtd: number;
    autorizadas: number;
    canceladas: number;
    nfceQtd: number;
    nfeQtd: number;
  }> {
    return this.request('/fiscal/dashboard', { method: 'GET' });
  }

  public static async testFiscalConnection(): Promise<any> {
    return this.request('/fiscal/test-connection', { method: 'POST' });
  }

  public static async deleteNotaFiscal(id: string): Promise<any> {
    return this.request(`/fiscal/notas/${id}`, { method: 'DELETE' });
  }

  public static async resetFiscalTesting(): Promise<any> {
    return this.request('/fiscal/reset-testing', { method: 'POST' });
  }

  // --- Gestão de Filiais / Unidades (Persistência no Banco de Dados Supabase / PostgreSQL) ---
  public static async getFiliais(): Promise<any[]> {
    try {
      const res = await this.request<{ success: boolean; data: any[] }>('/filiais', { method: 'GET' });
      if (res?.data && Array.isArray(res.data)) {
        return res.data;
      }
      if (Array.isArray(res)) {
        return res;
      }
      return [];
    } catch (err) {
      console.error('Falha ao carregar filiais da API:', err);
      return [];
    }
  }

  public static async saveFiliais(filiais: any[]): Promise<any[]> {
    try {
      const res = await this.request<{ success: boolean; data: any[] }>('/filiais', {
        method: 'PUT',
        body: JSON.stringify({ filiais }),
      });
      if (res?.data && Array.isArray(res.data)) {
        return res.data;
      }
      return filiais;
    } catch (err) {
      console.error('Falha ao salvar filiais no banco de dados:', err);
      return filiais;
    }
  }

  public static async deleteFilial(id: string): Promise<any> {
    try {
      return await this.request(`/filiais/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Falha ao excluir filial na API:', err);
      return null;
    }
  }

  public static async deleteAllFiliais(): Promise<any> {
    try {
      return await this.request('/filiais', { method: 'DELETE' });
    } catch (err) {
      console.error('Falha ao excluir todas as filiais na API:', err);
      return null;
    }
  }

  // --- Metas de Vendas (Persistência no Banco de Dados) ---
  public static async getMetas(): Promise<Record<string, any>> {
    const res = await this.request<{ success: boolean; data: Record<string, any> }>('/metas', { method: 'GET' });
    return res?.data || {};
  }

  public static async saveMetas(metas: Record<string, any>): Promise<Record<string, any>> {
    const res = await this.request<{ success: boolean; data: Record<string, any> }>('/metas', {
      method: 'PUT',
      body: JSON.stringify({ metas }),
    });
    return res?.data || {};
  }

  // --- Controle e Permissões RBAC (Persistência no Supabase / PostgreSQL) ---
  public static async getPermissions(): Promise<Record<string, any>> {
    const res = await this.request<any>('/permissions', { method: 'GET' });
    if (res && res.data && typeof res.data === 'object' && !res.visualizar) {
      return res.data;
    }
    return res || {};
  }

  public static async savePermissions(permissions: Record<string, any>): Promise<Record<string, any>> {
    const res = await this.request<any>('/permissions', {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
    if (res && res.data && typeof res.data === 'object' && !res.visualizar) {
      return res.data;
    }
    return res || {};
  }

  // --- Backup & Restauração (Exclusivo Developer e Administrador Master) ---
  public static async getBackupStats(params?: { startDate?: string; endDate?: string }): Promise<{
    estoque: number;
    funcionarios: number;
    clientes: number;
    os: number;
    vnd: number;
    mensagens: number;
    historicoPermissoes: number;
    filiais: number;
    historicoNotasFiscais: number;
    calculosProduto: number;
    historicoMudancas: number;
    total: number;
  }> {
    const q = new URLSearchParams();
    if (params?.startDate) q.append('startDate', params.startDate);
    if (params?.endDate) q.append('endDate', params.endDate);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    const res = await this.request<{ success: boolean; stats: any }>(`/backup/stats${queryStr}`, { method: 'GET' });
    return (
      res?.stats || {
        estoque: 0,
        funcionarios: 0,
        clientes: 0,
        os: 0,
        vnd: 0,
        mensagens: 0,
        historicoPermissoes: 0,
        filiais: 0,
        historicoNotasFiscais: 0,
        calculosProduto: 0,
        historicoMudancas: 0,
        total: 0,
      }
    );
  }

  public static async exportBackup(payload: {
    startDate?: string;
    endDate?: string;
    modules?: string[];
    includeImages?: boolean;
  }): Promise<any> {
    return this.request<{ success: boolean; backupPackage: any; message: string }>('/backup/export', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public static async importBackup(payload: {
    backupPackage: any;
    mode?: 'merge' | 'replace';
    selectedModules?: string[];
  }): Promise<any> {
    return this.request<{ success: boolean; message: string; mode: string; importStats: any }>('/backup/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Fórmulas de Medidas (Persistência no Supabase e Local) ---
  public static async getMeasurementFormulas(forceRefresh = false): Promise<MeasurementFormula[]> {
    if (forceRefresh) {
      this.invalidateCache('/measurement-formulas');
    }

    const getDeletedIds = (): string[] => {
      try {
        const raw = localStorage.getItem('subligestao_deleted_measurement_formulas');
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (_) {}
      return [];
    };

    const mergeWithDefaults = (list: MeasurementFormula[], deletedList: string[] = []): MeasurementFormula[] => {
      const map = new Map<string, MeasurementFormula>();
      for (const base of DEFAULT_MEASUREMENT_FORMULAS) {
        if (!deletedList.includes(base.id)) {
          map.set(base.id, base);
        }
      }
      for (const item of list) {
        if (item && item.id && !deletedList.includes(item.id)) {
          map.set(item.id, item);
        }
      }
      return Array.from(map.values());
    };

    try {
      const res = await this.request<{ success: boolean; data: MeasurementFormula[] }>('/measurement-formulas', {
        method: 'GET',
      });
      if (res?.data && Array.isArray(res.data)) {
        // Se a API retornou com sucesso, respeitamos a resposta da nuvem (Supabase)
        const deletedIds = getDeletedIds();
        const fullList = mergeWithDefaults(res.data, deletedIds);
        localStorage.setItem('subligestao_measurement_formulas', JSON.stringify(fullList));
        return fullList;
      }
    } catch (_) {}

    const cached = localStorage.getItem('subligestao_measurement_formulas');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const deletedIds = getDeletedIds();
          const fullList = mergeWithDefaults(parsed, deletedIds);
          localStorage.setItem('subligestao_measurement_formulas', JSON.stringify(fullList));
          return fullList;
        }
      } catch (_) {}
    }
    return DEFAULT_MEASUREMENT_FORMULAS;
  }

  public static async saveMeasurementFormula(formula: MeasurementFormula): Promise<MeasurementFormula> {
    this.invalidateCache('/measurement-formulas');

    // Padroniza e canonicaliza Cálculo Cubo e Cilindro
    const isCubo =
      (formula.titulo || '').toLowerCase().trim() === 'cálculo cubo' ||
      (formula.titulo || '').toLowerCase().trim() === 'calculo cubo' ||
      (formula.titulo || '').toLowerCase().trim().includes('cubo') ||
      (formula.titulo || '').toLowerCase().trim().includes('mesa veste') ||
      formula.id === 'formula_1791484964399' ||
      formula.id === 'calculo_cubo';
    const isCilindro =
      (formula.titulo || '').toLowerCase().trim() === 'cálculo de cilindro' ||
      (formula.titulo || '').toLowerCase().trim() === 'calculo de cilindro' ||
      (formula.titulo || '').toLowerCase().trim() === 'cálculo cilindro' ||
      (formula.titulo || '').toLowerCase().trim() === 'calculo cilindro' ||
      formula.id === 'calculo_cilindro';
    if (isCubo) {
      formula = { ...formula, id: 'calculo_cubo' };
    } else if (isCilindro) {
      formula = { ...formula, id: 'calculo_cilindro' };
    }

    // Desmarca da lista de excluídos
    try {
      const delCached = localStorage.getItem('subligestao_deleted_measurement_formulas');
      if (delCached) {
        let delList: string[] = JSON.parse(delCached);
        delList = delList.filter((dId) => dId !== formula.id && dId !== 'calculo_cubo' && dId !== 'formula_1791484964399' && dId !== 'calculo_cilindro');
        localStorage.setItem('subligestao_deleted_measurement_formulas', JSON.stringify(delList));
      }
    } catch (_) {}

    // Atualização otimista imediata no localStorage para nunca perder o dado na UI
    let currentList: MeasurementFormula[] = [];
    const cached = localStorage.getItem('subligestao_measurement_formulas');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) currentList = parsed;
      } catch (_) {}
    }
    if (currentList.length === 0) {
      currentList = [...DEFAULT_MEASUREMENT_FORMULAS];
    }

    const existingIdx = currentList.findIndex((f) => f.id === formula.id);
    if (existingIdx >= 0) {
      currentList[existingIdx] = formula;
    } else {
      currentList.push(formula);
    }
    localStorage.setItem('subligestao_measurement_formulas', JSON.stringify(currentList));
    window.dispatchEvent(new CustomEvent('measurement-formulas-changed'));

    try {
      const res = await this.request<{ success: boolean; data: MeasurementFormula }>('/measurement-formulas', {
        method: 'POST',
        body: JSON.stringify(formula),
      });
      if (res?.data) {
        const remoteFormula = res.data;
        const idx = currentList.findIndex((f) => f.id === remoteFormula.id);
        if (idx >= 0) currentList[idx] = remoteFormula;
        else currentList.push(remoteFormula);
        localStorage.setItem('subligestao_measurement_formulas', JSON.stringify(currentList));
        window.dispatchEvent(new CustomEvent('measurement-formulas-changed'));
        return remoteFormula;
      }
    } catch (err) {
      console.warn('[ApiService] Salvo localmente, pendente de sincronização com o banco remoto:', err);
    }

    return formula;
  }

  public static async deleteMeasurementFormula(id: string): Promise<boolean> {
    this.invalidateCache('/measurement-formulas');

    // Salva na lista de IDs excluídos no cliente
    try {
      const delCached = localStorage.getItem('subligestao_deleted_measurement_formulas');
      let delList: string[] = [];
      if (delCached) {
        delList = JSON.parse(delCached);
      }
      if (!delList.includes(id)) {
        delList.push(id);
        localStorage.setItem('subligestao_deleted_measurement_formulas', JSON.stringify(delList));
      }
    } catch (_) {}

    let currentList: MeasurementFormula[] = [];
    const cached = localStorage.getItem('subligestao_measurement_formulas');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) currentList = parsed;
      } catch (_) {}
    }
    const updated = currentList.filter((f) => f.id !== id);
    localStorage.setItem('subligestao_measurement_formulas', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('measurement-formulas-changed'));

    try {
      const res = await this.request<{ success: boolean; message?: string }>(`/measurement-formulas/${id}`, {
        method: 'DELETE',
      });
      return Boolean(res?.success);
    } catch (_) {
      return true;
    }
  }

  public static async restoreDefaultMeasurementFormulas(): Promise<MeasurementFormula[]> {
    this.invalidateCache('/measurement-formulas');
    localStorage.removeItem('subligestao_deleted_measurement_formulas');
    try {
      await this.request('/measurement-formulas/restore-defaults', { method: 'POST' });
    } catch (_) {}
    return this.getMeasurementFormulas(true);
  }

  // --- Gestão de Temas Diversos (Supabase / PostgreSQL) ---
  public static async getThemes(): Promise<any[]> {
    try {
      const res = await this.request<{ success: boolean; data: any[] }>('/themes', { method: 'GET' });
      return res?.data || [];
    } catch (err) {
      console.error('Falha ao buscar temas na API:', err);
      return [];
    }
  }

  public static async saveTheme(theme: any): Promise<any[]> {
    try {
      const res = await this.request<{ success: boolean; data: any[] }>('/themes', {
        method: 'POST',
        body: JSON.stringify(theme),
      });
      return res?.data || [];
    } catch (err) {
      console.error('Falha ao salvar tema na API:', err);
      throw err;
    }
  }

  public static async uploadThemeImage(imageBase64: string, filename?: string): Promise<{ success: boolean; url: string }> {
    try {
      const res = await this.request<{ success: boolean; url: string }>('/themes/upload-image', {
        method: 'POST',
        body: JSON.stringify({ imageBase64, filename }),
      });
      return res;
    } catch (err) {
      console.warn('Falha no upload da imagem no servidor, utilizando fallback:', err);
      throw err;
    }
  }

  public static async deleteTheme(id: string): Promise<any[]> {
    try {
      const res = await this.request<{ success: boolean; data: any[] }>(`/themes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return res?.data || [];
    } catch (err) {
      console.error('Falha ao excluir tema na API:', err);
      throw err;
    }
  }

  public static async resetDefaultTheme(): Promise<any[]> {
    try {
      const res = await this.request<{ success: boolean; data: any[] }>('/themes/reset-default', {
        method: 'POST',
      });
      return res?.data || [];
    } catch (err) {
      console.error('Falha ao resetar tema para padrão na API:', err);
      throw err;
    }
  }

  public static async applyTheme(themeId: string | null, theme?: any): Promise<any[]> {
    try {
      const res = await this.request<{ success: boolean; data: any[] }>('/themes/apply', {
        method: 'POST',
        body: JSON.stringify({ themeId, theme }),
      });
      return res?.data || [];
    } catch (err) {
      console.error('Falha ao aplicar tema na API:', err);
      throw err;
    }
  }

  public static async getThemeVersion(): Promise<number> {
    try {
      const res = await this.request<{ success: boolean; version: number }>('/themes/version', { method: 'GET' });
      return res?.version || 0;
    } catch {
      return 0;
    }
  }
}

