#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Complete Final Fix for Oxford 3000 Dataset
"""

import json
import re
import urllib.request
import urllib.parse
import time

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
            {"en": "Bring your friends along to the gathering tonight!", "tr": "Bu akşamki buluşmaya arkadaşlarını da yanında getir!"}
        ]
    }
}

def translate_word(w):
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=" + urllib.parse.quote(w)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return "".join([x[0] for x in data[0] if x[0]]).strip()
    except Exception:
        return ""

def is_bad_tr(tr, w):
    t = tr.strip()
    if "kelimesi" in t or t.startswith(w + " (") or t.lower() == w.lower():
        return True
    if t.endswith("(fiil)") or t.endswith("(isim)") or t.endswith("(sıfat)") or t.endswith("(zarf)"):
        return True
    return False

def is_bad_ex(examples, w):
    if not examples or len(examples) == 0:
        return True
    for ex in examples:
        en = ex.get("en", "")
        tr = ex.get("tr", "")
        if "kelimesi" in tr or "sözcüğünü anlamak" in tr or "commonly used in" in en or "make a sentence with" in en or "learned \"" in en:
            return True
    return False

def make_examples(word, tr_meaning, pos):
    w = word.strip()
    tr_main = tr_meaning.split(",")[0].split(";")[0].strip()
    p = (pos or "").lower()

    if "prep" in p:
        return [
            {"en": f"We walked {w} the quiet road until sunset.", "tr": f"Gün batımına kadar sakin yol {tr_main} yürüdük."},
            {"en": f"There are several shops {w} this street.", "tr": f"Bu cadde {tr_main} birkaç dükkan var."},
            {"en": f"She decided to travel {w} with her closest friends.", "tr": f"En yakın arkadaşlarıyla {tr_main} seyahat etmeye karar verdi."}
        ]
    elif "adj" in p:
        return [
            {"en": f"This is an extremely {w} aspect of modern society.", "tr": f"Bu, modern toplumun son derece {tr_main} bir yönüdür."},
            {"en": f"She gave a very {w} answer during the interview.", "tr": f"Mülakat sırasında çok {tr_main} bir yanıt verdi."},
            {"en": f"The final results were {w} and satisfied the entire team.", "tr": f"Sonuçlar {tr_main} idi ve tüm ekibi memnun etti."}
        ]
    elif "adv" in p:
        return [
            {"en": f"He spoke {w} about his past experiences.", "tr": f"Geçmiş deneyimleri hakkında {tr_main} konuştu."},
            {"en": f"The morning train arrived {w} as expected.", "tr": f"Sabah treni beklendiği gibi {tr_main} ulaştı."},
            {"en": f"She was {w} pleased with the final outcome.", "tr": f"Nihai sonuçtan {tr_main} memnun kaldı."}
        ]
    elif "v" in p:
        return [
            {"en": f"They plan to {w} the new project starting next week.", "tr": f"Gelecek haftadan itibaren yeni projeyi {tr_main} planlıyorlar."},
            {"en": f"She tried to {w} the situation as best as she could.", "tr": f"Durumu elinden geldiğince iyi {tr_main} çalıştı."},
            {"en": f"We must work together to {w} our common goals.", "tr": f"Ortak hedeflerimize {tr_main} için birlikte çalışmalıyız."}
        ]
    else:
        return [
            {"en": f"Understanding the {w} is essential for continuous progress.", "tr": f"{tr_main.capitalize()} kavramını anlamak sürekli ilerleme için esastır."},
            {"en": f"They discussed the {w} in detail during the team meeting.", "tr": f"Ekip toplantısında {tr_main} konusunu ayrıntılı olarak tartıştılar."},
            {"en": f"The new {w} played a key role in their overall success.", "tr": f"Yeni {tr_main}, genel başarılarında kilit bir rol oynadı."}
        ]

for filepath in FILES:
    with open(filepath, "r", encoding="utf-8") as fp:
        words = json.load(fp)

    for item in words:
        w = item.get("word", "").strip()
        w_lower = w.lower()

        if w_lower in SPECIAL_OVERRIDES:
            item["turkishMeaning"] = SPECIAL_OVERRIDES[w_lower]["tr"]
            item["examples"] = SPECIAL_OVERRIDES[w_lower]["ex"]
            continue

        tr = item.get("turkishMeaning", "")
        pos = item.get("partOfSpeech", "")

        if is_bad_tr(tr, w):
            clean = re.sub(r"\s*\((fiil|isim|sıfat|zarf|edat|zamir|A1 kelimesi|A2 kelimesi|B1 kelimesi|B2 kelimesi)\)", "", tr).strip()
            if clean and clean.lower() != w.lower():
                item["turkishMeaning"] = clean
            else:
                fetched = translate_word(w)
                if fetched and fetched.lower() != w.lower():
                    item["turkishMeaning"] = fetched
                else:
                    item["turkishMeaning"] = clean or w

        if is_bad_ex(item.get("examples", []), w):
            item["examples"] = make_examples(w, item["turkishMeaning"], pos)

    with open(filepath, "w", encoding="utf-8") as fp:
        json.dump(words, fp, ensure_ascii=False, indent=2)

print("Complete final fix finished!")
