import React from 'react';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Kelime setinin rengini seçen açılır menü.
 *
 * NEDEN AÇILIR. Kutucuklar eskiden hepsi bir arada, sarmalanan bir satırda
 * duruyordu. Sekiz renkte bu iki satır ediyordu; on iki renkte pencerenin
 * yarısını kaplıyor ve altındaki "Simge", "Kelime Sırası" alanlarını ekranın
 * dışına itiyordu. Renk, pencerenin en az kullanılan ayarı olmasına rağmen en
 * çok yer kaplayan ayarı oluyordu.
 *
 * NEDEN İSİM YOK. Menüde seçenekler renk ADIYLA değil kendi GÖRÜNTÜSÜYLE
 * duruyor: kullanıcı "Kuzgun Haritası"nın hangi renk olduğunu bilmiyor, ama
 * renge bakınca seçtiğini görüyor. Adlar yalnızca `title` ve `aria-label`
 * olarak duruyor — ekran okuyucunun söyleyecek bir şeyi olmalı.
 *
 * NEDEN SATIR İÇİ AÇILIYOR, KAYAN PANEL DEĞİL. Hem yeni set hem set düzenleme
 * penceresi `overflow-y-auto` bir kapsayıcı. Mutlak konumlu bir panel o
 * kapsayıcıda kırpılır ve sayfa kaydırılınca tetikleyicisinden kopardı.
 * Panel akışın içinde durunca ikisi de olmuyor.
 */

interface Renk {
  id: string;
  label: string;
  hex: string;
  uzeri: string;
}

interface Props {
  /** Seçili rengin kimliği — eski kayıtlı değerler çağıran tarafta çevriliyor. */
  seciliId: string;
  renkler: Renk[];
  sec: (id: string) => void;
  /** Tetikleyiciyi etiketleyen görünür başlığın id'si. */
  etiketId: string;
}

export const SetRengiSecici: React.FC<Props> = ({ seciliId, renkler, sec, etiketId }) => {
  const [acik, setAcik] = React.useState(false);
  const sarmal = React.useRef<HTMLDivElement>(null);
  const secili = renkler.find(r => r.id === seciliId) ?? renkler[0];

  /*
   * Dışarı tıklayınca kapanma.
   *
   * Escape burada DİNLENMİYOR: pencerenin kendi erişilebilirlik kancası
   * (useModalA11y) Escape'i document üzerinde YAKALAMA evresinde işliyor, yani
   * buradaki herhangi bir dinleyiciden önce. Escape'i burada da yakalamaya
   * çalışmak iki kapanışı birbirine karıştırırdı; Escape pencereyi kapatıyor,
   * menü de onunla birlikte gidiyor — beklenen davranış bu.
   */
  React.useEffect(() => {
    if (!acik) return;
    const disarida = (e: MouseEvent) => {
      if (sarmal.current && !sarmal.current.contains(e.target as Node)) setAcik(false);
    };
    document.addEventListener('mousedown', disarida);
    return () => document.removeEventListener('mousedown', disarida);
  }, [acik]);

  return (
    <div ref={sarmal} className="relative">
      <button
        type="button"
        onClick={() => setAcik(a => !a)}
        aria-expanded={acik}
        aria-haspopup="listbox"
        aria-labelledby={etiketId}
        title={secili.label}
        className="w-full flex items-center gap-2.5 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl cursor-pointer hover:border-[var(--primary-border)] transition-colors"
      >
        <span
          aria-hidden="true"
          className="hanedan-kapak w-7 h-7 rounded-lg shrink-0"
          style={{ '--hanedan': secili.hex, '--hanedan-uzeri': secili.uzeri } as React.CSSProperties}
        />
        {/* Adı değil rengi gösteriyoruz; boşluk oku sağa itiyor. */}
        <span className="flex-1" />
        <ChevronDown
          className={`w-4 h-4 text-[var(--text-secondary)] shrink-0 transition-transform ${acik ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {acik && (
        <div
          role="listbox"
          aria-labelledby={etiketId}
          className="mt-1.5 p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg animate-fadeIn grid grid-cols-6 gap-0.5"
        >
          {renkler.map(renk => {
            const bu = renk.id === secili.id;
            return (
              <button
                key={renk.id}
                type="button"
                role="option"
                aria-selected={bu}
                aria-label={renk.label}
                title={renk.label}
                onClick={() => { sec(renk.id); setAcik(false); }}
                /*
                  Basılabilir kutu 44 piksel, görünen arma 32 — bu pencerenin
                  başka yerlerindeki kuralla aynı. Görsel parça içeride duruyor
                  ki 44'e uzayıp kare olmaktan çıkmasın.
                */
                className="flex items-center justify-center w-11 h-11 cursor-pointer"
              >
                <span
                  className={`hanedan-kapak w-8 h-8 rounded-xl flex items-center justify-center transition-transform ${
                    bu
                      ? 'ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-[var(--text-primary)]'
                      : 'hover:scale-105'
                  }`}
                  style={{ '--hanedan': renk.hex, '--hanedan-uzeri': renk.uzeri } as React.CSSProperties}
                >
                  {bu && <Check className="w-4 h-4" aria-hidden="true" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
