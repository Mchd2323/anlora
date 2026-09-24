# App Store Connect — Yaş derecelendirme anketi

App Store Connect'te **Uygulama Bilgileri → Yaş Derecelendirmesi (Age
Rating)** altında doldurulur.

Play'in IARC anketinden (`icerik-derecelendirme-formu.md`) ayrı bir belge,
çünkü Apple kendi anketini kendisi yürütür ve soruları başka. Ama ikisinin
dayandığı gerçek aynı.

---

## Karar verildi ve uygulandı: küfür bandı paketten çıkarıldı

Bu belgenin önceki sürümü üç seçenek sunuyordu ve B'yi öneriyordu.
**B uygulandı.** Bant 14'ün 102 başlığı ve 150 anlamı kaynaktan çıkarıldı,
bu sözcükleri kaynağa geri yazan betik silindi, paket yeniden üretildi.
Ayrıntı: `icerik-derecelendirme-formu.md`.

Yeni toplam: **30.580 kelime / 34.918 anlam / 104.754 örnek cümle**
(önceki: 30.682 / 35.068 / 105.204).

Kaldırma iki paket için de geçerli: kelime verisi tek kaynaktan üretiliyor,
Android ve iOS aynı `src/data/extended/*` dosyalarını taşıyor. Ayrı sözlük
yok.

---

## Bunu "artık her şey Yok" diye doldurma

Bu belgenin önceki sürümünde, B seçeneği için verilen cevap tablosu iki
satırda **yanlıştı**: "Müstehcen/olgun temalar → Yok" ve "Alkol, tütün,
uyuşturucu → Yok" diyordu. Gerekçe olarak `arak` ve `tipple`nin yalnızca
içki adları olduğu yazılmıştı.

Paket ölçüldüğünde tablo tutmuyor. Aşağıdakilerin hepsi **Oxford 3000 /
5000 resmî kelime listelerinden** geliyor ve pakette duruyor:

```
cinsellik     sex, sexual, naked, nude, breast, virgin, condom,
              prostitute, prostitution, abortion, rape
madde/alkol   alcohol, beer, wine, drunk, cigarette, smoke, drug
şiddet/ölüm   kill, murder, war, weapon, gun, suicide
```

`rape` maddesi özellikle dikkat ister: bant 14'ten gelmiyor, Oxford 5000
C1 listesinde duruyor ve Oxford çekirdek verisi bu projede salt okunur.
Küfür değil, hukuki/klinik bir terim — ama cinsellik beyanında anılması
gerekir.

Küfürün gitmesi bu satırları değiştirmez. Değişen tek satır küfür satırı.

---

## Anket cevapları

| Kategori | Cevap | Not |
|---|---|---|
| Karikatür/fantastik şiddet | Yok | |
| Gerçekçi şiddet | Yok | `kill`, `war`, `murder` tanımdır, betimleme değil |
| Cinsel içerik veya çıplaklık | Yok | Görsel yok |
| Müstehcen/olgun temalar | **Var** | Cinsel ve anatomik terimler Oxford listelerinde sözlük maddesi olarak |
| **Küfür veya kaba mizah** | **Yok** | Bant 14 çıkarıldı; `VULGAR`/`SLUR` süzgeçleri üretimde yerinde |
| Alkol, tütün, uyuşturucu | **Var** | `alcohol`, `beer`, `wine`, `cigarette`, `drug` Oxford listelerinde |
| Korku/dehşet temaları | Yok | |
| Tıbbi/tedavi bilgisi | Yok | Tıbbi terimler var ama tavsiye yok |
| Kumar (simüle veya gerçek) | Yok | `gamble` sözlük maddesidir, oynanabilir kumar değil |
| Yarışmalar | Yok | |
| Sınırsız web erişimi | **Yok** | Uygulama içinde tarayıcı yok |
| Kullanıcılar arası mesajlaşma | Yok | |

Açıklama istenirse:

> *Bu bir İngilizce–Türkçe sözlük ve kelime çalışma uygulamasıdır. Küfür
> ve hakaret maddeleri pakette yer almaz. Cinsellik, alkol ve madde ile
> ilgili terimler, Oxford 3000/5000 resmî kelime listelerinin maddeleri
> olarak sözlüksel tanım biçiminde bulunur; görsel içerik, müstehcen
> anlatım, kullanıcılar arası iletişim ya da paylaşım yoktur.*

---

## Beklenen sonuç

Küfür satırı "Yok"a döndüğü için etiketin, önceki sürümde anlatılan
16+/18+ senaryosundan belirgin biçimde **daha düşük** çıkması bekleniyor.
Kesin kademeyi Apple'ın kendi motoru verir; bu belge tahmin yürütüyor.

Bu, yaş etiketinin en alt kademeye ineceği anlamına gelmiyor:
"Müstehcen/olgun temalar" ve "Alkol, tütün, uyuşturucu" satırları hâlâ
"Var" ve Apple bunlara da bakıyor.

Ekran Süresi / İçerik Kısıtlamaları açık cihazlarda görünürlük konusu bu
yüzden tamamen kapanmış sayılmamalı — ama kaldırma öncesine göre
uygulamanın önü açıldı. Hedef kitlemizdeki **YKS** ve **YDS** öğrencileri
17–18 yaşında; asıl önemli olan eşik buydu.

---

## Kullanıcı tarafından oluşturulan içerik ve yapay zekâ

Apple, kullanıcı içeriği barındıran uygulamalardan filtreleme ve
bildirme mekanizması ister (yönerge 1.2).

**Anlora'da uygulanmaz, çünkü hiçbir şey paylaşılmıyor.** Kullanıcı kendi
kelime kartlarını oluşturur ama bunlar yalnızca kendi cihazında kalır;
başka bir kullanıcıya ulaşmaz, bir akışta görünmez.

**Anlora AI'ya dair not:** bu özellik kullanıcıya metin üretiyor. Üretilen
kart uygunsuz çıkarsa kullanıcının bunu bildirebileceği bir yol var —
uygulama içindeki geri bildirim penceresinin "kelime" türü tam olarak bunun
için. İnceleme sırasında sorulursa gösterilecek yer burası. Ayrıca yapay
zekâ üretimi kartlar "doğrulanmadı" etiketiyle işaretlenir; kullanıcı neyin
insan eliyle yazıldığını, neyin üretildiğini görür.
