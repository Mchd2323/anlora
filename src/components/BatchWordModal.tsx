import React, { useRef, useState } from 'react';
import { Collection, WordCard, CollectionMembership } from '../types';
import { Sparkles, ArrowRight, X, Loader2 } from 'lucide-react';
import { findLemmaCandidate, normalizeWordString } from '../utils/lemmatizer';
import { detectWordDuplicate } from '../utils/duplicateDetector';
import { aramaAnahtari } from '../utils/aramaAnahtari';
import { yazimOnerileri } from '../utils/yazimOnerisi';
import {
  extendedKelimeler,
  getExtendedCard,
  hasExtendedWord,
  loadExtendedIndex
} from '../services/extendedRepository';
import { getPhraseCard, loadPhrases } from '../services/phraseRepository';
import { useModalA11y } from '../hooks/useModalA11y';
import { apiUrl, getApiCapabilities } from '../config/api';
import { useRemoteApi } from '../hooks/useRemoteApi';
import { RealmsIcon } from './ui/RealmsIcon';

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
  /*
   * SOZLUKTE: kelime Oxford'da değil ama Genel Dağarcık'ta ya da kalıp
   * listesinde bulundu. Bu durum ÖLÇÜLEREK eklendi: 299 kelimelik gerçek bir
   * listede 47 kelime Genel Dağarcık'ta, 2'si kalıp listesinde vardı; ekran
   * yalnızca Oxford'a baktığı için 49'unu da "yeni" sayıp yapay zekâya
   * gönderiyordu. Cihazda doğrulanmış kart dururken yaklaşık yedi dakika
   * bekleme ve boşuna kota demekti.
   *
   * LISTEDE_TEKRAR: aynı kelime metinde birden çok kez yazılmış. Önceden
   * ikinci kopya sessizce düşürülüyordu; kullanıcı 307 satır yapıştırıp 299
   * satır görüyor ve farkın nereye gittiğini bilmiyordu.
   */
  status:
    | 'EXACT_IN_COLLECTION'
    | 'EXACT_IN_OTHER_COLLECTION'
    | 'EXACT_IN_OXFORD'
    | 'SOZLUKTE'
    | 'LISTEDE_TEKRAR'
    | 'NEW';
  matchedCard?: WordCard;
  /** SOZLUKTE ise kartın hangi kaynaktan çözüleceği. */
  sozlukKaynagi?: 'extended' | 'phrase';
  /** Sözlükte yok ama yakın yazımlar var: "bunu mu demek istedin?" */
  yazimOnerisi?: string[];
  /** Çekimli biçim; kökü sözlükte bulunanlar için ("skidded" -> "skid"). */
  kokBicimi?: string;
  selected: boolean;
  /**
   * Kullanıcının bu ekranda doldurduğu kart bilgisi.
   *
   * Sözlükte olmayan kelimeler eskiden BOŞ kart olarak ekleniyordu ve
   * "anlamını sen yazacaksın" deniyordu. Ama kullanıcının o kartı bulması
   * için setteki yüzlerce kartın arasında aşağı inmesi gerekiyordu; pratikte
   * boş kartlar öylece kalıyordu. Artık kelime eklenmeden ÖNCE, bu ekranda
   * doldurulabiliyor.
   */
  elleDolduruldu?: {
    turkishMeaning: string;
    partOfSpeech: string;
    phonetic: string;
    examples: { en: string; tr: string }[];
  };
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
  const yapayZekaVar = useRemoteApi('ai') === true;

  const modalRef = useModalA11y(isOpen, onClose);

  /*
   * KART DOLDURMA EKRANI.
   *
   * `doldurulanIndex` null degilse liste yerine tek bir kartin formu
   * gosteriliyor. Ayri bir pencere acmak yerine ayni pencerede bir adim
   * kullanildi: kullanici toplu ekleme akisindan hic cikmiyor, "Kaydet"
   * dedigi anda listeye geri donuyor ve kaldigi yerden devam ediyor.
   */
  const [doldurulanIndex, setDoldurulanIndex] = useState<number | null>(null);
  const [formAnlam, setFormAnlam] = useState('');
  const [formTur, setFormTur] = useState('');
  const [formTelaffuz, setFormTelaffuz] = useState('');
  const [formOrnekler, setFormOrnekler] = useState<{ en: string; tr: string }[]>([
    { en: '', tr: '' }
  ]);

  const doldurmayiAc = (idx: number) => {
    const mevcut = analyzedList[idx]?.elleDolduruldu;
    setFormAnlam(mevcut?.turkishMeaning || '');
    setFormTur(mevcut?.partOfSpeech || '');
    setFormTelaffuz(mevcut?.phonetic || '');
    setFormOrnekler(
      mevcut?.examples?.length ? mevcut.examples.map(e => ({ ...e })) : [{ en: '', tr: '' }]
    );
    setDoldurulanIndex(idx);
  };

  const doldurmayiKaydet = () => {
    if (doldurulanIndex === null) return;
    const guncel = [...analyzedList];
    guncel[doldurulanIndex] = {
      ...guncel[doldurulanIndex],
      // Anlam bos birakildiysa kayit yapilmaz: bos bir "dolduruldu" isareti
      // kullaniciyi yanlis yonlendirirdi.
      elleDolduruldu: formAnlam.trim()
        ? {
            turkishMeaning: formAnlam,
            partOfSpeech: formTur,
            phonetic: formTelaffuz,
            examples: formOrnekler
          }
        : undefined,
      selected: true
    };
    setAnalyzedList(guncel);
    setDoldurulanIndex(null);
  };

  /**
   * Kullanıcı bir öneriye dokundu: girdi değiştirilir ve YENİDEN
   * sınıflandırılır. Düzeltilen kelime çoğu zaman sözlükte bulunur, yani
   * satır "yeni AI kartı"ndan "hazır kart"a döner.
   */
  const oneriyiUygula = (idx: number, yeniKelime: string) => {
    const adaylar = [
      ...oxfordWords.map(w => aramaAnahtari(w.word)),
      ...extendedKelimeler()
    ];
    const yeni = girdiyiSinifla(yeniKelime, adaylar);
    if (!yeni) return;
    const guncel = [...analyzedList];
    guncel[idx] = yeni;
    setAnalyzedList(guncel);
  };

  const [rawInput, setRawInput] = useState('');
  /*
   * Kalıp listesinin anahtarları. Kalıp dosyası ayrı ve tembel yükleniyor;
   * çözümleme başlarken bir kez okunup burada tutuluyor ki her kelime için
   * yeniden dosyaya gidilmesin.
   *
   * DURUM DEĞİL REF. İlk yazımda `useState` kullanılmıştı ve ölçümde
   * yakalandı: `setKalipAnahtarlari(...)` çağrıldıktan hemen sonra çalışan
   * döngü hâlâ ESKİ boş kümeyi okuyor (durum yazımı bir sonraki render'da
   * görünür). Sonuç: kullanıcının listesindeki "in advance" ve "for instance"
   * kalıp listesinde OLMASINA rağmen bulunamıyor, ikisi de yapay zekâya
   * gidiyordu. Ref'in değeri atandığı anda okunabiliyor ve bu değer hiçbir
   * çizimi etkilemiyor, yani durum olmasının bir gerekçesi de yok.
   */
  const kalipAnahtarlariRef = useRef<Set<string>>(new Set());
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

  const kalipVarMi = (anahtar: string) => kalipAnahtarlariRef.current.has(anahtar);

  /*
   * Kök biçim aranırken "bu kelime sözlükte var mı" sorusunu cevaplar.
   * Lemmatizer sözlüğe doğrudan bağlanmıyor (dairesel bağımlılık olurdu),
   * denetimi çağıran taraf veriyor. Böylece "skidded" -> "skid" gibi gerçek
   * bir kök öneriliyor, "beed" gibi uydurma bir taban değil.
   */
  const bilinenKelime = (aday: string) => {
    const anahtar = aramaAnahtari(aday);
    return (
      oxfordWords.some(w => aramaAnahtari(w.word) === anahtar) ||
      customWords.some(w => aramaAnahtari(w.word) === anahtar) ||
      hasExtendedWord(anahtar)
    );
  };

  /**
   * Tek bir girdiyi sınıflandırır.
   *
   * Öneri uygulandığında da (kullanıcı "enthusiast"ı seçtiğinde) aynı işlev
   * çağrılıyor; iki ayrı sınıflandırma yazmak, ikisinin zamanla ayrışması
   * demekti.
   */
  const girdiyiSinifla = (raw: string, adaylar: string[]): AnalyzedToken | null => {
    const normalized = normalizeWordString(raw);
    if (!normalized) return null;

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

    const anahtar = aramaAnahtari(raw);
    let sozlukKaynagi: AnalyzedToken['sozlukKaynagi'];
    let yazimOnerisi: string[] | undefined;
    let kokBicimi: string | undefined;

    if (status === 'NEW') {
      /*
       * Oxford'da yoksa CİHAZDAKİ diğer iki kaynağa bakılıyor. Buraya kadar
       * gelmeden yapay zekâya gitmek, elimizde hazır ve doğrulanmış bir kart
       * varken sekiz saniye beklemek demekti.
       */
      if (hasExtendedWord(anahtar)) {
        status = 'SOZLUKTE';
        sozlukKaynagi = 'extended';
      } else if (kalipVarMi(anahtar)) {
        status = 'SOZLUKTE';
        sozlukKaynagi = 'phrase';
      } else {
        /*
         * Hâlâ yok. İki ipucu aranıyor ve HİÇBİRİ KENDİLİĞİNDEN
         * UYGULANMIYOR: sözlüğümüz İngilizcenin tamamı değil, "holder" ya da
         * "sewer" gibi gerçek kelimeler de bu dala düşüyor. Öneri bir
         * sorudur, düzeltme değil.
         */
        const kok = findLemmaCandidate(normalized, bilinenKelime);
        if (kok && kok.baseForm !== normalized) kokBicimi = kok.baseForm;
        // Kök biçimi zaten ayrı bir düğme olarak sunuluyor; yazım
        // önerilerinde ikinci kez göstermek aynı şeyi iki kez sormak olurdu.
        const oneri = yazimOnerileri(anahtar, adaylar, 2).filter(o => o !== kokBicimi);
        if (oneri.length) yazimOnerisi = oneri;
      }
    }

    return {
      raw,
      normalized,
      status,
      matchedCard: check.matchedWordCard,
      sozlukKaynagi,
      yazimOnerisi,
      kokBicimi,
      // 'LISTEDE_TEKRAR' bu işlevden hiç dönmüyor; o durum listeyi
      // gezen döngüde, aynı kelimenin ikinci kopyası görülünce yazılıyor.
      selected: status !== 'EXACT_IN_COLLECTION'
    };
  };

  const handleAnalyze = async () => {
    if (!rawInput.trim()) return;
    setIsAnalyzing(true);

    /*
     * Sözlükler BEKLENİYOR. İkisi de tembel yükleniyor ve beklemeden
     * sorulursa her kelime için "yok" cevabı gelir -- yani listenin tamamı
     * yapay zekâya gider. Dosyalar pakete gömülü, bekleme bir kereliktir.
     */
    await Promise.all([
      loadExtendedIndex().catch(() => undefined),
      loadPhrases()
        .then(l => {
          kalipAnahtarlariRef.current = new Set(l.map(k => aramaAnahtari(k.headword)));
        })
        .catch(() => undefined)
    ]);

    const tokens = rawInput
      .split(/[\n,;]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Yazım önerisinin adayları: cihazdaki iki liste.
    const adaylar = [
      ...oxfordWords.map(w => aramaAnahtari(w.word)),
      ...extendedKelimeler()
    ];

    const seen = new Set<string>();
    const results: AnalyzedToken[] = [];

    tokens.forEach(raw => {
      const normalized = normalizeWordString(raw);
      if (!normalized) return;

      if (seen.has(normalized)) {
        // Sessizce düşürmek yerine görünür kılınıyor; kullanıcı listesindeki
        // tekrarı ancak burada görebilir.
        results.push({
          raw,
          normalized,
          status: 'LISTEDE_TEKRAR',
          selected: false
        });
        return;
      }
      seen.add(normalized);

      const sonuc = girdiyiSinifla(raw, adaylar);
      if (sonuc) results.push(sonuc);
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

      if (item.status === 'EXACT_IN_COLLECTION' || item.status === 'LISTEDE_TEKRAR') {
        skippedCount++;
        continue;
      }

      /*
       * CİHAZDAKİ SÖZLÜKTEN GELEN KART. Yapay zekâ çağrılmıyor: kart zaten
       * var, doğrulanmış ve çevrimdışı.
       *
       * Kart KOPYALANARAK ekleniyor, kimliği yazılarak değil. Genel Dağarcık
       * ve kalıp kayıtları Oxford dizisinde bulunmuyor (ayrı dosyalardan
       * tembel yükleniyorlar); yalnızca üyelik yazmak, sette hiçbir yerde
       * çözülemeyen görünmez bir kayıt bırakırdı. Tekli ekleme yolu da
       * (CollectionsView `addLookedUpCard`) aynı şeyi yapıyor.
       */
      if (item.status === 'SOZLUKTE') {
        try {
          const anahtar = normalizeWordString(item.raw);
          const kart =
            item.sozlukKaynagi === 'phrase'
              ? await getPhraseCard(anahtar)
              : await getExtendedCard(anahtar);
          if (kart) {
            onAddCustomWord(
              {
                ...kart,
                id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                isCustom: true,
                dateAdded: new Date().toISOString().slice(0, 10),
                isAiGenerated: false
              },
              targetCollection.id
            );
            addedCount++;
            continue;
          }
        } catch {
          /* harf dosyası açılamadıysa aşağıdaki genel yola düşülür */
        }
      }

      if (item.matchedCard) {
        onLinkWordToCollection(item.matchedCard.id, targetCollection.id);
        linkedCount++;
      } else if (item.elleDolduruldu) {
        /*
         * Kullanıcı kartı bu ekranda doldurdu. Yapay zekâya sormanın anlamı
         * yok: elde kullanıcının kendi yazdığı, doğruluğundan emin olduğu bir
         * içerik var ve onu bir öneriyle değiştirmek veri kaybı olurdu.
         */
        const el = item.elleDolduruldu;
        const yeniKart: WordCard = {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          word: item.normalized,
          partOfSpeech: el.partOfSpeech.trim(),
          turkishMeaning: el.turkishMeaning.trim(),
          phonetic: el.phonetic.trim() || undefined,
          examples: el.examples.filter(ex => ex.en.trim() || ex.tr.trim()),
          isCustom: true,
          dateAdded: new Date().toISOString().slice(0, 10)
        };
        onAddCustomWord(yeniKart, targetCollection.id);
        addedCount++;
      } else {
        try {
          /*
           * YOKLAMA BURADA BEKLENİYOR, RENDER ANINDAKİ BAYRAĞA GÜVENİLMİYOR.
           *
           * `yapayZekaVar` çizim anındaki değerdir ve yoklama sürerken `false`
           * olur. Burada ona bakmak, uygulama yeni açılmışken başlatılan bir
           * toplu eklemede yapay zekâyı ATLAYIP kelimeleri boş kart olarak
           * kaydediyordu -- yani yalnızca görüntüyü değil, KAYDEDİLEN VERİYİ
           * bozuyordu. Bu dal zaten `async`; sonucu beklemenin bedeli yok.
           */
          const yetenekler = await getApiCapabilities();
          if (!yetenekler.ai) throw new Error('yapay-zeka-yok');
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

            /*
             * Yapay zekâ "bu bir İngilizce kelime değil" derse ortada kart
             * yoktur. Aşağıdaki dal `cardData.word || item.raw` ile yine de
             * bir kart kurardı: anlamı ve örnekleri boş, ama YAPAY ZEKÂ
             * ÜRETTİ damgalı. Aşağıdaki catch dalı tam olarak bu durum için
             * yazılmış (bilgi yok, kart boş bırakılır, kullanıcı doldurur);
             * oraya düşürülüyor.
             *
             * Toplu eklemede tek tek "bunu mu demek istedin" sorulmuyor: kırk
             * kelimelik bir yüklemede her biri için soru sormak akışı
             * kilitler. Kelime kaybolmuyor, elle doldurulacak kart olarak
             * listede kalıyor.
             */
            if (cardData && cardData.notAWord) throw new Error('yazim-supheli');

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
              <RealmsIcon name="sets" size={20} />
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
          {/*
            KART DOLDURMA ADIMI.

            Liste yerine tek bir kartın formu gösteriliyor; kaydedince listeye
            dönülüyor. Ayrı bir pencere açmak yerine aynı pencerede bir adım
            kullanıldı: kullanıcı toplu ekleme akışından hiç çıkmıyor.
          */}
          {doldurulanIndex !== null ? (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold text-[var(--text-muted)] tracking-wider">
                    Kart doldur
                  </div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">
                    {analyzedList[doldurulanIndex]?.normalized}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDoldurulanIndex(null)}
                  className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-[var(--border)] text-[var(--text-secondary)] cursor-pointer"
                >
                  Vazgeç
                </button>
              </div>

              <div>
                <label htmlFor="anlora-toplu-anlam" className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                  Türkçe Anlamı <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  id="anlora-toplu-anlam"
                  type="text"
                  value={formAnlam}
                  onChange={e => setFormAnlam(e.target.value)}
                  placeholder="Örn: isteksiz, gönülsüz"
                  className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="anlora-toplu-tur" className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Kelime Türü <span className="font-semibold normal-case text-[var(--text-muted)]">(isteğe bağlı)</span>
                  </label>
                  <input
                    id="anlora-toplu-tur"
                    type="text"
                    value={formTur}
                    onChange={e => setFormTur(e.target.value)}
                    placeholder="Örn: n., v., adj."
                    className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label htmlFor="anlora-toplu-telaffuz" className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Telaffuz <span className="font-semibold normal-case text-[var(--text-muted)]">(isteğe bağlı)</span>
                  </label>
                  <input
                    id="anlora-toplu-telaffuz"
                    type="text"
                    value={formTelaffuz}
                    onChange={e => setFormTelaffuz(e.target.value)}
                    placeholder="Örn: /ˈæp.əl/"
                    className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-secondary)]">
                    Örnek Cümleler <span className="font-semibold normal-case text-[var(--text-muted)]">(isteğe bağlı)</span>
                  </span>
                  {formOrnekler.length < 3 && (
                    <button
                      type="button"
                      onClick={() => setFormOrnekler(l => [...l, { en: '', tr: '' }])}
                      className="text-[11px] font-semibold text-[var(--primary)] cursor-pointer"
                    >
                      + Bir örnek daha
                    </button>
                  )}
                </div>
                {formOrnekler.map((ornek, i) => (
                  <div key={i} className="p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--border)] space-y-1.5">
                    <input
                      type="text"
                      value={ornek.en}
                      onChange={e => {
                        const l = [...formOrnekler];
                        l[i] = { ...l[i], en: e.target.value };
                        setFormOrnekler(l);
                      }}
                      placeholder="İngilizce cümle"
                      className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none text-[var(--text-primary)]"
                    />
                    <input
                      type="text"
                      value={ornek.tr}
                      onChange={e => {
                        const l = [...formOrnekler];
                        l[i] = { ...l[i], tr: e.target.value };
                        setFormOrnekler(l);
                      }}
                      placeholder="Türkçe karşılığı"
                      className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none text-[var(--text-primary)]"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={doldurmayiKaydet}
                  disabled={!formAnlam.trim()}
                  className="dugme-birincil px-4 py-2 bg-[var(--primary)] text-[var(--on-primary)] text-xs font-bold rounded-xl cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Kaydet ve listeye dön
                </button>
              </div>
            </div>
          ) : step === 'input' ? (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)]  mb-1">
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
                  className="dugme-birincil px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-[var(--on-primary)] text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
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
                    {analyzedList.filter(i =>
                      i.status === 'EXACT_IN_OXFORD' ||
                      i.status === 'EXACT_IN_OTHER_COLLECTION' ||
                      i.status === 'SOZLUKTE'
                    ).length}
                  </span>
                </div>
                <div className="p-2.5 bg-[var(--learning-soft)] rounded-xl border border-[var(--learning-border)] text-center">
                  <span className="text-[10px] text-[var(--learning-text)] font-bold block">ATLANACAK</span>
                  <span className="text-base font-bold text-[var(--learning-text)]">
                    {analyzedList.filter(i =>
                      i.status === 'EXACT_IN_COLLECTION' || i.status === 'LISTEDE_TEKRAR'
                    ).length}
                  </span>
                </div>
              </div>

              {/*
                KAÇ KELİME YAPAY ZEKÂYA GİDECEK VE NE KADAR SÜRECEK?
                Ölçüldü: kart üretimi kelime başına yaklaşık sekiz saniye ve
                istekler sırayla gidiyor. Yüz kelimelik bir liste on üç dakika
                demek; kullanıcı bunu BAŞLAMADAN önce bilmeli, yoksa ekranın
                donduğunu sanıp pencereyi kapatıyor ve yarım kalmış bir set
                kalıyor.
              */}
              {(() => {
                const yapayZekayaGidecek = analyzedList.filter(
                  i => i.selected && i.status === 'NEW' && !i.elleDolduruldu
                ).length;
                if (!yapayZekayaGidecek) return null;
                const dakika = Math.max(1, Math.round((yapayZekayaGidecek * 8) / 60));
                return (
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed px-1">
                    {yapayZekaVar ? (
                      <>
                        <span className="font-bold text-[var(--text-primary)]">{yapayZekayaGidecek}</span>{' '}
                        kelime sözlükte yok; Anlora AI ile hazırlanacak.
                        Yaklaşık <span className="font-bold">{dakika} dakika</span> sürer ve
                        pencere açık kalmalı.
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-[var(--text-primary)]">{yapayZekayaGidecek}</span>{' '}
                        kelime sözlükte yok ve Anlora AI bu kurulumda kapalı; bunlar
                        anlamı boş kart olarak eklenir. Yukarıdan tek tek doldurabilirsin.
                      </>
                    )}
                  </p>
                );
              })()}

              {/* List */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {analyzedList.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border transition-all ${
                      item.status === 'EXACT_IN_COLLECTION' || item.status === 'LISTEDE_TEKRAR'
                        ? 'bg-[var(--learning-soft)]/40 border-[var(--learning-border)] opacity-60'
                        : item.selected
                        ? 'bg-[var(--surface)] border-[var(--border)]'
                        : 'bg-[var(--bg)] border-[var(--border)] opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        disabled={
                          item.status === 'EXACT_IN_COLLECTION' ||
                          item.status === 'LISTEDE_TEKRAR'
                        }
                        onChange={(e) => {
                          const updated = [...analyzedList];
                          updated[idx].selected = e.target.checked;
                          setAnalyzedList(updated);
                        }}
                        className="w-3.5 h-3.5 rounded text-[var(--primary)] accent-[var(--primary)] cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-[var(--text-primary)]">{item.raw}</span>
                        {/*
                          Anlam yalnızca O KART GERÇEKTEN kullanılacaksa
                          yazılıyor. `matchedCard`, tekrar denetimi yakın bir
                          kayıt bulduğunda (örneğin "suburbs" için "suburb")
                          durum hâlâ NEW iken de doluyor; anlamı orada
                          göstermek "bu kelime bizde var" demek olurdu, oysa
                          satırın rozeti "Yeni AI Kartı" diyor. İki bilgi
                          birbiriyle çelişiyordu.
                        */}
                        {item.matchedCard &&
                          (item.status === 'EXACT_IN_OXFORD' ||
                            item.status === 'EXACT_IN_OTHER_COLLECTION' ||
                            item.status === 'EXACT_IN_COLLECTION') && (
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
                      {item.status === 'NEW' && item.elleDolduruldu && (
                        <button
                          type="button"
                          onClick={() => doldurmayiAc(idx)}
                          className="text-[10px] font-bold bg-[var(--learned-soft)] text-[var(--learned-text)] px-2 py-1 rounded-md border border-[var(--learned-border)] cursor-pointer"
                        >
                          ✓ Dolduruldu · düzenle
                        </button>
                      )}
                      {item.status === 'NEW' && !item.elleDolduruldu &&
                        (yapayZekaVar ? (
                          <span className="text-[10px] font-bold bg-[var(--learned-soft)] text-[var(--learned-text)] px-2 py-0.5 rounded-md border border-[var(--learned-border)]">
                            Yeni AI Kartı
                          </span>
                        ) : (
                          /*
                            ARTIK BOŞ KART BIRAKILMIYOR.

                            Eskiden burada yalnızca "anlamı sen yazacaksın"
                            yazan bir rozet vardı; kullanıcının o kartı sonradan
                            bulması için setteki yüzlerce kartın arasında aşağı
                            inmesi gerekiyordu ve pratikte kartlar boş kalıyordu.
                            Düğme, kelime EKLENMEDEN ÖNCE aynı pencerede kartı
                            doldurmayı öneriyor.
                          */
                          <button
                            type="button"
                            onClick={() => doldurmayiAc(idx)}
                            className="text-[10px] font-bold bg-[var(--primary-soft)] text-[var(--primary)] px-2 py-1 rounded-md border border-[var(--primary-border)] cursor-pointer"
                          >
                            Kartı doldurmak için dokun
                          </button>
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
                      {item.status === 'SOZLUKTE' && (
                        <span className="text-[10px] font-bold bg-[var(--primary-soft)] text-[var(--primary)] px-2 py-0.5 rounded-md border border-[var(--primary-border)]">
                          {item.sozlukKaynagi === 'phrase' ? 'Kalıp' : 'Sözlükte'} · hazır
                        </span>
                      )}
                      {item.status === 'LISTEDE_TEKRAR' && (
                        <span className="text-[10px] font-bold bg-[var(--learning-soft)] text-[var(--learning-text)] px-2 py-0.5 rounded-md border border-[var(--learning-border)]">
                          Listede zaten var
                        </span>
                      )}
                    </div>
                    </div>

                    {/*
                      ÖNERİLER — KENDİLİĞİNDEN UYGULANMAZ.

                      Sözlüğümüz İngilizcenin tamamı değil: "holder", "sewer",
                      "ox" gibi gerçek kelimeler de bulunamayanlar arasına
                      düşüyor ve onlar için önerilen "düzeltme" yanlış olurdu.
                      Bu yüzden öneri bir SORUDUR; dokunulmadıkça hiçbir şey
                      değişmez.
                    */}
                    {(item.yazimOnerisi?.length || item.kokBicimi) && (
                      <div className="mt-1.5 pl-6 flex flex-wrap items-center gap-1.5">
                        {item.kokBicimi && (
                          <>
                            <span className="text-[10px] text-[var(--text-muted)]">kök biçimi:</span>
                            <button
                              type="button"
                              onClick={() => oneriyiUygula(idx, item.kokBicimi!)}
                              className="text-[10px] font-bold px-2 py-1 rounded-md border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)] cursor-pointer"
                            >
                              {item.kokBicimi}
                            </button>
                          </>
                        )}
                        {item.yazimOnerisi?.length ? (
                          <>
                            <span className="text-[10px] text-[var(--text-muted)]">bunu mu demek istedin?</span>
                            {item.yazimOnerisi.map(oneri => (
                              <button
                                key={oneri}
                                type="button"
                                onClick={() => oneriyiUygula(idx, oneri)}
                                className="text-[10px] font-bold px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-soft)]"
                              >
                                {oneri}
                              </button>
                            ))}
                          </>
                        ) : null}
                      </div>
                    )}
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
                  className="dugme-birincil px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-[var(--on-primary)] text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
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
