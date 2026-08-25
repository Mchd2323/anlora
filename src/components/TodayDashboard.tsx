import React, { useMemo } from 'react';
import {
  Collection,
  CollectionMembership,
  WordCard,
  Level,
  UserProfile,
  LearningState,
  UserSettings,
  UserStats
} from '../types';
import {
  Layers,
  BookOpen,
  Plus,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Flame,
  Target,
  Play
} from 'lucide-react';
import { getUserWordStatus } from '../utils/storageV2';
import { summarizeQueue } from '../utils/srsEngine';
import { CEFRBadge } from './ui/CEFRBadge';
import { BRAND } from '../config/brand';

interface TodayDashboardProps {
  collections: Collection[];
  memberships: CollectionMembership[];
  /** Oxford 3000 (A1–B2). */
  oxfordWords: WordCard[];
  /** Oxford 5000 Ek (B2 Ek, C1). Seviye kartlarında ayrı sayılır. */
  extraWords?: WordCard[];
  customWords?: WordCard[];
  learningStates?: Record<string, LearningState>;
  settings?: UserSettings;
  stats?: UserStats;
  profile?: UserProfile;
  onNavigateToTab: (tab: string) => void;
  onSelectLevel?: (level: Level | 'B2_EK') => void;
  onOpenCreateSet?: () => void;
  onOpenAuthModal?: () => void;
  onStartStudy?: (collectionId?: string) => void;
  onOpenTextMiner?: () => void;
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({
  collections,
  memberships,
  oxfordWords,
  extraWords = [],
  customWords = [],
  learningStates = {},
  settings,
  stats,
  profile,
  onNavigateToTab,
  onSelectLevel,
  onOpenCreateSet,
  onOpenAuthModal,
  onStartStudy
}) => {
  // Bugünün iş yükü: bekleyen tekrarlar ve hiç çalışılmamış kelimeler ayrı
  // sayılır. Tek bir "vadesi gelen" sayısı vermek, dokunulmamış tüm Oxford
  // sözlüğünü (~3.900 madde) günlük göreve dönüştürüyordu.
  const todayQueue = useMemo(() => {
    const ids = [...oxfordWords, ...customWords].map(w => w.id);
    return summarizeQueue(ids, learningStates);
  }, [oxfordWords, customWords, learningStates]);

  const reviewGoal = settings?.dailyReviewGoal ?? 15;
  const newGoal = settings?.dailyNewWordsGoal ?? 5;
  const plannedReviews = Math.min(todayQueue.dueCount, reviewGoal);
  const plannedNew = Math.min(todayQueue.newCount, newGoal);
  const plannedTotal = plannedReviews + plannedNew;
  const streakDays = stats?.streakDays ?? 0;
  /*
   * Oxford seviye sayıları ve ilerlemesi.
   *
   * Oxford 3000 ve Oxford 5000 Ek tek başlık altında birleşti; ana sayfadaki
   * kartlar da altı seviyeyi birden gösterir. B2 Ek ayrı bir kova olarak
   * kalır: aynı CEFR seviyesinde olsalar da farklı kaynak listelerdir ve
   * ikisini toplamak, olmayan bir birleşik listeyi varmış gibi gösterirdi.
   */
  const oxfordLevelStats = useMemo(() => {
    const counts: Record<string, { total: number; learned: number; learning: number }> = {
      A1: { total: 0, learned: 0, learning: 0 },
      A2: { total: 0, learned: 0, learning: 0 },
      B1: { total: 0, learned: 0, learning: 0 },
      B2: { total: 0, learned: 0, learning: 0 },
      B2_EK: { total: 0, learned: 0, learning: 0 },
      C1: { total: 0, learned: 0, learning: 0 }
    };

    const tally = (card: WordCard, key: string) => {
      if (!counts[key]) return;
      counts[key].total++;
      const st = getUserWordStatus(card.id, learningStates);
      if (st === 'learned') counts[key].learned++;
      else if (st === 'learning') counts[key].learning++;
    };

    oxfordWords.forEach(w => tally(w, w.level || ''));
    extraWords.forEach(w => tally(w, w.level === 'C1' ? 'C1' : 'B2_EK'));

    return counts;
  }, [oxfordWords, extraWords, learningStates]);

  const hasSets = collections.length > 0;

  // Set oluşturmak giriş gerektirmez: veri zaten yerelde tutuluyor ve giriş
  // yalnızca bulut yedeklemesi içindir. İlk adımda hesap istemek, ürünün
  // "hızlı ekleme" vaadinin önündeki en büyük sürtünmeydi.
  const handleCreateSetClick = () => {
    if (onOpenCreateSet) {
      onOpenCreateSet();
    } else {
      onNavigateToTab('collections');
    }
  };

  return (
    <div className="space-y-6 pb-safe-nav max-w-[1080px] mx-auto animate-fadeIn">
      {/* 1. ÜST BÖLÜM: Anlora Marka Karşılama ve Slogan */}
      <div className="text-left space-y-2 pt-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl sm:text-4xl font-black text-[#1E2430] tracking-tight">
            {BRAND.name}
          </h1>
          <p className="text-lg sm:text-xl font-semibold text-[#4F46A5] tracking-tight">
            {BRAND.slogan}
          </p>
        </div>
        <p className="text-xs text-[#687080] max-w-2xl leading-relaxed">
          Kendi kelime setlerini oluştur veya Oxford 5000 kelimelerini seviyene göre çalış. Kelimeleri öğren, bildiklerini işaretle ve tekrar ederek aklında tut.
        </p>
      </div>

      {/*
        SIRALAMA
        Kullanıcının kendi setleri en üstte durur: uygulamaya girme sebebi
        çoğunlukla kendi kelimeleri. Hazır sözlük onun altında, günlük plan
        ise en altta — plan bir özet, bir başlangıç noktası değil.
      */}
      {/* 1. KELİME SETLERİM */}
      <div className="bg-[#FFFFFF] rounded-2xl p-6 sm:p-7 border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#EEECFA] text-[#4F46A5] flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-[#1E2430]">Kelime Setlerim</h2>
            </div>
            <p className="text-sm text-[#687080] leading-relaxed">
              Dizi, kitap, ders veya günlük hayatta karşılaştığın kelimelerden kendi setlerini oluştur.
            </p>

            {/* AI Callout */}
            <div className="p-3 bg-[#EEECFA]/80 rounded-xl border border-[#D7D2F4] text-xs text-[#1E2430] flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#4F46A5] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#4F46A5] block">
                  ✨ {BRAND.aiName} ile hazırla
                </span>
                <p className="text-[#687080] text-[11px] mt-0.5">
                  Kelimeyi yaz; Türkçe anlamlarını kendin ekle veya Anlora AI ile anlamları ve doğal örnek cümleleri hazırlat.
                </p>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={handleCreateSetClick}
              className="px-4 py-2.5 bg-[#4F46A5] hover:bg-[#433B91] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Kelime Seti Oluştur</span>
            </button>
          </div>
        </div>

        {/* Set Listesi veya İlk Set Onboarding */}
        {hasSets ? (
          <div className="space-y-3 pt-2 border-t border-[#EFECE6]">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {collections.slice(0, 3).map((deck) => {
                const count = memberships.filter((m) => m.collectionId === deck.id).length;
                let learned = 0;
                let learning = 0;

                memberships
                  .filter((m) => m.collectionId === deck.id)
                  .forEach((m) => {
                    const st = getUserWordStatus(m.wordId, learningStates);
                    if (st === 'learned') learned++;
                    else if (st === 'learning') learning++;
                  });

                const learnedPercent = count > 0 ? Math.round((learned / count) * 100) : 0;

                return (
                  <div
                    key={deck.id}
                    onClick={() => onNavigateToTab('collections')}
                    className="p-4 rounded-xl bg-[#F8F7F3] hover:bg-[#F1EFE8] border border-[#E4E1D9] hover:border-[#D5D0C5] transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <h4 className="font-bold text-[#1E2430] text-sm group-hover:text-[#4F46A5] transition-colors truncate">
                        {deck.name}
                      </h4>
                      <p className="text-xs text-[#687080] mt-0.5 font-medium">
                        {count} kelime
                      </p>
                    </div>

                    <div className="mt-4 space-y-1.5 pt-2 border-t border-[#E4E1D9]">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#687080]">
                        <span className="text-[#4F806A]">{learned} Öğrendim</span>
                        <span className="text-[#B97922]">{learning} Tekrar Et</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#E4E1D9] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#4F806A] rounded-full transition-all"
                          style={{ width: `${learnedPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => onNavigateToTab('collections')}
                className="text-xs font-semibold text-[#4F46A5] hover:text-[#433B91] flex items-center gap-1 group cursor-pointer"
              >
                <span>Tüm Setlerimi Gör ({collections.length})</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-xl bg-[#F8F7F3] border border-[#E4E1D9] space-y-2">
            <h3 className="font-bold text-[#1E2430] text-sm">
              Henüz bir Kelime Setin yok
            </h3>
            <p className="text-xs text-[#687080] leading-relaxed">
              İlk setini oluştur ve karşılaştığın kelimeleri biriktirmeye başla.
            </p>
            <div className="pt-1">
              <button
                onClick={handleCreateSetClick}
                className="px-3.5 py-2 bg-[#4F46A5] hover:bg-[#433B91] text-white text-xs font-semibold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>İlk Setimi Oluştur</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. OXFORD 5000 */}
      <div className="bg-[#FFFFFF] rounded-2xl p-6 sm:p-7 border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#EDF4F0] text-[#4F806A] flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-[#1E2430]">Oxford 5000</h2>
            </div>
            <p className="text-sm text-[#687080]">
              A1'den C1'e İngilizce kelimelerini seviyene göre çalış.
            </p>
          </div>

          <button
            onClick={() => onNavigateToTab('oxford')}
            className="text-xs font-semibold text-[#4F46A5] hover:text-[#433B91] flex items-center gap-1 self-start sm:self-auto shrink-0 cursor-pointer"
          >
            <span>Tüm Oxford 5000'i Gör</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Altı seviye kartı: A1, A2, B1, B2, B2 Ek, C1 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
          {[
            {
              level: 'A1' as const,
              title: 'A1 Başlangıç',
              stats: oxfordLevelStats.A1,
              topBorder: 'border-t-2 border-t-[#5F806D]'
            },
            {
              level: 'A2' as const,
              title: 'A2 Temel',
              stats: oxfordLevelStats.A2,
              topBorder: 'border-t-2 border-t-[#4E7D80]'
            },
            {
              level: 'B1' as const,
              title: 'B1 Orta Seviye',
              stats: oxfordLevelStats.B1,
              topBorder: 'border-t-2 border-t-[#6258A5]'
            },
            {
              level: 'B2' as const,
              title: 'B2 İleri Orta',
              stats: oxfordLevelStats.B2,
              topBorder: 'border-t-2 border-t-[#795F87]'
            },
            {
              level: 'B2_EK' as const,
              title: 'B2 Ek',
              stats: oxfordLevelStats.B2_EK,
              topBorder: 'border-t-2 border-t-[#8A6A9A]'
            },
            {
              level: 'C1' as const,
              title: 'C1 İleri',
              stats: oxfordLevelStats.C1,
              topBorder: 'border-t-2 border-t-[#593E91]'
            }
          ].map((lvl) => {
            const learnedPercent =
              lvl.stats.total > 0 ? Math.round((lvl.stats.learned / lvl.stats.total) * 100) : 0;

            return (
              <button
                key={lvl.level}
                onClick={() => {
                  if (onSelectLevel) onSelectLevel(lvl.level);
                  onNavigateToTab('oxford');
                }}
                className={`p-4 rounded-xl bg-[#F8F7F3] hover:bg-[#F1EFE8] border border-[#E4E1D9] hover:border-[#D5D0C5] text-left transition-all group relative cursor-pointer ${lvl.topBorder}`}
              >
                <div className="flex items-center justify-between">
                  <CEFRBadge level={lvl.level === 'B2_EK' ? 'B2 EK' : lvl.level} size="sm" />
                  <ChevronRight className="w-4 h-4 text-[#8E95A2] group-hover:text-[#4F46A5] group-hover:translate-x-0.5 transition-transform" />
                </div>

                <div className="mt-3">
                  <div className="text-xs font-bold text-[#1E2430]">{lvl.title}</div>
                  <div className="text-[11px] text-[#687080] mt-0.5">
                    {lvl.stats.total} Kelime
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[10px] font-semibold text-[#687080]">
                    <span>{lvl.stats.learned} Öğrendim</span>
                    <span>%{learnedPercent}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#E4E1D9] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#4F806A] rounded-full transition-all"
                      style={{ width: `${learnedPercent}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {/* 3. BUGÜNÜN PLANI: bekleyen tekrar, yeni kelime ve günlük seri */}
      <div className="bg-[#FFFFFF] rounded-2xl p-5 sm:p-6 border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#EEECFA] text-[#4F46A5] flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E2430]">Bugünün Planı</h2>
              <p className="text-[11px] text-[#687080]">
                Günlük hedefin: {reviewGoal} tekrar + {newGoal} yeni kelime
              </p>
            </div>
          </div>

          {streakDays > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FBF1DE] border border-[#E7C98F] self-start">
              <Flame className="w-3.5 h-3.5 text-[#B97922]" />
              <span className="text-xs font-bold text-[#8A5A18]">
                {streakDays} günlük seri
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#EFECE6]">
            <div className="text-2xl font-black text-[#4F46A5] tabular-nums">
              {todayQueue.dueCount}
            </div>
            <div className="text-[10px] font-bold text-[#687080] uppercase tracking-wide mt-0.5">
              Bekleyen tekrar
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#EFECE6]">
            <div className="text-2xl font-black text-[#4F806A] tabular-nums">
              {todayQueue.newCount}
            </div>
            <div className="text-[10px] font-bold text-[#687080] uppercase tracking-wide mt-0.5">
              Hiç çalışılmamış
            </div>
          </div>
        </div>

        {onStartStudy && (
          <button
            onClick={() => onStartStudy()}
            disabled={plannedTotal === 0}
            className="w-full mt-4 py-3 bg-[#4F46A5] hover:bg-[#433B91] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>
              {plannedTotal > 0
                ? `Çalışmaya başla (${plannedTotal} kelime)`
                : 'Bugünlük her şey tamam'}
            </span>
          </button>
        )}
      </div>

    </div>
  );
};
