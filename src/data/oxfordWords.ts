import { WordCard, Badge } from '../types';
import { oxfordRepository, OXFORD_DATA_VERSION, OXFORD_METADATA } from '../services/oxfordRepository';

export { oxfordRepository, OXFORD_DATA_VERSION, OXFORD_METADATA };

export const OXFORD_3000_WORDS: WordCard[] = oxfordRepository.getOxfordEntries() as WordCard[];

export const BADGES_DATA: Badge[] = [
  {
    id: 'first_steps',
    name: 'İlk Adımlar',
    description: 'İlk kelime kartınızı inceleyin veya ilk sınavınızı çözün.',
    iconName: 'Footprints',
    unlocked: false,
    requirementText: '1 sınav çöz'
  },
  {
    id: 'quiz_master',
    name: 'Sınav Ustası',
    description: 'Toplam 10 sınavı başarıyla tamamlayın.',
    iconName: 'Award',
    unlocked: false,
    requirementText: '10 sınav tamamla'
  },
  {
    id: 'streak_3',
    name: 'Seri Öğrenici',
    description: '3 gün üst üste uygulamaya giriş yapın.',
    iconName: 'Zap',
    unlocked: false,
    requirementText: '3 günlük seri yap'
  },
  {
    id: 'vocab_50',
    name: 'Kelime Avcısı',
    description: '50 kelimeyi öğrendim olarak işaretleyin.',
    iconName: 'BookOpen',
    unlocked: false,
    requirementText: '50 kelime öğren'
  },
  {
    id: 'perfect_score',
    name: 'Kusursuz Başarı',
    description: 'Bir sınavda %100 doğruluk oranına ulaşın.',
    iconName: 'Trophy',
    unlocked: false,
    requirementText: '%100 sınav skoru al'
  },
  {
    id: 'fav_collector',
    name: 'Koleksiyoner',
    description: '20 kelimeyi favorilerinize ekleyin.',
    iconName: 'Bookmark',
    unlocked: false,
    requirementText: '20 favori kelime ekle'
  }
];
