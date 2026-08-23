# -*- coding: utf-8 -*-
"""
Anlora – Genel Dağarcık kelime listesini üretir.

Oxford çekirdeği (4.952 kelime) resmî listelerden geliyor ve dokunulmaz.
Bu betik onun üstüne, uygulamayı 10.000 kelimeye taşıyan ikinci bir katman
kurar. Amaç kapsamı büyütmek: kullanıcı kendi kelimesini eklediğinde çoğu
zaman zaten listede bulunsun, yapay zekâya ihtiyaç istisna olsun.

Kelimeler sıklık sırasına göre seçilir; yani listeye giren 5.048 kelime,
Oxford'da bulunmayanlar arasında günlük İngilizcede en sık geçenlerdir.

KAYNAKLAR (ikisi de yeniden dağıtıma izin veriyor)

  1. Open English WordNet — CC BY 4.0, Princeton WordNet'ten türetilmiştir.
     Hangi dizilimin gerçek bir İngilizce sözcük olduğunu ve sözcük türünü
     buradan alıyoruz. Ayrıca girdilerin bir kısmında IPA telaffuz var.
     https://github.com/globalwordnet/english-wordnet  (src/yaml/entries-*.yaml)

  2. OpenSubtitles frekans listesi (hermitdave/FrequencyWords) — MIT.
     Hangi kelimenin daha önce öğretileceğini belirler. Ham liste sıralama
     için kullanılır, kelime dağarcığının kendisi WordNet'ten gelir.
     https://github.com/hermitdave/FrequencyWords  (content/2018/en/en_full.txt)

  3. Ad veritabanı (smashew/NameDatabases) — özel adları elemek için.
     https://github.com/smashew/NameDatabases

NEDEN SADECE FREKANS LİSTESİ YETMEZ

Frekans listesi film altyazılarından çıkarılmıştır ve çekimlenmemiştir:
`going`, `said`, `things` gibi zaten sahip olduğumuz kelimelerin biçimleri,
`john`/`mike` gibi özel adlar, `ain`/`haven` gibi kesme işareti kırıntıları
ve altyazı gürültüsü içerir. Ham hâliyle alınsaydı listenin başı işe
yaramaz kayıtlarla dolardı. Bu yüzden dört süzgeçten geçirilir:

  * WordNet'te lemma olarak geçmeyen atılır (çekim ve uydurma dizilimler),
  * mevcut Oxford dağarcığındaki bir kelimenin çekimi atılır,
  * özel adlar atılır (gerçek sözcük de olanlar NAME_BUT_REAL ile korunur),
  * müstehcen ve aşağılayıcı terimler atılır (öğrenci hedefli bir uygulama).

KULLANIM

    # Girdileri indir (depoya konmayacak kadar büyükler)
    mkdir -p /tmp/anlora-src && cd /tmp/anlora-src
    for L in a b c d e f g h i j k l m n o p q r s t u v w x y z; do
      curl -sO "https://raw.githubusercontent.com/globalwordnet/english-wordnet/main/src/yaml/entries-$L.yaml"
    done
    curl -sO "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_full.txt"
    curl -sLo names.txt "https://raw.githubusercontent.com/smashew/NameDatabases/master/NamesDatabases/first%20names/all.txt"

    python3 scripts/extended/build_wordlist.py /tmp/anlora-src

Çıktı: scripts/extended/source/wordlist.json (depoya işlenir).
"""

import glob
import json
import os
import re
import sys
from collections import Counter

TARGET = 5048           # 4.952 Oxford + 5.048 = 10.000
BAND_SIZE = 2000        # Uygulama bantları tembel yükler; bkz. src/services

CORE_FILES = [
    'src/data/oxford3000.json',
    'src/data/oxford5000extra.json',
]
IRREGULAR_FILE = 'src/data/irregularInflections.json'
OUT_FILE = 'scripts/extended/source/wordlist.json'

POS_MAP = {'n': 'n.', 'v': 'v.', 'a': 'adj.', 's': 'adj.', 'r': 'adv.'}

# Müstehcen sözcükler. Uygulama öğrencilere yönelik; bu kelimeler dilin
# parçası olsa da kelime kartı olarak öğretilmez.
VULGAR = {
    'shit', 'fuck', 'fucking', 'fucked', 'fucker', 'bitch', 'ass', 'asshole',
    'cunt', 'dick', 'cock', 'pussy', 'puss', 'prick', 'whore', 'slut',
    'bastard', 'damn', 'goddamn', 'crap', 'penis', 'vagina', 'semen', 'porn',
    'porno', 'pornography', 'tit', 'tits', 'boob', 'boobs', 'wanker',
    'bollocks', 'arse', 'piss', 'turd', 'horny', 'orgasm', 'masturbate',
    'masturbation', 'sperm', 'anal', 'erection', 'brothel', 'pimp', 'hooker',
    'rape', 'rapist', 'molest', 'incest', 'nipple', 'buttocks', 'testicle',
    'screwing', 'banging', 'bugger', 'twat', 'shitty', 'bullshit', 'dammit',
    'sodomy', 'fornication', 'pubic', 'scrotum', 'genitalia',
    'motherfucker', 'motherfucking', 'pissed', 'jackass', 'dumbass', 'badass',
    'douche', 'douchebag', 'skank', 'hump', 'humping', 'boner', 'wank',
}

# Aşağılayıcı ve ırkçı terimler.
SLUR = {
    'nigger', 'faggot', 'fag', 'coon', 'wop', 'kike', 'chink', 'gook', 'spic',
    'honky', 'retard', 'retarded', 'cripple', 'midget', 'tranny', 'dyke',
    'negro', 'mulatto', 'savage', 'nigga', 'niggas', 'niggaz', 'jap', 'paki',
    'raghead', 'towelhead', 'wetback', 'gyp', 'gypped', 'spaz', 'mong',
}

# Ünlem, ses taklidi, konuşma dili kısaltmaları ve altyazı artıkları.
NOISE = {
    'ain', 'ooh', 'aah', 'ahh', 'ohh', 'blah', 'huh', 'hmm', 'mmm', 'whoa',
    'wow', 'oops', 'ouch', 'shh', 'psst', 'yay', 'hooray', 'gee', 'golly',
    'jeez', 'geez', 'sync', 'subtitles', 'www', 'com', 'http', 'yeah', 'yep',
    'nope', 'okay', 'uhh', 'umm', 'hey', 'heh', 'hah', 'duh', 'meh', 'yikes',
    'whee', 'yow', 'argh', 'ugh', 'pfft', 'tsk', 'eek', 'aha', 'oho', 'ahem',
    'brr', 'phew', 'kinda', 'gonna', 'wanna', 'gotta', 'lemme', 'gimme',
    'dunno', 'yah', 'nah', 'uhm', 'mmhmm', 'haven', 'don', 'cos', 'thou',
    'bleep', 'bleeps', 'bleeping',
    # Altyazı ses notlarından gelenler: [panting], [indistinct chatter] gibi
    # köşeli parantezli açıklamalar sözcük sayımına karışıyor.
    'indistinct', 'panting', 'chattering', 'sobbing', 'growling', 'grunting',
    'whimpering', 'wheezing', 'clanking', 'rustling', 'sniffling', 'gasping',
    'snoring', 'slurping', 'squealing', 'screeching', 'whirring', 'beeping',
    'clattering', 'thudding', 'clanging', 'crackling', 'sizzling', 'gurgling',
    'humming', 'chanting', 'roaring', 'rumbling', 'coughing', 'buzzing',
    'wailing', 'muffled', 'indistinctly', 'whistling',
    # Kural tabanli suzgecin kaciridiklari: -ed/-ing/-s bicimleri ve
    # Amerikan yazimlari. Kurali genellestirmek `hammer`->`ham`,
    # `supper`->`sup` gibi yanlis eslesmeler uretiyor, bu yuzden tek tek.
    'realised', 'colors', 'honored', 'favored', 'labored', 'flavored',
    'neighbors', 'behaviors', 'rumors', 'humors', 'odors', 'vapors',
    # Kurgu ve marka adlari
    'batman', 'superman', 'spiderman', 'godzilla', 'tarzan',
    # Ozel ad suzgecinin kaciridiklari
    'marshall', 'graham', 'murphy', 'harper', 'troy', 'khan', 'franklin',
    'yang', 'soviet', 'nazi', 'brazil', 'catholic', 'protestant',
}

# Ad veritabanında geçen ama günlük İngilizcede gerçek bir sözcük olanlar.
# Ad süzgeci bunları elemez; aksi hâlde `wolf`, `sheriff`, `fairy` gibi
# öğretilmesi gereken kelimeleri kaybederdik.
NAME_BUT_REAL = {
    'wolf', 'sheriff', 'fairy', 'clay', 'elder', 'soda', 'chin', 'ram', 'yen',
    'chuck', 'mason', 'wade', 'lance', 'victor', 'dean', 'graham', 'roman',
    'china', 'savanna', 'azalea', 'leer', 'canto', 'florin', 'romaine', 'burl',
    'marshall', 'rocky', 'warren', 'destiny', 'hug', 'pal', 'darling', 'alpha',
    'earl', 'fella', 'troy', 'khan', 'yang', 'franklin', 'carter', 'herald',
    'baron', 'duke', 'king', 'queen', 'rose', 'bill', 'mark', 'will', 'may',
    'june', 'art', 'hope', 'grace', 'faith', 'crystal', 'daisy', 'iris',
    'jasmine', 'olive', 'pearl', 'ruby', 'summer', 'sunny', 'dawn', 'rich',
    'frank', 'carol', 'holly', 'ivy', 'lily', 'violet', 'amber', 'jade',
    'sage', 'heather', 'robin', 'jay', 'drake', 'falcon', 'hawk', 'fox',
    'bear', 'colt', 'buck', 'brook', 'glen', 'dale', 'forest', 'river',
    'stone', 'field', 'moss', 'reed', 'vale', 'ford', 'cliff', 'ray', 'sky',
    'star', 'angel', 'joy', 'melody', 'harmony', 'justice', 'honor', 'noble',
    'chance', 'major', 'minor', 'sterling', 'chase', 'trace', 'miles',
    'wheeler', 'porter', 'baker', 'cooper', 'carver', 'fisher', 'hunter',
    'miller', 'parker', 'taylor', 'turner', 'walker', 'ward',
}


def load_wordnet(src_dir):
    """entries-*.yaml dosyalarından lemma -> {POS} ve lemma -> IPA çıkarır.

    YAML'i tam ayrıştırmak yerine yapı satır düzeyinde okunur: girdi
    başlıkları sütun sıfırda, sözcük türleri iki boşluk girintide durur.
    Dosyalar toplam 23 MB; tam ayrıştırıcı gereksiz yere yavaş olurdu.
    """
    pos_by_word = {}
    ipa_by_word = {}
    current = None
    expecting_pron = False

    paths = sorted(glob.glob(os.path.join(src_dir, 'entries-*.yaml')))
    if not paths:
        sys.exit(f'WordNet dosyaları bulunamadı: {src_dir}/entries-*.yaml')

    for path in paths:
        with open(path, encoding='utf-8') as handle:
            for line in handle:
                if line and not line[0].isspace() and line.rstrip().endswith(':'):
                    current = line.rstrip()[:-1].strip("'\"")
                    expecting_pron = False
                elif current and re.fullmatch(r'  ([nvasr]):\n', line):
                    pos_by_word.setdefault(current, set()).add(POS_MAP[line.strip()[0]])
                elif current and line.strip() == 'pronunciation:':
                    expecting_pron = True
                elif current and expecting_pron and line.strip().startswith('- value:'):
                    ipa_by_word.setdefault(current, line.split('value:', 1)[1].strip())
                    expecting_pron = False

    # Yalnızca küçük harfli, saf alfabetik girdiler: büyük harfliler özel
    # adlardır, tire ve boşluk taşıyanlar çok sözcüklü ifadelerdir.
    return (
        {w: p for w, p in pos_by_word.items() if re.fullmatch(r'[a-z]+', w)},
        ipa_by_word,
    )


def load_core_vocabulary():
    words = set()
    for path in CORE_FILES:
        with open(path, encoding='utf-8') as handle:
            for entry in json.load(handle):
                words.add(entry['headword'].lower())
    return words


def spelling_variants(word):
    """Aynı kelimenin öteki yazımlarını üretir (Amerikan <-> İngiliz).

    Oxford çekirdeği İngiliz yazımını kullanıyor; frekans listesi ise film
    altyazılarından geldiği için ağırlıkla Amerikan yazımını taşıyor.
    Süzülmezse `color`, `honor`, `theater`, `defense` gibi onlarca kelime
    zaten öğretilen sözcüklerin ikinci bir kartı olarak listeye girerdi.
    Bunlar yeni kelime değil, aynı kelimenin başka yazımıdır.
    """
    out = set()
    pairs = [
        ('or', 'our'), ('ors', 'ours'), ('ored', 'oured'), ('oring', 'ouring'),
        ('er', 're'), ('ers', 'res'),
        ('ize', 'ise'), ('izes', 'ises'), ('ized', 'ised'), ('izing', 'ising'),
        ('ization', 'isation'), ('izer', 'iser'),
        ('yze', 'yse'), ('yzed', 'ysed'), ('yzing', 'ysing'),
        ('ense', 'ence'), ('enses', 'ences'),
        ('og', 'ogue'), ('ogs', 'ogues'),
        ('eled', 'elled'), ('eling', 'elling'), ('eler', 'eller'),
        ('eled', 'elled'), ('ealed', 'ealled'),
    ]
    for us, uk in pairs:
        if word.endswith(us):
            out.add(word[:-len(us)] + uk)
        if word.endswith(uk):
            out.add(word[:-len(uk)] + us)
    # neighborhood -> neighbourhood gibi kök içi farklar
    if 'or' in word:
        out.add(word.replace('or', 'our', 1))
    if 'our' in word:
        out.add(word.replace('our', 'or', 1))
    if word.startswith('ae'):
        out.add(word[1:])
    out.discard(word)
    return out


def inflection_bases(word, irregular):
    """`word` hangi köklerden türemiş olabilir?

    Amaç kesinlik değil, elemek: üretilen adaylardan biri mevcut dağarcıkta
    varsa kelime zaten öğretiliyor demektir ve listeye ikinci kez girmemeli.
    """
    out = set()
    if word in irregular:
        out.add(irregular[word])
    if word.endswith('ying') and len(word) >= 5:
        out.add(word[:-4] + 'ie')                      # lying -> lie
    if word.endswith('ies') and len(word) > 4:
        out.add(word[:-3] + 'y')
    if word.endswith('es') and len(word) > 3:
        out |= {word[:-2], word[:-1]}
    if word.endswith('s') and not word.endswith('ss') and len(word) > 3:
        out.add(word[:-1])
    if word.endswith('ied') and len(word) > 4:
        out.add(word[:-3] + 'y')
    if word.endswith('ed') and len(word) > 3:
        out |= {word[:-2], word[:-1]}
        if len(word) > 4 and word[-3] == word[-4]:
            out.add(word[:-3])                          # stopped -> stop
    if word.endswith('ing') and len(word) > 4:
        out |= {word[:-3], word[:-3] + 'e'}
        if len(word) > 5 and word[-4] == word[-5]:
            out.add(word[:-4])                          # running -> run
    if word.endswith('er') and len(word) > 4:
        out |= {word[:-2], word[:-1]}
        if word[-3] == word[-4]:
            out.add(word[:-3])                          # bigger -> big
        if word.endswith('ier'):
            out.add(word[:-3] + 'y')                    # earlier -> early
    if word.endswith('est') and len(word) > 5:
        out |= {word[:-3], word[:-2]}
        if word[-4] == word[-5]:
            out.add(word[:-4])                          # biggest -> big
        if word.endswith('iest'):
            out.add(word[:-4] + 'y')                    # earliest -> early
    if word.endswith('ily') and len(word) > 4:
        out.add(word[:-3] + 'y')
    if word.endswith('ly') and len(word) > 4:
        out |= {word[:-2], word[:-2] + 'e'}
    return out


def main():
    src_dir = sys.argv[1] if len(sys.argv) > 1 else '/tmp/anlora-src'

    pos_by_word, ipa_by_word = load_wordnet(src_dir)
    core = load_core_vocabulary()

    with open(IRREGULAR_FILE, encoding='utf-8') as handle:
        irregular = {
            k.lower(): v['base'].lower() for k, v in json.load(handle).items()
        }

    names_path = os.path.join(src_dir, 'names.txt')
    with open(names_path, encoding='utf-8') as handle:
        names = {line.strip().lower() for line in handle if line.strip()}

    freq_path = os.path.join(src_dir, 'en_full.txt')
    ranked = []
    seen = set()
    with open(freq_path, encoding='utf-8') as handle:
        for line in handle:
            parts = line.split()
            if len(parts) == 2 and parts[0] not in seen:
                seen.add(parts[0])
                ranked.append(parts[0])

    dropped = Counter()
    selected = []
    chosen = set()          # seçilenler; kendi içinde çekim tekrarını önler
    for word in ranked:
        if len(selected) >= TARGET:
            break
        if word not in pos_by_word:
            continue
        if word in core:
            dropped['zaten_var'] += 1
        elif len(word) < 3:
            dropped['cok_kisa'] += 1
        elif word in VULGAR or word in SLUR:
            dropped['uygunsuz'] += 1
        elif word in NOISE:
            dropped['gurultu'] += 1
        elif word in names and word not in NAME_BUT_REAL:
            dropped['ozel_ad'] += 1
        elif any(base in core or base in chosen
                 for base in inflection_bases(word, irregular)):
            # Kök ya Oxford'da ya da bu listede zaten seçilmiş. `hum` seçildiyse
            # `humming` ikinci bir kart olarak girmemeli.
            dropped['cekim'] += 1
        elif any(variant in core or variant in chosen
                 for variant in spelling_variants(word)):
            dropped['yazim_varyanti'] += 1
        else:
            selected.append(word)
            chosen.add(word)

    if len(selected) < TARGET:
        sys.exit(f'Yalnızca {len(selected)} kelime seçilebildi, {TARGET} gerekli.')

    entries = [
        {
            'word': word,
            'pos': sorted(pos_by_word[word]),
            'rank': index + 1,
            'band': index // BAND_SIZE + 1,
            'ipa': ipa_by_word.get(word),
        }
        for index, word in enumerate(selected)
    ]

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, 'w', encoding='utf-8') as handle:
        json.dump(entries, handle, ensure_ascii=False, indent=1)
        handle.write('\n')

    senses = sum(len(e['pos']) for e in entries)
    with_ipa = sum(1 for e in entries if e['ipa'])
    bands = Counter(e['band'] for e in entries)

    print(f'Elenen: {dict(dropped)}')
    print(f'Seçilen: {len(entries)} kelime, {senses} anlam')
    print(f'Telaffuzu WordNet\'ten gelen: {with_ipa}')
    print(f'Bantlar: {dict(sorted(bands.items()))}')
    print(f'Yazıldı: {OUT_FILE}')


if __name__ == '__main__':
    main()
