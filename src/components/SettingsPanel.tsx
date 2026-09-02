import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { Sliders, Target, Volume2, Keyboard, Layers, Download, Loader2, Sun, Bell } from 'lucide-react';
import {
  describeSpeechSupport,
  openTtsInstall,
  speakText,
  SpeechDiagnostics,
  probeEngines,
  buildStamp,
  type EngineProbe
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
/**
 * Tema seçenekleri.
 *
 * Renk örnekleri burada sabit yazılır çünkü CSS değişkenleri o an geçerli
 * temanın değerini taşır; örnekleri onlarla çizmek sekiz kutuyu da aynı
 * renkte gösterirdi. Değerler `index.css` içindeki karşılıklarıyla aynı.
 */
const THEME_OPTIONS = [
  { id: 'system' as const,  label: 'Sistem',  hint: 'Telefonun ayarını izler',        zemin: 'linear-gradient(135deg,#F8F7F3 50%,#14161B 50%)', kenar: '#C3BEB4', marka: '#4F46A5' },
  { id: 'light' as const,   label: 'Kağıt',   hint: 'Açık — sıcak kırık beyaz',       zemin: '#F8F7F3', kenar: '#E4E1D9', marka: '#4F46A5' },
  { id: 'deniz' as const,   label: 'Deniz',   hint: 'Açık — soğuk beyaz, turkuaz',    zemin: '#F4F8F9', kenar: '#D7E4E7', marka: '#1F6F6B' },
  { id: 'gul' as const,     label: 'Gül',     hint: 'Yumuşak — sıcak pembe',          zemin: '#FDF6F6', kenar: '#EFDCDE', marka: '#B44E68' },
  { id: 'lavanta' as const, label: 'Lavanta', hint: 'Yumuşak — açık leylak',          zemin: '#F9F6FD', kenar: '#E4DCF2', marka: '#7A5AB8' },
  { id: 'dark' as const,    label: 'Gece',    hint: 'Koyu — nötr',                    zemin: '#14161B', kenar: '#2E323C', marka: '#9A92D8' },
  { id: 'orman' as const,   label: 'Orman',   hint: 'Koyu — yeşile çalan',            zemin: '#101714', kenar: '#2A3833', marka: '#6FB89A' },
  { id: 'komur' as const,   label: 'Kömür',   hint: 'Koyu — sıcak amber',             zemin: '#16130F', kenar: '#383026', marka: '#D9A24E' }
];

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

  /**
   * Telaffuz sınaması.
   *
   * HER DURUMDA DENER. Önceki sürüm yalnızca tanı "İngilizce var" derse
   * okuyordu; yani düğme, tam da sesi çalışmayan kullanıcıda hiçbir şey
   * yapmıyordu — ne ses, ne mesaj. Oysa düğmenin varlık sebebi o kullanıcı.
   *
   * Ayrıca tanı yanılabilir: bazı motorlar sorguda listelemedikleri bir
   * yerel ayarla yine de okur. Denemenin bedeli birkaç yüz milisaniye,
   * denememenin bedeli sessizlik.
   *
   * Sonuç yazıyla bildirilir. "Bir şey olmadı"nın nedeni kullanıcıya
   * söylenmezse, sorunu uygulamanın bozukluğu sanır.
   */
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  /**
   * Motor motor deneme sonucu.
   *
   * Ses çalışmadığında "olmadı" demek yetmiyor: sorunun tarayıcı motorunda
   * mı yoksa yerel eklentide mi olduğunu ayırt edebilmek gerek. Bu liste
   * kullanıcının okuyup aktarabileceği somut satırlar üretiyor.
   */
  const [motorSonucu, setMotorSonucu] = useState<EngineProbe[] | null>(null);
  const [motorDeneniyor, setMotorDeneniyor] = useState(false);

  const runSpeechTest = async () => {
    /*
     * OKUMA ÖNCE ATEŞLENİR, TANI SONRA TOPLANIR.
     *
     * Sıra bir tercih değil, sesin çıkıp çıkmamasını belirleyen şey.
     * Mobil tarayıcılar ve Android WebView seslendirmeyi yalnızca kullanıcı
     * dokunuşunun başlattığı görev içinde kabul eder. Önceki sürüm önce
     * `await describeSpeechSupport()` yapıyor, okumayı ancak ondan sonra
     * başlatıyordu; o bekleme dokunuş bağlamını düşürdüğü için `speak()`
     * sessizce hiçbir şey yapmıyordu. Düğme dönüyor, ses gelmiyordu.
     *
     * Artık `speakText` ilk satırda, hiçbir `await`ten önce çağrılıyor;
     * dönen söz aşağıda bekleniyor. Tanı, ses çoktan yola çıktıktan sonra
     * toplanıyor — sonucu değil, yalnızca açıklama metnini etkiliyor.
     */
    const okuma = speakText('This is how Anlora sounds.');

    setIsTesting(true);
    setTestResult(null);
    try {
      const report = await describeSpeechSupport();
      setDiagnostics(report);

      const sonuc = await okuma;

      if (sonuc.ok) {
        setTestResult({
          ok: true,
          text: 'Ses gönderildi. Duymadıysan telefonun sesi kapalı ya da çok kısık olabilir.'
        });
      } else if (sonuc.reason === 'no-voice') {
        setTestResult({
          ok: false,
          text: 'Telefonunda İngilizce konuşma paketi bulunamadı. Aşağıdaki kurulum düğmesi seni doğrudan Android ekranına götürür.'
        });
      } else if (sonuc.reason === 'unsupported') {
        /*
         * Anlora yalnızca APK olarak çalışıyor; telaffuz Android'in kendi
         * metin okuma servisine bağlı. Buraya düşmek ya yerel kabukta
         * olmadığımız ya da eklentinin köprüye kayıtlı olmadığı anlamına
         * gelir. İkisi de kullanıcının çözebileceği şeyler değil, o yüzden
         * tanıyı açmaya yönlendiriyoruz — orada ham değerler var.
         */
        setTestResult({
          ok: false,
          text: 'Telaffuz motoruna ulaşılamadı. Aşağıdaki "Ayrıntılı ses tanısı" düğmesi sebebini gösterir.'
        });
      } else {
        setTestResult({
          ok: false,
          text: 'Konuşma motoru yanıt vermedi. Telefonu yeniden başlatmak ya da metin okuma motorunu güncellemek işe yarayabilir.'
        });
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

      {/*
        'Tercih edilen çalışma modu' ayarı KALDIRILDI.

        Çalışma ekranında zaten mod sekmeleri var; bu ayar yalnızca bir
        dokunuş kazandırıyor ama karşılığında açıklanması gereken bir bölüm
        ekliyordu. Oturum artık son kullanılan modu kendiliğinden hatırlıyor:
        aynı fayda, ayar yok.
      */}
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

        {/*
          Tema seçimi.
          Her seçenek kendi zeminini ve marka rengini küçük bir örnekle
          gösterir: adı okumak yerine renge bakarak seçilebilsin. Örnekler
          sabit değerlerle çizilir, çünkü değişkenler o an SEÇİLİ olan
          temayı taşır — hepsi aynı renkte görünürdü.
        */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
            Tema
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {THEME_OPTIONS.map(option => {
              const secili = (settings.theme || 'system') === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => update('theme', option.id)}
                  aria-pressed={secili}
                  title={option.hint}
                  className={`px-2 py-2 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    secili
                      ? 'bg-[var(--primary-soft)] border-[var(--primary)] ring-2 ring-[var(--primary)]/25'
                      : 'bg-[var(--bg)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
                  }`}
                >
                  <span
                    className="w-full h-6 rounded-lg border flex items-center justify-end pr-1.5"
                    style={{ background: option.zemin, borderColor: option.kenar }}
                    aria-hidden="true"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: option.marka }}
                    />
                  </span>
                  <span
                    className={`text-[10px] font-semibold leading-none ${
                      secili ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
            "Sistem" seçiliyken telefonun karanlık moda geçmesiyle uygulama da geçer.
            Diğerleri telefondan bağımsız çalışır.
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

      {/*
        BİLDİRİMLER BÖLÜMÜ KALDIRILDI.

        Anlık bildirim sunucu ister; bu dağıtımda sunucu yok. Ekranda duran
        şey yalnızca 'bu çalışmıyor' diyen bir açıklamaydı — kullanıcıya
        hiçbir faydası olmayan, sadece kafa karıştıran bir bölüm. Sunucu
        açılırsa geri gelir; kod tarafı (pushNotifications) duruyor.
      */}
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

          {/*
            AYRINTILI TANI KÜÇÜK BİR BAĞLANTININ ARKASINDA.

            Ses artık çalışıyor; kullanıcıların çoğu buraya hiç bakmayacak.
            Ama bir sorun çıktığında bu ekran tek teşhis yolu — kaldırılamaz,
            sadece öne çıkmaması gerekiyor. Herkese gösterilen teknik bir
            düğme, gerçekten ihtiyaç duyulduğunda güven vermez.
          */}
          <button
            type="button"
            disabled={motorDeneniyor}
            onClick={async () => {
              setMotorDeneniyor(true);
              setMotorSonucu(null);
              try {
                setMotorSonucu(await probeEngines());
              } finally {
                setMotorDeneniyor(false);
              }
            }}
            className="px-2 py-2 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] underline underline-offset-2 cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-wait"
          >
            {motorDeneniyor && <Loader2 className="w-3 h-3 animate-spin" />}
            <span>{motorDeneniyor ? 'Deneniyor…' : 'Sorun mu var?'}</span>
          </button>

          {diagnostics?.isNative && !diagnostics.hasEnglish && (
            <button
              type="button"
              onClick={() => void openTtsInstall()}
              className="px-3.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--surface)] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>İngilizce Ses Paketini Yükle</span>
            </button>
          )}
        </div>

        {motorSonucu && (
          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[11px] leading-relaxed space-y-2">
            <p className="font-bold text-[var(--text-primary)]">Ses tanısı</p>
            {/*
              Derleme damgası. Telefondaki paketin hangi derleme olduğunu
              gösterir; iki farklı APK'nin aynı tanıyı vermesi yüzünden
              eklendi — yeni paketin cihaza ulaşıp ulaşmadığı başka türlü
              anlaşılamıyordu.
            */}
            <p className="font-mono text-[10px] text-[var(--text-muted)]">
              Derleme: {buildStamp()}
            </p>
            {motorSonucu.map(m => (
              <div key={m.engine} className="flex items-start gap-2">
                <span
                  className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                    m.started
                      ? 'bg-[var(--learned)]'
                      : m.available
                      ? 'bg-[var(--learning)]'
                      : 'bg-[var(--text-muted)]'
                  }`}
                  aria-hidden="true"
                />
                <span className="text-[var(--text-secondary)]">
                  <b className="text-[var(--text-primary)]">
                    {m.engine === 'env'
                      ? 'Ortam'
                      : m.engine === 'web'
                      ? 'Tarayıcı motoru (geliştirme)'
                      : 'Telefonun motoru'}
                    :
                  </b>{' '}
                  {m.detail}
                </span>
              </div>
            ))}
            <p className="text-[var(--text-muted)] pt-1 border-t border-[var(--border-light)]">
              Ses hâlâ çıkmıyorsa bu satırları olduğu gibi iletebilirsin; sorunun hangi
              motorda olduğunu doğrudan gösteriyorlar.
            </p>
          </div>
        )}

        {testResult && (
          <div
            className={`p-3 rounded-xl border text-[11px] leading-relaxed ${
              testResult.ok
                ? 'bg-[var(--learned-soft)] border-[var(--learned-border)] text-[var(--learned-text)]'
                : 'bg-[var(--danger-soft)] border-[var(--danger-border)] text-[var(--danger)]'
            }`}
            role="status"
          >
            {testResult.text}
          </div>
        )}

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
                  : 'Telefonunda İngilizce ses verisi bulunamadı; yukarıdaki kurulum düğmesi Android ekranına götürür.'}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
