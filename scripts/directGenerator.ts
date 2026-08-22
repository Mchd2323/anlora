import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { RAW_SOURCE_B2, parseSourceLine, ParsedEntry } from './buildOxford5000B2';
import { EnrichedB2Entry, validateEntry } from './batchGeneratorB2';
import { B2_PART1 } from './b2Entries/part1';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const CHECKPOINT_FILE = path.join(process.cwd(), '.batch_checkpoints/b2_checkpoints.json');
const OUTPUT_FILE = path.join(process.cwd(), 'src/data/oxford5000ExtraB2.json');

function loadCheckpoint(): Record<number, EnrichedB2Entry> {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    } catch (e) {}
  }
  return {};
}

function saveCheckpoint(data: Record<number, EnrichedB2Entry>) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function processChunk(batch: ParsedEntry[], retry = 0): Promise<EnrichedB2Entry[]> {
  const prompt = `You are a master English-Turkish lexicographer for the Oxford 5000 Extra (B2 level) dataset.
For each of these ${batch.length} words, produce an accurate Turkish meaning and EXACTLY 3 natural, clear, contextually relevant B2 example sentences with accurate Turkish translations.

Words:
${JSON.stringify(batch, null, 2)}

Return a JSON array of objects:
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

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const text = res.text || '[]';
    return JSON.parse(text) as EnrichedB2Entry[];
  } catch (err: any) {
    if (retry < 3) {
      console.log(`Retry ${retry + 1} for batch (${batch[0].sourceOrder}-${batch[batch.length - 1].sourceOrder}): ${err.message}`);
      await new Promise(r => setTimeout(r, 2000));
      return processChunk(batch, retry + 1);
    }
    throw err;
  }
}

async function run() {
  const allParsed = RAW_SOURCE_B2.map(line => parseSourceLine(line));
  const checkpoint = loadCheckpoint();

  // Part 1 seeding
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

  const missingOrders: number[] = [];
  for (let i = 1; i <= 700; i++) {
    if (!checkpoint[i]) {
      missingOrders.push(i);
    }
  }

  console.log(`Total missing orders to process: ${missingOrders.length}`);

  const CHUNK_SIZE = 35;
  for (let i = 0; i < missingOrders.length; i += CHUNK_SIZE) {
    const batchOrders = missingOrders.slice(i, i + CHUNK_SIZE);
    const batch = batchOrders.map(ord => allParsed.find(p => p.sourceOrder === ord)!);

    console.log(`Processing orders ${batchOrders[0]} to ${batchOrders[batchOrders.length - 1]}...`);
    try {
      const enriched = await processChunk(batch);
      for (const item of enriched) {
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
          checkpoint[matchingParsed.sourceOrder] = entry;
        }
      }
      saveCheckpoint(checkpoint);
      console.log(`Checkpoint updated: ${Object.keys(checkpoint).length}/700 words`);
    } catch (err: any) {
      console.error(`Error processing chunk:`, err.message);
    }
  }

  // Assemble final 700 array in exact source order 1..700
  const finalArray: EnrichedB2Entry[] = [];
  for (let i = 1; i <= 700; i++) {
    const entry = checkpoint[i];
    if (entry) {
      finalArray.push(entry);
    } else {
      console.error(`WARNING: Missing order ${i}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalArray, null, 2), 'utf-8');
  console.log(`ALL 700 DONE! Wrote ${finalArray.length} entries to ${OUTPUT_FILE}`);
}

run().catch(console.error);
