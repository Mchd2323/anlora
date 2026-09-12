/**
 * Anlora – Üretilen ortaç kartlarını Genel Dağarcık'a katar.
 *
 * NEREYE. Oxford çekirdek verisi SALT OKUNURDUR; bu kayıtlar oraya giremez.
 * Genel Dağarcık (`src/data/extended/`) harf harf dosyalanmış ve `index.json`
 * ile dizinlenmiş; yeni kayıtlar aynı şemayla oraya yazılıyor.
 *
 * GERİ ALINABİLİR. Her kaydın kimliği `ort-` ile başlıyor ve `sourceEntry`
 * alanında kökü yazıyor. Yarın bu toplu ekleme geri alınmak istenirse tek
 * ölçütle ayıklanabilir; karışıp kaybolmuyor.
 *
 * VAR OLANIN ÜZERİNE YAZILMAZ. Sözlükte aynı başsözcük zaten varsa kayıt
 * ATLANIR. Bu, adayların üretilme biçimi gereği olmaması gereken bir durum
 * ama bir kez daha denetlenmesi ucuz; üzerine yazmak insan emeğiyle
 * doğrulanmış bir kaydı sessizce silmek olurdu.
 *
 * KULLANIM
 *     npx tsx scripts/ortac/birlestir.ts          (deneme, yazmaz)
 *     npx tsx scripts/ortac/birlestir.ts --yaz
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const KART = path.join(ROOT, 'scripts/ortac/icerik.json');
const EXT = path.join(ROOT, 'src/data/extended');

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

const yaz = process.argv.includes('--yaz');

/*
 * ELLE YAZILAN KAYITLAR AYRI DOSYADA.
 *
 * İkinci tur isabeti artırırken kapsamı düşürdü ve gerçek maddeleri de
 * eledi: `trapped` (kullanıcının kendi örneği), `trying`, `gifted`.
 * Bunlar makine çıktısına karıştırılmıyor -- karışsalardı hangi kaydın
 * nereden geldiği bir daha ayırt edilemezdi. Kimlikleri de `ort-el-` ile
 * başlıyor.
 */
const ELLE = path.join(ROOT, 'scripts/ortac/elle.json');
const elleKartlar: Kart[] = fs.existsSync(ELLE)
  ? JSON.parse(fs.readFileSync(ELLE, 'utf8'))
  : [];
const elleAdlar = new Set(elleKartlar.map(k => k.bicim.toLowerCase()));

const kartlar: Kart[] = [...JSON.parse(fs.readFileSync(KART, 'utf8')), ...elleKartlar];

const index = JSON.parse(fs.readFileSync(path.join(EXT, 'index.json'), 'utf8'));
const mevcut = new Set<string>((index.words || []).map((w: string) => String(w).toLowerCase()));

// Oxford'da da olmamalı; aday üretimi bunu zaten eliyor, denetim ucuz.
const oxford = new Set<string>(
  [
    ...JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/oxford3000.json'), 'utf8')),
    ...JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/oxford5000extra.json'), 'utf8'))
  ].map((k: any) => String(k.headword || k.word).toLowerCase())
);

const harfDosyalari = new Map<string, any[]>();
function harfiOku(harf: string): any[] {
  if (!harfDosyalari.has(harf)) {
    const p = path.join(EXT, `w-${harf}.json`);
    harfDosyalari.set(harf, fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
  }
  return harfDosyalari.get(harf)!;
}

let eklenen = 0;
const atlanan: string[] = [];
/** Sıra numarası mevcut en büyüğün üstünden devam ediyor. */
let sira = 900000;

for (const k of kartlar) {
  const ad = k.bicim.toLowerCase();
  if (mevcut.has(ad) || oxford.has(ad)) {
    atlanan.push(`${k.bicim} (zaten var)`);
    continue;
  }
  const harf = ad[0];
  if (!/^[a-z]$/.test(harf)) {
    atlanan.push(`${k.bicim} (harf dışı)`);
    continue;
  }

  const elleMi = elleAdlar.has(ad);
  const kayit = {
    id: `${elleMi ? 'ort-el-' : 'ort-'}${ad}`,
    headword: k.bicim,
    cefr: k.cefr,
    sourceCollection: 'extended',
    sourceOrder: sira++,
    sourceEntry: `${k.bicim} ${k.partOfSpeech} (< ${k.kok})`,
    senses: [
      {
        id: `${elleMi ? 'ort-el-' : 'ort-'}${ad}-1`,
        partOfSpeech: k.partOfSpeech,
        turkishMeanings: k.turkishMeanings,
        examples: k.examples
      }
    ],
    variants: [],
    phonetic: k.phonetic,
    band: 3
  };

  harfiOku(harf).push(kayit);
  mevcut.add(ad);
  eklenen++;
}

// Harf dosyaları başsözcüğe göre sıralı duruyor; yeni kayıtlar da yerine.
for (const [harf, kayitlar] of harfDosyalari) {
  kayitlar.sort((a: any, b: any) =>
    String(a.headword).toLowerCase().localeCompare(String(b.headword).toLowerCase(), 'en')
  );
  if (yaz) {
    fs.writeFileSync(path.join(EXT, `w-${harf}.json`), JSON.stringify(kayitlar, null, 1));
  }
}

const yeniKelimeler = [...mevcut].sort((a, b) => a.localeCompare(b, 'en'));
if (yaz) {
  index.words = yeniKelimeler;
  index.wordCount = yeniKelimeler.length;
  index.senseCount = (index.senseCount || 0) + eklenen;
  fs.writeFileSync(path.join(EXT, 'index.json'), JSON.stringify(index, null, 1));
}

console.log(`${yaz ? 'YAZILDI' : 'DENEME (yazılmadı)'}`);
console.log(`  eklenen : ${eklenen} (elle: ${elleKartlar.length})`);
console.log(`  atlanan : ${atlanan.length}${atlanan.length ? ' — ' + atlanan.slice(0, 10).join(', ') : ''}`);
console.log(`  Genel Dağarcık: ${index.wordCount} -> ${yeniKelimeler.length}`);
