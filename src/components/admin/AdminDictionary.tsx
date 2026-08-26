import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Trash2, Pencil, Upload, Download, Image, Volume2, X } from 'lucide-react';
import { apiFetch, getSessionToken } from '../../utils/authClient';
import { apiUrl } from '../../config/api';
import { Card, Field, inputClass, Button, Notice, SectionTitle } from './shared';

/**
 * Sözlük yönetimi.
 *
 * Buradaki kelimeler Oxford verisinden AYRI bir katmandır. Oxford salt
 * okunurdur çünkü kaynağı resmî listelerdir ve kullanıcı ilerlemesi onun
 * kararlı kimliklerine bağlıdır; panelden düzenlenebilir yapmak altındaki
 * zemini oynatmak olurdu. Yönetici kelimeleri kendi kimlikleriyle durur ve
 * aramada Oxford'la birlikte bulunur.
 */

interface AdminSense {
  partOfSpeech: string;
  turkishMeanings: string[];
  examples: { en: string; tr: string }[];
}

interface AdminWord {
  id: string;
  word: string;
  phonetic?: string;
  level?: string;
  topics: string[];
  examTags: string[];
  senses: AdminSense[];
  imageUrl?: string;
  audioUrl?: string;
  status: 'draft' | 'published';
  updatedAt: string;
}

const EMPTY_WORD = (): AdminWord => ({
  id: '',
  word: '',
  phonetic: '',
  level: '',
  topics: [],
  examTags: [],
  senses: [{ partOfSpeech: 'n.', turkishMeanings: [''], examples: [{ en: '', tr: '' }] }],
  status: 'published',
  updatedAt: ''
});

const LEVELS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const POS_OPTIONS = ['n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'phrase'];

/** Dosyayı data URI'ye çevirir; yükleme ucu bu biçimi bekliyor. */
function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
}

export const AdminDictionary: React.FC = () => {
  const [words, setWords] = useState<AdminWord[]>([]);
  const [counts, setCounts] = useState({ total: 0, publishedCount: 0, draftCount: 0 });
  const [topics, setTopics] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<AdminWord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (query.trim()) params.set('q', query.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (topicFilter) params.set('topic', topicFilter);

      const data = await apiFetch<{
        total: number;
        publishedCount: number;
        draftCount: number;
        topics: string[];
        words: AdminWord[];
      }>(`/api/admin/dictionary?${params.toString()}`);

      setWords(data.words);
      setCounts({
        total: data.total,
        publishedCount: data.publishedCount,
        draftCount: data.draftCount
      });
      setTopics(data.topics);
    } catch (err: any) {
      setError(err?.message || 'Sözlük alınamadı.');
    }
  }, [query, statusFilter, topicFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 300);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        ...editing,
        senses: editing.senses.map(sense => ({
          ...sense,
          turkishMeanings: sense.turkishMeanings.map(m => m.trim()).filter(Boolean),
          examples: sense.examples.filter(ex => ex.en.trim() && ex.tr.trim())
        }))
      };

      if (editing.id) {
        await apiFetch(`/api/admin/dictionary/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/admin/dictionary', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setEditing(null);
      setNotice(editing.id ? 'Kelime güncellendi.' : 'Kelime eklendi.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (word: AdminWord) => {
    setError('');
    try {
      await apiFetch(`/api/admin/dictionary/${word.id}`, { method: 'DELETE' });
      setNotice(`"${word.word}" silindi.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Silinemedi.');
    }
  };

  const upload = async (kind: 'image' | 'audio', file: File) => {
    if (!editing) return;
    setError('');
    try {
      const dataUri = await readFileAsDataUri(file);
      const result = await apiFetch<{ url: string }>('/api/admin/upload', {
        method: 'POST',
        body: JSON.stringify({ kind, dataUri })
      });
      setEditing(prev =>
        prev ? { ...prev, [kind === 'image' ? 'imageUrl' : 'audioUrl']: result.url } : prev
      );
    } catch (err: any) {
      setError(err?.message || 'Dosya yüklenemedi.');
    }
  };

  const runImport = async () => {
    setError('');
    try {
      const result = await apiFetch<{
        added: number;
        updated: number;
        skipped: number;
        problems: string[];
      }>('/api/admin/dictionary/import', {
        method: 'POST',
        body: JSON.stringify({ csv: importText })
      });
      setNotice(
        `${result.added} eklendi, ${result.updated} güncellendi` +
          (result.skipped ? `, ${result.skipped} satır atlandı.` : '.')
      );
      if (result.problems.length) setError(result.problems.slice(0, 5).join(' · '));
      setImportText('');
      setShowImport(false);
      await load();
    } catch (err: any) {
      setError(err?.message || 'İçe aktarılamadı.');
    }
  };

  const exportCsv = () => {
    /*
     * Dosya indirmesi için jetonun istekle birlikte gitmesi gerekiyor; düz
     * bir bağlantı başlık taşıyamaz. Bu yüzden içerik önce alınıp geçici bir
     * blob bağlantısı üzerinden indiriliyor.
     */
    const token = getSessionToken();
    fetch(apiUrl('/api/admin/dictionary/export.csv'), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    })
      .then(response => response.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'anlora-sozluk.csv';
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError('Dışa aktarılamadı.'));
  };

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>
            Sözlük · {counts.total} kayıt
            <span className="font-normal text-[var(--text-secondary)] normal-case tracking-normal ml-1">
              ({counts.publishedCount} yayında, {counts.draftCount} taslak)
            </span>
          </SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            <Button tone="primary" onClick={() => setEditing(EMPTY_WORD())}>
              <Plus className="w-3.5 h-3.5" /> Kelime ekle
            </Button>
            <Button onClick={() => setShowImport(true)}>
              <Upload className="w-3.5 h-3.5" /> CSV yükle
            </Button>
            <Button onClick={exportCsv}>
              <Download className="w-3.5 h-3.5" /> CSV indir
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Kelime ya da anlam ara…"
              className={`${inputClass} pl-9`}
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputClass}>
            <option value="">Tüm durumlar</option>
            <option value="published">Yayında</option>
            <option value="draft">Taslak</option>
          </select>
          <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)} className={inputClass}>
            <option value="">Tüm konular</option>
            {topics.map(topic => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </div>

        {words.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-8 text-center">
            Henüz kelime yok. "Kelime ekle" ile başlayabilir ya da CSV yükleyebilirsin.
          </p>
        ) : (
          <div className="space-y-2">
            {words.map(word => (
              <div key={word.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[var(--text-primary)]">{word.word}</span>
                      {word.phonetic && (
                        <span className="text-[11px] font-mono text-[var(--text-secondary)]">{word.phonetic}</span>
                      )}
                      {word.level && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--primary-soft)] text-[var(--primary)]">
                          {word.level}
                        </span>
                      )}
                      {word.status === 'draft' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--learning-soft)] text-[var(--learning-text)]">
                          TASLAK
                        </span>
                      )}
                      {word.imageUrl && <Image className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                      {word.audioUrl && <Volume2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      {word.senses
                        .map(s => `${s.partOfSpeech} ${s.turkishMeanings.join(', ')}`)
                        .join(' · ')}
                    </p>
                    {(word.topics.length > 0 || word.examTags.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[...word.topics, ...word.examTags].map(tag => (
                          <span
                            key={tag}
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white border border-[var(--border)] text-[var(--text-secondary)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button onClick={() => setEditing(word)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button tone="danger" onClick={() => void remove(word)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* CSV yükleme */}
      {showImport && (
        <Card className="space-y-3">
          <SectionTitle>CSV ile toplu yükleme</SectionTitle>
          <Notice tone="warn">
            Sütunlar: <b>kelime; telaffuz; seviye; konular; sinavlar; tur; anlamlar; ornek1_en;
            ornek1_tr; …; durum</b>. Birden çok anlam için aynı kelimeyi birden çok satıra yaz —
            anlamlar birleştirilir. Anlamları ve etiketleri <b>|</b> ile ayır. Var olan kelime
            güncellenir. Önce "CSV indir" ile örnek dosyayı alabilirsin.
          </Notice>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            rows={8}
            placeholder={'kelime;seviye;tur;anlamlar\nthrive;B2;v.;gelişmek|serpilmek'}
            className={`${inputClass} font-mono`}
          />
          <div className="flex gap-2">
            <Button tone="primary" onClick={() => void runImport()} disabled={!importText.trim()}>
              Yükle
            </Button>
            <Button onClick={() => setShowImport(false)}>Vazgeç</Button>
          </div>
        </Card>
      )}

      {/* Kelime düzenleme */}
      {editing && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionTitle>{editing.id ? 'Kelimeyi düzenle' : 'Yeni kelime'}</SectionTitle>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
              aria-label="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="İngilizce kelime">
              <input
                type="text"
                value={editing.word}
                onChange={e => setEditing({ ...editing, word: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Telaffuz (IPA)">
              <input
                type="text"
                value={editing.phonetic || ''}
                onChange={e => setEditing({ ...editing, phonetic: e.target.value })}
                placeholder="/θraɪv/"
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field label="Seviye" hint="Emin değilsen boş bırak.">
              <select
                value={editing.level || ''}
                onChange={e => setEditing({ ...editing, level: e.target.value })}
                className={inputClass}
              >
                {LEVELS.map(level => (
                  <option key={level} value={level}>
                    {level || 'Belirtme'}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Konular" hint="Virgülle ayır: iş, tıp, günlük hayat">
              <input
                type="text"
                value={editing.topics.join(', ')}
                onChange={e =>
                  setEditing({
                    ...editing,
                    topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })
                }
                className={inputClass}
              />
            </Field>
            <Field label="Sınav etiketleri" hint="Virgülle ayır: YDS, YÖKDİL, IELTS">
              <input
                type="text"
                value={editing.examTags.join(', ')}
                onChange={e =>
                  setEditing({
                    ...editing,
                    examTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })
                }
                className={inputClass}
              />
            </Field>
          </div>

          {/* Anlamlar */}
          <div className="space-y-3">
            {editing.senses.map((sense, si) => (
              <div key={si} className="rounded-xl border border-[var(--border)] p-3 space-y-2.5 bg-[var(--surface-subtle)]">
                <div className="flex items-center gap-2">
                  <select
                    value={sense.partOfSpeech}
                    onChange={e => {
                      const senses = [...editing.senses];
                      senses[si] = { ...sense, partOfSpeech: e.target.value };
                      setEditing({ ...editing, senses });
                    }}
                    className={`${inputClass} w-28`}
                  >
                    {POS_OPTIONS.map(pos => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                  {editing.senses.length > 1 && (
                    <Button
                      tone="danger"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          senses: editing.senses.filter((_, i) => i !== si)
                        })
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Anlamı sil
                    </Button>
                  )}
                </div>

                <Field label="Türkçe karşılıklar" hint="Virgülle ayır">
                  <input
                    type="text"
                    value={sense.turkishMeanings.join(', ')}
                    onChange={e => {
                      const senses = [...editing.senses];
                      senses[si] = {
                        ...sense,
                        turkishMeanings: e.target.value.split(',').map(m => m.trim())
                      };
                      setEditing({ ...editing, senses });
                    }}
                    className={inputClass}
                  />
                </Field>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Örnek cümleler
                  </label>
                  {sense.examples.map((ex, ei) => (
                    <div key={ei} className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={ex.en}
                        onChange={e => {
                          const senses = [...editing.senses];
                          const examples = [...sense.examples];
                          examples[ei] = { ...ex, en: e.target.value };
                          senses[si] = { ...sense, examples };
                          setEditing({ ...editing, senses });
                        }}
                        placeholder="İngilizce cümle"
                        className={inputClass}
                      />
                      <input
                        type="text"
                        value={ex.tr}
                        onChange={e => {
                          const senses = [...editing.senses];
                          const examples = [...sense.examples];
                          examples[ei] = { ...ex, tr: e.target.value };
                          senses[si] = { ...sense, examples };
                          setEditing({ ...editing, senses });
                        }}
                        placeholder="Türkçe çevirisi"
                        className={inputClass}
                      />
                    </div>
                  ))}
                  {sense.examples.length < 6 && (
                    <button
                      type="button"
                      onClick={() => {
                        const senses = [...editing.senses];
                        senses[si] = { ...sense, examples: [...sense.examples, { en: '', tr: '' }] };
                        setEditing({ ...editing, senses });
                      }}
                      className="text-[11px] font-semibold text-[var(--primary)] cursor-pointer"
                    >
                      + Örnek ekle
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setEditing({
                  ...editing,
                  senses: [
                    ...editing.senses,
                    { partOfSpeech: 'n.', turkishMeanings: [''], examples: [{ en: '', tr: '' }] }
                  ]
                })
              }
              className="text-[11px] font-semibold text-[var(--primary)] cursor-pointer"
            >
              + Sözcük türü ekle
            </button>
          </div>

          {/* Medya */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Görsel" hint="PNG, JPEG, WEBP ya da SVG · en fazla 800 KB">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void upload('image', file);
                  }}
                  className="text-[11px] text-[var(--text-secondary)] w-full"
                />
                {editing.imageUrl && (
                  <img
                    src={apiUrl(editing.imageUrl)}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover border border-[var(--border)]"
                  />
                )}
              </div>
            </Field>
            <Field label="Ses" hint="MP3, M4A, OGG ya da WAV · en fazla 2 MB">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void upload('audio', file);
                  }}
                  className="text-[11px] text-[var(--text-secondary)] w-full"
                />
                {editing.audioUrl && <Volume2 className="w-4 h-4 text-[var(--learned)]" />}
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-light)]">
            <select
              value={editing.status}
              onChange={e =>
                setEditing({ ...editing, status: e.target.value as 'draft' | 'published' })
              }
              className={`${inputClass} w-36`}
            >
              <option value="published">Yayında</option>
              <option value="draft">Taslak</option>
            </select>
            <Button tone="primary" onClick={() => void save()} disabled={isSaving || !editing.word.trim()}>
              {isSaving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
            <Button onClick={() => setEditing(null)}>Vazgeç</Button>
          </div>
        </Card>
      )}
    </div>
  );
};
