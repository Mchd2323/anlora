import React, { useState } from 'react';
import { UserSettings } from '../types';
import { Sliders, Target, Volume2, Keyboard, Layers, Download, Loader2 } from 'lucide-react';
import {
  describeSpeechSupport,
  openTtsInstall,
  speakText,
  SpeechDiagnostics
} from '../utils/speech';

interface SettingsPanelProps {
  settings: UserSettings;
  onChange: (settings: UserSettings) => void;
}

const STUDY_MODES: { value: UserSettings['preferredStudyMode']; label: string; hint: string }[] = [
  { value: 'mixed', label: 'Karışık', hint: 'Kelimenin öğrenme aşamasına göre otomatik seçilir' },
  { value: 'flashcard', label: 'Kart çevirme', hint: 'Tanıma: kelimeyi gör, anlamı hatırla' },
  { value: 'listening', label: 'Dinleme', hint: 'Sesli okunan kelimeyi tanı' },
  { value: 'cloze', label: 'Boşluk doldurma', hint: 'Kelimeyi cümle içinde hatırla' },
  { value: 'typed', label: 'Yazarak', hint: 'En zorlu adım: kelimeyi baştan yaz' }
];

/**
 * Kullanıcı ayarları paneli.
 *
 * `UserSettings` en baştan beri saklanıyor ve okunuyordu ama hiçbir arayüz
 * bunları değiştirmeye izin vermiyordu: günlük hedefler, tercih edilen çalışma
 * modu, otomatik telaffuz ve yazım toleransı kullanıcıya kapalıydı. Panel bu
 * boşluğu dolduruyor; alanların hepsi zaten uygulamada okunuyor.
 */
export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onChange }) => {
  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  /*
   * Telaffuz tanılaması.
   *
   * "Ses çıkmıyor" şikâyetinin nedeni uygulamada da olabilir, cihazda da:
   * Türkçe kurulmuş telefonlarda metin okuma motoru çoğu zaman yalnızca
   * Türkçe ses verisiyle gelir ve İngilizce okuma sessizce başarısız olur.
   * Tahmin yürütmek yerine ölçüp söylemek, kullanıcıyı da bizi de doğru
   * yere götürüyor.
   */
  const [diagnostics, setDiagnostics] = useState<SpeechDiagnostics | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const runSpeechTest = async () => {
    setIsTesting(true);
    try {
      const report = await describeSpeechSupport();
      setDiagnostics(report);
      if (report.hasEnglish) {
        await speakText('This is how Anlora sounds.');
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-[#FFFFFF] rounded-2xl p-6 sm:p-7 border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-6">
      <h3 className="text-sm font-bold text-[#1E2430] flex items-center gap-1.5">
        <Sliders className="w-4 h-4 text-[#687080]" />
        <span>Çalışma Ayarları</span>
      </h3>

      {/* Günlük hedefler */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#687080]">
          <Target className="w-3.5 h-3.5 text-[#4F46A5]" />
          <span>Günlük hedefler</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[11px] font-semibold text-[#687080] block mb-1.5">
              Günlük tekrar hedefi: <b className="text-[#4F46A5]">{settings.dailyReviewGoal}</b>
            </span>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={settings.dailyReviewGoal}
              onChange={e => update('dailyReviewGoal', Number(e.target.value))}
              className="w-full accent-[#4F46A5] cursor-pointer"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold text-[#687080] block mb-1.5">
              Günlük yeni kelime: <b className="text-[#4F46A5]">{settings.dailyNewWordsGoal}</b>
            </span>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={settings.dailyNewWordsGoal}
              onChange={e => update('dailyNewWordsGoal', Number(e.target.value))}
              className="w-full accent-[#4F46A5] cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Çalışma modu */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#687080]">
          <Layers className="w-3.5 h-3.5 text-[#4F46A5]" />
          <span>Tercih edilen çalışma modu</span>
        </div>

        <div className="space-y-1.5">
          {STUDY_MODES.map(mode => (
            <label
              key={mode.value}
              className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                settings.preferredStudyMode === mode.value
                  ? 'bg-[#EEECFA] border-[#D7D2F4]'
                  : 'bg-[#FAF9F5] border-[#EFECE6] hover:bg-[#F1EFE8]'
              }`}
            >
              <input
                type="radio"
                name="preferredStudyMode"
                value={mode.value}
                checked={settings.preferredStudyMode === mode.value}
                onChange={() => update('preferredStudyMode', mode.value)}
                className="mt-0.5 accent-[#4F46A5] cursor-pointer"
              />
              <span>
                <span className="text-xs font-bold text-[#1E2430] block">{mode.label}</span>
                <span className="text-[11px] text-[#687080]">{mode.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Anahtarlar */}
      <div className="space-y-2.5">
        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#EFECE6] bg-[#FAF9F5] cursor-pointer hover:bg-[#F1EFE8] transition-colors">
          <input
            type="checkbox"
            checked={settings.autoPlayAudioOnCard}
            onChange={e => update('autoPlayAudioOnCard', e.target.checked)}
            className="mt-0.5 accent-[#4F46A5] cursor-pointer"
          />
          <span>
            <span className="text-xs font-bold text-[#1E2430] flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-[#4F46A5]" />
              Kart açılınca telaffuzu otomatik çal
            </span>
            <span className="text-[11px] text-[#687080]">
              Çalışma sırasında her yeni kelime kendiliğinden seslendirilir.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#EFECE6] bg-[#FAF9F5] cursor-pointer hover:bg-[#F1EFE8] transition-colors">
          <input
            type="checkbox"
            checked={settings.enableTypoTolerance}
            onChange={e => update('enableTypoTolerance', e.target.checked)}
            className="mt-0.5 accent-[#4F46A5] cursor-pointer"
          />
          <span>
            <span className="text-xs font-bold text-[#1E2430] flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-[#4F46A5]" />
              Yazarken bir harflik hatayı hoş gör
            </span>
            <span className="text-[11px] text-[#687080]">
              Yazdığın şey başka bir gerçek kelimeyse yine de yanlış sayılır.
            </span>
          </span>
        </label>
      </div>

      {/* Telaffuz sesi */}
      <div className="space-y-2 pt-2 border-t border-[#EFECE6]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#687080]">
          <Volume2 className="w-3.5 h-3.5" />
          <span>Telaffuz Sesi</span>
        </div>
        <p className="text-[11px] text-[#687080] leading-relaxed">
          Ses gelmiyorsa önce burayı dene. Sorun çoğu zaman cihazda İngilizce
          konuşma paketinin kurulu olmamasıdır.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runSpeechTest}
            disabled={isTesting}
            className="px-3.5 py-2 bg-[#F1EFE8] hover:bg-[#EEECFA] text-[#4F46A5] border border-[#D7D2F4] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            <span>Sesi Test Et</span>
          </button>

          {diagnostics?.isNative && !diagnostics.hasEnglish && (
            <button
              type="button"
              onClick={() => void openTtsInstall()}
              className="px-3.5 py-2 bg-[#4F46A5] hover:bg-[#433B91] text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>İngilizce Ses Paketini Yükle</span>
            </button>
          )}
        </div>

        {diagnostics && (
          <div
            className={`p-3 rounded-xl border text-[11px] leading-relaxed ${
              diagnostics.hasEnglish
                ? 'bg-[#E9F3ED] border-[#BFD7C8] text-[#35654E]'
                : 'bg-[#FBF1DE] border-[#E7C98F] text-[#8A5A18]'
            }`}
          >
            {diagnostics.hasEnglish ? (
              <>
                <b>Ses hazır.</b> Bulunan İngilizce ses:{' '}
                {diagnostics.englishVoices.slice(0, 3).join(', ')}
                {diagnostics.englishVoices.length > 3 &&
                  ` (+${diagnostics.englishVoices.length - 3})`}
                . Şimdi bir örnek okundu; duymadıysan telefonun ses düzeyini
                ve sessiz modunu kontrol et.
              </>
            ) : diagnostics.engine === 'none' ? (
              <>
                <b>Bu cihazda konuşma motoru bulunamadı.</b> Telaffuz sesi
                çalışmayacak; kartların geri kalanı normal çalışır.
              </>
            ) : (
              <>
                <b>İngilizce ses paketi bulunamadı.</b> Cihazda konuşma motoru
                var ama İngilizce verisi yok.{' '}
                {diagnostics.isNative
                  ? 'Yukarıdaki düğmeyle sistem kurulum ekranını açabilir ya da Ayarlar → Diller ve giriş → Metin okuma yolundan ekleyebilirsin.'
                  : 'Tarayıcında İngilizce bir ses yüklü değil; uygulamayı telefonuna kurduğunda sistemin kendi sesi kullanılır.'}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
