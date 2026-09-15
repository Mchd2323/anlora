# Genel Dağarcık (uygulamayı 30.000 kelimenin üstüne taşıyan katman)

Oxford çekirdeği (3.308 + 2.015 madde başı) resmî listelerden gelir ve
dokunulmaz. Bu klasör onun üstüne ikinci katmanı üretir: **24.609 kelime,
28.371 anlam**. Kalıplarla birlikte uygulamanın dağarcığı **30.682 kelimeye**
çıkar:

| Koleksiyon | Madde başı |
|---|---:|
| Genel Dağarcık | 24.609 |
| Oxford 3000 | 3.308 |
| Oxford 5000 ek | 2.015 |
| Kalıplar | 750 |
| **Toplam** | **30.682** |

Kelimeler sıklık sırasına göre seçilir: listeye giren 24.609 kelime,
Oxford'da bulunmayanlar arasında günlük İngilizcede en sık geçenlerdir.
On dört bandın tamamı yazılmıştır; `build_bands.py --strict` bilinmeyen
kimlik ve kusurlu kayıt bulmadan geçer.

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
source/wordlist.json          24.614 kelime: yazım, POS, sıklık sırası, bant, IPA
source/skiplist.json          hedeften çıkarılan 5 madde + gerekçesi
      +
content/*.json                elle yazılan Türkçe anlamlar ve örnek cümleler
      ↓  build_bands.py
src/data/extended/index.json  yalnızca madde başları (~273 KB), açılışta yüklenir
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

Kelimeler sıklığa göre 2.000'erlik bantlara ayrılır; on üçüncü bant 512,
on dördüncü bant 102 madde başı taşır. Bant numarası artık yükleme birimi
değil; içerik anahtarlarının ve ilerleme takibinin çıpası olarak duruyor.

On dördüncü bant küfür, müstehcenlik ve hakaret maddelerinden oluşur ve en
sona bırakılmıştır. Bu maddeler pakete girer, çünkü bir sözlüğün işi
kullanıcının karşılaştığı kelimeyi tanıtmaktır. Türkçe karşılık maddenin ne
olduğunu söyler ve etnik hakaret, cinsel yönelim hakareti ya da engelli
aşağılaması olanları "(kullanılmaz)" ibaresiyle işaretler; örnek cümleler
sözcüğü bir kişiye yöneltmez, ne olduğunu ve neden kullanılmaması
gerektiğini anlatır.

## Süzgeçler

Ham frekans listesi film altyazılarından gelir ve doğrudan kullanılamaz.
Aşağıdaki sayılar listenin İLK üretimine (15.052 kelime) aittir; liste daha
sonra `--extend-to` ile 24.614'e büyütüldü ve bu tablo yeniden sayılmadı.
Süzgeçlerin kendisi değişmedi, yalnızca aşağıdaki adetler o ilk turun
ölçümüdür:

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
  `nagi`, `needleman`) — karşılık yazmak uydurma içerik üretmek olurdu,
* sözlük maddesi olmayan, gerçek bir kişiyi hedef alarak türetilmiş kampanya
  sözcüğü (`santorum`).

Müstehcenlik gerekçesiyle çıkarma YAPILMIYOR: kullanıcı bu kelimelerin
sözlükte kalmasını istedi. Liste bu beş maddeyi kapsayacak kadar uzun
tutulur: 24.614 kayıttan 24.609'u pakete girer.
