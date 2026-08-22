/**
 * Oxford kimlik göçü (V2 → V3).
 *
 * Oxford verisi resmî kaynak listelerinden yeniden üretildiğinde kayıt
 * kimlikleri de kararlı bir şemaya geçti:
 *
 *     ox-a1-about-mlu5      ->  ox3k-a1-about
 *     ox5000-extra-b2-absorb-v ->  ox5k-b2-absorb
 *
 * Eski kimlikler rastgele son ekler taşıyordu ve dataset/CEFR bilgisini
 * güvenilir biçimde kodlamıyordu. Yeni kimlik dataset + CEFR + headword +
 * homograf + qualifier'dan deterministik üretilir, yani liste güncellendiğinde
 * kaymaz.
 *
 * Kullanıcının "Öğrendim", "Tekrar Et", favori ve çalışma geçmişi bu
 * kimliklere bağlı olduğu için göç yapılmazsa tüm ilerleme kaybolur.
 * Bu modül göçü bir kez, sessizce ve geri dönüşsüz veri kaybı olmadan yapar.
 */

import { LearningState, ReviewEvent, CollectionMembership } from '../types';
import { V2_KEYS, getLearningStates, saveLearningStates, getFavorites, saveFavorites,
         getMemberships, saveMemberships, getUserStats, saveUserStats } from './storageV2';
import { readJSON, writeJSON, readRaw, writeRaw } from './safeStorage';
import ID_MAP from '../data/oxfordIdMigration.json';

const MIGRATION_KEY = 'anlora_oxford_id_migration_v3';

const MAP = ID_MAP as Record<string, string>;

/** Eski bir Oxford kimliğini yeni kimliğe çevirir; eşleşme yoksa aynen döner. */
export function mapOxfordId(oldId: string): string {
  return MAP[oldId] || oldId;
}

function remapRecord<T>(source: Record<string, T>): { result: Record<string, T>; changed: number } {
  const result: Record<string, T> = {};
  let changed = 0;

  for (const [key, value] of Object.entries(source)) {
    const mapped = MAP[key];
    if (mapped && mapped !== key) {
      changed++;
      // Aynı yeni kimliğe iki eski kayıt düşerse daha çok çalışılmış olanı
      // korumak yerine ilk geleni tutmak yeterli: çakışma yalnızca eski
      // veride zaten yinelenen kayıtlarda olur.
      if (!(mapped in result)) {
        result[mapped] = value;
      }
    } else {
      result[key] = value;
    }
  }

  return { result, changed };
}

export interface OxfordMigrationReport {
  alreadyMigrated: boolean;
  learningStates: number;
  favorites: number;
  memberships: number;
  mistakes: number;
  reviewHistory: number;
}

/**
 * Göçü çalıştırır. Daha önce çalıştıysa hiçbir şey yapmaz.
 * Uygulama açılışında, diğer verilerden ÖNCE çağrılmalıdır.
 */
export function runOxfordIdMigrationIfNeeded(): OxfordMigrationReport {
  const report: OxfordMigrationReport = {
    alreadyMigrated: false,
    learningStates: 0,
    favorites: 0,
    memberships: 0,
    mistakes: 0,
    reviewHistory: 0,
  };

  if (readRaw(MIGRATION_KEY) === 'true') {
    report.alreadyMigrated = true;
    return report;
  }

  try {
    // 1. Öğrenme durumları ("Öğrendim" / "Tekrar Et" / SRS ilerlemesi)
    const states = getLearningStates();
    const migratedStates = remapRecord<LearningState>(states);
    report.learningStates = migratedStates.changed;
    if (migratedStates.changed > 0) {
      // `wordId` alanı da kimliği taşıyor; tutarlı kalmalı.
      Object.entries(migratedStates.result).forEach(([id, state]) => {
        if (state && state.wordId !== id) {
          migratedStates.result[id] = { ...state, wordId: id };
        }
      });
      saveLearningStates(migratedStates.result);
    }

    // 2. Favoriler
    const favorites = getFavorites();
    const migratedFavorites = Array.from(new Set(favorites.map(mapOxfordId)));
    report.favorites = migratedFavorites.filter((id, index) => id !== favorites[index]).length;
    if (report.favorites > 0) saveFavorites(migratedFavorites);

    // 3. Koleksiyon üyelikleri (kullanıcı Oxford kelimesini kendi setine eklemiş olabilir)
    const memberships = getMemberships();
    let membershipChanges = 0;
    const migratedMemberships: CollectionMembership[] = memberships.map(membership => {
      const mapped = mapOxfordId(membership.wordId);
      if (mapped !== membership.wordId) {
        membershipChanges++;
        return { ...membership, wordId: mapped };
      }
      return membership;
    });
    report.memberships = membershipChanges;
    if (membershipChanges > 0) saveMemberships(migratedMemberships);

    // 4. Sınavdaki hatalı kelimeler listesi
    const stats = getUserStats();
    if (stats.mistakesMap) {
      const migratedMistakes = remapRecord(stats.mistakesMap);
      report.mistakes = migratedMistakes.changed;
      if (migratedMistakes.changed > 0) {
        stats.mistakesMap = migratedMistakes.result as typeof stats.mistakesMap;
        saveUserStats(stats);
      }
    }

    // 5. Çalışma geçmişi
    const history = readJSON<ReviewEvent[]>(V2_KEYS.REVIEW_HISTORY, []);
    if (Array.isArray(history) && history.length > 0) {
      let historyChanges = 0;
      const migratedHistory = history.map(event => {
        const mapped = mapOxfordId(event.wordId);
        if (mapped !== event.wordId) {
          historyChanges++;
          return { ...event, wordId: mapped };
        }
        return event;
      });
      report.reviewHistory = historyChanges;
      if (historyChanges > 0) writeJSON(V2_KEYS.REVIEW_HISTORY, migratedHistory);
    }

    writeRaw(MIGRATION_KEY, 'true');
  } catch (error) {
    // Göç başarısız olursa bayrak yazılmaz; sonraki açılışta yeniden denenir.
    console.error('Oxford kimlik göçü tamamlanamadı:', error);
  }

  return report;
}
