import React from 'react';
import { motifForWord } from '../../utils/cardMotif';
import { RealmsIcon, RealmsIconName } from './RealmsIcon';

/**
 * Kelime kartinin ust isareti: motif glifi ve yaninda kisa bir altin sac
 * cizgisi, ucunda kucuk bir baklava.
 *
 * ESKI HALI BIR SERITTI. Kartin ustunde koyudan aciga giden 6 piksellik gri
 * bir bant vardi; alti motifin hepsi ayni bandin altinda kayboldugu icin
 * kartlari AYIRT ETMIYORDU, ustelik silinen ucu kartin sagina kadar uzanip
 * tam ekran dugmesinin altina giriyordu. Yerine gelen isaret daha az ve daha
 * kesin: glif kelimeye gore degisiyor, altin cizgi sabit 56 piksel ve
 * kartin sagindaki dugmelere hic yaklasmiyor.
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
      <span className="realm-card-rule" />
    </div>
  );
};
