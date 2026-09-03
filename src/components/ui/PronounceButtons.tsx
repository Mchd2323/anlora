import React, { useState } from 'react';
import { Volume2, Turtle } from 'lucide-react';
import { speakText } from '../../utils/speech';
import { readJSON, writeJSON } from '../../utils/safeStorage';

/**
 * Telaffuz denetimleri: normal hız + yavaş hız.
 *
 * NEDEN İKİ DÜĞME. Yeni başlayan biri için doğal hızdaki İngilizce telaffuz
 * çoğu zaman anlaşılmıyor; kelimeyi duyuyor ama sesleri ayıramıyor. Tek bir
 * düğmeyi yavaşlatmak ise ileri seviyedeki kullanıcıdan doğal telaffuzu alır.
 * İkisi ayrı duruyor: hoparlör her zaman normal hızda çalar, kaplumbağa
 * yavaş çalar.
 *
 * NEDEN HIZ DÜĞMENİN ÜSTÜNDE YAZIYOR. Yavaş düğmesine her basış hem çalar
 * hem de bir sonraki hızı seçer (0,75× → 0,5× → 0,75×). Gizli bir kip
 * olsaydı kullanıcı hangi hızda dinlediğini bilemezdi; sayı düğmenin
 * üstünde durduğu için durum her zaman görünür.
 *
 * Seçim saklanıyor: bir kez 0,5× diyen biri her kartta yeniden seçmek
 * zorunda kalmıyor.
 */

const HIZ_ANAHTARI = 'anlora.yavasTelaffuzHizi.v1';

/** Kullanılabilir yavaş hızlar. Sıra, düğmeye basıldıkça izlenen döngüdür. */
const YAVAS_HIZLAR = [0.75, 0.5] as const;

type YavasHiz = (typeof YAVAS_HIZLAR)[number];

function kayitliHiz(): YavasHiz {
  const deger = readJSON<number>(HIZ_ANAHTARI, YAVAS_HIZLAR[0]);
  return (YAVAS_HIZLAR as readonly number[]).includes(deger) ? (deger as YavasHiz) : YAVAS_HIZLAR[0];
}

/** Hız etiketini Türkçe biçimde yazar: 0.75 → "0,75×". */
function hizEtiketi(hiz: number): string {
  return `${hiz.toString().replace('.', ',')}×`;
}

interface Props {
  /** Okunacak metin (İngilizce kelime ya da cümle). */
  text: string;
  /** Küçük yerleşim: liste satırları ve dar kartlar için. */
  compact?: boolean;
  className?: string;
}

export const PronounceButtons: React.FC<Props> = ({ text, compact = false, className = '' }) => {
  const [yavasHiz, setYavasHiz] = useState<YavasHiz>(kayitliHiz);
  const [calan, setCalan] = useState<'normal' | 'yavas' | null>(null);

  const boyut = compact ? 'p-2' : 'p-2.5';
  const ikon = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';

  /**
   * `hiz` verilmezse uygulamanın kendi varsayılanı (0,85) kullanılır.
   *
   * Normal düğmesi bilerek 1,0 GÖNDERMİYOR: bugünkü telaffuz zaten 0,85 ve
   * doğal duyuluyor. 1,0'a çıkarmak, hız seçeneği eklerken normal telaffuzu
   * hızlandırmak olurdu — kimsenin istemediği bir değişiklik.
   */
  const oku = (kip: 'normal' | 'yavas', hiz?: number) => {
    setCalan(kip);
    // `speakText` reddetmez; hata durumunu kendi tanı akışına bildirir.
    void speakText(text, hiz === undefined ? {} : { rate: hiz }).finally(() => setCalan(null));
  };

  return (
    <div className={`flex items-center gap-1 shrink-0 ${className}`}>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          oku('normal');
        }}
        aria-label={`${text} — normal hızda dinle`}
        title="Telaffuzu dinle"
        className={`${boyut} rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary-soft-hover)] transition-all active:scale-95 cursor-pointer ${
          calan === 'normal' ? 'opacity-70' : ''
        }`}
      >
        <Volume2 className={`${ikon} stroke-[2.2]`} />
      </button>

      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          oku('yavas', yavasHiz);
          // Sonraki basış bir sonraki hızı dener.
          const sonraki = YAVAS_HIZLAR[(YAVAS_HIZLAR.indexOf(yavasHiz) + 1) % YAVAS_HIZLAR.length];
          setYavasHiz(sonraki);
          writeJSON(HIZ_ANAHTARI, sonraki);
        }}
        aria-label={`${text} — yavaş dinle (${hizEtiketi(yavasHiz)}); tekrar dokunmak hızı değiştirir`}
        title={`Yavaş dinle (${hizEtiketi(yavasHiz)}) — tekrar dokunursan hız değişir`}
        className={`${compact ? 'px-1.5 py-1' : 'px-2 py-1.5'} rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)] transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
          calan === 'yavas' ? 'opacity-70' : ''
        }`}
      >
        <Turtle className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span className="text-[10px] font-bold tabular-nums">{hizEtiketi(yavasHiz)}</span>
      </button>
    </div>
  );
};
