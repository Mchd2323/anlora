# App Store Connect — Gizlilik Etiketleri (Privacy Nutrition Labels)

App Store Connect'te **Uygulama Gizliliği (App Privacy)** bölümünde
doldurulur. Verdiğin cevaplar mağaza sayfasında "Uygulama Gizliliği"
kartı olarak herkese görünür.

> **BU FORM İLE `ios/App/App/PrivacyInfo.xcprivacy` AYNI ŞEYİ SÖYLEMEK
> ZORUNDA.** Apple ikisini karşılaştırıyor; tutmazsa yükleme reddedilir.
> Buradaki her satırın karşılığı o dosyada yazılı. Birini değiştirirsen
> ötekini de değiştir.

Play'in Veri Güvenliği formundan (`veri-guvenligi-formu.md`) **farklı bir
belge**, çünkü Apple'ın kategori adları ve soru sırası başka. Ama iki
formun dayandığı gerçekler aynı; ikisi de aşağıdaki üç ağ çağrısından
çıkarıldı.

---

## Uygulamanın ağa çıktığı tek üç yer

| Nereden | Ne gidiyor | Kaynak |
|---|---|---|
| Tek kelime ekle (Anlora AI) | Kullanıcının yazdığı İngilizce kelime, isteğe bağlı bağlam cümlesi | `src/components/CollectionsView.tsx:1349` |
| Geri bildirim | Mesaj metni, isteğe bağlı kelime, **isteğe bağlı e-posta adresi**, cihaz/tarayıcı metninin ilk 60 karakteri | `src/components/FeedbackModal.tsx:119` |
| Açılış yoklaması | Sunucunun yeteneklerini sorar, cihazdan veri göndermez | `src/config/api.ts:140` |

`usageReporter.ts` ve `pushNotifications.ts` depoda duruyor ama **ikisi de
kapalı**: her ikisi de `getApiCapabilities().accounts` kontrolüyle başlıyor
(`usageReporter.ts:84`, `pushNotifications.ts:71`) ve dağıtılan sunucu
`accounts: false` döndüğü için tek satırı bile çalışmıyor.

---

## Form cevapları

### Bu uygulama kullanıcı verisi topluyor mu?

**EVET.**

"Hayır" demek cazip, çünkü Anlora'nın tuttuğu her şey cihazda kalıyor.
Ama Apple'ın tanımında **toplama, verinin cihazdan çıkıp sunucuya
ulaşmasıdır** — orada tutulup tutulmadığından bağımsız. Yukarıdaki iki
uçta bu oluyor.

---

### Toplanan veri türleri

Apple her tür için üç şey sorar: ne için topluyorsun, kimliğe bağlı mı,
izleme için mi kullanılıyor mu.

#### İletişim Bilgileri → E-posta Adresi

| Soru | Cevap |
|---|---|
| Kullanım amacı | **Uygulama İşlevselliği** (App Functionality) |
| Kimliğe bağlı mı? | **Hayır** |
| İzleme için kullanılıyor mu? | **Hayır** |

Geri bildirim penceresindeki **isteğe bağlı** "bana ulaşın" alanı. Kullanıcı
boş bırakırsa hiçbir şey gitmez. Tek kullanımı, bildirimi yazan kişiye
cevap yazabilmek.

> Apple bu türe "isteğe bağlı" diye ayrı bir kutu koymaz; amacı ve
> bağlanmadığını doğru işaretlemek yeterli.

#### Kullanıcı İçeriği → Diğer Kullanıcı İçeriği

| Soru | Cevap |
|---|---|
| Kullanım amacı | **Uygulama İşlevselliği** |
| Kimliğe bağlı mı? | **Hayır** |
| İzleme için kullanılıyor mu? | **Hayır** |

Anlora AI'ya gönderilen kelime ve bağlam cümlesi; geri bildirim mesajının
metni. İkisi de kullanıcının kendi yazdığı metin.

---

### Toplanmayan türler — hepsine HAYIR

Konum · Sağlık ve Fitness · Finansal Bilgi · Kişiler · Kullanıcı İçeriği
(fotoğraf, video, ses, oyun içeriği, müşteri desteği) · Arama Geçmişi ·
Tarama Geçmişi · Tanımlayıcılar (Kullanıcı Kimliği, Cihaz Kimliği) ·
Kullanım Verisi · Tanılama · Satın Almalar · Hassas Bilgi

**Dayanağı sadece beyan değil, koddur:**

- Uygulama hiçbir iOS izni istemiyor. `Info.plist` içinde tek bir
  `NS...UsageDescription` anahtarı yok — yani kamera, konum, mikrofon,
  fotoğraflar, kişiler, takvim erişimi teknik olarak **imkânsız**.
  (Android tarafında da istenen tek izin `INTERNET`.)
- Reklam ağı, analitik SDK'sı ya da çökme raporlama servisi yok.
  `IDFA`/`ASIdentifierManager` hiçbir yerde çağrılmıyor.
- **Tanılama (Diagnostics) neden "hayır":** hiçbir çökme ya da performans
  verisi gönderilmiyor. Geri bildirimle giden 60 karakterlik cihaz metni
  ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5...") tanılama değil, bildirimi
  okuyan kişinin hangi cihazdan geldiğini anlaması için. Apple'ın
  Tanılama kategorisi otomatik toplanan çökme/performans kayıtlarını
  kasteder; burada öyle bir şey yok. Yine de bu alanı hiç göndermemeyi
  tercih edersen `FeedbackModal.tsx` içindeki `platform` satırını
  kaldırmak yeterli — söylemen kâfi.

---

### İzleme (Tracking)

| Soru | Cevap |
|---|---|
| Uygulama, kullanıcıyı başka şirketlerin uygulama ve sitelerinde izliyor mu? | **HAYIR** |

Bunun sonucu: **App Tracking Transparency izni istemeye gerek yok.**
`AppTrackingTransparency` çerçevesi projede yok ve olmamalı — izlemeyen bir
uygulamanın izin sorması Apple tarafından reddedilir.

`PrivacyInfo.xcprivacy` içinde karşılığı: `NSPrivacyTracking` = `false`,
`NSPrivacyTrackingDomains` = boş.

---

## Hesap silme — bu uygulamaya UYGULANMAZ

Apple yönerge 5.1.1(v), **hesap oluşturulabilen** uygulamaların uygulama
içinden hesap silme yolu sunmasını zorunlu tutar.

Anlora'da hesap yok: kayıt, giriş, e-posta doğrulama, şifre — hiçbiri yok.
Sunucuda kullanıcıya bağlı hiçbir kayıt tutulmuyor. Dolayısıyla silinecek
bir hesap da yok.

İnceleme notlarına şunu yazman işi kolaylaştırır:

> *Bu uygulama hesap oluşturmaz ve kullanıcı hesabı tutmaz. Tüm veriler
> yalnızca cihazda saklanır; uygulama kaldırıldığında silinir. Yönerge
> 5.1.1(v) kapsamında bir hesap silme akışı gerekmemektedir.*

---

## Gizlilik politikası adresi

```
https://mchd2323.github.io/anlora/
```

Play Console ile aynı adres. GitHub Pages açılmadan çalışmaz —
`app-store-rehberi.md` içindeki 0. adım.
