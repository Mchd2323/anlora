import React, { useState } from 'react';
import { Collection, WordCard } from '../types';
import { BookmarkPlus, Plus, Check, X, Layers, FolderPlus } from 'lucide-react';
import { CEFRBadge } from './ui/CEFRBadge';
import { shouldShowCefr } from '../types/oxford';
import { useModalA11y } from '../hooks/useModalA11y';

interface AddToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  wordCard: WordCard | null;
  collections: Collection[];
  existingCollectionIds: string[];
  onToggleCollectionMembership: (collectionId: string, sourceContext?: string, sourceName?: string) => void;
  onCreateCollectionAndAdd: (name: string, description?: string) => void;
}

export const AddToCollectionModal: React.FC<AddToCollectionModalProps> = ({
  isOpen,
  onClose,
  wordCard,
  collections,
  existingCollectionIds,
  onToggleCollectionMembership,
  onCreateCollectionAndAdd
}) => {
  if (!isOpen || !wordCard) return null;

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [sourceContext, setSourceContext] = useState('');
  const [sourceName, setSourceName] = useState('');

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    onCreateCollectionAndAdd(newDeckName.trim(), newDeckDesc.trim() || undefined);
    setNewDeckName('');
    setNewDeckDesc('');
    setIsCreatingNew(false);
  };

  const modalRef = useModalA11y(isOpen, onClose);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="anlora-add-collection-title"
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[#1E2430]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain">
      <div
        className="bg-[#FFFFFF] rounded-2xl my-auto max-w-md w-full border border-[#E4E1D9] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FFFFFF] border-b border-[#EFECE6] p-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EEECFA] rounded-xl text-[#4F46A5]">
              <BookmarkPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 id="anlora-add-collection-title" className="text-sm font-bold text-[#1E2430]">Kelimelerime Ekle</h3>
              <p className="text-xs text-[#687080]">
                "{wordCard.word}" kelimesini bir sete ekle
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
          {/* Card Preview Pill */}
          <div className="p-3 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9] flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-[#1E2430]">{wordCard.word}</span>
              {wordCard.phonetic && (
                <span className="text-xs text-[#687080] font-mono ml-2">{wordCard.phonetic}</span>
              )}
              <p className="text-xs text-[#687080]">{wordCard.turkishMeaning}</p>
            </div>
            {/* Seviye yalnızca Oxford kaynaklıysa gösterilir; kişisel karta
                uydurma bir CEFR yazmak yanlış bilgi verir. */}
            {shouldShowCefr(wordCard) && <CEFRBadge level={wordCard.level!} size="sm" />}
          </div>

          {/* Optional Context Inputs */}
          <div className="space-y-2 p-3 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9]">
            <span className="text-[10px] font-bold text-[#8E95A2] uppercase tracking-wider block">
              İsteğe Bağlı Bağlam Notu
            </span>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Kaynak (örn: Dizi, Makale...)"
              className="w-full px-3 py-1.5 text-xs bg-[#FFFFFF] border border-[#E4E1D9] rounded-lg focus:outline-none focus:border-[#4F46A5] text-[#1E2430]"
            />
            <input
              type="text"
              value={sourceContext}
              onChange={(e) => setSourceContext(e.target.value)}
              placeholder="Cümle (örn: She was reluctant to go...)"
              className="w-full px-3 py-1.5 text-xs bg-[#FFFFFF] border border-[#E4E1D9] rounded-lg focus:outline-none focus:border-[#4F46A5] italic text-[#1E2430]"
            />
          </div>

          {/* Collections List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#687080] uppercase tracking-wider">
                Kelime Setlerin ({collections.length})
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingNew(!isCreatingNew)}
                className="text-xs font-bold text-[#4F46A5] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{isCreatingNew ? 'Listeyi Gör' : 'Yeni Set'}</span>
              </button>
            </div>

            {isCreatingNew ? (
              <form onSubmit={handleCreateNew} className="p-3 bg-[#EEECFA]/50 rounded-xl border border-[#D7D2F4] space-y-2">
                <input
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="Set Adı (örn: YDS Kelimeleri)"
                  required
                  className="w-full px-3 py-1.5 text-xs bg-[#FFFFFF] border border-[#D7D2F4] rounded-lg focus:outline-none font-bold text-[#1E2430]"
                />
                <input
                  type="text"
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  placeholder="Açıklama (isteğe bağlı)"
                  className="w-full px-3 py-1.5 text-xs bg-[#FFFFFF] border border-[#D7D2F4] rounded-lg focus:outline-none text-[#1E2430]"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-[#4F46A5] text-white rounded-lg font-bold text-xs hover:bg-[#433B91] transition-colors cursor-pointer"
                >
                  Oluştur ve Ekle
                </button>
              </form>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {collections.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#8E95A2]">
                    Henüz kelime seti oluşturmadın. Yukarıdan yeni bir tane ekle!
                  </div>
                ) : (
                  collections.map((col) => {
                    const isMember = existingCollectionIds.includes(col.id);
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => onToggleCollectionMembership(col.id, sourceContext, sourceName)}
                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isMember
                            ? 'bg-[#E9F3ED] border-[#BFD7C8] text-[#35654E]'
                            : 'bg-[#FFFFFF] border-[#E4E1D9] hover:bg-[#F8F7F3] text-[#1E2430]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isMember ? 'bg-[#4F806A] text-white' : 'bg-[#F1EFE8] text-[#687080]'}`}>
                            <Layers className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <h4 className="text-xs font-bold truncate">{col.name}</h4>
                            {col.description && (
                              <p className="text-[11px] text-[#687080] truncate">{col.description}</p>
                            )}
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isMember ? 'bg-[#4F806A] text-white' : 'border border-[#E4E1D9]'}`}>
                          {isMember && <Check className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2 bg-[#F8F7F3] hover:bg-[#F1EFE8] text-[#1E2430] font-semibold text-xs rounded-xl border border-[#E4E1D9] transition-colors cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
