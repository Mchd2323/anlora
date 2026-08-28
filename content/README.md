# Duyuru dosyası

Bu klasördeki `app-content.json`, sunucusuz dağıtımda uygulamanın duyuruları
okuduğu yerdir. Dosyayı güncellemek duyuruyu yayınlamak demektir — **mağaza
güncellemesi gerekmez**, kullanıcı uygulamayı bir sonraki açışında görür.

## Yayına alma (bir kez yapılır)

1. GitHub'da depo ayarlarından **Pages**'i aç ve kaynağı bu deponun ana dalı
   olarak seç.
2. Yayınlanan adresi `.env` dosyasındaki `VITE_CONTENT_URL` değişkenine yaz,
   örneğin `https://<kullanıcı>.github.io/anlora/content/app-content.json`.
3. APK'yi yeniden derle. Adres derleme anında gömülür.

Değişken boş bırakılırsa hiçbir istek çıkmaz ve uygulama duyurusuz çalışır.

## Duyuru ekleme

`announcements` dizisine bir nesne ekle:

```json
{
  "announcements": [
    {
      "id": "2026-09-yeni-kaliplar",
      "title": "750 yeni kalıp eklendi",
      "body": "Oxford kalıp listesi artık A1'den C1'e kadar uygulamada.",
      "createdAt": "2026-09-01"
    }
  ],
  "ads": {},
  "branding": {}
}
```

`id` benzersiz olmalı: uygulama okunmuş duyuruları bu kimlikle hatırlar, aynı
kimlikle ikinci kez duyuru yayınlarsan kimse görmez.

`ads` ve `branding` bu dağıtımda kullanılmıyor; boş bırak.
