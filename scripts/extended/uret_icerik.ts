/**
 * Anlora – Genel Dağarcık'ta içeriği eksik anlamları doldurur.
 *
 * NEDEN VAR. Kelime listesi 15.052'den 24.298'e büyütüldü; yeni 9.246
 * kelimenin Türkçe karşılığı ve örnek cümlesi yok. İçeriği olmayan kelime
 * pakete GİRMEZ (`build_bands.py` yalnızca içeriği hazır olanları yazar),
 * yani bu betik koşmadan liste büyümesinin kullanıcıya faydası olmaz.
 *
 * UYDURMA VERİ YAZILMAZ (talimat 59). Denetimi geçemeyen anlam yazılmaz,
 * eksik bırakılır ve bir sonraki koşuda yeniden denenir. Biçim denetimi
 * `build_bands.py` içindeki `validate` ile aynı: üç örnek, her örnekte
 * kelimenin kendisi, her örneğin Türkçesi, anlamın kelimenin tekrarı
 * olmaması. Orası nihai kapı; burası o kapıdan geçecek içeriği üretiyor.
 *
 * ANLAM TANIMI VERİLİR. İlk sürüm modele yalnızca "gild (n.)" diyordu; model
 * hangi anlamın istendiğini bilemeyip tahmin ediyordu. Bant 8'in ilk 125
 * kaydından 11'i bu yüzden yanlış çıktı: gild (n.) WordNet'te "lonca" iken
 * "altın yaldız" yazılmıştı, instep (n.) "ayak kemeri" iken "ayakyolu".
 * Artık `source/tanimlar.json` içindeki WordNet tanımı isteme konuluyor;
 * bant 8-13 anlamlarının %98,8'inde tanım var.
 *
 * İKİ AŞAMA. Üretilen kayıt ikinci bir turda denetleniyor: kelime, türü,
 * İngilizce tanımı ve yazılan Türkçe karşılıklar modele geri veriliyor,
 * "bu tanıma uymayan ya da yazımı bozuk olan hangisi" diye soruluyor. Bu tur
 * örnek cümle taşımadığı için istek başına 60 kayıt sığıyor; üretimin dörtte
 * biri kadar bile istek harcamıyor. Denetimden dönen kayıt yazılmıyor,
 * `denetim/` altına sebebiyle kaydediliyor; üç kez dönen bir daha istenmiyor.
 *
 * BANT SIRASIYLA. Bant numarası sıklık sırasını taşıyor: bant 8, bant 13'ten
 * daha sık kullanılan kelimeleri içeriyor. En sık kullanılanlar önce
 * dolduruluyor ki iş yarıda kalsa bile en çok işe yarayacak kısım hazır
 * olsun.
 *
 * KULLANIM
 *     GEMINI_API_KEY=... npx tsx scripts/extended/uret_icerik.ts --bant 8
 *     GEMINI_API_KEY=... npx tsx scripts/extended/uret_icerik.ts --bant 8 --limit 300
    GEMINI_API_KEY=... npx tsx scripts/extended/uret_icerik.ts --denetle <dosya>
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { sorunlar, type Anlam } from './denetim_kurallari';

const ROOT = process.cwd();
const LISTE = path.join(ROOT, 'scripts/extended/source/wordlist.json');
const TANIM = path.join(ROOT, 'scripts/extended/source/tanimlar.json');
const ICERIK = path.join(ROOT, 'scripts/extended/content');
const DENETIM = path.join(ROOT, 'scripts/extended/denetim');

const GRUP = 15;
/** Denetim turu örnek cümle taşımıyor; kayıt başına birkaç kelime. */
const DENETIM_GRUP = 60;
const ARA_MS = 3000;
/** Bir kimlik bu kadar kez denetimden dönerse artık istenmiyor. */
const EN_COK_RED = 3;
const MODELLER = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-flash-lite-latest'];
const POS_SLUG: Record<string, string> = {
  'n.': 'n', 'v.': 'v', 'adj.': 'adj', 'adv.': 'adv', 'prep.': 'prep', 'conj.': 'conj'
};

interface Kelime { word: string; pos: string[]; rank: number; band: number; ipa: string | null }
interface Is { id: string; word: string; pos: string; tanimlar: string[] }

const arg = (ad: string): string | undefined => {
  const i = process.argv.indexOf(ad);
  return i > -1 ? process.argv[i + 1] : undefined;
};

function istem(grup: Is[]): string {
  return `Aşağıdaki İngilizce kelimeler için sözlük içeriği üret. Her kelimenin
sözcük türü parantez içinde, İngilizce tanımı altında verildi. Karşılığı
VERİLEN TANIMA göre yaz; kelimenin başka bir anlamını yazma.

Her kayıt için:
- turkishMeanings: 1-3 kısa Türkçe karşılık (dizi). Karşılık İngilizce
  kelimenin kendisi OLAMAZ. Tür ne ise karşılık da o tür olmalı: fiil için
  mastar ("kaçmak"), isim için isim ("kaçış"). Türkçe yazımı doğru olmalı.
- examples: TAM ÜÇ örnek; her biri {"en": "...", "tr": "..."}
    * İngilizce cümlede kelime AYNEN geçmeli (çekimli hâli değil)
    * üçü farklı bağlamda olmalı, birbirinin tekrarı olmamalı
    * kısa ve günlük dilde
    * tr, en cümlesinin Türkçe çevirisi olmalı

Bilmediğin bir kelime için uydurma: o kaydı diziden çıkar.

Yanıt yalnızca şu JSON dizisi:
[{"id":"...","turkishMeanings":["..."],"examples":[{"en":"...","tr":"..."},{"en":"...","tr":"..."},{"en":"...","tr":"..."}]}]

Kelimeler:
${grup.map(g => {
    const basli = `${g.id}\t${g.word} (${g.pos})`;
    return g.tanimlar.length
      ? `${basli}\n${g.tanimlar.map((t, i) => `   ${i + 1}. ${t}`).join('\n')}`
      : basli;
  }).join('\n')}`;
}

/**
 * Denetim istemi. Örnek cümle göndermiyor: yanlış anlam da yazım hatası da
 * karşılığın kendisinde görünüyor, cümleler istek boyutunu üçe katlardı.
 */
function denetimIstemi(grup: { id: string; word: string; pos: string; tanim: string; anlamlar: string[] }[]): string {
  return `Aşağıda İngilizce kelimeler, sözcük türleri, İngilizce tanımları ve
onlar için yazılmış Türkçe karşılıklar var. Her kaydı denetle:

1. Türkçe karşılık VERİLEN TANIMA uyuyor mu? (kelimenin başka bir anlamı
   yazılmışsa uymuyor sayılır)
2. Türkçe yazım hatası var mı?
3. Karşılığın türü kelimenin türüne uyuyor mu? (fiil "-mak/-mek" ile biter)

YALNIZCA sorunlu kayıtları döndür. Sorun görmediğin kaydı yazma; hepsi
düzgünse boş dizi döndür. Emin değilsen sorunlu SAYMA.

Yanıt yalnızca şu JSON dizisi:
[{"id":"...","sebep":"kısa sebep"}]

Kayıtlar:
${grup.map(g => `${g.id}\t${g.word} (${g.pos})${g.tanim ? ` — ${g.tanim}` : ''}\n   yazılan: ${g.anlamlar.join(' / ')}`).join('\n')}`;
}

const bekle = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Modele sor; hata alırsan sıradaki modele geç, tur başına bir kez bekle. */
async function modeleSor(ai: any, istem: string, etiket: string, durum: { idx: number }): Promise<any[] | null> {
  for (let tur = 0; tur < 3; tur++) {
    for (let m = 0; m < MODELLER.length; m++) {
      const model = MODELLER[(durum.idx + m) % MODELLER.length];
      try {
        const yanit = await ai.models.generateContent({
          model,
          contents: istem,
          config: { responseMimeType: 'application/json' }
        });
        durum.idx = MODELLER.indexOf(model);
        return JSON.parse((yanit.text || '').trim().replace(/^```json\s*|\s*```$/g, ''));
      } catch (hata) {
        console.warn(`  ${etiket} · ${model}: ${String((hata as Error).message).slice(0, 90)}`);
      }
    }
    if (tur < 2) await bekle(45_000);
  }
  return null;
}

/** Denetimden dönen kimliklerin defteri: kimlik -> {kaç kez, son sebep}. */
type RedDefteri = Record<string, { kez: number; sebep: string }>;

function redDefteriYolu(bant: number): string {
  return path.join(DENETIM, `b${bant}-red.json`);
}

function redDefteriOku(bant: number): RedDefteri {
  const yol = redDefteriYolu(bant);
  return fs.existsSync(yol) ? JSON.parse(fs.readFileSync(yol, 'utf8')) : {};
}

function redDefteriYaz(bant: number, defter: RedDefteri): void {
  fs.mkdirSync(DENETIM, { recursive: true });
  fs.writeFileSync(redDefteriYolu(bant), JSON.stringify(defter, null, 1));
}

/**
 * İkinci tur: yazılan karşılıkları İngilizce tanıma karşı sınar.
 * Dönen küme, yazılmaması gereken kimlikler ve sebepleridir.
 */
async function denetle(
  ai: any,
  kayitlar: { id: string; word: string; pos: string; tanim: string; anlamlar: string[] }[],
  durum: { idx: number }
): Promise<Map<string, string>> {
  const red = new Map<string, string>();
  for (let i = 0; i < kayitlar.length; i += DENETIM_GRUP) {
    const grup = kayitlar.slice(i, i + DENETIM_GRUP);
    const no = Math.floor(i / DENETIM_GRUP) + 1;
    const toplam = Math.ceil(kayitlar.length / DENETIM_GRUP);
    const cevap = await modeleSor(ai, denetimIstemi(grup), `denetim ${no}`, durum);
    if (!cevap) {
      console.warn(`  denetim ${no}/${toplam} yapılamadı; bu partinin kayıtları yazılmıyor.`);
      for (const g of grup) red.set(g.id, 'denetim yapılamadı');
      continue;
    }
    const gecerli = new Set(grup.map(g => g.id));
    let bulunan = 0;
    for (const x of cevap) {
      const id = String(x?.id || '');
      if (!gecerli.has(id)) continue;
      red.set(id, String(x?.sebep || 'denetimden döndü').slice(0, 120));
      bulunan++;
    }
    console.log(`  denetim ${no}/${toplam}: ${grup.length} kayıt · ${bulunan} sorunlu`);
    if (i + DENETIM_GRUP < kayitlar.length) await bekle(ARA_MS);
  }
  return red;
}

function mevcutIcerik(): Set<string> {
  const kimlikler = new Set<string>();
  for (const dosya of fs.readdirSync(ICERIK).filter(f => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(ICERIK, dosya), 'utf8'));
    for (const k of Object.keys(d)) kimlikler.add(k);
  }
  return kimlikler;
}

/**
 * Diskteki bir içerik dosyasını denetim turundan geçirir.
 * `--temizle` verilirse dönen kayıtları dosyadan siler; silinenler bir
 * sonraki üretim koşusunda yeniden istenir.
 */
async function dosyaDenetle(ai: any, yol: string, temizle: boolean): Promise<void> {
  const tam = path.isAbsolute(yol) ? yol : path.join(ROOT, yol);
  const icerik: Record<string, Anlam> = JSON.parse(fs.readFileSync(tam, 'utf8'));
  const tanimlar: Record<string, string[]> = fs.existsSync(TANIM)
    ? JSON.parse(fs.readFileSync(TANIM, 'utf8'))
    : {};
  const kelimeler: Kelime[] = JSON.parse(fs.readFileSync(LISTE, 'utf8'));
  const turByWord = new Map(kelimeler.map(k => [k.word, k.pos]));
  const slugTur: Record<string, string> = Object.fromEntries(
    Object.entries(POS_SLUG).map(([tur, slug]) => [slug, tur])
  );

  const kayitlar = Object.entries(icerik).map(([id, a]) => {
    const parca = id.split('-');
    const slug = parca[parca.length - 1];
    const word = parca.slice(2, -1).join('-');
    const pos = (turByWord.get(word) || []).find(t => POS_SLUG[t] === slug) || slugTur[slug] || '';
    return { id, word, pos, tanim: (tanimlar[`${word}|${pos}`] || [])[0] || '', anlamlar: a.turkishMeanings };
  });

  console.log(`${path.relative(ROOT, tam)}: ${kayitlar.length} kayıt denetleniyor`);
  const red = await denetle(ai, kayitlar, { idx: 0 });
  console.log(`\nSorunlu: ${red.size}/${kayitlar.length}`);
  for (const [id, sebep] of red) console.log(`   ${id}: ${sebep}`);

  if (temizle && red.size) {
    for (const id of red.keys()) delete icerik[id];
    fs.writeFileSync(tam, JSON.stringify(icerik, null, 1));
    console.log(`\n${red.size} kayıt silindi; kalan ${Object.keys(icerik).length}.`);
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY tanımlı değil.');
    process.exit(1);
  }
  // Var olan bir içerik dosyasını denetle. Üretimi değiştirmeden önce denetim
  // turunun neyi yakaladığını ölçmek için; --temizle ile dönenleri siler.
  const denetlenecekDosya = arg('--denetle');
  if (denetlenecekDosya) {
    await dosyaDenetle(new GoogleGenAI({ apiKey }), denetlenecekDosya, process.argv.includes('--temizle'));
    return;
  }

  const bant = Number(arg('--bant') || 0);
  if (!bant) {
    console.error('--bant verilmedi.');
    process.exit(1);
  }
  const limit = Number(arg('--limit') || 0) || Infinity;

  const kelimeler: Kelime[] = JSON.parse(fs.readFileSync(LISTE, 'utf8'));
  const tanimlar: Record<string, string[]> = fs.existsSync(TANIM)
    ? JSON.parse(fs.readFileSync(TANIM, 'utf8'))
    : {};
  if (!Object.keys(tanimlar).length) {
    console.warn('UYARI: tanimlar.json yok. Model anlamı tahmin edecek;');
    console.warn('       önce `python3 scripts/extended/tanim_uret.py` koşulmalı.');
  }
  const hazir = mevcutIcerik();
  const defter = redDefteriOku(bant);

  const eksik: Is[] = [];
  let vazgecilen = 0;
  for (const k of kelimeler) {
    if (k.band !== bant) continue;
    for (const pos of k.pos) {
      if (!POS_SLUG[pos]) continue;
      const id = `gen-b${k.band}-${k.word}-${POS_SLUG[pos]}`;
      if (hazir.has(id)) continue;
      if ((defter[id]?.kez || 0) >= EN_COK_RED) { vazgecilen++; continue; }
      eksik.push({ id, word: k.word, pos, tanimlar: tanimlar[`${k.word}|${pos}`] || [] });
    }
  }
  const isler = eksik.slice(0, limit);
  const tanimli = isler.filter(i => i.tanimlar.length).length;
  console.log(`Bant ${bant}: eksik ${eksik.length} anlam · bu koşuda ${isler.length} · tanımı olan ${tanimli}`);
  if (vazgecilen) console.log(`${vazgecilen} anlam ${EN_COK_RED} kez denetimden döndü, artık istenmiyor.`);
  if (!isler.length) return;

  const ai = new GoogleGenAI({ apiKey });
  const uretilen: Record<string, Anlam> = {};
  const atilan: string[] = [];
  const durum = { idx: 0 };

  /** Çıktı dosyası; koşu ortasında kesilse de o ana kadarki iş diskte kalır. */
  const damga = new Date().toISOString().slice(0, 10);
  const cikti = path.join(ICERIK, `b${bant}-ai-${damga}.json`);

  for (let i = 0; i < isler.length; i += GRUP) {
    const grup = isler.slice(i, i + GRUP);
    const no = Math.floor(i / GRUP) + 1;
    const toplam = Math.ceil(isler.length / GRUP);

    const cevap = await modeleSor(ai, istem(grup), `grup ${no}`, durum);
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
      const s = sorunlar(is.word, anlam, is.pos);
      if (s.length) { atilan.push(`${is.word} (${s[0]})`); continue; }
      uretilen[is.id] = anlam;
      gecen++;
    }

    fs.writeFileSync(cikti, JSON.stringify(uretilen, null, 1));
    console.log(`  grup ${no}/${toplam}: ${gecen}/${grup.length} · toplam ${Object.keys(uretilen).length}`);
    if (i + GRUP < isler.length) await bekle(ARA_MS);
  }

  const uretilenSayi = Object.keys(uretilen).length;
  console.log(`\nÜretim bitti: ${uretilenSayi} · biçim denetiminden atılan: ${atilan.length}`);
  if (atilan.length) console.log('Atılanlardan: ' + atilan.slice(0, 20).join(', '));

  // İkinci tur: yazılan karşılıklar İngilizce tanıma uyuyor mu?
  if (uretilenSayi) {
    console.log(`\nDenetim turu: ${uretilenSayi} kayıt`);
    const isIndeks = new Map(isler.map(i => [i.id, i]));
    const denetlenecek = Object.entries(uretilen).map(([id, a]) => {
      const i = isIndeks.get(id)!;
      return { id, word: i.word, pos: i.pos, tanim: i.tanimlar[0] || '', anlamlar: a.turkishMeanings };
    });
    const red = await denetle(ai, denetlenecek, durum);
    for (const [id, sebep] of red) {
      delete uretilen[id];
      const onceki = defter[id]?.kez || 0;
      defter[id] = { kez: onceki + 1, sebep };
    }
    if (red.size) redDefteriYaz(bant, defter);
    console.log(`Denetimden dönen: ${red.size} · yazılan: ${Object.keys(uretilen).length}`);
    for (const [id, sebep] of [...red].slice(0, 15)) console.log(`   ${id}: ${sebep}`);
    fs.writeFileSync(cikti, JSON.stringify(uretilen, null, 1));
  }

  console.log(`Çıktı: ${path.relative(ROOT, cikti)}`);
  if (!Object.keys(uretilen).length) {
    console.error('Hiçbir anlam yazılamadı.');
    process.exit(1);
  }
}

main();
