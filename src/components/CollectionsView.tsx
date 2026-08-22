import React, { useState, useMemo } from 'react';
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
import {
  Layers,
  Plus,
  Search,
  Sparkles,
  BookOpen,
  GraduationCap,
  Pin,
  Trash2,
  Edit2,
  Copy,
  FileText,
  Play,
  MoreVertical,
  Check,
  CheckCircle2,
  RotateCw,
  AlertCircle,
  PenTool,
  Volume2
} from 'lucide-react';
import { calculateCollectionProgress } from '../utils/srsEngine';
import { BatchWordModal } from './BatchWordModal';
import { TextMinerModal } from './TextMinerModal';
import { DuplicateWarningModal } from './DuplicateWarningModal';
import { detectWordDuplicate } from '../utils/duplicateDetector';
import { speakText } from '../utils/speech';
import { getUserWordStatus } from '../utils/storageV2';
import { UserProfile } from '../types';

interface CollectionsViewProps {
  collections: Collection[];
  memberships: CollectionMembership[];
  customWords: WordCard[];
  oxfordWords: WordCard[];
  learningStates: Record<string, LearningState>;
  favorites: string[];
  profile?: UserProfile;
  onToggleFavorite: (id: string) => void;
  onCreateCollection: (name: string, description?: string, color?: string, iconName?: string) => Collection;
  onUpdateCollection: (deck: Collection) => void;
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
  onOpenAuthModal?: () => void;
  onSetWordStatus?: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
}

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  collections,
  memberships,
  customWords,
  oxfordWords,
  learningStates,
  favorites,
  profile,
  onToggleFavorite,
  onCreateCollection,
  onUpdateCollection,
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
  onOpenAuthModal,
  onSetWordStatus
}) => {
  const [activeDeckId, setActiveDeckId] = useState<string | null>(collections[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isStudyingFlashcards, setIsStudyingFlashcards] = useState(false);

  // Modals & Popups
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showMinerModal, setShowMinerModal] = useState(false);
  const [showAddWordModal, setShowAddWordModal] = useState(false);

  // 3-dots menu dropdown state
  const [openMenuDeckId, setOpenMenuDeckId] = useState<string | null>(null);

  // New Word Addition Flow State
  const [wordInput, setWordInput] = useState('');
  const [contextInput, setContextInput] = useState('');
  const [creationMode, setCreationMode] = useState<'CHOICE' | 'AI_GENERATING' | 'AI_PREVIEW' | 'MANUAL'>('CHOICE');
  const [aiError, setAiError] = useState<string | null>(null);
  const [generatedPreviewCard, setGeneratedPreviewCard] = useState<WordCard | null>(null);

  // Manual Form State
  const [manualTurkishMeaning, setManualTurkishMeaning] = useState('');
  const [manualPartOfSpeech, setManualPartOfSpeech] = useState('n.');
  const [manualExamples, setManualExamples] = useState<{ en: string; tr: string }[]>([
    { en: '', tr: '' },
    { en: '', tr: '' }
  ]);

  // Duplicate Resolution State
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Deck Form State
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [editingDeck, setEditingDeck] = useState<Collection | null>(null);

  // Active Deck Object
  const activeDeck = collections.find((c) => c.id === activeDeckId) || collections[0] || null;

  // Words in the active deck
  const activeDeckWords = useMemo(() => {
    if (!activeDeck) return [];
    const deckWordIds = memberships
      .filter((m) => m.collectionId === activeDeck.id)
      .map((m) => m.wordId);

    const allWordsMap = new Map<string, WordCard>();
    customWords.forEach((w) => allWordsMap.set(w.id, w));
    oxfordWords.forEach((w) => allWordsMap.set(w.id, w));

    return deckWordIds
      .map((id) => allWordsMap.get(id))
      .filter((w): w is WordCard => !!w);
  }, [activeDeck, memberships, customWords, oxfordWords]);

  // Filtered words in the active deck
  const filteredWords = useMemo(() => {
    return activeDeckWords.filter((card) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        card.word.toLowerCase().includes(q) ||
        card.turkishMeaning.toLowerCase().includes(q)
      );
    });
  }, [activeDeckWords, searchQuery]);

  const resetAddWordModal = () => {
    setWordInput('');
    setContextInput('');
    setCreationMode('CHOICE');
    setAiError(null);
    setGeneratedPreviewCard(null);
    setManualTurkishMeaning('');
    setManualPartOfSpeech('n.');
    setManualExamples([
      { en: '', tr: '' },
      { en: '', tr: '' }
    ]);
    setShowAddWordModal(false);
  };

  // Check duplicate before AI generation
  const handleCheckAndProceedWithAi = () => {
    if (!wordInput.trim()) {
      alert('Lütfen önce bir İngilizce kelime yazın.');
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
      setDuplicateResult(check);
      setShowDuplicateModal(true);
    } else {
      handleExecuteAiGeneration();
    }
  };

  // Execute Gemini AI Card Generation
  const handleExecuteAiGeneration = async () => {
    setCreationMode('AI_GENERATING');
    setAiError(null);

    try {
      const response = await fetch('/api/ai/generate-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: wordInput.trim(),
          context: contextInput.trim() || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Yapay zekâ yanıt veremedi. Lütfen tekrar deneyin.');
      }

      const data = await response.json();
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
      setCreationMode('CHOICE');
    }
  };

  // Save AI Generated Card
  const handleSaveAiCard = () => {
    if (!generatedPreviewCard || !activeDeck) return;
    onAddCustomWord(generatedPreviewCard, activeDeck.id, contextInput.trim() || undefined);
    resetAddWordModal();
  };

  // Save Manual Word Card
  const handleSaveManualCard = (e: React.FormEvent, forceOverride: boolean = false) => {
    e.preventDefault();
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
      if (check.type !== 'NONE') {
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
    resetAddWordModal();
  };

  // If user is studying this set in Flashcard Study Mode
  if (isStudyingFlashcards && activeDeck) {
    return (
      <StudyFlashcard
        title={activeDeck.name}
        sourceContextName={activeDeck.name}
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
    <div className="space-y-6 pb-16 max-w-[1180px] mx-auto animate-fadeIn">
      {/* Top Banner: Kelime Setlerim */}
      <div className="bg-[#FFFFFF] p-6 sm:p-7 rounded-2xl border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)] flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1E2430]">
              Kelime Setlerim
            </h2>
            <span className="px-2 py-0.5 bg-[#EEECFA] text-[#4F46A5] text-xs font-bold rounded-lg border border-[#D7D2F4]">
              {collections.length} Set
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#687080] max-w-xl">
            Diziler, kitaplar veya günlük hayatta karşılaştığın kelimeler için kendi setlerini oluştur.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setShowMinerModal(true)}
            className="px-3.5 py-2 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-[#1E2430] text-xs font-semibold rounded-xl border border-[#E4E1D9] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#4F46A5]" />
            <span>Metinden Kelime Yakala</span>
          </button>

          <button
            onClick={() => {
              if (!profile?.isLoggedIn && onOpenAuthModal) {
                onOpenAuthModal();
              } else {
                setShowCreateModal(true);
              }
            }}
            className="px-4 py-2 bg-[#4F46A5] hover:bg-[#433B91] text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Kelime Seti</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Left Set List + Right Active Set Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Kelime Setleri */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-[#687080] uppercase tracking-wider">
              Set Listesi
            </h3>
            <span className="text-xs font-semibold text-[#8E95A2]">
              {collections.length} Set
            </span>
          </div>

          <div className="space-y-2.5">
            {collections.map((deck) => {
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
                      ? 'bg-[#FFFFFF] border-[#4F46A5] shadow-xs ring-1 ring-[#4F46A5]'
                      : 'bg-[#FFFFFF] border-[#E4E1D9] hover:border-[#D5D0C5]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-[#1E2430] truncate">
                          {deck.name}
                        </h4>
                        {deck.isPinned && (
                          <Pin className="w-3 h-3 text-[#B97922] fill-current shrink-0" />
                        )}
                      </div>
                      {deck.description && (
                        <p className="text-xs text-[#687080] truncate mt-0.5">
                          {deck.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-bold text-[#4F46A5] bg-[#EEECFA] px-2 py-0.5 rounded-md border border-[#D7D2F4]">
                        {deckWordCount}
                      </span>

                      {/* 3 dots menu trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuDeckId(openMenuDeckId === deck.id ? null : deck.id);
                        }}
                        className="p-1 text-[#8E95A2] hover:text-[#1E2430] hover:bg-[#F1EFE8] rounded-lg transition-colors cursor-pointer"
                        title="Set Seçenekleri"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 3 Dots Dropdown Menu */}
                  {openMenuDeckId === deck.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-3 top-11 z-30 bg-[#FFFFFF] rounded-xl shadow-lg border border-[#E4E1D9] py-1 min-w-[180px] animate-fadeIn text-xs font-semibold text-[#1E2430]"
                    >
                      <button
                        onClick={() => {
                          setEditingDeck(deck);
                          setOpenMenuDeckId(null);
                        }}
                        className="w-full px-3.5 py-2 hover:bg-[#F1EFE8] flex items-center gap-2 text-left cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[#4F46A5]" />
                        <span>Düzenle</span>
                      </button>

                      <div className="border-t border-[#EFECE6] my-1" />

                      <button
                        onClick={() => {
                          if (
                            confirm(`"${deck.name}" kelime setini silmek istediğinize emin misiniz?`)
                          ) {
                            onDeleteCollection(deck.id);
                            setOpenMenuDeckId(null);
                          }
                        }}
                        className="w-full px-3.5 py-2 hover:bg-[#FAECEA] text-[#C65D55] flex items-center gap-2 text-left cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Seti Sil</span>
                      </button>
                    </div>
                  )}

                  {/* Progress Line */}
                  <div className="mt-3 pt-2.5 border-t border-[#EFECE6] space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#687080]">
                      <span className="text-[#4F806A]">{learned} Öğrendim</span>
                      <span className="text-[#B97922]">{learning} Tekrar Et</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#E4E1D9] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4F806A] rounded-full transition-all"
                        style={{ width: `${learnedPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Active Set Workspace */}
        {activeDeck ? (
          <div className="lg:col-span-8 space-y-5">
            {/* Active Set Header */}
            <div className="bg-[#FFFFFF] p-6 rounded-2xl border border-[#E4E1D9] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold text-[#1E2430]">{activeDeck.name}</h3>
                    {activeDeck.isPinned && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-[#FBF1DE] text-[#8A5A18] rounded-md border border-[#E7C98F]">
                        Sabitlendi
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#687080]">
                    {activeDeck.description || 'Bu setteki kelimeler ve özel bağlam cümleleri'}
                  </p>
                </div>

                {/* Set Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onStartQuiz(activeDeck.id)}
                    className="px-3.5 py-2 bg-[#F1EFE8] hover:bg-[#EEECFA] text-[#4F46A5] border border-[#D7D2F4] text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <GraduationCap className="w-4 h-4 text-[#4F46A5]" />
                    <span>Sınav Yap</span>
                  </button>
                </div>
              </div>

              {/* Set Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#EFECE6]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      resetAddWordModal();
                      setShowAddWordModal(true);
                    }}
                    className="px-3.5 py-2 bg-[#4F46A5] hover:bg-[#433B91] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Kelime Ekle</span>
                  </button>

                  <button
                    onClick={() => setShowBatchModal(true)}
                    className="px-3.5 py-2 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-[#1E2430] text-xs font-semibold rounded-xl border border-[#E4E1D9] transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#687080]" />
                    <span>Toplu Ekle</span>
                  </button>
                </div>

                {/* Search in Set */}
                <div className="relative min-w-[200px] flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 text-[#8E95A2] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Bu sette ara..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:border-[#4F46A5] focus:outline-none text-[#1E2430]"
                  />
                </div>
              </div>
            </div>

            {/* Prominent Flashcard Study Mode CTA Card */}
            {activeDeckWords.length > 0 && (
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
                    Şimdi çalışmaya başla ({activeDeckWords.length} kelime)
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#4F46A5] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </button>
            )}

            {/* Words Grid or Empty State */}
            {filteredWords.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredWords.map((card) => {
                  const state = learningStates[card.id];
                  const membership = memberships.find(
                    (m) => m.wordId === card.id && m.collectionId === activeDeck.id
                  );

                  const displayCard: WordCard = {
                    ...card,
                    sourceContext: membership?.sourceContext || card.sourceContext,
                    sourceName: membership?.sourceName || card.sourceName
                  };

                  return (
                    <div key={card.id} className="relative group">
                      <WordCardComponent
                        card={displayCard}
                        isFavorite={favorites.includes(card.id)}
                        learningState={state}
                        status={getUserWordStatus(card.id, learningStates)}
                        onSetStatus={onSetWordStatus}
                        onToggleFavorite={onToggleFavorite}
                        onEditCustom={card.isCustom ? () => onOpenEditModal(card) : undefined}
                        onDeleteCustom={
                          card.isCustom ? () => onDeleteCustomWord(card.id) : undefined
                        }
                        onOpenAddToCollection={() => onOpenAddToCollection(card)}
                      />

                      <button
                        onClick={() => onRemoveWordFromCollection(card.id, activeDeck.id)}
                        className="mt-1.5 w-full py-1 text-[11px] font-semibold text-[#8E95A2] hover:text-[#C65D55] text-center transition-colors hover:underline cursor-pointer"
                      >
                        Bu Setten Çıkar
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty Set View */
              <div className="bg-[#FFFFFF] p-10 rounded-2xl border border-[#E4E1D9] text-center space-y-3 shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
                <BookOpen className="w-8 h-8 text-[#8E95A2] mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-[#1E2430]">Henüz kelime yok</h4>
                  <p className="text-xs text-[#687080] max-w-sm mx-auto leading-relaxed">
                    Bu sette öğrenmek istediğin İngilizce kelimeleri biriktirebilirsin.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      resetAddWordModal();
                      setShowAddWordModal(true);
                    }}
                    className="px-4 py-2 bg-[#4F46A5] hover:bg-[#433B91] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2430]/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#FFFFFF] rounded-2xl max-w-md w-full border border-[#E4E1D9] shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#1E2430] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#4F46A5]" />
              Yeni Kelime Seti Oluştur
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newDeckName.trim()) return;
                const created = onCreateCollection(
                  newDeckName.trim(),
                  newDeckDesc.trim() || undefined
                );
                setActiveDeckId(created.id);
                setNewDeckName('');
                setNewDeckDesc('');
                setShowCreateModal(false);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                  Set Adı <span className="text-[#C65D55]">*</span>
                </label>
                <input
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="Örn: B2 Kelimelerim, İş İngilizcesi..."
                  required
                  autoFocus
                  className="w-full px-3.5 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-semibold text-[#1E2430]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                  Açıklama (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  placeholder="Örn: Bu setteki kelimeler..."
                  className="w-full px-3.5 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none text-[#1E2430]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#687080] hover:bg-[#F1EFE8] rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4F46A5] text-white text-xs font-semibold rounded-xl hover:bg-[#433B91] cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2430]/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#FFFFFF] rounded-2xl max-w-md w-full border border-[#E4E1D9] shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#1E2430] flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-[#4F46A5]" />
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
                <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                  Set Adı
                </label>
                <input
                  type="text"
                  value={editingDeck.name}
                  onChange={(e) => setEditingDeck({ ...editingDeck, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl font-bold text-[#1E2430]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                  Açıklama
                </label>
                <input
                  type="text"
                  value={editingDeck.description || ''}
                  onChange={(e) =>
                    setEditingDeck({ ...editingDeck, description: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl text-[#1E2430]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinCheck"
                  checked={!!editingDeck.isPinned}
                  onChange={(e) => setEditingDeck({ ...editingDeck, isPinned: e.target.checked })}
                  className="w-4 h-4 rounded text-[#4F46A5]"
                />
                <label htmlFor="pinCheck" className="text-xs font-semibold text-[#1E2430]">
                  Bu seti listenin başına sabitle
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingDeck(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#687080] hover:bg-[#F1EFE8] rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4F46A5] text-white text-xs font-semibold rounded-xl hover:bg-[#433B91] cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2430]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-[#FFFFFF] rounded-2xl max-w-lg w-full border border-[#E4E1D9] shadow-xl p-6 sm:p-7 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1E2430] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#4F46A5]" />
                Yeni Kelime Ekle
              </h3>
              <span className="text-xs font-bold text-[#4F46A5] bg-[#EEECFA] px-2.5 py-1 rounded-lg border border-[#D7D2F4]">
                {activeDeck?.name}
              </span>
            </div>

            {/* ADIM 1: KELİME VE BAĞLAM GİRİŞİ */}
            {creationMode === 'CHOICE' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                    İngilizce Kelime <span className="text-[#C65D55]">*</span>
                  </label>
                  <input
                    type="text"
                    value={wordInput}
                    onChange={(e) => setWordInput(e.target.value)}
                    placeholder="Örn: reluctant, achieve, scrutinize..."
                    required
                    autoFocus
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-bold text-[#1E2430]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                    Bu kelimeyi gördüğün cümle (İsteğe Bağlı Bağlam)
                  </label>
                  <textarea
                    value={contextInput}
                    onChange={(e) => setContextInput(e.target.value)}
                    placeholder="Örn: She was reluctant to leave the party early."
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none italic text-[#1E2430]"
                  />
                </div>

                {/* AI Error Notification */}
                {aiError && (
                  <div className="p-3 bg-[#FAECEA] rounded-xl border border-[#F0CBC7] text-xs space-y-1.5">
                    <div className="flex items-start gap-2 text-[#C65D55] font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{aiError}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleExecuteAiGeneration}
                        className="px-3 py-1 bg-[#C65D55] text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Tekrar Dene
                      </button>
                      <button
                        onClick={() => {
                          setAiError(null);
                          setCreationMode('MANUAL');
                        }}
                        className="px-3 py-1 bg-white text-[#1E2430] border border-[#E4E1D9] rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Kendim Yazacağım
                      </button>
                    </div>
                  </div>
                )}

                {/* 2 NET SEÇENEK: AI vs MANUEL */}
                <div className="space-y-2.5 pt-1">
                  <div className="text-[11px] font-bold text-[#8E95A2] uppercase tracking-wider">
                    Nasıl hazırlamak istersin?
                  </div>

                  {/* 1. SEÇENEK: AI İLE HAZIRLA */}
                  <div
                    onClick={handleCheckAndProceedWithAi}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      wordInput.trim()
                        ? 'border-[#D7D2F4] bg-[#EEECFA]/70 hover:bg-[#EEECFA]'
                        : 'border-[#E4E1D9] bg-[#F8F7F3] opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#4F46A5] text-white flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-[#1E2430]">
                            ✨ Anlora AI ile hazırla
                          </h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#4F46A5] text-white rounded-md">
                            Önerilen
                          </span>
                        </div>
                        <p className="text-xs text-[#687080] leading-relaxed">
                          Türkçe anlamları, kelime türlerini ve doğal örnekleri otomatik hazırlasın.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 2. SEÇENEK: KENDİM HAZIRLAYACAĞIM */}
                  <div
                    onClick={() => {
                      if (!wordInput.trim()) {
                        alert('Lütfen önce bir İngilizce kelime yazın.');
                        return;
                      }
                      setCreationMode('MANUAL');
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      wordInput.trim()
                        ? 'border-[#E4E1D9] hover:border-[#D5D0C5] bg-[#FFFFFF]'
                        : 'border-[#E4E1D9] bg-[#F8F7F3] opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#F1EFE8] text-[#1E2430] flex items-center justify-center shrink-0">
                        <PenTool className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-[#1E2430]">
                          ✍️ Kendim hazırlayacağım
                        </h4>
                        <p className="text-xs text-[#687080] leading-relaxed">
                          Türkçe anlamı ve kart bilgilerini kendin yaz.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={resetAddWordModal}
                    className="px-4 py-2 text-xs font-semibold text-[#687080] hover:bg-[#F1EFE8] rounded-xl cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            )}

            {/* AI LOADING SKELETON LOADER */}
            {creationMode === 'AI_GENERATING' && (
              <div className="py-10 text-center space-y-4">
                <div className="w-10 h-10 border-3 border-[#D7D2F4] border-t-[#4F46A5] rounded-full animate-spin mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#1E2430]">
                    Anlora kelime kartını hazırlıyor...
                  </h4>
                  <p className="text-xs text-[#687080]">
                    Anlamlar ve örnek cümleler hazırlanıyor...
                  </p>
                </div>
              </div>
            )}

            {/* AI PREVIEW CARD */}
            {creationMode === 'AI_PREVIEW' && generatedPreviewCard && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-xs font-bold text-[#4F806A] flex items-center gap-1.5 pb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Kelime kartın hazır.</span>
                </div>
                <div className="p-4 rounded-xl bg-[#F8F7F3] border border-[#E4E1D9] space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-2xl font-bold text-[#1E2430] flex items-baseline gap-2">
                        {generatedPreviewCard.word}
                        {generatedPreviewCard.phonetic && (
                          <span className="text-xs font-mono text-[#687080] font-normal">
                            {generatedPreviewCard.phonetic}
                          </span>
                        )}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold text-[#687080]">
                          {generatedPreviewCard.partOfSpeech}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => speakText(generatedPreviewCard.word)}
                      className="p-2 rounded-xl bg-white border border-[#E4E1D9] text-[#4F46A5] hover:bg-[#EEECFA] cursor-pointer"
                      title="Dinle"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#E4E1D9]">
                    <div className="text-[10px] font-bold text-[#4F46A5] uppercase">
                      Türkçe Anlamı
                    </div>
                    <div className="text-base font-bold text-[#1E2430] mt-0.5">
                      {generatedPreviewCard.turkishMeaning}
                    </div>
                  </div>

                  {generatedPreviewCard.examples && generatedPreviewCard.examples.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-bold text-[#8E95A2] uppercase tracking-wider">
                        Örnek Cümleler
                      </div>
                      {generatedPreviewCard.examples.map((ex, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-white rounded-lg border border-[#E4E1D9] text-xs space-y-0.5"
                        >
                          <p className="font-semibold text-[#1E2430]">{ex.en}</p>
                          <p className="text-[#687080] italic text-[11px]">"{ex.tr}"</p>
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
                      setManualPartOfSpeech(generatedPreviewCard.partOfSpeech || 'n.');
                      setManualExamples(
                        generatedPreviewCard.examples?.length
                          ? generatedPreviewCard.examples
                          : [{ en: '', tr: '' }]
                      );
                      setCreationMode('MANUAL');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-[#1E2430] bg-[#F1EFE8] hover:bg-[#E4E1D9] rounded-xl cursor-pointer"
                  >
                    Düzenle
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAiCard}
                    className="px-5 py-2 bg-[#4F46A5] hover:bg-[#433B91] text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Kaydet</span>
                  </button>
                </div>
              </div>
            )}

            {/* MANUAL FORM */}
            {creationMode === 'MANUAL' && (
              <form onSubmit={handleSaveManualCard} className="space-y-3.5 animate-fadeIn">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                      İngilizce Kelime
                    </label>
                    <input
                      type="text"
                      value={wordInput}
                      onChange={(e) => setWordInput(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl font-bold text-[#1E2430]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                      Kelime Türü
                    </label>
                    <select
                      value={manualPartOfSpeech}
                      onChange={(e) => setManualPartOfSpeech(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl font-semibold text-[#1E2430]"
                    >
                      <option value="n.">İsim (n.)</option>
                      <option value="v.">Fiil (v.)</option>
                      <option value="adj.">Sıfat (adj.)</option>
                      <option value="adv.">Zarf (adv.)</option>
                      <option value="prep.">Edat (prep.)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                    Türkçe Anlamı <span className="text-[#C65D55]">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualTurkishMeaning}
                    onChange={(e) => setManualTurkishMeaning(e.target.value)}
                    placeholder="Örn: isteksiz, gönülsüz"
                    required
                    className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl font-bold text-[#1E2430]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#EFECE6]">
                  <button
                    type="button"
                    onClick={() => setCreationMode('CHOICE')}
                    className="px-4 py-2 text-xs font-semibold text-[#687080] hover:bg-[#F1EFE8] rounded-xl cursor-pointer"
                  >
                    Geri
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#4F46A5] hover:bg-[#433B91] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
                  >
                    Kartı Kaydet
                  </button>
                </div>
              </form>
            )}
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
          handleExecuteAiGeneration();
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

      {/* MODAL: BATCH WORD ADD */}
      <BatchWordModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        targetCollection={activeDeck}
        collections={collections}
        customWords={customWords}
        oxfordWords={oxfordWords}
        onAddCustomWord={(card, cId) => onAddCustomWord(card, cId)}
        onLinkWordToCollection={(wId, cId) => onAddWordToCollection(wId, cId)}
        onBatchProcessComplete={(stats) => {
          console.log('Batch completed:', stats);
        }}
      />

      {/* MODAL: TEXT MINER */}
      <TextMinerModal
        isOpen={showMinerModal}
        onClose={() => setShowMinerModal(false)}
        collections={collections}
        customWords={customWords}
        oxfordWords={oxfordWords}
        learningStates={learningStates}
        onAddMinedWordsToCollection={(items, targetColId) => {
          items.forEach((item) => {
            if (item.matchedCard) {
              onAddWordToCollection(item.matchedCard.id, targetColId);
            } else {
              const newCard: WordCard = {
                id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                word: item.lemma || item.rawWord,
                partOfSpeech: 'n.',
                turkishMeaning: item.suggestedMeaning || item.rawWord,
                examples: [],
                isCustom: true,
                sourceType: 'custom',
                dateAdded: new Date().toISOString().slice(0, 10),
                isAiGenerated: true
              };
              onAddCustomWord(newCard, targetColId);
            }
          });
        }}
      />
    </div>
  );
};
