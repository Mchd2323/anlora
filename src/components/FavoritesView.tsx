import React, { useState } from 'react';
import { WordCard, LearningState } from '../types';
import { WordCardComponent } from './WordCard';
import { Heart, Search, Volume2 } from 'lucide-react';
import { speakText } from '../utils/speech';
import { getUserWordStatus } from '../utils/storageV2';

interface FavoritesViewProps {
  favoriteWords: WordCard[];
  favorites: string[];
  learningStates?: Record<string, LearningState>;
  onToggleFavorite: (id: string) => void;
  onOpenAddToCollection?: (card: WordCard) => void;
  onOpenEditModal?: (card: WordCard) => void;
  onSetWordStatus?: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favoriteWords,
  favorites,
  learningStates = {},
  onToggleFavorite,
  onOpenAddToCollection,
  onOpenEditModal,
  onSetWordStatus
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = favoriteWords.filter(
    (card) =>
      card.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.turkishMeaning.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePlayAllFavorites = () => {
    if (favoriteWords.length === 0) return;
    const text = favoriteWords.map((w) => `${w.word}. ${w.turkishMeaning}`).join('. ');
    speakText(text);
  };

  return (
    <div className="space-y-6 pb-safe-nav max-w-[1180px] mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFFFF] p-6 sm:p-7 rounded-2xl border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FAECEA] text-[#B75D6A] flex items-center justify-center font-bold border border-[#F0CBC7]">
            <Heart className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1E2430]">
              Favori Kelimelerim ({favoriteWords.length})
            </h2>
            <p className="text-xs sm:text-sm text-[#687080] mt-0.5">
              Hızlı erişmek ve tekrar etmek istediğin kelimeler.
            </p>
          </div>
        </div>

        {favoriteWords.length > 0 && (
          <button
            onClick={handlePlayAllFavorites}
            className="px-3.5 py-2 bg-[#FAECEA] hover:bg-[#F5D7D3] text-[#B75D6A] font-semibold text-xs rounded-xl border border-[#F0CBC7] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-[#B75D6A]" />
            <span>Tümünü Dinle</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      {favoriteWords.length > 0 && (
        <div className="relative max-w-md">
          <Search className="w-3.5 h-3.5 text-[#8E95A2] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Favorilerde kelime ara..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-[#FFFFFF] border border-[#E4E1D9] rounded-xl focus:outline-none focus:border-[#4F46A5] text-[#1E2430]"
          />
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((card) => (
            <WordCardComponent
              key={card.id}
              card={card}
              isFavorite={favorites.includes(card.id)}
              learningState={learningStates[card.id]}
              status={getUserWordStatus(card.id, learningStates)}
              onSetStatus={onSetWordStatus}
              onToggleFavorite={onToggleFavorite}
              onOpenAddToCollection={onOpenAddToCollection ? () => onOpenAddToCollection(card) : undefined}
              onEditCustom={card.isCustom && onOpenEditModal ? () => onOpenEditModal(card) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="bg-[#FFFFFF] p-10 rounded-2xl border border-[#E4E1D9] text-center space-y-2 shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
          <Heart className="w-8 h-8 text-[#8E95A2] mx-auto opacity-50" />
          <h3 className="text-sm font-bold text-[#1E2430]">Favori Kelime Bulunamadı</h3>
          <p className="text-xs text-[#687080] max-w-sm mx-auto">
            Kartlardaki kalp ikonuna dokunarak kelimeleri favorilerine ekleyebilirsin.
          </p>
        </div>
      )}
    </div>
  );
};
