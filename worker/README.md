# Anlora AI Worker

Anlora'nın çalışması için sunucu gerekmiyor: 20.000 kelimelik sözlük pakete
gömülü ve çevrimdışı çalışıyor. Sunucu yalnızca **tek** bir iş için
gerekiyordu — sözlükte olmayan bir kelime için yapay zekâdan kart istemek.

Bu Worker o tek işi yapar. Bakılacak bir makine yok: Cloudflare kodu kendisi
çalıştırır, istek gelmediğinde hiçbir şey çalışmaz. Ücretsiz katman günde
100.000 istek verir; bu uygulama için fazlasıyla yeter.

## Ne yapar, ne yapmaz

| Uç | Durum |
|---|---|
| `GET /api/health` | Var — hangi özelliklerin karşılandığını bildirir |
| `POST /api/ai/generate-word` | Var |
| `POST /api/ai/validate-senses` | Var |
| `POST /api/ai/generate-examples` | Var |
| Hesap, bulut yedeği, yönetim paneli, bildirim | **Yok** — kalıcı depolama ister |

Arayüz `/api/health` yanıtındaki `capabilities` alanına bakar ve yalnızca
gerçekten karşılanan özellikleri çizer. Yani Worker'a bağlanan bir APK'da
yapay zekâ çalışır, giriş düğmesi hiç görünmez — basıldığında çalışmayan bir
düğme bırakmaktansa hiç göstermemek doğrusu.

## İki kurulum yolu

**A) Tarayıcıdan, GitHub Actions ile (önerilen).** Makinene hiçbir şey
kurmadan biter; adımlar kök `README.md`'de ve aşağıda özetli.

1. `https://aistudio.google.com/apikey` → anahtar al.
2. Cloudflare hesabı aç → **My Profile → API Tokens → Create Token →
   "Edit Cloudflare Workers"** şablonu → jetonu kopyala.
3. GitHub deposunda **Settings → Secrets and variables → Actions → New
   repository secret** ile iki gizli değer ekle: `CLOUDFLARE_API_TOKEN` ve
   `GEMINI_API_KEY`.
4. **Actions → Anlora AI Worker → Run workflow.** İş akışı dağıtır, anahtarı
   yazar ve özet sayfasında adresi + sağlık yanıtını gösterir.

**B) Kendi makinenden (Node 20+ gerekir).**

## Kurulum (elle, tek seferlik, ~5 dakika)

Gereken: bir Cloudflare hesabı (ücretsiz) ve bir Gemini API anahtarı
([aistudio.google.com](https://aistudio.google.com/apikey), ücretsiz).

```bash
cd worker
npm install
npx wrangler login                      # tarayıcıda Cloudflare hesabına izin ver
npx wrangler secret put GEMINI_API_KEY  # anahtarı yapıştır; depoya girmez
npx wrangler deploy
```

Dağıtım sonunda bir adres verir:
`https://anlora-ai.<hesap-adin>.workers.dev`

## Uygulamayı bu adrese bağlamak

```bash
VITE_API_BASE_URL="https://anlora-ai.<hesap-adin>.workers.dev" npm run android:sync
cd android && ./gradlew assembleRelease
```

Adres verilmezse uygulama yine derlenir ve çalışır; yalnızca yapay zekâ
kapalı olur.

Çalıştığını doğrulamak için:

```bash
curl https://anlora-ai.<hesap-adin>.workers.dev/api/health
# {"ok":true,"service":"anlora-ai-worker","capabilities":{"ai":true,...}}
```

`ai` alanı `false` dönüyorsa anahtar konmamış demektir.

## Bilinen sınırlar

- **Hız sınırı en iyi çabadır.** Worker'lar birçok kopya hâlinde çalışır ve
  sayaç her kopyada ayrıdır; kararlı bir küresel sınır değildir. Gerçek
  koruma Gemini'nin kendi kotasıdır. Kotanı sıkı korumak istiyorsan
  `ALLOWED_ORIGINS` değişkenini kendi kökenlerinle daralt.
- **Ortak önbellek yok.** Express sunucusunda aynı kelime ikinci kez
  üretilmiyordu (`data/ai-cache.json`). Worker'da kalıcı depolama olmadığı
  için her istek modele gider. Bu istenirse bir KV alanı bağlanarak
  eklenebilir; kurulumu zorlaştırmamak için varsayılan olarak yok.
- **Kişi başına günlük kota yok.** Hesap kavramı burada olmadığı için
  kullanıcı ayrımı yapılamıyor.

## Kod nerede

İstemler ve üretilen kartın denetimi Worker'a özgü değil: `shared/ai/`
altında durur ve Express sunucusu da aynı dosyaları kullanır. Böylece bir
istem düzeltildiğinde iki dağıtım birden düzelir. Worker'a özgü olan tek şey
`src/index.ts`: CORS, hız sınırı ve Gemini'ye giden `fetch`.
