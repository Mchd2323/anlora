import React from 'react';
import { DuplicateCheckResult, WordCard } from '../types';
import { AlertCircle, Edit2, Link, X } from 'lucide-react';
import { CEFRBadge } from './ui/CEFRBadge';
import { shouldShowCefr } from '../types/oxford';
import { useModalA11y } from '../hooks/useModalA11y';
import { RealmsIcon } from './ui/RealmsIcon';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateInfo: DuplicateCheckResult | null;
  onAddExistingToCollection?: () => void;
  onForceCreateNew?: () => void;
  onUseBaseForm?: (baseForm: string) => void;
  onViewCard?: (card: WordCard) => void;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  isOpen,
  onClose,
  duplicateInfo,
  onAddExistingToCollection,
  onForceCreateNew,
  onUseBaseForm,
  onViewCard
}) => {
  const modalRef = useModalA11y(isOpen, onClose);

  /*
   * Erken çıkış TÜM hook çağrılarından SONRA gelir.
   *
   * Burada hook'lardan önceydi: modal kapalıyken bileşen sıfır hook ile,
   * açıkken altı hook ile render ediliyordu. React bunu "beklenenden az
   * hook" diye görüp render'ı fırlatıyor; fırlatılan render'da efekt
   * TEMİZLEME adımı da çalışmıyordu. Temizleme adımı gövde kaydırma
   * kilidini çözen yer olduğu için, kullanıcı bu modali bir kez açıp
   * kapattıktan sonra uygulama kalıcı olarak kaydırılamaz hâle geliyordu
   * ("biraz kullanınca donuyor").
   */
  if (!isOpen || !duplicateInfo) return null;

  const card = duplicateInfo.matchedWordCard;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="anlora-duplicate-title"
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[var(--text-primary)]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain">
      <div
        className="bg-[var(--surface)] rounded-2xl max-w-lg w-full border border-[var(--border)] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--surface)] border-b border-[var(--border-light)] p-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[var(--learning-soft)] text-[var(--learning-text)] rounded-xl">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 id="anlora-duplicate-title" className="text-sm font-bold text-[var(--text-primary)]">Mevcut Kelime Tespiti</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                "{duplicateInfo.normalizedWord}" kelimesi sistemde incelendi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-soft)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3.5">
          {/* Situation 1: Exact in this collection */}
          {duplicateInfo.type === 'EXACT_IN_COLLECTION' && (
            <div className="space-y-2.5">
              <div className="p-3.5 bg-[var(--learning-soft)]/60 rounded-xl border border-[var(--learning-border)] text-xs text-[var(--learning-text)] space-y-1">
                <p className="font-bold text-[var(--learning-text)]">
                  Bu kelime zaten <span className="underline">{duplicateInfo.matchedCollectionName}</span> setinde mevcut!
                </p>
                <p className="text-[11px] text-[var(--learning-text)]">
                  Yanlışlıkla eklemeyesin diye soruyoruz. Farklı bir anlamı
                  için ikinci bir kart açmak istersen aşağıdan devam edebilirsin.
                </p>
              </div>

              {card && (
                <div className="p-3.5 bg-[var(--bg)] rounded-xl border border-[var(--border)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{card.word}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-[var(--border)] rounded text-[var(--text-secondary)]">{card.partOfSpeech}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">Anlam: <span className="font-bold text-[var(--text-primary)]">{card.turkishMeaning}</span></p>
                  {card.examples && card.examples[0] && (
                    <p className="text-[11px] text-[var(--text-secondary)] italic">Örnek: {card.examples[0].en}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Situation 2: Exact in other user collection */}
          {duplicateInfo.type === 'EXACT_IN_OTHER_COLLECTION' && (
            <div className="space-y-2.5">
              <div className="p-3.5 bg-[var(--primary-soft)]/60 rounded-xl border border-[var(--primary-border)] text-xs text-[var(--primary)] space-y-1">
                <p className="font-bold">
                  Bu kelime daha önce <span className="underline">{duplicateInfo.otherCollectionNames?.join(', ')}</span> setinde oluşturulmuş.
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Hafıza durumunu korumak için mevcut kartı bu sete bağlayabilirsin.
                </p>
              </div>

              {card && (
                <div className="p-3.5 bg-[var(--bg)] rounded-xl border border-[var(--border)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{card.word}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-[var(--border)] rounded text-[var(--text-secondary)]">{card.partOfSpeech}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">Anlam: <span className="font-bold text-[var(--text-primary)]">{card.turkishMeaning}</span></p>
                </div>
              )}
            </div>
          )}

          {/* Situation 3: In Oxford 3000 */}
          {duplicateInfo.type === 'EXACT_IN_OXFORD' && (
            <div className="space-y-2.5">
              <div className="p-3.5 bg-[var(--primary-soft)]/60 rounded-xl border border-[var(--primary-border)] text-xs text-[var(--primary)] space-y-1">
                <p className="font-bold">
                  Bu kelime Oxford 3000 ({duplicateInfo.oxfordLevel}) listesinde hazır olarak bulunmaktadır.
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Hazır Oxford kartını doğrudan setine ekleyebilirsin.
                </p>
              </div>

              {card && (
                <div className="p-3.5 bg-[var(--bg)] rounded-xl border border-[var(--border)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{card.word}</span>
                    <div className="flex items-center gap-1.5">
                      {shouldShowCefr(card) && <CEFRBadge level={card.level!} size="sm" />}
                      <span className="text-[11px] text-[var(--text-secondary)]">{card.partOfSpeech}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">Anlam: <span className="font-bold text-[var(--text-primary)]">{card.turkishMeaning}</span></p>
                </div>
              )}
            </div>
          )}

          {/* Situation 4: Inflected Form detected */}
          {duplicateInfo.type === 'INFLECTED_FORM' && duplicateInfo.lemmaSuggestion && (
            <div className="p-3.5 bg-[var(--learning-soft)]/60 rounded-xl border border-[var(--learning-border)] text-xs text-[var(--learning-text)] space-y-1">
              <p className="font-bold">Çekimli Kelime Tespiti:</p>
              <p className="text-[11px]">{duplicateInfo.lemmaSuggestion.explanation}</p>
              <p className="text-[11px] text-[var(--learning-text)]">
                Kalıcı hafıza için genellikle kök formu (<b>{duplicateInfo.lemmaSuggestion.baseForm}</b>) kartlaştırmak önerilir.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-[var(--border-light)] flex flex-col gap-2">
            {duplicateInfo.type === 'INFLECTED_FORM' && duplicateInfo.lemmaSuggestion && onUseBaseForm && (
              <button
                onClick={() => onUseBaseForm(duplicateInfo.lemmaSuggestion!.baseForm)}
                className="dugme-birincil w-full py-2 px-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RealmsIcon name="book" size={18} />
                <span>Kök Biçimini ("{duplicateInfo.lemmaSuggestion.baseForm}") Ekle</span>
              </button>
            )}

            {(duplicateInfo.type === 'EXACT_IN_OTHER_COLLECTION' || duplicateInfo.type === 'EXACT_IN_OXFORD') && onAddExistingToCollection && (
              <button
                onClick={onAddExistingToCollection}
                className="dugme-birincil w-full py-2 px-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Link className="w-3.5 h-3.5" />
                <span>Mevcut Kartı Bu Sete Bağla</span>
              </button>
            )}

            {duplicateInfo.type === 'EXACT_IN_COLLECTION' && card && onViewCard && (
              <button
                onClick={() => {
                  onViewCard(card);
                  onClose();
                }}
                className="w-full py-2 px-3 bg-[var(--text-primary)] hover:bg-[var(--ink-hover)] text-[var(--bg)] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Mevcut Kartı Görüntüle</span>
              </button>
            )}

            {/*
              "Yine de oluştur" her durumda durur.
              
              Uyarı kazayla ikinci kez eklemeyi durdurmak içindir, kullanıcıyı
              engellemek için değil: aynı kelimenin ayrı bir anlamı (bank =
              banka / nehir kıyısı) meşru biçimde ikinci bir kart ister. Karar
              kullanıcınındır; uygulamanın işi ona durumu söylemektir.
            */}
            {onForceCreateNew && (
              <button
                onClick={onForceCreateNew}
                className="w-full py-2 px-3 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RealmsIcon name="add" size={18} />
                <span>Farklı anlam için yine de ekle</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-center cursor-pointer"
            >
              Vazgeç
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
