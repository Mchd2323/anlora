# -*- coding: utf-8 -*-
"""
Anlora – Genel Dağarcık bant dosyalarını üretir.

`scripts/extended/source/wordlist.json` hangi kelimelerin hangi bantta
olduğunu söyler; `scripts/extended/content/*.json` ise elle yazılmış Türkçe
anlamları ve örnek cümleleri taşır. Bu betik ikisini birleştirip uygulamanın
okuduğu `src/data/extended/band-N.json` dosyalarını yazar.

TASARIM KARARLARI

1. Yalnızca içeriği hazır kelimeler yazılır. Anlamı olmayan bir kelimeyi
   pakete koymak, kullanıcıya boş kart göstermek olurdu; talimat 59 gereği
   uydurma karşılık da yazılmaz. Kelime içeriği yazılana kadar listede
   bekler, uygulamada görünmez.

2. Bant başına ayrı dosya. Uygulama bantları `import()` ile tembel yükler;
   bellekte yalnızca çalışılan bant durur. Tek dosya olsaydı 14 MB'lık
   sözlük açılışta baştan sona ayrıştırılırdı.

3. Doğrulama Oxford boru hattıyla aynı kuralları kullanır (`word_match`),
   böylece iki koleksiyon arasında kalite farkı oluşmaz.

Kullanım:
    python3 scripts/extended/build_bands.py
    python3 scripts/extended/build_bands.py --strict   # kusur varsa hata kodu
"""

import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'oxford'))
from word_match import sentence_contains  # noqa: E402

WORDLIST = 'scripts/extended/source/wordlist.json'
CONTENT_DIR = 'scripts/extended/content'
OUT_DIR = 'src/data/extended'
MANIFEST = 'src/data/extended/manifest.json'

POS_SLUG = {'n.': 'n', 'v.': 'v', 'adj.': 'adj', 'adv.': 'adv'}

MIN_EXAMPLES = 3


def sense_id(word, band, pos):
    return f'gen-b{band}-{word}-{POS_SLUG[pos]}'


def load_wordlist():
    with open(WORDLIST, encoding='utf-8') as handle:
        return json.load(handle)


def load_content():
    """content/*.json dosyalarını tek sözlükte birleştirir."""
    merged = {}
    for path in sorted(glob.glob(os.path.join(CONTENT_DIR, '*.json'))):
        with open(path, encoding='utf-8') as handle:
            patch = json.load(handle)
        for key, value in patch.items():
            merged[key] = (value, os.path.basename(path))
    return merged


def validate(word, pos, payload, source):
    """Bir anlamın içeriğini denetler; sorun listesi döner."""
    problems = []

    meanings = [m.strip() for m in (payload.get('turkishMeanings') or []) if m.strip()]
    if not meanings:
        problems.append('Türkçe anlam yok')
    elif all(m.lower() == word.lower() for m in meanings):
        problems.append(f'tüm anlamlar kelimenin kendisi ({word})')

    examples = payload.get('examples') or []
    if len(examples) < MIN_EXAMPLES:
        problems.append(f'{len(examples)} örnek ({MIN_EXAMPLES} gerekli)')

    seen = set()
    for example in examples:
        english = (example.get('en') or '').strip()
        turkish = (example.get('tr') or '').strip()
        if not english or not turkish:
            problems.append('örnek eksik çeviri taşıyor')
            continue
        if english.lower() in seen:
            problems.append(f'yinelenen örnek: {english}')
        seen.add(english.lower())
        if not sentence_contains(english, word):
            problems.append(f'örnek kelimeyi içermiyor: {english}')

    return problems


def main():
    strict = '--strict' in sys.argv

    words = load_wordlist()
    content = load_content()

    by_band = {}
    filled_senses = 0
    total_senses = 0
    defects = []
    unknown = []

    known_ids = set()
    for item in words:
        for pos in item['pos']:
            if pos in POS_SLUG:
                known_ids.add(sense_id(item['word'], item['band'], pos))

    for key in content:
        if key not in known_ids:
            unknown.append(key)

    for item in words:
        word = item['word']
        band = item['band']
        senses = []

        for pos in item['pos']:
            if pos not in POS_SLUG:
                continue
            total_senses += 1
            sid = sense_id(word, band, pos)
            if sid not in content:
                continue
            payload, source = content[sid]
            problems = validate(word, pos, payload, source)
            if problems:
                defects.append((sid, source, problems))
                continue
            senses.append({
                'id': sid,
                'partOfSpeech': pos,
                'turkishMeanings': [m.strip() for m in payload['turkishMeanings'] if m.strip()],
                'examples': [
                    {'en': e['en'].strip(), 'tr': e['tr'].strip()}
                    for e in payload['examples']
                ],
            })
            filled_senses += 1

        if not senses:
            continue

        by_band.setdefault(band, []).append({
            'id': f'gen-b{band}-{word}',
            'headword': word,
            'cefr': 'C1',
            'sourceCollection': 'extended',
            'sourceOrder': item['rank'],
            'sourceEntry': f"{word} {', '.join(item['pos'])}",
            'senses': senses,
            'variants': [],
            'phonetic': f"/{item['ipa']}/" if item.get('ipa') else None,
            'band': band,
        })

    os.makedirs(OUT_DIR, exist_ok=True)

    manifest = []
    for band in sorted(by_band):
        entries = sorted(by_band[band], key=lambda e: e['sourceOrder'])
        path = os.path.join(OUT_DIR, f'band-{band}.json')
        with open(path, 'w', encoding='utf-8') as handle:
            json.dump(entries, handle, ensure_ascii=False, indent=1)
            handle.write('\n')
        manifest.append({
            'band': band,
            'entryCount': len(entries),
            'senseCount': sum(len(e['senses']) for e in entries),
        })

    # Henüz hiç içerik almamış bantlar da bildirilir; arayüz "hazırlanıyor"
    # diyebilsin diye toplam hedefi de yazıyoruz.
    planned = {}
    for item in words:
        planned[item['band']] = planned.get(item['band'], 0) + 1
    with open(MANIFEST, 'w', encoding='utf-8') as handle:
        json.dump({
            'bands': manifest,
            'plannedWordsPerBand': planned,
            'totalPlannedWords': len(words),
        }, handle, ensure_ascii=False, indent=1)
        handle.write('\n')

    print(f'Kelime listesi : {len(words)} kelime / {total_senses} anlam')
    print(f'İçerik yamaları: {len(content)} kayıt')
    print(f'Yazılan        : {sum(m["entryCount"] for m in manifest)} kelime / {filled_senses} anlam')
    if manifest:
        print('Bantlar        : ' + ', '.join(
            f'b{m["band"]}={m["entryCount"]}' for m in manifest))
    if unknown:
        print(f'\nBİLİNMEYEN KİMLİK: {len(unknown)}')
        for key in unknown[:10]:
            print(f'  {key}')
    if defects:
        print(f'\nKUSURLU: {len(defects)}')
        for sid, source, problems in defects[:20]:
            print(f'  {sid} [{source}]')
            for problem in problems:
                print(f'      - {problem}')

    if strict and (defects or unknown):
        sys.exit(1)


if __name__ == '__main__':
    main()
