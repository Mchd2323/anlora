import React, { useState } from 'react';
import { Collection, WordCard, LearningState, MinedWordItem } from '../types';
import { FileText, Sparkles, Filter, CheckCircle2, BookmarkPlus, X, Loader2, ArrowRight } from 'lucide-react';
import { mineVocabularyFromText } from '../utils/textMiner';
import { CEFRBadge } from './ui/CEFRBadge';

interface TextMinerModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  customWords: WordCard[];
  oxfordWords: WordCard[];
  learningStates: Record<string, LearningState>;
  onAddMinedWordsToCollection: (
    selectedItems: MinedWordItem[],
    targetCollectionId: string
  ) => void;
}

export const TextMinerModal: React.FC<TextMinerModalProps> = ({
  isOpen,
  onClose,
  collections,
  customWords,
  oxfordWords,
  learningStates,
  onAddMinedWordsToCollection
}) => {
  if (!isOpen) return null;

  const [rawText, setRawText] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState(collections[0]?.id || '');
  const [minedResults, setMinedResults] = useState<ReturnType<typeof mineVocabularyFromText> | null>(null);
  const [selectedWords, setSelectedWords] = useState<Record<string, boolean>>({});
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'NEW' | 'OXFORD_AVAILABLE'>('ALL');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMine = () => {
    if (!rawText.trim()) return;
    const res = mineVocabularyFromText(rawText, oxfordWords, customWords, learningStates);
    setMinedResults(res);

    const initialSelected: Record<string, boolean> = {};
    res.items.forEach(item => {
      if (item.status === 'NEW' || item.status === 'OXFORD_AVAILABLE') {
        initialSelected[item.rawWord] = true;
      }
    });
    setSelectedWords(initialSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (minedResults) {
      minedResults.items.forEach(item => {
        if (filterStatus === 'ALL' || item.status === filterStatus) {
          updated[item.rawWord] = checked;
        }
      });
    }
    setSelectedWords(updated);
  };

  const handleSave = () => {
    if (!minedResults || !selectedCollectionId) return;
    setIsProcessing(true);
    const selectedItems = minedResults.items.filter(item => selectedWords[item.rawWord]);
    onAddMinedWordsToCollection(selectedItems, selectedCollectionId);
    setIsProcessing(false);
    onClose();
  };

  const filteredItems = minedResults
    ? minedResults.items.filter(item => {
        if (filterStatus === 'ALL') return true;
        return item.status === filterStatus;
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2430]/40 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-[#FFFFFF] rounded-2xl max-w-2xl w-full border border-[#E4E1D9] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FFFFFF] border-b border-[#EFECE6] p-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EEECFA] text-[#4F46A5] rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1E2430]">Metinden Kelime Ayıkla (Text Miner)</h3>
              <p className="text-xs text-[#687080]">
                Bir metin yapıştır; bilmediğin kelimeleri otomatik ayıklayıp setine ekle.
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
          {!minedResults ? (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                  İngilizce Metin:
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="İngilizce paragraf, altyazı veya makale metnini buraya yapıştır..."
                  rows={8}
                  className="w-full p-3 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] leading-relaxed text-[#1E2430]"
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
                  onClick={handleMine}
                  disabled={!rawText.trim()}
                  className="px-4 py-2 bg-[#4F46A5] hover:bg-[#433B91] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Kelimeleri Çıkar ve Analiz Et</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Summary Bar */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9]">
                  <span className="text-[10px] text-[#687080] font-bold block">TOPLAM</span>
                  <span className="text-base font-bold text-[#1E2430]">{minedResults.totalExtracted}</span>
                </div>
                <div className="p-2.5 bg-[#E9F3ED] rounded-xl border border-[#BFD7C8]">
                  <span className="text-[10px] text-[#35654E] font-bold block">YENİ</span>
                  <span className="text-base font-bold text-[#35654E]">{minedResults.newCandidateCount}</span>
                </div>
                <div className="p-2.5 bg-[#EEECFA] rounded-xl border border-[#D7D2F4]">
                  <span className="text-[10px] text-[#4F46A5] font-bold block">OXFORD</span>
                  <span className="text-base font-bold text-[#4F46A5]">{minedResults.oxfordCount}</span>
                </div>
                <div className="p-2.5 bg-[#FBF1DE] rounded-xl border border-[#E7C98F]">
                  <span className="text-[10px] text-[#8A5A18] font-bold block">BİLİNEN</span>
                  <span className="text-base font-bold text-[#8A5A18]">{minedResults.knownCount}</span>
                </div>
              </div>

              {/* Filter Tabs & Destination Collection */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-1 bg-[#F1EFE8] p-1 rounded-xl">
                  <button
                    onClick={() => setFilterStatus('ALL')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${filterStatus === 'ALL' ? 'bg-[#FFFFFF] text-[#1E2430] shadow-xs' : 'text-[#687080]'}`}
                  >
                    Tümü ({minedResults.items.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('NEW')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${filterStatus === 'NEW' ? 'bg-[#FFFFFF] text-[#35654E] shadow-xs' : 'text-[#687080]'}`}
                  >
                    Yeni ({minedResults.newCandidateCount})
                  </button>
                  <button
                    onClick={() => setFilterStatus('OXFORD_AVAILABLE')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${filterStatus === 'OXFORD_AVAILABLE' ? 'bg-[#FFFFFF] text-[#4F46A5] shadow-xs' : 'text-[#687080]'}`}
                  >
                    Oxford ({minedResults.oxfordCount})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#687080]">Hedef Set:</span>
                  <select
                    value={selectedCollectionId}
                    onChange={(e) => setSelectedCollectionId(e.target.value)}
                    className="text-xs font-semibold bg-[#FFFFFF] border border-[#E4E1D9] rounded-xl px-2.5 py-1 focus:outline-none text-[#1E2430]"
                  >
                    {collections.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Word Checkbox Grid */}
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {filteredItems.map((item, idx) => {
                  const isChecked = !!selectedWords[item.rawWord];
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedWords({ ...selectedWords, [item.rawWord]: !isChecked })}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-[#EEECFA]/40 border-[#D7D2F4]'
                          : 'bg-[#FFFFFF] border-[#E4E1D9] hover:bg-[#F8F7F3]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 rounded text-[#4F46A5] accent-[#4F46A5]"
                        />
                        <div>
                          <span className="text-xs font-bold text-[#1E2430]">{item.rawWord}</span>
                          {item.lemma !== item.rawWord && (
                            <span className="text-[11px] text-[#8E95A2] ml-1.5">(kök: {item.lemma})</span>
                          )}
                          {item.suggestedMeaning && (
                            <span className="text-xs text-[#687080] ml-2 italic">
                              — {item.suggestedMeaning}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#8E95A2] font-mono">
                          {item.count}x
                        </span>
                        {item.status === 'NEW' && (
                          <span className="text-[10px] font-bold bg-[#E9F3ED] text-[#35654E] px-2 py-0.5 rounded-md border border-[#BFD7C8]">
                            Yeni
                          </span>
                        )}
                        {item.status === 'OXFORD_AVAILABLE' && (
                          <span className="text-[10px] font-bold bg-[#EEECFA] text-[#4F46A5] px-2 py-0.5 rounded-md border border-[#D7D2F4]">
                            Oxford {item.level}
                          </span>
                        )}
                        {item.status === 'KNOWN' && (
                          <span className="text-[10px] font-bold bg-[#F8F7F3] text-[#687080] px-2 py-0.5 rounded-md border border-[#E4E1D9]">
                            Öğrenildi
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-[#EFECE6]">
                <button
                  type="button"
                  onClick={() => setMinedResults(null)}
                  className="text-xs text-[#687080] hover:text-[#1E2430] font-semibold cursor-pointer"
                >
                  ← Metni Değiştir
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-semibold text-[#687080] hover:bg-[#F1EFE8] rounded-xl cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isProcessing || Object.values(selectedWords).filter(Boolean).length === 0}
                    className="px-4 py-2 bg-[#4F46A5] hover:bg-[#433B91] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>Seçilen {Object.values(selectedWords).filter(Boolean).length} Kelimeyi Ekle</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
