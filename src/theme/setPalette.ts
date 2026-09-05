/* ÜRETİLMİŞ DOSYA — elle düzenleme.
   Kaynak: scripts/make-theme-presets.mjs */

/** Yeni Kelime Seti penceresindeki vurgu rengi. */
export interface SetRengi {
  id: SetRengiId;
  ad: string;
  /** CSS belirteci — açık/koyu karşılığı belirtecin içinde tanımlı. */
  hex: string;
}

export type SetRengiId =
  | 'tacli-parsomen'
  | 'buz-kalesi'
  | 'kuzgun-haritasi'
  | 'ejderha-koz'
  | 'kizil-kale'
  | 'orman-nobeti'
  | 'demir-gece'
  | 'fildisi-altin';

export const SET_RENK_LISTESI: SetRengi[] = [
  { id: 'tacli-parsomen', ad: 'Taçlı Parşömen', hex: 'var(--set-tacli-parsomen)' },
  { id: 'buz-kalesi', ad: 'Buz Kalesi', hex: 'var(--set-buz-kalesi)' },
  { id: 'kuzgun-haritasi', ad: 'Kuzgun Haritası', hex: 'var(--set-kuzgun-haritasi)' },
  { id: 'ejderha-koz', ad: 'Ejderha Köz', hex: 'var(--set-ejderha-koz)' },
  { id: 'kizil-kale', ad: 'Kızıl Kale', hex: 'var(--set-kizil-kale)' },
  { id: 'orman-nobeti', ad: 'Orman Nöbeti', hex: 'var(--set-orman-nobeti)' },
  { id: 'demir-gece', ad: 'Demir Gece', hex: 'var(--set-demir-gece)' },
  { id: 'fildisi-altin', ad: 'Fildişi Altın', hex: 'var(--set-fildisi-altin)' }
];

export const SET_RENK_KIMLIKLERI: readonly SetRengiId[] = SET_RENK_LISTESI.map(r => r.id);
