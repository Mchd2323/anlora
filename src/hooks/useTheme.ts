import { useEffect } from 'react';
import { UserSettings } from '../types';

/**
 * Tema ve yazı büyüklüğü tercihini belgeye uygular.
 *
 * TEMA. Üç durum vardır, iki değil:
 *   - 'light' / 'dark': kökte `data-theme` durur, sistem ayarını geçersiz kılar.
 *   - 'system': hiçbir işaret konmaz; ayrımı yalnızca `prefers-color-scheme`
 *     yapar. İşaret koymak "sistemi izle" seçeneğini bozar, çünkü sistem
 *     sonradan değişse bile sayfa donmuş kalırdı.
 *
 * YAZI BÜYÜKLÜĞÜ. Kök `font-size` ölçeklenir. Arayüzün tamamı `rem` tabanlı
 * olduğu için tek değer her yeri birlikte büyütür; tek tek bileşenlerle
 * oynamak düzeni yerinden oynatırdı.
 */
/**
 * Kaldırılan temaların karşılığı.
 *
 * 'light' temel temanın birebir aynısıydı, 'lavanta' ise yerini 'sis'e
 * bıraktı. Bu değerler bazı kullanıcıların ayarlarında KAYITLI: eşleme
 * olmadan kökte tanımsız bir `data-theme` kalır ve hiçbir tema değişkeni
 * uygulanmaz — ekran bozuk görünür. Kullanıcının kaydı silinmiyor, yalnızca
 * en yakın karşılığa yönlendiriliyor.
 */
const ESKI_TEMA_KARSILIGI: Record<string, string> = {
  light: 'system',
  lavanta: 'sis'
};

export function useTheme(settings: UserSettings): void {
  const kayitli = settings.theme || 'system';
  const theme = ESKI_TEMA_KARSILIGI[kayitli] || kayitli;
  const scale = settings.fontScale || 1;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

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
