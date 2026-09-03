import React, { useState, useEffect, useMemo } from 'react';
import {
  WordCard,
  LearningState,
  Collection,
  CollectionMembership,
  ResponseQuality,
  UserSettings,
  StudySessionSummary
} from '../types';
import {
  Brain,
  RotateCcw,
  Check,
  RotateCw,
  Volume2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Zap,
  HelpCircle,
  Layers,
  ChevronRight,
  Flame,
  Award
} from 'lucide-react';
import { sample } from '../utils/random';
import { PronounceButtons } from './ui/PronounceButtons';
import { speakText } from '../utils/speech';
import { checkTypedAnswerCorrectness, normalizeWordString } from '../utils/lemmatizer';
import { isReviewDue, isNewWord } from '../utils/srsEngine';
import { blankOutWord } from '../utils/quizGenerator';
import { oxfordCoreRepository } from '../services/oxfordCoreRepository';
import { CEFRBadge } from './ui/CEFRBadge';
import { shouldShowCefr } from '../types/oxford';
import { readJSON, writeJSON } from '../utils/safeStorage';

/** Son seçilen çalışma modu; oturum bunu hatırlar. */
const SON_MOD_ANAHTARI = 'anlora.sonCalismaModu.v1';

interface StudySessionViewProps {
  initialCollectionId?: string;
  collections: Collection[];
  memberships: CollectionMembership[];
  customWords: WordCard[];
  oxfordWords: WordCard[];
  /**
   * Oxford 5000'i tamamlayan ek liste (B2 Ek + C1, 2.015 kelime).
   *
   * Bu liste seansa hiç girmiyordu: ana sayfa onları "tekrar bekliyor" diye
   * sayarken çalışma ekranı hiçbirini gösteremiyordu — sayaçla ekran
   * birbirini tutmuyordu.
   */
  extraWords?: WordCard[];
  learningStates: Record<string, LearningState>;
  /** Kullanıcı ayarları: yazım toleransı, tercih edilen mod, otomatik ses. */
  settings?: UserSettings;
  onRecordStudyResult: (
    wordId: string,
    quality: ResponseQuality,
    mode: 'flashcard' | 'typed' | 'listening' | 'cloze',
    collectionId?: string
  ) => void;
  onFinishSession: (summary: StudySessionSummary) => void;
  onExitSession: () => void;
}

interface SessionQueueItem {
  card: WordCard;
  state?: LearningState;
  collectionName?: string;
  sourceContext?: string;
  attemptCount: number;
}

export const StudySessionView: React.FC<StudySessionViewProps> = ({
  initialCollectionId,
  collections,
  memberships,
  customWords,
  oxfordWords,
  extraWords = [],
  learningStates,
  settings,
  onRecordStudyResult,
  onFinishSession,
  onExitSession
}) => {
  // Session Configuration State
  const [selectedSource, setSelectedSource] = useState<string>(initialCollectionId || 'DUE_TODAY');
  /*
   * OTURUM SON KULLANILAN MODU HATIRLAR.
   *
   * Ayarlarda 'tercih edilen çalışma modu' diye bir bölüm vardı; kullanıcıya
   * açıklanması gereken, ama yalnızca bir dokunuş kazandıran bir ayardı.
   * Kaldırıldı — yerine oturum, kullanıcının en son hangi modu seçtiğini
   * hatırlıyor. Aynı fayda, sorulacak soru yok.
   */
  const [studyMode, setStudyMode] = useState<'mixed' | 'flashcard' | 'typed' | 'listening' | 'cloze'>(
    () => readJSON<'mixed' | 'flashcard' | 'typed' | 'listening' | 'cloze'>(
      SON_MOD_ANAHTARI,
      settings?.preferredStudyMode || 'mixed'
    )
  );

  useEffect(() => {
    writeJSON(SON_MOD_ANAHTARI, studyMode);
  }, [studyMode]);
  const [isSessionStarted, setIsSessionStarted] = useState(false);

  // Active Session Queue
  const [queue, setQueue] = useState<SessionQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [typedResult, setTypedResult] = useState<{ isCorrect: boolean; isTypo: boolean } | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);

  // Session Statistics tracking
  const [reviewedCount, setReviewedCount] = useState(0);
  const [mistakeWordIds, setMistakeWordIds] = useState<Set<string>>(new Set());
  const [upgradedCount, setUpgradedCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Map of all available words
  const allWordsMap = useMemo(() => {
    const map = new Map<string, WordCard>();
    customWords.forEach(w => map.set(w.id, w));
    oxfordWords.forEach(w => map.set(w.id, w));
    extraWords.forEach(w => map.set(w.id, w));
    return map;
  }, [customWords, oxfordWords, extraWords]);

  // Build queue based on chosen source
  const initializeQueue = () => {
    let candidateWordIds: string[] = [];
    /*
     * Aday listesi zaten hedeflere göre kırpıldıysa aşağıdaki 25'lik örnek
     * onu ikinci kez seyreltmemeli; sıra da anlamlıdır (önce tekrarlar).
     */
    let siraKorunsun = false;

    if (selectedSource === 'DUE_TODAY') {
      /*
       * VADESİ GELENLER ÖNCE, YENİLER KALAN BOŞLUĞA.
       *
       * Burada `isWordDueForReview` kullanılıyordu; o işlev hiç çalışılmamış
       * kelimeyi de "hazır" sayar. Aday listesi böylece neredeyse tüm sözlük
       * oluyor, ardından 25 kelimelik rastgele bir örnek alınıyordu: 3.300
       * dokunulmamış kelimenin arasından 30 gerçek tekrarın seçilme olasılığı
       * sıfıra yakındı. Yani "Bugünkü Tekrarlar" adı altında çoğunlukla yeni
       * kelime geliyor, vadesi gelen kelime hiç gelmiyordu — tekrar aralığı
       * hesabının tamamı boşa çıkıyordu.
       *
       * Ayrıca kullanıcının ayarladığı günlük hedefler ilk kez burada
       * karşılık buluyor: profilde girilen sayılar seansın büyüklüğünü
       * gerçekten belirliyor.
       */
      const vadesiGelenler: string[] = [];
      const yeniler: string[] = [];
      allWordsMap.forEach((_, id) => {
        const durum = learningStates[id];
        if (isReviewDue(durum)) vadesiGelenler.push(id);
        else if (isNewWord(durum)) yeniler.push(id);
      });

      const tekrarHedefi = settings?.dailyReviewGoal ?? 15;
      const yeniHedefi = settings?.dailyNewWordsGoal ?? 5;

      candidateWordIds = [
        ...sample(vadesiGelenler, tekrarHedefi),
        ...sample(yeniler, yeniHedefi)
      ];
      siraKorunsun = true;
    } else if (selectedSource === 'WEAK_WORDS') {
      allWordsMap.forEach((_, id) => {
        const s = learningStates[id];
        if (s && (s.stage === 'WEAK' || s.consecutiveWrong >= 1)) {
          candidateWordIds.push(id);
        }
      });
    } else if (selectedSource === 'ALL_OXFORD') {
      candidateWordIds = [...oxfordWords, ...extraWords].map(w => w.id);
    } else {
      // Specific Collection
      candidateWordIds = memberships
        .filter(m => m.collectionId === selectedSource)
        .map(m => m.wordId);
    }

    if (candidateWordIds.length === 0) {
      alert('Bu grupta çalışılacak kelime bulunamadı.');
      return;
    }

    const shuffled = siraKorunsun ? candidateWordIds : sample(candidateWordIds, 25);

    const items: SessionQueueItem[] = (shuffled
      .map(id => {
        const card = allWordsMap.get(id);
        if (!card) return null;
        const membership = memberships.find(m => m.wordId === id);
        const col = collections.find(c => c.id === membership?.collectionId);
        return {
          card,
          state: learningStates[id],
          collectionName: col?.name,
          sourceContext: membership?.sourceContext || card.sourceContext,
          attemptCount: 0
        };
      })
      .filter(Boolean) as SessionQueueItem[]);

    setQueue(items);
    setCurrentIndex(0);
    setIsFlipped(false);
    setTypedInput('');
    setTypedResult(null);
    setIsAnswerSubmitted(false);
    setReviewedCount(0);
    setMistakeWordIds(new Set());
    setUpgradedCount(0);
    setIsCompleted(false);
    setIsSessionStarted(true);
  };

  const currentItem = queue[currentIndex];

  // Çalışma modunu belirle.
  //
  // Önceki sürümde mod yalnızca sıra numarasına bakıyordu
  // (`modes[currentIndex % modes.length]`). Bu, kelimenin öğrenme aşamasını
  // tamamen yok sayıyordu: öğrencinin hayatında ilk kez gördüğü ikinci kelime
  // ona yazdırılıyordu. Görmediğin bir kelimeyi yazamazsın; bu bir öğrenme
  // adımı değil, garantili bir başarısızlıktır.
  //
  // Mod artık hatırlama zorluğuna göre kademeleniyor:
  //   NEW/LEARNING -> tanıma (kart çevirme)
  //   REVIEW       -> bağlamdan hatırlama (boşluk doldurma) veya dinleme
  //   WEAK         -> dinleme (yeniden tanıma desteği)
  //   MASTERED     -> üretim (yazarak hatırlama)
  const currentMode = useMemo(() => {
    if (studyMode !== 'mixed') return studyMode;
    if (!currentItem) return 'flashcard';

    const stage = currentItem.state?.stage;
    const hasUsableExample = (currentItem.card.examples || []).some(
      ex => blankOutWord(ex?.en || '', currentItem.card.word) !== null
    );

    switch (stage) {
      case 'MASTERED':
        return 'typed';
      case 'WEAK':
      case 'RELEARNING':
        return 'listening';
      case 'REVIEW':
        // Boşluk doldurma yalnızca kelimenin gerçekten geçtiği bir örnek
        // varsa anlamlıdır; yoksa cevabı açıkta bırakırdı.
        return hasUsableExample ? 'cloze' : 'listening';
      case 'LEARNING':
        return currentIndex % 2 === 0 ? 'flashcard' : 'listening';
      default:
        return 'flashcard';
    }
  }, [studyMode, currentIndex, currentItem]);

  // Kart değiştiğinde telaffuzu otomatik çal.
  //
  // `autoPlayAudioOnCard` ayarı en baştan beri saklanıyordu ama hiçbir yerde
  // okunmuyordu; ayar açık olsa bile hiçbir şey olmuyordu.
  useEffect(() => {
    if (!settings?.autoPlayAudioOnCard) return;
    if (!isSessionStarted || !currentItem) return;
    // Dinleme modu cevabı zaten sesle veriyor; burada tekrar çalmak
    // soruyu baştan ele verirdi.
    if (currentMode === 'listening') return;
    speakText(currentItem.card.word);
  }, [settings?.autoPlayAudioOnCard, isSessionStarted, currentItem, currentMode]);

  // Check typed input
  const handleCheckTypedAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem || !typedInput.trim()) return;

    // Sözlük kontrolü geçilir ki bir harflik fark başka bir gerçek kelimeye
    // denk geldiğinde (though / thought) tolerans uygulanmasın.
    const result = checkTypedAnswerCorrectness(
      typedInput,
      currentItem.card.word,
      settings?.enableTypoTolerance !== false,
      oxfordCoreRepository.isKnownWord
    );
    setTypedResult(result);
    setIsAnswerSubmitted(true);

    if (result.isCorrect) {
      speakText(currentItem.card.word);
    }
  };

  // Grade user response & proceed
  const handleGradeResponse = (quality: ResponseQuality) => {
    if (!currentItem) return;

    const wordId = currentItem.card.id;
    onRecordStudyResult(wordId, quality, currentMode, selectedSource);
    setReviewedCount(prev => prev + 1);

    /*
     * KUYRUĞA EKLEME KARARI ÖNCE VERİLİYOR.
     *
     * `setQueue` sırayı hemen değiştirmez; aşağıdaki `queue.length` bu render'ın
     * BAYAT değerini okur. Son kartta "Tekrar Et" denildiğinde kelime kuyruğa
     * ekleniyor ama uzunluk hâlâ eski olduğu için seans o anda bitiyordu:
     * kullanıcı "bunu tekrar göster" diyor, kart bir daha hiç gösterilmiyordu —
     * yani düğme tam da yapması gereken şeyi yapmıyordu.
     */
    const tekrarKuyrugaEklenecek = quality === 'again' && currentItem.attemptCount === 0;

    if (quality === 'again') {
      setMistakeWordIds(prev => new Set(prev).add(wordId));
      if (tekrarKuyrugaEklenecek) {
        setQueue(prev => [...prev, { ...currentItem, attemptCount: 1 }]);
      }
    } else {
      setUpgradedCount(prev => prev + 1);
    }

    const yeniUzunluk = queue.length + (tekrarKuyrugaEklenecek ? 1 : 0);

    if (currentIndex + 1 < yeniUzunluk) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
      setTypedInput('');
      setTypedResult(null);
      setIsAnswerSubmitted(false);
    } else {
      setIsCompleted(true);
      onFinishSession({
        sessionId: `session-${Date.now()}`,
        date: new Date().toISOString(),
        totalCardsReviewed: reviewedCount + 1,
        newCardsLearned: 0,
        reviewsCompleted: reviewedCount + 1,
        mistakeWordIds: Array.from(
          quality === 'again' ? new Set(mistakeWordIds).add(wordId) : mistakeWordIds
        ),
        upgradedWordIds: []
      });
    }
  };

  // ----------------------------------------------------
  // PRE-SESSION SETUP SCREEN
  // ----------------------------------------------------
  if (!isSessionStarted) {
    return (
      <div className="max-w-[760px] mx-auto space-y-6 pb-safe-nav animate-fadeIn">
        <div className="bg-[var(--surface)] rounded-2xl p-6 sm:p-8 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-6">
          <div className="text-center space-y-1.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center mx-auto">
              <Brain className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Kartları Çalış
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              Aralıklı tekrar algoritması ile kelimeleri hafızana al.
            </p>
          </div>

          {/* Select Study Source */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              1. Çalışılacak Kaynağı Seç:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedSource('DUE_TODAY')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedSource === 'DUE_TODAY'
                    ? 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--text-primary)] font-bold shadow-xs'
                    : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Bugünkü Tekrarlar</span>
                  <Flame className="w-4 h-4 text-[var(--learning)]" />
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Zamanı gelen kelimeler</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSource('WEAK_WORDS')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedSource === 'WEAK_WORDS'
                    ? 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--text-primary)] font-bold shadow-xs'
                    : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Zorlanılan Kelimeler</span>
                  <Zap className="w-4 h-4 text-[var(--favorite)]" />
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Hata yapılan kelimeler</p>
              </button>

              {collections.map(col => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setSelectedSource(col.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedSource === col.id
                      ? 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--text-primary)] font-bold shadow-xs'
                      : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold truncate">{col.name}</span>
                    <Layers className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">{col.description || 'Özel Set'}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Select Study Mode */}
          <div className="space-y-2.5 pt-1">
            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              2. Hatırlama Modu:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'mixed', label: 'Karma Mod', desc: 'Dengeli tekrar' },
                { id: 'flashcard', label: 'Flaş Kart', desc: 'Klasik çevirme' },
                { id: 'typed', label: 'Yazarak', desc: 'Yüksek odak' },
                { id: 'listening', label: 'Dinleme', desc: 'Kulaktan tanıma' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setStudyMode(m.id as any)}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    studyMode === m.id
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--surface)] font-bold shadow-xs'
                      : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
                  }`}
                >
                  <span className="text-xs font-semibold block">{m.label}</span>
                  <span className={`text-[10px] block mt-0.5 ${studyMode === m.id ? 'opacity-80' : 'text-[var(--text-secondary)]'}`}>
                    {m.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={initializeQueue}
            className="w-full py-3.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--surface)] font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
          >
            <span>Seansı Başlat</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // COMPLETED SUMMARY SCREEN
  // ----------------------------------------------------
  if (isCompleted) {
    return (
      <div className="max-w-[600px] mx-auto space-y-6 pb-safe-nav animate-fadeIn">
        <div className="bg-[var(--surface)] rounded-2xl p-8 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-[var(--learned-soft)] text-[var(--learned)] flex items-center justify-center mx-auto">
            <Award className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Tebrikler!</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Bu seanstaki tüm kartlar hafıza döngüne işlendi.
            </p>
          </div>

          {/* Summary Metric Badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
              <span className="text-[10px] font-bold text-[var(--text-muted)] block uppercase">ÇALIŞILAN</span>
              <span className="text-xl font-bold text-[var(--text-primary)]">{reviewedCount}</span>
            </div>
            <div className="p-3.5 bg-[var(--learned-soft)] rounded-xl border border-[var(--learned-border)]">
              <span className="text-[10px] font-bold text-[var(--learned-text)] block uppercase">GÜÇLENEN</span>
              <span className="text-xl font-bold text-[var(--learned-text)]">{upgradedCount}</span>
            </div>
            <div className="p-3.5 bg-[var(--danger-soft)] rounded-xl border border-[var(--danger-border)]">
              <span className="text-[10px] font-bold text-[var(--danger)] block uppercase">HATA</span>
              <span className="text-xl font-bold text-[var(--danger)]">{mistakeWordIds.size}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              onClick={() => {
                setIsSessionStarted(false);
                setIsCompleted(false);
              }}
              className="flex-1 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--surface)] font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Yeni Seans Başlat
            </button>
            <button
              onClick={onExitSession}
              className="flex-1 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] font-semibold text-xs rounded-xl border border-[var(--border)] transition-all cursor-pointer"
            >
              Tamamla ve Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // ACTIVE STUDY CARD VIEW
  // ----------------------------------------------------
  if (!currentItem) return null;

  const card = currentItem.card;

  // Boşluk doldurma cümlesi. `blankOutWord` düzenli ifade meta karakterlerini
  // kaçırır ve kelimenin çekimli biçimlerini de yakalar; eski kod hem "C++"
  // gibi kelimelerde çöküyor hem de kelime cümlede çekimli geçtiğinde hiçbir
  // şeyi boşluğa çevirmeden cevabı açıkta bırakıyordu.
  const clozeSentence = (() => {
    for (const example of card.examples || []) {
      const blanked = blankOutWord(example?.en || '', card.word);
      if (blanked) return { blanked, tr: example.tr };
    }
    return null;
  })();
  const progressPercent = Math.round(((currentIndex) / queue.length) * 100);

  return (
    <div className="max-w-[760px] mx-auto space-y-5 pb-safe-nav animate-fadeIn">
      {/* Top Header & Progress */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onExitSession}
          className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          &larr; Seanstan Çık
        </button>

        <div className="flex items-center gap-3 flex-1 max-w-xs">
          <div className="flex-1 h-2 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-bold text-[var(--text-secondary)] whitespace-nowrap font-mono">
            {currentIndex + 1} / {queue.length}
          </span>
        </div>
      </div>

      {/* Main Flashcard Container */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] overflow-hidden">
        {/* Card Header Bar */}
        <div className="p-4 pb-3 border-b border-[var(--border-light)] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {/*
              SEVİYE UYDURULMAZ.

              Burada `card.level || 'B1'` yazıyordu: seviyesi olmayan bir
              karta B1 rozeti takılıyordu. Kullanıcının kendi eklediği
              kelimenin ölçülmüş bir CEFR seviyesi yoktur; uydurulmuş bir
              rozet, resmî listeden gelen bir bilgiymiş gibi görünür.
              `shouldShowCefr` bu kuralı tek yerde tutuyor.
            */}
            {shouldShowCefr(card) && <CEFRBadge level={card.level!} size="sm" />}
            <span className="font-semibold text-[var(--text-secondary)]">
              {card.partOfSpeech}
            </span>
            {currentItem.collectionName && (
              <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[150px]">
                • {currentItem.collectionName}
              </span>
            )}
          </div>

          {/* Telaffuz: normal hız + yavaş hız */}
          <PronounceButtons text={card.word} compact />
        </div>

        {/* Card Body by Mode */}
        <div className="p-8 text-center space-y-5 min-h-[260px] flex flex-col justify-center items-center">
          {/* Mode 1: Flashcard */}
          {currentMode === 'flashcard' && (
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="cursor-pointer select-none space-y-3 w-full"
            >
              <h3 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight">
                {card.word}
              </h3>
              {card.phonetic && (
                <p className="text-xs font-mono text-[var(--text-secondary)]">{card.phonetic}</p>
              )}

              {/* Source Context Anchor */}
              {currentItem.sourceContext && (
                <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] italic max-w-md mx-auto">
                  "{currentItem.sourceContext}"
                </div>
              )}

              <div className="pt-3">
                {isFlipped ? (
                  <div className="p-4 bg-[var(--neutral-50)] rounded-xl border border-[var(--border)] text-[var(--text-primary)] animate-fadeIn space-y-1">
                    <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider block">
                      TÜRKÇE ANLAMI
                    </span>
                    <p className="text-lg font-bold text-[var(--text-primary)]">{card.turkishMeaning}</p>
                    {card.examples && card.examples[0] && (
                      <p className="text-xs text-[var(--text-secondary)] italic pt-2 border-t border-[var(--border)]">
                        "{card.examples[0].en}" — {card.examples[0].tr}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--bg)] hover:bg-[var(--surface-soft)] rounded-xl text-xs font-semibold text-[var(--text-secondary)] transition-colors border border-[var(--border)]">
                    <RotateCw className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>Anlamı Görmek İçin Dokun</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mode 2: Typed Recall */}
          {currentMode === 'typed' && (
            <div className="w-full space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  TÜRKÇE ANLAMI:
                </span>
                <h3 className="text-2xl font-bold text-[var(--text-primary)]">{card.turkishMeaning}</h3>
                {card.partOfSpeech && (
                  <span className="text-xs text-[var(--primary)] font-semibold">({card.partOfSpeech})</span>
                )}
              </div>

              {!isAnswerSubmitted ? (
                <form onSubmit={handleCheckTypedAnswer} className="space-y-3 max-w-sm mx-auto">
                  <input
                    type="text"
                    value={typedInput}
                    onChange={(e) => setTypedInput(e.target.value)}
                    placeholder="İngilizce kelimeyi yaz..."
                    autoFocus
                    className="w-full px-4 py-2.5 text-center text-sm font-bold bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                  />
                  <button
                    type="submit"
                    disabled={!typedInput.trim()}
                    className="w-full py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-[var(--surface)] text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Cevabı Kontrol Et
                  </button>
                </form>
              ) : (
                <div className="space-y-2 animate-fadeIn">
                  <div className={`p-3.5 rounded-xl border ${typedResult?.isCorrect ? 'bg-[var(--learned-soft)] border-[var(--learned-border)]' : 'bg-[var(--danger-soft)] border-[var(--danger-border)]'}`}>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      {typedResult?.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-[var(--learned)]" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[var(--danger)]" />
                      )}
                      <span className={`text-xs font-bold ${typedResult?.isCorrect ? 'text-[var(--learned-text)]' : 'text-[var(--danger)]'}`}>
                        {typedResult?.isCorrect ? (typedResult.isTypo ? 'Doğru (Küçük İmla Farkı)' : 'Doğru Cevap') : 'Yanlış Cevap'}
                      </span>
                    </div>

                    <p className="text-base font-bold text-[var(--text-primary)]">{card.word}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Listening Recall */}
          {currentMode === 'listening' && (
            <div className="w-full space-y-4">
              <button
                type="button"
              onClick={() => speakText(card.word)}
                className="w-14 h-14 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center mx-auto hover:bg-[var(--primary-soft-hover)] transition-transform active:scale-95 cursor-pointer"
              >
                <Volume2 className="w-6 h-6 stroke-[2.2]" />
              </button>
              <p className="text-xs text-[var(--text-secondary)]">Telaffuzu dinle ve kelimeyi hatırla</p>

              <div className="pt-1">
                {isFlipped ? (
                  <div className="p-4 bg-[var(--neutral-50)] rounded-xl border border-[var(--border)] animate-fadeIn space-y-1">
                    <h3 className="text-xl font-bold text-[var(--text-primary)]">{card.word}</h3>
                    <p className="text-xs font-bold text-[var(--primary)]">{card.turkishMeaning}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsFlipped(true)}
                    className="px-4 py-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border)] cursor-pointer"
                  >
                    Kartı Çevir
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mode 4: Cloze Context */}
          {currentMode === 'cloze' && (
            <div className="w-full space-y-3">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                CÜMLEDEKİ BOŞLUĞU TAMAMLA:
              </span>

              {clozeSentence ? (
                <div className="p-4 bg-[var(--bg)] rounded-xl border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] leading-relaxed max-w-lg mx-auto">
                  {clozeSentence.blanked}
                  <p className="text-[11px] text-[var(--text-secondary)] italic mt-1.5">
                    "{clozeSentence.tr}"
                  </p>
                </div>
              ) : (
                <p className="text-sm font-bold text-[var(--text-primary)]">{card.turkishMeaning}</p>
              )}

              {isFlipped ? (
                <div className="p-3 bg-[var(--learned-soft)] rounded-xl border border-[var(--learned-border)] animate-fadeIn">
                  <span className="text-[11px] font-bold text-[var(--learned-text)]">Doğru Kelime:</span>
                  <p className="text-lg font-bold text-[var(--learned-text)]">{card.word}</p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsFlipped(true);
                    speakText(card.word);
                  }}
                  className="px-4 py-2 bg-[var(--primary)] text-[var(--surface)] text-xs font-semibold rounded-xl hover:bg-[var(--primary-hover)] cursor-pointer"
                >
                  Cevabı Göster
                </button>
              )}
            </div>
          )}
        </div>

        {/*
          * Çalışma durumu: yalnızca iki seçenek.
          *
          * Önceki sürüm dört hafıza derecesi (Tekrar / Zor / İyi / Kolay)
          * gösteriyordu. Bu, aralıklı tekrar motorunun iç kavramıdır ve
          * öğrenciden her kartta kendi hatırlama kalitesini ölçmesini ister;
          * pratikte karar yorgunluğu yaratır ve tutarsız girdi üretir.
          *
          * Arayüz artık "Tekrar Et" ve "Öğrendim" diyor. Motor değişmedi:
          * bu iki seçenek arka planda kanıt ağırlıklı SRS derecelerine
          * çevriliyor, aralık merdiveni ve ustalık puanı aynen çalışıyor.
          */}
        {(isFlipped || isAnswerSubmitted) && (
          <div className="p-4 bg-[var(--bg)] border-t border-[var(--border-light)] space-y-2.5 animate-fadeIn">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block text-center">
              Bu kelimeyi biliyor musun?
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleGradeResponse('again')}
                className="py-3 px-3 rounded-xl bg-[var(--learning-soft)] hover:bg-[var(--learning-tint)] text-[var(--learning-text)] border border-[var(--learning-border)] text-sm font-bold transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Tekrar Et</span>
              </button>

              <button
                onClick={() => handleGradeResponse('good')}
                className="py-3 px-3 rounded-xl bg-[var(--learned-soft)] hover:bg-[var(--learned-tint)] text-[var(--learned-text)] border border-[var(--learned-border)] text-sm font-bold transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <Check className="w-4 h-4" />
                <span>Öğrendim</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
