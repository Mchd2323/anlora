import React from 'react';
import { DuplicateCheckResult, WordCard } from '../types';
import { AlertCircle, Plus, Edit2, Link, BookOpen, X } from 'lucide-react';
import { CEFRBadge } from './ui/CEFRBadge';

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
  if (!isOpen || !duplicateInfo) return null;

  const card = duplicateInfo.matchedWordCard;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2430]/40 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-[#FFFFFF] rounded-2xl max-w-lg w-full border border-[#E4E1D9] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FFFFFF] border-b border-[#EFECE6] p-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FBF1DE] text-[#B97922] rounded-xl">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1E2430]">Mevcut Kelime Tespiti</h3>
              <p className="text-xs text-[#687080]">
                "{duplicateInfo.normalizedWord}" kelimesi sistemde incelendi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8E95A2] hover:text-[#1E2430] rounded-lg hover:bg-[#F1EFE8] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3.5">
          {/* Situation 1: Exact in this collection */}
          {duplicateInfo.type === 'EXACT_IN_COLLECTION' && (
            <div className="space-y-2.5">
              <div className="p-3.5 bg-[#FBF1DE]/60 rounded-xl border border-[#E7C98F] text-xs text-[#8A5A18] space-y-1">
                <p className="font-bold text-[#8A5A18]">
                  Bu kelime zaten <span className="underline">{duplicateInfo.matchedCollectionName}</span> setinde mevcut!
                </p>
                <p className="text-[11px] text-[#8A5A18]">
                  Mevcut kartı kullanabilir veya farklı bir anlam için yeni kart oluşturabilirsin.
                </p>
              </div>

              {card && (
                <div className="p-3.5 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#1E2430]">{card.word}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-[#E4E1D9] rounded text-[#687080]">{card.partOfSpeech}</span>
                  </div>
                  <p className="text-xs text-[#687080]">Anlam: <span className="font-bold text-[#1E2430]">{card.turkishMeaning}</span></p>
                  {card.examples && card.examples[0] && (
                    <p className="text-[11px] text-[#687080] italic">Örnek: {card.examples[0].en}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Situation 2: Exact in other user collection */}
          {duplicateInfo.type === 'EXACT_IN_OTHER_COLLECTION' && (
            <div className="space-y-2.5">
              <div className="p-3.5 bg-[#EEECFA]/60 rounded-xl border border-[#D7D2F4] text-xs text-[#4F46A5] space-y-1">
                <p className="font-bold">
                  Bu kelime daha önce <span className="underline">{duplicateInfo.otherCollectionNames?.join(', ')}</span> setinde oluşturulmuş.
                </p>
                <p className="text-[11px] text-[#687080]">
                  Hafıza durumunu korumak için mevcut kartı bu sete bağlayabilirsin.
                </p>
              </div>

              {card && (
                <div className="p-3.5 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#1E2430]">{card.word}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-[#E4E1D9] rounded text-[#687080]">{card.partOfSpeech}</span>
                  </div>
                  <p className="text-xs text-[#687080]">Anlam: <span className="font-bold text-[#1E2430]">{card.turkishMeaning}</span></p>
                </div>
              )}
            </div>
          )}

          {/* Situation 3: In Oxford 3000 */}
          {duplicateInfo.type === 'EXACT_IN_OXFORD' && (
            <div className="space-y-2.5">
              <div className="p-3.5 bg-[#EEECFA]/60 rounded-xl border border-[#D7D2F4] text-xs text-[#4F46A5] space-y-1">
                <p className="font-bold">
                  Bu kelime Oxford 3000 ({duplicateInfo.oxfordLevel}) listesinde hazır olarak bulunmaktadır.
                </p>
                <p className="text-[11px] text-[#687080]">
                  Hazır Oxford kartını doğrudan setine ekleyebilirsin.
                </p>
              </div>

              {card && (
                <div className="p-3.5 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#1E2430]">{card.word}</span>
                    <div className="flex items-center gap-1.5">
                      {card.level && <CEFRBadge level={card.level} size="sm" />}
                      <span className="text-[11px] text-[#687080]">{card.partOfSpeech}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#687080]">Anlam: <span className="font-bold text-[#1E2430]">{card.turkishMeaning}</span></p>
                </div>
              )}
            </div>
          )}

          {/* Situation 4: Inflected Form detected */}
          {duplicateInfo.type === 'INFLECTED_FORM' && duplicateInfo.lemmaSuggestion && (
            <div className="p-3.5 bg-[#FBF1DE]/60 rounded-xl border border-[#E7C98F] text-xs text-[#8A5A18] space-y-1">
              <p className="font-bold">Çekimli Kelime Tespiti:</p>
              <p className="text-[11px]">{duplicateInfo.lemmaSuggestion.explanation}</p>
              <p className="text-[11px] text-[#8A5A18]">
                Kalıcı hafıza için genellikle kök formu (<b>{duplicateInfo.lemmaSuggestion.baseForm}</b>) kartlaştırmak önerilir.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-[#EFECE6] flex flex-col gap-2">
            {duplicateInfo.type === 'INFLECTED_FORM' && duplicateInfo.lemmaSuggestion && onUseBaseForm && (
              <button
                onClick={() => onUseBaseForm(duplicateInfo.lemmaSuggestion!.baseForm)}
                className="w-full py-2 px-3 bg-[#4F46A5] hover:bg-[#433B91] text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Kök Biçimini ("{duplicateInfo.lemmaSuggestion.baseForm}") Ekle</span>
              </button>
            )}

            {(duplicateInfo.type === 'EXACT_IN_OTHER_COLLECTION' || duplicateInfo.type === 'EXACT_IN_OXFORD') && onAddExistingToCollection && (
              <button
                onClick={onAddExistingToCollection}
                className="w-full py-2 px-3 bg-[#4F46A5] hover:bg-[#433B91] text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
                className="w-full py-2 px-3 bg-[#1E2430] hover:bg-[#2B3342] text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Mevcut Kartı Görüntüle</span>
              </button>
            )}

            {onForceCreateNew && (
              <button
                onClick={onForceCreateNew}
                className="w-full py-2 px-3 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-[#1E2430] text-xs font-semibold rounded-xl border border-[#E4E1D9] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Farklı Anlam / Yeni Kart Olarak Oluştur</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full py-1.5 text-xs font-semibold text-[#8E95A2] hover:text-[#1E2430] transition-colors text-center cursor-pointer"
            >
              Vazgeç
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
