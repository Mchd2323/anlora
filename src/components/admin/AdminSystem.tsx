import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Server, Download, Upload, ShieldAlert, ScrollText, HeartPulse, Wrench } from 'lucide-react';
import { apiFetch, getSessionToken } from '../../utils/authClient';
import { apiUrl } from '../../config/api';
import { Card, SectionTitle, StatTile, Notice, Button, Field, inputClass, formatDate, formatBytes } from './shared';

/**
 * Sistem yönetimi ve güvenlik.
 *
 * BAKIM MODU uygulamayı kapatmaz: çevrimdışı çalışan bir sözlüğü sebepsiz
 * erişilemez kılmak yanlış olurdu. Kapanan yalnızca sunucuya YAZAN uçlardır;
 * okuma sürer, yönetici çalışmaya devam eder.
 *
 * GERİ YÜKLEME öncesinde otomatik güvenlik kopyası alınır. Yanlış dosyayı
 * yükleyen yönetici o an ayakta olan veriyi de kaybederse felaket olur.
 */

interface SystemInfo {
  maintenance: { enabled: boolean; message?: string; since?: string };
  features: Record<string, boolean>;
  backups: { name: string; bytes: number; at: string }[];
  failedLogins: { email: string; count: number; lastAt: string; ips: string[] }[];
  auditLog: { at: string; actor: string; action: string; target?: string; detail?: string }[];
}

interface Health {
  ok: boolean;
  uptimeSeconds: number;
  dataWritable: boolean;
  maintenance: boolean;
  users: number;
  dictionaryWords: number;
  aiConfigured: boolean;
  version: string;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} sn`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} dk`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} sa`;
  return `${Math.round(seconds / 86400)} gün`;
}

export const AdminSystem: React.FC = () => {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [sys, hp] = await Promise.all([
        apiFetch<SystemInfo>('/api/admin/system'),
        apiFetch<Health>('/api/health')
      ]);
      setInfo(sys);
      setHealth(hp);
      setMaintenanceMessage(sys.maintenance.message || '');
    } catch (err: any) {
      setError(err?.message || 'Sistem bilgileri alınamadı.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleMaintenance = async (enabled: boolean) => {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/admin/system/maintenance', {
        method: 'PUT',
        body: JSON.stringify({ enabled, message: maintenanceMessage })
      });
      setNotice(enabled ? 'Bakım modu açıldı.' : 'Bakım modu kapatıldı.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Değiştirilemedi.');
    } finally {
      setBusy(false);
    }
  };

  const takeBackup = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await apiFetch<{ name: string }>('/api/admin/system/backup', { method: 'POST' });
      setNotice(`Yedek alındı: ${result.name}`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Yedek alınamadı.');
    } finally {
      setBusy(false);
    }
  };

  const downloadBackup = () => {
    /*
     * İndirme isteğinin jetonu taşıması gerekiyor; düz bir bağlantı başlık
     * gönderemez. İçerik önce alınıp geçici bir blob bağlantısıyla iniyor.
     */
    const token = getSessionToken();
    fetch(apiUrl('/api/admin/system/backup/download'), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    })
      .then(response => response.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `anlora-yedek-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError('Yedek indirilemedi.'));
  };

  const restoreFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      setError('');
      try {
        const backup = JSON.parse(String(reader.result || '{}'));
        const result = await apiFetch<{ safetyCopy: string }>('/api/admin/system/restore', {
          method: 'POST',
          body: JSON.stringify({ backup })
        });
        setNotice(
          `Geri yüklendi. Önceki durumun kopyası: ${result.safetyCopy}. ` +
            'Bütün oturumlar kapandı; yeniden giriş yapman gerekiyor.'
        );
      } catch (err: any) {
        setError(err?.message || 'Geri yükleme başarısız.');
      } finally {
        setBusy(false);
      }
    };
    reader.onerror = () => setError('Dosya okunamadı.');
    reader.readAsText(file);
  };

  if (error && !info) return <Notice tone="error">{error}</Notice>;
  if (!info || !health) return <p className="text-xs text-[var(--text-secondary)] py-8 text-center">Yükleniyor…</p>;

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}

      {/* Sağlık */}
      <Card className="space-y-4">
        <SectionTitle icon={<HeartPulse className="w-3.5 h-3.5" />}>Sistem sağlığı</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            label="Durum"
            value={health.ok ? 'Sağlıklı' : 'Sorunlu'}
            tone={health.ok ? 'accent' : 'plain'}
            hint={health.dataWritable ? 'disk yazılabilir' : 'DİSK YAZILAMIYOR'}
          />
          <StatTile label="Çalışma süresi" value={formatUptime(health.uptimeSeconds)} />
          <StatTile label="Hesap" value={health.users} hint={`${health.dictionaryWords} sözlük kaydı`} />
          <StatTile
            label="Yapay zekâ"
            value={health.aiConfigured ? 'Açık' : 'Kapalı'}
            hint={health.aiConfigured ? 'anahtar tanımlı' : 'GEMINI_API_KEY yok'}
          />
        </div>
      </Card>

      {/* Bakım modu */}
      <Card className="space-y-3">
        <SectionTitle icon={<Wrench className="w-3.5 h-3.5" />}>Bakım modu</SectionTitle>
        <Notice tone={info.maintenance.enabled ? 'warn' : 'ok'}>
          {info.maintenance.enabled ? (
            <>
              <b>Bakım modu açık</b> ({formatDate(info.maintenance.since)}). Kullanıcılar
              uygulamayı açabiliyor ve çevrimdışı çalışmaya devam ediyor; yalnızca sunucuya
              yazan işlemler (kayıt, geri bildirim, paylaşım, yapay zekâ) kapalı. Sen
              yönetici olarak etkilenmiyorsun.
            </>
          ) : (
            <>
              Bakım modu kapalı. Açtığında uygulama <b>kapanmaz</b>; yalnızca sunucuya yazan
              işlemler durur, çevrimdışı çalışma sürer.
            </>
          )}
        </Notice>

        <Field label="Kullanıcıya gösterilecek mesaj" hint="Boş bırakırsan varsayılan metin kullanılır.">
          <input
            type="text"
            value={maintenanceMessage}
            onChange={e => setMaintenanceMessage(e.target.value)}
            placeholder="Kısa bir bakım yapıyoruz, birazdan döneceğiz."
            className={inputClass}
          />
        </Field>

        <Button
          tone={info.maintenance.enabled ? 'primary' : 'danger'}
          disabled={busy}
          onClick={() => void toggleMaintenance(!info.maintenance.enabled)}
        >
          {info.maintenance.enabled ? 'Bakım modunu kapat' : 'Bakım moduna al'}
        </Button>
      </Card>

      {/* Yedekleme */}
      <Card className="space-y-3">
        <SectionTitle icon={<Server className="w-3.5 h-3.5" />}>Yedekleme</SectionTitle>
        <Notice tone="warn">
          Yedek dosyası <b>parola özetlerini de içerir</b> — hesaplar onsuz taşınamaz. Dosyayı
          gizli tut, herkese açık bir yere koyma. Geri yüklemeden önce o anki durumun
          kopyası otomatik alınır.
        </Notice>

        <div className="flex flex-wrap gap-2">
          <Button tone="primary" disabled={busy} onClick={() => void takeBackup()}>
            <Server className="w-3.5 h-3.5" /> Sunucuda yedek al
          </Button>
          <Button disabled={busy} onClick={downloadBackup}>
            <Download className="w-3.5 h-3.5" /> Yedeği indir
          </Button>
          <Button disabled={busy} onClick={() => restoreInputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" /> Yedekten geri yükle
          </Button>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) restoreFromFile(file);
              e.target.value = '';
            }}
          />
        </div>

        {info.backups.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Sunucudaki yedekler (son 20)
            </p>
            {info.backups.slice(0, 8).map(backup => (
              <div
                key={backup.name}
                className="flex items-center justify-between gap-3 text-[11px] px-3 py-1.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)]"
              >
                <span className="font-mono text-[var(--text-primary)] truncate">{backup.name}</span>
                <span className="text-[var(--text-muted)] shrink-0 tabular-nums">
                  {formatBytes(backup.bytes)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Başarısız girişler */}
      <Card className="space-y-3">
        <SectionTitle icon={<ShieldAlert className="w-3.5 h-3.5" />}>
          Başarısız giriş denemeleri
        </SectionTitle>
        {info.failedLogins.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-4 text-center">Kayıt yok.</p>
        ) : (
          <div className="space-y-1">
            {info.failedLogins.map(item => (
              <div
                key={item.email}
                className="flex items-center justify-between gap-3 text-[11px] px-3 py-2 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)]"
              >
                <span className="font-semibold text-[var(--text-primary)] truncate">{item.email}</span>
                <span className="text-[var(--text-muted)] shrink-0 tabular-nums">
                  {item.count}× · {formatDate(item.lastAt)}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
          Aynı hesapta yoğunlaşan denemeler, parola tahmini girişimine işaret edebilir. Giriş
          uçları ayrıca dakikada 12 denemeyle sınırlı.
        </p>
      </Card>

      {/* İşlem günlüğü */}
      <Card className="space-y-3">
        <SectionTitle icon={<ScrollText className="w-3.5 h-3.5" />}>
          Yönetici işlem günlüğü
        </SectionTitle>
        {info.auditLog.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-4 text-center">Henüz işlem yok.</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {info.auditLog.map((entry, i) => (
              <div
                key={`${entry.at}-${i}`}
                className="text-[11px] px-3 py-2 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)]"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {entry.action}
                    {entry.target && <span className="text-[var(--text-secondary)]"> · {entry.target}</span>}
                  </span>
                  <span className="text-[var(--text-muted)] shrink-0 tabular-nums">
                    {formatDate(entry.at)}
                  </span>
                </div>
                <div className="text-[var(--text-muted)]">{entry.actor}</div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
          Yalnızca yönetici işlemleri kaydedilir; sıradan kullanım izlenmez. Yetkiyi paylaşan
          iki kişi varsa "ben yapmadım" tartışmasının tek çözümü kayıttır.
        </p>
      </Card>
    </div>
  );
};
