/* ÜRETİLMİŞ DOSYA — elle düzenleme.
   Kaynak: scripts/make-theme-presets.mjs */

/** Yeni Kelime Seti penceresindeki vurgu rengi. */
export interface SetRengi {
  id: SetRengiId;
  ad: string;
  /** CSS belirteci — açık/koyu karşılığı belirtecin içinde tanımlı. */
  hex: string;
  /**
   * Kutucuğun ÜSTÜNDEKİ simgenin rengi — ölçülerek seçildi, varsayılmadı.
   *
   * Bileşenlerde `text-white` sabitti. Açık temada kutucuklar koyu olduğu
   * için sorun görünmüyordu; koyu temada kutucuklar açık renge dönüyor ve
   * simge kayboluyordu (ölçülen kontrast 1,37 – 2,15). Artık her kutucuk
   * kendi okunur simge rengini taşıyor.
   */
  uzeri: string;
}

export type SetRengiId =
  | 'tacli-parsomen'
  | 'buz-kalesi'
  | 'kuzgun-haritasi'
  | 'ejderha-koz'
  | 'kizil-kale'
  | 'orman-nobeti'
  | 'demir-gece'
  | 'fildisi-altin'
  | 'turkuaz-sis'
  | 'safak-gulu'
  | 'murekkep-sisi'
  | 'sogut-golgesi';

export const SET_RENK_LISTESI: SetRengi[] = [
  { id: 'tacli-parsomen', ad: 'Taçlı Parşömen', hex: 'var(--set-tacli-parsomen)', uzeri: 'var(--set-tacli-parsomen-uzeri)' },
  { id: 'buz-kalesi', ad: 'Buz Kalesi', hex: 'var(--set-buz-kalesi)', uzeri: 'var(--set-buz-kalesi-uzeri)' },
  { id: 'kuzgun-haritasi', ad: 'Kuzgun Haritası', hex: 'var(--set-kuzgun-haritasi)', uzeri: 'var(--set-kuzgun-haritasi-uzeri)' },
  { id: 'ejderha-koz', ad: 'Ejderha Köz', hex: 'var(--set-ejderha-koz)', uzeri: 'var(--set-ejderha-koz-uzeri)' },
  { id: 'kizil-kale', ad: 'Kızıl Kale', hex: 'var(--set-kizil-kale)', uzeri: 'var(--set-kizil-kale-uzeri)' },
  { id: 'orman-nobeti', ad: 'Orman Nöbeti', hex: 'var(--set-orman-nobeti)', uzeri: 'var(--set-orman-nobeti-uzeri)' },
  { id: 'demir-gece', ad: 'Demir Gece', hex: 'var(--set-demir-gece)', uzeri: 'var(--set-demir-gece-uzeri)' },
  { id: 'fildisi-altin', ad: 'Fildişi Altın', hex: 'var(--set-fildisi-altin)', uzeri: 'var(--set-fildisi-altin-uzeri)' },
  { id: 'turkuaz-sis', ad: 'Turkuaz Sis', hex: 'var(--set-turkuaz-sis)', uzeri: 'var(--set-turkuaz-sis-uzeri)' },
  { id: 'safak-gulu', ad: 'Şafak Gülü', hex: 'var(--set-safak-gulu)', uzeri: 'var(--set-safak-gulu-uzeri)' },
  { id: 'murekkep-sisi', ad: 'Mürekkep Sisi', hex: 'var(--set-murekkep-sisi)', uzeri: 'var(--set-murekkep-sisi-uzeri)' },
  { id: 'sogut-golgesi', ad: 'Söğüt Gölgesi', hex: 'var(--set-sogut-golgesi)', uzeri: 'var(--set-sogut-golgesi-uzeri)' }
];

export const SET_RENK_KIMLIKLERI: readonly SetRengiId[] = SET_RENK_LISTESI.map(r => r.id);
