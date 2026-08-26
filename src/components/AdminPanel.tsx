import React, { useCallback, useEffect, useState } from 'react';
import {
  Shield,
  Users,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  LogOut,
  Trash2,
  AlertCircle,
  Loader2,
  X
} from 'lucide-react';
import { apiFetch } from '../utils/authClient';

/**
 * Yönetim paneli.
 *
 * YETKİ. Bu bileşen yalnızca sunucunun `isAdmin` dediği kullanıcıya gösterilir,
 * ama gösterim bir güvenlik önlemi DEĞİLDİR: yetki her istekte sunucuda ayrıca
 * denetlenir. Yetkisiz istek 403 değil 404 alır, yani uçların varlığı bile
 * açık edilmez.
 *
 * GİZLİLİK. Panel hesapları yönetir, insanların kelimelerini okumaz. Sunucu
 * bilerek yalnızca sayı ve meta veri döndürüyor; kullanıcının hangi kelimeyi
 * çalıştığı buraya hiç gelmiyor.
 */

interface Overview {
  users: {
    total: number;
    verified: number;
    pendingVerification: number;
    withCloudBackup: number;
    activeLast7Days: number;
    activeLast30Days: number;
    newLast7Days: number;
  };
  sessions: { active: number };
  ai: {
    total: number;
    today: number;
    daily: { day: string; count: number }[];
    configured: boolean;
  };
  server: { googleSignInConfigured: boolean; adminCount: number };
}

interface AdminUser {
  email: string;
  name: string;
  country: string;
  city: string;
  authProvider: string;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string | null;
  lastActive: string | null;
  activeSessions: number;
  hasPendingVerification: boolean;
  backupBytes: number;
  counts: {
    collections: number;
    customWords: number;
    favorites: number;
    learningStates: number;
  };
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Son on dört günün yapay zekâ kullanımı.
 *
 * Tek seri olduğu için açıklama kutusu yok — başlık zaten neyi gösterdiğini
 * söylüyor. Her çubuğa sayı yazılmıyor; yalnızca en yüksek gün ve bugün
 * etiketleniyor, gerisi üzerine gelince görünüyor. Eksen ve ızgara geri
 * planda: okunan şey çubukların kendisi.
 */
const UsageChart: React.FC<{ daily: { day: string; count: number }[] }> = ({ daily }) => {
  const max = Math.max(1, ...daily.map(d => d.count));
  const peakIndex = daily.reduce((best, d, i) => (d.count > daily[best].count ? i : best), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-[3px] h-24" role="img" aria-label="Son 14 günün yapay zekâ istek sayısı">
        {daily.map((d, i) => {
          const ratio = d.count / max;
          const isToday = i === daily.length - 1;
          return (
            <div key={d.day} className="flex-1 flex flex-col justify-end items-center gap-1 group relative">
              {(i === peakIndex || isToday) && d.count > 0 && (
                <span className="text-[9px] font-bold text-[#687080] tabular-nums">{d.count}</span>
              )}
              <div
                className={`w-full rounded-t-[4px] transition-colors ${
                  isToday ? 'bg-[#4F46A5]' : 'bg-[#C9C3EC] group-hover:bg-[#4F46A5]'
                }`}
                style={{ height: `${Math.max(ratio * 100, d.count > 0 ? 6 : 2)}%` }}
              />
              <span
                className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap
                           rounded-lg bg-[#1E2430] px-2 py-1 text-[10px] font-semibold text-white opacity-0
                           group-hover:opacity-100 transition-opacity z-10"
              >
                {d.day.slice(5)} · {d.count} istek
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[#8E95A2] font-medium">
        <span>{daily[0]?.day.slice(5)}</span>
        <span>bugün</span>
      </div>
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: 'plain' | 'accent' }> = ({
  label,
  value,
  hint,
  tone = 'plain'
}) => (
  <div
    className={`rounded-xl border p-3.5 ${
      tone === 'accent'
        ? 'bg-[#EEECFA] border-[#D7D2F4]'
        : 'bg-[#F8F7F3] border-[#E4E1D9]'
    }`}
  >
    <div className="text-[10px] font-bold uppercase tracking-wider text-[#8E95A2]">{label}</div>
    <div className="text-2xl font-bold text-[#1E2430] mt-1 tabular-nums">{value}</div>
    {hint && <div className="text-[11px] text-[#687080] mt-0.5">{hint}</div>}
  </div>
);

export const AdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const load = useCallback(async (search: string) => {
    setIsLoading(true);
    setError('');
    try {
      const [ov, list] = await Promise.all([
        apiFetch<Overview>('/api/admin/overview'),
        apiFetch<{ total: number; users: AdminUser[] }>(
          `/api/admin/users?limit=50&q=${encodeURIComponent(search)}`
        )
      ]);
      setOverview(ov);
      setUsers(list.users);
      setTotal(list.total);
    } catch (err: any) {
      setError(err?.message || 'Yönetim verileri alınamadı.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load('');
  }, [load]);

  // Aramada her harfte istek atmamak için kısa bir bekleme.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  const runAction = async (email: string, path: string) => {
    setBusyEmail(email);
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(email)}/${path}`, { method: 'POST' });
      await load(query.trim());
    } catch (err: any) {
      setError(err?.message || 'İşlem tamamlanamadı.');
    } finally {
      setBusyEmail(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyEmail(deleteTarget.email);
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(deleteTarget.email)}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmEmail: deleteConfirm.trim() })
      });
      setDeleteTarget(null);
      setDeleteConfirm('');
      await load(query.trim());
    } catch (err: any) {
      setError(err?.message || 'Hesap silinemedi.');
    } finally {
      setBusyEmail(null);
    }
  };

  return (
    <div className="space-y-5 pb-safe-nav max-w-[1080px] mx-auto animate-fadeIn">
      {/* Başlık */}
      <div className="flex items-center justify-between gap-3 bg-[#FFFFFF] p-5 rounded-2xl border border-[#E4E1D9]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#1E2430] text-white flex items-center justify-center shrink-0">
            <Shield className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1E2430]">Yönetim Paneli</h2>
            <p className="text-[11px] text-[#687080]">
              Hesaplar ve kullanım. Kimsenin kelimeleri burada görünmez.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-xs font-semibold text-[#687080] hover:bg-[#F1EFE8] rounded-xl cursor-pointer"
        >
          Kapat
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[#FAECEA] border border-[#F0CBC7] text-xs text-[#C65D55] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && !overview ? (
        <div className="text-center py-16 bg-[#FFFFFF] rounded-2xl border border-[#E4E1D9]">
          <Loader2 className="w-6 h-6 text-[#4F46A5] mx-auto animate-spin" />
          <p className="text-xs text-[#687080] mt-2">Yükleniyor…</p>
        </div>
      ) : overview ? (
        <>
          {/* Sayılar */}
          <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E4E1D9] space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E95A2] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Hesaplar
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label="Toplam" value={overview.users.total} tone="accent" />
              <StatTile
                label="Doğrulanmış"
                value={overview.users.verified}
                hint={`${overview.users.pendingVerification} bekliyor`}
              />
              <StatTile
                label="Son 7 gün aktif"
                value={overview.users.activeLast7Days}
                hint={`${overview.users.newLast7Days} yeni kayıt`}
              />
              <StatTile
                label="Açık oturum"
                value={overview.sessions.active}
                hint={`${overview.users.withCloudBackup} bulut yedeği`}
              />
            </div>
          </div>

          {/* Yapay zekâ kullanımı */}
          <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E4E1D9] space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E95A2] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Yapay zekâ istekleri · son 14 gün
                </h3>
                <p className="text-[11px] text-[#687080] mt-1">
                  Bugün <b className="text-[#1E2430]">{overview.ai.today}</b> · toplam{' '}
                  <b className="text-[#1E2430]">{overview.ai.total}</b>
                </p>
              </div>
              {!overview.ai.configured && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#FBF1DE] text-[#8A5A18] border border-[#E7C98F]">
                  API anahtarı yok
                </span>
              )}
            </div>
            <UsageChart daily={overview.ai.daily} />
          </div>

          {/* Kullanıcılar */}
          <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E4E1D9] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E95A2]">
                Kullanıcılar {total > 0 && <span className="text-[#687080]">({total})</span>}
              </h3>
              <div className="relative sm:w-64">
                <Search className="w-4 h-4 text-[#8E95A2] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="E-posta ya da ad ara…"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-white focus:outline-none focus:border-[#4F46A5] text-[#1E2430]"
                />
              </div>
            </div>

            {users.length === 0 ? (
              <p className="text-xs text-[#687080] py-8 text-center">Eşleşen hesap yok.</p>
            ) : (
              <div className="space-y-2">
                {users.map(user => (
                  <div
                    key={user.email}
                    className="rounded-xl border border-[#E4E1D9] p-3.5 space-y-2.5 bg-[#FAF9F5]"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#1E2430] break-all">
                            {user.email}
                          </span>
                          {user.isAdmin && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1E2430] text-white">
                              YÖNETİCİ
                            </span>
                          )}
                          {user.emailVerified ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#E9F3ED] text-[#35654E]">
                              DOĞRULANMIŞ
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FBF1DE] text-[#8A5A18]">
                              BEKLİYOR
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#687080] mt-0.5">
                          {user.name || 'İsimsiz'}
                          {user.city ? ` · ${user.city}` : ''} · {user.authProvider} · kayıt{' '}
                          {formatDate(user.createdAt)} · son görülme {formatDate(user.lastActive)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-[#687080]">
                      <span className="px-2 py-1 rounded-lg bg-white border border-[#E4E1D9]">
                        {user.counts.collections} set
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white border border-[#E4E1D9]">
                        {user.counts.customWords} kendi kelimesi
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white border border-[#E4E1D9]">
                        {user.counts.learningStates} çalışılan
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white border border-[#E4E1D9]">
                        {user.activeSessions} oturum
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white border border-[#E4E1D9]">
                        yedek {formatBytes(user.backupBytes)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#EFECE6]">
                      {!user.emailVerified && (
                        <button
                          type="button"
                          disabled={busyEmail === user.email}
                          onClick={() => void runAction(user.email, 'verify')}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#E9F3ED] text-[#35654E] hover:bg-[#DCEDE3] cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Elle doğrula
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyEmail === user.email || user.activeSessions === 0}
                        onClick={() => void runAction(user.email, 'revoke-sessions')}
                        className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#F1EFE8] text-[#1E2430] hover:bg-[#E4E1D9] cursor-pointer disabled:opacity-40 flex items-center gap-1"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Oturumları kapat
                      </button>
                      {!user.isAdmin && (
                        <button
                          type="button"
                          disabled={busyEmail === user.email}
                          onClick={() => {
                            setDeleteTarget(user);
                            setDeleteConfirm('');
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#FAECEA] text-[#C65D55] hover:bg-[#F6DFDC] cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Hesabı sil
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => void load(query.trim())}
              className="text-[11px] font-semibold text-[#4F46A5] hover:text-[#433B91] cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Yenile
            </button>
          </div>
        </>
      ) : null}

      {/*
        Silme onayı. E-postanın birebir yazılması istenir — sunucu da aynı
        şeyi ayrıca doğrular. Geri alınamaz bir işlemin tek tıkla olmaması
        gerekiyor.
      */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[#1E2430]/40 backdrop-blur-xs overflow-y-auto overscroll-contain">
          <div className="bg-[#FFFFFF] rounded-2xl max-w-md w-full border border-[#E4E1D9] shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-bold text-[#1E2430]">Hesabı sil</h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1.5 text-[#8E95A2] hover:text-[#1E2430] rounded-lg cursor-pointer"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#687080] leading-relaxed">
              <b className="text-[#1E2430]">{deleteTarget.email}</b> hesabı ve bulut
              yedeği kalıcı olarak silinecek. Bu işlem geri alınamaz. Onaylamak için
              e-posta adresini aşağıya birebir yaz.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={deleteTarget.email}
              className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-white focus:outline-none focus:border-[#C65D55] text-[#1E2430]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-[#687080] hover:bg-[#F1EFE8] rounded-xl cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={
                  deleteConfirm.trim().toLowerCase() !== deleteTarget.email.toLowerCase() ||
                  busyEmail === deleteTarget.email
                }
                onClick={() => void confirmDelete()}
                className="px-4 py-2 bg-[#C65D55] hover:bg-[#B04E47] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Kalıcı olarak sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
