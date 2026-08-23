# -*- coding: utf-8 -*-
"""
Eksik içeriği olan sense'leri elle doldurmak üzere dışa aktarır.

Çıktı, `content/` altındaki yamaların hangi sense'ler için yazılacağını
gösterir. Her satır bir sense: kimlik, madde başı, qualifier, sözcük türü,
seviye ve neyin eksik olduğu.

Kullanım:
    python3 scripts/oxford/export_gaps.py A1          # tek seviye
    python3 scripts/oxford/export_gaps.py A1 --limit 60 --offset 0
"""

import json
import sys

DATA_FILES = ['src/data/oxford3000.json', 'src/data/oxford5000extra.json']


def group_label(entry):
    if entry['sourceCollection'] == 'oxford5000-extra':
        return 'B2 Ek' if entry['cefr'] == 'B2' else entry['cefr']
    return entry['cefr']


def main():
    wanted = sys.argv[1] if len(sys.argv) > 1 else None
    limit = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else 10 ** 9
    offset = int(sys.argv[sys.argv.index('--offset') + 1]) if '--offset' in sys.argv else 0

    rows = []
    for path in DATA_FILES:
        with open(path, encoding='utf-8') as handle:
            for entry in json.load(handle):
                label = group_label(entry)
                if wanted and label != wanted:
                    continue
                for sense in entry['senses']:
                    missing_meaning = not sense['turkishMeanings']
                    missing_examples = len(sense['examples']) < 3
                    if not (missing_meaning or missing_examples):
                        continue
                    rows.append({
                        'senseId': sense['id'],
                        'headword': entry['headword'],
                        'qualifier': entry.get('qualifier'),
                        'homograph': entry.get('homograph'),
                        'pos': sense['partOfSpeech'],
                        'cefr': entry['cefr'],
                        'group': label,
                        'sourceEntry': entry['sourceEntry'],
                        'legacyMeaning': entry.get('legacyMeaning'),
                        'hasMeaning': not missing_meaning,
                        'exampleCount': len(sense['examples']),
                    })

    rows.sort(key=lambda r: (r['headword'], r['pos']))
    window = rows[offset:offset + limit]

    print(f'# {wanted or "TÜMÜ"} — eksik {len(rows)} sense, gösterilen {len(window)} (offset {offset})')
    for row in window:
        bits = []
        if not row['hasMeaning']:
            bits.append('anlam')
        if row['exampleCount'] < 3:
            bits.append(f'örnek({row["exampleCount"]}/3)')
        qualifier = f' ({row["qualifier"]})' if row['qualifier'] else ''
        homograph = f'#{row["homograph"]}' if row['homograph'] else ''
        legacy = f'  ~{row["legacyMeaning"]}' if row['legacyMeaning'] else ''
        print(f'{row["senseId"]}\t{row["headword"]}{homograph}{qualifier}\t{row["pos"]}\t{"+".join(bits)}{legacy}')


if __name__ == '__main__':
    main()
