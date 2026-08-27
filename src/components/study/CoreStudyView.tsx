import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  WordCard,
  LearningState,
  Collection,
  CollectionMembership,
  Level
} from '../../types';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
  Play,
  RotateCcw,
  Shuffle,
  Layers,
  BookOpen,
  Plus,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { StudyCard } from './StudyCard';
import { WordListView } from './WordListView';
import { CEFRBadge } from '../ui/CEFRBadge';
import { getUserWordStatus } from '../../utils/storageV2';
import { shuffle } from '../../utils/random';

interface CoreStudyViewProps {
  title: string;
  sourceId: string;
  sourceType: 'oxford' | 'collection';
  level?: Level | 'ALL';
  words: WordCard[];
  favorites: string[];
  learningStates: Record<string, LearningState>;
  onToggleFavorite: (id: string) => void;
  onSetStatus: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
  onOpenEditCard?: (card: WordCard) => void;
  onDeleteCard?: (id: string) => void;
  onOpenAddToCollection?: (card: WordCard) => void;
  onOpenAddWordModal?: () => void;
  onExit: () => void;
}

export const CoreStudyView: React.FC<CoreStudyViewProps> = ({
  title,
  sourceId,
  sourceType,
  level,
  words,
  favorites,
  learningStates,
  onToggleFavorite,
  onSetStatus,
  onOpenEditCard,
  onDeleteCard,
  onOpenAddToCollection,
  onOpenAddWordModal,
  onExit
}) => {
  // Screen mode: 'overview' | 'study' | 'list'
  const [viewMode, setViewMode] = useState<'overview' | 'study' | 'list'>('overview');
  const [isShuffled, setIsShuffled] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Active word order list
  const activeWordList = useMemo(() => {
    if (!isShuffled) return words;
    return shuffle(words);
  }, [words, isShuffled]);

  // Persistent Progress Key
  const progressStorageKey = `anlora_study_progress_${sourceId}`;

  // Retrieve saved position
  const savedIndex = useMemo(() => {
    try {
      const saved = localStorage.getItem(progressStorageKey);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < words.length) {
          return parsed;
        }
      }
    } catch {
      // LocalStorage access fallback
    }
    return 0;
  }, [progressStorageKey, words.length]);

  // Save current progress
  const saveProgress = useCallback((idx: number) => {
    try {
      localStorage.setItem(progressStorageKey, idx.toString());
    } catch {
      // Fallback
    }
  }, [progressStorageKey]);

  // Navigate to Next / Previous Word
  const handleNextCard = useCallback(() => {
    if (currentIndex < activeWordList.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      saveProgress(nextIdx);
    }
  }, [currentIndex, activeWordList.length, saveProgress]);

  const handlePrevCard = useCallback(() => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      saveProgress(prevIdx);
    }
  }, [currentIndex, saveProgress]);

  // Touch Swipe Gesture Management with Vertical Scroll Lock
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;

    // Strict Angle Lock: Only trigger swipe if horizontal movement is greater than vertical movement
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 45) {
      if (diffX > 0) {
        // Swiped Left -> Next Card
        handleNextCard();
      } else {
        // Swiped Right -> Previous Card
        handlePrevCard();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Keyboard navigation on desktop
  useEffect(() => {
    if (viewMode !== 'study') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard: do not trigger when user is typing in input or textarea
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, handleNextCard, handlePrevCard]);

  // Stats calculation for overview
  const stats = useMemo(() => {
    let learnedCount = 0;
    let learningCount = 0;
    let unseenCount = 0;

    words.forEach((w) => {
      const st = getUserWordStatus(w.id, learningStates);
      if (st === 'learned') learnedCount++;
      else if (st === 'learning') learningCount++;
      else unseenCount++;
    });

    return {
      total: words.length,
      learnedCount,
      learningCount,
      unseenCount,
      percentLearned: words.length > 0 ? Math.round((learnedCount / words.length) * 100) : 0
    };
  }, [words, learningStates]);

  if (words.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4 animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center mx-auto border border-[var(--primary-border)]">
          <BookOpen className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
        <p className="text-xs text-[var(--text-secondary)]">Bu sette henüz kelime bulunmuyor.</p>
        <div className="flex justify-center gap-2 pt-2">
          {onOpenAddWordModal && (
            <button
              onClick={onOpenAddWordModal}
              className="px-4 py-2 bg-[var(--primary)] text-[var(--surface)] text-xs font-semibold rounded-xl cursor-pointer"
            >
              + İlk Kelimeyi Ekle
            </button>
          )}
          <button
            onClick={onExit}
            className="px-4 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-semibold rounded-xl cursor-pointer"
          >
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  // 1. "TÜM KELİMELER" LIST VIEW
  if (viewMode === 'list') {
    return (
      <WordListView
        title={title}
        words={words}
        favorites={favorites}
        learningStates={learningStates}
        onSelectWordIndex={(idx) => {
          setCurrentIndex(idx);
          saveProgress(idx);
          setViewMode('study');
        }}
        onBackToStudy={() => setViewMode('study')}
        onToggleFavorite={onToggleFavorite}
      />
    );
  }

  // 2. OVERVIEW / ENTRY SCREEN
  if (viewMode === 'overview') {
    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn pb-safe-nav">
        {/* Top bar */}
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--surface)] hover:bg-[var(--bg)] text-xs font-bold text-[var(--text-primary)] rounded-xl border border-[var(--border)] shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Geri Dön</span>
        </button>

        {/* Set / Level Summary Card */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-light)]">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                  {title}
                </h1>
                {level && level !== 'ALL' && <CEFRBadge level={level} />}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium">
                Toplam {words.length} kelime
              </p>
            </div>

            {savedIndex > 0 && (
              <div className="px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)] flex items-center gap-1.5 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                <span>Son çalışma: <b>{savedIndex + 1}</b> / {words.length}</span>
              </div>
            )}
          </div>

          {/* Quick Progress Stats */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="p-3.5 bg-[var(--learned-soft)]/70 rounded-xl border border-[var(--learned-border)] text-center space-y-0.5">
              <span className="text-[11px] font-bold text-[var(--learned)] uppercase tracking-wider block">
                Öğrendim
              </span>
              <span className="text-lg font-black text-[var(--text-primary)]">
                {stats.learnedCount}
              </span>
            </div>
            <div className="p-3.5 bg-[var(--learning-soft)]/70 rounded-xl border border-[var(--learning-border)] text-center space-y-0.5">
              <span className="text-[11px] font-bold text-[var(--learning)] uppercase tracking-wider block">
                Öğreniyorum
              </span>
              <span className="text-lg font-black text-[var(--text-primary)]">
                {stats.learningCount}
              </span>
            </div>
            <div className="p-3.5 bg-[var(--bg)] rounded-xl border border-[var(--border)] text-center space-y-0.5">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Henüz Bakılmadı
              </span>
              <span className="text-lg font-black text-[var(--text-primary)]">
                {stats.unseenCount}
              </span>
            </div>
          </div>

          {/* Shuffle vs Sequential Selector */}
          <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)] text-xs">
            <span className="font-semibold text-[var(--text-primary)]">Çalışma Sırası</span>
            <div className="flex gap-1">
              <button
                onClick={() => setIsShuffled(false)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  !isShuffled ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-2xs' : 'text-[var(--text-secondary)]'
                }`}
              >
                Sırayla
              </button>
              <button
                onClick={() => setIsShuffled(true)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  isShuffled ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-2xs' : 'text-[var(--text-secondary)]'
                }`}
              >
                <Shuffle className="w-3 h-3" />
                <span>Karışık</span>
              </button>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              onClick={() => {
                setCurrentIndex(savedIndex);
                setViewMode('study');
              }}
              className="flex-1 py-3 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--surface)] font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{savedIndex > 0 ? 'Kaldığın Yerden Devam Et' : 'Çalışmaya Başla'}</span>
            </button>

            {savedIndex > 0 && (
              <button
                onClick={() => {
                  setCurrentIndex(0);
                  saveProgress(0);
                  setViewMode('study');
                }}
                className="py-3 px-4 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] font-bold text-xs rounded-xl border border-[var(--border)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Baştan Başla</span>
              </button>
            )}

            <button
              onClick={() => setViewMode('list')}
              className="py-3 px-4 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] font-bold text-xs rounded-xl border border-[var(--border)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <List className="w-4 h-4" />
              <span>Tüm Kelimeler</span>
            </button>

            {onOpenAddWordModal && (
              <button
                onClick={onOpenAddWordModal}
                className="py-3 px-4 bg-[var(--primary-soft)] hover:bg-[var(--primary-soft-strong)] text-[var(--primary)] font-bold text-xs rounded-xl border border-[var(--primary-border)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Kelime Ekle</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. ACTIVE SINGLE CARD STUDY VIEW
  const currentCard = activeWordList[currentIndex] || activeWordList[0];
  const progressPercent = Math.round(((currentIndex + 1) / activeWordList.length) * 100);

  return (
    <div
      className="max-w-2xl mx-auto space-y-4 animate-fadeIn pb-safe-nav"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Study Navigation Header */}
      <div className="bg-[var(--surface)] p-3.5 sm:p-4 rounded-2xl border border-[var(--border)] shadow-xs flex items-center justify-between gap-3">
        <button
          onClick={() => setViewMode('overview')}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-xs font-bold text-[var(--text-primary)] rounded-xl border border-[var(--border)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Menü</span>
        </button>

        {/* Center Progress Text & Bar */}
        <div className="flex-1 max-w-xs text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
            <span>{title}</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="font-mono text-[var(--primary)]">{currentIndex + 1} / {activeWordList.length}</span>
          </div>
          <div className="w-full bg-[var(--bg)] h-1.5 rounded-full overflow-hidden border border-[var(--border-light)]">
            <div
              className="bg-[var(--primary)] h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Right Action: All Words */}
        <button
          onClick={() => setViewMode('list')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-xs font-bold text-[var(--text-primary)] rounded-xl border border-[var(--border)] transition-colors cursor-pointer"
        >
          <List className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span className="hidden sm:inline">Tüm Kelimeler</span>
        </button>
      </div>

      {/* Main Single Flashcard */}
      <div className="relative">
        <StudyCard
          card={currentCard}
          isFavorite={favorites.includes(currentCard.id)}
          learningState={learningStates[currentCard.id]}
          onToggleFavorite={onToggleFavorite}
          onSetStatus={onSetStatus}
          onOpenEdit={onOpenEditCard}
          onDelete={onDeleteCard}
          onOpenAddToCollection={onOpenAddToCollection}
          isCustomDeck={sourceType === 'collection'}
        />
      </div>

      {/* Bottom Navigation Controls */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          onClick={handlePrevCard}
          disabled={currentIndex === 0}
          className="flex-1 py-3 px-4 bg-[var(--surface)] hover:bg-[var(--bg)] disabled:opacity-40 text-[var(--text-primary)] font-bold text-xs rounded-xl border border-[var(--border)] shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Önceki Kelime</span>
        </button>

        <button
          onClick={handleNextCard}
          disabled={currentIndex === activeWordList.length - 1}
          className="flex-1 py-3 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-[var(--surface)] font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
        >
          <span>Sonraki Kelime</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop Keyboard Tip */}
      <p className="text-[11px] text-center text-[var(--text-muted)] hidden sm:block">
        İpucu: Kartlar arasında geçiş yapmak için klavyedeki <kbd className="px-1.5 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[10px] font-mono">←</kbd> ve <kbd className="px-1.5 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[10px] font-mono">→</kbd> ok tuşlarını kullanabilirsin.
      </p>
    </div>
  );
};
