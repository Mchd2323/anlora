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
      <label className="block text-xs font-bold text-[var(--text-secondary)]  mb-1.5">
        Renk
      </label>
      <div className="flex flex-wrap gap-1">
        {renkler.map(renk => (
          <button
            key={renk.id}
            type="button"
            onClick={() => degistir({ ...deger, color: renk.id })}
            title={renk.label}
            aria-label={renk.label}
            aria-pressed={(deger.color || 'indigo') === renk.id}
            className="flex items-center justify-center w-11 h-11 cursor-pointer"
          >
            {/*
              Basılabilir kutu 44 piksel, görünen arma 32. Örneği doğrudan
              düğmenin kendisi olarak çizersek ya parmağa küçük gelir ya da
              44'e uzayıp kare olmaktan çıkardı; ikisi de olmasın diye görsel
              parça içeride duruyor.
            */}
            <span
              aria-hidden="true"
              className={`hanedan-kapak w-8 h-8 rounded-xl transition-transform ${
                (deger.color || 'indigo') === renk.id
                  ? 'ring-2 ring-offset-2 ring-[var(--text-primary)] scale-105'
                  : 'hover:scale-105'
              }`}
              style={{ '--hanedan': renk.hex } as React.CSSProperties}
            />
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="block text-xs font-bold text-[var(--text-secondary)]  mb-1.5">
        Simge
      </label>
      <div className="flex flex-wrap gap-1">
        {simgeler.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => degistir({ ...deger, iconName: id })}
            title={label}
            aria-label={label}
            aria-pressed={(deger.iconName || 'Layers') === id}
            className="flex items-center justify-center w-11 h-11 cursor-pointer"
          >
            <span
              className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors ${
                (deger.iconName || 'Layers') === id
                  ? 'bg-[var(--text-primary)] text-[var(--bg)] border-[var(--text-primary)]'
                  : 'bg-[var(--bg)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-soft)]'
              }`}
            >
              <Icon className="w-4 h-4" />
            </span>
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="block text-xs font-bold text-[var(--text-secondary)]  mb-1">
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
        Öne çıkar
      </span>
    </label>

    {/*
      METİN GERÇEĞE UYGUN OLMALI.

      Kutucuk eskiden "Listenin başına sabitle" diyordu ama sıralamayı hiç
      değiştirmiyordu: sıra artık bilinçli olarak elle veriliyor (setin ⋮
      menüsündeki yukarı/aşağı taşı). Yapmadığı şeyi vaat eden bir ayar,
      kullanıcıyı ayarın bozuk olduğuna inandırır.
    */}
    <p className="text-[11px] text-[var(--text-muted)] -mt-1">
      Sete 📌 işareti koyar. Sırayı değiştirmez; sıra için setin ⋮ menüsündeki
      “Yukarı taşı / Aşağı taşı”.
    </p>
  </>
);
