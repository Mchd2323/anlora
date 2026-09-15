# Play Console — Veri Güvenliği formu (Data safety)

Bu form Play Console'da **Politika ve programlar → Uygulama içeriği → Veri
güvenliği** altında doldurulur. Verdiğin cevaplar mağaza sayfasında
"Veri güvenliği" kartı olarak herkese görünür.

**Bu belgenin amacı:** formdaki her kutuya ne işaretleneceğini ve o cevabın
hangi koda dayandığını yazmak. Google bu beyanı denetler; yanlış beyan
uygulamanın kaldırılmasına yol açar. Aşağıdaki cevapların hepsi kodun
okunmasıyla çıkarıldı, tahmin değil.

---

## 1. Uygulamanız kullanıcı verisi topluyor mu veya paylaşıyor mu?

**Cevap: EVET.**

Buna "hayır" demek cazip geliyor, çünkü Anlora'nın tuttuğu her şey
telefonda duruyor. Ama Google'ın tanımında **"toplama", uygulamanın
cihazdan herhangi bir veriyi ağ üzerinden dışarı çıkarmasıdır.** Anlora
üç yerde bunu yapıyor:

| Nereden | Ne gidiyor | Kaynak |
|---|---|---|
| Tek kelime ekle (Anlora AI) | Kullanıcının yazdığı İngilizce kelime, isteğe bağlı bağlam cümlesi | `src/components/CollectionsView.tsx:1349` |
| Geri bildirim | Mesaj metni, isteğe bağlı kelime, **isteğe bağlı e-posta adresi**, tarayıcı kimlik metninin ilk 60 karakteri | `src/components/FeedbackModal.tsx:119` |
| Açılış yoklaması | Yalnızca sunucunun yeteneklerini sorar, cihazdan veri göndermez | `src/config/api.ts:140` |

Bunların dışında ağa çıkan başka bir şey yok. `usageReporter.ts` ve
`pushNotifications.ts` dosyaları depoda duruyor ama **ikisi de kapalı**:
her ikisi de `getApiCapabilities().accounts` kontrolüyle başlıyor
(`usageReporter.ts:84`, `pushNotifications.ts:71`) ve dağıtılan sunucu
`accounts: false` döndüğü için tek satır bile çalışmıyor.

---

## 2. Veri türleri — kutu kutu cevaplar

### Kişisel bilgiler → E-posta adresi
- **Toplanıyor mu?** Evet
- **Paylaşılıyor mu?** Hayır
- **Zorunlu mu?** **İsteğe bağlı** — kullanıcı boş bırakabilir
- **Neden?** Yalnızca **Uygulama işlevi** (geri bildirime cevap yazabilmek)
- Dayanak: `FeedbackModal.tsx` içindeki `replyTo` alanı. Kullanıcı
  doldurursa gider, doldurmazsa gitmez.

### Uygulama etkinliği → Diğer kullanıcı tarafından oluşturulan içerik
- **Toplanıyor mu?** Evet
- **Paylaşılıyor mu?** Hayır
- **Zorunlu mu?** İsteğe bağlı
- **Neden?** **Uygulama işlevi**
- Dayanak: Anlora AI'ya gönderilen kelime ve bağlam cümlesi; geri bildirim
  mesajının metni. İkisi de kullanıcının kendi yazdığı metin.

### Cihaz veya diğer kimlikler
- **Toplanıyor mu?** **Hayır**
- Anlora hiçbir yerde reklam kimliği, cihaz kimliği, IMEI, MAC ya da
  benzeri bir tanımlayıcı okumuyor. Geri bildirimle giden 60 karakterlik
  tarayıcı metni ("Mozilla/5.0 (Linux; Android 14; SM-...") bir kimlik
  değil, cihaz modeli/sürümü bilgisidir; Google bunu "Cihaz kimliği"
  saymaz. Yine de isteyerek gizlemek istersen `FeedbackModal.tsx`
  içindeki `platform` alanını kaldırmak yeterli — söyle, kaldırayım.

### Konum / Kişisel bilgiler (ad, adres, telefon) / Finansal bilgi / Sağlık / Mesajlar / Fotoğraf ve video / Ses / Dosyalar / Takvim / Kişiler / Arama geçmişi / SMS
- **Hepsine HAYIR.**
- Dayanak: `android/app/src/main/AndroidManifest.xml` içinde **tek bir izin**
  var: `android.permission.INTERNET`. Kamera, konum, kişiler, depolama —
  hiçbiri istenmiyor. İzin istemeyen bir uygulama o veriye erişemez.

---

## 3. Güvenlik uygulamaları

| Soru | Cevap | Dayanak |
|---|---|---|
| Veriler aktarım sırasında şifreleniyor mu? | **Evet** | Sunucu adresi `https://` ile başlar; `apiUrl()` şemayı değiştirmez |
| Kullanıcı verisinin silinmesini talep edebilir mi? | **Evet** | Uygulama içinden: Profil → verileri temizle. Ayrıca uygulamayı kaldırmak cihazdaki her şeyi siler. Sunucuda kullanıcıya bağlı kayıt tutulmadığı için silinecek hesap da yok |
| Bağımsız güvenlik denetiminden geçti mi? | **Hayır** | Geçmedi. "Evet" demek yalan olur |

---

## 4. Beyan edilmesi gerekmeyen ama bilmen gereken iki şey

**Android otomatik yedekleme açık.** `android:allowBackup="true"` olduğu
için kullanıcının ilerlemesi Google hesabına yedeklenir. Bu Google'ın
kendi altyapısıdır, senin topladığın bir veri sayılmaz; Veri Güvenliği
formunda beyan edilmez. Ama gizlilik politikasında yazıyor olması iyi
olur — `docs/index.html` içinde zaten yazıyor.

**Sözlüğün kendisi veri değildir.** 30.682 kelimelik sözlük uygulamanın
içinde gömülü geliyor; kullanıcıdan alınmıyor, kullanıcıya ait değil.
Formda yeri yok.
