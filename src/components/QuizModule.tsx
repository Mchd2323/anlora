import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  ArrowLeft, RotateCw } from 'lucide-react';
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
/*
 * 'B2_EK' listeden çıkarıldı: ek listenin B2'si de B2'dir, ayrı bir seviye
 * değil. Sınav kaynağı olarak iki ayrı satır göstermek kullanıcıya olmayan
 * bir ayrım öğretiyordu.
 */
const OXFORD_GROUP_KEYS: OxfordGroupKey[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

const OXFORD_GROUP_LABELS: Partial<Record<OxfordGroupKey, string>> = {
  A1: 'Oxford A1',
  A2: 'Oxford A2',
  B1: 'Oxford B1',
  B2: 'Oxford B2',
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
  if (id.startsWith('ox5k-')) return card.level === 'C1' ? 'C1' : 'B2';
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
  /**
   * Toplu işaretleme için tek yazmalık yol.
   *
   * Sonuç ekranındaki iki düğme kelime başına `onSetWordStatus` çağırıyordu;
   * her çağrı bütün öğrenme durumu yığınını yeniden ayrıştırıp yazdığı için
   * yirmi soruluk bir sınavda arayüz saniyelerce donuyor, kullanıcı düğme
   * çalışmadı sanıp tekrar basıyordu.
   */
  onSetWordStatuses?: (ids: string[], status: 'learned' | 'learning' | 'unseen') => void;
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
  onSetWordStatus,
  onSetWordStatuses
}) => {
  const [quizState, setQuizState] = useState<'IDLE' | 'ACTIVE' | 'FINISHED'>('IDLE');
  /** Toplu işaretlemenin sonucu; sessizce yapılan bir işlem yapılmamış gibidir. */
  const [topluSonuc, setTopluSonuc] = useState('');
  /*
   * Toplu işaretleme kelime başına tüm öğrenme durumlarını yeniden yazıyor;
   * yüz soruluk bir sınavda arayüz saniyelerce donuyor. Donma sırasında
   * kullanıcı düğmeye tekrar basıyor ve aynı iş bir kez daha yapılıyordu —
   * hem bekleme ikiye katlanıyor hem de 500 kayıtlık tekrar geçmişi boşuna
   * doluyordu. Uygulanan düğme bir daha basılamasın.
   */
  const [dogrularIsaretlendi, setDogrularIsaretlendi] = useState(false);
  const [yanlislarIsaretlendi, setYanlislarIsaretlendi] = useState(false);

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
  /*
   * KAYNAK SEÇİMİ ZORUNLU DEĞİL.
   *
   * Son kaynağın kaldırılması engelleniyordu: kullanıcı hepsini kapatmak
   * isteyince düğme tıklanıyor ama hiçbir şey olmuyordu. Sessizce yok
   * sayılan bir dokunuş, uygulamanın bozuk olduğunu düşündürür.
   *
   * Artık hepsi kapatılabiliyor; sınavı başlatmak isteyen kullanıcıya
   * "en az bir kaynak seç" deniyor. Kural aynı kalıyor ama kullanıcı onu
   * ihlal ettiği anda ve sebebiyle birlikte öğreniyor.
   */
  const handleToggleSource = (sourceKey: string) => {
    setSetupError('');
    setSelectedSources((prev) =>
      prev.includes(sourceKey)
        ? prev.filter((s) => s !== sourceKey)
        : [...prev, sourceKey]
    );
  };

  const handleSelectAllOxford = () => {
    setSelectedSources(['A1', 'A2', 'B1', 'B2', 'C1']);
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
    /*
     * EK LİSTE HAVUZA GİRİYOR.
     *
     * Burada yalnızca Oxford 3000 ve kullanıcının kartları birleşiyordu; ek
     * listenin 2.015 kelimesi (B2 Ek ve C1) sınava hiç girmiyordu. Kullanıcı
     * bir setine C1 kelime eklemiş olsa bile o kelime sorulmuyor, üstelik
     * "yeterli kelime yok" uyarısı da eksik sayı üzerinden veriliyordu.
     */
    const combinedAll = [...allWords, ...extraWords, ...customCards];
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
  }, [selectedSources, statusFilter, allWords, extraWords, customCards, memberships, learningStates]);

  const startQuiz = () => {
    if (currentPool.length < MIN_POOL_SIZE) {
      /*
       * HAVUZ YETERSİZKEN SEBEBİ SÖYLE, SESSİZCE DÖNME.
       *
       * Aşağıdaki uyarı yalnızca kurulum (IDLE) ekranında çiziliyor. Sonuç
       * ekranındaki "Yeniden Sına" buraya düştüğünde ekran FINISHED'de
       * kalıyor, hiçbir metin belirmiyor ve düğme ölü görünüyordu — üstelik
       * havuzun sınav sonrasında küçülmesi olağan bir yol: "Tekrar Etmem
       * Gerekenler" süzgecindeyken doğruları "öğrendim" işaretlemek onları
       * havuzdan düşürüyor. Uyarının görünebildiği ekrana dönüyoruz ki
       * kullanıcı sorunu düzeltebileceği yerde olsun.
       */
      setQuizState('IDLE');
      setSetupError(
        `Seçtiğin kaynaklarda ${currentPool.length} kelime var. ` +
          `Sınav için en az ${MIN_POOL_SIZE} kelime gerekiyor; başka bir seviye ya da set ekleyebilirsin.`
      );
      return;
    }
    setSetupError(null);

    // Çeldiriciler tüm kelime evreninden seçilir; soru üreticisi önce aynı
    // seviye ve sözcük türündekileri tercih eder.
    // Çeldiriciler de aynı havuzdan; aksi hâlde C1 sorusunun şıkları
    // yalnızca A1–B2'den gelir ve doğru cevap tek başına sırıtır.
    const distractorPool = [...allWords, ...extraWords, ...customCards];
    const generatedQuestions = generateQuiz(currentPool, distractorPool, quizMode, questionCount);

    setQuestions(generatedQuestions);
    setCurrentQuestionIndex(0);
    setScore(0);
    setUserAnswers([]);
    setSelectedAnswer(null);
    setTypedAnswer('');
    setIsAnswered(false);
    // Yeni sınav: önceki turun toplu işaretleme bildirimi kalmasın.
    setTopluSonuc('');
    setDogrularIsaretlendi(false);
    setYanlislarIsaretlendi(false);
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

  /**
   * Sınavı bitirir ve CEVAPLANAN soruların özetini kaydeder.
   *
   * Özet daha önce yalnızca son sorunun cevaplanmasıyla gönderiliyordu.
   * Yarıda kesilen sınavda cevaplar SRS'e zaten yazılmış oluyor
   * (onRecordStudyResult), ama oturum hiç kaydedilmediği için ne sınav
   * sayacı ne de hata listesi ("tekrar listem") o cevapları görüyordu:
   * kullanıcı 60 soru çözüp hiçbirini kazanamıyordu. Artık çıkış yolu da
   * buradan geçiyor.
   */
  const sinaviBitir = (cevaplanan: number) => {
    setQuizState('FINISHED');
    if (!onFinishQuiz || cevaplanan === 0) return;
    onFinishQuiz({
      sessionId: `quiz-${Date.now()}`,
      date: new Date().toISOString(),
      totalQuestions: cevaplanan,
      correctCount: score,
      wrongCount: cevaplanan - score,
      scorePercent: Math.round((score / cevaplanan) * 100),
      mistakeWords: userAnswers.filter((a) => !a.isCorrect).map((a) => a.question.word.id)
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setTypedAnswer('');
      setIsAnswered(false);
    } else {
      sinaviBitir(questions.length);
    }
  };

  const currentQ = questions[currentQuestionIndex];
  /** Sonuç ekranındaki sayılar cevaplanan soruya bakar; sınav yarıda da bitebilir. */
  const cevaplananSayisi = userAnswers.length;

  /*
   * Cevap verilince şıklar kilitleniyor ve odaktaki öğe devre dışı kalıyordu;
   * odak gövdeye düşünce TalkBack/klavye kullanıcısı bulunduğu yeri kaybedip
   * "Sonraki Soru"ya ulaşmak için sayfayı baştan geziyordu. Odağı doğrudan
   * oraya taşıyoruz.
   */
  const sonrakiSoruRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isAnswered) sonrakiSoruRef.current?.focus();
  }, [isAnswered]);

  return (
    <div className="max-w-[760px] mx-auto space-y-6 pb-safe-nav animate-fadeIn">
      {/*
        1. Sınav Kurulum Ekranı.

        SAHNE ŞERİDİ KALDIRILDI. Buradaki ejderha şeridi ana sayfanın üçüncü
        tanıtım kartındakiyle aynı sahneydi; Ana Sayfa'dan Sınav'a geçen
        kullanıcı aynı görseli arka arkaya iki kez görüyordu.
      */}
      {quizState === 'IDLE' && (
        <div className="parsomen-panel bg-[var(--surface)] p-6 sm:p-8 rounded-2xl border border-[var(--border)] space-y-6">
          <div className="text-center space-y-1.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center mx-auto">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h2 className="baslik-yazit text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Sınav Modu
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              İstediğin kaynaktan, istediğin sınav türünde ve soru sayısında kendini
              dene; yanlış bildiklerin tekrar listene düşer.
            </p>
          </div>

          <div className="space-y-5 pt-1">
            {/* 1. Sınav Türü Seçimi */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--text-secondary)]  tracking-wider">
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
                        ? 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--text-primary)] font-bold shadow-xs'
                        : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
                    }`}
                  >
                    <div className="text-xs font-bold">{m.label}</div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Sınav Kaynakları Seçimi (Çoklu Seçim) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[var(--text-secondary)]  tracking-wider">
                  2. Kelime Kaynakları (Birden Fazla Seçilebilir)
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllOxford}
                  className="text-[11px] font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                >
                  Tüm Oxford Seviyelerini Seç
                </button>
              </div>

              {/* Oxford Levels */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[var(--text-muted)]">Oxford kelimeleri:</div>
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
                            ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)] font-bold'
                            : 'bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-[var(--primary)]" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          )}
                          <span>{OXFORD_GROUP_LABELS[lvl]}</span>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)]">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Sets */}
              {collections.length > 0 && (
                <div className="space-y-1.5 pt-1.5">
                  <div className="text-[11px] font-semibold text-[var(--text-muted)]">Kelime Setlerim:</div>
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
                              ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)] font-bold'
                              : 'bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                            )}
                            <span className="truncate">{col.name}</span>
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-1">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Durum Filtresi */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--text-secondary)]  tracking-wider">
                3. Durum Filtresi
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-[var(--text-primary)] text-[var(--bg)] border-[var(--text-primary)]'
                      : 'bg-[var(--bg)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
                  }`}
                >
                  Tüm Kelimeler
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('LEARNING')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                    statusFilter === 'LEARNING'
                      ? 'bg-[var(--learning)] text-[var(--surface)] border-[var(--learning)]'
                      : 'bg-[var(--bg)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
                  }`}
                >
                  ↻ Tekrar Etmem Gerekenler
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('LEARNED')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                    statusFilter === 'LEARNED'
                      ? 'bg-[var(--learned)] text-[var(--surface)] border-[var(--learned)]'
                      : 'bg-[var(--bg)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
                  }`}
                >
                  ✓ Öğrendiklerim (Pekiştirme)
                </button>
              </div>
            </div>

            {/* 4. Soru Sayısı Seçimi */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--text-secondary)]  tracking-wider">
                4. Soru Sayısı
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20, 30, 50, 75, 100].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setQuestionCount(count)}
                    className={`dugme-birincil p-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      questionCount === count
                        ? 'bg-[var(--primary)] text-[var(--surface)] border-[var(--primary)] shadow-xs'
                        : 'bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
                    }`}
                  >
                    {count} Soru
                  </button>
                ))}
              </div>
            </div>

            {/* Pool summary badge */}
            <div className="p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)] flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)] font-medium">
                Seçilen kriterlere uygun havuz:
              </span>
              <span className="font-bold text-[var(--primary)]">
                {currentPool.length} Kelime
              </span>
            </div>
          </div>

          {/*
            * Havuz seçilen soru sayısından azsa bu bir hata değildir:
            * sınav mevcut kelime sayısıyla hazırlanır (talimat 53).
            */}
          {currentPool.length >= MIN_POOL_SIZE && currentPool.length < questionCount && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-[var(--learning-soft)] border border-[var(--learning-border)] text-[var(--learning-text)] text-xs font-medium leading-relaxed">
              Seçtiğin kaynaklarda {currentPool.length} uygun kelime var. Sınav{' '}
              {currentPool.length} soruyla hazırlanacak.
            </div>
          )}

          {setupError && (
            <div
              role="alert"
              className="mb-3 px-4 py-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger-border)] text-[var(--danger)] text-xs font-medium leading-relaxed"
            >
              {setupError}
            </div>
          )}

          {/*
            Düğme boş seçimde KİLİTLENMİYOR, uyarı veriyor. Kilitli bir düğme
            neden kilitli olduğunu söylemez; kullanıcı dokunup sebebi
            öğrenebilmeli.

            Aynı ilke havuz yetersizken de geçerli olmalıydı: düğme
            `currentPool.length < MIN_POOL_SIZE` iken kilitleniyordu, bu yüzden
            startQuiz'in "en az 4 kelime gerekiyor" uyarısına hiç
            ulaşılamıyordu. Kullanıcı yalnızca "2 Kelime" rozetini ve solgun,
            dokununca hiçbir şey yapmayan bir düğmeyi görüyordu. Kilit
            kaldırıldı; sayı yetersizse sebebini yukarıdaki uyarı kutusu
            söylüyor (startQuiz zaten sınavı başlatmıyor).
          */}
          <button
            onClick={() => {
              if (selectedSources.length === 0) {
                setSetupError('Sınava başlamak için en az bir kelime kaynağı seç.');
                return;
              }
              startQuiz();
            }}
            className="dugme-birincil w-full py-3.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.98] text-[var(--surface)] font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[var(--learning-soft)]" />
            {/* Havuz yetersizken soru sayısı yazmak olmayan bir sınavı vaat eder. */}
            <span>
              {currentPool.length < MIN_POOL_SIZE
                ? 'Sınavı Başlat'
                : `Sınavı Başlat (${Math.min(questionCount, currentPool.length)} Soru)`}
            </span>
          </button>
        </div>
      )}

      {/* 2. Aktif Soru Ekranı */}
      {quizState === 'ACTIVE' && currentQ && (
        <div className="parsomen-panel bg-[var(--surface)] p-6 sm:p-8 rounded-2xl border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-6">
          {/* Progress Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-3.5">
            <div className="flex items-center gap-2">
              {/*
                ÇIKIŞ ONAYSIZ VE ÖZETSİZDİ.

                Bu düğme yalnızca durumu IDLE'a çeviriyordu: 60. sorudaki bir
                kullanıcı yanlışlıkla dokunduğunda tüm sınav uyarısız siliniyor,
                geri dönüş yolu kalmıyordu. Üstelik verilen cevaplar SRS'e
                yazılmış olmasına rağmen oturum hiç kaydedilmediği için ne sınav
                sayacına ne de tekrar listesine giriyordu. Artık önce onay
                isteniyor, onaylanırsa cevaplanan sorular sonuç ekranına ve
                kayda geçiyor.
              */}
              <button
                onClick={() => {
                  if (userAnswers.length === 0) {
                    setQuizState('IDLE');
                    return;
                  }
                  const onay = confirm(
                    `${userAnswers.length} soruyu cevapladın. Sınavı burada bitirip sonucunu kaydedelim mi?`
                  );
                  if (!onay) return;
                  sinaviBitir(userAnswers.length);
                }}
                className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer mr-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Çık</span>
              </button>
              <span className="px-2.5 py-1 text-xs font-bold bg-[var(--primary-soft)] text-[var(--primary)] rounded-lg border border-[var(--primary-border)]">
                Soru {currentQuestionIndex + 1} / {questions.length}
              </span>
              {!currentQ.word.isCustom && currentQ.word.sourceType !== 'custom' && currentQ.word.level && (
                <CEFRBadge level={currentQ.word.level} size="sm" />
              )}
            </div>

            <div className="text-xs font-bold text-[var(--learned)]">
              Doğru: {score}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-300 rounded-full"
              style={{
                width: `${Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%`
              }}
            />
          </div>

          {/* Question Prompt */}
          <div className="space-y-4 py-1">
            <div className="bg-[var(--bg)] p-6 rounded-xl border border-[var(--border)] text-center space-y-2">
              {(currentQ.type === 'listening' || currentQ.type === 'multiple-choice-tr') && (
                <button
                  type="button"
              onClick={() => speakText(currentQ.word.word)}
                  className="px-3 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] font-semibold text-xs rounded-xl border border-[var(--border)] transition-transform active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Telaffuzu Dinle</span>
                </button>
              )}

              <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] leading-snug whitespace-pre-line">
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
                  className="w-full p-4 text-base bg-[var(--bg)] border-2 border-[var(--border)] focus:bg-[var(--surface)] focus:border-[var(--primary)] rounded-xl focus:outline-none font-bold text-[var(--text-primary)] text-center"
                />

                {!isAnswered && (
                  <button
                    type="submit"
                    className="dugme-birincil w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--surface)] font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
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
                    'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary-border)]';

                  if (isAnswered) {
                    if (opt === currentQ.correctAnswer) {
                      btnStyle = 'bg-[var(--learned-soft)] text-[var(--learned-text)] border-[var(--learned-border)] font-bold shadow-xs';
                    } else if (opt === selectedAnswer) {
                      btnStyle = 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger-border)] font-bold shadow-xs';
                    } else {
                      btnStyle = 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)] opacity-60';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      /*
                        Cevaptan sonra `disabled` veriliyordu; odaktaki şık
                        devre dışı kalınca odak gövdeye düşüyor ve ekran
                        okuyucu kullanıcısı sınavın neresinde olduğunu
                        kaybediyordu. aria-disabled ile şıklar gezilebilir
                        kalıyor (hangisinin doğru işaretlendiği okunabiliyor);
                        ikinci cevabı handleOptionSelect'teki mevcut
                        `if (isAnswered) return;` koruması engelliyor.
                      */
                      aria-disabled={isAnswered}
                      onClick={() => handleOptionSelect(opt)}
                      className={`min-h-[48px] p-3.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {isAnswered && opt === currentQ.correctAnswer && (
                        <CheckCircle2 className="w-4 h-4 text-[var(--learned)] shrink-0" />
                      )}
                      {isAnswered && opt === selectedAnswer && opt !== currentQ.correctAnswer && (
                        <XCircle className="w-4 h-4 text-[var(--danger)] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Answer Feedback & Next Button */}
          {/*
            GERİ BİLDİRİM EKRAN OKUYUCUYA HİÇ ULAŞMIYORDU.

            Blok yalnızca cevaptan sonra DOM'a giriyor ve canlı bölge değildi:
            TalkBack kullanıcısı ne "Doğru cevap!" diyebiliyor ne de doğru
            cevabın ne olduğunu öğrenebiliyordu — dokunduğu şıkkın tutup
            tutmadığını bilmeden sınava devam ediyordu. Bölgeyi cevaptan ÖNCE
            de (boş olarak) DOM'da tutuyoruz ki içerik girdiğinde duyurulsun;
            boşken kapsayıcının satır aralığını kaplamaması için üst boşluğu
            sıfırlanıyor.
          */}
          <div
            className={
              isAnswered
                ? 'pt-3.5 border-t border-[var(--border-light)] flex flex-col sm:flex-row sm:items-center justify-between gap-3'
                : ''
            }
            style={isAnswered ? undefined : { marginTop: 0 }}
          >
            <div className="text-xs" role="status" aria-live="polite">
              {isAnswered &&
                (selectedAnswer?.toLowerCase() === currentQ.correctAnswer.toLowerCase() ? (
                  <span className="text-[var(--learned)] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Doğru cevap!
                  </span>
                ) : (
                  <span className="text-[var(--danger)] font-bold flex items-center gap-1">
                    <XCircle className="w-4 h-4" aria-hidden="true" /> Yanlış. Doğru cevap:{' '}
                    <strong className="text-[var(--text-primary)] ml-1">{currentQ.correctAnswer}</strong>
                  </span>
                ))}
            </div>

            {isAnswered && (
              <button
                ref={sonrakiSoruRef}
                onClick={handleNextQuestion}
                className="dugme-birincil px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--surface)] font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>
                  {currentQuestionIndex < questions.length - 1 ? 'Sonraki Soru' : 'Sınavı Bitir'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Sınav Sonuç ve Durum Güncelleme Ekranı */}
      {quizState === 'FINISHED' && (
        <div className="parsomen-panel bg-[var(--surface)] p-6 sm:p-8 rounded-2xl border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-6">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-xl bg-[var(--learned-soft)] text-[var(--learned)] flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            {cevaplananSayisi > 0 && score / cevaplananSayisi >= 0.7 ? (
              <div className="space-y-1">
                <div className="text-base font-bold text-[var(--primary)]">
                  {BRAND.slogan}
                </div>
                <h2 className="baslik-yazit text-2xl font-bold text-[var(--text-primary)]">
                  Sınav Başarıyla Tamamlandı
                </h2>
              </div>
            ) : (
              <h2 className="baslik-yazit text-2xl font-bold text-[var(--text-primary)]">
                Sınav Tamamlandı
              </h2>
            )}
            <p className="text-xs text-[var(--text-secondary)]">
              {cevaplananSayisi} soruda {score} Doğru · {cevaplananSayisi - score} Yanlış
            </p>
          </div>

          {/* Score Summary Badges */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto py-1">
            <div className="p-3.5 bg-[var(--learned-soft)] rounded-xl border border-[var(--learned-border)] text-center">
              <span className="text-xl font-bold text-[var(--learned-text)]">{score}</span>
              <p className="text-[10px] text-[var(--learned-text)] font-bold  mt-0.5">Doğru</p>
            </div>
            <div className="p-3.5 bg-[var(--danger-soft)] rounded-xl border border-[var(--danger-border)] text-center">
              <span className="text-xl font-bold text-[var(--danger)]">
                {cevaplananSayisi - score}
              </span>
              <p className="text-[10px] text-[var(--danger)] font-bold  mt-0.5">Yanlış</p>
            </div>
            <div className="p-3.5 bg-[var(--primary-soft)] rounded-xl border border-[var(--primary-border)] text-center">
              <span className="text-xl font-bold text-[var(--primary)]">
                %{cevaplananSayisi > 0 ? Math.round((score / cevaplananSayisi) * 100) : 0}
              </span>
              <p className="text-[10px] text-[var(--primary)] font-bold  mt-0.5">Başarı</p>
            </div>
          </div>

          {/*
            TOPLU İŞARETLEME.

            Durum yalnızca kelime kelime değiştirilebiliyordu; yüz soruluk bir
            sınavın sonunda doğru bildiklerini tek tek işaretlemek zahmetten
            başka bir şey değil ve kullanıcı bunu yapmıyor — yani ilerleme
            kaydı olduğundan geride kalıyor.

            İki düğme sınavın zaten bildiği şeyi kullanıyor: hangi soruya
            doğru, hangisine yanlış cevap verildiği. Bir kez dokunmak yeterli.
          */}
          {onSetWordStatus && userAnswers.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--border-light)]">
              {score > 0 && (
                <button
                  type="button"
                  disabled={dogrularIsaretlendi}
                  onClick={() => {
                    const dogruIdler = userAnswers
                      .filter(a => a.isCorrect)
                      .map(a => a.question.word.id);
                    // Tek yazma; yoksa her kelime için bütün yığın yeniden yazılıyordu.
                    if (onSetWordStatuses) onSetWordStatuses(dogruIdler, 'learned');
                    else dogruIdler.forEach(id => onSetWordStatus(id, 'learned'));
                    setDogrularIsaretlendi(true);
                    setTopluSonuc(`${score} kelime "öğrendim" olarak işaretlendi.`);
                  }}
                  className="flex-1 min-w-[150px] px-3.5 py-2.5 rounded-xl bg-[var(--learned-soft)] hover:bg-[var(--learned-soft-strong)] text-[var(--learned-text)] border border-[var(--learned-border)] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  Doğruları öğrendim ({score})
                </button>
              )}

              {cevaplananSayisi - score > 0 && (
                <button
                  type="button"
                  disabled={yanlislarIsaretlendi}
                  onClick={() => {
                    const yanlisIdler = userAnswers
                      .filter(a => !a.isCorrect)
                      .map(a => a.question.word.id);
                    if (onSetWordStatuses) onSetWordStatuses(yanlisIdler, 'learning');
                    else yanlisIdler.forEach(id => onSetWordStatus(id, 'learning'));
                    setYanlislarIsaretlendi(true);
                    setTopluSonuc(
                      `${cevaplananSayisi - score} kelime tekrar listene eklendi.`
                    );
                  }}
                  className="flex-1 min-w-[150px] px-3.5 py-2.5 rounded-xl bg-[var(--learning-soft)] hover:bg-[var(--learning-soft-hover)] text-[var(--learning-text)] border border-[var(--learning-border)] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <RotateCw className="w-3.5 h-3.5 stroke-[3]" />
                  Yanlışları tekrar et ({cevaplananSayisi - score})
                </button>
              )}
            </div>
          )}

          {topluSonuc && (
            <p
              role="status"
              className="text-xs font-semibold text-[var(--learned-text)] text-center"
            >
              {topluSonuc}
            </p>
          )}

          {/* Sınavda Çıkan Kelimeler ve Hızlı Durum Güncelleme */}
          <div className="space-y-2.5 pt-3 border-t border-[var(--border-light)]">
            <h4 className="text-xs font-bold text-[var(--text-secondary)]  tracking-wider">
              Sınav Kelimeleri & Durumları
            </h4>
            <div className="divide-y divide-[var(--border-light)] border border-[var(--border)] rounded-xl overflow-hidden">
              {userAnswers.map(({ question, isCorrect }) => {
                const card = question.word;
                const status = getUserWordStatus(card.id, learningStates);
                const isCustom = card.isCustom || card.sourceType === 'custom';

                return (
                  <div
                    key={card.id}
                    className="p-3 bg-[var(--surface)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          isCorrect ? 'bg-[var(--learned-soft)] text-[var(--learned)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]'
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
                          <span className="font-bold text-xs text-[var(--text-primary)]">{card.word}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {card.partOfSpeech || 'n.'}
                          </span>
                          {!isCustom && card.level && (
                            <CEFRBadge level={card.level} size="sm" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">{card.turkishMeaning}</p>
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
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-3 border-t border-[var(--border-light)]">
            <button
              onClick={startQuiz}
              className="dugme-birincil px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--surface)] font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Yeniden Sına</span>
            </button>
            <button
              onClick={() => setQuizState('IDLE')}
              className="px-5 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] font-semibold text-xs rounded-xl border border-[var(--border)] transition-all cursor-pointer"
            >
              Sınav Ayarlarına Dön
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
