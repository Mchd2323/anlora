import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { speakText } from '../../utils/speech';
import { RealmsIcon } from '../ui/RealmsIcon';
import {
  HIZ_SECENEKLERI,
  TelaffuzHizi,
  hizEtiketi,
  hizRozeti,
  varsayilanHiziDinle,
  varsayilanHiziOku,
  varsayilanHiziYaz
} from '../../utils/speechRate';

/**
 * Telaffuz denetimi: hoparlör + hız rozeti.
 *
 * NEDEN İKİ PARÇA. Yeni başlayan biri doğal hızdaki İngilizcede sesleri
 * ayıramıyor; ama tek düğmeyi kalıcı olarak yavaşlatmak ileri seviyedeki
 * kullanıcıdan doğal telaffuzu alır. Bu yüzden hoparlör her zaman "çal"
 * demek, yanındaki küçük rozet ise "hangi hızda" demek.
 *
 * NEDEN HIZ YAZIYOR. Gizli bir kip olsaydı kullanıcı hangi hızda dinlediğini
 * bilemezdi. Rozet o anki hızı gösteriyor, dokununca menü açılıyor, seçilen
 * hız hemen çalıyor.
 *
 * KART SEÇİMİ GEÇİCİDİR. Menüden seçilen hız yalnızca o kart için geçerli;
 * sonraki kartta varsayılana dönülür. Her kelimenin ayrı ve görünmeyen bir
 * hızı olsaydı, kullanıcı "bu kelime neden yavaş çalıyor" diye sorardı ve
 * cevabı hiçbir ekranda bulamazdı. Kalıcı isteyen için menünün altında
 * "Tüm kartlarda kullan" var — profile gitmeye gerek kalmıyor.
 */

interface Props {
  /** Okunacak metin (İngilizce kelime ya da cümle). */
  text: string;
  /** Küçük yerleşim: liste satırları ve dar kartlar için. */
  compact?: boolean;
  className?: string;
}

export const PronounceButtons: React.FC<Props> = ({ text, compact = false, className = '' }) => {
  const [varsayilan, setVarsayilan] = useState<TelaffuzHizi>(varsayilanHiziOku);
  /** Bu kart için seçilmiş geçici hız; yoksa varsayılan kullanılır. */
  const [kartHizi, setKartHizi] = useState<TelaffuzHizi | null>(null);
  const [menuAcik, setMenuAcik] = useState(false);
  const [caliyor, setCaliyor] = useState(false);
  const kapsayici = useRef<HTMLDivElement>(null);

  const hiz = kartHizi ?? varsayilan;

  // Başka bir karttan varsayılan değiştirilirse rozet burada da güncellensin.
  useEffect(() => varsayilanHiziDinle(setVarsayilan), []);

  // Kart değişince geçici seçim düşer: seçim karta özeldi, kelimeye değil.
  useEffect(() => {
    setKartHizi(null);
    setMenuAcik(false);
  }, [text]);

  // Dışarı dokunmak menüyü kapatır; açık kalan menü kartın üstünü örtüyordu.
  useEffect(() => {
    if (!menuAcik) return;
    const disariDokunuldu = (e: PointerEvent) => {
      if (!kapsayici.current?.contains(e.target as Node)) setMenuAcik(false);
    };
    document.addEventListener('pointerdown', disariDokunuldu);
    return () => document.removeEventListener('pointerdown', disariDokunuldu);
  }, [menuAcik]);

  const oku = (h: TelaffuzHizi) => {
    setCaliyor(true);
    // `speakText` reddetmez; hatayı kendi tanı akışına bildirir.
    void speakText(text, { rate: h }).finally(() => setCaliyor(false));
  };

  const dugmeBoyu = compact ? 'p-2' : 'p-2.5';
  /* Paketin ölçüsü: küçük araç 18, normal eylem 20 piksel. */
  const ikonBoyu = compact ? 18 : 20;

  return (
    <div ref={kapsayici} className={`relative flex items-center gap-1 shrink-0 ${className}`}>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          oku(hiz);
        }}
        aria-label={`${text} — ${hizEtiketi(hiz).toLocaleLowerCase('tr')} hızda dinle`}
        title="Telaffuzu dinle"
        className={`${dugmeBoyu} rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary-soft-hover)] transition-all active:scale-95 cursor-pointer ${
          caliyor ? 'opacity-70' : ''
        }`}
      >
        <RealmsIcon name="audio" size={ikonBoyu} />
      </button>

      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setMenuAcik(a => !a);
        }}
        aria-expanded={menuAcik}
        aria-haspopup="menu"
        aria-label={`Telaffuz hızı: ${hizEtiketi(hiz)}. Değiştirmek için dokun.`}
        title="Telaffuz hızı"
        className={`px-1.5 py-1 rounded-lg text-[10px] font-bold tabular-nums transition-colors cursor-pointer border ${
          hiz === varsayilan
            ? 'text-[var(--text-muted)] border-transparent hover:bg-[var(--surface-soft)]'
            : 'text-[var(--primary)] border-[var(--primary-border)] bg-[var(--primary-soft)]'
        }`}
      >
        {hizRozeti(hiz)}
      </button>

      {menuAcik && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-1.5 z-40 min-w-[160px] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden"
        >
          {HIZ_SECENEKLERI.map(secenek => (
            <button
              key={secenek}
              type="button"
              role="menuitemradio"
              aria-checked={hiz === secenek}
              onClick={e => {
                e.stopPropagation();
                setKartHizi(secenek);
                setMenuAcik(false);
                oku(secenek);
              }}
              className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left border-b border-[var(--border-light)] cursor-pointer ${
                hiz === secenek
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-bold'
                  : 'hover:bg-[var(--surface-soft)] text-[var(--text-primary)] font-semibold'
              }`}
            >
              <span className="text-xs">{hizEtiketi(secenek)}</span>
              {hiz === secenek && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          ))}

          {/*
            Kart seçimini kalıcı yapmanın kısa yolu. Bu satır olmasaydı
            kullanıcı beğendiği hızı her kartta yeniden seçmek ya da profile
            gidip aramak zorunda kalırdı.
          */}
          <button
            type="button"
            role="menuitem"
            onClick={e => {
              e.stopPropagation();
              varsayilanHiziYaz(hiz);
              setKartHizi(null);
              setMenuAcik(false);
            }}
            disabled={hiz === varsayilan}
            className={`w-full px-3 py-2.5 flex items-center gap-1.5 text-left text-[11px] font-semibold ${
              hiz === varsayilan
                ? 'text-[var(--text-muted)] cursor-default'
                : 'text-[var(--primary)] hover:bg-[var(--surface-soft)] cursor-pointer'
            }`}
          >
            <Check className="w-3.5 h-3.5 shrink-0" />
            {hiz === varsayilan ? 'Zaten tüm kartlarda geçerli' : 'Tüm kartlarda kullan'}
          </button>
        </div>
      )}
    </div>
  );
};
