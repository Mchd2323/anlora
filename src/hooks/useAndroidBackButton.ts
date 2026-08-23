import { useEffect } from 'react';

/**
 * Android donanım geri tuşu.
 *
 * WebView'a paketlenmiş bir tek sayfa uygulamasında geri tuşunun varsayılan
 * davranışı uygulamadan çıkmaktır: kullanıcı bir modali kapatmak isterken
 * kendini ana ekranda bulur. Anlora'nın kendi gezinme durumu React state'inde
 * tutulduğu için tarayıcı geçmişi de bu işi yapamaz.
 *
 * Bu yüzden geri tuşu, kullanıcının beklediği sırayla ele alınır:
 *   1. Açık bir modal varsa kapat (Escape tuşuyla aynı yol).
 *   2. Ana sekmede değilsek ana sekmeye dön.
 *   3. Ana sekmedeysek uygulamayı arka plana al.
 *
 * Web tarayıcısında kanca hiçbir şey yapmaz: Capacitor eklentisi yalnızca
 * yerel kabukta yüklenir ve içe aktarma dinamiktir, böylece eklenti web
 * paketine girmez.
 */
export function useAndroidBackButton(
  isAtRoot: boolean,
  onGoToRoot: () => void
): void {
  useEffect(() => {
    let removeListener: (() => void) | null = null;
    let cancelled = false;

    async function attach() {
      let CapacitorApp: typeof import('@capacitor/app').App;
      try {
        ({ App: CapacitorApp } = await import('@capacitor/app'));
      } catch {
        // Web derlemesinde eklenti yok; geri tuşu zaten tarayıcının işi.
        return;
      }

      const handle = await CapacitorApp.addListener('backButton', () => {
        // 1. Açık modal: Escape'i taklit et. Modallerin kapanma mantığı
        //    `useModalA11y` içinde tek yerde durur; burada kopyalamıyoruz.
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
          );
          return;
        }

        // 2. Alt sayfadaysak ana sekmeye dön.
        if (!isAtRoot) {
          onGoToRoot();
          return;
        }

        // 3. Ana sekmede: uygulamayı kapatmak yerine arka plana al; kullanıcı
        //    geri döndüğünde çalışması kaldığı yerden sürsün.
        CapacitorApp.minimizeApp();
      });

      if (cancelled) {
        handle.remove();
        return;
      }
      removeListener = () => handle.remove();
    }

    attach();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [isAtRoot, onGoToRoot]);
}
