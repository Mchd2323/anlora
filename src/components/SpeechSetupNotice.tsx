import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { describeSpeechSupport, openTtsInstall, type SpeechDiagnostics } from '../utils/speech';
import { readRaw, writeRaw } from '../utils/safeStorage';
import { RealmsIcon } from './ui/RealmsIcon';

const KAPATILDI = 'anlora.speechNoticeDismissed.v1';

/**
 * "Telefonunda İngilizce ses paketi yok" uyarısı.
 *
 * NEDEN KART TARAFINDA. Android'de metin okuma, sistemde kurulu bir motorun
 * o dile ait ses verisine bağlıdır. Türkçe kurulmuş telefonlarda Google TTS
 * çoğu zaman yalnızca Türkçe veriyle gelir; İngilizce indirilmeden `speak`
 * sessizce hiçbir şey yapmaz — ne hata verir ne ses çıkarır. Kullanıcının
 * gördüğü şey "ses düğmesi çalışmıyor" olur.
 *
 * Kurulum kısayolu uygulamada zaten vardı ama Ayarlar ekranının en altında,
 * yalnızca oraya inip bakan birinin bulabileceği yerdeydi. Sesin çalışmadığı
 * yer kart ekranı olduğuna göre çözümün de orada durması gerekiyor.
 *
 * NE ZAMAN ÇİZİLİR. Yalnızca yerel kabukta VE cihazda hiç İngilizce ses
 * bulunamadığında. Tarayıcıda ya da ses hazırken hiçbir şey çizilmez —
 * herkese gösterilen bir uyarı, gerçekten gerekli olduğunda görünmez olur.
 * Kapatılabilir ve kapatma kalıcıdır; kurulum yapıldıysa zaten kendiliğinden
 * kaybolur.
 */
export const SpeechSetupNotice: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [tani, setTani] = useState<SpeechDiagnostics | null>(null);
  const [kapatildi, setKapatildi] = useState(
    () => readRaw(KAPATILDI) === 'true'
  );
  const [aciliyor, setAciliyor] = useState(false);

  useEffect(() => {
    let iptal = false;
    void describeSpeechSupport().then(sonuc => {
      if (!iptal) setTani(sonuc);
    });
    return () => {
      iptal = true;
    };
  }, []);

  if (kapatildi || !tani || !tani.isNative || tani.hasEnglish) return null;

  return (
    <div
      className={`bg-[var(--learning-soft)] border border-[var(--learning-border)] rounded-2xl p-4 flex items-start gap-3 ${className}`}
    >
      <RealmsIcon name="audio" size={20} className="text-[var(--learning-text)] shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[var(--learning-text)]">
          Telaffuz için tek seferlik bir kurulum gerekiyor
        </p>
        <p className="text-xs text-[var(--learning-text)] mt-0.5 leading-relaxed opacity-90">
          Telefonunda İngilizce konuşma paketi yüklü değil; bu yüzden ses düğmeleri sessiz kalıyor.
          Aşağıdaki düğme seni doğrudan Android'in kurulum ekranına götürür. Bir kez kurduktan sonra
          telaffuz internetsiz de çalışır.
        </p>
        <div className="flex flex-wrap gap-2 mt-2.5">
          <button
            type="button"
            disabled={aciliyor}
            onClick={async () => {
              setAciliyor(true);
              const acildi = await openTtsInstall();
              setAciliyor(false);
              /*
               * Ekran açılamadıysa sessiz kalmıyoruz: kullanıcıya elle
               * gideceği yolu söylüyoruz. Açılmayan bir düğme, olmayan bir
               * düğmeden daha kötüdür.
               */
              if (!acildi) {
                setTani(onceki =>
                  onceki ? { ...onceki, englishVoices: ['__acilamadi__'] } : onceki
                );
              }
            }}
            className="px-3 py-2 bg-[var(--learning)] hover:opacity-90 disabled:opacity-60 text-[var(--surface)] text-[11px] font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
          >
            <RealmsIcon name="download" size={18} aria-hidden="true" />
            {aciliyor ? 'Açılıyor…' : 'Ses paketini kur'}
          </button>
          <button
            type="button"
            onClick={() => {
              setKapatildi(true);
              writeRaw(KAPATILDI, 'true');
            }}
            className="px-3 py-2 text-[11px] font-semibold text-[var(--learning-text)] hover:bg-[var(--learning-soft-hover)] rounded-lg cursor-pointer inline-flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Bir daha gösterme
          </button>
        </div>

        {tani.englishVoices[0] === '__acilamadi__' && (
          <p className="text-[11px] text-[var(--learning-text)] mt-2 leading-relaxed border-t border-[var(--learning-border)] pt-2">
            Kurulum ekranı açılamadı. Elle şu yolu izleyebilirsin:{' '}
            <b>Ayarlar → Genel yönetim → Metin okuma çıkışı → Tercih edilen motor → İngilizce dil verisini indir.</b>{' '}
            Bazı telefonlarda bu bölüm <b>Ayarlar → Erişilebilirlik → Metin okuma</b> altındadır.
          </p>
        )}
      </div>
    </div>
  );
};
