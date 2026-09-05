/**
 * Sekiz Realms tema ailesinin belirteçlerini üretir ve ölçer.
 *
 * NEDEN BİR BETİK. Sekiz ailenin her biri iki temada beş ila on belirteç
 * taşıyor; bunları elle yazmak hem hataya açık hem de doğrulanamaz. Betik
 * kullanıcının verdiği vurgu tablosunu alır, yardımcı belirteçleri mekanik
 * olarak türetir ve HER DEĞERİ tarayıcıda gerçek renk çözümüyle ölçer:
 *
 *   - Açık ve koyu vurgu renkleri kullanıcının verdiği tablodan birebir gelir.
 *   - Yardımcı belirteçler (hover, derin, yumuşak zemin, kenar, ton) o
 *     vurgudan mekanik olarak türer: OKLCH'te açıklık kaydırma ve bugünkü
 *     onaylı temanın kendi karışım oranlarıyla (ölçülerek kalibre edildi)
 *     aynı sRGB karışımları. Hiçbiri ekrandan seçilmedi.
 *   - Betik her değeri ölçer ve eşiğin altına düşen olursa haber verir.
 *
 * VARSAYILAN AİLE HİÇ DOKUNULMAZ. "Taçlı Parşömen" bugünkü onaylı temanın
 * kendisidir; bu yüzden onun için tek bir kural üretilmez, temel :root ve
 * koyu blok olduğu gibi geçerli kalır.
 *
 * Çalıştırma:  node scripts/make-theme-families.mjs
 */
import pw from '../node_modules/playwright-core/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = pw;
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Sabit yüzeyler — fix paketi bunların değişmesini yasaklıyor. */
const ACIK_ZEMIN = ['#F8F1E4', '#F2E8D8', '#EFE5D3', '#F3EAD9'];
const KOYU_ZEMIN = ['#142433', '#0D1925', '#0F1D29'];
/** Vurgu rengi için hedeflenen en düşük kontrast. */
const ESIK = 5.0;

/**
 * Aileler ve renkleri — DEĞERLER KULLANICIDAN GELDİ.
 *
 * Sekiz ailenin açık ve koyu vurgu renklerini kullanıcı tablo hâlinde verdi;
 * burada birebir yazılıdır ve türetilmez. Betiğin işi bu değerleri ölçmek ve
 * onlara bağlı yardımcı belirteçleri (hover, derin, yumuşak zemin, kenar,
 * ton) mekanik olarak üretmek.
 *
 * FİLDİŞİLER AÇIK TEMADA VURGU DEĞİL. #F2EBDD ve #FBF7EF açık yüzey/fildişi
 * değerleridir; Demir Gece ve Fildişi Altın'ın açık vurguları bu yüzden
 * tablodaki ayrı değerlerdir. Koyu temada fildişi vurgu olarak kullanılabilir.
 *
 * VARSAYILAN AİLE KUZGUN HARİTASI. Sebep tek: onun açık vurgusu (#15283D)
 * bugün onaylanmış temanın vurgusunun kendisi. Varsayılan bu olunca hiç
 * kimsenin ekranı tema sistemi geldi diye değişmiyor.
 */
const AILELER = [
  { id: 'tacli-parsomen',  ad: 'Taçlı Parşömen', kaynak: '#B79552', acik: '#765A26', koyu: '#D4B56D' },
  { id: 'buz-kalesi',      ad: 'Buz Kalesi',      kaynak: '#7FAAC2', acik: '#2F6078', koyu: '#9FC9DE' },
  { id: 'kuzgun-haritasi', ad: 'Kuzgun Haritası', kaynak: '#15283D', acik: '#15283D', koyu: '#A8BED1', varsayilan: true },
  { id: 'ejderha-koz',     ad: 'Ejderha Köz',     kaynak: '#B66038', acik: '#8B3E20', koyu: '#E28F61' },
  { id: 'kizil-kale',      ad: 'Kızıl Kale',      kaynak: '#9E3F38', acik: '#7E2C2A', koyu: '#D9786D' },
  { id: 'orman-nobeti',    ad: 'Orman Nöbeti',    kaynak: '#355B4A', acik: '#355B4A', koyu: '#8BC6A1' },
  { id: 'demir-gece',      ad: 'Demir Gece',      kaynak: '#F2EBDD', acik: '#3F4E5A', koyu: '#C1CDD4' },
  { id: 'fildisi-altin',   ad: 'Fildişi Altın',   kaynak: '#FBF7EF', acik: '#6D5428', koyu: '#FBF7EF' }
];
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.setContent('<body></body>');

const veri = await p.evaluate(({ AILELER, ACIK_ZEMIN, KOYU_ZEMIN, ESIK }) => {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d', { willReadFrequently: true });
  const rgb = s => { x.clearRect(0,0,1,1); x.fillStyle='#fff'; x.fillRect(0,0,1,1); x.fillStyle=s; x.fillRect(0,0,1,1);
    const d = x.getImageData(0,0,1,1).data; return [d[0], d[1], d[2]]; };
  const hex = s => '#' + rgb(s).map(v => v.toString(16).padStart(2,'0').toUpperCase()).join('');
  const lin = v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  const L = ([r,g,bb]) => 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(bb);
  const cr = (a,bb) => { const [m,n] = [L(rgb(a)), L(rgb(bb))].sort((u,v)=>v-u); return (m+0.05)/(n+0.05); };
  const enAz = (renk, z) => Math.min(...z.map(zz => cr(renk, zz)));
  const karis = (a, bb, yuzde) => hex(`color-mix(in srgb, ${a} ${yuzde}%, ${bb})`);

  return AILELER.map(a => {
    const acik = a.acik;
    const koyu = a.koyu;

    const murekkep = dolgu => {
      const a1 = cr(dolgu, '#FBF7EF'), a2 = cr(dolgu, '#142433');
      return a1 >= a2 ? { renk: '#FBF7EF', oran: +a1.toFixed(2) } : { renk: '#142433', oran: +a2.toFixed(2) };
    };

    return {
      id: a.id, ad: a.ad, kaynak: a.kaynak, varsayilan: !!a.varsayilan,
      acik: {
        vurgu: acik,
        hover: hex(`oklch(from ${acik} calc(l - 0.04) c h)`),
        derin: hex(`oklch(from ${acik} calc(l - 0.07) c h)`),
        kenarGuclu: karis(acik, '#FBF7EF', 30),
        uzeri: murekkep(acik),
        olcum: ACIK_ZEMIN.map(z => +cr(acik, z).toFixed(2))
      },
      koyu: {
        vurgu: koyu,
        hover: hex(`oklch(from ${koyu} calc(l + 0.05) c h)`),
        derin: hex(`oklch(from ${koyu} calc(l + 0.10) c h)`),
        yumusak: karis(koyu, '#0D1925', 12),
        yumusakUstu: karis(koyu, '#0D1925', 18),
        yumusakGuclu: karis(koyu, '#0D1925', 22),
        kenar: karis(koyu, '#0D1925', 29),
        kenarGuclu: karis(koyu, '#0D1925', 38),
        ton: karis(koyu, '#0D1925', 9),
        uzeri: murekkep(koyu),
        olcum: KOYU_ZEMIN.map(z => +cr(koyu, z).toFixed(2))
      }
    };
  });
}, { AILELER, ACIK_ZEMIN, KOYU_ZEMIN, ESIK });

await b.close();

/* KAPI: eşiğin altına düşen bir değer varsa dosya yazılmaz. */
const dusuk = [];
for (const a of veri) {
  const acikEnAz = Math.min(...a.acik.olcum), koyuEnAz = Math.min(...a.koyu.olcum);
  if (acikEnAz < ESIK) dusuk.push(`${a.ad} açık ${a.acik.vurgu} = ${acikEnAz.toFixed(2)}`);
  if (koyuEnAz < ESIK) dusuk.push(`${a.ad} koyu ${a.koyu.vurgu} = ${koyuEnAz.toFixed(2)}`);
  if (a.acik.uzeri.oran < 4.5) dusuk.push(`${a.ad} açık dolgu üstü yazı = ${a.acik.uzeri.oran}`);
  if (a.koyu.uzeri.oran < 4.5) dusuk.push(`${a.ad} koyu dolgu üstü yazı = ${a.koyu.uzeri.oran}`);
}
if (dusuk.length) {
  console.error(`Eşik (${ESIK}:1) altında kalan değerler var, dosya yazılmadı:`);
  dusuk.forEach(d => console.error('  ' + d));
  process.exit(1);
}

/* ---------- CSS ---------- */
const acikGovde = a => `  --primary: ${a.acik.vurgu};
  --primary-hover: ${a.acik.hover};
  --primary-deep: ${a.acik.derin};
  --primary-border-strong: ${a.acik.kenarGuclu};
  --on-primary: ${a.acik.uzeri.renk};`;

const koyuGovde = a => `  --primary: ${a.koyu.vurgu};
  --primary-hover: ${a.koyu.hover};
  --primary-deep: ${a.koyu.derin};
  --primary-soft: ${a.koyu.yumusak};
  --primary-soft-hover: ${a.koyu.yumusakUstu};
  --primary-soft-strong: ${a.koyu.yumusakGuclu};
  --primary-border: ${a.koyu.kenar};
  --primary-border-strong: ${a.koyu.kenarGuclu};
  --primary-tint: ${a.koyu.ton};
  --on-primary: ${a.koyu.uzeri.renk};`;

let css = `/* ÜRETİLMİŞ DOSYA — elle düzenleme.
   Kaynak: scripts/make-theme-families.mjs
   Yeniden üretmek için: node scripts/make-theme-families.mjs

   Sekiz Realms tema ailesinin vurgu renkleri. Sayfa, panel, iç kart ve metin
   renkleri BURADA YOK: onlar fix paketinin sabitlediği yüzey değerleri ve her
   ailede aynı kalıyor. Aile yalnızca vurguyu değiştiriyor.

   Her değer tarayıcıda ölçüldü; vurgu renginin sabit yüzeylerin üstündeki en
   düşük kontrastı ${ESIK.toFixed(1)}:1 eşiğinin altına düşmüyor.

   Varsayılan aile "${veri.find(a => a.varsayilan).ad}": açık vurgusu bugünkü
   onaylı temanın vurgusunun kendisi olduğu için temel :root ve koyu blok
   olduğu gibi geçerli kalıyor, onun için kural üretilmiyor.
*/

`;

const olcumSatiri = a =>
  `/* ${a.ad} — kaynak renk ${a.kaynak}
   açık ${a.acik.vurgu}  kontrast ${a.acik.olcum.join(' / ')}  üzeri ${a.acik.uzeri.renk} (${a.acik.uzeri.oran})
   koyu ${a.koyu.vurgu}  kontrast ${a.koyu.olcum.join(' / ')}  üzeri ${a.koyu.uzeri.renk} (${a.koyu.uzeri.oran}) */`;

for (const a of veri) {
  if (a.varsayilan) {
    css += `${olcumSatiri(a)}\n/* Varsayılan aile: temel :root ve koyu blok olduğu gibi geçerli. */\n\n`;
    continue;
  }
  css += `${olcumSatiri(a)}
:root[data-theme='light'][data-family='${a.id}'] {
${acikGovde(a)}
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme])[data-family='${a.id}'] {
${acikGovde(a).split('\n').map(s => '  ' + s).join('\n')}
  }
}
:root[data-theme='dark'][data-family='${a.id}'] {
${koyuGovde(a)}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme])[data-family='${a.id}'] {
${koyuGovde(a).split('\n').map(s => '  ' + s).join('\n')}
  }
}

`;
}

fs.writeFileSync(path.join(KOK, 'src/styles/realms-families.css'), css, 'utf8');

/* ---------- TypeScript ---------- */
const ts = `/* ÜRETİLMİŞ DOSYA — elle düzenleme.
   Kaynak: scripts/make-theme-families.mjs */

/** Profildeki tema aileleri ve önizleme renkleri. */
export interface RealmsAilesi {
  id: RealmsAileId;
  ad: string;
  /** İmza renginin nereden geldiği — profilde ipucu olarak gösterilmiyor, kayıt için. */
  kaynak: string;
  /** Açık tema önizlemesi: zemin sabit, vurgu aileye ait. */
  acik: { zemin: string; vurgu: string };
  /** Koyu tema önizlemesi. */
  koyu: { zemin: string; vurgu: string };
}

export type RealmsAileId =
${veri.map(a => `  | '${a.id}'`).join('\n')};

export const VARSAYILAN_AILE: RealmsAileId = '${veri.find(a => a.varsayilan).id}';

export const REALMS_AILELERI: RealmsAilesi[] = [
${veri.map(a => `  {
    id: '${a.id}',
    ad: '${a.ad}',
    kaynak: '${a.kaynak}',
    acik: { zemin: '#F2E8D8', vurgu: '${a.acik.vurgu}' },
    koyu: { zemin: '#0D1925', vurgu: '${a.koyu.vurgu}' }
  }`).join(',\n')}
];

export const AILE_KIMLIKLERI: readonly RealmsAileId[] = REALMS_AILELERI.map(a => a.id);
`;
fs.mkdirSync(path.join(KOK, 'src/theme'), { recursive: true });
fs.writeFileSync(path.join(KOK, 'src/theme/realmsFamilies.ts'), ts, 'utf8');

console.log('src/styles/realms-families.css ve src/theme/realmsFamilies.ts üretildi');
for (const a of veri) {
  console.log(`  ${a.ad.padEnd(16)} açık ${a.acik.vurgu} (${Math.min(...a.acik.olcum).toFixed(2)})  koyu ${a.koyu.vurgu} (${Math.min(...a.koyu.olcum).toFixed(2)})`);
}
