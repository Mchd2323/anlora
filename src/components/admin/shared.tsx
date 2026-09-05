import React from 'react';

/**
 * Yönetim panelinin ortak parçaları.
 *
 * Panel altı ayrı ekrandan oluşuyor ve hepsi aynı kutu, etiket ve düğme
 * biçimini kullanıyor. Bunları tek yerde tutmak, ekranlar arasında görsel
 * kaymayı yapısal olarak engelliyor.
 */

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <div className={`bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] ${className}`}>
    {children}
  </div>
);

export const SectionTitle: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children
}) => (
  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
    {icon}
    {children}
  </h3>
);

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
      {label}
    </label>
    {children}
    {hint && <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-relaxed">{hint}</p>}
  </div>
);

export const inputClass =
  'w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl ' +
  'focus:bg-white focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]';

export const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  tone?: 'primary' | 'quiet' | 'danger' | 'teal';
  disabled?: boolean;
  className?: string;
}> = ({ children, onClick, type = 'button', tone = 'quiet', disabled, className = '' }) => {
  const tones: Record<string, string> = {
    primary: 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)]',
    teal: 'bg-[var(--teal)] hover:bg-[var(--teal-hover)] text-[var(--surface)]',
    quiet: 'bg-[var(--surface-soft)] hover:bg-[var(--border)] text-[var(--text-primary)]',
    danger: 'bg-[var(--danger-soft)] hover:bg-[var(--danger-soft-hover)] text-[var(--danger)]'
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer
                  disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5
                  ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
};

export const Notice: React.FC<{ tone: 'error' | 'ok' | 'warn'; children: React.ReactNode }> = ({
  tone,
  children
}) => {
  const tones = {
    error: 'bg-[var(--danger-soft)] border-[var(--danger-border)] text-[var(--danger)]',
    ok: 'bg-[var(--learned-soft)] border-[var(--learned-border)] text-[var(--learned-text)]',
    warn: 'bg-[var(--learning-soft)] border-[var(--learning-border)] text-[var(--learning-text)]'
  };
  return (
    <div className={`p-3 rounded-xl border text-[11px] leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  );
};

/**
 * Zaman serisi çubukları.
 *
 * Tek seri olduğu için açıklama kutusu yok — başlık neyi gösterdiğini
 * söylüyor. Her çubuğa sayı yazılmaz; yalnızca en yüksek gün ve son gün
 * etiketlenir, gerisi üzerine gelince görünür.
 */
export const BarSeries: React.FC<{
  data: { day: string; count: number }[];
  label: string;
  color?: string;
}> = ({ data, label, color = '#15283D' }) => {
  const max = Math.max(1, ...data.map(d => d.count));
  const peak = data.reduce((best, d, i) => (d.count > data[best].count ? i : best), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-[3px] h-20" role="img" aria-label={label}>
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          return (
            <div key={d.day} className="flex-1 flex flex-col justify-end items-center gap-1 group relative">
              {(i === peak || isLast) && d.count > 0 && (
                <span className="text-[9px] font-bold text-[var(--text-secondary)] tabular-nums">{d.count}</span>
              )}
              <div
                className="w-full rounded-t-[4px] transition-opacity"
                style={{
                  height: `${Math.max((d.count / max) * 100, d.count > 0 ? 6 : 2)}%`,
                  background: color,
                  opacity: isLast ? 1 : 0.42
                }}
              />
              <span
                className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap
                           rounded-lg bg-[var(--text-primary)] px-2 py-1 text-[10px] font-semibold text-[var(--bg)] opacity-0
                           group-hover:opacity-100 transition-opacity z-10"
              >
                {d.day.slice(5)} · {d.count}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-medium">
        <span>{data[0]?.day.slice(5)}</span>
        <span>bugün</span>
      </div>
    </div>
  );
};

export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'plain' | 'accent';
}> = ({ label, value, hint, tone = 'plain' }) => (
  <div
    className={`rounded-xl border p-3.5 ${
      tone === 'accent' ? 'bg-[var(--primary-soft)] border-[var(--primary-border)]' : 'bg-[var(--bg)] border-[var(--border)]'
    }`}
  >
    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
    <div className="text-2xl font-bold text-[var(--text-primary)] mt-1 tabular-nums">{value}</div>
    {hint && <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{hint}</div>}
  </div>
);

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
