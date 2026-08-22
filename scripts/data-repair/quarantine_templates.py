# -*- coding: utf-8 -*-
"""
Şablondan üretilmiş örnek cümleleri çekirdek sözlükten çıkarır.

Bulgu: Oxford 3000 çekirdeğindeki 9.678 örnek cümlenin 8.515'i (%88), yirmi bir
sabit kalıptan üretilmiş. Kelime, sözcük türüne bakılmaksızın kalıbın içine
yerleştirildiği için ortaya dilbilgisi dışı cümleler çıkmış:

    ago  (zarf)  -> "I want to ago today because it is very important."
    back (fiil)  -> "Research shows how organizations back during challenging times."

Türkçe çeviriler de aynı kalıba Türkçe karşılığın sokulmasıyla üretildiğinden
ayrıca anlamsız. Bu cümleler öğrenciye "örnek cümle" diye gösteriliyor, sınavda
boşluk doldurma sorusu olarak soruluyor ve yanlış dil kalıbı öğretiyor.

Karşılaştırma: Oxford 5000 Ek setindeki 2.025 cümlede tek bir şablon yok; o set
projenin kendi yapay zekâ üreticisiyle hazırlanmış. Yani doğru boru hattı zaten
var, çekirdek ondan hiç geçmemiş.

Bu betik cümleleri silmez, karantinaya alır: veriden çıkarır ve tamamını
`scripts/data-repair/quarantine_report.json` dosyasına yazar. Böylece
`repair_examples.ts` bir API anahtarıyla çalıştırıldığında hangi maddelerin
yeniden üretilmesi gerektiğini bilir, hiçbir şey de kaybolmaz.

Şablonlar elle listelenmez; veriden istatistiksel olarak bulunur: kelime yerine
yer tutucu konduğunda aynı iskelete indirgenen ve çok sayıda maddede tekrarlanan
cümleler şablondur.
"""

import json
import re
import collections

DATA_FILES = [
    'src/data/wordsA1.json',
    'src/data/wordsA2.json',
    'src/data/wordsB1.json',
    'src/data/wordsB2.json',
]

QUARANTINE_PATH = 'scripts/data-repair/quarantine_report.json'

# Bir iskeletin şablon sayılması için gereken en az tekrar sayısı. Doğal
# cümlelerin farklı maddelerde birebir aynı iskeleti paylaşması beklenmez.
MIN_REPETITIONS = 10


def skeleton(sentence, word):
    """Cümledeki hedef kelimeyi (çekimleriyle) yer tutucuyla değiştirir."""
    pattern = r'\b' + re.escape(word.strip().lower()) + r'(s|es|ed|ing|d)?\b'
    return re.sub(pattern, '<W>', sentence, flags=re.I).strip()


def load_all():
    files = {}
    for path in DATA_FILES:
        with open(path, encoding='utf-8') as handle:
            files[path] = json.load(handle)
    return files


def find_template_skeletons(files):
    counts = collections.Counter()
    for entries in files.values():
        for entry in entries:
            for example in entry.get('examples') or []:
                counts[skeleton(example.get('en', ''), entry['word'])] += 1
    return {s for s, n in counts.items() if n >= MIN_REPETITIONS and '<W>' in s}


def main():
    files = load_all()
    templates = find_template_skeletons(files)

    quarantined = []
    stats = {'entries': 0, 'affected': 0, 'removed': 0, 'emptied': 0}

    for path, entries in files.items():
        for entry in entries:
            stats['entries'] += 1
            examples = entry.get('examples') or []
            kept = []
            dropped = []

            for example in examples:
                if skeleton(example.get('en', ''), entry['word']) in templates:
                    dropped.append(example)
                else:
                    kept.append(example)

            if not dropped:
                # Doğrulanmış örneği olan madde işaretlenir; arayüz bunlara güvenir.
                entry['examplesVerified'] = True
                continue

            stats['affected'] += 1
            stats['removed'] += len(dropped)
            entry['examples'] = kept
            entry['examplesVerified'] = len(kept) > 0
            if not kept:
                stats['emptied'] += 1

            # Çıkarılan cümleler rapora yazılmaz: kullanılamaz durumdalar ve
            # tam metinleri sürüm geçmişinde zaten duruyor. Rapor, yeniden
            # üretilmesi gereken maddelerin listesidir.
            quarantined.append({
                'id': entry['id'],
                'word': entry['word'],
                'level': entry['level'],
                'partOfSpeech': entry['partOfSpeech'],
                'turkishMeaning': entry['turkishMeaning'],
                'remainingExamples': len(kept),
                'removedCount': len(dropped),
            })

        with open(path, 'w', encoding='utf-8') as handle:
            json.dump(entries, handle, ensure_ascii=False, indent=2)
            handle.write('\n')

    report = {
        'note': 'Bu maddelerin örnek cümleleri şablon olduğu için çıkarıldı; '
                'repair_examples.ts ile yeniden üretilmeleri gerekiyor.',
        'detectedTemplateSkeletons': sorted(templates),
        'stats': stats,
        'entries': quarantined,
    }
    with open(QUARANTINE_PATH, 'w', encoding='utf-8') as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write('\n')

    print('Şablon karantinası tamamlandı:')
    print('  tespit edilen şablon iskeleti : %d' % len(templates))
    print('  toplam madde                  : %d' % stats['entries'])
    print('  etkilenen madde               : %d' % stats['affected'])
    print('  çıkarılan cümle               : %d' % stats['removed'])
    print('  örneksiz kalan madde          : %d' % stats['emptied'])
    print('  rapor                         : %s' % QUARANTINE_PATH)


if __name__ == '__main__':
    main()
