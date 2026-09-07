export const BRAND = {
  name: 'Anlora',
  /**
   * Uygulamanın resmî iletişim adresi.
   *
   * Kullanıcı geri bildirimleri, hata raporları ve mağaza destek bağlantısı
   * buraya gider. Tek yerde durur ki adres değişirse arayüzün onu gösterdiği
   * her nokta birlikte değişsin.
   */
  contactEmail: 'anloramobil@gmail.com',
  /**
   * Marka sloganı. Açılış ekranıyla aynı cümle: `scripts/android/make-splash.mjs`
   * bu metni splash görseline gömüyor. İkisi ayrı yerlerde yazılı olduğu için
   * biri değişirse öteki de değişmeli, yoksa uygulama açılışta bir şey,
   * açıldıktan sonra başka bir şey söyler.
   */
  slogan: 'Words are power.',
  description:
    'Kendi kelime setlerini oluştur, Oxford 5000 kelimelerini çalış ve AI destekli örneklerle öğren.',
  coreMessage: 'Kelimeyi sadece görme. Anlamını öğren, kullan ve hatırla.',
  aiName: 'Anlora AI',
  aiLoadingText: 'Anlora kelime kartını hazırlıyor...',
  aiLoadingSubtext: 'Anlamlar ve örnek cümleler hazırlanıyor.',
  aiSuccessToast: 'Kart hazır.',
  aiValidateLoadingText: 'Anlamlar ve bağlamlar kontrol ediliyor...',
};
