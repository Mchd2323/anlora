# -*- coding: utf-8 -*-
"""
Elle yazılmış içerik yamalarını Oxford veri kümesine uygular.

Yamalar `scripts/oxford/content/*.json` altında durur ve şu biçimdedir:

    {
      "ox3k-a1-adult-n": {
        "turkishMeanings": ["yetişkin", "erişkin"],
        "examples": [
          {"en": "...", "tr": "..."},
          {"en": "...", "tr": "..."},
          {"en": "...", "tr": "..."}
        ]
      }
    }

Uygulanmadan önce her kayıt denetlenir; geçmeyen yama YAZILMAZ ve rapor
edilir. Böylece bozuk içerik veri kümesine sızamaz.
"""

import json
import glob
import os
import re
import sys

DATA_FILES = ['src/data/oxford3000.json', 'src/data/oxford5000extra.json']
CONTENT_GLOB = 'scripts/oxford/content/*.json'

PLACEHOLDER = re.compile(r'\((isim|fiil|sıfat|zarf|anlam)\)|otomatik anlam|kelimesi', re.I)
# Kelimenin KENDİSİ hakkında konuşan sahte örnekler (talimat 12).
#
# Kalıp hedefe bağlı kurulur: "Look up the word in a dictionary." geçerli bir
# örnektir, "Learning the word absorb is useful." değildir. Sabit bir
# "the word" kalıbı ikisini ayıramaz.
def build_self_referential(headword):
    escaped = re.escape(headword.strip())
    return re.compile(
        r'\b(learning the word|the word\s+["\']?' + escaped + r'|'
        + escaped + r'\s+is an important english word|i learned\s+' + escaped + r')\b',
        re.I,
    )

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from word_match import sentence_contains  # noqa: E402


def validate(patch, headword, sense_pos):
    """Yamanın kabul edilebilir olup olmadığını denetler; hata listesi döner."""
    problems = []

    meanings = patch.get('turkishMeanings') or []
    if not meanings:
        problems.append('anlam yok')
    for meaning in meanings:
        text = (meaning or '').strip()
        if not text:
            problems.append('boş anlam')
        elif PLACEHOLDER.search(text):
            problems.append(f'placeholder anlam: {text}')

    # Anlamın kelimenin kendisi olması tek başına kusur değildir: Türkçeye
    # aynen geçmiş kelimeler var (festival, film, radyo, doktor). Kusur, HİÇBİR
    # karşılığın kelimeden farklı olmamasıdır — o zaman kart öğrenciye hiçbir
    # şey öğretmez.
    if meanings and all(
        (m or '').strip().lower() == headword.strip().lower() for m in meanings
    ):
        problems.append(
            f'tüm anlamlar kelimenin kendisi ({headword}); ayırt edici bir karşılık ekleyin'
        )

    examples = patch.get('examples') or []
    if len(examples) < 3:
        problems.append(f'{len(examples)} örnek (3 gerekli)')

    seen = set()
    for example in examples:
        english = (example.get('en') or '').strip()
        turkish = (example.get('tr') or '').strip()
        if not english or not turkish:
            problems.append('eksik örnek ya da çeviri')
            continue
        if len(english) < 10:
            problems.append(f'çok kısa örnek: {english}')
        if build_self_referential(headword).search(english):
            problems.append(f'kelimenin kendisi hakkında örnek: {english}')
        if not sentence_contains(english, headword):
            problems.append(f'örnek kelimeyi içermiyor: {english}')
        key = english.lower()
        if key in seen:
            problems.append(f'yinelenen örnek: {english}')
        seen.add(key)

    return problems


def main():
    dry_run = '--dry-run' in sys.argv

    patches = {}
    for path in sorted(glob.glob(CONTENT_GLOB)):
        with open(path, encoding='utf-8') as handle:
            data = json.load(handle)
        for sense_id, patch in data.items():
            patches[sense_id] = (patch, os.path.basename(path))

    if not patches:
        print('Uygulanacak yama yok.')
        return

    applied = 0
    rejected = []
    unknown = []

    files = []
    for path in DATA_FILES:
        with open(path, encoding='utf-8') as handle:
            files.append((path, json.load(handle)))

    sense_index = {}
    for _, entries in files:
        for entry in entries:
            for sense in entry['senses']:
                sense_index[sense['id']] = (entry, sense)

    for sense_id, (patch, source) in patches.items():
        target = sense_index.get(sense_id)
        if not target:
            unknown.append((sense_id, source))
            continue
        entry, sense = target
        problems = validate(patch, entry['headword'], sense['partOfSpeech'])
        if problems:
            rejected.append((sense_id, entry['headword'], source, problems))
            continue
        if not dry_run:
            sense['turkishMeanings'] = [m.strip() for m in patch['turkishMeanings']]
            sense['examples'] = [
                {'en': e['en'].strip(), 'tr': e['tr'].strip()} for e in patch['examples']
            ][:3]
        applied += 1

    if not dry_run:
        for _, entries in files:
            for entry in entries:
                complete = all(
                    s['turkishMeanings'] and len(s['examples']) >= 3 for s in entry['senses']
                )
                if complete:
                    entry.pop('needsReview', None)
                    entry.pop('reviewReason', None)
                    entry.pop('legacyMeaning', None)
        for path, entries in files:
            with open(path, 'w', encoding='utf-8') as handle:
                json.dump(entries, handle, ensure_ascii=False, indent=2)
                handle.write('\n')

    print(f'Yama: {len(patches)}   uygulanan: {applied}   reddedilen: {len(rejected)}   bilinmeyen kimlik: {len(unknown)}')
    for sense_id, headword, source, problems in rejected[:20]:
        print(f'  RED  {sense_id} ({headword}) [{source}]')
        for problem in problems:
            print(f'         - {problem}')
    for sense_id, source in unknown[:10]:
        print(f'  BİLİNMEYEN  {sense_id} [{source}]')


if __name__ == '__main__':
    main()
