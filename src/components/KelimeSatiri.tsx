import React from 'react';
import { WordCard } from '../types';
import { CEFRBadge } from './ui/CEFRBadge';
import { RealmsIcon } from './ui/RealmsIcon';

/**
 * Liste görünümündeki tek satır.
 *
 * Kapalıyken kelime, Türkçe karşılığı ve seviyesi görünür — bir satır, bir
 * kelime. Dokununca kart AYNI YERDE, satırın altında açılır; kullanıcı
 * listedeki yerini kaybetmez. Başka bir ekrana götürmek ya da pencere açmak
 * geri dönünce listeyi baştan bulma işi çıkarırdı.
 *
 * Kartın kendisi `children` olarak veriliyor. Bunun sebebi kart bileşeninin
 * onlarca geri çağrı istemesi (favori, durum, düzenle, sil, sete ekle…):
 * hepsini bu satırdan geçirmek, satırı çağıran ekranın bilgisini taşıyan bir
 * boru hattına çevirirdi. Çağıran zaten o işlevlere sahip; kartı orada kurup
 * buraya veriyor.
 */
export const KelimeSatiri: React.FC<{
  card: WordCard;
  acik: boolean;
  onDegistir: () => void;
  children?: React.ReactNode;
}> = ({ card, acik, onDegistir, children }) => (
  <div className="border-b border-[var(--border-light)] last:border-b-0">
    <button
      type="button"
      onClick={onDegistir}
      aria-expanded={acik}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--surface-soft)] transition-colors cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--text-primary)] truncate">{card.word}</span>
          {card.level && <CEFRBadge level={card.level} />}
        </div>
        {card.turkishMeaning && (
          <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
            {card.turkishMeaning}
          </p>
        )}
      </div>
      <RealmsIcon
        name="chevron-down"
        size={20}
        className={`text-[var(--text-muted)] shrink-0 transition-transform ${acik ? 'rotate-180' : ''}`}
      />
    </button>

    {/* Kart yalnızca açıkken kurulur: kapalı satırlar için hiç çizilmiyor. */}
    {acik && <div className="px-2 pb-3">{children}</div>}
  </div>
);
