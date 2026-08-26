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
import { shouldShowCefr } from '../../types/oxford';
import { WordStatusActions } from '../ui/WordStatusActions';
import { getUserWordStatus } from '../../utils/storageV2';
import { useSwipeDeck } from '../../hooks/useSwipeDeck';
import { readJSON, writeJSON } from '../../utils/safeStorage';
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
  /**
   * Kaldığı yerin saklandığı anahtar. Verilmezse `title` kullanılır; aynı
   * desteyi aynı yerden açmayı sağlayacak kadar kararlı bir dize olmalı.
   */
  deckKey?: string;
}

type FilterMode = 'ALL' | 'LEARNED' | 'LEARNING';

/**
 * Kaldığı yer.
 *
 * Kullanıcı "Kartlarla Çalış"a ikinci kez bastığında listenin başına dönüyor,
 * ilerlediği yüzlerce kartı yeniden geçmek zorunda kalıyordu. Kaldığı yer
 * SIRA NUMARASI olarak değil KART KİMLİĞİ olarak saklanır: liste filtreye ya
 * da yeni içeriğe göre değişse bile numara kayar, kimlik kaymaz. Kart artık
 * listede yoksa baştan başlanır.
 */
const RESUME_KEY = 'anlora.flashcardResume.v1';

type ResumeMap = Record<string, string>;

function readResumeCardId(deckKey: string): string | undefined {
  if (!deckKey) return undefined;
  return readJSON<ResumeMap>(RESUME_KEY, {})[deckKey];
}

function writeResumeCardId(deckKey: string, cardId: string): void {
  if (!deckKey) return;
  const map = readJSON<ResumeMap>(RESUME_KEY, {});
  if (map[deckKey] === cardId) return;
  map[deckKey] = cardId;
  writeJSON(RESUME_KEY, map);
}

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
  isCustomDeck = false,
  deckKey
}) => {
  const resumeKey = deckKey || title;
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');
  // Kaldığı kart, ilk render'da bulunur; sonradan bir efektle atlamak
  // kullanıcıya önce ilk kartı, sonra bir sıçrama gösterirdi.
  const [currentIndex, setCurrentIndex] = useState(() => {
    const savedId = readResumeCardId(resumeKey);
    if (!savedId) return 0;
    const index = words.findIndex(word => word.id === savedId);
    return index >= 0 ? index : 0;
  });
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
    if (currentCard?.id) {
      writeResumeCardId(resumeKey, currentCard.id);
    }
  }, [currentCard?.id, resumeKey]);

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
        <div className="w-14 h-14 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center mx-auto border border-[var(--primary-border)]">
          <BookOpen className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
        <p className="text-xs text-[var(--text-secondary)]">Bu grupta henüz çalışılacak kelime bulunmuyor.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--surface-soft)]"
        >
          {sourceContextName ? `← ${sourceContextName}` : 'Geri Dön'}
        </button>
      </div>
    );
  }

  if (activeWordList.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4 animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg)] text-[var(--text-secondary)] flex items-center justify-center mx-auto border border-[var(--border)]">
          <Layers className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[var(--text-primary)]">
          {filterMode === 'LEARNED' ? 'Öğrenilen Kelime Yok' : 'Tekrar Edilecek Kelime Yok'}
        </h3>
        <p className="text-xs text-[var(--text-secondary)]">
          {filterMode === 'LEARNED'
            ? 'Bu grupta henüz "Öğrendim" olarak işaretlediğin kelime bulunmuyor.'
            : 'Bu grupta henüz "Tekrar Et" listesine eklediğin kelime bulunmuyor.'}
        </p>
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setFilterMode('ALL')}
            className="px-4 py-2 bg-[var(--primary)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--primary-hover)]"
          >
            Tüm Kelimeleri Göster ({words.length})
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--surface-soft)]"
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
    { key: 'ALL', label: 'Tümü', count: counts.all, active: 'bg-[var(--surface)] text-[var(--text-primary)]' },
    {
      key: 'LEARNED',
      label: 'Öğrendiklerim',
      count: counts.learned,
      active: 'bg-[var(--surface)] text-[var(--learned-text)]'
    },
    {
      key: 'LEARNING',
      label: 'Tekrar Edeceklerim',
      count: counts.learning,
      active: 'bg-[var(--surface)] text-[var(--learning-text)]'
    }
  ];

  return (
    <div
      className={`animate-fadeIn ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[var(--bg)] px-4 py-5 sm:px-6 overflow-y-auto flex flex-col'
          : 'max-w-2xl mx-auto pb-safe-nav'
      }`}
    >
      {/* ---------------------------------------------------------------
          1. BAŞLIK — çerçevesiz, sade bir üst şerit
          --------------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={isFullscreen ? () => setIsFullscreen(false) : onBack}
          className="flex items-center gap-1.5 -ml-1 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-soft)] transition-colors cursor-pointer shrink-0"
          title={sourceContextName || 'Geri'}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="max-w-[120px] sm:max-w-[220px] truncate">
            {isFullscreen ? 'Tam ekrandan çık' : sourceContextName || 'Geri'}
          </span>
        </button>

        <div className="min-w-0 text-center">
          <p className="text-xs font-bold text-[var(--text-primary)] truncate">{title}</p>
        </div>

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-soft)] transition-colors cursor-pointer shrink-0"
          title={isFullscreen ? 'Tam ekrandan çık (Esc)' : 'Tam ekran'}
          aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* İnce ilerleme çizgisi + sayaç */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 bg-[var(--neutral-200)] h-[3px] rounded-full overflow-hidden">
          <div
            className="bg-[var(--primary)] h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span
          className="text-[11px] font-mono font-semibold text-[var(--text-muted)] tabular-nums shrink-0"
          aria-live="polite"
        >
          {currentIndex + 1} / {activeWordList.length}
        </span>
      </div>

      {/* ---------------------------------------------------------------
          2. FİLTRE — tam ekranda gizlenir (dikkat dağıtmasın)
          --------------------------------------------------------------- */}
      {!isFullscreen && (
        <div className="mt-4 flex items-center gap-1 p-1 bg-[var(--surface-soft)] rounded-xl">
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
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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
                className="deck-stack-card absolute inset-x-0 top-0 h-full rounded-[26px] bg-[var(--surface)] border border-[var(--border-light)]"
                style={{
                  transform: `translateY(${20 - stackLift * 8}px) scale(${0.92 + stackLift * 0.03})`,
                  opacity: 0.45 + stackLift * 0.2
                }}
              />
              <div
                aria-hidden="true"
                className="deck-stack-card absolute inset-x-0 top-0 h-full rounded-[26px] bg-[var(--surface)] border border-[var(--neutral-200)]"
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
            className="deck-hint absolute left-3 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--text-primary)] text-white text-[11px] font-bold shadow-[var(--elev-4)]"
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
            className="deck-hint absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--primary)] text-white text-[11px] font-bold shadow-[var(--elev-4)]"
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
              className={`deck-surface deck-card relative z-10 bg-[var(--surface)] rounded-[26px] border border-[var(--border)] p-6 sm:p-8 flex flex-col min-h-[400px] sm:min-h-[440px] ${
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
                  {/* Kural tek yerde: shouldShowCefr. Elle yazılan denetim
                      buradaki kopyayla zamanla kayabilirdi. */}
                  {shouldShowCefr(currentCard) && (
                    <CEFRBadge level={currentCard.level!} size="sm" />
                  )}
                  {currentCard.partOfSpeech && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-[var(--bg)] border border-[var(--neutral-200)] rounded-md text-[var(--text-secondary)]">
                      {currentCard.partOfSpeech}
                    </span>
                  )}
                  {currentCard.isCustom && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-[var(--surface-soft)] border border-[var(--border)] rounded-md text-[var(--text-secondary)]">
                      Özel
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={handlePlayAudio}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      isPlayingAudio
                        ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--primary)]'
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
                        ? 'text-[var(--favorite)] hover:bg-[var(--favorite-soft)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--favorite-soft)] hover:text-[var(--favorite)]'
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
                        className="p-2 text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)] rounded-xl transition-colors cursor-pointer"
                        aria-label="Seçenekler"
                        aria-expanded={isMenuOpen}
                      >
                        <MoreVertical className="w-[18px] h-[18px]" />
                      </button>

                      {isMenuOpen && (
                        <div
                          className="absolute right-0 top-full mt-1.5 w-44 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--elev-4)] py-1.5 z-30 animate-fadeIn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onOpenAddToCollection && (
                            <button
                              onClick={() => {
                                setIsMenuOpen(false);
                                onOpenAddToCollection(currentCard);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-left text-[var(--text-primary)] hover:bg-[var(--bg)] flex items-center gap-2 cursor-pointer"
                            >
                              <BookmarkPlus className="w-3.5 h-3.5 text-[var(--primary)]" />
                              <span>Sete Ekle</span>
                            </button>
                          )}

                          {currentCard.isCustom && onOpenEditCard && (
                            <button
                              onClick={() => {
                                setIsMenuOpen(false);
                                onOpenEditCard(currentCard);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-left text-[var(--text-primary)] hover:bg-[var(--bg)] flex items-center gap-2 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
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
                              className="w-full px-3 py-1.5 text-xs text-left text-[var(--danger)] hover:bg-[var(--danger-soft)] flex items-center gap-2 cursor-pointer"
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
                  className="group flex flex-col items-center gap-2 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-4 rounded-2xl"
                >
                  <h2 className="text-[2rem] sm:text-[2.75rem] leading-[1.1] font-black text-[var(--text-primary)] tracking-[-0.03em]">
                    {currentCard.word}
                  </h2>
                  {formatPhonetic(currentCard.phonetic) && (
                    <span className="text-xs sm:text-sm font-mono text-[var(--neutral-500)]">
                      {formatPhonetic(currentCard.phonetic)}
                    </span>
                  )}

                  {!isMeaningRevealed && (
                    <span className="mt-5 text-[11px] font-semibold text-[var(--neutral-500)] group-hover:text-[var(--primary)] transition-colors tracking-wide">
                      Anlamı için dokun
                    </span>
                  )}
                </button>

                {isMeaningRevealed && (
                  <div className="w-full mt-5 animate-riseIn">
                    {/* Çerçeve yerine ince bir ayraç: gözü kelimeden anlama
                        taşır, kutu üstüne kutu koymaz. */}
                    <div className="w-10 h-px bg-[var(--border)] mx-auto mb-5" />

                    {currentCard.turkishMeaning ? (
                      <p className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] leading-snug">
                        {currentCard.turkishMeaning}
                      </p>
                    ) : (
                      /*
                       * Anlamı henüz hazırlanmamış kayıt. Uydurma bir karşılık
                       * göstermek yerine durumu açıkça söylüyoruz: yanlış anlam
                       * öğretmek, boş bırakmaktan çok daha zararlıdır.
                       */
                      <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                        Bu kelimenin Türkçe karşılığı henüz hazırlanmadı.
                      </p>
                    )}

                    {currentCard.contextualMeaning &&
                      currentCard.contextualMeaning !== currentCard.turkishMeaning && (
                        <p className="text-xs text-[var(--primary)] font-medium pt-2">
                          Bağlam anlamı: {currentCard.contextualMeaning}
                        </p>
                      )}

                    {examples.length > 0 && (
                      <div className="w-full text-left mt-5">
                        <button
                          onClick={() => setIsExamplesExpanded(!isExamplesExpanded)}
                          className="w-full px-3.5 py-2.5 hover:bg-[var(--bg)] text-xs font-semibold text-[var(--text-secondary)] rounded-xl border border-[var(--border-light)] flex items-center justify-between transition-colors cursor-pointer"
                          aria-expanded={isExamplesExpanded}
                        >
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-[var(--primary)]" />
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
                                className="pl-3 border-l-2 border-[var(--border)] space-y-1"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[13px] font-medium text-[var(--text-primary)] leading-relaxed">
                                    {ex.en}
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      speakText(ex.en);
                                    }}
                                    className="p-1 -mt-0.5 text-[var(--neutral-400)] hover:text-[var(--primary)] rounded transition-colors shrink-0 cursor-pointer"
                                    title="Cümleyi dinle"
                                    aria-label="Cümleyi dinle"
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
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
              <div className="pt-5 border-t border-[var(--surface-soft)]">
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
          className="w-11 h-11 flex items-center justify-center bg-[var(--surface)] text-[var(--text-primary)] rounded-full border border-[var(--border)] shadow-[var(--elev-1)] transition-all cursor-pointer hover:border-[var(--primary-border)] hover:text-[var(--primary)] active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:border-[var(--border)] disabled:hover:text-[var(--text-primary)]"
          aria-label="Önceki kelime"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <p className="text-[11px] text-[var(--neutral-500)] text-center min-w-[150px]">
          <span className="sm:hidden">Geçmek için kartı kaydır</span>
          <span className="hidden sm:inline">
            Kartı sürükle ya da{' '}
            <kbd className="px-1 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[10px] font-mono">
              ←
            </kbd>{' '}
            <kbd className="px-1 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[10px] font-mono">
              →
            </kbd>{' '}
            kullan
          </span>
        </p>

        <button
          onClick={handleNextCard}
          disabled={!hasNext}
          className="w-11 h-11 flex items-center justify-center bg-[var(--primary)] text-white rounded-full shadow-[var(--elev-2)] transition-all cursor-pointer hover:bg-[var(--primary-hover)] active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-[var(--primary)]"
          aria-label="Sonraki kelime"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
