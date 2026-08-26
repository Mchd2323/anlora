import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

// In-Memory Rate Limiting & Anti-Abuse Manager
interface RateLimitRecord {
  timestamps: number[];
  failedAttempts: number;
  blockedUntil?: number;
}
const ipRateLimitStore = new Map<string, RateLimitRecord>();

function checkRateLimit(ip: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const record = ipRateLimitStore.get(ip) || { timestamps: [], failedAttempts: 0 };

  // Check if currently blocked
  if (record.blockedUntil && record.blockedUntil > now) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((record.blockedUntil - now) / 1000) };
  }

  // Filter timestamps within sliding window
  record.timestamps = record.timestamps.filter(t => now - t < windowMs);

  if (record.timestamps.length >= maxRequests) {
    // Temporarily throttle
    record.blockedUntil = now + Math.min(windowMs, 60000);
    ipRateLimitStore.set(ip, record);
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((record.blockedUntil - now) / 1000) };
  }

  record.timestamps.push(now);
  ipRateLimitStore.set(ip, record);
  return { allowed: true, remaining: maxRequests - record.timestamps.length };
}

// Input sanitizer helper
function sanitizeString(str: any, maxLen = 255): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .trim()
    .slice(0, maxLen);
}


// Initialize Gemini Client lazily or safely
let aiClient: GoogleGenAI | null = null;
function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Validator for AI Generated Vocabulary Cards
function validateGeneratedWordCard(card: any, targetWord: string): boolean {
  if (!card || typeof card !== 'object') return false;
  const word = (card.word || targetWord || '').trim().toLowerCase();
  
  // 1. Check primary Turkish meaning
  const primaryTr = (card.turkishMeaning || '').trim().toLowerCase();
  if (!primaryTr) return false;

  const badTrKeywords = ['kelimesi', 'otomatik anlam', '(anlam)', `${word} (`];
  for (const kw of badTrKeywords) {
    if (primaryTr.includes(kw)) return false;
  }

  const commonLoanwords = new Set([
    'internet', 'festival', 'model', 'robot', 'radyo', 'otel', 'film', 'doktor',
    'park', 'taksi', 'tren', 'otobüs', 'kamera', 'bomba', 'gaz', 'kriz', 'şoför',
    'restoran', 'menü', 'avukat', 'polis', 'şef', 'stadyum', 'müzik', 'piyano',
    'gitar', 'opera', 'bale', 'banka', 'televizyon', 'telefon', 'organize'
  ]);
  if (!commonLoanwords.has(word) && primaryTr === word) {
    return false;
  }

  // 2. Check senses if present
  if (Array.isArray(card.senses) && card.senses.length > 0) {
    for (const sense of card.senses) {
      if (!Array.isArray(sense.turkishMeanings) || sense.turkishMeanings.length === 0) return false;
      for (const m of sense.turkishMeanings) {
        const ml = (m || '').toLowerCase();
        if (ml.includes('kelimesi') || ml.includes('otomatik anlam') || ml.includes('(anlam)')) return false;
      }
    }
  }

  // 3. Check example sentences
  const allExamples = [
    ...(Array.isArray(card.examples) ? card.examples : []),
    ...(Array.isArray(card.senses) ? card.senses.flatMap((s: any) => s.examples || []) : [])
  ];

  if (allExamples.length === 0) return false;

  // Çekirdek sözlüğü bozan şablonlar.
  //
  // Oxford 3000 verisindeki 9.678 örnek cümlenin 8.515'i (%88) aşağıdaki
  // yirmi bir kalıptan üretilmişti. Kelime sözcük türüne bakılmaksızın kalıbın
  // içine yerleştirildiği için dilbilgisi dışı cümleler çıkıyordu
  // ("I want to ago today because it is very important"). Cümleler veriden
  // çıkarıldı; bu liste yapay zekânın aynı kalıpları üretip veriye geri
  // sokmasını engeller. Kelimenin geçtiği yer <W> ile temsil edilir.
  const templateSkeletons = [
    'A thorough understanding of this <W> is required for the exam.',
    'Can you help me <W> this properly?',
    'Experts highlighted the most <W> factors in their recent report.',
    'Have you seen the new <W> in our local neighborhood?',
    'I want to <W> today because it is very important.',
    'Please remember to sign the form <W> leaving the building.',
    'Recent developments in <W> have attracted widespread attention.',
    'Research shows how organizations <W> during challenging times.',
    'She decided to <W> after talking with her family.',
    'She gave a <W> answer that helped everyone understand.',
    'The committee analyzed the impact of the <W> on future growth.',
    'The manager instructed the team to <W> the process carefully.',
    'The path leads <W> the quiet village and into the hills.',
    'The situation requires a <W> approach from both sides.',
    'The teacher asked a question about the <W> in class.',
    'The weather today felt unusually <W> and pleasant.',
    'They observed a <W> difference in performance across groups.',
    'They were able to <W> the issue before it caused problems.',
    'This is a very <W> example for beginners to study.',
    'We need more information about this <W> before making a decision.',
    'We stayed inside <W> the storm passed over the valley.',
  ];

  const matchesTemplate = (sentence: string): boolean => {
    const normalized = sentence.trim().toLowerCase().replace(/\s+/g, ' ');
    return templateSkeletons.some(skeleton => {
      const [head, tail] = skeleton.toLowerCase().split('<w>');
      if (tail === undefined) return normalized === head.trim();
      const headPart = head.trim();
      const tailPart = tail.trim();
      const headOk = headPart.length === 0 || normalized.startsWith(headPart);
      const tailOk = tailPart.length === 0 || normalized.endsWith(tailPart);
      return headOk && tailOk;
    });
  };

  const badExPatterns = [
    'i learned',
    'learning the word',
    'learning this word',
    'can you make a sentence with',
    'can you explain the meaning of',
    'can you explain the usage of',
    'is very useful',
    'is very beneficial',
    'is commonly used in',
    'is important for communication',
    'bu örnek cümledir',
    'kelimesini öğrenmek çok faydalıdır'
  ];

  const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const ex of allExamples) {
    const en = (ex.en || '').toLowerCase();
    const tr = (ex.tr || '').toLowerCase();
    for (const pat of badExPatterns) {
      if (en.includes(pat) || tr.includes(pat)) {
        return false;
      }
    }
    if (matchesTemplate(ex.en || '')) {
      return false;
    }
    // Örnek cümle hedef kelimeyi gerçekten içermeli; içermiyorsa örnek değildir.
    if (word && !new RegExp(escapeForRegExp(word), 'i').test(ex.en || '')) {
      return false;
    }
  }

  return true;
}

// AI Endpoint: Dedicated English Language Teaching & Lexicography AI
/**
 * Yapay zekâ uçları için hız sınırı.
 *
 * Bu uçlar kimlik doğrulaması istemez ve her çağrı sunucu sahibinin Gemini
 * kotasından harcar. Sınırsız bırakıldığında tek bir betik dakikalar içinde
 * kotayı tüketebilir; önceki sürümde hiçbir sınır yoktu.
 */
function guardAiRequest(req: express.Request, res: express.Response): boolean {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const rate = checkRateLimit(`ai:${ip}`, 30, 60000);
  if (!rate.allowed) {
    res.status(429).json({
      error: `Çok fazla yapay zekâ isteği gönderildi. Lütfen ${rate.retryAfter || 60} saniye sonra tekrar deneyin.`,
      code: 'AI_RATE_LIMITED'
    });
    return false;
  }
  return true;
}

app.post('/api/ai/generate-word', blockDuringMaintenance, async (req, res) => {
  if (!guardAiRequest(req, res)) return;

  const { word, context } = req.body;
  if (!word || typeof word !== 'string' || !word.trim()) {
    return res.status(400).json({ error: 'Kelime girilmedi.' });
  }

  const trimmedWord = word.trim();
  const key = cacheKey(trimmedWord);
  const hasContext = typeof context === 'string' && context.trim().length > 0;

  /*
   * ADIM 3: DAHA ÖNCE ÜRETİLMİŞ İÇERİK.
   *
   * Aynı kelime için ikinci kez yapay zekâ çağrılmaz. Bağlam cümlesi
   * verilmişse önbellek atlanır: bağlama özel anlam seçimi zaten önbellekteki
   * genel kartta yok, onu döndürmek kullanıcının sorduğu soruyu yanıtsız
   * bırakmak olurdu.
   */
  const cached = aiCache.cards[key];
  if (cached && !hasContext) {
    cached.hits++;
    aiCache.callsAvoided++;
    persistAiCache();
    return res.json({ ...cached.card, isAiGenerated: true, fromCache: true });
  }

  /*
   * ADIM 4: KOTA.
   *
   * Kelime eklemek sınırsız; sınırlanan yalnızca yeni üretim. Kota dolduysa
   * kullanıcıya ne yapabileceği söylenir, boş bir hata verilmez.
   */
  const userKey =
    resolveSession((req.headers.authorization || '').replace('Bearer ', '').trim())?.email ||
    req.ip ||
    'anon';
  const quota = checkAiQuota(userKey);
  if (!quota.allowed) {
    return res.status(429).json({ error: quota.reason, code: 'AI_QUOTA_EXCEEDED' });
  }

  recordAiRequest();
  try {
    const ai = getGenAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Yapay zekâ şu anda kelime bilgilerini oluşturamadı. Tekrar deneyebilir veya kartı kendiniz doldurabilirsiniz.',
        code: 'AI_UNAVAILABLE',
        details: 'GEMINI_API_KEY is not configured.'
      });
    }

    const systemInstruction = `You are a professional English vocabulary teacher, bilingual English-Turkish lexicographer and CEFR language-learning specialist.
A single English headword may contain multiple senses and parts of speech.
Treat each learner meaning as an independent sense.

For each sense:
- validate whether the supplied Turkish meaning matches the English word
- use the supplied context sentence when available (give highest priority to context meaning)
- identify the correct part of speech
- suggest a correction if the learner's Turkish meaning is clearly wrong
- do not silently overwrite learner input
- create example sentences that demonstrate exactly that sense
- never use an example belonging to another sense
- return natural Turkish translations of each example

If the word has other common learner-relevant meanings, you may suggest them separately, but do not automatically add them.
Do not overwhelm the learner with rare dictionary senses. Prioritize common contemporary English.`;

    const userPrompt = `Analyze the target English word "${trimmedWord}" for a Turkish learner.
${context ? `The user encountered this word in this context sentence: "${context}"` : ''}

Requirements:
1. Provide accurate canonical lemma, standard IPA phonetic notation, and overall CEFR level ("A1" | "A2" | "B1" | "B2" | "C1" | "C2").
2. Separate distinct, common parts of speech (e.g. "n.", "v.", "adj.", "adv.", "prep.", "phr. v.", "idiom") into individual "senses".
3. For each sense, provide:
   - "id": "sense-1", "sense-2", etc.
   - "partOfSpeech": abbreviation (e.g., "n.", "v.", "adj.", "adv.", "prep.")
   - "turkishMeanings": array of 1-3 natural, modern Turkish translations (e.g. ["ışık"] or ["hafif"])
   - "shortExplanationTr": short Turkish explanation (e.g., "Ağırlığı az olan" or "Görüş sağlayan aydınlık")
   - "usageNoteTr": a short helpful note in Turkish explaining when/how this sense is used
   - "cefr": CEFR level for this specific sense
   - "examples": 2 natural, real-world English example sentences showing EXACTLY this sense (NEVER mixed with other senses) with fluent Turkish translations ("en" and "tr").
4. If context was supplied, prioritize the sense corresponding to the context sentence as the first sense!
5. Provide top-level "turkishMeaning" (concise summary of primary senses, e.g. "ışık (n.), hafif (adj.)").
6. Provide top-level "examples" containing 2-3 varied sentences illustrating the primary senses.

Return valid JSON with the following structure:
{
  "word": "${trimmedWord}",
  "lemma": "string",
  "phonetic": "string",
  "level": "A1 | A2 | B1 | B2 | C1 | C2",
  "partOfSpeech": "string",
  "turkishMeaning": "string",
  "contextualMeaning": "string or null",
  "senses": [
    {
      "id": "sense-1",
      "partOfSpeech": "string",
      "turkishMeanings": ["string"],
      "shortExplanationTr": "string",
      "usageNoteTr": "string",
      "cefr": "A1 | A2 | B1 | B2 | C1 | C2",
      "examples": [
        { "en": "string", "tr": "string" },
        { "en": "string", "tr": "string" }
      ]
    }
  ],
  "examples": [
    { "en": "string", "tr": "string" },
    { "en": "string", "tr": "string" }
  ],
  "otherSuggestions": [
    {
      "id": "sugg-1",
      "partOfSpeech": "string",
      "turkishMeanings": ["string"],
      "examples": [
        { "en": "string", "tr": "string" }
      ]
    }
  ]
}`;

    // Execute with up to 1 controlled retry if validation fails
    let attempts = 0;
    let finalCard: any = null;

    while (attempts < 2 && !finalCard) {
      attempts++;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text || '';
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        const parsedData = JSON.parse(cleanJson);
        if (validateGeneratedWordCard(parsedData, trimmedWord)) {
          finalCard = parsedData;
        }
      } catch (err) {
        console.warn(`JSON parse error on attempt ${attempts}:`, err);
      }
    }

    if (!finalCard) {
      return res.status(500).json({
        error: 'Yapay zekâ şu anda kelime bilgilerini oluşturamadı. Tekrar deneyebilir veya kartı kendiniz doldurabilirsiniz.',
        code: 'AI_VALIDATION_FAILED'
      });
    }

    /*
     * ADIM 5: ÜRETİLEN SONUÇ ORTAK ÖNBELLEĞE YAZILIR.
     *
     * Bağlama özel üretimler yazılmaz: onlar bir kullanıcının cümlesine göre
     * seçilmiş anlamlar taşır ve başka birine yanlış gelir.
     */
    if (!hasContext) {
      aiCache.cards[key] = {
        word: trimmedWord,
        card: finalCard,
        approved: false,
        flagged: false,
        hits: 0,
        createdAt: new Date().toISOString()
      };
      persistAiCache();
    }
    consumeAiQuota(userKey);

    return res.json({
      ...finalCard,
      isAiGenerated: true
    });
  } catch (error: any) {
    console.error('Gemini API hatası:', error);
    return res.status(500).json({
      error: 'Yapay zekâ şu anda kelime bilgilerini oluşturamadı. Tekrar deneyebilir veya kartı kendiniz doldurabilirsiniz.',
      code: 'AI_ERROR',
      details: error?.message || 'Bilinmeyen hata'
    });
  }
});

// AI Endpoint: Independent Sense Validation & Sense-Specific Examples Generator
app.post('/api/ai/validate-senses', async (req, res) => {
  if (!guardAiRequest(req, res)) return;
  recordAiRequest();
  try {
    const { word, contextSentence, userSenses } = req.body;
    if (!word || typeof word !== 'string' || !word.trim()) {
      return res.status(400).json({ error: 'Kelime girilmedi.' });
    }
    if (!Array.isArray(userSenses) || userSenses.length === 0) {
      return res.status(400).json({ error: 'Doğrulanacak anlam bulunamadı.' });
    }

    const trimmedWord = word.trim();
    const ai = getGenAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Yapay zekâ servisi şu anda kullanılamıyor.',
        code: 'AI_UNAVAILABLE'
      });
    }

    const systemInstruction = `You are a professional English language teacher and lexicographer.
A learner is creating or editing a custom vocabulary card for "${trimmedWord}".
The learner has written one or more Turkish senses.

Your tasks:
1. Evaluate EACH user sense independently (do not evaluate the whole word as a single blob).
2. For each sense:
   - Check if the Turkish meaning matches the English word "${trimmedWord}".
   - If contextSentence is provided ("${contextSentence || ''}"), give highest priority to how the word is used in that context! For example, if word is "bank" and sentence is "We sat on the bank of the river" with meaning "kıyı", it is completely VALID.
   - Determine the correct part of speech (e.g. "n.", "v.", "adj.", "adv.", "prep.", "phr. v.").
   - Determine validationStatus:
     * "VALID": The Turkish meaning is accurate for this word.
     * "WARNING": The meaning is plausible or possible in some contexts, but ambiguous.
     * "INVALID": The meaning is completely wrong (e.g. "run" -> "okumak" or "light" -> "yürümek").
   - If "INVALID" or "WARNING", provide "aiWarningNote" and "suggestedCorrection" in Turkish without overwriting the user's text.
   - Generate 2 high-quality, natural, modern English example sentences that illustrate EXACTLY this sense (never an example of a different part of speech), with natural Turkish translations.
3. If there is another very common learner meaning that the user has NOT included, you may include it under "additionalSuggestions" (1-2 max).
4. Preserve the exact client id of each sense.`;

    const userPrompt = `Target English word: "${trimmedWord}"
${contextSentence ? `Context sentence: "${contextSentence}"` : ''}

User-provided senses:
${JSON.stringify(userSenses, null, 2)}

Return valid JSON with structure:
{
  "word": "${trimmedWord}",
  "validatedSenses": [
    {
      "id": "match user sense id",
      "partOfSpeech": "n. | v. | adj. | adv. | prep. | etc.",
      "turkishMeanings": ["string"],
      "shortExplanationTr": "string",
      "aiValidationStatus": "VALID | WARNING | INVALID",
      "aiWarningNote": "string or null",
      "suggestedCorrection": "string or null",
      "examples": [
        { "en": "string", "tr": "string" },
        { "en": "string", "tr": "string" }
      ]
    }
  ],
  "additionalSuggestions": [
    {
      "id": "sugg-1",
      "partOfSpeech": "string",
      "turkishMeanings": ["string"],
      "examples": [
        { "en": "string", "tr": "string" }
      ]
    }
  ],
  "summaryNote": "string"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '';
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);

    return res.json(parsedData);
  } catch (error: any) {
    console.error('Gemini API validate-senses hatası:', error);
    return res.status(500).json({
      error: 'Yapay zekâ doğrulama yapamadı.',
      code: 'AI_ERROR',
      details: error?.message || 'Bilinmeyen hata'
    });
  }
});

// AI Endpoint: Generate natural examples for user-defined Turkish meaning (Hybrid mode)
app.post('/api/ai/generate-examples', async (req, res) => {
  if (!guardAiRequest(req, res)) return;
  recordAiRequest();
  try {
    const { word, turkishMeaning, partOfSpeech, context } = req.body;
    if (!word || typeof word !== 'string') {
      return res.status(400).json({ error: 'Kelime girilmedi.' });
    }

    const ai = getGenAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Yapay zekâ şu anda örnek cümle oluşturamadı. Cümleleri kendiniz ekleyebilirsiniz.',
        code: 'AI_UNAVAILABLE'
      });
    }

    const prompt = `You are a professional English vocabulary teacher.
Target English Word: "${word.trim()}"
Turkish Meaning specified by the user: "${(turkishMeaning || '').trim()}"
${partOfSpeech ? `Part of Speech: ${partOfSpeech}` : ''}
${context ? `Encountered in context: "${context}"` : ''}

Generate EXACTLY 3 natural, high-quality, modern English example sentences that illustrate this specific meaning, along with fluent Turkish translations.
DO NOT use formulaic patterns like "I learned X" or "X is useful".

Return valid JSON:
{
  "examples": [
    { "en": "string", "tr": "string" },
    { "en": "string", "tr": "string" },
    { "en": "string", "tr": "string" }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '';
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);

    if (!Array.isArray(parsedData.examples) || parsedData.examples.length === 0) {
      return res.status(500).json({
        error: 'Örnek cümleler üretilemedi.',
        code: 'AI_EMPTY_EXAMPLES'
      });
    }

    return res.json({ examples: parsedData.examples });
  } catch (error: any) {
    console.error('Gemini API generate-examples hatası:', error);
    return res.status(500).json({
      error: 'Yapay zekâ şu anda örnek cümle oluşturamadı.',
      code: 'AI_ERROR'
    });
  }
});

// ----------------------------------------------------------------------------
// AUTH & CLOUD STORAGE
// ----------------------------------------------------------------------------
//
// Bu bölüm baştan yazıldı. Önceki uygulamadaki açıklar:
//
//   1. Parolalar 32 bitlik, tuzsuz, kriptografik olmayan bir hash ile
//      saklanıyordu (`hash = (hash << 5) - hash + char`). Çakışma üretmek ve
//      geri döndürmek önemsizdi.
//   2. Girişte kontrol `if (user.passwordHash && user.passwordHash !== ...)`
//      şeklindeydi. Parola hash'i olmayan bir hesapta (Google ile açılmış ya da
//      senkronizasyon sonrası kaydı ezilmiş) HERHANGİ bir parola giriş
//      yapıyordu.
//   3. `/api/sync/save` kullanıcı kaydının tamamını gelen gövdeyle
//      değiştiriyordu: `cloudUsersDatabase[email] = { email, ...userData }`.
//      Bu, parola hash'ini ve doğrulama bayrağını siliyor, 2. maddedeki
//      açıkla birleşince hesabı herkese açıyordu.
//   4. Senkronizasyon uçlarında kimlik doğrulama yoktu. `GET
//      /api/sync/load?email=kurban@ornek.com` başkasının tüm verisini
//      döndürüyor, `POST /api/sync/save` başkasının verisini eziyordu.
//   5. `/api/auth/google` herhangi bir e-postayı doğrulamadan kabul ediyordu:
//      kimlik taklidi tek bir isteklik işti. İstemci tarafı ise gerçek bir
//      Google akışı yerine rastgele bir `user.1234@gmail.com` adresi
//      uyduruyordu.
//   6. Özel kartlar tüm kullanıcılar için tek bir dosyada, kimlik doğrulaması
//      olmadan tutuluyordu; herkes herkesin kartını okuyabiliyor ve
//      silebiliyordu.
//   7. Kullanıcılar yalnızca bellekte tutulduğu için sunucu her yeniden
//      başladığında bütün hesaplar siliniyordu.
//
// Yeni tasarım: scrypt + rastgele tuz, sabit zamanlı karşılaştırma, sunucu
// tarafında saklanan oturum jetonları, her uçta sahiplik kontrolü ve disk
// üzerinde kalıcılık.

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün
const VERIFICATION_TTL_MS = 15 * 60 * 1000; // 15 dakika
const MAX_VERIFICATION_ATTEMPTS = 5;
const SCRYPT_KEYLEN = 64;

interface StoredCredential {
  salt: string;
  hash: string;
}

interface CloudUserData {
  email: string;
  name?: string;
  country?: string;
  city?: string;
  emailVerified?: boolean;
  authProvider?: 'google' | 'email' | 'guest';
  credential?: StoredCredential;
  verification?: {
    codeHash: string;
    expiresAt: number;
    attempts: number;
  };
  lastCodeSentAt?: number;
  /** Kullanıcının buluta yedeklediği çalışma verisi. */
  userData?: Record<string, unknown>;
  createdAt?: string;
  lastActive?: string;
  /**
   * Hesap engellendi mi?
   *
   * Engel, hesabı SİLMEZ. Silmek geri alınamaz ve kullanıcının verisini de
   * götürür; engel ise geri alınabilir bir tedbirdir. Engelli hesap giriş
   * yapamaz ve var olan oturumları düşer.
   */
  banned?: boolean;
  bannedReason?: string;
  bannedAt?: string;
}

type UserDatabase = Record<string, CloudUserData>;

function loadUsersFromDisk(): UserDatabase {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed as UserDatabase;
    }
  } catch (err) {
    console.error('Kullanıcı veritabanı okunamadı:', err);
  }
  return {};
}

const cloudUsersDatabase: UserDatabase = loadUsersFromDisk();

let persistTimer: NodeJS.Timeout | null = null;
function persistUsers(): void {
  // Her yazmada diske gitmemek için kısa bir tampon; süreç kapanışında da
  // bir kez daha yazılır.
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(USERS_FILE, JSON.stringify(cloudUsersDatabase, null, 2), 'utf8');
    } catch (err) {
      console.error('Kullanıcı veritabanı yazılamadı:', err);
    }
  }, 250);
}

// ---------------------------------------------------------------------------
// Kullanım ölçümleri
// ---------------------------------------------------------------------------
//
// Yalnızca SAYI tutulur: hangi kullanıcının hangi kelimeyi sorduğu değil,
// gün başına kaç yapay zekâ isteği geldiği. Yönetim panelinin "bu ay ne kadar
// kullanılmış" sorusuna yanıt vermesi için bu yeterli; kimseyi izlemek için
// gereken veri hiç toplanmıyor.

const METRICS_FILE = path.join(DATA_DIR, 'metrics.json');

interface Metrics {
  /** GG biçiminde tarih (YYYY-AA-GG) → istek sayısı. */
  aiRequestsByDay: Record<string, number>;
  aiRequestsTotal: number;
}

function loadMetrics(): Metrics {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          aiRequestsByDay: parsed.aiRequestsByDay || {},
          aiRequestsTotal: Number(parsed.aiRequestsTotal) || 0
        };
      }
    }
  } catch (err) {
    console.error('Ölçüm dosyası okunamadı:', err);
  }
  return { aiRequestsByDay: {}, aiRequestsTotal: 0 };
}

const metrics: Metrics = loadMetrics();

let metricsTimer: NodeJS.Timeout | null = null;
function persistMetrics(): void {
  if (metricsTimer) return;
  metricsTimer = setTimeout(() => {
    metricsTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics), 'utf8');
    } catch (err) {
      console.error('Ölçüm dosyası yazılamadı:', err);
    }
  }, 1000);
}

function recordAiRequest(): void {
  const day = new Date().toISOString().slice(0, 10);
  metrics.aiRequestsByDay[day] = (metrics.aiRequestsByDay[day] || 0) + 1;
  metrics.aiRequestsTotal++;

  // Dosya sonsuza kadar büyümesin: son 90 gün yeter.
  const keys = Object.keys(metrics.aiRequestsByDay).sort();
  if (keys.length > 90) {
    keys.slice(0, keys.length - 90).forEach(key => delete metrics.aiRequestsByDay[key]);
  }
  persistMetrics();
}

// ---------------------------------------------------------------------------
// Ortak yapay zekâ önbelleği ve kota
// ---------------------------------------------------------------------------
//
// ARAMA SIRASI (uygulama + sunucu birlikte)
//   1. Oxford çekirdek sözlüğü          — istemcide, bellekte
//   2. Genel Dağarcık                   — istemcide, harf dosyasından
//   3. Daha önce ÜRETİLMİŞ içerik       — burada, ortak önbellekte
//   4. Bulunamazsa yapay zekâ           — kota içinde
//   5. Üretilen sonuç önbelleğe yazılır
//   6. Aynı kelime için bir daha çağrı yapılmaz
//
// Önbellek ORTAKTIR: bir kullanıcı için üretilen kart, aynı kelimeyi arayan
// herkese anında gelir. Bu hem maliyeti düşürür hem de aynı kelimenin
// kullanıcıdan kullanıcıya farklı anlatılmasını engeller.
//
// Önbellek anahtarı yalnızca kelimedir; kullanıcının yazdığı BAĞLAM cümlesi
// anahtara girmez ama önbellekten dönen kartta bağlama özel alan da
// doldurulmaz. Bağlam isteyen çağrı, önbelleği atlayıp taze üretim ister.

const AI_CACHE_FILE = path.join(DATA_DIR, 'ai-cache.json');

interface CachedCard {
  word: string;
  card: Record<string, unknown>;
  /** Yönetici onayı. Onaysız kart da servis edilir; işaret kalite içindir. */
  approved: boolean;
  flagged: boolean;
  hits: number;
  createdAt: string;
}

interface AiCacheStore {
  cards: Record<string, CachedCard>;
  /** Önbellek sayesinde yapılmayan çağrı sayısı. */
  callsAvoided: number;
  /** Aranıp hiçbir yerde bulunamayan kelimeler: kelime → kaç kez. */
  misses: Record<string, number>;
}

function loadAiCache(): AiCacheStore {
  try {
    if (fs.existsSync(AI_CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(AI_CACHE_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          cards: parsed.cards || {},
          callsAvoided: Number(parsed.callsAvoided) || 0,
          misses: parsed.misses || {}
        };
      }
    }
  } catch (err) {
    console.error('Yapay zekâ önbelleği okunamadı:', err);
  }
  return { cards: {}, callsAvoided: 0, misses: {} };
}

const aiCache: AiCacheStore = loadAiCache();

let aiCacheTimer: NodeJS.Timeout | null = null;
function persistAiCache(): void {
  if (aiCacheTimer) return;
  aiCacheTimer = setTimeout(() => {
    aiCacheTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(AI_CACHE_FILE, JSON.stringify(aiCache), 'utf8');
    } catch (err) {
      console.error('Yapay zekâ önbelleği yazılamadı:', err);
    }
  }, 1000);
}

function cacheKey(word: string): string {
  return word.trim().toLowerCase();
}

/**
 * Günlük yeni üretim kotası.
 *
 * KELİME EKLEMEK SINIRSIZDIR; sınırlanan yalnızca YENİ yapay zekâ üretimidir.
 * Önbellekten gelen yanıt kotadan düşmez, çünkü kimseye maliyeti yok.
 *
 * Kota dolduğunda istek reddedilmez gibi davranılmaz: kullanıcıya durum
 * açıkça söylenir ve kelimeyi elle ekleyebileceği hatırlatılır.
 */
const AI_DAILY_QUOTA = Number(process.env.ANLORA_AI_DAILY_QUOTA) || 200;
const AI_USER_DAILY_QUOTA = Number(process.env.ANLORA_AI_USER_DAILY_QUOTA) || 25;

const aiUsage = {
  day: '',
  total: 0,
  perUser: new Map<string, number>()
};

function rollAiUsage(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (aiUsage.day !== today) {
    aiUsage.day = today;
    aiUsage.total = 0;
    aiUsage.perUser.clear();
  }
}

/** Kota içinde miyiz? Değilsek sebebini döndürür. */
function checkAiQuota(userKey: string): { allowed: boolean; reason?: string } {
  rollAiUsage();

  if (aiUsage.total >= AI_DAILY_QUOTA) {
    return {
      allowed: false,
      reason:
        'Bugünkü yapay zekâ üretim hakkı doldu. Kelimeyi kendin ekleyebilirsin; ' +
        'anlamı ve örnek cümleyi yazman yeterli.'
    };
  }

  const used = aiUsage.perUser.get(userKey) || 0;
  if (used >= AI_USER_DAILY_QUOTA) {
    return {
      allowed: false,
      reason:
        'Bugün için yapay zekâ hakkını kullandın. Kelime eklemeye sınır yok — ' +
        'anlamı kendin yazarak devam edebilirsin.'
    };
  }

  return { allowed: true };
}

function consumeAiQuota(userKey: string): void {
  rollAiUsage();
  aiUsage.total++;
  aiUsage.perUser.set(userKey, (aiUsage.perUser.get(userKey) || 0) + 1);
}


process.on('exit', () => {
  if (persistTimer) {
    clearTimeout(persistTimer);
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(USERS_FILE, JSON.stringify(cloudUsersDatabase, null, 2), 'utf8');
    } catch {
      /* kapanışta yapacak bir şey yok */
    }
  }
});

// ---------------------------------------------------------------------------
// Parola saklama
// ---------------------------------------------------------------------------

/**
 * Parola gücü denetimi.
 *
 * Önceki kural yalnızca "en az 8 karakter"di; "12345678" ya da "parolaparola"
 * geçiyordu. Kural sunucuda uygulanır — istemcideki gösterge yalnızca
 * yardımcıdır, isteği doğrudan atan biri onu atlayabilir.
 *
 * Uzunluk her şeyden önemlidir, o yüzden alt sınır 10'a çekildi; ayrıca
 * küçük harf, büyük harf ve rakam istenir. Noktalama ZORUNLU değil: zorunlu
 * kılmak insanları "Parola1!" gibi tahmin edilebilir kalıplara itiyor.
 *
 * @returns Sorun varsa açıklaması, yoksa null.
 */
function validatePasswordStrength(password: string, email: string): string | null {
  if (password.length < 10) {
    return 'Parola en az 10 karakter olmalı.';
  }
  if (password.length > 200) {
    return 'Parola en fazla 200 karakter olabilir.';
  }
  if (!/[a-zçğıöşü]/.test(password)) {
    return 'Parolada en az bir küçük harf olmalı.';
  }
  if (!/[A-ZÇĞİÖŞÜ]/.test(password)) {
    return 'Parolada en az bir büyük harf olmalı.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Parolada en az bir rakam olmalı.';
  }

  const lower = password.toLowerCase();

  // Aynı karakterin tekrarı ya da düz artan diziler uzun olsa da zayıftır.
  if (/^(.)\1+$/.test(password)) {
    return 'Parola aynı karakterin tekrarı olamaz.';
  }
  if (lower.includes('123456') || lower.includes('abcdef') || lower.includes('qwerty')) {
    return 'Parola tahmin edilmesi kolay bir dizi içeriyor.';
  }

  const common = [
    'password', 'parola', 'sifre', 'şifre', 'anlora', 'qwerty',
    'iloveyou', 'admin123', 'welcome1', 'letmein'
  ];
  if (common.some(entry => lower.includes(entry))) {
    return 'Parola çok yaygın bir sözcük içeriyor. Başka bir şey dene.';
  }

  // E-postanın kullanıcı adı kısmı parolanın içinde olmamalı.
  const localPart = (email.split('@')[0] || '').toLowerCase();
  if (localPart.length >= 4 && lower.includes(localPart)) {
    return 'Parola e-posta adresini içeremez.';
  }

  return null;
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): StoredCredential {
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, credential: StoredCredential | undefined): boolean {
  if (!credential || !credential.salt || !credential.hash) return false;
  const candidate = crypto.scryptSync(password, credential.salt, SCRYPT_KEYLEN);
  let expected: Buffer;
  try {
    expected = Buffer.from(credential.hash, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== candidate.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateVerificationCode(): string {
  // `Math.random()` tahmin edilebilir; doğrulama kodu kriptografik olmalı.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// ---------------------------------------------------------------------------
// Oturum jetonları
// ---------------------------------------------------------------------------

interface Session {
  email: string;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

function createSession(email: string): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { email, expiresAt });
  return { token, expiresAt };
}

function resolveSession(token: string | undefined): CloudUserData | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return cloudUsersDatabase[session.email] || null;
}

function revokeSessionsFor(email: string): void {
  for (const [token, session] of sessions) {
    if (session.email === email) sessions.delete(token);
  }
}

interface AuthedRequest extends express.Request {
  authUser?: CloudUserData;
}

/**
 * `Authorization: Bearer <token>` başlığını doğrular.
 * Kimliği geçersiz olan istek hiçbir kullanıcı verisine erişemez.
 */
function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const user = resolveSession(token);
  if (!user) {
    return res.status(401).json({ error: 'Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.' });
  }
  if (user.banned) {
    // Engel sırasında açık kalmış bir oturum varsa burada da kapanır.
    revokeSessionsFor(user.email);
    return res.status(403).json({
      error: user.bannedReason
        ? `Hesabın askıya alındı: ${user.bannedReason}`
        : 'Hesabın askıya alındı.',
      code: 'ACCOUNT_BANNED'
    });
  }
  req.authUser = user;
  next();
}

/** İstemciye dönen güvenli kullanıcı görünümü — kimlik bilgisi asla sızmaz. */
function publicUserView(user: CloudUserData) {
  return {
    email: user.email,
    name: user.name,
    country: user.country,
    city: user.city,
    emailVerified: !!user.emailVerified,
    authProvider: user.authProvider || 'email',
    // Arayüz yönetim girişini yalnızca yetkili kullanıcıya göstersin diye.
    // Yetki DENETİMİ burada değil, her yönetim ucunda ayrıca yapılır: bu
    // alanla oynayan bir istemci hiçbir şey kazanmaz.
    isAdmin: isAdminEmail(user.email)
  };
}

// ---------------------------------------------------------------------------
// Yönetim yetkisi
// ---------------------------------------------------------------------------
//
// Yönetici listesi ortam değişkeninden okunur; veritabanında "rol" alanı
// tutulmaz. Gerekçe: rolü veriye yazmak, veriyi ele geçiren birinin kendini
// yönetici yapmasına kapı açar. Ortam değişkeni sunucuyu çalıştıranın
// elindedir ve uygulama içinden değiştirilemez.
//
// Değer virgülle ayrılmış e-posta listesidir:
//   ANLORA_ADMIN_EMAILS="ben@ornek.com,ortak@ornek.com"
// Tanımlı değilse yönetim uçlarının tamamı kapalıdır.

const ADMIN_EMAILS = new Set(
  (process.env.ANLORA_ADMIN_EMAILS || '')
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
);

function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Yönetim uçlarını korur. `requireAuth`'tan SONRA zincire girer.
 *
 * Yetkisiz istek 403 değil 404 alır. 403 "burada bir yönetim ucu var ama
 * sana kapalı" demektir; bu bilgi bile saldırgana yol gösterir. 404, ucun
 * varlığını hiç açık etmez.
 */
function requireAdmin(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const user = req.authUser;
  if (!user || !isAdminEmail(user.email)) {
    return res.status(404).json({ error: 'Bulunamadı.' });
  }
  next();
}

/**
 * Yönetim panelinde gösterilen kullanıcı görünümü.
 *
 * GİZLİLİK: parola özeti, doğrulama kodu, oturum jetonu ve kullanıcının
 * kelimelerinin KENDİSİ asla dönmez. Yönetici hesabı yönetebilmeli ama
 * insanların ne çalıştığını okuyamamalı; bu yüzden yalnızca sayılar verilir.
 */
function adminUserView(user: CloudUserData) {
  const data = (user.userData || {}) as Record<string, unknown>;
  const countOf = (key: string): number => {
    const value = data[key];
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return 0;
  };

  let backupBytes = 0;
  try {
    backupBytes = user.userData ? JSON.stringify(user.userData).length : 0;
  } catch {
    backupBytes = 0;
  }

  let activeSessions = 0;
  for (const session of sessions.values()) {
    if (session.email === user.email && session.expiresAt > Date.now()) activeSessions++;
  }

  return {
    email: user.email,
    name: user.name || '',
    country: user.country || '',
    city: user.city || '',
    authProvider: user.authProvider || 'email',
    emailVerified: !!user.emailVerified,
    isAdmin: isAdminEmail(user.email),
    banned: !!user.banned,
    bannedReason: user.bannedReason || '',
    createdAt: user.createdAt || null,
    lastActive: user.lastActive || null,
    activeSessions,
    hasPendingVerification: !!user.verification,
    backupBytes,
    counts: {
      collections: countOf('collections'),
      customWords: countOf('customWords'),
      favorites: countOf('favorites'),
      learningStates: countOf('learningStates')
    }
  };
}

function createEmptyUser(
  email: string,
  name: string,
  country: string,
  city: string,
  authProvider: 'google' | 'email'
): CloudUserData {
  const now = new Date().toISOString();
  return {
    email,
    name,
    country,
    city,
    emailVerified: authProvider === 'google',
    authProvider,
    userData: {},
    createdAt: now,
    lastActive: now
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// 1. Google ile giriş
// ---------------------------------------------------------------------------
//
// Gerçek bir Google ID jetonu bekler ve Google'ın tokeninfo ucunda doğrular.
// `GOOGLE_CLIENT_ID` tanımlı değilse uç kapalıdır: sahte bir "Google girişi"
// sunmaktansa özelliğin yapılandırılmadığını dürüstçe söylemek daha doğru.
app.post('/api/auth/google', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const rate = checkRateLimit(ip, 20, 60000);
  if (!rate.allowed) {
    return res.status(429).json({ error: `Çok fazla deneme yapıldı. Lütfen ${rate.retryAfter || 60} saniye sonra tekrar deneyin.` });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({
      error: 'Google ile giriş bu kurulumda yapılandırılmamış. Lütfen e-posta ile giriş yapın.',
      code: 'GOOGLE_AUTH_NOT_CONFIGURED'
    });
  }

  const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
  if (!credential) {
    return res.status(400).json({ error: 'Google kimlik jetonu gönderilmedi.' });
  }

  let payload: any;
  try {
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!verifyRes.ok) throw new Error(`tokeninfo ${verifyRes.status}`);
    payload = await verifyRes.json();
  } catch (err) {
    console.error('Google jetonu doğrulanamadı:', err);
    return res.status(401).json({ error: 'Google kimlik doğrulaması başarısız oldu.' });
  }

  const audienceOk = payload?.aud === clientId;
  const issuerOk = payload?.iss === 'accounts.google.com' || payload?.iss === 'https://accounts.google.com';
  const notExpired = Number(payload?.exp) * 1000 > Date.now();
  const emailVerified = payload?.email_verified === true || payload?.email_verified === 'true';

  if (!audienceOk || !issuerOk || !notExpired || !emailVerified || !payload?.email) {
    return res.status(401).json({ error: 'Google kimlik jetonu geçersiz.' });
  }

  const email = String(payload.email).toLowerCase();
  const name = sanitizeString(payload.name, 100) || email.split('@')[0];

  let user = cloudUsersDatabase[email];
  if (!user) {
    user = createEmptyUser(email, name, 'Türkiye', 'İstanbul', 'google');
    cloudUsersDatabase[email] = user;
  } else {
    user.emailVerified = true;
    user.lastActive = new Date().toISOString();
  }
  persistUsers();

  const session = createSession(email);
  return res.json({
    message: 'Google ile giriş başarılı.',
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicUserView(user),
    userData: user.userData || {}
  });
});

// ---------------------------------------------------------------------------
// 2. E-posta / parola ile kayıt
// ---------------------------------------------------------------------------
app.post('/api/auth/register', blockDuringMaintenance, (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  // Honeypot check for bots
  if (req.body.hp_website && String(req.body.hp_website).trim().length > 0) {
    return res.status(400).json({ error: 'İşlem gerçekleştirilemedi.' });
  }

  const rate = checkRateLimit(ip, 8, 60000);
  if (!rate.allowed) {
    return res.status(429).json({ error: `Kısa sürede çok fazla deneme yapıldı. Lütfen ${rate.retryAfter || 60} saniye bekleyin.` });
  }

  const { email, password, name, country, city } = req.body;
  const cleanEmail = sanitizeString(email, 120).toLowerCase();
  const cleanPassword = typeof password === 'string' ? password : '';
  const cleanName = sanitizeString(name, 100) || cleanEmail.split('@')[0];
  const cleanCountry = sanitizeString(country, 60) || 'Türkiye';
  const cleanCity = sanitizeString(city, 60) || 'İstanbul';

  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    return res.status(400).json({ error: 'Lütfen geçerli bir e-posta adresi girin.' });
  }

  const passwordProblem = validatePasswordStrength(cleanPassword, cleanEmail);
  if (passwordProblem) {
    return res.status(400).json({ error: passwordProblem, code: 'WEAK_PASSWORD' });
  }

  if (cloudUsersDatabase[cleanEmail]) {
    return res.status(400).json({ error: 'Bu e-posta adresiyle kayıtlı bir hesap zaten var.' });
  }

  const code = generateVerificationCode();
  const user = createEmptyUser(cleanEmail, cleanName, cleanCountry, cleanCity, 'email');
  user.emailVerified = false;
  user.credential = hashPassword(cleanPassword);
  user.verification = {
    codeHash: hashVerificationCode(code),
    expiresAt: Date.now() + VERIFICATION_TTL_MS,
    attempts: 0
  };
  user.lastCodeSentAt = Date.now();
  cloudUsersDatabase[cleanEmail] = user;
  persistUsers();

  deliverVerificationCode(cleanEmail, code);

  return res.json({
    message: 'Hesap oluşturuldu. Lütfen e-postanıza gönderilen 6 haneli doğrulama kodunu girin.',
    email: cleanEmail,
    name: cleanName,
    country: cleanCountry,
    city: cleanCity,
    emailVerified: false,
    devCode: exposeDevCode() ? code : undefined
  });
});

/**
 * Doğrulama kodunun kullanıcıya ulaştırılması.
 *
 * Bu kurulumda e-posta gönderimi yok; kod sunucu günlüğüne yazılır. Gerçek bir
 * dağıtımda burası bir e-posta sağlayıcısına bağlanmalıdır.
 */
function deliverVerificationCode(email: string, code: string): void {
  console.log(`[ANLORA AUTH] Doğrulama kodu: ${email} -> ${code}`);
}

/**
 * Kodun HTTP yanıtında döndürülüp döndürülmeyeceği.
 * Yalnızca açıkça izin verildiğinde ve üretim dışında açılır.
 */
function exposeDevCode(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ANLORA_EXPOSE_DEV_CODE === 'true';
}

// ---------------------------------------------------------------------------
// 3. E-posta doğrulama
// ---------------------------------------------------------------------------
app.post('/api/auth/verify-email', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const rate = checkRateLimit(ip, 15, 60000);
  if (!rate.allowed) {
    return res.status(429).json({ error: `Çok fazla deneme. Lütfen ${rate.retryAfter || 60} saniye bekleyin.` });
  }

  const cleanEmail = sanitizeString(req.body?.email, 120).toLowerCase();
  const cleanCode = sanitizeString(req.body?.code, 10).trim();

  const user = cloudUsersDatabase[cleanEmail];
  if (!user) {
    return res.status(404).json({ error: 'Kullanıcı hesabı bulunamadı.' });
  }

  if (user.emailVerified) {
    const session = createSession(user.email);
    return res.json({
      message: 'E-posta zaten doğrulanmış.',
      token: session.token,
      expiresAt: session.expiresAt,
      user: publicUserView(user),
      userData: user.userData || {}
    });
  }

  const verification = user.verification;
  if (!verification) {
    return res.status(400).json({ error: 'Bekleyen bir doğrulama kodu yok. Lütfen yeni kod isteyin.' });
  }

  // Süre kontrolü kod kontrolünden önce: süresi dolmuş kodu denemek
  // deneme hakkı harcamamalı.
  if (verification.expiresAt < Date.now()) {
    delete user.verification;
    persistUsers();
    return res.status(400).json({ error: 'Doğrulama kodunun süresi dolmuş. Lütfen yeni kod isteyin.' });
  }

  // Hesap başına deneme sınırı: IP sınırı tek başına kaba kuvvet denemesini
  // durdurmaz, saldırgan IP değiştirebilir.
  if (verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    delete user.verification;
    persistUsers();
    return res.status(429).json({ error: 'Çok fazla hatalı kod girildi. Lütfen yeni kod isteyin.' });
  }

  const candidate = Buffer.from(hashVerificationCode(cleanCode), 'hex');
  const expected = Buffer.from(verification.codeHash, 'hex');
  const matches =
    candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);

  if (!matches) {
    verification.attempts += 1;
    persistUsers();
    const remaining = MAX_VERIFICATION_ATTEMPTS - verification.attempts;
    return res.status(400).json({
      error:
        remaining > 0
          ? `Girdiğiniz doğrulama kodu hatalı. ${remaining} deneme hakkınız kaldı.`
          : 'Girdiğiniz doğrulama kodu hatalı. Lütfen yeni kod isteyin.'
    });
  }

  user.emailVerified = true;
  delete user.verification;
  user.lastActive = new Date().toISOString();
  persistUsers();

  const session = createSession(user.email);
  return res.json({
    message: 'E-posta adresiniz başarıyla doğrulandı!',
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicUserView(user),
    userData: user.userData || {}
  });
});

// ---------------------------------------------------------------------------
// 4. Doğrulama kodunu yeniden gönder
// ---------------------------------------------------------------------------
app.post('/api/auth/resend-code', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const rate = checkRateLimit(ip, 6, 60000);
  if (!rate.allowed) {
    return res.status(429).json({ error: `Lütfen tekrar denemeden önce ${rate.retryAfter || 60} saniye bekleyin.` });
  }

  const cleanEmail = sanitizeString(req.body?.email, 120).toLowerCase();
  const user = cloudUsersDatabase[cleanEmail];

  // Hesabın var olup olmadığını sızdırmamak için yanıt her durumda aynı.
  const genericResponse = { message: 'Hesap varsa yeni doğrulama kodu gönderildi.' };

  if (!user || user.emailVerified) {
    return res.json(genericResponse);
  }

  if (user.lastCodeSentAt && Date.now() - user.lastCodeSentAt < 60000) {
    const remaining = Math.ceil((60000 - (Date.now() - user.lastCodeSentAt)) / 1000);
    return res.status(429).json({ error: `Yeni kod istemek için lütfen ${remaining} saniye bekleyin.` });
  }

  const code = generateVerificationCode();
  user.verification = {
    codeHash: hashVerificationCode(code),
    expiresAt: Date.now() + VERIFICATION_TTL_MS,
    attempts: 0
  };
  user.lastCodeSentAt = Date.now();
  persistUsers();

  deliverVerificationCode(cleanEmail, code);

  return res.json({ ...genericResponse, devCode: exposeDevCode() ? code : undefined });
});

// ---------------------------------------------------------------------------
// 5. E-posta / parola ile giriş
// ---------------------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const rate = checkRateLimit(ip, 12, 60000);
  if (!rate.allowed) {
    return res.status(429).json({ error: `Çok fazla hatalı giriş denemesi. Lütfen ${rate.retryAfter || 60} saniye bekleyin.` });
  }

  const cleanEmail = sanitizeString(req.body?.email, 120).toLowerCase();
  const cleanPassword = typeof req.body?.password === 'string' ? req.body.password : '';

  const user = cloudUsersDatabase[cleanEmail];

  // Hesabın varlığını sızdırmamak için kimlik hatalarında tek bir mesaj.
  const invalidCredentials = () => {
    // Kayıt tutulur ama yanıt hep aynı: hesabın varlığı sızdırılmaz.
    if (cleanEmail) recordFailedLogin(cleanEmail, ip);
    return res.status(401).json({ error: 'E-posta adresi veya parola hatalı.' });
  };

  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail) || !cleanPassword) {
    return invalidCredentials();
  }
  if (!user) {
    return invalidCredentials();
  }

  // Parola kimliği olmayan hesap parola ile giremez. Eski sürümde bu durumda
  // kontrol tamamen atlanıyor ve herhangi bir parola kabul ediliyordu.
  if (!user.credential) {
    return res.status(401).json({
      error: 'Bu hesap parola ile açılmamış. Lütfen hesabı açtığınız yöntemle giriş yapın.'
    });
  }

  if (!verifyPassword(cleanPassword, user.credential)) {
    return invalidCredentials();
  }

  /*
   * Engel denetimi parola DOĞRULANDIKTAN sonra yapılır.
   *
   * Önce yapılsaydı, doğru parolayı bilmeyen biri de bir hesabın engelli
   * olduğunu öğrenebilirdi. Sıra böyle olunca bu bilgi yalnızca hesabın
   * sahibine ulaşıyor.
   */
  if (user.banned) {
    return res.status(403).json({
      error: user.bannedReason
        ? `Hesabın askıya alındı: ${user.bannedReason}`
        : 'Hesabın askıya alındı. İtiraz için uygulama içinden bize yazabilirsin.',
      code: 'ACCOUNT_BANNED'
    });
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      error: 'E-posta adresiniz henüz doğrulanmadı. Lütfen size gönderilen kodu girin.',
      code: 'EMAIL_NOT_VERIFIED',
      email: user.email
    });
  }

  user.lastActive = new Date().toISOString();
  persistUsers();

  const session = createSession(user.email);
  return res.json({
    message: 'Giriş başarılı.',
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicUserView(user),
    userData: user.userData || {}
  });
});

// ---------------------------------------------------------------------------
// 6. Çıkış
// ---------------------------------------------------------------------------
app.post('/api/auth/logout', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) sessions.delete(token);
  return res.json({ message: 'Oturum kapatıldı.' });
});

// ---------------------------------------------------------------------------
// 7. Bulut senkronizasyonu — yalnızca oturum sahibinin kendi verisi
// ---------------------------------------------------------------------------
/**
 * Kullanıcının kendi hesabını ve bulut verisini silmesi.
 *
 * KVKK/GDPR'ın "silinme hakkı" maddesi bunu gerektirir; ayrıca hesabını
 * kapatmak için destek yazmak zorunda kalmak, kullanıcıyı kendi verisinin
 * sahibi olmaktan çıkarır.
 *
 * Parola tekrar istenir: oturumu açık kalmış bir telefonu eline geçiren
 * birinin hesabı silmesini engeller. Google ile açılmış hesaplarda parola
 * yoktur; orada e-postanın birebir yazılması istenir.
 */
app.delete('/api/account', requireAuth, (req: AuthedRequest, res) => {
  const user = req.authUser!;

  if (user.credential) {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!verifyPassword(password, user.credential)) {
      return res.status(401).json({ error: 'Parola hatalı.' });
    }
  } else {
    const confirm = sanitizeString(req.body?.confirmEmail, 120).toLowerCase();
    if (confirm !== user.email.toLowerCase()) {
      return res.status(400).json({ error: 'Onaylamak için e-posta adresini birebir yaz.' });
    }
  }

  revokeSessionsFor(user.email);
  delete cloudUsersDatabase[user.email];
  persistUsers();

  return res.json({ deleted: true });
});

app.post('/api/sync/save', blockDuringMaintenance, requireAuth, (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const payload = req.body?.userData;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ error: 'Geçersiz senkronizasyon verisi.' });
  }

  // Yalnızca çalışma verisi güncellenir. Eski sürümde kaydın tamamı gelen
  // gövdeyle değiştiriliyor, böylece parola ve doğrulama bilgisi siliniyordu.
  user.userData = payload;
  user.lastActive = new Date().toISOString();
  persistUsers();

  return res.json({
    message: 'Verileriniz buluta başarıyla kaydedildi.',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/sync/load', requireAuth, (req: AuthedRequest, res) => {
  const user = req.authUser!;
  return res.json({ userData: user.userData || {} });
});

// ---------------------------------------------------------------------------
// 8. Özel kartlar — kullanıcı başına, kimlik doğrulamalı
// ---------------------------------------------------------------------------

function readUserCards(user: CloudUserData): any[] {
  const cards = (user.userData as any)?.customWords;
  return Array.isArray(cards) ? cards : [];
}

function writeUserCards(user: CloudUserData, cards: any[]): void {
  if (!user.userData || typeof user.userData !== 'object') user.userData = {};
  (user.userData as any).customWords = cards;
  user.lastActive = new Date().toISOString();
  persistUsers();
}

app.get('/api/custom-cards', requireAuth, (req: AuthedRequest, res) => {
  return res.json({ cards: readUserCards(req.authUser!) });
});

app.post('/api/custom-cards', requireAuth, (req: AuthedRequest, res) => {
  const newCard = req.body;
  if (!newCard || typeof newCard !== 'object' || !newCard.id || !newCard.word) {
    return res.status(400).json({ error: 'Eksik veya geçersiz kart verisi.' });
  }
  const cards = readUserCards(req.authUser!);
  const existingIdx = cards.findIndex(c => c.id === newCard.id);
  if (existingIdx !== -1) {
    cards[existingIdx] = newCard;
  } else {
    cards.unshift(newCard);
  }
  writeUserCards(req.authUser!, cards);
  return res.json({ message: 'Kart buluta kaydedildi.', card: newCard, totalCount: cards.length });
});

app.put('/api/custom-cards/:id', requireAuth, (req: AuthedRequest, res) => {
  const { id } = req.params;
  const updatedCard = req.body;
  if (!updatedCard || typeof updatedCard !== 'object' || !updatedCard.word) {
    return res.status(400).json({ error: 'Geçersiz kart verisi.' });
  }
  const cards = readUserCards(req.authUser!);
  const index = cards.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Güncellenecek kart bulunamadı.' });
  }
  cards[index] = { ...cards[index], ...updatedCard, id };
  writeUserCards(req.authUser!, cards);
  return res.json({ message: 'Kart güncellendi.', card: cards[index] });
});

app.delete('/api/custom-cards/:id', requireAuth, (req: AuthedRequest, res) => {
  const { id } = req.params;
  const cards = readUserCards(req.authUser!).filter(c => c.id !== id);
  writeUserCards(req.authUser!, cards);
  return res.json({ message: 'Kart silindi.', totalCount: cards.length });
});

// ---------------------------------------------------------------------------
// Uygulama içeriği: reklam alanları, duyurular, geri bildirim
// ---------------------------------------------------------------------------
//
// Üçü de aynı dosyada saklanır çünkü aynı şeyin parçaları: yöneticinin
// uygulamanın içine koyabildiği ya da uygulamadan topladığı içerik.
// Kullanıcı verisinden (users.json) ayrı durur; biri silinse diğeri etkilenmez.

const CONTENT_FILE = path.join(DATA_DIR, 'content.json');

/**
 * Reklam alanları uygulamada SABİT noktalardır.
 *
 * Kimlikler burada tanımlıdır çünkü arayüzün nereye bakacağını bilmesi
 * gerekir. Yönetici yeni bir yer icat edemez; var olan yerleri doldurur ya
 * da boş bırakır. Boş bırakılan alan arayüzde HİÇ ÇİZİLMEZ — reklamsız
 * uygulamada boşluk ya da "reklam alanı" yazısı görünmez.
 */
const AD_SLOTS = [
  { id: 'home-top', label: 'Ana sayfa · üst' },
  { id: 'home-bottom', label: 'Ana sayfa · alt' },
  { id: 'word-list', label: 'Kelime listesi · aralara' },
  { id: 'study-end', label: 'Çalışma sonu' }
] as const;

type AdSlotId = (typeof AD_SLOTS)[number]['id'];

interface AdSlotContent {
  /** Reklam ağının verdiği gömme kodu. Boşsa alan görünmez. */
  html: string;
  enabled: boolean;
  updatedAt: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  /** 'all' herkese, 'verified' yalnızca e-postası doğrulanmış hesaplara. */
  audience: 'all' | 'verified';
  active: boolean;
  createdAt: string;
}

type FeedbackKind = 'word' | 'design' | 'bug' | 'idea' | 'other';
type FeedbackStatus = 'new' | 'read' | 'resolved';

interface FeedbackEntry {
  id: string;
  kind: FeedbackKind;
  message: string;
  /** Kelime hatası bildiriliyorsa hangi kelime. */
  word?: string;
  /** Giriş yapılmışsa hesabın e-postası; anonim bildirimlerde boş. */
  email?: string;
  /** Yanıt istiyorsa bıraktığı adres. */
  replyTo?: string;
  platform?: string;
  status: FeedbackStatus;
  adminNote?: string;
  createdAt: string;
}

/**
 * Yöneticinin düzenleyebildiği marka ve metinler.
 *
 * Buradaki logo UYGULAMA İÇİNDEKİ logodur ve panelden değiştirildiği anda
 * değişir. Telefonun ana ekranındaki başlatıcı ikonu kapsam dışıdır: o,
 * APK'ya derleme anında gömülür ve işletim sistemi çalışan uygulamanın onu
 * değiştirmesine izin vermez.
 *
 * Alanlar boşsa uygulama pakete gömülü varsayılanı kullanır; böylece sunucuya
 * ulaşılamayan çevrimdışı kullanımda arayüz boş kalmaz.
 */
interface Branding {
  /** Uygulama içi logo, data URI olarak. Boşsa gömülü işaret kullanılır. */
  logoDataUri?: string;
  appName?: string;
  slogan?: string;
  /** Ana sayfadaki tanıtım paragrafı. */
  homeIntro?: string;
  /** Kelime setleri kutusunun açıklaması. */
  setsIntro?: string;
  /** Sözlük/yapay zekâ kutusunun başlığı ve metni. */
  lookupTitle?: string;
  lookupBody?: string;
  updatedAt?: string;
}

interface AppContent {
  ads: Record<string, AdSlotContent>;
  announcements: Announcement[];
  feedback: FeedbackEntry[];
  branding: Branding;
}

function loadContent(): AppContent {
  try {
    if (fs.existsSync(CONTENT_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          ads: parsed.ads || {},
          announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
          feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
          branding: parsed.branding || {}
        };
      }
    }
  } catch (err) {
    console.error('İçerik dosyası okunamadı:', err);
  }
  return { ads: {}, announcements: [], feedback: [], branding: {} };
}

const appContent: AppContent = loadContent();

let contentTimer: NodeJS.Timeout | null = null;
function persistContent(): void {
  if (contentTimer) return;
  contentTimer = setTimeout(() => {
    contentTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(CONTENT_FILE, JSON.stringify(appContent, null, 2), 'utf8');
    } catch (err) {
      console.error('İçerik dosyası yazılamadı:', err);
    }
  }, 250);
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

// --- Uygulamanın okuduğu uçlar (yönetici olmayan) --------------------------

/**
 * Uygulamanın açılışta çektiği içerik: dolu reklam alanları ve yayındaki
 * duyurular. Kimlik doğrulaması İSTEĞE BAĞLIDIR — giriş yapmamış kullanıcı da
 * duyuru görebilmeli. Yalnızca 'verified' hedefli duyurular gizlenir.
 */
app.get('/api/app-content', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const user = resolveSession(token);

  const ads: Record<string, string> = {};
  for (const slot of AD_SLOTS) {
    const entry = appContent.ads[slot.id];
    // Kapalı ya da boş alan yanıta HİÇ girmez: istemci "var ama boş" diye
    // bir durumla uğraşmasın, alan yoksa çizmesin.
    if (entry && entry.enabled && entry.html.trim()) ads[slot.id] = entry.html;
  }

  const announcements = appContent.announcements
    .filter(a => a.active)
    .filter(a => a.audience === 'all' || (user && user.emailVerified))
    .map(({ id, title, body, createdAt }) => ({ id, title, body, createdAt }));

  /*
   * Marka alanlarından yalnızca DOLU olanlar gönderilir. Boş bir alan
   * göndermek, istemcide "sunucu boş dedi" ile "sunucu bir şey demedi"
   * arasındaki farkı siler ve varsayılan metinleri silerdi.
   */
  const branding: Record<string, string> = {};
  const b = appContent.branding || {};
  (['logoDataUri', 'appName', 'slogan', 'homeIntro', 'setsIntro', 'lookupTitle', 'lookupBody'] as const)
    .forEach(key => {
      const value = (b[key] || '').trim();
      if (value) branding[key] = value;
    });

  return res.json({ ads, announcements, branding });
});

/**
 * Kullanıcıdan gelen bildirim: kelime hatası, tasarım sorunu, öneri.
 *
 * Giriş şartı yok. Hata bildirmek için hesap açmak zorunda bırakmak,
 * bildirimlerin çoğunun hiç gelmemesi demektir.
 */
app.post('/api/feedback', blockDuringMaintenance, (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  // Bot koruması: gizli alan doluysa istek sessizce reddedilir.
  if (req.body?.hp_website && String(req.body.hp_website).trim().length > 0) {
    return res.status(400).json({ error: 'İşlem gerçekleştirilemedi.' });
  }

  const rate = checkRateLimit(`fb:${ip}`, 5, 60000);
  if (!rate.allowed) {
    return res.status(429).json({
      error: `Kısa sürede çok fazla bildirim gönderildi. Lütfen ${rate.retryAfter || 60} saniye bekleyin.`
    });
  }

  const allowedKinds: FeedbackKind[] = ['word', 'design', 'bug', 'idea', 'other'];
  const kind = allowedKinds.includes(req.body?.kind) ? (req.body.kind as FeedbackKind) : 'other';
  const message = sanitizeString(req.body?.message, 2000);

  if (message.length < 5) {
    return res.status(400).json({ error: 'Lütfen sorunu birkaç kelimeyle anlat.' });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const user = resolveSession(token);

  const entry: FeedbackEntry = {
    id: newId('fb'),
    kind,
    message,
    word: sanitizeString(req.body?.word, 80) || undefined,
    email: user?.email,
    replyTo: sanitizeString(req.body?.replyTo, 120) || undefined,
    platform: sanitizeString(req.body?.platform, 60) || undefined,
    status: 'new',
    createdAt: new Date().toISOString()
  };

  appContent.feedback.unshift(entry);
  // Dosya sınırsız büyümesin; en yeni 2000 bildirim yeter.
  if (appContent.feedback.length > 2000) appContent.feedback.length = 2000;
  persistContent();

  return res.json({ ok: true, id: entry.id });
});

// ---------------------------------------------------------------------------
// Yönetim paneli uçları
// ---------------------------------------------------------------------------
//
// Hepsi `requireAuth` + `requireAdmin` zincirinden geçer. Yetki, veritabanında
// değil `ANLORA_ADMIN_EMAILS` ortam değişkeninde tanımlıdır; bu değişken
// tanımlı değilse uçların tamamı 404 döner ve panel hiç açılmaz.
//
// GİZLİLİK SINIRI: yönetici hesapları görebilir ve yönetebilir, ama insanların
// kelimelerini OKUYAMAZ. Uçlar yalnızca sayı ve meta veri döndürür.

app.get('/api/admin/overview', requireAuth, requireAdmin, (_req, res) => {
  const users = Object.values(cloudUsersDatabase);
  const now = Date.now();
  const daysAgo = (days: number) => now - days * 24 * 60 * 60 * 1000;

  const activeSince = (since: number) =>
    users.filter(u => u.lastActive && Date.parse(u.lastActive) >= since).length;

  const newSince = (since: number) =>
    users.filter(u => u.createdAt && Date.parse(u.createdAt) >= since).length;

  let activeSessions = 0;
  for (const session of sessions.values()) {
    if (session.expiresAt > now) activeSessions++;
  }

  // Son 14 günün yapay zekâ kullanımı; panelde çubuk olarak çizilir.
  const aiDaily: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    aiDaily.push({ day, count: metrics.aiRequestsByDay[day] || 0 });
  }

  return res.json({
    users: {
      total: users.length,
      verified: users.filter(u => u.emailVerified).length,
      pendingVerification: users.filter(u => u.verification).length,
      withCloudBackup: users.filter(u => u.userData && Object.keys(u.userData).length > 0).length,
      activeLast7Days: activeSince(daysAgo(7)),
      activeLast30Days: activeSince(daysAgo(30)),
      newLast7Days: newSince(daysAgo(7))
    },
    sessions: { active: activeSessions },
    ai: {
      total: metrics.aiRequestsTotal,
      today: metrics.aiRequestsByDay[new Date().toISOString().slice(0, 10)] || 0,
      daily: aiDaily,
      configured: !!process.env.GEMINI_API_KEY
    },
    server: {
      googleSignInConfigured: !!process.env.GOOGLE_CLIENT_ID,
      adminCount: ADMIN_EMAILS.size
    }
  });
});

app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let list = Object.values(cloudUsersDatabase);
  if (query) {
    list = list.filter(
      u =>
        (u.email || '').toLowerCase().includes(query) ||
        (u.name || '').toLowerCase().includes(query)
    );
  }

  // En son görülen en üstte: yönetici çoğunlukla "kim aktif" diye bakar.
  list.sort((a, b) => Date.parse(b.lastActive || '0') - Date.parse(a.lastActive || '0'));

  return res.json({
    total: list.length,
    offset,
    limit,
    users: list.slice(offset, offset + limit).map(adminUserView)
  });
});

/** Yönetim uçlarında hedef kullanıcıyı çözer. */
function findTargetUser(req: express.Request): CloudUserData | null {
  const email = String(req.params.email || '').trim().toLowerCase();
  if (!email) return null;
  return cloudUsersDatabase[email] || null;
}

/**
 * E-postayı elle doğrulanmış sayar.
 *
 * Kod e-postası ulaşmadığında kullanıcı hesabına giremiyor. Destek adımı
 * olarak gerekli; kaydı silip yeniden açtırmaktan çok daha az zarar verir.
 */
app.post('/api/admin/users/:email/verify', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const user = findTargetUser(req);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  user.emailVerified = true;
  delete user.verification;
  persistUsers();
  recordAudit(req, 'e-posta elle doğrulandı', user.email);
  return res.json({ user: adminUserView(user) });
});

/** Kullanıcının tüm oturumlarını kapatır (cihaz kaybı, şüpheli erişim). */
app.post('/api/admin/users/:email/revoke-sessions', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const user = findTargetUser(req);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  revokeSessionsFor(user.email);
  recordAudit(req, 'oturumlar kapatıldı', user.email);
  return res.json({ user: adminUserView(user) });
});

/**
 * Hesabı ve bulut yedeğini siler.
 *
 * Silme, e-postanın gövdede TEKRAR yazılmasını ister. Tek tıkla geri
 * alınamaz bir işlem yapmak, yanlış satıra dokunan yöneticiyi felakete
 * götürür. Ayrıca yönetici kendi hesabını silemez: paneli kilitleyecek
 * bir kaza olurdu.
 */
app.delete('/api/admin/users/:email', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const user = findTargetUser(req);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  const confirm = String(req.body?.confirmEmail || '').trim().toLowerCase();
  if (confirm !== user.email.toLowerCase()) {
    return res.status(400).json({
      error: 'Silmek için e-posta adresini birebir yazman gerekiyor.'
    });
  }

  if (req.authUser && req.authUser.email.toLowerCase() === user.email.toLowerCase()) {
    return res.status(400).json({ error: 'Kendi yönetici hesabını buradan silemezsin.' });
  }

  revokeSessionsFor(user.email);
  delete cloudUsersDatabase[user.email];
  persistUsers();
  recordAudit(req, 'hesap silindi', user.email);
  return res.json({ deleted: user.email });
});

// ---------------------------------------------------------------------------
// Yönetici sözlüğü (CMS)
// ---------------------------------------------------------------------------
//
// NEDEN AYRI BİR KATMAN
// Oxford verisi bu projede bilerek SALT OKUNURDUR: kaynağı resmî listelerdir
// ve kullanıcının ilerlemesi o kayıtların kararlı kimliklerine bağlıdır. Onu
// panelden düzenlenebilir yapmak, altındaki zemini oynatmak olurdu.
//
// Bunun yerine yöneticinin eklediği kelimeler KENDİ katmanında durur. Aramada
// Oxford ve Genel Dağarcık'la birlikte bulunurlar, ama kaynakları ayrı kalır
// ve hangi kaydın nereden geldiği her zaman bellidir.

const DICTIONARY_FILE = path.join(DATA_DIR, 'dictionary.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

interface AdminSense {
  partOfSpeech: string;
  turkishMeanings: string[];
  examples: { en: string; tr: string }[];
}

interface AdminWord {
  id: string;
  word: string;
  phonetic?: string;
  /** CEFR seviyesi. Boş bırakılabilir: uydurma seviye yazmaktansa boş dursun. */
  level?: string;
  /** Konu etiketleri: "iş", "tıp", "günlük hayat"… */
  topics: string[];
  /** Sınav etiketleri: "YDS", "YÖKDİL", "IELTS"… */
  examTags: string[];
  senses: AdminSense[];
  imageUrl?: string;
  audioUrl?: string;
  /** 'draft' yalnızca panelde görünür; 'published' uygulamaya iner. */
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

interface DictionaryStore {
  words: AdminWord[];
  /** Yöneticinin tanımladığı etiket listeleri; arayüzde öneri olarak çıkar. */
  topics: string[];
  examTags: string[];
}

function loadDictionary(): DictionaryStore {
  try {
    if (fs.existsSync(DICTIONARY_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DICTIONARY_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          words: Array.isArray(parsed.words) ? parsed.words : [],
          topics: Array.isArray(parsed.topics) ? parsed.topics : [],
          examTags: Array.isArray(parsed.examTags) ? parsed.examTags : []
        };
      }
    }
  } catch (err) {
    console.error('Sözlük dosyası okunamadı:', err);
  }
  return { words: [], topics: [], examTags: [] };
}

const dictionary: DictionaryStore = loadDictionary();

let dictionaryTimer: NodeJS.Timeout | null = null;
function persistDictionary(): void {
  if (dictionaryTimer) return;
  dictionaryTimer = setTimeout(() => {
    dictionaryTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DICTIONARY_FILE, JSON.stringify(dictionary, null, 2), 'utf8');
    } catch (err) {
      console.error('Sözlük dosyası yazılamadı:', err);
    }
  }, 250);
}

/** Gelen gövdeden temizlenmiş bir kelime kaydı üretir. */
function readAdminWordBody(body: any, existing?: AdminWord): AdminWord | { error: string } {
  const word = sanitizeString(body?.word, 80);
  if (!word) return { error: 'Kelime boş olamaz.' };

  const rawSenses = Array.isArray(body?.senses) ? body.senses : [];
  const senses: AdminSense[] = rawSenses
    .map((sense: any) => ({
      partOfSpeech: sanitizeString(sense?.partOfSpeech, 20),
      turkishMeanings: (Array.isArray(sense?.turkishMeanings) ? sense.turkishMeanings : [])
        .map((m: any) => sanitizeString(m, 120))
        .filter(Boolean)
        .slice(0, 8),
      examples: (Array.isArray(sense?.examples) ? sense.examples : [])
        .map((ex: any) => ({
          en: sanitizeString(ex?.en, 300),
          tr: sanitizeString(ex?.tr, 300)
        }))
        .filter((ex: { en: string; tr: string }) => ex.en && ex.tr)
        .slice(0, 6)
    }))
    .filter((sense: AdminSense) => sense.turkishMeanings.length > 0);

  if (senses.length === 0) {
    return { error: 'En az bir anlam ve Türkçe karşılık gerekli.' };
  }

  const now = new Date().toISOString();
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const level = sanitizeString(body?.level, 4).toUpperCase();

  return {
    id: existing?.id || newId('adm'),
    word,
    phonetic: sanitizeString(body?.phonetic, 80) || undefined,
    level: levels.includes(level) ? level : undefined,
    topics: (Array.isArray(body?.topics) ? body.topics : [])
      .map((t: any) => sanitizeString(t, 40))
      .filter(Boolean)
      .slice(0, 10),
    examTags: (Array.isArray(body?.examTags) ? body.examTags : [])
      .map((t: any) => sanitizeString(t, 20))
      .filter(Boolean)
      .slice(0, 10),
    senses,
    imageUrl: sanitizeString(body?.imageUrl, 300) || existing?.imageUrl,
    audioUrl: sanitizeString(body?.audioUrl, 300) || existing?.audioUrl,
    status: body?.status === 'draft' ? 'draft' : 'published',
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

// --- Uygulamanın okuduğu uç ------------------------------------------------

/**
 * Yayındaki yönetici kelimeleri. Uygulama bunu açılışta çeker ve kendi
 * sözlüğüne ekler; taslaklar buraya hiç girmez.
 */
app.get('/api/dictionary', (_req, res) => {
  const words = dictionary.words
    .filter(entry => entry.status === 'published')
    .map(({ id, word, phonetic, level, topics, examTags, senses, imageUrl, audioUrl }) => ({
      id,
      word,
      phonetic,
      level,
      topics,
      examTags,
      senses,
      imageUrl,
      audioUrl
    }));

  return res.json({ words, topics: dictionary.topics, examTags: dictionary.examTags });
});

// --- Yönetim uçları --------------------------------------------------------

app.get('/api/admin/dictionary', requireAuth, requireAdmin, (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  const status = String(req.query.status || '');
  const topic = String(req.query.topic || '');
  const level = String(req.query.level || '');
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let list = dictionary.words;
  if (query) {
    list = list.filter(
      entry =>
        entry.word.toLowerCase().includes(query) ||
        entry.senses.some(sense =>
          sense.turkishMeanings.some(meaning => meaning.toLowerCase().includes(query))
        )
    );
  }
  if (status === 'draft' || status === 'published') list = list.filter(e => e.status === status);
  if (topic) list = list.filter(e => e.topics.includes(topic));
  if (level) list = list.filter(e => e.level === level);

  return res.json({
    total: list.length,
    publishedCount: dictionary.words.filter(e => e.status === 'published').length,
    draftCount: dictionary.words.filter(e => e.status === 'draft').length,
    topics: dictionary.topics,
    examTags: dictionary.examTags,
    words: list.slice(offset, offset + limit)
  });
});

app.post('/api/admin/dictionary', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const parsed = readAdminWordBody(req.body);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });

  const exists = dictionary.words.some(
    entry => entry.word.toLowerCase() === parsed.word.toLowerCase()
  );
  if (exists) {
    return res.status(400).json({ error: 'Bu kelime yönetici sözlüğünde zaten var.' });
  }

  dictionary.words.unshift(parsed);
  registerTags(parsed);
  persistDictionary();
  recordAudit(req, 'sözlüğe kelime eklendi', parsed.word);
  return res.json({ word: parsed });
});

app.put('/api/admin/dictionary/:id', requireAuth, requireAdmin, (req, res) => {
  const index = dictionary.words.findIndex(entry => entry.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Kelime bulunamadı.' });

  const parsed = readAdminWordBody(req.body, dictionary.words[index]);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });

  dictionary.words[index] = parsed;
  registerTags(parsed);
  persistDictionary();
  return res.json({ word: parsed });
});

app.delete('/api/admin/dictionary/:id', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const before = dictionary.words.length;
  const silinen = dictionary.words.find(entry => entry.id === req.params.id);
  dictionary.words = dictionary.words.filter(entry => entry.id !== req.params.id);
  if (dictionary.words.length === before) {
    return res.status(404).json({ error: 'Kelime bulunamadı.' });
  }
  persistDictionary();
  recordAudit(req, 'sözlükten kelime silindi', silinen?.word);
  return res.json({ deleted: req.params.id });
});

/** Kayıtta geçen etiketleri öneri listesine ekler. */
function registerTags(entry: AdminWord): void {
  entry.topics.forEach(topic => {
    if (!dictionary.topics.includes(topic)) dictionary.topics.push(topic);
  });
  entry.examTags.forEach(tag => {
    if (!dictionary.examTags.includes(tag)) dictionary.examTags.push(tag);
  });
  dictionary.topics.sort();
  dictionary.examTags.sort();
}

// --- Toplu veri: CSV dışa/içe aktarma --------------------------------------
//
// Biçim neden CSV? Excel bunu doğrudan açar ve kaydeder; ayrıca metin tabanlı
// olduğu için sürüm farkı, makro ve ikili biçim sorunları çıkmaz. Excel'in
// kendi .xlsx biçimi için sunucuya bir kütüphane eklemek gerekirdi; CSV aynı
// işi bağımlılık eklemeden görüyor.

/** Bir hücreyi CSV kaçışlarıyla yazar. */
function csvCell(value: string): string {
  const text = String(value ?? '');
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Tek satırlık CSV çözümleyici; tırnak içindeki ayraçları korur. */
function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

const CSV_HEADER = [
  'kelime',
  'telaffuz',
  'seviye',
  'konular',
  'sinavlar',
  'tur',
  'anlamlar',
  'ornek1_en',
  'ornek1_tr',
  'ornek2_en',
  'ornek2_tr',
  'ornek3_en',
  'ornek3_tr',
  'durum'
];

app.get('/api/admin/dictionary/export.csv', requireAuth, requireAdmin, (_req, res) => {
  const rows: string[] = [CSV_HEADER.join(';')];

  dictionary.words.forEach(entry => {
    // Her anlam kendi satırında: bir kelimenin iki sözcük türü varsa iki satır.
    entry.senses.forEach(sense => {
      const ex = sense.examples;
      rows.push(
        [
          entry.word,
          entry.phonetic || '',
          entry.level || '',
          entry.topics.join('|'),
          entry.examTags.join('|'),
          sense.partOfSpeech,
          sense.turkishMeanings.join('|'),
          ex[0]?.en || '',
          ex[0]?.tr || '',
          ex[1]?.en || '',
          ex[1]?.tr || '',
          ex[2]?.en || '',
          ex[2]?.tr || '',
          entry.status
        ]
          .map(csvCell)
          .join(';')
      );
    });
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="anlora-sozluk.csv"');
  // Excel'in Türkçe karakterleri doğru açması için BOM.
  return res.send('\uFEFF' + rows.join('\n'));
});

/**
 * CSV'den toplu yükleme.
 *
 * Aynı kelimenin birden çok satırı varsa anlamları BİRLEŞTİRİLİR; her satır
 * ayrı bir kayıt açmaz. Var olan kelime güncellenir, yenisi eklenir. Hatalı
 * satır tüm yüklemeyi düşürmez; rapor edilir ve diğerleri işlenir — yüz
 * satırlık bir dosyanın tek yazım hatası yüzünden reddedilmesi kullanıcıyı
 * hiçbir yere götürmez.
 */
app.post('/api/admin/dictionary/import', requireAuth, requireAdmin, (req, res) => {
  const text = typeof req.body?.csv === 'string' ? req.body.csv : '';
  if (!text.trim()) return res.status(400).json({ error: 'CSV içeriği boş.' });

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return res.status(400).json({ error: 'CSV en az bir başlık ve bir satır içermeli.' });

  // Ayraç dosyadan anlaşılır: Excel yerel ayara göre ; ya da , kullanır.
  const delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const header = parseCsvLine(lines[0], delimiter).map(h => h.trim().toLowerCase());
  const columnOf = (name: string) => header.indexOf(name);

  const wordCol = columnOf('kelime');
  if (wordCol < 0) {
    return res.status(400).json({ error: 'Başlık satırında "kelime" sütunu bulunamadı.' });
  }

  const problems: string[] = [];
  const merged = new Map<string, AdminWord>();

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delimiter);
    const pick = (name: string) => {
      const index = columnOf(name);
      return index >= 0 ? sanitizeString(cells[index], 300) : '';
    };

    const word = sanitizeString(cells[wordCol], 80);
    if (!word) {
      problems.push(`${i + 1}. satır: kelime boş`);
      continue;
    }

    const meanings = pick('anlamlar').split('|').map(m => m.trim()).filter(Boolean);
    if (meanings.length === 0) {
      problems.push(`${i + 1}. satır (${word}): Türkçe anlam yok`);
      continue;
    }

    const examples = [1, 2, 3]
      .map(n => ({ en: pick(`ornek${n}_en`), tr: pick(`ornek${n}_tr`) }))
      .filter(ex => ex.en && ex.tr);

    const key = word.toLowerCase();
    const existing = merged.get(key);
    const sense: AdminSense = {
      partOfSpeech: pick('tur') || 'n.',
      turkishMeanings: meanings,
      examples
    };

    if (existing) {
      existing.senses.push(sense);
      /*
       * Etiketler BİRLEŞTİRİLİR. Aynı kelimenin ikinci satırı farklı bir
       * konuya ait olabilir ("bank" hem finans hem coğrafya); ilk satırın
       * etiketlerini korumak ikincisinin bilgisini sessizce atardı.
       */
      pick('konular').split('|').map(t => t.trim()).filter(Boolean).forEach(topic => {
        if (!existing.topics.includes(topic)) existing.topics.push(topic);
      });
      pick('sinavlar').split('|').map(t => t.trim()).filter(Boolean).forEach(tag => {
        if (!existing.examTags.includes(tag)) existing.examTags.push(tag);
      });
      continue;
    }

    const level = pick('seviye').toUpperCase();
    merged.set(key, {
      id: newId('adm'),
      word,
      phonetic: pick('telaffuz') || undefined,
      level: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level) ? level : undefined,
      topics: pick('konular').split('|').map(t => t.trim()).filter(Boolean),
      examTags: pick('sinavlar').split('|').map(t => t.trim()).filter(Boolean),
      senses: [sense],
      status: pick('durum') === 'draft' ? 'draft' : 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  let added = 0;
  let updated = 0;

  merged.forEach((entry, key) => {
    const index = dictionary.words.findIndex(existing => existing.word.toLowerCase() === key);
    if (index >= 0) {
      // Kimlik korunur: kullanıcı ilerlemesi bu kimliğe bağlı olabilir.
      entry.id = dictionary.words[index].id;
      entry.createdAt = dictionary.words[index].createdAt;
      dictionary.words[index] = entry;
      updated++;
    } else {
      dictionary.words.unshift(entry);
      added++;
    }
    registerTags(entry);
  });

  persistDictionary();
  return res.json({ added, updated, skipped: problems.length, problems: problems.slice(0, 50) });
});

// --- Medya yükleme ---------------------------------------------------------
//
// Görsel ve ses dosyaları diske yazılır, veri dosyasına GÖMÜLMEZ. Bir
// megabaytlık sesi JSON içinde base64 olarak taşımak hem dosyayı üç kat
// büyütür hem de her okumada belleğe alınmasına yol açardı.

const UPLOAD_LIMITS: Record<string, { bytes: number; mimes: string[]; ext: Record<string, string> }> = {
  image: {
    bytes: 800 * 1024,
    mimes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    ext: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }
  },
  audio: {
    bytes: 2 * 1024 * 1024,
    mimes: ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm'],
    ext: { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'webm' }
  }
};

app.post('/api/admin/upload', requireAuth, requireAdmin, (req, res) => {
  const kind = req.body?.kind === 'audio' ? 'audio' : 'image';
  const limits = UPLOAD_LIMITS[kind];
  const dataUri = typeof req.body?.dataUri === 'string' ? req.body.dataUri : '';

  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'Dosya okunamadı.' });

  const [, mime, base64] = match;
  if (!limits.mimes.includes(mime)) {
    return res.status(400).json({ error: `Desteklenmeyen dosya türü: ${mime}` });
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > limits.bytes) {
    return res.status(400).json({
      error: `Dosya en fazla ${Math.round(limits.bytes / 1024)} KB olabilir.`
    });
  }

  const name = `${newId(kind)}.${limits.ext[mime]}`;
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);
  } catch (err) {
    console.error('Dosya yazılamadı:', err);
    return res.status(500).json({ error: 'Dosya kaydedilemedi.' });
  }

  return res.json({ url: `/uploads/${name}`, bytes: buffer.length });
});

// Yüklenen dosyalar herkese açık servis edilir: uygulama bunları gösterecek.
// Dizin listeleme kapalı, yalnızca doğrudan dosya adıyla erişilir.
app.use('/uploads', express.static(UPLOADS_DIR, { index: false, maxAge: '7d' }));

// --- Yönetim: hesap engelleme ----------------------------------------------

app.post('/api/admin/users/:email/ban', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const user = findTargetUser(req);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  if (isAdminEmail(user.email)) {
    return res.status(400).json({ error: 'Yönetici hesabı engellenemez.' });
  }

  user.banned = true;
  user.bannedReason = sanitizeString(req.body?.reason, 200) || undefined;
  user.bannedAt = new Date().toISOString();
  revokeSessionsFor(user.email);
  persistUsers();
  recordAudit(req, 'hesap engellendi', user.email, user.bannedReason);
  return res.json({ user: adminUserView(user) });
});

app.post('/api/admin/users/:email/unban', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const user = findTargetUser(req);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  delete user.banned;
  delete user.bannedReason;
  delete user.bannedAt;
  persistUsers();
  recordAudit(req, 'engel kaldırıldı', user.email);
  return res.json({ user: adminUserView(user) });
});

// ---------------------------------------------------------------------------
// İstatistik toplama
// ---------------------------------------------------------------------------
//
// KİMLİK TOPLANMIYOR. "En çok zorlanılan kelimeler" için gereken tek şey
// kelime başına toplam doğru/yanlış sayısıdır; kimin yanlış yaptığı değil.
// Uygulama bu sayıları toplu hâlde gönderir, sunucu da yalnızca toplar.
// Aynı gerekçeyle günlük açılış sayacı da kimliksizdir: kaç kez açıldığını
// sayar, kimin açtığını değil.

const STATS_FILE = path.join(DATA_DIR, 'stats.json');

interface WordStat {
  correct: number;
  wrong: number;
}

interface StatsStore {
  /** kelime kimliği → doğru/yanlış toplamı. */
  words: Record<string, WordStat>;
  /** YYYY-AA-GG → uygulamanın açılma sayısı. */
  opensByDay: Record<string, number>;
}

function loadStats(): StatsStore {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return { words: parsed.words || {}, opensByDay: parsed.opensByDay || {} };
      }
    }
  } catch (err) {
    console.error('İstatistik dosyası okunamadı:', err);
  }
  return { words: {}, opensByDay: {} };
}

const stats: StatsStore = loadStats();

let statsTimer: NodeJS.Timeout | null = null;
function persistStats(): void {
  if (statsTimer) return;
  statsTimer = setTimeout(() => {
    statsTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(STATS_FILE, JSON.stringify(stats), 'utf8');
    } catch (err) {
      console.error('İstatistik dosyası yazılamadı:', err);
    }
  }, 2000);
}

/**
 * Uygulamanın gönderdiği kimliksiz toplamlar.
 *
 * Giriş şartı yok; kimlik de istenmiyor. Gönderilen tek şey kelime başına
 * doğru/yanlış sayısı.
 */
app.post('/api/stats/report', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const rate = checkRateLimit(`st:${ip}`, 20, 60000);
  if (!rate.allowed) return res.status(429).json({ error: 'Çok sık gönderim.' });

  if (req.body?.opened) {
    const day = new Date().toISOString().slice(0, 10);
    stats.opensByDay[day] = (stats.opensByDay[day] || 0) + 1;
    const days = Object.keys(stats.opensByDay).sort();
    if (days.length > 120) {
      days.slice(0, days.length - 120).forEach(key => delete stats.opensByDay[key]);
    }
  }

  /*
   * Aranıp hiçbir yerde bulunamayan kelimeler.
   *
   * Yöneticinin en çok işine yarayan sinyal bu: kullanıcıların istediği ama
   * sözlükte olmayan kelimeler. Kimin aradığı toplanmaz, yalnızca kelime ve
   * kaç kez arandığı.
   */
  const misses = Array.isArray(req.body?.misses) ? req.body.misses.slice(0, 50) : [];
  misses.forEach((raw: any) => {
    const word = sanitizeString(raw, 80).toLowerCase();
    if (!word || word.length < 2) return;
    aiCache.misses[word] = (aiCache.misses[word] || 0) + 1;
  });
  if (misses.length) persistAiCache();

  const entries = Array.isArray(req.body?.words) ? req.body.words.slice(0, 200) : [];
  entries.forEach((item: any) => {
    const id = sanitizeString(item?.id, 120);
    if (!id) return;
    const correct = Math.max(0, Math.min(Number(item?.correct) || 0, 1000));
    const wrong = Math.max(0, Math.min(Number(item?.wrong) || 0, 1000));
    if (!correct && !wrong) return;

    const existing = stats.words[id] || { correct: 0, wrong: 0 };
    existing.correct += correct;
    existing.wrong += wrong;
    stats.words[id] = existing;
  });

  persistStats();
  return res.json({ ok: true });
});

app.get('/api/admin/stats', requireAuth, requireAdmin, (_req, res) => {
  const now = Date.now();
  const day = (offset: number) =>
    new Date(now - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const opens: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = day(i);
    opens.push({ day: key, count: stats.opensByDay[key] || 0 });
  }

  /*
   * "En çok zorlanılan" için ham yanlış sayısı yanıltıcıdır: çok çalışılan
   * bir kelime doğal olarak çok yanlış toplar. Ölçüt yanlış ORANI, ama en az
   * beş deneme görmüş kelimeler arasında — üç denemede üç yanlış, zorluk
   * değil rastlantı olabilir.
   */
  const hardest = Object.entries(stats.words)
    .map(([id, stat]) => ({
      id,
      correct: stat.correct,
      wrong: stat.wrong,
      attempts: stat.correct + stat.wrong,
      wrongRate: stat.wrong / Math.max(1, stat.correct + stat.wrong)
    }))
    .filter(item => item.attempts >= 5)
    .sort((a, b) => b.wrongRate - a.wrongRate || b.attempts - a.attempts)
    .slice(0, 25);

  const users = Object.values(cloudUsersDatabase);
  const activeOn = (key: string) =>
    users.filter(u => (u.lastActive || '').slice(0, 10) === key).length;

  return res.json({
    opens,
    dailyActiveUsers: opens.map(entry => ({ day: entry.day, count: activeOn(entry.day) })),
    hardestWords: hardest,
    trackedWords: Object.keys(stats.words).length
  });
});

// ---------------------------------------------------------------------------
// Set paylaşımı
// ---------------------------------------------------------------------------
//
// GİZLİ VARSAYILAN. Hiçbir set kendiliğinden paylaşılmaz; kullanıcı açıkça
// "paylaş" demeden sunucuya tek bir kelime bile gitmez. Paylaşım geri
// alınabilir: bağlantı kaldırıldığında kod geçersizleşir.
//
// Paylaşılan set bir KOPYADIR, canlı bir ayna değil. Kaynak set sonradan
// değişirse bağlantıdaki içerik değişmez; kullanıcı isterse yeniden paylaşır.
// Canlı ayna, karşı tarafın gördüğü şeyi sahibinin haberi olmadan
// değiştirebilmek demek olurdu.

const SHARES_FILE = path.join(DATA_DIR, 'shares.json');

interface SharedSet {
  code: string;
  name: string;
  description?: string;
  /** Paylaşan hesabın e-postası; kaldırma yetkisi için. */
  owner: string;
  words: {
    word: string;
    phonetic?: string;
    level?: string;
    partOfSpeech?: string;
    turkishMeaning: string;
    examples: { en: string; tr: string }[];
  }[];
  createdAt: string;
}

function loadShares(): Record<string, SharedSet> {
  try {
    if (fs.existsSync(SHARES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SHARES_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {
    console.error('Paylaşım dosyası okunamadı:', err);
  }
  return {};
}

const shares: Record<string, SharedSet> = loadShares();

let sharesTimer: NodeJS.Timeout | null = null;
function persistShares(): void {
  if (sharesTimer) return;
  sharesTimer = setTimeout(() => {
    sharesTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(SHARES_FILE, JSON.stringify(shares, null, 2), 'utf8');
    } catch (err) {
      console.error('Paylaşım dosyası yazılamadı:', err);
    }
  }, 250);
}

/**
 * Seti paylaşıma açar ve kodunu döndürür.
 *
 * Giriş gerekir: sahipsiz paylaşım kaldırılamaz ve kötüye kullanıma açık
 * olurdu. Kod tahmin edilemez olmalı, bu yüzden kriptografik rastgele.
 */
app.post('/api/sets/share', blockDuringMaintenance, requireAuth, (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const name = sanitizeString(req.body?.name, 80);
  const rawWords = Array.isArray(req.body?.words) ? req.body.words : [];

  if (!name) return res.status(400).json({ error: 'Setin adı gerekli.' });
  if (rawWords.length === 0) return res.status(400).json({ error: 'Boş set paylaşılamaz.' });
  if (rawWords.length > 2000) return res.status(400).json({ error: 'Set çok büyük (en fazla 2000 kelime).' });

  const words = rawWords
    .map((item: any) => ({
      word: sanitizeString(item?.word, 80),
      phonetic: sanitizeString(item?.phonetic, 80) || undefined,
      level: sanitizeString(item?.level, 4) || undefined,
      partOfSpeech: sanitizeString(item?.partOfSpeech, 30) || undefined,
      turkishMeaning: sanitizeString(item?.turkishMeaning, 300),
      examples: (Array.isArray(item?.examples) ? item.examples : [])
        .slice(0, 3)
        .map((ex: any) => ({
          en: sanitizeString(ex?.en, 300),
          tr: sanitizeString(ex?.tr, 300)
        }))
        .filter((ex: { en: string; tr: string }) => ex.en && ex.tr)
    }))
    .filter((item: { word: string; turkishMeaning: string }) => item.word && item.turkishMeaning);

  if (words.length === 0) {
    return res.status(400).json({ error: 'Paylaşılabilir kelime bulunamadı.' });
  }

  // Önceki paylaşımı varsa yenisiyle DEĞİŞTİRİLİR; her paylaşımda yeni bir
  // kod üretmek, kullanıcının dağıttığı eski bağlantıları çöpe atardı.
  const previous = sanitizeString(req.body?.previousCode, 40);
  const code =
    previous && shares[previous] && shares[previous].owner === user.email
      ? previous
      : crypto.randomBytes(6).toString('base64url');

  shares[code] = {
    code,
    name,
    description: sanitizeString(req.body?.description, 200) || undefined,
    owner: user.email,
    words,
    createdAt: new Date().toISOString()
  };
  persistShares();

  return res.json({ code, wordCount: words.length });
});

/** Paylaşımı kaldırır; bağlantı geçersizleşir. */
app.delete('/api/sets/share/:code', requireAuth, (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const entry = shares[String(req.params.code || '')];
  if (!entry) return res.status(404).json({ error: 'Paylaşım bulunamadı.' });
  if (entry.owner !== user.email) {
    return res.status(403).json({ error: 'Bu paylaşım sana ait değil.' });
  }

  delete shares[entry.code];
  persistShares();
  return res.json({ removed: entry.code });
});

/**
 * Paylaşılan seti okur. Giriş gerekmez: bağlantıyı alan herkes görebilmeli.
 * Kodu bilmeyen bulamaz; liste ucu yoktur.
 */
app.get('/api/sets/shared/:code', (req, res) => {
  const entry = shares[String(req.params.code || '')];
  if (!entry) return res.status(404).json({ error: 'Bu bağlantı geçersiz ya da kaldırılmış.' });

  return res.json({
    name: entry.name,
    description: entry.description,
    wordCount: entry.words.length,
    words: entry.words,
    createdAt: entry.createdAt
  });
});

// --- Yönetim: yapay zekâ önbelleği ve üretim merkezi -----------------------

app.get('/api/admin/ai', requireAuth, requireAdmin, (_req, res) => {
  rollAiUsage();

  const cards = Object.values(aiCache.cards);
  const totalHits = cards.reduce((sum, entry) => sum + entry.hits, 0);

  /*
   * En çok aranıp bulunamayan kelimeler. Yönetici bunları görüp topluca
   * sözlüğe ekleyebilsin diye sıralı veriliyor.
   */
  const topMisses = Object.entries(aiCache.misses)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return res.json({
    cache: {
      size: cards.length,
      approved: cards.filter(entry => entry.approved).length,
      flagged: cards.filter(entry => entry.flagged).length,
      hits: totalHits,
      callsAvoided: aiCache.callsAvoided,
      /* Önbellek isabet oranı: kaç isteğin çağrı yapmadan karşılandığı. */
      hitRate:
        totalHits + cards.length > 0
          ? totalHits / (totalHits + cards.length)
          : 0
    },
    quota: {
      dailyLimit: AI_DAILY_QUOTA,
      perUserLimit: AI_USER_DAILY_QUOTA,
      usedToday: aiUsage.total,
      configured: !!process.env.GEMINI_API_KEY
    },
    topMisses,
    recent: cards
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30)
      .map(entry => ({
        word: entry.word,
        approved: entry.approved,
        flagged: entry.flagged,
        hits: entry.hits,
        createdAt: entry.createdAt,
        turkishMeaning: String((entry.card as any)?.turkishMeaning || '')
      }))
  });
});

/** Üretilen kartı onaylar ya da kalitesiz olarak işaretler. */
app.patch('/api/admin/ai/cache/:word', requireAuth, requireAdmin, (req, res) => {
  const entry = aiCache.cards[cacheKey(String(req.params.word || ''))];
  if (!entry) return res.status(404).json({ error: 'Kayıt bulunamadı.' });

  if (typeof req.body?.approved === 'boolean') entry.approved = req.body.approved;
  if (typeof req.body?.flagged === 'boolean') entry.flagged = req.body.flagged;
  persistAiCache();
  return res.json({ word: entry.word, approved: entry.approved, flagged: entry.flagged });
});

/**
 * Önbellekten bir kaydı siler.
 *
 * Kalitesiz bir kart silinince aynı kelime için bir sonraki istek yeniden
 * üretilir; düzeltmenin yolu bu.
 */
app.delete('/api/admin/ai/cache/:word', requireAuth, requireAdmin, (req, res) => {
  const key = cacheKey(String(req.params.word || ''));
  if (!aiCache.cards[key]) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  delete aiCache.cards[key];
  persistAiCache();
  return res.json({ deleted: key });
});

/**
 * Önbellekteki üretilmiş kartı yönetici sözlüğüne taşır.
 *
 * Böylece kart artık "üretilmiş içerik" değil, onaylanmış sözlük kaydı olur
 * ve uygulamaya doğrudan iner.
 */
app.post('/api/admin/ai/cache/:word/publish', requireAuth, requireAdmin, (req, res) => {
  const key = cacheKey(String(req.params.word || ''));
  const entry = aiCache.cards[key];
  if (!entry) return res.status(404).json({ error: 'Kayıt bulunamadı.' });

  const card = entry.card as any;
  const senses = Array.isArray(card?.senses) && card.senses.length
    ? card.senses.map((sense: any) => ({
        partOfSpeech: sanitizeString(sense?.partOfSpeech, 20) || 'n.',
        turkishMeanings: (Array.isArray(sense?.turkishMeanings) ? sense.turkishMeanings : [])
          .map((m: any) => sanitizeString(m, 120))
          .filter(Boolean),
        examples: (Array.isArray(sense?.examples) ? sense.examples : [])
          .slice(0, 3)
          .map((ex: any) => ({ en: sanitizeString(ex?.en, 300), tr: sanitizeString(ex?.tr, 300) }))
          .filter((ex: any) => ex.en && ex.tr)
      }))
    : [
        {
          partOfSpeech: sanitizeString(card?.partOfSpeech, 20) || 'n.',
          turkishMeanings: [sanitizeString(card?.turkishMeaning, 120)].filter(Boolean),
          examples: (Array.isArray(card?.examples) ? card.examples : [])
            .slice(0, 3)
            .map((ex: any) => ({ en: sanitizeString(ex?.en, 300), tr: sanitizeString(ex?.tr, 300) }))
            .filter((ex: any) => ex.en && ex.tr)
        }
      ];

  const usable = senses.filter((sense: any) => sense.turkishMeanings.length > 0);
  if (usable.length === 0) {
    return res.status(400).json({ error: 'Bu kayıtta yayınlanacak Türkçe anlam yok.' });
  }

  const existingIndex = dictionary.words.findIndex(
    item => item.word.toLowerCase() === key
  );
  const now = new Date().toISOString();
  const record: AdminWord = {
    id: existingIndex >= 0 ? dictionary.words[existingIndex].id : newId('adm'),
    word: entry.word,
    phonetic: sanitizeString(card?.phonetic, 80) || undefined,
    level: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(String(card?.level))
      ? String(card.level)
      : undefined,
    topics: [],
    examTags: [],
    senses: usable,
    status: 'published',
    createdAt: existingIndex >= 0 ? dictionary.words[existingIndex].createdAt : now,
    updatedAt: now
  };

  if (existingIndex >= 0) dictionary.words[existingIndex] = record;
  else dictionary.words.unshift(record);
  persistDictionary();

  entry.approved = true;
  persistAiCache();

  return res.json({ word: record.word, published: true });
});

/** Aranıp bulunamayan kelime kaydını listeden düşürür. */
app.delete('/api/admin/ai/misses/:word', requireAuth, requireAdmin, (req, res) => {
  const key = cacheKey(String(req.params.word || ''));
  if (!(key in aiCache.misses)) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  delete aiCache.misses[key];
  persistAiCache();
  return res.json({ deleted: key });
});

// ---------------------------------------------------------------------------
// Sistem: işlem günlüğü, yedekleme, bakım modu, sağlık
// ---------------------------------------------------------------------------

const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
  ip?: string;
}

interface SystemState {
  /** Bakım modu: uygulama açılır ama yazma uçları kapanır. */
  maintenance: { enabled: boolean; message?: string; since?: string };
  /** Geçici olarak kapatılabilen özellikler. */
  features: Record<string, boolean>;
}

interface AuditStore {
  entries: AuditEntry[];
  /** Başarısız giriş denemeleri: e-posta → { count, lastAt, ips } */
  failedLogins: Record<string, { count: number; lastAt: string; ips: string[] }>;
  system: SystemState;
}

function loadAudit(): AuditStore {
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          entries: Array.isArray(parsed.entries) ? parsed.entries : [],
          failedLogins: parsed.failedLogins || {},
          system: {
            maintenance: parsed.system?.maintenance || { enabled: false },
            features: parsed.system?.features || {}
          }
        };
      }
    }
  } catch (err) {
    console.error('Günlük dosyası okunamadı:', err);
  }
  return { entries: [], failedLogins: {}, system: { maintenance: { enabled: false }, features: {} } };
}

const audit: AuditStore = loadAudit();

let auditTimer: NodeJS.Timeout | null = null;
function persistAudit(): void {
  if (auditTimer) return;
  auditTimer = setTimeout(() => {
    auditTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(AUDIT_FILE, JSON.stringify(audit), 'utf8');
    } catch (err) {
      console.error('Günlük dosyası yazılamadı:', err);
    }
  }, 500);
}

/**
 * Yönetici işlemini kaydeder.
 *
 * NEDEN: bir hesabın neden silindiğini ya da kimin engellendiğini sonradan
 * sormak mümkün olmalı. Yetkiyi paylaşan iki kişi varsa "ben yapmadım"
 * tartışmasının tek çözümü kayıttır.
 *
 * Kayıt yalnızca YÖNETİCİ işlemlerini tutar; sıradan kullanım izlenmez.
 */
function recordAudit(
  req: AuthedRequest,
  action: string,
  target?: string,
  detail?: string
): void {
  audit.entries.unshift({
    at: new Date().toISOString(),
    actor: req.authUser?.email || 'bilinmiyor',
    action,
    target,
    detail,
    ip: req.ip || req.socket.remoteAddress || undefined
  });
  // Sınırsız büyümesin; son 5000 işlem yeter.
  if (audit.entries.length > 5000) audit.entries.length = 5000;
  persistAudit();
}

/** Başarısız giriş denemesini kaydeder. */
function recordFailedLogin(email: string, ip: string): void {
  const entry = audit.failedLogins[email] || { count: 0, lastAt: '', ips: [] };
  entry.count++;
  entry.lastAt = new Date().toISOString();
  if (ip && !entry.ips.includes(ip)) entry.ips = [...entry.ips.slice(-4), ip];
  audit.failedLogins[email] = entry;
  persistAudit();
}

/**
 * Bakım modu.
 *
 * Uygulama AÇIK kalır ve çevrimdışı çalışmaya devam eder; kapanan yalnızca
 * sunucuya YAZAN uçlardır. Uygulamayı tümden kapatmak, çevrimdışı çalışan
 * bir sözlüğü sebepsiz yere erişilemez kılardı.
 */
function blockDuringMaintenance(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!audit.system.maintenance.enabled) return next();

  // Yönetici bakım sırasında çalışmaya devam edebilmeli.
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const user = resolveSession(token);
  if (user && isAdminEmail(user.email)) return next();

  return res.status(503).json({
    error:
      audit.system.maintenance.message ||
      'Bakım çalışması sürüyor. Kelimelerin telefonunda duruyor; kısa süre sonra tekrar dene.',
    code: 'MAINTENANCE'
  });
}

app.get('/api/health', (_req, res) => {
  const uptimeSeconds = Math.round(process.uptime());
  let dataWritable = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    dataWritable = true;
  } catch {
    dataWritable = false;
  }

  return res.json({
    ok: dataWritable,
    uptimeSeconds,
    dataWritable,
    maintenance: audit.system.maintenance.enabled,
    users: Object.keys(cloudUsersDatabase).length,
    dictionaryWords: dictionary.words.length,
    aiConfigured: !!process.env.GEMINI_API_KEY,
    version: process.env.npm_package_version || 'dev'
  });
});

app.get('/api/admin/system', requireAuth, requireAdmin, (_req, res) => {
  let backups: { name: string; bytes: number; at: string }[] = [];
  try {
    if (fs.existsSync(BACKUP_DIR)) {
      backups = fs
        .readdirSync(BACKUP_DIR)
        .filter(name => name.endsWith('.json'))
        .map(name => {
          const stat = fs.statSync(path.join(BACKUP_DIR, name));
          return { name, bytes: stat.size, at: stat.mtime.toISOString() };
        })
        .sort((a, b) => b.at.localeCompare(a.at));
    }
  } catch (err) {
    console.error('Yedek listesi okunamadı:', err);
  }

  const failed = Object.entries(audit.failedLogins)
    .map(([email, info]) => ({ email, ...info }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    .slice(0, 25);

  return res.json({
    maintenance: audit.system.maintenance,
    features: audit.system.features,
    backups,
    failedLogins: failed,
    auditLog: audit.entries.slice(0, 100)
  });
});

app.put('/api/admin/system/maintenance', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const enabled = !!req.body?.enabled;
  audit.system.maintenance = {
    enabled,
    message: sanitizeString(req.body?.message, 200) || undefined,
    since: enabled ? new Date().toISOString() : undefined
  };
  recordAudit(req, enabled ? 'bakım modu açıldı' : 'bakım modu kapatıldı');
  persistAudit();
  return res.json({ maintenance: audit.system.maintenance });
});

/**
 * Tam sistem yedeği.
 *
 * Bütün veri dosyaları tek bir JSON'da toplanır; başka bir sunucuya
 * taşınabilir. Parola özetleri de dahildir — yedek olmadan hesaplar
 * taşınamaz — bu yüzden dosya gizli tutulmalıdır.
 */
function buildBackup(): Record<string, unknown> {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    users: cloudUsersDatabase,
    dictionary,
    content: appContent,
    aiCache,
    stats,
    shares,
    metrics,
    system: audit.system
  };
}

app.post('/api/admin/system/backup', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const name = `yedek-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(path.join(BACKUP_DIR, name), JSON.stringify(buildBackup()), 'utf8');

    // Son 20 yedek tutulur; disk sonsuz değil.
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
    files.slice(0, Math.max(0, files.length - 20)).forEach(old => {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, old));
      } catch {
        /* silinemezse bir sonraki turda denenir */
      }
    });

    recordAudit(req, 'yedek alındı', name);
    return res.json({ name });
  } catch (err: any) {
    return res.status(500).json({ error: 'Yedek alınamadı: ' + (err?.message || '') });
  }
});

app.get('/api/admin/system/backup/download', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  recordAudit(req, 'yedek indirildi');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="anlora-yedek-${new Date().toISOString().slice(0, 10)}.json"`
  );
  return res.send(JSON.stringify(buildBackup(), null, 2));
});

/**
 * Yedekten geri yükleme.
 *
 * GERİ YÜKLEMEDEN ÖNCE OTOMATİK GÜVENLİK KOPYASI alınır. Yanlış dosyayı
 * yükleyen yönetici, o an ayakta olan veriyi de kaybederse felaket olur;
 * kopya bu ihtimali geri alınabilir kılar.
 */
app.post('/api/admin/system/restore', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const payload = req.body?.backup;
  if (!payload || typeof payload !== 'object' || !payload.users) {
    return res.status(400).json({ error: 'Geçersiz yedek dosyası.' });
  }

  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const safety = `geri-yukleme-oncesi-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(path.join(BACKUP_DIR, safety), JSON.stringify(buildBackup()), 'utf8');

    // Nesneler YERİNDE güncellenir; başka modüller bu referansları tutuyor.
    Object.keys(cloudUsersDatabase).forEach(key => delete cloudUsersDatabase[key]);
    Object.assign(cloudUsersDatabase, payload.users || {});

    if (payload.dictionary) {
      dictionary.words = payload.dictionary.words || [];
      dictionary.topics = payload.dictionary.topics || [];
      dictionary.examTags = payload.dictionary.examTags || [];
    }
    if (payload.content) {
      appContent.ads = payload.content.ads || {};
      appContent.announcements = payload.content.announcements || [];
      appContent.feedback = payload.content.feedback || [];
      appContent.branding = payload.content.branding || {};
    }
    if (payload.aiCache) {
      aiCache.cards = payload.aiCache.cards || {};
      aiCache.callsAvoided = payload.aiCache.callsAvoided || 0;
      aiCache.misses = payload.aiCache.misses || {};
    }

    // Geri yükleme sonrası bütün oturumlar düşer: yedekteki hesaplar
    // ayaktakilerden farklı olabilir.
    sessions.clear();

    persistUsers();
    persistDictionary();
    persistContent();
    persistAiCache();

    recordAudit(req, 'yedekten geri yüklendi', undefined, `güvenlik kopyası: ${safety}`);
    return res.json({ restored: true, safetyCopy: safety });
  } catch (err: any) {
    return res.status(500).json({ error: 'Geri yükleme başarısız: ' + (err?.message || '') });
  }
});

// --- Yönetim: reklam alanları ----------------------------------------------

app.get('/api/admin/ads', requireAuth, requireAdmin, (_req, res) => {
  return res.json({
    slots: AD_SLOTS.map(slot => ({
      id: slot.id,
      label: slot.label,
      html: appContent.ads[slot.id]?.html || '',
      enabled: !!appContent.ads[slot.id]?.enabled,
      updatedAt: appContent.ads[slot.id]?.updatedAt || null
    }))
  });
});

/**
 * Bir reklam alanının gömme kodunu yazar.
 *
 * GÜVENLİK NOTU: burada saklanan şey ham HTML'dir ve uygulamada aynen
 * çalıştırılır — reklam ağlarının verdiği kod script etiketi içerdiği için
 * başka türlüsü mümkün değil. Bu, yönetici hesabının ele geçirilmesini
 * uygulamaya kod enjekte etmekle eşdeğer kılar. Bu yüzden yetki ortam
 * değişkenine bağlı, oturumlar 30 günde bir düşüyor ve panel yalnızca
 * doğrulanmış yönetici hesabına açık.
 */
app.put('/api/admin/ads/:slotId', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const slotId = String(req.params.slotId || '');
  if (!AD_SLOTS.some(slot => slot.id === slotId)) {
    return res.status(404).json({ error: 'Böyle bir reklam alanı yok.' });
  }

  const html = typeof req.body?.html === 'string' ? req.body.html.slice(0, 20000) : '';
  const enabled = !!req.body?.enabled;

  appContent.ads[slotId] = { html, enabled, updatedAt: new Date().toISOString() };
  persistContent();
  recordAudit(req, enabled ? 'reklam alanı açıldı' : 'reklam alanı kapatıldı', slotId);
  return res.json({ slotId, html, enabled });
});

// --- Yönetim: duyurular ----------------------------------------------------

app.get('/api/admin/announcements', requireAuth, requireAdmin, (_req, res) => {
  return res.json({ announcements: appContent.announcements });
});

app.post('/api/admin/announcements', requireAuth, requireAdmin, (req, res) => {
  const title = sanitizeString(req.body?.title, 120);
  const body = sanitizeString(req.body?.body, 2000);

  if (!title || !body) {
    return res.status(400).json({ error: 'Başlık ve mesaj gerekli.' });
  }

  const announcement: Announcement = {
    id: newId('ann'),
    title,
    body,
    audience: req.body?.audience === 'verified' ? 'verified' : 'all',
    active: req.body?.active !== false,
    createdAt: new Date().toISOString()
  };

  appContent.announcements.unshift(announcement);
  if (appContent.announcements.length > 200) appContent.announcements.length = 200;
  persistContent();
  return res.json({ announcement });
});

app.patch('/api/admin/announcements/:id', requireAuth, requireAdmin, (req, res) => {
  const found = appContent.announcements.find(a => a.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'Duyuru bulunamadı.' });

  if (typeof req.body?.active === 'boolean') found.active = req.body.active;
  if (typeof req.body?.title === 'string') found.title = sanitizeString(req.body.title, 120) || found.title;
  if (typeof req.body?.body === 'string') found.body = sanitizeString(req.body.body, 2000) || found.body;
  persistContent();
  return res.json({ announcement: found });
});

app.delete('/api/admin/announcements/:id', requireAuth, requireAdmin, (req, res) => {
  const before = appContent.announcements.length;
  appContent.announcements = appContent.announcements.filter(a => a.id !== req.params.id);
  if (appContent.announcements.length === before) {
    return res.status(404).json({ error: 'Duyuru bulunamadı.' });
  }
  persistContent();
  return res.json({ deleted: req.params.id });
});

// --- Yönetim: gelen bildirimler --------------------------------------------

app.get('/api/admin/feedback', requireAuth, requireAdmin, (req, res) => {
  const status = String(req.query.status || '');
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

  let list = appContent.feedback;
  if (status === 'new' || status === 'read' || status === 'resolved') {
    list = list.filter(entry => entry.status === status);
  }

  return res.json({
    total: appContent.feedback.length,
    newCount: appContent.feedback.filter(entry => entry.status === 'new').length,
    feedback: list.slice(0, limit)
  });
});

app.patch('/api/admin/feedback/:id', requireAuth, requireAdmin, (req, res) => {
  const entry = appContent.feedback.find(item => item.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Bildirim bulunamadı.' });

  const status = req.body?.status;
  if (status === 'new' || status === 'read' || status === 'resolved') entry.status = status;
  if (typeof req.body?.adminNote === 'string') {
    entry.adminNote = sanitizeString(req.body.adminNote, 1000);
  }
  persistContent();
  return res.json({ feedback: entry });
});

app.delete('/api/admin/feedback/:id', requireAuth, requireAdmin, (req, res) => {
  const before = appContent.feedback.length;
  appContent.feedback = appContent.feedback.filter(item => item.id !== req.params.id);
  if (appContent.feedback.length === before) {
    return res.status(404).json({ error: 'Bildirim bulunamadı.' });
  }
  persistContent();
  return res.json({ deleted: req.params.id });
});

// --- Yönetim: marka ve metinler --------------------------------------------

app.get('/api/admin/branding', requireAuth, requireAdmin, (_req, res) => {
  return res.json({ branding: appContent.branding || {} });
});

/**
 * Marka metinlerini ve uygulama içi logoyu günceller.
 *
 * Logo bir data URI olarak gelir ve 200 KB ile sınırlanır: bu alan her
 * açılışta indirileceği için büyümesine izin vermek, uygulamayı herkes için
 * yavaşlatmak demek. Boş gönderilen alan varsayılana döner.
 */
app.put('/api/admin/branding', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const branding: Branding = { ...(appContent.branding || {}) };

  const textFields = ['appName', 'slogan', 'homeIntro', 'setsIntro', 'lookupTitle', 'lookupBody'] as const;
  const limits: Record<(typeof textFields)[number], number> = {
    appName: 40,
    slogan: 80,
    homeIntro: 600,
    setsIntro: 400,
    lookupTitle: 80,
    lookupBody: 400
  };

  for (const field of textFields) {
    if (typeof req.body?.[field] === 'string') {
      branding[field] = sanitizeString(req.body[field], limits[field]);
    }
  }

  if (typeof req.body?.logoDataUri === 'string') {
    const value = req.body.logoDataUri.trim();
    if (!value) {
      delete branding.logoDataUri;
    } else if (!/^data:image\/(png|jpeg|svg\+xml|webp);base64,/.test(value)) {
      return res.status(400).json({ error: 'Logo bir PNG, JPEG, WEBP ya da SVG görseli olmalı.' });
    } else if (value.length > 200 * 1024) {
      return res.status(400).json({ error: 'Logo en fazla 200 KB olabilir.' });
    } else {
      branding.logoDataUri = value;
    }
  }

  branding.updatedAt = new Date().toISOString();
  appContent.branding = branding;
  persistContent();
  recordAudit(req, 'marka bilgileri güncellendi');
  return res.json({ branding });
});

app.post('/api/custom-cards/sync', requireAuth, (req: AuthedRequest, res) => {
  const { cards } = req.body;
  if (!Array.isArray(cards)) {
    return res.status(400).json({ error: 'Kart listesi geçerli bir dizi olmalıdır.' });
  }
  writeUserCards(req.authUser!, cards);
  return res.json({ message: 'Tüm kartlar bulut ile eşitlendi.', totalCount: cards.length });
});

// Vite or Static file serving
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        // Projenin gerçek index.html'i sunulur. Önceki sürümde burada satır içi
        // bir şablon vardı; bu yüzden geliştirme ortamında `lang="tr"`, sayfa
        // başlığı, Google Fonts bağlantıları ve gövde sınıfları düşüyordu.
        // Geliştirmede görülen sayfa, üretimde yayınlanan sayfadan farklıydı.
        const indexPath = path.resolve(__dirname, 'index.html');
        const raw = fs.readFileSync(indexPath, 'utf8');
        const template = await vite.transformIndexHtml(url, raw);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Oxford 3000 Sunucusu http://localhost:${PORT} üzerinde çalışıyor`);
  });
}

setupServer();
