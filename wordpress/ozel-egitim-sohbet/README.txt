ÖZEL EĞİTİM SOHBET — WORDPRESS BLOK TEMASI 1.4.0
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
7. İsteğe bağlı: wpForo'nun kendi kenar çubuğu (Ara / Recent Posts / Recent
   Comments) temanın kendi kartlarıyla işlevi çakışır. wpForo > Ayarlar >
   Forum Kenar Çubuğu bölümünden kapatırsanız pano daha ferah görünür.
   Açık bırakırsanız da sorun olmaz; dar ekranlarda panonun altına iner.


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


MANŞET GÖRSELİ
--------------
Manşetin sağında bir görsel alanı vardır. Görsel sağa yaslanır ve sola
doğru, manşet başlığının arka planına karışarak silikleşir. Konumu mutlak
olduğu için görsel ne kadar büyük olursa olsun yerleşimi bozmaz; taşan
kısmı kırpılır.

Temayla birlikte gelen görsel bir ÇİZİMDİR (assets/img/hero.svg), fotoğraf
değildir. Kendi fotoğrafınızla değiştirmek için:

  1. Görünüm > Düzenleyici > Şablonlar > Ana Sayfa
  2. Manşetteki görsele tıklayın
  3. Araç çubuğunda "Değiştir" > "Ortam kitaplığından seç" veya "Yükle"

Sağa yaslama, silikleşme ve ekran boyutuna uyum temadan gelir; fotoğraf
değişince de aynen çalışır. Yatay (manzara) oranlı, en az 1200 px genişlikte
bir görsel seçin; sağ tarafında ana özne, sol tarafında sade bir alan olan
kareler bu düzende en iyi sonucu verir.

Fotoğraf seçerken:
- Telif durumunu kendiniz doğrulayın. Pexels, Unsplash ve Pixabay ticari
  kullanıma açık ücretsiz görseller sunar; yine de indirdiğiniz her görselin
  lisans metnini okuyun.
- Bu sitenin kendi uyarısı "çocuğun fotoğrafını paylaşmayın" diyor. Manşette
  tanınabilir çocuk yüzü kullanmak bu mesajla çelişir ve ziyaretçilere
  yanlış örnek olur. Yüz göstermeyen kareler hem daha güvenli hem de
  genellikle daha güçlü durur: eller ve materyaller, arkadan çekilmiş bir
  çocuk, bir öğretmenin masası, oyun ve öğrenme nesneleri.
- Model izni (release) olmayan gerçek öğrenci fotoğraflarını kullanmayın.


SAYFA DÜZENİ
------------
Ana sayfa ve forum sayfası aynı iskeleti kullanır:

  Manşet (yalnızca ana sayfada)
  ├─ Mahremiyet uyarısı            │  Daha iyi yanıt için
  └─ Sol sütun                     │  Forum / konuşma listesi
       Konular (kategoriler)       │
       Önemli not                  │
       Bugün toplulukta            │
       Önce anlayalım              │

Forum tek geniş sütunda durur; yanında yalnızca bir dar sütun vardır, bu
yüzden pano sıkışmaz.


EKRAN BOYUTLARI
---------------
  Masaüstü (1024 px ve üzeri)   İki sütun: sol sütun | forum
  Tablet (768-1023)             Tek sütun. Konular üstte yatay kaydırılan
                                sekme şeridi, hemen altında forum, kalan
                                kartlar forumun altında ikişerli
  Mobil (768 px altı)           Tek sütun; menü hamburger olur
  Dar mobil (560 px altı)       Üst menü iki satıra bölünür

Hiçbir boyutta içerik gizlenmez, yalnızca yer değiştirir. 345-1425 px
aralığında, hem ana sayfada hem forum sayfasında yatay kaydırma oluşmadığı
tarayıcıda ölçülerek doğrulandı.


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
1.4.0
- Manşetteki "S M A D / Öğretmenler ve ebeveynler" kutusu kaldırıldı.
- Yerine sağa yaslanan, sola doğru manşet arka planına karışarak silikleşen
  bir görsel alanı eklendi. Görsel mutlak konumlu olduğu için yerleşimi
  itmez; büyük görsellerin taşan kısmı kırpılır.
- Görsel WordPress Düzenleyici'den değiştirilebilir (Ana Sayfa şablonu >
  görsele tıkla > Değiştir). Efektler temadan geldiği için yeni fotoğrafta
  da aynen çalışır.
- Geçici görsel olarak temanın renklerinde, yüz içermeyen bir çizim eklendi
  (assets/img/hero.svg). Yerine kendi fotoğrafınızı koyun.
- Ekran boyutuna göre çerçeveleme: masaüstünde sağ yarıda, tabletde dar
  sütunda, mobilde manşetin altında kendi en-boy oranıyla (kırpılmadan).

1.3.0
- Sayfa düzeni tek sol sütuna indirildi: sağdaki sütun kaldırıldı, kartları
  sola alındı. Sıra: Konular, Önemli not, Bugün toplulukta, Önce anlayalım.
- "Daha iyi yanıt için" kartı manşetin altına, mahremiyet uyarısının sağına
  taşındı. Bu ikili hem ana sayfada hem forum sayfasında görünür.
- Forum artık tek geniş sütunda; yanında yalnızca bir dar sütun olduğu için
  pano sıkışmıyor.
- Ana sayfa listesi 6 yerine 8 konuşma gösteriyor (sütun genişlediği için).
- Tabletde Konular şeridi ve forum üstte kalıyor, diğer kartlar forumun
  altına ikişerli diziliyor.

1.2.1
- HATA: Kategori listesi, forumlar var olduğu hâlde "Henüz forum yok"
  diyordu. Sorgudaki "status = 0" süzgeci bazı wpForo kurulumlarında görünür
  forumları da eliyordu. Sorgu artık kademeli: en dar süzgeçle başlar, hiç
  satır dönmezse süzgeci gevşetir. Kategori tespiti de sağlamlaştırıldı;
  is_cat sütunu yoksa ebeveyn ilişkisinden çıkarılıyor.
- HATA: Forum sayfasında sütunlar ters yerleşiyordu. Ana sayfa ızgarasına ait
  grid-area kuralları kapsamlandırılmamıştı ve forum sayfası ızgarasına
  sızıyordu.
- Forum sayfası düzeni yeniden kuruldu: pano artık tek dar rayla yan yana,
  rehber ve sayaç kartları panonun altında. wpForo'nun kendi kenar çubuğu
  açıksa dar ekranlarda panonun altına iniyor, yanına sıkışmıyor.
- Yönetim ekranındaki "Forum ↔ Tema bağlantısı" bölümüne "Teknik ayrıntı"
  paneli eklendi: hangi tablodan kaç satır okunduğu, hangi süzgecin
  uygulandığı ve süzgecin gevşetilip gevşetilmediği görülebiliyor.

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
