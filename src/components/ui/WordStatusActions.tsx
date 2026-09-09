import React from 'react';
import { Check } from 'lucide-react';
import { RealmsIcon } from '../ui/RealmsIcon';
import { useDokunusAktivasyonu } from '../../hooks/useDokunusAktivasyonu';

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

  /*
   * DOKUNUŞ `click`E BAĞLI DEĞİL.
   *
   * Ölçüldü: kartı kaydırdıktan hemen sonraki dokunuşta tarayıcı `click`
   * üretmiyor (0-250 ms penceresi; çıplak bir sayfada da aynı). Kullanıcının
   * "Öğrendim'e iki kere basmak gerekiyor" dediği şey buydu. Kanca eylemi
   * parmak kalkarken çalıştırıyor, geç gelen tıklamayı yok sayıyor.
   */
  const durumDegistir = (yeni: 'learned' | 'learning' | 'unseen') => (e: React.SyntheticEvent) => {
    e.stopPropagation();
    onSetStatus(yeni);
  };

  const tekrarAktif = useDokunusAktivasyonu(durumDegistir(isReview ? 'unseen' : 'learning'));
  const ogrendimAktif = useDokunusAktivasyonu(durumDegistir(isLearned ? 'unseen' : 'learned'));

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
        {...tekrarAktif}
        aria-pressed={isReview}
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 border cursor-pointer select-none active:scale-[0.98] ${btnPadding} ${
          isReview
            ? 'bg-[var(--learning-fill)] text-[var(--on-learning)] border-[var(--learning)] font-bold shadow-md ring-2 ring-[var(--learning)]/30 scale-[1.02]'
            : 'bg-[var(--bg)] hover:bg-[var(--learning-soft)]/70 text-[var(--text-secondary)] hover:text-[var(--learning-text)] border-[var(--border)]'
        }`}
        title="Tekrar Et listesine ekle / çıkar"
      >
        <RealmsIcon
          name="repeat"
          size={18}
          className={isReview ? 'text-[var(--surface)]' : 'text-[var(--text-muted)]'}
        />
        <span>Tekrar Et</span>
      </button>

      {/* ✓ Öğrendim Button (Sage Green) */}
      <button
        type="button"
        {...ogrendimAktif}
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
