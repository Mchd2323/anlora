import { useEffect } from 'react';
import { UserSettings } from '../types';
import { ON_AYAR_KIMLIKLERI, onAyarModu, RealmsOnAyarId } from '../theme/realmsPresets';

/**
 * Tema ve yazı büyüklüğü tercihini belgeye uygular.
 *
 * BEŞ SEÇENEK, TEK LİSTE. Görünüm tek bir tercihten ibaret:
 *
 *   'system'  — bugünkü onaylı Anlora Realms görünümü. Kökte HİÇBİR öznitelik
 *               durmaz; açık mı koyu mu olduğuna telefonun kendi ayarı karar
 *               verir. Taban seçenek budur ve hiç değişmedi.
 *   dört ek   — iki açık, iki koyu; her biri bağımsız bir görünüm. Liste
 *               `theme-presets.json`'dan üretiliyor, buradan değil.
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
 * 'system' onaylı Anlora Realms görünümüdür: kökte hiçbir öznitelik durmaz,
 * açık mı koyu mu olduğuna telefonun ayarı karar verir. Yanında bir zamanlar
 * 'light' ve 'dark' de vardı; ikisi de aynı görünümü telefondan bağımsız
 * sabitliyordu ve listeden kaldırıldılar — aynı görünümün üç kopyasıydılar.
 * Geri kalanlar ek temalar: her biri kendi zemin/panel/metin/vurgu değerine
 * sahip bağımsız bir görünüm.
 */
export type TemaTercihi = 'system' | RealmsOnAyarId;

/**
 * KALDIRILAN EK TEMALARIN KARŞILIĞI.
 *
 * Dört ek tema listeden çıkarıldı. Onları seçmiş bir kullanıcının ayarı
 * telefonunda KAYITLI duruyor ve tanınmayan bir kimlik sessizce 'system'e
 * düşerdi: koyu bir tema seçmiş kullanıcı, telefonu açık olduğu için bir
 * sabah uygulamayı açık bulurdu.
 *
 * Bu yüzden her biri AYNI MODDA kalan, karakteri en yakın temaya bağlanıyor:
 * sıcak olan sıcağa, soğuk olan soğuğa. Kullanıcı tam olarak seçtiği şeyi
 * bulamıyor — o tema artık yok — ama açık/koyu tercihini ve rengin havasını
 * koruyor.
 */
const KALDIRILAN_TEMA_KARSILIGI: Record<string, RealmsOnAyarId> = {
  // Kadim Harita (sıcak altın/parşömen) -> Kızıl Şafak (sıcak)
  'light-ancient-map': 'light-crimson-dawn',
  // Orman Yemini (soğuk yeşil) -> Buz Kristali (soğuk)
  'light-grove-oath': 'light-frost-crystal',
  // Ejderha Köz (sıcak köz) -> Kızıl Gece (sıcak)
  'dark-dragon-ember': 'dark-crimson-night',
  // Demir Orman (soğuk demir/yeşil) -> Buz Nöbeti (soğuk)
  'dark-iron-grove': 'dark-frost-watch'
};

/**
 * Ayarlardan geçerli tema tercihini çözer; eski alanlar da hesaba katılır.
 *
 * Uygulamada sırayla dört model yaşadı ve her birinin değerleri
 * kullanıcıların ayarlarında KAYITLI:
 *
 *   1. Tek listeli sekiz ön ayar   -> `theme`      ('deniz', 'komur', …)
 *   2. Mod + sekiz tema ailesi     -> `themeMode`  ('light' | 'dark' | 'system')
 *                                     `themeFamily` ('kizil-kale', …)
 *   3. Dokuz seçenek               -> `themePreset` ('light' | 'dark' | …)
 *   4. Bugünkü beş seçenek         -> `themePreset`
 *
 * Hiçbir alan silinmiyor; yalnızca ilk okumada karşılığı hesaplanıyor.
 *
 * ÜÇÜNCÜ MODELİN 'light'/'dark' TABAN SEÇENEKLERİ ARTIK 'system'. Onlar zaten
 * bugünkü onaylı görünümün ta kendisiydi; tek farkları telefonun ayarını
 * izlememeleriydi. Ek temalardan birine yönlendirmek görünümü sessizce
 * değiştirmek olurdu — o yüzden eşleme tabanın kendisine gidiyor. Eski
 * `theme` ve `themeMode` alanları da aynı sebeple aynı yere düşüyor.
 */
export function cozTemayi(settings: UserSettings): TemaTercihi {
  const secili = settings.themePreset;
  if (secili && ON_AYAR_KIMLIKLERI.includes(secili as RealmsOnAyarId)) {
    return secili as RealmsOnAyarId;
  }
  if (secili && KALDIRILAN_TEMA_KARSILIGI[secili]) {
    return KALDIRILAN_TEMA_KARSILIGI[secili];
  }
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
