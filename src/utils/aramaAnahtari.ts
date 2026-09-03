/**
 * Arama ve eşleştirme için ortak anahtar üretir.
 *
 * NEDEN `toLowerCase()` YETMİYOR. Uygulamanın dili Türkçe, klavyesi Türkçe,
 * aradığı kelimeler ise İngilizce. Bu üçlü, JavaScript'in varsayılan küçük
 * harfe çevirmesini sessizce bozuyor:
 *
 *   'İ'.toLowerCase()  →  'i' + U+0307 (birleşen üstteki nokta), İKİ kod noktası
 *
 * Yani kullanıcı "İsland" yazdığında elde edilen metin "island" ile
 * karakter karakter eşit değildir; arama hiçbir sonuç bulamaz. Android
 * klavyesi cümle başındaki harfi kendiliğinden büyüttüğü için bu, nadir
 * bir durum değil — i ile başlayan her kelimede olan şeydir.
 *
 * İkinci sorun noktasız ı: kullanıcı "ısland" yazarsa aradığı İngilizce
 * kelime yine "island"dır. İngilizcede ı harfi hiç geçmediği için dört
 * i-türevini tek bir 'i'ye indirmek yanlış eşleşme üretmez, buna karşılık
 * gerçek bir aramayı kurtarır.
 *
 * Türkçe anlamlarda ("ışık") her iki taraf da aynı dönüşümden geçtiği için
 * eşleşme korunur; yalnızca noktalı/noktasız ayrımı aramada esner ki bu da
 * arama için istenen davranıştır.
 *
 * NFC: geriye kalan birleşen işaretler tek biçime toplanır, böylece görsel
 * olarak aynı olan iki metin bayt düzeyinde de aynı olur.
 */
export function aramaAnahtari(metin: string): string {
  return (metin || '')
    .trim()
    .replace(/[İIıi]/g, 'i')
    .toLowerCase()
    .normalize('NFC');
}
