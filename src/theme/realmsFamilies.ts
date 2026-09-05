/* ÜRETİLMİŞ DOSYA — elle düzenleme.
   Kaynak: scripts/make-theme-families.mjs */

/** Profildeki tema aileleri ve önizleme renkleri. */
export interface RealmsAilesi {
  id: RealmsAileId;
  ad: string;
  /** İmza renginin nereden geldiği — profilde ipucu olarak gösterilmiyor, kayıt için. */
  kaynak: string;
  /** Açık tema önizlemesi: zemin sabit, vurgu aileye ait. */
  acik: { zemin: string; vurgu: string };
  /** Koyu tema önizlemesi. */
  koyu: { zemin: string; vurgu: string };
}

export type RealmsAileId =
  | 'tacli-parsomen'
  | 'buz-kalesi'
  | 'kuzgun-haritasi'
  | 'ejderha-koz'
  | 'kizil-kale'
  | 'orman-nobeti'
  | 'demir-gece'
  | 'fildisi-altin';

export const VARSAYILAN_AILE: RealmsAileId = 'kuzgun-haritasi';

export const REALMS_AILELERI: RealmsAilesi[] = [
  {
    id: 'tacli-parsomen',
    ad: 'Taçlı Parşömen',
    kaynak: '#B79552',
    acik: { zemin: '#F2E8D8', vurgu: '#765A26' },
    koyu: { zemin: '#0D1925', vurgu: '#D4B56D' }
  },
  {
    id: 'buz-kalesi',
    ad: 'Buz Kalesi',
    kaynak: '#7FAAC2',
    acik: { zemin: '#F2E8D8', vurgu: '#2F6078' },
    koyu: { zemin: '#0D1925', vurgu: '#9FC9DE' }
  },
  {
    id: 'kuzgun-haritasi',
    ad: 'Kuzgun Haritası',
    kaynak: '#15283D',
    acik: { zemin: '#F2E8D8', vurgu: '#15283D' },
    koyu: { zemin: '#0D1925', vurgu: '#A8BED1' }
  },
  {
    id: 'ejderha-koz',
    ad: 'Ejderha Köz',
    kaynak: '#B66038',
    acik: { zemin: '#F2E8D8', vurgu: '#8B3E20' },
    koyu: { zemin: '#0D1925', vurgu: '#E28F61' }
  },
  {
    id: 'kizil-kale',
    ad: 'Kızıl Kale',
    kaynak: '#9E3F38',
    acik: { zemin: '#F2E8D8', vurgu: '#7E2C2A' },
    koyu: { zemin: '#0D1925', vurgu: '#D9786D' }
  },
  {
    id: 'orman-nobeti',
    ad: 'Orman Nöbeti',
    kaynak: '#355B4A',
    acik: { zemin: '#F2E8D8', vurgu: '#355B4A' },
    koyu: { zemin: '#0D1925', vurgu: '#8BC6A1' }
  },
  {
    id: 'demir-gece',
    ad: 'Demir Gece',
    kaynak: '#F2EBDD',
    acik: { zemin: '#F2E8D8', vurgu: '#3F4E5A' },
    koyu: { zemin: '#0D1925', vurgu: '#C1CDD4' }
  },
  {
    id: 'fildisi-altin',
    ad: 'Fildişi Altın',
    kaynak: '#FBF7EF',
    acik: { zemin: '#F2E8D8', vurgu: '#6D5428' },
    koyu: { zemin: '#0D1925', vurgu: '#FBF7EF' }
  }
];

export const AILE_KIMLIKLERI: readonly RealmsAileId[] = REALMS_AILELERI.map(a => a.id);
