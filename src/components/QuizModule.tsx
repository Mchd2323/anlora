import React, { useState, useMemo } from 'react';
import {
  WordCard,
  LearningState,
  Collection,
  CollectionMembership,
  Level,
  QuizSessionSummary,
  ResponseQuality
} from '../types';
import {
  GraduationCap,
  Sparkles,
  Volume2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  Brain,
  Layers,
  Award,
  BookOpen,
  Check,
  PenTool,
  CheckSquare,
  Square,
  ArrowLeft
} from 'lucide-react';
import { speakText } from '../utils/speech';
import {
  QuizQuestion,
  QuizMode,
  MIN_POOL_SIZE,
  generateQuiz,
  normalizeTypedAnswer
} from '../utils/quizGenerator';
import { getUserWordStatus } from '../utils/storageV2';
import { CEFRBadge } from './ui/CEFRBadge';
import { LearningStatusControl } from './ui/LearningStatusControl';
import { BRAND } from '../config/brand';
import { OxfordGroupKey } from '../types/oxford';

/** Sınav kaynağı olarak seçilebilen Oxford grupları. */
const OXFORD_GROUP_KEYS: OxfordGroupKey[] = ['A1', 'A2', 'B1', 'B2', 'B2_EK', 'C1'];

const OXFORD_GROUP_LABELS: Record<OxfordGroupKey, string> = {
  A1: 'Oxford A1',
  A2: 'Oxford A2',
  B1: 'Oxford B1',
  B2: 'Oxford B2',
  B2_EK: 'Oxford B2 Ek',
  C1: 'Oxford C1'
};

/**
 * Bir kartın Oxford grup anahtarını verir.
 *
 * B2 Ek ile Oxford 3000 B2 aynı CEFR seviyesindedir ama farklı kaynak
 * gruplarıdır; ayrımı `sourceEntryId` öneki taşır (ox3k / ox5k).
 */
function oxfordGroupOf(card: WordCard): OxfordGroupKey | null {
  const id = card.sourceEntryId || card.id;
  if (typeof id !== 'string') return null;
  if (id.startsWith('ox5k-')) return card.level === 'C1' ? 'C1' : 'B2_EK';
  if (id.startsWith('ox3k-')) return (card.level as OxfordGroupKey) || null;
  return null;
}

interface QuizModuleProps {
  initialCollectionId?: string;
  allWords: WordCard[]; // Oxford 3000 words
  extraWords?: WordCard[]; // Oxford 5000 Ek (B2 Ek + C1)
  customCards: WordCard[]; // Custom cards
  collections: Collection[];
  memberships: CollectionMembership[];
  learningStates: Record<string, LearningState>;
  onRecordStudyResult?: (
    wordId: string,
    quality: ResponseQuality,
    mode: 'quiz',
    collectionId?: string
  ) => void;
  /**
   * Sınav bittiğinde çağrılır.
   *
   * Önceki sürümde bu prop `onFinishQuiz` adını taşıyor, `App.tsx` ise
   * `onCompleteQuiz` gönderiyordu. İsimler tutmadığı için geri çağrı hiç
   * bağlanmıyor ve sınav sonucu (istatistik, hata listesi, rozet kontrolü)
   * hiçbir zaman kaydedilmiyordu. Tek isimde birleştirildi.
   */
  onFinishQuiz?: (summary: QuizSessionSummary) => void;
  onGoToMistakes?: () => void;
  onSetWordStatus?: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
}

type StatusFilter = 'ALL' | 'LEARNING' | 'LEARNED';

export const QuizModule: React.FC<QuizModuleProps> = ({
  initialCollectionId,
  allWords,
  extraWords = [],
  customCards,
  collections,
  memberships,
  learningStates,
  onRecordStudyResult,
  onFinishQuiz,
  onGoToMistakes,
  onSetWordStatus
}) => {
  const [quizState, setQuizState] = useState<'IDLE' | 'ACTIVE' | 'FINISHED'>('IDLE');

  // Configuration State
  const [quizMode, setQuizMode] = useState<QuizMode>('MIXED');
  // Seçili kaynaklar: Oxford grup anahtarları ('A1'…'C1', 'B2_EK') veya
  // kullanıcının kendi set kimlikleri. Kullanıcı seti silinirse kaynak
  // listesinden de kendiliğinden düşer (koleksiyon listesinden okunuyor).
  const [selectedSources, setSelectedSources] = useState<string[]>(
    initialCollectionId ? [initialCollectionId] : ['A1', 'A2']
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Active Quiz State
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState<
    { question: QuizQuestion; selected: string; isCorrect: boolean }[]
  >([]);

  // Toggle a single source (Oxford level or Collection ID)
  const handleToggleSource = (sourceKey: string) => {
    setSelectedSources((prev) => {
      if (prev.includes(sourceKey)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter((s) => s !== sourceKey);
      } else {
        return [...prev, sourceKey];
      }
    });
  };

  const handleSelectAllOxford = () => {
    setSelectedSources(['A1', 'A2', 'B1', 'B2', 'B2_EK', 'C1']);
  };

  // Oxford grup sayıları; arayüzde sabit sayı yazmak yerine veriden okunur.
  const oxfordGroupCounts = useMemo(() => {
    const counts = {} as Record<OxfordGroupKey, number>;
    OXFORD_GROUP_KEYS.forEach((key) => {
      counts[key] = 0;
    });
    [...allWords, ...extraWords].forEach((card) => {
      const group = oxfordGroupOf(card);
      if (group) counts[group] = (counts[group] || 0) + 1;
    });
    return counts;
  }, [allWords, extraWords]);

  // Calculate available pool size based on chosen sources and filter
  const currentPool = useMemo(() => {
    const combinedAll = [...allWords, ...customCards];
    const wordSet = new Set<WordCard>();

    selectedSources.forEach((src) => {
      if (OXFORD_GROUP_KEYS.includes(src as OxfordGroupKey)) {
        // B2 Ek, Oxford 3000 B2'den ayrıdır: ikisi de CEFR olarak B2'dir ama
        // kaynak grupları farklıdır, karıştırılmamalıdır.
        extraWords
          .filter((w) => oxfordGroupOf(w) === src)
          .forEach((w) => wordSet.add(w));
        allWords
          .filter((w) => oxfordGroupOf(w) === src)
          .forEach((w) => wordSet.add(w));
      } else {
        const colWordIds = memberships
          .filter((m) => m.collectionId === src)
          .map((m) => m.wordId);
        combinedAll.filter((w) => colWordIds.includes(w.id)).forEach((w) => wordSet.add(w));
      }
    });

    // Anlamı henüz doldurulmamış kartlar sınava girmez.
    //
    // Metinden yakalanan kelimeler anlamı boş olarak eklenir; bunlardan soru
    // üretmek boş şıklı ya da cevabı boş bir soru demektir.
    let list = Array.from(wordSet).filter(w => (w.turkishMeaning || '').trim().length > 0);

    if (statusFilter === 'LEARNING') {
      list = list.filter((w) => getUserWordStatus(w.id, learningStates) === 'learning');
    } else if (statusFilter === 'LEARNED') {
      list = list.filter((w) => getUserWordStatus(w.id, learningStates) === 'learned');
    }

    return list;
  }, [selectedSources, statusFilter, allWords, customCards, memberships, learningStates]);

  const startQuiz = () => {
    if (currentPool.length < MIN_POOL_SIZE) {
      setSetupError(
        `Seçtiğin kaynaklarda ${currentPool.length} kelime var. ` +
          `Sınav için en az ${MIN_POOL_SIZE} kelime gerekiyor; başka bir seviye ya da set ekleyebilirsin.`
      );
      return;
    }
    setSetupError(null);

    // Çeldiriciler tüm kelime evreninden seçilir; soru üreticisi önce aynı
    // seviye ve sözcük türündekileri tercih eder.
    const distractorPool = [...allWords, ...customCards];
    const generatedQuestions = generateQuiz(currentPool, distractorPool, quizMode, questionCount);

    setQuestions(generatedQuestions);
    setCurrentQuestionIndex(0);
    setScore(0);
    setUserAnswers([]);
    setSelectedAnswer(null);
    setTypedAnswer('');
    setIsAnswered(false);
    setQuizState('ACTIVE');
  };

  const handleOptionSelect = (option: string) => {
    if (isAnswered) return;
    setSelectedAnswer(option);
    setIsAnswered(true);

    const currentQ = questions[currentQuestionIndex];
    const isCorrect = option === currentQ.correctAnswer;

    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    if (onRecordStudyResult) {
      onRecordStudyResult(currentQ.word.id, isCorrect ? 'good' : 'again', 'quiz');
    }

    setUserAnswers((prev) => [
      ...prev,
      { question: currentQ, selected: option, isCorrect }
    ]);
  };

  const handleWritingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnswered || !typedAnswer.trim()) return;

    const currentQ = questions[currentQuestionIndex];
    const isCorrect =
      normalizeTypedAnswer(typedAnswer) === normalizeTypedAnswer(currentQ.correctAnswer);

    setSelectedAnswer(typedAnswer.trim());
    setIsAnswered(true);

    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    if (onRecordStudyResult) {
      onRecordStudyResult(currentQ.word.id, isCorrect ? 'good' : 'again', 'quiz');
    }

    setUserAnswers((prev) => [
      ...prev,
      { question: currentQ, selected: typedAnswer.trim(), isCorrect }
    ]);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setTypedAnswer('');
      setIsAnswered(false);
    } else {
      setQuizState('FINISHED');
      if (onFinishQuiz) {
        onFinishQuiz({
          sessionId: `quiz-${Date.now()}`,
          date: new Date().toISOString(),
          totalQuestions: questions.length,
          correctCount: score,
          wrongCount: questions.length - score,
          scorePercent: Math.round((score / questions.length) * 100),
          mistakeWords: userAnswers.filter((a) => !a.isCorrect).map((a) => a.question.word.id)
        });
      }
    }
  };

  const currentQ = questions[currentQuestionIndex];

  return (
    <div className="max-w-[760px] mx-auto space-y-6 pb-safe-nav animate-fadeIn">
      {/* 1. Sınav Kurulum Ekranı */}
      {quizState === 'IDLE' && (
        <div className="bg-[#FFFFFF] p-6 sm:p-8 rounded-2xl border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-6">
          <div className="text-center space-y-1.5">
            <div className="w-10 h-10 rounded-xl bg-[#EEECFA] text-[#4F46A5] flex items-center justify-center mx-auto">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1E2430]">
              Sınav Modu
            </h2>
            <p className="text-xs sm:text-sm text-[#687080] max-w-md mx-auto">
              Kelimeleri çoktan seçmeli veya yazarak test et.
            </p>
          </div>

          <div className="space-y-5 pt-1">
            {/* 1. Sınav Türü Seçimi */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#687080] uppercase tracking-wider">
                1. Sınav Türü
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'MIXED', label: 'Karma Sınav', desc: 'Seçmeli + Yazma + Dinleme' },
                  { id: 'MULTIPLE_CHOICE', label: 'Çoktan Seçmeli', desc: '4 şıklı test formatı' },
                  { id: 'WRITING', label: 'Yazma Sınavı', desc: 'İngilizce kelimeyi yaz' },
                  { id: 'LISTENING', label: 'Dinleme Odaklı', desc: 'Sesi dinleyip seç' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setQuizMode(m.id as QuizMode)}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                      quizMode === m.id
                        ? 'bg-[#EEECFA] border-[#4F46A5] text-[#1E2430] font-bold shadow-xs'
                        : 'bg-[#F8F7F3] border-[#E4E1D9] text-[#1E2430] hover:bg-[#F1EFE8]'
                    }`}
                  >
                    <div className="text-xs font-bold">{m.label}</div>
                    <div className="text-[11px] text-[#687080] mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Sınav Kaynakları Seçimi (Çoklu Seçim) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#687080] uppercase tracking-wider">
                  2. Kelime Kaynakları (Birden Fazla Seçilebilir)
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllOxford}
                  className="text-[11px] font-semibold text-[#4F46A5] hover:underline cursor-pointer"
                >
                  Tüm Oxford Seviyelerini Seç
                </button>
              </div>

              {/* Oxford Levels */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[#8E95A2]">Oxford kelimeleri:</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OXFORD_GROUP_KEYS.map((lvl) => {
                    const isSelected = selectedSources.includes(lvl);
                    const count = oxfordGroupCounts[lvl] || 0;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => handleToggleSource(lvl)}
                        className={`p-2.5 rounded-xl text-xs font-semibold transition-all border flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#EEECFA] text-[#4F46A5] border-[#4F46A5] font-bold'
                            : 'bg-[#F8F7F3] text-[#1E2430] border-[#E4E1D9] hover:bg-[#F1EFE8]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-[#4F46A5]" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-[#8E95A2]" />
                          )}
                          <span>{OXFORD_GROUP_LABELS[lvl]}</span>
                        </div>
                        <span className="text-[10px] text-[#8E95A2]">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Sets */}
              {collections.length > 0 && (
                <div className="space-y-1.5 pt-1.5">
                  <div className="text-[11px] font-semibold text-[#8E95A2]">Kelime Setlerim:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {collections.map((col) => {
                      const isSelected = selectedSources.includes(col.id);
                      const count = memberships.filter((m) => m.collectionId === col.id).length;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => handleToggleSource(col.id)}
                          className={`p-2.5 rounded-xl text-xs font-semibold transition-all border flex items-center justify-between truncate cursor-pointer ${
                            isSelected
                              ? 'bg-[#EEECFA] text-[#4F46A5] border-[#4F46A5] font-bold'
                              : 'bg-[#F8F7F3] text-[#1E2430] border-[#E4E1D9] hover:bg-[#F1EFE8]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-[#4F46A5] shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-[#8E95A2] shrink-0" />
                            )}
                            <span className="truncate">{col.name}</span>
                          </div>
                          <span className="text-[10px] text-[#8E95A2] shrink-0 ml-1">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Durum Filtresi */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#687080] uppercase tracking-wider">
                3. Durum Filtresi
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-[#1E2430] text-white border-[#1E2430]'
                      : 'bg-[#F8F7F3] text-[#687080] border-[#E4E1D9] hover:bg-[#F1EFE8]'
                  }`}
                >
                  Tüm Kelimeler
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('LEARNING')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                    statusFilter === 'LEARNING'
                      ? 'bg-[#B97922] text-white border-[#B97922]'
                      : 'bg-[#F8F7F3] text-[#687080] border-[#E4E1D9] hover:bg-[#F1EFE8]'
                  }`}
                >
                  ↻ Tekrar Etmem Gerekenler
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('LEARNED')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                    statusFilter === 'LEARNED'
                      ? 'bg-[#4F806A] text-white border-[#4F806A]'
                      : 'bg-[#F8F7F3] text-[#687080] border-[#E4E1D9] hover:bg-[#F1EFE8]'
                  }`}
                >
                  ✓ Öğrendiklerim (Pekiştirme)
                </button>
              </div>
            </div>

            {/* 4. Soru Sayısı Seçimi */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#687080] uppercase tracking-wider">
                4. Soru Sayısı
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 20, 30, 50, 75, 100].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setQuestionCount(count)}
                    className={`p-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      questionCount === count
                        ? 'bg-[#4F46A5] text-white border-[#4F46A5] shadow-xs'
                        : 'bg-[#F8F7F3] text-[#1E2430] border-[#E4E1D9] hover:bg-[#F1EFE8]'
                    }`}
                  >
                    {count} Soru
                  </button>
                ))}
              </div>
            </div>

            {/* Pool summary badge */}
            <div className="p-3 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9] flex items-center justify-between text-xs">
              <span className="text-[#687080] font-medium">
                Seçilen kriterlere uygun havuz:
              </span>
              <span className="font-bold text-[#4F46A5]">
                {currentPool.length} Kelime
              </span>
            </div>
          </div>

          {/*
            * Havuz seçilen soru sayısından azsa bu bir hata değildir:
            * sınav mevcut kelime sayısıyla hazırlanır (talimat 53).
            */}
          {currentPool.length >= MIN_POOL_SIZE && currentPool.length < questionCount && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-[#FBF1DE] border border-[#E7C98F] text-[#8A5A18] text-xs font-medium leading-relaxed">
              Seçtiğin kaynaklarda {currentPool.length} uygun kelime var. Sınav{' '}
              {currentPool.length} soruyla hazırlanacak.
            </div>
          )}

          {setupError && (
            <div
              role="alert"
              className="mb-3 px-4 py-3 rounded-xl bg-[#FAECEA] border border-[#F0CBC7] text-[#C65D55] text-xs font-medium leading-relaxed"
            >
              {setupError}
            </div>
          )}

          <button
            onClick={startQuiz}
            disabled={currentPool.length < MIN_POOL_SIZE}
            className="w-full py-3.5 bg-[#4F46A5] hover:bg-[#433B91] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#FBF1DE]" />
            <span>Sınavı Başlat ({Math.min(questionCount, currentPool.length)} Soru)</span>
          </button>
        </div>
      )}

      {/* 2. Aktif Soru Ekranı */}
      {quizState === 'ACTIVE' && currentQ && (
        <div className="bg-[#FFFFFF] p-6 sm:p-8 rounded-2xl border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-6">
          {/* Progress Header */}
          <div className="flex items-center justify-between border-b border-[#EFECE6] pb-3.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuizState('IDLE')}
                className="text-xs font-semibold text-[#687080] hover:text-[#1E2430] flex items-center gap-1 cursor-pointer mr-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Çık</span>
              </button>
              <span className="px-2.5 py-1 text-xs font-bold bg-[#EEECFA] text-[#4F46A5] rounded-lg border border-[#D7D2F4]">
                Soru {currentQuestionIndex + 1} / {questions.length}
              </span>
              {!currentQ.word.isCustom && currentQ.word.sourceType !== 'custom' && currentQ.word.level && (
                <CEFRBadge level={currentQ.word.level} size="sm" />
              )}
            </div>

            <div className="text-xs font-bold text-[#4F806A]">
              Doğru: {score}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full bg-[#E4E1D9] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4F46A5] transition-all duration-300 rounded-full"
              style={{
                width: `${Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%`
              }}
            />
          </div>

          {/* Question Prompt */}
          <div className="space-y-4 py-1">
            <div className="bg-[#F8F7F3] p-6 rounded-xl border border-[#E4E1D9] text-center space-y-2">
              {(currentQ.type === 'listening' || currentQ.type === 'multiple-choice-tr') && (
                <button
                  onClick={() => speakText(currentQ.word.word)}
                  className="px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#F1EFE8] text-[#1E2430] font-semibold text-xs rounded-xl border border-[#E4E1D9] transition-transform active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#4F46A5]" />
                  <span>Telaffuzu Dinle</span>
                </button>
              )}

              <h3 className="text-lg sm:text-xl font-bold text-[#1E2430] leading-snug whitespace-pre-line">
                {currentQ.questionText}
              </h3>
            </div>

            {/* If question type is WRITING */}
            {currentQ.type === 'writing' ? (
              <form onSubmit={handleWritingSubmit} className="space-y-3 pt-2">
                <input
                  type="text"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  disabled={isAnswered}
                  placeholder="İngilizce kelimeyi buraya yaz..."
                  autoFocus
                  className="w-full p-4 text-base bg-[#F8F7F3] border-2 border-[#E4E1D9] focus:bg-[#FFFFFF] focus:border-[#4F46A5] rounded-xl focus:outline-none font-bold text-[#1E2430] text-center"
                />

                {!isAnswered && (
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#4F46A5] hover:bg-[#433B91] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Cevabı Kontrol Et
                  </button>
                )}
              </form>
            ) : (
              /* If question is MULTIPLE CHOICE / LISTENING / FILL-BLANK */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {currentQ.options.map((opt, idx) => {
                  let btnStyle =
                    'bg-[#FFFFFF] border-[#E4E1D9] text-[#1E2430] hover:bg-[#EEECFA] hover:border-[#D7D2F4]';

                  if (isAnswered) {
                    if (opt === currentQ.correctAnswer) {
                      btnStyle = 'bg-[#E9F3ED] text-[#35654E] border-[#BFD7C8] font-bold shadow-xs';
                    } else if (opt === selectedAnswer) {
                      btnStyle = 'bg-[#FAECEA] text-[#C65D55] border-[#F0CBC7] font-bold shadow-xs';
                    } else {
                      btnStyle = 'bg-[#F8F7F3] text-[#8E95A2] border-[#E4E1D9] opacity-60';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={isAnswered}
                      onClick={() => handleOptionSelect(opt)}
                      className={`min-h-[48px] p-3.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {isAnswered && opt === currentQ.correctAnswer && (
                        <CheckCircle2 className="w-4 h-4 text-[#4F806A] shrink-0" />
                      )}
                      {isAnswered && opt === selectedAnswer && opt !== currentQ.correctAnswer && (
                        <XCircle className="w-4 h-4 text-[#C65D55] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Answer Feedback & Next Button */}
          {isAnswered && (
            <div className="pt-3.5 border-t border-[#EFECE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs">
                {selectedAnswer?.toLowerCase() === currentQ.correctAnswer.toLowerCase() ? (
                  <span className="text-[#4F806A] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Doğru cevap!
                  </span>
                ) : (
                  <span className="text-[#C65D55] font-bold flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> Doğru Cevap:{' '}
                    <strong className="text-[#1E2430] ml-1">{currentQ.correctAnswer}</strong>
                  </span>
                )}
              </div>

              <button
                onClick={handleNextQuestion}
                className="px-5 py-2.5 bg-[#4F46A5] hover:bg-[#433B91] text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>
                  {currentQuestionIndex < questions.length - 1 ? 'Sonraki Soru' : 'Sınavı Bitir'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Sınav Sonuç ve Durum Güncelleme Ekranı */}
      {quizState === 'FINISHED' && (
        <div className="bg-[#FFFFFF] p-6 sm:p-8 rounded-2xl border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-6">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-xl bg-[#E9F3ED] text-[#4F806A] flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            {score / questions.length >= 0.7 ? (
              <div className="space-y-1">
                <div className="text-base font-bold text-[#4F46A5]">
                  {BRAND.slogan}
                </div>
                <h2 className="text-2xl font-bold text-[#1E2430]">
                  Sınav Başarıyla Tamamlandı
                </h2>
              </div>
            ) : (
              <h2 className="text-2xl font-bold text-[#1E2430]">
                Sınav Tamamlandı
              </h2>
            )}
            <p className="text-xs text-[#687080]">
              {questions.length} soruda {score} Doğru · {questions.length - score} Yanlış
            </p>
          </div>

          {/* Score Summary Badges */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto py-1">
            <div className="p-3.5 bg-[#E9F3ED] rounded-xl border border-[#BFD7C8] text-center">
              <span className="text-xl font-bold text-[#35654E]">{score}</span>
              <p className="text-[10px] text-[#35654E] font-bold uppercase mt-0.5">Doğru</p>
            </div>
            <div className="p-3.5 bg-[#FAECEA] rounded-xl border border-[#F0CBC7] text-center">
              <span className="text-xl font-bold text-[#C65D55]">
                {questions.length - score}
              </span>
              <p className="text-[10px] text-[#C65D55] font-bold uppercase mt-0.5">Yanlış</p>
            </div>
            <div className="p-3.5 bg-[#EEECFA] rounded-xl border border-[#D7D2F4] text-center">
              <span className="text-xl font-bold text-[#4F46A5]">
                %{Math.round((score / questions.length) * 100)}
              </span>
              <p className="text-[10px] text-[#4F46A5] font-bold uppercase mt-0.5">Başarı</p>
            </div>
          </div>

          {/* Sınavda Çıkan Kelimeler ve Hızlı Durum Güncelleme */}
          <div className="space-y-2.5 pt-3 border-t border-[#EFECE6]">
            <h4 className="text-xs font-bold text-[#687080] uppercase tracking-wider">
              Sınav Kelimeleri & Durumları
            </h4>
            <div className="divide-y divide-[#EFECE6] border border-[#E4E1D9] rounded-xl overflow-hidden">
              {userAnswers.map(({ question, isCorrect }) => {
                const card = question.word;
                const status = getUserWordStatus(card.id, learningStates);
                const isCustom = card.isCustom || card.sourceType === 'custom';

                return (
                  <div
                    key={card.id}
                    className="p-3 bg-[#FFFFFF] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          isCorrect ? 'bg-[#E9F3ED] text-[#4F806A]' : 'bg-[#FAECEA] text-[#C65D55]'
                        }`}
                      >
                        {isCorrect ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#1E2430]">{card.word}</span>
                          <span className="text-[10px] text-[#8E95A2]">
                            {card.partOfSpeech || 'n.'}
                          </span>
                          {!isCustom && card.level && (
                            <CEFRBadge level={card.level} size="sm" />
                          )}
                        </div>
                        <p className="text-xs text-[#687080]">{card.turkishMeaning}</p>
                      </div>
                    </div>

                    {/* Quick status toggle buttons */}
                    {onSetWordStatus && (
                      <LearningStatusControl
                        status={status}
                        onSetStatus={(newStatus) => onSetWordStatus(card.id, newStatus)}
                        size="sm"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-3 border-t border-[#EFECE6]">
            <button
              onClick={startQuiz}
              className="px-5 py-2.5 bg-[#4F46A5] hover:bg-[#433B91] text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Yeniden Sına</span>
            </button>
            <button
              onClick={() => setQuizState('IDLE')}
              className="px-5 py-2.5 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-[#1E2430] font-semibold text-xs rounded-xl border border-[#E4E1D9] transition-all cursor-pointer"
            >
              Sınav Ayarlarına Dön
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
