# store/ — mağaza evrakları

Anlora iki mağazaya çıkıyor. Bu klasördeki dosyalar o iki süreç için
gereken metinleri, formları ve görselleri tutuyor.

**Nereden başlanır:** kendi mağazanın rehberini aç, adımları sırayla
izle. Rehberler diğer dosyalara gerektiği yerde yönlendiriyor.

---

## Google Play

| Dosya | Ne işe yarar |
|---|---|
| **`play-console-rehberi.md`** | **Buradan başla.** Uçtan uca adımlar, kontrol listesi |
| `play-store-aciklamalar.md` | Kısa (80) ve tam (4000) açıklama |
| `veri-guvenligi-formu.md` | Data safety formunun her kutusu |
| `icerik-derecelendirme-formu.md` | IARC anketi |

## App Store

| Dosya | Ne işe yarar |
|---|---|
| **`app-store-rehberi.md`** | **Buradan başla.** Uçtan uca adımlar, Play'den farklar, ret riskleri |
| `app-store-aciklamalar.md` | Ad, altyazı, anahtar kelimeler, tanıtım metni, açıklama |
| `app-store-gizlilik-etiketleri.md` | Privacy Nutrition Labels |
| `app-store-yas-derecelendirme.md` | Yaş derecelendirme anketi |

## Görseller

| Yol | Ne | Hangi mağaza |
|---|---|---|
| `icon-512.png` | 512×512 simge | Play |
| `feature-graphic-1024x500.png` | Öne çıkan grafik | Play |
| `screenshots/` | 5 adet 1080×1920 | Play |
| `ios/app-store-icon-1024.png` | 1024×1024 simge, alfasız | App Store |
| `ios/screenshots/iphone-6.9/` | 5 adet 1320×2868 | App Store |
| `ios/screenshots/ipad-13/` | 5 adet 2064×2752 | App Store |

Ekran görüntülerini yeniden üretmek için:

```bash
npx vite --port 5199 --host 127.0.0.1 &
node scripts/store/tohum-uret.mjs
node scripts/store/ekran-goruntusu-al.mjs        # Play
node scripts/store/ios-ekran-goruntusu-al.mjs    # App Store
```

---

## İki mağazayı birden ilgilendiren iki karar

Bunlar tek tek formlarda değil, ikisinde birden karşına çıkıyor.

### 1. Sözlükteki 102 kaba madde

Pakette küfür ve etnik hakaret maddeleri var (sözlüksel biçimde:
tanımlanıyor, kullanılmıyor). Her iki mağazada da **beyan edilmesi
zorunlu.**

İki mağazadaki bedeli farklı, o yüzden iki belgede iki ayrı öneri var:

- **Play:** dürüst beyan et, bandı tut. Sonuç 12+ civarı bir etiket;
  katlanılır. → `icerik-derecelendirme-formu.md`
- **App Store:** bandı çıkarmayı ciddi ciddi düşün. Yüksek yaş etiketi
  alan uygulama Ekran Süresi kısıtlaması açık cihazlarda hiç görünmüyor
  ve hedef kitlemiz (YKS/YDS öğrencileri) tam olarak orada.
  → `app-store-yas-derecelendirme.md`

**Çıkarma kararı verilirse iki paketten de çıkarılmalı.** Tek pakette olup
ötekinde olmaması iki ayrı sözlük demek; sonraki her içerik turunda iş
ikiye katlanır.

### 2. Gizlilik politikası adresi

İkisi de aynı adresi kullanıyor:

```
https://mchd2323.github.io/anlora/
```

Metin `docs/index.html` içinde hazır ama **GitHub Pages açılmadan bu adres
çalışmıyor** ve iki mağaza da boş adresi reddediyor. Açma adımı iki
rehberin de 0. maddesinde.

---

## Bu dosyaları güncel tutmak

Uygulama değiştikçe burası da değişmeli. Mağazadaki metinle buradaki metin
ayrışırsa hangisinin doğru olduğu belirsizleşir.

Özellikle şunlar bir şey değişince eskir:

- **Kelime sayısı** (şu an 30.682). `play-store-aciklamalar.md` ve
  `app-store-aciklamalar.md` içinde geçiyor.
- **Aralık merdiveni** (1, 3, 7, 14, 30, 60, 120, 240) —
  `src/utils/srsEngine.ts` içindeki `INTERVAL_LADDER`'dan geliyor.
- **Sınav biçimleri** — `src/utils/quizGenerator.ts` içindeki `QuizMode`.
- **Ağa çıkan yerler** — iki gizlilik belgesi de bunlara dayanıyor. Yeni
  bir `fetch` eklenirse ikisi de güncellenmeli.
