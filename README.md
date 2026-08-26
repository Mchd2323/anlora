# Anlora

> **Heh, şimdi anlorum!**

Anlora, İngilizce kelime öğrenmek için tasarlanmış bir web uygulamasıdır. Oxford 3000 ve Oxford 5000 Ek (B2) kelime listelerini Türkçe anlamları, anlam ayrımları (sense) ve çift dilli örnek cümlelerle sunar; aralıklı tekrar (SRS) motoruyla kelimelerin kalıcı olarak öğrenilmesini hedefler.

## Özellikler

- **Oxford 3000 & Oxford 5000 Ek sözlüğü** — resmî CEFR listelerinden üretilmiş 5.323 madde / 5.947 sense. Oxford 3000: A1 (900), A2 (872), B1 (809), B2 (727). Oxford 5000 Ek: B2 Ek (700), C1 (1.315). Her sözcük türü ayrı sense taşır; qualifier ve homograf ayrımları korunur.
- **Ayarlar** — günlük tekrar/yeni kelime hedefi, tercih edilen çalışma modu, otomatik telaffuz, yazım toleransı.
- **Çevrimdışı çalışma (PWA)** — ana ekrana eklenebilir; ilk ziyaretten sonra internet olmadan da açılır.
- **Tam yedekleme** — koleksiyonlar, üyelikler, öğrenme durumları ve ayarlar dâhil dışa aktarma ve geri yükleme.
- **Aralıklı tekrar (SRS)** — 1 → 3 → 7 → 14 → 30 → 60 → 120 → 240 günlük aralık merdiveni, ustalık (mastery) puanı, zorluk katsayısı ve hafıza sağlığı hesabı. Soru tipine göre kanıt ağırlığı: yazarak hatırlama > boşluk doldurma > flashcard > çoktan seçmeli. Tekrar tarihleri yerel gün başlangıcına sabitlenir; akşam çalışılan kelime ertesi sabah tekrara açılır.
- **Aşamaya göre çalışma modu** — hiç görülmemiş kelime tanıma adımıyla başlar, ustalaşınca yazarak hatırlamaya yükselir. Kullanıcı isterse tek bir modu sabitleyebilir.
- **Kelime setlerim** — kendi koleksiyonlarını oluştur, Oxford kelimelerini ya da kendi kartlarını ekle.
- **Özel kart oluşturma** — tekil kart ekleme, toplu ekleme ve metin madenciliği (bir metni yapıştır, bilinmeyen kelimeleri kart olarak çıkar) ile lemmatizasyon ve tekrar (duplicate) tespiti.
- **Sınav modülü** — çoktan seçmeli, boşluk doldurma ve yazarak hatırlama modları; hatalı kelimeler ayrı takip edilir.
- **İstatistikler ve rozetler** — günlük seri, çalışma özeti, kazanılan rozetler.
- **Anlora AI** — Gemini destekli kart üretimi, anlam doğrulama ve örnek cümle zenginleştirme (sunucu tarafında çalışır, API anahtarı tarayıcıya sızmaz).
- **Telaffuz** — Web Speech API ile kelime seslendirme.
- Arayüz tamamen Türkçedir.

## Teknoloji

| Katman | Teknoloji |
| --- | --- |
| Arayüz | React 19, TypeScript, Tailwind CSS 4, lucide-react, motion |
| Derleme | Vite 6 |
| Sunucu | Express 4 (TypeScript, `tsx` ile geliştirme, `esbuild` ile paketleme) |
| AI | `@google/genai` (Gemini) |
| Kalıcılık | Tarayıcıda `localStorage` (V2 şeması, V1'den otomatik göç); özel kartlar için sunucu tarafı JSON dosyası |

## Kurulum

**Gereksinimler:** Node.js 20+

```bash
npm install
cp .env.example .env.local   # GEMINI_API_KEY değerini kendi anahtarınla doldur
npm run dev                  # http://localhost:3000
```

`GEMINI_API_KEY` tanımlı değilse uygulama çalışır, yalnızca AI uçları devre dışı kalır.

### Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Express + Vite middleware ile geliştirme sunucusu |
| `npm run build` | Arayüzü `dist/`, sunucuyu `dist/server.cjs` olarak derler |
| `npm start` | Derlenmiş sunucuyu çalıştırır |
| `npm run lint` | `tsc --noEmit` ile tip denetimi |
| `npm test` | Vitest ile birim testleri |
| `npm run test:watch` | Testleri izleme kipinde çalıştırır |
| `npm run clean` | Derleme çıktılarını siler |

## Proje yapısı

```
src/
  components/     Arayüz bileşenleri (dashboard, çalışma, sınav, koleksiyonlar, profil)
    study/        Çalışma oturumu görünümleri (flashcard, kelime listesi)
    ui/           Küçük ortak bileşenler (rozet, toast, durum kontrolleri)
  data/           Oxford verisi (oxford3000.json, oxford5000extra.json), kimlik göç haritası
  services/       Sözlük veri erişim katmanı (oxfordCoreRepository)
  utils/          SRS motoru, depolama, sınav üretimi, lemmatizer, metin madencisi,
                  AI istemcisi, kimlik doğrulama istemcisi, konuşma, tarih yardımcıları
    __tests__/    Saf mantığın birim testleri
  hooks/          Paylaşılan React kancaları (modal erişilebilirliği)
  types/          Paylaşılan TypeScript tipleri
  config/         Marka metinleri
public/           PWA manifesti, ikonlar, servis çalışanı
server.ts         Express sunucusu: AI uçları, kimlik doğrulama, senkronizasyon, özel kartlar
scripts/oxford/   Oxford veri boru hattı: ayrıştırma, birleştirme, denetim,
                  doğrulama, telaffuz doldurma, içerik zenginleştirme
```

## API uçları

| Uç | Açıklama |
| --- | --- |
| `POST /api/ai/generate-word` | Bir kelime için tam kart üretir (anlamlar + örnekler) |
| `POST /api/ai/validate-senses` | Mevcut anlam ayrımlarını doğrular |
| `POST /api/ai/generate-examples` | Verilen anlam için örnek cümleler üretir |
| `POST /api/auth/register` · `verify-email` · `resend-code` · `login` · `logout` · `google` | Kimlik doğrulama akışı |
| `POST /api/sync/save` · `GET /api/sync/load` | Kullanıcı verisi senkronizasyonu (oturum gerektirir) |
| `GET` · `POST` · `PUT` · `DELETE /api/custom-cards` | Özel kart CRUD işlemleri (oturum gerektirir) |

Kimlik doğrulama gerektiren uçlar `Authorization: Bearer <token>` başlığı bekler. Jeton `login`, `verify-email` veya `google` yanıtında döner ve 30 gün geçerlidir. Yapay zekâ uçları oturum istemez ancak IP başına dakikada 30 istekle sınırlıdır — her çağrı sunucu sahibinin Gemini kotasından harcanır.

### Güvenlik notları

- Parolalar `scrypt` ile, kullanıcıya özel rastgele tuz kullanılarak saklanır; karşılaştırma sabit zamanlıdır.
- E-posta doğrulama kodları kriptografik rastgelelikle üretilir, karma hâlinde saklanır, 15 dakika geçerlidir ve hesap başına en fazla 5 kez denenebilir.
- `login` yalnızca doğrulanmış e-postalarda başarılı olur.
- Senkronizasyon ve özel kart uçları isteği gönderen oturumun sahibiyle sınırlıdır; e-posta adresi kimlik olarak kabul edilmez.
- Google ile giriş, `GOOGLE_CLIENT_ID` tanımlıysa çalışır ve gelen kimlik jetonunu Google'da doğrular (`aud`, `iss`, `exp`, `email_verified`). Tanımlı değilse uç 503 döner.
- Kullanıcı hesapları `data/users.json` altında tutulur ve sürüm kontrolüne dâhil edilmez.

## Veri üretim scriptleri

`scripts/` altındaki araçlar Oxford verisini üretmek, zenginleştirmek ve denetlemek için kullanılır (örn. `buildOxford5000B2.ts`, `auditOxford3000.ts`, `enrich_all_words.py`). Bu scriptler tek seferlik veri hazırlığı içindir; uygulama çalışma zamanında `src/data/` altındaki hazır JSON dosyalarını kullanır. Toplu üretim ilerlemesi `.batch_checkpoints/` altında saklanır.

## Oxford veri boru hattı

Oxford verisi bileşen kodunda değil, `scripts/oxford/` altındaki boru hattında yönetilir. Kaynak otoritesi resmî `The Oxford 3000™` ve `The Oxford 5000™ by CEFR level` listeleridir: headword, CEFR seviyesi, sözcük türü, qualifier, homograf numarası ve kaynak sırası konusunda uygulama verisiyle çelişirlerse kaynak esas alınır.

```bash
# 1. Resmî PDF listelerini ayrıştır (kaynak JSON'ları üretir)
python3 scripts/oxford/parse_sources.py <oxford3000.pdf> <oxford5000.pdf> \
    scripts/oxford/source/oxford3000.source.json \
    scripts/oxford/source/oxford5000extra.source.json

# 2. Kaynakları ve mevcut içeriği birleştir (DOĞRUYSA KORU, EKSİKSE EKLE)
python3 scripts/oxford/build_dataset.py

# 3. Eksik IPA telaffuzlarını CMUdict'ten doldur
python3 scripts/oxford/fill_phonetics.py <cmudict.dict>

# 4. Kaynak ile veriyi karşılaştır
python3 scripts/oxford/audit_oxford.py

# 5. Doğrula (CI için: ANLORA_VALIDATE_STRICT=true)
python3 scripts/oxford/validate_oxford.py

# 6. Eksik Türkçe anlam ve örnekleri üret (yalnızca geliştirme aşamasında)
GEMINI_API_KEY=... npx tsx scripts/oxford/enrich_oxford.ts --limit 40
```

### Veri modeli

Bir kaynak SATIRI bir kayıttır; satırdaki her sözcük türü ayrı bir sense olur. `boost v., n.` tek kayıt, iki sense demektir ve fiil anlamı ile isim anlamı birbirine karışmaz. `bank (money)` ile `bank (river)` ayrı kayıtlardır; `can1` ile `can2` de öyle.

Kimlikler deterministiktir — dataset + CEFR + headword + homograf + qualifier'dan üretilir, kaynak sırasına bağlı değildir. Kullanıcı ilerlemesi bu kimliklere bağlanır; liste güncellendiğinde kaymaz. Eski kimlikler `src/data/oxfordIdMigration.json` üzerinden otomatik göç eder ("Öğrendim", "Tekrar Et", favoriler, üyelikler ve çalışma geçmişi korunur).

Oxford çekirdeği **salt okunurdur**: kullanıcı da çalışma zamanındaki yapay zekâ da değiştiremez. Çalışma zamanında hiçbir yapay zekâ isteği yapılmaz; veri pakete gömülüdür ve çevrimdışı çalışır.

### İçeriğin durumu

Kaynak listeler yalnızca kelimeleri verir; Türkçe karşılık ve örnek cümle içermez. Mevcut uygulamadan güvenle taşınabilen içerik taşındı, taşınamayanlar `needsReview` ile işaretlendi. **Uydurma veri yazılmaz**: anlamı bilinmeyen bir kayda yer tutucu yazmak yerine kayıt eksik bırakılır ve `enrich_oxford.ts` ile doldurulur.

| Durum | Kayıt |
| --- | --- |
| Tam (anlam + 3 örnek) | 915 |
| Anlamı var, örneği eksik | 2.936 |
| Anlamı da eksik | 1.472 |

Sözcük türüne güvenle atanamayan eski anlamlar (`about prep., adv.` için tek bir "hakkında, ilgili, konusunda" dizesi gibi) kayıt düzeyinde `legacyMeaning` olarak saklanır: tek bir sense'e yazmak yanlış sözcük türü anlamı koymak olurdu, atmak ise kullanıcının bugün gördüğü bilgiyi kaybetmek olurdu.

## Testler ve veri denetimi

Saf mantık (SRS motoru, sınav üretimi, karıştırma, depolama, seri hesabı, rozet koşulları, lemmatizer, metin madencisi, tekrar tespiti, yedekleme) birim testleriyle kapsanır:

```bash
npm test
```

Sözlük verisinin kalitesi ayrı bir denetimden geçer. Denetim yalnızca alanların dolu olup olmadığına değil içeriğe bakar: şablondan üretilmiş cümleler, geçersiz IPA, hedef kelimeyi içermeyen örnekler ve alanlara sızmış sözcük türü artıkları.

```bash
npx tsx scripts/auditOxford3000.ts
ANLORA_AUDIT_STRICT=true npx tsx scripts/auditOxford3000.ts   # CI için: kusur varsa hata kodu
```

### Şablon cümle geçmişi

Önceki veri kümesinde 9.678 örnek cümlenin 8.515'i (%88) yirmi bir sabit kalıptan üretilmişti ve kelime sözcük türüne bakılmaksızın kalıba yerleştirildiği için dilbilgisi dışıydı (`ago` zarfı için *"I want to ago today because it is very important."*). Veri kümesi resmî kaynaklardan yeniden kurulurken bu cümleler alınmadı; sunucudaki `validateGeneratedWordCard` ve `validate_oxford.py` aynı kalıpların geri girmesini engeller.

## Android uygulaması

Arayüz, [Capacitor](https://capacitorjs.com) ile bir Android paketine sarılır. Web derlemesi (`dist/`) cihaza gömülür ve WebView'da yerel dosyalardan açılır; Oxford çekirdeği de paketin içinde olduğu için sözlük, kartlar ve ilerleme **tamamen çevrimdışı** çalışır.

| | |
|---|---|
| Paket kimliği | `com.anlora.app` |
| En düşük Android | 6.0 (API 23) |
| Hedef Android | 15 (API 35) |

```bash
npm run android:icons   # marka ikonunu ve açılış ekranını üret (bir kez)
npm run android:sync    # web paketini derle ve android/ içine kopyala
npm run android:open    # Android Studio'da aç
cd android && ./gradlew assembleDebug   # APK: app/build/outputs/apk/debug/
```

### Sunucuya bağlı özellikler

APK'da arayüzün kökeni `https://localhost`'tur, yani göreli `/api/...` yolları sunucuya değil paketin kendisine gider. Bu yüzden hesap, bulut yedeği ve Anlora AI için derleme sırasında sunucunun tam adresi verilmelidir:

```bash
VITE_API_BASE_URL="https://alan-adiniz.com" npm run android:sync
```

Adres verilmezse uygulama çevrimdışı kipte derlenir: çalışma akışının tamamı çalışır, yalnızca sunucuya bağlı üç özellik kapalı kalır (bkz. `src/config/api.ts`).

### APK üretimi

`.github/workflows/android-apk.yml` APK'yı CI'da derler. Actions sekmesinden elle çalıştırıldığında paket koşunun artefaktı olur; `v*` biçiminde bir etiket gönderildiğinde ise kalıcı bir Release'e eklenir:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

APK, Android SDK'nın hata ayıklama anahtarıyla imzalanır: doğrudan kurulabilir ama Play Store'a yüklenemez. Mağaza dağıtımı için kendi anahtarınızla imzalanmış bir `assembleRelease` derlemesi ve `android/app/build.gradle` içinde bir `signingConfig` gerekir.

## Notlar ve bilinen sınırlar

- Kullanıcı ilerlemesi öncelikle tarayıcıda `localStorage` üzerinde tutulur; ilk açılışta V1 şemasından V2'ye otomatik göç çalışır. Depolama yazımları hata durumunda uygulamayı çökertmez; kota dolduğunda kullanıcıya bildirim gösterilir.
- Oxford sözlüğü açılışta bütün olarak yüklenir. Ayrı bir derleme parçasına alındığı için önbelleklenebilir, ancak kalıcı çözüm `oxfordCoreRepository`'yi grup başına dinamik `import()` ile tembel yüklemeye çevirmektir.
- Sözlük içeriği tamamlanmıştır: 5.323 kaydın 5.947 anlamının tamamı Türkçe karşılık ve üçer örnek cümle taşır (17.841 cümle). `validate_oxford.py` sıfır kusur bildirir ve `needs_review` kuyruğu boştur.
- Fonetik yazım Genel Amerikan İngilizcesindedir (CMUdict kaynaklı), çünkü uygulama kelimeleri `en-US` sesiyle okur.
- Kullanıcı hesapları düz bir JSON dosyasında tutulur ve oturumlar süreç belleğindedir: tek sunucu örneği için yeterli, yatay ölçeklenen bir dağıtım için değil. Gerçek bir dağıtımda bir veritabanı ve paylaşımlı oturum deposu gerekir.
- Doğrulama kodları e-posta ile gönderilmez, sunucu günlüğüne yazılır. Üretim için `deliverVerificationCode` bir e-posta sağlayıcısına bağlanmalıdır.
- Arayüzde hâlâ birkaç `alert()`/`confirm()` çağrısı bulunur; bildirim altyapısı (`ToastProvider`) kurulu olduğu için bunlar kademeli olarak taşınabilir.

## Sunucu ortam değişkenleri

| Değişken | Ne işe yarar |
|---|---|
| `GEMINI_API_KEY` | Yapay zekâ üretimi. Tanımlı değilse üretim kapalı; önbellekten yanıt verilmeye devam eder. |
| `ANLORA_ADMIN_EMAILS` | Virgülle ayrılmış yönetici e-postaları. **Tanımlı değilse yönetim panelinin tamamı kapalıdır** ve uçlar 404 döner. Rol veritabanında tutulmaz: veriyi ele geçiren biri kendini yönetici yapamasın diye. |
| `ANLORA_AI_DAILY_QUOTA` | Günlük toplam yeni yapay zekâ üretimi (varsayılan 200). Önbellekten gelen yanıtlar sayılmaz. |
| `ANLORA_AI_USER_DAILY_QUOTA` | Kullanıcı başına günlük yeni üretim (varsayılan 25). Kelime eklemek sınırsızdır; sınır yalnızca yeni üretime uygulanır. |
| `GOOGLE_CLIENT_ID` | Google ile giriş. Tanımlı değilse düğme dürüstçe devre dışıdır. |
| `VITE_API_BASE_URL` | APK derlenirken sunucunun tam adresi. Verilmezse uygulama çevrimdışı kipte derlenir; hesap ve bulut yedeği kapalı olur. |

Yönetim paneli **Profil → Yönetim Paneli** yolundan açılır ve yalnızca
`ANLORA_ADMIN_EMAILS` listesindeki doğrulanmış hesaba görünür.

### Veri dosyaları

`data/` altında tutulur ve yedeklenmelidir:
`users.json`, `dictionary.json`, `content.json`, `ai-cache.json`,
`stats.json`, `shares.json`, `metrics.json`, `audit.json`, `uploads/`,
`backups/`.

### Bildirim ve e-posta

| Değişken | Ne işe yarar |
|---|---|
| `ANLORA_FCM_SERVICE_ACCOUNT` | Firebase hizmet hesabı JSON'u (metnin kendisi ya da dosya yolu). Tanımlı değilse anlık bildirim gönderimi kapalıdır; cihazlar yine kaydolur. |
| `RESEND_API_KEY` | Resend API anahtarı. Tanımlı değilse doğrulama kodları yalnızca sunucu günlüğüne yazılır. |
| `ANLORA_MAIL_FROM` | Gönderen adresi, örn. `Anlora <merhaba@alanadin.com>`. **Doğrulanmış bir alan adına ait olmalı.** |

`android/app/google-services.json` APK'nın içine gömülür ve Firebase'in
Android istemcisini yapılandırır; her APK'dan çıkarılabildiği için gizli
sayılmaz. Hizmet hesabı anahtarı ise **gizlidir** ve depoya girmez.
