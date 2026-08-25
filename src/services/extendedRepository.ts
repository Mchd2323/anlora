/**
 * Anlora – Genel Dağarcık deposu (salt okunur, bant bant tembel yüklenir).
 *
 * MİMARİ KARARLAR
 *
 * 1. Bant başına tembel yükleme. Katmanın tamamı ~4,5 MB JSON'dur. Oxford
 *    sözlüğü gibi açılışta baştan sona ayrıştırılsaydı zayıf telefonlarda
 *    uygulama saniyelerce donardı. Her bant ayrı bir `import()` ile, ancak
 *    kullanıcı o bandı açtığında yüklenir.
 *
 * 2. Aynı anda tek bant bellekte. Yeni bant açılınca öncekiler bırakılır
 *    (`releaseBandsExcept`). Üç bandı birden tutmak tembel yüklemenin amacını
 *    ortadan kaldırırdı.
 *
 * 3. İşaretli kartlar bant bırakılsa da yaşar. Kullanıcı bir kelimeyi favoriye
 *    eklediyse ya da "Tekrar Et" dediyse, bandı kapattığında o kelimenin
 *    favoriler listesinden ve tekrar kuyruğundan kaybolması veri kaybı gibi
 *    görünürdü. `retainCards` bu kartların kopyasını ayrı bir haritada tutar;
 *    bu harita yalnızca kullanıcının dokunduğu kelimeler kadar büyür.
 *
 * 4. `import()` çağrıları sabit yazılır. Değişkenli yol (`band-${n}.json`)
 *    paketleyicinin hangi dosyaların gerekli olduğunu görmesini zorlaştırır;
 *    üç sabit dal hem çevrimdışı paketlemeyi hem de parça bölmeyi garanti eder.
 *
 * 5. Salt okunur: Oxford verisinde olduğu gibi kullanıcı da çalışma zamanı da
 *    bu veriyi değiştiremez; ağ ya da yapay zekâ çağrısı yoktur.
 */

import { WordCard } from '../types';
import {
  BandDescriptor,
  BandNumber,
  ExtendedEntry,
  ExtendedManifest,
} from '../types/extended';
import manifestRaw from '../data/extended/manifest.json';

export const EXTENDED_DATA_VERSION = '1.0.0';

const MANIFEST = manifestRaw as ExtendedManifest;

/**
 * Bant açıklamaları.
 *
 * Bantlar sıklık sırasına göre bölünmüştür: 1. bant altyazı derlemlerinde en
 * sık geçen kelimeler, 3. bant en seyrek olanlardır. Sayılar burada sabit
 * yazılmaz, manifest'ten okunur (talimat 24).
 */
const BAND_TEXT: Record<BandNumber, { label: string; description: string }> = {
  1: {
    label: 'Bant 1 · En Sık',
    description: 'Günlük konuşmada ve dizilerde en çok geçen kelimeler.',
  },
  2: {
    label: 'Bant 2 · Orta Sıklık',
    description: 'Sık karşılaşılan ama temel listelerin dışında kalan kelimeler.',
  },
  3: {
    label: 'Bant 3 · Seyrek',
    description: 'Daha nadir, çoğu zaman uzmanlık ya da edebî kullanımdaki kelimeler.',
  },
};

export const EXTENDED_BANDS: readonly BandDescriptor[] = Object.freeze(
  MANIFEST.bands
    .filter(entry => entry.band === 1 || entry.band === 2 || entry.band === 3)
    .map(entry => {
      const band = entry.band as BandNumber;
      return {
        band,
        label: BAND_TEXT[band].label,
        description: BAND_TEXT[band].description,
        entryCount: entry.entryCount,
        senseCount: entry.senseCount,
      };
    })
);

/**
 * Genel Dağarcık kaydını uygulamanın ortak `WordCard` görünümüne çevirir.
 *
 * `level` bilerek doldurulmaz: bu kelimelerin ölçülmüş bir CEFR seviyesi yok.
 * Alan boş kalınca arayüz CEFR rozetini kendiliğinden gizler; olmayan bir
 * seviye uydurulmamış olur (talimat 36/59).
 */
export function extendedEntryToWordCard(entry: ExtendedEntry): WordCard {
  const firstSenseWithExamples = entry.senses.find(sense => sense.examples.length > 0);

  return {
    id: entry.id,
    word: entry.headword,
    headword: entry.headword,
    partOfSpeech: entry.senses.map(sense => sense.partOfSpeech).join(', '),
    turkishMeaning: entry.senses
      .flatMap(sense => sense.turkishMeanings)
      .slice(0, 3)
      .join(', '),
    phonetic: entry.phonetic,
    sourceType: 'extended',
    sourceEntryId: entry.id,
    examples: firstSenseWithExamples ? firstSenseWithExamples.examples : [],
    examplesVerified: entry.senses.every(sense => sense.examples.length >= 3),
    senses: entry.senses.map(sense => ({
      id: sense.id,
      partOfSpeech: sense.partOfSpeech,
      turkishMeanings: sense.turkishMeanings,
      examples: sense.examples,
    })),
  };
}

/** Yüklenmiş bantlar. Aynı anda genellikle tek bant durur. */
const LOADED_BANDS = new Map<BandNumber, readonly WordCard[]>();
/** Süren yüklemeler; aynı bant iki kez istenirse tek istek yapılır. */
const PENDING = new Map<BandNumber, Promise<readonly WordCard[]>>();
/** Bant bırakılsa da elde tutulan kartlar (favori / tekrar kuyruğu). */
const RETAINED = new Map<string, WordCard>();

function importBand(band: BandNumber): Promise<{ default: unknown }> {
  switch (band) {
    case 1:
      return import('../data/extended/band-1.json');
    case 2:
      return import('../data/extended/band-2.json');
    case 3:
      return import('../data/extended/band-3.json');
  }
}

export const extendedRepository = {
  getMetadata() {
    const totalEntries = EXTENDED_BANDS.reduce((sum, b) => sum + b.entryCount, 0);
    const totalSenses = EXTENDED_BANDS.reduce((sum, b) => sum + b.senseCount, 0);
    return {
      datasetVersion: EXTENDED_DATA_VERSION,
      source: 'Open English WordNet (CC BY 4.0) · OpenSubtitles FrequencyWords (MIT)',
      isReadOnly: true as const,
      totalEntries,
      totalSenses,
      bandCount: EXTENDED_BANDS.length,
    };
  },

  getBands(): readonly BandDescriptor[] {
    return EXTENDED_BANDS;
  },

  getBand(band: BandNumber): BandDescriptor | undefined {
    return EXTENDED_BANDS.find(item => item.band === band);
  },

  isBandLoaded(band: BandNumber): boolean {
    return LOADED_BANDS.has(band);
  },

  /** Bandı yükler; yüklüyse önbellekten döner. */
  async loadBand(band: BandNumber): Promise<readonly WordCard[]> {
    const cached = LOADED_BANDS.get(band);
    if (cached) return cached;

    const pending = PENDING.get(band);
    if (pending) return pending;

    const request = importBand(band)
      .then(module => {
        const entries = (module.default || module) as unknown as ExtendedEntry[];
        const cards = Object.freeze(entries.map(extendedEntryToWordCard));
        LOADED_BANDS.set(band, cards);
        PENDING.delete(band);
        return cards;
      })
      .catch(error => {
        // Başarısız istek önbellekte kalmasın; kullanıcı yeniden deneyebilsin.
        PENDING.delete(band);
        throw error;
      });

    PENDING.set(band, request);
    return request;
  },

  getLoadedCards(band: BandNumber): readonly WordCard[] {
    return LOADED_BANDS.get(band) || [];
  },

  /**
   * Verilen bant dışındaki bantları bellekten bırakır.
   * `keep` null verilirse tüm bantlar bırakılır.
   */
  releaseBandsExcept(keep: BandNumber | null): void {
    LOADED_BANDS.forEach((_cards, band) => {
      if (band !== keep) LOADED_BANDS.delete(band);
    });
  },

  /**
   * Bu kimliklere ait kartları, bantları bırakıldıktan sonra da elde tutar.
   * Yüklü olmayan kimlikler sessizce atlanır: kart ancak bandı bir kez
   * açıldığında tanınabilir.
   */
  retainCards(ids: Iterable<string>): void {
    const wanted = new Set(ids);
    if (wanted.size === 0) return;
    LOADED_BANDS.forEach(cards => {
      cards.forEach(card => {
        if (wanted.has(card.id)) RETAINED.set(card.id, card);
      });
    });
  },

  /** Artık işaretli olmayan kartları elden bırakır. */
  pruneRetained(keepIds: Iterable<string>): void {
    const keep = new Set(keepIds);
    RETAINED.forEach((_card, id) => {
      if (!keep.has(id)) RETAINED.delete(id);
    });
  },

  getRetainedCards(): readonly WordCard[] {
    return Array.from(RETAINED.values());
  },

  /** Yüklü bantlarda ya da elde tutulanlarda kimlikle kart arar. */
  getCardById(id: string): WordCard | undefined {
    for (const cards of LOADED_BANDS.values()) {
      const found = cards.find(card => card.id === id);
      if (found) return found;
    }
    return RETAINED.get(id);
  },
};
