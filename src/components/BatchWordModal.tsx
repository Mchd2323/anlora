import React, { useState } from 'react';
import { Collection, WordCard, CollectionMembership } from '../types';
import { Layers, Sparkles, ArrowRight, X, Loader2 } from 'lucide-react';
import { normalizeWordString } from '../utils/lemmatizer';
import { detectWordDuplicate } from '../utils/duplicateDetector';
import { useModalA11y } from '../hooks/useModalA11y';
import { apiUrl } from '../config/api';
import { useRemoteApi } from '../hooks/useRemoteApi';

interface BatchWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCollection: Collection | null;
  collections: Collection[];
  /*
   * Tekrar denetimi için gerçek üyelik listesi.
   *
   * Buraya boş dizi geçiliyordu: "zaten bu sette var" ölçütü hiçbir zaman
   * doğru çıkmıyor, aynı kelime için ikinci bir kart yaratılıyordu. Sayaç da
   * hep 0 gösterdiği için kullanıcı ne olduğunu göremiyordu.
   */
  memberships: CollectionMembership[];
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
  memberships,
  customWords,
  oxfordWords,
  onBatchProcessComplete,
  onAddCustomWord,
  onLinkWordToCollection
}) => {
  /*
   * Yapay zekâ ulaşılabilir mi? Sunucusuz kurulumda eşleşmeyen her kelime
   * için boşuna istek çıkarmamak, doğrudan elle doldurulacak karta geçmek
   * için bakılıyor.
   */
  const yapayZekaVar = useRemoteApi() === true;

  const modalRef = useModalA11y(isOpen, onClose);

  const [rawInput, setRawInput] = useState('');
  const [analyzedList, setAnalyzedList] = useState<AnalyzedToken[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [progressMsg, setProgressMsg] = useState('');

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
        memberships,
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
          if (!yapayZekaVar) throw new Error('yapay-zeka-yok');
          const res = await fetch(apiUrl('/api/ai/generate-word'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: item.raw })
          });
          /*
           * Hata kodu sessizce yutulmasın. Önceki hâlde `res.ok` false ise
           * hiçbir dal çalışmıyordu: kelime ne ekleniyor ne de kullanıcıya
           * söyleniyordu, listeden düşüp gidiyordu. Şimdi aşağıdaki catch'e
           * düşüyor ve "elle doldurulacak boş kart" olarak ekleniyor.
           */
          if (!res.ok) throw new Error('yapay-zeka-basarisiz');

          {
            const cardData = await res.json();
            const newCard: WordCard = {
              id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              word: cardData.word || item.raw,
              // Sözcük türü de uydurulmaz; verilmediyse boş kalır.
              partOfSpeech: cardData.partOfSpeech || '',
              /*
               * ANLAM UYDURULMAZ. Burada `|| item.raw` vardı: yapay zekâ
               * Türkçe anlam vermediğinde İngilizce kelimenin kendisi Türkçe
               * anlamı olarak yazılıyordu ("apple → apple"). Yanlış veri,
               * eksik veriden kötüdür; alan boş kalır, kullanıcı doldurur.
               */
              turkishMeaning: cardData.turkishMeaning || '',
              phonetic: cardData.phonetic || '',
              examples: cardData.examples || [],
              // Yapay zekâ seviye vermediyse UYDURULMAZ; alan boş kalır ve
              // arayüz rozeti kendiliğinden gizler.
              level: cardData.level || undefined,
              isCustom: true,
              dateAdded: new Date().toISOString().slice(0, 10),
              isAiGenerated: true
            };
            onAddCustomWord(newCard, targetCollection.id);
            addedCount++;
          }
        } catch {
          /*
           * Yapay zekâya ulaşılamadı — sözlükte de bulunmayan bu kelime için
           * elimizde hiçbir bilgi yok.
           *
           * ÖNCEKİ DAVRANIŞ VERİ UYDURUYORDU: Türkçe anlam alanına İngilizce
           * kelimenin kendisi ("thrive" → "thrive"), seviyeye de sabit 'B1'
           * yazılıyordu. İkisi de yanlıştı ve yanlış oldukları belli
           * olmuyordu: kullanıcı setinde B1 rozetli, anlamı kendisi olan
           * kartlar görüyor ve bunları doğru sanıyordu. Sunucusuz kurulumda
           * her eşleşmeyen kelime bu yoldan geçtiği için 40 kelimelik bir
           * yüklemeden 40 uydurma kart çıkabilirdi.
           *
           * Artık boş bırakılıyor: seviye verilmez (rozet kendiliğinden
           * gizlenir), anlam alanı boş kalır ve kullanıcı kartı açtığında
           * doldurulacak yeri görür. Bilinmeyeni boş bırakmak, yanlış
           * doldurmaktan iyidir.
           */
          const elleDoldurulacak: WordCard = {
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            word: item.raw,
            partOfSpeech: '',
            turkishMeaning: '',
            examples: [],
            isCustom: true,
            dateAdded: new Date().toISOString().slice(0, 10)
          };
          onAddCustomWord(elleDoldurulacak, targetCollection.id);
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
      className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[var(--text-primary)]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain">
      <div
        className="bg-[var(--surface)] rounded-2xl max-w-2xl w-full border border-[var(--border)] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--surface)] border-b border-[var(--border-light)] p-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[var(--primary-soft)] text-[var(--primary)] rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 id="anlora-batch-word-title" className="text-sm font-bold text-[var(--text-primary)]">Toplu Kelime Ekle</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Hedef Set: <span className="font-bold text-[var(--text-primary)]">{targetCollection?.name}</span>
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
          {step === 'input' ? (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">
                  Kelimeleri Yapıştır (Her satıra bir kelime veya virgülle ayrılmış)
                </label>
                <textarea
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder={`reluctant\nscrutinize\nperceive\nflabbergasted\n...`}
                  rows={8}
                  className="w-full p-3 text-xs font-mono bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
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
                  onClick={handleAnalyze}
                  disabled={!rawInput.trim() || isAnalyzing}
                  className="dugme-birincil px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-[var(--surface)] text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Kelimeleri İncele ve Denetle</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--text-primary)]">
                  Toplam {analyzedList.length} kelime incelendi:
                </span>
                <button
                  onClick={() => setStep('input')}
                  className="text-xs text-[var(--primary)] font-semibold hover:underline cursor-pointer"
                >
                  ← Listeyi Düzenle
                </button>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-[var(--learned-soft)] rounded-xl border border-[var(--learned-border)] text-center">
                  <span className="text-[10px] text-[var(--learned-text)] font-bold block">YENİ KART</span>
                  <span className="text-base font-bold text-[var(--learned-text)]">
                    {analyzedList.filter(i => i.status === 'NEW').length}
                  </span>
                </div>
                <div className="p-2.5 bg-[var(--primary-soft)] rounded-xl border border-[var(--primary-border)] text-center">
                  <span className="text-[10px] text-[var(--primary)] font-bold block">HAZIR KART</span>
                  <span className="text-base font-bold text-[var(--primary)]">
                    {analyzedList.filter(i => i.status === 'EXACT_IN_OXFORD' || i.status === 'EXACT_IN_OTHER_COLLECTION').length}
                  </span>
                </div>
                <div className="p-2.5 bg-[var(--learning-soft)] rounded-xl border border-[var(--learning-border)] text-center">
                  <span className="text-[10px] text-[var(--learning-text)] font-bold block">ZATEN EKLİ</span>
                  <span className="text-base font-bold text-[var(--learning-text)]">
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
                        ? 'bg-[var(--learning-soft)]/40 border-[var(--learning-border)] opacity-60'
                        : item.selected
                        ? 'bg-[var(--surface)] border-[var(--border)]'
                        : 'bg-[var(--bg)] border-[var(--border)] opacity-50'
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
                        className="w-3.5 h-3.5 rounded text-[var(--primary)] accent-[var(--primary)] cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-[var(--text-primary)]">{item.raw}</span>
                        {item.matchedCard && (
                          <span className="text-[11px] text-[var(--text-secondary)] ml-2">
                            ({item.matchedCard.turkishMeaning})
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      {/*
                        Rozet gerçeği söylüyor: yapay zekâ bu kurulumda kapalıysa
                        kart boş eklenir, "AI kartı" demek yanlış olur.
                      */}
                      {item.status === 'NEW' &&
                        (yapayZekaVar ? (
                          <span className="text-[10px] font-bold bg-[var(--learned-soft)] text-[var(--learned-text)] px-2 py-0.5 rounded-md border border-[var(--learned-border)]">
                            Yeni AI Kartı
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-[var(--bg)] text-[var(--text-secondary)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                            Boş kart · anlamı sen yazacaksın
                          </span>
                        ))}
                      {item.status === 'EXACT_IN_OXFORD' && (
                        <span className="text-[10px] font-bold bg-[var(--primary-soft)] text-[var(--primary)] px-2 py-0.5 rounded-md border border-[var(--primary-border)]">
                          Oxford ({item.matchedCard?.level}) Bağlanacak
                        </span>
                      )}
                      {item.status === 'EXACT_IN_OTHER_COLLECTION' && (
                        <span className="text-[10px] font-bold bg-[var(--bg)] text-[var(--text-secondary)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                          Setlerinden Bağlanacak
                        </span>
                      )}
                      {item.status === 'EXACT_IN_COLLECTION' && (
                        <span className="text-[10px] font-bold bg-[var(--learning-soft)] text-[var(--learning-text)] px-2 py-0.5 rounded-md border border-[var(--learning-border)]">
                          Zaten Bu Sette
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {isProcessing && (
                <div className="p-3 bg-[var(--primary-soft)] rounded-xl text-center space-y-1">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)] mx-auto" />
                  <p className="text-xs font-bold text-[var(--primary)]">{progressMsg}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-light)]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBatch}
                  disabled={isProcessing || analyzedList.filter(i => i.selected).length === 0}
                  className="dugme-birincil px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-[var(--surface)] text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
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
