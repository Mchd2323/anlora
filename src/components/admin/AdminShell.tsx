import React, { useState } from 'react';
import { Shield, LayoutDashboard, Users, BookMarked, MessageSquare, Palette } from 'lucide-react';
import { AdminOverview } from './AdminOverview';
import { AdminUsers } from './AdminUsers';
import { AdminDictionary } from './AdminDictionary';
import { AdminMessages } from './AdminMessages';
import { AdminAppearance } from './AdminAppearance';

/**
 * Yönetim panelinin kabuğu.
 *
 * Sekmeler ayrı bileşenler; her biri kendi verisini AÇILDIĞINDA çeker.
 * Hepsini birden yüklemek, panele her girişte altı ayrı isteği zorunlu
 * kılardı — yönetici çoğu zaman tek bir işe bakmak için giriyor.
 *
 * YETKİ. Bu kabuk yalnızca sunucunun yönetici dediği hesaba gösterilir, ama
 * gösterim bir güvenlik önlemi değildir: yetki her istekte sunucuda ayrıca
 * denetlenir ve yetkisiz istek 403 değil 404 alır.
 */

type TabId = 'overview' | 'users' | 'dictionary' | 'messages' | 'appearance';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Genel Bakış', icon: LayoutDashboard },
  { id: 'users', label: 'Kullanıcılar', icon: Users },
  { id: 'dictionary', label: 'Sözlük', icon: BookMarked },
  { id: 'messages', label: 'Mesajlar', icon: MessageSquare },
  { id: 'appearance', label: 'Görünüm', icon: Palette }
];

export const AdminShell: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [tab, setTab] = useState<TabId>('overview');

  return (
    <div className="space-y-4 pb-safe-nav max-w-[1080px] mx-auto animate-fadeIn">
      <div className="flex items-center justify-between gap-3 bg-[#FFFFFF] p-5 rounded-2xl border border-[#E4E1D9]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#1E2430] text-white flex items-center justify-center shrink-0">
            <Shield className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1E2430]">Yönetim Paneli</h2>
            <p className="text-[11px] text-[#687080]">
              Hesaplar, sözlük ve kullanım. Kimsenin kelimeleri burada görünmez.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-xs font-semibold text-[#687080] hover:bg-[#F1EFE8] rounded-xl cursor-pointer shrink-0"
        >
          Kapat
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(item => {
          const Icon = item.icon;
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border
                          transition-colors cursor-pointer flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-[#1E2430] text-white border-[#1E2430]'
                              : 'bg-[#FFFFFF] text-[#1E2430] border-[#E4E1D9] hover:bg-[#F1EFE8]'
                          }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && <AdminOverview />}
      {tab === 'users' && <AdminUsers />}
      {tab === 'dictionary' && <AdminDictionary />}
      {tab === 'messages' && <AdminMessages />}
      {tab === 'appearance' && <AdminAppearance />}
    </div>
  );
};
