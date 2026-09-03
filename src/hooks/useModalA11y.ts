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
 *
 * KİLİT SAYAÇLA TUTULUR. Önceki sürüm her modal için `body.style.overflow`
 * değerini açılışta okuyup kapanışta geri yazıyordu. İki modal üst üste
 * açıldığında (örneğin sete ekleme modalinin üstünde uyarı penceresi) ikincisi
 * "önceki değer" olarak 'hidden' kaydediyor, kapanış sırası tersine döndüğünde
 * de gövdeye kalıcı olarak 'hidden' yazıyordu. Sonuç: modallerin hepsi
 * kapandıktan sonra uygulama artık hiç aşağı yukarı kaydırılamıyordu.
 * Sayaç, kilidi yalnızca SON modal kapandığında çözer.
 */

/** Kaydırma kilidini tutan açık modal sayısı. */
let scrollLockCount = 0;
/** Kilit ilk kez alındığında gövdenin gerçek `overflow` değeri. */
let overflowBeforeLock = '';

/*
 * AÇIK MODALLERİN YIĞINI.
 *
 * Escape ve Tab yalnızca EN ÜSTTEKİ modal tarafından işlenmeli. Her modal
 * kendi yakalama dinleyicisini belgeye kurduğu için, üst üste iki modal
 * açıkken tek bir Escape ikisini birden kapatıyordu: üstteki "silmek
 * istediğine emin misin?" penceresi kapanırken altındaki, kullanıcının
 * doldurduğu form da kapanıyor ve girilen veri siliniyordu.
 *
 * `stopImmediatePropagation` bunu ÇÖZMEZ: aynı düğümdeki dinleyiciler kayıt
 * sırasıyla çalışır, yani önce ALTTAKİ modal işler — sonuç tersine döner.
 * Doğru ölçüt "yığının en üstünde miyim" sorusudur.
 */
const modalStack: symbol[] = [];

function lockBodyScroll(): void {
  if (scrollLockCount === 0) {
    overflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount++;
}

function unlockBodyScroll(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = overflowBeforeLock;
  }
}

/**
 * Kalan bütün kaydırma kilitlerini çözer.
 *
 * EMNİYET AĞI. Kilidi bir efektin temizleme adımı çözer; render sırasında
 * fırlatılan bir hata o adımı hiç çalıştırmaz ve uygulama kalıcı olarak
 * kaydırılamaz hâle gelir — kullanıcının gördüğü tam olarak buydu.
 * Sayfa değiştirmek gibi "artık açık modal olamaz" anlarında bu işlev
 * çağrılırsa, benzer bir hata bir daha olsa bile kilit en fazla bir
 * ekran boyu sürer.
 *
 * Ölçüt DOM'dan okunur: gerçekten açık bir iletişim kutusu varsa kilide
 * dokunulmaz.
 */
export function releaseStuckScrollLocks(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector('[role="dialog"]')) return;
  scrollLockCount = 0;
  if (document.body.style.overflow === 'hidden') {
    document.body.style.overflow = '';
  }
}
export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // `onClose` çoğu çağrı yerinde satır içi bir ok fonksiyonudur, yani her
  // render'da kimliği değişir. Doğrudan bağımlılık listesine konursa efekt
  // her render'da sökülüp yeniden kurulur; temizleme adımı da odağı sürekli
  // modalin dışına geri fırlatır. Bu yüzden geri çağrı bir ref'te tutulur ve
  // efekt yalnızca açık/kapalı durumuna bağlanır.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const token = Symbol('anlora-modal');
    modalStack.push(token);

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
      // Yalnızca en üstteki modal klavyeyi işler.
      if (modalStack[modalStack.length - 1] !== token) return;

      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
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

    lockBodyScroll();

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      // Yığından kendi damgasını çıkar; kapanma sırası her zaman LIFO olmayabilir.
      const sira = modalStack.lastIndexOf(token);
      if (sira !== -1) modalStack.splice(sira, 1);
      unlockBodyScroll();
      // Odağı modali açan öğeye geri ver.
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  return containerRef;
}
