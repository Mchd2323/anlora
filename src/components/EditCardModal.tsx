import React, { useState } from 'react';
import { WordCard, Level, ExampleSentence } from '../types';
import { X, Save, Edit3, Plus, Trash2, BookOpen } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

interface EditCardModalProps {
  card: WordCard;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCard: WordCard) => void;
  onDelete?: (id: string) => void;
}

export const EditCardModal: React.FC<EditCardModalProps> = ({
  card,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const modalRef = useModalA11y(isOpen, onClose);

  const [word, setWord] = useState(card.word);
  const [partOfSpeech, setPartOfSpeech] = useState(card.partOfSpeech);
  const [turkishMeaning, setTurkishMeaning] = useState(card.turkishMeaning);
  const [phonetic, setPhonetic] = useState(card.phonetic || '');
  /*
   * SEVİYE İSTEĞE BAĞLI.
   *
   * Burada varsayılan 'B2' idi: seviyesi olmayan bir kartı düzenleyip
   * kaydeden kullanıcı, farkında olmadan karta B2 yazıyordu. Kullanıcının
   * kendi kelimesinin ölçülmüş bir CEFR seviyesi yoktur; boş kalabilmeli.
   */
  const [level, setLevel] = useState<Level | ''>(card.level || '');
  const [customNote, setCustomNote] = useState(card.customNote || '');
  const [examples, setExamples] = useState<ExampleSentence[]>(
    card.examples && card.examples.length > 0
      ? card.examples.map(ex => ({ ...ex }))
      : [
          { en: '', tr: '' },
          { en: '', tr: '' }
        ]
  );

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

  const handleExampleChange = (index: number, field: 'en' | 'tr', value: string) => {
    const updated = [...examples];
    updated[index] = { ...updated[index], [field]: value };
    setExamples(updated);
  };

  const handleAddExample = () => {
    setExamples([...examples, { en: '', tr: '' }]);
  };

  const handleRemoveExample = (index: number) => {
    if (examples.length <= 1) return;
    setExamples(examples.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !turkishMeaning.trim()) {
      alert('Lütfen kelime adını ve Türkçe anlamını doldurunuz.');
      return;
    }

    const updatedCard: WordCard = {
      ...card,
      word: word.trim(),
      partOfSpeech: partOfSpeech.trim() || 'n.',
      turkishMeaning: turkishMeaning.trim(),
      phonetic: phonetic.trim() || undefined,
      // Boş seçim seviyeyi HİÇ yazmaz; uydurulmuş bir değer kalmasın.
      level: level || undefined,
      customNote: customNote.trim() || undefined,
      examples: examples.filter(ex => ex.en.trim() || ex.tr.trim()),
    };

    onSave(updatedCard);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="anlora-edit-card-title"
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[var(--text-primary)]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain">
      <div
        className="bg-[var(--surface)] rounded-2xl max-w-lg w-full border border-[var(--border)] shadow-xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[var(--surface)] border-b border-[var(--border-light)] p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[var(--primary-soft)] rounded-xl text-[var(--primary)]">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="anlora-edit-card-title" className="text-sm font-bold text-[var(--text-primary)]">Kelime Kartını Düzenle</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Kartın anlam ve örneklerini güncelle
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--surface-soft)] rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {/* Word & Level */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">
                İngilizce Kelime <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] font-bold text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">
                Seviye
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as Level | '')}
                className="w-full px-2.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] font-bold text-[var(--text-primary)]"
              >
                <option value="">Belirtilmedi</option>
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
                <option value="C2">C2</option>
              </select>
            </div>
          </div>

          {/* Part of Speech & Phonetic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">
                Kelime Türü
              </label>
              <input
                type="text"
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                placeholder="Örn: n., v., adj., adv."
                className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">
                Okunuş (IPA)
              </label>
              <input
                type="text"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                placeholder="Örn: /ˈæp.əl/"
                className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] font-mono text-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Turkish Meaning */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">
              Türkçe Anlamı <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={turkishMeaning}
              onChange={(e) => setTurkishMeaning(e.target.value)}
              required
              placeholder="Örn: elma, incelemek"
              className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] font-bold text-[var(--text-primary)]"
            />
          </div>

          {/* Custom Note */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">
              Kaynak / Not
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Örn: Dizi repliği, Kitap notu..."
              className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
            />
          </div>

          {/* Examples Section */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[var(--primary)]" />
                Örnek Cümleler
              </label>
              <button
                type="button"
                onClick={handleAddExample}
                className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Cümle Ekle
              </button>
            </div>

            <div className="space-y-2">
              {examples.map((ex, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)]">
                    <span>Örnek {idx + 1}</span>
                    {examples.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveExample(idx)}
                        className="text-[var(--danger)] hover:underline p-0.5 cursor-pointer"
                      >
                        Sil
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={ex.en}
                    onChange={(e) => handleExampleChange(idx, 'en', e.target.value)}
                    placeholder="İngilizce Cümle"
                    className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none text-[var(--text-primary)]"
                  />
                  <input
                    type="text"
                    value={ex.tr}
                    onChange={(e) => handleExampleChange(idx, 'tr', e.target.value)}
                    placeholder="Türkçe Çevirisi"
                    className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none italic text-[var(--text-primary)]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-[var(--border-light)]">
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`"${card.word}" kelime kartını silmek istediğinize emin misiniz?`)) {
                    onDelete(card.id);
                    onClose();
                  }
                }}
                className="px-3.5 py-2 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded-xl border border-[var(--danger-border)] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kartı Sil</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] rounded-xl transition-colors cursor-pointer"
              >
                Vazgeç
              </button>

              <button
                type="submit"
                className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Kaydet</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
