"""Anlora – Genel Dağarcık kelimeleri için WordNet tanımlarını çıkarır.

NEDEN VAR. İçerik üreticisi (`uret_icerik.ts`) modele yalnızca kelimeyi ve
sözcük türünü veriyordu: "gild (n.)". Model hangi anlamın istendiğini
bilemeyip tahmin ediyor, çok anlamlı kelimelerde yanlış anlamı yazıyordu.
Bant 8'in ilk partisinde 125 kaydın 11'i bu yüzden hatalıydı:

    gild (n.)  -> "altın yaldız"   ama WordNet: "a formal association" (lonca)
    trudge (n.)-> "zorlukla yürümek" ama isim: "a long difficult walk"
    instep (n.)-> "ayakyolu"       ama: "the arch of the foot"

Tanım isteme konulunca model tahmin etmek zorunda kalmıyor. Bant 8-13
arasındaki 11.235 anlamın 11.105'inde (%98,8) WordNet tanımı var.

KAYNAK. Open English WordNet / Princeton WordNet – CC BY 4.0. Tanımlar
yalnızca üretim sırasında modele bağlam olarak verilir; pakete tanım
METNİ girmez, Türkçe karşılık ve örnek cümleler yeniden üretilir.

KULLANIM
    python3 scripts/extended/tanim_uret.py
"""

import json
import os
import sys

try:
    from nltk.corpus import wordnet as wn
except ImportError:
    sys.exit('nltk kurulu değil: pip install nltk')

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LISTE = os.path.join(ROOT, 'scripts/extended/source/wordlist.json')
CIKTI = os.path.join(ROOT, 'scripts/extended/source/tanimlar.json')

# wordlist.json'daki tür etiketi -> WordNet tür kodu. Sıfat WordNet'te iki
# kodla durur: 'a' (asıl sıfat) ve 's' (uydu sıfat, bir başkasının alt anlamı).
TUR = {'n.': ('n',), 'v.': ('v',), 'adj.': ('a', 's'), 'adv.': ('r',)}

# Kaç tanım verilecek. İçerik üreticisi kayıt başına en çok 3 Türkçe karşılık
# yazıyor; üç tanım o üç karşılığın kapsamını belirlemeye yetiyor.
EN_COK = 3


def main():
    with open(LISTE, encoding='utf-8') as h:
        kelimeler = json.load(h)

    tanimlar = {}
    tanimsiz = []
    for k in kelimeler:
        for tur in k['pos']:
            kodlar = TUR.get(tur)
            if not kodlar:
                continue
            anahtar = f"{k['word']}|{tur}"
            if anahtar in tanimlar:
                continue
            bulunan = [s.definition() for s in wn.synsets(k['word']) if s.pos() in kodlar]
            if bulunan:
                tanimlar[anahtar] = bulunan[:EN_COK]
            else:
                tanimsiz.append(anahtar)

    with open(CIKTI, 'w', encoding='utf-8') as h:
        json.dump(tanimlar, h, ensure_ascii=False, indent=0, sort_keys=True)

    toplam = len(tanimlar) + len(tanimsiz)
    print(f'Anlam       : {toplam}')
    print(f'Tanımı olan : {len(tanimlar)} (%{100 * len(tanimlar) / toplam:.1f})')
    print(f'Tanımsız    : {len(tanimsiz)}')
    print(f'Çıktı       : {os.path.relpath(CIKTI, ROOT)}')


if __name__ == '__main__':
    main()
