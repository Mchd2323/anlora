# Anlora'yı App Store'a yükleme rehberi

Play rehberinin (`play-console-rehberi.md`) iOS karşılığı. Aynı uygulama,
ama süreç epey farklı — aşağıda önce farklar, sonra adımlar.

---

## Play'den beş temel fark

| | Google Play | App Store |
|---|---|---|
| Hesap ücreti | **25 USD, bir kere** | **99 USD, HER YIL** |
| Yüklenen dosya | AAB | IPA |
| Derleme ortamı | Herhangi bir makine | **Yalnızca macOS + Xcode** |
| İnceleme | Çoğunlukla otomatik, birkaç gün | **İnsan inceler**, 1–3 gün ama ret daha sık |
| Metinde rakip platform adı | Serbest | **"Android" yazarsan reddedilir** (yönerge 2.3.10) |

Yıllık ücret önemli: **ödemeyi keserseniz uygulama mağazadan kalkar.**
Play'de bir kere ödenir ve uygulama orada kalır.

---

## Mac'e ihtiyacın var mı? Hayır.

Xcode olmadan iOS paketi üretilemez, Xcode da yalnızca macOS'ta çalışır.
Ama Mac'i **sen** almak zorunda değilsin: depoya eklediğim
`.github/workflows/ios-ipa.yml` iş akışı GitHub'ın macOS koşucusunda
çalışıyor. Depo herkese açık olduğu için o koşucu ücretsiz.

İş akışı iki şey yapar:

- **Her koşuda** imzasız derleme — "proje derleniyor mu, eklentiler
  bağlanıyor mu" sorusunu Mac'e oturmadan cevaplar. Çıkan dosya telefona
  kurulamaz; tek işi hatayı erken göstermek.
- **Apple gizlileri tanımlıysa** imzalı IPA — App Store Connect'e
  yüklenebilecek gerçek dosya.

İstersen yüklemeyi de iş akışına ekleyebilirim (App Store Connect API
anahtarıyla), o zaman süreç uçtan uca Mac'siz yürür. Şimdilik eklemedim,
çünkü anahtar sende yok.

---

## 0. Önce şunlar

### 0.1 Gizlilik politikası adresi
Play ile **aynı adres** kullanılır:
```
https://mchd2323.github.io/anlora/
```
GitHub Pages hâlâ açılmadıysa `play-console-rehberi.md` 0.1 adımı.
Apple da boş adresi reddeder.

### 0.2 Apple Developer Program üyeliği
https://developer.apple.com/programs/ — yılda 99 USD.
Onay birkaç gün sürebilir; kimlik doğrulaması isteniyor.

### 0.3 Bundle ID'yi kaydet
Apple Developer → Certificates, Identifiers & Profiles → Identifiers →
yeni App ID:
```
com.anlora.app
```
Android paketiyle aynı — bilerek. İki mağazada aynı kimliği taşımak
ileride derin bağlantı (universal links) kurmayı kolaylaştırır.

Yetenek (capability) işaretleme: **hiçbirini işaretleme.** Anlora push
bildirimi, iCloud, Sign in with Apple, ödeme — hiçbirini kullanmıyor.
Gereksiz yetenek işaretlemek imza profilini şişirir ve incelemede soru
çıkarır.

> Depoda `@capacitor/push-notifications` paketi duruyor ama kod yolu
> kapalı (sunucu `accounts: false` döndüğü için hiç çalışmıyor). Push
> yeteneğini **işaretleme**; işaretlersen Apple "bildirim göndermiyorsunuz,
> neden bu yetenek var" diye sorabilir.

### 0.4 İmza malzemesini üret
İş akışının imzalı IPA üretmesi için dört gizli gerekiyor. Bunları üretmek
için **bir kere** bir Mac'e (ya da Apple Developer web arayüzüne) girmen
gerekiyor:

| Gizli | Nereden |
|---|---|
| `APPLE_TEAM_ID` | Apple Developer → Membership → Team ID (10 haneli) |
| `APPLE_CERTIFICATE_BASE64` | Apple Distribution sertifikası `.p12` olarak dışa aktarılır, sonra `base64 -i sertifika.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | O `.p12` dışa aktarılırken verdiğin şifre |
| `APPLE_PROVISIONING_PROFILE_BASE64` | App Store dağıtım profili indirilir, `base64 -i profil.mobileprovision \| pbcopy` |

GitHub'da: depo → Settings → Secrets and variables → Actions → New
repository secret.

> **Sertifika depoya girmeyecek.** Android keystore'u için kural neyse
> burada da o: yalnızca gizlilerde durur. Depo herkese açık.

---

## 1. App Store Connect'te uygulamayı oluştur

https://appstoreconnect.apple.com → Uygulamalarım → **+ → Yeni Uygulama**

| Alan | Değer |
|---|---|
| Platformlar | **iOS** |
| Ad | `Anlora: İngilizce Kelime` |
| Birincil dil | **Türkçe** |
| Paket kimliği | `com.anlora.app` |
| SKU | `anlora-ios` (kendi kaydın için, kullanıcı görmez) |
| Kullanıcı erişimi | Tam Erişim |

---

## 2. Mağaza metinleri

Hepsi `store/app-store-aciklamalar.md` dosyasında hazır, karakter
sayıları ölçülü:

| Alan | Sınır | Bizimki |
|---|---|---|
| Ad | 30 | 24 |
| Altyazı | 30 | 27 |
| Anahtar kelimeler | 100 | 89 |
| Tanıtım metni | 170 | 131 |
| Açıklama | 4000 | 3751 |

**Play metnini buraya kopyalama.** İçinde "Android" geçiyor ve bu tek
başına ret sebebi (yönerge 2.3.10). Ayrı dosya tam bu yüzden var.

---

## 3. Görseller

| Ne | Dosya | Ölçü |
|---|---|---|
| Uygulama simgesi | `store/ios/app-store-icon-1024.png` | 1024×1024, **alfa yok**, kare |
| iPhone 6.9" ekran görüntüleri | `store/ios/screenshots/iphone-6.9/` (5 adet) | 1320×2868 |
| iPad 13" ekran görüntüleri | `store/ios/screenshots/ipad-13/` (5 adet) | 2064×2752 |

**iPad görüntüleri zorunlu**, çünkü Xcode projesinde
`TARGETED_DEVICE_FAMILY = "1,2"` — uygulama iPad'i de destekliyor.
Desteklemek isteyip istemediğin bir tercih: iPad düzeni gerçekten farklı
(üst gezinme çubuğu, çok sütunlu kart ızgarası) ve iyi görünüyor, o yüzden
açık bıraktım. Kapatmak istersen söyle, `TARGETED_DEVICE_FAMILY = 1`
yaparım ve iPad görüntüleri gereksiz hale gelir.

> **Simge hakkında bir uyarı.** Elimizdeki en büyük kaynak 512×512'ydi;
> App Store 1024 istediği için büyütüldü. İnce altın çizgilerde hafif
> yumuşama var. Mağaza sayfasında simge büyük gösterilir, o yüzden
> orijinali 1024'te yeniden üretebiliyorsan daha iyi olur. Şu hâliyle de
> kabul edilir, sadece en iyisi değil.

Simgeyi hazırlarken iki şey düzeltildi: **alfa kanalı kaldırıldı**
(Apple alfa içeren simgeyi reddeder) ve **köşelerdeki yuvarlatma
dolduruldu** (iOS köşeyi kendisi yuvarlar; önceden yuvarlatılmış simge
çift kesilir ve kenarlarda boşluk görünür).

---

## 4. Formlar

| Form | Nerede | Ne yapacaksın |
|---|---|---|
| Yaş derecelendirmesi | Uygulama Bilgileri | **`store/app-store-yas-derecelendirme.md`** — küfür bandı çıkarıldı, oradaki tabloyu olduğu gibi gir |
| Uygulama gizliliği | Uygulama Gizliliği | **`store/app-store-gizlilik-etiketleri.md`** |
| Gizlilik politikası adresi | Uygulama Gizliliği | 0.1'deki adres |
| Kategori | Uygulama Bilgileri | Birincil: **Eğitim**. İkincil: **Başvuru** (Reference) |
| Telif hakkı | Uygulama Bilgileri | `2026 Anlora` |
| Fiyat | Fiyatlandırma | **Ücretsiz** |
| Dışa aktarım uyumluluğu | Sürüm | Sormayacak — `Info.plist` içine `ITSAppUsesNonExemptEncryption = false` yazdım. Uygulama yalnızca HTTPS kullanıyor, muaf |

> **Yaş derecelendirme belgesini atlamadan oku.** İçinde sözlükteki kaba
> sözcüklerin App Store'da Play'dekinden daha ağır bir bedeli olduğu ve
> üç seçenekli bir karar anlatılıyor. Bu kararı vermeden yükleme yapma.

---

## 5. Sürümü yükle

1. İş akışını çalıştır: Actions → **iOS paketi (IPA)** → Run workflow.
2. `anlora-ipa` artefaktını indir.
3. IPA'yı App Store Connect'e yükle — üç yoldan biri:
   - **Transporter** (ücretsiz Mac uygulaması) — en kolayı, ama Mac gerekir
   - **Xcode → Organizer** — Mac gerekir
   - **App Store Connect API** — Mac gerekmez; iş akışına eklememi istersen ekleyebilirim
4. Yüklenen paket "Derlemeler" altında belirir (işlenmesi 10–30 dakika).
5. Sürüme o derlemeyi seç, sürüm notlarını gir
   (`app-store-aciklamalar.md` içinde hazır), **İncelemeye Gönder**.

### TestFlight — atlama
Üretime göndermeden önce TestFlight'ta kendi telefonunda dene. Apple'ın
incelemesi 1–3 gün sürüyor; ret yemek bir haftayı götürür. TestFlight
kendi kullanımın için ayrı inceleme istemez, hemen kurabilirsin.

**Özellikle şunları dene** — bunlar iOS'ta Android'dekinden farklı çalışan
ve gerçek cihaz olmadan doğrulayamadığım yerler:

- **Telaffuz düğmesi.** Ses, Capacitor'ın yerel TTS eklentisi üzerinden
  çıkıyor; iOS'ta AVSpeechSynthesizer'a bağlanır. Sessiz mod anahtarı
  açıkken ses çıkmayabilir — bu iOS'un genel davranışıdır, hata değil, ama
  bilmen iyi olur.
- **Durum çubuğu şeridinin rengi.** `#F8F1E4` sabitledim. **Koyu temada
  bu şerit açık kalır** — çirkin duruyorsa söyle, temaya bağlarım.
- **Çentik/Dynamic Island.** Başlık şeridi saatin altında kalıyor mu?
  Kodda doğru mekanizma var (`env(safe-area-inset-*)` ve
  `viewport-fit=cover`) ama gerçek cihazda görülmesi gerek.
- **Klavye.** Kelime ekleme formunda alan klavyenin altında kalıyor mu?
  `contentInset: 'always'` ayarladım, bunun için.
- **Veri kalıcılığı.** Birkaç kelime ekle, uygulamayı kapat, telefonu
  yeniden başlat, geri aç. Duruyorsa tamam.

---

## 6. Apple'a özgü ret riskleri

Play'de karşılaşmayacağın, burada karşılaşabileceğin şeyler:

**Yönerge 4.3 — Spam / tekrar.** Kelime öğrenme uygulaması App Store'un en
kalabalık kategorilerinden. Apple "piyasada benzeri çok" diyerek
reddedebiliyor. Anlora'nın savunması sağlam: 30.580 maddelik kendi sözlüğü,
tamamen çevrimdışı, Türkçe. Reddedilirse inceleme notlarına bu üçünü yaz.

**Yönerge 2.3.10 — başka platform adı.** Metinde, ekran görüntülerinde,
inceleme notlarında "Android", "Google Play", "Play Store" geçmesin.

**Yönerge 5.1.1(v) — hesap silme.** Hesap yok, uygulanmaz. İnceleme
notlarına yazacak cümle `app-store-gizlilik-etiketleri.md` içinde hazır.

**Yönerge 2.1 — eksik bilgi.** Giriş yok, demo hesap istemeyecekler.
Yine de inceleme notlarına şunu yaz:

> *Uygulama giriş gerektirmez, tüm özellikler doğrudan kullanılabilir.
> Sözlük uygulamanın içinde gömülüdür ve internet olmadan çalışır.
> "Anlora AI" isteğe bağlı bir özelliktir; sözlükte bulunmayan bir kelime
> eklendiğinde devreye girer ve internet gerektirir.*

---

## Yükleme öncesi kontrol listesi

- [ ] GitHub Pages açık, gizlilik politikası adresi çalışıyor
- [ ] Apple Developer Program üyeliği onaylandı (99 USD/yıl)
- [ ] Bundle ID `com.anlora.app` kaydedildi, **hiçbir yetenek işaretlenmedi**
- [ ] Dört Apple gizlisi GitHub'a eklendi
- [ ] iOS iş akışı koştu, **imzalı IPA** üretti
- [ ] App Store Connect'te uygulama oluşturuldu
- [ ] Ad, altyazı, anahtar kelimeler, tanıtım metni, açıklama girildi
- [ ] Metinde **"Android" geçmiyor**
- [ ] 1024×1024 simge yüklendi
- [ ] iPhone 6.9" (5) ve iPad 13" (5) ekran görüntüleri yüklendi
- [ ] **Yaş derecelendirme kararı verildi** (bant 14 kalacak mı?)
- [ ] Yaş derecelendirme anketi dolduruldu
- [ ] Gizlilik etiketleri dolduruldu, `PrivacyInfo.xcprivacy` ile tutarlı
- [ ] Kategori: Eğitim / Başvuru
- [ ] Fiyat: Ücretsiz
- [ ] TestFlight'ta gerçek cihazda denendi (yukarıdaki beş madde)
- [ ] İnceleme notları yazıldı
- [ ] İncelemeye gönderildi

---

## Bilinen eksikler — dürüstçe

Bunları yapamadım, bilerek bırakıyorum:

1. **Hiçbir şey gerçek iOS cihazında çalıştırılmadı.** Bu makinede Xcode
   yok. İş akışı projenin *derlendiğini* kanıtlayacak; *doğru çalıştığını*
   ancak TestFlight'ta sen görebilirsin. Yukarıdaki beş maddelik liste tam
   bu yüzden var.

2. **CocoaPods bağımlılıkları bu makinede kurulamadı.** `npx cap add ios`
   iskeleti kurdu ama `pod install` macOS gerektiriyor; iş akışındaki
   adım onu koşucuda yapacak. Bir eklentinin iOS tarafı kırıksa ilk
   koşuda çıkacak.

3. **İmzalı IPA henüz üretilmedi**, çünkü Apple hesabı ve dolayısıyla
   imza gizlileri yok. İş akışı bu durumda sessiz kalmıyor: imzasız
   derlemeyi yapıp "bu dosya kurulamaz" uyarısını koşu özetine yazıyor.

4. **Simge 512'den büyütüldü** (yukarıda anlatıldı).
