# -*- coding: utf-8 -*-
"""
"Bu cümle bu kelimeyi içeriyor mu?" kontrolü — tek kaynak.

Bu mantık hem `apply_content.py` (yamaları kabul etmeden önce) hem
`validate_oxford.py` (veri kümesini denetlerken) tarafından kullanılır. İki
ayrı kopya tutmak, kuralların zamanla birbirinden kayması demektir; bu
projede rozet sisteminde ve şablon listesinde tam olarak bu olmuştu.
"""

import json
import os
import re

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

with open(os.path.join(_ROOT, 'src/data/irregularInflections.json'), encoding='utf-8') as _handle:
    IRREGULAR = json.load(_handle)

# Tipografik kesme işaretleri düz kesmeye indirgenir: kaynak listede
# "o’clock" (U+2019) geçiyor. Normalize edilmezse sözcük sınırı araması
# bunu "o" ve "clock" diye ikiye böler ve eşleşme hiçbir zaman tutmaz.
CURLY_APOSTROPHES = str.maketrans({
    '‘': "'", '’': "'", '‚': "'", '‛': "'",
    '′': "'", 'ʼ': "'", '`': "'",
})

_TOKEN = re.compile(r"[a-z'\-]+")


def sentence_contains(sentence, headword):
    """
    Örnek cümle hedef kelimeyi (düzenli ya da düzensiz çekimiyle) içeriyor mu?

    Basit bir alt dize araması yetmez: "become" için "It quickly became cold
    outside." geçerli bir örnektir. Düzensiz çekimler paylaşılan
    `irregularInflections.json` dosyasından okunur.
    """
    target = (headword or '').strip().lower().translate(CURLY_APOSTROPHES)
    lowered = (sentence or '').lower().translate(CURLY_APOSTROPHES)
    if not target:
        return True

    # Tireli ya da çok sözcüklü madde başları ("make-up", "ice cream") olduğu
    # gibi aranır; kelime kelime bölmek bunları kaçırır.
    if ('-' in target or ' ' in target or "'" in target) and target in lowered:
        return True
    target = target.split()[0]

    for token in _TOKEN.findall(lowered):
        if token == target:
            return True
        info = IRREGULAR.get(token)
        if info and info.get('base') == target:
            return True
        if token.startswith(target) and len(token) - len(target) <= 3:
            return True
        if target.endswith('e') and token.startswith(target[:-1]):
            return True
        if target.endswith('y') and token.startswith(target[:-1] + 'i'):
            return True
        if token.startswith(target + target[-1]):
            return True
        # Bileşik sözcüğün parçası: "self-awareness" içinde "awareness".
        if '-' in token and target in token.split('-'):
            return True
    return False
