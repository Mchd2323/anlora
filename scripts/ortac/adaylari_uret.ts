/**
 * Anlora – "-ed / -ing biçimi ayrı anlam taşıyor mu?" ADAY LİSTESİ.
 *
 * NEDEN VAR. Kullanıcının notu: trap = tuzak, trapped = kapana kısılmış,
 * trapping = tuzak kurma; deposit = mevduat, deposited = yatırıldı.
 * Uygulama bu biçimleri sözlükte bulamıyor ve "kök formunu kartlaştır"
 * diyerek kullanıcıyı aradığı anlamdan uzaklaştırıyordu.
 *
 * Bu betik KARAR VERMEZ, yalnızca hangi biçimlerin sorulacağını listeler.
 * "Ayrı anlamı var mı?" sorusunun cevabı sözlük bilgisidir ve uydurulamaz
 * (talimat 59); o soru `ayikla.ts` içinde yapay zekâya sorulup denetimden
 * geçiriliyor.
 *
 * ÇALIŞMA ZAMANI BAĞIMLILIĞI YOKTUR: yalnızca geliştirme aşamasında koşar.
 *
 * KULLANIM
 *     npx tsx scripts/ortac/adaylari_uret.ts
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const oku = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const dizi = (v: unknown): any[] => (Array.isArray(v) ? v : Object.values(v as object));

const o3 = dizi(oku('src/data/oxford3000.json'));
const o5 = dizi(oku('src/data/oxford5000extra.json'));
const idx = oku('src/data/extended/index.json');
const duzensiz = oku('src/data/irregularInflections.json');

const ad = (k: any) => String(k.headword || k.word || '').toLowerCase();
const turler = (k: any) =>
  (k.senses || []).map((s: any) => String(s.partOfSpeech || s.pos || '').trim().toLowerCase());

/**
 * TAM eşleşme aranıyor. `/v\./` kalıbı "adv." ile de eşleşiyor ve listeye
 * "alsoed", "abouting" gibi olmayan kelimeler sokuyordu.
 */
const fiilMi = (k: any) => turler(k).some((t: string) => t === 'v.' || t === 'verb');

/**
 * Düzensiz fiiller kural üretimine SOKULMAZ: "breaked", "buyed", "borned"
 * gibi olmayan kelimeler üretiliyordu. Dosya çekimli biçimle anahtarlı
 * ("went" -> base "go"), bu yüzden kökler DEĞERLERDEN toplanıyor.
 */
const duzensizKok = new Set<string>(
  Object.values(duzensiz as Record<string, { base: string }>).map(v => String(v.base).toLowerCase())
);

function ingBicimi(v: string): string {
  if (/[^aeiou]e$/.test(v)) return v.slice(0, -1) + 'ing';
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(v)) return v + v.slice(-1) + 'ing';
  return v + 'ing';
}

function edBicimi(v: string): string {
  if (/e$/.test(v)) return v + 'd';
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ied';
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(v)) return v + v.slice(-1) + 'ed';
  return v + 'ed';
}

const oxford = [...o3, ...o5];
const mevcut = new Set<string>([
  ...oxford.map(ad),
  ...((idx.words || []) as string[]).map(w => String(w).toLowerCase())
]);

const adaylar: { kok: string; bicim: string; ek: 'ing' | 'ed' }[] = [];
for (const kok of new Set(oxford.filter(fiilMi).map(ad))) {
  if (duzensizKok.has(kok) || kok.length < 3) continue;
  for (const [ek, bicim] of [
    ['ing', ingBicimi(kok)],
    ['ed', edBicimi(kok)]
  ] as const) {
    if (!mevcut.has(bicim)) adaylar.push({ kok, bicim, ek });
  }
}

const cikti = path.join(ROOT, 'scripts/ortac/adaylar.json');
fs.writeFileSync(cikti, JSON.stringify(adaylar, null, 1));
console.log(`Fiil: ${new Set(oxford.filter(fiilMi).map(ad)).size}`);
console.log(`Sözlükte olmayan -ing/-ed biçimi: ${adaylar.length}`);
console.log(`Yazıldı: ${path.relative(ROOT, cikti)}`);
