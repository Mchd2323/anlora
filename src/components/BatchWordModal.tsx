import React, { useState } from 'react';
import { Collection, WordCard } from '../types';
import { Layers, Sparkles, ArrowRight, X, Loader2 } from 'lucide-react';
import { normalizeWordString } from '../utils/lemmatizer';
import { detectWordDuplicate } from '../utils/duplicateDetector';
import { useModalA11y } from '../hooks/useModalA11y';

interface BatchWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCollection: Collection | null;
  collections: Collection[];
  customWords: WordCard[];
  oxfordWords: WordCard[];
  onBatchProcessComplete: (results: {
    addedCount: number;
    linkedCount: number;
    skippedCount: number;
  }) => void;
  onAddCustomWord: (card: WordCard, collectionId?: string) => void;
  onLinkWordToCollection: (wordId: string, collectionId: string) => void;
}

interface AnalyzedToken {
  raw: string;
  normalized: string;
  status: 'EXACT_IN_COLLECTION' | 'EXACT_IN_OTHER_COLLECTION' | 'EXACT_IN_OXFORD' | 'NEW';
  matchedCard?: WordCard;
  selected: boolean;
}

export const BatchWordModal: React.FC<BatchWordModalProps> = ({
  isOpen,
  onClose,
  targetCollection,
  collections,
  customWords,
  oxfordWords,
  onBatchProcessComplete,
  onAddCustomWord,
  onLinkWordToCollection
}) => {
  const modalRef = useModalA11y(isOpen, onClose);

  if (!isOpen) return null;

  const [rawInput, setRawInput] = useState('');
  const [analyzedList, setAnalyzedList] = useState<AnalyzedToken[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [progressMsg, setProgressMsg] = useState('');

  const handleAnalyze = () => {
    if (!rawInput.trim()) return;
    setIsAnalyzing(true);

    const tokens = rawInput
      .split(/[\n,;]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const seen = new Set<string>();
    const results: AnalyzedToken[] = [];

    tokens.forEach(raw => {
      const normalized = normalizeWordString(raw);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);

      const check = detectWordDuplicate({
        rawWord: raw,
        targetCollectionId: targetCollection?.id,
        collections,
        memberships: [],
        customWords,
        oxfordWords
      });

      let status: AnalyzedToken['status'] = 'NEW';
      if (check.type === 'EXACT_IN_COLLECTION') status = 'EXACT_IN_COLLECTION';
      else if (check.type === 'EXACT_IN_OTHER_COLLECTION') status = 'EXACT_IN_OTHER_COLLECTION';
      else if (check.type === 'EXACT_IN_OXFORD') status = 'EXACT_IN_OXFORD';

      results.push({
        raw,
        normalized,
        status,
        matchedCard: check.matchedWordCard,
        selected: status !== 'EXACT_IN_COLLECTION'
      });
    });

    setAnalyzedList(results);
    setIsAnalyzing(false);
    setStep('review');
  };

  const handleExecuteBatch = async () => {
    if (!targetCollection) return;
    setIsProcessing(true);
    let addedCount = 0;
    let linkedCount = 0;
    let skippedCount = 0;

    const selectedItems = analyzedList.filter(i => i.selected);

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      setProgressMsg(`İşleniyor (${i + 1}/${selectedItems.length}): ${item.raw}...`);

      if (item.status === 'EXACT_IN_COLLECTION') {
        skippedCount++;
        continue;
      }

      if (item.matchedCard) {
        onLinkWordToCollection(item.matchedCard.id, targetCollection.id);
        linkedCount++;
      } else {
        try {
          const res = await fetch('/api/ai/generate-word', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: item.raw })
          });
          if (res.ok) {
            const cardData = await res.json();
            const newCard: WordCard = {
              id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              word: cardData.word || item.raw,
              partOfSpeech: cardData.partOfSpeech || 'n.',
              turkishMeaning: cardData.turkishMeaning || item.raw,
              phonetic: cardData.phonetic || '',
              examples: cardData.examples || [],
              level: cardData.level || 'B2',
              isCustom: true,
              dateAdded: new Date().toISOString().slice(0, 10),
              isAiGenerated: true
            };
            onAddCustomWord(newCard, targetCollection.id);
            addedCount++;
          }
        } catch {
          const fallbackCard: WordCard = {
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            word: item.raw,
            partOfSpeech: 'n.',
            turkishMeaning: item.raw,
            examples: [],
            level: 'B1',
            isCustom: true,
            dateAdded: new Date().toISOString().slice(0, 10)
          };
          onAddCustomWord(fallbackCard, targetCollection.id);
          addedCount++;
        }
      }
    }

    setIsProcessing(false);
    onBatchProcessComplete({ addedCount, linkedCount, skippedCount });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="anlora-batch-word-title"
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2430]/40 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-[#FFFFFF] rounded-2xl max-w-2xl w-full border border-[#E4E1D9] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FFFFFF] border-b border-[#EFECE6] p-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EEECFA] text-[#4F46A5] rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 id="anlora-batch-word-title" className="text-sm font-bold text-[#1E2430]">Toplu Kelime Ekle</h3>
              <p className="text-xs text-[#687080]">
                Hedef Set: <span className="font-bold text-[#1E2430]">{targetCollection?.name}</span>
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

        <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
          {step === 'input' ? (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                  Kelimeleri Yapıştır (Her satıra bir kelime veya virgülle ayrılmış)
                </label>
                <textarea
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder={`reluctant\nscrutinize\nperceive\nflabbergasted\n...`}
                  rows={8}
                  className="w-full p-3 text-xs font-mono bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] text-[#1E2430]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-semibold text-[#687080] hover:bg-[#F1EFE8] rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!rawInput.trim() || isAnalyzing}
                  className="px-4 py-2 bg-[#4F46A5] hover:bg-[#433B91] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Kelimeleri İncele ve Denetle</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#1E2430]">
                  Toplam {analyzedList.length} kelime incelendi:
                </span>
                <button
                  onClick={() => setStep('input')}
                  className="text-xs text-[#4F46A5] font-semibold hover:underline cursor-pointer"
                >
                  ← Listeyi Düzenle
                </button>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-[#E9F3ED] rounded-xl border border-[#BFD7C8] text-center">
                  <span className="text-[10px] text-[#35654E] font-bold block">YENİ KART</span>
                  <span className="text-base font-bold text-[#35654E]">
                    {analyzedList.filter(i => i.status === 'NEW').length}
                  </span>
                </div>
                <div className="p-2.5 bg-[#EEECFA] rounded-xl border border-[#D7D2F4] text-center">
                  <span className="text-[10px] text-[#4F46A5] font-bold block">HAZIR KART</span>
                  <span className="text-base font-bold text-[#4F46A5]">
                    {analyzedList.filter(i => i.status === 'EXACT_IN_OXFORD' || i.status === 'EXACT_IN_OTHER_COLLECTION').length}
                  </span>
                </div>
                <div className="p-2.5 bg-[#FBF1DE] rounded-xl border border-[#E7C98F] text-center">
                  <span className="text-[10px] text-[#8A5A18] font-bold block">ZATEN EKLİ</span>
                  <span className="text-base font-bold text-[#8A5A18]">
                    {analyzedList.filter(i => i.status === 'EXACT_IN_COLLECTION').length}
                  </span>
                </div>
              </div>

              {/* List */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {analyzedList.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                      item.status === 'EXACT_IN_COLLECTION'
                        ? 'bg-[#FBF1DE]/40 border-[#E7C98F] opacity-60'
                        : item.selected
                        ? 'bg-[#FFFFFF] border-[#E4E1D9]'
                        : 'bg-[#F8F7F3] border-[#E4E1D9] opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        disabled={item.status === 'EXACT_IN_COLLECTION'}
                        onChange={(e) => {
                          const updated = [...analyzedList];
                          updated[idx].selected = e.target.checked;
                          setAnalyzedList(updated);
                        }}
                        className="w-3.5 h-3.5 rounded text-[#4F46A5] accent-[#4F46A5] cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-[#1E2430]">{item.raw}</span>
                        {item.matchedCard && (
                          <span className="text-[11px] text-[#687080] ml-2">
                            ({item.matchedCard.turkishMeaning})
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      {item.status === 'NEW' && (
                        <span className="text-[10px] font-bold bg-[#E9F3ED] text-[#35654E] px-2 py-0.5 rounded-md border border-[#BFD7C8]">
                          Yeni AI Kartı
                        </span>
                      )}
                      {item.status === 'EXACT_IN_OXFORD' && (
                        <span className="text-[10px] font-bold bg-[#EEECFA] text-[#4F46A5] px-2 py-0.5 rounded-md border border-[#D7D2F4]">
                          Oxford ({item.matchedCard?.level}) Bağlanacak
                        </span>
                      )}
                      {item.status === 'EXACT_IN_OTHER_COLLECTION' && (
                        <span className="text-[10px] font-bold bg-[#F8F7F3] text-[#687080] px-2 py-0.5 rounded-md border border-[#E4E1D9]">
                          Setlerinden Bağlanacak
                        </span>
                      )}
                      {item.status === 'EXACT_IN_COLLECTION' && (
                        <span className="text-[10px] font-bold bg-[#FBF1DE] text-[#8A5A18] px-2 py-0.5 rounded-md border border-[#E7C98F]">
                          Zaten Bu Sette
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {isProcessing && (
                <div className="p-3 bg-[#EEECFA] rounded-xl text-center space-y-1">
                  <Loader2 className="w-4 h-4 animate-spin text-[#4F46A5] mx-auto" />
                  <p className="text-xs font-bold text-[#4F46A5]">{progressMsg}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#EFECE6]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-3.5 py-2 text-xs font-semibold text-[#687080] hover:bg-[#F1EFE8] rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBatch}
                  disabled={isProcessing || analyzedList.filter(i => i.selected).length === 0}
                  className="px-4 py-2 bg-[#4F46A5] hover:bg-[#433B91] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <span>{analyzedList.filter(i => i.selected).length} Kelimeyi Sete Aktar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
