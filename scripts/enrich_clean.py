#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Robust Oxford 3000 Vocabulary & Example Sentence Enhancer
"""

import json
import re
import time
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

FILES = [
    "src/data/wordsA1.json",
    "src/data/wordsA2.json",
    "src/data/wordsB1.json",
    "src/data/wordsB2.json"
]

# Comprehensive offline curated dictionary for primary Oxford keywords
CURATED = {
    "along": {
        "tr": "boyunca, yanı sıra, ileriye doğru",
        "ex": [
            {"en": "We walked along the quiet beach at sunset.", "tr": "Gün batımında sakin sahil boyunca yürüdük."},
            {"en": "There are beautiful trees all along the river bank.", "tr": "Nehir kıyısı boyunca güzel ağaçlar var."},
            {"en": "Bring your friends along to the gathering tonight!", "tr": "Bu akşamki buluşmaya arkadaşlarını da yanında getir!"}
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
    "alternative": {
        "tr": "alternatif, seçenek; farklı, alternatif",
        "ex": [
            {"en": "We need to find an alternative route due to road construction.", "tr": "Yol çalışması nedeniyle alternatif bir rota bulmamız gerekiyor."},
            {"en": "Solar power is a clean alternative energy source.", "tr": "Güneş enerjisi temiz bir alternatif enerji kaynağıdır."},
            {"en": "Do you have any alternative suggestions for this problem?", "tr": "Bu sorun için herhangi bir alternatif öneriniz var mı?"}
        ]
    },
    "although": {
        "tr": "-e rağmen, karşın, gerçi",
        "ex": [
            {"en": "Although it was raining hard, they went for a hike.", "tr": "Şiddetli yağmur yağmasına rağmen yürüyüşe çıktılar."},
            {"en": "She passed the exam although she was sick.", "tr": "Hasta olmasına rağmen sınavı geçti."},
            {"en": "Although he is young, he is very experienced in coding.", "tr": "Genç olmasına rağmen kodlama konusunda çok deneyimli."}
        ]
    },
    "among": {
        "tr": "arasında, içinde, ortasında",
        "ex": [
            {"en": "The small cottage was hidden among the tall pine trees.", "tr": "Küçük kulübe uzun çam ağaçlarının arasında gizlenmişti."},
            {"en": "He is very popular among his classmates.", "tr": "Sınıf arkadaşları arasında çok popülerdir."},
            {"en": "She divided the sweets equally among the children.", "tr": "Şekerleri çocukların arasında eşit şekilde paylaştırdı."}
        ]
    },
    "amount": {
        "tr": "miktar, tutar; miktarına varmak",
        "ex": [
            {"en": "A large amount of money was donated to the charity.", "tr": "Hayır kurumuna büyük miktarda para bağışlandı."},
            {"en": "Try to reduce the amount of salt in your food.", "tr": "Yiyeceklerinizdeki tuz miktarını azaltmaya çalışın."},
            {"en": "The total bill amounts to fifty dollars.", "tr": "Toplam fatura elli dolara ulaşıyor."}
        ]
    },
    "ankle": {
        "tr": "ayak bileği",
        "ex": [
            {"en": "He twisted his ankle while playing basketball yesterday.", "tr": "Dün basketbol oynarken ayak bileğini burktu."},
            {"en": "She wore a silver bracelet around her ankle.", "tr": "Ayak bileğine gümüş bir halhal taktı."},
            {"en": "The doctor examined my swollen ankle carefully.", "tr": "Doktor şişmiş ayak bileğimi dikkatlice muayene etti."}
        ]
    },
    "anybody": {
        "tr": "hiç kimse, herhangi biri, kimse",
        "ex": [
            {"en": "Is anybody home right now?", "tr": "Şu anda evde kimse var mı?"},
            {"en": "I did not see anybody in the library this morning.", "tr": "Bu sabah kütüphanede kimseyi görmedim."},
            {"en": "Anybody can learn to code with enough practice.", "tr": "Yeterli pratikle herkes / herhangi biri kod yazmayı öğrenebilir."}
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
            {"en": "The crew had to abandon the damaged ship.", "tr": "Mürettebat hasarlı gemiyi terk etmek zorunda kaldı."},
            {"en": "They decided to abandon the difficult project.", "tr": "Zor projeyi bırakmaya / projeden vazgeçmeye karar verdiler."},
            {"en": "Never abandon your hopes and aspirations.", "tr": "Umutlarınızı ve hayallerinizi asla terk etmeyin."}
        ]
    },
    "ability": {
        "tr": "yetenek, beceri, kabiliyet",
        "ex": [
            {"en": "She has a remarkable ability to learn languages quickly.", "tr": "Dilleri hızlı öğrenme konusunda dikkate değer bir yeteneği var."},
            {"en": "His leadership ability inspired the entire team.", "tr": "Liderlik yeteneği tüm takıma ilham verdi."},
            {"en": "Students are grouped according to their reading ability.", "tr": "Öğrenciler okuma becerilerine göre gruplandırılır."}
        ]
    },
    "able": {
        "tr": "yapabilen, muktedir, yetenekli",
        "ex": [
            {"en": "Will you be able to attend the conference tomorrow?", "tr": "Yarınki konferansa katılabilecek misiniz?"},
            {"en": "She was able to solve the math puzzle within minutes.", "tr": "Matematik bulmacasını dakikalar içinde çözebildi."},
            {"en": "He is an able manager with great vision.", "tr": "Harika bir vizyona sahip yetenekli bir yöneticidir."}
        ]
    }
}

def translate_word_online(w):
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=" + urllib.parse.quote(w)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return "".join([x[0] for x in data[0] if x[0]]).strip()
    except Exception:
        return ""

def translate_sentence_online(sent):
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=" + urllib.parse.quote(sent)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return "".join([x[0] for x in data[0] if x[0]]).strip()
    except Exception:
        return ""

def get_natural_sentences(word, pos):
    w = word.strip()
    p = (pos or "").lower()
    if "prep" in p:
        return [
            f"We walked {w} the road until we saw the station.",
            f"There are several shops {w} this quiet street.",
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
    else:
        return [
            f"Understanding the {w} is essential for success.",
            f"They discussed the {w} in detail during the meeting.",
            f"The new {w} played an important role in our team."
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

def enrich_word_item(item):
    w = item.get("word", "").strip()
    w_lower = w.lower()
    tr = item.get("turkishMeaning", "").strip()
    ex = item.get("examples", [])
    pos = item.get("partOfSpeech", "")

    # 1. Curated check
    if w_lower in CURATED:
        item["turkishMeaning"] = CURATED[w_lower]["tr"]
        item["examples"] = CURATED[w_lower]["ex"]
        return True, item

    needs_tr = is_bad_meaning(tr, w)
    needs_ex = is_bad_examples(ex, w)

    if not needs_tr and not needs_ex:
        return False, item

    if needs_tr:
        online_tr = translate_word_online(w)
        if online_tr and online_tr.lower() != w.lower():
            item["turkishMeaning"] = online_tr
        else:
            cleaned = re.sub(r"\s*\((fiil|isim|sıfat|zarf|edat|zamir|A1 kelimesi|A2 kelimesi|B1 kelimesi|B2 kelimesi)\)", "", tr).strip()
            item["turkishMeaning"] = cleaned if cleaned and cleaned.lower() != w.lower() else online_tr or w

    if needs_ex:
        raw_sents = get_natural_sentences(w, pos)
        new_ex = []
        for s in raw_sents:
            tr_s = translate_sentence_online(s)
            new_ex.append({
                "en": s,
                "tr": tr_s or s
            })
        item["examples"] = new_ex

    return True, item

def process_file(filepath):
    print(f"\nProcessing {filepath}...")
    with open(filepath, "r", encoding="utf-8") as fp:
        words = json.load(fp)

    changed = 0
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = {pool.submit(enrich_word_item, item): idx for idx, item in enumerate(words)}
        for fut in as_completed(futures):
            idx = futures[fut]
            try:
                is_changed, updated = fut.result()
                if is_changed:
                    words[idx] = updated
                    changed += 1
            except Exception as e:
                print(f"Error at {idx}: {e}")

    with open(filepath, "w", encoding="utf-8") as fp:
        json.dump(words, fp, ensure_ascii=False, indent=2)
    print(f"Finished {filepath}! Updated {changed} words.")

def main():
    for f in FILES:
        process_file(f)

if __name__ == "__main__":
    main()
