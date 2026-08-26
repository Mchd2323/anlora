import React, { useState } from 'react';
import { Shield, LayoutDashboard, Users, BookMarked, MessageSquare, Palette, Sparkles, Server } from 'lucide-react';
import { AdminOverview } from './AdminOverview';
import { AdminUsers } from './AdminUsers';
import { AdminDictionary } from './AdminDictionary';
import { AdminMessages } from './AdminMessages';
import { AdminAppearance } from './AdminAppearance';
import { AdminAI } from './AdminAI';
import { AdminSystem } from './AdminSystem';

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

type TabId = 'overview' | 'users' | 'dictionary' | 'ai' | 'messages' | 'appearance' | 'system';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Genel Bakış', icon: LayoutDashboard },
  { id: 'users', label: 'Kullanıcılar', icon: Users },
  { id: 'dictionary', label: 'Sözlük', icon: BookMarked },
  { id: 'ai', label: 'Yapay Zekâ', icon: Sparkles },
  { id: 'messages', label: 'Mesajlar', icon: MessageSquare },
  { id: 'appearance', label: 'Görünüm', icon: Palette },
  { id: 'system', label: 'Sistem', icon: Server }
];

export const AdminShell: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [tab, setTab] = useState<TabId>('overview');

  return (
    <div className="space-y-4 pb-safe-nav max-w-[1080px] mx-auto animate-fadeIn">
      <div className="flex items-center justify-between gap-3 bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--text-primary)] text-white flex items-center justify-center shrink-0">
            <Shield className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Yönetim Paneli</h2>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Hesaplar, sözlük ve kullanım. Kimsenin kelimeleri burada görünmez.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] rounded-xl cursor-pointer shrink-0"
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
                              ? 'bg-[var(--text-primary)] text-white border-[var(--text-primary)]'
                              : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
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
      {tab === 'ai' && <AdminAI />}
      {tab === 'messages' && <AdminMessages />}
      {tab === 'appearance' && <AdminAppearance />}
      {tab === 'system' && <AdminSystem />}
    </div>
  );
};
