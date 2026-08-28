import React, { useState, useMemo } from 'react';
import { UserProfile, UserStats, WordCard, LearningState, Level, UserSettings } from '../types';
import {
  User,
  LogOut,
  LogIn,
  CheckCircle2,
  RefreshCw,
  BookOpen,
  Layers,
  Award,
  Download,
  Upload,
  Trash2,
  Settings,
  Sparkles,
  Shield,
  MessageSquareWarning,
  Heart,
  BrainCircuit,
  Volume2
} from 'lucide-react';
import { getUserWordStatus } from '../utils/storageV2';
import { CEFRBadge } from './ui/CEFRBadge';
import { generateFullV2Backup, restoreFullV2Backup } from '../utils/storageV2';
import { SettingsPanel } from './SettingsPanel';
import { apiFetch } from '../utils/authClient';
import { useRemoteApi } from '../hooks/useRemoteApi';

interface ProfileViewProps {
  profile: UserProfile;
  stats: UserStats;
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  learningStates: Record<string, LearningState>;
  customWords: WordCard[];
  oxfordWords: WordCard[];
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

    const allWordIds = new Set<string>();
    customWords.forEach((w) => allWordIds.add(w.id));
    oxfordWords.forEach((w) => allWordIds.add(w.id));

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

    oxfordWords.forEach((w) => {
      if (w.level && oxfordBreakdown[w.level]) {
        oxfordBreakdown[w.level].total++;
        const st = getUserWordStatus(w.id, learningStates);
        if (st === 'learned') oxfordBreakdown[w.level].learned++;
        else if (st === 'learning') oxfordBreakdown[w.level].learning++;
      }
    });

    return {
      totalWords: allWordIds.size,
      learnedCount,
      learningCount,
      unseenCount,
      oxfordBreakdown
    };
  }, [customWords, oxfordWords, learningStates]);

  /**
   * Tam yedek indirir.
   *
   * Önceki sürüm kendi uydurma biçimini yazıyordu ve KOLEKSİYONLARI hiç
   * içermiyordu: kullanıcı "yedeğim var" sanıyor, kelime setlerini kaybediyordu.
   * Üstelik üretilen dosya `restoreFullV2Backup`'ın beklediği
   * `schemaVersion: 2` biçiminde olmadığı için geri de yüklenemiyordu; yedek
   * alma özelliği çıkışı olmayan bir yoldu.
   */
  const handleExportData = () => {
    try {
      const payload = generateFullV2Backup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anlora_yedek_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 4000);
    } catch (e) {
      console.error(e);
      setImportError('Yedek dosyası oluşturulurken hata oluştu.');
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
          setImportError('Yedek geri yüklenemedi. Dosya bozuk olabilir.');
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
      <div className="bg-[var(--surface)] rounded-2xl p-6 sm:p-7 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold text-xl border border-[var(--primary-border)]">
            {profile.isLoggedIn && profile.name
              ? profile.name.slice(0, 1).toUpperCase()
              : <User className="w-6 h-6" />}
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
              className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.98] text-[var(--surface)] text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
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
      <div className="bg-[var(--surface)] rounded-2xl p-6 sm:p-7 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-4">
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
            <div className="text-[10px] font-bold text-[var(--learned-text)] uppercase mt-0.5">
              Öğrendim
            </div>
            <div className="text-[9px] text-[var(--learned)] mt-1 font-semibold">Listeyi aç →</div>
          </button>

          <button
            type="button"
            onClick={() => onOpenOxfordStatus?.('LEARNING')}
            className="p-4 bg-[var(--learning-soft)] rounded-xl border border-[var(--learning-border)] text-center transition-colors hover:bg-[var(--learning-soft-strong)] cursor-pointer"
          >
            <RefreshCw className="w-5 h-5 text-[var(--learning)] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[var(--learning-text)]">
              {learningSummary.learningCount}
            </div>
            <div className="text-[10px] font-bold text-[var(--learning-text)] uppercase mt-0.5">
              Öğreniyorum
            </div>
            <div className="text-[9px] text-[var(--learning)] mt-1 font-semibold">Listeyi aç →</div>
          </button>

          <button
            type="button"
            onClick={() => onOpenOxfordStatus?.('FAVORITES')}
            className="p-4 bg-[var(--danger-soft)] rounded-xl border border-[var(--danger-border)] text-center transition-colors hover:bg-[var(--danger-soft-hover)] cursor-pointer"
          >
            <Heart className="w-5 h-5 text-[var(--favorite)] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[var(--danger)]">
              {favorites.length}
            </div>
            <div className="text-[10px] font-bold text-[var(--danger)] uppercase mt-0.5">
              Favori Kelimem
            </div>
            <div className="text-[9px] text-[var(--favorite)] mt-1 font-semibold">Listeyi aç →</div>
          </button>

          <div className="p-4 bg-[var(--primary-soft)] rounded-xl border border-[var(--primary-border)] text-center">
            <BrainCircuit className="w-5 h-5 text-[var(--primary)] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[var(--primary)]">
              {stats.totalQuizzesTaken || 0}
            </div>
            <div className="text-[10px] font-bold text-[var(--primary)] uppercase mt-0.5">
              Çözülen Sınav
            </div>
          </div>
        </div>
      </div>

      {/* 3. Oxford 5000 Seviye İlerlemesi */}
      <div className="bg-[var(--surface)] rounded-2xl p-6 sm:p-7 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[var(--primary)]" />
            <span>Oxford 5000 Seviye Dağılımı</span>
          </h3>

          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('oxford')}
              className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-hover)] cursor-pointer"
            >
              Oxford 5000'e Git →
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['A1', 'A2', 'B1', 'B2'] as Level[]).map((lvl) => {
            const data = learningSummary.oxfordBreakdown[lvl];
            const learnedPercent =
              data.total > 0 ? Math.round((data.learned / data.total) * 100) : 0;
            const learningPercent =
              data.total > 0 ? Math.round((data.learning / data.total) * 100) : 0;

            return (
              <div
                key={lvl}
                onClick={() => {
                  if (onSelectLevel) onSelectLevel(lvl);
                  if (onNavigateToTab) onNavigateToTab('oxford');
                }}
                className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--primary)] transition-all cursor-pointer group space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CEFRBadge level={lvl} size="sm" />
                    <span className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                      {lvl} ({data.total} Kelime)
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[var(--learned)]">
                    %{learnedPercent} Öğrenildi
                  </span>
                </div>

                <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-[var(--learned)]"
                    style={{ width: `${learnedPercent}%` }}
                    title={`Öğrenildi: ${data.learned}`}
                  />
                  <div
                    className="h-full bg-[var(--learning)]"
                    style={{ width: `${learningPercent}%` }}
                    title={`Öğreniliyor: ${data.learning}`}
                  />
                </div>

                <div className="flex justify-between text-[11px] font-semibold text-[var(--text-secondary)] pt-0.5">
                  <span className="text-[var(--learned)]">{data.learned} Öğrendim</span>
                  <span className="text-[var(--learning)]">{data.learning} Öğreniyorum</span>
                  <span className="text-[var(--text-muted)]">{data.total - data.learned - data.learning} Kalan</span>
                </div>
              </div>
            );
          })}
        </div>
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
              <MessageSquareWarning className="w-4 h-4 text-[var(--primary)]" />
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
      <div className="bg-[var(--surface)] rounded-2xl p-6 sm:p-7 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-4">
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-[var(--text-secondary)]" />
          <span>Veri ve Yedekleme</span>
        </h3>

        {showExportSuccess && (
          <div className="p-3 bg-[var(--learned-soft)] text-[var(--learned-text)] text-xs font-semibold rounded-xl border border-[var(--learned-border)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--learned)]" />
            <span>Yedek dosyan başarıyla indirildi.</span>
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
            <Download className="w-3.5 h-3.5 text-[var(--primary)]" />
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
            <Upload className="w-3.5 h-3.5 text-[var(--primary)]" />
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
