// ======================================================
// 🎬 MOVIFIND - FRONTEND SCRIPT
// Gemini Vision + OMDb + Movie/Drama/Series
// K-Drama + C-Drama + Thai Drama + Web Series
// ======================================================


// ======================================================
// 🌐 API BASE
// ======================================================

// Empty = same server where website is running
const API_BASE = "";


// ======================================================
// 🎭 DISPLAY CONTENT TYPE
// ======================================================

function displayContentType(type) {

    const value = String(type || "unknown")
        .toLowerCase()
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

    const labels = {

        movie: "Movie",
        drama: "Drama",
        series: "Series",
        tv: "TV",
        anime: "Anime",
        documentary: "Documentary",
        "love story": "Love Story",
        "web series": "Web Series",
        "k drama": "K-Drama",
        "c drama": "C-Drama",
        "thai drama": "Thai Drama",
        unknown: "Unknown"

    };

    return labels[value] || "Unknown";
}


// ======================================================
// 🔧 NORMALIZE CONTENT TYPE
// ======================================================

function normalizeContentType(type) {

    const value = String(type || "unknown")
        .toLowerCase()
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

    const map = {

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

    return map[value] || "unknown";
}


// ======================================================
// 🛡️ SAFE DOM GET
// ======================================================

function getElement(id) {

    return document.getElementById(id);

}


// ======================================================
// 🔔 STATUS MESSAGE
// ======================================================

function setStatus(message, type = "info") {

    const result = getElement("result");

    if (!result) {

        console.log(message);

        return;
    }

    let icon = "ℹ️";

    if (type === "success") {
        icon = "✅";
    }

    if (type === "error") {
        icon = "❌";
    }

    if (type === "loading") {
        icon = "⏳";
    }

    result.innerHTML = `

        <p class="movifind-status ${type}">
            ${icon} ${escapeHTML(message)}
        </p>

    `;
}


// ======================================================
// 🎬 SEARCH MOVIE / DRAMA / SERIES
// ======================================================

const movifindSearchCache = new Map();

// ======================================================
// ⚡ FAST SEARCH SYSTEM
// Cache + Abort Previous Request + Request Protection
// ======================================================

const MOVIFIND_SEARCH_CACHE = new Map();

let movifindSearchController = null;
let movifindSearchRequestId = 0;

const MOVIFIND_SEARCH_CACHE_TTL = 10 * 60 * 1000;


// ======================================================
// 🧹 SEARCH CACHE CLEANUP
// ======================================================

function getMoviFindCachedSearch(key) {

    const cached =
        MOVIFIND_SEARCH_CACHE.get(key);

    if (!cached) {
        return null;
    }

    if (
        Date.now() - cached.time >
        MOVIFIND_SEARCH_CACHE_TTL
    ) {
        MOVIFIND_SEARCH_CACHE.delete(key);
        return null;
    }

    return cached.data;
}


// ======================================================
// 💾 SAVE SEARCH CACHE
// ======================================================

function setMoviFindSearchCache(key, data) {

    MOVIFIND_SEARCH_CACHE.set(
        key,
        {
            time: Date.now(),
            data: data
        }
    );

    // Keep browser memory small
    if (
        MOVIFIND_SEARCH_CACHE.size >
        50
    ) {

        const firstKey =
            MOVIFIND_SEARCH_CACHE
                .keys()
                .next()
                .value;

        if (firstKey) {
            MOVIFIND_SEARCH_CACHE.delete(
                firstKey
            );
        }
    }
}


// ======================================================
// 🎬 FAST SEARCH MOVIE / DRAMA / SERIES
// ======================================================

async function searchMovie() {

    const movieInput =
        getElement("movieInput");

    const result =
        getElement("result");

    if (!movieInput) {
        console.error(
            "❌ movieInput element not found."
        );
        return;
    }

    const query =
        movieInput.value
            .trim();

    if (!query) {

        setStatus(
            "Please enter a movie, drama or series name first.",
            "error"
        );

        return;
    }


    // ==================================================
    // 🔑 NORMALIZED CACHE KEY
    // ==================================================

    const cacheKey =
        query
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();


    // ==================================================
    // ⚡ CACHE FIRST
    // ==================================================

    const cached =
        getMoviFindCachedSearch(
            cacheKey
        );

    if (cached) {

        console.log(
            "⚡ Search result loaded from cache:",
            query
        );

        if (
            cached.success &&
            cached.movie
        ) {

            renderMovie(
                cached.movie
            );

            return;
        }
    }


    // ==================================================
    // 🚫 CANCEL PREVIOUS SEARCH
    // ==================================================

    if (
        movifindSearchController
    ) {

        movifindSearchController.abort();
    }


    movifindSearchController =
        new AbortController();

    const requestId =
        ++movifindSearchRequestId;


    // ==================================================
    // ⏳ LOADING
    // ==================================================

    if (result) {

        result.innerHTML = `
            <p class="movifind-status loading">
                ⏳ Searching for
                "<strong>${escapeHTML(query)}</strong>"...
            </p>
        `;
    }


    try {

        const response =
            await fetch(
                `${API_BASE}/api/movie?title=${encodeURIComponent(query)}`,
                {
                    method: "GET",
                    signal:
                        movifindSearchController
                            .signal,

                    headers: {
                        "Accept":
                            "application/json"
                    },

                    cache: "no-store"
                }
            );


        const data =
            await safeJSON(
                response
            );


        // ==================================================
        // 🚫 IGNORE OLD REQUEST
        // ==================================================

        if (
            requestId !==
            movifindSearchRequestId
        ) {

            console.log(
                "⚠️ Ignored old search request:",
                query
            );

            return;
        }


        // ==================================================
        // ❌ ERROR
        // ==================================================

        if (
            !response.ok ||
            !data.success
        ) {

            setStatus(
                data.message ||
                "Movie or series not found.",
                "error"
            );

            return;
        }


        // ==================================================
        // 💾 CACHE RESULT
        // ==================================================

        if (data.movie) {

            setMoviFindSearchCache(
                cacheKey,
                data
            );
        }


        // ==================================================
        // 🎬 RENDER
        // ==================================================

        renderMovie(
            data.movie
        );


    } catch (error) {

        if (
            error?.name ===
            "AbortError"
        ) {

            console.log(
                "⚡ Previous search cancelled."
            );

            return;
        }


        console.error(
            "❌ Search error:",
            error
        );


        setStatus(
            "Could not connect to MoviFind server.",
            "error"
        );
    }
}


// ======================================================
// 🎬 FETCH MOVIE DETAILS
// ======================================================

async function fetchMovie(name, detectedInfo = null) {

    const title = String(name || "").trim();

    if (!title) {

        return;
    }

    const result = getElement("result");

    if (result) {

        result.innerHTML = `

            <p class="movifind-status loading">

                ⏳ Loading details for
                "<strong>${escapeHTML(title)}</strong>"...

            </p>

        `;
    }

    try {

        let url =
            `${API_BASE}/api/movie?title=${encodeURIComponent(title)}`;

        // --------------------------------------------------
        // AI INFORMATION
        // --------------------------------------------------

        if (detectedInfo) {

            if (detectedInfo.type) {

                url +=
                    `&type=${encodeURIComponent(
                        detectedInfo.type
                    )}`;
            }

            if (detectedInfo.year) {

                url +=
                    `&year=${encodeURIComponent(
                        detectedInfo.year
                    )}`;
            }

            if (detectedInfo.language) {

                url +=
                    `&language=${encodeURIComponent(
                        detectedInfo.language
                    )}`;
            }
        }

        const response = await fetch(url);

        const data = await safeJSON(response);

        if (!response.ok || !data.success) {

            setStatus(

                data.message ||
                "Content details could not be loaded.",

                "error"

            );

            return;
        }

        const movie = data.movie || {};

        // --------------------------------------------------
        // PRESERVE AI DATA
        // --------------------------------------------------

        if (detectedInfo) {

            const normalizedType =
                normalizeContentType(
                    detectedInfo.type
                );

            if (normalizedType !== "unknown") {

                movie.AIType = normalizedType;

                movie.AITypeLabel =
                    displayContentType(
                        normalizedType
                    );
            }

            if (detectedInfo.year) {

                movie.AIYear =
                    detectedInfo.year;
            }

            if (detectedInfo.language) {

                movie.AILanguage =
                    detectedInfo.language;
            }

            if (
                detectedInfo.confidence !== undefined
            ) {

                movie.AIConfidence =
                    detectedInfo.confidence;
            }
        }
            addMoviFindHistory(movie);

            renderMovie(movie);

    }

    catch (error) {

        console.error(
            "❌ fetchMovie error:",
            error
        );

        setStatus(
            "Server connection failed.",
            "error"
        );
    }
}


// ======================================================
// 🎨 RENDER MOVIE DETAILS
// ======================================================

function renderMovie(movie) {

    const result = getElement("result");

    if (!result) {

        return;
    }

    if (!movie) {

        setStatus(
            "No content data received.",
            "error"
        );

        return;
    }

    // ==================================================
    // 🎭 CONTENT TYPE
    // ==================================================

    let contentType =
        normalizeContentType(

            movie.AIType ||
            movie.AITypeLabel ||
            movie.Type ||
            movie.type

        );

    let contentTypeLabel =
        movie.AITypeLabel ||
        displayContentType(contentType);


    // ==================================================
    // 📅 YEAR
    // ==================================================

    const releaseYear =
        movie.AIYear ||
        movie.Year ||
        "N/A";


    // ==================================================
    // 🌐 LANGUAGE
    // ==================================================

    const language =
        movie.AILanguage ||
        movie.Language ||
        "N/A";


    // ==================================================
    // 🖼️ POSTER
    // ==================================================

    const poster =
        movie.Poster &&
        movie.Poster !== "N/A"
            ? movie.Poster
            : "";


    // ==================================================
    // ⭐ RATING
    // ==================================================

    const rating =
        movie.imdbRating &&
        movie.imdbRating !== "N/A"
            ? movie.imdbRating
            : "N/A";


    // ==================================================
    // 📝 PLOT
    // ==================================================

    const plot =
        movie.Plot &&
        movie.Plot !== "N/A"
            ? movie.Plot
            : "No story information available.";


    // ==================================================
    // 🎭 GENRE
    // ==================================================

    const genre =
        movie.Genre &&
        movie.Genre !== "N/A"
            ? movie.Genre
            : "N/A";


    // ==================================================
    // 🌍 COUNTRY
    // ==================================================

    const country =
        movie.Country &&
        movie.Country !== "N/A"
            ? movie.Country
            : "N/A";


    // ==================================================
    // 🎬 DIRECTOR
    // ==================================================

    const director =
        movie.Director &&
        movie.Director !== "N/A"
            ? movie.Director
            : "N/A";


    // ==================================================
    // ✍️ WRITER
    // ==================================================

    const writer =
        movie.Writer &&
        movie.Writer !== "N/A"
            ? movie.Writer
            : "N/A";


    // ==================================================
    // 👥 ACTORS
    // ==================================================

    const actors =
        movie.Actors &&
        movie.Actors !== "N/A"
            ? movie.Actors
            : "N/A";


    // ==================================================
    // ⏱️ RUNTIME
    // ==================================================

    const runtime =
        movie.Runtime &&
        movie.Runtime !== "N/A"
            ? movie.Runtime
            : "N/A";


    // ==================================================
    // 🏆 AWARDS
    // ==================================================

    const awards =
        movie.Awards &&
        movie.Awards !== "N/A"
            ? movie.Awards
            : "N/A";


    // ==================================================
    // 🎯 AI CONFIDENCE
    // ==================================================

    const confidence =
        movie.AIConfidence !== undefined
            ? movie.AIConfidence
            : movie.confidence;


    const confidenceHTML =

        confidence !== undefined &&
        confidence !== null &&
        confidence !== ""

            ? `

                <div class="movifind-ai-confidence">

                    🎯 AI Confidence:
                    <strong>
                        ${escapeHTML(
                            String(confidence)
                        )}%
                    </strong>

                </div>

            `

            : "";


    // ==================================================
// 🎬 WATCH / SEARCH LINKS
// ==================================================

const contentTitle =
    String(movie.Title || "").trim();

const normalizedType =
    normalizeContentType(
        movie.AIType ||
        movie.AITypeLabel ||
        movie.Type ||
        movie.type
    );

// --------------------------------------------------
// 🌐 VIDEO LANGUAGE OPTIONS
// --------------------------------------------------

const watchLanguages = [
    "English",
    "Hindi",
    "Bangla",
    "Korean",
    "Chinese",
    "Thai",
    "Japanese",
    "Tamil",
    "Telugu",
    "Malayalam",
    "Kannada",
    "Urdu"
];

const detectedLanguage = String(
    movie.AILanguage ||
    movie.Language ||
    ""
).split(",")[0].trim();

const defaultWatchLanguage =
    watchLanguages.find(
        language =>
            detectedLanguage.toLowerCase().includes(
                language.toLowerCase()
            )
    ) || "English";

// --------------------------------------------------
// 🎥 MOVIE / EPISODE SEARCH
// --------------------------------------------------

const watchSearchText =
    normalizedType === "movie"
        ? `${contentTitle} full movie official`
        : `${contentTitle} full episode official`;

const youtubeURL =
    `https://www.youtube.com/results?search_query=${encodeURIComponent(
        watchSearchText
    )}`;

const googleURL =
    `https://www.google.com/search?q=${encodeURIComponent(
        watchSearchText
    )}`;

const whereToWatchURL =
    `https://www.google.com/search?q=${encodeURIComponent(
        `${contentTitle} where to watch official streaming`
    )}`;

// --------------------------------------------------
// 🌐 LANGUAGE SELECTOR + DYNAMIC LINKS
// --------------------------------------------------

function buildYouTubeWatchURL() {

    const selector =
        document.getElementById(
            "movifindWatchLanguage"
        );

    const language =
        selector?.value ||
        defaultWatchLanguage;

    const query =
        normalizedType === "movie"
            ? `${contentTitle} ${language} full movie official`
            : `${contentTitle} ${language} full episode official`;

    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function buildGoogleWatchURL() {

    const selector =
        document.getElementById(
            "movifindWatchLanguage"
        );

    const language =
        selector?.value ||
        defaultWatchLanguage;

    const query =
        normalizedType === "movie"
            ? `${contentTitle} ${language} full movie official`
            : `${contentTitle} ${language} full episode official`;

    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function setupWatchLanguageSelector() {

    const buttons =
        result.querySelector(
            ".movie-buttons"
        );

    if (!buttons) return;

    let wrapper =
        result.querySelector(
            ".movifind-watch-language"
        );

    if (!wrapper) {

        wrapper =
            document.createElement("div");

        wrapper.className =
            "movifind-watch-language";

        wrapper.style.cssText = `
            margin: 15px 0;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        `;

        wrapper.innerHTML = `
            <label
                for="movifindWatchLanguage"
                style="font-weight:600;"
            >
                🌐 Video Language:
            </label>

            <select
                id="movifindWatchLanguage"
                style="padding:8px 12px;border-radius:8px;cursor:pointer;"
            >
                ${watchLanguages.map(language => `
                    <option
                        value="${escapeAttribute(language)}"
                        ${language === defaultWatchLanguage ? "selected" : ""}
                    >
                        ${escapeHTML(language)}
                    </option>
                `).join("")}
            </select>
        `;

        buttons.parentNode.insertBefore(
            wrapper,
            buttons
        );
    }

    const selector =
        document.getElementById(
            "movifindWatchLanguage"
        );

    const youtubeButton =
        result.querySelector(
            "[data-movifind-youtube]"
        );

    const googleButton =
        result.querySelector(
            "[data-movifind-google]"
        );

    if (selector) {

        selector.addEventListener(
            "change",
            function () {

                if (youtubeButton) {
                    youtubeButton.href =
                        buildYouTubeWatchURL();
                }

                if (googleButton) {
                    googleButton.href =
                        buildGoogleWatchURL();
                }

                console.log(
                    "🌐 Watch language changed:",
                    this.value
                );
            }
        );
    }
}

// 🔎 FOUND MESSAGE
    // ==================================================

    result.innerHTML = `

        <div class="movifind-found-message">

            ✅ Content found!

        </div>


        <div class="movie-card">


            <!-- POSTER -->

            <div class="movie-poster-wrapper">

                ${
                    poster

                        ? `

                            <img

                                class="movie-poster"

                                src="${escapeAttribute(
                                    poster
                                )}"

                                alt="${escapeAttribute(
                                    movie.Title ||
                                    "Poster"
                                )}"

                                onerror="
                                    this.onerror=null;
                                    this.style.display='none';
                                "

                            >

                        `

                        : `

                            <div class="poster-placeholder">

                                🎬

                            </div>

                        `
                }

            </div>


            <!-- INFORMATION -->

            <div class="movie-info">


                <h2>

                    🎬

                    ${escapeHTML(
                        movie.Title ||
                        "Unknown Title"
                    )}

                </h2>


                <!-- IMDb -->

                <div class="movie-rating">

                    ⭐ IMDb:

                    <strong>

                        ${escapeHTML(
                            String(rating)
                        )}

                    </strong>

                </div>


                <!-- AI CONFIDENCE -->

                ${confidenceHTML}


                <!-- DETAILS -->

                <div class="movie-details-grid">


                    <div class="detail-item">

                        <strong>
                            🎭 Content Type
                        </strong>

                        <span>
                            ${escapeHTML(
                                contentTypeLabel
                            )}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            📅 Released
                        </strong>

                        <span>
                            ${escapeHTML(
                                movie.Released ||
                                releaseYear
                            )}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            ⏱️ Runtime
                        </strong>

                        <span>
                            ${escapeHTML(runtime)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            🎭 Genre
                        </strong>

                        <span>
                            ${escapeHTML(genre)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            🌐 Language
                        </strong>

                        <span>
                            ${escapeHTML(language)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            🌍 Country
                        </strong>

                        <span>
                            ${escapeHTML(country)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            🎬 Director
                        </strong>

                        <span>
                            ${escapeHTML(director)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            ✍️ Writer
                        </strong>

                        <span>
                            ${escapeHTML(writer)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            🎥 Actors
                        </strong>

                        <span>
                            ${escapeHTML(actors)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            🏆 Awards
                        </strong>

                        <span>
                            ${escapeHTML(awards)}
                        </span>

                    </div>


                </div>


                <!-- STORY -->

                <div class="movie-story">

                    <h3>
                        📖 Story
                    </h3>

                    <p>
                        ${escapeHTML(plot)}
                    </p>

                </div>


                <!-- BUTTONS -->

<div class="movie-buttons">


    <!-- ▶️ YOUTUBE -->

    <a

        data-movifind-youtube="true"

        href="${escapeAttribute(
            youtubeURL
        )}"

        target="_blank"

        rel="noopener noreferrer"

    >

        ▶ YouTube Full ${
            normalizedType === "movie"
                ? "Movie"
                : "Episode"
        }

    </a>


    <!-- 🔎 GOOGLE -->

    <a

        data-movifind-google="true"

        href="${escapeAttribute(
            googleURL
        )}"

        target="_blank"

        rel="noopener noreferrer"

    >

        🔎 Google Search

    </a>


        <!-- 🎬 WHERE TO WATCH -->
    <a
        href="${escapeAttribute(
            whereToWatchURL
        )}"
        target="_blank"
        rel="noopener noreferrer"
    >
        🎬 Where to Watch
    </a>


    <!-- ❤️ FAVORITE -->
    <a
        href="#"
        data-movifind-favorite="true"
    >
        ❤️ Add to Favorites
    </a>


    <!-- 📺 WATCHLIST -->
    <a
        href="#"
        data-movifind-watchlist="true"
    >
        📺 Add to Watchlist
    </a>


</div>


            </div>


        </div>

    `;


    // 🌐 Initialize video-language selector after the result card exists.

    // ❤️ FAVORITE BUTTON
    const favoriteButton =
        result.querySelector(
            '[data-movifind-favorite="true"]'
        );

    if (favoriteButton) {
        favoriteButton.addEventListener(
            "click",
            function (event) {
                event.preventDefault();
                addMoviFindFavorite(movie);
            }
        );
    }


    // 📺 WATCHLIST BUTTON
    const watchlistButton =
        result.querySelector(
            '[data-movifind-watchlist="true"]'
        );

    if (watchlistButton) {
        watchlistButton.addEventListener(
            "click",
            function (event) {
                event.preventDefault();
                addMoviFindWatchlist(movie);
            }
        );
    }


    setupWatchLanguageSelector();

    console.log(
        "🎬 Rendered:",
        movie.Title
    );

    setupWatchLanguageSelector();

    console.log(
        "🎬 Rendered:",
        movie.Title
    );

    console.log(
        "🎭 Content Type:",
        contentTypeLabel
    );

}


// ======================================================
// 🖼️ IMAGE INPUT
// ======================================================

const imageInput =
    getElement("imageInput");


const previewContainer =
    getElement(
        "imagePreviewContainer"
    );


const previewImage =
    getElement(
        "imagePreview"
    );


// ======================================================
// 📸 IMAGE PREVIEW
// ======================================================

if (imageInput) {

    imageInput.addEventListener(
        "change",
        function () {

            const file =
                this.files &&
                this.files[0];

            if (!file) {

                return;
            }


            // --------------------------------------------------
            // IMAGE TYPE VALIDATION
            // --------------------------------------------------

            if (
                !file.type ||
                !file.type.startsWith(
                    "image/"
                )
            ) {

                setStatus(
                    "Please select an image file.",
                    "error"
                );

                this.value = "";

                return;
            }


            // --------------------------------------------------
            // SIZE LIMIT
            // --------------------------------------------------

            if (
                file.size >
                8 * 1024 * 1024
            ) {

                setStatus(
                    "Image is too large. Maximum size is 8 MB.",
                    "error"
                );

                this.value = "";

                return;
            }


            // --------------------------------------------------
            // PREVIEW
            // --------------------------------------------------

            if (previewImage) {

                const reader =
                    new FileReader();

                reader.onload =
                    function (event) {

                        previewImage.src =
                            event.target.result;

                    };

                reader.readAsDataURL(file);
            }


            if (previewContainer) {

                previewContainer.style.display =
                    "block";
            }


            console.log(
                "📸 Selected image:",
                file.name
            );

        }
    );

}


// ======================================================
// 🤖 GEMINI VISION DETECTION
// ======================================================

let movifindDetectionBusy = false;

async function optimizeImageForVision(file) {
    if (!file || !file.type?.startsWith("image/")) return file;
    try {
        const bitmap = await createImageBitmap(file);
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.84));
        return blob ? new File([blob], "movifind.jpg", { type: "image/jpeg" }) : file;
    } catch { return file; }
}

async function handleVisionResult(response) {
    const data = await safeJSON(response);

    if (response.status === 429 || data.quota) {

    console.warn(
        "⚠️ Gemini Vision temporarily unavailable:",
        data.message || "Rate limit reached"
    );

    setStatus(
        "⚠️ AI Detection is temporarily unavailable. You can still search movies normally.",
        "info"
    );

    return null;
}

    if (!response.ok || !data.success) {
        setStatus(data.message || "AI could not identify this content.", "error");
        return null;
    }
    const detected = data.movie || {};
    const title = String(detected.title || detected.Title || "").trim();
    const year = String(detected.year || detected.Year || "").trim();
    const language = String(detected.language || detected.Language || "").trim();
    const type = normalizeContentType(detected.type || detected.Type || "unknown");
    const confidence = Number(detected.confidence ?? detected.Confidence ?? 0) || 0;
    if (!title) {
        setStatus("AI could not identify the title. Try a clearer image/video.", "error");
        return null;
    }
    const movieInput = getElement("movieInput");
    if (movieInput) movieInput.value = title;
    showDetectionResult({ title, year, language, type, confidence });
    await fetchMovie(title, { title, year, language, type, confidence });
    return detected;
}

async function detectContent() {
    if (movifindDetectionBusy) return;
    const file = imageInput?.files?.[0];
    if (!file) {
        setStatus("Please upload a movie or drama poster first.", "error");
        return;
    }
    if (!file.type?.startsWith("image/")) {
        setStatus("Only image files are allowed.", "error");
        return;
    }
    if (file.size > 8 * 1024 * 1024) {
        setStatus("Image is too large. Maximum size is 8 MB.", "error");
        return;
    }
    movifindDetectionBusy = true;
    setStatus("🤖 Identifying poster…", "loading");
    try {
        const optimized = await optimizeImageForVision(file);
        const formData = new FormData();
        formData.append("image", optimized);
        const response = await fetch(`${API_BASE}/api/vision`, { method: "POST", body: formData });
        await handleVisionResult(response);
    } catch (error) {
        console.error("❌ Image Vision error:", error);
        setStatus("Could not connect to Vision server.", "error");
    } finally {
        movifindDetectionBusy = false;
    }
}

function getVideoInput() {
    return getElement("videoInput") || document.querySelector("input[type='file'][accept*='video']");
}

async function extractVideoFrames(file) {
    if (!file || !file.type?.startsWith("video/")) {
        throw new Error("Invalid video file.");
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error("Video metadata timeout.")),
                10000
            );

            video.onloadedmetadata = () => {
                clearTimeout(timeout);
                resolve();
            };

            video.onerror = () => {
                clearTimeout(timeout);
                reject(new Error("Could not read video metadata."));
            };
        });

        const duration = Number(video.duration);

        if (!Number.isFinite(duration)) {
            throw new Error("Invalid video duration.");
        }

        // MoviFind accepts only 5–8 second clips.
        if (duration < 5 || duration > 8) {
            throw new Error(
                `VIDEO_DURATION:${duration.toFixed(2)}`
            );
        }

        const width = video.videoWidth || 960;
        const height = video.videoHeight || 540;
        const scale = Math.min(1, 768 / Math.max(width, height));

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));

        const ctx = canvas.getContext("2d", { alpha: false });

        if (!ctx) {
            throw new Error("Could not create video canvas.");
        }

        // FAST MODE: three representative frames are enough for most clips.
        // This reduces browser extraction time and Gemini payload size.
        const times = [
            Math.min(0.65, duration * 0.15),
            duration * 0.50,
            Math.max(0.1, duration - 0.65)
        ];

        const blobs = [];

        for (const time of times) {
            video.currentTime = Math.max(
                0,
                Math.min(time, duration - 0.05)
            );

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(
                    () => reject(new Error("Video frame seek timeout.")),
                    8000
                );

                video.onseeked = () => {
                    clearTimeout(timeout);
                    resolve();
                };

                video.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error("Could not seek video frame."));
                };
            });

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );

            const blob = await new Promise(resolve => {
                canvas.toBlob(
                    resolve,
                    "image/jpeg",
                    0.62
                );
            });

            if (blob) {
                blobs.push(blob);
            }
        }

        return blobs;
    } finally {
        video.pause();
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(url);
    }
}

async function detectContentFromVideo() {
    if (movifindDetectionBusy) return;

    const input = getVideoInput();
    const file = input?.files?.[0];

    if (!file) {
        setStatus(
            "Please upload a 5–8 second video first.",
            "error"
        );
        return;
    }

    if (!file.type?.startsWith("video/")) {
        setStatus(
            "Please select a video file.",
            "error"
        );
        return;
    }

    if (file.size > 8 * 1024 * 1024) {
        setStatus(
            "Video is too large. Maximum size is 8 MB.",
            "error"
        );
        return;
    }

    movifindDetectionBusy = true;

    setStatus(
        "🎥 Checking 5–8 second video…",
        "loading"
    );

    try {
        const frames = await extractVideoFrames(file);

        if (!frames.length) {
            throw new Error("No frames extracted.");
        }

        const formData = new FormData();

        frames.forEach((blob, index) => {
            formData.append(
                "images",
                blob,
                `movifind-frame-${index + 1}.jpg`
            );
        });

        setStatus(
            "🤖 AI is identifying the movie from video frames…",
            "loading"
        );

        const response = await fetch(
            `${API_BASE}/api/vision-frames`,
            {
                method: "POST",
                body: formData
            }
        );

        await handleVisionResult(response);
    } catch (error) {
        console.error(
            "❌ Video Vision error:",
            error
        );

        if (String(error?.message || "").startsWith("VIDEO_DURATION:")) {
            const seconds = String(error.message).split(":")[1];

            setStatus(
                `Video duration is ${seconds} seconds. Please upload a video between 5 and 8 seconds.`,
                "error"
            );
        } else {
            setStatus(
                "Could not analyze this video. Please try a clear 5–8 second clip.",
                "error"
            );
        }
    } finally {
        movifindDetectionBusy = false;
    }
}

// Add video controls without replacing index.html.
(function setupVideoDetection() {
    let input = getVideoInput();
    const detectImageButton = getElement("detectButton");
    let videoDetectButton = getElement("videoDetectButton");

    if (!input && !detectImageButton && !videoDetectButton) return;

    // Create the video input only when the HTML does not already contain it.
    if (!input) {
        input = document.createElement("input");
        input.type = "file";
        input.id = "videoInput";
        input.accept = "video/mp4,video/webm,video/ogg,video/quicktime";
        input.style.display = "none";
        document.body.appendChild(input);
    }

    // Create a Detect From Video button only when the HTML does not already contain one.
    if (!videoDetectButton) {
        videoDetectButton = document.createElement("button");
        videoDetectButton.type = "button";
        videoDetectButton.id = "videoDetectButton";
        videoDetectButton.className = "movifind-button";
        videoDetectButton.textContent = "🎬 Detect From Video";

        if (detectImageButton?.parentNode) {
            detectImageButton.parentNode.appendChild(videoDetectButton);
        } else {
            document.body.appendChild(videoDetectButton);
        }
    }

    // Video selection = preview + validation only.
    // IMPORTANT: Do NOT start the AI request here. The user must click
    // "Detect From Video" after the video is successfully loaded.
    if (!input.dataset.movifindVideoBound) {
        input.addEventListener("change", function () {
            const file = input.files?.[0];
            const previewContainer = getElement("videoPreviewContainer");
            const preview = getElement("videoPreview");

            if (!file) return;

            if (!file.type?.startsWith("video/")) {
                setStatus("Please select a video file.", "error");
                input.value = "";
                if (previewContainer) previewContainer.style.display = "none";
                return;
            }

            // Keep the UI rule at 8 MB.
            if (file.size > 8 * 1024 * 1024) {
                setStatus("Video is too large. Maximum size is 8 MB.", "error");
                input.value = "";
                if (previewContainer) previewContainer.style.display = "none";
                return;
            }

            if (!preview || !previewContainer) {
                setStatus("Video selected. Click Detect From Video.", "success");
                return;
            }

            const oldURL = preview.dataset.movifindObjectURL;
            if (oldURL) URL.revokeObjectURL(oldURL);

            const objectURL = URL.createObjectURL(file);
            preview.dataset.movifindObjectURL = objectURL;
            preview.src = objectURL;
            preview.load();
            previewContainer.style.display = "block";

            const durationStatus = previewContainer.querySelector(".video-duration-status");
            if (durationStatus) {
                durationStatus.textContent = "Checking video duration…";
                durationStatus.className = "video-duration-status";
            }

            preview.onloadedmetadata = function () {
                const duration = Number(preview.duration);

                if (!Number.isFinite(duration) || duration < 5 || duration > 8) {
                    if (durationStatus) {
                        durationStatus.textContent =
                            `❌ Video must be 5–8 seconds (detected: ${Number.isFinite(duration) ? duration.toFixed(2) : "unknown"}s)`;
                        durationStatus.className = "video-duration-status invalid";
                    }

                    setStatus(
                        `Video duration is ${Number.isFinite(duration) ? duration.toFixed(2) : "unknown"} seconds. Please upload a video between 5 and 8 seconds.`,
                        "error"
                    );
                    return;
                }

                if (durationStatus) {
                    durationStatus.textContent = `✅ Video duration: ${duration.toFixed(2)} seconds`;
                    durationStatus.className = "video-duration-status valid";
                }

                setStatus(
                    `✅ Video ready: ${duration.toFixed(2)} seconds. Click Detect From Video.`,
                    "success"
                );
            };

            preview.onerror = function () {
                if (durationStatus) {
                    durationStatus.textContent = "❌ Could not read this video.";
                    durationStatus.className = "video-duration-status invalid";
                }
                setStatus("Could not read this video. Please choose MP4 or WebM.", "error");
            };

            console.log("🎥 Selected video:", file.name, "|", file.size, "bytes");
        });

        input.dataset.movifindVideoBound = "true";
    }

    // Bind the real detection button once.
    if (!videoDetectButton.dataset.movifindDetectBound) {
        videoDetectButton.addEventListener("click", detectContentFromVideo);
        videoDetectButton.dataset.movifindDetectBound = "true";
    }
})();

// ======================================================
// 🎭 SHOW AI DETECTION RESULT
// ======================================================

function showDetectionResult(info) {

    const container =
        getElement(
            "detectedResult"
        );


    const title =
        escapeHTML(
            info.title ||
            "Unknown"
        );


    const type =
        escapeHTML(
            displayContentType(
                info.type
            )
        );


    const year =
        escapeHTML(
            info.year ||
            "N/A"
        );


    const language =
        escapeHTML(
            info.language ||
            "N/A"
        );


    const confidence =
        escapeHTML(
            String(
                info.confidence ||
                0
            )
        );


    // ==================================================
    // IF HTML HAS detectedResult
    // ==================================================

    if (container) {

        container.innerHTML = `

            <div class="ai-detection-card">


                <div>

                    ✅ Detected:

                    <strong>
                        ${title}
                    </strong>

                </div>


                <div>

                    🎭 Type:

                    <strong>
                        ${type}
                    </strong>

                </div>


                <div>

                    📅 Year:

                    <strong>
                        ${year}
                    </strong>

                </div>


                <div>

                    🌐 Language:

                    <strong>
                        ${language}
                    </strong>

                </div>


                <div>

                    🎯 Confidence:

                    <strong>
                        ${confidence}%
                    </strong>

                </div>


            </div>

        `;

        return;
    }


    // ==================================================
    // FALLBACK DETECTION BOX
    // ==================================================

    const result =
        getElement(
            "result"
        );


    if (!result) {

        return;
    }


    const existing =
        document.getElementById(
            "movifindAutoDetection"
        );


    if (existing) {

        existing.remove();
    }


    const detection =
        document.createElement(
            "div"
        );


    detection.id =
        "movifindAutoDetection";


    detection.className =
        "ai-detection-card";


    detection.innerHTML = `

        <div>

            ✅ Detected:

            <strong>
                ${title}
            </strong>

        </div>


        <div>

            🎭 Type:

            <strong>
                ${type}
            </strong>

        </div>


        <div>

            📅 Year:

            <strong>
                ${year}
            </strong>

        </div>


        <div>

            🌐 Language:

            <strong>
                ${language}
            </strong>

        </div>


        <div>

            🎯 Confidence:

            <strong>
                ${confidence}%
            </strong>

        </div>

    `;


    result.parentNode.insertBefore(
        detection,
        result
    );

}


// ======================================================
// 🧹 ESCAPE HTML
// ======================================================

function escapeHTML(value) {

    return String(value ?? "")

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// ======================================================
// 🔐 ESCAPE ATTRIBUTE
// ======================================================

function escapeAttribute(value) {

    return escapeHTML(value);

}


// ======================================================
// 📦 SAFE JSON RESPONSE
// ======================================================

async function safeJSON(response) {

    const text =
        await response.text();

    try {

        return JSON.parse(text);

    }

    catch (error) {

        console.error(
            "❌ Invalid server response:",
            text
        );

        return {

            success: false,

            message:
                "Server returned an invalid response."

        };

    }

}


// ======================================================
// 🔍 ENTER KEY SEARCH
// ======================================================

const movieInput =
    getElement(
        "movieInput"
    );


if (movieInput) {

    movieInput.addEventListener(

        "keypress",

        function (event) {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                searchMovie();

            }

        }

    );

}


// ======================================================
// 🔘 DETECT BUTTON
// ======================================================

const detectButton =
    getElement(
        "detectButton"
    );


if (detectButton) {

    detectButton.addEventListener(

        "click",

        function () {

            detectContent();

        }

    );

}


// ======================================================
// 🔘 SEARCH BUTTON
// ======================================================

const searchButton =
    getElement(
        "searchButton"
    );


if (searchButton) {

    searchButton.addEventListener(

        "click",

        function () {

            searchMovie();

        }

    );

}


// ======================================================
// 🌐 SERVER HEALTH CHECK
// ======================================================

async function checkServerHealth() {

    try {

        const response =
            await fetch(

                `${API_BASE}/api/health`

            );


        const data =
            await safeJSON(response);


        if (data.success) {

            console.log(
                "🟢 MoviFind Server: ONLINE"
            );


            console.log(
                "🔎 OMDb:",
                data.omdb
                    ? "READY"
                    : "MISSING"
            );


            console.log(
                "🤖 Gemini:",
                data.gemini
                    ? "READY"
                    : "MISSING"
            );


            console.log(
                "🎭 Supported:",
                data.supportedContent
            );


            if (data.geminiModel) {

                console.log(
                    "🧠 Vision Model:",
                    data.geminiModel
                );

            }


            if (data.geminiFallbackModel) {

                console.log(
                    "🔁 Fallback Model:",
                    data.geminiFallbackModel
                );

            }


            return true;

        }

    }

    catch (error) {

        console.warn(
            "🔴 MoviFind Server is not reachable."
        );


        console.warn(
            "Start server with: node server.js"
        );

    }


    return false;

}


// ❤️ MOVIFIND STORAGE
// ======================================================

const MOVIFIND_STORAGE = {

    favorites:
        "movifind_favorites",

    watchlist:
        "movifind_watchlist",

    history:
        "movifind_search_history"

};


// ======================================================
// 💾 STORAGE GET
// ======================================================

function movifindGetStorage(key) {

    try {

        const data =
            JSON.parse(
                localStorage.getItem(
                    key
                ) || "[]"
            );


        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        console.error(
            "MoviFind storage read error:",
            error
        );

        return [];
    }
}


// ======================================================
// 💾 STORAGE SET
// ======================================================

function movifindSetStorage(
    key,
    data
) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(
                Array.isArray(data)
                    ? data
                    : []
            )
        );

        return true;

    } catch (error) {

        console.error(
            "MoviFind storage save error:",
            error
        );

        return false;
    }
}


// ======================================================
// 🎬 CREATE MOVIE STORAGE OBJECT
// ======================================================

function movifindMovieObject(movie) {

    if (!movie) {
        return null;
    }


    return {

        imdbID:
            String(
                movie.imdbID ||
                ""
            ).trim(),

        Title:
            String(
                movie.Title ||
                movie.title ||
                ""
            ).trim(),

        Year:
            String(
                movie.Year ||
                movie.AIYear ||
                movie.year ||
                ""
            ).trim(),

        Poster:
            String(
                movie.Poster ||
                movie.poster ||
                ""
            ).trim(),

        Type:
            String(
                movie.AITypeLabel ||
                movie.AIType ||
                movie.Type ||
                movie.type ||
                ""
            ).trim(),

        Genre:
            String(
                movie.Genre ||
                ""
            ).trim(),

        Language:
            String(
                movie.AILanguage ||
                movie.Language ||
                movie.language ||
                ""
            ).trim(),

        imdbRating:
            String(
                movie.imdbRating ||
                ""
            ).trim(),

        Plot:
            String(
                movie.Plot ||
                ""
            ).trim(),

        savedAt:
            Date.now()

    };
}


// ======================================================
// 🔑 MOVIE UNIQUE ID
// ======================================================

function movifindMovieKey(movie) {

    if (!movie) {
        return "";
    }


    const imdbID =
        String(
            movie.imdbID ||
            ""
        ).trim();


    if (imdbID) {

        return imdbID
            .toLowerCase();
    }


    return String(
        movie.Title ||
        movie.title ||
        ""
    )
    .trim()
    .toLowerCase();
}


// ======================================================
// ❤️ ADD FAVORITE
// ======================================================

function addMoviFindFavorite(movie) {

    const item =
        movifindMovieObject(
            movie
        );


    if (!item || !item.Title) {
        return;
    }


    const favorites =
        movifindGetStorage(
            MOVIFIND_STORAGE.favorites
        );


    const key =
        movifindMovieKey(
            item
        );


    const exists =
        favorites.some(
            item =>
                movifindMovieKey(
                    item
                ) === key
        );


    if (exists) {

        showMoviFindMessage(
            "❤️ Already in Favorites."
        );

        return;
    }


    favorites.unshift(
        item
    );


    movifindSetStorage(
        MOVIFIND_STORAGE.favorites,
        favorites
    );


    showMoviFindMessage(
        `❤️ ${item.Title} added to Favorites.`
    );


    updateMoviFindLibraryUI();
}


// ======================================================
// ❌ REMOVE FAVORITE
// ======================================================

function removeMoviFindFavorite(key) {

    const favorites =
        movifindGetStorage(
            MOVIFIND_STORAGE.favorites
        );


    const normalizedKey =
        String(key || "")
            .toLowerCase();


    const updated =
        favorites.filter(
            movie =>
                movifindMovieKey(
                    movie
                ) !== normalizedKey
        );


    movifindSetStorage(
        MOVIFIND_STORAGE.favorites,
        updated
    );


    updateMoviFindLibraryUI();
}


// ======================================================
// 📺 ADD WATCHLIST
// ======================================================

function addMoviFindWatchlist(movie) {

    const item =
        movifindMovieObject(
            movie
        );


    if (!item || !item.Title) {
        return;
    }


    const watchlist =
        movifindGetStorage(
            MOVIFIND_STORAGE.watchlist
        );


    const key =
        movifindMovieKey(
            item
        );


    const exists =
        watchlist.some(
            item =>
                movifindMovieKey(
                    item
                ) === key
        );


    if (exists) {

        showMoviFindMessage(
            "📺 Already in Watchlist."
        );

        return;
    }


    watchlist.unshift(
        item
    );


    movifindSetStorage(
        MOVIFIND_STORAGE.watchlist,
        watchlist
    );


    showMoviFindMessage(
        `📺 ${item.Title} added to Watchlist.`
    );


    updateMoviFindLibraryUI();
}


// ======================================================
// ❌ REMOVE WATCHLIST
// ======================================================

function removeMoviFindWatchlist(key) {

    const watchlist =
        movifindGetStorage(
            MOVIFIND_STORAGE.watchlist
        );


    const normalizedKey =
        String(key || "")
            .toLowerCase();


    const updated =
        watchlist.filter(
            movie =>
                movifindMovieKey(
                    movie
                ) !== normalizedKey
        );


    movifindSetStorage(
        MOVIFIND_STORAGE.watchlist,
        updated
    );


    updateMoviFindLibraryUI();
}


// ======================================================
// 🕘 SEARCH HISTORY
// ======================================================

function addMoviFindHistory(movie) {

    const item =
        movifindMovieObject(
            movie
        );


    if (!item || !item.Title) {
        return;
    }


    let history =
        movifindGetStorage(
            MOVIFIND_STORAGE.history
        );


    const key =
        movifindMovieKey(
            item
        );


    history =
        history.filter(
            movie =>
                movifindMovieKey(
                    movie
                ) !== key
        );


    history.unshift(
        item
    );


    history =
        history.slice(
            0,
            20
        );


    movifindSetStorage(
        MOVIFIND_STORAGE.history,
        history
    );


    updateMoviFindLibraryUI();
}


// ======================================================
// 🧹 CLEAR HISTORY
// ======================================================

function clearMoviFindHistory() {

    localStorage.removeItem(
        MOVIFIND_STORAGE.history
    );


    updateMoviFindLibraryUI();


    showMoviFindMessage(
        "🧹 Search history cleared."
    );
}


// ======================================================
// 🔔 MESSAGE
// ======================================================

function showMoviFindMessage(message) {

    let box =
        document.getElementById(
            "movifindLibraryMessage"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "movifindLibraryMessage";


        box.className =
            "movifind-toast";


        document.body.appendChild(
            box
        );
    }


    box.textContent =
        message;


    box.style.display =
        "block";


    clearTimeout(
        box._timer
    );


    box._timer =
        setTimeout(
            function () {

                box.style.display =
                    "none";

            },
            2500
        );
}


// ======================================================
// 📚 LIBRARY PANEL
// ======================================================

function createMoviFindLibraryUI() {

    if (
        document.getElementById(
            "movifindLibrary"
        )
    ) {

        return;
    }


    const container =
        document.querySelector(
            ".movifind-container"
        );


    if (!container) {

        console.warn(
            "⚠️ .movifind-container not found."
        );

        return;
    }


    const library =
        document.createElement(
            "section"
        );


    library.id =
        "movifindLibrary";


    library.innerHTML = `

        <div class="movifind-library-tabs">

            <button
                type="button"
                data-library-tab="favorites"
                class="movifind-library-tab active"
            >
                ❤️ Favorites
            </button>


            <button
                type="button"
                data-library-tab="watchlist"
                class="movifind-library-tab"
            >
                📺 Watchlist
            </button>


            <button
                type="button"
                data-library-tab="history"
                class="movifind-library-tab"
            >
                🕘 History
            </button>

        </div>


        <div id="movifindLibraryContent"></div>

    `;


    container.appendChild(
        library
    );


    library
        .querySelectorAll(
            "[data-library-tab]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        library
                            .querySelectorAll(
                                "[data-library-tab]"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );


                        this.classList.add(
                            "active"
                        );


                        renderMoviFindLibrary(
                            this.dataset.libraryTab
                        );

                    }
                );

            }
        );


    renderMoviFindLibrary(
        "favorites"
    );
}


// ======================================================
// 📚 RENDER LIBRARY
// ======================================================

function renderMoviFindLibrary(
    section = "favorites"
) {

    const content =
        document.getElementById(
            "movifindLibraryContent"
        );


    if (!content) {
        return;
    }


    let items = [];


    if (
        section ===
        "favorites"
    ) {

        items =
            movifindGetStorage(
                MOVIFIND_STORAGE.favorites
            );
    }


    if (
        section ===
        "watchlist"
    ) {

        items =
            movifindGetStorage(
                MOVIFIND_STORAGE.watchlist
            );
    }


    if (
        section ===
        "history"
    ) {

        items =
            movifindGetStorage(
                MOVIFIND_STORAGE.history
            );
    }


    const titleMap = {

        favorites:
            "❤️ Your Favorites",

        watchlist:
            "📺 Your Watchlist",

        history:
            "🕘 Search History"

    };


    const emptyMap = {

        favorites:
            "No favorite movies yet.",

        watchlist:
            "Your Watchlist is empty.",

        history:
            "No search history yet."

    };


    let html = `

        <div class="movifind-library-heading">

            <h3>
                ${escapeHTML(
                    titleMap[section] ||
                    "Library"
                )}
            </h3>


            ${
                section === "history" &&
                items.length
                    ? `
                        <button
                            type="button"
                            id="movifindClearHistory"
                            class="movifind-clear-history"
                        >
                            🧹 Clear History
                        </button>
                    `
                    : ""
            }

        </div>

    `;


    if (!items.length) {

        html += `

            <div class="movifind-library-empty">

                ${escapeHTML(
                    emptyMap[section] ||
                    "Nothing here yet."
                )}

            </div>

        `;


        content.innerHTML =
            html;


        attachLibraryTabState();


        return;
    }


    html += `

        <div class="movifind-library-grid">

    `;


    items.forEach(
        function (movie) {

            const key =
                movifindMovieKey(
                    movie
                );


            const poster =
                movie.Poster &&
                movie.Poster !== "N/A"
                    ? `
                        <img
                            src="${escapeAttribute(
                                movie.Poster
                            )}"
                            alt="${escapeAttribute(
                                movie.Title
                            )}"
                            loading="lazy"
                            class="movifind-library-poster"
                            onerror="
                                this.onerror=null;
                                this.style.display='none';
                            "
                        >
                    `
                    : `
                        <div class="movifind-library-poster-placeholder">
                            🎬
                        </div>
                    `;


            html += `

                <div class="movifind-library-item">

                    ${poster}


                    <strong>
                        ${escapeHTML(
                            movie.Title ||
                            "Unknown"
                        )}
                    </strong>


                    <div class="movifind-library-year">

                        ${escapeHTML(
                            movie.Year ||
                            "N/A"
                        )}

                    </div>


                    <div class="movifind-library-buttons">

                        <button
                            type="button"
                            data-open-moviefind="${escapeAttribute(
                                key
                            )}"
                            class="movifind-open-btn"
                        >
                            🔎 Open
                        </button>


                        <button
                            type="button"
                            data-remove-moviefind="${escapeAttribute(
                                key
                            )}"
                            data-remove-section="${escapeAttribute(
                                section
                            )}"
                            class="movifind-remove-btn"
                        >
                            🗑️ Remove
                        </button>

                    </div>

                </div>

            `;
        }
    );


    html += `</div>`;


    content.innerHTML =
        html;


    // ==================================================
    // CLEAR HISTORY
    // ==================================================

    const clearButton =
        document.getElementById(
            "movifindClearHistory"
        );


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            clearMoviFindHistory
        );
    }


    // ==================================================
    // OPEN
    // ==================================================

    content
        .querySelectorAll(
            "[data-open-moviefind]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        const key =
                            this.dataset.openMoviefind;


                        const movie =
                            items.find(
                                item =>
                                    movifindMovieKey(
                                        item
                                    ) === key
                            );


                        if (!movie) {
                            return;
                        }


                        const input =
                            getElement(
                                "movieInput"
                            );


                        if (input) {

                            input.value =
                                movie.Title;
                        }


                        fetchMovie(
                            movie.Title
                        );


                        window.scrollTo({

                            top: 0,

                            behavior:
                                "smooth"

                        });

                    }
                );

            }
        );


    // ==================================================
    // REMOVE
    // ==================================================

    content
        .querySelectorAll(
            "[data-remove-moviefind]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        const key =
                            this.dataset.removeMoviefind;


                        const type =
                            this.dataset.removeSection;


                        if (
                            type ===
                            "favorites"
                        ) {

                            removeMoviFindFavorite(
                                key
                            );

                            return;
                        }


                        if (
                            type ===
                            "watchlist"
                        ) {

                            removeMoviFindWatchlist(
                                key
                            );

                            return;
                        }


                        if (
                            type ===
                            "history"
                        ) {

                            const history =
                                movifindGetStorage(
                                    MOVIFIND_STORAGE.history
                                );


                            const updated =
                                history.filter(
                                    movie =>
                                        movifindMovieKey(
                                            movie
                                        ) !== key
                                );


                            movifindSetStorage(
                                MOVIFIND_STORAGE.history,
                                updated
                            );


                            updateMoviFindLibraryUI();

                        }

                    }
                );

            }
        );


    attachLibraryTabState();
}


// ======================================================
// 🔄 ACTIVE LIBRARY TAB
// ======================================================

function attachLibraryTabState() {

    const library =
        document.getElementById(
            "movifindLibrary"
        );


    if (!library) {
        return;
    }


    const active =
        library.querySelector(
            ".movifind-library-tab.active"
        );


    if (active) {
        return;
    }


    const first =
        library.querySelector(
            '[data-library-tab="favorites"]'
        );


    if (first) {

        first.classList.add(
            "active"
        );
    }
}


// ======================================================
// 🔄 UPDATE LIBRARY
// ======================================================

function updateMoviFindLibraryUI() {

    const library =
        document.getElementById(
            "movifindLibrary"
        );


    if (!library) {
        return;
    }


    const active =
        library.querySelector(
            ".movifind-library-tab.active"
        );


    const section =
        active?.dataset.libraryTab ||
        "favorites";


    renderMoviFindLibrary(
        section
    );
}


// ======================================================
// 🎨 MOVIFIND STYLES
// ======================================================



function setupMoviFindLibraryStyles() {

    if (
        document.getElementById(
            "movifindLibraryStyles"
        )
    ) {

        return;
    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "movifindLibraryStyles";


    style.textContent = `

        /* =========================================
           STATUS
        ========================================= */

        .movifind-status {

            padding:12px;

            border-radius:8px;

            text-align:center;

        }


        .movifind-status.loading {

            opacity:.9;

        }


        .movifind-status.error {

            color:#ff6b6b;

        }


        .movifind-status.success {

            color:#6be7a8;

        }


        /* =========================================
           AI LOADING
        ========================================= */

        .movifind-ai-loading {

            width:100%;

            max-width:420px;

            margin:20px auto;

            padding:25px 15px;

            box-sizing:border-box;

            text-align:center;

            border-radius:12px;

            background:#17171d;

            border:1px solid #34343e;

        }


        .movifind-ai-loading-icon {

            font-size:35px;

            margin-bottom:8px;

        }


        .movifind-ai-loading strong {

            display:block;

            font-size:15px;

        }


        .movifind-ai-loading small {

            display:block;

            margin-top:5px;

            opacity:.65;

        }


        /* =========================================
           AI DETECTION
        ========================================= */

        .ai-detection-card {

            width:100%;

            max-width:420px;

            margin:12px auto;

            padding:14px 16px;

            box-sizing:border-box;

            text-align:center;

            border-radius:10px;

            background:#17171d;

            border:1px solid #34343e;

            line-height:1.55;

        }


        .ai-detection-title {

            font-size:15px;

            font-weight:700;

            margin-bottom:8px;

        }


        .movifind-ai-confidence {

            margin:8px 0;

            padding:8px 10px;

            border-radius:7px;

            background:rgba(156,34,196,.12);

        }


        /* =========================================
           WATCH LANGUAGE
        ========================================= */

        .movifind-watch-language {

            margin:15px 0;

            display:flex;

            align-items:center;

            justify-content:center;

            gap:10px;

            flex-wrap:wrap;

        }


        .movifind-watch-language label {

            font-weight:600;

        }


        .movifind-watch-language select {

            padding:8px 12px;

            border-radius:8px;

            cursor:pointer;

            background:#24242d;

            color:#fff;

            border:1px solid #464653;

        }


        /* =========================================
           ACTION BUTTONS
        ========================================= */

        .movifind-action-btn {

            border:none;

            color:#fff;

            padding:8px 12px;

            border-radius:6px;

            cursor:pointer;

            font-size:11px;

        }


        .favorite-btn {

            background:#e91e63;

        }


        .watchlist-btn {

            background:#1976d2;

        }


        /* =========================================
           LIBRARY
        ========================================= */

        #movifindLibrary {

            margin-top:25px;

            padding:15px;

            background:#17171d;

            border:1px solid #34343e;

            border-radius:12px;

        }


        .movifind-library-tabs {

            display:flex;

            justify-content:center;

            gap:8px;

            flex-wrap:wrap;

            margin-bottom:15px;

        }


        .movifind-library-tab {

            border:none;

            background:#24242d;

            color:#fff;

            padding:8px 13px;

            border-radius:6px;

            cursor:pointer;

            font-size:11px;

            transition:.2s ease;

        }


        .movifind-library-tab:hover {

            background:#30303a;

        }


        .movifind-library-tab.active {

            background:#9c22c4;

            transform:translateY(-1px);

        }


        .movifind-library-heading {

            display:flex;

            justify-content:space-between;

            align-items:center;

            gap:10px;

            flex-wrap:wrap;

            margin-bottom:12px;

        }


        .movifind-library-heading h3 {

            margin:0;

            color:#ff9800;

            font-size:16px;

        }


        .movifind-clear-history {

            border:none;

            background:#9c22c4;

            color:white;

            padding:7px 10px;

            border-radius:6px;

            cursor:pointer;

            font-size:11px;

        }


        .movifind-library-empty {

            text-align:center;

            padding:20px 10px;

            color:#aaa;

            font-size:12px;

        }


        .movifind-library-grid {

            display:grid;

            grid-template-columns:
                repeat(
                    auto-fill,
                    minmax(170px,1fr)
                );

            gap:10px;

        }


        .movifind-library-item {

            background:#202027;

            border-radius:8px;

            padding:10px;

            text-align:center;

        }


        .movifind-library-poster {

            width:70px;

            height:100px;

            object-fit:cover;

            border-radius:6px;

            display:block;

            margin:0 auto 8px;

        }


        .movifind-library-poster-placeholder {

            width:70px;

            height:100px;

            margin:0 auto 8px;

            border-radius:6px;

            background:#24242d;

            display:flex;

            align-items:center;

            justify-content:center;

            font-size:25px;

        }


        .movifind-library-item strong {

            display:block;

            color:#fff;

            font-size:12px;

            line-height:1.4;

        }


        .movifind-library-year {

            color:#aaa;

            font-size:10px;

            margin:5px 0;

        }


        .movifind-library-buttons {

            display:flex;

            justify-content:center;

            flex-wrap:wrap;

            gap:4px;

        }


        .movifind-open-btn {

            border:none;

            background:#ff9800;

            color:#111;

            padding:5px 8px;

            border-radius:5px;

            cursor:pointer;

            font-size:10px;

        }


        .movifind-remove-btn {

            border:none;

            background:#9c22c4;

            color:#fff;

            padding:5px 8px;

            border-radius:5px;

            cursor:pointer;

            font-size:10px;

        }


        /* =========================================
           TOAST
        ========================================= */

        .movifind-toast {

            position:fixed;

            left:50%;

            bottom:25px;

            transform:translateX(-50%);

            background:#24242d;

            color:#fff;

            padding:10px 16px;

            border-radius:8px;

            border:1px solid #464653;

            font-size:13px;

            z-index:99999;

            box-shadow:
                0 5px 20px rgba(0,0,0,.4);

            display:none;

        }


        /* =========================================
           MOBILE
        ========================================= */

        @media (max-width:600px) {

            .movifind-library-grid {

                grid-template-columns:
                    repeat(
                        2,
                        minmax(0,1fr)
                    );

            }

        }

    `;


    document.head.appendChild(
        style
    );
}


// ======================================================
// ⚡ MOVIFIND FAST IMAGE OPTIMIZER
// ======================================================

async function optimizeMoviFindImage(file) {

    if (
        !file ||
        !file.type ||
        !file.type.startsWith("image/")
    ) {

        throw new Error(
            "Invalid image file."
        );
    }


    // ==================================================
    // ⚙️ SETTINGS
    // ==================================================

    const MAX_WIDTH = 1280;

    const MAX_HEIGHT = 1280;

    const QUALITY = 0.78;


    // ==================================================
    // 🖼️ CREATE BITMAP
    // ==================================================

    const bitmap =
        await createImageBitmap(file);


    let width =
        bitmap.width;

    let height =
        bitmap.height;


    // ==================================================
    // 📐 CALCULATE SCALE
    // ==================================================

    const scale =
        Math.min(
            1,
            MAX_WIDTH / width,
            MAX_HEIGHT / height
        );


    width =
        Math.max(
            1,
            Math.round(
                width * scale
            )
        );


    height =
        Math.max(
            1,
            Math.round(
                height * scale
            )
        );


    // ==================================================
    // 🎨 CANVAS
    // ==================================================

    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        width;

    canvas.height =
        height;


    const ctx =
        canvas.getContext(
            "2d",
            {
                alpha: false
            }
        );


    if (!ctx) {

        bitmap.close();

        throw new Error(
            "Could not create image canvas."
        );
    }


    // ==================================================
    // 🖼️ DRAW IMAGE
    // ==================================================

    ctx.drawImage(
        bitmap,
        0,
        0,
        width,
        height
    );


    // ==================================================
    // 🧹 RELEASE BITMAP
    // ==================================================

    bitmap.close();


    // ==================================================
    // 📦 CONVERT TO JPEG
    // ==================================================

    const blob =
        await new Promise(
            resolve => {

                canvas.toBlob(
                    resolve,
                    "image/jpeg",
                    QUALITY
                );

            }
        );


    if (!blob) {

        throw new Error(
            "Could not optimize image."
        );
    }


    // ==================================================
    // 📁 CREATE OPTIMIZED FILE
    // ==================================================

    return new File(
        [blob],
        "movifind-optimized.jpg",
        {
            type: "image/jpeg",
            lastModified:
                Date.now()
        }
    );
}

// ======================================================
// 📦 FORMAT FILE SIZE
// ======================================================

function formatFileSize(bytes) {

    const size =
        Number(bytes || 0);


    if (!size) {
        return "0 B";
    }


    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];


    const index =
        Math.floor(
            Math.log(size) /
            Math.log(1024)
        );


    const safeIndex =
        Math.min(
            index,
            units.length - 1
        );


    return (
        size /
        Math.pow(
            1024,
            safeIndex
        )
    ).toFixed(
        safeIndex === 0
            ? 0
            : 2
    ) +
    " " +
    units[safeIndex];
}



// ======================================================
// 1. MOVIFIND TOP NAVIGATION
// ======================================================

function setupMoviFindTopNavigation() {

    const navButtons = document.querySelectorAll(
        "[data-movifind-nav]"
    );

    if (!navButtons.length) {
        console.warn("⚠️ MoviFind top navigation buttons not found.");
        return;
    }

    navButtons.forEach(function (button) {

        button.addEventListener("click", function (event) {

            event.preventDefault();

            const target = String(
                this.dataset.movifindNav || ""
            ).toLowerCase();

            if (target === "home") {
                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
                return;
            }

            if (
                target === "favorites" ||
                target === "watchlist" ||
                target === "history"
            ) {

                const library = document.getElementById(
                    "movifindLibrary"
                );

                if (!library) {
                    console.warn("⚠️ MoviFind Library is not ready yet.");
                    return;
                }

                const tab = library.querySelector(
                    `[data-library-tab="${target}"]`
                );

                if (!tab) {
                    console.warn("⚠️ Library tab not found:", target);
                    return;
                }

                library.querySelectorAll(
                    "[data-library-tab]"
                ).forEach(function (item) {
                    item.classList.remove("active");
                });

                tab.classList.add("active");
                renderMoviFindLibrary(target);

                library.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        });
    });

    console.log("🧭 MoviFind Top Navigation: READY");
}


// ======================================================
// 2. MOVIFIND LIBRARY STARTUP
// ======================================================

function initializeMoviFindLibrary() {
    setupMoviFindLibraryStyles();
    createMoviFindLibraryUI();
    setupMoviFindTopNavigation();
    console.log("📚 MoviFind Library + Navigation: READY");
}

// ======================================================
// 3. RUN LIBRARY + NAVIGATION AFTER HTML IS READY
// ======================================================
// ======================================================
// 🧭 MOVIFIND TOP NAVIGATION
// ======================================================

function setupMoviFindTopNavigation() {

    const navButtons =
        document.querySelectorAll(
            "[data-movifind-nav]"
        );

    if (!navButtons.length) {
        console.warn(
            "⚠️ MoviFind navigation buttons not found."
        );

        return;
    }


    navButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                function () {

                    const target =
                        this.getAttribute(
                            "data-movifind-nav"
                        );


                    // ==========================================
                    // 🏠 HOME
                    // ==========================================

                    if (
                        target === "home"
                    ) {

                        navButtons.forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );

                        this.classList.add(
                            "active"
                        );

                        window.scrollTo({
                            top: 0,
                            behavior: "smooth"
                        });

                        return;
                    }


                    // ==========================================
                    // 📚 LIBRARY
                    // ==========================================

                    const library =
                        document.getElementById(
                            "movifindLibrary"
                        );

                    if (!library) {

                        console.warn(
                            "⚠️ MoviFind library not found."
                        );

                        return;
                    }


                    // ==========================================
                    // ACTIVE NAV
                    // ==========================================

                    navButtons.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );

                    this.classList.add(
                        "active"
                    );


                    // ==========================================
                    // FIND LIBRARY TAB
                    // ==========================================

                    const tab =
                        library.querySelector(
                            `[data-library-tab="${target}"]`
                        );


                    if (tab) {

                        tab.click();

                    } else {

                        console.warn(
                            "⚠️ Library tab not found:",
                            target
                        );
                    }


                    // ==========================================
                    // SCROLL
                    // ==========================================

                    setTimeout(
                        function () {

                            library.scrollIntoView({
                                behavior: "smooth",
                                block: "start"
                            });

                        },
                        50
                    );
                }
            );
        }
    );
}
if (document.readyState === "loading") {
    document.addEventListener(
    "DOMContentLoaded",
    function () {

        // ==========================================
        // 📚 LIBRARY
        // ==========================================

        setupMoviFindLibraryStyles();

        createMoviFindLibraryUI();

        updateMoviFindLibraryUI();


        // ==========================================
        // 🧭 TOP NAVIGATION
        // ==========================================

        setupMoviFindTopNavigation();


        // ==========================================
        // 🏠 DEFAULT HOME
        // ==========================================

        const homeButton =
            document.querySelector(
                '[data-movifind-nav="home"]'
            );

        if (homeButton) {
            homeButton.classList.add(
                "active"
            );
        }


        console.log(
            "✅ MoviFind navigation initialized."
        );
    }
);;
}


// ======================================================
// 🚀 STARTUP
// ======================================================

console.log(
    "========================================"
);


console.log(
    "🎬 MOVIFIND FRONTEND STARTED"
);


console.log(
    "🤖 Gemini Vision: ENABLED"
);


console.log(
    "🔎 OMDb Search: ENABLED"
);


console.log(
    "🎭 Movie: ENABLED"
);


console.log(
    "🎭 Drama: ENABLED"
);


console.log(
    "📺 Series: ENABLED"
);


console.log(
    "🎭 K-Drama: ENABLED"
);


console.log(
    "🎭 C-Drama: ENABLED"
);


console.log(
    "🎭 Thai Drama: ENABLED"
);


console.log(
    "📺 Web Series: ENABLED"
);


console.log(
    "========================================"
);


// ======================================================
// START HEALTH CHECK
// ======================================================

checkServerHealth();