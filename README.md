# Anlora

> **Heh, şimdi anlorum!**

Anlora, İngilizce kelime öğrenmek için tasarlanmış bir web uygulamasıdır. Oxford 3000 ve Oxford 5000 Ek (B2) kelime listelerini Türkçe anlamları, anlam ayrımları (sense) ve çift dilli örnek cümlelerle sunar; aralıklı tekrar (SRS) motoruyla kelimelerin kalıcı olarak öğrenilmesini hedefler.

## Özellikler

- **Oxford 3000 & 5000 Ek sözlüğü** — A1, A2, B1, B2 seviyelerinde ~3.200 çekirdek madde + 700 Oxford 5000 Ek (B2) maddesi; her biri Türkçe anlamlar, sözcük türü ve İngilizce/Türkçe örnek cümlelerle.
- **Aralıklı tekrar (SRS)** — 1 → 3 → 7 → 14 → 30 → 60 → 120 → 240 günlük aralık merdiveni, ustalık (mastery) puanı, zorluk katsayısı ve hafıza sağlığı hesabı. Soru tipine göre kanıt ağırlığı: yazarak hatırlama > boşluk doldurma > flashcard > çoktan seçmeli.
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
| `npm run clean` | Derleme çıktılarını siler |

## Proje yapısı

```
src/
  components/     Arayüz bileşenleri (dashboard, çalışma, sınav, koleksiyonlar, profil)
    study/        Çalışma oturumu görünümleri (flashcard, kelime listesi)
    ui/           Küçük ortak bileşenler (rozet, toast, durum kontrolleri)
  data/           Oxford kelime verisi (wordsA1/A2/B1/B2.json, oxford5000ExtraB2.json)
  services/       Sözlük veri erişim katmanı (repository)
  utils/          SRS motoru, depolama (V1/V2), lemmatizer, metin madencisi, AI istemcisi, konuşma
  types/          Paylaşılan TypeScript tipleri
  config/         Marka metinleri
server.ts         Express sunucusu: AI uçları, kimlik doğrulama, senkronizasyon, özel kartlar
scripts/          Kelime verisini üretme, zenginleştirme ve denetleme araçları (TS + Python)
```

## API uçları

| Uç | Açıklama |
| --- | --- |
| `POST /api/ai/generate-word` | Bir kelime için tam kart üretir (anlamlar + örnekler) |
| `POST /api/ai/validate-senses` | Mevcut anlam ayrımlarını doğrular |
| `POST /api/ai/generate-examples` | Verilen anlam için örnek cümleler üretir |
| `POST /api/auth/register` · `verify-email` · `resend-code` · `login` · `google` | Kimlik doğrulama akışı |
| `POST /api/sync/save` · `GET /api/sync/load` | Kullanıcı verisi senkronizasyonu |
| `GET` · `POST` · `PUT` · `DELETE /api/custom-cards` | Özel kart CRUD işlemleri |

## Veri üretim scriptleri

`scripts/` altındaki araçlar Oxford verisini üretmek, zenginleştirmek ve denetlemek için kullanılır (örn. `buildOxford5000B2.ts`, `auditOxford3000.ts`, `enrich_all_words.py`). Bu scriptler tek seferlik veri hazırlığı içindir; uygulama çalışma zamanında `src/data/` altındaki hazır JSON dosyalarını kullanır. Toplu üretim ilerlemesi `.batch_checkpoints/` altında saklanır.

## Notlar

- Kullanıcı ilerlemesi öncelikle tarayıcıda `localStorage` üzerinde tutulur; ilk açılışta V1 şemasından V2'ye otomatik göç çalışır.
- Sunucudaki kimlik doğrulama ve senkronizasyon uçları bellek/dosya tabanlıdır ve prototip niteliğindedir; üretim kullanımı için gerçek bir veritabanı ve oturum yönetimi gerekir.
