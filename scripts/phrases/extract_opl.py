"""
Oxford Phrase List'ten kalıp başlıklarını ve CEFR seviyelerini çıkarır.

NE ALINIR, NE ALINMAZ. Yalnızca kalıbın kendisi ve seviyesi alınır. Oxford'un
İngilizce tanımları ve örnek cümleleri alınmaz — onlar yayıncının telifli
içeriğidir. Türkçe anlamlar ve örnek cümleler sözlüğün geri kalanıyla aynı
hatta, elle yazılır.

BİÇİM. PDF dört sütunlu. Başlıklar sütunun sol kenarında (x ≈ 42,5 / 173 /
304 / 434), alt girdiler ~5,7 punto girintili durur. Girintili satırlar ayrı
bir kalıp değil, üstteki kalıbın kullanım biçimleridir; başlık sayısı bu
ayrım yapılmazsa 750 yerine 1000'i geçer.

Çalıştırma:  python3 scripts/phrases/extract_opl.py <pdf> <cikti.json>
"""
import json
import sys

import pypdf

SUTUN_X = [42.5, 173.0, 304.0, 434.0]
SEVIYELER = {"A1", "A2", "B1", "B2", "C1"}
# Sayfa üstbilgisi ve tanıtım metni; kalıp değildir.
ATILACAK_PARCALAR = (
    "Oxford University Press",
    "Oxford Phrase List",
    "prepositional phrases",
)
ATILACAK_TAM = {"verbs", "compounds", "collocations", ",", "phrasal"}


def sutun_no(x: float):
    for i, s in enumerate(SUTUN_X):
        if abs(x - s) < 9:
            return i
    return None


def cikar(pdf_yolu: str):
    okuyucu = pypdf.PdfReader(pdf_yolu)
    kayitlar = []

    for sayfa_no, sayfa in enumerate(okuyucu.pages):
        parcalar = []

        def gorucu(text, cm, tm, font, size):
            t = text.strip()
            if t:
                parcalar.append((round(tm[5], 1), round(tm[4], 1), t))

        sayfa.extract_text(visitor_text=gorucu)

        # Aynı satırdaki parçalar birleştirilir: PDF, virgül gibi işaretleri
        # ayrı çizim çağrısına bölebiliyor.
        satirlar = {}
        for y, x, t in parcalar:
            sutun = sutun_no(x)
            if sutun is None:
                continue
            anahtar = (sutun, round(y))
            girintili = (x - SUTUN_X[sutun]) > 3
            if anahtar in satirlar:
                satirlar[anahtar] = (satirlar[anahtar][0], satirlar[anahtar][1] + t)
            else:
                satirlar[anahtar] = (girintili, t)

        for (sutun, y), (girintili, metin) in satirlar.items():
            # Sıralama: sayfa, sütun, sonra yukarıdan aşağı (y azalan).
            kayitlar.append((sayfa_no, sutun, -y, girintili, metin))

    kayitlar.sort()

    kaliplar = []
    aktif_seviye = None
    for _, _, _, girintili, metin in kayitlar:
        if metin in SEVIYELER and not girintili:
            aktif_seviye = metin
            continue
        if aktif_seviye is None:
            continue
        if any(p in metin for p in ATILACAK_PARCALAR) or metin in ATILACAK_TAM:
            continue
        if metin.startswith("©") or metin.startswith("The Oxford"):
            continue
        if girintili:
            if kaliplar:
                kaliplar[-1]["kullanimlar"].append(metin)
        else:
            kaliplar.append({"kalip": metin, "seviye": aktif_seviye, "kullanimlar": []})

    return kaliplar


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)

    kaliplar = cikar(sys.argv[1])

    # PDF'in kendi beyanı 750. Sayı tutmuyorsa ayrıştırma bozulmuş demektir;
    # sessizce yanlış veri üretmektense durmak daha iyi.
    if len(kaliplar) != 750:
        print(f"HATA: 750 başlık beklendi, {len(kaliplar)} bulundu.", file=sys.stderr)
        sys.exit(1)

    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(kaliplar, f, ensure_ascii=False, indent=1)

    from collections import Counter

    dagilim = Counter(k["seviye"] for k in kaliplar)
    print(f"{len(kaliplar)} kalıp -> {sys.argv[2]}")
    print("Seviye dağılımı:", dict(sorted(dagilim.items())))


if __name__ == "__main__":
    main()
