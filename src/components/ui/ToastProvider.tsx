import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ToastContainer, ToastMessage } from './Toast';
import { onStorageError } from '../../utils/safeStorage';

type ToastType = ToastMessage['type'];

interface ToastContextValue {
  showToast: (text: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Uygulama genelinde bildirim sağlayıcısı.
 *
 * `ToastContainer` bileşeni projede yazılmış ama hiçbir yere bağlanmamıştı;
 * bunun yerine on sekiz ayrı yerde tarayıcının `alert()` penceresi
 * kullanılıyordu. `alert` sayfayı bloke eder, mobilde uygulamadan kopuk
 * görünür ve biçimlendirilemez. Sağlayıcı bunu tek bir yerden çözer.
 *
 * Ayrıca depolama yazma hatalarına (kota dolması, gizli sekmede kapalı
 * depolama) abone olur: kullanıcı ilerlemesinin kaydedilemediğini sessizce
 * kaybetmek yerine anında görür.
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: ToastType = 'info') => {
    setToasts(prev => [
      ...prev,
      { id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, text }
    ]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    return onStorageError(() => {
      showToast(
        'Tarayıcı depolama alanı dolu veya kapalı; son değişiklik kaydedilemedi.',
        'error'
      );
    });
  }, [showToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

/**
 * Bildirim göstermek için kanca. Sağlayıcı dışında çağrılırsa sessizce
 * yok sayan bir sürüm döner; böylece bir bileşen test içinde tek başına
 * render edilirken çökmez.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { showToast: () => undefined };
  }
  return ctx;
}
