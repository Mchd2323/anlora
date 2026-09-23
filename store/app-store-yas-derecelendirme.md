# App Store Connect — Yaş derecelendirme anketi

App Store Connect'te **Uygulama Bilgileri → Yaş Derecelendirmesi (Age
Rating)** altında doldurulur.

Play'in IARC anketinden (`icerik-derecelendirme-formu.md`) ayrı bir belge,
çünkü Apple kendi anketini kendisi yürütür ve soruları başka. Ama ikisinin
dayandığı gerçek aynı ve o gerçek burada da kritik.

---

## Kritik: sözlükte kaba sözcükler ve hakaretler var

Pakette **102 madde** kaba dil, cinsel terim ve etnik/cinsel yönelim
hakareti içeriyor. Gerçek örnekler:

```
fuck        cinsel ilişki için çok kaba sözcük ; İngilizcenin en yaygın küfürü
cunt        kadın cinsel organı için çok kaba sözcük (kullanılmaz)
nigger      siyahlara yönelik en ağır ırkçı hakaret (kullanılmaz)
chink       Çinlilere yönelik etnik hakaret (kullanılmaz)
fag         eşcinsel erkeklere yönelik hakaret (kullanılmaz) ; sigara
brothel     genelev ; fuhuş yapılan bina
erection    dikme işi ; sertleşme
```

Sözcükler *kullanılmıyor*, *tanımlanıyor*; hakaretlerin yanında
"(kullanılmaz)" notu var; örnek cümleler sözcüğü kullanmak yerine
anlatıyor. İçerik sözlükseldir — basılı bir İngilizce–Türkçe sözlükte
olanın aynısı.

**Ama kullanıcı `fuck` yazıp arattığında ekranda o sözcüğü görür.** Ankette
"küfür yok" demek yanlış beyandır.

---

## Apple'da bunun bedeli Play'dekinden ağır

Play tarafında dürüst beyanın sonucu 12+/Teen civarı bir etiketti; katlanılır.
App Store'da sonuç daha sert:

1. **Yüksek yaş etiketi alan uygulama Ekran Süresi / İçerik Kısıtlamaları
   açık cihazlarda hiç görünmez.** Türkiye'de lise öğrencilerinin
   telefonlarında bu ayar sık açıktır.
2. **Apple editörleri yüksek yaş etiketli uygulamaları listelere ve
   koleksiyonlara neredeyse hiç almaz.**
3. Hedef kitlemiz bunu doğrudan vuruyor: anahtar kelimelerimizde **YKS** ve
   **YDS** var. YKS'ye giren öğrenci 17–18 yaşında; ailesinin kısıtlama
   koyduğu bir telefonda uygulamayı bulamaz.

Yani Play'de "dürüst beyan et, geç" demek yeterliydi; burada önce
**bandı paketten çıkarıp çıkarmayacağına karar vermen** gerekiyor.

---

## Üç seçenek

### A) Bant 14 pakette kalsın, dürüst beyan edilsin
- Anket: küfür **var** işaretlenir.
- Sonuç: yüksek yaş etiketi (Apple'ın güncel kademelerinde muhtemelen
  16+ ya da 18+; kademelerin adlarını Console kendi ekranında gösterir).
- Bedeli: yukarıdaki üç madde.
- Kazancı: sözlük eksiksiz kalır.

### B) Bant 14 paketten çıkarılsın
- 102 madde silinir; toplam 30.682 → 30.580.
- Anket: küfür **yok** denebilir, dürüstçe.
- Sonuç: en düşük yaş etiketi, kısıtlama açık cihazlarda da görünür.
- Bedeli: `nigger` ile karşılaşan öğrenci uygulamada karşılığını bulamaz.
- **Önemli:** çıkarılacaksa **iki mağazadan da** çıkarılmalı. Tek pakette
  olup ötekinde olmaması iki ayrı sözlük demek; kod ve içerik ayrışır,
  sonraki her turda iki kez iş çıkar.

### C) Bant 14 kalsın ama varsayılan olarak kapalı olsun
- Ayarlara "Kaba sözcükleri göster" anahtarı eklenir, kapalı gelir.
- Anket: Apple bunu genellikle içeriğin varlığı üzerinden değerlendirir,
  yani yüksek etiketten kurtulmayı garanti etmez. Denemeye değer ama
  garanti değil — bunu bilerek seç.
- Bedeli: yarım gün iş; hem sözlük filtresine hem sınav havuzuna
  dokunmak gerekir.

**Benim önerim: B.** Play tarafında "çıkarma" demiştim; App Store'un
hedef kitleyi doğrudan kesmesi bu kararı değiştiriyor. 102 madde,
30.682'nin binde üçü; karşılığında uygulamanın ulaşabileceği öğrenci
kitlesi ikiye katlanıyor. Öğretici değeri savunulabilir ama bedeli
orantısız.

Karar senin. **"Çıkar" dersen tek turda çıkarır, iki paketi de yeniden
derlerim.**

---

## Anket cevapları — bant 14 PAKETTE KALIRSA (seçenek A)

| Kategori | Cevap | Not |
|---|---|---|
| Karikatür/fantastik şiddet | Yok | |
| Gerçekçi şiddet | Yok | |
| Cinsel içerik veya çıplaklık | Yok | Görsel yok |
| Müstehcen/olgun temalar | **Var** | Anatomik ve cinsel terimler sözlük maddesi olarak |
| **Küfür veya kaba mizah** | **VAR** | Bunu mutlaka işaretle |
| Alkol, tütün, uyuşturucu | **Var** | `arak`, `tipple`, `fag` gibi maddeler |
| Korku/dehşet temaları | Yok | |
| Tıbbi/tedavi bilgisi | Yok | Tıbbi terimler var ama tavsiye yok |
| Kumar (simüle veya gerçek) | Yok | |
| Yarışmalar | Yok | |
| Sınırsız web erişimi | **Yok** | Uygulama içinde tarayıcı yok |
| Kullanıcılar arası mesajlaşma | Yok | |

Açıklama istenirse:

> *Bu bir İngilizce–Türkçe sözlük ve kelime çalışma uygulamasıdır. Kaba
> sözcükler ve hakaretler sözlük maddesi olarak yer alır; sözcükler
> kullanılmaz, tanımlanır ve hakaret niteliği taşıyanların karşısına
> "kullanılmaz" notu düşülmüştür. Amaç, öğrencinin bu sözcüklerle
> karşılaştığında ne olduklarını ve neden kullanılmamaları gerektiğini
> anlamasıdır. Uygulamada görsel içerik, kullanıcılar arası iletişim ya da
> paylaşım yoktur.*

## Anket cevapları — bant 14 ÇIKARILIRSA (seçenek B)

Yukarıdaki tablonun aynısı, şu üç satır değişir:

| Kategori | Cevap |
|---|---|
| Müstehcen/olgun temalar | Yok |
| Küfür veya kaba mizah | **Yok** |
| Alkol, tütün, uyuşturucu | **Yok** |

> Son satır için: `arak` ve `tipple` bant 14'te değil, genel dağarcıkta.
> Ama bunlar yalnızca içki adları — Apple'ın kastettiği "kullanımı
> özendiren içerik" değil. Basılı sözlükte de bu maddeler vardır ve
> kimse onlara yaş etiketi koymaz. "Yok" demek dürüsttür.

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
