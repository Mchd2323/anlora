/**
 * Anlora – Onaylanan ortaç biçimleri için kart içeriği üretir.
 *
 * GİRDİ: `onaylanan.json` içinde iki turu da geçen biçimler. Ellerinde
 * birer Türkçe karşılık, İngilizce tanım ve örnek cümle var; sözlük şeması
 * ise ÜÇ örnek, telaffuz ve CEFR seviyesi istiyor.
 *
 * UYDURMA VERİ YAZILMAZ (talimat 59). Aşağıdaki denetimlerden geçemeyen
 * kayıt ATILIR, yarım bırakılmaz: eksik bir kart, kullanıcıya boş alan
 * göstermekten daha kötü değil; ama yanlış bir örnek cümle yanlış öğretir.
 *
 * KULLANIM
 *     GEMINI_API_KEY=... npx tsx scripts/ortac/icerik.ts
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const ROOT = process.cwd();
const GIRDI = path.join(ROOT, 'scripts/ortac/onaylanan.json');
const CIKTI = path.join(ROOT, 'scripts/ortac/icerik.json');

/** Üç örnek cümle uzun yanıt demek; grup küçük tutuluyor. */
const GRUP = 15;
const ARA_MS = 4000;
const MODELLER = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-flash-lite-latest'];
const SEVIYELER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

interface Onay {
  bicim: string;
  kok: string;
  ek: 'ing' | 'ed';
  onaylandi: boolean;
  turkce?: string;
  ingilizce?: string;
  ornek?: string;
  tur?: string;
}

interface Ornek { en: string; tr: string }

interface Kart {
  bicim: string;
  kok: string;
  partOfSpeech: string;
  turkishMeanings: string[];
  examples: Ornek[];
  cefr: string;
  phonetic: string;
}

function istem(grup: Onay[]): string {
  return `Aşağıdaki İngilizce kelimeler için sözlük kartı içeriği üret.
Bunlar bir fiilin -ing/-ed biçimi ama KENDİ ayrı anlamları var; kartı o AYRI
anlama göre hazırla, kökün anlamına göre değil.

Her kelime için:
- partOfSpeech: "adj." | "n." | "prep." | "conj." | "v."
- turkishMeanings: 1-2 kısa Türkçe karşılık (dizi)
- examples: TAM ÜÇ örnek; her biri {"en": "...", "tr": "..."}
    * İngilizce cümlede kelime AYNEN geçmeli
    * üçü birbirinden farklı bağlamda olmalı
    * tr, en cümlesinin Türkçe çevirisi olmalı (açıklama değil)
    * kısa ve günlük dilde olsun
- cefr: A1 | A2 | B1 | B2 | C1 | C2
- phonetic: IPA, eğik çizgiler arasında, ör. /ˈtræpt/

Yanıt yalnızca şu JSON dizisi:
[{"bicim":"...","partOfSpeech":"adj.","turkishMeanings":["..."],
  "examples":[{"en":"...","tr":"..."},{"en":"...","tr":"..."},{"en":"...","tr":"..."}],
  "cefr":"B2","phonetic":"/.../"}]

Kelimeler:
${grup.map(o => `${o.bicim} — anlam: ${o.turkce} (${o.ingilizce}) [${o.tur || ''}]`).join('\n')}`;
}

/**
 * Kabul denetimi. Geçemeyen kayıt ATILIR.
 *
 * En önemlisi örnek cümle denetimi: kelimeyi içermeyen bir cümle o kelimeyi
 * öğretmez, ve Türkçesi boş kalan bir örnek kartta yarım görünür.
 */
function kabul(ham: any, o: Onay): { kart?: Kart; hata?: string } {
  const pos = String(ham?.partOfSpeech || o.tur || '').trim();
  if (!pos) return { hata: 'sözcük türü yok' };

  const anlamlar = (Array.isArray(ham?.turkishMeanings) ? ham.turkishMeanings : [])
    .map((m: unknown) => String(m).trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!anlamlar.length) return { hata: 'Türkçe karşılık yok' };
  if (anlamlar.some((m: string) => m.split(/\s+/).length > 6)) {
    return { hata: 'karşılık cümleye dönmüş' };
  }

  const ornekler: Ornek[] = (Array.isArray(ham?.examples) ? ham.examples : [])
    .map((e: any) => ({ en: String(e?.en || '').trim(), tr: String(e?.tr || '').trim() }))
    .filter((e: Ornek) => e.en && e.tr);
  if (ornekler.length < 3) return { hata: 'üç örnek yok' };

  const kalip = new RegExp(`\\b${o.bicim}\\b`, 'i');
  if (!ornekler.slice(0, 3).every(e => kalip.test(e.en))) {
    return { hata: 'örnekte kelime geçmiyor' };
  }
  // Aynı cümlenin tekrarı üç örnek sayılmaz.
  const benzersiz = new Set(ornekler.slice(0, 3).map(e => e.en.toLowerCase()));
  if (benzersiz.size < 3) return { hata: 'örnekler birbirinin aynısı' };

  const cefr = String(ham?.cefr || '').trim().toUpperCase();
  if (!SEVIYELER.includes(cefr)) return { hata: 'geçersiz seviye' };

  const phonetic = String(ham?.phonetic || '').trim();
  if (!/^\/.+\/$/.test(phonetic)) return { hata: 'telaffuz biçimi bozuk' };

  return {
    kart: {
      bicim: o.bicim,
      kok: o.kok,
      partOfSpeech: pos,
      turkishMeanings: anlamlar,
      examples: ornekler.slice(0, 3),
      cefr,
      phonetic
    }
  };
}

const bekle = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY tanımlı değil.');
    process.exit(1);
  }

  const onaylar: Onay[] = JSON.parse(fs.readFileSync(GIRDI, 'utf8')).filter(
    (o: Onay) => o.onaylandi
  );
  const onceki: Kart[] = fs.existsSync(CIKTI) ? JSON.parse(fs.readFileSync(CIKTI, 'utf8')) : [];
  const bitenler = new Set(onceki.map(k => k.bicim));
  const kalan = onaylar.filter(o => !bitenler.has(o.bicim));

  console.log(`Onaylı: ${onaylar.length} · bu koşuda: ${kalan.length}`);

  const ai = new GoogleGenAI({ apiKey });
  const kartlar: Kart[] = [...onceki];
  const atilan: string[] = [];
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
    for (const o of grup) {
      const sonuc = kabul(indeks.get(o.bicim), o);
      if (sonuc.kart) {
        kartlar.push(sonuc.kart);
        gecen++;
      } else {
        atilan.push(`${o.bicim} (${sonuc.hata})`);
      }
    }
    fs.writeFileSync(CIKTI, JSON.stringify(kartlar, null, 1));
    console.log(`  grup ${no}/${toplam}: ${gecen}/${grup.length} geçti · toplam ${kartlar.length}`);
    if (i + GRUP < kalan.length) await bekle(ARA_MS);
  }

  console.log(`\nBİTTİ. Kart: ${kartlar.length} · denetimden atılan: ${atilan.length}`);
  if (atilan.length) console.log('Atılanlar: ' + atilan.slice(0, 30).join(', '));
  if (kartlar.length === onceki.length && kalan.length > 0) {
    console.error('Hiçbir grup işlenemedi.');
    process.exit(1);
  }
}

main();
