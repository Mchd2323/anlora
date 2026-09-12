/**
 * Anlora – Ayıklanan adayları İKİNCİ ve FARKLI bir soruyla süzer.
 *
 * NEDEN GEREKLİ. Birinci tur 2.122 adaydan 409'unu "ayrı anlamlı" buldu
 * (%19), ama örneklem incelendiğinde oranın yaklaşık üçte biri hâlâ sadece
 * ortaçtı: `proposed` (önerilen), `registered` (kayıtlı), `ranked`,
 * `unified`, `vanishing`. Üstelik pilot dilimde oran %11 iken listenin
 * sonuna doğru %19'a çıkmıştı -- yani eşik gevşemiş.
 *
 * ÇÖZÜM AYNI SORUYU TEKRAR SORMAK DEĞİL. Aynı soru aynı gevşekliği
 * üretirdi. Burada SOMUT ve doğrulanabilir bir şey soruluyor: bu biçim
 * öğrenci sözlüklerinde KENDİ BAŞINA madde (headword) olarak yer alıyor
 * mu? Bu, yorum değil olgu sorusudur; "sanırım ayrı sayılır" cevabını
 * zorlaştırıyor.
 *
 * SONUÇ YİNE KESİN HÜKÜM DEĞİL: iki turu da geçen liste, insan gözüyle
 * bakılacak son aday listesidir. Sözlüğe hiçbir kayıt onaysız girmez.
 *
 * KULLANIM
 *     GEMINI_API_KEY=... npx tsx scripts/ortac/dogrula.ts
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const ROOT = process.cwd();
const GIRDI = path.join(ROOT, 'scripts/ortac/ayiklanan.json');
const CIKTI = path.join(ROOT, 'scripts/ortac/onaylanan.json');

const GRUP = 30;
const ARA_MS = 4000;
const MODELLER = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-flash-lite-latest'];

interface Karar {
  bicim: string;
  kok: string;
  ek: 'ing' | 'ed';
  ayriAnlam: boolean;
  turkce?: string;
  ingilizce?: string;
  ornek?: string;
  tur?: string;
}

interface Onay extends Karar {
  /** İkinci turda da geçti mi? */
  onaylandi: boolean;
  /** Hangi sözlükte madde olduğu iddia edildi. */
  kaynak?: string;
}

function istem(grup: Karar[]): string {
  return `Aşağıdaki İngilizce -ing/-ed biçimleri için TEK bir OLGU sorusu var:

Bu biçim, öğrenci sözlüklerinde (Oxford Learner's Dictionary, Cambridge
Dictionary) KENDİ BAŞINA bir madde başı (headword) olarak yer alıyor mu?

Bu bir yorum sorusu DEĞİL. "Sıfat gibi kullanılabiliyor" yeterli değildir;
sözlükte kendi maddesi VAR MI, ona bakılıyor.

  affected   -> EVET (Oxford'da ayrı madde: "not natural or sincere")
  regarding  -> EVET (prep. maddesi)
  wanting    -> EVET ("lacking")
  proposed   -> HAYIR (propose fiilinin ortacı, ayrı madde değil)
  registered -> HAYIR
  ranked     -> HAYIR
  unified    -> HAYIR

Emin değilsen HAYIR de. Yanıt yalnızca şu JSON dizisi:
[{"bicim":"...","madde":true|false,"kaynak":"Oxford"|"Cambridge"|""}]

Biçimler:
${grup.map(k => `${k.bicim} — iddia edilen anlam: ${k.turkce}`).join('\n')}`;
}

const bekle = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY tanımlı değil.');
    process.exit(1);
  }

  const hepsi: Karar[] = JSON.parse(fs.readFileSync(GIRDI, 'utf8'));
  const adaylar = hepsi.filter(k => k.ayriAnlam);

  const onceki: Onay[] = fs.existsSync(CIKTI) ? JSON.parse(fs.readFileSync(CIKTI, 'utf8')) : [];
  const bitenler = new Set(onceki.map(o => o.bicim));
  const kalan = adaylar.filter(a => !bitenler.has(a.bicim));

  console.log(`Birinci turu geçen: ${adaylar.length} · bu koşuda: ${kalan.length}`);

  const ai = new GoogleGenAI({ apiKey });
  const sonuc: Onay[] = [...onceki];
  let modelIdx = 0;

  for (let i = 0; i < kalan.length; i += GRUP) {
    const grup = kalan.slice(i, i + GRUP);
    const no = Math.floor(i / GRUP) + 1;
    const toplam = Math.ceil(kalan.length / GRUP);

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
          cevap = JSON.parse((yanit.text || '').trim().replace(/^```json\s*|\s*```$/g, ''));
          modelIdx = MODELLER.indexOf(model);
        } catch (hata) {
          console.warn(`  grup ${no} · ${model}: ${String((hata as Error).message).slice(0, 100)}`);
        }
      }
      if (!cevap && tur < 2) await bekle(45_000);
    }

    if (!cevap) {
      console.warn(`  grup ${no}/${toplam} atlandı.`);
      continue;
    }

    const indeks = new Map(cevap.map((x: any) => [String(x?.bicim || '').toLowerCase(), x]));
    let gecen = 0;
    for (const aday of grup) {
      const c = indeks.get(aday.bicim);
      const onaylandi = c?.madde === true;
      if (onaylandi) gecen++;
      sonuc.push({ ...aday, onaylandi, kaynak: onaylandi ? String(c.kaynak || '') : undefined });
    }
    fs.writeFileSync(CIKTI, JSON.stringify(sonuc, null, 1));
    console.log(`  grup ${no}/${toplam}: ${gecen}/${grup.length} onaylandı · toplam ${sonuc.length}`);
    if (i + GRUP < kalan.length) await bekle(ARA_MS);
  }

  const onayli = sonuc.filter(o => o.onaylandi);
  console.log(`\nBİTTİ. İkinci turu geçen: ${onayli.length}/${sonuc.length}`);
  if (sonuc.length === onceki.length && kalan.length > 0) {
    console.error('Hiçbir grup işlenemedi.');
    process.exit(1);
  }
}

main();
