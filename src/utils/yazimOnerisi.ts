/**
 * Anlora – "Bunu mu demek istedin?" yazım önerisi.
 *
 * NEDEN VAR. Sözlükte bulunmayan bir kelime yazıldığında uygulamanın tek
 * çıkışı yapay zekâya kart ürettirmekti. Kullanıcı kelimeyi YANLIŞ yazdıysa
 * bu, sekiz saniye bekleyip uydurma bir kart almak demek: "recieve" diye bir
 * İngilizce kelime yok, ama bir dil modeline sorulursa çoğu zaman yine de bir
 * şeyler yazar. Yanlış yazılmış kelime sete girerse kullanıcı onu öyle
 * öğrenir; hata, düzeltilmesi en zor yerde birikir.
 *
 * NEDEN YEREL. Öneri, cihazdaki iki listeden çıkarılıyor (Oxford madde
 * başları + Genel Dağarcık dizini, ~19 bin kelime). Ağ yok, bekleme yok,
 * kota yok; uçakta da çalışır. Yapay zekâ ancak burada aday çıkmazsa devreye
 * giriyor.
 *
 * NE YAPMIYOR. Hiçbir şeyi engellemiyor. Sözlüğümüz İngilizcenin tamamı
 * değil; "petrichor" gerçek bir kelime ama listede yok. Bu yüzden öneri bir
 * UYARIDIR, kapı değil: kullanıcı önerilen kelimeyi seçebilir ya da kendi
 * yazdığıyla devam edebilir.
 */

/**
 * Damerau-Levenshtein uzaklığı, TAVANLI.
 *
 * Tavan olmadan 19 bin kelimeye tam matris kurmak gerekirdi. Tavanla, satırın
 * en küçük değeri tavanı geçtiği anda hesap bırakılıyor; tipik bir sorgu
 * milisaniyeler sürüyor.
 *
 * Yer değiştirme (transpozisyon) ayrıca sayılıyor: klavyede en sık yapılan
 * hata "recieve" gibi iki harfin yer değiştirmesidir ve düz Levenshtein bunu
 * iki hata sayar, yani gerçek düzeltmeyi eler.
 *
 * @returns Uzaklık; tavanı aşıyorsa `tavan + 1`.
 */
export function duzenlemeUzakligi(a: string, b: string, tavan: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > tavan) return tavan + 1;
  if (!a.length) return b.length <= tavan ? b.length : tavan + 1;
  if (!b.length) return a.length <= tavan ? a.length : tavan + 1;

  let oncekiOnceki: number[] = [];
  let onceki: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  let simdi: number[] = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    simdi[0] = i;
    let satirEnKucuk = i;
    for (let j = 1; j <= b.length; j++) {
      const bedel = a[i - 1] === b[j - 1] ? 0 : 1;
      let deger = Math.min(
        simdi[j - 1] + 1,      // ekleme
        onceki[j] + 1,         // silme
        onceki[j - 1] + bedel  // değiştirme
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        deger = Math.min(deger, oncekiOnceki[j - 2] + 1); // yer değiştirme
      }
      simdi[j] = deger;
      if (deger < satirEnKucuk) satirEnKucuk = deger;
    }
    if (satirEnKucuk > tavan) return tavan + 1;
    oncekiOnceki = onceki;
    onceki = simdi;
    simdi = new Array(b.length + 1);
  }

  const sonuc = onceki[b.length];
  return sonuc > tavan ? tavan + 1 : sonuc;
}

/**
 * Sorgu uzunluğuna göre kaç hataya izin verilir.
 *
 * Kısa kelimelerde tolerans zararlıdır: dört harfli bir kelimenin bir harf
 * uzağında onlarca gerçek kelime vardır ("cat" → cap, car, cot, bat…), yani
 * öneri rastgeleye döner. Üç harf ve altında hiç öneri verilmiyor.
 */
export function oneriTavani(uzunluk: number): number {
  if (uzunluk <= 3) return 0;
  if (uzunluk <= 6) return 1;
  return 2;
}

/**
 * Sorguya en yakın madde başlarını döndürür.
 *
 * @param sorgu     Kullanıcının yazdığı (normalize edilmiş) kelime.
 * @param adaylar   Aday madde başları; normalize edilmiş olmaları beklenir.
 * @param limit     En çok kaç öneri döndürüleceği.
 */
export function yazimOnerileri(
  sorgu: string,
  adaylar: Iterable<string>,
  limit = 3
): string[] {
  const anahtar = sorgu.trim().toLowerCase();

  /*
   * ÇOK KELİMELİ GİRDİYE ÖNERİ VERİLMEZ.
   *
   * KULLANICININ BİLDİRDİĞİ HATA: "day off" yazınca "bunu mu demek istedin?
   * layoff | payoff" çıkıyordu. Sebep, boşluğun sıradan bir harf gibi
   * sayılması: "day off" ile "layoff" arasındaki uzaklık iki (d->l ve boşluğu
   * sil), yani eşiğin içinde. Aday listesinden çok kelimeliler zaten
   * eleniyordu ama SORGUNUN kendisi elenmiyordu.
   *
   * Bir kalıbın doğruluğu tek kelimelik bir listeye bakarak yargılanamaz:
   * "day off" gayet doğru yazılmış bir ifadedir, bizde olmaması onu yanlış
   * yapmaz. Böyle girdiler doğrudan yapay zekâya gider ve çevrilir.
   */
  if (/\s/.test(anahtar)) return [];

  const tavan = oneriTavani(anahtar.length);
  if (!tavan) return [];

  const bulunan: { kelime: string; uzaklik: number; ilkHarfAyni: boolean }[] = [];
  const gorulen = new Set<string>();

  for (const ham of adaylar) {
    const aday = ham.toLowerCase();
    if (aday === anahtar) return []; // Kelime zaten listede: öneri anlamsız.
    if (gorulen.has(aday)) continue;
    if (Math.abs(aday.length - anahtar.length) > tavan) continue;
    /*
     * Birden çok kelimeden oluşan kalıplar elenir: "bunu mu demek istedin"
     * sorusu tek kelime için anlamlı; "give up" önerisi yazım hatası değil
     * başka bir madde demektir.
     */
    if (aday.includes(' ')) continue;

    const uzaklik = duzenlemeUzakligi(anahtar, aday, tavan);
    if (uzaklik > tavan) continue;

    gorulen.add(aday);
    bulunan.push({ kelime: aday, uzaklik, ilkHarfAyni: aday[0] === anahtar[0] });
  }

  /*
   * Sıralama: önce daha az hata, sonra ilk harfi tutan aday. İlk harf
   * kayması gerçek bir yazım hatasında enderdir; aynı uzaklıkta "receive"
   * ile "deceive" arasında seçim yapmak gerekirse kullanıcının bastığı ilk
   * harf daha güvenilir bir ipucudur.
   */
  bulunan.sort(
    (a, b) =>
      a.uzaklik - b.uzaklik ||
      Number(b.ilkHarfAyni) - Number(a.ilkHarfAyni) ||
      a.kelime.localeCompare(b.kelime, 'en')
  );

  return bulunan.slice(0, limit).map(x => x.kelime);
}
