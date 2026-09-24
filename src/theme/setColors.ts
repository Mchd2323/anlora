import React from 'react';
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
 * Set rengi YALNIZCA o setin kendi kartını etkiliyor; uygulamanın genel
 * temasını değiştirmiyor. Aynı şekilde, seçili tema da setin rengini
 * değiştirmiyor — yalnızca açık mı koyu mu olduğunu belirliyor.
 *
 * HER RENK ÜÇ BELİRTEÇ TAŞIYOR. Kart bunların üçünü birden yazıyor:
 *
 *   --set-<kimlik>         dolgu    — simge rozetinin zemini
 *   --set-<kimlik>-uzeri   simge    — rozetin ÜSTÜNDEKİ simgenin rengi
 *   --set-<kimlik>-zemin   tonlama  — kartın gövdesine binen saydam ton
 *
 * `-uzeri` ölçülerek üretiliyor. Bileşenlerde `text-white` sabitti ve koyu
 * temada rozetler açık renge döndüğü için simge sekiz renkte de kayboluyordu
 * (ölçülen kontrast 1,37 – 2,15).
 *
 * `-zemin` olmadan renk yalnızca 32 piksellik rozete giriyordu; kartın
 * gövdesi her sette aynı kalıyordu ve kullanıcı açısından setler
 * renklenmiyordu.
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

/** Rozetin üstündeki simgenin rengi — ölçülerek üretilmiş belirteç. */
export function setUzeri(color?: string): string {
  return `var(--set-${setPaletteId(color)}-uzeri)`;
}

/** Kartın gövdesine binen saydam ton. */
export function setZemin(color?: string): string {
  return `var(--set-${setPaletteId(color)}-zemin)`;
}

/**
 * Bir set kartının taşıması gereken üç belirteç, tek yerde.
 *
 * Üçünü ayrı ayrı yazmak, birini yazmayı unutmayı kolaylaştırıyordu: kart
 * yalnızca `--hanedan`ı yazdığı sürece simge beyaz kalıyor ve gövde
 * tonlanmıyor. Çağıran taraf artık tek çağrı yapıyor.
 */
export function setDegiskenleri(color?: string): React.CSSProperties {
  const id = setPaletteId(color);
  return {
    '--hanedan': `var(--set-${id})`,
    '--hanedan-uzeri': `var(--set-${id}-uzeri)`,
    '--hanedan-zemin': `var(--set-${id}-zemin)`
  } as React.CSSProperties;
}

/** Set penceresindeki renk kutucukları. */
export const SET_RENKLERI = SET_RENK_LISTESI.map(r => ({
  id: r.id,
  label: r.ad,
  hex: r.hex,
  uzeri: r.uzeri
}));
