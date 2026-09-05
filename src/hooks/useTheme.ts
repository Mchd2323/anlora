import { useEffect } from 'react';
import { UserSettings } from '../types';
import { AILE_KIMLIKLERI, VARSAYILAN_AILE, RealmsAileId } from '../theme/realmsFamilies';

/**
 * Tema ve yazı büyüklüğü tercihini belgeye uygular.
 *
 * İKİ AYRI SEÇİM. Tema artık tek bir listeden seçilmiyor:
 *
 *   - MOD (`themeMode`): Sistem / Açık / Koyu. 'system' hiçbir işaret
 *     koymaz; ayrımı yalnızca `prefers-color-scheme` yapar. İşaret koymak
 *     "sistemi izle" seçeneğini bozardı, çünkü telefon ayarı sonradan
 *     değişse bile sayfa donmuş kalırdı.
 *   - AİLE (`themeFamily`): sekiz Realms ailesinden biri, kökte
 *     `data-family` olarak durur. Aile yalnızca vurgu belirteçlerini
 *     değiştirir; sayfa, panel, iç kart ve metin renkleri sabittir. Bu
 *     yüzden aile ile mod birbirinden bağımsız: "Sistem + Kızıl Kale"
 *     seçilmişse, telefon koyuya geçince kızılın koyu karşılığı uygulanır.
 *
 * YAZI BÜYÜKLÜĞÜ. Kök `font-size` ölçeklenir. Arayüzün tamamı `rem` tabanlı
 * olduğu için tek değer her yeri birlikte büyütür; tek tek bileşenlerle
 * oynamak düzeni yerinden oynatırdı.
 */

/**
 * Kaldırılan tek listeli temaların yeni iki alana karşılığı.
 *
 * Bu değerler kullanıcıların ayarlarında KAYITLI. Eşleme olmadan kökte
 * tanımsız bir `data-theme` kalır ve hiçbir tema değişkeni uygulanmaz —
 * ekran bozuk görünür. Kayıt silinmiyor: `settings.theme` olduğu yerde
 * duruyor, yalnızca ilk okumada moda çevriliyor.
 *
 * Renk kimlikleri artık aile olarak değil MOD olarak karşılanıyor, çünkü
 * eski sekiz ön ayarın hiçbiri yeni sekiz ailenin renk tanımına birebir
 * denk düşmüyor; kullanıcının gerçekten seçtiği şey açık mı koyu mu
 * olduğuydu. Aile varsayılanda kalıyor ve varsayılan aile bugünkü onaylı
 * temanın kendisi, yani kimsenin ekranı geçişte değişmiyor.
 */
const ESKI_TEMA_MODU: Record<string, 'system' | 'light' | 'dark'> = {
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

/** Ayarlardan geçerli modu çözer; eski `theme` alanı da hesaba katılır. */
export function cozModu(settings: UserSettings): 'system' | 'light' | 'dark' {
  if (settings.themeMode) return settings.themeMode;
  const eski = settings.theme;
  if (eski && ESKI_TEMA_MODU[eski]) return ESKI_TEMA_MODU[eski];
  return 'system';
}

/** Ayarlardan geçerli aileyi çözer; tanınmayan değer varsayılana düşer. */
export function cozAileyi(settings: UserSettings): RealmsAileId {
  const secili = settings.themeFamily as RealmsAileId | undefined;
  return secili && AILE_KIMLIKLERI.includes(secili) ? secili : VARSAYILAN_AILE;
}

export function useTheme(settings: UserSettings): void {
  const mod = cozModu(settings);
  const aile = cozAileyi(settings);
  const scale = settings.fontScale || 1;

  useEffect(() => {
    const root = document.documentElement;
    if (mod === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mod);
    root.setAttribute('data-family', aile);
  }, [mod, aile]);

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
