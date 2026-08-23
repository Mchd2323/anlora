import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { WordCard, LearningState } from '../../types';
import {
  Volume2,
  Heart,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Layers,
  BookOpen,
  BookmarkPlus,
  Edit2,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { speakText } from '../../utils/speech';
import { CEFRBadge } from '../ui/CEFRBadge';
import { WordStatusActions } from '../ui/WordStatusActions';
import { getUserWordStatus } from '../../utils/storageV2';
import { useSwipeDeck } from '../../hooks/useSwipeDeck';
import { formatPhonetic } from '../../utils/phonetic';

export interface StudyFlashcardProps {
  title: string;
  sourceContextName?: string;
  words: WordCard[];
  favorites: string[];
  learningStates: Record<string, LearningState>;
  onToggleFavorite: (id: string) => void;
  onSetStatus: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
  onBack: () => void;
  onOpenEditCard?: (card: WordCard) => void;
  onDeleteCard?: (id: string) => void;
  onOpenAddToCollection?: (card: WordCard) => void;
  isCustomDeck?: boolean;
}

type FilterMode = 'ALL' | 'LEARNED' | 'LEARNING';

/** Sürükleme sırasında karta verilen en fazla eğim. */
const MAX_TILT_DEG = 7;
/** Eğimin yumuşaklığı: öteleme bu sayıya bölünerek dereceye çevrilir. */
const TILT_DIVISOR = 24;

export const StudyFlashcard: React.FC<StudyFlashcardProps> = ({
  title,
  sourceContextName,
  words,
  favorites,
  learningStates,
  onToggleFavorite,
  onSetStatus,
  onBack,
  onOpenEditCard,
  onDeleteCard,
  onOpenAddToCollection,
  isCustomDeck = false
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMeaningRevealed, setIsMeaningRevealed] = useState(false);
  const [isExamplesExpanded, setIsExamplesExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Filtrelenmiş liste
  const activeWordList = useMemo(() => {
    if (filterMode === 'LEARNED') {
      return words.filter((w) => getUserWordStatus(w.id, learningStates) === 'learned');
    }
    if (filterMode === 'LEARNING') {
      return words.filter((w) => getUserWordStatus(w.id, learningStates) === 'learning');
    }
    return words;
  }, [words, filterMode, learningStates]);

  useEffect(() => {
    if (currentIndex >= activeWordList.length && activeWordList.length > 0) {
      setCurrentIndex(activeWordList.length - 1);
    }
  }, [activeWordList.length, currentIndex]);

  const currentCard: WordCard | undefined = activeWordList[currentIndex] || activeWordList[0];
  const hasNext = currentIndex < activeWordList.length - 1;
  const hasPrev = currentIndex > 0;

  useEffect(() => {
    setIsMeaningRevealed(false);
    setIsExamplesExpanded(false);
    setIsMenuOpen(false);
  }, [currentCard?.id]);

  const handleNextCard = useCallback(() => {
    setCurrentIndex((prev) => (prev < activeWordList.length - 1 ? prev + 1 : prev));
  }, [activeWordList.length]);

  const handlePrevCard = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  // Sola kaydırma sonrakine, sağa kaydırma öncekine gider; kâğıt desteyi
  // kenara itme sezgisiyle aynı yön.
  const swipe = useSwipeDeck({
    onSwipe: (direction) => (direction === 'left' ? handleNextCard() : handlePrevCard()),
    canSwipeLeft: hasNext,
    canSwipeRight: hasPrev
  });

  // Sürükleme bittiğinde tarayıcı ayrıca bir `click` üretir. Kaydırmayı
  // "anlamı aç" dokunuşu sanmamak için sürüklendiğini işaretliyoruz.
  const draggedRef = useRef(false);
  useEffect(() => {
    if (swipe.isDragging) draggedRef.current = true;
  }, [swipe.isDragging]);

  const surfaceHandlers = {
    ...swipe.handlers,
    onPointerDown: (event: React.PointerEvent) => {
      draggedRef.current = false;
      swipe.handlers.onPointerDown(event);
    }
  };

  const handleToggleReveal = useCallback(() => {
    if (draggedRef.current) return;
    setIsMeaningRevealed((prev) => !prev);
  }, []);

  // Klavye gezinmesi
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextCard();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevCard();
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (target.tagName !== 'BUTTON') {
          e.preventDefault();
          setIsMeaningRevealed((prev) => !prev);
        }
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextCard, handlePrevCard, isFullscreen]);

  const handlePlayAudio = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!currentCard) return;
    setIsPlayingAudio(true);
    speakText(currentCard.word);
    setTimeout(() => setIsPlayingAudio(false), 900);
  };

  const currentStatus = currentCard
    ? getUserWordStatus(currentCard.id, learningStates)
    : 'unseen';
  const isFavorite = currentCard ? favorites.includes(currentCard.id) : false;

  const counts = useMemo(() => {
    let learned = 0;
    let learning = 0;
    words.forEach((w) => {
      const st = getUserWordStatus(w.id, learningStates);
      if (st === 'learned') learned++;
      else if (st === 'learning') learning++;
    });
    return { all: words.length, learned, learning };
  }, [words, learningStates]);

  if (words.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4 animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-[#EEECFA] text-[#4F46A5] flex items-center justify-center mx-auto border border-[#D7D2F4]">
          <BookOpen className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[#1E2430]">{title}</h2>
        <p className="text-xs text-[#687080]">Bu grupta henüz çalışılacak kelime bulunmuyor.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-[#F8F7F3] text-[#1E2430] border border-[#E4E1D9] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[#F1EFE8]"
        >
          {sourceContextName ? `← ${sourceContextName}` : 'Geri Dön'}
        </button>
      </div>
    );
  }

  if (activeWordList.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4 animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-[#F8F7F3] text-[#687080] flex items-center justify-center mx-auto border border-[#E4E1D9]">
          <Layers className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#1E2430]">
          {filterMode === 'LEARNED' ? 'Öğrenilen Kelime Yok' : 'Tekrar Edilecek Kelime Yok'}
        </h3>
        <p className="text-xs text-[#687080]">
          {filterMode === 'LEARNED'
            ? 'Bu grupta henüz "Öğrendim" olarak işaretlediğin kelime bulunmuyor.'
            : 'Bu grupta henüz "Tekrar Et" listesine eklediğin kelime bulunmuyor.'}
        </p>
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setFilterMode('ALL')}
            className="px-4 py-2 bg-[#4F46A5] text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-[#433B91]"
          >
            Tüm Kelimeleri Göster ({words.length})
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-[#F8F7F3] text-[#1E2430] border border-[#E4E1D9] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[#F1EFE8]"
          >
            Geri
          </button>
        </div>
      </div>
    );
  }

  const examples = currentCard?.examples || [];
  const progressPercent = Math.round(((currentIndex + 1) / activeWordList.length) * 100);

  // Kartın anlık dönüşümü: sürüklerken parmağı takip eder ve hafifçe eğilir,
  // eşik aşılıp bırakıldığında ekrandan çıkar.
  const tilt = Math.max(
    -MAX_TILT_DEG,
    Math.min(MAX_TILT_DEG, swipe.offsetX / TILT_DIVISOR)
  );
  const cardTransform = swipe.exitDirection
    ? `translateX(${swipe.exitDirection === 'left' ? '-125%' : '125%'}) rotate(${
        swipe.exitDirection === 'left' ? -MAX_TILT_DEG : MAX_TILT_DEG
      }deg)`
    : `translateX(${swipe.offsetX}px) rotate(${tilt}deg)`;

  // Arkadaki katmanlar sürükledikçe yükselir: destenin devam ettiği hissi.
  const stackLift = swipe.progress;

  const filters: { key: FilterMode; label: string; count: number; active: string }[] = [
    { key: 'ALL', label: 'Tümü', count: counts.all, active: 'bg-[#FFFFFF] text-[#1E2430]' },
    {
      key: 'LEARNED',
      label: 'Öğrendiklerim',
      count: counts.learned,
      active: 'bg-[#FFFFFF] text-[#35654E]'
    },
    {
      key: 'LEARNING',
      label: 'Tekrar Edeceklerim',
      count: counts.learning,
      active: 'bg-[#FFFFFF] text-[#8A5A18]'
    }
  ];

  return (
    <div
      className={`animate-fadeIn ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#F8F7F3] px-4 py-5 sm:px-6 overflow-y-auto flex flex-col'
          : 'max-w-2xl mx-auto pb-16'
      }`}
    >
      {/* ---------------------------------------------------------------
          1. BAŞLIK — çerçevesiz, sade bir üst şerit
          --------------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={isFullscreen ? () => setIsFullscreen(false) : onBack}
          className="flex items-center gap-1.5 -ml-1 px-2.5 py-1.5 text-xs font-semibold text-[#687080] hover:text-[#1E2430] rounded-lg hover:bg-[#F1EFE8] transition-colors cursor-pointer shrink-0"
          title={sourceContextName || 'Geri'}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="max-w-[120px] sm:max-w-[220px] truncate">
            {isFullscreen ? 'Tam ekrandan çık' : sourceContextName || 'Geri'}
          </span>
        </button>

        <div className="min-w-0 text-center">
          <p className="text-xs font-bold text-[#1E2430] truncate">{title}</p>
        </div>

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 text-[#8E95A2] hover:text-[#1E2430] rounded-lg hover:bg-[#F1EFE8] transition-colors cursor-pointer shrink-0"
          title={isFullscreen ? 'Tam ekrandan çık (Esc)' : 'Tam ekran'}
          aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* İnce ilerleme çizgisi + sayaç */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 bg-[#E9E6DE] h-[3px] rounded-full overflow-hidden">
          <div
            className="bg-[#4F46A5] h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span
          className="text-[11px] font-mono font-semibold text-[#8E95A2] tabular-nums shrink-0"
          aria-live="polite"
        >
          {currentIndex + 1} / {activeWordList.length}
        </span>
      </div>

      {/* ---------------------------------------------------------------
          2. FİLTRE — tam ekranda gizlenir (dikkat dağıtmasın)
          --------------------------------------------------------------- */}
      {!isFullscreen && (
        <div className="mt-4 flex items-center gap-1 p-1 bg-[#F1EFE8] rounded-xl">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFilterMode(f.key);
                setCurrentIndex(0);
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer text-center truncate ${
                filterMode === f.key
                  ? `${f.active} shadow-[var(--elev-1)]`
                  : 'text-[#8E95A2] hover:text-[#1E2430]'
              }`}
            >
              {f.label}{' '}
              <span className="font-mono tabular-nums opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* ---------------------------------------------------------------
          3. KAYDIRILABİLİR KART DESTESİ
          --------------------------------------------------------------- */}
      <div
        className={`relative mt-5 ${isFullscreen ? 'flex-1 flex items-center' : ''}`}
        role="group"
        aria-roledescription="kart destesi"
        aria-label="Sağa veya sola kaydırarak kartlar arasında geçiş yapın"
      >
        <div className="relative w-full">
          {/* Arkadaki iki katman: destenin derinliği */}
          {hasNext && (
            <>
              <div
                aria-hidden="true"
                className="deck-stack-card absolute inset-x-0 top-0 h-full rounded-[26px] bg-[#FFFFFF] border border-[#EFECE6]"
                style={{
                  transform: `translateY(${20 - stackLift * 8}px) scale(${0.92 + stackLift * 0.03})`,
                  opacity: 0.45 + stackLift * 0.2
                }}
              />
              <div
                aria-hidden="true"
                className="deck-stack-card absolute inset-x-0 top-0 h-full rounded-[26px] bg-[#FFFFFF] border border-[#E9E6DE]"
                style={{
                  transform: `translateY(${10 - stackLift * 5}px) scale(${0.96 + stackLift * 0.025})`,
                  opacity: 0.7 + stackLift * 0.3
                }}
              />
            </>
          )}

          {/* Kenar ipuçları — eşiğe yaklaşıldıkça belirir */}
          <div
            aria-hidden="true"
            className="deck-hint absolute left-3 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#1E2430] text-white text-[11px] font-bold shadow-[var(--elev-4)]"
            style={{
              opacity: swipe.offsetX > 12 && hasPrev ? swipe.progress : 0,
              transform: `translateY(-50%) scale(${0.85 + swipe.progress * 0.15})`
            }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Önceki
          </div>
          <div
            aria-hidden="true"
            className="deck-hint absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#4F46A5] text-white text-[11px] font-bold shadow-[var(--elev-4)]"
            style={{
              opacity: swipe.offsetX < -12 && hasNext ? swipe.progress : 0,
              transform: `translateY(-50%) scale(${0.85 + swipe.progress * 0.15})`
            }}
          >
            Sonraki
            <ChevronRight className="w-3.5 h-3.5" />
          </div>

          {/* Üstteki kart — parmağı takip eden yüzey.
              `key` kart kimliği: kart değişince öğe yeniden bağlanır, böylece
              çıkış dönüşümü yeni karta sızmaz. */}
          {currentCard && (
            <div
              key={currentCard.id}
              {...surfaceHandlers}
              className={`deck-surface deck-card relative z-10 bg-[#FFFFFF] rounded-[26px] border border-[#E4E1D9] p-6 sm:p-8 flex flex-col min-h-[400px] sm:min-h-[440px] ${
                swipe.isDragging
                  ? 'deck-card--dragging shadow-[var(--elev-3)]'
                  : swipe.exitDirection
                    ? 'deck-card--exiting shadow-[var(--elev-3)]'
                    : 'shadow-[var(--elev-2)]'
              }`}
              style={{
                transform: cardTransform,
                opacity: swipe.exitDirection ? 0 : 1
              }}
            >
              {/* Üst şerit: etiketler ve eylemler */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {!currentCard.isCustom && currentCard.sourceType !== 'custom' && currentCard.level && (
                    <CEFRBadge level={currentCard.level} size="sm" />
                  )}
                  {currentCard.partOfSpeech && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-[#F8F7F3] border border-[#E9E6DE] rounded-md text-[#687080]">
                      {currentCard.partOfSpeech}
                    </span>
                  )}
                  {currentCard.isCustom && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-[#F1EFE8] border border-[#E4E1D9] rounded-md text-[#687080]">
                      Özel
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={handlePlayAudio}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      isPlayingAudio
                        ? 'bg-[#EEECFA] text-[#4F46A5]'
                        : 'text-[#8E95A2] hover:bg-[#F1EFE8] hover:text-[#4F46A5]'
                    }`}
                    title="Telaffuzu dinle"
                    aria-label="Telaffuzu dinle"
                  >
                    <Volume2 className={`w-[18px] h-[18px] ${isPlayingAudio ? 'animate-pulse' : ''}`} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(currentCard.id);
                    }}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      isFavorite
                        ? 'text-[#B75D6A] hover:bg-[#FDF0F2]'
                        : 'text-[#8E95A2] hover:bg-[#FDF0F2] hover:text-[#B75D6A]'
                    }`}
                    title={isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                    aria-label="Favori"
                    aria-pressed={isFavorite}
                  >
                    <Heart className={`w-[18px] h-[18px] ${isFavorite ? 'fill-current' : ''}`} />
                  </button>

                  {(isCustomDeck || onOpenEditCard || onDeleteCard || onOpenAddToCollection) && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen(!isMenuOpen);
                        }}
                        className="p-2 text-[#8E95A2] hover:bg-[#F1EFE8] hover:text-[#1E2430] rounded-xl transition-colors cursor-pointer"
                        aria-label="Seçenekler"
                        aria-expanded={isMenuOpen}
                      >
                        <MoreVertical className="w-[18px] h-[18px]" />
                      </button>

                      {isMenuOpen && (
                        <div
                          className="absolute right-0 top-full mt-1.5 w-44 bg-[#FFFFFF] rounded-xl border border-[#E4E1D9] shadow-[var(--elev-4)] py-1.5 z-30 animate-fadeIn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onOpenAddToCollection && (
                            <button
                              onClick={() => {
                                setIsMenuOpen(false);
                                onOpenAddToCollection(currentCard);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-left text-[#1E2430] hover:bg-[#F8F7F3] flex items-center gap-2 cursor-pointer"
                            >
                              <BookmarkPlus className="w-3.5 h-3.5 text-[#4F46A5]" />
                              <span>Sete Ekle</span>
                            </button>
                          )}

                          {currentCard.isCustom && onOpenEditCard && (
                            <button
                              onClick={() => {
                                setIsMenuOpen(false);
                                onOpenEditCard(currentCard);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-left text-[#1E2430] hover:bg-[#F8F7F3] flex items-center gap-2 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#687080]" />
                              <span>Kartı Düzenle</span>
                            </button>
                          )}

                          {currentCard.isCustom && onDeleteCard && (
                            <button
                              onClick={() => {
                                setIsMenuOpen(false);
                                if (confirm(`"${currentCard.word}" kartını silmek istediğinize emin misiniz?`)) {
                                  onDeleteCard(currentCard.id);
                                }
                              }}
                              className="w-full px-3 py-1.5 text-xs text-left text-[#C65D55] hover:bg-[#FAECEA] flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Kartı Sil</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Orta alan: kelime ve anlam */}
              <div className="flex-1 flex flex-col justify-center items-center text-center py-6">
                <button
                  type="button"
                  onClick={handleToggleReveal}
                  aria-expanded={isMeaningRevealed}
                  className="group flex flex-col items-center gap-2 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46A5] focus-visible:ring-offset-4 rounded-2xl"
                >
                  <h2 className="text-[2rem] sm:text-[2.75rem] leading-[1.1] font-black text-[#1E2430] tracking-[-0.03em]">
                    {currentCard.word}
                  </h2>
                  {formatPhonetic(currentCard.phonetic) && (
                    <span className="text-xs sm:text-sm font-mono text-[#A9A499]">
                      {formatPhonetic(currentCard.phonetic)}
                    </span>
                  )}

                  {!isMeaningRevealed && (
                    <span className="mt-5 text-[11px] font-semibold text-[#A9A499] group-hover:text-[#4F46A5] transition-colors tracking-wide">
                      Anlamı için dokun
                    </span>
                  )}
                </button>

                {isMeaningRevealed && (
                  <div className="w-full mt-5 animate-riseIn">
                    {/* Çerçeve yerine ince bir ayraç: gözü kelimeden anlama
                        taşır, kutu üstüne kutu koymaz. */}
                    <div className="w-10 h-px bg-[#E4E1D9] mx-auto mb-5" />

                    {currentCard.turkishMeaning ? (
                      <p className="text-xl sm:text-2xl font-bold text-[#1E2430] leading-snug">
                        {currentCard.turkishMeaning}
                      </p>
                    ) : (
                      /*
                       * Anlamı henüz hazırlanmamış kayıt. Uydurma bir karşılık
                       * göstermek yerine durumu açıkça söylüyoruz: yanlış anlam
                       * öğretmek, boş bırakmaktan çok daha zararlıdır.
                       */
                      <p className="text-sm text-[#8E95A2] leading-relaxed">
                        Bu kelimenin Türkçe karşılığı henüz hazırlanmadı.
                      </p>
                    )}

                    {currentCard.contextualMeaning &&
                      currentCard.contextualMeaning !== currentCard.turkishMeaning && (
                        <p className="text-xs text-[#4F46A5] font-medium pt-2">
                          Bağlam anlamı: {currentCard.contextualMeaning}
                        </p>
                      )}

                    {examples.length > 0 && (
                      <div className="w-full text-left mt-5">
                        <button
                          onClick={() => setIsExamplesExpanded(!isExamplesExpanded)}
                          className="w-full px-3.5 py-2.5 hover:bg-[#F8F7F3] text-xs font-semibold text-[#687080] rounded-xl border border-[#EFECE6] flex items-center justify-between transition-colors cursor-pointer"
                          aria-expanded={isExamplesExpanded}
                        >
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-[#4F46A5]" />
                            <span>Örnek cümleler ({examples.length})</span>
                          </span>
                          {isExamplesExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {isExamplesExpanded && (
                          <div className="mt-2 space-y-3 px-1 animate-fadeIn">
                            {examples.map((ex, idx) => (
                              <div
                                key={idx}
                                className="pl-3 border-l-2 border-[#E4E1D9] space-y-1"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[13px] font-medium text-[#1E2430] leading-relaxed">
                                    {ex.en}
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      speakText(ex.en);
                                    }}
                                    className="p-1 -mt-0.5 text-[#C3BEB4] hover:text-[#4F46A5] rounded transition-colors shrink-0 cursor-pointer"
                                    title="Cümleyi dinle"
                                    aria-label="Cümleyi dinle"
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <p className="text-[12px] text-[#8E95A2] leading-relaxed">
                                  {ex.tr}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Alt şerit: öğrenme durumu */}
              <div className="pt-5 border-t border-[#F1EFE8]">
                <WordStatusActions
                  status={currentStatus}
                  onSetStatus={(st) => onSetStatus(currentCard.id, st)}
                  size="md"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------
          4. GEZİNME — kaydırmanın klavye ve fare karşılığı
          --------------------------------------------------------------- */}
      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          onClick={handlePrevCard}
          disabled={!hasPrev}
          className="w-11 h-11 flex items-center justify-center bg-[#FFFFFF] text-[#1E2430] rounded-full border border-[#E4E1D9] shadow-[var(--elev-1)] transition-all cursor-pointer hover:border-[#D7D2F4] hover:text-[#4F46A5] active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:border-[#E4E1D9] disabled:hover:text-[#1E2430]"
          aria-label="Önceki kelime"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <p className="text-[11px] text-[#A9A499] text-center min-w-[150px]">
          <span className="sm:hidden">Geçmek için kartı kaydır</span>
          <span className="hidden sm:inline">
            Kartı sürükle ya da{' '}
            <kbd className="px-1 py-0.5 bg-[#FFFFFF] border border-[#E4E1D9] rounded text-[10px] font-mono">
              ←
            </kbd>{' '}
            <kbd className="px-1 py-0.5 bg-[#FFFFFF] border border-[#E4E1D9] rounded text-[10px] font-mono">
              →
            </kbd>{' '}
            kullan
          </span>
        </p>

        <button
          onClick={handleNextCard}
          disabled={!hasNext}
          className="w-11 h-11 flex items-center justify-center bg-[#4F46A5] text-white rounded-full shadow-[var(--elev-2)] transition-all cursor-pointer hover:bg-[#433B91] active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-[#4F46A5]"
          aria-label="Sonraki kelime"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
