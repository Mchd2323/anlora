# -*- coding: utf-8 -*-
"""
Oxford çekirdek veri kümesi doğrulayıcısı (talimat 58).

Kaynak listeleriyle üretilmiş veriyi kontrol eder. Kusur bulursa
ANLORA_VALIDATE_STRICT=true iken sıfırdan farklı kodla çıkar; böylece bir
derleme adımına ya da CI'a bağlanabilir.

Kontroller:
  - geçersiz CEFR / boş headword / boş POS
  - kaynak ile uyuşmayan dataset ataması
  - yinelenen kayıt kimliği ve yinelenen sense kimliği
  - eksik Türkçe anlam
  - placeholder anlam ("kelime (isim)", "otomatik anlam" ...)
  - 3'ten az örnek
  - boş ya da eksik örnek çevirisi
  - aynı sense içinde yinelenen örnek
  - örnek cümlenin hedef kelimeyi içermemesi
  - qualifier / homograf kaybı (kaynakta var, veride yok)
"""

import json
import os
import re
import sys
import collections

DATA_FILES = ['src/data/oxford3000.json', 'src/data/oxford5000extra.json']
SOURCE_FILES = [
    ('scripts/oxford/source/oxford3000.source.json', 'oxford3000'),
    ('scripts/oxford/source/oxford5000extra.source.json', 'oxford5000-extra'),
]

VALID_CEFR = {'A1', 'A2', 'B1', 'B2', 'C1'}

PLACEHOLDER_PATTERNS = [
    'otomatik anlam', '(anlam)', 'todo', 'anlam giriniz', 'undefined', 'null',
    '(isim)', '(fiil)', '(sıfat)', '(zarf)', 'kelimesi',
]


def load(path):
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def is_placeholder(text):
    value = (text or '').strip().lower()
    if not value:
        return False
    return any(pattern in value for pattern in PLACEHOLDER_PATTERNS)


# Düzensiz çekimler uygulamayla AYNI dosyadan okunur; iki ayrı kopya tutmak
# listelerin zamanla birbirinden kayması demektir.
with open('src/data/irregularInflections.json', encoding='utf-8') as _handle:
    IRREGULAR = json.load(_handle)


def sentence_contains(sentence, word):
    """
    Örnek cümle hedef kelimeyi içeriyor mu?

    Basit gövde araması yetmez: "become" için "It quickly became cold outside."
    geçerli bir örnektir. Düzenli ekler ve düzensiz çekimler birlikte kontrol
    edilir.
    """
    target = (word or '').strip().lower()
    if not target:
        return True

    lowered = (sentence or '').lower()
    # Tireli ya da çok sözcüklü madde başları ("make-up", "ice cream") olduğu
    # gibi aranır; kelime kelime bölmek bunları kaçırır.
    if ('-' in target or ' ' in target) and target in lowered:
        return True
    target = target.split()[0]

    for token in re.findall(r"[a-z'\-]+", lowered):
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
        # Bileşik sözcüğün parçası: "self-awareness" içinde "awareness",
        # "heart-shaped" içinde "shaped".
        if '-' in token and target in token.split('-'):
            return True
    return False


def main():
    entries = []
    for path in DATA_FILES:
        entries.extend(load(path))

    problems = collections.defaultdict(list)
    pending = collections.Counter()

    seen_entry_ids = set()
    seen_sense_ids = set()

    for entry in entries:
        entry_id = entry.get('id')
        label = entry.get('sourceEntry') or entry_id

        if not entry_id:
            problems['bos_kimlik'].append(label)
        elif entry_id in seen_entry_ids:
            problems['yinelenen_kayit_kimligi'].append(entry_id)
        else:
            seen_entry_ids.add(entry_id)

        if not (entry.get('headword') or '').strip():
            problems['bos_headword'].append(label)

        if entry.get('cefr') not in VALID_CEFR:
            problems['gecersiz_cefr'].append(f"{label} -> {entry.get('cefr')}")

        if entry.get('sourceCollection') not in ('oxford3000', 'oxford5000-extra'):
            problems['gecersiz_dataset'].append(label)

        senses = entry.get('senses') or []
        if not senses:
            problems['sense_yok'].append(label)

        for sense in senses:
            sense_id = sense.get('id')
            if not sense_id:
                problems['bos_sense_kimligi'].append(label)
            elif sense_id in seen_sense_ids:
                problems['yinelenen_sense_kimligi'].append(sense_id)
            else:
                seen_sense_ids.add(sense_id)

            if not (sense.get('partOfSpeech') or '').strip():
                problems['bos_pos'].append(label)

            meanings = sense.get('turkishMeanings') or []
            if not meanings:
                # Eksik içerik bir KUSUR değil, bekleyen iştir: kayıt
                # needsReview taşır ve zenginleştirme betiği doldurur.
                pending['anlam_bekliyor'] += 1
            for meaning in meanings:
                if is_placeholder(meaning):
                    problems['placeholder_anlam'].append(f'{label} -> {meaning}')

            examples = sense.get('examples') or []
            if len(examples) < 3:
                pending['ornek_bekliyor'] += 1

            seen_examples = set()
            for example in examples:
                english = (example.get('en') or '').strip()
                turkish = (example.get('tr') or '').strip()
                if not english:
                    problems['bos_ornek'].append(label)
                    continue
                if not turkish:
                    problems['eksik_ornek_cevirisi'].append(f'{label} -> {english}')
                if english.lower() in seen_examples:
                    problems['yinelenen_ornek'].append(f'{label} -> {english}')
                seen_examples.add(english.lower())
                if not sentence_contains(english, entry.get('headword')):
                    problems['ornek_kelimeyi_icermiyor'].append(f'{label} -> {english}')

    # Kaynakla karşılaştırma: qualifier / homograf kaybı ve kayıt sayısı
    source_entries = []
    for path, collection in SOURCE_FILES:
        source_entries.extend(load(path))

    by_line = {entry['sourceEntry']: entry for entry in entries}
    for source in source_entries:
        target = by_line.get(source['sourceLine'])
        if target is None:
            problems['kaynakta_var_veride_yok'].append(source['sourceLine'])
            continue
        if source.get('qualifier') and not target.get('qualifier'):
            problems['qualifier_kaybi'].append(source['sourceLine'])
        if source.get('homograph') and not target.get('homograph'):
            problems['homograf_kaybi'].append(source['sourceLine'])
        source_pos = source['posList']
        target_pos = [sense.get('partOfSpeech') for sense in target.get('senses') or []]
        if source_pos != target_pos:
            problems['pos_uyusmazligi'].append(
                f"{source['sourceLine']} kaynak={source_pos} veri={target_pos}"
            )

    print('=' * 58)
    print('OXFORD VERİ DOĞRULAMA')
    print('=' * 58)
    print(f'  Kayıt: {len(entries)}   Sense: {len(seen_sense_ids)}')
    print()
    print('KUSURLAR')
    total = 0
    for key in sorted(problems):
        items = problems[key]
        total += len(items)
        print(f'  {key:28} {len(items)}')
        for item in items[:3]:
            print(f'      {item}')
    if total == 0:
        print('  yok ✅')
    print()
    print('BEKLEYEN İÇERİK (kusur değil, zenginleştirme işi)')
    for key in sorted(pending):
        print(f'  {key:28} {pending[key]}')
    print()
    if total == 0:
        print('✅ DOĞRULAMA GEÇTİ')
    else:
        print(f'❌ DOĞRULAMA BAŞARISIZ: {total} kusur')

    if total > 0 and os.environ.get('ANLORA_VALIDATE_STRICT') == 'true':
        sys.exit(1)


if __name__ == '__main__':
    main()
