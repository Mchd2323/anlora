#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fast Multi-Threaded Oxford 3000 Dictionary & Examples Fixer
"""

import json
import os
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

CACHE_FILE = "scripts/translation_cache.json"

def fetch_google_dict_and_trans(word):
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&dt=bd&q=" + urllib.parse.quote(word)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            main_tr = "".join([x[0] for x in data[0] if x[0]]).strip()
            dict_terms = []
            if len(data) > 1 and data[1]:
                for pos_group in data[1]:
                    terms = pos_group[1][:3]
                    for t in terms:
                        if t and t not in dict_terms and t.lower() != word.lower():
                            dict_terms.append(t)
            
            if dict_terms:
                all_terms = []
                if main_tr and main_tr.lower() != word.lower():
                    all_terms.append(main_tr)
                for t in dict_terms:
                    if t.lower() not in [x.lower() for x in all_terms]:
                        all_terms.append(t)
                return ", ".join(all_terms[:3])
            return main_tr
    except Exception:
        return None

def fetch_sentence_translation(sentence):
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=" + urllib.parse.quote(sentence)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return "".join([x[0] for x in data[0] if x[0]]).strip()
    except Exception:
        return None

def generate_context_sentences(word, pos, level):
    w = word.strip()
    pos_lower = (pos or "").lower()

    if "prep" in pos_lower:
        return [
            f"We walked {w} the road until we saw the station.",
            f"There are several shops {w} this quiet street.",
            f"She came {w} with her friends to join us."
        ]
    elif "adj" in pos_lower:
        return [
            f"This is an extremely {w} aspect of modern life.",
            f"She gave a very {w} answer during the interview.",
            f"The results were {w} and satisfied the entire team."
        ]
    elif "adv" in pos_lower:
        return [
            f"He spoke {w} about his past experiences.",
            f"The train arrived {w} as expected.",
            f"She was {w} pleased with the final outcome."
        ]
    elif "v" in pos_lower:
        return [
            f"They plan to {w} the project starting tomorrow.",
            f"She tried to {w} the situation as best as she could.",
            f"We must {w} together to achieve our goals."
        ]
    else:
        return [
            f"Understanding the {w} is essential for success.",
            f"They discussed the {w} in detail during the meeting.",
            f"The {w} played a significant role in the recent changes."
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

def process_single_item(item, cache):
    word = item.get("word", "").strip()
    level = item.get("level", "A1")
    pos = item.get("partOfSpeech", "")
    current_tr = item.get("turkishMeaning", "")
    examples = item.get("examples", [])

    needs_tr = is_bad_meaning(current_tr, word)
    needs_ex = is_bad_examples(examples, word)

    if not needs_tr and not needs_ex:
        return False, item

    # Special curated overrides for key words
    if word == "along":
        item["turkishMeaning"] = "boyunca, yanı sıra, ileriye doğru"
        item["examples"] = [
            {"en": "We walked along the quiet beach at sunset.", "tr": "Gün batımında sakin sahil boyunca yürüdük."},
            {"en": "There are beautiful trees all along the river bank.", "tr": "Nehir kıyısı boyunca güzel ağaçlar var."},
            {"en": "Bring your friends along to the gathering tonight!", "tr": "Bu akşamki buluşmaya arkadaşlarını da yanında getir!"}
        ]
        return True, item

    if word == "all right":
        item["turkishMeaning"] = "peki, tamam, iyi, sorunsuz"
        item["examples"] = [
            {"en": "Is everything all right with your new schedule?", "tr": "Yeni programında her şey yolunda mı?"},
            {"en": "All right, let us start our lesson now.", "tr": "Peki, şimdi dersimize başlayalım."},
            {"en": "Don't worry about it, you will be all right.", "tr": "Bunun için endişelenme, tamamen iyi olacaksın."}
        ]
        return True, item

    if word == "allow":
        item["turkishMeaning"] = "izin vermek, olanak tanımak, müsaade etmek"
        item["examples"] = [
            {"en": "Smoking is not allowed inside the building.", "tr": "Bina içinde sigara içilmesine izin verilmez."},
            {"en": "The software allows users to edit photos easily.", "tr": "Yazılım, kullanıcıların fotoğrafları kolayca düzenlemesine olanak tanır."},
            {"en": "Please allow me to carry your heavy luggage.", "tr": "Lütfen ağır bavulunuzu taşımama izin verin."}
        ]
        return True, item

    if word == "almost":
        item["turkishMeaning"] = "neredeyse, hemen hemen, az kalsın"
        item["examples"] = [
            {"en": "Dinner is almost ready, please take your seat.", "tr": "Akşam yemeği neredeyse hazır, lütfen yerinize geçin."},
            {"en": "I have almost finished reading this book.", "tr": "Bu kitabı okumayı neredeyse bitirdim."},
            {"en": "It was almost midnight when we arrived home.", "tr": "Eve vardığımızda neredeyse gece yarısıydı."}
        ]
        return True, item

    if word == "alone":
        item["turkishMeaning"] = "yalnız, tek başına, kimsesiz"
        item["examples"] = [
            {"en": "She prefers to live alone in a quiet neighborhood.", "tr": "Sakin bir mahallede tek başına yaşamayı tercih ediyor."},
            {"en": "You are not alone; we are here to support you.", "tr": "Yalnız değilsin; sana destek olmak için buradayız."},
            {"en": "He traveled alone across Europe last summer.", "tr": "Geçen yaz Avrupa genelinde tek başına seyahat etti."}
        ]
        return True, item

    if word == "argument":
        item["turkishMeaning"] = "tartışma, sav, münakaşa, iddia"
        item["examples"] = [
            {"en": "They had a heated argument about the budget yesterday.", "tr": "Dün bütçe hakkında hararetli bir tartışma yaşadılar."},
            {"en": "His argument was supported by strong scientific evidence.", "tr": "Onun savı güçlü bilimsel kanıtlarla desteklendi."},
            {"en": "Let us avoid unnecessary arguments and find a solution.", "tr": "Gereksiz tartışmalardan kaçınalım ve bir çözüm bulalım."}
        ]
        return True, item

    if needs_tr:
        if word in cache and "tr" in cache[word]:
            item["turkishMeaning"] = cache[word]["tr"]
        else:
            new_tr = fetch_google_dict_and_trans(word)
            if new_tr:
                item["turkishMeaning"] = new_tr
                if word not in cache:
                    cache[word] = {}
                cache[word]["tr"] = new_tr

    if needs_ex:
        cached_ex = cache.get(word, {}).get("examples")
        if cached_ex:
            item["examples"] = cached_ex
        else:
            raw_sentences = generate_context_sentences(word, pos, level)
            new_examples = []
            for sent in raw_sentences:
                tr_sent = fetch_sentence_translation(sent)
                new_examples.append({
                    "en": sent,
                    "tr": tr_sent or sent
                })
            item["examples"] = new_examples
            if word not in cache:
                cache[word] = {}
            cache[word]["examples"] = new_examples

    return True, item

def run():
    cache = {}
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as fp:
                cache = json.load(fp)
        except Exception:
            cache = {}

    print(f"Loaded {len(cache)} cached items.")

    for filepath in FILES:
        print(f"\nScanning {filepath}...")
        with open(filepath, "r", encoding="utf-8") as fp:
            words_data = json.load(fp)

        items_to_process = []
        for idx, item in enumerate(words_data):
            w = item.get("word", "")
            tr = item.get("turkishMeaning", "")
            ex = item.get("examples", [])
            if is_bad_meaning(tr, w) or is_bad_examples(ex, w):
                items_to_process.append((idx, item))

        print(f"{filepath}: Found {len(items_to_process)} words to enrich. Processing with 16 threads...")

        modified = 0
        with ThreadPoolExecutor(max_workers=16) as executor:
            future_to_idx = {executor.submit(process_single_item, item, cache): idx for idx, item in items_to_process}
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                try:
                    changed, updated_item = future.result()
                    if changed:
                        words_data[idx] = updated_item
                        modified += 1
                        if modified % 50 == 0:
                            print(f"[{filepath}] Enriched {modified}/{len(items_to_process)} words...")
                except Exception as exc:
                    print(f"Error processing item at {idx}: {exc}")

        with open(filepath, "w", encoding="utf-8") as fp:
            json.dump(words_data, fp, ensure_ascii=False, indent=2)
        print(f"Saved {filepath} with {modified} enriched words.")

        with open(CACHE_FILE, "w", encoding="utf-8") as fp:
            json.dump(cache, fp, ensure_ascii=False, indent=2)

    print("\nAll files successfully processed and updated!")

if __name__ == "__main__":
    run()
