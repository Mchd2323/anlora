import React from 'react';
import { Loader2, Check, X } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';
import type { TopluIlerleme } from '../hooks/useTopluKuyruk';

/**
 * Anlora – "Hangi kelime ekleniyor, hangisi eklendi?"
 *
 * NEDEN VAR. Arka plan kuyruğu dakikalarca sürebiliyor ve kullanıcının
 * gördüğü tek şey azalan bir sayıydı. "17 kelime kaldı" hangi kelimelerin
 * hazır olduğunu, hangisinin sırada beklediğini söylemiyor; kullanıcı setine
 * bakıp eksik gördüğü kelimenin işlenip işlenmediğini bilemiyordu.
 *
 * ÜÇ DURUM AYRI GÖSTERİLİYOR:
 *   şu an   – yapay zekânın üzerinde çalıştığı kelime
 *   sırada  – henüz başlanmamışlar
 *   bitti   – eklenenler; anlamı boş kalanlar AYRI işaretle
 *
 * Sonuncusu önemli: yapay zekâya ulaşılamadığında ya da kelime tanınmadığında
 * kart boş ekleniyor (uydurma anlam yazmaktansa). Hepsine "eklendi" demek,
 * kullanıcının kartı açıp boş bulduğunda bunu hata sanmasına yol açardı.
 */

interface Props {
  ilerleme: TopluIlerleme;
  onClose: () => void;
}

export const TopluKuyrukPaneli: React.FC<Props> = ({ ilerleme, onClose }) => {
  const panelRef = useModalA11y(true, onClose);
  const kuyruk = ilerleme.kuyruk;

  const suAnki = ilerleme.suAnki;
  const sirada = kuyruk ? kuyruk.ogeler.filter(o => o.kelime !== suAnki) : [];
  // En son biten en üstte: kullanıcı yeni olanı arıyor.
  const bitenler = kuyruk ? [...kuyruk.bitenler].reverse() : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="anlora-kuyruk-baslik"
      ref={panelRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[var(--text-primary)]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] rounded-2xl max-w-md w-full border border-[var(--border)] shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[var(--border-light)] flex items-start justify-between gap-3">
          <div>
            <h3 id="anlora-kuyruk-baslik" className="text-base font-bold text-[var(--text-primary)]">
              Anlora AI kartları hazırlıyor
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {kuyruk
                ? `${kuyruk.bitenler.length} hazır · ${kuyruk.ogeler.length} bekliyor`
                : 'Bekleyen kelime kalmadı.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-[var(--text-secondary)] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {suAnki && (
            <div>
              <div className="text-[11px] font-bold text-[var(--text-muted)] tracking-wider mb-1.5">
                ŞU AN
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary-border)]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--primary)] shrink-0" />
                <span className="text-xs font-bold text-[var(--primary)]">{suAnki}</span>
                <span className="text-[11px] text-[var(--text-secondary)] ml-auto">ekleniyor</span>
              </div>
            </div>
          )}

          {sirada.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-[var(--text-muted)] tracking-wider mb-1.5">
                SIRADA ({sirada.length})
              </div>
              <div className="space-y-1">
                {sirada.map((o, i) => (
                  <div
                    key={`${o.kelime}-${i}`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border-light)]"
                  >
                    <span className="text-xs text-[var(--text-primary)]">{o.kelime}</span>
                    <span className="text-[11px] text-[var(--text-muted)] ml-auto">bekliyor</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bitenler.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-[var(--text-muted)] tracking-wider mb-1.5">
                EKLENDİ ({bitenler.length})
              </div>
              <div className="space-y-1">
                {bitenler.map((b, i) => (
                  <div
                    key={`${b.kelime}-${i}`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border-light)]"
                  >
                    <Check
                      className={`w-3.5 h-3.5 shrink-0 ${
                        b.durum === 'eklendi' ? 'text-[var(--learned)]' : 'text-[var(--text-muted)]'
                      }`}
                    />
                    <span className="text-xs text-[var(--text-primary)]">{b.kelime}</span>
                    <span className="text-[11px] text-[var(--text-muted)] ml-auto">
                      {b.durum === 'eklendi' ? 'eklendi' : 'eklendi · anlamı boş'}
                    </span>
                  </div>
                ))}
              </div>
              {bitenler.some(b => b.durum === 'bos') && (
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mt-2">
                  Anlamı boş kalanlar için yapay zekâ bir karşılık üretemedi. Uydurma
                  bir anlam yazmak yerine alan boş bırakıldı; kartı açıp kendin
                  doldurabilirsin.
                </p>
              )}
            </div>
          )}

          {!kuyruk && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Hazırlanan kelimelerin hepsi eklendi.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
