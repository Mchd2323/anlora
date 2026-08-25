import React, { useState } from 'react';
import { WordCard as WordCardType, LearningState } from '../types';
import {
  Volume2,
  Heart,
  RotateCw,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  BookmarkPlus,
  Layers
} from 'lucide-react';
import { speakText } from '../utils/speech';
import { CEFRBadge } from './ui/CEFRBadge';
import { BRAND } from '../config/brand';
import { LearningStatusControl } from './ui/LearningStatusControl';

interface WordCardProps {
  card: WordCardType;
  isFavorite: boolean;
  isLearned?: boolean;
  status?: 'learned' | 'learning' | 'unseen';
  learningState?: LearningState;
  collectionNames?: string[];
  onToggleFavorite: (id: string) => void;
  onToggleLearned?: (id: string) => void;
  onSetStatus?: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
  onDeleteCustom?: (id: string) => void;
  onEditCustom?: (card: WordCardType) => void;
  onOpenAddToCollection?: (card: WordCardType) => void;
}

const WordCardComponentImpl: React.FC<WordCardProps> = ({
  card,
  isFavorite,
  isLearned,
  status,
  learningState,
  collectionNames = [],
  onToggleFavorite,
  onToggleLearned,
  onSetStatus,
  onDeleteCustom,
  onEditCustom,
  onOpenAddToCollection
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const handlePlayAudio = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    setIsPlayingAudio(true);
    speakText(text).finally(() => setIsPlayingAudio(false));
  };

  // Determine current status: 'learned' | 'learning' | 'unseen'
  const currentStatus: 'learned' | 'learning' | 'unseen' = (() => {
    if (status) return status;
    if (learningState?.userStatus) return learningState.userStatus;
    if (learningState?.stage === 'MASTERED' || isLearned) return 'learned';
    if (
      learningState?.stage === 'LEARNING' ||
      learningState?.stage === 'WEAK' ||
      learningState?.stage === 'REVIEW' ||
      learningState?.stage === 'RELEARNING'
    ) {
      return 'learning';
    }
    return 'unseen';
  })();

  const handleSetStatus = (newStatus: 'learned' | 'learning' | 'unseen') => {
    if (onSetStatus) {
      onSetStatus(card.id, newStatus);
    } else if (onToggleLearned && newStatus === 'learned') {
      onToggleLearned(card.id);
    }
  };

  return (
    <div
      className={`group relative bg-[#FFFFFF] rounded-2xl border transition-all duration-200 flex flex-col justify-between hover:-translate-y-0.5 ${
        currentStatus === 'learned'
          ? 'border-[#BFD7C8] shadow-[0_2px_12px_-2px_rgba(79,128,106,0.08)]'
          : currentStatus === 'learning'
          ? 'border-[#E7C98F] shadow-[0_2px_12px_-2px_rgba(185,121,34,0.08)]'
          : 'border-[#E4E1D9] hover:border-[#D5D0C5] shadow-[0_1px_3px_rgba(30,36,48,0.03)]'
      }`}
    >
      <div>
        {/* Top Header: CEFR & POS info, Collections tag & Actions */}
        <div className="flex items-center justify-between p-4 pb-3 border-b border-[#EFECE6]">
          <div className="flex flex-wrap items-center gap-2">
            {!card.isCustom && card.sourceType !== 'custom' && card.level && (
              <CEFRBadge level={card.level} size="sm" />
            )}
            <span className="text-xs font-semibold text-[#687080]">
              {card.partOfSpeech}
            </span>

            {card.isCustom && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[#F1EFE8] text-[#1E2430] border border-[#E4E1D9] rounded-md">
                <Sparkles className="w-2.5 h-2.5 text-[#4F46A5]" /> Özel
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onOpenAddToCollection && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAddToCollection(card);
                }}
                title="Sete Ekle"
                className="p-1.5 text-[#8E95A2] hover:text-[#4F46A5] hover:bg-[#EEECFA] rounded-lg transition-colors cursor-pointer"
              >
                <BookmarkPlus className="w-4 h-4" />
              </button>
            )}

            {/* Favorite Heart */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(card.id);
              }}
              title={isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isFavorite
                  ? 'text-[#B75D6A] bg-[#FDF0F2]'
                  : 'text-[#8E95A2] hover:text-[#B75D6A] hover:bg-[#FDF0F2]'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : 'stroke-[1.8]'}`} />
            </button>

            {/* Custom Card Editing */}
            {card.isCustom && (
              <>
                {onEditCustom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditCustom(card);
                    }}
                    title="Kartı Düzenle"
                    className="p-1.5 text-[#8E95A2] hover:text-[#4F46A5] hover:bg-[#EEECFA] rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDeleteCustom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`"${card.word}" kelime kartını silmek istediğinize emin misiniz?`)) {
                        onDeleteCustom(card.id);
                      }
                    }}
                    title="Kartı Sil"
                    className="p-1.5 text-[#8E95A2] hover:text-[#C65D55] hover:bg-[#FAECEA] rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Collection membership tags if any */}
        {collectionNames.length > 0 && (
          <div className="px-4 pt-2.5 flex flex-wrap gap-1 items-center">
            {collectionNames.map((cName, idx) => (
              <span
                key={idx}
                className="text-[11px] font-medium px-2 py-0.5 bg-[#F1EFE8] text-[#687080] rounded-md flex items-center gap-1 border border-[#E4E1D9]"
              >
                <Layers className="w-2.5 h-2.5 text-[#4F46A5]" />
                {cName}
              </span>
            ))}
          </div>
        )}

        {/* Main Front / Back Card Body */}
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="p-5 cursor-pointer select-none space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              {/* English Word: High visual hierarchy */}
              <h3 className="text-3xl sm:text-4xl font-bold text-[#1E2430] tracking-tight group-hover:text-[#4F46A5] transition-colors leading-none">
                {card.word}
              </h3>
              {card.phonetic && (
                <p className="text-xs font-mono text-[#687080] mt-1 tracking-normal">
                  {card.phonetic}
                </p>
              )}

              {/* Source Context Quote */}
              {card.sourceContext && (
                <div className="mt-2.5 p-2.5 bg-[#F1EFE8] border border-[#E4E1D9] rounded-xl text-xs text-[#1E2430]">
                  <span className="font-semibold text-[#4F46A5] block text-[10px] uppercase tracking-wider mb-0.5">
                    Bağlam:
                  </span>
                  <p className="italic font-normal">"{card.sourceContext}"</p>
                </div>
              )}
            </div>

            {/* Audio Button */}
            <button
              onClick={(e) => handlePlayAudio(e, card.word)}
              className={`p-2.5 rounded-xl bg-[#EEECFA] text-[#4F46A5] hover:bg-[#E3DFF6] transition-all active:scale-95 shrink-0 cursor-pointer ${
                isPlayingAudio ? 'opacity-70' : ''
              }`}
              title="Kelime Telaffuzu Dinle"
            >
              <Volume2 className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>

          {/* Turkish Meaning Area */}
          <div className="pt-2">
            {isFlipped ? (
              <div className="p-4 bg-[#F7F5EF] rounded-xl border border-[#E4E1D9] animate-fadeIn space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-[#4F46A5] uppercase tracking-wider block mb-0.5">
                    Türkçe Anlamı
                  </span>
                  {card.turkishMeaning ? (
                    <p className="text-lg font-bold text-[#1E2430] leading-snug">
                      {card.turkishMeaning}
                    </p>
                  ) : (
                    /* Anlamı henüz hazırlanmamış kayıt: uydurma karşılık
                       göstermek yerine durum açıkça söylenir. */
                    <p className="text-sm text-[#8E95A2] leading-relaxed">
                      Bu kelimenin Türkçe karşılığı henüz hazırlanmadı.
                    </p>
                  )}
                </div>

                {/* Multiple senses breakdown if available */}
                {card.senses && card.senses.some((s) => s.turkishMeanings.length > 0) && (
                  <div className="pt-2 border-t border-[#E4E1D9] space-y-1.5">
                    {card.senses.filter((s) => s.turkishMeanings.length > 0).map((s, sIdx) => (
                      <div key={sIdx} className="text-xs">
                        <span className="font-bold text-[#4F46A5] mr-1.5">{s.partOfSpeech}</span>
                        <span className="text-[#1E2430] font-medium">{s.turkishMeanings.join('; ')}</span>
                        {s.usageNoteTr && (
                          <span className="block text-[11px] text-[#687080] italic mt-0.5">
                            {s.usageNoteTr}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between py-1.5 text-xs text-[#687080] font-medium group-hover:text-[#4F46A5] transition-colors">
                <span className="flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5 text-[#8E95A2] group-hover:text-[#4F46A5]" />
                  <span>Türkçe anlamı görmek için dokunun</span>
                </span>
              </div>
            )}
          </div>

          {/* Collocations */}
          {card.collocations && card.collocations.length > 0 && (
            <div className="pt-1 flex flex-wrap gap-1 items-center">
              {card.collocations.map((col, idx) => (
                <span
                  key={idx}
                  className="text-[11px] font-medium px-2 py-0.5 bg-[#F1EFE8] text-[#687080] rounded-md border border-[#E4E1D9]"
                >
                  🔗 {col}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Examples Accordion Toggle */}
        <div className="px-4 pb-3">
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="w-full flex items-center justify-between py-2 px-3 text-xs font-semibold text-[#687080] bg-[#F8F7F3] hover:bg-[#F1EFE8] rounded-xl transition-colors border border-[#E4E1D9] cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#4F46A5]" />
              Örnek Cümleler ({card.examples?.length || 0})
            </span>
            {showExamples ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#8E95A2]" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#8E95A2]" />
            )}
          </button>

          {showExamples && (
            <div className="mt-2 space-y-2 text-xs">
              {card.examples && card.examples.length > 0 ? (
                card.examples.map((ex, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9] space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-[#1E2430] leading-relaxed font-medium">
                        <strong className="text-[#4F46A5] mr-1">{idx + 1}.</strong> {ex.en}
                      </p>
                      <button
                        onClick={(e) => handlePlayAudio(e, ex.en)}
                        className="p-1 text-[#8E95A2] hover:text-[#4F46A5] rounded transition-colors shrink-0 cursor-pointer"
                        title="Cümleyi Sesli Dinle"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[#687080] italic pl-2.5 border-l-2 border-[#D7D2F4] text-[11px]">
                      "{ex.tr}"
                    </p>
                  </div>
                ))
              ) : (
                /*
                 * Bu maddenin örnekleri şablondan üretildiği ve dilbilgisi
                 * dışı olduğu için veriden çıkarıldı. Uydurma bir cümle
                 * göstermektense durumu açıkça söylüyoruz: yanlış kalıp
                 * öğretmek, örnek göstermemekten kötüdür.
                 */
                <p className="text-[#8E95A2] text-center py-3 text-[11px] leading-relaxed">
                  Bu kelime için doğrulanmış örnek cümle henüz yok.
                  <br />
                  Kendi kartını oluşturup {BRAND.aiName} ile örnek cümle hazırlatabilirsin.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Two Prominent Action Buttons: Öğrendim & Öğreniyorum */}
      <div className="p-4 pt-2 border-t border-[#EFECE6]">
        <LearningStatusControl
          status={currentStatus}
          onSetStatus={handleSetStatus}
          size="md"
        />
      </div>
    </div>
  );
};

/**
 * Kart bileşeni memoize edilir.
 *
 * Listelerde aynı anda onlarca kart durur. Memoizasyon olmadan tek bir favori
 * dokunuşu ya da tek bir durum değişikliği listedeki BÜTÜN kartları yeniden
 * render ediyordu; kullanıcı bunu "butona basınca hemen olmuyor, saniyeler
 * geçiyor" diye görüyordu.
 *
 * Bunun işe yaraması için üst bileşenin geçtiği fonksiyonların kimliği de
 * kararlı olmalı (`useCallback`); yoksa her prop yeni sayılır ve memo hiçbir
 * şeyi engellemez.
 */
export const WordCardComponent = React.memo(WordCardComponentImpl);
WordCardComponent.displayName = 'WordCardComponent';
