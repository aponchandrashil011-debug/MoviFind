// ========================================
// 🎬 MOVIFIND AI CONTENT SEARCH SERVER
// 🔐 SECURITY + OMDb + GEMINI VISION
// ✅ CLEAN READY-TO-PASTE SERVER.JS
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
    process.env.GEMINI_VISION_FALLBACK_MODEL ||
    "gemini-3.5-flash-lite";

// ========================================
// 📁 DATA FILES
// ========================================

const QUOTA_FILE = path.join(
    __dirname,
    ".gemini-quota.json"
);

const CACHE_FILE = path.join(
    __dirname,
    ".vision-cache.json"
);

// ========================================
// ⚙️ SETTINGS
// ========================================

const QUOTA_BLOCK_MS = 24 * 60 * 60 * 1000;
const MIN_CONFIDENCE_FOR_RETRY = 60;
const MAX_VISION_ATTEMPTS = 2;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_TITLE_LENGTH = 120;
const MAX_SEARCH_LENGTH = 100;

// ========================================
// 🚦 RATE LIMITER
// ========================================

const rateLimitStore = new Map();

const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;

function getClientIP(req) {
    return (
        req.ip ||
        req.socket?.remoteAddress ||
        "unknown"
    );
}

function rateLimit(
    maxRequests = RATE_LIMIT_MAX_REQUESTS,
    windowMs = RATE_LIMIT_WINDOW
) {
    return (req, res, next) => {
        const key = getClientIP(req);
        const now = Date.now();

        const existing = rateLimitStore.get(key);

        if (
            !existing ||
            now - existing.start >= windowMs
        ) {
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
                message:
                    "Too many requests. Please try again later."
            });
        }

        next();
    };
}

setInterval(() => {
    const now = Date.now();

    for (
        const [key, data]
        of rateLimitStore.entries()
    ) {
        if (
            now - data.start >
            RATE_LIMIT_WINDOW
        ) {
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
// 🧹 SAFE JSON PARSER
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
            const raw = fs.readFileSync(
                QUOTA_FILE,
                "utf8"
            );

            const data = safeJSONParse(raw, {});

            quotaBlockedUntil =
                Number(data.blockedUntil || 0);
        }
    } catch (error) {
        console.warn(
            "⚠️ Could not load quota state."
        );

        quotaBlockedUntil = 0;
    }
}

function saveQuotaState() {
    try {
        fs.writeFileSync(
            QUOTA_FILE,
            JSON.stringify(
                {
                    blockedUntil:
                        quotaBlockedUntil
                },
                null,
                2
            ),
            "utf8"
        );
    } catch {
        console.warn(
            "⚠️ Could not save quota state."
        );
    }
}

// ========================================
// 🧠 VISION CACHE
// ========================================

function loadVisionCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const raw = fs.readFileSync(
                CACHE_FILE,
                "utf8"
            );

            const data = safeJSONParse(raw, {});

            if (
                data &&
                typeof data === "object" &&
                !Array.isArray(data)
            ) {
                visionCache = data;
            } else {
                visionCache = {};
            }
        }
    } catch {
        console.warn(
            "⚠️ Could not load vision cache."
        );

        visionCache = {};
    }
}

function saveVisionCache() {
    try {
        fs.writeFileSync(
            CACHE_FILE,
            JSON.stringify(
                visionCache,
                null,
                2
            ),
            "utf8"
        );
    } catch {
        console.warn(
            "⚠️ Could not save vision cache."
        );
    }
}

// ========================================
// 🚫 GEMINI QUOTA
// ========================================

function isGeminiQuotaBlocked() {
    if (!quotaBlockedUntil) {
        return false;
    }

    if (Date.now() >= quotaBlockedUntil) {
        quotaBlockedUntil = 0;
        saveQuotaState();

        console.log(
            "✅ Gemini quota protection expired."
        );

        return false;
    }

    return true;
}

function blockGeminiQuota(
    durationMs = QUOTA_BLOCK_MS
) {
    quotaBlockedUntil =
        Date.now() + durationMs;

    saveQuotaState();

    console.log(
        "🚫 GEMINI QUOTA EXHAUSTED"
    );

    console.log(
        "⏳ Gemini temporarily blocked."
    );
}

function getRemainingQuotaTime() {
    if (!isGeminiQuotaBlocked()) {
        return 0;
    }

    return Math.max(
        0,
        quotaBlockedUntil - Date.now()
    );
}

function formatRemainingTime(milliseconds) {
    const totalSeconds = Math.ceil(
        milliseconds / 1000
    );

    const hours = Math.floor(
        totalSeconds / 3600
    );

    const minutes = Math.floor(
        (totalSeconds % 3600) / 60
    );

    const seconds =
        totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
}

// ========================================
// 🚀 LOAD SAVED DATA
// ========================================

loadQuotaState();
loadVisionCache();

// ========================================
// 🔑 API KEY WARNINGS
// ========================================

if (!OMDB_API_KEY) {
    console.warn(
        "⚠️ OMDB_API_KEY is missing from .env"
    );
}

if (!GEMINI_API_KEY) {
    console.warn(
        "⚠️ GEMINI_API_KEY is missing from .env"
    );
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
// 🚦 GLOBAL API RATE LIMIT
// ========================================

app.use(
    "/api",
    rateLimit(60, 60 * 1000)
);

// ========================================
// 🚫 PROTECT PRIVATE FILES
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

    const requested = decodeURIComponent(
        req.path
    ).replace(/^\/+/, "");

    if (blockedFiles.includes(requested)) {
        return res.status(404).send(
            "Not Found"
        );
    }

    next();
});

// ========================================
// 🌐 STATIC MOVIFIND WEBSITE
// ========================================

app.use(
    express.static(__dirname, {
        dotfiles: "deny",
        index: "index.html"
    })
);

// ========================================
// 🖼️ IMAGE UPLOAD
// ========================================

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: MAX_IMAGE_SIZE,
        files: 1
    },

    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (
            allowedTypes.includes(
                file.mimetype
            )
        ) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Only JPG, PNG, WEBP and GIF images are allowed."
                )
            );
        }
    }
});

// ========================================
// ❤️ HEALTH CHECK
// ========================================

app.get(
    "/api/health",
    (req, res) => {
        const blocked =
            isGeminiQuotaBlocked();

        res.json({
            success: true,
            server: true,
            port: PORT,

            omdb: Boolean(
                OMDB_API_KEY
            ),

            gemini: Boolean(
                GEMINI_API_KEY
            ),

            geminiModel:
                VISION_MODEL,

            geminiFallbackModel:
                VISION_FALLBACK_MODEL,

            geminiQuotaBlocked:
                blocked,

            geminiQuotaRemaining:
                blocked
                    ? formatRemainingTime(
                        getRemainingQuotaTime()
                    )
                    : null,

            contentDetection:
                ALLOWED_CONTENT_TYPES
                    .filter(
                        type =>
                            type !==
                            "unknown"
                    )
                    .map(
                        displayContentType
                    ),

            supported:
                ALLOWED_CONTENT_TYPES
                    .filter(
                        type =>
                            type !==
                            "unknown"
                    )
                    .map(
                        displayContentType
                    ),

            retryEnabled: true,

            maxVisionAttempts:
                MAX_VISION_ATTEMPTS,

            minimumConfidence:
                MIN_CONFIDENCE_FOR_RETRY,

            security: true
        });
    }
);

// ========================================
// 🤖 VISION STATUS
// ========================================

app.get(
    "/api/vision/status",
    (req, res) => {
        const blocked =
            isGeminiQuotaBlocked();

        res.json({
            success: true,

            quotaBlocked:
                blocked,

            remaining:
                blocked
                    ? formatRemainingTime(
                        getRemainingQuotaTime()
                    )
                    : null,

            model:
                VISION_MODEL,

            fallbackModel:
                VISION_FALLBACK_MODEL,

            retryEnabled: true,

            maxAttempts:
                MAX_VISION_ATTEMPTS,

            minimumConfidence:
                MIN_CONFIDENCE_FOR_RETRY,

            supportedTypes:
                ALLOWED_CONTENT_TYPES
                    .filter(
                        type =>
                            type !==
                            "unknown"
                    )
                    .map(
                        displayContentType
                    )
        });
    }
);

// ========================================
// 🎬 OMDb MOVIE / DRAMA / SERIES DETAILS
// ========================================

app.get(
    "/api/movie",
    async (req, res) => {
        const title = String(
            req.query.title || ""
        )
            .trim()
            .slice(
                0,
                MAX_TITLE_LENGTH
            );

        const requestedType =
            normalizeContentType(
                req.query.type || ""
            );

        const requestedYear =
            String(
                req.query.year || ""
            )
                .trim()
                .slice(0, 10);

        const requestedLanguage =
            String(
                req.query.language || ""
            )
                .trim()
                .slice(0, 50);

        if (!title) {
            return res.status(400).json({
                success: false,
                message:
                    "Movie, drama or series title is required."
            });
        }

        if (!OMDB_API_KEY) {
            return res.status(500).json({
                success: false,
                message:
                    "OMDb service is not configured."
            });
        }

        const cleanMovieTitle =
            cleanTitle(title);

        try {
            let apiURL;

            if (
                cleanMovieTitle
                    .toLowerCase()
                    .startsWith("tt")
            ) {
                apiURL =
                    `https://www.omdbapi.com/?apikey=${encodeURIComponent(
                        OMDB_API_KEY
                    )}&i=${encodeURIComponent(
                        cleanMovieTitle
                    )}&plot=full`;
            } else {
                apiURL =
                    `https://www.omdbapi.com/?apikey=${encodeURIComponent(
                        OMDB_API_KEY
                    )}&t=${encodeURIComponent(
                        cleanMovieTitle
                    )}&plot=full`;
            }

            const response =
                await fetch(apiURL);

            const data =
                await response.json();

            if (
                data.Response ===
                "False"
            ) {
                return res.json({
                    success: false,
                    message:
                        data.Error ||
                        "Movie or series not found."
                });
            }

            // ====================================
            // AI TYPE
            // ====================================

            if (
                requestedType &&
                requestedType !==
                    "unknown"
            ) {
                data.AIType =
                    requestedType;

                data.AITypeLabel =
                    displayContentType(
                        requestedType
                    );
            } else {
                data.AIType =
                    normalizeContentType(
                        data.Type
                    );

                data.AITypeLabel =
                    displayContentType(
                        data.Type
                    );
            }

            // ====================================
            // OPTIONAL YEAR
            // ====================================

            if (requestedYear) {
                data.AIYear =
                    requestedYear;
            }

            // ====================================
            // OPTIONAL LANGUAGE
            // ====================================

            if (requestedLanguage) {
                data.AILanguage =
                    requestedLanguage;
            }

            return res.json({
                success: true,
                movie: data
            });

        } catch (error) {
            console.error(
                "❌ Movie API Error:",
                error.message
            );

            return res.status(502).json({
                success: false,
                message:
                    "Unable to load title information right now."
            });
        }
    }
);

// ========================================
// 🔎 OMDb SEARCH
// ========================================

app.get(
    "/api/search",
    async (req, res) => {
        const title = String(
            req.query.title || ""
        )
            .trim()
            .slice(
                0,
                MAX_SEARCH_LENGTH
            );

        if (!title) {
            return res.status(400).json({
                success: false,
                message:
                    "Search title is required.",
                results: []
            });
        }

        if (!OMDB_API_KEY) {
            return res.status(500).json({
                success: false,
                message:
                    "OMDb service is not configured.",
                results: []
            });
        }

        try {
            const apiURL =
                `https://www.omdbapi.com/?apikey=${encodeURIComponent(
                    OMDB_API_KEY
                )}&s=${encodeURIComponent(
                    title
                )}`;

            const response =
                await fetch(apiURL);

            const data =
                await response.json();

            if (
                data.Response ===
                "False"
            ) {
                return res.json({
                    success: false,
                    message:
                        data.Error ||
                        "No movies or series found.",
                    results: []
                });
            }

            const results =
                Array.isArray(
                    data.Search
                )
                    ? data.Search.slice(
                        0,
                        10
                    )
                    : [];

            return res.json({
                success: true,
                results
            });

        } catch (error) {
            console.error(
                "❌ Search API Error:",
                error.message
            );

            return res.status(502).json({
                success: false,
                message:
                    "Search service is temporarily unavailable.",
                results: []
            });
        }
    }
);

// ========================================
// 🤖 GEMINI VISION
// ========================================

app.post(
    "/api/vision",
    upload.single("image"),
    async (req, res) => {
        console.log("");
        console.log(
            "📸 Vision request received"
        );

        // ====================================
        // QUOTA CHECK
        // ====================================

        if (
            isGeminiQuotaBlocked()
        ) {
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
                retryAfter:
                    remaining
            });
        }

        // ====================================
        // API KEY CHECK
        // ====================================

        if (!GEMINI_API_KEY) {
            return res.status(500).json({
                success: false,
                message:
                    "Vision service is not configured."
            });
        }

        // ====================================
        // IMAGE CHECK
        // ====================================

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message:
                    "No image was uploaded."
            });
        }

        console.log(
            "🖼️ Image:",
            req.file.mimetype
        );

        console.log(
            "📦 Size:",
            req.file.size,
            "bytes"
        );

        // ====================================
        // IMAGE HASH
        // ====================================

        const imageHash =
            crypto
                .createHash("sha256")
                .update(
                    req.file.buffer
                )
                .digest("hex");

        // ====================================
        // CACHE CHECK
        // ====================================

        const cached =
            visionCache[
                imageHash
            ];

        if (
            cached &&
            cached.title &&
            Number(
                cached.confidence
            ) >=
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

        if (cached) {
            delete visionCache[
                imageHash
            ];

            saveVisionCache();
        }

        // ====================================
        // BASE64
        // ====================================

        const base64Image =
            req.file.buffer.toString(
                "base64"
            );

        // ====================================
        // MODELS
        // ====================================

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
            attempt <=
            MAX_VISION_ATTEMPTS;
            attempt++
        ) {
            const model =
                models[
                    attempt - 1
                ] ||
                VISION_MODEL;

            console.log(
                `🧠 Vision attempt ${attempt}/${MAX_VISION_ATTEMPTS}`
            );

            console.log(
                "🤖 Model:",
                model
            );

            try {
                // ====================================
                // PROMPT
                // ====================================

                const prompt =
                    attempt === 1
                        ? `
You are an expert entertainment poster identification assistant.

Analyze the uploaded poster carefully.

PRIMARY TASK:

Identify the exact entertainment title shown in the image.

The content may be:

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

Use all visible clues:

- exact title
- original-language title
- English title
- transliteration
- actors
- actresses
- characters
- faces
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

KOREAN:
Use k-drama when clearly Korean drama/series content.

CHINESE:
Use c-drama when clearly Chinese drama/series content.

THAI:
Use thai drama when clearly Thai drama/series content.

RULES:

Normal film = movie
General drama = drama
General series = series
TV show = tv
Anime = anime
Documentary = documentary
Romance-focused title = love story
Internet/streaming series = web series

Do not invent a title.

If uncertain, return an empty title.

Return ONLY valid JSON.

{
  "title": "",
  "year": "",
  "language": "",
  "type": "",
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
No code fences.
`
                        : `
Re-analyze this entertainment poster independently.

Do deeper visual analysis.

Look carefully for:

- exact visible title
- original-language title
- English title
- transliteration
- actor names
- actress names
- character clues
- faces
- network logo
- streaming platform
- production company
- artwork
- release year
- country
- original language
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

Do not repeat a weak guess.

Do not invent a title.

If title cannot be identified confidently, return an empty title.

Return ONLY valid JSON.

{
  "title": "",
  "year": "",
  "language": "",
  "type": "",
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
No code fences.
`;

                // ====================================
                // GEMINI BODY
                // ====================================

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
                                            base64Image
                                    }
                                }
                            ]
                        }
                    ],

                    generationConfig: {
                        responseMimeType:
                            "application/json"
                    }
                };

                // ====================================
                // GEMINI API URL
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
                                JSON.stringify(
                                    body
                                )
                        }
                    );

                // ====================================
                // RESPONSE TEXT
                // ====================================

                const rawText =
                    await response.text();

                const data =
                    safeJSONParse(
                        rawText,
                        {
                            error: {
                                message:
                                    "Gemini returned an invalid response."
                            }
                        }
                    );

                // ====================================
                // 429 QUOTA
                // ====================================

                if (
                    response.status ===
                    429
                ) {
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
                // 503
                // ====================================

                if (
                    response.status ===
                    503
                ) {
                    lastError =
                        "Gemini service temporarily unavailable.";

                    console.warn(
                        "⚠️ Gemini 503. Trying fallback..."
                    );

                    continue;
                }

                // ====================================
                // OTHER ERROR
                // ====================================

                if (!response.ok) {
                    lastError =
                        `Gemini API returned HTTP ${response.status}`;

                    console.error(
                        "❌ Gemini API Error:",
                        response.status,
                        data?.error?.message || ""
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
                                part.text ||
                                ""
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
                                /^```json/i,
                                ""
                            )
                            .replace(
                                /^```/i,
                                ""
                            )
                            .replace(
                                /```$/i,
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
                    typeof result !==
                        "object"
                ) {
                    lastError =
                        "Gemini returned invalid JSON.";

                    continue;
                }

                // ====================================
                // NORMALIZE AI RESULT
                // ====================================

                const movieTitle =
                    String(
                        result.title ||
                        result.Title ||
                        ""
                    )
                        .trim()
                        .slice(
                            0,
                            MAX_TITLE_LENGTH
                        );

                const year =
                    String(
                        result.year ||
                        result.Year ||
                        ""
                    )
                        .trim()
                        .slice(
                            0,
                            10
                        );

                const language =
                    String(
                        result.language ||
                        result.Language ||
                        ""
                    )
                        .trim()
                        .slice(
                            0,
                            50
                        );

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

                if (
                    Number.isNaN(
                        confidence
                    )
                ) {
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
                    title:
                        movieTitle,

                    year:
                        year,

                    language:
                        language,

                    type:
                        type,

                    confidence:
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
                    bestResult =
                        candidate;
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
                // SAVE CACHE
                // ====================================

                visionCache[
                    imageHash
                ] = candidate;

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
                    displayContentType(
                        type
                    )
                );

                console.log(
                    "🎯 Confidence:",
                    confidence + "%"
                );

                // ====================================
                // SEND RESULT
                // ====================================

                return res.json({
                    success: true,
                    cached: false,
                    retried:
                        attempt > 1,
                    lowConfidence:
                        false,
                    movie:
                        candidate
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

        // ========================================
        // BEST LOW CONFIDENCE RESULT
        // ========================================

        if (
            bestResult &&
            bestResult.title
        ) {
            return res.json({
                success: true,
                cached: false,
                retried: true,
                lowConfidence: true,
                movie:
                    bestResult,
                message:
                    "AI found a possible title, but confidence is low."
            });
        }

        // ========================================
        // ALL FAILED
        // ========================================

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
// 🛡️ MULTER / GENERAL ERROR HANDLER
// ========================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {
        if (
            error instanceof
            multer.MulterError
        ) {
            let message =
                "Image upload error.";

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {
                message =
                    "Image is too large. Maximum size is 8 MB.";
            }

            if (
                error.code ===
                "LIMIT_FILE_COUNT"
            ) {
                message =
                    "Only one image can be uploaded.";
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
// 🚫 404 API HANDLER
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
            "🖼️ Secure Image Upload: ENABLED"
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
                        type !==
                        "unknown"
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