# Genel Dağarcık (20.000 kelime katmanı)

Oxford çekirdeği (4.952 kelime / 5.947 anlam) resmî listelerden gelir ve
dokunulmaz. Bu klasör onun üstüne, uygulamayı **20.000 kelimeye** taşıyan
ikinci katmanı üretir: 15.048 kelime, 18.088 anlam.

Amaç kapsam: kullanıcı kendi kelimesini eklediğinde çoğu zaman zaten
listede bulunsun, yapay zekâya başvurmak istisna olsun. Veri pakete
gömülüdür, çalışma zamanında ağ kullanılmaz.

## Kaynaklar

| Kaynak | Lisans | Ne verir |
|---|---|---|
| [Open English WordNet](https://github.com/globalwordnet/english-wordnet) | CC BY 4.0 | Kelime dağarcığı, sözcük türü, IPA telaffuz |
| [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles) | MIT | Sıklık sıralaması — hangi kelime önce öğretilir |
| [NameDatabases](https://github.com/smashew/NameDatabases) | — | Özel adları elemek için |

İkisi de yeniden dağıtıma izin verir. Türkçe karşılıklar ve örnek cümleler
kaynaklardan alınmaz; `content/` altında elle yazılır.

## Akış

```
source/wordlist.json          15.048 kelime: yazım, POS, sıklık sırası, bant, IPA
      +
content/*.json                elle yazılan Türkçe anlamlar ve örnek cümleler
      ↓  build_bands.py
src/data/extended/band-N.json uygulamanın okuduğu, tembel yüklenen bantlar
```

Yalnızca içeriği hazır kelimeler bant dosyalarına yazılır. Anlamı olmayan
kelime pakete girmez; uydurma karşılık da yazılmaz (talimat 59).

## Komutlar

```bash
# Kelime listesini yeniden üret (girdileri indirmeniz gerekir; build_wordlist.py başlığına bakın)
python3 scripts/extended/build_wordlist.py /tmp/anlora-src

# Nerede kalındı?
python3 scripts/extended/export_gaps.py --summary
python3 scripts/extended/export_gaps.py 1 --limit 150 --offset 0

# İçeriği bantlara derle
python3 scripts/extended/build_bands.py
python3 scripts/extended/build_bands.py --strict   # kusur varsa hata kodu
```

## Bantlar

Kelimeler sıklığa göre 2.000'erlik bantlara ayrılır (son bant 1.048).
Uygulama bantları `import()` ile tembel yükler: bellekte yalnızca çalışılan
bant durur. Tek dosya olsaydı 14 MB'lık sözlük açılışta baştan sona
ayrıştırılır, zayıf telefonlarda açılışı yavaşlatırdı.

## Süzgeçler

Ham frekans listesi film altyazılarından gelir ve doğrudan kullanılamaz.
Elenenler:

| Süzgeç | Adet | Örnek |
|---|---:|---|
| Zaten Oxford'da var | 4.799 | `about`, `people` |
| Mevcut kelimenin çekimi | 2.471 | `going`→`go`, `bigger`→`big` |
| Özel ad | 479 | `john`, `mike` |
| Üç harften kısa | 95 | `em`, `ya` |
| Müstehcen / aşağılayıcı | 88 | öğrenci hedefli uygulama |
| Amerikan/İngiliz yazım ikizi | 46 | `color`→`colour` |
| Ünlem, altyazı ses notu | 32 | `ooh`, `[panting]` |

`NAME_BUT_REAL` listesi, ad veritabanında geçen ama gerçek sözcük olan
kelimeleri korur (`wolf`, `sheriff`, `fairy`, `clay`).
