# Play Console — İçerik derecelendirme anketi (IARC)

Play Console'da **Politika ve programlar → Uygulama içeriği → İçerik
derecelendirmesi** altında doldurulur. Anketi IARC yürütür; sonuçta
Türkiye için PEGI, ABD için ESRB gibi yaş etiketleri çıkar.

---

## ÖNCE ŞUNU OKU: küfür maddeleri paketten çıkarıldı

Bu belgenin önceki sürümü, pakette 102 maddelik bir küfür ve hakaret
bandı (bant 14) olduğunu anlatıyor ve ankette "küfür var" işaretlenmesini
söylüyordu. **O bant artık pakette yok.**

Ne yapıldı:

- `scripts/extended/source/wordlist.json` içinden bant 14'ün 102 başlığı
  çıkarıldı (24.614 → 24.512 satır).
- Bu başlıkların Türkçe karşılıklarını taşıyan
  `scripts/extended/content/b14-elle-001.json` silindi (150 anlam).
- Bu sözcükleri kelime listesine geri yazan
  `scripts/extended/kufur_kaynaga_yaz.py` silindi. Tek işi buydu; dursaydı
  kaldırma, belgelenmiş boru hattını bir kez daha çalıştıran herkes
  tarafından geri alınırdı.
- `build_bands.py --strict` yeniden koşturuldu; üretilen pakette bant 14
  kaydı **0**.

**Kaldırma kalıcıdır.** `build_wordlist.py` bu sözcükleri zaten iki
süzgeçle eliyordu (`VULGAR` 82 madde, `SLUR` 31 madde); bant 14 onları
elle geri ekliyordu. Süzgeçler yerinde durduğu için kelime listesi bir
daha üretildiğinde geri gelmiyorlar.

### Ölçüldü: 113 maddelik süzgeç listesinden pakette kalan tek sözcük

```
rape        src/data/oxford5000extra.json
```

Bu madde bant 14'ten gelmiyor: **Oxford 5000 C1 resmî kelime listesinde**
duruyor ve Oxford çekirdek verisi bu projede salt okunur. Küfür ya da
hakaret değil, hukuki/klinik bir terim. Aşağıdaki cinsellik beyanında
açıkça anılıyor.

---

## Bu beyanı "her şey temiz" diye okuma

Küfür gitti; **sözlüğün geri kalanı bir sözlük olmaya devam ediyor.**
Oxford 3000/5000 resmî listelerinde duran ve ankette hâlâ beyan edilmesi
gereken maddeler (ölçüldü, hepsi pakette):

```
cinsellik     sex, sexual, naked, nude, breast, virgin, condom,
              prostitute, prostitution, abortion, rape
madde/alkol   alcohol, beer, wine, drunk, cigarette, smoke, drug
şiddet/ölüm   kill, murder, war, weapon, gun, suicide
```

Bunlar tanımdır, betimleme değildir — ama "hiçbir hassas içerik yok"
demek yine de yanlış beyan olur.

---

## Anket cevapları

Anket önce kategori sorar.

**Kategori: Referans, haber veya eğitim** (Reference, News, or Educational)
Anlora bir sözlük ve çalışma uygulamasıdır; oyun değildir. Oyun
kategorisini seçme — anket tamamen farklı sorular sorar.

### Şiddet
- Gerçekçi ya da çizgi şiddet içeriyor mu? → **Hayır**
- Şiddet betimlemesi var mı? → **Hayır**
  (Sözlükte `war`, `kill`, `murder`, `weapon` gibi maddeler var ama bunlar
  tanımdır, şiddet betimlemesi değil. IARC bunu şiddet saymaz.)

### Cinsellik
- Cinsel içerik veya çıplaklık var mı? → **Hayır** (görsel yok)
- Cinsellikle ilgili **metinsel** gönderme var mı? → **EVET**
  - Açıklama kutusuna yaz: *"Uygulama bir İngilizce–Türkçe sözlüktür.
    Cinsellikle ilgili terimler (sex, naked, prostitute, condom, abortion,
    rape) Oxford 3000/5000 resmî kelime listelerinin maddeleri olarak,
    tıbbi/sözlüksel tanım biçiminde yer alır; görsel içerik ya da
    müstehcen anlatım yoktur."*

### Küfür ve kaba dil
- **Hayır.**
  - Gerekçe (kutuya yazmana gerek yok, denetim sorarsa hazır olsun):
    küfür ve hakaret maddeleri paketten çıkarıldı; kelime listesi
    üretilirken `VULGAR` ve `SLUR` süzgeçleri bunları zaten eliyor.
    Üretim akışında bu süzgeçleri delen bir adım kalmadı.

### Uyuşturucu, alkol, tütün
- **EVET** (metinsel)
  - `alcohol`, `beer`, `wine`, `drunk`, `cigarette`, `smoke`, `drug`
    maddeleri Oxford listelerinden geliyor. Açıklama: *"Sözlük maddeleri
    olarak geçer; kullanım özendirilmez."*

### Kumar
- **Hayır.** Uygulamada kumar, şans oyunu ya da simüle kumar yok.
  (`gamble`, `gambling` sözlük maddesidir; oynanabilir kumar değildir.)

### Korku / rahatsız edici içerik
- **Hayır.**

### Kullanıcılar arası etkileşim
- Kullanıcılar birbiriyle iletişim kurabilir mi? → **Hayır**
- Kullanıcı konumu paylaşılıyor mu? → **Hayır**
- Kullanıcı tarafından oluşturulan içerik paylaşılıyor mu? → **Hayır**
  (Kullanıcı kendi kelime kartlarını oluşturur ama bunlar yalnızca kendi
  telefonunda kalır, kimseye gönderilmez.)

### Dijital satın alma
- **Hayır.** Uygulama içi satın alma, abonelik, premium yok.

### Reklam
- **Hayır.** Reklam ağı yok.

---

## Beklenen sonuç

Küfür beyanı kalktığı için derecelendirmenin önceki tahminden (PEGI 12 /
ESRB Teen) **daha düşük** çıkması bekleniyor. Kesin sonucu IARC'ın
kendi motoru verir; bu belge tahmin yürütüyor, garanti etmiyor.

**13 yaş altı hedef kitle konusunda acele etme.** Küfürün gitmesi tek
başına "Aileler" (Families) politikasına girmeni güvenli kılmıyor:
yukarıdaki cinsellik ve madde beyanları duruyor ve o politika bunlara da
bakıyor. Hedef kitleyi 13 yaş altına açmak istiyorsan bunu ayrı bir karar
olarak ele al, bu kaldırmanın otomatik sonucu sayma.

**Önerilen hedef yaş aralığı: 13–17 ve 18+.**
