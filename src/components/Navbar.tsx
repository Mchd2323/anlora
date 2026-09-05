import React from 'react';
import { useRemoteApi } from '../hooks/useRemoteApi';
import { User, LogIn, NotebookPen } from 'lucide-react';
import { UserProfile } from '../types';
import { BRAND } from '../config/brand';
import { ArmaPlaka } from './ui/ArmaPlaka';
import { RealmsIcon } from './ui/RealmsIcon';

/**
 * Uygulamadaki tüm görünümler.
 *
 * 'study' gezinme çubuğunda sekme olarak görünmez ama gerçek bir görünümdür
 * (`App.tsx` ona `setActiveTab` ile geçer). Önceki sürümde birlik listede yer
 * almadığı için TypeScript bu geçişi hata olarak göremiyordu.
 *
 * Listede bir de 'custom' vardı ama App onu HİÇ ele almıyordu: o sekmeye
 * geçen bir kod boş ekran gösterirdi. Tek gönderen yer artık silinmiş olan
 * HomeHero'ydu; tip listesinden de kaldırıldı ki bir daha yazılamasın.
 */
export type TabType =
  | 'today'
  | 'collections'
  | 'oxford'
  | 'quiz'
  | 'profile'
  | 'study';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  profile?: UserProfile;
  onOpenAuthModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  profile,
  onOpenAuthModal
}) => {
  /*
   * Sunucusuz kurulumda hesap diye bir şey yok; giriş düğmesi hiç çizilmez.
   * Aynı denetim ProfileView'da da var — ikisi de aynı kancadan okuyor,
   * yoklama tek sefer yapılıyor.
   */
  const hesapAcilabilir = useRemoteApi();

  /*
   * `shortLabel`, alt çubuk içindir. Sekme sayısı altıya çıkınca dar
   * telefonlarda uzun etiketler birbirinin üstüne biniyordu; kısaltma yalnızca
   * mobil çubukta kullanılır, masaüstünde tam ad görünür.
   */
  const navItems = [
    {
      id: 'today' as TabType,
      label: 'Ana Sayfa',
      shortLabel: 'Ana Sayfa',
      ikon: 'home' as const
    },
    {
      id: 'collections' as TabType,
      label: 'Kelime Setlerim',
      shortLabel: 'Setlerim',
      /*
       * Kalemli defter, üst üste üç karo yerine.
       * Karo simgesi "katman/koleksiyon" diyor; oysa buradaki şey
       * kullanıcının okurken kendi elyazısıyla not ettiği kelimeler.
       * Uygulamayı diğerlerinden ayıran fikir de tam olarak bu.
       */
      ikon: 'sets' as const,
      /*
       * TEK İSTİSNA. Uygulamanın her yerinde "set" eylemi Realms sprite'ındaki
       * `sets` (üst üste katmanlar) işaretini kullanıyor; yalnızca gezinme
       * sekmesinde kalemli defter duruyor.
       *
       * Neden: karo/katman simgesi "koleksiyon" der; oysa buradaki şey
       * kullanıcının okurken kendi elyazısıyla not ettiği kelimelerdir ve
       * uygulamayı ayıran fikir de budur. Sekme, o fikrin görünen yüzü.
       *
       * Çizgi kalınlığı sprite'ınkiyle aynı (1,7) veriliyor ki iki ikon dili
       * yan yana ayrışmasın.
       */
      sekmeIkonu: NotebookPen
      /*
       * Set SAYISI rozeti kaldırıldı. Rozet, ilgilenilmesi gereken bir şeyi
       * (okunmamış bildirim, bekleyen iş) haber vermek içindir. Kullanıcının
       * kaç set kurduğu böyle bir şey değil; on set kurmuş birine sekmenin
       * köşesinde sürekli '10' göstermek bilgi değil gürültüdür.
       */
    },
    {
      id: 'oxford' as TabType,
      label: 'Oxford Kelime Listesi',
      shortLabel: 'Oxford',
      ikon: 'book' as const
    },
    {
      id: 'quiz' as TabType,
      label: 'Sınav',
      shortLabel: 'Sınav',
      ikon: 'exam' as const
    },
    {
      id: 'profile' as TabType,
      label: 'Profilim',
      shortLabel: 'Profil',
      ikon: 'profile' as const
    }
  ];

  return (
    <>
      {/* Desktop Header */}
      <header className="baslik-cubugu sticky top-0 z-40 transition-colors safe-top">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo - Text Wordmark */}
            <div
              onClick={() => setActiveTab('today')}
              className="flex items-center gap-3 cursor-pointer group select-none"
            >
              {/*
                Logo çıplak durmuyor: referanstaki gibi küçük bir lacivert-altın
                hanedan plakasının içinde. Sıradan renkli kare ya da yuvarlak
                kare kullanılmadı — plaka kalkan biçiminde.
              */}
              <ArmaPlaka genislik={38} />
              {/*
                Ad ve slogan üst üste. Slogan ana sayfada ayrı bir satır
                kaplıyordu; oradan alınıp buraya konuldu, çünkü marka sesi
                her ekranda görünsün diye tekrar edilmesi gereken bir şey
                değil — bir kez, üst çubukta durması yeterli.
              */}
              <span className="flex flex-col leading-none">
                <span className="baslik-yazit text-xl font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                  {BRAND.name}
                </span>
                <span className="text-[10px] font-medium text-[var(--primary)] tracking-tight mt-0.5">
                  {BRAND.slogan}
                </span>
              </span>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
      
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-bold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
                    }`}
                  >
                    {item.sekmeIkonu ? (
                      <item.sekmeIkonu
                        size={20}
                        strokeWidth={1.7}
                        className={isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}
                      />
                    ) : (
                      <RealmsIcon
                        name={item.ikon}
                        size={20}
                        className={isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}
                      />
                    )}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right User Action */}
            <div className="flex items-center gap-2">
              {profile?.isLoggedIn ? (
                <button
                  onClick={() => setActiveTab('profile')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-soft)] hover:bg-[var(--primary-soft)] text-[var(--text-primary)] hover:text-[var(--primary)] text-xs font-semibold border border-[var(--border)] transition-colors cursor-pointer"
                >
                  <div className="w-5 h-5 rounded-lg bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center text-[10px] font-bold">
                    {profile.email ? profile.email[0].toUpperCase() : 'U'}
                  </div>
                  <span className="hidden sm:inline max-w-[130px] truncate font-medium">
                    {profile.name || profile.email}
                  </span>
                </button>
              ) : hesapAcilabilir ? (
                <button
                  onClick={onOpenAuthModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--primary-soft)] hover:bg-[var(--primary-soft-hover)] text-[var(--primary)] border border-[var(--primary-border)] text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Giriş Yap</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-1 pt-1.5 pb-1.5 safe-bottom flex items-center justify-around alt-gezinme">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center min-h-[44px] py-1 px-0.5 rounded-xl text-[10px] font-medium transition-colors flex-1 cursor-pointer ${
                isActive ? 'text-[var(--primary)] font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {/*
                Aktif sekme lacivert YAZIYLA ve üstündeki ince ALTIN çizgiyle
                belirginleşiyor; referansta olduğu gibi büyük renkli bir dolgu
                yok. Çizgi düğmenin en üstünde, ikonun üzerinde durmuyor.
              */}
              <span
                aria-hidden="true"
                className={`h-[2px] w-7 rounded-full mb-1 transition-colors ${
                  isActive ? 'bg-[var(--gold-ornament)]' : 'bg-transparent'
                }`}
              />
              <div className="relative">
                {/* Alt menü ikonu 22 piksel (paketin ölçüsü); dokunma
                    hedefi ve etiket değişmedi. */}
                {item.sekmeIkonu ? (
                  <item.sekmeIkonu
                    size={22}
                    strokeWidth={1.7}
                    className={isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}
                  />
                ) : (
                  <RealmsIcon
                    name={item.ikon}
                    size={22}
                    className={isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}
                  />
                )}
              </div>
              <span className="mt-0.5 whitespace-nowrap">{item.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
