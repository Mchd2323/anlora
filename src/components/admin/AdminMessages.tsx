import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone, Inbox, Trash2, Check, Eye, BellRing, Mail, Send } from 'lucide-react';
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

  /*
   * Anlık bildirim ve e-posta.
   *
   * İkisi de sunucuda anahtar isteyen özellikler; anahtar yoksa arayüz
   * bunu baştan söyler ve düğmeyi kapatır. Sahte bir "gönderildi" mesajı
   * vermek, gitmemiş bir duyuruyu gitmiş sanmak demek.
   */
  const [pushInfo, setPushInfo] = useState<{
    configured: boolean;
    devices: { total: number; signedIn: number; wantAnnouncements: number; wantReminders: number };
    sends: { at: string; title: string; audience: string; sent: number; failed: number }[];
  } | null>(null);
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushTopic, setPushTopic] = useState<'announcements' | 'reminders'>('announcements');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState('');

  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null);
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailTestTo, setMailTestTo] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [ann, fb, push, health] = await Promise.all([
        apiFetch<{ announcements: Announcement[] }>('/api/admin/announcements'),
        apiFetch<{ feedback: Feedback[]; newCount: number }>(
          `/api/admin/feedback${statusFilter ? `?status=${statusFilter}` : ''}`
        ),
        apiFetch<any>('/api/admin/push'),
        apiFetch<{ mailConfigured: boolean }>('/api/health')
      ]);
      setAnnouncements(ann.announcements);
      setFeedback(fb.feedback);
      setNewCount(fb.newCount);
      setPushInfo(push);
      setMailConfigured(!!health.mailConfigured);
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

      {/* Anlık bildirim */}
      <Card className="space-y-3">
        <SectionTitle icon={<BellRing className="w-3.5 h-3.5" />}>
          Anlık bildirim
          {pushInfo && (
            <span className="font-normal normal-case tracking-normal text-[var(--text-secondary)] ml-1">
              · {pushInfo.devices.total} cihaz
            </span>
          )}
        </SectionTitle>

        {pushInfo && !pushInfo.configured ? (
          <Notice tone="warn">
            <b>Henüz yapılandırılmadı.</b> Firebase hizmet hesabı anahtarı sunucuda{' '}
            <code>ANLORA_FCM_SERVICE_ACCOUNT</code> olarak tanımlanmalı. Cihazlar şimdiden
            kaydoluyor; anahtar geldiğinde birikmiş cihazlara gönderim yapılabilir.
          </Notice>
        ) : (
          pushInfo && (
            <p className="text-[11px] text-[var(--text-secondary)]">
              {pushInfo.devices.wantAnnouncements} cihaz duyuru,{' '}
              {pushInfo.devices.wantReminders} cihaz hatırlatma almak istiyor.{' '}
              {pushInfo.devices.signedIn} tanesi giriş yapmış hesaba bağlı.
            </p>
          )
        )}

        <Field label="Başlık">
          <input
            type="text"
            value={pushTitle}
            onChange={e => setPushTitle(e.target.value)}
            placeholder="Örn: Yeni sürüm yayında"
            className={inputClass}
          />
        </Field>
        <Field label="Mesaj" hint="Bildirim çubuğunda kısa görünür; iki satırı geçmesin.">
          <textarea
            value={pushBody}
            onChange={e => setPushBody(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>

        {/* Önizleme: gönderilmeden önce nasıl görüneceği */}
        {(pushTitle || pushBody) && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Önizleme
            </p>
            <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2.5 flex gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                A
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                  {pushTitle || 'Başlık'}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">
                  {pushBody || 'Mesaj metni'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={pushTopic}
            onChange={e => setPushTopic(e.target.value as 'announcements' | 'reminders')}
            className={`${inputClass} w-44`}
          >
            <option value="announcements">Duyuru</option>
            <option value="reminders">Hatırlatma</option>
          </select>
          <select
            value={audience}
            onChange={e => setAudience(e.target.value as 'all' | 'verified')}
            className={`${inputClass} w-52`}
          >
            <option value="all">Bildirimi açan herkese</option>
            <option value="verified">Yalnızca doğrulanmış hesaplara</option>
          </select>
          <Button
            tone="primary"
            disabled={sending || !pushInfo?.configured || !pushTitle.trim() || !pushBody.trim()}
            onClick={async () => {
              setSending(true);
              setSendResult('');
              try {
                const result = await apiFetch<{ sent: number; failed: number; message?: string }>(
                  '/api/admin/push/send',
                  {
                    method: 'POST',
                    body: JSON.stringify({ title: pushTitle, body: pushBody, audience, topic: pushTopic })
                  }
                );
                setSendResult(
                  result.message || `${result.sent} cihaza gönderildi, ${result.failed} başarısız.`
                );
                setPushTitle('');
                setPushBody('');
                await load();
              } catch (err: any) {
                setSendResult(err?.message || 'Gönderilemedi.');
              } finally {
                setSending(false);
              }
            }}
          >
            <Send className="w-3.5 h-3.5" /> {sending ? 'Gönderiliyor…' : 'Bildirimi gönder'}
          </Button>
        </div>

        {sendResult && <Notice tone="ok">{sendResult}</Notice>}

        <Notice tone="warn">
          Kullanıcının tercihi her zaman önce gelir: "herkese" seçsen bile o türü kapatmış
          cihaza gönderilmez.
        </Notice>

        {pushInfo && pushInfo.sends.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Son gönderimler
            </p>
            {pushInfo.sends.slice(0, 5).map((item, i) => (
              <div
                key={`${item.at}-${i}`}
                className="flex items-center justify-between gap-2 text-[11px] px-3 py-1.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)]"
              >
                <span className="text-[var(--text-primary)] truncate">{item.title}</span>
                <span className="text-[var(--text-muted)] shrink-0 tabular-nums">
                  {item.sent} ✓ {item.failed > 0 && `· ${item.failed} ✕`} · {formatDate(item.at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* E-posta */}
      <Card className="space-y-3">
        <SectionTitle icon={<Mail className="w-3.5 h-3.5" />}>E-posta gönder</SectionTitle>

        {mailConfigured === false && (
          <Notice tone="warn">
            <b>Henüz yapılandırılmadı.</b> Sunucuda <code>RESEND_API_KEY</code> ve{' '}
            <code>ANLORA_MAIL_FROM</code> tanımlanmalı. Şu an doğrulama kodları yalnızca
            sunucu günlüğüne yazılıyor — yani hesap açan kullanıcılar kodlarını alamıyor.
          </Notice>
        )}

        <Field label="Konu">
          <input
            type="text"
            value={mailSubject}
            onChange={e => setMailSubject(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Mesaj" hint="Basit HTML kullanabilirsin: <b>, <p>, <a href>.">
          <textarea
            value={mailBody}
            onChange={e => setMailBody(e.target.value)}
            rows={5}
            className={inputClass}
          />
        </Field>
        <Field
          label="Önce kendine dene"
          hint="Yanlış yazılmış bir posta geri alınamaz. Önce buraya kendi adresini yazıp dene."
        >
          <input
            type="email"
            value={mailTestTo}
            onChange={e => setMailTestTo(e.target.value)}
            placeholder="senin@adresin.com"
            className={inputClass}
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={sending || !mailConfigured || !mailSubject.trim() || !mailBody.trim() || !mailTestTo.trim()}
            onClick={async () => {
              setSending(true);
              setSendResult('');
              try {
                await apiFetch('/api/admin/email/send', {
                  method: 'POST',
                  body: JSON.stringify({ subject: mailSubject, body: mailBody, testTo: mailTestTo })
                });
                setSendResult(`Deneme ${mailTestTo} adresine gönderildi.`);
              } catch (err: any) {
                setSendResult(err?.message || 'Gönderilemedi.');
              } finally {
                setSending(false);
              }
            }}
          >
            Deneme gönder
          </Button>
          <Button
            tone="primary"
            disabled={sending || !mailConfigured || !mailSubject.trim() || !mailBody.trim()}
            onClick={async () => {
              setSending(true);
              setSendResult('');
              try {
                const result = await apiFetch<{ sent: number; failed: number; message?: string }>(
                  '/api/admin/email/send',
                  { method: 'POST', body: JSON.stringify({ subject: mailSubject, body: mailBody }) }
                );
                setSendResult(
                  result.message || `${result.sent} kişiye gönderildi, ${result.failed} başarısız.`
                );
                setMailSubject('');
                setMailBody('');
              } catch (err: any) {
                setSendResult(err?.message || 'Gönderilemedi.');
              } finally {
                setSending(false);
              }
            }}
          >
            <Send className="w-3.5 h-3.5" /> Doğrulanmış herkese gönder
          </Button>
        </div>

        <Notice tone="warn">
          Yalnızca <b>doğrulanmış</b> hesaplara gider. Doğrulanmamış adres ya yanlış
          yazılmıştır ya da başkasına aittir; oraya posta göndermek spam şikâyeti demek.
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
