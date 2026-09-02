import React from 'react';
import { Collection } from '../../types';

/**
 * Bir kelime setinin görünüm ve sıralama seçenekleri.
 *
 * NEDEN AYRI BİR BİLEŞEN. Bu dört alan yalnızca DÜZENLEME penceresinde
 * vardı; yeni set oluştururken kullanıcıdan sadece ad ve açıklama isteniyor,
 * rengi ve simgeyi seçebilmek için seti önce kurup sonra düzenlemesi
 * gerekiyordu. Aynı işi iki adımda yaptırmak, seçeneği hiç sunmamaktan da
 * kötü: kullanıcı özelliğin var olduğunu ancak tesadüfen öğreniyordu.
 *
 * Alanlar iki pencerede de aynı görünmeli ve aynı davranmalı; bu yüzden tek
 * yerde duruyorlar. İkisine ayrı ayrı yazılsalardı biri değiştiğinde diğeri
 * sessizce geride kalırdı.
 */

export interface DeckOptionValues {
  color?: string;
  iconName?: string;
  sortMode?: Collection['sortMode'];
  isPinned?: boolean;
}

interface Props {
  deger: DeckOptionValues;
  degistir: (yeni: DeckOptionValues) => void;
  renkler: { id: string; label: string; hex: string }[];
  simgeler: { id: string; label: string; Icon: React.ElementType }[];
}

export const DeckOptionFields: React.FC<Props> = ({ deger, degistir, renkler, simgeler }) => (
  <>
    <div>
      <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1.5">
        Renk
      </label>
      <div className="flex flex-wrap gap-2">
        {renkler.map(renk => (
          <button
            key={renk.id}
            type="button"
            onClick={() => degistir({ ...deger, color: renk.id })}
            title={renk.label}
            aria-label={renk.label}
            aria-pressed={(deger.color || 'indigo') === renk.id}
            className={`w-8 h-8 rounded-xl transition-transform cursor-pointer ${
              (deger.color || 'indigo') === renk.id
                ? 'ring-2 ring-offset-2 ring-[var(--text-primary)] scale-105'
                : 'hover:scale-105'
            }`}
            style={{ background: renk.hex }}
          />
        ))}
      </div>
    </div>

    <div>
      <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1.5">
        Simge
      </label>
      <div className="flex flex-wrap gap-2">
        {simgeler.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => degistir({ ...deger, iconName: id })}
            title={label}
            aria-label={label}
            aria-pressed={(deger.iconName || 'Layers') === id}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
              (deger.iconName || 'Layers') === id
                ? 'bg-[var(--text-primary)] text-[var(--bg)] border-[var(--text-primary)]'
                : 'bg-[var(--bg)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">
        Kelime Sırası
      </label>
      <select
        value={deger.sortMode || 'added'}
        onChange={e => degistir({ ...deger, sortMode: e.target.value as Collection['sortMode'] })}
        className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl font-semibold text-[var(--text-primary)]"
      >
        <option value="added">Eklediğim sıraya göre</option>
        <option value="alphabetical">Alfabetik (A–Z)</option>
        <option value="level">Seviyeye göre (kolaydan zora)</option>
        <option value="date">Tarihe göre (en yeni üstte)</option>
        <option value="status">Öğrenme durumuna göre</option>
      </select>
      <p className="text-[11px] text-[var(--text-muted)] mt-1">
        Sıra yalnızca görünümü değiştirir; kelimeler silinmez.
      </p>
    </div>

    <label className="flex items-center gap-2 pt-1 cursor-pointer">
      <input
        type="checkbox"
        checked={!!deger.isPinned}
        onChange={e => degistir({ ...deger, isPinned: e.target.checked })}
        className="accent-[var(--primary)] cursor-pointer"
      />
      <span className="text-xs font-semibold text-[var(--text-primary)]">
        Listenin başına sabitle
      </span>
    </label>
  </>
);
