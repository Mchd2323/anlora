# -*- coding: utf-8 -*-
"""
ARPAbet (CMUdict) -> IPA dönüştürücü.

Anlora'nın fonetik alanının %41'i geçersizdi: bir kısmı kaynak listeden sızmış
ayrıştırma artığıydı (`/north n., adj.,/`), bir kısmı da IPA yerine kelimenin
yazımıydı (`/opposite/`). Doğru telaffuz göstermek yerine yanlış göstermek
öğrenciye zarar verdiği için alan CMUdict'ten yeniden türetiliyor.

Ağız seçimi: Genel Amerikan İngilizcesi (GenAm). Sebebi tutarlılık değil,
doğruluk: uygulama `speech.ts` içinde varsayılan olarak `en-US` sesiyle okuyor.
Fonetik yazımın, öğrencinin duyduğu sesle aynı ağızda olması gerekir.
"""

# CMUdict fonemi -> IPA. Vurgusuz AH şwa'dır, vurgulu AH ise /ʌ/.
VOWELS = {
    'AA': 'ɑ',  'AE': 'æ',  'AH': 'ʌ',  'AO': 'ɔ',
    'AW': 'aʊ', 'AY': 'aɪ', 'EH': 'ɛ',  'ER': 'ɝ',
    'EY': 'eɪ', 'IH': 'ɪ',  'IY': 'i',  'OW': 'oʊ',
    'OY': 'ɔɪ', 'UH': 'ʊ',  'UW': 'u',
}

CONSONANTS = {
    'B': 'b',  'CH': 'tʃ', 'D': 'd',  'DH': 'ð', 'F': 'f',
    'G': 'ɡ',  'HH': 'h',  'JH': 'dʒ','K': 'k',  'L': 'l',
    'M': 'm',  'N': 'n',   'NG': 'ŋ', 'P': 'p',  'R': 'r',
    'S': 's',  'SH': 'ʃ',  'T': 't',  'TH': 'θ', 'V': 'v',
    'W': 'w',  'Y': 'j',   'Z': 'z',  'ZH': 'ʒ',
}

# İngilizcede hece başında bulunabilen ünsüz kümeleri (azami hece başı ilkesi).
LEGAL_ONSETS = {
    'pl','pr','py','bl','br','by','tr','tw','ty','dr','dw','dy','kl','kr','kw','ky',
    'ɡl','ɡr','ɡw','fl','fr','fy','θr','θw','ʃr','sl','sw','sp','st','sk','sm','sn',
    'spl','spr','str','skr','skw','spy','sty','sky','hy','my','ny','vy','by','ly',
}


def _phone_to_ipa(phone):
    """Tek bir CMUdict fonemini IPA'ya çevirir; (ipa, vurgu) döner."""
    stress = None
    base = phone
    if phone and phone[-1] in '012':
        stress = phone[-1]
        base = phone[:-1]

    if base in VOWELS:
        # Vurgusuz AH şwa'dır: "about" -> əˈbaʊt, "cut" -> kʌt
        if base == 'AH' and stress == '0':
            return 'ə', stress
        if base == 'ER' and stress == '0':
            return 'ɚ', stress
        return VOWELS[base], stress

    return CONSONANTS.get(base, ''), None


def _syllabify(units):
    """
    (ipa, is_vowel, stress) listesini hecelere böler.

    Azami hece başı ilkesi: iki ünlü arasındaki ünsüzler, sonraki hecenin
    başında geçerli bir küme oluşturduğu sürece o heceye verilir.
    """
    vowel_positions = [i for i, u in enumerate(units) if u[1]]
    if not vowel_positions:
        return [units]

    syllables = []
    start = 0
    for idx, vpos in enumerate(vowel_positions):
        if idx == len(vowel_positions) - 1:
            syllables.append(units[start:])
            break

        next_vpos = vowel_positions[idx + 1]
        cluster = units[vpos + 1:next_vpos]

        # Kümeden sonraki heceye verilebilecek en uzun geçerli başı bul.
        onset_len = 0
        for take in range(len(cluster), 0, -1):
            candidate = ''.join(u[0] for u in cluster[-take:])
            if take == 1 or candidate in LEGAL_ONSETS:
                onset_len = take
                break

        split_at = next_vpos - onset_len
        syllables.append(units[start:split_at])
        start = split_at

    return [s for s in syllables if s]


def arpabet_to_ipa(phones):
    """
    CMUdict foneme listesini vurgu işaretli IPA dizesine çevirir.
    Örnek: ['AH0','B','AW1','T'] -> 'əˈbaʊt'
    """
    units = []
    for phone in phones:
        ipa, stress = _phone_to_ipa(phone)
        if not ipa:
            continue
        is_vowel = phone.rstrip('012') in VOWELS
        units.append((ipa, is_vowel, stress))

    if not units:
        return ''

    syllables = _syllabify(units)
    out = []
    for syllable in syllables:
        stress = next((u[2] for u in syllable if u[1]), None)
        if stress == '1':
            out.append('ˈ')
        elif stress == '2':
            out.append('ˌ')
        out.append(''.join(u[0] for u in syllable))

    result = ''.join(out)
    # Tek heceli kelimede vurgu işareti gereksizdir: /kʌt/, /ˈkʌt/ değil.
    if len([u for u in units if u[1]]) == 1:
        result = result.replace('ˈ', '').replace('ˌ', '')
    return result


def load_cmudict(path):
    """CMUdict dosyasını {kelime: [foneme, ...]} sözlüğüne okur."""
    entries = {}
    with open(path, encoding='utf-8') as handle:
        for line in handle:
            line = line.split('#')[0].strip()
            if not line:
                continue
            parts = line.split()
            word = parts[0]
            # "read(2)" gibi alternatif okuyuşlar: yalnızca ilkini al.
            if '(' in word:
                continue
            entries[word.lower()] = parts[1:]
    return entries
