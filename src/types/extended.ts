import { OxfordExample } from './oxford';

/**
 * Genel Dağarcık (Oxford dışı yaygın kelimeler) veri modeli.
 *
 * KAYNAK
 * Madde başları ve sözcük türleri Open English WordNet'ten (CC BY 4.0),
 * sıralama OpenSubtitles FrequencyWords'ten (MIT) gelir. Türkçe karşılıklar ve
 * örnek cümleler elle yazılmıştır. Üretim boru hattı: `scripts/extended/`.
 *
 * NEDEN OXFORD TİPİNDEN AYRI
 * Yapı Oxford kaydına benzer ama otoritesi farklıdır. Oxford kayıtları resmî
 * bir CEFR listesinden gelir; buradaki kelimelerin CEFR seviyesi YOKTUR. Ham
 * dosyalardaki `cefr` alanı boru hattının teknik varsayılanıdır, ölçülmüş bir
 * seviye değildir. İki tipi birleştirmek, olmayan bir seviye bilgisini varmış
 * gibi göstermeye davetiye çıkarırdı; bu yüzden `cefr` uygulamaya hiç
 * taşınmaz ve bu kartlarda CEFR rozeti gösterilmez.
 */

/** Bant numarası: 1 en sık kullanılan, 3 en seyrek. */
export type BandNumber = 1 | 2 | 3;

export interface ExtendedSense {
  /** `gen-b<bant>-<kelime>-<tür>`; kararlıdır, kullanıcı ilerlemesi buna bağlanır. */
  id: string;
  partOfSpeech: string;
  turkishMeanings: string[];
  examples: OxfordExample[];
}

export interface ExtendedEntry {
  id: string;
  headword: string;
  sourceCollection: 'extended';
  /** Sıklık sırası; liste kaynak düzeninde gösterilir. */
  sourceOrder: number;
  sourceEntry: string;
  phonetic?: string;
  variants?: string[];
  senses: ExtendedSense[];
  band: BandNumber;
}

export interface BandDescriptor {
  band: BandNumber;
  label: string;
  /** Bandın ne içerdiğini bir cümleyle anlatır; arayüzde gösterilir. */
  description: string;
  entryCount: number;
  senseCount: number;
}

export interface ExtendedManifest {
  bands: { band: number; entryCount: number; senseCount: number }[];
  plannedWordsPerBand: Record<string, number>;
  totalPlannedWords: number;
}
