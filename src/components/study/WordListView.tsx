import React, { useState, useMemo } from 'react';
import { WordCard, LearningState } from '../../types';
import {
  Search,
  ArrowLeft,
  CheckCircle2,
  RotateCw,
  Heart,
  Volume2,
  X,
  BookOpen
} from 'lucide-react';
import { CEFRBadge } from '../ui/CEFRBadge';
import { shouldShowCefr } from '../../types/oxford';
import { getUserWordStatus } from '../../utils/storageV2';
import { speakText } from '../../utils/speech';

interface WordListViewProps {
  title: string;
  words: WordCard[];
  favorites: string[];
  learningStates: Record<string, LearningState>;
  onSelectWordIndex: (index: number) => void;
  onBackToStudy: () => void;
  onToggleFavorite: (id: string) => void;
}

export const WordListView: React.FC<WordListViewProps> = ({
  title,
  words,
  favorites,
  learningStates,
  onSelectWordIndex,
  onBackToStudy,
  onToggleFavorite
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LEARNED' | 'LEARNING' | 'FAVORITES'>('ALL');

  // Filter words
  const filteredWordItems = useMemo(() => {
    return words.map((word, originalIndex) => ({ word, originalIndex })).filter(({ word }) => {
      const st = getUserWordStatus(word.id, learningStates);
      const isFav = favorites.includes(word.id);

      if (statusFilter === 'LEARNED' && st !== 'learned') return false;
      if (statusFilter === 'LEARNING' && st !== 'learning') return false;
      if (statusFilter === 'FAVORITES' && !isFav) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchWord = word.word.toLowerCase().includes(q);
        const matchMeaning = word.turkishMeaning.toLowerCase().includes(q);
        return matchWord || matchMeaning;
      }

      return true;
    });
  }, [words, searchQuery, statusFilter, favorites, learningStates]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto animate-fadeIn pb-safe-nav">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 bg-[var(--surface)] p-4 sm:p-5 rounded-2xl border border-[var(--border)] shadow-xs">
        <button
          onClick={onBackToStudy}
          className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-xs font-bold text-[var(--text-primary)] rounded-xl border border-[var(--border)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Karta Dön</span>
        </button>

        <div className="text-center">
          <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate max-w-[200px] sm:max-w-md">
            {title}
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Toplam {words.length} kelime
          </p>
        </div>

        <div className="w-16" />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kelimelerde veya anlamlarda ara..."
            className="w-full pl-10 pr-9 py-2.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] font-medium text-[var(--text-primary)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[var(--text-primary)] text-[var(--bg)] shadow-xs'
                : 'bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
            }`}
          >
            Tümü ({words.length})
          </button>
          <button
            onClick={() => setStatusFilter('LEARNING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'LEARNING'
                ? 'bg-[var(--learning-soft)] text-[var(--learning)] border border-[var(--learning-border)] shadow-xs'
                : 'bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
            }`}
          >
            <RotateCw className="w-3 h-3 text-[var(--learning)]" />
            <span>Öğreniyorum</span>
          </button>
          <button
            onClick={() => setStatusFilter('LEARNED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'LEARNED'
                ? 'bg-[var(--learned-soft)] text-[var(--learned)] border border-[var(--learned-border)] shadow-xs'
                : 'bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-[var(--learned)]" />
            <span>Öğrendim</span>
          </button>
          <button
            onClick={() => setStatusFilter('FAVORITES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'FAVORITES'
                ? 'bg-[var(--danger-soft)] text-[var(--favorite-strong)] border border-[var(--danger-border-strong)] shadow-xs'
                : 'bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
            }`}
          >
            <Heart className="w-3 h-3 text-[var(--favorite-strong)] fill-current" />
            <span>Favoriler</span>
          </button>
        </div>
      </div>

      {/* Word List Items */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xs divide-y divide-[var(--border-light)] overflow-hidden">
        {filteredWordItems.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
            <p className="text-sm font-bold text-[var(--text-primary)]">Kelime Bulunamadı</p>
            <p className="text-xs text-[var(--text-secondary)]">Arama kriterlerine uygun kelime yok.</p>
          </div>
        ) : (
          filteredWordItems.map(({ word, originalIndex }) => {
            const st = getUserWordStatus(word.id, learningStates);
            const isFav = favorites.includes(word.id);

            return (
              <div
                key={word.id}
                onClick={() => onSelectWordIndex(originalIndex)}
                className="p-3.5 sm:p-4 hover:bg-[var(--bg)] transition-colors flex items-center justify-between gap-3 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Status Indicator Icon */}
                  <div className="shrink-0">
                    {st === 'learned' ? (
                      <span className="w-6 h-6 rounded-full bg-[var(--learned-soft)] text-[var(--learned)] flex items-center justify-center border border-[var(--learned-border)]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    ) : st === 'learning' ? (
                      <span className="w-6 h-6 rounded-full bg-[var(--learning-soft)] text-[var(--learning)] flex items-center justify-center border border-[var(--learning-border)]">
                        <RotateCw className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-[var(--bg)] text-[var(--text-muted)] flex items-center justify-center border border-[var(--border)] text-[10px] font-bold">
                        {originalIndex + 1}
                      </span>
                    )}
                  </div>

                  {/* Word & Meaning Preview */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors truncate">
                        {word.word}
                      </span>
                      {shouldShowCefr(word) && <CEFRBadge level={word.level!} size="sm" />}
                      <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                        {word.partOfSpeech}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                      {word.turkishMeaning || (
                        <span className="text-[var(--text-muted)] italic">anlam hazırlanıyor</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Quick Actions (Audio & Favorite) */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => speakText(word.word)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors cursor-pointer"
                    title="Telaffuz"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onToggleFavorite(word.id)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isFav
                        ? 'text-[var(--favorite-strong)] bg-[var(--danger-soft)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--favorite-strong)] hover:bg-[var(--danger-soft)]'
                    }`}
                    title="Favori"
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
