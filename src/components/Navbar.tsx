import React from 'react';
import { useRemoteApi } from '../hooks/useRemoteApi';
import {
  BookOpen,
  GraduationCap,
  Layers,
  Home,
  User,
  LogIn
} from 'lucide-react';
import { UserProfile } from '../types';
import { BRAND } from '../config/brand';

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
  collectionCount?: number;
  profile?: UserProfile;
  onOpenAuthModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  collectionCount = 0,
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
      icon: Home
    },
    {
      id: 'collections' as TabType,
      label: 'Kelime Setlerim',
      shortLabel: 'Setlerim',
      icon: Layers,
      badge: collectionCount > 0 ? collectionCount : undefined
    },
    {
      id: 'oxford' as TabType,
      label: 'Oxford 5000',
      shortLabel: 'Oxford',
      icon: BookOpen
    },
    {
      id: 'quiz' as TabType,
      label: 'Sınav',
      shortLabel: 'Sınav',
      icon: GraduationCap
    },
    {
      id: 'profile' as TabType,
      label: 'Profilim',
      shortLabel: 'Profil',
      icon: User
    }
  ];

  return (
    <>
      {/* Desktop Header */}
      <header className="sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)] transition-colors safe-top">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo - Text Wordmark */}
            <div
              onClick={() => setActiveTab('today')}
              className="flex items-center gap-2.5 cursor-pointer group select-none"
            >
              <div className="w-8 h-8 rounded-xl bg-[var(--primary)] flex items-center justify-center text-[var(--surface)] shadow-2xs group-hover:bg-[var(--primary-hover)] transition-colors">
                <BookOpen className="w-4 h-4 stroke-[2.4]" />
              </div>
              <span className="text-xl font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                {BRAND.name}
              </span>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
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
                    <Icon
                      className={`w-4 h-4 stroke-[2] ${
                        isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
                      }`}
                    />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`ml-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                          isActive
                            ? 'bg-[var(--primary)] text-[var(--surface)]'
                            : 'bg-[var(--border)] text-[var(--text-primary)]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
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
                  <div className="w-5 h-5 rounded-lg bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center text-[10px] font-bold">
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface)] border-t border-[var(--border)] px-1 pt-1.5 pb-1.5 safe-bottom flex items-center justify-around shadow-sm">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center min-h-[44px] py-1 px-0.5 rounded-xl text-[10px] font-medium transition-colors flex-1 cursor-pointer ${
                isActive ? 'text-[var(--primary)] font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 stroke-[2] ${
                    isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
                  }`}
                />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2.5 min-w-[14px] h-[14px] px-1 bg-[var(--primary)] text-[var(--surface)] text-[9px] font-bold rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
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
