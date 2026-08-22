import React from 'react';
import { Check, RefreshCw } from 'lucide-react';

export interface WordStatusActionsProps {
  status: 'learned' | 'learning' | 'unseen';
  onSetStatus: (status: 'learned' | 'learning' | 'unseen') => void;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
  className?: string;
}

/**
 * Reusable two-state learning status actions component:
 * [ ↻ Tekrar Et ] and [ ✓ Öğrendim ]
 * Mutually exclusive states.
 */
export const WordStatusActions: React.FC<WordStatusActionsProps> = ({
  status,
  onSetStatus,
  size = 'md',
  compact = false,
  className = ''
}) => {
  const isLearned = status === 'learned';
  const isReview = status === 'learning'; // 'learning' maps to 'Tekrar Et'

  const handleToggleReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReview) {
      onSetStatus('unseen');
    } else {
      onSetStatus('learning');
    }
  };

  const handleToggleLearned = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLearned) {
      onSetStatus('unseen');
    } else {
      onSetStatus('learned');
    }
  };

  const btnPadding =
    size === 'sm'
      ? 'py-1.5 px-2.5 text-xs'
      : size === 'lg'
      ? 'py-2.5 px-4 text-sm'
      : 'py-2 px-3.5 text-xs';

  return (
    <div className={`flex items-center gap-2 ${compact ? 'w-auto' : 'w-full'} ${className}`}>
      {/* ↻ Tekrar Et Button (Warm Amber) */}
      <button
        type="button"
        onClick={handleToggleReview}
        aria-pressed={isReview}
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 border cursor-pointer select-none active:scale-[0.98] ${btnPadding} ${
          isReview
            ? 'bg-[#FBF1DE] text-[#8A5A18] border-[#E7C98F] shadow-xs font-bold'
            : 'bg-[#F8F7F3] hover:bg-[#FBF1DE]/70 text-[#687080] hover:text-[#8A5A18] border-[#E4E1D9]'
        }`}
        title="Tekrar Et listesine ekle / çıkar"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isReview ? 'text-[#B97922]' : 'text-[#8E95A2]'}`} />
        <span>Tekrar Et</span>
      </button>

      {/* ✓ Öğrendim Button (Sage Green) */}
      <button
        type="button"
        onClick={handleToggleLearned}
        aria-pressed={isLearned}
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 border cursor-pointer select-none active:scale-[0.98] ${btnPadding} ${
          isLearned
            ? 'bg-[#E9F3ED] text-[#35654E] border-[#BFD7C8] shadow-xs font-bold'
            : 'bg-[#F8F7F3] hover:bg-[#E9F3ED]/70 text-[#687080] hover:text-[#35654E] border-[#E4E1D9]'
        }`}
        title="Öğrendim olarak işaretle / çıkar"
      >
        <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isLearned ? 'text-[#4F806A]' : 'text-[#8E95A2]'}`} />
        <span>Öğrendim</span>
      </button>
    </div>
  );
};
