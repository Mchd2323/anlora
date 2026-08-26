import React, { useCallback, useEffect, useState } from 'react';
import { Users, Sparkles, TrendingDown, Activity } from 'lucide-react';
import { apiFetch } from '../../utils/authClient';
import { Card, SectionTitle, StatTile, BarSeries, Notice } from './shared';

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
  ai: { total: number; today: number; daily: { day: string; count: number }[]; configured: boolean };
  server: { googleSignInConfigured: boolean; adminCount: number };
}

interface Stats {
  opens: { day: string; count: number }[];
  dailyActiveUsers: { day: string; count: number }[];
  hardestWords: { id: string; correct: number; wrong: number; attempts: number; wrongRate: number }[];
  trackedWords: number;
}

export const AdminOverview: React.FC = () => {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [ov, st] = await Promise.all([
        apiFetch<Overview>('/api/admin/overview'),
        apiFetch<Stats>('/api/admin/stats')
      ]);
      setOverview(ov);
      setStats(st);
    } catch (err: any) {
      setError(err?.message || 'Özet alınamadı.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!overview || !stats) return <p className="text-xs text-[var(--text-secondary)] py-8 text-center">Yükleniyor…</p>;

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <SectionTitle icon={<Users className="w-3.5 h-3.5" />}>Hesaplar</SectionTitle>
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
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <SectionTitle icon={<Activity className="w-3.5 h-3.5" />}>
            Günlük aktif kullanıcı · son 14 gün
          </SectionTitle>
          <BarSeries data={stats.dailyActiveUsers} label="Günlük aktif kullanıcı sayısı" color="#1F6F6B" />
          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
            Yalnızca hesabı olan ve o gün uygulamayı kullanan kişiler sayılır. Aşağıdaki açılış
            sayacı ise hesapsız kullanımı da içerir ve kimlik toplamaz.
          </p>
          <BarSeries data={stats.opens} label="Günlük uygulama açılışı" color="#8E95A2" />
        </Card>

        <Card className="space-y-3">
          <SectionTitle icon={<Sparkles className="w-3.5 h-3.5" />}>
            Yapay zekâ istekleri · son 14 gün
          </SectionTitle>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Bugün <b className="text-[var(--text-primary)]">{overview.ai.today}</b> · toplam{' '}
            <b className="text-[var(--text-primary)]">{overview.ai.total}</b>
          </p>
          <BarSeries data={overview.ai.daily} label="Günlük yapay zekâ istek sayısı" />
          {!overview.ai.configured && (
            <Notice tone="warn">
              Sunucuda <b>GEMINI_API_KEY</b> tanımlı değil; yapay zekâ üretimi kapalı.
            </Notice>
          )}
        </Card>
      </div>

      <Card className="space-y-3">
        <SectionTitle icon={<TrendingDown className="w-3.5 h-3.5" />}>
          En çok zorlanılan kelimeler
        </SectionTitle>
        {stats.hardestWords.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-6 text-center">
            Henüz yeterli veri yok. En az beş kez çalışılmış kelimeler burada listelenir.
          </p>
        ) : (
          <div className="space-y-1.5">
            {stats.hardestWords.map(word => (
              <div
                key={word.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2"
              >
                <span className="text-xs font-bold text-[var(--text-primary)] flex-1 truncate">{word.id}</span>
                <div className="w-24 h-1.5 rounded-full bg-[var(--border)] overflow-hidden shrink-0">
                  <div
                    className="h-full bg-[var(--danger)] rounded-full"
                    style={{ width: `${Math.round(word.wrongRate * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-[var(--danger)] tabular-nums w-10 text-right">
                  %{Math.round(word.wrongRate * 100)}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] tabular-nums w-16 text-right">
                  {word.attempts} deneme
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
          Ölçüt yanlış <b>oranı</b>, ham yanlış sayısı değil: çok çalışılan bir kelime doğal olarak
          çok yanlış toplar. Yalnızca en az beş deneme görmüş kelimeler sıralanır. Kimin yanlış
          yaptığı toplanmaz.
        </p>
      </Card>
    </div>
  );
};
