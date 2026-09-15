# Anlora'yı Google Play'e yükleme rehberi

Sıfırdan yayına kadar bütün adımlar. Her adımda **ne yapacağın**, **hangi
dosyayı kullanacağın** ve **nereye dikkat edeceğin** yazıyor.

Bu rehberdeki uygulamaya ait bütün sayılar ve dosyalar gerçek; depodan
okundu, tahmin edilmedi.

---

## Uygulamanın künyesi

| Alan | Değer | Nereden |
|---|---|---|
| Paket adı (applicationId) | `com.anlora.app` | `android/app/build.gradle` |
| Uygulama adı | Anlora | `android/app/src/main/res/values/strings.xml` |
| minSdk | 23 (Android 6.0) | `android/variables.gradle` |
| targetSdk | 35 (Android 15) | `android/variables.gradle` |
| İstenen izin | Yalnızca `INTERNET` | `AndroidManifest.xml` |
| Sözlük | 30.682 kelime / 35.068 anlam / 105.204 örnek cümle | ölçüldü |
| Paket boyutu | ~10 MB (AAB) | derleme çıktısı |

**Paket adı bir kere seçilir, bir daha değişmez.** `com.anlora.app` ile
yüklediğin an bu isim sonsuza kadar senindir ve değiştirmek için yeni bir
uygulama açman gerekir. Değiştirecek olsaydın şimdi söylemen gerekirdi;
etmeyeceksen devam.

---

## 0. Önce şu ikisini halletmen gerekiyor

### 0.1 Gizlilik politikası adresi (SENİN YAPMAN GEREKİYOR)

Play Console gizlilik politikası için **çalışan bir internet adresi**
istiyor. Metin hazır, depoda duruyor (`docs/index.html`) ama yayında değil.

**Yapılacak:** GitHub'da depo sayfasına git →
**Settings → Pages** → Source: *Deploy from a branch* →
Branch: `claude/new-github-project-aix9zr`, klasör: `/docs` → **Save**.

Birkaç dakika sonra adres şu olur:

```
https://mchd2323.github.io/anlora/
```

Aç, açıldığını gör, sonra Play Console'a gir. **Açılmadan devam etme** —
Play boş adresi reddeder.

> İleride `main` dalına birleştirirsen Pages kaynağını da `main` + `/docs`
> olarak değiştirmen gerekir, yoksa adres ölür.

### 0.2 Geliştirici hesabı

Play Console geliştirici hesabı tek seferlik **25 ABD doları** ister.
Hesap yoksa https://play.google.com/console adresinden açılır.

**Kişisel hesap açtıysan dikkat:** Google, kişisel (kurumsal olmayan) yeni
hesaplardan üretime çıkmadan önce **kapalı test** yapmasını istiyor —
belirli sayıda test kullanıcısı, belirli bir süre kesintisiz. Sayı ve süre
zaman zaman değişiyor; Console sana kendi ekranında güncel şartı
gösterecek. Bu şart varsa üretime çıkman haftalar sürer, buna göre plan
yap. Kurumsal (şirket) hesapta bu şart yok.

---

## 1. Play Console'da uygulamayı oluştur

**Tüm uygulamalar → Uygulama oluştur**

| Alan | Ne gireceksin |
|---|---|
| Uygulama adı | `Anlora` ya da `Anlora: İngilizce Kelime` (en fazla 30 karakter) |
| Varsayılan dil | Türkçe (Türkiye) — tr-TR |
| Uygulama mı, oyun mu | **Uygulama** |
| Ücretsiz mi, ücretli mi | **Ücretsiz** |

> **Ad önerisi:** `Anlora: İngilizce Kelime` (24 karakter). Tek başına
> "Anlora" kimsenin aramadığı bir kelime; mağaza aramasında bulunmazsın.
> İçinde "İngilizce Kelime" geçmesi aramada karşılığı olan tek şey.
> Karar senin.

> **"Ücretsiz" seçimi geri alınamaz.** Ücretsiz yayınlanan bir uygulama
> sonradan ücretliye çevrilemez. Anlora'da ücretli özellik olmayacağına
> göre sorun yok.

---

## 2. Mağaza sayfası (Store listing)

**Büyüt → Mağaza varlığı → Ana mağaza girişi**

| Alan | Kaynak dosya |
|---|---|
| Kısa açıklama (80 krk) | `store/play-store-aciklamalar.md` — 79 karakter |
| Tam açıklama (4000 krk) | `store/play-store-aciklamalar.md` — 3276 karakter |
| Uygulama simgesi | `store/icon-512.png` (512×512) |
| Öne çıkan grafik | `store/feature-graphic-1024x500.png` (1024×500) |
| Telefon ekran görüntüleri | `store/screenshots/01…05` (5 adet, 1080×1920) |

Hepsi Play'in ölçü şartlarına uygun, ölçüldü. Kopyala–yapıştır ve yükle,
üzerinde oynamana gerek yok.

**Tablet ekran görüntüleri** istenmiyor (zorunlu değil). Koymazsan
uygulama tablet aramalarında geri sıralara düşer ama yayını engellemez.
İstersen 7 ve 10 inçlik görüntüleri de üretebilirim — söylemen yeterli.

---

## 3. Uygulama içeriği formları

**Politika ve programlar → Uygulama içeriği.** Buradaki her form
doldurulmadan yayına çıkılamaz.

| Form | Ne yapacaksın |
|---|---|
| Gizlilik politikası | 0.1'deki adresi yapıştır |
| Reklamlar | **"Hayır, uygulamam reklam içermiyor"** — doğru, reklam ağı yok |
| Uygulama erişimi | **"Tüm işlevler kısıtlama olmadan kullanılabilir"** — üyelik/giriş yok, test hesabı istemeyecekler |
| İçerik derecelendirmesi | **`store/icerik-derecelendirme-formu.md` dosyasını aç ve oradaki cevapları gir.** Küfür beyanı kritik |
| Hedef kitle ve içerik | **13–17 ve 18+.** 13 yaş altını seçme (sebebi derecelendirme belgesinde) |
| Haber uygulaması | Hayır |
| COVID-19 izleme | Hayır |
| Veri güvenliği | **`store/veri-guvenligi-formu.md` dosyasını aç ve oradaki cevapları gir** |
| Devlet uygulaması | Hayır |
| Finansal özellikler | Hiçbiri |
| Sağlık uygulaması | Hayır |

---

## 4. İmzalama — burada dikkatli ol

Play, **Play App Signing** (Play Uygulama İmzalama) kullanmanı zorunlu
tutuyor. Nasıl çalıştığı:

- Senin anahtarın artık **yükleme anahtarı** olur. AAB'yi onunla imzalarsın.
- Google paketi açar, **kendi ürettiği dağıtım anahtarıyla** yeniden imzalar.
- Kullanıcının telefonuna giden imza Google'ınkidir, seninki değil.

### Bunun yarattığı gerçek sorun

GitHub'dan indirilen APK **senin anahtarınla** imzalı. Play'den inen APK
**Google'ın anahtarıyla** imzalı. Android bu ikisini farklı uygulama
sayar. Sonuç:

> GitHub APK'sını kurmuş biri, Play sürümünü **üzerine kuramaz.** Önce
> uygulamayı silmesi gerekir; sildiğinde bütün ilerlemesi gider.

İki yolun var:

**A) Google'ın anahtar üretmesine izin ver (Play'in önerdiği).** Kolay ve
güvenli; anahtarı kaybetme riski yok. Karşılığında yukarıdaki kopukluğu
kabul edersin. GitHub APK'sı bundan sonra yalnızca "kendim denerim"
paketidir; kimseye dağıtma.

**B) Kendi anahtarını Play'e yükle.** Uygulama oluştururken
"Mevcut bir uygulama imzalama anahtarını dışa aktar ve yükle" yolunu
seçersin. O zaman Play senin anahtarınla imzalar, iki kanal birbiriyle
uyumlu kalır. Karşılığında: anahtarı kaybedersen Google'ın yapabileceği
bir şey yoktur, uygulamayı bir daha güncelleyemezsin.

**Benim önerim: A.** Anlora'yı GitHub'dan indirenler bir avuç test
kullanıcısı; Play'e geçtikten sonra dağıtım kanalın tek olacak. Anahtar
kaybetme riskini almaya değmez.

**Kararın ne olursa olsun:** keystore dosyasını ve şifresini bir yedekte
sakla. Depo herkese açık, o yüzden **keystore asla depoya girmeyecek** —
şu an da girmiş değil, `ANLORA_KEYSTORE_BASE64` gizlisinde duruyor.

---

## 5. Sürümü yükle

**Sürüm → Üretim → Yeni sürüm oluştur**

1. **AAB dosyasını yükle** — `anlora-aab` artefaktının içinden çıkan
   `.aab` dosyası. **APK'yı yükleme, Play kabul etmez.**
2. Sürüm adı: otomatik gelir (`1.0.64` gibi), dokunma.
3. **Sürüm notları** — aşağıdaki metni olduğu gibi kullanabilirsin:

```
<tr-TR>
Anlora'nın ilk sürümü.

• 30.000'den fazla İngilizce kelime, Türkçe karşılıkları ve üçer örnek cümle
• Oxford 3000 ve Oxford 5000 listeleri, CEFR seviyeleriyle
• Aralıklı tekrar: her kelimeyi unutmaya yakın olduğun gün karşına çıkarır
• Çoktan seçmeli, yazarak ve dinleyerek sınav
• Kendi kelime setlerini oluştur
• Tamamen çevrimdışı. Reklam yok, üyelik yok, ücretli özellik yok.
</tr-TR>
```

4. **İnceleme için gönder.**

İnceleme genelde birkaç gün sürer; ilk yüklemede daha uzun olabilir.

---

## 6. Ülke ve fiyatlandırma

**Sürüm → Ülkeler / bölgeler.** Türkiye'yi mutlaka seç. Uygulama
arayüzü Türkçe olduğu için mantıklı kapsam Türkiye'dir; ama tamamen
çevrimdışı ve ücretsiz olduğundan bütün ülkelere açmanın da zararı yok.
Yurt dışındaki Türkçe konuşanlar için ikincisi daha iyi.

---

## 7. Yayından sonra

- **Play Console → Kalite → Android Vitals** — çökme oranını buradan izle.
- **Değerlendirmeler** — kullanıcı yorumlarına buradan cevap verebilirsin.
- Yeni sürüm çıkarmak: bu depoda iş akışını tekrar çalıştır, çıkan AAB'yi
  yeni bir üretim sürümü olarak yükle. `versionCode` CI'da otomatik artıyor,
  elle bir şey yapman gerekmiyor.

---

## Yayın öncesi kontrol listesi

- [ ] GitHub Pages açıldı, `https://mchd2323.github.io/anlora/` açılıyor
- [ ] Play Console geliştirici hesabı var (25 USD ödendi)
- [ ] Uygulama oluşturuldu, paket adı `com.anlora.app`
- [ ] Kısa + tam açıklama girildi
- [ ] Simge, öne çıkan grafik, 5 ekran görüntüsü yüklendi
- [ ] Gizlilik politikası adresi girildi
- [ ] Reklam: yok
- [ ] Uygulama erişimi: kısıtlama yok
- [ ] İçerik derecelendirme anketi dolduruldu (**küfür beyanı işaretlendi**)
- [ ] Hedef kitle: 13+ (13 yaş altı **seçilmedi**)
- [ ] Veri güvenliği formu dolduruldu
- [ ] İmzalama yolu seçildi (A veya B), keystore yedeklendi
- [ ] AAB yüklendi (APK değil)
- [ ] Sürüm notları girildi
- [ ] Ülkeler seçildi
- [ ] İncelemeye gönderildi

---

## Bilmen gereken iki risk

**1. targetSdk barajı.** Şu an targetSdk 35. Google her yıl 31 Ağustos'ta
bu barajı yükseltir ve barajın altındaki yeni uygulamaları kabul etmez.
Yükleme sırasında Console "hedef API seviyesi yetersiz" derse
`android/variables.gradle` içindeki `targetSdkVersion` ve
`compileSdkVersion` değerlerini bir üst seviyeye çekip yeniden derlememiz
gerekir. Bu on dakikalık iştir; söylemen yeterli.

**2. Sözlükteki küfür maddeleri.** İçerik derecelendirme belgesinde
ayrıntısıyla yazdım. Kısacası: ankette dürüst beyan et, 13 yaş altını
hedef kitle seçme. Beyan edip yaş sınırını doğru koyarsan sorun çıkmaz;
beyan etmezsen ve Google sonradan fark ederse uygulama kaldırılır.

---

## Bu rehber için üretilen paket

| | |
|---|---|
| Koşu | [#64](https://github.com/Mchd2323/anlora/actions/runs/35031791438) |
| İşleme | `235adbd` — 1.156 yapay zekâ kaydının tamamı okunmuş hâli |
| `anlora-aab` | 10.195.150 bayt — **Play Console'a yüklenecek olan** |
| `anlora-apk` | 10.158.088 bayt — telefona doğrudan kurmak için |
| Artefakt ömrü | 14 Aralık 2026 |

Derlemede "Sunucu adresi pakete girdi mi?" ve "İmzayı doğrula" adımlarının
ikisi de geçti: paket imzalı ve Anlora AI bu sürümde çalışıyor.
