import { AILE_KIMLIKLERI, VARSAYILAN_AILE, RealmsAileId, REALMS_AILELERI } from './realmsFamilies';

/**
 * Kelime setinin rengi.
 *
 * KİMLİK SAKLANIR, HEX DEĞİL. Sette `color: 'buz-kalesi'` gibi bir
 * paletteId duruyor; rengin kendisi CSS'teki `--set-<kimlik>` belirtecinde
 * ve açık/koyu karşılığı orada tanımlı. Böylece kullanıcı temayı
 * değiştirdiğinde setin rengi kendiliğinden doğru tarafa geçiyor ve
 * uygulamada renk hesabı yapan tek bir satır kalmıyor.
 *
 * Set rengi YALNIZCA o setin kenarını, simgesini ve ilerleme vurgusunu
 * etkiliyor; uygulamanın genel temasını değiştirmiyor.
 */

/**
 * Eski altı set renginin yeni paletteId karşılığı.
 *
 * VERİ KAYBI YOK. Bu kimlikler kullanıcıların setlerinde KAYITLI; eşleme
 * olmadan hepsi varsayılana düşer ve kimse setini tanıyamaz. Eşleme renk
 * ailesine göre yapıldı: eski kayıtlı hex ile yeni ailenin kaynak rengi
 * aynı aileden geliyor.
 *
 *   indigo  #1B3A57 kuzey laciverdi -> Kuzgun Haritası (#15283D)
 *   teal    #3A6982 buz             -> Buz Kalesi      (#7FAAC2)
 *   emerald #355B4A koru            -> Orman Nöbeti    (#355B4A, birebir)
 *   amber   #8A6B2B altın           -> Taçlı Parşömen  (#B79552)
 *   rose    #9E3F38 ejderha         -> Kızıl Kale      (#9E3F38, birebir)
 *   slate   #5A6272 demir           -> Demir Gece      (demir grisi)
 */
const ESKI_SET_RENGI: Record<string, RealmsAileId> = {
  indigo: 'kuzgun-haritasi',
  teal: 'buz-kalesi',
  emerald: 'orman-nobeti',
  amber: 'tacli-parsomen',
  rose: 'kizil-kale',
  slate: 'demir-gece'
};

/** Sette kayıtlı renk kimliğini geçerli bir paletteId'ye çevirir. */
export function setPaletteId(color?: string): RealmsAileId {
  if (!color) return VARSAYILAN_AILE;
  if (AILE_KIMLIKLERI.includes(color as RealmsAileId)) return color as RealmsAileId;
  return ESKI_SET_RENGI[color] || VARSAYILAN_AILE;
}

/**
 * Setin arma rengi — hex değil, CSS belirteci. Açık/koyu karşılığı
 * belirtecin kendisinde tanımlı olduğu için tema değişince renk
 * kendiliğinden geçiyor.
 */
export function setRengi(color?: string): string {
  return `var(--set-${setPaletteId(color)})`;
}

/** Set penceresindeki sekiz kutucuk. */
export const SET_RENKLERI = REALMS_AILELERI.map(a => ({
  id: a.id,
  label: a.ad,
  hex: `var(--set-${a.id})`
}));
