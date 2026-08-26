import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, Flag, Trash2, Upload, Search, Gauge } from 'lucide-react';
import { apiFetch } from '../../utils/authClient';
import { Card, SectionTitle, StatTile, Notice, Button, formatDate } from './shared';

/**
 * Yapay zekâ ve üretim merkezi.
 *
 * ARAMA SIRASI (uygulama + sunucu birlikte)
 *   1. Oxford çekirdeği  2. Genel Dağarcık  3. Üretilmiş içerik (bu önbellek)
 *   4. Yapay zekâ (kota içinde)  5. Sonuç önbelleğe yazılır
 *   6. Aynı kelime için bir daha çağrı yapılmaz
 *
 * Bu ekran 3, 5 ve 6. adımları yönetir: neyin üretildiği, kaç çağrının
 * önlendiği, hangi kartın onaylanıp sözlüğe alınacağı.
 */

interface AiPanel {
  cache: {
    size: number;
    approved: number;
    flagged: number;
    hits: number;
    callsAvoided: number;
    hitRate: number;
  };
  quota: {
    dailyLimit: number;
    perUserLimit: number;
    usedToday: number;
    configured: boolean;
  };
  topMisses: { word: string; count: number }[];
  recent: {
    word: string;
    approved: boolean;
    flagged: boolean;
    hits: number;
    createdAt: string;
    turkishMeaning: string;
  }[];
}

export const AdminAI: React.FC = () => {
  const [data, setData] = useState<AiPanel | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await apiFetch<AiPanel>('/api/admin/ai'));
    } catch (err: any) {
      setError(err?.message || 'Veriler alınamadı.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (word: string, path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) => {
    setBusy(word);
    setError('');
    try {
      await apiFetch(`/api/admin/ai/${path}`, {
        method,
        body: body ? JSON.stringify(body) : undefined
      });
      await load();
    } catch (err: any) {
      setError(err?.message || 'İşlem tamamlanamadı.');
    } finally {
      setBusy(null);
    }
  };

  if (error && !data) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-xs text-[var(--text-secondary)] py-8 text-center">Yükleniyor…</p>;

  const quotaPercent = Math.min(
    100,
    Math.round((data.quota.usedToday / Math.max(1, data.quota.dailyLimit)) * 100)
  );

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}

      {/* Önbellek */}
      <Card className="space-y-4">
        <SectionTitle icon={<Sparkles className="w-3.5 h-3.5" />}>
          Üretilmiş içerik önbelleği
        </SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Önlenen çağrı" value={data.cache.callsAvoided} tone="accent" />
          <StatTile
            label="İsabet oranı"
            value={`%${Math.round(data.cache.hitRate * 100)}`}
            hint={`${data.cache.hits} isabet`}
          />
          <StatTile
            label="Önbellekteki kart"
            value={data.cache.size}
            hint={`${data.cache.approved} onaylı`}
          />
          <StatTile
            label="İşaretli"
            value={data.cache.flagged}
            hint="kalitesiz bulunan"
          />
        </div>
        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
          Aynı kelime ikinci kez sorulduğunda yapay zekâya gidilmez; yanıt buradan
          gelir. "Önlenen çağrı" bu sayede yapılmayan istek sayısıdır.
        </p>
      </Card>

      {/* Kota */}
      <Card className="space-y-3">
        <SectionTitle icon={<Gauge className="w-3.5 h-3.5" />}>Günlük kota</SectionTitle>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)]">
            <span>
              Bugün <b className="text-[var(--text-primary)] tabular-nums">{data.quota.usedToday}</b> /{' '}
              {data.quota.dailyLimit} yeni üretim
            </span>
            <span className="tabular-nums">%{quotaPercent}</span>
          </div>
          <div className="h-2 w-full bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                quotaPercent > 85 ? 'bg-[var(--danger)]' : 'bg-[var(--primary)]'
              }`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
        </div>
        <Notice tone="warn">
          Kullanıcı başına günlük sınır <b>{data.quota.perUserLimit}</b> yeni üretim.
          <b> Kelime eklemek sınırsızdır</b> — sınır yalnızca yeni yapay zekâ üretimine
          uygulanır; kota dolduğunda kullanıcı kelimeyi elle ekleyebilir. Sınırları
          sunucuda <code>ANLORA_AI_DAILY_QUOTA</code> ve{' '}
          <code>ANLORA_AI_USER_DAILY_QUOTA</code> ile değiştirebilirsin.
          {!data.quota.configured && (
            <>
              {' '}Şu an <b>GEMINI_API_KEY</b> tanımlı değil; yeni üretim kapalı, yalnızca
              önbellekten yanıt veriliyor.
            </>
          )}
        </Notice>
      </Card>

      {/* Aranıp bulunamayanlar */}
      <Card className="space-y-3">
        <SectionTitle icon={<Search className="w-3.5 h-3.5" />}>
          En çok aranıp bulunamayan kelimeler
        </SectionTitle>
        {data.topMisses.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-6 text-center">
            Henüz kayıt yok. Kullanıcılar sözlükte olmayan bir kelime aradığında burada
            görünür.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              İnsanların istediği ama elimizde olmayan kelimeler. Sözlük sekmesinden
              ekleyebilir ya da CSV ile topluca yükleyebilirsin.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.topMisses.map(item => (
                <span
                  key={item.word}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)] text-[11px]"
                >
                  <b className="text-[var(--text-primary)]">{item.word}</b>
                  <span className="text-[var(--text-muted)] tabular-nums">{item.count}×</span>
                  <button
                    type="button"
                    onClick={() => void act(item.word, `misses/${encodeURIComponent(item.word)}`, 'DELETE')}
                    className="text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                    aria-label={`${item.word} kaydını listeden çıkar`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Üretilmiş kartlar */}
      <Card className="space-y-3">
        <SectionTitle>Son üretilen kartlar</SectionTitle>
        {data.recent.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-6 text-center">
            Henüz yapay zekâ ile üretilmiş kart yok.
          </p>
        ) : (
          <div className="space-y-2">
            {data.recent.map(item => (
              <div
                key={item.word}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{item.word}</span>
                    {item.approved && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--learned-soft)] text-[var(--learned-text)]">
                        ONAYLI
                      </span>
                    )}
                    {item.flagged && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--danger-soft)] text-[var(--danger)]">
                        KALİTESİZ
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
                      {item.hits}× kullanıldı · {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">
                    {item.turkishMeaning || '(anlam yok)'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Button
                    disabled={busy === item.word}
                    onClick={async () => {
                      await act(item.word, `cache/${encodeURIComponent(item.word)}/publish`, 'POST');
                      setNotice(`"${item.word}" sözlüğe yayınlandı.`);
                    }}
                  >
                    <Upload className="w-3.5 h-3.5" /> Sözlüğe al
                  </Button>
                  <Button
                    disabled={busy === item.word}
                    onClick={() =>
                      void act(item.word, `cache/${encodeURIComponent(item.word)}`, 'PATCH', {
                        approved: !item.approved
                      })
                    }
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {item.approved ? 'Onayı kaldır' : 'Onayla'}
                  </Button>
                  <Button
                    disabled={busy === item.word}
                    onClick={() =>
                      void act(item.word, `cache/${encodeURIComponent(item.word)}`, 'PATCH', {
                        flagged: !item.flagged
                      })
                    }
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    tone="danger"
                    disabled={busy === item.word}
                    onClick={() => void act(item.word, `cache/${encodeURIComponent(item.word)}`, 'DELETE')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
          Kalitesiz bir kartı <b>silmek</b>, o kelime için bir sonraki istekte yeniden
          üretilmesini sağlar; düzeltmenin yolu budur. <b>Sözlüğe al</b> ise kartı
          kalıcı sözlük kaydına çevirir ve uygulamaya doğrudan indirir.
        </p>
      </Card>
    </div>
  );
};
