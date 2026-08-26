import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone, Inbox, Trash2, Check, Eye } from 'lucide-react';
import { apiFetch } from '../../utils/authClient';
import { Card, Field, inputClass, Button, Notice, SectionTitle, formatDate } from './shared';

/**
 * Duyurular ve gelen bildirimler.
 *
 * İkisi aynı ekranda çünkü aynı sohbetin iki yönü: yöneticiden kullanıcıya
 * giden mesaj ve kullanıcıdan gelen bildirim.
 */

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'verified';
  active: boolean;
  createdAt: string;
}

interface Feedback {
  id: string;
  kind: string;
  message: string;
  word?: string;
  email?: string;
  replyTo?: string;
  platform?: string;
  status: 'new' | 'read' | 'resolved';
  adminNote?: string;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = {
  word: 'Kelime hatası',
  design: 'Tasarım',
  bug: 'Hata',
  idea: 'Öneri',
  other: 'Diğer'
};

const STATUS_LABEL: Record<string, string> = {
  new: 'Yeni',
  read: 'Okundu',
  resolved: 'Çözüldü'
};

export const AdminMessages: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'verified'>('all');

  const load = useCallback(async () => {
    setError('');
    try {
      const [ann, fb] = await Promise.all([
        apiFetch<{ announcements: Announcement[] }>('/api/admin/announcements'),
        apiFetch<{ feedback: Feedback[]; newCount: number }>(
          `/api/admin/feedback${statusFilter ? `?status=${statusFilter}` : ''}`
        )
      ]);
      setAnnouncements(ann.announcements);
      setFeedback(fb.feedback);
      setNewCount(fb.newCount);
    } catch (err: any) {
      setError(err?.message || 'Veriler alınamadı.');
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async () => {
    if (!title.trim() || !body.trim()) return;
    try {
      await apiFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, body, audience })
      });
      setTitle('');
      setBody('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Duyuru yayınlanamadı.');
    }
  };

  const toggleAnnouncement = async (item: Announcement) => {
    try {
      await apiFetch(`/api/admin/announcements/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !item.active })
      });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Güncellenemedi.');
    }
  };

  const removeAnnouncement = async (id: string) => {
    try {
      await apiFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Silinemedi.');
    }
  };

  const setFeedbackStatus = async (item: Feedback, status: Feedback['status']) => {
    try {
      await apiFetch(`/api/admin/feedback/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Güncellenemedi.');
    }
  };

  const removeFeedback = async (id: string) => {
    try {
      await apiFetch(`/api/admin/feedback/${id}`, { method: 'DELETE' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Silinemedi.');
    }
  };

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}

      {/* Yeni duyuru */}
      <Card className="space-y-3">
        <SectionTitle icon={<Megaphone className="w-3.5 h-3.5" />}>Yeni duyuru</SectionTitle>
        <Field label="Başlık">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Örn: Yeni sürüm yayında"
            className={inputClass}
          />
        </Field>
        <Field label="Mesaj">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={3}
            placeholder="Kullanıcıların uygulamada göreceği metin…"
            className={inputClass}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={audience}
            onChange={e => setAudience(e.target.value as 'all' | 'verified')}
            className={`${inputClass} w-48`}
          >
            <option value="all">Herkese</option>
            <option value="verified">Yalnızca doğrulanmış hesaplara</option>
          </select>
          <Button tone="primary" onClick={() => void publish()} disabled={!title.trim() || !body.trim()}>
            Yayınla
          </Button>
        </div>
        <Notice tone="warn">
          Duyurular uygulama içinde görünür. Telefonun bildirim çubuğuna düşen{' '}
          <b>push bildirimi</b> ayrı bir altyapı ister (Firebase projesi ve APK'ya gömülen anahtar);
          o hazır olduğunda buradaki duyurular aynı yerden gönderilebilir.
        </Notice>
      </Card>

      {/* Duyuru listesi */}
      {announcements.length > 0 && (
        <Card className="space-y-2">
          <SectionTitle>Yayınlanmış duyurular</SectionTitle>
          {announcements.map(item => (
            <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{item.title}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        item.active
                          ? 'bg-[var(--learned-soft)] text-[var(--learned-text)]'
                          : 'bg-[var(--surface-soft)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {item.active ? 'YAYINDA' : 'KAPALI'}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {item.audience === 'verified' ? 'doğrulanmışlara' : 'herkese'} ·{' '}
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1">{item.body}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button onClick={() => void toggleAnnouncement(item)}>
                    {item.active ? 'Kapat' : 'Aç'}
                  </Button>
                  <Button tone="danger" onClick={() => void removeAnnouncement(item.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Gelen bildirimler */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={<Inbox className="w-3.5 h-3.5" />}>
            Gelen bildirimler {newCount > 0 && <span className="text-[var(--danger)]">· {newCount} yeni</span>}
          </SectionTitle>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className={`${inputClass} w-40`}
          >
            <option value="">Tümü</option>
            <option value="new">Yeni</option>
            <option value="read">Okundu</option>
            <option value="resolved">Çözüldü</option>
          </select>
        </div>

        {feedback.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-6 text-center">Bildirim yok.</p>
        ) : (
          <div className="space-y-2">
            {feedback.map(item => (
              <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--primary-soft)] text-[var(--primary)]">
                    {KIND_LABEL[item.kind] || item.kind}
                  </span>
                  {item.word && (
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">"{item.word}"</span>
                  )}
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      item.status === 'new'
                        ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                        : item.status === 'resolved'
                        ? 'bg-[var(--learned-soft)] text-[var(--learned-text)]'
                        : 'bg-[var(--surface-soft)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">{formatDate(item.createdAt)}</span>
                </div>

                <p className="text-xs text-[var(--text-primary)] leading-relaxed">{item.message}</p>

                {(item.email || item.replyTo) && (
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {item.email && <>hesap: {item.email}</>}
                    {item.replyTo && <> · yanıt için: {item.replyTo}</>}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border-light)]">
                  {item.status !== 'read' && (
                    <Button onClick={() => void setFeedbackStatus(item, 'read')}>
                      <Eye className="w-3.5 h-3.5" /> Okundu
                    </Button>
                  )}
                  {item.status !== 'resolved' && (
                    <Button onClick={() => void setFeedbackStatus(item, 'resolved')}>
                      <Check className="w-3.5 h-3.5" /> Çözüldü
                    </Button>
                  )}
                  <Button tone="danger" onClick={() => void removeFeedback(item.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
