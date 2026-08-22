import { WordCard, Badge } from '../types';
import { oxfordCoreRepository, OXFORD_DATA_VERSION, OXFORD_GROUPS } from '../services/oxfordCoreRepository';

export { oxfordCoreRepository, OXFORD_DATA_VERSION, OXFORD_GROUPS };

/**
 * Oxford 3000 (A1–B2) kelimeleri.
 *
 * Kaynak artık `oxfordCoreRepository`; veri resmî Oxford listelerinden
 * üretiliyor ve her sözcük türü ayrı bir sense taşıyor. Dışa verilen ad
 * korunuyor ki mevcut bileşenler değişmeden çalışsın.
 */
export const OXFORD_3000_WORDS: WordCard[] = [
  ...oxfordCoreRepository.getWordCardsByGroup('A1'),
  ...oxfordCoreRepository.getWordCardsByGroup('A2'),
  ...oxfordCoreRepository.getWordCardsByGroup('B1'),
  ...oxfordCoreRepository.getWordCardsByGroup('B2'),
];

/** Oxford 5000 Ek kelimeleri (B2 Ek + C1). Oxford 3000 B2 ile karıştırılmaz. */
export const OXFORD_5000_EXTRA_WORDS: WordCard[] = [
  ...oxfordCoreRepository.getWordCardsByGroup('B2_EK'),
  ...oxfordCoreRepository.getWordCardsByGroup('C1'),
];

/**
 * Motivasyon rozetleri.
 *
 * Kilit açma koşulu doğrudan rozet tanımının içinde durur. Önceki sürümde
 * koşullar `storageV2.ts` içinde ayrı bir listede tutuluyordu ve iki liste
 * birbirinden kaymıştı: koşullar `first_step`, `a1_master`, `vocab_wizard`,
 * `book_creator`, `quiz_champ` kimliklerini arıyor, tanımlar ise
 * `first_steps`, `quiz_master`, `streak_3`, `vocab_50`, `perfect_score`
 * kimliklerini taşıyordu. Yalnızca `fav_collector` örtüştüğü için altı
 * rozetten beşi hiçbir koşulda açılamıyordu. Koşulu tanımın yanında tutmak
 * bu kaymayı yapısal olarak imkânsız kılar.
 */
export const BADGES_DATA: Badge[] = [
  {
    id: 'first_steps',
    name: 'İlk Adımlar',
    description: 'İlk kelimeni öğren, favorine ekle ya da ilk kartını oluştur.',
    iconName: 'Footprints',
    unlocked: false,
    requirementText: '1 kelimeyle başla',
    isEarned: p =>
      p.masteredCount >= 1 || p.favoritesCount >= 1 || p.customWordsCount >= 1
  },
  {
    id: 'quiz_master',
    name: 'Sınav Ustası',
    description: 'Toplam 10 sınavı tamamla.',
    iconName: 'Award',
    unlocked: false,
    requirementText: '10 sınav tamamla',
    isEarned: p => p.totalQuizzesTaken >= 10
  },
  {
    id: 'streak_3',
    name: 'Seri Öğrenici',
    description: '3 gün üst üste uygulamada çalış.',
    iconName: 'Zap',
    unlocked: false,
    requirementText: '3 günlük seri yap',
    isEarned: p => p.streakDays >= 3
  },
  {
    id: 'vocab_50',
    name: 'Kelime Avcısı',
    description: '50 kelimeyi tam öğrenilmiş seviyeye taşı.',
    iconName: 'BookOpen',
    unlocked: false,
    requirementText: '50 kelime öğren',
    isEarned: p => p.masteredCount >= 50
  },
  {
    id: 'perfect_score',
    name: 'Kusursuz Başarı',
    description: 'Bir sınavda %100 doğruluk oranına ulaş.',
    iconName: 'Trophy',
    unlocked: false,
    requirementText: '%100 sınav skoru al',
    isEarned: p => p.bestQuizAccuracy >= 1
  },
  {
    id: 'fav_collector',
    name: 'Koleksiyoner',
    description: '20 kelimeyi favorilerine ekle.',
    iconName: 'Bookmark',
    unlocked: false,
    requirementText: '20 favori kelime ekle',
    isEarned: p => p.favoritesCount >= 20
  },
  {
    id: 'notebook_builder',
    name: 'Defter Sahibi',
    description: 'Kendi kelime setlerinden 3 tane oluştur.',
    iconName: 'Library',
    unlocked: false,
    requirementText: '3 kelime seti oluştur',
    isEarned: p => p.collectionsCount >= 3
  }
];
