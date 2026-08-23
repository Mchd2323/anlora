ÖZEL EĞİTİM SOHBET — WORDPRESS BLOK TEMASI 1.1.0
================================================

Özel eğitim öğretmenleri ve ebeveynlerinin soru, deneyim ve çözüm paylaştığı
topluluk sitesi için hazırlanmış tam site düzenleme (FSE) teması.


KURULUM
-------
1. `ozel-egitim-sohbet` klasörünü zip'leyin (klasörün kendisi zip içinde
   kalmalı) veya doğrudan `wp-content/themes/` altına kopyalayın.
2. Görünüm > Temalar bölümünden temayı etkinleştirin.
3. Görünüm > Tema Kurulumu ekranını açın ve zorunlu eklentileri kurun.


ZORUNLU EKLENTİLER
------------------
- wpForo Forum (wpforo)
  Sorular, yanıtlar, kategoriler, üyelik formu, giriş, profil, bildirimler,
  kullanıcı grupları, spam ve moderasyon sistemi.

- Nextend Social Login and Register (nextend-facebook-connect)
  Google hesabıyla üye olma ve giriş.

Her ikisi de Tema Kurulumu ekranından tek tıkla kurulabilir; eksik olduğu
sürece yönetim panelinde uyarı görünür.

İSTEĞE BAĞLI
- Bir SMTP eklentisi: üyelik onayı, şifre sıfırlama ve bildirim e-postaları.
- Akismet: wpForo'nun yerleşik entegrasyonu üzerinden ek spam koruması.


İLK AYARLAR
-----------
1. wpForo > Forumlar: BEP / IEP, Dil ve İletişim, Davranış, Oyun ve Sosyal
   Beceriler gibi kategoriler açın ve her kategoriye en az bir forum ekleyin.
   Ana sayfadaki "Konular" listesi ve konu sayıları bu forumlardan gelir.
2. wpForo > Ayarlar > Giriş ve Kayıt: üyeliği açın.
3. wpForo > Ayarlar > Üye Profili: profil ve hesap sayfalarını ayarlayın.
4. wpForo > Üye Grupları: Moderatör grubunun yetkilerini sınırlayın. Grup
   adları ("Öğretmen", "Ebeveyn" gibi) ana sayfadaki rozetlerde görünür.
5. Nextend ayarlarında Google sağlayıcısını etkinleştirin ve Google Cloud
   Console'dan aldığınız istemci kimliği ile gizli anahtarı girin.
6. Görünüm > Düzenleyici: renkler, üst menü, ana sayfa metinleri, sağ-sol
   kartlar ve footer buradan değiştirilir.


TEMA KISA KODLARI
-----------------
Bu kısa kodlar Düzenleyici içinde herhangi bir şablona eklenebilir.

  [oec_discussions limit="6"]
      Arama kutusu, sıralama seçimi ve konuşma kartları. Sıralama ve arama
      `?soru=`, `?sira=`, `?forum=` adres parametreleriyle çalışır;
      JavaScript kapalıyken de "Ara" düğmesiyle kullanılabilir.

  [oec_topics limit="8"]
      wpForo forumları ve konu sayıları; tıklanınca listeyi filtreler.

  [oec_stats]
      Açık konuşma, paylaşılan yanıt ve üye sayısı.

  [oec_account]
      Girişsiz ziyaretçiye "Giriş / Üye ol", giriş yapmış üyeye avatar, ad,
      üye grubu ve "Çıkış" bağlantısı.

  [oec_ask_button label="+ Soru sor"]
      wpForo'nun yeni konu ekranına giden düğme.

  [oec_privacy_warning]
      Mahremiyet uyarısı kutusu.

wpForo kurulu değilken bu kısa kodlar hata vermez; yöneticiye kurulum
bağlantısı, ziyaretçiye nötr bir "hazırlanıyor" mesajı gösterirler.


ŞABLONLAR
---------
  front-page.html        Ana sayfa (kahraman alanı + üç sütunlu topluluk)
  index.html             Blog listesi (yedek şablon)
  archive.html           Arşivler
  search.html            Site içi arama sonuçları
  page.html              Sayfa
  page-topluluk.html     Tam genişlikte sayfa — wpForo /community/ sayfası
                         için "Sayfa Özellikleri > Şablon" bölümünden seçin
  single.html            Yazı (yorumlar dâhil)
  404.html               Bulunamadı


TEKNİK NOTLAR
-------------
- Ana sayfadaki liste wpForo veritabanı tablolarını doğrudan, yalnızca okuma
  amaçlı sorgular. Tablo veya sütun yoksa liste sessizce boşa düşer, hata
  vermez. Özel (private) forumlar ve özel konular listeye alınmaz.
- Sorgular kısa süreli transient önbelleğine alınır (konu listesi 1 dakika,
  forum ve sayaçlar 5 dakika) ve yeni konu/yanıt eklendiğinde temizlenir.
- Konu bağlantıları wpForo'nun `/{forum-slug}/{konu-slug}/` adres yapısına
  göre üretilir. wpForo'da farklı bir kalıcı bağlantı yapısı seçtiyseniz
  bağlantılar forum ana sayfasına düşer.
- Tema `style.css` dışında dış kaynak yüklemez; ikonlar satır içi SVG'dir.
- Tüm metinler `ozel-egitim-sohbet` metin alanıyla çevrilebilir.


ÖNEMLİ
------
- wpForo kendi /community/ sayfasını oluşturur.
- Google girişi için Google Cloud Console istemci kimliği ve gizli anahtarı
  gerekir.
- Çocukların adını, okulunu, fotoğrafını, rapor numarasını veya onları
  tanınabilir kılan bilgileri sitede paylaşmayın.


SÜRÜM NOTLARI
-------------
1.1.0
- Ana sayfadaki forum alanı gerçek wpForo verisiyle çalışan konuşma
  listesine dönüştürüldü (arama, sıralama, forum filtresi, yanıt/beğeni
  sayıları, üye grubu rozetleri).
- Üst menüye giriş durumuna göre değişen hesap alanı eklendi.
- Mobilde tamamen gizlenen menü, konu listesi ve giriş bağlantısı
  erişilebilir hâle getirildi.
- Eksik şablonlar eklendi: archive, search, page-topluluk; single.html'deki
  yorum bloğu çalışır duruma getirildi (iç bloklar eksikti).
- Yönetim ekranı yetki kontrolü, çıktı kaçışları ve çeviri desteği eklendi.
- theme.json: düğme/bağlantı hover ve odak durumları, boşluk ölçekleri,
  tam genişlik sayfa şablonu tanımı.
- screenshot.png ve lisans başlıkları eklendi.

1.0.0
- İlk sürüm.
