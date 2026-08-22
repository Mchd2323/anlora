# -*- coding: utf-8 -*-
"""
Oxford kayıtlarının eksik IPA telaffuzlarını CMUdict'ten doldurur.

Ağız Genel Amerikan İngilizcesidir (GenAm), çünkü uygulama kelimeleri
`en-US` sesiyle okur; yazılan telaffuz duyulan sesle aynı ağızda olmalıdır.

CMUdict'te bulunmayan kelimelerde alan boş bırakılır: yanlış telaffuz
göstermek, hiç göstermemekten kötüdür.

Kullanım:
    python3 scripts/oxford/fill_phonetics.py <cmudict.dict yolu>
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from arpabet_to_ipa import load_cmudict, arpabet_to_ipa  # noqa: E402

DATA_FILES = ['src/data/oxford3000.json', 'src/data/oxford5000extra.json']

# CMUdict Amerikan yazımını temel alır; kaynak listede geçen İngiliz
# yazımlarından CMUdict'te bulunmayanlar için eşleme.
SPELLING_ALIASES = {
    'jewellery': 'jewelry',
    'analyse': 'analyze',
    'offence': 'offense',
    'defence': 'defense',
    'licence': 'license',
    'practise': 'practice',
    'organise': 'organize',
    'realise': 'realize',
    'recognise': 'recognize',
    'apologise': 'apologize',
    'criticise': 'criticize',
    'emphasise': 'emphasize',
    'colourful': 'colorful',
    'flavour': 'flavor',
    'litre': 'liter',
    'councillor': 'councilor',
    'counselling': 'counseling',
    'enrol': 'enroll',
    'favourable': 'favorable',
    'sceptical': 'skeptical',
}


def lookup(headword, cmudict):
    cleaned = (headword or '').strip().lower()
    if not cleaned or ',' in cleaned:
        return None

    parts = [part for part in re.split(r'[\s\-]+', cleaned) if part]
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

    stats = {'total': 0, 'filled': 0, 'already': 0, 'unavailable': 0}
    unavailable = []

    for path in DATA_FILES:
        with open(path, encoding='utf-8') as handle:
            entries = json.load(handle)

        for entry in entries:
            stats['total'] += 1
            if entry.get('phonetic'):
                stats['already'] += 1
                continue

            ipa = lookup(entry['headword'], cmudict)
            if ipa:
                entry['phonetic'] = f'/{ipa}/'
                stats['filled'] += 1
            else:
                stats['unavailable'] += 1
                unavailable.append(entry['headword'])

        with open(path, 'w', encoding='utf-8') as handle:
            json.dump(entries, handle, ensure_ascii=False, indent=2)
            handle.write('\n')

    print('Telaffuz doldurma tamamlandı:')
    print(f'  toplam kayıt        : {stats["total"]}')
    print(f'  zaten vardı         : {stats["already"]}')
    print(f'  CMUdict ile eklendi : {stats["filled"]}')
    print(f'  bulunamadı (boş)    : {stats["unavailable"]}')
    if unavailable:
        print(f'  örnek: {", ".join(unavailable[:15])}')


if __name__ == '__main__':
    main()
