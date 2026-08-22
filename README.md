# Anlora

> **Heh, şimdi anlorum!**

Anlora, İngilizce kelime öğrenmek için tasarlanmış bir web uygulamasıdır. Oxford 3000 ve Oxford 5000 Ek (B2) kelime listelerini Türkçe anlamları, anlam ayrımları (sense) ve çift dilli örnek cümlelerle sunar; aralıklı tekrar (SRS) motoruyla kelimelerin kalıcı olarak öğrenilmesini hedefler.

## Özellikler

- **Oxford 3000 & 5000 Ek sözlüğü** — A1, A2, B1, B2 seviyelerinde 3.226 çekirdek madde + 700 Oxford 5000 Ek (B2) maddesi; Türkçe anlamlar, sözcük türü ve IPA telaffuz.
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
  data/           Oxford kelime verisi (wordsA1/A2/B1/B2.json, oxford5000ExtraB2.json)
  services/       Sözlük veri erişim katmanı (repository)
  utils/          SRS motoru, depolama, sınav üretimi, lemmatizer, metin madencisi,
                  AI istemcisi, kimlik doğrulama istemcisi, konuşma, tarih yardımcıları
    __tests__/    Saf mantığın birim testleri
  hooks/          Paylaşılan React kancaları (modal erişilebilirliği)
  types/          Paylaşılan TypeScript tipleri
  config/         Marka metinleri
public/           PWA manifesti, ikonlar, servis çalışanı
server.ts         Express sunucusu: AI uçları, kimlik doğrulama, senkronizasyon, özel kartlar
scripts/          Kelime verisini üretme, zenginleştirme ve denetleme araçları (TS + Python)
  data-repair/    Fonetik onarımı, şablon karantinası, örnek cümle yeniden üretimi
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

### Örnek cümlelerin durumu

Çekirdek sözlükteki 9.678 örnek cümlenin 8.515'i (%88) yirmi bir sabit kalıptan üretilmişti ve kelime sözcük türüne bakılmaksızın kalıba yerleştirildiği için dilbilgisi dışıydı (`ago` zarfı için *"I want to ago today because it is very important."*). Bu cümleler veriden çıkarıldı; etkilenen 2.846 madde `examplesVerified: false` taşıyor ve `scripts/data-repair/quarantine_report.json` içinde listeleniyor. Arayüz bu maddelerde uydurma cümle göstermek yerine örnek olmadığını açıkça söyler.

Yeniden üretmek için (Oxford 5000 Ek setini üreten, şablon içermeyen boru hattının aynısı):

```bash
GEMINI_API_KEY=... npx tsx scripts/data-repair/repair_examples.ts
GEMINI_API_KEY=... npx tsx scripts/data-repair/repair_examples.ts --limit 50   # önce küçük bir parti dene
```

Betik kontrol noktası tutar, ürettiği cümleleri şablon listesine karşı doğrular ve yalnızca geçenleri veriye yazar.

## Notlar ve bilinen sınırlar

- Kullanıcı ilerlemesi öncelikle tarayıcıda `localStorage` üzerinde tutulur; ilk açılışta V1 şemasından V2'ye otomatik göç çalışır. Depolama yazımları hata durumunda uygulamayı çökertmez; kota dolduğunda kullanıcıya bildirim gösterilir.
- Oxford sözlüğü (868 KB JSON) açılışta bütün olarak yüklenir. Ayrı bir derleme parçasına alındığı için önbelleklenebilir, ancak kalıcı çözüm `oxfordRepository`'yi seviye başına dinamik `import()` ile tembel yüklemeye çevirmektir.
- Çekirdek sözlükte anlam ayrımı (`senses`) yoktur; çok anlamlı kelimeler tek bir virgüllü dizede toplanmıştır (`light` → "açık (renk), hafif"). Anlam ayrımı yalnızca Oxford 5000 Ek setinde uygulanmıştır. Çekirdeği bu modele taşımak en büyük açık iş kalemidir.
- Fonetik yazım Genel Amerikan İngilizcesindedir (CMUdict kaynaklı), çünkü uygulama kelimeleri `en-US` sesiyle okur.
- Kullanıcı hesapları düz bir JSON dosyasında tutulur ve oturumlar süreç belleğindedir: tek sunucu örneği için yeterli, yatay ölçeklenen bir dağıtım için değil. Gerçek bir dağıtımda bir veritabanı ve paylaşımlı oturum deposu gerekir.
- Doğrulama kodları e-posta ile gönderilmez, sunucu günlüğüne yazılır. Üretim için `deliverVerificationCode` bir e-posta sağlayıcısına bağlanmalıdır.
- `scripts/` altındaki üç toplu üretim betiğinde (`batchGeneratorB2.ts`, `directGenerator.ts`, `fastBatchGeneratorB2.ts`) `EnrichedSense.partOfSpeech` zorunlu/opsiyonel uyuşmazlığından kaynaklanan tip hatası vardır. Uygulama çalışma zamanını etkilemez.
- Arayüzde hâlâ birkaç `alert()`/`confirm()` çağrısı bulunur; bildirim altyapısı (`ToastProvider`) kurulu olduğu için bunlar kademeli olarak taşınabilir.
