import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Uygulama genelinde hata sınırı.
 *
 * React'te yakalanmayan bir istisna tüm ağacı söker ve kullanıcı boş beyaz bir
 * sayfayla kalır. Anlora'nın verisi tarayıcıda durduğu için bozuk tek bir
 * kayıt (elle düzenlenmiş localStorage, yarım kalmış içe aktarma, eski sürüm
 * biçimi) tüm uygulamayı erişilemez hale getirebiliyordu. Bu sınır hatayı
 * yakalar, kullanıcıya ne yapabileceğini anlatır ve verisini kaybetmeden
 * çıkış yolu sunar.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Anlora beklenmeyen bir hatayla karşılaştı:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#F8F7F3] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#E4E1D9] p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#FAECEA] flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-6 h-6 text-[#C65D55]" />
          </div>

          <h1 className="text-lg font-bold text-[#1E2430] mb-2">Bir şeyler ters gitti</h1>
          <p className="text-sm text-[#687080] leading-relaxed mb-6">
            Anlora beklenmeyen bir hatayla karşılaştı. Çalışma verileriniz tarayıcınızda
            duruyor ve silinmedi. Sayfayı yenilemek çoğu durumda sorunu çözer.
          </p>

          <button
            onClick={this.handleReload}
            className="w-full py-3 bg-[#4F46A5] hover:bg-[#433B91] text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Sayfayı yenile</span>
          </button>

          <details className="mt-5 text-left">
            <summary className="text-[11px] text-[#8E95A2] cursor-pointer select-none">
              Teknik ayrıntı
            </summary>
            <pre className="mt-2 p-3 bg-[#FAF9F5] border border-[#EFECE6] rounded-lg text-[11px] text-[#687080] whitespace-pre-wrap break-words overflow-x-auto">
              {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
