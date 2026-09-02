import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { WordCard, Level, LearningState } from '../types';
import { OxfordGroupKey } from '../types/oxford';
import { WordCardComponent } from './WordCard';
import { loadPhrases, getPhraseCards } from '../services/phraseRepository';
import { StudyFlashcard } from './study/StudyFlashcard';
import { Search, BookOpen, Play, X, Check, RotateCw, ChevronDown } from 'lucide-react';
import { getUserWordStatus } from '../utils/storageV2';
import { CEFRBadge } from './ui/CEFRBadge';

/**
 * Oxford 5000 gezgini.
 *
 * TASARIM KARARLARI
 *
 * 1. TEK BAŞLIK. Önceki sürümde "Oxford 3000" ve "Oxford 5000 – Ek" iki ayrı
 *    sekmeydi; kullanıcı aynı sözlüğün iki parçası arasında gezinmek zorunda
 *    kalıyordu. Artık hepsi "Oxford 5000" altında, seviyeler yan yana duruyor.
 *    Kaynak ayrımı yine korunuyor: B2 Ek, Oxford 3000'in B2'siyle aynı kovaya
 *    atılmaz, kendi seviye düğmesi olarak durur (talimat 36).
 *
 * 2. LİSTE SAYFALANIR. "Tümü" seçiliyken havuz ~3.800 karttır. Hepsini tek
 *    seferde DOM'a basmak, sekmeye her girişte ve her filtre değişiminde
 *    saniyelerce donmaya yol açıyordu. Liste `PAGE_SIZE` kadar büyür.
 *
 * 3. DURUM ÖZETİ TIKLANABİLİR. "30 Öğrendim" yazısı artık bir düğmedir;
 *    dokununca liste yalnızca o kelimeleri gösterir. Sayıyı görüp de listesine
 *    ulaşamamak, bilgiyi yarım bırakmaktı.
 */

/** Bir sayfada gösterilen kart sayısı. */
const PAGE_SIZE = 60;

/**
 * Seviye sırası. 'B2 Ek' ARTIK YOK — B2'ye katıldı.
 *
 * İkisi de CEFR bakımından B2'ydi; fark yalnızca hangi Oxford listesinden
 * geldikleriydi. 'B2 Ek' etiketi kullanıcıya sanki ayrı bir seviyeymiş gibi
 * görünüyordu, oysa böyle bir seviye yok. Kaynak ayrımı veri katmanında
 * duruyor, yalnızca gösterim birleşti: B2 = 727 + 700 = 1.427.
 */
const LEVEL_KEYS: (Level | 'ALL')[] = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1'];

const LEVEL_LABEL: Record<string, string> = {
  ALL: 'Tüm seviyeler',
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
  C1: 'C1',
};

type StatusFilter = 'ALL' | 'LEARNED' | 'LEARNING' | 'UNSEEN' | 'FAVORITES';

/**
 * Kalıp bölümünün durumu.
 *
 * Veri (750 kalıp, ~540 KB) kendiliğinden yüklenmez: kullanıcı bölümü
 * açmadıkça tek bayt inmez. Oxford kelimeleriyle aynı ekranda dururlar ama
 * aynı havuzda değildirler — seviye sayaçları kelime sayar, 750 kalıbı
 * A1–C1 gruplarına katmak kullanıcının "A1'in %30'unu bitirdim" ilerlemesini
 * bozardı.
 */
interface OxfordExplorerProps {
  /** Oxford 3000 (A1–B2). */
  words: WordCard[];
  /** Oxford 5000 Ek (B2 Ek, C1). */
  extraWords?: WordCard[];
  favorites: string[];
  learned: string[];
  learningStates?: Record<string, LearningState>;
  selectedLevel: Level | 'ALL' | OxfordGroupKey;
  setSelectedLevel: (lvl: Level | 'ALL' | OxfordGroupKey) => void;
  /** Profil ekranından "öğrendiklerim"e doğrudan gelmek için. */
  initialStatusFilter?: StatusFilter;
  onToggleFavorite: (id: string) => void;
  onToggleLearned?: (id: string) => void;
  onSetStatus?: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
  onOpenAddToCollection?: (card: WordCard) => void;
  /** Karttaki "bu kelimede hata var" bildirimi. */
  onReportWord?: (card: WordCard) => void;
  onStartStudy?: (cards: WordCard[]) => void;
}

/**
 * Kartın seviye düğmesi karşılığı.
 *
 * Ek listeden gelen B2 kayıtları da 'B2' sayılıyor: ikisi aynı seviye,
 * yalnızca kaynakları farklı (bkz. types/oxford.ts → toDisplayLevel).
 */
function groupKeyOf(card: WordCard, isExtra: boolean): string {
  if (!isExtra) return card.level || 'B2';
  return card.level === 'C1' ? 'C1' : 'B2';
}

export const OxfordExplorer: React.FC<OxfordExplorerProps> = ({
  words = [],
  extraWords = [],
  favorites = [],
  learningStates = {},
  selectedLevel,
  setSelectedLevel,
  initialStatusFilter = 'ALL',
  onToggleFavorite,
  onToggleLearned,
  onSetStatus,
  onOpenAddToCollection,
  onReportWord,
}) => {
  const [isStudyingFlashcards, setIsStudyingFlashcards] = useState(false);
  /*
   * Kalıp çalışması kelimelerinkiyle AYNI kart ekranını kullanır: ayrı bir
   * çalışma akışı, ayrı bir "kaldığın yer" kaydı ve ayrı bir tasarım demek
   * olurdu. Yalnızca destenin kimliği ayrı, böylece kelimelerde kalınan yer
   * kalıplara geçince kaybolmaz.
   */
  const [kalipCalismasi, setKalipCalismasi] = useState<WordCard[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [partOfSpeechFilter, setPartOfSpeechFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  /*
   * Liste KAPALI başlar.
   *
   * Ekranın asıl işi çalışmaya başlatmak; beş bin kartı doğrudan altına
   * dökmek hem sayfayı uzatıyor hem de kullanıcıyı "önce şunları geçeyim"
   * hissine sokuyordu. Görmek isteyen tek dokunuşla açıyor.
   */
  const [isListOpen, setIsListOpen] = useState(false);

  /*
   * Kalıplar ve deyimler. Bölüm açılana kadar veri hiç indirilmez; 750
   * kalıp ~540 KB tutuyor ve kullanıcıların çoğu doğrudan kelimelere
   * bakıyor. Açıldıktan sonra bellekte kalır, ikinci açılış bedava.
   */
  const [kaliplarAcik, setKaliplarAcik] = useState(false);
  const [seviyeMenusuAcik, setSeviyeMenusuAcik] = useState(false);
  const [kaliplar, setKaliplar] = useState<WordCard[] | null>(null);
  const [kaliplarYukleniyor, setKaliplarYukleniyor] = useState(false);
  const [kalipSeviyesi, setKalipSeviyesi] = useState<Level | 'ALL'>('ALL');

  useEffect(() => {
    if (!kaliplarAcik || kaliplar) return;
    setKaliplarYukleniyor(true);
    void loadPhrases()
      .then(() => setKaliplar(getPhraseCards()))
      .finally(() => setKaliplarYukleniyor(false));
  }, [kaliplarAcik, kaliplar]);

  const gorunenKaliplar = useMemo(() => {
    if (!kaliplar) return [];
    if (kalipSeviyesi === 'ALL') return kaliplar;
    return kaliplar.filter(k => k.level === kalipSeviyesi);
  }, [kaliplar, kalipSeviyesi]);

  // Dışarıdan gelen istek (profilden "öğrendiklerim") filtreyi günceller.
  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  /**
   * İki kaynak tek havuzda birleşir; her karta seviye düğmesi karşılığı
   * eklenir. Kaynak dizileri modül düzeyinde sabit olduğu için bu hesap
   * uygulama ömründe bir kez yapılır.
   */
  const pool = useMemo(() => {
    return [
      ...words.map(card => ({ card, group: groupKeyOf(card, false) })),
      ...extraWords.map(card => ({ card, group: groupKeyOf(card, true) })),
    ];
  }, [words, extraWords]);

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: pool.length };
    pool.forEach(({ group }) => {
      counts[group] = (counts[group] || 0) + 1;
    });
    return counts;
  }, [pool]);

  const levelPool = useMemo(() => {
    if (selectedLevel === 'ALL') return pool;
    return pool.filter(item => item.group === selectedLevel);
  }, [pool, selectedLevel]);

  const levelStats = useMemo(() => {
    let learnedCount = 0;
    let learningCount = 0;
    let unseenCount = 0;
    levelPool.forEach(({ card }) => {
      const status = getUserWordStatus(card.id, learningStates);
      if (status === 'learned') learnedCount++;
      else if (status === 'learning') learningCount++;
      else unseenCount++;
    });
    return { total: levelPool.length, learnedCount, learningCount, unseenCount };
  }, [levelPool, learningStates]);

  const filteredWords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const kelimeler = levelPool
      .filter(({ card }) => {
        if (
          partOfSpeechFilter !== 'ALL' &&
          !card.partOfSpeech.toLowerCase().includes(partOfSpeechFilter.toLowerCase())
        ) {
          return false;
        }

        if (statusFilter !== 'ALL') {
          if (statusFilter === 'FAVORITES') {
            if (!favorites.includes(card.id)) return false;
          } else {
            const status = getUserWordStatus(card.id, learningStates);
            if (statusFilter === 'LEARNED' && status !== 'learned') return false;
            if (statusFilter === 'LEARNING' && status !== 'learning') return false;
            if (statusFilter === 'UNSEEN' && status !== 'unseen') return false;
          }
        }

        if (query) {
          return (
            card.word.toLowerCase().includes(query) ||
            card.turkishMeaning.toLowerCase().includes(query)
          );
        }

        return true;
      })
      .map(item => item.card);

    if (!query) return kelimeler;

    /*
     * Eşleşen kalıplar sonuçların sonuna eklenir. Seviye süzgeci onlara da
     * uygulanır: kullanıcı A1 seçtiyse A1 kalıpları görmeli, yoksa süzgeç
     * yalnızca yarı yarıya çalışıyormuş gibi olurdu.
     */
    const eslesenKaliplar = (kaliplar || []).filter(k => {
      if (selectedLevel !== 'ALL' && k.level !== selectedLevel) return false;
      return (
        k.word.toLowerCase().includes(query) ||
        k.turkishMeaning.toLowerCase().includes(query)
      );
    });

    return [...kelimeler, ...eslesenKaliplar];
  }, [
    levelPool,
    partOfSpeechFilter,
    statusFilter,
    searchQuery,
    favorites,
    learningStates,
    kaliplar,
    selectedLevel
  ]);

  // Filtre değişince sayfalama başa döner.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, partOfSpeechFilter, statusFilter, selectedLevel]);

  /*
   * Arama yazılınca liste kendiliğinden açılır: aramanın tek amacı zaten
   * sonucu görmek. Kullanıcıyı arama yaptıktan sonra bir de "listeyi aç"
   * demeye zorlamak gereksiz bir adım olurdu.
   */
  useEffect(() => {
    if (searchQuery.trim()) setIsListOpen(true);
  }, [searchQuery]);

  /*
   * ARAMA KALIPLARI DA KAPSAR.
   *
   * Kullanıcı 'give up' aradığında sonuç bulamıyordu: kalıplar ayrı bir
   * bölümde duruyor ve o bölüm açılmadıkça veri hiç inmiyordu. Ama arama
   * kutusuna bir şey yazan kişi 'kelimelerde ara' demiyor, 'bunu bul'
   * diyor — kaynağın hangisi olduğu onun sorunu değil.
   *
   * Veri yine tembel: kalıplar ancak ARAMA BAŞLAYINCA iniyor. Ekranı açan
   * herkese 540 KB indirtmiyoruz, yalnızca arayan kişiye.
   */
  useEffect(() => {
    if (!searchQuery.trim() || kaliplar || kaliplarYukleniyor) return;
    setKaliplarYukleniyor(true);
    loadPhrases()
      .then(() => setKaliplar(getPhraseCards()))
      .finally(() => setKaliplarYukleniyor(false));
  }, [searchQuery, kaliplar, kaliplarYukleniyor]);

  const visibleWords = useMemo(
    () => filteredWords.slice(0, visibleCount),
    [filteredWords, visibleCount]
  );


  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setPartOfSpeechFilter('ALL');
    setStatusFilter('ALL');
  }, []);

  const levelSuffix = selectedLevel === 'ALL' ? '' : ` (${LEVEL_LABEL[selectedLevel]})`;

  if (kalipCalismasi) {
    return (
      <StudyFlashcard
        title="Kalıplar ve deyimler"
        sourceContextName="Oxford Phrase List"
        deckKey={`phrases:${kalipSeviyesi}`}
        words={kalipCalismasi}
        favorites={favorites}
        learningStates={learningStates}
        onToggleFavorite={onToggleFavorite}
        onSetStatus={onSetStatus || (() => {})}
        onBack={() => setKalipCalismasi(null)}
        onOpenAddToCollection={onOpenAddToCollection}
        isCustomDeck={false}
      />
    );
  }

  if (isStudyingFlashcards) {
    return (
      <StudyFlashcard
        title={`Oxford 5000${levelSuffix}`}
        sourceContextName={`Oxford 5000${levelSuffix}`}
        deckKey={`oxford:${selectedLevel}`}
        words={filteredWords.length > 0 ? filteredWords : levelPool.map(item => item.card)}
        favorites={favorites}
        learningStates={learningStates}
        onToggleFavorite={onToggleFavorite}
        onSetStatus={onSetStatus || (() => {})}
        onBack={() => setIsStudyingFlashcards(false)}
        onOpenAddToCollection={onOpenAddToCollection}
        isCustomDeck={false}
      />
    );
  }

  return (
    <div className="space-y-6 pb-safe-nav max-w-[1180px] mx-auto animate-fadeIn">
      {/*
        BAŞLIK VE AÇIKLAMA.

        'Oxford 5000' başlığı yeni kullanıcıya bir şey söylemiyordu; sayı da
        artık eksikti, çünkü listede 750 kalıp da var. 'Oxford Kelime Listesi'
        hem anlaşılır hem kapsayıcı. Açıklama ise asıl soruyu cevaplıyor:
        bunlar kim tarafından, neye göre seçilmiş kelimeler.

        BAŞLIKTAKİ İKİ DÜĞME KALDIRILDI. 'Sesli Dinle' listedeki ilk on
        kelimeyi peş peşe okuyordu; bu bir çalışma yöntemi değil, kartların
        her birinde zaten kendi ses düğmesi var. 'Sınav Başlat' da alt
        menüdeki Sınav sekmesiyle aynı işi yapıyordu.
      */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            Oxford Kelime Listesi
          </h2>
          {selectedLevel !== 'ALL' && <CEFRBadge level={selectedLevel} />}
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
          Oxford Üniversitesi'nin <b className="text-[var(--text-primary)]">seviyelere göre</b>{' '}
          belirlediği kelime ve kalıplar. Kendi seviyeni seçip kelime dağarcığını oradan
          geliştirebilirsin — toplam {levelCounts.ALL.toLocaleString('tr-TR')} kayıt.
        </p>
      </div>

      {/* Filtreler */}
      <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] space-y-4 shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        {/*
          SEVİYE VE KALIPLAR: İKİ AÇILIR MENÜ, YAN YANA.

          Seviyeler yatay kaydırmalı bir düğme şeridiydi; telefonda son
          seviyeler ekran dışında kalıyor ve kaydırılmadıkça görünmüyordu.
          Kalıplar bölümü de sayfanın çok aşağısında, ilgisiz bir yerde
          duruyordu — oysa o da bir çalışma kaynağı, tıpkı seviyeler gibi.
          İkisi artık aynı satırda, aynı biçimde: kullanıcı neyi çalışacağını
          tek bakışta seçiyor.
        */}
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSeviyeMenusuAcik(a => !a);
                setKaliplarAcik(false);
              }}
              aria-expanded={seviyeMenusuAcik}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-between gap-2 transition-colors cursor-pointer"
            >
              <span className="truncate">{LEVEL_LABEL[selectedLevel] || 'Seviye seç'}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[var(--border)] text-[var(--text-secondary)]">
                  {(levelCounts[selectedLevel] || 0).toLocaleString('tr-TR')}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform ${
                    seviyeMenusuAcik ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </button>

            {seviyeMenusuAcik && (
              <div className="absolute left-0 right-0 mt-1.5 z-30 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden">
                {LEVEL_KEYS.map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedLevel(key);
                      setSeviyeMenusuAcik(false);
                    }}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left border-b border-[var(--border-light)] last:border-b-0 cursor-pointer ${
                      selectedLevel === key
                        ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-bold'
                        : 'hover:bg-[var(--surface-soft)] text-[var(--text-primary)] font-semibold'
                    }`}
                  >
                    <span className="text-xs">{LEVEL_LABEL[key]}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {(levelCounts[key] || 0).toLocaleString('tr-TR')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setKaliplarAcik(a => !a);
              setSeviyeMenusuAcik(false);
            }}
            aria-expanded={kaliplarAcik}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
              kaliplarAcik
                ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary-border)]'
                : 'bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
            }`}
          >
            <span className="truncate">Kalıplar ve deyimler</span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                kaliplarAcik ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

      {/*
        KALIPLAR VE DEYİMLER

        Kelimelerin yanında, kendi havuzunda. Oxford 5000'in seviye
        sayaçlarına karışmaz: o sayaçlar kelime sayar ve 750 kalıbı A1–C1
        gruplarına katmak, kullanıcının bitirdiği yüzdeyi geriye götürürdü.

        Veri yalnızca bölüm açıldığında iniyor (~540 KB). Kapalıyken tek bayt
        indirilmez; kullanıcıların çoğu doğrudan kelimelere bakıyor.
      */}
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">

        {kaliplarAcik && (
          <div className="px-4 pb-4 space-y-3 border-t border-[var(--border-light)] pt-3">
            {kaliplarYukleniyor && (
              <p className="text-xs text-[var(--text-secondary)]">Kalıplar yükleniyor…</p>
            )}

            {kaliplar && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {(['ALL', 'A1', 'A2', 'B1', 'B2', 'C1'] as const).map(seviye => {
                    const sayi =
                      seviye === 'ALL'
                        ? kaliplar.length
                        : kaliplar.filter(k => k.level === seviye).length;
                    const secili = kalipSeviyesi === seviye;
                    return (
                      <button
                        key={seviye}
                        type="button"
                        onClick={() => setKalipSeviyesi(seviye)}
                        aria-pressed={secili}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                          secili
                            ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--surface)]'
                            : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]'
                        }`}
                      >
                        {seviye === 'ALL' ? 'Tümü' : seviye} {sayi}
                      </button>
                    );
                  })}
                </div>

                {gorunenKaliplar.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setKalipCalismasi(gorunenKaliplar)}
                    className="w-full py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--surface)] text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Bu {gorunenKaliplar.length} kalıbı kartlarla çalış
                  </button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {gorunenKaliplar.slice(0, 60).map(kalip => (
                    <WordCardComponent
                      key={kalip.id}
                      card={kalip}
                      isFavorite={favorites.includes(kalip.id)}
                      learningState={learningStates[kalip.id]}
                      onToggleFavorite={onToggleFavorite}
                      onToggleLearned={onToggleLearned}
                      onSetStatus={onSetStatus}
                      onOpenAddToCollection={onOpenAddToCollection}
                      onReportWord={onReportWord}
                    />
                  ))}
                </div>

                {/*
                  Liste 60'ta kesiliyor ve bu SÖYLENİYOR. Sessizce kesmek,
                  kullanıcıya "hepsi bu kadar" dedirtir; oysa çoğu hâlâ orada.
                */}
                {gorunenKaliplar.length > 60 && (
                  <p className="text-[11px] text-[var(--text-muted)] text-center">
                    İlk 60 kalıp gösteriliyor. Kalan {gorunenKaliplar.length - 60} kalıp
                    kartlarla çalışmada ve aramada karşına çıkar.
                  </p>
                )}
              </>
            )}
          </div>
        )}
        </div>

        {/*
         * Durum özeti. Her sayı bir düğmedir: kullanıcı "30 Öğrendim"e
         * dokununca liste o otuz kelimeye iner.
         */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)] text-xs">
          <div className="text-[var(--text-secondary)] font-medium">
            Toplam <strong className="text-[var(--text-primary)]">{levelStats.total}</strong> kelime içinde:
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'LEARNED' ? 'ALL' : 'LEARNED')}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer border ${
                statusFilter === 'LEARNED'
                  ? 'bg-[var(--learned)] text-[var(--surface)] border-[var(--learned)]'
                  : 'text-[var(--learned)] border-transparent hover:bg-[var(--learned-soft-hover)]'
              }`}
            >
              {/* Renk tek başına ayırt etmiyor; biçim de taşınıyor. */}
              <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
              {levelStats.learnedCount} Öğrendim
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'LEARNING' ? 'ALL' : 'LEARNING')}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer border ${
                statusFilter === 'LEARNING'
                  ? 'bg-[var(--learning)] text-[var(--surface)] border-[var(--learning)]'
                  : 'text-[var(--learning)] border-transparent hover:bg-[var(--learning-soft-hover)]'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
              {levelStats.learningCount} Tekrar Et
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'UNSEEN' ? 'ALL' : 'UNSEEN')}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer border ${
                statusFilter === 'UNSEEN'
                  ? 'bg-[var(--text-secondary)] text-[var(--bg)] border-[var(--text-secondary)]'
                  : 'text-[var(--text-muted)] border-transparent hover:bg-[var(--surface-soft)]'
              }`}
            >
              {levelStats.unseenCount} İncelenmedi
            </button>
          </div>
        </div>

        {/* Arama, tür ve durum */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Kelime ya da kalıp ara..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] font-medium text-[var(--text-primary)] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Aramayı temizle"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={partOfSpeechFilter}
            onChange={e => setPartOfSpeechFilter(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] font-medium text-[var(--text-primary)]"
          >
            <option value="ALL">Tüm Sözcük Türleri</option>
            <option value="n.">İsimler (n.)</option>
            <option value="v.">Fiiller (v.)</option>
            <option value="adj.">Sıfatlar (adj.)</option>
            <option value="adv.">Zarflar (adv.)</option>
            <option value="prep.">Edatlar (prep.)</option>
            <option value="conj.">Bağlaçlar (conj.)</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full py-2 px-3 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] font-medium text-[var(--text-primary)]"
          >
            <option value="ALL">Tümü</option>
            <option value="LEARNED">✓ Öğrendiklerim</option>
            <option value="LEARNING">↻ Tekrar Etmem Gerekenler</option>
            <option value="UNSEEN">İncelenmedi</option>
            <option value="FAVORITES">♥ Favorilerim</option>
          </select>
        </div>
      </div>

      {/* Kartlarla çalış */}
      {filteredWords.length > 0 && (
        <button
          type="button"
          onClick={() => setIsStudyingFlashcards(true)}
          className="w-full p-4 sm:p-5 bg-[var(--primary-soft)] hover:bg-[var(--primary-soft-strong)] border-2 border-[var(--primary-border)] hover:border-[var(--primary)] rounded-2xl transition-all cursor-pointer text-left flex items-center justify-between group shadow-xs active:scale-[0.99]"
        >
          <div className="space-y-0.5">
            <div className="text-base sm:text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] flex items-center gap-2">
              <span>Kartlarla Çalış</span>
              <span className="text-[var(--primary)]">→</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Şimdi çalışmaya başla ({filteredWords.length} kelime)
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </button>
      )}

      {/* Kelime listesi — açıp kapanabilir */}
      {filteredWords.length > 0 && (
        <button
          type="button"
          onClick={() => setIsListOpen(open => !open)}
          aria-expanded={isListOpen}
          className="w-full p-4 bg-[var(--surface)] hover:bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl transition-colors cursor-pointer flex items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block text-sm font-bold text-[var(--text-primary)]">
              {isListOpen ? 'Listeyi kapat' : 'Tüm kelimeleri listele'}
            </span>
            <span className="block text-xs text-[var(--text-secondary)] mt-0.5">
              {isListOpen
                ? 'Çalışmaya dönmek için kapatabilirsin'
                : `${filteredWords.length} kelimeyi tek tek gör`}
            </span>
          </span>
          <ChevronDown
            className={`w-5 h-5 text-[var(--text-muted)] shrink-0 transition-transform ${
              isListOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}


      {isListOpen && filteredWords.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {visibleWords.map(word => (
              <WordCardComponent
                key={word.id}
                card={word}
                isFavorite={favorites.includes(word.id)}
                learningState={learningStates[word.id]}
                onToggleFavorite={onToggleFavorite}
                onToggleLearned={onToggleLearned}
                onSetStatus={onSetStatus}
                onOpenAddToCollection={onOpenAddToCollection}
                onReportWord={onReportWord}
              />
            ))}
          </div>

          {visibleCount < filteredWords.length && (
            <button
              type="button"
              onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
              className="w-full py-3 bg-[var(--surface)] hover:bg-[var(--surface-soft)] text-[var(--primary)] border border-[var(--border)] font-semibold text-xs rounded-2xl transition-colors cursor-pointer"
            >
              Daha fazla göster ({filteredWords.length - visibleCount} kelime kaldı)
            </button>
          )}
        </>
      ) : filteredWords.length === 0 ? (
        <div className="text-center py-16 bg-[var(--surface)] rounded-2xl border border-[var(--border)] space-y-3">
          <BookOpen className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">Eşleşen kelime bulunamadı</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
            Arama kriterlerinizi veya filtreleri temizleyerek tüm kelimeleri görebilirsiniz.
          </p>
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-[var(--surface-soft)] hover:bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Filtreleri Temizle
          </button>
        </div>
      ) : null}
    </div>
  );
};
