import { WordCard } from '../types';
import {
  oxfordCoreRepository,
  loadOxfordCore,
  isOxfordCoreLoaded,
  OXFORD_DATA_VERSION,
  OXFORD_GROUPS,
} from '../services/oxfordCoreRepository';

export {
  oxfordCoreRepository,
  loadOxfordCore,
  isOxfordCoreLoaded,
  OXFORD_DATA_VERSION,
  OXFORD_GROUPS,
};

/*
 * SABİT DİZİ DEĞİL, İŞLEV.
 *
 * Bu dosya eskiden `OXFORD_3000_WORDS` adında hazır bir dizi dışa veriyordu.
 * Dizi modül yüklenirken hesaplandığı için sözlüğün ayrıştırılması uygulama
 * kabuğunun boyanmasından önce olmak zorundaydı. Sözlük artık tembel
 * yüklendiğinden aynı adı sabit olarak dışa vermek yanıltıcı olurdu: değer
 * ilk anda boş olur, sonradan dolar ve ithal eden modül bunu asla göremezdi.
 * İşlev, çağrıldığı andaki gerçeği döndürür.
 */

/** Oxford 3000 (A1–B2) kelimeleri. Sözlük yüklenmemişse boş dizi. */
export function getOxford3000Words(): WordCard[] {
  return [
    ...oxfordCoreRepository.getWordCardsByGroup('A1'),
    ...oxfordCoreRepository.getWordCardsByGroup('A2'),
    ...oxfordCoreRepository.getWordCardsByGroup('B1'),
    ...oxfordCoreRepository.getWordCardsByGroup('B2'),
  ];
}

/** Oxford 5000 Ek kelimeleri (B2 Ek + C1). Oxford 3000 B2 ile karıştırılmaz. */
export function getOxford5000ExtraWords(): WordCard[] {
  return [
    ...oxfordCoreRepository.getWordCardsByGroup('B2_EK'),
    ...oxfordCoreRepository.getWordCardsByGroup('C1'),
  ];
}

/** Rozetler artık kendi modülünde; eski içe aktarmalar bozulmasın diye yeniden dışa verilir. */
export { BADGES_DATA } from './badges';
