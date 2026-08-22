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

  for (const ex of allExamples) {
    const en = (ex.en || '').toLowerCase();
    const tr = (ex.tr || '').toLowerCase();
    for (const pat of badExPatterns) {
      if (en.includes(pat) || tr.includes(pat)) {
        return false;
      }
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

app.post('/api/ai/generate-word', async (req, res) => {
  if (!guardAiRequest(req, res)) return;
  try {
    const { word, context } = req.body;
    if (!word || typeof word !== 'string' || !word.trim()) {
      return res.status(400).json({ error: 'Kelime girilmedi.' });
    }

    const trimmedWord = word.trim();
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
    authProvider: user.authProvider || 'email'
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
app.post('/api/auth/register', (req, res) => {
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

  if (cleanPassword.length < 8) {
    return res.status(400).json({ error: 'Parola en az 8 karakter uzunluğunda olmalıdır.' });
  }
  if (cleanPassword.length > 200) {
    return res.status(400).json({ error: 'Parola en fazla 200 karakter olabilir.' });
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
  const invalidCredentials = () =>
    res.status(401).json({ error: 'E-posta adresi veya parola hatalı.' });

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
app.post('/api/sync/save', requireAuth, (req: AuthedRequest, res) => {
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
