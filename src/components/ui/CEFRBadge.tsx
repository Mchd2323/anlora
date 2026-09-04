import React from 'react';
import { Level } from '../../types';

interface CEFRBadgeProps {
  level?: Level | string;
  className?: string;
  size?: 'sm' | 'md';
}

export const CEFRBadge: React.FC<CEFRBadgeProps> = ({
  level = 'B1',
  className = '',
  size = 'md'
}) => {
  const getLevelStyle = (lvl: string) => {
    switch (lvl?.toUpperCase()) {
      case 'A1':
        return 'bg-[var(--cefr-a1-soft)] text-[var(--learned-deep)] border-[var(--cefr-a1-border)]';
      case 'A2':
        return 'bg-[var(--cefr-a2-soft)] text-[var(--teal-text)] border-[var(--cefr-a2-border)]';
      case 'B1':
        return 'bg-[var(--cefr-b1-soft)] text-[var(--primary)] border-[var(--cefr-b1-border)]';
      case 'B2':
        return 'bg-[var(--cefr-b2-soft)] text-[var(--cefr-b2-deep)] border-[var(--cefr-b2-border)]';
      case 'B2 EK':
      case 'B2_EK':
      case 'B2-EK':
        return 'bg-[var(--primary-tint)] text-[var(--primary-deep)] border-[var(--primary-border-strong)]';
      case 'C1':
      case 'C2':
        return 'bg-[var(--neutral-100)] text-[var(--learning-deep)] border-[var(--neutral-250)]';
      default:
        return 'bg-[var(--surface-soft)] text-[var(--text-secondary)] border-[var(--border)]';
    }
  };

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-[11px]' 
    : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      /*
        `` kaldirildi: paket otomatik buyuk harfe cevirmeyi
        yasakliyor. Seviye kodlari zaten ('A1', 'B2') buyuk yazildigi icin
        gorunum degismiyor, ama donusum artik metne dayatilmiyor.
      */
      className={`inline-flex items-center font-bold rounded-lg border tracking-wide ${sizeClasses} ${getLevelStyle(
        level
      )} ${className}`}
    >
      {level}
    </span>
  );
};
