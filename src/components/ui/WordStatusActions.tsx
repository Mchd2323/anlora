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
 * İki durumlu öğrenme işareti: [ ↻ Tekrar Et ] ve [ ✓ Öğrendim ].
 *
 * SEÇİLİ HÂL DOLU RENKTİR. Önceden seçili düğme yalnızca soluk bir tonla
 * (…-soft) doluyordu; seçili ile seçilmemiş arasındaki fark güneşte ya da
 * hızlı çalışırken zor seçiliyordu. Artık seçili düğme tam renkle dolar,
 * yazı beyaza döner ve çevresine bir halka çizilir — üç ayrı işaret, hiçbiri
 * tek başına renge bağlı değil (renk körlüğü için de gerekli).
 *
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
            ? 'bg-[var(--learning)] text-[var(--surface)] border-[var(--learning)] font-bold shadow-md ring-2 ring-[var(--learning)]/30 scale-[1.02]'
            : 'bg-[var(--bg)] hover:bg-[var(--learning-soft)]/70 text-[var(--text-secondary)] hover:text-[var(--learning-text)] border-[var(--border)]'
        }`}
        title="Tekrar Et listesine ekle / çıkar"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isReview ? 'text-[var(--surface)]' : 'text-[var(--text-muted)]'}`} />
        <span>Tekrar Et</span>
      </button>

      {/* ✓ Öğrendim Button (Sage Green) */}
      <button
        type="button"
        onClick={handleToggleLearned}
        aria-pressed={isLearned}
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 border cursor-pointer select-none active:scale-[0.98] ${btnPadding} ${
          isLearned
            ? 'bg-[var(--learned)] text-[var(--surface)] border-[var(--learned)] font-bold shadow-md ring-2 ring-[var(--learned)]/30 scale-[1.02]'
            : 'bg-[var(--bg)] hover:bg-[var(--learned-soft)]/70 text-[var(--text-secondary)] hover:text-[var(--learned-text)] border-[var(--border)]'
        }`}
        title="Öğrendim olarak işaretle / çıkar"
      >
        <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isLearned ? 'text-[var(--surface)]' : 'text-[var(--text-muted)]'}`} />
        <span>Öğrendim</span>
      </button>
    </div>
  );
};
