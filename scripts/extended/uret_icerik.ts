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
 * DENETİM YAPILAMAZSA İÇERİK ATILMAZ. İlk sürüm, denetim turu yanıt
 * alamadığında o partinin hepsini reddediyordu. Bant 9'da tur kotaya takıldı
 * ve 1.185 SAĞLAM kayıt bu yüzden çöpe gitti: 2.170 anlamlık koşudan 91 anlam
 * kaldı. Denetim ikinci ağdır; birincil kapı `sorunlar()` ve
 * `build_bands.py --strict`. İkinci ağın kurulamaması, balığı geri atmak için
 * sebep değil. Artık kayıtlar yazılıyor, kimlikleri
 * `denetim/b<N>-denetlenmedi.json` içine not ediliyor.
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
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { sorunlar, type Anlam } from './denetim_kurallari';

const ROOT = process.cwd();
const LISTE = path.join(ROOT, 'scripts/extended/source/wordlist.json');
const TANIM = path.join(ROOT, 'scripts/extended/source/tanimlar.json');
const ELEME = path.join(ROOT, 'scripts/extended/source/skiplist.json');
const ICERIK = path.join(ROOT, 'scripts/extended/content');
const DENETIM = path.join(ROOT, 'scripts/extended/denetim');

const GRUP = 15;
/**
 * Denetim turunda istek başına kaç kayıt. Aynı 125 kayıt (16'sı elle
 * doğrulanmış hatalı) üzerinde ölçüldü:
 *     60 kayıt/istek -> 16 hatanın  5'i yakalandı (%31)
 *     20 kayıt/istek -> 16 hatanın 12'si yakalandı (%75)
 *     10 kayıt/istek -> aşağıdaki ölçüm
 * Grup küçüldükçe model her karşılığa tek tek bakıyor. Denetim turu örnek
 * cümle taşımadığı için küçük grup da ucuz: üretimin dörtte biri kadar istek.
 */
const DENETIM_GRUP = 10;
const ARA_MS = 3000;
/**
 * Aynı anda kaç istek. Darboğaz kota değil gecikme: bir istek 15 anlamı
 * üçer örnek cümleyle yazıyor ve ~24 saniye sürüyor. Sıradan koşuda bu
 * dakikada ~2,5 istek eder; ücretsiz katmanın dakika sınırı bunun çok
 * üstünde. Dörde çıkarınca dakikada ~10 istek: hâlâ sınırın altında,
 * ama toplam süre dörtte birine iniyor.
 */
const ESZAMANLI = 4;
/**
 * Tur arası bekleme. Model bütün modellerde başarısız olunca bir sonraki
 * tura kadar beklenir. Testlerde sıfıra çekiliyor: bekleme süresi sınanan
 * davranışın parçası değil ve test paketini doksan saniye uzatıyordu.
 */
const TUR_BEKLEME_MS = Number(process.env.ANLORA_TUR_BEKLEME_MS ?? 45_000);
/** Bir kimlik bu kadar kez denetimden dönerse artık istenmiyor. */
const EN_COK_RED = 3;
/**
 * Yedekleme sırası. `gemini-2.0-flash` LİSTEDEN ÇIKARILDI: artık
 * "no longer available" (404) dönüyor ve her turun üçte birini boşa
 * harcıyordu. Takma adlar (`-latest`) sürüm emekli olunca kendiliğinden
 * güncele kayıyor; sabit sürüm numarası yazmak aynı tuzağı kurar.
 */
const MODELLER = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const POS_SLUG: Record<string, string> = {
  'n.': 'n', 'v.': 'v', 'adj.': 'adj', 'adv.': 'adv', 'prep.': 'prep', 'conj.': 'conj'
};

interface Kelime {
  word: string;
  pos: string[];
  rank: number;
  band: number;
  ipa: string | null;
  /** 'küfür' | 'hakaret' — varsa karşılığa kullanım etiketi konuyor. */
  uyari?: string;
}
interface Is { id: string; word: string; pos: string; tanimlar: string[]; uyari?: string }

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

KULLANIM ETİKETİ. Bazı kelimelerin yanında [küfür] ya da [hakaret] yazıyor.
Bunlar sözlükte yer alıyor çünkü öğrenci dizide ve günlük konuşmada
karşılaşıyor; ama karşılığı yumuşatılırsa öğrenci ne kadar ağır olduğunu
bilemez. Bu kelimelerin BİRİNCİ karşılığının sonuna parantez içinde etiketi
yaz: "aptal (hakaret)", "kahretsin (küfür)". Örnek cümleler kelimenin gerçek
kullanımını göstersin, sansürlenmesin.
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
    const basli = `${g.id}\t${g.word} (${g.pos})${g.uyari ? ` [${g.uyari}]` : ''}`;
    return g.tanimlar.length
      ? `${basli}\n${g.tanimlar.map((t, i) => `   ${i + 1}. ${t}`).join('\n')}`
      : basli;
  }).join('\n')}`;
}

/**
 * Denetim istemi. Örnek cümle göndermiyor: yanlış anlam da yazım hatası da
 * karşılığın kendisinde görünüyor, cümleler istek boyutunu üçe katlardı.
 */
function denetimIstemi(grup: { id: string; word: string; pos: string; tanimlar: string[]; anlamlar: string[] }[]): string {
  return `Aşağıda İngilizce kelimeler, sözcük türleri, İngilizce tanımları ve
onlar için yazılmış Türkçe karşılıklar var.

Her kaydın HER BİR karşılığını tanımla tek tek karşılaştır:

1. Bu karşılık, VERİLEN TANIMLARDAN BİRİNİN Türkçesi mi? Bir kelimenin
   birden çok tanımı verilmiş olabilir; karşılık HERHANGİ birine uyuyorsa
   doğrudur, hepsine birden uyması gerekmez. Hiçbirine uymuyorsa sorunludur.
   Örnek: gild (n.) tanımı "a formal association" iken "altın yaldız"
   yazılmışsa yanlıştır; fiil anlamı yazılmıştır.

   TANIM 1 EN YAYGIN ANLAM DEĞİLDİR. Tanımlar WordNet sırasıyla geliyor ve
   bu sıra kelimenin günlük kullanımını yansıtmıyor: "wiener" için birinci
   tanım matematikçi Norbert Wiener'ı, "cod" için birinci tanım tohum
   kapsülünü anlatıyor -- oysa doğru karşılıklar "sosis" ve "morina".
   Karşılık alttaki tanımlardan birine uyuyorsa DOĞRUDUR; birinci tanıma
   uymadığı için sorunlu sayma. Tanım listesinde hiç geçmeyen ama kelimenin
   herkesçe bilinen anlamı olan karşılıkları da sorunlu sayma.
2. Türkçe yazımı doğru mu? Harf düşmesi, harf fazlalığı, eksik ek ara.
   Örnek: "sendteleyen" yanlış, "sendeleyen" doğru; "gülme kriz" eksik,
   "gülme krizi" doğru.
3. Karşılık gerçekten Türkçe bir söz mü, yoksa uydurma mı? Örnek: "kaletay"
   diye bir Türkçe kelime yoktur.
4. Türü uyuyor mu? Fiil karşılığı "-mak/-mek" ile biter, isim bitmez.

Her karşılık için şunu yap: karşılığı Türkçeden İngilizceye GERİ ÇEVİR ve
tanımla karşılaştır. Geri çeviri tanımdan uzaksa karşılık yanlıştır. Gerçek
bir Türkçe kelime olması doğru olduğu anlamına gelmez: "dalavere" gerçek bir
kelimedir ama "disorderly outburst" değil "dolandırıcılık" demektir.

Karşılıklardan BİRİ bile sorunluysa o kaydı bildir.

ŞÜPHELENDİĞİNİ BİLDİR. Bildirilen kayıt yazılmaz, yeniden üretilir; bu
ucuzdur. Bildirilmeyen yanlış kayıt ise sözlüğe girer ve öğrenciye yanlış
öğretir. Bu yüzden kararsız kaldığın kaydı bildir.

Sorun görmediğin kaydı yazma; hepsi düzgünse boş dizi döndür.

Yanıt yalnızca şu JSON dizisi:
[{"id":"...","sebep":"kısa sebep"}]

Kayıtlar:
${grup.map(g => {
    const tanim = g.tanimlar.length
      ? g.tanimlar.map((t, i) => `\n   tanım ${i + 1}. ${t}`).join('')
      : '';
    return `${g.id}\t${g.word} (${g.pos})${tanim}\n   yazılan: ${g.anlamlar.join(' / ')}`;
  }).join('\n')}`;
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
    if (tur < 2) await bekle(TUR_BEKLEME_MS);
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
export async function denetle(
  ai: any,
  kayitlar: { id: string; word: string; pos: string; tanimlar: string[]; anlamlar: string[] }[],
  durum: { idx: number }
): Promise<{ red: Map<string, string>; denetlenemeyen: Set<string> }> {
  const red = new Map<string, string>();
  const denetlenemeyen = new Set<string>();
  const gruplar: typeof kayitlar[] = [];
  for (let i = 0; i < kayitlar.length; i += DENETIM_GRUP) {
    gruplar.push(kayitlar.slice(i, i + DENETIM_GRUP));
  }
  const toplam = gruplar.length;

  for (let d = 0; d < gruplar.length; d += ESZAMANLI) {
    const dalga = gruplar.slice(d, d + ESZAMANLI);
    const cevaplar = await Promise.all(
      dalga.map((grup, j) => modeleSor(ai, denetimIstemi(grup), `denetim ${d + j + 1}`, durum))
    );

    for (let j = 0; j < dalga.length; j++) {
      const grup = dalga[j];
      const cevap = cevaplar[j];
      const no = d + j + 1;
      if (!cevap) {
        /*
         * DENETİM YAPILAMADIYSA İÇERİK ATILMAZ.
         *
         * İlk sürüm bu partinin hepsini reddediyordu. Bant 9'da denetim turu
         * kotaya takıldı ve 1.185 SAĞLAM kayıt bu yüzden çöpe gitti: 2.170
         * anlamlık koşudan 91 anlam kaldı. Denetim ikinci ağ; birincil kapı
         * `sorunlar()` ve `build_bands.py --strict`, ikisini de geçmişler.
         * İkinci ağın kurulamaması, balığı geri atmak için sebep değil.
         *
         * Kayıtlar yazılıyor, kimlikleri "denetlenmedi" listesine düşüyor;
         * sonraki koşu `--denetle <dosya>` ile onları ayrıca sınayabiliyor.
         */
        console.warn(`  denetim ${no}/${toplam} yapılamadı; kayıtlar yazılıyor, denetimi sonraya kalıyor.`);
        for (const g of grup) denetlenemeyen.add(g.id);
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
    }
    if (d + ESZAMANLI < gruplar.length) await bekle(ARA_MS);
  }
  return { red, denetlenemeyen };
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
    return { id, word, pos, tanimlar: tanimlar[`${word}|${pos}`] || [], anlamlar: a.turkishMeanings };
  });

  console.log(`${path.relative(ROOT, tam)}: ${kayitlar.length} kayıt denetleniyor`);
  const { red, denetlenemeyen } = await denetle(ai, kayitlar, { idx: 0 });
  console.log(`\nSorunlu: ${red.size}/${kayitlar.length}`);
  if (denetlenemeyen.size) console.log(`Denetlenemeyen: ${denetlenemeyen.size} (kayıt silinmiyor)`);
  for (const [id, sebep] of red) console.log(`   ${id}: ${sebep}`);

  // Bulgular diske yazılıyor ki `olcum.py` referans listeyle karşılaştırsın.
  fs.mkdirSync(DENETIM, { recursive: true });
  const bulguYolu = path.join(DENETIM, `${path.basename(tam, '.json')}-bulgu.json`);
  fs.writeFileSync(bulguYolu, JSON.stringify(Object.fromEntries(red), null, 1));
  console.log(`Bulgular: ${path.relative(ROOT, bulguYolu)}`);

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

  /*
   * ELENENLER ÜRETİLMEZ. `build_bands.py` skiplist.json'daki maddeleri
   * hedeften çıkarıyor; üretici bunu bilmiyordu ve elenmiş bir kelimeye
   * içerik yazınca paket derleyicisi "BİLİNMEYEN KİMLİK" deyip düşüyordu.
   * Bir kayıt yüzünden koşunun tamamı boşa gitti: 939 anlamlık üretim ve
   * o kadar kota. İki taraf aynı listeyi okumak zorunda.
   */
  const elenen = new Set(
    fs.existsSync(ELEME)
      ? Object.keys(JSON.parse(fs.readFileSync(ELEME, 'utf8'))).filter(k => !k.startsWith('_'))
      : []
  );
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
    if (elenen.has(k.word)) continue;
    for (const pos of k.pos) {
      if (!POS_SLUG[pos]) continue;
      const id = `gen-b${k.band}-${k.word}-${POS_SLUG[pos]}`;
      if (hazir.has(id)) continue;
      if ((defter[id]?.kez || 0) >= EN_COK_RED) { vazgecilen++; continue; }
      eksik.push({
        id,
        word: k.word,
        pos,
        tanimlar: tanimlar[`${k.word}|${pos}`] || [],
        uyari: k.uyari
      });
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

  const gruplar: Is[][] = [];
  for (let i = 0; i < isler.length; i += GRUP) gruplar.push(isler.slice(i, i + GRUP));
  const toplam = gruplar.length;

  for (let d = 0; d < gruplar.length; d += ESZAMANLI) {
    const dalga = gruplar.slice(d, d + ESZAMANLI);
    const cevaplar = await Promise.all(
      dalga.map((grup, j) => modeleSor(ai, istem(grup), `grup ${d + j + 1}`, durum))
    );

    for (let j = 0; j < dalga.length; j++) {
      const grup = dalga[j];
      const cevap = cevaplar[j];
      const no = d + j + 1;
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
      console.log(`  grup ${no}/${toplam}: ${gecen}/${grup.length}`);
    }

    // Dalga bitince yaz: koşu ortasında kesilse de iş diskte kalır.
    fs.writeFileSync(cikti, JSON.stringify(uretilen, null, 1));
    console.log(`  ...${Math.min(d + ESZAMANLI, toplam)}/${toplam} grup · toplam ${Object.keys(uretilen).length} anlam`);
    if (d + ESZAMANLI < gruplar.length) await bekle(ARA_MS);
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
      return { id, word: i.word, pos: i.pos, tanimlar: i.tanimlar, anlamlar: a.turkishMeanings };
    });
    const { red, denetlenemeyen } = await denetle(ai, denetlenecek, durum);
    for (const [id, sebep] of red) {
      delete uretilen[id];
      const onceki = defter[id]?.kez || 0;
      defter[id] = { kez: onceki + 1, sebep };
    }
    if (red.size) redDefteriYaz(bant, defter);
    console.log(`Denetimden dönen: ${red.size} · yazılan: ${Object.keys(uretilen).length}`);
    for (const [id, sebep] of [...red].slice(0, 15)) console.log(`   ${id}: ${sebep}`);

    /*
     * Denetimi yapılamayanlar YAZILIYOR, kimlikleri not ediliyor. Denetim
     * ikinci ağ; kurulamaması üretilmiş içeriği atmak için sebep değil.
     * Sonraki koşu `--denetle <dosya>` ile bunları ayrıca sınayabilir.
     */
    if (denetlenemeyen.size) {
      fs.mkdirSync(DENETIM, { recursive: true });
      const yol = path.join(DENETIM, `b${bant}-denetlenmedi.json`);
      const onceki: string[] = fs.existsSync(yol) ? JSON.parse(fs.readFileSync(yol, 'utf8')) : [];
      const hepsi = [...new Set([...onceki, ...denetlenemeyen])].sort();
      fs.writeFileSync(yol, JSON.stringify(hepsi, null, 1));
      console.log(`Denetimi yapılamayan ${denetlenemeyen.size} kayıt yazıldı; `
        + `kimlikleri ${path.relative(ROOT, yol)} içinde.`);
    }

    fs.writeFileSync(cikti, JSON.stringify(uretilen, null, 1));
  }

  console.log(`Çıktı: ${path.relative(ROOT, cikti)}`);
  if (!Object.keys(uretilen).length) {
    console.error('Hiçbir anlam yazılamadı.');
    process.exit(1);
  }
}

/*
 * Yalnızca doğrudan çalıştırıldığında koşar. Testler `denetle`'yi içe
 * aktarabilsin diye: modül yüklenince `main()` koşarsa test API anahtarı
 * arayıp çıkıyordu.
 */
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
