import React, { useState } from 'react';
import { Collection, WordCard } from '../types';
import { Check, X } from 'lucide-react';
import { CEFRBadge } from './ui/CEFRBadge';
import { shouldShowCefr } from '../types/oxford';
import { useModalA11y } from '../hooks/useModalA11y';
import { RealmsIcon } from './ui/RealmsIcon';

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
  if (!isOpen || !wordCard) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="anlora-add-collection-title"
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[var(--text-primary)]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain">
      <div
        className="bg-[var(--surface)] rounded-2xl max-w-md w-full border border-[var(--border)] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--surface)] border-b border-[var(--border-light)] p-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[var(--primary-soft)] rounded-xl text-[var(--primary)]">
              <RealmsIcon name="bookmark" size={20} />
            </div>
            <div>
              <h3 id="anlora-add-collection-title" className="text-sm font-bold text-[var(--text-primary)]">Kelimelerime Ekle</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                "{wordCard.word}" kelimesini bir sete ekle
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
          {/* Card Preview Pill */}
          <div className="p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)] flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-[var(--text-primary)]">{wordCard.word}</span>
              {wordCard.phonetic && (
                <span className="text-xs text-[var(--text-secondary)] font-mono ml-2">{wordCard.phonetic}</span>
              )}
              <p className="text-xs text-[var(--text-secondary)]">{wordCard.turkishMeaning}</p>
            </div>
            {/* Seviye yalnızca Oxford kaynaklıysa gösterilir; kişisel karta
                uydurma bir CEFR yazmak yanlış bilgi verir. */}
            {shouldShowCefr(wordCard) && <CEFRBadge level={wordCard.level!} size="sm" />}
          </div>

          {/* Optional Context Inputs */}
          <div className="space-y-2 p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
            <span className="text-[10px] font-bold text-[var(--text-muted)]  tracking-wider block">
              İsteğe Bağlı Bağlam Notu
            </span>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Kaynak (örn: Dizi, Makale...)"
              className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
            />
            <input
              type="text"
              value={sourceContext}
              onChange={(e) => setSourceContext(e.target.value)}
              placeholder="Cümle (örn: She was reluctant to go...)"
              className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)] italic text-[var(--text-primary)]"
            />
          </div>

          {/* Collections List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-secondary)]  tracking-wider">
                Kelime Setlerin ({collections.length})
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingNew(!isCreatingNew)}
                className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RealmsIcon name="add" size={18} />
                <span>{isCreatingNew ? 'Listeyi Gör' : 'Yeni Set'}</span>
              </button>
            </div>

            {isCreatingNew ? (
              <form onSubmit={handleCreateNew} className="p-3 bg-[var(--primary-soft)]/50 rounded-xl border border-[var(--primary-border)] space-y-2">
                <input
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="Set Adı (örn: YDS Kelimeleri)"
                  required
                  className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--primary-border)] rounded-lg focus:outline-none font-bold text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  placeholder="Açıklama (isteğe bağlı)"
                  className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--primary-border)] rounded-lg focus:outline-none text-[var(--text-primary)]"
                />
                <button
                  type="submit"
                  className="dugme-birincil w-full py-2 bg-[var(--primary)] text-[var(--on-primary)] rounded-lg font-bold text-xs hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
                >
                  Oluştur ve Ekle
                </button>
              </form>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {collections.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[var(--text-muted)]">
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
                            ? 'bg-[var(--learned-soft)] border-[var(--learned-border)] text-[var(--learned-text)]'
                            : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--bg)] text-[var(--text-primary)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isMember ? 'bg-[var(--learned)] text-[var(--surface)]' : 'bg-[var(--surface-soft)] text-[var(--text-secondary)]'}`}>
                            <RealmsIcon name="sets" size={18} />
                          </div>
                          <div className="truncate">
                            <h4 className="text-xs font-bold truncate">{col.name}</h4>
                            {col.description && (
                              <p className="text-[11px] text-[var(--text-secondary)] truncate">{col.description}</p>
                            )}
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isMember ? 'bg-[var(--learned)] text-[var(--surface)]' : 'border border-[var(--border)]'}`}>
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
              className="w-full py-2 bg-[var(--bg)] hover:bg-[var(--surface-soft)] text-[var(--text-primary)] font-semibold text-xs rounded-xl border border-[var(--border)] transition-colors cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
