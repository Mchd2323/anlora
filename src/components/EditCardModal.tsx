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
  const [level, setLevel] = useState<Level>(card.level || 'B2');
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
      level: level,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2430]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div
        className="bg-[#FFFFFF] rounded-2xl max-w-lg w-full border border-[#E4E1D9] shadow-xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#FFFFFF] border-b border-[#EFECE6] p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EEECFA] rounded-xl text-[#4F46A5]">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="anlora-edit-card-title" className="text-sm font-bold text-[#1E2430]">Kelime Kartını Düzenle</h3>
              <p className="text-xs text-[#687080]">
                Kartın anlam ve örneklerini güncelle
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#F1EFE8] rounded-lg transition-colors text-[#8E95A2] hover:text-[#1E2430] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {/* Word & Level */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                İngilizce Kelime <span className="text-[#C65D55]">*</span>
              </label>
              <input
                type="text"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-bold text-[#1E2430]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                Seviye
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
                className="w-full px-2.5 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-bold text-[#1E2430]"
              >
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
              </select>
            </div>
          </div>

          {/* Part of Speech & Phonetic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                Kelime Türü
              </label>
              <input
                type="text"
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                placeholder="Örn: n., v., adj., adv."
                className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] text-[#1E2430]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                Okunuş (IPA)
              </label>
              <input
                type="text"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                placeholder="Örn: /ˈæp.əl/"
                className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-mono text-[#1E2430]"
              />
            </div>
          </div>

          {/* Turkish Meaning */}
          <div>
            <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
              Türkçe Anlamı <span className="text-[#C65D55]">*</span>
            </label>
            <input
              type="text"
              value={turkishMeaning}
              onChange={(e) => setTurkishMeaning(e.target.value)}
              required
              placeholder="Örn: elma, incelemek"
              className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-bold text-[#1E2430]"
            />
          </div>

          {/* Custom Note */}
          <div>
            <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
              Kaynak / Not
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Örn: Dizi repliği, Kitap notu..."
              className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] text-[#1E2430]"
            />
          </div>

          {/* Examples Section */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#1E2430] flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#4F46A5]" />
                Örnek Cümleler
              </label>
              <button
                type="button"
                onClick={handleAddExample}
                className="text-xs font-semibold text-[#4F46A5] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Cümle Ekle
              </button>
            </div>

            <div className="space-y-2">
              {examples.map((ex, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#687080]">
                    <span>Örnek {idx + 1}</span>
                    {examples.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveExample(idx)}
                        className="text-[#C65D55] hover:underline p-0.5 cursor-pointer"
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
                    className="w-full px-3 py-1.5 text-xs bg-[#FFFFFF] border border-[#E4E1D9] rounded-lg focus:outline-none text-[#1E2430]"
                  />
                  <input
                    type="text"
                    value={ex.tr}
                    onChange={(e) => handleExampleChange(idx, 'tr', e.target.value)}
                    placeholder="Türkçe Çevirisi"
                    className="w-full px-3 py-1.5 text-xs bg-[#FFFFFF] border border-[#E4E1D9] rounded-lg focus:outline-none italic text-[#1E2430]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-[#EFECE6]">
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`"${card.word}" kelime kartını silmek istediğinize emin misiniz?`)) {
                    onDelete(card.id);
                    onClose();
                  }
                }}
                className="px-3.5 py-2 text-xs font-semibold text-[#C65D55] hover:bg-[#FAECEA] rounded-xl border border-[#F0CBC7] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kartı Sil</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#687080] hover:bg-[#F1EFE8] rounded-xl transition-colors cursor-pointer"
              >
                Vazgeç
              </button>

              <button
                type="submit"
                className="px-5 py-2 bg-[#4F46A5] hover:bg-[#433B91] text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
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
