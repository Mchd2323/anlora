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

2. ÇIKTI: BİR DİZİN + HARF DOSYALARI.

   Önceki sürüm bant başına bir dosya yazıyordu ve arayüz kullanıcıya
   "hangi bandı indirmek istersin?" diye soruyordu. Bu yanlış bir soruydu:
   kullanıcı hangi bantta hangi kelimelerin olduğunu bilemez. Bu katmanın
   işi kullanıcıya liste sunmak değil, KELİME EKLERKEN sözlük olmak —
   aranan kelime burada varsa yapay zekâya hiç gerek kalmaz.

   Bu yüzden iki tür dosya yazılır:

   * `index.json` — yalnızca madde başları (~55 KB). Açılışta bir kez
     yüklenir; "bu kelime sözlükte var mı" sorusu ağ ya da ayrıştırma
     maliyeti olmadan yanıtlanır.
   * `w-<harf>.json` — o harfle başlayan kelimelerin tam kaydı. Yalnızca
     kullanıcı gerçekten o kelimeyi seçtiğinde yüklenir. En büyüğü ~436 KB,
     ortalaması ~138 KB; bant dosyaları 1,3 MB'a kadar çıkıyordu.

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
INDEX_FILE = 'src/data/extended/index.json'

POS_SLUG = {'n.': 'n', 'v.': 'v', 'adj.': 'adj', 'adv.': 'adv'}

MIN_EXAMPLES = 3


def shard_key(word):
    """Kelimenin hangi harf dosyasına gireceği.

    İngilizce madde başları ASCII'dir; yine de beklenmedik bir karakter
    gelirse '_' kovasına düşer ve sessizce kaybolmaz.
    """
    first = (word or '').strip().lower()[:1]
    return first if 'a' <= first <= 'z' else '_'


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

    # Eski bant dosyaları artık üretilmiyor; kalmışsa temizlenir ki pakete
    # kullanılmayan megabaytlar sızmasın.
    for stale in glob.glob(os.path.join(OUT_DIR, 'band-*.json')):
        os.remove(stale)

    all_entries = []
    for band in sorted(by_band):
        all_entries.extend(by_band[band])
    all_entries.sort(key=lambda e: e['sourceOrder'])

    # --- Harf dosyaları -------------------------------------------------
    shards = {}
    for entry in all_entries:
        letter = shard_key(entry['headword'])
        shards.setdefault(letter, []).append(entry)

    for letter in sorted(shards):
        entries = sorted(shards[letter], key=lambda e: e['headword'])
        path = os.path.join(OUT_DIR, f'w-{letter}.json')
        with open(path, 'w', encoding='utf-8') as handle:
            json.dump(entries, handle, ensure_ascii=False, separators=(',', ':'))
            handle.write('\n')

    # --- Dizin ----------------------------------------------------------
    #
    # Yalnızca madde başları. Sıralı tutulur: arayüz ikili arama ya da önek
    # taraması yapabilsin, ayrıca dosya daha iyi sıkışsın.
    index_words = sorted({e['headword'] for e in all_entries})
    with open(INDEX_FILE, 'w', encoding='utf-8') as handle:
        json.dump({
            'version': 1,
            'wordCount': len(index_words),
            'senseCount': sum(len(e['senses']) for e in all_entries),
            'letters': sorted(shards),
            'words': index_words,
        }, handle, ensure_ascii=False, separators=(',', ':'))
        handle.write('\n')

    manifest = [
        {
            'band': band,
            'entryCount': len(by_band[band]),
            'senseCount': sum(len(e['senses']) for e in by_band[band]),
        }
        for band in sorted(by_band)
    ]

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
