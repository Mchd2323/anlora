export interface B2WordContent {
  sourceOrder: number;
  turkishMeaning: string;
  turkishMeanings?: string[];
  examples: { en: string; tr: string }[];
  senses?: {
    partOfSpeech?: string;
    turkishMeanings: string[];
    examples: { en: string; tr: string }[];
  }[];
}

export const B2_PART1: Record<number, B2WordContent> = {
  1: {
    sourceOrder: 1,
    turkishMeaning: "emmek, içine çekmek, özümsemek",
    turkishMeanings: ["emmek", "içine çekmek", "özümsemek"],
    examples: [
      { en: "This special cloth absorbs liquids in seconds.", tr: "Bu özel bez sıvıları saniyeler içinde emer." },
      { en: "Plants absorb nutrients and water directly from the soil.", tr: "Bitkiler besin maddelerini ve suyu doğrudan topraktan çeker." },
      { en: "It takes time to absorb so much new information at once.", tr: "Bu kadar çok yeni bilgiyi bir kerede özümsemek zaman alır." }
    ]
  },
  2: {
    sourceOrder: 2,
    turkishMeaning: "soyut, kuramsal",
    turkishMeanings: ["soyut", "kuramsal"],
    examples: [
      { en: "Beauty and freedom are abstract concepts that mean different things to everyone.", tr: "Güzellik ve özgürlük, herkese farklı anlamlar ifade eden soyut kavramlardır." },
      { en: "She prefers abstract modern art over realistic portrait paintings.", tr: "Gerçekçi portre resimleri yerine soyut modern sanatı tercih eder." },
      { en: "The research dealt with abstract mathematical theories rather than practical tools.", tr: "Araştırma, pratik araçlardan ziyade soyut matematik teorilerini ele aldı." }
    ]
  },
  3: {
    sourceOrder: 3,
    turkishMeaning: "aksan, şive, vurgu",
    turkishMeanings: ["aksan", "şive", "vurgu"],
    examples: [
      { en: "He speaks fluent English with a charming French accent.", tr: "Büyüleyici bir Fransız aksanıyla akıcı İngilizce konuşuyor." },
      { en: "Her accent immediately revealed that she grew up in Scotland.", tr: "Aksanı, İskoçya'da büyüdüğünü hemen ele verdi." },
      { en: "In this dictionary, the accent mark indicates syllable stress.", tr: "Bu sözlükte vurgu işareti hece vurgusunu gösterir." }
    ]
  },
  4: {
    sourceOrder: 4,
    turkishMeaning: "kazara, yanlışlıkla, tesadüfen",
    turkishMeanings: ["kazara", "yanlışlıkla", "tesadüfen"],
    examples: [
      { en: "I accidentally deleted the important report from my computer.", tr: "Önemli raporu bilgisayarımdan yanlışlıkla sildim." },
      { en: "She accidentally dropped her coffee cup onto the rug.", tr: "Kahve fincanını kazara halının üzerine düşürdü." },
      { en: "They met accidentally at an airport terminal after five years.", tr: "Beş yıl aradan sonra bir havaalanı terminalinde tesadüfen karşılaştılar." }
    ]
  },
  5: {
    sourceOrder: 5,
    turkishMeaning: "yer sağlamak, ağırlamak, barındırmak, uyum sağlamak",
    turkishMeanings: ["yer sağlamak", "ağırlamak", "barındırmak"],
    examples: [
      { en: "The modern conference hall can accommodate up to five hundred guests.", tr: "Modern konferans salonu beş yüz kişiye kadar misafir ağırlayabilir." },
      { en: "The hotel staff did everything possible to accommodate our special requests.", tr: "Otel personeli özel isteklerimizi karşılamak için mümkün olan her şeyi yaptı." },
      { en: "New classrooms were quickly built to accommodate growing student numbers.", tr: "Artan öğrenci sayısını barındırmak için hızla yeni sınıflar inşa edildi." }
    ]
  },
  6: {
    sourceOrder: 6,
    turkishMeaning: "başarmak, üstesinden gelmek, tamamlamak",
    turkishMeanings: ["başarmak", "üstesinden gelmek", "tamamlamak"],
    examples: [
      { en: "She worked day and night to accomplish her dream of becoming a surgeon.", tr: "Cerrah olma hayalini başarmak için gece gündüz çalıştı." },
      { en: "Working as an aligned team helped us accomplish all project milestones on time.", tr: "Uyumlu bir ekip olarak çalışmak, tüm proje aşamalarını zamanında tamamlamamıza yardımcı oldu." },
      { en: "You can accomplish great things when you stay focused and disciplined.", tr: "Odaklanmış ve disiplinli kaldığınızda harika işler başarabilirsiniz." }
    ]
  },
  7: {
    sourceOrder: 7,
    turkishMeaning: "muhasebeci, mali müşavir",
    turkishMeanings: ["muhasebeci", "mali müşavir"],
    examples: [
      { en: "Our certified accountant reviews the company tax filings every quarter.", tr: "Yeminli mali müşavirimiz şirket vergi bildirimlerini her çeyrekte inceler." },
      { en: "She works as a senior accountant for an international audit firm.", tr: "Uluslararası bir denetim firmasında kıdemli muhasebeci olarak çalışıyor." },
      { en: "You should consult an experienced accountant before investing in real estate.", tr: "Gayrimenkule yatırım yapmadan önce deneyimli bir muhasebeciye danışmalısınız." }
    ]
  },
  8: {
    sourceOrder: 8,
    turkishMeaning: "doğruluk, kesinlik, hassasiyet",
    turkishMeanings: ["doğruluk", "kesinlik", "hassasiyet"],
    examples: [
      { en: "The scientist double-checked all laboratory data to ensure absolute accuracy.", tr: "Bilim insanı, mutlak doğruluğu sağlamak için tüm laboratuvar verilerini tekrar kontrol etti." },
      { en: "High navigational accuracy is essential for safe airline transport.", tr: "Güvenli havayolu taşımacılığı için yüksek navigasyon doğruluğu şarttır." },
      { en: "We questioned the accuracy of the statistics presented in the report.", tr: "Raporda sunulan istatistiklerin doğruluğunu sorguladık." }
    ]
  },
  9: {
    sourceOrder: 9,
    turkishMeaning: "doğru bir şekilde, tam olarak, hatasızca",
    turkishMeanings: ["doğru bir şekilde", "tam olarak", "hatasızca"],
    examples: [
      { en: "The weather forecast accurately predicted heavy snowfall across the region.", tr: "Hava durumu tahmini, bölgedeki yoğun kar yağışını tam olarak doğru tahmin etti." },
      { en: "Please make sure that the financial statement accurately reflects all expenses.", tr: "Mali tablonun tüm harcamaları doğru bir şekilde yansıttığından lütfen emin olun." },
      { en: "Modern satellite sensors can accurately measure ocean surface temperatures.", tr: "Modern uydu sensörleri okyanus yüzey sıcaklıklarını hatasız bir şekilde ölçebilir." }
    ]
  },
  10: {
    sourceOrder: 10,
    turkishMeaning: "asit",
    turkishMeanings: ["asit"],
    examples: [
      { en: "Citric acid gives lemons and limes their sharp sour taste.", tr: "Sitrik asit, limon ve misket limonuna o keskin ekşi tadı verir." },
      { en: "Always wear safety gloves and goggles when handling strong hydrochloric acid.", tr: "Kuvvetli hidroklorik asitle çalışırken daima koruyucu eldiven ve gözlük takın." },
      { en: "Acid rain causes severe damage to mountain forests and freshwater lakes.", tr: "Asit yağmurları dağ ormanlarına ve tatlı su göllerine ciddi zararlar verir." }
    ]
  },
  11: {
    sourceOrder: 11,
    turkishMeaning: "etkinleştirmek, aktive etmek, çalıştırmak",
    turkishMeanings: ["etkinleştirmek", "aktive etmek", "çalıştırmak"],
    examples: [
      { en: "Click the verification link in your email to activate your new account.", tr: "Yeni hesabınızı etkinleştirmek için e-postanızdaki onay bağlantısına tıklayın." },
      { en: "Smoke detectors automatically activate the building sprinkler system.", tr: "Duman dedektörleri binanın yağmurlama sistemini otomatik olarak devreye sokar." },
      { en: "You need to call the bank to activate your new contactless debit card.", tr: "Yeni temassız banka kartınızı aktive etmek için bankayı aramanız gerekiyor." }
    ]
  },
  12: {
    sourceOrder: 12,
    turkishMeaning: "bağımlılık, tiryakilik",
    turkishMeanings: ["bağımlılık", "tiryakilik"],
    examples: [
      { en: "Smartphone addiction among teenagers has raised concerns among educators.", tr: "Gençler arasındaki akıllı telefon bağımlılığı eğitimciler arasında endişe yarattı." },
      { en: "He attended support groups to overcome his long-term gambling addiction.", tr: "Uzun süredir devam eden kumar bağımlılığının üstesinden gelmek için destek gruplarına katıldı." },
      { en: "Nicotine causes strong chemical addiction that makes quitting smoking difficult.", tr: "Nikotin, sigarayı bırakmayı zorlaştıran güçlü bir kimyasal bağımlılık yaratır." }
    ]
  },
  13: {
    sourceOrder: 13,
    turkishMeaning: "ayrıca, buna ek olarak, ilaveten",
    turkishMeanings: ["ayrıca", "buna ek olarak", "ilaveten"],
    examples: [
      { en: "Additionally, the university offers free language tutoring to exchange students.", tr: "Ayrıca üniversite, değişim öğrencilerine ücretsiz dil özel dersi sunmaktadır." },
      { en: "The hotel provides free breakfast; additionally, guests receive free gym access.", tr: "Otel ücretsiz kahvaltı sunar; buna ek olarak konuklar spor salonuna ücretsiz erişim elde eder." },
      { en: "Additionally, three new software features will be released in the upcoming update.", tr: "İlaveten, gelecek güncellemede üç yeni yazılım özelliği kullanıma sunulacak." }
    ]
  },
  14: {
    sourceOrder: 14,
    turkishMeaning: "yeterli, kafi, uygun",
    turkishMeanings: ["yeterli", "kafi", "uygun"],
    examples: [
      { en: "Make sure you get adequate sleep before the competitive exam tomorrow.", tr: "Yarınki rekabetçi sınavdan önce yeterli uyku aldığınızdan emin olun." },
      { en: "The emergency shelter had adequate food supplies for all stranded families.", tr: "Acil durum sığınağında mahsur kalan tüm aileler için yeterli gıda stoğu vardı." },
      { en: "His salary is barely adequate to cover monthly apartment rent in the capital.", tr: "Maaşı, başkentteki aylık daire kirasını karşılamaya ancak yetiyor." }
    ]
  },
  15: {
    sourceOrder: 15,
    turkishMeaning: "yeterince, layıkıyla, uygun biçimde",
    turkishMeanings: ["yeterince", "layıkıyla", "uygun biçimde"],
    examples: [
      { en: "The old library was not adequately heated during the freezing winter months.", tr: "Eski kütüphane, dondurucu kış aylarında yeterince ısıtılmıyordu." },
      { en: "Doctors warned that patients were not adequately informed about drug side effects.", tr: "Doktorlar, hastaların ilaç yan etkileri hakkında yeterince bilgilendirilmediği konusunda uyardı." },
      { en: "Ensure your luggage is adequately secured before loading it onto the roof rack.", tr: "Bagajınızı tavan taşıyıcısına yüklemeden önce layıkıyla sabitlendiğinden emin olun." }
    ]
  },
  16: {
    sourceOrder: 16,
    turkishMeaning: "ayarlamak, uyarlamak, intibak etmek",
    turkishMeanings: ["ayarlamak", "uyarlamak", "intibak etmek"],
    examples: [
      { en: "You can easily adjust the chair height by pulling the lever underneath.", tr: "Altındaki kolu çekerek sandalye yüksekliğini kolayca ayarlayabilirsiniz." },
      { en: "It took her several months to adjust to living in a vibrant foreign city.", tr: "Hareketli bir yabancı şehirde yaşamaya alışması birkaç ayını aldı." },
      { en: "The pilot had to adjust flight speed due to sudden turbulence.", tr: "Pilot, ani türbülans nedeniyle uçuş hızını ayarlamak zorunda kaldı." }
    ]
  },
  17: {
    sourceOrder: 17,
    turkishMeaning: "bütçeye uygun, hesaplı, karşılanabilir",
    turkishMeanings: ["bütçeye uygun", "hesaplı", "karşılanabilir"],
    examples: [
      { en: "Finding affordable housing in major metropolitan areas is a growing challenge.", tr: "Büyük metropol alanlarında bütçeye uygun konut bulmak giderek zorlaşan bir sorundur." },
      { en: "The brand offers stylish yet affordable clothes for young professionals.", tr: "Marka, genç profesyoneller için şık ama aynı zamanda hesaplı kıyafetler sunuyor." },
      { en: "Solar energy has become far more affordable over the past decade.", tr: "Güneş enerjisi son on yılda çok daha karşılanabilir hale geldi." }
    ]
  },
  18: {
    sourceOrder: 18,
    turkishMeaning: "tarım, ziraat",
    turkishMeanings: ["tarım", "ziraat"],
    examples: [
      { en: "Sustainable agriculture practices help protect topsoil and conserve groundwater.", tr: "Sürdürülebilir tarım uygulamaları, üst toprağı korumaya ve yeraltı suyunu muhafaza etmeye yardımcı olur." },
      { en: "Most of the rural population in the valley depends entirely on agriculture.", tr: "Vadideki kırsal nüfusun çoğu tamamen tarımla geçinmektedir." },
      { en: "Advances in smart agriculture have significantly increased crop yields.", tr: "Akıllı tarımdaki gelişmeler ürün verimliliğini önemli ölçüde artırdı." }
    ]
  },
  19: {
    sourceOrder: 19,
    turkishMeaning: "AIDS (Edinilmiş Bağışıklık Yetmezliği Sendromu)",
    turkishMeanings: ["AIDS"],
    examples: [
      { en: "Global health organizations have made huge progress in the prevention of AIDS.", tr: "Küresel sağlık örgütleri AIDS'in önlenmesinde büyük ilerleme kaydetti." },
      { en: "Modern antiretroviral therapies allow people with AIDS to live long, healthy lives.", tr: "Modern antiretroviral tedaviler, AIDS hastalarının uzun ve sağlıklı yaşamlar sürmesini sağlar." },
      { en: "Educational campaigns played a pivotal role in reducing the spread of AIDS.", tr: "Eğitici kampanyalar AIDS'in yayılmasını azaltmada hayati bir rol oynadı." }
    ]
  },
  20: {
    sourceOrder: 20,
    turkishMeaning: "uzaylı; yabancı",
    turkishMeanings: ["uzaylı", "yabancı"],
    examples: [
      { en: "The science fiction movie tells the story of friendly alien visitors on Earth.", tr: "Bilim kurgu filmi, Dünya'daki dost canlısı uzaylı ziyaretçilerin hikayesini anlatıyor." },
      { en: "Astronomers continue to search for signals that might prove alien civilizations exist.", tr: "Gökbilimciler, uzaylı medeniyetlerin varlığını kanıtlayabilecek sinyalleri aramaya devam ediyor." },
      { en: "Under local immigration law, any registered foreign national is classified as a resident alien.", tr: "Yerel göç yasasına göre, kayıtlı herhangi bir yabancı uyruklu kişi yerleşik yabancı olarak sınıflandırılır." }
    ]
  },
  21: {
    sourceOrder: 21,
    turkishMeaning: "yanında, yanı sıra, ile birlikte",
    turkishMeanings: ["yanında", "yanı sıra", "ile birlikte"],
    examples: [
      { en: "She worked alongside world-renowned researchers at the medical institute.", tr: "Tıp enstitüsünde dünyaca ünlü araştırmacıların yanında çalıştı." },
      { en: "A scenic bicycle path runs alongside the crystal-clear river.", tr: "Berrak nehrin yanı sıra manzaralı bir bisiklet yolu uzanıyor." },
      { en: "Traditional print books continue to thrive alongside digital audiobooks.", tr: "Geleneksel basılı kitaplar, dijital sesli kitaplarla birlikte varlığını sürdürmeye devam ediyor." }
    ]
  },
  22: {
    sourceOrder: 22,
    turkishMeaning: "tamamen, bütünüyle, hep beraber, toplamda",
    turkishMeanings: ["tamamen", "bütünüyle", "toplamda"],
    examples: [
      { en: "I am not altogether convinced by his explanation of what happened.", tr: "Ne olduğuna dair yaptığı açıklamaya bütünüyle ikna olmuş değilim." },
      { en: "The storm caused the outdoor festival to be cancelled altogether.", tr: "Fırtına açık hava festivalinin tamamen iptal edilmesine neden oldu." },
      { en: "Altogether, there were over three hundred volunteers helping in the relief effort.", tr: "Toplamda, yardım çalışmalarına destek veren üç yüzden fazla gönüllü vardı." }
    ]
  },
  23: {
    sourceOrder: 23,
    turkishMeaning: "cankurtaran, ambulans",
    turkishMeanings: ["ambulans", "cankurtaran"],
    examples: [
      { en: "The paramedics rushed the injured driver to the hospital in an ambulance.", tr: "Sağlık görevlileri yaralı sürücüyü ambulansla hızla hastaneye ulaştırdı." },
      { en: "Drivers immediately pulled over when they heard the loud siren of an approaching ambulance.", tr: "Sürücüler, yaklaşan ambulansın yüksek sesli sirenini duyunca hemen kenara çekti." },
      { en: "An ambulance arrived at the scene within six minutes of the emergency call.", tr: "Acil durum çağrısından sonraki altı dakika içinde olay yerine bir ambulans ulaştı." }
    ]
  },
  24: {
    sourceOrder: 24,
    turkishMeaning: "eğlenceli, komik, keyifli",
    turkishMeanings: ["eğlenceli", "komik", "keyifli"],
    examples: [
      { en: "Grandpa shared an amusing anecdote about his childhood adventures in the village.", tr: "Büyükbaba, köydeki çocukluk maceraları hakkında eğlenceli bir anı paylaştı." },
      { en: "The comedy play was filled with amusing dialogues and witty characters.", tr: "Komedi oyunu, eğlenceli diyaloglar ve hazırcevap karakterlerle doluydu." },
      { en: "I found the kitten's playful curiosity truly amusing to watch.", tr: "Yavru kedinin oyuncu merakını izlemeyi gerçekten çok keyifli buldum." }
    ]
  },
  25: {
    sourceOrder: 25,
    turkishMeaning: "analist, çözümlemeci",
    turkishMeanings: ["analist", "çözümlemeci"],
    examples: [
      { en: "A senior financial analyst predicted strong growth in renewable energy stocks.", tr: "Kıdemli bir finans analisti, yenilenebilir enerji hisselerinde güçlü bir büyüme öngördü." },
      { en: "The software security analyst identified a vulnerability in the company server.", tr: "Yazılım güvenlik analisti, şirket sunucusunda bir güvenlik açığı tespit etti." },
      { en: "Political analysts debated the long-term impact of the newly signed international treaty.", tr: "Siyasi analistler, yeni imzalanan uluslararası antlaşmanın uzun vadeli etkilerini tartıştı." }
    ]
  },
  26: {
    sourceOrder: 26,
    turkishMeaning: "ata, cet",
    turkishMeanings: ["ata", "cet"],
    examples: [
      { en: "Her ancestors migrated from Eastern Europe to North America over a century ago.", tr: "Ataları bir asırdan fazla bir süre önce Doğu Avrupa'dan Kuzey Amerika'ya göç etti." },
      { en: "Scientists study fossilized bones to understand our early human ancestors.", tr: "Bilim insanları, erken insan atalarımızı anlamak için fosilleşmiş kemikleri inceler." },
      { en: "Many cultures maintain sacred rituals to honor and remember their ancestors.", tr: "Pek çok kültür, atalarını onurlandırmak ve anmak için kutsal ritüelleri sürdürür." }
    ]
  },
  27: {
    sourceOrder: 27,
    turkishMeaning: "animasyon, canlandırma",
    turkishMeanings: ["animasyon", "canlandırma"],
    examples: [
      { en: "The animated studio used cutting-edge computer animation to create lifelike characters.", tr: "Animasyon stüdyosu, gerçeğe yakın karakterler oluşturmak için en son teknoloji bilgisayar animasyonunu kullandı." },
      { en: "Her enthusiasm and facial animation made the bedtime story captivating for the children.", tr: "Heyecanı ve yüzündeki canlılık, uyku masalını çocuklar için büyüleyici kıldı." },
      { en: "He is studying 3D character animation and digital game design at the arts academy.", tr: "Sanat akademisinde 3D karakter animasyonu ve dijital oyun tasarımı okuyor." }
    ]
  },
  28: {
    sourceOrder: 28,
    turkishMeaning: "yılda bir, her yıl, yıllık olarak",
    turkishMeanings: ["yılda bir", "her yıl", "yıllık olarak"],
    examples: [
      { en: "The prestigious literary award is presented annually at a gala dinner in London.", tr: "Prestijli edebiyat ödülü, her yıl Londra'daki bir gala yemeğinde takdim edilir." },
      { en: "Company performance and employee bonuses are reviewed annually in December.", tr: "Şirket performansı ve çalışan primleri her yıl Aralık ayında gözden geçirilir." },
      { en: "Millions of monarch butterflies migrate thousands of miles annually.", tr: "Milyonlarca kral kelebeği her yıl binlerce mil göç eder." }
    ]
  },
  29: {
    sourceOrder: 29,
    turkishMeaning: "ummak, beklemek, öngörmek",
    turkishMeanings: ["ummak", "beklemek", "öngörmek"],
    examples: [
      { en: "Economists anticipate a modest increase in consumer spending this autumn.", tr: "Ekonomistler bu sonbaharda tüketici harcamalarında ılımlı bir artış öngörüyor." },
      { en: "The event organizers did not anticipate such a massive turnout of spectators.", tr: "Etkinlik organizatörleri böylesine yoğun bir seyirci katılımı beklemiyordu." },
      { en: "We anticipate that construction on the new metro line will finish ahead of schedule.", tr: "Yeni metro hattının inşaatının planlanandan önce tamamlanacağını umuyoruz." }
    ]
  },
  30: {
    sourceOrder: 30,
    turkishMeaning: "kaygı, endişe, tasa",
    turkishMeanings: ["kaygı", "endişe", "tasa"],
    examples: [
      { en: "Deep breathing exercises helped her manage acute test anxiety before the exam.", tr: "Derin nefes egzersizleri, sınav öncesindeki yoğun sınav kaygısını yönetmesine yardımcı oldu." },
      { en: "Economic instability has caused widespread public anxiety regarding future job security.", tr: "Ekonomik istikrarsızlık, gelecekteki iş güvenliğine ilişkin yaygın toplumsal endişeye yol açtı." },
      { en: "He waited with growing anxiety beside the phone for news from the hospital.", tr: "Hastaneden gelecek bir haber için telefonun başında artan bir endişeyle bekledi." }
    ]
  },
  31: {
    sourceOrder: 31,
    turkishMeaning: "özür, af dileme",
    turkishMeanings: ["özür", "af dileme"],
    examples: [
      { en: "He offered a sincere apology for arriving late to the crucial board meeting.", tr: "Önemli yönetim kurulu toplantısına geç kaldığı için içten bir özür diledi." },
      { en: "The airline issued a public apology to passengers stranded by flight cancellations.", tr: "Havayolu şirketi, uçuş iptalleri nedeniyle mahsur kalan yolculardan kamuoyu önünde özür diledi." },
      { en: "You owe her an honest apology for misinterpreting her intentions.", tr: "Niyetini yanlış yorumladığın için ona dürüst bir özür borçlusun." }
    ]
  },
  32: {
    sourceOrder: 32,
    turkishMeaning: "başvuran kişi, aday",
    turkishMeanings: ["başvuran kişi", "aday"],
    examples: [
      { en: "Each job applicant must submit a detailed resume and two professional references.", tr: "Her iş başvurusunda bulunan kişi ayrıntılı bir özgeçmiş ve iki mesleki referans sunmalıdır." },
      { en: "Over two thousand applicants competed for only fifty available university scholarships.", tr: "Yalnızca elli kişilik üniversite bursu için iki binden fazla aday yarıştı." },
      { en: "The hiring manager was deeply impressed by the second applicant's technical credentials.", tr: "İşe alım müdürü, ikinci adayın teknik yeterliliklerinden derinden etkilendi." }
    ]
  },
  33: {
    sourceOrder: 33,
    turkishMeaning: "uygun şekilde, yerinde olarak",
    turkishMeanings: ["uygun şekilde", "yerinde olarak"],
    examples: [
      { en: "Please ensure all chemical containers are appropriately labeled and sealed.", tr: "Lütfen tüm kimyasal kapların uygun şekilde etiketlendiğinden ve mühürlendiğinden emin olun." },
      { en: "Guests are expected to dress appropriately for the formal wedding reception.", tr: "Konukların resmi düğün daveti için uygun şekilde giyinmeleri beklenmektedir." },
      { en: "The teacher responded appropriately and calmly to the student's unexpected question.", tr: "Öğretmen, öğrencinin beklenmedik sorusuna yerinde ve sakin bir şekilde yanıt verdi." }
    ]
  },
  34: {
    sourceOrder: 34,
    turkishMeaning: "ok, işaret oku",
    turkishMeanings: ["ok", "işarat oku"],
    examples: [
      { en: "Follow the green arrow on the floor to reach the main hospital exit.", tr: "Ana hastane çıkışına ulaşmak için yerdeki yeşil oku takip edin." },
      { en: "The ancient archer released the wooden arrow and struck the target dead center.", tr: "Eski okçu tahta oku fırlattı ve hedefi tam on ikiden vurdu." },
      { en: "An illuminated arrow indicates that drivers may make a protected left turn.", tr: "Işıklı bir ok, sürücülerin korumalı bir sol dönüş yapabileceğini gösterir." }
    ]
  },
  35: {
    sourceOrder: 35,
    turkishMeaning: "sanat eseri, grafik çalışma",
    turkishMeanings: ["sanat eseri", "grafik çalışma"],
    examples: [
      { en: "The national gallery houses priceless artwork from the European Renaissance.", tr: "Milli galeri, Avrupa Rönesansı'ndan kalma paha biçilmez sanat eserlerine ev sahipliği yapıyor." },
      { en: "The graphic designer sent the final album cover artwork to the print shop.", tr: "Grafik tasarımcı, son albüm kapağı çalışmasını matbaaya gönderdi." },
      { en: "Visitors were mesmerized by the intricate details of the bronze sculpture artwork.", tr: "Ziyaretçiler, bronz heykel sanat eserinin karmaşık detayları karşısında büyülendi." }
    ]
  },
  36: {
    sourceOrder: 36,
    turkishMeaning: "bir yana, bir kenara, ayrı olarak",
    turkishMeanings: ["bir yana", "bir kenara", "ayrı olarak"],
    examples: [
      { en: "Joking aside, we need to make an immediate decision regarding the budget.", tr: "Şaka bir yana, bütçe konusunda derhal bir karar vermemiz gerekiyor." },
      { en: "She stepped aside to let the hurried doctor pass through the hospital hallway.", tr: "Acelesi olan doktorun hastane koridorundan geçmesine izin vermek için bir kenara çekildi." },
      { en: "He sets aside twenty percent of his monthly earnings for emergency savings.", tr: "Aylık kazancının yüzde yirmisini acil durum birikimi için bir kenara ayırıyor." }
    ]
  },
  37: {
    sourceOrder: 37,
    turkishMeaning: "varlık, kazanç, değerli nitelik/şey",
    turkishMeanings: ["varlık", "kazanç", "değerli nitelik"],
    examples: [
      { en: "Her fluency in four languages is a tremendous asset to our international sales team.", tr: "Dört dili akıcı konuşabilmesi, uluslararası satış ekibimiz için muazzam bir kazançtır." },
      { en: "The company reported total tangible assets worth over twenty million dollars.", tr: "Şirket, yirmi milyon doların üzerinde toplam maddi varlık bildirdi." },
      { en: "Good health is arguably the most valuable asset any person can possess.", tr: "Sağlık, tartışmasız bir insanın sahip olabileceği en değerli varlıktır." }
    ]
  },
  38: {
    sourceOrder: 38,
    turkishMeaning: "atamak, görevlendirmek, paylaştırmak",
    turkishMeanings: ["atamak", "görevlendirmek", "paylaştırmak"],
    examples: [
      { en: "The manager will assign specific roles and responsibilities to each team member.", tr: "Müdür, her bir ekip üyesine belirli roller ve sorumluluklar atayacaktır." },
      { en: "The teacher assigned two chapters of the history textbook for weekend reading.", tr: "Öğretmen, hafta sonu okuması için tarih ders kitabından iki bölüm ödev verdi." },
      { en: "Security software will automatically assign a unique tracking number to each transaction.", tr: "Güvenlik yazılımı, her işleme otomatik olarak benzersiz bir takip numarası atayacaktır." }
    ]
  },
  39: {
    sourceOrder: 39,
    turkishMeaning: "yardım, destek, muavenet",
    turkishMeanings: ["yardım", "destek"],
    examples: [
      { en: "The customer service representative provided prompt assistance with our billing issue.", tr: "Müşteri hizmetleri temsilcisi, faturalandırma sorunumuzla ilgili hızlı yardım sağladı." },
      { en: "Elderly residents received financial assistance from the municipal council.", tr: "Yaşlı mahalle sakinleri belediye meclisinden maddi yardım aldı." },
      { en: "Do not hesitate to ask for technical assistance if you encounter login errors.", tr: "Giriş hatalarıyla karşılaşırsanız teknik destek istemekten çekinmeyin." }
    ]
  },
  40: {
    sourceOrder: 40,
    turkishMeaning: "varsayım, faraziye, kabul",
    turkishMeanings: ["varsayım", "faraziye"],
    examples: [
      { en: "The entire economic model was based on the false assumption of infinite market growth.", tr: "Bütün ekonomik model, sonsuz pazar büyümesi yönündeki yanlış varsayıma dayanıyordu." },
      { en: "We proceeded on the assumption that the contract had already been signed by both parties.", tr: "Sözleşmenin her iki tarafça çoktan imzalandığı varsayımıyla hareket ettik." },
      { en: "It is dangerous to make hasty assumptions without verifying the actual facts.", tr: "Gerçekleri doğrulamadan aceleci varsayımlarda bulunmak tehlikelidir." }
    ]
  },
  41: {
    sourceOrder: 41,
    turkishMeaning: "güvence vermek, temin etmek, inandırmak",
    turkishMeanings: ["güvence vermek", "temin etmek", "inandırmak"],
    examples: [
      { en: "The surgeon assured the anxious family that the operation went flawlessly.", tr: "Cerrah, endişeli aileye ameliyatın kusursuz geçtiği konusunda güvence verdi." },
      { en: "I can assure you that your confidential personal data remains completely secure.", tr: "Gizli kişisel verilerinizin tamamen güvende kaldığı konusunda sizi temin ederim." },
      { en: "The airline official assured passengers that replacement flights would depart shortly.", tr: "Havayolu yetkilisi yolculara yedek uçuşların kısa süre içinde kalkacağına dair güvence verdi." }
    ]
  },
  42: {
    sourceOrder: 42,
    turkishMeaning: "şaşırtıcı, hayret verici, akıl almaz",
    turkishMeanings: ["şaşırtıcı", "hayret verici", "akıl almaz"],
    examples: [
      { en: "The young gymnast demonstrated an astonishing level of balance and flexibility.", tr: "Genç jimnastikçi şaşırtıcı düzeyde bir denge ve esneklik sergiledi." },
      { en: "The medicine produced an astonishing recovery in less than forty-eight hours.", tr: "İlaç kırk sekiz saatten kısa bir sürede hayret verici bir iyileşme sağladı." },
      { en: "It is astonishing how much the sleepy coastal town has changed over ten years.", tr: "Sakin sahil kasabasının on yıl içinde ne kadar çok değiştiği akıl almaz bir durum." }
    ]
  },
  43: {
    sourceOrder: 43,
    turkishMeaning: "ek (dosya/posta), bağlılık, eklenti",
    turkishMeanings: ["ek (dosya)", "bağlılık", "eklenti"],
    examples: [
      { en: "Please find the revised project proposal attached in the email attachment.", tr: "Lütfen e-posta ekinde bulunan revize edilmiş proje teklifini inceleyin." },
      { en: "He felt a deep emotional attachment to his childhood home by the sea.", tr: "Deniz kenarındaki çocukluk evine derin bir duygusal bağlılık duyuyordu." },
      { en: "The vacuum cleaner comes with several specialized nozzle attachments for tight corners.", tr: "Elektrikli süpürge, dar köşeler için birkaç özel başlık eklentisiyle birlikte gelir." }
    ]
  },
  44: {
    sourceOrder: 44,
    turkishMeaning: "açık artırma, müzayede",
    turkishMeanings: ["açık artırma", "müzayede"],
    examples: [
      { en: "The rare oil painting was sold at an international art auction for millions of euros.", tr: "Nadir yağlı boya tablo, uluslararası bir sanat müzayedesinde milyonlarca avroya satıldı." },
      { en: "Bidders eagerly raised their numbered paddles during the charity antique auction.", tr: "Teklif verenler, hayır amaçlı antika açık artırmasında numaralı levhalarını heyecanla kaldırdılar." },
      { en: "The seized luxury yacht will be put up for public auction next Monday morning.", tr: "El konulan lüks yat, önümüzdeki Pazartesi sabahı kamuya açık müzayedede satışa çıkarılacak." }
    ]
  },
  45: {
    sourceOrder: 45,
    turkishMeaning: "işitsel, ses ile ilgili",
    turkishMeanings: ["işitsel", "ses ile ilgili"],
    examples: [
      { en: "The language learning app includes high-definition audio recordings of native speakers.", tr: "Dil öğrenme uygulaması, anadili konuşanların yüksek çözünürlüklü ses kayıtlarını içerir." },
      { en: "Modern classrooms are equipped with advanced audio and visual presentation equipment.", tr: "Modern sınıflar, gelişmiş ses ve görüntü sunum ekipmanlarıyla donatılmıştır." },
      { en: "She prefers listening to audio books during her long daily morning commute.", tr: "Uzun günlük sabah yolculuğu sırasında sesli kitap dinlemeyi tercih ediyor." }
    ]
  },
  46: {
    sourceOrder: 46,
    turkishMeaning: "otomatik, kendiliğinden çalışan",
    turkishMeanings: ["otomatik", "kendiliğinden çalışan"],
    examples: [
      { en: "The glass doors are automatic and open as soon as someone approaches.", tr: "Cam kapılar otomatiktir ve biri yaklaşır yaklaşmaz açılır." },
      { en: "Most modern cars feature automatic transmissions for effortless city driving.", tr: "Çoğu modern otomobil, zahmetsiz şehir içi sürüşü için otomatik vitese sahiptir." },
      { en: "The camera has an automatic focus feature that sharpens pictures instantly.", tr: "Fotoğraf makinesi, fotoğrafları anında netleştiren otomatik odaklama özelliğine sahiptir." }
    ]
  },
  47: {
    sourceOrder: 47,
    turkishMeaning: "otomatik olarak, kendiliğinden",
    turkishMeanings: ["otomatik olarak", "kendiliğinden"],
    examples: [
      { en: "Your monthly subscription fee will be deducted automatically from your credit card.", tr: "Aylık abonelik ücretiniz kredi kartınızdan otomatik olarak kesilecektir." },
      { en: "The smart thermostat automatically lowers the room temperature during the night.", tr: "Akıllı termostat, gece boyunca oda sıcaklığını kendiliğinden düşürür." },
      { en: "The word processor automatically saves a backup draft of your document every two minutes.", tr: "Kelime işlemci, belgenizin yedek taslağını her iki dakikada bir otomatik olarak kaydeder." }
    ]
  },
  48: {
    sourceOrder: 48,
    turkishMeaning: "farkındalık, bilinç",
    turkishMeanings: ["farkındalık", "bilinç"],
    examples: [
      { en: "The campaign aims to raise public awareness about the dangers of water pollution.", tr: "Kampanya, su kirliliğinin tehlikeleri hakkında kamuoyu farkındalığını artırmayı amaçlıyor." },
      { en: "Meditation and mindfulness practices help cultivate sharper self-awareness.", tr: "Meditasyon ve bilinçli farkındalık uygulamaları daha keskin bir öz farkındalık geliştirmeye yardımcı olur." },
      { en: "There is growing consumer awareness regarding ethical sourcing and fair trade.", tr: "Etik tedarik ve adil ticaret konusunda tüketicilerde artan bir bilinç var." }
    ]
  },
  49: {
    sourceOrder: 49,
    turkishMeaning: "garip, beceriksiz, rahatsız edici, sakar",
    turkishMeanings: ["garip", "rahatsız edici", "beceriksiz"],
    examples: [
      { en: "There was an awkward silence after he accidentally revealed the surprise party.", tr: "Sürpriz partiyi kazara açık ettikten sonra odada garip ve rahatsız edici bir sessizlik oldu." },
      { en: "The heavy wooden desk was extremely awkward to carry up the narrow staircase.", tr: "Ağır ahşap masayı dar merdivenlerden yukarı taşımak son derece zahmetli ve sakarcaydı." },
      { en: "He felt awkward and out of place at the formal diplomatic dinner.", tr: "Resmi diplomatik akşam yemeğinde kendini rahatsız ve ortama yabancı hissetti." }
    ]
  },
  50: {
    sourceOrder: 50,
    turkishMeaning: "rozet, kokart, kimlik kartı",
    turkishMeanings: ["rozet", "kokart", "kimlik kartı"],
    examples: [
      { en: "All event attendees must wear their identification badge at all times.", tr: "Tüm etkinlik katılımcıları kimlik rozetlerini her zaman takmalıdır." },
      { en: "The police detective flashed his silver badge before entering the building.", tr: "Polis dedektifi binaya girmeden önce gümüş rozetini gösterdi." },
      { en: "Scouts earn colorful merit badges by mastering outdoor survival skills.", tr: "İzciler, açık hava hayatta kalma becerilerinde uzmanlaşarak renkli başarı rozetleri kazanırlar." }
    ]
  },
  51: {
    sourceOrder: 51,
    turkishMeaning: "dengeli, tarafsız, ölçülü",
    turkishMeanings: ["dengeli", "tarafsız", "ölçülü"],
    examples: [
      { en: "Eating a balanced diet rich in vegetables and proteins is crucial for vitality.", tr: "Sebze ve protein açısından zengin dengeli bir beslenme, zindelik için hayati önem taşır." },
      { en: "The documentary provided a fair and balanced view of both sides of the conflict.", tr: "Belgesel, çatışmanın her iki tarafına dair adil ve dengeli bir bakış açısı sundu." },
      { en: "She strives to maintain a balanced lifestyle between demanding work and family time.", tr: "Yoğun iş hayatı ile aile zamanı arasında dengeli bir yaşam tarzı sürdürmeye gayret ediyor." }
    ]
  },
  52: {
    sourceOrder: 52,
    turkishMeaning: "bale",
    turkishMeanings: ["bale"],
    examples: [
      { en: "She has been practicing classical Russian ballet since she was five years old.", tr: "Beş yaşından beri klasik Rus balesi çalışıyor." },
      { en: "We bought front-row tickets to watch the Royal Ballet perform Swan Lake.", tr: "Kraliyet Balesi'nin Kuğu Gölü gösterisini izlemek için ön sıradan bilet aldık." },
      { en: "Ballet requires immense physical stamina, precise discipline, and grace.", tr: "Bale, muazzam bir fiziksel dayanıklılık, kusursuz disiplin ve zarafet gerektirir." }
    ]
  },
  53: {
    sourceOrder: 53,
    turkishMeaning: "balon",
    turkishMeanings: ["balon"],
    examples: [
      { en: "They decorated the birthday party room with colorful helium balloons.", tr: "Doğum günü partisi odasını renkli helyum balonlarıyla süslediler." },
      { en: "Tourists enjoyed a scenic hot air balloon flight over the valleys of Cappadocia.", tr: "Turistler, Kapadokya vadileri üzerinde manzaralı bir sıcak hava balonu uçuşunun tadını çıkardı." },
      { en: "The child cried when his shiny red balloon slipped from his hand and floated away.", tr: "Çocuk, parlak kırmızı balonu elinden kayıp gökyüzüne uçunca ağladı." }
    ]
  },
  54: {
    sourceOrder: 54,
    turkishMeaning: "zar zor, güçlükle, neredeyse hiç",
    turkishMeanings: ["zar zor", "güçlükle", "neredeyse hiç"],
    examples: [
      { en: "We could barely hear the speaker over the roar of the loud crowd.", tr: "Kalabalığın gürültüsünden konuşmacıyı zar zor duyabiliyorduk." },
      { en: "He was so exhausted that he could barely keep his eyes open on the train.", tr: "O kadar yorgundu ki trende gözlerini güçlükle açık tutabiliyordu." },
      { en: "The injured hiker had barely enough water to survive until the rescue team arrived.", tr: "Yaralı doğa yürüyüşçüsünün kurtarma ekibi gelene kadar hayatta kalmasına ancak yetecek kadar suyu vardı." }
    ]
  },
  55: {
    sourceOrder: 55,
    turkishMeaning: "kelepir, ucuzluk; pazarlık, anlaşma",
    turkishMeanings: ["kelepir", "ucuzluk", "pazarlık"],
    examples: [
      { en: "I bought this genuine leather jacket on sale; it was an absolute bargain!", tr: "Bu hakiki deri ceketi indirimden aldım; tam bir kelepirdi!" },
      { en: "The union made a collective bargaining agreement with the factory management.", tr: "Sendika, fabrika yönetimiyle toplu pazarlık anlaşması yaptı." },
      { en: "At that low price, the beachfront apartment is the bargain of the decade.", tr: "Bu düşük fiyata, o sahil dairesi on yılın en büyük fırsatıdır." }
    ]
  },
  56: {
    sourceOrder: 56,
    turkishMeaning: "bodrum katı, kiler",
    turkishMeanings: ["bodrum katı", "kiler"],
    examples: [
      { en: "We converted our dusty basement into a cozy home theater and recreation room.", tr: "Tozlu bodrum katımızı rahat bir ev sineması ve hobi odasına dönüştürdük." },
      { en: "The washing machine and water heater are located down in the basement.", tr: "Çamaşır makinesi ve su ısıtıcısı bodrum katında yer almaktadır." },
      { en: "During the severe tornado alert, the entire family took shelter in the basement.", tr: "Şiddetli hortum uyarısı sırasında tüm aile bodrum katına sığındı." }
    ]
  },
  57: {
    sourceOrder: 57,
    turkishMeaning: "sepet; pota (basketbol)",
    turkishMeanings: ["sepet", "pota"],
    examples: [
      { en: "She filled her woven wicker basket with fresh apples from the orchard.", tr: "Örgülü hasır sepetini meyve bahçesinden topladığı taze elmalarla doldurdu." },
      { en: "He scored the winning basket with only two seconds left on the game clock.", tr: "Maç saatinde sadece iki saniye kala galibiyeti getiren basketi attı." },
      { en: "Don't forget to put all dirty laundry into the bathroom clothes basket.", tr: "Tüm kirli çamaşırları banyodaki çamaşır sepetine koymayı unutmayın." }
    ]
  },
  58: {
    sourceOrder: 58,
    turkishMeaning: "yarasa; sopa/raket (kriket/beyzbol)",
    turkishMeanings: ["yarasa", "sopa"],
    examples: [
      { en: "At dusk, hundreds of nocturnal bats flew out from the entrance of the cave.", tr: "Alacakaranlıkta yüzlerce gececi yarasa mağaranın girişinden dışarı uçtu." },
      { en: "The baseball player swung his wooden bat and hit a massive home run.", tr: "Beyzbol oyuncusu tahta sopasını salladı ve muazzam bir sayı vuruşu yaptı." },
      { en: "Bats navigate effortlessly in total darkness using ultrasonic echolocation.", tr: "Yarasalar, ultrasonik ekolokasyon kullanarak zifiri karanlıkta zahmetsizce yön bulurlar." }
    ]
  },
  59: {
    sourceOrder: 59,
    turkishMeaning: "faydalı, yararlı, kazançlı",
    turkishMeanings: ["faydalı", "yararlı", "kazançlı"],
    examples: [
      { en: "Regular physical exercise is highly beneficial for cardiovascular health.", tr: "Düzenli fiziksel egzersiz kalp ve damar sağlığı için son derece faydalıdır." },
      { en: "The newly formed partnership will be mutually beneficial to both companies.", tr: "Yeni kurulan ortaklık her iki şirket için de karşılıklı olarak yararlı olacaktır." },
      { en: "Learning a second language brings numerous beneficial cognitive advantages.", tr: "İkinci bir dil öğrenmek çok sayıda faydalı zihinsel avantaj sağlar." }
    ]
  },
  60: {
    sourceOrder: 60,
    turkishMeaning: "yanında, bitişiğinde",
    turkishMeanings: ["yanında", "bitişiğinde"],
    examples: [
      { en: "She sat quietly beside her sick brother throughout the hospital night.", tr: "Gece boyunca hastanede hasta kardeşinin yanında sessizce oturdu." },
      { en: "Our summer cottage is located directly beside a scenic alpine lake.", tr: "Yazlık kulübemiz doğrudan manzaralı bir dağ gölünün yanında yer almaktadır." },
      { en: "He placed his notebook beside the laptop and began taking notes.", tr: "Defterini dizüstü bilgisayarının yanına koydu ve not almaya başladı." }
    ]
  },
  61: {
    sourceOrder: 61,
    turkishMeaning: "haricinde, dışında; ayrıca, zaten",
    turkishMeanings: ["haricinde", "dışında", "ayrıca"],
    examples: [
      { en: "Besides English and Turkish, she speaks Spanish with conversational fluency.", tr: "İngilizce ve Türkçenin dışında, günlük konuşma akıcılığında İspanyolca da konuşmaktadır." },
      { en: "I don't want to go out tonight; besides, it is raining heavily outside.", tr: "Bu gece dışarı çıkmak istemiyorum; ayrıca dışarıda şiddetli yağmur yağıyor." },
      { en: "Who was at the dinner table besides your immediate family members?", tr: "Akşam yemeği masasında çekirdek aile üyelerinizin haricinde kimler vardı?" }
    ]
  },
  62: {
    sourceOrder: 62,
    turkishMeaning: "önyargı, yanlılık, taraf tutma",
    turkishMeanings: ["önyargı", "yanlılık", "taraf tutma"],
    examples: [
      { en: "The judge was praised for remaining free of political bias during the trial.", tr: "Yargıç, duruşma sırasında siyasi önyargıdan uzak kaldığı için övgü aldı." },
      { en: "Researchers must design experiments carefully to eliminate subconscious bias.", tr: "Araştırmacılar, bilinçaltı yanlılığı ortadan kaldırmak için deneyleri dikkatle tasarlamalıdır." },
      { en: "Some critics accused the media outlet of displaying a clear commercial bias.", tr: "Bazı eleştirmenler medya kuruluşunu bariz bir ticari taraflılık sergilemekle suçladı." }
    ]
  },
  63: {
    sourceOrder: 63,
    turkishMeaning: "teklif vermek, fiyat önermek; teklif, girişim",
    turkishMeanings: ["teklif vermek", "fiyat önermek", "teklif", "girişim"],
    examples: [
      { en: "Several construction companies will bid for the prestigious public bridge contract.", tr: "Birçok inşaat firması prestijli kamu köprüsü ihalesi için teklif verecektir." },
      { en: "She placed the highest bid at the auction and secured the antique necklace.", tr: "Müzayedede en yüksek teklifi verdi ve antika kolyeyi aldı." },
      { en: "The city made a bold bid to host the upcoming Summer Olympic Games.", tr: "Şehir, yaklaşan Yaz Olimpiyat Oyunları'na ev sahipliği yapmak için cesur bir girişimde bulundu." }
    ]
  },
  64: {
    sourceOrder: 64,
    turkishMeaning: "biyolojik",
    turkishMeanings: ["biyolojik"],
    examples: [
      { en: "Researchers are studying the biological processes of aging at the cellular level.", tr: "Araştırmacılar hücresel düzeyde yaşlanmanın biyolojik süreçlerini inceliyor." },
      { en: "The child was reunited with her biological parents after many years.", tr: "Çocuk uzun yıllar sonra biyolojik ebeveynlerine kavuştu." },
      { en: "Organic farming avoids synthetic chemicals to maintain natural biological balance.", tr: "Organik tarım, doğal biyolojik dengeyi korumak için sentetik kimyasallardan kaçınır." }
    ]
  },
  65: {
    sourceOrder: 65,
    turkishMeaning: "battaniye, örtü",
    turkishMeanings: ["battaniye", "örtü"],
    examples: [
      { en: "She pulled the warm wool blanket over her shoulders on the chilly evening.", tr: "Serin akşamda sıcak yün battaniyeyi omuzlarının üzerine çekti." },
      { en: "A thick blanket of fresh snow covered the quiet mountain village overnight.", tr: "Gece boyunca taze karın kalın örtüsü sessiz dağ köyünü kapladı." },
      { en: "The airline flight attendant handed each passenger a sterilized blanket and pillow.", tr: "Uçuş görevlisi her yolcuya sterilize edilmiş bir battaniye ve yastık dağıttı." }
    ]
  },
  66: {
    sourceOrder: 66,
    turkishMeaning: "darbe, vuruş; şok, yıkım",
    turkishMeanings: ["darbe", "vuruş", "şok", "yıkım"],
    examples: [
      { en: "The sudden factory closure dealt a devastating blow to the local town economy.", tr: "Fabrikanın ani kapanışı yerel kasaba ekonomisine yıkıcı bir darbe vurdu." },
      { en: "He suffered a painful blow to his shoulder during the championship rugby match.", tr: "Şampiyonluk ragbi maçı sırasında omzuna acı verici bir darbe aldı." },
      { en: "Losing the election was a severe blow to the politician's long-term ambitions.", tr: "Seçimi kaybetmek, politikacının uzun vadeli hedeflerine ağır bir darbe oldu." }
    ]
  },
  67: {
    sourceOrder: 67,
    turkishMeaning: "cesur, cüretkar; kalın/koyu (yazı)",
    turkishMeanings: ["cesur", "cüretkar", "kalın (yazı)"],
    examples: [
      { en: "Launching a startup during an economic recession was a bold and risky move.", tr: "Ekonomik durgunluk döneminde bir girişim başlatmak cesur ve riskli bir hamleydi." },
      { en: "Key terminology and headings are highlighted in bold print in this textbook.", tr: "Bu ders kitabında anahtar terimler ve başlıklar kalın yazıyla vurgulanmıştır." },
      { en: "The interior designer used bold colors like emerald green and mustard yellow.", tr: "İç mimar, zümrüt yeşili ve hardal sarısı gibi cesur ve canlı renkler kullandı." }
    ]
  },
  68: {
    sourceOrder: 68,
    turkishMeaning: "bombalama, bombalı saldırı",
    turkishMeanings: ["bombalama", "bombalı saldırı"],
    examples: [
      { en: "The historic city center suffered heavy damage during the aerial bombing.", tr: "Tarihi şehir merkezi havadan bombalama sırasında ağır hasar gördü." },
      { en: "Emergency rescue crews worked tirelessly in the aftermath of the subway bombing.", tr: "Acil kurtarma ekipleri metro bombalamasının ardından yorulmadan çalıştı." },
      { en: "International leaders strongly condemned the brutal bombing of residential areas.", tr: "Uluslararası liderler yerleşim yerlerinin acımasızca bombalanmasını şiddetle kınadı." }
    ]
  },
  69: {
    sourceOrder: 69,
    turkishMeaning: "rezervasyon, yer ayırtma",
    turkishMeanings: ["rezervasyon", "yer ayırtma"],
    examples: [
      { en: "I received an instant confirmation email for our seaside hotel booking.", tr: "Deniz kenarındaki otel rezervasyonumuz için anında bir onay e-postası aldım." },
      { en: "Early booking is strongly recommended during the peak summer tourist season.", tr: "Yoğun yaz turizm sezonunda erken rezervasyon yapılması şiddetle tavsiye edilir." },
      { en: "The restaurant was completely full and could not accept any walk-in bookings.", tr: "Restoran tamamen doluydu ve rezervasyonsuz müşteri kabul edemiyordu." }
    ]
  },
  70: {
    sourceOrder: 70,
    turkishMeaning: "artırmak, güçlendirmek; artış, destek",
    turkishMeanings: ["artırmak", "güçlendirmek", "artış", "destek"],
    examples: [
      { en: "Regular cardiovascular workouts boost your immune system and overall energy.", tr: "Düzenli kardiyo egzersizleri bağışıklık sisteminizi ve genel enerjinizi artırır." },
      { en: "Winning the prestigious design award gave a tremendous boost to the team's morale.", tr: "Prestijli tasarım ödülünü kazanmak ekip moraline muazzam bir destek ve artış sağladı." },
      { en: "The government announced new tax incentives to boost domestic manufacturing.", tr: "Hükümet, yerli üretimi canlandırmak ve artırmak için yeni vergi teşvikleri açıkladı." }
    ]
  },
  71: {
    sourceOrder: 71,
    turkishMeaning: "kesin, kaçınılmaz; -e bağlı/yükümlü; -e giden (yolcu/araç)",
    turkishMeanings: ["kesin", "kaçınılmaz", "bağlı", "giden"],
    examples: [
      { en: "With their relentless preparation, the team is bound to win the championship.", tr: "Aralıksız hazırlıklarıyla takımın şampiyonluğu kazanması neredeyse kaçınılmazdır." },
      { en: "All licensed medical practitioners are legally bound to protect patient confidentiality.", tr: "Tüm lisanslı tıp pratisyenleri hasta gizliliğini korumakla yasal olarak yükümlüdür." },
      { en: "The express train bound for Paris will depart from platform number four.", tr: "Paris'e giden ekspres tren dört numaralı perondan hareket edecektir." }
    ]
  },
  72: {
    sourceOrder: 72,
    turkishMeaning: "tuğla",
    turkishMeanings: ["tuğla"],
    examples: [
      { en: "The historic schoolhouse was constructed from durable red clay bricks.", tr: "Tarihi okul binası dayanıklı kırmızı kil tuğlalardan inşa edilmişti." },
      { en: "Masons laid thousands of bricks to complete the garden perimeter wall.", tr: "Duvar ustaları bahçe çevre duvarını tamamlamak için binlerce tuğla ördü." },
      { en: "Exposed brick walls give the modern downtown apartment an attractive rustic feel.", tr: "Açıkta bırakılmış tuğla duvarlar, modern şehir merkezi dairesine çekici bir rustik hava katıyor." }
    ]
  },
  73: {
    sourceOrder: 73,
    turkishMeaning: "kısaca, kısa bir süre için",
    turkishMeanings: ["kısaca", "kısa bir süre için"],
    examples: [
      { en: "The director spoke briefly about the core objectives of the upcoming project.", tr: "Yönetici, yaklaşan projenin temel hedefleri hakkında kısaca konuştu." },
      { en: "We stopped briefly at a roadside cafe before continuing our long journey.", tr: "Uzun yolculuğumuza devam etmeden önce yol kenarındaki bir kafede kısa bir süre mola verdik." },
      { en: "Please explain briefly why you believe you are qualified for this leadership role.", tr: "Bu liderlik rolü için neden nitelikli olduğunuza inandığınızı lütfen kısaca açıklayın." }
    ]
  },
  74: {
    sourceOrder: 74,
    turkishMeaning: "yayıncı, televizyon/radyo kuruluşu veya sunucusu",
    turkishMeanings: ["yayıncı", "sunucu"],
    examples: [
      { en: "The public broadcaster covered the general election live throughout the night.", tr: "Kamu yayıncısı genel seçimleri gece boyunca canlı olarak aktardı." },
      { en: "He worked as a respected radio broadcaster for more than thirty distinguished years.", tr: "Otuz yılı aşkın seçkin bir süre boyunca saygın bir radyo yayıncısı olarak çalıştı." },
      { en: "International sports broadcasters paid record sums for tournament transmission rights.", tr: "Uluslararası spor yayıncıları turnuva yayın hakları için rekor meblağlar ödedi." }
    ]
  },
  75: {
    sourceOrder: 75,
    turkishMeaning: "genel olarak, geniş çapta, kabaca",
    turkishMeanings: ["genel olarak", "geniş çapta", "kabaca"],
    examples: [
      { en: "The two political parties are broadly in agreement on environmental policies.", tr: "İki siyasi parti çevre politikaları konusunda genel olarak mutabıktır." },
      { en: "Broadly speaking, modern renewable energy is becoming far cheaper than fossil fuels.", tr: "Genel olarak konuşursak, modern yenilenebilir enerji fosil yakıtlardan çok daha ucuz hale geliyor." },
      { en: "The new curriculum was broadly welcomed by educators across the country.", tr: "Yeni müfredat ülke genelindeki eğitimciler tarafından geniş çapta memnuniyetle karşılandı." }
    ]
  },
  76: {
    sourceOrder: 76,
    turkishMeaning: "böcek; yazılım hatası; gizli dinleme cihazı",
    turkishMeanings: ["böcek", "yazılım hatası", "dinleme cihazı"],
    examples: [
      { en: "The software engineer worked late into the night to fix a critical login bug.", tr: "Yazılım mühendisi kritik bir giriş hatasını düzeltmek için gece geç saatlere kadar çalıştı." },
      { en: "We sprayed organic repellent to keep annoying bugs away during the camping trip.", tr: "Kamp gezisi sırasında rahatsız edici böcekleri uzak tutmak için organik kovucu sıktık." },
      { en: "Investigators discovered a concealed audio bug hidden beneath the conference table.", tr: "Müfettişler konferans masasının altına gizlenmiş bir ses dinleme cihazı buldu." }
    ]
  },
  77: {
    sourceOrder: 77,
    turkishMeaning: "kulübe; kabin, kamara",
    turkishMeanings: ["kulübe", "kabin", "kamara"],
    examples: [
      { en: "We spent a peaceful weekend at a cozy wooden cabin in the snowy mountains.", tr: "Karlı dağlardaki şirin bir ahşap kulübede huzurlu bir hafta sonu geçirdik." },
      { en: "The aircraft cabin crew prepared passengers for a smooth landing in Zurich.", tr: "Uçak kabin ekibi yolcuları Zürih'e sorunsuz bir iniş için hazırladı." },
      { en: "The cruise ship offers spacious ocean-view cabins with private balconies.", tr: "Yolcu gemisi, özel balkonlu ve ferah okyanus manzaralı kamaralar sunmaktadır." }
    ]
  },
  78: {
    sourceOrder: 78,
    turkishMeaning: "kanal (su yolu)",
    turkishMeanings: ["kanal"],
    examples: [
      { en: "Tourists took a romantic gondola ride along the historic canals of Venice.", tr: "Turistler Venedik'in tarihi kanalları boyunca romantik bir gondol gezintisi yaptı." },
      { en: "The Panama Canal allows massive container ships to travel between two oceans.", tr: "Panama Kanalı devasa konteyner gemilerinin iki okyanus arasında geçiş yapmasını sağlar." },
      { en: "Farmers built an irrigation canal to direct fresh mountain water to their fields.", tr: "Çiftçiler, tarlalarına temiz dağ suyunu yönlendirmek için bir sulama kanalı inşa etti." }
    ]
  },
  79: {
    sourceOrder: 79,
    turkishMeaning: "mum",
    turkishMeanings: ["mum"],
    examples: [
      { en: "She lit a scented lavender candle to create a relaxing atmosphere in the room.", tr: "Odada rahatlatıcı bir atmosfer yaratmak için kokulu bir lavanta mumu yaktı." },
      { en: "When the power went out during the thunderstorm, we illuminated the house with candles.", tr: "Fırtına sırasında elektrik kesildiğinde evi mumlarla aydınlattık." },
      { en: "He blew out all twenty-five candles on his birthday cake in a single breath.", tr: "Doğum günü pastasındaki yirmi beş mumun hepsini tek bir nefeste söndürdü." }
    ]
  },
  80: {
    sourceOrder: 80,
    turkishMeaning: "karbon",
    turkishMeanings: ["karbon"],
    examples: [
      { en: "The company set an ambitious goal to achieve net-zero carbon emissions by 2035.", tr: "Şirket, 2035 yılına kadar net sıfır karbon emisyonuna ulaşmak için iddialı bir hedef koydu." },
      { en: "All organic life on Earth is based primarily on carbon molecular structures.", tr: "Dünya'daki tüm organik yaşam öncelikle karbon moleküler yapılarına dayanmaktadır." },
      { en: "Planting native trees helps capture atmospheric carbon and fight climate change.", tr: "Yerel ağaçlar dikmek, atmosferdeki karbonu tutmaya ve iklim değişikliğiyle mücadeleye yardımcı olur." }
    ]
  },
  81: {
    sourceOrder: 81,
    turkishMeaning: "gündelik, rahat; tesadüfi, gayriresmi",
    turkishMeanings: ["gündelik", "rahat", "gayriresmi"],
    examples: [
      { en: "The tech company has a relaxed casual dress code where jeans are completely acceptable.", tr: "Teknoloji şirketinin kot pantolonun gayet kabul gördüğü rahat bir gündelik giyim kuralı var." },
      { en: "They struck up a casual conversation while waiting together at the bus stop.", tr: "Otobüs durağında birlikte beklerken havadan sudan, gayriresmi bir sohbet başlattılar." },
      { en: "He took a casual glance at his wristwatch before entering the interview room.", tr: "Mülakat odasına girmeden önce kol saatine şöyle bir üstünkörü göz attı." }
    ]
  },
  82: {
    sourceOrder: 82,
    turkishMeaning: "mağara",
    turkishMeanings: ["mağara"],
    examples: [
      { en: "Archaeologists discovered ancient prehistoric paintings deep inside the limestone cave.", tr: "Arkeologlar, kireçtaşı mağarasının derinliklerinde antik tarih öncesi resimler keşfetti." },
      { en: "The lost hikers found shelter in a dry cave during the torrential downpour.", tr: "Kaybolan yürüyüşçüler şiddetli sağanak yağış sırasında kuru bir mağaraya sığındı." },
      { en: "Stalactites hung like icicles from the ceiling of the underground cave system.", tr: "Yeraltı mağara sisteminin tavanından sarkıtlar buz sarkıtları gibi sarkıyordu." }
    ]
  },
  83: {
    sourceOrder: 83,
    turkishMeaning: "kesinlik, mutlaklık",
    turkishMeanings: ["kesinlik", "mutlaklık"],
    examples: [
      { en: "There is no certainty that stock market prices will rise over the next quarter.", tr: "Gelecek çeyrekte borsa fiyatlarının yükseleceğine dair hiçbir kesinlik yoktur." },
      { en: "She knew with absolute certainty that she had made the right career choice.", tr: "Doğru kariyer seçimini yaptığını mutlak bir kesinlikle biliyordu." },
      { en: "Scientists cannot predict the exact timing of volcanic eruptions with total certainty.", tr: "Bilim insanları volkanik patlamaların kesin zamanını tam bir kesinlikle tahmin edemezler." }
    ]
  },
  84: {
    sourceOrder: 84,
    turkishMeaning: "sertifika, diploma, resmi belge",
    turkishMeanings: ["sertifika", "diploma", "resmi belge"],
    examples: [
      { en: "You will receive an accredited completion certificate upon passing the final exam.", tr: "Final sınavını geçtikten sonra akredite bir bitirme sertifikası alacaksınız." },
      { en: "Please provide an original birth certificate along with your passport application.", tr: "Lütfen pasaport başvurunuzla birlikte orijinal doğum belgenizi sunun." },
      { en: "He framed his professional medical certificate and hung it proudly in his clinic.", tr: "Mesleki tıp diplomasını çerçeveletti ve kliniğine gururla astı." }
    ]
  },
  85: {
    sourceOrder: 85,
    turkishMeaning: "zorlayıcı, çaba gerektiren, güç",
    turkishMeanings: ["zorlayıcı", "çaba gerektiren", "güç"],
    examples: [
      { en: "Leading an international research team through budget cuts was a challenging task.", tr: "Bütçe kesintileri sürecinde uluslararası bir araştırma ekibine liderlik etmek zorlayıcı bir görevdi." },
      { en: "The advanced calculus exam contained several exceptionally challenging problems.", tr: "İleri matematik sınavı son derece zorlayıcı birkaç soru içeriyordu." },
      { en: "She enjoys taking on challenging puzzles that test her analytical reasoning.", tr: "Analitik muhakemesini test eden zorlayıcı bulmacalarla uğraşmaktan keyif alır." }
    ]
  },
  86: {
    sourceOrder: 86,
    turkishMeaning: "şampiyona, şampiyonluk",
    turkishMeanings: ["şampiyona", "şampiyonluk"],
    examples: [
      { en: "Our national team qualified for the European basketball championship finals.", tr: "Milli takımımız Avrupa basketbol şampiyonası finallerine katılmaya hak kazandı." },
      { en: "Winning the world tennis championship was the greatest achievement of her career.", tr: "Dünya tenis şampiyonluğunu kazanmak kariyerinin en büyük başarısıydı." },
      { en: "Thousands of cheering fans gathered in the stadium for the championship match.", tr: "Şampiyonluk maçı için binlerce tezahürat yapan taraftar stadyumda toplandı." }
    ]
  },
  87: {
    sourceOrder: 87,
    turkishMeaning: "çekici, sevimli, büyüleyici",
    turkishMeanings: ["çekici", "sevimli", "büyüleyici"],
    examples: [
      { en: "We stayed in a charming bed-and-breakfast cottage in the English countryside.", tr: "İngiliz kırsalında şirin ve çekici bir oda-kahvaltı kulübesinde kaldık." },
      { en: "He has a charming personality that immediately puts new acquaintances at ease.", tr: "Yeni tanıştığı insanları anında rahatlatan büyüleyici ve sevimli bir kişiliği var." },
      { en: "The old town boasts charming cobblestone streets lined with artisan bakeries.", tr: "Eski şehir, butik fırınlarla çevrili sevimli arnavut kaldırımlı sokaklarıyla övünür." }
    ]
  },
  88: {
    sourceOrder: 88,
    turkishMeaning: "kovalamak, peşinden koşmak; takip, kovalama",
    turkishMeanings: ["kovalamak", "peşinden koşmak", "kovalama", "takip"],
    examples: [
      { en: "The playful dog loves to chase tennis balls across the grassy park.", tr: "Oyuncu köpek çimenlik park boyunca tenis toplarını kovalamayı çok sever." },
      { en: "Police officers gave chase when the suspected vehicle accelerated away.", tr: "Şüpheli araç hızlanıp uzaklaşınca polis memurları takibe başladı." },
      { en: "Don't spend your entire life chasing unrealistic illusions of perfection.", tr: "Bütün hayatınızı gerçekçi olmayan kusursuzluk hayallerinin peşinden koşarak harcamayın." }
    ]
  },
  89: {
    sourceOrder: 89,
    turkishMeaning: "yanak",
    turkishMeanings: ["yanak"],
    examples: [
      { en: "Her cheeks flushed bright red with embarrassment when everyone looked at her.", tr: "Herkes ona bakınca utançtan yanakları kıpkırmızı oldu." },
      { en: "Grandmother gave the smiling toddler a gentle affectionate kiss on the cheek.", tr: "Büyükanne gülen küçük çocuğun yanağına nazik ve sevgi dolu bir öpücük kondurdu." },
      { en: "Cold winter winds stung our exposed cheeks as we walked along the pier.", tr: "İskelede yürürken soğuk kış rüzgarları korumasız yanaklarımızı yaktı." }
    ]
  },
  90: {
    sourceOrder: 90,
    turkishMeaning: "tezahürat yapmak, neşelendirmek; neşe, tezahürat",
    turkishMeanings: ["tezahürat yapmak", "neşelendirmek", "tezahürat", "neşe"],
    examples: [
      { en: "The crowd cheered wildly when their hometown hero crossed the marathon finish line.", tr: "Memleketlerinin kahramanı maraton bitiş çizgisini geçince kalabalık coşkuyla tezahürat yaptı." },
      { en: "I brought warm homemade soup to cheer up my friend who was feeling sick.", tr: "Kendini hasta hisseden arkadaşımı neşelendirmek için sıcak ev yapımı çorba getirdim." },
      { en: "A loud cheer echoed through the auditorium as the graduation diplomas were handed out.", tr: "Mezuniyet diplomaları dağıtılırken salonda yüksek bir sevinç çığlığı ve tezahürat yankılandı." }
    ]
  },
  91: {
    sourceOrder: 91,
    turkishMeaning: "koro",
    turkishMeanings: ["koro"],
    examples: [
      { en: "She sings soprano in the acclaimed municipal youth choir every weekend.", tr: "Her hafta sonu beğenilen belediye gençlik korosunda soprano olarak şarkı söylüyor." },
      { en: "The cathedral choir practiced angelic Christmas carols for the midnight service.", tr: "Katedral korosu gece yarısı ayini için melek gibi Noel ilahileri çalıştı." },
      { en: "Joining a community choir is a wonderful way to meet fellow music lovers.", tr: "Bir topluluk korosuna katılmak, diğer müzikseverlerle tanışmanın harika bir yoludur." }
    ]
  },
  92: {
    sourceOrder: 92,
    turkishMeaning: "doğramak, kesmek, baltayla yarmak",
    turkishMeanings: ["doğramak", "kesmek"],
    examples: [
      { en: "Finely chop the fresh onions and garlic before adding them to the hot pan.", tr: "Taze soğan ve sarımsakları sıcak tavaya eklemeden önce ince ince doğrayın." },
      { en: "He spent the autumn afternoon chopping firewood for the living room fireplace.", tr: "Sonbahar öğleden sonrasını oturma odası şöminesi için odun kırarak geçirdi." },
      { en: "The forestry department decided to chop down diseased trees to protect the woodland.", tr: "Orman müdürlüğü ormanlık alanı korumak için hastalıklı ağaçları kesmeye karar verdi." }
    ]
  },
  93: {
    sourceOrder: 93,
    turkishMeaning: "devre (elektrik); pist, tur, parkur",
    turkishMeanings: ["devre", "pist", "parkur"],
    examples: [
      { en: "An overloaded electrical circuit caused the safety fuse in the basement to blow.", tr: "Aşırı yüklenen elektrik devresi bodrumdaki güvenlik sigortasının atmasına neden oldu." },
      { en: "Formula One drivers completed fifty laps around the challenging street circuit.", tr: "Formula 1 sürücüleri zorlu cadde pistinde elli tur tamamladı." },
      { en: "The fitness coach designed an intense circuit training workout with eight stations.", tr: "Fitness antrenörü sekiz istasyonlu yoğun bir dairesel antrenman programı tasarladı." }
    ]
  },
  94: {
    sourceOrder: 94,
    turkishMeaning: "medeniyet, uygarlık",
    turkishMeanings: ["medeniyet", "uygarlık"],
    examples: [
      { en: "The ancient Mesopotamian civilization made pioneering contributions to writing and law.", tr: "Antik Mezopotamya uygarlığı yazıya ve hukuka öncü katkılarda bulundu." },
      { en: "Clean drinking water and sanitation are fundamental pillars of modern civilization.", tr: "Temiz içme suyu ve sanitasyon modern medeniyetin temel direkleridir." },
      { en: "Historians study how climate shifts contributed to the collapse of the Mayan civilization.", tr: "Tarihçiler iklim değişikliklerinin Maya uygarlığının çöküşüne nasıl katkıda bulunduğunu inceliyor." }
    ]
  },
  95: {
    sourceOrder: 95,
    turkishMeaning: "açıklığa kavuşturmak, netleştirmek, aydınlatmak",
    turkishMeanings: ["açıklığa kavuşturmak", "netleştirmek", "aydınlatmak"],
    examples: [
      { en: "Could you please clarify the payment terms outlined in the third paragraph?", tr: "Üçüncü paragrafta belirtilen ödeme koşullarını lütfen açıklığa kavuşturabilir misiniz?" },
      { en: "The company spokesperson issued an official statement to clarify recent media rumors.", tr: "Şirket sözcüsü son medya söylentilerini netleştirmek için resmi bir açıklama yaptı." },
      { en: "The teacher used simple diagrams to clarify the complex biological cycle.", tr: "Öğretmen karmaşık biyolojik döngüyü netleştirmek için basit şemalar kullandı." }
    ]
  },
  96: {
    sourceOrder: 96,
    turkishMeaning: "sınıflandırmak, ayırmak, tasnif etmek",
    turkishMeanings: ["sınıflandırmak", "ayırmak", "tasnif etmek"],
    examples: [
      { en: "Biologists classify organisms into distinct taxonomic domains and kingdoms.", tr: "Biyologlar canlıları farklı taksonomik alanlara ve alemlere göre sınıflandırır." },
      { en: "Librarians classify incoming books according to the international Dewey system.", tr: "Kütüphaneciler yeni gelen kitapları uluslararası Dewey sistemine göre tasnif eder." },
      { en: "The government decided to classify the sensitive defense documents as top secret.", tr: "Hükümet hassas savunma belgelerini çok gizli olarak sınıflandırmaya karar verdi." }
    ]
  },
  97: {
    sourceOrder: 97,
    turkishMeaning: "katip, memur, tezgahtar",
    turkishMeanings: ["katip", "memur", "tezgahtar"],
    examples: [
      { en: "The friendly store clerk helped us locate the correct size of running shoes.", tr: "Güler yüzlü mağaza tezgahtarı doğru koşu ayakkabısı numarasını bulmamıza yardımcı oldu." },
      { en: "The municipal court clerk stamped and filed the legal paperwork carefully.", tr: "Belediye mahkemesi katibi yasal evrakları dikkatle mühürledi ve dosyaladı." },
      { en: "He began his career as an office filing clerk before rising to company director.", tr: "Kariyerine şirket direktörlüğüne yükselmeden önce bir ofis dosyalama memuru olarak başladı." }
    ]
  },
  98: {
    sourceOrder: 98,
    turkishMeaning: "uçurum, sarp kayalık, falez",
    turkishMeanings: ["uçurum", "sarp kayalık", "falez"],
    examples: [
      { en: "Dramatic white chalk cliffs tower high above the turbulent ocean waves.", tr: "Etkileyici beyaz tebeşir kayalıkları hırçın okyanus dalgalarının üzerinde yükselir." },
      { en: "Warning signs prohibit hikers from walking too close to the crumbling cliff edge.", tr: "Uyarı levhaları yürüyüşçülerin ufalanan uçurum kenarına çok yaklaşmasını yasaklamaktadır." },
      { en: "Sea eagles nest safely on the inaccessible ledges of the rocky coastal cliff.", tr: "Deniz kartalları kayalık kıyı falezinin ulaşılamaz çıkıntılarında güvenle yuva yapar." }
    ]
  },
  99: {
    sourceOrder: 99,
    turkishMeaning: "klinik, dispanser, muayenehane",
    turkishMeanings: ["klinik", "dispanser", "muayenehane"],
    examples: [
      { en: "The neighborhood medical clinic offers walk-in vaccinations and health checkups.", tr: "Mahalle tıp kliniği randevusuz aşı ve sağlık kontrolü hizmeti sunmaktadır." },
      { en: "She made an appointment at the specialized dental clinic for a root canal.", tr: "Kanal tedavisi için uzman diş kliniğinden randevu aldı." },
      { en: "The community health clinic provides free pediatric care for low-income families.", tr: "Toplum sağlığı kliniği düşük gelirli ailelere ücretsiz çocuk sağlığı hizmeti sağlamaktadır." }
    ]
  },
  100: {
    sourceOrder: 100,
    turkishMeaning: "kısa video/ses kesiti; klips, toka, ataş",
    turkishMeanings: ["video/ses kesiti", "klips", "toka", "ataş"],
    examples: [
      { en: "A viral short video clip from the interview was shared millions of times on social media.", tr: "Röportajdan alınan kısa ve viral bir video kesiti sosyal medyada milyonlarca kez paylaşıldı." },
      { en: "She fastened her stray hair neatly with a stylish silver hair clip.", tr: "Dağılan saçlarını şık bir gümüş saç tokasıyla düzgünce tutturdu." },
      { en: "Use a sturdy paper clip to keep these tax receipts neatly organized together.", tr: "Bu vergi fişlerini düzenli bir şekilde bir arada tutmak için sağlam bir ataş kullanın." }
    ]
  }
};
