import React, { useMemo, useState } from 'react';
import { WordCard, LearningState } from '../types';
import { WordCardComponent } from './WordCard';
import { Search } from 'lucide-react';
import { speakText } from '../utils/speech';
import { getUserWordStatus } from '../utils/storageV2';
import { RealmsIcon } from './ui/RealmsIcon';

/**
 * Tek bir okuma isteğine sığdırılacak azami karakter.
 *
 * Android'in metin okuma servisi tek istekte 4000 karakterden uzun metni
 * geçersiz sayıp reddediyor (TextToSpeech.getMaxSpeechInputLength). Reddi
 * eklenti hataya çeviriyor, speech.ts de bunu "no-voice" olarak bildiriyor:
 * yani favorisi çok olan kullanıcı hiç ses duymadan "Cihazda İngilizce
 * seslendirme paketi bulunamadı" uyarısı alıyor ve paket kurulu olduğu hâlde
 * gereksiz yere Android ayarlarına yönlendiriliyordu. Motorun kendi payını da
 * aşmamak için sınırın belirgin biçimde altında kalıyoruz.
 */
const TEK_OKUMA_KARAKTER_SINIRI = 3500;

interface FavoritesViewProps {
  favoriteWords: WordCard[];
  favorites: string[];
  learningStates?: Record<string, LearningState>;
  onToggleFavorite: (id: string) => void;
  onOpenAddToCollection?: (card: WordCard) => void;
  onOpenEditModal?: (card: WordCard) => void;
  onSetWordStatus?: (id: string, status: 'learned' | 'learning' | 'unseen') => void;
  /** Profile geri döner. Verilmezse geri düğmesi çizilmez. */
  onBack?: () => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favoriteWords,
  favorites,
  learningStates = {},
  onToggleFavorite,
  onOpenAddToCollection,
  onOpenEditModal,
  onSetWordStatus,
  onBack
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = favoriteWords.filter(
    (card) =>
      card.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.turkishMeaning.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /*
   * Motora YALNIZCA İngilizce kelimeler gidiyor.
   *
   * Önceden metin `kelime. Türkçe anlam` biçiminde birleştiriliyordu; oysa
   * speech.ts her zaman İngilizce bir ses etiketi seçiyor (bestEnglishTag
   * İngilizce dışını eliyor). Türkçe anlamlar İngilizce fonetikle okunduğu
   * için tek favorisi olan kullanıcı bile anlaşılmaz bir ses duyuyordu.
   * SpeechOptions tek bir `lang` taşıdığından karışık dilli okuma bu
   * mimaride zaten mümkün değil; anlamlar bu yüzden okunmuyor.
   *
   * Liste ayrıca karakter sınırına göre kırpılıyor: kırpılmazsa istek
   * bütünüyle reddedilir ve TEK BİR kelime bile okunmaz.
   */
  const okunacakKelimeler = useMemo(() => {
    const secilenler: string[] = [];
    let uzunluk = 0;
    for (const kart of favoriteWords) {
      const kelime = kart.word.trim();
      if (!kelime) continue;
      // İlk kelime hariç her kelime '. ' ayırıcısıyla ekleniyor.
      const artis = secilenler.length === 0 ? kelime.length : kelime.length + 2;
      if (uzunluk + artis > TEK_OKUMA_KARAKTER_SINIRI) break;
      secilenler.push(kelime);
      uzunluk += artis;
    }
    return secilenler;
  }, [favoriteWords]);

  const handlePlayAllFavorites = () => {
    if (okunacakKelimeler.length === 0) return;
    void speakText(okunacakKelimeler.join('. '));
  };

  return (
    <div className="space-y-6 pb-safe-nav max-w-[1180px] mx-auto animate-fadeIn">
      {/* Header */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] cursor-pointer inline-flex items-center gap-1"
        >
          ← Profile dön
        </button>
      )}

      <div className="parsomen-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface)] p-6 sm:p-7 rounded-2xl border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--danger-soft)] text-[var(--favorite)] flex items-center justify-center font-bold border border-[var(--danger-border)]">
            <RealmsIcon name="favorite" size={22} className="fill-current" />
          </div>
          <div>
            <h2 className="baslik-yazit text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Favori Kelimelerim ({favoriteWords.length})
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
              Hızlı erişmek ve tekrar etmek istediğin kelimeler.
            </p>
          </div>
        </div>

        {favoriteWords.length > 0 && (
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <button
              onClick={handlePlayAllFavorites}
              className="px-3.5 py-2 bg-[var(--danger-soft)] hover:bg-[var(--danger-soft-strong)] text-[var(--favorite)] font-semibold text-xs rounded-xl border border-[var(--danger-border)] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RealmsIcon name="audio" size={20} className="text-[var(--favorite)]" />
              <span>Tümünü Dinle</span>
            </button>
            {/*
              Kırpma sessiz kalmamalı: kullanıcı listenin tamamını duymayı
              beklerken yalnızca bir bölümünü duyduğunda bunu eksiklik değil
              arıza sanıyor.
            */}
            {okunacakKelimeler.length < favoriteWords.length && (
              <p className="text-[11px] text-[var(--text-secondary)] sm:text-right max-w-[15rem]">
                Cihaz tek seferde bu kadar uzun metni okuyamıyor; ilk{' '}
                {okunacakKelimeler.length} kelime okunacak.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Search Input */}
      {favoriteWords.length > 0 && (
        <div className="relative max-w-md">
          <RealmsIcon name="search" size={18} className="text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Favorilerde kelime ara..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
          />
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((card) => (
            <WordCardComponent
              key={card.id}
              card={card}
              isFavorite={favorites.includes(card.id)}
              learningState={learningStates[card.id]}
              status={getUserWordStatus(card.id, learningStates)}
              onSetStatus={onSetWordStatus}
              onToggleFavorite={onToggleFavorite}
              onOpenAddToCollection={onOpenAddToCollection ? () => onOpenAddToCollection(card) : undefined}
              onEditCustom={card.isCustom && onOpenEditModal ? () => onOpenEditModal(card) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="parsomen-panel bg-[var(--surface)] p-10 rounded-2xl border border-[var(--border)] text-center space-y-2 shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
          <RealmsIcon name="favorite" size={22} className="text-[var(--text-muted)] mx-auto opacity-50" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Favori Kelime Bulunamadı</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
            Kartlardaki kalp ikonuna dokunarak kelimeleri favorilerine ekleyebilirsin.
          </p>
        </div>
      )}
    </div>
  );
};
