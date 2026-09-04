import React from 'react';
import { motifForWord } from '../../utils/cardMotif';
import { RealmsIcon, RealmsIconName } from './RealmsIcon';

/**
 * Kelime kartinin ust seridi: kucuk motif glifi ve yaninda saga dogru
 * kaybolan ince bir doku seridi.
 *
 * KARTIN ARKA PLANI DEGIL. Serit kartin en ustunde, kendi satirinda duruyor;
 * metnin arkasina, ornek cumlelerin altina ya da kartin tamamina yayilmiyor.
 * Yuksekligi en fazla 6 piksel (bkz. `.realm-card-motif::after`).
 *
 * Motif kelimeye bagli ve KARARLI: `motifForWord` ayni kelimeye her zaman
 * ayni motifi verir, yani Oxford listesindeki "bridge" ile kullanicinin kendi
 * setindeki "bridge" ayni gorunur.
 *
 * Dekoratif: `aria-hidden`, ekran okuyucuya yeni icerik eklemez.
 */
interface Props {
  /** Ingilizce madde basi; motif bundan turuyor. */
  word: string;
  level?: string;
  wordType?: string;
  className?: string;
}

export const CardMotif: React.FC<Props> = ({ word, level = '', wordType = '', className = '' }) => {
  const motif = motifForWord(word, level, wordType);
  return (
    <div aria-hidden="true" className={`realm-card-motif ${className}`.trim()} data-motif={motif.id}>
      <RealmsIcon name={motif.icon as RealmsIconName} size={20} />
    </div>
  );
};
