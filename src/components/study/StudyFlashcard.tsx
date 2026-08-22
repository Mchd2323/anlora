import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WordCard, LearningState } from '../../types';
import {
  Volume2,
  Heart,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Sparkles,
  Layers,
  BookOpen,
  BookmarkPlus,
  Edit2,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { speakText } from '../../utils/speech';
import { CEFRBadge } from '../ui/CEFRBadge';
import { WordStatusActions } from '../ui/WordStatusActions';
import { getUserWordStatus } from '../../utils/storageV2';

export interface StudyFlashcardProps {
  title: string;
  sourceContextName?: string;
  words: WordCard[];
  favorites: string[];
  learningStates: Record<string, LearningState>;
  onToggleFavorite: (id: string) => void;
  onSetStatus: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
  onBack: () => void;
  onOpenEditCard?: (card: WordCard) => void;
  onDeleteCard?: (id: string) => void;
  onOpenAddToCollection?: (card: WordCard) => void;
  isCustomDeck?: boolean;
}

type FilterMode = 'ALL' | 'LEARNED' | 'LEARNING';

export const StudyFlashcard: React.FC<StudyFlashcardProps> = ({
  title,
  sourceContextName,
  words,
  favorites,
  learningStates,
  onToggleFavorite,
  onSetStatus,
  onBack,
  onOpenEditCard,
  onDeleteCard,
  onOpenAddToCollection,
  isCustomDeck = false
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMeaningRevealed, setIsMeaningRevealed] = useState(false);
  const [isExamplesExpanded, setIsExamplesExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Touch swipe handling
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  // Filtered word list
  const activeWordList = useMemo(() => {
    if (filterMode === 'ALL') return words;
    if (filterMode === 'LEARNED') {
      return words.filter((w) => getUserWordStatus(w.id, learningStates) === 'learned');
    }
    if (filterMode === 'LEARNING') {
      return words.filter((w) => getUserWordStatus(w.id, learningStates) === 'learning');
    }
    return words;
  }, [words, filterMode, learningStates]);

  // Adjust current index if out of bounds after filtering
  useEffect(() => {
    if (currentIndex >= activeWordList.length && activeWordList.length > 0) {
      setCurrentIndex(activeWordList.length - 1);
    }
  }, [activeWordList.length, currentIndex]);

  // Reset reveal state whenever the active card changes
  const currentCard: WordCard | undefined = activeWordList[currentIndex] || activeWordList[0];

  useEffect(() => {
    setIsMeaningRevealed(false);
    setIsExamplesExpanded(false);
    setIsMenuOpen(false);
  }, [currentCard?.id]);

  const handleNextCard = useCallback(() => {
    if (currentIndex < activeWordList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, activeWordList.length]);

  const handlePrevCard = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  // Keyboard navigation (Left / Right arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextCard();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevCard();
      } else if (e.key === ' ' || e.key === 'Enter') {
        // Space or enter to toggle reveal
        if (target.tagName !== 'BUTTON') {
          e.preventDefault();
          setIsMeaningRevealed((prev) => !prev);
        }
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextCard, handlePrevCard, isFullscreen]);

  // Touch swipe gestures (pure horizontal navigation, does not alter status)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;

    // Check if horizontal swipe is prominent and not a vertical scroll
    if (Math.abs(diffX) > 48 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX > 0) {
        // Swiped Left -> Next card
        handleNextCard();
      } else {
        // Swiped Right -> Previous card
        handlePrevCard();
      }
    }

    setTouchStartX(null);
    setTouchStartY(null);
  };

  const handlePlayAudio = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!currentCard) return;
    setIsPlayingAudio(true);
    speakText(currentCard.word);
    setTimeout(() => setIsPlayingAudio(false), 900);
  };

  // Status computation
  const currentStatus = currentCard
    ? getUserWordStatus(currentCard.id, learningStates)
    : 'unseen';

  const isFavorite = currentCard ? favorites.includes(currentCard.id) : false;

  // Counts for filter bar
  const counts = useMemo(() => {
    let learned = 0;
    let learning = 0;
    words.forEach((w) => {
      const st = getUserWordStatus(w.id, learningStates);
      if (st === 'learned') learned++;
      else if (st === 'learning') learning++;
    });
    return {
      all: words.length,
      learned,
      learning
    };
  }, [words, learningStates]);

  // If no words exist at all
  if (words.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4 animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-[#EEECFA] text-[#4F46A5] flex items-center justify-center mx-auto border border-[#D7D2F4]">
          <BookOpen className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[#1E2430]">{title}</h2>
        <p className="text-xs text-[#687080]">Bu grupta henüz çalışılacak kelime bulunmuyor.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-[#F8F7F3] text-[#1E2430] border border-[#E4E1D9] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[#F1EFE8]"
        >
          {sourceContextName ? `← ${sourceContextName}` : 'Geri Dön'}
        </button>
      </div>
    );
  }

  // If filtered list is empty
  if (activeWordList.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4 animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-[#F8F7F3] text-[#687080] flex items-center justify-center mx-auto border border-[#E4E1D9]">
          <Layers className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#1E2430]">
          {filterMode === 'LEARNED' ? 'Öğrenilen Kelime Yok' : 'Tekrar Edilecek Kelime Yok'}
        </h3>
        <p className="text-xs text-[#687080]">
          {filterMode === 'LEARNED'
            ? 'Bu grupta henüz "Öğrendim" olarak işaretlediğin kelime bulunmuyor.'
            : 'Bu grupta henüz "Tekrar Et" listesine eklediğin kelime bulunmuyor.'}
        </p>
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setFilterMode('ALL')}
            className="px-4 py-2 bg-[#4F46A5] text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-[#433B91]"
          >
            Tüm Kelimeleri Göster ({words.length})
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-[#F8F7F3] text-[#1E2430] border border-[#E4E1D9] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[#F1EFE8]"
          >
            Geri
          </button>
        </div>
      </div>
    );
  }

  const examples = currentCard?.examples || [];
  const progressPercent = Math.round(((currentIndex + 1) / activeWordList.length) * 100);

  return (
    <div
      className={`animate-fadeIn ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#F8FAFC] p-4 sm:p-6 overflow-y-auto flex flex-col justify-between'
          : 'max-w-2xl mx-auto space-y-4 pb-16'
      }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. TOP HEADER & NAVIGATION BAR */}
      <div className="bg-[#FFFFFF] p-3 sm:p-4 rounded-2xl border border-[#E4E1D9] shadow-xs flex items-center justify-between gap-3">
        {/* Context-aware Back Button */}
        <button
          onClick={isFullscreen ? () => setIsFullscreen(false) : onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-xs font-bold text-[#1E2430] rounded-xl border border-[#E4E1D9] transition-colors cursor-pointer shrink-0"
          title={sourceContextName || 'Geri'}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="max-w-[130px] sm:max-w-[200px] truncate">
            {isFullscreen ? 'Tam Ekrandan Çık' : sourceContextName ? `← ${sourceContextName}` : '← Geri'}
          </span>
        </button>

        {/* Center Progress Counter & Bar */}
        <div className="flex-1 max-w-[220px] sm:max-w-xs text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#1E2430]">
            <span className="truncate max-w-[120px]">{title}</span>
            <span className="text-[#8E95A2]">·</span>
            <span className="font-mono text-[#4F46A5]">
              {currentIndex + 1} / {activeWordList.length}
            </span>
          </div>
          <div className="w-full bg-[#F8F7F3] h-1.5 rounded-full overflow-hidden border border-[#EFECE6]">
            <div
              className="bg-[#4F46A5] h-full rounded-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Fullscreen Mode Toggle */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shrink-0 ${
            isFullscreen
              ? 'bg-[#EEECFA] text-[#4F46A5] border-[#D7D2F4]'
              : 'bg-[#F8F7F3] hover:bg-[#F1EFE8] text-[#687080] border-[#E4E1D9]'
          }`}
          title={isFullscreen ? 'Tam Ekrandan Çık (Esc)' : 'Tam Ekran Modu'}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Küçült</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tam Ekran</span>
            </>
          )}
        </button>
      </div>

      {/* 2. FILTER SEGMENTS (Hidden in Fullscreen to keep zero distraction) */}
      {!isFullscreen && (
        <div className="flex items-center justify-center gap-1.5 p-1 bg-[#FFFFFF] rounded-xl border border-[#E4E1D9] shadow-2xs">
          <button
            onClick={() => {
              setFilterMode('ALL');
              setCurrentIndex(0);
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
              filterMode === 'ALL'
                ? 'bg-[#EEECFA] text-[#4F46A5] font-bold shadow-xs'
                : 'text-[#687080] hover:text-[#1E2430]'
            }`}
          >
            Tümü ({counts.all})
          </button>
          <button
            onClick={() => {
              setFilterMode('LEARNED');
              setCurrentIndex(0);
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
              filterMode === 'LEARNED'
                ? 'bg-[#E9F3ED] text-[#35654E] font-bold shadow-xs'
                : 'text-[#687080] hover:text-[#35654E]'
            }`}
          >
            Öğrendiklerim ({counts.learned})
          </button>
          <button
            onClick={() => {
              setFilterMode('LEARNING');
              setCurrentIndex(0);
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
              filterMode === 'LEARNING'
                ? 'bg-[#FBF1DE] text-[#8A5A18] font-bold shadow-xs'
                : 'text-[#687080] hover:text-[#8A5A18]'
            }`}
          >
            Tekrar Etmem Gerekenler ({counts.learning})
          </button>
        </div>
      )}

      {/* 3. MAIN STUDY FLASHCARD COMPONENT */}
      <div className="relative w-full">
        {currentCard && (
          <div className="bg-[#FFFFFF] rounded-2xl border border-[#E4E1D9] shadow-[0_4px_24px_rgba(30,36,48,0.06)] p-6 sm:p-8 flex flex-col justify-between min-h-[380px] sm:min-h-[420px] transition-all relative overflow-hidden">
            {/* Top Card Bar: Tags, Audio & Actions */}
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#EFECE6]">
              <div className="flex flex-wrap items-center gap-2">
                {/* CEFR Badge ONLY if Oxford */}
                {!currentCard.isCustom && currentCard.sourceType !== 'custom' && currentCard.level && (
                  <CEFRBadge level={currentCard.level} size="sm" />
                )}
                {currentCard.partOfSpeech && (
                  <span className="text-xs font-semibold px-2.5 py-1 bg-[#F8F7F3] border border-[#E4E1D9] rounded-lg text-[#687080]">
                    {currentCard.partOfSpeech}
                  </span>
                )}
                {currentCard.isCustom && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[#F1EFE8] text-[#1E2430] border border-[#E4E1D9] rounded-md">
                    <Sparkles className="w-2.5 h-2.5 text-[#4F46A5]" /> Özel
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Pronunciation Audio Button */}
                <button
                  onClick={handlePlayAudio}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    isPlayingAudio
                      ? 'bg-[#4F46A5] text-white border-[#4F46A5] scale-105 shadow-xs'
                      : 'bg-[#F8F7F3] hover:bg-[#EEECFA] text-[#4F46A5] border-[#E4E1D9]'
                  }`}
                  title="Telaffuz Dinle"
                  aria-label="Telaffuz Dinle"
                >
                  <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
                </button>

                {/* Favorite Heart */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(currentCard.id);
                  }}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    isFavorite
                      ? 'bg-[#FAECEA] text-[#D96B82] border-[#E8C2BD]'
                      : 'bg-[#F8F7F3] hover:bg-[#FAECEA] text-[#8E95A2] hover:text-[#D96B82] border-[#E4E1D9]'
                  }`}
                  title={isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                  aria-label="Favori"
                >
                  <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                </button>

                {/* 3-Dots Menu if applicable */}
                {(isCustomDeck || onOpenEditCard || onDeleteCard || onOpenAddToCollection) && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMenuOpen(!isMenuOpen);
                      }}
                      className="p-2 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-[#8E95A2] hover:text-[#1E2430] rounded-xl border border-[#E4E1D9] transition-colors cursor-pointer"
                      aria-label="Seçenekler"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-full mt-1.5 w-44 bg-[#FFFFFF] rounded-xl border border-[#E4E1D9] shadow-lg py-1.5 z-30 space-y-0.5 animate-fadeIn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {onOpenAddToCollection && (
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              onOpenAddToCollection(currentCard);
                            }}
                            className="w-full px-3 py-1.5 text-xs text-left text-[#1E2430] hover:bg-[#F8F7F3] flex items-center gap-2 cursor-pointer"
                          >
                            <BookmarkPlus className="w-3.5 h-3.5 text-[#4F46A5]" />
                            <span>Sete Ekle</span>
                          </button>
                        )}

                        {currentCard.isCustom && onOpenEditCard && (
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              onOpenEditCard(currentCard);
                            }}
                            className="w-full px-3 py-1.5 text-xs text-left text-[#1E2430] hover:bg-[#F8F7F3] flex items-center gap-2 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-[#687080]" />
                            <span>Kartı Düzenle</span>
                          </button>
                        )}

                        {currentCard.isCustom && onDeleteCard && (
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              if (confirm(`"${currentCard.word}" kartını silmek istediğinize emin misiniz?`)) {
                                onDeleteCard(currentCard.id);
                              }
                            }}
                            className="w-full px-3 py-1.5 text-xs text-left text-[#C65D55] hover:bg-[#FAECEA] flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Kartı Sil</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Center Area: English Word & Turkish Meaning Reveal */}
            <div className="flex-1 flex flex-col justify-center items-center text-center py-6 sm:py-8 space-y-4">
              <div
                onClick={() => setIsMeaningRevealed(!isMeaningRevealed)}
                className="cursor-pointer group flex flex-col items-center gap-1.5 transition-transform active:scale-[0.98] select-none"
              >
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#1E2430] tracking-tight group-hover:text-[#4F46A5] transition-colors">
                  {currentCard.word}
                </h2>
                {currentCard.phonetic && (
                  <span className="text-xs sm:text-sm font-mono text-[#8E95A2]">
                    /{currentCard.phonetic}/
                  </span>
                )}

                {/* Prompt hint */}
                {!isMeaningRevealed && (
                  <div className="mt-4 px-4 py-2 bg-[#F8F7F3] group-hover:bg-[#EEECFA] text-[#8E95A2] group-hover:text-[#4F46A5] rounded-full text-xs font-semibold border border-[#E4E1D9] transition-all flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#4F46A5]" />
                    <span>Anlamı görmek için dokun</span>
                  </div>
                )}
              </div>

              {/* Revealed State: Turkish Meaning */}
              {isMeaningRevealed && (
                <div className="w-full space-y-4 pt-2 animate-fadeIn">
                  <div className="p-4 sm:p-5 bg-[#FDFBF7] rounded-xl border border-[#E4E1D9] text-center space-y-1">
                    <span className="text-[11px] font-bold text-[#8E95A2] uppercase tracking-wider block">
                      Türkçe Anlamı
                    </span>
                    <p className="text-lg sm:text-2xl font-bold text-[#1E2430]">
                      {currentCard.turkishMeaning}
                    </p>
                    {currentCard.contextualMeaning && currentCard.contextualMeaning !== currentCard.turkishMeaning && (
                      <p className="text-xs text-[#4F46A5] font-medium pt-1">
                        Bağlam anlamı: {currentCard.contextualMeaning}
                      </p>
                    )}
                  </div>

                  {/* Example Sentences Accordion */}
                  {examples.length > 0 && (
                    <div className="w-full text-left">
                      <button
                        onClick={() => setIsExamplesExpanded(!isExamplesExpanded)}
                        className="w-full px-4 py-2.5 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-xs font-semibold text-[#1E2430] rounded-xl border border-[#E4E1D9] flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-[#4F46A5]" />
                          <span>Örnek Cümleler ({examples.length})</span>
                        </span>
                        {isExamplesExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#687080]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#687080]" />
                        )}
                      </button>

                      {isExamplesExpanded && (
                        <div className="mt-2 space-y-2.5 p-3.5 bg-[#FDFBF7] rounded-xl border border-[#E4E1D9] text-xs animate-fadeIn">
                          {examples.map((ex, idx) => (
                            <div
                              key={idx}
                              className="space-y-1 border-b border-[#EFECE6] last:border-0 pb-2.5 last:pb-0"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-medium text-[#1E2430] leading-relaxed">
                                  <strong className="text-[#4F46A5] mr-1">{idx + 1}.</strong> {ex.en}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speakText(ex.en);
                                  }}
                                  className="p-1 text-[#8E95A2] hover:text-[#4F46A5] rounded transition-colors shrink-0 cursor-pointer"
                                  title="Cümleyi Dinle"
                                >
                                  <Volume2 className="w-3 h-3" />
                                </button>
                              </div>
                              <p className="text-[#687080] text-[11px] italic pl-2.5 border-l-2 border-[#D7D2F4]">
                                "{ex.tr}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Bar: WordStatusActions [ ↻ Tekrar Et ] [ ✓ Öğrendim ] */}
            <div className="pt-4 border-t border-[#EFECE6]">
              <WordStatusActions
                status={currentStatus}
                onSetStatus={(st) => onSetStatus(currentCard.id, st)}
                size="md"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. BOTTOM NAVIGATION CONTROLS */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          onClick={handlePrevCard}
          disabled={currentIndex === 0}
          className="flex-1 py-3 px-4 bg-[#FFFFFF] hover:bg-[#F8F7F3] disabled:opacity-40 text-[#1E2430] font-bold text-xs rounded-xl border border-[#E4E1D9] shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Önceki Kelime</span>
        </button>

        <button
          onClick={handleNextCard}
          disabled={currentIndex === activeWordList.length - 1}
          className="flex-1 py-3 px-4 bg-[#4F46A5] hover:bg-[#433B91] disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
        >
          <span>Sonraki Kelime</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop Keyboard Tip */}
      {!isFullscreen && (
        <p className="text-[11px] text-center text-[#8E95A2] hidden sm:block">
          İpucu: Kartlar arasında geçiş yapmak için klavyedeki <kbd className="px-1.5 py-0.5 bg-[#FFFFFF] border border-[#E4E1D9] rounded text-[10px] font-mono">←</kbd> ve <kbd className="px-1.5 py-0.5 bg-[#FFFFFF] border border-[#E4E1D9] rounded text-[10px] font-mono">→</kbd> ok tuşlarını kullanabilirsin.
        </p>
      )}
    </div>
  );
};
