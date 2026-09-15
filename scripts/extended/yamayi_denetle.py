# -*- coding: utf-8 -*-
"""
Tek bir içerik yamasını, pakete girmeden önce denetler.

NEDEN AYRI BİR ARAÇ. Nihai kapı `build_bands.py --strict`; ama o bütün korpusu
gezer ve tek bir bozuk kayıt yüzünden hata koduyla çıkar. Bir koşuda 939 anlam
tam da böyle kaybedildi: kusur ancak her şey yazıldıktan sonra görüldü. Bu araç
aynı `validate` kurallarını YALNIZCA yeni yamaya uygular, saniyeler içinde, ve
kusurluyu yazılmadan önce söyler.

Denetlediği: `build_bands.validate` (üç örnek, her örnekte kelimenin kendisi,
her örneğin Türkçesi, anlam kelimenin tekrarı değil), artı yamaya özgü iki şey:
kimlik listede var mı (bilinmeyen kimlik `--strict` kapısını kırar) ve kimlik
başka bir dosyada zaten yazılmış mı (tekrar).

Kullanım:
    python3 scripts/extended/yamayi_denetle.py scripts/extended/content/b8-elle-001.json
"""

import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_bands  # noqa: E402

CONTENT_DIR = 'scripts/extended/content'

# Kiril harfleri Latin harflerine gorsel olarak ozdes oldugu icin metne fark
# edilmeden karisir: "kereste" icindeki 's' Kiril 's' olursa sozcuk ekranda
# dogru gorunur ama arama, siralama ve seslendirme kirilir. Iki kayitta tam
# bunun oldugu olculdu; goz denetimi yakalamadi, bu suzgec yakaladi.
KIRIL = re.compile(r'[\u0400-\u04FF]')


def yabanci_harf(payload):
    """Metinde Latin disi (Kiril) harf tasiyan parcalari dondurur."""
    parcalar = list(payload.get('turkishMeanings') or [])
    for ornek in payload.get('examples') or []:
        parcalar.extend([ornek.get('tr') or '', ornek.get('en') or ''])
    return [p for p in parcalar if KIRIL.search(p)]


def main():
    if len(sys.argv) < 2:
        sys.exit('Denetlenecek yama dosyasını verin.')
    paths = sys.argv[1:]

    words = build_bands.load_wordlist()
    bilinen = {}
    for item in words:
        for pos in item['pos']:
            if pos in build_bands.POS_SLUG:
                sid = build_bands.sense_id(item['word'], item['band'], pos)
                bilinen[sid] = (item['word'], pos)

    baskalari = {}
    for other in sorted(glob.glob(os.path.join(CONTENT_DIR, '*.json'))):
        if os.path.abspath(other) in {os.path.abspath(p) for p in paths}:
            continue
        with open(other, encoding='utf-8') as handle:
            for key in json.load(handle):
                baskalari[key] = os.path.basename(other)

    kusur = 0
    sayi = 0
    for path in paths:
        with open(path, encoding='utf-8') as handle:
            yama = json.load(handle)
        for sid, payload in yama.items():
            sayi += 1
            if sid not in bilinen:
                print(f'BİLİNMEYEN KİMLİK  {sid}  ({os.path.basename(path)})')
                kusur += 1
                continue
            if sid in baskalari:
                print(f'TEKRAR  {sid}  zaten {baskalari[sid]} içinde')
                kusur += 1
                continue
            word, pos = bilinen[sid]
            for sorun in build_bands.validate(word, pos, payload, path):
                print(f'KUSUR  {sid}: {sorun}')
                kusur += 1
            for metin in yabanci_harf(payload):
                print(f'KIRIL HARF  {sid}: {metin}')
                kusur += 1

    print(f'--- {sayi} kayıt denetlendi, {kusur} kusur')
    sys.exit(1 if kusur else 0)


if __name__ == '__main__':
    main()
