import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { WordCard, Level, LearningState } from '../types';
import { OxfordGroupKey } from '../types/oxford';
import { WordCardComponent } from './WordCard';
import { loadPhrases, getPhraseCards } from '../services/phraseRepository';
import { StudyFlashcard } from './study/StudyFlashcard';
import { X, Check } from 'lucide-react';
import { getUserWordStatus } from '../utils/storageV2';
import { aramaAnahtari } from '../utils/aramaAnahtari';
import { CEFRBadge } from './ui/CEFRBadge';
import { RealmsIcon } from './ui/RealmsIcon';

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

/** Kalıp seviye menüsünün etiketleri. */
const KALIP_ETIKET: Record<string, string> = {
  ALL: 'Tüm seviyeler',
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
  C1: 'C1'
};

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
   * Kalıplar ve deyimler. Veri, kalıp menüsüne dokunulana ya da arama
   * yapılana kadar hiç indirilmez; 750 kalıp ~540 KB tutuyor ve
   * kullanıcıların çoğu doğrudan kelimelere bakıyor. İndikten sonra
   * bellekte kalır, ikinci açılış bedava.
   */
  const [kaliplar, setKaliplar] = useState<WordCard[] | null>(null);
  const [kaliplarYukleniyor, setKaliplarYukleniyor] = useState(false);
  const [kalipSeviyesi, setKalipSeviyesi] = useState<Level | 'ALL'>('ALL');

  /*
   * HANGİ LİSTE ÇALIŞILIYOR?
   *
   * Ekranda iki ayrı kaynak var: Oxford kelimeleri ve Oxford kalıpları.
   * Önceki düzende kalıplar kendi bölümünde, kendi küçük listesiyle
   * duruyordu; kullanıcı aynı ekranda iki farklı mantıkla karşılaşıyordu —
   * kelimelerde arama, süzgeç ve kart çalışması vardı, kalıplarda yoktu.
   *
   * Artık tek bir 'aktif kaynak' var. Kullanıcı hangi listeden seviye
   * seçerse alttaki her şey — bilgilendirme kutusu, arama, kartlarla çalış
   * ve liste — o kaynağa göre çalışır. İki liste, tek davranış.
   */
  const [aktifKaynak, setAktifKaynak] = useState<'kelime' | 'kalip'>('kelime');

  /** Açılır menülerin durumu; ikisi aynı anda açık kalmaz. */
  const [seviyeMenusuAcik, setSeviyeMenusuAcik] = useState(false);
  const [kalipMenusuAcik, setKalipMenusuAcik] = useState(false);

  /** Kalıp verisi ihtiyaç duyulduğunda indirilir. */
  const kaliplariGetir = () => {
    if (kaliplar || kaliplarYukleniyor) return;
    setKaliplarYukleniyor(true);
    loadPhrases()
      .then(() => setKaliplar(getPhraseCards()))
      .finally(() => setKaliplarYukleniyor(false));
  };

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

  /**
   * Bilgilendirme kutusunun sayıları.
   *
   * AKTİF KAYNAĞA GÖRE hesaplanır: kullanıcı kalıplardan bir seviye seçtiyse
   * kutu kalıpları sayar, kelimelerden seçtiyse kelimeleri. İki listeyi aynı
   * kutuda toplamak, "500 kelime içinde 3 öğrendim" gibi hangi listeye ait
   * olduğu belirsiz bir sayı üretirdi.
   */
  const levelStats = useMemo(() => {
    const kartlar =
      aktifKaynak === 'kalip'
        ? (kaliplar || []).filter(k =>
            kalipSeviyesi === 'ALL' ? true : k.level === kalipSeviyesi
          )
        : levelPool.map(item => item.card);

    let learnedCount = 0;
    let learningCount = 0;
    let unseenCount = 0;
    kartlar.forEach(card => {
      const status = getUserWordStatus(card.id, learningStates);
      if (status === 'learned') learnedCount++;
      else if (status === 'learning') learningCount++;
      else unseenCount++;
    });
    return { total: kartlar.length, learnedCount, learningCount, unseenCount };
  }, [levelPool, learningStates, aktifKaynak, kaliplar, kalipSeviyesi]);

  /**
   * Ekranda gösterilecek kartlar.
   *
   * Aktif kaynak 'kalip' ise Oxford kelimeleri hiç işlenmez; kullanıcı
   * kalıpları çalışmayı seçmiştir. Arama ve durum süzgeci her iki kaynakta
   * da aynı şekilde işler — kullanıcı için tek bir davranış var.
   */
  const filteredWords = useMemo(() => {
    const query = aramaAnahtari(searchQuery);

    /*
     * DURUM SÜZGECİ TEK YERDEN GEÇER.
     *
     * Aynı kontrol üç ayrı yere kopyalanmıştı ve biri — arama sonuçlarının
     * sonuna eklenen kalıplar — unutulmuştu. "♥ Favorilerim" ya da
     * "✓ Öğrendiklerim" seçiliyken 'give' aratan kullanıcı, hiç
     * favorilemediği 'give up', 'give in' kartlarını hem listede hem de
     * "Kartlarla Çalış" destesinde buluyordu; süzgeç açıkken süzgece
     * uymayan kart görmek, sayılara olan güveni bitiriyor. Tek fonksiyon,
     * üç çağrı: bir daha ayrışamaz.
     */
    const durumUyuyor = (id: string) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'FAVORITES') return favorites.includes(id);
      const status = getUserWordStatus(id, learningStates);
      if (statusFilter === 'LEARNED') return status === 'learned';
      if (statusFilter === 'LEARNING') return status === 'learning';
      return status === 'unseen';
    };

    if (aktifKaynak === 'kalip') {
      return (kaliplar || [])
        .filter(k => (kalipSeviyesi === 'ALL' ? true : k.level === kalipSeviyesi))
        .filter(k => {
          if (!durumUyuyor(k.id)) return false;
          if (!query) return true;
          return (
            aramaAnahtari(k.word).includes(query) ||
            aramaAnahtari(k.turkishMeaning).includes(query)
          );
        });
    }

    const kelimeler = levelPool
      .filter(({ card }) => {
        if (
          partOfSpeechFilter !== 'ALL' &&
          !card.partOfSpeech.toLowerCase().includes(partOfSpeechFilter.toLowerCase())
        ) {
          return false;
        }

        if (!durumUyuyor(card.id)) return false;

        if (query) {
          return (
            aramaAnahtari(card.word).includes(query) ||
            aramaAnahtari(card.turkishMeaning).includes(query)
          );
        }

        return true;
      })
      .map(item => item.card);

    if (!query) return kelimeler;

    /*
     * SÖZCÜK TÜRÜ SEÇİLİYSE KALIP EKLENMEZ.
     *
     * Kalıpların sözcük türü sabit 'phrase'; menüdeki hiçbir seçenek
     * (n., v., adj. …) onunla eşleşmez. Tür süzgeci açıkken kelimeler
     * elenip kalıplar yine listeye girdiğinde kullanıcı "Fiiller" seçmesine
     * rağmen fiil olmayan kartlar görüyordu.
     */
    if (partOfSpeechFilter !== 'ALL') return kelimeler;

    /*
     * Eşleşen kalıplar sonuçların sonuna eklenir. Seviye VE durum süzgeci
     * onlara da uygulanır: kullanıcı A1 seçtiyse A1 kalıpları görmeli,
     * "Öğrendiklerim" seçtiyse yalnızca öğrendiği kalıpları — yoksa süzgeç
     * yalnızca yarı yarıya çalışıyormuş gibi olurdu.
     */
    const eslesenKaliplar = (kaliplar || []).filter(k => {
      if (selectedLevel !== 'ALL' && k.level !== selectedLevel) return false;
      if (!durumUyuyor(k.id)) return false;
      return (
        aramaAnahtari(k.word).includes(query) ||
        aramaAnahtari(k.turkishMeaning).includes(query)
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
    selectedLevel,
    aktifKaynak,
    kalipSeviyesi
  ]);

  /*
   * Filtre, kaynak ya da seviye değişince sayfalama başa döner.
   *
   * `aktifKaynak` ile `kalipSeviyesi` bağımlılıklarda yoktu: "Daha fazla
   * göster"e defalarca basıp listeyi yüzlerce karta çıkaran kullanıcı
   * kalıplara (ya da başka bir kalıp seviyesine) geçtiğinde yeni listenin
   * o kadarı tek render'da DOM'a basılıyordu — PAGE_SIZE'ın önlemek için
   * var olduğu donma geri geliyordu.
   */
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    searchQuery,
    partOfSpeechFilter,
    statusFilter,
    selectedLevel,
    aktifKaynak,
    kalipSeviyesi
  ]);

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

  /*
   * KALIP DESTESİ KENDİ KİMLİĞİNİ TAŞIR.
   *
   * Kart çalışması "kaldığın yer"i `deckKey` altında saklıyor. Kalıp destesi
   * kelime destesinin kimliğini kullandığı için kalıp çalışmak, Oxford
   * kelimelerinde kalınan yeri siliyordu; üstelik başlıkta kalıp seviyesi
   * yerine kelime seviyesi yazıyordu. İki liste iki ayrı deste.
   */
  const kalipMi = aktifKaynak === 'kalip';
  const kalipSuffix = kalipSeviyesi === 'ALL' ? '' : ` (${KALIP_ETIKET[kalipSeviyesi]})`;
  const desteBasligi = kalipMi
    ? `Kalıplar ve Deyimler${kalipSuffix}`
    : `Oxford 5000${levelSuffix}`;
  const desteKimligi = kalipMi ? `phrases:${kalipSeviyesi}` : `oxford:${selectedLevel}`;

  /*
   * KALIP SAYILARI VERİ GELMEDEN YAZILMAZ.
   *
   * Kalıp menüsü, veriyi indiren tıklamayla aynı karede açılıyor; o an
   * `kaliplar` henüz null olduğu için altı seviyenin de yanında "0"
   * yazıyordu. Kullanıcı bunu "bu seviyede kalıp yok" diye okuyor, üstelik
   * o pencerede bir seviyeye dokunursa bilgilendirme kutusu da "Toplam 0
   * kalıp içinde: 0 Öğrendim" diyordu. Bilinmeyen sayı yerine 0 basmak
   * kullanıcıya doğrudan yanlış bilgi vermek; sayı bilinene kadar bekleme
   * işareti duruyor.
   *
   * Boş dizi de "hazır değil" sayılır: phrases.json'da her seviyede kayıt
   * var, dolayısıyla boş dizi ancak indirme düştüğünde oluşur.
   */
  const kalipVerisiHazir = kaliplar !== null && kaliplar.length > 0;
  const kalipSayisiYaz = (sayi: number) =>
    !kalipMi || kalipVerisiHazir ? sayi.toLocaleString('tr-TR') : '…';

  if (isStudyingFlashcards) {
    return (
      <StudyFlashcard
        title={desteBasligi}
        sourceContextName={desteBasligi}
        deckKey={desteKimligi}
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

        SAHNE ŞERİDİ KALDIRILDI. Buradaki kuzgun-harita şeridi ana sayfanın
        ikinci tanıtım kartındakiyle aynı sahneydi; kullanıcı Ana Sayfa'dan
        Oxford'a geçtiğinde aynı görseli arka arkaya iki kez görüyordu.
        Referanstaki sayfa başlangıcı da doğrudan başlıkla açılıyor.
      */}
      <div className="parsomen-panel bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)]">
        <div className="flex items-center gap-2">
          <h2 className="baslik-yazit text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
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
      <div className="parsomen-panel bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] space-y-4 shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        {/*
          İKİ LİSTE, İKİ SATIR, AYNI BİÇİM.

          Ekranda iki ayrı çalışma kaynağı var: Oxford kelimeleri ve Oxford
          kalıpları. Önceki düzende kalıplar kendi bölümünde, kendi küçük
          listesiyle duruyordu — kelimelerde arama, süzgeç ve kart çalışması
          vardı, kalıplarda yoktu. Aynı ekranda iki farklı mantık.

          Artık ikisi de aynı görünüyor ve aynı davranıyor: hangisinden
          seviye seçilirse alttaki her şey — bilgilendirme kutusu, arama,
          kartlarla çalış ve liste — o kaynağa göre çalışıyor.
        */}
        <div className="space-y-2.5">
          {/*
            ETİKET VE MENÜ YAN YANA.

            `justify-between` ikisini iki uca itiyordu: etiket solda, menü
            sağ kenarda, arada boşluk. Aynı satırdaki iki parça birbirine ait
            olduğunda araya boşluk koymak, hangi menünün hangi etikete ait
            olduğunu okumayı zorlaştırıyor.
          */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-primary)] shrink-0">
              Oxford Kelime Listesi:
            </span>
            <div className="relative flex-1 min-w-0 max-w-[190px]">
              <button
                type="button"
                onClick={() => {
                  setSeviyeMenusuAcik(a => !a);
                  setKalipMenusuAcik(false);
                }}
                aria-expanded={seviyeMenusuAcik}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  aktifKaynak === 'kelime'
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary-border)]'
                    : 'bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
                }`}
              >
                <span className="truncate">{LEVEL_LABEL[selectedLevel]}</span>
                <RealmsIcon name="chevron-down" size={18} className="shrink-0 transition-transform ${ seviyeMenusuAcik ? 'rotate-180' : '' }" />
              </button>

              {seviyeMenusuAcik && (
                <div className="absolute left-0 right-0 mt-1.5 z-30 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden">
                  {LEVEL_KEYS.map(key => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedLevel(key);
                        setAktifKaynak('kelime');
                        setSeviyeMenusuAcik(false);
                      }}
                      className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left border-b border-[var(--border-light)] last:border-b-0 cursor-pointer ${
                        aktifKaynak === 'kelime' && selectedLevel === key
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
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-primary)] shrink-0">
              Kalıplar ve Deyimler:
            </span>
            <div className="relative flex-1 min-w-0 max-w-[190px]">
              <button
                type="button"
                onClick={() => {
                  kaliplariGetir();
                  setKalipMenusuAcik(a => !a);
                  setSeviyeMenusuAcik(false);
                }}
                aria-expanded={kalipMenusuAcik}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  aktifKaynak === 'kalip'
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary-border)]'
                    : 'bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
                }`}
              >
                <span className="truncate">
                  {kaliplarYukleniyor ? 'Yükleniyor…' : KALIP_ETIKET[kalipSeviyesi]}
                </span>
                <RealmsIcon name="chevron-down" size={18} className="shrink-0 transition-transform ${ kalipMenusuAcik ? 'rotate-180' : '' }" />
              </button>

              {kalipMenusuAcik && (
                <div className="absolute left-0 right-0 mt-1.5 z-30 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden">
                  {(['ALL', 'A1', 'A2', 'B1', 'B2', 'C1'] as const).map(seviye => {
                    const sayi =
                      seviye === 'ALL'
                        ? (kaliplar || []).length
                        : (kaliplar || []).filter(k => k.level === seviye).length;
                    return (
                      <button
                        key={seviye}
                        type="button"
                        onClick={() => {
                          setKalipSeviyesi(seviye);
                          setAktifKaynak('kalip');
                          setKalipMenusuAcik(false);
                        }}
                        className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left border-b border-[var(--border-light)] last:border-b-0 cursor-pointer ${
                          aktifKaynak === 'kalip' && kalipSeviyesi === seviye
                            ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-bold'
                            : 'hover:bg-[var(--surface-soft)] text-[var(--text-primary)] font-semibold'
                        }`}
                      >
                        <span className="text-xs">{KALIP_ETIKET[seviye]}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {kalipVerisiHazir ? sayi.toLocaleString('tr-TR') : '…'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/*
         * Durum özeti. Her sayı bir düğmedir: kullanıcı "30 Öğrendim"e
         * dokununca liste o otuz kelimeye iner.
         */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)] text-xs">
          {/*
            KUTU NEYE BAKTIĞINI SÖYLÜYOR.

            Eskiden yalnızca "Toplam 125 kelime içinde" yazıyordu. İki listede
            de A1–C1 seviyeleri olduğu için bu sayının hangi listeye ve hangi
            seviyeye ait olduğu belirsizdi; kalıplar seçiliyken bile "kelime"
            deniyordu. Üstteki seçim ne ise burada aynen tekrarlanıyor.
          */}
          <div className="text-[var(--text-secondary)] font-medium">
            <span className="font-bold text-[var(--text-primary)]">
              {kalipMi ? 'Kalıplar ve Deyimler' : 'Oxford Kelime Listesi'}
            </span>{' '}
            · {kalipMi
              ? kalipSeviyesi === 'ALL'
                ? 'tüm seviyeler'
                : `${KALIP_ETIKET[kalipSeviyesi]} seviyesi`
              : selectedLevel === 'ALL'
                ? 'tüm seviyeler'
                : `${LEVEL_LABEL[selectedLevel]} seviyesi`}
            <br />
            Toplam{' '}
            <strong className="text-[var(--text-primary)]">
              {kalipSayisiYaz(levelStats.total)}
            </strong>{' '}
            {kalipMi ? 'kalıp' : 'kelime'} içinde:
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
              {kalipSayisiYaz(levelStats.learnedCount)} Öğrendim
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'LEARNING' ? 'ALL' : 'LEARNING')}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer border ${
                statusFilter === 'LEARNING'
                  ? 'bg-[var(--learning-fill)] text-[var(--on-learning)] border-[var(--learning)]'
                  : 'text-[var(--learning-text)] border-transparent hover:bg-[var(--learning-soft-hover)]'
              }`}
            >
              <RealmsIcon name="repeat" size={18} className="stroke-[3]" aria-hidden="true" />
              {kalipSayisiYaz(levelStats.learningCount)} Tekrar Et
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
              {kalipSayisiYaz(levelStats.unseenCount)} İncelenmedi
            </button>
          </div>
        </div>

        {/* Arama, tür ve durum */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="relative">
            <RealmsIcon name="search" size={20} className="text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
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
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
            <RealmsIcon name="play" size={20} className="fill-current ml-0.5" />
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
          <RealmsIcon name="chevron-down" size={22} className="text-[var(--text-muted)] shrink-0 transition-transform ${ isListOpen ? 'rotate-180' : '' }" />
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
        /*
         * BOŞ LİSTE HER ZAMAN "SONUÇ YOK" DEMEK DEĞİL.
         *
         * Kalıplar inerken de, hiç inemediğinde de aynı "Eşleşen kelime
         * bulunamadı — filtreleri temizle" kutusu çiziliyordu. Ortada
         * temizlenecek bir filtre olmadığı için o düğme hiçbir şeyi
         * düzeltmiyor, kullanıcıya 750 kalıp hiç yokmuş gibi görünüyordu.
         * Üç durum artık ayrı konuşuyor: yükleniyor, yüklenemedi, sonuç yok.
         */
        kalipMi && kaliplarYukleniyor ? (
          <div className="parsomen-panel text-center py-16 bg-[var(--surface)] rounded-2xl border border-[var(--border)] space-y-3">
            <div className="w-8 h-8 border-3 border-[var(--primary-border)] border-t-[var(--primary)] rounded-full animate-spin mx-auto" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">Kalıplar yükleniyor…</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              Kalıp ve deyim listesi hazırlanıyor, birkaç saniye sürebilir.
            </p>
          </div>
        ) : kalipMi && kaliplar !== null && kaliplar.length === 0 ? (
          /*
           * Yükleme düştü. Dönen çark göstermeye devam etmek yalan olurdu:
           * beklenen bir şey yok. "Yeniden dene" düğmesi de konmadı, çünkü
           * kalıp verisi katmanı sonucu önbelleğe yazdığı için aynı oturumda
           * ikinci deneme yapılamıyor; kullanıcıya işe yarayan tek çıkış
           * söyleniyor (App.tsx'teki "Sözlük yüklenemedi" ekranının eşi).
           */
          <div className="parsomen-panel text-center py-16 bg-[var(--surface)] rounded-2xl border border-[var(--border)] space-y-3">
            <RealmsIcon name="book" size={22} className="text-[var(--text-muted)] mx-auto" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">Kalıplar yüklenemedi</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              Kalıp verisi açılamadı. Uygulamayı tamamen kapatıp yeniden açmak
              çoğu durumda yeterli oluyor.
            </p>
          </div>
        ) : (
          <div className="parsomen-panel text-center py-16 bg-[var(--surface)] rounded-2xl border border-[var(--border)] space-y-3">
            <RealmsIcon name="book" size={22} className="text-[var(--text-muted)] mx-auto" />
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
        )
      ) : null}
    </div>
  );
};
