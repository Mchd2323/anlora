import React, { useState, useEffect } from 'react';
import { WordCard, LearningState } from '../../types';
import {
  Volume2,
  Heart,
  RotateCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Edit2,
  Trash2,
  BookmarkPlus,
  Sparkles,
  Layers,
  HelpCircle
} from 'lucide-react';
import { speakText } from '../../utils/speech';
import { CEFRBadge } from '../ui/CEFRBadge';
import { shouldShowCefr } from '../../types/oxford';
import { getUserWordStatus } from '../../utils/storageV2';

interface StudyCardProps {
  card: WordCard;
  isFavorite: boolean;
  learningState?: LearningState;
  onToggleFavorite: (id: string) => void;
  onSetStatus: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
  onOpenEdit?: (card: WordCard) => void;
  onDelete?: (id: string) => void;
  onOpenAddToCollection?: (card: WordCard) => void;
  isCustomDeck?: boolean;
}

export const StudyCard: React.FC<StudyCardProps> = ({
  card,
  isFavorite,
  learningState,
  onToggleFavorite,
  onSetStatus,
  onOpenEdit,
  onDelete,
  onOpenAddToCollection,
  isCustomDeck = false
}) => {
  // 3-Stage Active Recall Reveal State
  const [isMeaningRevealed, setIsMeaningRevealed] = useState(false);
  const [isExamplesExpanded, setIsExamplesExpanded] = useState(false);
  const [isOtherSensesExpanded, setIsOtherSensesExpanded] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // When card changes, reset reveal state
  useEffect(() => {
    setIsMeaningRevealed(false);
    setIsExamplesExpanded(false);
    setIsOtherSensesExpanded(false);
    setIsMenuOpen(false);
  }, [card.id]);

  const currentStatus = getUserWordStatus(card.id, learningState ? { [card.id]: learningState } : {});

  const handlePlayAudio = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsPlayingAudio(true);
    speakText(card.word);
    setTimeout(() => setIsPlayingAudio(false), 900);
  };

  const allExamples = card.examples && card.examples.length > 0
    ? card.examples
    : (card.senses && card.senses[0]?.examples) || [];

  const otherSenses = card.senses && card.senses.length > 1
    ? card.senses.slice(1)
    : [];

  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      <div
        className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[0_4px_24px_rgba(30,36,48,0.06)] p-6 sm:p-8 flex flex-col justify-between min-h-[380px] sm:min-h-[420px] transition-all relative overflow-hidden"
      >
        {/* Top Card Bar: Tags, Audio & Actions */}
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-2">
            {shouldShowCefr(card) && <CEFRBadge level={card.level!} size="sm" />}
            <span className="text-xs font-semibold px-2.5 py-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)]">
              {card.partOfSpeech || 'n.'}
            </span>
            {card.sourceName && (
              <span className="text-[11px] font-medium px-2 py-0.5 bg-[var(--primary-soft)] text-[var(--primary)] rounded-md truncate max-w-[140px]">
                {card.sourceName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Pronunciation Audio Button */}
            <button
              type="button"
              onClick={handlePlayAudio}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isPlayingAudio
                  ? 'bg-[var(--primary)] text-[var(--surface)] border-[var(--primary)] scale-105 shadow-xs'
                  : 'bg-[var(--bg)] hover:bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--border)]'
              }`}
              title="Telaffuz Dinle"
              aria-label="Telaffuz Dinle"
            >
              <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
            </button>

            {/* Favorite toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(card.id);
              }}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isFavorite
                  ? 'bg-[var(--danger-soft)] text-[var(--favorite-strong)] border-[var(--danger-border-strong)]'
                  : 'bg-[var(--bg)] hover:bg-[var(--danger-soft)] text-[var(--text-muted)] hover:text-[var(--favorite-strong)] border-[var(--border)]'
              }`}
              title={isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
              aria-label="Favori"
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            {/* Custom Card 3-Dots Menu */}
            {(isCustomDeck || onOpenEdit || onDelete || onOpenAddToCollection) && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(!isMenuOpen);
                  }}
                  className="p-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl border border-[var(--border)] transition-colors cursor-pointer"
                  aria-label="Seçenekler"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {isMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-44 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-lg py-1.5 z-30 space-y-0.5 animate-fadeIn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onOpenAddToCollection && (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          onOpenAddToCollection(card);
                        }}
                        className="w-full px-3 py-1.5 text-xs text-left text-[var(--text-primary)] hover:bg-[var(--bg)] flex items-center gap-2 cursor-pointer"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>Sete Ekle</span>
                      </button>
                    )}

                    {card.isCustom && onOpenEdit && (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          onOpenEdit(card);
                        }}
                        className="w-full px-3 py-1.5 text-xs text-left text-[var(--text-primary)] hover:bg-[var(--bg)] flex items-center gap-2 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                        <span>Kartı Düzenle</span>
                      </button>
                    )}

                    {card.isCustom && onDelete && (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          if (confirm(`"${card.word}" kartını silmek istediğinize emin misiniz?`)) {
                            onDelete(card.id);
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

        {/* Center: Stage 1 - English Word & Recall Area */}
        <div className="flex-1 flex flex-col justify-center items-center text-center py-6 sm:py-8 space-y-4">
          <div
            onClick={() => setIsMeaningRevealed(!isMeaningRevealed)}
            className="cursor-pointer group flex flex-col items-center gap-1.5 transition-transform active:scale-[0.98]"
          >
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tight group-hover:text-[var(--primary)] transition-colors">
              {card.word}
            </h2>
            {card.phonetic && (
              <span className="text-xs font-mono text-[var(--text-muted)]">
                /{card.phonetic}/
              </span>
            )}

            {!isMeaningRevealed && (
              <div className="mt-4 px-3.5 py-1.5 bg-[var(--bg)] group-hover:bg-[var(--primary-soft)] text-[var(--text-muted)] group-hover:text-[var(--primary)] rounded-full text-xs font-semibold border border-[var(--border)] transition-all flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                <span>Anlamı görmek için dokun</span>
              </div>
            )}
          </div>

          {/* Stage 2 - Turkish Meaning (Smooth Reveal) */}
          {isMeaningRevealed && (
            <div className="w-full space-y-4 pt-2 animate-fadeIn">
              <div className="p-4 bg-[var(--neutral-25)] rounded-xl border border-[var(--border)] text-center space-y-1">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                  Türkçe Anlamı
                </span>
                <p className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                  {card.turkishMeaning}
                </p>
                {card.contextualMeaning && card.contextualMeaning !== card.turkishMeaning && (
                  <p className="text-xs text-[var(--primary)] font-medium pt-1">
                    Bağlam anlamı: {card.contextualMeaning}
                  </p>
                )}
              </div>

              {/* Multi-Sense Accordion if applicable */}
              {otherSenses.length > 0 && (
                <div className="w-full text-left">
                  <button
                    onClick={() => setIsOtherSensesExpanded(!isOtherSensesExpanded)}
                    className="w-full px-3.5 py-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-xs font-semibold text-[var(--text-secondary)] rounded-xl border border-[var(--border)] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Diğer Anlamlar ({otherSenses.length})</span>
                    </span>
                    {isOtherSensesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isOtherSensesExpanded && (
                    <div className="mt-2 space-y-2 p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)] text-xs animate-fadeIn">
                      {otherSenses.map((sense, idx) => (
                        <div key={sense.id || idx} className="border-b border-[var(--border-light)] last:border-0 pb-2 last:pb-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            {sense.partOfSpeech && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[var(--border)] text-[var(--text-secondary)] rounded">
                                {sense.partOfSpeech}
                              </span>
                            )}
                            <span className="font-bold text-[var(--text-primary)]">
                              {sense.turkishMeanings.join(', ')}
                            </span>
                          </div>
                          {sense.examples && sense.examples[0] && (
                            <p className="text-[11px] text-[var(--text-secondary)] italic">
                              "{sense.examples[0].en}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stage 3 - Example Sentences Accordion */}
              {allExamples.length > 0 && (
                <div className="w-full text-left">
                  <button
                    onClick={() => setIsExamplesExpanded(!isExamplesExpanded)}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-xs font-semibold text-[var(--text-primary)] rounded-xl border border-[var(--border)] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>Örnek Cümleler ({allExamples.length})</span>
                    {isExamplesExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                    )}
                  </button>

                  {isExamplesExpanded && (
                    <div className="mt-2 space-y-2.5 p-3.5 bg-[var(--neutral-25)] rounded-xl border border-[var(--border)] text-xs animate-fadeIn">
                      {allExamples.map((ex, idx) => (
                        <div key={idx} className="space-y-1 border-b border-[var(--border-light)] last:border-0 pb-2.5 last:pb-0">
                          <p className="font-medium text-[var(--text-primary)] leading-relaxed">
                            {ex.en}
                          </p>
                          <p className="text-[var(--text-secondary)] text-[11px]">
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

        {/* Bottom Bar: Status Toggles (Öğreniyorum / Öğrendim) */}
        <div className="pt-4 border-t border-[var(--border-light)] flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            Durum:
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onSetStatus(card.id, currentStatus === 'learning' ? 'unseen' : 'learning')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                currentStatus === 'learning'
                  ? 'bg-[var(--learning-soft)] text-[var(--learning)] border-[var(--learning-border)]'
                  : 'bg-[var(--bg)] hover:bg-[var(--learning-soft)] text-[var(--text-secondary)] border-[var(--border)]'
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${currentStatus === 'learning' ? 'animate-spin-slow' : ''}`} />
              <span>{currentStatus === 'learning' ? 'Öğreniyorum' : 'Öğren'}</span>
            </button>

            <button
              onClick={() => onSetStatus(card.id, currentStatus === 'learned' ? 'unseen' : 'learned')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                currentStatus === 'learned'
                  ? 'bg-[var(--learned-soft)] text-[var(--learned)] border-[var(--learned-border)]'
                  : 'bg-[var(--bg)] hover:bg-[var(--learned-soft)] text-[var(--text-secondary)] border-[var(--border)]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{currentStatus === 'learned' ? 'Öğrendim' : 'Öğrendim'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
