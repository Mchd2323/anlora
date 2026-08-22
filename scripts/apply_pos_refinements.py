#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Curated mappings for all homograph verbs, nouns, adjectives and adverbs in Oxford 3000
"""

import json

POS_REFINEMENTS = {
    # B1 & B2 verbs
    "ox-b2-chair-v": {
        "meaning": "başkanlık etmek, oturumu yönetmek",
        "examples": [
            {"en": "She was chosen to chair the international conference.", "tr": "Uluslararası konferansa başkanlık etmek üzere seçildi."},
            {"en": "Professor Miller chaired the meeting with great efficiency.", "tr": "Profesör Miller toplantıyı büyük bir ustalıkla yönetti."},
            {"en": "Who will chair the committee in her absence?", "tr": "Onun yokluğunda komiteye kim başkanlık edecek?"}
        ]
    },
    "ox-b2-chart-v": {
        "meaning": "haritasını çıkarmak, planlamak, kaydetmek",
        "examples": [
            {"en": "The study charts the rise of global technology companies.", "tr": "Çalışma, küresel teknoloji şirketlerinin yükselişini kaydediyor."},
            {"en": "Navigators charted the unknown waters carefully.", "tr": "Gemiciler bilinmeyen suların haritasını dikkatle çıkardı."},
            {"en": "We charted the progress of each student over the year.", "tr": "Yıl boyunca her öğrencinin gelişimini kaydettik."}
        ]
    },
    "ox-b1-cool-v": {
        "meaning": "soğumak, soğutmak, sakinleşmek",
        "examples": [
            {"en": "Let the hot soup cool down before eating.", "tr": "Yemeden önce sıcak çorbanın soğumasını bekleyin."},
            {"en": "A gentle evening breeze cooled the room.", "tr": "Hafif bir akşam esintisi odayı serinletti."},
            {"en": "He took a deep breath to cool his rising temper.", "tr": "Kabaran öfkesini yatıştırmak için derin bir nefes aldı."}
        ]
    },
    "ox-b2-date-v": {
        "meaning": "tarihlendirmek; çıkmak, flört etmek",
        "examples": [
            {"en": "Archaeologists dated the ancient ruins to the 4th century.", "tr": "Arkeologlar antik kalıntıları 4. yüzyıla tarihlendirdi."},
            {"en": "They have been dating for almost three years.", "tr": "Neredeyse üç yıldır birlikteler ve flört ediyorlar."},
            {"en": "This castle dates back to the early medieval era.", "tr": "Bu kale erken ortaçağ dönemine kadar uzanmaktadır."}
        ]
    },
    "ox-b2-detail-v": {
        "meaning": "ayrıntılarıyla anlatmak, detaylandırmak",
        "examples": [
            {"en": "The annual report details all expenditures of the company.", "tr": "Yıllık rapor şirketin tüm harcamalarını ayrıntılarıyla anlatıyor."},
            {"en": "She detailed the steps needed to solve the issue.", "tr": "Sorunu çözmek için gereken adımları detaylandırdı."},
            {"en": "The contract details the terms of your employment.", "tr": "Sözleşme istihdamınızın şartlarını ayrıntılı olarak belirtir."}
        ]
    },
    "ox-b1-face-v": {
        "meaning": "yüzleşmek, karşı karşıya kalmak, dönük olmak",
        "examples": [
            {"en": "Our house faces the beautiful lake and mountains.", "tr": "Evimiz güzel göle ve dağlara bakmaktadır."},
            {"en": "The country is facing serious economic challenges.", "tr": "Ülke ciddi ekonomik zorluklarla karşı karşıya."},
            {"en": "You have to face your fears to overcome them.", "tr": "Korkularını yenmek için onlarla yüzleşmek zorundasın."}
        ]
    },
    "ox-b1-fire-v": {
        "meaning": "ateş etmek; kovmak, işten çıkarmak",
        "examples": [
            {"en": "The soldiers were ordered not to fire their weapons.", "tr": "Askerlere silahlarını ateşlememeleri emredildi."},
            {"en": "He was fired from his job for being repeatedly late.", "tr": "Sürekli geç kaldığı için işinden kovuldu."},
            {"en": "The factory fired twenty employees last month.", "tr": "Fabrika geçen ay yirmi çalışanı işten çıkardı."}
        ]
    },
    "ox-b1-hand-v": {
        "meaning": "uzatmak, elden vermek, teslim etmek",
        "examples": [
            {"en": "Please hand me that dictionary on the shelf.", "tr": "Lütfen raftaki o sözlüğü bana uzatın."},
            {"en": "Students must hand in their assignments by Friday.", "tr": "Öğrenciler ödevlerini cuma gününe kadar teslim etmelidir."},
            {"en": "She handed the keys to the new apartment owner.", "tr": "Anahtarları yeni daire sahibine elden teslim etti."}
        ]
    },
    "ox-b1-head-v": {
        "meaning": "yönelmek, gitmek; başına geçmek, yönetmek",
        "examples": [
            {"en": "We decided to head home before it started raining.", "tr": "Yağmur başlamadan önce eve doğru yönelmeye karar verdik."},
            {"en": "She was appointed to head the research department.", "tr": "Araştırma departmanının başına geçmek üzere atandı."},
            {"en": "Where are you heading this weekend?", "tr": "Bu hafta sonu nereye gidiyorsun?"}
        ]
    },
    "ox-b2-line-v": {
        "meaning": "çizgilemek, astarlamak, boyunca dizilmek",
        "examples": [
            {"en": "Thousands of excited fans lined the streets to see the parade.", "tr": "Binlerce heyecanlı taraftar geçit törenini görmek için sokaklar boyunca dizildi."},
            {"en": "The warm winter coat is lined with soft wool.", "tr": "Sıcak kışlık palto yumuşak yünle astarlanmıştır."},
            {"en": "Tall palm trees line both sides of the avenue.", "tr": "Caddenin iki yanını da uzun palmiye ağaçları sıralar."}
        ]
    },
    "ox-b2-price-v": {
        "meaning": "fiyatlandırmak, fiyat biçmek",
        "examples": [
            {"en": "The new smartphones are priced very competitively.", "tr": "Yeni akıllı telefonlar oldukça rekabetçi bir şekilde fiyatlandırıldı."},
            {"en": "All products in the boutique are clearly priced.", "tr": "Butikteki tüm ürünler net bir şekilde fiyatlandırılmıştır."},
            {"en": "They priced the handmade furniture according to the wood quality.", "tr": "El yapımı mobilyaları ahşap kalitesine göre fiyatlandırdılar."}
        ]
    },
    "ox-b2-project-v": {
        "meaning": "öngörmek, yansıtmak, tasarlamak",
        "examples": [
            {"en": "Economic analysts project a three percent growth this year.", "tr": "Ekonomi analistleri bu yıl yüzde üçlük bir büyüme öngörüyor."},
            {"en": "The slides were projected onto a large white wall.", "tr": "Slaytlar büyük beyaz bir duvara yansıtıldı."},
            {"en": "She always projects a confident and calm image.", "tr": "Her zaman kendine güvenen ve sakin bir imaj yansıtır."}
        ]
    },
    "ox-b1-result-v": {
        "meaning": "sonuçlanmak, -den kaynaklanmak (in / from)",
        "examples": [
            {"en": "Careless driving often results in serious traffic accidents.", "tr": "Dikkatsiz sürüş genellikle ciddi trafik kazalarıyla sonuçlanır."},
            {"en": "The sudden flood resulted from heavy rainfall.", "tr": "Ani sel şiddetli yağıştan kaynaklandı."},
            {"en": "Their hard work resulted in great success.", "tr": "Sıkı çalışmaları büyük bir başarıyla sonuçlandı."}
        ]
    },
    "ox-b1-rule-v": {
        "meaning": "yönetmek, hükmetmek, karar vermek",
        "examples": [
            {"en": "The wise queen ruled the prosperous kingdom for fifty years.", "tr": "Bilge kraliçe müreffeh krallığı elli yıl boyunca yönetti."},
            {"en": "The supreme court ruled that the new law was unconstitutional.", "tr": "Yüksek mahkeme yeni yasanın anayasaya aykırı olduğuna hükmetti."},
            {"en": "Nobody should rule through fear and violence.", "tr": "Hiç kimse korku ve şiddetle hükmetmemelidir."}
        ]
    },
    "ox-b1-key-v": {
        "meaning": "klavyeyle girmek, tuşlamak, ayarlamak",
        "examples": [
            {"en": "Please key in your four-digit PIN at the terminal.", "tr": "Lütfen terminalde dört haneli PIN kodunuzu tuşlayın."},
            {"en": "She keyed the patient data into the computer system.", "tr": "Hasta verilerini bilgisayar sistemine klavyeyle girdi."},
            {"en": "Key your username and password carefully.", "tr": "Kullanıcı adınızı ve şifrenizi dikkatlice girin."}
        ]
    },
    "ox-b2-map-v": {
        "meaning": "haritasını çıkarmak, haritalamak, planlamak",
        "examples": [
            {"en": "Scientists are working to map the entire human genome.", "tr": "Bilim insanları tüm insan genomunun haritasını çıkarmak için çalışıyor."},
            {"en": "We need to map out our marketing strategy for next quarter.", "tr": "Gelecek çeyrek için pazarlama stratejimizi haritalandırmamız gerekiyor."},
            {"en": "Satellites helped map the ocean floor with high precision.", "tr": "Uydular okyanus tabanının yüksek hassasiyetle haritalanmasına yardımcı oldu."}
        ]
    },
    "ox-b1-market-v": {
        "meaning": "pazarlamak, piyasaya sunmak, satmak",
        "examples": [
            {"en": "The startup is marketing a revolutionary mobile app.", "tr": "Girişim devrim niteliğinde bir mobil uygulamayı pazarlıyor."},
            {"en": "Organic foods are often marketed towards health-conscious consumers.", "tr": "Organik gıdalar genellikle sağlık bilincine sahip tüketicilere pazarlanmaktadır."},
            {"en": "They spent millions to market the new sports drink.", "tr": "Yeni spor içeceğini pazarlamak için milyonlar harcadılar."}
        ]
    },
    "ox-b2-mistake-v": {
        "meaning": "karıştırmak, yanlış anlamak, bir başkası sanmak",
        "examples": [
            {"en": "I mistook him for his twin brother because they look so similar.", "tr": "Çok benzedikleri için onu ikiz kardeşi sandım."},
            {"en": "Do not mistake my kindness for weakness.", "tr": "Nezaketimi zayıflıkla karıştırmayın."},
            {"en": "She mistook the salt for sugar while baking the cake.", "tr": "Keki pişirirken tuzu şekerle karıştırdı."}
        ]
    },
    "ox-b2-model-v": {
        "meaning": "modellik yapmak, modellemek, tasarlamak",
        "examples": [
            {"en": "She modelled clothes for top fashion designers in Paris.", "tr": "Paris'te en iyi moda tasarımcıları için kıyafet modelliği yaptı."},
            {"en": "Climate scientists model future temperature rises using supercomputers.", "tr": "İklim bilimcileri süper bilgisayarlar kullanarak gelecekteki sıcaklık artışlarını modelliyor."},
            {"en": "He modelled the character on his own grandfather.", "tr": "Karakteri kendi büyükbabasını örnek alarak tasarladı."}
        ]
    },
    "ox-b1-note-v": {
        "meaning": "not etmek, dikkat etmek, belirtmek",
        "examples": [
            {"en": "Please note that the museum is closed on Mondays.", "tr": "Müzenin pazartesi günleri kapalı olduğunu lütfen not ediniz."},
            {"en": "I noted down her phone number on a small piece of paper.", "tr": "Telefon numarasını küçük bir kâğıt parçasına not ettim."},
            {"en": "The doctor noted an improvement in the patient's condition.", "tr": "Doktor hastanın durumunda bir iyileşme olduğunu belirtti."}
        ]
    },
    "ox-b2-object-v": {
        "meaning": "itiraz etmek, karşı çıkmak",
        "examples": [
            {"en": "Several local residents objected to the construction of the highway.", "tr": "Birçok yerel sakin otoyol inşaatına itiraz etti."},
            {"en": "Do you object if I open the window for fresh air?", "tr": "Temiz hava için pencereyi açmamın bir sakıncası var mı?"},
            {"en": "The lawyer objected to the witness's misleading statement.", "tr": "Avukat tanığın yanıltıcı ifadesine itiraz etti."}
        ]
    },
    "ox-b2-picture-v": {
        "meaning": "hayal etmek, gözünün önüne getirmek, tasavvur etmek",
        "examples": [
            {"en": "I cannot picture life without my smartphone anymore.", "tr": "Artık akıllı telefonum olmadan bir hayat hayal edemiyorum."},
            {"en": "She pictured herself walking across the graduation stage.", "tr": "Kendisini mezuniyet sahnesinde yürürken gözünün önüne getirdi."},
            {"en": "Picture a serene beach with crystal clear turquoise water.", "tr": "Berrak turkuaz suyu olan huzurlu bir kumsal hayal edin."}
        ]
    },
    "ox-b1-place-v": {
        "meaning": "yerleştirmek, koymak, sipariş vermek",
        "examples": [
            {"en": "She placed the fragile glass bowl carefully on the wooden shelf.", "tr": "Kırılgan cam kaseyi ahşap rafa dikkatlice yerleştirdi."},
            {"en": "We placed an online order for the new textbooks.", "tr": "Yeni ders kitapları için internetten bir sipariş verdik."},
            {"en": "He placed his trust in his experienced colleagues.", "tr": "Deneyimli meslektaşlarına güvendi."}
        ]
    },
    "ox-b1-point-v": {
        "meaning": "işaret etmek, parmağıyla göstermek, yöneltmek",
        "examples": [
            {"en": "The guide pointed towards the snowy mountain peak.", "tr": "Rehber karlı dağ zirvesine doğru işaret etti."},
            {"en": "It is impolite to point your finger at other people.", "tr": "Parmağınızla diğer insanları göstermek kaba bir davranıştır."},
            {"en": "The compass arrow points steadily towards the north.", "tr": "Pusula oku istikrarlı bir şekilde kuzeyi gösterir."}
        ]
    },
    "ox-b1-slow-v": {
        "meaning": "yavaşlamak, yavaşlatmak (down / up)",
        "examples": [
            {"en": "You must slow down when approaching a school zone.", "tr": "Bir okul bölgesine yaklaşırken yavaşlamalısınız."},
            {"en": "The heavy snow slowed the morning city traffic significantly.", "tr": "Yoğun kar sabah şehir trafiğini önemli ölçüde yavaşlattı."},
            {"en": "Economic growth began to slow in the final quarter.", "tr": "Ekonomik büyüme son çeyrekte yavaşlamaya başladı."}
        ]
    },
    "ox-b1-spring-v": {
        "meaning": "sıçramak, fırlamak, aniden belirmek",
        "examples": [
            {"en": "The cat sprang onto the high kitchen counter in one leap.", "tr": "Kedi tek bir sıçrayışta yüksek mutfak tezgahının üzerine fırladı."},
            {"en": "Tears sprang to her eyes when she heard the touching story.", "tr": "Dokunaklı hikayeyi duyunca gözlerinden yaşlar fışkırdı."},
            {"en": "New coffee shops are springing up all over the neighborhood.", "tr": "Mahallenin dört bir yanında yeni kahveciler türüyor."}
        ]
    },
    "ox-b2-time-v": {
        "meaning": "zamanlamak, süresini ölçmek, vakit ayarlamak",
        "examples": [
            {"en": "The athlete timed his final sprint to perfection.", "tr": "Sporcu son deparını kusursuz bir şekilde zamanladı."},
            {"en": "The coach timed each runner with a precise stopwatch.", "tr": "Antrenör her koşucunun süresini hassas bir kronometreyle ölçtü."},
            {"en": "They timed the product launch for the holiday season.", "tr": "Ürün lansmanını tatil sezonu için zamanladılar."}
        ]
    },
    "ox-b2-title-v": {
        "meaning": "başlık koymak, adlandırmak, unvan vermek",
        "examples": [
            {"en": "She titled her debut novel 'Whispers in the Dark'.", "tr": "İlk romanına 'Karanlıktaki Fısıltılar' başlığını koydu."},
            {"en": "The essay was titled 'The Future of Renewable Energy'.", "tr": "Makale 'Yenilenebilir Enerjinin Geleceği' olarak adlandırıldı."},
            {"en": "He titled the oil painting after his hometown.", "tr": "Yağlı boya tablosuna memleketinin adını verdi."}
        ]
    },
    "ox-b1-type-v": {
        "meaning": "klavyede yazmak, tuşlamak",
        "examples": [
            {"en": "She can type over eighty words per minute without mistakes.", "tr": "Hatasız bir şekilde dakikada seksenin üzerinde kelime yazabilir."},
            {"en": "Please type your full name and email in the box below.", "tr": "Lütfen aşağıdaki kutuya tam adınızı ve e-postanızı yazın."},
            {"en": "He typed a quick reply to the urgent message.", "tr": "Acil mesaja hızlı bir yanıt yazdı."}
        ]
    },
    "ox-b2-challenge-v": {
        "meaning": "meydan okumak, sorgulamak, itiraz etmek",
        "examples": [
            {"en": "Scientists challenged the old theory with new empirical data.", "tr": "Bilim insanları yeni ampirik verilerle eski teoriye meydan okudu."},
            {"en": "She challenged her brother to a friendly game of chess.", "tr": "Kardeşine dostça bir satranç oyununda meydan okudu."},
            {"en": "The decision was challenged in court by environmental groups.", "tr": "Karara çevre grupları tarafından mahkemede itiraz edildi."}
        ]
    },
    "ox-b1-touch-n": {
        "meaning": "dokunuş, temas; dokunma duyusu",
        "examples": [
            {"en": "The fabric is incredibly soft to the touch.", "tr": "Kumaş dokunuşta inanılmaz derecede yumuşaktır."},
            {"en": "Please keep in touch while you are away on your trip.", "tr": "Seyahatteyken lütfen iletişimde kalın."},
            {"en": "The artist added a gentle finishing touch to the painting.", "tr": "Sanatçı tabloya nazik bir son dokunuş ekledi."}
        ]
    },
    "ox-a2-touch-xdky": {
        "meaning": "dokunmak, ellemek, temas etmek",
        "examples": [
            {"en": "Please do not touch the ancient artifacts in the museum.", "tr": "Lütfen müzedeki antik eserlere dokunmayın."},
            {"en": "Her fingers touched the cold surface of the marble table.", "tr": "Parmakları mermer masanın soğuk yüzeyine dokundu."},
            {"en": "The branches were long enough to touch the water.", "tr": "Dallar suya dokunacak kadar uzundu."}
        ]
    },
    "ox-b1-tour-v": {
        "meaning": "turneye çıkmak, gezmek, dolaşmak",
        "examples": [
            {"en": "The rock band is touring Europe throughout the summer.", "tr": "Rock grubu yaz boyunca Avrupa'yı turneyle dolaşıyor."},
            {"en": "We toured the historic castle with an expert local guide.", "tr": "Tarihi kaleyi uzman bir yerel rehberle gezdik."},
            {"en": "The theatre company tours regional schools each spring.", "tr": "Tiyatro topluluğu her bahar bölgesel okulları turneyle gezer."}
        ]
    },
    "ox-a2-tour-obbt": {
        "meaning": "tur, gezi, seyahat",
        "examples": [
            {"en": "We went on a guided walking tour of the historic old town.", "tr": "Tarihi eski kentin rehberli yürüyüş turuna katıldık."},
            {"en": "Our holiday included a two-day sightseeing tour of the city.", "tr": "Tatilimiz iki günlük bir şehir gezi turunu içeriyordu."},
            {"en": "The museum offers daily audio tours in multiple languages.", "tr": "Müze birden fazla dilde günlük sesli turlar sunmaktadır."}
        ]
    },
    "ox-b2-track-v": {
        "meaning": "takip etmek, izini sürmek, izlemek",
        "examples": [
            {"en": "You can track your package delivery online using the tracking number.", "tr": "Takip numarasını kullanarak paket teslimatınızı internetten takip edebilirsiniz."},
            {"en": "Wildlife biologists tracked the endangered wolves using satellite collars.", "tr": "Yaban hayatı biyologları nesli tükenmekte olan kurtları uydu tasmalarıyla izledi."},
            {"en": "The software tracks employee working hours automatically.", "tr": "Yazılım çalışanların çalışma saatlerini otomatik olarak takip eder."}
        ]
    },
    "ox-a2-track-7u0h": {
        "meaning": "iz, patika; koşu pisti; şarkı/parça",
        "examples": [
            {"en": "We followed a narrow dirt track through the thick forest.", "tr": "Sık ormanın içinden geçen dar bir toprak patikayı takip ettik."},
            {"en": "The athletes warmed up on the running track before the race.", "tr": "Sporcular yarıştan önce koşu pistinde ısındı."},
            {"en": "The third track on this music album is my absolute favorite.", "tr": "Bu müzik albümündeki üçüncü parça benim kesinlikle favorim."}
        ]
    },
    "ox-b1-transport-v": {
        "meaning": "taşımak, nakletmek, sevk etmek",
        "examples": [
            {"en": "Cargo planes transport perishable goods across the globe quickly.", "tr": "Kargo uçakları bozulabilir malları dünya genelinde hızla taşır."},
            {"en": "The injured hiker was transported to the hospital by helicopter.", "tr": "Yaralı doğa yürüyüşçüsü helikopterle hastaneye nakledildi."},
            {"en": "Pipelines transport fresh water to remote desert communities.", "tr": "Boru hatları uzak çöl topluluklarına tatlı su taşır."}
        ]
    },
    "ox-a2-transport-6pyo": {
        "meaning": "ulaşım, taşıma, nakliye",
        "examples": [
            {"en": "Public transport in this modern city is fast, clean, and reliable.", "tr": "Bu modern şehirde toplu taşıma hızlı, temiz ve güvenilirdir."},
            {"en": "Bicycles are an eco-friendly form of urban transport.", "tr": "Bisikletler çevre dostu bir kentsel ulaşım biçimidir."},
            {"en": "The costs of transport have risen sharply this year.", "tr": "Ulaşım maliyetleri bu yıl keskin bir şekilde arttı."}
        ]
    },
    "ox-b2-trouble-v": {
        "meaning": "zahmet vermek, rahatsız etmek, endişelendirmek",
        "examples": [
            {"en": "I am sorry to trouble you, but could you tell me the time?", "tr": "Sizi rahatsız ettiğim için özür dilerim ama saati söyleyebilir misiniz?"},
            {"en": "His chronic knee injury has been troubling him all season.", "tr": "Kronik diz sakatlığı bütün sezon boyunca onu rahatsız ediyor."},
            {"en": "Don't trouble yourself about preparing a big meal.", "tr": "Büyük bir yemek hazırlamak için kendinize zahmet vermeyin."}
        ]
    },
    "ox-a2-trouble-75lt": {
        "meaning": "sorun, sıkıntı, dert, dertli durum",
        "examples": [
            {"en": "We had a lot of trouble finding a parking spot in the centre.", "tr": "Merkezde park yeri bulmakta çok sıkıntı yaşadık."},
            {"en": "She called her close friend whenever she was in trouble.", "tr": "Başı ne zaman derde girse yakın arkadaşını arardı."},
            {"en": "Engine trouble delayed our flight by three hours.", "tr": "Motor arızası uçuşumuzu üç saat geciktirdi."}
        ]
    },
    "ox-b1-view-v": {
        "meaning": "izlemek, incelemek, değerlendirmek, bakmak",
        "examples": [
            {"en": "Thousands of people viewed the live eclipse broadcast online.", "tr": "Binlerce kişi canlı tutulma yayınını internetten izledi."},
            {"en": "Experts view the new policy as a positive step forward.", "tr": "Uzmanlar yeni politikayı ileriye doğru olumlu bir adım olarak değerlendiriyor."},
            {"en": "You can view your account balance on the mobile banking app.", "tr": "Hesap bakiyenizi mobil bankacılık uygulamasından görüntüleyebilirsiniz."}
        ]
    },
    "ox-a2-view-jxmo": {
        "meaning": "manzara, görüş, bakış açısı",
        "examples": [
            {"en": "The hotel room offers a spectacular view of the mountains.", "tr": "Otel odası muhteşem bir dağ manzarası sunmaktadır."},
            {"en": "In my view, we should invest more in renewable energy.", "tr": "Benim görüşüme göre, yenilenebilir enerjiye daha fazla yatırım yapmalıyız."},
            {"en": "The tall building blocked our view of the sunset.", "tr": "Yüksek bina gün batımı manzaramızı engelledi."}
        ]
    },
    "ox-b1-wave-v": {
        "meaning": "el sallamak; dalgalanmak",
        "examples": [
            {"en": "She smiled warmly and waved goodbye to her friends at the airport.", "tr": "Sıcak bir şekilde gülümsedi ve havaalanında arkadaşlarına el sallayarak veda etti."},
            {"en": "The national flag was waving proudly in the strong autumn breeze.", "tr": "Ulusal bayrak kuvvetli sonbahar rüzgarında gururla dalgalanıyordu."},
            {"en": "He waved his hand to catch the bus driver's attention.", "tr": "Otobüs şoförünün dikkatini çekmek için elini salladı."}
        ]
    },
    "ox-a2-wave-jh2p": {
        "meaning": "dalga (deniz/ses/ışık); el sallama",
        "examples": [
            {"en": "Surfers were riding huge ocean waves on the western coast.", "tr": "Sörfçüler batı kıyısında devasa okyanus dalgalarına biniyordu."},
            {"en": "A sudden heat wave swept across southern Europe last July.", "tr": "Geçen Temmuz ayında güney Avrupa'yı ani bir sıcak hava dalgası vurdu."},
            {"en": "She gave a friendly wave from across the street.", "tr": "Caddenin karşısından dostça bir el salladı."}
        ]
    },
    "ox-b1-while-n": {
        "meaning": "kısa bir süre, zaman, müddet",
        "examples": [
            {"en": "We sat in the quiet park and rested for a while.", "tr": "Sakin parkta oturduk ve bir süre dinlendik."},
            {"en": "I haven't seen my childhood friend in a long while.", "tr": "Çocukluk arkadaşımı uzun zamandır görmedim."},
            {"en": "It took quite a while to finish the difficult puzzle.", "tr": "Zor bulmacayı bitirmek epey bir zaman aldı."}
        ]
    },
    "ox-a2-while-3syh": {
        "meaning": "-iken, oysa, esnasında",
        "examples": [
            {"en": "I listened to relaxing music while I was studying for my exam.", "tr": "Sınavıma çalışırken dinlendirici müzik dinledim."},
            {"en": "While she likes tea, her brother always prefers coffee.", "tr": "O çay severken, erkek kardeşi her zaman kahveyi tercih eder."},
            {"en": "Be careful while crossing the busy main street.", "tr": "İşlek ana caddeyi geçerken dikkatli olun."}
        ]
    },
    "ox-b1-whole-n": {
        "meaning": "bütün, tamamı, tümü",
        "examples": [
            {"en": "Two halves make a complete whole.", "tr": "İki yarım tam bir bütün oluşturur."},
            {"en": "On the whole, the conference was a great success.", "tr": "Genel olarak, konferans büyük bir başarıydı."},
            {"en": "The museum preserves the history of the nation as a whole.", "tr": "Müze bir bütün olarak ulusun tarihini koruyor."}
        ]
    },
    "ox-a2-whole-2ulu": {
        "meaning": "bütün, tüm, tam, eksiksiz",
        "examples": [
            {"en": "He spent the whole weekend reading the new fantasy novel.", "tr": "Bütün hafta sonunu yeni fantastik romanı okuyarak geçirdi."},
            {"en": "The whole family gathered together for Thanksgiving dinner.", "tr": "Tüm aile Şükran Günü yemeği için bir araya geldi."},
            {"en": "She ate the whole apple including the peel.", "tr": "Elmayı kabuğuyla birlikte tamamen yedi."}
        ]
    },
    "ox-b1-worry-n": {
        "meaning": "endişe, kaygı, tasa",
        "examples": [
            {"en": "Financial worries can cause significant stress in daily life.", "tr": "Maddi kaygılar günlük hayatta önemli ölçüde strese neden olabilir."},
            {"en": "Her main worry was missing the final connecting train.", "tr": "En büyük endişesi son aktarma trenini kaçırmaktı."},
            {"en": "You don't have a single worry in the world right now.", "tr": "Şu anda dünyada tek bir endişen bile yok."}
        ]
    },
    "ox-a2-worry-elcs": {
        "meaning": "endişelenmek, kaygılanmak, telaşlanmak",
        "examples": [
            {"en": "Don't worry about the small details; everything will be fine.", "tr": "Küçük detaylar için endişelenme; her şey yoluna girecek."},
            {"en": "Parents often worry when their children travel alone.", "tr": "Ebeveynler çocukları tek başına seyahat ettiğinde sık sık kaygılanırlar."},
            {"en": "There is no need to worry about tomorrow's weather.", "tr": "Yarının hava durumu hakkında endişelenmeye gerek yok."}
        ]
    }
}

FILES = [
    "src/data/wordsA1.json",
    "src/data/wordsA2.json",
    "src/data/wordsB1.json",
    "src/data/wordsB2.json"
]

applied_count = 0
for fp in FILES:
    with open(fp, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    modified = False
    for item in data:
        cid = item["id"]
        if cid in POS_REFINEMENTS:
            ref = POS_REFINEMENTS[cid]
            item["turkishMeaning"] = ref["meaning"]
            item["examples"] = ref["examples"]
            applied_count += 1
            modified = True
            print("Refined:", cid, item["word"], f"({item['level']}, {item['partOfSpeech']}) -> {item['turkishMeaning']}")
    
    if modified:
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\nSuccessfully applied {applied_count} POS and sense refinements to Oxford dataset.")
