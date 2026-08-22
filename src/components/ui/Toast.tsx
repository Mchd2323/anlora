import React, { useEffect } from 'react';
import { Check, Heart, RefreshCw, AlertCircle, X } from 'lucide-react';

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
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-2">
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
          bg: 'bg-[#FFFFFF]',
          border: 'border-[#BFD7C8]',
          text: 'text-[#1E2430]',
          icon: <Check className="w-4 h-4 text-[#4F806A] stroke-[2.5]" />
        };
      case 'learning':
        return {
          bg: 'bg-[#FFFFFF]',
          border: 'border-[#E7C98F]',
          text: 'text-[#1E2430]',
          icon: <RefreshCw className="w-4 h-4 text-[#B97922]" />
        };
      case 'favorite':
        return {
          bg: 'bg-[#FFFFFF]',
          border: 'border-[#F2CCD3]',
          text: 'text-[#1E2430]',
          icon: <Heart className="w-4 h-4 text-[#B75D6A] fill-current" />
        };
      case 'unfavorite':
        return {
          bg: 'bg-[#FFFFFF]',
          border: 'border-[#E4E1D9]',
          text: 'text-[#687080]',
          icon: <Heart className="w-4 h-4 text-[#8E95A2]" />
        };
      case 'error':
        return {
          bg: 'bg-[#FFFFFF]',
          border: 'border-[#F0CBC7]',
          text: 'text-[#1E2430]',
          icon: <AlertCircle className="w-4 h-4 text-[#C65D55]" />
        };
      default:
        return {
          bg: 'bg-[#FFFFFF]',
          border: 'border-[#D7D2F4]',
          text: 'text-[#1E2430]',
          icon: <Check className="w-4 h-4 text-[#4F46A5]" />
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
        <div className="shrink-0">{style.icon}</div>
        <span>{toast.text}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 text-[#8E95A2] hover:text-[#1E2430] rounded-lg transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
