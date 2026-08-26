import React, { useCallback, useEffect, useState } from 'react';
import { Search, CheckCircle2, LogOut, Trash2, Ban, Undo2, X } from 'lucide-react';
import { apiFetch } from '../../utils/authClient';
import { Card, Field, inputClass, Button, Notice, SectionTitle, formatDate, formatBytes } from './shared';

/**
 * Hesap yönetimi.
 *
 * GİZLİLİK SINIRI: sunucu bilerek yalnızca sayı ve meta veri döndürür.
 * Yönetici hesabı yönetebilir ama insanların hangi kelimeyi çalıştığını
 * göremez.
 */

interface AdminUser {
  email: string;
  name: string;
  country: string;
  city: string;
  authProvider: string;
  emailVerified: boolean;
  isAdmin: boolean;
  banned: boolean;
  bannedReason: string;
  createdAt: string | null;
  lastActive: string | null;
  activeSessions: number;
  hasPendingVerification: boolean;
  backupBytes: number;
  counts: { collections: number; customWords: number; favorites: number; learningStates: number };
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState('');

  const load = useCallback(async (search: string) => {
    setError('');
    try {
      const data = await apiFetch<{ total: number; users: AdminUser[] }>(
        `/api/admin/users?limit=50&q=${encodeURIComponent(search)}`
      );
      setUsers(data.users);
      setTotal(data.total);
    } catch (err: any) {
      setError(err?.message || 'Kullanıcılar alınamadı.');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  const act = async (email: string, path: string, body?: unknown) => {
    setBusy(email);
    setError('');
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(email)}/${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined
      });
      await load(query.trim());
    } catch (err: any) {
      setError(err?.message || 'İşlem tamamlanamadı.');
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(deleteTarget.email);
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
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}

      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SectionTitle>Kullanıcılar {total > 0 && <span className="text-[var(--text-secondary)]">({total})</span>}</SectionTitle>
          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="E-posta ya da ad ara…"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        {users.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-8 text-center">Eşleşen hesap yok.</p>
        ) : (
          <div className="space-y-2">
            {users.map(user => (
              <div key={user.email} className="rounded-xl border border-[var(--border)] p-3.5 space-y-2.5 bg-[var(--surface-subtle)]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[var(--text-primary)] break-all">{user.email}</span>
                    {user.isAdmin && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--text-primary)] text-white">YÖNETİCİ</span>
                    )}
                    {user.banned && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--danger-soft)] text-[var(--danger)]">ENGELLİ</span>
                    )}
                    {user.emailVerified ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--learned-soft)] text-[var(--learned-text)]">DOĞRULANMIŞ</span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--learning-soft)] text-[var(--learning-text)]">BEKLİYOR</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {user.name || 'İsimsiz'}
                    {user.city ? ` · ${user.city}` : ''}
                    {user.country ? `, ${user.country}` : ''} · {user.authProvider} · kayıt{' '}
                    {formatDate(user.createdAt)} · son görülme {formatDate(user.lastActive)}
                  </p>
                  {user.banned && user.bannedReason && (
                    <p className="text-[11px] text-[var(--danger)] mt-0.5">Engel sebebi: {user.bannedReason}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                  <span className="px-2 py-1 rounded-lg bg-white border border-[var(--border)]">{user.counts.collections} set</span>
                  <span className="px-2 py-1 rounded-lg bg-white border border-[var(--border)]">{user.counts.customWords} kendi kelimesi</span>
                  <span className="px-2 py-1 rounded-lg bg-white border border-[var(--border)]">{user.counts.learningStates} çalışılan</span>
                  <span className="px-2 py-1 rounded-lg bg-white border border-[var(--border)]">{user.activeSessions} oturum</span>
                  <span className="px-2 py-1 rounded-lg bg-white border border-[var(--border)]">yedek {formatBytes(user.backupBytes)}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border-light)]">
                  {!user.emailVerified && (
                    <Button disabled={busy === user.email} onClick={() => void act(user.email, 'verify')}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Elle doğrula
                    </Button>
                  )}
                  <Button
                    disabled={busy === user.email || user.activeSessions === 0}
                    onClick={() => void act(user.email, 'revoke-sessions')}
                  >
                    <LogOut className="w-3.5 h-3.5" /> Oturumları kapat
                  </Button>
                  {!user.isAdmin &&
                    (user.banned ? (
                      <Button disabled={busy === user.email} onClick={() => void act(user.email, 'unban')}>
                        <Undo2 className="w-3.5 h-3.5" /> Engeli kaldır
                      </Button>
                    ) : (
                      <Button
                        tone="danger"
                        disabled={busy === user.email}
                        onClick={() => {
                          setBanTarget(user);
                          setBanReason('');
                        }}
                      >
                        <Ban className="w-3.5 h-3.5" /> Engelle
                      </Button>
                    ))}
                  {!user.isAdmin && (
                    <Button
                      tone="danger"
                      disabled={busy === user.email}
                      onClick={() => {
                        setDeleteTarget(user);
                        setDeleteConfirm('');
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Sil
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Engelleme */}
      {banTarget && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Hesabı engelle</SectionTitle>
            <button type="button" onClick={() => setBanTarget(null)} className="p-1.5 text-[var(--text-muted)] cursor-pointer" aria-label="Kapat">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <b className="text-[var(--text-primary)]">{banTarget.email}</b> giriş yapamaz ve açık oturumları
            kapanır. Engel <b>silme değildir</b>: verisi durur, istediğinde geri alabilirsin.
          </p>
          <Field label="Sebep" hint="Kullanıcıya giriş ekranında gösterilir.">
            <input
              type="text"
              value={banReason}
              onChange={e => setBanReason(e.target.value)}
              placeholder="Örn: Kötüye kullanım bildirimi"
              className={inputClass}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              tone="danger"
              onClick={async () => {
                await act(banTarget.email, 'ban', { reason: banReason });
                setBanTarget(null);
              }}
            >
              Engelle
            </Button>
            <Button onClick={() => setBanTarget(null)}>Vazgeç</Button>
          </div>
        </Card>
      )}

      {/* Silme */}
      {deleteTarget && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Hesabı kalıcı olarak sil</SectionTitle>
            <button type="button" onClick={() => setDeleteTarget(null)} className="p-1.5 text-[var(--text-muted)] cursor-pointer" aria-label="Kapat">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <b className="text-[var(--text-primary)]">{deleteTarget.email}</b> hesabı ve bulut yedeği kalıcı
            olarak silinecek. Geri alınamaz. Onaylamak için e-posta adresini birebir yaz.
          </p>
          <input
            type="text"
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            placeholder={deleteTarget.email}
            className={inputClass}
          />
          <div className="flex gap-2">
            <Button
              tone="danger"
              disabled={deleteConfirm.trim().toLowerCase() !== deleteTarget.email.toLowerCase()}
              onClick={() => void confirmDelete()}
            >
              Kalıcı olarak sil
            </Button>
            <Button onClick={() => setDeleteTarget(null)}>Vazgeç</Button>
          </div>
        </Card>
      )}
    </div>
  );
};
