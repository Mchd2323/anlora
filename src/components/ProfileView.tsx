import React, { useState, useMemo, useEffect } from 'react';
import {
  UserProfile,
  UserStats,
  WordCard,
  LearningState,
  Level,
  UserSettings,
  Collection,
  CollectionMembership
} from '../types';
import { LogOut, LogIn, CheckCircle2, BookOpen, Layers, Award, Trash2, Sparkles, Shield, BrainCircuit, Send, MessageSquareQuote } from 'lucide-react';
import { getUserWordStatus } from '../utils/storageV2';
import { BRAND } from '../config/brand';
import { loadPhrases, getPhraseCards } from '../services/phraseRepository';
import { CEFRBadge } from './ui/CEFRBadge';
import { generateFullV2Backup, restoreFullV2Backup } from '../utils/storageV2';
import { SettingsPanel } from './SettingsPanel';
import { apiFetch } from '../utils/authClient';
import { useRemoteApi } from '../hooks/useRemoteApi';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { RealmsIcon } from './ui/RealmsIcon';

interface ProfileViewProps {
  profile: UserProfile;
  stats: UserStats;
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  learningStates: Record<string, LearningState>;
  customWords: WordCard[];
  oxfordWords: WordCard[];
  /** Oxford 5000'i tamamlayan ek liste; seviye sayıları eksik kalmasın. */
  extraWords?: WordCard[];
  collections?: Collection[];
  memberships?: CollectionMembership[];
  favorites: string[];
  onOpenAuthModal: () => void;
  onLogout: () => void;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
  onNavigateToTab?: (tab: string) => void;
  onSelectLevel?: (level: Level) => void;
  /**
   * Oxford listesini belirli bir durum filtresiyle açar.
   *
   * Profil "34 öğrendim" diyor ama hangi otuz dört olduğunu göstermiyordu.
   * Sayı bir kapıdır: dokununca o listeye gidilir.
   */
  onOpenOxfordStatus?: (status: 'LEARNED' | 'LEARNING' | 'FAVORITES') => void;
  /** Yalnızca yönetici hesabında tanımlıdır; tanımsızsa giriş hiç çizilmez. */
  onOpenAdminPanel?: () => void;
  /** Hata bildirimi / iletişim penceresini açar. */
  onOpenFeedback?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  stats,
  settings,
  onUpdateSettings,
  learningStates,
  customWords,
  oxfordWords,
  extraWords = [],
  collections = [],
  memberships = [],
  favorites,
  onOpenAuthModal,
  onLogout,
  onNavigateToTab,
  onSelectLevel,
  onOpenOxfordStatus,
  onOpenAdminPanel,
  onOpenFeedback
}) => {
  /*
   * Hesap açılabiliyor mu? Sunucusuz kurulumda hayır — giriş ve kayıt
   * arayüzü hiç çizilmez. `null` iken de çizilmez: yoklama biterken düğmenin
   * belirip kaybolması gözle görülür bir zıplama olurdu.
   */
  const hesapAcilabilir = useRemoteApi();

  /*
   * Seviye dökümü açık mı? KAPALI başlar.
   *
   * Bölüm on satır seviye taşıyor; profil sayfası bu yüzden gereğinden uzun
   * oluyordu. Herkesin her açılışta seviye seviye ilerlemesine bakması
   * gerekmiyor — özet üstte kalıyor, ayrıntı isteyen tek dokunuşla açıyor.
   */
  const [seviyelerAcik, setSeviyelerAcik] = useState(false);

  /** Sözlük katkısı notu açık mı? Kapalı başlar; herkesin okuması gerekmiyor. */
  const [katkiAcik, setKatkiAcik] = useState(false);

  /*
   * KALIP İSTATİSTİKLERİ.
   *
   * Kalıplar ayrı bir veri dosyasında ve tembel yükleniyor (~540 KB).
   * İstatistik ekranı bunları göstermek istiyorsa veriyi kendisi
   * istemeli — profil açıldığında bir kez indirilir, sonrası bedava.
   * Ekranın geri kalanı beklemez: veri gelene kadar kalıp satırları
   * çizilmez, diğer her şey yerindedir.
   */
  const [kaliplar, setKaliplar] = useState<WordCard[] | null>(null);

  useEffect(() => {
    let iptal = false;
    void loadPhrases()
      .then(() => {
        if (!iptal) setKaliplar(getPhraseCards());
      })
      .catch(() => undefined);
    return () => {
      iptal = true;
    };
  }, []);
  /** İndirilen yedeğin dosya adı; kullanıcı telefonda arayabilsin diye. */
  const [exportedName, setExportedName] = useState('');
  /*
   * Yerel kabukta dosyanın GERÇEK yolu. Boşsa tarayıcı indirmesi yapılmıştır.
   * Sabit bir "İndirilenler klasöründe" cümlesi yerine gerçek yeri söylemek,
   * kullanıcının dosyayı bulabilmesinin tek güvenilir yolu.
   */
  const [exportedPath, setExportedPath] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState('');

  /**
   * Hesabı sunucudan siler ve yerel oturumu kapatır.
   *
   * Parola tekrar istenir: oturumu açık kalmış bir telefonu eline geçiren
   * birinin hesabı silmesini engeller.
   */
  const handleDeleteAccount = async () => {
    setDeleteAccountError('');
    try {
      await apiFetch('/api/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword, confirmEmail: profile.email })
      });
      setIsDeletingAccount(false);
      setDeletePassword('');
      onLogout();
    } catch (err: any) {
      setDeleteAccountError(err?.message || 'Hesap silinemedi.');
    }
  };
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  // Compute total status across all words
  const learningSummary = useMemo(() => {
    let learnedCount = 0;
    let learningCount = 0;
    let unseenCount = 0;

    /*
     * EK LİSTE BURADA DA SAYILIYOR.
     *
     * Üstteki "Öğrendim / Öğreniyorum" sayaçları yalnızca Oxford 3000'i
     * tarıyordu; hemen altındaki seviye satırları ise ek listeyi de sayıyor.
     * Aynı ekranda iki farklı toplam, kullanıcıya hangisinin doğru olduğunu
     * sorduruyordu. İkisi de aynı havuza bakıyor artık.
     */
    const allWordIds = new Set<string>();
    customWords.forEach((w) => allWordIds.add(w.id));
    oxfordWords.forEach((w) => allWordIds.add(w.id));
    extraWords.forEach((w) => allWordIds.add(w.id));

    allWordIds.forEach((id) => {
      const st = getUserWordStatus(id, learningStates);
      if (st === 'learned') learnedCount++;
      else if (st === 'learning') learningCount++;
      else unseenCount++;
    });

    // Oxford breakdown
    const oxfordBreakdown: Record<
      string,
      { total: number; learned: number; learning: number }
    > = {
      A1: { total: 0, learned: 0, learning: 0 },
      A2: { total: 0, learned: 0, learning: 0 },
      B1: { total: 0, learned: 0, learning: 0 },
      B2: { total: 0, learned: 0, learning: 0 },
      C1: { total: 0, learned: 0, learning: 0 },
      C2: { total: 0, learned: 0, learning: 0 }
    };

    /*
     * EK LİSTE DE SAYILIYOR.
     * Burada yalnızca `oxfordWords` (Oxford 3000, 3.308 kayıt) sayılıyordu;
     * ek listenin 2.015 kelimesi hiç görünmüyordu, yani B2 ve C1 sayıları
     * olduğundan küçük çıkıyordu.
     */
    [...oxfordWords, ...extraWords].forEach((w) => {
      if (w.level && oxfordBreakdown[w.level]) {
        oxfordBreakdown[w.level].total++;
        const st = getUserWordStatus(w.id, learningStates);
        if (st === 'learned') oxfordBreakdown[w.level].learned++;
        else if (st === 'learning') oxfordBreakdown[w.level].learning++;
      }
    });

    /*
     * SÖZLÜĞÜMÜZDE OLMAYAN KENDİ KELİMELERİ.
     *
     * Kullanıcının elle yazdığı, ne Oxford listesinde ne de Anlora
     * dağarcığında bulunan kelimeler. Bu sayı iki işe yarıyor: kullanıcı
     * kendi katkısını görüyor, biz de sözlüğün nerede yetersiz kaldığını
     * öğrenebiliyoruz.
     *
     * Ölçüt `sourceType`: sözlükten gelen kartlar 'oxford' ya da 'extended'
     * işaretli olur; elle yazılanlarda böyle bir kaynak yoktur.
     */
    const sozlukDisiKelimeler = customWords
      .filter(w => w.isCustom && !w.sourceEntryId && w.sourceType !== 'oxford')
      .map(w => w.word.trim())
      .filter(Boolean);

    return {
      totalWords: allWordIds.size,
      learnedCount,
      learningCount,
      unseenCount,
      oxfordBreakdown,
      sozlukDisiKelimeler,
      setSayisi: collections.length,
      setlerdekiKelime: new Set(memberships.map(m => m.wordId)).size,
      /*
       * Kalıpların seviye dağılımı. Kelimelerle aynı biçimde hesaplanıyor
       * ama ayrı tutuluyor: ikisini toplamak, kullanıcının "B2 kelimelerin
       * kaçını bitirdim" sorusunun cevabını bozardı.
       */
      kalipDagilimi: (['A1', 'A2', 'B1', 'B2', 'C1'] as Level[]).map(lvl => {
        const grup = (kaliplar || []).filter(k => k.level === lvl);
        let learned = 0;
        let learning = 0;
        grup.forEach(k => {
          const st = getUserWordStatus(k.id, learningStates);
          if (st === 'learned') learned++;
          else if (st === 'learning') learning++;
        });
        return { lvl, total: grup.length, learned, learning };
      })
    };
  }, [customWords, oxfordWords, extraWords, collections, memberships, learningStates, kaliplar]);

  /**
   * Tam yedek indirir.
   *
   * Önceki sürüm kendi uydurma biçimini yazıyordu ve KOLEKSİYONLARI hiç
   * içermiyordu: kullanıcı "yedeğim var" sanıyor, kelime setlerini kaybediyordu.
   * Üstelik üretilen dosya `restoreFullV2Backup`'ın beklediği
   * `schemaVersion: 2` biçiminde olmadığı için geri de yüklenemiyordu; yedek
   * alma özelliği çıkışı olmayan bir yoldu.
   */
  const handleExportData = async () => {
    try {
      const payload = generateFullV2Backup();
      const icerik = JSON.stringify(payload, null, 2);
      const dosyaAdi = `anlora_yedek_${new Date().toISOString().slice(0, 10)}.json`;

      /*
       * APK'DA `<a download>` HİÇBİR ŞEY YAPMAZ.
       *
       * Android WebView, `download` özniteliğini kendiliğinden işlemez:
       * bağlantıya tıklanır, hiçbir dosya oluşmaz, hata da fırlamaz. Buna
       * rağmen ekranda "Yedeğin indirildi — İndirilenler klasöründe" yazıyordu.
       * Verinin tamamı yalnızca bu cihazda durduğu için bu, kullanıcının
       * olmayan bir yedeğe güvenip telefon değiştirmesi demekti: geri dönüşü
       * olmayan bir kayıp, üstelik uygulamanın kendi güvencesiyle.
       *
       * Yerel kabukta dosya gerçekten diske yazılıyor ve paylaşım penceresi
       * açılıyor: kullanıcı yedeği Drive'a, e-postaya ya da dosya yöneticisine
       * çıkarabiliyor. Tarayıcıda eski yol doğru çalıştığı için korunuyor.
       */
      if (Capacitor.isNativePlatform()) {
        const { uri } = await Filesystem.writeFile({
          path: dosyaAdi,
          data: icerik,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });

        setExportedName(dosyaAdi);
        setExportedPath(uri);
        setShowExportSuccess(true);
        setTimeout(() => setShowExportSuccess(false), 12000);

        /*
         * Paylaşma başarısızlığı yedeği geçersiz kılmaz: dosya zaten yazıldı.
         * Kullanıcı paylaşım penceresini kapatırsa da buraya düşülür.
         */
        try {
          await Share.share({ title: 'Anlora yedeği', url: uri });
        } catch {
          /* paylaşım iptal edildi ya da desteklenmiyor; dosya yerinde duruyor */
        }
        return;
      }

      const blob = new Blob([icerik], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dosyaAdi;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportedPath('');
      setExportedName(dosyaAdi);
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 12000);
    } catch (e) {
      console.error(e);
      setImportError(
        'Yedek dosyası cihaza yazılamadı: ' +
          ((e as Error)?.message || 'bilinmeyen hata') +
          '. Depolama alanın dolu olabilir.'
      );
    }
  };

  /** Yedek dosyasından geri yükler. */
  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Aynı dosya art arda seçilebilsin diye girdi sıfırlanır.
    event.target.value = '';
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();

    reader.onerror = () => setImportError('Dosya okunamadı.');
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result));
        if (!payload || payload.schemaVersion !== 2) {
          setImportError(
            'Bu dosya Anlora yedeği değil ya da eski bir sürümden. Profil ekranından yeni bir yedek alabilirsin.'
          );
          return;
        }

        const counts = {
          collections: Array.isArray(payload.collections) ? payload.collections.length : 0,
          customWords: Array.isArray(payload.customWords) ? payload.customWords.length : 0
        };

        const confirmed = window.confirm(
          `Yedek geri yüklenecek: ${counts.collections} kelime seti, ${counts.customWords} özel kart.\n\n` +
            'Mevcut yerel verilerin bu yedekle DEĞİŞTİRİLECEK. Devam edilsin mi?'
        );
        if (!confirmed) return;

        if (restoreFullV2Backup(payload)) {
          // Geri yükleme tüm depolama anahtarlarını değiştirdiği için en
          // temiz yol sayfayı yeniden yüklemek; kısmi durum kalmaz.
          window.location.reload();
        } else {
          /*
           * Buraya düşmek "dosya bozuk" demek DEĞİL: biçim ve sürüm denetimi
           * yukarıda yapıldı, JSON da ayrıştırıldı. Kalan tek sebep yazmanın
           * tutmaması. Sayfa bilerek yenilenmiyor — yenilemek bellekteki
           * geçici veriyi de silerdi; böyle kullanıcı en azından verisini
           * görüyor ve yer açıp yeniden deneyebiliyor.
           */
          setImportError(
            'Yedek cihaza tam olarak kaydedilemedi. Depolama alanın dolu olabilir. ' +
              'Veriler şu an ekranda görünüyor ama kalıcı değil; yer açıp yeniden dene.'
          );
        }
      } catch {
        setImportError('Dosya geçerli bir JSON değil.');
      }
    };

    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (
      confirm(
        'Tüm yerel ilerlemenizi ve özel kelimelerinizi sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz!'
      )
    ) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 pb-safe-nav max-w-[880px] mx-auto animate-fadeIn">
      {/* 1. Profil Başlık ve Hesap Kartı */}
      <div className="parsomen-panel bg-[var(--surface)] rounded-2xl p-6 sm:p-7 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold text-xl border border-[var(--primary-border)]">
            {profile.isLoggedIn && profile.name
              ? profile.name.slice(0, 1).toUpperCase()
              : <RealmsIcon name="profile" size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                {profile.isLoggedIn ? profile.name || 'Öğrenci' : 'Misafir Kullanıcı'}
              </h2>
              {profile.isLoggedIn && (
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-[var(--learned-soft)] text-[var(--learned-text)] font-bold text-[10px] border border-[var(--learned-border)]">
                    Üye
                  </span>
                  {profile.emailVerified && (
                    <span className="px-2 py-0.5 rounded-md bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-[10px] border border-[var(--primary-border)]">
                      Doğrulandı
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {profile.isLoggedIn
                ? profile.email || 'Hesabın senkronize ediliyor'
                : 'İlerlemen bu tarayıcıda kaydedilmektedir.'}
            </p>
            {profile.isLoggedIn && profile.city && (
              <p className="text-[11px] font-medium text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                <span>📍 {profile.city}, {profile.country || 'Türkiye'}</span>
              </p>
            )}
          </div>
        </div>

        <div>
          {profile.isLoggedIn ? (
            <button
              onClick={onLogout}
              className="px-3.5 py-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border)] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>Çıkış Yap</span>
            </button>
          ) : hesapAcilabilir ? (
            <button
              onClick={onOpenAuthModal}
              className="dugme-birincil px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.98] text-[var(--surface)] text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Giriş Yap / Ücretsiz Hesap Aç</span>
            </button>
          ) : null}
        </div>
      </div>

      {/*
        Misafir kutusu.

        Sunucusuz kurulumda "Hesap Oluştur" diye bir şey yok; o düğmeyi
        göstermek kullanıcıyı olmayan bir kapıya yönlendirmek olurdu. Kutu
        yine de çizilir, çünkü söylediği şey orada da geçerli ve önemli:
        verinin nerede durduğu. Sadece sonu değişir — davet yerine yedek
        alma hatırlatması.
      */}
      {!profile.isLoggedIn && hesapAcilabilir !== null && (
        <div className="p-5 rounded-2xl bg-[var(--learning-soft)]/60 border border-[var(--learning-border)] text-[var(--learning-text)] space-y-2">
          <div className="font-bold text-xs flex items-center gap-1.5 text-[var(--learning-text)]">
            <Shield className="w-4 h-4 text-[var(--learning)]" />
            <span>
              {hesapAcilabilir
                ? "Anlora'yı misafir olarak kullanıyorsun"
                : 'Verilerin bu cihazda saklanıyor'}
            </span>
          </div>
          <p className="text-xs text-[var(--learning-text)] leading-relaxed">
            {hesapAcilabilir
              ? 'Oxford ilerlemen bu cihazda saklanıyor. Kendi Kelime Setlerini oluşturmak için hesap açabilirsin.'
              : 'İlerlemen ve setlerin telefonunda tutuluyor; hiçbir yere gönderilmiyor. Telefonunu değiştirmeden önce aşağıdan yedek almayı unutma.'}
          </p>
          {hesapAcilabilir && (
            <div className="pt-0.5">
              <button
                onClick={onOpenAuthModal}
                className="px-3.5 py-1.5 bg-[var(--learning)] hover:bg-[var(--learning-hover)] text-[var(--surface)] font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Hesap Oluştur
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Genel Öğrenme İstatistikleri */}
      <div className="parsomen-panel bg-[var(--surface)] rounded-2xl p-6 sm:p-7 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-4">
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
          <Award className="w-4 h-4 text-[var(--primary)]" />
          <span>Genel Öğrenme Durumu</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => onOpenOxfordStatus?.('LEARNED')}
            className="p-4 bg-[var(--learned-soft)] rounded-xl border border-[var(--learned-border)] text-center transition-colors hover:bg-[var(--learned-soft-strong)] cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5 text-[var(--learned)] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[var(--learned-text)]">
              {learningSummary.learnedCount}
            </div>
            <div className="text-[10px] font-bold text-[var(--learned-text)]  mt-0.5">
              Öğrendim
            </div>
            <div className="text-[9px] text-[var(--learned)] mt-1 font-semibold">Listeyi aç →</div>
          </button>

          <button
            type="button"
            onClick={() => onOpenOxfordStatus?.('LEARNING')}
            className="p-4 bg-[var(--learning-soft)] rounded-xl border border-[var(--learning-border)] text-center transition-colors hover:bg-[var(--learning-soft-strong)] cursor-pointer"
          >
            <RealmsIcon name="repeat" size={22} className="text-[var(--learning)] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[var(--learning-text)]">
              {learningSummary.learningCount}
            </div>
            <div className="text-[10px] font-bold text-[var(--learning-text)]  mt-0.5">
              Öğreniyorum
            </div>
            <div className="text-[9px] text-[var(--learning)] mt-1 font-semibold">Listeyi aç →</div>
          </button>

          <button
            type="button"
            onClick={() => onOpenOxfordStatus?.('FAVORITES')}
            className="p-4 bg-[var(--danger-soft)] rounded-xl border border-[var(--danger-border)] text-center transition-colors hover:bg-[var(--danger-soft-hover)] cursor-pointer"
          >
            <RealmsIcon name="favorite" size={22} className="text-[var(--favorite)] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[var(--danger)]">
              {favorites.length}
            </div>
            <div className="text-[10px] font-bold text-[var(--danger)]  mt-0.5">
              Favori Kelimem
            </div>
            <div className="text-[9px] text-[var(--favorite)] mt-1 font-semibold">Listeyi aç →</div>
          </button>

          <div className="p-4 bg-[var(--primary-soft)] rounded-xl border border-[var(--primary-border)] text-center">
            <BrainCircuit className="w-5 h-5 text-[var(--primary)] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[var(--primary)]">
              {stats.totalQuizzesTaken || 0}
            </div>
            <div className="text-[10px] font-bold text-[var(--primary)]  mt-0.5">
              Çözülen Sınav
            </div>
          </div>
        </div>
      </div>

      {/*
        İSTATİSTİKLER

        Önceki bölüm yalnızca 'Oxford 5000 Seviye Dağılımı' idi ve uygulamanın
        eski hâline göre yapılmıştı: seviyeler B2'de bitiyor, C1 ve kalıplar
        hiç görünmüyordu. Üstelik yalnızca Oxford'u sayıyordu — kullanıcının
        kendi setleri, kendi kelimeleri bu tabloda yoktu.

        Artık başlık 'İstatistikler' ve kullanıcının uygulamadaki BÜTÜN
        çalışması burada: durum özeti, seviye ilerlemesi, setler ve sözlükte
        bulunmayan kendi kelimeleri. Hepsi tek kutuda, öncekinin kapladığı
        yerden fazlasını almadan.
      */}
      <div className="parsomen-panel bg-[var(--surface)] rounded-2xl p-6 sm:p-7 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-5">
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
          <RealmsIcon name="progress" size={20} className="text-[var(--primary)]" />
          <span>İstatistikler</span>
        </h3>

        {/*
          KUTU DEĞİL, SATIR.

          Üç sayı kutu içinde, seviyeler ise bambaşka bir biçimde duruyordu;
          aynı ekranda iki ayrı tasarım dili vardı. Hepsi artık tek tip satır:
          başında ikon, ortada ne olduğu, sonunda sayı. Göz tek bir hizada
          aşağı iniyor ve satırlar birbiriyle karşılaştırılabiliyor.

          Renkler satırın ne anlattığını ayırıyor — setler, kelimeler,
          kalıplar — ama biçim aynı kalıyor.
        */}
        <div className="divide-y divide-[var(--border-light)] border border-[var(--border)] rounded-xl overflow-hidden">
          {[
            {
              Icon: Layers,
              renk: 'var(--primary)',
              etiket: 'Oluşturduğun kelime seti sayısı',
              deger: learningSummary.setSayisi.toLocaleString('tr-TR')
            },
            {
              Icon: BookOpen,
              renk: 'var(--learned)',
              etiket: 'Setlere eklediğin toplam kelime sayısı',
              deger: learningSummary.setlerdekiKelime.toLocaleString('tr-TR')
            },
            {
              Icon: Sparkles,
              renk: 'var(--learning)',
              etiket: 'Eklediğin, uygulamada bulunmayan kelime sayısı',
              deger: learningSummary.sozlukDisiKelimeler.length.toLocaleString('tr-TR')
            }
          ].map(satir => (
            <div
              key={satir.etiket}
              className="px-3.5 py-2.5 flex items-center gap-2.5 bg-[var(--bg)]"
            >
              <satir.Icon className="w-4 h-4 shrink-0" style={{ color: satir.renk }} />
              <span className="text-[11px] text-[var(--text-secondary)] flex-1 min-w-0 leading-snug">
                {satir.etiket}:
              </span>
              <span className="text-sm font-black text-[var(--text-primary)] tabular-nums shrink-0">
                {satir.deger}
              </span>
            </div>
          ))}
        </div>

        {/* Sözlük katkısı */}
        {/*
          SÖZLÜK KATKISI.

          Kullanıcının eklediği ve bizde bulunmayan kelimeler, sözlüğün nerede
          yetersiz kaldığını gösteren en doğrudan bilgi. Ama bunu istemek
          zahmetli olmamalı: kimse on dört kelimeyi elle yazıp e-posta
          göndermez. Düğme yalnızca İngilizce yazımları hazır bir taslağa
          koyuyor — Türkçe anlamlar, setler, hiçbir kişisel veri gitmiyor.
        */}
        {learningSummary.sozlukDisiKelimeler.length > 0 && (
          <div className="rounded-xl border border-[var(--learning-border)] bg-[var(--learning-soft)] overflow-hidden">
            <button
              type="button"
              onClick={() => setKatkiAcik(a => !a)}
              aria-expanded={katkiAcik}
              className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-[var(--learning-soft-hover)] transition-colors"
            >
              <span className="text-xs font-bold text-[var(--learning-text)]">
                Sözlüğü birlikte büyütelim
              </span>
              <RealmsIcon name="chevron-down" size={20} className="text-[var(--learning-text)] shrink-0 transition-transform ${ katkiAcik ? 'rotate-180' : '' }" />
            </button>

            {katkiAcik && (
              <div className="px-4 pb-4 space-y-3 border-t border-[var(--learning-border)] pt-3">
                <p className="text-[11px] text-[var(--learning-text)] leading-relaxed">
                  Eklediğin{' '}
                  <b>{learningSummary.sozlukDisiKelimeler.length} kelime</b> ne Oxford
                  listesinde ne de Anlora sözlüğünde var. Bize gönderirsen sözlüğe ekleyip
                  herkesin çalışmasını sağlayabiliriz.
                </p>
                <p className="text-[11px] text-[var(--learning-text)] leading-relaxed opacity-90">
                  <b>Tek tek yazmana gerek yok</b> — düğmeye bastığında bu kelimelerin yalnızca
                  İngilizceleri e-postaya kendiliğinden eklenir. Türkçe anlamların, setlerin ve
                  başka hiçbir bilgin gönderilmez.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const kelimeler = learningSummary.sozlukDisiKelimeler;
                    const konu = `Anlora sözlük önerisi (${kelimeler.length} kelime)`;
                    window.location.href =
                      `mailto:${BRAND.contactEmail}` +
                      `?subject=${encodeURIComponent(konu)}` +
                      `&body=${encodeURIComponent(kelimeler.join('\n'))}`;
                  }}
                  className="px-3.5 py-2 bg-[var(--learning)] hover:opacity-90 text-[var(--surface)] text-[11px] font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Kelimeleri gönder
                </button>
              </div>
            )}
          </div>
        )}

        {/*
          SEVİYELER DE AYNI SATIR BİÇİMİNDE.

          Her satır bir seviyeyi anlatıyor ve üç sayıyı birlikte veriyor:
          öğrendim, tekrar, kalan. Kelimeler ve kalıplar ayrı gruplarda
          duruyor — ikisini toplamak "B2'nin kaçını bitirdim" sorusunun
          cevabını bozardı.
        */}
        <button
          type="button"
          onClick={() => setSeviyelerAcik(a => !a)}
          aria-expanded={seviyelerAcik}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface-soft)] transition-colors cursor-pointer"
        >
          <span className="text-xs font-bold text-[var(--text-primary)]">
            {seviyelerAcik ? 'Seviye ayrıntısını gizle' : 'Daha fazla istatistik'}
          </span>
          <RealmsIcon name="chevron-down" size={20} className="text-[var(--text-secondary)] shrink-0 transition-transform ${ seviyelerAcik ? 'rotate-180' : '' }" />
        </button>

        {seviyelerAcik && (
        <div className="space-y-3">
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold text-[var(--text-secondary)]  tracking-wider px-0.5">
              Oxford Kelimeleri
            </h4>
            <div className="divide-y divide-[var(--border-light)] border border-[var(--border)] rounded-xl overflow-hidden">
              {(['A1', 'A2', 'B1', 'B2', 'C1'] as Level[]).map(lvl => {
                const d = learningSummary.oxfordBreakdown[lvl];
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => {
                      if (onSelectLevel) onSelectLevel(lvl);
                      if (onNavigateToTab) onNavigateToTab('oxford');
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center gap-2.5 bg-[var(--bg)] hover:bg-[var(--surface-soft)] transition-colors cursor-pointer text-left"
                  >
                    <RealmsIcon name="book" size={20} className="shrink-0 text-[var(--primary)]" />
                    <span className="text-[11px] text-[var(--text-secondary)] shrink-0">
                      {lvl} Seviyesi:
                    </span>
                    <span className="text-[11px] flex-1 min-w-0 text-right tabular-nums">
                      <span className="text-[var(--learned)] font-semibold">{d.learned} öğrendim</span>
                      <span className="text-[var(--text-muted)]"> · </span>
                      <span className="text-[var(--learning)] font-semibold">{d.learning} tekrar</span>
                      <span className="text-[var(--text-muted)]"> · </span>
                      <span className="text-[var(--text-muted)] font-semibold">
                        {d.total - d.learned - d.learning} kalan
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/*
            Kalıp satırları yalnızca veri geldiğinde çizilir. Yüklenmeden
            sıfır göstermek, kullanıcının hiç kalıp çalışmadığı izlenimini
            verirdi — oysa henüz bilmiyoruz.
          */}
          {kaliplar && (
            <div className="space-y-1">
              <h4 className="text-[11px] font-bold text-[var(--text-secondary)]  tracking-wider px-0.5">
                Oxford Kalıplar ve Deyimler
              </h4>
              <div className="divide-y divide-[var(--border-light)] border border-[var(--border)] rounded-xl overflow-hidden">
                {learningSummary.kalipDagilimi.map(d => (
                  <div
                    key={d.lvl}
                    className="px-3.5 py-2.5 flex items-center gap-2.5 bg-[var(--bg)]"
                  >
                    <MessageSquareQuote className="w-4 h-4 shrink-0 text-[var(--learning)]" />
                    <span className="text-[11px] text-[var(--text-secondary)] shrink-0">
                      {d.lvl} Seviyesi:
                    </span>
                    <span className="text-[11px] flex-1 min-w-0 text-right tabular-nums">
                      <span className="text-[var(--learned)] font-semibold">{d.learned} öğrendim</span>
                      <span className="text-[var(--text-muted)]"> · </span>
                      <span className="text-[var(--learning)] font-semibold">{d.learning} tekrar</span>
                      <span className="text-[var(--text-muted)]"> · </span>
                      <span className="text-[var(--text-muted)] font-semibold">
                        {d.total - d.learned - d.learning} kalan
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('oxford')}
              className="text-[11px] font-bold text-[var(--primary)] hover:text-[var(--primary-hover)] cursor-pointer"
            >
              Listeye git →
            </button>
          )}
        </div>
        )}
      </div>

      {/* 4. Çalışma Ayarları */}
      {onOpenAdminPanel && (
        <button
          type="button"
          onClick={onOpenAdminPanel}
          className="w-full bg-[var(--text-primary)] hover:bg-[var(--ink-hover)] text-[var(--bg)] rounded-2xl p-5 flex items-center justify-between gap-3 transition-colors cursor-pointer text-left"
        >
          <div>
            <div className="text-sm font-bold flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Yönetim Paneli
            </div>
            <p className="text-[11px] text-white/70 mt-0.5">
              Hesaplar, oturumlar ve yapay zekâ kullanımı.
            </p>
          </div>
          <span className="text-white/70 text-lg">→</span>
        </button>
      )}

      {onOpenFeedback && (
        <button
          type="button"
          onClick={onOpenFeedback}
          className="w-full bg-[var(--surface)] hover:bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-5 flex items-center justify-between gap-3 transition-colors cursor-pointer text-left"
        >
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <RealmsIcon name="report" size={20} className="text-[var(--primary)]" />
              Hata bildir · bize yaz
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Kelime hatası, tasarım sorunu ya da önerin varsa buradan ulaştır.
            </p>
          </div>
          <span className="text-[var(--text-muted)] text-lg">→</span>
        </button>
      )}

      <SettingsPanel settings={settings} onChange={onUpdateSettings} />

      {/* 5. Veri Yönetimi & Yedekleme */}
      <div className="parsomen-panel bg-[var(--surface)] rounded-2xl p-6 sm:p-7 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-4">
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
          <RealmsIcon name="settings" size={20} className="text-[var(--text-secondary)]" />
          <span>Veri ve Yedekleme</span>
        </h3>

        {showExportSuccess && (
          <div className="p-3 bg-[var(--learned-soft)] text-[var(--learned-text)] text-xs rounded-xl border border-[var(--learned-border)] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--learned)] shrink-0 mt-0.5" />
            <span className="min-w-0">
              <span className="font-semibold block">
                {exportedPath ? 'Yedeğin cihaza kaydedildi.' : 'Yedeğin indirildi.'}
              </span>
              <span className="block mt-0.5 opacity-90 leading-relaxed">
                {exportedPath ? (
                  <>
                    Dosya şuraya yazıldı. Açılan paylaşım penceresinden bir
                    kopyasını buluta ya da e-postana gönderebilirsin:
                  </>
                ) : (
                  <>
                    Telefonundaki <b>İndirilenler</b> klasöründe:
                  </>
                )}
              </span>
              <code className="block mt-1 px-2 py-1 rounded-md bg-[var(--surface)] border border-[var(--learned-border)] font-mono text-[10px] break-all">
                {exportedPath ? decodeURIComponent(exportedPath.replace('file://', '')) : exportedName}
              </code>
            </span>
          </div>
        )}

        {importError && (
          <div
            role="alert"
            className="p-3 bg-[var(--danger-soft)] text-[var(--danger)] text-xs font-medium rounded-xl border border-[var(--danger-border)]"
          >
            {importError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportData}
            className="px-3.5 py-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border)] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RealmsIcon name="download" size={18} className="text-[var(--primary)]" />
            <span>Verilerimi Yedekle (JSON İndir)</span>
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            className="px-3.5 py-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border)] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RealmsIcon name="share" size={18} className="text-[var(--primary)]" />
            <span>Yedekten Geri Yükle</span>
          </button>

          <button
            onClick={handleResetData}
            className="px-3.5 py-2 bg-[var(--danger-soft)] hover:bg-[var(--danger-soft-strong)] text-[var(--danger)] text-xs font-semibold rounded-xl border border-[var(--danger-border)] transition-colors flex items-center gap-1.5 ml-auto cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Tüm Verileri Sıfırla</span>
          </button>
        </div>

        {/*
          HESABI SİLME.
          "Tüm verileri sıfırla" yalnızca bu cihazı temizler; hesap ve bulut
          yedeği sunucuda kalır. İkisi ayrı işlerdir ve ayrı ayrı sunulmalı —
          birini yapıp diğerini yaptığını sanmak, veri sildiğini sanıp
          silmemek demek.
        */}
        {profile.isLoggedIn && (
          <div className="pt-4 border-t border-[var(--border-light)] space-y-2">
            <h4 className="text-xs font-bold text-[var(--text-secondary)]">Hesabı kapat</h4>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Hesabın ve bulut yedeğin sunucudan <b>kalıcı olarak</b> silinir. Bu cihazdaki
              kelimelerin ayrıca durur; onları da silmek istersen yukarıdaki "Tüm Verileri
              Sıfırla"yı kullan. İşlem geri alınamaz — önce yedeğini indirmek isteyebilirsin.
            </p>

            {deleteAccountError && (
              <div className="p-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger-border)] text-[11px] text-[var(--danger)]">
                {deleteAccountError}
              </div>
            )}

            {isDeletingAccount ? (
              <div className="space-y-2">
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Parolanı yaz"
                  className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--danger)] text-[var(--text-primary)]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={!deletePassword.trim()}
                    className="px-3.5 py-2 bg-[var(--danger)] hover:opacity-90 text-[var(--surface)] text-xs font-bold rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Hesabımı kalıcı olarak sil
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeletingAccount(false);
                      setDeletePassword('');
                      setDeleteAccountError('');
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] rounded-xl cursor-pointer"
                  >
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsDeletingAccount(true)}
                className="px-3.5 py-2 bg-[var(--danger-soft)] hover:bg-[var(--danger-soft-strong)] text-[var(--danger)] text-xs font-semibold rounded-xl border border-[var(--danger-border)] transition-colors cursor-pointer"
              >
                Hesabımı ve bulut verimi sil
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
