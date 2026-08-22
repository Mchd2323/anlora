# -*- coding: utf-8 -*-
"""
Oxford çekirdek sözlüğündeki fonetik alanını CMUdict'ten yeniden türetir.

Neden: 3.226 maddenin 1.334'ünde (%41) fonetik alanı geçersizdi. Bir kısmı
kaynak listeden sızmış ayrıştırma artığıydı (`/north n., adj.,/`,
`/much det./pron.,/`), bir kısmı da IPA yerine kelimenin yazımıydı
(`/opposite/`, `/over/`). Kalan doğru değerlerin bir bölümü İngiliz, bir
bölümü Amerikan ağzındaydı; öğrenci hangisinin güvenilir olduğunu ayırt
edemiyordu.

Bu betik tüm alanı tek bir ağızda (GenAm) yeniden üretir, çünkü uygulama
kelimeyi `en-US` sesiyle okur. CMUdict'te bulunmayan kelimelerde mevcut
değer yalnızca geçerli IPA ise korunur, değilse alan boşaltılır: yanlış
telaffuz göstermek, hiç göstermemekten kötüdür.

Kullanım:
    python3 scripts/data-repair/repair_phonetics.py <cmudict.dict yolu>
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from arpabet_to_ipa import load_cmudict, arpabet_to_ipa  # noqa: E402

DATA_FILES = [
    'src/data/wordsA1.json',
    'src/data/wordsA2.json',
    'src/data/wordsB1.json',
    'src/data/wordsB2.json',
]

# İngilizce IPA'da kullanılan karakterler. Bunların dışında bir şey içeren
# değer IPA değildir (yazımın kendisi ya da ayrıştırma artığı).
IPA_CHARS = set('ˈˌːæɑɒʌɔəɜɝɚɪiʊueɛoaʃʒθðŋʤʧdʒtʃbdfɡghjklmnprstvwzæ.ˑ‿')
IPA_CHARS |= set('bdfghjklmnprstvwz')  # IPA ile örtüşen latin harfleri


def looks_like_ipa(value):
    """Değerin geçerli bir IPA yazımı olup olamayacağını kontrol eder."""
    text = (value or '').strip().strip('/')
    if not text:
        return False
    # IPA'da hiç bulunmayan latin harfleri ya da noktalama varsa geçersiz.
    if re.search(r'[cqxy]', text, re.I):
        return False
    if re.search(r'[,()0-9]', text):
        return False
    return all(ch in IPA_CHARS or ch.isspace() for ch in text)


# CMUdict Amerikan yazımını temel alır. Veri setindeki İngiliz yazımlarının
# çoğu CMUdict'te de bulunuyor; bulunmayanlar için yazım eşlemesi.
SPELLING_ALIASES = {
    'jewellery': 'jewelry',
    'analyse': 'analyze',
    'offence': 'offense',
}


def lookup(word, cmudict):
    """
    Kelimenin IPA yazımını üretir. Çok sözcüklü ve tireli maddeler için her
    parça ayrı çevrilip birleştirilir.
    """
    cleaned = word.strip().lower()
    if not cleaned:
        return None

    # "a, an" gibi birden çok madde başı taşıyan girdileri çevirme.
    if ',' in cleaned:
        return None

    parts = [p for p in re.split(r'[\s\-]+', cleaned) if p]
    transcribed = []
    for part in parts:
        phones = cmudict.get(SPELLING_ALIASES.get(part, part)) or cmudict.get(part)
        if not phones:
            return None
        ipa = arpabet_to_ipa(phones)
        if not ipa:
            return None
        transcribed.append(ipa)

    return ' '.join(transcribed)


def main():
    cmudict_path = sys.argv[1] if len(sys.argv) > 1 else 'cmudict.dict'
    cmudict = load_cmudict(cmudict_path)

    stats = {'total': 0, 'regenerated': 0, 'kept': 0, 'cleared': 0, 'unchanged': 0}
    cleared_words = []

    for path in DATA_FILES:
        with open(path, encoding='utf-8') as handle:
            entries = json.load(handle)

        for entry in entries:
            stats['total'] += 1
            current = entry.get('phonetic') or ''
            generated = lookup(entry['word'], cmudict)

            if generated:
                new_value = '/%s/' % generated
                if new_value != current:
                    entry['phonetic'] = new_value
                    stats['regenerated'] += 1
                else:
                    stats['unchanged'] += 1
            elif looks_like_ipa(current):
                stats['kept'] += 1
            else:
                # Doğrulanamayan değer gösterilmemeli.
                entry['phonetic'] = ''
                stats['cleared'] += 1
                cleared_words.append(entry['word'])

        with open(path, 'w', encoding='utf-8') as handle:
            json.dump(entries, handle, ensure_ascii=False, indent=2)
            handle.write('\n')

    print('Fonetik onarımı tamamlandı:')
    print('  toplam madde        : %d' % stats['total'])
    print('  CMUdict ile yenilendi: %d' % stats['regenerated'])
    print('  zaten doğruydu      : %d' % stats['unchanged'])
    print('  mevcut IPA korundu  : %d' % stats['kept'])
    print('  doğrulanamadı, boşaltıldı: %d' % stats['cleared'])
    if cleared_words:
        print('  boşaltılanlar: %s' % ', '.join(cleared_words[:20]))


if __name__ == '__main__':
    main()
