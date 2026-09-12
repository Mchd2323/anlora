# -*- coding: utf-8 -*-
"""
Anlora – Ortaç biçimlerini Genel Dağarcık'ın KAYNAĞINA yazar.

NEDEN VAR (bir hatadan sonra).

Ortaç kayıtları (trapped, dressing, owing...) önce doğrudan
`src/data/extended/w-*.json` dosyalarına yazılmıştı. Orası ÜRETİLEN çıktı:
`build_bands.py` her koştuğunda o dosyaları `content/` ve `wordlist.json`
kaynaklarından sıfırdan yeniden yazıyor. İlk yeniden derlemede 214 kaydın
hepsi silindi -- kimse fark etmeden, çünkü betik "silmedi", yalnızca
kaynakta olmayanı yeniden üretmedi.

Ders: üretilen bir dosyaya elle yazılan şey, bir sonraki üretimde yok olur.
Bu betik aynı kayıtları KAYNAĞA koyuyor:

  scripts/extended/source/wordlist.json   <- kelime, tür, bant, telaffuz
  scripts/extended/content/ortac.json     <- Türkçe anlam ve örnek cümleler

Böylece `build_bands.py` onları diğer 15 bin kelime gibi üretiyor ve hiçbir
yeniden derleme onları düşürmüyor.

KULLANIM
    python3 scripts/extended/ortac_kaynaga_yaz.py
    python3 scripts/extended/build_bands.py --strict
"""

import json
import os

ROOT = os.getcwd()
ICERIK = os.path.join(ROOT, 'scripts/ortac/icerik.json')
ELLE = os.path.join(ROOT, 'scripts/ortac/elle.json')
LISTE = os.path.join(ROOT, 'scripts/extended/source/wordlist.json')
CIKTI = os.path.join(ROOT, 'scripts/extended/content/ortac.json')

POS_SLUG = {'n.': 'n', 'v.': 'v', 'adj.': 'adj', 'adv.': 'adv',
            'prep.': 'prep', 'conj.': 'conj'}

# Ortaç biçimleri sıklık listesinden gelmiyor (çekim sayıldıkları için
# elenmişlerdi); en sona, kendi bantlarına konuyor.
BANT = 13


def oku(yol):
    if not os.path.exists(yol):
        return []
    with open(yol, encoding='utf-8') as f:
        return json.load(f)


def main():
    kartlar = oku(ICERIK) + oku(ELLE)
    with open(LISTE, encoding='utf-8') as f:
        liste = json.load(f)

    mevcut = {k['word'].lower() for k in liste}
    sonra = max(k['rank'] for k in liste)

    icerik = {}
    eklenen = 0
    atlanan = []

    for kart in kartlar:
        kelime = kart['bicim'].lower()
        pos = kart['partOfSpeech'].strip()
        if pos not in POS_SLUG:
            atlanan.append(f"{kelime} (tür tanınmıyor: {pos})")
            continue
        if kelime in mevcut:
            atlanan.append(f"{kelime} (listede zaten var)")
            continue

        sonra += 1
        liste.append({
            'word': kelime,
            'pos': [pos],
            'rank': sonra,
            'band': BANT,
            # wordlist telaffuzu eğik çizgisiz tutuyor; build_bands ekliyor.
            'ipa': kart['phonetic'].strip('/') or None,
        })
        mevcut.add(kelime)

        icerik[f"gen-b{BANT}-{kelime}-{POS_SLUG[pos]}"] = {
            'turkishMeanings': kart['turkishMeanings'],
            'examples': kart['examples'],
        }
        eklenen += 1

    with open(LISTE, 'w', encoding='utf-8') as f:
        json.dump(liste, f, ensure_ascii=False, indent=1)
    with open(CIKTI, 'w', encoding='utf-8') as f:
        json.dump(icerik, f, ensure_ascii=False, indent=1)

    print(f'Kaynağa yazılan ortaç: {eklenen}')
    print(f'Atlanan: {len(atlanan)}' + (' — ' + ', '.join(atlanan[:8]) if atlanan else ''))
    print(f'wordlist: {len(liste)} kelime')


if __name__ == '__main__':
    main()
