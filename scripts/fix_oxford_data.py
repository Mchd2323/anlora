#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enriches and fixes all Turkish meanings, IPA phonetics, and contextual 3 example sentences
for Oxford 3000 words across wordsA1.json, wordsA2.json, wordsB1.json, wordsB2.json.
"""

import json
import os
import re

# Comprehensive Turkish dictionary database mapping lemmas/words to accurate Turkish meanings & phonetics & examples
DICTIONARY = {
    # Common A2 fixes
    "all right": {
        "tr": "peki, tamam, iyi, sorunsuz",
        "ph": "/ɔːl ˈraɪt/",
        "pos": "adj., adv., exclamation",
        "ex": [
            {"en": "Is everything all right with your new job?", "tr": "Yeni işinde her şey yolunda mı?"},
            {"en": "All right, let us start the presentation now.", "tr": "Peki, şimdi sunuma başlayalım."},
            {"en": "Don't worry, you will be all right soon.", "tr": "Endişelenme, yakında tamamen iyi olacaksın."}
        ]
    },
    "allow": {
        "tr": "izin vermek, olanak tanımak, müsaade etmek",
        "ph": "/əˈlaʊ/",
        "pos": "v.",
        "ex": [
            {"en": "Smoking is not allowed inside the building.", "tr": "Bina içinde sigara içilmesine izin verilmez."},
            {"en": "The software allows users to edit photos easily.", "tr": "Yazılım, kullanıcıların fotoğrafları kolayca düzenlemesine olanak tanır."},
            {"en": "Please allow me to carry your heavy bag.", "tr": "Lütfen ağır çantanızı taşımama izin verin."}
        ]
    },
    "almost": {
        "tr": "neredeyse, hemen hemen, az kalsın",
        "ph": "/ˈɔːlməʊst/",
        "pos": "adv.",
        "ex": [
            {"en": "Dinner is almost ready, please take your seat.", "tr": "Akşam yemeği neredeyse hazır, lütfen yerinize geçin."},
            {"en": "I have almost finished reading this novel.", "tr": "Bu romanı okumayı neredeyse bitirdim."},
            {"en": "It was almost midnight when we arrived home.", "tr": "Eve vardığımızda neredeyse gece yarısıydı."}
        ]
    },
    "alone": {
        "tr": "yalnız, tek başına, kimsesiz",
        "ph": "/əˈləʊn/",
        "pos": "adj., adv.",
        "ex": [
            {"en": "She prefers to live alone in a quiet town.", "tr": "Sakin bir kasabada tek başına yaşamayı tercih ediyor."},
            {"en": "You are not alone; we are always here to help you.", "tr": "Yalnız değilsin; sana yardım etmek için her zaman buradayız."},
            {"en": "He traveled alone across Europe last summer.", "tr": "Geçen yaz Avrupa genelinde tek başına seyahat etti."}
        ]
    },
    "along": {
        "tr": "boyunca, yanı sıra, ileriye doğru",
        "ph": "/əˈlɒŋ/",
        "pos": "prep., adv.",
        "ex": [
            {"en": "We walked along the quiet beach at sunset.", "tr": "Gün batımında sakin sahil boyunca yürüdük."},
            {"en": "Houses were built all along the river bank.", "tr": "Nehir kıyısı boyunca evler inşa edilmişti."},
            {"en": "Bring your friends along to the party tonight!", "tr": "Bu akşam partiye arkadaşlarını da yanında getir!"}
        ]
    },
    "already": {
        "tr": "zaten, çoktan, şimdiden",
        "ph": "/ɔːlˈredi/",
        "pos": "adv.",
        "ex": [
            {"en": "I have already had breakfast this morning.", "tr": "Bu sabah kahvaltımı zaten yaptım."},
            {"en": "The train was already leaving when we reached the platform.", "tr": "Biz perona ulaştığımızda tren çoktan hareket ediyordu."},
            {"en": "Is it 5 o'clock already?", "tr": "Saat şimdiden 5 oldu mu?"}
        ]
    },
    "alternative": {
        "tr": "alternatif, seçenek; diğer, farklı",
        "ph": "/ɔːlˈtɜːnətɪv/",
        "pos": "n., adj.",
        "ex": [
            {"en": "We need to find an alternative solution to this problem.", "tr": "Bu soruna alternatif bir çözüm bulmamız gerekiyor."},
            {"en": "Do you have any alternative suggestions?", "tr": "Başka bir alternatif öneriniz var mı?"},
            {"en": "Cycling is a healthy alternative to driving.", "tr": "Bisiklete binmek, araba kullanmaya sağlıklı bir alternatiftir."}
        ]
    },
    "although": {
        "tr": "rağmen, -e karşın, gerçi",
        "ph": "/ɔːlˈðəʊ/",
        "pos": "conj.",
        "ex": [
            {"en": "Although it was raining, we went for a long walk.", "tr": "Yağmur yağmasına rağmen uzun bir yürüyüşe çıktık."},
            {"en": "He decided to buy the car although it was expensive.", "tr": "Pahalı olmasına karşın arabayı satın almaya karar verdi."},
            {"en": "Although she was tired, she completed her project.", "tr": "Yorgun olmasına rağmen projesini tamamladı."}
        ]
    },
    "among": {
        "tr": "arasında, içinde (üç veya daha fazla şey)",
        "ph": "/əˈmʌŋ/",
        "pos": "prep.",
        "ex": [
            {"en": "She felt happy and relaxed among her close friends.", "tr": "Yakın arkadaşlarının arasında mutlu ve rahat hissetti."},
            {"en": "The small cottage was hidden among tall pine trees.", "tr": "Küçük kulübe uzun çam ağaçlarının arasında gizlenmişti."},
            {"en": "He is very popular among his university classmates.", "tr": "Üniversite sınıf arkadaşları arasında çok popülerdir."}
        ]
    },
    "amount": {
        "tr": "miktar, tutar, meblağ",
        "ph": "/əˈmaʊnt/",
        "pos": "n.",
        "ex": [
            {"en": "A large amount of money was donated to charity.", "tr": "Hayır kurumuna yüklü miktarda para bağışlandı."},
            {"en": "You should drink a sufficient amount of water every day.", "tr": "Her gün yeterli miktarda su içmelisiniz."},
            {"en": "The total amount will be calculated at the checkout.", "tr": "Toplam tutar kasada hesaplanacaktır."}
        ]
    },
    "ankle": {
        "tr": "ayak bileği",
        "ph": "/ˈæŋkl/",
        "pos": "n.",
        "ex": [
            {"en": "She twisted her ankle while playing tennis.", "tr": "Tenis oynarken ayak bileğini burktu."},
            {"en": "His ankle was swollen after the football match.", "tr": "Futbol maçından sonra ayak bileği şişmişti."},
            {"en": "Wear supportive shoes to protect your ankles.", "tr": "Ayak bileklerinizi korumak için destekleyici ayakkabılar giyin."}
        ]
    },
    "anybody": {
        "tr": "herhangi biri, kimse, hiç kimse",
        "ph": "/ˈenibɒdi/",
        "pos": "pron.",
        "ex": [
            {"en": "Does anybody know the correct answer to this question?", "tr": "Bu sorunun doğru cevabını bilen herhangi biri var mı?"},
            {"en": "I did not see anybody in the library this morning.", "tr": "Bu sabah kütüphanede hiç kimseyi görmedim."},
            {"en": "Anybody can learn to code with enough practice.", "tr": "Yeterli pratikle herkes / herhangi biri kod yazmayı öğrenebilir."}
        ]
    },
    "any more": {
        "tr": "artık, daha fazla, bundan sonra",
        "ph": "/ˌeni ˈmɔː/",
        "pos": "adv.",
        "ex": [
            {"en": "She does not live in London any more.", "tr": "Artık Londra'da yaşamıyor."},
            {"en": "I cannot eat any more, I am completely full.", "tr": "Daha fazla yiyemem, tamamen doydum."},
            {"en": "They don't talk to each other any more.", "tr": "Artık birbirleriyle konuşmuyorlar."}
        ]
    },
    "anyway": {
        "tr": "her neyse, yine de, zaten",
        "ph": "/ˈeniweɪ/",
        "pos": "adv.",
        "ex": [
            {"en": "It was raining hard, but we went out anyway.", "tr": "Şiddetli yağmur yağıyordu ama yine de dışarı çıktık."},
            {"en": "Anyway, let us get back to the main topic.", "tr": "Her neyse, asıl konumuza geri dönelim."},
            {"en": "I did not want to go to the party anyway.", "tr": "Zaten partiye gitmek istemiyordum."}
        ]
    },
    "anywhere": {
        "tr": "herhangi bir yer, hiçbir yer, her yer",
        "ph": "/ˈeniweə(r)/",
        "pos": "adv.",
        "ex": [
            {"en": "I cannot find my keys anywhere in the house.", "tr": "Anahtarlarımı evde hiçbir yerde bulamıyorum."},
            {"en": "You can sit anywhere you like in the cinema.", "tr": "Sinemada istediğiniz herhangi bir yere oturabilirsiniz."},
            {"en": "Did you go anywhere interesting last weekend?", "tr": "Geçen hafta sonu ilginç bir yere gittin mi?"}
        ]
    },
    "app": {
        "tr": "uygulama, aplikasyon",
        "ph": "/æp/",
        "pos": "n.",
        "ex": [
            {"en": "I downloaded a language learning app on my phone.", "tr": "Telefonuma bir dil öğrenme uygulaması indirdim."},
            {"en": "This navigation app gives real-time traffic updates.", "tr": "Bu navigasyon uygulaması gerçek zamanlı trafik güncellemeleri veriyor."},
            {"en": "The mobile app is available on both iOS and Android.", "tr": "Mobil uygulama hem iOS hem de Android'de mevcuttur."}
        ]
    },
    "appear": {
        "tr": "görünmek, belirmek, ortaya çıkmak",
        "ph": "/əˈpɪə(r)/",
        "pos": "v.",
        "ex": [
            {"en": "A rainbow appeared in the sky after the storm.", "tr": "Fırtınadan sonra gökyüzünde bir gökkuşağı belirdi."},
            {"en": "He appears to be very confident during interviews.", "tr": "Mülakatlar sırasında çok özgüvenli görünüyor."},
            {"en": "New symptoms began to appear after two days.", "tr": "İki gün sonra yeni belirtiler ortaya çıkmaya başladı."}
        ]
    },
    "appearance": {
        "tr": "görünüş, dış görünüm, ortaya çıkış",
        "ph": "/əˈpɪərəns/",
        "pos": "n.",
        "ex": [
            {"en": "You should not judge people solely by their appearance.", "tr": "İnsanları yalnızca dış görünüşlerine göre yargılamamalısınız."},
            {"en": "The actor made a brief appearance in the movie.", "tr": "Oyuncu filmde kısa bir sahnede göründü / rol aldı."},
            {"en": "His sudden appearance at the party surprised everyone.", "tr": "Partideki ani görünüşü herkesi şaşırttı."}
        ]
    },
    "apply": {
        "tr": "başvurmak, uygulamak, sürmek",
        "ph": "/əˈplaɪ/",
        "pos": "v.",
        "ex": [
            {"en": "She applied for a scholarship at Oxford University.", "tr": "Oxford Üniversitesi'nde bir bursa başvurdu."},
            {"en": "These safety rules apply to all factory workers.", "tr": "Bu güvenlik kuralları tüm fabrika çalışanları için geçerlidir / uygulanır."},
            {"en": "Apply the sunscreen evenly before going outside.", "tr": "Dışarı çıkmadan önce güneş kremini eşit şekilde sürün."}
        ]
    },
    "architect": {
        "tr": "mimar",
        "ph": "/ˈɑːkɪtekt/",
        "pos": "n.",
        "ex": [
            {"en": "The famous architect designed this modern museum.", "tr": "Ünlü mimar bu modern müzeyi tasarladı."},
            {"en": "She works as a landscape architect in London.", "tr": "Londra'da peyzaj mimarı olarak çalışıyor."},
            {"en": "The architect presented 3D models to the client.", "tr": "Mimar müşteriye 3 boyutlu modeller sundu."}
        ]
    },
    "architecture": {
        "tr": "mimari, mimarlık",
        "ph": "/ˈɑːkɪtektʃə(r)/",
        "pos": "n.",
        "ex": [
            {"en": "Rome is renowned worldwide for its ancient architecture.", "tr": "Roma, antik mimarisiyle dünya çapında ünlüdür."},
            {"en": "He studied modern architecture at the academy.", "tr": "Akademide modern mimarlık eğitimi aldı."},
            {"en": "The gothic architecture of the cathedral is breathtaking.", "tr": "Katedralin gotik mimarisi nefes kesici."}
        ]
    },
    "argue": {
        "tr": "tartışmak, münakaşa etmek, savunmak",
        "ph": "/ˈɑːɡjuː/",
        "pos": "v.",
        "ex": [
            {"en": "They always argue about who should wash the dishes.", "tr": "Bulaşıkları kimin yıkaması gerektiği konusunda her zaman tartışırlar."},
            {"en": "The lawyer argued that his client was completely innocent.", "tr": "Avukat, müvekkilinin tamamen masum olduğunu savundu."},
            {"en": "Don't argue with your teacher during class.", "tr": "Ders sırasında öğretmeninizle tartışmayın."}
        ]
    },
    "argument": {
        "tr": "tartışma, sav, münakaşa, iddia",
        "ph": "/ˈɑːɡjumənt/",
        "pos": "n.",
        "ex": [
            {"en": "They had a heated argument about the budget.", "tr": "Bütçe hakkında hararetli bir tartışma yaşadılar."},
            {"en": "Her argument was supported by solid scientific data.", "tr": "Onun savı sağlam bilimsel verilerle desteklendi."},
            {"en": "Let us settle this argument calmly and politely.", "tr": "Bu tartışmayı sakin ve kibar bir şekilde çözelim."}
        ]
    },
    "army": {
        "tr": "ordu, askeriye, silahlı kuvvetler",
        "ph": "/ˈɑːmi/",
        "pos": "n.",
        "ex": [
            {"en": "He decided to join the army after high school.", "tr": "Liseden sonra orduya katılmaya karar verdi."},
            {"en": "The army helped distribute food after the natural disaster.", "tr": "Ordu, doğal afetten sonra yiyecek dağıtımına yardım etti."},
            {"en": "Soldiers in the army undergo rigorous daily training.", "tr": "Ordudaki askerler her gün zorlu eğitimlerden geçer."}
        ]
    },
    "arrange": {
        "tr": "düzenlemek, ayarlamak, organize etmek",
        "ph": "/əˈreɪndʒ/",
        "pos": "v.",
        "ex": [
            {"en": "She arranged the colorful flowers in a glass vase.", "tr": "Renkli çiçekleri cam bir vazoya düzenledi."},
            {"en": "Can you arrange an appointment with the doctor?", "tr": "Doktorla bir randevu ayarlayabilir misin?"},
            {"en": "They arranged a surprise birthday party for Sarah.", "tr": "Sarah için sürpriz bir doğum günü partisi organize ettiler."}
        ]
    },
    "arrangement": {
        "tr": "düzenleme, hazırlık, anlaşma",
        "ph": "/əˈreɪndʒmənt/",
        "pos": "n.",
        "ex": [
            {"en": "We made all the travel arrangements in advance.", "tr": "Tüm seyahat hazırlıklarını önceden yaptık."},
            {"en": "They reached a satisfactory financial arrangement.", "tr": "Tatmin edici bir mali anlaşmaya vardılar."},
            {"en": "The seating arrangement in the hall was very practical.", "tr": "Salondaki oturma düzeni çok kullanışlıydı."}
        ]
    },
    "asleep": {
        "tr": "uykuda, uyuyan",
        "ph": "/əˈsliːp/",
        "pos": "adj.",
        "ex": [
            {"en": "The baby was fast asleep in her warm crib.", "tr": "Bebek sıcak beşiğinde derin uykudaydı."},
            {"en": "He fell asleep while reading on the sofa.", "tr": "Kanepede kitap okurken uyuya kaldı."},
            {"en": "Please be quiet because the children are asleep.", "tr": "Lütfen sessiz olun çünkü çocuklar uyuyor."}
        ]
    },
    "assistant": {
        "tr": "asistan, yardımcı",
        "ph": "/əˈsɪstənt/",
        "pos": "n.",
        "ex": [
            {"en": "She works as a personal assistant to the general manager.", "tr": "Genel müdürün kişisel asistanı olarak çalışıyor."},
            {"en": "The sales assistant showed me the latest laptop models.", "tr": "Satış görevlisi bana en son dizüstü bilgisayar modellerini gösterdi."},
            {"en": "He hired an administrative assistant for the office.", "tr": "Ofis için bir idari asistan işe aldı."}
        ]
    },
    "athlete": {
        "tr": "sporcu, atlet",
        "ph": "/ˈæθliːt/",
        "pos": "n.",
        "ex": [
            {"en": "Professional athletes maintain strict training schedules.", "tr": "Profesyonel sporcular sıkı antrenman programlarına uyarlar."},
            {"en": "She is a gifted athlete who won two gold medals.", "tr": "İki altın madalya kazanan yetenekli bir sporcudur."},
            {"en": "Athletes need a balanced diet rich in protein.", "tr": "Sporcuların protein açısından zengin dengeli bir diyete ihtiyacı vardır."}
        ]
    },
    "attack": {
        "tr": "saldırmak, hücum etmek; saldırı",
        "ph": "/əˈtæk/",
        "pos": "v., n.",
        "ex": [
            {"en": "The wild animal attacked the campsite at night.", "tr": "Vahşi hayvan gece kamp alanına saldırdı."},
            {"en": "The team launched a rapid counter-attack.", "tr": "Takım hızlı bir karşı saldırı başlattı."},
            {"en": "He suffered a mild asthma attack during exercise.", "tr": "Egzersiz sırasında hafif bir astım atağı geçirdi."}
        ]
    },
    "attend": {
        "tr": "katılmak, devam etmek (okul/toplantı)",
        "ph": "/əˈtend/",
        "pos": "v.",
        "ex": [
            {"en": "Over one hundred delegates attended the seminar.", "tr": "Seminere yüzün üzerinde delege katıldı."},
            {"en": "She attends lectures regularly every morning.", "tr": "Her sabah derslere düzenli olarak katılıyor."},
            {"en": "Will you attend your cousin's graduation ceremony?", "tr": "Kuzeninin mezuniyet törenine katılacak mısın?"}
        ]
    },
    "attention": {
        "tr": "dikkat, ilgi, özen",
        "ph": "/əˈtenʃn/",
        "pos": "n.",
        "ex": [
            {"en": "Please pay close attention to the safety briefing.", "tr": "Lütfen güvenlik bilgilendirmesine çok dikkat edin."},
            {"en": "The shiny new gadget attracted everyone's attention.", "tr": "Parlak yeni cihaz herkesin ilgisini çekti."},
            {"en": "This important matter requires immediate attention.", "tr": "Bu önemli mesele acil ilgi / müdahale gerektiriyor."}
        ]
    },
    "audience": {
        "tr": "seyirci, dinleyici kitlesi",
        "ph": "/ˈɔːdiəns/",
        "pos": "n.",
        "ex": [
            {"en": "The audience applauded loudly at the end of the show.", "tr": "Gösterinin sonunda seyirciler coşkuyla alkışladı."},
            {"en": "The television show attracts a huge young audience.", "tr": "Televizyon programı devasa bir genç izleyici kitlesi çekiyor."},
            {"en": "The speaker engaged the audience with humorous stories.", "tr": "Konuşmacı esprili hikayelerle dinleyici kitlesinin ilgisini topladı."}
        ]
    },
    "author": {
        "tr": "yazar, eser sahibi",
        "ph": "/ˈɔːθə(r)/",
        "pos": "n.",
        "ex": [
            {"en": "The author signed copies of her bestselling book.", "tr": "Yazar, çok satan kitabının kopyalarını imzaladı."},
            {"en": "Who is your favorite classic English author?", "tr": "En sevdiğiniz klasik İngiliz yazarı kimdir?"},
            {"en": "The author explores deep philosophical themes in this novel.", "tr": "Yazar bu romanda derin felsefi temaları işliyor."}
        ]
    },
    "available": {
        "tr": "mevcut, müsait, erişilebilir",
        "ph": "/əˈveɪləbl/",
        "pos": "adj.",
        "ex": [
            {"en": "High-speed internet is available in all rooms.", "tr": "Tüm odalarda yüksek hızlı internet mevcuttur."},
            {"en": "The manager is available for meetings this afternoon.", "tr": "Müdür bu öğleden sonra toplantılar için müsaittir."},
            {"en": "Fresh organic fruits are available at the local market.", "tr": "Yerel pazarda taze organik meyveler bulunmaktadır."}
        ]
    },
    "average": {
        "tr": "ortalama, sıradan",
        "ph": "/ˈævərɪdʒ/",
        "pos": "adj., n.",
        "ex": [
            {"en": "The average temperature in July is 30 degrees.", "tr": "Temmuz ayında ortalama sıcaklık 30 derecedir."},
            {"en": "An average person needs around eight hours of sleep.", "tr": "Ortalama bir insanın yaklaşık sekiz saat uykuya ihtiyacı vardır."},
            {"en": "His test scores were well above the school average.", "tr": "Test puanları okul ortalamasının oldukça üzerindeydi."}
        ]
    },
    "award": {
        "tr": "ödül; ödüllendirmek, takdir etmek",
        "ph": "/əˈwɔːd/",
        "pos": "n., v.",
        "ex": [
            {"en": "She received an award for academic excellence.", "tr": "Akademik üstünlük / başarı ödülü aldı."},
            {"en": "The jury awarded the gold medal to the French runner.", "tr": "Jüri altın madalyayı Fransız koşucuya verdi."},
            {"en": "The annual music awards will be broadcast live tonight.", "tr": "Yıllık müzik ödülleri bu akşam canlı yayınlanacak."}
        ]
    },
    "awful": {
        "tr": "korkunç, berbat, çok kötü",
        "ph": "/ˈɔːfl/",
        "pos": "adj.",
        "ex": [
            {"en": "The weather was awful during our weekend trip.", "tr": "Hafta sonu gezimiz boyunca hava berbattı."},
            {"en": "I woke up with an awful headache this morning.", "tr": "Bu sabah korkunç bir baş ağrısıyla uyandım."},
            {"en": "The soup had an awful smell and tasted cold.", "tr": "Çorbanın berbat bir kokusu vardı ve tadı soğuktu."}
        ]
    }
}

print(f"Loaded dictionary seed with {len(DICTIONARY)} words.")
