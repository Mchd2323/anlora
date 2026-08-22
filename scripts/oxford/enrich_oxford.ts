/**
 * Oxford çekirdek verisindeki eksik Türkçe anlamları ve örnek cümleleri
 * geliştirme aşamasında üretir.
 *
 * NEDEN GEREKLİ
 * Veri kümesi resmî Oxford listelerinden yeniden kuruldu. Yapısal bilgi
 * (headword, CEFR, sözcük türü, qualifier, homograf, kaynak sırası) eksiksiz;
 * ancak kaynak listeler yalnızca kelimeleri verir, Türkçe karşılık ve örnek
 * cümle içermez. Mevcut uygulamadan güvenle taşınabilen içerik taşındı,
 * taşınamayanlar `needsReview` olarak işaretlendi.
 *
 * UYDURMA VERİ YAZILMAZ (talimat 59). Anlamı bilinmeyen bir kayda
 * "kelime (isim)" gibi bir yer tutucu yazmak yerine kayıt eksik bırakılır ve
 * bu betikle doldurulur.
 *
 * ÇALIŞMA ZAMANI BAĞIMLILIĞI YOKTUR (talimat 18). Bu betik yalnızca
 * geliştirme aşamasında çalışır; kullanıcı bir Oxford kelimesini açtığında
 * hiçbir yapay zekâ isteği yapılmaz.
 *
 * KULLANIM
 *     GEMINI_API_KEY=... npx tsx scripts/oxford/enrich_oxford.ts
 *     GEMINI_API_KEY=... npx tsx scripts/oxford/enrich_oxford.ts --limit 40
 *     GEMINI_API_KEY=... npx tsx scripts/oxford/enrich_oxford.ts --group C1
 *
 * Kontrol noktası tutar: yarıda kesilirse aynı komutla kaldığı yerden devam
 * eder ve tamamlanmış kayıtlar için tekrar istek yapmaz.
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

interface Example {
  en: string;
  tr: string;
}

interface Sense {
  id: string;
  partOfSpeech: string;
  turkishMeanings: string[];
  examples: Example[];
}

interface Entry {
  id: string;
  headword: string;
  qualifier?: string;
  homograph?: number;
  cefr: string;
  sourceCollection: string;
  sourceOrder: number;
  sourceEntry: string;
  senses: Sense[];
  legacyMeaning?: string;
  needsReview?: boolean;
  reviewReason?: string;
}

const ROOT = process.cwd();
const DATA_FILES = [
  path.join(ROOT, 'src/data/oxford3000.json'),
  path.join(ROOT, 'src/data/oxford5000extra.json'),
];
const CHECKPOINT_PATH = path.join(ROOT, '.batch_checkpoints/oxford_enrichment.json');

const BATCH_SIZE = 12;
const REQUIRED_EXAMPLES = 3;

/** CEFR seviyesine göre örnek cümle karmaşıklığı yönergesi (talimat 14). */
const LEVEL_GUIDANCE: Record<string, string> = {
  A1: 'Very short, everyday sentences. Simple present or past. No subordinate clauses.',
  A2: 'Short everyday sentences. Common vocabulary only.',
  B1: 'Natural intermediate sentences with everyday context.',
  B2: 'Natural sentences with richer context, still conversational.',
  C1: 'Natural, sophisticated sentences. Rich but NOT artificially academic.',
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

function isSenseComplete(sense: Sense): boolean {
  return sense.turkishMeanings.length > 0 && sense.examples.length >= REQUIRED_EXAMPLES;
}

function buildPrompt(entries: Entry[]): string {
  const payload = entries.map(entry => ({
    id: entry.id,
    headword: entry.headword,
    qualifier: entry.qualifier || null,
    cefr: entry.cefr,
    levelGuidance: LEVEL_GUIDANCE[entry.cefr] || LEVEL_GUIDANCE.B1,
    senses: entry.senses
      .filter(sense => !isSenseComplete(sense))
      .map(sense => ({
        id: sense.id,
        partOfSpeech: sense.partOfSpeech,
        existingMeanings: sense.turkishMeanings,
      })),
  }));

  return `You are an English–Turkish lexicographer preparing the Oxford core vocabulary for Turkish learners.

For every sense listed below, provide Turkish meanings and exactly ${REQUIRED_EXAMPLES} example sentences.

CRITICAL RULES
1. The part of speech decides the meaning. "firm n." means "firma, şirket"; "firm adj." means "sert, sağlam, kararlı". Never give a meaning that belongs to a different part of speech.
2. If a "qualifier" is given, it names the exact sense. "bank (money)" is the financial sense only; "bank (river)" is the riverside sense only. Do not mix them.
3. Each example must use the word in that exact part of speech and that exact sense.
4. Turkish meanings: natural modern Turkish, short, most common meaning first, 1–4 items. No rare dictionary senses. Never write placeholders like "kelime (isim)".
5. Example sentences must be real, natural usage. Never write sentences about the word itself ("Learning the word X is useful", "X is an important English word").
6. Match the CEFR level guidance given per entry.
7. The three examples must differ in structure, not be variations of one sentence.
8. "tr" is a fluent Turkish translation of that exact sentence, not a definition.
9. If you are not confident about a word's meaning, return an empty meanings array for it rather than guessing.

ENTRIES
${JSON.stringify(payload, null, 2)}

Return ONLY a JSON array, no prose:
[{"senseId": "...", "turkishMeanings": ["..."], "examples": [{"en": "...", "tr": "..."}]}]`;
}

/** Üretilen içeriği kabul etmeden önce denetler. */
function acceptSense(
  result: { turkishMeanings?: string[]; examples?: Example[] },
  headword: string
): { turkishMeanings: string[]; examples: Example[] } | null {
  const meanings = (result.turkishMeanings || [])
    .map(m => (m || '').trim())
    .filter(Boolean)
    .filter(m => !/\((isim|fiil|sıfat|zarf|anlam)\)|otomatik anlam|kelimesi/i.test(m));

  if (meanings.length === 0) return null;

  const stem = headword.trim().toLowerCase().split(/[\s,]+/)[0];
  const probe = stem.slice(0, Math.max(3, stem.length - 2));

  const examples = (result.examples || [])
    .map(example => ({
      en: (example?.en || '').trim(),
      tr: (example?.tr || '').trim(),
    }))
    .filter(example => example.en.length >= 10 && example.tr.length >= 4)
    .filter(example => !probe || example.en.toLowerCase().includes(probe))
    // Kelimenin kendisi hakkında konuşan sahte örnekleri ele (talimat 12).
    .filter(example => !/\b(the word|learning the word|is an important english word)\b/i.test(example.en));

  const unique: Example[] = [];
  const seen = new Set<string>();
  for (const example of examples) {
    const key = example.en.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(example);
  }

  if (unique.length < REQUIRED_EXAMPLES) return null;
  return { turkishMeanings: meanings, examples: unique.slice(0, REQUIRED_EXAMPLES) };
}

async function enrichBatch(
  ai: GoogleGenAI,
  batch: Entry[]
): Promise<Record<string, { turkishMeanings: string[]; examples: Example[] }>> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: buildPrompt(batch),
    config: { responseMimeType: 'application/json' },
  });

  const text = (response.text || '').trim().replace(/^```json\s*|\s*```$/g, '');
  let parsed: Array<{ senseId: string; turkishMeanings?: string[]; examples?: Example[] }>;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.warn('  Yanıt JSON olarak çözülemedi, bu grup atlandı.');
    return {};
  }

  const senseOwner = new Map<string, string>();
  batch.forEach(entry => entry.senses.forEach(sense => senseOwner.set(sense.id, entry.headword)));

  const accepted: Record<string, { turkishMeanings: string[]; examples: Example[] }> = {};
  for (const item of parsed || []) {
    const headword = senseOwner.get(item?.senseId);
    if (!headword) continue;
    const result = acceptSense(item, headword);
    if (result) {
      accepted[item.senseId] = result;
    } else {
      console.warn(`  "${headword}" (${item.senseId}) doğrulamayı geçemedi, atlandı.`);
    }
  }
  return accepted;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    console.error('GEMINI_API_KEY tanımlı değil; içerik üretilemez.');
    console.error('Kullanım: GEMINI_API_KEY=... npx tsx scripts/oxford/enrich_oxford.ts [--limit N] [--group C1]');
    process.exit(1);
  }

  const args = process.argv;
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? Number(args[limitIndex + 1]) : Infinity;
  const groupIndex = args.indexOf('--group');
  const groupFilter = groupIndex !== -1 ? args[groupIndex + 1] : null;

  const files = DATA_FILES.map(filePath => ({ filePath, entries: readJson<Entry[]>(filePath) }));
  const allEntries = files.flatMap(file => file.entries);

  const checkpoint: Record<string, { turkishMeanings: string[]; examples: Example[] }> =
    fs.existsSync(CHECKPOINT_PATH) ? readJson(CHECKPOINT_PATH) : {};

  const pending = allEntries.filter(entry => {
    if (groupFilter && entry.cefr !== groupFilter) return false;
    return entry.senses.some(sense => !isSenseComplete(sense) && !checkpoint[sense.id]);
  });

  const targets = pending.slice(0, limit);
  console.log(`Eksik kayıt: ${pending.length}. Bu çalıştırmada: ${targets.length}`);
  if (targets.length === 0) {
    console.log('Yapılacak iş yok.');
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  for (let index = 0; index < targets.length; index += BATCH_SIZE) {
    const batch = targets.slice(index, index + BATCH_SIZE);
    const label = `${index + 1}-${Math.min(index + BATCH_SIZE, targets.length)}/${targets.length}`;
    console.log(`[${label}] ${batch.map(entry => entry.sourceEntry).join(' | ')}`);

    try {
      const accepted = await enrichBatch(ai, batch);
      Object.assign(checkpoint, accepted);
      writeJson(CHECKPOINT_PATH, checkpoint);
      console.log(`  ${Object.keys(accepted).length} sense üretildi.`);
    } catch (error) {
      console.error('  Grup başarısız:', error instanceof Error ? error.message : error);
    }
  }

  // Kontrol noktasını veri dosyalarına uygula.
  let applied = 0;
  for (const file of files) {
    let touched = false;
    for (const entry of file.entries) {
      for (const sense of entry.senses) {
        const result = checkpoint[sense.id];
        if (!result) continue;
        sense.turkishMeanings = result.turkishMeanings;
        sense.examples = result.examples;
        touched = true;
        applied++;
      }
      const complete = entry.senses.every(isSenseComplete);
      if (complete) {
        delete entry.needsReview;
        delete entry.reviewReason;
        delete entry.legacyMeaning;
      }
    }
    if (touched) writeJson(file.filePath, file.entries);
  }

  console.log(`\n${applied} sense veriye işlendi.`);
  console.log('Doğrulamak için: python3 scripts/oxford/validate_oxford.py');
}

main();
