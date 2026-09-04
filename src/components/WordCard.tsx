import React, { useState } from 'react';
import { WordCard as WordCardType, LearningState } from '../types';
import { Heart, Sparkles, ChevronUp, Edit3, Trash2 } from 'lucide-react';
import { speakText } from '../utils/speech';
import { PronounceButtons } from './ui/PronounceButtons';
import { CardMotif } from './ui/CardMotif';
import { CEFRBadge } from './ui/CEFRBadge';
import { BRAND } from '../config/brand';
import { LearningStatusControl } from './ui/LearningStatusControl';
import { RealmsIcon } from './ui/RealmsIcon';

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
  /**
   * "Bu kelimede hata var" bildirimi.
   *
   * Kartın üzerinde durur çünkü hata tam da orada fark edilir; kullanıcı
   * hangi kelime olduğunu ayrıca yazmak ya da hatırlamak zorunda kalmaz.
   */
  onReportWord?: (card: WordCardType) => void;
  /*
   * SEÇİM KUTUCUĞU KARTIN KENDİ DÜZENİNDE.
   *
   * Önceden liste tarafında `absolute top-2 left-2` ile kartın ÜSTÜNE
   * bindiriliyordu ve tam olarak seviye rozetinin (A1, B2…) durduğu yere
   * geliyordu; rozet görünmez oluyordu. Bindirilen bir öğe kartın içinde ne
   * olduğunu bilmez, bu yüzden çakışma kaçınılmazdı.
   *
   * Kutucuk artık başlık satırının ilk öğesi: rozetle yan yana duruyor,
   * kimseyi örtmüyor ve kart düzeni değişse bile çakışamaz.
   * `onToggleSelected` verilmezse hiç çizilmez.
   */
  isSelected?: boolean;
  onToggleSelected?: () => void;
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
  onOpenAddToCollection,
  onReportWord,
  isSelected,
  onToggleSelected
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
      className={`group relative bg-[var(--surface)] rounded-2xl border transition-all duration-200 flex flex-col justify-between hover:-translate-y-0.5 ${
        currentStatus === 'learned'
          ? 'border-[var(--learned-border)] shadow-[0_2px_12px_-2px_rgba(79,128,106,0.08)]'
          : currentStatus === 'learning'
          ? 'border-[var(--learning-border)] shadow-[0_2px_12px_-2px_rgba(185,121,34,0.08)]'
          : 'border-[var(--border)] hover:border-[var(--neutral-300)] shadow-[0_1px_3px_rgba(30,36,48,0.03)]'
      }`}
    >
      {/*
        Tema şeridi. Kartın en üstünde, içeriğin dışında duruyor: desen
        kelimenin, IPA'nın ya da anlamın arkasına hiç girmiyor. Motif CEFR
        seviyesinden türüyor, rastgele değil.
      */}
      <CardMotif
        word={card.word}
        level={card.level ?? ''}
        wordType={card.partOfSpeech ?? ''}
        className="mt-3 mx-4"
      />

      <div>
        {/* Top Header: CEFR & POS info, Collections tag & Actions */}
        <div className="flex items-center justify-between p-4 pb-3 border-b border-[var(--border-light)]">
          <div className="flex flex-wrap items-center gap-2">
            {onToggleSelected && (
              <label
                className="flex items-center justify-center w-6 h-6 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] cursor-pointer shrink-0 hover:border-[var(--primary)] transition-colors"
                title="Seç"
                onClick={e => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={!!isSelected}
                  onChange={onToggleSelected}
                  className="accent-[var(--primary)] cursor-pointer"
                  aria-label={`${card.word} kelimesini seç`}
                />
              </label>
            )}
            {!card.isCustom && card.sourceType !== 'custom' && card.level && (
              <CEFRBadge level={card.level} size="sm" />
            )}

            {/*
              Yapay zekâ ile hazırlanmış kart olduğu görünsün.
              Kaynağını gizlemek, elle yazılmış sözlük kaydıyla otomatik
              üretimi aynı güvenilirlikte göstermek olurdu.
            */}
            {card.isAiGenerated && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--learning-soft)] text-[var(--learning-text)] border border-[var(--learning-border)]"
                title="Bu kartın içeriği yapay zekâ tarafından hazırlandı"
              >
                AI
              </span>
            )}
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {card.partOfSpeech}
            </span>

            {/*
              Kalıp/deyim rozeti. 'word' için hiçbir şey çizilmez: kartların
              büyük çoğunluğu tek kelimedir, hepsine "Kelime" yazmak rozetin
              ayırt ediciliğini yok eder. Rozet yalnızca sıra dışı olanı
              söyler.
            */}
            {(card.entryType === 'phrase' || card.entryType === 'idiom') && (
              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)] rounded-md">
                {card.entryType === 'idiom' ? 'Deyim' : 'Kalıp'}
              </span>
            )}

            {card.isCustom && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[var(--surface-soft)] text-[var(--text-primary)] border border-[var(--border)] rounded-md">
                <Sparkles className="w-2.5 h-2.5 text-[var(--primary)]" /> Özel
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
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors cursor-pointer"
              >
                <RealmsIcon name="bookmark" size={20} />
              </button>
            )}

            {onReportWord && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReportWord(card);
                }}
                title="Bu kelimede hata bildir"
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded-lg transition-colors cursor-pointer"
              >
                <RealmsIcon name="report" size={20} />
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
                  ? 'text-[var(--favorite)] bg-[var(--favorite-soft)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--favorite)] hover:bg-[var(--favorite-soft)]'
              }`}
            >
              <RealmsIcon name="favorite" size={20} className="${isFavorite ? 'fill-current' : 'stroke-[1.8]'}" />
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
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors cursor-pointer"
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
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded-lg transition-colors cursor-pointer"
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
                className="text-[11px] font-medium px-2 py-0.5 bg-[var(--surface-soft)] text-[var(--text-secondary)] rounded-md flex items-center gap-1 border border-[var(--border)]"
              >
                <RealmsIcon name="sets" size={18} className="text-[var(--primary)]" />
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
              <h3 className="kelime-basligi text-3xl sm:text-4xl font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors leading-none">
                {card.word}
              </h3>
              {card.phonetic && (
                <p className="text-xs font-mono text-[var(--text-secondary)] mt-1 tracking-normal">
                  {card.phonetic}
                </p>
              )}

              {/* Source Context Quote */}
              {card.sourceContext && (
                <div className="mt-2.5 p-2.5 bg-[var(--surface-soft)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)]">
                  <span className="font-semibold text-[var(--primary)] block text-[10px]  tracking-wider mb-0.5">
                    Bağlam:
                  </span>
                  <p className="italic font-normal">"{card.sourceContext}"</p>
                </div>
              )}
            </div>

            {/* Telaffuz: normal hız + yavaş hız */}
            <PronounceButtons text={card.word} />
          </div>

          {/* Turkish Meaning Area */}
          <div className="pt-2">
            {isFlipped ? (
              <div className="p-4 bg-[var(--neutral-50)] rounded-xl border border-[var(--border)] animate-fadeIn space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-[var(--primary)]  tracking-wider block mb-0.5">
                    Türkçe Anlamı
                  </span>
                  {card.turkishMeaning ? (
                    <p className="text-lg font-bold text-[var(--text-primary)] leading-snug">
                      {card.turkishMeaning}
                    </p>
                  ) : (
                    /* Anlamı henüz hazırlanmamış kayıt: uydurma karşılık
                       göstermek yerine durum açıkça söylenir. */
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      Bu kelimenin Türkçe karşılığı henüz hazırlanmadı.
                    </p>
                  )}
                </div>

                {/* Multiple senses breakdown if available */}
                {card.senses && card.senses.some((s) => s.turkishMeanings.length > 0) && (
                  <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
                    {card.senses.filter((s) => s.turkishMeanings.length > 0).map((s, sIdx) => (
                      <div key={sIdx} className="text-xs">
                        <span className="font-bold text-[var(--primary)] mr-1.5">{s.partOfSpeech}</span>
                        <span className="text-[var(--text-primary)] font-medium">{s.turkishMeanings.join('; ')}</span>
                        {s.usageNoteTr && (
                          <span className="block text-[11px] text-[var(--text-secondary)] italic mt-0.5">
                            {s.usageNoteTr}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between py-1.5 text-xs text-[var(--text-secondary)] font-medium group-hover:text-[var(--primary)] transition-colors">
                <span className="flex items-center gap-1.5">
                  <RealmsIcon name="repeat" size={18} className="text-[var(--text-muted)] group-hover:text-[var(--primary)]" />
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
                  className="text-[11px] font-medium px-2 py-0.5 bg-[var(--surface-soft)] text-[var(--text-secondary)] rounded-md border border-[var(--border)]"
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
            className="w-full flex items-center justify-between py-2 px-3 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg)] hover:bg-[var(--surface-soft)] rounded-xl transition-colors border border-[var(--border)] cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <RealmsIcon name="book" size={18} className="text-[var(--primary)]" />
              Örnek Cümleler ({card.examples?.length || 0})
            </span>
            {showExamples ? (
              <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            ) : (
              <RealmsIcon name="chevron-down" size={18} className="text-[var(--text-muted)]" />
            )}
          </button>

          {showExamples && (
            <div className="mt-2 space-y-2 text-xs">
              {card.examples && card.examples.length > 0 ? (
                card.examples.map((ex, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)] space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-[var(--text-primary)] leading-relaxed font-medium">
                        <strong className="text-[var(--primary)] mr-1">{idx + 1}.</strong> {ex.en}
                      </p>
                      <button
                        type="button"
              onClick={(e) => handlePlayAudio(e, ex.en)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] rounded transition-colors shrink-0 cursor-pointer"
                        title="Cümleyi Sesli Dinle"
                      >
                        <RealmsIcon name="audio" size={18} />
                      </button>
                    </div>
                    <p className="text-[var(--text-secondary)] italic pl-2.5 border-l-2 border-[var(--primary-border)] text-[11px]">
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
                <p className="text-[var(--text-muted)] text-center py-3 text-[11px] leading-relaxed">
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
      <div className="p-4 pt-2 border-t border-[var(--border-light)]">
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
