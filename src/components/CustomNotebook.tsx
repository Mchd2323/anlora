import React, { useState } from 'react';
import { WordCard } from '../types';
import { WordCardComponent } from './WordCard';
import { EditCardModal } from './EditCardModal';
import {
  Sparkles,
  Plus,
  BookOpen,
  Loader2,
  Info,
  Search,
  CloudCheck,
  Download,
  Upload,
  ArrowUpDown,
} from 'lucide-react';

interface CustomNotebookProps {
  customCards: WordCard[];
  favorites: string[];
  learned: string[];
  onAddCustomCard: (card: WordCard) => void;
  onUpdateCustomCard: (card: WordCard) => void;
  onDeleteCustomCard: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleLearned: (id: string) => void;
}

type SortOption = 'newest' | 'oldest' | 'az' | 'za';

export const CustomNotebook: React.FC<CustomNotebookProps> = ({
  customCards,
  favorites,
  learned,
  onAddCustomCard,
  onUpdateCustomCard,
  onDeleteCustomCard,
  onToggleFavorite,
  onToggleLearned
}) => {
  const [newWordInput, setNewWordInput] = useState('');
  const [contextInput, setContextInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [editingCard, setEditingCard] = useState<WordCard | null>(null);

  const handleGenerateWordCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWordInput.trim()) {
      setErrorMessage('Lütfen bir İngilizce kelime giriniz.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/ai/generate-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: newWordInput.trim(),
          context: contextInput.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Kart oluşturulurken bir hata oluştu.');
      }

      const data = await response.json();

      const newCard: WordCard = {
        id: `custom-${Date.now()}`,
        word: data.word || newWordInput.trim(),
        partOfSpeech: data.partOfSpeech || 'n.',
        turkishMeaning: data.turkishMeaning || 'Anlam belirlendi',
        phonetic: data.phonetic || '',
        examples: data.examples || [],
        level: data.level || 'B2',
        isCustom: true,
        customNote: contextInput.trim() || undefined,
        dateAdded: new Date().toLocaleDateString('tr-TR')
      };

      onAddCustomCard(newCard);
      setNewWordInput('');
      setContextInput('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Yapay zeka ile kelime oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Export custom cards as JSON
  const handleExportJSON = () => {
    if (customCards.length === 0) {
      alert('Yedeklenecek özel kelime bulunmamaktadır.');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(customCards, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ozel-kelime-kartlarim-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import custom cards from JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            let addedCount = 0;
            parsed.forEach((item: any) => {
              if (item.word && item.turkishMeaning) {
                const card: WordCard = {
                  id: item.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  word: item.word,
                  partOfSpeech: item.partOfSpeech || 'n.',
                  turkishMeaning: item.turkishMeaning,
                  phonetic: item.phonetic || '',
                  examples: item.examples || [],
                  level: item.level || 'B2',
                  isCustom: true,
                  customNote: item.customNote || undefined,
                  dateAdded: item.dateAdded || new Date().toLocaleDateString('tr-TR')
                };
                onAddCustomCard(card);
                addedCount++;
              }
            });
            alert(`${addedCount} adet özel kelime kartı başarıyla yüklendi!`);
          } else {
            alert('Geçersiz dosya formatı.');
          }
        } catch {
          alert('JSON dosyası okunamadı veya biçim hatalı.');
        }
      };
    }
  };

  // Search & Filter & Sort
  const processedCards = customCards
    .filter(
      (card) =>
        card.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.turkishMeaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (card.customNote && card.customNote.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'az') return a.word.localeCompare(b.word);
      if (sortBy === 'za') return b.word.localeCompare(a.word);
      if (sortBy === 'oldest') return a.id.localeCompare(b.id);
      return b.id.localeCompare(a.id); // 'newest' default
    });

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-200" /> Kişisel Kelime Kartları
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-300/40 text-emerald-100 text-xs font-bold backdrop-blur-xs">
              <CloudCheck className="w-3.5 h-3.5 text-emerald-200" /> Bulut Depolama Aktif
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black">
            Kendi Çalışmalarınıza Ait Kelime Kartları Oluşturun
          </h2>

          <p className="text-amber-100 text-xs sm:text-sm leading-relaxed">
            Sınavlara veya kitaplara çalışırken karşılaştığınız tüm kelimeleri burada biriktirebilir, dilediğiniz gibi düzenleyebilir veya silebilirsiniz.
          </p>

          {/* Quick Counter Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <span className="text-2xs font-bold text-amber-200 block uppercase">Biriktirilen</span>
              <span className="text-xl font-black text-white">{customCards.length} Kart</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <span className="text-2xs font-bold text-amber-200 block uppercase">Öğrenilen</span>
              <span className="text-xl font-black text-white">
                {customCards.filter(c => learned.includes(c.id)).length} Kart
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <span className="text-2xs font-bold text-amber-200 block uppercase">Favoriler</span>
              <span className="text-xl font-black text-white">
                {customCards.filter(c => favorites.includes(c.id)).length} Kart
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <span className="text-2xs font-bold text-amber-200 block uppercase">Depolama</span>
              <span className="text-xl font-black text-emerald-200">Sürekli Bulut</span>
            </div>
          </div>
        </div>

        <BookOpen className="absolute -right-8 -bottom-8 w-64 h-64 text-white/10 pointer-events-none" />
      </div>

      {/* Add New Custom Word Form */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-800">
              Yeni Kelime Kartı Oluştur
            </h3>
          </div>
          <span className="text-2xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
            AI Destekli Kart Hazırlayıcı
          </span>
        </div>

        <form onSubmit={handleGenerateWordCard} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                İngilizce Kelime <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newWordInput}
                onChange={(e) => setNewWordInput(e.target.value)}
                placeholder="Örn: scrutinize, reluctant, unfathomable..."
                className="w-full px-4 py-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-amber-500 font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Kaynak veya Not (İsteğe Bağlı)
              </label>
              <input
                type="text"
                value={contextInput}
                onChange={(e) => setContextInput(e.target.value)}
                placeholder="Örn: Sayfa 112 - 1984 Kitabı, Dizi repliği..."
                className="w-full px-4 py-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-amber-500 font-medium text-slate-800"
              />
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
              {errorMessage}
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <p className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              <Info className="w-4 h-4 text-amber-500 shrink-0" />
              Yapay Zeka otomatik olarak 3 örnek cümle ve Türkçe anlam ekleyecektir.
            </p>

            <button
              type="submit"
              disabled={isGenerating}
              className="px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 shrink-0"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Yapay Zeka Hazırlıyor...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Yapay Zeka İle Kart Oluştur</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Custom Cards List Header Controls */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Özel Kelime Portföyünüz ({customCards.length})
            </h3>
            <p className="text-xs text-slate-500">
              Eklediğiniz kelimeler bulutta güvenle saklanır; düzenleyebilir, silebilir veya dışa aktarabilirsiniz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Özel kelimelerde ara..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent font-bold focus:outline-none text-xs cursor-pointer"
              >
                <option value="newest">En Yeni Eklenenler</option>
                <option value="oldest">En Eski Eklenenler</option>
                <option value="az">A-Z Alfabetik</option>
                <option value="za">Z-A Alfabetik</option>
              </select>
            </div>

            {/* Export JSON button */}
            <button
              onClick={handleExportJSON}
              title="Kelimelerinizi JSON dosyası olarak bilgisayarınıza yedekleyin"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-amber-600" />
              <span>Yedekle (JSON)</span>
            </button>

            {/* Import JSON button */}
            <label
              title="Daha önce indirdiğiniz kelime yedek dosyasını geri yükleyin"
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-amber-600" />
              <span>Yedek Yükle</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Custom Cards Grid */}
        {processedCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {processedCards.map((card) => (
              <WordCardComponent
                key={card.id}
                card={card}
                isFavorite={favorites.includes(card.id)}
                isLearned={learned.includes(card.id)}
                onToggleFavorite={onToggleFavorite}
                onToggleLearned={onToggleLearned}
                onDeleteCustom={onDeleteCustomCard}
                onEditCustom={(c) => setEditingCard(c)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-xs">
            <BookOpen className="w-10 h-10 text-amber-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">
              {searchQuery ? 'Aramanıza Uygun Kelime Bulunamadı' : 'Henüz Özel Kelime Eklenmemiş'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? 'Farklı bir arama kelimesi deneyebilir veya aramayı temizleyebilirsiniz.'
                : 'Okuduğunuz İngilizce kitaplardan veya makalelerden bilmediğiniz ilk kelimeyi yukarıdaki forma yazarak biriktirmeye başlayın!'}
            </p>
          </div>
        )}
      </div>

      {/* Edit Card Modal */}
      {editingCard && (
        <EditCardModal
          card={editingCard}
          isOpen={!!editingCard}
          onClose={() => setEditingCard(null)}
          onDelete={(id) => {
            onDeleteCustomCard(id);
            setEditingCard(null);
          }}
          onSave={(updated) => {
            onUpdateCustomCard(updated);
            setEditingCard(null);
          }}
        />
      )}
    </div>
  );
};
