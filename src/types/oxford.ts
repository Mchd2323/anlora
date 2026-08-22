import { Level } from './index';

/**
 * Oxford çekirdek sözlüğünün veri modeli.
 *
 * Kaynak otoritesi resmî Oxford 3000 / Oxford 5000 CEFR listeleridir. Bir
 * kaynak SATIRI bir kayıttır; satırdaki her sözcük türü ayrı bir sense olur.
 * Böylece "boost v., n." tek kayıt, iki sense olarak durur ve fiil anlamı ile
 * isim anlamı birbirine karışmaz.
 *
 * Bu model projede zaten bulunan `Oxford5000ExtraEntry` yapısının
 * genelleştirilmiş hâlidir; iki dataset tek tip altında toplanır.
 */

export type OxfordCefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export type OxfordSourceCollection = 'oxford3000' | 'oxford5000-extra';

/** Arayüzde gösterilen grup etiketi. B2 Ek, Oxford 3000 B2'den ayrıdır. */
export type OxfordGroupKey = 'A1' | 'A2' | 'B1' | 'B2' | 'B2_EK' | 'C1';

export interface OxfordExample {
  en: string;
  tr: string;
}

export interface OxfordSense {
  /** Kayıt kimliği + sözcük türü kısaltmasından türetilir; kararlıdır. */
  id: string;
  /** Kaynaktaki sözcük türü etiketi: "n.", "v.", "modal v." ... */
  partOfSpeech: string;
  /** Bu sözcük türüne ait Türkçe karşılıklar. */
  turkishMeanings: string[];
  /** Bu anlamı gösteren örnek cümleler ve çevirileri. */
  examples: OxfordExample[];
}

export interface OxfordEntry {
  /**
   * Kararlı kimlik. dataset + CEFR + headword + homograf + qualifier'dan
   * deterministik üretilir; kaynak sırasına ya da diziye bağlı DEĞİLDİR.
   * Kullanıcı ilerlemesi bu kimliğe bağlanır.
   */
  id: string;
  headword: string;
  /** Kaynaktaki anlam ayırıcı: "money", "long flat surface" ... */
  qualifier?: string;
  /** Kaynaktaki homograf numarası: can1, close2 ... */
  homograph?: number;
  /** "a, an" gibi satırlarda ikinci madde başları. */
  variants?: string[];
  cefr: OxfordCefr;
  sourceCollection: OxfordSourceCollection;
  /** Kaynak listedeki sıra; listeleri kaynak düzeninde göstermek için. */
  sourceOrder: number;
  /** Ayrıştırılan ham kaynak satırı; denetim ve izlenebilirlik için. */
  sourceEntry: string;
  phonetic?: string;
  senses: OxfordSense[];
  /**
   * Sözcük türüne güvenle atanamayan, eski sürümden devralınan genel anlam.
   *
   * Örnek: kaynak "about prep., adv." diyor ama eski veride tek bir
   * "hakkında, ilgili, konusunda" dizesi var. Bu dizeyi tek bir sense'e
   * yazmak yanlış sözcük türü anlamı koymak olurdu; tamamen atmak ise
   * kullanıcının bugün gördüğü bilgiyi kaybetmek olurdu. Sense anlamları
   * hazırlanana kadar arayüz bunu yedek olarak gösterir.
   */
  legacyMeaning?: string;
  /** Anlamı ya da örnekleri eksik olan kayıtlar işaretlenir. */
  needsReview?: boolean;
  reviewReason?: string;
}

/** Bir kaydın gösterilebilir bir Türkçe karşılığı var mı? */
export function getPrimaryMeaning(entry: OxfordEntry): string {
  for (const sense of entry.senses) {
    if (sense.turkishMeanings.length > 0) {
      return sense.turkishMeanings.join(', ');
    }
  }
  return entry.legacyMeaning || '';
}

/** Kaydın sözcük türlerini tek satırda özetler: "n., v." */
export function getPartOfSpeechLabel(entry: OxfordEntry): string {
  return entry.senses.map(sense => sense.partOfSpeech).join(', ');
}

/** Kaydın arayüzdeki grup anahtarı. B2 Ek, Oxford 3000 B2'den ayrıdır. */
export function getGroupKey(entry: OxfordEntry): OxfordGroupKey {
  if (entry.sourceCollection === 'oxford5000-extra') {
    return entry.cefr === 'B2' ? 'B2_EK' : 'C1';
  }
  return entry.cefr as OxfordGroupKey;
}

/** Kayıt tam mı: her sense'in anlamı ve en az 3 örneği var mı? */
export function isEntryComplete(entry: OxfordEntry): boolean {
  return entry.senses.every(
    sense => sense.turkishMeanings.length > 0 && sense.examples.length >= 3
  );
}

/** CEFR seviyesi `Level` tipine dönüştürülür (arayüz rozetleri için). */
export function toLevel(cefr: OxfordCefr): Level {
  return cefr as Level;
}

/**
 * CEFR rozeti gösterilmeli mi?
 *
 * Seviye bilgisi Oxford kaynak listesinin meta verisidir. Kullanıcının kendi
 * kelime setleri serbest koleksiyonlardır; oraya CEFR yazmak, olmayan bir
 * otoriteyi varmış gibi göstermek olur (talimat 36). Kural tek yerde tutulur
 * ki bileşenler arasında kaymasın.
 */
export function shouldShowCefr(card: { sourceType?: string; isCustom?: boolean; level?: unknown }): boolean {
  if (card.isCustom || card.sourceType === 'custom') return false;
  return card.sourceType === 'oxford' && !!card.level;
}
