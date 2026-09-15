# -*- coding: utf-8 -*-
"""
İçeriği yazılmamış anlamları, WordNet tanımlarıyla birlikte listeler.

NEDEN AYRI BİR ARAÇ. `export_gaps.py` yalnızca "hangi anlam eksik" der; tanımı
vermez. Bant 8'in ilk 125 kaydında ölçülen şuydu: modele sadece "gild (n.)"
denince kayıtların %13'ü yanlış anlama yazıldı, WordNet tanımı verilince aynı
hata sınıfı kapandı. İçeriği kim yazarsa yazsın -- betik, model ya da insan --
tanımı görmeden yazmamalı. Bu araç iş kuyruğunu tanımla birlikte çıkarır.

Çıktı satır başına bir anlam, sekme ayraçlı:
    <sid>\t<kelime>\t<tür>\t<tanım 1> ~ <tanım 2> ~ <tanım 3>

Kullanım:
    python3 scripts/extended/is_kuyrugu.py 8
    python3 scripts/extended/is_kuyrugu.py 9 --limit 60 --offset 120
"""

import argparse
import glob
import json
import os

WORDLIST = 'scripts/extended/source/wordlist.json'
SKIPLIST = 'scripts/extended/source/skiplist.json'
TANIMLAR = 'scripts/extended/source/tanimlar.json'
CONTENT_DIR = 'scripts/extended/content'
POS_SLUG = {'n.': 'n', 'v.': 'v', 'adj.': 'adj', 'adv.': 'adv'}
EN_COK_TANIM = 3


def yazilmislar():
    done = set()
    for path in sorted(glob.glob(os.path.join(CONTENT_DIR, '*.json'))):
        with open(path, encoding='utf-8') as handle:
            done.update(json.load(handle).keys())
    return done


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('bant', type=int)
    parser.add_argument('--limit', type=int, default=60)
    parser.add_argument('--offset', type=int, default=0)
    args = parser.parse_args()

    with open(WORDLIST, encoding='utf-8') as handle:
        words = json.load(handle)
    with open(SKIPLIST, encoding='utf-8') as handle:
        skipped = {k for k in json.load(handle) if not k.startswith('_')}
    with open(TANIMLAR, encoding='utf-8') as handle:
        tanimlar = json.load(handle)

    done = yazilmislar()
    missing = []
    for item in words:
        if item['band'] != args.bant or item['word'] in skipped:
            continue
        for pos in item['pos']:
            if pos not in POS_SLUG:
                continue
            sid = f"gen-b{args.bant}-{item['word']}-{POS_SLUG[pos]}"
            if sid in done:
                continue
            defs = tanimlar.get(f"{item['word']}|{pos}") or []
            missing.append((sid, item['word'], pos, defs[:EN_COK_TANIM]))

    window = missing[args.offset:args.offset + args.limit]
    tanimsiz = sum(1 for row in window if not row[3])
    print(f'# Bant {args.bant}: eksik {len(missing)}, bu pencere {len(window)} '
          f'(offset {args.offset}), tanımsız {tanimsiz}')
    for sid, word, pos, defs in window:
        print(f"{sid}\t{word}\t{pos}\t{' ~ '.join(defs) if defs else '(tanım yok)'}")


if __name__ == '__main__':
    main()
