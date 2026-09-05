import React, { useEffect } from 'react';
import { Check, AlertCircle, X } from 'lucide-react';
import { RealmsIcon } from '../ui/RealmsIcon';

export interface ToastMessage {
  id: string;
  type: 'learned' | 'learning' | 'favorite' | 'unfavorite' | 'info' | 'error';
  text: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    /*
     * Ekran okuyucu bildirimleri buradan duyurur. Kabın kendisi sayfa
     * yüklenirken var olmalı ki içine eklenen metinler "canlı" sayılsın;
     * sonradan oluşturulan bir aria-live kabı çoğu okuyucuda sessiz kalır.
     * polite: kullanıcının o an okuduğu şeyi kesmez, sırasını bekler.
     */
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 2800);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const getStyle = () => {
    switch (toast.type) {
      case 'learned':
        return {
          bg: 'bg-[var(--surface)]',
          border: 'border-[var(--learned-border)]',
          text: 'text-[var(--text-primary)]',
          icon: <Check className="w-4 h-4 text-[var(--learned)] stroke-[2.5]" />
        };
      case 'learning':
        return {
          bg: 'bg-[var(--surface)]',
          border: 'border-[var(--learning-border)]',
          text: 'text-[var(--text-primary)]',
          icon: <RealmsIcon name="repeat" size={20} className="text-[var(--learning-text)]" />
        };
      case 'favorite':
        return {
          bg: 'bg-[var(--surface)]',
          border: 'border-[var(--danger-tint)]',
          text: 'text-[var(--text-primary)]',
          icon: <RealmsIcon name="favorite" size={20} className="text-[var(--favorite)] fill-current" />
        };
      case 'unfavorite':
        return {
          bg: 'bg-[var(--surface)]',
          border: 'border-[var(--border)]',
          text: 'text-[var(--text-secondary)]',
          icon: <RealmsIcon name="favorite" size={20} className="text-[var(--text-muted)]" />
        };
      case 'error':
        return {
          bg: 'bg-[var(--surface)]',
          border: 'border-[var(--danger-border)]',
          text: 'text-[var(--text-primary)]',
          icon: <AlertCircle className="w-4 h-4 text-[var(--danger)]" />
        };
      default:
        return {
          bg: 'bg-[var(--surface)]',
          border: 'border-[var(--primary-border)]',
          text: 'text-[var(--text-primary)]',
          icon: <Check className="w-4 h-4 text-[var(--primary)]" />
        };
    }
  };

  const style = getStyle();

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-lg border text-xs font-semibold animate-fadeIn ${style.bg} ${style.border} ${style.text}`}
      style={{ boxShadow: '0 4px 20px -2px rgba(30, 36, 48, 0.08)' }}
    >
      <div className="flex items-center gap-2.5">
        <div className="shrink-0" aria-hidden="true">{style.icon}</div>
        <span>{toast.text}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Bildirimi kapat"
        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
