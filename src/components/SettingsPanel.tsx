import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { Sliders, Target, Volume2, Keyboard, Layers, Download, Loader2, Sun, Bell } from 'lucide-react';
import {
  describeSpeechSupport,
  openTtsInstall,
  speakText,
  SpeechDiagnostics
} from '../utils/speech';
import {
  isPushAvailable,
  getPushPreferences,
  enablePush,
  disablePush,
  updatePushTopics,
  PushPreferences
} from '../services/pushNotifications';

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

  /*
   * Bildirim tercihleri.
   *
   * İzin, uygulama açılırken DEĞİL kullanıcı bildirimleri açtığında isteniyor.
   * Android'de bir kez reddedilen izin bir daha sorulamıyor; sebebi
   * anlatmadan sormak, kullanıcının çoğu zaman düşünmeden reddetmesi demek.
   */
  const [pushAvailable, setPushAvailable] = useState<boolean | null>(null);
  const [push, setPush] = useState<PushPreferences>(getPushPreferences);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    void isPushAvailable().then(ok => {
      if (!cancelled) setPushAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePush = async (next: boolean) => {
    setPushBusy(true);
    setPushNote('');
    try {
      if (next) {
        const result = await enablePush();
        if (!result.ok) setPushNote(result.reason || 'Bildirimler açılamadı.');
      } else {
        await disablePush();
      }
      setPush(getPushPreferences());
    } finally {
      setPushBusy(false);
    }
  };

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
    <div className="bg-[var(--surface)] rounded-2xl p-6 sm:p-7 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-6">
      <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
        <Sliders className="w-4 h-4 text-[var(--text-secondary)]" />
        <span>Çalışma Ayarları</span>
      </h3>

      {/* Günlük hedefler */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
          <Target className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>Günlük hedefler</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1.5">
              Günlük tekrar hedefi: <b className="text-[var(--primary)]">{settings.dailyReviewGoal}</b>
            </span>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={settings.dailyReviewGoal}
              onChange={e => update('dailyReviewGoal', Number(e.target.value))}
              className="w-full accent-[var(--primary)] cursor-pointer"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1.5">
              Günlük yeni kelime: <b className="text-[var(--primary)]">{settings.dailyNewWordsGoal}</b>
            </span>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={settings.dailyNewWordsGoal}
              onChange={e => update('dailyNewWordsGoal', Number(e.target.value))}
              className="w-full accent-[var(--primary)] cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Çalışma modu */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
          <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>Tercih edilen çalışma modu</span>
        </div>

        <div className="space-y-1.5">
          {STUDY_MODES.map(mode => (
            <label
              key={mode.value}
              className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                settings.preferredStudyMode === mode.value
                  ? 'bg-[var(--primary-soft)] border-[var(--primary-border)]'
                  : 'bg-[var(--surface-subtle)] border-[var(--border-light)] hover:bg-[var(--surface-soft)]'
              }`}
            >
              <input
                type="radio"
                name="preferredStudyMode"
                value={mode.value}
                checked={settings.preferredStudyMode === mode.value}
                onChange={() => update('preferredStudyMode', mode.value)}
                className="mt-0.5 accent-[var(--primary)] cursor-pointer"
              />
              <span>
                <span className="text-xs font-bold text-[var(--text-primary)] block">{mode.label}</span>
                <span className="text-[11px] text-[var(--text-secondary)]">{mode.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Anahtarlar */}
      <div className="space-y-2.5">
        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[var(--border-light)] bg-[var(--surface-subtle)] cursor-pointer hover:bg-[var(--surface-soft)] transition-colors">
          <input
            type="checkbox"
            checked={settings.autoPlayAudioOnCard}
            onChange={e => update('autoPlayAudioOnCard', e.target.checked)}
            className="mt-0.5 accent-[var(--primary)] cursor-pointer"
          />
          <span>
            <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-[var(--primary)]" />
              Kart açılınca telaffuzu otomatik çal
            </span>
            <span className="text-[11px] text-[var(--text-secondary)]">
              Çalışma sırasında her yeni kelime kendiliğinden seslendirilir.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[var(--border-light)] bg-[var(--surface-subtle)] cursor-pointer hover:bg-[var(--surface-soft)] transition-colors">
          <input
            type="checkbox"
            checked={settings.enableTypoTolerance}
            onChange={e => update('enableTypoTolerance', e.target.checked)}
            className="mt-0.5 accent-[var(--primary)] cursor-pointer"
          />
          <span>
            <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-[var(--primary)]" />
              Yazarken bir harflik hatayı hoş gör
            </span>
            <span className="text-[11px] text-[var(--text-secondary)]">
              Yazdığın şey başka bir gerçek kelimeyse yine de yanlış sayılır.
            </span>
          </span>
        </label>
      </div>

      {/* Görünüm */}
      <div className="space-y-3 pt-2 border-t border-[var(--border-light)]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
          <Sun className="w-3.5 h-3.5" />
          <span>Görünüm</span>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
            Tema
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'system' as const, label: 'Sistem', hint: 'Telefonun ayarı' },
              { id: 'light' as const, label: 'Açık', hint: '' },
              { id: 'dark' as const, label: 'Koyu', hint: '' }
            ].map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => update('theme', option.id)}
                aria-pressed={(settings.theme || 'system') === option.id}
                className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                  (settings.theme || 'system') === option.id
                    ? 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)]'
                    : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            "Sistem" seçiliyken telefonun karanlık moda geçmesiyle uygulama da geçer.
          </p>
        </div>

        <div>
          <label
            htmlFor="fontScale"
            className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
          >
            Yazı büyüklüğü ·{' '}
            <span className="normal-case tracking-normal">
              %{Math.round((settings.fontScale || 1) * 100)}
            </span>
          </label>
          <input
            id="fontScale"
            type="range"
            min={0.875}
            max={1.5}
            step={0.125}
            value={settings.fontScale || 1}
            onChange={e => update('fontScale', Number(e.target.value))}
            className="w-full accent-[var(--primary)] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-0.5">
            <span>Küçük</span>
            <span>Varsayılan</span>
            <span>Büyük</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Tüm ekranı birlikte büyütür. Değişiklik anında görünür.
          </p>
        </div>

        {/*
          Kısayollar zaten çalışıyordu ama yalnızca "?" tuşuna basmayı
          bilenler bulabiliyordu; hiçbir yerde yazmıyordu. Ekranda sürekli
          duran bir şerit mobilde yalnızca yer kaplar, bu yüzden yalnızca
          klavyesi olan geniş ekranlarda görünen bir satır bırakıldı.
        */}
        <p className="hidden md:block text-[11px] text-[var(--text-muted)] pt-1">
          Klavye kısayolları:{' '}
          <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--bg)] font-mono">1</kbd>–
          <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--bg)] font-mono">5</kbd>{' '}
          sekmeler,{' '}
          <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--bg)] font-mono">s</kbd>{' '}
          çalışma,{' '}
          <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--bg)] font-mono">?</kbd>{' '}
          tam liste.
        </p>
      </div>

      {/* Bildirimler */}
      <div className="space-y-2 pt-2 border-t border-[var(--border-light)]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
          <Bell className="w-3.5 h-3.5" />
          <span>Bildirimler</span>
        </div>

        {pushAvailable === false ? (
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            Anlık bildirim yalnızca telefona kurulu uygulamada çalışıyor. Tarayıcıda
            uygulama içi duyuruları yine görürsün.
          </p>
        ) : (
          <>
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[var(--border-light)] bg-[var(--surface-subtle)] cursor-pointer hover:bg-[var(--surface-soft)] transition-colors">
              <input
                type="checkbox"
                checked={push.enabled}
                disabled={pushBusy}
                onChange={e => void togglePush(e.target.checked)}
                className="mt-0.5 accent-[var(--primary)] cursor-pointer"
              />
              <span>
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Bildirimleri aç
                </span>
                <span className="block text-[11px] text-[var(--text-secondary)]">
                  Yeni özellikler ve tekrar hatırlatmaları telefonuna gelsin.
                </span>
              </span>
            </label>

            {push.enabled && (
              <div className="pl-3 space-y-1.5">
                <label className="flex items-center gap-2 text-[11px] text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={push.announcements}
                    onChange={e => {
                      void updatePushTopics({ announcements: e.target.checked });
                      setPush(getPushPreferences());
                    }}
                    className="accent-[var(--primary)] cursor-pointer"
                  />
                  Duyurular ve yeni özellikler
                </label>
                <label className="flex items-center gap-2 text-[11px] text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={push.reminders}
                    onChange={e => {
                      void updatePushTopics({ reminders: e.target.checked });
                      setPush(getPushPreferences());
                    }}
                    className="accent-[var(--primary)] cursor-pointer"
                  />
                  Çalışma hatırlatmaları
                </label>
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                  Kapattığın tür sana gönderilmez — "herkese" gönderilen bir duyuruda bile.
                </p>
              </div>
            )}

            {pushNote && (
              <div className="p-3 rounded-xl bg-[var(--learning-soft)] border border-[var(--learning-border)] text-[11px] text-[var(--learning-text)] leading-relaxed">
                {pushNote}
              </div>
            )}
          </>
        )}
      </div>

      {/* Telaffuz sesi */}
      <div className="space-y-2 pt-2 border-t border-[var(--border-light)]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
          <Volume2 className="w-3.5 h-3.5" />
          <span>Telaffuz Sesi</span>
        </div>
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
          Ses gelmiyorsa önce burayı dene. Sorun çoğu zaman cihazda İngilizce
          konuşma paketinin kurulu olmamasıdır.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runSpeechTest}
            disabled={isTesting}
            className="px-3.5 py-2 bg-[var(--surface-soft)] hover:bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
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
              className="px-3.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
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
                ? 'bg-[var(--learned-soft)] border-[var(--learned-border)] text-[var(--learned-text)]'
                : 'bg-[var(--learning-soft)] border-[var(--learning-border)] text-[var(--learning-text)]'
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
