export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type PartOfSpeech =
  | 'n.'
  | 'v.'
  | 'adj.'
  | 'adv.'
  | 'prep.'
  | 'conj.'
  | 'pron.'
  | 'det.'
  | 'modal v.'
  | 'phr. v.'
  | 'exclam.'
  | 'num.'
  | 'phrase'
  | 'idiom';

export interface ExampleSentence {
  en: string;
  tr: string;
}

export type ValidationStatus = 'VALID' | 'WARNING' | 'INVALID';

/**
 * Immutable Oxford 3000 Core Sense Definition
 */
export interface OxfordSense {
  id: string;
  partOfSpeech?: string;
  turkishMeanings: string[];
  examples: {
    english: string;
    turkish: string;
  }[];
  usageNote?: string;
}

/**
 * Immutable Oxford 3000 Core Dictionary Entry
 */
export interface OxfordEntry {
  id: string;
  headword: string;
  lemma: string;
  qualifier?: string;
  cefr: 'A1' | 'A2' | 'B1' | 'B2';
  partOfSpeech: string | string[];
  turkishMeaning: string;
  phonetic?: string;
  examples: ExampleSentence[];
  senses?: OxfordSense[];
}

/**
 * User Learning State for Oxford Entries (Separated from Core Data)
 */
export interface UserOxfordState {
  oxfordEntryId: string;
  status: 'unmarked' | 'learning' | 'learned';
  favorite: boolean;
  masteryScore?: number;
  reviewCount?: number;
  correctCount?: number;
  wrongCount?: number;
  lastReviewedAt?: string;
  nextReviewAt?: string;
}

export interface WordSense {
  id: string;
  partOfSpeech?: string; // e.g. "n.", "v.", "adj.", "adv.", "prep.", "phr. v."
  turkishMeanings: string[]; // e.g. ["hafif"]
  shortExplanationTr?: string; // short clarification in Turkish
  contextSentence?: string;
  examples: ExampleSentence[];
  userProvidedMeaning?: string;
  aiValidated?: boolean;
  aiValidationStatus?: ValidationStatus;
  aiWarningNote?: string;
  suggestedCorrection?: string;
  userStatus?: 'learned' | 'learning' | 'unseen';
  cefr?: Level;
  usageNoteTr?: string;
}

export interface WordCard {
  id: string;
  word: string;
  headword?: string; // canonical Oxford headword
  lemma?: string;
  qualifier?: string;
  canonicalWord?: string; // normalized base form
  partOfSpeech: string; // e.g., "n.", "v.", "adj." (primary / legacy)
  turkishMeaning: string; // primary / legacy
  contextualMeaning?: string; // specific meaning in user's context sentence
  otherMeanings?: string[]; // other common meanings
  phonetic?: string;
  examples: ExampleSentence[];
  /**
   * `examples` dizisindeki cümlelerin doğrulanmış olup olmadığı.
   *
   * Çekirdek sözlükteki cümlelerin %88'i sabit kalıplardan üretilmişti ve
   * dilbilgisi dışıydı ("I want to ago today because it is very important").
   * Bunlar veriden çıkarıldı; etkilenen maddelerde bu alan `false` olur ve
   * `examples` boş kalır. Arayüz bu maddelerde "örnek yok" durumunu dürüstçe
   * gösterir, uydurma cümle sunmaz. Yeniden üretim için:
   * `scripts/data-repair/repair_examples.ts`
   */
  examplesVerified?: boolean;
  level?: Level;
  senses?: WordSense[]; // multi-POS / multi-sense breakdown (unlimited senses)
  isCustom?: boolean;
  customNote?: string;
  /**
   * Kartın kaynağı. 'extended' = Genel Dağarcık katmanı; Oxford gibi salt
   * okunurdur ama resmî bir CEFR listesinden gelmediği için seviye taşımaz.
   */
  sourceType?: 'oxford' | 'custom' | 'extended';
  /**
   * Kaydın türü: tek kelime mi, kalıp mı, deyim mi?
   *
   * Ayrı bir bölüm açmak yerine kartın üzerinde bir alan tutuluyor. Böylece
   * arama, sınav, seviye takibi ve çalışma akışı olduğu gibi çalışır; tür
   * yalnızca bir rozet ve bir filtre olur. Ayrı bir sekme, ayrı bir ilerleme
   * sayacı ve ayrı bir çalışma akışı demek olurdu.
   *
   * 'word'   : tek kelime (varsayılan; alan boşsa böyle sayılır)
   * 'phrase' : birden çok sözcükten oluşan kalıp — 'give up', 'in the long run'
   * 'idiom'  : anlamı sözcüklerinin toplamından çıkmayan deyim —
   *            'break the ice', 'once in a blue moon'
   *
   * İkisinin sınırı her zaman keskin değildir; ayrım kullanıcıya bırakılır,
   * uygulama yalnızca boşluk/tire içeren girişlerde 'phrase' önerir.
   */
  entryType?: 'word' | 'phrase' | 'idiom';
  sourceEntryId?: string; // canonical Oxford ID if originated from Oxford 3000
  sourceContext?: string; // e.g. "He was reluctant to tell her the truth."
  sourceName?: string; // e.g. "Breaking Bad S02E05"
  collocations?: string[]; // e.g. ["reluctant to do", "reluctant agreement"]
  prepositions?: string[];
  dateAdded?: string;
  isAiGenerated?: boolean;
  duplicateOverride?: boolean;
}

// Collection / Deck entity
export interface Collection {
  id: string;
  name: string;
  description?: string;
  iconName?: string; // e.g., 'BookOpen', 'Tv', 'Briefcase', 'GraduationCap', etc.
  color?: string; // Tailwind color class e.g., 'indigo', 'amber', 'emerald', 'rose', 'sky', 'violet'
  isPinned?: boolean;
  isArchived?: boolean;
  /**
   * Setteki kelimelerin sırası.
   *
   * 'added' (varsayılan): sete eklendiği sıra korunur — kullanıcı kelimeyi
   * nereye koyduğunu hatırlar. 'alphabetical': A–Z. 'level': CEFR
   * seviyesine göre kolaydan zora. 'date': en son eklenen üstte.
   * 'status': önce tekrar edilecekler, sonra hiç görülmemişler, en sonda
   * öğrenilenler — çalışmaya nereden devam edileceğini gösterir.
   *
   * Tercih set başınadır, çünkü "diziden topladıklarım" ile "sınav
   * kelimeleri" farklı düzen ister.
   */
  sortMode?: 'added' | 'alphabetical' | 'level' | 'date' | 'status';
  /**
   * Set bağlantıyla paylaşıldıysa sunucudan dönen kod.
   *
   * Yoksa set GİZLİDİR ve yalnızca cihazda durur. Paylaşım açık bir
   * eylemdir; hiçbir set kullanıcı istemeden dışarı çıkmaz.
   */
  shareCode?: string;
  createdAt: string;
  updatedAt: string;
}

// Cross-Collection Membership (Many-to-Many linking with contextual notes)
export interface CollectionMembership {
  id: string;
  wordId: string;
  collectionId: string;
  sourceContext?: string; // Source sentence specific to this collection
  sourceName?: string; // Source tag (e.g. "Breaking Bad S02E05")
  addedAt: string;
}

// Spaced Repetition / Learning State per word (Global across user memory)
export type LearningStage =
  | 'NEW'
  | 'LEARNING'
  | 'REVIEW'
  | 'WEAK'
  | 'MASTERED'
  | 'RELEARNING';

export type ResponseQuality = 'again' | 'hard' | 'good' | 'easy';

export interface SenseLearningState {
  senseId: string;
  userStatus: 'unseen' | 'learning' | 'learned';
  masteryScore?: number;
  nextReviewAt?: string;
  correctCount?: number;
  wrongCount?: number;
}

export interface LearningState {
  wordId: string;
  userStatus?: 'learned' | 'learning' | 'unseen';
  stage: LearningStage;
  masteryScore: number; // 0 - 100
  difficulty: number; // 0.1 - 1.0 (higher = harder)
  reviewCount: number;
  correctCount: number;
  wrongCount: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  intervalDays: number;
  lastReviewedAt?: string;
  nextReviewAt: string; // ISO date string
  lastResponseQuality?: ResponseQuality;
  senseStates?: Record<string, SenseLearningState>;
}

// Individual review event log
export interface ReviewEvent {
  id: string;
  wordId: string;
  collectionId?: string;
  timestamp: string;
  quality: ResponseQuality;
  mode: 'flashcard' | 'typed' | 'listening' | 'cloze' | 'quiz';
  isCorrect: boolean;
  timeSpentMs?: number;
}

// Confusion Pair detected from user errors
export interface ConfusionPair {
  id: string;
  wordAId: string;
  wordBId: string;
  wordA: string;
  wordB: string;
  confusionCount: number;
  lastConfusedAt: string;
}

// User Settings
export interface UserSettings {
  dailyReviewGoal: number;
  dailyNewWordsGoal: number;
  autoPlayAudioOnCard: boolean;
  preferredStudyMode: 'mixed' | 'flashcard' | 'typed' | 'listening' | 'cloze';
  enableTypoTolerance: boolean;
  /**
   * Tema tercihi.
   *
   * 'system' (varsayılan) telefonun ayarını izler — çoğu kişi için doğru
   * cevap budur ve akşam otomatik koyulaşır. Kullanıcı açıkça seçtiğinde
   * sistem ayarı geçersiz kalır.
   */
  /**
   * Renk teması.
   *
   * 'system': hiçbir işaret konmaz, ayrımı telefonun ayarı yapar.
   * Diğerleri kökte `data-theme` olarak durur ve sistemi geçersiz kılar.
   * 'light'/'dark' ilk sürümden kalan kimliklerdir; kayıtlı ayarları
   * bozmamak için adları korundu.
   */
  /*
   * 'light' ve 'lavanta' kaldırıldı: 'light' temel temanın birebir aynısıydı
   * (listede iki ayrı seçenek gibi görünüp aynı ekranı veriyordu), 'lavanta'
   * ise yerini daha ayırt edici 'sis'e bıraktı. Eski değeri kayıtlı olan
   * kullanıcılar için geçiş aşağıda ele alınıyor.
   */
  theme?: 'system' | 'deniz' | 'kum' | 'gul' | 'sis' | 'dark' | 'orman' | 'komur';
  /**
   * Yazı büyüklüğü çarpanı (1 = varsayılan).
   *
   * Kök yazı boyutunu ölçekler; bütün arayüz `rem` tabanlı olduğu için
   * tek bir değer her yeri birlikte büyütür. Tek tek bileşen boyutlarıyla
   * oynamak, düzeni yerinden oynatırdı.
   */
  fontScale?: number;
}

// Duplicate check result structure
export type DuplicateType =
  | 'EXACT_IN_COLLECTION'
  | 'EXACT_IN_OTHER_COLLECTION'
  | 'EXACT_IN_OXFORD'
  | 'INFLECTED_FORM'
  | 'DIFFERENT_SENSE'
  | 'NONE';

export interface DuplicateCheckResult {
  type: DuplicateType;
  normalizedWord: string;
  matchedWordCard?: WordCard;
  matchedCollectionName?: string;
  matchedCollectionId?: string;
  lemmaSuggestion?: {
    baseForm: string;
    explanation: string;
  };
  otherCollectionNames?: string[];
  isInOxford?: boolean;
  oxfordLevel?: Level;
}

// Text vocabulary miner token result
export interface MinedWordItem {
  rawWord: string;
  lemma: string;
  count: number;
  status: 'KNOWN' | 'IN_SYSTEM' | 'OXFORD_AVAILABLE' | 'NEW';
  level?: Level;
  matchedCard?: WordCard;
  suggestedMeaning?: string;
  /**
   * Kelimenin metinde geçtiği cümle.
   *
   * "Metinden kelime yakala" özelliğinin asıl değeri, kelimeyi gördüğün
   * cümleyle birlikte hatırlamaktır; bağlamsız bir kelime listesi sözlükten
   * farksızdır. `addWordToCollection` zaten `sourceContext` parametresi
   * alıyordu ama madenci bu bilgiyi hiç toplamıyordu.
   */
  contextSentence?: string;
  /** Metinde rastlanan yazımlar (ör. "run", "running", "ran"). */
  observedForms?: string[];
}

// Study Session Types
export type StudySessionMode = 'mixed' | 'flashcard' | 'typed' | 'listening' | 'cloze';

export interface StudyCardItem {
  word: WordCard;
  learningState?: LearningState;
  questionType: 'flashcard' | 'typed' | 'listening' | 'cloze';
  clozeSentence?: { en: string; tr: string; blanked: string };
  contextSentence?: string;
  collectionSources?: { collectionName: string; sourceName?: string; sourceContext?: string }[];
}

/**
 * Bir çalışma oturumunun sonucu.
 *
 * Alan adları `StudySessionView`'ün ürettiği nesneyle hizalandı. Önceki
 * sürümde tip tamamen farklı alanlar (totalReviewed, weakWordIds, ...)
 * tanımlıyordu; @types/react kurulu olmadığı için bu uyuşmazlık derlemede
 * hiç görünmüyordu.
 */
export interface StudySessionSummary {
  sessionId: string;
  date: string;
  totalCardsReviewed: number;
  newCardsLearned: number;
  reviewsCompleted: number;
  mistakeWordIds: string[];
  upgradedWordIds: string[];
}

// Quiz System Types
export interface QuizQuestion {
  id: string;
  word: WordCard;
  type: 'multiple-choice-tr' | 'multiple-choice-en' | 'fill-blank' | 'listening';
  questionText: string;
  audioWord?: string;
  options: string[];
  correctAnswer: string;
}

export interface QuizResult {
  sourceName: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  scorePercentage: number;
  mistakenWords: WordCard[];
  date: string;
}

export interface QuizSessionSummary {
  sessionId: string;
  date: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  scorePercent: number;
  mistakeWords: string[];
}

/**
 * Snapshot of everything a badge condition may look at. Passing a single
 * object keeps the unlock rules colocated with the badge definitions, so a
 * badge can never again be defined with an id that no rule checks for.
 */
export interface BadgeProgressSnapshot {
  masteredCount: number;
  favoritesCount: number;
  customWordsCount: number;
  collectionsCount: number;
  streakDays: number;
  totalQuizzesTaken: number;
  totalCorrect: number;
  totalWrong: number;
  bestQuizAccuracy: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconName: string;
  unlocked: boolean;
  unlockedAt?: string;
  requirementText: string;
  /** Returns true once the learner has earned this badge. */
  isEarned: (progress: BadgeProgressSnapshot) => boolean;
}

export interface UserStats {
  totalQuizzesTaken: number;
  totalCorrect: number;
  totalWrong: number;
  streakDays: number;
  lastActiveDate: string;
  mistakesMap: Record<string, { word: WordCard; wrongCount: number }>;
  learnedCount: number;
  favoriteCount: number;
  customCardsCount: number;
  typedRecallAccuracy?: number;
  listeningAccuracy?: number;
  clozeAccuracy?: number;
  totalStudySessionsCompleted?: number;
  /** Bugüne kadarki en yüksek sınav doğruluk oranı (0-1). */
  bestQuizAccuracy?: number;
}

export interface UserProfile {
  email: string | null;
  name?: string;
  isLoggedIn: boolean;
  country?: string;
  city?: string;
  emailVerified?: boolean;
  authProvider?: 'google' | 'email' | 'guest';
  lastSyncTime?: string;
  /**
   * Yönetim paneli girişi gösterilsin mi?
   *
   * Sunucudan gelir; yetkinin KENDİSİ değildir. Yetki her yönetim ucunda
   * ayrıca denetlenir, bu alanla oynayan bir istemci hiçbir şeye erişemez.
   */
  isAdmin?: boolean;
}

// Complete Version 2 Backup Archive
export interface V2BackupPayload {
  schemaVersion: 2;
  exportedAt: string;
  collections: Collection[];
  memberships: CollectionMembership[];
  customWords: WordCard[];
  learningStates: Record<string, LearningState>;
  reviewHistory: ReviewEvent[];
  confusionPairs: ConfusionPair[];
  favorites: string[];
  userSettings: UserSettings;
  stats: UserStats;
  unlockedBadges: string[];
}
