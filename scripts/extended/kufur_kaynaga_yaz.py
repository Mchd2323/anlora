# -*- coding: utf-8 -*-
"""
Anlora – Süzgeçle elenen sözcükleri Genel Dağarcık'ın KAYNAĞINA yazar.

NEDEN VAR. `build_wordlist.py` kelime listesini üretirken iki süzgeç
uyguluyor -- `VULGAR` (küfür ve müstehcen, 82 madde) ve `SLUR` (ırkçı ve
etnik hakaret, 31 madde) -- ve bu sözcükler listeye hiç girmiyor. Kullanıcı
ikisinin de sözlükte olmasını istedi: bunlar öğrencinin dizide, filmde,
günlük konuşmada gerçekten karşılaştığı sözcükler; karşılığını bilmemek bir
eksiklik ve hangisinin ağır olduğunu bilmemek daha büyük bir eksiklik.

KAYIT AĞIRLIĞINI SÖYLER. Bu sözcüklerin Türkçe karşılığı yazılırken
kaydın küfür ya da hakaret olduğu belirtiliyor (`uyari` alanı); iyi bir
sözlük de kullanım etiketi koyar. Karşılığı "aptal" diye yazıp ne kadar
ağır olduğunu söylememek, öğrenciyi yanlış yere götürür.

NEDEN KAYNAĞA YAZIYOR. `src/data/extended/*` ÜRETİLEN çıktıdır;
`build_bands.py` her koştuğunda onu `content/` ve `wordlist.json`
kaynaklarından sıfırdan yazar. Üretilen dosyaya elle yazılan şey ilk yeniden
derlemede yok olur -- ortaç kayıtlarında tam olarak bu oldu, 214 kayıt
silindi. Bu yüzden sözcükler kaynağa, kelime listesine ekleniyor; Türkçe
karşılığı ve örnek cümleleri `uret_icerik.ts` diğer kelimeler gibi üretiyor.

TÜR VE TELAFFUZ WordNet'ten geliyor. WordNet'te bulunmayan sözcük
EKLENMİYOR: türünü ve anlamını uydurmak talimat 59'a aykırı olurdu.

KULLANIM
    python3 scripts/extended/kufur_kaynaga_yaz.py
    python3 scripts/extended/tanim_uret.py
    # sonra bu bant için: uret_icerik.ts --bant <BANT>
"""

import json
import os
import re
import sys

try:
    from nltk.corpus import wordnet as wn
except ImportError:
    sys.exit('nltk kurulu değil: pip install nltk')

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
URETICI = os.path.join(ROOT, 'scripts/extended/build_wordlist.py')
LISTE = os.path.join(ROOT, 'scripts/extended/source/wordlist.json')

# WordNet tür kodu -> wordlist.json'daki etiket.
TUR = {'n': 'n.', 'v': 'v.', 'a': 'adj.', 's': 'adj.', 'r': 'adv.'}

# Sıklık listesinden gelmiyorlar (süzgeç yüzünden hiç girmemişlerdi);
# en sona, kendi bantlarına konuyorlar.
BANT = 14


def suzgec_kumesi(ad):
    """build_wordlist.py içindeki kümeyi okur; liste tek yerde dursun."""
    with open(URETICI, encoding='utf-8') as h:
        kaynak = h.read()
    blok = re.search(r'^' + ad + r' = \{(.*?)^\}', kaynak, re.S | re.M)
    if not blok:
        sys.exit(f'build_wordlist.py içinde {ad} kümesi bulunamadı.')
    return sorted(set(re.findall(r"'([^']+)'", blok.group(1))))


def main():
    with open(LISTE, encoding='utf-8') as h:
        kelimeler = json.load(h)
    mevcut = {k['word'] for k in kelimeler}
    enBuyukRank = max(k['rank'] for k in kelimeler)

    kufur = suzgec_kumesi('VULGAR')
    hakaret = suzgec_kumesi('SLUR')
    hepsi = sorted(set(kufur) | set(hakaret))

    eklenen, zaten, bulunamayan = [], [], []
    for kelime in hepsi:
        if kelime in mevcut:
            zaten.append(kelime)
            continue
        turler = sorted({TUR[s.pos()] for s in wn.synsets(kelime) if s.pos() in TUR})
        if not turler:
            bulunamayan.append(kelime)
            continue
        enBuyukRank += 1
        eklenen.append({
            'word': kelime,
            'pos': turler,
            'rank': enBuyukRank,
            'band': BANT,
            'ipa': None,
            # İçerik üreticisi bu alanı görüp Türkçe karşılığa kullanım
            # etiketi koyuyor: "küfür" mü, "hakaret" mi.
            'uyari': 'hakaret' if kelime in hakaret else 'küfür'
        })

    if eklenen:
        kelimeler.extend(eklenen)
        with open(LISTE, 'w', encoding='utf-8') as h:
            json.dump(kelimeler, h, ensure_ascii=False, indent=1)

    kufurSayi = sum(1 for e in eklenen if e['uyari'] == 'küfür')
    print(f'Eklenen      : {len(eklenen)} kelime (bant {BANT})'
          f' -- {kufurSayi} küfür, {len(eklenen) - kufurSayi} hakaret')
    print(f'Zaten listede: {len(zaten)}')
    print(f'WordNet\'te yok, eklenmedi: {len(bulunamayan)}'
          + (f" -> {', '.join(bulunamayan)}" if bulunamayan else ''))
    print(f'Liste toplamı: {len(kelimeler)} kelime')


if __name__ == '__main__':
    main()
