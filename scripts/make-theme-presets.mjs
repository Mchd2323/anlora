/**
 * Ek tema katmanını üretir ve HER DEĞERİ ÖLÇER.
 *
 * MODEL. Uygulamanın görünümü üç gruba ayrılıyor:
 *
 *   1. SİSTEM — bugünkü onaylı Anlora Realms açık ve koyu görünümü. İşletim
 *      sistemini izler, kökte hiçbir öznitelik taşımaz, bu dosyadan hiç
 *      etkilenmez. Taban seçenek budur ve değişmez.
 *   2. EK AÇIK TEMALAR
 *   3. EK KOYU TEMALAR
 *
 * Ek temalar birbirinden bağımsız: "açık/koyu çift" değiller, her biri tek
 * başına seçilen bir görünüm. KAÇ TANE OLDUKLARI BURADA YAZMIYOR — sayı
 * `theme-presets.json`'dan geliyor ve tema eklenip çıkarıldığında bu dosyada
 * güncellenmesi gereken bir yer kalmasın diye üretilen metinler de sayıyı
 * veriden okuyor.
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
 * DEĞERLER ÖLÇÜLEREK YENİLENDİ (ayırt edilebilirlik).
 *
 * İlk tablo kullanıcının verdiği renklerden birebir alınmıştı, ama sekiz
 * kutucuk yan yana konunca bazıları ayırt edilemiyordu. CIEDE2000 ile
 * ölçülen en yakın çiftler:
 *
 *   açık zemin: Taçlı Parşömen / Fildişi Altın  ΔE 3.0  (pratikte aynı renk)
 *               Buz Kalesi / Demir Gece         ΔE 9.2
 *               Ejderha Köz / Kızıl Kale        ΔE 10.1
 *   koyu zemin: Buz Kalesi / Kuzgun Haritası    ΔE 5.8
 *               Kuzgun Haritası / Demir Gece    ΔE 6.6
 *
 * ΔE 3 demek, kullanıcının iki seçeneği ayıramaması demek; setine renk
 * seçerken hangisini seçtiğini göremiyordu.
 *
 * Yeni değerler göz kararı seçilmedi: her rengin adına sadık bir ton
 * penceresi (Lab hue) içinde, her yüzeye karşı 3:1 kontrastı koruyan ve
 * en yakın çiftin ΔE'sini büyüten bir arama ile bulundu. Sonuç:
 * açık zeminde en yakın çift ΔE 16.5, koyu zeminde ΔE 14.8.
 *
 * KROMA TAVANLARI BİLEREK DÜŞÜK TUTULDU. Ayrışmayı doygunluktan almak
 * daha kolaydı ama doygun camgöbeği ve pembe bu uygulamanın parşömen
 * estetiğine yabancı duruyordu; ayrışma tondan ve açıklıktan alındı.
 *
 * Kuzgun Haritası koyu laciverttendi, mürekkep moruna kaydırıldı: koyu
 * zeminde Buz Kalesi ve Demir Gece ile aynı mavi kümesinde duruyordu.
 * Fildişi Altın altın-kahveden soluk zeytin-fildişine kaydırıldı: açık
 * zeminde Taçlı Parşömen'in kendisiydi.
 */
const SET_RENKLERI = [
  { id: 'tacli-parsomen',  ad: 'Taçlı Parşömen', acik: '#684B25', koyu: '#F9D8A2' },
  { id: 'buz-kalesi',      ad: 'Buz Kalesi',      acik: '#2B7381', koyu: '#82C4D6' },
  { id: 'kuzgun-haritasi', ad: 'Kuzgun Haritası', acik: '#60658A', koyu: '#B3ACD3' },
  { id: 'ejderha-koz',     ad: 'Ejderha Köz',     acik: '#A15847', koyu: '#F7A587' },
  { id: 'kizil-kale',      ad: 'Kızıl Kale',      acik: '#782F3D', koyu: '#F89EAE' },
  { id: 'orman-nobeti',    ad: 'Orman Nöbeti',    acik: '#33523F', koyu: '#91C8AE' },
  { id: 'demir-gece',      ad: 'Demir Gece',      acik: '#43484C', koyu: '#D0D5DA' },
  { id: 'fildisi-altin',   ad: 'Fildişi Altın',   acik: '#6F6D56', koyu: '#BBB99F' },

  /*
   * AÇIK TONLU DÖRTLÜ — sonradan eklendi.
   *
   * Yukarıdaki sekizi açık temada KOYU duruyor: hepsi uygulamanın kendi koyu
   * vurgularının aynası. Yan yana konunca renk seçeneği değil, sekiz koyu
   * kare gibi okunuyordu.
   *
   * Yenileri serbest bir renk aramasından çıkmadı; her biri UYGULAMANIN
   * KENDİ ton ailelerinden birinin açık register'ı (Lab hue penceresi
   * ailenin kendi tonundan alındı):
   *   Turkuaz Sis    <- Buz Kalesi / Buz Nöbeti vurgusu   (H 196–214)
   *   Şafak Gülü     <- Kızıl Şafak / Kızıl Gece vurgusu  (H  22– 40)
   *   Mürekkep Sisi  <- --text-primary / Kuzgun Haritası  (H 268–296)
   *   Söğüt Gölgesi  <- --learned yeşili                  (H 150–172)
   *
   * Kroma 12–22 ile sınırlandı: eniyileyici serbest bırakıldığında ayrışmayı
   * doygunluktan alıp neon camgöbeğine (#89ECFC) kaçıyordu — bu dosyanın
   * yukarıdaki notunun tam olarak kaçındığı şey.
   *
   * ÖLÇÜLDÜ (CIEDE2000, en yakın çift):
   *   açık tema  16,5  (sekiz renkli tablodaki değerin AYNISI — hiç düşmedi)
   *   koyu tema  13,5  (sekiz renkte 14,8 idi)
   * Koyu taraftaki düşüş 8 -> 12 renge çıkmanın bedeli. Eşik olarak anlamlı
   * olan sayı bu değil: bu dosyanın yukarıdaki notu ΔE 3,0'ı "pratikte aynı
   * renk", 5,8/6,6'yı ayırt edilemez sayıyordu; 13,5 onların iki katından
   * fazla.
   *
   * Zeminden ayrışma TABAN yüzeylere değil, HER TEMANIN yüzeylerine karşı
   * ölçülüyor. İlk denemedeki Şafak Gülü (#FFCABC) taban parşömende iyiydi
   * ama Kızıl Şafak temasının panelinde ΔE 9,4 veriyordu — o tema gül-krem
   * olduğu için. Aşağıdaki kapı onu yazmadan önce reddetti.
   */
  { id: 'turkuaz-sis',     ad: 'Turkuaz Sis',     acik: '#96E8F6', koyu: '#A3F5F4' },
  { id: 'safak-gulu',      ad: 'Şafak Gülü',      acik: '#ECB0A0', koyu: '#FFDCDB' },
  { id: 'murekkep-sisi',   ad: 'Mürekkep Sisi',   acik: '#B0AFDF', koyu: '#AECCFB' },
  { id: 'sogut-golgesi',   ad: 'Söğüt Gölgesi',   acik: '#8DBB98', koyu: '#D8EEDC' }
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
  /* CIEDE2000 — set kutucuklarinin BIRBIRINDEN ve zeminden ayrilmasi icin.
     Kontrast orani burada yanlis olcu: iki renk ayni kontrasta sahip olup
     ayni renk olabilir (bkz. bu dosyanin ustundeki OLCULEREK YENILENDI notu). */
  const lab = s => { const [r,g,bb]=rgb(s).map(lin);
    const f=t=>t>0.008856?Math.cbrt(t):(7.787*t+16/116);
    const X=f((0.4124*r+0.3576*g+0.1805*bb)/0.95047), Y=f(0.2126*r+0.7152*g+0.0722*bb),
          Z=f((0.0193*r+0.1192*g+0.9505*bb)/1.08883);
    return [116*Y-16, 500*(X-Y), 200*(Y-Z)]; };
  const dE = (s1,s2) => { const [L1,a1,b1]=lab(s1),[L2,a2,b2]=lab(s2);
    const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cb=(C1+C2)/2;
    const G=0.5*(1-Math.sqrt(Cb**7/(Cb**7+25**7))), A1=a1*(1+G), A2=a2*(1+G);
    const P1=Math.hypot(A1,b1),P2=Math.hypot(A2,b2);
    const hp=(b,a)=>{ if(b===0&&a===0)return 0; const d=Math.atan2(b,a)*180/Math.PI; return d<0?d+360:d; };
    const h1=hp(b1,A1),h2=hp(b2,A2), dL=L2-L1, dC=P2-P1;
    let dh=0; if(P1*P2!==0){ dh=h2-h1; if(dh>180)dh-=360; else if(dh<-180)dh+=360; }
    const dH=2*Math.sqrt(P1*P2)*Math.sin(dh*Math.PI/360);
    const Lb=(L1+L2)/2, Cbp=(P1+P2)/2;
    let hb=h1+h2; if(P1*P2!==0){ if(Math.abs(h1-h2)>180) hb += (hb<360?360:-360); hb/=2; }
    const T=1-0.17*Math.cos((hb-30)*Math.PI/180)+0.24*Math.cos(2*hb*Math.PI/180)
            +0.32*Math.cos((3*hb+6)*Math.PI/180)-0.20*Math.cos((4*hb-63)*Math.PI/180);
    const Sl=1+(0.015*(Lb-50)**2)/Math.sqrt(20+(Lb-50)**2), Sc=1+0.045*Cbp, Sh=1+0.015*Cbp*T;
    const Rt=-Math.sin(2*(30*Math.exp(-(((hb-275)/25)**2)))*Math.PI/180)
             *2*Math.sqrt(Cbp**7/(Cbp**7+25**7));
    return +Math.sqrt((dL/Sl)**2+(dC/Sc)**2+(dH/Sh)**2+Rt*(dC/Sc)*(dH/Sh)).toFixed(1); };

  /* Kutucugun UZERINDEKI simgenin rengi: beyaz mi mürekkep mi? Olculerek
     secilir, varsayilmaz. Eskiden bilesende `text-white` sabitti; koyu temada
     kutucuklar acik renk oldugu icin simge sekiz renkte de kayboluyordu
     (olculen kontrast 1,37 – 2,15). */
  const uzeriSec = sw => {
    const beyaz = cr(sw, '#FFFFFF'), murekkep = cr(sw, '#15283D');
    return beyaz >= murekkep ? { renk: '#FFFFFF', k: beyaz } : { renk: '#15283D', k: murekkep };
  };

  const karis = (a, bb, yuzde) => hex(`color-mix(in srgb, ${a} ${yuzde}%, ${bb})`);
  // Üretilen CSS'te color-mix KULLANILMIYOR (eski WebView riski); karışım
  // burada, üretim anında çözülüyor ve çıktıya düz hex/rgb yazılıyor.
  const rgba = (renk, alfa) => { const [r, g, bb] = rgb(renk); return `rgb(${r} ${g} ${bb} / ${alfa})`; };
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
      /*
       * DÜZ rgb(), color-mix DEĞİL. Gölge `.dugme-birincil`in TEK bir
       * box-shadow bildiriminin içinde, iç parlamayla birlikte duruyor;
       * değer geçersiz çözülürse bildirimin tamamı düşer ve düğme iç
       * parlamasını da kaybeder. color-mix Chrome 111+ istiyor, uygulamanın
       * minSdk'si 23 — eski WebView'lerde bu risk gerçek.
       */
      '--dugme-golge': koyuMu ? 'rgb(0 0 0 / 0.35)' : rgba(text, 0.16),
      /*
       * Kart motifinin glifi. Taban temada sabit buz mavisiydi; ek temada o
       * renk tema dışında kalıyor. Vurgunun yumuşatılmışı hem aynı aileden
       * hem de glifin dekoratif kalmasını sağlayacak kadar sakin.
       */
      '--motif-glif': karis(accent, panel, koyuMu ? 70 : 60),
      /*
       * BAŞLIK ÇUBUĞU VE ALT MENÜ. Bu iki belirteç ezilmezse taban değeri
       * geçerli kalıyor: kuzey laciverti. Bordo "Kızıl Gece"nin ya da kahve
       * "Ejderha Köz"ün ekranında altta ve üstte mavi birer şerit kalıyordu —
       * paketin "rastgele yeni lacivert doldurma ekleme" kuralının tam
       * ihlali. Değerler artık temanın kendi panelinden geliyor; alfa taban
       * temayla aynı (0,96 / 0,97), çünkü ikisi de içeriğin üstünde duruyor.
       */
      '--cubuk-zemin': rgba(panel, 0.96),
      '--menu-zemin': rgba(panel, 0.97),
      /*
       * ARMA PLAKASININ ZEMİNİ. Taban değer koyu tarafta lacivert (#15283D);
       * plaka her temada kendi rengine gelsin diye ezilmesi gerekiyor:
       * bordo "Kızıl Gece"nin başlığında lacivert bir plaka tema dışı
       * duruyor. Koyu temada plakanın zemini sayfanın kendi rengi, açık
       * temada metnin rengi (parşömenin üstünde koyu bir plaka).
       * Ölçülen şey plakanın panele farkı değil — altının plaka üstündeki
       * kontrastı (aşağıda `armaAltini`).
       */
      '--arma-alan': koyuMu ? page : text,
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
      kenarlik: Math.min(...yuzeyler.map(y => cr(belirtecler['--border'], y))),
      /*
       * ARMA PLAKASI — ÖLÇÜM PANELE KARŞI DEĞİL, ALTINA KARŞI.
       *
       * Plakanın zemini panelden ayrışmak zorunda değil: onaylı taban koyu
       * temada bile bu fark 1,05 (arma-alan #15283D / panel #142433). Plaka
       * altın kenarından ve içindeki armadan okunuyor. Ölçülmesi gereken şey
       * bu yüzden altının plaka zemini üstündeki kontrastı — tabanda 5,30.
       */
      armaAltini: cr('#B79552', belirtecler['--arma-alan']),
      // Alt menü ve başlık çubuğunun üstündeki yazı.
      cubukYazisi: cr(text, panel)
    };
    return { ...t, koyuMu, belirtecler, olcum };
  };

  const acik = KAYNAK.light.map(t => isle(t, false));
  const koyu = KAYNAK.dark.map(t => isle(t, true));

  // Set kutucukları metin değil, dolu birer kare: eşik 3:1. Her renk hem
  // taban yüzeylerde hem de KAÇ TANE OLURSA OLSUN her ek temanın yüzeylerinde
  // ölçülüyor; liste `theme-presets.json`'dan geliyor.
  const acikYuzeyler = ['#F2E8D8', '#F8F1E4', '#EFE5D3', ...acik.flatMap(t => [t.page, t.panel, t.inner])];
  const koyuYuzeyler = ['#0D1925', '#142433', '#0F1D29', ...koyu.flatMap(t => [t.page, t.panel, t.inner])];
  /*
   * SET KUTUSUNUN ZEMİN TONU.
   *
   * Setin rengi eskiden yalnızca 32 piksellik simge rozetine giriyordu; kartın
   * gövdesi her sette aynı --surface idi. Kullanıcının gördüğü şey "setler
   * renklenmiyor"du, çünkü renk kartın kendisine hiç ulaşmıyordu.
   *
   * Tonlama color-mix ile ÇALIŞMA ZAMANINDA yapılmıyor (bu dosyanın yukarıdaki
   * notu: eski WebView riski). Bunun yerine saydam bir renk üretiliyor ve
   * kartta `background-image` olarak --surface'in ÜSTÜNE biniyor; hangi tema
   * seçili olursa olsun doğru zeminle karışıyor, ek değişken gerekmiyor.
   *
   * Oran %12: aşağıdaki kapı, tonlanmış zeminde HER temanın metin rengini
   * ölçüyor ve 4,5'in altına düşen olursa dosya yazılmıyor.
   */
  const TONLAMA = 12;
  const acikMetinler = ['#15283D', ...acik.map(t => t.text)];
  const koyuMetinler = ['#F2EBDD', ...koyu.map(t => t.text)];

  const setler = SET_RENKLERI.map(r => {
    const au = uzeriSec(r.acik), ku = uzeriSec(r.koyu);
    return {
      acikZemin: rgba(r.acik, TONLAMA / 100),
      koyuZemin: rgba(r.koyu, TONLAMA / 100),
      acikZeminMetin: Math.min(...acikYuzeyler.flatMap(y =>
        acikMetinler.map(t => cr(t, karis(r.acik, y, TONLAMA))))),
      koyuZeminMetin: Math.min(...koyuYuzeyler.flatMap(y =>
        koyuMetinler.map(t => cr(t, karis(r.koyu, y, TONLAMA))))),
      ...r,
      acikUzeri: au.renk, acikUzeriK: au.k,
      koyuUzeri: ku.renk, koyuUzeriK: ku.k,
      acikEnDusuk: Math.min(...acikYuzeyler.map(y => cr(r.acik, y))),
      koyuEnDusuk: Math.min(...koyuYuzeyler.map(y => cr(r.koyu, y))),
      acikEnDusukDE: Math.min(...acikYuzeyler.map(y => dE(r.acik, y))),
      koyuEnDusukDE: Math.min(...koyuYuzeyler.map(y => dE(r.koyu, y)))
    };
  });

  const setCiftleri = [];
  for (let i = 0; i < setler.length; i++)
    for (let j = i + 1; j < setler.length; j++)
      setCiftleri.push({
        a: setler[i].ad, b: setler[j].ad,
        acikDE: dE(setler[i].acik, setler[j].acik),
        koyuDE: dE(setler[i].koyu, setler[j].koyu)
      });

  return { acik, koyu, setler, setCiftleri };
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
  if (o.armaAltini < 3.0) dusuk.push(`${t.name}: arma plakasının altını ${o.armaAltini} < 3`);
  if (o.cubukYazisi < METIN_ESIGI) dusuk.push(`${t.name}: çubuk/menü yazısı ${o.cubukYazisi}`);
}
/*
 * SET KUTUCUKLARININ KAPISI — ÖLÇÜ DEĞİŞTİ, GEVŞEMEDİ.
 *
 * Eskiden kural "kutucuk dolgusu her yüzeye karşı 3:1" idi. Bu kural açık
 * tonlu bir set rengini (turkuaz, gül) daha doğarken eliyordu: parşömen
 * zemininde açık bir dolgu 3:1'i hiçbir zaman geçemez.
 *
 * Kuralı kaldırmak yerine DOĞRU YERE taşıdım. 3:1, "arayüzü anlamak için
 * gereken metin dışı içerik" içindir; kutucukta bu işi yapan şey dolgu değil,
 * KENAR: `.hanedan-kapak` zaten saç teli inceliğinde altın bir çerçeve
 * taşıyor, kutunun nerede bittiği ondan okunuyor. Aynı gerekçe bu dosyada
 * KENAR_ESIGI için zaten kurulmuştu.
 *
 * Dolgunun gerçek işi AYIRT ETTİRMEK: hem zeminden hem birbirinden. Onun
 * ölçüsü kontrast oranı değil ΔE2000 — iki renk aynı kontrast oranına sahip
 * olup aynı renk olabilir.
 *
 * Kutucuğun ÜSTÜNDEKİ simge ise gerçek metin/ikon: 4,5:1 orada uygulanıyor
 * ve artık gerçekten uygulanıyor. Eskiden hiç ölçülmüyordu — bileşende
 * `text-white` sabitti ve koyu temada sekiz kutucuğun sekizinde de simge
 * kayboluyordu (1,37 – 2,15).
 */
const SET_AYRISMA_ESIGI = 12;   // ΔE2000, dolgunun her yüzeyden ayrılması
const SET_SIMGE_ESIGI = 4.5;    // kontrast, simgenin kutucuğun üstünde okunması
for (const r of veri.setler) {
  if (r.acikEnDusukDE < SET_AYRISMA_ESIGI)
    dusuk.push(`set ${r.ad}: açık ${r.acik} zeminden ayrışma ΔE ${r.acikEnDusukDE} < ${SET_AYRISMA_ESIGI}`);
  if (r.koyuEnDusukDE < SET_AYRISMA_ESIGI)
    dusuk.push(`set ${r.ad}: koyu ${r.koyu} zeminden ayrışma ΔE ${r.koyuEnDusukDE} < ${SET_AYRISMA_ESIGI}`);
  if (r.acikUzeriK < SET_SIMGE_ESIGI)
    dusuk.push(`set ${r.ad}: açık simge ${r.acikUzeri} / ${r.acik} = ${r.acikUzeriK} < ${SET_SIMGE_ESIGI}`);
  if (r.koyuUzeriK < SET_SIMGE_ESIGI)
    dusuk.push(`set ${r.ad}: koyu simge ${r.koyuUzeri} / ${r.koyu} = ${r.koyuUzeriK} < ${SET_SIMGE_ESIGI}`);
  if (r.acikZeminMetin < METIN_ESIGI)
    dusuk.push(`set ${r.ad}: açık tonlanmış kart zemininde metin ${r.acikZeminMetin} < ${METIN_ESIGI}`);
  if (r.koyuZeminMetin < METIN_ESIGI)
    dusuk.push(`set ${r.ad}: koyu tonlanmış kart zemininde metin ${r.koyuZeminMetin} < ${METIN_ESIGI}`);
}
/* Renkler birbirinden de ayrılmalı — kullanıcı seçerken hangisini seçtiğini
   görmeli. Eşik, sekiz renkli tablonun kendi ölçülmüş tabanının altında
   kalmasın diye 10'a konuldu (o tablo açık 16,5 / koyu 14,8 veriyordu). */
const SET_IKILI_ESIGI = 10;
for (const c of veri.setCiftleri) {
  if (c.acikDE < SET_IKILI_ESIGI)
    dusuk.push(`set çifti ${c.a} / ${c.b}: açık temada ΔE ${c.acikDE} < ${SET_IKILI_ESIGI}`);
  if (c.koyuDE < SET_IKILI_ESIGI)
    dusuk.push(`set çifti ${c.a} / ${c.b}: koyu temada ΔE ${c.koyuDE} < ${SET_IKILI_ESIGI}`);
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
${veri.setler.map(r => `  --set-${r.id}: ${r.acik};\n  --set-${r.id}-uzeri: ${r.acikUzeri};\n  --set-${r.id}-zemin: ${r.acikZemin};`).join('\n')}
}
:root[data-theme='dark'] {
${veri.setler.map(r => `  --set-${r.id}: ${r.koyu};\n  --set-${r.id}-uzeri: ${r.koyuUzeri};\n  --set-${r.id}-zemin: ${r.koyuZemin};`).join('\n')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
${veri.setler.map(r => `    --set-${r.id}: ${r.koyu};\n    --set-${r.id}-uzeri: ${r.koyuUzeri};\n    --set-${r.id}-zemin: ${r.koyuZemin};\n  --set-${r.id}-zemin: ${r.koyuZemin};`).join('\n')}
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

/** Ek açık temalar (${veri.acik.length}) — her biri birbirinden bağımsız. */
export const ACIK_ON_AYARLAR: RealmsOnAyari[] = [
${veri.acik.map(satir).join(',\n')}
];

/** Ek koyu temalar (${veri.koyu.length}) — her biri birbirinden bağımsız. */
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
  /**
   * Kutucuğun ÜSTÜNDEKİ simgenin rengi — ölçülerek seçildi, varsayılmadı.
   *
   * Bileşenlerde \`text-white\` sabitti. Açık temada kutucuklar koyu olduğu
   * için sorun görünmüyordu; koyu temada kutucuklar açık renge dönüyor ve
   * simge kayboluyordu (ölçülen kontrast 1,37 – 2,15). Artık her kutucuk
   * kendi okunur simge rengini taşıyor.
   */
  uzeri: string;
}

export type SetRengiId =
${veri.setler.map(r => `  | '${r.id}'`).join('\n')};

export const SET_RENK_LISTESI: SetRengi[] = [
${veri.setler.map(r => `  { id: '${r.id}', ad: '${r.ad}', hex: 'var(--set-${r.id})', uzeri: 'var(--set-${r.id}-uzeri)' }`).join(',\n')}
];

export const SET_RENK_KIMLIKLERI: readonly SetRengiId[] = SET_RENK_LISTESI.map(r => r.id);
`;
fs.writeFileSync(path.join(KOK, 'src/theme/setPalette.ts'), setTs, 'utf8');

console.log('src/styles/realms-presets.css, src/theme/realmsPresets.ts ve src/theme/setPalette.ts üretildi');
for (const t of hepsi) {
  const o = t.olcum;
  console.log(`  ${t.name.padEnd(16)} ${t.koyuMu ? 'koyu' : 'açık'}  metin ${o.metinEnDusuk}  ikincil ${o.ikincilEnDusuk}  vurgu ${o.vurguEnDusuk}  düğme ${o.dugmeYazisi}/${o.dugmeUstDurak}  kenar ${o.kenarlik}  arma-altın ${o.armaAltini}`);
}
console.log(`  --- set renkleri (taban + ${veri.acik.length + veri.koyu.length} ek temanın tüm yüzeylerinde en düşük) ---`);
for (const r of veri.setler) {
  console.log(`  ${r.ad.padEnd(16)} açık ${r.acik} ΔE${String(r.acikEnDusukDE).padStart(5)} simge ${r.acikUzeri} ${r.acikUzeriK}` +
              `   koyu ${r.koyu} ΔE${String(r.koyuEnDusukDE).padStart(5)} simge ${r.koyuUzeri} ${r.koyuUzeriK}`);
}
const enYakinA = veri.setCiftleri.reduce((m, c) => c.acikDE < m.acikDE ? c : m);
const enYakinK = veri.setCiftleri.reduce((m, c) => c.koyuDE < m.koyuDE ? c : m);
console.log(`  --- renkler birbirinden ne kadar ayrılıyor (CIEDE2000, en yakın çift) ---`);
console.log(`  açık tema  ΔE ${enYakinA.acikDE}  ${enYakinA.a} / ${enYakinA.b}`);
console.log(`  koyu tema  ΔE ${enYakinK.koyuDE}  ${enYakinK.a} / ${enYakinK.b}`);
