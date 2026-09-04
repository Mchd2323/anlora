/**
 * Kelime kartinin ust seridindeki motifin secimi.
 *
 * Pakettten geldi, degeri degistirilmedi: ayni kelime HER ZAMAN ayni motifi
 * alir. Secim kelimenin kendisinden (ve varsa seviye/tur bilgisinden) FNV-1a
 * ozeti ile turuyor; rastgelelik yok, saklanan bir alan yok. Bu yuzden ayni
 * kelime Oxford listesinde ve kullanicinin kendi setinde ayni gorunur.
 *
 * Alti dosya butun kelimelerce ortak kullaniliyor: kelime basina gorsel
 * kopyalanmiyor, veritabanina hicbir sey yazilmiyor, uzaktan indirme yok.
 */
export const REALMS_MOTIFS = [
  { id: 'frost-crystal', icon: 'motif-frost', asset: 'frost-crystal.webp' },
  { id: 'dragon-scale', icon: 'motif-scale', asset: 'dragon-scale.webp' },
  { id: 'raven-feather', icon: 'motif-feather', asset: 'raven-feather.webp' },
  { id: 'ancient-map', icon: 'motif-map', asset: 'ancient-map.webp' },
  { id: 'forged-iron', icon: 'motif-iron', asset: 'forged-iron.webp' },
  { id: 'ember-spark', icon: 'motif-ember', asset: 'ember-spark.webp' }
] as const;

export type RealmsMotif = (typeof REALMS_MOTIFS)[number];

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function motifForWord(word: string, level = '', wordType = ''): RealmsMotif {
  const stableKey = `${word.trim().toLocaleLowerCase('en-US')}|${level}|${wordType}`;
  return REALMS_MOTIFS[fnv1a(stableKey) % REALMS_MOTIFS.length];
}
