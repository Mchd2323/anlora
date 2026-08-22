import React from 'react';
import { UserStats, Badge, WordCard, LearningState } from '../types';
import { BADGES_DATA } from '../data/oxfordWords';
import {
  BarChart3,
  Award,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trophy,
  BookOpen,
  Footprints,
  Bookmark,
  Sparkles,
  Trash2,
  Activity,
  Flame,
  Brain
} from 'lucide-react';
import { WordCardComponent } from './WordCard';
import { calculateMemoryHealth } from '../utils/srsEngine';

interface StatsAndBadgesProps {
  stats: UserStats;
  learningStates: Record<string, LearningState>;
  customWords: WordCard[];
  oxfordWords: WordCard[];
  unlockedBadgeIds: string[];
  favorites: string[];
  onClearMistake: (wordId: string) => void;
  onToggleFavorite: (id: string) => void;
  onStartStudyWithWeakWords?: () => void;
}

export const StatsAndBadges: React.FC<StatsAndBadgesProps> = ({
  stats,
  learningStates,
  customWords,
  oxfordWords,
  unlockedBadgeIds,
  favorites,
  onClearMistake,
  onToggleFavorite,
  onStartStudyWithWeakWords
}) => {
  const totalQuestions = stats.totalCorrect + stats.totalWrong;
  const accuracyRate = totalQuestions > 0 ? Math.round((stats.totalCorrect / totalQuestions) * 100) : 0;

  const allWordsMap = React.useMemo(() => {
    const map = new Map<string, WordCard>();
    customWords.forEach(w => map.set(w.id, w));
    oxfordWords.forEach(w => map.set(w.id, w));
    return map;
  }, [customWords, oxfordWords]);

  const allWordIds: string[] = Array.from(allWordsMap.keys());
  const memoryHealth = calculateMemoryHealth(allWordIds, learningStates);

  // Calculate stage breakdown
  const stageCounts = React.useMemo(() => {
    let mastered = 0;
    let review = 0;
    let learning = 0;
    let weak = 0;
    let nw = 0;

    allWordIds.forEach(id => {
      const s = learningStates[id];
      if (!s || s.stage === 'NEW') nw++;
      else if (s.stage === 'MASTERED') mastered++;
      else if (s.stage === 'REVIEW') review++;
      else if (s.stage === 'WEAK') weak++;
      else learning++;
    });

    return { mastered, review, learning, weak, new: nw };
  }, [allWordIds, learningStates]);

  const mistakesList = Object.values(stats.mistakesMap || {}) as { word: WordCard; wrongCount?: number }[];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Footprints': return <Footprints className="w-5 h-5" />;
      case 'Award': return <Award className="w-5 h-5" />;
      case 'Zap': return <Zap className="w-5 h-5" />;
      case 'BookOpen': return <BookOpen className="w-5 h-5" />;
      case 'Trophy': return <Trophy className="w-5 h-5" />;
      case 'Bookmark': return <Bookmark className="w-5 h-5" />;
      default: return <Sparkles className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Overview Stat Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
          <span className="text-3xs font-extrabold text-slate-400 uppercase tracking-wider">
            Hafıza Sağlığı
          </span>
          <p className="text-3xl font-black text-indigo-600">%{memoryHealth}</p>
          <p className="text-2xs text-slate-500">Kalıcı hafıza skoru</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
          <span className="text-3xs font-extrabold text-slate-400 uppercase tracking-wider">
            Doğruluk Oranı
          </span>
          <p className="text-3xl font-black text-emerald-600">%{accuracyRate}</p>
          <p className="text-2xs text-slate-500">{stats.totalCorrect} Doğru / {totalQuestions} Toplam</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
          <span className="text-3xs font-extrabold text-slate-400 uppercase tracking-wider">
            Usta Kelimeler
          </span>
          <p className="text-3xl font-black text-emerald-700">{stageCounts.mastered}</p>
          <p className="text-2xs text-slate-500">Uzun süreli hafızada</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
          <span className="text-3xs font-extrabold text-slate-400 uppercase tracking-wider">
            Günlük Çalışma Serisi
          </span>
          <p className="text-3xl font-black text-amber-500 flex items-center gap-1">
            <Flame className="w-6 h-6 fill-current text-amber-500" />
            {stats.streakDays || 1} Gün
          </p>
          <p className="text-2xs text-slate-500">Kesintisiz çalışma</p>
        </div>
      </div>

      {/* Spaced Repetition Memory Stages Breakdown */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            Aralıklı Tekrar (SRS) Aşama Dağılımı
          </h3>
          <span className="text-xs font-bold text-slate-500">Toplam {allWordIds.length} Kelime</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
            <span className="text-3xs font-black text-emerald-700 block uppercase">USTA (MASTERED)</span>
            <span className="text-2xl font-black text-emerald-900">{stageCounts.mastered}</span>
            <span className="text-3xs text-emerald-700 block mt-0.5">%85+ Ustalık</span>
          </div>

          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200 text-center">
            <span className="text-3xs font-black text-indigo-700 block uppercase">TEKRARDA (REVIEW)</span>
            <span className="text-2xl font-black text-indigo-900">{stageCounts.review}</span>
            <span className="text-3xs text-indigo-700 block mt-0.5">Periyodik Tekrar</span>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-center">
            <span className="text-3xs font-black text-amber-700 block uppercase">ÖĞRENİLİYOR</span>
            <span className="text-2xl font-black text-amber-900">{stageCounts.learning}</span>
            <span className="text-3xs text-amber-700 block mt-0.5">Aktif Çalışma</span>
          </div>

          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-center">
            <span className="text-3xs font-black text-rose-700 block uppercase">ZORLANILAN (WEAK)</span>
            <span className="text-2xl font-black text-rose-900">{stageCounts.weak}</span>
            <span className="text-3xs text-rose-700 block mt-0.5">Hata Yapılan</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
            <span className="text-3xs font-black text-slate-500 block uppercase">YENİ (NEW)</span>
            <span className="text-2xl font-black text-slate-800">{stageCounts.new}</span>
            <span className="text-3xs text-slate-500 block mt-0.5">Henüz Başlanmadı</span>
          </div>
        </div>
      </div>

      {/* Motivational Badges Grid */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Motivasyon Rozetleri ({unlockedBadgeIds.length} / {BADGES_DATA.length})
            </h3>
            <p className="text-xs text-slate-500">
              Kelimeleri çalışarak, seansları tamamlayarak ve özel koleksiyonlar oluşturarak rozetler kazanın.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {BADGES_DATA.map((badge) => {
            const isUnlocked = unlockedBadgeIds.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`p-4 rounded-2xl border transition-all flex items-start gap-3 ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50/40 border-amber-300 shadow-xs'
                    : 'bg-slate-50 border-slate-200 opacity-60 grayscale'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                    isUnlocked
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {getIcon(badge.iconName)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900">{badge.name}</h4>
                    {isUnlocked && (
                      <span className="text-3xs font-extrabold bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full">
                        Kazanıldı
                      </span>
                    )}
                  </div>
                  <p className="text-3xs text-slate-600 leading-snug">{badge.description}</p>
                  <p className="text-3xs text-slate-400 italic pt-1">Gereksinim: {badge.requirementText}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mistakes Notebook Section */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Zorlanılan ve Yanlış Yapılan Kelimeler ({mistakesList.length})
            </h3>
            <p className="text-xs text-slate-500">
              Seanslarda ve sınavlarda zorlandığınız kelimeler buraya kaydedilir.
            </p>
          </div>

          {mistakesList.length > 0 && onStartStudyWithWeakWords && (
            <button
              onClick={onStartStudyWithWeakWords}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0"
            >
              <Brain className="w-4 h-4" />
              <span>Bu Kelimeleri Şimdi Tekrar Et</span>
            </button>
          )}
        </div>

        {mistakesList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {mistakesList.map((item) => (
              <div key={item.word.id} className="relative group">
                <WordCardComponent
                  card={item.word}
                  isFavorite={favorites.includes(item.word.id)}
                  learningState={learningStates[item.word.id]}
                  onToggleFavorite={onToggleFavorite}
                />
                <button
                  onClick={() => onClearMistake(item.word.id)}
                  className="mt-2 w-full py-1.5 px-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yanlışlar Listesinden Kaldır</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 p-8 rounded-2xl text-center space-y-2 border border-slate-100">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">
              Harika! Zorlandığınız Kelime Yok.
            </h4>
            <p className="text-xs text-slate-500">
              Çalıştıkça hata yapılan kelimeler otomatik olarak burada listelenecektir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
