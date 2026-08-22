import express from 'express';
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

// Cloud persistence file path for custom cards
const CUSTOM_CARDS_FILE = path.join(__dirname, 'src/data/custom_cards_cloud.json');

function readCloudCustomCards(): any[] {
  try {
    if (fs.existsSync(CUSTOM_CARDS_FILE)) {
      const data = fs.readFileSync(CUSTOM_CARDS_FILE, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.error('Error reading cloud custom cards:', err);
  }
  return [];
}

function writeCloudCustomCards(cards: any[]): void {
  try {
    const dir = path.dirname(CUSTOM_CARDS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CUSTOM_CARDS_FILE, JSON.stringify(cards, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing cloud custom cards:', err);
  }
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
app.post('/api/ai/generate-word', async (req, res) => {
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

// Cloud Sync & Auth user storage
interface CloudUserData {
  email: string;
  name?: string;
  country?: string;
  city?: string;
  emailVerified?: boolean;
  authProvider?: 'google' | 'email' | 'guest';
  passwordHash?: string;
  verificationCode?: string;
  verificationCodeExpiresAt?: number;
  lastCodeSentAt?: number;
  collections?: any[];
  memberships?: any[];
  learningStates?: Record<string, any>;
  favorites: string[];
  learned: string[];
  customWords: any[];
  stats: any;
  unlockedBadges: string[];
  settings?: any;
  createdAt?: string;
  lastActive?: string;
}

const cloudUsersDatabase: Record<string, CloudUserData> = {};

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

// Simple deterministic hash helper for local demo security (avoid raw text)
function hashSecret(secret: string): string {
  let hash = 0;
  for (let i = 0; i < secret.length; i++) {
    const char = secret.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `anlora_h_${Math.abs(hash).toString(16)}`;
}

// Generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 1. Google OAuth / One-Tap Endpoint
app.post('/api/auth/google', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const rate = checkRateLimit(ip, 20, 60000);
  if (!rate.allowed) {
    return res.status(429).json({ error: `Çok fazla deneme yapıldı. Lütfen ${rate.retryAfter || 60} saniye sonra tekrar deneyin.` });
  }

  const { email, name, country, city } = req.body;
  const cleanEmail = sanitizeString(email, 120).toLowerCase();
  const cleanName = sanitizeString(name, 100) || cleanEmail.split('@')[0];
  const cleanCountry = sanitizeString(country, 60) || 'Türkiye';
  const cleanCity = sanitizeString(city, 60) || 'İstanbul';

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'Geçerli bir Google hesabı e-postası gereklidir.' });
  }

  let user = cloudUsersDatabase[cleanEmail];
  if (!user) {
    user = {
      email: cleanEmail,
      name: cleanName,
      country: cleanCountry,
      city: cleanCity,
      emailVerified: true,
      authProvider: 'google',
      favorites: [],
      learned: [],
      customWords: [],
      stats: { totalQuizzes: 0, totalCorrect: 0, totalWrong: 0, streakDays: 1, lastActive: new Date().toISOString() },
      unlockedBadges: ['first_step'],
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
    cloudUsersDatabase[cleanEmail] = user;
  } else {
    user.emailVerified = true;
    user.lastActive = new Date().toISOString();
    if (!user.country) user.country = cleanCountry;
    if (!user.city) user.city = cleanCity;
  }

  return res.json({
    message: 'Google ile giriş başarılı.',
    user: {
      email: user.email,
      name: user.name,
      country: user.country,
      city: user.city,
      emailVerified: true,
      authProvider: 'google'
    },
    userData: {
      collections: user.collections,
      memberships: user.memberships,
      learningStates: user.learningStates,
      favorites: user.favorites,
      customWords: user.customWords,
      stats: user.stats,
      unlockedBadges: user.unlockedBadges
    }
  });
});

// 2. Email / Password Registration with 81 cities & Honeypot protection
app.post('/api/auth/register', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  
  // Honeypot check for bots
  if (req.body.hp_website && req.body.hp_website.trim().length > 0) {
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

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Lütfen geçerli bir e-posta adresi girin.' });
  }

  // Password length & strength check
  if (cleanPassword.length < 6) {
    return res.status(400).json({ error: 'Parola en az 6 karakter uzunluğunda olmalıdır.' });
  }

  if (cloudUsersDatabase[cleanEmail]) {
    return res.status(400).json({ error: 'Bu e-posta adresiyle kayıtlı bir hesap zaten var.' });
  }

  const code = generateVerificationCode();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  cloudUsersDatabase[cleanEmail] = {
    email: cleanEmail,
    name: cleanName,
    country: cleanCountry,
    city: cleanCity,
    passwordHash: hashSecret(cleanPassword),
    emailVerified: false,
    authProvider: 'email',
    verificationCode: code,
    verificationCodeExpiresAt: expiresAt,
    lastCodeSentAt: Date.now(),
    favorites: [],
    learned: [],
    customWords: [],
    stats: { totalQuizzes: 0, totalCorrect: 0, totalWrong: 0, streakDays: 1, lastActive: new Date().toISOString() },
    unlockedBadges: ['first_step'],
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };

  console.log(`[ANLORA AUTH] E-posta doğrulama kodu oluşturuldu: ${cleanEmail} -> ${code}`);

  return res.json({
    message: 'Hesap oluşturuldu. Lütfen e-postanıza gönderilen 6 haneli doğrulama kodunu girin.',
    email: cleanEmail,
    name: cleanName,
    country: cleanCountry,
    city: cleanCity,
    emailVerified: false,
    devCode: process.env.NODE_ENV !== 'production' ? code : undefined
  });
});

// 3. Email Verification
app.post('/api/auth/verify-email', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const rate = checkRateLimit(ip, 15, 60000);
  if (!rate.allowed) {
    return res.status(429).json({ error: `Çok fazla deneme. Lütfen ${rate.retryAfter || 60} saniye bekleyin.` });
  }

  const { email, code } = req.body;
  const cleanEmail = sanitizeString(email, 120).toLowerCase();
  const cleanCode = sanitizeString(code, 10).trim();

  const user = cloudUsersDatabase[cleanEmail];
  if (!user) {
    return res.status(404).json({ error: 'Kullanıcı hesabı bulunamadı.' });
  }

  if (user.emailVerified) {
    return res.json({ message: 'E-posta zaten doğrulanmış.', user: { email: user.email, name: user.name, emailVerified: true, country: user.country, city: user.city } });
  }

  if (!user.verificationCode || user.verificationCode !== cleanCode) {
    return res.status(400).json({ error: 'Girdiğiniz doğrulama kodu hatalı. Lütfen tekrar deneyin.' });
  }

  if (user.verificationCodeExpiresAt && user.verificationCodeExpiresAt < Date.now()) {
    return res.status(400).json({ error: 'Doğrulama kodunun süresi dolmuş. Lütfen yeni kod isteyin.' });
  }

  user.emailVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpiresAt = undefined;

  return res.json({
    message: 'E-posta adresiniz başarıyla doğrulandı!',
    user: {
      email: user.email,
      name: user.name,
      country: user.country,
      city: user.city,
      emailVerified: true,
      authProvider: user.authProvider || 'email'
    }
  });
});

// 4. Resend Verification Code
app.post('/api/auth/resend-code', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const rate = checkRateLimit(ip, 6, 60000);
  if (!rate.allowed) {
    return res.status(429).json({ error: `Lütfen tekrar denemeden önce ${rate.retryAfter || 60} saniye bekleyin.` });
  }

  const { email } = req.body;
  const cleanEmail = sanitizeString(email, 120).toLowerCase();
  const user = cloudUsersDatabase[cleanEmail];

  if (!user) {
    return res.status(404).json({ error: 'Hesap bulunamadı.' });
  }

  // 60-second cooldown check
  if (user.lastCodeSentAt && Date.now() - user.lastCodeSentAt < 60000) {
    const remaining = Math.ceil((60000 - (Date.now() - user.lastCodeSentAt)) / 1000);
    return res.status(429).json({ error: `Yeni kod istemek için lütfen ${remaining} saniye bekleyin.` });
  }

  const code = generateVerificationCode();
  user.verificationCode = code;
  user.verificationCodeExpiresAt = Date.now() + 15 * 60 * 1000;
  user.lastCodeSentAt = Date.now();

  console.log(`[ANLORA AUTH] Yeni doğrulama kodu gönderildi: ${cleanEmail} -> ${code}`);

  return res.json({
    message: 'Yeni doğrulama kodu e-postanıza gönderildi.',
    devCode: process.env.NODE_ENV !== 'production' ? code : undefined
  });
});

// 5. Email / Password Login
app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const rate = checkRateLimit(ip, 12, 60000);
  if (!rate.allowed) {
    return res.status(429).json({ error: `Çok fazla hatalı giriş denemesi. Lütfen ${rate.retryAfter || 60} saniye bekleyin.` });
  }

  const { email, password } = req.body;
  const cleanEmail = sanitizeString(email, 120).toLowerCase();
  const cleanPassword = typeof password === 'string' ? password : '';

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'Lütfen geçerli bir e-posta adresi girin.' });
  }

  const user = cloudUsersDatabase[cleanEmail];
  if (!user) {
    return res.status(401).json({ error: 'Bu e-posta adresi ile kayıtlı bir hesap bulunamadı.' });
  }

  if (user.passwordHash && user.passwordHash !== hashSecret(cleanPassword)) {
    return res.status(401).json({ error: 'Girdiğiniz parola hatalı.' });
  }

  user.lastActive = new Date().toISOString();

  return res.json({
    message: 'Giriş başarılı.',
    user: {
      email: user.email,
      name: user.name,
      country: user.country,
      city: user.city,
      emailVerified: !!user.emailVerified,
      authProvider: user.authProvider || 'email'
    },
    userData: {
      collections: user.collections,
      memberships: user.memberships,
      learningStates: user.learningStates,
      favorites: user.favorites,
      customWords: user.customWords,
      stats: user.stats,
      unlockedBadges: user.unlockedBadges
    }
  });
});

app.post('/api/sync/save', (req, res) => {
  const { email, userData } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Oturum açık değil.' });
  }
  cloudUsersDatabase[email] = {
    email,
    ...userData
  };
  return res.json({ message: 'Verileriniz buluta başarıyla kaydedildi.', timestamp: new Date().toISOString() });
});

app.get('/api/sync/load', (req, res) => {
  const email = req.query.email as string;
  if (!email || !cloudUsersDatabase[email]) {
    return res.status(404).json({ error: 'Bulut kaydı bulunamadı.' });
  }
  return res.json({ userData: cloudUsersDatabase[email] });
});

// Custom Cards Cloud Storage REST API
app.get('/api/custom-cards', (_req, res) => {
  const cards = readCloudCustomCards();
  return res.json({ cards });
});

app.post('/api/custom-cards', (req, res) => {
  const newCard = req.body;
  if (!newCard || !newCard.id || !newCard.word) {
    return res.status(400).json({ error: 'Gereksiz veya geçersiz kart verisi.' });
  }
  const cards = readCloudCustomCards();
  const existingIdx = cards.findIndex(c => c.id === newCard.id);
  if (existingIdx !== -1) {
    cards[existingIdx] = newCard;
  } else {
    cards.unshift(newCard);
  }
  writeCloudCustomCards(cards);
  return res.json({ message: 'Kart buluta kaydedildi.', card: newCard, totalCount: cards.length });
});

app.put('/api/custom-cards/:id', (req, res) => {
  const { id } = req.params;
  const updatedCard = req.body;
  if (!updatedCard || !updatedCard.word) {
    return res.status(400).json({ error: 'Geçersiz kart verisi.' });
  }
  const cards = readCloudCustomCards();
  const index = cards.findIndex(c => c.id === id);
  if (index === -1) {
    cards.unshift({ ...updatedCard, id });
  } else {
    cards[index] = { ...cards[index], ...updatedCard, id };
  }
  writeCloudCustomCards(cards);
  return res.json({ message: 'Kart güncellendi.', card: cards[index] || updatedCard });
});

app.delete('/api/custom-cards/:id', (req, res) => {
  const { id } = req.params;
  let cards = readCloudCustomCards();
  cards = cards.filter(c => c.id !== id);
  writeCloudCustomCards(cards);
  return res.json({ message: 'Kart silindi.', totalCount: cards.length });
});

app.post('/api/custom-cards/sync', (req, res) => {
  const { cards } = req.body;
  if (!Array.isArray(cards)) {
    return res.status(400).json({ error: 'Kart listesi geçerli bir dizi olmalıdır.' });
  }
  writeCloudCustomCards(cards);
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
        let template = await vite.transformIndexHtml(url, `<!DOCTYPE html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`);
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
