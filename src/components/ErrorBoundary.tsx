import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div id="error-boundary-fallback" className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                画面の表示中に問題が発生しました
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {this.state.error?.message || '予期せぬエラーが発生しました'}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                id="btn-error-retry"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors"
              >
                やり直す
              </button>
              <button
                id="btn-error-reload"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm shadow-blue-500/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>再読み込み</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
