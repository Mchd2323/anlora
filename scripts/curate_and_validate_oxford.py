#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Curate, Verify and Generate High-Quality Immutable Oxford 3000 Core Dataset
"""

import json
import re
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

FILES = [
    "src/data/wordsA1.json",
    "src/data/wordsA2.json",
    "src/data/wordsB1.json",
    "src/data/wordsB2.json"
]

# Accurate senses and translations for homographs / specific POS entries
HOMOGRAPH_CORRECTIONS = {
    # bank
    "ox-a1-bank-mlu-751": {
        "meaning": "banka (finans kuruluşu)",
        "examples": [
            {"en": "I need to go to the bank to withdraw some cash.", "tr": "Biraz nakit para çekmek için bankaya gitmem gerekiyor."},
            {"en": "She works as a manager at a local bank.", "tr": "Yerel bir bankada müdür olarak çalışıyor."},
            {"en": "The bank is closed on Sundays and public holidays.", "tr": "Banka pazar günleri ve resmi tatillerde kapalıdır."}
        ]
    },
    "ox-b1-bank-n-river": {
        "meaning": "nehir kıyısı, nehir kenarı, bent",
        "examples": [
            {"en": "We sat on the grassy river bank and watched the boats.", "tr": "Çimenli nehir kıyısında oturup tekneleri izledik."},
            {"en": "Wild flowers were blooming all along the river bank.", "tr": "Nehir kıyısı boyunca kır çiçekleri açıyordu."},
            {"en": "He walked down to the bank to cast his fishing line.", "tr": "Oltasını atmak için nehir kenarına doğru yürüdü."}
        ]
    },
    # light
    "ox-a1-light-1-n": {
        "meaning": "ışık, lamba, aydınlık",
        "examples": [
            {"en": "Could you please turn on the light in the hallway?", "tr": "Koridordaki ışığı açabilir misiniz lütfen?"},
            {"en": "The morning light shone through the bedroom window.", "tr": "Sabah ışığı yatak odasının penceresinden süzüldü."},
            {"en": "A green light appeared on the control panel.", "tr": "Kontrol panelinde yeşil bir ışık belirdi."}
        ]
    },
    "ox-a2-light-adj-not-heavy": {
        "meaning": "hafif; açık (renk)",
        "examples": [
            {"en": "This suitcase is very light and easy to carry.", "tr": "Bu bavul çok hafif ve taşıması kolay."},
            {"en": "She prefers wearing light colors during the summer.", "tr": "Yaz aylarında açık renkler giymeyi tercih eder."},
            {"en": "We had a light lunch of soup and fresh salad.", "tr": "Çorba ve taze salatadan oluşan hafif bir öğle yemeği yedik."}
        ]
    },
    # bear
    "ox-a2-bear-k44m": {
        "meaning": "ayı (hayvan)",
        "examples": [
            {"en": "We saw a brown bear in the national park from a safe distance.", "tr": "Milli parkta güvenli bir mesafeden bir boz ayı gördük."},
            {"en": "Polar bears live in the freezing Arctic region.", "tr": "Kutup ayıları dondurucu Arktik bölgesinde yaşar."},
            {"en": "Bears hibernate during the cold winter months.", "tr": "Ayılar soğuk kış aylarında kış uykusuna yatar."}
        ]
    },
    "ox-b2-bear-v-deal-with": {
        "meaning": "katlanmak, dayanmak, kaldırmak",
        "examples": [
            {"en": "I can hardly bear the thought of losing my best friend.", "tr": "En iyi arkadaşımı kaybetme düşüncesine neredeyse dayanamıyorum."},
            {"en": "She couldn't bear the intense pain in her back.", "tr": "Sırtındaki şiddetli acıya dayanamıyordu."},
            {"en": "He bore the responsibility with great courage.", "tr": "Sorumluluğu büyük bir cesaretle üstlendi."}
        ]
    },
    # address
    "ox-a1-address": {
        "meaning": "adres; konuşma, nutuk",
        "examples": [
            {"en": "Please write your full home address on this form.", "tr": "Lütfen bu forma açık ev adresinizi yazın."},
            {"en": "Do you have the email address of the hiring manager?", "tr": "İşe alım müdürünün e-posta adresi sizde var mı?"},
            {"en": "I gave the taxi driver the hotel's address.", "tr": "Taksi şoförüne otelin adresini verdim."}
        ]
    },
    "ox-b2-address-v": {
        "meaning": "ele almak, hitap etmek, çözüm aramak",
        "examples": [
            {"en": "The government needs to address the housing problem urgently.", "tr": "Hükümetin konut sorununu acilen ele alması gerekiyor."},
            {"en": "The CEO addressed the employees at the annual meeting.", "tr": "Genel müdür yıllık toplantıda çalışanlara hitap etti."},
            {"en": "We must address these security concerns before the launch.", "tr": "Lansmandan önce bu güvenlik endişelerini ele almalıyız."}
        ]
    },
    # water
    "ox-a1-water": {
        "meaning": "su",
        "examples": [
            {"en": "Drink plenty of water on hot summer days.", "tr": "Sıcak yaz günlerinde bol bol su için."},
            {"en": "May I have a glass of cold water, please?", "tr": "Bir bardak soğuk su alabilir miyim, lütfen?"},
            {"en": "Boil the water before adding the pasta.", "tr": "Makarnayı eklemeden önce suyu kaynatın."}
        ]
    },
    "ox-b1-water-v": {
        "meaning": "sulamak, ıslatmak",
        "examples": [
            {"en": "Remember to water the garden flowers every evening.", "tr": "Her akşam bahçe çiçeklerini sulamayı unutma."},
            {"en": "The smell of fresh baking made my mouth water.", "tr": "Taze hamur işi kokusu ağzımı sulandırdı."},
            {"en": "Who watered the house plants while we were on holiday?", "tr": "Biz tatildeyken ev bitkilerini kim suladı?"}
        ]
    },
    # sentence
    "ox-a1-sentence-f6d-x58": {
        "meaning": "cümle",
        "examples": [
            {"en": "Write a complete sentence using each new vocabulary word.", "tr": "Her yeni kelimeyi kullanarak tam bir cümle yazın."},
            {"en": "The teacher explained the structure of the complex sentence.", "tr": "Öğretmen karmaşık cümlenin yapısını açıkladı."},
            {"en": "Can you translate the first sentence of this paragraph?", "tr": "Bu paragrafın ilk cümlesini çevirebilir misiniz?"}
        ]
    },
    "ox-b2-sentence-v": {
        "meaning": "mahkûm etmek, hapse çarptırmak",
        "examples": [
            {"en": "The judge sentenced the criminal to ten years in prison.", "tr": "Yargıç suçluyu on yıl hapis cezasına çarptırdı."},
            {"en": "He was sentenced to community service for his offence.", "tr": "İşlediği suçtan dolayı kamu hizmeti cezasına çarptırıldı."},
            {"en": "The court decided not to sentence him to prison.", "tr": "Mahkeme onu hapis cezasına çarptırmamaya karar verdi."}
        ]
    },
    # house
    "ox-a1-house": {
        "meaning": "ev, müstakil konut",
        "examples": [
            {"en": "They bought a beautiful house with a large garden.", "tr": "Büyük bahçeli güzel bir ev satın aldılar."},
            {"en": "Our grandparents live in an old stone house in the village.", "tr": "Büyükanne ve büyükbabamız köyde eski bir taş evde yaşıyor."},
            {"en": "We invited all our close neighbours to our house.", "tr": "Tüm yakın komşularımızı evimize davet ettik."}
        ]
    },
    "ox-b2-house-v": {
        "meaning": "barındırmak, ev sahipliği yapmak, içine almak",
        "examples": [
            {"en": "The historic building houses an extensive modern art collection.", "tr": "Tarihi bina geniş bir modern sanat koleksiyonuna ev sahipliği yapıyor."},
            {"en": "The shelter houses hundreds of stray animals every year.", "tr": "Barınak her yıl yüzlerce sokak hayvanını barındırıyor."},
            {"en": "This new campus can house up to five thousand students.", "tr": "Bu yeni yerleşke beş bin öğrenciye kadar barındırabilir."}
        ]
    },
    # age
    "ox-a1-age-8ema": {
        "meaning": "yaş, çağ, dönem",
        "examples": [
            {"en": "She started learning English at the age of five.", "tr": "Beş yaşında İngilizce öğrenmeye başladı."},
            {"en": "Children of all ages are welcome at the exhibition.", "tr": "Sergiye her yaştan çocuk kabul edilmektedir."},
            {"en": "We are living in a fast-paced digital age.", "tr": "Hızlı tempolu bir dijital çağda yaşıyoruz."}
        ]
    },
    "ox-b1-age-v": {
        "meaning": "yaşlanmak, olgunlaşmak, eskimek",
        "examples": [
            {"en": "Good wine improves and ages gracefully over time.", "tr": "İyi şarap zamanla olgunlaşır ve güzelleşir."},
            {"en": "Stress and lack of sleep can make people age faster.", "tr": "Stres ve uykusuzluk insanların daha hızlı yaşlanmasına neden olabilir."},
            {"en": "The actor seemed not to have aged at all in ten years.", "tr": "Oyuncu on yılda hiç yaşlanmamış gibi görünüyordu."}
        ]
    },
    # bill
    "ox-a1-bill-5e7-xx0": {
        "meaning": "fatura, hesap",
        "examples": [
            {"en": "Can we have the bill, please? We are ready to pay.", "tr": "Hesabı alabilir miyiz lütfen? Ödemeye hazırız."},
            {"en": "I paid the electricity bill online yesterday morning.", "tr": "Elektrik faturasını dün sabah internetten ödedim."},
            {"en": "Our monthly grocery bill has increased significantly.", "tr": "Aylık market faturamız önemli ölçüde arttı."}
        ]
    },
    "ox-b2-bill-v": {
        "meaning": "faturalandırmak, hesap çıkarmak",
        "examples": [
            {"en": "The hotel billed us for the extra phone calls.", "tr": "Otel fazladan telefon görüşmeleri için bize fatura çıkardı."},
            {"en": "Clients will be billed at the end of each calendar month.", "tr": "Müşterilere her takvim ayının sonunda fatura kesilecektir."},
            {"en": "They were billed for the repair costs after the accident.", "tr": "Kazadan sonra tamir masrafları onlara fatura edildi."}
        ]
    },
    # but
    "ox-a1-but-s9s-7tf": {
        "meaning": "ama, fakat, lakin",
        "examples": [
            {"en": "I wanted to go to the party, but I was too tired.", "tr": "Partiye gitmek istedim ama çok yorgundum."},
            {"en": "He studied hard for the test, but didn't pass.", "tr": "Sınav için çok çalıştı fakat geçemedi."},
            {"en": "It is raining outside, but it is not very cold.", "tr": "Dışarıda yağmur yağıyor ama hava çok soğuk değil."}
        ]
    },
    "ox-b2-but-prep": {
        "meaning": "hariç, dışında, başka",
        "examples": [
            {"en": "Everyone in the class attended the lecture but Sarah.", "tr": "Sarah hariç sınıftaki herkes derse katıldı."},
            {"en": "There was nothing left in the fridge but some milk.", "tr": "Buzdolabında biraz süt dışında hiçbir şey kalmamıştı."},
            {"en": "The proposal was accepted by all board members but one.", "tr": "Teklif biri dışında tüm yönetim kurulu üyeleri tarafından kabul edildi."}
        ]
    },
    # by
    "ox-a1-by-s9s-5w4": {
        "meaning": "tarafından, yanında, vasıtasıyla",
        "examples": [
            {"en": "This famous novel was written by a British author.", "tr": "Bu ünlü roman bir İngiliz yazar tarafından yazıldı."},
            {"en": "We sat by the warm fireplace on a cold evening.", "tr": "Soğuk bir akşamda sıcak şöminenin yanında oturduk."},
            {"en": "She usually travels to the office by bus.", "tr": "Ofise genellikle otobüsle gider."}
        ]
    },
    "ox-b1-by-adv": {
        "meaning": "yanından, yakınından; kenara, bir yana",
        "examples": [
            {"en": "A police car drove by at high speed.", "tr": "Bir polis arabası yüksek hızla yanımızdan geçip gitti."},
            {"en": "As the years went by, they became closer friends.", "tr": "Yıllar geçtikçe daha yakın arkadaş oldular."},
            {"en": "She walked by without noticing me in the crowd.", "tr": "Kalabalıkta beni fark etmeden yanımdan geçip gitti."}
        ]
    },
    # centre
    "ox-a1-centre-d34-arq": {
        "meaning": "merkez, orta nokta, tesis",
        "examples": [
            {"en": "Our new office is located right in the city centre.", "tr": "Yeni ofisimiz tam şehir merkezinde yer alıyor."},
            {"en": "They exercise at the local sports centre every weekend.", "tr": "Her hafta sonu yerel spor merkezinde egzersiz yaparlar."},
            {"en": "Put the round vase in the centre of the dining table.", "tr": "Yuvarlak vazoyu yemek masasının ortasına koyun."}
        ]
    },
    "ox-b1-centre-v": {
        "meaning": "merkeze almak, odaklamak, etrafında dönmek",
        "examples": [
            {"en": "The whole debate centred on how to reduce costs.", "tr": "Tüm tartışma maliyetlerin nasıl düşürüleceği üzerine odaklandı."},
            {"en": "Her entire life centres around her children and family.", "tr": "Tüm hayatı çocukları ve ailesinin etrafında dönüyor."},
            {"en": "The research centres on renewable energy solutions.", "tr": "Araştırma yenilenebilir enerji çözümlerini merkeze alıyor."}
        ]
    },
    # close
    "ox-a1-close--shut--aax": {
        "meaning": "kapatmak, kapanmak",
        "examples": [
            {"en": "Please close the door quietly when you leave.", "tr": "Çıkarken lütfen kapıyı sessizce kapatın."},
            {"en": "The grocery store closes at nine o'clock every evening.", "tr": "Bakkal her akşam saat dokuzda kapanır."},
            {"en": "He closed his eyes and tried to fall asleep.", "tr": "Gözlerini kapattı ve uyumaya çalıştı."}
        ]
    },
    "ox-a1-close--not-far--1p6": {
        "meaning": "yakın, bitişik; sıkı (ilişki)",
        "examples": [
            {"en": "Our school is very close to the central train station.", "tr": "Okulumuz merkez tren istasyonuna çok yakındır."},
            {"en": "She is one of my closest and most trusted friends.", "tr": "O benim en yakın ve en güvendiğim arkadaşlarımdan biridir."},
            {"en": "Pay close attention to these safety instructions.", "tr": "Bu güvenlik talimatlarına çok dikkat edin."}
        ]
    },
    "ox-b1-close-adv": {
        "meaning": "yakından, bitişiğinde, yakın",
        "examples": [
            {"en": "Stay close to me so we don't lose each other in the crowd.", "tr": "Kalabalıkta birbirimizi kaybetmemek için bana yakın dur."},
            {"en": "The bus followed close behind the red truck.", "tr": "Otobüs kırmızı kamyonun hemen arkasından yakından takip etti."},
            {"en": "Don't sit too close to the television screen.", "tr": "Televizyon ekranına çok yakın oturmayın."}
        ]
    },
    "ox-b2-close-n": {
        "meaning": "son, kapanış, bitiş",
        "examples": [
            {"en": "The meeting drew to a peaceful close around five o'clock.", "tr": "Toplantı saat beş sularında huzurlu bir şekilde sona erdi."},
            {"en": "The festival was brought to a close with a spectacular fireworks display.", "tr": "Festival muhteşem bir havai fişek gösterisiyle sonlandırıldı."},
            {"en": "At the close of trading, stock prices were slightly higher.", "tr": "İşlem gününün kapanışında hisse senedi fiyatları biraz daha yüksekti."}
        ]
    },
    # ship
    "ox-a2-ship-nr6b": {
        "meaning": "gemi, büyük vapur",
        "examples": [
            {"en": "A huge cargo ship entered the busy harbor this morning.", "tr": "Bu sabah yoğun limana devasa bir yük gemisi girdi."},
            {"en": "We spent a week travelling on a luxury cruise ship.", "tr": "Lüks bir yolcu gemisinde seyahat ederek bir hafta geçirdik."},
            {"en": "The ship sailed smoothly across the calm ocean.", "tr": "Gemi sakin okyanusta sükunetle yol aldı."}
        ]
    },
    "ox-b2-ship-v": {
        "meaning": "sevk etmek, kargolamak, göndermek",
        "examples": [
            {"en": "Your order will be shipped within twenty-four hours of payment.", "tr": "Siparişiniz ödemeden sonraki yirmi dört saat içinde kargolanacaktır."},
            {"en": "The company ships products to over fifty countries worldwide.", "tr": "Şirket dünya çapında elliden fazla ülkeye ürün sevk etmektedir."},
            {"en": "All items were carefully packed before being shipped.", "tr": "Tüm eşyalar kargoya verilmeden önce özenle paketlendi."}
        ]
    },
    # wind
    "ox-a2-wind-149o": {
        "meaning": "rüzgar, esinti",
        "examples": [
            {"en": "A cold winter wind was blowing fiercely through the trees.", "tr": "Ağaçların arasından şiddetli ve soğuk bir kış rüzgarı esiyordu."},
            {"en": "The strong wind blew my umbrella inside out.", "tr": "Kuvvetli rüzgar şemsiyemi ters yüz etti."},
            {"en": "There was hardly any wind on that quiet summer afternoon.", "tr": "O sakin yaz öğleden sonrasında neredeyse hiç rüzgar yoktu."}
        ]
    },
    "ox-b2-wind-v": {
        "meaning": "sarmak, dolamak; kıvrılmak",
        "examples": [
            {"en": "The narrow mountain road winds through dense green forests.", "tr": "Dar dağ yolu sık yeşil ormanların arasından kıvrılarak geçer."},
            {"en": "Remember to wind your mechanical watch every morning.", "tr": "Mekanik saatinizi her sabah kurmayı unutmayın."},
            {"en": "She wound the woolen scarf warmly around her neck.", "tr": "Yün atkıyı boynuna sıcacık doladı."}
        ]
    },
    # tear
    "ox-b2-tear-v-n": {
        "meaning": "yırtmak, koparmak; yırtık",
        "examples": [
            {"en": "Be very careful not to tear the fragile old manuscript.", "tr": "Kırılgan eski el yazmasını yırtmamaya çok dikkat edin."},
            {"en": "He accidentally tore a hole in the sleeve of his new jacket.", "tr": "Yanlışlıkla yeni ceketinin kolunda bir delik yırttı."},
            {"en": "Tear the paper into small pieces before recycling it.", "tr": "Geri dönüştürmeden önce kâğıdı küçük parçalara ayırın."}
        ]
    },
    "ox-b2-tear-n": {
        "meaning": "gözyaşı",
        "examples": [
            {"en": "Tears of joy rolled gently down her cheeks when she heard the news.", "tr": "Haberi duyduğunda yanaklarından sevinç gözyaşları süzüldü."},
            {"en": "She wiped away her tears and smiled bravely at her family.", "tr": "Gözyaşlarını sildi ve ailesine cesurca gülümsedi."},
            {"en": "He was moved to tears by the heartfelt musical performance.", "tr": "İçten müzik performansı karşısında gözyaşlarına boğuldu."}
        ]
    },
    # trip
    "ox-a1-trip-f8e-d9q": {
        "meaning": "gezi, yolculuk, seyahat",
        "examples": [
            {"en": "We went on a weekend school trip to the science museum.", "tr": "Bilim müzesine hafta sonu okul gezisine gittik."},
            {"en": "How was your business trip to Germany last week?", "tr": "Geçen haftaki Almanya iş seyahatiniz nasıl geçti?"},
            {"en": "Have a safe and enjoyable trip back home!", "tr": "Eve dönüşte güvenli ve keyifli bir yolculuk dilerim!"}
        ]
    },
    "ox-b2-trip-v": {
        "meaning": "tökezlemek, ayağı takılmak",
        "examples": [
            {"en": "He tripped over a loose tree root and fell onto the grass.", "tr": "Gevşek bir ağaç köküne takılıp tökezledi ve çimlerin üzerine düştü."},
            {"en": "Mind the high doorstep so you don't trip and hurt yourself.", "tr": "Tökezleyip bir yerinizi incitmemek için yüksek kapı eşiğine dikkat edin."},
            {"en": "She tripped while running down the steep concrete stairs.", "tr": "Dik beton merdivenlerden aşağı koşarken ayağı takıldı."}
        ]
    }
}

print(f"Loaded {len(HOMOGRAPH_CORRECTIONS)} high-priority homograph corrections.")
