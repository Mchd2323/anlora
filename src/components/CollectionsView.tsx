import React, { useState, useMemo, useEffect, useCallback, useId, useRef, startTransition } from 'react';
import {
  Collection,
  CollectionMembership,
  WordCard,
  LearningState,
  DuplicateCheckResult,
  Level
} from '../types';
import { WordCardComponent } from './WordCard';
import { StudyFlashcard } from './study/StudyFlashcard';
import { Layers, Search, Sparkles, BookOpen, GraduationCap, Tv, Briefcase, Plane, Merge, MoveRight, X, Pin, Trash2, Edit2, Copy, FileText, Check, CheckCircle2, Loader2, AlertCircle, GitMerge, ArrowUp, ArrowDown, WifiOff } from 'lucide-react';
import { getPhraseCard } from '../services/phraseRepository';
import { DeckOptionFields, DeckOptionValues } from './collections/DeckOptionFields';
import { SET_RENKLERI, setPaletteId, setRengi } from '../theme/setColors';
import { BatchWordModal } from './BatchWordModal';
import { TextMinerModal } from './TextMinerModal';
import { useModalA11y } from '../hooks/useModalA11y';
import { DuplicateWarningModal } from './DuplicateWarningModal';
import { detectWordDuplicate } from '../utils/duplicateDetector';
import { aramaAnahtari } from '../utils/aramaAnahtari';
import { useToast } from './ui/ToastProvider';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { speakText } from '../utils/speech';
import { getUserWordStatus } from '../utils/storageV2';
import { UserProfile } from '../types';
import { apiUrl } from '../config/api';
import { useRemoteApi } from '../hooks/useRemoteApi';
import { formatPhonetic } from '../utils/phonetic';
import { reportMissingWord } from '../services/usageReporter';
import { RealmsIcon } from './ui/RealmsIcon';
import { SahneSeridi } from './ui/SahneSeridi';
import { SayfaAtlama } from './ui/SayfaAtlama';
import { GorunumSecici, type Gorunum } from './ui/GorunumSecici';
import { KelimeSatiri } from './KelimeSatiri';
import {
  hasExtendedWord,
  getExtendedCard,
  loadExtendedIndex,
  extendedKelimeler
} from '../services/extendedRepository';
import { yazimOnerileri } from '../utils/yazimOnerisi';
import type { TopluIlerleme } from '../hooks/useTopluKuyruk';
import { settekiKalan } from '../services/topluKuyruk';

interface CollectionsViewProps {
  collections: Collection[];
  memberships: CollectionMembership[];
  customWords: WordCard[];
  oxfordWords: WordCard[];
  /*
   * SÖZLÜK DURUMU ÜÇ DEĞERLİ, İKİ DEĞİLDİR.
   *
   * Bu ekran sözlüğe bağımlı: sete giren bir Oxford kelimesi kopyalanmaz,
   * ÜYELİK olarak yazılır (bkz. `activeDeckWords`), kartın kendisi
   * `oxfordWords` içinden çözülür. Sözlük 3 MB + 1,9 MB iki JSON olduğu için
   * her soğuk açılışta birkaç yüz ms ile birkaç saniye arası gecikmeli gelir.
   *
   * Tek bir `hazir: boolean` yetmez: "daha gelmedi" ile "hiç gelmeyecek"
   * kullanıcıya aynı şeyi söyleyemez. Birincisinde beklemek, ikincisinde
   * yeniden denemek gerekir. Bunlar tek bayrağa katlanırsa ekran bekleme
   * sırasında hata, hatadan sonra da sonsuza kadar bekleme gösterir.
   */
  sozlukDurumu?: 'yukleniyor' | 'hazir' | 'hata';
  /** Sözlük yüklenemediyse yeniden denemeyi tetikler. */
  onSozlugüYenidenDene?: () => void;
  /*
   * Arka planda süren toplu ekleme. Koşucu uygulamanın kökünde duruyor;
   * bu ekran yalnızca durumu GÖSTERİYOR, yönetmiyor.
   */
  topluIlerleme?: TopluIlerleme;
  /** Yapay zekâ ile üretilecek kelimeleri arka plan kuyruğuna verir. */
  onTopluKuyrugaEkle?: (setId: string, setAdi: string, kelimeler: string[]) => void;
  /** Hatırlatmaya dokununca kelime listesini açar. */
  onTopluDetay?: () => void;
  learningStates: Record<string, LearningState>;
  favorites: string[];
  profile?: UserProfile;
  onToggleFavorite: (id: string) => void;
  onCreateCollection: (name: string, description?: string, color?: string, iconName?: string) => Collection;
  onUpdateCollection: (deck: Collection) => void;
  /** Seti listede bir sıra yukarı/aşağı taşır. */
  onMoveCollection?: (id: string, yon: 'yukari' | 'asagi') => void;
  onDeleteCollection: (id: string) => void;
  onAddCustomWord: (card: WordCard, collectionId?: string, sourceContext?: string, sourceName?: string) => void;
  onUpdateCustomWord: (card: WordCard) => void;
  onDeleteCustomWord: (id: string) => void;
  onAddWordToCollection: (wordId: string, collectionId: string, sourceContext?: string, sourceName?: string) => void;
  onRemoveWordFromCollection: (wordId: string, collectionId: string) => void;
  onStartStudySession: (collectionId?: string) => void;
  onStartQuiz: (collectionId?: string) => void;
  onOpenEditModal: (card: WordCard) => void;
  onOpenAddToCollection: (card: WordCard) => void;
  onSetWordStatus?: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
}

/**
 * CEFR seviyeleri, kolaydan zora.
 *
 * Hem "Seviyeye göre" sıralaması hem de CSV içe aktarması aynı listeye
 * bakar: ikisi ayrı yazılsaydı biri değiştiğinde diğeri sessizce geride
 * kalırdı.
 */
const SEVIYELER: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const DECK_ICONS: { id: string; label: string; Icon: React.ElementType }[] = [
  { id: 'Layers', label: 'Katman', Icon: Layers },
  { id: 'BookOpen', label: 'Kitap', Icon: BookOpen },
  { id: 'Tv', label: 'Dizi', Icon: Tv },
  { id: 'Briefcase', label: 'İş', Icon: Briefcase },
  { id: 'GraduationCap', label: 'Sınav', Icon: GraduationCap },
  { id: 'Plane', label: 'Seyahat', Icon: Plane }
];



export function DeckIcon({ name, className }: { name?: string; className?: string }) {
  const entry = DECK_ICONS.find(item => item.id === name) || DECK_ICONS[0];
  const Icon = entry.Icon;
  return <Icon className={className} />;
}

/**
 * Girişten tür önerisi.
 *
 * Boşluk ya da tire içeren bir giriş büyük olasılıkla bir kalıptır
 * ('give up', 'side-effect', 'in the long run'). Deyim ile kalıbın sınırı
 * biçimden anlaşılmaz — anlamla ilgilidir — o yüzden 'idiom' asla
 * önerilmez, yalnızca kullanıcı seçerse konur.
 */
function onerilenTur(giris: string): WordCard['entryType'] {
  const temiz = giris.trim();
  if (!temiz) return 'word';
  return /[\s-]/.test(temiz) ? 'phrase' : 'word';
}

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  collections,
  memberships,
  customWords,
  oxfordWords,
  sozlukDurumu = 'hazir',
  onSozlugüYenidenDene,
  topluIlerleme,
  onTopluKuyrugaEkle,
  onTopluDetay,
  learningStates,
  favorites,
  profile,
  onToggleFavorite,
  onCreateCollection,
  onUpdateCollection,
  onMoveCollection,
  onDeleteCollection,
  onAddCustomWord,
  onUpdateCustomWord,
  onDeleteCustomWord,
  onAddWordToCollection,
  onRemoveWordFromCollection,
  onStartStudySession,
  onStartQuiz,
  onOpenEditModal,
  onOpenAddToCollection,
  onSetWordStatus
}) => {
  /*
   * Bu ekranda sunucuya bağlı TEK şey kaldı: sözlükte bulunmayan bir kelime
   * için yapay zekâ ile kart üretmek. Set paylaşımı da buradaydı ama giriş
   * gerektirdiği için üyelikle birlikte kaldırıldı.
   */
  /*
   * ÜÇ DURUM, İKİ DEĞİL.
   *
   * Burada `useRemoteApi('ai') === true` yazıyordu ve bu, "yoklama SÜRÜYOR"
   * (null) durumunu "özellik YOK" (false) ile aynı yere katlıyordu. Kancanın
   * kendi belgesi bunu açıkça yasaklıyor: null gelince arayüz KARARSIZ
   * olmalı.
   *
   * Kullanıcının gördüğü sonuç şuydu: uygulamayı açıp hemen kelime ekleme
   * penceresini açtığında, yoklama daha bitmemişken ekran emin bir dille
   * "Bu kelime sözlükte yok, kendin yazabilirsin" diyordu; birkaç saniye
   * sonra o yazı gidip yerine "Anlora AI ile hazırla" düğmesi geliyordu.
   * Kullanıcı bunu güncellemenin geç gelmesi sandı, oysa uygulama daha
   * bilmediği bir şeyi biliyormuş gibi söylüyordu.
   */
  const yapayZeka = useRemoteApi('ai');
  const yapayZekaVar = yapayZeka === true;
  const yapayZekaBekleniyor = yapayZeka === null;

  /*
   * FORM ALANLARININ KİMLİK ÖNEKİ.
   *
   * Bu ekrandaki etiketlerin hiçbiri girdiye bağlı değildi: TalkBack açıkken
   * "Set Adı" ya da "Türkçe Anlamı" hiç duyurulmuyor, kullanıcı yalnızca boş
   * bir "düzenleme kutusu" duyuyor ve iki metin alanının hangisi olduğunu
   * ayırt edemiyordu. İpucu metni (placeholder) erişilebilir ad yerine geçmez;
   * alan doldurulunca kaybolur. `useId` çakışmayan bir önek verir, böylece
   * aynı pencere iki kez çizilse bile id'ler karışmaz.
   */
  const alanId = useId();

  const [activeDeckId, setActiveDeckId] = useState<string | null>(collections[0]?.id || null);

  /*
   * SET LİSTESİ EN FAZLA ÜÇ SATIR.
   *
   * On set kurmuş kullanıcıda hepsi alt alta diziliyordu; sol sütun ekranı
   * dolduruyor ve aranan seti bulmak gözle tarama gerektiriyordu.
   *
   * Görünecek üçün seçimi rastgele değil, kullanıcının o an ne yaptığına
   * bağlı:
   *   1. Sabitlenmiş setler — kullanıcı bunları kendi eliyle öne çıkardı.
   *   2. Üzerinde çalışılan set — seçtiği şeyin gizlenmesi kafa karıştırırdı.
   *   3. Kalanlar, listedeki sırayla.
   * Üç ya da daha az set varsa açılır menü hiç çizilmez: iki set için menü
   * açtırmak, çözdüğünden fazla iş çıkarır.
   */
  const GORUNEN_SET_SINIRI = 3;
  const [setListesiAcik, setSetListesiAcik] = useState(false);

  /*
   * Liste mi kart mı? Varsayılan KART: kendi setinde kullanıcı genellikle
   * kelimeyi aramaz, üzerinde çalışır. Liste görünümü set büyüdükçe
   * değerleniyor ve bir tık uzakta.
   */
  const [gorunum, setGorunum] = useState<Gorunum>('kart');
  const [acikSatir, setAcikSatir] = useState<string | null>(null);
  const [setAramasi, setSetAramasi] = useState('');

  const { gorunenSetler, gizliSetler } = useMemo(() => {
    if (collections.length <= GORUNEN_SET_SINIRI) {
      return { gorunenSetler: collections, gizliSetler: [] as Collection[] };
    }

    const secilmis = new Set<string>();
    const gorunen: Collection[] = [];

    const ekle = (deck: Collection) => {
      if (secilmis.has(deck.id) || gorunen.length >= GORUNEN_SET_SINIRI) return;
      secilmis.add(deck.id);
      gorunen.push(deck);
    };

    collections.filter(d => d.isPinned).forEach(ekle);
    const aktif = collections.find(d => d.id === activeDeckId);
    if (aktif) ekle(aktif);
    collections.forEach(ekle);

    return {
      gorunenSetler: gorunen,
      gizliSetler: collections.filter(d => !secilmis.has(d.id))
    };
  }, [collections, activeDeckId]);

  /*
   * Açılır liste GİZLİ setleri değil, TÜM setleri gösterir.
   *
   * 'Diğer N set' derken yalnızca görünmeyenleri listelemek mantıklıydı ama
   * düğme 'Tüm setleri gör' olunca kullanıcı hepsini bekliyor; üçünü dışarıda
   * bırakmak sözünü tutmamak olurdu.
   */
  const aranmisTumSetler = useMemo(() => {
    const q = setAramasi.trim().toLocaleLowerCase('tr');
    if (!q) return collections;
    return collections.filter(d => d.name.toLocaleLowerCase('tr').includes(q));
  }, [collections, setAramasi]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isStudyingFlashcards, setIsStudyingFlashcards] = useState(false);

  // Modals & Popups
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showMinerModal, setShowMinerModal] = useState(false);
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  /** Son eklenen kelime; arka arkaya ekleme akışında geri bildirim için. */
  const [lastAddedWord, setLastAddedWord] = useState<string | null>(null);
  // Bu iki modal bileşenin içinde tanımlı olduğu için ortak modal kancasını
  // burada kullanıyoruz: Escape ile kapanma, odak tuzağı ve odak dönüşü.
  const createModalRef = useModalA11y(showCreateModal, () => setShowCreateModal(false));
  const addWordModalRef = useModalA11y(showAddWordModal, () => resetAddWordModal());

  // 3-dots menu dropdown state
  const [openMenuDeckId, setOpenMenuDeckId] = useState<string | null>(null);

  // New Word Addition Flow State
  const [wordInput, setWordInput] = useState('');
  const [contextInput, setContextInput] = useState('');
  /*
   * Kelime ekleme akışı.
   *
   * Önceki sürümde ilk ekran bir seçim ekranıydı: "AI ile hazırla" ya da
   * "kendim hazırlayacağım". Kullanıcı kelimeyi zaten yazmışken bir de yöntem
   * seçmek zorunda kalıyor, elle eklemek iki adım sürüyordu. Artık ilk ekran
   * doğrudan formun kendisidir; yapay zekâ, formun altındaki tek alternatif
   * olarak durur.
   */
  const [creationMode, setCreationMode] = useState<'FORM' | 'AI_GENERATING' | 'AI_PREVIEW'>('FORM');
  const [aiError, setAiError] = useState<string | null>(null);
  /*
   * Yazım önerisi varken yapay zekâ düğmesine basıldı mı?
   *
   * Öneri kutusu zaten düğmenin hemen üstünde duruyor, ama görmek ile
   * onaylamak aynı şey değil: kullanıcı doğrudan düğmeye uzanabilir. Bu
   * bayrak açıkken kutu soruya dönüşüyor ("bunu mu demek istedin?") ve iki
   * çıkış sunuyor. Kapı DEĞİL: ikinci dokunuş kendi yazdığıyla devam ettirir.
   */
  const [yazimOnayBekliyor, setYazimOnayBekliyor] = useState(false);
  /*
   * Yapay zekâ "bu bir İngilizce kelime değil" dediyse: uyarı ve varsa
   * onun önerdiği kelime. Yerel listede aday bulunamadığında tek denetim bu.
   */
  const [yapayZekaYazimUyarisi, setYapayZekaYazimUyarisi] = useState<
    { onerilen: string } | null
  >(null);
  const [generatedPreviewCard, setGeneratedPreviewCard] = useState<WordCard | null>(null);

  // Manual Form State
  const [manualTurkishMeaning, setManualTurkishMeaning] = useState('');
  /** Sözcük türü isteğe bağlıdır; boş dize "belirtilmedi" demektir. */
  const [manualPartOfSpeech, setManualPartOfSpeech] = useState('');
  /**
   * Kaydın türü. Kullanıcı elle değiştirmediyse girişten çıkarılır:
   * boşluk ya da tire içeren bir giriş büyük olasılıkla bir kalıptır.
   * `null` = kullanıcı henüz dokunmadı, öneri geçerli.
   */
  const [manualEntryType, setManualEntryType] = useState<WordCard['entryType'] | null>(null);
  const [manualExamples, setManualExamples] = useState<{ en: string; tr: string }[]>([
    { en: '', tr: '' },
    { en: '', tr: '' }
  ]);

  // Duplicate Resolution State
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  /**
   * Tekrar uyarısını hangi akış tetikledi?
   *
   * "Yine de yeni kart oluştur" seçeneği önceden her durumda yapay zekâ
   * üretimini başlatıyordu; kullanıcı formu elle doldurmuş olsa bile yazdığı
   * bilgiler atılıp AI çalışıyordu. Kaynağı bilmek, kullanıcıyı bıraktığı
   * yerden devam ettirmeyi mümkün kılar.
   */
  const [duplicateOrigin, setDuplicateOrigin] = useState<'FORM' | 'AI'>('FORM');

  /*
   * SÖZLÜK ARAMASI.
   *
   * Kullanıcı İngilizce kelimeyi yazarken uygulamanın kendi sözlüğüne
   * bakılır. Kelime varsa Türkçe anlamı ve üç örnek cümlesi zaten hazırdır;
   * ne yapay zekâya, ne de kullanıcının bir şey yazmasına gerek kalır.
   *
   * Arama iki kaynağa bakar: bellekteki Oxford havuzu ve Genel Dağarcık
   * dizini (~50 KB, açılışta yüklenir). Tam kayıt ancak eşleşme olduğunda,
   * ilgili harf dosyasından getirilir.
   *
   * Sonuç AYNI EKRANDA gösterilir. Önceki sürüm ayrı bir pencere açıp
   * "mevcut kartı bu sete bağla" diyordu; bu hem akışı kesiyor hem de
   * kullanıcının kelime dağarcığında olmayan bir terimle konuşuyordu.
   */
  type LookupResult =
    | { kind: 'idle' }
    | { kind: 'searching' }
    | { kind: 'found'; card: WordCard; source: 'oxford' | 'extended' }
    | { kind: 'in-set'; card: WordCard }
    /*
     * Bulunamadı — ve varsa YAZIM ÖNERİSİ.
     *
     * Öneriler burada duruyor, ayrı bir state'te değil: ikisi tek bir aramanın
     * sonucu ve ayrı tutulursa kaçınılmaz olarak birbirinden şaşar (kullanıcı
     * yeni harf yazar, sonuç yenilenir ama eski öneri ekranda kalır).
     */
    | { kind: 'not-found'; oneriler: string[] };

  const [lookup, setLookup] = useState<LookupResult>({ kind: 'idle' });

  // Deck Form State
  const [newDeckName, setNewDeckName] = useState('');
  /*
   * Yeni setin görünüm seçenekleri.
   *
   * Oluşturma penceresi yalnızca ad ve açıklama istiyordu; rengi, simgeyi ya
   * da sıralamayı seçmek için kullanıcının seti önce kurup sonra düzenlemesi
   * gerekiyordu. Aynı işi iki adıma bölmek, seçeneği hiç sunmamaktan da kötü:
   * kullanıcı özelliğin var olduğunu ancak tesadüfen öğreniyordu.
   */
  const [newDeckOptions, setNewDeckOptions] = useState<DeckOptionValues>({});
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [editingDeck, setEditingDeck] = useState<Collection | null>(null);

  /*
   * TOPLU SEÇİM.
   *
   * Seçim aktif setle birlikte sıfırlanır: başka bir sete geçip önceki
   * setten seçili kalan kelimeleri yanlışlıkla silmek, geri alınamaz bir
   * kaza olurdu.
   */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Set içi tür süzgeci: hepsi / yalnızca tek kelimeler / kalıp ve deyimler. */
  const [turSuzgeci, setTurSuzgeci] = useState<'all' | 'words' | 'phrases'>('all');
  const [bulkTarget, setBulkTarget] = useState<'move' | 'copy' | null>(null);
  const [mergeSource, setMergeSource] = useState<string>('');
  const [showMerge, setShowMerge] = useState(false);
  const { showToast } = useToast();
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [setNotice, setSetNotice] = useState('');

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeDeckId]);

  // Active Deck Object
  const activeDeck = collections.find((c) => c.id === activeDeckId) || collections[0] || null;

  /*
   * KALAN PENCERELERİN ERİŞİLEBİLİRLİĞİ.
   *
   * "Yeni set" ve "Kelime ekle" dışındaki beş pencere ortak kancaya hiç
   * bağlanmamıştı: Escape kapatmıyor, Tab'a basınca odak pencerenin ARKASINDAKİ
   * sayfaya (set kartları, "Kelime Ekle" düğmesi) kayıyor, ekran okuyucu bir
   * iletişim kutusu açıldığını hiç duyurmuyor ve pencere kapanınca odak onu
   * açan düğmeye dönmüyordu. Android'de geri tuşu da pencereyi kapatmak yerine
   * kullanıcıyı başka bir sekmeye atıyor, o sırada düzenlenen set adı gidiyordu.
   *
   * Kancanın açık/kapalı ölçütü aşağıdaki render koşullarıyla BİREBİR aynı
   * olmalı; yoksa DOM'da bulunmayan bir kapsayıcıya odak tuzağı kurulur.
   */
  const editDeckRef = useModalA11y(!!editingDeck, () => setEditingDeck(null));
  const bulkModalRef = useModalA11y(!!bulkTarget && !!activeDeck, () => setBulkTarget(null));
  const mergeModalRef = useModalA11y(showMerge && !!activeDeck, () => setShowMerge(false));
  const importModalRef = useModalA11y(showImport && !!activeDeck, () => setShowImport(false));

  // Words in the active deck
  /*
   * SÖZLÜK KELİMESİNİ DÜZENLEME VE SETTEN ÇIKARMA.
   *
   * ÖLÇÜLEN SORUN. Kullanıcı sete bir kelime ekliyor ve kartın üstünde
   * "Kartı Düzenle" ile "Kartı Sil" bulunmuyordu. Sebep: o iki düğme
   * `card.isCustom` koşuluna bağlıydı ve sözlükte BULUNAN bir kelime sete
   * kendi kaydı olarak değil, PAYLAŞILAN sözlük kaydı olarak giriyor. Yani
   * kullanıcının kendi yazdığı kelimede düğmeler vardı, sözlükten seçtiği
   * kelimede yoktu — arada bir fark olduğu ekranda hiçbir yerde yazmıyordu.
   *
   * Sözlük kaydının kendisi düzenlenemez ve silinemez: o kayıt bütün
   * kullanıcılarda aynı ve pakete gömülü. Bu yüzden iki düğme sözlük
   * kartında şunu yapıyor:
   *
   *   Düzenle -> kartın KİŞİSEL BİR KOPYASI çıkarılır, set o kopyaya
   *              geçirilir ve düzenleme penceresi kopya üzerinde açılır.
   *              Paylaşılan sözlüğe dokunulmaz.
   *   Sil     -> kelime yalnızca BU SETTEN çıkarılır. Sözlükten silmek
   *              anlamına gelmez ve onay metni bunu açıkça söyler.
   */
  const sozlukKartiniKisisellestir = useCallback((card: WordCard) => {
    if (!activeDeck) return;
    const kopya: WordCard = {
      ...card,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isCustom: true,
      sourceType: 'custom',
      dateAdded: new Date().toISOString().slice(0, 10)
    };
    onAddCustomWord(kopya, activeDeck.id, card.sourceContext);
    onRemoveWordFromCollection(card.id, activeDeck.id);
    onOpenEditModal?.(kopya);
  }, [activeDeck, onAddCustomWord, onRemoveWordFromCollection, onOpenEditModal]);

  const activeDeckWords = useMemo(() => {
    if (!activeDeck) return [];
    const deckWordIds = memberships
      .filter((m) => m.collectionId === activeDeck.id)
      .map((m) => m.wordId);

    const allWordsMap = new Map<string, WordCard>();
    customWords.forEach((w) => allWordsMap.set(w.id, w));
    oxfordWords.forEach((w) => allWordsMap.set(w.id, w));

    const cards = deckWordIds
      .map((id) => allWordsMap.get(id))
      .filter((w): w is WordCard => !!w);

    /*
     * Sıralama. Kaynak dizi hep kopyalanır; üyelik sırası bozulmaz, çünkü
     * "eklediğim sıra" seçeneği ona geri dönebilmeli.
     *
     * Karşılaştırmalar Türkçe yerel ayarıyla yapılır: 'ı' ve 'i' aksi hâlde
     * yanlış yere düşer.
     */
    const membershipDate = new Map(
      memberships
        .filter(m => m.collectionId === activeDeck.id)
        .map(m => [m.wordId, m.addedAt])
    );

    switch (activeDeck.sortMode) {
      case 'alphabetical':
        return [...cards].sort((a, b) => a.word.localeCompare(b.word, 'tr'));

      case 'level': {
        // Seviyesi olmayan kartlar (kullanıcının kendi kelimeleri) sona düşer:
        // uydurma bir seviye atamaktansa listenin sonunda dursunlar.
        const rank = (card: WordCard) => {
          const index = card.level ? SEVIYELER.indexOf(card.level) : -1;
          return index < 0 ? SEVIYELER.length : index;
        };
        return [...cards].sort(
          (a, b) => rank(a) - rank(b) || a.word.localeCompare(b.word, 'tr')
        );
      }

      case 'date':
        return [...cards].sort((a, b) =>
          String(membershipDate.get(b.id) || '').localeCompare(
            String(membershipDate.get(a.id) || '')
          )
        );

      case 'status': {
        // Önce tekrar edilecekler, sonra hiç görülmemişler, en sonda
        // öğrenilenler: çalışmaya nereden devam edileceği listenin başında.
        const rank = (card: WordCard) => {
          const status = getUserWordStatus(card.id, learningStates);
          if (status === 'learning') return 0;
          if (status === 'unseen') return 1;
          return 2;
        };
        return [...cards].sort(
          (a, b) => rank(a) - rank(b) || a.word.localeCompare(b.word, 'tr')
        );
      }

      default:
        /*
         * VARSAYILAN SIRA: SON EKLENEN EN ÜSTTE.
         *
         * Önce üyelik dizisinin kendi sırası dönüyordu, yani en eski kelime
         * başta, yeni eklenen en sonda. Kullanıcının şikâyeti tam olarak
         * buydu: her kelime eklemesinden sonra onu görmek için sayfanın
         * dibine inmek gerekiyordu — üstelik set büyüdükçe daha da aşağı.
         *
         * Eklemenin hangi yoldan yapıldığı fark etmiyor (tekli, toplu,
         * metinden yakalama, yeni set): hepsi bir üyelik kaydı yazıyor ve
         * sıra o kaydın zamanından geliyor. `addedAt` tam ISO damgası, yani
         * aynı gün eklenen kelimeler de doğru sırada.
         */
        return [...cards].sort((a, b) =>
          String(membershipDate.get(b.id) || '').localeCompare(
            String(membershipDate.get(a.id) || '')
          )
        );
    }
  }, [activeDeck, memberships, customWords, oxfordWords, learningStates]);

  /*
   * ÇÖZÜLEMEYEN ÜYELİK: SETTE OLDUĞU YAZAN AMA HENÜZ KARTI OLMAYAN KELİME.
   *
   * `activeDeckWords` bir üyeliği çözemezse onu `.filter(Boolean)` ile sessizce
   * atıyor. Sözlük gelmediği sürece bu, DOLU bir seti boş ya da eksik
   * gösteriyordu: aynı ekranda set rozeti üyelikleri saydığı için "50 kelime"
   * yazarken gövde "Henüz kelime yok" diyordu. Kullanıcının gördüğü şey
   * verisini kaybetmiş olmak; yapacağı şey kelimeleri yeniden ekleyip çift
   * kayıt üretmek.
   *
   * Fark üyelik sayısından çıkarılıyor; ikinci bir tarama gerekmiyor.
   */
  const setUyelikSayisi = useMemo(
    () => (activeDeck ? memberships.filter(m => m.collectionId === activeDeck.id).length : 0),
    [activeDeck, memberships]
  );
  const cozulemeyenUyelik = Math.max(0, setUyelikSayisi - activeDeckWords.length);
  const sozlukBekleniyor = sozlukDurumu !== 'hazir' && cozulemeyenUyelik > 0;

  /*
   * AKTİF SET GERÇEKTEN VAR MI?
   *
   * `activeDeckId` silinen bir setin kimliğini tutmaya devam edebiliyordu:
   * ekran listedeki başka bir seti gösterirken seçim, "bu sette zaten var"
   * denetimi ve ekleme hedefi hâlâ silinmiş kimlikle çalışıyordu. Kimlik tek
   * doğru kaynak olmalı; listede karşılığı yoksa ilk sete düşülür.
   */
  useEffect(() => {
    if (collections.length === 0) {
      if (activeDeckId !== null) setActiveDeckId(null);
      return;
    }
    if (!collections.some(c => c.id === activeDeckId)) {
      setActiveDeckId(collections[0].id);
    }
  }, [collections, activeDeckId]);

  /*
   * Sette hiç kalıp yoksa tür süzgeci düğmeleri çizilmiyor. Süzgeç o anda
   * 'phrases' üzerinde kalırsa kullanıcı geri alamadığı boş bir listeye
   * kilitleniyor: kelime dolu bir set bomboş görünüyor. Denetim yoksa etki de
   * olmamalı.
   */
  const setteKalipVarMi = useMemo(
    () => activeDeckWords.some(c => c.entryType === 'phrase' || c.partOfSpeech === 'phrase'),
    [activeDeckWords]
  );

  // Filtered words in the active deck
  const filteredWords = useMemo(() => {
    // Düğmeler çizilmiyorsa süzgeç de etkisiz (bkz. yukarıdaki açıklama).
    const aktifTur = setteKalipVarMi ? turSuzgeci : 'all';
    const q = aramaAnahtari(searchQuery);
    return activeDeckWords.filter((card) => {
      // Tür süzgeci: 'phrases' hem kalıpları hem deyimleri kapsar, çünkü
      // ikisinin sınırı kullanıcıya göre değişir ve "çok sözcüklüleri
      // göster" isteği ikisini de kastediyor.
      if (aktifTur === 'phrases' && card.entryType !== 'phrase' && card.entryType !== 'idiom') {
        return false;
      }
      if (aktifTur === 'words' && (card.entryType === 'phrase' || card.entryType === 'idiom')) {
        return false;
      }
      if (!q) return true;
      return (
        aramaAnahtari(card.word).includes(q) ||
        aramaAnahtari(card.turkishMeaning).includes(q)
      );
    });
  }, [activeDeckWords, searchQuery, turSuzgeci, setteKalipVarMi]);

  /*
   * IZGARADA ÇİZİLECEK KARTLAR.
   *
   * Kart nesnesi eskiden render'ın içinde, her çizimde yeniden kuruluyordu
   * (`{ ...card, sourceContext: ... }`). Yeni nesne = yeni referans; React.memo
   * ile sarılı WordCardComponent bunu her seferinde "prop değişti" sayıyor ve
   * hiçbir şey değişmemişken bile bütün kartlar yeniden çiziliyordu. Üyelik de
   * kart başına `memberships.find(...)` ile aranıyordu: 200 kelimelik bir sette
   * her render n*m tarama.
   *
   * Burada üyelikler bir kez Map'e alınır ve kart yalnızca üyelikten gelen bir
   * bağlam/kaynak GERÇEKTEN farklıysa kopyalanır; aksi hâlde kartın kendi
   * referansı korunur.
   */
  const gorunenKartlar = useMemo(() => {
    if (!activeDeck) return filteredWords;
    const uyelikler = new Map(
      memberships.filter(m => m.collectionId === activeDeck.id).map(m => [m.wordId, m])
    );
    return filteredWords.map(card => {
      const uyelik = uyelikler.get(card.id);
      const baglam = uyelik?.sourceContext || card.sourceContext;
      const kaynak = uyelik?.sourceName || card.sourceName;
      if (baglam === card.sourceContext && kaynak === card.sourceName) return card;
      return { ...card, sourceContext: baglam, sourceName: kaynak };
    });
  }, [filteredWords, memberships, activeDeck]);

  /*
   * LİSTE PENCERESİ — kartlar parça parça basılıyor.
   *
   * ÖLÇÜLEN SORUN. Set açıkken filtrelenmiş listenin TAMAMI tek seferde DOM'a
   * basılıyordu. 75 kelimelik bir sette bu 5.892 düğüm ve 26.564 piksellik bir
   * sayfa demek; Setlerim sekmesine geçerken ekranın oturması 278 ms sürüyordu
   * (en kötü örnek 446 ms), `UpdateLayoutTree` 565,3 ms / 93 olay, 54 kare
   * düşüyordu. Zayıf telefonda (CPU 8x) kaydırmanın darboğazı da buydu: gövde
   * dokusunu ve kart gölgelerini tamamen kapatmak bile kare sayılarını
   * düzeltmiyordu, çünkü mesele boyama değil DOM boyutuydu.
   *
   * ÇÖZÜM. Önce bir pencere kadar kart basılıyor; listenin sonuna yaklaşıldıkça
   * pencere büyüyor. Ekranda YENİ BİR ÖĞE YOK — "Daha fazla göster" gibi bir
   * düğme eklenmedi, çünkü kullanıcının gördüğü akış değişmemeli. Gözlemci
   * görünüm alanının 600 piksel öncesinde tetikleniyor, yani sonraki kartlar
   * kullanıcı oraya varmadan hazır oluyor.
   *
   * `IntersectionObserver` yoksa (çok eski bir WebView) pencere açılmıyor ve
   * liste eskisi gibi bütün olarak basılıyor: davranış bozulmuyor, yalnızca
   * kazanç olmuyor.
   */
  const LISTE_PENCERESI = 24;
  const [pencereBoyu, setPencereBoyu] = useState(LISTE_PENCERESI);
  const listeSonuRef = useRef<HTMLDivElement | null>(null);

  // Set, süzgeç, arama ya da sıralama değişince pencere başa dönmeli; yoksa
  // yeni listede eskisinin uzunluğu kalır.
  useEffect(() => {
    setPencereBoyu(
      typeof IntersectionObserver === 'undefined' ? gorunenKartlar.length : LISTE_PENCERESI
    );
  }, [gorunenKartlar]);

  const pencereKartlari = useMemo(
    () => gorunenKartlar.slice(0, pencereBoyu),
    [gorunenKartlar, pencereBoyu]
  );

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    if (pencereBoyu >= gorunenKartlar.length) return;
    const nokta = listeSonuRef.current;
    if (!nokta) return;
    const gozlemci = new IntersectionObserver(
      girisler => {
        if (!girisler.some(g => g.isIntersecting)) return;
        /*
         * `startTransition`: pencere büyümesi ACİL DEĞİL. Parmak kaydırırken
         * yeni kartların render'ı öncelikli işe girerse kaydırma bir kare
         * kaybediyor — ölçüldü, kısa bir süpürmede 16,7 ms üstü kare sayısı
         * 27'den 39'a çıkmıştı. Düşük öncelikli güncelleme, React'in bu işi
         * kaydırma karelerinin arasına yaymasını sağlıyor.
         */
        startTransition(() => {
          setPencereBoyu(n => Math.min(n + LISTE_PENCERESI, gorunenKartlar.length));
        });
      },
      // Görünüm alanının 1200 piksel öncesi: kartlar kullanıcı oraya varmadan
      // çok önce hazır oluyor, böylece büyüme kaydırmanın ortasına denk gelmiyor.
      { rootMargin: '1200px 0px' }
    );
    gozlemci.observe(nokta);
    return () => gozlemci.disconnect();
  }, [pencereBoyu, gorunenKartlar.length]);

  /** Sette hiç kalıp/deyim yoksa süzgeci çizmenin anlamı yok. */
  const setteKalipVar = useMemo(
    () => activeDeckWords.some(c => c.entryType === 'phrase' || c.entryType === 'idiom'),
    [activeDeckWords]
  );

  /** Setteki kelime kimlikleri; "zaten var" denetimi için. */
  const activeDeckWordIds = useMemo(
    () =>
      new Set(
        memberships
          .filter(m => m.collectionId === activeDeckId)
          .map(m => m.wordId)
      ),
    [memberships, activeDeckId]
  );

  /*
   * Oxford havuzundaki kimlikler.
   *
   * Sözlükten eklenen kalıplar `sourceType: 'oxford'` taşıyor ama Oxford
   * dizisinde DEĞİLLER: ayrı bir dosyadan tembel yükleniyorlar. Yalnızca
   * `sourceType`e bakıp "bu Oxford kartı, kimliğini yaz yeter" demek, sette
   * hiçbir yerde çözülemeyen görünmez bir üyelik bırakıyordu.
   */
  const oxfordIds = useMemo(() => new Set(oxfordWords.map(w => w.id)), [oxfordWords]);

  /** Oxford havuzunda madde başına göre hızlı arama. */
  const oxfordByWord = useMemo(() => {
    const map = new Map<string, WordCard>();
    oxfordWords.forEach(card => {
      const key = aramaAnahtari(card.word);
      // Aynı yüzey kelimesinin birden çok kaydı olabilir (can1/can2). İlki
      // korunur: kaynak sırası en yaygın anlamı öne koyuyor.
      if (!map.has(key)) map.set(key, card);
    });
    return map;
  }, [oxfordWords]);

  // Dizin arka planda hazır olsun; kullanıcı yazmaya başlayınca beklemesin.
  useEffect(() => {
    if (showAddWordModal) void loadExtendedIndex().catch(() => undefined);
  }, [showAddWordModal]);

  /*
   * Yazarken arama. 350 ms beklenir: her harf için arama yapmak, harf
   * dosyası yükleyen bir işlevde gereksiz iş demektir.
   */
  useEffect(() => {
    const raw = wordInput.trim();
    if (!showAddWordModal || raw.length < 2) {
      setLookup({ kind: 'idle' });
      return;
    }

    let cancelled = false;
    setLookup({ kind: 'searching' });
    // Kullanıcı yazdığını değiştirdi: eski onay ve eski yapay zekâ uyarısı
    // artık başka bir kelimeye ait.
    setYazimOnayBekliyor(false);
    setYapayZekaYazimUyarisi(null);

    const timer = window.setTimeout(async () => {
      const key = aramaAnahtari(raw);

      const decide = (card: WordCard, source: 'oxford' | 'extended') => {
        if (cancelled) return;
        setLookup(
          activeDeckWordIds.has(card.id)
            ? { kind: 'in-set', card }
            : { kind: 'found', card, source }
        );
      };

      const oxford = oxfordByWord.get(key);
      if (oxford) {
        decide(oxford, 'oxford');
        return;
      }

      // Kullanıcının kendi kartlarında da olabilir.
      const own = customWords.find(c => aramaAnahtari(c.word) === key);
      if (own) {
        decide(own, 'oxford');
        return;
      }

      /*
       * Kalıplar ve deyimler. Tek kelime aramalarında hiç dokunulmaz:
       * boşluk ya da tire yoksa kullanıcı bir kalıp yazmıyordur ve 500 KB'lık
       * dosyayı yüklemenin anlamı olmaz. Oxford ve kendi kartlarından SONRA
       * denenir — bir kelime her ikisinde birden varsa kelime kaydı önceliklidir.
       */
      if (/[\s-]/.test(key)) {
        try {
          const kalip = await getPhraseCard(key);
          if (kalip) {
            decide(kalip, 'oxford');
            return;
          }
        } catch {
          /* kalıp verisi gelmezse elle yazmaya düşülür */
        }
      }

      /*
       * GENEL DAĞARCIK DİZİNİ BEKLENİR — YOKSA "SÖZLÜKTE YOK" BİR YALAN.
       *
       * `hasExtendedWord` eşzamanlı bir Set sorgusu; dizin henüz gelmemişken
       * HER kelime için false döner. Dizin yukarıda (pencere açılınca) ateşle
       * unut yöntemiyle başlatılıyor ama BEKLENMİYORDU, dolayısıyla hızlı
       * yazan kullanıcı sözlükte BULUNAN bir kelime için "Bu kelime sözlükte
       * yok" cevabını alıyordu.
       *
       * Üstelik kendi kendini düzeltmiyordu: efektin bağımlılıkları
       * (wordInput, oxfordByWord, ...) dizin yüklenmesiyle değişmediği için
       * dizin sonradan gelse bile arama tazelenmiyor, yanlış cevap kullanıcı
       * yazdığını değiştirene kadar ekranda kalıyordu. Ayrıca `reportMissingWord`
       * aslında var olan bir kelimeyi "eksik" diye bildiriyordu.
       *
       * Söz zaten bellekte tutuluyor; dizin hazırsa bu bekleme sıfır maliyetli.
       */
      try {
        await loadExtendedIndex();
      } catch {
        /* dizin açılamazsa aşağıdaki denetim zaten false döner */
      }
      if (cancelled) return;

      if (hasExtendedWord(key)) {
        try {
          const card = await getExtendedCard(key);
          if (card) {
            decide(card, 'extended');
            return;
          }
        } catch {
          /* harf dosyası gelmezse elle yazmaya düşülür */
        }
      }

      if (!cancelled) {
        /*
         * BULUNAMADI — PEKİ YANLIŞ MI YAZILDI?
         *
         * Buraya kadar gelen kelime hiçbir yerel listede yok. İki ihtimal
         * var ve kullanıcıya söylenecek şey ikisinde farklı: kelime gerçek
         * ama bizde yok ("petrichor"), ya da kelime yanlış yazıldı
         * ("recieve"). İkincisinde yapay zekâya gitmek sekiz saniye bekleyip
         * OLMAYAN bir kelimenin kartını almak demek; yanlış yazım sete girer
         * ve kullanıcı onu öyle öğrenir.
         *
         * Adaylar cihazdaki iki listeden: Oxford madde başları ve Genel
         * Dağarcık dizini (~19 bin kelime). Dizin yukarıda zaten beklendi,
         * yani burada hazır. Ağ yok, kota yok.
         */
        const oneriler = yazimOnerileri(
          key,
          [...oxfordByWord.keys(), ...extendedKelimeler()]
        );
        setLookup({ kind: 'not-found', oneriler });
        /*
         * Yöneticiye sinyal yalnızca DÜZGÜN yazılmış göründüğünde gidiyor.
         * Yazım hatası "eksik kelime" değildir; sözlüğe eklenecekler listesini
         * kullanıcının klavye hatalarıyla doldurmak, listeyi işe yaramaz hâle
         * getirir.
         */
        if (oneriler.length === 0) reportMissingWord(key);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [wordInput, showAddWordModal, oxfordByWord, customWords, activeDeckWordIds]);

  /**
   * Sözlükte bulunan kelimeyi sete ekler.
   *
   * Oxford kaydı zaten uygulamanın sabit verisidir; kopyalanmaz, sete
   * bağlanır. Genel Dağarcık kaydı ise bir yerde saklanmadığı için
   * kullanıcının kartı olarak yazılır — anlamı ve üç örnek cümlesiyle.
   */
  const addLookedUpCard = (card: WordCard, source: 'oxford' | 'extended') => {
    if (!activeDeck) return;
    const context = contextInput.trim() || undefined;

    if (source === 'oxford' && card.sourceType === 'oxford' && oxfordIds.has(card.id)) {
      onAddWordToCollection(card.id, activeDeck.id, context);
    } else if (customWords.some(c => c.id === card.id)) {
      onAddWordToCollection(card.id, activeDeck.id, context);
    } else {
      onAddCustomWord(
        {
          ...card,
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          isCustom: true,
          sourceContext: context,
          dateAdded: new Date().toISOString().slice(0, 10),
          isAiGenerated: false
        },
        activeDeck.id,
        context
      );
    }

    setLastAddedWord(card.word);
    setWordInput('');
    setManualTurkishMeaning('');
    setManualPartOfSpeech('');
    setManualEntryType(null);
    setContextInput('');
    setLookup({ kind: 'idle' });
  };

  /**
   * Seçimi tersine çevirir.
   *
   * `useCallback` süs değil: aşağıdaki ızgara bu işlevden türettiği kart
   * başına işleyicileri React.memo'lu WordCardComponent'e geçiyor. İşlev her
   * render'da yeniden üretilseydi memo hiçbir şeyi engellemezdi.
   */
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /*
   * KART BAŞINA SABİT SEÇİM İŞLEYİCİSİ.
   *
   * Izgara her karta `onToggleSelected={() => toggleSelected(card.id)}`
   * geçiyordu; ok işlevinin kimliği her render'da değiştiği için React.memo
   * asla tutmuyor, tek bir kutucuğa basmak ya da "Bu sette ara" kutusuna tek
   * harf yazmak setteki BÜTÜN kartları yeniden çizdiriyordu. Yüzlerce kelimelik
   * setlerde bu, her tuş vuruşunda gözle görülür bir takılma demekti.
   *
   * WordCard'ın `onToggleSelected` imzası argüman almadığı için kimliği kartın
   * kendisinden okuyamıyoruz; onun yerine kart kimliği başına tek bir işlev
   * üretip saklıyoruz. Ref'te tutulur, çünkü liste süzüldüğünde (arama) yeniden
   * üretilmemeleri gerekir.
   */
  const secimIsleyicileri = useRef(new Map<string, () => void>());
  const secimIsleyicisiAl = useCallback(
    (id: string) => {
      let isleyici = secimIsleyicileri.current.get(id);
      if (!isleyici) {
        isleyici = () => toggleSelected(id);
        secimIsleyicileri.current.set(id, isleyici);
      }
      return isleyici;
    },
    [toggleSelected]
  );

  /**
   * Seçili kelimeleri başka bir sete taşır ya da kopyalar.
   *
   * Kopyalamada kelime iki sette birden durur — kart tek, üyelik iki
   * tanedir. Taşımada yalnızca üyelik değişir; kartın kendisi ve kullanıcının
   * o kelimedeki ilerlemesi olduğu gibi kalır.
   */
  const moveSelected = (targetId: string, mode: 'move' | 'copy') => {
    if (!activeDeck || selectedIds.size === 0) return;

    selectedIds.forEach(wordId => {
      const alreadyThere = memberships.some(
        m => m.wordId === wordId && m.collectionId === targetId
      );
      if (!alreadyThere) onAddWordToCollection(wordId, targetId);
      if (mode === 'move') onRemoveWordFromCollection(wordId, activeDeck.id);
    });

    const target = collections.find(c => c.id === targetId);
    setSetNotice(
      `${selectedIds.size} kelime "${target?.name || 'set'}" setine ${
        mode === 'move' ? 'taşındı' : 'kopyalandı'
      }.`
    );
    setSelectedIds(new Set());
    setBulkTarget(null);
  };

  /** Seçili kelimeleri bu setten çıkarır (kartlar silinmez). */
  const removeSelected = () => {
    if (!activeDeck || selectedIds.size === 0) return;
    selectedIds.forEach(id => onRemoveWordFromCollection(id, activeDeck.id));
    setSetNotice(`${selectedIds.size} kelime bu setten çıkarıldı.`);
    setSelectedIds(new Set());
  };

  /**
   * Başka bir seti bu sete katar.
   *
   * Kaynak setteki kelimeler hedefe eklenir, sonra kaynak set silinir.
   * Kelimeler silinmez — yalnızca setin kendisi ortadan kalkar. Zaten
   * hedefte olan kelime ikinci kez eklenmez.
   */
  const mergeInto = () => {
    if (!activeDeck || !mergeSource) return;
    const source = collections.find(c => c.id === mergeSource);
    if (!source) return;

    const sourceWordIds = memberships
      .filter(m => m.collectionId === source.id)
      .map(m => m.wordId);

    let added = 0;
    sourceWordIds.forEach(wordId => {
      const alreadyThere = memberships.some(
        m => m.wordId === wordId && m.collectionId === activeDeck.id
      );
      if (!alreadyThere) {
        onAddWordToCollection(wordId, activeDeck.id);
        added++;
      }
    });

    onDeleteCollection(source.id);
    setSetNotice(
      `"${source.name}" seti katıldı: ${added} yeni kelime geldi, set silindi.`
    );
    setMergeSource('');
    setShowMerge(false);
  };

  /*
   * BURADA `shareDeck` VE `unshareDeck` VARDI.
   *
   * İkisi de `/api/sets/share` ucunu çağırıyordu ve o uç sunucuda
   * `requireAuth` taşıyor: paylaşmak için giriş yapmış olmak gerekiyordu.
   * Üyelik kaldırıldığı için ikisi de hiçbir koşulda başarılı olamazdı.
   * Setin dışarı çıkma yolu CSV dışa aktarma olarak duruyor ve o tamamen
   * çevrimdışı çalışıyor.
   */

  /**
   * Seti CSV olarak indirir.
   *
   * Biçim yönetim panelindekiyle AYNI sütunları kullanır; kullanıcı bir
   * setini dışa aktarıp başka bir sete ya da başka bir cihaza aynı dosyayla
   * taşıyabilir.
   */
  const exportDeckCsv = async () => {
    if (!activeDeck) return;

    const cell = (value: string) =>
      /[",\n;]/.test(value || '') ? `"${String(value).replace(/"/g, '""')}"` : String(value || '');

    const rows = ['kelime;telaffuz;seviye;tur;anlamlar;ornek1_en;ornek1_tr;ornek2_en;ornek2_tr'];
    activeDeckWords.forEach(card => {
      const ex = card.examples || [];
      rows.push(
        [
          card.word,
          card.phonetic || '',
          card.level || '',
          card.partOfSpeech || '',
          card.turkishMeaning || '',
          ex[0]?.en || '',
          ex[0]?.tr || '',
          ex[1]?.en || '',
          ex[1]?.tr || ''
        ]
          .map(cell)
          .join(';')
      );
    });

    // Excel'in Türkçe karakterleri doğru açması için BOM.
    const icerik = '\uFEFF' + rows.join('\n');
    const dosyaAdi = `${activeDeck.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.csv`;

    /*
     * APK'DA `<a download>` SESSİZCE HİÇBİR ŞEY YAPMAZ.
     *
     * Android WebView bu özniteliği işlemez: düğmeye basılır, dosya oluşmaz,
     * hata da çıkmaz. Kullanıcı setini dışa aktardığını sanır. Yedekleme
     * düğmesindeki hatanın aynısı; çözümü de aynı: yerel kabukta dosya
     * gerçekten diske yazılıyor ve paylaşım penceresi açılıyor.
     */
    if (Capacitor.isNativePlatform()) {
      try {
        const { uri } = await Filesystem.writeFile({
          path: dosyaAdi,
          data: icerik,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
        showToast(`Dosya kaydedildi: ${dosyaAdi}`, 'info');
        try {
          await Share.share({ title: `${activeDeck.name} — CSV`, url: uri });
        } catch {
          /* paylaşım iptal edildi; dosya yerinde duruyor */
        }
      } catch (e) {
        showToast('Dosya cihaza yazılamadı: ' + ((e as Error)?.message || 'bilinmeyen hata'), 'error');
      }
      return;
    }

    const blob = new Blob([icerik], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = dosyaAdi;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * CSV'den bu sete kelime ekler.
   *
   * Sette zaten olan kelime atlanır. Hatalı satır tüm yüklemeyi düşürmez.
   */
  /**
   * Tırnak duyarlı CSV satır ayrıştırıcı.
   *
   * NEDEN GEREKLİ. Dışa aktarma, içinde virgül/noktalı virgül geçen alanları
   * kurallara uygun biçimde tırnağa alıyor ("kapmak, yakalamak"). İçe aktarma
   * ise düz `split(delimiter)` yapıyordu: tırnağın içindeki ayraç da bölme
   * sayılıyor, anlam ortadan kırpılıyor ve sonraki sütunlar bir kayıyordu —
   * yani örnek cümleler yanlış alanlara düşüyordu. Uygulamanın kendi dışa
   * aktardığı dosya, kendi içe aktarmasında bozuluyordu.
   */
  const csvSatiriniBol = (line: string, delimiter: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let tirnakIcinde = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (tirnakIcinde) {
        if (ch === '"') {
          // İkilenmiş tırnak, alanın içindeki gerçek tırnaktır.
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            tirnakIcinde = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        tirnakIcinde = true;
      } else if (ch === delimiter) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(c => c.trim());
  };

  const importDeckCsv = () => {
    if (!activeDeck || !importText.trim()) return;

    const lines = importText.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      setSetNotice('CSV en az bir başlık ve bir satır içermeli.');
      return;
    }

    const delimiter =
      (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const header = csvSatiriniBol(lines[0], delimiter).map(h => h.toLowerCase());
    const columnOf = (name: string) => header.indexOf(name);

    const wordCol = columnOf('kelime');
    const meaningCol = columnOf('anlamlar');
    if (wordCol < 0 || meaningCol < 0) {
      setSetNotice('Başlıkta "kelime" ve "anlamlar" sütunları olmalı.');
      return;
    }

    /*
     * SEVİYE SÜTUNU.
     *
     * Dışa aktarma bu sütunu yazıyor, pencere metni de "isteğe bağlı: ...
     * seviye ..." diyerek okunacağını söylüyordu; oysa içe aktarma onu hiç
     * okumuyordu. Aynı seti dışa aktarıp geri almak seviyeyi sessizce siliyor,
     * sonrasında "Seviyeye göre" sıralaması bu kartları topluca listenin
     * sonuna atıyordu.
     */
    const seviyeCol = columnOf('seviye');

    const existing = new Set(activeDeckWords.map(c => aramaAnahtari(c.word)));
    let added = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const cells = csvSatiriniBol(lines[i], delimiter);
      const word = cells[wordCol];
      const meaning = cells[meaningCol];
      if (!word || !meaning) {
        skipped++;
        continue;
      }
      if (existing.has(aramaAnahtari(word))) {
        skipped++;
        continue;
      }

      const exEn = columnOf('ornek1_en') >= 0 ? cells[columnOf('ornek1_en')] : '';
      const exTr = columnOf('ornek1_tr') >= 0 ? cells[columnOf('ornek1_tr')] : '';

      // Seviye beyaz listeyle doğrulanır: dosyadaki serbest metin karta
      // "seviye" diye sızmasın, yalnızca bilinen CEFR değerleri kabul edilsin.
      const seviyeHam = (seviyeCol >= 0 ? cells[seviyeCol] || '' : '').toUpperCase();
      const seviye = (SEVIYELER as readonly string[]).includes(seviyeHam)
        ? (seviyeHam as Level)
        : undefined;

      onAddCustomWord(
        {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          word,
          partOfSpeech: columnOf('tur') >= 0 ? cells[columnOf('tur')] : '',
          turkishMeaning: meaning.replace(/\|/g, ', '),
          phonetic: columnOf('telaffuz') >= 0 ? cells[columnOf('telaffuz')] : undefined,
          level: seviye,
          examples: exEn && exTr ? [{ en: exEn, tr: exTr }] : [],
          isCustom: true,
          sourceType: 'custom',
          dateAdded: new Date().toISOString().slice(0, 10),
          isAiGenerated: false
        },
        activeDeck.id
      );
      existing.add(word.toLowerCase());
      added++;
    }

    setSetNotice(`${added} kelime eklendi${skipped ? `, ${skipped} satır atlandı` : ''}.`);
    setImportText('');
    setShowImport(false);
  };

  const handleExampleChange = (index: number, field: 'en' | 'tr', value: string) => {
    setManualExamples(list => {
      const next = [...list];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const resetAddWordModal = () => {
    setLastAddedWord(null);
    setWordInput('');
    setContextInput('');
    setCreationMode('FORM');
    setAiError(null);
    setYazimOnayBekliyor(false);
    setYapayZekaYazimUyarisi(null);
    setGeneratedPreviewCard(null);
    setManualTurkishMeaning('');
    setManualPartOfSpeech('');
    setManualEntryType(null);
    setManualExamples([{ en: '', tr: '' }]);
    setLookup({ kind: 'idle' });
    setShowAddWordModal(false);
  };

  // Check duplicate before AI generation
  const handleCheckAndProceedWithAi = () => {
    if (!wordInput.trim()) {
      alert('Lütfen önce bir İngilizce kelime yazın.');
      return;
    }

    /*
     * YAZIM DENETİMİ, İSTEKTEN ÖNCE.
     *
     * Yerel listede yakın bir kelime varsa yapay zekâya HİÇ gidilmiyor:
     * "recieve" için sekiz saniye bekleyip olmayan bir kelimenin kartını
     * almak, kullanıcının kaybettiği zamandan da fazlasına mal olur — yanlış
     * yazım sete girer ve öyle öğrenilir.
     *
     * Tek dokunuş engelleniyor, ikincisi değil: kutu soruya dönüşüyor ve
     * "yine de kendi yazdığımla devam et" seçeneği duruyor. Sözlüğümüz
     * İngilizcenin tamamı olmadığı için son söz kullanıcıda kalmalı.
     */
    if (lookup.kind === 'not-found' && lookup.oneriler.length > 0 && !yazimOnayBekliyor) {
      setYazimOnayBekliyor(true);
      return;
    }

    const check = detectWordDuplicate({
      rawWord: wordInput.trim(),
      targetCollectionId: activeDeckId || undefined,
      collections,
      memberships,
      customWords,
      oxfordWords
    });
    if (check.type !== 'NONE') {
      setDuplicateOrigin('AI');
      setDuplicateResult(check);
      setShowDuplicateModal(true);
    } else {
      handleExecuteAiGeneration();
    }
  };

  // Execute Gemini AI Card Generation
  /**
   * Yapay zekâya kart ürettirir.
   *
   * @param yazimiZorla Yapay zekânın "bu İngilizce bir kelime değil" cevabını
   *   bir kez gördükten sonra kullanıcı ısrar ederse `true` gelir: istek
   *   yazım denetimi olmadan tekrarlanır. Sözlük de model de yanılabilir
   *   (yeni terimler, özel adlar, ağız kullanımları), bu yüzden son söz
   *   kullanıcıda kalıyor.
   */
  const handleExecuteAiGeneration = async (yazimiZorla = false) => {
    setCreationMode('AI_GENERATING');
    setAiError(null);
    setYapayZekaYazimUyarisi(null);

    try {
      /*
       * Uç adı `generate-word`.
       *
       * Burada `generate-card` yazıyordu; sunucuda öyle bir uç hiç olmadı.
       * İstek 404 dönüyor, arayüz de bunu "yapay zekâ yanıt veremedi" diye
       * gösteriyordu: özellik hiçbir zaman çalışmamış ama hata mesajı suçu
       * yapay zekâya atıyordu. Yanıt şekli (word, phonetic, partOfSpeech,
       * turkishMeaning, senses, examples) zaten bu ucun döndürdüğüyle aynı.
       */
      const response = await fetch(apiUrl('/api/ai/generate-word'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: wordInput.trim(),
          context: contextInput.trim() || undefined,
          yazimiZorla: yazimiZorla || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Yapay zekâ yanıt veremedi. Lütfen tekrar deneyin.');
      }

      const data = await response.json();

      /*
       * KELİME TANINMADIYSA KART UYDURULMUYOR.
       *
       * Yapay zekâ "bu bir İngilizce kelime değil" derse geriye kart değil
       * bu işaret geliyor. Eskiden böyle bir durumda model yine de bir şeyler
       * yazıyordu ve kullanıcı olmayan bir kelimenin kartını kaydediyordu.
       */
      if (data && data.notAWord) {
        setYapayZekaYazimUyarisi({
          onerilen: typeof data.suggestion === 'string' ? data.suggestion.trim() : ''
        });
        setCreationMode('FORM');
        return;
      }

      const previewCard: WordCard = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        word: data.word || wordInput.trim(),
        phonetic: data.phonetic,
        partOfSpeech: data.partOfSpeech || 'n.',
        turkishMeaning: data.turkishMeaning || '',
        contextualMeaning: data.contextualMeaning,
        senses: Array.isArray(data.senses) ? data.senses : undefined,
        examples: Array.isArray(data.examples) ? data.examples : [],
        collocations: Array.isArray(data.collocations) ? data.collocations : undefined,
        isCustom: true,
        sourceType: 'custom',
        sourceContext: contextInput.trim() || undefined,
        dateAdded: new Date().toISOString().slice(0, 10),
        isAiGenerated: true
      };

      setGeneratedPreviewCard(previewCard);
      setCreationMode('AI_PREVIEW');
    } catch (err: any) {
      setAiError(
        err.message ||
          'Yapay zekâ şu anda kelime bilgilerini oluşturamadı. Tekrar deneyebilir veya kartı kendiniz doldurabilirsiniz.'
      );
      setCreationMode('FORM');
    }
  };

  // Save AI Generated Card
  const handleSaveAiCard = () => {
    if (!generatedPreviewCard || !activeDeck) return;
    onAddCustomWord(generatedPreviewCard, activeDeck.id, contextInput.trim() || undefined);
    resetAddWordModal();
  };

  /**
   * Elle doldurulan kartı kaydeder.
   *
   * Form gönderiminden de, tekrar uyarısındaki "yine de oluştur"dan da
   * çağrılabilsin diye olaydan ayrıldı; ikinci çağrıda ortada bir form olayı
   * yoktur.
   */
  const saveManualCard = (forceOverride: boolean = false) => {
    if (!wordInput.trim() || !manualTurkishMeaning.trim() || !activeDeck) return;

    if (!forceOverride) {
      const check = detectWordDuplicate({
        rawWord: wordInput.trim(),
        targetCollectionId: activeDeckId || undefined,
        collections,
        memberships,
        customWords,
        oxfordWords
      });

      /*
       * SATIR İÇİ PANEL ZATEN SÖYLEDİYSE İKİNCİ PENCERE AÇILMAZ.
       *
       * Kullanıcı kelimeyi yazdığında panel "bu kelime sözlükte var" diyor ve
       * hazır kartı ekleme düğmesini gösteriyor. Buna rağmen kendi anlamını
       * yazıp kaydete bastıysa kararını vermiştir; aynı bilgiyi ikinci bir
       * pencerede tekrar sormak akışı kesmekten başka bir işe yaramaz.
       *
       * Pencere yalnızca panelin GÖSTERMEDİĞİ durumlar için kalır: kelimenin
       * bu sette zaten olması ve çekimli biçim uyarısı. İkisi de kullanıcının
       * henüz görmediği bir bilgi taşır.
       */
      const alreadyShownInline =
        lookup.kind === 'found' &&
        (check.type === 'EXACT_IN_OXFORD' || check.type === 'EXACT_IN_OTHER_COLLECTION');

      if (check.type !== 'NONE' && !alreadyShownInline) {
        setDuplicateOrigin('FORM');
        setDuplicateResult(check);
        setShowDuplicateModal(true);
        return;
      }
    }

    const validExamples = manualExamples.filter((ex) => ex.en.trim() !== '');

    const newCard: WordCard = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      word: wordInput.trim(),
      partOfSpeech: manualPartOfSpeech,
      entryType: manualEntryType || onerilenTur(wordInput),
      turkishMeaning: manualTurkishMeaning.trim(),
      examples: validExamples,
      isCustom: true,
      sourceType: 'custom',
      sourceContext: contextInput.trim() || undefined,
      dateAdded: new Date().toISOString().slice(0, 10),
      isAiGenerated: false,
      duplicateOverride: forceOverride || undefined
    };

    onAddCustomWord(newCard, activeDeck.id, contextInput.trim() || undefined);

    // Kelime ekleme genelde arka arkaya yapılan bir iştir: modal kapanıp
    // yeniden açılmak yerine alanlar temizlenir ve odak yeniden kelime
    // alanına döner. Küçük bir onay satırı da ne eklendiğini gösterir
    // (talimat 48: "Bir kelime daha ekle").
    setLastAddedWord(newCard.word);
    setWordInput('');
    setManualTurkishMeaning('');
    setContextInput('');
    setManualExamples([{ en: '', tr: '' }]);
    setDuplicateResult(null);
    /*
     * Tür seçimi de sıfırlanır. Modal kapanmadan arka arkaya kelime
     * eklenebildiği için, bir kez elle seçilen "Deyim" sonraki bütün
     * kayıtlara yapışıyordu (ölçüldü: 'thrive' de deyim olarak kaydedildi).
     * null = öneri yeniden geçerli.
     */
    setManualEntryType(null);
  };

  const handleSaveManualCard = (e: React.FormEvent) => {
    e.preventDefault();
    saveManualCard(false);
  };

  // If user is studying this set in Flashcard Study Mode
  if (isStudyingFlashcards && activeDeck) {
    return (
      <StudyFlashcard
        title={activeDeck.name}
        sourceContextName={activeDeck.name}
        deckKey={`collection:${activeDeck.id}`}
        words={activeDeckWords}
        favorites={favorites}
        learningStates={learningStates}
        onToggleFavorite={onToggleFavorite}
        onSetStatus={onSetWordStatus || (() => {})}
        onBack={() => setIsStudyingFlashcards(false)}
        onOpenEditCard={onOpenEditModal}
        onDeleteCard={onDeleteCustomWord}
        onOpenAddToCollection={onOpenAddToCollection}
        isCustomDeck={true}
      />
    );
  }

  return (
    <div className="space-y-6 pb-safe-nav max-w-[1180px] mx-auto animate-fadeIn">
      {/* Uzun listede sayfanın başına/sonuna atlama; kısa sayfada çizilmez. */}
      <SayfaAtlama />
      {/* Top Banner: Kelime Setlerim */}
      {/*
        Sayfanın tek üst görseli: EJDERHA sahnesi. Ana Sayfa'daki "Kelime
        Setlerim" kutusuyla aynı sahne, çünkü sahne o bölümün işareti — set
        nerede geçerse ejderha orada. Köşe filigranı fotoğrafın üstünde
        okunmadığı için panel `gorsel-panel`.
      */}
      <div className="gorsel-panel bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <SahneSeridi sahne="ejderha" oncelikli />
        <div className="p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="baslik-yazit text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Kelime Setlerim
            </h2>
            <span className="px-2 py-0.5 bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-bold rounded-lg border border-[var(--primary-border)]">
              {collections.length} Set
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-xl">
            Diziler, kitaplar veya günlük hayatta karşılaştığın kelimeler için kendi setlerini oluştur.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setShowMinerModal(true)}
            className="px-3.5 py-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border)] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[var(--primary)]" />
            <span>Metinden Kelime Yakala</span>
          </button>

          <button
            /*
             * Set oluşturmak giriş gerektirmez.
             *
             * Önceki davranış, hesabı olmayan kullanıcıyı ilk setini
             * oluşturmadan önce kayıt ekranına yönlendiriyordu. Uygulamanın
             * verisi zaten yereldir ve giriş yalnızca bulut yedeklemesi
             * içindir; ilk adımda hesap istemek, ürünün "hızlı ekleme"
             * vaadinin önündeki en büyük sürtünmeydi. Giriş, veri buluta
             * eşitlenmek istendiğinde profil ekranından yapılabilir.
             */
            onClick={() => setShowCreateModal(true)}
            className="dugme-birincil px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
          >
            <RealmsIcon name="add" size={20} />
            <span>Yeni Kelime Seti</span>
          </button>
        </div>
        </div>
      </div>

      {/* Main Layout: Left Set List + Right Active Set Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Kelime Setleri */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-[var(--text-secondary)]  tracking-wider">
              Set Listesi
            </h3>
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {collections.length} Set
            </span>
          </div>

          <div className="space-y-2.5">
            {/*
              KIRPILMIŞ LİSTE ÇİZİLİYOR.

              `gorunenSetler` hesaplanıyor ama liste `collections`ı çiziyordu:
              on set eklendiğinde hepsi alt alta sıralanıyor, altına da aynı
              listeyi ikinci kez açan "Tüm setleri gör" düğmesi konuyordu.
              Yani sınır vardı, uygulanmıyordu.
            */}
            {gorunenSetler.map((deck) => {
              const isActive = deck.id === activeDeck?.id;
              const deckWordCount = memberships.filter((m) => m.collectionId === deck.id).length;
              let learned = 0;
              let learning = 0;

              memberships
                .filter((m) => m.collectionId === deck.id)
                .forEach((m) => {
                  const st = getUserWordStatus(m.wordId, learningStates);
                  if (st === 'learned') learned++;
                  else if (st === 'learning') learning++;
                });

              const learnedPercent =
                deckWordCount > 0 ? Math.round((learned / deckWordCount) * 100) : 0;

              return (
                <div
                  key={deck.id}
                  onClick={() => {
                    setActiveDeckId(deck.id);
                    setOpenMenuDeckId(null);
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative group ${
                    isActive
                      ? 'bg-[var(--surface)] border-[var(--primary)] shadow-xs ring-1 ring-[var(--primary)]'
                      : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--neutral-300)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 flex items-start gap-2.5">
                      {/*
                        Setin rengi ve simgesi. Uzun listede seti adından önce
                        bunlar tanıtır; kullanıcı okumadan bulur.
                      */}
                      <span
                        className="hanedan-kapak w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5"
                        style={{ '--hanedan': setRengi(deck.color) } as React.CSSProperties}
                        aria-hidden="true"
                      >
                        <DeckIcon name={deck.iconName} className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                          {deck.name}
                        </h4>
                        {deck.isPinned && (
                          <Pin className="w-3 h-3 text-[var(--learning-text)] fill-current shrink-0" />
                        )}
                      </div>
                      {deck.description && (
                        <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                          {deck.description}
                        </p>
                      )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-bold text-[var(--primary)] bg-[var(--primary-soft)] px-2 py-0.5 rounded-md border border-[var(--primary-border)]">
                        {deckWordCount}
                      </span>

                      {/* 3 dots menu trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuDeckId(openMenuDeckId === deck.id ? null : deck.id);
                        }}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)] rounded-lg transition-colors cursor-pointer"
                        title="Set Seçenekleri"
                      >
                        <RealmsIcon name="more" size={20} />
                      </button>
                    </div>
                  </div>

                  {/* 3 Dots Dropdown Menu */}
                  {openMenuDeckId === deck.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-3 top-11 z-30 bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--border)] py-1 min-w-[180px] animate-fadeIn text-xs font-semibold text-[var(--text-primary)]"
                    >
                      <button
                        onClick={() => {
                          setEditingDeck(deck);
                          setOpenMenuDeckId(null);
                        }}
                        className="w-full px-3.5 py-2 hover:bg-[var(--surface-soft)] flex items-center gap-2 text-left cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>Düzenle</span>
                      </button>

                      {/*
                        SIRALAMA KULLANICININ ELİNDE.

                        Setler eklenme sırasına göre diziliydi; en çok
                        çalıştığı seti en üste almak isteyen kullanıcının
                        elinde sabitlemekten başka bir yol yoktu ve sabitleme
                        yalnızca ikili bir işaret — üç seti kendi arasında
                        sıralamaya yetmiyor.

                        Sürükle-bırak yerine iki düğme: telefonda sürükleyerek
                        sıralama, listenin kendisi de kaydırılabilir olduğunda
                        güvenilir çalışmıyor. Düğmeler daha yavaş ama her
                        seferinde çalışır.
                      */}
                      {onMoveCollection && collections.length > 1 && (
                        <>
                          <button
                            onClick={() => {
                              onMoveCollection(deck.id, 'yukari');
                              setOpenMenuDeckId(null);
                            }}
                            disabled={collections[0]?.id === deck.id}
                            className="w-full px-3.5 py-2 hover:bg-[var(--surface-soft)] flex items-center gap-2 text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ArrowUp className="w-3.5 h-3.5 text-[var(--primary)]" />
                            <span>Yukarı taşı</span>
                          </button>
                          <button
                            onClick={() => {
                              onMoveCollection(deck.id, 'asagi');
                              setOpenMenuDeckId(null);
                            }}
                            disabled={collections[collections.length - 1]?.id === deck.id}
                            className="w-full px-3.5 py-2 hover:bg-[var(--surface-soft)] flex items-center gap-2 text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ArrowDown className="w-3.5 h-3.5 text-[var(--primary)]" />
                            <span>Aşağı taşı</span>
                          </button>
                          <div className="border-t border-[var(--border-light)] my-1" />
                        </>
                      )}

                      {/*
                        Birleştirme bu menüye de kondu. Özellik zaten vardı ama
                        yalnızca açık setin araç çubuğunda duruyordu; kullanıcı
                        "şu iki seti birleştireyim" diye düşündüğünde eli önce
                        setin kendi menüsüne gidiyor. Seçenek, işin akla geldiği
                        yerde olmalı.

                        Menüden açıldığında set önce etkinleştiriliyor: birleştirme
                        penceresi açık set üzerinden çalışıyor, başka bir setin
                        menüsünden açılıp yanlış seti birleştirmesin.
                      */}
                      {collections.length > 1 && (
                        <button
                          onClick={() => {
                            setActiveDeckId(deck.id);
                            setOpenMenuDeckId(null);
                            setShowMerge(true);
                          }}
                          className="w-full px-3.5 py-2 hover:bg-[var(--surface-soft)] flex items-center gap-2 text-left cursor-pointer"
                        >
                          <GitMerge className="w-3.5 h-3.5 text-[var(--primary)]" />
                          <span>Başka setle birleştir</span>
                        </button>
                      )}

                      <div className="border-t border-[var(--border-light)] my-1" />

                      <button
                        onClick={() => {
                          if (
                            confirm(`"${deck.name}" kelime setini silmek istediğinize emin misiniz?`)
                          ) {
                            onDeleteCollection(deck.id);
                            setOpenMenuDeckId(null);
                          }
                        }}
                        className="w-full px-3.5 py-2 hover:bg-[var(--danger-soft)] text-[var(--danger)] flex items-center gap-2 text-left cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Seti Sil</span>
                      </button>
                    </div>
                  )}

                  {/* Progress Line */}
                  <div className="mt-3 pt-2.5 border-t border-[var(--border-light)] space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)]">
                      <span className="text-[var(--learned)] inline-flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />{learned} Öğrendim
                        </span>
                      <span className="text-[var(--learning-text)] inline-flex items-center gap-1">
                          <RealmsIcon name="repeat" size={18} className="stroke-[3]" aria-hidden="true" />{learning} Tekrar Et
                        </span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--learned)] rounded-full transition-all"
                        style={{ width: `${learnedPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/*
            KALAN SETLER AÇILIR MENÜDE.

            On set kurmuş kullanıcıda hepsi alt alta diziliyor ve sol sütunun
            tamamını kaplıyordu; aradığı seti bulmak uzun bir listeyi gözle
            taramayı gerektiriyordu. Artık en fazla üç set görünür: sabitlenmiş
            olanlar, üzerinde çalışılan set ve en yeniler. Gerisi tek dokunuşla
            açılan, gerektiğinde aranabilen bir listede.

            ÇALIŞILAN SET HER ZAMAN GÖRÜNÜR — kullanıcının seçtiği şeyin
            listeden kaybolması kafa karıştırırdı.
          */}
          {gizliSetler.length > 0 && (
            <div className="relative">
              {/*
                BELİRGİN BİR DÜĞME, SOLUK BİR AÇILIR MENÜ DEĞİL.

                'Diğer N set' satırı listenin devamı gibi görünüyordu ve
                gözden kaçıyordu. Kullanıcının bütün setlerine ulaşması
                ikincil bir işlem değil; düğme de öyle görünmeli.
              */}
              <button
                type="button"
                onClick={() => setSetListesiAcik(o => !o)}
                aria-expanded={setListesiAcik}
                className="w-full px-4 py-3 rounded-xl border-2 border-[var(--primary-border)] bg-[var(--primary-soft)] hover:bg-[var(--primary-soft-hover)] text-xs font-bold text-[var(--primary)] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RealmsIcon name="sets" size={20} />
                <span>
                  {setListesiAcik
                    ? 'Listeyi kapat'
                    : `Tüm setleri gör (${collections.length})`}
                </span>
                <RealmsIcon name="chevron-down" size={18} className="transition-transform ${ setListesiAcik ? 'rotate-180' : '' }" />
              </button>

              {setListesiAcik && (
                <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden">
                  {collections.length > 6 && (
                    <div className="p-2 border-b border-[var(--border-light)]">
                      <input
                        type="text"
                        value={setAramasi}
                        onChange={e => setSetAramasi(e.target.value)}
                        placeholder="Set ara..."
                        aria-label="Set ara"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)] outline-hidden focus:border-[var(--primary)]"
                      />
                    </div>
                  )}
                  <div className="max-h-64 overflow-y-auto">
                    {aranmisTumSetler.length === 0 ? (
                      <p className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">
                        Eşleşen set yok.
                      </p>
                    ) : (
                      aranmisTumSetler.map(deck => {
                        const sayi = memberships.filter(m => m.collectionId === deck.id).length;
                        return (
                          <button
                            key={deck.id}
                            type="button"
                            onClick={() => {
                              setActiveDeckId(deck.id);
                              setSetListesiAcik(false);
                              setSetAramasi('');
                            }}
                            className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-[var(--surface-soft)] border-b border-[var(--border-light)] last:border-b-0 cursor-pointer"
                          >
                            <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {deck.isPinned && '📌 '}
                              {deck.name}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                              {sayi} kelime
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Active Set Workspace */}
        {activeDeck ? (
          <div className="lg:col-span-8 space-y-5">
            {/*
              ARKA PLANDA SÜREN EKLEME.

              Yapay zekâ üretimi kelime başına ~8 saniye ve sırayla gidiyor.
              İş artık toplu ekleme penceresinde değil, uygulamanın kökündeki
              kuyrukta dönüyor; pencere kapansa da, başka sekmeye geçilse de,
              uygulama kapanıp açılsa da sürüyor. Bu satır bunun TEK görünür
              işareti: olmasaydı kullanıcı kartların neden azar azar
              belirdiğini anlamaz, işin durduğunu sanırdı. Kuyruk bitince
              satır kendiliğinden kalkıyor.
            */}
            {topluIlerleme?.kuyruk && settekiKalan(topluIlerleme.kuyruk, activeDeck.id) > 0 && (
              <button
                type="button"
                onClick={onTopluDetay}
                className="w-full parsomen-panel bg-[var(--primary-soft)] border border-[var(--primary-border)] rounded-2xl px-4 py-3 flex items-center gap-3 text-left cursor-pointer hover:bg-[var(--primary-soft)]/70"
                aria-live="polite"
              >
                {topluIlerleme.duraklatildi ? (
                  <WifiOff className="w-4 h-4 text-[var(--danger)] shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)] shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--primary)]">
                    {topluIlerleme.duraklatildi
                      ? 'Bağlantı bekleniyor'
                      : 'Kelimeler eklenmeye devam ediyor'}
                    {' — '}
                    {settekiKalan(topluIlerleme.kuyruk, activeDeck.id)} kelime kaldı
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed truncate">
                    {topluIlerleme.duraklatildi
                      ? 'Kelimeler kuyrukta duruyor, bağlantı gelince kaldığı yerden sürecek'
                      : topluIlerleme.suAnki
                        ? `Şu an: ${topluIlerleme.suAnki}`
                        : 'Anlora AI kartları hazırlıyor'}
                    {' · '}Listeyi görmek için dokun.
                  </p>
                </div>
              </button>
            )}

            {/* Active Set Header */}
            <div className="parsomen-panel bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold text-[var(--text-primary)]">{activeDeck.name}</h3>
                    {activeDeck.isPinned && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-[var(--learning-soft)] text-[var(--learning-text)] rounded-md border border-[var(--learning-border)]">
                        Sabitlendi
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {activeDeck.description || 'Bu setteki kelimeler ve özel bağlam cümleleri'}
                  </p>
                </div>

                {/* Set Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onStartQuiz(activeDeck.id)}
                    className="px-3.5 py-2 bg-[var(--surface-soft)] hover:bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)] text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RealmsIcon name="exam" size={20} className="text-[var(--primary)]" />
                    <span>Sınav Yap</span>
                  </button>
                </div>
              </div>

              {/* Set Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-light)]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      resetAddWordModal();
                      setShowAddWordModal(true);
                    }}
                    className="dugme-birincil px-3.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
                  >
                    <RealmsIcon name="add" size={18} />
                    <span>Kelime Ekle</span>
                  </button>

                  <button
                    onClick={() => setShowBatchModal(true)}
                    className="px-3.5 py-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border)] transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RealmsIcon name="sets" size={18} className="text-[var(--text-secondary)]" />
                    <span>Toplu Ekle</span>
                  </button>

                  <button
                    onClick={exportDeckCsv}
                    title="Bu seti CSV olarak indir"
                    className="px-3 py-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border)] transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RealmsIcon name="download" size={18} className="text-[var(--text-secondary)]" />
                    <span className="hidden sm:inline">CSV</span>
                  </button>

                  <button
                    onClick={() => setShowImport(true)}
                    title="CSV'den bu sete kelime ekle"
                    className="px-3 py-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border)] transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RealmsIcon name="share" size={18} className="text-[var(--text-secondary)]" />
                  </button>

                  {/*
                    SET PAYLAŞIMI KALDIRILDI.

                    Düğme seti sunucuya yüklüyordu ve o uç (`/api/sets/share`)
                    `requireAuth` istiyor — yani yalnızca giriş yapmış bir
                    kullanıcı paylaşabiliyordu. Üyelik kalkınca düğme, her
                    basışta yetki hatası veren bir düğmeye dönüşürdü.

                    Seti başkasına ulaştırma yolu kapanmıyor: yanı başındaki
                    CSV dışa aktarma tamamen çevrimdışı çalışıyor ve dosyayı
                    istediğin yere gönderebilirsin.
                  */}

                  {collections.length > 1 && (
                    <button
                      onClick={() => setShowMerge(true)}
                      title="Başka bir seti bu sete kat"
                      className="px-3 py-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border)] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Merge className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    </button>
                  )}
                </div>

                {/* Search in Set */}
                <div className="relative min-w-[200px] flex-1 max-w-xs">
                  <RealmsIcon name="search" size={18} className="text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Bu sette ara..."
                    aria-label="Bu sette ara"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:border-[var(--primary)] focus:outline-none text-[var(--text-primary)]"
                  />
                </div>
              </div>
            </div>

            {/* Prominent Flashcard Study Mode CTA Card */}
            {activeDeckWords.length > 0 && (
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
                    Şimdi çalışmaya başla ({activeDeckWords.length} kelime)
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
                  <RealmsIcon name="play" size={20} className="fill-current ml-0.5" />
                </div>
              </button>
            )}

            {setNotice && (
              <div className="p-3 rounded-xl bg-[var(--learned-soft)] border border-[var(--learned-border)] text-[11px] font-semibold text-[var(--learned-text)] flex items-center justify-between gap-2">
                <span>{setNotice}</span>
                <button
                  type="button"
                  onClick={() => setSetNotice('')}
                  className="text-[var(--learned-text)] hover:opacity-70 cursor-pointer"
                  aria-label="Kapat"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/*
              TÜR SÜZGECİ. Sette hiç kalıp/deyim yoksa hiç çizilmez: üç
              seçenekten ikisinin karşılığı olmayan bir süzgeç, yer
              kaplamaktan başka işe yaramaz.
            */}
            {setteKalipVar && (
              <div className="flex flex-wrap items-center gap-1.5 px-1">
                  {([
                    { id: 'all' as const, label: 'Hepsi' },
                    { id: 'words' as const, label: 'Tek kelimeler' },
                    { id: 'phrases' as const, label: 'Kalıp ve deyimler' }
                  ]).map(s2 => (
                    <button
                      key={s2.id}
                      type="button"
                      onClick={() => setTurSuzgeci(s2.id)}
                      aria-pressed={turSuzgeci === s2.id}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                        turSuzgeci === s2.id
                          ? 'dugme-birincil bg-[var(--primary)] border-[var(--primary)] text-[var(--on-primary)]'
                          : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]'
                      }`}
                    >
                      {s2.label}
                    </button>
                  ))}
                </div>
            )}

            {/*
              TOPLU SEÇİM ARAÇ ÇUBUĞU.
              Yalnızca bir şey seçiliyken görünür; hiçbir şey seçili değilken
              ekranda duran boş bir araç çubuğu yer kaplamaktan başka işe
              yaramaz.
            */}
            {filteredWords.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.size === filteredWords.length
                        ? new Set()
                        : new Set(filteredWords.map(c => c.id))
                    )
                  }
                  className="text-[11px] font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] cursor-pointer"
                >
                  {selectedIds.size === filteredWords.length ? 'Seçimi kaldır' : 'Tümünü seç'}
                </button>

                {selectedIds.size > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">
                      {selectedIds.size} seçili
                    </span>
                    {collections.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setBulkTarget('move')}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[var(--surface-soft)] hover:bg-[var(--border)] text-[var(--text-primary)] cursor-pointer inline-flex items-center gap-1"
                        >
                          <MoveRight className="w-3.5 h-3.5" /> Taşı
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkTarget('copy')}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[var(--surface-soft)] hover:bg-[var(--border)] text-[var(--text-primary)] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" /> Kopyala
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={removeSelected}
                      className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[var(--danger-soft)] hover:bg-[var(--danger-soft-hover)] text-[var(--danger)] cursor-pointer inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Setten çıkar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Words Grid or Empty State */}
            {filteredWords.length > 0 ? (
              <>
              {/*
                * KARMA SETTE LİSTE EKSİK ÇİZİLİYOR OLABİLİR.
                *
                * Kendi kelimeleri hemen geliyor, sözlükten gelenler gecikiyor.
                * O aralıkta liste boş değil ama EKSİK; hiçbir şey söylenmezse
                * kullanıcı aradaki kelimelerin silindiğini sanıyor. Sayı
                * üyeliklerden geliyor, tahmin değil.
                */}
              {sozlukBekleniyor && (
                <p
                  className="px-1 text-xs text-[var(--text-secondary)]"
                  aria-live="polite"
                >
                  {sozlukDurumu === 'hata'
                    ? `${cozulemeyenUyelik} kelime sözlükten okunuyor ve sözlük açılamadı; listede henüz görünmüyorlar.`
                    : `${cozulemeyenUyelik} kelime daha hazırlanıyor…`}
                </p>
              )}

              {/* Sola hizalı: sağ kenarda sabit duran "en üste / en alta"
                  düğmelerinin altında kalmasın. */}
              <div className="flex items-center justify-start px-1">
                <GorunumSecici deger={gorunum} onDegis={setGorunum} />
              </div>

              {gorunum === 'liste' ? (
                <div className="gorsel-panel bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
                  {pencereKartlari.map(card => (
                    <KelimeSatiri
                      key={card.id}
                      card={card}
                      acik={acikSatir === card.id}
                      onDegistir={() => setAcikSatir(acikSatir === card.id ? null : card.id)}
                    >
                      <WordCardComponent
                        card={card}
                        isFavorite={favorites.includes(card.id)}
                        learningState={learningStates[card.id]}
                        status={getUserWordStatus(card.id, learningStates)}
                        onSetStatus={onSetWordStatus}
                        onToggleFavorite={onToggleFavorite}
                        onEditCustom={
                          card.isCustom ? onOpenEditModal : sozlukKartiniKisisellestir
                        }
                        onDeleteCustom={
                          card.isCustom
                            ? onDeleteCustomWord
                            : (id: string) => onRemoveWordFromCollection(id, activeDeck.id)
                        }
                        sozlukKarti={!card.isCustom}
                        onOpenAddToCollection={onOpenAddToCollection}
                      />
                      <button
                        onClick={() => onRemoveWordFromCollection(card.id, activeDeck.id)}
                        className="mt-1.5 w-full py-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--danger)] text-center transition-colors hover:underline cursor-pointer"
                      >
                        Bu Setten Çıkar
                      </button>
                    </KelimeSatiri>
                  ))}
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pencereKartlari.map((card) => {
                  const state = learningStates[card.id];
                  const isSelected = selectedIds.has(card.id);

                  return (
                    <div
                      key={card.id}
                      className={`relative group rounded-2xl transition-shadow ${
                        isSelected ? 'ring-2 ring-[var(--primary)] ring-offset-2' : ''
                      }`}
                    >
                      {/*
                        Kutucuk artık karta bindirilmiyor; kartın kendi başlık
                        satırında, seviye rozetinin yanında duruyor. Bindirilen
                        eski hâli tam da rozetin üstüne geliyor ve A1/B2 gibi
                        seviyeleri görünmez yapıyordu.

                        Aşağıdaki üç geri çağrı doğrudan geçiliyor; WordCard
                        kartı/kimliği zaten kendisi veriyor. Satır içi ok
                        işlevleri her render'da yeni referans üretip
                        React.memo'yu kırıyordu.
                      */}
                      <WordCardComponent
                        isSelected={isSelected}
                        onToggleSelected={secimIsleyicisiAl(card.id)}
                        card={card}
                        isFavorite={favorites.includes(card.id)}
                        learningState={state}
                        status={getUserWordStatus(card.id, learningStates)}
                        onSetStatus={onSetWordStatus}
                        onToggleFavorite={onToggleFavorite}
                        onEditCustom={
                          card.isCustom ? onOpenEditModal : sozlukKartiniKisisellestir
                        }
                        onDeleteCustom={
                          card.isCustom
                            ? onDeleteCustomWord
                            : (id: string) => onRemoveWordFromCollection(id, activeDeck.id)
                        }
                        sozlukKarti={!card.isCustom}
                        onOpenAddToCollection={onOpenAddToCollection}
                      />

                      <button
                        onClick={() => onRemoveWordFromCollection(card.id, activeDeck.id)}
                        className="mt-1.5 w-full py-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--danger)] text-center transition-colors hover:underline cursor-pointer"
                      >
                        Bu Setten Çıkar
                      </button>
                    </div>
                  );
                })}
              </div>
              )}
              {pencereKartlari.length < gorunenKartlar.length && (
                <div ref={listeSonuRef} aria-hidden="true" className="h-px" />
              )}
              </>
            ) : sozlukBekleniyor ? (
              /*
               * SÖZLÜK BEKLENİYOR — BOŞ SET DEĞİL.
               *
               * Buraya düşmenin iki yolu var ve ikisi de "sette kelime yok"
               * DEĞİL: sözlük henüz yükleniyor, ya da yüklenemedi. İkisini
               * ayırmayan tek bir metin yazılamaz; birinde beklemek, diğerinde
               * yeniden denemek gerekiyor.
               */
              <div
                className="parsomen-panel bg-[var(--surface)] p-10 rounded-2xl border border-[var(--border)] text-center space-y-3 shadow-[0_1px_3px_rgba(30,36,48,0.03)]"
                aria-busy={sozlukDurumu === 'yukleniyor'}
                aria-live="polite"
              >
                {sozlukDurumu === 'hata' ? (
                  <>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-[var(--text-primary)]">Sözlük yüklenemedi</h4>
                      <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
                        Bu setteki {cozulemeyenUyelik} kelime sözlükten okunuyor ve
                        sözlük açılamadı. Kelimelerin duruyor, silinmediler.
                      </p>
                    </div>
                    {onSozlugüYenidenDene && (
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={onSozlugüYenidenDene}
                          className="dugme-birincil px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          Yeniden dene
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="h-5 w-40 mx-auto rounded-lg bg-[var(--surface-soft)] animate-pulse" />
                    <div className="h-3 w-full max-w-xs mx-auto rounded bg-[var(--surface-soft)] animate-pulse" />
                    <div className="h-3 w-2/3 max-w-[16rem] mx-auto rounded bg-[var(--surface-soft)] animate-pulse" />
                    <p className="text-xs text-[var(--text-secondary)] pt-1">
                      Bu setteki {cozulemeyenUyelik} kelime hazırlanıyor…
                    </p>
                  </>
                )}
              </div>
            ) : (
              /* Empty Set View */
              <div className="parsomen-panel bg-[var(--surface)] p-10 rounded-2xl border border-[var(--border)] text-center space-y-3 shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
                <RealmsIcon name="book" size={22} className="text-[var(--text-muted)] mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-[var(--text-primary)]">Henüz kelime yok</h4>
                  <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
                    Bu sette öğrenmek istediğin İngilizce kelimeleri biriktirebilirsin.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      resetAddWordModal();
                      setShowAddWordModal(true);
                    }}
                    className="dugme-birincil px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RealmsIcon name="add" size={18} />
                    <span>İlk Kelimemi Ekle</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* MODAL: YENİ KELİME SETİ OLUŞTUR */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="anlora-create-set-title"
          ref={createModalRef}
          className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[var(--text-primary)]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain">
          <div className="parsomen-panel bg-[var(--surface)] rounded-2xl max-w-md w-full border border-[var(--border)] shadow-xl p-6 space-y-4">
            <h3 id="anlora-create-set-title" className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <RealmsIcon name="sets" size={20} className="text-[var(--primary)]" />
              Yeni Kelime Seti Oluştur
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newDeckName.trim()) return;
                const created = onCreateCollection(
                  newDeckName.trim(),
                  newDeckDesc.trim() || undefined,
                  newDeckOptions.color,
                  newDeckOptions.iconName
                );
                /*
                 * Sıralama ve sabitleme oluşturma çağrısında yok; set
                 * kurulduktan hemen sonra tek güncellemeyle yazılıyor.
                 * Kullanıcı açısından fark yok — pencereyi kapattığında
                 * seçtiği her şey yerinde.
                 */
                if (newDeckOptions.sortMode || newDeckOptions.isPinned) {
                  onUpdateCollection({
                    ...created,
                    sortMode: newDeckOptions.sortMode,
                    isPinned: newDeckOptions.isPinned
                  });
                }
                setActiveDeckId(created.id);
                setNewDeckName('');
                setNewDeckDesc('');
                setNewDeckOptions({});
                setShowCreateModal(false);
              }}
              className="space-y-3.5"
            >
              <div>
                <label htmlFor={`${alanId}-yeni-set-adi`} className="block text-xs font-bold text-[var(--text-secondary)]  mb-1">
                  Set Adı <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  id={`${alanId}-yeni-set-adi`}
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="Örn: B2 Kelimelerim, İş İngilizcesi..."
                  required
                  autoFocus
                  className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] font-semibold text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label htmlFor={`${alanId}-yeni-set-aciklama`} className="block text-xs font-bold text-[var(--text-secondary)]  mb-1">
                  Açıklama (İsteğe Bağlı)
                </label>
                <input
                  id={`${alanId}-yeni-set-aciklama`}
                  type="text"
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  placeholder="Örn: Bu setteki kelimeler..."
                  className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none text-[var(--text-primary)]"
                />
              </div>

              <DeckOptionFields
                deger={newDeckOptions}
                degistir={setNewDeckOptions}
                renkler={SET_RENKLERI}
                simgeler={DECK_ICONS}
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="dugme-birincil px-4 py-2 bg-[var(--primary)] text-[var(--on-primary)] text-xs font-semibold rounded-xl hover:bg-[var(--primary-hover)] cursor-pointer"
                >
                  Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SETİ DÜZENLE */}
      {editingDeck && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="anlora-edit-set-title"
          ref={editDeckRef}
          className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[var(--text-primary)]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain">
          <div className="parsomen-panel bg-[var(--surface)] rounded-2xl max-w-md w-full border border-[var(--border)] shadow-xl p-6 space-y-4">
            <h3 id="anlora-edit-set-title" className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-[var(--primary)]" />
              Seti Düzenle
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateCollection(editingDeck);
                setEditingDeck(null);
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor={`${alanId}-set-adi`} className="block text-xs font-bold text-[var(--text-secondary)]  mb-1">
                  Set Adı
                </label>
                <input
                  id={`${alanId}-set-adi`}
                  type="text"
                  value={editingDeck.name}
                  onChange={(e) => setEditingDeck({ ...editingDeck, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl font-bold text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label htmlFor={`${alanId}-set-aciklama`} className="block text-xs font-bold text-[var(--text-secondary)]  mb-1">
                  Açıklama
                </label>
                <input
                  id={`${alanId}-set-aciklama`}
                  type="text"
                  value={editingDeck.description || ''}
                  onChange={(e) =>
                    setEditingDeck({ ...editingDeck, description: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text-primary)]"
                />
              </div>

              {/*
                Dört seçenek ortak bileşende: aynı alanlar yeni set
                oluştururken de gösteriliyor. İkisine ayrı ayrı yazılsalardı
                biri değiştiğinde diğeri sessizce geride kalırdı.
              */}
              <DeckOptionFields
                deger={editingDeck}
                degistir={yeniDeger => setEditingDeck({ ...editingDeck, ...yeniDeger })}
                renkler={SET_RENKLERI}
                simgeler={DECK_ICONS}
              />

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingDeck(null)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="dugme-birincil px-4 py-2 bg-[var(--primary)] text-[var(--on-primary)] text-xs font-semibold rounded-xl hover:bg-[var(--primary-hover)] cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KELİME EKLEME (AI / MANUEL SEÇENEKLERİ) */}
      {showAddWordModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="anlora-add-word-title"
          ref={addWordModalRef}
          className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[var(--text-primary)]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain">
          <div className="parsomen-panel bg-[var(--surface)] rounded-2xl max-w-lg w-full border border-[var(--border)] shadow-xl p-6 sm:p-7 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <h3 id="anlora-add-word-title" className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <RealmsIcon name="add" size={20} className="text-[var(--primary)]" />
                Yeni Kelime Ekle
              </h3>
              <span className="text-xs font-bold text-[var(--primary)] bg-[var(--primary-soft)] px-2.5 py-1 rounded-lg border border-[var(--primary-border)]">
                {activeDeck?.name}
              </span>
            </div>

            {lastAddedWord && (
              <div className="px-3.5 py-2.5 rounded-xl bg-[var(--learned-soft)] border border-[var(--learned-border)] text-[var(--learned-text)] text-xs font-semibold flex items-center gap-2">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <b>{lastAddedWord}</b> sete eklendi. Bir kelime daha ekleyebilirsin.
                </span>
              </div>
            )}

            {/*
              ADIM 1: KELİMENİN KENDİSİ.

              Zorunlu olan yalnızca İngilizce kelime ve Türkçe anlamı. Sözcük
              türü isteğe bağlıdır: kullanıcı "ne olduğundan emin değilim"
              diyebilmeli, uydurma bir tür seçmek zorunda kalmamalı. Bağlam
              kutusu da isteğe bağlıdır.
            */}
            {creationMode === 'FORM' && (
              <form onSubmit={handleSaveManualCard} className="space-y-4">
                <div>
                  <label htmlFor={`${alanId}-ingilizce`} className="block text-xs font-bold text-[var(--text-secondary)]  mb-1">
                    İngilizce Kelime <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    id={`${alanId}-ingilizce`}
                    type="text"
                    value={wordInput}
                    /*
                      KÜÇÜK HARFE ÇEVRİLİYOR. Sözlükteki 5.323 kaydın tamamı
                      küçük harfli (ölçüldü: büyük harf içeren kayıt yok).
                      Android klavyesi cümle başındaki harfi kendiliğinden
                      büyütüyor; kullanıcı "Abondon" yazdığında kart sözlükten
                      ayrı düşüyor, aynı kelime iki farklı yazımla birikiyordu.
                    */
                    onChange={(e) => setWordInput(e.target.value.toLowerCase())}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Örn: reluctant, achieve, scrutinize..."
                    required
                    autoFocus
                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] font-bold text-[var(--text-primary)]"
                  />
                </div>

                {/* SÖZLÜK SONUCU — aynı ekranda, ayrı pencere açmadan */}
                {lookup.kind === 'searching' && (
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sözlükte aranıyor…</span>
                  </div>
                )}

                {lookup.kind === 'in-set' && (
                  <div className="p-3.5 rounded-xl bg-[var(--learning-soft)] border border-[var(--learning-border)] text-[11px] text-[var(--learning-text)] space-y-2">
                    <p className="font-bold">
                      "{lookup.card.word}" bu sette zaten var.
                    </p>
                    <p>
                      Farklı bir anlamı için ikinci bir kart istiyorsan aşağıdaki
                      alanları doldurup kaydedebilirsin.
                    </p>
                  </div>
                )}

                {/*
                  Yapay zekâ YALNIZCA kelime sözlükte yoksa önerilir.
                  Sözlükte hazır bir kart varken yapay zekâ çağırmak hem
                  gereksiz beklemek hem de elde olan doğrulanmış içeriği
                  bir kenara atmak olurdu.

                  KONUMU: İngilizce kelime alanının hemen altı — sözlükte
                  BULUNDU kutusunun çıktığı yer. Önceden formun en altında,
                  Kaydet düğmesinden de sonra duruyordu; kelimenin sözlükte
                  olmadığını gören kullanıcı, önerilen çıkış yolunu görmek
                  için bütün formu geçip aşağı inmek zorundaydı. Cevap,
                  sorunun sorulduğu yerde durmalı.
                */}
                {/*
                  Yapay zekâ sunucu ister. Sunucusuz dağıtımda düğme hiç
                  çizilmez; yerine kullanıcıya durumu söyleyen bir satır kalır.
                  Basıldığında hata veren bir düğme, olmayan düğmeden kötüdür.
                */}
                {/*
                  Yoklama sürerken hiçbir hüküm verilmiyor: ne "kendin yaz"
                  ne de yapay zekâ düğmesi. Yerine ne olduğunu söyleyen tek
                  satır duruyor, böylece kutu boşalıp dolmuyor ve kullanıcı
                  yanlış bir bilgiyle karşılaşmıyor.
                */}
                {/*
                  YAZIM ÖNERİSİ — "bunu mu demek istedin?"
                  Yalnızca kelime hiçbir yerel listede yokken ve yakın bir
                  aday varken çiziliyor. Sözlükte BULUNAN bir kelimede bu kutu
                  hiç görünmez; orada düzeltilecek bir şey yoktur.
                */}
                {lookup.kind === 'not-found' && lookup.oneriler.length > 0 && (
                  <div
                    className="pt-3 border-t border-[var(--border-light)] space-y-2"
                    aria-live="polite"
                  >
                    <div className="text-[11px] font-bold text-[var(--text-muted)] tracking-wider">
                      {yazimOnayBekliyor ? 'ÖNCE ŞUNU SORAYIM' : 'YAZIMI KONTROL ET'}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      <span className="font-bold text-[var(--text-primary)]">
                        “{wordInput.trim()}”
                      </span>{' '}
                      sözlüklerimizde yok. Bunu mu demek istedin?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {lookup.oneriler.map(oneri => (
                        <button
                          key={oneri}
                          type="button"
                          onClick={() => {
                            setWordInput(oneri);
                            setYazimOnayBekliyor(false);
                          }}
                          className="px-3 py-2 rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-bold cursor-pointer hover:bg-[var(--primary-soft)]/70"
                        >
                          {oneri}
                        </button>
                      ))}
                    </div>
                    {yazimOnayBekliyor && (
                      <button
                        type="button"
                        onClick={() => handleExecuteAiGeneration()}
                        className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] text-xs font-semibold cursor-pointer hover:bg-[var(--surface-soft)] text-left"
                      >
                        Hayır, “{wordInput.trim()}” doğru — ✨ Anlora AI ile hazırla
                      </button>
                    )}
                  </div>
                )}

                {lookup.kind === 'not-found' && yapayZekaBekleniyor && (
                  <div className="pt-3 border-t border-[var(--border-light)] space-y-1">
                    {lookup.oneriler.length === 0 && (
                      <div className="text-[11px] font-bold text-[var(--text-muted)]  tracking-wider">
                        Bu kelime sözlükte yok
                      </div>
                    )}
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      Anlora AI'nın bu kurulumda kullanılabilir olup olmadığı
                      denetleniyor…
                    </p>
                  </div>
                )}

                {lookup.kind === 'not-found' && yapayZeka === false && (
                  <div className="pt-3 border-t border-[var(--border-light)] space-y-1">
                    {lookup.oneriler.length === 0 && (
                      <div className="text-[11px] font-bold text-[var(--text-muted)]  tracking-wider">
                        Bu kelime sözlükte yok
                      </div>
                    )}
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      Anlamını ve örnek cümlelerini aşağıdaki alanlara kendin
                      yazabilirsin; kart aynı şekilde kaydedilir.
                    </p>
                  </div>
                )}

                {/*
                  Soru sorulduğu sırada büyük yapay zekâ kartı ÇİZİLMİYOR.
                  Kalsaydı ilk dokunuştan sonra ekranda hiçbir şey değişmemiş
                  gibi görünürdü: kullanıcı düğmenin bozuk olduğunu sanır ve
                  üstüne basmaya devam ederdi. Şimdi seçenekler iki tane ve
                  ikisi de açık: önerilen kelime, ya da "kendi yazdığımla
                  devam et".
                */}
                {lookup.kind === 'not-found' && yapayZekaVar && !yazimOnayBekliyor && (
                <div className="pt-3 border-t border-[var(--border-light)] space-y-2">
                  {lookup.oneriler.length === 0 && (
                    <div className="text-[11px] font-bold text-[var(--text-muted)]  tracking-wider">
                      Bu kelime sözlükte yok
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCheckAndProceedWithAi}
                    disabled={!wordInput.trim()}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      wordInput.trim()
                        ? 'border-[var(--primary-border)] bg-[var(--primary-soft)]/70 hover:bg-[var(--primary-soft)] cursor-pointer'
                        : 'border-[var(--border)] bg-[var(--bg)] opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-[var(--text-primary)]">
                          ✨ Anlora AI ile hazırla
                        </h4>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          Türkçe anlamı, kelime türünü ve örnek cümleleri senin
                          yerine hazırlasın. Sonuç kaydedilmeden önce sana gösterilir.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
                )}

                {lookup.kind === 'found' && (
                  <div className="p-4 rounded-xl bg-[var(--learned-soft)] border border-[var(--learned-border)] space-y-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--learned-text)]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Bu kelime Anlora sözlüğünde bulunuyor</span>
                    </div>

                    <div className="bg-white rounded-xl border border-[var(--learned-border)] p-3 space-y-1.5">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-base font-bold text-[var(--text-primary)]">
                          {lookup.card.word}
                        </span>
                        {lookup.card.phonetic && (
                          <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                            {formatPhonetic(lookup.card.phonetic)}
                          </span>
                        )}
                        {lookup.card.partOfSpeech && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-[var(--surface-soft)] text-[var(--text-secondary)] rounded">
                            {lookup.card.partOfSpeech}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {lookup.card.turkishMeaning}
                      </p>
                      {lookup.card.examples.length > 0 && (
                        <p className="text-[11px] text-[var(--text-secondary)] italic">
                          Örnek: {lookup.card.examples[0].en}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--learned)] font-semibold pt-0.5">
                        Anlamı ve {lookup.card.examples.length >= 3 ? 'üç' : lookup.card.examples.length}{' '}
                        örnek cümlesi hazır — çeviriyle birlikte.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => addLookedUpCard(lookup.card, lookup.source)}
                      className="w-full py-2.5 bg-[var(--learned)] hover:bg-[var(--learned-hover)] text-[var(--surface)] text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RealmsIcon name="add" size={20} />
                      <span>Bu kelimeyi sete ekle</span>
                    </button>

                    <p className="text-[10px] text-[var(--learned-text)] text-center">
                      Kendi anlamını yazmak istersen aşağıdaki alanları doldur.
                    </p>
                  </div>
                )}

                {/*
                  KAYIT TÜRÜ.
                  Girişte boşluk ya da tire varsa 'Kalıp' önerilir ama karar
                  kullanıcınındır: deyim ile kalıbın sınırı biçimden değil
                  anlamdan gelir, o yüzden 'Deyim' asla kendiliğinden
                  seçilmez. Alan Türkçe anlamın ÜSTÜNDE duruyor çünkü
                  kullanıcı ne eklediğini önce burada söylüyor.
                */}
                <div>
                  {/*
                    Bu başlık tek bir girdiye değil, üç düğmelik bir seçime ait.
                    `<label>` olarak yazıldığında ekran okuyucu onu hiçbir
                    denetime bağlayamıyor ve kullanıcı düğmelere geldiğinde
                    neyi seçtiğini duymuyordu; başlık artık gruba veriliyor.
                  */}
                  <span
                    id={`${alanId}-kayit-turu`}
                    className="block text-xs font-bold text-[var(--text-secondary)]  mb-1.5"
                  >
                    Ne ekliyorsun?
                  </span>
                  <div
                    role="group"
                    aria-labelledby={`${alanId}-kayit-turu`}
                    className="grid grid-cols-3 gap-1.5"
                  >
                    {([
                      { id: 'word' as const, label: 'Kelime', ornek: 'reluctant' },
                      { id: 'phrase' as const, label: 'Kalıp', ornek: 'give up' },
                      { id: 'idiom' as const, label: 'Deyim', ornek: 'break the ice' }
                    ]).map(secenek => {
                      const gecerli = manualEntryType || onerilenTur(wordInput);
                      const secili = gecerli === secenek.id;
                      return (
                        <button
                          key={secenek.id}
                          type="button"
                          onClick={() => setManualEntryType(secenek.id)}
                          aria-pressed={secili}
                          className={`px-2 py-2 rounded-xl border text-center transition-all cursor-pointer ${
                            secili
                              ? 'dugme-birincil bg-[var(--primary)] border-[var(--primary)] text-[var(--on-primary)]'
                              : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
                          }`}
                        >
                          <span className="block text-[11px] font-bold leading-none">{secenek.label}</span>
                          <span
                            className={`block text-[9px] mt-1 leading-none ${
                              secili ? 'text-[var(--on-primary)]' : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {secenek.ornek}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {manualEntryType === null && /[\s-]/.test(wordInput.trim()) && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      Birden fazla sözcük yazdın; "Kalıp" seçili sayılıyor. Anlamı sözcüklerinden
                      çıkmıyorsa "Deyim"i seç.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`${alanId}-turkce`} className="block text-xs font-bold text-[var(--text-secondary)]  mb-1">
                    Türkçe Anlamı <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    id={`${alanId}-turkce`}
                    type="text"
                    value={manualTurkishMeaning}
                    onChange={(e) => setManualTurkishMeaning(e.target.value)}
                    placeholder="Örn: isteksiz, gönülsüz"
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label htmlFor={`${alanId}-kelime-turu`} className="block text-xs font-bold text-[var(--text-secondary)]  mb-1">
                    Kelime Türü <span className="font-semibold normal-case text-[var(--text-muted)]">(isteğe bağlı)</span>
                  </label>
                  <select
                    id={`${alanId}-kelime-turu`}
                    value={manualPartOfSpeech}
                    onChange={(e) => setManualPartOfSpeech(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] font-semibold text-[var(--text-primary)]"
                  >
                    <option value="">Boş bırak / Bilmiyorum</option>
                    <option value="n.">İsim (n.)</option>
                    <option value="v.">Fiil (v.)</option>
                    <option value="adj.">Sıfat (adj.)</option>
                    <option value="adv.">Zarf (adv.)</option>
                    <option value="prep.">Edat (prep.)</option>
                    <option value="conj.">Bağlaç (conj.)</option>
                    <option value="phrase">Kalıp (phrase)</option>
                  </select>
                </div>

                {/*
                  ÖRNEK CÜMLELER.

                  Sözlükten gelen her kelime üç örnek cümleyle geliyor; elle
                  eklenen kelimede bu alan boş kalırsa kart, uygulamanın geri
                  kalanından daha zayıf olur. Alanlar isteğe bağlıdır ama
                  görünürdür: kullanıcı doldurmayı seçebilsin diye.
                */}
                {/*
                  Tek etiket, altı ayrı girdi. Etiketi bir tanesine bağlamak
                  yanlış olurdu: başlık gruba, ad da her kutuya ayrı ayrı
                  veriliyor — ipucu metni doldurulunca kayboluyor ve ekran
                  okuyucuya ad bırakmıyordu.
                */}
                <div
                  role="group"
                  aria-labelledby={`${alanId}-ornekler`}
                  className="space-y-2"
                >
                  <span
                    id={`${alanId}-ornekler`}
                    className="block text-xs font-bold text-[var(--text-secondary)] "
                  >
                    Örnek Cümleler{' '}
                    <span className="font-semibold normal-case text-[var(--text-muted)]">(isteğe bağlı)</span>
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    Kelimeyi cümle içinde görmek kalıcı öğrenmenin en hızlı yolu.
                    Sözlükten gelen kelimelerde üç örnek hazır gelir; kendi
                    kelimende de yazabilirsin.
                  </p>
                  {manualExamples.slice(0, 3).map((ex, i) => (
                    <div key={i} className="grid grid-cols-1 gap-1.5">
                      <input
                        type="text"
                        value={ex.en}
                        onChange={e => handleExampleChange(i, 'en', e.target.value)}
                        placeholder={`${i + 1}. örnek (İngilizce)`}
                        aria-label={`${i + 1}. örnek — İngilizce`}
                        className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                      />
                      {ex.en.trim() && (
                        <input
                          type="text"
                          value={ex.tr}
                          onChange={e => handleExampleChange(i, 'tr', e.target.value)}
                          placeholder={`${i + 1}. örneğin Türkçesi`}
                          aria-label={`${i + 1}. örnek — Türkçe`}
                          className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] italic text-[var(--text-secondary)]"
                        />
                      )}
                    </div>
                  ))}
                  {manualExamples.length < 3 && (
                    <button
                      type="button"
                      onClick={() => setManualExamples(list => [...list, { en: '', tr: '' }])}
                      className="text-[11px] font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] cursor-pointer"
                    >
                      + Bir örnek daha ekle
                    </button>
                  )}
                </div>

                <div>
                  <label htmlFor={`${alanId}-baglam`} className="block text-xs font-bold text-[var(--text-secondary)]  mb-1">
                    Bağlam ya da Not{' '}
                    <span className="font-semibold normal-case text-[var(--text-muted)]">(isteğe bağlı)</span>
                  </label>
                  <textarea
                    id={`${alanId}-baglam`}
                    value={contextInput}
                    onChange={(e) => setContextInput(e.target.value)}
                    placeholder="Kelimeyi gördüğün cümle ya da kendi notun..."
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none italic text-[var(--text-primary)]"
                  />
                </div>

                {/*
                  YAPAY ZEKÂNIN YAZIM UYARISI.

                  Yerel listede aday çıkmadığında ikinci denetim bu. Yapay
                  zekâ kelimeyi tanımıyorsa artık kart UYDURMUYOR; bunun yerine
                  kelimenin İngilizce olmadığını söylüyor ve varsa doğrusunu
                  öneriyor. Kullanıcı önerilen kelimeyi seçebilir ya da kendi
                  yazdığında ısrar edebilir — ikinci istek uyarıyı atlar,
                  çünkü sözlük de model de yanılabilir ve son söz kullanıcıda.
                */}
                {yapayZekaYazimUyarisi && (
                  <div
                    className="p-3 bg-[var(--learning-soft)] rounded-xl border border-[var(--learning-border)] text-xs space-y-2"
                    aria-live="polite"
                  >
                    <div className="flex items-start gap-2 text-[var(--learning-text)] font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        “{wordInput.trim()}” bir İngilizce kelime gibi görünmüyor.
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {yapayZekaYazimUyarisi.onerilen && (
                        <button
                          type="button"
                          onClick={() => {
                            setWordInput(yapayZekaYazimUyarisi.onerilen);
                            setYapayZekaYazimUyarisi(null);
                          }}
                          className="px-3 py-2 rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-bold cursor-pointer"
                        >
                          {yapayZekaYazimUyarisi.onerilen}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleExecuteAiGeneration(true)}
                        className="text-xs text-[var(--text-secondary)] underline underline-offset-2 cursor-pointer"
                      >
                        Yazdığım doğru, yine de dene
                      </button>
                    </div>
                  </div>
                )}

                {/* AI hata bildirimi */}
                {aiError && (
                  <div className="p-3 bg-[var(--danger-soft)] rounded-xl border border-[var(--danger-border)] text-xs">
                    <div className="flex items-start gap-2 text-[var(--danger)] font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{aiError}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetAddWordModal}
                    className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] rounded-xl cursor-pointer"
                  >
                    Kapat
                  </button>
                  <button
                    type="submit"
                    className="dugme-birincil px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Kartı Kaydet</span>
                  </button>
                </div>

              </form>
            )}

            {/* AI LOADING SKELETON LOADER */}
            {creationMode === 'AI_GENERATING' && (
              <div className="py-10 text-center space-y-4">
                <div className="w-10 h-10 border-3 border-[var(--primary-border)] border-t-[var(--primary)] rounded-full animate-spin mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    Anlora kelime kartını hazırlıyor...
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Anlamlar ve örnek cümleler hazırlanıyor...
                  </p>
                </div>
              </div>
            )}

            {/* AI PREVIEW CARD */}
            {creationMode === 'AI_PREVIEW' && generatedPreviewCard && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-xs font-bold text-[var(--learned)] flex items-center gap-1.5 pb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Kelime kartın hazır.</span>
                </div>

                {/*
                  DOĞRULANMADI UYARISI.

                  İçerik yapay zekâ tarafından üretildi ve henüz kimse
                  denetlemedi. Bunu söylememek, uydurulmuş olabilecek bir
                  anlamı sözlük bilgisiymiş gibi göstermek olurdu. Kullanıcı
                  kaydetmeden önce gözden geçirebilsin diye kartın üstünde
                  duruyor.
                */}
                <div className="p-3 rounded-xl bg-[var(--learning-soft)] border border-[var(--learning-border)] text-[11px] text-[var(--learning-text)] leading-relaxed">
                  <b>Otomatik hazırlandı, doğrulanmadı.</b> Anlamı ve örnekleri
                  kaydetmeden önce bir okuyup gözden geçir; yanlış bir yer varsa
                  "Düzenle" ile değiştirebilirsin.
                </div>
                <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-2xl font-bold text-[var(--text-primary)] flex items-baseline gap-2">
                        {generatedPreviewCard.word}
                        {generatedPreviewCard.phonetic && (
                          <span className="text-xs font-mono text-[var(--text-secondary)] font-normal">
                            {generatedPreviewCard.phonetic}
                          </span>
                        )}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">
                          {generatedPreviewCard.partOfSpeech}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
              onClick={() => speakText(generatedPreviewCard.word)}
                      className="p-2 rounded-xl bg-white border border-[var(--border)] text-[var(--primary)] hover:bg-[var(--primary-soft)] cursor-pointer"
                      title="Dinle"
                    >
                      <RealmsIcon name="audio" size={20} />
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[var(--border)]">
                    <div className="text-[10px] font-bold text-[var(--primary)] ">
                      Türkçe Anlamı
                    </div>
                    <div className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                      {generatedPreviewCard.turkishMeaning}
                    </div>
                  </div>

                  {generatedPreviewCard.examples && generatedPreviewCard.examples.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-bold text-[var(--text-muted)]  tracking-wider">
                        Örnek Cümleler
                      </div>
                      {generatedPreviewCard.examples.map((ex, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-white rounded-lg border border-[var(--border)] text-xs space-y-0.5"
                        >
                          <p className="font-semibold text-[var(--text-primary)]">{ex.en}</p>
                          <p className="text-[var(--text-secondary)] italic text-[11px]">"{ex.tr}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Preview Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setManualTurkishMeaning(generatedPreviewCard.turkishMeaning);
                      setManualPartOfSpeech(generatedPreviewCard.partOfSpeech || '');
                      setManualExamples(
                        generatedPreviewCard.examples?.length
                          ? generatedPreviewCard.examples
                          : [{ en: '', tr: '' }]
                      );
                      setCreationMode('FORM');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-soft)] hover:bg-[var(--border)] rounded-xl cursor-pointer"
                  >
                    Düzenle
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAiCard}
                    className="dugme-birincil px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Kaydet</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL: SEÇİLENLERİ TAŞI / KOPYALA */}
      {bulkTarget && activeDeck && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="anlora-bulk-move-title"
          ref={bulkModalRef}
          className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[var(--text-primary)]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain">
          <div className="parsomen-panel bg-[var(--surface)] rounded-2xl max-w-md w-full border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="anlora-bulk-move-title" className="text-base font-bold text-[var(--text-primary)]">
                {selectedIds.size} kelimeyi {bulkTarget === 'move' ? 'taşı' : 'kopyala'}
              </h3>
              <button
                type="button"
                onClick={() => setBulkTarget(null)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {bulkTarget === 'move'
                ? 'Kelimeler bu setten çıkıp seçtiğin sete geçecek. Kartlar ve ilerlemen silinmez.'
                : 'Kelimeler iki sette birden duracak. Kart tek kalır, ilerlemen ortaktır.'}
            </p>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {collections
                .filter(deck => deck.id !== activeDeck.id)
                .map(deck => (
                  <button
                    key={deck.id}
                    type="button"
                    onClick={() => moveSelected(deck.id, bulkTarget)}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary-border)] transition-colors cursor-pointer flex items-center gap-2.5"
                  >
                    <span
                      className="hanedan-kapak w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ '--hanedan': setRengi(deck.color) } as React.CSSProperties}
                    >
                      <DeckIcon name={deck.iconName} className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-[var(--text-primary)] truncate">
                        {deck.name}
                      </span>
                      <span className="block text-[10px] text-[var(--text-secondary)]">
                        {memberships.filter(m => m.collectionId === deck.id).length} kelime
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SET BİRLEŞTİR */}
      {showMerge && activeDeck && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="anlora-merge-title"
          ref={mergeModalRef}
          className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[var(--text-primary)]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain">
          <div className="parsomen-panel bg-[var(--surface)] rounded-2xl max-w-md w-full border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="anlora-merge-title" className="text-base font-bold text-[var(--text-primary)]">Seti bu sete kat</h3>
              <button
                type="button"
                onClick={() => setShowMerge(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Seçtiğin setteki kelimeler <b className="text-[var(--text-primary)]">{activeDeck.name}</b> setine
              eklenir, sonra o set silinir. <b>Kelimeler silinmez</b> — yalnızca setin kendisi
              ortadan kalkar. Zaten burada olan kelime ikinci kez eklenmez.
            </p>

            <select
              value={mergeSource}
              onChange={e => setMergeSource(e.target.value)}
              aria-label="Katılacak set"
              className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl font-semibold text-[var(--text-primary)]"
            >
              <option value="">Katılacak seti seç…</option>
              {collections
                .filter(deck => deck.id !== activeDeck.id)
                .map(deck => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name} ({memberships.filter(m => m.collectionId === deck.id).length} kelime)
                  </option>
                ))}
            </select>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMerge(false)}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] rounded-xl cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={mergeInto}
                disabled={!mergeSource}
                className="dugme-birincil px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] text-xs font-bold rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Katıp seti sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CSV'DEN EKLE */}
      {showImport && activeDeck && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="anlora-import-title"
          ref={importModalRef}
          className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[var(--text-primary)]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain">
          <div className="parsomen-panel bg-[var(--surface)] rounded-2xl max-w-lg w-full border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="anlora-import-title" className="text-base font-bold text-[var(--text-primary)]">CSV'den kelime ekle</h3>
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[var(--learning-soft)] border border-[var(--learning-border)] text-[11px] text-[var(--learning-text)] leading-relaxed">
              En az <b>kelime</b> ve <b>anlamlar</b> sütunları gerekli. İsteğe bağlı:{' '}
              <b>telaffuz, seviye, tur, ornek1_en, ornek1_tr</b>. Excel'den kaydettiğin dosyayı
              açıp içeriğini buraya yapıştırabilirsin. Sette zaten olan kelime atlanır. Örnek
              dosyayı "CSV" düğmesiyle indirebilirsin.
            </div>

            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              rows={8}
              aria-label="CSV içeriği"
              placeholder={'kelime;anlamlar\nthrive;gelişmek'}
              className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] font-mono text-[var(--text-primary)]"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] rounded-xl cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={importDeckCsv}
                disabled={!importText.trim()}
                className="dugme-birincil px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] text-xs font-bold rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DUPLICATE & CONFLICT WARNING */}
      <DuplicateWarningModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        duplicateInfo={duplicateResult}
        onAddExistingToCollection={() => {
          if (duplicateResult?.matchedWordCard && activeDeck) {
            onAddWordToCollection(
              duplicateResult.matchedWordCard.id,
              activeDeck.id,
              contextInput.trim() || undefined
            );
            setShowDuplicateModal(false);
            resetAddWordModal();
          }
        }}
        onForceCreateNew={() => {
          setShowDuplicateModal(false);
          if (duplicateOrigin === 'AI') {
            handleExecuteAiGeneration();
            return;
          }
          // Elle doldurulmuş formu kaydet; kullanıcının yazdıkları korunur.
          saveManualCard(true);
        }}
        onUseBaseForm={(baseForm) => {
          setWordInput(baseForm);
          setShowDuplicateModal(false);
          handleExecuteAiGeneration();
        }}
        onViewCard={(card) => {
          onOpenEditModal(card);
        }}
      />

      {/*
        MODAL: BATCH WORD ADD

        `key` HER AÇILIŞTA DEĞİŞİYOR — bilerek. Bu pencere kapanınca DOM'dan
        kalkmıyor, yalnızca `null` döndürüyor; durumu (yapıştırılan liste,
        ayıklanan kelimeler, seçimler) olduğu gibi duruyordu. Kullanıcı toplu
        ekleme yapıp kapattıktan sonra yeniden açtığında BOŞ bir sayfa değil,
        bir önceki turun kelimelerini görüyordu.

        Anahtar değişince React bileşeni söküp yeniden kuruyor, yani her açılış
        temiz bir sayfayla başlıyor. Durumu tek tek sıfırlamak yerine bu yol
        seçildi: yeni bir alan eklendiğinde sıfırlama listesine yazmayı unutmak
        aynı hatayı sessizce geri getirirdi.
      */}
      <BatchWordModal
        key={showBatchModal ? 'toplu-acik' : 'toplu-kapali'}
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        targetCollection={activeDeck}
        collections={collections}
        memberships={memberships}
        customWords={customWords}
        oxfordWords={oxfordWords}
        onAddCustomWord={(card, cId) => onAddCustomWord(card, cId)}
        onLinkWordToCollection={(wId, cId) => onAddWordToCollection(wId, cId)}
        onKuyrugaEkle={onTopluKuyrugaEkle}
        onBatchProcessComplete={(stats) => {
          /*
           * Sonuç sessizce yutulmasın. Burada `console.log` vardı: pencere
           * kapanıyor, sette birkaç kart beliriyor ve kullanıcıya ne olduğunu
           * söyleyen hiçbir şey yoktu. Kuyruğa alınanlar ayrıca söyleniyor,
           * çünkü onlar HENÜZ eklenmedi -- setin üstündeki satır onları
           * takip ediyor.
           */
          const parcalar: string[] = [];
          if (stats.addedCount) parcalar.push(`${stats.addedCount} kelime eklendi`);
          if (stats.linkedCount) parcalar.push(`${stats.linkedCount} kelime bağlandı`);
          if (stats.skippedCount) parcalar.push(`${stats.skippedCount} atlandı`);
          if (stats.kuyrugaAlinan)
            parcalar.push(`${stats.kuyrugaAlinan} kelime arka planda hazırlanıyor`);
          if (parcalar.length) setSetNotice(parcalar.join(', ') + '.');
        }}
      />

      {/*
        MODAL: TEXT MINER

        Aynı sebep, aynı çözüm (bkz. yukarıdaki toplu ekleme penceresi).
        Burada iz daha da görünürdü: kullanıcı "Vazgeç" dese bile bir sonraki
        açılışta önceki metin İngilizce kutusunda duruyor, ayıklanmış kelime
        listesi de ekranda kalıyordu; devam etmek için önce elle silmek
        gerekiyordu.
      */}
      <TextMinerModal
        key={showMinerModal ? 'madenci-acik' : 'madenci-kapali'}
        isOpen={showMinerModal}
        onClose={() => setShowMinerModal(false)}
        collections={collections}
        customWords={customWords}
        oxfordWords={oxfordWords}
        learningStates={learningStates}
        onAddMinedWordsToCollection={(items, targetColId) => {
          items.forEach((item) => {
            if (item.matchedCard) {
              // Kelimenin metinde geçtiği cümle karta iliştirilir; "metinden
              // yakala" özelliğinin asıl değeri bu bağlamdır.
              onAddWordToCollection(
                item.matchedCard.id,
                targetColId,
                item.contextSentence
              );
            } else {
              const newCard: WordCard = {
                id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                word: item.lemma || item.rawWord,
                // Sözcük türü bilinmiyor; "n." varsaymak kartın yarısını
                // baştan yanlış doldurur.
                partOfSpeech: '',
                // Anlam boş bırakılır. Önceki sürüm buraya İNGİLİZCE kelimenin
                // kendisini yazıyordu ("run" -> turkishMeaning: "run"); bu,
                // sunucudaki doğrulayıcının bile reddettiği bir durum ve
                // öğrenciye hiçbir şey öğretmez.
                turkishMeaning: '',
                examples: [],
                isCustom: true,
                sourceType: 'custom',
                sourceContext: item.contextSentence,
                dateAdded: new Date().toISOString().slice(0, 10)
                // isAiGenerated işaretlenmez: bu kartı yapay zekâ üretmedi.
              };
              onAddCustomWord(newCard, targetColId, item.contextSentence);
            }
          });
        }}
      />
    </div>
  );
};
