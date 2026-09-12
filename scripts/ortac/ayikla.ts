/**
 * Anlora – Adayları eler: "bu -ed/-ing biçiminin AYRI bir sözlük anlamı var mı?"
 *
 * NEDEN YAPAY ZEKÂ. Soru sözlük bilgisi istiyor ve uydurulamaz (talimat 59).
 * Elimizde başka bir kaynak yok; bu yüzden soru modele soruluyor, ama cevap
 * OLDUĞU GİBİ KABUL EDİLMİYOR: aşağıdaki denetimleri geçemeyen kayıt eleniyor
 * ve gerekçesi yazılıyor. Bu betiğin çıktısı sözlüğe doğrudan girmez; insan
 * gözüyle bakılacak bir ADAY listesidir.
 *
 * ELLİ KELİME TEK İSTEKTE. Kelime başına bir istek atmak 2.122 istek demekti
 * ve ücretsiz kotada bu duvara toslar (67 kelimelik bir kuyrukta 429 alındı).
 * Soru kısa olduğu için grup hâlinde sorulabiliyor: ~43 istek.
 *
 * HIZ SINIRINA SAYGI. Gruplar arasında bekleniyor ve 429 gelirse sunucunun
 * bildirdiği süre kadar durulup aynı grup yeniden deneniyor -- hızlı yeniden
 * denemek sınırı açmıyor, uzatıyor.
 *
 * KONTROL NOKTASI. Çıktı her grupta diske yazılıyor; koşu yarıda kalırsa
 * aynı komut kaldığı yerden devam eder.
 *
 * KULLANIM
 *     GEMINI_API_KEY=... npx tsx scripts/ortac/ayikla.ts
 *     GEMINI_API_KEY=... npx tsx scripts/ortac/ayikla.ts --limit 200
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const ROOT = process.cwd();
const ADAY = path.join(ROOT, 'scripts/ortac/adaylar.json');
const CIKTI = path.join(ROOT, 'scripts/ortac/ayiklanan.json');

/*
 * GRUP BOYUTU 50 -> 30. Elli kelimelik istem uzun bir yanıt istiyor;
 * yoğunluk altındaki model uzun üretimi daha sık reddediyor. Otuz kelime
 * hâlâ 2.122 aday için ~71 istek demek -- kelime başına bir istekten kırk
 * kat ucuz.
 */
const GRUP = 30;
const GRUPLAR_ARASI_MS = 4000;

/**
 * Denenecek modeller, sırayla.
 *
 * BU LİSTE BİR HATADAN SONRA EKLENDİ. Betik tek bir model adıyla
 * (`gemini-2.5-flash`) yazılmıştı ve koşu şunu döndürdü:
 *   404 "This model models/gemini-2.5-flash is no longer available to new users."
 * Yani sorun kota değil, EMEKLİYE AYRILMIŞ MODELDİ; on iki dakika boyunca
 * 404 alınıp "hız sınırı" sanılarak beklendi. Takma adlar (`-latest`) bu
 * yüzden önde: Google bir sürümü kapattığında ad kendiliğinden yenisine
 * işaret ediyor.
 */
const MODELLER = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-flash-lite-latest'];

interface Aday { kok: string; bicim: string; ek: 'ing' | 'ed' }
interface Karar {
  bicim: string;
  kok: string;
  ek: 'ing' | 'ed';
  ayriAnlam: boolean;
  /** Modelin verdiği kısa Türkçe karşılık; yalnızca ayriAnlam true ise. */
  turkce?: string;
  /** Sözcük türü: adj. / n. / v. */
  tur?: string;
  /** Elendiyse sebebi. */
  elendi?: string;
}

function istem(grup: Aday[]): string {
  return `Aşağıda İngilizce fiillerin -ing / -ed biçimleri var. Her biri için TEK soru:

Bu biçim, İngilizce sözlüklerde KENDİ BAŞINA madde olacak kadar ayrı bir anlam taşıyor mu?

EVET örnekleri (ayrı anlam):
  trapped  -> kapana kısılmış (sıfat) — "trap" tuzak/tuzağa düşürmek
  demanding -> yorucu, çok şey isteyen (sıfat)
  moving -> duygulandırıcı (sıfat)
  learned -> âlim, bilgili (sıfat, /ˈlɜːnɪd/)
  deposited -> yatırılmış (sıfat/ortaç, bankacılıkta yerleşik kullanım)

HAYIR örnekleri (yalnızca çekim):
  walked, asked, called, carried, arriving, adding — anlamları kökün aynısı

Kural:
- Yalnızca gerçekten sözlükselleşmiş olanlara true de. Şüphedeysen false.
- true dediğinde "turkce" alanına KISA Türkçe karşılığı (en fazla 4 kelime),
  "tur" alanına sözcük türünü (adj. / n. / v.) yaz.
- false dediğinde turkce ve tur BOŞ kalsın.
- Uydurma yapma; emin değilsen false.

Yanıtı yalnızca şu JSON dizisi olarak ver:
[{"bicim":"...","ayriAnlam":true|false,"turkce":"...","tur":"adj."}]

Biçimler:
${grup.map(a => `${a.bicim} (kök: ${a.kok})`).join('\n')}`;
}

/** Modelin cevabını denetler; geçemeyen eleniyor. */
function kabul(ham: any, aday: Aday): Karar {
  const temel = { bicim: aday.bicim, kok: aday.kok, ek: aday.ek };
  if (!ham || ham.ayriAnlam !== true) return { ...temel, ayriAnlam: false };

  const turkce = String(ham.turkce || '').trim();
  const tur = String(ham.tur || '').trim();

  // Karşılıksız bir "evet" işe yaramaz: sonraki adımda doldurulacak alan yok.
  if (!turkce) return { ...temel, ayriAnlam: false, elendi: 'Türkçe karşılık verilmedi' };
  if (turkce.split(/\s+/).length > 5) {
    return { ...temel, ayriAnlam: false, elendi: 'karşılık cümleye dönmüş' };
  }
  // Karşılık İngilizce kelimenin kendisiyse bilgi taşımıyor.
  if (turkce.toLowerCase() === aday.bicim || turkce.toLowerCase() === aday.kok) {
    return { ...temel, ayriAnlam: false, elendi: 'karşılık kelimenin kendisi' };
  }
  return { ...temel, ayriAnlam: true, turkce, tur: tur || undefined };
}

function bekle(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** 429 gövdesinden "şu kadar sonra dene" süresini okur. */
function beklemeSuresi(metin: string): number {
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(metin || '');
  return m ? Math.min(Math.ceil(Number(m[1])), 900) : 45;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY tanımlı değil.');
    process.exit(1);
  }

  const adaylar: Aday[] = JSON.parse(fs.readFileSync(ADAY, 'utf8'));
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : adaylar.length;

  const onceki: Karar[] = fs.existsSync(CIKTI) ? JSON.parse(fs.readFileSync(CIKTI, 'utf8')) : [];
  const bitenler = new Set(onceki.map(k => k.bicim));
  const kalan = adaylar.filter(a => !bitenler.has(a.bicim)).slice(0, limit);

  console.log(`Aday: ${adaylar.length} · daha önce işlenen: ${onceki.length} · bu koşuda: ${kalan.length}`);

  const ai = new GoogleGenAI({ apiKey });
  const sonuc: Karar[] = [...onceki];
  /** Çalışan model bulunana kadar listede ilerlenir. */
  let modelIdx = 0;
  /** Son hata metni; bekleme süresi buradan okunuyor. */
  let sonHata = '';

  for (let i = 0; i < kalan.length; i += GRUP) {
    const grup = kalan.slice(i, i + GRUP);
    const no = Math.floor(i / GRUP) + 1;
    const toplam = Math.ceil(kalan.length / GRUP);

    /*
     * ÖNCE MODEL DEĞİŞTİR, SONRA BEKLE.
     *
     * İlk sürüm yalnızca 404'te sıradaki modele geçiyordu; 503 gelince
     * altmış saniye bekleyip AYNI modeli yeniden deniyordu. Koşu on dört
     * dakika sürdü ve hiçbir grup işlenemedi, çünkü `gemini-flash-latest`
     * o sırada sürekli 503 "high demand" döndürüyordu.
     *
     * Oysa 503 de 404 gibi MODELE ait: başka bir model o anda boş olabilir.
     * Anlora Worker'ında zaten bu mantık var (her hatada sıradaki aday
     * denenir); betik onunla aynı davranışa çekildi. Beklemek yalnızca
     * BÜTÜN modeller tükendiğinde yapılıyor.
     */
    let cevap: any[] | null = null;
    for (let tur = 0; tur < 3 && !cevap; tur++) {
      for (let m = 0; m < MODELLER.length && !cevap; m++) {
        const model = MODELLER[(modelIdx + m) % MODELLER.length];
        try {
          const yanit = await ai.models.generateContent({
            model,
            contents: istem(grup),
            config: { responseMimeType: 'application/json' }
          });
          const metin = (yanit.text || '').trim().replace(/^```json\s*|\s*```$/g, '');
          cevap = JSON.parse(metin);
          // Çalışan model hatırlanıyor: sonraki gruplar doğrudan ona gidiyor.
          modelIdx = MODELLER.indexOf(model);
        } catch (hata) {
          const mesaj = String((hata as Error).message || '');
          console.warn(`  grup ${no} · ${model}: ${mesaj.slice(0, 110)}`);
          sonHata = mesaj;
        }
      }
      if (!cevap && tur < 2) {
        const sn = beklemeSuresi(sonHata);
        console.warn(`  grup ${no}: bütün modeller başarısız, ${sn} sn bekleniyor.`);
        await bekle(sn * 1000);
      }
    }

    if (!cevap) {
      console.warn(`  grup ${no}/${toplam} atlandı; sonraki koşuda yeniden denenir.`);
      continue;
    }

    const indeks = new Map(cevap.map((x: any) => [String(x?.bicim || '').toLowerCase(), x]));
    let evet = 0;
    for (const aday of grup) {
      const karar = kabul(indeks.get(aday.bicim), aday);
      if (karar.ayriAnlam) evet++;
      sonuc.push(karar);
    }
    fs.writeFileSync(CIKTI, JSON.stringify(sonuc, null, 1));
    console.log(`  grup ${no}/${toplam}: ${evet}/${grup.length} ayrı anlam · toplam ${sonuc.length} işlendi`);

    if (i + GRUP < kalan.length) await bekle(GRUPLAR_ARASI_MS);
  }

  const kabulEdilen = sonuc.filter(k => k.ayriAnlam);
  console.log(`\nBİTTİ. İşlenen: ${sonuc.length} · ayrı anlamlı bulunan: ${kabulEdilen.length}`);
  console.log(`Kullanılan model: ${MODELLER[modelIdx]}`);
  console.log(`Çıktı: ${path.relative(ROOT, CIKTI)}`);

  /*
   * HİÇBİR GRUP GEÇMEDİYSE KOŞU BAŞARISIZ SAYILIR.
   *
   * Önceki koşu "BİTTİ. İşlenen: 0" yazıp yeşil bitti; hata ancak sonraki
   * adımda, "dosya yok" diye ortaya çıktı. Sessizce hiçbir şey yapmayan bir
   * koşu, başarısız olandan daha kötüdür.
   */
  if (sonuc.length === onceki.length && kalan.length > 0) {
    console.error('Hiçbir grup işlenemedi; yukarıdaki hataya bakın.');
    process.exit(1);
  }
}

main();
