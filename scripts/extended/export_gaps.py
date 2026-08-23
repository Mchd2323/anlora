# -*- coding: utf-8 -*-
"""
Genel Dağarcık'ta içeriği henüz yazılmamış anlamları listeler.

İçerik elle yazılıyor ve bu iş binlerce anlama yayılıyor; bu yüzden nereye
kalındığını söyleyen bir araç gerekiyor. Çıktı doğrudan bir içerik yamasının
iskeleti olarak kullanılabilir.

Kullanım:
    python3 scripts/extended/export_gaps.py 1            # 1. bant
    python3 scripts/extended/export_gaps.py 1 --limit 150 --offset 300
    python3 scripts/extended/export_gaps.py --summary    # bant bant durum
"""

import glob
import json
import os
import sys

WORDLIST = 'scripts/extended/source/wordlist.json'
CONTENT_DIR = 'scripts/extended/content'
POS_SLUG = {'n.': 'n', 'v.': 'v', 'adj.': 'adj', 'adv.': 'adv'}


def load_done():
    done = set()
    for path in sorted(glob.glob(os.path.join(CONTENT_DIR, '*.json'))):
        with open(path, encoding='utf-8') as handle:
            done.update(json.load(handle).keys())
    return done


def main():
    with open(WORDLIST, encoding='utf-8') as handle:
        words = json.load(handle)
    done = load_done()

    args = sys.argv[1:]
    limit = 200
    offset = 0
    band = None
    summary = '--summary' in args

    for index, arg in enumerate(args):
        if arg == '--limit':
            limit = int(args[index + 1])
        elif arg == '--offset':
            offset = int(args[index + 1])
        elif arg.isdigit() and band is None:
            band = int(arg)

    if summary:
        stats = {}
        for item in words:
            for pos in item['pos']:
                if pos not in POS_SLUG:
                    continue
                sid = f"gen-b{item['band']}-{item['word']}-{POS_SLUG[pos]}"
                total, filled = stats.get(item['band'], (0, 0))
                stats[item['band']] = (total + 1, filled + (1 if sid in done else 0))
        grand_total = grand_filled = 0
        for band_no in sorted(stats):
            total, filled = stats[band_no]
            grand_total += total
            grand_filled += filled
            pct = 100 * filled / total if total else 0
            print(f'Bant {band_no}: {filled:>5}/{total:>5} ({pct:5.1f}%)  kalan {total - filled}')
        pct = 100 * grand_filled / grand_total if grand_total else 0
        print(f'TOPLAM : {grand_filled:>5}/{grand_total:>5} ({pct:5.1f}%)  kalan {grand_total - grand_filled}')
        return

    if band is None:
        sys.exit('Bant numarası verin (1-8) ya da --summary kullanın.')

    missing = []
    for item in words:
        if item['band'] != band:
            continue
        for pos in item['pos']:
            if pos not in POS_SLUG:
                continue
            sid = f"gen-b{band}-{item['word']}-{POS_SLUG[pos]}"
            if sid not in done:
                missing.append((sid, item['word'], pos, item['rank']))

    window = missing[offset:offset + limit]
    print(f'# Bant {band} — eksik {len(missing)} anlam, gösterilen {len(window)} (offset {offset})')
    for sid, word, pos, rank in window:
        print(f'{sid}\t{word}\t{pos}\t#{rank}')


if __name__ == '__main__':
    main()
