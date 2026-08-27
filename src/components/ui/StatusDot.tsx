import React from 'react';
import { Check, RotateCw } from 'lucide-react';

/**
 * Öğrenme durumu göstergesi.
 *
 * RENK TEK BAŞINA YETMEZ. "Öğrendim" yeşil, "tekrar et" kehribar; kırmızı-yeşil
 * renk körlüğünde (erkeklerin yaklaşık %8'i) bu ikisi birbirine yakın
 * görünebilir. Bu yüzden her durum ayrıca bir BİÇİM taşır: öğrenilen dolu bir
 * daire içinde onay işareti, tekrar edilecek içi boş bir halka içinde döngü
 * işareti, görülmemiş ise düz bir çizgi.
 *
 * Böylece durum renk görülmeden de okunur; ekran okuyucu için de metin var.
 */

export type WordStatus = 'learned' | 'learning' | 'unseen';

const LABEL: Record<WordStatus, string> = {
  learned: 'Öğrendim',
  learning: 'Tekrar et',
  unseen: 'İncelenmedi'
};

export const StatusDot: React.FC<{
  status: WordStatus;
  size?: 'sm' | 'md';
  withLabel?: boolean;
  className?: string;
}> = ({ status, size = 'sm', withLabel = false, className = '' }) => {
  const box = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';
  const icon = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  const shapes: Record<WordStatus, React.ReactNode> = {
    learned: (
      <span
        className={`${box} rounded-full bg-[var(--learned)] text-[var(--surface)] flex items-center justify-center shrink-0`}
      >
        <Check className={`${icon} stroke-[3]`} />
      </span>
    ),
    learning: (
      <span
        className={`${box} rounded-full border-2 border-[var(--learning)] text-[var(--learning)] flex items-center justify-center shrink-0`}
      >
        <RotateCw className={`${icon} stroke-[3]`} />
      </span>
    ),
    unseen: (
      <span className={`${box} flex items-center justify-center shrink-0`}>
        <span className="w-2.5 h-0.5 rounded-full bg-[var(--text-muted)]" />
      </span>
    )
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {shapes[status]}
      {withLabel ? (
        <span className="text-[11px] font-semibold">{LABEL[status]}</span>
      ) : (
        <span className="sr-only">{LABEL[status]}</span>
      )}
    </span>
  );
};
