# Genel Dağarcık (uygulamayı 20.000 kelimeye taşıyan katman)

Oxford çekirdeği (4.952 madde başı / 5.947 anlam) resmî listelerden gelir ve
dokunulmaz. Bu klasör onun üstüne ikinci katmanı üretir: **15.048 kelime,
18.115 anlam**. İkisi birlikte uygulamanın dağarcığını tam **20.000 kelimeye**
çıkarır.

Kelimeler sıklık sırasına göre seçilir: listeye giren 15.048 kelime,
Oxford'da bulunmayanlar arasında günlük İngilizcede en sık geçenlerdir.

Amaç kapsam: kullanıcı kendi kelimesini eklediğinde çoğu zaman zaten
listede bulunsun, yapay zekâya başvurmak istisna olsun. Veri pakete
gömülüdür, çalışma zamanında ağ kullanılmaz.

## Kaynaklar

| Kaynak | Lisans | Ne verir |
|---|---|---|
| [Open English WordNet](https://github.com/globalwordnet/english-wordnet) | CC BY 4.0 | Kelime dağarcığı, sözcük türü, IPA telaffuz |
| [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles) | MIT | Sıklık sıralaması — hangi kelime önce öğretilir |
| [NameDatabases](https://github.com/smashew/NameDatabases) | — | Özel adları elemek için |

İlk ikisi de yeniden dağıtıma izin verir. Türkçe karşılıklar ve örnek
cümleler kaynaklardan alınmaz; `content/` altında elle yazılır.

## Akış

```
source/wordlist.json          15.052 kelime: yazım, POS, sıklık sırası, bant, IPA
source/skiplist.json          hedeften çıkarılan 4 madde + gerekçesi
      +
content/*.json                elle yazılan Türkçe anlamlar ve örnek cümleler
      ↓  build_bands.py
src/data/extended/index.json  yalnızca madde başları (~160 KB), açılışta yüklenir
src/data/extended/w-<harf>.json  o harfin tam kayıtları, seçilince yüklenir
```

Yalnızca içeriği hazır kelimeler yazılır. Anlamı olmayan kelime pakete
girmez; uydurma karşılık da yazılmaz (talimat 59).

Çıktı bant başına değil harf başına bölünür: "bu kelime sözlükte var mı"
sorusu yalnızca `index.json` ile yanıtlanır, tam kayıt ancak kullanıcı o
kelimeyi seçtiğinde okunur. Gerekçesi `build_bands.py` başlığında.

## Komutlar

```bash
# Kelime listesini yeniden üret (girdileri indirmeniz gerekir; build_wordlist.py başlığına bakın)
python3 scripts/extended/build_wordlist.py /tmp/anlora-src

# Var olan listeyi bozmadan büyüt — büyütme her zaman böyle yapılır
python3 scripts/extended/build_wordlist.py /tmp/anlora-src --extend-to 16000

# Nerede kalındı?
python3 scripts/extended/export_gaps.py --summary
python3 scripts/extended/export_gaps.py 8 --limit 200

# İçeriği derle
python3 scripts/extended/build_bands.py
python3 scripts/extended/build_bands.py --strict   # kusur varsa hata kodu
```

### Neden ekleme kipi

`content/*.json` anahtarları `gen-b<bant>-<kelime>-<tür>` biçiminde ve bant,
kelimenin listedeki sırasından geliyor. Kaynaklar zamanla değiştiği için
listeyi sıfırdan üretmek mevcut kelimeleri kaydırabilir ve yazılmış on
binlerce anlamın anahtarını kırabilir. `--extend-to` var olan kayıtları bire
bir korur, yalnızca sonuna ekler.

## Bantlar

Kelimeler sıklığa göre 2.000'erlik bantlara ayrılır (sekizinci bant 1.052).
Bant numarası artık yükleme birimi değil; içerik anahtarlarının ve ilerleme
takibinin çıpası olarak duruyor.

## Süzgeçler

Ham frekans listesi film altyazılarından gelir ve doğrudan kullanılamaz.
15.052 kelimeye ulaşırken elenenler:

| Süzgeç | Adet | Örnek |
|---|---:|---|
| Zaten Oxford'da var | 4.801 | `about`, `people` |
| Mevcut kelimenin çekimi | 3.794 | `going`→`go`, `bigger`→`big` |
| Özel ad | 490 | `john`, `mike` |
| Amerikan/İngiliz yazım ikizi | 118 | `color`→`colour` |
| Müstehcen / aşağılayıcı | 97 | öğrenci hedefli uygulama |
| Üç harften kısa | 96 | `em`, `ya` |
| Ünlem, altyazı ses notu | 67 | `ooh`, `[panting]` |

`NAME_BUT_REAL` listesi, ad veritabanında geçen ama gerçek sözcük olan
kelimeleri korur (`wolf`, `sheriff`, `fairy`, `clay`).

## Skiplist

Kural tabanlı süzgeçlerden kaçan birkaç madde `source/skiplist.json` ile
hedeften çıkarılır; anahtar madde başı, değer de gerekçedir. İki tür var:

* İngilizce sözlük maddesi olmayan altyazı artıkları (`nuna`, `unnie`,
  `nagi`) — karşılık yazmak uydurma içerik üretmek olurdu,
* müstehcen sözcük süzgecinden türev olduğu için kaçanlar
  (`masturbator`) — uygulama öğrencilere yönelik.

Liste bu dört maddeyi kapsayacak kadar uzun tutulur: 15.052 kayıttan 15.048'i
pakete girer, toplam yine 20.000 kelime eder.
