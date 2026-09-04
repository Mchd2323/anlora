"""
Yazı tiplerini pakete gömer.

NEDEN. Uygulama çevrimdışı çalışıyor ama yazı tipleri Google'ın sunucusundan
geliyordu. Telefonda internet yokken — yani uygulamanın asıl vaat ettiği
durumda — hiçbir zaman gelmiyorlar ve arayüz sistem yazı tipine düşüyordu.
Seçilen tipografi yalnızca internetli kullanıcıya görünüyordu. Ayrıca her
açılışta boşa giden bir ağ isteği oluyordu.

NE İNDİRİLİYOR. Yalnızca `latin` ve `latin-ext` altkümeleri. Türkçe'nin
ğ, ş, ı, İ, ö, ü, ç harfleri latin-ext'te; kiril, yunan ve vietnamca
altkümeleri paketi gereksiz büyütür ve bu uygulamada hiç kullanılmaz.

LİSANS. Üç yazı tipi de SIL Open Font License 1.1 ile dağıtılıyor; gömmek
serbest. Lisans metni public/fonts/OFL.txt içinde tutuluyor.

Çalıştırma:  python3 scripts/fonts/fetch_fonts.py
"""
import os
import re
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CIKTI = os.path.join(KOK, "public", "fonts")
CSS_CIKTI = os.path.join(CIKTI, "fonts.css")

# Değişken eksen aralıkları: her ağırlık için ayrı dosya indirmek yerine tek
# dosya gelir, toplam boyut belirgin biçimde düşer.
KAYNAK = (
    "https://fonts.googleapis.com/css2"
    "?family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..600"
    "&family=Manrope:wght@500..800"
    "&family=JetBrains+Mono:wght@400..600"
    # Cinzel: Anlora Realms temasının başlık ve İngilizce kelime yazı tipi.
    # Roma yazıtlarından türeyen bir serif; ortaçağ havasını taşıyor ama
    # süslü bir "fantezi" yazı tipi olmadığı için okunaklılığı bozmuyor.
    "&family=Cinzel:wght@400..700"
    "&display=swap"
)

# Tarayıcı gibi görünmek gerekiyor: Google Fonts, istemciye göre woff2 ya da
# eski biçimleri sunuyor.
AJAN = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

ISTENEN_ALTKUMELER = {"latin", "latin-ext"}


def indir(url: str) -> bytes:
    sonuc = subprocess.run(
        ["curl", "-sS", "-m", "60", "-A", AJAN, url],
        capture_output=True,
        check=False,
    )
    if sonuc.returncode != 0 or not sonuc.stdout:
        raise RuntimeError(f"indirilemedi: {url}\n{sonuc.stderr.decode()[:200]}")
    return sonuc.stdout


def main():
    os.makedirs(CIKTI, exist_ok=True)
    css = indir(KAYNAK).decode("utf-8")

    # Google Fonts CSS'i "/* altküme */" yorumlarıyla bloklara ayırıyor.
    bloklar = re.split(r"/\*\s*([a-z0-9-]+)\s*\*/", css)
    parcalar = []
    indirilen = 0
    toplam_bayt = 0

    # bloklar: ['', 'latin', '@font-face{...}', 'cyrillic', '@font-face{...}', ...]
    for i in range(1, len(bloklar) - 1, 2):
        altkume = bloklar[i]
        govde = bloklar[i + 1]
        if altkume not in ISTENEN_ALTKUMELER:
            continue

        eslesme = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", govde)
        if not eslesme:
            continue
        uzak = eslesme.group(1)

        aile = re.search(r"font-family:\s*'([^']+)'", govde).group(1)
        stil = re.search(r"font-style:\s*(\w+)", govde).group(1)
        agirlik = re.search(r"font-weight:\s*([\d ]+)", govde).group(1).strip()

        ad = f"{aile.replace(' ', '')}-{stil}-{agirlik.replace(' ', '-')}-{altkume}.woff2"
        veri = indir(uzak)
        with open(os.path.join(CIKTI, ad), "wb") as f:
            f.write(veri)
        indirilen += 1
        toplam_bayt += len(veri)

        parcalar.append(govde.replace(uzak, f"/fonts/{ad}").strip())
        print(f"  {ad}  {len(veri)/1024:.0f} KB")

    if indirilen == 0:
        print("HATA: hiçbir yazı tipi indirilemedi.", file=sys.stderr)
        sys.exit(1)

    basluk = (
        "/*\n"
        " * Pakete gömülü yazı tipleri — Google Fonts'tan ÜRETİLDİ, elle düzenleme.\n"
        " * Yeniden üretmek için: python3 scripts/fonts/fetch_fonts.py\n"
        " *\n"
        " * Yalnızca latin ve latin-ext altkümeleri gömülüdür: Türkçe'nin\n"
        " * ğ, ş, ı, İ, ö, ü, ç harfleri latin-ext'te bulunur.\n"
        " *\n"
        " * Plus Jakarta Sans, Manrope, JetBrains Mono ve Cinzel — SIL Open Font License 1.1\n"
        " * (bkz. OFL.txt).\n"
        " */\n\n"
    )
    with open(CSS_CIKTI, "w", encoding="utf-8") as f:
        f.write(basluk + "\n\n".join(parcalar) + "\n")

    print(f"\n{indirilen} dosya, toplam {toplam_bayt/1024:.0f} KB -> public/fonts/")


if __name__ == "__main__":
    main()
