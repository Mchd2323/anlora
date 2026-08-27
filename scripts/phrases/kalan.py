import json, glob, sys
kaynak = json.load(open('scripts/phrases/opl-source.json'))
yazilan = set()
for f in glob.glob('scripts/phrases/content/*.json'):
    yazilan |= {k['kalip'] for k in json.load(open(f))}
kalan = [k for k in kaynak if k['kalip'] not in yazilan]
seviye = sys.argv[1] if len(sys.argv) > 1 else None
bas = int(sys.argv[2]) if len(sys.argv) > 2 else 0
adet = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
liste = [k for k in kalan if not seviye or k['seviye'] == seviye]
print(f"# {seviye or 'hepsi'}: kalan {len(liste)}, toplam kalan {len(kalan)}")
for k in liste[bas:bas+adet]:
    print(k['kalip'])
