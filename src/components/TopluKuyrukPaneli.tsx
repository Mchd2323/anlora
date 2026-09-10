import React, { useState } from 'react';
import { Loader2, Check, X, WifiOff, RotateCw, Trash2 } from 'lucide-react';
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
  /** "Şimdi tekrar dene" düğmesi. */
  onYenidenDene?: () => void;
  /** Bekleyen bütün kelimeleri düşürür. */
  onIptal?: () => void;
  onClose: () => void;
}

/** Adresten yalnızca sunucu adını alır; ekranda tam URL'e gerek yok. */
function sunucuAdi(adres: string): string {
  try {
    return new URL(adres).host;
  } catch {
    return adres;
  }
}

/** 95_000 -> "1 dk 35 sn" */
function sureMetni(ms: number): string {
  const sn = Math.floor(ms / 1000);
  if (sn < 60) return `${sn} sn`;
  return `${Math.floor(sn / 60)} dk ${sn % 60} sn`;
}

export const TopluKuyrukPaneli: React.FC<Props> = ({
  ilerleme,
  onYenidenDene,
  onIptal,
  onClose
}) => {
  /*
   * İptal İKİ DOKUNUŞ. Kuyruk saatler sürebilen bir iş ve tek dokunuşla yok
   * edilmesi, yanlışlıkla basıldığında geri alınamayan bir kayıp olurdu.
   */
  const [iptalOnayi, setIptalOnayi] = useState(false);
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
          {/*
            DURAKLAMA GİZLENMİYOR. Sunucuya ulaşılamadığında kuyruk boş kart
            üretmek yerine duruyor; bunu söylemezsek kullanıcı ilerlemeyen bir
            sayıya bakıp uygulamanın kilitlendiğini sanır.
          */}
          {(ilerleme.duraklatildi || ilerleme.takildi) && (
            <div className="px-3 py-2.5 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger-border)] space-y-2">
              <div className="flex items-start gap-2">
                <WifiOff className="w-3.5 h-3.5 text-[var(--danger)] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {ilerleme.duraklatildi && ilerleme.hataTuru === 'kota' ? (
                    /*
                      KOTA HATASINA "BAĞLANTI BEKLENİYOR" DENMİYOR.

                      Kullanıcı bu cümle yüzünden mobil veriye geçip sabit
                      hatta bağlandı ve hiçbiri değiştirmedi -- çünkü sorun
                      ağda değildi. Ne olduğunu ve ne YAPMAMASI gerektiğini
                      söylemek, doğru cümlenin yarısı.
                    */
                    <>
                      <span className="font-bold text-[var(--danger)]">
                        Anlora AI şu an istek kabul etmiyor.
                      </span>{' '}
                      Bunun ağınızla ilgisi yok; ağ değiştirmek işe yaramaz. Günlük
                      sınır dolmuşsa yenilenmesini beklemek gerekiyor. Kelimeler
                      kuyrukta duruyor, hiçbiri kaybolmadı — beklemek istemezseniz
                      aşağıdan iptal edebilirsiniz.
                    </>
                  ) : ilerleme.duraklatildi && ilerleme.hataTuru === 'sunucu' ? (
                    <>
                      <span className="font-bold text-[var(--danger)]">
                        Sunucu hata veriyor.
                      </span>{' '}
                      Anlora AI şu an yanıt üretemiyor. Ağınızla ilgisi yok. Kelimeler
                      kuyrukta duruyor; belirli aralıklarla yeniden denenecek.
                    </>
                  ) : ilerleme.duraklatildi ? (
                    <>
                      <span className="font-bold text-[var(--danger)]">Bağlantı bekleniyor.</span>{' '}
                      Anlora AI'ya şu an ulaşılamıyor. Kelimeler kuyrukta duruyor, hiçbiri
                      kaybolmadı; bağlantı gelince kaldığı yerden sürecek.
                    </>
                  ) : (
                    /*
                      TAKILMA GİZLENMİYOR. Uygulama arka plandayken Android
                      isteği öldürebiliyor ve yanıt hiç gelmiyor; ekranda
                      yalnızca dönen bir çark kalıyordu. Bekçi bunu kendisi
                      toparlıyor, ama kullanıcının beklemesi gerekmesin diye
                      durum yazılıyor ve elinde bir düğme oluyor.
                    */
                    <>
                      <span className="font-bold text-[var(--danger)]">
                        Yanıt gecikti ({sureMetni(ilerleme.gecenSure)}).
                      </span>{' '}
                      Uygulama arka plandayken istek kesilmiş olabilir. Kendiliğinden
                      yeniden denenecek; beklemek istemezsen aşağıdaki "Şimdi tekrar
                      dene" düğmesine dokun.
                    </>
                  )}
                </p>
              </div>

              {/*
                SEBEP GİZLENMİYOR.

                Kullanıcı ağını değiştirip durumun düzelmesini bekliyordu; oysa
                "Bağlantı bekleniyor" cümlesi ağ kopmasını, sunucu hatasını ve
                dolan kotayı aynı şekilde gösteriyordu. Sunucunun kendi
                açıklaması ("quota exceeded" gibi) buraya taşınıyor: ne
                yapılacağına ancak bu bilgiyle karar verilebilir.
              */}
              {ilerleme.sonHata && (
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed pl-5">
                  <span className="font-bold">Sebep:</span> {ilerleme.sonHata}
                </p>
              )}
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed pl-5">
                Sunucu: {ilerleme.sunucu ? sunucuAdi(ilerleme.sunucu) : 'tanımlı değil'}
              </p>
            </div>
          )}

          {suAnki && (
            <div>
              <div className="text-[11px] font-bold text-[var(--text-muted)] tracking-wider mb-1.5">
                ŞU AN
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary-border)]">
                <Loader2
                  className={`w-3.5 h-3.5 text-[var(--primary)] shrink-0 ${
                    ilerleme.duraklatildi ? 'opacity-40' : 'animate-spin'
                  }`}
                />
                <span className="text-xs font-bold text-[var(--primary)]">{suAnki}</span>
                {/*
                  SAYAÇ, DÖNEN ÇARKIN YERİNE GEÇEN BİLGİ.

                  Kullanıcının bildirdiği ekranda ilk kelimenin yanında sonsuza
                  kadar dönen bir çark vardı ve başka hiçbir şey yoktu: iş
                  ilerliyor mu, donmuş mu, ayırt edilemiyordu. Saniye sayacı bu
                  farkı görünür kılıyor.
                */}
                <span className="text-[11px] text-[var(--text-secondary)] ml-auto">
                  {ilerleme.duraklatildi
                    ? 'bekliyor'
                    : ilerleme.gecenSure > 3000
                      ? `${sureMetni(ilerleme.gecenSure)}`
                      : 'ekleniyor'}
                </span>
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

        {/*
          DÜĞME HER ZAMAN BURADA.

          Önce yalnızca "takıldı" kararı verildiğinde gösteriliyordu; ölçümde
          görüldü ki bekçi çoğu zaman o eşikten önce toparlıyor ve düğme
          pratikte hiç görünmüyordu. Beklemek istemeyen kullanıcının elinde
          her an bir kol olması, nadiren basılan bir düğmeden iyi. Basmanın
          bedeli süren isteğin kesilmesi; kelime kaybolmuyor, yeniden deneniyor.
        */}
        {kuyruk && (onYenidenDene || onIptal) && (
          <div className="px-5 py-3 border-t border-[var(--border-light)] space-y-2">
            {onYenidenDene && (
              <button
                type="button"
                onClick={onYenidenDene}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-soft)]"
              >
                <RotateCw className="w-3 h-3" />
                Şimdi tekrar dene
              </button>
            )}
            {onIptal &&
              (iptalOnayi ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onIptal();
                      setIptalOnayi(false);
                      onClose();
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--danger-soft)] border border-[var(--danger-border)] text-[11px] font-bold text-[var(--danger)] cursor-pointer"
                  >
                    Evet, {kuyruk.ogeler.length} kelimeyi iptal et
                  </button>
                  <button
                    type="button"
                    onClick={() => setIptalOnayi(false)}
                    className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] cursor-pointer"
                  >
                    Vazgeç
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIptalOnayi(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--surface-soft)]"
                >
                  <Trash2 className="w-3 h-3" />
                  Eklemeyi iptal et
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
