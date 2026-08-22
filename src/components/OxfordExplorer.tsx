import React, { useState, useMemo } from 'react';
import { WordCard, Level, LearningState } from '../types';
import { OxfordGroupKey } from '../types/oxford';
import { WordCardComponent } from './WordCard';
import { StudyFlashcard } from './study/StudyFlashcard';
import {
  Search,
  Volume2,
  BookOpen,
  Play,
  BrainCircuit,
  X,
  Sparkles,
  Layers
} from 'lucide-react';
import { speakText } from '../utils/speech';
import { getUserWordStatus } from '../utils/storageV2';
import { CEFRBadge } from './ui/CEFRBadge';

export type OxfordCollectionType = 'oxford3000' | 'oxford5000_extra';

interface OxfordExplorerProps {
  words: WordCard[]; // Oxford 3000 words
  extraWords?: WordCard[]; // Oxford 5000 Extra words
  favorites: string[];
  learned: string[];
  learningStates?: Record<string, LearningState>;
  selectedLevel: Level | 'ALL' | OxfordGroupKey;
  setSelectedLevel: (lvl: any) => void;
  selectedCollectionGroup?: OxfordCollectionType;
  onSelectCollectionGroup?: (group: OxfordCollectionType) => void;
  onToggleFavorite: (id: string) => void;
  onToggleLearned?: (id: string) => void;
  onSetStatus?: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
  onOpenAddToCollection?: (card: WordCard) => void;
  onStartStudy?: (cards: WordCard[]) => void;
  onStartQuiz?: (cards: WordCard[]) => void;
}

export const OxfordExplorer: React.FC<OxfordExplorerProps> = ({
  words = [],
  extraWords = [],
  favorites = [],
  learned,
  learningStates = {},
  selectedLevel,
  setSelectedLevel,
  selectedCollectionGroup: externalGroup,
  onSelectCollectionGroup,
  onToggleFavorite,
  onToggleLearned,
  onSetStatus,
  onOpenAddToCollection,
  onStartStudy,
  onStartQuiz
}) => {
  const [internalGroup, setInternalGroup] = useState<OxfordCollectionType>('oxford3000');
  const activeGroup = externalGroup || internalGroup;

  const setActiveGroup = (grp: OxfordCollectionType) => {
    if (onSelectCollectionGroup) {
      onSelectCollectionGroup(grp);
    } else {
      setInternalGroup(grp);
    }
    if (grp === 'oxford5000_extra') {
      setSelectedLevel('B2_EK');
    } else {
      setSelectedLevel('ALL');
    }
  };

  const [isStudyingFlashcards, setIsStudyingFlashcards] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [partOfSpeechFilter, setPartOfSpeechFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LEARNED' | 'LEARNING' | 'UNSEEN' | 'FAVORITES'>('ALL');

  // Active pool of words based on selected group
  const currentPool = useMemo(() => {
    return activeGroup === 'oxford5000_extra' ? extraWords : words;
  }, [activeGroup, words, extraWords]);

  const oxford3000Levels: (Level | 'ALL')[] = ['ALL', 'A1', 'A2', 'B1', 'B2'];
  const extraLevels: OxfordGroupKey[] = ['B2_EK', 'C1'];

  // Sayılar veriden okunur; arayüzde sabit sayı yazılmaz (talimat 24).
  // Aynı yüzey kelimesinin farklı sözcük türü kayıtları olabildiği için
  // kayıt sayısı ile benzersiz kelime sayısı aynı olmayabilir.
  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: words.length,
      A1: 0,
      A2: 0,
      B1: 0,
      B2: 0,
      B2_EK: 0,
      C1: 0
    };
    words.forEach((card) => {
      if (card.level && counts[card.level] !== undefined) {
        counts[card.level]++;
      }
    });
    extraWords.forEach((card) => {
      // B2 Ek ile Oxford 3000 B2 karıştırılmaz: bu havuzdaki B2 kayıtları
      // kaynak grubu farklı olduğu için ayrı sayılır.
      if (card.level === 'C1') counts.C1++;
      else counts.B2_EK++;
    });
    return counts;
  }, [words, extraWords]);

  const levelStats = useMemo(() => {
    let levelWords: WordCard[] = [];
    if (activeGroup === 'oxford5000_extra') {
      levelWords = extraWords.filter(
        (w) => (w.level === 'C1' ? 'C1' : 'B2_EK') === selectedLevel
      );
    } else {
      levelWords = selectedLevel === 'ALL' ? words : words.filter((w) => w.level === selectedLevel);
    }

    let learnedCount = 0;
    let learningCount = 0;
    let unseenCount = 0;

    levelWords.forEach((w) => {
      const st = getUserWordStatus(w.id, learningStates);
      if (st === 'learned') learnedCount++;
      else if (st === 'learning') learningCount++;
      else unseenCount++;
    });

    return {
      total: levelWords.length,
      learnedCount,
      learningCount,
      unseenCount
    };
  }, [activeGroup, words, extraWords, selectedLevel, learningStates]);

  const filteredWords = useMemo(() => {
    return currentPool.filter((card) => {
      if (activeGroup === 'oxford5000_extra') {
        // B2 Ek / C1 ayrımı
        const cardGroup = card.level === 'C1' ? 'C1' : 'B2_EK';
        if (selectedLevel !== cardGroup) return false;
      }
      if (activeGroup === 'oxford3000' && selectedLevel !== 'ALL' && card.level !== selectedLevel) {
        return false;
      }
      if (
        partOfSpeechFilter !== 'ALL' &&
        !card.partOfSpeech.toLowerCase().includes(partOfSpeechFilter.toLowerCase())
      ) {
        return false;
      }

      const st = getUserWordStatus(card.id, learningStates);
      const isCardFav = favorites.includes(card.id);

      if (statusFilter === 'LEARNED' && st !== 'learned') return false;
      if (statusFilter === 'LEARNING' && st !== 'learning') return false;
      if (statusFilter === 'UNSEEN' && st !== 'unseen') return false;
      if (statusFilter === 'FAVORITES' && !isCardFav) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesWord = card.word.toLowerCase().includes(query);
        const matchesMeaning = card.turkishMeaning.toLowerCase().includes(query);
        return matchesWord || matchesMeaning;
      }

      return true;
    });
  }, [currentPool, activeGroup, selectedLevel, partOfSpeechFilter, statusFilter, searchQuery, favorites, learningStates]);

  const handlePlayAllWordsInList = () => {
    if (filteredWords.length === 0) return;
    const wordsToPlay = filteredWords
      .slice(0, 10)
      .map((w) => `${w.word}. ${w.turkishMeaning}`)
      .join('. ');
    speakText(wordsToPlay);
  };

  // If user is currently in Flashcard Study Mode
  if (isStudyingFlashcards) {
    const studyTitle =
      activeGroup === 'oxford5000_extra'
        ? `Oxford 5000 – Ek (${selectedLevel === 'C1' ? 'C1' : 'B2 Ek'})`
        : selectedLevel === 'ALL'
        ? 'Oxford 3000'
        : `Oxford 3000 (${selectedLevel})`;

    const sourceContext =
      activeGroup === 'oxford5000_extra'
        ? `Oxford 5000 Ek (${selectedLevel === 'C1' ? 'C1' : 'B2 Ek'})`
        : selectedLevel === 'ALL'
        ? 'Oxford 3000'
        : `${selectedLevel} Kelimeleri`;

    return (
      <StudyFlashcard
        title={studyTitle}
        sourceContextName={sourceContext}
        words={filteredWords.length > 0 ? filteredWords : currentPool}
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
    <div className="space-y-6 pb-16 max-w-[1180px] mx-auto animate-fadeIn">
      {/* Group Switcher Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FFFFFF] p-2 sm:p-2.5 rounded-2xl border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        <div className="grid grid-cols-2 gap-2 flex-1 max-w-md">
          <button
            type="button"
            onClick={() => setActiveGroup('oxford3000')}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeGroup === 'oxford3000'
                ? 'bg-[#4F46A5] text-white shadow-xs'
                : 'text-[#687080] hover:text-[#1E2430] hover:bg-[#F8F7F3]'
            }`}
          >
            <span>Oxford 3000</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[11px] font-bold ${
                activeGroup === 'oxford3000' ? 'bg-white/20 text-white' : 'bg-[#E4E1D9] text-[#687080]'
              }`}
            >
              {words.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveGroup('oxford5000_extra')}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeGroup === 'oxford5000_extra'
                ? 'bg-[#593E91] text-white shadow-xs'
                : 'text-[#687080] hover:text-[#1E2430] hover:bg-[#F8F7F3]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#F5C243]" />
            <span>Oxford 5000 – Ek</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[11px] font-bold ${
                activeGroup === 'oxford5000_extra' ? 'bg-white/20 text-white' : 'bg-[#E4E1D9] text-[#687080]'
              }`}
            >
              {extraWords.length}
            </span>
          </button>
        </div>

        <div className="text-[11px] sm:text-xs text-[#8E95A2] font-medium px-3 text-center sm:text-right">
          {activeGroup === 'oxford3000'
            ? 'Temel A1–B2 kelimeleri'
            : 'B2–C1 için yaklaşık 2000 ileri kelime'}
        </div>
      </div>

      {/* Title & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFFFF] p-6 rounded-2xl border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1E2430]">
              {activeGroup === 'oxford5000_extra' ? 'Oxford 5000 – Ek Kelimeler' : 'Oxford 3000'}
            </h2>
            {activeGroup === 'oxford5000_extra' ? (
              <CEFRBadge level={selectedLevel === 'C1' ? 'C1' : 'B2 EK'} />
            ) : (
              selectedLevel !== 'ALL' && <CEFRBadge level={selectedLevel} />
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#687080] mt-1">
            {activeGroup === 'oxford5000_extra'
              ? 'B2–C1 için yaklaşık 2000 ileri kelime.'
              : 'Temel A1–B2 kelimeleri.'}
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

      {/* Filter Bar */}
      <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E4E1D9] space-y-4 shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        {/* CEFR Level Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {activeGroup === 'oxford3000' ? (
            oxford3000Levels.map((lvl) => {
              const isSelected = selectedLevel === lvl;
              const count = lvl === 'ALL' ? levelCounts.ALL : levelCounts[lvl] || 0;
              return (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-[#4F46A5] text-white border-[#4F46A5] shadow-xs'
                      : 'bg-[#F8F7F3] text-[#1E2430] border-[#E4E1D9] hover:bg-[#F1EFE8]'
                  }`}
                >
                  <span>{lvl === 'ALL' ? 'Tümü' : lvl}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#E4E1D9] text-[#687080]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })
          ) : (
            /*
             * Oxford 5000 Ek grubu: B2 Ek ve C1.
             *
             * Bu bölüm önceden yalnızca B2 Ek gösteriyor, C1'i "Yakında"
             * etiketiyle devre dışı bir düğme olarak sunuyordu. C1 verisi
             * resmî kaynaktan eklendiği için artık gerçek bir seviyedir.
             * Sayılar sabit yazılmaz, veri kümesinden okunur (talimat 24).
             */
            extraLevels.map((lvl) => {
              const isSelected = selectedLevel === lvl;
              const count = levelCounts[lvl] || 0;
              return (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-[#593E91] text-white border-[#593E91] shadow-xs'
                      : 'bg-[#F8F7F3] text-[#1E2430] border-[#E4E1D9] hover:bg-[#F1EFE8]'
                  }`}
                >
                  <span>{lvl === 'B2_EK' ? 'B2 Ek' : 'C1'}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#E4E1D9] text-[#687080]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Level Stats Summary Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9] text-xs">
          <div className="text-[#687080] font-medium">
            Toplam <strong className="text-[#1E2430]">{levelStats.total}</strong> kelime içinde:
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[#4F806A] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#4F806A]" />
              {levelStats.learnedCount} Öğrendim
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#B97922] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#B97922]" />
              {levelStats.learningCount} Tekrar Et
            </span>
            <span className="text-[#8E95A2]">{levelStats.unseenCount} İncelenmedi</span>
          </div>
        </div>

        {/* Search, POS and Status Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#8E95A2] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kelime ara..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:outline-none focus:bg-[#FFFFFF] focus:border-[#4F46A5] focus:ring-1 focus:ring-[#4F46A5] font-medium text-[#1E2430] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E95A2] hover:text-[#1E2430]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Part of Speech */}
          <div className="flex items-center gap-2">
            <select
              value={partOfSpeechFilter}
              onChange={(e) => setPartOfSpeechFilter(e.target.value)}
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
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
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
      </div>

      {/* Prominent Flashcard Study Mode CTA Card */}
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

      {/* Words Grid */}
      {filteredWords.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredWords.map((word) => (
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
      ) : (
        <div className="text-center py-16 bg-[#FFFFFF] rounded-2xl border border-[#E4E1D9] space-y-3">
          <BookOpen className="w-8 h-8 text-[#8E95A2] mx-auto" />
          <h3 className="text-base font-bold text-[#1E2430]">
            Eşleşen kelime bulunamadı
          </h3>
          <p className="text-xs text-[#687080] max-w-sm mx-auto">
            Arama kriterlerinizi veya filtreleri temizleyerek tüm kelimeleri görebilirsiniz.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setPartOfSpeechFilter('ALL');
              setStatusFilter('ALL');
            }}
            className="px-4 py-2 bg-[#F1EFE8] hover:bg-[#EEECFA] text-[#4F46A5] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Filtreleri Temizle
          </button>
        </div>
      )}
    </div>
  );
};
