/**
 * Anlora – Genel Dağarcık'ta içeriği eksik anlamları doldurur.
 *
 * NEDEN VAR. Kelime listesi 15.052'den 24.298'e büyütüldü; yeni 9.246
 * kelimenin Türkçe karşılığı ve örnek cümlesi yok. İçeriği olmayan kelime
 * pakete GİRMEZ (`build_bands.py` yalnızca içeriği hazır olanları yazar),
 * yani bu betik koşmadan liste büyümesinin kullanıcıya faydası olmaz.
 *
 * UYDURMA VERİ YAZILMAZ (talimat 59). Denetimi geçemeyen anlam yazılmaz,
 * eksik bırakılır ve bir sonraki koşuda yeniden denenir. Denetim kuralları
 * `build_bands.py` içindeki `validate` ile aynı: üç örnek, her örnekte
 * kelimenin kendisi, her örneğin Türkçesi, anlamın kelimenin tekrarı
 * olmaması. Orası nihai kapı; burası o kapıdan geçecek içeriği üretiyor.
 *
 * BANT SIRASIYLA. Bant numarası sıklık sırasını taşıyor: bant 8, bant 13'ten
 * daha sık kullanılan kelimeleri içeriyor. En sık kullanılanlar önce
 * dolduruluyor ki iş yarıda kalsa bile en çok işe yarayacak kısım hazır
 * olsun.
 *
 * KULLANIM
 *     GEMINI_API_KEY=... npx tsx scripts/extended/uret_icerik.ts --bant 8
 *     GEMINI_API_KEY=... npx tsx scripts/extended/uret_icerik.ts --bant 8 --limit 300
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const ROOT = process.cwd();
const LISTE = path.join(ROOT, 'scripts/extended/source/wordlist.json');
const ICERIK = path.join(ROOT, 'scripts/extended/content');

const GRUP = 15;
const ARA_MS = 3000;
const MODELLER = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-flash-lite-latest'];
const POS_SLUG: Record<string, string> = { 'n.': 'n', 'v.': 'v', 'adj.': 'adj', 'adv.': 'adv' };

interface Kelime { word: string; pos: string[]; rank: number; band: number; ipa: string | null }
interface Ornek { en: string; tr: string }
interface Anlam { turkishMeanings: string[]; examples: Ornek[] }

const arg = (ad: string): string | undefined => {
  const i = process.argv.indexOf(ad);
  return i > -1 ? process.argv[i + 1] : undefined;
};

/** Cümle kelimeyi içeriyor mu? build_bands.py ile aynı ölçüt. */
function ceumleIceriyor(cumle: string, kelime: string): boolean {
  return new RegExp(`\\b${kelime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(cumle);
}

/** build_bands.py `validate` ile aynı kurallar. */
function sorunlar(kelime: string, a: Anlam): string[] {
  const s: string[] = [];
  const anlamlar = (a.turkishMeanings || []).map(m => String(m).trim()).filter(Boolean);
  if (!anlamlar.length) s.push('Türkçe anlam yok');
  else if (anlamlar.every(m => m.toLowerCase() === kelime.toLowerCase())) {
    s.push('anlam kelimenin kendisi');
  }
  const ornekler = a.examples || [];
  if (ornekler.length < 3) s.push(`${ornekler.length} örnek`);
  const gorulen = new Set<string>();
  for (const o of ornekler) {
    const en = String(o?.en || '').trim();
    const tr = String(o?.tr || '').trim();
    if (!en || !tr) { s.push('örnek eksik çeviri'); continue; }
    if (gorulen.has(en.toLowerCase())) s.push('yinelenen örnek');
    gorulen.add(en.toLowerCase());
    if (!ceumleIceriyor(en, kelime)) s.push(`örnek kelimeyi içermiyor: ${en}`);
  }
  return s;
}

function istem(grup: { id: string; word: string; pos: string }[]): string {
  return `Aşağıdaki İngilizce kelimeler için sözlük içeriği üret. Her kelimenin
sözcük türü parantez içinde verildi; anlamı O TÜRE göre yaz.

Her kayıt için:
- turkishMeanings: 1-3 kısa Türkçe karşılık (dizi). Karşılık İngilizce
  kelimenin kendisi OLAMAZ.
- examples: TAM ÜÇ örnek; her biri {"en": "...", "tr": "..."}
    * İngilizce cümlede kelime AYNEN geçmeli (çekimli hâli değil)
    * üçü farklı bağlamda olmalı, birbirinin tekrarı olmamalı
    * kısa ve günlük dilde
    * tr, en cümlesinin Türkçe çevirisi olmalı

Bilmediğin bir kelime için uydurma: o kaydı diziden çıkar.

Yanıt yalnızca şu JSON dizisi:
[{"id":"...","turkishMeanings":["..."],"examples":[{"en":"...","tr":"..."},{"en":"...","tr":"..."},{"en":"...","tr":"..."}]}]

Kelimeler:
${grup.map(g => `${g.id}\t${g.word} (${g.pos})`).join('\n')}`;
}

const bekle = (ms: number) => new Promise(r => setTimeout(r, ms));

function mevcutIcerik(): Set<string> {
  const kimlikler = new Set<string>();
  for (const dosya of fs.readdirSync(ICERIK).filter(f => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(ICERIK, dosya), 'utf8'));
    for (const k of Object.keys(d)) kimlikler.add(k);
  }
  return kimlikler;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY tanımlı değil.');
    process.exit(1);
  }
  const bant = Number(arg('--bant') || 0);
  if (!bant) {
    console.error('--bant verilmedi.');
    process.exit(1);
  }
  const limit = Number(arg('--limit') || 0) || Infinity;

  const kelimeler: Kelime[] = JSON.parse(fs.readFileSync(LISTE, 'utf8'));
  const hazir = mevcutIcerik();

  const eksik: { id: string; word: string; pos: string }[] = [];
  for (const k of kelimeler) {
    if (k.band !== bant) continue;
    for (const pos of k.pos) {
      if (!POS_SLUG[pos]) continue;
      const id = `gen-b${k.band}-${k.word}-${POS_SLUG[pos]}`;
      if (!hazir.has(id)) eksik.push({ id, word: k.word, pos });
    }
  }
  const isler = eksik.slice(0, limit);
  console.log(`Bant ${bant}: eksik ${eksik.length} anlam · bu koşuda ${isler.length}`);
  if (!isler.length) return;

  const ai = new GoogleGenAI({ apiKey });
  const uretilen: Record<string, Anlam> = {};
  const atilan: string[] = [];
  let modelIdx = 0;

  /** Çıktı dosyası; koşu ortasında kesilse de o ana kadarki iş diskte kalır. */
  const damga = new Date().toISOString().slice(0, 10);
  const cikti = path.join(ICERIK, `b${bant}-ai-${damga}.json`);

  for (let i = 0; i < isler.length; i += GRUP) {
    const grup = isler.slice(i, i + GRUP);
    const no = Math.floor(i / GRUP) + 1;
    const toplam = Math.ceil(isler.length / GRUP);

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
          console.warn(`  grup ${no} · ${model}: ${String((hata as Error).message).slice(0, 90)}`);
        }
      }
      if (!cevap && tur < 2) await bekle(45_000);
    }
    if (!cevap) {
      console.warn(`  grup ${no}/${toplam} atlandı; sonraki koşuda yeniden denenir.`);
      continue;
    }

    const indeks = new Map(cevap.map((x: any) => [String(x?.id || ''), x]));
    let gecen = 0;
    for (const is of grup) {
      const ham = indeks.get(is.id);
      if (!ham) { atilan.push(`${is.word} (yanıtta yok)`); continue; }
      const anlam: Anlam = {
        turkishMeanings: (Array.isArray(ham.turkishMeanings) ? ham.turkishMeanings : [])
          .map((m: unknown) => String(m).trim())
          .filter(Boolean)
          .slice(0, 3),
        examples: (Array.isArray(ham.examples) ? ham.examples : [])
          .map((e: any) => ({ en: String(e?.en || '').trim(), tr: String(e?.tr || '').trim() }))
          .slice(0, 3)
      };
      const s = sorunlar(is.word, anlam);
      if (s.length) { atilan.push(`${is.word} (${s[0]})`); continue; }
      uretilen[is.id] = anlam;
      gecen++;
    }

    fs.writeFileSync(cikti, JSON.stringify(uretilen, null, 1));
    console.log(`  grup ${no}/${toplam}: ${gecen}/${grup.length} · toplam ${Object.keys(uretilen).length}`);
    if (i + GRUP < isler.length) await bekle(ARA_MS);
  }

  console.log(`\nBİTTİ. Üretilen: ${Object.keys(uretilen).length} · denetimden atılan: ${atilan.length}`);
  if (atilan.length) console.log('Atılanlardan: ' + atilan.slice(0, 20).join(', '));
  console.log(`Çıktı: ${path.relative(ROOT, cikti)}`);
  if (!Object.keys(uretilen).length) {
    console.error('Hiçbir anlam üretilemedi.');
    process.exit(1);
  }
}

main();
