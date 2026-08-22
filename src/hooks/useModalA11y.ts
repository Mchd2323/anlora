import { useEffect, useRef } from 'react';

/**
 * Modal pencereler için erişilebilirlik davranışı.
 *
 * Uygulamadaki altı modalin hiçbirinde `role="dialog"`, `aria-modal`, odak
 * tuzağı, Escape ile kapanma ya da kapanınca odağın geri dönmesi yoktu.
 * Klavyeyle gezinen bir kullanıcı Tab'a bastığında odak modalin arkasındaki
 * sayfaya kayıyor, ekran okuyucu da bir iletişim kutusu açıldığını hiç
 * duyurmuyordu.
 *
 * Kanca üç şeyi yapar:
 *   1. Escape ile kapatır.
 *   2. Odağı modalin içinde tutar (Tab ve Shift+Tab döngüsü).
 *   3. Modal kapanınca odağı açılmadan önceki öğeye geri verir.
 *
 * Ayrıca modal açıkken arka planın kaydırılmasını engeller; mobilde modalin
 * altındaki sayfanın kayması yaygın ve rahatsız edici bir sorundur.
 */
export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;

    const getFocusable = (): HTMLElement[] => {
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => el.offsetParent !== null || el === document.activeElement);
    };

    // Açılışta odağı modalin içine al.
    const focusables = getFocusable();
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (active === first || !container?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      // Odağı modali açan öğeye geri ver.
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, onClose]);

  return containerRef;
}
