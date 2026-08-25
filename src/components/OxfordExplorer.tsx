import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { WordCard, Level, LearningState } from '../types';
import { OxfordGroupKey } from '../types/oxford';
import { WordCardComponent } from './WordCard';
import { StudyFlashcard } from './study/StudyFlashcard';
import { Search, Volume2, BookOpen, Play, BrainCircuit, X } from 'lucide-react';
import { speakText } from '../utils/speech';
import { getUserWordStatus } from '../utils/storageV2';
import { CEFRBadge } from './ui/CEFRBadge';

/**
 * Oxford 5000 gezgini.
 *
 * TASARIM KARARLARI
 *
 * 1. TEK BAŞLIK. Önceki sürümde "Oxford 3000" ve "Oxford 5000 – Ek" iki ayrı
 *    sekmeydi; kullanıcı aynı sözlüğün iki parçası arasında gezinmek zorunda
 *    kalıyordu. Artık hepsi "Oxford 5000" altında, seviyeler yan yana duruyor.
 *    Kaynak ayrımı yine korunuyor: B2 Ek, Oxford 3000'in B2'siyle aynı kovaya
 *    atılmaz, kendi seviye düğmesi olarak durur (talimat 36).
 *
 * 2. LİSTE SAYFALANIR. "Tümü" seçiliyken havuz ~3.800 karttır. Hepsini tek
 *    seferde DOM'a basmak, sekmeye her girişte ve her filtre değişiminde
 *    saniyelerce donmaya yol açıyordu. Liste `PAGE_SIZE` kadar büyür.
 *
 * 3. DURUM ÖZETİ TIKLANABİLİR. "30 Öğrendim" yazısı artık bir düğmedir;
 *    dokununca liste yalnızca o kelimeleri gösterir. Sayıyı görüp de listesine
 *    ulaşamamak, bilgiyi yarım bırakmaktı.
 */

/** Bir sayfada gösterilen kart sayısı. */
const PAGE_SIZE = 60;

/** Seviye düğmelerinin sırası. Kaynak ayrımı korunur: B2 Ek ayrı durur. */
const LEVEL_KEYS: (Level | 'ALL' | OxfordGroupKey)[] = [
  'ALL',
  'A1',
  'A2',
  'B1',
  'B2',
  'B2_EK',
  'C1',
];

const LEVEL_LABEL: Record<string, string> = {
  ALL: 'Tümü',
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
  B2_EK: 'B2 Ek',
  C1: 'C1',
};

type StatusFilter = 'ALL' | 'LEARNED' | 'LEARNING' | 'UNSEEN' | 'FAVORITES';

interface OxfordExplorerProps {
  /** Oxford 3000 (A1–B2). */
  words: WordCard[];
  /** Oxford 5000 Ek (B2 Ek, C1). */
  extraWords?: WordCard[];
  favorites: string[];
  learned: string[];
  learningStates?: Record<string, LearningState>;
  selectedLevel: Level | 'ALL' | OxfordGroupKey;
  setSelectedLevel: (lvl: Level | 'ALL' | OxfordGroupKey) => void;
  /** Profil ekranından "öğrendiklerim"e doğrudan gelmek için. */
  initialStatusFilter?: StatusFilter;
  onToggleFavorite: (id: string) => void;
  onToggleLearned?: (id: string) => void;
  onSetStatus?: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
  onOpenAddToCollection?: (card: WordCard) => void;
  onStartStudy?: (cards: WordCard[]) => void;
  onStartQuiz?: (cards: WordCard[]) => void;
}

/** Kartın seviye düğmesi karşılığı. B2 Ek, Oxford 3000 B2'den ayrıdır. */
function groupKeyOf(card: WordCard, isExtra: boolean): string {
  if (!isExtra) return card.level || 'B2';
  return card.level === 'C1' ? 'C1' : 'B2_EK';
}

export const OxfordExplorer: React.FC<OxfordExplorerProps> = ({
  words = [],
  extraWords = [],
  favorites = [],
  learningStates = {},
  selectedLevel,
  setSelectedLevel,
  initialStatusFilter = 'ALL',
  onToggleFavorite,
  onToggleLearned,
  onSetStatus,
  onOpenAddToCollection,
  onStartQuiz,
}) => {
  const [isStudyingFlashcards, setIsStudyingFlashcards] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [partOfSpeechFilter, setPartOfSpeechFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Dışarıdan gelen istek (profilden "öğrendiklerim") filtreyi günceller.
  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  /**
   * İki kaynak tek havuzda birleşir; her karta seviye düğmesi karşılığı
   * eklenir. Kaynak dizileri modül düzeyinde sabit olduğu için bu hesap
   * uygulama ömründe bir kez yapılır.
   */
  const pool = useMemo(() => {
    return [
      ...words.map(card => ({ card, group: groupKeyOf(card, false) })),
      ...extraWords.map(card => ({ card, group: groupKeyOf(card, true) })),
    ];
  }, [words, extraWords]);

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: pool.length };
    pool.forEach(({ group }) => {
      counts[group] = (counts[group] || 0) + 1;
    });
    return counts;
  }, [pool]);

  const levelPool = useMemo(() => {
    if (selectedLevel === 'ALL') return pool;
    return pool.filter(item => item.group === selectedLevel);
  }, [pool, selectedLevel]);

  const levelStats = useMemo(() => {
    let learnedCount = 0;
    let learningCount = 0;
    let unseenCount = 0;
    levelPool.forEach(({ card }) => {
      const status = getUserWordStatus(card.id, learningStates);
      if (status === 'learned') learnedCount++;
      else if (status === 'learning') learningCount++;
      else unseenCount++;
    });
    return { total: levelPool.length, learnedCount, learningCount, unseenCount };
  }, [levelPool, learningStates]);

  const filteredWords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return levelPool
      .filter(({ card }) => {
        if (
          partOfSpeechFilter !== 'ALL' &&
          !card.partOfSpeech.toLowerCase().includes(partOfSpeechFilter.toLowerCase())
        ) {
          return false;
        }

        if (statusFilter !== 'ALL') {
          if (statusFilter === 'FAVORITES') {
            if (!favorites.includes(card.id)) return false;
          } else {
            const status = getUserWordStatus(card.id, learningStates);
            if (statusFilter === 'LEARNED' && status !== 'learned') return false;
            if (statusFilter === 'LEARNING' && status !== 'learning') return false;
            if (statusFilter === 'UNSEEN' && status !== 'unseen') return false;
          }
        }

        if (query) {
          return (
            card.word.toLowerCase().includes(query) ||
            card.turkishMeaning.toLowerCase().includes(query)
          );
        }

        return true;
      })
      .map(item => item.card);
  }, [levelPool, partOfSpeechFilter, statusFilter, searchQuery, favorites, learningStates]);

  // Filtre değişince sayfalama başa döner.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, partOfSpeechFilter, statusFilter, selectedLevel]);

  const visibleWords = useMemo(
    () => filteredWords.slice(0, visibleCount),
    [filteredWords, visibleCount]
  );

  const handlePlayAllWordsInList = useCallback(() => {
    if (filteredWords.length === 0) return;
    speakText(
      filteredWords
        .slice(0, 10)
        .map(w => `${w.word}. ${w.turkishMeaning}`)
        .join('. ')
    );
  }, [filteredWords]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setPartOfSpeechFilter('ALL');
    setStatusFilter('ALL');
  }, []);

  const levelSuffix = selectedLevel === 'ALL' ? '' : ` (${LEVEL_LABEL[selectedLevel]})`;

  if (isStudyingFlashcards) {
    return (
      <StudyFlashcard
        title={`Oxford 5000${levelSuffix}`}
        sourceContextName={`Oxford 5000${levelSuffix}`}
        deckKey={`oxford:${selectedLevel}`}
        words={filteredWords.length > 0 ? filteredWords : levelPool.map(item => item.card)}
        favorites={favorites}
        learningStates={learningStates}
        onToggleFavorite={onToggleFavorite}
        onSetStatus={onSetStatus || (() => {})}
        onBack={() => setIsStudyingFlashcards(false)}
        onOpenAddToCollection={onOpenAddToCollection}
        isCustomDeck={false}
      />
    );
  }

  return (
    <div className="space-y-6 pb-safe-nav max-w-[1180px] mx-auto animate-fadeIn">
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFFFF] p-6 rounded-2xl border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1E2430]">Oxford 5000</h2>
            {selectedLevel !== 'ALL' && (
              <CEFRBadge level={selectedLevel === 'B2_EK' ? 'B2 EK' : selectedLevel} />
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#687080] mt-1">
            A1'den C1'e kadar {levelCounts.ALL.toLocaleString('tr-TR')} kayıt, tek listede.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onStartQuiz && filteredWords.length >= 4 && (
            <button
              onClick={() => onStartQuiz(filteredWords)}
              className="px-3.5 py-2 bg-[#F1EFE8] hover:bg-[#EEECFA] text-[#4F46A5] border border-[#D7D2F4] font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>Sınav Başlat</span>
            </button>
          )}

          <button
            onClick={handlePlayAllWordsInList}
            className="px-3 py-2 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-[#1E2430] border border-[#E4E1D9] font-medium text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Listeden ilk 10 kelimeyi seslendir"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#4F46A5]" />
            <span>Sesli Dinle</span>
          </button>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E4E1D9] space-y-4 shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        {/* Seviye düğmeleri */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {LEVEL_KEYS.map(key => {
            const isSelected = selectedLevel === key;
            const count = levelCounts[key] || 0;
            return (
              <button
                key={key}
                onClick={() => setSelectedLevel(key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-[#4F46A5] text-white border-[#4F46A5] shadow-xs'
                    : 'bg-[#F8F7F3] text-[#1E2430] border-[#E4E1D9] hover:bg-[#F1EFE8]'
                }`}
              >
                <span>{LEVEL_LABEL[key]}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#E4E1D9] text-[#687080]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/*
         * Durum özeti. Her sayı bir düğmedir: kullanıcı "30 Öğrendim"e
         * dokununca liste o otuz kelimeye iner.
         */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9] text-xs">
          <div className="text-[#687080] font-medium">
            Toplam <strong className="text-[#1E2430]">{levelStats.total}</strong> kelime içinde:
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'LEARNED' ? 'ALL' : 'LEARNED')}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer border ${
                statusFilter === 'LEARNED'
                  ? 'bg-[#4F806A] text-white border-[#4F806A]'
                  : 'text-[#4F806A] border-transparent hover:bg-[#E6F0EA]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  statusFilter === 'LEARNED' ? 'bg-white' : 'bg-[#4F806A]'
                }`}
              />
              {levelStats.learnedCount} Öğrendim
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'LEARNING' ? 'ALL' : 'LEARNING')}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer border ${
                statusFilter === 'LEARNING'
                  ? 'bg-[#B97922] text-white border-[#B97922]'
                  : 'text-[#B97922] border-transparent hover:bg-[#F7EEDF]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  statusFilter === 'LEARNING' ? 'bg-white' : 'bg-[#B97922]'
                }`}
              />
              {levelStats.learningCount} Tekrar Et
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'UNSEEN' ? 'ALL' : 'UNSEEN')}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer border ${
                statusFilter === 'UNSEEN'
                  ? 'bg-[#687080] text-white border-[#687080]'
                  : 'text-[#8E95A2] border-transparent hover:bg-[#F1EFE8]'
              }`}
            >
              {levelStats.unseenCount} İncelenmedi
            </button>
          </div>
        </div>

        {/* Arama, tür ve durum */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8E95A2] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Kelime ara..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:outline-none focus:bg-[#FFFFFF] focus:border-[#4F46A5] focus:ring-1 focus:ring-[#4F46A5] font-medium text-[#1E2430] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E95A2] hover:text-[#1E2430]"
                aria-label="Aramayı temizle"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={partOfSpeechFilter}
            onChange={e => setPartOfSpeechFilter(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:outline-none focus:bg-[#FFFFFF] focus:border-[#4F46A5] focus:ring-1 focus:ring-[#4F46A5] font-medium text-[#1E2430]"
          >
            <option value="ALL">Tüm Sözcük Türleri</option>
            <option value="n.">İsimler (n.)</option>
            <option value="v.">Fiiller (v.)</option>
            <option value="adj.">Sıfatlar (adj.)</option>
            <option value="adv.">Zarflar (adv.)</option>
            <option value="prep.">Edatlar (prep.)</option>
            <option value="conj.">Bağlaçlar (conj.)</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full py-2 px-3 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:outline-none focus:bg-[#FFFFFF] focus:border-[#4F46A5] focus:ring-1 focus:ring-[#4F46A5] font-medium text-[#1E2430]"
          >
            <option value="ALL">Tümü</option>
            <option value="LEARNED">✓ Öğrendiklerim</option>
            <option value="LEARNING">↻ Tekrar Etmem Gerekenler</option>
            <option value="UNSEEN">İncelenmedi</option>
            <option value="FAVORITES">♥ Favorilerim</option>
          </select>
        </div>
      </div>

      {/* Kartlarla çalış */}
      {filteredWords.length > 0 && (
        <button
          type="button"
          onClick={() => setIsStudyingFlashcards(true)}
          className="w-full p-4 sm:p-5 bg-[#EEECFA] hover:bg-[#E3DFF7] border-2 border-[#D7D2F4] hover:border-[#4F46A5] rounded-2xl transition-all cursor-pointer text-left flex items-center justify-between group shadow-xs active:scale-[0.99]"
        >
          <div className="space-y-0.5">
            <div className="text-base sm:text-lg font-bold text-[#1E2430] group-hover:text-[#4F46A5] flex items-center gap-2">
              <span>Kartlarla Çalış</span>
              <span className="text-[#4F46A5]">→</span>
            </div>
            <p className="text-xs text-[#687080] font-medium">
              Şimdi çalışmaya başla ({filteredWords.length} kelime)
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#4F46A5] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </button>
      )}

      {/* Kelime listesi */}
      {filteredWords.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {visibleWords.map(word => (
              <WordCardComponent
                key={word.id}
                card={word}
                isFavorite={favorites.includes(word.id)}
                learningState={learningStates[word.id]}
                onToggleFavorite={onToggleFavorite}
                onToggleLearned={onToggleLearned}
                onSetStatus={onSetStatus}
                onOpenAddToCollection={onOpenAddToCollection}
              />
            ))}
          </div>

          {visibleCount < filteredWords.length && (
            <button
              type="button"
              onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
              className="w-full py-3 bg-[#FFFFFF] hover:bg-[#F1EFE8] text-[#4F46A5] border border-[#E4E1D9] font-semibold text-xs rounded-2xl transition-colors cursor-pointer"
            >
              Daha fazla göster ({filteredWords.length - visibleCount} kelime kaldı)
            </button>
          )}
        </>
      ) : (
        <div className="text-center py-16 bg-[#FFFFFF] rounded-2xl border border-[#E4E1D9] space-y-3">
          <BookOpen className="w-8 h-8 text-[#8E95A2] mx-auto" />
          <h3 className="text-base font-bold text-[#1E2430]">Eşleşen kelime bulunamadı</h3>
          <p className="text-xs text-[#687080] max-w-sm mx-auto">
            Arama kriterlerinizi veya filtreleri temizleyerek tüm kelimeleri görebilirsiniz.
          </p>
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-[#F1EFE8] hover:bg-[#EEECFA] text-[#4F46A5] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Filtreleri Temizle
          </button>
        </div>
      )}
    </div>
  );
};
