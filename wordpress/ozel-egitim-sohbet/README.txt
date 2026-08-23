ÖZEL EĞİTİM SOHBET — WORDPRESS BLOK TEMASI 1.2.0
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


FORUM İLE BAĞLANTI
------------------
Temanın kenarındaki kategori listesi ayrı bir yerde tutulmaz. Doğrudan
wpForo'nun forum yapısından okunur:

  wpForo → Forumlar                        →  sitedeki "Konular" listesi
  kategori ekle / adını değiştir / sırala / sil  →  sitede aynısı görünür
  forumdaki konu sayısı                    →  listedeki rakam

Yani düzenlemeyi tek yerde (wpForo'da) yaparsınız, iki yerde birden
görünür. Tema hiçbir kopya liste tutmadığı için ikisi ayrışamaz.

Değişikliğin siteye yansıması:
- wpForo bir kategori/forum eklediğinde, düzenlediğinde veya sildiğinde
  tema önbelleği anında temizlenir.
- Yönetim panelinde herhangi bir wpForo ekranını açtığınızda da temizlenir.
- Bu iki yol da çalışmazsa önbellek zaten en fazla 1 dakika yaşar.

Görünüm > Tema Kurulumu ekranındaki "Forum ↔ Tema bağlantısı" bölümünde
kategorilerinizi temanın gördüğü hâliyle, konu sayıları ve forum düzeniyle
birlikte görebilir; her satırdan sitedeki karşılığına atlayabilirsiniz.

Kategori listesinden bir foruma tıklandığında ana sayfadaki konuşma listesi
o foruma göre süzülür (adres satırında ?forum=... olarak görünür).


Q&A (SORU-CEVAP) DÜZENİ
-----------------------
Bu tema soru-cevap akışı için tasarlandı. wpForo → Forumlar bölümünde her
forumu düzenleyip "Layout" ayarını Q&A yapmanız önerilir. Böylece:

- Konular soru, cevaplar yanıt olarak görünür.
- Yanıtlar yukarı/aşağı oylanabilir ve "en çok oylanan" diye sıralanır.
- Soruyu soran kişi bir yanıtı "en iyi yanıt" olarak işaretleyebilir.

Ana sayfadaki kartlarda görünen "yararlı" sayısı bu oylardan, "Çözüldü"
rozeti ise en iyi yanıt işaretinden gelir. Klasik düzende de tema çalışır;
o zaman bu göstergeler beğeni sayısına düşer veya hiç görünmez.


EKRAN BOYUTLARI
---------------
  Masaüstü (1280 px ve üzeri)   Üç sütun: kategoriler | konuşmalar | kartlar
  Küçük masaüstü (1024-1279)    İki sütun; sağdaki kartlar listenin altına
                                iner ve yan yana dizilir
  Tablet (768-1023)             Tek sütun; kategoriler yatay kaydırılan
                                sekme şeridine dönüşür
  Mobil (768 px altı)           Tek sütun; menü hamburger olur
  Dar mobil (560 px altı)       Üst menü iki satıra bölünür

Hiçbir boyutta içerik gizlenmez, yalnızca yer değiştirir. 345-1425 px
aralığında yatay kaydırma oluşmadığı tarayıcıda ölçülerek doğrulandı.


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
  page-topluluk.html     Forum sayfası düzeni: solda kategori listesi,
                         ortada wpForo panosu, sağda rehber ve sayaç
                         kartları. Tema bu şablonu wpForo'nun sayfasına
                         kendiliğinden atar (elle şablon seçtiyseniz ona
                         dokunmaz)
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
1.2.0
- Kategori listesi wpForo forum ağacına tam bağlandı: kategoriler başlık,
  forumlar alt satır olarak, konu sayılarıyla birlikte gelir. Boş
  kategoriler gizlenir, kategorisiz forumlar kaybolmaz.
- wpForo'da yapılan ekleme/düzenleme/silme işlemleri tema önbelleğini
  anında temizler; yönetim panelinde wpForo ekranı açıldığında da temizlenir.
- Yönetim ekranına "Forum ↔ Tema bağlantısı" paneli eklendi.
- Q&A düzeni desteği: oy sayısı, yanıt sayısı ve "en iyi yanıt" işareti,
  sürümler arası sütun adı farklarına dayanıklı biçimde okunur.
- Forum sayfası artık tema kabuğunu ve kategori listesini kullanıyor.
- Renk tasarımı yenilendi: fildişi zemin, derin orman yeşili ve pirinç
  vurgu. Tüm metin renkleri WCAG AA kontrast oranını geçiyor.
- Duyarlı yerleşim baştan yazıldı (yukarıdaki tabloya bakın); yatay
  kaydırmaya yol açan ızgara taşması giderildi.
- Ekran görüntüsü temanın gerçek çıktısından üretildi.

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
