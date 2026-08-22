import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { RAW_SOURCE_B2, parseSourceLine, ParsedEntry } from './buildOxford5000B2';
import { EnrichedB2Entry, validateEntry } from './batchGeneratorB2';
import { B2_PART1 } from './b2Entries/part1';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    } catch (e) {
      console.warn('Could not parse checkpoint, fresh start');
    }
  }
  return {};
}

function saveCheckpoint(data: Record<number, EnrichedB2Entry>) {
  ensureDir(CHECKPOINT_DIR);
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function enrichBatch(parsedBatch: ParsedEntry[], retry = 0): Promise<EnrichedB2Entry[]> {
  const prompt = `You are a master English-Turkish lexicographer creating the Oxford 5000 Extra (B2 level) vocabulary database for Turkish learners in Anlora.
For every single one of the given ${parsedBatch.length} words, generate:
1. 'turkishMeaning': accurate, natural, context-specific Turkish definition matching the specified Part of Speech (POS) and qualifier.
2. 'turkishMeanings': array of 1-4 common Turkish meanings/synonyms.
3. 'senses': exactly 1 sense (or multiple if POS has multiple parts like "v., n.") where each sense has EXACTLY 3 distinct, natural, realistic B2-level English example sentences and their accurate Turkish translations.

Strict Constraints:
- Use the word naturally according to its specified grammatical role.
- NO placeholders (never use "(anlam)", "(fiil)", "TODO", etc.).
- Exactly 3 examples per sense.

Words to enrich:
${JSON.stringify(parsedBatch, null, 2)}

Return JSON array matching this exact schema:
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
          { "en": "Sentence 1...", "tr": "Çeviri 1..." },
          { "en": "Sentence 2...", "tr": "Çeviri 2..." },
          { "en": "Sentence 3...", "tr": "Çeviri 3..." }
        ]
      }
    ]
  }
]`;

  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash'];
  const modelName = models[retry % models.length];

  try {
    const res = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const text = res.text || '[]';
    const parsed = JSON.parse(text) as EnrichedB2Entry[];
    return parsed;
  } catch (err: any) {
    if (retry < 3) {
      console.warn(`[Batch ${parsedBatch[0].sourceOrder}-${parsedBatch[parsedBatch.length - 1].sourceOrder}] Retry ${retry + 1}: ${err.message}`);
      await new Promise(r => setTimeout(r, 1500 * (retry + 1)));
      return enrichBatch(parsedBatch, retry + 1);
    }
    throw err;
  }
}

export async function runFastPipeline() {
  console.log('--- FAST PIPELINE START ---');
  const checkpoint = loadCheckpoint();
  const allParsed = RAW_SOURCE_B2.map(line => parseSourceLine(line));

  // Ensure handcrafted part 1 is in checkpoint
  for (const [orderStr, content] of Object.entries(B2_PART1)) {
    const order = parseInt(orderStr, 10);
    const parsed = allParsed.find(p => p.sourceOrder === order);
    if (parsed && !checkpoint[order]) {
      checkpoint[order] = {
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
    }
  }
  saveCheckpoint(checkpoint);
  console.log(`Starting with ${Object.keys(checkpoint).length}/700 entries.`);

  const missingOrders: number[] = [];
  for (let i = 1; i <= 700; i++) {
    if (!checkpoint[i]) {
      missingOrders.push(i);
    }
  }

  console.log(`Missing entries: ${missingOrders.length}`);

  const BATCH_SIZE = 25;
  const batches: ParsedEntry[][] = [];
  for (let i = 0; i < missingOrders.length; i += BATCH_SIZE) {
    const slice = missingOrders.slice(i, i + BATCH_SIZE);
    batches.push(slice.map(ord => allParsed.find(p => p.sourceOrder === ord)!));
  }

  // Process with concurrency 4
  const CONCURRENCY = 4;
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const activeBatches = batches.slice(i, i + CONCURRENCY);
    console.log(`Executing concurrent chunk ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(batches.length / CONCURRENCY)} (${activeBatches.length} batches)...`);

    const results = await Promise.allSettled(
      activeBatches.map(b => enrichBatch(b))
    );

    results.forEach((res, batchIdx) => {
      if (res.status === 'fulfilled') {
        for (const item of res.value) {
          const matchingParsed = allParsed.find(p => p.sourceOrder === item.sourceOrder);
          if (matchingParsed) {
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
              senses: (item.senses || []).map(s => ({
                partOfSpeech: s.partOfSpeech || matchingParsed.partOfSpeech,
                turkishMeanings: s.turkishMeanings || [item.turkishMeaning],
                examples: (s.examples || []).slice(0, 3)
              }))
            };

            const val = validateEntry(entry, matchingParsed.sourceEntry);
            if (!val.valid) {
              entry.needsReview = true;
              entry.reviewReason = val.reason;
            }
            checkpoint[matchingParsed.sourceOrder] = entry;
          }
        }
      } else {
        console.error(`Batch failed:`, res.reason);
      }
    });

    saveCheckpoint(checkpoint);
    console.log(`Checkpoint saved: ${Object.keys(checkpoint).length}/700 entries.`);
  }

  // Assemble and write final JSON
  const finalEntries: EnrichedB2Entry[] = [];
  for (let i = 1; i <= 700; i++) {
    const entry = checkpoint[i];
    if (entry) {
      finalEntries.push(entry);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalEntries, null, 2), 'utf-8');
  console.log(`--- FAST PIPELINE COMPLETED: ${finalEntries.length}/700 written to ${OUTPUT_FILE} ---`);
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('fastBatchGeneratorB2')) {
  runFastPipeline().catch(console.error);
}
