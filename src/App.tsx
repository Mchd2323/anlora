import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { TodayDashboard } from './components/TodayDashboard';
import { CollectionsView } from './components/CollectionsView';
import { StudySessionView } from './components/StudySessionView';
import { OxfordExplorer } from './components/OxfordExplorer';
import { QuizModule } from './components/QuizModule';
import { StatsAndBadges } from './components/StatsAndBadges';
import { FavoritesView } from './components/FavoritesView';
import { ProfileView } from './components/ProfileView';
import { AuthModal } from './components/AuthModal';
import { AdminShell } from './components/admin/AdminShell';
import { FeedbackModal, FeedbackKind } from './components/FeedbackModal';
import { useAppContent } from './hooks/useAppContent';
import { AddToCollectionModal } from './components/AddToCollectionModal';
import { EditCardModal } from './components/EditCardModal';

import { getOxford3000Words, getOxford5000ExtraWords, loadOxfordCore } from './data/oxfordWords';
import {
  WordCard,
  Level,
  Collection,
  CollectionMembership,
  LearningState,
  UserStats,
  UserProfile,
  UserSettings,
  ResponseQuality,
  StudySessionSummary,
  QuizSessionSummary
} from './types';
import {
  runV1toV2MigrationIfNeeded,
  getCollectionsV2,
  createCollectionV2,
  updateCollectionV2,
  deleteCollectionV2,
  getMembershipsV2,
  addWordToCollectionV2,
  removeWordFromCollectionV2,
  getCustomWordsV2,
  addCustomWordV2,
  updateCustomWordV2,
  deleteCustomWordV2,
  getAllLearningStatesV2,
  recordStudyResultV2,
  getFavoritesV2,
  toggleFavoriteV2,
  getUserStatsV2,
  recordQuizResultV2,
  clearMistakeV2,
  getUnlockedBadgesV2,
  checkAndUnlockBadgesV2,
  getUserSettingsV2,
  saveUserSettingsV2,
  getUserProfileV2,
  saveUserProfileV2,
  setUserWordStatus
} from './utils/storageV2';
import { apiFetch, logout } from './utils/authClient';
import { runOxfordIdMigrationIfNeeded } from './utils/oxfordIdMigration';
import { OxfordGroupKey } from './types/oxford';
import { loadExtendedIndex } from './services/extendedRepository';
import { useToast } from './components/ui/ToastProvider';
import { useAndroidBackButton } from './hooks/useAndroidBackButton';
import { releaseStuckScrollLocks } from './hooks/useModalA11y';

export default function App() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('today');

  // Android donanım geri tuşu: uygulamadan çıkmak yerine önce modali kapatır,
  // sonra ana sekmeye döner.
  const goToRootTab = useCallback(() => setActiveTab('today'), []);
  useAndroidBackButton(activeTab === 'today', goToRootTab);

  /*
   * Sekme değişiminde takılı kalmış kaydırma kilidi varsa çözülür.
   *
   * Kilidi normalde modalin kendi temizleme adımı çözer. Ama render
   * sırasında fırlatılan bir hata o adımı atlarsa uygulama kalıcı olarak
   * kaydırılamaz hâle geliyordu. Sekme değiştirmek "açık modal yok"
   * demektir; burada denetlemek, benzer bir hatanın etkisini tek ekranla
   * sınırlar.
   */
  useEffect(() => {
    releaseStuckScrollLocks();
  }, [activeTab]);
  // Seviye seçimi Oxford 3000 (A1–B2 + Tümü) ve Oxford 5000 Ek (B2 Ek, C1)
  // gruplarını birlikte kapsar.
  const [selectedLevel, setSelectedLevel] = useState<Level | 'ALL' | OxfordGroupKey>('ALL');
  /**
   * Oxford ekranı açılırken uygulanacak durum filtresi.
   *
   * Profildeki "Öğrendiklerim" / "Tekrar edeceklerim" bağlantıları listeye
   * doğrudan gelebilsin diye burada tutulur; sayıyı gösterip listesine
   * götürmemek bilgiyi yarım bırakmaktı.
   */
  const [oxfordStatusFilter, setOxfordStatusFilter] =
    useState<'ALL' | 'LEARNED' | 'LEARNING' | 'UNSEEN' | 'FAVORITES'>('ALL');
  const [studySessionInitialDeckId, setStudySessionInitialDeckId] = useState<string | undefined>(undefined);
  const [quizInitialDeckId, setQuizInitialDeckId] = useState<string | undefined>(undefined);

  // V2 Core Domain State
  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberships, setMemberships] = useState<CollectionMembership[]>([]);
  const [learningStates, setLearningStates] = useState<Record<string, LearningState>>({});
  const [customWords, setCustomWords] = useState<WordCard[]>([]);
  /*
   * Oxford sözlüğü tembel yüklenir; uygulama kabuğu onu beklemeden boyanır.
   * Ölçüm (4 kat yavaşlatılmış işlemci): sözlük statikken ilk boyama 12,7
   * saniyede oluyordu. Diziler yükleme bitene kadar boş durur, arayüz de bu
   * süre boyunca "sözlük hazırlanıyor" der — boş liste gösterip veri yokmuş
   * gibi davranmaz.
   */
  const [oxfordWords, setOxfordWords] = useState<WordCard[]>([]);
  const [oxfordExtraWords, setOxfordExtraWords] = useState<WordCard[]>([]);
  const [isDictionaryReady, setIsDictionaryReady] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [stats, setStats] = useState<UserStats>(getUserStatsV2());
  const [unlockedBadges, setUnlockedBadges] = useState<string[]>([]);
  const [settings, setSettings] = useState<UserSettings>(getUserSettingsV2());
  const [profile, setProfile] = useState<UserProfile>(getUserProfileV2());

  // Modal States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  /*
   * Yönetim paneli açık mı?
   *
   * Sekme olarak durmuyor: gezinme çubuğu her kullanıcıya aynı görünmeli,
   * yönetim ise istisnai bir iş. Profil ekranından açılıyor ve yalnızca
   * sunucunun yönetici dediği hesapta görünüyor.
   */
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  /** Hata bildirimi penceresi; kelime kartından açıldığında kelimeyi taşır. */
  const [feedbackRequest, setFeedbackRequest] = useState<
    { word?: string; kind?: FeedbackKind } | null
  >(null);

  /*
   * Sunucudan gelen marka metinleri, duyurular ve reklam alanları.
   *
   * İlk değer önbellekten gelir, ağ beklenmez: uygulama çevrimdışı açıldığında
   * da son bilinen metinlerle çizilir, sunucu hiç yoksa pakete gömülü
   * varsayılanlar kullanılır.
   */
  const appContent = useAppContent();
  const [cardToAddToCollection, setCardToAddToCollection] = useState<WordCard | null>(null);
  const [editingCard, setEditingCard] = useState<WordCard | null>(null);

  // Initialize and Migrate V1 data on startup
  useEffect(() => {
    let cancelled = false;

    /*
     * Göç adımları sözlüğe muhtaçtır (eski kayıtlar Oxford kimlikleriyle
     * eşleştiriliyor), bu yüzden kullanıcı verisi de sözlük yüklendikten
     * SONRA okunur. Aksi hâlde göç çalışmadan okunan koleksiyonlar bir
     * sonraki yazmada eski kimliklerle geri yazılırdı.
     */
    loadOxfordCore().then(() => {
      if (cancelled) return;

      const core = getOxford3000Words();
      const extra = getOxford5000ExtraWords();

      runV1toV2MigrationIfNeeded(core);
    // Oxford verisi resmî kaynaklardan yeniden üretildiğinde kayıt kimlikleri
    // kararlı bir şemaya geçti. Kullanıcının "Öğrendim", "Tekrar Et", favori
    // ve çalışma geçmişi bu kimliklere bağlı olduğu için göç V2'den HEMEN
    // SONRA, diğer okumalardan önce çalışmalıdır.
      runOxfordIdMigrationIfNeeded();

      setOxfordWords(core);
      setOxfordExtraWords(extra);

      setCollections(getCollectionsV2());
      setMemberships(getMembershipsV2());
      setLearningStates(getAllLearningStatesV2());
      setCustomWords(getCustomWordsV2());
      setFavorites(getFavoritesV2());
      setStats(getUserStatsV2());
      setSettings(getUserSettingsV2());
      setProfile(getUserProfileV2());
      setUnlockedBadges(checkAndUnlockBadgesV2());

      setIsDictionaryReady(true);

      /*
       * Genel Dağarcık dizini (~50 KB) arka planda yüklenir. Kullanıcı yeni
       * kelime eklerken "bu kelime sözlükte var mı" sorusuna beklemeden
       * yanıt verebilmek için gerekli; küçük olduğu için açılışı geciktirmez
       * ve başarısız olursa uygulama yalnızca öneri gösteremez, çalışmaya
       * devam eder.
       */
      void loadExtendedIndex().catch(() => undefined);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Combined list of Oxford 3000 words + User Custom Cards
  // Oxford 3000 + Oxford 5000 Ek (B2 Ek, C1) + kullanıcının kendi kartları.
  // Çalışma, sınav ve favoriler bu birleşik havuz üzerinden çalışır.
  const allWordsCombined = useMemo(() => {
    return [...oxfordWords, ...oxfordExtraWords, ...customWords];
  }, [oxfordWords, oxfordExtraWords, customWords]);

  /**
   * Oxford'un tamamı (3000 + 5000 Ek).
   *
   * Kelime setleri ekranı yalnızca Oxford 3000'i görüyordu; kullanıcı C1 bir
   * kelimeyi setine eklediğinde kart listede çözülemiyordu. Sözlük araması da
   * bu havuz üzerinden yapılır.
   */
  const oxfordPool = useMemo(
    () => [...oxfordWords, ...oxfordExtraWords],
    [oxfordWords, oxfordExtraWords]
  );

  const favoriteWordsList = useMemo(() => {
    return allWordsCombined.filter((w) => favorites.includes(w.id));
  }, [allWordsCombined, favorites]);

  // Collection Handlers
  const handleCreateCollection = (name: string, description?: string, color?: string, iconName?: string): Collection => {
    const created = createCollectionV2(name, description, color, iconName);
    setCollections(getCollectionsV2());
    setUnlockedBadges(checkAndUnlockBadgesV2());
    return created;
  };

  const handleUpdateCollection = (deck: Collection) => {
    updateCollectionV2(deck);
    setCollections(getCollectionsV2());
  };

  const handleDeleteCollection = (id: string) => {
    deleteCollectionV2(id);
    setCollections(getCollectionsV2());
    setMemberships(getMembershipsV2());
  };

  // Custom Word Handlers
  const handleAddCustomWord = (
    card: WordCard,
    collectionId?: string,
    sourceContext?: string,
    sourceName?: string
  ) => {
    addCustomWordV2(card, collectionId, sourceContext, sourceName);
    setCustomWords(getCustomWordsV2());
    setMemberships(getMembershipsV2());
    setLearningStates(getAllLearningStatesV2());
    setUnlockedBadges(checkAndUnlockBadgesV2());
  };

  const handleUpdateCustomWord = (card: WordCard) => {
    updateCustomWordV2(card);
    setCustomWords(getCustomWordsV2());
  };

  const handleDeleteCustomWord = (id: string) => {
    deleteCustomWordV2(id);
    setCustomWords(getCustomWordsV2());
    setMemberships(getMembershipsV2());
    setLearningStates(getAllLearningStatesV2());
  };

  // Membership Handlers
  const handleAddWordToCollection = (
    wordId: string,
    collectionId: string,
    sourceContext?: string,
    sourceName?: string
  ) => {
    addWordToCollectionV2(wordId, collectionId, sourceContext, sourceName);
    setMemberships(getMembershipsV2());
    setLearningStates(getAllLearningStatesV2());
  };

  const handleRemoveWordFromCollection = (wordId: string, collectionId: string) => {
    removeWordFromCollectionV2(wordId, collectionId);
    setMemberships(getMembershipsV2());
  };

  // Toggle Collection Membership in modal
  const handleToggleCollectionMembershipInModal = (
    collectionId: string,
    sourceContext?: string,
    sourceName?: string
  ) => {
    if (!cardToAddToCollection) return;
    const exists = memberships.some(
      m => m.wordId === cardToAddToCollection.id && m.collectionId === collectionId
    );

    if (exists) {
      removeWordFromCollectionV2(cardToAddToCollection.id, collectionId);
    } else {
      addWordToCollectionV2(cardToAddToCollection.id, collectionId, sourceContext, sourceName);
    }
    setMemberships(getMembershipsV2());
    setLearningStates(getAllLearningStatesV2());
  };

  /*
   * Listelere geçen işleyiciler `useCallback` ile sarılır.
   *
   * Kart bileşeni memoize edildi; ama her render'da yeni bir ok fonksiyonu
   * geçilirse prop'lar değişmiş sayılır ve memo hiçbir şeyi engellemez.
   * Kimliğin kararlı olması, tek bir favori dokunuşunun listedeki diğer
   * kartları yeniden render etmesini önler.
   */
  const handleToggleFavorite = useCallback((wordId: string) => {
    const updated = toggleFavoriteV2(wordId);
    setFavorites(updated);
    setUnlockedBadges(checkAndUnlockBadgesV2());
  }, []);

  // Spaced Repetition Study Result Handler
  const handleRecordStudyResult = useCallback((
    wordId: string,
    quality: ResponseQuality,
    mode: 'flashcard' | 'typed' | 'listening' | 'cloze' | 'quiz',
    collectionId?: string
  ) => {
    recordStudyResultV2(wordId, quality, mode, collectionId);
    setLearningStates(getAllLearningStatesV2());
    setStats(getUserStatsV2());
    setUnlockedBadges(checkAndUnlockBadgesV2());
  }, []);

  // Study Session Completion
  const handleFinishStudySession = (summary: StudySessionSummary) => {
    setLearningStates(getAllLearningStatesV2());
    setStats(getUserStatsV2());
    setUnlockedBadges(checkAndUnlockBadgesV2());
  };

  // Quiz Completion
  const handleFinishQuiz = (summary: QuizSessionSummary) => {
    // Yanlış bilinen kelimelerin kart nesnelerini id'lerinden çöz; hata
    // listesi kartın kendisini sakladığı için tam nesne gerekiyor.
    const wordById = new Map(allWordsCombined.map(w => [w.id, w]));
    const mistakenWords = summary.mistakeWords
      .map(id => wordById.get(id))
      .filter((w): w is WordCard => !!w);

    const updatedStats = recordQuizResultV2(
      summary.correctCount,
      summary.wrongCount,
      mistakenWords
    );
    setStats(updatedStats);
    setUnlockedBadges(checkAndUnlockBadgesV2());
  };

  const handleClearMistake = (wordId: string) => {
    const updatedStats = clearMistakeV2(wordId);
    setStats(updatedStats);
  };

  const handleSetWordStatus = useCallback((id: string, status: 'learned' | 'learning' | 'unseen') => {
    setUserWordStatus(id, status);
    setLearningStates(getAllLearningStatesV2());
    setStats(getUserStatsV2());
    setUnlockedBadges(checkAndUnlockBadgesV2());
  }, []);

  const handleOpenAddToCollection = useCallback((card: WordCard) => {
    setCardToAddToCollection(card);
  }, []);

  /** Kelime kartındaki "hata bildir"; hangi kelime olduğu forma taşınır. */
  const handleReportWord = useCallback((card: WordCard) => {
    setFeedbackRequest({ word: card.word, kind: 'word' });
  }, []);

  const handleToggleLearnedFromList = useCallback((id: string) => {
    handleRecordStudyResult(id, 'good', 'flashcard');
  }, [handleRecordStudyResult]);

  const handleUpdateSettings = (updated: UserSettings) => {
    saveUserSettingsV2(updated);
    setSettings(updated);
  };

  const handleLogout = () => {
    // Sunucudaki oturum jetonunu da geçersiz kıl; yalnızca yerel profili
    // temizlemek jetonu geçerli bırakırdı.
    void logout();
    setIsAdminPanelOpen(false);
    const guestProfile: UserProfile = {
      email: null,
      name: 'Misafir Kullanıcı',
      isLoggedIn: false
    };
    saveUserProfileV2(guestProfile);
    setProfile(guestProfile);
  };

  const handleUpdateProfile = (newProfile: UserProfile) => {
    saveUserProfileV2(newProfile);
    setProfile(newProfile);
  };

  const handleSyncNow = async () => {
    if (!profile.email) return;
    try {
      const userData = {
        collections,
        memberships,
        learningStates,
        customWords,
        favorites,
        stats,
        settings,
        unlockedBadges
      };
      // E-posta artık gövdede gönderilmiyor: sunucu kullanıcıyı oturum
      // jetonundan çözer. Eski uçta e-posta tek kimlikti ve başkasının
      // adresini yazan herkes onun verisini ezebiliyordu.
      await apiFetch('/api/sync/save', {
        method: 'POST',
        body: JSON.stringify({ userData })
      });
      showToast('Tüm verileriniz bulut hesabınıza eşitlendi.', 'learned');
      const syncedProfile = { ...profile, lastSyncTime: new Date().toLocaleTimeString('tr-TR') };
      saveUserProfileV2(syncedProfile);
      setProfile(syncedProfile);
    } catch (err: any) {
      showToast(err?.message || 'Bulut eşitleme hatası oluştu.', 'error');
    }
  };

  // Existing collection IDs for modal
  const existingCollectionIdsForCard = useMemo(() => {
    if (!cardToAddToCollection) return [];
    return memberships
      .filter(m => m.wordId === cardToAddToCollection.id)
      .map(m => m.collectionId);
  }, [cardToAddToCollection, memberships]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collectionCount={collections.length}
        profile={profile}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/*
          Sözlük hazırlanırken kabuk zaten görünür durumda. Bu aralıkta boş
          listeler göstermek "kelime yok" gibi okunurdu; ne olduğunu yazmak
          hem dürüst hem de bekleyişi anlaşılır kılıyor.
        */}
        {!isDictionaryReady ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center animate-fadeIn">
            <div className="w-10 h-10 border-3 border-[#D7D2F4] border-t-[#4F46A5] rounded-full animate-spin" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#1E2430]">Sözlük hazırlanıyor…</p>
              <p className="text-xs text-[#687080]">
                Kelimeler cihazında saklanıyor; bu yalnızca birkaç saniye sürer.
              </p>
            </div>
          </div>
        ) : (
        <>
        {activeTab === 'today' && (
          <TodayDashboard
            collections={collections}
            memberships={memberships}
            customWords={customWords}
            oxfordWords={oxfordWords}
            extraWords={oxfordExtraWords}
            learningStates={learningStates}
            settings={settings}
            stats={stats}
            profile={profile}
            branding={appContent.branding}
            announcements={appContent.announcements}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onStartStudy={(deckId) => {
              setStudySessionInitialDeckId(deckId);
              setActiveTab('study');
            }}
            onNavigateToTab={(tab) => setActiveTab(tab as TabType)}
            onOpenTextMiner={() => {
              setActiveTab('collections');
            }}
            onSelectLevel={(lvl) => {
              setSelectedLevel(lvl);
              setActiveTab('oxford');
            }}
            onOpenCreateSet={() => {
              /*
               * Set oluşturmak giriş gerektirmez.
               *
               * Burada giriş modali açılıyordu ama kelime eklemek için
               * istenmiyordu; aynı yerel veriye iki farklı kural uygulanıyordu.
               * Setler de kelimeler de tarayıcıda saklanıyor, hesap yalnızca
               * bulut yedeği için. İlk adımda hesap istemek, ürünün "hızlı
               * ekleme" vaadinin önündeki en büyük sürtünmeydi.
               */
              setActiveTab('collections');
            }}
          />
        )}

        {activeTab === 'collections' && (
          <CollectionsView
            collections={collections}
            memberships={memberships}
            customWords={customWords}
            oxfordWords={oxfordPool}
            learningStates={learningStates}
            favorites={favorites}
            profile={profile}
            onToggleFavorite={handleToggleFavorite}
            onCreateCollection={handleCreateCollection}
            onUpdateCollection={handleUpdateCollection}
            onDeleteCollection={handleDeleteCollection}
            onAddCustomWord={handleAddCustomWord}
            onUpdateCustomWord={handleUpdateCustomWord}
            onDeleteCustomWord={handleDeleteCustomWord}
            onAddWordToCollection={handleAddWordToCollection}
            onRemoveWordFromCollection={handleRemoveWordFromCollection}
            onStartStudySession={(colId) => {
              setStudySessionInitialDeckId(colId);
              setActiveTab('study');
            }}
            onStartQuiz={(colId) => {
              setQuizInitialDeckId(colId);
              setActiveTab('quiz');
            }}
            onOpenEditModal={(card) => setEditingCard(card)}
            onOpenAddToCollection={handleOpenAddToCollection}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onSetWordStatus={handleSetWordStatus}
          />
        )}

        {activeTab === 'study' && (
          <StudySessionView
            initialCollectionId={studySessionInitialDeckId}
            collections={collections}
            memberships={memberships}
            customWords={customWords}
            oxfordWords={oxfordWords}
            learningStates={learningStates}
            settings={settings}
            onRecordStudyResult={handleRecordStudyResult}
            onFinishSession={handleFinishStudySession}
            onExitSession={() => setActiveTab('today')}
          />
        )}

        {activeTab === 'oxford' && (
          <OxfordExplorer
            words={oxfordWords}
            extraWords={oxfordExtraWords}
            favorites={favorites}
            learned={Object.keys(learningStates).filter(k => learningStates[k]?.stage === 'MASTERED')}
            learningStates={learningStates}
            selectedLevel={selectedLevel}
            setSelectedLevel={setSelectedLevel}
            initialStatusFilter={oxfordStatusFilter}
            onToggleFavorite={handleToggleFavorite}
            onToggleLearned={handleToggleLearnedFromList}
            onSetStatus={handleSetWordStatus}
            onOpenAddToCollection={handleOpenAddToCollection}
            onReportWord={handleReportWord}
            onStartStudy={() => {
              setActiveTab('study');
            }}
            onStartQuiz={() => {
              setActiveTab('quiz');
            }}
          />
        )}

        {activeTab === 'quiz' && (
          <QuizModule
            allWords={oxfordWords}
            extraWords={oxfordExtraWords}
            customCards={customWords}
            collections={collections}
            memberships={memberships}
            learningStates={learningStates}
            initialCollectionId={quizInitialDeckId}
            onFinishQuiz={handleFinishQuiz}
            onRecordStudyResult={(wId, qual, mode) => handleRecordStudyResult(wId, qual, mode)}
            onGoToMistakes={() => setActiveTab('profile')}
            onSetWordStatus={handleSetWordStatus}
          />
        )}

        {activeTab === 'profile' && isAdminPanelOpen && profile.isAdmin && (
          <AdminShell onClose={() => setIsAdminPanelOpen(false)} />
        )}

        {activeTab === 'profile' && !(isAdminPanelOpen && profile.isAdmin) && (
          <ProfileView
            profile={profile}
            stats={stats}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            learningStates={learningStates}
            customWords={customWords}
            oxfordWords={oxfordWords}
            favorites={favorites}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onLogout={handleLogout}
            onUpdateProfile={handleUpdateProfile}
            onNavigateToTab={(tab) => setActiveTab(tab as TabType)}
            onSelectLevel={(lvl) => {
              setSelectedLevel(lvl);
              setOxfordStatusFilter('ALL');
              setActiveTab('oxford');
            }}
            onOpenOxfordStatus={(status) => {
              setSelectedLevel('ALL');
              setOxfordStatusFilter(status);
              setActiveTab('oxford');
            }}
            onOpenAdminPanel={profile.isAdmin ? () => setIsAdminPanelOpen(true) : undefined}
            onOpenFeedback={() => setFeedbackRequest({ kind: 'bug' })}
          />
        )}
        </>
        )}
      </main>

      {/* Global Add To Collection Modal */}
      <AddToCollectionModal
        isOpen={!!cardToAddToCollection}
        onClose={() => setCardToAddToCollection(null)}
        wordCard={cardToAddToCollection}
        collections={collections}
        existingCollectionIds={existingCollectionIdsForCard}
        onToggleCollectionMembership={handleToggleCollectionMembershipInModal}
        onCreateCollectionAndAdd={(name, desc) => {
          const col = handleCreateCollection(name, desc);
          if (cardToAddToCollection) {
            handleAddWordToCollection(cardToAddToCollection.id, col.id);
          }
        }}
      />

      {/* Global Edit Card Modal */}
      {editingCard && (
        <EditCardModal
          card={editingCard}
          isOpen={!!editingCard}
          onClose={() => setEditingCard(null)}
          onSave={handleUpdateCustomWord}
          onDelete={handleDeleteCustomWord}
        />
      )}

      {/* Hata bildirimi / iletişim */}
      <FeedbackModal
        isOpen={!!feedbackRequest}
        onClose={() => setFeedbackRequest(null)}
        initialWord={feedbackRequest?.word}
        initialKind={feedbackRequest?.kind}
      />

      {/* Auth / Cloud Sync Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
        onSyncNow={handleSyncNow}
      />

      {/* Clean Minimal Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2 font-medium">
            <span>Anlora — Heh, şimdi anlorum!</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[#4F806A] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#4F806A] animate-pulse" /> Çevrimdışı Çalışma & Yerel Depolama Hazır
            </span>
            <span>© 2026 Anlora</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
