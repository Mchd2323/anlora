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
    <div className="space-y-4 max-w-3xl mx-auto animate-fadeIn pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-[#E4E1D9] shadow-xs">
        <button
          onClick={onBackToStudy}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-xs font-bold text-[#1E2430] rounded-xl border border-[#E4E1D9] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Karta Dön</span>
        </button>

        <div className="text-center">
          <h2 className="text-base sm:text-lg font-bold text-[#1E2430] truncate max-w-[200px] sm:max-w-md">
            {title}
          </h2>
          <p className="text-xs text-[#687080]">
            Toplam {words.length} kelime
          </p>
        </div>

        <div className="w-16" />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E4E1D9] shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#8E95A2] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kelimelerde veya anlamlarda ara..."
            className="w-full pl-10 pr-9 py-2.5 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-medium text-[#1E2430]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E95A2] hover:text-[#1E2430] cursor-pointer"
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
                ? 'bg-[#1E2430] text-white shadow-xs'
                : 'bg-[#F8F7F3] text-[#687080] hover:text-[#1E2430] border border-[#E4E1D9]'
            }`}
          >
            Tümü ({words.length})
          </button>
          <button
            onClick={() => setStatusFilter('LEARNING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'LEARNING'
                ? 'bg-[#FBF1DE] text-[#B97922] border border-[#E7C98F] shadow-xs'
                : 'bg-[#F8F7F3] text-[#687080] hover:text-[#1E2430] border border-[#E4E1D9]'
            }`}
          >
            <RotateCw className="w-3 h-3 text-[#B97922]" />
            <span>Öğreniyorum</span>
          </button>
          <button
            onClick={() => setStatusFilter('LEARNED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'LEARNED'
                ? 'bg-[#E9F3ED] text-[#4F806A] border border-[#BFD7C8] shadow-xs'
                : 'bg-[#F8F7F3] text-[#687080] hover:text-[#1E2430] border border-[#E4E1D9]'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-[#4F806A]" />
            <span>Öğrendim</span>
          </button>
          <button
            onClick={() => setStatusFilter('FAVORITES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'FAVORITES'
                ? 'bg-[#FAECEA] text-[#D96B82] border border-[#E8C2BD] shadow-xs'
                : 'bg-[#F8F7F3] text-[#687080] hover:text-[#1E2430] border border-[#E4E1D9]'
            }`}
          >
            <Heart className="w-3 h-3 text-[#D96B82] fill-current" />
            <span>Favoriler</span>
          </button>
        </div>
      </div>

      {/* Word List Items */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[#E4E1D9] shadow-xs divide-y divide-[#EFECE6] overflow-hidden">
        {filteredWordItems.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-[#8E95A2] mx-auto" />
            <p className="text-sm font-bold text-[#1E2430]">Kelime Bulunamadı</p>
            <p className="text-xs text-[#687080]">Arama kriterlerine uygun kelime yok.</p>
          </div>
        ) : (
          filteredWordItems.map(({ word, originalIndex }) => {
            const st = getUserWordStatus(word.id, learningStates);
            const isFav = favorites.includes(word.id);

            return (
              <div
                key={word.id}
                onClick={() => onSelectWordIndex(originalIndex)}
                className="p-3.5 sm:p-4 hover:bg-[#F8F7F3] transition-colors flex items-center justify-between gap-3 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Status Indicator Icon */}
                  <div className="shrink-0">
                    {st === 'learned' ? (
                      <span className="w-6 h-6 rounded-full bg-[#E9F3ED] text-[#4F806A] flex items-center justify-center border border-[#BFD7C8]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    ) : st === 'learning' ? (
                      <span className="w-6 h-6 rounded-full bg-[#FBF1DE] text-[#B97922] flex items-center justify-center border border-[#E7C98F]">
                        <RotateCw className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-[#F8F7F3] text-[#8E95A2] flex items-center justify-center border border-[#E4E1D9] text-[10px] font-bold">
                        {originalIndex + 1}
                      </span>
                    )}
                  </div>

                  {/* Word & Meaning Preview */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-bold text-[#1E2430] group-hover:text-[#4F46A5] transition-colors truncate">
                        {word.word}
                      </span>
                      {word.level && <CEFRBadge level={word.level} size="sm" />}
                      <span className="text-[10px] font-semibold text-[#8E95A2]">
                        {word.partOfSpeech}
                      </span>
                    </div>
                    <p className="text-xs text-[#687080] truncate mt-0.5">
                      {word.turkishMeaning}
                    </p>
                  </div>
                </div>

                {/* Quick Actions (Audio & Favorite) */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => speakText(word.word)}
                    className="p-1.5 text-[#8E95A2] hover:text-[#4F46A5] hover:bg-[#EEECFA] rounded-lg transition-colors cursor-pointer"
                    title="Telaffuz"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onToggleFavorite(word.id)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isFav
                        ? 'text-[#D96B82] bg-[#FAECEA]'
                        : 'text-[#8E95A2] hover:text-[#D96B82] hover:bg-[#FAECEA]'
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
