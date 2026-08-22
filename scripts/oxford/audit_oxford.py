# -*- coding: utf-8 -*-
"""
Resmî Oxford kaynak listeleri ile uygulamadaki Oxford verisini karşılaştırır.

Kural (talimat 2): DOĞRUYSA KORU, HATALIYSA DÜZELT, EKSİKSE EKLE.
Bu betik hiçbir şeyi değiştirmez; yalnızca durumu raporlar.

Eşleştirme yalnızca kelime yazılışına göre YAPILMAZ (talimat 5): "firm n." ile
"firm adj." ayrı kayıtlardır. Anahtar kaynak satırının kendisidir; satır
headword + qualifier + homograf + sözcük türü listesini birlikte taşır.

Göç öncesi (eski düz veri modeliyle yapılan) karşılaştırmanın sonuçları
`audit_report_pre_migration.json` dosyasında saklanır.
"""

import json
import collections

SOURCES = [
    ('scripts/oxford/source/oxford3000.source.json', 'oxford3000'),
    ('scripts/oxford/source/oxford5000extra.source.json', 'oxford5000-extra'),
]
DATA_FILES = ['src/data/oxford3000.json', 'src/data/oxford5000extra.json']


def load(path):
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def group_label(collection, cefr):
    if collection == 'oxford5000-extra':
        return 'B2 Ek' if cefr == 'B2' else cefr
    return cefr


def main():
    sources = []
    for path, _ in SOURCES:
        sources.extend(load(path))

    entries = []
    for path in DATA_FILES:
        entries.extend(load(path))

    by_line = {entry['sourceEntry']: entry for entry in entries}

    source_counts = collections.Counter()
    source_pos_counts = collections.Counter()
    for source in sources:
        label = group_label(source['sourceCollection'], source['cefr'])
        source_counts[(source['sourceCollection'], label)] += 1
        source_pos_counts[(source['sourceCollection'], label)] += len(source['posList'])

    missing = [s for s in sources if s['sourceLine'] not in by_line]
    extra = [e for e in entries if not any(s['sourceLine'] == e['sourceEntry'] for s in sources)] \
        if len(entries) != len(sources) else []

    # İçerik durumu
    complete_entries = 0
    meaning_only = 0
    no_meaning = 0
    needs_review = 0
    sense_total = 0
    sense_complete = 0
    sense_meaning_only = 0
    sense_empty = 0
    legacy_meaning = 0

    for entry in entries:
        if entry.get('needsReview'):
            needs_review += 1
        if entry.get('legacyMeaning'):
            legacy_meaning += 1

        entry_complete = True
        entry_has_meaning = False
        for sense in entry['senses']:
            sense_total += 1
            has_meaning = len(sense['turkishMeanings']) > 0
            has_examples = len(sense['examples']) >= 3
            if has_meaning:
                entry_has_meaning = True
            if has_meaning and has_examples:
                sense_complete += 1
            elif has_meaning:
                sense_meaning_only += 1
                entry_complete = False
            else:
                sense_empty += 1
                entry_complete = False

        if entry_complete:
            complete_entries += 1
        elif entry_has_meaning or entry.get('legacyMeaning'):
            meaning_only += 1
        else:
            no_meaning += 1

    # Çok kayıtlı madde başları (talimat 5 – silinmemeli)
    by_head = collections.defaultdict(list)
    for entry in entries:
        by_head[(entry['sourceCollection'], entry['headword'].lower())].append(entry)

    multi_entry = {k: v for k, v in by_head.items() if len(v) > 1}
    different_pos = sum(
        1 for v in multi_entry.values()
        if len({tuple(s['partOfSpeech'] for s in e['senses']) for e in v}) > 1
    )
    different_qualifier = sum(
        1 for v in multi_entry.values()
        if len({e.get('qualifier') or '' for e in v}) > 1
    )
    different_homograph = sum(
        1 for v in multi_entry.values()
        if len({e.get('homograph') or 0 for e in v}) > 1
    )

    unique_headwords = len({e['headword'].lower() for e in entries})

    print('=' * 62)
    print('ANLORA – OXFORD VERİ DENETİMİ')
    print('=' * 62)
    print()
    print('KAYNAK KAYIT SAYILARI')
    print('  Oxford 3000')
    for level in ['A1', 'A2', 'B1', 'B2']:
        key = ('oxford3000', level)
        print(f'    {level:5}: {source_counts[key]:5} madde  ({source_pos_counts[key]} sense)')
    print('  Oxford 5000 – Ek')
    for level in ['B2 Ek', 'C1']:
        key = ('oxford5000-extra', level)
        print(f'    {level:5}: {source_counts[key]:5} madde  ({source_pos_counts[key]} sense)')
    print()
    print(f'  Toplam kaynak maddesi : {len(sources)}')
    print(f'  Toplam sense          : {sum(source_pos_counts.values())}')
    print(f'  Benzersiz headword    : {len({s["headword"].lower() for s in sources})}')
    print()
    print('UYGULAMA VERİSİ')
    print(f'  Kayıt                 : {len(entries)}')
    print(f'  Sense                 : {sense_total}')
    print(f'  Benzersiz headword    : {unique_headwords}')
    print(f'  Kaynakta olup veride yok : {len(missing)}')
    print(f'  Veride olup kaynakta yok : {len(extra)}')
    print()
    print('İÇERİK DURUMU')
    print(f'  Tam kayıt (anlam + 3 örnek) : {complete_entries}')
    print(f'  Anlamı var, örneği eksik    : {meaning_only}')
    print(f'  Anlamı da eksik             : {no_meaning}')
    print(f'  needsReview işaretli        : {needs_review}')
    print(f'  Kayıt düzeyi yedek anlam    : {legacy_meaning}')
    print()
    print(f'  Tam sense                   : {sense_complete}')
    print(f'  Anlamı var, örneği eksik    : {sense_meaning_only}')
    print(f'  Anlamı yok                  : {sense_empty}')
    print()
    print('ÇOK KAYITLI MADDE BAŞLARI (talimat 5 – silinmemeli)')
    print(f'  Birden çok kaydı olan headword : {len(multi_entry)}')
    print(f'  Farklı sözcük türü ile         : {different_pos}')
    print(f'  Farklı qualifier ile           : {different_qualifier}')
    print(f'  Farklı homograf ile            : {different_homograph}')
    print()

    if missing:
        print('  EKSİK KAYITLAR (ilk 10):')
        for item in missing[:10]:
            print(f'    {item["sourceLine"]}')
        print()

    status = 'GEÇTİ' if not missing and not extra else 'EKSİK VAR'
    print(f'Yapısal bütünlük: {status}')
    print(f'Zenginleştirme için: GEMINI_API_KEY=... npx tsx scripts/oxford/enrich_oxford.ts')

    report = {
        'sourceCounts': {f'{k[0]}|{k[1]}': v for k, v in source_counts.items()},
        'sourceSenseCounts': {f'{k[0]}|{k[1]}': v for k, v in source_pos_counts.items()},
        'entries': len(entries),
        'senses': sense_total,
        'uniqueHeadwords': unique_headwords,
        'missing': [s['sourceLine'] for s in missing],
        'content': {
            'completeEntries': complete_entries,
            'meaningOnly': meaning_only,
            'noMeaning': no_meaning,
            'needsReview': needs_review,
            'legacyMeaning': legacy_meaning,
            'senseComplete': sense_complete,
            'senseMeaningOnly': sense_meaning_only,
            'senseEmpty': sense_empty,
        },
        'multiEntryHeadwords': len(multi_entry),
        'differentPos': different_pos,
        'differentQualifier': different_qualifier,
        'differentHomograph': different_homograph,
    }
    with open('scripts/oxford/audit_report.json', 'w', encoding='utf-8') as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write('\n')


if __name__ == '__main__':
    main()
