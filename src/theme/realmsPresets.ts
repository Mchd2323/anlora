/* ÜRETİLMİŞ DOSYA — elle düzenleme.
   Kaynak: scripts/make-theme-presets.mjs  +  src/theme/theme-presets.json */

/** Profil > Görünüm'de listelenen ek tema. */
export interface RealmsOnAyari {
  id: RealmsOnAyarId;
  ad: string;
  /** Taban anlamsal palet: köke bu değer `data-theme` olarak yazılır. */
  mod: 'light' | 'dark';
  /** Kartın üstündeki küçük önizleme. Değerler CSS'tekilerle aynı. */
  onizleme: { zemin: string; panel: string; vurgu: string; yazi: string };
}

export type RealmsOnAyarId =
  | 'light-frost-crystal'
  | 'light-crimson-dawn'
  | 'light-ancient-map'
  | 'light-grove-oath'
  | 'dark-crimson-night'
  | 'dark-frost-watch'
  | 'dark-dragon-ember'
  | 'dark-iron-grove';

/** Ek açık temalar — dördü de birbirinden bağımsız. */
export const ACIK_ON_AYARLAR: RealmsOnAyari[] = [
  {
    id: 'light-frost-crystal',
    ad: 'Buz Kristali',
    mod: 'light',
    onizleme: { zemin: '#E7F0F2', panel: '#F5F9F9', vurgu: '#2F6078', yazi: '#173445' }
  },
  {
    id: 'light-crimson-dawn',
    ad: 'Kızıl Şafak',
    mod: 'light',
    onizleme: { zemin: '#F3E3DE', panel: '#FCF5F1', vurgu: '#7E2C2A', yazi: '#451D22' }
  },
  {
    id: 'light-ancient-map',
    ad: 'Kadim Harita',
    mod: 'light',
    onizleme: { zemin: '#EFE7D6', panel: '#FAF4E8', vurgu: '#6D5428', yazi: '#3B2C1B' }
  },
  {
    id: 'light-grove-oath',
    ad: 'Orman Yemini',
    mod: 'light',
    onizleme: { zemin: '#E5EEE6', panel: '#F5F9F3', vurgu: '#2D5A45', yazi: '#1F3D32' }
  }
];

/** Ek koyu temalar — dördü de birbirinden bağımsız. */
export const KOYU_ON_AYARLAR: RealmsOnAyari[] = [
  {
    id: 'dark-crimson-night',
    ad: 'Kızıl Gece',
    mod: 'dark',
    onizleme: { zemin: '#1B1118', panel: '#2A171F', vurgu: '#D9786D', yazi: '#F3E6DA' }
  },
  {
    id: 'dark-frost-watch',
    ad: 'Buz Nöbeti',
    mod: 'dark',
    onizleme: { zemin: '#0B1827', panel: '#142A3A', vurgu: '#9FC9DE', yazi: '#F0F6F8' }
  },
  {
    id: 'dark-dragon-ember',
    ad: 'Ejderha Köz',
    mod: 'dark',
    onizleme: { zemin: '#1B1512', panel: '#2B1F1A', vurgu: '#E28F61', yazi: '#F4E7D8' }
  },
  {
    id: 'dark-iron-grove',
    ad: 'Demir Orman',
    mod: 'dark',
    onizleme: { zemin: '#0E1C18', panel: '#153027', vurgu: '#8BC6A1', yazi: '#E7F1E7' }
  }
];

export const TUM_ON_AYARLAR: RealmsOnAyari[] = [...ACIK_ON_AYARLAR, ...KOYU_ON_AYARLAR];

export const ON_AYAR_KIMLIKLERI: readonly RealmsOnAyarId[] = TUM_ON_AYARLAR.map(t => t.id);

/** Bir ön ayarın taban modunu döndürür; tanınmayan kimlikte null. */
export function onAyarModu(id: string): 'light' | 'dark' | null {
  return TUM_ON_AYARLAR.find(t => t.id === id)?.mod ?? null;
}
