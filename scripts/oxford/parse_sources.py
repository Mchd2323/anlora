# -*- coding: utf-8 -*-
"""
Resmî Oxford 3000 / Oxford 5000 PDF listelerini ayrıştırır.

Bu dosyalar projenin KAYNAK OTORİTESİDİR: headword, CEFR seviyesi, sözcük
türü, qualifier, homograf numarası ve kaynak sırası konusunda uygulama
verisiyle çelişirlerse kaynak esas alınır.

Satır biçimleri ve ele alınan özel durumlar:

    action n.                                 basit
    about prep., adv.                         çoklu POS
    another det./pron.                        eğik çizgiyle ayrılmış POS
    bank (money) n.                           qualifier
    counter (long flat surface) n.            çok sözcüklü qualifier
    like (find sb/sth pleasant) v.            qualifier içinde eğik çizgi
    match (contest/correspond) n., v.         ikisi birden
    can1 modal v.                             homograf numarası
    second1 (next after the first) det./      satır sarması (devamı alt satırda)
    a, an indefinite article                  iki madde başı, sözel POS
    be v., auxiliary v.                       çok sözcüklü POS

Çıktı: JSON listesi. Her kayıt kaynaktaki sırayı korur.
"""

import json
import re
import sys

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    print('pypdf gerekli: pip install pypdf', file=sys.stderr)
    raise

LEVEL_HEADINGS = {'A1', 'A2', 'B1', 'B2', 'C1', 'C2'}

# Kaynakta geçen sözcük türü etiketleri. Çok sözcüklü olanlar önce gelmeli ki
# "auxiliary v." parçalanıp "v." olarak okunmasın.
POS_TOKENS = [
    'auxiliary v.',
    'modal v.',
    'indefinite article',
    'definite article',
    'infinitive marker',
    'exclam.',
    'number',
    'n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'det.',
]

# Satır sonu POS listesinin devam ettiğini gösterir.
CONTINUATION_SUFFIXES = (',', '/')


def _clean(line):
    """Bölünmez boşlukları ve fazla boşlukları temizler."""
    return re.sub(r'\s+', ' ', line.replace(' ', ' ')).strip()


def _is_noise(line):
    if not line:
        return True
    if 'Oxford University Press' in line:
        return True
    if line.startswith('The Oxford'):
        return True
    if line.startswith('3000,'):
        return True
    return False


def extract_lines(pdf_path):
    """PDF'ten temizlenmiş, sarması birleştirilmiş satırları döndürür."""
    reader = PdfReader(pdf_path)
    raw = []
    for page in reader.pages:
        raw.extend((page.extract_text() or '').split('\n'))

    lines = []
    for line in raw:
        # Sondaki boşluk bilgisi korunmalı: PDF, satır sonunda kelime bitmişse
        # boşluk bırakıyor, kelime ortadan bölünmüşse bırakmıyor. Bu ayrım
        # "rifle " + "n." (boşlukla birleşir) ile "sa" + "nction n."
        # (boşluksuz birleşir) durumlarını ayırmanın tek güvenilir yolu.
        ends_with_space = line.endswith((' ', '\xa0'))
        cleaned = _clean(line)
        # Sayfa üstbilgisi bazen madde satırına yapışıyor:
        # "© Oxford University Press 2 / 8The Oxford 5000™ by CEFR level"
        cleaned = re.sub(r'^©\s*Oxford University Press\s*\d+\s*/\s*\d+', '', cleaned).strip()
        cleaned = re.sub(r'^The Oxford \d+™ by CEFR level', '', cleaned).strip()
        if _is_noise(cleaned):
            continue
        lines.append((cleaned, ends_with_space))

    merged = []
    buffer = ''
    buffer_space = True

    def flush():
        nonlocal buffer
        if buffer:
            merged.append(buffer)
            buffer = ''

    for text, ends_with_space in lines:
        if text in LEVEL_HEADINGS and not buffer:
            flush()
            merged.append(text)
            continue

        if buffer:
            candidate = (buffer + ' ' + text) if buffer_space else (buffer + text)
        else:
            candidate = text

        # 1. POS listesi virgül veya eğik çizgiyle yarım kalmış.
        if candidate.endswith(CONTINUATION_SUFFIXES):
            buffer, buffer_space = candidate, True
            continue

        # 2. Kayıtta hiç sözcük türü yok: satır ya yalnız madde başı, ya da
        #    kelimenin ilk parçası. Devamı sonraki satırda.
        _, _, pos_list = split_headword_and_pos(candidate)
        if pos_list is None:
            buffer, buffer_space = candidate, ends_with_space
            continue

        merged.append(candidate)
        buffer = ''

    flush()
    return merged


def parse_pos_list(text):
    """
    "n., v." veya "det./pron." gibi bir kuyruğu POS listesine çevirir.
    Tanınmayan bir parça varsa None döner (çağıran taraf uyarabilsin).
    """
    parts = [p.strip() for p in re.split(r'[,/]', text) if p.strip()]
    result = []
    for part in parts:
        if part in POS_TOKENS:
            result.append(part)
        else:
            return None
    return result or None


def split_headword_and_pos(text):
    """
    Madde satırını (headword, qualifier, [POS]) üçlüsüne ayırır.
    POS listesi satırın sonundadır; en uzun geçerli kuyruğu arar.
    """
    qualifier = None
    match = re.match(r'^(.*?)\s*\(([^)]*)\)\s*(.*)$', text)
    if match:
        head_part, qualifier, tail = match.group(1), match.group(2), match.group(3)
        pos_list = parse_pos_list(tail)
        if pos_list:
            return head_part.strip(), qualifier.strip(), pos_list
        # Parantez qualifier değilse (beklenmiyor) normal akışa düş.
        qualifier = None

    # Sondan başlayarak en uzun geçerli POS kuyruğunu bul.
    tokens = text.split(' ')
    for start in range(len(tokens)):
        tail = ' '.join(tokens[start:])
        pos_list = parse_pos_list(tail)
        if pos_list:
            head = ' '.join(tokens[:start]).strip()
            if head:
                return head, None, pos_list

    return text.strip(), None, None


def split_homograph(headword):
    """"can1" -> ("can", 1); numarasızsa (headword, None)."""
    match = re.match(r'^(.+?)(\d)$', headword)
    if match:
        return match.group(1), int(match.group(2))
    return headword, None


def parse_source(pdf_path, source_collection):
    """PDF'i kayıt listesine çevirir."""
    entries = []
    level = None
    order = 0
    unparsed = []

    for line in extract_lines(pdf_path):
        if line in LEVEL_HEADINGS:
            level = line
            continue
        if level is None:
            continue

        headword, qualifier, pos_list = split_headword_and_pos(line)
        if not pos_list:
            unparsed.append(line)
            continue

        # "a, an indefinite article" gibi iki madde başı taşıyan satırlar.
        headwords = [h.strip() for h in headword.split(',') if h.strip()]
        base, homograph = split_homograph(headwords[0])

        order += 1
        entries.append({
            'sourceCollection': source_collection,
            'sourceOrder': order,
            'sourceLine': line,
            'headword': base,
            'variants': headwords[1:],
            'homograph': homograph,
            'qualifier': qualifier,
            'cefr': level,
            'posList': pos_list,
        })

    return entries, unparsed


def main():
    targets = [
        (sys.argv[1], 'oxford3000', sys.argv[3]),
        (sys.argv[2], 'oxford5000-extra', sys.argv[4]),
    ]
    for pdf_path, collection, out_path in targets:
        entries, unparsed = parse_source(pdf_path, collection)
        with open(out_path, 'w', encoding='utf-8') as handle:
            json.dump(entries, handle, ensure_ascii=False, indent=2)
            handle.write('\n')

        levels = {}
        for entry in entries:
            levels[entry['cefr']] = levels.get(entry['cefr'], 0) + 1
        print(f'{collection}: {len(entries)} kayıt -> {out_path}')
        for level in sorted(levels):
            print(f'    {level}: {levels[level]}')
        if unparsed:
            print(f'    AYRIŞTIRILAMAYAN {len(unparsed)}:')
            for line in unparsed:
                print(f'      {line!r}')


if __name__ == '__main__':
    main()
