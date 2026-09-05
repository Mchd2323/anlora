import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { HIZ_SECENEKLERI, VARSAYILAN_HIZ, hizRozeti } from '../utils/speechRate';
import { Target, Keyboard, Loader2, Sun } from 'lucide-react';
import { RealmsIcon } from './ui/RealmsIcon';
import {
  describeSpeechSupport,
  openTtsInstall,
  speakText,
  SpeechDiagnostics,
  probeEngines,
  buildStamp,
  type EngineProbe
} from '../utils/speech';
import { ACIK_ON_AYARLAR, KOYU_ON_AYARLAR, RealmsOnAyari } from '../theme/realmsPresets';
import { cozTemayi } from '../hooks/useTheme';

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
/*
 * GÖRÜNÜM: BİR TABAN, SEKİZ EK.
 *
 * "Sistem" bugünkü onaylı Anlora Realms görünümüdür: işletim sistemi açıkken
 * parşömen, koyuyken kuzey gecesi. Taban seçenek odur ve hiç değişmedi.
 *
 * Ek sekiz tema onun YERİNE geçmiyor, yanına ekleniyor — ve birbirinden
 * bağımsızlar: "Buz Kristali"nin koyu karşılığı yok, "Kızıl Gece"nin açık
 * karşılığı yok. Bu yüzden ekranda açık/koyu çiftler gibi değil, iki ayrı
 * liste hâlinde duruyorlar.
 *
 * Önizleme renkleri üretilmiş `realmsPresets.ts` dosyasından geliyor: aynı
 * değerler CSS'te de kullanılıyor, yani örnek kare kullanıcıya seçmediği bir
 * rengi vaat edemiyor.
 */

/**
 * Tek bir ek tema kutucuğu.
 *
 * ÖNİZLEME GERÇEK DEĞERLERDEN. Sol yarım temanın sayfa zemini, sağ yarım
 * paneli; ortadaki daire vurgu rengi, yanındaki çubuk ise metin rengi. Dört
 * değer de CSS'e giden değerlerin ta kendisi, bu yüzden kutucuk kullanıcıya
 * seçmediği bir görünümü vaat edemiyor.
 */
const TemaKutusu: React.FC<{ tema: RealmsOnAyari; secili: boolean; sec: () => void }> = ({
  tema,
  secili,
  sec
}) => (
  <button
    type="button"
    onClick={sec}
    aria-pressed={secili}
    aria-label={`${tema.ad} teması`}
    className={`p-2 rounded-xl border transition-all cursor-pointer text-left ${
      secili
        ? 'bg-[var(--primary-soft)] border-[var(--primary)] ring-2 ring-[var(--primary)]/30'
        : 'bg-[var(--bg)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
    }`}
  >
    <span
      className="flex h-7 rounded-lg overflow-hidden border border-[var(--border-light)]"
      aria-hidden="true"
    >
      <span className="w-1/3" style={{ background: tema.onizleme.zemin }} />
      <span
        className="flex-1 flex items-center justify-center gap-1.5"
        style={{ background: tema.onizleme.panel }}
      >
        <span className="w-3 h-3 rounded-full" style={{ background: tema.onizleme.vurgu }} />
        <span
          className="w-4 h-1 rounded-full"
          style={{ background: tema.onizleme.yazi }}
        />
      </span>
    </span>
    <span
      className={`block text-[10px] font-semibold leading-tight mt-1.5 ${
        secili ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'
      }`}
    >
      {tema.ad}
    </span>
  </button>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onChange }) => {
  /*
   * Yazı büyüklüğünün SÜRÜKLEME SIRASINDAKİ değeri. Ayara ancak parmak
   * kalkınca yazılır; sebebi aşağıdaki çubuğun başındaki açıklamada.
   */
  /*
   * Seçili tema AYARLARDAN ÇÖZÜLÜYOR, doğrudan okunmuyor: uygulamada sırayla
   * üç tema modeli yaşadı ve eski değerler hâlâ kayıtlı olabilir. Çözücü
   * onları karşılığına çeviriyor, yani kullanıcı ayarı hiç açmadan da doğru
   * kutucuk seçili görünüyor.
   */
  const aktifTema = cozTemayi(settings);

  const [yaziOlcegi, setYaziOlcegi] = useState(settings.fontScale || 1);

  useEffect(() => {
    setYaziOlcegi(settings.fontScale || 1);
  }, [settings.fontScale]);

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
    <div className="parsomen-panel bg-[var(--surface)] rounded-2xl p-6 sm:p-7 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-6">
      <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
        <RealmsIcon name="filter" size={20} className="text-[var(--text-secondary)]" />
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
              <RealmsIcon name="audio" size={18} className="text-[var(--primary)]" />
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
        {/*
          TELAFFUZ HIZI — bütün kartların varsayılanı.

          Kart üstündeki rozetten hız değiştirmek yalnızca o kart için
          geçerli; bir daha, bir daha seçmek zorunda kalmamak için kalıcı
          tercihin yeri burası. İki yer aynı değeri okuyup yazıyor
          (utils/speechRate.ts), yani ikisi hiçbir zaman ayrışmıyor.
        */}
        <div>
          <label className="block text-[10px] font-bold  tracking-wider text-[var(--text-muted)] mb-1.5">
            Telaffuz hızı
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {HIZ_SECENEKLERI.map(secenek => {
              const secili = (settings.speechRate ?? VARSAYILAN_HIZ) === secenek;
              return (
                <button
                  key={secenek}
                  type="button"
                  onClick={() => update('speechRate', secenek)}
                  aria-pressed={secili}
                  className={`px-2 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    secili
                      ? 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)] ring-2 ring-[var(--primary)]/25'
                      : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
                  }`}
                >
                  {hizRozeti(secenek)}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Yavaş hız yeni başlayanlarda sesleri ayırmayı kolaylaştırır. Tek bir
            kart için kartın üstündeki hız rozetinden de değiştirebilirsin.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold  tracking-wider text-[var(--text-muted)] mb-1.5">
              Görünüm
            </label>
            <button
              type="button"
              onClick={() => update('themePreset', 'system')}
              aria-pressed={aktifTema === 'system'}
              className={`w-full p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 text-left ${
                aktifTema === 'system'
                  ? 'bg-[var(--primary-soft)] border-[var(--primary)] ring-2 ring-[var(--primary)]/30'
                  : 'bg-[var(--bg)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
              }`}
            >
              {/*
                Sistem tek kutucukta İKİ yarım gösteriyor: solda onaylı açık
                görünüm, sağda onaylı koyu. Seçenek zaten "telefonun ayarına
                göre bu ikisinden biri" demek; tek renk göstermek yanıltıcı
                olurdu.
              */}
              <span
                className="flex h-8 w-16 shrink-0 rounded-lg overflow-hidden border border-[var(--border-light)]"
                aria-hidden="true"
              >
                <span className="flex-1 flex items-center justify-center" style={{ background: '#F2E8D8' }}>
                  <span className="w-3 h-3 rounded-full" style={{ background: '#15283D' }} />
                </span>
                <span className="flex-1 flex items-center justify-center" style={{ background: '#0D1925' }}>
                  <span className="w-3 h-3 rounded-full" style={{ background: '#8FB8D4' }} />
                </span>
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-xs font-bold ${
                    aktifTema === 'system' ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  Sistem
                </span>
                <span className="block text-[11px] text-[var(--text-muted)] leading-tight">
                  Telefonun ayarını izler; açıkken parşömen, koyuyken gece.
                </span>
              </span>
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold  tracking-wider text-[var(--text-muted)] mb-1.5">
              Açık Temalar
            </label>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Açık temalar">
              {ACIK_ON_AYARLAR.map(t => (
                <TemaKutusu
                  key={t.id}
                  tema={t}
                  secili={aktifTema === t.id}
                  sec={() => update('themePreset', t.id)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold  tracking-wider text-[var(--text-muted)] mb-1.5">
              Koyu Temalar
            </label>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Koyu temalar">
              {KOYU_ON_AYARLAR.map(t => (
                <TemaKutusu
                  key={t.id}
                  tema={t}
                  secili={aktifTema === t.id}
                  sec={() => update('themePreset', t.id)}
                />
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
              Tema yalnızca renkleri değiştirir; ekranların düzeni ve sırası aynı kalır.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="fontScale"
            className="block text-[10px] font-bold  tracking-wider text-[var(--text-muted)] mb-1.5"
          >
            Yazı büyüklüğü ·{' '}
            <span className="normal-case tracking-normal">
              %{Math.round(yaziOlcegi * 100)}
            </span>
          </label>
          {/*
            DEĞER PARMAK KALKINCA UYGULANIR.

            Çubuk takılıyordu ve sebebi ince: `fontScale` değişince kök
            `font-size` anında değişiyor, yani BÜTÜN arayüz — çubuğun kendisi
            dahil — yeniden boyutlanıyordu. Kullanıcı sürüklerken tutamak
            parmağının altından kayıyor, hareket kopuk kopuk hissettiriyordu.

            Artık sürükleme boyunca yalnızca yerel değer ve yüzde etiketi
            değişiyor; ayar parmak kalkınca uygulanıyor. Sürükleme akıcı,
            sonuç yine anında görünüyor.

            Adım 0,125'ten 0,0625'e indi: altı kademe zıplama hissi
            veriyordu, on bir kademe sürekli bir hareket veriyor. 0,0625
            seçildi çünkü 0,875–1,5 aralığına TAM bölünüyor; 0,05'te en
            büyük değer olan 1,5'e hiç ulaşılamıyordu.
          */}
          <input
            id="fontScale"
            type="range"
            min={0.875}
            max={1.5}
            step={0.0625}
            value={yaziOlcegi}
            onChange={e => setYaziOlcegi(Number(e.target.value))}
            onPointerUp={() => update('fontScale', yaziOlcegi)}
            onKeyUp={() => update('fontScale', yaziOlcegi)}
            onBlur={() => update('fontScale', yaziOlcegi)}
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
          <RealmsIcon name="audio" size={18} />
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
              <RealmsIcon name="audio" size={18} />
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
              className="dugme-birincil px-3.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RealmsIcon name="download" size={18} />
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
