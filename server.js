// ========================================
// 🎬 MOVIFIND AI CONTENT SEARCH SERVER
// 🔐 SECURITY + OMDb + GEMINI VISION
// 🖼️ IMAGE + VIDEO DETECTION READY
// ⚡ FAST SEARCH + CACHE
// ========================================

const express = require("express");
const dotenv = require("dotenv");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ========================================
// 🔑 API KEYS
// ========================================

const OMDB_API_KEY = process.env.OMDB_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// ========================================
// 🤖 GEMINI MODELS
// ========================================

const VISION_MODEL =
    process.env.GEMINI_VISION_MODEL || "gemini-3.7-flash";

const VISION_FALLBACK_MODEL =
    process.env.GEMINI_VISION_FALLBACK_MODEL || "gemini-3.5-flash-lite";

// ========================================
// 📁 DATA FILES
// ========================================

const QUOTA_FILE = path.join(__dirname, ".gemini-quota.json");
const CACHE_FILE = path.join(__dirname, ".vision-cache.json");

// ========================================
// ⚙️ SETTINGS
// ========================================

const QUOTA_BLOCK_MS = 24 * 60 * 60 * 1000;
const MIN_CONFIDENCE_FOR_RETRY = 60;
const MAX_VISION_ATTEMPTS = 2;

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;

const MAX_TITLE_LENGTH = 120;
const MAX_SEARCH_LENGTH = 100;

const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;

// ========================================
// 🚦 RATE LIMITER
// ========================================

const rateLimitStore = new Map();

function getClientIP(req) {
    return req.ip || req.socket?.remoteAddress || "unknown";
}

function rateLimit(
    maxRequests = RATE_LIMIT_MAX_REQUESTS,
    windowMs = RATE_LIMIT_WINDOW
) {
    return (req, res, next) => {
        const key = getClientIP(req);
        const now = Date.now();
        const existing = rateLimitStore.get(key);

        if (!existing || now - existing.start >= windowMs) {
            rateLimitStore.set(key, {
                start: now,
                count: 1
            });
            return next();
        }

        existing.count++;

        if (existing.count > maxRequests) {
            return res.status(429).json({
                success: false,
                message: "Too many requests. Please try again later."
            });
        }

        next();
    };
}

setInterval(() => {
    const now = Date.now();

    for (const [key, data] of rateLimitStore.entries()) {
        if (now - data.start > RATE_LIMIT_WINDOW) {
            rateLimitStore.delete(key);
        }
    }
}, RATE_LIMIT_WINDOW).unref();

// ========================================
// 🎭 SUPPORTED CONTENT TYPES
// ========================================

const ALLOWED_CONTENT_TYPES = [
    "movie",
    "drama",
    "series",
    "tv",
    "anime",
    "documentary",
    "love story",
    "web series",
    "k-drama",
    "c-drama",
    "thai drama",
    "unknown"
];

// ========================================
// 🧠 MEMORY
// ========================================

let quotaBlockedUntil = 0;
let visionCache = {};

// ========================================
// 🎭 NORMALIZE CONTENT TYPE
// ========================================

function normalizeContentType(type) {
    const value = String(type || "unknown")
        .toLowerCase()
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

    const typeMap = {
        movie: "movie",
        film: "movie",
        feature: "movie",
        "feature film": "movie",

        drama: "drama",

        series: "series",
        "tv series": "series",
        "television series": "series",

        tv: "tv",
        "tv show": "tv",
        "television show": "tv",
        "television program": "tv",

        anime: "anime",
        "anime series": "anime",

        documentary: "documentary",
        "documentary film": "documentary",

        romance: "love story",
        romantic: "love story",
        "love story": "love story",
        lovestory: "love story",
        "romantic drama": "love story",

        "web series": "web series",
        webseries: "web series",
        "web show": "web series",
        "web drama": "web series",
        "online series": "web series",

        "k drama": "k-drama",
        "k-drama": "k-drama",
        kdrama: "k-drama",
        korean: "k-drama",
        "korean drama": "k-drama",
        "korean series": "k-drama",
        "korean tv series": "k-drama",

        "c drama": "c-drama",
        "c-drama": "c-drama",
        cdrama: "c-drama",
        chinese: "c-drama",
        "chinese drama": "c-drama",
        "chinese series": "c-drama",
        "chinese tv series": "c-drama",

        thai: "thai drama",
        "thai drama": "thai drama",
        thaidrama: "thai drama",
        "thai series": "thai drama",
        "thai tv series": "thai drama",
        "thai bl": "thai drama",

        unknown: "unknown"
    };

    return typeMap[value] || "unknown";
}

// ========================================
// 🎭 DISPLAY CONTENT TYPE
// ========================================

function displayContentType(type) {
    const normalized = normalizeContentType(type);

    const labels = {
        movie: "Movie",
        drama: "Drama",
        series: "Series",
        tv: "TV",
        anime: "Anime",
        documentary: "Documentary",
        "love story": "Love Story",
        "web series": "Web Series",
        "k-drama": "K-Drama",
        "c-drama": "C-Drama",
        "thai drama": "Thai Drama",
        unknown: "Unknown"
    };

    return labels[normalized] || "Unknown";
}

// ========================================
// 🧹 SAFE JSON
// ========================================

function safeJSONParse(value, fallback = null) {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

// ========================================
// 🧹 CLEAN TITLE
// ========================================

function cleanTitle(title) {
    return String(title || "")
        .trim()
        .replace(/\s*\(\s*\d{4}\s*\)\s*$/, "")
        .replace(/\s+\d{4}\s*$/, "")
        .trim()
        .slice(0, MAX_TITLE_LENGTH);
}

// ========================================
// 💾 QUOTA STATE
// ========================================

function loadQuotaState() {
    try {
        if (fs.existsSync(QUOTA_FILE)) {
            const raw = fs.readFileSync(QUOTA_FILE, "utf8");
            const data = safeJSONParse(raw, {});
            quotaBlockedUntil = Number(data.blockedUntil || 0);
        }
    } catch {
        quotaBlockedUntil = 0;
    }
}

function saveQuotaState() {
    try {
        fs.writeFileSync(
            QUOTA_FILE,
            JSON.stringify(
                { blockedUntil: quotaBlockedUntil },
                null,
                2
            ),
            "utf8"
        );
    } catch {
        console.warn("⚠️ Could not save quota state.");
    }
}

// ========================================
// 🧠 VISION CACHE
// ========================================

function loadVisionCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const raw = fs.readFileSync(CACHE_FILE, "utf8");
            const data = safeJSONParse(raw, {});

            if (
                data &&
                typeof data === "object" &&
                !Array.isArray(data)
            ) {
                visionCache = data;
            }
        }
    } catch {
        visionCache = {};
    }
}

function saveVisionCache() {
    try {
        fs.writeFileSync(
            CACHE_FILE,
            JSON.stringify(visionCache, null, 2),
            "utf8"
        );
    } catch {
        console.warn("⚠️ Could not save vision cache.");
    }
}

// ========================================
// 🚫 GEMINI QUOTA
// ========================================

function isGeminiQuotaBlocked() {
    if (!quotaBlockedUntil) return false;

    if (Date.now() >= quotaBlockedUntil) {
        quotaBlockedUntil = 0;
        saveQuotaState();

        console.log("✅ Gemini quota protection expired.");
        return false;
    }

    return true;
}

function blockGeminiQuota(durationMs = QUOTA_BLOCK_MS) {
    quotaBlockedUntil = Date.now() + durationMs;
    saveQuotaState();

    console.log("🚫 GEMINI QUOTA EXHAUSTED");
    console.log("⏳ Gemini temporarily blocked.");
}

function getRemainingQuotaTime() {
    if (!isGeminiQuotaBlocked()) return 0;

    return Math.max(
        0,
        quotaBlockedUntil - Date.now()
    );
}

function formatRemainingTime(milliseconds) {
    const totalSeconds = Math.ceil(milliseconds / 1000);

    const hours = Math.floor(totalSeconds / 3600);

    const minutes = Math.floor(
        (totalSeconds % 3600) / 60
    );

    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
}

// ========================================
// 🚀 LOAD DATA
// ========================================

loadQuotaState();
loadVisionCache();

// ========================================
// 🔑 KEY WARNINGS
// ========================================

if (!OMDB_API_KEY) {
    console.warn("⚠️ OMDB_API_KEY is missing from .env");
}

if (!GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY is missing from .env");
}

// ========================================
// 🌐 SECURITY HEADERS
// ========================================

app.disable("x-powered-by");

app.use((req, res, next) => {
    res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
    );

    res.setHeader(
        "X-Frame-Options",
        "SAMEORIGIN"
    );

    res.setHeader(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
    );

    res.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()"
    );

    next();
});

// ========================================
// 🌐 BODY LIMITS
// ========================================

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);

// ========================================
// 🚦 API RATE LIMIT
// ========================================

app.use(
    "/api",
    rateLimit()
);

// ========================================
// 🚫 PRIVATE FILE PROTECTION
// ========================================

app.use((req, res, next) => {
    const blockedFiles = [
        ".env",
        ".env.local",
        ".env.production",
        ".gemini-quota.json",
        ".vision-cache.json",
        "package.json",
        "package-lock.json",
        "server.js"
    ];

    let requested = "";

    try {
        requested = decodeURIComponent(req.path)
            .replace(/^\/+/, "")
            .trim();
    } catch {
        requested = "";
    }

    if (blockedFiles.includes(requested)) {
        return res.status(404).send("Not Found");
    }

    next();
});

// ========================================
// 🌐 STATIC WEBSITE
// ========================================

app.use(
    express.static(__dirname, {
        dotfiles: "deny",
        index: "index.html"
    })
);

// ========================================
// 🖼️ IMAGE + VIDEO UPLOAD
// ========================================

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: MAX_VIDEO_SIZE,
        files: 1
    },

    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",

            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-msvideo",
            "video/x-matroska"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Only JPG, PNG, WEBP, GIF, MP4, WEBM, MOV, AVI and MKV files are allowed."
                )
            );
        }
    }
});

// ========================================
// ❤️ HEALTH
// ========================================

app.get("/api/health", (req, res) => {
    const blocked = isGeminiQuotaBlocked();

    res.json({
        success: true,
        server: true,
        port: PORT,

        omdb: Boolean(OMDB_API_KEY),
        gemini: Boolean(GEMINI_API_KEY),

        geminiModel: VISION_MODEL,
        geminiFallbackModel: VISION_FALLBACK_MODEL,

        geminiQuotaBlocked: blocked,

        geminiQuotaRemaining: blocked
            ? formatRemainingTime(
                  getRemainingQuotaTime()
              )
            : null,

        imageUpload: true,
        videoUpload: true,

        maxImageSize: "8 MB",
        maxVideoSize: "25 MB",

        contentDetection:
            ALLOWED_CONTENT_TYPES
                .filter(type => type !== "unknown")
                .map(displayContentType),

        retryEnabled: true,
        maxVisionAttempts: MAX_VISION_ATTEMPTS,
        minimumConfidence: MIN_CONFIDENCE_FOR_RETRY,

        security: true,
        videoFrameDetection: true,
        maxVideoFrames: 5
    });
});

// ========================================
// 🤖 VISION STATUS
// ========================================

app.get("/api/vision/status", (req, res) => {
    const blocked = isGeminiQuotaBlocked();

    res.json({
        success: true,
        quotaBlocked: blocked,

        remaining: blocked
            ? formatRemainingTime(
                  getRemainingQuotaTime()
              )
            : null,

        model: VISION_MODEL,
        fallbackModel: VISION_FALLBACK_MODEL,

        retryEnabled: true,
        maxAttempts: MAX_VISION_ATTEMPTS,

        imageSupported: true,
        videoSupported: true,

        supportedTypes:
            ALLOWED_CONTENT_TYPES
                .filter(type => type !== "unknown")
                .map(displayContentType)
    });
});

// ========================================
// ⚡ FAST SEARCH CACHE + IN-FLIGHT DEDUPLICATION
// ========================================

const movieCache = new Map();
const MOVIE_CACHE_TTL = 10 * 60 * 1000;
const movieRequestsInFlight = new Map();

function getMovieCacheKey(title, type = "", year = "", language = "") {
    return [title, type, year, language]
        .map(value => String(value || "").toLowerCase().trim())
        .join("|");
}

function getMovieCache(key) {
    const cached = movieCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.time > MOVIE_CACHE_TTL) {
        movieCache.delete(key);
        return null;
    }
    return cached.data;
}

function setMovieCache(key, data) {
    movieCache.set(key, { time: Date.now(), data });
    if (movieCache.size > 200) {
        const firstKey = movieCache.keys().next().value;
        if (firstKey) movieCache.delete(firstKey);
    }
}

const searchCache = new Map();
const SEARCH_CACHE_TTL = 15 * 60 * 1000;
const searchRequestsInFlight = new Map();

// ========================================
// 🎬 OMDb MOVIE / DRAMA / SERIES
// ========================================

app.get("/api/movie", async (req, res) => {
    const title = String(req.query.title || "")
        .trim()
        .slice(0, MAX_TITLE_LENGTH);

    const requestedType = normalizeContentType(req.query.type || "");
    const requestedYear = String(req.query.year || "").trim().slice(0, 10);
    const requestedLanguage = String(req.query.language || "").trim().slice(0, 50);

    if (!title) {
        return res.status(400).json({
            success: false,
            message: "Movie, drama or series title is required."
        });
    }

    if (!OMDB_API_KEY) {
        return res.status(500).json({
            success: false,
            message: "OMDb service is not configured."
        });
    }

    const cleanMovieTitle = cleanTitle(title);
    const cacheKey = getMovieCacheKey(
        cleanMovieTitle,
        requestedType,
        requestedYear,
        requestedLanguage
    );

    const cachedMovie = getMovieCache(cacheKey);
    if (cachedMovie) {
        return res.json({
            success: true,
            cached: true,
            movie: cachedMovie
        });
    }

    if (movieRequestsInFlight.has(cacheKey)) {
        try {
            const result = await movieRequestsInFlight.get(cacheKey);
            return res.json({ ...result, deduplicated: true });
        } catch (error) {
            console.error("❌ Shared OMDb request failed:", error?.message || error);
            return res.status(502).json({
                success: false,
                message: "Unable to load title information right now."
            });
        }
    }

    const requestPromise = (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
            const idOrTitle = cleanMovieTitle.toLowerCase().startsWith("tt")
                ? `i=${encodeURIComponent(cleanMovieTitle)}`
                : `t=${encodeURIComponent(cleanMovieTitle)}`;

            const apiURL = `https://www.omdbapi.com/?apikey=${encodeURIComponent(OMDB_API_KEY)}&${idOrTitle}&plot=full`;
            const response = await fetch(apiURL, {
                method: "GET",
                headers: { "Accept": "application/json" },
                signal: controller.signal
            });

            const data = await response.json();

            if (data.Response === "False") {
                return { success: false, message: data.Error || "Movie or series not found." };
            }

            if (requestedType && requestedType !== "unknown") {
                data.AIType = requestedType;
                data.AITypeLabel = displayContentType(requestedType);
            } else {
                data.AIType = normalizeContentType(data.Type);
                data.AITypeLabel = displayContentType(data.Type);
            }

            if (requestedYear) data.AIYear = requestedYear;
            if (requestedLanguage) data.AILanguage = requestedLanguage;

            setMovieCache(cacheKey, data);
            return { success: true, cached: false, movie: data };
        } finally {
            clearTimeout(timeoutId);
        }
    })();

    movieRequestsInFlight.set(cacheKey, requestPromise);

    try {
        return res.json(await requestPromise);
    } catch (error) {
        console.error("❌ Movie API Error:", error?.name === "AbortError" ? "OMDb request timed out." : error?.message || error);
        return res.status(502).json({
            success: false,
            message: error?.name === "AbortError" ? "Movie service took too long to respond." : "Unable to load title information right now."
        });
    } finally {
        movieRequestsInFlight.delete(cacheKey);
    }
});

// ========================================
// 🔎 FAST OMDb SEARCH
// ========================================

app.get("/api/search", async (req, res) => {
    const title = String(req.query.title || "")
        .trim()
        .slice(0, MAX_SEARCH_LENGTH);

    if (!title) {
        return res.status(400).json({ success: false, message: "Search title is required.", results: [] });
    }

    if (!OMDB_API_KEY) {
        return res.status(500).json({ success: false, message: "OMDb service is not configured.", results: [] });
    }

    const cacheKey = title.toLowerCase().replace(/\s+/g, " ").trim();
    const cached = searchCache.get(cacheKey);

    if (cached && Date.now() - cached.time <= SEARCH_CACHE_TTL) {
        return res.json({ success: true, cached: true, results: cached.results });
    }

    if (cached) searchCache.delete(cacheKey);

    if (searchRequestsInFlight.has(cacheKey)) {
        try {
            const results = await searchRequestsInFlight.get(cacheKey);
            return res.json({ success: true, deduplicated: true, results });
        } catch (error) {
            console.error("❌ Shared search request failed:", error?.message || error);
            return res.status(502).json({ success: false, message: "Search service is temporarily unavailable.", results: [] });
        }
    }

    const requestPromise = (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        try {
            const apiURL = `https://www.omdbapi.com/?apikey=${encodeURIComponent(OMDB_API_KEY)}&s=${encodeURIComponent(title)}`;
            const response = await fetch(apiURL, {
                method: "GET",
                headers: { "Accept": "application/json" },
                signal: controller.signal
            });
            const data = await response.json();
            if (data.Response === "False") return [];

            const results = Array.isArray(data.Search) ? data.Search.slice(0, 10) : [];
            searchCache.set(cacheKey, { time: Date.now(), results });
            if (searchCache.size > 200) {
                const firstKey = searchCache.keys().next().value;
                if (firstKey) searchCache.delete(firstKey);
            }
            return results;
        } finally {
            clearTimeout(timeoutId);
        }
    })();

    searchRequestsInFlight.set(cacheKey, requestPromise);

    try {
        const results = await requestPromise;
        if (!results.length) {
            return res.json({ success: false, message: "No movies or series found.", results: [] });
        }
        return res.json({ success: true, cached: false, results });
    } catch (error) {
        console.error("❌ Search API Error:", error?.name === "AbortError" ? "OMDb search timed out." : error?.message || error);
        return res.status(502).json({
            success: false,
            message: error?.name === "AbortError" ? "Search service took too long to respond." : "Search service is temporarily unavailable.",
            results: []
        });
    } finally {
        searchRequestsInFlight.delete(cacheKey);
    }
});

// ========================================
// 🤖 GEMINI VISION
// 🖼️ IMAGE + 🎥 VIDEO
// ========================================

app.post(
    "/api/vision",
    upload.single("image"),
    async (req, res) => {

        console.log("");
        console.log("📸 Vision request received");

        // ====================================
        // FILE CHECK
        // ====================================

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message:
                    "No image or video was uploaded."
            });
        }

        const isVideo =
            req.file.mimetype.startsWith("video/");

        console.log(
            isVideo
                ? "🎥 Video:"
                : "🖼️ Image:",
            req.file.mimetype
        );

        console.log(
            "📦 Size:",
            req.file.size,
            "bytes"
        );

        // ====================================
        // QUOTA CHECK
        // ====================================

        if (isGeminiQuotaBlocked()) {
            const remaining =
                formatRemainingTime(
                    getRemainingQuotaTime()
                );

            return res.status(429).json({
                success: false,
                quota: true,
                blocked: true,

                message:
                    `Gemini quota exhausted. Please try again after ${remaining}.`,

                retryAfter: remaining
            });
        }

        // ====================================
        // API KEY
        // ====================================

        if (!GEMINI_API_KEY) {
            return res.status(500).json({
                success: false,
                message:
                    "Vision service is not configured."
            });
        }

        // ====================================
        // HASH
        // ====================================

        const fileHash =
            crypto
                .createHash("sha256")
                .update(req.file.buffer)
                .digest("hex");

        // ====================================
        // CACHE
        // ====================================

        const cached =
            visionCache[fileHash];

        if (
            cached &&
            cached.title &&
            Number(cached.confidence) >=
                MIN_CONFIDENCE_FOR_RETRY
        ) {

            console.log(
                "♻️ Returning cached Vision result."
            );

            return res.json({
                success: true,
                cached: true,
                retried: false,
                movie: cached
            });
        }

        // ====================================
        // BASE64
        // ====================================

        const base64File =
            req.file.buffer.toString("base64");

        // ====================================
        // PROMPTS
        // ====================================

        const prompt1 = `
You are an expert entertainment poster and video identification assistant.

Identify the exact movie, drama, series, TV show, anime, documentary, web series, K-Drama, C-Drama or Thai Drama shown in the uploaded media.

Analyze all visible clues:
- title text
- original-language title
- English title
- transliteration
- actors
- actresses
- faces
- characters
- logos
- production company
- network
- streaming platform
- release year
- country
- language
- poster artwork
- franchise
- season information

If the uploaded file is a video, inspect the available visual information and identify the title from frames, characters, text, logos and artwork.

Do not invent a title.

If you cannot identify it, use an empty title.

Return ONLY valid JSON.

{
  "title": "",
  "year": "",
  "language": "",
  "type": "unknown",
  "confidence": 0
}

Allowed types:
"movie"
"drama"
"series"
"tv"
"anime"
"documentary"
"love story"
"web series"
"k-drama"
"c-drama"
"thai drama"
"unknown"

Confidence must be 0-100.
No markdown.
No explanation.
`;

        const prompt2 = `
Re-analyze this entertainment media independently.

Look deeper at:
- exact title
- original-language title
- English title
- actor names
- actress names
- faces
- characters
- network logo
- streaming platform
- production company
- artwork
- release year
- country
- language
- Korean Hangul
- Chinese characters
- Thai script
- movie indicators
- drama indicators
- series indicators
- TV indicators
- anime indicators
- documentary indicators
- romance indicators
- web-series indicators

If it is a video, use visible frames and all readable clues.

Do not repeat a weak guess.
Do not invent a title.

Return ONLY valid JSON.

{
  "title": "",
  "year": "",
  "language": "",
  "type": "unknown",
  "confidence": 0
}

Confidence must be 0-100.
No markdown.
No explanation.
`;

        const models = [
            VISION_MODEL,
            VISION_FALLBACK_MODEL
        ];

        let bestResult = null;
        let lastError = null;

        // ====================================
        // AI ATTEMPTS
        // ====================================

        for (
            let attempt = 1;
            attempt <= MAX_VISION_ATTEMPTS;
            attempt++
        ) {

            const model =
                models[attempt - 1] ||
                VISION_MODEL;

            const prompt =
                attempt === 1
                    ? prompt1
                    : prompt2;

            console.log(
                `🧠 Vision attempt ${attempt}/${MAX_VISION_ATTEMPTS}`
            );

            console.log(
                "🤖 Model:",
                model
            );

            try {

                const body = {
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    text: prompt
                                },
                                {
                                    inline_data: {
                                        mime_type:
                                            req.file.mimetype,
                                        data:
                                            base64File
                                    }
                                }
                            ]
                        }
                    ],

                    generationConfig: {
                        responseMimeType:
                            "application/json",

                        maxOutputTokens: 512,

                        temperature: 0
                    }
                };

                // ====================================
                // CORRECT GEMINI API URL
                // ====================================

                const apiURL =
                    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
                        model
                    )}:generateContent?key=${encodeURIComponent(
                        GEMINI_API_KEY
                    )}`;

                // ====================================
                // GEMINI REQUEST
                // ====================================

                const response =
                    await fetch(
                        apiURL,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify(body)
                        }
                    );

                const rawText =
                    await response.text();

                const data =
                    safeJSONParse(
                        rawText,
                        null
                    );

                // ====================================
                // 429
                // ====================================

                if (response.status === 429) {

                    console.error(
                        "❌ GEMINI 429 / QUOTA"
                    );

                    blockGeminiQuota();

                    return res.status(429).json({
                        success: false,
                        quota: true,
                        blocked: true,

                        message:
                            "Gemini quota exhausted. Vision AI has been temporarily blocked.",

                        retryAfter:
                            "24 hours"
                    });
                }

                // ====================================
                // OTHER ERROR
                // ====================================

                if (!response.ok) {

                    lastError =
                        data?.error?.message ||
                        `Gemini API returned HTTP ${response.status}`;

                    console.error(
                        "❌ Gemini API Error:",
                        response.status,
                        lastError
                    );

                    continue;
                }

                // ====================================
                // EXTRACT TEXT
                // ====================================

                const text =
                    data
                        ?.candidates?.[0]
                        ?.content
                        ?.parts
                        ?.map(
                            part =>
                                part.text || ""
                        )
                        .join("")
                        .trim();

                if (!text) {
                    lastError =
                        "Gemini returned an empty response.";
                    continue;
                }

                console.log(
                    "🤖 Gemini raw result:",
                    text
                );

                // ====================================
                // PARSE JSON
                // ====================================

                let result =
                    safeJSONParse(
                        text,
                        null
                    );

                if (!result) {

                    const cleaned =
                        text
                            .replace(
                                /^```json\s*/i,
                                ""
                            )
                            .replace(
                                /^```\s*/i,
                                ""
                            )
                            .replace(
                                /\s*```$/i,
                                ""
                            )
                            .trim();

                    result =
                        safeJSONParse(
                            cleaned,
                            null
                        );
                }

                if (
                    !result ||
                    typeof result !== "object"
                ) {

                    lastError =
                        "Gemini returned invalid JSON.";

                    continue;
                }

                // ====================================
                // NORMALIZE
                // ====================================

                const movieTitle =
                    cleanTitle(
                        result.title ||
                        result.Title ||
                        ""
                    );

                const year =
                    String(
                        result.year ||
                        result.Year ||
                        ""
                    )
                        .trim()
                        .slice(0, 10);

                const language =
                    String(
                        result.language ||
                        result.Language ||
                        ""
                    )
                        .trim()
                        .slice(0, 50);

                const type =
                    normalizeContentType(
                        result.type ||
                        result.Type ||
                        "unknown"
                    );

                let confidence =
                    Number(
                        result.confidence ??
                        result.Confidence ??
                        0
                    );

                if (Number.isNaN(confidence)) {
                    confidence = 0;
                }

                confidence =
                    Math.max(
                        0,
                        Math.min(
                            100,
                            confidence
                        )
                    );

                const candidate = {
                    title: movieTitle,
                    year,
                    language,
                    type,
                    confidence
                };

                // ====================================
                // BEST RESULT
                // ====================================

                if (
                    movieTitle &&
                    (
                        !bestResult ||
                        confidence >
                            bestResult.confidence
                    )
                ) {
                    bestResult = candidate;
                }

                // ====================================
                // EMPTY TITLE
                // ====================================

                if (!movieTitle) {

                    lastError =
                        "AI could not identify the title.";

                    continue;
                }

                // ====================================
                // LOW CONFIDENCE
                // ====================================

                if (
                    confidence <
                    MIN_CONFIDENCE_FOR_RETRY
                ) {

                    lastError =
                        `Low confidence result: ${confidence}%`;

                    continue;
                }

                // ====================================
                // CACHE
                // ====================================

                visionCache[fileHash] =
                    candidate;

                saveVisionCache();

                console.log(
                    "✅ Vision identification successful."
                );

                console.log(
                    "🎬 Title:",
                    movieTitle
                );

                console.log(
                    "🎭 Type:",
                    displayContentType(type)
                );

                console.log(
                    "🎯 Confidence:",
                    confidence + "%"
                );

                return res.json({
                    success: true,
                    cached: false,
                    retried:
                        attempt > 1,
                    lowConfidence: false,
                    movie: candidate
                });

            } catch (error) {

                lastError =
                    error?.message ||
                    "Unknown Gemini error.";

                console.error(
                    "❌ Gemini request error:",
                    lastError
                );
            }
        }

        // ====================================
        // BEST LOW CONFIDENCE
        // ====================================

        if (
            bestResult &&
            bestResult.title
        ) {

            visionCache[fileHash] =
                bestResult;

            saveVisionCache();

            return res.json({
                success: true,
                cached: false,
                retried: true,
                lowConfidence: true,
                movie: bestResult,

                message:
                    "AI found a possible title, but confidence is low."
            });
        }

        // ====================================
        // FAILED
        // ====================================

        console.error(
            "❌ Vision failed:",
            lastError
        );

        return res.status(503).json({
            success: false,
            retryAttempted: true,

            message:
                "Gemini Vision could not identify this title right now."
        });
    }
);

// ========================================
// 🎥 VIDEO FRAME VISION
// ========================================

app.post(
    "/api/vision-frames",
    upload.array("images", 5),
    async (req, res) => {
        console.log("\n🎥 Video frame Vision request received");

        if (isGeminiQuotaBlocked()) {
            const remaining = formatRemainingTime(
                getRemainingQuotaTime()
            );

            return res.status(429).json({
                success: false,
                quota: true,
                blocked: true,
                message:
                    `Gemini quota exhausted. Please try again after ${remaining}.`,
                retryAfter: remaining
            });
        }

        if (!GEMINI_API_KEY) {
            return res.status(500).json({
                success: false,
                message: "Gemini API key is missing."
            });
        }

        const files = Array.isArray(req.files)
            ? req.files.filter(
                file => file?.mimetype?.startsWith("image/")
            )
            : [];

        if (!files.length) {
            return res.status(400).json({
                success: false,
                message: "No video frames were uploaded."
            });
        }

        if (files.length > 5) {
            return res.status(400).json({
                success: false,
                message: "Maximum 5 video frames are allowed."
            });
        }

        console.log(
            "🎞️ Frames received:",
            files.length
        );

        // Cache key based on all extracted frames.
        const hash = crypto.createHash("sha256");

        files.forEach(file => {
            hash.update(file.buffer);
        });

        const imageHash =
            `video:${hash.digest("hex")}`;

        const cached = visionCache[imageHash];

        if (cached?.title) {
            console.log(
                "♻️ Returning cached video Vision result."
            );

            return res.json({
                success: true,
                cached: true,
                retried: false,
                movie: cached
            });
        }

        const prompt = `
You are an expert entertainment movie and drama identification assistant.

The user uploaded several frames extracted from a 5–8 second video clip.
Identify the exact entertainment title represented by these frames.

Possible content:
Movie
Drama
Series
TV
Anime
Documentary
Love Story
Web Series
K-Drama
C-Drama
Thai Drama

Analyze ALL frames together and use recurring visual clues:
- visible title text
- original-language title
- English title
- transliteration
- actor and actress faces
- characters
- costumes
- logos
- network/platform branding
- production company
- locations
- recognizable scenes
- release year clues
- country
- language
- franchise/season clues

Important:
- Do not invent a title.
- Do not make a random guess from a single frame.
- If the title cannot be identified reliably, return an empty title.
- Use the strongest evidence across all frames.
- Confidence must be 0–100.

Return ONLY valid JSON. No markdown. No explanation.

{
  "title": "",
  "year": "",
  "language": "",
  "type": "unknown",
  "confidence": 0
}

Allowed types:
"movie"
"drama"
"series"
"tv"
"anime"
"documentary"
"love story"
"web series"
"k-drama"
"c-drama"
"thai drama"
"unknown"
`;

        const parts = [
            { text: prompt },
            ...files.map(file => ({
                inline_data: {
                    mime_type: file.mimetype,
                    data: file.buffer.toString("base64")
                }
            }))
        ];

        const models = [
            VISION_MODEL,
            VISION_FALLBACK_MODEL
        ];

        let bestResult = null;
        let lastError = null;

        for (
            let attempt = 1;
            attempt <= MAX_VISION_ATTEMPTS;
            attempt++
        ) {
            const model =
                models[attempt - 1] || VISION_MODEL;

            try {
                console.log(
                    `🧠 Video Vision attempt ${attempt}/${MAX_VISION_ATTEMPTS}`
                );

                console.log(
                    "🤖 Model:",
                    model
                );

                const body = {
                    contents: [
                        {
                            role: "user",
                            parts
                        }
                    ],

                    generationConfig: {
                        responseMimeType: "application/json",
                        maxOutputTokens: 256,
                        temperature: 0
                    }
                };

                const apiURL =
                    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
                        model
                    )}:generateContent?key=${encodeURIComponent(
                        GEMINI_API_KEY
                    )}`;

                const response = await fetch(
                    apiURL,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(body)
                    }
                );

                const rawText = await response.text();
                const data = safeJSONParse(
                    rawText,
                    {}
                );

                if (response.status === 429) {
                    console.error(
                        "❌ GEMINI VIDEO 429 / QUOTA"
                    );

                    blockGeminiQuota();

                    return res.status(429).json({
                        success: false,
                        quota: true,
                        blocked: true,
                        message:
                            "Gemini quota exhausted. Vision AI has been temporarily blocked.",
                        retryAfter: "24 hours"
                    });
                }

                if (!response.ok) {
                    lastError =
                        data?.error?.message ||
                        `Gemini API returned HTTP ${response.status}`;

                    console.error(
                        "❌ Video Gemini API Error:",
                        response.status,
                        lastError
                    );

                    continue;
                }

                const text =
                    data?.candidates?.[0]?.content?.parts
                        ?.map(part => part.text || "")
                        .join("")
                        .trim();

                if (!text) {
                    lastError =
                        "Gemini returned an empty video response.";
                    continue;
                }

                let result = safeJSONParse(
                    text,
                    null
                );

                if (!result) {
                    const cleaned = text
                        .replace(/^```json\s*/i, "")
                        .replace(/^```\s*/i, "")
                        .replace(/\s*```$/i, "")
                        .trim();

                    result = safeJSONParse(
                        cleaned,
                        null
                    );
                }

                if (!result || typeof result !== "object") {
                    lastError =
                        "Gemini returned invalid video JSON.";
                    continue;
                }

                const movieTitle = cleanTitle(
                    result.title ||
                    result.Title ||
                    ""
                );

                const year = String(
                    result.year ||
                    result.Year ||
                    ""
                )
                    .trim()
                    .slice(0, 10);

                const language = String(
                    result.language ||
                    result.Language ||
                    ""
                )
                    .trim()
                    .slice(0, 50);

                const type =
                    normalizeContentType(
                        result.type ||
                        result.Type ||
                        "unknown"
                    );

                let confidence = Number(
                    result.confidence ??
                    result.Confidence ??
                    0
                );

                if (!Number.isFinite(confidence)) {
                    confidence = 0;
                }

                confidence = Math.max(
                    0,
                    Math.min(
                        100,
                        Math.round(confidence)
                    )
                );

                const candidate = {
                    title: movieTitle,
                    year,
                    language,
                    type,
                    confidence
                };

                if (
                    movieTitle &&
                    (!bestResult ||
                        confidence > bestResult.confidence)
                ) {
                    bestResult = candidate;
                }

                if (!movieTitle) {
                    lastError =
                        "AI could not identify the video title.";
                    continue;
                }

                if (
                    confidence < MIN_CONFIDENCE_FOR_RETRY &&
                    attempt < MAX_VISION_ATTEMPTS
                ) {
                    lastError =
                        `Low confidence result: ${confidence}%`;
                    continue;
                }

                visionCache[imageHash] = candidate;
                saveVisionCache();

                console.log(
                    "✅ Video Vision identification successful."
                );

                return res.json({
                    success: true,
                    cached: false,
                    retried: attempt > 1,
                    lowConfidence:
                        confidence < MIN_CONFIDENCE_FOR_RETRY,
                    movie: candidate
                });
            } catch (error) {
                lastError =
                    error?.message ||
                    "Unknown video Gemini error.";

                console.error(
                    "❌ Video Gemini request error:",
                    lastError
                );
            }
        }

        if (bestResult?.title) {
            visionCache[imageHash] = bestResult;
            saveVisionCache();

            return res.json({
                success: true,
                cached: false,
                retried: true,
                lowConfidence: true,
                movie: bestResult,
                message:
                    "AI found a possible title, but confidence is low."
            });
        }

        return res.status(503).json({
            success: false,
            retryAttempted: true,
            message:
                lastError ||
                "Gemini Vision could not identify this video."
        });
    }
);

// ========================================
// 🛡️ MULTER / GENERAL ERROR
// ========================================

app.use(
    (error, req, res, next) => {

        if (
            error instanceof multer.MulterError
        ) {

            let message =
                "File upload error.";

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {

                message =
                    "File is too large. Maximum video size is 25 MB.";
            }

            if (
                error.code ===
                "LIMIT_FILE_COUNT"
            ) {

                message =
                    "Only one file can be uploaded.";
            }

            return res.status(400).json({
                success: false,
                message
            });
        }

        if (error) {

            return res.status(400).json({
                success: false,

                message:
                    error.message ||
                    "Request error."
            });
        }

        next();
    }
);

// ========================================
// 🚫 404 API
// ========================================

app.use(
    "/api",
    (req, res) => {

        return res.status(404).json({
            success: false,
            message:
                "API endpoint not found."
        });
    }
);

// ========================================
// 🚀 START MOVIFIND
// ========================================

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "🎬 MOVIFIND SERVER STARTED"
        );

        console.log(
            "========================================"
        );

        console.log("");

        console.log(
            `🌐 Website: http://localhost:${PORT}`
        );

        console.log("");

        console.log(
            OMDB_API_KEY
                ? "🔎 OMDb API: READY"
                : "⚠️ OMDb API: MISSING"
        );

        console.log("");

        console.log(
            GEMINI_API_KEY
                ? "🤖 Gemini Vision: READY"
                : "⚠️ Gemini Vision: MISSING"
        );

        console.log("");

        console.log(
            "🧠 Vision Model:",
            VISION_MODEL
        );

        console.log(
            "🔁 Fallback Model:",
            VISION_FALLBACK_MODEL
        );

        console.log("");

        console.log(
            "💾 Vision Cache: ENABLED"
        );

        console.log(
            "🛡️ Security Headers: ENABLED"
        );

        console.log(
            "🚦 Rate Limiting: ENABLED"
        );

        console.log(
            "🔐 API Key Protection: ENABLED"
        );

        console.log(
            "🖼️ Image Upload: ENABLED"
        );

        console.log(
            "🎥 Video Upload: ENABLED"
        );

        console.log(
            "🛡️ Gemini Quota Protection: ENABLED"
        );

        console.log(
            "🔄 AI Retry: ENABLED"
        );

        console.log(
            "🎯 Minimum Confidence:",
            MIN_CONFIDENCE_FOR_RETRY + "%"
        );

        console.log("");

        console.log(
            "🎭 Supported Content:"
        );

        console.log(
            ALLOWED_CONTENT_TYPES
                .filter(
                    type =>
                        type !== "unknown"
                )
                .map(
                    displayContentType
                )
                .join(" / ")
        );

        console.log("");

        console.log(
            "========================================"
        );

        console.log("");
    }
);
