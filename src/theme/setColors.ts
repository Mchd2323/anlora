import { SET_RENK_KIMLIKLERI, SET_RENK_LISTESI, SetRengiId } from './setPalette';

/**
 * Kelime setinin rengi.
 *
 * KİMLİK SAKLANIR, HEX DEĞİL. Sette `color: 'buz-kalesi'` gibi bir paletteId
 * duruyor; rengin kendisi CSS'teki `--set-<kimlik>` belirtecinde ve açık/koyu
 * karşılığı orada tanımlı. Böylece kullanıcı temasını değiştirdiğinde setin
 * rengi kendiliğinden doğru tarafa geçiyor ve uygulamada renk hesabı yapan
 * tek bir satır kalmıyor.
 *
 * Set rengi YALNIZCA o setin kenarını, simgesini ve ilerleme vurgusunu
 * etkiliyor; uygulamanın genel temasını değiştirmiyor. Aynı şekilde, seçili
 * tema da setin rengini değiştirmiyor — yalnızca açık mı koyu mu olduğunu
 * belirliyor.
 */

/** Varsayılan set rengi. */
export const VARSAYILAN_SET_RENGI: SetRengiId = 'kuzgun-haritasi';

/**
 * Eski altı set renginin yeni paletteId karşılığı.
 *
 * VERİ KAYBI YOK. Bu kimlikler kullanıcıların setlerinde KAYITLI; eşleme
 * olmadan hepsi varsayılana düşer ve kimse setini tanıyamaz. Eşleme renk
 * ailesine göre yapıldı: eski kayıtlı hex ile yeni kimliğin rengi aynı
 * aileden geliyor.
 *
 *   indigo  #1B3A57 kuzey laciverdi -> Kuzgun Haritası
 *   teal    #3A6982 buz             -> Buz Kalesi
 *   emerald #355B4A koru            -> Orman Nöbeti (birebir aynı hex)
 *   amber   #8A6B2B altın           -> Taçlı Parşömen
 *   rose    #9E3F38 ejderha         -> Kızıl Kale
 *   slate   #5A6272 demir           -> Demir Gece
 */
const ESKI_SET_RENGI: Record<string, SetRengiId> = {
  indigo: 'kuzgun-haritasi',
  teal: 'buz-kalesi',
  emerald: 'orman-nobeti',
  amber: 'tacli-parsomen',
  rose: 'kizil-kale',
  slate: 'demir-gece'
};

/** Sette kayıtlı renk kimliğini geçerli bir paletteId'ye çevirir. */
export function setPaletteId(color?: string): SetRengiId {
  if (!color) return VARSAYILAN_SET_RENGI;
  if (SET_RENK_KIMLIKLERI.includes(color as SetRengiId)) return color as SetRengiId;
  return ESKI_SET_RENGI[color] || VARSAYILAN_SET_RENGI;
}

/**
 * Setin arma rengi — hex değil, CSS belirteci. Açık/koyu karşılığı belirtecin
 * kendisinde tanımlı olduğu için tema değişince renk kendiliğinden geçiyor.
 */
export function setRengi(color?: string): string {
  return `var(--set-${setPaletteId(color)})`;
}

/** Set penceresindeki sekiz kutucuk. */
export const SET_RENKLERI = SET_RENK_LISTESI.map(r => ({ id: r.id, label: r.ad, hex: r.hex }));
