import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  isInline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
    this.handleReset = this.handleReset.bind(this);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    // If it's a dynamic module import failure or Vite bundle hash mismatch (e.g. after server restart)
    const errorMsg = error?.message || '';
    if (
      errorMsg.includes('Failed to fetch dynamically imported module') ||
      errorMsg.includes('Importing a module script failed') ||
      errorMsg.includes('Invalid hook call') ||
      errorMsg.includes('useState') ||
      errorMsg.includes('reading \'useState\'')
    ) {
      const refreshedKey = 'subligestao_chunk_reload_count';
      const count = parseInt(sessionStorage.getItem(refreshedKey) || '0', 10);
      if (count < 2) {
        sessionStorage.setItem(refreshedKey, String(count + 1));
        window.location.reload();
      }
    }
  }

  private handleReset() {
    sessionStorage.removeItem('subligestao_chunk_reload_count');
    this.setState({ hasError: false, error: null });
    window.location.reload();
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.isInline) {
        return (
          <div className="w-full min-h-[360px] bg-slate-900/40 rounded-2xl border border-rose-500/20 p-6 flex flex-col items-center justify-center text-center my-4">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-xl flex items-center justify-center mb-3 border border-rose-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-100 mb-1">
              {this.props.fallbackTitle || 'Falha ao carregar este módulo'}
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
              {this.state.error?.message || 'Houve uma oscilação no carregamento dinâmico dos componentes.'}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Recarregar Módulo</span>
            </button>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mb-4 border border-rose-500/30">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">
            {this.props.fallbackTitle || 'Ocorreu um erro inesperado'}
          </h1>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            {this.state.error?.message || 'Falha ao processar as instruções do módulo.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Recarregar Sistema</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
