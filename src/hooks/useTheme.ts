import { useEffect } from 'react';
import { UserSettings } from '../types';
import { ON_AYAR_KIMLIKLERI, onAyarModu, RealmsOnAyarId } from '../theme/realmsPresets';

/**
 * Tema ve yazı büyüklüğü tercihini belgeye uygular.
 *
 * DOKUZ SEÇENEK, TEK LİSTE. Görünüm tek bir tercihten ibaret:
 *
 *   'system'  — bugünkü onaylı Anlora Realms görünümü. Kökte HİÇBİR öznitelik
 *               durmaz; açık mı koyu mu olduğuna telefonun kendi ayarı karar
 *               verir. Taban seçenek budur ve hiç değişmedi.
 *   sekiz ek  — dört açık, dört koyu; her biri bağımsız bir görünüm.
 *
 * Ek bir tema seçildiğinde köke İKİ öznitelik yazılıyor:
 *
 *   data-theme="light" | "dark"
 *       Ölçülmüş TABAN anlamsal paleti getirir: CEFR rozetleri, "öğrendim",
 *       "tekrar et", tehlike, set renkleri… Bunlar ek temada yeniden icat
 *       edilmiyor, çünkü hepsi zaten ölçülmüş durumda.
 *   data-realm-preset="<kimlik>"
 *       Ek temanın kendi zemin, panel, iç kart, metin ve vurgu değerleri.
 *
 * "Sistem"de ikisi de yazılmaz; bu yüzden `prefers-color-scheme` yine tek
 * karar verici olur ve telefon ayarı sonradan değişince uygulama da değişir.
 * İşaret koymak "sistemi izle" seçeneğini bozardı: sayfa donmuş kalırdı.
 *
 * YAZI BÜYÜKLÜĞÜ. Kök `font-size` ölçeklenir. Arayüzün tamamı `rem` tabanlı
 * olduğu için tek değer her yeri birlikte büyütür; tek tek bileşenlerle
 * oynamak düzeni yerinden oynatırdı.
 */

/**
 * Görünüm tercihi.
 *
 * 'system' | 'light' | 'dark' ÜÇÜ DE ONAYLI TABAN GÖRÜNÜMDÜR — aralarındaki
 * tek fark telefonun ayarını izleyip izlemedikleri. Kökte 'system' hiçbir
 * şey yazmaz, 'light'/'dark' yalnızca `data-theme` yazar; ikisi de
 * `data-realm-preset` yazmaz, yani ek tema katmanı hiç devreye girmez.
 *
 * NEDEN ÜÇÜ DE DURUYOR. Bir ara yalnızca 'system' bırakılmıştı; o hâlde
 * telefonu koyu olan bir kullanıcı onaylı AÇIK görünümü hiçbir şekilde
 * seçemiyordu, üstelik daha önce açıkça "Koyu" demiş kullanıcı da onaylı
 * Gece yerine ek temalardan birine düşüyordu. İkisi de tercih kaybı.
 */
export type TemaTercihi = 'system' | 'light' | 'dark' | RealmsOnAyarId;

/**
 * Eski tema kayıtlarının karşılığı.
 *
 * Uygulamada sırayla üç model yaşadı ve her birinin değerleri kullanıcıların
 * ayarlarında KAYITLI:
 *
 *   1. Tek listeli sekiz ön ayar   -> `theme`      ('deniz', 'komur', …)
 *   2. Mod + sekiz tema ailesi     -> `themeMode`  ('light' | 'dark' | 'system')
 *                                     `themeFamily` ('kizil-kale', …)
 *   3. Bugünkü dokuz seçenek       -> `themePreset`
 *
 * Hiçbir alan silinmiyor; yalnızca ilk okumada karşılığı hesaplanıyor. Eşleme
 * kullanıcının ASIL NİYETİNİ korumaya çalışıyor: açık bir görünüm seçmiş olan
 * açık kalsın, koyu seçmiş olan koyu kalsın. "Sistem" diyen sistemde kalır.
 *
 * Eşleme ek temalara DEĞİL, onaylı tabanın kendisine gidiyor: "Açık" demiş
 * kullanıcı onaylı parşömeni, "Koyu" demiş kullanıcı onaylı Gece'yi alıyor.
 * Ek temalardan birine yönlendirmek görünümü sessizce değiştirmek olurdu.
 */
const ESKI_TEMA_KARSILIGI: Record<string, TemaTercihi> = {
  system: 'system',
  light: 'light',
  deniz: 'light',
  kum: 'light',
  gul: 'light',
  sis: 'light',
  lavanta: 'light',
  dark: 'dark',
  orman: 'dark',
  komur: 'dark'
};

/** Ayarlardan geçerli tema tercihini çözer; eski alanlar da hesaba katılır. */
export function cozTemayi(settings: UserSettings): TemaTercihi {
  const secili = settings.themePreset;
  if (secili === 'system' || secili === 'light' || secili === 'dark') return secili;
  if (secili && ON_AYAR_KIMLIKLERI.includes(secili as RealmsOnAyarId)) {
    return secili as RealmsOnAyarId;
  }
  // İkinci model: mod açıkça seçilmişse niyet ondan okunur.
  if (settings.themeMode === 'light') return 'light';
  if (settings.themeMode === 'dark') return 'dark';
  if (settings.themeMode === 'system') return 'system';
  // İlk model: tek listeli eski ön ayar.
  const eski = settings.theme;
  if (eski && ESKI_TEMA_KARSILIGI[eski]) return ESKI_TEMA_KARSILIGI[eski];
  return 'system';
}

export function useTheme(settings: UserSettings): void {
  const tema = cozTemayi(settings);
  const scale = settings.fontScale || 1;

  useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute('data-realm-preset');

    if (tema === 'system') {
      root.removeAttribute('data-theme');
    } else if (tema === 'light' || tema === 'dark') {
      // Onaylı taban görünüm, sabitlenmiş hâli: ek tema katmanı devreye girmez.
      root.setAttribute('data-theme', tema);
    } else {
      const mod = onAyarModu(tema);
      if (!mod) {
        // Tanınmayan bir kimlik kökte yarım bir tema bırakmasın.
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', mod);
        root.setAttribute('data-realm-preset', tema);
      }
    }

    /*
     * SİSTEM ÇUBUĞU DA TEMAYA UYSUN.
     *
     * `theme-color` index.html'de sabit parşömendi. Koyu bir tema seçen
     * kullanıcının ekranının tepesinde parlak bir şerit kalıyordu — Android
     * ve tarayıcı bu meta değerini adres/durum çubuğu için kullanıyor.
     * Değer artık temanın kendi sayfa renginden okunuyor: hesap yok, CSS'in
     * çözdüğü değerin ta kendisi.
     */
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const sayfa = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (sayfa) meta.setAttribute('content', sayfa);
    }
  }, [tema]);

  useEffect(() => {
    const root = document.documentElement;
    // Sınırlar bilinçli: 0,875 altında dokunma hedefleri 44 pikselin altına
    // düşer, 1,5 üstünde iki sütunlu düzenler taşar.
    const safe = Math.min(1.5, Math.max(0.875, scale));
    root.style.fontSize = safe === 1 ? '' : `${safe * 100}%`;
    return () => {
      root.style.fontSize = '';
    };
  }, [scale]);
}
