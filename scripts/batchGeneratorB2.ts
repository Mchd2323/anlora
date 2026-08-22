import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { RAW_SOURCE_B2, parseSourceLine, ParsedEntry } from './buildOxford5000B2';
import { B2_PART1 } from './b2Entries/part1';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface EnrichedSense {
  partOfSpeech: string;
  turkishMeanings: string[];
  examples: {
    en: string;
    tr: string;
  }[];
}

export interface EnrichedB2Entry {
  id: string;
  sourceOrder: number;
  sourceEntry: string;
  headword: string;
  qualifier?: string;
  partOfSpeech: string;
  cefr: "B2";
  sourceCollection: "oxford5000-extra";
  turkishMeaning: string;
  turkishMeanings: string[];
  senses: EnrichedSense[];
  needsReview?: boolean;
  reviewReason?: string;
}

const CHECKPOINT_DIR = path.join(process.cwd(), '.batch_checkpoints');
const CHECKPOINT_FILE = path.join(CHECKPOINT_DIR, 'b2_checkpoints.json');
const OUTPUT_FILE = path.join(process.cwd(), 'src/data/oxford5000ExtraB2.json');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadCheckpoint(): Record<number, EnrichedB2Entry> {
  ensureDir(CHECKPOINT_DIR);
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
      return data;
    } catch (e) {
      console.warn('Could not parse checkpoint file, starting fresh.');
    }
  }
  return {};
}

function saveCheckpoint(data: Record<number, EnrichedB2Entry>) {
  ensureDir(CHECKPOINT_DIR);
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Validation function
export function validateEntry(entry: EnrichedB2Entry, originalLine: string): { valid: boolean; reason?: string } {
  if (entry.cefr !== 'B2') return { valid: false, reason: 'CEFR must be B2' };
  if (entry.sourceCollection !== 'oxford5000-extra') return { valid: false, reason: 'sourceCollection must be oxford5000-extra' };
  if (!entry.headword || !entry.partOfSpeech) return { valid: false, reason: 'Missing headword or partOfSpeech' };
  if (!entry.turkishMeaning || entry.turkishMeaning.trim().length === 0) return { valid: false, reason: 'Empty turkishMeaning' };
  
  const placeholders = ['(b2)', '(anlam)', '(fiil)', '(isim)', 'placeholder', 'lorem', 'todo'];
  for (const ph of placeholders) {
    if (entry.turkishMeaning.toLowerCase().includes(ph)) {
      return { valid: false, reason: `Placeholder found in turkishMeaning: ${ph}` };
    }
  }

  if (!entry.senses || entry.senses.length === 0) return { valid: false, reason: 'No senses provided' };

  for (const sense of entry.senses) {
    if (!sense.turkishMeanings || sense.turkishMeanings.length === 0) {
      return { valid: false, reason: 'Sense missing turkishMeanings' };
    }
    if (!sense.examples || sense.examples.length !== 3) {
      return { valid: false, reason: `Sense must have exactly 3 examples, found ${sense.examples?.length}` };
    }
    for (const ex of sense.examples) {
      if (!ex.en || ex.en.trim().length < 10) return { valid: false, reason: 'Example EN is too short or empty' };
      if (!ex.tr || ex.tr.trim().length < 5) return { valid: false, reason: 'Example TR is too short or empty' };
      for (const ph of placeholders) {
        if (ex.en.toLowerCase().includes(ph) || ex.tr.toLowerCase().includes(ph)) {
          return { valid: false, reason: `Placeholder in example: ${ph}` };
        }
      }
    }
  }

  return { valid: true };
}

async function processBatchWithGemini(parsedBatch: ParsedEntry[], retryCount = 0): Promise<EnrichedB2Entry[]> {
  const prompt = `You are an expert English-Turkish lexicographer creating the Oxford 5000 Extra (B2 level) dictionary dataset for Turkish learners in Anlora.
For each of the following words, generate high-quality, accurate Turkish meanings and EXACTLY 3 natural, clear, contextually relevant B2-level English example sentences with natural Turkish translations.

Strict Rules:
1. Match the exact Part of Speech (POS) and qualifier (if any) specified for each word.
2. The primary 'turkishMeaning' must be accurate, contextual to the specified POS, and learner-friendly.
3. 'turkishMeanings' must be an array of 1-4 common Turkish synonyms/meanings.
4. Each entry MUST have exactly one primary sense (or multiple if POS is multi-part like "v., n." or "adj./adv.") where each sense has EXACTLY 3 distinct example sentences.
5. In each example sentence, the target word must be used naturally according to its specified grammatical role (POS and qualifier).
6. NO generic, lazy, or placeholder examples (do not use "This is a word" or "He did it"). All sentences should be realistic, vivid, and helpful for B2 English learners.
7. NO placeholders like "(anlam)", "(fiil)", "(B2)", "TODO".

Source entries to enrich:
${JSON.stringify(parsedBatch, null, 2)}

Return a JSON array of objects with the exact schema:
[
  {
    "id": "ox5000-extra-b2-...",
    "sourceOrder": 1,
    "sourceEntry": "absorb v.",
    "headword": "absorb",
    "qualifier": "",
    "partOfSpeech": "v.",
    "cefr": "B2",
    "sourceCollection": "oxford5000-extra",
    "turkishMeaning": "emmek, içine çekmek, özümsemek",
    "turkishMeanings": ["emmek", "içine çekmek", "özümsemek"],
    "senses": [
      {
        "partOfSpeech": "v.",
        "turkishMeanings": ["emmek", "içine çekmek", "özümsemek"],
        "examples": [
          { "en": "...", "tr": "..." },
          { "en": "...", "tr": "..." },
          { "en": "...", "tr": "..." }
        ]
      }
    ]
  }
]`;

  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash'];
  const modelName = models[retryCount % models.length];

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const text = response.text || '[]';
    const parsed = JSON.parse(text) as EnrichedB2Entry[];
    return parsed;
  } catch (error: any) {
    if (retryCount < 4) {
      console.warn(`Retry ${retryCount + 1} for batch due to error (${error.message}). Waiting...`);
      await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
      return processBatchWithGemini(parsedBatch, retryCount + 1);
    }
    throw error;
  }
}

export async function runPipeline() {
  console.log('Starting Oxford 5000 B2 Extra pipeline...');
  const checkpoint = loadCheckpoint();
  const allParsed = RAW_SOURCE_B2.map(line => parseSourceLine(line));

  // First apply Part 1 handcrafted entries if not already in checkpoint
  for (const [orderStr, content] of Object.entries(B2_PART1)) {
    const order = parseInt(orderStr, 10);
    const parsed = allParsed.find(p => p.sourceOrder === order);
    if (parsed && !checkpoint[order]) {
      const entry: EnrichedB2Entry = {
        id: parsed.id,
        sourceOrder: parsed.sourceOrder,
        sourceEntry: parsed.sourceEntry,
        headword: parsed.headword,
        qualifier: parsed.qualifier,
        partOfSpeech: parsed.partOfSpeech,
        cefr: "B2",
        sourceCollection: "oxford5000-extra",
        turkishMeaning: content.turkishMeaning,
        turkishMeanings: content.turkishMeanings || [content.turkishMeaning],
        senses: content.senses || [
          {
            partOfSpeech: parsed.partOfSpeech,
            turkishMeanings: content.turkishMeanings || [content.turkishMeaning],
            examples: content.examples
          }
        ]
      };
      checkpoint[order] = entry;
    }
  }
  saveCheckpoint(checkpoint);
  console.log(`Loaded ${Object.keys(checkpoint).length} existing entries in checkpoint.`);

  // Find remaining missing entries
  const missingOrders: number[] = [];
  for (let i = 1; i <= 700; i++) {
    if (!checkpoint[i]) {
      missingOrders.push(i);
    }
  }

  console.log(`Missing entries to process: ${missingOrders.length}`);

  const BATCH_SIZE = 25;
  for (let i = 0; i < missingOrders.length; i += BATCH_SIZE) {
    const currentBatchOrders = missingOrders.slice(i, i + BATCH_SIZE);
    const batchParsed = currentBatchOrders.map(order => allParsed.find(p => p.sourceOrder === order)!);

    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missingOrders.length / BATCH_SIZE)} (orders ${currentBatchOrders[0]} - ${currentBatchOrders[currentBatchOrders.length - 1]})...`);

    try {
      const enrichedBatch = await processBatchWithGemini(batchParsed);

      for (const item of enrichedBatch) {
        const matchingParsed = allParsed.find(p => p.sourceOrder === item.sourceOrder);
        if (matchingParsed) {
          // Normalize fields to ensure stability
          const entry: EnrichedB2Entry = {
            id: matchingParsed.id,
            sourceOrder: matchingParsed.sourceOrder,
            sourceEntry: matchingParsed.sourceEntry,
            headword: matchingParsed.headword,
            qualifier: matchingParsed.qualifier,
            partOfSpeech: matchingParsed.partOfSpeech,
            cefr: "B2",
            sourceCollection: "oxford5000-extra",
            turkishMeaning: item.turkishMeaning,
            turkishMeanings: item.turkishMeanings || [item.turkishMeaning],
            senses: item.senses.map(s => ({
              partOfSpeech: s.partOfSpeech || matchingParsed.partOfSpeech,
              turkishMeanings: s.turkishMeanings || [item.turkishMeaning],
              examples: s.examples.slice(0, 3)
            }))
          };

          const val = validateEntry(entry, matchingParsed.sourceEntry);
          if (!val.valid) {
            console.warn(`Validation issue on order ${entry.sourceOrder} (${entry.headword}): ${val.reason}`);
            entry.needsReview = true;
            entry.reviewReason = val.reason;
          }
          checkpoint[matchingParsed.sourceOrder] = entry;
        }
      }

      saveCheckpoint(checkpoint);
      console.log(`Saved checkpoint. Total entries: ${Object.keys(checkpoint).length}/700`);
    } catch (err: any) {
      console.error(`Error processing batch: ${err.message}`);
      // Sleep slightly and continue
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Final assembly and validation
  const finalEntries: EnrichedB2Entry[] = [];
  let validCount = 0;
  let needsReviewCount = 0;

  for (let i = 1; i <= 700; i++) {
    const entry = checkpoint[i];
    if (entry) {
      const parsed = allParsed.find(p => p.sourceOrder === i)!;
      const val = validateEntry(entry, parsed.sourceEntry);
      if (val.valid && !entry.needsReview) {
        validCount++;
      } else {
        needsReviewCount++;
        entry.needsReview = true;
        entry.reviewReason = val.reason || entry.reviewReason;
      }
      finalEntries.push(entry);
    } else {
      console.error(`CRITICAL: Missing entry for order ${i}`);
    }
  }

  // Write final JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalEntries, null, 2), 'utf-8');
  console.log(`\n========================================`);
  console.log(`PIPELINE FINISHED`);
  console.log(`Total B2 entries saved: ${finalEntries.length}/700`);
  console.log(`Valid: ${validCount}`);
  console.log(`Needs review: ${needsReviewCount}`);
  console.log(`Saved to: ${OUTPUT_FILE}`);
  console.log(`========================================\n`);
}

// Auto-run if executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('batchGeneratorB2')) {
  runPipeline().catch(console.error);
}
