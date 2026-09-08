import React from 'react';
import { List, LayoutGrid } from 'lucide-react';

export type Gorunum = 'liste' | 'kart';

/**
 * Kelime listesinin iki görünümü arasında seçim.
 *
 * NEDEN İKİ GÖRÜNÜM. Kart görünümü bir kelimeyi İNCELEMEK için iyi: anlamlar,
 * örnek cümleler, telaffuz, durum düğmeleri hepsi açıkta. Ama yüz kelimelik
 * bir listede aynı zenginlik aradığını bulmayı zorlaştırıyor — her kart bir
 * ekranın önemli bir kısmını kaplıyor ve tarama parmakla uzun bir yolculuğa
 * dönüşüyor.
 *
 * Liste görünümü tam tersini yapıyor: satır başına bir kelime, yanında Türkçe
 * karşılığı ve seviyesi. Aradığını gözle bulup üstüne dokunuyorsun ve kart
 * ORADA, satırın altında açılıyor. Yani iki görünüm birbirinin yerine değil,
 * iki ayrı iş için var.
 */
export const GorunumSecici: React.FC<{
  deger: Gorunum;
  onDegis: (g: Gorunum) => void;
}> = ({ deger, onDegis }) => {
  const dugme = (secili: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
      secili
        ? 'bg-[var(--primary)] text-[var(--on-primary)]'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
    }`;

  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--bg)] border border-[var(--border)]"
      role="group"
      aria-label="Liste görünümü"
    >
      <button
        type="button"
        onClick={() => onDegis('liste')}
        aria-pressed={deger === 'liste'}
        className={dugme(deger === 'liste')}
      >
        <List className="w-3.5 h-3.5" />
        <span>Liste</span>
      </button>
      <button
        type="button"
        onClick={() => onDegis('kart')}
        aria-pressed={deger === 'kart'}
        className={dugme(deger === 'kart')}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span>Kart</span>
      </button>
    </div>
  );
};
