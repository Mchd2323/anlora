import React, { useState, useEffect, useMemo } from 'react';
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
import { AddToCollectionModal } from './components/AddToCollectionModal';
import { EditCardModal } from './components/EditCardModal';

import { OXFORD_3000_WORDS, OXFORD_5000_EXTRA_WORDS } from './data/oxfordWords';
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
import { useToast } from './components/ui/ToastProvider';

export default function App() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('today');
  // Seviye seçimi Oxford 3000 (A1–B2 + Tümü) ve Oxford 5000 Ek (B2 Ek, C1)
  // gruplarını birlikte kapsar.
  const [selectedLevel, setSelectedLevel] = useState<Level | 'ALL' | OxfordGroupKey>('ALL');
  const [studySessionInitialDeckId, setStudySessionInitialDeckId] = useState<string | undefined>(undefined);
  const [quizInitialDeckId, setQuizInitialDeckId] = useState<string | undefined>(undefined);

  // V2 Core Domain State
  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberships, setMemberships] = useState<CollectionMembership[]>([]);
  const [learningStates, setLearningStates] = useState<Record<string, LearningState>>({});
  const [customWords, setCustomWords] = useState<WordCard[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [stats, setStats] = useState<UserStats>(getUserStatsV2());
  const [unlockedBadges, setUnlockedBadges] = useState<string[]>([]);
  const [settings, setSettings] = useState<UserSettings>(getUserSettingsV2());
  const [profile, setProfile] = useState<UserProfile>(getUserProfileV2());

  // Modal States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [cardToAddToCollection, setCardToAddToCollection] = useState<WordCard | null>(null);
  const [editingCard, setEditingCard] = useState<WordCard | null>(null);

  // Initialize and Migrate V1 data on startup
  useEffect(() => {
    runV1toV2MigrationIfNeeded(OXFORD_3000_WORDS);
    // Oxford verisi resmî kaynaklardan yeniden üretildiğinde kayıt kimlikleri
    // kararlı bir şemaya geçti. Kullanıcının "Öğrendim", "Tekrar Et", favori
    // ve çalışma geçmişi bu kimliklere bağlı olduğu için göç V2'den HEMEN
    // SONRA, diğer okumalardan önce çalışmalıdır.
    runOxfordIdMigrationIfNeeded();

    setCollections(getCollectionsV2());
    setMemberships(getMembershipsV2());
    setLearningStates(getAllLearningStatesV2());
    setCustomWords(getCustomWordsV2());
    setFavorites(getFavoritesV2());
    setStats(getUserStatsV2());
    setUnlockedBadges(getUnlockedBadgesV2());
    setSettings(getUserSettingsV2());
    setProfile(getUserProfileV2());

    const badges = checkAndUnlockBadgesV2();
    setUnlockedBadges(badges);
  }, []);

  // Combined list of Oxford 3000 words + User Custom Cards
  // Oxford 3000 + Oxford 5000 Ek (B2 Ek, C1) + kullanıcının kendi kartları.
  // Çalışma, sınav ve favoriler bu birleşik havuz üzerinden çalışır.
  const allWordsCombined = useMemo(() => {
    return [...OXFORD_3000_WORDS, ...OXFORD_5000_EXTRA_WORDS, ...customWords];
  }, [customWords]);

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

  // Favorite toggle handler
  const handleToggleFavorite = (wordId: string) => {
    const updated = toggleFavoriteV2(wordId);
    setFavorites(updated);
    setUnlockedBadges(checkAndUnlockBadgesV2());
  };

  // Spaced Repetition Study Result Handler
  const handleRecordStudyResult = (
    wordId: string,
    quality: ResponseQuality,
    mode: 'flashcard' | 'typed' | 'listening' | 'cloze' | 'quiz',
    collectionId?: string
  ) => {
    recordStudyResultV2(wordId, quality, mode, collectionId);
    setLearningStates(getAllLearningStatesV2());
    setStats(getUserStatsV2());
    setUnlockedBadges(checkAndUnlockBadgesV2());
  };

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

  const handleSetWordStatus = (id: string, status: 'learned' | 'learning' | 'unseen') => {
    setUserWordStatus(id, status);
    setLearningStates(getAllLearningStatesV2());
    setStats(getUserStatsV2());
    setUnlockedBadges(checkAndUnlockBadgesV2());
  };

  const handleUpdateSettings = (updated: UserSettings) => {
    saveUserSettingsV2(updated);
    setSettings(updated);
  };

  const handleLogout = () => {
    // Sunucudaki oturum jetonunu da geçersiz kıl; yalnızca yerel profili
    // temizlemek jetonu geçerli bırakırdı.
    void logout();
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
        {activeTab === 'today' && (
          <TodayDashboard
            collections={collections}
            memberships={memberships}
            customWords={customWords}
            oxfordWords={OXFORD_3000_WORDS}
            learningStates={learningStates}
            settings={settings}
            stats={stats}
            profile={profile}
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
              if (!profile.isLoggedIn) {
                setIsAuthModalOpen(true);
              } else {
                setActiveTab('collections');
              }
            }}
          />
        )}

        {activeTab === 'collections' && (
          <CollectionsView
            collections={collections}
            memberships={memberships}
            customWords={customWords}
            oxfordWords={OXFORD_3000_WORDS}
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
            onOpenAddToCollection={(card) => setCardToAddToCollection(card)}
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
            oxfordWords={OXFORD_3000_WORDS}
            learningStates={learningStates}
            settings={settings}
            onRecordStudyResult={handleRecordStudyResult}
            onFinishSession={handleFinishStudySession}
            onExitSession={() => setActiveTab('today')}
          />
        )}

        {activeTab === 'oxford' && (
          <OxfordExplorer
            words={OXFORD_3000_WORDS}
            extraWords={OXFORD_5000_EXTRA_WORDS}
            favorites={favorites}
            learned={Object.keys(learningStates).filter(k => learningStates[k]?.stage === 'MASTERED')}
            learningStates={learningStates}
            selectedLevel={selectedLevel}
            setSelectedLevel={setSelectedLevel}
            onToggleFavorite={handleToggleFavorite}
            onToggleLearned={(id) => {
              handleRecordStudyResult(id, 'good', 'flashcard');
            }}
            onSetStatus={handleSetWordStatus}
            onOpenAddToCollection={(card) => setCardToAddToCollection(card)}
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
            allWords={OXFORD_3000_WORDS}
            extraWords={OXFORD_5000_EXTRA_WORDS}
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

        {activeTab === 'profile' && (
          <ProfileView
            profile={profile}
            stats={stats}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            learningStates={learningStates}
            customWords={customWords}
            oxfordWords={OXFORD_3000_WORDS}
            favorites={favorites}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onLogout={handleLogout}
            onUpdateProfile={handleUpdateProfile}
            onNavigateToTab={(tab) => setActiveTab(tab as TabType)}
            onSelectLevel={(lvl) => {
              setSelectedLevel(lvl);
              setActiveTab('oxford');
            }}
          />
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
