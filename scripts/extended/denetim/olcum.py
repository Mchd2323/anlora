"""Denetim turunun ne kadar hata yakaladığını ölçer.

NEDEN VAR. Denetim turunun istemi değiştikçe "daha iyi mi oldu" sorusunun
gözle değil sayıyla yanıtlanması gerekiyor. Elle denetlenmiş referans liste
`olcum-b8.json`, turun bulguları `*-bulgu.json`; bu betik ikisini karşılaştırıp
yakalama ve yanlış alarm oranını yazar.

KULLANIM
    python3 scripts/extended/denetim/olcum.py b8-ai-2026-09-12
"""

import json
import os
import sys

BURASI = os.path.dirname(os.path.abspath(__file__))


def main():
    if len(sys.argv) < 2:
        sys.exit('Kullanım: olcum.py <içerik dosyası adı (uzantısız)>')
    ad = sys.argv[1]

    with open(os.path.join(BURASI, 'olcum-b8.json'), encoding='utf-8') as h:
        referans = json.load(h)['hatalar']
    bulgu_yolu = os.path.join(BURASI, f'{ad}-bulgu.json')
    if not os.path.exists(bulgu_yolu):
        sys.exit(f'Bulgu dosyası yok: {bulgu_yolu}')
    with open(bulgu_yolu, encoding='utf-8') as h:
        bulgu = json.load(h)

    gercek = set(referans)
    bulunan = set(bulgu)
    yakalanan = gercek & bulunan
    kacan = gercek - bulunan
    fazla = bulunan - gercek

    print(f'Referans hata : {len(gercek)}')
    print(f'Tur bildirdi  : {len(bulunan)}')
    print(f'Yakalanan     : {len(yakalanan)} (%{100 * len(yakalanan) / len(gercek):.0f})')
    print(f'Kaçan         : {len(kacan)}')
    print(f'Referansta yok: {len(fazla)}')

    if kacan:
        print('\nKAÇANLAR')
        for k in sorted(kacan):
            print(f'   {k}: {referans[k]}')
    if fazla:
        print('\nREFERANSTA OLMAYANLAR (yanlış alarm ya da benim kaçırdığım hata)')
        for k in sorted(fazla):
            print(f'   {k}: {bulgu[k]}')


if __name__ == '__main__':
    main()
