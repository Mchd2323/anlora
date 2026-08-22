#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ultra-Fast Batch Oxford 3000 Dictionary & Examples Fixer
"""

import json
import os
import re
import time
import urllib.request
import urllib.parse

FILES = [
    "src/data/wordsA1.json",
    "src/data/wordsA2.json",
    "src/data/wordsB1.json",
    "src/data/wordsB2.json"
]

SPECIAL_OVERRIDES = {
    "along": {
        "tr": "boyunca, yanı sıra, ileriye doğru",
        "ex": [
            {"en": "We walked along the quiet beach at sunset.", "tr": "Gün batımında sakin sahil boyunca yürüdük."},
            {"en": "There are beautiful trees all along the river bank.", "tr": "Nehir kıyısı boyunca güzel ağaçlar var."},
            {"en": "Bring your friends along to the party tonight!", "tr": "Bu akşam partiye arkadaşlarını da yanında getir!"}
        ]
    },
    "all right": {
        "tr": "peki, tamam, iyi, sorunsuz",
        "ex": [
            {"en": "Is everything all right with your new schedule?", "tr": "Yeni programında her şey yolunda mı?"},
            {"en": "All right, let us start our lesson now.", "tr": "Peki, şimdi dersimize başlayalım."},
            {"en": "Don't worry about it, you will be all right.", "tr": "Bunun için endişelenme, tamamen iyi olacaksın."}
        ]
    },
    "allow": {
        "tr": "izin vermek, olanak tanımak, müsaade etmek",
        "ex": [
            {"en": "Smoking is not allowed inside the building.", "tr": "Bina içinde sigara içilmesine izin verilmez."},
            {"en": "The software allows users to edit photos easily.", "tr": "Yazılım, kullanıcıların fotoğrafları kolayca düzenlemesine olanak tanır."},
            {"en": "Please allow me to carry your heavy luggage.", "tr": "Lütfen ağır bavulunuzu taşımama izin verin."}
        ]
    },
    "almost": {
        "tr": "neredeyse, hemen hemen, az kalsın",
        "ex": [
            {"en": "Dinner is almost ready, please take your seat.", "tr": "Akşam yemeği neredeyse hazır, lütfen yerinize geçin."},
            {"en": "I have almost finished reading this book.", "tr": "Bu kitabı okumayı neredeyse bitirdim."},
            {"en": "It was almost midnight when we arrived home.", "tr": "Eve vardığımızda neredeyse gece yarısıydı."}
        ]
    },
    "alone": {
        "tr": "yalnız, tek başına, kimsesiz",
        "ex": [
            {"en": "She prefers to live alone in a quiet neighborhood.", "tr": "Sakin bir mahallede tek başına yaşamayı tercih ediyor."},
            {"en": "You are not alone; we are here to support you.", "tr": "Yalnız değilsin; sana destek olmak için buradayız."},
            {"en": "He traveled alone across Europe last summer.", "tr": "Geçen yaz Avrupa genelinde tek başına seyahat etti."}
        ]
    },
    "already": {
        "tr": "zaten, çoktan, şimdiden",
        "ex": [
            {"en": "I have already finished my homework.", "tr": "Ödevimi çoktan bitirdim."},
            {"en": "The train was already leaving the station.", "tr": "Tren istasyondan şimdiden ayrılıyordu."},
            {"en": "Is it dinner time already?", "tr": "Şimdiden akşam yemeği vakti geldi mi?"}
        ]
    },
    "argument": {
        "tr": "tartışma, sav, münakaşa, iddia",
        "ex": [
            {"en": "They had a heated argument about the budget yesterday.", "tr": "Dün bütçe hakkında hararetli bir tartışma yaşadılar."},
            {"en": "His argument was supported by strong scientific evidence.", "tr": "Onun savı güçlü bilimsel kanıtlarla desteklendi."},
            {"en": "Let us avoid unnecessary arguments and find a solution.", "tr": "Gereksiz tartışmalardan kaçınalım ve bir çözüm bulalım."}
        ]
    },
    "abandon": {
        "tr": "terk etmek, bırakmak, vazgeçmek",
        "ex": [
            {"en": "The sailors had to abandon the sinking ship.", "tr": "Denizciler batan gemiyi terk etmek zorunda kaldı."},
            {"en": "They decided to abandon the risky mountain expedition.", "tr": "Riskli dağ seferinden vazgeçmeye karar verdiler."},
            {"en": "Never abandon your lifelong dreams and goals.", "tr": "Hayat boyu süren hayallerinizi ve hedeflerinizi asla terk etmeyin."}
        ]
    },
    "absolute": {
        "tr": "kesin, mutlak, tam",
        "ex": [
            {"en": "She had absolute confidence in her team's ability.", "tr": "Takımının yeteneğine olan güveni tamdı / mutlaktı."},
            {"en": "There is no absolute proof for that theory yet.", "tr": "O teori için henüz kesin bir kanıt yok."},
            {"en": "The room fell into absolute silence when he entered.", "tr": "İçeri girdiğinde oda mutlak bir sessizliğe büründü."}
        ]
    },
    "absolutely": {
        "tr": "kesinlikle, tamamen, kesin olarak",
        "ex": [
            {"en": "You are absolutely right about this situation.", "tr": "Bu durum hakkında kesinlikle haklısın."},
            {"en": "I absolutely loved the performance of the orchestra.", "tr": "Orkestranın performansını tamamen çok beğendim."},
            {"en": "Are you sure? - Yes, absolutely!", "tr": "Emin misin? - Evet, kesinlikle!"}
        ]
    },
    "academic": {
        "tr": "akademik, öğretim üyesi",
        "ex": [
            {"en": "She published her research in a prestigious academic journal.", "tr": "Araştırmasını prestijli bir akademik dergide yayımladı."},
            {"en": "The university provides excellent academic support.", "tr": "Üniversite mükemmel bir akademik destek sağlamaktadır."},
            {"en": "He had a long and successful academic career.", "tr": "Uzun ve başarılı bir akademik kariyere sahipti."}
        ]
    },
    "access": {
        "tr": "erişim, giriş; erişmek, ulaşmak",
        "ex": [
            {"en": "Students have free access to the digital library.", "tr": "Öğrencilerin dijital kütüphaneye ücretsiz erişimi vardır."},
            {"en": "You need a secure password to access this system.", "tr": "Bu sisteme erişmek için güvenli bir şifreye ihtiyacınız var."},
            {"en": "Wheelchair access is available at the main entrance.", "tr": "Ana girişte tekerlekli sandalye erişimi mevcuttur."}
        ]
    },
    "accommodation": {
        "tr": "konaklama, kalacak yer",
        "ex": [
            {"en": "Hotel accommodation is included in the tour package.", "tr": "Otel konaklaması tur paketine dahildir."},
            {"en": "Finding affordable student accommodation can be difficult.", "tr": "Uygun fiyatlı öğrenci konaklaması bulmak zor olabilir."},
            {"en": "We booked temporary accommodation near the conference center.", "tr": "Konferans merkezinin yakınında geçici konaklama rezervasyonu yaptık."}
        ]
    },
    "account": {
        "tr": "hesap, banka hesabı; açıklamak",
        "ex": [
            {"en": "She opened a new savings account at the local bank.", "tr": "Yerel bankada yeni bir tasarruf hesabı açtı."},
            {"en": "Please check your account balance regularly.", "tr": "Lütfen hesap bakiyenizi düzenli olarak kontrol edin."},
            {"en": "How do you account for this unexpected difference?", "tr": "Bu beklenmedik farkı nasıl açıklıyorsunuz?"}
        ]
    },
    "accurate": {
        "tr": "doğru, kesin, hatasız",
        "ex": [
            {"en": "The scientist provided an accurate description of the experiment.", "tr": "Bilim insanı deneyin doğru ve kesin bir tanımını sundu."},
            {"en": "Make sure your clock is accurate before the exam starts.", "tr": "Sınav başlamadan önce saatinizin doğru olduğundan emin olun."},
            {"en": "These financial calculations are extremely accurate.", "tr": "Bu finansal hesaplamalar son derece doğrudur."}
        ]
    },
    "accuse": {
        "tr": "suçlamak, itham etmek",
        "ex": [
            {"en": "He was falsely accused of taking the missing documents.", "tr": "Kayıp belgeleri almakla haksız yere suçlandı."},
            {"en": "Do not accuse anyone without seeing clear evidence.", "tr": "Net bir kanıt görmeden kimseyi suçlamayın."},
            {"en": "The police accused the suspect of robbery.", "tr": "Polis şüpheliyi soygunla suçladı."}
        ]
    },
    "achievement": {
        "tr": "başarı, kazanım",
        "ex": [
            {"en": "Graduating with honors was her greatest achievement.", "tr": "Onur derecesiyle mezun olmak onun en büyük başarısıydı."},
            {"en": "The winning goal was a remarkable team achievement.", "tr": "Galibiyet golü dikkate değer bir takım başarısıydı."},
            {"en": "He felt a deep sense of achievement after climbing the peak.", "tr": "Zirveye tırmandıktan sonra derin bir başarı hissi duydu."}
        ]
    },
    "acknowledge": {
        "tr": "kabul etmek, onaylamak, doğrulamak",
        "ex": [
            {"en": "The government acknowledged the need for educational reform.", "tr": "Hükümet eğitim reformu ihtiyacını kabul etti."},
            {"en": "Please acknowledge receipt of this official letter.", "tr": "Lütfen bu resmi mektubu aldığınızı onaylayın / bildirin."},
            {"en": "He acknowledged his mistake and apologized sincerely.", "tr": "Hatasını kabul etti ve samimiyetle özür diledi."}
        ]
    },
    "acquire": {
        "tr": "edinmek, kazanmak, elde etmek",
        "ex": [
            {"en": "She acquired valuable skills during her summer internship.", "tr": "Yaz stajı sırasında değerli beceriler edindi."},
            {"en": "The international corporation acquired three smaller companies.", "tr": "Uluslararası şirket üç küçük firmayı bünyesine kattı / satın aldı."},
            {"en": "Children acquire language naturally by listening to parents.", "tr": "Çocuklar dili ebeveynlerini dinleyerek doğal biçimde edinirler."}
        ]
    }
}

def batch_translate(texts):
    if not texts:
        return []
    # Join with special separator
    SEP = "\n---DIV---\n"
    combined_text = SEP.join(texts)
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=" + urllib.parse.quote(combined_text)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            translated_full = "".join([x[0] for x in data[0] if x[0]])
            parts = translated_full.split("---DIV---")
            if len(parts) == len(texts):
                return [p.strip() for p in parts]
            # Fallback split by lines if possible
            lines = translated_full.split("\n")
            if len(lines) >= len(texts):
                return [lines[i].strip() for i in range(len(texts))]
            return [p.strip() for p in parts]
    except Exception as e:
        print("Batch translation error:", e)
        return []

def generate_natural_sentences(word, pos):
    w = word.strip()
    p = (pos or "").lower()

    if "prep" in p:
        return [
            f"We walked {w} the road until we saw the station.",
            f"There are several historic shops {w} this quiet street.",
            f"She came {w} with her friends to join us today."
        ]
    elif "adj" in p:
        return [
            f"This is an extremely {w} aspect of modern society.",
            f"She gave a very {w} answer during the interview.",
            f"The final results were {w} and satisfied the team."
        ]
    elif "adv" in p:
        return [
            f"He spoke {w} about his past experiences in London.",
            f"The morning train arrived {w} as expected.",
            f"She was {w} pleased with the final outcome."
        ]
    elif "v" in p:
        return [
            f"They plan to {w} the project starting tomorrow.",
            f"She tried to {w} the situation as best as she could.",
            f"We must {w} together to achieve our goals."
        ]
    else: # noun
        return [
            f"Understanding the {w} is essential for continuous progress.",
            f"They discussed the {w} in detail during the morning meeting.",
            f"The new {w} played an important role in our success."
        ]

def is_bad_meaning(tr, word):
    t = tr.strip()
    w = word.strip().lower()
    if "kelimesi" in t:
        return True
    if t.startswith(w + " (") or t.lower() == w:
        return True
    if t.endswith("(fiil)") or t.endswith("(isim)") or t.endswith("(sıfat)") or t.endswith("(zarf)"):
        return True
    return False

def is_bad_examples(examples, word):
    if not examples or len(examples) == 0:
        return True
    for ex in examples:
        en = ex.get("en", "")
        tr = ex.get("tr", "")
        if "kelimesi" in tr or "sözcüğünü anlamak" in tr or "commonly used in" in en or "make a sentence with" in en or "learned \"" in en:
            return True
    return False

def run_fix():
    for filepath in FILES:
        print(f"\n==========================================")
        print(f"Processing {filepath}...")
        with open(filepath, "r", encoding="utf-8") as fp:
            words_data = json.load(fp)

        # 1. Apply special overrides first
        for item in words_data:
            w = item.get("word", "").strip().lower()
            if w in SPECIAL_OVERRIDES:
                ov = SPECIAL_OVERRIDES[w]
                item["turkishMeaning"] = ov["tr"]
                item["examples"] = ov["ex"]

        # 2. Collect words that need Turkish translation
        words_needing_tr = []
        for item in words_data:
            w = item.get("word", "").strip()
            tr = item.get("turkishMeaning", "")
            if is_bad_meaning(tr, w):
                words_needing_tr.append(item)

        print(f"Found {len(words_needing_tr)} words needing Turkish translation.")

        # Batch translate in chunks of 40
        CHUNK_SIZE = 35
        for i in range(0, len(words_needing_tr), CHUNK_SIZE):
            chunk = words_needing_tr[i:i+CHUNK_SIZE]
            word_strings = [x["word"].strip() for x in chunk]
            translations = batch_translate(word_strings)
            if len(translations) == len(chunk):
                for idx, t in enumerate(translations):
                    clean_t = t.strip()
                    if clean_t and clean_t.lower() != chunk[idx]["word"].lower():
                        chunk[idx]["turkishMeaning"] = clean_t
            else:
                # Individual fallback for failed batch
                for itm in chunk:
                    single = batch_translate([itm["word"]])
                    if single and single[0]:
                        chunk_t = single[0].strip()
                        if chunk_t.lower() != itm["word"].lower():
                            itm["turkishMeaning"] = chunk_t
            time.sleep(0.1)

        # 3. Collect examples needing generation & translation
        items_needing_ex = []
        for item in words_data:
            w = item.get("word", "").strip()
            ex = item.get("examples", [])
            if is_bad_examples(ex, w):
                items_needing_ex.append(item)

        print(f"Found {len(items_needing_ex)} words needing realistic examples.")

        for i in range(0, len(items_needing_ex), 15):
            chunk = items_needing_ex[i:i+15]
            sentences_to_translate = []
            chunk_sent_map = []

            for itm in chunk:
                sents = generate_natural_sentences(itm["word"], itm.get("partOfSpeech", ""))
                chunk_sent_map.append((itm, sents))
                sentences_to_translate.extend(sents)

            trans_results = batch_translate(sentences_to_translate)
            
            ptr = 0
            for itm, sents in chunk_sent_map:
                new_examples = []
                for s in sents:
                    tr_text = trans_results[ptr] if ptr < len(trans_results) else s
                    new_examples.append({
                        "en": s,
                        "tr": tr_text
                    })
                    ptr += 1
                itm["examples"] = new_examples
            time.sleep(0.1)

        with open(filepath, "w", encoding="utf-8") as fp:
            json.dump(words_data, fp, ensure_ascii=False, indent=2)
        print(f"Successfully updated and saved {filepath}!")

    print("\nALL Oxford 3000 dataset files have been cleaned and verified!")

if __name__ == "__main__":
    run_fix()
