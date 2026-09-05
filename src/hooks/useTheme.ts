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

/** Kökte 'system' için hiçbir şey yazılmaz. */
export type TemaTercihi = 'system' | RealmsOnAyarId;

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
 * Açık niyet -> Kadim Harita: dört ek açık tema içinde parşömene en yakın olan
 * bu (sepya zemin, altın vurgu). Koyu niyet -> Buz Nöbeti: onaylı Gece
 * temasının lacivert-buz karakterine en yakın olan bu.
 */
const ESKI_TEMA_KARSILIGI: Record<string, TemaTercihi> = {
  system: 'system',
  light: 'light-ancient-map',
  deniz: 'light-ancient-map',
  kum: 'light-ancient-map',
  gul: 'light-ancient-map',
  sis: 'light-ancient-map',
  lavanta: 'light-ancient-map',
  dark: 'dark-frost-watch',
  orman: 'dark-frost-watch',
  komur: 'dark-frost-watch'
};

/** Ayarlardan geçerli tema tercihini çözer; eski alanlar da hesaba katılır. */
export function cozTemayi(settings: UserSettings): TemaTercihi {
  const secili = settings.themePreset;
  if (secili === 'system') return 'system';
  if (secili && ON_AYAR_KIMLIKLERI.includes(secili as RealmsOnAyarId)) {
    return secili as RealmsOnAyarId;
  }
  // İkinci model: mod açıkça seçilmişse niyet ondan okunur.
  if (settings.themeMode === 'light') return ESKI_TEMA_KARSILIGI.light;
  if (settings.themeMode === 'dark') return ESKI_TEMA_KARSILIGI.dark;
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
    if (tema === 'system') {
      root.removeAttribute('data-theme');
      root.removeAttribute('data-realm-preset');
      return;
    }
    const mod = onAyarModu(tema);
    // Tanınmayan bir kimlik kökte yarım bir tema bırakmasın.
    if (!mod) {
      root.removeAttribute('data-theme');
      root.removeAttribute('data-realm-preset');
      return;
    }
    root.setAttribute('data-theme', mod);
    root.setAttribute('data-realm-preset', tema);
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
