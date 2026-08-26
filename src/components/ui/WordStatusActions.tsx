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
            ? 'bg-[var(--learning-soft)] text-[var(--learning-text)] border-[var(--learning-border)] shadow-xs font-bold'
            : 'bg-[var(--bg)] hover:bg-[var(--learning-soft)]/70 text-[var(--text-secondary)] hover:text-[var(--learning-text)] border-[var(--border)]'
        }`}
        title="Tekrar Et listesine ekle / çıkar"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isReview ? 'text-[var(--learning)]' : 'text-[var(--text-muted)]'}`} />
        <span>Tekrar Et</span>
      </button>

      {/* ✓ Öğrendim Button (Sage Green) */}
      <button
        type="button"
        onClick={handleToggleLearned}
        aria-pressed={isLearned}
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 border cursor-pointer select-none active:scale-[0.98] ${btnPadding} ${
          isLearned
            ? 'bg-[var(--learned-soft)] text-[var(--learned-text)] border-[var(--learned-border)] shadow-xs font-bold'
            : 'bg-[var(--bg)] hover:bg-[var(--learned-soft)]/70 text-[var(--text-secondary)] hover:text-[var(--learned-text)] border-[var(--border)]'
        }`}
        title="Öğrendim olarak işaretle / çıkar"
      >
        <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isLearned ? 'text-[var(--learned)]' : 'text-[var(--text-muted)]'}`} />
        <span>Öğrendim</span>
      </button>
    </div>
  );
};
