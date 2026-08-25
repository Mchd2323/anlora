import React from 'react';
import {
  BookOpen,
  GraduationCap,
  Layers,
  Library,
  Home,
  User,
  LogIn
} from 'lucide-react';
import { UserProfile } from '../types';
import { BRAND } from '../config/brand';

/**
 * Uygulamadaki tüm görünümler.
 *
 * 'study' ve 'custom' gezinme çubuğunda sekme olarak görünmez ama gerçek birer
 * görünümdür (`App.tsx` bunlara `setActiveTab` ile geçer). Önceki sürümde
 * birlik listede yer almadıkları için TypeScript bu geçişleri hata olarak
 * göremiyordu; @types/react eksik olduğu için de fark edilmemişti.
 */
export type TabType =
  | 'today'
  | 'collections'
  | 'oxford'
  | 'general'
  | 'quiz'
  | 'profile'
  | 'study'
  | 'custom';

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
      id: 'general' as TabType,
      label: 'Genel Dağarcık',
      shortLabel: 'Dağarcık',
      icon: Library
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
      <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#E4E1D9] transition-colors">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo - Text Wordmark */}
            <div
              onClick={() => setActiveTab('today')}
              className="flex items-center gap-2.5 cursor-pointer group select-none"
            >
              <div className="w-8 h-8 rounded-xl bg-[#4F46A5] flex items-center justify-center text-white shadow-2xs group-hover:bg-[#433B91] transition-colors">
                <BookOpen className="w-4 h-4 stroke-[2.4]" />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#1E2430] group-hover:text-[#4F46A5] transition-colors">
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
                        ? 'bg-[#EEECFA] text-[#4F46A5] font-bold'
                        : 'text-[#687080] hover:text-[#1E2430] hover:bg-[#F1EFE8]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 stroke-[2] ${
                        isActive ? 'text-[#4F46A5]' : 'text-[#8E95A2]'
                      }`}
                    />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`ml-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                          isActive
                            ? 'bg-[#4F46A5] text-white'
                            : 'bg-[#E4E1D9] text-[#1E2430]'
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
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F1EFE8] hover:bg-[#EEECFA] text-[#1E2430] hover:text-[#4F46A5] text-xs font-semibold border border-[#E4E1D9] transition-colors cursor-pointer"
                >
                  <div className="w-5 h-5 rounded-lg bg-[#4F46A5] text-white flex items-center justify-center text-[10px] font-bold">
                    {profile.email ? profile.email[0].toUpperCase() : 'U'}
                  </div>
                  <span className="hidden sm:inline max-w-[130px] truncate font-medium">
                    {profile.name || profile.email}
                  </span>
                </button>
              ) : (
                <button
                  onClick={onOpenAuthModal}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#EEECFA] hover:bg-[#E3DFF6] text-[#4F46A5] border border-[#D7D2F4] text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Giriş Yap</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#E4E1D9] px-1 py-1.5 flex items-center justify-around shadow-sm">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center min-h-[44px] py-1 px-0.5 rounded-xl text-[10px] font-medium transition-colors flex-1 cursor-pointer ${
                isActive ? 'text-[#4F46A5] font-bold' : 'text-[#687080] hover:text-[#1E2430]'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 stroke-[2] ${
                    isActive ? 'text-[#4F46A5]' : 'text-[#8E95A2]'
                  }`}
                />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2.5 min-w-[14px] h-[14px] px-1 bg-[#4F46A5] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
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
