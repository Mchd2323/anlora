# -*- coding: utf-8 -*-
"""
Pakete giren HER kaydı denetler: Genel Dağarcık + Oxford + kalıplar.

NEDEN AYRI BİR ARAÇ. Elde iki denetim vardı ve ikisi de bu kusurları
kaçırdı:

  * `yamayi_denetle.py` yalnızca O AN yazılan yamaya bakar. Eski
    turlarda üretilmiş kayıtlar hiç geçmedi.
  * `build_bands.py --strict` yapısal kapıdır: anlam var mı, üç örnek
    var mı, örnek kelimeyi içeriyor mu. Metnin KENDİSİNE bakmaz.

Bu araç pakete girmiş 35.068 anlamın ve 105.204 örnek cümlenin tamamını
tarar. İlk çalıştırıldığında bulduğu ve kapının kaçırdığı gerçek
kusurlar:

  * Türkçe çeviriye karışmış Bengalce, Japonca ve Kiril karakterler
    (4 kayıt) — "odাকে", "taşいていた", "potа çemberi"
  * yazım hatası ("tka basa dolu"), yanlış anlam (scrag -> "göçebe"),
    uydurma sözcük (dukedom -> "dükçülük")
  * örnek cümleye sızmış editör notu: "iktidar (yönetici) partisi",
    "eksik/yetersiz" — öğrencinin göreceği cümlede seçenek sunulmaz
  * küçük harfle başlayan cümleler

BİLİNEN YANLIŞ ALARMLAR — kusur değildir, düzeltilmemelidir:

  * "anlam kelimenin kendisi" (826): Türkçeye aynı yazımla girmiş alıntı
    kelimeler. 819'u "alıntı + açıklama" kalıbında (abaya, adagio);
    7'si tek başına (opera, protein, tsunami) ve Oxford çekirdeğinde,
    o veri salt okunur.
  * "yer tutucu anlam" (2): no -> "yok", absent -> "yok". Doğru çeviri.
  * "çok kısa anlam" (2): that -> "o". Doğru çeviri.
  * "kelimeler arası kopya örnek" (189): bir cümlenin birden çok madde
    başını örneklemesi sözlükte olağandır ("What is your name?" hem
    `what` hem `name` için geçerli).

Kullanım:
    python3 scripts/extended/paket_denetle.py
"""

import json, glob, re, unicodedata
from collections import Counter, defaultdict

def kayitlar():
    for f in sorted(glob.glob('src/data/extended/w-*.json')):
        for e in json.load(open(f,encoding='utf-8')):
            yield 'Genel', e
    for ad,yol in [('Oxford3000','src/data/oxford3000.json'),
                   ('Oxford5000','src/data/oxford5000extra.json'),
                   ('Kalıplar','src/data/phrases.json')]:
        for e in json.load(open(yol,encoding='utf-8')):
            yield ad, e

IZINLI = re.compile(r'^[ -~ -ſ‘’“”–—…]*$')
PLACEHOLDER = re.compile(r'^\s*(-+|\.+|\?+|yok|bilinmiyor|tanım yok|todo|n/?a|null|undefined)\s*$', re.I)
TR_HARF = set('çğıöşüÇĞİÖŞÜ')

kusur = defaultdict(list)
en_sayac = Counter()          # örnek cümle -> kaç kez
en_kimde = defaultdict(set)   # örnek cümle -> hangi kelimeler
anlam_sayac = Counter()
anlam_kimde = defaultdict(set)
toplam_anlam = 0
tr_hic_turkce_harf = 0
tr_uzunluk = []

for kaynak, e in kayitlar():
    w = e['headword']
    for s in e.get('senses', []):
        toplam_anlam += 1
        anlamlar = [m.strip() for m in (s.get('turkishMeanings') or [])]

        if not anlamlar:
            kusur['anlam yok'].append(f'{kaynak} {w}')
        for m in anlamlar:
            if PLACEHOLDER.match(m):
                kusur['yer tutucu anlam'].append(f'{kaynak} {w}: "{m}"')
            if not IZINLI.match(m):
                kotu = [c for c in m if not IZINLI.match(c)]
                kusur['Latin dışı karakter (anlam)'].append(f'{kaynak} {w}: "{m}" -> {kotu}')
            if m.lower() == w.lower():
                kusur['anlam kelimenin kendisi'].append(f'{kaynak} {w}')
            if len(m) < 2:
                kusur['çok kısa anlam'].append(f'{kaynak} {w}: "{m}"')
            anlam_sayac[m.lower()] += 1
            anlam_kimde[m.lower()].add(w)

        ornekler = s.get('examples') or []
        if len(ornekler) < 3:
            kusur['3 örnekten az'].append(f'{kaynak} {w}: {len(ornekler)}')
        gorulen_en = set()
        for x in ornekler:
            en = (x.get('en') or '').strip()
            tr = (x.get('tr') or '').strip()
            if not en or not tr:
                kusur['boş örnek alanı'].append(f'{kaynak} {w}')
                continue
            if en.lower() == tr.lower():
                kusur['çevrilmemiş (tr = en)'].append(f'{kaynak} {w}: "{en}"')
            if not IZINLI.match(tr):
                kotu=[c for c in tr if not IZINLI.match(c)]
                kusur['Latin dışı karakter (tr)'].append(f'{kaynak} {w}: "{tr}" -> {kotu}')
            if not IZINLI.match(en):
                kotu=[c for c in en if not IZINLI.match(c)]
                kusur['Latin dışı karakter (en)'].append(f'{kaynak} {w}: "{en}" -> {kotu}')
            if PLACEHOLDER.match(tr) or PLACEHOLDER.match(en):
                kusur['yer tutucu örnek'].append(f'{kaynak} {w}')
            if en.lower() in gorulen_en:
                kusur['anlam içinde yinelenen örnek'].append(f'{kaynak} {w}: "{en}"')
            gorulen_en.add(en.lower())
            if not TR_HARF & set(tr):
                tr_hic_turkce_harf += 1
            tr_uzunluk.append(len(tr))
            en_sayac[en.lower()] += 1
            en_kimde[en.lower()].add(w)

print(f'Denetlenen anlam: {toplam_anlam}\n')
print('=== YAPISAL KUSURLAR ===')
if not kusur:
    print('  yok')
for k in sorted(kusur, key=lambda k: -len(kusur[k])):
    print(f'  {len(kusur[k]):>6}  {k}')
    for ornek in kusur[k][:4]:
        print(f'            {ornek}')
print()

print('=== KELİMELER ARASI KOPYA ÖRNEK CÜMLE ===')
kopya = [(c,s) for s,c in en_sayac.items() if c>1 and len(en_kimde[s])>1]
print(f'  Birden fazla FARKLI kelimede geçen cümle: {len(kopya)}')
for c,s in sorted(kopya, reverse=True)[:8]:
    print(f'    {c}x  "{s[:70]}"  -> {sorted(en_kimde[s])[:5]}')
print()

print('=== AYNI TÜRKÇE ANLAMI PAYLAŞAN KELİME SAYISI (en çok) ===')
for m,c in anlam_sayac.most_common(10):
    if len(anlam_kimde[m])>1:
        print(f'    {len(anlam_kimde[m]):>4} kelime  "{m}"')
print()
print(f'Türkçe karakter içermeyen çeviri: {tr_hic_turkce_harf} / {len(tr_uzunluk)} '
      f'(%{100*tr_hic_turkce_harf/max(len(tr_uzunluk),1):.1f}) — kısa cümlelerde normal')
print(f'Ortalama çeviri uzunluğu: {sum(tr_uzunluk)/max(len(tr_uzunluk),1):.0f} karakter')
