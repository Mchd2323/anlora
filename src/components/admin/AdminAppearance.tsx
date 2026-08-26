import React, { useCallback, useEffect, useState } from 'react';
import { Palette, MonitorSmartphone } from 'lucide-react';
import { apiFetch } from '../../utils/authClient';
import { Card, Field, inputClass, Button, Notice, SectionTitle } from './shared';

/**
 * Marka metinleri, uygulama içi logo ve reklam alanları.
 *
 * REKLAM ALANLARI SABİTTİR. Yönetici yeni bir yer icat edemez; uygulamada
 * önceden belirlenmiş dört noktayı doldurur ya da boş bırakır. Boş bırakılan
 * alan arayüzde HİÇ ÇİZİLMEZ — reklamsız uygulamada boşluk ya da "reklam
 * alanı" yazısı görünmez.
 */

interface AdSlot {
  id: string;
  label: string;
  html: string;
  enabled: boolean;
  updatedAt: string | null;
}

interface Branding {
  logoDataUri?: string;
  appName?: string;
  slogan?: string;
  homeIntro?: string;
  setsIntro?: string;
  lookupTitle?: string;
  lookupBody?: string;
}

export const AdminAppearance: React.FC = () => {
  const [slots, setSlots] = useState<AdSlot[]>([]);
  const [branding, setBranding] = useState<Branding>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [ads, brand] = await Promise.all([
        apiFetch<{ slots: AdSlot[] }>('/api/admin/ads'),
        apiFetch<{ branding: Branding }>('/api/admin/branding')
      ]);
      setSlots(ads.slots);
      setBranding(brand.branding || {});
    } catch (err: any) {
      setError(err?.message || 'Ayarlar alınamadı.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSlot = async (slot: AdSlot) => {
    setError('');
    try {
      await apiFetch(`/api/admin/ads/${slot.id}`, {
        method: 'PUT',
        body: JSON.stringify({ html: slot.html, enabled: slot.enabled })
      });
      setNotice(`"${slot.label}" kaydedildi.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Kaydedilemedi.');
    }
  };

  const saveBranding = async () => {
    setError('');
    try {
      await apiFetch('/api/admin/branding', {
        method: 'PUT',
        body: JSON.stringify(branding)
      });
      setNotice('Marka bilgileri kaydedildi. Uygulamalar bir sonraki açılışta görecek.');
    } catch (err: any) {
      setError(err?.message || 'Kaydedilemedi.');
    }
  };

  const uploadLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setBranding(prev => ({ ...prev, logoDataUri: String(reader.result || '') }));
    reader.onerror = () => setError('Logo okunamadı.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}

      {/* Marka */}
      <Card className="space-y-3">
        <SectionTitle icon={<Palette className="w-3.5 h-3.5" />}>Marka ve metinler</SectionTitle>
        <Notice tone="warn">
          Boş bıraktığın alan uygulamanın kendi varsayılanını kullanır. Telefonun ana ekranındaki{' '}
          <b>başlatıcı ikonu</b> buradan değişmez: o, APK'ya derleme anında gömülür.
        </Notice>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Uygulama adı">
            <input
              type="text"
              value={branding.appName || ''}
              onChange={e => setBranding({ ...branding, appName: e.target.value })}
              placeholder="Anlora"
              className={inputClass}
            />
          </Field>
          <Field label="Slogan">
            <input
              type="text"
              value={branding.slogan || ''}
              onChange={e => setBranding({ ...branding, slogan: e.target.value })}
              placeholder="Heh, şimdi anlorum!"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Ana sayfa tanıtım metni">
          <textarea
            value={branding.homeIntro || ''}
            onChange={e => setBranding({ ...branding, homeIntro: e.target.value })}
            rows={3}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Kelime setleri açıklaması">
            <textarea
              value={branding.setsIntro || ''}
              onChange={e => setBranding({ ...branding, setsIntro: e.target.value })}
              rows={2}
              className={inputClass}
            />
          </Field>
          <Field label="Sözlük kutusu başlığı">
            <input
              type="text"
              value={branding.lookupTitle || ''}
              onChange={e => setBranding({ ...branding, lookupTitle: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Sözlük kutusu metni">
          <textarea
            value={branding.lookupBody || ''}
            onChange={e => setBranding({ ...branding, lookupBody: e.target.value })}
            rows={2}
            className={inputClass}
          />
        </Field>

        <Field label="Uygulama içi logo" hint="PNG, JPEG, WEBP ya da SVG · en fazla 200 KB">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) uploadLogo(file);
              }}
              className="text-[11px] text-[var(--text-secondary)]"
            />
            {branding.logoDataUri && (
              <>
                <img
                  src={branding.logoDataUri}
                  alt="Yüklenen logo"
                  className="w-9 h-9 rounded-lg object-contain border border-[var(--border)] bg-white"
                />
                <Button
                  tone="danger"
                  onClick={() => setBranding({ ...branding, logoDataUri: '' })}
                >
                  Kaldır
                </Button>
              </>
            )}
          </div>
        </Field>

        <Button tone="primary" onClick={() => void saveBranding()}>
          Marka bilgilerini kaydet
        </Button>
      </Card>

      {/* Reklam alanları */}
      <Card className="space-y-3">
        <SectionTitle icon={<MonitorSmartphone className="w-3.5 h-3.5" />}>
          Reklam alanları
        </SectionTitle>
        <Notice tone="warn">
          Kod eklemediğin ya da kapattığın alan uygulamada <b>hiç görünmez</b> — boşluk bile
          bırakmaz. Buraya yazdığın kod uygulamada aynen çalışır; yalnızca güvendiğin reklam
          ağlarının verdiği kodu yapıştır.
        </Notice>

        {slots.map((slot, index) => (
          <div key={slot.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-[var(--text-primary)]">{slot.label}</span>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={slot.enabled}
                  onChange={e => {
                    const next = [...slots];
                    next[index] = { ...slot, enabled: e.target.checked };
                    setSlots(next);
                  }}
                  className="accent-[var(--primary)] cursor-pointer"
                />
                Açık
              </label>
            </div>
            <textarea
              value={slot.html}
              onChange={e => {
                const next = [...slots];
                next[index] = { ...slot, html: e.target.value };
                setSlots(next);
              }}
              rows={3}
              placeholder="Reklam ağının verdiği gömme kodu…"
              className={`${inputClass} font-mono`}
            />
            <Button onClick={() => void saveSlot(slots[index])}>Kaydet</Button>
          </div>
        ))}
      </Card>
    </div>
  );
};
