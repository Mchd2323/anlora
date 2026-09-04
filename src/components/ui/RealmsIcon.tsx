import type { SVGProps } from 'react';

/**
 * Anlora Realms sistem ikonu.
 *
 * Paketten geldi; projeye iki noktada uyarlandi:
 *
 *   1. SPRITE ADRESI DERLEMEDEN GELIYOR. Paket adresi elle yaziyordu
 *      ("/assets/themes/realms/realms-icons.svg"). Burada `import.meta.env.BASE_URL`
 *      onune ekleniyor: uygulama alt dizinden yayinlanirsa ya da Capacitor'un
 *      kendi kok adresinden acilirsa ikonlar yine bulunuyor.
 *
 *   2. ERISILEBILIR AD `title` YERINE `aria-label`. Paketin `<title>` cozumu
 *      dogru ama projede butun dugmeler zaten kendi `aria-label`ini tasiyor;
 *      ikon o durumda `aria-hidden` kalmali ki ekran okuyucu ayni seyi iki kez
 *      okumasin. `etiket` verilirse ikon kendi adini alir.
 *
 * RENK `currentColor`. Sprite'in icindeki her yol `stroke="currentColor"`
 * kullaniyor, yani ikon rengini kapsayicidan aliyor — projedeki tema
 * belirteclerinden. Ayrica bir renk sinifi gerekmiyor.
 *
 * CIZGI KALINLIGI SPRITE'IN KENDISINDE (1,7). CSS ile kalinlastirilmiyor,
 * filtre ya da golge eklenmiyor.
 */

export type RealmsIconName =
  | 'audio'
  | 'add'
  | 'card'
  | 'filter'
  | 'search'
  | 'exam'
  | 'progress'
  | 'repeat'
  | 'download'
  | 'share'
  | 'home'
  | 'sets'
  | 'book'
  | 'profile'
  | 'favorite'
  | 'bookmark'
  | 'report'
  | 'play'
  | 'settings'
  | 'more'
  | 'chevron-down'
  | 'back'
  | 'motif-frost'
  | 'motif-scale'
  | 'motif-feather'
  | 'motif-map'
  | 'motif-iron'
  | 'motif-ember';

type Props = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: RealmsIconName;
  /** Kenar uzunlugu (piksel). Kucuk arac 18, normal eylem 20, alt menu 22. */
  size?: number;
  /** Ikon tek basina anlam tasiyorsa erisilebilir ad. */
  etiket?: string;
};

const SPRITE = `${import.meta.env.BASE_URL}assets/themes/realms/realms-icons.svg`;

export function RealmsIcon({ name, size = 20, etiket, ...props }: Props) {
  const id = name.startsWith('motif-') ? name : `realm-${name}`;
  return (
    <svg
      aria-hidden={etiket ? undefined : true}
      role={etiket ? 'img' : undefined}
      aria-label={etiket}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      focusable="false"
      {...props}
    >
      <use href={`${SPRITE}#${id}`} />
    </svg>
  );
}
