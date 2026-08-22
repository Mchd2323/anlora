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
        return 'bg-[#EDF4F0] text-[#426451] border-[#C9DDD0]';
      case 'A2':
        return 'bg-[#EAF2F2] text-[#3B6265] border-[#BDD9DA]';
      case 'B1':
        return 'bg-[#F0EEFA] text-[#4F46A5] border-[#D0CBEA]';
      case 'B2':
        return 'bg-[#F5EFF8] text-[#634870] border-[#DCBEDE]';
      case 'B2 EK':
      case 'B2_EK':
      case 'B2-EK':
        return 'bg-[#F4EFFC] text-[#593E91] border-[#D4C4F0]';
      case 'C1':
      case 'C2':
        return 'bg-[#F3EFEA] text-[#69533B] border-[#DDD3C7]';
      default:
        return 'bg-[#F1EFE8] text-[#687080] border-[#E4E1D9]';
    }
  };

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-[11px]' 
    : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-lg border tracking-wide uppercase ${sizeClasses} ${getLevelStyle(
        level
      )} ${className}`}
    >
      {level}
    </span>
  );
};
