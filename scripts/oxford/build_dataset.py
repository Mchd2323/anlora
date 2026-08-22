# -*- coding: utf-8 -*-
"""
Resmî Oxford kaynaklarını ve mevcut Anlora içeriğini tek bir sense-aware
veri kümesinde birleştirir.

TEMEL KURAL (talimat 2): DOĞRUYSA KORU, HATALIYSA DÜZELT, EKSİKSE EKLE.
Mevcut doğru Türkçe anlamlar ve örnek cümleler korunur; kaynak yapısal
bilgide (headword, CEFR, POS, qualifier, homograf, sıra) otoritedir.

YAPI
Her kaynak SATIRI bir kayıttır; satırdaki her POS ayrı bir sense olur
(talimat 7). "boost v., n." tek kayıt, iki sense demektir.

KİMLİK (talimat 16)
ID deterministiktir ve dataset + CEFR + headword + qualifier + homograf
üzerinden üretilir. Sıra numarası ya da rastgele son ek KULLANILMAZ, çünkü
kullanıcı ilerlemesi bu kimliklere bağlanır ve liste güncellenince kaymamalıdır.

İÇERİK TAŞIMA KURALI (talimat 6)
Mevcut bir kayıt birden çok POS taşıyorsa ("light" -> "adj., n." ve anlam
"açık (renk), hafif") hangi Türkçe karşılığın hangi POS'a ait olduğu
belirsizdir. Böyle bir anlamı tek bir sense'e taşımak yanlış POS anlamı
yazmak olur; bu yüzden taşınmaz, kayıt needsReview olarak işaretlenir.
Uydurma veri yazılmaz (talimat 59).
"""

import json
import re
import collections

SOURCE_3000 = 'scripts/oxford/source/oxford3000.source.json'
SOURCE_5000 = 'scripts/oxford/source/oxford5000extra.source.json'

CORE_FILES = ['src/data/wordsA1.json', 'src/data/wordsA2.json',
              'src/data/wordsB1.json', 'src/data/wordsB2.json']
EXTRA_FILE = 'src/data/oxford5000ExtraB2.json'

OUT_3000 = 'src/data/oxford3000.json'
OUT_5000 = 'src/data/oxford5000extra.json'
ID_MAP_OUT = 'src/data/oxfordIdMigration.json'
REVIEW_OUT = 'scripts/oxford/needs_review.json'

DATASET_PREFIX = {'oxford3000': 'ox3k', 'oxford5000-extra': 'ox5k'}

POS_SLUG = {
    'n.': 'n', 'v.': 'v', 'adj.': 'adj', 'adv.': 'adv', 'prep.': 'prep',
    'conj.': 'conj', 'pron.': 'pron', 'det.': 'det', 'exclam.': 'exclam',
    'number': 'num', 'modal v.': 'modal', 'auxiliary v.': 'aux',
    'indefinite article': 'art', 'definite article': 'art',
    'infinitive marker': 'inf',
}

PLACEHOLDER_PATTERNS = [
    'otomatik anlam', '(anlam)', 'todo', 'anlam giriniz', 'undefined', 'null',
    '(isim)', '(fiil)', '(sıfat)', '(zarf)', 'kelimesi',
]


def load(path):
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def slugify(value):
    text = (value or '').strip().lower()
    text = re.sub(r"[^a-z0-9]+", '-', text)
    return text.strip('-')


def make_entry_id(collection, cefr, headword, qualifier, homograph):
    """Deterministik, kaynak sırasından bağımsız kimlik."""
    parts = [DATASET_PREFIX[collection], cefr.lower(), slugify(headword)]
    if homograph:
        parts.append(str(homograph))
    if qualifier:
        parts.append(slugify(qualifier)[:24])
    return '-'.join(p for p in parts if p)


def make_sense_id(entry_id, pos, index):
    return f'{entry_id}-{POS_SLUG.get(pos, slugify(pos) or f"s{index}")}'


def parse_pos_string(value):
    return [p.strip() for p in re.split(r'[,/]', value or '') if p.strip()]


def split_meanings(value):
    """"emmek, içine çekmek" -> ["emmek", "içine çekmek"]"""
    parts = [p.strip() for p in (value or '').split(',') if p.strip()]
    return parts


def is_placeholder(meaning):
    text = (meaning or '').strip().lower()
    if not text:
        return True
    return any(pattern in text for pattern in PLACEHOLDER_PATTERNS)


def build_existing_index():
    """
    Mevcut içeriği (headword, pos) -> kayıt biçiminde indeksler.

    `posCount` alanı, kaydın kaç POS taşıdığını söyler; birden çoksa Türkçe
    anlamın hangi POS'a ait olduğu belirsizdir ve taşınamaz.
    """
    index = collections.defaultdict(list)

    for path in CORE_FILES:
        for record in load(path):
            head = (record.get('word') or '').strip().lower()
            pos_list = parse_pos_string(record.get('partOfSpeech'))
            for pos in pos_list:
                index[(head, pos)].append({
                    'kind': 'core',
                    'id': record.get('id'),
                    'level': record.get('level'),
                    'meaning': record.get('turkishMeaning'),
                    'examples': record.get('examples') or [],
                    'examplesVerified': record.get('examplesVerified', True),
                    'phonetic': record.get('phonetic'),
                    'posCount': len(pos_list),
                })

    for record in load(EXTRA_FILE):
        head = (record.get('headword') or '').strip().lower()
        for sense in record.get('senses') or []:
            pos = (sense.get('partOfSpeech') or record.get('partOfSpeech') or '').strip()
            if not pos:
                continue
            index[(head, pos)].append({
                'kind': 'extra',
                'id': record.get('id'),
                'level': record.get('cefr'),
                'meanings': sense.get('turkishMeanings') or [],
                'meaning': record.get('turkishMeaning'),
                'examples': sense.get('examples') or [],
                'examplesVerified': True,
                'phonetic': None,
                'posCount': 1,
            })

    return index


def normalize_examples(examples):
    """Örnekleri tek biçime getirir ve eksik/bozuk olanları eler."""
    result = []
    for example in examples or []:
        english = (example.get('en') or example.get('english') or '').strip()
        turkish = (example.get('tr') or example.get('turkish') or '').strip()
        if english and turkish:
            result.append({'en': english, 'tr': turkish})
    return result


def build():
    sources = load(SOURCE_3000) + load(SOURCE_5000)
    existing = build_existing_index()

    entries_3000 = []
    entries_5000 = []
    id_map = {}
    review = []
    stats = collections.Counter()
    seen_ids = {}

    for source in sources:
        collection = source['sourceCollection']
        headword = source['headword']
        qualifier = source.get('qualifier')
        homograph = source.get('homograph')
        cefr = source['cefr']

        entry_id = make_entry_id(collection, cefr, headword, qualifier, homograph)
        # Kimlik çakışması olamaz; olursa kaynak satırıyla ayrıştır.
        if entry_id in seen_ids:
            entry_id = f'{entry_id}-{slugify(source["sourceLine"])[:12]}'
        seen_ids[entry_id] = source['sourceLine']

        senses = []
        legacy_meaning = None
        for index, pos in enumerate(source['posList'], start=1):
            candidates = existing.get((headword.strip().lower(), pos), [])

            meanings = []
            examples = []
            carried_from = None

            for candidate in candidates:
                # Tek POS taşıyan kayıtta anlam bu POS'a aittir; çok POS
                # taşıyanda hangi karşılığın hangi POS'a ait olduğu belirsiz.
                if candidate.get('meanings'):
                    meanings = list(candidate['meanings'])
                elif candidate['posCount'] == 1 and not is_placeholder(candidate.get('meaning')):
                    meanings = split_meanings(candidate['meaning'])
                elif not is_placeholder(candidate.get('meaning')):
                    # POS'a atanamayan ama mevcut uygulamada gösterilen anlam.
                    # Kayıt düzeyinde saklanır: sense'e yazmak yanlış POS
                    # anlamı koymak olurdu (talimat 6), tamamen atmak ise
                    # kullanıcının bugün gördüğü bilgiyi kaybetmek olurdu.
                    legacy_meaning = legacy_meaning or (candidate.get('meaning') or '').strip()

                if candidate.get('examplesVerified', True):
                    examples = normalize_examples(candidate['examples'])

                if meanings or examples:
                    carried_from = candidate['id']
                    break

            sense = {
                'id': make_sense_id(entry_id, pos, index),
                'partOfSpeech': pos,
                'turkishMeanings': meanings,
                'examples': examples,
            }
            senses.append(sense)

            if meanings and len(examples) >= 3:
                stats['sense_tam'] += 1
            elif meanings:
                stats['sense_anlam_var_ornek_yok'] += 1
            else:
                stats['sense_anlam_yok'] += 1

            if carried_from:
                id_map.setdefault(carried_from, entry_id)

        needs_review = any(
            not sense['turkishMeanings'] or len(sense['examples']) < 3
            for sense in senses
        )

        entry = {
            'id': entry_id,
            'headword': headword,
            'cefr': cefr,
            'sourceCollection': collection,
            'sourceOrder': source['sourceOrder'],
            'sourceEntry': source['sourceLine'],
            'senses': senses,
        }
        if legacy_meaning and not any(sense['turkishMeanings'] for sense in senses):
            # Sense'lere güvenle dağıtılamayan eski anlam. Arayüz, sense
            # anlamları hazırlanana kadar bunu yedek olarak gösterir.
            entry['legacyMeaning'] = legacy_meaning
        if qualifier:
            entry['qualifier'] = qualifier
        if homograph:
            entry['homograph'] = homograph
        if source.get('variants'):
            entry['variants'] = source['variants']

        # Fonetik: mevcut veriden taşınabiliyorsa taşı.
        for pos in source['posList']:
            for candidate in existing.get((headword.strip().lower(), pos), []):
                if candidate.get('phonetic'):
                    entry['phonetic'] = candidate['phonetic']
                    break
            if entry.get('phonetic'):
                break

        if needs_review:
            entry['needsReview'] = True
            missing_bits = []
            if any(not s['turkishMeanings'] for s in senses):
                missing_bits.append('anlam')
            if any(len(s['examples']) < 3 for s in senses):
                missing_bits.append('örnek')
            entry['reviewReason'] = ' + '.join(missing_bits) + ' eksik'
            review.append({
                'id': entry_id,
                'headword': headword,
                'qualifier': qualifier,
                'cefr': cefr,
                'sourceCollection': collection,
                'sourceEntry': source['sourceLine'],
                'posList': source['posList'],
                'missing': missing_bits,
            })
            stats['kayit_needs_review'] += 1
        else:
            stats['kayit_tam'] += 1

        (entries_3000 if collection == 'oxford3000' else entries_5000).append(entry)

    for path, data in ((OUT_3000, entries_3000), (OUT_5000, entries_5000)):
        with open(path, 'w', encoding='utf-8') as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write('\n')

    with open(ID_MAP_OUT, 'w', encoding='utf-8') as handle:
        json.dump(id_map, handle, ensure_ascii=False, indent=2)
        handle.write('\n')

    with open(REVIEW_OUT, 'w', encoding='utf-8') as handle:
        json.dump(review, handle, ensure_ascii=False, indent=2)
        handle.write('\n')

    print('OXFORD VERİ KÜMESİ OLUŞTURULDU')
    print(f'  Oxford 3000 kayıt      : {len(entries_3000)}')
    print(f'  Oxford 5000 Ek kayıt   : {len(entries_5000)}')
    print(f'  Toplam kayıt           : {len(entries_3000) + len(entries_5000)}')
    print(f'  Toplam sense           : {sum(stats[k] for k in ("sense_tam", "sense_anlam_var_ornek_yok", "sense_anlam_yok"))}')
    print()
    print(f'  Tam sense (anlam + 3 örnek)      : {stats["sense_tam"]}')
    print(f'  Anlamı var, örneği eksik         : {stats["sense_anlam_var_ornek_yok"]}')
    print(f'  Anlamı yok                       : {stats["sense_anlam_yok"]}')
    legacy = sum(1 for e in entries_3000 + entries_5000 if e.get('legacyMeaning'))
    print(f'  Kayıt düzeyi yedek anlam (legacy) : {legacy}')
    print()
    print(f'  Tam kayıt                        : {stats["kayit_tam"]}')
    print(f'  needsReview kayıt                : {stats["kayit_needs_review"]}')
    print(f'  Eski -> yeni ID eşlemesi         : {len(id_map)}')


if __name__ == '__main__':
    build()
