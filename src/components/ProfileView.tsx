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
  Heart,
  BrainCircuit,
  Volume2
} from 'lucide-react';
import { getUserWordStatus } from '../utils/storageV2';
import { CEFRBadge } from './ui/CEFRBadge';
import { generateFullV2Backup, restoreFullV2Backup } from '../utils/storageV2';
import { SettingsPanel } from './SettingsPanel';

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
  onSelectLevel
}) => {
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
    <div className="space-y-6 pb-16 max-w-[880px] mx-auto animate-fadeIn">
      {/* 1. Profil Başlık ve Hesap Kartı */}
      <div className="bg-[#FFFFFF] rounded-2xl p-6 sm:p-7 border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-[#EEECFA] text-[#4F46A5] flex items-center justify-center font-bold text-xl border border-[#D7D2F4]">
            {profile.isLoggedIn && profile.name
              ? profile.name.slice(0, 1).toUpperCase()
              : <User className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#1E2430]">
                {profile.isLoggedIn ? profile.name || 'Öğrenci' : 'Misafir Kullanıcı'}
              </h2>
              {profile.isLoggedIn && (
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-[#E9F3ED] text-[#35654E] font-bold text-[10px] border border-[#BFD7C8]">
                    Üye
                  </span>
                  {profile.emailVerified && (
                    <span className="px-2 py-0.5 rounded-md bg-[#EEECFA] text-[#4F46A5] font-bold text-[10px] border border-[#D7D2F4]">
                      Doğrulandı
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-[#687080] mt-0.5">
              {profile.isLoggedIn
                ? profile.email || 'Hesabın senkronize ediliyor'
                : 'İlerlemen bu tarayıcıda kaydedilmektedir.'}
            </p>
            {profile.isLoggedIn && profile.city && (
              <p className="text-[11px] font-medium text-[#8E95A2] mt-0.5 flex items-center gap-1">
                <span>📍 {profile.city}, {profile.country || 'Türkiye'}</span>
              </p>
            )}
          </div>
        </div>

        <div>
          {profile.isLoggedIn ? (
            <button
              onClick={onLogout}
              className="px-3.5 py-2 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-[#1E2430] text-xs font-semibold rounded-xl border border-[#E4E1D9] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-[#687080]" />
              <span>Çıkış Yap</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="px-4 py-2 bg-[#4F46A5] hover:bg-[#433B91] active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Giriş Yap / Ücretsiz Hesap Aç</span>
            </button>
          )}
        </div>
      </div>

      {/* Guest Callout if not logged in */}
      {!profile.isLoggedIn && (
        <div className="p-5 rounded-2xl bg-[#FBF1DE]/60 border border-[#E7C98F] text-[#8A5A18] space-y-2">
          <div className="font-bold text-xs flex items-center gap-1.5 text-[#8A5A18]">
            <Shield className="w-4 h-4 text-[#B97922]" />
            <span>Anlora'yı misafir olarak kullanıyorsun</span>
          </div>
          <p className="text-xs text-[#8A5A18] leading-relaxed">
            Oxford ilerlemen bu cihazda saklanıyor. Kendi Kelime Setlerini oluşturmak için hesap açabilirsin.
          </p>
          <div className="pt-0.5">
            <button
              onClick={onOpenAuthModal}
              className="px-3.5 py-1.5 bg-[#B97922] hover:bg-[#A3681B] text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Hesap Oluştur
            </button>
          </div>
        </div>
      )}

      {/* 2. Genel Öğrenme İstatistikleri */}
      <div className="bg-[#FFFFFF] rounded-2xl p-6 sm:p-7 border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-4">
        <h3 className="text-sm font-bold text-[#1E2430] flex items-center gap-1.5">
          <Award className="w-4 h-4 text-[#4F46A5]" />
          <span>Genel Öğrenme Durumu</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-[#E9F3ED] rounded-xl border border-[#BFD7C8] text-center">
            <CheckCircle2 className="w-5 h-5 text-[#4F806A] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[#35654E]">
              {learningSummary.learnedCount}
            </div>
            <div className="text-[10px] font-bold text-[#35654E] uppercase mt-0.5">
              Öğrendim
            </div>
          </div>

          <div className="p-4 bg-[#FBF1DE] rounded-xl border border-[#E7C98F] text-center">
            <RefreshCw className="w-5 h-5 text-[#B97922] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[#8A5A18]">
              {learningSummary.learningCount}
            </div>
            <div className="text-[10px] font-bold text-[#8A5A18] uppercase mt-0.5">
              Öğreniyorum
            </div>
          </div>

          <div className="p-4 bg-[#FAECEA] rounded-xl border border-[#F0CBC7] text-center">
            <Heart className="w-5 h-5 text-[#B75D6A] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[#C65D55]">
              {favorites.length}
            </div>
            <div className="text-[10px] font-bold text-[#C65D55] uppercase mt-0.5">
              Favori Kelimem
            </div>
          </div>

          <div className="p-4 bg-[#EEECFA] rounded-xl border border-[#D7D2F4] text-center">
            <BrainCircuit className="w-5 h-5 text-[#4F46A5] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[#4F46A5]">
              {stats.totalQuizzesTaken || 0}
            </div>
            <div className="text-[10px] font-bold text-[#4F46A5] uppercase mt-0.5">
              Çözülen Sınav
            </div>
          </div>
        </div>
      </div>

      {/* 3. Oxford 3000 Seviye İlerlemesi */}
      <div className="bg-[#FFFFFF] rounded-2xl p-6 sm:p-7 border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1E2430] flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[#4F46A5]" />
            <span>Oxford 3000 Seviye Dağılımı</span>
          </h3>

          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('oxford')}
              className="text-xs font-bold text-[#4F46A5] hover:text-[#433B91] cursor-pointer"
            >
              Oxford 3000'e Git →
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
                className="p-4 rounded-xl bg-[#F8F7F3] border border-[#E4E1D9] hover:border-[#4F46A5] transition-all cursor-pointer group space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CEFRBadge level={lvl} size="sm" />
                    <span className="font-bold text-xs text-[#1E2430] group-hover:text-[#4F46A5] transition-colors">
                      {lvl} ({data.total} Kelime)
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#4F806A]">
                    %{learnedPercent} Öğrenildi
                  </span>
                </div>

                <div className="h-1.5 w-full bg-[#E4E1D9] rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-[#4F806A]"
                    style={{ width: `${learnedPercent}%` }}
                    title={`Öğrenildi: ${data.learned}`}
                  />
                  <div
                    className="h-full bg-[#B97922]"
                    style={{ width: `${learningPercent}%` }}
                    title={`Öğreniliyor: ${data.learning}`}
                  />
                </div>

                <div className="flex justify-between text-[11px] font-semibold text-[#687080] pt-0.5">
                  <span className="text-[#4F806A]">{data.learned} Öğrendim</span>
                  <span className="text-[#B97922]">{data.learning} Öğreniyorum</span>
                  <span className="text-[#8E95A2]">{data.total - data.learned - data.learning} Kalan</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Çalışma Ayarları */}
      <SettingsPanel settings={settings} onChange={onUpdateSettings} />

      {/* 5. Veri Yönetimi & Yedekleme */}
      <div className="bg-[#FFFFFF] rounded-2xl p-6 sm:p-7 border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-4">
        <h3 className="text-sm font-bold text-[#1E2430] flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-[#687080]" />
          <span>Veri ve Yedekleme</span>
        </h3>

        {showExportSuccess && (
          <div className="p-3 bg-[#E9F3ED] text-[#35654E] text-xs font-semibold rounded-xl border border-[#BFD7C8] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#4F806A]" />
            <span>Yedek dosyan başarıyla indirildi.</span>
          </div>
        )}

        {importError && (
          <div
            role="alert"
            className="p-3 bg-[#FAECEA] text-[#C65D55] text-xs font-medium rounded-xl border border-[#F0CBC7]"
          >
            {importError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportData}
            className="px-3.5 py-2 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-[#1E2430] text-xs font-semibold rounded-xl border border-[#E4E1D9] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#4F46A5]" />
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
            className="px-3.5 py-2 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-[#1E2430] text-xs font-semibold rounded-xl border border-[#E4E1D9] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#4F46A5]" />
            <span>Yedekten Geri Yükle</span>
          </button>

          <button
            onClick={handleResetData}
            className="px-3.5 py-2 bg-[#FAECEA] hover:bg-[#F5D7D3] text-[#C65D55] text-xs font-semibold rounded-xl border border-[#F0CBC7] transition-colors flex items-center gap-1.5 ml-auto cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Tüm Verileri Sıfırla</span>
          </button>
        </div>
      </div>
    </div>
  );
};
