/**
 * Karantinaya alınan Oxford 3000 maddelerinin örnek cümlelerini yeniden üretir.
 *
 * ARKA PLAN
 * Çekirdek sözlükteki 9.678 örnek cümlenin 8.515'i (%88) yirmi bir sabit
 * kalıptan üretilmişti. Kelime, sözcük türüne bakılmaksızın kalıbın içine
 * yerleştirildiği için ortaya dilbilgisi dışı cümleler çıkmıştı:
 *
 *     ago  (zarf) -> "I want to ago today because it is very important."
 *     back (fiil) -> "Research shows how organizations back during challenging times."
 *
 * Türkçe çeviriler de aynı kalıba Türkçe karşılığın sokulmasıyla üretildiği
 * için ayrıca anlamsızdı. Bu cümleler `quarantine_templates.py` ile veriden
 * çıkarıldı; etkilenen maddeler `examplesVerified: false` taşıyor ve
 * `quarantine_report.json` içinde listeleniyor.
 *
 * NEDEN BU BETİK ÇALIŞIYOR
 * Aynı projenin Oxford 5000 Ek setinde (700 madde, 2.025 cümle) tek bir şablon
 * yok. O set `fastBatchGeneratorB2.ts` ile, yani yapay zekâ üreticisiyle
 * hazırlanmış. Doğru boru hattı zaten var; çekirdek sözlük ondan hiç geçmemiş.
 * Bu betik aynı yaklaşımı çekirdeğe uygular.
 *
 * KULLANIM
 *     GEMINI_API_KEY=... npx tsx scripts/data-repair/repair_examples.ts
 *     GEMINI_API_KEY=... npx tsx scripts/data-repair/repair_examples.ts --limit 50
 *
 * Kontrol noktası tutar: yarıda kesilirse aynı komutla kaldığı yerden devam
 * eder, üretilmiş maddeler için tekrar API çağrısı yapmaz.
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

interface ExampleSentence {
  en: string;
  tr: string;
}

interface QuarantinedEntry {
  id: string;
  word: string;
  level: string;
  partOfSpeech: string;
  turkishMeaning: string;
  remainingExamples: number;
  removedCount: number;
}

interface QuarantineReport {
  note: string;
  detectedTemplateSkeletons: string[];
  stats: Record<string, number>;
  entries: QuarantinedEntry[];
}

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'scripts/data-repair/quarantine_report.json');
const CHECKPOINT_PATH = path.join(ROOT, '.batch_checkpoints/example_repair.json');
const DATA_FILES = ['wordsA1.json', 'wordsA2.json', 'wordsB1.json', 'wordsB2.json'].map(f =>
  path.join(ROOT, 'src/data', f)
);

const BATCH_SIZE = 20;
const EXAMPLES_PER_ENTRY = 3;

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

function loadCheckpoint(): Record<string, ExampleSentence[]> {
  if (fs.existsSync(CHECKPOINT_PATH)) {
    try {
      return readJson<Record<string, ExampleSentence[]>>(CHECKPOINT_PATH);
    } catch {
      console.warn('Kontrol noktası okunamadı, sıfırdan başlanıyor.');
    }
  }
  return {};
}

/**
 * Üretilen cümlenin kabul edilebilir olup olmadığını denetler.
 * Şablonun geri gelmesini önlemek için `quarantine_report.json` içindeki
 * iskeletler burada da uygulanır.
 */
function isAcceptable(
  example: ExampleSentence,
  word: string,
  skeletons: string[]
): boolean {
  const en = (example?.en || '').trim();
  const tr = (example?.tr || '').trim();
  if (!en || !tr) return false;
  if (en.length < 12 || tr.length < 6) return false;

  // Hedef kelime cümlede gerçekten geçmeli.
  const stem = word.trim().toLowerCase().split(/[\s,]+/)[0];
  if (stem && !en.toLowerCase().includes(stem.slice(0, Math.max(3, stem.length - 2)))) {
    return false;
  }

  const normalized = en.toLowerCase().replace(/\s+/g, ' ');
  for (const skeleton of skeletons) {
    const [head, tail] = skeleton.toLowerCase().split('<w>');
    if (tail === undefined) continue;
    const headPart = head.trim();
    const tailPart = tail.trim();
    const headOk = headPart.length === 0 || normalized.startsWith(headPart);
    const tailOk = tailPart.length === 0 || normalized.endsWith(tailPart);
    if (headOk && tailOk) return false;
  }

  return true;
}

function buildPrompt(batch: QuarantinedEntry[]): string {
  return `You are an English-Turkish lexicographer writing example sentences for Turkish learners.

For each of the ${batch.length} entries below, write exactly ${EXAMPLES_PER_ENTRY} example sentences.

Hard requirements:
- The sentence must use the word in the grammatical role given by "partOfSpeech". If the entry is an adverb, do NOT use it as a verb. This is the single most important rule.
- The sentence must express the meaning given in "turkishMeaning".
- Keep the vocabulary at or below the entry's CEFR "level".
- Write natural, everyday English. No filler frames such as "I want to X today because it is very important" or "Research shows how organizations X".
- Every sentence must be different in structure from the others. Do not reuse one sentence frame across entries.
- "tr" must be a fluent Turkish translation of that exact sentence, not a definition.

Entries:
${JSON.stringify(
  batch.map(e => ({
    id: e.id,
    word: e.word,
    partOfSpeech: e.partOfSpeech,
    turkishMeaning: e.turkishMeaning,
    level: e.level
  })),
  null,
  2
)}

Return ONLY a JSON array, no prose:
[{"id": "...", "examples": [{"en": "...", "tr": "..."}]}]`;
}

async function generateBatch(
  ai: GoogleGenAI,
  batch: QuarantinedEntry[],
  skeletons: string[]
): Promise<Record<string, ExampleSentence[]>> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: buildPrompt(batch),
    config: { responseMimeType: 'application/json' }
  });

  const text = (response.text || '').trim();
  let parsed: Array<{ id: string; examples: ExampleSentence[] }>;
  try {
    parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
  } catch {
    console.warn('  Yanıt JSON olarak çözülemedi, bu grup atlanıyor.');
    return {};
  }

  const result: Record<string, ExampleSentence[]> = {};
  for (const item of parsed || []) {
    const entry = batch.find(e => e.id === item?.id);
    if (!entry) continue;
    const accepted = (item.examples || []).filter(ex =>
      isAcceptable(ex, entry.word, skeletons)
    );
    if (accepted.length >= 2) {
      result[entry.id] = accepted.slice(0, EXAMPLES_PER_ENTRY);
    } else {
      console.warn(`  "${entry.word}" için üretilen cümleler doğrulamayı geçemedi.`);
    }
  }
  return result;
}

function applyToDataFiles(generated: Record<string, ExampleSentence[]>): number {
  let applied = 0;
  for (const filePath of DATA_FILES) {
    const entries = readJson<any[]>(filePath);
    let touched = false;
    for (const entry of entries) {
      const examples = generated[entry.id];
      if (!examples || examples.length === 0) continue;
      entry.examples = examples;
      entry.examplesVerified = true;
      touched = true;
      applied++;
    }
    if (touched) writeJson(filePath, entries);
  }
  return applied;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    console.error('GEMINI_API_KEY tanımlı değil. Örnek cümleler yeniden üretilemez.');
    console.error('Kullanım: GEMINI_API_KEY=... npx tsx scripts/data-repair/repair_examples.ts');
    process.exit(1);
  }

  const report = readJson<QuarantineReport>(REPORT_PATH);
  const checkpoint = loadCheckpoint();

  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity;

  const pending = report.entries.filter(e => !checkpoint[e.id]).slice(0, limit);
  console.log(`Onarılacak madde: ${pending.length} (toplam karantina: ${report.entries.length})`);
  if (pending.length === 0) {
    console.log('Yeniden üretilecek madde yok.');
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const label = `${i + 1}-${Math.min(i + BATCH_SIZE, pending.length)}/${pending.length}`;
    console.log(`[${label}] ${batch.map(e => e.word).join(', ')}`);

    try {
      const generated = await generateBatch(ai, batch, report.detectedTemplateSkeletons);
      Object.assign(checkpoint, generated);
      writeJson(CHECKPOINT_PATH, checkpoint);
      const applied = applyToDataFiles(generated);
      console.log(`  ${applied} madde güncellendi.`);
    } catch (err) {
      console.error('  Grup başarısız:', err instanceof Error ? err.message : err);
    }
  }

  const remaining = report.entries.filter(e => !checkpoint[e.id]).length;
  console.log(`\nTamamlandı. Kalan madde: ${remaining}`);
  console.log('Doğrulamak için: npx tsx scripts/auditOxford3000.ts');
}

main();
