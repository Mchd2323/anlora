import { App } from '@capacitor/app';
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
      /*
       * Eklenti STATİK içe aktarılıyor.
       *
       * `await import(...)` gerçek cihazda hiç çözülmeyebiliyor: Vite'ın
       * dinamik import sarmalayıcısı modül zaten pakette olsa bile belgeye
       * bir `<link rel="modulepreload">` ekleyip yüklenmesini bekliyor ve
       * Capacitor kabuğunda bu istek yanıtsız kalabiliyor. Ses tarafında bu
       * tam olarak yaşandı — düğme sonsuza kadar sessiz kaldı. Burada aynı
       * hatanın karşılığı sessizce çalışmayan bir geri tuşu olurdu.
       */
      const CapacitorApp = App;
      if (!CapacitorApp) return;

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
