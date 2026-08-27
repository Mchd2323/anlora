"""
Yazılmış kalıp içeriğini uygulamanın okuduğu veri dosyasına derler.

GİRDİ  scripts/phrases/content/*.json  — elle yazılan Türkçe anlamlar ve
       örnek cümleler (kalıp, tür, anlam, ornekler).
       scripts/phrases/opl-source.json — Oxford Phrase List'ten çıkarılan
       başlıklar ve CEFR seviyeleri.
ÇIKTI  src/data/phrases.json

KAPI. Derleme, veriyi sessizce kabul etmez; şu koşullardan biri bozuksa
durur ve nedenini söyler:
  - içerikte kaynak listede olmayan bir kalıp varsa (yazım hatası)
  - bir kalıp iki kez yazılmışsa
  - anlam boşsa ya da üç örnek cümle yoksa
  - bir örnek cümlenin İngilizcesi ya da Türkçesi boşsa
  - aynı kalıpta iki örnek birebir aynıysa
Yarım veriyle uygulamaya girmek, boş kart göstermekten daha kötüdür:
kullanıcı onu doğru sanır.
"""
import glob
import json
import os
import re
import sys
from collections import Counter

KOK = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KAYNAK = os.path.join(KOK, "scripts", "phrases", "opl-source.json")
ICERIK = os.path.join(KOK, "scripts", "phrases", "content", "*.json")
CIKTI = os.path.join(KOK, "src", "data", "phrases.json")


def kimlik(kalip: str) -> str:
    """Kalıptan kararlı bir kimlik üretir: 'give up' -> 'opl-give-up'."""
    temiz = kalip.lower()
    temiz = temiz.replace("…", "").replace("’", "'")
    temiz = re.sub(r"[^a-z0-9']+", "-", temiz).strip("-")
    return f"opl-{temiz}"


def main():
    kaynak = json.load(open(KAYNAK, encoding="utf-8"))
    seviye_of = {k["kalip"]: k["seviye"] for k in kaynak}
    sira_of = {k["kalip"]: i for i, k in enumerate(kaynak)}
    kullanim_of = {k["kalip"]: k["kullanimlar"] for k in kaynak}

    yazilmis = []
    for yol in sorted(glob.glob(ICERIK)):
        yazilmis.extend(json.load(open(yol, encoding="utf-8")))

    hatalar = []
    gorulen = set()
    kayitlar = []

    for madde in yazilmis:
        kalip = madde.get("kalip", "")
        if kalip not in seviye_of:
            hatalar.append(f"kaynak listede yok: {kalip!r}")
            continue
        if kalip in gorulen:
            hatalar.append(f"iki kez yazılmış: {kalip!r}")
            continue
        gorulen.add(kalip)

        anlamlar = [a.strip() for a in madde.get("anlam", []) if a and a.strip()]
        if not anlamlar:
            hatalar.append(f"anlam boş: {kalip!r}")
            continue

        ornekler = madde.get("ornekler", [])
        if len(ornekler) != 3:
            hatalar.append(f"{len(ornekler)} örnek var, 3 olmalı: {kalip!r}")
            continue
        if any(not o.get("en", "").strip() or not o.get("tr", "").strip() for o in ornekler):
            hatalar.append(f"örnekte boş alan: {kalip!r}")
            continue
        if len({o["en"].strip().lower() for o in ornekler}) != 3:
            hatalar.append(f"örnekler birbirinin aynısı: {kalip!r}")
            continue

        tur = madde.get("tur", "phrase")
        if tur not in {"phrase", "idiom"}:
            hatalar.append(f"tür 'phrase' ya da 'idiom' olmalı: {kalip!r}")
            continue

        kayitlar.append(
            {
                "id": kimlik(kalip),
                "headword": kalip,
                "cefr": seviye_of[kalip],
                "sourceCollection": "oxford-phrases",
                "sourceOrder": sira_of[kalip],
                "sourceEntry": kalip,
                "entryType": tur,
                # Oxford'un kendi alt girdileri: kalıbın hangi biçimlerde
                # kullanıldığını gösterir, tanım değildir.
                "usages": kullanim_of[kalip],
                "senses": [
                    {
                        "id": kimlik(kalip) + "-1",
                        "partOfSpeech": "phrase",
                        "turkishMeanings": anlamlar,
                        "examples": [
                            {"en": o["en"].strip(), "tr": o["tr"].strip()} for o in ornekler
                        ],
                    }
                ],
            }
        )

    if hatalar:
        print(f"{len(hatalar)} sorun bulundu, derleme durduruldu:", file=sys.stderr)
        for h in hatalar[:25]:
            print("  -", h, file=sys.stderr)
        sys.exit(1)

    kayitlar.sort(key=lambda k: k["sourceOrder"])
    os.makedirs(os.path.dirname(CIKTI), exist_ok=True)
    with open(CIKTI, "w", encoding="utf-8") as f:
        json.dump(kayitlar, f, ensure_ascii=False, indent=1)

    dagilim = Counter(k["cefr"] for k in kayitlar)
    eksik = len(kaynak) - len(kayitlar)
    boyut = os.path.getsize(CIKTI) / 1024
    print(f"{len(kayitlar)}/{len(kaynak)} kalıp derlendi ({boyut:.0f} KB)")
    print("Seviye dağılımı:", dict(sorted(dagilim.items())))
    print("Tür dağılımı:", dict(Counter(k["entryType"] for k in kayitlar)))
    if eksik:
        print(f"Henüz yazılmamış: {eksik}")


if __name__ == "__main__":
    main()
