import React from 'react';
import { CloudUpload, Check } from 'lucide-react';
import { RealmsIcon } from './ui/RealmsIcon';

/**
 * Kelime setleri için üyelik kapısı.
 *
 * NEDEN YALNIZCA BURADA: setler kullanıcının kendi emeğidir — topladığı
 * kelimeler, yazdığı anlamlar, not ettiği bağlamlar. Telefon kaybolduğunda
 * ya da uygulama silindiğinde bunlar da gider. Hesap, bu emeğin tek
 * yedeğidir. Uygulamanın geri kalanı (Oxford, sözlük, çalışma, sınav)
 * hesapsız çalışmaya devam eder; oradaki içerik zaten pakette.
 *
 * SUNUCU YOKSA KAPI DA YOK: giriş yapılamayan bir kurulumda kapı koymak,
 * özelliği hiç kimsenin açamayacağı biçimde kilitlemek olurdu. Böyle bir
 * durumda setler serbest çalışır.
 *
 * VERİ GİZLENMEZ: kullanıcının cihazında zaten kelimeleri varsa bu ekran
 * bunu söyler. "Verilerim kayboldu mu?" endişesi, kaybolmaktan daha kötü
 * bir deneyimdir.
 */
export const SignInGate: React.FC<{
  existingWordCount: number;
  existingSetCount: number;
  onOpenAuth: () => void;
}> = ({ existingWordCount, existingSetCount, onOpenAuth }) => (
  <div className="max-w-lg mx-auto animate-fadeIn pb-safe-nav">
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 space-y-5 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center mx-auto">
        <RealmsIcon name="sets" size={22} />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Kelime setlerin için bir hesap
        </h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Setler senin emeğin: topladığın kelimeler, yazdığın anlamlar, not
          ettiğin cümleler. Hesap açtığında hepsi buluta yedeklenir; telefonun
          kaybolsa ya da uygulamayı silsen de kaybolmaz.
        </p>
      </div>

      {existingWordCount > 0 && (
        <div className="p-3.5 rounded-xl bg-[var(--learning-soft)] border border-[var(--learning-border)] text-[12px] text-[var(--learning-text)] leading-relaxed text-left">
          <b>Kelimelerin duruyor.</b> Bu cihazda {existingSetCount} sette{' '}
          {existingWordCount} kelimen kayıtlı. Hiçbiri silinmedi — giriş yaptığın
          anda yerlerinde bulacaksın.
        </div>
      )}

      <ul className="space-y-2 text-left">
        {[
          'Setlerin ve ilerlemen buluta yedeklenir',
          'Yeni telefonda kaldığın yerden devam edersin',
          'Setlerini bağlantıyla paylaşabilirsin'
        ].map(madde => (
          <li key={madde} className="flex items-start gap-2 text-[13px] text-[var(--text-secondary)]">
            <Check className="w-4 h-4 text-[var(--learned)] shrink-0 mt-0.5" />
            {madde}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onOpenAuth}
        className="dugme-birincil w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--surface)] text-sm font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
      >
        <CloudUpload className="w-4 h-4" />
        Giriş yap ya da hesap aç
      </button>

      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
        Uygulamanın geri kalanı hesapsız çalışır: Oxford 5000'i çalışabilir,
        sınav çözebilir, sözlükte kelime arayabilirsin.
      </p>
    </div>
  </div>
);
