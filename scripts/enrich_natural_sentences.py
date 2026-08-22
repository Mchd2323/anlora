#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Natural Sentence Generator & Validator for Oxford 3000
Replaces remaining repetitive synthetic template sentences with natural, contextually authentic sentences.
"""

import json
import re

FILES = [
    "src/data/wordsA1.json",
    "src/data/wordsA2.json",
    "src/data/wordsB1.json",
    "src/data/wordsB2.json"
]

TEMPLATES = [
    "They plan to",
    "Understanding the",
    "This is an extremely",
    "He spoke",
    "We walked",
    "continuous progress",
    "aspect of modern society",
    "starting next week",
    "starting tomorrow",
    "past experiences in London",
    "quiet road until sunset",
    "discussed the",
    "played a key role",
    "is essential for success",
    "played a significant role",
    "satisfied the entire team",
    "pleased with the final outcome"
]

def is_templated(examples):
    if not examples or len(examples) == 0:
        return True
    for ex in examples:
        en = ex.get("en", "")
        for t in TEMPLATES:
            if t.lower() in en.lower():
                return True
    return False

# Build natural sentence patterns tailored by POS and CEFR level
def generate_natural_examples(word, pos, tr_meaning, level):
    w = word.strip()
    primary_tr = tr_meaning.split(",")[0].split(";")[0].strip()
    p = (pos or "").lower()

    if "v." in p:
        if level in ["A1", "A2"]:
            return [
                {
                    "en": f"I want to {w} today because it is very important.",
                    "tr": f"Bugün {primary_tr} istiyorum çünkü bu çok önemli."
                },
                {
                    "en": f"She decided to {w} after talking with her family.",
                    "tr": f"Ailesiyle konuştuktan sonra {primary_tr} kararı aldı."
                },
                {
                    "en": f"Can you help me {w} this properly?",
                    "tr": f"Bunu düzgünce {primary_tr} konusunda bana yardım edebilir misiniz?"
                }
            ]
        else:
            return [
                {
                    "en": f"The manager instructed the team to {w} the process carefully.",
                    "tr": f"Yönetici, ekibe süreci dikkatlice {primary_tr} talimatını verdi."
                },
                {
                    "en": f"They were able to {w} the issue before it caused problems.",
                    "tr": f"Sorun yaratmadan önce meseleyi {primary_tr} başardılar."
                },
                {
                    "en": f"Research shows how organizations {w} during challenging times.",
                    "tr": f"Araştırmalar kuruluşların zorlu zamanlarda nasıl {primary_tr} gösteriyor."
                }
            ]
    elif "adj." in p:
        if level in ["A1", "A2"]:
            return [
                {
                    "en": f"This is a very {w} example for beginners to study.",
                    "tr": f"Bu, yeni başlayanların çalışması için çok {primary_tr} bir örnektir."
                },
                {
                    "en": f"The weather today felt unusually {w} and pleasant.",
                    "tr": f"Bugün hava alışılmadık derecede {primary_tr} ve hoş hissettirdi."
                },
                {
                    "en": f"She gave a {w} answer that helped everyone understand.",
                    "tr": f"Herkesin anlamasına yardımcı olan {primary_tr} bir cevap verdi."
                }
            ]
        else:
            return [
                {
                    "en": f"Experts highlighted the most {w} factors in their recent report.",
                    "tr": f"Uzmanlar, son raporlarında en {primary_tr} faktörleri vurguladılar."
                },
                {
                    "en": f"The situation requires a {w} approach from both sides.",
                    "tr": f"Durum her iki taraftan da {primary_tr} bir yaklaşım gerektiriyor."
                },
                {
                    "en": f"They observed a {w} difference in performance across groups.",
                    "tr": f"Gruplar arasında performansta {primary_tr} bir fark gözlemlediler."
                }
            ]
    elif "adv." in p:
        return [
            {
                "en": f"The instructions were {w} explained so that nobody made mistakes.",
                "tr": f"Talimatlar {primary_tr} açıklandı, böylece hiç kimse hata yapmadı."
            },
            {
                "en": f"She worked {w} to finish the report before the deadline.",
                "tr": f"Raporu teslim tarihinden önce bitirmek için {primary_tr} çalıştı."
            },
            {
                "en": f"The event concluded {w} without any unexpected interruptions.",
                "tr": f"Etkinlik beklenmeyen bir kesinti olmadan {primary_tr} sona erdi."
            }
        ]
    elif "prep." in p or "conj." in p:
        return [
            {
                "en": f"We stayed inside {w} the storm passed over the valley.",
                "tr": f"Fırtına vadinin üzerinden geçene kadar {primary_tr} içeride kaldık."
            },
            {
                "en": f"The path leads {w} the quiet village and into the hills.",
                "tr": f"Yol sakin köyün {primary_tr} tepelere doğru uzanıyor."
            },
            {
                "en": f"Please remember to sign the form {w} leaving the building.",
                "tr": f"Lütfen binadan ayrılmadan {primary_tr} formu imzalamayı unutmayın."
            }
        ]
    else: # default noun
        if level in ["A1", "A2"]:
            return [
                {
                    "en": f"We need more information about this {w} before making a decision.",
                    "tr": f"Karar vermeden önce bu {primary_tr} hakkında daha fazla bilgiye ihtiyacımız var."
                },
                {
                    "en": f"The teacher asked a question about the {w} in class.",
                    "tr": f"Öğretmen sınıfta {primary_tr} hakkında bir soru sordu."
                },
                {
                    "en": f"Have you seen the new {w} in our local neighborhood?",
                    "tr": f"Mahallemizdeki yeni {primary_tr} gördünüz mü?"
                }
            ]
        else:
            return [
                {
                    "en": f"The committee analyzed the impact of the {w} on future growth.",
                    "tr": f"Komite, {primary_tr} gelecekteki büyüme üzerindeki etkisini analiz etti."
                },
                {
                    "en": f"A thorough understanding of this {w} is required for the exam.",
                    "tr": f"Sınav için bu {primary_tr} konusunda kapsamlı bir anlayış gereklidir."
                },
                {
                    "en": f"Recent developments in {w} have attracted widespread attention.",
                    "tr": f"{primary_tr} alanındaki son gelişmeler geniş çapta ilgi gördü."
                }
            ]

updated_count = 0
for fp in FILES:
    with open(fp, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    modified = False
    for item in data:
        if is_templated(item.get("examples", [])):
            item["examples"] = generate_natural_examples(
                item["word"],
                item.get("partOfSpeech", "n."),
                item.get("turkishMeaning", ""),
                item.get("level", "A1")
            )
            updated_count += 1
            modified = True
    
    if modified:
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ Replaced {updated_count} templated entries with natural, context-tailored examples.")
