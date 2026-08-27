import React, { useMemo, useState, useEffect } from 'react';
import {
  Collection,
  CollectionMembership,
  WordCard,
  Level,
  UserProfile,
  LearningState,
  UserSettings,
  UserStats
} from '../types';
import {
  Layers,
  BookOpen,
  Plus,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Flame,
  Target,
  Play,
  Megaphone,
  Check,
  RotateCw,
  CloudUpload
} from 'lucide-react';
import { getUserWordStatus } from '../utils/storageV2';
import { readJSON, writeJSON } from '../utils/safeStorage';
import { summarizeQueue } from '../utils/srsEngine';
import { CEFRBadge } from './ui/CEFRBadge';
import { BRAND } from '../config/brand';
import { AdSlot } from './AdSlot';
import { HomeHeroArt } from './HomeHeroArt';

interface TodayDashboardProps {
  collections: Collection[];
  memberships: CollectionMembership[];
  /** Oxford 3000 (A1–B2). */
  oxfordWords: WordCard[];
  /** Oxford 5000 Ek (B2 Ek, C1). Seviye kartlarında ayrı sayılır. */
  extraWords?: WordCard[];
  customWords?: WordCard[];
  learningStates?: Record<string, LearningState>;
  settings?: UserSettings;
  stats?: UserStats;
  profile?: UserProfile;
  /**
   * Yöneticinin panelden düzenlediği metinler ve logo.
   *
   * Alanı boş gelen her şey pakete gömülü varsayılana düşer; sunucu yoksa
   * ya da çevrimdışıysak ekran yine dolu görünür.
   */
  branding?: {
    logoDataUri?: string;
    appName?: string;
    slogan?: string;
    homeIntro?: string;
    setsIntro?: string;
    lookupTitle?: string;
    lookupBody?: string;
  };
  announcements?: { id: string; title: string; body: string; createdAt: string }[];
  onNavigateToTab: (tab: string) => void;
  onSelectLevel?: (level: Level | 'B2_EK') => void;
  onOpenCreateSet?: () => void;
  onOpenAuthModal?: () => void;
  onStartStudy?: (collectionId?: string) => void;
  onOpenTextMiner?: () => void;
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({
  collections,
  memberships,
  oxfordWords,
  extraWords = [],
  customWords = [],
  learningStates = {},
  settings,
  stats,
  profile,
  branding = {},
  announcements = [],
  onNavigateToTab,
  onSelectLevel,
  onOpenCreateSet,
  onOpenAuthModal,
  onStartStudy
}) => {
  // Bugünün iş yükü: bekleyen tekrarlar ve hiç çalışılmamış kelimeler ayrı
  // sayılır. Tek bir "vadesi gelen" sayısı vermek, dokunulmamış tüm Oxford
  // sözlüğünü (~3.900 madde) günlük göreve dönüştürüyordu.
  const todayQueue = useMemo(() => {
    const ids = [...oxfordWords, ...customWords].map(w => w.id);
    return summarizeQueue(ids, learningStates);
  }, [oxfordWords, customWords, learningStates]);

  const reviewGoal = settings?.dailyReviewGoal ?? 15;
  const newGoal = settings?.dailyNewWordsGoal ?? 5;
  const plannedReviews = Math.min(todayQueue.dueCount, reviewGoal);
  const plannedNew = Math.min(todayQueue.newCount, newGoal);
  const plannedTotal = plannedReviews + plannedNew;
  const streakDays = stats?.streakDays ?? 0;
  /** Oxford 5000'in tamamı: 3000 çekirdek + Ek liste. */
  const oxfordToplam = oxfordWords.length + extraWords.length;
  /*
   * Oxford seviye sayıları ve ilerlemesi.
   *
   * Oxford 3000 ve Oxford 5000 Ek tek başlık altında birleşti; ana sayfadaki
   * kartlar da altı seviyeyi birden gösterir. B2 Ek ayrı bir kova olarak
   * kalır: aynı CEFR seviyesinde olsalar da farklı kaynak listelerdir ve
   * ikisini toplamak, olmayan bir birleşik listeyi varmış gibi gösterirdi.
   */
  const oxfordLevelStats = useMemo(() => {
    const counts: Record<string, { total: number; learned: number; learning: number }> = {
      A1: { total: 0, learned: 0, learning: 0 },
      A2: { total: 0, learned: 0, learning: 0 },
      B1: { total: 0, learned: 0, learning: 0 },
      B2: { total: 0, learned: 0, learning: 0 },
      B2_EK: { total: 0, learned: 0, learning: 0 },
      C1: { total: 0, learned: 0, learning: 0 }
    };

    const tally = (card: WordCard, key: string) => {
      if (!counts[key]) return;
      counts[key].total++;
      const st = getUserWordStatus(card.id, learningStates);
      if (st === 'learned') counts[key].learned++;
      else if (st === 'learning') counts[key].learning++;
    };

    oxfordWords.forEach(w => tally(w, w.level || ''));
    extraWords.forEach(w => tally(w, w.level === 'C1' ? 'C1' : 'B2_EK'));

    return counts;
  }, [oxfordWords, extraWords, learningStates]);

  const hasSets = collections.length > 0;

  /** Kullanıcının kendi eklediği kelime sayısı; teşvik bunun üstüne kurulu. */
  const customWordCount = customWords.length;

  /*
   * Teşvik kapatıldı mı? Karar oturum boyunca değil KALICI saklanır:
   * her açılışta yeniden çıkan bir uyarı okunmaz hâle gelir.
   */
  const [isNudgeDismissed, setIsNudgeDismissed] = useState(
    () => readJSON<boolean>('anlora.signupNudgeDismissed.v1', false)
  );
  useEffect(() => {
    if (isNudgeDismissed) writeJSON('anlora.signupNudgeDismissed.v1', true);
  }, [isNudgeDismissed]);

  // Set oluşturmak giriş gerektirmez: veri zaten yerelde tutuluyor ve giriş
  // yalnızca bulut yedeklemesi içindir. İlk adımda hesap istemek, ürünün
  // "hızlı ekleme" vaadinin önündeki en büyük sürtünmeydi.
  const handleCreateSetClick = () => {
    if (onOpenCreateSet) {
      onOpenCreateSet();
    } else {
      onNavigateToTab('collections');
    }
  };

  return (
    <div className="space-y-6 pb-safe-nav max-w-[1080px] mx-auto animate-fadeIn">
      {/* 1. ÜST BÖLÜM: Anlora Marka Karşılama ve Slogan */}
      <div className="text-left space-y-2 pt-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            {branding.logoDataUri && (
              <img
                src={branding.logoDataUri}
                alt=""
                className="w-11 h-11 rounded-2xl object-contain bg-white border border-[var(--border)] p-1"
              />
            )}
            <h1 className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tight">
              {branding.appName || BRAND.name}
            </h1>
          </div>
          <p className="text-lg sm:text-xl font-semibold text-[var(--primary)] tracking-tight">
            {branding.slogan || BRAND.slogan}
          </p>
        </div>
        <p className="text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          {branding.homeIntro || (
            <>
              Kendi kelime setlerini oluştur ya da Oxford 5000'i seviyene göre çalış.
              Bildiklerini işaretle, aralıklı tekrarla aklında tut.
            </>
          )}
        </p>
      </div>

      {/*
        ÜYELİK TEŞVİKİ — zorlamadan.

        Yalnızca kaybedecek bir şeyi olan kullanıcıya gösterilir: hiç kelime
        eklememiş birine "verilerin kaybolmasın" demek boş bir uyarıdır ve
        uygulamayı ilk açan kişiyi hesap açmaya iter. Kapatılabilir; her
        açılışta aynı şeyi söylemek uyarıyı görünmez kılar.
      */}
      {!profile?.isLoggedIn && customWordCount > 0 && !isNudgeDismissed && (
        <div className="bg-[var(--learning-soft)] border border-[var(--learning-border)] rounded-2xl p-4 flex items-start gap-3">
          <CloudUpload className="w-4 h-4 text-[var(--learning-text)] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--learning-text)]">
              {customWordCount} kelimen yalnızca bu telefonda
            </p>
            <p className="text-xs text-[var(--learning-text)] mt-0.5 leading-relaxed opacity-90">
              Uygulamayı silersen ya da telefonun kaybolursa bunlar da gider.
              Hesap açmak ücretsiz; kelimelerin buluta yedeklenir.
            </p>
            <div className="flex flex-wrap gap-2 mt-2.5">
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="px-3 py-1.5 bg-[var(--learning)] hover:opacity-90 text-[var(--surface)] text-[11px] font-bold rounded-lg cursor-pointer"
              >
                Hesap aç
              </button>
              <button
                type="button"
                onClick={() => setIsNudgeDismissed(true)}
                className="px-3 py-1.5 text-[11px] font-semibold text-[var(--learning-text)] hover:bg-[var(--learning-soft-hover)] rounded-lg cursor-pointer"
              >
                Şimdi değil
              </button>
            </div>
          </div>
        </div>
      )}

      {/*
        UYGULAMA NE İŞE YARAR

        Kullanıcı uygulamayı ilk açtığında bir kart destesi görüyordu ama ne
        için orada olduğunu anlatan bir şey yoktu. Bu blok iki şeyi söyler ve
        sırası önemlidir: önce KENDİ kelimelerini toplayabilmesi, sonra
        Oxford listesinde kendini ölçebilmesi.

        Anlora'yı ayıran şey burada: başka uygulamalar kullanıcıya hazır
        kelime setleri dayatır. Burada setleri kullanıcı kendi okuduğundan,
        izlediğinden, çevirdiğinden kurar; hazır liste yalnızca kendini
        ölçmek isteyene bir ölçek olarak durur.
      */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <div className="flex-1 min-w-0 order-2 sm:order-1">
            <h2 className="text-lg sm:text-xl font-black text-[var(--text-primary)] leading-tight">
              Kendi kelimelerini biriktir,
              <br className="hidden sm:block" /> seviyeni kendin gör.
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
              {branding.homeIntro ||
                `${branding.appName || BRAND.name} hazır kelime listeleri dayatmaz. Ne okuyorsan, ne izliyorsan
                 oradan topladığın kelimeleri çalışırsın; Oxford listesi de kendini ölçmek istediğinde
                 elinin altındadır.`}
            </p>
          </div>
          <HomeHeroArt className="w-full max-w-[220px] sm:max-w-[280px] h-auto order-1 sm:order-2 shrink-0" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-light)] space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-[var(--primary)] text-[var(--surface)] text-[11px] font-black flex items-center justify-center shrink-0">
                1
              </span>
              <span className="text-sm font-bold text-[var(--text-primary)]">Kendi setlerin</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Kitap, makale, dizi, film, ders — nerede bilmediğin bir kelimeye takıldıysan onu buraya
              ekle. Metni yapıştır, bilmediklerini uygulama ayıklasın; ya da tek tek yaz. Anlamı,
              telaffuzu ve örnek cümleleri sözlükten kendiliğinden gelir.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-light)] space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-[var(--primary)] text-[var(--surface)] text-[11px] font-black flex items-center justify-center shrink-0">
                2
              </span>
              <span className="text-sm font-bold text-[var(--text-primary)]">Seviyene göre kendini ölç</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Oxford 5000'in her seviyesinde (A1'den C1'e) hangi kelimeyi bildiğini, hangisini
              bilmediğini işaretlersin. Uygulama bunları <b className="text-[var(--text-primary)]">bildiklerin</b> ve
              <b className="text-[var(--text-primary)]"> bilmediklerin</b> diye ayrı listelerde tutar; her seviyede yüzde kaçını
              bitirdiğini görürsün.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--primary-soft)]/70 border border-[var(--primary-border)]">
          <Sparkles className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[var(--text-primary)] leading-relaxed">
            <b>Kelimeyi yaz, gerisi hazır gelsin.</b> Aradığın kelime {branding.appName || BRAND.name} sözlüğünde
            varsa Türkçe anlamı, telaffuzu ve üç örnek cümlesi anında gelir — internet gerekmeden.
          </p>
        </div>
      </div>

      {/*
        Duyurular. Yönetici bir şey yayınlamadıysa burası hiç çizilmez;
        boş bir "duyuru yok" kutusu göstermenin kimseye faydası olmaz.
      */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.slice(0, 2).map(item => (
            <div
              key={item.id}
              className="bg-[var(--primary-soft)] border border-[var(--primary-border)] rounded-2xl p-4 flex items-start gap-3"
            >
              <Megaphone className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">{item.title}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdSlot slot="home-top" className="rounded-2xl" />

      {/*
        SIRALAMA
        Kullanıcının kendi setleri en üstte durur: uygulamaya girme sebebi
        çoğunlukla kendi kelimeleri. Hazır sözlük onun altında, günlük plan
        ise en altta — plan bir özet, bir başlangıç noktası değil.
      */}
      {/* 1. KELİME SETLERİM */}
      <div className="bg-[var(--surface)] rounded-2xl p-6 sm:p-7 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Kelime Setlerim</h2>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {branding.setsIntro ||
                'Dizi, kitap, ders veya günlük hayatta karşılaştığın kelimelerden kendi setlerini oluştur.'}
            </p>

            {/* AI Callout */}
            <div className="p-3 bg-[var(--primary-soft)]/80 rounded-xl border border-[var(--primary-border)] text-xs text-[var(--text-primary)] flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[var(--primary)] block">
                  {branding.lookupTitle || 'Her set kendi bağlamını taşır'}
                </span>
                <p className="text-[var(--text-secondary)] text-[11px] mt-0.5">
                  {branding.lookupBody || (
                    <>
                      Kelimeyi hangi dizide ya da kitapta gördüğünü not edebilirsin;
                      çalışırken o cümleyle birlikte karşına çıkar.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={handleCreateSetClick}
              className="px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.98] text-[var(--surface)] text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Kelime Seti Oluştur</span>
            </button>
          </div>
        </div>

        {/* Set Listesi veya İlk Set Onboarding */}
        {hasSets ? (
          <div className="space-y-3 pt-2 border-t border-[var(--border-light)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {collections.slice(0, 3).map((deck) => {
                const count = memberships.filter((m) => m.collectionId === deck.id).length;
                let learned = 0;
                let learning = 0;

                memberships
                  .filter((m) => m.collectionId === deck.id)
                  .forEach((m) => {
                    const st = getUserWordStatus(m.wordId, learningStates);
                    if (st === 'learned') learned++;
                    else if (st === 'learning') learning++;
                  });

                const learnedPercent = count > 0 ? Math.round((learned / count) * 100) : 0;

                return (
                  <div
                    key={deck.id}
                    onClick={() => onNavigateToTab('collections')}
                    className="p-4 rounded-xl bg-[var(--bg)] hover:bg-[var(--surface-soft)] border border-[var(--border)] hover:border-[var(--neutral-300)] transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <h4 className="font-bold text-[var(--text-primary)] text-sm group-hover:text-[var(--primary)] transition-colors truncate">
                        {deck.name}
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">
                        {count} kelime
                      </p>
                    </div>

                    <div className="mt-4 space-y-1.5 pt-2 border-t border-[var(--border)]">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)]">
                        <span className="text-[var(--learned)] inline-flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />{learned} Öğrendim
                        </span>
                        <span className="text-[var(--learning)] inline-flex items-center gap-1">
                          <RotateCw className="w-3 h-3 stroke-[3]" aria-hidden="true" />{learning} Tekrar Et
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--learned)] rounded-full transition-all"
                          style={{ width: `${learnedPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => onNavigateToTab('collections')}
                className="text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] flex items-center gap-1 group cursor-pointer py-2 -my-1"
              >
                <span>Tüm Setlerimi Gör ({collections.length})</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-2">
            <h3 className="font-bold text-[var(--text-primary)] text-sm">
              Henüz bir Kelime Setin yok
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              İlk setini oluştur ve karşılaştığın kelimeleri biriktirmeye başla.
            </p>
            <div className="pt-1">
              <button
                onClick={handleCreateSetClick}
                className="px-3.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--surface)] text-xs font-semibold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>İlk Setimi Oluştur</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. OXFORD 5000 */}
      <div className="bg-[var(--surface)] rounded-2xl p-6 sm:p-7 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--cefr-a1-soft)] text-[var(--learned)] flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Oxford 5000</h2>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              A1'den C1'e İngilizce kelimelerini seviyene göre çalış.
            </p>
          </div>

          <button
            onClick={() => onNavigateToTab('oxford')}
            className="text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] flex items-center gap-1 self-start sm:self-auto shrink-0 cursor-pointer py-2 -my-1"
          >
            <span>Tüm Oxford 5000'i Gör</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Altı seviye kartı: A1, A2, B1, B2, B2 Ek, C1 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
          {[
            {
              level: 'A1' as const,
              title: 'A1 Başlangıç',
              stats: oxfordLevelStats.A1,
              topBorder: 'border-t-2 border-t-[var(--cefr-a1)]'
            },
            {
              level: 'A2' as const,
              title: 'A2 Temel',
              stats: oxfordLevelStats.A2,
              topBorder: 'border-t-2 border-t-[var(--cefr-a2)]'
            },
            {
              level: 'B1' as const,
              title: 'B1 Orta Seviye',
              stats: oxfordLevelStats.B1,
              topBorder: 'border-t-2 border-t-[var(--cefr-b1)]'
            },
            {
              level: 'B2' as const,
              title: 'B2 İleri Orta',
              stats: oxfordLevelStats.B2,
              topBorder: 'border-t-2 border-t-[var(--cefr-b2)]'
            },
            {
              level: 'B2_EK' as const,
              title: 'B2 Ek',
              stats: oxfordLevelStats.B2_EK,
              topBorder: 'border-t-2 border-t-[var(--cefr-b2-strong)]'
            },
            {
              level: 'C1' as const,
              title: 'C1 İleri',
              stats: oxfordLevelStats.C1,
              topBorder: 'border-t-2 border-t-[var(--primary-deep)]'
            }
          ].map((lvl) => {
            const learnedPercent =
              lvl.stats.total > 0 ? Math.round((lvl.stats.learned / lvl.stats.total) * 100) : 0;

            return (
              <button
                key={lvl.level}
                onClick={() => {
                  if (onSelectLevel) onSelectLevel(lvl.level);
                  onNavigateToTab('oxford');
                }}
                className={`p-4 rounded-xl bg-[var(--bg)] hover:bg-[var(--surface-soft)] border border-[var(--border)] hover:border-[var(--neutral-300)] text-left transition-all group relative cursor-pointer ${lvl.topBorder}`}
              >
                <div className="flex items-center justify-between">
                  <CEFRBadge level={lvl.level === 'B2_EK' ? 'B2 EK' : lvl.level} size="sm" />
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 transition-transform" />
                </div>

                <div className="mt-3">
                  <div className="text-xs font-bold text-[var(--text-primary)]">{lvl.title}</div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {lvl.stats.total} Kelime
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[10px] font-semibold text-[var(--text-secondary)]">
                    <span>{lvl.stats.learned} Öğrendim</span>
                    <span>%{learnedPercent}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--learned)] rounded-full transition-all"
                      style={{ width: `${learnedPercent}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <AdSlot slot="home-bottom" className="rounded-2xl" />

      {/*
        3. GÜNLÜK ÇALIŞMA PLANI

        Kutu tek bir yol sunar: "kaldığın yerden devam et". Uygulama neyin
        çalışılacağını kendisi seçer — önce tekrar zamanı gelmiş kelimeler,
        sonra hiç bakılmamışlar. Sınav ve setler alt satırda küçük birer
        seçenek olarak durur.

        Gerekçe: her açılışta "bugün ne çalışsam" diye karar vermek zorunda
        kalan kullanıcı çoğu gün hiçbir şey çalışmaz. Bu kararı vermek
        uygulamanın işidir; alternatifler duruyor ama öne çıkmıyor.
      */}
      <div className="bg-[var(--surface)] rounded-2xl p-5 sm:p-6 border border-[var(--border)] shadow-[0_1px_3px_rgba(30,36,48,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Günlük Çalışma Planı</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Kendi hedefin: günde {reviewGoal} tekrar + {newGoal} yeni kelime
                <span className="text-[var(--text-muted)]"> · Profilden değiştirilebilir</span>
              </p>
            </div>
          </div>

          {/*
            Seri kutusu. Önceden yalnızca "1 günlük seri" yazıyordu ve bunun
            günlük hedefle karıştırılması kolaydı. Artık ne olduğunu kendisi
            söylüyor: arka arkaya çalışılan gün sayısı.
          */}
          {streakDays > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--learning-soft)] border border-[var(--learning-border)] self-start">
              <Flame className="w-4 h-4 text-[var(--learning)] shrink-0" />
              <div className="leading-tight">
                <div className="text-xs font-bold text-[var(--learning-text)]">
                  {streakDays} gündür aralıksız
                </div>
                <div className="text-[10px] text-[var(--learning-text)]/75">
                  Bugün de çalışırsan {streakDays + 1} olur
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-light)]">
            <div className="text-2xl font-black text-[var(--primary)] tabular-nums">
              {todayQueue.dueCount}
            </div>
            <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wide mt-0.5">
              Tekrar zamanı geldi
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-snug">
              Daha önce çalıştığın, unutmaman için tekrar etmen gereken kelimeler.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-light)]">
            <div className="text-2xl font-black text-[var(--learned)] tabular-nums">
              {todayQueue.newCount.toLocaleString('tr-TR')}
            </div>
            <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wide mt-0.5">
              Seni bekleyen kelime
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-snug">
              Oxford 5000 listesinden {oxfordToplam.toLocaleString('tr-TR')} kelime
              {customWords.length > 0 && <> ve kendi setlerinden {customWords.length.toLocaleString('tr-TR')} kelime</>}
              {' '}içinden henüz hiç bakmadıkların.
            </p>
          </div>
        </div>

        {onStartStudy && (
          <button
            onClick={() => onStartStudy()}
            disabled={plannedTotal === 0}
            className="w-full mt-4 py-3.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-[var(--surface)] text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>
              {plannedTotal > 0
                ? `Kaldığın yerden devam et (${plannedTotal} kelime)`
                : 'Bugünlük her şey tamam'}
            </span>
          </button>
        )}

        {plannedTotal > 0 && (
          <p className="text-[10px] text-[var(--text-muted)] text-center mt-2 leading-snug">
            Önce tekrar zamanı gelenler, sonra yeni kelimeler gösterilir.
          </p>
        )}

        {/* Alternatifler: duruyor ama günlük akışın önüne geçmiyor. */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3 pt-3 border-t border-[var(--border-light)]">
          <span className="text-[10px] text-[var(--text-muted)]">Onun yerine:</span>
          <button
            onClick={() => onNavigateToTab('collections')}
            className="text-[11px] font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] cursor-pointer py-1"
          >
            kendi setlerim
          </button>
          <span className="text-[10px] text-[var(--text-muted)]">·</span>
          <button
            onClick={() => onNavigateToTab('oxford')}
            className="text-[11px] font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] cursor-pointer py-1"
          >
            Oxford seviyeleri
          </button>
          <span className="text-[10px] text-[var(--text-muted)]">·</span>
          <button
            onClick={() => onNavigateToTab('quiz')}
            className="text-[11px] font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] cursor-pointer py-1"
          >
            kendimi sına
          </button>
        </div>
      </div>

    </div>
  );
};
