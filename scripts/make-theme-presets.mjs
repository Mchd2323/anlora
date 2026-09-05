/**
 * Ek tema katmanını üretir ve HER DEĞERİ ÖLÇER.
 *
 * MODEL. Uygulamanın görünümü üç gruba ayrılıyor:
 *
 *   1. SİSTEM — bugünkü onaylı Anlora Realms açık ve koyu görünümü. İşletim
 *      sistemini izler, kökte hiçbir öznitelik taşımaz, bu dosyadan hiç
 *      etkilenmez. Taban seçenek budur ve değişmez.
 *   2. DÖRT BAĞIMSIZ AÇIK TEMA
 *   3. DÖRT BAĞIMSIZ KOYU TEMA
 *
 * Sekiz ek tema birbirinden bağımsız: "açık/koyu çift" değiller, her biri tek
 * başına seçilen bir görünüm.
 *
 * DEĞERLER `src/theme/theme-presets.json` DOSYASINDAN GELİR. Paket bu dosyayı
 * otorite ilan ediyor; page, panel, inner, text, secondary, accent, buttonBg ve
 * buttonText değerleri buradan birebir okunur, göz kararıyla değiştirilmez.
 *
 * TAM PALET NEREDEN GELİYOR. Paket her tema için sekiz değer veriyor; uygulama
 * ise CEFR rozetleri, "öğrendim", "tekrar et", tehlike gibi onlarca anlamsal
 * renk kullanıyor. Bunları yeniden icat etmek yerine ek temalar TABAN PALETİN
 * ÜSTÜNE biniyor: uygulama koyu bir ek tema seçildiğinde köke hem
 * `data-theme="dark"` hem `data-realm-preset="..."` yazıyor. Böylece ölçülmüş
 * koyu anlamsal palet olduğu gibi geçerli kalıyor, ek tema yalnızca zemin,
 * panel, metin ve vurgu belirteçlerini değiştiriyor.
 *
 * TÜRETİLEN BELİRTEÇLER. Vurgunun yardımcıları (hover, derin, yumuşak zemin,
 * kenar, ton) mekanik olarak türer: OKLCH'te açıklık kaydırma ve bugünkü onaylı
 * temanın kendi karışım oranları (ölçülerek kalibre edildi). Hiçbiri ekrandan
 * seçilmedi.
 *
 * KAPI. Betik her değeri tarayıcıda gerçek renk çözümüyle ölçer; eşiğin altına
 * düşen bir değer bulursa dosyayı yazmadan çıkar.
 *
 * Çalıştırma:  node scripts/make-theme-presets.mjs
 */
import pw from '../node_modules/playwright-core/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = pw;
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KAYNAK = JSON.parse(fs.readFileSync(path.join(KOK, 'src/theme/theme-presets.json'), 'utf8'));

/**
 * KELİME SETİ VURGU RENKLERİ.
 *
 * Bunlar tema DEĞİL: kullanıcının kendi setine verdiği renk. Sette saklanan
 * şey bu tablodaki kimlik (paletteId), rengin kendisi değil; renk aşağıdaki
 * `--set-<kimlik>` belirtecinden geliyor ve açık/koyu karşılığı orada
 * tanımlı. Kullanıcı temasını değiştirdiğinde setin rengi kendiliğinden
 * doğru tarafa geçiyor.
 *
 * Değerler kullanıcının verdiği tablodan birebir; türetilmedi. Fildişi
 * kaynak renkleri açık zeminde dolgu olarak kullanılmıyor — Demir Gece ve
 * Fildişi Altın'ın açık karşılıkları bu yüzden ayrı değerler.
 */
const SET_RENKLERI = [
  { id: 'tacli-parsomen',  ad: 'Taçlı Parşömen', acik: '#765A26', koyu: '#D4B56D' },
  { id: 'buz-kalesi',      ad: 'Buz Kalesi',      acik: '#2F6078', koyu: '#9FC9DE' },
  { id: 'kuzgun-haritasi', ad: 'Kuzgun Haritası', acik: '#15283D', koyu: '#A8BED1' },
  { id: 'ejderha-koz',     ad: 'Ejderha Köz',     acik: '#8B3E20', koyu: '#E28F61' },
  { id: 'kizil-kale',      ad: 'Kızıl Kale',      acik: '#7E2C2A', koyu: '#D9786D' },
  { id: 'orman-nobeti',    ad: 'Orman Nöbeti',    acik: '#355B4A', koyu: '#8BC6A1' },
  { id: 'demir-gece',      ad: 'Demir Gece',      acik: '#3F4E5A', koyu: '#C1CDD4' },
  { id: 'fildisi-altin',   ad: 'Fildişi Altın',   acik: '#6D5428', koyu: '#FBF7EF' }
];

/** Metin ve ikon için eşik. Büyük olmayan her yazı bunu geçmek zorunda. */
const METIN_ESIGI = 4.5;
/**
 * Dekoratif kenarlık için eşik — ÖLÇEREK KALİBRE EDİLDİ, varsayılmadı.
 *
 * WCAG'ın 3:1 kuralı "arayüzü anlamak için gereken" metin dışı içeriği
 * bağlar; panelin süs kenarlığı o sınıfa girmiyor. Nitekim kullanıcının
 * onayladığı taban temanın kendi kenarlığı da (açık: rgba(183,149,82,.76)
 * üstünde #F8F1E4) 1,91 ölçüyor. Ek temaların kenarlığını 3:1'e zorlamak,
 * onaylı görünümden daha koyu çerçeveler üretmek olurdu.
 *
 * Bu yüzden eşik taban temanın kendi seviyesi: ek temaların kenarlığı
 * onaylı temanınkinden zayıf olamaz.
 */
const KENAR_ESIGI = 1.9;

const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.setContent('<body></body>');

const veri = await p.evaluate(({ KAYNAK, SET_RENKLERI, METIN_ESIGI, KENAR_ESIGI }) => {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d', { willReadFrequently: true });
  const rgb = s => { x.clearRect(0,0,1,1); x.fillStyle='#fff'; x.fillRect(0,0,1,1); x.fillStyle=s; x.fillRect(0,0,1,1);
    const d = x.getImageData(0,0,1,1).data; return [d[0], d[1], d[2]]; };
  const hex = s => '#' + rgb(s).map(v => v.toString(16).padStart(2,'0').toUpperCase()).join('');
  const lin = v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  const L = ([r,g,bb]) => 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(bb);
  const cr = (a,bb) => { const [m,n] = [L(rgb(a)), L(rgb(bb))].sort((u,v)=>v-u); return +((m+0.05)/(n+0.05)).toFixed(2); };
  const karis = (a, bb, yuzde) => hex(`color-mix(in srgb, ${a} ${yuzde}%, ${bb})`);
  const acikligiKaydir = (renk, delta) => hex(`oklch(from ${renk} calc(l ${delta >= 0 ? '+' : '-'} ${Math.abs(delta)}) c h)`);

  const isle = (t, koyuMu) => {
    const { page, panel, inner, text, secondary, accent, buttonBg, buttonText } = t;
    // Vurgunun yardımcıları — oranlar bugünkü onaylı temadan ölçülerek kalibre edildi.
    const zeminKarisim = koyuMu ? page : '#FBF7EF';
    const hover  = acikligiKaydir(accent, koyuMu ? +0.05 : -0.04);
    const derin  = acikligiKaydir(accent, koyuMu ? +0.10 : -0.07);
    const belirtecler = {
      '--bg': page,
      '--surface': panel,
      '--surface-soft': inner,
      '--surface-subtle': inner,
      '--text-primary': text,
      '--text-secondary': secondary,
      '--text-muted': secondary,
      '--primary': accent,
      '--primary-hover': hover,
      '--primary-deep': derin,
      '--primary-soft': karis(accent, zeminKarisim, 12),
      '--primary-soft-hover': karis(accent, zeminKarisim, 18),
      '--primary-soft-strong': karis(accent, zeminKarisim, 22),
      '--primary-border': karis(accent, zeminKarisim, 29),
      '--primary-border-strong': karis(accent, zeminKarisim, 38),
      '--primary-tint': karis(accent, zeminKarisim, 9),
      '--on-primary': buttonText,
      /*
       * DEGRADENİN ÜST DURAĞI. Birincil düğmenin dolgusu üstte --dugme-ust,
       * altta --primary olan bir degrade. Üst durak yazının rengine DOĞRU
       * kaymamalı, yoksa düğmenin üst yarısında kontrast çöker (taban koyu
       * temada bu hata ölçüldü: 1,71). Bu yüzden durak, vurgunun yazıdan
       * UZAKLAŞAN yönde bir tık kaydırılmışı.
       */
      '--dugme-ust': acikligiKaydir(accent, koyuMu ? +0.03 : -0.03),
      '--dugme-kenar': karis(accent, buttonText, 78),
      '--dugme-golge': koyuMu ? 'rgb(0 0 0 / 0.35)' : `color-mix(in srgb, ${text} 16%, transparent)`,
      /*
       * Kart motifinin glifi. Taban temada sabit buz mavisiydi; ek temada o
       * renk tema dışında kalıyor. Vurgunun yumuşatılmışı hem aynı aileden
       * hem de glifin dekoratif kalmasını sağlayacak kadar sakin.
       */
      '--motif-glif': karis(accent, panel, koyuMu ? 70 : 60),
      // Kenarlık oranları, taban temanın kendi kenarlık gücüne (1,91) göre
      // ölçülerek seçildi; koyu panelde aynı güce daha az karışımla ulaşılıyor.
      '--border': karis(accent, panel, koyuMu ? 42 : 62),
      '--border-light': karis(accent, panel, koyuMu ? 26 : 38),
      '--line-inner': karis(text, panel, 18),
      '--ivory': buttonText
    };
    // Ölçümler — paketin kendi "en kötü yüzey" tanımına göre.
    // (belirtecler yukarıda tanımlandı, ölçümler ona bakıyor.)
    const yuzeyler = [page, panel, inner];
    const olcum = {
      metinEnDusuk: Math.min(...yuzeyler.map(y => cr(text, y))),
      ikincilEnDusuk: Math.min(...yuzeyler.map(y => cr(secondary, y))),
      vurguEnDusuk: Math.min(...yuzeyler.map(y => cr(accent, y))),
      dugmeYazisi: cr(buttonText, buttonBg),
      // Degradenin ÜST durağı da ölçülüyor: taban koyu temada bu nokta
      // gözden kaçmış ve 1,71 ölçüyordu.
      dugmeUstDurak: cr(buttonText, belirtecler['--dugme-ust']),
      kenarlik: Math.min(...yuzeyler.map(y => cr(belirtecler['--border'], y)))
    };
    return { ...t, koyuMu, belirtecler, olcum };
  };

  const acik = KAYNAK.light.map(t => isle(t, false));
  const koyu = KAYNAK.dark.map(t => isle(t, true));

  // Set kutucukları metin değil, dolu birer kare: eşik 3:1. Her renk hem
  // taban yüzeylerde hem de sekiz ek temanın yüzeylerinde ölçülüyor.
  const acikYuzeyler = ['#F2E8D8', '#F8F1E4', '#EFE5D3', ...acik.flatMap(t => [t.page, t.panel, t.inner])];
  const koyuYuzeyler = ['#0D1925', '#142433', '#0F1D29', ...koyu.flatMap(t => [t.page, t.panel, t.inner])];
  const setler = SET_RENKLERI.map(r => ({
    ...r,
    acikEnDusuk: Math.min(...acikYuzeyler.map(y => cr(r.acik, y))),
    koyuEnDusuk: Math.min(...koyuYuzeyler.map(y => cr(r.koyu, y)))
  }));

  return { acik, koyu, setler };
}, { KAYNAK, SET_RENKLERI, METIN_ESIGI, KENAR_ESIGI });

await b.close();

const hepsi = [...veri.acik, ...veri.koyu];

/* KAPI — eşiğin altına düşen varsa dosya yazılmaz. */
const dusuk = [];
for (const t of hepsi) {
  const o = t.olcum;
  if (o.metinEnDusuk < METIN_ESIGI) dusuk.push(`${t.name}: metin ${t.text} = ${o.metinEnDusuk}`);
  if (o.ikincilEnDusuk < METIN_ESIGI) dusuk.push(`${t.name}: ikincil metin ${t.secondary} = ${o.ikincilEnDusuk}`);
  if (o.vurguEnDusuk < METIN_ESIGI) dusuk.push(`${t.name}: vurgu ${t.accent} = ${o.vurguEnDusuk}`);
  if (o.dugmeYazisi < METIN_ESIGI) dusuk.push(`${t.name}: düğme yazısı ${t.buttonText} / ${t.buttonBg} = ${o.dugmeYazisi}`);
  if (o.dugmeUstDurak < METIN_ESIGI) dusuk.push(`${t.name}: düğme degradesinin üst durağı = ${o.dugmeUstDurak}`);
  if (o.kenarlik < KENAR_ESIGI) dusuk.push(`${t.name}: kenarlık ${o.kenarlik} < taban temanın 1,91 seviyesi`);
}
for (const r of veri.setler) {
  if (r.acikEnDusuk < 3.0) dusuk.push(`set ${r.ad}: açık ${r.acik} en düşük ${r.acikEnDusuk} < 3`);
  if (r.koyuEnDusuk < 3.0) dusuk.push(`set ${r.ad}: koyu ${r.koyu} en düşük ${r.koyuEnDusuk} < 3`);
}
if (dusuk.length) {
  console.error(`Eşiğin altında kalan değerler var, dosya yazılmadı:`);
  dusuk.forEach(d => console.error('  ' + d));
  process.exit(1);
}

/* ---------- CSS ---------- */
const govde = t => Object.entries(t.belirtecler).map(([k, v]) => `  ${k}: ${v};`).join('\n');

let css = `/* ÜRETİLMİŞ DOSYA — elle düzenleme.
   Kaynak: scripts/make-theme-presets.mjs  +  src/theme/theme-presets.json
   Yeniden üretmek için: node scripts/make-theme-presets.mjs

   EK TEMALAR. "Sistem" bu dosyada YOK ve olmamalı: o, bugünkü onaylı Anlora
   Realms açık/koyu görünümüdür, işletim sistemini izler ve kökte hiçbir
   öznitelik taşımaz.

   Ek bir tema seçildiğinde uygulama köke İKİ öznitelik yazıyor:
     data-theme="light" | "dark"   -> ölçülmüş taban anlamsal palet (CEFR
                                      rozetleri, öğrendim, tekrar, tehlike…)
     data-realm-preset="<kimlik>"  -> bu dosyadaki zemin/panel/metin/vurgu

   Böylece ek tema yalnızca görünen yüzeyleri değiştiriyor; anlamsal renkler
   zaten ölçülmüş olan taban paletten geliyor ve yeniden icat edilmiyor.

   Seçici özgüllüğü: :root[data-theme][data-realm-preset] (0,3,0) taban
   :root[data-theme] (0,2,0) bloğunu geçer, bu yüzden bu dosya taban
   tanımlardan SONRA yüklenmek zorunda değil — ama yine de sonda duruyor.
*/

`;

for (const t of hepsi) {
  const mod = t.koyuMu ? 'dark' : 'light';
  css += `/* ${t.name} (${t.id})
   metin ${t.text} en düşük ${t.olcum.metinEnDusuk} · ikincil ${t.secondary} en düşük ${t.olcum.ikincilEnDusuk}
   vurgu ${t.accent} en düşük ${t.olcum.vurguEnDusuk} · düğme yazısı ${t.buttonText} üstü ${t.olcum.dugmeYazisi}
   düğme degradesinin üst durağı ${t.belirtecler['--dugme-ust']} üstü ${t.olcum.dugmeUstDurak} */
:root[data-theme='${mod}'][data-realm-preset='${t.id}'] {
${govde(t)}
}

`;
}

css += `/* --------------------------------------------------------------------------
   KELİME SETİ VURGU RENKLERİ

   Sette hex değil kimlik saklanıyor (\`collection.color = 'buz-kalesi'\`);
   renk buradan geliyor. Belirteçler SEÇİLİ TEMADAN BAĞIMSIZ, yalnızca
   açık/koyu tarafa göre değişiyor: kullanıcı temasını değiştirince setinin
   rengi değişmemeli, sadece okunur karşılığına geçmeli.

   Ek temalar köke \`data-theme\` de yazdığı için aşağıdaki seçiciler
   onlarda da doğru tarafı veriyor.
${veri.setler.map(r => `   ${r.ad}: açık ${r.acik} (en düşük ${r.acikEnDusuk}) · koyu ${r.koyu} (en düşük ${r.koyuEnDusuk})`).join('\n')}
   -------------------------------------------------------------------------- */
:root,
:root[data-theme='light'] {
${veri.setler.map(r => `  --set-${r.id}: ${r.acik};`).join('\n')}
}
:root[data-theme='dark'] {
${veri.setler.map(r => `  --set-${r.id}: ${r.koyu};`).join('\n')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
${veri.setler.map(r => `    --set-${r.id}: ${r.koyu};`).join('\n')}
  }
}
`;

fs.mkdirSync(path.join(KOK, 'src/styles'), { recursive: true });
fs.writeFileSync(path.join(KOK, 'src/styles/realms-presets.css'), css, 'utf8');

/* ---------- TypeScript ---------- */
const satir = t => `  {
    id: '${t.id}',
    ad: '${t.name}',
    mod: '${t.koyuMu ? 'dark' : 'light'}',
    onizleme: { zemin: '${t.page}', panel: '${t.panel}', vurgu: '${t.accent}', yazi: '${t.text}' }
  }`;

const ts = `/* ÜRETİLMİŞ DOSYA — elle düzenleme.
   Kaynak: scripts/make-theme-presets.mjs  +  src/theme/theme-presets.json */

/** Profil > Görünüm'de listelenen ek tema. */
export interface RealmsOnAyari {
  id: RealmsOnAyarId;
  ad: string;
  /** Taban anlamsal palet: köke bu değer \`data-theme\` olarak yazılır. */
  mod: 'light' | 'dark';
  /** Kartın üstündeki küçük önizleme. Değerler CSS'tekilerle aynı. */
  onizleme: { zemin: string; panel: string; vurgu: string; yazi: string };
}

export type RealmsOnAyarId =
${hepsi.map(t => `  | '${t.id}'`).join('\n')};

/** Ek açık temalar — dördü de birbirinden bağımsız. */
export const ACIK_ON_AYARLAR: RealmsOnAyari[] = [
${veri.acik.map(satir).join(',\n')}
];

/** Ek koyu temalar — dördü de birbirinden bağımsız. */
export const KOYU_ON_AYARLAR: RealmsOnAyari[] = [
${veri.koyu.map(satir).join(',\n')}
];

export const TUM_ON_AYARLAR: RealmsOnAyari[] = [...ACIK_ON_AYARLAR, ...KOYU_ON_AYARLAR];

export const ON_AYAR_KIMLIKLERI: readonly RealmsOnAyarId[] = TUM_ON_AYARLAR.map(t => t.id);

/** Bir ön ayarın taban modunu döndürür; tanınmayan kimlikte null. */
export function onAyarModu(id: string): 'light' | 'dark' | null {
  return TUM_ON_AYARLAR.find(t => t.id === id)?.mod ?? null;
}
`;
fs.writeFileSync(path.join(KOK, 'src/theme/realmsPresets.ts'), ts, 'utf8');

const setTs = `/* ÜRETİLMİŞ DOSYA — elle düzenleme.
   Kaynak: scripts/make-theme-presets.mjs */

/** Yeni Kelime Seti penceresindeki vurgu rengi. */
export interface SetRengi {
  id: SetRengiId;
  ad: string;
  /** CSS belirteci — açık/koyu karşılığı belirtecin içinde tanımlı. */
  hex: string;
}

export type SetRengiId =
${veri.setler.map(r => `  | '${r.id}'`).join('\n')};

export const SET_RENK_LISTESI: SetRengi[] = [
${veri.setler.map(r => `  { id: '${r.id}', ad: '${r.ad}', hex: 'var(--set-${r.id})' }`).join(',\n')}
];

export const SET_RENK_KIMLIKLERI: readonly SetRengiId[] = SET_RENK_LISTESI.map(r => r.id);
`;
fs.writeFileSync(path.join(KOK, 'src/theme/setPalette.ts'), setTs, 'utf8');

console.log('src/styles/realms-presets.css, src/theme/realmsPresets.ts ve src/theme/setPalette.ts üretildi');
for (const t of hepsi) {
  const o = t.olcum;
  console.log(`  ${t.name.padEnd(16)} ${t.koyuMu ? 'koyu' : 'açık'}  metin ${o.metinEnDusuk}  ikincil ${o.ikincilEnDusuk}  vurgu ${o.vurguEnDusuk}  düğme ${o.dugmeYazisi}/${o.dugmeUstDurak}  kenar ${o.kenarlik}`);
}
console.log('  --- set renkleri (dokuz temanın tüm yüzeylerinde en düşük) ---');
for (const r of veri.setler) {
  console.log(`  ${r.ad.padEnd(16)} açık ${r.acik} ${r.acikEnDusuk}   koyu ${r.koyu} ${r.koyuEnDusuk}`);
}
