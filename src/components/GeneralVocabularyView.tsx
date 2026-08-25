import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WordCard, LearningState } from '../types';
import { BandNumber } from '../types/extended';
import { extendedRepository, EXTENDED_BANDS } from '../services/extendedRepository';
import { WordCardComponent } from './WordCard';
import { StudyFlashcard } from './study/StudyFlashcard';
import { getUserWordStatus } from '../utils/storageV2';
import {
  Search,
  X,
  Play,
  Layers,
  Download,
  Loader2,
  AlertCircle,
  Check,
  Volume2,
} from 'lucide-react';
import { speakText } from '../utils/speech';

/**
 * Genel Dağarcık ekranı.
 *
 * TASARIM KARARLARI
 *
 * 1. Bant seçimi açık bir eylemdir. Kullanıcı bir bandı seçmeden hiçbir veri
 *    indirilmez; ekran açılışı ~4,5 MB'lık katmanı belleğe almaz.
 *
 * 2. Aynı anda tek bant. Yeni bant seçilince önceki bırakılır; bellekte
 *    yalnızca çalışılan bant durur.
 *
 * 3. Liste sayfalanır. 2000 kartı tek seferde DOM'a basmak zayıf telefonlarda
 *    kaydırmayı kilitler; liste `PAGE_SIZE` kadar büyür.
 *
 * 4. Yükleme başarısız olursa hata gösterilir ve yeniden denenebilir. Sessizce
 *    boş liste göstermek, verinin yokmuş gibi görünmesine yol açardı.
 */

/** Bir sayfada gösterilen kart sayısı. */
const PAGE_SIZE = 60;

type StatusFilter = 'ALL' | 'LEARNED' | 'LEARNING' | 'UNSEEN' | 'FAVORITES';
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface GeneralVocabularyViewProps {
  favorites: string[];
  learningStates: Record<string, LearningState>;
  onToggleFavorite: (id: string) => void;
  onSetStatus: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
  onOpenAddToCollection?: (card: WordCard) => void;
  /** Yüklenen bandın kartlarını üst katmana bildirir (favoriler, sınav vb.). */
  onLoadedWordsChange?: (cards: readonly WordCard[]) => void;
}

export const GeneralVocabularyView: React.FC<GeneralVocabularyViewProps> = ({
  favorites,
  learningStates,
  onToggleFavorite,
  onSetStatus,
  onOpenAddToCollection,
  onLoadedWordsChange,
}) => {
  const [activeBand, setActiveBand] = useState<BandNumber | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState<string>('');
  const [bandWords, setBandWords] = useState<readonly WordCard[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [partOfSpeechFilter, setPartOfSpeechFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isStudyingFlashcards, setIsStudyingFlashcards] = useState(false);

  const totals = useMemo(() => {
    return EXTENDED_BANDS.reduce(
      (acc, band) => ({
        entries: acc.entries + band.entryCount,
        senses: acc.senses + band.senseCount,
      }),
      { entries: 0, senses: 0 }
    );
  }, []);

  /**
   * Son yükleme isteğinin numarası.
   *
   * Kullanıcı yükleme sürerken başka bir banda geçebilir; geç gelen yanıt
   * ekrandaki bandı değiştirmemeli. Karşılaştırmayı `setState` güncelleyicisi
   * içinde yapmak da olurdu ama React güncelleyiciyi iki kez çağırabildiği
   * için yan etkiler (bant bırakma, üst katmanı bilgilendirme) çift çalışırdı.
   */
  const requestRef = useRef(0);

  /**
   * Favoriler ve öğrenme durumları ref'te tutulur: yükleme bittiğinde güncel
   * değer okunur. Bunları `openBand`'in bağımlılığı yapmak, her favori
   * değişiminde işlevi yeniden üretirdi.
   */
  const markedIdsRef = useRef<string[]>([]);
  useEffect(() => {
    markedIdsRef.current = [...favorites, ...Object.keys(learningStates)];
  }, [favorites, learningStates]);

  const openBand = useCallback((band: BandNumber) => {
    const token = ++requestRef.current;

    setActiveBand(band);
    setLoadState(extendedRepository.isBandLoaded(band) ? 'ready' : 'loading');
    setLoadError('');
    setVisibleCount(PAGE_SIZE);
    setSearchQuery('');
    setPartOfSpeechFilter('ALL');
    setStatusFilter('ALL');

    extendedRepository
      .loadBand(band)
      .then(cards => {
        if (requestRef.current !== token) return;
        // Önceki oturumlarda işaretlenmiş kartlar bant bırakılmadan ÖNCE elde
        // tutulur; yoksa favoriler listesinden düşerlerdi.
        extendedRepository.retainCards(markedIdsRef.current);
        // Yalnızca çalışılan bant bellekte kalsın.
        extendedRepository.releaseBandsExcept(band);
        setBandWords(cards);
        setLoadState('ready');
        onLoadedWordsChange?.(cards);
      })
      .catch(() => {
        if (requestRef.current !== token) return;
        setLoadState('error');
        setLoadError('Bant yüklenemedi. Bağlantını kontrol edip yeniden dene.');
      });
  }, [onLoadedWordsChange]);

  // Filtre değişince liste baştan sayfalanır; yoksa kullanıcı yeni sonuçların
  // ortasında bir yerde kalırdı.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, partOfSpeechFilter, statusFilter]);

  const filteredWords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return bandWords.filter(card => {
      if (
        partOfSpeechFilter !== 'ALL' &&
        !card.partOfSpeech.toLowerCase().includes(partOfSpeechFilter.toLowerCase())
      ) {
        return false;
      }

      if (statusFilter !== 'ALL') {
        const status = getUserWordStatus(card.id, learningStates);
        if (statusFilter === 'LEARNED' && status !== 'learned') return false;
        if (statusFilter === 'LEARNING' && status !== 'learning') return false;
        if (statusFilter === 'UNSEEN' && status !== 'unseen') return false;
        if (statusFilter === 'FAVORITES' && !favorites.includes(card.id)) return false;
      }

      if (query) {
        return (
          card.word.toLowerCase().includes(query) ||
          card.turkishMeaning.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [bandWords, partOfSpeechFilter, statusFilter, searchQuery, favorites, learningStates]);

  const bandStats = useMemo(() => {
    let learned = 0;
    let learning = 0;
    let unseen = 0;
    bandWords.forEach(card => {
      const status = getUserWordStatus(card.id, learningStates);
      if (status === 'learned') learned++;
      else if (status === 'learning') learning++;
      else unseen++;
    });
    return { total: bandWords.length, learned, learning, unseen };
  }, [bandWords, learningStates]);

  const activeDescriptor = activeBand ? extendedRepository.getBand(activeBand) : undefined;

  if (isStudyingFlashcards && activeDescriptor) {
    return (
      <StudyFlashcard
        title={`Genel Dağarcık — ${activeDescriptor.label}`}
        sourceContextName={`Genel Dağarcık ${activeDescriptor.label}`}
        words={filteredWords.length > 0 ? [...filteredWords] : [...bandWords]}
        favorites={favorites}
        learningStates={learningStates}
        onToggleFavorite={onToggleFavorite}
        onSetStatus={onSetStatus}
        onBack={() => setIsStudyingFlashcards(false)}
        onOpenAddToCollection={onOpenAddToCollection}
        isCustomDeck={false}
      />
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-[1180px] mx-auto animate-fadeIn">
      {/* Başlık */}
      <div className="bg-[#FFFFFF] p-6 rounded-2xl border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#EEECFA] text-[#4F46A5] flex items-center justify-center shrink-0">
            <Layers className="w-4.5 h-4.5" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1E2430]">Genel Dağarcık</h2>
        </div>
        <p className="text-xs sm:text-sm text-[#687080] mt-2 leading-relaxed">
          Oxford listelerinin dışında kalan, günlük dilde sık geçen{' '}
          <strong className="text-[#1E2430]">{totals.entries.toLocaleString('tr-TR')}</strong> kelime ve{' '}
          <strong className="text-[#1E2430]">{totals.senses.toLocaleString('tr-TR')}</strong> anlam.
          Sıklığa göre üç banda ayrıldı; telefonun yorulmasın diye yalnızca
          seçtiğin bant belleğe alınır.
        </p>
      </div>

      {/* Bant seçici */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {EXTENDED_BANDS.map(band => {
          const isActive = activeBand === band.band;
          const isLoaded = extendedRepository.isBandLoaded(band.band);
          const isLoading = isActive && loadState === 'loading';

          return (
            <button
              key={band.band}
              type="button"
              onClick={() => openBand(band.band)}
              disabled={isLoading}
              className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer active:scale-[0.99] ${
                isActive
                  ? 'bg-[#EEECFA] border-[#4F46A5] shadow-xs'
                  : 'bg-[#FFFFFF] border-[#E4E1D9] hover:border-[#D7D2F4] hover:bg-[#F8F7F3]'
              } ${isLoading ? 'cursor-wait' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-sm font-bold ${
                    isActive ? 'text-[#4F46A5]' : 'text-[#1E2430]'
                  }`}
                >
                  {band.label}
                </span>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 text-[#4F46A5] animate-spin shrink-0" />
                ) : isLoaded ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4F806A] bg-[#E6F0EA] px-1.5 py-0.5 rounded-md shrink-0">
                    <Check className="w-3 h-3" /> Hazır
                  </span>
                ) : (
                  <Download className="w-4 h-4 text-[#8E95A2] shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-[#687080] mt-1.5 leading-snug">
                {band.description}
              </p>
              <div className="mt-2.5 flex items-center gap-2 text-[11px] font-semibold">
                <span className="px-1.5 py-0.5 rounded-md bg-[#F1EFE8] text-[#1E2430]">
                  {band.entryCount.toLocaleString('tr-TR')} kelime
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-[#F1EFE8] text-[#687080]">
                  {band.senseCount.toLocaleString('tr-TR')} anlam
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Henüz bant seçilmedi */}
      {activeBand === null && (
        <div className="text-center py-14 bg-[#FFFFFF] rounded-2xl border border-[#E4E1D9] space-y-3">
          <Layers className="w-8 h-8 text-[#8E95A2] mx-auto" />
          <h3 className="text-base font-bold text-[#1E2430]">Bir bant seç</h3>
          <p className="text-xs text-[#687080] max-w-sm mx-auto leading-relaxed">
            En sık kullanılan kelimelerle başlamak istersen 1. bandı aç. Bant
            bir kez yüklendikten sonra tamamen çevrimdışı çalışır.
          </p>
        </div>
      )}

      {/* Yükleniyor */}
      {loadState === 'loading' && (
        <div className="text-center py-14 bg-[#FFFFFF] rounded-2xl border border-[#E4E1D9] space-y-3">
          <Loader2 className="w-7 h-7 text-[#4F46A5] mx-auto animate-spin" />
          <p className="text-xs text-[#687080] font-medium">Bant yükleniyor…</p>
        </div>
      )}

      {/* Hata */}
      {loadState === 'error' && (
        <div className="text-center py-12 bg-[#FFFFFF] rounded-2xl border border-[#E4C9C9] space-y-3">
          <AlertCircle className="w-8 h-8 text-[#B4534F] mx-auto" />
          <h3 className="text-base font-bold text-[#1E2430]">Bant açılamadı</h3>
          <p className="text-xs text-[#687080] max-w-sm mx-auto">{loadError}</p>
          <button
            type="button"
            onClick={() => activeBand && openBand(activeBand)}
            className="px-4 py-2 bg-[#F1EFE8] hover:bg-[#EEECFA] text-[#4F46A5] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Yeniden Dene
          </button>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          {/* Filtreler */}
          <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E4E1D9] space-y-4 shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9] text-xs">
              <div className="text-[#687080] font-medium">
                Bantta <strong className="text-[#1E2430]">{bandStats.total}</strong> kelime içinde:
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-[#4F806A] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#4F806A]" />
                  {bandStats.learned} Öğrendim
                </span>
                <span className="inline-flex items-center gap-1.5 text-[#B97922] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#B97922]" />
                  {bandStats.learning} Tekrar Et
                </span>
                <span className="text-[#8E95A2]">{bandStats.unseen} İncelenmedi</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-[#8E95A2] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Kelime ara..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:outline-none focus:bg-[#FFFFFF] focus:border-[#4F46A5] focus:ring-1 focus:ring-[#4F46A5] font-medium text-[#1E2430] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E95A2] hover:text-[#1E2430]"
                    aria-label="Aramayı temizle"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={partOfSpeechFilter}
                onChange={e => setPartOfSpeechFilter(e.target.value)}
                className="w-full py-2 px-3 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:outline-none focus:bg-[#FFFFFF] focus:border-[#4F46A5] focus:ring-1 focus:ring-[#4F46A5] font-medium text-[#1E2430]"
              >
                <option value="ALL">Tüm Sözcük Türleri</option>
                <option value="n.">İsimler (n.)</option>
                <option value="v.">Fiiller (v.)</option>
                <option value="adj.">Sıfatlar (adj.)</option>
                <option value="adv.">Zarflar (adv.)</option>
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full py-2 px-3 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:outline-none focus:bg-[#FFFFFF] focus:border-[#4F46A5] focus:ring-1 focus:ring-[#4F46A5] font-medium text-[#1E2430]"
              >
                <option value="ALL">Tümü</option>
                <option value="LEARNED">✓ Öğrendiklerim</option>
                <option value="LEARNING">↻ Tekrar Etmem Gerekenler</option>
                <option value="UNSEEN">İncelenmedi</option>
                <option value="FAVORITES">♥ Favorilerim</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-[#8E95A2] font-medium">
                {filteredWords.length} sonuç
              </span>
              <button
                type="button"
                onClick={() => {
                  if (filteredWords.length === 0) return;
                  speakText(
                    filteredWords
                      .slice(0, 10)
                      .map(w => `${w.word}. ${w.turkishMeaning}`)
                      .join('. ')
                  );
                }}
                className="px-3 py-2 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-[#1E2430] border border-[#E4E1D9] font-medium text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Listeden ilk 10 kelimeyi seslendir"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#4F46A5]" />
                <span>Sesli Dinle</span>
              </button>
            </div>
          </div>

          {/* Kartlarla çalış */}
          {filteredWords.length > 0 && (
            <button
              type="button"
              onClick={() => setIsStudyingFlashcards(true)}
              className="w-full p-4 sm:p-5 bg-[#EEECFA] hover:bg-[#E3DFF7] border-2 border-[#D7D2F4] hover:border-[#4F46A5] rounded-2xl transition-all cursor-pointer text-left flex items-center justify-between group shadow-xs active:scale-[0.99]"
            >
              <div className="space-y-0.5">
                <div className="text-base sm:text-lg font-bold text-[#1E2430] group-hover:text-[#4F46A5] flex items-center gap-2">
                  <span>Kartlarla Çalış</span>
                  <span className="text-[#4F46A5]">→</span>
                </div>
                <p className="text-xs text-[#687080] font-medium">
                  Şimdi çalışmaya başla ({filteredWords.length} kelime)
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#4F46A5] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>
            </button>
          )}

          {/* Kelime listesi */}
          {filteredWords.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredWords.slice(0, visibleCount).map(word => (
                  <WordCardComponent
                    key={word.id}
                    card={word}
                    isFavorite={favorites.includes(word.id)}
                    learningState={learningStates[word.id]}
                    onToggleFavorite={onToggleFavorite}
                    onSetStatus={onSetStatus}
                    onOpenAddToCollection={onOpenAddToCollection}
                  />
                ))}
              </div>

              {visibleCount < filteredWords.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
                  className="w-full py-3 bg-[#FFFFFF] hover:bg-[#F1EFE8] text-[#4F46A5] border border-[#E4E1D9] font-semibold text-xs rounded-2xl transition-colors cursor-pointer"
                >
                  Daha fazla göster ({filteredWords.length - visibleCount} kelime kaldı)
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-16 bg-[#FFFFFF] rounded-2xl border border-[#E4E1D9] space-y-3">
              <Search className="w-8 h-8 text-[#8E95A2] mx-auto" />
              <h3 className="text-base font-bold text-[#1E2430]">Eşleşen kelime bulunamadı</h3>
              <p className="text-xs text-[#687080] max-w-sm mx-auto">
                Bu bantta aramanla eşleşen kelime yok. Filtreleri temizleyip
                tekrar bakabilirsin.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPartOfSpeechFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="px-4 py-2 bg-[#F1EFE8] hover:bg-[#EEECFA] text-[#4F46A5] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Filtreleri Temizle
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
