import React, { useState, useEffect } from 'react';
import { Collection, WordCard, LearningState, MinedWordItem } from '../types';
import { FileText, Sparkles, Filter, CheckCircle2, BookmarkPlus, X, Loader2, ArrowRight } from 'lucide-react';
import { mineVocabularyFromText } from '../utils/textMiner';
import { CEFRBadge } from './ui/CEFRBadge';
import { useModalA11y } from '../hooks/useModalA11y';

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
  const modalRef = useModalA11y(isOpen, onClose);

  const [rawText, setRawText] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState(collections[0]?.id || '');
  const [minedResults, setMinedResults] = useState<ReturnType<typeof mineVocabularyFromText> | null>(null);
  const [selectedWords, setSelectedWords] = useState<Record<string, boolean>>({});
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'NEW' | 'OXFORD_AVAILABLE'>('ALL');
  const [isProcessing, setIsProcessing] = useState(false);

  /*
   * HEDEF SET LİSTEYLE BİRLİKTE GÜNCELLENİYOR.
   *
   * Seçili set kimliği yalnızca ilk kurulumda belirleniyordu. Kullanıcı
   * uygulamayı hiç seti yokken açıp sonra set oluşturduysa kimlik boş
   * kalıyor, "Ekle" düğmesi hiçbir şey yapmadan kapanıyordu — hata da yoktu.
   * Aynı koşul silinen setin kimliğini de temizler.
   */
  useEffect(() => {
    if (!collections.some(c => c.id === selectedCollectionId)) {
      setSelectedCollectionId(collections[0]?.id || '');
    }
  }, [collections, selectedCollectionId]);

  /*
   * Erken çıkış, TÜM hook çağrılarından SONRA gelmelidir.
   *
   * Önceki sürümde `if (!isOpen) return null` hook'lardan önceydi: modal
   * kapalıyken bileşen sıfır hook ile, açıldığında ise altı hook ile
   * render ediliyordu. React bunu "önceki render'dan daha fazla hook"
   * olarak görüp bileşeni düşürüyordu (minified React error #310) ve
   * kullanıcı hata ekranına çarpıyordu. Hook sayısı her render'da aynı
   * kalmalı; koşullu olan yalnızca çıktı olabilir.
   */
  if (!isOpen) return null;

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="anlora-text-miner-title"
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[var(--text-primary)]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain">
      <div
        className="bg-[var(--surface)] rounded-2xl max-w-2xl w-full border border-[var(--border)] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--surface)] border-b border-[var(--border-light)] p-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[var(--primary-soft)] text-[var(--primary)] rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 id="anlora-text-miner-title" className="text-sm font-bold text-[var(--text-primary)]">Metinden Kelime Ayıkla (Text Miner)</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Bir metin yapıştır; bilmediğin kelimeleri otomatik ayıklayıp setine ekle.
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

        <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
          {!minedResults ? (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">
                  İngilizce Metin:
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="İngilizce paragraf, altyazı veya makale metnini buraya yapıştır..."
                  rows={8}
                  className="w-full p-3 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] leading-relaxed text-[var(--text-primary)]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleMine}
                  disabled={!rawText.trim()}
                  className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-[var(--surface)] text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
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
                <div className="p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-secondary)] font-bold block">TOPLAM</span>
                  <span className="text-base font-bold text-[var(--text-primary)]">{minedResults.totalExtracted}</span>
                </div>
                <div className="p-2.5 bg-[var(--learned-soft)] rounded-xl border border-[var(--learned-border)]">
                  <span className="text-[10px] text-[var(--learned-text)] font-bold block">YENİ</span>
                  <span className="text-base font-bold text-[var(--learned-text)]">{minedResults.newCandidateCount}</span>
                </div>
                <div className="p-2.5 bg-[var(--primary-soft)] rounded-xl border border-[var(--primary-border)]">
                  <span className="text-[10px] text-[var(--primary)] font-bold block">OXFORD</span>
                  <span className="text-base font-bold text-[var(--primary)]">{minedResults.oxfordCount}</span>
                </div>
                <div className="p-2.5 bg-[var(--learning-soft)] rounded-xl border border-[var(--learning-border)]">
                  <span className="text-[10px] text-[var(--learning-text)] font-bold block">BİLİNEN</span>
                  <span className="text-base font-bold text-[var(--learning-text)]">{minedResults.knownCount}</span>
                </div>
              </div>

              {/* Filter Tabs & Destination Collection */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-1 bg-[var(--surface-soft)] p-1 rounded-xl">
                  <button
                    onClick={() => setFilterStatus('ALL')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${filterStatus === 'ALL' ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-secondary)]'}`}
                  >
                    Tümü ({minedResults.items.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('NEW')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${filterStatus === 'NEW' ? 'bg-[var(--surface)] text-[var(--learned-text)] shadow-xs' : 'text-[var(--text-secondary)]'}`}
                  >
                    Yeni ({minedResults.newCandidateCount})
                  </button>
                  <button
                    onClick={() => setFilterStatus('OXFORD_AVAILABLE')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${filterStatus === 'OXFORD_AVAILABLE' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-secondary)]'}`}
                  >
                    Oxford ({minedResults.oxfordCount})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]">Hedef Set:</span>
                  <select
                    value={selectedCollectionId}
                    onChange={(e) => setSelectedCollectionId(e.target.value)}
                    className="text-xs font-semibold bg-[var(--surface)] border border-[var(--border)] rounded-xl px-2.5 py-1 focus:outline-none text-[var(--text-primary)]"
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
                          ? 'bg-[var(--primary-soft)]/40 border-[var(--primary-border)]'
                          : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 rounded text-[var(--primary)] accent-[var(--primary)]"
                        />
                        <div>
                          <span className="text-xs font-bold text-[var(--text-primary)]">{item.rawWord}</span>
                          {item.lemma !== item.rawWord && (
                            <span className="text-[11px] text-[var(--text-muted)] ml-1.5">(kök: {item.lemma})</span>
                          )}
                          {item.suggestedMeaning && (
                            <span className="text-xs text-[var(--text-secondary)] ml-2 italic">
                              — {item.suggestedMeaning}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {item.count}x
                        </span>
                        {item.status === 'NEW' && (
                          <span className="text-[10px] font-bold bg-[var(--learned-soft)] text-[var(--learned-text)] px-2 py-0.5 rounded-md border border-[var(--learned-border)]">
                            Yeni
                          </span>
                        )}
                        {item.status === 'OXFORD_AVAILABLE' && (
                          <span className="text-[10px] font-bold bg-[var(--primary-soft)] text-[var(--primary)] px-2 py-0.5 rounded-md border border-[var(--primary-border)]">
                            Oxford {item.level}
                          </span>
                        )}
                        {item.status === 'KNOWN' && (
                          <span className="text-[10px] font-bold bg-[var(--bg)] text-[var(--text-secondary)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                            Öğrenildi
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-light)]">
                <button
                  type="button"
                  onClick={() => setMinedResults(null)}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold cursor-pointer"
                >
                  ← Metni Değiştir
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] rounded-xl cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isProcessing || Object.values(selectedWords).filter(Boolean).length === 0}
                    className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-[var(--surface)] text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
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
